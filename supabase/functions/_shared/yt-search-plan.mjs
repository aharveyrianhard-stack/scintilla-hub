// SCINTILLA · yt-search-plan — which RADAR names youtube-feed searches on this run, and how many.
//
// Alan, 2 Oct: "SPY and QQQ are in all of these videos … the subscribed channels' feed just gets pushed
// through; the other stuff would be mentions of tickers besides the subscribed channels … we have a limit
// on queries per day. Whatever is on the RADAR list — split the queries per day across the RADAR
// companies, and that's it. Not SPY and QQQ."
//
// THE ARITHMETIC. One YouTube search.list call costs 100 quota units; one videos.list call (the length /
// language check, up to 50 ids) costs 1. The project's day ends at midnight Pacific, when YouTube resets
// the count. The search lane is given SEARCH_BUDGET_UNITS of the day; every search is costed at 101 so the
// videos.list call it causes is paid for too. A run may search only as many names as the even share of the
// day that has passed allows (allowedByNow − doneToday), so the budget is spread from midnight to midnight
// whatever the cron cadence, and a missed run is caught up a little at a time, never in one burst.
// Names are taken in RADAR order from a rotating cursor, so every name gets its turn.
//
// Plain ESM, read by Deno (the function) and Node (the tests) alike.

export const SEARCH_UNITS = 100;          // search.list
export const VIDEOS_UNITS = 1;            // videos.list, per 50 ids
export const COST_PER_SEARCH = SEARCH_UNITS + VIDEOS_UNITS;
export const DAILY_QUOTA = 10000;         // YouTube Data API default per project per day
export const SEARCH_BUDGET_UNITS = 8000;  // the search lane's share; the rest is the subscription sweep's and headroom
export const MAX_PER_RUN = 6;             // bounds one run's time
export const NEVER_SEARCH = ["SPY", "QQQ"];
const QUERY = { BTCUSD: "bitcoin price", ETHUSD: "ethereum price", GCUSD: "gold price", SIUSD: "silver price" };

/** the RADAR rows (station_lists, list = radar) → the names to search, in RADAR order, SPY and QQQ out */
export function searchList(rows) {
  const out = [];
  for (const r of [...(rows || [])].sort((a, b) => (+a.position || 0) - (+b.position || 0))) {
    const t = String(r && r.ticker || "").trim().toUpperCase();
    if (t && !NEVER_SEARCH.includes(t) && !out.includes(t)) out.push(t);
  }
  return out;
}

/** what is typed into YouTube search for one name */
export function queryFor(t) { return QUERY[t] || ("$" + t + " stock"); }

/** the quota day (Pacific calendar date) and the minutes already gone in it */
export function pacificClock(nowMs) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles", year: "numeric", month: "2-digit",
    day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(nowMs)).map((p) => [p.type, p.value]));
  return { day: parts.year + "-" + parts.month + "-" + parts.day, minute: (+parts.hour % 24) * 60 + (+parts.minute) };
}

/** this run's pick. prev = the last run's stored state ({ day, searches_today, cursor }) or null. */
export function planRun({ tickers, prev, nowMs, everyMin = 20, budgetUnits = SEARCH_BUDGET_UNITS, maxPerRun = MAX_PER_RUN }) {
  const clock = pacificClock(nowMs);
  const sameDay = prev && prev.day === clock.day;
  const doneToday = sameDay ? Math.max(0, +prev.searches_today || 0) : 0;
  const n = (tickers || []).length;
  const cursor = n ? (((+(prev && prev.cursor) || 0) % n) + n) % n : 0;
  const perDay = Math.floor(budgetUnits / COST_PER_SEARCH);
  const allowedByNow = Math.min(perDay, Math.floor(perDay * Math.min(1440, clock.minute + everyMin) / 1440));
  const k = n ? Math.max(0, Math.min(maxPerRun, n, allowedByNow - doneToday)) : 0;
  const pick = [];
  for (let i = 0; i < k; i++) pick.push(tickers[(cursor + i) % n]);
  return {
    day: clock.day, pick, cursor: n ? (cursor + k) % n : 0,
    searches_today: doneToday + k, units_today_max: (doneToday + k) * COST_PER_SEARCH,
    per_day: perDay, allowed_by_now: allowedByNow, every_min: everyMin, budget_units: budgetUnits,
  };
}

/** the whole-day picture for a cadence: what Alan reads in the report and the Edit-tickers window */
export function dayPlan(nTickers, everyMin = 20, budgetUnits = SEARCH_BUDGET_UNITS) {
  const perDay = Math.floor(budgetUnits / COST_PER_SEARCH);
  const runs = Math.floor(1440 / everyMin);
  return { runs_per_day: runs, searches_per_day: perDay, units_per_day_max: perDay * COST_PER_SEARCH,
    per_ticker_per_day: nTickers ? +(perDay / nTickers).toFixed(1) : 0,
    hours_between_turns: nTickers ? +((24 * nTickers) / perDay).toFixed(1) : null };
}

/* the one cohort a name is shown under in the Hub window. Size and style buckets say little about what a company
   does; a theme or an industry says more. (yt-config used to ask for an is_primary column that does not exist.) */
const BROAD = new Set(["MEGA_CAP", "MEGACAP", "LARGE_CAP", "MID_CAP", "SMALL_CAP", "BLUE_CHIP", "GROWTH", "TECH", "DISCRET", "STAPLES",
  "COMMS", "FINANCIALS", "INDUSTRIAL", "UTILITIES", "MATERIALS", "HEALTH", "THEMATIC"]);
const FIRST = ["INDEXES", "AI_HARDWARE", "AI_SOFTWARE", "AI_POWERTRAIN", "CRYPTO", "MACRO", "SEMICONDUCTORS"];
export function bestCohort(list) {
  const all = (list || []).map(String).filter(Boolean);
  for (const c of FIRST) if (all.includes(c)) return c;
  const narrow = all.filter((c) => !BROAD.has(c)).sort();
  return narrow[0] || all.sort()[0] || "OTHER";
}
