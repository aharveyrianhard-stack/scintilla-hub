/* PULLBACK PLAYBOOK (N1 · 28 Sep) · the run.  node research/statistics/pullback-playbook/run.mjs [--out FILE] [--reps N] [--quick]
   Reads ONLY the durable local caches and three small copies of the Hub's own public tables (no network, no key):
     ~/Library/Application Support/scintilla/stats-cache/{daily-bars-rsi,daily-bars-s9,candles-f5,daily-bars-s7,regime-20260928,sector-rotation-20260928,leaders-fmp-20260928}
     research/statistics/data/pullback-playbook-20260928/{sigma_day_counts,pce_calendar,mu_call_dates}.json
   and the studies it builds on: deliverables/20260928/{sector-rotation,statistician-2,leaders}/…json.
   Writes one JSON for the page and the charts. Research, not advice. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import * as L from "./lib.mjs";
import * as X from "../statistician-2/lib.mjs";
import { cleanBars } from "../s9-research.mjs";
import { segment } from "../ladder.mjs";
import { trimAtFaults, topByYear } from "../bottoms/bottoms-lib.mjs";
import { geigerHistory, bowTie } from "../sector-rotation/lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../..");
const args = process.argv.slice(2), opt = (k, d = null) => args.includes(k) ? args[args.indexOf(k) + 1] : d, QUICK = args.includes("--quick");
const OUT = opt("--out", path.join(ROOT, "deliverables/20260928/pullback-playbook/data/pullback-playbook.json"));
const REPS = +opt("--reps", QUICK ? 100 : 400);
const LIB = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const DATA = path.join(ROOT, "research/statistics/data/pullback-playbook-20260928");
const fin = L.fin, r1 = L.r1, r2 = L.r2, dstr = X.dstr, log = (s) => process.stderr.write(s + "\n");
const t0 = Date.now();

/* ------------------------------------------------ loaders (the statistician-2 rules) ------------------------------------------------ */
const DIRS = ["daily-bars-rsi", "daily-bars-s9", "sector-rotation-20260928", "candles-f5", "daily-bars-s7", "regime-20260928/chart"];
const SOURCES = {};
function loadApi(sym) {
  let best = null;
  for (const d of DIRS) { const f = path.join(LIB, d, sym + ".json"); if (!fs.existsSync(f)) continue; let j; try { j = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; }
    const bars = (j.series ?? j).filter((b) => fin(+b.c) && +b.c > 0); if (!best || bars.length > best.bars.length) best = { bars, src: `chart API cache ${d}/${sym}.json` }; }
  return best;
}
let FMPI = null; function loadFmpIndex(sym) { FMPI ??= JSON.parse(fs.readFileSync(path.join(LIB, "daily-bars-rsi/fmp-indexes.json"), "utf8")); const rows = FMPI[sym]; if (!rows?.length) return null; return { bars: rows.map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v })), src: `FMP index history pulled inside Fly (daily-bars-rsi/fmp-indexes.json · ${sym})` }; }
let FMPE = null; function loadFmpEod(sym) {
  FMPE ??= ["fmp-eod.json", "fmp-eod2.json"].flatMap((f) => { const p = path.join(LIB, "regime-20260928", f); return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : []; });
  const rows = FMPE.filter((c) => c.symbol === sym && Array.isArray(c.rows)).flatMap((c) => c.rows); if (!rows.length) return null;
  const seen = new Set(), bars = []; for (const [d, o, h, l, c, v] of rows.sort((a, b) => (a[0] < b[0] ? -1 : 1))) { if (seen.has(d)) continue; seen.add(d); bars.push({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v }); }
  return { bars, src: `FMP EOD pulled inside Fly (regime-20260928/fmp-eod*.json · ${sym})` };
}
const isWeekend = (b) => { const d = new Date(b.t).getUTCDay(); return d === 0 || d === 6; };
function prep(raw, { faults = false, start = null, name = "" } = {}) {
  if (!raw) return null; let bars = raw.bars.map((b) => ({ t: +b.t, o: +(b.o ?? b.c), h: +(b.h ?? b.c), l: +(b.l ?? b.c), c: +b.c, v: +(b.v ?? 0) })).filter((b) => !isWeekend(b));
  if (start) bars = bars.filter((b) => dstr(b.t) >= start);
  bars = cleanBars(bars, 0.25).bars; bars = segment(bars).bars; let cut = 0;
  if (faults) { const t = trimAtFaults(bars.map((b) => ({ ...b, d: dstr(b.t) }))); bars = t.bars; cut = t.dropped; }
  if (bars.length < 300) return null;
  const c = bars.map((b) => b.c), dates = bars.map((b) => dstr(b.t));
  SOURCES[name] = { src: raw.src, from: dates[0], to: dates.at(-1), bars: dates.length, faultCut: cut };
  return { name, bars, dates, c, h: bars.map((b) => b.h), l: bars.map((b) => b.l), idx: new Map(dates.map((d, i) => [d, i])), byDate: new Map(dates.map((d, i) => [d, c[i]])) };
}
const cache = {}; const inst = (sym, o = {}) => (sym in cache ? cache[sym] : (cache[sym] = prep(sym.startsWith("^") ? (loadFmpIndex(sym) || loadFmpEod(sym)) : loadApi(sym), { ...o, name: sym })));
const readJ = (p) => JSON.parse(fs.readFileSync(p, "utf8"));
const sectorRotation = readJ(path.join(ROOT, "deliverables/20260928/sector-rotation/sector-rotation.json"));
const stat2 = readJ(path.join(ROOT, "deliverables/20260928/statistician-2/data/statistician-2.json"));
const leadersConc = readJ(path.join(ROOT, "deliverables/20260928/leaders/leaders-concentration.json"));
const regime = readJ(path.join(ROOT, "research/statistics/data/regime-20260928.json"));
const tree = readJ(path.join(ROOT, "data/standard-tree-20260924.json"));
const sigmaRows = readJ(path.join(DATA, "sigma_day_counts.json"));
const pceCal = readJ(path.join(DATA, "pce_calendar.json")), muDates = readJ(path.join(DATA, "mu_call_dates.json")).dates;
const live = fs.existsSync(path.join(DATA, "live-20260928.json")) ? readJ(path.join(DATA, "live-20260928.json")) : null;

const SPY = inst("SPY"), QQQ = inst("QQQ"), IWM = inst("IWM"), RSP = inst("RSP"), VIX = inst("VIX"), PCC = inst("PCC"), GSPC = inst("^GSPC"), NDX = inst("^NDX"), VIX3M = inst("^VIX3M");
const asOf = SPY.dates.at(-1); log(`bars to ${asOf}; SPY ${SPY.dates[0]}→, QQQ ${QQQ.dates[0]}→, ^GSPC ${GSPC.dates[0]}→, VIX ${VIX.dates[0]}→, PCC ${PCC?.dates[0]}→, VIX3M ${VIX3M?.dates[0] ?? "—"}`);
const J = { generated: new Date().toISOString(), asOf, reps: REPS, kind: "PULLBACK PLAYBOOK · N1 · where this pullback is, the bow tie, a narrowness gauge, a tranche back-test, and Wednesday. Research, not advice.", sources: SOURCES, live, s1: {}, s2: {}, s3: {}, s4: {}, s5: {} };
const at = (I, d) => I.idx.get(d);
const spyAt = (d) => at(SPY, d);

