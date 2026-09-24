import test from "node:test";
import assert from "node:assert/strict";
import { replay, tripleReplay, pastOnlyWindow, NotPortedDetector, geometryDigest } from "../research/trendoscope/lib/replay.mjs";
import { bars, CONTEXT, TestDoubleDetector, makeEvent } from "./trendoscope-fixtures.mjs";

const args = () => ({ bars: bars(60), detector: new TestDoubleDetector(), context: CONTEXT, capture_run_id: "test" });

test("the real detector boundary refuses to run instead of approximating find(...)", () => {
  const d = new NotPortedDetector();
  assert.throws(() => d.onBar(), (e) => {
    assert.equal(e.code, "TRENDOSCOPE_LIBRARY_SOURCE_UNAVAILABLE");
    assert.equal(e.missing.length, 6);
    assert.ok(e.missing.includes("Trendoscope/abstractchartpatterns/10"));
    return true;
  });
});

test("a detector physically cannot read a future bar", () => {
  const w = pastOnlyWindow(bars(10), 4);
  assert.equal(w.get(4).i, 4);
  assert.equal(w.get(0).i, 0);
  assert.throws(() => w.get(5), /LEAKAGE: detector asked for bar 5 at cursor 4/);
  assert.equal(w.length, 5);
  assert.equal(w.slice().length, 5);
});

test("bars must arrive strictly in time order", () => {
  const b = bars(10);
  [b[4], b[5]] = [b[5], b[4]];
  assert.throws(() => replay({ ...args(), bars: b }), /not strictly chronological/);
});

test("an event stamped with any bar but the current one is refused as leakage", () => {
  const detector = { onBar: ({ index }) => (index === 30 ? [makeEvent({ confirmed_at_index: 12 })] : []) };
  assert.throws(() => replay({ ...args(), detector }), /LEAKAGE: pattern confirmed_at_index 12 emitted at bar 30/);
});

test("confirmation time comes from the bar of acceptance, never from an anchor", () => {
  const { events } = replay(args());
  assert.equal(events.length, 2);
  for (const e of events) {
    assert.equal(e.confirmed_at_epoch, bars(60)[e.confirmed_at_index].t);
    assert.ok(e.confirmed_at_epoch > e.formation_end_epoch);
    assert.equal(e.first_observed_at, e.confirmed_at_epoch);
  }
});

test("three replays produce identical ordered ids and identical geometry (determinism gate)", () => {
  const g = tripleReplay(args());
  assert.equal(g.pass, true);
  assert.equal(g.ids_identical, true);
  assert.equal(g.geometry_identical, true);
  assert.deepEqual(g.event_counts, [2, 2, 2]);
  assert.match(g.geometry_digest, /^[0-9a-f]{64}$/);
});

test("the determinism gate actually fails when a detector is not deterministic", () => {
  let calls = 0;
  const flaky = { onBar: ({ index }) => {
    if (index !== 28) return [];
    calls++;
    return [makeEvent({ confirmed_at_index: 28, pattern_type_id: calls % 2 ? 9 : 10,
      pattern_name: calls % 2 ? "Rising Wedge (Contracting)" : "Falling Wedge (Contracting)",
      direction_family: calls % 2 ? "rising" : "falling" })];
  } };
  const g = tripleReplay({ ...args(), detector: flaky });
  assert.equal(g.pass, false, "the gate must catch a non-deterministic detector");
});

test("retention stays at the canonical 20 patterns", () => {
  const detector = { onBar: ({ index, retained }) => {
    assert.ok(retained.length <= 20, "the detector never sees more than 20 retained patterns");
    return index >= 28 ? [makeEvent({ confirmed_at_index: index })] : [];
  } };
  const out = replay({ bars: bars(80), detector, context: CONTEXT, capture_run_id: "t" });
  assert.equal(out.events.length, 52);
  assert.equal(out.retained_final, 20);
});

test("events failing the schema are rejected with reasons, not silently emitted", () => {
  const detector = { onBar: ({ index }) => (index === 30
    ? [makeEvent({ confirmed_at_index: 30, pattern_type_id: 99, pattern_name: "Nope" })] : []) };
  const out = replay({ ...args(), detector });
  assert.equal(out.events.length, 0);
  assert.equal(out.rejections.length, 1);
  assert.ok(out.rejections[0].problems.some((p) => p.includes("outside the 13 declared types")));
});

test("the geometry digest changes when a rail moves by one tick", () => {
  const a = replay(args()).events;
  const moved = a.map((e) => ({ ...e, upper_rail: { ...e.upper_rail, p1_price: e.upper_rail.p1_price + 0.01 } }));
  assert.notEqual(geometryDigest(moved), geometryDigest(a));
});
