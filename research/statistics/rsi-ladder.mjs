/* RSI LADDER · 28 Sep 2026 — the full RSI distribution, rung by rung (1% … 100%), what happened next at every rung,
   and every pullback as a continuous distribution. Alan: "How about the 1%, 2%, 3%… all the way to 100? It's a simple
   percentile analysis. We're not going to use an arbitrary 10% everywhere."
   node research/statistics/rsi-ladder.mjs [--cache-root <dir>] [--out <file>]

   Reads the durable daily-bar caches only (no network, no database, no keys):
     <root>/daily-bars-rsi/<SYM>.json   chart API /candles?tf=D&limit=20000, saved 28 Sep (indexes' funds, macro symbols)
     <root>/daily-bars-rsi/fmp-indexes.json   FMP index history (^GSPC from 1927, ^NDX from 1985), fetched on Fly 28 Sep
     <root>/candles-f5/<SYM>.json       chart API daily bars (the 11 SPDR sectors and SMH), saved 27 Sep

   Rules (the page repeats each one in plain words)
   · RSI(14), Wilder, on daily closes (stats.mjs rsiWilder). The first 100 readings of each series are warm-up and are
     not counted anywhere: Wilder's average still carries its starting guess before that ((13/14)^100 ≈ 0.06%).
   · LADDER: RSI value at every percentile 1..100 of all counted days (percentile 0 = the lowest reading), on the full
     history and on the last 3 years (756 sessions; Bitcoin 1,095 calendar days because it trades every day).
   · RUNG of a day = where its RSI sits in the whole history, 1..100 (rung 1 = the lowest 1% of days). This uses the
     whole history (hindsight). The no-hindsight check ranks each day only against every EARLIER reading (expanding,
     no window; it needs 250 earlier readings first).
   · VISITS: a visit to "rung q or lower" is a run of consecutive days at or below the q-th percentile value. Counted
     for every q = 1..100, no merging rule.
   · OUTCOMES per rung: forward change close→close after 5/10/20/60 sessions (US 10-year yield in basis points),
     share of times higher, worst close inside the next 20 and 60 sessions against the entry close, and time back
     above the prior swing high (the most recent 10/10 pivot high already confirmed that day — known 10 sessions after
     it printed; "back above" = the first later day whose high trades above it; 0 when today's high is already above).
     Time back is summarised with the Kaplan–Meier median, so days whose recovery has not happened yet still count.
   · BANDS: 90% cluster bootstrap. Days are resampled in whole calendar months (5/10/20-session measures) or whole
     calendar quarters (60-session measures, whose windows overlap across months), 1,000 draws, fixed seed.
   · PULLBACKS: S9's swings (s9-research.mjs: 10/10 pivots on the wick, alternating, leg ends moved to the true
     extreme; bad wicks clamped to the body). Every swing high → next swing low is one pullback. Depth = low/high − 1
     (basis points for the 10-year yield). Depth rank = where the pullback sits among that instrument's own
     pullbacks (0–100). RSI at the low and its rung. Time to a new high = sessions from the low (and from the top)
     until the first day whose high trades above the old top; "legs" = how many rallies it took (1 = the very next
     leg, S9's measure). Pullbacks still underwater are kept and marked open (censored), never dropped.
   Nothing here is a buy rule; these are research questions answered with counts. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { rsiWilder } from "./stats.mjs";
import { cleanBars, swings, pivotPoints, quantile, median, r1, r2 } from "./s9-research.mjs";
import { segment } from "./ladder.mjs";

export const WARMUP = 100, OWN_MIN = 250, PIVOT_LEN = 10, HORIZONS = [5, 10, 20, 60], BOOT_N = 1000, SEED = 20260928;
export const INSTRUMENTS = [
  { key: "SPX", name: "S&P 500 index", short: "S&P 500", src: "fmp", sym: "^GSPC", group: "Stock indexes" },
  { key: "SPY", name: "SPY (S&P 500 fund)", short: "SPY", src: "api", sym: "SPY", group: "Stock indexes" },
  { key: "NDX", name: "Nasdaq 100 index", short: "Nasdaq 100", src: "fmp", sym: "^NDX", group: "Stock indexes" },
  { key: "QQQ", name: "QQQ (Nasdaq 100 fund)", short: "QQQ", src: "api", sym: "QQQ", group: "Stock indexes" },
  { key: "IWM", name: "IWM (Russell 2000 fund)", short: "IWM", src: "api", sym: "IWM", group: "Stock indexes" },
  { key: "DIA", name: "DIA (Dow fund)", short: "DIA", src: "api", sym: "DIA", group: "Stock indexes" },
  { key: "VIX", name: "VIX (fear index)", short: "VIX", src: "api", sym: "VIX", group: "Fear, rates, dollar" },
  { key: "US10Y", name: "US 10-year yield", short: "10y yield", src: "api", sym: "US10Y", group: "Fear, rates, dollar", unit: "bp" },
  { key: "TLT", name: "TLT (long Treasuries fund)", short: "TLT", src: "api", sym: "TLT", group: "Fear, rates, dollar" },
  { key: "DXY", name: "US dollar index", short: "Dollar", src: "api", sym: "DXY", group: "Fear, rates, dollar" },
  { key: "CLUSD", name: "WTI crude oil", short: "Oil", src: "api", sym: "CLUSD", group: "Commodities, crypto" },
  { key: "GCUSD", name: "Gold", short: "Gold", src: "api", sym: "GCUSD", group: "Commodities, crypto" },
  { key: "SIUSD", name: "Silver", short: "Silver", src: "api", sym: "SIUSD", group: "Commodities, crypto" },
  { key: "BTCUSD", name: "Bitcoin", short: "Bitcoin", src: "api", sym: "BTCUSD", group: "Commodities, crypto", start: "2013-01-01", calendar: true },
  { key: "XLK", name: "XLK Technology", short: "XLK", src: "f5", sym: "XLK", group: "Sectors" },
  { key: "SMH", name: "SMH Semiconductors", short: "SMH", src: "f5", sym: "SMH", group: "Sectors" },
  { key: "XLC", name: "XLC Communication", short: "XLC", src: "f5", sym: "XLC", group: "Sectors" },
  { key: "XLY", name: "XLY Consumer discretionary", short: "XLY", src: "f5", sym: "XLY", group: "Sectors" },
  { key: "XLF", name: "XLF Financials", short: "XLF", src: "f5", sym: "XLF", group: "Sectors" },
  { key: "XLI", name: "XLI Industrials", short: "XLI", src: "f5", sym: "XLI", group: "Sectors" },
  { key: "XLB", name: "XLB Materials", short: "XLB", src: "f5", sym: "XLB", group: "Sectors" },
  { key: "XLE", name: "XLE Energy", short: "XLE", src: "f5", sym: "XLE", group: "Sectors" },
  { key: "XLV", name: "XLV Health care", short: "XLV", src: "f5", sym: "XLV", group: "Sectors" },
  { key: "XLP", name: "XLP Consumer staples", short: "XLP", src: "f5", sym: "XLP", group: "Sectors" },
  { key: "XLU", name: "XLU Utilities", short: "XLU", src: "f5", sym: "XLU", group: "Sectors" },
  { key: "XLRE", name: "XLRE Real estate", short: "XLRE", src: "f5", sym: "XLRE", group: "Sectors" },
];
const MAX_WICK = { default: 0.25, BTCUSD: 0.5, VIX: 1.0 };   // VIX spikes of 50%+ inside a day are real (5 Aug 2024)
const dstr = (t) => new Date(t).toISOString().slice(0, 10);
const fin = (x) => x != null && Number.isFinite(x);

/* ============================ small, tested pieces ============================ */
/** Seeded PRNG (mulberry32) so every band is reproducible. */
export function rng(seed = SEED) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const shareUp = (xs) => { const a = xs.filter(fin); return a.length ? 100 * a.filter((x) => x > 0).length / a.length : null; };

