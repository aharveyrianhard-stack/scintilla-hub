// F1 (1 Oct) — the board's RVOL column sorts by PACE (board_volume.rvol_at_time). BRIEF-20261001-F1-FOLLOWUPS item 1.
// H5 returned it with "RVOL is still not sortable"; Alan on relative volume: "I've been begging for it".
// The page's own functions are run here (extracted from index.html), never re-typed copies.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => page.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
const num = (v) => (v == null ? null : Number.isFinite(+v) ? +v : null);
const BOARD_COLS = new Function("return " + page.match(/const BOARD_COLS = (\[[^\n]*\]);/)[1])();
const RVOL_MAX_AGE_MS = new Function(page.match(/^const RVOL_MAX_AGE_MS = [^\n]*/m)[0] + "; return RVOL_MAX_AGE_MS;")();
const scRvolCurrent = new Function("RVOL_MAX_AGE_MS", fn("scRvolCurrent") + "; return scRvolCurrent;")(RVOL_MAX_AGE_MS);
/* the board row's own rv field (the number beside the battery), run against board_volume rows */
const rvSrc = page.match(/        rv:\s+\(function \(\) \{[\s\S]*?\}\)\(\),\n/)[0].trim().replace(/^rv:\s*/, "").replace(/,$/, "");
const rvOf = (BOARDVOL, t) => new Function("BOARDVOL", "m", "num", "scRvolCurrent", "return " + rvSrc)(BOARDVOL, { ticker: t }, num, scRvolCurrent);

/* the fixture: four names with a current reading, one stale (6 Jul, the newest row on 1 Oct), one with no row at all */
const now = new Date().toISOString();
const BOARDVOL = {
  AAA: { rvol_at_time: 1.4, session_rvol: 0.6, updated_ts: now },
  BBB: { rvol_at_time: 3.2, session_rvol: 1.9, updated_ts: now },
  CCC: { rvol_at_time: 0.7, session_rvol: 0.3, updated_ts: now },
  DDD: { rvol_at_time: 12.3, session_rvol: 4.0, updated_ts: now },
  OLD: { rvol_at_time: 9.9, session_rvol: 9.9, updated_ts: "2026-07-06T18:03:29Z" },
};
const ROWS = ["OLD", "AAA", "NONE", "BBB", "CCC", "DDD"].map((t) => ({ t, rv: rvOf(BOARDVOL, t) }));
const order = (key, dir, rows = ROWS) => new Function("S", "window", "num", fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
  { sort: { key, dir }, rows }, { SC_RANK_READY: true }, num);

test("the RVol header carries the sort key rv; every other column keeps its key", () => {
  assert.deepEqual(BOARD_COLS[12], ["RVol", "rv"]);
  assert.deepEqual(BOARD_COLS.map((c) => c[1]), [null, "t", "price", "c", "fpe", "mc", "rev", "rsi", "tr", "mo", null, "g", "rv", null]);
});

test("rv is the pace (rvol_at_time) for a current row, null for a stale or missing one", () => {
  assert.deepEqual(ROWS.map((r) => r.rv), [null, 1.4, null, 3.2, 0.7, 12.3]);
});

test("first click: highest pace first; second click: lowest first; rows with no current reading last BOTH ways", () => {
  assert.deepEqual(order("rv", -1), ["DDD", "BBB", "AAA", "CCC", "OLD", "NONE"], "descending by rvol_at_time");
  assert.deepEqual(order("rv", 1), ["CCC", "AAA", "BBB", "DDD", "OLD", "NONE"], "ascending, the stale and missing rows still at the bottom");
  /* the empty rows keep their arrival order among themselves (stable), and a board with no reading at all keeps its order */
  const empty = [{ t: "X", rv: null }, { t: "Y", rv: null }, { t: "Z", rv: null }];
  assert.deepEqual(order("rv", -1, empty), ["X", "Y", "Z"]);
  assert.deepEqual(order("rv", 1, empty), ["X", "Y", "Z"]);
});

test("the stale 6 Jul row is NOT ranked by its old 9.9×: it sorts with the empty rows", () => {
  const desc = order("rv", -1);
  assert.ok(desc.indexOf("OLD") > desc.indexOf("CCC"), "a 9.9× from July never leads today's board");
});

/* S7 (2 Oct): the coordinator extended F1's rule to every column - empty last in both directions (was: absent lowest, so first
   when ascending). The per-column proof is tests/hub-s7-empty-last-20261002.test.mjs. */
test("the other columns now follow the same rule: empty last both ways (S7)", () => {
  const rows = [{ t: "A", g: 0.2 }, { t: "B", g: null }, { t: "C", g: 0.9 }];
  assert.deepEqual(order("g", -1, rows), ["C", "A", "B"]);
  assert.deepEqual(order("g", 1, rows), ["A", "C", "B"]);
});

test("the mark moves: click RVol → ▼ on RVol and off Geiger; click again → ▲; another column takes it back", () => {
  const S = { sort: { key: "g", dir: -1 }, rows: ROWS };
  const api = new Function("S", "BOARD_COLS", "window", "num", "updateBoard",
    fn("boardHeaderHTML") + fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + fn("sortBoardBy") + "\nreturn { boardHeaderHTML, sortBoardBy };")(
    S, BOARD_COLS, { SC_RANK_READY: true }, num, () => {});
  const cell = (html, label) => (html.match(new RegExp('<button class="sc-hcell ?(is-sorted)?" data-act="sort" data-key="[a-z]+">' + label + '( [▼▲])?</button>')) || []);
  let h = api.boardHeaderHTML();
  assert.equal(cell(h, "Geiger")[2], " ▼", "Geiger is the default sort");
  assert.match(h, /<button class="sc-hcell " data-act="sort" data-key="rv">RVol<\/button>/, "a real <button>: Tab reaches it, Enter and Space press it, like the other headers");

  api.sortBoardBy("rv");
  h = api.boardHeaderHTML();
  assert.deepEqual(S.sort, { key: "rv", dir: -1 });
  assert.match(h, /<button class="sc-hcell is-sorted" data-act="sort" data-key="rv">RVol ▼<\/button>/);
  assert.match(h, /<button class="sc-hcell " data-act="sort" data-key="g">Geiger<\/button>/, "the mark left Geiger");
  assert.equal((h.match(/[▼▲]/g) || []).length, 1, "one mark on the header");
  assert.deepEqual(S.boardOrder, ["DDD", "BBB", "AAA", "CCC", "OLD", "NONE"]);

  api.sortBoardBy("rv");
  h = api.boardHeaderHTML();
  assert.match(h, /data-key="rv">RVol ▲<\/button>/);
  assert.deepEqual(S.boardOrder, ["CCC", "AAA", "BBB", "DDD", "OLD", "NONE"]);

  api.sortBoardBy("g");
  assert.match(api.boardHeaderHTML(), /data-key="g">Geiger ▼<\/button>/);
  assert.doesNotMatch(api.boardHeaderHTML(), /RVol [▼▲]/);
});

test("the normal board and full screen draw the same header (one function), and the battery cell is untouched", () => {
  /* full screen (secfs) moves the same #boardPanel into the fixed frame: there is no second header to wire */
  assert.equal((page.match(/function boardHeaderHTML\(/g) || []).length, 1);
  assert.match(page, /case "sort": \{\s*sortBoardBy\(a\.dataset\.key\);/);
  assert.match(fn("volCellHTML"), /^function volCellHTML\(at, sess, asOf\) \{/);
  assert.match(page, /volCellHTML\(d\.rv, d\.rvS, d\.rvAsOf\)/, "the cell is still drawn from the same three fields");
});
