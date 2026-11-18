/* 18 Nov 2026 — the empty fund columns. Alan: "I'm clicking around between the sectors. But there's a lot of these that don't
   have securities in the cohort ... Can we load some of those, but like ... the off Geiger treatment ... some kind of daily
   Geiger ... level type thing, but then I can actually see it. I don't think we need like the fundamentals."
   Measured before the fix (headless, every column clicked): 58 columns in 5 cards opened an empty board - iShares, Vanguard,
   EQUAL-WEIGHT, BREADTH and INDEX FUNDS - because cohKey() knew only the 11 SPDR tickers.
   1. The iShares, Vanguard and RSPx columns resolve to their slot's sector, the same as the SPDR in that slot.
   2. The broad funds (index funds, RSP, QQQE, EQAL) = OUR names the fund holds, from the holdings file; EQAL (no list on
      file) uses the Russell 3000 (IWV) and says so. Kept apart from COHSETS: the board's universe never grows.
   3. Under a fund's board: its biggest holdings NOT on the Hub, light - daily Geiger level, trend, momentum, weight, name -
      never a board row; never painted without the Hub's own set; a failed read waits a minute before the next. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
};
const constBlock = (name) => { const m = page.match(new RegExp("const " + name + " = \\{[\\s\\S]*?\\};")); assert.ok(m, name + " present"); return m[0]; };
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0]; };

function keyApi(COHSETS) {
  const src = constBlock("SPDR_TO_SECTOR") + "\n" + constBlock("FAMILY_TO_SECTOR") + "\n" + fn("cohKey") + "\nreturn { cohKey, SPDR_TO_SECTOR, FAMILY_TO_SECTOR };";
  return new Function("COHSETS", src)(COHSETS);
}
function fundApi() {
  const src = line(/const FUND_HOLD_ALIAS = [^\n]*/) + "\n" + line(/const fundTk = [^\n]*/) + "\nlet FUND_LITE_IX = null;\nconst FUND_LITE_MAX = 25;\n" +
    fn("buildFundSets") + fn("fundLiteRows") + "\nreturn { buildFundSets, fundLiteRows };";
  return new Function(src)();
}
function scopeApi(COHSETS, FUNDSETS) {
  const src = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent")) +
    "const SC_GEIGER_ONLY = new Set();\n" + constBlock("SPDR_TO_SECTOR") + "\n" + constBlock("FAMILY_TO_SECTOR") + "\n" + fn("cohKey") + fn("boardScopeHas") + "\nreturn boardScopeHas;";
  return new Function("COHSETS", "FUNDSETS", src)(COHSETS, FUNDSETS);
}

