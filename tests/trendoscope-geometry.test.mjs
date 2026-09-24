import test from "node:test";
import assert from "node:assert/strict";
import { railAt, railSlopePerBar, railSlopePerSecond, atrSeries, tolerance,
         touchEpisodes, deriveFeatures, railsCross, TRANSFORM_VERSION } from "../research/trendoscope/lib/geometry.mjs";
import { bars, makeEvent, BAR_MS } from "./trendoscope-fixtures.mjs";

const rail = { p1_index: 10, p1_epoch: 0, p1_price: 100, p2_index: 20, p2_epoch: 10 * BAR_MS, p2_price: 110 };

test("rail(i) is the packet's interpolation, exact at the endpoints", () => {
  assert.equal(railAt(rail, 10), 100);
  assert.equal(railAt(rail, 20), 110);
  assert.equal(railAt(rail, 15), 105);
  assert.equal(railAt(rail, 25), 115, "evaluation past the endpoint extends the same line");
});

test("a vertical rail is refused, not fudged", () => {
  assert.throws(() => railAt({ ...rail, p2_index: 10 }, 12), /degenerate rail/);
  assert.throws(() => railSlopePerBar({ ...rail, p2_index: 10 }), /degenerate rail/);
});

test("per-bar slope and per-second slope are separate measures", () => {
  assert.equal(railSlopePerBar(rail), 1);
  const perSec = railSlopePerSecond(rail);
  assert.ok(perSec > 0 && perSec < 1e-3, "per-second slope is a different scale and must never substitute");
  assert.notEqual(perSec, railSlopePerBar(rail));
});

test("ATR is Wilder-smoothed, warmed up at bar 13, and matches a hand-computed constant range", () => {
  const flat = Array.from({ length: 30 }, (_, i) => ({ i, t: i * BAR_MS, o: 10, h: 11, l: 10, c: 10.5 }));
  const A = atrSeries(flat, 14);
  assert.equal(A[12], null, "no ATR before warmup");
  assert.ok(Math.abs(A[13] - 1) < 1e-12, "constant 1.0 true range gives ATR 1.0");
  assert.ok(Math.abs(A[29] - 1) < 1e-12);
});

test("tau is max(2 ticks, 0.10 ATR) and every sensitivity is a separate mode", () => {
  assert.equal(tolerance(0.01, 5), 0.5);
  assert.equal(tolerance(0.01, 0.05), 0.02, "two ticks wins when ATR is tiny");
  assert.equal(tolerance(0.01, 5, { mode: "zero" }), 0);
  assert.equal(tolerance(0.01, 5, { mode: "one_tick" }), 0.01);
  assert.equal(tolerance(0.01, 5, { mode: "atr25" }), 1.25);
});

test("consecutive touching bars are one episode and a new episode needs two clear bars", () => {
  const flat = { p1_index: 0, p1_epoch: 0, p1_price: 100, p2_index: 30, p2_epoch: 30 * BAR_MS, p2_price: 100 };
  const b = Array.from({ length: 31 }, (_, i) => ({ i, t: i * BAR_MS, o: 90, h: 90, l: 89, c: 89.5 }));
  for (const i of [5, 6, 7]) b[i].h = 100;      // one episode
  for (const i of [9]) b[i].h = 100;            // only 1 clear bar after 7 -> same episode
  for (const i of [20, 21]) b[i].h = 100;       // clearly separated -> second episode
  const eps = touchEpisodes(b, flat, { from: 0, to: 30, tau: 0.5, side: "upper" });
  assert.equal(eps.length, 2);
  assert.deepEqual(eps[0].bars, [5, 6, 7, 9]);
  assert.deepEqual(eps[1].bars, [20, 21]);
});

test("an anchor contact is flagged so traded touches can be reported separately", () => {
  const flat = { p1_index: 0, p1_epoch: 0, p1_price: 100, p2_index: 10, p2_epoch: 10 * BAR_MS, p2_price: 100 };
  const b = Array.from({ length: 11 }, (_, i) => ({ i, t: i * BAR_MS, o: 90, h: i === 3 ? 100 : 90, l: 89, c: 89.5 }));
  const eps = touchEpisodes(b, flat, { from: 0, to: 10, tau: 0.5, side: "upper", anchorIndices: [3] });
  assert.equal(eps.length, 1);
  assert.equal(eps[0].is_anchor_contact, true);
});

test("derived features describe the fixture's contracting geometry and stay out of the raw event", () => {
  const e = makeEvent();
  const f = deriveFeatures(e, bars(60), {});
  assert.equal(f.transform_version, TRANSFORM_VERSION);
  assert.equal(f.duration_bars, 16);
  assert.ok(f.convergence < 0, "rails that narrow give a negative convergence");
  assert.ok(f.upper_slope_per_bar < 0 && f.lower_slope_per_bar > 0, "a converging pair has opposite slopes");
  assert.equal(f.alternating_sides_valid, true);
  assert.equal(f.synthetic_pivot_count, 0);
  assert.equal(f.session_hours, null);
  assert.match(f.session_hours_reason, /no session calendar/);
  assert.ok(f.max_abs_residual_ticks >= 0);
  assert.equal(Object.hasOwn(e, "duration_bars"), false, "derived features never enter the raw packet");
});

test("crossing rails are reported, not averaged away", () => {
  const up = { p1_index: 0, p1_epoch: 0, p1_price: 110, p2_index: 10, p2_epoch: 1, p2_price: 90 };
  const lo = { p1_index: 0, p1_epoch: 0, p1_price: 90, p2_index: 10, p2_epoch: 1, p2_price: 110 };
  assert.equal(railsCross(up, lo, 0, 10), true);
  assert.equal(railsCross(rail, { ...rail, p1_price: 90, p2_price: 95 }, 10, 20), false);
});

test("elapsed milliseconds never replace source-bar distance", () => {
  const e = makeEvent();
  const f = deriveFeatures(e, bars(60), {});
  const expectedSeconds = (e.formation_end_epoch - e.formation_start_epoch) / 1000;
  assert.equal(f.elapsed_seconds, expectedSeconds);
  assert.equal(f.duration_bars, e.formation_end_index - e.formation_start_index);
  assert.notEqual(f.duration_bars, f.elapsed_seconds);
});
