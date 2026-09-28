import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { ladder, percentileOf, rungOf, expandingPercentile, runs, fwd, worstAhead, maxFinder, kaplanMeier, kmDoneBy, spearman, clusterBand, recoverTimes, pullbacks, pullbackSummary, rng, analyse } from "../research/statistics/rsi-ladder.mjs";
import { rungSummary, vsAnyDay, mv, build } from "../research/statistics/rsi-ladder-page.mjs";
import { signLine, COL } from "../research/statistics/rsi-ladder-charts.mjs";

const here = path.dirname(fileURLToPath(import.meta.url)), root = path.resolve(here, "..");
const DIR = path.join(root, "deliverables/20260928/rsi-ladder");

test("ladder gives the RSI at every percentile 0..100", () => {
  const v = Array.from({ length: 101 }, (_, i) => i + 1);           // 1..101
  const L = ladder([null, ...v.slice().reverse()]);
  assert.equal(L.n, 101); assert.equal(L.v.length, 101);
  assert.equal(L.v[0], 1); assert.equal(L.v[1], 2); assert.equal(L.v[50], 51); assert.equal(L.v[100], 101);
});

test("percentile, rung and the no-hindsight (expanding) percentile", () => {
  const s = [10, 20, 30, 40];
  assert.equal(percentileOf(s, 5), 0); assert.equal(percentileOf(s, 20), 37.5); assert.equal(percentileOf(s, 50), 100);
  assert.equal(rungOf(0), 1); assert.equal(rungOf(1), 1); assert.equal(rungOf(1.01), 2); assert.equal(rungOf(100), 100);
  const own = expandingPercentile([10, 20, 30, 40, 25, null, 5], 3);
  assert.deepEqual(own.slice(0, 3), [null, null, null]);             // fewer than 3 earlier readings
  assert.equal(own[3], 100);                                          // 40 against [10,20,30]
  assert.equal(own[4], 50);                                           // 25 against [10,20,30,40]
  assert.equal(own[5], null); assert.equal(own[6], 0);               // 5 is below every earlier reading
});

test("visits are runs of consecutive days, no merging", () => {
  const x = [1, 1, 0, 1, null, 1, 0, 0, 1];
  const R = runs((i) => x[i] == null ? null : x[i] === 1, x.length);
  assert.deepEqual(R.map((r) => [r.start, r.last]), [[0, 1], [3, 3], [5, 5], [8, 8]]);
});

test("forward change and worst close ahead, percent and basis points", () => {
  const c = [100, 110, 90, 120];
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(fwd(c, 0, 1), 10); near(fwd(c, 0, 3), 20); assert.equal(fwd(c, 2, 5), null);
  near(worstAhead(c, 0, 3), -10);
  near(fwd([4.0, 4.25], 0, 1, "bp"), 25);
  assert.equal(fwd([10, -5], 0, 1), null);                            // through a negative close: skipped
});

test("maxFinder matches a brute-force scan", () => {
  const R = rng(7), a = Array.from({ length: 700 }, () => Math.round(R() * 1000));
  const f = maxFinder(a);
  for (let t = 0; t < 400; t++) {
    const from = Math.floor(R() * 720), level = Math.round(R() * 1000);
    let want = -1; for (let j = Math.max(0, from); j < a.length; j++) if (a[j] > level) { want = j; break; }
    assert.equal(f(from, level), want, `from ${from} level ${level}`);
  }
});

test("Kaplan–Meier median counts the still-waiting cases", () => {
  const K = kaplanMeier([{ t: 1, done: true }, { t: 2, done: true }, { t: 3, done: false }, { t: 4, done: true }]);
  assert.equal(K.median, 2); assert.equal(K.open, 1); assert.equal(K.done, 3);
  assert.equal(kmDoneBy(K.steps, 1), 0.25); assert.equal(kmDoneBy(K.steps, 4), 1);
  // all still waiting → no median
  assert.equal(kaplanMeier([{ t: 5, done: false }, { t: 9, done: false }]).median, null);
});

test("Spearman rank correlation", () => {
  assert.equal(spearman([1, 2, 3, 4], [10, 20, 30, 40]), 1);
  assert.equal(spearman([1, 2, 3, 4], [9, 7, 5, 1]), -1);
  assert.equal(spearman([1, 2], [1, 2]), null);
});

