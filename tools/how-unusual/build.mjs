/* Builds data/how-unusual.json: for each index and macro reading Alan watches,
   how unusual every level of the daily RSI has been in that symbol's own history,
   and what usually happened next. Everything here is counted from finished daily
   bars served by the chart API. Nothing is estimated and nothing is assumed.

   Run:  node tools/how-unusual/build.mjs                                       */

import { pathToFileURL } from "node:url";

const API = "https://scintilla-massive-chart-api.fly.dev";

export const SYMBOLS = [
  { t: "SPY",   name: "S&P 500 fund",        kind: "index", moves: "the fund" },
  { t: "QQQ",   name: "Nasdaq 100 fund",     kind: "index", moves: "the fund" },
  { t: "IWM",   name: "Small caps fund",     kind: "index", moves: "the fund" },
  { t: "DIA",   name: "Dow fund",            kind: "index", moves: "the fund" },
  { t: "VIX",   name: "Volatility index",    kind: "macro", moves: "the index" },
  { t: "US10Y", name: "Ten-year yield",      kind: "macro", moves: "the yield" },
  { t: "DXUSD", name: "Dollar index",        kind: "macro", moves: "the index" },
  { t: "CLUSD", name: "Oil",                 kind: "macro", moves: "the price" },
  { t: "GCUSD", name: "Gold",                kind: "macro", moves: "the price" },
];

export const LEVELS_LOW  = [20, 25, 30, 35, 40, 45];
export const LEVELS_HIGH = [55, 60, 65, 70, 75, 80];
export const HORIZONS = [5, 20, 60];

export function rsi14(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d >= 0) gain += d; else loss -= d;
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + (d > 0 ? d : 0)) / period;
    loss = (loss * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

const median = (a) => {
  if (!a.length) return null;
  const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
};
const pct = (n, d) => (d ? (n / d) * 100 : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

/** forward move in % from day i to day i+h, using finished bars only */
function forward(closes, i, h) {
  if (i + h >= closes.length) return null;
  return (closes[i + h] / closes[i] - 1) * 100;
}

function outcomes(closes, idx, h) {
  const moves = [];
  for (const i of idx) { const m = forward(closes, i, h); if (m != null && isFinite(m)) moves.push(m); }
  if (!moves.length) return { n: 0, up_pct: null, median_pct: null };
  return {
    n: moves.length,
    up_pct: r2(pct(moves.filter((m) => m > 0).length, moves.length)),
    median_pct: r2(median(moves)),
  };
}

export function levelStats(closes, rsi, level, side) {
  const daysIdx = [], episodesIdx = [];
  for (let i = 0; i < rsi.length; i++) {
    const v = rsi[i]; if (v == null) continue;
    const hit = side === "below" ? v <= level : v >= level;
    if (!hit) continue;
    daysIdx.push(i);
    const prev = rsi[i - 1];
    if (prev == null || !(side === "below" ? prev <= level : prev >= level)) episodesIdx.push(i);
  }
  const measured = rsi.filter((v) => v != null).length;
  const yearsOfDays = measured / 252;   // years of days we actually hold, so a hole cannot flatter the rate
  const out = {
    level, side,
    days: daysIdx.length,
    days_pct: r2(pct(daysIdx.length, measured)),
    episodes: episodesIdx.length,
    per_year: r2(episodesIdx.length / yearsOfDays),
  };
  for (const h of HORIZONS) out["fwd" + h] = outcomes(closes, episodesIdx, h);
  return out;
}

/** 0..100 curve: curve[k] = the RSI value at the k-th percentile of this symbol's history */
export function percentileCurve(rsi) {
  const vals = rsi.filter((v) => v != null).sort((a, b) => a - b);
  const curve = [];
  for (let k = 0; k <= 100; k++) curve.push(r2(vals[Math.min(vals.length - 1, Math.round((k / 100) * (vals.length - 1)))]));
  return curve;
}

export async function fetchDaily(symbol) {
  const r = await fetch(`${API}/candles?symbol=${encodeURIComponent(symbol)}&tf=D&limit=40000`);
  if (!r.ok) throw new Error(`${symbol}: candles ${r.status}`);
  const j = await r.json();
  const series = (j.series || []).filter((b) => isFinite(b.c) && b.c > 0).sort((a, b) => a.t - b.t);
  return { series, provider: j.provider, full_series_count: j.full_series_count, requested_through: j?.provider_refresh?.requested_through_et || null };
}

/** stretches of calendar time with no bars at all — a hole in the history, named not averaged over */
export function findGaps(series, minDays = 30) {
  const gaps = [];
  for (let i = 1; i < series.length; i++) {
    const days = (series[i].t - series[i - 1].t) / 864e5;
    if (days >= minDays) gaps.push({
      from: new Date(series[i - 1].t).toISOString().slice(0, 10),
      to: new Date(series[i].t).toISOString().slice(0, 10),
      calendar_days: Math.round(days),
    });
  }
  return gaps;
}

export function buildSymbol(meta, series, provider) {
  const closes = series.map((b) => b.c);
  const days = series.map((b) => new Date(b.t).toISOString().slice(0, 10));
  const rsi = rsi14(closes);
  const measured = rsi.filter((v) => v != null).length;
  const first = days[0], last = days[days.length - 1];
  const years = (new Date(last) - new Date(first)) / (365.2425 * 864e5);
  const baseIdx = []; for (let i = 0; i < rsi.length; i++) if (rsi[i] != null) baseIdx.push(i);
  const baseline = {}; for (const h of HORIZONS) baseline["fwd" + h] = outcomes(closes, baseIdx, h);
  const levels = [
    ...LEVELS_LOW.map((L) => levelStats(closes, rsi, L, "below")),
    ...LEVELS_HIGH.map((L) => levelStats(closes, rsi, L, "above")),
  ];
  let latest = null;
  for (let i = rsi.length - 1; i >= 0; i--) if (rsi[i] != null) { latest = { rsi: r2(rsi[i]), date: days[i], close: r2(closes[i]) }; break; }
  return {
    ...meta, provider,
    history: { first_day: first, last_finished_day: last, daily_bars: series.length, rsi_days_measured: measured,
               years: r2(years), years_of_days: r2(measured / 252), gaps: findGaps(series),
               expected_trading_days: Math.round(years * 252) },
    latest, baseline, levels, percentile_curve: percentileCurve(rsi),
  };
}

async function main() {
  const built = [];
  for (const meta of SYMBOLS) {
    const { series, provider, full_series_count, requested_through } = await fetchDaily(meta.t);
    if (series.length !== full_series_count) {
      console.error(`  ! ${meta.t}: got ${series.length} rows, the API counts ${full_series_count}`);
    }
    const rec = buildSymbol(meta, series, provider);
    rec.history.api_count = full_series_count;
    rec.history.requested_through_et = requested_through;
    built.push(rec);
    console.error(`  ${meta.t.padEnd(6)} ${rec.history.daily_bars} bars ${rec.history.first_day}..${rec.history.last_finished_day}  RSI now ${rec.latest.rsi}`);
  }
  const doc = {
    built_utc: new Date().toISOString(),
    source: "chart API /candles?tf=D, finished daily bars only",
    method: "RSI(14) Wilder over closes; an episode is the first day a run crosses the level; what followed is measured from that first day to the close 5, 20 or 60 finished days later",
    symbols: built,
  };
  process.stdout.write(JSON.stringify(doc));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
