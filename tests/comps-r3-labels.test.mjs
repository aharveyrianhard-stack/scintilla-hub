/* Comps labels, round 3 (deliverables/20260928/comps-r3-labels): every mark named, the upside stated, and
   the combined football field across metrics — three ways, on the MU / GEV / NVDA snapshots of 28 Sep. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { rowMarks, rowScale, rowUpside, upsideTo, upsideWords, rangeOfMedians, middleHalfBand, weightedBlend, combined, combinedScale, stagger, DEFAULT_WEIGHTS, MARK_WORDS, median } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";

const snap = (t) => JSON.parse(readFileSync(new URL(`../deliverables/20260928/comps-r3-labels/snapshot-${t}-2026-09-28.json`, import.meta.url), "utf8"));
const MU = snap("MU"), GEV = snap("GEV"), NVDA = snap("NVDA");
const PAGE = readFileSync(new URL("../deliverables/20260928/comps-r3-labels/COMPS-R3-LABELS.html", import.meta.url), "utf8");
const pe = MU.rows.find((r) => r.key === "pe_ttm");
const P = (v) => "$" + Math.round(v).toLocaleString("en-US");

test("every mark carries its name: LOWEST PEER · 25TH · MEDIAN · 75TH · HIGHEST PEER · MU TODAY, in axis order", () => {
  const m = rowMarks(pe, "MU");
  assert.deepEqual(m.map((x) => x.word), ["LOWEST PEER", "MU TODAY", "25TH", "MEDIAN", "75TH", "HIGHEST PEER"]);   // MU at 23.9x sits between the lowest peer and the 25th
  for (let k = 1; k < m.length; k++) assert.ok(m[k].multiple >= m[k - 1].multiple);
  assert.ok(m.every((x) => x.price != null), "every mark carries the price it implies");
  assert.equal(m.find((x) => x.own).price, pe.own.price);
  assert.deepEqual(Object.values(MARK_WORDS), ["LOWEST PEER", "25TH", "MEDIAN", "75TH", "HIGHEST PEER"]);
});

test("a row whose own multiple is missing carries no own mark (GEV's PEG)", () => {
  const peg = GEV.rows.find((r) => r.key === "peg");
  assert.equal(peg.ok, false);
  assert.ok(!rowMarks(peg, "GEV").some((x) => x.own));
});

test("the upside is stated in dollars and percent, to the 25th, the median and the 75th", () => {
  const u = rowUpside(pe);
  assert.ok(Math.abs(u.median.pct - pe.upside) < 1e-6, "the median upside is the snapshot's (the live page's) upside");
  assert.ok(Math.abs(u.median.dollars - (pe.ends.median.price - pe.own.price)) < 1e-9);
  assert.ok(u.q1.pct < u.median.pct && u.median.pct < u.q3.pct);
  const w = upsideWords(u.median, P);
  assert.match(w.line, /^\+\d+% to the median · \+\$[\d,]+$/);
  assert.equal(w.up, true);
  const down = upsideWords(upsideTo(100, 90), P);
  assert.equal(down.pct, "−10.0%"); assert.equal(down.dollars, "−$10"); assert.equal(down.up, false);
  assert.equal(upsideTo(0, 5), null); assert.equal(upsideTo(100, null), null);
});

test("the axis holds every mark, including the company below every peer", () => {
  const s = rowScale(pe, { width: 1000 });
  assert.ok(s.x(pe.band.min) >= 0 && s.x(pe.band.max) <= 1000);
  const cheap = { ...pe, own: { multiple: 0.5, price: 1 } };
  assert.ok(rowScale(cheap, { width: 1000 }).x(0.5) >= 0);
});

test("way A — the range of the medians runs from the lowest median price to the highest, centred on their median", () => {
  const A = rangeOfMedians(MU.rows);
  const meds = MU.rows.filter((r) => r.ok).map((r) => r.ends.median.price);
  assert.equal(A.lo, Math.min(...meds)); assert.equal(A.hi, Math.max(...meds)); assert.equal(A.mid, median(meds));
  assert.equal(A.points.length, 6, "all six rows are in — nothing dropped");
  assert.equal(A.points[A.points.length - 1].key, "pe_fwd", "MU's forward P/E sets the top of the range");
});

test("way B — the middle-half band is the median of the 25ths to the median of the 75ths; the strict overlap is empty when the rows disagree", () => {
  const B = middleHalfBand(MU.rows);
  const q1s = MU.rows.filter((r) => r.ok).map((r) => r.ends.q1.price), q3s = MU.rows.filter((r) => r.ok).map((r) => r.ends.q3.price);
  assert.equal(B.lo, median(q1s)); assert.equal(B.hi, median(q3s));
  assert.ok(B.lo < B.mid && B.mid < B.hi);
  assert.equal(B.overlap, null, "MU: forward P/E's 25th sits above other rows' 75th, so no price satisfies every row");
  assert.equal(B.envelope.lo, Math.min(...q1s)); assert.equal(B.envelope.hi, Math.max(...q3s));
  const Bg = middleHalfBand(GEV.rows);
  assert.ok(Bg.overlap && Bg.overlap.lo <= Bg.overlap.hi, "GEV: the five priced rows do share a slice");
  assert.equal(Bg.points.length, 5, "GEV's PEG cannot be priced and is left out");
});

test("way C — the weighted blend states its weights, re-weights when a row drops, and adds to one", () => {
  assert.ok(Math.abs(Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0) - 1) < 1e-9);
  const C = weightedBlend(MU.rows);
  assert.ok(Math.abs(C.points.reduce((s, p) => s + p.weight, 0) - 1) < 1e-9);
  const byHand = C.points.reduce((s, p) => s + p.weight * p.mid, 0);
  assert.ok(Math.abs(C.mid - byHand) < 1e-9);
  const Cg = weightedBlend(GEV.rows);
  assert.ok(Cg.left_out.some((o) => o.key === "peg"));
  assert.ok(Math.abs(Cg.points.reduce((s, p) => s + p.weight, 0) - 1) < 1e-9, "the rest add to one again");
  const only = weightedBlend(MU.rows, { pe_ttm: 1 });
  assert.equal(only.mid, pe.ends.median.price, "one weight of 1 reproduces that row's median");
});

test("every way carries the upside from today's price to its edges and centre, on MU, GEV and NVDA", () => {
  for (const S of [MU, GEV, NVDA]) {
    const ways = combined(S.rows, S.price);
    assert.deepEqual(ways.map((w) => w.way), ["A", "B", "C"]);
    for (const w of ways) {
      assert.ok(w.ok, `${S.ticker} ${w.way}`);
      assert.ok(w.lo <= w.mid && w.mid <= w.hi, `${S.ticker} ${w.way}: lo ≤ mid ≤ hi`);
      assert.ok(Math.abs(w.upside.mid.pct - (w.mid / S.price - 1) * 100) < 1e-9);
    }
    const s = combinedScale(ways, S.price, { width: 800 });
    assert.ok(s.x(S.price) >= 0 && s.x(S.price) <= 800);
    for (const w of ways) assert.ok(s.x(w.lo) >= 0 && s.x(w.hi) <= 800, `${S.ticker} ${w.way} on the axis`);
  }
});

test("a lane that will not fit on one line at phone width deals its labels onto two tiers, and none overlap", () => {
  const items = [10, 60, 120, 200, 300, 356].map((x, i) => ({ id: String(i), x, w: 70, anchor: i === 0 ? "start" : i === 5 ? "end" : "middle" }));
  const two = stagger(items, { width: 366, gap: 8 });
  assert.deepEqual([...new Set(two.map((r) => r.tier))].sort(), [0, 1]);
  for (const tier of [0, 1]) {
    const L = two.filter((r) => r.tier === tier).sort((a, b) => a.left - b.left);
    for (let k = 1; k < L.length; k++) assert.ok(L[k].left >= L[k - 1].right + 8 - 1e-9, `tier ${tier}: ${L[k].id} sits on ${L[k - 1].id}`);
    for (const r of L) assert.ok(r.left >= 0 && r.right <= 366 + 1e-9);
  }
  const one = stagger(items.map((it) => ({ ...it, x: it.x * 3 })), { width: 1200, gap: 8 });
  assert.ok(one.every((r) => r.tier === 0), "wide enough: one tier");
});

test("the page carries a legend entry for every symbol: the line, the box, the median, the dashed line, the arrow, the tie, the small caps", () => {
  for (const words of ["from the lowest to the highest", "middle half of the peers", "the peer median", "the diamond on the dashed line", "the arrow runs from", "moved aside", "SMALL CAPS", "top row", "bottom row"]) assert.ok(PAGE.includes(words), words);
  assert.ok(PAGE.includes("EV/sales") && PAGE.includes("P/S"), "both EV/sales and P/S are kept");
  assert.ok(PAGE.includes("RECOMMENDED FOR TRANCHES"));
  for (const t of ["MU", "GEV", "NVDA"]) assert.ok(PAGE.includes(`"${t}"`), t + " is switchable");
});
