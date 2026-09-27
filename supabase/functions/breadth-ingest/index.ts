// SCINTILLA · breadth-ingest v1 (B1, 27 Sep 2026)
//
//   ?mode=breadth       copy new rows from the chart API /v1/breadth (both scopes) into public.breadth_daily.
//                       Re-reads the last week so a corrected row replaces its older copy; upsert on
//                       (session_date, scope), so running it twice leaves the same table.
//   ?mode=constituents  FMP sp500-constituent + nasdaq-constituent → public.index_constituents, as_of today (UTC).
//   ?dry=1              compute and report, write nothing.
//
// Writes ONLY those two tables. Keys (SUPABASE_SERVICE_ROLE_KEY, FMP_KEY) come from the environment and
// are never printed or returned.
import { toTableRow, sinceFor, constituentRows, SCOPES } from "./ingest.mjs";

const SB = Deno.env.get("SUPABASE_URL")!;
const SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CHART = Deno.env.get("SC_CHART_API") || "https://scintilla-massive-chart-api.fly.dev";
const FMP = Deno.env.get("FMP_KEY") || Deno.env.get("FMP_API_KEY") || "";
const sbHeaders = { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json" };
const CHUNK = 500;

async function upsert(table: string, conflict: string, rows: unknown[]) {
  for (let i = 0; i < rows.length; i += CHUNK) {
    const r = await fetch(SB + "/rest/v1/" + table + "?on_conflict=" + conflict, { method: "POST",
      headers: { ...sbHeaders, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + CHUNK)) });
    if (!r.ok) throw new Error(table + " upsert http " + r.status + " " + (await r.text()).slice(0, 160));
  }
}

async function breadth(dry: boolean) {
  const out: Record<string, unknown> = {};
  for (const scope of SCOPES) {
    const nr = await fetch(SB + "/rest/v1/breadth_daily?select=session_date&scope=eq." + scope + "&order=session_date.desc&limit=1", { headers: sbHeaders });
    const newest = nr.ok ? ((await nr.json())[0]?.session_date ?? null) : null;
    const since = sinceFor(newest);
    const r = await fetch(CHART + "/v1/breadth?scope=" + scope + (since ? "&since=" + since : ""), { headers: { origin: "https://scintillahub.ai" } });
    if (r.status === 503) { out[scope] = { state: "NOT_PUBLISHED_YET" }; continue; }
    if (!r.ok) throw new Error("chart API /v1/breadth " + scope + " http " + r.status);
    const j = await r.json();
    const rows = (j.rows || []).map((x: Record<string, unknown>) => toTableRow(x, scope));
    if (!dry && rows.length) await upsert("breadth_daily", "session_date,scope", rows);
    out[scope] = { stored_newest_before: newest, read_since: since, rows: rows.length, newest: j.newest_session, written: !dry };
  }
  return out;
}

async function constituents(dry: boolean) {
  if (!FMP) return { state: "NO_FMP_KEY_IN_THIS_FUNCTION" };
  const asOf = new Date().toISOString().slice(0, 10), ts = Math.floor(Date.now() / 1000);
  const out: Record<string, unknown> = {};
  for (const [name, ep] of [["SP500", "sp500-constituent"], ["NASDAQ100", "nasdaq-constituent"]]) {
    const r = await fetch("https://financialmodelingprep.com/stable/" + ep + "?apikey=" + encodeURIComponent(FMP));
    if (!r.ok) { out[name] = { error: "FMP http " + r.status }; continue; }
    const rows = constituentRows(name, await r.json(), asOf, ep, ts);
    if (!dry) await upsert("index_constituents", "index_name,ticker,as_of", rows);
    out[name] = { rows: rows.length, as_of: asOf, written: !dry };
  }
  return out;
}

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const dry = u.searchParams.get("dry") === "1";
  try {
    const mode = u.searchParams.get("mode") || "breadth";
    const result = mode === "constituents" ? await constituents(dry) : mode === "breadth" ? await breadth(dry) : null;
    if (!result) return new Response(JSON.stringify({ error: "mode must be breadth or constituents" }), { status: 400 });
    return new Response(JSON.stringify({ ok: true, mode, dry, result }), { headers: { "content-type": "application/json" } });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String((e as Error).message).slice(0, 300) }), { status: 500, headers: { "content-type": "application/json" } });
  }
});
