/* U2 · SECTOR ROTATION — the study. Reads the cached chart-API bars (fetch.mjs), writes
   deliverables/20260928/sector-rotation/sector-rotation.json. No network, no database.
     node research/statistics/sector-rotation/run.mjs [--cache-root <dir>] [--asof 2026-09-28]
   Descriptive only: base rates and where today sits in its own history. Nothing here is a buy or sell call. */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath } from "node:url";
import { cleanBars, swings } from "../s9-research.mjs";
import { FAMILIES, SECTORS, BENCH, ALL_SYMS, sectorOf } from "./universe.mjs";
import { dstr, mean, median, quantile, pctOf, corr, spearman, rankNorm, runLengths, blockBootstrap, geigerHistory,
  rsH, rrg, quadrantStats, QUADS, tierOf, TIERS, transitions, bowTie, epochDay } from "./lib.mjs";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
const ASOF = opt("--asof") ?? "2026-09-28";            // the morning the reading is taken (next session after the last bar)
const OUT = path.resolve(HERE, "../../../deliverables/20260928/sector-rotation");
const fin = (x) => x != null && Number.isFinite(x);
const r1 = (x) => fin(x) ? Math.round(x * 10) / 10 : null, r2 = (x) => fin(x) ? Math.round(x * 100) / 100 : null, r3 = (x) => fin(x) ? Math.round(x * 1000) / 1000 : null;
const t0 = Date.now();

/* ---------------- data ---------------- */
const DIR = path.join(ROOT, "sector-rotation-20260928");
const raw = {}, sources = {};
for (const s of ALL_SYMS) {
  const f = path.join(DIR, s + ".json"); if (!fs.existsSync(f)) { sources[s] = { missing: true }; continue; }
  const j = JSON.parse(fs.readFileSync(f, "utf8"));
  const { bars, cleaned } = cleanBars(j.series, 0.25);
  raw[s] = bars;
  sources[s] = { bars: bars.length, from: dstr(bars[0].t), to: dstr(bars.at(-1).t), provider: j.provider, basis: j.price_basis, cleaned };
}
const spy = raw.SPY, D = spy.map((b) => dstr(b.t)), N = D.length;
const idxOf = new Map(D.map((d, i) => [d, i]));
const closeOf = (s) => { const a = new Array(N).fill(null); for (const b of raw[s] || []) { const i = idxOf.get(dstr(b.t)); if (i != null) a[i] = +b.c; } return a; };
const C = Object.fromEntries(Object.keys(raw).map((s) => [s, closeOf(s)]));
const SP = FAMILIES.SPDR, CORE9 = SP.filter((s) => s !== "XLRE" && s !== "XLC");
const asofT = Date.parse(ASOF + "T04:00:00Z");

/* ---------------- 1 · horizons, from SPY's own swings ---------------- */
const H_ = spy.map((b) => +b.h), L_ = spy.map((b) => +b.l);
const swingTable = [5, 10, 20, 40, 60, 120].map((len) => {
  const sw = swings(H_, L_, len), legs = [], cyc = [];
  for (let i = 1; i < sw.length; i++) legs.push(sw[i].k - sw[i - 1].k);
  const lows = sw.filter((p) => p.type === "L"); for (let i = 1; i < lows.length; i++) cyc.push(lows[i].k - lows[i - 1].k);
  return { pivot: len, swings: sw.length, leg: { p25: quantile(legs, .25), med: median(legs), p75: quantile(legs, .75) }, cycle: { p25: quantile(cyc, .25), med: median(cyc), p75: quantile(cyc, .75) } };
});
const pick = (len, k) => Math.round(swingTable.find((r) => r.pivot === len)[k].med);
const HZ = { short: pick(10, "leg"), medium: pick(20, "cycle"), long: pick(120, "cycle") };
const HZ_WHY = {
  short: `one SPY swing leg under the S9 pivot rule (pivot 10): median ${HZ.short} sessions`,
  medium: `one SPY swing cycle, low to low, at pivot 20: median ${HZ.medium} sessions (about a quarter)`,
  long: `one SPY swing cycle, low to low, at pivot 120 (the multi-year swings): median ${HZ.long} sessions (about ${(HZ.long / 252).toFixed(1)} years)`,
};
const SENS = { short: [pick(5, "cycle"), pick(10, "cycle")], medium: [pick(40, "leg"), pick(40, "cycle")], long: [pick(60, "cycle"), 1.5 * 252 | 0] };

