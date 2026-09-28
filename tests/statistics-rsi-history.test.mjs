import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { percentileTable, percentileOf, episodes, fwd, worstAhead, clusterBoot, divergences, swingRsi, analyse, seriesOf, rng, INSTRUMENTS, PIVOT_LEN, run, beatsAnyDay, nasdaqVsSp } from "../research/statistics/rsi-history.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const DAY = 864e5, T0 = Date.UTC(2015, 0, 5);
function bars(closes, wick = 0.002) {
  const out = []; let t = T0;
  for (let i = 0; i < closes.length; i++) {
    while ([0, 6].includes(new Date(t).getUTCDay())) t += DAY;
    const o = i ? closes[i - 1] : closes[i];
    out.push({ t, o, h: Math.max(o, closes[i]) * (1 + wick), l: Math.min(o, closes[i]) * (1 - wick), c: closes[i], v: 1000 }); t += DAY;
  }
  return out;
}

test("RSI history: percentile table reads the right value at each 5% step, over the full or the recent slice", () => {
  const rsi = [null, null, ...Array.from({ length: 101 }, (_, i) => i)];          // 0..100, two warm-up nulls
  const t = percentileTable(rsi);
  assert.equal(t.n, 101); assert.equal(t.steps.length, 19);
  assert.equal(t.steps[0], 5); assert.equal(t.steps[1], 10); assert.equal(t.steps[18], 95); assert.equal(t.min, 0); assert.equal(t.max, 100);
  const r = percentileTable(rsi, rsi.length - 11);                                   // last 11 readings: 90..100
  assert.equal(r.n, 11); assert.equal(r.steps[0], 90.5); assert.equal(r.steps[18], 99.5);
  assert.equal(percentileOf([10, 20, 30, 40], 20), 37.5);                            // one below, one tie (half)
});

test("RSI history: an episode starts on the first close in the zone; a return within 5 sessions is the same episode", () => {
  const z = (on) => (i) => on.includes(i);
  const e = episodes(z([3, 4, 5, 9, 20, 30, 31]), 40);                               // 5→9 gap 4 sessions: merged; 9→20: new
  assert.deepEqual(e.map((x) => [x.start, x.last, x.days, x.length]), [[3, 9, 4, 7], [20, 20, 1, 1], [30, 31, 2, 2]]);
  const e2 = episodes(z([3, 10]), 20);                                                // 6 sessions out: two episodes
  assert.equal(e2.length, 2);
});

test("RSI history: forward change is percent for prices, basis points for yields, and skipped at or below zero", () => {
  assert.ok(Math.abs(fwd([100, 101, 110], 0, 2) - 10) < 1e-9);
  assert.ok(Math.abs(fwd([4.0, 4.1, 4.25], 0, 2, "bp") - 25) < 1e-9);
  assert.equal(fwd([10, -5, 12], 0, 1), null);
  assert.equal(fwd([10, 11], 0, 5), null, "no forward bar, no number");
  assert.ok(Math.abs(worstAhead([100, 95, 90, 120], 0, 3) + 10) < 1e-9);
});

test("RSI history: the month-clustered bootstrap is reproducible and brackets the median", () => {
  const R = rng(7), ev = Array.from({ length: 120 }, (_, i) => ({ month: `2020-${String(1 + (i % 12)).padStart(2, "0")}`, value: (R() - 0.4) * 10 }));
  const a = clusterBoot(ev), b = clusterBoot(ev);
  assert.deepEqual(a, b, "fixed seed → same interval");
  assert.equal(a.months, 12); assert.ok(a.medLo <= a.med && a.med <= a.medHi); assert.ok(a.upLo <= a.upHi);
  const one = clusterBoot(ev.map((e) => ({ ...e, month: "2020-01" })));
  assert.equal(one.medLo, one.medHi, "a single month cannot be resampled into anything else");
});

