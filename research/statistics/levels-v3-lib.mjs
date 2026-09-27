/* Scintilla · rulebook v3 chapter 1 · levels become per-instrument lines. Pure functions, no fetch, no clock.
   Shared by research/statistics/levels-v3.mjs (the build) and tests/levels-v3.test.mjs (hand-checked fixtures).

   The three forms of every line, stated once:
   · P  — PERCENTILE: where today's reading ranks among the name's OWN prior readings (3 years, or all history).
          The line "below its own 10th percentile" is the 10th-percentile value of the prior window.
   · Z  — STANDARD SCORE OF THE READING: (reading − own prior mean) ÷ own prior sd. The line Z ≤ −1.2816 is where
          a bell curve would put the 10th percentile. Drawn on a chart it is the "mean − k·sd" band, so the
          "sd-band" line and the Z line are the same rule and are counted once.
   · σ  — THE BOARD'S SIGMA (the name's usual day): the price move itself measured in the name's own usual days.
          For the RSI family: the 14-session return ÷ (usual day × √14). For the 200-day family: the distance to
          the 200-day ÷ (usual day × √(200/3)) — under a random walk that is the spread of a price around its own
          200-day average, so −1.2816 is again the nominal 10% line. For the daily move: move ÷ prior usual day.
   Prior observations only: every line for day i is drawn from values strictly before day i. */

import { quantile, percentileOf, BREAK_DAYS } from "./stats.mjs";

export const Z10 = -1.2815516;          // standard normal 10th percentile
export const SQRT14 = Math.sqrt(14);
export const D200_SCALE = Math.sqrt(200 / 3);

/** Index where the analysed history starts: after the last hole longer than BREAK_DAYS calendar days. */
export function segmentStart(bars) {
  let start = 0;
  for (let i = 1; i < bars.length; i++) if (Math.round((bars[i].t - bars[i - 1].t) / 86400e3) > BREAK_DAYS) start = i;
  return start;
}

/** Bars per calendar year, measured: ~252 for exchange-traded names, ~365 for a 7-day market such as BTCUSD. */
export function barsPerYear(bars) {
  if (bars.length < 30) return 252;
  const days = (bars[bars.length - 1].t - bars[0].t) / 86400e3;
  return days > 0 ? Math.round((bars.length - 1) / (days / 365.25)) : 252;
}

export function williamsR(h, l, c, n = 14) {
  const out = new Array(c.length).fill(null);
  for (let i = n - 1; i < c.length; i++) {
    let hh = -Infinity, ll = Infinity;
    for (let k = i - n + 1; k <= i; k++) { if (h[k] > hh) hh = h[k]; if (l[k] < ll) ll = l[k]; }
    out[i] = hh === ll ? null : -100 * (hh - c[i]) / (hh - ll);
  }
  return out;
}

/** Daily move in the name's PRIOR usual days (the board's sigma): move[i] ÷ usual[i−1]. */
export function sigmaRatio(moves, usual) {
  return moves.map((m, i) => (m == null || i < 1 || usual[i - 1] == null || !(usual[i - 1] > 0)) ? null : m / usual[i - 1]);
}

/** σ form of the RSI family: the 14-session % return ÷ (usual day before the 14 sessions began × √14). */
export function sigma14(closes, usual) {
  return closes.map((c, i) => {
    if (i < 14 || !(closes[i - 14] > 0) || usual[i - 14] == null || !(usual[i - 14] > 0)) return null;
    return ((c / closes[i - 14] - 1) * 100) / (usual[i - 14] * SQRT14);
  });
}

/** σ form of the 200-day family: distance to the 200-day ÷ (prior usual day × √(200/3)). */
export function sigmaD200(dist200, usual) {
  return dist200.map((d, i) => (d == null || i < 1 || usual[i - 1] == null || !(usual[i - 1] > 0)) ? null : d / (usual[i - 1] * D200_SCALE));
}

function lowerBound(a, v) { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m] < v) lo = m + 1; else hi = m; } return lo; }