/* ================================ leaders basket (each year's top 20 at the time, equal weight) ================================ */
log("leaders basket");
const CAPDIR = path.join(LIB, "leaders-fmp-20260928/caps"), capHist = {};
for (const f of fs.readdirSync(CAPDIR)) if (f.endsWith(".json")) capHist[f.slice(0, -5)] = readJ(path.join(CAPDIR, f)).sort((a, b) => (a.date < b.date ? -1 : 1));
// --pit-leaders <file> (N9): the members and closes come from the point-in-time universe instead (every S&P member of
// the day, not the survivor cap files); without the flag this block runs exactly as before.
const PIT_LEADERS = opt("--pit-leaders"), PITL = PIT_LEADERS ? readJ(PIT_LEADERS) : null;
const YEARS = Array.from({ length: 2026 - 2007 + 1 }, (_, i) => 2007 + i), pitTop = PITL ? PITL.top : topByYear(capHist, YEARS, 20);
const leaderSyms = [...new Set(Object.values(pitTop).flat())], LEADC = {};
const patch = path.join(LIB, "leaders-fmp-20260928/bars-patch/META-pre-20220609.json");
if (PITL) for (const s of leaderSyms) { const rows = PITL.closes[s]; if (!rows) continue; const I = prep({ bars: rows.map(([d, o, h, l, c, v]) => ({ t: Date.parse(d + "T00:00:00Z"), o, h, l, c, v })), src: "point-in-time bars (N9)" }, { name: s }); if (I) LEADC[s] = I.byDate; }
for (const s of PITL ? [] : leaderSyms) { let raw = loadApi(s); if (!raw) continue;
  if (s === "META" && fs.existsSync(patch)) { const P = readJ(patch); const rows = (P.series ?? P.bars ?? P).map((b) => (b.t != null ? b : { t: Date.parse(b.date + "T00:00:00Z"), o: b.open, h: b.high, l: b.low, c: b.close, v: b.volume })); raw = { bars: [...rows.filter((b) => dstr(b.t) < "2022-06-09"), ...raw.bars.filter((b) => dstr(b.t) >= "2022-06-09")], src: raw.src + " + FMP FB-era patch" }; }
  const I = prep(raw, { faults: true, name: s }); if (I) LEADC[s] = I.byDate; }
const SPYd = SPY.dates.filter((d) => d >= "2007-01-01");
const basketRets = X.basketReturns(SPYd, pitTop, LEADC), basketLevel = X.chain(basketRets.map((b) => b.ret));
const LEAD = { name: "LEADERS", dates: SPYd, c: basketLevel, h: basketLevel, l: basketLevel, bars: SPYd.map((d, i) => ({ t: Date.parse(d + "T00:00:00Z"), o: basketLevel[i], h: basketLevel[i], l: basketLevel[i], c: basketLevel[i], v: 0 })), idx: new Map(SPYd.map((d, i) => [d, i])), byDate: new Map(SPYd.map((d, i) => [d, basketLevel[i]])) };
SOURCES.LEADERS = PITL ? { src: "equal-weight basket of each year's 20 largest S&P 500 members by full market cap on the prior year's last session — point-in-time (N9), repaired closes", from: SPYd[0], to: SPYd.at(-1), bars: SPYd.length, members: leaderSyms.length, thisYear: pitTop[2026] } : { src: "equal-weight basket of each year's top-20 S&P names by market cap on 1 Jan (FMP caps, leaders lane), members rebalanced each calendar year; closes from the chart API cache", from: SPYd[0], to: SPYd.at(-1), bars: SPYd.length, members: leaderSyms.length, thisYear: pitTop[2026] };

/* ================================ S1 · where this pullback is ================================ */
log("S1 depth");
const s1 = J.s1;
const depthRow = (I, look = 252) => { const dd = L.depthFromHigh(I.c, look); const i = I.c.length - 1; let hiIdx = i; for (let k = i; k >= Math.max(0, i - look + 1); k--) if (I.c[k] >= I.c[hiIdx]) hiIdx = k; const past = dd.filter(fin); return { d: I.dates[i], close: r2(I.c[i]), high: r2(I.c[hiIdx]), highDate: I.dates[hiIdx], sessionsSinceHigh: i - hiIdx, depth: r2(dd[i]), depthPctOfDays: r1(L.pctRank(past.slice().sort((a, b) => a - b), dd[i])) }; };
s1.depth = {}; for (const [k, I] of [["SPY", SPY], ["QQQ", QQQ], ["IWM", IWM], ["RSP", RSP], ["LEADERS", LEAD]]) s1.depth[k] = depthRow(I);
if (live) for (const k of ["SPY", "QQQ", "IWM", "RSP"]) if (live.quotes?.[k]?.price && s1.depth[k]) { const q = live.quotes[k]; s1.depth[k].live = { price: q.price, at: q.price_observation_utc, depthLive: r2(100 * (q.price / Math.max(s1.depth[k].high, q.price) - 1)), dayPct: r2(100 * (q.price / q.previous_close - 1)) }; }

/* breadth over the cache names (364 served names; the survivors of today's list, so the early years overstate breadth) */
log("S1 breadth");
const names = Object.keys(tree.names), capOf = (s) => tree.names[s]?.cap ?? null, sectorOf = (s) => tree.names[s]?.gics_sector ?? null;
const capTranche = (cap) => (cap == null ? null : cap >= 5e11 ? "Mega (≥ $500bn)" : cap >= 1e11 ? "Large ($100–500bn)" : cap >= 1e10 ? "Mid ($10–100bn)" : "Small (< $10bn)");
const stock = {}; for (const s of names) { const I = inst(s, { faults: true }); if (I) stock[s] = I; }
const DATES = SPY.dates.filter((d) => d >= "2007-01-01"), a50Hist = [], a200Hist = [];
{ const s50 = {}, s200 = {}; for (const [s, I] of Object.entries(stock)) { const { sma } = await import("../stats.mjs"); s50[s] = sma(I.c, 50); s200[s] = sma(I.c, 200); }
  for (const d of DATES) { let n = 0, a = 0, b = 0, n2 = 0; for (const [s, I] of Object.entries(stock)) { const i = I.idx.get(d); if (i == null) continue; if (fin(s50[s][i])) { n++; if (I.c[i] > s50[s][i]) a++; } if (fin(s200[s][i])) { n2++; if (I.c[i] > s200[s][i]) b++; } } a50Hist.push(n >= 100 ? 100 * a / n : null); a200Hist.push(n2 >= 100 ? 100 * b / n2 : null); }
  const last = DATES.length - 1, bySector = {}, byCap = {};
  for (const [s, I] of Object.entries(stock)) { const i = I.idx.get(asOf); if (i == null || !fin(s50[s][i])) continue; const sec = sectorOf(s) || "—", tr = capTranche(capOf(s)) || "—"; (bySector[sec] ??= { n: 0, a50: 0, a200: 0 }); (byCap[tr] ??= { n: 0, a50: 0, a200: 0 }); for (const g of [bySector[sec], byCap[tr]]) { g.n++; if (I.c[i] > s50[s][i]) g.a50++; if (fin(s200[s][i]) && I.c[i] > s200[s][i]) g.a200++; } }
  const fmt = (g) => Object.fromEntries(Object.entries(g).map(([k, v]) => [k, { n: v.n, a50: r1(100 * v.a50 / v.n), a200: r1(100 * v.a200 / v.n) }]));
  const hist = a50Hist.filter(fin).sort((a, b) => a - b);
  s1.breadth = { d: asOf, names: Object.keys(stock).length, a50: r1(a50Hist[last]), a200: r1(a200Hist[last]), a50Pct: r1(L.pctRank(hist, a50Hist[last])), bySector: fmt(bySector), byCap: fmt(byCap), history: DATES.map((d, i) => [d, r1(a50Hist[i]), r1(a200Hist[i])]).filter((_, i) => i % 5 === 0 || i === last), hubSnapshot: "data/breadth/latest.json is the Hub's own 23 Sep reading (36.8% above the 50-day of 364 names); the B1 whole-market table (breadth_daily) is on a candidate branch, not on live, so it is not read here" };
}

