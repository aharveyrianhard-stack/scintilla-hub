import test from "node:test";
import assert from "node:assert/strict";
import { williamsR, ranks, pearson, spearman, acf, effectiveN, fisherInterval, blockResample, rng, binomialTolerance,
  shareAtOrBelow, percentileLineCoverage, indexVsMembers, pairSpan, prefixStable, s2Name, badHighLow } from "../tools/quant-loop/run1/studies.mjs";

const close = (v, p = 6) => Math.round(v * 10 ** p) / 10 ** p;

test("Williams %R by hand, and a zero range is undefined and counted", () => {
  // last 3 bars: highest high 12, lowest low 7, close 10 -> -100 * (12 - 10) / (12 - 7) = -40
  const w = williamsR([10, 12, 11], [8, 9, 7], [9, 11, 10], 3);
  assert.deepEqual(w.slice(0, 2), [null, null]);
  assert.equal(w[2], -40);
  const flat = williamsR([5, 5, 5, 6], [5, 5, 5, 4], [5, 5, 5, 6], 3);
  assert.equal(flat[2], null); assert.equal(flat.zeroRange, 1);
  assert.equal(flat[3], 0);                                            // close on the 3-bar high -> 0
});

test("ranks give ties their average rank; Spearman by hand", () => {
  assert.deepEqual(ranks([10, 20, 20, 30]), [1, 2.5, 2.5, 4]);
  // ranks y = [1,2,3.5,5,3.5]; deviations dx=[-2,-1,0,1,2], dy=[-2,-1,.5,2,.5]; 8 / sqrt(10 * 9.5)
  assert.equal(close(spearman([1, 2, 3, 4, 5], [5, 6, 7, 8, 7])), close(8 / Math.sqrt(95)));
  assert.equal(spearman([1, 2, 3], [1, 4, 9]), 1);
  assert.equal(pearson([1, 2, 3], [4, 4, 4]), null);                  // zero variance: undefined, not zero
});

test("autocorrelation and the effective sample size by hand", () => {
  // mean 2.5, deviations -1.5 -.5 .5 1.5: den 5, lag-1 num .75 - .25 + .75 = 1.25
  assert.equal(acf([1, 2, 3, 4], 1), 0.25);
  const e = effectiveN([1, 2, 3, 4], [1, 2, 3, 4], 1);                 // 4 / (1 + 2 * .0625)
  assert.equal(close(e.n_eff), close(4 / 1.125)); assert.equal(e.capped, false);
  const c = effectiveN([1, -1, 1, -1], [1, 2, 3, 4], 1);               // -.75 * .25 -> raw 6.4, capped at n
  assert.equal(c.n_eff, 4); assert.equal(c.capped, true);
});

test("Fisher interval: r = 0.5 with 103 effective days is 0.3393 to 0.6323", () => {
  const [lo, hi] = fisherInterval(0.5, 103);                           // se = 1/sqrt(100) = 0.1
  assert.equal(close(lo, 4), 0.3393); assert.equal(close(hi, 4), 0.6323);
  assert.equal(fisherInterval(0.5, 3), null);
});

test("binomial tolerance around 10% with 100 days is 5.88 points", () => {
  assert.equal(close(binomialTolerance(0.1, 100), 4), 0.0588);
});

test("moving blocks are contiguous, fill exactly n, and repeat under the same seed", () => {
  const a = blockResample(45, 20, rng(7)), b = blockResample(45, 20, rng(7));
  assert.equal(a.length, 45); assert.deepEqual(a, b);
  for (const blockStart of [0, 20]) for (let j = 1; j < 20; j++) assert.equal(a[blockStart + j], a[blockStart] + 1 + (j - 1));
});

test("S1(a) share at or below 30 counts the line itself and skips missing days", () => {
  assert.deepEqual(shareAtOrBelow([10, 30, 31, null, 50], 30), { n: 4, count: 2, share: 0.5 });
});

