import test from "node:test";
import assert from "node:assert/strict";
import { quantiles, tableA, tableB, tableC, tableI } from "../research/trendoscope/lib/tables.mjs";
import { clusterEvents } from "../research/trendoscope/lib/dedupe.mjs";
import { sealEvent } from "../research/trendoscope/lib/event.mjs";
import { makeEvent } from "./trendoscope-fixtures.mjs";

test("quantiles are exact on a known series and empty-safe", () => {
  const q = quantiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  assert.equal(q.n, 10);
  assert.equal(q.median, 5.5);
  assert.equal(q.q1, 3.25);
  assert.equal(q.q3, 7.75);
  assert.equal(q.iqr, 4.5);
  assert.equal(q.min, 1);
  assert.equal(q.max, 10);
  const empty = quantiles([null, undefined, NaN]);
  assert.equal(empty.n, 0);
  assert.equal(empty.median, null, "no data yields no median, never a zero");
});

test("Table A carries the packet's exact columns", () => {
  const t = tableA([{ run_id: "r", symbol: "X", feed: "MASSIVE", timeframe: "4H", session: "s",
    scale: "linear", bars: 10, raw_events: 0, complete_events: 0, unresolved_events: 0,
    endpoint_checks: 0, endpoint_mismatches: 0, replay_hash_match: true, notes: "n" }]);
  assert.deepEqual(t.columns, ["run_id", "symbol", "feed", "timeframe", "session", "scale", "bars",
    "raw_events", "complete_events", "unresolved_events", "endpoint_checks", "endpoint_mismatches",
    "replay_hash_match", "notes"]);
  assert.equal(t.rows.length, 1);
});

test("Table B reports raw events and deduped clusters side by side", () => {
  const events = [sealEvent(makeEvent()), sealEvent(makeEvent({ confirmed_at_index: 29, zigzag_lane: 2 })),
                  sealEvent(makeEvent({ pattern_type_id: 1, confirmed_at_index: 50 }))];
  const clusters = clusterEvents(events);
  const b = tableB(events, clusters);
  assert.equal(b.raw_event_total, 3);
  assert.equal(b.deduped_cluster_total, clusters.length);
  assert.equal(b.by_dimension_raw.pattern_name["Rising Wedge (Contracting)"], 2);
  assert.equal(b.by_dimension_raw.zigzag_lane_level["1/0"], 2);
  assert.equal(b.by_dimension_raw.timeframe["4H"], 3);
  assert.ok(Math.abs(Object.values(b.rates).reduce((s, x) => s + x, 0) - 1) < 1e-12);
});

test("Table B with no events reports zero rather than an empty object", () => {
  const b = tableB([], []);
  assert.equal(b.raw_event_total, 0);
  assert.equal(b.deduped_cluster_total, 0);
  assert.deepEqual(b.rates, {});
  assert.equal(b.mean_members_per_cluster, null);
});

test("Table C groups by pattern and timeframe and reports N with the spread", () => {
  const recs = [
    { pattern_name: "Rising Wedge (Contracting)", timeframe: "4H", duration_bars: 10, convergence: -0.2, synthetic_pivot_count: 0 },
    { pattern_name: "Rising Wedge (Contracting)", timeframe: "4H", duration_bars: 20, convergence: -0.4, synthetic_pivot_count: 1 },
    { pattern_name: "Ascending Channel", timeframe: "1D", duration_bars: 30, convergence: 0.1, synthetic_pivot_count: 0 },
  ];
  const c = tableC(recs);
  assert.equal(c.rows.length, 2);
  const wedge = c.rows.find((r) => r.pattern_name === "Rising Wedge (Contracting)");
  assert.equal(wedge.n, 2);
  assert.equal(wedge.duration_bars.median, 15);
  assert.equal(wedge.synthetic_point_rate, 0.5);
  assert.equal(wedge.width_confirm_atr.n, 0, "a metric with no data reports n=0, not a fabricated value");
});

test("Table I totals every exclusion reason", () => {
  const i = tableI({ detector_not_ported: { count: 32, note: "libraries absent" },
    unresolved_anchors: 168, feed_not_served: 6 });
  assert.equal(i.total, 206);
  assert.equal(i.reasons.find((r) => r.reason === "detector_not_ported").note, "libraries absent");
});
