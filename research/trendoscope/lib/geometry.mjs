// Versioned derived-feature transformation (packet §3) and the preregistration-default
// tolerance/touch rules (packet §4). Derived features NEVER live in the raw event packet.
// Every rail is evaluated in SOURCE BAR distance, never in elapsed milliseconds (packet §3).
export const TRANSFORM_VERSION = "geom-0.1.0";

/** rail(i) = p1 + (p2 - p1) * (i - i1) / (i2 - i1). Vertical rails are refused, not fudged. */
export function railAt(rail, i) {
  const { p1_index: i1, p1_price: q1, p2_index: i2, p2_price: q2 } = rail;
  if (i1 === i2) throw new Error("degenerate rail: p1_index === p2_index");
  return q1 + (q2 - q1) * (i - i1) / (i2 - i1);
}
/** Price units per SOURCE BAR. */
export const railSlopePerBar = (rail) => {
  if (rail.p1_index === rail.p2_index) throw new Error("degenerate rail");
  return (rail.p2_price - rail.p1_price) / (rail.p2_index - rail.p1_index);
};
/** Display-oriented only; kept separate so it can never be mistaken for the per-bar slope. */
export const railSlopePerSecond = (rail) => {
  const ds = (rail.p2_epoch - rail.p1_epoch) / 1000;
  return ds === 0 ? null : (rail.p2_price - rail.p1_price) / ds;
};

/** Wilder ATR (TradingView ta.atr). Returns an array aligned to bars; null before warmup. */
export function atrSeries(bars, length = 14) {
  const out = new Array(bars.length).fill(null);
  let prev = null;
  for (let i = 0; i < bars.length; i++) {
    const b = bars[i], p = bars[i - 1];
    const tr = i === 0 ? b.h - b.l
      : Math.max(b.h - b.l, Math.abs(b.h - p.c), Math.abs(b.l - p.c));
    if (i === length - 1) {
      let sum = 0;
      for (let k = 0; k <= i; k++) {
        const c = bars[k], q = bars[k - 1];
        sum += k === 0 ? c.h - c.l : Math.max(c.h - c.l, Math.abs(c.h - q.c), Math.abs(c.l - q.c));
      }
      prev = sum / length;
      out[i] = prev;
    } else if (i >= length) {
      prev = (prev * (length - 1) + tr) / length;
      out[i] = prev;
    }
  }
  return out;
}

/** tau = max(2*tick, 0.10*ATR14 at confirmation). Sensitivities are separate runs (packet §4). */
export function tolerance(tickSize, atrAtConfirmation, { mode = "primary" } = {}) {
  if (mode === "zero") return 0;
  if (mode === "one_tick") return tickSize;
  if (mode === "atr25") return Math.max(2 * tickSize, 0.25 * atrAtConfirmation);
  return Math.max(2 * tickSize, 0.10 * atrAtConfirmation);
}

/**
 * Contact episodes on one rail. Consecutive touching bars are ONE episode, and distinct
 * episodes need at least `minGap` non-touching source bars between them (packet §4).
 * Synthetic construction points are never counted as traded touches — the caller passes
 * anchor indices so they can be reported separately, not silently merged.
 */
export function touchEpisodes(bars, rail, { from, to, tau, side, anchorIndices = [], minGap = 2 }) {
  const touching = [];
  for (let i = from; i <= to && i < bars.length; i++) {
    const b = bars[i];
    if (!b) continue;
    const r = railAt(rail, i);
    const hit = side === "upper"
      ? b.h >= r - tau && b.h <= r + tau
      : b.l >= r - tau && b.l <= r + tau;
    if (hit) touching.push(i);
  }
  const episodes = [];
  for (const i of touching) {
    const last = episodes[episodes.length - 1];
    if (last && i - last.end <= minGap) { last.end = i; last.bars.push(i); }
    else episodes.push({ start: i, end: i, bars: [i] });
  }
  const anchors = new Set(anchorIndices);
  return episodes.map((e) => ({ ...e, is_anchor_contact: e.bars.some((i) => anchors.has(i)) }));
}

const widthAt = (upper, lower, i) => railAt(upper, i) - railAt(lower, i);

