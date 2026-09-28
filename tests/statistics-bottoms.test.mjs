// BOTTOMS (28 Sep) · fixture tests for the arithmetic and the delivered page.
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as B from "../research/statistics/bottoms/bottoms-lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables/20260928/bottoms");

test("own-history percentile uses earlier values only, half-counting ties, and waits for minN", () => {
  const p = B.ownPct([1, 2, 3, 4, 5, 1, 3], 3);
  assert.deepEqual(p.slice(0, 3), [null, null, null]);
  assert.equal(p[3], 100);                 // 4 vs [1,2,3]: all below
  assert.equal(p[5], 100 * 0.5 / 5);       // 1 vs [1,2,3,4,5]: one tie
  assert.equal(p[6], 100 * (3 + 0.5) / 6); // 3 vs [1,2,3,4,5,1]: 1,1,2 below, one tie
  assert.deepEqual(B.flip([10, null]), [90, null]);
});

test("swings of a series with holes come back in the original index space", () => {
  const v = []; for (let i = 0; i < 60; i++) v.push(i === 30 ? 100 : i % 7 === 3 ? null : 50 + Math.sin(i / 3));
  const sw = B.seriesSwings(v, 5);
  const top = sw.find((s) => s.type === "H" && s.price === 100);
  assert.ok(top, "the spike is a swing high"); assert.equal(top.k, 30);
  assert.equal(B.nearestTurn(sw, "H", 33, 20, 40), -3);
  assert.equal(B.nearestTurn(sw, "H", 33, 31, 40), null);
});

test("base-rate curve: hit, false alarm by episode, and lows caught", () => {
  const n = 200, lows = [50, 120], stress = new Array(n).fill(10);
  for (let i = 45; i <= 50; i++) stress[i] = 95;   // on just before the first low → hit, catches it
  for (let i = 150; i <= 152; i++) stress[i] = 95; // on with no low after → false alarm
  const c = B.baseRateCurve(stress, lows, { len: 10, thresholds: [90] });
  const r = c.rows[0];
  assert.equal(r.days, 9); assert.equal(r.episodes, 2); assert.equal(r.falseAlarm, 50);
  assert.equal(r.hit, 100 * 6 / 9); assert.equal(r.caught, 50);
  assert.ok(c.base > 0 && c.base < 20);
  const both = B.combine([[1, 5, null], [3, 2, 4]]); assert.deepEqual(both, [1, 2, null]);
});

test("review fix · lows before a series' first usable reading are left out, not counted as missed", () => {
  const n = 300, stress = new Array(n).fill(null); for (let i = 100; i < n; i++) stress[i] = i >= 195 && i <= 200 ? 95 : 10;
  const lows = [50, 200, 260];  // the low at 50 predates the series; 260 has a reading but the condition was off
  const c = B.baseRateCurve(stress, lows, { len: 10, thresholds: [90], start: B.firstIdx(stress) });
  assert.equal(B.firstIdx(stress), 100); assert.equal(c.lows, 2); assert.equal(c.rows[0].caught, 50);
  const old = B.baseRateCurve(stress, lows, { len: 10, thresholds: [90] }); assert.ok(old.rows[0].caught < 50, "counting from 0 understates it");
});

test("review fix · survival median keeps still-open stretches as lower bounds", () => {
  assert.equal(B.kmMedian([{ t: 1, ev: true }, { t: 2, ev: true }, { t: 3, ev: true }]), 2);
  // two finished early, three still open at 10: the true median is beyond the finished ones
  assert.equal(B.kmMedian([{ t: 1, ev: true }, { t: 2, ev: true }, { t: 10, ev: false }, { t: 10, ev: false }, { t: 10, ev: false }]), null);
  assert.equal(B.kmMedian([{ t: 1, ev: true }, { t: 4, ev: false }, { t: 5, ev: true }, { t: 6, ev: true }]), 5);
  const o = B.dayOutcomes([100, 95, 90, 92, 101, 99, 98, 97], [1, -2, -5, -3, 2, -1, -2, -3], [4]);
  assert.equal(o[5].censored, true); assert.equal(o[5].toReclaimLB, 2); assert.ok(Math.abs(o[5].furtherFallLB - (97 / 99 - 1) * 100) < 1e-9);
});

