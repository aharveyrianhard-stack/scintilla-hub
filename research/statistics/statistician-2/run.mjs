/* STATISTICIAN-2 · the run. node research/statistics/statistician-2/run.mjs [--out <file>] [--cache-root <dir>] [--reps N]
   Reads ONLY the durable local caches (no network, no database, no key):
     ~/Library/Application Support/scintilla/stats-cache/{daily-bars-rsi,daily-bars-s9,candles-f5,daily-bars-s7,regime-20260928,sector-rotation-20260928,leaders-fmp-20260928}
     (chart API daily bars copied by earlier lanes on 27–28 Sep; FMP index/EOD histories pulled inside Fly by the RSI and regime lanes; FMP market caps from the leaders lane)
   and two study outputs already in the repo: deliverables/20260928/bottoms/data/bottoms.json (conditions at every swing low)
   and research/statistics/data/regime-20260928.json (the equal-vs-cap pairs). Writes one JSON for the page. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import * as X from "./lib.mjs";
import { swings, pivotPoints, cleanBars, PIVOT_LEN } from "../s9-research.mjs";
import { rsiWilder, sma } from "../stats.mjs";
import { stationAverages, segment } from "../ladder.mjs";
import { trimAtFaults, topByYear } from "../bottoms/bottoms-lib.mjs";
import { blockLength, effectiveN } from "../method/method-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const args = process.argv.slice(2), opt = (k, d = null) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const LIB = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const OUT = opt("--out", path.join(ROOT, "deliverables/20260928/statistician-2/data/statistician-2.json"));
const REPS = +opt("--reps", 600);
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const { r1, r2, fin, dstr } = X;

/* ================================ loading ================================ */
const DIRS = ["daily-bars-rsi", "daily-bars-s9", "candles-f5", "daily-bars-s7", "regime-20260928/chart", "sector-rotation-20260928"];
const SOURCES = {};
function loadApi(sym) {
  let best = null;
  for (const d of DIRS) { const f = path.join(LIB, d, sym + ".json"); if (!fs.existsSync(f)) continue; let j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    const bars = (j.series ?? j).filter((b) => fin(+b.c) && +b.c > 0); if (!best || bars.length > best.bars.length) best = { bars, src: `chart API cache ${d}/${sym}.json`, basis: j.price_basis ?? null }; }
  return best;
}
let FMPI = null; function loadFmpIndex(sym) { FMPI ??= JSON.parse(fs.readFileSync(path.join(LIB, "daily-bars-rsi/fmp-indexes.json"), "utf8")); const rows = FMPI[sym]; if (!rows?.length) return null; return { bars: rows.map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v })), src: `FMP index history pulled inside Fly (daily-bars-rsi/fmp-indexes.json · ${sym})` }; }
let FMPE = null; function loadFmpEod(sym) {
  FMPE ??= ["fmp-eod.json", "fmp-eod2.json"].flatMap((f) => { const p = path.join(LIB, "regime-20260928", f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : []; });
  const rows = new Map(); for (const e of FMPE) if (e.symbol === sym) for (const r of e.rows || []) rows.set(r[0], r);
  if (!rows.size) return null; const bars = [...rows.values()].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v }));
  return { bars: bars.filter((b) => fin(+b.c) && +b.c > 0), src: `FMP EOD pulled inside Fly by the regime lane (regime-20260928/fmp-eod*.json · ${sym})` };
}
const isWeekend = (b) => [0, 6].includes(new Date(b.t).getUTCDay()) && dstr(b.t) >= "1953-01-01";
/** Everything a study reads, from bars 0..i only. */
function prep(raw, { crypto = false, faults = false, start = null, name = "" } = {}) {
  if (!raw) return null; let bars = raw.bars.map((b) => ({ t: +b.t, o: +(b.o ?? b.c), h: +(b.h ?? b.c), l: +(b.l ?? b.c), c: +b.c, v: +(b.v ?? 0) }));
  if (!crypto) bars = bars.filter((b) => !isWeekend(b)); if (start) bars = bars.filter((b) => dstr(b.t) >= start);
  bars = cleanBars(bars, crypto ? 0.5 : 0.25).bars; bars = segment(bars).bars; let cut = 0;
  if (faults) { const t = trimAtFaults(bars.map((b) => ({ ...b, d: dstr(b.t) }))); bars = t.bars; cut = t.dropped; }
  if (bars.length < 300) return null;
  const c = bars.map((b) => b.c), h = bars.map((b) => b.h), l = bars.map((b) => b.l), dates = bars.map((b) => dstr(b.t));
  const rsi = rsiWilder(c, 14).map((x, i) => (i < 60 ? null : x)), ma = stationAverages(c);
  SOURCES[name || raw.src] = { src: raw.src, from: dates[0], to: dates.at(-1), bars: dates.length, faultCut: cut };
  return { name, dates, c, h, l, rsi, ma, idx: new Map(dates.map((d, i) => [d, i])), byDate: new Map(dates.map((d, i) => [d, c[i]])) };
}
const cache = {};
function inst(sym, o = {}) { if (sym in cache) return cache[sym]; const raw = sym.startsWith("^") ? (loadFmpIndex(sym) || loadFmpEod(sym)) : sym.startsWith("fmp:") ? loadFmpEod(sym.slice(4)) : loadApi(sym); return (cache[sym] = prep(raw, { ...o, name: sym })); }

const bottoms = JSON.parse(fs.readFileSync(path.join(ROOT, "deliverables/20260928/bottoms/data/bottoms.json"), "utf8"));
const regime = JSON.parse(fs.readFileSync(path.join(ROOT, "research/statistics/data/regime-20260928.json"), "utf8"));
const tree = JSON.parse(fs.readFileSync(path.join(ROOT, "data/standard-tree-20260924.json"), "utf8"));
const capNow = new Map(Object.entries(tree.names).map(([s, x]) => [s, x.cap]));   // FMP market cap as of 23 Sep 2026 (today's size — see 'what could be wrong')
const AS_OF = "2026-09-25";

