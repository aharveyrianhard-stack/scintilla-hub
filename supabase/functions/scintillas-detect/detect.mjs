/* SCINTILLA · M42 — the detectors. One scintilla = a subject moved further than ITS OWN history
   says it usually moves. Pure functions only: no fetch, no clock, no database. Everything they
   need is passed in, so every row they emit can be recomputed by hand from `detail`.

   Alan, 23 Sep: "how do we make earnings scintillate percentage price changes scintillate the
   outliers of the day"; "its a scintilla that can be part of a measure of criticality".

   THE ONE RULE THAT MAKES THESE COMPARABLE. A move is never judged against a fixed percentage.
   It is divided by the same subject's own usual movement, so a 2% day on a quiet name and a 9% day
   on a wild one can sit in the same list and be ranked honestly.

   WHAT IS DELIBERATELY NOT DONE. No detector invents a number. Too little history, a missing
   estimate or a flat history means NO scintilla and a stated reason — never a guess, and never a
   z-score computed from one observation. The reasons come back beside the events so the Hub (and
   this file's tests) can show why a quiet day was quiet. */

export const SCINT_KINDS = Object.freeze([
  "price_outlier", "earnings_surprise", "econ_surprise", "econ_imminent",
  "sentiment_spike", "breadth_thrust",
]);
export const MIN_ABS_Z = 2;              // Alan's brief: |z| >= 2
export const PRICE_MIN_HISTORY = 20;     // daily returns before a volatility is trustworthy
export const SURPRISE_MIN_HISTORY = 4;   // past prints before "its usual surprise" means anything
export const IMMINENT_MIN = 15;          // "imminent" = inside 15 minutes
/* The room's own reading of a macro surprise, kept letter-for-letter identical to index.html's
   EC_INVERT so a stored scintilla and the Economic room can never disagree about which way is
   hot. A test pins the two together. */
export const EC_INVERT = /(inflation|\bcpi\b|\bppi\b|producer price|consumer price|\bpce\b|price index|deflator|unemploy|jobless|job cuts|initial claims|continuing claims)/i;

const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const r3 = (n) => (n == null ? null : Math.round(n * 1000) / 1000);
const sign = (n) => (n > 0 ? 1 : n < 0 ? -1 : 0);

export function mean(xs) { return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null; }
/* sample standard deviation (n-1): with 20 returns the population form understates the spread. */
export function stdev(xs) {
  if (xs.length < 2) return null;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, x) => s + (x - m) * (x - m), 0) / (xs.length - 1));
}
/* the usual z: how far from this subject's average, in its own standard deviations. */
export function zScore(x, history) {
  const s = stdev(history);
  if (s == null || !(s > 0)) return null;
  return (x - mean(history)) / s;
}
/* the brief's z for a price day: today's move over the name's own daily volatility. The centre is
   zero on purpose — "did it move a lot today", not "did it move more than it usually drifts". */
export function volZ(movePct, returnsPct) {
  const s = stdev(returnsPct);
  if (s == null || !(s > 0)) return null;
  return movePct / s;
}
/* closes ascending -> percentage day-over-day returns */
export function dailyReturnsPct(bars) {
  const out = [];
  for (let i = 1; i < bars.length; i++) {
    const p = num(bars[i - 1] && (bars[i - 1].c ?? bars[i - 1].close));
    const c = num(bars[i] && (bars[i].c ?? bars[i].close));
    if (p != null && c != null && p > 0) out.push((c / p - 1) * 100);
  }
  return out;
}
export function surprisePct(actual, estimate) {
  const a = num(actual), e = num(estimate);
  if (a == null || e == null || e === 0) return null;
  return ((a - e) / Math.abs(e)) * 100;
}
const base = (event) => String(event || "").replace(/\s*\((Q[1-4]|Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[^)]*\)\s*$/i, "").trim();
export const econEventKey = (country, event) => String(country || "") + "|" + base(event).toLowerCase();
/* THE ROOM'S OWN READING, so a stored scintilla and the Economic room can never disagree.
   index.html's ecRowHTML computes exactly this: cls = (diff > 0) === hot ? "up" : "dn", where `hot`
   is EC_INVERT (inflation, unemployment). The room paints that "up" class RED and "dn" GREEN — its
   note says so: "red = hotter inflation / weaker labour than expected, green = the other way".
   So the class is kept as the room's word, and `reading` says in plain English what the colour
   means: ADVERSE (the red kind — hotter inflation, weaker labour, stronger-than-wanted) or
   FAVOURABLE (the green kind). A glow reads room_class and lights the room's own colour. */
