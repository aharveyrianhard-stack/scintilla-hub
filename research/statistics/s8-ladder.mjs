/* S8 · the LADDER — forward outcomes from RSI and moving-average levels, the market first.
   node --max-old-space-size=12000 research/statistics/s8-ladder.mjs [--cache-root <dir>] [--names A,B,...] [--export <timed export>] [--out <file>]
   Reads the durable bar caches (chart API bars copied 27 Sep) and data/earnings-export-timed-20260927.json
   (step 1). Writes data/s8-ladder.json. Read-only everywhere else. Definitions: ladder.mjs header.

   Parts
   A · indexes (SPY QQQ IWM DIA SMH + 11 sector SPDRs): every condition, 10/20/40 sessions, episodes and
       non-overlapping trades, split trend on (close above its own 200-day) / off, three time columns
       (full · last 5 years · last 250 episodes) and the last-8 consistency mark; the RSI × average grid.
   B · names: the same ladders, pooled over every stock with bars, split by the market state at entry
       (SPY above / below its 200-day; SPY's own RSI percentile bucket), each result also against SPY over the
       same sessions; and the run to the last close before the next report (corrected timing).
   C · combinations found on 2004–2016 and confirmed on 2017–2026 (min 100 non-overlapping trades per half),
       with five concrete trades each.
   Honesty: month-clustered bootstrap intervals, shuffle baselines, survivors only, price only. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { reportTiming, reportSession, spread } from "./stats.mjs";
import { seriesOf, segment, forward, entries, summ, consistency, clusterBootstrap, shuffleBaseline, bandOf,
  RSI_LEVELS, HORIZONS, MA_KEYS, MA_LABEL, DIST_BANDS, AT_AVERAGE_UD, EXTENDED_LEVELS, r1, r2 } from "./ladder.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const ONLY = opt("--names")?.split(",");
const OUT = opt("--out") ?? path.join(here, "data/s8-ladder.json");
const LAST5 = "2021-09-27", DISC = ["2004-01-01", "2017-01-01"], CONF = "2017-01-01";
const INDEXES = ["SPY", "QQQ", "IWM", "DIA", "SMH", "XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"];
const MIN_HALF = 100, MIN_MONTHS = 30;
/* not stocks: funds that carry fund "earnings" rows in the export (GLD, USO, MAGS, EWG, EWY, IEF), and SPCX, whose bars join
   two instruments under one ticker (a SPAC fund to Apr 2026, then SpaceX from Jun 2026, a 67-day hole the 365-day rule does not catch) */
const NOT_STOCKS = ["GLD", "USO", "MAGS", "EWG", "EWY", "IEF", "SPCX"];

function loadBars(sym) {
  const f5 = path.join(ROOT, "candles-f5", sym + ".json"), s7 = path.join(ROOT, "daily-bars-s7", sym + ".json");
  if (fs.existsSync(f5)) return { bars: JSON.parse(fs.readFileSync(f5, "utf8")).series, src: "candles-f5" };
  if (fs.existsSync(s7)) return { bars: JSON.parse(fs.readFileSync(s7, "utf8")), src: "daily-bars-s7" };
  return null;
}
const dayNum = (d) => Math.round(Date.parse(d + "T00:00:00Z") / 864e5);
const dayStr = (n) => new Date(n * 864e5).toISOString().slice(0, 10);
const monthOf = (n) => { const d = new Date(n * 864e5); return d.getUTCFullYear() * 12 + d.getUTCMonth(); };
const D_LAST5 = dayNum(LAST5), D_DISC0 = dayNum(DISC[0]), D_CONF = dayNum(CONF);

