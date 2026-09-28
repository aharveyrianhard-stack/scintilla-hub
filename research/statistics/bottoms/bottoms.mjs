/* BOTTOMS · runner. node research/statistics/bottoms/bottoms.mjs --scratch <dir> [--out <file>]
   Reads only local caches (no network, no database, no key):
   · the durable stats cache ~/Library/Application Support/scintilla/stats-cache (chart API daily bars copied on
     earlier lanes: daily-bars-rsi, daily-bars-s9, candles-f5, daily-bars-s7, regime-20260928/chart) and the
     FMP pulls the regime lane made on Fly (regime-20260928/fmp-eod*.json: ^VIX3M, HYG/LQD dividend-adjusted);
   · this lane's scratch cache (<scratch>/bars: chart API /candles?tf=D for PCC/PCCE/PCCI/PCSPX, VIX and the
     122 served names the older caches lacked; <scratch>/universe.json = GET /universe; caps-20260928.json = FMP).
   For every symbol the LONGEST cached copy is used. Writes one JSON for the page. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { cleanBars, seriesOf, swings, bucketOf, lineReached, PIVOT_LEN, MAX_WICK, DEPTH_BUCKETS } from "../s9-research.mjs";
import { segment } from "../ladder.mjs";
import { sma } from "../stats.mjs";
import * as B from "./bottoms-lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (k, d = null) => args.includes(k) ? args[args.indexOf(k) + 1] : d;
const LIB = path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const SCR = opt("--scratch"); if (!SCR) { console.error("--scratch <dir> is required"); process.exit(2); }
const OUT = opt("--out", path.resolve(HERE, "../../../deliverables/20260928/bottoms/data/bottoms.json"));
const dstr = (t) => new Date(t).toISOString().slice(0, 10);
const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ---------------- loading ---------------- */
const DIRS = [[path.join(SCR, "bars"), "chart API (this lane)"], [path.join(LIB, "daily-bars-rsi"), "chart API (RSI lane cache)"], [path.join(LIB, "daily-bars-s9"), "chart API (S9 cache)"],
  [path.join(LIB, "candles-f5"), "chart API (F5 cache)"], [path.join(LIB, "daily-bars-s7"), "chart API (S7 cache)"], [path.join(LIB, "regime-20260928/chart"), "chart API (regime cache)"]];
