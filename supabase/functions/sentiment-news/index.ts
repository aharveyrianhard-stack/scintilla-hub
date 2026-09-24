// SCINTILLA · sentiment-news — score the headlines, store the words, keep the timeline.
//
// WHY THIS EXISTS. The Hub held 490,870 headlines and 0 scored rows, because the scorer
// was a Mac script that needed the service-role key copied onto a laptop. Nobody was
// going to do that, and nobody should: here the platform injects the key into the
// function environment, so no person and no Mac ever holds it.
//
// WHAT IT DOES, and what it refuses to do:
//   · scores each (url, ticker) filing ONCE, with the shared stick in _shared/sentiment-core.mjs;
//   · stores every word that fired AND the sentence it fired in, so a number on the
//     screen can be opened down to the words;
//   · rebuilds sentiment_ticker_daily for the days it touched, from ALL stored rows for
//     that day — never from the slice it happened to read, which would undercount;
//   · never invents a reading: a headline with no listed word is stored with score NULL
//     and counted as `unscored`, not as a zero;
//   · never rewrites a row it did not score: the upsert key is (url, ticker), and the
//     lexicon sha that produced the numbers is stored beside them.
//
// TWO MODES.
//   mode=live      (default, every 10 minutes) — newest headlines first, bounded.
//   mode=backfill  — walks BACKWARDS through the 490,870 in bounded slices, writing its
//                    resume point to sentiment_backfill_state so the next call continues
//                    instead of starting over. Nothing is scored twice.
import { pg, pgAll, upsert, cfgPut, claim, lexicon } from "../_shared/db.ts";
// @ts-ignore  the shared stick is plain ESM, read by Deno, Node and the browser alike
import { prepare, scoreText, dailyRollup, dayOf, dayBounds, WEIGHTING, METHOD } from "../_shared/sentiment-core.mjs";

const SEP = "\t";   // key separator for the "already scored" set
const clampInt = (v: string | null, d: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, +(v || d) || d));

/** rebuild the daily rows for one New York day from everything stored for that day */
async function rebuildDay(day: string, sha: string, dry: boolean) {
  const b = dayBounds(day);
  const rows = await pgAll(
    `news_headline_sentiment?select=ticker,score,question,hits,published_ts` +
    `&published_ts=gte.${b.from}&published_ts=lt.${b.to}&order=published_ts.desc`, 1000, 12,
  );
  const items = rows.map((r: any) => ({
    ticker: r.ticker, day,
    score: r.score == null ? null : +r.score,
    question: !!r.question,
    marks: Array.isArray(r.hits) ? r.hits : [],
  }));
  const daily = dailyRollup(items, { source: "news", lexicon_sha: sha });
  if (!dry && daily.length) {
    await upsert("sentiment_ticker_daily", daily.map((d: any) => ({ ...d, updated_at: new Date().toISOString() })), "day,ticker,source");
  }
  return { day, read: rows.length, ticker_rows: daily.length };
}