/* ---------------- 2 · relative strength, ranks, persistence, transitions, dispersion ---------------- */
const rsOf = (fam, h) => Object.fromEntries(fam.map((s) => [s, rsH(C[s], C.SPY, h)]));
const perHorizon = {};
const LAGS = [1, 2, 3, 5, 8, 13, 16, 21, 34, 38, 55, 72, 89, 144, 233, 377, 646, 1000];
function horizonStudy(h, fam = SP) {
  const rs = rsOf(fam, h);
  const rows = D.map((_, i) => fam.map((s) => rs[s][i]));
  const ranks = rows.map((r) => r.filter(fin).length >= 5 ? rankNorm(r) : r.map(() => null));
  const tiers = ranks.map((r) => r.map(tierOf));
  // persistence: cross-sectional Spearman between the rank today and the rank `lag` sessions later
  const persist = LAGS.map((lag) => {
    const daily = []; for (let i = 0; i + lag < N; i++) { const c = spearman(rows[i], rows[i + lag]); daily.push(fin(c) ? c : null); }
    return { lag, mean: r3(mean(daily)) };
  });
  // the momentum test proper: rank over the last h vs rank over the NEXT h (non-overlapping windows)
  const nextCorr = []; for (let i = 0; i + h < N; i++) nextCorr.push(spearman(rows[i], rows[i + h]));
  const okIx = nextCorr.map((v, i) => fin(v) ? i : -1).filter((i) => i >= 0);
  const boot = blockBootstrap(okIx.length, h, (ix) => mean(ix.map((k) => nextCorr[okIx[k]])), 600);
  // leader spells: consecutive sessions ranked #1, and in the top third
  const lead1 = [], topT = [], openSpells = {};
  fam.forEach((s, j) => {
    const is1 = rows.map((r, i) => fin(r[j]) ? r[j] === Math.max(...r.filter(fin)) : null);
    const isT = tiers.map((t) => t[j] == null ? null : t[j] === "TOP");
    const a = runLengths(is1), b = runLengths(isT);
    lead1.push(...a.done); topT.push(...b.done);
    openSpells[s] = { first: a.open, top: b.open };
  });
  const dist = (xs) => ({ n: xs.length, med: median(xs), p75: quantile(xs, .75), p90: quantile(xs, .9), max: xs.length ? Math.max(...xs) : null });
  // transitions over the next h sessions
  const T = transitions(tiers, h);
  // dispersion: best − worst and the cross-sectional standard deviation, CORE9 for a constant roster
  const coreIx = CORE9.map((s) => fam.indexOf(s)).filter((j) => j >= 0);
  const spread = rows.map((r) => { const v = coreIx.map((j) => r[j]).filter(fin); return v.length === coreIx.length ? Math.max(...v) - Math.min(...v) : null; });
  const spread11 = rows.map((r) => { const v = r.filter(fin); return v.length === fam.length ? Math.max(...v) - Math.min(...v) : null; });
  const sd = rows.map((r) => { const v = coreIx.map((j) => r[j]).filter(fin); if (v.length !== coreIx.length) return null; const m = mean(v); return Math.sqrt(mean(v.map((x) => (x - m) ** 2))); });
  const last = N - 1;
  const today = fam.map((s, j) => ({ sym: s, sector: sectorOf(s), rs: r2(rows[last][j]), rank: rows[last][j] == null ? null : 1 + rows[last].filter((v) => fin(v) && v > rows[last][j]).length,
    tier: tiers[last][j], ownPct: pctOf(rs[s], rows[last][j]) })).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  return { h, rs, rows, ranks, tiers,
    out: { h, persist, nextPeriodRankCorr: { mean: r3(mean(nextCorr)), ci90: [r3(boot.lo), r3(boot.hi)], days: okIx.length, block: boot.block },
      leaderSpells: { first: dist(lead1), top: dist(topT), open: openSpells }, transitions: T,
      dispersion: { spreadNow: r2(spread[last]), spreadPct: pctOf(spread, spread[last]), sdNow: r2(sd[last]), sdPct: pctOf(sd, sd[last]),
        spread11Now: r2(spread11[last]), spread11Pct: pctOf(spread11, spread11[last]), spreadMed: r2(median(spread)), spreadP90: r2(quantile(spread, .9)),
        series: D.map((d, i) => i % 5 === 0 || i === last ? [d, r2(spread[i])] : null).filter((x) => x && x[1] != null) },
      today } };
}
for (const [k, h] of Object.entries(HZ)) perHorizon[k] = horizonStudy(h);
const sensitivity = {};
for (const [k, hs] of Object.entries(SENS)) sensitivity[k] = hs.map((h) => { const s = horizonStudy(h).out; return { h, nextPeriodRankCorr: s.nextPeriodRankCorr.mean, leaderTopMed: s.leaderSpells.top.med, spreadPct: s.dispersion.spreadPct }; });

