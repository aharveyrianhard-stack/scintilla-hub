/* Scintilla · statistics S7 · a better ENTRY inside the 20 sessions before a report.
   Pure functions, no fetch, no clock. Used by s7-entries.mjs (node) and the tests.

   Every reading at session i uses bars 0..i only (the entry is at the close of i, so the close of i is
   known). A pivot needs R bars after it to exist, so it is usable only from bar k + R onward.

   Definitions (stated once, printed on the page):
   · RSI(14) own-percentile: percentileOf(RSI over the prior 756 sessions, RSI today), needs 250 prior readings
     (the S6b rule). Trigger a20/a30/a40 = that percentile below 20 / 30 / 40.
   · average touch: |low / SMA - 1| <= 1% and close > SMA, for the 20-, 50-, 100-, 200-session simple average.
   · drawdown: H = the highest high of the last 60 sessions (today included), n = sessions since that high
     (at least 1), dd = close / H - 1 (in %). Scaled: z = dd / (usual day × √n). Trigger dd1/dd2/dd3 = z <= -1/-2/-3.
     The usual day is the S6 one (60-session sample sd of daily % moves) read at the entry session.
   · horizontal level: any pivot high or pivot low (10 bars each side, the Pivot atom's S/R window) whose bar
     is within the last 120 sessions and is already confirmed; trigger when |low / level - 1| <= 1% and
     close > level.
   · channel lower rail: port of method A of INDICATOR_LAB/SCINTILLA_Parallel_Channels_Additive_Stack_V1.pine
     ("APCh · Auto Parallel Channels (HTF)", strict dual fit, pivot length 9, width-drift tolerance 0.35) on
     daily bars; see channelStates. Trigger when a valid, unbroken channel exists, |low / lowerRail - 1| <= 1%
     and close >= lowerRail. */
import { rsiWilder, sma, usualDay, percentileOf } from "./stats.mjs";

export const PIVOT_LEVEL_LEN = 10;
export const LEVEL_LOOKBACK = 120;
export const CHANNEL_PIVOT = 9;
export const CHANNEL_TOLERANCE = 0.35;
export const TOUCH = 0.01;
export const RSI_PCT_WINDOW = 756;
export const RSI_PCT_MIN = 250;
export const DD_LOOKBACK = 60;

/** Pivot highs: index k where high[k] is strictly above each of the `len` highs before it and at or above
    each of the `len` highs after it (a flat top counts once, at its first bar). Lows mirror it.
    Returns [{k, price}] in order; the pivot is known from bar k + len. */
export function pivots(highs, lows, len) {
  const hi = [], lo = [];
  for (let k = len; k + len < highs.length; k++) {
    let isH = true, isL = true;
    for (let j = 1; j <= len && (isH || isL); j++) {
      if (!(highs[k] > highs[k - j]) || !(highs[k] >= highs[k + j])) isH = false;
      if (!(lows[k] < lows[k - j]) || !(lows[k] <= lows[k + j])) isL = false;
    }
    if (isH) hi.push({ k, price: highs[k] });
    if (isL) lo.push({ k, price: lows[k] });
  }
  return { hi, lo };
}

/** Method A of the Parallel Channels stack, bar by bar, with pivots confirmed `len` bars late.
    Differences from the Pine, disclosed: x is the session index, not the bar's clock time (so a weekend adds
    no slope), and it runs on the daily series only (the Pine also draws 4-hour and weekly copies).
    Per bar i, after the bar closes:
      hNew/hOld = the two most recent confirmed pivot highs, lNew/lOld = the two most recent pivot lows;
      mH, mL = the slopes of the line through each pair;
      width = hNew − lowerRail(at hNew's bar); widthFuture = the same gap one upper-span further right;
      valid = width > 0 and |widthFuture − width| / width < tolerance (strict, like the Pine);
      broken: reset when any new pivot confirms; set once a close is above the upper or below the lower rail.
    Returns per-bar {valid, broken, upper, lower, slopeUpper, slopeLower} (null before the first 4 pivots). */
