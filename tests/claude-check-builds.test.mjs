import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  verdictFor, verdictPair, waitFor, RULE_OF_THUMB, measureWaits, participationBySession, weekly,
  peakLine, bollWidth, squeezeState, unfinishedWicks, trueRanges, rsiWilder, oversoldExitSignals,
  railState, TAG, median, quantile,
} from "../lib/claude-check-builds.mjs";

const RULES = JSON.parse(readFileSync("data/claude-check-rules.json", "utf8")).rules;
const day = (n) => Date.UTC(2026, 0, 1) + n * 86400000;
const bar = (n, o, h, l, c) => ({ t: day(n), o, h, l, c, v: 1e6, session: new Date(day(n)).toISOString().slice(0, 10) });

/* ---- 1. one word per measure ---------------------------------------------------------- */
test("the word comes from the band the number falls in, and the number travels with it", () => {
  assert.equal(verdictFor(82, RULES.breadth_above50).word, "BROAD");
  assert.equal(verdictFor(70, RULES.breadth_above50).word, "BROAD", "the floor belongs to its own band");
  assert.equal(verdictFor(69.9, RULES.breadth_above50).word, "MIXED");
  assert.equal(verdictFor(31, RULES.breadth_above50).word, "NARROW");
  assert.equal(verdictFor(4, RULES.breadth_above50).word, "WASHED OUT");
  const v = verdictFor(82, RULES.breadth_above50);
  assert.equal(v.value, 82);
  assert.equal(v.unit, "%");
  assert.equal(v.tag, TAG.MEASURED);
});

test("a measure with no number says so instead of showing a word", () => {
  const v = verdictFor(null, RULES.geiger_market);
  assert.equal(v.word, null);
  assert.equal(v.reason, "NO_VALUE");
  assert.ok(v.says.length > 5, "it states what is missing");
  assert.equal(verdictFor(1, { measure: "x" }).reason, "NO_RULE");
});

test("the tightest band is the coiled one, because a low percentile means a tight tape", () => {
  assert.equal(verdictFor(2, RULES.squeeze_pctile).word, "COILED");
  assert.equal(verdictFor(12, RULES.squeeze_pctile).word, "TIGHT");
  assert.equal(verdictFor(80, RULES.squeeze_pctile).word, "LOOSE");
});

test("a card shows Alan's saved reading and the plain baseline, and says when they disagree", () => {
  const same = verdictPair({ saved: 0.5, baseline: 0.44 }, RULES.geiger_market);
  assert.equal(same.saved.word, "STRONG");
  assert.equal(same.baseline.word, "STRONG");
  assert.equal(same.differs, false);
  const diff = verdictPair({ saved: 0.36, baseline: 0.2 }, RULES.geiger_market);
  assert.equal(diff.saved.word, "STRONG");
  assert.equal(diff.baseline.word, "FIRM");
  assert.equal(diff.differs, true, "a toggle that changes the word must be visible");
  assert.match(diff.baseline.basis, /baseline/i);
});

/* ---- 2. waiting time per rung --------------------------------------------------------- */
test("a rung we counted is tagged measured; one we could not counts as the post's rule of thumb", () => {
  const measured = waitFor("1d", { "1d": { n: 120, median_days: 9, p25_days: 5, p75_days: 17, hit_rate: 0.72, how: "x", window: "y" } });
  assert.equal(measured.tag, TAG.MEASURED);
  assert.equal(measured.n, 120);
  assert.equal(measured.median_days, 9);
  const thin = waitFor("1d", { "1d": { n: 4, median_days: 9 } });
  assert.equal(thin.tag, TAG.ESTIMATE);
  assert.equal(thin.low_days, RULE_OF_THUMB["1d"].low_days);
  assert.ok(thin.why.length > 5);
  const none = waitFor("3d", {});
  assert.equal(none.tag, null);
  assert.equal(none.reason, "NOT_MEASURED_NO_RULE_OF_THUMB", "no number is invented for a rung with neither");
});

test("counting a wait: the first bar that reached the move, and misses still count in n", () => {
  const bars = [];
  for (let i = 0; i < 34; i++) bars.push(bar(i, 100, 100.5, 99.5, 100));
  bars[28] = bar(28, 100, 104, 99.5, 103.5);           // the move arrives on day 28
  const r = measureWaits(bars, { signalAt: (_b, i) => i === 23, movePct: 3, horizonBars: 40 });
  assert.equal(r.n, 1);
  assert.equal(r.hits, 1);
  assert.equal(r.median_days, 5, "day 23 to day 28 is five days");
  const miss = measureWaits(bars, { signalAt: (_b, i) => i === 29, movePct: 3, horizonBars: 40 });
  assert.equal(miss.n, 1);
  assert.equal(miss.hits, 0);
  assert.equal(miss.hit_rate, 0);
  assert.equal(miss.median_days, null, "a horizon that ran out is not a zero-day wait");
});