/** Two dips: a hard one (fast fall), then a lower but gentle one → price lower low, RSI higher low. */
function divPath() {
  const c = []; let p = 100;
  for (let i = 0; i < 40; i++) c.push(p += 0.3);                   // up
  for (let i = 0; i < 8; i++) c.push(p -= 2.2);                    // hard drop
  for (let i = 0; i < 15; i++) c.push(p += 0.9);                   // bounce
  for (let i = 0; i < 24; i++) c.push(p -= 0.62);                  // slow grind to a slightly lower low
  for (let i = 0; i < 40; i++) c.push(p += 0.5);                   // recovery
  return c;
}
test("RSI history: a bullish divergence is a lower price low with a higher RSI low, acted on only 10 sessions after the low", () => {
  const S = seriesOf(bars(divPath())), d = divergences(S);
  const bull = d.lows.filter((x) => x.div);
  assert.equal(bull.length, 1, "exactly one bullish divergence in the fixture");
  const x = bull[0];
  assert.ok(x.p2 < x.p1 && x.rsi2 > x.rsi1);
  assert.equal(x.conf, x.k2 + PIVOT_LEN, "confirmation lag = the pivot window");
  // no lookahead: the same signal appears when the series ends on the confirmation bar, and not one bar earlier
  const cut = (n) => { const b = bars(divPath()).slice(0, n); return divergences(seriesOf(b)).lows.filter((y) => y.div); };
  assert.equal(cut(x.conf + 1).length, 1);
  assert.equal(cut(x.conf).length, 0);
});

test("RSI history: swing RSI buckets declines by depth and reads RSI at the swing-low bar", () => {
  const tri = []; for (let k = 0; k < 4; k++) { for (let i = 0; i <= 30; i++) tri.push(100 + i); for (let i = 29; i > 0; i--) tri.push(100 + i); }
  const S = seriesOf(bars(tri)), sorted = S.rsi.filter((v) => v != null).sort((a, b) => a - b), w = swingRsi(S, PIVOT_LEN, sorted);
  assert.ok(w.nDowns >= 2 && w.nUps >= 2);
  const big = w.downs.find((b) => b.bucket === "20%+");                            // 130 → 100 is a 23% fall
  assert.equal(big.n, w.nDowns); assert.ok(big.rsiMed < 20, "a straight 30-bar fall ends deeply oversold");
});

test("RSI history: analyse() returns tables, zones, swings, divergences and chart data for a synthetic instrument", () => {
  const R = rng(3), c = []; let p = 100; for (let i = 0; i < 2600; i++) c.push(p *= 1 + (R() - 0.49) * 0.03);
  const S = seriesOf(bars(c)), A = analyse(S, { key: "TEST", name: "test" });
  assert.equal(A.full.steps.length, 19); assert.equal(A.recent.n, 756);
  assert.ok(A.lo10 < A.hi90); assert.ok(A.bottom.count > 0 && A.top.count > 0);
  for (const h of [5, 10, 20, 60]) assert.ok(A.bottom.fwd[h].n > 0 && A.baseline[h].n > 2000);
  assert.ok(Math.abs(A.bottom.daysShare - 10) < 1.5, "the bottom zone holds about 10% of days by construction");
  assert.ok(A.chart.full.length <= 1501 && A.chart.recent.length === 756);
});

const CACHE = path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
test("RSI history: real cache (skipped when absent) — 17 instruments, S9's impossible wicks clamped, SPY agrees with the S&P index", { skip: !fs.existsSync(path.join(CACHE, "daily-bars-rsi/SPY.json")) }, () => {
  const out = run(CACHE);
  assert.equal(Object.keys(out.instruments).length, INSTRUMENTS.length);
  const wicks = ["SPY", "QQQ", "IWM", "BTCUSD"].map((k) => out.sources[k].cleaned.length).reduce((a, b) => a + b, 0);
  assert.equal(wicks, 14, "the 14 impossible wicks S9 listed");
  assert.ok(out.sources.SPX.from <= "1928-01-01" && out.sources.NDX.from <= "1985-02-01");
  assert.ok(out.compare.spyVsIndex.medAbsDiff < 1.5, "SPY's RSI and the S&P index's RSI agree on the same days");
  const spy = out.instruments.SPY; assert.ok(spy.lo10 > 30 && spy.lo10 < 45);
});

