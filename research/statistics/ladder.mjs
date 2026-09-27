/* Scintilla · statistics S8 · the LADDER — forward outcomes from RSI and moving-average levels.
   Pure functions, no fetch, no clock. Used by s8-ladder.mjs (node) and the tests.

   Alan, 27 Sep: "if you caught the RSI at 5% of its history, how did that play go… at 10? 15, 20…
   the moving averages — where you bought at X moving average, then what?… start with the broad market."
   Everything here measures FORWARD from the entry close; nothing measures what shows up at a low.

   Definitions (stated once, printed on the page):
   · entry = the close of the signal day i; forward return h = close[i+h] / close[i] - 1 (price only — the
     bars are split-adjusted, not dividend-adjusted).
   · own-history percentile: entries.mjs rsiOwnPercentile — prior 756 readings (3 years), at least 250,
     today never inside its own sample. The same routine ranks the distance to an average.
   · the cloud averages are station-clouds.js exactly: EMA 13 / 21 start at the first close with weight
     2/(n+1) and are not used for the first 60 sessions; SMA 50 / 200 are plain means of the closes.
   · usual day = stats.mjs usualDay (sample sd of the last 60 daily % moves). Distance in usual days =
     100 * (close / average - 1) / usual day.
   · episode = the first day of an unbroken run of signal days. Non-overlapping trades = greedy from the
     first signal day; the next is taken only h or more sessions after the previous entry.
   · report timing: see inferTiming. */
import { rsiWilder, sma, usualDay, spread } from "./stats.mjs";
import { rsiOwnPercentile } from "./entries.mjs";

export const RSI_LEVELS = [5, 10, 15, 20, 25, 30, 35, 40, 50, 60, 70];
export const HORIZONS = [10, 20, 40];
export const MA_KEYS = ["e13", "e21", "s50", "s200"];
export const MA_LABEL = { e13: "13-day EMA", e21: "21-day EMA", s50: "50-day SMA", s200: "200-day SMA" };
/* distance bands, by the distance's own-history percentile (prior 3 years), plus "at the average" */
export const DIST_BANDS = [
  { key: "p0-10", lo: 0, hi: 10, label: "furthest below (bottom 10% of its own distances)" },
  { key: "p10-25", lo: 10, hi: 25, label: "well below (10–25%)" },
  { key: "p25-50", lo: 25, hi: 50, label: "a little below usual (25–50%)" },
  { key: "p50-75", lo: 50, hi: 75, label: "a little above usual (50–75%)" },
  { key: "p75-90", lo: 75, hi: 90, label: "well above (75–90%)" },
  { key: "p90-100", lo: 90, hi: 100.0001, label: "extended (top 10%)" },
];
export const AT_AVERAGE_UD = 0.5;          // "at the average": within half a usual day either side
export const EXTENDED_LEVELS = [70, 80, 90, 95];
export const EMA_WARMUP = 60;

const dstr = (t) => new Date(t).toISOString().slice(0, 10);

/** station-clouds.js dailyRows, arithmetic only. */
export function stationAverages(closes) {
  const n = closes.length, out = { e13: new Array(n).fill(null), e21: new Array(n).fill(null), s50: sma(closes, 50), s200: sma(closes, 200) };
  let e13 = null, e21 = null;
  for (let i = 0; i < n; i++) {
    const c = closes[i];
    e13 = e13 === null ? c : (2 / 14) * c + (1 - 2 / 14) * e13;
    e21 = e21 === null ? c : (2 / 22) * c + (1 - 2 / 22) * e21;
    if (i >= EMA_WARMUP) { out.e13[i] = e13; out.e21[i] = e21; }
  }
  return out;
}

/** The analysed segment: after the last hole longer than 365 days (the stats.mjs rule). */
export function segment(bars) {
  let start = 0;
  for (let i = 1; i < bars.length; i++) if ((bars[i].t - bars[i - 1].t) / 86400e3 > 365) start = i;
  return { bars: bars.slice(start), dropped: start, note: start ? `history before ${dstr(bars[start].t)} dropped (a hole of more than a year)` : null };
}

