/* Quant loop run 1 · the arithmetic for studies S1 and S2 (RULEBOOK-STATS section 4).
   Pure functions, no fetch, no clock. RSI, quantiles and the prior window come from the statistics
   package (research/statistics/stats.mjs) so a reading here is the same number the package prints.

   Stated once:
   · Williams %R(14) = -100 * (highest high of the last 14 bars - close) / (highest high - lowest low),
     today's bar included. When the 14-bar range is zero the reading is undefined (null) and counted.
   · Spearman = Pearson correlation of the two rank series, ties given their average rank.
   · effective sample size (Bartlett): n / (1 + 2 * sum_{k=1..K} rx(k) * ry(k)), rx/ry the lag-k
     autocorrelations of the two rank series. Never above n (a negative sum is capped at n and said so).
   · Fisher interval: tanh(atanh(r) -/+ 1.96 / sqrt(n_eff - 3)).
   · moving-block bootstrap: blocks of `block` consecutive dates, start drawn uniformly, glued until
     the resample has as many dates as the original. Seeded, so the same seed gives the same interval.
   · the 10th-percentile line for day i is the package's quantile(0.10) of the 252 valid readings strictly
     before day i; day i "fires" when its reading is strictly below that line. */
import { rsiWilder, quantile, priorWindow } from "../../../research/statistics/stats.mjs";

export const Z95 = 1.959963984540054;

/** Seeded uniform [0,1) — mulberry32. */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function williamsR(highs, lows, closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let zeroRange = 0;
  for (let i = period - 1; i < closes.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let j = i - period + 1; j <= i; j++) { if (highs[j] > hh) hh = highs[j]; if (lows[j] < ll) ll = lows[j]; }
    if (hh === ll) { zeroRange++; continue; }
    out[i] = -100 * (hh - closes[i]) / (hh - ll) + 0;   // + 0: a close on the high is 0, not -0
  }
  out.zeroRange = zeroRange;
  return out;
}

export function ranks(xs) {
  const idx = xs.map((v, i) => i).sort((a, b) => xs[a] - xs[b]);
  const r = new Array(xs.length);
  for (let i = 0; i < idx.length;) {
    let j = i;
    while (j + 1 < idx.length && xs[idx[j + 1]] === xs[idx[i]]) j++;
    const avg = (i + j) / 2 + 1;
    for (let k = i; k <= j; k++) r[idx[k]] = avg;
    i = j + 1;
  }
  return r;
}

export function pearson(x, y) {
  const n = x.length;
  if (n < 2) return null;
  const mx = x.reduce((s, v) => s + v, 0) / n, my = y.reduce((s, v) => s + v, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = x[i] - mx, b = y[i] - my; sxy += a * b; sxx += a * a; syy += b * b; }
  if (sxx === 0 || syy === 0) return null;          // zero variance: undefined, not zero
  return sxy / Math.sqrt(sxx * syy);
}

export const spearman = (x, y) => pearson(ranks(x), ranks(y));

/** Lag-k autocorrelation with the usual full-sample mean and variance. */
export function acf(x, k) {
  const n = x.length;
  const m = x.reduce((s, v) => s + v, 0) / n;
  let num = 0, den = 0;
  for (let i = 0; i < n; i++) den += (x[i] - m) ** 2;
  for (let i = k; i < n; i++) num += (x[i] - m) * (x[i - k] - m);
  return den === 0 ? null : num / den;
}

export function effectiveN(x, y, K = 50) {
  const n = x.length;
  let s = 0;
  for (let k = 1; k <= K && k < n; k++) {
    const a = acf(x, k), b = acf(y, k);
    if (a == null || b == null) return { n_eff: null, sum: null, capped: false };
    s += a * b;
  }
  const raw = n / (1 + 2 * s);
  return { n_eff: Math.min(n, raw), sum: s, capped: raw > n };
}

export function fisherInterval(r, nEff) {
  if (r == null || nEff == null || nEff <= 3) return null;
  if (Math.abs(r) >= 1) return [r, r];
  const z = Math.atanh(r), se = 1 / Math.sqrt(nEff - 3);
  return [Math.tanh(z - Z95 * se), Math.tanh(z + Z95 * se)];
}