test("the iShares, Vanguard and RSPx columns resolve to the sector of their slot, exactly as the SPDR beside them", () => {
  const fam = line(/var SECT_FAMILY_FUNDS=\{[\s\S]*?\};/);
  const lists = Object.fromEntries([...fam.matchAll(/(\w+):\s*\[([^\]]*)\]/g)].map((m) => [m[1], m[2].match(/"(\w+)"/g).map((x) => x.replace(/"/g, ""))]));
  const K = keyApi({ STAPLES: new Set(["KO"]) });
  assert.equal(lists.SPDR.length, 11);
  for (const fam of ["ISHARES", "VANGUARD", "EQWT"]) {
    assert.equal(lists[fam].length, 11, fam);
    lists[fam].forEach((t, i) => assert.equal(K.cohKey(t), K.SPDR_TO_SECTOR[lists.SPDR[i]], fam + " slot " + (i + 1) + ": " + t + " = " + lists.SPDR[i]));
  }
  assert.equal(Object.keys(K.FAMILY_TO_SECTOR).length, 33);
  assert.equal(K.cohKey("XLP"), "STAPLES", "the SPDRs as before"); assert.equal(K.cohKey("STAPLES"), "STAPLES", "a real key as before");
  assert.equal(K.cohKey("SPY"), "SPY", "a broad fund keeps its own key");
});

test("the broad funds: the holdings file becomes one set per fund; BRK.B is BRK-B; EQAL borrows IWV; bad rows are skipped", () => {
  const F = fundApi();
  const sets = F.buildFundSets({ data: { SPY: { h: [["AAPL", 7], ["BRK.B", 1.6], [null, 1], ["", 0]] }, IWV: { h: [["AAPL", 6], ["PCVX", 0.01]] }, BAD: { h: "x" } } });
  assert.deepEqual([...sets.SPY].sort(), ["AAPL", "BRK-B"]);
  assert.deepEqual([...sets.EQAL].sort(), ["AAPL", "PCVX"], "EQAL's own list is not on file: the Russell 3000 stands in");
  assert.equal(sets.BAD, undefined);
  assert.deepEqual(F.buildFundSets(null), {}); assert.deepEqual(F.buildFundSets({}), {});
});

test("the board's scope rule: a broad fund shows our names it holds; a family fund its sector; nothing else changes", () => {
  const COHSETS = { STAPLES: new Set(["KO", "PG"]), MEGACAP: new Set(["AAPL"]) };
  const FUNDSETS = { SPY: new Set(["AAPL", "KO", "ZTS"]) };
  const has = scopeApi(COHSETS, FUNDSETS);
  assert.equal(has("SPY", "AAPL"), true); assert.equal(has("SPY", "KO"), true); assert.equal(has("SPY", "MSFT"), false);
  assert.equal(has("IYK", "KO"), true, "iShares staples = our staples"); assert.equal(has("VDC", "PG"), true); assert.equal(has("RSPS", "AAPL"), false);
  assert.equal(has("MEGACAP", "AAPL"), true, "a cohort tab as before"); assert.equal(has("ALL", "ANY"), true);
  assert.equal(has("QQQ", "AAPL", "QQQ"), true, "a fund with no holdings set falls back to the home cohort, as before");
  const before = scopeApi(COHSETS, null);
  assert.equal(before("SPY", "AAPL"), false, "no holdings read yet: the column stays as it was");
  assert.match(fn("boardScopeHas"), /if \(typeof FUNDSETS !== "undefined" && FUNDSETS && FUNDSETS\[k\]\) return FUNDSETS\[k\]\.has\(t\);/);
});

test("the light rows: off the Hub only, a daily reading only, biggest weight first, capped, counted", () => {
  const F = fundApi();
  const hold = { data: { IYK: { h: [["KO", 13.5], ["COR", 2.1], ["EL", 1.9], ["AGPXX", 0.4], ["LIN.DE", 0.3], ["HSY", 2.5], ["PG", 13.4]] }, IWV: { h: [["PCVX", 0.1]] } } };
  const scout = { row_columns: ["ticker", "composite", "trend", "momentum", "rungs_used", "kind", "last_session"],
    rows: [["KO", 0.5, 0.4, 0.1, 7, "CS", "2026-11-17"], ["COR", 0.31, 0.2, -0.1, 7, "CS", "2026-11-17"], ["EL", -0.42, -0.3, 0.05, 7, "CS", "2026-11-17"],
      ["HSY", 0.12, null, null, 7, "CS", "2026-11-17"], ["PCVX", 0.2, 0.1, 0.1, 7, "CS", "2026-11-17"]] };
  const onHub = new Set(["KO", "PG"]);
  const L = F.fundLiteRows("IYK", hold, scout, onHub, 25);
  assert.deepEqual(L.rows.map((r) => r.t), ["HSY", "COR", "EL"], "by weight; KO and PG are on the Hub; cash and a foreign line have no reading");
  assert.equal(L.off, 3); assert.equal(L.total, 7); assert.equal(L.alias, null);
  assert.deepEqual(L.rows[1], { t: "COR", w: 2.1, g: 0.31, tr: 0.2, mo: -0.1, s: "2026-11-17" });
  assert.equal(L.rows[0].tr, null, "no trend reading stays null, never 0");
  assert.equal(F.fundLiteRows("IYK", hold, scout, onHub, 2).rows.length, 2, "capped");
  assert.equal(F.fundLiteRows("IYK", hold, scout, onHub, 2).off, 3, "the count says how many there are");
  assert.equal(F.fundLiteRows("EQAL", hold, scout, onHub, 25).alias, "IWV");
  assert.equal(F.fundLiteRows("NOPE", hold, scout, onHub, 25), null);
  assert.equal(F.fundLiteRows("IYK", hold, null, onHub, 25), null, "no daily read yet: nothing");
  assert.equal(L.session, "2026-11-17", "the header names the newest session of the read");
  const stale = { row_columns: scout.row_columns, rows: [...scout.rows, ["ANTM", 0.3, 0.2, 0.1, 7, "CS", "2026-06-27"]] };
  const S2 = F.fundLiteRows("IYK", { data: { IYK: { h: [["ANTM", 3], ["COR", 2.1]] } } }, stale, onHub, 25);
  assert.deepEqual(S2.rows.map((r) => r.t), ["COR"], "a reading a week older than the newest session is a name that stopped trading: left out");
});

test("wiring: the universe never grows, the membership read is unchanged, the light list sits after the board's rows", () => {
  assert.match(page, /const memberTickers = \(members \|\| \[\]\)\.map\(\(m\) => m\.ticker\)\.filter\(Boolean\);\n  const universe = \[\.\.\.new Set\(\[\.\.\.declaredSet, \.\.\.memberTickers\]\)\];/, "the board's universe = declared set + membership, as before");
  assert.ok(!/COHSETS\[[^\]]+\] = /.test(fn("fundSetsLoad") + fn("buildFundSets")), "the holdings never write into COHSETS");
  const load = fn("loadCohSets");
  assert.match(load, /pgAll\("ticker_cohorts\?select=ticker,cohort&order=ticker\.asc,cohort\.asc"\)/, "the membership read is unchanged");
  assert.match(load, /const fundsRead = typeof fundSetsLoad === "function" \? fundSetsLoad\(\) : Promise\.resolve\(null\);/); assert.match(load, /return fundsRead\.then\(\(\) => COHSETS\);/);
  assert.match(fn("boardRowsHTML"), /\}\)\.join\(""\) \+ \(typeof fundLiteHTML === "function" \? fundLiteHTML\(S\.coh\) : ""\);\n\}/, "after the rows, never among them");
  const lite = fn("fundLiteHTML");
  assert.match(lite, /if \(!onHub \|\| !onHub\.size\) return empty;/, "never painted without the Hub's own set");
  assert.match(lite, /Date\.now\(\) - FUND_HOLD_FAIL_AT > 60000/, "a failed read waits a minute");
  assert.match(lite, /geigerMiniHTML\(r\.g, 1, true\)/, "the board's own Geiger bar, on the fixed −1 … +1");
  assert.ok(!/sc-board__row/.test(lite), "not a board row: no row code ever counts or sorts it");
  assert.match(page, /\.sc-lite:empty\{ display:none; \}/);
});

test("the names file is deployed with the page and has the shape the page reads", () => {
  const j = JSON.parse(fs.readFileSync(new URL("../deliverables/20261118/fund-lite/names.json", import.meta.url), "utf8"));
  assert.ok(j.names && typeof j.names === "object");
  assert.ok(Object.keys(j.names).length > 3000);
  assert.ok(Array.isArray(j.names.COR) && typeof j.names.COR[0] === "string" && j.names.COR[0].length > 0);
  assert.match(page, /const FUND_NAMES_URL = "\/deliverables\/20261118\/fund-lite\/names\.json";/);
});
