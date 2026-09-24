// SCINTILLA · scintillas-detect v1 (M42) — turn today's unusual moves into stored scintillas.
//
// WHY THIS EXISTS. A scintilla was a 520 ms glow and nothing more: it lived only while it was on
// screen. Alan, 23 Sep: "we need to broaden scintillation as a signal thats why its called
// scintilla … it can be part of a measure of criticality". Counting them, ranking them and carrying
// one from the dashboard into the room it points at all need the same thing first — a memory.
//
// WHAT IT DOES. It reads what the Hub already reads, asks the detectors in ./detect.mjs whether
// anything moved further than its own history says it usually does, and writes one row per finding
// into public.scintillas. The detectors are pure and shared with scripts/scintillas-detect.mjs
// (a test pins the two files byte-for-byte), so every stored row can be recomputed by hand.
//
// THE RULES IT WILL NOT BREAK.
//   1. It writes to ONE table, public.scintillas, and never to a price, estimate or result table.
//   2. Running it twice with the same inputs leaves ONE row: every event carries a dedupe_key and
//      the insert is ignore-duplicates.
//   3. It never invents a number. Too little history, no estimate, or a flat history means no row
//      and a stated reason in the response.
//   4. It reads keys from the environment and never prints them.
//   5. Bandwidth is bounded: see PREFILTER below. What it skipped, and why, is in the response.
//
// MODES.
//   ?mode=intraday (default) — quotes for the universe, then daily bars ONLY for names already
//     moving at least PREFILTER_PCT, capped at MAX_CANDLE_FETCH. Cheap enough to run every few
//     minutes. HONEST LIMIT: a name so quiet that 2 sigma is under PREFILTER_PCT is not examined
//     until the session pass.
//   ?mode=session — the same pass with the prefilter switched off, for once after the close.
//   ?mode=backfill&from=&to=&symbols=&cursor=&max_symbols= — M68. The SAME price rule, walked
//     backwards over stored daily bars, so the two years before the detector existed are in the
//     table too. Alan, 24 Sep: "Are you capturing this going backwards for other companies?"
//     It is batched (a slice of the universe per call), resumable (hand `next` back as `cursor`)
//     and idempotent: the dedupe key is the same `price_outlier|SYM|DATE` the live pass writes, and
//     the insert ignores duplicates, so a backfilled row can never displace or duplicate a live one.
//     Every backfilled row carries detail.backfilled = true and sits at the session's own close.
// Econ (surprise + imminent) and earnings run in BOTH modes: they cost two database reads.
import {
  detectPriceOutliers, detectEarningsSurprises, detectEconSurprises, detectEconImminent, econEventKey,
} from "./detect.mjs";
/* M48 — the thresholds are no longer buried in the code. They live in data/scintilla-rules.json,
   which the Hub fetches and this function carries as a generated copy (scripts/build-scintilla-rules.mjs;
   a test pins the two together). Two families, either one fires: the move against the name's own usual
   day, and a plain percentage floor, both per asset class. */
import { RULES } from "./rules.mjs";
import { backfillSymbol, planBatch, perDayByClass, BACKFILL_FIRST_SESSION } from "./backfill.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
/* M48: the prefilter must stay BELOW the lowest bar any rule can fire on, or a rule in the file
   would be unreachable intraday. The lowest is the smallest "at least this much" in price.* . */
const PREFILTER_PCT = Math.min(0.5, ...Object.values(RULES.price as Record<string, any>)
  .map((p: any) => Number(p.x_usual_needs_move_pct)).filter((n: number) => Number.isFinite(n)));
const MAX_CANDLE_FETCH = 140;   // hard ceiling on daily-bar reads per run
const CANDLE_DAYS = 90;         // ~60 trading days -> a 20-day volatility is comfortably covered
const CONCURRENCY = 6;
const BACKFILL_MAX_SYMBOLS = 25;   // names per call: a slice small enough to finish inside the budget
const BACKFILL_INSERT_CHUNK = 500; // rows per insert

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };

