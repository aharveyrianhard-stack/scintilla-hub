/* SCINTILLA · 28 Sep (N6) — USUAL DAY's nightly top-up, the pure part.

   The history in public.sigma_events_daily / public.sigma_day_counts was loaded once (28 Sep, to the 25 Sep close) by
   scripts/sigma-history-backfill.mjs. This keeps it growing: after each close, measure the new day(s) with the SAME test
   (./../heartbeat-daily/sigma.mjs, imported, not copied) and add the rows.

   WHY A SHORT WINDOW GIVES THE SAME ANSWER AS THE WHOLE SERIES. A day's test reads only the 60 valid moves before it, and
   the reused-ticker cut (sinceLastJoin) is the LAST calendar gap longer than JOIN_GAP_DAYS. So reading enough bars to hold
   60 moves before the first day written, plus room, reproduces the backfill exactly: a join older than the window is not
   in it, and a join inside the window is cut at the same bar. tests/hub-bundle-20260928.test.mjs checks this, and the
   local proof compared every stored 25 Sep row against a short-window recomputation.

   WHICH DAYS ARE WRITTEN. From `since` (the newest date already stored, so a missed night heals itself on the next run)
   to the newest settled session. The NEWEST day is held back, and said so, when names that have a bar on the session
   before it do not yet have one on it: those names' bars are late, and writing the day's count now would store a smaller
   "names measured" than the truth. An older day is never held (a name missing from it did not trade it), and a name whose
   last bar is older still (halted, delisted) holds nothing. A name the chart API failed to answer for holds every day of
   the run, because its state is unknown. The next run writes what was held; `force` writes it anyway.

   PURE: no fetch, no clock, no database. Bars in, rows out. */
import { sigmaHistory, dayCounts, dayOf } from "../heartbeat-daily/sigma.mjs";

export const SIGMA_TOPUP_VERSION = "sgt-1";
export const PRIOR_MOVES = 60;          // the usual day's window (rules: usual_day.sessions)
export const WINDOW_ROOM = 40;          // extra bars beyond the 60 prior moves: holidays, a missing close or two
export const MAX_BACK_SESSIONS = 250;   // beyond this the job refuses and points at the backfill script

/* trading sessions between two ISO dates, counted as weekdays (holidays make this an over-count, which is the safe side) */
export function weekdaysBetween(fromIso, toIso) {
  const a = Date.parse(fromIso + "T00:00:00Z"), b = Date.parse(toIso + "T00:00:00Z");
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= a) return 0;
  let n = 0;
  for (let t = a + 864e5; t <= b; t += 864e5) { const d = new Date(t).getUTCDay(); if (d !== 0 && d !== 6) n++; }
  return n;
}
/* how many daily bars to ask for so every day from `since` has its 60 prior moves */
export function barsNeeded(since, todayIso) {
  const back = weekdaysBetween(since, todayIso) + 1;
  if (back > MAX_BACK_SESSIONS) return null;
  return back + PRIOR_MOVES + WINDOW_ROOM;
}

/* barsBySymbol: { SYM: bars[] } for every served name (a name that failed to load is simply absent and listed in `failed`)
   → { events, counts, written_dates, held, lagging } — only dates on or after `since` */
export function planTopUp(barsBySymbol, rules, { since, force = false, failed = [] } = {}) {
  const per = [], lastDay = {};
  for (const sym of Object.keys(barsBySymbol)) {
    const bars = barsBySymbol[sym] || [];
    const h = sigmaHistory(sym, bars, rules);
    per.push(h);
    const last = bars.length ? dayOf(bars[bars.length - 1]) : null;
    if (last) lastDay[sym] = last;
  }
  const allDays = [...new Set(Object.values(lastDay))].sort();
  /* the settled sessions on or after since, from the bars themselves (no calendar) */
  const sessions = new Set();
  for (const h of per) for (const d of h.measured) if (d >= since) sessions.add(d);
  const days = [...sessions].sort();
  const held = [], lagging = {};
  /* only the NEWEST session can be waiting on late bars: once a later session exists, a name with no bar on an older one
     did not trade it (halted, delisted), and holding that day would hold it forever */
  const newest = days.length ? days[days.length - 1] : null;
  if (newest) {
    const union = [...new Set(per.flatMap((h) => h.measured))].sort();
    const prev = union.filter((x) => x < newest).pop() || null;
    const late = Object.keys(lastDay).filter((s) => prev && lastDay[s] === prev);
    if (late.length && !force) { held.push(newest); lagging[newest] = late.sort(); }
  }
  const failedHold = failed.length && !force;
  const write = days.filter((d) => !held.includes(d) && !failedHold);
  const ok = new Set(write);
  const events = per.flatMap((h) => h.events.filter((e) => ok.has(e.date)));
  const counts = dayCounts(per).filter((c) => ok.has(c.date));
  return { events, counts, written_dates: write, held: failedHold ? days : held, lagging,
           failed_hold: failedHold ? failed.slice() : [], newest_bar: allDays.length ? allDays[allDays.length - 1] : null };
}