/* ================= A · INDEXES ================= */
function indexStudy(sym) {
  const L = loadBars(sym); if (!L) return { missing: true };
  const seg = segment(L.bars), S = seriesOf(seg.bars), n = S.c.length;
  const valid = S.pct.map((p) => p != null);
  const fw = Object.fromEntries(HORIZONS.map((h) => [h, forward(S.c, h)]));
  const month = S.dates.map((d) => monthOf(dayNum(d)));
  const conds = {};
  for (const T of RSI_LEVELS) conds[`rsi<=${T}`] = S.pct.map((p) => p != null && p <= T);
  RSI_LEVELS.forEach((T, j) => { const lo = j ? RSI_LEVELS[j - 1] : -1; conds[`rsi(${lo < 0 ? 0 : lo},${T}]`] = S.pct.map((p) => p != null && p > lo && p <= T); });
  for (const k of MA_KEYS) {
    for (const b of DIST_BANDS) conds[`${k}:${b.key}`] = S.distPct[k].map((p, i) => valid[i] && bandOf(p) === b.key);
    conds[`${k}:at`] = S.distUd[k].map((u, i) => valid[i] && u != null && Math.abs(u) <= AT_AVERAGE_UD);
    for (const E of EXTENDED_LEVELS) conds[`${k}:ext>=${E}`] = S.distPct[k].map((p, i) => valid[i] && p != null && p >= E);
  }
  // the first cut's "rising tide", with its own definitions, to verify it
  const d200pct = S.dist.s200;
  conds["firstcut:rsi<=10&d200>+3%"] = S.pct.map((p, i) => p != null && p <= 10 && d200pct[i] != null && d200pct[i] > 3);
  conds["firstcut:rsi<=10&d200<-3%"] = S.pct.map((p, i) => p != null && p <= 10 && d200pct[i] != null && d200pct[i] < -3);
  const grid = {};
  for (const k of MA_KEYS) for (const T of [10, 20, 30, 50]) for (const b of [...DIST_BANDS.map((x) => x.key), "at"]) {
    grid[`rsi<=${T}&${k}:${b}`] = conds[`rsi<=${T}`].map((v, i) => v && conds[`${k}:${b}`][i]);
  }
  const splits = { all: () => true, on: (i) => S.trend[i] === true, off: (i) => S.trend[i] === false };
  const base = {};
  for (const [sp, f] of Object.entries(splits)) for (const h of HORIZONS) {
    const idx = []; for (let i = 0; i < n; i++) if (valid[i] && fw[h][i] != null && f(i)) idx.push(i);
    const v = idx.map((i) => fw[h][i]);
    base[`${sp}:${h}`] = { full: summ(v), l5: summ(idx.filter((i) => S.dates[i] >= LAST5).map((i) => fw[h][i])), days: idx.length };
  }
  const row = (sig0, sp, h, boot) => {
    const f = splits[sp]; const sig = sig0.map((v, i) => v && f(i));
    const { eps, non } = entries(sig, h, (i) => fw[h][i] != null);
    const ev = eps.map((i) => fw[h][i]);
    const out = { ep: summ(ev), non: summ(non.map((i) => fw[h][i])), l5: summ(eps.filter((i) => S.dates[i] >= LAST5).map((i) => fw[h][i])),
      rc: summ(ev.slice(-250)), c8: consistency(ev), last: eps.length ? S.dates[eps.at(-1)] : null,
      days: sig.filter(Boolean).length };
    if (boot && eps.length >= 10) {
      out.ci = clusterBootstrap(eps.map((i) => ({ ret: fw[h][i], cluster: month[i] }))).ci95;
      const cand = []; for (let i = 0; i < n; i++) if (valid[i] && fw[h][i] != null && f(i)) cand.push(fw[h][i]);
      out.shuffle = shuffleBaseline([{ taken: eps.length, candidates: cand }]);
    }
    return out;
  };
  const rows = {};
  for (const [key, sig] of Object.entries(conds)) for (const sp of Object.keys(splits)) for (const h of HORIZONS) {
    rows[`${key}|${sp}|${h}`] = row(sig, sp, h, h === 20 && (key.startsWith("rsi<=") || key.startsWith("firstcut")));
  }
  for (const [key, sig] of Object.entries(grid)) for (const sp of Object.keys(splits)) rows[`${key}|${sp}|20`] = row(sig, sp, 20, false);
  // what the bands mean in plain units, for this instrument (full history)
  const bandMeaning = {};
  for (const k of MA_KEYS) for (const b of [...DIST_BANDS.map((x) => x.key), "at"]) {
    const sig = conds[`${k}:${b}`], ud = [], pc = [];
    for (let i = 0; i < n; i++) if (sig[i]) { ud.push(S.distUd[k][i]); pc.push(S.dist[k][i]); }
    bandMeaning[`${k}:${b}`] = { ud_median: r2(spread(ud).median), pct_median: r2(spread(pc).median), ud_range: [r2(spread(ud).q10), r2(spread(ud).q90)] };
  }
  const i = n - 1;
  const today = { date: S.dates[i], close: S.c[i], rsi: r1(S.rsi[i]), rsi_pct: r1(S.pct[i]), trend: S.trend[i],
    dist: Object.fromEntries(MA_KEYS.map((k) => [k, { pct: r2(S.dist[k][i]), ud: r2(S.distUd[k][i]), own_pct: r1(S.distPct[k][i]) }])) };
  return { source: L.src, bars: n, first: S.dates[0], last: S.dates[i], gap_note: seg.note, first_percentile_day: S.dates[valid.indexOf(true)],
    usual_day_median: r2(spread(S.usual).median), base, rows, band_meaning: bandMeaning, today };
}

