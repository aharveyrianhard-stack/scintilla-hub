/* Measures the six patterns the same way M17 measured the bull flag, and writes one
   JSON file with every number the pages print. Nothing is tuned after seeing a result:
   the rules are fixed in detectors.mjs, the sweep reports every setting it tried, and
   the split-half is reported whatever it says.

   Run:  node tools/patterns/measure.mjs > deliverables/20260923/patterns/evidence/patterns.json  */

import { pathToFileURL } from "node:url";
import { daily, findFlags, randomControl } from "./bull-flag.mjs";
import { findWedge, findBearFlag, findHeadShoulders, DIRECTION, WEDGE, HS, FLAG } from "./detectors.mjs";

/* Today's listed names only — the API has no delisted history. Index funds are the
   least survivor-biased things in here; the single names include laggards on purpose
   (INTC, F, T, VZ, PFE, GE) so the set is not only the winners of the last 20 years. */
export const UNIVERSE = [
  "SPY","QQQ","DIA","IWM","EEM","EFA","TLT","GLD","SLV","XLE","XLF","XLK",
  "AAPL","MSFT","NVDA","AMZN","GOOGL","META","JPM","BAC","XOM","CVX","WMT","HD",
  "JNJ","PG","KO","DIS","NKE","IBM","MMM","INTC","CSCO","F","T","VZ","PFE","GE",
];
export const HORIZONS = [5, 20, 60];
const LOCAL_WINDOW = 250;   // days either side, for "what this symbol was doing anyway"

const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);
const fwd = (bars, i, h) => (i + h < bars.length ? (bars[i + h].c / bars[i].c - 1) * 100 : null);

export const DETECTORS = {
  "rising-wedge": (b) => findWedge(b, "rising"),
  "falling-wedge": (b) => findWedge(b, "falling"),
  "bull-flag": (b) => findFlags(b).map((f) => ({ ...f, kind: "bull-flag",
      draw: { pole: [f.p - 10, f.p], flag: [f.p + 1, f.i], from: f.p - 10, to: f.i } })),
  "bear-flag": (b) => findBearFlag(b),
  "head-shoulders": (b) => findHeadShoulders(b, "top"),
  "inverse-head-shoulders": (b) => findHeadShoulders(b, "bottom"),
};

const summ = (m) => (m.length
  ? { n: m.length, up_pct: r2(m.filter((x) => x > 0).length / m.length * 100), median_pct: r2(median(m)), mean_pct: r2(mean(m)) }
  : { n: 0, up_pct: null, median_pct: null, mean_pct: null });

/** the same symbol's ordinary move over the year either side of the signal, so a name
    that simply went up for twenty years cannot make a pattern look clever */
function localMedian(bars, i, h, cache) {
  const key = `${h}:${Math.floor(i / 50)}`;
  if (cache.has(key)) return cache.get(key);
  const moves = [];
  for (let j = Math.max(0, i - LOCAL_WINDOW); j < Math.min(bars.length - h, i + LOCAL_WINDOW); j++) {
    const m = fwd(bars, j, h); if (m != null) moves.push(m);
  }
  const v = median(moves);
  cache.set(key, v);
  return v;
}

export function measure(all, detector, horizons = HORIZONS) {
  const syms = Object.keys(all);
  const signals = {}, counts = {};
  for (const s of syms) { signals[s] = detector(all[s]); counts[s] = signals[s].length; }
  const out = { total: Object.values(counts).reduce((a, b) => a + b, 0), per_symbol: counts, horizons: {} };
  for (const h of horizons) {
    const sig = [], base = [], excess = [];
    for (const s of syms) {
      const bars = all[s], cache = new Map();
      for (const x of signals[s]) {
        const m = fwd(bars, x.i, h); if (m == null) continue;
        sig.push(m);
        const loc = localMedian(bars, x.i, h, cache);
        if (loc != null) excess.push(m - loc);
      }
      for (let i = 0; i + h < bars.length; i++) base.push(fwd(bars, i, h));
    }
    out.horizons[h] = {
      signal: summ(sig),
      any_day: summ(base),
      excess_over_local: summ(excess),      // signal move minus what that symbol was doing anyway
      random_same_count: randomControl(all, counts, h),
    };
  }
  out.signals = signals;
  return out;
}

/** survives / does not / too few.
    Five tests, all of them set before the numbers were looked at:
      1. at least 100 signals that have a 20-day outcome;
      2. the middle move beats an ordinary day, in the direction the pattern claims,
         at 20 days AND at 60 days;
      3. at least one of those is outside the band you get by drawing the same number
         of days at random — an edge inside that band is not evidence of anything;
      4. once you subtract what that symbol was doing anyway in the year around the
         signal, the edge still points the pattern's way at both horizons;
      5. the first half of history and the second half tell the same story, each
         measured against its own half's ordinary day (a bearish pattern in a rising
         market should be judged against that rising market, not against zero).      */