/** RSI value at every percentile 0..100 of the counted readings in [from, to). */
export function ladder(rsi, from = 0, to = rsi.length) {
  const a = []; for (let i = from; i < to; i++) if (rsi[i] != null) a.push(rsi[i]);
  a.sort((p, q) => p - q);
  const v = []; for (let q = 0; q <= 100; q++) v.push(r1(quantile(a, q / 100)));
  return { n: a.length, v };
}
/** Where x sits among sorted readings, 0–100 (ties count half). */
export function percentileOf(sortedAsc, x) {
  if (x == null || !sortedAsc.length) return null;
  let lo = 0, hi = sortedAsc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] < x) lo = m + 1; else hi = m; }
  let eq = 0; for (let j = lo; j < sortedAsc.length && sortedAsc[j] === x; j++) eq++;
  return 100 * (lo + eq / 2) / sortedAsc.length;
}
/** Rung 1..100 from a percentile (0–100). */
export const rungOf = (p) => p == null ? null : Math.min(100, Math.max(1, Math.ceil(p)));

/** No-hindsight percentile: each reading against every EARLIER counted reading (Fenwick tree on RSI to 0.01). */
export function expandingPercentile(rsi, minN = OWN_MIN) {
  const N = 10001, tree = new Float64Array(N + 1); let total = 0;
  const add = (i) => { for (i++; i <= N; i += i & -i) tree[i]++; };
  const sum = (i) => { let s = 0; for (i++; i > 0; i -= i & -i) s += tree[i]; return s; };   // count of buckets ≤ i
  const out = new Array(rsi.length).fill(null);
  for (let i = 0; i < rsi.length; i++) {
    const x = rsi[i]; if (x == null) continue;
    const b = Math.max(0, Math.min(N - 1, Math.round(x * 100)));
    if (total >= minN) { const below = b > 0 ? sum(b - 1) : 0, eq = sum(b) - below; out[i] = 100 * (below + eq / 2) / total; }
    add(b); total++;
  }
  return out;
}

