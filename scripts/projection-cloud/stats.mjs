// Projection cloud - the statistics, kept pure so tests can pin them.
// Everything works on an instrument's own daily closes; nothing is fitted, forecast or smoothed.

/** Horizons in trading sessions ahead: every session to 20, then every 5th to 250 (one year). */
export const HORIZONS = (() => { const h = []; for (let i = 1; i <= 20; i++) h.push(i); for (let i = 25; i <= 250; i += 5) h.push(i); return h; })();
export const NAMED_HORIZONS = { 5: "1 week", 21: "1 month", 63: "3 months", 126: "6 months", 250: "1 year" };
export const SESSIONS_PER_YEAR = 252;

/** Linear-interpolated quantile of an ascending array. */
export function quantile(sorted, q) {
  const n = sorted.length; if (!n) return null;
  const pos = (n - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export function meanSd(a) {
  const n = a.length; if (!n) return { mu: null, sd: null };
  let s = 0; for (const x of a) s += x; const mu = s / n;
  let v = 0; for (const x of a) v += (x - mu) * (x - mu);
  return { mu, sd: n > 1 ? Math.sqrt(v / (n - 1)) : 0 };
}

/** Share of values <= x, in percent (0..100), on an ascending array. */
export function rankPct(sorted, x) {
  let lo = 0, hi = sorted.length;
  while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; }
  return sorted.length ? (100 * lo) / sorted.length : null;
}

/**
 * Forward bands. For every session i in [from, n-h) take ln(close[i+h] / close[i]).
 * Percentiles of those ratios, plus mean +- 1 and 2 standard deviations of the logs,
 * all returned as MULTIPLIERS of today's close. Horizons with fewer than `min` samples are left empty.
 */
export function forwardBands(closes, { from = 0, horizons = HORIZONS, min = 30 } = {}) {
  const n = closes.length, out = [];
  for (const h of horizons) {
    const r = [];
    for (let i = Math.max(0, from); i + h < n; i++) {
      const a = closes[i], b = closes[i + h];
      if (a > 0 && b > 0) r.push(Math.log(b / a));
    }
    if (r.length < min) { out.push({ h, n: r.length }); continue; }
    r.sort((x, y) => x - y);
    const { mu, sd } = meanSd(r);
    out.push({
      h, n: r.length,
      p05: Math.exp(quantile(r, 0.05)), p25: Math.exp(quantile(r, 0.25)), p50: Math.exp(quantile(r, 0.5)),
      p75: Math.exp(quantile(r, 0.75)), p95: Math.exp(quantile(r, 0.95)),
      mu: Math.exp(mu), s1lo: Math.exp(mu - sd), s1hi: Math.exp(mu + sd), s2lo: Math.exp(mu - 2 * sd), s2hi: Math.exp(mu + 2 * sd),
    });
  }
  return out;
}

/**
 * The trailing-year cloud behind today: for each of the last `back` sessions (every `step`th), the
 * 5/25/50/75/95th percentiles of the closes in the `win` sessions ending there. k = sessions back from today.
 */
export function rollingLevelBands(closes, dates, { win = 250, back = 500, step = 4 } = {}) {
  const n = closes.length, out = [];
  const start = Math.min(back, n - win);
  const ks = []; for (let k = start; k > 0; k -= step) ks.push(k); ks.push(0);
  for (const k of ks) {
    const end = n - 1 - k;
    const w = closes.slice(end - win + 1, end + 1).sort((a, b) => a - b);
    out.push({ k, d: dates[end], q: [quantile(w, 0.05), quantile(w, 0.25), quantile(w, 0.5), quantile(w, 0.75), quantile(w, 0.95)] });
  }
  return out;
}

/** Where today sits: against the trailing year, and against the instrument's own history from `from`. */
export function todayStats(closes, dates, { from = 0, win = 250 } = {}) {
  const n = closes.length, level = closes[n - 1];
  const w = closes.slice(n - win), ws = w.slice().sort((a, b) => a - b);
  const { mu, sd } = meanSd(w);
  const back = closes[n - 1 - win];
  const ret1y = back > 0 ? level / back - 1 : null;
  const hist = [];
  for (let i = Math.max(0, from); i + win < n; i++) if (closes[i] > 0 && closes[i + win] > 0) hist.push(Math.log(closes[i + win] / closes[i]));
  hist.sort((a, b) => a - b);
  const hs = meanSd(hist);
  const lv = closes.slice(Math.max(0, from)).sort((a, b) => a - b);
  return {
    level, date: dates[n - 1], since: dates[Math.max(0, from)], sessions: n - Math.max(0, from),
    mean_1y: mu, sd_1y: sd, z_1y: sd ? (level - mu) / sd : null, pct_level_1y: rankPct(ws, level),
    ret_1y: ret1y, ret_1y_pct: ret1y == null ? null : rankPct(hist, Math.log(1 + ret1y)),
    ret_1y_z: ret1y == null || !hs.sd ? null : (Math.log(1 + ret1y) - hs.mu) / hs.sd,
    pct_level_window: rankPct(lv, level),
  };
}
