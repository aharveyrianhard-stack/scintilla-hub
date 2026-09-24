// SCINTILLA · heartbeat-daily v1 (M52) — store every name's usual day, once a day.
//
// WHY THIS EXISTS. Alan, 24 Sep: "that's a range of a normal day-to-day heartbeat. That's important
// to track everywhere. I don't think I have that on the hub much, which means I don't have it on the
// database, which means we don't use it at all." The number was being computed and thrown away on
// every scintilla pass. This function is the writer that gives it a home and a history.
//
// WHAT IT DOES. Asks the chart API which names it serves, reads each name's daily bars, and upserts
// one row per name per trading date into public.ticker_heartbeat_daily: the usual day over 20, 60
// and 250 sessions, plus ATR% over 14. The maths lives in ./heartbeat.mjs — pure, shared with
// scripts/heartbeat-backfill.mjs, and identical in form to scintillas-detect's stdev, so a stored
// heartbeat and a live scintilla can never disagree.
//
// THE RULES IT WILL NOT BREAK.
//   1. It writes to ONE table, public.ticker_heartbeat_daily, and never to a price table.
//   2. Running it twice leaves one row per name per date: the upsert is on (ticker, date).
//   3. It never invents a number. Fewer than 20 sessions of history means NULL for that window and
//      a counted reason in the response, never a zero and never a guess.
//   4. Keys are read from the environment and never printed.
//   5. Bandwidth is bounded and stated: one /universe call plus one /candles call per name, in
//      chunks, with a hard cap.
//
// MODES.
//   (no query)                  — today's settled session for every served name.
//   ?days=N                     — also fills the previous N trading dates from the same bars
//                                 (the backfill: 2 years is ?days=504, run in slices).
//   ?symbols=MCD,BYND           — only these names (a repair, or a new listing).
//   ?dry=1                      — compute and report, write nothing.
import { heartbeatRow, MIN_SESSIONS } from "./heartbeat.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";

// 250 sessions for the longest window + 14 for ATR + room for the requested backfill depth.
const BASE_BARS = 300;
const MAX_SYMBOLS = 1200;          // the served universe is ~364; the cap is a stop, not a target
const CHUNK = 20;                  // names fetched in parallel
const UPSERT_ROWS = 500;           // rows per PostgREST write

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };

async function chartGet(path: string) {
  const r = await fetch(CHART + path, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error("chart " + r.status + " " + path.split("?")[0]);
  return await r.json();
}

async function upsert(rows: any[]) {
  if (!rows.length) return 0;
  let done = 0;
  for (let i = 0; i < rows.length; i += UPSERT_ROWS) {
    const slice = rows.slice(i, i + UPSERT_ROWS);
    const r = await fetch(SB + "/rest/v1/ticker_heartbeat_daily?on_conflict=ticker,date", {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" },
      body: JSON.stringify(slice),
    });
    if (!r.ok) throw new Error("upsert " + r.status + " " + (await r.text()).slice(0, 200));
    done += slice.length;
  }
  return done;
}

const barsOf = (c: any) => (c.series || c.candles || c.bars || c.rows || []) as any[];
const dateOf = (b: any) => new Date(b.t ?? b.time ?? b.date).toISOString().slice(0, 10);

Deno.serve(async (req) => {
  const t0 = Date.now();
  const u = new URL(req.url);
  const days = Math.max(0, Math.min(2000, parseInt(u.searchParams.get("days") || "0", 10) || 0));
  const only = (u.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const dry = u.searchParams.get("dry") === "1";
  const limit = BASE_BARS + days;

  try {
    let symbols: string[] = only;
    if (!symbols.length) {
      const universe = await chartGet("/universe");
      symbols = (universe.symbols || universe.universe || [])
        .map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
    }
    symbols = symbols.slice(0, MAX_SYMBOLS);

    const rows: any[] = [];
    const skipped: any[] = [];
    let short = 0, failed = 0;

    for (let i = 0; i < symbols.length; i += CHUNK) {
      await Promise.all(symbols.slice(i, i + CHUNK).map(async (sym) => {
        let bars: any[];
        try {
          bars = barsOf(await chartGet("/candles?symbol=" + encodeURIComponent(sym) + "&tf=1d&limit=" + limit));
        } catch (e) {
          failed++; skipped.push({ symbol: sym, reason: "CANDLES_FAILED", detail: String(e).slice(0, 80) }); return;
        }
        if (bars.length < MIN_SESSIONS + 1) {
          short++; skipped.push({ symbol: sym, reason: "SHORT_HISTORY", bars: bars.length }); return;
        }
        // One row for the last settled session, then one for each earlier date asked for, each
        // computed from the bars that existed ON that date — so a backfilled heartbeat is what the
        // name's history actually said then, not today's number stamped on an old row.
        for (let back = 0; back <= days; back++) {
          const end = bars.length - back;
          if (end < MIN_SESSIONS + 1) break;
          const window = bars.slice(0, end);
          rows.push(heartbeatRow(sym, dateOf(window[window.length - 1]), window));
        }
      }));
    }

    const written = dry ? 0 : await upsert(rows);
    return new Response(JSON.stringify({
      ok: true, dry, symbols: symbols.length, days, rows: rows.length, written,
      short_history: short, candle_failures: failed,
      skipped: skipped.slice(0, 40), ms: Date.now() - t0,
    }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e).slice(0, 300), ms: Date.now() - t0 }),
      { status: 500, headers: { "content-type": "application/json" } });
  }
});
