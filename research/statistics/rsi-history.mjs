/* RSI FULL HISTORY · 28 Sep 2026 — RSI(14, Wilder, daily) on the longest daily history we hold, per instrument.
   node research/statistics/rsi-history.mjs [--cache-root <dir>] [--out <file>]
   Reads <cache-root>/daily-bars-rsi/<SYM>.json (chart API /candles?tf=D&limit=20000, saved as served on 28 Sep)
   and <cache-root>/daily-bars-rsi/fmp-indexes.json (FMP stable historical-price-eod/full for ^GSPC ^NDX ^IXIC ^RUT ^DJI,
   fetched on 28 Sep from inside the Fly bar-service machine — the key never left Fly). No network, no database.

   What it measures (the page repeats every rule in plain words)
   (a) RSI value at each percentile, 5% steps, on the FULL history and on the LAST 3 YEARS (756 sessions; Bitcoin 1,095 days).
   (b) Zone episodes: the bottom 10% / top 10% zone is RSI at or below the full-history 10th percentile (at or above the 90th).
       An episode starts on the first close inside the zone and ends on the last close inside it; a return within 5 sessions
       of leaving counts as the same episode. Forward returns are close to close from the ENTRY close, 5/10/20/60 sessions,
       against the any-day baseline (every day's forward return over the same history). Interval = 90% month-clustered
       bootstrap (whole calendar months of entries resampled, 2,000 draws, fixed seed).
       The threshold itself is set from the full history (it "knows" the whole distribution). A no-hindsight check row uses
       each day's own percentile against the previous 756 readings only (entries.mjs rsiOwnPercentile).
   (c) Swings: S9's pivot rule (s9-research.mjs: 10 bars each side on the wick, alternating, leg ends moved to the true
       extreme). RSI at every swing low by the decline's depth, and at every swing high by the rise's size. Descriptive.
   (d) Divergence at CONFIRMED pivots (raw 10/10 pivots, never the refined swings): bullish = the pivot low is below the
       previous pivot low (within 60 sessions) while RSI at it is above RSI at the previous one; bearish mirrors it on highs.
       The pivot is only known 10 sessions after it prints; every forward return starts from that confirmation close.
       Compared with the same pivots WITHOUT divergence and with the any-day baseline.
   Forward returns are price only (split-adjusted ETFs, index levels, no dividends). US 10-year yield moves are in basis
   points, not percent. A forward return is skipped when either close is at or below zero (WTI oil, 20 Apr 2020). */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { rsiWilder } from "./stats.mjs";
import { rsiOwnPercentile } from "./entries.mjs";
import { cleanBars, swings, pivotPoints, quantile, median, r1, r2 } from "./s9-research.mjs";
import { segment } from "./ladder.mjs";