export function verdict(m, dir, halves) {
  const want = dir === "up" ? 1 : -1;
  const n20 = m.horizons[20].signal.n;
  if (n20 < 100) return { call: "too few", tests: [], why: `${n20} signals with a 20-day outcome. Fewer than 100 is not enough to lean on, whatever the numbers say.` };

  const tests = [];
  let edges = 0, beats = 0, locals = 0;
  for (const h of [20, 60]) {
    const s = m.horizons[h].signal, b = m.horizons[h].any_day, rc = m.horizons[h].random_same_count.median_pct;
    const edge = (s.median_pct - b.median_pct) * want;
    const loc = m.horizons[h].excess_over_local.median_pct * want;
    const outside = want > 0 ? s.median_pct > rc.p95 : s.median_pct < rc.p5;
    if (edge > 0) edges++;
    if (outside) beats++;
    if (loc > 0) locals++;
    tests.push({ test: `${h} days`, pass: edge > 0,
      text: `middle move ${s.median_pct >= 0 ? "+" : ""}${s.median_pct}% against ${b.median_pct >= 0 ? "+" : ""}${b.median_pct}% from any day — ${edge > 0 ? "the pattern's way" : "the wrong way"}.` });
    tests.push({ test: `${h} days against chance`, pass: outside,
      text: `drawing the same number of days at random gives a middle move between ${rc.p5}% and ${rc.p95}%; this is ${outside ? "outside" : "inside"} that.` });
    tests.push({ test: `${h} days after removing drift`, pass: loc > 0,
      text: `after subtracting what the same symbol was doing anyway in the year around each signal, ${m.horizons[h].excess_over_local.median_pct >= 0 ? "+" : ""}${m.horizons[h].excess_over_local.median_pct}% is left — ${loc > 0 ? "still the pattern's way" : "the wrong way"}.` });
  }
  const eE = halves && halves.early != null ? (halves.early - halves.base_early) * want : null;
  const eL = halves && halves.late != null ? (halves.late - halves.base_late) * want : null;
  const agree = eE != null && eL != null && eE > 0 && eL > 0;
  tests.push({ test: "both halves of history", pass: agree,
    text: eE == null ? "one half has too few signals to say."
      : `2003-2014: ${r2(halves.early)}% against its own ordinary ${halves.base_early}% (${eE > 0 ? "the pattern's way" : "the wrong way"}, ${halves.n_early} signals). ` +
        `2015-2026: ${r2(halves.late)}% against ${halves.base_late}% (${eL > 0 ? "the pattern's way" : "the wrong way"}, ${halves.n_late} signals).` });

  const call = edges === 2 && beats >= 1 && locals === 2 && agree ? "survives" : "does not survive";
  const failed = tests.filter((t) => !t.pass).map((t) => t.test);
  return { call, tests,
    why: call === "survives"
      ? `${n20} signals, and it passes all five tests — though read the size of the edge, not only the word.`
      : `${n20} signals. It fails on: ${failed.join("; ")}.` };
}

export function splitHalf(all, detector, h = 20, cut = Date.UTC(2015, 0, 1)) {
  const early = [], late = [], baseE = [], baseL = [];
  for (const s of Object.keys(all)) {
    const bars = all[s];
    for (const x of detector(bars)) { const m = fwd(bars, x.i, h); if (m != null) (bars[x.i].t < cut ? early : late).push(m); }
    for (let i = 0; i + h < bars.length; i++) (bars[i].t < cut ? baseE : baseL).push(fwd(bars, i, h));
  }
  return { early: median(early), late: median(late), n_early: early.length, n_late: late.length,
           base_early: r2(median(baseE)), base_late: r2(median(baseL)) };
}