test("the move a rung is asked for is its own usual bar, not a fixed percentage", () => {
  const quiet = [], wild = [];
  for (let i = 0; i < 34; i++) { quiet.push(bar(i, 100, 100.4, 99.6, 100)); wild.push(bar(i, 100, 108, 92, 100)); }
  quiet[28] = bar(28, 100, 101.2, 99.6, 101);            // a small move on a quiet name
  wild[28] = bar(28, 100, 101.2, 92, 101);               // the same small move on a wild one
  const sig = (_b, i) => i === 23;
  const q = measureWaits(quiet, { signalAt: sig, moveAtr: 1, horizonBars: 40 });
  const w = measureWaits(wild, { signalAt: sig, moveAtr: 1, horizonBars: 40 });
  assert.equal(q.hits, 1, "on a quiet name that move is a real one");
  assert.equal(w.hits, 0, "on a wild name the same move is noise");
  assert.match(q.target_basis, /own usual bar/);
});

/* ---- 3. participation ----------------------------------------------------------------- */
test("a name only counts once it has fifty bars of its own", () => {
  const rising = Array.from({ length: 60 }, (_, i) => 100 + i);
  const sessions = rising.map((_, i) => new Date(day(i)).toISOString().slice(0, 10));
  const short = { closes: rising.slice(0, 40), sessions: sessions.slice(0, 40) };
  const full = { closes: rising, sessions };
  const out = participationBySession([full, short]);
  assert.equal(out.length, 11, "sixty bars gives eleven dates with a fifty-day average");
  for (const row of out) { assert.equal(row.of, 1, "the short name is never counted as a no"); assert.equal(row.pct, 100); }
});

test("a week shows its last session, and a thin day is left off the line", () => {
  const rows = [
    { session: "2026-01-05", of: 300, pct: 50 }, { session: "2026-01-09", of: 300, pct: 61 },
    { session: "2026-01-12", of: 300, pct: 55 }, { session: "2026-01-13", of: 4, pct: 99 },
  ];
  const w = weekly(rows, { minOf: 50 });
  assert.equal(w.length, 2);
  assert.equal(w[0].session, "2026-01-09", "Friday, not Monday");
  assert.equal(w[1].session, "2026-01-12");
  assert.ok(!w.some((r) => r.pct === 99), "a session measured on four names cannot set the week");
});

test("the peaks line says thinner when each rally tops out lower, and refuses with too few peaks", () => {
  const series = [];
  let week = Date.UTC(2023, 0, 5);
  const shape = [];
  for (let c = 0; c < 4; c++) {
    const top = 80 - c * 8;
    for (const step of [0, 0.35, 0.7, 0.9, 1, 0.8, 0.5, 0.25, 0.1, 0.02, 0.15, 0.3, 0.2, 0.05]) shape.push(30 + (top - 30) * step);
  }
  for (const pct of shape) { series.push({ week: new Date(week).toISOString().slice(0, 10), pct, of: 300, session: "x" }); week += 7 * 86400000; }
  const p = peakLine(series, { span: 5 });
  assert.equal(p.direction, "thinner");
  assert.ok(p.line.slope_per_year < 0);
  assert.ok(p.peaks.length >= 3);
  assert.equal(p.tag, TAG.MEASURED);
  const flatShort = peakLine(series.slice(0, 10), { span: 5 });
  assert.equal(flatShort.line, null);
  assert.equal(flatShort.reason, "TOO_FEW_PEAKS");
});

/* ---- 4. the squeeze ------------------------------------------------------------------- */
test("band width is a share of the middle line, so two prices can be compared", () => {
  const flat = new Array(30).fill(100);
  assert.equal(bollWidth(flat).at(-1), 0, "a price that never moves has no width");
  const a = bollWidth(Array.from({ length: 40 }, (_, i) => 100 + (i % 2 ? 2 : -2))).at(-1);
  const b = bollWidth(Array.from({ length: 40 }, (_, i) => 1000 + 10 * (i % 2 ? 2 : -2))).at(-1);
  assert.ok(Math.abs(a - b) < 1e-9, "same shape at ten times the price gives the same width");
  assert.equal(bollWidth([1, 2, 3])[2], null, "twenty bars or nothing");
});

test("the squeeze ranks a name against its own past and names the date it was last this tight", () => {
  const closes = [], sessions = [];
  for (let i = 0; i < 300; i++) {
    const wide = i < 288;
    closes.push(100 + (wide ? 6 : 0.4) * Math.sin(i / 2));
    sessions.push(new Date(day(i)).toISOString().slice(0, 10));
  }
  const s = squeezeState(bollWidth(closes), sessions, { lookback: 252 });
  assert.ok(s.pctile <= 5, `a quiet stretch should rank near the bottom, got ${s.pctile}`);
  assert.equal(s.candidate, true);
  assert.equal(s.session, sessions.at(-1));
  assert.ok(s.tightest_since == null || s.tightest_since < sessions.at(-1));
  assert.equal(squeezeState(bollWidth(closes.slice(0, 30)), sessions.slice(0, 30)).reason, "TOO_LITTLE_HISTORY");
});

