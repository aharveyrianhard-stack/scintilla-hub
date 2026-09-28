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

/* ---- S6 · into the report: the run-up, the report day and the five sessions after --------------
   Descriptive only. It counts what happened around past reports; it does not say what happens next.
   · a report "happened" when earnings_events has an eps_actual and superseded_at is null.
   · the report session is the first session that trades on the news:
       BMO (before the open)      -> the report date's own session (or the next one if that date is closed);
       AMC (after the close)      -> the first session after the report date;
       a clock time (e.g. 08:30)  -> before 09:30 as BMO, from 16:00 as AMC, in between as the same session;
       anything else (null, TBD)  -> "unknown", treated as the next session and flagged.
   · r = index of the report session. The run-up is close[r-1] / close[r-1-20] - 1: the 20 sessions that
     end with the last close before the news. The report day is close[r] / close[r-1] - 1. The five after
     are close[r+5] / close[r] - 1.
   · the scale is the usual day (usualDay, 60-session sample sd) read at close[r-1-20], the close the
     run-up starts from, so no measured move is inside its own yardstick (prior observations only).
     "in usual days" = the % move / that usual day. A 20-session path of ordinary days typically spans
     about sqrt(20) = 4.5 usual days either way, so a run-up of 2 usual days is not by itself unusual;
     the "any 20 sessions" baseline row exists to make that comparison explicit.
   · a report is left out, with its reason recorded, when: it falls before the name's own history
     starts, no session has traded on it yet, fewer than 21 prior sessions exist, or the usual day is not
     yet defined at the run-up start. Missing five-after sessions (the latest report) drop that report
     from the five-after column only. */
export const RUNUP_SESSIONS = 20;
export const AFTER_SESSIONS = 5;
export const MIN_REPORTS = 8;

export function reportTiming(reportTime) {
  const s = String(reportTime ?? "").trim().toUpperCase();
  if (s === "BMO") return { timing: "BMO", rule: "same", flagged: false };
  if (s === "AMC") return { timing: "AMC", rule: "next", flagged: false };
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (m) {
    const mins = +m[1] * 60 + +m[2];
    if (mins < 9 * 60 + 30) return { timing: "BMO", rule: "same", flagged: false, clock: s };
    if (mins >= 16 * 60) return { timing: "AMC", rule: "next", flagged: false, clock: s };
    return { timing: "during", rule: "same", flagged: true, clock: s };
  }
  return { timing: "unknown", rule: "next", flagged: true };
}

/** Index of the first session that trades on the news, or null. `dates` = ascending "YYYY-MM-DD". */
export function reportSession(dates, reportDate, rule) {
  for (let i = 0; i < dates.length; i++) {
    if (rule === "same" ? dates[i] >= reportDate : dates[i] > reportDate) return i;
  }
  return null;
}

/** The three measures for one report session r. Returns {excluded: reason} when it cannot be measured. */
export function eventMeasures(closes, usual, r) {
  const s0 = r - 1 - RUNUP_SESSIONS;
  if (s0 < 0) return { excluded: `fewer than ${RUNUP_SESSIONS + 1} sessions before the report` };
  const sig = usual[s0];
  if (sig == null || !(sig > 0)) return { excluded: "the usual day is not yet defined where the run-up starts (needs 60 prior moves)" };
  const pct = (a, b) => (closes[a] > 0 && closes[b] > 0) ? (closes[b] / closes[a] - 1) * 100 : null;
  const runup = pct(s0, r - 1), day = pct(r - 1, r);
  const after = r + AFTER_SESSIONS < closes.length ? pct(r, r + AFTER_SESSIONS) : null;
  if (runup == null || day == null) return { excluded: "a non-positive close inside the window" };
  return {
    usual_day: sig, start_idx: s0,
    runup_pct: runup, runup_sd: runup / sig,
    day_pct: day, day_sd: day / sig,
    after_pct: after, after_sd: after == null ? null : after / sig,
    after_note: after == null ? `fewer than ${AFTER_SESSIONS} sessions since the report` : null,
  };
}

/** Count, median, 10/25/75/90 bands and the share above zero. */
export function spread(values) {
  const xs = values.filter((v) => v != null && Number.isFinite(v));
  const n = xs.length;
  if (!n) return { n: 0, median: null, q10: null, q25: null, q75: null, q90: null, min: null, max: null, positive: 0, share_positive: null };
  const s = [...xs].sort((a, b) => a - b);
  const positive = xs.filter((v) => v > 0).length;
  return { n, median: quantile(s, 0.5), q10: quantile(s, 0.1), q25: quantile(s, 0.25), q75: quantile(s, 0.75), q90: quantile(s, 0.9),
    min: s[0], max: s[n - 1], positive, share_positive: 100 * positive / n };
}

