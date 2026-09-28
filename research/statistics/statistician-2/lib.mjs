/* STATISTICIAN-2 · pure arithmetic for Alan's second round of statistics questions (28 Sep 2026).
   No fetch, no clock, no file I/O. Used by run.mjs (the study), page.mjs (the page) and tests/statistician-2.test.mjs.
   Obeys the method standard (deliverables/20260928/statistician/plan.json): full distributions, pivots as horizons,
   episodes as the unit of counting, block/episode bootstrap for every range, Benjamini–Hochberg over every cell tried,
   base rates beside every conditional number, censoring kept (Kaplan–Meier) instead of dropped. */
import { mulberry32, quantile, median, mean, share, benjaminiHochberg, stationaryIndices } from "../method/method-lib.mjs";
export { mulberry32, quantile, median, mean, share, benjaminiHochberg };

export const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
export const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
export const fin = (x) => x != null && Number.isFinite(x);
export const dstr = (t) => new Date(t).toISOString().slice(0, 10);

/* ------------------------------ RSI floors and ceilings (Q1) ------------------------------ */
export const RSI_LADDER = [1, 2, 5, 10, 25, 50, 75, 90, 95, 98, 99];
export const FLOOR_LEVELS = Array.from({ length: 41 }, (_, i) => 10 + i);   // 10..50
export const CEILING_LEVELS = Array.from({ length: 41 }, (_, i) => 55 + i); // 55..95
/** Runs of consecutive true flags → [{s, e}] (inclusive). */
export function runsOf(flags) { const out = []; let s = -1; for (let i = 0; i <= flags.length; i++) { const on = i < flags.length && flags[i]; if (on && s < 0) s = i; if (!on && s >= 0) { out.push({ s, e: i - 1 }); s = -1; } } return out; }
/** For one RSI series: share of days at/below each floor level and at/above each ceiling level, visits per year, visit length, and the percentile ladder. */
export function rsiProfile(rsi, dates) {
  const v = rsi.filter(fin), n = v.length; if (n < 250) return null;
  const years = (Date.parse(dates[dates.length - 1]) - Date.parse(dates[0])) / (365.25 * 864e5);
  const sorted = [...v].sort((a, b) => a - b);
  const floors = FLOOR_LEVELS.map((L) => { const on = rsi.map((x) => fin(x) && x <= L); const runs = runsOf(on); return { L, days: 100 * on.filter(Boolean).length / n, perYear: runs.length / years, len: median(runs.map((r) => r.e - r.s + 1)) }; });
  const ceilings = CEILING_LEVELS.map((L) => { const on = rsi.map((x) => fin(x) && x >= L); const runs = runsOf(on); return { L, days: 100 * on.filter(Boolean).length / n, perYear: runs.length / years, len: median(runs.map((r) => r.e - r.s + 1)) }; });
  const ladder = Object.fromEntries(RSI_LADDER.map((p) => [p, quantile(sorted, p / 100)]));
  return { n, years: r1(years), from: dates[0], to: dates[dates.length - 1], floors, ceilings, ladder, min: sorted[0], max: sorted[n - 1] };
}
/** Group summary: median across members and the 10th–90th spread across members, for a key of the profile. */
export function groupOf(profiles, pick) {
  const vals = profiles.map(pick).filter(fin).sort((a, b) => a - b);
  return vals.length ? { n: vals.length, med: quantile(vals, 0.5), lo: quantile(vals, 0.1), hi: quantile(vals, 0.9) } : null;
}

/* ------------------------------ waits and survival (Q2) ------------------------------ */
/** Kaplan–Meier survival of a wait: items [{t, ev}] (ev=false → censored: still waiting at t). Returns {steps:[[t, S]], median}. */
export function kaplanMeier(items) {
  const a = items.filter((x) => fin(x.t)).sort((p, q) => p.t - q.t); let atRisk = a.length, S = 1; const steps = [[0, 1]]; let med = null;
  for (let i = 0; i < a.length;) { const t = a[i].t; let d = 0, c = 0; while (i < a.length && a[i].t === t) { if (a[i].ev) d++; else c++; i++; } if (d > 0 && atRisk > 0) { S *= 1 - d / atRisk; steps.push([t, S]); if (med == null && S <= 0.5) med = t; } atRisk -= d + c; }
  return { steps, median: med, n: a.length, censored: a.filter((x) => !x.ev).length };
}
/** Ranks with ties averaged. */
export function ranks(a) { const n = a.length, o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(n); let i = 0; while (i < n) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const rr = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = rr; i = j + 1; } return r; }
export function pearson(x, y) { const n = x.length; if (n < 3) return null; const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (x[i] - mx) * (y[i] - my); sxx += (x[i] - mx) ** 2; syy += (y[i] - my) ** 2; } return sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : null; }
export function spearman(x, y) { return pearson(ranks(x), ranks(y)); }
/** Partial Spearman of x with y, holding z fixed (rank-based partial correlation). */
export function partialSpearman(x, y, z) { const rxy = spearman(x, y), rxz = spearman(x, z), ryz = spearman(y, z); if (![rxy, rxz, ryz].every(fin)) return null; const d = Math.sqrt((1 - rxz ** 2) * (1 - ryz ** 2)); return d > 0 ? (rxy - rxz * ryz) / d : null; }
/** Residual of rank(y) after a straight line on rank(z): "y with z taken out", still a rank-scale number. */
export function rankResidual(y, z) { const ry = ranks(y), rz = ranks(z), n = y.length, my = (n + 1) / 2, mz = my; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (rz[i] - mz) * (ry[i] - my); sxx += (rz[i] - mz) ** 2; } const b = sxx > 0 ? sxy / sxx : 0; return ry.map((v, i) => v - my - b * (rz[i] - mz)); }
/** Bootstrap over episodes (rows are independent units) of stat(rows). Returns {est, lo, hi, p} where p = two-sided share of draws across `base` (default 0). */
export function episodeBootstrap(rows, stat, { reps = 1000, seed = 7, base = 0 } = {}) {
  const est = stat(rows); if (!fin(est)) return null; const rng = mulberry32(seed), n = rows.length, draws = [];
  for (let r = 0; r < reps; r++) { const s = new Array(n); for (let i = 0; i < n; i++) s[i] = rows[Math.floor(rng() * n)]; const v = stat(s); if (fin(v)) draws.push(v); }
  draws.sort((a, b) => a - b); const below = draws.filter((d) => d <= base).length / draws.length;
  return { est, lo: quantile(draws, 0.05), hi: quantile(draws, 0.95), p: Math.min(1, 2 * Math.min(below, 1 - below)), n };
}
/** Block bootstrap over day-ordered rows (stationary, mean block = block) of stat(rows). */
export function blockBootstrap(rows, stat, { reps = 500, seed = 7, block = 63, base = 0 } = {}) {
  const est = stat(rows); if (!fin(est)) return null; const rng = mulberry32(seed), n = rows.length, draws = [];
  for (let r = 0; r < reps; r++) { const idx = stationaryIndices(n, block, rng); const v = stat(idx.map((i) => rows[i])); if (fin(v)) draws.push(v); }
  draws.sort((a, b) => a - b); const below = draws.filter((d) => d <= base).length / draws.length;
  return { est, lo: quantile(draws, 0.05), hi: quantile(draws, 0.95), p: Math.min(1, 2 * Math.min(below, 1 - below)), n };
}
/** Status word of the standard's R10: luck-proof when the FDR-adjusted p ≤ q and n ≥ 20; leaning when the raw range clears; else a list. */
export function statusWord(n, p, pAdj, q = 0.1) { if (!fin(p)) return "no data"; if (n < 20) return "a list"; if (fin(pAdj) && pAdj <= q) return "luck-proof"; if (p <= q) return "leaning"; return "not shown"; }

