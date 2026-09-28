// U2 · sector rotation (28 Sep). Fixture tests for the arithmetic in research/statistics/sector-rotation/lib.mjs,
// the replay against the live Geiger, and the deliverable's shape and look rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { pctOf, rankNorm, runLengths, bucket3D, bucketW, rollUp, geigerHistory, rsH, rrg, quadrantStats, tierOf, transitions,
  bowTie, blockBootstrap, spearman, quantile } from "../research/statistics/sector-rotation/lib.mjs";
import { FAMILIES, SECTORS } from "../research/statistics/sector-rotation/universe.mjs";

const T = (d) => Date.parse(d + "T04:00:00Z");
const DIR = new URL("../deliverables/20260928/sector-rotation/", import.meta.url);

test("own-history percentile runs 1..100 with mid-rank ties", () => {
  const h = Array.from({ length: 100 }, (_, i) => i + 1);
  assert.equal(pctOf(h, 1), 1);
  assert.equal(pctOf(h, 100), 100);
  assert.equal(pctOf(h, 50), 50);
  assert.equal(pctOf(h, 1000), 100);
  assert.equal(pctOf(h, -5), 1);
  assert.equal(pctOf([1, 1, 1, 1], 1), 50);
  assert.equal(pctOf(h, null), null);
});

test("ranks normalise to 0..1, ties share, nulls stay null", () => {
  assert.deepEqual(rankNorm([3, 1, 2]), [1, 0, 0.5]);
  assert.deepEqual(rankNorm([1, 1, 3, null]), [0.25, 0.25, 1, null]);
  assert.equal(tierOf(1), "TOP"); assert.equal(tierOf(0), "BOTTOM"); assert.equal(tierOf(0.5), "MID");
  assert.equal(Math.round(spearman([1, 2, 3, 4], [10, 20, 30, 40]) * 1000) / 1000, 1);
  assert.equal(Math.round(spearman([1, 2, 3, 4], [4, 3, 2, 1]) * 1000) / 1000, -1);
});

test("run lengths keep the open run apart (censored)", () => {
  assert.deepEqual(runLengths([true, true, false, true, null, true, true, true]), { done: [2, 1], open: 3 });
  assert.deepEqual(runLengths([false, false]), { done: [], open: null });
});

test("3-day buckets match the chart API's served 3D starts (…09-15, 09-18, 09-21, 09-24 2026)", () => {
  for (const s of ["2026-09-15", "2026-09-18", "2026-09-21", "2026-09-24"]) {
    assert.notEqual(bucket3D(T(s)), bucket3D(T(s) - 864e5), s + " starts a bucket");
  }
  assert.equal(bucket3D(T("2026-09-24")), bucket3D(T("2026-09-26")));
  // a 05:00Z (winter) stamp lands on the same calendar day as a 04:00Z one
  assert.equal(bucket3D(Date.parse("2024-12-02T05:00:00Z")), bucket3D(Date.parse("2024-12-02T04:00:00Z")));
});

test("weeks are Sunday-anchored like the served W bars", () => {
  assert.equal(bucketW(T("2026-09-20")), bucketW(T("2026-09-26")));   // Sun … Sat
  assert.notEqual(bucketW(T("2026-09-19")), bucketW(T("2026-09-20")));
  const r = rollUp([{ t: T("2026-09-21"), o: 1, h: 3, l: 1, c: 2 }, { t: T("2026-09-25"), o: 2, h: 5, l: 0.5, c: 4 }, { t: T("2026-09-28"), o: 4, h: 4, l: 4, c: 4 }], bucketW);
  assert.equal(r.length, 2);
  assert.deepEqual({ o: r[0].o, h: r[0].h, l: r[0].l, c: r[0].c }, { o: 1, h: 5, l: 0.5, c: 4 });
});

test("the replay reproduces the live /geiger 1d, 3d and 1w rungs for XLK (fixture, 25 Sep close)", () => {
  const F = JSON.parse(fs.readFileSync(new URL("./fixtures/sector-rotation-xlk.json", import.meta.url), "utf8"));
  const nextT = F.bars.map((b, i) => i + 1 < F.bars.length ? F.bars[i + 1].t : T(F.asof));
  const g = geigerHistory(F.bars, nextT).at(-1);
  assert.ok(Math.abs(g.d1 - F.live["1d"]) < 1e-4, `1d ${g.d1} vs ${F.live["1d"]}`);
  assert.ok(Math.abs(g.d3 - F.live["3d"]) < 1e-4, `3d ${g.d3} vs ${F.live["3d"]}`);
  assert.ok(Math.abs(g.w1 - F.live["1w"]) < 1e-4, `1w ${g.w1} vs ${F.live["1w"]}`);
  assert.equal(g.full, true);
  // no reading before a full 230-bar daily window
  assert.equal(geigerHistory(F.bars.slice(0, 200), nextT.slice(0, 200)).filter(Boolean).length, 0);
});

test("the weekly rung never reads a week that has not ended (no look-ahead)", () => {
  const F = JSON.parse(fs.readFileSync(new URL("./fixtures/sector-rotation-xlk.json", import.meta.url), "utf8"));
  const bars = F.bars.slice(0, 1200), nextT = bars.map((b, i) => i + 1 < bars.length ? bars[i + 1].t : bars[i].t + 3 * 864e5);
  const full = geigerHistory(bars, nextT);
  // cut the series at a Wednesday: the Wednesday reading must equal the one made with the rest of the week removed
  const k = bars.findIndex((b, i) => i > 900 && new Date(b.t).getUTCDay() === 3);
  const cut = geigerHistory(bars.slice(0, k + 1), nextT.slice(0, k + 1));
  assert.deepEqual(cut[k], full[k]);
});

