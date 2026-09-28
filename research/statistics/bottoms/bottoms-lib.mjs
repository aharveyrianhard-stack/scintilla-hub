/* BOTTOMS · pure arithmetic for the 28 Sep "what happens around the lows" study. No fetch, no clock, no file I/O.
   Everything here is reused by the runner (bottoms.mjs), the page and the fixture tests.

   Rules Alan set for this work (28 Sep): no arbitrary windows or cut-offs — full distributions (percentiles 1..100),
   pivots/swings, and own-history percentiles. Research questions, not buy rules.

   · Own-history percentile (ownPct): today's value against EVERY earlier reading of the same series (expanding,
     never a trailing window), stats.mjs convention: 100 × (earlier values below + half the equal ones) / n.
     Needs 250 earlier readings (about one year) before it is shown — a data-sufficiency floor, not a window.
   · Stress orientation: every condition is turned so HIGHER = MORE STRESS (VIX high, put/call high, RSI low,
     far below the 200-day, credit falling, few names above their 50-day).
   · Turn: the nearest swing of the condition's own series by the same pivot rule as prices (S9: 10 bars each side).
   · "A low follows": a confirmed price swing low lies on the day itself or within the next PIVOT_LEN (10) bars.
     A low is "caught" when the condition was on at some bar in the PIVOT_LEN bars up to and including the low. */
import { swings, PIVOT_LEN } from "../s9-research.mjs";

export const ALIGN = { from: -30, to: 60 };

/** Expanding own-history percentile, prior values only. */
export function ownPct(xs, minN = 250) {
  const sorted = [], out = new Array(xs.length).fill(null);
  const lower = (x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] < x) lo = m + 1; else hi = m; } return lo; };
  const upper = (x) => { let lo = 0, hi = sorted.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sorted[m] <= x) lo = m + 1; else hi = m; } return lo; };
  for (let i = 0; i < xs.length; i++) {
    const x = xs[i]; if (x == null || !Number.isFinite(x)) continue;
    if (sorted.length >= minN) { const b = lower(x), e = upper(x); out[i] = 100 * (b + 0.5 * (e - b)) / sorted.length; }
    sorted.splice(upper(x), 0, x);
  }
  return out;
}
export const flip = (p) => p.map((x) => x == null ? null : 100 - x);

/** Swings of a series that may carry nulls: run the pivot rule on its non-null points, return {k, type} in the
    ORIGINAL index space. hi/lo default to the value itself (a one-number series such as put/call). */
export function seriesSwings(vals, len = PIVOT_LEN, hi = null, lo = null) {
  const idx = []; for (let i = 0; i < vals.length; i++) if (vals[i] != null && Number.isFinite(vals[i])) idx.push(i);
  const H = idx.map((i) => hi ? hi[i] ?? vals[i] : vals[i]), L = idx.map((i) => lo ? lo[i] ?? vals[i] : vals[i]);
  return swings(H, L, len).map((p) => ({ k: idx[p.k], type: p.type, price: p.price }));
}

/** The turn of a condition nearest to bar kLow inside [a, b], of the given type ("H" peak, "L" trough). */
export function nearestTurn(turns, type, kLow, a, b) {
  let best = null;
  for (const t of turns) if (t.type === type && t.k >= a && t.k <= b && (best == null || Math.abs(t.k - kLow) < Math.abs(best - kLow))) best = t.k;
  return best == null ? null : best - kLow;
}

/** Map a {date → value} lookup onto an equity's dates. */
export function align(dates, map) { return dates.map((d) => { const v = map.get(d); return v == null || !Number.isFinite(v) ? null : v; }); }
export function toMap(dates, vals) { const m = new Map(); dates.forEach((d, i) => { if (vals[i] != null) m.set(d, vals[i]); }); return m; }

/** Drawdown from the running (all earlier) peak, in %. */
export function drawdownFromPeak(xs) { let pk = null; return xs.map((x) => { if (x == null) return null; pk = pk == null ? x : Math.max(pk, x); return (x / pk - 1) * 100; }); }