/** One moving-block resample of positions 0..n-1. */
export function blockResample(n, block, u) {
  const out = [];
  const starts = Math.max(1, n - block + 1);
  while (out.length < n) {
    const s = Math.floor(u() * starts);
    for (let j = s; j < s + block && out.length < n; j++) out.push(j);
  }
  return out;
}

export function median(xs) {
  return quantile([...xs].sort((a, b) => a - b), 0.5);
}

export function binomialTolerance(p, n) {
  return Z95 * Math.sqrt(p * (1 - p) / n);
}

/* ------------------------------------------------------------------ S1 */

/** (a) share of valid readings at or below `at`. */
export function shareAtOrBelow(values, at = 30) {
  let n = 0, k = 0;
  for (const v of values) if (v != null) { n++; if (v <= at) k++; }
  return { n, count: k, share: n ? k / n : null };
}

/**
 * (a) the index against its members on the dates they all share.
 * `aligned` = { dates, index: [rsi...], members: {SYM: [rsi...]} } — every array the same length, no nulls.
 */
export function indexVsMembers(aligned, { B = 2000, block = 20, seed = 20260925, at = 30 } = {}) {
  const n = aligned.dates.length;
  const syms = Object.keys(aligned.members);
  const stat = (pos) => {
    const sh = (arr) => pos.reduce((s, p) => s + (arr[p] <= at ? 1 : 0), 0) / pos.length;
    const idx = sh(aligned.index);
    const med = median(syms.map((s) => sh(aligned.members[s])));
    return { idx, med, diff: idx - med };
  };
  const all = Array.from({ length: n }, (_, i) => i);
  const point = stat(all);
  const u = rng(seed);
  const diffs = [];
  for (let b = 0; b < B; b++) diffs.push(stat(blockResample(n, block, u)).diff);
  diffs.sort((a, b) => a - b);
  const ci = [quantile(diffs, 0.025), quantile(diffs, 0.975)];
  const verdict = ci[1] < 0 ? "HOLDS — the index sits at or below 30 less often than the median member"
    : ci[0] > 0 ? "CONTRADICTED — the index sits at or below 30 more often than the median member"
    : "NOT SHOWN — the interval includes zero";
  return { n_dates: n, first: aligned.dates[0], last: aligned.dates[n - 1], members: syms, B, block, seed,
    index_share: point.idx, member_median_share: point.med, diff: point.diff, ci, verdict };
}

/** (b) out-of-sample firing of the trailing 10th-percentile line. */
export function percentileLineCoverage(values, { window = 252, q = 0.10, B = 2000, block = 20, seed = 20260925 } = {}) {
  const fired = [];
  for (let i = 0; i < values.length; i++) {
    if (values[i] == null) continue;
    const w = priorWindow(values, i, window);
    if (w.sessions_covered < window || w.values.length < window) continue;   // full window only
    const line = quantile([...w.values].sort((a, b) => a - b), q);
    fired.push(values[i] < line ? 1 : 0);
  }
  const n = fired.length;
  const k = fired.reduce((s, v) => s + v, 0);
  const share = n ? k / n : null;
  const tol = n ? binomialTolerance(q, n) : null;
  // disclosure only: the same share with a moving-block interval, because neighbouring days are not independent
  const u = rng(seed);
  const reps = [];
  for (let b = 0; b < B && n; b++) { const pos = blockResample(n, block, u); reps.push(pos.reduce((s, p) => s + fired[p], 0) / n); }
  reps.sort((a, b) => a - b);
  const inside = share != null && Math.abs(share - q) <= tol;
  return { n, fired: k, share, target: q, tolerance: tol, band: n ? [q - tol, q + tol] : null,
    block_ci: n ? [quantile(reps, 0.025), quantile(reps, 0.975)] : null,
    verdict: n == null || !n ? "NO DATA" : inside ? "INSIDE — self-calibrating on this name" : "OUTSIDE — not self-calibrating on this name" };
}

/* ------------------------------------------------------------------ S2 */

export const OS_OB = { rsi: { os: 30, ob: 70 }, wr: { os: -80, ob: -20 } };
const stateOf = (v, t) => (v <= t.os ? "OS" : v >= t.ob ? "OB" : "N");