/* VIX, its fan, the ratio; put/call 5-day; RSI */
log("S1 vix pcc rsi");
{ const fan = L.fanAtClose(VIX.bars), i = VIX.c.length - 1, pos = L.fanPosition(fan, i, VIX.c[i]);
  const vixPctAll = L.pctRank(VIX.c.slice(0, i).slice().sort((a, b) => a - b), VIX.c[i]);
  const lines = Object.fromEntries(L.FAN_KEYS.map((k) => [k, r2(fan[k][i])]));
  const liveV = live?.vix ?? null; const posLive = liveV ? L.fanPosition(fan, i, liveV.price) : null;
  const ratio = VIX3M ? (() => { const j = VIX3M.idx.get(asOf); return j != null ? VIX.c[i] / VIX3M.c[j] : null; })() : null;
  s1.vix = { d: asOf, close: r2(VIX.c[i]), pctAll: r1(vixPctAll), from: VIX.dates[0], lines, linesBelow: pos.below, linesAbove: pos.above, nextAbove: pos.nextAbove, nextBelow: pos.nextBelow, live: liveV ? { price: liveV.price, at: liveV.at, linesBelow: posLive.below, linesAbove: posLive.above, pctAll: r1(L.pctRank(VIX.c.slice(0, i + 1).slice().sort((a, b) => a - b), liveV.price)) } : null,
    ratio: ratio != null ? r2(ratio) : null, ratioFromRegime: regime.vix?.now ?? null, ema21: r2(fan.e21[i]), sma50: r2(fan.s50[i]), sma200: r2(fan.s200[i]) };
  // put/call 5-day average vs its own history (all prior 5-day averages)
  const p = PCC.c, k = p.length - 1, avg5 = p.slice(k - 4, k + 1).reduce((s, x) => s + x, 0) / 5, hist5 = []; for (let m = 4; m < k; m++) hist5.push(p.slice(m - 4, m + 1).reduce((s, x) => s + x, 0) / 5);
  s1.pcc = { d: PCC.dates.at(-1), from: PCC.dates[0], last: r2(p[k]), avg5: r2(avg5), avg5Pct: r1(L.pctRank(hist5.slice().sort((a, b) => a - b), avg5)), lastPct: r1(L.pctRank(p.slice(0, k).slice().sort((a, b) => a - b), p[k])), last5: PCC.dates.slice(-5).map((d, j) => [d, p[k - 4 + j]]), levels: Object.fromEntries([50, 75, 90, 95, 99].map((q) => [q, r2(X.quantile(hist5, q / 100))])), note: "Cboe prints one total put/call per session after the close; today's is not known until tonight" };
  s1.rsi = {}; for (const [nm, I] of [["SPY", SPY], ["QQQ", QQQ], ["IWM", IWM], ["RSP", RSP]]) { const rsi = L.rsi14(I.c), j = I.c.length - 1, prior = rsi.slice(0, j).filter(fin).sort((a, b) => a - b); s1.rsi[nm] = { rsi: r1(rsi[j]), pctAll: r1(L.pctRank(prior, rsi[j])), pct3y: r1(L.pctRank(rsi.slice(Math.max(0, j - 756), j).filter(fin).sort((a, b) => a - b), rsi[j])), from: I.dates[0] }; }
}

/* USUAL DAY sigma counts: the stored history (2003 →) plus today's live read (0 up / 20 down, Alan's note; the detector's own store) */
log("S1 sigma");
{ const rows = sigmaRows.filter((r) => r.names_measured >= 100).map((r) => ({ d: r.date, m: r.names_measured, n: r.n, up: r.up, dn: r.dn, net: 100 * (r.up - r.dn) / r.names_measured, dnShare: 100 * r.dn / r.names_measured, upShare: 100 * r.up / r.names_measured }));
  const todayLive = { d: "2026-09-28", up: 0, dn: 20, m: 486, source: "the live detector's store as Alan read it at ~13:30 ET (public.scintillas); the session is not over" };
  todayLive.net = 100 * (todayLive.up - todayLive.dn) / todayLive.m; todayLive.dnShare = 100 * todayLive.dn / todayLive.m;
  const nets = rows.map((r) => r.net).sort((a, b) => a - b), dns = rows.map((r) => r.dnShare).sort((a, b) => a - b);
  const zeroUp = rows.filter((r) => r.up === 0 && r.dn >= 1), zeroUp20 = rows.filter((r) => r.up === 0 && r.dnShare >= todayLive.dnShare);
  // what SPY did after days at least as one-sided as today (net ≤ today's), clustered by 20-session gaps
  const idxOf = rows.map((r) => spyAt(r.d)), fwd = (h) => rows.map((r, j) => (idxOf[j] != null ? L.fwd(SPY.c, idxOf[j], h) : null));
  const F = { 5: fwd(5), 21: fwd(21), 63: fwd(63) }, dd = rows.map((r, j) => (idxOf[j] != null ? L.maxDrawdownAhead(SPY.c, idxOf[j], 21) : null));
  const sel = rows.map((r) => r.net <= todayLive.net), picks = []; let lastPick = -1e9; rows.forEach((r, j) => { if (sel[j] && j - lastPick >= 20) { picks.push(j); lastPick = j; } });
  const summ = (js, arr) => { const xs = js.map((j) => arr[j]).filter(fin); return xs.length ? { n: xs.length, med: r2(X.median(xs)), mean: r2(X.mean(xs)), up: r1(100 * xs.filter((x) => x > 0).length / xs.length), q10: r2(X.quantile(xs, 0.1)), q90: r2(X.quantile(xs, 0.9)) } : null; };
  const allJ = rows.map((_, j) => j);
  const like = {}; for (const h of [5, 21, 63]) { const a = summ(picks, F[h]), b = summ(allJ, F[h]); const bb = X.blockBootstrap(picks.map((j) => F[h][j]).filter(fin), (xs) => X.mean(xs), { reps: REPS, seed: 11, block: Math.max(2, Math.ceil(h / 20)), base: b?.mean ?? 0 }); like[h] = { like: a, all: b, diff: r2((a?.mean ?? 0) - (b?.mean ?? 0)), lo: r2(bb.lo - (b?.mean ?? 0)), hi: r2(bb.hi - (b?.mean ?? 0)), p: r2(bb.p) }; }
  like.dd21 = { like: summ(picks, dd), all: summ(allJ, dd) };
  s1.sigma = { from: rows[0].d, to: rows.at(-1).d, sessions: rows.length, today: todayLive, todayNetPct: r1(L.pctRank(nets, todayLive.net)), todayDnPct: r1(L.pctRank(dns, todayLive.dnShare)), zeroUpDays: zeroUp.length, zeroUpAndAsManyDown: zeroUp20.length, zeroUpAndAsManyDownDates: zeroUp20.slice(-12).map((r) => [r.d, r.dn, r.m]), last10: rows.slice(-10).map((r) => [r.d, r.up, r.dn, r.m]), likeToday: like, picks: picks.length, deciles: L.decileTable(rows.map((r) => r.net), { f21: F[21], f63: F[63] }), series: rows.filter((_, j) => j % 3 === 0).map((r) => [r.d, r1(r.net)]) };
}
s1.bowtie = { cited: "deliverables/20260928/sector-rotation/sector-rotation.json · geiger.today", today: sectorRotation.geiger.today, quantiles: sectorRotation.geiger.wingQuantiles };
s1.yieldsUp = { cited: "statistician-2 q6 (yields-up / dollar-up pullbacks)", today: stat2.q6.today, spy: stat2.q6.instruments.SPY, gspc: stat2.q6.instruments.GSPC, leaders: stat2.q6.instruments.LEADERS };