export function channelStates(highs, lows, closes, len = CHANNEL_PIVOT, tolerance = CHANNEL_TOLERANCE) {
  const { hi, lo } = pivots(highs, lows, len);
  const out = new Array(closes.length).fill(null);
  let hNew = null, hOld = null, lNew = null, lOld = null, broken = false;
  let ih = 0, il = 0;
  for (let i = 0; i < closes.length; i++) {
    let fresh = false;
    while (ih < hi.length && hi[ih].k + len === i) { hOld = hNew; hNew = hi[ih]; ih++; fresh = true; }
    while (il < lo.length && lo[il].k + len === i) { lOld = lNew; lNew = lo[il]; il++; fresh = true; }
    if (fresh) broken = false;
    if (!(hNew && hOld && lNew && lOld && hNew.k > hOld.k && lNew.k > lOld.k)) continue;
    const mH = (hNew.price - hOld.price) / Math.max(hNew.k - hOld.k, 1);
    const mL = (lNew.price - lOld.price) / Math.max(lNew.k - lOld.k, 1);
    const width = hNew.price - (lNew.price + mL * (hNew.k - lNew.k));
    const span = hNew.k - hOld.k;
    const widthFuture = (hNew.price + mH * span) - (lNew.price + mL * (hNew.k + span - lNew.k));
    const valid = width > 0 && Math.abs(widthFuture - width) / width < tolerance;
    const upper = hNew.price + mH * (i - hNew.k), lower = lNew.price + mL * (i - lNew.k);
    if (valid && !broken && (closes[i] > upper || closes[i] < lower)) broken = true;
    out[i] = { valid, broken, upper, lower, slopeUpper: mH, slopeLower: mL };
  }
  return out;
}

/** Own-history RSI percentile at every bar, prior 756 readings, via a sorted sliding window. */
export function rsiOwnPercentile(rsi, window = RSI_PCT_WINDOW, minN = RSI_PCT_MIN) {
  const out = new Array(rsi.length).fill(null);
  const sorted = [], queue = [];
  const lowerBound = (x) => { let a = 0, b = sorted.length; while (a < b) { const m = (a + b) >> 1; if (sorted[m] < x) a = m + 1; else b = m; } return a; };
  for (let i = 0; i < rsi.length; i++) {
    if (rsi[i] != null && sorted.length >= minN) {
      const below = lowerBound(rsi[i]);
      let eq = 0; for (let j = below; j < sorted.length && sorted[j] === rsi[i]; j++) eq++;
      out[i] = 100 * (below + eq / 2) / sorted.length;
    }
    // today joins the prior window only after it has been read
    queue.push(rsi[i]);
    if (rsi[i] != null) sorted.splice(lowerBound(rsi[i]), 0, rsi[i]);
    if (queue.length > window) { const old = queue.shift(); if (old != null) sorted.splice(lowerBound(old), 1); }
  }
  return out;
}

export const SINGLE = [
  { key: "rsi<20", fam: "rsi", label: "own RSI percentile below 20" },
  { key: "rsi<30", fam: "rsi", label: "own RSI percentile below 30" },
  { key: "rsi<40", fam: "rsi", label: "own RSI percentile below 40" },
  { key: "ma20", fam: "ma", label: "touch of the 20-day average" },
  { key: "ma50", fam: "ma", label: "touch of the 50-day average" },
  { key: "ma100", fam: "ma", label: "touch of the 100-day average" },
  { key: "ma200", fam: "ma", label: "touch of the 200-day average" },
  { key: "dd1", fam: "dd", label: "down 1 scaled usual day from the 60-session high" },
  { key: "dd2", fam: "dd", label: "down 2 scaled usual days from the 60-session high" },
  { key: "dd3", fam: "dd", label: "down 3 scaled usual days from the 60-session high" },
  { key: "level", fam: "level", label: "at a prior pivot level (120 sessions)" },
  { key: "rail", fam: "rail", label: "at the lower rail of a parallel channel" },
];
export const BIT = Object.fromEntries(SINGLE.map((s, i) => [s.key, 1 << i]));