async function sbGet(path: string) {
  const r = await fetch(SB + "/rest/v1/" + path, { headers: sbHeaders });
  if (!r.ok) throw new Error("db " + path.split("?")[0] + " -> " + r.status);
  return await r.json();
}
async function chartGet(path: string) {
  const r = await fetch(CHART + path, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error("chart " + path.split("?")[0] + " -> " + r.status);
  return await r.json();
}
/* run a bounded number of requests at a time — the chart API is one small machine */
async function pool<T, R>(items: T[], n: number, fn: (x: T) => Promise<R>): Promise<R[]> {
  const out: R[] = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}
const iso = (d: Date) => d.toISOString();
const dayKey = (d: Date) => d.toISOString().slice(0, 10);
/* the session a move belongs to, in ET, so a 20:00 UTC read and a 01:00 UTC read agree */
function sessionET(now: Date) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

async function insert(rows: any[]) {
  if (!rows.length) return { inserted: 0 };
  const r = await fetch(SB + "/rest/v1/scintillas?on_conflict=dedupe_key", {
    method: "POST",
    headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error("insert -> " + r.status + " " + (await r.text()).slice(0, 200));
  const back = await r.json();
  return { inserted: Array.isArray(back) ? back.length : 0 };
}

/* ── THE BACKFILL ───────────────────────────────────────────────────────────────────────────
   One slice of the universe, one date range, the same rules. Reads: one /candles per name and one
   heartbeat read per name. Writes: public.scintillas only, ignore-duplicates. */
async function runBackfill(url: URL, report: any) {
  const from = url.searchParams.get("from") || BACKFILL_FIRST_SESSION;
  const to = url.searchParams.get("to") || null;
  const cursor = Number(url.searchParams.get("cursor") || 0);
  const maxSymbols = Math.max(1, Math.min(60, Number(url.searchParams.get("max_symbols") || BACKFILL_MAX_SYMBOLS)));
  const asked = (url.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

  let symbols = asked;
  if (!symbols.length) {
    const universe = await chartGet("/universe");
    symbols = (universe.symbols || universe.universe || []).map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
  }
  const plan = planBatch(symbols, cursor, maxSymbols);
  report.from = from; report.to = to; report.cursor = plan.start; report.next = plan.next;
  report.universe = plan.total; report.batch = plan.batch.length;

  /* enough daily bars to cover the range and the bar before it. ~252 sessions a year, plus slack. */
  const spanDays = Math.max(1, Math.round((Date.parse((to || new Date().toISOString().slice(0, 10)) + "T00:00:00Z") -
                                           Date.parse(from + "T00:00:00Z")) / 86400e3));
  const barLimit = Math.min(1500, Math.ceil(spanDays * 252 / 365) + 30);

  const events: any[] = [];
  const skippedCounts: Record<string, number> = {};
  let sessionsExamined = 0, noBars = 0, noStoredUsual = 0;

  await pool(plan.batch, CONCURRENCY, async (sym: string) => {
    let bars: any[] = [];
    try {
      const c = await chartGet("/candles?symbol=" + encodeURIComponent(sym) + "&tf=1d&limit=" + barLimit);
      const raw = (c.series || c.candles || c.bars || c.rows || []) as any[];
      const dayOf = (b: any) => { const t = b.t ?? b.time ?? b.date;
        return typeof t === "number" ? new Date(t).toISOString().slice(0, 10) : String(t || "").slice(0, 10); };
      bars = raw.map((b: any) => ({ d: dayOf(b), o: +(b.o ?? b.open), h: +(b.h ?? b.high), l: +(b.l ?? b.low), c: +(b.c ?? b.close) }))
                .filter((b: any) => b.d && Number.isFinite(b.c) && b.c > 0)
                .sort((a: any, b: any) => (a.d < b.d ? -1 : 1));
    } catch (_) { noBars++; return; }
    if (!bars.length) { noBars++; return; }

    /* the divisor comes out of the store, one name at a time, and the module picks the row dated
       before each session — never the session's own row. */
    let heartbeat: any[] = [];
    try {
      heartbeat = await sbGet("ticker_heartbeat_daily?ticker=eq." + encodeURIComponent(sym) +
        "&date=gte." + from + (to ? "&date=lte." + to : "") +
        "&select=date,usual_day_60,n&order=date.asc&limit=2000");
    } catch (_) { heartbeat = []; }
    if (!heartbeat.length) noStoredUsual++;

    const out = backfillSymbol({ detect: detectPriceOutliers, symbol: sym, bars, heartbeat, from, to, rules: RULES,
                                 source: "chart-api:/candles?tf=1d (backfill)" });
    sessionsExamined = Math.max(sessionsExamined, out.sessions_examined);
    for (const s of out.skipped) skippedCounts[s.reason] = (skippedCounts[s.reason] || 0) + 1;
    events.push(...out.events);
  });

  let inserted = 0;
  for (let i = 0; i < events.length; i += BACKFILL_INSERT_CHUNK) {
    const r = await insert(events.slice(i, i + BACKFILL_INSERT_CHUNK));
    inserted += r.inserted;
  }
  report.sessions_per_symbol = sessionsExamined;
  report.detected = events.length;
  report.inserted = inserted;
  report.already_stored = events.length - inserted;
  report.no_bars = noBars;
  report.names_without_stored_usual = noStoredUsual;
  report.skipped_counts = { price: skippedCounts };
  report.counts = perDayByClass(events, sessionsExamined);
  report.notes.push("backfilled rows carry detail.backfilled = true and the session's own close as ts");
  report.notes.push("idempotent: dedupe_key price_outlier|SYM|DATE with ignore-duplicates, so a live row is never displaced");
  if (plan.next != null) report.notes.push("resume with &cursor=" + plan.next);
  return report;
}

Deno.serve(async (req) => {
  const started = Date.now();
  const url = new URL(req.url);
  const asked = url.searchParams.get("mode");
  const mode = asked === "session" ? "session" : asked === "backfill" ? "backfill" : "intraday";
  const now = new Date();
  const session = sessionET(now);
  const report: any = { mode, session, at: iso(now), rules_version: RULES.version, kinds: {}, skipped_counts: {}, notes: [] };
  const events: any[] = [];

  try {
    if (mode === "backfill") {
      await runBackfill(url, report);
      report.ms = Date.now() - started;
      return json(report, 200);
    }
    /* ── prices: outliers of the day ─────────────────────────────────────────────── */
    const universe = await chartGet("/universe");
    const symbols: string[] = (universe.symbols || universe.universe || []).map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
    const quotes = await chartGet("/quotes?symbols=" + symbols.join(","));
    /* 24 Sep: the chart API's /quotes answers { quotes: { AAPL: {...}, … } } — an object keyed by
       symbol, with previous_close — not a list with prev_close. The first live run died on
       "qRows.filter is not a function". Both shapes are accepted; detect.mjs keeps its contract. */
    const qRaw = quotes && (quotes.quotes ?? quotes.rows ?? quotes);
    const qRows = (Array.isArray(qRaw) ? qRaw
      : (qRaw && typeof qRaw === "object" ? Object.entries(qRaw).map(([sym, q]: any) => ({ ...(q || {}), symbol: (q && q.symbol) || sym })) : []))
      .map((q: any) => ({ ...q, prev_close: q.prev_close ?? q.previous_close })) as any[];
    let candidates = qRows.filter((q) => Number.isFinite(+q.price) && Number.isFinite(+q.prev_close) && +q.prev_close > 0);
    if (mode === "intraday") {
      const before = candidates.length;
      candidates = candidates.filter((q) => Math.abs(+q.price / +q.prev_close - 1) * 100 >= PREFILTER_PCT);
      report.notes.push("intraday prefilter: " + candidates.length + " of " + before + " names moving at least " + PREFILTER_PCT + "% examined");
    }
    if (candidates.length > MAX_CANDLE_FETCH) {
      candidates = candidates.slice().sort((a, b) => Math.abs(+b.price / +b.prev_close - 1) - Math.abs(+a.price / +a.prev_close - 1)).slice(0, MAX_CANDLE_FETCH);
      report.notes.push("capped at " + MAX_CANDLE_FETCH + " daily-bar reads: the biggest movers first");
    }
    const historyBySymbol: Record<string, any[]> = {};
    await pool(candidates, CONCURRENCY, async (q: any) => {
      try {
        /* the chart API's daily bars: tf=1d&limit=N, answered under "series", t in epoch ms */
        const c = await chartGet("/candles?symbol=" + encodeURIComponent(q.symbol) + "&tf=1d&limit=" + CANDLE_DAYS);
        const bars = (c.series || c.candles || c.bars || c.rows || []) as any[];
        const dayOf = (b: any) => { const t = b.t ?? b.time ?? b.date;
          return typeof t === "number" ? new Date(t).toISOString().slice(0, 10) : String(t || "").slice(0, 10); };
        /* today's own forming bar must not be part of the history it is judged against */
        historyBySymbol[q.symbol] = bars.filter((b: any) => dayOf(b) < session);
      } catch (_) { historyBySymbol[q.symbol] = []; }
    });
    /* M52 — the usual day comes out of the store, not out of this pass. One read of
       public.ticker_heartbeat_daily for the names under examination, newest row per name within the
       last fortnight (a month-old row would be a stale divisor wearing today's label). Whatever is
       missing simply falls back to the bars, and each event says which it used. */
    const heartbeatBySymbol: Record<string, any> = {};
    try {
      const since = new Date(Date.now() - 14 * 86400e3).toISOString().slice(0, 10);
      const hb = await sbGet("ticker_heartbeat_daily?ticker=in.(" +
        candidates.map((q: any) => encodeURIComponent(q.symbol)).join(",") + ")&date=gte." + since +
        "&order=ticker.asc,date.desc&select=ticker,date,usual_day_60,n&limit=5000");
      for (const r of (hb || [])) if (!(r.ticker in heartbeatBySymbol)) heartbeatBySymbol[r.ticker] = r;
      report.notes.push("usual day: " + Object.keys(heartbeatBySymbol).length + " of " + candidates.length +
        " names read from ticker_heartbeat_daily; the rest computed from bars");
    } catch (_) {
      report.notes.push("ticker_heartbeat_daily unreadable — every usual day computed from bars, as before M52");
    }
    const px = detectPriceOutliers({ quotes: candidates, historyBySymbol, session, ts: iso(now), rules: RULES, heartbeatBySymbol });
    events.push(...px.events);
    report.kinds.price_outlier = px.events.length;
    report.skipped_counts.price = countReasons(px.skipped);

    /* ── earnings: a surprise beyond the name's usual surprise ────────────────────── */
    const ernSel = "select=ticker,date,eps_actual,eps_estimate,revenue_actual,revenue_estimate";
    const todays = await sbGet("earnings_events?" + ernSel + "&date=eq." + session + "&eps_actual=not.is.null&limit=400");
    let ern = { events: [] as any[], skipped: [] as any[] };
    if (todays.length) {
      const names = [...new Set(todays.map((r: any) => r.ticker))];
      const past = await sbGet("earnings_events?" + ernSel + "&ticker=in.(" + names.join(",") + ")&date=lt." + session + "&order=date.desc&limit=2000");
      const historyByTicker: Record<string, any[]> = {};
      for (const r of past) (historyByTicker[r.ticker] ||= []).push(r);
      ern = detectEarningsSurprises({ rows: todays, historyByTicker, ts: iso(now),
        minAbsZ: RULES.earnings.x_usual, minHistory: RULES.earnings.min_past_reports });
      events.push(...ern.events);
    }
    report.kinds.earnings_surprise = ern.events.length;
    report.skipped_counts.earnings = countReasons(ern.skipped);

    /* ── economic: today's prints, and what is about to print ─────────────────────── */
    const ecSel = "select=event_ts,country,event,actual,estimate,previous,impact";
    /* 24 Sep: econ_calendar.event_ts is EPOCH SECONDS (bigint). The first live run sent ISO text
       and got a 400; detect.mjs reads event_ts as a date string, so rows are converted on the way in. */
    const dayFrom = Math.floor((now.getTime() - 36 * 3600e3) / 1000), dayTo = Math.floor((now.getTime() + 36 * 3600e3) / 1000);
    const asIsoTs = (rows: any[]) => (rows || []).map((r: any) => ({ ...r,
      event_ts: typeof r.event_ts === "number" || /^\d+$/.test(String(r.event_ts)) ? new Date(Number(r.event_ts) * 1000).toISOString() : r.event_ts }));
    const ecRows = asIsoTs(await sbGet("econ_calendar?" + ecSel + "&event_ts=gte." + dayFrom + "&event_ts=lte." + dayTo + "&order=event_ts.asc&limit=600"));
    const printed = ecRows.filter((r: any) => r.actual != null && r.estimate != null);
    const historyByEvent: Record<string, any[]> = {};
    if (printed.length) {
      const past = asIsoTs(await sbGet("econ_calendar?" + ecSel + "&event_ts=lt." + dayFrom + "&actual=not.is.null&order=event_ts.desc&limit=4000"));
      for (const r of past) (historyByEvent[econEventKey(r.country, r.event)] ||= []).push(r);
    }
    const ecS = detectEconSurprises({ rows: printed, historyByEvent, ts: iso(now),
      minAbsZ: RULES.econ.x_usual, minHistory: RULES.econ.min_past_prints });
    const ecI = detectEconImminent({ rows: ecRows, nowSec: Math.floor(now.getTime() / 1000), ts: iso(now),
      windowMin: RULES.econ.imminent_minutes });
    events.push(...ecS.events, ...ecI.events);
    report.kinds.econ_surprise = ecS.events.length;
    report.kinds.econ_imminent = ecI.events.length;
    report.skipped_counts.econ = countReasons(ecS.skipped.concat(ecI.skipped));

    const { inserted } = await insert(events);
    report.detected = events.length;
    report.inserted = inserted;
    report.already_stored = events.length - inserted;
    report.ms = Date.now() - started;
    return json(report, 200);
  } catch (e) {
    report.error = String((e as Error).message || e);
    report.ms = Date.now() - started;
    return json(report, 500);
  }
});

function countReasons(skipped: any[]) {
  const out: Record<string, number> = {};
  for (const s of skipped || []) out[s.reason] = (out[s.reason] || 0) + 1;
  return out;
}
function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body, null, 1), { status, headers: { "content-type": "application/json" } });
}