/* the conditional depth ladder: given the pullback reached x, what was the final depth and how long to the low */
log("S1 ladder");
{ const { sma } = await import("../stats.mjs"); const out = {}; for (const [nm, I] of [["^GSPC", GSPC], ["SPY", SPY], ["QQQ", QQQ], ["^NDX", NDX]]) { const eps = L.pullbackEpisodes(I.c), s200 = sma(I.c, 200);
    const curveOf = (list) => { const cd = L.conditionalDepth(list); for (const row of cd) { const s = L.sessionsToLowFrom(list, I.c, row.x); row.toLowMed = s.length ? Math.round(X.median(s)) : null; row.toLowQ = s.length ? [25, 75].map((p) => Math.round(X.quantile(s, p / 100))) : null; } return cd; };
    // the state WHEN x was reached: was the close still above the 200-day at the first bar at or under x? (a pullback always starts above a rising 200-day, so the state at the high is no split at all)
    const reachIdx = (e, x) => { for (let i = e.highIdx + 1; i <= e.lowIdx; i++) if (100 * (I.c[i] / e.high - 1) <= -x) return i; return -1; };
    const byReach = {}; for (const x of [2, 3, 5, 8, 10]) { const above = [], below = []; for (const e of eps) { if (e.censored) continue; const i = reachIdx(e, x); if (i < 0 || !fin(s200[i])) continue; (I.c[i] > s200[i] ? above : below).push(e); } const row = (list) => { const cd = L.conditionalDepth(list, [x])[0]; const s = L.sessionsToLowFrom(list, I.c, x); return { ...cd, toLowMed: s.length ? Math.round(X.median(s)) : null }; }; byReach[x] = { above200: row(above), below200: row(below) }; }
    const cur = eps.at(-1), curI = cur ? cur.lowIdx : -1;
    out[nm] = { from: I.dates[0], episodes: eps.filter((e) => !e.censored).length, open: eps.filter((e) => e.censored).length, curve: curveOf(eps), byReach, current: cur && cur.censored ? { start: I.dates[cur.highIdx], depth: r2(cur.depth), lowDate: I.dates[cur.lowIdx], sessions: cur.length, above200AtLow: fin(s200[curI]) ? I.c[curI] > s200[curI] : null, above200Now: fin(s200.at(-1)) ? I.c.at(-1) > s200.at(-1) : null } : null }; }
  s1.ladder = out; }

/* the analogs: nearest days across seven percentile gauges */
log("S1 analogs");
{ const spyDD = L.depthFromHigh(SPY.c), spyRsi = L.rsi14(SPY.c), spyRsiPct = L.ownPct(spyRsi, 250);
  const vixPctS = L.ownPct(VIX.c, 250), pccAvg5 = PCC.c.map((_, i) => (i >= 4 ? PCC.c.slice(i - 4, i + 1).reduce((s, x) => s + x, 0) / 5 : null)), pccPct = L.ownPct(pccAvg5, 250);
  const wingWeekly = sectorRotation.geiger.wingSeries; // [date, wing, spread, ...] weekly
  const wingByDate = new Map(wingWeekly.map((w) => [w[0], w[1]]));
  const sig = new Map(sigmaRows.map((r) => [r.date, 100 * (r.up - r.dn) / r.names_measured]));
  const rows = []; let lastWing = null;
  const a50ByDate = new Map(DATES.map((d, i) => [d, a50Hist[i]]));
  const wingVals = [], wingPctByDate = new Map(); for (const w of wingWeekly) { wingVals.push(w[1]); wingPctByDate.set(w[0], wingVals.length > 50 ? L.pctRank(wingVals.slice(0, -1).slice().sort((a, b) => a - b), w[1]) : null); }
  const sigVals = [], sigPct = new Map(); for (const r of sigmaRows) { const v = 100 * (r.up - r.dn) / r.names_measured; if (sigVals.length > 250) sigPct.set(r.date, L.pctRank(sigVals.slice().sort((a, b) => a - b), v)); sigVals.push(v); }
  const a50Vals = [], a50Pct = new Map(); for (const d of DATES) { const v = a50ByDate.get(d); if (fin(v)) { if (a50Vals.length > 250) a50Pct.set(d, L.pctRank(a50Vals.slice().sort((a, b) => a - b), v)); a50Vals.push(v); } }
  const ddVals = [], ddPct = new Map(); for (let i = 0; i < SPY.c.length; i++) { const v = spyDD[i]; if (fin(v)) { if (ddVals.length > 250) ddPct.set(SPY.dates[i], L.pctRank(ddVals.slice().sort((a, b) => a - b), v)); ddVals.push(v); } }
  for (let i = 0; i < SPY.c.length; i++) { const d = SPY.dates[i]; if (wingPctByDate.has(d)) lastWing = wingPctByDate.get(d); const vi = VIX.idx.get(d), pi = PCC.idx.get(d);
    rows.push({ i, d, depth: ddPct.get(d) ?? null, rsi: spyRsiPct[i], vix: vi != null ? vixPctS[vi] : null, pcc: pi != null ? pccPct[pi] : null, a50: a50Pct.get(d) ?? null, wing: lastWing, sigma: sigPct.get(d) ?? null }); }
  const KEYS = ["depth", "rsi", "vix", "pcc", "a50", "wing", "sigma"], today = rows.at(-1);
  // today's live gauges override where known now (VIX live, sigma live): the Friday row is the base
  const todayRow = { ...today }; if (live?.vix?.price) todayRow.vix = L.pctRank(VIX.c.slice().sort((a, b) => a - b), live.vix.price); todayRow.sigma = L.pctRank(sigVals.slice().sort((a, b) => a - b), 100 * (0 - 20) / 486);
  if (live?.quotes?.SPY?.price) { const hi = Math.max(...SPY.c.slice(-252)); todayRow.depth = L.pctRank(ddVals.slice().sort((a, b) => a - b), 100 * (live.quotes.SPY.price / hi - 1)); }
  const rsp = RSP, rspRel = (i, h) => { const a = L.fwd(RSP.c, RSP.idx.get(SPY.dates[i]), h), b = L.fwd(SPY.c, i, h); return fin(a) && fin(b) ? a - b : null; };
  const wingAfter = (i, h) => { const d0 = SPY.dates[i], d1 = SPY.dates[Math.min(i + h, SPY.dates.length - 1)]; const w0 = [...wingByDate.keys()].filter((d) => d <= d0).at(-1), w1 = [...wingByDate.keys()].filter((d) => d <= d1).at(-1); return w0 && w1 && w1 > w0 && i + h < SPY.dates.length ? wingByDate.get(w1) - wingByDate.get(w0) : null; };
  const variants = {}; for (const k of [10, 20, 40]) { const picks = L.nearestDays(rows, todayRow, KEYS, { k, gap: 40, minGauges: 5, before: SPY.c.length - 60 });
    const list = picks.map((p) => { const i = p.i; return { d: SPY.dates[i], dist: r1(p.d), gauges: Object.fromEntries(KEYS.map((key) => [key, r1(rows[i][key])])), depthThen: r2(spyDD[i]), moreDown60: r2(L.maxDrawdownAhead(SPY.c, i, 60)), sessionsToLow60: L.sessionsToLowAhead(SPY.c, i, 60), f21: r2(L.fwd(SPY.c, i, 21)), f63: r2(L.fwd(SPY.c, i, 63)), f126: r2(L.fwd(SPY.c, i, 126)), rspRel63: r2(rspRel(i, 63)), wing72: r2(wingAfter(i, 72)) }; });
    const agg = (key) => { const xs = list.map((x) => x[key]).filter(fin); return xs.length ? { n: xs.length, med: r2(X.median(xs)), mean: r2(X.mean(xs)), up: r1(100 * xs.filter((v) => v > 0).length / xs.length), q10: r2(X.quantile(xs, 0.1)), q90: r2(X.quantile(xs, 0.9)) } : null; };
    const base = {}; for (const [key, fn] of [["moreDown60", (i) => L.maxDrawdownAhead(SPY.c, i, 60)], ["f21", (i) => L.fwd(SPY.c, i, 21)], ["f63", (i) => L.fwd(SPY.c, i, 63)], ["f126", (i) => L.fwd(SPY.c, i, 126)], ["rspRel63", (i) => rspRel(i, 63)]]) { const xs = rows.map((r) => fn(r.i)).filter(fin); base[key] = { n: xs.length, med: r2(X.median(xs)), mean: r2(X.mean(xs)), up: r1(100 * xs.filter((v) => v > 0).length / xs.length) }; }
    const tests = {}; for (const key of ["moreDown60", "f63", "f126", "rspRel63"]) { const xs = list.map((x) => x[key]).filter(fin); if (xs.length >= 5) { const bb = X.episodeBootstrap(xs, (v) => X.mean(v), { reps: REPS, seed: 3, base: base[key].mean }); tests[key] = { diff: r2(X.mean(xs) - base[key].mean), lo: r2(bb.lo - base[key].mean), hi: r2(bb.hi - base[key].mean), p: r2(bb.p) }; } }
    variants[k] = { k, list, summary: Object.fromEntries(["depthThen", "moreDown60", "sessionsToLow60", "f21", "f63", "f126", "rspRel63", "wing72"].map((key) => [key, agg(key)])), base, tests }; }
  s1.analogs = { keys: KEYS, today: Object.fromEntries(KEYS.map((k) => [k, r1(todayRow[k])])), fridayRow: Object.fromEntries(KEYS.map((k) => [k, r1(today[k])])), variants, from: rows.find((r) => KEYS.filter((k) => fin(r[k])).length >= 5)?.d, note: "distance = root-mean-square of percentile differences across the gauges both days carry (at least five); picks at least 40 sessions apart; nothing from the last 60 sessions" }; }