/** Every single trigger, per bar, as a bitmask. `bars` = [{h, l, c}] oldest first. */
export function triggerFlags(bars) {
  const closes = bars.map((b) => +b.c), highs = bars.map((b) => +b.h), lows = bars.map((b) => +b.l);
  const n = closes.length;
  const rsiPct = rsiOwnPercentile(rsiWilder(closes, 14));
  const mas = { ma20: sma(closes, 20), ma50: sma(closes, 50), ma100: sma(closes, 100), ma200: sma(closes, 200) };
  const usual = usualDay(closes, 60);
  const chan = channelStates(highs, lows, closes);
  const { hi, lo } = pivots(highs, lows, PIVOT_LEVEL_LEN);
  const levels = [...hi, ...lo].sort((a, b) => a.k - b.k);
  const flags = new Int32Array(n), dd = new Array(n).fill(null);
  for (let i = 0; i < n; i++) {
    let f = 0;
    const p = rsiPct[i];
    if (p != null) { if (p < 20) f |= BIT["rsi<20"]; if (p < 30) f |= BIT["rsi<30"]; if (p < 40) f |= BIT["rsi<40"]; }
    for (const [k, m] of Object.entries(mas)) {
      const v = m[i];
      if (v > 0 && Math.abs(lows[i] / v - 1) <= TOUCH && closes[i] > v) f |= BIT[k];
    }
    if (i >= DD_LOOKBACK - 1 && usual[i] > 0) {
      let H = -Infinity, hk = i;
      for (let j = i - DD_LOOKBACK + 1; j <= i; j++) if (highs[j] >= H) { H = highs[j]; hk = j; }   // latest bar of the high
      const since = Math.max(1, i - hk);
      const z = ((closes[i] / H - 1) * 100) / (usual[i] * Math.sqrt(since));
      dd[i] = z;
      if (z <= -1) f |= BIT.dd1; if (z <= -2) f |= BIT.dd2; if (z <= -3) f |= BIT.dd3;
    }
    for (const lv of levels) {
      if (lv.k + PIVOT_LEVEL_LEN > i) break;             // not yet confirmed (levels are sorted by k)
      if (lv.k < i - LEVEL_LOOKBACK) continue;
      if (Math.abs(lows[i] / lv.price - 1) <= TOUCH && closes[i] > lv.price) { f |= BIT.level; break; }
    }
    const c = chan[i];
    if (c && c.valid && !c.broken && c.lower > 0 && Math.abs(lows[i] / c.lower - 1) <= TOUCH && closes[i] >= c.lower) f |= BIT.rail;
    flags[i] = f;
  }
  return { flags, rsiPct, dd, chan };
}

/** nextFire[i] = the first bar j >= i where every bit of `mask` is set, or -1. */
export function nextFire(flags, mask) {
  const out = new Int32Array(flags.length + 1).fill(-1);
  for (let i = flags.length - 1; i >= 0; i--) out[i] = (flags[i] & mask) === mask ? i : out[i + 1];
  return out;
}

/** One trade. The window's candidate entries are the closes s0 .. s0 + 19 (s0 = the window start, the S6 entry);
    the primary exit is the close s0 + 20 (the last close before the report for a report window), the second exit
    is s0 + 21 (the report session's close), the third s0 + 26 (five sessions after it). Returns null when the
    trigger does not fire inside the window. Percent returns; `scale` divides them into usual days. */
export function tradeFor(closes, s0, entryIdx, scale) {
  if (entryIdx < 0 || entryIdx < s0 || entryIdx > s0 + 19) return null;
  const pct = (a, b) => (b < closes.length && closes[a] > 0 && closes[b] > 0) ? (closes[b] / closes[a] - 1) * 100 : null;
  const primary = pct(entryIdx, s0 + 20);
  if (primary == null) return null;
  return { entry: entryIdx, wait: entryIdx - s0, held: s0 + 20 - entryIdx,
    primary, primary_sd: scale > 0 ? primary / scale : null,
    reportDay: pct(entryIdx, s0 + 21), after5: pct(entryIdx, s0 + 26) };
}

/** Wilson 95% interval for a share, in %. */
export function wilson(k, n) {
  if (!n) return [null, null];
  const z = 1.96, p = k / n, d = 1 + z * z / n;
  const c = (p + z * z / (2 * n)) / d, h = (z * Math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))) / d;
  return [100 * (c - h), 100 * (c + h)];
}