/** Runs of consecutive days with test(i) true (null = not counted, breaks nothing but is skipped). */
export function runs(test, n) {
  const out = []; let cur = null;
  for (let i = 0; i < n; i++) {
    const t = test(i); if (t == null) continue;
    if (t) { if (cur && cur.last === i - 1) cur.last = i; else { if (cur) out.push(cur); cur = { start: i, last: i }; } }
  }
  if (cur) out.push(cur);
  return out.map((r) => ({ ...r, length: r.last - r.start + 1 }));
}

/** Forward change from close i to close i+h: percent, or basis points for yields. */
export function fwd(c, i, h, unit = "pct") {
  if (i + h >= c.length || c[i] == null || c[i + h] == null) return null;
  if (unit === "bp") return (c[i + h] - c[i]) * 100;
  if (!(c[i] > 0) || !(c[i + h] > 0)) return null;
  return (c[i + h] / c[i] - 1) * 100;
}
/** Worst close in the next h sessions against close i (percent; bp for yields). */
export function worstAhead(c, i, h, unit = "pct") {
  if (i + h >= c.length) return null;
  let m = Infinity; for (let k = i + 1; k <= i + h; k++) if (c[k] != null) m = Math.min(m, c[k]);
  if (unit === "bp") return (m - c[i]) * 100;
  return c[i] > 0 && m > 0 ? (m / c[i] - 1) * 100 : null;
}

/** Sparse table of maxima: firstAbove(from, level) = first index j ≥ from with a[j] > level, or -1. O(log n). */
export function maxFinder(a) {
  const n = a.length, T = [Float64Array.from(a, (x) => fin(x) ? x : -Infinity)];
  for (let k = 1; (1 << k) <= n; k++) { const p = T[k - 1], q = new Float64Array(n - (1 << k) + 1), h = 1 << (k - 1); for (let i = 0; i < q.length; i++) q[i] = Math.max(p[i], p[i + h]); T.push(q); }
  return function firstAbove(from, level) {
    let i = Math.max(0, from);
    while (i < n) {
      if (T[0][i] > level) return i;
      let k = 0; while (k + 1 < T.length && i + (1 << (k + 1)) <= n && !(T[k + 1][i] > level)) k++;
      i += 1 << k;                                // skip the largest block that stays at or below level
    }
    return -1;
  };
}

/** Kaplan–Meier: items [{t, done}] (done=false → still waiting at t). Returns the steps and the median. */
export function kaplanMeier(items) {
  const a = items.filter((x) => fin(x.t)).sort((p, q) => p.t - q.t || (p.done === q.done ? 0 : p.done ? -1 : 1));
  let atRisk = a.length, S = 1; const steps = []; let median = null;
  for (let i = 0; i < a.length;) {
    const t = a[i].t; let d = 0, c = 0;
    while (i < a.length && a[i].t === t) { if (a[i].done) d++; else c++; i++; }
    if (d > 0) { S *= 1 - d / atRisk; steps.push([t, S]); if (median == null && S <= 0.5) median = t; }
    atRisk -= d + c;
  }
  return { n: a.length, done: a.filter((x) => x.done).length, open: a.filter((x) => !x.done).length, median, steps };
}
/** Share done by time t from KM steps (1 − survival). */
export const kmDoneBy = (steps, t) => { let S = 1; for (const [s, v] of steps) { if (s <= t) S = v; else break; } return 1 - S; };