/* ================= B · NAMES ================= */
class Buf {
  constructor() { this.n = 0; this.cap = 64; this.ret = new Float32Array(64); this.exc = new Float32Array(64); this.day = new Int32Array(64); this.name = new Int16Array(64); this.bar = new Int32Array(64); this.rank = new Int16Array(64); }
  push(ret, exc, day, name, bar, rank) {
    if (this.n === this.cap) { this.cap *= 2; for (const k of ["ret", "exc", "day", "name", "bar", "rank"]) { const a = new this[k].constructor(this.cap); a.set(this[k]); this[k] = a; } }
    const j = this.n++; this.ret[j] = ret; this.exc[j] = exc == null ? NaN : exc; this.day[j] = day; this.name[j] = name; this.bar[j] = bar; this.rank[j] = rank;
  }
}
const STATES = ["all", "spy>200", "spy<200", "spyRSI<=30", "spyRSI30-70", "spyRSI>70", "spy>200&spyRSI<=30", "spy<200&spyRSI<=30"];
const STATE_LABEL = { all: "any market", "spy>200": "SPY above its 200-day", "spy<200": "SPY below its 200-day", "spyRSI<=30": "SPY RSI in its bottom 30%",
  "spyRSI30-70": "SPY RSI in its middle (30–70%)", "spyRSI>70": "SPY RSI in its top 30%", "spy>200&spyRSI<=30": "a pullback in a rising market (SPY above its 200-day, SPY RSI bottom 30%)",
  "spy<200&spyRSI<=30": "a sell-off in a falling market (SPY below its 200-day, SPY RSI bottom 30%)" };
const NS = STATES.length;
const BANDS7 = [...DIST_BANDS.map((b) => b.key), "at"];
/* single conditions: any, rsi<=T (11), MA band (4 × 7) */
const SINGLE = ["any", ...RSI_LEVELS.map((T) => `rsi<=${T}`), ...MA_KEYS.flatMap((k) => BANDS7.map((b) => `${k}:${b}`))];
const COMBO_T = [5, 10, 20, 30, 40, 50];
const COMBO = COMBO_T.flatMap((T) => MA_KEYS.flatMap((k) => BANDS7.map((b) => `rsi<=${T}&${k}:${b}`)));
const CONDS = [...SINGLE, ...COMBO], NC = CONDS.length, CI = Object.fromEntries(CONDS.map((c, i) => [c, i]));
const NSINGLE = SINGLE.length;
const H = HORIZONS, NH = H.length;
// buffers: forward (single: 3 horizons × ep/non; combo: h=20 non only), to-report (all conds)
const fwdBuf = new Map(), repBuf = new Map();
const fkey = (c, s, hi, kind) => ((c * NS + s) * NH + hi) * 2 + kind;
const getB = (m, k) => { let b = m.get(k); if (!b) { b = new Buf(); m.set(k, b); } return b; };

const spyL = loadBars("SPY"), SPY = seriesOf(segment(spyL.bars).bars), spyAt = new Map(SPY.dates.map((d, i) => [d, i]));
const timed = JSON.parse(fs.readFileSync(opt("--export") ?? path.join(here, "data/earnings-export-timed-20260927.json"), "utf8"));
const repBy = new Map(); for (const r of timed) { if (r.eps_actual == null) continue; if (!repBy.has(r.ticker)) repBy.set(r.ticker, []); repBy.get(r.ticker).push(r); }
const names = [...repBy.keys()].filter((t) => !INDEXES.includes(t) && !NOT_STOCKS.includes(t) && (!ONLY || ONLY.includes(t))).sort();
const nameList = [], perName = {}, skipped = [], candByName = [];
let unknownTiming = 0, reportsUsed = 0;