export const PIVOT_LEN = 10, DIV_MAX_GAP = 60, MERGE_GAP = 5, HORIZONS = [5, 10, 20, 60], BOOT_N = 2000, SEED = 20260928;
export const MOVE_BUCKETS = [[0, 3, "0–3%"], [3, 5, "3–5%"], [5, 10, "5–10%"], [10, 20, "10–20%"], [20, Infinity, "20%+"]];
/** The instruments, in page order. src: api = chart API /candles; fmp = FMP index history. */
export const INSTRUMENTS = [
  { key: "SPX", name: "S&P 500 index", src: "fmp", sym: "^GSPC", group: "Stock indexes" },
  { key: "SPY", name: "SPY (S&P 500 fund)", src: "api", sym: "SPY", group: "Stock indexes" },
  { key: "NDX", name: "Nasdaq 100 index", src: "fmp", sym: "^NDX", group: "Stock indexes" },
  { key: "QQQ", name: "QQQ (Nasdaq 100 fund)", src: "api", sym: "QQQ", group: "Stock indexes" },
  { key: "IXIC", name: "Nasdaq Composite", src: "fmp", sym: "^IXIC", group: "Stock indexes" },
  { key: "RUT", name: "Russell 2000 index", src: "fmp", sym: "^RUT", group: "Stock indexes" },
  { key: "IWM", name: "IWM (Russell 2000 fund)", src: "api", sym: "IWM", group: "Stock indexes" },
  { key: "DJI", name: "Dow Jones Industrial", src: "fmp", sym: "^DJI", group: "Stock indexes" },
  { key: "DIA", name: "DIA (Dow fund)", src: "api", sym: "DIA", group: "Stock indexes" },
  { key: "VIX", name: "VIX (fear index)", src: "api", sym: "VIX", group: "Fear, rates, dollar" },
  { key: "US10Y", name: "US 10-year yield", src: "api", sym: "US10Y", group: "Fear, rates, dollar", unit: "bp" },
  { key: "TLT", name: "TLT (long Treasuries fund)", src: "api", sym: "TLT", group: "Fear, rates, dollar" },
  { key: "DXY", name: "US dollar index", src: "api", sym: "DXY", group: "Fear, rates, dollar" },
  { key: "CLUSD", name: "WTI crude oil", src: "api", sym: "CLUSD", group: "Commodities, crypto" },
  { key: "GCUSD", name: "Gold", src: "api", sym: "GCUSD", group: "Commodities, crypto" },
  { key: "SIUSD", name: "Silver", src: "api", sym: "SIUSD", group: "Commodities, crypto" },
  { key: "BTCUSD", name: "Bitcoin", src: "api", sym: "BTCUSD", group: "Commodities, crypto", start: "2013-01-01", calendar: true },
];
const MAX_WICK = { default: 0.25, BTCUSD: 0.5, VIX: 1.0 };   // VIX spikes of 50%+ inside a day are real (5 Aug 2024: high 65.73, close 38.57)
const dstr = (t) => new Date(t).toISOString().slice(0, 10);

/* ---------------- small, tested pieces ---------------- */
/** Seeded PRNG (mulberry32) so the intervals are reproducible run to run. */
export function rng(seed = SEED) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
export const mean = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
export const shareUp = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)); return a.length ? 100 * a.filter((x) => x > 0).length / a.length : null; };

/** RSI value at each percentile (5..95 by 5) of the readings from `from` (index) on. Also min/max and 1st/99th. */
export function percentileTable(rsi, from = 0) {
  const a = []; for (let i = from; i < rsi.length; i++) if (rsi[i] != null) a.push(rsi[i]);
  a.sort((p, q) => p - q);
  const steps = []; for (let q = 5; q <= 95; q += 5) steps.push(r1(quantile(a, q / 100)));
  return { n: a.length, steps, p1: r1(quantile(a, 0.01)), p99: r1(quantile(a, 0.99)), min: r1(a[0]), max: r1(a[a.length - 1]) };
}
/** Where x sits in the readings (0–100, ties count half). */
export function percentileOf(sortedAsc, x) {
  if (x == null || !sortedAsc.length) return null;
  let lo = 0, hi = sortedAsc.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sortedAsc[m] < x) lo = m + 1; else hi = m; }
  let eq = 0; for (let j = lo; j < sortedAsc.length && sortedAsc[j] === x; j++) eq++;
  return 100 * (lo + eq / 2) / sortedAsc.length;
}

/** Zone episodes. inZone(i) → true/false/null. Re-entry within `gap` sessions of the last in-zone day joins the episode. */
export function episodes(inZone, n, gap = MERGE_GAP) {
  const out = []; let cur = null;
  for (let i = 0; i < n; i++) {
    if (inZone(i) !== true) continue;
    if (cur && i - cur.last <= gap + 1) { cur.last = i; cur.days++; continue; }
    if (cur) out.push(cur);
    cur = { start: i, last: i, days: 1 };
  }
  if (cur) out.push(cur);
  return out.map((e) => ({ ...e, length: e.last - e.start + 1 }));
}

/** Forward change from close i to close i+h: percent, or basis points for yields. null when not measurable. */
export function fwd(c, i, h, unit = "pct") {
  if (i + h >= c.length || c[i] == null || c[i + h] == null) return null;
  if (unit === "bp") return (c[i + h] - c[i]) * 100;
  if (!(c[i] > 0) || !(c[i + h] > 0)) return null;
  return (c[i + h] / c[i] - 1) * 100;
}
/** Worst close in the next h sessions against the entry close (percent; bp for yields). */
export function worstAhead(c, i, h, unit = "pct") {
  if (i + h >= c.length) return null;
  let m = Infinity; for (let k = i + 1; k <= i + h; k++) if (c[k] != null) m = Math.min(m, c[k]);
  if (unit === "bp") return (m - c[i]) * 100;
  return c[i] > 0 && m > 0 ? (m / c[i] - 1) * 100 : null;
}

