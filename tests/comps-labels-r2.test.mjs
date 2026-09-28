/* The clean comps row (deliverables/20260928/comps-labels-r2): numbers only on the chart, one per
   horizontal limit, never on each other, never off the chart; the dollar values in their own column. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowMarks, rowScale, spread, rowValues, basisLine } from "../deliverables/20260928/comps-labels-r2/labels-r2.mjs";

const SNAP = JSON.parse(readFileSync(new URL("../deliverables/20260928/comps-labels-r2/snapshot-2026-09-28.json", import.meta.url), "utf8"));
const PAGE = readFileSync(new URL("../deliverables/20260928/comps-labels-r2/COMPS-LABELS-R2.html", import.meta.url), "utf8");
const pe = SNAP.rows.find((r) => r.key === "pe_ttm");

test("the chart carries six numbers and nothing else: two line ends, two box edges, the median, the company", () => {
  const m = rowMarks(pe);
  assert.deepEqual(m.map((x) => x.id).sort(), ["max", "median", "min", "own", "q1", "q3"]);
  assert.deepEqual(m.filter((x) => x.lane === "below").map((x) => x.id).sort(), ["q1", "q3"]);
  assert.equal(m.find((x) => x.id === "own").weight, "bold");
});

test("the axis runs from the lowest thing drawn to the highest, so no end is ever off the chart", () => {
  const s = rowScale(pe, { width: 1000 });
  assert.ok(s.x(pe.band.min) >= 0 && s.x(pe.band.max) <= 1000);
  const cheap = { ...pe, own: { multiple: 0.5, price: 1 } };      // the company below every peer: the axis stretches to it
  const s2 = rowScale(cheap, { width: 1000 });
  assert.ok(s2.x(0.5) >= 0 && s2.x(pe.band.min) > s2.x(0.5));
});

test("numbers in one lane never sit on each other and never leave the chart, at 1000 and at 340 wide", () => {
  for (const width of [1000, 340]) {
    const s = rowScale(pe, { width });
    const items = rowMarks(pe).filter((m) => m.lane === "above").map((m) => ({ id: m.id, x: s.x(m.x), w: 34, anchor: m.anchor }));
    const res = spread(items, { width, gap: 6 });
    const byLeft = [...res].sort((a, b) => a.left - b.left);
    for (let k = 1; k < byLeft.length; k++) assert.ok(byLeft[k].left >= byLeft[k - 1].right + 6 - 1e-9, `${byLeft[k].id} sits on ${byLeft[k - 1].id} at ${width}`);
    for (const r of res) { assert.ok(r.left >= 0 && r.right <= width + 1e-9, `${r.id} leaves the chart at ${width}`); assert.ok(r.ok); }
  }
});

test("a number that had to move says how far, and one at the edge is pulled inside", () => {
  const [a, b] = spread([{ id: "a", x: 100, w: 40, anchor: "middle" }, { id: "b", x: 104, w: 40, anchor: "middle" }], { width: 800 });
  assert.ok(a.right + 6 <= b.left + 1e-9);
  assert.ok(a.shift > 0 || b.shift > 0);
  const [e] = spread([{ id: "e", x: 795, w: 40, anchor: "middle" }], { width: 800 });
  assert.equal(e.right, 800);
});

test("the right column stacks low, 25th, median, 75th, high, then today's price, in that order", () => {
  const v = rowValues(pe, "MU");
  assert.deepEqual(v.map((x) => x.word), ["Low", "25th", "Median", "75th", "High", "MU today"]);
  assert.ok(v[0].price < v[1].price && v[1].price < v[2].price && v[2].price < v[3].price && v[3].price < v[4].price);
  assert.equal(v[5].price, SNAP.price);
});

test("the basis line names the figure once; the page repeats no EPS text and names no ticker at the chart's edges", () => {
  assert.match(basisLine(pe, (v) => "$" + v, (v) => "$" + v.toFixed(2)), /^price = multiple × EPS \$44\.18$/);
  assert.equal((PAGE.match(/EPS \$44\.18/g) || []).length <= 1, true, "the page's static text says the EPS at most once (the chart adds it once per row)");
  assert.ok(!/class="pn"|class="dot"|placeStrip/.test(PAGE), "no peer-name strip and no dots on the chart");
  assert.ok(PAGE.includes("snapshot-2026-09-28.json"));
});

test("every valuation row in the snapshot draws: four rows, each with two ends, a median and a price for the company", () => {
  assert.deepEqual(SNAP.rows.map((r) => r.key), ["pe_ttm", "ev_ebitda", "ps", "pe_fwd"]);
  for (const r of SNAP.rows) {
    assert.ok(r.ok, r.key + " is not drawable: " + r.reason);
    assert.ok(r.ends.min.price != null && r.ends.max.price != null && r.ends.median.price != null);
    assert.ok(r.own.multiple > 0 && r.own.price > 0);
  }
});
