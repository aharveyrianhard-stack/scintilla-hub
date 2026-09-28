// SCINTILLA · prediction-markets v1 — the master tab's collector (L4, 28 Sep 2026).
//
// Alan: "a master tab of the predictive items we're tracking: yields, the Fed, interest rates, is the
// market going to be higher or lower, the Iran war, the Russia war, trade situations. Track the
// movement in them." Every pass reads each topic in topics.json from each ENABLED venue and appends
// rows to public.prediction_market_snapshots (see lib.ts for the change-only rule), plus one row per
// pass in public.prediction_market_runs so a quiet pass is still visible.
//
// NO KEYS for the venues: Polymarket gamma-api / data-api / clob and Kalshi trade-api v2 are public.
// The only secret is this function's own service role, used to write its rows.
// Kalshi ships DISABLED in topics.json (terms question for Alan); the Kalshi code path is tested.
//
// Modes:  POST /prediction-markets             one pass (the cron calls this)
//         POST /prediction-markets?mode=backfill  one-off: 7 days of Polymarket's own hourly price
//                                                  history for every mapped market, kind='backfill'

import REG from "./topics.json" with { type: "json" };
import { type Limits, type Prior, type Row, type Topic, kalshiDiscovery, polymarketDiscovery, priorKey,
  rowsFromKalshiMarkets, rowsFromPolymarketEvent, toWrite, isUsHours } from "./lib.ts";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PM = "https://gamma-api.polymarket.com", PMDATA = "https://data-api.polymarket.com", CLOB = "https://clob.polymarket.com";
const KS = "https://api.elections.kalshi.com/trade-api/v2";
const UA = { "User-Agent": "scintilla-prediction-markets/1.0" };
const VERSION = "prediction-markets-v1";

const limits = REG.limits as Limits;
const topics = REG.topics as Topic[];
const on = (v: "polymarket" | "kalshi") => !!(REG.venues as any)[v]?.enabled;

async function j(url: string) {
  const r = await fetch(url, { headers: UA });
  if (!r.ok) throw new Error("HTTP_" + r.status + " " + url.split("?")[0]);
  return await r.json();
}
const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "Content-Type": "application/json" };

async function priors(): Promise<Map<string, Prior>> {
  const m = new Map<string, Prior>();
  const r = await fetch(`${SB}/rest/v1/prediction_market_latest?select=venue,market_id,outcome,probability,ts&limit=20000`, { headers: sbHeaders });
  if (!r.ok) throw new Error("PRIORS_HTTP_" + r.status);
  for (const x of await r.json()) m.set(priorKey(x), { probability: Number(x.probability), ts: x.ts });
  return m;
}

async function insert(table: string, rows: any[], ignoreDuplicates = false): Promise<string | null> {
  for (let i = 0; i < rows.length; i += 500) {
    const q = ignoreDuplicates ? "?on_conflict=venue,market_id,outcome,ts" : "";
    const r = await fetch(`${SB}/rest/v1/${table}${q}`, { method: "POST",
      headers: { ...sbHeaders, Prefer: "return=minimal" + (ignoreDuplicates ? ",resolution=ignore-duplicates" : "") },
      body: JSON.stringify(rows.slice(i, i + 500)) });
    if (!r.ok) return "HTTP_" + r.status + " " + (await r.text()).slice(0, 200);
  }
  return null;
}

/** open interest per Polymarket condition id; the data-api takes a comma list */
async function polymarketOI(cids: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  for (let i = 0; i < cids.length; i += 20) {
    try {
      for (const x of await j(`${PMDATA}/oi?market=${cids.slice(i, i + 20).join(",")}`)) if (x?.market) m.set(x.market, Number(x.value));
    } catch (_) { /* OI is optional; the row keeps a null */ }
  }
  return m;
}