/* ================================ Q1 · RSI floors and ceilings by type ================================ */
log("Q1 RSI by type");
const stockSyms = fs.readdirSync(path.join(LIB, "candles-f5")).map((f) => f.slice(0, -5));
const FUNDS = {
  "Index funds": ["SPY", "QQQ", "IWM", "DIA", "MDY", "RSP", "VTI"], "Indexes (long history)": ["^GSPC", "^NDX", "^RUT", "^DJI", "^IXIC"],
  "Sector funds": ["XLK", "XLE", "XLF", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE", "XLC", "SMH", "SOXX", "GDX", "GDXJ", "COPX"],
  "Foreign funds": ["EEM", "EFA", "FXI", "EWJ", "EWU", "EZU", "MCHI", "ASHR"], "Commodities": ["GLD", "SLV", "USO", "GCUSD", "SIUSD", "CLUSD"], "Crypto": ["BTCUSD"],
  "Bonds": ["TLT", "IEF", "SHY", "HYG", "LQD", "AGG"], "Fear index": ["VIX"],
};
const fundSet = new Set(Object.values(FUNDS).flat());
const capGroup = (sym) => { const m = capNow.get(sym); if (!fin(m)) return null; return m >= 5e11 ? "Mega caps (≥ $500bn today)" : m >= 1e11 ? "Large caps ($100–500bn)" : m >= 1e10 ? "Mid caps ($10–100bn)" : "Small caps (< $10bn)"; };
const GROUPS = { ...FUNDS };
for (const s of stockSyms) { if (fundSet.has(s)) continue; const g = capGroup(s); if (g) (GROUPS[g] ??= []).push(s); }
const q1 = { groups: {}, members: {}, common: "2013-01-01", order: Object.keys(GROUPS) };
for (const [g, syms] of Object.entries(GROUPS)) {
  const full = [], common = [];
  for (const s of syms) { const I = inst(s, { crypto: s === "BTCUSD", faults: !fundSet.has(s), start: s === "BTCUSD" ? "2013-01-01" : null }); if (!I) continue;
    const pf = X.rsiProfile(I.rsi, I.dates); if (!pf) continue; full.push({ sym: s, ...pf });
    const k = I.dates.findIndex((d) => d >= q1.common); if (k >= 0 && I.dates.length - k >= 250) { const pc = X.rsiProfile(I.rsi.slice(k), I.dates.slice(k)); if (pc) common.push({ sym: s, ...pc }); } }
  const summ = (list) => ({ n: list.length, members: list.map((p) => p.sym),
    floors: X.FLOOR_LEVELS.map((L, i) => ({ L, days: X.groupOf(list, (p) => p.floors[i].days), perYear: X.groupOf(list, (p) => p.floors[i].perYear), len: X.groupOf(list, (p) => p.floors[i].len) })),
    ceilings: X.CEILING_LEVELS.map((L, i) => ({ L, days: X.groupOf(list, (p) => p.ceilings[i].days), perYear: X.groupOf(list, (p) => p.ceilings[i].perYear) })),
    ladder: Object.fromEntries(X.RSI_LADDER.map((p) => [p, X.groupOf(list, (x) => x.ladder[p])])) });
  q1.groups[g] = { full: summ(full), common: summ(common) };
  q1.members[g] = full.map((p) => ({ sym: p.sym, from: p.from, to: p.to, n: p.n, p1: r1(p.ladder[1]), p5: r1(p.ladder[5]), p50: r1(p.ladder[50]), p95: r1(p.ladder[95]), p99: r1(p.ladder[99]), d28: r2(p.floors.find((f) => f.L === 28).days), d30: r2(p.floors.find((f) => f.L === 30).days), y28: r2(p.floors.find((f) => f.L === 28).perYear), d70: r2(p.ceilings.find((f) => f.L === 70).days), min: r1(p.min), max: r1(p.max) }));
}
// 1% floor per type, and the level each type must reach to be as rare as SPY's RSI 28
{ const spy = q1.members["Index funds"].find((m) => m.sym === "SPY"); q1.spy28 = spy?.d28 ?? null; }

/* ================================ shared: SPY family swings and waits ================================ */
log("swings");
const IDX = { SPY: inst("SPY"), QQQ: inst("QQQ"), IWM: inst("IWM") };
const US10Y = inst("US10Y"), DXY = inst("DXY"), VIX = inst("VIX"), PCC = inst("PCC"), VIX3M = inst("^VIX3M");
const avg200Flag = (I) => { const a = sma(I.c, 200); return new Map(I.dates.map((d, i) => [d, a[i] != null ? I.c[i] > a[i] : null])); };
const yUp = avg200Flag(US10Y), dUp = avg200Flag(DXY);
const lastOnOrBefore = (map, dates, d) => { let v = null; for (let k = dates.length - 1; k >= 0; k--) if (dates[k] <= d) { v = map.get(dates[k]); break; } return v; };
/** All swing highs→lows of an instrument with the wait to a new high (censored when still waiting). */
function waits(I) {
  const sw = swings(I.h, I.l, PIVOT_LEN), out = [];
  for (let i = 0; i + 1 < sw.length; i++) { const a = sw[i], b = sw[i + 1]; if (a.type !== "H" || b.type !== "L") continue;
    const k = X.firstAbove(I.h, b.k + 1, a.price); const depth = 100 * (b.price / a.price - 1);
    out.push({ top: I.dates[a.k], low: I.dates[b.k], kTop: a.k, kLow: b.k, topPrice: a.price, depth, fallBars: b.k - a.k, t: k < 0 ? I.dates.length - 1 - b.k : k - b.k, ev: k >= 0 }); }
  return out;
}
const WAITS = Object.fromEntries(Object.entries(IDX).map(([s, I]) => [s, waits(I)]));

/* ================================ Q2 · which conditions gave a faster new high ================================ */
log("Q2 conditions → wait");
const CONDS = [
  ["vixPct", "VIX own percentile at the low", "outside"], ["vixTurnBefore", "VIX peaked before or on the low (1) vs after / none (0)", "outside"], ["ratioPct", "VIX ÷ VIX3M own percentile", "outside"],
  ["pccPct", "Total put/call own percentile", "outside"], ["pccTurnBefore", "Put/call peaked before or on the low (1) vs after / none (0)", "outside"], ["pccePct", "Equity put/call own percentile", "outside"],
  ["creditDecline", "Credit (HYG÷LQD) decline into the low, %", "outside"], ["a50", "Share of names above their 50-day at the low, %", "price"],
  ["lineRank", "Cloud line reached: 13-EMA=1, 21-EMA=2, 50-day=3, 200-day=4", "price"], ["rsiPct", "RSI own percentile at the low", "price"], ["d200", "Distance to the 200-day at the low, %", "price"],
  ["fallBars", "Sessions from the top to the low", "price"], ["volPct", "Volume vs its 50-day, own percentile", "price"], ["yieldUp", "10-year yield above its 200-day (1) or below (0)", "outside"], ["dollarUp", "Dollar above its 200-day (1) or below (0)", "outside"],
  ["yieldChg63", "10-year yield change over the 63 sessions into the low, bp", "outside"],
];
const LINE = { e13: 1, e21: 2, s50: 3, s200: 4, none: 0 };
function condRows(sym) {
  const I = IDX[sym], L = bottoms.part1[sym].lows, byLow = new Map(WAITS[sym].map((w) => [w.low, w])), rows = [];
  for (const r of L) { const w = byLow.get(r.date); if (!w || !fin(r.depth)) continue;
    const yk = US10Y.idx.get(r.date), y63 = yk != null && yk >= 63 ? 100 * (US10Y.c[yk] - US10Y.c[yk - 63]) : null;
    rows.push({ sym, low: r.date, depth: r.depth, t: w.t, ev: w.ev, logT: Math.log(1 + w.t), vixPct: r.vixPct, vixTurnBefore: r.vixTurn == null ? null : r.vixTurn <= 0 ? 1 : 0, ratioPct: r.ratioPct, pccPct: r.pccPct, pccTurnBefore: r.pccTurn == null ? null : r.pccTurn <= 0 ? 1 : 0,
      pccePct: r.pccePct, creditDecline: r.creditDecline, a50: r.a50, lineRank: LINE[r.line] ?? null, rsiPct: r.rsiPct, d200: r.d200, fallBars: w.fallBars, volPct: r.volPct,
      yieldUp: (() => { const v = lastOnOrBefore(yUp, US10Y.dates, r.date); return v == null ? null : v ? 1 : 0; })(), dollarUp: (() => { const v = lastOnOrBefore(dUp, DXY.dates, r.date); return v == null ? null : v ? 1 : 0; })(), yieldChg63: y63 }); }
  return rows;
}
const q2 = { conds: CONDS, per: {}, pooled: null, km: {}, depth: {} };
const ALLROWS = ["SPY", "QQQ", "IWM"].flatMap(condRows);
function condStudy(rows, label) {
  const done = rows.filter((r) => r.ev), out = { label, n: rows.length, censored: rows.length - done.length, rows: [] };
  // base: the wait by depth alone
  out.depthLink = X.episodeBootstrap(done, (rs) => X.spearman(rs.map((r) => -r.depth), rs.map((r) => r.logT)), { reps: REPS, seed: 3 });
  const pv = [];
  for (const [k, text, kind] of CONDS) { const rs = done.filter((r) => fin(r[k])); if (rs.length < 12) { out.rows.push({ k, text, kind, n: rs.length, status: "a list" }); pv.push(null); continue; }
    const b = X.episodeBootstrap(rs, (s) => X.partialSpearman(s.map((r) => r[k]), s.map((r) => r.logT), s.map((r) => -r.depth)), { reps: REPS, seed: 11 });
    // plain-words effect: median wait for the top third vs bottom third of the condition AFTER depth is taken out (rank residual of the wait on depth)
    const res = X.rankResidual(rs.map((r) => r.logT), rs.map((r) => -r.depth)), vals = rs.map((r) => r[k]), srt = [...vals].sort((a, b) => a - b), lo = X.quantile(srt, 1 / 3), hi = X.quantile(srt, 2 / 3);
    const top = rs.filter((r, i) => vals[i] >= hi), bot = rs.filter((r, i) => vals[i] <= lo);
    const medT = (g) => X.median(g.map((r) => r.t));
    out.rows.push({ k, text, kind, n: rs.length, rho: b ? r2(b.est) : null, lo: b ? r2(b.lo) : null, hi: b ? r2(b.hi) : null, p: b ? r2(b.p) : null, plain: X.spearman(vals, rs.map((r) => r.logT)) != null ? r2(X.spearman(vals, rs.map((r) => r.logT))) : null,
      topN: top.length, topMed: medT(top), botN: bot.length, botMed: medT(bot), topDepth: r1(X.median(top.map((r) => r.depth))), botDepth: r1(X.median(bot.map((r) => r.depth))), cutLo: r2(lo), cutHi: r2(hi), resTop: r1(X.median(top.map((r) => res[rs.indexOf(r)]))), resBot: r1(X.median(bot.map((r) => res[rs.indexOf(r)]))) });
    pv.push(b ? b.p : null); }
  const bh = X.benjaminiHochberg(pv.map((p) => p ?? 1), 0.1);
  out.rows.forEach((r, i) => { if (pv[i] != null) { r.pAdj = r2(bh.adjusted[i]); r.status = X.statusWord(r.n, pv[i], bh.adjusted[i]); } });
  out.tests = pv.filter((p) => p != null).length; return out;
}
for (const s of ["SPY", "QQQ", "IWM"]) q2.per[s] = condStudy(condRows(s), s);
q2.pooled = condStudy(ALLROWS, "SPY + QQQ + IWM pooled");
// survival curves for the four conditions Alan named, within the 3–10% depth band (depth held roughly fixed)
const band = ALLROWS.filter((r) => r.depth <= -3 && r.depth > -10);
const kmPair = (key, name, split) => { const a = band.filter((r) => fin(r[key]) && split(r[key])), b = band.filter((r) => fin(r[key]) && !split(r[key])); return { key, name, yes: X.kaplanMeier(a), no: X.kaplanMeier(b), yesDepth: r1(X.median(a.map((r) => r.depth))), noDepth: r1(X.median(b.map((r) => r.depth))) }; };
q2.km = { band: "falls of 3–10%", n: band.length, pairs: [kmPair("vixTurnBefore", "VIX peaked before / on the low", (v) => v === 1), kmPair("pccTurnBefore", "put/call peaked before / on the low", (v) => v === 1), kmPair("a50", "fewer than a quarter of names above their 50-day", (v) => v < 25), kmPair("lineRank", "the fall reached the 50-day or the 200-day", (v) => v >= 3), kmPair("yieldUp", "10-year yield above its 200-day", (v) => v === 1), kmPair("rsiPct", "RSI in its bottom 10% of history", (v) => v <= 10)] };
// the base fact: wait by depth (Kaplan–Meier by equal-count depth bins), all three pooled
{ const { bin, edges } = X.equalBins(ALLROWS.map((r) => -r.depth), 5); q2.depth = { bins: edges.map((e, j) => ({ from: r1(e[0]), to: r1(e[1]), ...(() => { const k = X.kaplanMeier(ALLROWS.filter((r, i) => bin[i] === j)); return { n: k.n, censored: k.censored, median: k.median, steps: k.steps }; })() })) }; }

/* ================================ Q3 · put/call before the not-so-deep lows; time frame; levels ================================ */
log("Q3 put/call");
const q3 = { byDepth: {}, frames: [], levels: null, pcceByDepth: {} };
for (const s of ["SPY", "QQQ", "IWM"]) {
  const L = bottoms.part1[s].lows.filter((r) => fin(r.depth) && r.pccTurn !== undefined && r.has?.pcc);
  const { bin, edges } = X.equalBins(L.map((r) => -r.depth), 4);
  const cell = (rs, key) => { const w = rs.filter((r) => r[key] != null); const before = w.filter((r) => r[key] <= 0); const b = X.episodeBootstrap(w, (g) => 100 * g.filter((r) => r[key] <= 0).length / g.length, { reps: REPS, seed: 5, base: 50 }); return { n: rs.length, withTurn: w.length, before: before.length, share: w.length ? r1(100 * before.length / w.length) : null, lo: b ? r1(b.lo) : null, hi: b ? r1(b.hi) : null, lead: X.median(before.map((r) => -r[key])), leadHi: X.quantile(before.map((r) => -r[key]).sort((a, b) => a - b), 0.9) }; };
  const bins3 = edges.map((e, j) => { const rs = L.filter((r, i) => bin[i] === j); return { from: r1(e[0]), to: r1(e[1]), pcc: cell(rs, "pccTurn"), pcce: cell(rs, "pcceTurn"), pccPctMed: r1(X.median(rs.map((r) => r.pccPct))), pcceLevel: r2(X.median(rs.map((r) => r.pcce))), pccLevel: r2(X.median(rs.map((r) => r.pcc))) }; });
  q3.byDepth[s] = { bins: bins3, n: L.length, all: cell(L, "pccTurn"), allE: cell(L, "pcceTurn"), deep: cell(L.filter((r) => r.depth <= -10), "pccTurn"), deepE: cell(L.filter((r) => r.depth <= -10), "pcceTurn"), shallow: cell(L.filter((r) => r.depth > -10), "pccTurn"), shallowE: cell(L.filter((r) => r.depth > -10), "pcceTurn") };
}
// time frame: peaks of the put/call smoothed over k sessions → is a confirmed SPY swing low within [-5, +15] bars?
{
  const S = IDX.SPY, P = PCC, pmap = P.byDate, pc = S.dates.map((d) => pmap.get(d) ?? null);   // aligned to SPY sessions
  const lows = new Set(WAITS.SPY.map((w) => w.kLow)); const lowKs = [...lows].sort((a, b) => a - b);
  const nearLow = (k, a = -5, b = 15) => { for (const lk of lowKs) if (lk >= k + a && lk <= k + b) return lk - k; return null; };
  const first = pc.findIndex((x) => x != null), anyDays = []; for (let k = first; k < S.dates.length - 15; k++) anyDays.push(nearLow(k) != null ? 1 : 0);
  const base = 100 * anyDays.reduce((s, x) => s + x, 0) / anyDays.length;
  for (const k of [1, 3, 5, 10, 21]) {
    const sm = k === 1 ? pc : pc.map((x, i) => { if (i < k - 1) return null; let t = 0; for (let j = i - k + 1; j <= i; j++) { if (pc[j] == null) return null; t += pc[j]; } return t / k; });
    const peaks = pivotPoints(sm.map((x) => x ?? -Infinity), sm.map((x) => x ?? Infinity), PIVOT_LEN).filter((p) => p.type === "H" && fin(sm[p.k]));
    const own = X.ownPct(sm), rows = peaks.map((p) => ({ k: p.k, d: S.dates[p.k], v: sm[p.k], pct: own[p.k], lead: nearLow(p.k) })).filter((r) => r.k < S.dates.length - 15);
    const hit = rows.filter((r) => r.lead != null); const b = X.blockBootstrap(rows, (g) => 100 * g.filter((r) => r.lead != null).length / g.length, { reps: REPS, seed: 9, block: 5, base });
    const yrs = (Date.parse(S.dates.at(-1)) - Date.parse(S.dates[first])) / (365.25 * 864e5);
    q3.frames.push({ k, peaks: rows.length, perYear: r1(rows.length / yrs), hit: r1(100 * hit.length / rows.length), lo: b ? r1(b.lo) : null, hi: b ? r1(b.hi) : null, p: b ? r2(b.p) : null, base: r1(base), lead: X.median(hit.map((r) => r.lead)), leadIqr: [X.quantile(hit.map((r) => r.lead).sort((a, b) => a - b), 0.25), X.quantile(hit.map((r) => r.lead).sort((a, b) => a - b), 0.75)], lowsCaught: r1(100 * new Set(hit.map((r) => r.k + r.lead)).size / lowKs.filter((lk) => lk >= first + 15).length),
      byPct: [50, 60, 70, 80, 90, 95, 99].map((th) => { const g = rows.filter((r) => fin(r.pct) && r.pct >= th); return { th, n: g.length, hit: g.length ? r1(100 * g.filter((r) => r.lead != null).length / g.length) : null, level: g.length ? r2(X.median(g.map((r) => r.v))) : null }; }) });
  }
  // levels: raw PCC → own percentile today, and what share of days at/over each level had a low within 15 bars
  const own = X.ownPct(pc), levelRows = [];
  for (const lv of [0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4]) { const ks = []; for (let k = first; k < S.dates.length - 15; k++) if (pc[k] != null && pc[k] >= lv) ks.push(k); const eps = X.runsOf(S.dates.map((d, k) => k >= first && k < S.dates.length - 15 && pc[k] != null && pc[k] >= lv)); const epHit = eps.filter((e) => { for (let k = e.s; k <= e.e; k++) if (nearLow(k, 0, 15) != null) return true; return false; }).length; levelRows.push({ level: lv, days: ks.length, pct: r1(X.median(ks.map((k) => own[k]).filter(fin))), episodes: eps.length, epHit: eps.length ? r1(100 * epHit / eps.length) : null, dayHit: ks.length ? r1(100 * ks.filter((k) => nearLow(k, 0, 15) != null).length / ks.length) : null }); }
  const last = pc.length - 1; q3.levels = { rows: levelRows, base: r1(base), today: { d: S.dates.at(-1), pcc: pc[last], pct: r1(own[last]) }, from: S.dates[first], pctTable: [50, 75, 90, 95, 99].map((p) => ({ p, level: r2(X.quantile(pc.filter(fin).sort((a, b) => a - b), p / 100)) })) };
}

/* ================================ Q4 · the 200-day, richer ================================ */
log("Q4 200-day");
const Q4SYMS = ["^GSPC", "^NDX", "^RUT", "^DJI", "SPY", "QQQ", "IWM", "DIA", "MDY", "XLK", "XLE", "XLF", "XLV", "XLI", "XLP", "XLY", "XLU", "XLB", "EFA", "EEM", "GLD", "USO", "TLT", "BTCUSD"];
const q4 = { syms: [], states: null, timeBelow: null, grid: null, breaks: null, base: null, tests: 0 };
const dayRows = [];
for (const s of Q4SYMS) {
  const I = inst(s, { crypto: s === "BTCUSD", start: s === "BTCUSD" ? "2013-01-01" : null }); if (!I) continue; q4.syms.push({ sym: s, from: I.dates[0], to: I.dates.at(-1) });
  const s200 = I.ma.s200, s50 = I.ma.s50, slope = X.slopePct(s200, 20), below = I.c.map((c, i) => s200[i] != null ? c < s200[i] : null), run = X.runLengths(below.map((b) => b === true)), abv = X.runLengths(below.map((b) => b === false));
  // first break: the first close below after at least 63 sessions above; repeated: a break within 63 sessions of the previous below-stretch
  for (let i = 200; i < I.c.length; i++) { if (below[i] == null || slope[i] == null) continue;
    const dep = 100 * (I.c[i] / s200[i] - 1), f63 = X.fwdReturn(I.c, i, 63), f126 = X.fwdReturn(I.c, i, 126), dd126 = X.fwdMaxDrawdown(I.c, i, 126);
    const brk = below[i] && run[i] === 1 ? (abv[i - 1] >= 63 ? "first" : "repeated") : null;
    dayRows.push({ sym: s, d: I.dates[i], side: below[i] ? "below" : "above", slopeUp: slope[i] >= 0, order: s50[i] != null && s50[i] >= s200[i], dep, run: run[i], f63, f126, dd126, brk }); }
}
const cellStat = (rows, key, seed) => { const g = rows.filter((r) => fin(r[key])); if (g.length < 60) return { n: g.length }; const eps = new Set(g.map((r) => r.sym + ":" + r.d.slice(0, 4))).size;
  const med = X.blockBootstrap(g, (rs) => X.median(rs.map((r) => r[key])), { reps: Math.min(REPS, 300), seed, block: key === "f63" ? 63 : 126, base: q4.base ? q4.base[key].med : 0 }), up = X.blockBootstrap(g, (rs) => 100 * X.share(rs.map((r) => r[key])), { reps: Math.min(REPS, 300), seed: seed + 1, block: key === "f63" ? 63 : 126, base: q4.base ? q4.base[key].up : 50 });
  return { n: g.length, instYears: eps, med: r2(med.est), medLo: r2(med.lo), medHi: r2(med.hi), pMed: r2(med.p), up: r1(up.est), upLo: r1(up.lo), upHi: r1(up.hi), pUp: r2(up.p), p10: r2(X.quantile(g.map((r) => r[key]).sort((a, b) => a - b), 0.1)), p90: r2(X.quantile(g.map((r) => r[key]).sort((a, b) => a - b), 0.9)) }; };
q4.base = { f63: cellStat(dayRows, "f63", 21), f126: cellStat(dayRows, "f126", 23), dd126: cellStat(dayRows, "dd126", 25) };
const allP = [];
const withP = (o) => { for (const k of ["pMed", "pUp"]) if (fin(o[k])) allP.push({ o, k, p: o[k] }); return o; };
q4.states = [];
for (const side of ["above", "below"]) for (const slopeUp of [true, false]) for (const order of [true, false]) { const rs = dayRows.filter((r) => r.side === side && r.slopeUp === slopeUp && r.order === order); const c = { side, slopeUp, order, f63: withP(cellStat(rs, "f63", 31)), f126: withP(cellStat(rs, "f126", 33)), dd126: withP(cellStat(rs, "dd126", 35)), share: r1(100 * rs.length / dayRows.length) }; q4.states.push(c); }
const RUNBINS = [[1, 5], [6, 20], [21, 63], [64, 126], [127, 252], [253, 100000]];
q4.timeBelow = RUNBINS.map(([a, b]) => { const rs = dayRows.filter((r) => r.side === "below" && r.run >= a && r.run <= b); return { from: a, to: b, f63: withP(cellStat(rs, "f63", 41)), f126: withP(cellStat(rs, "f126", 43)), dd126: withP(cellStat(rs, "dd126", 45)) }; });
const DEP = [[0, 2], [2, 5], [5, 10], [10, 20], [20, 100]], DUR = [[1, 20], [21, 63], [64, 252], [253, 100000]];
q4.grid = DEP.map(([a, b]) => ({ dep: [a, b], cells: DUR.map(([c, d]) => { const rs = dayRows.filter((r) => r.side === "below" && -r.dep >= a && -r.dep < b && r.run >= c && r.run <= d); const g = rs.filter((r) => fin(r.dd126)); return { dur: [c, d], n: rs.length, instYears: new Set(rs.map((r) => r.sym + ":" + r.d.slice(0, 4))).size, medF126: r1(X.median(rs.map((r) => r.f126))), shareDD10: g.length ? r1(100 * g.filter((r) => r.dd126 <= -10).length / g.length) : null, medDD: r1(X.median(g.map((r) => r.dd126))) }; }) }));
q4.baseDD10 = r1(100 * dayRows.filter((r) => fin(r.dd126) && r.dd126 <= -10).length / dayRows.filter((r) => fin(r.dd126)).length);
q4.breaks = ["first", "repeated"].map((b) => { const rs = dayRows.filter((r) => r.brk === b); return { kind: b, n: rs.length, f63: withP(cellStat(rs, "f63", 51)), f126: withP(cellStat(rs, "f126", 53)), dd126: withP(cellStat(rs, "dd126", 55)), shareDD10: r1(100 * rs.filter((r) => fin(r.dd126) && r.dd126 <= -10).length / rs.filter((r) => fin(r.dd126)).length) }; });
{ const bh = X.benjaminiHochberg(allP.map((x) => x.p), 0.1); allP.forEach((x, i) => { x.o[x.k + "Adj"] = r2(bh.adjusted[i]); x.o[x.k + "Survives"] = bh.reject[i]; }); q4.tests = allP.length; q4.survivors = bh.reject.filter(Boolean).length; }
q4.today = Object.fromEntries(["SPY", "QQQ", "IWM", "^GSPC"].map((s) => { const rs = dayRows.filter((r) => r.sym === s); const r = rs.at(-1); return [s, r ? { d: r.d, side: r.side, slopeUp: r.slopeUp, order: r.order, dep: r1(r.dep), run: r.run } : null]; }));

/* ================================ leaders: each year's top 20 at the time ================================ */
log("leaders");
const CAPDIR = path.join(LIB, "leaders-fmp-20260928/caps"), capHist = {};
for (const f of fs.readdirSync(CAPDIR)) if (f.endsWith(".json")) capHist[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(CAPDIR, f), "utf8")).sort((a, b) => a.date < b.date ? -1 : 1);
const YEARS = Array.from({ length: 2026 - 2007 + 1 }, (_, i) => 2007 + i), pitTop = topByYear(capHist, YEARS, 20);
const leaderSyms = [...new Set(Object.values(pitTop).flat())];
const patch = path.join(LIB, "leaders-fmp-20260928/bars-patch/META-pre-20220609.json");
const LEAD = {};
for (const s of leaderSyms) { let raw = loadApi(s); if (!raw) continue;
  if (s === "META" && fs.existsSync(patch)) { const P = JSON.parse(fs.readFileSync(patch, "utf8")); const rows = (P.series ?? P.bars ?? P).map((b) => (b.t != null ? b : { t: Date.parse(b.date + "T00:00:00Z"), o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })); raw = { bars: [...rows.filter((b) => dstr(b.t) < "2022-06-09"), ...raw.bars.filter((b) => dstr(b.t) >= "2022-06-09")], src: raw.src + " + FMP FB-era patch" }; }
  const I = prep(raw, { faults: true, name: s }); if (I) LEAD[s] = I; }