function condsAt(S, i, out) {
  // fills `out` with the condition ids true at bar i (requires the RSI percentile); returns count
  let m = 0; const p = S.pct[i]; if (p == null) return 0;
  out[m++] = CI.any;
  const rsiT = []; for (const T of RSI_LEVELS) if (p <= T) { out[m++] = CI[`rsi<=${T}`]; rsiT.push(T); }
  for (const k of MA_KEYS) {
    const bk = bandOf(S.distPct[k][i]); const at = S.distUd[k][i] != null && Math.abs(S.distUd[k][i]) <= AT_AVERAGE_UD;
    for (const b of [bk, at ? "at" : null]) {
      if (!b) continue;
      out[m++] = CI[`${k}:${b}`];
      for (const T of COMBO_T) if (p <= T) out[m++] = CI[`rsi<=${T}&${k}:${b}`];
    }
  }
  return m;
}
function statesAt(si) {
  // bitmask of market states at SPY bar si
  let m = 1; if (si == null) return m;
  const up = SPY.trend[si], p = SPY.pct[si];
  if (up === true) m |= 2; if (up === false) m |= 4;
  if (p != null) { if (p <= 30) m |= 8; else if (p <= 70) m |= 16; else m |= 32; if (p <= 30 && up === true) m |= 64; if (p <= 30 && up === false) m |= 128; }
  return m;
}