/* ---------------- 2c · RRG quadrants ---------------- */
const rrgOut = {};
for (const [k, h] of [["short", HZ.short], ["medium", HZ.medium]]) {
  const pooled = Object.fromEntries(QUADS.map((q) => [q, []])), moves = { cw: 0, ccw: 0, across: 0 }, today = [], tails = {};
  for (const s of SP) {
    const R = rrg(C[s], C.SPY, h), st = quadrantStats(R.q);
    for (const q of QUADS) pooled[q].push(...st.spells[q]);
    for (const m of Object.keys(moves)) moves[m] += st.moves[m];
    today.push({ sym: s, sector: sectorOf(s), quad: R.q[N - 1], x: r2(R.x[N - 1]), y: r2(R.y[N - 1]), daysIn: st.open?.len ?? null,
      xPct: pctOf(R.x, R.x[N - 1]) });
    tails[s] = []; for (let i = N - 60; i < N; i += 3) tails[s].push([r2(R.x[i]), r2(R.y[i])]); tails[s].push([r2(R.x[N - 1]), r2(R.y[N - 1])]);
  }
  const tot = moves.cw + moves.ccw + moves.across;
  rrgOut[k] = { h, dwell: Object.fromEntries(QUADS.map((q) => [q, { n: pooled[q].length, med: median(pooled[q]), p75: quantile(pooled[q], .75), p90: quantile(pooled[q], .9), oneDay: pooled[q].length ? r1(100 * pooled[q].filter((x) => x === 1).length / pooled[q].length) : null,
    // how today's time-in-quadrant compares with every finished stay there
  }])), moves: { ...moves, cwShare: r1(100 * moves.cw / tot), ccwShare: r1(100 * moves.ccw / tot), acrossShare: r1(100 * moves.across / tot) },
    today: today.map((t) => ({ ...t, dwellPct: t.quad && t.daysIn ? pctOf(pooled[t.quad], t.daysIn) : null })), tails };
}

/* ---------------- 2d · cap weight vs equal weight, and the other families ---------------- */
const cwew = { RSPvsSPY: {}, perSector: [], families: [] };
for (const [k, h] of Object.entries(HZ)) {
  const r = rsH(C.RSP, C.SPY, h);
  cwew.RSPvsSPY[k] = { h, now: r2(r[N - 1]), ownPct: pctOf(r, r[N - 1]), med: r2(median(r)), days: r.filter(fin).length };
}
{ const r = rsH(C.RSP, C.SPY, 1), lvl = []; let acc = 0; for (let i = 0; i < N; i++) { if (fin(r[i])) acc += r[i]; lvl.push(i % 5 === 0 || i === N - 1 ? [D[i], r2(acc)] : null); } cwew.RSPvsSPYpath = lvl.filter(Boolean); }
SECTORS.forEach((sec, j) => {
  const ew = FAMILIES.EQWT[j], cw = FAMILIES.SPDR[j], row = { sector: sec, ew, cw };
  for (const [k, h] of [["short", HZ.short], ["medium", HZ.medium]]) {
    const r = rsH(C[ew], C[cw], h); row[k] = { now: r2(r[N - 1]), ownPct: pctOf(r, r[N - 1]), days: r.filter(fin).length };
  }
  cwew.perSector.push(row);
});
for (const fam of ["ISHARES", "VANGUARD", "EQWT"]) SECTORS.forEach((sec, j) => {
  const a = rsH(C[FAMILIES[fam][j]], C.SPY, HZ.medium), b = rsH(C[FAMILIES.SPDR[j]], C.SPY, HZ.medium);
  const gap = a.map((x, i) => fin(x) && fin(b[i]) ? x - b[i] : null);
  cwew.families.push({ fam, sector: sec, fund: FAMILIES[fam][j], spdr: FAMILIES.SPDR[j], corrMedRS: r3(corr(a, b)), gapNow: r2(gap[N - 1]), gapPct: pctOf(gap, gap[N - 1]), days: gap.filter(fin).length });
});