/** Walk one reading through history and draw, for every day i, the lines the PRIOR days would have drawn.
    window = number of prior sessions (Infinity = all prior history). Returns typed arrays aligned to the series:
    n (valid prior values), lo/hi (the qLo/qHi quantile lines), mean, sd. NaN where fewer than minN prior values. */
export function walkLines(series, window, { qLo = 0.10, qHi = 0.90, minN = 252 } = {}) {
  const N = series.length;
  const out = { n: new Int32Array(N), lo: new Float64Array(N).fill(NaN), hi: new Float64Array(N).fill(NaN),
    mean: new Float64Array(N).fill(NaN), sd: new Float64Array(N).fill(NaN) };
  const sorted = []; let sum = 0, sq = 0;
  const ok = (v) => v != null && Number.isFinite(v);
  for (let i = 0; i < N; i++) {
    if (i >= 1) {                                    // day i−1 enters the prior window
      const v = series[i - 1];
      if (ok(v)) { sorted.splice(lowerBound(sorted, v), 0, v); sum += v; sq += v * v; }
      const j = i - 1 - window;                       // the day that has just left the window
      if (Number.isFinite(window) && j >= 0 && ok(series[j])) {
        const w = series[j]; const k = lowerBound(sorted, w);
        if (sorted[k] === w) sorted.splice(k, 1);
        sum -= w; sq -= w * w;
      }
    }
    const n = sorted.length; out.n[i] = n;
    if (n >= minN) {
      out.lo[i] = quantile(sorted, qLo); out.hi[i] = quantile(sorted, qHi);
      const m = sum / n; out.mean[i] = m;
      out.sd[i] = Math.sqrt(Math.max(0, (sq - n * m * m) / (n - 1)));
    }
  }
  return out;
}

/** Days and episodes a rule fired between index `from` and `to` inclusive. A new episode starts when the rule
    fires after at least `gap` sessions without firing (one selloff is one episode, however many days it lasts). */
export function countFires(fire, from, to, gap = 5) {
  let days = 0, episodes = 0, last = -Infinity; const starts = [];
  for (let i = Math.max(0, from); i <= to && i < fire.length; i++) {
    if (!fire[i]) continue;
    days++;
    if (i - last > gap) { episodes++; starts.push(i); }
    last = i;
  }
  return { days, episodes, starts };
}

/** Pullback episodes from a high: an episode opens when the close drops below the running high H and closes when a
    close regains H (recovered) or when `timeout` sessions pass without regaining it. Qualified = the high was at or
    above its 200-day AND the deepest close sat at least `minUsual` usual days (the usual day measured at the high)
    below H. The low is the lowest close inside the episode — a hindsight fact, used only to describe where past
    pullbacks ended, never as a trigger. */
export function pullbackEpisodes(closes, sma200, usual, { timeout = 250, minUsual = 2.5 } = {}) {
  const eps = []; let H = closes[0], jH = 0, m = 0, low = closes[0];
  const close = (i, recovered) => {
    const depth = (low / H - 1) * 100; const ud = usual[jH];
    const qualified = sma200[jH] != null && H >= sma200[jH] && ud != null && ud > 0 && -depth >= minUsual * ud;
    if (m > jH) eps.push({ jH, H, m, low, end: i, recovered, depth, depthUsual: ud ? depth / ud : null, qualified });
  };
  for (let i = 1; i < closes.length; i++) {
    const c = closes[i];
    if (c >= H) { if (m > jH) close(i, true); H = c; jH = i; m = i; low = c; continue; }
    if (c < low) { low = c; m = i; }
    if (i - jH >= timeout) { close(i, false); H = c; jH = i; m = i; low = c; }
  }
  if (m > jH) eps.push({ jH, H, m, low, end: null, recovered: false, depth: (low / H - 1) * 100,
    depthUsual: usual[jH] ? ((low / H - 1) * 100) / usual[jH] : null, qualified: false, open: true });
  return eps;
}