/* ------------------------------ forward outcomes ------------------------------ */
export function fwdReturn(c, i, h) { return i + h < c.length && c[i] > 0 ? 100 * (c[i + h] / c[i] - 1) : null; }
/** Deepest close below today's close within the next h sessions, in % (≤ 0). */
export function fwdMaxDrawdown(c, i, h) { if (i + h >= c.length || !(c[i] > 0)) return null; let m = c[i]; for (let k = i + 1; k <= i + h; k++) if (c[k] < m) m = c[k]; return 100 * (m / c[i] - 1); }
/** First index after i whose high exceeds level, or -1. */
export function firstAbove(h, i, level) { for (let k = i; k < h.length; k++) if (h[k] > level) return k; return -1; }
/** Length of the current run of flag up to and including i (0 when off). */
export function runLengths(flags) { const out = new Array(flags.length).fill(0); for (let i = 0; i < flags.length; i++) out[i] = flags[i] ? (i > 0 ? out[i - 1] : 0) + 1 : 0; return out; }
/** Slope of a series over `k` sessions in % (today vs k sessions ago). */
export function slopePct(xs, k) { return xs.map((x, i) => i >= k && fin(x) && fin(xs[i - k]) && xs[i - k] > 0 ? 100 * (x / xs[i - k] - 1) : null); }
/** Expanding own-history percentile (prior values only), needs minN earlier readings. */
export function ownPct(xs, minN = 250) {
  const sorted = [], out = new Array(xs.length).fill(null);
  const lower = (x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; } return lo; };
  const upper = (x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; } return lo; };
  for (let i = 0; i < xs.length; i++) { const x = xs[i]; if (!fin(x)) continue; if (sorted.length >= minN) { const lo = lower(x), hi = upper(x); out[i] = 100 * (lo + (hi - lo) / 2) / sorted.length; } sorted.splice(lower(x), 0, x); }
  return out;
}
/** Equal-weight daily-rebalanced basket: members[y] = symbols for calendar year y; closes: {sym → Map(date → close)}. Returns [{d, ret, n}] on `dates`. */
export function basketReturns(dates, members, closes) {
  const out = []; let prev = null;
  for (const d of dates) { const y = +d.slice(0, 4), syms = members[y] || []; let s = 0, n = 0;
    if (prev) for (const sym of syms) { const m = closes[sym]; const a = m?.get(prev), b = m?.get(d); if (a > 0 && b > 0) { s += b / a - 1; n++; } }
    out.push({ d, ret: n ? 100 * s / n : null, n }); prev = d; }
  return out;
}
/** Chain daily % returns into a level starting at 100 (null returns hold the level). */
export function chain(rets) { let v = 100; return rets.map((r) => { if (fin(r)) v *= 1 + r / 100; return v; }); }
/** Percentiles of a distribution in one object. */
export function dist(xs, ps = [10, 25, 50, 75, 90]) { const a = xs.filter(fin).sort((p, q) => p - q); if (!a.length) return null; const o = { n: a.length }; for (const p of ps) o["p" + p] = quantile(a, p / 100); return o; }
/** Equal-count bins of a numeric key: returns bin index per row (0..k-1) and the bin edges. */
export function equalBins(vals, k = 5) { const idx = vals.map((v, i) => i).filter((i) => fin(vals[i])).sort((a, b) => vals[a] - vals[b]); const bin = new Array(vals.length).fill(null); const edges = []; for (let j = 0; j < k; j++) { const a = Math.floor(j * idx.length / k), b = Math.floor((j + 1) * idx.length / k); for (let q = a; q < b; q++) bin[idx[q]] = j; edges.push([vals[idx[a]], vals[idx[Math.max(a, b - 1)]]]); } return { bin, edges }; }