export function econRoomClass(event, diff) {
  if (diff == null || Math.abs(diff) < 1e-9) return "flat";
  return (diff > 0) === EC_INVERT.test(base(event)) ? "up" : "dn";
}
export function econReading(event, diff) {
  const cls = econRoomClass(event, diff);
  return cls === "flat" ? "in line" : cls === "up" ? "adverse" : "favourable";
}

function ev(o) {
  return {
    ts: o.ts, kind: o.kind, subject: o.subject, subject_kind: o.subject_kind || "ticker",
    direction: o.direction, magnitude: o.magnitude == null ? null : r3(Math.abs(o.magnitude)),
    source: o.source, detail: o.detail, dedupe_key: o.dedupe_key,
  };
}

/* ── OUTLIERS OF THE DAY ────────────────────────────────────────────────────────────────────
   quotes:           [{ symbol, price, prev_close }]      — today, as the board already has it
   historyBySymbol:  { SYM: [{ c }] ascending, ending BEFORE today }
   session:          the trading date these moves belong to (YYYY-MM-DD) */
export function detectPriceOutliers({ quotes, historyBySymbol, session, ts, minHistory = PRICE_MIN_HISTORY,
                                      minAbsZ = MIN_ABS_Z, source = "chart-api:/candles" }) {
  const events = [], skipped = [];
  for (const q of quotes || []) {
    const sym = q && q.symbol;
    if (!sym) continue;
    const price = num(q.price), prev = num(q.prev_close);
    if (price == null || prev == null || prev <= 0) { skipped.push({ subject: sym, reason: "NO_PREV_CLOSE" }); continue; }
    const movePct = (price / prev - 1) * 100;
    const rets = dailyReturnsPct(historyBySymbol && historyBySymbol[sym] ? historyBySymbol[sym] : []);
    if (rets.length < minHistory) { skipped.push({ subject: sym, reason: "SHORT_HISTORY", n: rets.length }); continue; }
    const z = volZ(movePct, rets);
    if (z == null) { skipped.push({ subject: sym, reason: "FLAT_HISTORY", n: rets.length }); continue; }
    if (Math.abs(z) < minAbsZ) { skipped.push({ subject: sym, reason: "BELOW_THRESHOLD", z: r3(z) }); continue; }
    events.push(ev({
      ts, kind: "price_outlier", subject: sym, subject_kind: "ticker", direction: sign(movePct), magnitude: z, source,
      detail: { session, move_pct: r3(movePct), daily_vol_pct: r3(stdev(rets)), n_days: rets.length,
                price, prev_close: prev, z: r3(z), rule: "move / own daily volatility, |z| >= " + minAbsZ },
      dedupe_key: "price_outlier|" + sym + "|" + session,
    }));
  }
  return { events, skipped };
}

/* ── EARNINGS SURPRISE ──────────────────────────────────────────────────────────────────────
   rows:             today's reported rows from earnings_events
   historyByTicker:  { TICK: [past rows, any order] } — the same table, earlier dates
   A report fires when EPS **or** revenue came in further from estimate than that name's own past
   surprises usually land. The louder of the two is the scintilla; both are kept in detail. */
export function detectEarningsSurprises({ rows, historyByTicker, ts, minHistory = SURPRISE_MIN_HISTORY,
                                          minAbsZ = MIN_ABS_Z, source = "earnings_events" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const t = r && r.ticker;
    if (!t) continue;
    const hist = (historyByTicker && historyByTicker[t]) || [];
    const measures = [];
    for (const [name, aKey, eKey] of [["eps", "eps_actual", "eps_estimate"], ["revenue", "revenue_actual", "revenue_estimate"]]) {
      const sp = surprisePct(r[aKey], r[eKey]);
      if (sp == null) continue;
      const past = hist.map((h) => surprisePct(h[aKey], h[eKey])).filter((x) => x != null);
      if (past.length < minHistory) { measures.push({ name, surprise_pct: r3(sp), z: null, n: past.length, reason: "SHORT_HISTORY" }); continue; }
      const z = zScore(sp, past);
      if (z == null) { measures.push({ name, surprise_pct: r3(sp), z: null, n: past.length, reason: "FLAT_HISTORY" }); continue; }
      measures.push({ name, surprise_pct: r3(sp), z: r3(z), n: past.length, usual_pct: r3(mean(past)), spread_pct: r3(stdev(past)) });
    }
    if (!measures.length) { skipped.push({ subject: t, reason: "NO_ESTIMATE_OR_ACTUAL" }); continue; }
    const scored = measures.filter((m) => m.z != null);
    if (!scored.length) { skipped.push({ subject: t, reason: measures[0].reason || "NO_Z", measures }); continue; }
    const loudest = scored.slice().sort((a, b) => Math.abs(b.z) - Math.abs(a.z))[0];
    if (Math.abs(loudest.z) < minAbsZ) { skipped.push({ subject: t, reason: "BELOW_THRESHOLD", z: loudest.z, measure: loudest.name }); continue; }
    events.push(ev({
      ts, kind: "earnings_surprise", subject: t, subject_kind: "ticker",
      direction: sign(loudest.surprise_pct), magnitude: loudest.z, source,
      detail: { date: r.date, measure: loudest.name, measures, beat: loudest.surprise_pct > 0,
                rule: "surprise vs the name's own past surprises, |z| >= " + minAbsZ },
      dedupe_key: "earnings_surprise|" + t + "|" + String(r.date),
    }));
  }
  return { events, skipped };
}

