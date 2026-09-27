import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pivots, channelStates, rsiOwnPercentile, nextFire, tradeFor, triggerFlags, BIT, wilson } from "../research/statistics/entries.mjs";
import { percentileOf } from "../research/statistics/stats.mjs";

const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

test("S7 trade: first qualifying close in, last close before the report out (fixture 100, 101, … 126)", () => {
  const closes = Array.from({ length: 27 }, (_, i) => 100 + i);
  const tr = tradeFor(closes, 0, 3, 2);
  assert.equal(tr.wait, 3); assert.equal(tr.held, 17);
  near(tr.primary, (120 / 103 - 1) * 100);          // close 20 = the last close before the report session 21
  near(tr.primary_sd, (120 / 103 - 1) * 100 / 2);
  near(tr.reportDay, (121 / 103 - 1) * 100);
  near(tr.after5, (126 / 103 - 1) * 100);
  near(tradeFor(closes, 0, 0, 2).primary, 20);       // the window-start entry is the S6 run-up: 120/100
  assert.equal(tradeFor(closes, 0, 20, 2), null, "the exit close itself is never an entry");
  assert.equal(tradeFor(closes, 0, -1, 2), null, "no fire, no trade");
  assert.equal(tradeFor(closes.slice(0, 25), 0, 3, 2).after5, null, "five-after missing when the bars end");
});

test("S7 nextFire: the first bar on or after i where every bit is set", () => {
  const f = Int32Array.from([0, 1, 3, 0, 2]);
  assert.deepEqual([...nextFire(f, 3)].slice(0, 5), [2, 2, 2, -1, -1]);
  assert.deepEqual([...nextFire(f, 1)].slice(0, 5), [1, 1, 2, -1, -1]);
  assert.deepEqual([...nextFire(f, 0)].slice(0, 5), [0, 1, 2, 3, 4]);
});

test("S7 own RSI percentile equals the brute-force prior-window percentile", () => {
  let seed = 7; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const rsi = Array.from({ length: 400 }, (_, i) => i < 5 ? null : Math.round(rnd() * 100));   // integers force ties
  const got = rsiOwnPercentile(rsi, 60, 20);
  for (let i = 0; i < rsi.length; i++) {
    const prior = rsi.slice(Math.max(0, i - 60), i).filter((v) => v != null);
    const want = rsi[i] == null || prior.length < 20 ? null : percentileOf(prior, rsi[i]);
    if (want == null) assert.equal(got[i], null, `bar ${i}`); else near(got[i], want);
  }
});

/* Three hand-checked channels (pivot length 2 so the arithmetic fits on a page).
   bar:    0  1  2  3  4  5  6  7  8  9 10 11 12
   high:   9 10 12 10  9 11 14 12 11 13 16 15 15   pivot highs 2 (12), 6 (14), 10 (16)
   low:    8  9 10  8  6  9 11  9  8 10 13 12 12   pivot lows  4 (6), 8 (8)                        */
const H = [9, 10, 12, 10, 9, 11, 14, 12, 11, 13, 16, 15, 15];
const L = [8, 9, 10, 8, 6, 9, 11, 9, 8, 10, 13, 12, 12];
const C = [8.5, 9.5, 11, 9, 7, 10, 13, 10, 9, 12, 14, 13, 13];

test("S7 pivots: strict on the left, at-or-above on the right", () => {
  const p = pivots(H, L, 2);
  assert.deepEqual(p.hi.map((x) => [x.k, x.price]), [[2, 12], [6, 14], [10, 16]]);
  assert.deepEqual(p.lo.map((x) => [x.k, x.price]), [[4, 6], [8, 8]]);
});

test("S7 channel case 1: rising parallel channel, slope 0.5, width 7", () => {
  const ch = channelStates(H, L, C, 2, 0.35);
  assert.equal(ch[9], null, "the second pivot low (bar 8) is only known at bar 10");
  // bar 10: highs (2,12)-(6,14), lows (4,6)-(8,8): mH = mL = 0.5; width = 14 - (8 + 0.5·(6-8)) = 7; future width 7
  assert.equal(ch[10].valid, true); assert.equal(ch[10].broken, false);
  near(ch[10].upper, 16); near(ch[10].lower, 9);
  // bar 12: the high at 10 confirms, the upper pair becomes (6,14)-(10,16): upper 17, lower 10
  near(ch[12].upper, 17); near(ch[12].lower, 10); assert.equal(ch[12].valid, true);
});

test("S7 channel case 2: diverging rails fail the width-drift test (4/9 = 0.44 >= 0.35)", () => {
  const L2 = [...L]; L2[8] = 4;
  const ch = channelStates(H, L2, C, 2, 0.35);
  // mL = (4-6)/4 = -0.5; width = 14 - (4 + 0.5) ... = 9; future = 16 - 3 = 13; drift 4/9
  assert.equal(ch[10].valid, false);
  assert.equal(channelStates(H, L2, C, 2, 0.5)[10].valid, true, "a looser tolerance lets it through");
});

test("S7 channel case 3: a close under the lower rail breaks it; the next pivot resets it", () => {
  const L3 = [...L], C3 = [...C]; L3[11] = 7.5; C3[11] = 8;             // lower rail at 11 = 9.5
  const ch = channelStates(H, L3, C3, 2, 0.35);
  assert.equal(ch[10].broken, false);
  assert.equal(ch[11].broken, true);
  assert.equal(ch[12].broken, false, "the high at bar 10 confirms on bar 12 and resets the break, as in the Pine");
});

test("S7 triggers: an average touch needs the low within 1% and the close above", () => {
  const bars = Array.from({ length: 30 }, () => ({ h: 101, l: 99, c: 100 }));
  bars.push({ h: 101, l: 99.5, c: 100.5 });                               // SMA20 ≈ 100.025: low within 1%, close above
  bars.push({ h: 101, l: 99.5, c: 99.9 });                                // close below the average: no touch
  const { flags } = triggerFlags(bars);
  assert.ok(flags[30] & BIT.ma20); assert.ok(!(flags[31] & BIT.ma20));
});

test("S7 Wilson interval brackets the share", () => {
  const [lo, hi] = wilson(130, 200);
  assert.ok(lo < 65 && hi > 65 && lo > 57 && hi < 72);
});

test("S7 output: the screen only promotes rules chosen on discover with at least 200 trades", () => {
  const d = JSON.parse(fs.readFileSync(new URL("../research/statistics/data/s7-entries.json", import.meta.url), "utf8"));
  const base = d.rows[0];
  assert.equal(base.report.all.trades, d.report_windows, "the window-start entry fires in every window");
  assert.equal(base.report.all.share_up, base.report.all.same_reports_window_start.share_up);
  for (const r of [...d.confluence.at65, ...d.confluence.at70]) { assert.ok(r.discover.trades >= 200); assert.ok(r.discover.share_up >= 65); }
  for (const r of d.rows) assert.ok(r.report.all.trades <= r.report.all.windows);
});
