/* ONE pattern, end to end: the bull flag.
   A rule written in plain words, turned into a detector that can only see the past,
   counted over every day of stored history, and then attacked three ways to see
   whether the result is luck. Nothing here is tuned after seeing the answer:
   the numbers below are written down first and reported whatever they say.

   The rule in words
     A sharp run up (the pole), then a short, tight pause that gives back only part
     of the run (the flag), then a close above the pause's high (the breakout).
     The breakout day is the signal. We measure what the price did over the next
     5, 20 and 60 finished days.

   Run:  node tools/patterns/bull-flag.mjs > deliverables/.../bull-flag.json           */

import { pathToFileURL } from "node:url";

const API = "https://scintilla-massive-chart-api.fly.dev";

export const RULES = {
  pole_days: 10,          // the run is measured over this many finished days
  pole_min_gain: 0.15,    // and must be at least this big
  flag_min_days: 5,       // the pause is at least this long
  flag_max_days: 15,      // and at most this long
  flag_max_giveback: 0.5, // it may give back at most half the run
  flag_must_tighten: true,// its daily swings must be smaller than the pole's
  cooloff_days: 20,       // a second signal inside this many days of one already taken is skipped
  horizons: [5, 20, 60],
};

export const UNIVERSE = ["SPY","DIA","IWM","AAPL","MSFT","NVDA","AMZN","GOOGL","META","JPM",
                         "XOM","WMT","JNJ","PG","KO","CVX","HD","INTC","CSCO","F","GLD","XLE"];

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const median = (a) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y), m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const r2 = (x) => (x == null ? null : Math.round(x * 100) / 100);

export async function daily(symbol) {
  const r = await fetch(`${API}/candles?symbol=${encodeURIComponent(symbol)}&tf=D&limit=40000`);
  if (!r.ok) throw new Error(`${symbol}: ${r.status}`);
  const j = await r.json();
  return (j.series || []).filter((b) => isFinite(b.c) && b.c > 0).sort((a, b) => a.t - b.t);
}

/** every bull flag in one symbol's history. Uses bars up to the signal day only. */
export function findFlags(bars, R = RULES) {
  const out = [];
  let lastTaken = -Infinity;
  for (let p = R.pole_days; p < bars.length; p++) {
    const start = bars[p - R.pole_days], top = bars[p];
    const gain = top.c / start.c - 1;
    if (!(gain >= R.pole_min_gain)) continue;
    const poleHigh = Math.max(...bars.slice(p - R.pole_days, p + 1).map((b) => b.h));
    const poleRange = mean(bars.slice(p - R.pole_days, p + 1).map((b) => (b.h - b.l) / b.c));
    const poleBase = start.c;
    for (let f = p + R.flag_min_days; f <= p + R.flag_max_days && f < bars.length; f++) {
      const flag = bars.slice(p + 1, f + 1);
      if (flag.length < R.flag_min_days) continue;
      const flagHigh = Math.max(...flag.map((b) => b.h));
      const flagLow = Math.min(...flag.map((b) => b.l));
      const giveback = (poleHigh - flagLow) / (poleHigh - poleBase);
      if (!(giveback > 0 && giveback <= R.flag_max_giveback)) break;       // it fell too far: not a pause
      if (flagHigh > poleHigh * 1.02) break;                              // it kept running: not a pause
      const flagRange = mean(flag.map((b) => (b.h - b.l) / b.c));
      const tight = flagRange < poleRange;
      const prior = bars.slice(p + 1, f);                                  // the breakout day itself is excluded
      const priorHigh = prior.length ? Math.max(...prior.map((b) => b.h)) : flagHigh;
      if (bars[f].c > priorHigh && (!R.flag_must_tighten || tight)) {
        if (f - lastTaken >= R.cooloff_days) { out.push({ i: f, t: bars[f].t, p, pole_gain: gain, giveback, tight }); lastTaken = f; }
        break;                                                             // one signal per pole
      }
    }
  }
  return out;
}