/* ── ECONOMIC SURPRISE, AND THE ONE THAT HAS NOT PRINTED YET ────────────────────────────────
   rows:            econ_calendar rows in the window being examined
   historyByEvent:  { "US|core cpi": [past rows with actual+estimate] }
   nowSec:          the clock, passed in (these functions never read one) */
export function detectEconSurprises({ rows, historyByEvent, ts, minHistory = SURPRISE_MIN_HISTORY,
                                      minAbsZ = MIN_ABS_Z, source = "econ_calendar" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const a = num(r && r.actual), e = num(r && r.estimate);
    const subject = base(r && r.event);
    if (a == null || e == null) { skipped.push({ subject, reason: "NOT_PRINTED" }); continue; }
    const diff = a - e;
    const key = econEventKey(r.country, r.event);
    const past = ((historyByEvent && historyByEvent[key]) || [])
      .map((h) => { const ha = num(h.actual), he = num(h.estimate); return ha == null || he == null ? null : ha - he; })
      .filter((x) => x != null);
    if (past.length < minHistory) { skipped.push({ subject, reason: "SHORT_HISTORY", n: past.length }); continue; }
    const z = zScore(diff, past);
    if (z == null) { skipped.push({ subject, reason: "FLAT_HISTORY", n: past.length }); continue; }
    if (Math.abs(z) < minAbsZ) { skipped.push({ subject, reason: "BELOW_THRESHOLD", z: r3(z) }); continue; }
    events.push(ev({
      ts, kind: "econ_surprise", subject, subject_kind: "event", direction: sign(diff), magnitude: z, source,
      detail: { country: r.country, event: r.event, event_ts: r.event_ts, impact: r.impact,
                actual: a, estimate: e, surprise: r3(diff),
                reading: econReading(r.event, diff), room_class: econRoomClass(r.event, diff),
                n_prints: past.length, usual_surprise: r3(mean(past)), spread: r3(stdev(past)), z: r3(z),
                rule: "actual - estimate vs this release's own past surprises, |z| >= " + minAbsZ },
      dedupe_key: "econ_surprise|" + r.country + "|" + base(r.event).toLowerCase() + "|" + r.event_ts,
    }));
  }
  return { events, skipped };
}

export function detectEconImminent({ rows, nowSec, ts, windowMin = IMMINENT_MIN, impacts = ["High", "Medium"],
                                     source = "econ_calendar" }) {
  const events = [], skipped = [];
  for (const r of rows || []) {
    const subject = base(r && r.event);
    const at = r && r.event_ts != null ? Math.floor(new Date(r.event_ts).getTime() / 1000) : null;
    if (!Number.isFinite(at)) { skipped.push({ subject, reason: "NO_TIME" }); continue; }
    if (num(r.actual) != null) { skipped.push({ subject, reason: "ALREADY_PRINTED" }); continue; }
    const mins = (at - nowSec) / 60;
    if (mins <= 0) { skipped.push({ subject, reason: "DUE_OR_PAST", minutes: r3(mins) }); continue; }
    if (mins > windowMin) { skipped.push({ subject, reason: "NOT_YET_IMMINENT", minutes: r3(mins) }); continue; }
    if (impacts.indexOf(r.impact) < 0) { skipped.push({ subject, reason: "IMPACT_NOT_TRACKED", impact: r.impact }); continue; }
    events.push(ev({
      /* no number has printed, so there is NO z to state — magnitude stays null on purpose. */
      ts, kind: "econ_imminent", subject, subject_kind: "event", direction: 0, magnitude: null, source,
      detail: { country: r.country, event: r.event, event_ts: r.event_ts, impact: r.impact,
                minutes_to: r3(mins), estimate: num(r.estimate), previous: num(r.previous),
                rule: "high or medium impact release inside " + windowMin + " minutes, nothing printed yet" },
      dedupe_key: "econ_imminent|" + r.country + "|" + base(r.event).toLowerCase() + "|" + r.event_ts,
    }));
  }
  return { events, skipped };
}
