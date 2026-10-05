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
//   mode=live      (default, every 10 minutes) — the newest ARRIVALS, bounded. Arrival, not
//                    publish time: most headlines reach the table hours after their stamp,
//                    and a "newest by publish time" slice never saw them (5 Oct, N1).
//   mode=backfill  — walks BACKWARDS through the 490,870 in bounded slices, writing its
//                    resume point to sentiment_backfill_state so the next call continues
//                    instead of starting over. Nothing is scored twice. `since=YYYY-MM-DD`
//                    stops the walk at that day. It is finished only when a read comes
//                    back empty (or passes `since`), never because a page was short.
import { pg, pgAll, upsert, cfgPut, claim, lexicon } from "../_shared/db.ts";
// @ts-ignore  the shared stick is plain ESM, read by Deno, Node and the browser alike
import { prepare, scoreText, dailyRollup, dayOf, dayBounds, WEIGHTING, METHOD } from "../_shared/sentiment-core.mjs";
// @ts-ignore  the decisions of a run, plain ESM so node can test them
import { PAGE_CAP, liveQuery, backfillQuery, boundaryQuery, needsBoundary, mergeRows, backfillNext, sinceToTs, urlInFilters, pickDays, parseDays } from "./plan.mjs";

const SEP = "\t";   // key separator for the "already scored" set
const clampInt = (v: string | null, d: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, +(v || d) || d));

/** rebuild the daily rows for one New York day from everything stored for that day */
async function rebuildDay(day: string, sha: string, dry: boolean) {
  const b = dayBounds(day);
  const rows = await pgAll(
    `news_headline_sentiment?select=ticker,score,question,hits,published_ts` +
    `&published_ts=gte.${b.from}&published_ts=lt.${b.to}&order=published_ts.desc`, 1000, DAY_PAGES,
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
  return { day, read: rows.length, ticker_rows: daily.length, capped: rows.length >= DAY_PAGES * 1000 };
}
/* the busiest stored day holds 9,649 filings; 12 pages would have cut a fully scored day */
const DAY_PAGES = 40;

Deno.serve(async (req) => {
  const started = Date.now();
  const u = new URL(req.url);
  const mode = (u.searchParams.get("mode") || "live").toLowerCase();
  const limit = clampInt(u.searchParams.get("limit"), mode === "backfill" ? PAGE_CAP : 600, 50, PAGE_CAP);
  const sinceTs = sinceToTs(u.searchParams.get("since"));
  const pendingKey = mode === "backfill" ? "sentiment_news_backfill_days_pending" : "sentiment_news_days_pending";
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
    let news = await pg(mode === "backfill" ? backfillQuery(cursor, limit) : liveQuery(limit));
    if (mode === "backfill" && needsBoundary(news, limit)) {
      const edge = Math.min(...news.map((r: any) => +r.published_ts));
      news = mergeRows(news, await pgAll(boundaryQuery(edge), 1000, 10), SEP);
    }
    if (!news.length) {
      if (mode === "backfill" && !dry) {
        const end = backfillNext({ rows: news, cursor, sinceTs });
        await upsert("sentiment_backfill_state", [{ source: "news", cursor_ts: end.cursor_ts, done: end.done, note: end.why, updated_at: new Date().toISOString() }], "source");
      }
      const empty = { ran_utc: new Date().toISOString(), mode, read: 0, note: "nothing to score" };
      await cfgPut("sentiment_news_last", JSON.stringify(empty));
      return Response.json(empty);
    }

    /* ALREADY SCORED? No filing is ever scored twice. The back-fill slice is one tight run
       of publish time, so one read over that range answers it. The live slice is late
       arrivals whose publish times span months, so it is asked by name instead. */
    const minTs = Math.min(...news.map((r: any) => +r.published_ts));
    const maxTs = Math.max(...news.map((r: any) => +r.published_ts));
    const haveRows: any[] = [];
    if (mode === "backfill") {
      haveRows.push(...await pgAll(
        `news_headline_sentiment?select=url,ticker&published_ts=gte.${minTs}&published_ts=lte.${maxTs}`, 1000, DAY_PAGES,
      ));
    } else {
      const filters = urlInFilters(news.map((r: any) => r.url));
      for (let i = 0; i < filters.length; i += 6) {
        const got = await Promise.all(filters.slice(i, i + 6).map((f: string) => pgAll(`news_headline_sentiment?select=url,ticker&${f}`, 1000, 5)));
        for (const g of got) haveRows.push(...g);
      }
    }
    const have = new Set(haveRows.map((r: any) => r.url + SEP + r.ticker));

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

    /* THE TIMELINE ROWS. Bounded: `maxDays` days per run, each rebuilt in full from the
       store. A day this run cannot afford is written to a waiting list and rebuilt by the
       next runs — it used to be reported here and then never rebuilt. */
    const ordered = [...days].sort().reverse();
    const waiting = parseDays((await pg(`app_config?select=value&key=eq.${pendingKey}`).catch(() => []))?.[0]?.value);
    const plan = pickDays(ordered, waiting, maxDays);
    const rebuilt = [];
    for (const d of plan.now) rebuilt.push(await rebuildDay(d, sha, dry));
    const deferred = plan.later;
    if (!dry && (deferred.length || waiting.length)) await cfgPut(pendingKey, JSON.stringify(deferred.slice(0, 300)));

    const next = mode === "backfill" ? backfillNext({ rows: news, cursor, sinceTs }) : null;
    if (next && !dry) {
      await upsert("sentiment_backfill_state", [{
        source: "news",
        cursor_ts: next.cursor_ts,
        scanned: (+(state?.scanned || 0)) + news.length,
        scored: (+(state?.scored || 0)) + scored,
        unscored: (+(state?.unscored || 0)) + unscored,
        slices: (+(state?.slices || 0)) + 1,
        oldest_seen: minTs,
        done: next.done,
        note: "newest-first, bounded slices; cursor is the oldest published_ts scored so far · " + next.why,
        updated_at: new Date().toISOString(),
      }], "source");
    }

    const receipt = {
      ran_utc: new Date().toISOString(), ms: Date.now() - started, mode, dry,
      lexicon_sha: sha, method: METHOD, weighting: WEIGHTING,
      read: news.length, already_scored: skipped, wrote_items: written,
      scored, unscored, questions,
      days_touched: ordered, days_rebuilt: rebuilt, days_deferred: deferred,
      slice: mode === "backfill" ? "older than the cursor, by publish time" : "newest arrivals",
      backfill: next,
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
