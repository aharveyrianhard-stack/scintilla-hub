/* S9 · RESEARCH PROGRAM — the two cheapest proofs of method, pivots not fixed windows, the market first.
   node research/statistics/s9-research.mjs [--cache-root <dir>] [--out <file>]
   Reads the durable daily-bar caches (chart API bars, copied 27 Sep: daily-bars-s9 first, then candles-f5,
   then daily-bars-s7). Writes data/s9-research.json. Read-only everywhere else; no network, no database.

   Definitions (the page repeats them in plain words)
   · Pivot (primary): symmetric window on the wick, LEFT = RIGHT = 10 — the Pivot Atom's WIN default and the
     S/R engine's window. A pivot high at bar k has a high strictly above the 10 highs before it and at or above
     the 10 after it; a low mirrors it. It is KNOWN only at bar k+10 (nothing here uses it earlier than that).
     Sensitivity rows at 5 and 20 show how much the window matters.
   · Swings: pivots in time order, forced to alternate (two highs in a row keep the higher, two lows the lower);
     then each leg's end is the actual extreme between its neighbours (the zigzag refinement). A decline runs
     from a swing high to the next swing low; its rebound is the next leg up.
   · Depth = low/high − 1. Duration = bars (sessions for funds, calendar days for Bitcoin, which trades 7 days).
   · RSI(14), Wilder (stats.mjs), read at the swing-low bar's close; own percentile = entries.mjs rsiOwnPercentile
     (prior 756 readings, needs 250).
   · Cloud lines = station-clouds.js exactly (ladder.mjs stationAverages): 13/21 EMA seeded at the first close,
     hidden 60 sessions; 50/200 SMA. "Line reached" = the LOWEST-priced line whose value the swing-low wick went
     at or below; "none" = the low stayed above all four.
   · Cloud state at a bar (Station vocabulary): f = e13 ≥ e21, m = e21 ≥ s50, o = s50 ≥ s200; the ORDER string
     lists the four lines from highest to lowest price; price position = above all / between / below all.
   · 200-day band: d = close/SMA200 − 1 in %, bands <−10, −10..−5, −5..−2, −2..0, 0..2, 2..5, 5..10, >10.
     Breaking point: the first close below −X% (the previous close was not), followed until the close is back
     above the 200-day; "further fall" = lowest close in that stretch / entry close − 1.
   · Forward returns are close to close, price only (split-adjusted, not dividend-adjusted).
   · Bad prints: the chart API's deep history carries a few impossible wicks (SPY 2004-03-16 low 11.70 against a
     close of 111.79; IWM 2004-07-30 high 5,486). A wick more than 25% beyond the bar's body (50% for Bitcoin) is
     treated as a data fault: the high/low is clamped to the body and the bar is listed in sources.<sym>.cleaned.
     Bitcoin is analysed from 2013-01-01 (earlier prints are sub-dollar and thin). */
import fs from "node:fs"; import path from "node:path"; import os from "node:os"; import { fileURLToPath, pathToFileURL } from "node:url";
import { rsiWilder, sma } from "./stats.mjs";
import { rsiOwnPercentile } from "./entries.mjs";
import { stationAverages, segment } from "./ladder.mjs";

export const PIVOT_LEN = 10, PIVOT_SENS = [5, 10, 20];
export const SYMS = ["SPY", "QQQ", "IWM", "BTCUSD"];
export const DEPTH_BUCKETS = [[0, 3, "0–3%"], [3, 5, "3–5%"], [5, 10, "5–10%"], [10, 20, "10–20%"], [20, Infinity, "20%+"]];
export const BANDS = [[-Infinity, -10, "more than 10% below"], [-10, -5, "5–10% below"], [-5, -2, "2–5% below"], [-2, 0, "0–2% below"],
  [0, 2, "0–2% above"], [2, 5, "2–5% above"], [5, 10, "5–10% above"], [10, Infinity, "more than 10% above"]];
