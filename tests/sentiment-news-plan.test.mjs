/* N1 (5 Oct 2026) · the decisions of a sentiment-news run. Three faults were measured on the
   live database and each is pinned here: the live slice read the whole news table (no index
   on publish time) and never saw a late arrival; the back-fill ended itself on its first
   slice; days a run could not afford to rebuild were forgotten. Offline: no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const P = await import(join(ROOT, "supabase/functions/sentiment-news/plan.mjs"));
const SRC = readFileSync(join(ROOT, "supabase/functions/sentiment-news/index.ts"), "utf8");

const row = (i, ts) => ({ url: "https://x.test/" + i, ticker: "T" + (i % 7), published_ts: ts });

test("LIVE reads the newest ARRIVALS through the index that exists, never a sort on publish time", () => {
  const q = P.liveQuery(600);
  assert.match(q, /order=updated_ts\.desc/);
  assert.ok(!/order=published_ts/.test(q), "publish-time order = a full read of the table and blind to late arrivals");
  assert.match(q, /limit=600$/);
  assert.match(SRC, /mode === "backfill" \? backfillQuery\(cursor, limit\) : liveQuery\(limit\)/);
});

test("no request asks for more rows than the database hands out", () => {
  assert.equal(P.PAGE_CAP, 1000);
  assert.match(P.liveQuery(3000), /limit=1000$/);
  assert.match(P.backfillQuery(123, 1500), /limit=1000$/);
  assert.match(SRC, /mode === "backfill" \? PAGE_CAP : 600, 50, PAGE_CAP\)/);
});

test("BACK-FILL: a short page is not the end (the fault that left 554,681 headlines unread)", () => {
  /* 24 Sep: asked for 1,500, got the 1,000 the database allows, wrote done = true */
  const rows = Array.from({ length: 1000 }, (_, i) => row(i, 1790190000 - i));
  const n = P.backfillNext({ rows, cursor: null });
  assert.equal(n.done, false);
  assert.equal(n.cursor_ts, 1790190000 - 999);
  const short = P.backfillNext({ rows: rows.slice(0, 40), cursor: 1790190000 });
  assert.equal(short.done, false, "40 rows read = 40 rows to score, and then another look");
  assert.ok(!/done: news\.length < limit/.test(SRC), "the old rule must be gone from the function");
});

test("BACK-FILL: finished only on an empty read, or past the `since` floor", () => {
  assert.deepEqual(P.backfillNext({ rows: [], cursor: 500 }), { cursor_ts: 500, done: true, why: "no rows older than the cursor" });
  const since = P.sinceToTs("2026-09-23");
  assert.equal(since, Date.UTC(2026, 8, 23) / 1000);
  assert.equal(P.backfillNext({ rows: [row(1, since + 50), row(2, since + 10)], cursor: null, sinceTs: since }).done, false);
  const past = P.backfillNext({ rows: [row(1, since + 50), row(2, since - 10)], cursor: null, sinceTs: since });
  assert.equal(past.done, true);
  assert.equal(past.why, "reached the since floor");
  for (const bad of [null, "", "yesterday", "2026-9-3", "20260923"]) assert.equal(P.sinceToTs(bad), null);
});

test("BACK-FILL: a publish stamp shared by more rows than a page is read whole, not cut", () => {
  /* live: 1,475 rows share 2026-07-30 07:00Z */
  const page = Array.from({ length: 1000 }, (_, i) => row(i, i < 300 ? 2000 : 1000));
  assert.equal(P.needsBoundary(page, 1000), true);
  assert.equal(P.needsBoundary(page.slice(0, 999), 1000), false);
  assert.match(P.boundaryQuery(1000), /published_ts=eq\.1000/);
  const rest = Array.from({ length: 900 }, (_, i) => row(i + 600, 1000));   // 400 overlap the page
  const all = P.mergeRows(page, rest);
  assert.equal(all.length, 1500);
  assert.equal(new Set(all.map((r) => r.url + "\t" + r.ticker)).size, 1500, "no filing twice");
  assert.equal(P.backfillNext({ rows: all, cursor: null }).cursor_ts, 1000, "the next slice starts strictly below the whole stamp");
  assert.match(P.backfillQuery(1000, 1000), /published_ts=lt\.1000/);
});

test("ALREADY SCORED is asked by name, in filters short enough for a URL, losing no URL", () => {
  const urls = Array.from({ length: 600 }, (_, i) => `https://news.test/a/${i}?q=1,2&t="x"(y)\\z`);
  const f = P.urlInFilters([...urls, urls[0], null, ""]);
  assert.ok(f.length > 1);
  let n = 0;
  for (const x of f) {
    assert.match(x, /^url=in\.\(/);
    assert.ok(x.length <= 2400 + 20, "one filter stays inside the budget");
    const inner = x.slice("url=in.(".length, -1).split(",").map(decodeURIComponent);
    for (const v of inner) {
      assert.ok(v.startsWith('"') && v.endsWith('"'), "every value is quoted: commas and brackets are data");
      n++;
    }
  }
  assert.equal(n, 600, "every distinct URL is asked about exactly once");
  const one = decodeURIComponent(P.urlInFilters(['a"b\\c'])[0]);
  assert.equal(one, 'url=in.("a\\"b\\\\c")');
  assert.deepEqual(P.urlInFilters([]), []);
});

test("DAYS: what a run cannot rebuild waits its turn; today stays first; the oldest is not starved", () => {
  assert.deepEqual(P.pickDays(["2026-10-05", "2026-10-04"], [], 3), { now: ["2026-10-05", "2026-10-04"], later: [] });
  const p = P.pickDays(["2026-10-05", "2026-10-04", "2026-10-03", "2026-10-01"], ["2026-09-20", "2026-10-04"], 3);
  assert.deepEqual(p.now, ["2026-10-05", "2026-10-04", "2026-09-20"]);
  assert.deepEqual(p.later, ["2026-10-03", "2026-10-01"]);
  assert.deepEqual(P.pickDays([], ["2026-09-20"], 3), { now: ["2026-09-20"], later: [] });
  assert.deepEqual(P.pickDays(["2026-10-05", "2026-10-04"], [], 1), { now: ["2026-10-05"], later: ["2026-10-04"] });
  /* every waiting day is rebuilt within a bounded number of runs even if each run touches today */
  let waiting = ["2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04"], runs = 0;
  while (waiting.length && runs < 20) { waiting = P.pickDays(["2026-10-05", "2026-10-04"], waiting, 3).later; runs++; }
  assert.equal(waiting.length, 0);
  assert.ok(runs <= 4);
});

test("the waiting list survives a broken value, and the function writes it down", () => {
  assert.deepEqual(P.parseDays('["2026-10-01","nope",5]'), ["2026-10-01"]);
  for (const bad of [null, "", "0", "{", '{"a":1}']) assert.deepEqual(P.parseDays(bad), []);
  assert.match(SRC, /cfgPut\(pendingKey, JSON\.stringify\(deferred/);
  assert.match(SRC, /sentiment_news_backfill_days_pending" : "sentiment_news_days_pending"/, "live and back-fill run side by side: one list each");
});

test("a failed read carries the database's own words, not just a number", () => {
  const db = readFileSync(join(ROOT, "supabase/functions/_shared/db.ts"), "utf8");
  assert.match(db, /" -> " \+ r\.status \+ " " \+ \(await r\.text\(\)/);
});
