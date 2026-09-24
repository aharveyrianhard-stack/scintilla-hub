// Derived clustering (packet §7). The raw event store is NEVER deduplicated; this builds a
// separate derived table in which every member keeps its raw id, lane/level and geometry.
// Cross-feed, cross-session and cross-timeframe merges are refused by construction.
import { canonicalJson, sha256 } from "./settings.mjs";
import { railAt } from "./geometry.mjs";
export const CLUSTER_RULE_VERSION = "cluster-0.1.0";
export const DEFAULTS = Object.freeze({ min_anchor_overlap: 0.80, confirm_bars: 2, confirm_frac: 0.10, rail_atr: 0.15 });

const partitionKey = (e) => canonicalJson([e.symbol, e.feed, e.source_timeframe, e.session_mode,
  e.adjustment_mode, e.price_scale, e.detector_source_sha256, e.settings_sha256]);

/** Stage 1 — exact identity (packet §7.1). */
export function exactIdentityKey(e, tickSize = e.tick_size) {
  const tickNorm = (p) => (tickSize ? Math.round(p / tickSize) : p);
  return sha256(canonicalJson({
    partition: partitionKey(e), pattern_type_id: e.pattern_type_id,
    anchors: e.pivots.map((p) => [p.epoch, tickNorm(p.price)]),
    rails: [[e.upper_rail.p1_epoch, tickNorm(e.upper_rail.p1_price), e.upper_rail.p2_epoch, tickNorm(e.upper_rail.p2_price)],
            [e.lower_rail.p1_epoch, tickNorm(e.lower_rail.p1_price), e.lower_rail.p2_epoch, tickNorm(e.lower_rail.p2_price)]],
  }));
}

const overlapRatio = (a, b) => {
  const lo = Math.max(a.formation_start_epoch, b.formation_start_epoch);
  const hi = Math.min(a.formation_end_epoch, b.formation_end_epoch);
  const inter = Math.max(0, hi - lo);
  const longer = Math.max(a.formation_end_epoch - a.formation_start_epoch,
                          b.formation_end_epoch - b.formation_start_epoch);
  return longer > 0 ? inter / longer : 0;
};

/** Stage 2 — near-duplicate clustering. Thresholds are frozen defaults, reported not assumed. */
export function clusterEvents(events, { atrByEvent = new Map(), opts = DEFAULTS } = {}) {
  const groups = new Map();
  for (const e of events) {
    const k = `${partitionKey(e)}|${e.shape_group}`;
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }
  const clusters = [];
  for (const [, list] of groups) {
    list.sort((a, b) => a.confirmed_at_epoch - b.confirmed_at_epoch || a.event_id.localeCompare(b.event_id));
    const assigned = new Map();
    for (const e of list) {
      let target = null;
      for (const c of clusters) {
        if (c.partition !== partitionKey(e) || c.shape_group !== e.shape_group) continue;
        const rep = c.members[c.members.length - 1];
        if (overlapRatio(rep, e) < opts.min_anchor_overlap) continue;
        const durBars = Math.max(rep.formation_end_index - rep.formation_start_index,
                                 e.formation_end_index - e.formation_start_index);
        const allowed = Math.max(opts.confirm_bars, opts.confirm_frac * durBars);
        if (Math.abs(e.confirmed_at_index - rep.confirmed_at_index) > allowed) continue;
        const later = Math.max(e.confirmed_at_index, rep.confirmed_at_index);
        const atr = atrByEvent.get(e.event_id) ?? atrByEvent.get(rep.event_id) ?? null;
        if (atr) {
          const du = Math.abs(railAt(e.upper_rail, later) - railAt(rep.upper_rail, later)) / atr;
          const dl = Math.abs(railAt(e.lower_rail, later) - railAt(rep.lower_rail, later)) / atr;
          if (du > opts.rail_atr || dl > opts.rail_atr) continue;
        }
        target = c; break;
      }
      if (!target) {
        target = { cluster_rule_version: CLUSTER_RULE_VERSION, partition: partitionKey(e),
          shape_group: e.shape_group, members: [], exact_identity_keys: new Set() };
        clusters.push(target);
      }
      target.members.push(e);
      target.exact_identity_keys.add(exactIdentityKey(e));
      assigned.set(e.event_id, target);
    }
  }
  return clusters.map((c, i) => ({
    pattern_cluster_id: sha256(canonicalJson([c.partition, c.shape_group, c.members.map((m) => m.event_id).sort()])),
    cluster_rule_version: c.cluster_rule_version,
    ordinal: i,
    shape_group: c.shape_group,
    member_event_ids: c.members.map((m) => m.event_id),
    member_count: c.members.length,
    exact_identity_count: c.exact_identity_keys.size,
    // Cluster weight 1 for primary inference (packet §7).
    cluster_weight: 1,
    representative_event_id: c.members[0].event_id,
    members_provenance: c.members.map((m) => ({ event_id: m.event_id, zigzag_lane: m.zigzag_lane,
      zigzag_level: m.zigzag_level, settings_sha256: m.settings_sha256,
      confirmed_at_epoch: m.confirmed_at_epoch, pattern_type_id: m.pattern_type_id })),
  }));
}
