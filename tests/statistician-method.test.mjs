/* The statistician's toolbox (research/statistics/method/method-lib.mjs): pinned behaviour, no data files. */
import test from "node:test"; import assert from "node:assert/strict";
import * as M from "../research/statistics/method/method-lib.mjs";

test("seeded generator repeats exactly", () => { const a = M.mulberry32(3), b = M.mulberry32(3); for (let i = 0; i < 5; i++) assert.equal(a(), b()); });
test("stationary indices stay in range, mostly consecutive, and start anywhere", () => {
  const idx = M.stationaryIndices(500, 20, M.mulberry32(9));
  assert.equal(idx.length, 500); assert.ok(idx.every((i) => i >= 0 && i < 500));
  const consecutive = idx.filter((v, k) => k > 0 && v === (idx[k - 1] + 1) % 500).length;
  assert.ok(consecutive > 400 && consecutive < 499, `consecutive ${consecutive}`);
});
test("bootstrap of an independent coin matches the naive interval; a run-clustered coin is wider", () => {
  const rng = M.mulberry32(1), n = 2000;
  const iid = Array.from({ length: n }, () => (rng() < 0.6 ? 1 : 0));
  const naive = M.wilson(iid.filter(Boolean).length, n);
  const bIid = M.stationaryBootstrap(iid, (rs) => M.share(rs, (x) => x > 0), { block: 2, reps: 600, seed: 2 });
  assert.ok(Math.abs((bIid.hi - bIid.lo) - (naive.hi - naive.lo)) < 0.02, "iid widths agree");
  // the same 0/1 series but in runs of 40: the count is the same, the information is 50× less
  const runs = []; let v = 0; for (let i = 0; i < n; i++) { if (i % 40 === 0) v = rng() < 0.6 ? 1 : 0; runs.push(v); }
  const bRuns = M.stationaryBootstrap(runs, (rs) => M.share(rs, (x) => x > 0), { block: M.blockLength(runs, 1), reps: 600, seed: 3 });
  assert.ok((bRuns.hi - bRuns.lo) > 3 * (bIid.hi - bIid.lo), `clustered width ${bRuns.hi - bRuns.lo} vs iid ${bIid.hi - bIid.lo}`);
  assert.ok(M.effectiveN(runs) < n / 10, "effective n collapses for runs");
});
test("Benjamini–Hochberg: no survivors on uniform noise, survivors on real signal", () => {
  const rng = M.mulberry32(4), noise = Array.from({ length: 100 }, () => rng());
  const a = M.benjaminiHochberg(noise, 0.1); assert.ok(a.reject.filter(Boolean).length <= 2);
  const mixed = noise.map((p, i) => (i < 5 ? p / 1e4 : p));
  const b = M.benjaminiHochberg(mixed, 0.1); assert.ok([0, 1, 2, 3, 4].every((i) => b.reject[i]));
  assert.ok(b.adjusted.every((p) => p >= 0 && p <= 1));
});
test("episodes count the first day of each run", () => { assert.deepEqual(M.episodes([0, 1, 1, 0, 1, 0, 0, 1]), [1, 4, 7]); });
test("wilson brackets the share", () => { const w = M.wilson(60, 100); assert.ok(w.lo < 0.6 && w.hi > 0.6 && w.lo > 0.5 && w.hi < 0.7); });