test("review fix · the random-walk yardstick: starting further below the average means a longer wait", () => {
  const c = Array.from({ length: 400 }, (_, i) => 100 + 10 * Math.sin(i / 25));
  const R = B.rng(5), lr = Array.from({ length: 2000 }, () => (R() - 0.5) * 0.02);
  const mk = (drop) => { const cc = c.slice(); cc[399] = cc[398] * (1 - drop); return B.simulateReclaim(cc, 399, lr, { reps: 200, block: 20, maxSteps: 3000, R: B.rng(7) }); };
  const med = (a) => B.kmMedian(a.map((z) => ({ t: z.toReclaim, ev: !z.censored })));
  const shallow = mk(0.02), deep = mk(0.25);
  assert.ok(med(deep) > med(shallow), `${med(deep)} > ${med(shallow)}`);
  assert.ok(deep.every((z) => z.furtherFall <= 0));
});

test("review fix · data faults: a ticker change or unadjusted split cuts the history; point-in-time top N", () => {
  const d = (s) => Date.parse(s + "T00:00:00Z");
  const bars = [["2022-06-06", 15], ["2022-06-07", 15.2], ["2022-06-09", 184], ["2022-06-10", 175], ["2022-08-01", 170], ["2022-08-02", 171]].map(([t, c]) => ({ t: d(t), c }));
  const f = B.dataFaults(bars); assert.deepEqual(f.map((x) => x.kind), ["jump", "hole"]);
  const T = B.trimAtFaults(bars); assert.equal(T.bars.length, 2); assert.equal(T.dropped, 4);
  assert.equal(B.trimAtFaults(bars.slice(2, 4)).dropped, 0);
  const caps = { A: [{ date: "2010-01-04", marketCap: 5 }, { date: "2011-01-03", marketCap: 1 }], B: [{ date: "2010-01-04", marketCap: 3 }, { date: "2011-01-03", marketCap: 9 }], C: [{ date: "2011-01-03", marketCap: 4 }] };
  assert.deepEqual(B.topByYear(caps, [2010, 2011], 2), { 2010: ["A", "B"], 2011: ["B", "C"] });
});

test("event-aligned paths: quartiles per offset, and % vs the anchor day", () => {
  const arr = Array.from({ length: 50 }, (_, i) => 100 + i);
  const e = B.eventAligned(arr, [10, 20], { from: -2, to: 2, rel: "pct" });
  assert.equal(e.length, 5); assert.equal(e[2].med, 0); assert.equal(e[2].n, 2);
  assert.ok(Math.abs(e[4].med - ((112 / 110 - 1) * 100 + (122 / 120 - 1) * 100) / 2) < 1e-9);
});

test("200-day outcomes: further fall until reclaim, sessions, censored stretches, next swing high", () => {
  const c = [100, 95, 90, 92, 101, 99, 98], d = [1, -2, -5, -3, 2, -1, -2];
  const o = B.dayOutcomes(c, d, [4]);
  assert.equal(o[1].toReclaim, 3); assert.ok(Math.abs(o[1].furtherFall - (90 / 95 - 1) * 100) < 1e-9);
  assert.equal(o[3].furtherFall, 0);
  assert.equal(o[5].censored, true);
  assert.ok(Math.abs(o[0].toNextHigh - 1) < 1e-9); assert.ok(Math.abs(o[0].fallBeforeHigh - -10) < 1e-9);
  assert.deepEqual(B.belowEpisodes(d), [[1, 3], [5, 6]]);
});

test("rotation test: a real link is flagged, noise is not; bootstrap bands bracket the median", () => {
  const R = B.rng(3), mk = (linked) => Array.from({ length: 4 }, () => { const x = Array.from({ length: 300 }, () => R() * 100); return { x, y: x.map((v) => (linked ? v : R() * 100) + R() * 20) }; });
  const yes = B.shiftTest(mk(true), 200, 5), no = B.shiftTest(mk(false), 200, 5);
  assert.ok(yes.rho > 0.9 && yes.p < 0.02, JSON.stringify(yes)); assert.ok(no.p > 0.02, JSON.stringify(no));
  assert.equal(B.spearman([1, 2, 3, 4], [10, 20, 30, 45]), 1);
  const items = Array.from({ length: 400 }, (_, i) => ({ x: (i % 100) + 0.5, y: i % 100, ep: "e" + Math.floor(i / 20) }));
  const b1 = B.binnedBootstrap(items, { w: 25, reps: 60, seed: 9 }), b2 = B.binnedBootstrap(items, { w: 25, reps: 60, seed: 9 });
  assert.deepEqual(b1, b2); assert.equal(b1.length, 4);
  for (const b of b1) assert.ok(b.bandLo <= b.med && b.med <= b.bandHi);
});