const leaderCloses = Object.fromEntries(Object.entries(LEAD).map(([s, I]) => [s, I.byDate]));
const SPYd = IDX.SPY.dates.filter((d) => d >= "2007-01-01");
const basket = X.basketReturns(SPYd, pitTop, leaderCloses), basketLevel = X.chain(basket.map((b) => b.ret));
const BASK = { dates: SPYd, c: basketLevel, idx: new Map(SPYd.map((d, i) => [d, i])) };

/* ================================ Q5 · leaders across fear and greed ================================ */
log("Q5 leaders vs fear/greed");
const q5 = { lows: null, highs: null, gauge: null, leaders: { years: pitTop, loaded: Object.keys(LEAD).length, of: leaderSyms.length } };
{
  const S = IDX.SPY, sw = WAITS.SPY.filter((w) => w.depth <= -3 && w.low >= "2007-01-01"), rows = [], topRows = [];
  const lp = {}; for (const [s, I] of Object.entries(LEAD)) lp[s] = { sw: swings(I.h, I.l, PIVOT_LEN), I };
  for (const w of sw) { const y = +w.low.slice(0, 4), tLow = Date.parse(w.low), tTop = Date.parse(w.top), spyRun = w.kLow > 0 ? null : null;
    for (const s of pitTop[y] || []) { const L = lp[s]; if (!L) continue; const I = L.I; const kl = I.idx.get(w.low), kt = I.idx.get(w.top); if (kl == null || kt == null) continue;
      // the leader's own swing low nearest the SPY low, within ±15 sessions
      let best = null; for (const p of L.sw) if (p.type === "L" && Math.abs(p.k - kl) <= 15) if (!best || Math.abs(p.k - kl) < Math.abs(best.k - kl)) best = p;
      // its drawdown over the same stretch: min close between SPY's top and 15 sessions after SPY's low, vs its close at SPY's top
      let m = I.c[kt]; for (let k = kt; k <= Math.min(I.c.length - 1, kl + 15); k++) if (I.c[k] < m) m = I.c[k];
      const own = 100 * (m / I.c[kt] - 1);
      // after the low: 63-session return of the leader vs SPY from the SPY low
      const fl = X.fwdReturn(I.c, kl, 63), fs63 = X.fwdReturn(S.c, w.kLow, 63);
      rows.push({ low: w.low, depth: w.depth, sym: s, offset: best ? best.k - kl : null, own: own, ratio: w.depth < 0 ? own / w.depth : null, f63: fl, spy63: fs63, rel63: fin(fl) && fin(fs63) ? fl - fs63 : null }); }
    // at the SPY top that began the fall: the leader's own swing high offset and how much of its run it gave back
    for (const s of pitTop[+w.top.slice(0, 4)] || []) { const L = lp[s]; if (!L) continue; const I = L.I, kt = I.idx.get(w.top), kl = I.idx.get(w.low); if (kt == null || kl == null) continue;
      let best = null; for (const p of L.sw) if (p.type === "H" && Math.abs(p.k - kt) <= 15) if (!best || Math.abs(p.k - kt) < Math.abs(best.k - kt)) best = p;
      // its run into the top: from its lowest close in the 63 sessions before the top; give-back = fall from top to its low over the SPY fall ÷ that run
      let lo = I.c[kt]; for (let k = Math.max(0, kt - 63); k < kt; k++) if (I.c[k] < lo) lo = I.c[k]; let m = I.c[kt]; for (let k = kt; k <= Math.min(I.c.length - 1, kl + 15); k++) if (I.c[k] < m) m = I.c[k];
      const run = 100 * (I.c[kt] / lo - 1), fall = 100 * (I.c[kt] / m - 1); topRows.push({ top: w.top, depth: w.depth, sym: s, offset: best ? best.k - kt : null, run, fall, giveBack: run > 0 ? 100 * fall / run : null }); } }
  const byLow = (rs, key) => { const m = new Map(); for (const r of rs) if (fin(r[key])) (m.get(r.low ?? r.top) ?? m.set(r.low ?? r.top, []).get(r.low ?? r.top)).push(r[key]); return [...m.entries()].map(([d, v]) => ({ d, v })); };
  const epi = (rs, key, stat, base = 0) => { const eps = byLow(rs, key); return { eps: eps.length, ...(X.episodeBootstrap(eps, (g) => stat(g.flatMap((e) => e.v)), { reps: REPS, seed: 61, base }) || {}) }; };
  const off = rows.filter((r) => r.offset != null);
  q5.lows = { n: rows.length, episodes: new Set(rows.map((r) => r.low)).size, withOwnLow: off.length, before: r1(100 * off.filter((r) => r.offset < 0).length / off.length), same: r1(100 * off.filter((r) => r.offset === 0).length / off.length), after: r1(100 * off.filter((r) => r.offset > 0).length / off.length), noOwnLow: r1(100 * (rows.length - off.length) / rows.length),
    offsetHist: Array.from({ length: 31 }, (_, i) => i - 15).map((o) => ({ o, n: off.filter((r) => r.offset === o).length })), offsetMed: X.median(off.map((r) => r.offset)),
    ratio: epi(rows, "ratio", (v) => X.median(v), 1), ratioDist: X.dist(rows.map((r) => r.ratio)), rel63: epi(rows, "rel63", (v) => X.median(v), 0), rel63Up: epi(rows, "rel63", (v) => 100 * X.share(v), 50),
    byDepth: (() => { const { bin, edges } = X.equalBins(rows.map((r) => -r.depth), 4); return edges.map((e, j) => { const g = rows.filter((r, i) => bin[i] === j); const go = g.filter((r) => r.offset != null); return { from: r1(e[0]), to: r1(e[1]), n: g.length, eps: new Set(g.map((r) => r.low)).size, before: go.length ? r1(100 * go.filter((r) => r.offset < 0).length / go.length) : null, after: go.length ? r1(100 * go.filter((r) => r.offset > 0).length / go.length) : null, ratio: r2(X.median(g.map((r) => r.ratio))), own: r1(X.median(g.map((r) => r.own))), rel63: r1(X.median(g.map((r) => r.rel63))) }; }); })() };
  const toff = topRows.filter((r) => r.offset != null);
  q5.highs = { n: topRows.length, episodes: new Set(topRows.map((r) => r.top)).size, before: r1(100 * toff.filter((r) => r.offset < 0).length / toff.length), same: r1(100 * toff.filter((r) => r.offset === 0).length / toff.length), after: r1(100 * toff.filter((r) => r.offset > 0).length / toff.length), offsetMed: X.median(toff.map((r) => r.offset)),
    giveBack: epi(topRows, "giveBack", (v) => X.median(v), 100), giveBackDist: X.dist(topRows.map((r) => r.giveBack)), fallDist: X.dist(topRows.map((r) => r.fall)), spyDepth: X.dist(sw.map((w) => -w.depth)) };
  // the fear/greed gauge: mean of four own-percentiles (VIX up, put/call up, RSI down, breadth down) → 100 = maximum fear
  const f5 = stockSyms.filter((s) => !fundSet.has(s)); const a50 = new Map(); { const cnt = new Map(), up = new Map(); for (const s of f5) { const I = inst(s, { faults: true }); if (!I) continue; const m50 = I.ma.s50; for (let i = 0; i < I.c.length; i++) { if (m50[i] == null) continue; const d = I.dates[i]; cnt.set(d, (cnt.get(d) || 0) + 1); if (I.c[i] > m50[i]) up.set(d, (up.get(d) || 0) + 1); } } for (const [d, n] of cnt) if (n >= 50) a50.set(d, 100 * (up.get(d) || 0) / n); }
  const vixP = X.ownPct(S.dates.map((d) => VIX.byDate.get(d) ?? null)), pccP = X.ownPct(S.dates.map((d) => PCC.byDate.get(d) ?? null)), rsiP = X.ownPct(S.rsi), brP = X.ownPct(S.dates.map((d) => a50.get(d) ?? null));
  const gauge = S.dates.map((d, i) => { const parts = [vixP[i], pccP[i], rsiP[i] == null ? null : 100 - rsiP[i], brP[i] == null ? null : 100 - brP[i]]; return parts.every(fin) ? parts.reduce((s, x) => s + x, 0) / 4 : null; });
  const grows = []; for (let i = 0; i < S.dates.length; i++) { if (gauge[i] == null) continue; const bi = BASK.idx.get(S.dates[i]); if (bi == null) continue; const fb = X.fwdReturn(BASK.c, bi, 63), fsp = X.fwdReturn(S.c, i, 63), ddb = X.fwdMaxDrawdown(BASK.c, bi, 63), dds = X.fwdMaxDrawdown(S.c, i, 63); grows.push({ d: S.dates[i], g: gauge[i], fb, fsp, rel: fin(fb) && fin(fsp) ? fb - fsp : null, ddb, dds }); }
  const dec = Array.from({ length: 10 }, (_, j) => [j * 10, (j + 1) * 10]);
  const gp = [];
  q5.gauge = { from: grows[0]?.d, to: grows.at(-1)?.d, n: grows.length, today: { d: S.dates.at(-1), g: r1(gauge.at(-1)), vix: r1(vixP.at(-1)), pcc: r1(pccP.at(-1)), rsi: r1(rsiP.at(-1) == null ? null : 100 - rsiP.at(-1)), breadth: r1(brP.at(-1) == null ? null : 100 - brP.at(-1)) },
    base: { rel: r2(X.median(grows.map((r) => r.rel))), fb: r2(X.median(grows.map((r) => r.fb))), fsp: r2(X.median(grows.map((r) => r.fsp))), ddb: r2(X.median(grows.map((r) => r.ddb))), dds: r2(X.median(grows.map((r) => r.dds))) },
    deciles: dec.map(([a, b]) => { const g = grows.filter((r) => r.g >= a && r.g < b + (b === 100 ? 1 : 0)); const m = (key, base) => { const bb = X.blockBootstrap(g.filter((r) => fin(r[key])), (rs) => X.median(rs.map((r) => r[key])), { reps: Math.min(REPS, 300), seed: 71, block: 63, base }); if (bb) gp.push({ o: bb, key }); return bb ? { est: r2(bb.est), lo: r2(bb.lo), hi: r2(bb.hi), p: r2(bb.p) } : null; }; return { from: a, to: b, n: g.length, months: new Set(g.map((r) => r.d.slice(0, 7))).size, rel: m("rel", X.median(grows.map((r) => r.rel))), fb: m("fb", X.median(grows.map((r) => r.fb))), fsp: m("fsp", X.median(grows.map((r) => r.fsp))), ddb: m("ddb", X.median(grows.map((r) => r.ddb))), dds: m("dds", X.median(grows.map((r) => r.dds))) }; }),
    curve: Array.from({ length: 20 }, (_, j) => { const a = j * 5, g = grows.filter((r) => r.g >= a && r.g < a + 5); return { g: a + 2.5, n: g.length, rel: r2(X.median(g.map((r) => r.rel))), fb: r2(X.median(g.map((r) => r.fb))), fsp: r2(X.median(g.map((r) => r.fsp))), ddb: r2(X.median(g.map((r) => r.ddb))) }; }), breadthNames: f5.length };
  { const bh = X.benjaminiHochberg(gp.map((x) => x.o.p), 0.1); q5.gauge.tests = gp.length; q5.gauge.survivors = bh.reject.filter(Boolean).length; }
}

