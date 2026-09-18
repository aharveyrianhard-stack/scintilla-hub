// Review regressions for the dashboard cold-load candidate (DL-1 + review fix-A). Same conventions as
// dashboard-cold-load.test.mjs: functions are cut out of the page text and run against stubs; nothing leaves the process.
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
function favLoadWith(S, pg, restartFeed, updateBoard) {
  const src = fn("sameTickerSet") + fn("favLoad") + "\nreturn favLoad;";
  return new Function("S", "pg", "operatorWrite", "lsSet", "NEWS_CACHE", "restartFeed", "updateBoard", "console", src)(
    S, pg, async () => {}, () => {}, { delete: () => {} }, restartFeed, updateBoard, { error: () => {} });
}

test("favLoad: a star toggled while hub_favorites is in flight leaves the feed serving the list the stars show", async () => {
  for (const coh of ["FAV", "MEGACAP"]) {
    const S = { fav: ["MU", "NBIS"], coh }; const feeds = [], calls = []; let resolve;
    const restartFeed = () => feeds.push(S.fav.slice());                     // restartFeed() captures S.fav for the new feed
    const favLoad = favLoadWith(S, () => new Promise((r) => { resolve = r; }), restartFeed, () => calls.push("updateBoard"));
    const p = favLoad(); restartFeed();                                     // boot order: favLoad(); restartFeed();
    S.fav = S.fav.concat(["AMD"]); restartFeed(); calls.push("toggle");     // toggleFav("AMD") while the read is in flight
    resolve([{ ticker: "MU" }, { ticker: "NBIS" }]);                        // the server has not seen the toggle yet
    await p;
    if (coh === "FAV") assert.deepEqual(new Set(feeds.at(-1)), new Set(S.fav), "the FAV board serves the favourites the stars show");
    else assert.equal(calls.at(-1), "updateBoard", "stars repainted to the list favLoad installed");
  }
});

test("boot: whatever hub_favorites does (fails / [] / same / different / not an array / late), exactly one feed runs and it serves S.fav", async () => {
  const cases = {
    fails: () => Promise.reject(new Error("pg hub_favorites -> 500")),
    empty: async () => [],
    same: async () => [{ ticker: "NBIS" }, { ticker: "MU" }],
    different: async () => [{ ticker: "MU" }, { ticker: "AMD" }],
    notArray: async () => null,
    late: () => new Promise((r) => setTimeout(() => r([{ ticker: "AMD" }]), 5)),
  };
  for (const [name, pg] of Object.entries(cases)) {
    const S = { fav: ["MU", "NBIS"], coh: "FAV" }; let running = 0, starts = 0, serving = null;
    const restartFeed = () => { running = 1; starts++; serving = S.fav.slice(); };   // stops the old feed, starts one for S.fav
    const favLoad = favLoadWith(S, pg, restartFeed, () => {});
    const p = favLoad(); restartFeed(); await p;
    assert.equal(running, 1, name + ": a feed is running");
    assert.deepEqual(new Set(serving), new Set(S.fav), name + ": it serves the favourites on screen");
    if (["fails", "empty", "same", "notArray"].includes(name)) assert.equal(starts, 1, name + ": the boot pull is not restarted");
  }
});

test("ticker_cohorts paging cannot loop forever or double count, whatever the server does with offset", async () => {
  const src = page.match(/const EST_TTL_MS = [^\n]*\n/)[0] + fn("pgAll") + fn("buildCohSets") + "\nreturn { pgAll, buildCohSets };";
  const table = Array.from({ length: 1280 }, (_, i) => ({ ticker: "T" + String(i % 640).padStart(4, "0"), cohort: i < 640 ? "A" : "B" }));
  const servers = {
    honest: (o) => table.slice(o, o + 1000),
    ignoresOffset: () => table.slice(0, 1000),
    alwaysFull: (o) => Array.from({ length: 1000 }, (_, i) => table[(o + i) % table.length]),
  };
  for (const [name, srv] of Object.entries(servers)) {
    let n = 0;
    const api = new Function("pg", src)(async (path) => { n++; return srv(+(/offset=(\d+)/.exec(path) || [0, 0])[1]); });
    const sets = api.buildCohSets(await api.pgAll("ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc"));
    assert.ok(n <= 6, name + ": " + n + " requests (bounded by EST_MAX_PAGES)");
    assert.ok(sets.A.size <= 640 && (sets.B ? sets.B.size : 0) <= 640, name + ": a membership is counted once");
    if (name === "honest") { assert.equal(n, 2); assert.equal(sets.A.size + sets.B.size, 1280); }
  }
});

test("a failed ticker_cohorts page leaves no half map and is retried on the next call", async () => {
  const src = "let COHSETS = null;\n" + page.match(/let cohSetsReady = null;\n/)[0] + page.match(/const EST_TTL_MS = [^\n]*\n/)[0] +
    fn("pgAll") + fn("buildCohSets") + fn("loadCohSets") + "\nreturn { loadCohSets, get: () => COHSETS };";
  let fail = true, n = 0;
  const api = new Function("pg", src)(async (path) => { n++; const o = +(/offset=(\d+)/.exec(path) || [0, 0])[1];
    if (o === 1000 && fail) throw new Error("pg -> 503"); return Array.from({ length: o ? 280 : 1000 }, (_, i) => ({ ticker: "T" + (o + i), cohort: "X" })); });
  await assert.rejects(api.loadCohSets());
  assert.equal(api.get(), null, "no partial membership map is installed");
  fail = false;
  const sets = await api.loadCohSets();
  assert.equal(sets.X.size, 1280, "the next call reads the whole map");
});
