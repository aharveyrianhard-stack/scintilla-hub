import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { emaStation, regressionPosition, binOf, binLabel, factorSeries, stretches, reversalsIn, swingPivots,
  condHolds, condKey, stretchTrade, liftTable, FACTORS, EMA_WARMUP } from "../research/statistics/between.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
let seed = 11; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const walk = (n) => { let p = 100; return Array.from({ length: n }, () => { p *= 1 + (rnd() - 0.5) * 0.04; const h = p * (1 + rnd() * 0.01), l = p * (1 - rnd() * 0.01); return { h, l, c: p }; }); };

test("S7b EMA is the Station's: seeded at the first close, α = 2/(n+1), withheld for 60 sessions", () => {
  const closes = Array.from({ length: 80 }, (_, i) => 100 + Math.sin(i / 3) * 5);
  const got = emaStation(closes, 13);
  let e = closes[0]; for (let i = 1; i < closes.length; i++) e = (2 / 14) * closes[i] + (12 / 14) * e;
  assert.equal(got[EMA_WARMUP - 1], null);
  near(got[79], e);
});

test("S7b straight-line channel: 0.5 on the line, 0 and 1 at ±2 residual spreads", () => {
  // residuals +1 −1 −1 +1 +1 −1 −1 +1 around y = 100 + 2x sum to zero against 1 and x, so the fit is exactly that line
  const len = 8, r = [1, -1, -1, 1, 1, -1, -1, 1], closes = r.map((e, x) => 100 + 2 * x + e);
  const sd = Math.sqrt(8 / 6);
  near(regressionPosition(closes, len)[len - 1], (1 + 2 * sd) / (4 * sd), 1e-9);
  assert.equal(regressionPosition(closes, len)[len - 2], null, "needs len closes");
});

test("S7b bins: below the first edge is 0, at or above the last is the top bin, labels match", () => {
  const e = [10, 20, 30];
  assert.deepEqual([5, 10, 19.9, 20, 30, 99].map((v) => binOf(v, e)), [0, 1, 1, 2, 3, 3]);
  assert.equal(binOf(null, e), -1); assert.equal(binOf(NaN, e), -1);
  assert.deepEqual([0, 1, 3].map((k) => binLabel(k, e)), ["< 10", "10 to 20", "≥ 30"]);
});

test("S7b stretch: the closes after report k's news session up to the last close before report k+1's", () => {
  const st = stretches([10, 75, 100, 300], 400);
  assert.deepEqual(st.map((s) => [s.s, s.x, s.r]), [[11, 74, 75], [76, 99, 100]]);   // 100→300 is too long (a report missing)
  assert.equal(stretches([10, 25], 100).length, 0, "14 closes is too short");
});

test("S7b trade: first close where the rule holds in, last close before the report out; the exit close is never an entry", () => {
  const closes = Array.from({ length: 60 }, (_, i) => 100 + i);
  const st = { s: 11, x: 40, r: 41 };
  const tr = stretchTrade(closes, st, (e) => e >= 20);
  assert.equal(tr.entry, 20); assert.equal(tr.wait, 9); assert.equal(tr.held, 20);
  near(tr.primary, (140 / 120 - 1) * 100); near(tr.reportDay, (141 / 120 - 1) * 100); near(tr.after5, (146 / 120 - 1) * 100);
  assert.equal(stretchTrade(closes, st, (e) => e === 40), null);
  assert.equal(stretchTrade(closes.slice(0, 44), st, () => true).after5, null);
});

test("S7b reversals: the hindsight low excludes the exit close; swing points are ±5 pivots inside the stretch", () => {
  const closes = [9, 9, 9, 9, 9, 9, 5, 6, 7, 8, 9, 10, 11, 12, 2];
  const bars = closes.map((c) => ({ h: c + 0.5, l: c - 0.5, c }));
  const piv = swingPivots(bars.map((b) => b.h), bars.map((b) => b.l));
  const rv = reversalsIn({ s: 1, x: 14 }, closes, piv);
  assert.equal(rv.best, 6, "the close of 2 is the exit close, not an entry");
  assert.deepEqual(rv.swingLows, [6]);
});

test("S7b factors use no later bar: changing the future leaves every earlier reading unchanged", () => {
  const bars = walk(1200), reports = [300, 363, 425, 490, 552, 615, 680, 742, 805, 870, 930, 995];
  const spy = bars.map((_, i) => i % 100);
  const a = factorSeries(bars, reports, spy);
  const cut = 900, changed = bars.map((b, i) => i > cut ? { h: b.h * 1.5, l: b.l * 0.5, c: b.c * (i % 2 ? 1.3 : 0.7) } : b);
  const b = factorSeries(changed, reports, spy);
  for (const f of FACTORS) for (let i = 0; i <= cut; i++) {
    const x = a.F[f.key][i], y = b.F[f.key][i];
    if (x == null) assert.equal(y, null, `${f.key} @${i}`); else near(y, x, 1e-9);
  }
  for (let i = 0; i <= cut; i++) assert.equal(a.cloud[i], b.cloud[i]);
  assert.equal(a.F.since[300], null); assert.equal(a.F.since[301], 1); assert.equal(a.F.since[362], 62); assert.equal(a.F.since[363], 63); assert.equal(a.F.since[364], 1);
  assert.equal(a.F.spy_pct[450], 50);
});

test("S7b conditions: 'below' and 'at or above' split exactly like the bins; clouds match by state", () => {
  const F = { rsi_pct: [4.9, 5, null] }, cloud = ["+++", "--+", null];
  const lt = { factor: "rsi_pct", side: "lt", value: 5 }, ge = { factor: "rsi_pct", side: "ge", value: 5 };
  assert.deepEqual([0, 1, 2].map((i) => condHolds(lt, F, cloud, i)), [true, false, false]);
  assert.deepEqual([0, 1, 2].map((i) => condHolds(ge, F, cloud, i)), [false, true, false]);
  assert.equal(condHolds({ factor: "cloud", value: "--+" }, F, cloud, 1), true);
  assert.equal(condKey(lt), "rsi_pct < 5"); assert.equal(condKey({ factor: "cloud", value: "+++" }), "cloud +++");
});

test("S7b lift = share at the reversal ÷ share at ordinary sessions", () => {
  const t = liftTable({ ordinary: [80, 20], best: [5, 5], swingLow: [30, 10], swingHigh: [40, 0] }, [0]);
  near(t.rows[1].ordinary, 20); near(t.rows[1].best, 50); near(t.rows[1].lift_best, 2.5); near(t.rows[1].lift_swingLow, 1.25); near(t.rows[1].lift_swingHigh, 0);
});

test("S7b output: the JSON holds the promised blocks, and nothing is flagged without 200 trades in both halves", () => {
  const f = new URL("../research/statistics/data/s7b-between.json", import.meta.url);
  if (!fs.existsSync(f)) return;
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  for (const k of ["lifts", "pool", "rows", "flagged", "sell_the_news", "stretch_facts"]) assert.ok(d[k], k);
  for (const key of [...d.flagged.at65, ...d.flagged.at70]) {
    const r = d.rows.find((x) => x.key === key);
    assert.ok(r.discover.trades >= 200 && r.confirm.trades >= 200 && r.discover.share_up >= 65 && r.confirm.share_up >= 65, key);
  }
  for (const t of d.targets) assert.ok(d.sell_the_news.some((s) => s.ticker === t), t);
});
