import test from "node:test";
import assert from "node:assert/strict";
import { pctMoves, rsiWilder, sma, distanceToSma, stdevSample, usualDay, priorWindow, percentileOf, quantile, describe, analyseSymbol, LEVELS, MIN_N } from "../research/statistics/stats.mjs";

const close = (v, p = 4) => Math.round(v * 10 ** p) / 10 ** p;

test("percentile: share below plus half the ties, by hand", () => {
  assert.equal(percentileOf([1,2,3,4,5,6,7,8,9,10], 7), 65);        // six below, one tie -> (6+0.5)/10
  assert.equal(percentileOf([3,5,5,7], 5), 50);                       // one below, two equal -> (1+1)/4
  assert.equal(percentileOf([3,5,5,7], 100), 100);
  assert.equal(percentileOf([3,5,5,7], -1), 0);
  assert.equal(percentileOf([], 1), null);
});

test("mean, sample sd and Z on a textbook set", () => {
  const xs = [2,4,4,4,5,5,7,9];                                        // mean 5, population sd 2, sample sd sqrt(32/7)
  assert.equal(close(stdevSample(xs)), close(Math.sqrt(32 / 7)));
  const d = describe([...xs, 9], 8, Infinity);                          // today = 9, prior = the eight
  assert.equal(d.n, 8); assert.equal(d.mean, 5);
  assert.equal(close(d.z), close((9 - 5) / Math.sqrt(32 / 7)));
  assert.equal(d.percentile, 100 * (7 + 0.5) / 8);                      // seven below, one tie
});

test("prior observations only: today's own value never enters its sample", () => {
  const vals = [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1, 1000];
  const d = describe(vals, 30, Infinity);
  assert.equal(d.n, 30); assert.equal(d.mean, 1); assert.equal(d.sd, 0);
  assert.equal(d.z, null); assert.match(d.z_note, /zero variance/);
  assert.equal(d.percentile, 100);
  assert.equal(d.too_few, false);
});

test("the window looks back the asked number of sessions and flags a short history", () => {
  const vals = Array.from({ length: 100 }, (_, i) => i);
  const w = priorWindow(vals, 99, 20);
  assert.deepEqual(w.values, Array.from({ length: 20 }, (_, i) => 79 + i));
  const d = describe(vals, 99, 20); assert.equal(d.short_history, false); assert.equal(d.n, 20);
  const s = describe(vals, 10, 252); assert.equal(s.short_history, true); assert.equal(s.n, 10); assert.equal(s.too_few, true);
  assert.equal(MIN_N, 30);
});

test("RSI(14) Wilder: all gains reads 100, balanced reads 50, then one more gain by hand", () => {
  const up = Array.from({ length: 20 }, (_, i) => 100 + i);
  assert.equal(rsiWilder(up)[19], 100);
  const alt = [100]; for (let i = 0; i < 14; i++) alt.push(alt[alt.length - 1] + (i % 2 === 0 ? 1 : -1)); // +1,-1 x7
  const r = rsiWilder(alt);
  assert.equal(r[13], null); assert.equal(r[14], 50);                   // avgU = avgD = 0.5
  alt.push(alt[alt.length - 1] + 1);                                     // 16th close: +1
  const r2 = rsiWilder(alt);
  const avgU = (0.5 * 13 + 1) / 14, avgD = (0.5 * 13) / 14;
  assert.equal(close(r2[15]), close(100 - 100 / (1 + avgU / avgD)));   // 53.5714
});

test("SMA and distance to the 200-day by hand", () => {
  const c = Array.from({ length: 200 }, () => 10); c.push(11);
  const m = sma(c, 200); assert.equal(m[198], null); assert.equal(m[199], 10);
  assert.equal(close(m[200]), close((199 * 10 + 11) / 200));
  const d = distanceToSma(c, 200);
  assert.equal(close(d[200]), close((11 / m[200] - 1) * 100));
});

test("usual day: sample sd of the last 60 daily moves, needs all 60", () => {
  const c = [100]; for (let i = 0; i < 61; i++) c.push(c[c.length - 1] * (i % 2 === 0 ? 1.01 : 1 / 1.01));
  const u = usualDay(c, 60);
  assert.equal(u[59], null);                                             // only 59 moves before index 60? index 60 has 60 moves
  assert.notEqual(u[60], null);
  const moves = pctMoves(c).slice(1, 61);
  assert.equal(close(u[60]), close(stdevSample(moves)));
});

test("level frequencies count prior values at or beyond the line", () => {
  const vals = [10, 20, 30, 30, 70, 80, 50, 55];
  const d = describe(vals, 7, Infinity, LEVELS.rsi14);
  assert.equal(d.levels["at or below 30 (Wilder OS)"].count, 4);        // 10,20,30,30
  assert.equal(d.levels["at or above 70 (Wilder OB)"].count, 2);        // 70,80
  assert.equal(close(d.levels["at or below 30 (Wilder OS)"].share, 2), close(100 * 4 / 7, 2));
});

test("quantile is linear between order statistics", () => {
  assert.equal(quantile([1,2,3,4,5], 0.5), 3);
  assert.equal(quantile([1,2,3,4], 0.5), 2.5);
  assert.equal(quantile([10,20,30,40,50,60,70,80,90,100], 0.10), 19);
});

test("analyseSymbol reports source date, counts and the three indicators", () => {
  const bars = Array.from({ length: 300 }, (_, i) => ({ t: Date.UTC(2025, 0, 1) + i * 86400e3, c: 100 + Math.sin(i / 7) * 5 }));
  const a = analyseSymbol(bars);
  assert.equal(a.bars, 300); assert.equal(a.source_date, "2025-10-27");
  for (const k of ["rsi14", "dist200", "usual60"]) {
    assert.ok(a.indicators[k].today != null, k);
    assert.equal(a.indicators[k].windows["1y"].short_history, false);  // 299 prior sessions cover 252
    assert.equal(a.indicators[k].windows["3y"].short_history, true);   // but not 756
    assert.equal(a.indicators[k].windows["all"].short_history, false);
  }
  assert.equal(a.indicators.dist200.valid_days, 101);
});