/* ================================ S2 · the bow tie: how it rebalanced ================================ */
log("S2 bow tie (Geiger replay of the eleven SPDR sectors and the index funds)");
const SECT = ["XLK", "XLV", "XLC", "XLE", "XLF", "XLI", "XLP", "XLB", "XLRE", "XLY", "XLU"], IDXF = ["SPY", "QQQ", "IWM", "DIA", "MDY", "RSP", "VTI"];
const asofT = Date.parse("2026-09-28T04:00:00Z");
const G = {}; for (const s of [...SECT, ...IDXF]) { const I = inst(s); if (!I) continue; const bars = I.bars; const nextT = bars.map((b, i) => (i + 1 < bars.length ? bars[i + 1].t : asofT)); const gh = geigerHistory(bars, nextT); G[s] = { dates: I.dates, g: gh.map((r) => (r ? r.g : null)), full: gh.map((r) => !!(r && r.full)), byDate: new Map(I.dates.map((d, i) => [d, gh[i] ? gh[i].g : null])) }; }
log(`  replay done in ${((Date.now() - t0) / 1000) | 0}s`);
{ const days = SPY.dates.filter((d) => d >= "2007-07-06"), wingDaily = [], perDay = [];
  for (const d of days) { const vals = SECT.map((s) => G[s]?.byDate.get(d)).map((v) => (fin(v) ? v : null)); const bt = bowTie(vals.filter(fin)); wingDaily.push(bt ? bt.wing : null); perDay.push({ d, vals, bt }); }
  const wingPct = L.ownPct(wingDaily, 250);
  const H = [16, 38, 72, 126, 252];
  const rowsOut = perDay.map((p, j) => { const i = spyAt(p.d), row = { j, d: p.d, wing: p.bt ? p.bt.wing : null, spread: p.bt ? p.bt.spread : null, pct: wingPct[j] };
    if (!p.bt) return row; const order = SECT.map((s, k) => [s, p.vals[k]]).filter((x) => fin(x[1])).sort((a, b) => b[1] - a[1]); const green = order.filter((x) => x[1] > 0).map((x) => x[0]), red = order.filter((x) => x[1] <= 0).map((x) => x[0]);
    for (const h of H) { const jj = j + h; if (jj >= perDay.length) continue; const q = perDay[jj]; if (!q.bt) continue; row["dWing" + h] = q.bt.wing - p.bt.wing; const gv = green.map((s) => q.vals[SECT.indexOf(s)]).filter(fin), rv = red.map((s) => q.vals[SECT.indexOf(s)]).filter(fin), gv0 = green.map((s) => p.vals[SECT.indexOf(s)]).filter(fin), rv0 = red.map((s) => p.vals[SECT.indexOf(s)]).filter(fin);
      row["dGreen" + h] = gv.length && gv0.length ? X.mean(gv) - X.mean(gv0) : null; row["dRed" + h] = rv.length && rv0.length ? X.mean(rv) - X.mean(rv0) : null;
      const fr = (s) => { const I = inst(s); const a = I.idx.get(p.d), b = I.idx.get(q.d); return a != null && b != null ? 100 * (I.c[b] / I.c[a] - 1) : null; }; const g3 = order.slice(0, 3).map((x) => fr(x[0])).filter(fin), b3 = order.slice(-3).map((x) => fr(x[0])).filter(fin);
      row["topMinusBottom" + h] = g3.length && b3.length ? X.mean(g3) - X.mean(b3) : null; row["spy" + h] = fr("SPY"); const rs = fr("RSP"); row["rspMinusSpy" + h] = fin(rs) && fin(row["spy" + h]) ? rs - row["spy" + h] : null;
      const idxR = IDXF.map(fr).filter(fin); row["idxDisp" + h] = idxR.length >= 4 ? X.quantile(idxR, 0.75) - X.quantile(idxR, 0.25) : null; }
    return row; });
  const outcomes = {}; for (const h of H) for (const k of ["dWing", "dGreen", "dRed", "topMinusBottom", "spy", "rspMinusSpy", "idxDisp"]) outcomes[k + h] = rowsOut.map((r) => r[k + h] ?? null);
  const deciles = L.decileTable(rowsOut.map((r) => r.pct), outcomes);
  // the widest tenth: ranges against all days, with episode clustering (40 sessions)
  const top = rowsOut.filter((r) => fin(r.pct) && r.pct >= 90), picks = []; let last = -1e9; for (const r of top) if (r.j - last >= 40) { picks.push(r); last = r.j; }
  const wide = {}; for (const h of H) for (const k of ["dWing", "dGreen", "dRed", "topMinusBottom", "spy", "rspMinusSpy", "idxDisp"]) { const key = k + h, xs = picks.map((r) => r[key]).filter(fin), all = rowsOut.map((r) => r[key]).filter(fin); if (xs.length < 3) continue; const bb = X.episodeBootstrap(xs, (v) => X.mean(v), { reps: REPS, seed: 5, base: X.mean(all) }); wide[key] = { n: xs.length, med: r2(X.median(xs)), mean: r2(X.mean(xs)), up: r1(100 * xs.filter((v) => v > 0).length / xs.length), allMean: r2(X.mean(all)), allMed: r2(X.median(all)), diff: r2(X.mean(xs) - X.mean(all)), lo: r2(bb.lo - X.mean(all)), hi: r2(bb.hi - X.mean(all)), p: r2(bb.p) }; }
  const ps = Object.values(wide).map((w) => w.p), bh = X.benjaminiHochberg(ps, 0.1); Object.values(wide).forEach((w, k) => { w.pAdj = r2(bh.adjusted[k]); w.survives = bh.reject[k]; });
  // time for the wing to come back to its median, from each widest-tenth start (Kaplan–Meier)
  const medWing = X.median(wingDaily.filter(fin)); const km = X.kaplanMeier(picks.map((r) => { let t = null; for (let j = r.j + 1; j < perDay.length; j++) if (perDay[j].bt && perDay[j].bt.wing <= medWing) { t = j - r.j; break; } return t == null ? { t: perDay.length - 1 - r.j, ev: false } : { t, ev: true }; }));
  const todayJ = perDay.length - 1;
  J.s2.wing = { from: days[0], to: days.at(-1), n: rowsOut.filter((r) => fin(r.wing)).length, today: { wing: r2(wingDaily[todayJ]), pct: r1(wingPct[todayJ]), spread: r2(perDay[todayJ].bt?.spread), order: SECT.map((s, k) => [s, r2(perDay[todayJ].vals[k])]).sort((a, b) => b[1] - a[1]) }, medianWing: r2(medWing), series: rowsOut.filter((r, j) => j % 5 === 0 || j === todayJ).map((r) => [r.d, r2(r.wing), r1(r.pct)]), deciles, wide, widePicks: picks.map((r) => ({ d: r.d, wing: r2(r.wing), pct: r1(r.pct), dWing72: r2(r.dWing72), dGreen72: r2(r.dGreen72), dRed72: r2(r.dRed72), tmb72: r2(r.topMinusBottom72), spy72: r2(r.spy72), rspMinusSpy72: r2(r.rspMinusSpy72) })), backToMedian: { medianSessions: km.median, censored: km.censored, steps: km.steps.filter((_, k) => k % 2 === 0 || k === km.steps.length - 1) }, tests: Object.keys(wide).length, survivors: Object.values(wide).filter((w) => w.survives).length, replayNote: "the sector-rotation lane checked this replay against the live /geiger rung by rung (largest difference 0); the same lib.mjs is used here" };
  // index-fund Geiger range
  const idays = SPY.dates.filter((d) => d >= "2007-07-06"), ranges = [], perI = [];
  for (const d of idays) { const vals = IDXF.map((s) => G[s]?.byDate.get(d) ?? null); const ok = vals.filter(fin); ranges.push(ok.length >= 4 ? Math.max(...ok) - Math.min(...ok) : null); perI.push(vals); }
  const rPct = L.ownPct(ranges, 250), li = idays.length - 1;
  const fut = { spy63: idays.map((d) => L.fwd(SPY.c, spyAt(d), 63)), rspMinusSpy63: idays.map((d) => { const a = L.fwd(RSP.c, RSP.idx.get(d), 63), b = L.fwd(SPY.c, spyAt(d), 63); return fin(a) && fin(b) ? a - b : null; }) };
  J.s2.indexRange = { funds: IDXF, today: Object.fromEntries(IDXF.map((s, k) => [s, r2(perI[li][k])])), range: r2(ranges[li]), rangePct: r1(rPct[li]), from: idays[0], quantiles: Object.fromEntries([10, 25, 50, 75, 90, 95, 99].map((q) => [q, r2(X.quantile(ranges.filter(fin), q / 100))])), series: idays.map((d, j) => [d, r2(ranges[j])]).filter((_, j) => j % 5 === 0 || j === li), deciles: L.decileTable(ranges, fut), fundPct: Object.fromEntries(IDXF.map((s) => { const g = G[s]; if (!g) return [s, null]; const i = g.dates.length - 1, prior = g.g.slice(0, i).filter(fin).sort((a, b) => a - b); return [s, { g: r2(g.g[i]), pct: r1(L.pctRank(prior, g.g[i])) }]; })) };
}