/** Everything the ladder reads, per bar, from bars 0..i only. */
export function seriesOf(bars) {
  const c = bars.map((b) => +b.c), o = bars.map((b) => +(b.o ?? b.c)), dates = bars.map((b) => dstr(b.t));
  const rsi = rsiWilder(c, 14), pct = rsiOwnPercentile(rsi), usual = usualDay(c, 60), ma = stationAverages(c);
  const dist = {}, distUd = {}, distPct = {};
  for (const k of MA_KEYS) {
    dist[k] = c.map((x, i) => ma[k][i] > 0 ? (x / ma[k][i] - 1) * 100 : null);
    distUd[k] = dist[k].map((d, i) => d != null && usual[i] > 0 ? d / usual[i] : null);
    distPct[k] = rsiOwnPercentile(distUd[k]);
  }
  const trend = c.map((x, i) => ma.s200[i] > 0 ? x > ma.s200[i] : null);
  return { c, o, dates, rsi, pct, usual, ma, dist, distUd, distPct, trend };
}

export function forward(c, h) { return c.map((x, i) => i + h < c.length && x > 0 ? (c[i + h] / x - 1) * 100 : null); }

export function bandOf(p) { if (p == null) return null; for (const b of DIST_BANDS) if (p >= b.lo && p < b.hi) return b.key; return null; }

/** Indices of episode starts and of non-overlapping entries for a boolean signal (null = unmeasurable = false). */
export function entries(sig, h, usable = () => true) {
  const eps = [], non = [];
  let last = -Infinity;
  for (let i = 0; i < sig.length; i++) {
    if (!sig[i]) continue;
    if (!sig[i - 1] && usable(i)) eps.push(i);
    if (i >= last + h && usable(i)) { non.push(i); last = i; }
  }
  return { eps, non };
}

/** Compact result for a list of forward returns: n, share up, median, 25th, 75th. */
export function summ(xs) {
  const s = spread(xs);
  return { n: s.n, win: r1(s.share_positive), med: r2(s.median), q25: r2(s.q25), q75: r2(s.q75) };
}
export const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
export const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;

/** How many of the last k results went the way of `sign` (+1 up, -1 down). */
export function consistency(xs, k = 8, sign = 1) {
  const last = xs.filter((v) => v != null).slice(-k);
  return { of: last.length, same: last.filter((v) => sign > 0 ? v > 0 : v <= 0).length };
}

/* ---------- random numbers, bootstrap, shuffle (deterministic: seeded) ---------- */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Clustered bootstrap of the share up. `items` [{ret, cluster}] — whole clusters are resampled, so a sell-off
    in which 40 names fired at once counts as one draw, not 40. Returns the 2.5th and 97.5th percentiles. */
export function clusterBootstrap(items, reps = 400, seed = 7) {
  const by = new Map();
  for (const it of items) { if (it.ret == null) continue; const k = it.cluster; if (!by.has(k)) by.set(k, [0, 0]); const g = by.get(k); g[0]++; if (it.ret > 0) g[1]++; }
  const groups = [...by.values()], m = groups.length;
  if (m < 2) return { clusters: m, ci95: [null, null] };
  const R = rng(seed), wins = [];
  for (let r = 0; r < reps; r++) {
    let n = 0, u = 0;
    for (let j = 0; j < m; j++) { const g = groups[Math.floor(R() * m)]; n += g[0]; u += g[1]; }
    wins.push(100 * u / n);
  }
  wins.sort((a, b) => a - b);
  return { clusters: m, ci95: [r1(wins[Math.floor(reps * 0.025)]), r1(wins[Math.floor(reps * 0.975)])] };
}

/** Shuffle baseline: for each pool (a name, or an index), draw as many random usable days as the signal took,
    from `candidates` (days that satisfy the same outside condition, e.g. the same market state), and read the
    share up. Returns the mean and the 95th percentile over `reps` draws — a lift above the 95th is not luck of
    the draw. `pools` = [{taken, candidates: [forward return]}]. */
