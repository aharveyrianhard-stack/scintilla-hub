// Chronological replay harness (packet §6.1). The harness is detector-agnostic on purpose:
// the Trendoscope detector itself is NOT ported, because its rules live entirely inside the
// six CC BY-NC-SA Pine libraries, which are not present on this machine
// (research/trendoscope/MISSING-DETECTOR-SOURCES.md). Approximating find(...) is forbidden.
import { sealEvent, validateEvent } from "./event.mjs";
import { canonicalJson, sha256, EXTRACTOR_VERSION } from "./settings.mjs";
export const HARNESS_VERSION = "replay-0.1.0";

/** A bar window that physically cannot read the future: index > cursor throws. */
export function pastOnlyWindow(bars, cursor) {
  return Object.freeze({
    length: cursor + 1,
    get(i) {
      if (i > cursor) throw new Error(`LEAKAGE: detector asked for bar ${i} at cursor ${cursor}`);
      if (i < 0) throw new Error(`bad bar index ${i}`);
      return bars[i];
    },
    last() { return bars[cursor]; },
    slice(from = 0) { return bars.slice(from, cursor + 1); },
  });
}

/** The detector boundary. Everything else in this file is proven; this is the missing piece. */
export class NotPortedDetector {
  constructor() {
    this.reason = "TRENDOSCOPE_LIBRARY_SOURCE_UNAVAILABLE";
    this.missing = ["Trendoscope/utils/6", "Trendoscope/ohlc/3", "Trendoscope/LineWrapper/2",
      "Trendoscope/ZigzagLite/4", "Trendoscope/abstractchartpatterns/10", "Trendoscope/basechartpatterns/9"];
  }
  onBar() {
    const err = new Error(`${this.reason}: find(...) cannot be reproduced faithfully without ${this.missing.join(", ")}`);
    err.code = this.reason;
    err.missing = this.missing;
    throw err;
  }
}

/**
 * Feed bars in time order; emit one immutable event per acceptance, stamped with the bar the
 * detector accepted it on. Retention state (20, avoid-overlap ON) is detector state and is
 * passed back in, exactly as the Pine does.
 */
export function replay({ bars, detector, context, capture_run_id, maxPatterns = 20 }) {
  for (let i = 1; i < bars.length; i++) {
    if (!(bars[i].t > bars[i - 1].t)) {
      throw new Error(`bars are not strictly chronological at index ${i} (t=${bars[i].t})`);
    }
  }
  const events = [];
  const retained = [];
  const rejections = [];
  for (let i = 0; i < bars.length; i++) {
    const accepted = detector.onBar({ window: pastOnlyWindow(bars, i), index: i, retained: retained.slice(), context }) ?? [];
    for (const pattern of accepted) {
      if (pattern.confirmed_at_index !== i) {
        throw new Error(`LEAKAGE: pattern confirmed_at_index ${pattern.confirmed_at_index} emitted at bar ${i}`);
      }
      const event = sealEvent({
        ...context, ...pattern,
        capture_run_id,
        extractor_version: EXTRACTOR_VERSION,
        confirmed_at_epoch: bars[i].t,
        first_observed_at: bars[i].t,
        last_observed_at: null,
      });
      const check = validateEvent(event);
      if (!check.ok) { rejections.push({ bar: i, problems: check.problems }); continue; }
      events.push(event);
      retained.push(event);
      while (retained.length > maxPatterns) retained.shift(); // original push/erase behaviour
    }
  }
  return { events, rejections, retained_final: retained.length, harness_version: HARNESS_VERSION };
}

/** Geometry digest for the determinism gate: ids AND geometry must be identical. */
export const geometryDigest = (events) => sha256(canonicalJson(events.map((e) => [
  e.event_id, e.pattern_type_id, e.confirmed_at_epoch,
  e.pivots.map((p) => [p.seq, p.side, p.source_bar_index, p.epoch, p.price]),
  [e.upper_rail, e.lower_rail].map((r) => [r.p1_index, r.p1_price, r.p2_index, r.p2_price]),
])));

/** Gate: three identical replays produce identical ordered event IDs and geometry (packet §11). */
export function tripleReplay(args) {
  const runs = [0, 1, 2].map(() => replay(args));
  const ids = runs.map((r) => r.events.map((e) => e.event_id).join(","));
  const geo = runs.map((r) => geometryDigest(r.events));
  return {
    gate: "chronological_determinism",
    runs: runs.length,
    event_counts: runs.map((r) => r.events.length),
    ids_identical: ids[0] === ids[1] && ids[1] === ids[2],
    geometry_identical: geo[0] === geo[1] && geo[1] === geo[2],
    geometry_digest: geo[0],
    pass: ids[0] === ids[1] && ids[1] === ids[2] && geo[0] === geo[1] && geo[1] === geo[2],
    first_run: runs[0],
  };
}