/** Values of `arr` at offsets from each anchor; returns per-offset quartiles. rel = "pct" → % change vs the anchor day. */
export function eventAligned(arr, anchors, { from = ALIGN.from, to = ALIGN.to, rel = null } = {}) {
  const rows = [];
  for (let o = from; o <= to; o++) {
    const xs = [];
    for (const k of anchors) {
      const j = k + o; if (j < 0 || j >= arr.length) continue;
      let v = arr[j]; if (v == null) continue;
      if (rel === "pct") { const b = arr[k]; if (b == null || !(b !== 0)) continue; v = (v / b - 1) * 100; }
      xs.push(v);
    }
    xs.sort((a, b) => a - b);
    rows.push({ o, n: xs.length, q1: q(xs, 0.25), med: q(xs, 0.5), q3: q(xs, 0.75) });
  }
  return rows;
}
export function q(sortedAsc, p) { if (!sortedAsc.length) return null; const x = (sortedAsc.length - 1) * p, lo = Math.floor(x), hi = Math.ceil(x); return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (x - lo); }
export const med = (xs) => q(xs.filter((x) => x != null && Number.isFinite(x)).sort((a, b) => a - b), 0.5);

/** nearLow[i] = a swing low sits at i..i+len. usable[i] = far enough from the end for that to be known. */
export function lowFlags(n, lowKs, len = PIVOT_LEN) {
  const near = new Array(n).fill(false), set = new Set(lowKs);
  for (let i = 0; i < n; i++) for (let j = i; j <= i + len && j < n; j++) if (set.has(j)) { near[i] = true; break; }
  const usable = Array.from({ length: n }, (_, i) => i + 2 * len < n);
  const nextLow = new Array(n + 1).fill(Infinity); for (let i = n - 1; i >= 0; i--) nextLow[i] = set.has(i) ? i : nextLow[i + 1];
  return { near, usable, nextLow };
}

/** Base-rate curve for one stress series (0..100, higher = more stress) against the swing lows.
    For each threshold t = 1..99: days at or above t, share of those days followed by a low (hit), the false-alarm
    share (1 − hit), the same by episodes (runs of consecutive days on), and the share of lows the condition caught.
    `on` may be passed instead of a stress series for a yes/no condition (then only t = 0 is reported). */
export function baseRateCurve(stress, lowKs, { len = PIVOT_LEN, thresholds = null, start = 0 } = {}) {
  const n = stress.length, { near, usable, nextLow } = lowFlags(n, lowKs, len);
  const lows = lowKs.filter((k) => k >= start && k + len < n);
  const days = []; for (let i = start; i < n; i++) if (usable[i] && stress[i] != null) days.push(i);
  const base = days.length ? days.filter((i) => near[i]).length / days.length : null;
  const ts = thresholds ?? Array.from({ length: 99 }, (_, i) => i + 1);
  const rows = ts.map((t) => curvePoint(stress, (v) => v >= t, days, near, lows, len, n, t, nextLow));
  return { base: base == null ? null : 100 * base, days: days.length, lows: lows.length, rows };
}
export function curvePoint(stress, test, days, near, lows, len, n, t, nextLow) {
  const on = (i) => stress[i] != null && test(stress[i]);
  const fire = days.filter(on), hit = fire.filter((i) => near[i]).length;
  // episodes: maximal runs of consecutive usable days that are on
  let eps = 0, epHit = 0, i = 0; const daySet = new Set(days);
  while (i < n) {
    if (!(daySet.has(i) && on(i))) { i++; continue; }
    let j = i; while (j + 1 < n && daySet.has(j + 1) && on(j + 1)) j++;
    eps++; if (nextLow[i] <= j + len) epHit++; i = j + 1;
  }
  const caught = lows.filter((k) => { for (let j = Math.max(0, k - len); j <= k; j++) if (on(j)) return true; return false; }).length;
  return { t, days: fire.length, hit: fire.length ? 100 * hit / fire.length : null, episodes: eps, epHit: eps ? 100 * epHit / eps : null,
    falseAlarm: eps ? 100 - 100 * epHit / eps : null, caught: lows.length ? 100 * caught / lows.length : null };
}
/** Combination: every listed stress series at or above t on the same day. */
export function combine(list) { const n = list[0].length; return Array.from({ length: n }, (_, i) => { let m = Infinity; for (const s of list) { if (s[i] == null) return null; m = Math.min(m, s[i]); } return m; }); }

