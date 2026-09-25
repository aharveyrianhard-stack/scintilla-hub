#!/usr/bin/env node
// ONE worked example of the method, on real history, read-only.
//
// The question in plain words: "when this reading is unusually high or low,
// how often has price been higher ten days later, and by how much?"
// Nothing here is advice and nothing here is live: every number is measured on
// closed daily bars, and the recent years are held back and checked separately.
const API = "https://scintilla-massive-chart-api.fly.dev";
const SPLIT_YEAR = 2019;   // everything before this is used to choose the bands
const HORIZON = 10;        // trading days ahead
const BANDS = [[0, 10], [10, 30], [30, 70], [70, 90], [90, 100]]; // where the reading sat, by rank
const PLAIN = ["Its lowest tenth", "Low, but not extreme", "The middle", "High, but not extreme", "Its highest tenth"];

const day = (ms) => new Date(ms).toISOString().slice(0, 10);

async function series(symbol) {
  const url = `${API}/candles?symbol=${encodeURIComponent(symbol)}&tf=D`;
  const body = await (await fetch(url, { headers: { accept: "application/json" } })).json();
  const rows = (body.series || []).map((b) => ({ t: b.t, c: b.c }));
  return { asked: url, rows, provider: body.provider, reported: body.full_series_count };
}

// Wilder's RSI, the same 14-day reading the screens already show.
function rsi(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    gain += Math.max(d, 0); loss += Math.max(-d, 0);
  }
  gain /= period; loss /= period;
  out[period] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    gain = (gain * (period - 1) + Math.max(d, 0)) / period;
    loss = (loss * (period - 1) + Math.max(-d, 0)) / period;
    out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
  }
  return out;
}

const quantile = (sorted, p) => {
  if (!sorted.length) return null;
  const i = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(i), hi = Math.ceil(i);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo);
};
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;

// 95% band by resampling the observations themselves (no bell-curve assumption).
function band95(xs, draws = 2000) {
  if (xs.length < 5) return null;
  const ms = [];
  let seed = 20260923;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let d = 0; d < draws; d++) {
    let s = 0;
    for (let i = 0; i < xs.length; i++) s += xs[Math.floor(rnd() * xs.length)];
    ms.push(s / xs.length);
  }
  ms.sort((a, b) => a - b);
  return [ms[Math.floor(draws * 0.025)], ms[Math.floor(draws * 0.975)]];
}

function observations(rows, readings, fromYear, toYear) {
  const obs = [];
  for (let i = 0; i < rows.length - HORIZON; i++) {
    const r = readings[i];
    if (r === null) continue;
    const y = Number(day(rows[i].t).slice(0, 4));
    if (y < fromYear || y > toYear) continue;
    obs.push({ i, day: day(rows[i].t), reading: r,
               fwd: (rows[i + HORIZON].c / rows[i].c - 1) * 100 });
  }
  return obs;
}

// Consecutive days share nine of their ten forward bars, so the honest headline
// counts only every tenth observation. The all-days figure is kept for comparison.
const thinned = (obs) => obs.filter((_, k) => k % HORIZON === 0);

function table(obs, edges) {
  const all = thinned(obs);
  const base = all.length ? { n: all.length, avg: mean(all.map((o) => o.fwd)),
    up: all.filter((o) => o.fwd > 0).length / all.length * 100 } : null;
  const bands = BANDS.map(([lo, hi], k) => {
    const inBand = all.filter((o) => o.reading >= edges[k] && (hi === 100 ? true : o.reading < edges[k + 1]));
    const fwd = inBand.map((o) => o.fwd);
    return {
      label: PLAIN[k],
      reading_from: edges[k] === null ? null : Number(edges[k].toFixed(1)),
      reading_to: hi === 100 ? null : (edges[k + 1] === null ? null : Number(edges[k + 1].toFixed(1))),
      days: inBand.length,
      avg_move: fwd.length ? Number(mean(fwd).toFixed(3)) : null,
      share_up: fwd.length ? Number((fwd.filter((x) => x > 0).length / fwd.length * 100).toFixed(1)) : null,
      band95: fwd.length ? band95(fwd)?.map((x) => Number(x.toFixed(3))) : null,
      first: inBand.length ? inBand[0].day : null,
      last: inBand.length ? inBand[inBand.length - 1].day : null,
    };
  });
  return { base_rate: base && { days: base.n, avg_move: Number(base.avg.toFixed(3)), share_up: Number(base.up.toFixed(1)) },
           bands, all_days_for_comparison: obs.length };
}

async function study(symbol) {
  const s = await series(symbol);
  const closes = s.rows.map((r) => r.c);
  const readings = rsi(closes);
  const thisYear = 2026;
  const discover = observations(s.rows, readings, 1900, SPLIT_YEAR - 1);
  const check = observations(s.rows, readings, SPLIT_YEAR, thisYear);
  // Band edges come ONLY from the discovery years, then are frozen.
  const sorted = thinned(discover).map((o) => o.reading).sort((a, b) => a - b);
  const edges = BANDS.map(([lo]) => quantile(sorted, lo));
  return {
    symbol, asked: s.asked, provider: s.provider,
    bars: s.rows.length, bars_reported: s.reported,
    history: s.rows.length ? `${day(s.rows[0].t)} → ${day(s.rows[s.rows.length - 1].t)}` : null,
    reading: "14-day RSI (the same one the screens show)",
    horizon_days: HORIZON,
    band_edges_from: `${day(s.rows[0].t)} → ${SPLIT_YEAR - 1}`,
    band_edges: edges.map((e) => e === null ? null : Number(e.toFixed(1))),
    discovery: table(discover, edges),
    held_back: table(check, edges),
    held_back_years: `${SPLIT_YEAR} → today`,
  };
}

const out = { ran_utc: new Date().toISOString(), api: API, method: {
  question: "How often has price been higher ten days after this reading, and by how much?",
  honesty: [
    "Band edges are chosen on the early years only, then frozen and applied to the held-back years.",
    "Only every tenth day is counted, because neighbouring days share nine of their ten forward bars.",
    "The 95% band comes from resampling the real observations, not from a bell curve.",
    "Nothing is forecast and nothing is live: all bars are closed daily bars.",
  ] }, studies: [] };
for (const sym of ["SPY", "US10Y"]) out.studies.push(await study(sym));
process.stdout.write(JSON.stringify(out, null, 1) + "\n");

for (const s of out.studies) {
  console.error(`\n${s.symbol}  ${s.history}  ${s.bars} bars  (${s.provider})`);
  for (const phase of ["discovery", "held_back"]) {
    const t = s[phase];
    console.error(` ${phase === "discovery" ? "early years (bands chosen here)" : "held back " + s.held_back_years}` +
      `  base rate: ${t.base_rate?.share_up}% up, avg ${t.base_rate?.avg_move}% over ${t.base_rate?.days} counted days`);
    for (const b of t.bands) {
      console.error(`   ${b.label.padEnd(24)} days ${String(b.days).padStart(4)}   up ${String(b.share_up ?? "-").padStart(5)}%   avg ${String(b.avg_move ?? "-").padStart(7)}%   95% ${b.band95 ? b.band95[0] + " to " + b.band95[1] : "-"}`);
    }
  }
}