/** 90% month-clustered bootstrap of the median and the share up. events: [{month, value}]. */
export function clusterBoot(events, reps = BOOT_N, seed = SEED) {
  const ev = events.filter((e) => e.value != null && Number.isFinite(e.value));
  if (ev.length < 3) return { n: ev.length, med: r2(median(ev.map((e) => e.value))), medLo: null, medHi: null, upLo: null, upHi: null };
  const byM = new Map(); for (const e of ev) { if (!byM.has(e.month)) byM.set(e.month, []); byM.get(e.month).push(e.value); }
  const groups = [...byM.values()], R = rng(seed), meds = [], ups = [];
  for (let b = 0; b < reps; b++) {
    const pick = []; for (let g = 0; g < groups.length; g++) pick.push(...groups[Math.floor(R() * groups.length)]);
    meds.push(median(pick)); ups.push(shareUp(pick));
  }
  meds.sort((a, b) => a - b); ups.sort((a, b) => a - b);
  return { n: ev.length, months: groups.length, med: r2(median(ev.map((e) => e.value))), medLo: r2(quantile(meds, 0.05)), medHi: r2(quantile(meds, 0.95)), upLo: r1(quantile(ups, 0.05)), upHi: r1(quantile(ups, 0.95)) };
}

/** Forward-return block for a set of entry indices, against the any-day baseline. */
export function forwardBlock(S, idx, baseline, unit) {
  const out = {};
  for (const h of HORIZONS) {
    const vals = idx.map((i) => ({ month: S.dates[i].slice(0, 7), value: fwd(S.c, i, h, unit) }));
    const bt = clusterBoot(vals, BOOT_N, SEED + h);
    const v = vals.map((e) => e.value);
    out[h] = { ...bt, mean: r2(mean(v)), up: r1(shareUp(v)), base: baseline[h], excess: bt.med != null && baseline[h].med != null ? r2(bt.med - baseline[h].med) : null };
  }
  out.worst20 = r2(median(idx.map((i) => worstAhead(S.c, i, 20, unit))));
  return out;
}
export function baselineOf(S, unit) {
  const out = {};
  for (const h of HORIZONS) { const v = []; for (let i = 0; i < S.c.length; i++) if (S.rsi[i] != null) v.push(fwd(S.c, i, h, unit)); out[h] = { n: v.filter((x) => x != null).length, med: r2(median(v)), mean: r2(mean(v)), up: r1(shareUp(v)) }; }
  const w = []; for (let i = 0; i < S.c.length; i++) if (S.rsi[i] != null) w.push(worstAhead(S.c, i, 20, unit));
  out.worst20 = r2(median(w));
  return out;
}

/** Divergences at confirmed pivots (raw pivots, known at k + len). Returns bullish/bearish lists and their controls. */
export function divergences(S, len = PIVOT_LEN, maxGap = DIV_MAX_GAP) {
  const piv = pivotPoints(S.h, S.l, len);
  const lows = piv.filter((p) => p.type === "L"), highs = piv.filter((p) => p.type === "H");
  const pairs = (list, kind) => {
    const out = [];
    for (let j = 1; j < list.length; j++) {
      const a = list[j - 1], b = list[j];
      if (b.k - a.k > maxGap || S.rsi[a.k] == null || S.rsi[b.k] == null) continue;
      const conf = b.k + len; if (conf >= S.c.length) continue;
      const priceMore = kind === "L" ? b.price < a.price : b.price > a.price;       // lower low / higher high
      if (!priceMore) continue;
      const div = kind === "L" ? S.rsi[b.k] > S.rsi[a.k] : S.rsi[b.k] < S.rsi[a.k];  // RSI disagrees
      out.push({ k1: a.k, k2: b.k, conf, d1: S.dates[a.k], d2: S.dates[b.k], dConf: S.dates[conf], p1: r2(a.price), p2: r2(b.price),
        rsi1: r1(S.rsi[a.k]), rsi2: r1(S.rsi[b.k]), div, gap: b.k - a.k,
        waitCost: S.c[conf] > 0 && b.price > 0 ? r2((S.c[conf] / b.price - 1) * 100) : null });
    }
    return out;
  };
  return { lows: pairs(lows, "L"), highs: pairs(highs, "H") };
}