/** Spearman rank correlation. */
export function spearman(xs, ys) {
  const pairs = xs.map((x, i) => [x, ys[i]]).filter(([x, y]) => fin(x) && fin(y)); const n = pairs.length; if (n < 3) return null;
  const rank = (v) => { const idx = v.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0]), r = new Array(n); for (let i = 0; i < n;) { let j = i; while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++; for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2; i = j + 1; } return r; };
  const rx = rank(pairs.map((p) => p[0])), ry = rank(pairs.map((p) => p[1])), mx = (n - 1) / 2;
  let sxy = 0, sxx = 0, syy = 0; for (let i = 0; i < n; i++) { sxy += (rx[i] - mx) * (ry[i] - mx); sxx += (rx[i] - mx) ** 2; syy += (ry[i] - mx) ** 2; }
  return sxy / Math.sqrt(sxx * syy);
}

/** 90% cluster bootstrap of medians and shares-up for several measures of one group of days.
 *  recs: [{cluster, <measure>: value}], meds: measure names to take the median of, ups: measure names for share-up. */
export function clusterBand(recs, meds, ups, reps = BOOT_N, seed = SEED) {
  const byC = new Map(); for (const r of recs) { if (!byC.has(r.cluster)) byC.set(r.cluster, []); byC.get(r.cluster).push(r); }
  const groups = [...byC.values()], G = groups.length, out = { clusters: G };
  if (G < 2) return out;
  const R = rng(seed), draws = Object.fromEntries([...meds.map((m) => ["m:" + m, []]), ...ups.map((m) => ["u:" + m, []])]);
  const buf = new Float64Array(G * Math.max(...groups.map((g) => g.length)));
  for (let b = 0; b < reps; b++) {
    const pick = []; for (let g = 0; g < G; g++) pick.push(groups[Math.floor(R() * G)]);
    for (const m of meds) {
      let n = 0; for (const grp of pick) for (const r of grp) if (fin(r[m])) buf[n++] = r[m];
      if (!n) continue; const s = buf.subarray(0, n).sort(); draws["m:" + m].push(n % 2 ? s[n >> 1] : (s[(n >> 1) - 1] + s[n >> 1]) / 2);
    }
    for (const m of ups) { let n = 0, u = 0; for (const grp of pick) for (const r of grp) if (fin(r[m])) { n++; if (r[m] > 0) u++; } if (n) draws["u:" + m].push(100 * u / n); }
  }
  for (const [k, v] of Object.entries(draws)) { v.sort((a, b) => a - b); out[k] = v.length ? [r2(quantile(v, 0.05)), r2(quantile(v, 0.95))] : null; }
  return out;
}