const SOURCES = {};
function loadDaily(sym) {
  let best = null;
  for (const [dir, label] of DIRS) {
    const f = path.join(dir, sym + ".json"); if (!fs.existsSync(f)) continue;
    let j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    const s = Array.isArray(j) ? j : (j.series || []);
    if (s.length && (!best || s.length > best.bars.length)) best = { bars: s, src: label };
  }
  if (best) SOURCES[sym] = { src: best.src, bars: best.bars.length, from: dstr(best.bars[0].t), to: dstr(best.bars.at(-1).t) };
  return best;
}
const FMP = ["fmp-eod.json", "fmp-eod2.json"].flatMap((f) => { const p = path.join(LIB, "regime-20260928", f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : []; });
function loadFmp(symbol, kind) {
  const m = new Map();
  for (const j of FMP) if (j.symbol === symbol && j.kind === kind && Array.isArray(j.rows)) for (const [d, o, h, l, c, v] of j.rows) m.set(d, { d, o, h, l, c, v });
  const rows = [...m.values()].sort((a, b) => a.d < b.d ? -1 : 1);
  if (rows.length) SOURCES[`${symbol} (${kind})`] = { src: "FMP via Fly (regime lane pull, 28 Sep)", bars: rows.length, from: rows[0].d, to: rows.at(-1).d };
  return rows;
}
/** A price instrument ready for study: cleaned wicks, analysed segment, S9 series. */
function instrument(sym) {
  const L = loadDaily(sym); if (!L) return null;
  const { bars: clean, cleaned } = cleanBars(L.bars, MAX_WICK[sym] ?? MAX_WICK.default);
  const { bars } = segment(clean);
  if (bars.length < 260) return null;
  const S = seriesOf(bars); S.sym = sym; S.cleaned = cleaned.length; S.idx = new Map(S.dates.map((d, i) => [d, i]));
  return S;
}

/* ---------------- macro series (own dates) ---------------- */
log("loading macro");
const vixL = loadDaily("VIX"), vix = { dates: vixL.bars.map((b) => dstr(b.t)), c: vixL.bars.map((b) => +b.c), h: vixL.bars.map((b) => +b.h), l: vixL.bars.map((b) => +b.l) };
vix.pct = B.ownPct(vix.c);
const v3 = loadFmp("^VIX3M", "eod"), v3map = new Map(v3.map((r) => [r.d, +r.c]));
const ratio = { dates: [], v: [] }; vix.dates.forEach((d, i) => { const x = v3map.get(d); if (x > 0) { ratio.dates.push(d); ratio.v.push(vix.c[i] / x); } });
ratio.pct = B.ownPct(ratio.v);
const pc = {}; for (const s of ["PCC", "PCCE", "PCCI", "PCSPX"]) { const L = loadDaily(s); if (!L) continue; const rows = L.bars.filter((b) => +b.c > 0); pc[s] = { dates: rows.map((b) => dstr(b.t)), v: rows.map((b) => +b.c) }; pc[s].pct = B.ownPct(pc[s].v); }
const hyg = loadFmp("HYG", "eodadj"), lqd = new Map(loadFmp("LQD", "eodadj").map((r) => [r.d, +r.c]));
const credit = { dates: [], v: [] }; for (const r of hyg) { const x = lqd.get(r.d); if (x > 0 && r.c > 0) { credit.dates.push(r.d); credit.v.push(r.c / x); } }
credit.dd = B.drawdownFromPeak(credit.v); credit.ddPct = B.ownPct(credit.dd);

/* ---------------- the served universe (rising tide + breadth) ---------------- */
log("loading universe");
const UNI = JSON.parse(fs.readFileSync(path.join(SCR, "universe.json"), "utf8"));
const uni = [];
for (const sym of UNI.symbols) {
  const L = loadDaily(sym); if (!L) continue;
  const { bars: clean } = cleanBars(L.bars, 0.25); const { bars } = segment(clean);
  if (bars.length < 60) continue;
  const c = bars.map((b) => +b.c), dates = bars.map((b) => dstr(b.t));
  uni.push({ sym, dates, c, s50: sma(c, 50), s200: sma(c, 200), idx: new Map(dates.map((d, i) => [d, i])) });
}
const X = B.crossSection(uni), MINN = 50;
log("universe", uni.length, "names;", X.size, "dates");
const SECT = ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"];
const sect = SECT.map((s) => uni.find((u) => u.sym === s) ?? (() => { const L = loadDaily(s); if (!L) return null; const c = L.bars.map((b) => +b.c), dates = L.bars.map((b) => dstr(b.t)); return { sym: s, dates, c, idx: new Map(dates.map((d, i) => [d, i])) }; })()).filter(Boolean);
const SX = B.crossSection(sect);
// breadth / tide / dispersion on their own dates
const xd = [...X.keys()].filter((d) => X.get(d).n >= MINN).sort();
const breadth = { dates: xd, a50: xd.map((d) => { const e = X.get(d); return e.n50 >= MINN ? 100 * e.above50 / e.n50 : null; }), a200: xd.map((d) => { const e = X.get(d); return e.n200 >= MINN ? 100 * e.above200 / e.n200 : null; }),
  up: xd.map((d) => 100 * X.get(d).up / X.get(d).n), disp: xd.map((d) => B.iqr(X.get(d).rets)), n: xd.map((d) => X.get(d).n) };
breadth.a50pct = B.ownPct(breadth.a50); breadth.dispPct = B.ownPct(breadth.disp); breadth.upPct = B.ownPct(breadth.up); breadth.a200pct = B.ownPct(breadth.a200);

/* ---------------- part 1 · conditions at every swing low ---------------- */
function studyIndex(sym) {
  const S = instrument(sym), n = S.c.length, D = S.dates;
  const A = (dates, vals) => B.align(D, B.toMap(dates, vals));
  const M = {
    vix: A(vix.dates, vix.c), vixH: A(vix.dates, vix.h), vixL: A(vix.dates, vix.l), vixPct: A(vix.dates, vix.pct),
    ratio: A(ratio.dates, ratio.v), ratioPct: A(ratio.dates, ratio.pct),
    credit: A(credit.dates, credit.v), creditDd: A(credit.dates, credit.dd), creditPct: A(credit.dates, credit.ddPct),
    a50: A(breadth.dates, breadth.a50), a50pct: A(breadth.dates, breadth.a50pct), a200: A(breadth.dates, breadth.a200), disp: A(breadth.dates, breadth.disp), dispPct: A(breadth.dates, breadth.dispPct), up: A(breadth.dates, breadth.up),
  };
  for (const s of Object.keys(pc)) { M[s] = A(pc[s].dates, pc[s].v); M[s + "pct"] = A(pc[s].dates, pc[s].pct); }
  const d200 = S.c.map((x, i) => S.ma.s200[i] > 0 ? (x / S.ma.s200[i] - 1) * 100 : null), d200pct = B.ownPct(d200), rsiPct = B.ownPct(S.rsi);
  const volR = S.v.map((x, i) => S.vol50[i] > 0 && x > 0 ? x / S.vol50[i] : null), volPct = B.ownPct(volR);
  const turns = { vix: B.seriesSwings(M.vix, PIVOT_LEN, M.vixH, M.vixL), ratio: B.seriesSwings(M.ratio), credit: B.seriesSwings(M.credit), a50: B.seriesSwings(M.a50), rsi: B.seriesSwings(S.rsi) };
  for (const s of Object.keys(pc)) turns[s] = B.seriesSwings(M[s]);
  const sw = swings(S.h, S.l, PIVOT_LEN), lows = [];
  for (let j = 0; j < sw.length; j++) {
    if (sw[j].type !== "L") continue;
    const k = sw[j].k, ph = sw[j - 1], nh = sw[j + 1], a = ph ? ph.k : Math.max(0, k - 60), b = nh ? nh.k : Math.min(n - 1, k + 60);
    const depth = ph ? (sw[j].price / ph.price - 1) * 100 : null;
    let rsiMin = null, ratioMax = null, vmax = null, vmaxK = null; for (let i = a; i <= k; i++) { if (S.rsi[i] != null && (rsiMin == null || S.rsi[i] < rsiMin)) rsiMin = S.rsi[i]; if (M.ratio[i] != null && (ratioMax == null || M.ratio[i] > ratioMax)) ratioMax = M.ratio[i]; }
    for (let i = a; i <= b; i++) if (M.vix[i] != null && (vmax == null || M.vix[i] > vmax)) { vmax = M.vix[i]; vmaxK = i; }
    const cdd = M.credit[k] != null && M.credit[a] != null ? (() => { let pk = -Infinity; for (let i = a; i <= k; i++) if (M.credit[i] != null) pk = Math.max(pk, M.credit[i]); return (M.credit[k] / pk - 1) * 100; })() : null;
    lows.push({ date: D[k], k, depth: r2(depth), bucket: depth == null ? null : bucketOf(depth), fromHigh: ph ? D[ph.k] : null, barsDown: ph ? k - ph.k : null,
      rebound: nh ? r2((nh.price / sw[j].price - 1) * 100) : null,
      vix: r1(M.vix[k]), vixPct: r1(M.vixPct[k]), vixTurn: B.nearestTurn(turns.vix, "H", k, a, b), vixMaxAt: vmaxK == null ? null : vmaxK - k,
      ratio: r2(M.ratio[k]), ratioMax: r2(ratioMax), ratioPct: r1(M.ratioPct[k]), inverted: M.ratio[k] == null ? null : M.ratio[k] > 1, invertedInDecline: ratioMax == null ? null : ratioMax > 1, ratioTurn: B.nearestTurn(turns.ratio, "H", k, a, b),
      pcc: r2(M.PCC?.[k]), pccPct: r1(M.PCCpct?.[k]), pccTurn: turns.PCC ? B.nearestTurn(turns.PCC, "H", k, a, b) : null,
      pcce: r2(M.PCCE?.[k]), pccePct: r1(M.PCCEpct?.[k]), pcceTurn: turns.PCCE ? B.nearestTurn(turns.PCCE, "H", k, a, b) : null,
      pcci: r2(M.PCCI?.[k]), pcciPct: r1(M.PCCIpct?.[k]),
      creditDecline: r2(cdd), creditDdPct: r1(M.creditPct[k]), creditTurn: B.nearestTurn(turns.credit, "L", k, a, b),
      rsi: r1(S.rsi[k]), rsiMin: r1(rsiMin), rsiPct: r1(rsiPct[k]), rsiTurn: B.nearestTurn(turns.rsi, "L", k, a, b),
      line: lineReached(S.ma, sw[j].price, k), d200: r2(d200[k]), d200pct: r1(d200pct[k]), volRatio: r2(volR[k]), volPct: r1(volPct[k]),
      a50: r1(M.a50[k]), a50pct: r1(M.a50pct[k]), a50Turn: B.nearestTurn(turns.a50, "L", k, a, b), a200: r1(M.a200[k]), dispPct: r1(M.dispPct[k]) });
  }
  const highs = sw.filter((p) => p.type === "H").map((p) => p.k);
  // stress series (higher = more stress), on this instrument's dates
  const stress = { vix: M.vixPct, ratio: M.ratioPct, PCC: M.PCCpct, PCCE: M.PCCEpct, PCCI: M.PCCIpct, credit: B.flip(M.creditPct), rsi: B.flip(rsiPct), below200: B.flip(d200pct), breadth: B.flip(M.a50pct), volume: volPct, dispersion: M.dispPct };
  const inverted = M.ratio.map((x) => x == null ? null : x > 1 ? 100 : 0);
  const lowKs = lows.map((r) => r.k), deepKs = lows.filter((r) => r.depth != null && r.depth <= -10).map((r) => r.k);
  const curves = {}, curvesDeep = {};
  for (const [key, s] of Object.entries(stress)) { if (!s) continue; curves[key] = slim(B.baseRateCurve(s, lowKs)); curvesDeep[key] = slim(B.baseRateCurve(s, deepKs)); }
  curves.inverted = slim(B.baseRateCurve(inverted, lowKs, { thresholds: [100] })); curvesDeep.inverted = slim(B.baseRateCurve(inverted, deepKs, { thresholds: [100] }));
  const combos = { "VIX + put/call": ["vix", "PCC"], "VIX + credit": ["vix", "credit"], "VIX + RSI": ["vix", "rsi"], "VIX + breadth": ["vix", "breadth"], "RSI + below 200-day": ["rsi", "below200"], "VIX + put/call + RSI + breadth": ["vix", "PCC", "rsi", "breadth"] };
  const comboCurves = {}, comboDeep = {};
  for (const [name, keys] of Object.entries(combos)) { const s = B.combine(keys.map((k) => stress[k])); comboCurves[name] = slim(B.baseRateCurve(s, lowKs)); comboDeep[name] = slim(B.baseRateCurve(s, deepKs)); }
  // inversion together with each percentile condition
  const invWith = {}; for (const key of ["rsi", "PCC", "breadth", "below200"]) { const s = stress[key].map((x, i) => inverted[i] === 100 ? x : (x == null ? null : -1)); invWith[key] = slim(B.baseRateCurve(s, lowKs)); }
  // event-aligned paths
  const deepLowKs = deepKs, align = (arr, ks, rel) => B.eventAligned(arr, ks, { rel }).map((r) => ({ o: r.o, n: r.n, q1: r2(r.q1), med: r2(r.med), q3: r2(r.q3) }));
  const series = { vixPct: M.vixPct, ratio: M.ratio, pccPct: M.PCCpct, pccePct: M.PCCEpct, credit: M.credit, rsi: S.rsi, a50: M.a50, dispPct: M.dispPct, up: M.up };
  const ev = {}; for (const [k, arr] of Object.entries(series)) ev[k] = { all: align(arr, lowKs, k === "credit" ? "pct" : null), deep: align(arr, deepLowKs, k === "credit" ? "pct" : null), tops: align(arr, highs, k === "credit" ? "pct" : null) };
  return { S, lows, highs, curves, curvesDeep, comboCurves, comboDeep, invWith, ev, d200, stress };
}
function slim(c) { return { base: r1(c.base), days: c.days, lows: c.lows, rows: c.rows.map((r) => [r.t, r.days, r1(r.hit), r.episodes, r1(r.falseAlarm), r1(r.caught)]) }; }

function summarise(lows) {
  const grp = (rs) => {
    const turn = (key) => { const xs = rs.map((r) => r[key]); const has = xs.filter((x) => x != null); return { n: rs.length, none: rs.length - has.length, before: has.filter((x) => x < 0).length, same: has.filter((x) => x === 0).length, after: has.filter((x) => x > 0).length, med: B.med(has) }; };
    const qs = (key) => { const a = rs.map((r) => r[key]).filter((x) => x != null).sort((p, q) => p - q); return a.length ? { n: a.length, q1: r2(B.q(a, 0.25)), med: r2(B.q(a, 0.5)), q3: r2(B.q(a, 0.75)) } : null; };
    const share = (f, key) => { const a = rs.filter((r) => r[key] != null); return a.length ? r1(100 * a.filter(f).length / a.length) : null; };
    return { n: rs.length, turns: { vix: turn("vixTurn"), ratio: turn("ratioTurn"), pcc: turn("pccTurn"), pcce: turn("pcceTurn"), credit: turn("creditTurn"), rsi: turn("rsiTurn"), breadth: turn("a50Turn"), vixMaxAt: turn("vixMaxAt") },
      at: { vix: qs("vix"), vixPct: qs("vixPct"), ratio: qs("ratio"), pcc: qs("pcc"), pccPct: qs("pccPct"), pcce: qs("pcce"), creditDecline: qs("creditDecline"), rsi: qs("rsi"), rsiPct: qs("rsiPct"), d200: qs("d200"), d200pct: qs("d200pct"), volRatio: qs("volRatio"), a50: qs("a50"), a200: qs("a200"), dispPct: qs("dispPct") },
      invertedAtLow: share((r) => r.inverted, "inverted"), invertedInDecline: share((r) => r.invertedInDecline, "invertedInDecline"), below200: share((r) => r.d200 < 0, "d200"),
      lines: Object.fromEntries(["e13", "e21", "s50", "s200", "none"].map((k) => [k, share((r) => r.line === k, "line")])) };
  };
  const out = { all: grp(lows) }; for (const [, , label] of DEPTH_BUCKETS) out[label] = grp(lows.filter((r) => r.bucket === label));
  return out;
}

const part1 = {}; const IDX = {};
for (const sym of ["SPY", "QQQ", "IWM"]) {
  log("part 1", sym); const R = studyIndex(sym); IDX[sym] = R;
  part1[sym] = { lows: R.lows.map(({ k, ...r }) => r), summary: summarise(R.lows), curves: R.curves, curvesDeep: R.curvesDeep, combos: R.comboCurves, combosDeep: R.comboDeep, invWith: R.invWith, ev: R.ev,
    from: R.S.dates[0], to: R.S.dates.at(-1), nLows: R.lows.length, nDeep: R.lows.filter((r) => r.depth != null && r.depth <= -10).length };
}

/* ---------------- part 2 · the 200-day as a fact ---------------- */
const caps = JSON.parse(fs.readFileSync(path.join(SCR, "caps-20260928.json"), "utf8"));
const GROUPS = { indexes: ["SPY", "QQQ", "IWM", "DIA"], sectors: [...SECT, "SMH"], stocks: caps.top20 };
const per = {}; const itemsAll = {}, itemsBelow = {};
log("part 2");
for (const [g, syms] of Object.entries(GROUPS)) for (const sym of syms) {
  const S = instrument(sym); if (!S) { per[sym] = { missing: true }; continue; }
  const d = S.c.map((x, i) => S.ma.s200[i] > 0 ? (x / S.ma.s200[i] - 1) * 100 : null), p = B.ownPct(d);
  const hs = swings(S.h, S.l, PIVOT_LEN).filter((x) => x.type === "H").map((x) => x.k), O = B.dayOutcomes(S.c, d, hs);
  // blocks: runs on the same side of the 200-day
  const block = new Array(S.c.length).fill(null); let bid = 0; for (let i = 0; i < d.length; i++) { if (d[i] == null) continue; if (i > 0 && d[i - 1] != null && (d[i] < 0) !== (d[i - 1] < 0)) bid++; block[i] = `${sym}:${bid}`; }
  const A = [], Bw = [];
  for (let i = 0; i < S.c.length; i++) { const o = O[i]; if (!o || p[i] == null) continue; A.push({ i, x: p[i], o, ep: block[i] }); if (d[i] < 0) Bw.push({ i, x: p[i], o, ep: block[i] }); }
  itemsAll[sym] = { g, rows: A }; itemsBelow[sym] = { g, rows: Bw };
  const eps = B.belowEpisodes(d);
  per[sym] = { group: g, from: S.dates[0], to: S.dates.at(-1), days: A.length, belowDays: Bw.length, belowStretches: eps.length, cleaned: S.cleaned,
    now: { d: r2(d.at(-1)), pct: r1(p.at(-1)) }, censored: Bw.filter((r) => r.o.censored).length,
    deepest: r2(Math.min(...d.filter((x) => x != null))), deepestDate: S.dates[d.indexOf(Math.min(...d.filter((x) => x != null)))] };
}
const OUTCOMES = [["toNextHigh", "all"], ["fallBeforeHigh", "all"], ["barsToHigh", "all"], ["furtherFall", "below"], ["toReclaim", "below"]];
function part2For(syms) {
  const res = {};
  for (const [key, set] of OUTCOMES) {
    const src = set === "all" ? itemsAll : itemsBelow, groups = [], items = [];
    for (const s of syms) { const I = src[s]; if (!I) continue; const rows = I.rows.filter((r) => r.o[key] != null && Number.isFinite(r.o[key])); if (rows.length < 30) continue; groups.push({ x: rows.map((r) => r.x), y: rows.map((r) => r.o[key]) }); for (const r of rows) items.push({ x: r.x, y: r.o[key], ep: r.ep }); }
    const t = B.shiftTest(groups, 400, 17), bins = B.binnedBootstrap(items, { w: 5, reps: 150, seed: 23 });
    res[key] = { rho: r2(t.rho), p: r2(t.p), nullLo: r2(t.nullLo), nullHi: r2(t.nullHi), n: t.n, all: r2(B.med(items.map((x) => x.y))), bins: bins.filter((b) => b.n > 0).map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, med: r2(b.med), bandLo: r2(b.bandLo), bandHi: r2(b.bandHi) })) };
  }
  return res;
}
const part2 = { per, groups: {} };
for (const [g, syms] of Object.entries({ ...GROUPS, pooled: Object.values(GROUPS).flat() })) { log("part 2 group", g); part2.groups[g] = part2For(syms.filter((s) => !per[s]?.missing)); }