async function pass(now: Date) {
  const run_id = "pm-" + now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const rows: Row[] = [], problems: any[] = [];
  const pmEvents = new Map<string, any>();

  if (on("polymarket")) {
    const ids = [...new Set(topics.flatMap((t) => t.polymarket?.events || []))];
    await Promise.all(ids.map(async (id) => {
      try { pmEvents.set(id, await j(`${PM}/events/${id}`)); }
      catch (e) { problems.push({ venue: "polymarket", event: id, reason: String(e).slice(0, 120) }); }
    }));
    const cids = [...pmEvents.values()].flatMap((ev) => (ev?.markets || []).filter((m: any) => !m.closed).map((m: any) => m.conditionId)).filter(Boolean);
    const oi = await polymarketOI(cids);
    for (const t of topics) for (const id of t.polymarket?.events || []) {
      const ev = pmEvents.get(id);
      if (!ev) continue;
      if (ev.closed) { problems.push({ venue: "polymarket", topic: t.id, event: id, reason: "EVENT_CLOSED — re-point this topic in topics.json" }); continue; }
      const got = rowsFromPolymarketEvent(ev, t, oi, limits);
      if (got.length) rows.push(...got); else problems.push({ venue: "polymarket", topic: t.id, event: id, reason: "NO_PRICED_MARKET" });
    }
    try {
      const top = await j(`${PM}/events?closed=false&active=true&archived=false&order=volume24hr&ascending=false&limit=80`);
      rows.push(...polymarketDiscovery(top, REG.discovery.exclude_tags, REG.discovery.per_venue));
    } catch (e) { problems.push({ venue: "polymarket", topic: "discover", reason: String(e).slice(0, 120) }); }
  }

  if (on("kalshi")) {
    for (const t of topics) for (const ev of t.kalshi?.events || []) {
      try {
        const got = rowsFromKalshiMarkets(ev, (await j(`${KS}/markets?event_ticker=${ev}&limit=200`))?.markets || [], t, limits);
        if (got.length) rows.push(...got); else problems.push({ venue: "kalshi", topic: t.id, event: ev, reason: "NO_PRICED_MARKET_OR_CLOSED" });
      } catch (e) { problems.push({ venue: "kalshi", topic: t.id, event: ev, reason: String(e).slice(0, 120) }); }
    }
    // the full open-event scan is ~60 requests, so discovery on Kalshi runs every kalshi_every_hours only
    if (now.getUTCHours() % REG.discovery.kalshi_every_hours === 0 && now.getUTCMinutes() < 15) {
      try {
        const evs: any[] = []; let cursor = "";
        for (let page = 0; page < 80; page++) {
          const d = await j(`${KS}/events?status=open&limit=200&with_nested_markets=true${cursor ? "&cursor=" + cursor : ""}`);
          evs.push(...(d?.events || [])); cursor = d?.cursor || "";
          if (!cursor) break;
        }
        rows.push(...kalshiDiscovery(evs, REG.discovery.exclude_kalshi_categories, REG.discovery.per_venue));
      } catch (e) { problems.push({ venue: "kalshi", topic: "discover", reason: String(e).slice(0, 120) }); }
    }
  }

  const { rows: out, unchanged } = toWrite(rows, await priors(), now, limits);
  const ts = now.toISOString();
  const write_error = out.length ? await insert("prediction_market_snapshots", out.map((r) => ({ ...r, ts, run_id }))) : null;
  const summary = { run_id, version: VERSION, us_hours: isUsHours(now), venues: { polymarket: on("polymarket"), kalshi: on("kalshi") },
    read: rows.length, written: write_error ? 0 : out.length, unchanged, problems, write_error };
  await insert("prediction_market_runs", [{ run_id, ts, mode: "pass", version: VERSION, read: summary.read, written: summary.written,
    unchanged, problems, ms: Date.now() - now.getTime() }]);
  return summary;
}

/** one-off: Polymarket's own hourly history for the last 7 days, so the 1-day and 1-week changes mean
 *  something on day one. Same change-only rule, applied along each series; stops 20 minutes before
 *  now so it never overlaps the live reads. */
async function backfill(now: Date) {
  const run_id = "pm-backfill-" + now.toISOString().replace(/[-:.]/g, "").slice(0, 15) + "Z";
  const endTs = Math.floor(now.getTime() / 1000) - 1200, startTs = endTs - 7 * 86400;
  const out: any[] = [], problems: any[] = [];
  for (const t of topics) for (const id of t.polymarket?.events || []) {
    let ev: any;
    try { ev = await j(`${PM}/events/${id}`); } catch (e) { problems.push({ event: id, reason: String(e).slice(0, 120) }); continue; }
    const keep = new Set(rowsFromPolymarketEvent(ev, t, new Map(), limits).map((r) => r.market_id));
    for (const m of ev?.markets || []) {
      if (!keep.has(String(m.id))) continue;
      let outs: string[] = [], toks: string[] = [];
      try { outs = JSON.parse(m.outcomes || "[]"); toks = JSON.parse(m.clobTokenIds || "[]"); } catch { continue; }
      const yi = Math.max(0, outs.findIndex((o) => String(o).toLowerCase() === "yes"));
      if (!toks[yi]) continue;
      let hist: any[] = [];
      try { hist = (await j(`${CLOB}/prices-history?market=${toks[yi]}&startTs=${startTs}&endTs=${endTs}&fidelity=60`))?.history || []; }
      catch (e) { problems.push({ market: m.id, reason: String(e).slice(0, 120) }); continue; }
      const base = rowsFromPolymarketEvent({ ...ev, markets: [m] }, t, new Map(), { ...limits, min_probability: 0 })[0];
      if (!base) continue;
      const prior = new Map<string, Prior>();
      for (const h of hist) {
        const p = Number(h.p), when = new Date(Number(h.t) * 1000);
        if (!isFinite(p) || p < 0 || p > 1) continue;
        const r = { ...base, probability: Number(p.toFixed(4)), bid: null, ask: null, volume: null, volume_24h: null, open_interest: null };
        const w = toWrite([r], prior, when, limits).rows;
        if (w.length) { out.push({ ...w[0], kind: "backfill", ts: when.toISOString(), run_id }); prior.set(priorKey(r), { probability: r.probability, ts: when.toISOString() }); }
      }
    }
  }
  const write_error = out.length ? await insert("prediction_market_snapshots", out, true) : null;
  await insert("prediction_market_runs", [{ run_id, ts: now.toISOString(), mode: "backfill", version: VERSION, read: out.length,
    written: write_error ? 0 : out.length, unchanged: 0, problems, ms: Date.now() - now.getTime() }]);
  return { run_id, version: VERSION, written: write_error ? 0 : out.length, problems: problems.length, write_error };
}

Deno.serve(async (req) => {
  const now = new Date();
  const mode = new URL(req.url).searchParams.get("mode") || "pass";
  try {
    const res = mode === "backfill" ? await backfill(now) : await pass(now);
    return new Response(JSON.stringify(res, null, 1), { status: (res as any).write_error ? 500 : 200, headers: { "Content-Type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e).slice(0, 300), version: VERSION }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
