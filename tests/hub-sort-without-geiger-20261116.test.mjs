/* 16 Nov 2026 (coordinator; Alan: "the rankings of all the columns are not doing shit ... not market cap, not anything").
   Only the Geiger's own columns (GEIGER, TREND, MOMENTUM) wait for a complete, validated Geiger. Every other column ranks
   as soon as the board's snapshot itself has landed (the whole declared set with the price and Geiger overlays applied),
   so a stale Geiger timeframe can no longer freeze MKT CAP, LAST, CHG, F P/E, REVENUE, RSI or RVOL. Nothing ranks before
   the snapshot, exactly as before. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); assert.ok(s >= 0, name); return page.slice(s, page.indexOf("\n}\n", s) + 3); };
const num = (x) => (x == null ? null : Number(x));
const order = (key, dir, rows, win) => new Function("S", "window", "num",
  fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
  { sort: { key, dir }, rows }, win, num);

const rows = [
  { t: "AAA", mc: 2e9, price: 50, c: 1.5, fpe: 30, rev: 4e8, rsi: 61, rv: 0.9, g: 0.2 },
  { t: "BBB", mc: 9e11, price: 400, c: -2.1, fpe: 22, rev: 9e10, rsi: 38, rv: 2.4, g: -0.4 },
  { t: "CCC", mc: 5e10, price: 12, c: 0.3, fpe: 15, rev: 2e9, rsi: 45, rv: 1.3, g: 0.7 }
];
const arrival = ["AAA", "BBB", "CCC"];
const geigerIncomplete = { SC_RANK_READY: false, SC_RANK_BASE_READY: true,
  SCIN_TM: { AAA: { tr: 0.1, mo: 0.9 }, BBB: { tr: 0.8, mo: -0.2 }, CCC: { tr: -0.5, mo: 0.4 } } };

test("before the snapshot lands nothing ranks, not even market cap (cached numbers are never ranked)", () => {
  for (const key of ["mc", "price", "c", "fpe", "rev", "rsi", "rv", "g", "tr", "mo"])
    assert.deepEqual(order(key, -1, rows, { SC_RANK_READY: false, SC_RANK_BASE_READY: false }), arrival, key);
  assert.deepEqual(order("mc", -1, rows, {}), arrival, "flags never set: still arrival order");
});

test("snapshot landed, Geiger incomplete: every non-Geiger column ranks (the 16 Nov board)", () => {
  assert.deepEqual(order("mc", -1, rows, geigerIncomplete), ["BBB", "CCC", "AAA"], "MKT CAP highest first");
  assert.deepEqual(order("mc", 1, rows, geigerIncomplete), ["AAA", "CCC", "BBB"], "MKT CAP lowest first");
  assert.deepEqual(order("price", -1, rows, geigerIncomplete), ["BBB", "AAA", "CCC"], "LAST");
  assert.deepEqual(order("c", -1, rows, geigerIncomplete), ["AAA", "CCC", "BBB"], "CHG");
  assert.deepEqual(order("fpe", 1, rows, geigerIncomplete), ["CCC", "BBB", "AAA"], "F P/E");
  assert.deepEqual(order("rev", -1, rows, geigerIncomplete), ["BBB", "CCC", "AAA"], "REVENUE");
  assert.deepEqual(order("rsi", -1, rows, geigerIncomplete), ["AAA", "CCC", "BBB"], "RSI");
  assert.deepEqual(order("rv", -1, rows, geigerIncomplete), ["BBB", "CCC", "AAA"], "RVOL");
  assert.deepEqual(order("t", -1, rows, geigerIncomplete), ["CCC", "BBB", "AAA"], "TICKER always sorts");
});

test("snapshot landed, Geiger incomplete: GEIGER, TREND and MOMENTUM keep their order", () => {
  for (const key of ["g", "tr", "mo"]) for (const dir of [1, -1])
    assert.deepEqual(order(key, dir, rows, geigerIncomplete), arrival, key + " " + dir);
});

test("a complete Geiger ranks its own columns, as before", () => {
  const full = Object.assign({}, geigerIncomplete, { SC_RANK_READY: true });
  assert.deepEqual(order("g", -1, rows, full), ["CCC", "AAA", "BBB"]);
  assert.deepEqual(order("tr", -1, rows, full), ["BBB", "AAA", "CCC"]);
  assert.deepEqual(order("mo", -1, rows, full), ["AAA", "CCC", "BBB"]);
  assert.deepEqual(order("mc", -1, rows, full), ["BBB", "CCC", "AAA"]);
});

test("the board build sets the snapshot flag from the declared set and both overlays, and the full gate requires it", () => {
  assert.match(page, /window\.SC_RANK_BASE_READY = declaredSet\.size === SC_EXPECTED_EQUITY_COUNT &&\n    \(num\(qOverlay\.applied\) \|\| 0\) \+ \(num\(qOverlay\.blanked\) \|\| 0\) === declaredSet\.size &&\n    \(num\(gOverlay\.applied\) \|\| 0\) \+ \(num\(gOverlay\.blanked\) \|\| 0\) === declaredSet\.size;/);
  assert.match(page, /window\.SC_RANK_READY = declaredSet\.size === SC_EXPECTED_EQUITY_COUNT && window\.SC_RANK_BASE_READY === true &&\n    !!\(SC_CG\.meta && SC_CG\.meta\.current_equalizer_validated === true &&/);
  assert.match(page, /\nwindow\.SC_RANK_READY = false;\nwindow\.SC_RANK_BASE_READY = false;\n/, "both start false");
  assert.equal((page.match(/function computeBoardOrder\(/g) || []).length, 1, "still the one choke point");
});
