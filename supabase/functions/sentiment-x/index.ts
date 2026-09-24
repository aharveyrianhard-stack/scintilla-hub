// SCINTILLA · sentiment-x — score the posts the collector already published, and keep them.
//
// WHY. The X reading existed only inside one browser tab: the room fetched /api/xfeed,
// scored it on the fly and stored nothing, so there was no history, no way to check a
// reading afterwards, and every visitor re-did the same arithmetic.
//
// WHAT IT READS. Only the feed the collector publishes (/api/xfeed). It does not open a
// browser, does not touch Alan's Mac, does not log in anywhere, and cannot make the
// collector run. If the collector is behind, this function stores nothing new and says so —
// a quiet feed is never reported as a calm market.
//
// ONE POST, ONE VOTE, PER TICKER IT NAMES. A post that names three tickers files three
// rows with the same score; the handle is kept so "who is moving the read" can be answered.
import { upsert, cfgPut, claim, lexicon } from "../_shared/db.ts";
// @ts-ignore  the shared stick is plain ESM, read by Deno, Node and the browser alike
import { prepare, scoreText, cashTags, dailyRollup, dayOf, WEIGHTING, METHOD } from "../_shared/sentiment-core.mjs";

const FEED = Deno.env.get("XFEED_URL") || "https://scintillahub.ai/api/xfeed";
const clampInt = (v: string | null, d: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, +(v || d) || d));

Deno.serve(async (req) => {
  const started = Date.now();
  const u = new URL(req.url);
  const days = clampInt(u.searchParams.get("days"), 3, 1, 30);
  const dry = u.searchParams.get("dry") === "1";
  let release: null | (() => unknown) = null;
  try {
    release = await claim("sentiment_x_busy", 25 * 60e3);
    if (!release) return Response.json({ skipped: "ANOTHER_RUN_IN_FLIGHT" });

    const r = await fetch(FEED, { headers: { Accept: "application/json" } });
    if (!r.ok) {
      /* 503 is the collector's own honest answer when no manifest is published. Record it
         as a collection fact and write nothing. */
      const miss = { ran_utc: new Date().toISOString(), feed: FEED, feed_status: r.status, posts: 0,
        note: "the published feed is not readable, so nothing was scored" };
      await cfgPut("sentiment_x_last", JSON.stringify(miss));
      return Response.json(miss, { status: 200 });
    }
    const j = await r.json();
    const posts = Array.isArray(j?.posts) ? j.posts : [];
    const { lex, sha } = await lexicon();
    const L = prepare(lex);

    const cutoff = Date.now() - days * 864e5;
    const rows: any[] = [];
    const items: any[] = [];
    let inWindow = 0, noTicker = 0, noReading = 0, newest = 0;
    for (const p of posts) {
      const ts = Date.parse(p?.created_at);
      if (!isFinite(ts)) continue;
      newest = Math.max(newest, ts);
      if (ts < cutoff) continue;
      inWindow++;
      const text = String(p?.text || "") + " " + String(p?.original?.text || "");
      const tks = cashTags(text);
      if (!tks.length) { noTicker++; continue; }
      const s = scoreText(text, L);
      if (s.score == null) noReading++;
      const day = dayOf(ts);
      for (const tk of tks) {
        rows.push({
          post_id: String(p.id || p.url || (p.handle + ":" + ts)), ticker: tk,
          handle: String(p.handle || "").replace(/^@/, "") || null,
          published_ts: Math.round(ts / 1000),
          method: METHOD, lexicon_sha: sha,
          score: s.score == null ? null : +s.score.toFixed(3),
          question: s.question, pos_n: s.pos, neg_n: s.neg, flip_n: s.flips, unc_n: s.unc,
          hits: s.marks, sample: s.sample,
          scored_at: new Date().toISOString(),
        });
        items.push({ ticker: tk, day, score: s.score, question: s.question, marks: s.marks });
      }
    }

    let written = 0;
    if (!dry && rows.length) written = await upsert("x_post_sentiment", rows, "post_id,ticker");

    /* the daily rows are rebuilt from THIS pass only, because the feed is the whole store:
       the collector republishes the entire feed each time, so a day's posts are all here
       or the feed itself is short — which the receipt reports. */
    const daily = dailyRollup(items, { source: "x", lexicon_sha: sha });
    if (!dry && daily.length) {
      await upsert("sentiment_ticker_daily", daily.map((d: any) => ({ ...d, updated_at: new Date().toISOString() })), "day,ticker,source");
    }

    const receipt = {
      ran_utc: new Date().toISOString(), ms: Date.now() - started, dry,
      feed: FEED, lexicon_sha: sha, method: METHOD, weighting: WEIGHTING,
      posts_in_feed: posts.length, window_days: days, posts_in_window: inWindow,
      posts_without_a_ticker: noTicker, posts_with_no_listed_word: noReading,
      rows_written: written, ticker_days: daily.length,
      newest_post_utc: newest ? new Date(newest).toISOString() : null,
      collector_behind: newest ? Date.now() - newest > 4 * 3600e3 : null,
    };
    await cfgPut("sentiment_x_last", JSON.stringify(receipt));
    return Response.json(receipt);
  } catch (e) {
    await cfgPut("sentiment_x_error", JSON.stringify({ at: new Date().toISOString(), error: String((e as Error).message || e) }));
    return Response.json({ failed: String((e as Error).message || e) }, { status: 500 });
  } finally {
    if (release) await release();
  }
});
