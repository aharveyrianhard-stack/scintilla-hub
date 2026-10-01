/* Scintilla · C3b (1 Oct) · FMP PEERS SYNC — runs on Fly, never on a Mac (the FMP key and the service key live only in the
   Fly apps' secrets). For every served company (company_profile, not a fund) it reads FMP's peer list (v4 /stock_peers)
   and replaces that company's rows in public.fmp_peers (migration 20261001_fmp_peers.sql applied first). Prints counts
   only; never a key or a URL that carries one. Same pattern as scripts/fx-filer-sync.mjs.
     fly machine run <batch image> --rm -a scintilla-massive-stocks-batch -e SUPABASE_URL=https://wadinxqplrggagkvrdag.supabase.co -- node scripts/fmp-peers-sync.mjs
   Options: PEERS_TICKERS=TSM,MU (limit), PEERS_DRY=1 (read, print, write nothing). */
const FMP = process.env.FMP_KEY || process.env.FMP_API_KEY;
const SB = process.env.SUPABASE_URL, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!FMP) { console.error("no FMP key in this environment (FMP_KEY / FMP_API_KEY)"); process.exit(2); }
if (!SB || !SRK) { console.error("no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in this environment"); process.exit(2); }
const DRY = process.env.PEERS_DRY === "1";
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: H }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const fmp = async (path) => { const r = await fetch(`https://financialmodelingprep.com${path}${path.includes("?") ? "&" : "?"}apikey=${FMP}`); if (!r.ok) return null; return r.json(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const asked = process.env.PEERS_TICKERS ? process.env.PEERS_TICKERS.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) : null;
const prof = await pg("company_profile?select=ticker,is_etf&is_etf=not.eq.true&order=ticker.asc");
const want = prof.map((p) => p.ticker).filter((t) => !asked || asked.includes(t));
console.log(`companies: ${want.length}${asked ? " (asked)" : ""}`);
let rows = 0, empty = 0;
for (const t of want) {
  const r = await fmp(`/api/v4/stock_peers?symbol=${encodeURIComponent(t)}`);
  const peers = Array.isArray(r) && r[0] && Array.isArray(r[0].peersList) ? r[0].peersList.map((p) => String(p).toUpperCase()).filter((p) => p && p !== t) : [];
  if (!peers.length) { empty++; await sleep(100); continue; }
  const now = new Date().toISOString();
  const body = peers.map((p, i) => ({ ticker: t, peer: p, position: i + 1, source: "fmp:stock_peers", fetched_at: now }));
  if (!DRY) {
    const del = await fetch(`${SB}/rest/v1/fmp_peers?ticker=eq.${encodeURIComponent(t)}`, { method: "DELETE", headers: H });
    if (!del.ok) throw new Error(`fmp_peers delete ${t} → ${del.status}`);
    const ins = await fetch(`${SB}/rest/v1/fmp_peers`, { method: "POST", headers: { ...H, Prefer: "return=minimal" }, body: JSON.stringify(body) });
    if (!ins.ok) throw new Error(`fmp_peers insert ${t} → ${ins.status} ${(await ins.text()).slice(0, 200)}`);
  }
  rows += body.length; await sleep(120);
}
console.log(`${DRY ? "DRY RUN · nothing written" : "written"}: ${rows} peer rows for ${want.length - empty} companies · ${empty} with no FMP list`);
