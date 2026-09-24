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
// Econ (surprise + imminent) and earnings run in BOTH modes: they cost two database reads.
import {
  detectPriceOutliers, detectEarningsSurprises, detectEconSurprises, detectEconImminent, econEventKey,
} from "./detect.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
const PREFILTER_PCT = 0.5;      // below this a move cannot be a 2-sigma day for any name we serve intraday
const MAX_CANDLE_FETCH = 140;   // hard ceiling on daily-bar reads per run
const CANDLE_DAYS = 90;         // ~60 trading days -> a 20-day volatility is comfortably covered
const CONCURRENCY = 6;

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

Deno.serve(async (req) => {
  const started = Date.now();
  const url = new URL(req.url);
  const mode = url.searchParams.get("mode") === "session" ? "session" : "intraday";
  const now = new Date();
  const session = sessionET(now);
  const report: any = { mode, session, at: iso(now), kinds: {}, skipped_counts: {}, notes: [] };
  const events: any[] = [];

  try {
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
    const px = detectPriceOutliers({ quotes: candidates, historyBySymbol, session, ts: iso(now) });
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
      ern = detectEarningsSurprises({ rows: todays, historyByTicker, ts: iso(now) });
      events.push(...ern.events);
    }
    report.kinds.earnings_surprise = ern.events.length;
    report.skipped_counts.earnings = countReasons(ern.skipped);

    /* ── economic: today's prints, and what is about to print ─────────────────────── */
    const ecSel = "select=event_ts,country,event,actual,estimate,previous,impact";
    const dayFrom = iso(new Date(now.getTime() - 36 * 3600e3)), dayTo = iso(new Date(now.getTime() + 36 * 3600e3));
    const ecRows = await sbGet("econ_calendar?" + ecSel + "&event_ts=gte." + dayFrom + "&event_ts=lte." + dayTo + "&order=event_ts.asc&limit=600");
    const printed = ecRows.filter((r: any) => r.actual != null && r.estimate != null);
    const historyByEvent: Record<string, any[]> = {};
    if (printed.length) {
      const past = await sbGet("econ_calendar?" + ecSel + "&event_ts=lt." + dayFrom + "&actual=not.is.null&order=event_ts.desc&limit=4000");
      for (const r of past) (historyByEvent[econEventKey(r.country, r.event)] ||= []).push(r);
    }
    const ecS = detectEconSurprises({ rows: printed, historyByEvent, ts: iso(now) });
    const ecI = detectEconImminent({ rows: ecRows, nowSec: Math.floor(now.getTime() / 1000), ts: iso(now) });
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
