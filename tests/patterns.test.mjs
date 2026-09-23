/* Guards for the six patterns. Offline: no network, bars are generated here. */
import test from "node:test";
import assert from "node:assert/strict";
import { pivots, findWedge, findBearFlag, findHeadShoulders, DIRECTION } from "../tools/patterns/detectors.mjs";
import { findFlags } from "../tools/patterns/bull-flag.mjs";
import { verdict, DETECTORS } from "../tools/patterns/measure.mjs";

/** a deterministic random walk with the shape of daily bars */
function walk(n, seed = 7) {
  let s = seed, px = 100;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const bars = [];
  for (let i = 0; i < n; i++) {
    px *= 1 + (rnd() - 0.49) * 0.03;
    const h = px * (1 + rnd() * 0.012), l = px * (1 - rnd() * 0.012);
    bars.push({ t: Date.UTC(2003, 0, 1) + i * 864e5, o: px, h, l, c: px, v: 1e6 });
  }
  return bars;
}
const BARS = walk(2600);

test("a turning point is never known before the days that make it one", () => {
  const { hi, lo } = pivots(BARS, 5);
  for (const p of [...hi, ...lo]) assert.equal(p.confirmed, p.i + 5);
  for (const p of hi) for (let j = p.i - 5; j <= p.i + 5; j++)
    if (j !== p.i) assert.ok(BARS[j].h < p.p, "a swing high must be the highest of its window");
});

for (const [name, det] of Object.entries(DETECTORS)) {
  test(`${name} sees only the past: cutting the history short changes nothing before the cut`, () => {
    const full = det(BARS);
    for (const cut of [900, 1700, 2300]) {
      const partial = det(BARS.slice(0, cut + 1));
      const expected = full.filter((x) => x.i <= cut).map((x) => x.i);
      assert.deepEqual(partial.map((x) => x.i), expected,
        `${name}: signals up to day ${cut} must not depend on bars after it`);
    }
  });
}

test("every pattern says which way it claims price will go", () => {
  for (const name of Object.keys(DETECTORS)) assert.ok(["up", "down"].includes(DIRECTION[name]), name);
});

test("a wedge must close on itself, and the two are mirror images", () => {
  // lines that run parallel are not a wedge, however long they run
  const parallel = [];
  for (let i = 0; i < 400; i++) {
    const base = 100 + i * 0.1, wob = Math.sin(i / 6) * 3;
    parallel.push({ t: Date.UTC(2003, 0, 1) + i * 864e5, o: base + wob, h: base + wob + 1.2, l: base + wob - 1.2, c: base + wob, v: 1 });
  }
  assert.equal(findWedge(parallel, "rising").length, 0, "a parallel channel is not a rising wedge");
  assert.equal(findWedge(parallel, "falling").length, 0, "a parallel channel is not a falling wedge");
  const flip = BARS.map((b) => ({ ...b, o: 200 - b.o, c: 200 - b.c, h: 200 - b.l, l: 200 - b.h }));
  assert.ok(Math.abs(findWedge(flip, "falling").length - findWedge(BARS, "rising").length) <= 2,
    "turning the chart upside down should turn rising wedges into falling ones");
});

test("head and shoulders needs a head that clears both shoulders, and a neckline break", () => {
  const tops = findHeadShoulders(BARS, "top"), bots = findHeadShoulders(BARS, "bottom");
  for (const x of tops) {
    const [ls, head, rs] = x.draw.points;
    assert.ok(head.p > ls.p && head.p > rs.p, "the head must be the highest of the three");
    assert.ok(Math.abs(ls.p - rs.p) / Math.max(ls.p, rs.p) <= 0.12, "the shoulders must be alike");
  }
  for (const x of bots) {
    const [ls, head, rs] = x.draw.points;
    assert.ok(head.p < ls.p && head.p < rs.p, "the head must be the lowest of the three");
  }
});

test("the flags are mirror images of each other, same rule both ways", () => {
  const flip = BARS.map((b) => ({ ...b, o: 400 - b.o, c: 400 - b.c, h: 400 - b.l, l: 400 - b.h }));
  const up = findFlags(BARS).length, down = findBearFlag(flip).length;
  assert.ok(Math.abs(up - down) <= Math.max(2, up * 0.35), `bull ${up} vs mirrored bear ${down}`);
});

test("the verdict refuses to call anything on too few signals", () => {
  const thin = { horizons: { 20: { signal: { n: 40, median_pct: 9 }, any_day: { median_pct: 0.5 },
      excess_over_local: { median_pct: 9 }, random_same_count: { median_pct: { p5: -1, p95: 1 } } },
    60: { signal: { n: 40, median_pct: 9 }, any_day: { median_pct: 1 },
      excess_over_local: { median_pct: 9 }, random_same_count: { median_pct: { p5: -1, p95: 1 } } } } };
  assert.equal(verdict(thin, "up", { early: 5, late: 5, base_early: 1, base_late: 1 }).call, "too few");
});

test("an edge inside the random band is not called a survivor", () => {
  const mk = (med) => ({ signal: { n: 500, median_pct: med }, any_day: { median_pct: med - 0.05 },
    excess_over_local: { median_pct: 0.05 }, random_same_count: { median_pct: { p5: med - 1, p95: med + 1 } } });
  const m = { horizons: { 20: mk(1.0), 60: mk(2.0) } };
  const v = verdict(m, "up", { early: 1.1, late: 1.2, base_early: 1, base_late: 1 });
  assert.equal(v.call, "does not survive");
  assert.ok(/against chance/.test(v.why), v.why);
});

test("a bearish pattern is judged against its own half of history, not against zero", () => {
  // both halves rose; the pattern still beat its own half by falling less
  const mk = () => ({ signal: { n: 500, median_pct: 0.2 }, any_day: { median_pct: 1.0 },
    excess_over_local: { median_pct: -0.4 }, random_same_count: { median_pct: { p5: 0.5, p95: 1.5 } } });
  const m = { horizons: { 20: mk(), 60: mk() } };
  const v = verdict(m, "down", { early: 0.3, late: 0.4, base_early: 0.9, base_late: 1.1 });
  assert.equal(v.call, "survives");
});
