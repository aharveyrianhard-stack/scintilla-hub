/* REGIME · market-regime research, 28 Sep 2026 (lane STATS-REGIME). Research, not buy rules.
   node research/statistics/regime/regime.mjs [--cache <dir>] [--out <file>]
   Reads the durable cache (default ~/Library/Application Support/scintilla/stats-cache/regime-20260928):
     chart/<SYM>.json      chart API daily bars (Origin https://scintillahub.ai), fetched 28 Sep 2026
     fmp-eod*.json          FMP daily history pulled on Fly (research/statistics/regime/fly-run.mjs), split-adjusted / dividend-adjusted
     fmp-econ.json          FMP economic calendar, "Fed Interest Rate Decision" rows 2013→
     fed/<YEAR>.htm, fed/current.htm   the Federal Reserve's published FOMC schedules
     polymarket-*.json, kalshi-feddecision.json, markets-fetched-at.txt   public prediction-market snapshots (no account, no key)
   Writes research/statistics/data/regime-20260928.json. No network, no database. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import * as L from "./regime-lib.mjs";
import { swings, cleanBars } from "../s9-research.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const HORIZONS = [5, 21, 63, 126];
const AS_OF = "2026-09-25";                   // last completed session in every source
const FINISHED_MONTH = "2026-08";            // September 2026 is not finished: left out of the monthly statistics

/* ------------------------- loading ------------------------- */
export function loadCache(ROOT) {
  const dstr = (t) => new Date(t).toISOString().slice(0, 10);
  const chart = (sym) => { const f = path.join(ROOT, "chart", sym + ".json"); if (!fs.existsSync(f)) return null; const j = JSON.parse(fs.readFileSync(f, "utf8")); return (j.series || []).map((b) => ({ d: dstr(b.t), o: +b.o, h: +b.h, l: +b.l, c: +b.c, v: +b.v })); };
  const fmp = { eod: {}, eodadj: {} };
  for (const fn of ["fmp-eod.json", "fmp-eod2.json"]) {
    const f = path.join(ROOT, fn); if (!fs.existsSync(f)) continue;
    for (const j of JSON.parse(fs.readFileSync(f, "utf8"))) {
      if (!Array.isArray(j.rows) || !j.rows.length) continue;
      const m = (fmp[j.kind][j.symbol] ??= new Map());
      for (const r of j.rows) m.set(r[0], { d: r[0], o: r[1], h: r[2], l: r[3], c: r[4], v: r[5] });
    }
  }
  // ETFs: drop the flat zero-volume placeholder bars at either end. Indexes (^…) keep them: their early history is close-only but real.
  const fm = (sym, kind = "eod") => { const m = fmp[kind][sym]; if (!m) return null; const rows = [...m.values()].sort((a, b) => a.d < b.d ? -1 : 1); return sym.startsWith("^") ? rows : L.trimPlaceholders(rows); };
  const econ = fs.existsSync(path.join(ROOT, "fmp-econ.json")) ? JSON.parse(fs.readFileSync(path.join(ROOT, "fmp-econ.json"), "utf8")).flatMap((j) => j.rows || []) : [];
  const fed = {}; const fdir = path.join(ROOT, "fed"); if (fs.existsSync(fdir)) for (const f of fs.readdirSync(fdir)) fed[f.replace(".htm", "")] = fs.readFileSync(path.join(fdir, f), "utf8");
  const js = (f) => fs.existsSync(path.join(ROOT, f)) ? JSON.parse(fs.readFileSync(path.join(ROOT, f), "utf8")) : null;
  const fetchedAt = fs.existsSync(path.join(ROOT, "markets-fetched-at.txt")) ? fs.readFileSync(path.join(ROOT, "markets-fetched-at.txt"), "utf8").trim() : null;
  return { chart, fm, econ, fed, markets: { polyOct: js("polymarket-oct.json"), polyDec: js("polymarket-dec.json"), kalshi: js("kalshi-feddecision.json"), zq: js("fmp-zq-quote.json"), fetchedAt } };
}
const ym = (d) => d.slice(0, 7);
const weekly = (dates, vals) => { const out = []; for (let i = 0; i < dates.length; i++) { const nxt = dates[i + 1]; const endOfWeek = !nxt || new Date(nxt + "T12:00:00Z").getUTCDay() <= new Date(dates[i] + "T12:00:00Z").getUTCDay() || (Date.parse(nxt) - Date.parse(dates[i])) > 3 * 864e5; if (endOfWeek) out.push([dates[i], L.r3(vals[i]) ?? vals[i]]); } return out; };
const fwdSet = (closes, idxs, h) => idxs.map((i) => L.fwd(closes, i, h));

/* Price events the chart API's split adjustment does not cover. Each is corrected by scaling the bars BEFORE the date so the
   fund's move that day equals SPY's move that day (a spin-off is value handed to holders, not a loss). */
export const SPINOFFS = [{ sym: "XLF", date: "2016-09-19", note: "XLF handed its real-estate stocks to holders as the new XLRE fund (a 'special distribution'); its price fell about 7% that morning with no loss to holders" }];
export function adjustSpinoff(bars, spy, ev) {
  const i = bars.findIndex((b) => b.d === ev.date); if (i < 1) return { bars, factor: null };
  const s = new Map(spy.map((b) => [b.d, b.c])); const sp = s.get(ev.date) / s.get(bars[i - 1].d);
  const factor = (bars[i].c / bars[i - 1].c) / sp;
  return { factor, bars: bars.map((b, k) => k < i ? { ...b, o: b.o * factor, h: b.h * factor, l: b.l * factor, c: b.c * factor } : b) };
}