/** RSI at swing lows (by decline depth) and swing highs (by rise size). S9's swings. */
export function swingRsi(S, len = PIVOT_LEN, pctSorted) {
  const sw = swings(S.h, S.l, len), downs = [], ups = [];
  for (let i = 0; i + 1 < sw.length; i++) {
    const a = sw[i], b = sw[i + 1];
    const move = (b.price / a.price - 1) * 100;
    const rec = { from: S.dates[a.k], to: S.dates[b.k], move: r2(move), bars: b.k - a.k, rsi: r1(S.rsi[b.k]), pct: r1(percentileOf(pctSorted, S.rsi[b.k])) };
    if (a.type === "H" && b.type === "L") downs.push(rec); else if (a.type === "L" && b.type === "H") ups.push(rec);
  }
  const tab = (recs) => MOVE_BUCKETS.map(([lo, hi, label]) => {
    const g = recs.filter((r) => Math.abs(r.move) >= lo && Math.abs(r.move) < hi && r.rsi != null), xs = g.map((r) => r.rsi).sort((p, q) => p - q);
    return { bucket: label, n: g.length, rsiMed: r1(median(xs)), rsiQ1: r1(quantile(xs, 0.25)), rsiQ3: r1(quantile(xs, 0.75)), rsiMin: r1(xs[0]), rsiMax: r1(xs[xs.length - 1]), pctMed: r1(median(g.map((r) => r.pct))), barsMed: median(g.map((r) => r.bars)) };
  });
  return { downs: tab(downs), ups: tab(ups), nDowns: downs.length, nUps: ups.length, recentDowns: downs.slice(-6), recentUps: ups.slice(-6), allDowns: downs };
}

/* ---------------- loading ---------------- */
export function loadInstrument(ROOT, I, fmpCache) {
  let raw;
  if (I.src === "fmp") {
    fmpCache.v ??= JSON.parse(fs.readFileSync(path.join(ROOT, "daily-bars-rsi/fmp-indexes.json"), "utf8"));
    const rows = fmpCache.v[I.sym]; if (!rows?.length) return null;
    raw = { bars: rows.map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v })), provider: "FMP", providerSymbol: I.sym, basis: "INDEX_LEVEL", via: "FMP stable historical-price-eod/full (fetched on Fly, 28 Sep)" };
  } else {
    const f = path.join(ROOT, "daily-bars-rsi", I.sym + ".json"); if (!fs.existsSync(f)) return null;
    const j = JSON.parse(fs.readFileSync(f, "utf8"));
    raw = { bars: j.series, provider: j.provider, providerSymbol: j.provider_symbol, basis: j.price_basis, via: "chart API /candles?tf=D&limit=20000 (28 Sep)" };
  }
  let bars = raw.bars.filter((b) => b.c != null && Number.isFinite(+b.c));
  // weekend prints: drop for everything but Bitcoin, from 1953 on (the NYSE traded Saturdays until 1952)
  const weekend = bars.filter((b) => !I.calendar && [0, 6].includes(new Date(b.t).getUTCDay()) && dstr(b.t) >= "1953-01-01");
  if (!I.calendar) bars = bars.filter((b) => !([0, 6].includes(new Date(b.t).getUTCDay()) && dstr(b.t) >= "1953-01-01"));
  if (I.start) bars = bars.filter((b) => dstr(b.t) >= I.start);
  const { bars: clean, cleaned } = cleanBars(bars, MAX_WICK[I.key] ?? MAX_WICK.default);
  const seg = segment(clean);
  const onlyClose = seg.bars.filter((b) => +b.h === +b.l).length;
  return { bars: seg.bars, meta: { provider: raw.provider, providerSymbol: raw.providerSymbol, basis: raw.basis, via: raw.via, served: raw.bars.length, cleaned, dropped: seg.dropped, holeNote: seg.note, weekendDropped: weekend.map((b) => dstr(b.t)), onlyCloseBars: onlyClose } };
}
export function seriesOf(bars) {
  const c = bars.map((b) => +b.c), h = bars.map((b) => +b.h), l = bars.map((b) => +b.l), dates = bars.map((b) => dstr(b.t));
  const rsi = rsiWilder(c, 14), own = rsiOwnPercentile(rsi);
  return { c, h, l, dates, rsi, own };
}