const t0 = Date.now();
const scratch = new Int32Array(256);
for (const t of names) {
  const L = loadBars(t); if (!L || L.bars.length < 400) { skipped.push(t); continue; }
  const S = seriesOf(segment(L.bars).bars), n = S.c.length, ni = nameList.length; nameList.push(t);
  const day = S.dates.map(dayNum);
  const si = S.dates.map((d) => spyAt.get(d) ?? null);
  const st = si.map(statesAt);
  const fw = H.map((h) => forward(S.c, h));
  const sf = H.map((h) => S.c.map((_, i) => (i + h < n && si[i] != null && si[i + h] != null) ? (SPY.c[si[i + h]] / SPY.c[si[i]] - 1) * 100 : null));
  // forward pass: episode / non-overlap state per key
  const lastFire = new Int32Array(NC * NS * NH).fill(-9), lastEntry = new Int32Array(NC * NS * NH).fill(-1e9);
  for (let i = 0; i < n; i++) {
    const m = condsAt(S, i, scratch); if (!m) continue;
    const sm = st[i];
    for (let a = 0; a < m; a++) {
      const c = scratch[a], single = c < NSINGLE;
      for (let s = 0; s < NS; s++) {
        if (!(sm & (1 << s))) continue;
        for (let hi = 0; hi < NH; hi++) {
          if (!single && hi !== 1) continue;
          const k = (c * NS + s) * NH + hi, h = H[hi], ret = fw[hi][i];
          const isEp = lastFire[k] !== i - 1; lastFire[k] = i;
          if (ret == null) continue;
          const exc = sf[hi][i] == null ? null : ret - sf[hi][i];
          if (single && (isEp || c === 0)) getB(fwdBuf, k * 2).push(ret, exc, day[i], ni, i, -1);   // "any": every day, the any-day line
          if (i >= lastEntry[k] + h) { lastEntry[k] = i; getB(fwdBuf, k * 2 + 1).push(ret, exc, day[i], ni, i, -1); }
        }
      }
    }
  }
  // shuffle candidates: forward-20 on usable days, by market state
  const cand = STATES.map(() => []);
  for (let i = 0; i < n; i++) if (S.pct[i] != null && fw[1][i] != null) for (let s = 0; s < NS; s++) if (st[i] & (1 << s)) cand[s].push(fw[1][i]);
  candByName.push(cand.map((a) => Float32Array.from(a)));
  // run to the report (corrected timing)
  const reps = [...repBy.get(t)].sort((a, b) => a.date.localeCompare(b.date));
  const windows = []; const seen = new Set();
  for (const r of reps) {
    if (!r.report_time) { unknownTiming++; continue; }
    const tm = reportTiming(r.report_time), rr = reportSession(S.dates, r.date, tm.rule);
    if (rr == null || rr + 0 >= n || seen.has(rr)) continue;
    const s0 = rr - 21; if (s0 < 0 || S.pct[s0] == null) continue;
    seen.add(rr); windows.push({ date: r.date, s0, e: rr - 1 });
  }
  reportsUsed += windows.length;
  const per = { reports: windows.length, first: windows[0]?.date, last: windows.at(-1)?.date, rep: {}, fwd20: {} };
  windows.forEach((w, wi) => {
    const rank = windows.length - 1 - wi, spyRet = (a) => (si[a] != null && si[w.e] != null) ? (SPY.c[si[w.e]] / SPY.c[si[a]] - 1) * 100 : null;
    const done = new Set();
    for (let i = w.s0; i <= w.s0 + 19; i++) {
      const m = condsAt(S, i, scratch); if (!m) continue;
      const ret = (S.c[w.e] / S.c[i] - 1) * 100, sr = spyRet(i), exc = sr == null ? null : ret - sr;
      for (let a = 0; a < m; a++) {
        const c = scratch[a]; if (done.has(c)) continue;
        if (c === CI.any && i !== w.s0) continue;          // the baseline enters at the window start
        done.add(c);
        for (let s = 0; s < NS; s++) if (st[i] & (1 << s)) getB(repBuf, c * NS + s).push(ret, exc, day[i], ni, i, rank);
        if (c < NSINGLE && (c === CI.any || CONDS[c].startsWith("rsi"))) (per.rep[CONDS[c]] ||= []).push([ret, day[i], exc]);
      }
    }
  });
  // per-name forward-20 episodes for the RSI ladder (any market) — for the name tables
  for (const T of [...RSI_LEVELS, "any"]) {
    const sig = T === "any" ? S.pct.map((p) => p != null) : S.pct.map((p) => p != null && p <= T);
    const { eps } = entries(sig, 20, (i) => fw[1][i] != null);
    per.fwd20[T === "any" ? "any" : `rsi<=${T}`] = T === "any"
      ? (() => { const idx = []; for (let i = 0; i < n; i++) if (sig[i] && fw[1][i] != null) idx.push(i); return { full: summ(idx.map((i) => fw[1][i])), l5: summ(idx.filter((i) => S.dates[i] >= LAST5).map((i) => fw[1][i])) }; })()
      : { full: summ(eps.map((i) => fw[1][i])), l5: summ(eps.filter((i) => S.dates[i] >= LAST5).map((i) => fw[1][i])), c8: consistency(eps.map((i) => fw[1][i])) };
  }
  const repSum = {};
  for (const [k, xs] of Object.entries(per.rep)) {
    const lastDays = new Set(windows.slice(-12).map((w) => day[w.s0]));
    const inLast12 = xs.filter((x) => x[1] >= (windows.at(-12) ? day[windows.at(-12).s0] : -1));
    repSum[k] = { full: summ(xs.map((x) => x[0])), l5: summ(xs.filter((x) => x[1] >= D_LAST5).map((x) => x[0])), last12: summ(inLast12.map((x) => x[0])),
      c8: consistency(xs.map((x) => x[0])), vs_spy_med: r2(spread(xs.map((x) => x[2])).median) };
    void lastDays;
  }
  perName[t] = { reports: per.reports, first: per.first, last: per.last, to_report: repSum, fwd20: per.fwd20 };
}
console.error(`names ${nameList.length} in ${((Date.now() - t0) / 1000).toFixed(0)}s; keys fwd ${fwdBuf.size} rep ${repBuf.size}`);

/* aggregation */
const monthsIn = (b, idx) => new Set(idx.map((j) => monthOf(b.day[j]))).size;
const yearOf = (n) => new Date(n * 864e5).getUTCFullYear();
function yearWins(b) { const m = new Map(); if (!b) return m; for (let j = 0; j < b.n; j++) { const y = yearOf(b.day[j]); const g = m.get(y) || [0, 0]; g[0]++; if (b.ret[j] > 0) g[1]++; m.set(y, g); } return m; }
/* pooled consistency: of the last 8 calendar years with at least 20 entries, in how many did the condition's share up
   beat the any-day line of that same year (same market state, same horizon) */