/* ================================ Q6 · yields up and dollar up: the measures, and the pullback distribution ================================ */
log("Q6 yields & dollar");
const q6 = { defs: [], instruments: {}, today: null };
{
  const G = inst("^GSPC"), S = IDX.SPY;
  const y200 = sma(US10Y.c, 200), d200 = sma(DXY.c, 200), yUpMap = new Map(), dUpMap = new Map(), y63 = new Map(), d63 = new Map();
  US10Y.dates.forEach((d, i) => { if (y200[i] != null) yUpMap.set(d, US10Y.c[i] > y200[i]); if (i >= 63) y63.set(d, US10Y.c[i] > US10Y.c[i - 63]); });
  DXY.dates.forEach((d, i) => { if (d200[i] != null) dUpMap.set(d, DXY.c[i] > d200[i]); if (i >= 63) d63.set(d, DXY.c[i] > DXY.c[i - 63]); });
  const DEFS = [["level", "above its own 200-day average (the regime study's rule)", yUpMap, dUpMap], ["change", "higher than 63 sessions (one quarter) earlier", y63, d63]];
  q6.defs = DEFS.map(([k, text]) => ({ k, text }));
  const REG = ["yield up · dollar up", "yield up · dollar down", "yield down · dollar up", "yield down · dollar down"];
  const regOf = (yu, du) => yu == null || du == null ? null : `yield ${yu ? "up" : "down"} · dollar ${du ? "up" : "down"}`;
  const study = (I, name, from) => {
    const sw = swings(I.h, I.l, PIVOT_LEN), lows = sw.filter((p) => p.type === "L").map((p) => p.k); const declStart = new Map(); for (let i = 0; i + 1 < sw.length; i++) if (sw[i].type === "H" && sw[i + 1].type === "L") declStart.set(sw[i].k, 100 * (sw[i + 1].price / sw[i].price - 1));
    const rows = []; for (let i = 0; i < I.dates.length - 63; i++) { const d = I.dates[i]; if (d < from) continue; const dd = X.fwdMaxDrawdown(I.c, i, 63); if (!fin(dd)) continue;
      const r = { d, dd, f63: X.fwdReturn(I.c, i, 63) }; for (const [k, , ym, dm] of DEFS) r[k] = regOf(lastOnOrBefore(ym, US10Y.dates, d), lastOnOrBefore(dm, DXY.dates, d)); rows.push(r); }
    const out = { name, from: rows[0]?.d, to: rows.at(-1)?.d, n: rows.length, defs: {} };
    for (const [k] of DEFS) { const o = { base: null, regimes: {} }; const all = rows.filter((r) => r[k] != null);
      const summ = (g, seed, base) => { const dist = X.dist(g.map((r) => r.dd)); const med = X.blockBootstrap(g, (rs) => X.median(rs.map((r) => r.dd)), { reps: Math.min(REPS, 300), seed, block: 63, base: base?.med ?? 0 }); const s5 = X.blockBootstrap(g, (rs) => 100 * X.share(rs.map((r) => r.dd), (x) => x <= -5), { reps: Math.min(REPS, 300), seed: seed + 1, block: 63, base: base?.s5 ?? 0 }); const s10 = 100 * X.share(g.map((r) => r.dd), (x) => x <= -10); return { n: g.length, quarters: new Set(g.map((r) => r.d.slice(0, 4) + "Q" + Math.ceil(+r.d.slice(5, 7) / 3))).size, share: r1(100 * g.length / all.length), dist, med: r2(med?.est), medLo: r2(med?.lo), medHi: r2(med?.hi), pMed: r2(med?.p), s5: r1(s5?.est), s5Lo: r1(s5?.lo), s5Hi: r1(s5?.hi), pS5: r2(s5?.p), s10: r1(s10), f63: r2(X.median(g.map((r) => r.f63))) }; };
      o.base = summ(all, 81); REG.forEach((rg, j) => { o.regimes[rg] = summ(all.filter((r) => r[k] === rg), 83 + 2 * j, o.base); });
      // swing declines that began in each regime: depth distribution (the pivot-based measure)
      o.declines = {}; for (const rg of REG) o.declines[rg] = { n: 0, depths: [] }; o.declines.all = { n: 0, depths: [] };
      for (const [kTop, depth] of declStart) { const d = I.dates[kTop]; if (d < from) continue; const rg = regOf(lastOnOrBefore(DEFS.find((x) => x[0] === k)[2], US10Y.dates, d), lastOnOrBefore(DEFS.find((x) => x[0] === k)[3], DXY.dates, d)); if (!rg) continue; o.declines[rg].depths.push(depth); o.declines.all.depths.push(depth); }
      for (const key of Object.keys(o.declines)) { const D = o.declines[key]; D.n = D.depths.length; D.dist = X.dist(D.depths); D.s10 = r1(100 * X.share(D.depths, (x) => x <= -10)); delete D.depths; }
      // full curve: share of 63-session windows with a drawdown of at least x%, x = 1..30, per regime
      o.curve = REG.map((rg) => ({ rg, pts: Array.from({ length: 30 }, (_, x) => { const g = all.filter((r) => r[k] === rg); return [x + 1, r1(100 * X.share(g.map((r) => r.dd), (v) => v <= -(x + 1)))]; }) }));
      o.curve.push({ rg: "any day", pts: Array.from({ length: 30 }, (_, x) => [x + 1, r1(100 * X.share(all.map((r) => r.dd), (v) => v <= -(x + 1)))]) });
      out.defs[k] = o; }
    return out;
  };
  q6.instruments.GSPC = study(G, "S&P 500 index (^GSPC)", "1971-01-04"); q6.instruments.SPY = study(S, "SPY", "2003-09-11"); q6.instruments.LEADERS = study({ dates: BASK.dates, c: BASK.c, h: BASK.c, l: BASK.c }, "Leaders basket (each year's top 20 at the time, equal weight)", "2007-01-03");
  const dl = US10Y.dates.at(-1), xl = DXY.dates.at(-1); q6.today = { d: dl, y10: US10Y.c.at(-1), y200: r2(y200.at(-1)), yUp: yUpMap.get(dl), y63: y63.get(dl), dxy: DXY.c.at(-1), d200: r2(d200.at(-1)), dUp: dUpMap.get(xl), d63: d63.get(xl), regimeLevel: regOf(yUpMap.get(dl), dUpMap.get(xl)), regimeChange: regOf(y63.get(dl), d63.get(xl)) };
  { const ps = []; for (const inst of Object.values(q6.instruments)) for (const def of Object.values(inst.defs)) for (const rg of Object.values(def.regimes)) for (const k of ["pMed", "pS5"]) if (fin(rg[k])) ps.push({ rg, k }); const bh = X.benjaminiHochberg(ps.map((x) => x.rg[x.k]), 0.1); ps.forEach((x, i) => { x.rg[x.k + "Adj"] = r2(bh.adjusted[i]); x.rg[x.k + "Survives"] = bh.reject[i]; }); q6.tests = ps.length; q6.survivors = bh.reject.filter(Boolean).length; }
}

