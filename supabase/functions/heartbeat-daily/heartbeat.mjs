/* SCINTILLA · M52 HEARTBEAT — what a normal day looks like for one name, computed once.

   Alan, 24 Sep: "Normally we move five percent a day. Measured how? Okay, that's an important
   metric. That seems to me like a range of a normal day-to-day heartbeat. That's important to
   track everywhere. I don't think I have that on the hub much, which means I don't have it on
   the database, which means we don't use it at all."

   THE DEFINITION, ONCE, IN WORDS. A name's USUAL DAY is the typical size of one day's move:
   the spread (standard deviation) of its daily close-to-close percentage changes. Written as
   ±x.x%. It is not an average of the moves themselves — up days and down days would cancel —
   it is how far from flat a day usually lands, ignoring direction.

   WHY THREE WINDOWS. One number cannot answer "is this name calm?" and "is this name calmer
   than it normally is?" at the same time.
     20 sessions  — right now (about a trading month)
     60 sessions  — the season (the window M48's rules file already uses to judge a scintilla)
     250 sessions — the year (a full trading year, the baseline the other two are read against)

   WHY ATR% AS WELL. A usual day built on closes cannot see a day that gapped at the open or
   swung wide and came back: both print a quiet close. ATR% is the average true range — the
   day's full travel INCLUDING the gap from yesterday's close — as a percentage of price. A
   name whose ATR% is much larger than its usual day is one that moves inside the day and
   settles; the two numbers together say more than either alone.

   σ IS NOT A THIRD THING. Sigma is simply the symbol mathematicians write for standard
   deviation. Standard deviation, sigma and (here) "usual day" are the same measurement. The
   Hub says "usual day" everywhere and never makes the reader learn a Greek letter.

   PURE: no fetch, no clock, no database. Everything is passed in, so every stored row can be
   recomputed by hand from the same bars. The stdev here is the sample form (n-1) and is
   deliberately identical to scintillas-detect's stdev(), so the stored heartbeat and a live
   scintilla can never disagree about the same name's usual day. A test pins them together. */

export const HEARTBEAT_VERSION = "hb-1";
export const WINDOWS = Object.freeze([20, 60, 250]);
export const ATR_PERIOD = 14;
/* Under twenty sessions a spread is a guess, so no number is claimed at all — the same floor
   data/scintilla-rules.json states in usual_day.min_sessions, for the same reason. */
export const MIN_SESSIONS = 20;

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const cOf = (b) => (b ? num(b.c ?? b.close) : null);
const r3 = (n) => (n == null ? null : Math.round(n * 1000) / 1000);

export function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }

/* sample standard deviation (n-1) — with 20 returns the population form understates the spread */
export function stdev(xs) {
  if (!xs || xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}

/* closes ascending -> day-over-day percentage moves. A zero or missing close breaks the pair
   and is skipped rather than guessed. */
export function dailyReturnsPct(bars) {
  const out = [];
  for (let i = 1; i < (bars || []).length; i++) {
    const p = cOf(bars[i - 1]), c = cOf(bars[i]);
    if (p != null && c != null && p > 0) out.push((c / p - 1) * 100);
  }
  return out;
}

/* THE USUAL DAY over the last `sessions` moves. Fewer than MIN_SESSIONS moves -> null, never a
   number computed from too little history. */
export function usualDayPct(bars, sessions) {
  const rets = dailyReturnsPct(bars);
  const use = rets.slice(-sessions);
  if (use.length < MIN_SESSIONS) return null;
  return stdev(use);
}

/* the day's full travel, including the gap from yesterday's close */
export function trueRange(bar, prevClose) {
  const h = num(bar && (bar.h ?? bar.high)), l = num(bar && (bar.l ?? bar.low));
  if (h == null || l == null) return null;
  const pc = num(prevClose);
  return pc == null ? h - l : Math.max(h - l, Math.abs(h - pc), Math.abs(l - pc));
}

/* ATR% = the average of the last `period` true ranges, as a percentage of the closing price of
   the day each range belongs to. A plain average (not Wilder's smoothing) on purpose: Alan can
   recompute it from the same bars with a column of subtractions and one division. */
export function atrPct(bars, period = ATR_PERIOD) {
  const b = bars || [];
  if (b.length < period + 1) return null;
  const vals = [];
  for (let i = b.length - period; i < b.length; i++) {
    const tr = trueRange(b[i], cOf(b[i - 1])), c = cOf(b[i]);
    if (tr == null || c == null || !(c > 0)) return null;
    vals.push((tr / c) * 100);
  }
  return mean(vals);
}

/* ONE ROW for one name on one date. `bars` are daily bars ASCENDING, ending with the session the
   row is for. Every field is null when its own history is too short — never zero, which would
   read as "this name does not move". */
export function heartbeatRow(symbol, date, bars, { source = "chart-api:/candles?tf=1d" } = {}) {
  const rets = dailyReturnsPct(bars);
  return {
    ticker: symbol,
    date,
    usual_day_20:  r3(usualDayPct(bars, 20)),
    usual_day_60:  r3(usualDayPct(bars, 60)),
    usual_day_250: r3(usualDayPct(bars, 250)),
    atr_pct_14:    r3(atrPct(bars, ATR_PERIOD)),
    n: Math.min(rets.length, 250),
    source,
    version: HEARTBEAT_VERSION,
  };
}

/* HOW BIG IS TODAY, IN THIS NAME'S OWN UNITS: "1.8× its usual day". Null when there is no usual
   day to divide by, so a screen can say "not enough history" instead of printing a ratio. */
export function xUsual(movePct, usualPct) {
  const m = num(movePct), u = num(usualPct);
  if (m == null || u == null || !(u > 0)) return null;
  return m / u;
}

/* IS THIS NAME CALMER OR WILDER THAN ITS OWN NORMAL? The short window against the long one.
   1.0 = exactly its usual self. Reported, never rounded into a verdict here. */
export function calmRatio(short, long) {
  const s = num(short), l = num(long);
  if (s == null || l == null || !(l > 0)) return null;
  return s / l;
}
