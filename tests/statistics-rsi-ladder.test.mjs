import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import { ladder, percentileOf, rungOf, expandingPercentile, runs, fwd, worstAhead, maxFinder, kaplanMeier, kmDoneBy, spearman, clusterBand, recoverTimes, pullbacks, pullbackSummary, rng, analyse, recordDeclines, slopeBand } from "../research/statistics/rsi-ladder.mjs";
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

/* a bear market in steps: record at 30, lower rally top at 90, new record only at the very end */
function bear() {
  const c = []; let p = 100;
  const leg = (n, step) => { for (let i = 0; i < n; i++) { p += step; c.push(p); } };
  leg(30, 1); leg(30, -1); leg(30, 0.5); leg(30, -1); leg(60, 1);
  return { c, h: c.map((x) => x + 0.2), l: c.map((x) => x - 0.2), dates: c.map((_, i) => new Date(Date.UTC(2020, 0, 1) + i * 864e5).toISOString().slice(0, 10)), rsi: c.map(() => 50) };
}
test("swing pullbacks flag a top that sits below an earlier top (not a record)", () => {
  const S = bear(), P = pullbacks(S, "pct", 10);
  assert.equal(P.length, 2);
  assert.equal(P[0].fromRecord, true); assert.equal(P[1].fromRecord, false);
  assert.ok(P[1].recordThen > P[1].topPrice);                        // the record in force was higher
  assert.equal(P[1].done, true);                                      // "back above its top" happens well before a new record
  const firstRecord = S.h.findIndex((x, i) => i > 30 && x > S.h[29]);
  assert.ok(Date.parse(P[1].newHigh) < Date.parse(S.dates[firstRecord]));
});

test("record declines: one decline per record-to-record gap, whole bear market in one, open one kept", () => {
  const S = bear(), R = recordDeclines(S, "pct");
  const big = [...R].sort((a, b) => a.depth - b.depth)[0];
  assert.equal(big.top, S.dates[29]); assert.equal(big.low, S.dates[119]);   // the second, lower low — not the first swing low
  assert.ok(Math.abs(big.depth - (S.l[119] / S.h[29] - 1) * 100) < 0.01);
  assert.equal(big.done, true); assert.ok(S.h[119 + big.lowToNew] > S.h[29] && S.h[119 + big.lowToNew - 1] <= S.h[29]);
  // every record-to-record gap in the rising legs is too small to exist (each bar makes a new record)
  assert.equal(R.length, 1);
  // a series ending under its record keeps the open decline
  const Z = zig(), RZ = recordDeclines(Z, "pct"), last = RZ.at(-1);
  assert.equal(last.done, false); assert.equal(last.newRecord, null); assert.equal(last.topToNew, Z.c.length - 1 - 104);
  const sum = pullbackSummary(RZ); assert.equal(sum.open, 1);
  // yields: basis points
  const Y = { c: [4, 4.5, 4.1, 4.6], h: [4, 4.5, 4.1, 4.6], l: [4, 4.5, 3.9, 4.6], dates: ["2020-01-01", "2020-01-02", "2020-01-03", "2020-01-04"], rsi: [50, 50, 50, 50] };
  assert.equal(Math.round(recordDeclines(Y, "bp")[0].depth), -60);
});

test("slope band: point correlation with a quarter-resampled range, reproducible", () => {
  const R = rng(5), days = [];
  for (let i = 0; i < 4000; i++) { const rung = 1 + Math.floor(R() * 100), q = "Q" + Math.floor(i / 60); days.push({ rung, quarter: q, f20: -0.05 * rung + (R() - 0.5) * 4, w60: (R() - 0.5) }); }
  const a = slopeBand(days, ["f20", "w60"], 200, 9), b = slopeBand(days, ["f20", "w60"], 200, 9);
  assert.deepEqual(a, b);
  assert.ok(a.f20.rho < -0.5 && a.f20.band[1] < 0, JSON.stringify(a.f20));   // a real slope: range stays below zero
  assert.ok(a.w60.band[0] < 0 && a.w60.band[1] > 0, JSON.stringify(a.w60)); // no slope: range crosses zero
  assert.equal(a.clusters, Math.ceil(4000 / 60));
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
  // review fixes (28 Sep): no overclaims
  assert.doesNotMatch(html, /The one record that matches Bitcoin's floor/);
  assert.doesNotMatch(html, /deepest tenth within/);
  assert.doesNotMatch(html, /The deeper the RSI, the deeper the next dip first/);
  assert.match(html, /back above the top it fell from/i);
  assert.match(html, /Every decline from a record high/);
  for (const k of keys) { const A = d.instruments[k]; assert.ok(A.records.length >= 1 && A.rec.n === A.records.length, k); assert.ok(A.slope.f20.band, k); assert.ok(A.pull.fromRecord + A.pull.belowEarlierTop === A.pull.n, k); }
  // Bitcoin sentence names every instrument whose bottom rung is at or below Bitcoin's
  const btc1 = d.instruments.BTCUSD.ladder.full[1];
  for (const k of keys) if (k !== "BTCUSD" && d.instruments[k].ladder.full[1] <= btc1) assert.ok(html.includes(`${d.instruments[k].short.replace(/&/g, "&amp;")} ${d.instruments[k].ladder.full[1].toFixed(1)}`), k);
  // chart titles and subtitles fit their panel (mono ≈ 0.61 × font size per character)
  for (const f of fs.readdirSync(path.join(DIR, "charts"))) {
    const svg = fs.readFileSync(path.join(DIR, "charts", f), "utf8"), W = +svg.match(/viewBox="0 0 (\d+)/)[1];
    for (const m of svg.matchAll(/<text x="([\d.]+)" y="(?:26|30|48|56|76)" font-size="(\d+)"[^>]*>([^<]*)<\/text>/g)) {
      const txt = m[3].replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");
      assert.ok(+m[1] + txt.length * +m[2] * 0.61 <= W, `${f}: "${txt.slice(0, 50)}…" runs off the panel`);
    }
  }
  for (const f of ["slope-f20.svg", "slope-f60.svg", "slope-w60.svg", "record-SPY-scatter.svg", "record-SPX-scatter.svg"]) assert.ok(fs.existsSync(path.join(DIR, "charts", f)), f);
  assert.equal(typeof build(d), "string");
});