/* ------------------------------ 200-day as a fact ------------------------------ */
/** Per-day outcomes that need no fixed horizon. d = % from the 200-day; swingHighKs = the instrument's swing highs.
    · toNextHigh: close at the next swing high after i / close_i − 1 (%), and the sessions to it
    · fallBeforeHigh: lowest close after i up to that swing high / close_i − 1 (%)
    · below the 200-day only: furtherFall = lowest close after i until the first close back above the 200-day,
      toReclaim = sessions to that close; censored (still below at the end of data) → null, counted separately. */
export function dayOutcomes(c, d, swingHighKs) {
  const n = c.length, out = new Array(n).fill(null), hs = [...swingHighKs].sort((a, b) => a - b);
  let hp = 0, reclaim = new Array(n).fill(null);
  for (let i = n - 1, next = null; i >= 0; i--) { reclaim[i] = next; if (d[i] != null && d[i] > 0) next = i; }
  // running minimum between i and the next reclaim / next swing high, computed by a forward scan (n is small)
  for (let i = 0; i < n; i++) {
    if (d[i] == null) continue;
    while (hp < hs.length && hs[hp] <= i) hp++;
    const H = hp < hs.length ? hs[hp] : null, r = { d: d[i] };
    if (H != null) { let m = Infinity; for (let k = i + 1; k <= H; k++) m = Math.min(m, c[k]); r.toNextHigh = (c[H] / c[i] - 1) * 100; r.barsToHigh = H - i; r.fallBeforeHigh = Math.min(0, (m / c[i] - 1) * 100); }
    if (d[i] < 0) {
      const R = reclaim[i];
      if (R != null) { let m = c[i]; for (let k = i + 1; k <= R; k++) m = Math.min(m, c[k]); r.furtherFall = (m / c[i] - 1) * 100; r.toReclaim = R - i; }
      else r.censored = true;
    }
    out[i] = r;
  }
  return out;
}
/** Stretches below the 200-day (the independent units the bootstrap resamples). Returns [start, end] index pairs. */
export function belowEpisodes(d) {
  const eps = []; let s = null;
  for (let i = 0; i < d.length; i++) { const b = d[i] != null && d[i] < 0; if (b && s == null) s = i; if (!b && s != null) { eps.push([s, i - 1]); s = null; } }
  if (s != null) eps.push([s, d.length - 1]);
  return eps;
}
/** Seeded generator (mulberry32) so every band is reproducible. */
export function rng(seed = 1) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

/** Spearman rank correlation. */
export function spearman(x, y) {
  const n = x.length; if (n < 3) return null;
  const rx = ranks(x), ry = ranks(y), mx = (n + 1) / 2; let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) { const a = rx[i] - mx, b = ry[i] - mx; sxy += a * b; sxx += a * a; syy += b * b; }
  return sxy / Math.sqrt(sxx * syy);
}
/** Average ranks (1-based) with ties shared. */
export function ranks(a) { const n = a.length, o = a.map((v, i) => [v, i]).sort((p, q) => p[0] - q[0]), r = new Array(n); let i = 0; while (i < n) { let j = i; while (j + 1 < n && o[j + 1][0] === o[i][0]) j++; const rr = (i + j) / 2 + 1; for (let k = i; k <= j; k++) r[o[k][1]] = rr; i = j + 1; } return r; }
/** Circular-shift permutation test: within each instrument the percentile sequence is rotated by a random offset
    against its outcome sequence (keeps each series' own clustering, breaks the link). Statistic: pooled Spearman.
    Rotating within an instrument only reorders that instrument's values, so pooled ranks are computed once.
    groups = [{x:[...], y:[...]}] in time order. Returns observed rho, the 95% null band and a two-sided p. */
