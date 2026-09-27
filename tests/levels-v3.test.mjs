import test from "node:test";
import assert from "node:assert/strict";
import { quantile, stdevSample, sma, usualDay, pctMoves } from "../research/statistics/stats.mjs";
import { walkLines, countFires, pullbackEpisodes, pullbackTriggers, followed, spearman, williamsR, sigma14, sigmaD200, sigmaRatio,
  segmentStart, barsPerYear, summarise, Z10, D200_SCALE } from "../research/statistics/levels-v3-lib.mjs";

const r = (v, p = 6) => Math.round(v * 10 ** p) / 10 ** p;

test("walkLines: every line is drawn from the prior window only, matching a brute-force recount", () => {
  let seed = 7; const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const series = Array.from({ length: 400 }, (_, i) => (i % 37 === 0 ? null : 50 + 30 * (rnd() - 0.5)));
  for (const W of [60, Infinity]) {
    const w = walkLines(series, W, { qLo: 0.1, qHi: 0.9, minN: 30 });
    for (const i of [45, 120, 250, 399]) {
      const start = Number.isFinite(W) ? Math.max(0, i - W) : 0;
      const prior = series.slice(start, i).filter((v) => v != null).sort((a, b) => a - b);
      assert.equal(w.n[i], prior.length, `n at ${i}, W=${W}`);
      assert.equal(r(w.lo[i]), r(quantile(prior, 0.1)));
      assert.equal(r(w.hi[i]), r(quantile(prior, 0.9)));
      assert.equal(r(w.mean[i]), r(prior.reduce((a, b) => a + b, 0) / prior.length));
      assert.equal(r(w.sd[i], 5), r(stdevSample(prior), 5));
    }
  }
});

test("walkLines: today's own value never enters its own line", () => {
  const s = [...Array(40).fill(10), 1000];
  const w = walkLines(s, Infinity, { minN: 30 });
  assert.equal(w.hi[40], 10); assert.equal(w.n[40], 40);
});

test("countFires: one selloff is one episode; a gap of more than five quiet sessions opens a new one", () => {
  const f = new Array(30).fill(false); for (const i of [2, 3, 4, 8, 9, 20]) f[i] = true;
  const c = countFires(f, 0, 29);
  assert.equal(c.days, 6); assert.equal(c.episodes, 2); assert.deepEqual(c.starts, [2, 20]);   // 4 → 8 is a 4-session gap: same episode
  assert.equal(countFires(f, 5, 29).episodes, 2);                                                // starting inside the first run
});

test("pullback episodes by hand: high 100, low 88, regained — depth −12%, 3 sessions high→low, qualified", () => {
  const closes = [90, 95, 100, 96, 92, 88, 94, 101, 99];
  const s200 = closes.map(() => 90), ud = closes.map(() => 2);          // 12% is 6 usual days ≥ 2.5
  const eps = pullbackEpisodes(closes, s200, ud);
  assert.equal(eps.length, 2);
  const e = eps[0];
  assert.equal(e.jH, 2); assert.equal(e.m, 5); assert.equal(e.low, 88); assert.equal(e.end, 7); assert.equal(e.recovered, true);
  assert.equal(r(e.depth), -12); assert.equal(r(e.depthUsual), -6); assert.equal(e.qualified, true);
  assert.equal(eps[1].open, true);                                       // 101 → 99 is still open at the end
});

test("pullback episodes: a high below its 200-day, or a wiggle under 2.5 usual days, is not a qualified pullback", () => {
  const closes = [100, 97, 101];
  assert.equal(pullbackEpisodes(closes, [110, 110, 110], [1, 1, 1])[0].qualified, false);   // high under the average
  assert.equal(pullbackEpisodes(closes, [90, 90, 90], [2, 2, 2])[0].qualified, false);      // 3% < 2.5 × 2%
  assert.equal(pullbackEpisodes(closes, [90, 90, 90], [1, 1, 1])[0].qualified, true);       // 3% ≥ 2.5 × 1%
});

test("pullback triggers fire once per episode per level, on the first close at that depth", () => {
  const closes = [100, 96, 94, 89, 92, 85, 101, 95];
  const s200 = closes.map(() => 80);
  const t = pullbackTriggers(closes, s200, [], { fixed: [5, 10], minPrior: 5 });
  assert.deepEqual(t.map((x) => [x.i, x.level]), [[2, 5], [3, 10], [7, 5]]);   // 94 is −6%, 89 −11%, 85 fires nothing new; after 101 a new episode
});