const MEASURES = { runup: ["runup_pct", "runup_sd"], day: ["day_pct", "day_sd"], after: ["after_pct", "after_sd"] };
export function summariseEvents(events) {
  const out = {};
  for (const [k, [p, sd]] of Object.entries(MEASURES)) out[k] = { pct: spread(events.map((e) => e[p])), sd: spread(events.map((e) => e[sd])) };
  return out;
}

/** Every 20-session stretch of the name's own history, scaled the same way: the baseline a run-up is read against. */
export function anyStretch(closes, usual, len = RUNUP_SESSIONS, keep = false) {
  const pct = [], sd = [];
  for (let s0 = 0; s0 + len < closes.length; s0++) {
    const sig = usual[s0];
    if (sig == null || !(sig > 0) || !(closes[s0] > 0) || !(closes[s0 + len] > 0)) continue;
    const v = (closes[s0 + len] / closes[s0] - 1) * 100;
    pct.push(v); sd.push(v / sig);
  }
  return keep ? { pct: spread(pct), sd: spread(sd), raw: { pct, sd } } : { pct: spread(pct), sd: spread(sd) };
}

/** One name. `bars` finished daily bars oldest first; `reports` [{date, report_time}] that happened. */
export function runupStudy(bars, reports, { keepStretches = false } = {}) {
  const a = analyseSymbol(bars);
  const seg = bars.slice(a.history.bars_before_start);
  const closes = seg.map((b) => +b.c);
  const dates = seg.map((b) => new Date(b.t).toISOString().slice(0, 10));
  const usual = usualDay(closes, USUAL_SESSIONS);
  const seen = new Set(), events = [], excluded = [], timing = { BMO: 0, AMC: 0, during: 0, unknown: 0 };
  const sorted = [...reports].sort((x, y) => String(x.date).localeCompare(String(y.date)));
  for (const rep of sorted) {
    const date = String(rep.date).slice(0, 10);
    if (seen.has(date)) continue;                       // identity is (ticker, date): one report per date
    seen.add(date);
    const t = reportTiming(rep.report_time);
    timing[t.timing]++;
    if (date < a.history.analysis_start) { excluded.push({ date, reason: `before this name's own history starts (${a.history.analysis_start})` }); continue; }
    const r = reportSession(dates, date, t.rule);
    if (r == null) { excluded.push({ date, reason: "no session has traded on it yet in the stored bars" }); continue; }
    if (events.some((e) => e.session === dates[r])) { excluded.push({ date, reason: "a second report on the same news session" }); continue; }
    const m = eventMeasures(closes, usual, r);
    if (m.excluded) { excluded.push({ date, reason: m.excluded }); continue; }
    events.push({ date, report_time: rep.report_time ?? null, timing: t.timing, timing_flagged: t.flagged,
      session: dates[r], runup_from: dates[m.start_idx], ...m });
  }
  const any = anyStretch(closes, usual, RUNUP_SESSIONS, keepStretches);
  const raw = any.raw; delete any.raw;
  return {
    ...(keepStretches ? { _any20_raw: raw } : {}),
    reports_listed: seen.size, reports_used: events.length, enough: events.length >= MIN_REPORTS,
    first_day: a.first_day, source_date: a.source_date, analysis_start: a.history.analysis_start,
    timing, excluded, events, summary: summariseEvents(events), any20: any,
  };
}

/** The same windows, measured on another series (a fund) by date: what the market did over those sessions. */
export function sameWindows(bars, windows) {
  const closes = bars.map((b) => +b.c), dates = bars.map((b) => new Date(b.t).toISOString().slice(0, 10));
  const usual = usualDay(closes, USUAL_SESSIONS);
  const at = new Map(dates.map((d, i) => [d, i]));
  const events = [];
  for (const w of windows) {
    const r = at.get(w.session), s0 = at.get(w.runup_from);
    if (r == null || s0 == null || r - 1 - s0 !== RUNUP_SESSIONS) continue;   // the fund must hold the very same sessions
    const m = eventMeasures(closes, usual, r);
    if (!m.excluded) events.push(m);
  }
  return { windows_asked: windows.length, windows_matched: events.length, summary: summariseEvents(events) };
}
