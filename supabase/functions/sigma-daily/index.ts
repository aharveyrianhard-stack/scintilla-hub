// SCINTILLA · sigma-daily v1 (28 Sep, N6) — USUAL DAY's history tops itself up after each close.
//
// WHAT IT DOES. Reads the newest date already in public.sigma_day_counts, asks the chart API which names it serves,
// reads each name's recent daily bars (only enough to hold 60 moves before that date), measures every day from that
// date on with the backfill's own test (../heartbeat-daily/sigma.mjs, the maths scripts/sigma-history-backfill.mjs
// uses), and ADDS the rows: public.sigma_events_daily (one per name per day that fired) and public.sigma_day_counts
// (one per date). The planning is pure and lives in ./topup.mjs.
//
// THE RULES IT WILL NOT BREAK.
//   1. ADDITIVE: rows are inserted with on-conflict-do-nothing (Prefer: resolution=ignore-duplicates). A row already
//      stored is never changed, so the 28 Sep load and anything a person corrected stay exactly as they are.
//   2. Two tables only. Never a price table, never public.scintillas (the live detector's store).
//   3. It never writes a half-known day: the newest day waits while names that traded the session before are still
//      missing its bar, and a name the chart API failed for holds the run (see topup.mjs). The response says what waited.
//   4. Keys come from this function's own environment (SUPABASE_SERVICE_ROLE_KEY) and are never printed.
//   5. Bounded: one read of sigma_day_counts, one /universe, one /candles per name (~100 bars each), in chunks.
//
// MODES.
//   (no query)          — from the newest stored date to the newest settled session.
//   ?since=YYYY-MM-DD   — from that date instead (at most 250 sessions back; older is the backfill script's job).
//   ?symbols=A,B        — only these names; never writes sigma_day_counts (a partial universe would undercount it).
//   ?dry=1              — plan and report, write nothing.
//   ?force=1            — write the newest day even if some names' bars are late (a coordinator's forced run).
import { planTopUp, barsNeeded, SIGMA_TOPUP_VERSION } from "./topup.mjs";
import { RULES } from "../scintillas-detect/rules.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
const MAX_SYMBOLS = 1200;          // the served universe is 486; the cap is a stop, not a target
const CHUNK = 12;                  // names fetched in parallel
const UPSERT_ROWS = 500;
const SOURCE = "chart-api:/candles?tf=1d";   // the same provenance the backfill stamps: same bars, same test

const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const barsOf = (c: any) => (c.series || c.candles || c.bars || c.rows || []) as any[];

async function chartGet(path: string) {
  for (let k = 0; k < 3; k++) {
    const r = await fetch(CHART + path, { headers: { origin: "https://scintillahub.ai" } });
    if (r.ok) return await r.json();
    if (r.status < 500 && r.status !== 429) throw new Error("chart " + r.status);
    await new Promise((res) => setTimeout(res, 1200 * (k + 1)));
  }
  throw new Error("chart retries exhausted");
}
async function insertNew(table: string, conflict: string, rows: any[]) {
  let done = 0;
  for (let i = 0; i < rows.length; i += UPSERT_ROWS) {
    const slice = rows.slice(i, i + UPSERT_ROWS);
    const r = await fetch(SB + "/rest/v1/" + table + "?on_conflict=" + conflict, {
      method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=ignore-duplicates,return=representation" },
      body: JSON.stringify(slice),
    });
    if (!r.ok) throw new Error("insert " + table + " " + r.status + " " + (await r.text()).slice(0, 200));
    done += ((await r.json()) as any[]).length;   // rows actually added (duplicates are skipped and not returned)
  }
  return done;
}
async function newestStored(): Promise<string | null> {
  const r = await fetch(SB + "/rest/v1/sigma_day_counts?select=date&order=date.desc&limit=1", { headers: sbHeaders });
  if (!r.ok) throw new Error("read sigma_day_counts " + r.status);
  const j = await r.json();
  return j && j[0] ? j[0].date : null;
}

Deno.serve(async (req) => {
  const t0 = Date.now();
  const u = new URL(req.url);
  const dry = u.searchParams.get("dry") === "1";
  const force = u.searchParams.get("force") === "1";
  const only = (u.searchParams.get("symbols") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);
  const today = new Date().toISOString().slice(0, 10);
  try {
    const since = u.searchParams.get("since") || await newestStored();
    if (!since || !/^\d{4}-\d{2}-\d{2}$/.test(since)) throw new Error("no start date: sigma_day_counts is empty; load it with scripts/sigma-history-backfill.mjs first");
    const limit = barsNeeded(since, today);
    if (limit == null) throw new Error("since " + since + " is more than 250 sessions back; use scripts/sigma-history-backfill.mjs --since " + since);
    let symbols: string[] = only;
    if (!symbols.length) {
      const universe = await chartGet("/universe");
      symbols = (universe.symbols || universe.universe || []).map((s: any) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
    }
    symbols = symbols.slice(0, MAX_SYMBOLS);
    const barsBySymbol: Record<string, any[]> = {}, failed: string[] = [];
    for (let i = 0; i < symbols.length; i += CHUNK) {
      await Promise.all(symbols.slice(i, i + CHUNK).map(async (sym) => {
        try { barsBySymbol[sym] = barsOf(await chartGet(`/candles?symbol=${encodeURIComponent(sym)}&tf=1d&limit=${limit}`)); }
        catch (e) { failed.push(sym + ": " + String((e as Error).message || e).slice(0, 60)); }
      }));
    }
    const plan = planTopUp(barsBySymbol, RULES, { since, force, failed: failed.map((f) => f.split(":")[0]) });
    const events = plan.events.map((e: any) => ({ ...e, source: SOURCE }));
    let wroteE = 0, wroteC = 0;
    if (!dry) {
      wroteE = await insertNew("sigma_events_daily", "ticker,date", events);
      if (!only.length) wroteC = await insertNew("sigma_day_counts", "date", plan.counts);
    }
    return Response.json({
      ok: true, version: SIGMA_TOPUP_VERSION, rules_version: RULES.version, dry, force, since, bars_per_name: limit,
      names: Object.keys(barsBySymbol).length, failed, newest_bar: plan.newest_bar,
      dates_written: plan.written_dates, held: plan.held, lagging: plan.lagging,
      planned: { sigma_events_daily: events.length, sigma_day_counts: only.length ? 0 : plan.counts.length },
      added: dry ? "nothing (dry run)" : { sigma_events_daily: wroteE, sigma_day_counts: wroteC },
      counts: plan.counts, ms: Date.now() - t0,
    });
  } catch (e) {
    return Response.json({ ok: false, error: String((e as Error).message || e).slice(0, 300), ms: Date.now() - t0 }, { status: 500 });
  }
});
