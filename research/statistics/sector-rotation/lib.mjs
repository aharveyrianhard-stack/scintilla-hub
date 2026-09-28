/* U2 · SECTOR ROTATION — pure arithmetic. No I/O here; run.mjs reads the cache and writes the JSON.
   Everything is known at the bar it is stamped on (nothing reads a later bar), except the forward
   outcomes, which are named "fwd" and only ever sit on the right-hand side of a comparison. */
import { rungReading } from "../../../deliverables/20260927/geiger-review/geiger-replay.mjs";

export const DAY = 864e5;
export const dstr = (t) => new Date(t).toISOString().slice(0, 10);
const fin = (x) => x != null && Number.isFinite(x);

/* ---------- small statistics ---------- */
export const mean = (xs) => { let s = 0, n = 0; for (const x of xs) if (fin(x)) { s += x; n++; } return n ? s / n : null; };
export function quantile(xs, q) {
  const a = xs.filter(fin).sort((p, r) => p - r); if (!a.length) return null;
  const p = (a.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return a[lo] + (a[hi] - a[lo]) * (p - lo);
}
export const median = (xs) => quantile(xs, 0.5);
/** Own-history percentile, 1..100: the share of the history at or below x (mid-rank for ties), rounded up so
    the lowest reading is 1 and the highest is 100. */
export function pctOf(history, x) {
  if (!fin(x)) return null; const a = history.filter(fin); if (!a.length) return null;
  let below = 0, eq = 0; for (const v of a) { if (v < x) below++; else if (v === x) eq++; }
  return Math.max(1, Math.min(100, Math.ceil(100 * (below + eq / 2) / a.length)));
}
/** Pearson correlation of paired finite values. */
export function corr(x, y) {
  const p = []; for (let i = 0; i < x.length; i++) if (fin(x[i]) && fin(y[i])) p.push([x[i], y[i]]);
  if (p.length < 3) return null;
  const mx = mean(p.map((z) => z[0])), my = mean(p.map((z) => z[1]));
  let sxy = 0, sxx = 0, syy = 0; for (const [a, b] of p) { sxy += (a - mx) * (b - my); sxx += (a - mx) ** 2; syy += (b - my) ** 2; }
  return sxx && syy ? sxy / Math.sqrt(sxx * syy) : null;
}
/** Ranks normalised to 0 (worst) .. 1 (best); ties share the average rank; nulls stay null. n = 1 gives 0.5. */
export function rankNorm(vals) {
  const idx = vals.map((v, i) => [v, i]).filter(([v]) => fin(v)).sort((a, b) => a[0] - b[0]);
  const out = vals.map(() => null), n = idx.length; if (!n) return out;
  for (let i = 0; i < n;) {
    let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
    const r = n === 1 ? 0.5 : ((i + j) / 2) / (n - 1);
    for (let k = i; k <= j; k++) out[idx[k][1]] = r;
    i = j + 1;
  }
  return out;
}
export const spearman = (x, y) => {
  const keep = x.map((v, i) => fin(v) && fin(y[i]));
  return corr(rankNorm(x.map((v, i) => keep[i] ? v : null)), rankNorm(y.map((v, i) => keep[i] ? v : null)));
};
/** Lengths of consecutive true runs. A run still open at the end is returned separately (censored). */
export function runLengths(flags) {
  const done = []; let cur = 0;
  for (const f of flags) { if (f === true) cur++; else { if (cur) done.push(cur); cur = 0; } }
  return { done, open: cur || null };
}
/** Seeded PRNG (mulberry32) so every bootstrap interval is reproducible. */
export function rng(seed = 20260928) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** Moving-block bootstrap over a day-indexed series. stat(indexList) → number. Blocks of `block` consecutive
    days are drawn with replacement until the resample is as long as the original; returns the 5/50/95 %. */
export function blockBootstrap(n, block, stat, B = 1000, seed = 20260928) {
  const R = rng(seed), outs = [], L = Math.max(1, Math.min(block, n));
  for (let b = 0; b < B; b++) {
    const ix = [];
    while (ix.length < n) { const s = Math.floor(R() * (n - L + 1)); for (let k = 0; k < L && ix.length < n; k++) ix.push(s + k); }
    const v = stat(ix); if (fin(v)) outs.push(v);
  }
  return { lo: quantile(outs, 0.05), mid: quantile(outs, 0.5), hi: quantile(outs, 0.95), B: outs.length, block: L };
}

/* ---------- bars ---------- */
/** The calendar day of a bar stamp (+12 h, so 04:00Z and 05:00Z session stamps land on the same date). */
export const epochDay = (t) => Math.floor((t + DAY / 2) / DAY);
/** Calendar 3-day buckets as the chart API builds them: bucket = floor((epochDay − 2) / 3). Checked 28 Sep against
    the last 230 served 3D bars of XLK, IYM and RSPS: 0 of 690 differ in high, low or close (offsets 0 and 1
    mismatch 216–230 of 230). */
export const bucket3D = (t) => Math.floor((epochDay(t) - 2) / 3);
/** Sunday-anchored weeks, as the chart API's W bars (served bars start on Sundays; 1970-01-04 was a Sunday). */
export const bucketW = (t) => Math.floor((epochDay(t) + 4) / 7);
/** Roll daily bars into buckets. Returns [{ t (first day), b (bucket id), o,h,l,c }]. */
export function rollUp(bars, bucketOf) {
  const out = [];
  for (const x of bars) {
    const b = bucketOf(x.t), last = out[out.length - 1];
    if (last && last.b === b) { last.h = Math.max(last.h, +x.h); last.l = Math.min(last.l, +x.l); last.c = +x.c; }
    else out.push({ t: x.t, b, o: +x.o, h: +x.h, l: +x.l, c: +x.c });
  }
  return out;
}

/* ---------- Geiger replay (the Hub's own per-rung maths, geiger-replay.mjs) ---------- */
/** Alan's saved Equalizer weights for the rungs that daily bars can rebuild (live /geiger echo, 28 Sep). */
export const DAILY_RUNG_W = { "1d": 3.178477, "3d": 2.576738, "1w": 0.987499 };
/** Per-day Geiger history for one fund from its daily bars. At day i the 1d rung reads bars 0..i; the 3d and 1w
    rungs read only buckets that had ENDED before the next trading day (the API serves completed buckets only).
    nextT[i] = the timestamp of the next trading day (or, for the last day, the date the reading is taken). */
export function geigerHistory(bars, nextT, W = DAILY_RUNG_W) {
  const n = bars.length, out = new Array(n).fill(null);
  const b3 = rollUp(bars, bucket3D), bw = rollUp(bars, bucketW);
  let j3 = -1, jw = -1, r3 = null, rw = null, k3 = 0, kw = 0;
  for (let i = 0; i < n; i++) {
    // completed buckets: every bucket whose id is below the next trading day's bucket
    const lim3 = bucket3D(nextT[i]), limW = bucketW(nextT[i]);
    while (k3 < b3.length && b3[k3].b < lim3 && b3[k3].t <= bars[i].t) k3++;
    while (kw < bw.length && bw[kw].b < limW && bw[kw].t <= bars[i].t) kw++;
    // a bucket that is complete must also be fully in the past: its closing bar must be at or before day i
    const c3 = k3 - 1, cw = kw - 1;
    if (c3 !== j3) { j3 = c3; r3 = c3 >= 0 ? rungReading(b3.slice(0, c3 + 1)) : null; }
    if (cw !== jw) { jw = cw; rw = cw >= 0 ? rungReading(bw.slice(0, cw + 1)) : null; }
    const r1 = rungReading(bars.slice(Math.max(0, i - 229), i + 1));
    const rs = { "1d": r1, "3d": r3, "1w": rw };
    let ws = 0, s = 0, st = 0, sm = 0, wm = 0;
    for (const [k, w] of Object.entries(W)) {
      const r = rs[k]; if (!r || !(w > 0)) continue;
      ws += w; s += w * r.composite; st += w * r.trend;
      if (r.momentum != null) { sm += w * r.momentum; wm += w; }
    }
    // a reading needs at least the 1d rung with a full 230-bar window, as the publisher reads 230 bars
    if (!r1 || i < 229 || !ws) continue;
    out[i] = { g: s / ws, tr: st / ws, mo: wm ? sm / wm : null, d1: r1.composite, d3: r3 ? r3.composite : null, w1: rw ? rw.composite : null };
  }
  return out;
}

/* ---------- relative strength ---------- */
/** h-session log relative strength of a vs b, in percent: 100·(ln a_t/a_{t−h} − ln b_t/b_{t−h}). */
export function rsH(a, b, h) {
  return a.map((x, i) => i >= h && fin(x) && fin(a[i - h]) && fin(b[i]) && fin(b[i - h]) && x > 0 && a[i - h] > 0
    ? 100 * (Math.log(x / a[i - h]) - Math.log(b[i] / b[i - h])) : null);
}
/** EMA over a series that may start with nulls (seeded at the first finite value). */
export function emaSeries(xs, n) {
  const k = 2 / (n + 1), out = xs.map(() => null); let e = null;
  for (let i = 0; i < xs.length; i++) { if (!fin(xs[i])) { out[i] = e == null ? null : e; continue; } e = e == null ? xs[i] : xs[i] * k + e * (1 - k); out[i] = e; }
  return out;
}
/** RRG-style coordinates at horizon h. x = where relative strength sits against its own h-EMA (trend of RS);
    y = where x sits against its own h-EMA (the turn in that trend). Both in percent of ln RS. Quadrants:
    x≥0,y≥0 LEADING · x≥0,y<0 WEAKENING · x<0,y<0 LAGGING · x<0,y≥0 IMPROVING. The clockwise path is
    LEADING → WEAKENING → LAGGING → IMPROVING → LEADING. Warm-up: 2h sessions are left null. */
export function rrg(a, b, h) {
  const lr = a.map((x, i) => fin(x) && fin(b[i]) && x > 0 && b[i] > 0 ? 100 * Math.log(x / b[i]) : null);
  const first = lr.findIndex(fin);
  const e1 = emaSeries(lr, h), x = lr.map((v, i) => fin(v) && fin(e1[i]) ? v - e1[i] : null);
  const e2 = emaSeries(x, h), y = x.map((v, i) => fin(v) && fin(e2[i]) ? v - e2[i] : null);
  const q = x.map((v, i) => first < 0 || i < first + 2 * h || !fin(v) || !fin(y[i]) ? null
    : v >= 0 ? (y[i] >= 0 ? "LEADING" : "WEAKENING") : (y[i] < 0 ? "LAGGING" : "IMPROVING"));
  return { x: x.map((v, i) => q[i] ? v : null), y: y.map((v, i) => q[i] ? v : null), q };
}
export const QUADS = ["LEADING", "WEAKENING", "LAGGING", "IMPROVING"];
const NEXT_CW = { LEADING: "WEAKENING", WEAKENING: "LAGGING", LAGGING: "IMPROVING", IMPROVING: "LEADING" };
/** Quadrant spells and moves. A move is clockwise, counter-clockwise, or a jump across (diagonal). */
export function quadrantStats(q) {
  const spells = Object.fromEntries(QUADS.map((k) => [k, []])); const moves = { cw: 0, ccw: 0, across: 0 };
  let cur = null, len = 0;
  for (const s of q) {
    if (s == null) { cur = null; len = 0; continue; }
    if (s === cur) { len++; continue; }
    if (cur) { spells[cur].push(len); if (NEXT_CW[cur] === s) moves.cw++; else if (NEXT_CW[s] === cur) moves.ccw++; else moves.across++; }
    cur = s; len = 1;
  }
  return { spells, moves, open: cur ? { quad: cur, len } : null };
}

/* ---------- tiers & transitions ---------- */
/** Tier from a normalised rank: TOP (upper third), MID, BOTTOM (lower third). */
export const tierOf = (r) => r == null ? null : r > 2 / 3 - 1e-9 ? "TOP" : r < 1 / 3 + 1e-9 ? "BOTTOM" : "MID";
export const TIERS = ["TOP", "MID", "BOTTOM"];
/** P(tier at t+h | tier at t), pooled over every sector and day (overlapping). */
export function transitions(tierRows, h) {
  const cnt = Object.fromEntries(TIERS.map((a) => [a, Object.fromEntries(TIERS.map((b) => [b, 0]))]));
  for (let i = 0; i + h < tierRows.length; i++) {
    const A = tierRows[i], Bt = tierRows[i + h];
    for (let s = 0; s < A.length; s++) if (A[s] && Bt[s]) cnt[A[s]][Bt[s]]++;
  }
  const P = {}; for (const a of TIERS) { const tot = TIERS.reduce((z, b) => z + cnt[a][b], 0); P[a] = Object.fromEntries(TIERS.map((b) => [b, tot ? cnt[a][b] / tot : null])); P[a].n = tot; }
  return P;
}

/* ---------- bow tie ---------- */
/** The compare strip's shape on one day, from the eleven Geiger values (nulls ignored). The Hub sorts bull → bear
    and autoscales to the largest |value|, so what the eye reads is:
    · wing   = min(best, −worst): the SHORTER of the two wings. A bow tie needs both a green and a red wing; the
               shorter wing is how much tie there is. Zero or less = one-sided (all green or all red).
    · spread = best − worst (the whole width, Geiger units, −1..+1 scale → 0..2).
    · knot   = |median| / max|value|: how thin the middle is on the autoscaled strip (0 = the middle bar is flat).
    · balance= share of funds above zero. */
export function bowTie(vals) {
  const a = vals.filter(fin).sort((p, q) => q - p); if (a.length < 5) return null;
  const best = a[0], worst = a.at(-1), mx = Math.max(Math.abs(best), Math.abs(worst)) || 1e-9;
  return { wing: Math.min(best, -worst), spread: best - worst, knot: Math.abs(median(a)) / mx, balance: a.filter((v) => v > 0).length / a.length, best, worst, n: a.length };
}