/* ------------------------- 1 · equal weight vs cap weight ------------------------- */
export const PAIRS = [
  { ew: "RSP", cw: "SPY", label: "S&P 500", src: ["chart", "chart"] },
  { ew: "QQEW", cw: "QQQ", label: "Nasdaq-100 (First Trust)", src: ["fmp", "fmp"] },
  { ew: "QQQE", cw: "QQQ", label: "Nasdaq-100 (Direxion)", src: ["fmp", "fmp"] },
  { ew: "EQAL", cw: "IWB", label: "Russell 1000", src: ["fmp", "fmp"] },
  { ew: "RSPT", cw: "XLK", label: "Technology", src: ["fmp", "chart"], sector: true },
  { ew: "RSPF", cw: "XLF", label: "Financials", src: ["fmp", "chart"], sector: true },
  { ew: "RSPH", cw: "XLV", label: "Health care", src: ["fmp", "chart"], sector: true },
  { ew: "RSPN", cw: "XLI", label: "Industrials", src: ["fmp", "chart"], sector: true },
  { ew: "RSPG", cw: "XLE", label: "Energy", src: ["fmp", "chart"], sector: true },
  { ew: "RSPU", cw: "XLU", label: "Utilities", src: ["fmp", "chart"], sector: true },
  { ew: "RSPS", cw: "XLP", label: "Consumer staples", src: ["fmp", "chart"], sector: true },
  { ew: "RSPD", cw: "XLY", label: "Consumer discretionary", src: ["fmp", "chart"], sector: true },
  { ew: "RSPM", cw: "XLB", label: "Materials", src: ["fmp", "chart"], sector: true },
  { ew: "RSPR", cw: "XLRE", label: "Real estate", src: ["fmp", "chart"], sector: true },
  { ew: "RSPC", cw: "XLC", label: "Communication services", src: ["fmp", "chart"], sector: true },
  { ew: "EWMC", cw: "MDY", label: "Mid caps (S&P 400)", src: ["fmp", "chart"], closed: true },
  { ew: "EWSC", cw: "IJR", label: "Small caps (S&P 600)", src: ["fmp", "chart"], closed: true },
];
export const STRETCH_PCT = 5, EPISODE_SEP = 63;
/** One pair: ratio, its stretch from its own 200-day average, current percentiles, and what followed past extremes. */
export function pairStudy(d, ew, cw, cwFwdSeries = null) {
  const ratio = ew.map((x, i) => x / cw[i]);
  const avg = L.sma(ratio, 200), stretch = ratio.map((x, i) => avg[i] == null ? null : 100 * (x / avg[i] - 1));
  const n = ratio.length, last = n - 1;
  const st = stretch.filter((x) => x != null).sort((a, b) => a - b);
  const loT = L.quantile(st, STRETCH_PCT / 100), hiT = L.quantile(st, 1 - STRETCH_PCT / 100);
  const lowIdx = L.entries(stretch.map((x) => x != null && x <= loT), EPISODE_SEP), highIdx = L.entries(stretch.map((x) => x != null && x >= hiT), EPISODE_SEP);
  const follow = (idxs) => idxs.map((i) => ({ d: d[i], stretch: L.r1(stretch[i]), ratio63: L.r1(L.fwd(ratio, i, 63)), ratio126: L.r1(L.fwd(ratio, i, 126)), ratio252: L.r1(L.fwd(ratio, i, 252)), cw63: L.r1(L.fwd(cw, i, 63)), cw252: L.r1(L.fwd(cw, i, 252)) }));
  const allR = (h) => L.summariseH(ratio.map((_, i) => stretch[i] == null ? null : L.fwd(ratio, i, h)), d, h);
  const sumF = (eps, k) => { const v = eps.map((e) => e[k]).filter((x) => x != null); return { n: v.length, median: L.r1(L.median(v)), up: L.r1(L.shareUp(v)) }; };
  const lows = follow(lowIdx), highs = follow(highIdx);
  const tail = d.map((_, i) => i).filter((i) => i >= last - 755);
  return {
    from: d[0], to: d[last], sessions: n,
    now: { ratio: L.r3(ratio[last]), stretch: L.r1(stretch[last]),
      levelPctAll: L.r1(L.percentileOf(ratio.slice(0, last), ratio[last])),
      levelPct3y: L.r1(L.percentileOf(tail.slice(0, -1).map((i) => ratio[i]), ratio[last])),
      stretchPctAll: L.r1(L.percentileOf(stretch.slice(0, last), stretch[last])),
      change252: L.r1(n > 252 ? 100 * (ratio[last] / ratio[last - 252] - 1) : null),
      sinceStart: L.r1(100 * (ratio[last] / ratio[0] - 1)) },
    thresholds: { low: L.r1(loT), high: L.r1(hiT) },
    lows, highs,
    lowsSummary: { ratio63: sumF(lows, "ratio63"), ratio252: sumF(lows, "ratio252"), cw63: sumF(lows, "cw63"), cw252: sumF(lows, "cw252") },
    highsSummary: { ratio63: sumF(highs, "ratio63"), ratio252: sumF(highs, "ratio252"), cw63: sumF(highs, "cw63"), cw252: sumF(highs, "cw252") },
    baseline: { ratio63: allR(63), ratio252: allR(252) },
    weekly: weekly(d, ratio),
  };
}