test("relative strength is log return minus the benchmark's", () => {
  const a = [100, 110, 121], b = [100, 100, 110];
  const r = rsH(a, b, 1);
  assert.equal(r[0], null);
  assert.ok(Math.abs(r[1] - 100 * Math.log(1.1)) < 1e-9);
  assert.ok(Math.abs(r[2] - (100 * Math.log(1.1) - 100 * Math.log(1.1))) < 1e-9);
});

test("a sector that outperforms, stalls, underperforms and recovers walks the RRG wheel clockwise", () => {
  const b = Array(400).fill(100), a = [], rel = [];
  let x = 0; for (let i = 0; i < 400; i++) { x += 0.5 * Math.sin((2 * Math.PI * i) / 120); rel.push(x); a.push(100 * Math.exp(x / 100)); }
  const R = rrg(a, b, 20), st = quadrantStats(R.q);
  assert.ok(st.moves.cw > st.moves.ccw, JSON.stringify(st.moves));
  assert.equal(R.q.slice(0, 40).every((q) => q == null), true, "warm-up of 2h stays empty");
});

test("transitions pool every sector and sum to 1 per starting tier", () => {
  const rows = [["TOP", "MID", "BOTTOM"], ["BOTTOM", "MID", "TOP"], ["TOP", "MID", "BOTTOM"]];
  const P = transitions(rows, 1);
  assert.equal(P.TOP.BOTTOM, 1); assert.equal(P.BOTTOM.TOP, 1); assert.equal(P.MID.MID, 1);
  for (const a of ["TOP", "MID", "BOTTOM"]) assert.ok(Math.abs(P[a].TOP + P[a].MID + P[a].BOTTOM - 1) < 1e-12);
});

test("bow tie: the shorter wing needs both a green and a red wing", () => {
  const tie = bowTie([0.8, 0.5, 0.1, 0, -0.1, -0.2, -0.6, -0.7]);
  assert.equal(tie.wing, 0.7); assert.ok(Math.abs(tie.spread - 1.5) < 1e-12); assert.equal(tie.balance, 3 / 8);
  assert.ok(bowTie([0.9, 0.8, 0.7, 0.6, 0.5]).wing < 0, "all green is one-sided");
  assert.equal(bowTie([0.1, null, -0.1]), null, "fewer than five funds is not a strip");
});

test("block bootstrap is reproducible and centred on a constant series", () => {
  const xs = Array(200).fill(2);
  const b = blockBootstrap(xs.length, 10, (ix) => ix.reduce((s, i) => s + xs[i], 0) / ix.length, 200);
  assert.deepEqual([b.lo, b.mid, b.hi], [2, 2, 2]);
  const ys = Array.from({ length: 300 }, (_, i) => Math.sin(i));
  const s = (ix) => ix.reduce((a, i) => a + ys[i], 0) / ix.length;
  assert.deepEqual(blockBootstrap(300, 16, s, 100), blockBootstrap(300, 16, s, 100));
  assert.ok(quantile([1, 2, 3, 4], 0.5) === 2.5);
});

test("the fund universe matches the Hub's sector families, column for column", () => {
  const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const famSrc = src.match(/var SECT_FAMILY_FUNDS=\{([\s\S]*?)\};/)[1];
  const hub = Object.fromEntries([...famSrc.matchAll(/(\w+):\s*\[([^\]]+)\]/g)].map((m) => [m[1], m[2].match(/[A-Z]+/g)]));
  assert.deepEqual(FAMILIES, hub);
  assert.equal(SECTORS.length, 11);
});

test("the deliverable: JSON, nine saved charts, plain page with the way back and no buy calls", () => {
  const J = JSON.parse(fs.readFileSync(new URL("sector-rotation.json", DIR), "utf8"));
  assert.deepEqual(J.horizons.chosen, { short: 16, medium: 72, long: 646 });
  for (const k of ["relativeStrength", "rrg", "capVsEqual", "geiger"]) assert.ok(J[k], k);
  assert.deepEqual(J.geiger.replayCheck.maxAbsDiff, { "1d": 0, "3d": 0, "1w": 0 });
  assert.ok(J.geiger.today.wingPct >= 1 && J.geiger.today.wingPct <= 100);
  const html = fs.readFileSync(new URL("SECTOR-ROTATION.html", DIR), "utf8");
  const imgs = [...html.matchAll(/<img class="chart" src="([^"]+)"/g)].map((m) => m[1]);
  assert.equal(new Set(imgs).size, 9);
  for (const f of imgs) assert.ok(fs.statSync(new URL(f, DIR)).size > 10000, f);
  assert.match(html, /<!-- scnav · /, "the grey BACK / CLOSE pair");
  assert.match(html, /no buy or sell calls/i);
  assert.doesNotMatch(html, /\b(you should|we recommend|buy now|sell now)\b/i);
  assert.doesNotMatch(html, /undefined|NaN/);
});

test("the page's own colours keep the look rules: greys within 24 per channel and at most 210, colour only for direction", () => {
  const html = fs.readFileSync(new URL("SECTOR-ROTATION.html", DIR), "utf8");
  const css = html.slice(html.indexOf("<style>"), html.indexOf("</style>"));
  const hexes = [...new Set([...css.matchAll(/#([0-9A-Fa-f]{6})\b/g)].map((m) => m[1].toUpperCase()))];
  for (const h of hexes) {
    if (h === "00FFA3" || h === "FF2D55") continue;   // bull / bear
    const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, "#" + h);
  }
});