/* ================================ S3 · the narrowness gauge ================================ */
log("S3 narrowness");
{ const days = SPY.dates.filter((d) => d >= "2007-07-06");
  const wingMap = new Map(J.s2.wing.series.map((r) => [r[0], r[2]])); // sampled; rebuild daily from s2 rows instead
  const wingDailyPct = new Map(); { const ws = J.s2.wing; /* recompute daily percentiles from the replay */ }
  // recompute daily components
  const wingVals = [], wingPctD = new Map(); for (const d of days) { const vals = SECT.map((s) => G[s]?.byDate.get(d)).filter(fin); const bt = bowTie(vals); if (bt) { if (wingVals.length > 250) wingPctD.set(d, L.pctRank(wingVals.slice().sort((a, b) => a - b), bt.wing)); wingVals.push(bt.wing); } }
  const rel63 = days.map((d) => { const i = spyAt(d), j = RSP.idx.get(d); if (i == null || j == null || i < 63 || j < 63) return null; return 100 * (Math.log(RSP.c[j] / RSP.c[j - 63]) - Math.log(SPY.c[i] / SPY.c[i - 63])); });
  const rel63Pct = L.ownPct(rel63, 250);
  const a50ByDate = new Map(DATES.map((d, i) => [d, a50Hist[i]])); const a50v = days.map((d) => a50ByDate.get(d) ?? null), a50p = L.ownPct(a50v, 250);
  const idxRangeMap = new Map(); { const rs = []; for (const d of days) { const vals = IDXF.map((s) => G[s]?.byDate.get(d)).filter(fin); const r = vals.length >= 4 ? Math.max(...vals) - Math.min(...vals) : null; if (fin(r)) { if (rs.length > 250) idxRangeMap.set(d, L.pctRank(rs.slice().sort((a, b) => a - b), r)); rs.push(r); } } }
  // cap-vs-equal pairs with daily history on the cache: QQQE/QQQ (2012 →), EQAL/IWB (2015 →) — the other five are on FMP in statistician-2, cited
  const pairRel = (ew, cw) => { const E = inst(ew), C = inst(cw); if (!E || !C) return null; const v = days.map((d) => { const i = E.idx.get(d), j = C.idx.get(d); return i != null && j != null && i >= 63 && j >= 63 ? 100 * (Math.log(E.c[i] / E.c[i - 63]) - Math.log(C.c[j] / C.c[j - 63])) : null; }); return L.ownPct(v, 250); };
  const qqqeP = pairRel("QQQE", "QQQ"), eqalP = pairRel("EQAL", "IWB");
  const comp = days.map((d, j) => { const parts = [wingPctD.get(d), fin(rel63Pct[j]) ? 100 - rel63Pct[j] : null, fin(a50p[j]) ? 100 - a50p[j] : null, idxRangeMap.get(d), qqqeP && fin(qqqeP[j]) ? 100 - qqqeP[j] : null, eqalP && fin(eqalP[j]) ? 100 - eqalP[j] : null].map((v) => (fin(v) ? v : null)); const ok = parts.filter(fin); return { d, parts, narrow: ok.length >= 3 ? X.mean(ok) : null, n: ok.length }; });
  const narrow = comp.map((c) => c.narrow), nPct = L.ownPct(narrow, 250), li = days.length - 1;
  const out = { spy63: days.map((d) => L.fwd(SPY.c, spyAt(d), 63)), spy126: days.map((d) => L.fwd(SPY.c, spyAt(d), 126)), rspMinusSpy63: days.map((d) => { const a = L.fwd(RSP.c, RSP.idx.get(d), 63), b = L.fwd(SPY.c, spyAt(d), 63); return fin(a) && fin(b) ? a - b : null; }), rspMinusSpy126: days.map((d) => { const a = L.fwd(RSP.c, RSP.idx.get(d), 126), b = L.fwd(SPY.c, spyAt(d), 126); return fin(a) && fin(b) ? a - b : null; }), leadersMinusSpy126: days.map((d) => { const a = L.fwd(LEAD.c, LEAD.idx.get(d), 126), b = L.fwd(SPY.c, spyAt(d), 126); return fin(a) && fin(b) ? a - b : null; }), dd63: days.map((d) => L.maxDrawdownAhead(SPY.c, spyAt(d), 63)) };
  const deciles = L.decileTable(narrow, out);
  // the top decile against all, clustered
  const topIdx = comp.map((c, j) => j).filter((j) => fin(nPct[j]) && nPct[j] >= 90), picks = []; let last = -1e9; for (const j of topIdx) if (j - last >= 40) { picks.push(j); last = j; }
  const tests = {}; for (const key of Object.keys(out)) { const xs = picks.map((j) => out[key][j]).filter(fin), all = out[key].filter(fin); if (xs.length < 3) continue; const bb = X.episodeBootstrap(xs, (v) => X.mean(v), { reps: REPS, seed: 9, base: X.mean(all) }); tests[key] = { n: xs.length, mean: r2(X.mean(xs)), med: r2(X.median(xs)), up: r1(100 * xs.filter((v) => v > 0).length / xs.length), allMean: r2(X.mean(all)), diff: r2(X.mean(xs) - X.mean(all)), lo: r2(bb.lo - X.mean(all)), hi: r2(bb.hi - X.mean(all)), p: r2(bb.p) }; }
  const bh = X.benjaminiHochberg(Object.values(tests).map((t) => t.p), 0.1); Object.values(tests).forEach((t, k) => { t.pAdj = r2(bh.adjusted[k]); t.survives = bh.reject[k]; });
  J.s3 = { components: ["bow-tie wing (own percentile)", "equal ÷ cap weight, 63-session change (inverted: low = narrow)", "% of served names above their 50-day (inverted)", "index-fund Geiger range (own percentile)", "QQQE ÷ QQQ 63-session change (inverted, from 2012)", "EQAL ÷ IWB 63-session change (inverted, from 2015)"], today: { d: days[li], parts: comp[li].parts.map(r1), narrow: r1(narrow[li]), pct: r1(nPct[li]), n: comp[li].n }, series: comp.map((c, j) => [c.d, r1(c.narrow), r1(nPct[j])]).filter((_, j) => j % 5 === 0 || j === li), deciles, top: tests, topPicks: picks.length, from: comp.find((c) => fin(c.narrow))?.d, seven: { cited: "statistician-2 q7.seven (level percentile, one-year change, stretch, what followed past extremes — rebalancing, not catch-up)", rows: stat2.q7.seven, sectors1y: stat2.q7.sectors1y, spx: stat2.q7.spx }, top10: { cited: "leaders-concentration.json", years: leadersConc.years.filter((y) => y.year >= 2020).map((y) => ({ year: y.year, share10: y.share?.["10"], share1: y.share?.["1"], partial: y.partial })) } };
}