export const BREAK_X = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 12, 15];
export const LINES = ["e13", "e21", "s50", "s200"];
export const MAX_WICK = { default: 0.25, BTCUSD: 0.5 }, START = { BTCUSD: "2013-01-01" };
/** Clamp impossible wicks to the body; returns the cleaned copy and the list of bars touched. */
export function cleanBars(bars, maxWick = 0.25) {
  const cleaned = [], out = bars.map((b) => {
    const o = +b.o, c = +b.c, h = +b.h, l = +b.l, body = Math.min(o, c), top = Math.max(o, c);
    const badLow = !(l > 0) || l < body * (1 - maxWick), badHigh = h > top * (1 + maxWick);
    if (!badLow && !badHigh) return b;
    cleaned.push({ date: new Date(b.t).toISOString().slice(0, 10), o, h, l, c, fixed: [badLow ? "low" : null, badHigh ? "high" : null].filter(Boolean).join("+") });
    return { ...b, h: badHigh ? top : h, l: badLow ? body : l };
  });
  return { bars: out, cleaned };
}
const dstr = (t) => new Date(t).toISOString().slice(0, 10);
export const r1 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 10) / 10;
export const r2 = (x) => x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100;
export const median = (xs) => { const a = xs.filter((x) => x != null && Number.isFinite(x)).sort((p, q) => p - q); if (!a.length) return null; const m = a.length >> 1; return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const quantile = (sortedAsc, q) => { if (!sortedAsc.length) return null; const p = (sortedAsc.length - 1) * q, lo = Math.floor(p), hi = Math.ceil(p); return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (p - lo); };
const share = (xs, f) => { const a = xs.filter((x) => x != null); return a.length ? 100 * a.filter(f).length / a.length : null; };

/** Symmetric-window pivots on the wick. Known at k + len. */
export function pivotPoints(highs, lows, len) {
  const out = [];
  for (let k = len; k + len < highs.length; k++) {
    let isH = true, isL = true;
    for (let j = 1; j <= len && (isH || isL); j++) {
      if (!(highs[k] > highs[k - j]) || !(highs[k] >= highs[k + j])) isH = false;
      if (!(lows[k] < lows[k - j]) || !(lows[k] <= lows[k + j])) isL = false;
    }
    if (isH) out.push({ k, type: "H", price: highs[k] });
    if (isL) out.push({ k, type: "L", price: lows[k] });
  }
  return out;
}
/** Alternating swings from pivots, each leg end moved to the true extreme between its neighbours. */
export function swings(highs, lows, len = PIVOT_LEN) {
  const pts = pivotPoints(highs, lows, len).sort((a, b) => a.k - b.k || (a.type === "H" ? -1 : 1));
  const alt = [];
  for (const p of pts) {
    const last = alt[alt.length - 1];
    if (!last) { alt.push({ ...p }); continue; }
    if (last.type === p.type) { if ((p.type === "H" && p.price > last.price) || (p.type === "L" && p.price < last.price)) alt[alt.length - 1] = { ...p }; }
    else alt.push({ ...p });
  }
  // refinement: the extreme between neighbours
  for (let i = 1; i + 1 < alt.length; i++) {
    const a = alt[i - 1].k, b = alt[i + 1].k; let best = alt[i].k;
    for (let k = a + 1; k < b; k++) {
      if (alt[i].type === "H" && highs[k] > highs[best]) best = k;
      if (alt[i].type === "L" && lows[k] < lows[best]) best = k;
    }
    alt[i] = { k: best, type: alt[i].type, price: alt[i].type === "H" ? highs[best] : lows[best] };
  }
  return alt;
}

/** Cloud state at bar i in Station words. */
export function cloudState(ma, close, i) {
  const v = LINES.map((k) => [k, ma[k][i]]).filter(([, x]) => x != null);
  if (v.length < 4) return null;
  const order = [...v].sort((a, b) => b[1] - a[1]).map(([k]) => k);
  const top = order[0], bottom = order[3];
  const pos = close > ma[top][i] ? "above all" : close < ma[bottom][i] ? "below all" : "between";
  return { f: ma.e13[i] >= ma.e21[i], m: ma.e21[i] >= ma.s50[i], o: ma.s50[i] >= ma.s200[i], order: order.join(">"), position: pos,
    bull: order.join(">") === "e13>e21>s50>s200", bear: order.join(">") === "s200>s50>e21>e13" };
}
/** The lowest-priced cloud line the wick low reached (at or below). */
export function lineReached(ma, low, i) {
  const hit = LINES.filter((k) => ma[k][i] != null && low <= ma[k][i]);
  if (!hit.length) return "none";
  return hit.sort((a, b) => ma[a][i] - ma[b][i])[0];
}

export function seriesOf(bars) {
  const c = bars.map((b) => +b.c), h = bars.map((b) => +b.h), l = bars.map((b) => +b.l), v = bars.map((b) => +(b.v ?? 0)), dates = bars.map((b) => dstr(b.t));
  const rsi = rsiWilder(c, 14), pct = rsiOwnPercentile(rsi), ma = stationAverages(c), vol50 = sma(v, 50);
  return { c, h, l, v, dates, rsi, pct, ma, vol50 };
}

/** Every decline (swing high → swing low) with its rebound, for one instrument. */
export function declines(S, len = PIVOT_LEN, vixByDate = null) {
  const sw = swings(S.h, S.l, len), out = [];
  for (let i = 0; i + 1 < sw.length; i++) {
    const a = sw[i], b = sw[i + 1];
    if (a.type !== "H" || b.type !== "L") continue;
    const nx = sw[i + 2];
    let rsiMin = Infinity, vixMax = null;
    for (let k = a.k; k <= b.k; k++) { if (S.rsi[k] != null && S.rsi[k] < rsiMin) rsiMin = S.rsi[k]; const vx = vixByDate?.get(S.dates[k]); if (vx != null && (vixMax == null || vx > vixMax)) vixMax = vx; }
    const st = cloudState(S.ma, S.c[a.k], a.k), stLow = cloudState(S.ma, S.c[b.k], b.k);
    const rec = {
      hi: S.dates[a.k], hiK: a.k, hiPrice: r2(a.price), lo: S.dates[b.k], loK: b.k, loPrice: r2(b.price),
      depth: r2((b.price / a.price - 1) * 100), bars: b.k - a.k, days: Math.round((Date.parse(S.dates[b.k]) - Date.parse(S.dates[a.k])) / 864e5),
      rsiLow: r1(S.rsi[b.k]), rsiPctLow: r1(S.pct[b.k]), rsiMin: r1(rsiMin === Infinity ? null : rsiMin),
      line: lineReached(S.ma, b.price, b.k), closeBelow200: S.ma.s200[b.k] != null ? S.c[b.k] < S.ma.s200[b.k] : null,
      stateAtHigh: st ? (st.bull ? "bull order" : st.bear ? "bear order" : "mixed") : null, positionAtLow: stLow?.position ?? null,
      volRatio: S.vol50[b.k] > 0 ? r2(S.v[b.k] / S.vol50[b.k]) : null,
      vixLow: vixByDate ? (vixByDate.get(S.dates[b.k]) ?? null) : null, vixMax,
      rebound: nx ? r2((nx.price / b.price - 1) * 100) : null, reboundBars: nx ? nx.k - b.k : null,
      retrace: nx ? r1(100 * (nx.price - b.price) / (a.price - b.price)) : null, newHigh: nx ? nx.price > a.price : null,
      confirmedAt: S.dates[Math.min(b.k + len, S.dates.length - 1)],
    };
    out.push(rec);
  }
  return out;
}

export function bucketOf(depth) { const d = -depth; return DEPTH_BUCKETS.find(([a, b]) => d >= a && d < b)?.[2] ?? null; }
export function depthTable(recs) {
  return DEPTH_BUCKETS.map(([, , label]) => {
    const g = recs.filter((r) => bucketOf(r.depth) === label);
    const lines = Object.fromEntries(LINES.concat("none").map((k) => [k, r1(share(g, (r) => r.line === k))]));
    return { bucket: label, n: g.length, depthMed: r1(median(g.map((r) => r.depth))), barsMed: median(g.map((r) => r.bars)), daysMed: median(g.map((r) => r.days)),
      rsiLowMed: r1(median(g.map((r) => r.rsiLow))), rsiPctLowMed: r1(median(g.map((r) => r.rsiPctLow))), rsiLowQ1: r1(quantile(g.map((r) => r.rsiLow).filter((x) => x != null).sort((a, b) => a - b), 0.25)), rsiLowQ3: r1(quantile(g.map((r) => r.rsiLow).filter((x) => x != null).sort((a, b) => a - b), 0.75)),
      lines, below200: r1(share(g, (r) => r.closeBelow200 === true)), bullAtHigh: r1(share(g, (r) => r.stateAtHigh === "bull order")),
      volRatioMed: r2(median(g.map((r) => r.volRatio))), vixLowMed: r1(median(g.map((r) => r.vixLow))),
      reboundMed: r1(median(g.map((r) => r.rebound))), reboundBarsMed: median(g.map((r) => r.reboundBars)), retraceMed: r1(median(g.map((r) => r.retrace))), newHigh: r1(share(g.filter((r) => r.newHigh != null), (r) => r.newHigh)) };
  });
}

/** Who turned first: for each SPY decline of at least minDepth, the nearest swing low of every other instrument. */
export function leadLag(byUniverse, minDepth = 5, windowDays = 30) {
  const spy = byUniverse.SPY.filter((r) => r.depth <= -minDepth);
  const rows = spy.map((r) => {
    const t0 = Date.parse(r.lo), others = {};
    for (const s of SYMS) { if (s === "SPY") continue;
      let best = null;
      for (const o of byUniverse[s] ?? []) { const dd = Math.round((Date.parse(o.lo) - t0) / 864e5); if (Math.abs(dd) <= windowDays && (best == null || Math.abs(dd) < Math.abs(best.offset))) best = { offset: dd, lo: o.lo, depth: o.depth, rsiLow: o.rsiLow }; }
      others[s] = best;
    }
    const eq = ["QQQ", "IWM"].filter((s) => others[s]).map((s) => [s, others[s].offset]).concat([["SPY", 0]]).sort((a, b) => a[1] - b[1]);
    const first = eq.length ? (eq.filter((e) => e[1] === eq[0][1]).map((e) => e[0]).join("=")) : null;
    return { hi: r.hi, lo: r.lo, depth: r.depth, rsiLow: r.rsiLow, line: r.line, vixMax: r.vixMax, others, firstEquity: first, rebound: r.rebound };
  });
  const summary = {};
  for (const s of SYMS) { if (s === "SPY") continue;
    const offs = rows.map((r) => r.others[s]?.offset).filter((x) => x != null);
    summary[s] = { matched: offs.length, of: rows.length, earlier: offs.filter((x) => x < 0).length, same: offs.filter((x) => x === 0).length, later: offs.filter((x) => x > 0).length, medianOffset: median(offs) };
  }
  return { rows, summary };
}

/** 200-day band study. */
export function bandOf200(d) { return BANDS.find(([a, b]) => d >= a && d < b)?.[2] ?? null; }
export function bandStudy(S, since = null) {
  const n = S.c.length, d = S.c.map((x, i) => S.ma.s200[i] > 0 ? (x / S.ma.s200[i] - 1) * 100 : null);
  const fwd = (i, h) => i + h < n ? (S.c[i + h] / S.c[i] - 1) * 100 : null;
  const mdd = (i, h) => { if (i + h >= n) return null; let m = Infinity; for (let k = i + 1; k <= i + h; k++) m = Math.min(m, S.c[k]); return (m / S.c[i] - 1) * 100; };
  const idx = []; for (let i = 0; i < n; i++) if (d[i] != null && (!since || S.dates[i] >= since)) idx.push(i);
  const bands = BANDS.map(([, , label]) => {
    const g = idx.filter((i) => bandOf200(d[i]) === label);
    const f20 = g.map((i) => fwd(i, 20)), f60 = g.map((i) => fwd(i, 60)), dd = g.map((i) => mdd(i, 60));
    return { band: label, days: g.length, shareDays: r1(100 * g.length / idx.length), up20: r1(share(f20, (x) => x > 0)), med20: r2(median(f20)), up60: r1(share(f60, (x) => x > 0)), med60: r2(median(f60)), mdd60Med: r2(median(dd)), mdd60Bad: r1(share(dd, (x) => x <= -10)) };
  });
  const base = { up20: r1(share(idx.map((i) => fwd(i, 20)), (x) => x > 0)), med20: r2(median(idx.map((i) => fwd(i, 20)))), up60: r1(share(idx.map((i) => fwd(i, 60)), (x) => x > 0)), med60: r2(median(idx.map((i) => fwd(i, 60)))), mdd60Med: r2(median(idx.map((i) => mdd(i, 60)))) };
  // breaking point
  const breaks = BREAK_X.map((X) => {
    const ev = [];
    let i = 0;
    while (i < n) {
      if (d[i] == null || (since && S.dates[i] < since) || !(d[i] < -X) || !(i > 0 && d[i - 1] != null && d[i - 1] >= -X)) { i++; continue; }
      let m = S.c[i], mk = i, j = i + 1;
      while (j < n && !(d[j] != null && d[j] > 0)) { if (S.c[j] < m) { m = S.c[j]; mk = j; } j++; }
      const reclaimed = j < n;
      ev.push({ date: S.dates[i], further: (m / S.c[i] - 1) * 100, toLow: mk - i, toReclaim: reclaimed ? j - i : null, reclaimed, f60: fwd(i, 60), f120: fwd(i, 120) });
      i = reclaimed ? j : n;
    }
    return { X, n: ev.length, furtherMed: r1(median(ev.map((e) => e.further))), furtherQ1: r1(quantile(ev.map((e) => e.further).sort((a, b) => a - b), 0.25)), furtherWorst: r1(Math.min(...ev.map((e) => e.further))),
      another5: r1(share(ev, (e) => e.further <= -5)), another10: r1(share(ev, (e) => e.further <= -10)), another20: r1(share(ev, (e) => e.further <= -20)),
      reclaimMed: median(ev.filter((e) => e.reclaimed).map((e) => e.toReclaim)), reclaim60: r1(share(ev, (e) => e.reclaimed && e.toReclaim <= 60)), up60: r1(share(ev.map((e) => e.f60), (x) => x > 0)), med60: r2(median(ev.map((e) => e.f60))), up120: r1(share(ev.map((e) => e.f120), (x) => x > 0)), med120: r2(median(ev.map((e) => e.f120))),
      events: ev.map((e) => ({ date: e.date, further: r1(e.further), toReclaim: e.toReclaim })) };
  });
  return { bands, base, breaks, days: idx.length, from: S.dates[idx[0]], to: S.dates[idx[idx.length - 1]] };
}

/** RSI percentile → value, 5% steps. */
export function rsiLadder(rsi, since = null, dates = null) {
  const a = rsi.map((x, i) => [x, i]).filter(([x, i]) => x != null && (!since || dates[i] >= since)).map(([x]) => x).sort((p, q) => p - q);
  const steps = []; for (let q = 5; q <= 95; q += 5) steps.push({ pct: q, rsi: r1(quantile(a, q / 100)) });
  return { n: a.length, steps };
}

/* ---------------------------- runner ---------------------------- */
export function loadBars(ROOT, sym) {
  for (const [dir, key] of [["daily-bars-s9", "series"], ["candles-f5", "series"], ["daily-bars-s7", null]]) {
    const f = path.join(ROOT, dir, sym + ".json");
    if (!fs.existsSync(f)) continue;
    const j = JSON.parse(fs.readFileSync(f, "utf8")); const bars = key ? j[key] : j;
    return { bars, src: dir, provider: key ? j.provider : "MASSIVE", basis: key ? j.price_basis : "SPLIT_ADJUSTED" };
  }
  return null;
}

export function run(ROOT) {
  const out = { generated: new Date().toISOString(), kind: "S9 research program — proofs of method (pivot swings, 200-day band). Descriptive; nothing here predicts.", pivotLen: PIVOT_LEN, sources: {}, instruments: {}, leadLag: null, band: {}, rsiLadder: {}, sensitivity: {} };
  const vixRaw = loadBars(ROOT, "VIX");
  const vixByDate = vixRaw ? new Map(vixRaw.bars.map((b) => [dstr(b.t), +b.c])) : null;
  if (vixRaw) out.sources.VIX = { src: vixRaw.src, provider: vixRaw.provider, bars: vixRaw.bars.length, from: dstr(vixRaw.bars[0].t), to: dstr(vixRaw.bars.at(-1).t) };
  const byU = {}, S_ = {};
  for (const sym of SYMS) {
    const L = loadBars(ROOT, sym); if (!L) { out.instruments[sym] = { missing: true }; continue; }
    const raw = START[sym] ? L.bars.filter((b) => dstr(b.t) >= START[sym]) : L.bars;
    const { bars: clean, cleaned } = cleanBars(raw, MAX_WICK[sym] ?? MAX_WICK.default);
    const { bars, dropped, note } = segment(clean);
    const S = seriesOf(bars); S_[sym] = S;
    out.sources[sym] = { src: L.src, provider: L.provider, basis: L.basis, bars: bars.length, from: S.dates[0], to: S.dates.at(-1), dropped, note, start: START[sym] ?? null, cleaned, maxWick: MAX_WICK[sym] ?? MAX_WICK.default };
    const recs = declines(S, PIVOT_LEN, sym === "BTCUSD" ? vixByDate : vixByDate); byU[sym] = recs;
    const sens = {}; for (const len of PIVOT_SENS) { const r = declines(S, len); sens[len] = { declines: r.length, depthMed: r1(median(r.map((x) => x.depth))), barsMed: median(r.map((x) => x.bars)), big10: r.filter((x) => x.depth <= -10).length }; }
    out.sensitivity[sym] = sens;
    out.instruments[sym] = { declines: recs.length, depthTable: depthTable(recs), depthTable2015: depthTable(recs.filter((r) => r.lo >= "2015-01-01")),
      biggest: recs.filter((r) => r.depth <= -10).sort((a, b) => a.depth - b.depth), recent: recs.slice(-12), all: recs,
      rsiAtLowAll: { med: r1(median(recs.map((r) => r.rsiLow))), q1: r1(quantile(recs.map((r) => r.rsiLow).filter((x) => x != null).sort((a, b) => a - b), 0.25)), q3: r1(quantile(recs.map((r) => r.rsiLow).filter((x) => x != null).sort((a, b) => a - b), 0.75)) } };
    if (sym === "SPY" || sym === "QQQ") {
      out.band[sym] = { full: bandStudy(S), since2010: bandStudy(S, "2010-01-01") };
      out.rsiLadder[sym] = { full: rsiLadder(S.rsi), last3y: rsiLadder(S.rsi, S.dates[Math.max(0, S.dates.length - 756)], S.dates) };
    }
  }
  out.leadLag = { min5: leadLag(byU, 5), min10: leadLag(byU, 10) };
  // a compact zigzag path for the SPY chart (2018→)
  const spy = S_.SPY; if (spy) {
    const sw = swings(spy.h, spy.l, PIVOT_LEN).filter((p) => spy.dates[p.k] >= "2018-01-01");
    out.chart = { spySwings: sw.map((p) => ({ d: spy.dates[p.k], t: p.type, p: r2(p.price) })),
      spyClose: spy.dates.map((d, i) => d >= "2018-01-01" ? [d, r2(spy.c[i]), r2(spy.ma.s200[i])] : null).filter(Boolean) };
  }
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), opt = (k) => args.includes(k) ? args[args.indexOf(k) + 1] : null;
  const ROOT = opt("--cache-root") ?? path.join(os.homedir(), "Library/Application Support/scintilla/stats-cache");
  const OUT = opt("--out") ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "data/s9-research.json");
  const t0 = Date.now(); const out = run(ROOT);
  fs.writeFileSync(OUT, JSON.stringify(out));
  console.log(`wrote ${OUT} in ${Date.now() - t0} ms`);
  for (const s of SYMS) { const I = out.instruments[s]; console.log(s, I.missing ? "MISSING" : `${I.declines} declines, ${I.biggest.length} of 10%+, RSI at low median ${I.rsiAtLowAll.med}`); }
}
