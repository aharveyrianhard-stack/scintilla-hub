/* deliverables/20260925/geiger-motion-v3 — the arithmetic behind TIMELINE, LEADERBOARD and RACE, pinned.
   The pages draw what gv3-math.js computes; these tests pin that maths on hand-checkable inputs, then
   run it over the real bundle to check the invariants hold at cohort size. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const DIR = path.join(ROOT, "deliverables", "20260925", "geiger-motion-v3");
const require = createRequire(import.meta.url);
const M = require(path.join(DIR, "gv3-math.js"));
const read = (f) => fs.readFileSync(path.join(DIR, f), "utf8");

/* three names, four days: hand-checkable */
const V = { A: [3, 1, 2, null], B: [2, 2, 3, 5], C: [1, 3, 1, 4] };
const names = ["A", "B", "C"], at = (t, d) => V[t][d];

test("order: best first, missing last, ties by name so nothing jitters", () => {
  assert.deepEqual(M.order(names, (t) => at(t, 0)), ["A", "B", "C"]);
  assert.deepEqual(M.order(names, (t) => at(t, 1)), ["C", "B", "A"]);
  assert.deepEqual(M.order(names, (t) => at(t, 3)), ["B", "C", "A"], "A has no reading on day 3 and ranks last");
  assert.deepEqual(M.order(["Z", "Y"], () => 1), ["Y", "Z"], "a tie breaks by name");
});

test("rank table: every rank 1..N appears once per day, and ranks match the order", () => {
  const T = M.rankTable(names, 4, at);
  for (let d = 0; d < 4; d++) {
    const ranks = names.map((t) => T.rank[t][d]).sort();
    assert.deepEqual(ranks, [1, 2, 3]);
    T.order[d].forEach((t, i) => assert.equal(T.rank[t][d], i + 1));
  }
  assert.deepEqual(T.rank.A, [1, 3, 2, 3]);
});

test("moves and crossings: places climbed, and how many overtakes a day held", () => {
  const T = M.rankTable(names, 4, at);
  assert.equal(M.move(T.rank, "C", 1), 2, "C went 3rd → 1st: climbed two");
  assert.equal(M.move(T.rank, "A", 1), -2);
  assert.equal(M.move(T.rank, "A", 0), 0, "no move on the first day");
  assert.equal(M.crossings(T, 0), 0);
  assert.equal(M.crossings(T, 1), 3, "A,B,C → C,B,A flips all three pairs");
  assert.equal(M.crossings(T, 2), 2, "C,B,A → B,A,C: C is passed by both B and A, two overtakes");
  /* a day where nothing changes has no crossings */
  const S = M.rankTable(names, 2, (t) => ({ A: 1, B: 2, C: 3 })[t]);
  assert.equal(M.crossings(S, 1), 0);
});

test("rankAt between two days is the straight line, and exact on the day", () => {
  const T = M.rankTable(names, 4, at);
  assert.equal(M.rankAt(T.rank, "A", 0), 1);
  assert.equal(M.rankAt(T.rank, "A", 0.5), 2, "1 → 3, halfway is 2");
  assert.equal(M.rankAt(T.rank, "A", 3), 3);
  assert.equal(M.rankAt(T.rank, "A", 9), 3, "past the end holds the last day");
});

test("leaders: who led after each hole", () => {
  assert.deepEqual(M.leaders(M.rankTable(names, 4, at)), ["A", "C", "B", "B"]);
});

