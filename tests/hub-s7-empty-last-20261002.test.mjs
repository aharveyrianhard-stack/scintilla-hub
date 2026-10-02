// S7 (2 Oct) — EMPTY VALUES SORT LAST, ON EVERY SORTABLE COLUMN, IN BOTH DIRECTIONS. BRIEF-20261002-S7 item 3.
// F1 did it for RVOL (1 Oct). Alan asked what "empty last" means; the coordinator's call: when a column is sorted, rows with no
// value in it (a dash) go to the bottom whether it is sorted highest first or lowest first — on the board (normal, full screen
// and the phone draw the same frozen order, S.boardOrder) and on the company rail (which sorts one way, highest first).
// The page's own functions are run here (extracted from index.html), never re-typed copies.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => page.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
const num = (v) => (v == null ? null : Number.isFinite(+v) ? +v : null);
const BOARD_COLS = new Function("return " + page.match(/const BOARD_COLS = (\[[^\n]*\]);/)[1])();
const order = (key, dir, rows, win) => new Function("S", "window", "num", fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
  { sort: { key, dir }, rows }, Object.assign({ SC_RANK_READY: true }, win || {}), num);

const SORTABLE = BOARD_COLS.map((c) => c[1]).filter(Boolean);
test("the sortable columns are the ones this suite covers", () => {
  assert.deepEqual(SORTABLE, ["t", "price", "c", "fpe", "mc", "rev", "rsi", "tr", "mo", "g", "rv"]);
});

/* a fixture per column: three names with values (one negative where the column can be), and dashes in different forms —
   null, missing, NaN, an empty string — plus, for MKT CAP and REVENUE, a zero (their cells print a value only above zero) */
const VALUED = { A: 3, B: -1.5, C: 12 };
const EMPTY = { D: null, E: undefined, F: NaN, G: "" };
function fixture(key) {
  const rows = [];
  const put = (t, v) => { const r = { t }; if (v !== undefined) r[key] = v; rows.push(r); };
  /* arrival order mixes the empty rows in among the valued ones */
  put("D", EMPTY.D); put("A", VALUED.A); put("E", EMPTY.E); put("B", key === "mc" || key === "rev" ? 0 : VALUED.B);
  put("F", EMPTY.F); put("C", VALUED.C); put("G", EMPTY.G);
  return rows;
}
for (const key of SORTABLE.filter((k) => k !== "t" && k !== "tr" && k !== "mo")) {
  test("column " + key + ": dashes last when sorted highest first AND lowest first", () => {
    const rows = fixture(key);
    const zeroIsEmpty = key === "mc" || key === "rev";
    /* arrival D A E B F C G; the empty rows, in arrival order: D E F G (and B, whose zero prints no MKT CAP / REVENUE) */
    const empties = zeroIsEmpty ? ["D", "E", "B", "F", "G"] : ["D", "E", "F", "G"];
    const desc = order(key, -1, rows), asc = order(key, 1, rows);
    assert.deepEqual(desc, (zeroIsEmpty ? ["C", "A"] : ["C", "A", "B"]).concat(empties), key + " highest first");
    assert.deepEqual(asc, (zeroIsEmpty ? ["A", "C"] : ["B", "A", "C"]).concat(empties), key + " lowest first");
    /* the empty rows keep their arrival order among themselves, in both directions */
    assert.deepEqual(desc.slice(-empties.length), asc.slice(-empties.length));
  });
}
test("TREND and MOMENTUM (values the board is showing, not on the row): dashes last both ways", () => {
  const rows = ["D", "A", "E", "B", "C"].map((t) => ({ t }));
  const live = { A: { tr: 0.3, mo: 0.3 }, B: { tr: -0.6, mo: -0.6 }, C: { tr: 0.9, mo: 0.9 }, E: { tr: null, mo: null } };
  for (const key of ["tr", "mo"]) {
    assert.deepEqual(order(key, -1, rows, { SCIN_TM: live }), ["C", "A", "B", "D", "E"], key);
    assert.deepEqual(order(key, 1, rows, { SCIN_TM: live }), ["B", "A", "C", "D", "E"], key);
  }
});
test("ticker sorts A→Z and Z→A as before (every row has one)", () => {
  const rows = [{ t: "MU" }, { t: "AMD" }, { t: "NVDA" }];
  assert.deepEqual(order("t", 1, rows), ["AMD", "MU", "NVDA"]);
  assert.deepEqual(order("t", -1, rows), ["NVDA", "MU", "AMD"]);
});
test("a board with no value at all in the column keeps its order; nothing is ranked before the first full snapshot", () => {
  const rows = [{ t: "X" }, { t: "Y", g: null }, { t: "Z" }];
  assert.deepEqual(order("g", -1, rows), ["X", "Y", "Z"]); assert.deepEqual(order("g", 1, rows), ["X", "Y", "Z"]);
  const before = new Function("S", "window", "num", fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
    { sort: { key: "g", dir: 1 }, rows: [{ t: "P", g: null }, { t: "Q", g: 1 }] }, { SC_RANK_READY: false }, num);
  assert.deepEqual(before, ["P", "Q"]);
});
test("full screen and the phone draw the same frozen order: one computeBoardOrder, no second sorter", () => {
  assert.equal((page.match(/function computeBoardOrder\(/g) || []).length, 1);
  assert.equal((page.match(/data-act="sort"/g) || []).length, 1, "one header builder (boardHeaderHTML) for every board width");
});
test("the company rail: DAY % and GEIGER put a name with no value last (it sorts highest first only)", () => {
  const cvRailOrder = new Function("num", fn("cvRailOrder") + "return cvRailOrder;")(num);
  const rows = [{ t: "D", c: null, g: null }, { t: "A", c: 1.2, g: 0.4 }, { t: "E", g: -0.2 }, { t: "B", c: -3.1, g: null }, { t: "C", c: 4.8, g: 0.9 }];
  assert.deepEqual(cvRailOrder(rows, "CHG").map((r) => r.t), ["C", "A", "B", "D", "E"]);
  assert.deepEqual(cvRailOrder(rows, "GEIGER").map((r) => r.t), ["C", "A", "E", "D", "B"]);
});