function yearConsistency(b, all, baseYears) {
  const cond = yearWins({ n: all.length, day: all.map((j) => b.day[j]), ret: all.map((j) => b.ret[j]) });
  const ys = [...cond.keys()].filter((y) => cond.get(y)[0] >= 20 && baseYears?.has(y)).sort().slice(-8);
  const beat = ys.filter((y) => cond.get(y)[1] / cond.get(y)[0] > baseYears.get(y)[1] / baseYears.get(y)[0]).length;
  return { of: ys.length, same: beat, years: ys.map((y) => [y, r1(100 * cond.get(y)[1] / cond.get(y)[0]), r1(100 * baseYears.get(y)[1] / baseYears.get(y)[0])]) };
}
/* each name's own last k entries, pooled */
function lastPerName(b, all, k = 12) { const by = new Map(); for (const j of all) { if (!by.has(b.name[j])) by.set(b.name[j], []); by.get(b.name[j]).push(j); } return [...by.values()].flatMap((xs) => xs.slice(-k)); }
function agg(b, { boot = false, withHalves = false, rep = false, baseYears = null } = {}) {
  if (!b || !b.n) return null;
  const all = Array.from({ length: b.n }, (_, j) => j).sort((x, y) => b.day[x] - b.day[y]);
  const val = (idx) => summ(idx.map((j) => b.ret[j]));
  const exc = (idx) => { const s = spread(idx.map((j) => b.exc[j]).filter((v) => !Number.isNaN(v))); return { med: r2(s.median), beat: r1(s.share_positive) }; };
  const l5 = all.filter((j) => b.day[j] >= D_LAST5);
  const out = { full: val(all), vs_spy: exc(all), l5: val(l5), l5_vs_spy: exc(l5), cy: baseYears ? yearConsistency(b, all, baseYears) : null,
    months: monthsIn(b, all), names: new Set(all.map((j) => b.name[j])).size };
  if (rep) out.last12 = val(all.filter((j) => b.rank[j] < 12)); else out.last12 = val(lastPerName(b, all));
  if (withHalves) {
    const d = all.filter((j) => b.day[j] >= D_DISC0 && b.day[j] < D_CONF), c = all.filter((j) => b.day[j] >= D_CONF);
    out.disc = { ...val(d), months: monthsIn(b, d) }; out.conf = { ...val(c), months: monthsIn(b, c) };
  }
  if (boot) out.ci = clusterBootstrap(all.map((j) => ({ ret: b.ret[j], cluster: monthOf(b.day[j]) }))).ci95;
  return out;
}
function shuffleFor(b, s) {
  if (!b) return null;
  const taken = new Map(); for (let j = 0; j < b.n; j++) taken.set(b.name[j], (taken.get(b.name[j]) || 0) + 1);
  return shuffleBaseline([...taken].map(([ni, k]) => ({ taken: k, candidates: candByName[ni][s] })));
}
const names_fwd = {}, names_rep = {};
for (let c = 0; c < NSINGLE; c++) for (let s = 0; s < NS; s++) {
  for (let hi = 0; hi < NH; hi++) {
    const k = (c * NS + s) * NH + hi, key = `${CONDS[c]}|${STATES[s]}|${H[hi]}`;
    const main = H[hi] === 20, by = yearWins(fwdBuf.get((s * NH + hi) * 2));
    const ep = agg(fwdBuf.get(k * 2), { boot: main, baseYears: by }), non = agg(fwdBuf.get(k * 2 + 1), { withHalves: main, baseYears: by });
    if (!ep && !non) continue;
    names_fwd[key] = { ep, non };
    if (main && CONDS[c] !== "any" && (CONDS[c].startsWith("rsi") || s === 0)) names_fwd[key].shuffle = shuffleFor(fwdBuf.get(k * 2), s);
  }
  const rb = repBuf.get(c * NS + s); if (rb) names_rep[`${CONDS[c]}|${STATES[s]}`] = agg(rb, { rep: true, boot: CONDS[c].startsWith("rsi") || CONDS[c] === "any", baseYears: yearWins(repBuf.get(s)) });
}