/* ------------------------- 2 · VIX term structure ------------------------- */
export function vixStudy(vix, vix3m, spyBars, spyCloseByDate) {
  const A = L.align(vix, vix3m); const d = A.d, r = A.a.map((x, i) => x / A.b[i]);
  const inv = r.map((x) => x > 1);
  const byYear = {}; d.forEach((x, i) => { const y = x.slice(0, 4); (byYear[y] ??= [0, 0]); byYear[y][0] += inv[i] ? 1 : 0; byYear[y][1]++; });
  // SPY on the same dates
  const spyC = d.map((x) => spyCloseByDate.get(x) ?? null);
  const S = spyBars; const sIdx = new Map(S.map((b, i) => [b.d, i]));
  const sw = swings(S.map((b) => b.c), S.map((b) => b.c), 10);   // on closes: the chart API's SPY carries bad wick prints (see dataFaults)
  const lowsAll = []; for (let i = 1; i < sw.length; i++) if (sw[i].type === "L" && sw[i - 1].type === "H") lowsAll.push({ d: S[sw[i].k].d, depth: 100 * (sw[i].price / sw[i - 1].price - 1) });
  const lows = lowsAll.filter((x) => x.depth <= -5 && x.d >= d[0]);
  const eps = L.runs(inv, 5).map((e) => {
    const s = d[e.s], en = d[e.e]; const si = sIdx.get(s);
    const closes = S.map((b) => b.c);
    const hi252 = si != null ? Math.max(...closes.slice(Math.max(0, si - 251), si + 1)) : null;
    const rsi = si != null ? L.rsiWilder(closes.slice(Math.max(0, si - 400), si + 1)).at(-1) : null;
    const win0 = L.addDays(s, -7), win1 = L.addDays(en, 14);
    const low = lowsAll.find((x) => x.d >= win0 && x.d <= win1);
    return { start: s, end: en, sessions: e.e - e.s + 1, peak: L.r2(Math.max(...r.slice(e.s, e.e + 1))),
      spyDrawdown: si != null ? L.r1(100 * (closes[si] / hi252 - 1)) : null, spyRsi: L.r1(rsi),
      fwd21: si != null ? L.r1(L.fwd(closes, si, 21)) : null, fwd63: si != null ? L.r1(L.fwd(closes, si, 63)) : null, fwd126: si != null ? L.r1(L.fwd(closes, si, 126)) : null,
      swingLowNear: low ? { d: low.d, depth: L.r1(low.depth) } : null };
  });
  const inEp = (x) => eps.some((e) => x >= L.addDays(e.start, -7) && x <= L.addDays(e.end, 14));
  const lowsHit = lows.filter((x) => inEp(x.d));
  const coverage = L.r1(100 * S.filter((b) => b.d >= d[0] && inEp(b.d)).length / S.filter((b) => b.d >= d[0]).length);   // unconditional rate: share of ALL sessions inside those windows
  // The fair comparison: a swing low is by definition a session deep in a fall, and a sharp fall is what inverts the curve.
  // So compare with sessions at a similar depth — SPY closing ≥X% below its own recent closing high — and ask how often THOSE sit in a window.
  const sc = S.map((b) => b.c); const hiN = (i, n) => { let m = -Infinity; for (let j = Math.max(0, i - n + 1); j <= i; j++) m = Math.max(m, sc[j]); return m; };
  const conditional = [[21, 5], [63, 5], [21, 7]].map(([n, x]) => { const sel = S.filter((b, i) => b.d >= d[0] && 100 * (sc[i] / hiN(i, n) - 1) <= -x);
    return { lookback: n, depth: x, sessions: sel.length, inWindowPct: L.r1(100 * sel.filter((b) => inEp(b.d)).length / sel.length) }; });
  // Timing of each hit against its inversion: a low before the inversion began would be a lead; during / after is coincidence with the fall.
  const timing = { before: 0, during: 0, after: 0 };
  for (const x of lowsHit) { const e = eps.find((e) => x.d >= L.addDays(e.start, -7) && x.d <= L.addDays(e.end, 14)); timing[x.d < e.start ? "before" : x.d <= e.end ? "during" : "after"]++; }
  const fw = {};
  for (const h of HORIZONS) {
    const all = spyC.map((_, i) => spyC[i] == null || spyC[i + h] == null ? null : 100 * (spyC[i + h] / spyC[i] - 1));
    const sH = (xs) => L.summariseH(xs, d, h);
    fw[h] = { all: sH(all), inverted: sH(all.map((x, i) => inv[i] ? x : null)), contango: sH(all.map((x, i) => !inv[i] ? x : null)),
      deep: sH(all.map((x, i) => r[i] >= 1.1 ? x : null)) };
    fw[h].invertedVsAll = L.versus(fw[h].inverted, fw[h].all);
  }
  const last = d.length - 1; const lastInv = inv.lastIndexOf(true);
  return { from: d[0], to: d[last], sessions: d.length, invertedDays: inv.filter(Boolean).length, invertedPct: L.r1(100 * inv.filter(Boolean).length / d.length),
    byYear: Object.fromEntries(Object.entries(byYear).map(([y, [a, b]]) => [y, L.r1(100 * a / b)])),
    episodes: eps, lows: { n: lows.length, nearInversion: lowsHit.length, chanceCoverage: coverage, conditional, timing, list: lows.map((x) => ({ ...x, depth: L.r1(x.depth), nearInversion: inEp(x.d) })) },
    episodesWithSwingLow: eps.filter((e) => e.swingLowNear).length, fwd: fw,
    now: { vix: vix.at(-1).c, vix3m: vix3m.at(-1).c, ratio: L.r3(r[last]), pctAll: L.r1(L.percentileOf(r.slice(0, last), r[last])), lastInverted: lastInv >= 0 ? d[lastInv] : null },
    weekly: weekly(d, r) };
}