test("cluster bootstrap bands are reproducible and need two clusters", () => {
  const recs = []; for (let m = 0; m < 12; m++) for (let d = 0; d < 5; d++) recs.push({ cluster: "2020-" + m, x: m - 5 + d * 0.1 });
  const a = clusterBand(recs, ["x"], ["x"], 300, 11), b = clusterBand(recs, ["x"], ["x"], 300, 11);
  assert.deepEqual(a, b); assert.equal(a.clusters, 12);
  assert.ok(a["m:x"][0] < a["m:x"][1]); assert.ok(a["u:x"][0] <= a["u:x"][1]);
  assert.equal(clusterBand([{ cluster: "a", x: 1 }, { cluster: "a", x: 2 }], ["x"], [], 50)["m:x"], undefined);
});

/* a synthetic zigzag: up 30 bars, down 30, up 45 (beats the first top), down 30, up 20 (does not) */
function zig() {
  const c = []; let p = 100;
  const leg = (n, step) => { for (let i = 0; i < n; i++) { p += step; c.push(p); } };
  leg(30, 1); leg(30, -1); leg(45, 1); leg(30, -1.2); leg(20, 0.5);
  return { c, h: c.map((x) => x + 0.2), l: c.map((x) => x - 0.2), dates: c.map((_, i) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10)), rsi: c.map(() => 50) };
}
test("pullbacks: depth, new high, rallies needed, and still-open ones kept", () => {
  const S = zig(), P = pullbacks(S, "pct", 10);
  assert.equal(P.length, 2);
  const [a, b] = P;
  assert.equal(a.top, S.dates[29]); assert.equal(a.low, S.dates[59]);
  assert.ok(Math.abs(a.depth - ((100 + 30 - 30 - 0.2) / (100 + 30 + 0.2) - 1) * 100) < 0.01);
  assert.equal(a.done, true); assert.equal(a.legs, 1); assert.equal(a.nextLeg, true);
  assert.equal(S.h[59 + a.lowToNew] > a.topPrice, true); assert.equal(S.h[59 + a.lowToNew - 1] > a.topPrice, false);
  assert.equal(b.done, false); assert.equal(b.newHigh, null); assert.equal(b.lowToNew, S.c.length - 1 - 134);
  assert.equal(a.depthRank < b.depthRank, true);                     // the second fall is deeper
  const sum = pullbackSummary(P); assert.equal(sum.n, 2); assert.equal(sum.open, 1); assert.equal(sum.everNewHigh, 50);
});

test("wait back above the prior swing high uses only pivots already confirmed", () => {
  const S = zig(), R = recoverTimes(S, 10);
  assert.equal(R[35], null);                                          // top at 29 is only known at 39
  assert.equal(R[45].done, true);                                     // back above it during the next rally
  const k = 45 + R[45].t; assert.ok(S.h[k] > S.h[29] && S.h[k - 1] <= S.h[29]);
  assert.equal(R[S.c.length - 1].done, false);                        // the last fall is still under its top
});

test("analyse on a small series: 100 rungs, ladders, visits, outcomes with bands", () => {
  const R = rng(3), bars = []; let p = 100; const t0 = Date.UTC(2010, 0, 4);
  for (let i = 0; i < 900; i++) { p *= 1 + (R() - 0.48) * 0.03; bars.push(p); }
  const S = { c: bars, h: bars.map((x) => x * 1.004), l: bars.map((x) => x * 0.996), dates: bars.map((_, i) => new Date(t0 + i * 864e5).toISOString().slice(0, 10)) };
  S.rsi = (() => { const out = new Array(bars.length).fill(null); let up = 0, dn = 0; for (let i = 1; i <= 14; i++) { const d = bars[i] - bars[i - 1]; if (d > 0) up += d; else dn -= d; } up /= 14; dn /= 14; for (let i = 15; i < bars.length; i++) { const d = bars[i] - bars[i - 1]; up = (up * 13 + Math.max(d, 0)) / 14; dn = (dn * 13 + Math.max(-d, 0)) / 14; if (i >= 100) out[i] = 100 - 100 / (1 + up / dn); } return out; })();
  const A = analyse(S, { key: "T", name: "Test", short: "T", group: "g", calendar: true }, { reps: 50 });
  assert.equal(A.byRung.length, 100); assert.equal(A.ladder.full.length, 101); assert.equal(A.visits.length, 100);
  assert.equal(A.byRung.reduce((s, r) => s + r.n, 0), A.base.n);    // every counted day sits on exactly one rung
  for (let q = 1; q <= 100; q++) assert.ok(A.ladder.full[q] >= A.ladder.full[q - 1]);
  assert.ok(A.visits[99].visits >= 1 && A.visits[0].visits >= 1);
});

