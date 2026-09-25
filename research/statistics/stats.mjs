/* Scintilla · statistics framework (SCI-6) · shared arithmetic.
   Pure functions, no fetch, no clock. Used by the build script (node), the page (browser) and the tests.

   Definitions, stated once so every number on the page means the same thing:
   · a "day" is a finished daily bar; a daily move is 100 * (close / previous close - 1).
   · RSI(14) is Wilder's: U/D split of close changes, first average = plain mean of 14 changes,
     then RMA (avg = (prev*13 + new)/14). RSI = 100 - 100/(1+RS). When the average loss is 0 the
     rulebook (I-8) says RSI = 100, and that is what this returns.
   · distance to the 200-day is 100 * (close / SMA200 - 1), SMA over the last 200 closes including today.
   · the usual day is the sample standard deviation (n-1) of the last 60 daily moves, the same
     formula the board's heartbeat and the sigma detector use; it needs all 60 moves here.
   · "prior observations only": the window for today's reading holds the values BEFORE today; today's
     own value is never inside the sample it is compared with.
   · percentile = 100 * (count of prior values below today + half the count equal to it) / n.
   · Z = (today - mean) / sd, sd sample (n-1). Undefined when sd is 0 or n < 2, and it says so.
   · a window shorter than asked (history too short) is flagged, never silently accepted;
     fewer than MIN_N valid values is "too few" and the stats are shown but flagged. */

export const WINDOWS = { "1y": 252, "3y": 756, "all": Infinity };
export const MIN_N = 30;
export const USUAL_SESSIONS = 60;

export function pctMoves(closes) {
  const out = new Array(closes.length).fill(null);
  for (let i = 1; i < closes.length; i++) {
    const a = closes[i - 1], b = closes[i];
    out[i] = (a > 0 && b > 0) ? (b / a - 1) * 100 : null;
  }
  return out;
}

export function rsiWilder(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (closes.length <= period) return out;
  let up = 0, down = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) up += d; else down -= d;
  }
  up /= period; down /= period;
  out[period] = rsiFrom(up, down);
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    up = (up * (period - 1) + (d > 0 ? d : 0)) / period;
    down = (down * (period - 1) + (d < 0 ? -d : 0)) / period;
    out[i] = rsiFrom(up, down);
  }
  return out;
}
function rsiFrom(up, down) {
  if (down === 0) return 100;          // rulebook I-8: RSI = 100 when RMA(D) = 0
  const rs = up / down;
  return 100 - 100 / (1 + rs);
}

export function sma(closes, len) {
  const out = new Array(closes.length).fill(null);
  let s = 0;
  for (let i = 0; i < closes.length; i++) {
    s += closes[i];
    if (i >= len) s -= closes[i - len];
    if (i >= len - 1) out[i] = s / len;
  }
  return out;
}

export function distanceToSma(closes, len = 200) {
  const m = sma(closes, len);
  return m.map((v, i) => (v == null || !(v > 0)) ? null : (closes[i] / v - 1) * 100);
}

export function stdevSample(xs) {
  const n = xs.length;
  if (n < 2) return null;
  const m = xs.reduce((s, x) => s + x, 0) / n;
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (n - 1));
}

export function usualDay(closes, sessions = USUAL_SESSIONS) {
  const moves = pctMoves(closes);
  const out = new Array(closes.length).fill(null);
  for (let i = sessions; i < closes.length; i++) {
    const win = moves.slice(i - sessions + 1, i + 1);
    if (win.some((v) => v == null)) continue;
    out[i] = stdevSample(win);
  }
  return out;
}

/** The prior window: valid values strictly before `todayIdx`, at most `window` sessions back. */
export function priorWindow(values, todayIdx, window) {
  const start = Number.isFinite(window) ? Math.max(0, todayIdx - window) : 0;
  const out = [];
  for (let i = start; i < todayIdx; i++) if (values[i] != null && Number.isFinite(values[i])) out.push(values[i]);
  return { values: out, sessions_asked: Number.isFinite(window) ? window : todayIdx, sessions_covered: todayIdx - start };
}

export function percentileOf(prior, x) {
  if (!prior.length) return null;
  let below = 0, equal = 0;
  for (const v of prior) { if (v < x) below++; else if (v === x) equal++; }
  return 100 * (below + equal / 2) / prior.length;
}

export function quantile(sortedAsc, q) {
  if (!sortedAsc.length) return null;
  const pos = (sortedAsc.length - 1) * q;
  const lo = Math.floor(pos), hi = Math.ceil(pos);
  return sortedAsc[lo] + (sortedAsc[hi] - sortedAsc[lo]) * (pos - lo);
}

