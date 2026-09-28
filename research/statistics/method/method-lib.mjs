/* METHOD · the statistician's toolbox for Scintilla studies (28 Sep 2026). Pure arithmetic, no I/O, no clock.
   Every study on the Hub reads days that sit next to each other and stocks that fall together, so the honest
   uncertainty is wider than a coin-flip count says. These helpers give the honest version:
   · stationaryBootstrap: Politis & Romano (1994) — resample whole runs of days (random block lengths, mean = block),
     so overlapping windows and clustered episodes keep their dependence. This is the same method `arch` ships
     as StationaryBootstrap, written here in 40 lines so Node studies can use it tonight.
   · blockLength: a rule of thumb from the series' own autocorrelation (Politis & White 2004 shape, simplified):
     the block grows with how long the dependence lasts. Never shorter than the forward horizon.
   · effectiveN: how many independent observations n dependent ones are worth (Kish, from the autocorrelations).
   · wilson: the ordinary binomial interval, for comparison — it assumes independence and is too narrow here.
   · benjaminiHochberg: the false-discovery-rate rule — of the rungs that "beat any day", how many would we
     expect by luck when we tested 100 of them? Keeps the share of false claims below q.
   · mulberry32: a seeded random generator so a study re-runs to the same numbers (a test can pin them). */

export function mulberry32(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
export const mean = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
export const median = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const quantile = (xs, q) => { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q2) => p - q2); if (!a.length) return null; const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo); };
export const share = (xs, f = (x) => x > 0) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.filter(f).length / a.length : null; };

/** Autocorrelation of a series at lag k (nulls dropped pairwise). */
export function autocorr(xs, k) {
  const a = xs.filter((x) => x != null && Number.isFinite(x)); const n = a.length; if (n <= k + 1) return 0;
  const m = a.reduce((s, x) => s + x, 0) / n; let num = 0, den = 0;
  for (let i = 0; i < n; i++) { den += (a[i] - m) ** 2; if (i + k < n) num += (a[i] - m) * (a[i + k] - m); }
  return den > 0 ? num / den : 0;
}
/** Sum of autocorrelations until they fade (Bartlett cut: stop at the first lag below 2/√n, or at maxLag). */
export function dependenceSpan(xs, maxLag = 250) {
  const n = xs.filter((x) => x != null).length, cut = 2 / Math.sqrt(Math.max(n, 4)); let s = 0, k = 1;
  for (; k <= maxLag; k++) { const r = autocorr(xs, k); if (r < cut) break; s += r; }
  return { sum: s, lags: k - 1 };
}
/** Effective sample size: n ÷ (1 + 2·Σρ_k). Kish's rule for a dependent series. */
export function effectiveN(xs, maxLag = 250) { const n = xs.filter((x) => x != null).length; const { sum } = dependenceSpan(xs, maxLag); return n / (1 + 2 * Math.max(0, sum)); }
/** Expected block length: at least the horizon, and at least the span over which the series is correlated. */
export function blockLength(xs, horizon = 1, maxLag = 250) { const { lags } = dependenceSpan(xs, maxLag); return Math.max(horizon, lags + 1, 2); }

/** Politis–Romano stationary bootstrap of index positions 0..n-1: blocks of geometric length (mean = block), wrapping. */
export function stationaryIndices(n, block, rng) {
  const p = 1 / block, out = new Array(n); let i = Math.floor(rng() * n);
  for (let k = 0; k < n; k++) { out[k] = i; i = rng() < p ? Math.floor(rng() * n) : (i + 1) % n; }
  return out;
}
/** Bootstrap distribution of stat(sample) over reps resamples of a day-indexed table. rows: array of records; stat: rows → number. */
export function stationaryBootstrap(rows, stat, { block = 20, reps = 1000, seed = 7 } = {}) {
  const rng = mulberry32(seed), n = rows.length, out = [];
  for (let r = 0; r < reps; r++) { const idx = stationaryIndices(n, block, rng); const v = stat(idx.map((i) => rows[i])); if (v != null && Number.isFinite(v)) out.push(v); }
  out.sort((a, b) => a - b);
  return { draws: out, lo: quantile(out, 0.05), hi: quantile(out, 0.95), lo025: quantile(out, 0.025), hi975: quantile(out, 0.975) };
}
/** Two-sided bootstrap p-value for "stat differs from base": share of draws on the far side of base, doubled and capped. */
export function bootstrapP(draws, base) { if (!draws.length || base == null) return null; const below = draws.filter((d) => d <= base).length / draws.length; return Math.min(1, 2 * Math.min(below, 1 - below)); }

/** Wilson interval for a share (assumes independent draws — shown only as the naive comparison). */
export function wilson(k, n, z = 1.6449) { if (!n) return null; const p = k / n, d = 1 + z * z / n, c = p + z * z / (2 * n), h = z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n)); return { p, lo: (c - h) / d, hi: (c + h) / d }; }

/** Benjamini–Hochberg: which p-values survive at false-discovery rate q. Returns {reject: boolean[], adjusted: number[]}. */
export function benjaminiHochberg(pvals, q = 0.1) {
  const idx = pvals.map((p, i) => [p ?? 1, i]).sort((a, b) => a[0] - b[0]), m = idx.length, adjusted = new Array(m).fill(1), reject = new Array(m).fill(false);
  let running = 1, kmax = -1;
  for (let r = m - 1; r >= 0; r--) { const [p, i] = idx[r]; running = Math.min(running, p * m / (r + 1)); adjusted[i] = running; if (kmax < 0 && p <= q * (r + 1) / m) kmax = r; }
  for (let r = 0; r <= kmax; r++) reject[idx[r][1]] = true;
  return { reject, adjusted };
}
/** Episodes: first day of each unbroken run of `on`. */
export function episodes(on) { const out = []; for (let i = 0; i < on.length; i++) if (on[i] && !(i > 0 && on[i - 1])) out.push(i); return out; }
