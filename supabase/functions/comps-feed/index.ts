// SCINTILLA · comps-feed v7 (CP3, 7 Oct 2026; v6 was FD1's) — the value layer of the allocation tool, from the SCINTILLA database only.
//
// v7: fwd_pe is the dashboard's forward P/E — today's price ÷ the next four quarters of consensus EPS (./forward-basis.mjs,
// the one rule the dashboard, the comps tab, the cards and this feed share). "Today" is the New York date, as on the dashboard.
//
// WHY v6. v5 (20 Jul) told the live knockout that Micron's sales were shrinking 59% (they grew 256%) and gave every
// name a forward P/E of 0. The cause, the rules that replace it and the measured rows are in ./feed.mjs; this file is
// only the reads and the answer. It makes no FMP call and writes to no table.
//
// THE CONTRACT IS UNCHANGED, so no page changes:
//   GET /functions/v1/comps-feed?syms=MU,SNDK,…   (up to 60 symbols, as before; no key needed, as before)
//   → text/csv:  sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated
//   A figure that is not held is an EMPTY cell (v5 printed 0). Margins and growth are fractions (0.64, 2.56).
//   The price and the market value behind pe, fwd_pe, ps and mktcap are today's, from company_profile (v5 used the
//   market value of the last fiscal period end). `updated` is the fundamentals row's own date, not the minute asked.
//   ?format=json adds the basis of every figure (which twelve months, which fiscal year, which currency rate).
//
// THE RULES IT WILL NOT BREAK.
//   1. Read-only: GET requests to PostgREST, nothing else.
//   2. Every read names its period, carries a total order and is paged to its end (feed.mjs readAll).
//   3. If a read fails, the answer is the header alone with status 503 — a name with no line reads "not held" on the
//      page. It never prints a guess.
//   4. Keys are read from the environment and never printed.
import { HEAD, VERSION, parseSyms, readTables, buildFeed } from "./feed.mjs";

const SB_URL = Deno.env.get("SUPABASE_URL") || "";
const SB_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const CORS = { "Cache-Control": "no-store", "Access-Control-Allow-Origin": "*", "x-comps-feed-version": VERSION };
const CSV = { ...CORS, "Content-Type": "text/csv; charset=utf-8" };
const JSONH = { ...CORS, "Content-Type": "application/json; charset=utf-8" };

async function get(path: string) {
  const r = await fetch(SB_URL + "/rest/v1/" + path, { headers: { apikey: SB_KEY, Authorization: "Bearer " + SB_KEY } });
  if (!r.ok) throw new Error(path.split("?")[0] + " " + r.status);
  return await r.json();
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "GET") return new Response(HEAD, { status: 405, headers: CSV });
  const u = new URL(req.url);
  const syms = parseSyms(u.searchParams.get("syms") || "");
  const asJson = u.searchParams.get("format") === "json";
  if (!syms.length) return new Response(asJson ? JSON.stringify({ version: VERSION, rows: [] }) : HEAD, { headers: asJson ? JSONH : CSV });
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "America/New_York" });   // v7: the dashboard's "today" (New York), so a quarter ending today is in or out on both at once
  try {
    const out = buildFeed(syms, await readTables(get, syms, today), today);
    return new Response(asJson ? JSON.stringify({ version: VERSION, today, rows: out.rows }) : out.csv, { headers: asJson ? JSONH : CSV });
  } catch (e) {
    const why = String((e && (e as Error).message) || e).slice(0, 120);
    return new Response(asJson ? JSON.stringify({ version: VERSION, error: why, rows: [] }) : HEAD, { status: 503, headers: { ...(asJson ? JSONH : CSV), "x-comps-feed-error": why } });
  }
});
