/* LEADERS · shared loaders and small statistics (28 Sep 2026).
   Read-only: reads the durable bar cache (chart API bars) and the FMP snapshots cached for this study.
   Nothing here touches the network or a database. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os";
import { cleanBars, seriesOf as s9Series, swings, cloudState, PIVOT_LEN } from "./s9-research.mjs";

export const BAR_ROOT = path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
export const dstr = (t) => new Date(t).toISOString().slice(0, 10);
export const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
export const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
export const r4 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;

/** Funds, indexes and baskets in the bar cache — not companies, so never a "leader" or a switch target. */
export const NOT_STOCKS = new Set(["ASHR", "COPX", "DIA", "DRAM", "EEM", "EFA", "EWG", "EWJ", "EWU", "EWY", "EZU", "FXI", "GDX", "GDXJ", "GLD", "HYG", "IEF", "IWM", "LQD", "MAGS", "MCHI", "MDY", "QQQ", "QQQE", "RSP", "SHY", "SIL", "SILJ", "SLV", "SMH", "SOXX", "SPY", "TLT", "USO", "VTI", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY", "AGIX"]);

/** Holes in the cached history: a gap of more than MAX_GAP_DAYS calendar days means the ticker most likely belonged to a
    different security before it (reused tickers: META was a fund before 9 Jun 2022, WM was Washington Mutual, MS
    before 2006, BNY / SPCX / SHAZ in 2026). Everything before the last such hole is dropped. */
export const MAX_GAP_DAYS = 20;
export function cutAtHoles(bars, maxGap = MAX_GAP_DAYS) {
  let start = 0;
  for (let i = 1; i < bars.length; i++) if ((bars[i].t - bars[i - 1].t) / 864e5 > maxGap) start = i;
  return { bars: bars.slice(start), cutBefore: start ? dstr(bars[start].t) : null };
}
let PATCH_DIR = null;
/** Patches (FMP daily bars) that replace history the chart API does not have for the right security (META before 9 Jun 2022). */
export function setPatchDir(dir) { PATCH_DIR = dir; }
function patchFor(sym) {
  if (!PATCH_DIR || !fs.existsSync(PATCH_DIR)) return null;
  const f = fs.readdirSync(PATCH_DIR).find((x) => x.startsWith(sym + "-pre-") && x.endsWith(".json"));
  return f ? JSON.parse(fs.readFileSync(path.join(PATCH_DIR, f), "utf8")).series : null;
}
/** Daily bars for one symbol from the cache (candles-f5 first, then daily-bars-s7), wicks cleaned, history cut at holes. */
export function loadBars(sym, root = BAR_ROOT) {
  for (const [dir, key] of [["candles-f5", "series"], ["daily-bars-s7", null], ["daily-bars-s9", "series"]]) {
    const f = path.join(root, dir, sym + ".json");
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8")); let raw = key ? j[key] : j;
    if (!Array.isArray(raw) || raw.length < 2) continue;
    let { bars: cut, cutBefore } = cutAtHoles(raw);
    const patch = patchFor(sym); let patched = false;
    if (patch && patch.length && cutBefore) { const first = cut[0].t; cut = patch.filter((b) => b.t < first).concat(cut); patched = true; }
    const { bars, cleaned } = cleanBars(cut);
    return { bars, cleaned: cleaned.length, src: dir, cutBefore, patched };
  }
  return null;
}
export function listCachedSymbols(root = BAR_ROOT) {
  const set = new Set();
  for (const dir of ["candles-f5", "daily-bars-s7"]) { const p = path.join(root, dir); if (fs.existsSync(p)) for (const f of fs.readdirSync(p)) if (f.endsWith(".json")) set.add(f.slice(0, -5)); }
  return [...set].sort();
}

/** Close on or before a date (binary search over ISO dates). */
export function idxOnOrBefore(dates, d) {
  let a = 0, b = dates.length - 1, best = -1;
  while (a <= b) { const m = (a + b) >> 1; if (dates[m] <= d) { best = m; a = m + 1; } else b = m - 1; }
  return best;
}
export function closeOn(S, d) { const i = idxOnOrBefore(S.dates, d); return i >= 0 ? S.c[i] : null; }

export function median(xs) { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; }
export function quantile(xs, q) { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q2) => p - q2); if (!a.length) return null; const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo); }
/** Every percentile 1..100 of a sample (the full distribution, no chosen cut-off). */
export function percentiles(xs) { const out = []; for (let p = 1; p <= 100; p++) out.push(r2(quantile(xs, p / 100))); return out; }
/** Percentile rank (0..100, mid-rank for ties) of x inside a sample. */
export function pctRank(sample, x) { if (x == null || !sample.length) return null; let below = 0, eq = 0; for (const v of sample) { if (v < x) below++; else if (v === x) eq++; } return 100 * (below + eq / 2) / sample.length; }

export { s9Series, swings, cloudState, PIVOT_LEN };