/* ---------------- one instrument ---------------- */
export function analyse(S, I) {
  const unit = I.unit === "bp" ? "bp" : "pct", n = S.c.length;
  const last3 = Math.max(0, n - (I.calendar ? 1095 : 756));
  const full = percentileTable(S.rsi), recent = percentileTable(S.rsi, last3);
  const sortedAll = S.rsi.filter((x) => x != null).sort((a, b) => a - b), sorted3 = S.rsi.slice(last3).filter((x) => x != null).sort((a, b) => a - b);
  const lo10 = quantile(sortedAll, 0.10), hi90 = quantile(sortedAll, 0.90);
  const years = (Date.parse(S.dates[n - 1]) - Date.parse(S.dates[S.rsi.findIndex((x) => x != null)])) / (365.25 * 864e5);
  const baseline = baselineOf(S, unit);
  const zone = (test) => {
    const eps = episodes((i) => S.rsi[i] == null ? null : test(i), n);
    const idx = eps.map((e) => e.start);
    return { count: eps.length, perYear: r2(eps.length / years), lengthMed: median(eps.map((e) => e.length)), lengthQ3: r1(quantile(eps.map((e) => e.length).sort((a, b) => a - b), 0.75)), lengthMax: Math.max(0, ...eps.map((e) => e.length)),
      daysShare: r1(100 * eps.reduce((s, e) => s + e.days, 0) / sortedAll.length), fwd: forwardBlock(S, idx, baseline, unit),
      recent: eps.slice(-5).map((e) => ({ start: S.dates[e.start], end: S.dates[e.last], length: e.length, rsiAtEntry: r1(S.rsi[e.start]), f20: r2(fwd(S.c, e.start, 20, unit)), f60: r2(fwd(S.c, e.start, 60, unit)) })),
      starts: eps.map((e) => S.dates[e.start]) };
  };
  const bottom = zone((i) => S.rsi[i] <= lo10), top = zone((i) => S.rsi[i] >= hi90);
  // no-hindsight check: own percentile against the previous 756 readings only
  const bottomOwn = (() => { const eps = episodes((i) => S.own[i] == null ? null : S.own[i] <= 10, n); return { count: eps.length, perYear: r2(eps.length / years), lengthMed: median(eps.map((e) => e.length)), fwd: forwardBlock(S, eps.map((e) => e.start), baseline, unit) }; })();
  const topOwn = (() => { const eps = episodes((i) => S.own[i] == null ? null : S.own[i] >= 90, n); return { count: eps.length, perYear: r2(eps.length / years), lengthMed: median(eps.map((e) => e.length)), fwd: forwardBlock(S, eps.map((e) => e.start), baseline, unit) }; })();
  const sw = swingRsi(S, PIVOT_LEN, sortedAll);
  const dv = divergences(S), dv5 = divergences(S, 5);
  const divBlock = (list, isDiv) => { const g = list.filter((x) => x.div === isDiv); return { count: g.length, perYear: r2(g.length / years), waitCostMed: r2(median(g.map((x) => x.waitCost))), fwd: forwardBlock(S, g.map((x) => x.conf), baseline, unit) }; };
  const div = {
    bull: divBlock(dv.lows, true), lowerLowNoDiv: divBlock(dv.lows, false),
    bear: divBlock(dv.highs, true), higherHighNoDiv: divBlock(dv.highs, false),
    bullRecent: dv.lows.filter((x) => x.div).slice(-6), bearRecent: dv.highs.filter((x) => x.div).slice(-6),
    len5: { bull: divBlock(dv5.lows, true), lowerLowNoDiv: divBlock(dv5.lows, false), bear: divBlock(dv5.highs, true), higherHighNoDiv: divBlock(dv5.highs, false) },
    bullDates: dv.lows.filter((x) => x.div).map((x) => [x.d2, x.dConf]), bearDates: dv.highs.filter((x) => x.div).map((x) => [x.d2, x.dConf]),
  };
  const lastRsi = S.rsi[n - 1];
  const now = { date: S.dates[n - 1], close: r2(S.c[n - 1]), rsi: r1(lastRsi), pctFull: r1(percentileOf(sortedAll, lastRsi)), pct3y: r1(percentileOf(sorted3, lastRsi)) };
  // chart data: last 3 years daily; full history sampled to at most 1,500 points (every k-th close, plus the last)
  const k = Math.max(1, Math.ceil(n / 1500)), samp = []; for (let i = 0; i < n; i += k) samp.push(i); if (samp[samp.length - 1] !== n - 1) samp.push(n - 1);
  const chart = { recent: S.dates.slice(last3).map((d, j) => [d, r2(S.c[last3 + j]), r1(S.rsi[last3 + j])]), full: samp.map((i) => [S.dates[i], r2(S.c[i]), r1(S.rsi[i])]), step: k };
  return { key: I.key, name: I.name, group: I.group, unit, from: S.dates[0], to: S.dates[n - 1], sessions: n, years: r1(years), recentFrom: S.dates[last3],
    full, recent, lo10: r1(lo10), hi90: r1(hi90), baseline, bottom, top, bottomOwn, topOwn, swings: sw, div, now, chart };
}