test("page helpers: moves are green up / red down; band vs any day", () => {
  assert.match(mv(1.234), /class="up">\+1\.2%/); assert.match(mv(-0.5), /class="dn">-0\.5%/);
  assert.equal(vsAnyDay([1, 2], 0.5), "above"); assert.equal(vsAnyDay([1, 2], 3), "below"); assert.equal(vsAnyDay([1, 2], 1.5), "inside"); assert.equal(vsAnyDay(null, 1), null);
});

test("sign lines are only ever green or red, cut exactly at the pivot", () => {
  const svg = signLine([[0, 40], [1, 60], [2, 45]], (x) => x * 10, (y) => y, 50);
  const strokes = [...svg.matchAll(/stroke="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(strokes, [COL.dn, COL.up, COL.dn]);
  assert.match(svg, /5\.0,50\.0/);                                    // crossing at x=0.5 → 5.0
});

test("the deliverable: page, data and every chart file are there; no grey series lines", { skip: !fs.existsSync(path.join(DIR, "rsi-ladder.json")) }, () => {
  const d = JSON.parse(fs.readFileSync(path.join(DIR, "rsi-ladder.json"), "utf8"));
  const html = fs.readFileSync(path.join(DIR, "index.html"), "utf8");
  const keys = Object.keys(d.instruments);
  assert.equal(keys.length, 26);
  for (const k of keys) { assert.ok(!d.instruments[k].missing, k); assert.ok(html.includes(d.instruments[k].name.replace(/&/g, "&amp;")), k); }
  assert.doesNotMatch(html, /NaN|undefined|\[object Object\]/);
  assert.match(html, /data-scnav-slot/);
  const refs = [...html.matchAll(/src="(charts\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(refs.length > 150);
  for (const r of refs) assert.ok(fs.existsSync(path.join(DIR, r)), r);
  // colours: every hex is a quiet grey (channels within 24, none above 210) or the up/down pair
  const grey = (h) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210; };
  const ok = (h) => h.length === 7 && (grey(h) || h === COL.up || h === COL.dn);
  const pageCss = html.slice(0, html.indexOf("</style>"));
  for (const m of pageCss.matchAll(/#[0-9A-Fa-f]{6}\b/g)) assert.ok(ok(m[0].toUpperCase()), m[0]);
  for (const f of fs.readdirSync(path.join(DIR, "charts")).slice(0, 60)) {
    const svg = fs.readFileSync(path.join(DIR, "charts", f), "utf8");
    for (const m of svg.matchAll(/#[0-9A-Fa-f]{6}\b/g)) assert.ok(ok(m[0].toUpperCase()), `${f} ${m[0]}`);
    for (const m of svg.matchAll(/<(polyline|circle)[^>]*>/g)) { const c = m[0].match(/(?:stroke|fill)="(#[0-9A-Fa-f]{6})"/g).map((x) => x.slice(-8, -1)).filter((x) => x !== "#0B0B12"); for (const x of c) assert.ok([COL.up, COL.dn].includes(x), `${f}: grey series ${x}`); }
  }
  // numbers on the page come from the data: SPY's rung-1 RSI and pullback count
  assert.ok(html.includes(`RSI of <b>${d.instruments.SPY.ladder.full[1].toFixed(1)}</b>`));
  assert.ok(html.includes(`<b>${d.instruments.SPY.pull.n - d.instruments.SPY.pull.open} of ${d.instruments.SPY.pull.n}</b>`));
  assert.equal(rungSummary(d.instruments.SPY, "f20", "f20").rungs, 100);
  assert.equal(typeof build(d), "string");
});