test("S1(a) index against the median member, by hand", () => {
  // index 1 of 4 days <= 30 (25%); members 50%, 75%, 0% -> median 50% -> difference -25 points
  const r = indexVsMembers({ dates: ["a", "b", "c", "d"], index: [25, 40, 40, 40],
    members: { A: [25, 25, 40, 40], B: [25, 25, 25, 40], C: [40, 40, 40, 40] } }, { B: 200, block: 2 });
  assert.equal(r.index_share, 0.25); assert.equal(r.member_median_share, 0.5); assert.equal(r.diff, -0.25);
  const again = indexVsMembers({ dates: ["a", "b", "c", "d"], index: [25, 40, 40, 40],
    members: { A: [25, 25, 40, 40], B: [25, 25, 25, 40], C: [40, 40, 40, 40] } }, { B: 200, block: 2 });
  assert.deepEqual(r.ci, again.ci);                                     // seeded: same interval every run
  // an index that never tags 30 against members that always do: every resample says -100 points
  const clear = indexVsMembers({ dates: [1, 2, 3], index: [50, 50, 50], members: { A: [20, 20, 20], B: [10, 10, 10] } }, { B: 50, block: 2 });
  assert.deepEqual(clear.ci, [-1, -1]); assert.match(clear.verdict, /^HOLDS/);
});

test("S1(b) the trailing 10th-percentile line, out of sample, by hand", () => {
  // window 10. Day 10: prior 0..9, line = 0 + 0.9 * 1 = 0.9, reading 0.5 fires.
  // Day 11: prior 1..9 and 0.5, sorted 0.5,1,..,9, line = 0.5 + 0.9 * 0.5 = 0.95, reading 5 does not.
  const v = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0.5, 5];
  const r = percentileLineCoverage(v, { window: 10, B: 20, block: 2 });
  assert.equal(r.n, 2); assert.equal(r.fired, 1); assert.equal(r.share, 0.5);
  assert.equal(close(r.tolerance), close(1.959963984540054 * Math.sqrt(0.09 / 2)));
  // a reading equal to the line does not fire (strictly below)
  const eq = percentileLineCoverage([...Array.from({ length: 10 }, (_, i) => i), 0.9], { window: 10, B: 5, block: 2 });
  assert.equal(eq.fired, 0);
});

test("S2 state agreement and conditional lift, by hand", () => {
  // RSI states OS N OB OS; %R states OS N OB N -> agree 3 of 4; %R OS base 1/4, given RSI OS 1/2 -> lift 2
  const p = pairSpan([20, 50, 80, 25], [-90, -50, -10, -50], { K: 1 });
  assert.equal(p.agreement, 0.75); assert.equal(p.rsi_os_days, 2); assert.equal(p.both_os_days, 1);
  assert.equal(p.wr_os_base, 0.25); assert.equal(p.wr_os_given_rsi_os, 0.5); assert.equal(p.lift, 2);
});

test("S2 stamp: an interval that clears 0.9 is ONE-WITNESS, one that does not is INDEPENDENT", () => {
  const x = Array.from({ length: 400 }, (_, i) => Math.sin(i / 3) + i / 400);
  assert.equal(pairSpan(x, x.map((v) => 2 * v - 100), { K: 5 }).stamp, "ONE-WITNESS");   // identical ranks
  const u = rng(3), y = x.map(() => u());
  assert.equal(pairSpan(x, y, { K: 5 }).stamp, "INDEPENDENT");
});

test("G0 for the readings: the check catches a reading that redraws the past", () => {
  const series = (m) => Array.from({ length: m }, (_, i) => i);
  assert.equal(prefixStable(series, 50, [10, 30]).ok, true);
  const repaint = (m) => Array.from({ length: m }, (_, i) => i / m);    // divides by the whole length: redraws
  assert.equal(prefixStable(repaint, 50, [10, 30]).ok, false);
});

test("S2 leaves out every day whose 14-bar %R window touches a flagged bar", () => {
  const bars = Array.from({ length: 60 }, (_, i) => ({ date: "d" + i, h: 11 + Math.sin(i), l: 9 - Math.cos(i), c: 10 + Math.sin(i / 2) }));
  const base = s2Name(bars, { K: 2 });
  const cut = s2Name(bars, { K: 2 }, new Set(["d30"]));
  assert.equal(cut.skipped_near_bad_prints, 14);                        // d30 .. d43
  assert.equal(cut.all.n, base.all.n - 14);
});

test("bad high/low prints: the IWM 2004-07-30 bar is flagged, an ordinary wide day is not", () => {
  assert.deepEqual(badHighLow([
    { date: "2004-07-30", o: 54.6, h: 5486.5, l: 54.5, c: 55 },         // served by the chart API
    { date: "2008-10-10", o: 85, h: 90, l: 78, c: 89 },                  // a real 14% range
    { date: "x", o: 111.78, h: 112.06, l: 11.7, c: 111.79 },             // SPY 2004-03-16's low
  ]), ["2004-07-30", "x"]);
});