/* ---------------- 3 · Geiger replay and the bow tie ---------------- */
// G    = readings where every rung has its full nine-line fan (comparable across history) — used for every statistic
// GALL = every reading the publisher would make (a young fund's weekly fan is short) — used for today's strips only
const G = {}, GALL = {};
for (const s of ALL_SYMS) {
  const bars = raw[s]; if (!bars) continue;
  const nextT = bars.map((b, i) => i + 1 < bars.length ? bars[i + 1].t : asofT);
  const gh = geigerHistory(bars, nextT), a = new Array(N).fill(null), b2 = new Array(N).fill(null);
  bars.forEach((b, i) => { const k = idxOf.get(dstr(b.t)); if (k == null) return; b2[k] = gh[i]; if (gh[i]?.full) a[k] = gh[i]; });
  G[s] = a; GALL[s] = b2;
}
const live = JSON.parse(fs.readFileSync(path.join(OUT, "live-geiger-snapshot.json"), "utf8"));
const replayCheck = (() => {
  const rows = []; let maxd = { d1: 0, d3: 0, w1: 0 };
  for (const [s, L] of Object.entries(live.symbols)) {
    const g = GALL[s]?.[N - 1]; if (!g) continue;
    maxd.d1 = Math.max(maxd.d1, Math.abs(g.d1 - L.rungs["1d"].tf_composite)); maxd.d3 = Math.max(maxd.d3, Math.abs(g.d3 - L.rungs["3d"].tf_composite)); maxd.w1 = Math.max(maxd.w1, Math.abs(g.w1 - L.rungs["1w"].tf_composite));
    rows.push([g.g, L.composite]);
  }
  return { funds: rows.length, maxAbsDiff: { "1d": r3(maxd.d1), "3d": r3(maxd.d3), "1w": r3(maxd.w1) }, compositePearson: r3(corr(rows.map((r) => r[0]), rows.map((r) => r[1]))), compositeSpearman: r3(spearman(rows.map((r) => r[0]), rows.map((r) => r[1]))),
    meanAbsDiff: r3(mean(rows.map((r) => Math.abs(r[0] - r[1])))), liveComputedUtc: live.computed_utc };
})();
const gv = (fam, i, key = "g") => fam.map((s) => G[s]?.[i]?.[key] ?? null);
const BT = D.map((_, i) => bowTie(gv(SP, i)));
const wing = BT.map((b) => b?.wing ?? null), spreadG = BT.map((b) => b?.spread ?? null), knot = BT.map((b) => b?.knot ?? null);
// short vs long: does the fast (1d) order oppose the slow (1w) order?
const shortLong = D.map((_, i) => { const a = gv(SP, i, "d1"), b = gv(SP, i, "w1"); return a.filter(fin).length >= 5 && b.filter(fin).length >= 5 ? spearman(a, b) : null; });
// the tie's own rotation: today's order against the order S sessions ago
const flip = {}; for (const S of [HZ.short, 38, HZ.medium]) flip[S] = D.map((_, i) => i >= S ? spearman(gv(SP, i), gv(SP, i - S)) : null);
const firstG = wing.findIndex(fin), last = N - 1;
const todayTie = { date: D[last], wing: r2(wing[last]), wingPct: pctOf(wing, wing[last]), spread: r2(spreadG[last]), spreadPct: pctOf(spreadG, spreadG[last]),
  knot: r2(knot[last]), knotPct: pctOf(knot, knot[last]), balance: BT[last].balance, shortLong: r2(shortLong[last]), shortLongPct: pctOf(shortLong, shortLong[last]),
  flip: Object.fromEntries(Object.entries(flip).map(([S, a]) => [S, { now: r2(a[last]), pct: pctOf(a, a[last]) }])),
  order: SP.map((s) => ({ sym: s, sector: sectorOf(s), g: r2(G[s][last].g), tr: r2(G[s][last].tr), mo: r2(G[s][last].mo), d1: r2(G[s][last].d1), w1: r2(G[s][last].w1), live: r2(live.symbols[s]?.composite) })).sort((a, b) => b.g - a.g) };