/* ============================ loading ============================ */
export function loadInstrument(ROOT, I, fmpCache = {}) {
  let raw;
  if (I.src === "fmp") {
    fmpCache.v ??= JSON.parse(fs.readFileSync(path.join(ROOT, "daily-bars-rsi/fmp-indexes.json"), "utf8"));
    const rows = fmpCache.v[I.sym]; if (!rows?.length) return null;
    raw = { bars: rows.map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v })), provider: "FMP", providerSymbol: I.sym, basis: "INDEX_LEVEL", via: "FMP historical-price-eod/full, fetched inside Fly 28 Sep (daily-bars-rsi/fmp-indexes.json)" };
  } else {
    const dir = I.src === "f5" ? "candles-f5" : "daily-bars-rsi", f = path.join(ROOT, dir, I.sym + ".json"); if (!fs.existsSync(f)) return null;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    raw = { bars: j.series ?? j, provider: j.provider ?? "MASSIVE", providerSymbol: j.provider_symbol ?? I.sym, basis: j.price_basis ?? null, via: `chart API /candles daily (${dir}/${I.sym}.json)` };
  }
  let bars = raw.bars.filter((b) => b.c != null && Number.isFinite(+b.c));
  // weekend prints: dropped for everything but Bitcoin from 1953 on (the NYSE traded Saturdays until 1952)
  const weekend = I.calendar ? [] : bars.filter((b) => [0, 6].includes(new Date(b.t).getUTCDay()) && dstr(b.t) >= "1953-01-01").map((b) => dstr(b.t));
  if (!I.calendar) bars = bars.filter((b) => !([0, 6].includes(new Date(b.t).getUTCDay()) && dstr(b.t) >= "1953-01-01"));
  if (I.start) bars = bars.filter((b) => dstr(b.t) >= I.start);
  const { bars: clean, cleaned } = cleanBars(bars, MAX_WICK[I.key] ?? MAX_WICK.default);
  const seg = segment(clean);
  return { bars: seg.bars, meta: { provider: raw.provider, providerSymbol: raw.providerSymbol, basis: raw.basis, via: raw.via, served: raw.bars.length, cleaned: cleaned.length, cleanedDates: cleaned.map((x) => x.date).slice(0, 40), dropped: seg.dropped, holeNote: seg.note, weekendDropped: weekend.length, onlyCloseBars: seg.bars.filter((b) => +b.h === +b.l).length } };
}
export function seriesOf(bars, warmup = WARMUP) {
  const c = bars.map((b) => +b.c), h = bars.map((b) => +b.h), l = bars.map((b) => +b.l), dates = bars.map((b) => dstr(b.t));
  const rsi = rsiWilder(c, 14).map((x, i) => (i < warmup ? null : x));
  return { c, h, l, dates, rsi };
}

/* ============================ one instrument ============================ */
/** Time back above the prior swing high for every day (sessions; done=false when not yet). */
export function recoverTimes(S, len = PIVOT_LEN) {
  const n = S.c.length, highs = pivotPoints(S.h, S.l, len).filter((p) => p.type === "H").sort((a, b) => a.k - b.k);
  const firstAbove = maxFinder(S.h), out = new Array(n).fill(null);
  let j = -1;
  for (let i = 0; i < n; i++) {
    while (j + 1 < highs.length && highs[j + 1].k + len <= i) j++;
    if (j < 0) continue;
    const level = highs[j].price;
    if (S.h[i] > level) { out[i] = { t: 0, done: true }; continue; }
    const k = firstAbove(i + 1, level);
    out[i] = k < 0 ? { t: n - 1 - i, done: false } : { t: k - i, done: true };
  }
  return out;
}

/** Every pullback (swing high → swing low) with depth, RSI at the low, and the time to a new high. */
export function pullbacks(S, unit = "pct", len = PIVOT_LEN, sortedRsi = null, own = null) {
  const sw = swings(S.h, S.l, len), n = S.c.length, firstAbove = maxFinder(S.h), out = [];
  const swingHighKs = sw.filter((p) => p.type === "H").map((p) => p.k);
  for (let i = 0; i + 1 < sw.length; i++) {
    const a = sw[i], b = sw[i + 1]; if (a.type !== "H" || b.type !== "L") continue;
    let depth = unit === "bp" ? (b.price - a.price) * 100 : (b.price / a.price - 1) * 100;
    const capped = unit !== "bp" && !(b.price > 0); if (capped) depth = -100;
    let rsiMin = null; for (let k = a.k; k <= b.k; k++) if (S.rsi[k] != null && (rsiMin == null || S.rsi[k] < rsiMin)) rsiMin = S.rsi[k];
    const nh = firstAbove(b.k + 1, a.price);
    const legs = nh < 0 ? null : 1 + swingHighKs.filter((k) => k > b.k && k < nh).length;
    const dd = (x, y) => Math.round((Date.parse(S.dates[y]) - Date.parse(S.dates[x])) / 864e5);
    out.push({ top: S.dates[a.k], low: S.dates[b.k], topPrice: r2(a.price), lowPrice: r2(b.price), depth: r2(depth), capped,
      fallBars: b.k - a.k, rsiLow: r1(S.rsi[b.k]), rsiMin: r1(rsiMin), rungLow: sortedRsi && S.rsi[b.k] != null ? rungOf(percentileOf(sortedRsi, S.rsi[b.k])) : null,
      ownPctLow: own && own[b.k] != null ? r1(own[b.k]) : null,
      newHigh: nh < 0 ? null : S.dates[nh], done: nh >= 0,
      lowToNew: nh < 0 ? n - 1 - b.k : nh - b.k, topToNew: nh < 0 ? n - 1 - a.k : nh - a.k,
      lowToNewDays: dd(b.k, nh < 0 ? n - 1 : nh), topToNewDays: dd(a.k, nh < 0 ? n - 1 : nh), legs, nextLeg: legs == null ? (sw[i + 2] ? false : null) : legs === 1 });
  }
  // depth rank among this instrument's own pullbacks (0 = shallowest, 100 = deepest)
  const mags = out.map((p) => -p.depth).sort((x, y) => x - y);
  for (const p of out) p.depthRank = r1(percentileOf(mags, -p.depth));
  return out;
}

