// SCINTILLA · RS1 (6 Oct 2026) — a name's daily RSI read against ITS OWN last two years. Pure maths, no I/O.
//
// WHY. Alan, 6 Oct: "I see Netflix at 33 and I don't think that's green enough." and, on colouring RSI by each
// name's own extremes: "dude, that would be awesome … this is an interesting metric, playbook-level, at the
// important levels, for the SPY, for the QQQ, for the macro." A fixed 30 / 70 is one ruler for every name; some
// names live between 40 and 70 and some visit 20 every quarter. Here each name is its own ruler (26 Sep: "the
// Geiger of Micron is never going to go as red as the Geiger of Bitcoin").
//
// ONE FILE, THREE READERS, so they can never drift:
//   supabase/functions/rsi-own-daily/index.ts   the nightly writer of public.rsi_own_percentiles
//   scripts/rsi-own-load.mjs                    the same pass from a Mac, with --dry (what the coordinator runs first)
//   tests/rsi-own-extremes.test.mjs             which also checks the Hub's and the Station's inline copies of the
//                                               colour rule against the functions below, value for value
//
// DEFINITIONS (stated once, used everywhere).
//   RSI           Wilder's RSI(14) on finished DAILY closes — the same recurrence the Station draws
//                 (_indicators/station-rsi-fan.js) — started at the name's first bar, so two years in it has settled.
//   its own two years   every finished daily session in the two calendar years BEFORE the newest finished session
//                 (about 501 sessions for a stock, 729 for a 7-day series such as Bitcoin). The newest session is
//                 the reading being judged, so it is never inside the sample it is compared with — the estate's
//                 "prior observations only" rule (research/statistics/stats.mjs).
//   percentile    where a reading sits in that window, counted by days: 0 = under its lowest day, 100 = at or over
//                 its highest. The stored grid holds the 0th..100th percentile (101 numbers); a live reading is
//                 placed on it by straight-line interpolation, so the browser can place TODAY'S number without
//                 the history.
//   weekend bars  the dollar, oil, gold, silver and the index futures are served with Saturday / Sunday prints; they
//                 are dropped before the RSI (as the research code does), or "two years" would not be two years of
//                 sessions. Bitcoin trades every day and keeps all seven.
//   own extremes  at or below its own 10th percentile, or at or above its own 90th.
//   too young     under one calendar year of its own RSI: no own scale — the page keeps the 30 / 70 colouring.
import { sinceLastJoin } from "../heartbeat-daily/heartbeat.mjs";

export const RSI_OWN_VERSION = "ro-1";
export const RSI_PERIOD = 14;
export const WINDOW_DAYS = 730;            // two calendar years
export const MIN_SPAN_DAYS = 365;          // under one year of its own RSI → not eligible (the brief's fallback)
export const MIN_SESSIONS = 200;           // and a year that is mostly holes is not a year
export const OWN_LO = 10, OWN_HI = 90;     // its own extremes — where the cell goes deep and breathes
export const FALLBACK_LO = 30, FALLBACK_HI = 70;   // the textbook pair, kept ONLY for names with no own scale
/* The chart API's /universe lists the 590 stocks and funds. These thirteen are the macro series it also serves daily
   (its own macro board; the Hub's MACRO tab and its watched RSI cells use the same spellings). The nightly function
   and the Mac loader both append them, so VIX, the yields, the dollar, oil, gold and Bitcoin get an own scale too. */
export const MACRO_SYMBOLS = Object.freeze(["VIX", "US10Y", "US5Y", "US30Y", "US3M", "DXY", "DXUSD", "GCUSD", "CLUSD", "SIUSD", "BTCUSD", "ESUSD", "NQUSD"]);
export const SEVEN_DAY = Object.freeze(["BTCUSD"]);   // trades every day: its weekend bars are real sessions

const msOf = (b) => { const t = b && (b.t ?? b.time ?? b.date); const n = typeof t === "number" ? t : Date.parse(t); return Number.isFinite(n) ? n : null; };
const dayOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const closeOf = (b) => { const c = Number(b && (b.c ?? b.close)); return Number.isFinite(c) && c > 0 ? c : null; };
const r2 = (x) => Math.round(x * 100) / 100;