/** the same pole and breakout, but with no requirement that the pause be tight or shallow */
export function findStrengthOnly(bars, R = RULES) {
  const out = []; let lastTaken = -Infinity;
  for (let p = R.pole_days; p < bars.length - 1; p++) {
    if (!(bars[p].c / bars[p - R.pole_days].c - 1 >= R.pole_min_gain)) continue;
    for (let f = p + R.flag_min_days; f <= p + R.flag_max_days && f < bars.length; f++) {
      const prior = bars.slice(p + 1, f);
      const priorHigh = prior.length ? Math.max(...prior.map((b) => b.h)) : bars[p].h;
      if (bars[f].c > priorHigh) { if (f - lastTaken >= R.cooloff_days) { out.push({ i: f, t: bars[f].t }); lastTaken = f; } break; }
    }
  }
  return out;
}

export function outcomes(bars, idx, h) {
  const moves = [];
  for (const i of idx) { if (i + h >= bars.length) continue; moves.push((bars[i + h].c / bars[i].c - 1) * 100); }
  if (!moves.length) return { n: 0, up_pct: null, median_pct: null, mean_pct: null };
  return { n: moves.length, up_pct: r2(moves.filter((m) => m > 0).length / moves.length * 100),
           median_pct: r2(median(moves)), mean_pct: r2(mean(moves)) };
}

/** what a coin flip looks like: the same number of days per symbol, picked at random */
export function randomControl(all, counts, h, draws = 300, seed = 20260923) {
  let s = seed;
  const rnd = () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff; };
  const ups = [], meds = [];
  for (let d = 0; d < draws; d++) {
    const moves = [];
    for (const [sym, n] of Object.entries(counts)) {
      const bars = all[sym]; if (!bars) continue;
      for (let k = 0; k < n; k++) {
        const i = Math.floor(rnd() * (bars.length - h - 1));
        moves.push((bars[i + h].c / bars[i].c - 1) * 100);
      }
    }
    if (!moves.length) continue;
    ups.push(moves.filter((m) => m > 0).length / moves.length * 100);
    meds.push(median(moves));
  }
  const q = (a, p) => { const s2 = [...a].sort((x, y) => x - y); return r2(s2[Math.floor(p * (s2.length - 1))]); };
  return { draws: ups.length, up_pct: { p5: q(ups, 0.05), p50: q(ups, 0.5), p95: q(ups, 0.95) },
           median_pct: { p5: q(meds, 0.05), p50: q(meds, 0.5), p95: q(meds, 0.95) } };
}

async function main() {
  const all = {}, flags = {}, strength = {};
  for (const sym of UNIVERSE) {
    try { all[sym] = await daily(sym); } catch (e) { console.error(`  ! ${sym}: ${e.message}`); continue; }
    flags[sym] = findFlags(all[sym]);
    strength[sym] = findStrengthOnly(all[sym]);
    console.error(`  ${sym.padEnd(6)} ${all[sym].length} bars  ${flags[sym].length} flags  ${strength[sym].length} strength-only`);
  }
  const syms = Object.keys(all);
  const result = { built_utc: new Date().toISOString(), rules: RULES, universe: syms,
    history: Object.fromEntries(syms.map((s) => [s, { bars: all[s].length,
      first: new Date(all[s][0].t).toISOString().slice(0, 10), last: new Date(all[s].at(-1).t).toISOString().slice(0, 10) }])),
    per_symbol: Object.fromEntries(syms.map((s) => [s, flags[s].length])), horizons: {} };
  for (const h of RULES.horizons) {
    const flagMoves = [], baseMoves = [], strengthMoves = [];
    const counts = {};
    for (const s of syms) {
      counts[s] = flags[s].length;
      for (const f of flags[s]) if (f.i + h < all[s].length) flagMoves.push((all[s][f.i + h].c / all[s][f.i].c - 1) * 100);
      for (const f of strength[s]) if (f.i + h < all[s].length) strengthMoves.push((all[s][f.i + h].c / all[s][f.i].c - 1) * 100);
      for (let i = 0; i + h < all[s].length; i++) baseMoves.push((all[s][i + h].c / all[s][i].c - 1) * 100);
    }
    const summ = (m) => ({ n: m.length, up_pct: r2(m.filter((x) => x > 0).length / m.length * 100),
      median_pct: r2(median(m)), mean_pct: r2(mean(m)) });
    result.horizons[h] = {
      flag: summ(flagMoves),
      strength_only: summ(strengthMoves),
      any_day: summ(baseMoves),
      random_same_count: randomControl(all, counts, h),
    };
  }
  process.stdout.write(JSON.stringify(result));
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) main();