/** Pullback summary: continuous — every point plus curves over depth rank. */
export function pullbackSummary(P) {
  const km = (g) => kaplanMeier(g.map((p) => ({ t: p.lowToNew, done: p.done })));
  const all = km(P);
  // "at least this deep": for each pullback (deepest first), KM median time among every pullback at least as deep
  const byDepth = [...P].sort((a, b) => a.depth - b.depth), atLeast = [];
  for (let i = 0; i < byDepth.length; i++) { const g = byDepth.slice(0, i + 1), K = km(g); atLeast.push([byDepth[i].depth, byDepth[i].depthRank, K.median, g.length, K.open]); }
  const thr = (q) => P.filter((p) => p.depthRank >= q);
  const curves = [0, 50, 75, 90].map((q) => { const K = km(thr(q)); return { fromRank: q, n: K.n, open: K.open, median: K.median, steps: K.steps.map(([t, s]) => [t, r1(100 * (1 - s))]) }; });
  const done = P.filter((p) => p.done);
  const nextLeg = P.filter((p) => p.nextLeg != null);
  return { n: P.length, open: P.filter((p) => !p.done).length, medianLowToNew: all.median, medianTopToNew: kaplanMeier(P.map((p) => ({ t: p.topToNew, done: p.done }))).median,
    rhoDepthTime: r2(spearman(done.map((p) => -p.depth), done.map((p) => p.lowToNew))),
    rhoDepthRsi: r2(spearman(P.map((p) => -p.depth), P.map((p) => p.rsiLow))),
    everNewHigh: r1(100 * done.length / Math.max(1, P.length)), nextLegShare: r1(100 * nextLeg.filter((p) => p.nextLeg).length / Math.max(1, nextLeg.length)),
    depthLadder: (() => { const m = P.map((p) => p.depth).sort((a, b) => b - a); const v = []; for (let q = 0; q <= 100; q++) v.push(r2(quantile(m, q / 100))); return v; })(),   // depth at each rank 0..100 (0 = shallowest)
    atLeast, curves };
}