test("race progress: readings add up, missing days add nothing, % compounds", () => {
  const P = M.progress(names, 4, at, "sum");
  assert.deepEqual(P.A, [3, 4, 6, 6], "A's missing day 3 adds nothing");
  assert.deepEqual(P.B, [2, 4, 7, 12]);
  const C = M.progress(["X"], 3, (t, d) => [10, 10, -50][d], "compound");
  assert.ok(Math.abs(C.X[1] - 21) < 1e-9, "+10% then +10% is +21%");
  assert.ok(Math.abs(C.X[2] - (-39.5)) < 1e-9, "then −50% is −39.5%");
  assert.equal(M.progressAt(P, "B", 2.5), 9.5);
  const tr = M.track(P);
  assert.equal(tr.finish, 12, "the finish line is the winner's final distance");
  assert.equal(tr.lo, 0); assert.equal(tr.hi, 12);
  const N = M.progress(["Q"], 2, (t, d) => [-2, -3][d], "sum");
  assert.equal(M.track(N).lo, -5, "a runner can walk backwards; the track shows it");
});

test("what fits, what folds, and which holes are on show", () => {
  assert.equal(M.fit(700, 26, 40), 25);
  assert.equal(M.fit(10, 26), 1, "never zero rows");
  const f = M.fold(["a", "b", "c", "d", "e", "f"], 2);
  assert.deepEqual(f, { shown: ["a", "b"], hidden: 4, next: ["c", "d", "e"] });
  assert.deepEqual(M.holeWindow(20, 34, 9), { start: 12, end: 20 }, "ends on the hole being played");
  assert.deepEqual(M.holeWindow(3, 34, 9), { start: 0, end: 3 });
  assert.deepEqual(M.holeWindow(99, 34, 9), { start: 25, end: 33 }, "clamped to the last day");
});

test("on the real bundle: every day is a full permutation and crossings are bounded by N(N−1)/2", () => {
  const js = fs.readFileSync(path.join(ROOT, "deliverables", "20260925", "geiger-visuals", "data.js"), "utf8");
  const ctx = { window: {} }; vm.createContext(ctx); vm.runInContext(js, ctx);
  const D = ctx.window.GV_DATA, N = D.META.hist_dates.length;
  for (const key of ["AI_HARDWARE", "FAV"]) {
    const coh = D.COHORTS[key].filter((t) => D.HIST[t] && D.NOW[t]);
    const T = M.rankTable(coh, N, (t, d) => D.HIST[t][d]);
    const cap = coh.length * (coh.length - 1) / 2;
    for (let d = 0; d < N; d++) {
      assert.equal(new Set(T.order[d]).size, coh.length, key + " day " + d + " is a permutation");
      const x = M.crossings(T, d); assert.ok(x >= 0 && x <= cap, key + " crossings within bound");
    }
    const P = M.progress(coh, N, (t, d) => D.HIST[t][d], "sum");
    for (const t of coh) assert.ok(Math.abs(P[t][N - 1] - D.HIST[t].reduce((s, v) => s + (v == null ? 0 : v), 0)) < 1e-9, t + " progress equals its summed readings");
  }
});

test("the write-up and the four pages exist and link each other; house colours hold", () => {
  const PAGES = ["timeline.html", "leaderboard.html", "race.html", "player.html"];
  const doc = read("GEIGER-MOTION-V3.html");
  for (const p of PAGES) {
    assert.ok(fs.existsSync(path.join(DIR, p)), p + " exists");
    assert.ok(doc.includes('href="' + p + '"'), "write-up links " + p);
    const s = read(p);
    assert.ok(s.includes('name="robots" content="noindex"'), p + " is noindex");
    assert.ok(s.includes("gv3-math.js") && s.includes("gv3-views.js"), p + " uses the shared maths and views");
  }
  const body = (read("gv3.css") + PAGES.map(read).join("\n") + read("gv3-views.js")).replace(/<!-- scnav ·[\s\S]*?<!-- \/scnav -->/g, "");
  for (const h of new Set(body.match(/#[0-9a-fA-F]{6}\b/g) || [])) {
    if (["#00FFA3", "#FF2D55"].includes(h.toUpperCase())) continue;
    const n = parseInt(h.slice(1), 16), r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, h + " is a grey");
    assert.ok(Math.max(r, g, b) <= 210, h + " is not white");
  }
  assert.ok(!/\bwhite\b(?!-space)|#fff\b/i.test(body), "no white");
});