/* ---- 5. unfinished business ----------------------------------------------------------- */
test("a long wick nobody traded back through stays a level; one that was traded through does not", () => {
  const bars = [];
  for (let i = 0; i < 40; i++) bars.push(bar(i, 100, 101, 99, 100));
  bars[25] = bar(25, 100, 112, 99.5, 100.5);                       // the spike, then price leaves
  const found = unfinishedWicks(bars, { minWickAtr: 2, maxAgeBars: 180 });
  const up = found.filter((l) => l.side === "up");
  assert.equal(up.length, 1);
  assert.equal(up[0].level, 112);
  assert.equal(up[0].test, 106.25, "the test is the middle of the wick, stated on the row");
  assert.ok(up[0].wick_atr >= 2);
  assert.equal(up[0].bars_standing, 14);
  assert.equal(up[0].tag, TAG.MEASURED);

  const filled = bars.slice();
  filled[30] = bar(30, 100, 107, 99, 106);                          // later, price walks back up through it
  assert.equal(unfinishedWicks(filled, { minWickAtr: 2 }).filter((l) => l.side === "up").length, 0);
});

test("a down wick is the mirror, and an ordinary bar leaves no level", () => {
  const bars = [];
  for (let i = 0; i < 40; i++) bars.push(bar(i, 100, 101, 99, 100));
  bars[25] = bar(25, 100, 100.5, 88, 99.5);
  const down = unfinishedWicks(bars, { minWickAtr: 2 }).filter((l) => l.side === "down");
  assert.equal(down.length, 1);
  assert.equal(down[0].level, 88);
  assert.ok(down[0].says.includes("88"));
  const quiet = [];
  for (let i = 0; i < 40; i++) quiet.push(bar(i, 100, 101, 99, 100));
  assert.equal(unfinishedWicks(quiet, { minWickAtr: 2 }).length, 0);
});

test("true range takes the gap into account, not just the bar's own high and low", () => {
  const bars = [bar(0, 100, 101, 99, 100), bar(1, 110, 111, 109, 110)];
  assert.equal(trueRanges(bars)[1], 11, "109 to 111 is 2, but the gap from 100 makes it 11");
});

/* ---- shared ---------------------------------------------------------------------------- */
test("RSI is Wilder's, the same one the Hub's other readings use", () => {
  const closes = [44.34, 44.09, 44.15, 43.61, 44.33, 44.83, 45.10, 45.42, 45.84, 46.08, 45.89, 46.03, 45.61, 46.28, 46.28, 46.00, 46.03, 46.41, 46.22, 45.64];
  const r = rsiWilder(closes, 14);
  assert.equal(r.slice(0, 14).every((x) => x === null), true, "no reading before fourteen changes");
  assert.equal(Math.round(r[14] * 100) / 100, 70.46);
  assert.equal(Math.round(r.at(-1) * 100) / 100, 57.92);
  const flat = rsiWilder(new Array(30).fill(100), 14);
  assert.equal(flat.at(-1), 100, "a price that only ever rises or never falls has no losses to divide by");
});

test("the signal is a crossing out of oversold, not simply a low reading", () => {
  const closes = [];
  for (let i = 0; i < 30; i++) closes.push(100 - i * 2);            // straight down: deeply oversold
  for (let i = 0; i < 12; i++) closes.push(40 + i * 4);             // then up: it crosses back
  const bars = closes.map((c, i) => bar(i, c, c + 0.5, c - 0.5, c));
  const sig = oversoldExitSignals(bars);
  const fired = bars.map((b, i) => (i > 0 && sig(b, i) ? i : null)).filter((x) => x != null);
  assert.equal(fired.length, 1, "one crossing, not one for every oversold bar");
  assert.ok(fired[0] > 30);
});

test("a rail with too little history says so rather than showing a state", () => {
  const short = Array.from({ length: 20 }, (_, i) => bar(i, 100, 101, 99, 100));
  assert.equal(railState(short).reason, "TOO_LITTLE_HISTORY");
  const long = Array.from({ length: 260 }, (_, i) => bar(i, 100 + i, 101 + i, 99 + i, 100 + i));
  const st = railState(long);
  assert.equal(st.above50, true);
  assert.equal(st.above200, true);
  assert.ok(st.distance50_pct > 0);
});

test("middle and quartile refuse an empty list instead of returning zero", () => {
  assert.equal(median([]), null);
  assert.equal(quantile([], 0.25), null);
  assert.equal(median([1, 2, 3, 4]), 2.5);
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5);
});
