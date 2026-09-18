// OPTIONAL hunks (candidate-optional.patch, applies on top of candidate.patch). Same conventions as dashboard-cold-load.test.mjs.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(process.env.SC_PAGE || new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n}\n", start);
  return page.slice(start, end + 3);
}

test("a refused Geiger is asked again after 8 s, 16 s, 32 s, then at the normal cadence; acceptance resets it", () => {
  const boardPullDelay = new Function(fn("boardPullDelay") + "return boardPullDelay;")();
  assert.equal(boardPullDelay(45000, 0), 45000, "accepted pull: unchanged cadence");
  assert.deepEqual([1, 2, 3, 4, 9].map((n) => boardPullDelay(45000, n)), [8000, 16000, 32000, 45000, 45000]);
  assert.equal(boardPullDelay(5000, 1), 5000, "never slower than the feed's own interval");
});

test("the feed schedules from the Geiger acceptance of the pull it just made, and relaxes no acceptance rule", async () => {
  const delays = [];
  const SC_CG = { meta: { current_equalizer_validated: false } };
  const src = fn("boardPullDelay") + fn("startBoardFeed") + "\nreturn startBoardFeed;";
  let pulls = 0;
  const startBoardFeed = new Function("fetchBoardRows", "SC_CG", "window", "setTimeout", "clearTimeout", "console", src)(
    async () => { pulls++; return []; }, SC_CG, { SC_CLEAN_READS: true },
    (f, ms) => { delays.push(ms); if (delays.length === 2) SC_CG.meta.current_equalizer_validated = true; if (delays.length < 4) Promise.resolve().then(f); return 1; },
    () => {}, console);
  startBoardFeed("FAV", [], () => {}, () => {});
  await new Promise((r) => setImmediate(r)); await new Promise((r) => setImmediate(r));
  assert.deepEqual(delays, [8000, 16000, 45000, 45000], "two refusals back off, the accepted pull returns to 45 s");
  assert.equal(pulls, 4);
  assert.doesNotMatch(fn("scRetainCandidateGeiger"), /boardPullDelay/, "the refusal path itself is untouched");
  assert.match(page, /const rows = await pg\(SC_OPERATOR_WEIGHT_PATH, 1\);/, "the current-Equalizer read is unchanged");
});

test("the search universe is taken from the board's own latest pull; a second full pull is only the fallback", () => {
  const allRowsFromSnapshot = new Function(fn("allRowsFromSnapshot") + "return allRowsFromSnapshot;")();
  const rows = [{ t: "AAPL" }, { t: "BTCUSD" }];
  assert.equal(allRowsFromSnapshot({ at: 1000, rows }, 1000 + 299000, 300000), rows);
  assert.equal(allRowsFromSnapshot({ at: 1000, rows }, 1000 + 300001, 300000), null, "old snapshot: fall back to the pull");
  assert.equal(allRowsFromSnapshot(null, 0, 300000), null);
  assert.equal(allRowsFromSnapshot({ at: 0, rows: [] }, 0, 300000), null);
  assert.doesNotMatch(page, /\nrefreshAllRows\(\); setInterval\(refreshAllRows, 300000\);/, "no full second pull at parse time");
  assert.match(page, /\nsetTimeout\(refreshAllRows, 8000\); setInterval\(refreshAllRows, 300000\);/);
  let pulled = 0; const ALLTK = new Set();
  const refresh = new Function("BOARD_SNAPSHOT", "ALLROWS_SNAPSHOT_MAX_AGE_MS", "ALLTK", "fetchBoardRows",
    fn("allRowsFromSnapshot") + "let ALLROWS = [];" + fn("refreshAllRows") + "refreshAllRows(); return ALLROWS;");
  assert.equal(refresh({ at: Date.now(), rows }, 300000, ALLTK, async () => { pulled++; return []; }), rows);
  assert.equal(pulled, 0); assert.ok(ALLTK.has("BTCUSD"));
  refresh(null, 300000, ALLTK, async () => { pulled++; return []; });
  assert.equal(pulled, 1, "no snapshot yet: the old pull still runs");
});