/** a small sweep: the same rule with the dials moved, so a lucky setting is visible as one */
export function sweep(all, name) {
  const rows = [];
  const run = (label, det) => {
    const m = measure(all, det, [20]);
    rows.push({ setting: label, signals: m.total, up_pct: m.horizons[20].signal.up_pct,
      median_pct: m.horizons[20].signal.median_pct, excess_pct: m.horizons[20].excess_over_local.median_pct });
  };
  if (name === "rising-wedge" || name === "falling-wedge") {
    const dir = name === "rising-wedge" ? "rising" : "falling";
    for (const k of [4, 5, 7]) for (const conv of [0.6, 0.75, 0.9])
      run(`pivot ${k} days, closing to ${Math.round(conv * 100)}%`, (b) => findWedge(b, dir, { ...WEDGE, k, converge: conv }));
    for (const k of [4, 5, 7])
      run(`three touches per line, pivot ${k} days`, (b) => findWedge(b, dir, { ...WEDGE, k, touches: 3 }));
  } else if (name === "bear-flag") {
    for (const mv of [0.10, 0.15, 0.20]) for (const give of [0.4, 0.5, 0.62])
      run(`fall ${Math.round(mv * 100)}%, gives back ${Math.round(give * 100)}%`,
        (b) => findBearFlag(b, { ...FLAG, pole_min_move: mv, flag_max_giveback: give }));
  } else if (name === "bull-flag") {
    for (const mv of [0.10, 0.15, 0.20]) for (const give of [0.4, 0.5, 0.62])
      run(`rise ${Math.round(mv * 100)}%, gives back ${Math.round(give * 100)}%`,
        (b) => findFlags(b, { pole_days: 10, pole_min_gain: mv, flag_min_days: 5, flag_max_days: 15,
          flag_max_giveback: give, flag_must_tighten: true, cooloff_days: 20, horizons: HORIZONS }));
  } else {
    const dir = name === "head-shoulders" ? "top" : "bottom";
    for (const k of [4, 5, 7]) for (const tol of [0.08, 0.12, 0.18])
      run(`pivot ${k} days, shoulders within ${Math.round(tol * 100)}%`,
        (b) => findHeadShoulders(b, dir, { ...HS, k, shoulder_tol: tol }));
  }
  return rows;
}

/** one real, recent, complete example to draw */
export function pickExample(all, signals, h = 60) {
  let best = null;
  for (const s of Object.keys(signals)) {
    const bars = all[s];
    for (const x of signals[s]) {
      if (x.i + h >= bars.length) continue;
      const span = (x.draw?.to ?? x.i) - (x.draw?.from ?? x.i - 40);
      if (span < 15) continue;
      if (!best || bars[x.i].t > best.t) best = { symbol: s, ...x };
    }
  }
  if (!best) return null;
  const bars = all[best.symbol];
  const from = Math.max(0, (best.draw?.from ?? best.i - 40) - 12);
  const to = Math.min(bars.length - 1, best.i + 60);
  return {
    symbol: best.symbol, kind: best.kind, signal_index: best.i - from,
    signal_date: new Date(bars[best.i].t).toISOString().slice(0, 10),
    after: { d5: r2(fwd(bars, best.i, 5)), d20: r2(fwd(bars, best.i, 20)), d60: r2(fwd(bars, best.i, 60)) },
    draw: shiftDraw(best.draw, from),
    bars: bars.slice(from, to + 1).map((b) => ({ t: new Date(b.t).toISOString().slice(0, 10), o: r2(b.o), h: r2(b.h), l: r2(b.l), c: r2(b.c) })),
  };
}

/** every index in a drawing, moved into the slice of bars the page will show */
function shiftDraw(d, from) {
  if (!d) return null;
  const pt = (p) => ({ i: p.i - from, p: p.p });
  const out = { from: d.from - from, to: d.to - from };
  if (d.upper) out.upper = d.upper.map(pt);
  if (d.lower) out.lower = d.lower.map(pt);
  if (d.points) out.points = d.points.map(pt);
  if (d.neck) out.neck = d.neck.map(pt);
  if (d.pole) out.pole = d.pole.map((i) => i - from);
  if (d.flag) out.flag = d.flag.map((i) => i - from);
  return out;
}

async function main() {
  const all = {};
  for (const s of UNIVERSE) {
    try { all[s] = await daily(s); console.error(`  ${s.padEnd(6)} ${all[s].length} bars`); }
    catch (e) { console.error(`  ! ${s}: ${e.message}`); }
  }
  const syms = Object.keys(all);
  const doc = {
    built_utc: new Date().toISOString(),
    source: "chart API /candles?tf=D, finished daily bars only",
    universe: syms,
    history: Object.fromEntries(syms.map((s) => [s, { bars: all[s].length,
      first: new Date(all[s][0].t).toISOString().slice(0, 10), last: new Date(all[s].at(-1).t).toISOString().slice(0, 10) }])),
    rules: { pivot: WEDGE.k, wedge: WEDGE, flag: FLAG, head_shoulders: HS, cooloff_days: 20, horizons: HORIZONS,
             local_window_days: LOCAL_WINDOW },
    patterns: {},
  };
  for (const [name, det] of Object.entries(DETECTORS)) {
    console.error(`- ${name}`);
    const m = measure(all, det);
    const halves = splitHalf(all, det);
    const ex = pickExample(all, m.signals, 60);
    delete m.signals;
    doc.patterns[name] = { name, direction: DIRECTION[name], ...m, split_half: halves,
      sweep: sweep(all, name), verdict: verdict(m, DIRECTION[name], halves), example: ex };
    console.error(`    ${m.total} signals · 20d median ${m.horizons[20].signal.median_pct}% vs any-day ${m.horizons[20].any_day.median_pct}% · ${doc.patterns[name].verdict.call}`);
  }
  process.stdout.write(JSON.stringify(doc));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