/* ---------------- Nasdaq vs S&P ---------------- */
export function nasdaqVsSp(Sa, Sb, labelA, labelB, from = null) {
  const mapB = new Map(Sb.dates.map((d, i) => [d, i]));
  const both = []; for (let i = 0; i < Sa.dates.length; i++) { const j = mapB.get(Sa.dates[i]); if (j != null && Sa.rsi[i] != null && Sb.rsi[j] != null && (!from || Sa.dates[i] >= from)) both.push([i, j]); }
  const ra = both.map(([i]) => Sa.rsi[i]).sort((p, q) => p - q), rb = both.map(([, j]) => Sb.rsi[j]).sort((p, q) => p - q);
  const tbl = [1, 5, 10, 20, 50, 80, 90, 95, 99].map((q) => ({ pct: q, a: r1(quantile(ra, q / 100)), b: r1(quantile(rb, q / 100)) }));
  // on the S&P's (A's) swing lows of 10%+: B's lowest RSI within ±10 sessions of A's low
  const swA = swingRsi(Sa, PIVOT_LEN, ra).allDowns.filter((r) => r.move <= -10 && (!from || r.to >= from));
  const idxA = new Map(Sa.dates.map((d, i) => [d, i]));
  const lows = swA.map((r) => { const i = idxA.get(r.to), j = mapB.get(r.to); if (j == null) return null;
    let mb = Infinity; for (let k = Math.max(0, j - 10); k <= Math.min(Sb.rsi.length - 1, j + 10); k++) if (Sb.rsi[k] != null) mb = Math.min(mb, Sb.rsi[k]);
    let ma = Infinity; for (let k = Math.max(0, i - 10); k <= Math.min(Sa.rsi.length - 1, i + 10); k++) if (Sa.rsi[k] != null) ma = Math.min(ma, Sa.rsi[k]);
    return { low: r.to, depth: r.move, rsiA: r1(ma), rsiB: r1(mb), deeperB: mb < ma }; }).filter(Boolean);
  const inA10 = both.filter(([i]) => Sa.rsi[i] <= quantile(ra, 0.1));
  return { a: labelA, b: labelB, from: Sa.dates[both[0][0]], to: Sa.dates[both[both.length - 1][0]], days: both.length, table: tbl,
    shareBLower: r1(100 * both.filter(([i, j]) => Sb.rsi[j] < Sa.rsi[i]).length / both.length),
    shareBLowerWhenA10: r1(100 * inA10.filter(([i, j]) => Sb.rsi[j] < Sa.rsi[i]).length / Math.max(1, inA10.length)),
    lows, lowsBDeeper: lows.filter((x) => x.deeperB).length };
}