/* ---------------- part 3 · rising tide ---------------- */
log("part 3");
const spy = IDX.SPY.S, sd = spy.dates, spyRet = spy.c.map((x, i) => i ? (x / spy.c[i - 1] - 1) * 100 : null), spyRetPct = B.ownPct(spyRet.map((x) => x == null ? null : Math.abs(x)));
const withSpy = [], sectWith = [];
for (let i = 1; i < sd.length; i++) {
  const e = X.get(sd[i]), s = SX.get(sd[i]), r = spyRet[i]; if (r == null || r === 0) continue;
  if (e && e.n >= MINN) withSpy.push({ i, dir: r > 0 ? 1 : -1, r, size: spyRetPct[i], share: 100 * (r > 0 ? e.up : e.down) / e.n, n: e.n });
  if (s && s.n >= 9) sectWith.push({ i, dir: r > 0 ? 1 : -1, share: 100 * (r > 0 ? s.up : s.down) / s.n, count: r > 0 ? s.up : s.down, n: s.n });
}
const dist = (xs) => { const a = xs.filter((x) => x != null).sort((p, q) => p - q); return { n: a.length, pct: Array.from({ length: 99 }, (_, k) => r1(B.q(a, (k + 1) / 100))) }; };
const bySize = (dir) => { const rows = withSpy.filter((r) => r.dir === dir && r.size != null), out = []; for (let lo = 0; lo < 100; lo += 5) { const g = rows.filter((r) => r.size > lo && r.size <= lo + 5).map((r) => r.share).sort((a, b) => a - b); out.push({ lo, hi: lo + 5, n: g.length, q1: r1(B.q(g, 0.25)), med: r1(B.q(g, 0.5)), q3: r1(B.q(g, 0.75)) }); } return out; };
// swings
const ssw = swings(spy.h, spy.l, PIVOT_LEN), legs = [];
for (let j = 0; j + 1 < ssw.length; j++) {
  const a = ssw[j], b = ssw[j + 1], sign = a.type === "L" ? 1 : -1, dA = sd[a.k], dB = sd[b.k];
  const u = B.legShare(uni, dA, dB, sign), s = B.legShare(sect, dA, dB, sign);
  if (u.n >= MINN) legs.push({ from: dA, to: dB, dir: sign, move: r2((spy.c[b.k] / spy.c[a.k] - 1) * 100), bars: b.k - a.k, share: r1(u.share), n: u.n, sectShare: r1(s.share), sectN: s.n });
}
const legStats = (dir) => { const L = legs.filter((l) => l.dir === dir), a = L.map((l) => l.share).sort((p, q) => p - q), sa = L.map((l) => l.sectShare).filter((x) => x != null).sort((p, q) => p - q);
  return { n: L.length, q1: r1(B.q(a, 0.25)), med: r1(B.q(a, 0.5)), q3: r1(B.q(a, 0.75)), min: r1(a[0]), sectMed: r1(B.q(sa, 0.5)), sectQ1: r1(B.q(sa, 0.25)), rhoSize: r2(B.spearman(L.map((l) => Math.abs(l.move)), L.map((l) => l.share))) }; };
