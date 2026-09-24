import test from "node:test";
import assert from "node:assert/strict";
import { exactIdentityKey, clusterEvents, DEFAULTS, CLUSTER_RULE_VERSION } from "../research/trendoscope/lib/dedupe.mjs";
import { sealEvent } from "../research/trendoscope/lib/event.mjs";
import { makeEvent } from "./trendoscope-fixtures.mjs";

const ev = (over) => sealEvent(makeEvent(over));

test("exact identity ignores nothing that matters and tick-normalises prices", () => {
  const a = ev(), b = ev();
  assert.equal(exactIdentityKey(a), exactIdentityKey(b));
  const sameTick = ev({ pivots: makeEvent().pivots.map((p, i) => (i === 0 ? { ...p, price: p.price + 0.004 } : p)) });
  assert.equal(exactIdentityKey(sameTick, 0.01), exactIdentityKey(a, 0.01), "sub-tick noise is not a new identity");
  const oneTickMoved = ev({ pivots: makeEvent().pivots.map((p, i) => (i === 0 ? { ...p, price: p.price + 0.05 } : p)) });
  assert.notEqual(exactIdentityKey(oneTickMoved, 0.01), exactIdentityKey(a, 0.01));
});

test("near-identical detections cluster once, and every member keeps its own provenance", () => {
  const base = ev();
  const nudged = ev({ zigzag_lane: 2, confirmed_at_index: 29,
    upper_rail: { ...makeEvent().upper_rail, p1_price: 112.02 } });
  const clusters = clusterEvents([base, nudged], { atrByEvent: new Map([[base.event_id, 5], [nudged.event_id, 5]]) });
  assert.equal(clusters.length, 1, "four near-identical ZigZag detections must not count as four observations");
  assert.equal(clusters[0].member_count, 2);
  assert.equal(clusters[0].cluster_weight, 1);
  assert.deepEqual(clusters[0].members_provenance.map((m) => m.zigzag_lane), [1, 2]);
  assert.equal(clusters[0].cluster_rule_version, CLUSTER_RULE_VERSION);
  assert.match(clusters[0].pattern_cluster_id, /^[0-9a-f]{64}$/);
});

test("a confirmation far apart in time is a separate cluster", () => {
  const a = ev();
  const far = ev({ confirmed_at_index: 55 });
  const clusters = clusterEvents([a, far]);
  assert.equal(clusters.length, 2);
});

test("rails further apart than 0.15 ATR are not merged", () => {
  const a = ev();
  const wide = ev({ upper_rail: { ...makeEvent().upper_rail, p1_price: 130, p2_price: 128 } });
  const clusters = clusterEvents([a, wide], { atrByEvent: new Map([[a.event_id, 1], [wide.event_id, 1]]) });
  assert.equal(clusters.length, 2);
  assert.ok(DEFAULTS.rail_atr === 0.15);
});

test("different feed, session, timeframe or scale can never be merged", () => {
  const a = ev();
  for (const over of [{ feed: "OTHER" }, { session_mode: "regular" }, { source_timeframe: "1H" },
                      { price_scale: "log" }, { adjustment_mode: "RAW" }, { symbol: "OTHER" }]) {
    const clusters = clusterEvents([a, ev(over)]);
    assert.equal(clusters.length, 2, `merged across ${JSON.stringify(over)}`);
  }
});

test("a different shape family is never pooled even at the same time", () => {
  const wedge = ev({ pattern_type_id: 9 });
  const channel = ev({ pattern_type_id: 1 });
  assert.equal(clusterEvents([wedge, channel]).length, 2);
});

test("the raw list is untouched by clustering", () => {
  const list = [ev(), ev({ confirmed_at_index: 29 })];
  const before = JSON.stringify(list);
  clusterEvents(list);
  assert.equal(JSON.stringify(list), before, "raw events are never deduplicated in place");
});
