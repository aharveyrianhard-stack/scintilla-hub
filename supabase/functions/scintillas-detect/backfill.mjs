/* SCINTILLA · M68 — the backfill. Two years of sigma events for every name, judged by exactly the
   same rules the live detector uses today.

   Alan, 24 Sep: "Are you capturing this going backwards for other companies? … How are you
   registering the sigma? Against what is it computing? Where is it being saved?"

   THE ONE THING THAT MAKES A BACKFILLED EVENT HONEST. A day is never judged against a usual day
   that already contains that day. The divisor is the stored heartbeat row for the LAST DATE BEFORE
   the session. If no such row exists, the spread is computed from bars that all close before the
   session — never from the session itself, and `usual_source` always says which of the two happened.

   Pure functions only: no fetch, no clock, no database. The caller passes the bars, the heartbeat
   rows and the rules file; every row that comes out can be recomputed by hand from `detail`.

   IT ADDS NO NEW RULE. The verdict comes from detectPriceOutliers, which the caller passes in —
   the same function the live pass uses, the same thresholds, the same dedupe key
   `price_outlier|SYM|DATE`. The only difference between a backfilled row and a live one is
   `detail.backfilled = true` and a timestamp that is the session's own close rather than the moment
   of the run. The detector arrives as an argument so this file can be shipped byte-for-byte both in
   scripts/ and inside the edge function, where that file is called detect.mjs; a test pins the two. */

export const BACKFILL_VERSION = "bf-1";
/* The first session the backfill claims. public.ticker_heartbeat_daily starts 2024-09-18, and a
   usual day needs 20 sessions behind it, so the first date with a stored divisor of its own is
   about a month later. Before this, a backfilled event would be judged by a number computed here
   rather than by the stored heartbeat — so the range simply starts where the store does. */
export const BACKFILL_FIRST_SESSION = "2024-10-15";

/* The session's own close, in UTC, so a stored row sits at the moment the move finished rather than
   at the moment the backfill happened to run. 16:00 in New York is 20:00Z in summer and 21:00Z in
   winter; the ET formatter decides which, rather than a hard-coded month rule. */
export function sessionCloseUtcISO(date) {
  const [y, m, d] = String(date).split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d, 20, 0, 0);
  const hourET = +new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", hour12: false })
    .format(new Date(guess));
  const shift = (16 - (hourET % 24)) * 3600e3;   // 0 in EDT, +1h in EST
  return new Date(guess + shift).toISOString();
}

/* the stored usual day as of the day BEFORE this session — never the session's own row */
export function usualAsOf(heartbeatRows, session) {
  let best = null;
  for (const r of heartbeatRows || []) {
    const d = String((r && r.date) || "");
    if (!d || d >= session) continue;                      // the session's own row is not eligible
    const u = Number(r.usual_day_60);
    if (!Number.isFinite(u) || !(u > 0)) continue;
    if (!best || d > String(best.date)) best = r;
  }
  return best;
}

/* how stale a divisor may be before it stops describing this name. The live pass reads a fortnight;
   the backfill keeps the same window so the two paths cannot disagree about what "current" means. */
export const USUAL_MAX_AGE_DAYS = 14;
export function ageInDays(from, to) {
  return Math.round((Date.parse(to + "T00:00:00Z") - Date.parse(from + "T00:00:00Z")) / 86400e3);
}

/* One name, one date range. bars ascending [{d,o,h,l,c,v}], heartbeat rows [{date,usual_day_60,n}].
   Returns the events to store and, for every session it looked at and did not claim, the reason. */
export function backfillSymbol({ detect, symbol, bars, heartbeat = [], from = BACKFILL_FIRST_SESSION,
                                 to = null, rules = null, minHistory = undefined,
                                 source = "chart-api:/candles?tf=1d (backfill)" }) {
  if (typeof detect !== "function") throw new Error("backfillSymbol needs detect: detectPriceOutliers");
  const events = [], skipped = [];
  const rows = (bars || []).filter((b) => b && b.d && Number.isFinite(+b.c) && +b.c > 0);
  let sessions = 0;
  for (let i = 1; i < rows.length; i++) {
    const session = rows[i].d;
    if (session < from) continue;
    if (to && session > to) break;
    sessions++;
    const hb = usualAsOf(heartbeat, session);
    const fresh = hb && ageInDays(String(hb.date), session) <= USUAL_MAX_AGE_DAYS ? hb : null;
    const out = detect({
      quotes: [{ symbol, price: +rows[i].c, prev_close: +rows[i - 1].c }],
      /* every bar here closes BEFORE the session being judged: no lookahead is possible */
      historyBySymbol: { [symbol]: rows.slice(0, i) },
      session,
      ts: sessionCloseUtcISO(session),
      rules, minHistory, source,
      heartbeatBySymbol: fresh ? { [symbol]: fresh } : null,
    });
    for (const e of out.events) {
      e.detail = { ...e.detail, backfilled: true, backfill_version: BACKFILL_VERSION,
                   stored_usual_used: !!fresh, usual_as_of: fresh ? String(fresh.date) : null };
      events.push(e);
    }
    for (const s of out.skipped) skipped.push({ ...s, session });
  }
  return { symbol, events, skipped, sessions_examined: sessions };
}

/* Batched and resumable: the caller walks the universe a slice at a time and hands `next` back as
   the cursor. The slice is taken from a stable sorted list, so a resumed run cannot skip a name or
   do one twice. */
export function planBatch(symbols, cursor = 0, maxSymbols = 40) {
  const all = [...new Set((symbols || []).filter(Boolean))].sort();
  const start = Math.max(0, Math.min(all.length, Number(cursor) || 0));
  const end = Math.min(all.length, start + Math.max(1, Number(maxSymbols) || 1));
  return { batch: all.slice(start, end), start, next: end >= all.length ? null : end, total: all.length };
}

/* What the run produced, per asset class and per day, so the answer to "how many a day is this?"
   comes out of the run itself instead of out of an estimate. */
export function perDayByClass(events, sessionsExamined) {
  const days = new Set(), byClass = {};
  for (const e of events || []) {
    const cls = (e.detail && e.detail.asset_class) || "equity";
    const day = (e.detail && e.detail.session) || String(e.ts || "").slice(0, 10);
    days.add(day);
    const c = (byClass[cls] ||= { events: 0, statistical: 0, raw: 0, both: 0, up: 0, down: 0, days: new Set() });
    c.events++; c.days.add(day);
    const fired = (e.detail && e.detail.fired) || [];
    if (fired.includes("statistical")) c.statistical++;
    if (fired.includes("raw")) c.raw++;
    if (fired.length === 2) c.both++;
    if (e.direction > 0) c.up++; else if (e.direction < 0) c.down++;
  }
  const span = Math.max(1, sessionsExamined || days.size || 1);
  const out = { sessions: span, distinct_days: days.size, total: 0, per_day: 0, by_class: {} };
  for (const [cls, c] of Object.entries(byClass)) {
    out.total += c.events;
    out.by_class[cls] = { events: c.events, per_day: +(c.events / span).toFixed(2),
      statistical: c.statistical, raw: c.raw, both: c.both, up: c.up, down: c.down, days_seen: c.days.size };
  }
  out.per_day = +(out.total / span).toFixed(2);
  return out;
}