/** Wilder's RSI. Returns one value per close; null until `period` changes have been seen. */
export function wilderRsi(closes, period = RSI_PERIOD) {
  const out = new Array(closes.length).fill(null);
  let ag = 0, al = 0;
  for (let i = 1; i < closes.length; i++) {
    const ch = closes[i] - closes[i - 1], g = ch > 0 ? ch : 0, l = ch < 0 ? -ch : 0;
    if (i <= period) {
      ag += g; al += l;
      if (i < period) continue;
      ag /= period; al /= period;
    } else {
      ag = (ag * (period - 1) + g) / period;
      al = (al * (period - 1) + l) / period;
    }
    out[i] = al === 0 ? (ag === 0 ? 50 : 100) : 100 - 100 / (1 + ag / al);
  }
  return out;
}

/** The 0th..100th percentile of a list (101 numbers, 2 decimals), straight-line between neighbouring days. */
export function percentileGrid(values) {
  const s = values.filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
  if (!s.length) return null;
  const grid = [];
  for (let k = 0; k <= 100; k++) {
    const i = (s.length - 1) * (k / 100), lo = Math.floor(i), hi = Math.ceil(i);
    grid.push(r2(s[lo] + (s[hi] - s[lo]) * (i - lo)));
  }
  return grid;
}

/** Where `v` sits on a stored grid: 0..100 (one decimal). A reading inside a flat run takes the run's top. */
export function percentileOf(grid, v) {
  const x = v == null || v === "" ? NaN : Number(v);          // an empty reading has no place on the scale (it is not 0)
  if (!Array.isArray(grid) || grid.length !== 101 || !Number.isFinite(x)) return null;
  if (x < grid[0]) return 0;
  if (x >= grid[100]) return 100;
  let k = 0;
  for (let i = 0; i < 100; i++) if (grid[i] <= x) k = i; else break;      // the last step at or under the reading
  const a = grid[k], b = grid[k + 1];
  return Math.round((k + (b > a ? (x - a) / (b - a) : 0)) * 10) / 10;
}

/** One name's row for public.rsi_own_percentiles, or a counted reason for none.
    `barsIn` = finished daily bars, oldest first. `asOf` (YYYY-MM-DD) ignores bars after that session, so every name
    in one load can be computed as of the same close. */
export function rsiOwnRow(symbol, barsIn, { source = "chart-api:/candles?tf=1d", asOf = null } = {}) {
  const sevenDay = SEVEN_DAY.includes(symbol);
  const usable = (barsIn || []).filter((b) => {
    const ms = msOf(b);
    if (ms == null || closeOf(b) == null) return false;
    if (asOf && dayOf(ms) > asOf) return false;
    if (!sevenDay) { const wd = new Date(ms).getUTCDay(); if (wd === 0 || wd === 6) return false; }   // a weekend print is not a session
    return true;
  });
  const cut = sinceLastJoin(usable);
  const bars = cut.bars;
  if (bars.length < RSI_PERIOD + 1 + 20) return { row: null, reason: "SHORT_HISTORY", bars: bars.length };
  const rsi = wilderRsi(bars.map(closeOf));
  const L = bars.length - 1, asOfMs = msOf(bars[L]);
  const floorMs = asOfMs - WINDOW_DAYS * 864e5;
  const win = [];
  let firstMs = null;
  for (let i = 0; i < L; i++) {                                // i < L: the newest session is judged, not sampled
    if (rsi[i] == null || msOf(bars[i]) <= floorMs) continue;
    if (firstMs == null) firstMs = msOf(bars[i]);
    win.push(rsi[i]);
  }
  if (win.length < 20) return { row: null, reason: "SHORT_HISTORY", bars: bars.length };
  const grid = percentileGrid(win);
  const today = r2(rsi[L]);
  const spanDays = Math.round((asOfMs - firstMs) / 864e5);
  return {
    reason: null,
    joins_cut: cut.joins_cut,
    weekend_bars_dropped: (barsIn || []).length - usable.length,
    row: {
      ticker: symbol,
      as_of: dayOf(asOfMs),
      window_from: dayOf(firstMs),
      sessions: win.length,
      eligible: spanDays >= MIN_SPAN_DAYS && win.length >= MIN_SESSIONS,
      rsi: today,
      pct: percentileOf(grid, today),
      p10: grid[10], p20: grid[20], p50: grid[50], p80: grid[80], p90: grid[90],
      grid,
      source,
      version: RSI_OWN_VERSION,
    },
  };
}