/* ================================ Q7 · equal vs cap weight: the seven pairs and what followed past extremes ================================ */
log("Q7 equal vs cap");
const q7 = { pairs: [], seven: [], spx: null, sectors1y: null, tests: 0 };
{
  q7.pairs = regime.pairs.map((p) => ({ label: p.label, ew: p.ew, cw: p.cw, from: p.from, levelPctAll: p.now.levelPctAll, levelPct3y: p.now.levelPct3y, change252: p.now.change252, stretch: p.now.stretch, sinceStart: p.now.sinceStart, lows: (p.lows || []).length,
    after: p.lows?.length ? { cw63: r1(X.median(p.lows.map((l) => l.cw63))), cw252: r1(X.median(p.lows.map((l) => l.cw252))), ratio63: r1(X.median(p.lows.map((l) => l.ratio63))), ratio252: r1(X.median(p.lows.map((l) => l.ratio252))), list: p.lows.map((l) => ({ d: l.d, cw63: l.cw63, cw252: l.cw252, ratio63: l.ratio63, ratio252: l.ratio252 })) } : null }));
  q7.seven = q7.pairs.filter((p) => p.levelPctAll <= 5).sort((a, b) => a.levelPctAll - b.levelPctAll);
  // the S&P pair from the bars: RSP ÷ SPY, own-history percentile, entries into the bottom 5% (63 sessions apart), what SPY, RSP−SPY and the leaders did next
  const R = inst("RSP"), S = IDX.SPY; const dates = S.dates.filter((d) => R.byDate.has(d)), ratio = dates.map((d) => R.byDate.get(d) / S.byDate.get(d)), own = X.ownPct(ratio);
  const sIdx = (d) => S.idx.get(d), rIdx = (d) => R.idx.get(d), bIdx = (d) => BASK.idx.get(d);
  const entries = []; let last = -Infinity; for (let i = 0; i < dates.length; i++) if (own[i] != null && own[i] <= 5 && i - last > 63) { last = i; entries.push(i); }
  const H = [63, 126, 252];
  const rowsE = entries.map((i) => { const d = dates[i], si = sIdx(d), ri = rIdx(d), bi = bIdx(d), o = { d, pct: r1(own[i]) }; for (const h of H) { o["spy" + h] = r1(X.fwdReturn(S.c, si, h)); const rr = X.fwdReturn(R.c, ri, h); o["rsp" + h] = r1(rr); o["catchUp" + h] = fin(rr) && fin(o["spy" + h]) ? r1(rr - o["spy" + h]) : null; o["lead" + h] = bi != null ? r1(X.fwdReturn(BASK.c, bi, h)) : null; } return o; });
  const spyBase = {}; for (const h of H) { const v = []; for (let i = 0; i < S.c.length - h; i++) v.push(X.fwdReturn(S.c, i, h)); spyBase[h] = { med: r1(X.median(v)), up: r1(100 * X.share(v)) }; }
  const summ = {}; for (const h of H) for (const key of ["spy", "catchUp", "lead"]) { const v = rowsE.map((r) => r[key + h]).filter(fin); const b = v.length >= 3 ? X.episodeBootstrap(v, (g) => X.median(g), { reps: REPS, seed: 91, base: key === "spy" ? spyBase[h].med : 0 }) : null; summ[key + h] = { n: v.length, med: r1(X.median(v)), up: r1(100 * X.share(v)), lo: r1(b?.lo), hi: r1(b?.hi), p: r2(b?.p) }; }
  // the whole curve: SPY's next-63 by every percentile band of the ratio (5-point bands), block bootstrap
  const curve = Array.from({ length: 20 }, (_, j) => { const a = j * 5, ks = []; for (let i = 0; i < dates.length; i++) if (own[i] != null && own[i] >= a && own[i] < a + 5) ks.push(i); const v = ks.map((i) => X.fwdReturn(S.c, sIdx(dates[i]), 63)).filter(fin), c = ks.map((i) => { const rr = X.fwdReturn(R.c, rIdx(dates[i]), 63), ss = X.fwdReturn(S.c, sIdx(dates[i]), 63); return fin(rr) && fin(ss) ? rr - ss : null; }).filter(fin); return { p: a + 2.5, n: v.length, spy63: r1(X.median(v)), catchUp63: r1(X.median(c)), up: r1(100 * X.share(v)) }; });
  q7.spx = { from: dates[0], to: dates.at(-1), today: { ratio: r2(ratio.at(-1) * 100) / 100, pct: r1(own.at(-1)) }, entries: rowsE, summ, spyBase, curve, note: "own-history percentile of RSP ÷ SPY (prior days only, from 250 readings); an entry = the first day at or under the 5th percentile after 63 sessions away" };
  // where the divergence is: the last 252 sessions — SPY vs RSP vs the leaders basket vs the middle stock of the served names
  const yr = (I, d) => { const i = I.idx.get(d); return i != null && i >= 252 ? X.fwdReturn(I.c, i - 252, 252) : null; };
  const d = S.dates.at(-1); const stocks = stockSyms.filter((s) => !fundSet.has(s)).map((s) => cache[s]).filter(Boolean).map((I) => yr(I, d)).filter(fin);
  q7.sectors1y = { d, spy: r1(yr(S, d)), rsp: r1(yr(R, d)), leaders: r1(yr(BASK, d)), stockMed: r1(X.median(stocks)), stockUp: r1(100 * X.share(stocks)), stocksN: stocks.length, pairs: q7.pairs.filter((p) => p.label !== "S&P 500").map((p) => ({ label: p.label, change252: p.change252, levelPctAll: p.levelPctAll })) };
  q7.tests = Object.keys(summ).length; { const ps = Object.values(summ).filter((s) => fin(s.p)); const bh = X.benjaminiHochberg(ps.map((s) => s.p), 0.1); ps.forEach((s, i) => { s.pAdj = r2(bh.adjusted[i]); }); }
}

/* ================================ write ================================ */
const out = { generated: new Date().toISOString(), asOf: AS_OF, reps: REPS, kind: "STATISTICIAN-2 · Alan's second round, measured. Research, not buy rules.", pivotLen: PIVOT_LEN, sources: SOURCES, q1, q2, q3, q4, q5, q6, q7 };
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out));
log("wrote", OUT, Math.round(fs.statSync(OUT).size / 1024), "KB");