/** Everything the page prints for one reading against one window. */
export function describe(values, todayIdx, window, levels = {}) {
  const today = values[todayIdx];
  const { values: prior, sessions_asked, sessions_covered } = priorWindow(values, todayIdx, window);
  const n = prior.length;
  const res = {
    today: today == null ? null : today,
    n, sessions_asked, sessions_covered,
    short_history: Number.isFinite(window) ? sessions_covered < window : false,
    too_few: n < MIN_N,
    mean: null, sd: null, z: null, z_note: null, percentile: null, min: null, max: null, median: null,
    q10: null, q90: null, levels: {},
  };
  if (!n) return res;
  const sorted = [...prior].sort((a, b) => a - b);
  res.mean = prior.reduce((s, v) => s + v, 0) / n;
  res.sd = stdevSample(prior);
  res.min = sorted[0]; res.max = sorted[n - 1]; res.median = quantile(sorted, 0.5);
  res.q10 = quantile(sorted, 0.10); res.q90 = quantile(sorted, 0.90);
  if (today != null) {
    res.percentile = percentileOf(prior, today);
    if (res.sd == null) res.z_note = "undefined: fewer than two prior values";
    else if (res.sd === 0) res.z_note = "undefined: zero variance (every prior value identical)";
    else res.z = (today - res.mean) / res.sd;
  }
  for (const [name, spec] of Object.entries(levels)) {
    const at = spec.at;
    const count = spec.side === "below" ? prior.filter((v) => v <= at).length : prior.filter((v) => v >= at).length;
    res.levels[name] = { at, side: spec.side, count, share: 100 * count / n };
  }
  return res;
}

/* The levels the rulebook names. RSI: Wilder's 70/30 (I-8 FIXED default). Distance to the 200-day:
   the rulebook makes the SMA-200 a dynamic level (I-4) but names no distance line, so the only
   rulebook-backed lines are "above" and "below" the average; the ±10% and ±20% lines are reference
   lines chosen here and labelled as such. Usual day: no rulebook level exists. */
export const LEVELS = {
  rsi14: { "at or below 30 (Wilder OS)": { at: 30, side: "below" }, "at or above 70 (Wilder OB)": { at: 70, side: "above" },
           "at or below 20": { at: 20, side: "below" }, "at or above 80": { at: 80, side: "above" } },
  dist200: { "below the 200-day": { at: 0, side: "below" }, "above the 200-day": { at: 0, side: "above" },
             "10% or more below (reference line, not the rulebook's)": { at: -10, side: "below" },
             "10% or more above (reference line, not the rulebook's)": { at: 10, side: "above" },
             "20% or more below (reference line, not the rulebook's)": { at: -20, side: "below" },
             "20% or more above (reference line, not the rulebook's)": { at: 20, side: "above" } },
  usual60: {},
};

export const INDICATORS = {
  rsi14:   { label: "RSI(14), daily",            unit: "",  compute: (c) => rsiWilder(c, 14) },
  dist200: { label: "distance to the 200-day",   unit: "%", compute: (c) => distanceToSma(c, 200) },
  usual60: { label: "usual day (60-session sd)", unit: "%", compute: (c) => usualDay(c, 60) },
};

/** Holes and wild prints in the stored history, disclosed rather than smoothed over:
    gaps longer than 10 calendar days between consecutive bars, and daily moves beyond ±50%. */
export function historyCheck(bars, closes) {
  const gaps = [], wild = [];
  const moves = pctMoves(closes);
  for (let i = 1; i < bars.length; i++) {
    const days = Math.round((bars[i].t - bars[i - 1].t) / 86400e3);
    if (days > 10) gaps.push({ from: new Date(bars[i - 1].t).toISOString().slice(0, 10), to: new Date(bars[i].t).toISOString().slice(0, 10), days });
    if (moves[i] != null && Math.abs(moves[i]) > 50) wild.push({ date: new Date(bars[i].t).toISOString().slice(0, 10), move: Math.round(moves[i] * 10) / 10 });
  }
  return { gaps, wild_moves: wild.length, wild_examples: wild.slice(0, 8) };
}

/** One symbol, all indicators, all windows. `bars` = [{t, c}] finished daily bars, oldest first. */
export const BREAK_DAYS = 365;   // a hole longer than this is a different listing or a delisting, not a pause

export function analyseSymbol(bars) {
  const allCloses = bars.map((b) => +b.c);
  const dateOf = (t) => new Date(t).toISOString().slice(0, 10);
  const history = historyCheck(bars, allCloses);
  // the analysed segment starts after the last hole longer than BREAK_DAYS (e.g. BE: another company traded
  // under the ticker 2003-2008, then nothing until Bloom listed in 2018 — those bars are not "its own history")
  let start = 0;
  for (const g of history.gaps) if (g.days > BREAK_DAYS) start = bars.findIndex((b) => dateOf(b.t) === g.to);
  const closes = allCloses.slice(start);
  const todayIdx = closes.length - 1;
  history.analysis_start = dateOf(bars[start].t);
  history.bars_before_start = start;
  history.wild_moves_in_segment = history.wild_examples.filter((w) => w.date > history.analysis_start).length;
  const out = { bars: closes.length, first_day: dateOf(bars[start].t), source_date: dateOf(bars[bars.length - 1].t),
    history, indicators: {} };
  for (const [key, ind] of Object.entries(INDICATORS)) {
    const series = ind.compute(closes);
    const valid = series.filter((v) => v != null).length;
    const block = { label: ind.label, unit: ind.unit, today: series[todayIdx], valid_days: valid, windows: {} };
    for (const [wname, w] of Object.entries(WINDOWS)) block.windows[wname] = describe(series, todayIdx, w, LEVELS[key]);
    out.indicators[key] = block;
  }
  return out;
}