export function analyse(S, I, opts = {}) {
  const reps = opts.reps ?? BOOT_N, unit = I.unit === "bp" ? "bp" : "pct", n = S.c.length;
  const first = S.rsi.findIndex((x) => x != null);
  const last3 = Math.max(first, n - (I.calendar ? 1095 : 756));
  const sorted = S.rsi.filter((x) => x != null).sort((a, b) => a - b);
  const years = (Date.parse(S.dates[n - 1]) - Date.parse(S.dates[first])) / (365.25 * 864e5);
  const full = ladder(S.rsi), recent = ladder(S.rsi, last3);
  const pct = S.rsi.map((x) => x == null ? null : percentileOf(sorted, x)), rung = pct.map(rungOf);
  const own = expandingPercentile(S.rsi), ownRung = own.map(rungOf);

  // visits at or below each rung, q = 1..100
  const visits = [];
  for (let q = 1; q <= 100; q++) {
    const cut = quantile(sorted, q / 100), R = runs((i) => S.rsi[i] == null ? null : S.rsi[i] <= cut, n);
    const L = R.map((r) => r.length).sort((a, b) => a - b);
    visits.push({ q, rsi: r1(cut), visits: R.length, perYear: r2(R.length / years), lenMed: median(L), lenMax: L.length ? L[L.length - 1] : null });
  }

  // per-day records
  const rec = recoverTimes(S);
  const day = [];
  for (let i = 0; i < n; i++) {
    if (S.rsi[i] == null) continue;
    const m = S.dates[i].slice(0, 7), qtr = S.dates[i].slice(0, 4) + "Q" + (1 + Math.floor((+S.dates[i].slice(5, 7) - 1) / 3));
    day.push({ i, rung: rung[i], ownRung: ownRung[i], month: m, quarter: qtr, f5: fwd(S.c, i, 5, unit), f10: fwd(S.c, i, 10, unit), f20: fwd(S.c, i, 20, unit), f60: fwd(S.c, i, 60, unit),
      w20: worstAhead(S.c, i, 20, unit), w60: worstAhead(S.c, i, 60, unit), rec: rec[i] });
  }
  const summ = (g) => ({ n: g.length, f5: r2(median(g.map((d) => d.f5))), f10: r2(median(g.map((d) => d.f10))), f20: r2(median(g.map((d) => d.f20))), f60: r2(median(g.map((d) => d.f60))),
    up5: r1(shareUp(g.map((d) => d.f5))), up10: r1(shareUp(g.map((d) => d.f10))), up20: r1(shareUp(g.map((d) => d.f20))), up60: r1(shareUp(g.map((d) => d.f60))),
    w20: r2(median(g.map((d) => d.w20))), w60: r2(median(g.map((d) => d.w60))),
    rec: (() => { const K = kaplanMeier(g.filter((d) => d.rec).map((d) => d.rec)); return { median: K.median, open: K.open, n: K.n }; })() });
  const base = summ(day);
  const byRung = [];
  for (let q = 1; q <= 100; q++) {
    const g = day.filter((d) => d.rung === q), s = summ(g);
    const bm = clusterBand(g.map((d) => ({ cluster: d.month, f5: d.f5, f10: d.f10, f20: d.f20 })), ["f5", "f10", "f20"], ["f5", "f10", "f20"], reps, SEED + q);
    const bq = clusterBand(g.map((d) => ({ cluster: d.quarter, f60: d.f60, w20: d.w20, w60: d.w60 })), ["f60", "w20", "w60"], ["f60"], reps, SEED + 1000 + q);
    byRung.push({ q, rsiFrom: r1(full.v[q - 1]), rsiTo: r1(full.v[q]), ...s, months: bm.clusters, quarters: bq.clusters,
      band: { f5: bm["m:f5"], f10: bm["m:f10"], f20: bm["m:f20"], up5: bm["u:f5"], up10: bm["u:f10"], up20: bm["u:f20"], f60: bq["m:f60"], up60: bq["u:f60"], w20: bq["m:w20"], w60: bq["m:w60"] } });
  }
  const byOwnRung = [];
  for (let q = 1; q <= 100; q++) { const g = day.filter((d) => d.ownRung === q), s = summ(g); byOwnRung.push({ q, n: s.n, f20: s.f20, f60: s.f60, up20: s.up20, up60: s.up60, w60: s.w60, rec: s.rec.median }); }

  const P = pullbacks(S, unit, PIVOT_LEN, sorted, own);
  const lastRsi = S.rsi[n - 1];
  const sorted3 = S.rsi.slice(last3).filter((x) => x != null).sort((a, b) => a - b);
  return { key: I.key, name: I.name, short: I.short, group: I.group, unit, calendar: !!I.calendar, from: S.dates[first], to: S.dates[n - 1], sessions: n - first, years: r1(years), recentFrom: S.dates[last3],
    ladder: { full: full.v, last3: recent.v, nFull: full.n, n3: recent.n }, visits, base, byRung, byOwnRung,
    pullbacks: P, pull: pullbackSummary(P),
    now: { date: S.dates[n - 1], close: r2(S.c[n - 1]), rsi: r1(lastRsi), pctFull: r1(percentileOf(sorted, lastRsi)), rung: rungOf(percentileOf(sorted, lastRsi)), pct3y: r1(percentileOf(sorted3, lastRsi)), ownPct: r1(own[n - 1]) } };
}

/** How often does B's RSI go as deep as A's rung q? Share of B's days at or below A's q-th percentile value, q = 1..100. */
export function crossDepth(A, B) { const sb = B.sortedRsi; return A.ladderFull.map((v, q) => q === 0 ? null : r2(percentileOf(sb, v))); }

