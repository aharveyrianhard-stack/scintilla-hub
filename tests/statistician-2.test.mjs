/* STATISTICIAN-2 (28 Sep) · fixture tests for the arithmetic (research/statistics/statistician-2/lib.mjs) and the delivered page. */
import test from "node:test"; import assert from "node:assert/strict";
import fs from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
import * as X from "../research/statistics/statistician-2/lib.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables/20260928/statistician-2");

test("runs of flags: first and last day of each run", () => { assert.deepEqual(X.runsOf([0, 1, 1, 0, 1, 0, 0, 1]), [{ s: 1, e: 2 }, { s: 4, e: 4 }, { s: 7, e: 7 }]); assert.deepEqual(X.runsOf([]), []); });
test("RSI profile: share of days at or below a level, visits per year, and the percentile ladder", () => {
  const dates = []; const d0 = Date.parse("2010-01-01T00:00:00Z"); for (let i = 0; i < 1000; i++) dates.push(new Date(d0 + i * 864e5).toISOString().slice(0, 10));
  const rsi = dates.map((_, i) => 20 + (i % 100) * 0.6);            // a saw from 20 to 79.4, ten times
  const p = X.rsiProfile(rsi, dates);
  const f28 = p.floors.find((f) => f.L === 28); const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`); near(f28.days, 100 * 14 * 10 / 1000);   // 14 values per cycle ≤ 28 (20..27.8)
  near(f28.perYear, 10 / (999 / 365.25)); assert.equal(f28.len, 14);
  assert.ok(Math.abs(p.ladder[50] - 49.7) < 0.5); assert.equal(p.min, 20);
  assert.equal(X.rsiProfile(rsi.slice(0, 100), dates.slice(0, 100)), null, "needs 250 readings");
});
test("Kaplan–Meier keeps the censored wait in the count and steps down only on events", () => {
  const km = X.kaplanMeier([{ t: 3, ev: true }, { t: 5, ev: true }, { t: 7, ev: false }, { t: 9, ev: true }]);
  assert.deepEqual(km.steps, [[0, 1], [3, 0.75], [5, 0.5], [9, 0]]); assert.equal(km.median, 5); assert.equal(km.censored, 1);
});
test("partial Spearman removes the shared driver", () => {
  const z = Array.from({ length: 200 }, (_, i) => i), rng = X.mulberry32(5);
  const y = z.map((v) => v + 40 * rng()), x = z.map((v) => v + 40 * rng());   // x and y both follow z, not each other
  assert.ok(X.spearman(x, y) > 0.8, "plain rank link is strong"); assert.ok(Math.abs(X.partialSpearman(x, y, z)) < 0.25, "with z held, little is left");
  const res = X.rankResidual(y, z); assert.ok(Math.abs(res.reduce((s, v) => s + v, 0)) < 1e-6, "residual ranks sum to zero");
});
test("episode bootstrap brackets the estimate and reports a two-sided p against the base", () => {
  const rows = Array.from({ length: 80 }, (_, i) => (i % 4 === 0 ? -1 : 1));
  const b = X.episodeBootstrap(rows, (rs) => X.mean(rs), { reps: 400, seed: 2, base: 0 });
  assert.ok(b.lo <= b.est && b.est <= b.hi && b.p < 0.05);
  const c = X.blockBootstrap(rows, (rs) => X.mean(rs), { reps: 400, seed: 2, block: 4, base: 0.5 }); assert.ok(c.lo <= c.hi && c.p >= 0 && c.p <= 1);
});
test("status word follows the standard: a list under 20, luck-proof needs the adjusted p", () => {
  assert.equal(X.statusWord(10, 0.001, 0.001), "a list"); assert.equal(X.statusWord(50, 0.01, 0.05), "luck-proof"); assert.equal(X.statusWord(50, 0.05, 0.3), "leaning"); assert.equal(X.statusWord(50, 0.5, 0.9), "not shown"); assert.equal(X.statusWord(50, null, null), "no data");
});
test("forward outcomes: return, deepest close ahead, first bar above a level, run lengths, slope", () => {
  const c = [100, 102, 98, 95, 99, 104, 101], h = c.map((x) => x + 1);
  const near = (a, b) => assert.ok(Math.abs(a - b) < 1e-9, `${a} vs ${b}`);
  near(X.fwdReturn(c, 0, 5), 4); assert.equal(X.fwdReturn(c, 3, 5), null);
  near(X.fwdMaxDrawdown(c, 1, 3), 100 * (95 / 102 - 1)); near(X.fwdMaxDrawdown(c, 5, 1), 100 * (101 / 104 - 1));
  assert.equal(X.firstAbove(h, 3, 103), 5); assert.equal(X.firstAbove(h, 3, 200), -1);
  assert.deepEqual(X.runLengths([true, true, false, true]), [1, 2, 0, 1]); const sl = X.slopePct([100, null, 110, 121], 2); assert.deepEqual([sl[0], sl[1], sl[3]], [null, null, null]); near(sl[2], 10);
});
test("own-history percentile reads prior values only and half-counts ties", () => { const p = X.ownPct([1, 2, 3, 4, 5, 1, 3], 3); assert.deepEqual(p.slice(0, 3), [null, null, null]); assert.equal(p[3], 100); assert.equal(p[5], 100 * 0.5 / 5); });
test("equal-weight basket: mean of member returns, members change with the calendar year, missing prices are skipped", () => {
  const dates = ["2019-12-30", "2019-12-31", "2020-01-02"], closes = { A: new Map([["2019-12-30", 10], ["2019-12-31", 11], ["2020-01-02", 11]]), B: new Map([["2019-12-30", 20], ["2019-12-31", 18], ["2020-01-02", 27]]), C: new Map([["2020-01-02", 5]]) };
  const b = X.basketReturns(dates, { 2019: ["A", "B"], 2020: ["B", "C"] }, closes);
  assert.equal(b[0].ret, null); assert.ok(Math.abs(b[1].ret) < 1e-9); assert.equal(b[2].n, 1); assert.equal(b[2].ret, 50);
  assert.deepEqual(X.chain([null, 10, -50]).map((v) => Math.round(v)), [100, 110, 55]);
});
test("equal-count bins and the distribution summary", () => { const { bin, edges } = X.equalBins([5, 1, 4, 2, 3, null], 2); assert.deepEqual(bin, [1, 0, 1, 0, 1, null]); assert.deepEqual(edges, [[1, 2], [3, 5]]); const d = X.dist([1, 2, 3, 4, 5]); assert.equal(d.p50, 3); assert.equal(d.n, 5); });

test("delivered page: exists, is self-contained, carries the BACK / CLOSE pair, every chart file it shows exists, and its data file agrees", { skip: !fs.existsSync(path.join(DIR, "STATISTICIAN-2.html")) && "page not built yet" }, () => {
  const html = fs.readFileSync(path.join(DIR, "STATISTICIAN-2.html"), "utf8");
  assert.ok(html.includes("data-scnav-slot") && html.includes("<!-- scnav"), "BACK / CLOSE pair");
  const imgs = [...html.matchAll(/src="(charts\/[^"]+)"/g)].map((m) => m[1]); assert.ok(imgs.length >= 20, `charts on the page: ${imgs.length}`);
  for (const f of imgs) assert.ok(fs.existsSync(path.join(DIR, f)), f);
  assert.ok(!/https?:\/\/(cdn|unpkg|jsdelivr)/.test(html), "no external scripts");
  const J = JSON.parse(fs.readFileSync(path.join(DIR, "data/statistician-2.json"), "utf8"));
  assert.ok(J.q1 && J.q2 && J.q3 && J.q4 && J.q5 && J.q6 && J.q7, "seven measured sections");
  assert.ok(html.includes(J.asOf), "as-of date on the page");
  for (const w of ["What could be wrong", "What was not done", "Where each number comes from"]) assert.ok(html.includes(w), w);
  // the standard's three numbers and one word appear
  assert.ok(/luck-proof|leaning|a list/.test(html));
});