/* ------------------------- 3 · credit stress ------------------------- */
export const WIN = 63;
export function creditStudy(name, a, b, spyBars) {
  const A = L.align(a, b); const d = A.d, r = A.a.map((x, i) => x / A.b[i]); const last = d.length - 1;
  const dd = L.drawdowns(r, 2).map((e) => ({ peak: d[e.peak], trough: d[e.trough], recovered: e.rec == null ? null : d[e.rec], depth: L.r1(e.depth), sessionsDown: e.trough - e.peak }))
    .sort((p, q) => p.depth - q.depth);
  // SPY swings (≥7% declines) vs the ratio's own peak / trough around them
  const S = spyBars.filter((x) => x.d >= d[0]); const sw = swings(S.map((x) => x.c), S.map((x) => x.c), 10);
  const rIdx = new Map(d.map((x, i) => [x, i])); const lead = [];
  const argExt = (a, b, max) => { let k = a; for (let j = a; j <= b; j++) if (max ? r[j] > r[k] : r[j] < r[k]) k = j; return k; };
  for (let i = 1; i < sw.length; i++) {
    if (!(sw[i].type === "L" && sw[i - 1].type === "H")) continue; const depth = 100 * (sw[i].price / sw[i - 1].price - 1); if (depth > -7) continue;
    const H = rIdx.get(S[sw[i - 1].k].d), Lw = rIdx.get(S[sw[i].k].d); if (H == null || Lw == null || H < WIN || Lw + WIN > last) continue;
    const pk = argExt(H - WIN, H + WIN, true), tr = argExt(Lw - WIN, Lw + WIN, false);
    lead.push({ spyHigh: d[H], spyLow: d[Lw], spyDepth: L.r1(depth), ratioPeak: d[pk], peakLead: H - pk, ratioTrough: d[tr], troughLag: tr - Lw });
  }
  // placebo: the same measurement centred on every ordinary session (what "leading" looks like by chance for this ratio)
  const plPk = [], plTr = []; for (let t = WIN; t + WIN <= last; t += 5) { plPk.push(t - argExt(t - WIN, t + WIN, true)); plTr.push(argExt(t - WIN, t + WIN, false) - t); }
  const hi252 = Math.max(...r.slice(Math.max(0, last - 251)));
  const ch63 = r.map((x, i) => i >= 63 ? 100 * (x / r[i - 63] - 1) : null);
  return { name, from: d[0], to: d[last], now: { ratio: L.r3(r[last]), fromAllTimeHigh: L.r1(100 * (r[last] / Math.max(...r) - 1)), from252High: L.r1(100 * (r[last] / hi252 - 1)),
      change63: L.r1(ch63[last]), change63Pct: L.r1(L.percentileOf(ch63.slice(0, last), ch63[last])) },
    drawdowns: dd.slice(0, 12), drawdownCount: dd.length, leadLag: lead,
    leadSummary: { window: WIN, n: lead.length, medianPeakLead: L.median(lead.map((x) => x.peakLead)), peakedFirst: lead.filter((x) => x.peakLead > 0).length, medianTroughLag: L.median(lead.map((x) => x.troughLag)), bottomedAfter: lead.filter((x) => x.troughLag > 0).length,
      placebo: { n: plPk.length, medianPeakLead: L.median(plPk), peakedFirstPct: L.r1(100 * plPk.filter((x) => x > 0).length / plPk.length), medianTroughLag: L.median(plTr), bottomedAfterPct: L.r1(100 * plTr.filter((x) => x > 0).length / plTr.length) } },
    weekly: weekly(d, r) };
}