/* ================= C · COMBINATIONS (discover 2004–2016, confirm 2017–2026) ================= */
const cand = [];
const baseHalf = { disc: names_fwd[`any|all|20`].non.disc, conf: names_fwd[`any|all|20`].non.conf };
for (let c = 1; c < NC; c++) for (let s = 0; s < NS; s++) {
  const k = (c * NS + s) * NH + 1, b = fwdBuf.get(k * 2 + 1); if (!b) continue;
  const a = c < NSINGLE ? names_fwd[`${CONDS[c]}|${STATES[s]}|20`]?.non : agg(b, { withHalves: true });
  if (!a?.disc || !a?.conf) continue;
  const ok = a.disc.n >= MIN_HALF && a.conf.n >= MIN_HALF && a.disc.months >= MIN_MONTHS && a.conf.months >= MIN_MONTHS;
  if (!ok) continue;
  const ld = a.disc.win - baseHalf.disc.win, lc = a.conf.win - baseHalf.conf.win;
  const medOk = a.disc.med > baseHalf.disc.med && a.conf.med > baseHalf.conf.med;
  cand.push({ cond: CONDS[c], state: STATES[s], c, s, k, disc: a.disc, conf: a.conf, full: a.full, vs_spy: a.vs_spy, lift_disc: r1(ld), lift_conf: r1(lc), score: Math.min(ld, lc), medOk });
}
cand.sort((x, y) => y.score - x.score || y.conf.med - x.conf.med);
const tested = cand.length;
const chosen = [], sig = new Set();
for (const x of cand) {
  if (!x.medOk || x.score <= 0) continue;
  const key = x.cond.includes(":") ? x.cond.split("&").at(-1) : "rsi-only";   // one per average band: nested market states of one stock condition are the same trades
  if (sig.has(key)) continue;
  sig.add(key); chosen.push(x); if (chosen.length === 5) break;
}
// the state alone, for each chosen state (how much the name's own condition adds)
const seriesCache = new Map();
const S_of = (t) => { if (!seriesCache.has(t)) seriesCache.set(t, seriesOf(segment(loadBars(t).bars).bars)); return seriesCache.get(t); };
for (const x of chosen) {
  const b = fwdBuf.get(x.k * 2 + 1);
  x.state_alone = names_fwd[`any|${x.state}|20`]?.non ?? null;
  x.ci = clusterBootstrap(Array.from({ length: b.n }, (_, j) => ({ ret: b.ret[j], cluster: monthOf(b.day[j]) }))).ci95;
  x.ci_conf = clusterBootstrap(Array.from({ length: b.n }, (_, j) => j).filter((j) => b.day[j] >= D_CONF).map((j) => ({ ret: b.ret[j], cluster: monthOf(b.day[j]) }))).ci95;
  x.shuffle = shuffleFor(b, x.s);
  // five trades from the confirm half: the three latest winners and the two latest losers, different names where possible
  const idx = Array.from({ length: b.n }, (_, j) => j).filter((j) => b.day[j] >= D_CONF).sort((p, q) => b.day[q] - b.day[p]);
  const usedN = new Set(), usedM = new Set();
  const pick = (want, k) => { const got = []; for (const j of idx) { const mo = monthOf(b.day[j]); if ((b.ret[j] > 0) !== want || usedN.has(b.name[j]) || usedM.has(mo)) continue; usedN.add(b.name[j]); usedM.add(mo); got.push(j); if (got.length === k) break; } return got; };
  const [maK] = x.cond.split("&").slice(-1)[0].split(":");
  x.trades = [...pick(true, 3), ...pick(false, 2)].sort((p, q) => b.day[p] - b.day[q]).map((j) => {
    const t = nameList[b.name[j]], S = S_of(t), i = b.bar[j], e = i + 20, sa = spyAt.get(S.dates[i]), sb = spyAt.get(S.dates[e]);
    return { ticker: t, entry: S.dates[i], entry_close: r2(S.c[i]), exit: S.dates[e], exit_close: r2(S.c[e]), ret: r2(b.ret[j]),
      rsi: r1(S.rsi[i]), rsi_pct: r1(S.pct[i]), ma: maK, ma_dist_pct: r2(S.dist[maK]?.[i]), ma_dist_ud: r2(S.distUd[maK]?.[i]), ma_own_pct: r1(S.distPct[maK]?.[i]),
      spy_rsi_pct: r1(SPY.pct[sa]), spy_d200: r2(SPY.dist.s200[sa]), spy_ret: sa != null && sb != null ? r2((SPY.c[sb] / SPY.c[sa] - 1) * 100) : null };
  });
  delete x.k;
}
// the same search on the run to the report (for the record; examples are the 20-session version)
const repCand = [];
const repBase = agg(repBuf.get(CI.any * NS), { withHalves: true, rep: true });
for (let c = 1; c < NC; c++) for (let s = 0; s < NS; s++) {
  const b = repBuf.get(c * NS + s); if (!b || b.n < 2 * MIN_HALF) continue;
  const a = agg(b, { withHalves: true, rep: true });
  if (a.disc.n < MIN_HALF || a.conf.n < MIN_HALF || a.disc.months < MIN_MONTHS || a.conf.months < MIN_MONTHS) continue;
  const ld = a.disc.win - repBase.disc.win, lc = a.conf.win - repBase.conf.win;
  repCand.push({ cond: CONDS[c], state: STATES[s], disc: a.disc, conf: a.conf, full: a.full, vs_spy: a.vs_spy, last12: a.last12, lift_disc: r1(ld), lift_conf: r1(lc), score: r1(Math.min(ld, lc)) });
}
repCand.sort((x, y) => y.score - x.score);

