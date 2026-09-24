// Shared offline fixtures for the Trendoscope Phase 0/1 tests. No network, no browser.
// The detector itself is NOT modelled here: see research/trendoscope/MISSING-DETECTOR-SOURCES.md.
import { CANONICAL_SETTINGS, settingsSha256, LABEL_BY_ID } from "../research/trendoscope/lib/settings.mjs";

export const BAR_MS = 4 * 3600e3;
export const bars = (n = 60, base = 100) => Array.from({ length: n }, (_, i) => ({
  i, t: Date.UTC(2026, 0, 1) + i * BAR_MS,
  o: base + i * 0.5, h: base + i * 0.5 + 1.2, l: base + i * 0.5 - 1.1, c: base + i * 0.5 + 0.2, v: 1000 + i,
}));

export const CONTEXT = Object.freeze({
  detector_family: "trendoscope_acp",
  detector_source_sha256: "f".repeat(64),
  library_versions: CANONICAL_SETTINGS.pine_libraries,
  settings: CANONICAL_SETTINGS,
  settings_sha256: settingsSha256(),
  symbol: "TEST", feed: "MASSIVE", exchange: "XNAS", asset_class: "equity",
  source_timeframe: "4H", session_mode: "provider_stream:PROVIDER_ET",
  timezone: "America/New_York", adjustment_mode: "SPLIT_ADJUSTED", price_scale: "linear",
  tick_size: 0.01,
});

/** A well-formed event with alternating pivots and a confirmation AFTER the last anchor. */
export function makeEvent(over = {}) {
  const t = (i) => Date.UTC(2026, 0, 1) + i * BAR_MS;
  // An unknown id must reach validateEvent() rather than crash the fixture.
  const label = LABEL_BY_ID.get(over.pattern_type_id ?? 9)
    ?? { id: over.pattern_type_id, name: over.pattern_name ?? "Unknown",
         shape: "channel", direction: "rising", dynamics: "parallel" };
  const pivots = (over.pivots ?? [
    { seq: 1, side: "low", source_bar_index: 10, price: 100 },
    { seq: 2, side: "high", source_bar_index: 14, price: 112 },
    { seq: 3, side: "low", source_bar_index: 18, price: 103 },
    { seq: 4, side: "high", source_bar_index: 22, price: 110 },
    { seq: 5, side: "low", source_bar_index: 26, price: 105 },
  ]).map((p) => ({ ...p, epoch: t(p.source_bar_index), is_synthetic: p.is_synthetic ?? false,
    known_at_epoch: p.known_at_epoch ?? t(p.source_bar_index) }));
  const conf = over.confirmed_at_index ?? 28;
  return {
    ...CONTEXT, capture_run_id: "test-run", extractor_version: "test",
    pattern_type_id: label.id, pattern_name: label.name, shape_group: label.shape,
    direction_family: label.direction, formation_dynamics: label.dynamics,
    zigzag_lane: 1, zigzag_level: 0, pivot_count: pivots.length, pivots,
    upper_rail: { p1_index: 14, p1_epoch: t(14), p1_price: 112, p2_index: 22, p2_epoch: t(22), p2_price: 110, xloc: "bar_index" },
    lower_rail: { p1_index: 10, p1_epoch: t(10), p1_price: 100, p2_index: 26, p2_epoch: t(26), p2_price: 105, xloc: "bar_index" },
    formation_start_index: 10, formation_start_epoch: t(10),
    formation_end_index: 26, formation_end_epoch: t(26),
    confirmed_at_index: conf, confirmed_at_epoch: t(conf),
    first_observed_at: t(conf), last_observed_at: null,
    coordinate_status: "resolved", missing_reason: null,
    ...over,
  };
}

/**
 * A DECLARED TEST DOUBLE. It is not the Trendoscope detector and makes no attempt to be:
 * it accepts one fixed pattern at a fixed bar so the harness itself can be tested.
 */
export class TestDoubleDetector {
  constructor(acceptAt = [28, 40]) { this.acceptAt = acceptAt; this.seen = []; }
  onBar({ window, index }) {
    this.seen.push(index);
    if (!this.acceptAt.includes(index)) return [];
    window.get(index); // legal: current bar
    const e = makeEvent({ confirmed_at_index: index });
    delete e.confirmed_at_epoch; delete e.first_observed_at; delete e.capture_run_id;
    return [e];
  }
}