export function shuffleBaseline(pools, reps = 200, seed = 11) {
  const R = rng(seed), wins = [];
  for (let r = 0; r < reps; r++) {
    let n = 0, u = 0;
    for (const p of pools) {
      const m = p.candidates.length; if (!m) continue;
      for (let j = 0; j < p.taken; j++) { const v = p.candidates[Math.floor(R() * m)]; n++; if (v > 0) u++; }
    }
    if (n) wins.push(100 * u / n);
  }
  wins.sort((a, b) => a - b);
  const mean = wins.reduce((a, b) => a + b, 0) / (wins.length || 1);
  return { reps: wins.length, mean: r1(mean), p95: r1(wins[Math.floor(wins.length * 0.95)] ?? null) };
}

/* ---------- report timing (the S8 data fix) ----------
   The export has a before-open / after-close flag for 4% of reports; S6 treated the rest as after the close,
   which, for a morning reporter, puts the report reaction inside the "run-up". The reaction lives in the
   overnight gap: a report before the open moves the gap INTO the report date (open[d] vs close[d-1]); a report
   after the close moves the gap into the next session (open[d+1] vs close[d]). Each gap is scaled by the name's
   usual day at d-1. Rule:
     BMO when gapSame >= RATIO × gapNext and gapSame >= MIN_UD usual days; AMC the mirror; otherwise ambiguous.
   A report dated on a day with no session (weekend, holiday) reacts on the next session either way ("either").
   Ambiguous reports take the majority of the name's clear calls within ±3 years ("neighbours"), else stay
   unknown. Every inferred time is flagged as inferred. */
export const TIMING_RATIO = 2, TIMING_MIN_UD = 1;
export function inferTiming(S, date) {
  let d = S.dates.findIndex((x) => x >= date);
  if (d < 1 || d + 1 >= S.c.length) return { call: null, why: "outside the bars" };
  if (S.dates[d] !== date) return { call: "either", why: "no session on the report date; the next session carries it either way" };
  const u = S.usual[d - 1];
  if (!(u > 0)) return { call: null, why: "no usual day yet" };
  const gapSame = Math.abs(S.o[d] / S.c[d - 1] - 1) * 100 / u, gapNext = Math.abs(S.o[d + 1] / S.c[d] - 1) * 100 / u;
  const out = { gapSame: r2(gapSame), gapNext: r2(gapNext) };
  if (gapSame >= TIMING_RATIO * gapNext && gapSame >= TIMING_MIN_UD) return { ...out, call: "BMO", why: "the report date opened with the bigger gap" };
  if (gapNext >= TIMING_RATIO * gapSame && gapNext >= TIMING_MIN_UD) return { ...out, call: "AMC", why: "the next session opened with the bigger gap" };
  return { ...out, call: "ambiguous", why: "neither gap clearly bigger" };
}

/** Fills the timing for one name's rows. rows [{date, report_time}]; returns rows with report_time + source. */
export function timeRows(S, rows) {
  const calls = rows.map((r) => ({ r, inf: inferTiming(S, String(r.date).slice(0, 10)) }));
  const clear = calls.filter((x) => x.inf.call === "BMO" || x.inf.call === "AMC");
  return calls.map(({ r, inf }) => {
    const date = String(r.date).slice(0, 10), base = { ...r, inferred_gap_same_ud: inf.gapSame ?? null, inferred_gap_next_ud: inf.gapNext ?? null, inferred_call: inf.call };
    if (r.report_time === "BMO" || r.report_time === "AMC") return { ...base, report_time_source: "export" };
    if (inf.call === "BMO" || inf.call === "AMC") return { ...base, report_time: inf.call, report_time_source: "inferred: opening gap" };
    if (inf.call === "either") return { ...base, report_time: "AMC", report_time_source: "inferred: no session on the date (same session either way)" };
    const y = +date.slice(0, 4);
    const near = clear.filter((x) => Math.abs(+String(x.r.date).slice(0, 4) - y) <= 3);
    const b = near.filter((x) => x.inf.call === "BMO").length, a = near.length - b;
    if (near.length >= 3 && b !== a) return { ...base, report_time: b > a ? "BMO" : "AMC", report_time_source: `inferred: the name's clear calls within 3 years (${b} before-open, ${a} after-close)` };
    return { ...base, report_time: null, report_time_source: "unknown" };
  });
}