/* ================= regime breaks: a name's last 12 reports vs its own history ================= */
const breaks = [];
for (const [t, p] of Object.entries(perName)) {
  const b = p.to_report?.any; if (!b || b.full.n < 40 || b.last12.n < 12) continue;
  const d = b.last12.win - b.full.win;
  if (Math.abs(d) >= 25) breaks.push({ t, full: b.full, last12: b.last12, l5: b.l5, c8: b.c8, diff: r1(d) });
}
breaks.sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff));

/* ================= A · run ================= */
const A = {}; for (const s of INDEXES) { A[s] = indexStudy(s); console.error("index", s); }

const out = {
  built_utc: new Date().toISOString(), study: "S8 · ladder — forward outcomes; descriptive, prior bars only, nothing predicts",
  inputs: { cache_root: ROOT, caches: ["candles-f5 (chart API wrapper, 27 Sep)", "daily-bars-s7 (chart API arrays, 27 Sep)"], reports: "data/earnings-export-timed-20260927.json (step 1)" },
  definitions: fs.readFileSync(path.join(here, "ladder.mjs"), "utf8").split("*/")[0].replace("/*", "").trim(),
  constants: { RSI_LEVELS, HORIZONS, MA_KEYS, MA_LABEL, DIST_BANDS, AT_AVERAGE_UD, EXTENDED_LEVELS, LAST5, DISC, CONF, MIN_HALF, MIN_MONTHS, STATES, STATE_LABEL },
  price_basis: "price only: the chart API serves split-adjusted, not dividend-adjusted bars, so every return here leaves out dividends (about 1.5–2% a year for SPY, less over 20–40 sessions: ≈ 0.1–0.3%)",
  survivorship: "the names are today's universe (the earnings export's tickers that have bars); companies that were delisted, merged or dropped are not in it, so pooled name results describe survivors and lean optimistic",
  indexes: A,
  names: { count: nameList.length, skipped, not_stocks: NOT_STOCKS, reports_used: reportsUsed, reports_unknown_timing_left_out: unknownTiming, fwd: names_fwd, to_report: names_rep, per_name: perName },
  combos: { tested, rule: `forward 20 sessions, non-overlapping trades per name; ≥ ${MIN_HALF} trades and ≥ ${MIN_MONTHS} entry months in BOTH 2004–2016 and 2017–2026; score = the smaller of the two halves' lift in share up over the any-day line of that half; both halves' medians above the any-day median; one per average band (its best market state)`,
    base_halves: baseHalf, chosen, top20: cand.slice(0, 20).map(({ k, ...x }) => x), to_report_top10: repCand.slice(0, 10), to_report_base: repBase },
  regime_breaks: breaks,
};
fs.writeFileSync(OUT, JSON.stringify(out));
console.error("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), "MB", ((Date.now() - t0) / 1000).toFixed(0) + "s");
