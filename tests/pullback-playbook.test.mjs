/* N1 · PULLBACK PLAYBOOK (28 Sep) · fixture tests for research/statistics/pullback-playbook/lib.mjs and the delivered page. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as L from "../research/statistics/pullback-playbook/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables/20260928/pullback-playbook");
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const DAY = 864e5, t0 = Date.parse("2024-01-01T04:00:00Z"); // a Monday
const bars = (closes, { lows = null, highs = null } = {}) => closes.map((c, i) => { let t = t0 + i * DAY; while ([0, 6].includes(new Date(t).getUTCDay())) { t += DAY; } return { t: t0 + Math.floor(i / 5) * 7 * DAY + (i % 5) * DAY, o: c, h: highs ? highs[i] : c, l: lows ? lows[i] : c, c, v: 1 }; });

test("the fan has thirteen lines in the Lab's order: eight EMAs, four daily SMAs, one weekly SMA", () => {
  assert.deepEqual(L.FAN_KEYS, ["e2", "e3", "e5", "e8", "e13", "e21", "e34", "e50", "s50", "s100", "s150", "s200", "w200"]);
  assert.equal(L.FAN.filter((f) => f[1] === "e").length, 8); assert.equal(L.FAN.filter((f) => f[1] === "s").length, 4); assert.equal(L.FAN.filter((f) => f[1] === "w").length, 1);
});
test("EMA: the textbook recursion, null before the length is reached", () => {
  const e = L.ema([1, 2, 3, 4, 5], 3); assert.equal(e[0], null); assert.equal(e[1], null); near(e[2], 0.5 * 3 + 0.5 * (0.5 * 2 + 0.5 * 1)); near(e[4], 0.5 * 5 + 0.5 * e[3]);
});
test("fanKnown reads only the previous close: day i's line equals day i−1's line at close, and day 0 knows nothing", () => {
  const b = bars(Array.from({ length: 30 }, (_, i) => 100 + i)); const atClose = L.fanAtClose(b), known = L.fanKnown(b);
  assert.equal(known.e2[0], null); near(known.e2[5], atClose.e2[4]); near(known.e13[20], atClose.e13[19]);
});
test("weekly SMA200 maps the last COMPLETED week to every day of the next week (no lookahead)", () => {
  const closes = Array.from({ length: 5 * 205 }, (_, i) => 1 + i); const b = bars(closes); const w = L.weeklySma200(b, 3); // len 3 to keep the check small
  // week k closes at close index 5k+4 = 5k+5 in value; the 3-week SMA at week k = mean of values 5k+5, 5k, 5k−5 = 5k
  const day = 5 * 10; // first day of week 10: last completed week is 9 → sma = mean(5·9+5, 5·8+5, 5·7+5) = 45
  near(w[day], 45); near(w[day + 4], 45); near(w[day + 5], 50); assert.equal(w[3], null);
});
test("fanPosition counts lines below and above and names the nearest", () => {
  const fan = Object.fromEntries(L.FAN_KEYS.map((k, j) => [k, [null, 100 - j]])); // e2 = 100 … w200 = 88
  const p = L.fanPosition(fan, 1, 95.5); assert.equal(p.lines, 13); assert.equal(p.below, 8); assert.equal(p.above, 5); assert.deepEqual(p.nextBelow, ["e21", 95]); assert.deepEqual(p.nextAbove, ["e13", 96]); assert.equal(p.orderBull, true);
});
test("pivots carry the bar from which they are visible; supports below a reference come newest-last", () => {
  const lows = [5, 4, 3, 2, 3, 4, 5, 6, 5, 4, 3, 4, 5, 6, 7, 8, 9, 8, 7, 8, 9, 9, 9, 9, 9], highs = lows.map((x) => x + 1);
  const pv = L.pivots(highs, lows, 2); const lo = pv.filter((p) => p.type === "L"); assert.ok(lo.length >= 2); assert.equal(lo[0].known, lo[0].k + 2);
  const s = L.supportsKnown(pv, 24, 100, 3); assert.ok(s.every((x) => x.price < 100)); assert.equal(L.supportsKnown(pv, lo[0].known, 100).length, 0, "not visible until known < i");
});
test("the diagonal through the last two visible swing lows rises, its lower parallel is the diagonal shifted down by the deepest gap to a low between them, and a falling diagonal is not support", () => {
  const lows = [12, 11, 10, 11, 12, 10.2, 12, 11.5, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20]; const highs = lows.map((x) => x + 1);
  const pv = L.pivots(highs, lows, 2); const L2 = pv.filter((p) => p.type === "L" && p.known < 17).slice(-2); assert.equal(L2.length, 2);
  const d = L.diagonalKnown(pv, lows, 17); assert.ok(d, "two lows are visible"); const [a, b] = L2; near(d.slope, (b.price - a.price) / (b.k - a.k)); assert.ok(d.slope > 0);
  near(d.d1, a.price + d.slope * (17 - a.k)); let width = 0; for (let k = a.k; k <= b.k; k++) width = Math.max(width, a.price + d.slope * (k - a.k) - lows[k]); near(d.width, width); near(d.d2, d.d1 - d.width);
  const flipped = lows.map((x) => 30 - x); assert.equal(L.diagonalKnown(L.pivots(flipped.map((x) => x + 1), flipped, 2), flipped, 17), null, "a falling diagonal is not support");
});
test("depthFromHigh: percent below the highest close of the window, including today", () => {
  const c = Array(25).fill(100).concat([110, 99, 104]); const d = L.depthFromHigh(c, 252); near(d[25], 0); near(d[26], -10); near(d[27], 100 * (104 / 110 - 1));
});
test("pullback episodes: start after the high, deepest close, end at the recovery, censored when open", () => {
  const c = [100, 101, 102, 100, 98, 99, 103, 102, 101]; const e = L.pullbackEpisodes(c);
  assert.equal(e.length, 2); assert.equal(e[0].highIdx, 2); assert.equal(e[0].lowIdx, 4); near(e[0].depth, 100 * (98 / 102 - 1)); assert.equal(e[0].end, 6); assert.equal(e[0].censored, false); assert.equal(e[0].toLow, 2);
  assert.equal(e[1].censored, true); assert.equal(e[1].highIdx, 6);
});
test("conditional depth: only completed episodes that reached x count; the odds of going 5 further are counted", () => {
  const eps = [{ depth: -3, censored: false }, { depth: -9, censored: false }, { depth: -12, censored: false }, { depth: -20, censored: true }];
  const row = L.conditionalDepth(eps, [3])[0]; assert.equal(row.n, 3); near(row.finalMed, 9); near(row.pGoesOn5, 66.7, 0.06); near(row.lowWithin1, 33.3, 0.06);
});
test("triggers: one per pullback at the first close at or under the depth, re-armed only by a new high", () => {
  const c = Array(25).fill(100).concat([100, 96, 95, 97, 101, 102, 96, 99]); const t = L.triggers(c, 3, 252); assert.deepEqual(t, [26, 31]);
});
test("runCampaign: a limit fills at min(open, level) on the first touch; the trigger fills at its close; unfilled money is bought at the window's close and marked forced", () => {
  const closes = [100, 99, 97, 98, 99, 100, 101], lows = [100, 98, 95, 97, 98, 99, 100]; const b = bars(closes, { lows }); b[2].o = 96; // day 2 opens under the level
  const rungs = [{ name: "trigger", w: 0.5, fillAtClose: true, level: (i) => i === 0 }, { name: "L97", w: 0.25, level: () => 97 }, { name: "L90", w: 0.25, level: () => 90 }];
  const c = L.runCampaign(b, 0, 5, rungs); const f = Object.fromEntries(c.fills.map((x) => [x.rung, x]));
  assert.equal(f.trigger.px, 100); assert.equal(f.trigger.i, 0); assert.equal(f.L97.i, 2); assert.equal(f.L97.px, 96, "opened under the level → the open"); assert.equal(f.L90.i, 5); assert.equal(f.L90.px, 100); assert.equal(f.L90.forced, true);
  near(c.spent, 1); near(c.avgCost, 1 / (0.5 / 100 + 0.25 / 96 + 0.25 / 100)); near(c.forcedShare, 0.25); near(c.timeInMarket, (0.5 + 0.5 + 0.75 + 0.75 + 0.75 + 1) / 6);
});
test("worst mark-to-cost is the lowest value of units×close ÷ money spent; the return at h uses the average cost", () => {
  const b = bars([100, 90, 95, 120]); const fills = [{ i: 0, px: 100, w: 0.5 }, { i: 1, px: 90, w: 0.5 }];
  near(L.worstMarkToCost(b, 0, 3, fills), 100 * ((0.5 / 100 + 0.5 / 90) * 90 / 1 - 1)); near(L.campaignReturn(b, 0, 3, 95), 100 * (120 / 95 - 1)); assert.equal(L.campaignReturn(b, 0, 9, 95), null);
});
test("rung sets: every set begins with the trigger tranche, weights sum to one, and the fan set holds only lines below the trigger close", () => {
  const c = Array.from({ length: 300 }, (_, i) => 100 + i * 0.1); c[299] = 95; const b = bars(c); const fan = L.fanKnown(b), pvs = L.pivots(b.map((x) => x.h), b.map((x) => x.l), 10), rsiPct = new Array(300).fill(50);
  const sets = L.rungSets(b, 299, { fan, pvs, rsiPct });
  for (const [k, set] of Object.entries(sets)) { assert.equal(set[0].name, "trigger", k); near(set.reduce((s, r) => s + r.w, 0), 1); }
  assert.ok(sets.fan.slice(1).every((r) => fan[r.name][299] < 95)); assert.equal(sets.single.length, 1); assert.equal(sets.dca.length, 5); assert.equal(sets.rsi.length, 6);
  const st = L.stateSized(sets.fan, 100); near(st[0].w, Math.max(1 / sets.fan.length, 0.5)); near(st.reduce((s, r) => s + r.w, 0), 1); assert.deepEqual(L.stateSized(sets.fan, null), sets.fan);
});
test("nearestDays: root-mean-square percentile distance, picks kept apart, nothing after `before`", () => {
  const rows = [{ i: 0, a: 10, b: 10 }, { i: 1, a: 12, b: 12 }, { i: 50, a: 50, b: 50 }, { i: 90, a: 11, b: 11 }, { i: 100, a: 10, b: 10 }];
  const p = L.nearestDays(rows, { a: 10, b: 10 }, ["a", "b"], { k: 3, gap: 40, minGauges: 2, before: 95 }); assert.deepEqual(p.map((x) => x.i), [0, 90, 50]); near(p[1].d, 1);
});
test("pctRank half-counts ties; decileTable splits equal bins and summarises outcomes", () => {
  near(L.pctRank([1, 2, 3, 4], 2.5), 50); near(L.pctRank([1, 2, 2, 3], 2), 100 * (1 + 0.5 * 2) / 4);
  const vals = Array.from({ length: 20 }, (_, i) => i), out = { y: vals.map((v) => v - 5) }; const t = L.decileTable(vals, out, 2); assert.equal(t.length, 2); assert.equal(t[0].n, 10); near(t[1].y.med, 9.5); near(t[0].y.up, 40);
});

test("the delivered page exists, has the scnav pair, names its sources, every chart it shows is on disk, and the JSON carries the five sections", () => {
  const html = fs.readFileSync(path.join(DIR, "PULLBACK-PLAYBOOK.html"), "utf8");
  assert.ok(html.includes("<!-- scnav"), "BACK / CLOSE pair placed"); assert.ok(/sigma_day_counts/.test(html)); assert.ok(/statistician-2|Statistician 2/.test(html));
  for (const m of html.matchAll(/src="(charts\/[^"]+\.png)"/g)) assert.ok(fs.existsSync(path.join(DIR, m[1])), m[1] + " missing");
  assert.ok(html.match(/src="charts\//g).length >= 12, "at least twelve saved charts");
  const J = JSON.parse(fs.readFileSync(path.join(DIR, "data/pullback-playbook.json"), "utf8"));
  for (const k of ["s1", "s2", "s3", "s4", "s5"]) assert.ok(J[k] && Object.keys(J[k]).length, k);
  assert.equal(J.s1.bowtie.today.wing, 0.76, "today's wing cited from the sector-rotation study");
  assert.ok(Math.abs(J.s2.wing.today.wing - 0.76) < 0.02, "the replay here agrees with the sector-rotation replay");
  assert.ok(J.s4.instruments.SPY.byDepth["3"].n >= 30); for (const s of ["single", "dca", "fan", "pivots", "rsi", "all", "state"]) assert.ok(J.s4.instruments.SPY.byDepth["3"].strategies[s], s);
  assert.equal(J.s5.pce.next[0].time_utc, "12:30");
});