test("the 'own usual pullback' trigger uses only episodes that ended before the trigger", () => {
  // five finished 10% pullbacks, then a sixth decline: 'own' = 10% must fire at the first close ≥ 10% down, not before
  const closes = []; for (let k = 0; k < 5; k++) closes.push(100 + k * 10, (100 + k * 10) * 0.9, 100 + k * 10 + 5);
  closes.push(150, 142, 134);                                             // 150 → 134 is −10.7%
  const s200 = closes.map(() => 50), ud = closes.map(() => 1);
  const eps = pullbackEpisodes(closes, s200, ud);
  const own = pullbackTriggers(closes, s200, eps, { fixed: [], minPrior: 5 }).filter((x) => x.kind === "own");
  assert.equal(own.length, 1); assert.equal(closes[own[0].i], 134); assert.equal(r(own[0].level, 4), 10);
});

test("followed: returns after h sessions, the deepest close inside the window, and whether the high came back", () => {
  const c = [100, 90, 85, 95, 101, 99, 98];
  const f = followed(c, 1, 100, { horizons: [2, 5], regain: 5 });
  assert.equal(r(f.ret2), r((95 / 90 - 1) * 100)); assert.equal(r(f.ret5), r((98 / 90 - 1) * 100));
  assert.equal(f.regained, true); assert.equal(r(f.mae), r((85 / 90 - 1) * 100));
  assert.equal(followed(c, 4, 200, { horizons: [5], regain: 5 }).ret5, null);                 // runs off the end: null, not a guess
});

test("spearman: ±1 for monotone pairs, averaged ranks for ties", () => {
  assert.equal(r(spearman([1, 2, 3, 4], [10, 20, 30, 40])), 1);
  assert.equal(r(spearman([1, 2, 3, 4], [4, 3, 2, 1])), -1);
  assert.equal(r(spearman([1, 2, 2, 3], [1, 2, 3, 4]), 4), r(0.9486833, 4));
  assert.equal(spearman([1, null], [1, 2]), null);
});

test("Williams %R by hand, and the σ forms divide by the usual day the right way", () => {
  const h = [10, 12, 11], l = [8, 9, 7], c = [9, 11, 10];
  assert.equal(r(williamsR(h, l, c, 3)[2]), r(-100 * (12 - 10) / (12 - 7)));                 // −40
  const closes = Array.from({ length: 16 }, (_, i) => 100 + i); const ud = closes.map(() => 1);
  assert.equal(r(sigma14(closes, ud)[15]), r(((115 / 101 - 1) * 100) / Math.sqrt(14)));
  assert.equal(r(sigmaD200([null, -8.16496581], [2, 2])[1], 4), r(-8.16496581 / (2 * D200_SCALE), 4));
  assert.equal(sigmaRatio([null, 3], [1.5, 1.5])[1], 2);
  assert.ok(Math.abs(Z10 + 1.2815516) < 1e-9);
});

test("history start and bars per year", () => {
  const d = (s) => Date.parse(s + "T04:00:00Z");
  const bars = [{ t: d("2005-01-03") }, { t: d("2005-01-04") }, { t: d("2007-06-01") }, { t: d("2007-06-04") }];
  assert.equal(segmentStart(bars), 2);                                                         // the 2-year hole restarts the history
  const cal = Array.from({ length: 731 }, (_, i) => ({ t: d("2020-01-01") + i * 86400e3 }));
  assert.equal(barsPerYear(cal), 365);
});

test("summarise: count, share above zero, median and quartiles", () => {
  const s = summarise([-2, -1, 1, 2, 3, null]);
  assert.equal(s.n, 5); assert.equal(s.up, 60); assert.equal(s.median, 1); assert.equal(s.q25, -1); assert.equal(s.q75, 2);
});

test("history start: a +200% or −75% one-day print restarts the history (a reused ticker), a +150% day does not", () => {
  const d = (i) => Date.parse("2026-01-01T04:00:00Z") + i * 86400e3;
  const bars = [10, 10.2, 138.98, 140, 141].map((c, i) => ({ t: d(i), c }));
  assert.equal(segmentStart(bars), 2);
  assert.equal(segmentStart(bars, { splices: false }), 0);
  assert.equal(segmentStart([10, 25, 26].map((c, i) => ({ t: d(i), c }))), 0);                // +150%: kept, a real squeeze is possible
  assert.equal(segmentStart([100, 20, 21].map((c, i) => ({ t: d(i), c }))), 1);               // −80%
});
