/* SCINTILLA · M52 — fill two years of heartbeat history, from this Mac, for the coordinator.

   WHY A SCRIPT AS WELL AS THE FUNCTION. The edge function has a 55-second budget; two years of
   history for ~364 names is more work than that. This runs the SAME pure maths
   (supabase/functions/heartbeat-daily/heartbeat.mjs — imported, not copied, so the two can never
   drift) against the same chart API, and upserts in slices with a printed receipt per slice.

   IT WRITES ONLY public.ticker_heartbeat_daily, on conflict (ticker, date). It never touches a
   price table. Keys come from the environment and are never printed:

     SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/heartbeat-backfill.mjs --days 504

   --dry            compute and print, write nothing (safe to run any time)
   --symbols A,B    only these names
   --days N         how many trading dates back to fill (504 ≈ two years)
*/
import { heartbeatRow, MIN_SESSIONS } from "../supabase/functions/heartbeat-daily/heartbeat.mjs";

const arg = (k, d = null) => { const i = process.argv.indexOf("--" + k); return i > 0 ? process.argv[i + 1] : d; };
const has = (k) => process.argv.includes("--" + k);

const CHART = process.env.SC_CHART_API || "https://scintilla-massive-chart-api.fly.dev";
const SB = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY;
const DAYS = Math.max(0, parseInt(arg("days", "504"), 10) || 0);
const DRY = has("dry");
const ONLY = (arg("symbols", "") || "").split(",").map((s) => s.trim().toUpperCase()).filter(Boolean);

if (!DRY && (!SB || !SERVICE)) {
  console.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (or pass --dry).");
  process.exit(2);
}

const chartGet = async (p) => {
  const r = await fetch(CHART + p, { headers: { origin: "https://scintillahub.ai" } });
  if (!r.ok) throw new Error("chart " + r.status);
  return r.json();
};
const barsOf = (c) => c.series || c.candles || c.bars || c.rows || [];
const dateOf = (b) => new Date(b.t ?? b.time ?? b.date).toISOString().slice(0, 10);

async function upsert(rows) {
  if (DRY || !rows.length) return 0;
  const r = await fetch(SB + "/rest/v1/ticker_heartbeat_daily?on_conflict=ticker,date", {
    method: "POST",
    headers: { apikey: SERVICE, Authorization: "Bearer " + SERVICE, "content-type": "application/json",
               Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify(rows),
  });
  if (!r.ok) throw new Error("upsert " + r.status + " " + (await r.text()).slice(0, 200));
  return rows.length;
}

const main = async () => {
  let symbols = ONLY;
  if (!symbols.length) {
    const u = await chartGet("/universe");
    symbols = (u.symbols || u.universe || []).map((s) => (typeof s === "string" ? s : s.symbol)).filter(Boolean);
  }
  console.log(`${symbols.length} names · ${DAYS} trading dates back · ${DRY ? "DRY RUN" : "writing"}`);
  let wrote = 0, shortHist = 0, failed = 0;
  for (let i = 0; i < symbols.length; i += 10) {
    const chunk = symbols.slice(i, i + 10);
    const rows = [];
    await Promise.all(chunk.map(async (sym) => {
      let bars;
      try { bars = barsOf(await chartGet(`/candles?symbol=${encodeURIComponent(sym)}&tf=1d&limit=${300 + DAYS}`)); }
      catch { failed++; return; }
      if (bars.length < MIN_SESSIONS + 1) { shortHist++; return; }
      for (let back = 0; back <= DAYS; back++) {
        const end = bars.length - back;
        if (end < MIN_SESSIONS + 1) break;
        const w = bars.slice(0, end);
        rows.push(heartbeatRow(sym, dateOf(w[w.length - 1]), w));
      }
    }));
    for (let j = 0; j < rows.length; j += 500) wrote += await upsert(rows.slice(j, j + 500));
    console.log(`  ${Math.min(i + 10, symbols.length)}/${symbols.length} names · ${rows.length} rows this slice · ${wrote} written so far`);
  }
  console.log(`done · ${wrote} rows ${DRY ? "computed (nothing written)" : "written"} · ${shortHist} too short · ${failed} candle failures`);
};
main().catch((e) => { console.error(String(e).slice(0, 300)); process.exit(1); });