/* ================================ S4 · the tranche playbook, back-tested ================================ */
log("S4 tranches");
{ const W = 60, HZ = [63, 126, 252], DEPTHS = QUICK ? [3, 5] : [2, 3, 4, 5, 7, 10];
  const vixPctAll = L.ownPct(VIX.c, 250);
  const study = (I, name) => {
    const fan = L.fanKnown(I.bars), pvs = L.pivots(I.h, I.l, 10), rsi = L.rsi14(I.c), rsiPct = L.ownPct(rsi, 250), ctx = { fan, pvs, rsiPct };
    const s200 = fan.s200, byDepth = {};
    for (const depth of DEPTHS) {
      const trig = L.triggers(I.c, depth).filter((t) => t >= 260 && t + 63 < I.c.length);
      const camps = trig.map((tt) => { const sets = L.rungSets(I.bars, tt, ctx); const vi = VIX.idx.get(I.dates[tt]); sets.state = L.stateSized(sets.fan, vi != null ? vixPctAll[vi] : null);
        const res = {}; for (const [k, rungs] of Object.entries(sets)) { const c = L.runCampaign(I.bars, tt, W, rungs); const dep = c.fills.filter((f) => !f.forced), depW = dep.reduce((s, f) => s + f.w, 0), depCost = depW > 0 ? depW / dep.reduce((s, f) => s + f.w / f.px, 0) : null;
          res[k] = { avgCost: c.avgCost, improvement: 100 * (I.c[tt] / c.avgCost - 1), tim: c.timeInMarket, forced: c.forcedShare, fullAt: c.fullAt, rungs: rungs.length, worst126: L.worstMarkToCost(I.bars, tt, 126, c.fills), ret: Object.fromEntries(HZ.map((h) => [h, L.campaignReturn(I.bars, tt, h, c.avgCost)])), depCost, depImprovement: depCost ? 100 * (I.c[tt] / depCost - 1) : null, depRet126: L.campaignReturn(I.bars, tt, 126, depCost), depShare: depW }; }
        const above200 = fin(s200[tt]) ? I.c[tt] > s200[tt] : null, slopeUp = fin(s200[tt]) && fin(s200[tt - 20]) ? s200[tt] > s200[tt - 20] : null;
        return { d: I.dates[tt], i: tt, depthAtTrigger: r2(L.depthFromHigh(I.c)[tt]), above200, slopeUp, vixPct: vi != null ? r1(vixPctAll[vi]) : null, res }; });
      const strategies = Object.keys(camps[0]?.res ?? {}), summ = {};
      const agg = (rows, key, f) => { const xs = rows.map(f).filter(fin); return xs.length ? { n: xs.length, med: r2(X.median(xs)), mean: r2(X.mean(xs)), q10: r2(X.quantile(xs, 0.1)), q90: r2(X.quantile(xs, 0.9)), up: r1(100 * xs.filter((v) => v > 0).length / xs.length) } : null; };
      for (const s of strategies) { const o = { n: camps.length, improvement: agg(camps, s, (c) => c.res[s].improvement), tim: agg(camps, s, (c) => 100 * c.res[s].tim), forced: agg(camps, s, (c) => 100 * c.res[s].forced), fullAt: agg(camps, s, (c) => c.res[s].fullAt), worst126: agg(camps, s, (c) => c.res[s].worst126), rungs: agg(camps, s, (c) => c.res[s].rungs), depImprovement: agg(camps, s, (c) => c.res[s].depImprovement), depRet126: agg(camps, s, (c) => c.res[s].depRet126), depShare: agg(camps, s, (c) => 100 * c.res[s].depShare) }; for (const h of HZ) o["ret" + h] = agg(camps, s, (c) => c.res[s].ret[h]);
        if (s !== "single") { o.vsSingle = {}; for (const key of ["improvement", "worst126", "ret63", "ret126", "ret252"]) { const diffs = camps.map((c) => { const a = key.startsWith("ret") ? c.res[s].ret[+key.slice(3)] : c.res[s][key], b = key.startsWith("ret") ? c.res.single.ret[+key.slice(3)] : c.res.single[key]; return fin(a) && fin(b) ? a - b : null; }).filter(fin); if (diffs.length >= 3) { const bb = X.episodeBootstrap(diffs, (v) => X.mean(v), { reps: REPS, seed: 13, base: 0 }); o.vsSingle[key] = { n: diffs.length, mean: r2(X.mean(diffs)), med: r2(X.median(diffs)), lo: r2(bb.lo), hi: r2(bb.hi), p: r2(bb.p), better: r1(100 * diffs.filter((v) => v > 0).length / diffs.length) }; } } }
        // by market state at the trigger
        o.byState = {}; for (const [lab, f] of [["above 200-day", (c) => c.above200 === true], ["below 200-day", (c) => c.above200 === false], ["below and 200-day falling", (c) => c.above200 === false && c.slopeUp === false]]) { const rs = camps.filter(f); if (rs.length) o.byState[lab] = { n: rs.length, improvement: agg(rs, s, (c) => c.res[s].improvement), ret126: agg(rs, s, (c) => c.res[s].ret[126]), worst126: agg(rs, s, (c) => c.res[s].worst126) }; }
        summ[s] = o; }
      byDepth[depth] = { n: camps.length, strategies: summ, campaigns: camps.map((c) => ({ d: c.d, depthAtTrigger: c.depthAtTrigger, above200: c.above200, slopeUp: c.slopeUp, vixPct: c.vixPct, res: Object.fromEntries(Object.entries(c.res).map(([k, v]) => [k, { improvement: r2(v.improvement), tim: r1(100 * v.tim), forced: r1(100 * v.forced), fullAt: v.fullAt, rungs: v.rungs, worst126: r2(v.worst126), ret63: r2(v.ret[63]), ret126: r2(v.ret[126]), ret252: r2(v.ret[252]), depImprovement: r2(v.depImprovement), depRet126: r2(v.depRet126), depShare: r1(100 * v.depShare) }])) })) };
    }
    // BH across every "vs single" comparison at every depth for this instrument
    const all = []; for (const d of Object.keys(byDepth)) for (const [s, o] of Object.entries(byDepth[d].strategies)) if (o.vsSingle) for (const [k, t] of Object.entries(o.vsSingle)) all.push({ t, p: t.p });
    const bh = X.benjaminiHochberg(all.map((a) => a.p), 0.1); all.forEach((a, k) => { a.t.pAdj = r2(bh.adjusted[k]); a.t.survives = bh.reject[k]; });
    return { name, from: I.dates[0], to: I.dates.at(-1), W, byDepth, tests: all.length, survivors: all.filter((a) => a.t.survives).length };
  };
  J.s4.instruments = {}; for (const [nm, I] of [["SPY", SPY], ["QQQ", QQQ], ["LEADERS", LEAD], ["^NDX", NDX]]) { if (QUICK && nm === "^NDX") continue; J.s4.instruments[nm] = study(I, nm); log(`  ${nm} done ${((Date.now() - t0) / 1000) | 0}s`); }
  J.s4.design = { window: W, horizons: HZ, depths: DEPTHS, strategies: { single: "all the money at the trigger close", dca: "five equal parts at the trigger close and every 12 sessions after", fan: "the trigger tranche plus one limit at every fan line below the trigger close (each line's value that day, known at the open); equal parts", pivots: "the trigger tranche plus the last three swing lows below, the rising diagonal through the last two swing lows, and its lower parallel; equal parts", rsi: "the trigger tranche plus one part at the first close whose RSI own-percentile is at or under 20, 10, 5, 2, 1", all: "fan + pivots + RSI (10, 5, 1) together, equal parts", state: "the fan ladder, with the trigger tranche's share raised by the VIX's own percentile at the trigger (100th → half the money at once)" }, rules: "a price rung fills at min(open, level) on the first day the low touches the level; a close-based rung fills at that close; whatever is unfilled after 60 sessions is bought at that close, so every strategy ends fully invested and is compared on the same money; the next campaign needs a new 252-session high first" };
  // one worked example: SPY's latest completed campaign at 3% with the fan ladder
  const I = SPY, ex = J.s4.instruments.SPY.byDepth[3]?.campaigns.filter((c) => c.d >= "2025-01-01").at(-1);
  if (ex) { const fan = L.fanKnown(I.bars), pvs = L.pivots(I.h, I.l, 10), rsi = L.rsi14(I.c), rsiPct = L.ownPct(rsi, 250), tt = I.idx.get(ex.d), sets = L.rungSets(I.bars, tt, { fan, pvs, rsiPct }); const c = L.runCampaign(I.bars, tt, W, sets.all);
    J.s4.example = { d: ex.d, window: I.dates.slice(Math.max(0, tt - 30), tt + W + 30).map((d, k) => { const i = Math.max(0, tt - 30) + k; return [d, r2(I.c[i]), r2(I.l[i]), ...["e8", "e21", "s50", "s100", "s200", "w200"].map((key) => r2(fan[key][i]))]; }), fills: c.fills.map((f) => ({ rung: f.rung, d: I.dates[f.i], px: r2(f.px), w: r2(f.w), forced: f.forced })), avgCost: r2(c.avgCost), trigger: r2(I.c[tt]) }; }
}