/* ------------------------- 4 · dollar, 10-year yield, and Alan's thesis ------------------------- */
export function macroStudy(gspc, tnx, dxy) {
  const g = gspc, gd = g.map((x) => x.d), gc = g.map((x) => x.c), gi = new Map(gd.map((x, i) => [x, i]));
  const tMap = new Map(tnx.map((x) => [x.d, x.c])), xMap = new Map(dxy.map((x) => [x.d, x.c]));
  const tAvg = new Map(), xAvg = new Map();
  { const tv = tnx.map((x) => x.c), a = L.sma(tv, 200); tnx.forEach((x, i) => tAvg.set(x.d, a[i])); }
  { const xv = dxy.map((x) => x.c), a = L.sma(xv, 200); dxy.forEach((x, i) => xAvg.set(x.d, a[i])); }
  // yield level vs its own previous 10 years (2520 sessions), prior values only
  const tv = tnx.map((x) => x.c), tPct = new Map();
  for (let i = 2520; i < tnx.length; i++) tPct.set(tnx[i].d, L.percentileOf(tv.slice(i - 2520, i), tv[i]));
  const rsi = L.rsiWilder(gc), avg200 = L.sma(gc, 200);
  const hi = []; for (let i = 0; i < gc.length; i++) { hi.push(Math.max(...gc.slice(Math.max(0, i - 251), i + 1))); }
  const start = gd.findIndex((x) => x >= "1971-01-04");
  const rows = []; for (let i = start; i < gc.length; i++) {
    const d = gd[i], t = tMap.get(d), x = xMap.get(d), ta = tAvg.get(d), xa = xAvg.get(d);
    rows.push({ i, d, yUp: t != null && ta != null ? t > ta : null, dUp: x != null && xa != null ? x > xa : null, yPct: tPct.get(d) ?? null, y: t ?? null,
      dd: 100 * (gc[i] / hi[i] - 1), rsi: rsi[i], ext: avg200[i] ? 100 * (gc[i] / avg200[i] - 1) : null });
  }
  const H = [21, 63, 126, 252];
  const group = (f) => { const o = {}; for (const h of H) { const v = gc.map(() => null); for (const r of rows) if (f(r)) v[r.i] = L.fwd(gc, r.i, h); o[h] = L.summariseH(v, gd, h); } return o; };
  const base = group((r) => true);
  const cmp = (o) => { for (const h of H) o[h].vs = L.versus(o[h], base[h]); return o; };
  const regimes = {
    "yield up · dollar up": cmp(group((r) => r.yUp === true && r.dUp === true)),
    "yield up · dollar down": cmp(group((r) => r.yUp === true && r.dUp === false)),
    "yield down · dollar up": cmp(group((r) => r.yUp === false && r.dUp === true)),
    "yield down · dollar down": cmp(group((r) => r.yUp === false && r.dUp === false)),
  };
  const thesisFor = (since) => {
    const rs = rows.filter((r) => r.d >= since);
    const grp = (f) => { const o = {}; for (const h of H) { const v = gc.map(() => null); for (const r of rs) if (f(r)) v[r.i] = L.fwd(gc, r.i, h); o[h] = L.summariseH(v, gd, h); } return o; };
    const bs = grp(() => true); const cm = (o) => { for (const h of H) o[h].vs = L.versus(o[h], bs[h]); return o; };
  const HIGH = (r) => r.yPct != null && r.yPct >= 67, LOW = (r) => r.yPct != null && r.yPct < 33, ABS4 = (r) => r.y != null && r.y >= 4;
  const PB = (r) => r.dd <= -5 && r.dd > -10, PB10 = (r) => r.dd <= -10 && r.dd > -20, PB20 = (r) => r.dd <= -20;
    return { base: bs,
    pullback5to10: { highYield: cm(grp((r) => PB(r) && HIGH(r))), midYield: cm(grp((r) => PB(r) && !HIGH(r) && !LOW(r) && r.yPct != null)), lowYield: cm(grp((r) => PB(r) && LOW(r))), all: cm(grp(PB)) },
    pullback10to20: { highYield: cm(grp((r) => PB10(r) && HIGH(r))), lowYield: cm(grp((r) => PB10(r) && LOW(r))), all: cm(grp(PB10)) },
    pullback20plus: { highYield: cm(grp((r) => PB20(r) && HIGH(r))), lowYield: cm(grp((r) => PB20(r) && LOW(r))), all: cm(grp(PB20)) },
    pullbackAbs4: { yieldAtLeast4: cm(grp((r) => PB(r) && ABS4(r))), yieldUnder4: cm(grp((r) => PB(r) && r.y != null && !ABS4(r))) },
    overbought: { all: cm(grp((r) => r.rsi >= 70)), highYield: cm(grp((r) => r.rsi >= 70 && HIGH(r))), lowYield: cm(grp((r) => r.rsi >= 70 && LOW(r))), yieldRising: cm(grp((r) => r.rsi >= 70 && r.yUp === true)), yieldFalling: cm(grp((r) => r.rsi >= 70 && r.yUp === false)) },
    extended: { all: cm(grp((r) => r.ext != null && r.ext >= 10)), highYield: cm(grp((r) => r.ext != null && r.ext >= 10 && HIGH(r))), lowYield: cm(grp((r) => r.ext != null && r.ext >= 10 && LOW(r))), yieldRising: cm(grp((r) => r.ext != null && r.ext >= 10 && r.yUp === true)), yieldFalling: cm(grp((r) => r.ext != null && r.ext >= 10 && r.yUp === false)) },
    };
  };
  const thesis = thesisFor("1971-01-01"), thesis1990 = thesisFor("1990-01-01");
  const lastRow = rows.at(-1);
  const tl = tnx.at(-1), xl = dxy.at(-1);
  return { from: rows[0].d, to: lastRow.d, base, regimes, thesis, thesis1990,
    now: { gspc: gc.at(-1), drawdown: L.r1(lastRow.dd), rsi: L.r1(lastRow.rsi), ext200: L.r1(lastRow.ext), y10: tl.c, y10Avg200: L.r2(tAvg.get(tl.d)), y10Pct10y: L.r1(tPct.get(tl.d)), yieldUp: tl.c > tAvg.get(tl.d),
      dxy: xl.c, dxyAvg200: L.r2(xAvg.get(xl.d)), dollarUp: xl.c > xAvg.get(xl.d) },
    weeklyY: weekly(tnx.filter((x) => x.d >= "1990-01-01").map((x) => x.d), tnx.filter((x) => x.d >= "1990-01-01").map((x) => x.c)),
    weeklyD: weekly(dxy.filter((x) => x.d >= "1990-01-01").map((x) => x.d), dxy.filter((x) => x.d >= "1990-01-01").map((x) => x.c)) };
}