// every family's strip today, replayed and live
const familiesToday = Object.fromEntries(Object.entries(FAMILIES).map(([f, fam]) => {
  const vals = fam.map((s) => GALL[s]?.[last]?.g ?? null), lv = fam.map((s) => live.symbols[s]?.composite ?? null), bt = bowTie(vals), btl = bowTie(lv);
  const hist = D.map((_, i) => bowTie(gv(fam, i))?.wing ?? null);
  return [f, { funds: fam.map((s, j) => ({ sym: s, sector: SECTORS[j], g: r2(vals[j]), live: r2(lv[j]) })).sort((a, b) => (b.live ?? -9) - (a.live ?? -9)),
    wing: r2(bt?.wing), wingLive: r2(btl?.wing), wingPct: hist.some(fin) ? pctOf(hist, bt?.wing) : null, histFrom: hist.some(fin) ? D[hist.findIndex(fin)] : null,
    fullFan: fam.every((s) => G[s]?.[last] != null) }];
}));

// past occurrences: days whose shorter wing is at least today's. An episode opens when the wing reaches the level
// after at least HZ.short sessions below it; it lasts while the wing stays at or above the level.
const level = wing[last], events = wing.map((w, i) => fin(w) && w >= level && i < last);
const episodes = []; { let lastOn = -1e9, cur = null;
  for (let i = 0; i < last; i++) {
    if (events[i]) { if (!cur || i - lastOn > HZ.short) { cur = { start: i, end: i, days: 0 }; episodes.push(cur); } cur.end = i; cur.days++; lastOn = i; }
  } }
// forward outcomes at three horizons (close to close, price only)
const FWD = [HZ.short, 38, HZ.medium];
const fwdLog = (a, i, h) => i + h < N && fin(a[i]) && fin(a[i + h]) && a[i] > 0 ? 100 * Math.log(a[i + h] / a[i]) : null;
function outcomes(i, h) {
  const g = SP.map((s) => [s, G[s][i]?.g]).filter(([, v]) => fin(v)).sort((a, b) => b[1] - a[1]);
  if (g.length < 5 || i + h >= N) return null;
  const spyF = fwdLog(C.SPY, i, h); if (!fin(spyF)) return null;
  const rel = (s) => { const x = fwdLog(C[s], i, h); return fin(x) ? x - spyF : null; };
  const top = mean(g.slice(0, 3).map(([s]) => rel(s))), bot = mean(g.slice(-3).map(([s]) => rel(s)));
  const fr = g.map(([s]) => rel(s)).filter(fin), m = mean(fr);
  return { spy: spyF, wingSpread: fin(top) && fin(bot) ? top - bot : null, topRel: top, botRel: bot,
    fwdDisp: fr.length >= 5 ? Math.sqrt(mean(fr.map((x) => (x - m) ** 2))) : null, wingChange: fin(wing[i + h]) && fin(wing[i]) ? wing[i + h] - wing[i] : null };
}
const OUTK = ["spy", "wingSpread", "topRel", "botRel", "fwdDisp", "wingChange"];
const followed = {};
for (const h of FWD) {
  const O = D.map((_, i) => i >= firstG ? outcomes(i, h) : null);
  const days = O.map((o, i) => o ? i : -1).filter((i) => i >= 0);
  const ev = days.filter((i) => events[i]);
  const summ = (ix, k) => { const v = ix.map((i) => O[i][k]).filter(fin); return { n: v.length, mean: r2(mean(v)), med: r2(median(v)), up: v.length ? r1(100 * v.filter((x) => x > 0).length / v.length) : null }; };
  const res = { h, allDays: {}, likeToday: {}, diffCI: {}, byWingPct: [] };
  for (const k of OUTK) {
    res.allDays[k] = summ(days, k); res.likeToday[k] = summ(ev, k);
    // block bootstrap of (mean on like-today days − mean on all days); block = h sessions
    const bb = blockBootstrap(days.length, h, (ix) => {
      const pick = ix.map((q) => days[q]); const e = pick.filter((i) => events[i]).map((i) => O[i][k]).filter(fin);
      const a = pick.map((i) => O[i][k]).filter(fin); return e.length ? mean(e) - mean(a) : null;
    }, 600, 20260928 + h);
    res.diffCI[k] = [r2(bb.lo), r2(bb.hi)];
  }
  // the whole range, not just days like today: outcome by the wing's own-history percentile, in tenths
  const wp = days.map((i) => [pctOf(wing, wing[i]), i]);
  for (let b = 0; b < 10; b++) {
    const ix = wp.filter(([p]) => p > b * 10 && p <= (b + 1) * 10).map(([, i]) => i);
    res.byWingPct.push({ from: b * 10 + 1, to: (b + 1) * 10, n: ix.length, spy: r2(mean(ix.map((i) => O[i].spy))), wingSpread: r2(mean(ix.map((i) => O[i].wingSpread))), fwdDisp: r2(mean(ix.map((i) => O[i].fwdDisp))) });
  }
  res.rankCorr = { wingVsWingSpread: r3(spearman(days.map((i) => wing[i]), days.map((i) => O[i].wingSpread))), wingVsSpy: r3(spearman(days.map((i) => wing[i]), days.map((i) => O[i].spy))), wingVsFwdDisp: r3(spearman(days.map((i) => wing[i]), days.map((i) => O[i].fwdDisp))) };
  res.episodes = episodes.map((e) => { const o = O[e.start]; return o ? { start: D[e.start], spy: r2(o.spy), wingSpread: r2(o.wingSpread), fwdDisp: r2(o.fwdDisp) } : { start: D[e.start], pending: true }; });
  followed[h] = res;
}
const episodeList = episodes.map((e) => {
  const g = SP.map((s) => [s, G[s][e.start]?.g]).filter(([, v]) => fin(v)).sort((a, b) => b[1] - a[1]);
  return { start: D[e.start], end: D[e.end], days: e.days, peakWing: r2(Math.max(...wing.slice(e.start, e.end + 1).filter(fin))),
    green: g.slice(0, 3).map(([s, v]) => `${s} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`), red: g.slice(-3).map(([s, v]) => `${s} ${v >= 0 ? "+" : ""}${v.toFixed(2)}`) };
});
// what the last months looked like: the SPDR Geiger on each Friday (or last session of the week), last 78 weeks
const weekly = []; for (let i = firstG; i < N; i++) { const nxt = i + 1 < N ? Date.parse(D[i + 1]) : asofT; if (Math.floor((epochDay(Date.parse(D[i])) + 4) / 7) !== Math.floor((epochDay(nxt) + 4) / 7)) weekly.push(i); }
const recentWeeks = weekly.slice(-78).map((i) => ({ d: D[i], g: Object.fromEntries(SP.map((s) => [s, r2(G[s][i]?.g)])), wing: r2(wing[i]) }));