/** Packet §3 derived formation features. Returns nulls with a reason rather than guesses. */
export function deriveFeatures(event, bars, { atr = null, sessionHoursFn = null } = {}) {
  const idx = (i) => bars[i];
  const upper = event.upper_rail, lower = event.lower_rail;
  const anchorIdx = event.pivots.map((p) => p.source_bar_index);
  const start = Math.min(...anchorIdx), end = Math.max(...anchorIdx);
  const conf = event.confirmed_at_index;
  const A = atr ?? atrSeries(bars);
  const atrConf = A[conf] ?? null;
  const tick = event.tick_size;

  const wStart = widthAt(upper, lower, start);
  const wEnd = widthAt(upper, lower, end);
  const wConf = conf != null ? widthAt(upper, lower, conf) : null;
  const midStart = (railAt(upper, start) + railAt(lower, start)) / 2;
  const midEnd = (railAt(upper, end) + railAt(lower, end)) / 2;
  const closeConf = idx(conf)?.c ?? null;

  const residuals = event.pivots.map((p) => {
    const rail = p.side === "high" ? upper : lower;
    const resid = p.price - railAt(rail, p.source_bar_index);
    return { seq: p.seq, side: p.side, residual_price: resid,
      residual_ticks: tick ? resid / tick : null,
      residual_atr: atrConf ? resid / atrConf : null, is_synthetic: !!p.is_synthetic };
  });

  const tau = atrConf != null ? tolerance(tick, atrConf) : null;
  const upperTouches = tau == null ? null : touchEpisodes(bars, upper, { from: start, to: end, tau, side: "upper", anchorIndices: anchorIdx });
  const lowerTouches = tau == null ? null : touchEpisodes(bars, lower, { from: start, to: end, tau, side: "lower", anchorIndices: anchorIdx });

  const sides = event.pivots.map((p) => p.side);
  return {
    transform_version: TRANSFORM_VERSION,
    duration_bars: end - start,
    elapsed_seconds: (event.formation_end_epoch - event.formation_start_epoch) / 1000,
    session_hours: sessionHoursFn ? sessionHoursFn(event.formation_start_epoch, event.formation_end_epoch) : null,
    session_hours_reason: sessionHoursFn ? null : "no session calendar supplied for this feed",
    upper_slope_per_bar: railSlopePerBar(upper),
    lower_slope_per_bar: railSlopePerBar(lower),
    upper_slope_log_per_bar: safeLogSlope(upper),
    lower_slope_log_per_bar: safeLogSlope(lower),
    upper_slope_atr_per_bar: atrConf ? railSlopePerBar(upper) / atrConf : null,
    lower_slope_atr_per_bar: atrConf ? railSlopePerBar(lower) / atrConf : null,
    upper_slope_per_second: railSlopePerSecond(upper),
    lower_slope_per_second: railSlopePerSecond(lower),
    width_start_price: wStart, width_end_price: wEnd, width_confirm_price: wConf,
    width_start_pct: midStart ? (wStart / midStart) * 100 : null,
    width_end_pct: midEnd ? (wEnd / midEnd) * 100 : null,
    width_confirm_pct: wConf != null && closeConf ? (wConf / closeConf) * 100 : null,
    width_start_atr: atrConf ? wStart / atrConf : null,
    width_end_atr: atrConf ? wEnd / atrConf : null,
    width_confirm_atr: atrConf && wConf != null ? wConf / atrConf : null,
    convergence: (wEnd - wStart) / Math.max(Math.abs(wStart), 1e-12),
    midpoint_slope_per_bar: (midEnd - midStart) / Math.max(end - start, 1),
    channel_drift: midEnd - midStart,
    atr14_at_confirmation: atrConf,
    tolerance_tau: tau,
    anchor_residuals: residuals,
    max_abs_residual_ticks: tick ? Math.max(...residuals.map((r) => Math.abs(r.residual_ticks))) : null,
    alternating_sides_valid: sides.every((s, i) => i === 0 || s !== sides[i - 1]),
    equal_time_flag: new Set(anchorIdx).size !== anchorIdx.length,
    equal_price_flag: new Set(event.pivots.map((p) => p.price)).size !== event.pivots.length,
    synthetic_pivot_count: event.pivots.filter((p) => p.is_synthetic).length,
    upper_touch_episodes: upperTouches?.length ?? null,
    lower_touch_episodes: lowerTouches?.length ?? null,
    total_touch_episodes: upperTouches && lowerTouches ? upperTouches.length + lowerTouches.length : null,
    non_anchor_touch_episodes: upperTouches && lowerTouches
      ? [...upperTouches, ...lowerTouches].filter((e) => !e.is_anchor_contact).length : null,
    rails_cross_within_formation: railsCross(upper, lower, start, end),
  };
}
const safeLogSlope = (rail) => (rail.p1_price > 0 && rail.p2_price > 0
  ? (Math.log(rail.p2_price) - Math.log(rail.p1_price)) / (rail.p2_index - rail.p1_index) : null);

/** geometry_crossed (packet §4): upper must stay above lower across the window. */
export function railsCross(upper, lower, from, to) {
  const a = widthAt(upper, lower, from), b = widthAt(upper, lower, to);
  return a <= 0 || b <= 0 || (a > 0) !== (b > 0);
}
