// Required output tables A, B, C and I (packet §10). Phase 0/1 only: no outcome statistics.
export const TABLES_VERSION = "tables-0.1.0";

export function quantiles(values) {
  const v = values.filter((x) => Number.isFinite(x)).sort((a, b) => a - b);
  if (!v.length) return { n: 0, median: null, iqr: null, p5: null, p95: null, q1: null, q3: null, min: null, max: null };
  const at = (q) => {
    const pos = (v.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return lo === hi ? v[lo] : v[lo] + (v[hi] - v[lo]) * (pos - lo);
  };
  const q1 = at(0.25), q3 = at(0.75);
  return { n: v.length, median: at(0.5), q1, q3, iqr: q3 - q1, p5: at(0.05), p95: at(0.95), min: v[0], max: v[v.length - 1] };
}

/** Table A — extraction and parity QA. */
export const tableA = (rows) => ({
  table: "A", title: "extraction and parity QA", version: TABLES_VERSION,
  columns: ["run_id", "symbol", "feed", "timeframe", "session", "scale", "bars", "raw_events",
    "complete_events", "unresolved_events", "endpoint_checks", "endpoint_mismatches",
    "replay_hash_match", "notes"],
  rows,
});

/** Table B — event census, raw events AND deduped clusters, every dimension the packet lists. */
export function tableB(events, clusters) {
  const dims = { pattern_name: (e) => e.pattern_name, shape_group: (e) => e.shape_group,
    direction_family: (e) => e.direction_family, formation_dynamics: (e) => e.formation_dynamics,
    asset_class: (e) => e.asset_class, symbol: (e) => e.symbol,
    timeframe: (e) => e.source_timeframe, session: (e) => e.session_mode,
    year: (e) => new Date(e.confirmed_at_epoch).getUTCFullYear(),
    duration_bin: (e) => durationBin(e.duration_bars),
    zigzag_lane_level: (e) => `${e.zigzag_lane ?? "null"}/${e.zigzag_level ?? "null"}` };
  const byDim = {};
  for (const [name, f] of Object.entries(dims)) {
    const counts = new Map();
    for (const e of events) {
      const k = String(f(e));
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    byDim[name] = Object.fromEntries([...counts].sort((a, b) => b[1] - a[1]));
  }
  const clusterMembers = new Set(clusters.flatMap((c) => c.member_event_ids));
  return {
    table: "B", title: "event census", version: TABLES_VERSION,
    raw_event_total: events.length,
    deduped_cluster_total: clusters.length,
    events_in_a_cluster: clusterMembers.size,
    mean_members_per_cluster: clusters.length ? clusterMembers.size / clusters.length : null,
    by_dimension_raw: byDim,
    rates: events.length ? Object.fromEntries(Object.entries(byDim.pattern_name)
      .map(([k, n]) => [k, n / events.length])) : {},
  };
}
const durationBin = (d) => d == null ? "unknown" : d < 10 ? "<10" : d < 20 ? "10-19" : d < 40 ? "20-39" : d < 80 ? "40-79" : "80+";

/** Table C — geometry distribution per pattern/timeframe with N, median, IQR, p5/p95. */
export function tableC(records) {
  const groups = new Map();
  for (const r of records) {
    const k = `${r.pattern_name ?? "unlabelled"}|${r.timeframe}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(r);
  }
  const metrics = ["duration_bars", "width_confirm_atr", "width_end_atr", "upper_slope_atr_per_bar",
    "lower_slope_atr_per_bar", "convergence", "max_abs_residual_ticks", "total_touch_episodes",
    "non_anchor_touch_episodes"];
  const rows = [];
  for (const [k, list] of groups) {
    const [pattern_name, timeframe] = k.split("|");
    const row = { pattern_name, timeframe, n: list.length,
      synthetic_point_rate: rate(list, (r) => (r.synthetic_pivot_count ?? 0) > 0),
      nested_event_rate: rate(list, (r) => !!r.is_nested),
      alternating_valid_rate: rate(list, (r) => r.alternating_sides_valid !== false),
      rails_cross_rate: rate(list, (r) => r.rails_cross_within_formation === true) };
    for (const m of metrics) row[m] = quantiles(list.map((r) => r[m]));
    rows.push(row);
  }
  return { table: "C", title: "geometry distribution", version: TABLES_VERSION, metrics, rows };
}
const rate = (list, pred) => (list.length ? list.filter(pred).length / list.length : null);

/** Table I — exclusions and unresolved evidence. Every reason counted, nothing silently dropped. */
export const tableI = (counts) => ({
  table: "I", title: "exclusions and unresolved evidence", version: TABLES_VERSION,
  reasons: Object.entries(counts).map(([reason, detail]) => ({
    reason, count: typeof detail === "number" ? detail : detail.count, note: detail.note ?? null })),
  total: Object.values(counts).reduce((s, d) => s + (typeof d === "number" ? d : d.count), 0),
});