test("cross-section: up/down counts, share above the 50-day, dispersion, swing participation", () => {
  const dates = ["d0", "d1", "d2"], mk = (c, s50) => ({ dates, c, s50, s200: [null, null, null], idx: new Map(dates.map((d, i) => [d, i])) });
  const I = [mk([10, 11, 12], [null, 10, 13]), mk([10, 9, 9], [null, 10, 8]), mk([10, 10.5, 11], [null, 11, 10])];
  const X = B.crossSection(I);
  assert.equal(X.get("d1").up, 2); assert.equal(X.get("d1").down, 1); assert.equal(X.get("d1").above50, 1);
  assert.equal(X.get("d2").above50, 2); assert.equal(X.get("d2").n, 3);
  assert.ok(B.iqr([1, 2, 3, 4, 5]) === 2);
  assert.deepEqual(B.legShare(I, "d0", "d2", 1), { n: 3, share: 100 * 2 / 3 });
});

test("the delivered page: every chart it shows is a saved file, the data is there, the nav pair is placed", () => {
  const html = fs.readFileSync(path.join(DIR, "BOTTOMS.html"), "utf8");
  const imgs = [...html.matchAll(/<img src="(charts\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(imgs.length >= 30, `charts shown: ${imgs.length}`);
  for (const f of imgs) assert.ok(fs.existsSync(path.join(DIR, f)), f + " is saved");
  assert.match(html, /data-scnav-slot/); assert.match(html, /<!-- scnav · /); assert.equal(html.split("</body>").length, 2);
  for (const w of ["What could be wrong", "What was not done", "Where each number comes from"]) assert.ok(html.includes(w), w);
  const J = JSON.parse(fs.readFileSync(path.join(DIR, "data/bottoms.json"), "utf8"));
  for (const s of ["SPY", "QQQ", "IWM"]) { assert.ok(J.part1[s].nLows > 50); assert.ok(J.part1[s].lows.every((r) => r.date && r.vixTurn !== undefined)); }
  assert.equal(J.caps.top20.length, 20); assert.ok(J.part2.groups.pooled.furtherFall.bins.length > 5); assert.equal(J.part3.universe.served, 486);
  // review fixes are in the data: no-data kept apart, shared lows, point-in-time top 20, random-walk yardstick, META repaired
  const t = J.part1.SPY.summary.all.turns.credit; assert.equal(t.withData + t.noData, t.n); assert.ok(t.noData > 0);
  assert.ok(J.part1.SPY.common.curves.vix.lows === J.part1.SPY.common.curves.credit.lows);
  assert.ok(J.part2.groups.stocks.furtherFall.sim.bins.length > 5 && J.part2.groups.pooled.toReclaim.excess.n > 1000);
  assert.ok(Object.keys(J.part2.pit.years).length >= 20 && J.part2.pit.years["2008"].includes("XOM"));
  assert.equal(J.part2.per.META.from, "2012-05-18"); assert.ok(J.faults.WM && !J.faults.SPY);
});

test("chart colours: greys only (channels within 24, none above 210) plus the up green and down red", () => {
  const ok = (hex) => { if (hex === "#00FFA3" || hex === "#FF2D55") return true; const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210; };
  for (const f of fs.readdirSync(path.join(DIR, "charts"))) {
    const svg = fs.readFileSync(path.join(DIR, "charts", f), "utf8");
    for (const [hex] of svg.matchAll(/#[0-9A-Fa-f]{6}\b/g)) assert.ok(ok(hex.toUpperCase()), `${f}: ${hex}`);
    assert.ok(!/stroke="#(8A8A9E|9C9CAE|C8C8D2)"[^>]*stroke-dasharray|<polyline[^>]*stroke="#(?!00FFA3|FF2D55)/.test(svg), `${f}: a data line that is not green/red`);
  }
});