/** One span of paired readings (no nulls): correlation, interval, stamp, state agreement, lift. */
export function pairSpan(rsi, wr, { K = 50, threshold = 0.9 } = {}) {
  const n = rsi.length;
  const rx = ranks(rsi), ry = ranks(wr);
  const rho = pearson(rx, ry);
  const eff = effectiveN(rx, ry, K);
  const ci = fisherInterval(rho, eff.n_eff);
  let agree = 0, rsiOS = 0, wrOS = 0, both = 0;
  for (let i = 0; i < n; i++) {
    const a = stateOf(rsi[i], OS_OB.rsi), b = stateOf(wr[i], OS_OB.wr);
    if (a === b) agree++;
    if (a === "OS") rsiOS++;
    if (b === "OS") wrOS++;
    if (a === "OS" && b === "OS") both++;
  }
  const base = n ? wrOS / n : null;
  const cond = rsiOS ? both / rsiOS : null;
  return { n, rho, n_eff: eff.n_eff, n_eff_capped: eff.capped, ci,
    stamp: ci == null ? "UNDEFINED" : ci[0] >= threshold ? "ONE-WITNESS" : "INDEPENDENT",
    agreement: n ? agree / n : null, rsi_os_days: rsiOS, wr_os_days: wrOS, both_os_days: both,
    wr_os_base: base, wr_os_given_rsi_os: cond, lift: cond != null && base ? cond / base : null };
}

/** Per name: RSI(14) and %R(14) on the same bars, whole history and each half. bars = [{h,l,c,date}]
    `skipDates`: bars flagged as bad high/low prints; a day whose 14-bar %R window touches one is left out. */
export function s2Name(bars, opts = {}, skipDates = new Set()) {
  const c = bars.map((b) => +b.c), h = bars.map((b) => +b.h), l = bars.map((b) => +b.l);
  const r = rsiWilder(c, 14);
  const w = williamsR(h, l, c, 14);
  const rs = [], ws = [], ds = [];
  let lastBad = -Infinity, skipped = 0;
  for (let i = 0; i < c.length; i++) {
    if (skipDates.has(bars[i].date)) lastBad = i;
    if (r[i] == null || w[i] == null) continue;
    if (i - lastBad < 14) { skipped++; continue; }
    rs.push(r[i]); ws.push(w[i]); ds.push(bars[i].date);
  }
  const half = Math.floor(rs.length / 2);
  return {
    first: ds[0], last: ds[ds.length - 1], zero_range_days: w.zeroRange, skipped_near_bad_prints: skipped,
    rsi_at_100_days: r.filter((v) => v === 100).length,
    all: { first: ds[0], last: ds.at(-1), ...pairSpan(rs, ws, opts) },
    early: { first: ds[0], last: ds[half - 1], ...pairSpan(rs.slice(0, half), ws.slice(0, half), opts) },
    late: { first: ds[half], last: ds.at(-1), ...pairSpan(rs.slice(half), ws.slice(half), opts) },
  };
}

/** Re-computing on a shorter history must not change any earlier reading (the loop's G0, no repaint). */
export function prefixStable(fn, n, cuts) {
  const full = fn(n);
  for (const m of cuts) {
    const part = fn(m);
    for (let i = 0; i < m; i++) {
      const a = full[i], b = part[i];
      if ((a == null) !== (b == null)) return { ok: false, at: i, cut: m };
      if (a != null && Math.abs(a - b) > 1e-9) return { ok: false, at: i, cut: m };
    }
  }
  return { ok: true, cuts: cuts.length };
}

/** Bars whose high or low cannot be right: a range over 40% of the close, a high 1.5x above the open/close,
    or a low 1.5x below them (e.g. IWM 2004-07-30: high 5,486.5 on a close of 55). Flagged, never edited. */
export function badHighLow(bars) {
  return bars.filter((b) => (b.h - b.l) / b.c > 0.4 || b.h > 1.5 * Math.max(b.o, b.c) || b.l < Math.min(b.o, b.c) / 1.5)
    .map((b) => b.date);
}