Deno.serve(async (req) => {
  const started = Date.now();
  const u = new URL(req.url);
  const mode = (u.searchParams.get("mode") || "live").toLowerCase();
  const limit = clampInt(u.searchParams.get("limit"), mode === "backfill" ? 1500 : 600, 50, 3000);
  const maxDays = clampInt(u.searchParams.get("max_days"), 3, 1, 10);
  const dry = u.searchParams.get("dry") === "1";
  const lockKey = mode === "backfill" ? "sentiment_news_backfill_busy" : "sentiment_news_busy";
  let release: null | (() => unknown) = null;
  try {
    release = await claim(lockKey, mode === "backfill" ? 25 * 60e3 : 9 * 60e3);
    if (!release) return Response.json({ skipped: "ANOTHER_RUN_IN_FLIGHT", mode });

    const { lex, sha } = await lexicon();
    const L = prepare(lex);

    /* WHICH HEADLINES. live = the newest; backfill = older than the resume point. */
    let cursor: number | null = null, state: any = null;
    if (mode === "backfill") {
      state = (await pg("sentiment_backfill_state?select=*&source=eq.news").catch(() => []))?.[0] || null;
      if (state?.done) return Response.json({ mode, finished: true, state });
      cursor = state?.cursor_ts ? +state.cursor_ts : null;
    }
    const where = cursor ? `&published_ts=lt.${cursor}` : "";
    const news = await pg(
      `news?select=url,ticker,title,snippet,site,published_ts&published_ts=not.is.null${where}` +
      `&order=published_ts.desc&limit=${limit}`,
    );
    if (!news.length) {
      if (mode === "backfill" && !dry) {
        await upsert("sentiment_backfill_state", [{ source: "news", cursor_ts: cursor, done: true, note: "no rows older than the cursor", updated_at: new Date().toISOString() }], "source");
      }
      const empty = { ran_utc: new Date().toISOString(), mode, read: 0, note: "nothing to score" };
      await cfgPut("sentiment_news_last", JSON.stringify(empty));
      return Response.json(empty);
    }

    /* ALREADY SCORED? One read over the slice's own time range, so a re-run is cheap
       and no filing is ever scored twice. */
    const minTs = Math.min(...news.map((r: any) => +r.published_ts));
    const maxTs = Math.max(...news.map((r: any) => +r.published_ts));
    const have = new Set((await pgAll(
      `news_headline_sentiment?select=url,ticker&published_ts=gte.${minTs}&published_ts=lte.${maxTs}`, 1000, 12,
    )).map((r: any) => r.url + SEP + r.ticker));

    const out: any[] = [];
    let scored = 0, unscored = 0, questions = 0, skipped = 0;
    const days = new Set<string>();
    for (const r of news) {
      if (!r.ticker || !r.url) { skipped++; continue; }
      if (have.has(r.url + SEP + r.ticker)) { skipped++; continue; }
      const text = String(r.title || "") + (r.snippet ? ". " + r.snippet : "");
      const s = scoreText(text, L);
      if (s.score == null) unscored++; else scored++;
      if (s.question) questions++;
      const d = dayOf(+r.published_ts * 1000);
      if (d) days.add(d);
      out.push({
        url: r.url, ticker: r.ticker, published_ts: +r.published_ts,
        method: s.method || METHOD, lexicon_sha: sha,
        score: s.score == null ? null : +s.score.toFixed(3),
        question: s.question, pos_n: s.pos, neg_n: s.neg, flip_n: s.flips, unc_n: s.unc,
        hits: s.marks, title: r.title || null, site: r.site || null, sample: s.sample, source: "news",
        scored_at: new Date().toISOString(),
      });
    }
    let written = 0;
    if (!dry && out.length) written = await upsert("news_headline_sentiment", out, "url,ticker");

    /* THE TIMELINE ROWS. Bounded: the newest `maxDays` days this slice touched, rebuilt
       in full from the store. Any day left over is reported, never silently dropped. */
    const ordered = [...days].sort().reverse();
    const rebuilt = [];
    for (const d of ordered.slice(0, maxDays)) rebuilt.push(await rebuildDay(d, sha, dry));
    const deferred = ordered.slice(maxDays);

    if (mode === "backfill" && !dry) {
      await upsert("sentiment_backfill_state", [{
        source: "news",
        cursor_ts: minTs,
        scanned: (+(state?.scanned || 0)) + news.length,
        scored: (+(state?.scored || 0)) + scored,
        unscored: (+(state?.unscored || 0)) + unscored,
        slices: (+(state?.slices || 0)) + 1,
        oldest_seen: minTs,
        done: news.length < limit,
        note: "newest-first, bounded slices; cursor is the oldest published_ts scored so far",
        updated_at: new Date().toISOString(),
      }], "source");
    }

    const receipt = {
      ran_utc: new Date().toISOString(), ms: Date.now() - started, mode, dry,
      lexicon_sha: sha, method: METHOD, weighting: WEIGHTING,
      read: news.length, already_scored: skipped, wrote_items: written,
      scored, unscored, questions,
      days_touched: ordered, days_rebuilt: rebuilt, days_deferred: deferred,
      window: { from_ts: minTs, to_ts: maxTs },
    };
    await cfgPut("sentiment_news_last", JSON.stringify(receipt));
    return Response.json(receipt);
  } catch (e) {
    await cfgPut("sentiment_news_error", JSON.stringify({ at: new Date().toISOString(), error: String((e as Error).message || e) }));
    return Response.json({ failed: String((e as Error).message || e) }, { status: 500 });
  } finally {
    if (release) await release();
  }
});
