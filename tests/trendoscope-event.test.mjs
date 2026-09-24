import test from "node:test";
import assert from "node:assert/strict";
import { eventId, validateEvent, sealEvent } from "../research/trendoscope/lib/event.mjs";
import { settingsSha256, PATTERN_LABELS } from "../research/trendoscope/lib/settings.mjs";
import { makeEvent } from "./trendoscope-fixtures.mjs";

test("a well-formed event passes every Phase 0 schema rule", () => {
  const r = validateEvent(makeEvent());
  assert.deepEqual(r.problems, []);
  assert.equal(r.ok, true);
});

test("event_id is deterministic and depends on the anchors, not on key order", () => {
  const a = makeEvent(), b = makeEvent();
  assert.equal(eventId(a), eventId(b));
  const moved = makeEvent();
  moved.pivots = moved.pivots.map((p, i) => (i === 0 ? { ...p, price: p.price + 0.01 } : p));
  assert.notEqual(eventId(moved), eventId(a), "a changed anchor must change the id");
  const otherSettings = { ...a, settings_sha256: "0".repeat(64) };
  assert.notEqual(eventId(otherSettings), eventId(a), "a settings change must change the id");
  const otherFeed = { ...a, feed: "OTHER" };
  assert.notEqual(eventId(otherFeed), eventId(a), "feed identity is part of the key");
});

test("all 13 declared labels validate and nothing outside them does", () => {
  for (const l of PATTERN_LABELS) {
    const r = validateEvent(makeEvent({ pattern_type_id: l.id }));
    assert.deepEqual(r.problems, [], `${l.id} ${l.name}`);
  }
  const bad = validateEvent(makeEvent({ pattern_type_id: 14, pattern_name: "Made Up" }));
  assert.ok(bad.problems.some((p) => p.includes("outside the 13 declared types")));
});

test("a confirmation backdated to an anchor is rejected (leakage gate)", () => {
  const r = validateEvent(makeEvent({ confirmed_at_index: 26, confirmed_at_epoch: makeEvent().formation_end_epoch - 1 }));
  assert.ok(r.problems.some((p) => p.includes("backdated")), JSON.stringify(r.problems));
});

test("an anchor that became knowable after confirmation is rejected", () => {
  const e = makeEvent();
  e.pivots = e.pivots.map((p, i) => (i === 4 ? { ...p, known_at_epoch: e.confirmed_at_epoch + 1 } : p));
  const r = validateEvent(e);
  assert.ok(r.problems.some((p) => p.includes("knowable after confirmation")));
});

test("a null coordinate needs a missing_reason and cannot claim 'resolved'", () => {
  const e = makeEvent();
  e.upper_rail = { ...e.upper_rail, p2_epoch: null };
  const bare = validateEvent(e);
  assert.ok(bare.problems.some((p) => p.includes("missing_reason")));
  assert.ok(bare.problems.some((p) => p.includes("'resolved' with null coordinates")));
  const declared = validateEvent({ ...e, missing_reason: "source slot no longer materialized", coordinate_status: "partial" });
  assert.deepEqual(declared.problems, []);
});

test("pivots must be ordered and alternate sides", () => {
  const unordered = validateEvent(makeEvent({ pivots: [
    { seq: 1, side: "low", source_bar_index: 14, price: 100 },
    { seq: 2, side: "high", source_bar_index: 10, price: 112 },
    { seq: 3, side: "low", source_bar_index: 18, price: 103 },
    { seq: 4, side: "high", source_bar_index: 22, price: 110 },
    { seq: 5, side: "low", source_bar_index: 26, price: 105 }] }));
  assert.ok(unordered.problems.some((p) => p.includes("not strictly ordered")));
  const sameSide = validateEvent(makeEvent({ pivots: [
    { seq: 1, side: "low", source_bar_index: 10, price: 100 },
    { seq: 2, side: "low", source_bar_index: 14, price: 112 },
    { seq: 3, side: "high", source_bar_index: 18, price: 103 },
    { seq: 4, side: "high", source_bar_index: 22, price: 110 },
    { seq: 5, side: "low", source_bar_index: 26, price: 105 }] }));
  assert.ok(sameSide.problems.some((p) => p.includes("do not alternate")));
});

test("a sealed event is frozen and carries the canonical settings hash", () => {
  const e = sealEvent(makeEvent());
  assert.equal(e.settings_sha256, settingsSha256());
  assert.throws(() => { e.pattern_name = "changed"; }, TypeError);
  assert.match(e.event_id, /^[0-9a-f]{64}$/);
});