/* ---------------- runner ---------------- */
export function run(ROOT) {
  const out = { generated: new Date().toISOString(), kind: "RSI full history — RSI(14, Wilder, daily): percentile tables, zone episodes, swings, divergence. Descriptive; nothing here predicts.",
    rules: { pivotLen: PIVOT_LEN, divMaxGap: DIV_MAX_GAP, mergeGap: MERGE_GAP, horizons: HORIZONS, bootstrap: { reps: BOOT_N, seed: SEED, level: 90, cluster: "calendar month of the entry" } },
    sources: {}, instruments: {}, compare: {} };
  const fmpCache = {}, S_ = {};
  for (const I of INSTRUMENTS) {
    const L = loadInstrument(ROOT, I, fmpCache); if (!L) { out.instruments[I.key] = { missing: true, name: I.name }; continue; }
    const S = seriesOf(L.bars); S_[I.key] = S;
    out.sources[I.key] = { ...L.meta, name: I.name, from: S.dates[0], to: S.dates.at(-1), sessions: S.c.length, start: I.start ?? null };
    out.instruments[I.key] = analyse(S, I);
  }
  if (S_.SPX && S_.NDX) {
    out.compare.fullIndex = nasdaqVsSp(S_.SPX, S_.NDX, "S&P 500 index", "Nasdaq 100 index");
    const n = S_.SPX.dates.length; out.compare.last3Index = nasdaqVsSp(S_.SPX, S_.NDX, "S&P 500 index", "Nasdaq 100 index", S_.SPX.dates[n - 756]);
    out.compare.since2003Index = nasdaqVsSp(S_.SPX, S_.NDX, "S&P 500 index", "Nasdaq 100 index", "2003-09-11");
  }
  if (S_.SPY && S_.QQQ) out.compare.funds = nasdaqVsSp(S_.SPY, S_.QQQ, "SPY", "QQQ");
  if (S_.SPX && S_.IXIC) out.compare.composite = nasdaqVsSp(S_.SPX, S_.IXIC, "S&P 500 index", "Nasdaq Composite");
  // cross-check: SPY vs the S&P index on the same dates (they should agree closely)
  if (S_.SPX && S_.SPY) { const m = new Map(S_.SPX.dates.map((d, i) => [d, S_.SPX.rsi[i]])); const diffs = S_.SPY.dates.map((d, i) => m.has(d) && S_.SPY.rsi[i] != null && m.get(d) != null ? Math.abs(S_.SPY.rsi[i] - m.get(d)) : null).filter((x) => x != null).sort((a, b) => a - b);
    out.compare.spyVsIndex = { days: diffs.length, medAbsDiff: r2(median(diffs)), p95AbsDiff: r2(quantile(diffs, 0.95)) }; }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
  const here = path.dirname(fileURLToPath(import.meta.url));
  const OUT = opt("--out") ?? path.resolve(here, "../../deliverables/20260928/rsi-full-history/rsi-full-history.json");
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const t0 = Date.now(); const out = run(ROOT);
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} in ${Date.now() - t0} ms`);
  for (const I of INSTRUMENTS) { const A = out.instruments[I.key]; if (A.missing) { console.log(I.key, "MISSING"); continue; }
    console.log(`${I.key.padEnd(7)} ${A.from}→${A.to} n=${A.sessions} p10=${A.lo10} p90=${A.hi90} bottom ${A.bottom.count} (${A.bottom.perYear}/yr, med ${A.bottom.lengthMed}d) f20 ${A.bottom.fwd[20].med} [${A.bottom.fwd[20].medLo},${A.bottom.fwd[20].medHi}] base ${A.baseline[20].med} | bull div ${A.div.bull.count} f20 ${A.div.bull.fwd[20].med} vs noDiv ${A.div.lowerLowNoDiv.fwd[20].med} | now ${A.now.rsi} (${A.now.pctFull}%/${A.now.pct3y}%) cleaned ${out.sources[I.key].cleaned.length}`); }
}