/* ------------------------- 5 · seasonality ------------------------- */
export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export function seasonality(gspc) {
  const mr = L.monthlyReturns(gspc, FINISHED_MONTH);
  const era = (from) => { const a = mr.filter((x) => x.ym >= from); const all = L.summarise(a.map((x) => x.ret)); const by = MONTHS.map((m, k) => { const v = a.filter((x) => +x.ym.slice(5, 7) === k + 1).map((x) => x.ret); const s = L.summarise(v, null, { seed: 100 + k }); s.sd = L.r2(L.sd(v)); s.worst = L.r1(Math.min(...v)); s.best = L.r1(Math.max(...v)); s.vs = L.versus(s, all); return { month: m, ...s }; }); return { from: a[0]?.ym, to: a.at(-1)?.ym, all, by }; };
  const dates = gspc.map((x) => x.d), c = gspc.map((x) => x.c), set = new Set(dates), idx = new Map(dates.map((x, i) => [x, i]));
  // option-expiry week (Mon–Fri week holding the third Friday), and the week after; 1990 onward
  const ox = [], after = [], weeks = [], quarterly = [];
  const weekEnd = (i) => { let j = i; while (j + 1 < dates.length && (Date.parse(dates[j + 1]) - Date.parse(dates[j])) < 3.5 * 864e5 && new Date(dates[j + 1] + "T12:00:00Z").getUTCDay() > new Date(dates[j] + "T12:00:00Z").getUTCDay()) j++; return j; };
  // all calendar weeks since 1990: close of last session of week / close of last session of previous week
  let prevEnd = null; for (let i = dates.findIndex((x) => x >= "1990-01-01"); i < dates.length; i++) { const e = weekEnd(i); if (prevEnd != null) weeks.push(100 * (c[e] / c[prevEnd] - 1)); prevEnd = e; i = e; }
  for (let y = 1990; y <= 2026; y++) for (let m = 1; m <= 12; m++) {
    const key = `${y}-${String(m).padStart(2, "0")}`; if (key > "2026-09") break;
    const ex = L.expirySession(key, set); if (!ex) continue; const e = idx.get(ex);
    let s = e; while (s > 0 && new Date(dates[s - 1] + "T12:00:00Z").getUTCDay() < new Date(dates[s] + "T12:00:00Z").getUTCDay() && (Date.parse(dates[s]) - Date.parse(dates[s - 1])) < 3.5 * 864e5) s--;
    if (s === 0) continue; const wr = 100 * (c[e] / c[s - 1] - 1); ox.push(wr); if (m % 3 === 0) quarterly.push(wr);
    if (e + 1 < dates.length) { const ae = weekEnd(e + 1); if (ae > e && ae < dates.length && dates[ae] <= AS_OF) after.push(100 * (c[ae] / c[e] - 1)); }
  }
  // pre-holiday sessions since 1953 (after Saturday trading ended)
  const from53 = dates.findIndex((x) => x >= "1953-01-01"); const d53 = dates.slice(from53), c53 = c.slice(from53);
  const dayRet = c53.map((x, i) => i ? 100 * (x / c53[i - 1] - 1) : null);
  const pre = L.preHolidaySessions(d53); const preSet = new Set(pre);
  const post = pre.map((i) => i + 1).filter((i) => i < d53.length);
  return { months: { all: era("1928-01"), since1950: era("1950-01"), last30y: era("1996-01") },
    opex: { from: "1990-01", expiryWeek: L.summarise(ox, null, { seed: 21 }), weekAfter: L.summarise(after, null, { seed: 22 }), quarterlyExpiryWeek: L.summarise(quarterly, null, { seed: 23 }), allWeeks: L.summarise(weeks, null, { seed: 24 }) },
    holidays: { from: "1953", preHoliday: L.summarise(pre.map((i) => dayRet[i]), null, { seed: 31 }), postHoliday: L.summarise(post.map((i) => dayRet[i]), null, { seed: 32 }), allDays: L.summarise(dayRet.filter((x, i) => x != null && !preSet.has(i)), null, { seed: 33 }),
      recent: { preHoliday: L.summarise(pre.filter((i) => d53[i] >= "2000-01-01").map((i) => dayRet[i]), null, { seed: 34 }), allDays: L.summarise(dayRet.filter((x, i) => x != null && d53[i] >= "2000-01-01" && !preSet.has(i)), null, { seed: 35 }) },
      list: pre.slice(-12).map((i) => d53[i]) } };
}

