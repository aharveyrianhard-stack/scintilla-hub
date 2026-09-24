/* M70 — the same-scale trio, as the SCINTILLA DETECTOR applies it (supabase/functions/scintillas-detect/detect.mjs).
   The Hub and this function must agree, so the same cases are asserted on both sides; this file covers the
   backend, tests/econ-now-line-units.test.mjs covers the page. No network: the functions are pure. */
import test from "node:test";
import assert from "node:assert/strict";
import { econUnify, econScaleGap, detectEconSurprises, econEventKey }
  from "../supabase/functions/scintillas-detect/detect.mjs";

const NHS = { country: "US", event: "New Home Sales (Aug)", event_ts: "2026-09-24T14:00:00Z", impact: "High" };
const hist = (pairs) => { const h = {}; h[econEventKey("US", "New Home Sales (Aug)")] =
  pairs.map(([a, e]) => ({ actual: a, estimate: e })); return h; };

test("the estimate filed in millions is read at the scale of the other two", () => {
  const u = econUnify({ actual: 684, estimate: 0.62, previous: 607 });
  assert.equal(u.estimate, 620);
  assert.equal(u.actual, 684);
  assert.equal(u.unit_fix.ref, "previous");
  assert.deepEqual(u.unit_fix.raw, { actual: 684, estimate: 0.62, previous: 607 }, "the feed's own numbers are kept");
});

test("a row already on one scale is returned untouched", () => {
  const u = econUnify({ actual: 0.684, estimate: 0.62, previous: 0.643 });
  assert.equal(u.unit_fix, null);
  assert.equal(u.estimate, 0.62);
});

test("10x and 100x are left alone; 1,000x and 1,000,000x are corrected", () => {
  assert.equal(econScaleGap(684, 68.4), 1);
  assert.equal(econScaleGap(684, 6.84), 1);
  assert.equal(econScaleGap(684, 0.684), 1000);
  assert.equal(econScaleGap(0.684, 684), 1 / 1000);
  assert.equal(econScaleGap(684e6, 684), 1e6);
});

test("the surprise is computed from the corrected values, not the feed's mixed ones", () => {
  const out = detectEconSurprises({
    rows: [{ ...NHS, actual: 684, estimate: 0.62, previous: 607 }],
    historyByEvent: hist([[627, 640], [640, 630], [610, 625], [600, 615], [650, 645]]),
    ts: "2026-09-24T17:00:00Z", minHistory: 3,
  });
  assert.equal(out.events.length, 1);
  assert.equal(out.events[0].detail.surprise, 64, "actual - estimate at one scale: +64, not +683.38");
  assert.equal(out.events[0].detail.unit_fix.ref, "previous");
  assert.match(out.events[0].detail.rule, /filed on another scale/);
});

test("a history row that cannot be put on one scale is dropped instead of widening the yardstick", () => {
  const withBad = detectEconSurprises({
    rows: [{ ...NHS, actual: 684, estimate: 0.62, previous: 607 }],
    historyByEvent: hist([[627, 640], [640, 630], [610, 625], [0.6, 615]]),
    ts: "2026-09-24T17:00:00Z", minHistory: 3,
  });
  const clean = detectEconSurprises({
    rows: [{ ...NHS, actual: 684, estimate: 0.62, previous: 607 }],
    historyByEvent: hist([[627, 640], [640, 630], [610, 625]]),
    ts: "2026-09-24T17:00:00Z", minHistory: 3,
  });
  assert.equal(withBad.events[0].detail.n_prints, clean.events[0].detail.n_prints,
    "the ambiguous past print took no part");
  assert.equal(withBad.events[0].detail.z, clean.events[0].detail.z);
});

test("a row whose own two numbers are a thousand apart fires nothing at all", () => {
  const out = detectEconSurprises({
    rows: [{ ...NHS, actual: 0.66, estimate: 655, previous: null }],
    historyByEvent: hist([[627, 640], [640, 630], [610, 625], [600, 615]]),
    ts: "2026-09-24T17:00:00Z", minHistory: 3,
  });
  assert.equal(out.events.length, 0);
  assert.equal(out.skipped[0].reason, "UNIT_AMBIGUOUS");
});
