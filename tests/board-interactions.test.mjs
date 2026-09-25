import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
// Pull one top-level function (or const arrow) out of the page by name, up to the next top-level "}\n".
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n}\n", start);
  return page.slice(start, end + 3);
}

test("board header has one cell per row cell, relative volume labelled, and the same rank reserve as the rows", () => {
  const cols = page.match(/const BOARD_COLS = (\[[^\n]*\]);/)[1];
  const labels = [...cols.matchAll(/\["([^"]*)",/g)].map((m) => m[1]);
  // row template: lists (♥ ★ ◎), ticker, last, chg, USUAL DAY, fpe, mcap, REVENUE, rsi, trend, mom, read, geiger, vol, mkt dot = 15
  // (H-FRONT, 25 Sep, added REVENUE after MKT CAP; M52 added the
  // usual-day column after CHG). Trend/Mom/Read are part of
  // the static model and the row template (tests/dashboard-cold-load.test.mjs counts the rendered cells); they are no longer injected.
  assert.equal(labels.length, 15, "15 header cells for 15 row cells (was 9: no volume header; then 10 + 3 injected after first paint; M52 added USUAL DAY; H-FRONT added REVENUE)");
  assert.equal(labels[labels.indexOf("Mkt Cap") + 1], "Revenue", "REVENUE sits beside the other size column");
  assert.equal(labels[labels.indexOf("Chg") + 1], "Usual day", "the usual day sits beside the change it gives meaning to");
  assert.equal(labels[labels.indexOf("Geiger") + 1], "RVol", "relative-volume header sits over the volume cell");
  assert.equal(labels.at(-1), "Mkt", "Mkt stays over the market dot");
  assert.match(page, /\.sc-board__row, \.ch\.hdr\{padding-right:18px\}/, "header and rows share one geometry");
});

test("relative volume older than its session is shown absent with its source date, never as today's ratio", () => {
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
  const src = page.match(/const RVOL_MAX_AGE_MS = [^\n]*\n/)[0] + fn("scRvolCurrent") + fn("volCellHTML") + "\nreturn { scRvolCurrent, volCellHTML };";
  const rb = (v) => (v < 0.8 ? 1 : v < 1.2 ? 2 : v < 1.8 ? 3 : v < 2.5 ? 4 : 5);
  const { scRvolCurrent, volCellHTML } = new Function("esc", "rb", src)(esc, rb);
  assert.equal(scRvolCurrent("2026-07-06T18:03:29+00:00"), false);
  assert.equal(scRvolCurrent(new Date(Date.now() - 3600e3).toISOString()), true);
  assert.equal(scRvolCurrent(null), false);
  const stale = volCellHTML(null, "2026-07-06T18:03:29+00:00");
  assert.match(stale, />—</); assert.match(stale, /not current — source last written 2026-07-06/);
  assert.match(volCellHTML(0.9, new Date().toISOString()), /0\.9×/);
  assert.match(page, /if \(bv && !scRvolCurrent\(bv\.updated_ts\)\) return null;/, "board column gated");
  assert.match(page, /scRvolCurrent\(bvol\[0\]\.updated_ts\) && num\(bvol\[0\]\.rvol_at_time\)/, "GEIGER-tab rings gated");
  assert.match(page, /board_volume\?select=ticker,rvol_at_time,cum_rvol,session_rvol,updated_ts/);
});

test("a cohort switch paints the new scope from the latest pull; the previous scope is never painted under the new selection", () => {
  const COHSETS = { MEGACAP: new Set(["AAPL", "MSFT"]), CRYPTO: new Set(["BTCUSD"]) };
  const src = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent")) + fn("boardScopeHas") + "\nlet BOARD_SNAPSHOT = null;\n" + page.match(/const BOARD_SNAPSHOT_MAX_AGE_MS = [^\n]*\n/)[0] +
    fn("scopeRowsFromSnapshot") + "\nreturn { set: (s) => { BOARD_SNAPSHOT = s; }, scopeRowsFromSnapshot, boardScopeHas };";
  const api = new Function("COHSETS", "cohKey", src)(COHSETS, (k) => k);
  const rows = [{ t: "AAPL", price: 336.13 }, { t: "MSFT", price: 496.9 }, { t: "BTCUSD", price: 76712 }, { t: "NBIS", price: 216.65 }];
  api.set({ at: Date.now() - 20000, rows, cohByT: {} });
  const mega = api.scopeRowsFromSnapshot("MEGACAP", []);
  assert.deepEqual(mega.map((r) => r.t), ["AAPL", "MSFT"]);
  assert.equal(mega[0].price, 336.13, "real values from the latest pull");
  assert.notEqual(mega[0], rows[0], "copies, not the snapshot's objects");
  assert.deepEqual(api.scopeRowsFromSnapshot("FAV", ["NBIS"]).map((r) => r.t), ["NBIS"]);
  api.set({ at: Date.now() - 120000, rows, cohByT: {} });
  assert.equal(api.scopeRowsFromSnapshot("MEGACAP", []), null, "an old pull is not used — the switch shows pending instead");
  const coh = page.match(/case "coh": \{[\s\S]*?break;\n    \}/)[0];
  assert.doesNotMatch(coh, /updateBoard\(\)/, "the handler no longer repaints the old rows before the new scope is seeded");
  assert.match(coh, /restartFeed\(\); if \(LEFT_HEAT/);
  const rf = fn("restartFeed");
  assert.ok(rf.indexOf("scopeRowsFromSnapshot(feedCoh, feedFav)") < rf.indexOf("seedBoardFromCache(feedCoh, feedFav)"));
  assert.match(rf, /if \(!seeded\) \{ S\.rows = \[\]; S\.boardOrder = \[\]; \}/, "cold: previous rows are removed, not kept");
  assert.match(page, /BOARD_SNAPSHOT = \{ at: Date\.now\(\), rows: rows, cohByT: COH_BY_T \};\n  rows = rows\.filter\(\(r\) => boardScopeHas\(cohort, r\.t, COH_BY_T\[r\.t\]\)\);/);
});

test("pending is not absent: cached-layout rows show … and the cohort summary keeps its shape", () => {
  assert.match(page, /d\.state === "CONNECTING" \? SC_PENDING : "—"/, "price and change");
  assert.match(page, /d\.g == null && d\.state === "CONNECTING" \? '<span style="text-align:center">' \+ SC_PENDING/, "geiger");
  const S = { coh: "FAV", rows: [{ t: "AMD", g: null, state: "CONNECTING" }, { t: "BE", g: null, state: "CONNECTING" }], cohGeigerOpen: false, boardPending: null };
  const esc = (s) => String(s);
  const SC_PENDING = page.match(/const SC_PENDING = ('[^\n]*');/)[1];
  const html = new Function("S", "esc", "geigerMiniHTML", "SC_PENDING", "return " + fn("cohortGeigerHTML") + ";")(S, esc, () => "", eval(SC_PENDING))();
  assert.match(html, /is-mean/, "the MEAN line keeps its place");
  assert.match(html, /loading/);
  assert.doesNotMatch(html, /awaiting data/, "no collapse to the short 'awaiting data' block (the 16px jump)");
});

test("cohort compare shows every cohort in one row without sideways scroll", () => {
  assert.match(page, /id="cohStrip" style="--coh-n:' \+ list\.length/);
  const base = page.match(/\.sc-cohstrip\{ flex:0 0 auto;[^}]*\}/)[0];
  assert.doesNotMatch(base, /overflow-x:auto/); assert.match(base, /repeat\(var\(--coh-n,10\),minmax\(0,1fr\)\)/);
  assert.doesNotMatch(page, /grid-auto-columns:minmax\(54px,1fr\) !important/, "no 54px floor forcing a scroll");
  assert.match(page, /overflow-x:hidden !important/);
  assert.match(page, /replace\("constructive", "construc&shy;tive"\)/, "the one long read can wrap");
  assert.match(page, /toFixed\(2\)\.replace\(\/\^0\(\?=\\\.\)\/, ""\)/, "trend/momentum magnitudes drop the leading zero to fit");
});