/* ------------------------- 6 · the Fed ------------------------- */
export function fomcDates(fedPages, econ) {
  const out = new Map();
  for (const [key, html] of Object.entries(fedPages)) {
    if (!/^\d{4}$/.test(key)) continue;
    for (const m of html.matchAll(/<h5[^>]*>([^<]*)<\/h5>/g)) { const t = m[1]; if (!/ Meeting/.test(t) || /unscheduled|cancelled|Conference Call/i.test(t)) continue; const dt = L.fedDecisionDate(t.split(" Meeting")[0], +key); if (dt) out.set(dt, { d: dt, src: "Fed historical page" }); }
  }
  if (fedPages.current) {
    const t = fedPages.current;
    for (let y = 2021; y <= 2027; y++) {
      const i = t.indexOf(`${y} FOMC Meetings`); if (i < 0) continue; const j = t.indexOf("FOMC Meetings", i + 20);
      const seg = t.slice(i, j > 0 ? j : i + 20000).replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
      let lastM = 0;   // the page lists the year's meetings in order; a month going backwards is a footnote about the next year — stop there
      for (const m of seg.matchAll(/\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan\/Feb|Apr\/May|Jul\/Aug|Oct\/Nov)\s+(\d{1,2}-\d{1,2})\*?/g)) { const dt = L.fedDecisionDate(`${m[1]} ${m[2]}`, y); if (!dt) continue; const mo = +dt.slice(5, 7); if (mo < lastM) break; lastM = mo; out.set(dt, { d: dt, src: "Fed calendar page" }); }
    }
  }
  const notOnFed = [];
  for (const e of econ) { if (e.event !== "Fed Interest Rate Decision") continue; const dt = e.date.slice(0, 10); const o = out.get(dt); if (o) Object.assign(o, { prev: e.previous, actual: e.actual, estimate: e.estimate, change: e.change }); else notOnFed.push(dt); }
  const list = [...out.values()].sort((a, b) => a.d < b.d ? -1 : 1); list.fmpNotOnFedSchedule = notOnFed.sort(); return list;
}
export function fedStudy(gspc, meetings) {
  const dates = gspc.map((x) => x.d), c = gspc.map((x) => x.c), idx = new Map(dates.map((x, i) => [x, i]));
  const from = dates.findIndex((x) => x >= "1994-01-01");
  const W = { into5: [-6, -1], day: [-1, 0], next1: [0, 1], after5: [0, 5], after21: [0, 21] };
  const past = meetings.filter((m) => m.d <= AS_OF && idx.has(m.d) && m.d >= "1994-01-01");
  const res = {};
  for (const [k, [a, b]] of Object.entries(W)) {
    const len = b - a; const v = past.map((m) => { const i = idx.get(m.d); return i + b < c.length && i + a >= 0 ? 100 * (c[i + b] / c[i + a] - 1) : null; });
    const base = []; for (let i = from + len; i < c.length; i++) base.push(100 * (c[i] / c[i - len] - 1));
    const s = L.summarise(v, null, { seed: 41 }); const bs = L.summarise(base, dates.slice(from + len).map(ym), { seed: 42 });
    s.vs = L.versus(s, bs); res[k] = { meetings: s, anyWindow: bs };
    const byType = {}; for (const [t, f] of [["hike", (m) => m.change > 0], ["hold", (m) => m.change === 0], ["cut", (m) => m.change < 0]]) { const vv = past.map((m, j) => m.change != null && f(m) ? v[j] : null); byType[t] = L.summarise(vv, null, { seed: 43 }); }
    res[k].byType2013 = byType;
  }
  const absDay = past.map((m) => { const i = idx.get(m.d); return Math.abs(100 * (c[i] / c[i - 1] - 1)); });
  const absAll = []; for (let i = from + 1; i < c.length; i++) absAll.push(Math.abs(100 * (c[i] / c[i - 1] - 1)));
  const next = meetings.filter((m) => m.d > "2026-09-28").slice(0, 3);
  return { fmpNotOnFedSchedule: meetings.fmpNotOnFedSchedule ?? [], meetings: past.length, first: past[0]?.d, last: past.at(-1)?.d, windows: res, decisionDayMove: { meetingsMedianAbs: L.r2(L.median(absDay)), allDaysMedianAbs: L.r2(L.median(absAll)) },
    recent: past.slice(-8).map((m) => ({ d: m.d, change: m.change ?? null, actual: m.actual ?? null })), next };
}
/** What the markets price for the next meetings — public snapshots only. */
export function marketOdds(mk) {
  const out = { fetchedAt: mk.fetchedAt, kalshi: [], polymarket: [] };
  for (const e of mk.kalshi?.events ?? []) {
    const ms = (e.markets ?? []).map((m) => ({ outcome: m.yes_sub_title, last: +m.last_price_dollars, bid: +m.yes_bid_dollars, ask: +m.yes_ask_dollars, volume: Math.round(+m.volume_fp || 0) }));
    out.kalshi.push({ event: e.event_ticker, title: e.title, decision: (e.strike_date || "").slice(0, 10), markets: ms });
  }
  for (const p of [mk.polyOct, mk.polyDec]) { const e = p?.[0]; if (!e) continue;
    out.polymarket.push({ title: e.title, slug: e.slug, ends: e.endDate, volumeUsd: Math.round(e.volume), volume24hUsd: Math.round(e.volume24hr || 0),
      markets: e.markets.map((m) => ({ outcome: m.groupItemTitle, yes: +JSON.parse(m.outcomePrices)[0], bid: m.bestBid, ask: m.bestAsk, volumeUsd: Math.round(+m.volume) })) }); }
  if (mk.zq) { const implied = L.r3(100 - mk.zq.price); out.futures = { symbol: mk.zq.symbol, price: mk.zq.price, impliedRate: implied, asOf: new Date(mk.zq.timestamp * 1000).toISOString(), effrRecent: mk.zq.effr?.["2026-08-01"] ?? null, contractMonth: mk.zq.contractMonth }; }
  return out;
}

