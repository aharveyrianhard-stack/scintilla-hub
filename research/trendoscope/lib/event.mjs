// Immutable raw event packet (packet §3): schema, deterministic event_id, validation.
// Raw events are never deduplicated and never carry derived features (packet §3/§7).
import { canonicalJson, sha256, LABEL_BY_ID, LABEL_BY_NAME } from "./settings.mjs";

export const COORDINATE_STATUS = Object.freeze(["resolved", "partial", "unresolved"]);
export const ASSET_CLASSES = Object.freeze(["equity", "etf", "futures", "crypto", "fx", "other"]);

/**
 * event_id = SHA-256 over detector version, settings digest, market identity, lane/level,
 * pattern type and the exact anchors (packet §3). Ephemeral primitive IDs are never keys.
 */
export function eventId(e) {
  return sha256(canonicalJson({
    detector_source_sha256: e.detector_source_sha256,
    settings_sha256: e.settings_sha256,
    market: { symbol: e.symbol, feed: e.feed, exchange: e.exchange,
      source_timeframe: e.source_timeframe, session_mode: e.session_mode,
      adjustment_mode: e.adjustment_mode, price_scale: e.price_scale },
    lane: e.zigzag_lane ?? null, level: e.zigzag_level ?? null,
    pattern_type_id: e.pattern_type_id,
    anchors: (e.pivots ?? []).map((p) => [p.seq, p.side, p.source_bar_index, p.epoch, p.price]),
    rails: [railKey(e.upper_rail), railKey(e.lower_rail)],
  }));
}
const railKey = (r) => (r ? [r.p1_index, r.p1_epoch, r.p1_price, r.p2_index, r.p2_epoch, r.p2_price] : null);

const REQUIRED = ["detector_family", "detector_source_sha256", "library_versions", "settings",
  "settings_sha256", "capture_run_id", "extractor_version", "symbol", "feed", "exchange",
  "asset_class", "source_timeframe", "session_mode", "timezone", "adjustment_mode", "price_scale",
  "tick_size", "pattern_type_id", "pattern_name", "shape_group", "direction_family",
  "formation_dynamics", "pivot_count", "pivots", "upper_rail", "lower_rail",
  "formation_start_index", "formation_start_epoch", "formation_end_index", "formation_end_epoch",
  "confirmed_at_index", "confirmed_at_epoch", "first_observed_at", "coordinate_status"];

/** Returns {ok, problems[]}. Enforces the label domain, confirmation integrity and missing_reason. */
export function validateEvent(e) {
  const problems = [];
  for (const f of REQUIRED) if (e[f] === undefined) problems.push(`missing field: ${f}`);

  const label = LABEL_BY_ID.get(e.pattern_type_id);
  if (!label) problems.push(`pattern_type_id ${e.pattern_type_id} is outside the 13 declared types`);
  else {
    if (e.pattern_name !== label.name) problems.push(`pattern_name "${e.pattern_name}" != id ${e.pattern_type_id}`);
    if (e.shape_group !== label.shape) problems.push("shape_group disagrees with the label domain");
    if (e.direction_family !== label.direction) problems.push("direction_family disagrees with the label domain");
    if (e.formation_dynamics !== label.dynamics) problems.push("formation_dynamics disagrees with the label domain");
  }
  if (e.pattern_name !== undefined && !LABEL_BY_NAME.has(e.pattern_name)) problems.push(`unknown pattern_name ${e.pattern_name}`);
  if (![5, 6].includes(e.pivot_count)) problems.push("pivot_count must be 5 or 6");
  if (Array.isArray(e.pivots) && e.pivots.length !== e.pivot_count) problems.push("pivots length != pivot_count");

  // Confirmation integrity (gate: never backdated to an anchor).
  if (e.confirmed_at_epoch !== undefined && e.formation_end_epoch !== undefined &&
      e.confirmed_at_epoch < e.formation_end_epoch) {
    problems.push("confirmed_at_epoch precedes formation_end_epoch: confirmation was backdated");
  }
  if (e.confirmed_at_index !== undefined && e.formation_end_index !== undefined &&
      e.confirmed_at_index < e.formation_end_index) {
    problems.push("confirmed_at_index precedes formation_end_index: confirmation was backdated");
  }
  // Geometry invariants: ordered, alternating pivots.
  if (Array.isArray(e.pivots) && e.pivots.length > 1) {
    for (let i = 1; i < e.pivots.length; i++) {
      if (e.pivots[i].source_bar_index <= e.pivots[i - 1].source_bar_index) problems.push(`pivots not strictly ordered at seq ${e.pivots[i].seq}`);
      if (e.pivots[i].side === e.pivots[i - 1].side) problems.push(`pivot sides do not alternate at seq ${e.pivots[i].seq}`);
    }
  }
  // Missingness stays visible (packet §6.12): any null coordinate needs a reason.
  const nulls = [];
  for (const r of ["upper_rail", "lower_rail"]) {
    const rail = e[r];
    if (!rail) { nulls.push(r); continue; }
    for (const k of ["p1_index", "p1_epoch", "p1_price", "p2_index", "p2_epoch", "p2_price"]) {
      if (rail[k] === null || rail[k] === undefined) nulls.push(`${r}.${k}`);
    }
  }
  for (const p of e.pivots ?? []) {
    for (const k of ["source_bar_index", "epoch", "price", "known_at_epoch"]) {
      if (p[k] === null || p[k] === undefined) nulls.push(`pivots[${p.seq}].${k}`);
    }
  }
  if (nulls.length && !e.missing_reason) problems.push(`null coordinates without missing_reason: ${nulls.slice(0, 4).join(", ")}`);
  if (nulls.length && e.coordinate_status === "resolved") problems.push("coordinate_status 'resolved' with null coordinates");
  if (!nulls.length && e.coordinate_status !== "resolved") problems.push("all coordinates present but coordinate_status is not 'resolved'");
  if (e.coordinate_status !== undefined && !COORDINATE_STATUS.includes(e.coordinate_status)) problems.push("bad coordinate_status");
  if (e.asset_class !== undefined && !ASSET_CLASSES.includes(e.asset_class)) problems.push("bad asset_class");
  // No future knowledge in an anchor's knowable time.
  for (const p of e.pivots ?? []) {
    if (p.known_at_epoch != null && e.confirmed_at_epoch != null && p.known_at_epoch > e.confirmed_at_epoch) {
      problems.push(`pivot ${p.seq} became knowable after confirmation`);
    }
  }
  return { ok: problems.length === 0, problems };
}

/** Freeze an event: stamp the id, then make it immutable. */
export function sealEvent(e) {
  const withId = { ...e, event_id: e.event_id ?? eventId(e) };
  return Object.freeze(withId);
}
