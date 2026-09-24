// Canonical detector settings and label domain for the Trendoscope/ACP study.
//
// INTERNAL ANALYSIS ONLY. The Trendoscope Pine libraries this study evaluates are
// CC BY-NC-SA 4.0 (packet §1). Nothing here reproduces their source; this file records
// the *settings* of the detector under evaluation and the 13 label domain. No Trendoscope
// code is copied, and no output of this study may be published beyond aggregate tables.
import { createHash } from "node:crypto";

export const PACKET = "TRENDOSCOPE_STATISTICAL_EVALUATION_PACKET_2026-09-23.md";
export const EVAL_SEED = "scintilla-trendoscope-eval-v1"; // packet §5
export const EXTRACTOR_VERSION = "trendoscope-extractor-0.1.0-phase0";

/** Packet §1 canonical settings, including the disabled lanes. */
export const CANONICAL_SETTINGS = Object.freeze({
  detector_family: "trendoscope_acp",
  pine_libraries: Object.freeze({
    "Trendoscope/utils": 6, "Trendoscope/ohlc": 3, "Trendoscope/LineWrapper": 2,
    "Trendoscope/ZigzagLite": 4, "Trendoscope/abstractchartpatterns": 10,
    "Trendoscope/basechartpatterns": 9,
  }),
  price_sources: "chart_native_ohlc",
  zigzag_lanes: Object.freeze([
    { lane: 1, enabled: true, length: 8, depth: 55 },
    { lane: 2, enabled: false, length: 13, depth: 34 },
    { lane: 3, enabled: false, length: 21, depth: 21 },
    { lane: 4, enabled: false, length: 34, depth: 13 },
  ]),
  pattern_pivots: 5,
  line_error_threshold: 0.20,
  flat_threshold: 0.20,
  bar_ratio_check: true,
  bar_ratio_limit: 0.382,
  avoid_overlap: true,
  repaint: false,
  last_pivot_filter: "both",
  pattern_groups: Object.freeze({
    shapes: ["channel", "wedge", "triangle"],
    directions: ["rising", "falling", "non_directional"],
    dynamics: ["expanding", "contracting", "parallel"],
  }),
  retained_patterns: 20,
  calc_bars_count: 5000,
  timeframe_behavior: "chart_native",
  price_scale: "linear",
});

/** The only 13 accepted labels (packet §1). Names are geometry, never forecasts. */
export const PATTERN_LABELS = Object.freeze([
  { id: 1, name: "Ascending Channel", shape: "channel", direction: "rising", dynamics: "parallel" },
  { id: 2, name: "Descending Channel", shape: "channel", direction: "falling", dynamics: "parallel" },
  { id: 3, name: "Ranging Channel", shape: "channel", direction: "non_directional", dynamics: "parallel" },
  { id: 4, name: "Rising Wedge (Expanding)", shape: "wedge", direction: "rising", dynamics: "expanding" },
  { id: 5, name: "Falling Wedge (Expanding)", shape: "wedge", direction: "falling", dynamics: "expanding" },
  { id: 6, name: "Diverging Triangle", shape: "triangle", direction: "non_directional", dynamics: "expanding" },
  { id: 7, name: "Ascending Triangle (Expanding)", shape: "triangle", direction: "rising", dynamics: "expanding" },
  { id: 8, name: "Descending Triangle (Expanding)", shape: "triangle", direction: "falling", dynamics: "expanding" },
  { id: 9, name: "Rising Wedge (Contracting)", shape: "wedge", direction: "rising", dynamics: "contracting" },
  { id: 10, name: "Falling Wedge (Contracting)", shape: "wedge", direction: "falling", dynamics: "contracting" },
  { id: 11, name: "Converging Triangle", shape: "triangle", direction: "non_directional", dynamics: "contracting" },
  { id: 12, name: "Descending Triangle (Contracting)", shape: "triangle", direction: "falling", dynamics: "contracting" },
  { id: 13, name: "Ascending Triangle (Contracting)", shape: "triangle", direction: "rising", dynamics: "contracting" },
]);
export const LABEL_BY_ID = new Map(PATTERN_LABELS.map((l) => [l.id, l]));
export const LABEL_BY_NAME = new Map(PATTERN_LABELS.map((l) => [l.name, l]));

/** Deterministic canonical JSON: sorted keys, no incidental whitespace. */
export function canonicalJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value ?? null);
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  const keys = Object.keys(value).filter((k) => value[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(",")}}`;
}
export const sha256 = (s) => createHash("sha256").update(s, "utf8").digest("hex");
export const settingsSha256 = (settings = CANONICAL_SETTINGS) => sha256(canonicalJson(settings));