test("RSI history: the published JSON matches the engine's shape", () => {
  const f = path.join(root, "deliverables/20260928/rsi-full-history/rsi-full-history.json");
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  assert.ok(j.instruments.SPY.bottom.fwd[20].med != null && j.instruments.SPX.full.steps.length === 19);
  assert.ok(j.compare.fullIndex.table.length === 9);
});

test("RSI history: the page carries every instrument, the BACK/CLOSE pair, and no white", () => {
  const html = fs.readFileSync(path.join(root, "deliverables/20260928/rsi-full-history/index.html"), "utf8");
  const j = JSON.parse(fs.readFileSync(path.join(root, "deliverables/20260928/rsi-full-history/rsi-full-history.json"), "utf8"));
  for (const I of INSTRUMENTS) assert.ok(html.includes(`id="c-${I.key}"`), I.key);
  assert.ok(html.includes("scnav"), "BACK / CLOSE pair placed");
  assert.ok(!/#fff\b|#ffffff\b|:\s*white\b/i.test(html), "no white");
  assert.ok(html.includes(`RSI of ${j.instruments.SPY.lo10.toFixed(1)} or lower`), "headline reads the JSON");
});

test("RSI history: a signal only beats any day when the any-day median sits outside the signal's 90% range", () => {
  assert.equal(beatsAnyDay({ med: 2.05, medLo: 1.16, medHi: 2.44, base: { med: 1.34 } }), "inside", "SPY 20-session case from review: may be luck");
  assert.equal(beatsAnyDay({ med: 2.48, medLo: 1.56, medHi: 3.13, base: { med: 1.5 } }), "above");
  assert.equal(beatsAnyDay({ med: 0.08, medLo: -0.13, medHi: 0.25, base: { med: 0.3 } }), "below");
  assert.equal(beatsAnyDay({ med: 1, medLo: null, medHi: null, base: { med: 0.5 } }), null);
});

test("RSI history: the Nasdaq-vs-S&P comparison is symmetric — swapping the two sides swaps the swing-low counts", () => {
  // two synthetic markets with different drawdown timing, so each has swing lows the other does not
  const n = 1200, ca = [], cb = [];
  for (let i = 0; i < n; i++) { ca.push(100 * Math.exp(0.0003 * i) * (1 + 0.14 * Math.sin(i / 37))); cb.push(100 * Math.exp(0.0004 * i) * (1 + 0.16 * Math.sin(i / 53 + 1))); }
  const A = seriesOf(bars(ca)), B = seriesOf(bars(cb));
  const ab = nasdaqVsSp(A, B, "A", "B"), ba = nasdaqVsSp(B, A, "B", "A");
  assert.ok(ab.lows.length > 0 && ab.lowsOfB.length > 0, "both sides' own lows are measured");
  assert.equal(ab.lows.length, ba.lowsOfB.length); assert.equal(ab.lowsOfB.length, ba.lows.length);
  assert.equal(ab.lowsBDeeper, ba.lowsADeeper); assert.equal(ab.lowsADeeper, ba.lowsBDeeper);
  assert.equal(ab.shareBLowerWhenA10, ba.shareALowerWhenB10); assert.equal(ab.shareALowerWhenB10, ba.shareBLowerWhenA10);
  for (const x of ab.lowsOfB) assert.equal(x.deeperA, x.rsiA < x.rsiB);
});

test("RSI history: the page states the no-hindsight figure and the range beside SPY's headline, and reports the Nasdaq lows both ways", () => {
  const html = fs.readFileSync(path.join(root, "deliverables/20260928/rsi-full-history/index.html"), "utf8");
  const lead = html.match(/<ol class="lead">([\s\S]*?)<\/ol>/)[1].replace(/<[^>]+>/g, "");
  assert.ok(/no reliable gain over any day/.test(lead) && /range \+1\.2% to \+2\.4%/.test(lead) && /shrinks to \+1\.5%/.test(lead));
  assert.ok(!/\bedge\b/.test(lead.split("\n").find((l) => l.startsWith("What SPY did next"))), "no 'edge' claim on the SPY answer");
  assert.ok(/at the Nasdaq 100's own \d+ falls of 10%\+ the S&P went deeper \d+ times/.test(lead));
  assert.ok(!/No — not over the full history either/.test(lead));
});