/* ============================ runner ============================ */
export function run(ROOT, opts = {}) {
  const out = { generated: new Date().toISOString(), kind: "RSI ladder — RSI(14, Wilder, daily) at every percentile 1..100, outcomes by rung, and every pullback. Descriptive; nothing here predicts.",
    rules: { warmup: WARMUP, ownMin: OWN_MIN, pivotLen: PIVOT_LEN, horizons: HORIZONS, bootstrap: { reps: opts.reps ?? BOOT_N, seed: SEED, level: 90, cluster: "calendar month (5/10/20 sessions); calendar quarter (60 sessions and worst-in-60)" } },
    sources: {}, instruments: {}, cross: {} };
  const fmpCache = {}, keep = {};
  for (const I of INSTRUMENTS) {
    if (opts.only && !opts.only.includes(I.key)) continue;
    const L = loadInstrument(ROOT, I, fmpCache); if (!L) { out.instruments[I.key] = { missing: true, name: I.name }; continue; }
    const S = seriesOf(L.bars);
    const A = analyse(S, I, opts);
    out.sources[I.key] = { ...L.meta, name: I.name, from: S.dates[0], to: S.dates.at(-1), sessions: S.c.length, start: I.start ?? null };
    out.instruments[I.key] = A;
    keep[I.key] = { sortedRsi: S.rsi.filter((x) => x != null).sort((a, b) => a - b), ladderFull: A.ladder.full, rsi: S.rsi, dates: S.dates };
    if (opts.log) opts.log(I.key);
  }
  // Bitcoin vs the stock indexes: share of each one's days at or below the other's rung value
  const pairs = [["BTCUSD", "SPY"], ["BTCUSD", "QQQ"], ["BTCUSD", "SPX"], ["QQQ", "SPY"], ["NDX", "SPX"], ["IWM", "SPY"], ["SMH", "SPY"], ["GCUSD", "SPY"], ["CLUSD", "SPY"]];
  for (const [b, a] of pairs) if (keep[a] && keep[b]) out.cross[`${b}_vs_${a}`] = { a, b, bAtA: crossDepth(keep[a], keep[b]), aAtB: crossDepth(keep[b], keep[a]) };
  // same-period comparison for Bitcoin vs SPY/QQQ (Bitcoin's years only), on each one's own days
  if (keep.BTCUSD && keep.SPY) {
    const from = keep.BTCUSD.dates[keep.BTCUSD.rsi.findIndex((x) => x != null)];
    for (const k of ["SPY", "QQQ", "SPX"]) { if (!keep[k]) continue; const K = keep[k]; const a = K.rsi.filter((x, i) => x != null && K.dates[i] >= from); out.cross[`${k}_sinceBTC`] = { from, ladder: ladder(a).v }; }
    const bw = keep.BTCUSD.rsi.filter((x, i) => x != null && new Date(keep.BTCUSD.dates[i] + "T00:00:00Z").getUTCDay() % 6 !== 0);
    out.cross.BTC_weekdays = { from, ladder: ladder(bw).v, note: "Bitcoin RSI read on weekdays only (the RSI itself still uses every day)" };
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const OUT = opt("--out") ?? path.resolve(here, "../../deliverables/20260928/rsi-ladder/rsi-ladder.json");
  const only = opt("--only")?.split(","), reps = opt("--reps") ? +opt("--reps") : BOOT_N;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const t0 = Date.now(); const out = run(ROOT, { only, reps, log: (k) => console.log(k, `${Date.now() - t0} ms`) });
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1e6).toFixed(1)} MB) in ${Date.now() - t0} ms`);
  for (const [k, A] of Object.entries(out.instruments)) { if (A.missing) { console.log(k, "MISSING"); continue; }
    const L = A.ladder.full, P = A.pull;
    console.log(`${k.padEnd(6)} ${A.from}→${A.to} p1=${L[1]} p5=${L[5]} p50=${L[50]} p95=${L[95]} p99=${L[99]} | r1 f20 ${A.byRung[0].f20} [${A.byRung[0].band.f20}] base ${A.base.f20} | pulls ${P.n} open ${P.open} medLow→NH ${P.medianLowToNew} rho ${P.rhoDepthTime} nextLeg ${P.nextLegShare}% | now ${A.now.rsi} rung ${A.now.rung}`); }
}