export function shiftTest(groups, reps = 400, seed = 17) {
  const X = [], Y = [], cuts = [];
  for (const g of groups) { cuts.push([X.length, g.x.length]); X.push(...g.x); Y.push(...g.y); }
  const N = X.length; if (N < 3) return { rho: null, n: N, nullLo: null, nullHi: null, p: null };
  const rx = ranks(X), ry = ranks(Y), m = (N + 1) / 2;
  let sxx = 0, syy = 0; for (let i = 0; i < N; i++) { sxx += (rx[i] - m) ** 2; syy += (ry[i] - m) ** 2; }
  const den = Math.sqrt(sxx * syy), corr = (shift) => { let s = 0; for (let g = 0; g < cuts.length; g++) { const [o, n] = cuts[g], sh = shift[g]; for (let i = 0; i < n; i++) s += (rx[o + (i + sh) % n] - m) * (ry[o + i] - m); } return s / den; };
  const obs = corr(cuts.map(() => 0)), R = rng(seed), nulls = [];
  for (let r = 0; r < reps; r++) nulls.push(corr(cuts.map(([, n]) => n < 2 ? 0 : 1 + Math.floor(R() * (n - 1)))));
  nulls.sort((a, b) => a - b);
  const p = (nulls.filter((v) => Math.abs(v) >= Math.abs(obs)).length + 1) / (reps + 1);
  return { rho: obs, n: N, nullLo: q(nulls, 0.025), nullHi: q(nulls, 0.975), p };
}
/** Binned medians of y by x-percentile bin (width w, over 1..100), with an episode block-bootstrap band.
    items: [{x, y, ep}] where ep = an episode id (instrument + stretch); episodes are resampled whole. */
export function binnedBootstrap(items, { w = 5, reps = 300, seed = 23 } = {}) {
  const bins = Math.ceil(100 / w), byEp = new Map();
  for (const it of items) { if (!byEp.has(it.ep)) byEp.set(it.ep, []); byEp.get(it.ep).push(it); }
  const eps = [...byEp.values()], stat = (sample) => { const b = Array.from({ length: bins }, () => []); for (const it of sample) b[Math.min(bins - 1, Math.floor((Math.max(0.0001, it.x) - 0.0001) / w))].push(it.y); return b.map((ys) => ys.length ? med(ys) : null); };
  const obs = stat(items), counts = Array.from({ length: bins }, () => 0);
  for (const it of items) counts[Math.min(bins - 1, Math.floor((Math.max(0.0001, it.x) - 0.0001) / w))]++;
  const R = rng(seed), boots = Array.from({ length: bins }, () => []);
  for (let r = 0; r < reps; r++) {
    const s = []; for (let e = 0; e < eps.length; e++) s.push(...eps[Math.floor(R() * eps.length)]);
    stat(s).forEach((v, i) => { if (v != null) boots[i].push(v); });
  }
  return obs.map((m, i) => { const b = boots[i].sort((x, y) => x - y); return { lo: i * w, hi: (i + 1) * w, n: counts[i], med: m, bandLo: q(b, 0.05), bandHi: q(b, 0.95) }; });
}

/* ------------------------------ rising tide ------------------------------ */
/** Cross-section per date from many instruments: {date → {n, up, down, above50, above200, rets:[...]}}. */
export function crossSection(instruments) {
  const X = new Map();
  for (const I of instruments) {
    const { dates, c, s50, s200 } = I;
    for (let i = 1; i < dates.length; i++) {
      if (!(c[i] > 0 && c[i - 1] > 0)) continue;
      let e = X.get(dates[i]); if (!e) { e = { n: 0, up: 0, down: 0, n50: 0, above50: 0, n200: 0, above200: 0, rets: [] }; X.set(dates[i], e); }
      const r = (c[i] / c[i - 1] - 1) * 100; e.n++; if (r > 0) e.up++; else if (r < 0) e.down++; e.rets.push(r);
      if (s50?.[i] != null) { e.n50++; if (c[i] > s50[i]) e.above50++; }
      if (s200?.[i] != null) { e.n200++; if (c[i] > s200[i]) e.above200++; }
    }
  }
  return X;
}
/** Interquartile range of the day's moves across names (a dispersion measure that one wild name cannot swing). */
export function iqr(rets) { const a = [...rets].sort((x, y) => x - y); return q(a, 0.75) - q(a, 0.25); }
/** Share of names whose move over [a, b] (index into their own dates by date strings) has the given sign. */
export function legShare(instruments, dA, dB, sign) {
  let n = 0, w = 0;
  for (const I of instruments) {
    const a = I.idx.get(dA), b = I.idx.get(dB); if (a == null || b == null) continue;
    const r = I.c[b] / I.c[a] - 1; n++; if (Math.sign(r) === sign) w++;
  }
  return { n, share: n ? 100 * w / n : null };
}