/* ── the colour rule (the Hub and the Station each carry an inline copy; the test compares them to these) ───────── */

const NEUTRAL = [178, 178, 186], LOW = [0, 255, 163], HIGH = [255, 45, 85];
const mix = (to, t) => "rgb(" + NEUTRAL.map((c, i) => Math.round(c + (to[i] - c) * t)).join(",") + ")";

/** Today's colouring (the 27 Sep rule), unchanged: tint grows with distance from 50, full by 20 / 80. */
export function rsiFixedColor(v) {
  const n = Number(v); if (v == null || !Number.isFinite(n)) return "";
  const d = (n - 50) / 50;
  if (Math.abs(d) < 0.04) return "var(--ink2)";
  return mix(d < 0 ? LOW : HIGH, 0.35 + 0.65 * Math.min(1, Math.abs(d) / 0.6));
}

/** The same palette on the name's own scale: neutral at its own middle, full green at its own 10th, full red at its own 90th. */
export function rsiOwnColor(pct) {
  const p = Number(pct); if (pct == null || !Number.isFinite(p)) return "";
  const d = (p - 50) / 50;
  if (Math.abs(d) < 0.04) return "var(--ink2)";
  return mix(d < 0 ? LOW : HIGH, 0.35 + 0.65 * Math.min(1, Math.abs(d) / 0.8));
}

export const rsiOwnExtreme = (pct) => pct != null && Number.isFinite(Number(pct)) && (Number(pct) <= OWN_LO || Number(pct) >= OWN_HI);
export const rsiFixedExtreme = (v) => v != null && Number.isFinite(Number(v)) && (Number(v) <= FALLBACK_LO || Number(v) >= FALLBACK_HI);

/** "last two years", or how long the name's own window really is when it is shorter ("last 19 months"). */
export function rsiOwnSpan(windowFrom, asOf) {
  const days = (Date.parse(asOf) - Date.parse(windowFrom)) / 864e5;
  if (!Number.isFinite(days) || days >= 700) return "last two years";
  return "last " + Math.max(12, Math.round(days / 30.44)) + " months";
}

/** The hover line. "33 — lower than 86% of NFLX's last two years". */
export function rsiOwnTitle(ticker, v, pct, span) {
  const n = Math.round(Number(v));
  if (pct == null || !Number.isFinite(Number(pct))) return n + " \u2014 " + ticker + " has under a year of its own history, so this is coloured on the usual 30 / 70 scale";
  const p = Number(pct), of = ticker + "'s " + (span || "last two years");
  if (p <= 0) return n + " \u2014 the lowest reading of " + of;
  if (p >= 100) return n + " \u2014 the highest reading of " + of;
  if (p < 50) return n + " \u2014 lower than " + Math.min(99, Math.round(100 - p)) + "% of " + of;
  return n + " \u2014 higher than " + Math.min(99, Math.round(p)) + "% of " + of;
}

/** Everything a cell needs, from a reading and the name's stored row (or none).
    Three states: an own scale (eligible row) · known too young (a row, not eligible: 30 / 70 and the hover says why) ·
    nothing known (no row, an old row, no table: 30 / 70 and no hover, exactly as the cell was before RS1). */
export function rsiOwnRead(ticker, v, row) {
  const pct = row && row.eligible ? percentileOf(row.grid, v) : null;
  if (pct == null) return { pct: null, own: false, color: rsiFixedColor(v), extreme: rsiFixedExtreme(v), title: row && !row.eligible ? rsiOwnTitle(ticker, v, null) : "" };
  return { pct, own: true, color: rsiOwnColor(pct), extreme: rsiOwnExtreme(pct), title: rsiOwnTitle(ticker, v, pct, rsiOwnSpan(row.window_from, row.as_of)) };
}