/* ------------------------- runner ------------------------- */
export function run(ROOT) {
  const C = loadCache(ROOT); const src = {};
  const spyForAdj = C.chart("SPY"); const adjustments = [];
  const get = (sym, where) => { let s = where === "chart" ? C.chart(sym) : C.fm(sym);
    for (const ev of SPINOFFS) if (s && ev.sym === sym && where === "chart") { const a = adjustSpinoff(s, spyForAdj, ev); s = a.bars; adjustments.push({ ...ev, factor: L.r3(a.factor) }); } if (s) src[sym] = { from: s[0].d, to: s.at(-1).d, bars: s.length, provider: where === "chart" ? "chart API" : "FMP (pulled on Fly)" }; return s; };
  const spyRaw = C.chart("SPY"); const spyBars = cleanBars(spyRaw.map((b) => ({ t: Date.parse(b.d), o: b.o, h: b.h, l: b.l, c: b.c }))).bars.map((b, i) => ({ ...spyRaw[i], h: b.h, l: b.l }));
  src.SPY = { from: spyRaw[0].d, to: spyRaw.at(-1).d, bars: spyRaw.length, provider: "chart API" };
  const spyClose = new Map(spyRaw.map((b) => [b.d, b.c]));
  const pairs = PAIRS.map((p) => {
    const E = get(p.ew, p.src[0]), W = get(p.cw, p.src[1]); if (!E || !W) return { ...p, missing: true };
    const A = L.align(E, W); if (A.d.length < 260) return { ...p, missing: true, sessions: A.d.length };
    return { ...p, ...pairStudy(A.d, A.a, A.b) };
  });
  const vix = get("VIX", "chart"), vix3m = get("^VIX3M", "fmp");
  const vixS = vixStudy(vix, vix3m, spyBars, spyClose);
  const adj = (s) => { const r = C.fm(s, "eodadj"); if (r) src[s + " (dividend-adjusted)"] = { from: r[0].d, to: r.at(-1).d, bars: r.length, provider: "FMP dividend-adjusted (pulled on Fly)" }; return r; };
  const credit = [creditStudy("HYG ÷ LQD (junk vs investment-grade, with interest paid)", adj("HYG"), adj("LQD"), spyBars), creditStudy("HYG ÷ IEF (junk vs 7–10y Treasuries, with interest paid)", adj("HYG"), adj("IEF"), spyBars)];
  const gspc = get("^GSPC", "fmp"), tnx = get("US10Y", "chart"), dxy = get("DXY", "chart");
  const macro = macroStudy(gspc, tnx, dxy);
  const season = seasonality(gspc);
  const meetings = fomcDates(C.fed, C.econ);
  const fed = fedStudy(gspc, meetings);
  const odds = marketOdds(C.markets);
  const chartHyg = C.chart("HYG");
  const dataFaults = [
    { what: "HYG on the chart API before 2007-04-11", detail: `The chart API serves HYG from ${chartHyg?.[0]?.d} at about $${chartHyg?.[0]?.c}; the iShares high-yield fund only launched on 2007-04-11 (at about $104). The early stretch is a different instrument under a reused ticker. This study uses FMP's dividend-adjusted HYG, which starts 2007-04-11.` },
    { what: "QQQ on the chart API has a hole 2004-11-30 → 2011-03-23", detail: "The Nasdaq-100 fund traded as QQQQ in those years; the chart API's QQQ series skips them. The Nasdaq pairs here use FMP for both legs." },
    { what: "Equal-weight sector funds (RSPT, RSPF, RSPC …) on the chart API start 2023-06-07", detail: "Invesco renamed them in 2023 (RYT→RSPT etc.). FMP carries the full history under the new tickers, split-adjusted; on the 829 overlapping sessions FMP and the chart API agree to within 0.02%." },
    { what: "Mid- and small-cap equal-weight funds stopped", detail: "FMP's last prints: EWMC 2023-10-05, EWSC 2023-04-06 (zero volume). No live US mid/small equal-weight vs cap-weight pair was found on FMP; those two rows are history only." },
  ];
  dataFaults.push({ what: "XLF's 2016 spin-off", detail: `On 2016-09-19 XLF handed its real-estate holdings to its owners as the new XLRE fund. The chart API's XLF drops about 7% that day with no loss to holders. This study scales XLF's bars before that day by ${adjustments.find((a) => a.sym === "XLF")?.factor ?? "?"} (its move that day relative to SPY), so the RSPF ÷ XLF line has no false step.` });
  dataFaults.push({ what: "Thin trading in 2008–2009 in the old equal-weight sector funds", detail: "Their closing prints then sometimes lagged the market by a day (e.g. RSPF ÷ XLF −15% then +26% on 28–29 Oct 2008). The jumps reverse the next day; they add noise to the 2008 ends of those lines and to the 'far below / far above' dots from that year." });
  return { generated: new Date().toISOString(), asOf: AS_OF, adjustments, kind: "Market regime research — descriptive; nothing here is a buy or sell rule.", sources: src, dataFaults,
    pairs, vix: vixS, credit, macro, season, fed: { ...fed, schedule: meetings.filter((m) => m.d >= "2026-01-01") }, odds };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opt = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
  const ROOT = opt("--cache") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache/regime-20260928");
  const out = opt("--out") ?? path.join(here, "../data/regime-20260928.json");
  const t0 = Date.now(); const res = run(ROOT); fs.writeFileSync(out, JSON.stringify(res));
  console.log("wrote", out, (fs.statSync(out).size / 1024).toFixed(0) + " KB", ((Date.now() - t0) / 1000).toFixed(1) + " s");
}
