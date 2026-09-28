/* SCINTILLA · 28 Sep — SIGMA HISTORY: every past day a name moved beyond its own usual day, from stored daily bars.

   Alan, 28 Sep, on USUAL DAY: "Why do we have such little history when we have such a complete database? These are
   candidates for scintillation." And: "What's the time for? Shouldn't this just be measured versus previous day close?"

   He is right on both. The detector's store (public.scintillas) began on 23 Sep and keeps the FIRST moment a move
   crossed the line (09:00, 09:40…), so a stored "move" was the move at that minute, not the day's. The daily bars
   the chart API serves go back to 11 Sep 2003 for most names. This module measures every one of those days the way
   the detector's rules measure today — close against the PREVIOUS CLOSE — so the history and the live strip are
   the same test applied to different days.

   THE TEST, IN WORDS (data/scintilla-rules.json decides the numbers; this file never hard-codes them):
     move       = today's close / the previous session's close − 1, in %
     usual day  = the spread (standard deviation, n−1) of the 60 daily moves BEFORE this day — the heartbeat's
                  usual_day_60 as of the previous session, which is exactly the divisor the live detector uses.
                  Under 20 prior moves there is no usual day and the day is not measured at all.
     × usual    = move / usual day
     a day counts if EITHER family fires (detect.mjs priceVerdict): STATISTICAL (|× usual| at or above the class's
     bar and the move at least its minimum) or RAW (the move at least the class's plain floor).
   Reused tickers: a series that joins an older security under the same symbol is cut at the LAST calendar gap
   longer than JOIN_GAP_DAYS (heartbeat.mjs sinceLastJoin — the same cut the stored usual day uses).

   PURE: no fetch, no clock, no database. Bars in, rows out, so any stored row can be recomputed by hand. */
import { sinceLastJoin, stdev, MIN_SESSIONS } from "./heartbeat.mjs";
import { priceRuleFor, priceVerdict } from "../scintillas-detect/detect.mjs";

export const SIGMA_VERSION = "sg-1";
export const USUAL_SESSIONS = 60;

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const msOf = (b) => { const t = b && (b.t ?? b.time ?? b.date); const ms = typeof t === "number" ? t : Date.parse(t); return Number.isFinite(ms) ? ms : null; };
/* the chart API stamps a daily bar at 04:00Z (midnight ET) of its own session date */
export const dayOf = (b) => { const ms = msOf(b); return ms == null ? null : new Date(ms).toISOString().slice(0, 10); };
const r3 = (n) => (n == null ? null : Math.round(n * 1000) / 1000);
const r4 = (n) => (n == null ? null : Math.round(n * 10000) / 10000);

/* one name's whole history → { events, measured, from, joins_cut }
     events    the days that fired, one row each, in the shape of public.sigma_events_daily
     measured  every date that HAD a usual day (so a quiet day is a measured zero, not a missing one)
     from      the first bar kept after the reused-ticker cut */
export function sigmaHistory(symbol, barsIn, rules, { source = "chart-api:/candles?tf=1d" } = {}) {
  const cut = sinceLastJoin(barsIn || []);
  const bars = cut.bars;
  const rule = priceRuleFor(symbol, rules);
  const events = [], measured = [];
  if (!rule) return { events, measured, from: cut.from, joins_cut: cut.joins_cut };
  const moves = [];                                  // moves[i] = the move INTO bar i (null where a close is missing)
  for (let i = 0; i < bars.length; i++) {
    const p = i ? num(bars[i - 1].c ?? bars[i - 1].close) : null, c = num(bars[i].c ?? bars[i].close);
    moves.push(p != null && c != null && p > 0 ? (c / p - 1) * 100 : null);
  }
  const win = [];                                    // the valid moves before bar i, newest last, at most 60
  for (let i = 1; i < bars.length; i++) {
    const mv = moves[i];
    if (win.length >= MIN_SESSIONS && mv != null) {
      const usual = stdev(win);
      if (usual != null && usual > 0) {
        const d = dayOf(bars[i]);
        measured.push(d);
        const v = priceVerdict(mv, usual, rule);
        if (v.hit) {
          events.push({
            ticker: symbol, date: d,
            close: num(bars[i].c ?? bars[i].close), prev_close: num(bars[i - 1].c ?? bars[i - 1].close),
            move_pct: r4(mv), usual_day_60: r4(usual), usual_sessions: win.length, x_usual: r3(mv / usual),
            direction: mv > 0 ? 1 : mv < 0 ? -1 : 0, fired: v.fired.slice(), asset_class: rule.asset_class,
            rules_version: (rules && rules.version) || null, source, version: SIGMA_VERSION,
          });
        }
      }
    }
    if (mv != null) { win.push(mv); if (win.length > USUAL_SESSIONS) win.shift(); }
  }
  return { events, measured, from: cut.from, joins_cut: cut.joins_cut };
}

/* many names → one row per date across all of them, in the shape of public.sigma_day_counts.
   names_measured is how many names had a usual day that date: the universe was smaller in 2003, so any
   comparison across years is made on the SHARE (up / names_measured), never on the raw count. */
export function dayCounts(perSymbol) {
  const by = new Map();
  const row = (d) => { let r = by.get(d); if (!r) by.set(d, (r = { date: d, names_measured: 0, n: 0, up: 0, dn: 0, version: SIGMA_VERSION })); return r; };
  for (const h of perSymbol) {
    for (const d of h.measured) row(d).names_measured++;
    for (const e of h.events) { const r = row(e.date); r.n++; if (e.direction > 0) r.up++; else if (e.direction < 0) r.dn++; }
  }
  return [...by.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/* where a value sits in its own history, 1..100 (the share of past days at or below it). Alan, 28 Sep:
   "percentiles 1..100, not a forced 10%". Null with fewer than 20 days to compare against. */
export function percentileOf(value, history) {
  const xs = (history || []).filter((x) => Number.isFinite(x));
  if (!Number.isFinite(value) || xs.length < 20) return null;
  let le = 0; for (const x of xs) if (x <= value) le++;
  return Math.max(1, Math.min(100, Math.round((le / xs.length) * 100)));
}