/* ---------------- 4 · today, on every measure ---------------- */
const out = {
  generated: new Date().toISOString(), asof: ASOF, lastBar: D[last],
  kind: "U2 sector rotation — descriptive statistics and own-history percentiles. Price only (split-adjusted, not dividend-adjusted). Nothing here is a buy or sell call.",
  sources, starts: Object.fromEntries(Object.entries(sources).map(([s, v]) => [s, v.from])),
  horizons: { chosen: HZ, why: HZ_WHY, swingTable, sensitivityHorizons: SENS },
  relativeStrength: Object.fromEntries(Object.entries(perHorizon).map(([k, v]) => [k, v.out])), sensitivity,
  rrg: rrgOut, capVsEqual: cwew,
  geiger: { replayCheck, weights: { "1d": 3.178477, "3d": 2.576738, "1w": 0.987499 }, from: D[firstG], today: todayTie, familiesToday,
    wingSeries: D.map((d, i) => fin(wing[i]) && (i % 5 === 0 || i === last) ? [d, r2(wing[i]), r2(spreadG[i]), r2(shortLong[i])] : null).filter(Boolean),
    wingQuantiles: Object.fromEntries([10, 25, 50, 75, 90, 95, 99].map((q) => [q, r2(quantile(wing, q / 100))])),
    episodes: episodeList, followed, recentWeeks, fwdHorizons: FWD },
};
fs.writeFileSync(path.join(OUT, "sector-rotation.json"), JSON.stringify(out));
console.log(`wrote sector-rotation.json in ${((Date.now() - t0) / 1000).toFixed(1)} s · last bar ${D[last]} · horizons`, HZ);
console.log("replay check", JSON.stringify(replayCheck));
console.log("today tie", JSON.stringify({ ...todayTie, order: todayTie.order.map((o) => o.sym + " " + o.g).join(", ") }));
console.log("episodes", episodeList.length, episodeList.map((e) => e.start).join(" "));