// levels at SPY swing lows / highs (the guides)
const lowRows = IDX.SPY.lows, highKs = IDX.SPY.highs;
const levelAt = (ks, arr) => { const a = ks.map((k) => arr[sd[k]]).filter((x) => x != null).sort((p, q) => p - q); return { n: a.length, pct: [5, 10, 25, 50, 75, 90, 95].map((p) => [p, r1(B.q(a, p / 100))]) }; };
const bmap = (arr) => Object.fromEntries(breadth.dates.map((d, i) => [d, arr[i]]));
const B50 = bmap(breadth.a50), B200 = bmap(breadth.a200), BUP = bmap(breadth.up), BDISP = bmap(breadth.dispPct);
const levels = {};
for (const [name, arr] of [["a50", B50], ["a200", B200], ["up", BUP], ["dispPct", BDISP]]) {
  levels[name] = { allDays: levelAt(sd.map((_, i) => i), arr), lows: levelAt(lowRows.map((r) => r.k), arr), deepLows: levelAt(lowRows.filter((r) => r.depth <= -10).map((r) => r.k), arr), highs: levelAt(highKs, arr) };
  for (const [, , label] of DEPTH_BUCKETS) levels[name][label] = levelAt(lowRows.filter((r) => r.bucket === label).map((r) => r.k), arr);
}
// gauges now
const last = sd.at(-1), lastLow = lowRows.at(-1), li = breadth.dates.length - 1;
const since = B.legShare(uni, sd[lastLow.k], last, 1), sectNow = SX.get(last);
const rsp = instrument("RSP"); const eqw = rsp ? (() => { const a = rsp.idx.get(sd[lastLow.k]), b = rsp.idx.get(last); return a == null || b == null ? null : r2(((rsp.c[b] / rsp.c[a]) / (spy.c.at(-1) / spy.c[lastLow.k]) - 1) * 100); })() : null;
const part3 = {
  universe: { served: UNI.count, loaded: uni.length, sha: UNI.universe_sha256, minNames: MINN, firstDate: breadth.dates[0], namesFirst: breadth.n[0], namesLast: breadth.n.at(-1), namesByYear: Object.fromEntries([...new Set(breadth.dates.map((d) => d.slice(0, 4)))].map((y) => [y, breadth.n[breadth.dates.findIndex((d) => d.startsWith(y))]])) },
  upDays: dist(withSpy.filter((r) => r.dir === 1).map((r) => r.share)), downDays: dist(withSpy.filter((r) => r.dir === -1).map((r) => r.share)),
  sectUp: dist(sectWith.filter((r) => r.dir === 1).map((r) => r.share)), sectDown: dist(sectWith.filter((r) => r.dir === -1).map((r) => r.share)),
  allSectorsWith: { up: r1(100 * sectWith.filter((r) => r.dir === 1 && r.count === r.n).length / sectWith.filter((r) => r.dir === 1).length), down: r1(100 * sectWith.filter((r) => r.dir === -1 && r.count === r.n).length / sectWith.filter((r) => r.dir === -1).length) },
  bySizeUp: bySize(1), bySizeDown: bySize(-1), legs: { up: legStats(1), down: legStats(-1), rows: legs.slice(-40) },
  dispersion: { lows: IDX.SPY.ev.dispPct.all, deep: IDX.SPY.ev.dispPct.deep, tops: IDX.SPY.ev.dispPct.tops }, levels,
  now: { date: last, up: r1(breadth.up[li]), upPct: r1(breadth.upPct[li]), a50: r1(breadth.a50[li]), a50pct: r1(breadth.a50pct[li]), a200: r1(breadth.a200[li]), a200pct: r1(breadth.a200pct[li]), dispPct: r1(breadth.dispPct[li]),
    sectorsUp: sectNow ? sectNow.up : null, sectorsN: sectNow ? sectNow.n : null, lastSwingLow: sd[lastLow.k], lastSwingLowDepth: lastLow.depth, sinceLowShare: r1(since.share), sinceLowN: since.n, eqwVsCapSinceLow: eqw, spyMove: r2(spyRet.at(-1)), spyFromHigh: r2((spy.c.at(-1) / Math.max(...spy.c) - 1) * 100), names: breadth.n[li] },
  history: { dates: breadth.dates.filter((_, i) => i % 5 === 0 || i === li), a50: breadth.a50.filter((_, i) => i % 5 === 0 || i === li).map(r1), n: breadth.n.filter((_, i) => i % 5 === 0 || i === li) },
};

/* ---------------- write ---------------- */
const out = { generated: new Date().toISOString(), kind: "BOTTOMS · research questions about the conditions around swing lows, the 200-day as a measured fact, and the rising tide. Descriptive; nothing here is a buy rule.",
  pivotLen: PIVOT_LEN, sources: SOURCES, caps, part1, part2, part3 };
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out));
log("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
for (const s of ["SPY", "QQQ", "IWM"]) { const P = part1[s]; log(s, P.nLows, "lows,", P.nDeep, "after 10%+; VIX turned before/same/after/none:", JSON.stringify(P.summary.all.turns.vix)); }
