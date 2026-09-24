#!/usr/bin/env node
// Endpoint-parity and geometry audit of the preserved TradingView ACP captures.
// These captures are real detector output, but they are a DRAWING SNAPSHOT, not an event
// ledger (packet §2): there is no confirmation time and no pattern name in them. So they can
// prove endpoint resolution and describe geometry; they can NEVER become the event census.
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { railAt, railSlopePerBar, atrSeries, tolerance, touchEpisodes } from "../lib/geometry.mjs";
import { canonicalJson, sha256 } from "../lib/settings.mjs";
import { quantiles } from "../lib/tables.mjs";

const EV = "/Users/alanharvey/SCINTILLA 0.5/INDICATOR_LAB/sprints/2026-09-17-visual-sprint/evidence";
const OUT = fileURLToPath(new URL("../extracts/", import.meta.url));
const FILES = [["4H", "ACP_CAPTURE_2026-09-24_4H.json"], ["1D", "ACP_CAPTURE_2026-09-24_D.json"]];

const audit = [];
for (const [tf, file] of FILES) {
  const raw = readFileSync(`${EV}/${file}`, "utf8");
  const cap = JSON.parse(raw);
  const bars = cap.bars.map((b) => ({ i: b.bar_index, t: b.time * 1000, o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume }));
  const byIndex = new Map(bars.map((b) => [b.i, b]));
  const A = atrSeries(bars);
  const tick = tf === "4H" ? 1 : 1; // BITSTAMP:BTCUSD quotes to 1.0 on this capture's scale

  const resolved = cap.lines.filter((l) => l.t1 != null && l.t2 != null && l.i1 > -1000000 && l.i2 > -1000000);
  const unresolved = cap.lines.length - resolved.length;

  // Endpoint parity: does each endpoint's index/epoch agree with the capture's own candles,
  // and does its price sit inside that candle's high/low range?
  let checks = 0, epochMismatch = 0, notLoaded = 0, outOfRange = 0;
  const residualsPrice = [], residualsAtr = [];
  for (const l of resolved) {
    for (const [idx, epoch, price] of [[l.i1, l.t1, l.y1], [l.i2, l.t2, l.y2]]) {
      checks++;
      const bar = byIndex.get(idx);
      if (!bar) { notLoaded++; continue; }              // index outside the loaded window
      if (bar.t !== epoch * 1000) epochMismatch++;      // a REAL index/epoch disagreement
      const gap = price > bar.h ? price - bar.h : price < bar.l ? bar.l - price : 0;
      if (gap > 0) outOfRange++;
      residualsPrice.push(gap);
      const a = A[idx];
      if (a) residualsAtr.push(gap / a);
    }
  }

  // Pair rails by colour: the fork paints the upper and lower boundary distinctly.
  const colours = new Map();
  for (const l of resolved) colours.set(l.color, (colours.get(l.color) ?? 0) + 1);
  const pairs = [];
  const used = new Set();
  for (const a of resolved) {
    if (used.has(a.id)) continue;
    let best = null;
    for (const b of resolved) {
      if (b.id === a.id || used.has(b.id) || b.color === a.color) continue;
      const span = Math.min(a.i2, b.i2) - Math.max(a.i1, b.i1);
      if (span <= 0) continue;
      const score = Math.abs(a.i1 - b.i1) + Math.abs(a.i2 - b.i2);
      if (!best || score < best.score) best = { b, score };
    }
    if (best && best.score <= 6) { used.add(a.id); used.add(best.b.id); pairs.push([a, best.b]); }
  }

  const geometry = [];
  for (const [x, y] of pairs) {
    const mk = (l) => ({ p1_index: l.i1, p1_epoch: l.t1 * 1000, p1_price: l.y1, p2_index: l.i2, p2_epoch: l.t2 * 1000, p2_price: l.y2 });
    const ra = mk(x), rb = mk(y);
    const start = Math.max(Math.min(ra.p1_index, rb.p1_index), 0);
    const end = Math.min(Math.max(ra.p2_index, rb.p2_index), bars.length - 1);
    const midA = (railAt(ra, start) + railAt(ra, end)) / 2, midB = (railAt(rb, start) + railAt(rb, end)) / 2;
    const upper = midA >= midB ? ra : rb, lower = midA >= midB ? rb : ra;
    const atrEnd = A[end] ?? null;
    const wS = railAt(upper, start) - railAt(lower, start);
    const wE = railAt(upper, end) - railAt(lower, end);
    const tau = atrEnd ? tolerance(tick, atrEnd) : null;
    geometry.push({
      timeframe: tf, pattern_name: null, pattern_name_reason: "capture holds line primitives only; the Pine pattern name is not in a drawing snapshot",
      upper_line_id: upper === ra ? x.id : y.id, lower_line_id: lower === ra ? x.id : y.id,
      upper_rail: upper, lower_rail: lower,
      window_start_index: start, window_end_index: end,
      window_start_epoch: bars[start].t, window_end_epoch: bars[end].t,
      duration_bars: end - start,
      elapsed_seconds: (bars[end].t - bars[start].t) / 1000,
      upper_slope_per_bar: railSlopePerBar(upper), lower_slope_per_bar: railSlopePerBar(lower),
      upper_slope_atr_per_bar: atrEnd ? railSlopePerBar(upper) / atrEnd : null,
      lower_slope_atr_per_bar: atrEnd ? railSlopePerBar(lower) / atrEnd : null,
      width_start_price: wS, width_end_price: wE,
      width_end_atr: atrEnd ? wE / atrEnd : null, width_confirm_atr: atrEnd ? wE / atrEnd : null,
      convergence: (wE - wS) / Math.max(Math.abs(wS), 1e-12),
      rails_cross_within_formation: wS <= 0 || wE <= 0,
      total_touch_episodes: tau == null ? null :
        touchEpisodes(bars, upper, { from: start, to: end, tau, side: "upper" }).length +
        touchEpisodes(bars, lower, { from: start, to: end, tau, side: "lower" }).length,
      non_anchor_touch_episodes: null, max_abs_residual_ticks: null,
      synthetic_pivot_count: null, alternating_sides_valid: null, is_nested: null,
      confirmed_at_epoch: null, confirmed_at_reason: "no confirmation time exists in a drawing snapshot (packet §2)",
    });
  }

  audit.push({
    timeframe: tf, file, file_sha256: sha256(raw), captured_at: cap.captured_at,
    context: { symbol: cap.context.symbol, resolution: cap.context.resolution,
      session: cap.context.session, scale_log: cap.context.scale?.logarithmic,
      chart_timezone: cap.context.chart_timezone, exchange_timezone: cap.context.exchange_timezone,
      studies: cap.context.studies, chart_id: cap.context.chart_id },
    bars: bars.length, bar_first_epoch: bars[0].t, bar_last_epoch: bars[bars.length - 1].t,
    bars_sha256: sha256(canonicalJson(bars.map((b) => [b.t, b.o, b.h, b.l, b.c]))),
    lines_total: cap.lines.length, lines_resolved: resolved.length, lines_unresolved: unresolved,
    endpoint_checks: checks, endpoint_epoch_mismatches: epochMismatch,
    endpoint_index_not_loaded: notLoaded,
    endpoint_price_outside_candle_range: outOfRange,
    endpoint_price_gap_to_candle: quantiles(residualsPrice),
    endpoint_price_gap_to_candle_atr: quantiles(residualsAtr),
    endpoint_parity_scope: "WITHIN-CAPTURE ONLY: line index/epoch agreement against the capture's own candles, and the gap between a rail endpoint and that candle's high/low range. A rail is a FITTED line under a 20% error threshold, so a non-zero gap is a fitting observation, NOT a parity failure. The packet's endpoint-parity gate needs a fresh TradingView read of the same target and is the coordinator's spot audit.",
    colour_histogram: Object.fromEntries(colours),
    rail_pairs: pairs.length, geometry,
  });
}
mkdirSync(OUT, { recursive: true });
const payload = { generated_utc: new Date().toISOString(),
  note: "Capture fixtures are drawing snapshots, not an event ledger. No confirmation time, no pattern label, therefore excluded from the event census.",
  audits: audit };
writeFileSync(`${OUT}capture-audit.json`, JSON.stringify(payload, null, 1));
for (const a of audit) {
  console.log(`${a.timeframe} ${a.context.symbol} bars=${a.bars} lines=${a.lines_total} resolved=${a.lines_resolved} unresolved=${a.lines_unresolved}`);
  console.log(`   checks=${a.endpoint_checks} epoch-mismatch=${a.endpoint_epoch_mismatches} index-not-loaded=${a.endpoint_index_not_loaded} outside-candle=${a.endpoint_price_outside_candle_range} (median gap ${a.endpoint_price_gap_to_candle.median?.toFixed(2)} = ${a.endpoint_price_gap_to_candle_atr.median?.toFixed(3)} ATR) rail pairs=${a.rail_pairs}`);
}
