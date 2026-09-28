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
  if (best) {
    // a patch file <sym>-pre-YYYYMMDD.json replaces everything before that date (META: the chart API serves a
    // different ~$15 security under META before 2022-06-09; the FB-era history comes from FMP, leaders lane cache)
    const pf = fs.existsSync(PATCH) ? fs.readdirSync(PATCH).find((f) => f.startsWith(sym + "-pre-")) : null;
    if (pf) {
      const cut = Date.parse(pf.slice(sym.length + 5, sym.length + 13).replace(/(\d{4})(\d{2})(\d{2})/, "$1-$2-$3") + "T00:00:00Z");
      const P = JSON.parse(fs.readFileSync(path.join(PATCH, pf), "utf8"));
      best = { bars: [...P.series.filter((b) => b.t < cut), ...best.bars.filter((b) => b.t >= cut)], src: best.src + ` + ${P.provider} before ${dstr(cut)}` };
      PATCHED[sym] = { file: pf, note: P.note, rows: P.series.filter((b) => b.t < cut).length };
    }
    SOURCES[sym] = { src: best.src, bars: best.bars.length, from: dstr(best.bars[0].t), to: dstr(best.bars.at(-1).t) };
  }
  return best;
}
const PATCH = path.join(SCR, "leaders/bars-patch"), PATCHED = {}, FAULTS = {};
/** Price history cut to the part after its last data fault (close jump beyond 2× / below ½×, or a hole > 20 days). */
function trimmed(sym, bars) {
  const T = B.trimAtFaults(bars);
  if (T.faults.length) FAULTS[sym] = { faults: T.faults.map(({ date, kind, x }) => ({ date, kind, x })), keptFrom: dstr(T.bars[0].t), droppedBars: T.dropped };
  return T.bars;
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
  const { bars: clean, cleaned } = cleanBars(trimmed(sym, L.bars), MAX_WICK[sym] ?? MAX_WICK.default);
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
  const { bars: clean } = cleanBars(trimmed(sym, L.bars), 0.25); const { bars } = segment(clean);
  if (bars.length < 60) continue;
  const c = bars.map((b) => +b.c), dates = bars.map((b) => dstr(b.t));
  uni.push({ sym, dates, c, s50: sma(c, 50), s200: sma(c, 200), idx: new Map(dates.map((d, i) => [d, i])) });
}
const X = B.crossSection(uni), MINN = 50;
log("universe", uni.length, "names;", X.size, "dates");
const SECT = ["XLB", "XLC", "XLE", "XLF", "XLI", "XLK", "XLP", "XLRE", "XLU", "XLV", "XLY"];
const sect = SECT.map((s) => uni.find((u) => u.sym === s) ?? (() => { const L = loadDaily(s); if (!L) return null; const tb = trimmed(s, L.bars), c = tb.map((b) => +b.c), dates = tb.map((b) => dstr(b.t)); return { sym: s, dates, c, idx: new Map(dates.map((d, i) => [d, i])) }; })()).filter(Boolean);
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
    // is there a reading of each condition on the low day? No reading = "no data yet", never "no turn" (reviewer, 28 Sep)
    const has = { vix: M.vix[k] != null, ratio: M.ratio[k] != null, pcc: M.PCC?.[k] != null, pcce: M.PCCE?.[k] != null, credit: M.credit[k] != null, rsi: S.rsi[k] != null, breadth: M.a50[k] != null };
    lows.push({ date: D[k], k, has, depth: r2(depth), bucket: depth == null ? null : bucketOf(depth), fromHigh: ph ? D[ph.k] : null, barsDown: ph ? k - ph.k : null,
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
  // every curve starts at its own first usable reading (own percentiles need 250 earlier readings), so a low before
  // a series existed is left out rather than counted as "not caught"; the *Common curves put every condition on
  // ONE shared set of lows (from the latest of those starts) so they can be ranked against each other
  const curves = {}, curvesDeep = {}, curvesCommon = {}, curvesCommonDeep = {}, starts = {};
  for (const [key, s] of Object.entries(stress)) if (s) starts[key] = B.firstIdx(s);
  starts.inverted = B.firstIdx(inverted);
  const commonStart = Math.max(...Object.values(starts));
  for (const [key, s] of Object.entries(stress)) {
    if (!s) continue; const o = { start: starts[key] }, oc = { start: commonStart };
    curves[key] = slim(B.baseRateCurve(s, lowKs, o)); curvesDeep[key] = slim(B.baseRateCurve(s, deepKs, o));
    curvesCommon[key] = slim(B.baseRateCurve(s, lowKs, oc)); curvesCommonDeep[key] = slim(B.baseRateCurve(s, deepKs, oc));
  }
  const oi = { thresholds: [100], start: starts.inverted }, oic = { thresholds: [100], start: commonStart };
  curves.inverted = slim(B.baseRateCurve(inverted, lowKs, oi)); curvesDeep.inverted = slim(B.baseRateCurve(inverted, deepKs, oi));
  curvesCommon.inverted = slim(B.baseRateCurve(inverted, lowKs, oic)); curvesCommonDeep.inverted = slim(B.baseRateCurve(inverted, deepKs, oic));
  const combos = { "VIX + put/call": ["vix", "PCC"], "VIX + credit": ["vix", "credit"], "VIX + RSI": ["vix", "rsi"], "VIX + breadth": ["vix", "breadth"], "RSI + below 200-day": ["rsi", "below200"], "VIX + put/call + RSI + breadth": ["vix", "PCC", "rsi", "breadth"] };
  const comboCurves = {}, comboDeep = {}, comboCommon = {}, comboCommonDeep = {};
  for (const [name, keys] of Object.entries(combos)) {
    const s = B.combine(keys.map((k) => stress[k])), o = { start: B.firstIdx(s) }, oc = { start: commonStart };
    comboCurves[name] = slim(B.baseRateCurve(s, lowKs, o)); comboDeep[name] = slim(B.baseRateCurve(s, deepKs, o));
    comboCommon[name] = slim(B.baseRateCurve(s, lowKs, oc)); comboCommonDeep[name] = slim(B.baseRateCurve(s, deepKs, oc));
  }
  // inversion together with each percentile condition (null wherever either reading is missing)
  const invWith = {}; for (const key of ["rsi", "PCC", "breadth", "below200"]) { const s = stress[key].map((x, i) => inverted[i] == null || x == null ? null : inverted[i] === 100 ? x : -1); invWith[key] = slim(B.baseRateCurve(s, lowKs, { start: B.firstIdx(s) })); }
  // event-aligned paths
  const deepLowKs = deepKs, align = (arr, ks, rel) => B.eventAligned(arr, ks, { rel }).map((r) => ({ o: r.o, n: r.n, q1: r2(r.q1), med: r2(r.med), q3: r2(r.q3) }));
  const series = { vixPct: M.vixPct, ratio: M.ratio, pccPct: M.PCCpct, pccePct: M.PCCEpct, credit: M.credit, rsi: S.rsi, a50: M.a50, dispPct: M.dispPct, up: M.up };
  const ev = {}; for (const [k, arr] of Object.entries(series)) ev[k] = { all: align(arr, lowKs, k === "credit" ? "pct" : null), deep: align(arr, deepLowKs, k === "credit" ? "pct" : null), tops: align(arr, highs, k === "credit" ? "pct" : null) };
  const commonFrom = D[commonStart], startDates = Object.fromEntries(Object.entries(starts).map(([k, i]) => [k, D[i] ?? null]));
  return { S, lows, highs, curves, curvesDeep, curvesCommon, curvesCommonDeep, comboCurves, comboDeep, comboCommon, comboCommonDeep, invWith, ev, d200, stress, commonFrom, startDates };
}
function slim(c) { return { base: r1(c.base), days: c.days, lows: c.lows, rows: c.rows.map((r) => [r.t, r.days, r1(r.hit), r.episodes, r1(r.falseAlarm), r1(r.caught)]) }; }

function summarise(lows) {
  const grp = (rs) => {
    // noData = no reading of the condition on the low day; none = a reading, but no swing of its own in that stretch
    const turn = (key, hk) => { const withData = hk ? rs.filter((r) => r.has[hk]) : rs, has = withData.map((r) => r[key]).filter((x) => x != null);
      return { n: rs.length, noData: rs.length - withData.length, withData: withData.length, none: withData.length - has.length, before: has.filter((x) => x < 0).length, same: has.filter((x) => x === 0).length, after: has.filter((x) => x > 0).length, med: B.med(has) }; };
    const qs = (key) => { const a = rs.map((r) => r[key]).filter((x) => x != null).sort((p, q) => p - q); return a.length ? { n: a.length, q1: r2(B.q(a, 0.25)), med: r2(B.q(a, 0.5)), q3: r2(B.q(a, 0.75)) } : null; };
    const share = (f, key) => { const a = rs.filter((r) => r[key] != null); return a.length ? r1(100 * a.filter(f).length / a.length) : null; };
    return { n: rs.length, turns: { vix: turn("vixTurn", "vix"), ratio: turn("ratioTurn", "ratio"), pcc: turn("pccTurn", "pcc"), pcce: turn("pcceTurn", "pcce"), credit: turn("creditTurn", "credit"), rsi: turn("rsiTurn", "rsi"), breadth: turn("a50Turn", "breadth"), vixMaxAt: turn("vixMaxAt", "vix") },
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
    common: { from: R.commonFrom, curves: R.curvesCommon, curvesDeep: R.curvesCommonDeep, combos: R.comboCommon, combosDeep: R.comboCommonDeep }, startDates: R.startDates,
    from: R.S.dates[0], to: R.S.dates.at(-1), nLows: R.lows.length, nDeep: R.lows.filter((r) => r.depth != null && r.depth <= -10).length };
}

/* ---------------- part 2 · the 200-day as a fact ---------------- */
const caps = JSON.parse(fs.readFileSync(path.join(SCR, "caps-20260928.json"), "utf8"));
// point-in-time top 20: each calendar year's 20 largest by market cap on its first trading day (FMP historical market
// caps, leaders lane cache, from Nov 2006). A stock's days count for the "stocks" group only in the years it was in
// that year's top 20 — no picking by today's size. Today's top 20 is kept only as a labelled survivor comparison.
const CAPDIR = path.join(SCR, "leaders/caps"), capHist = {};
for (const f of fs.existsSync(CAPDIR) ? fs.readdirSync(CAPDIR) : []) if (f.endsWith(".json")) capHist[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(CAPDIR, f), "utf8")).sort((a, b) => a.date < b.date ? -1 : 1);
const YEARS = Array.from({ length: 2026 - 2007 + 1 }, (_, i) => 2007 + i), capNotes = [];
// AMD (in today's top 20) has no pulled cap history: estimate = close on the year's first bar × diluted weighted shares of the latest quarter filed before it
{
  const fund = path.join(SCR, "leaders/fund/AMD.json"), L = loadDaily("AMD");
  if (!capHist.AMD && fs.existsSync(fund) && L) {
    const q = JSON.parse(fs.readFileSync(fund, "utf8")).filter((r) => r.weightedAverageShsOutDil > 0).sort((a, b) => a.date < b.date ? -1 : 1), rows = [];
    for (const y of YEARS) { const b = L.bars.find((x) => dstr(x.t) >= `${y}-01-01`); if (!b) continue; const d = dstr(b.t), sh = q.filter((r) => r.date < d).at(-1); if (sh) rows.push({ symbol: "AMD", date: d, marketCap: +b.c * sh.weightedAverageShsOutDil }); }
    capHist.AMD = rows; capNotes.push("AMD market cap estimated as close × diluted weighted shares (FMP income statements); no pulled cap history");
  }
}
const pitTop = B.topByYear(capHist, YEARS, 20), memberYears = {};
for (const [y, syms] of Object.entries(pitTop)) for (const s of syms) (memberYears[s] ??= []).push(+y);
const GROUPS = { indexes: ["SPY", "QQQ", "IWM", "DIA"], sectors: [...SECT, "SMH"], stocks: Object.keys(memberYears).sort(), today20: caps.top20 };
const FILTER = { stocks: (sym, date) => memberYears[sym]?.includes(+date.slice(0, 4)) };
log("part 2 · point-in-time top-20 names:", GROUPS.stocks.length);
const symData = {}, simR = B.rng(41);
function prep(sym) {
  if (sym in symData) return symData[sym];
  const S = instrument(sym); if (!S) return (symData[sym] = null);
  const d = S.c.map((x, i) => S.ma.s200[i] > 0 ? (x / S.ma.s200[i] - 1) * 100 : null), p = B.ownPct(d);
  const hs = swings(S.h, S.l, PIVOT_LEN).filter((x) => x.type === "H").map((x) => x.k), O = B.dayOutcomes(S.c, d, hs);
  const block = new Array(S.c.length).fill(null); let bid = 0; for (let i = 0; i < d.length; i++) { if (d[i] == null) continue; if (i > 0 && d[i - 1] != null && (d[i] < 0) !== (d[i - 1] < 0)) bid++; block[i] = `${sym}:${bid}`; }
  // the arithmetic-keeping null: for every day below the 200-day, 20 random futures from the instrument's own return blocks
  const lr = []; for (let i = 1; i < S.c.length; i++) if (S.c[i] > 0 && S.c[i - 1] > 0) lr.push(Math.log(S.c[i] / S.c[i - 1]));
  const sim = new Array(S.c.length).fill(null);
  for (let i = 0; i < S.c.length; i++) if (d[i] != null && d[i] < 0 && p[i] != null) sim[i] = B.simulateReclaim(S.c, i, lr, { reps: 20, block: 20, maxSteps: 1500, R: simR });
  return (symData[sym] = { S, d, p, O, block, sim });
}
const OUTCOMES = [["toNextHigh", "all"], ["fallBeforeHigh", "all"], ["barsToHigh", "all"], ["furtherFall", "below"], ["toReclaim", "below"]];
const per = {};
function rowsOf(sym, g) {
  const D = prep(sym); if (!D) return null; const { S, d, p, O, block, sim } = D, f = FILTER[g], all = [], below = [];
  for (let i = 0; i < S.c.length; i++) { const o = O[i]; if (!o || p[i] == null) continue; if (f && !f(sym, S.dates[i])) continue; const r = { i, x: p[i], o, ep: block[i], sim: sim[i] }; all.push(r); if (d[i] < 0) below.push(r); }
  return { all, below };
}
// censored stretches (still below at the end of the data) enter the medians as lower bounds through a Kaplan–Meier
// median; the rank link (ρ) and its rotation test use the finished stretches only
const kmOf = (key) => key === "toReclaim" ? (r) => ({ t: r.o.censored ? r.o.toReclaimLB : r.o.toReclaim, ev: !r.o.censored }) : (r) => ({ t: -(r.o.censored ? r.o.furtherFallLB : r.o.furtherFall), ev: !r.o.censored });
const sign = (key) => key === "furtherFall" ? -1 : 1;
function part2For(g, syms) {
  const res = {};
  for (const [key, set] of OUTCOMES) {
    const groups = [], items = [], km = set === "below", ex = [], simItems = [];
    let cens = 0;
    for (const s of syms) {
      const R = rowsOf(s, g); if (!R) continue; const rows = R[set];
      const fin = rows.filter((r) => r.o[key] != null && Number.isFinite(r.o[key]));
      if (fin.length >= 30) groups.push({ x: fin.map((r) => r.x), y: fin.map((r) => r.o[key]) });
      if (km) {
        for (const r of rows) { const k = kmOf(key)(r); if (k.t == null) continue; if (!k.ev) cens++; items.push({ x: r.x, ...k, ep: r.ep }); }
        // simulated: per day, its 20 futures (each a KM item: censored at 1500 sessions); excess = actual − the day's simulated median
        const exG = { x: [], y: [] };
        for (const r of rows) {
          if (!r.sim?.length) continue;
          const sk = r.sim.map((z) => key === "toReclaim" ? { t: z.toReclaim, ev: !z.censored } : { t: -z.furtherFall, ev: !z.censored });
          for (const z of sk) simItems.push({ x: r.x, ...z, ep: r.ep });
          if (r.o[key] != null) { const m = B.kmMedian(sk); if (m != null) { exG.x.push(r.x); exG.y.push(sign(key) * r.o[key] - m); } }
        }
        if (exG.x.length >= 30) ex.push(exG);
      } else for (const r of fin) items.push({ x: r.x, y: r.o[key], ep: r.ep });
    }
    const t = B.shiftTest(groups, 400, 17), kmStat = (its) => B.kmMedian(its), sg = sign(key);
    const bins = B.binnedBootstrap(items, { w: 5, reps: 150, seed: 23, stat: km ? kmStat : null });
    const fix = (v) => v == null ? null : r2(km ? sg * v : v);
    const allMed = km ? B.kmMedian(items) : B.med(items.map((x) => x.y));
    const out = { rho: r2(t.rho), p: r2(t.p), nullLo: r2(t.nullLo), nullHi: r2(t.nullHi), n: t.n, censored: cens, all: fix(allMed),
      bins: bins.filter((b) => b.n > 0).map((b) => { const lo = fix(b.bandLo), hi = fix(b.bandHi); return { lo: b.lo, hi: b.hi, n: b.n, med: fix(b.med), bandLo: lo == null || hi == null ? lo : Math.min(lo, hi), bandHi: lo == null || hi == null ? hi : Math.max(lo, hi) }; }) };
    if (km) {
      const sb = B.binnedBootstrap(simItems, { w: 5, reps: 1, seed: 29, stat: kmStat });
      out.sim = { all: fix(B.kmMedian(simItems)), bins: sb.filter((b) => b.n > 0).map((b) => ({ lo: b.lo, hi: b.hi, n: b.n, med: fix(b.med) })) };
      const te = B.shiftTest(ex, 400, 19);  // does depth still predict MORE than the random walk from the same spot?
      out.excess = { rho: r2(te.rho), p: r2(te.p), nullLo: r2(te.nullLo), nullHi: r2(te.nullHi), n: te.n, med: r2(B.med(ex.flatMap((e) => e.y))) };
    }
    res[key] = out;
  }
  return res;
}
log("part 2");
for (const [g, syms] of Object.entries(GROUPS)) for (const sym of syms) {
  if (per[sym]) { per[sym].groups.push(g); continue; }
  const D = prep(sym); if (!D) { per[sym] = { missing: true, groups: [g] }; continue; }
  const { S, d, p, O } = D, below = O.filter((o, i) => o && p[i] != null && d[i] < 0), dd = d.filter((x) => x != null), mn = Math.min(...dd);
  per[sym] = { groups: [g], from: S.dates[0], to: S.dates.at(-1), days: O.filter((o, i) => o && p[i] != null).length, belowDays: below.length, belowStretches: B.belowEpisodes(d).length, cleaned: S.cleaned,
    now: { d: r2(d.at(-1)), pct: r1(p.at(-1)) }, censored: below.filter((o) => o.censored).length, deepest: r2(mn), deepestDate: S.dates[d.indexOf(mn)], memberYears: memberYears[sym] ?? null,
    fault: FAULTS[sym] ?? null, patched: PATCHED[sym] ?? null };
}
const part2 = { per, groups: {}, pit: { years: pitTop, capNotes, capFrom: "2006-11-08", candidates: Object.keys(capHist).length } };
const POOL = [...GROUPS.indexes, ...GROUPS.sectors, ...GROUPS.stocks];
FILTER.pooled = (sym, date) => GROUPS.stocks.includes(sym) ? FILTER.stocks(sym, date) : true;  // stocks keep their point-in-time filter
for (const [g, syms] of Object.entries({ ...GROUPS, pooled: [...new Set(POOL)] })) { log("part 2 group", g); part2.groups[g] = part2For(g, syms.filter((s) => !per[s]?.missing)); }

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
  pivotLen: PIVOT_LEN, sources: SOURCES, faults: FAULTS, patched: PATCHED, caps, part1, part2, part3 };
fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(out));
log("wrote", OUT, (fs.statSync(OUT).size / 1e6).toFixed(1), "MB");
for (const s of ["SPY", "QQQ", "IWM"]) { const P = part1[s]; log(s, P.nLows, "lows,", P.nDeep, "after 10%+; VIX turned before/same/after/none:", JSON.stringify(P.summary.all.turns.vix)); }