/* ================================ S5 · Wednesday: PCE and MU, facts only ================================ */
log("S5 events");
{ const pceDates = [...new Set(pceCal.rows.filter((r) => /Price Index MoM/.test(r.event) && r.date <= asOf).map((r) => r.date))].sort();
  const spyDD = L.depthFromHigh(SPY.c);
  const dayRow = (d) => { let i = spyAt(d); if (i == null) { i = SPY.dates.findIndex((x) => x >= d); if (i < 0) return null; } return { d: SPY.dates[i], move: r2(100 * (SPY.c[i] / SPY.c[i - 1] - 1)), range: r2(100 * (SPY.h[i] - SPY.l[i]) / SPY.c[i - 1]), depthBefore: r2(spyDD[i - 1]), inPullback3: spyDD[i - 1] <= -3, next5: r2(L.fwd(SPY.c, i, 5)), week: r2(100 * (SPY.c[Math.min(i + 4, SPY.c.length - 1)] / SPY.c[i - 1] - 1)) }; };
  const pce = pceDates.map(dayRow).filter(Boolean);
  const absMean = (rs) => (rs.length ? r2(X.mean(rs.map((r) => Math.abs(r.move)))) : null);
  const allDays = SPY.dates.slice(-756).map((d) => dayRow(d)).filter(Boolean);
  J.s5.pce = { next: pceCal.rows.filter((r) => r.date === "2026-09-30").map((r) => ({ event: r.event, time_utc: r.time_utc, estimate: r.estimate, previous: r.previous })), onFile: pce.length, from: pceDates[0], rows: pce, summary: { absMove: absMean(pce), absMoveAllDays3y: absMean(allDays), upShare: r1(100 * pce.filter((r) => r.move > 0).length / pce.length), inPullback: pce.filter((r) => r.inPullback3).map((r) => ({ d: r.d, depthBefore: r.depthBefore, move: r.move, week: r.week })) }, note: "the Hub's economic calendar begins in June 2024, so only these releases are on file; older PCE days are not inferred" };
  // MU: the eight dated calls on file; earlier report days INFERRED from the biggest volume day in each quarterly window (flagged)
  const MU = inst("MU", { faults: true }), SMH = inst("SMH");
  const inferred = []; if (MU) { const vol = MU.bars.map((b) => b.v); for (let y = 2004; y <= 2024; y++) for (const [m0, d0, m1, d1] of [[3, 15, 4, 10], [6, 15, 7, 10], [9, 15, 10, 10], [12, 15, 1, 12]]) { const a = `${y}-${String(m0).padStart(2, "0")}-${d0}`, b = m1 === 1 ? `${y + 1}-01-${d1}` : `${y}-${String(m1).padStart(2, "0")}-${d1}`; let best = -1, bi = -1; for (let i = 21; i < MU.c.length; i++) { const d = MU.dates[i]; if (d < a || d > b) continue; const base = X.mean(vol.slice(i - 21, i - 1)); const ratio = base > 0 ? vol[i] / base : 0; if (ratio > best) { best = ratio; bi = i; } } if (bi > 0 && best >= 2 && MU.dates[bi] < "2024-09-01") inferred.push({ reactionDay: MU.dates[bi], volRatio: r1(best) }); } }
  const known = muDates.map((d) => ({ callDate: d, reactionDay: SPY.dates.find((x) => x > d) })).filter((r) => r.reactionDay);
  const muRow = (reactionDay, kind) => { const i = MU.idx.get(reactionDay), j = spyAt(reactionDay), k = SMH?.idx.get(reactionDay); if (i == null || j == null) return null; return { kind, reactionDay, mu: r2(100 * (MU.c[i] / MU.c[i - 1] - 1)), smh: k != null ? r2(100 * (SMH.c[k] / SMH.c[k - 1] - 1)) : null, spy: r2(100 * (SPY.c[j] / SPY.c[j - 1] - 1)), depthBefore: r2(spyDD[j - 1]), inPullback3: spyDD[j - 1] <= -3, spyNext5: r2(L.fwd(SPY.c, j, 5)) }; };
  const rows = [...inferred.map((r) => muRow(r.reactionDay, "inferred (volume ×" + r.volRatio + ")")), ...known.map((r) => muRow(r.reactionDay, "call " + r.callDate))].filter(Boolean).sort((a, b) => (a.reactionDay < b.reactionDay ? -1 : 1));
  const S = (rs) => (rs.length ? { n: rs.length, muAbs: r2(X.mean(rs.map((r) => Math.abs(r.mu)))), muUp: r1(100 * rs.filter((r) => r.mu > 0).length / rs.length), smhMed: r2(X.median(rs.map((r) => r.smh).filter(fin))), spyMed: r2(X.median(rs.map((r) => r.spy))), spyNext5Med: r2(X.median(rs.map((r) => r.spyNext5).filter(fin))) } : null);
  J.s5.mu = { rows, all: S(rows), inPullback: S(rows.filter((r) => r.inPullback3)), notInPullback: S(rows.filter((r) => !r.inPullback3)), known: known.length, inferred: inferred.length, note: "MU reports after the close; the reaction day is the next session. Eight call dates come from the Hub's transcripts table; earlier report days are INFERRED as the highest-volume day (≥ 2× its prior month) inside each quarterly reporting window, and are marked so." };
}

fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.writeFileSync(OUT, JSON.stringify(J));
log(`wrote ${OUT} (${(fs.statSync(OUT).size / 1024) | 0} KB) in ${((Date.now() - t0) / 1000) | 0}s`);