/** Live-knowable pullback triggers: the FIRST session inside an episode (high at or above the 200-day) when the
    drawdown from the running high reaches a threshold. Thresholds are fixed % depths, or "own" = the median depth
    of this name's completed, qualified episodes that ENDED before today (at least `minPrior` of them). */
export function pullbackTriggers(closes, sma200, episodes, { fixed = [5, 10, 20, 30], minPrior = 5 } = {}) {
  const done = episodes.filter((e) => e.qualified && e.end != null).sort((a, b) => a.end - b.end);
  const out = []; let H = closes[0], jH = 0; let fired = new Set(); let k = 0; const priorDepths = [];
  const ownMedian = () => { if (priorDepths.length < minPrior) return null; const s = [...priorDepths].sort((a, b) => a - b); return quantile(s, 0.5); };
  for (let i = 1; i < closes.length; i++) {
    while (k < done.length && done[k].end <= i - 1) { priorDepths.push(-done[k].depth); k++; }
    const c = closes[i];
    if (c >= H) { H = c; jH = i; fired = new Set(); continue; }
    if (i - jH >= 250) { H = c; jH = i; fired = new Set(); continue; }
    if (!(sma200[jH] != null && H >= sma200[jH])) continue;
    const dd = -(c / H - 1) * 100;
    for (const f of fixed) if (dd >= f && !fired.has(f)) { fired.add(f); out.push({ i, jH, H, kind: "fixed", level: f, dd }); }
    const own = ownMedian();
    if (own != null && dd >= own && !fired.has("own")) { fired.add("own"); out.push({ i, jH, H, kind: "own", level: own, dd }); }
  }
  return out;
}

/** What followed a trigger at i: returns after h sessions, and whether the close regained H within `regain` sessions. */
export function followed(closes, i, H, { horizons = [20, 60], regain = 60 } = {}) {
  const r = {};
  for (const h of horizons) r["ret" + h] = i + h < closes.length ? (closes[i + h] / closes[i] - 1) * 100 : null;
  if (i + regain < closes.length) { let hit = false, mn = Infinity; for (let k = i + 1; k <= i + regain; k++) { if (closes[k] >= H) hit = true; if (closes[k] < mn) mn = closes[k]; }
    r.regained = hit; r.mae = (mn / closes[i] - 1) * 100; }
  else { r.regained = null; r.mae = null; }
  return r;
}

/** Spearman rank correlation over the days where both series are valid. */
export function spearman(a, b) {
  const idx = []; for (let i = 0; i < a.length; i++) if (a[i] != null && b[i] != null && Number.isFinite(a[i]) && Number.isFinite(b[i])) idx.push(i);
  const n = idx.length; if (n < 3) return null;
  const rank = (vals) => { const o = vals.map((v, k) => [v, k]).sort((x, y) => x[0] - y[0]); const r = new Array(n);
    for (let s = 0; s < n;) { let e = s; while (e + 1 < n && o[e + 1][0] === o[s][0]) e++; const avg = (s + e) / 2 + 1; for (let q = s; q <= e; q++) r[o[q][1]] = avg; s = e + 1; } return r; };
  const ra = rank(idx.map((i) => a[i])), rb = rank(idx.map((i) => b[i]));
  const m = (n + 1) / 2; let num = 0, da = 0, db = 0;
  for (let k = 0; k < n; k++) { const x = ra[k] - m, y = rb[k] - m; num += x * y; da += x * x; db += y * y; }
  return num / Math.sqrt(da * db);
}

/** Summary of a list of numbers: n, share above zero, median and quartiles. */
export function summarise(xs) {
  const v = xs.filter((x) => x != null && Number.isFinite(x)); const n = v.length;
  if (!n) return { n: 0, up: null, median: null, q25: null, q75: null };
  const s = [...v].sort((a, b) => a - b);
  return { n, up: 100 * v.filter((x) => x > 0).length / n, median: quantile(s, 0.5), q25: quantile(s, 0.25), q75: quantile(s, 0.75) };
}

export { percentileOf, quantile };
