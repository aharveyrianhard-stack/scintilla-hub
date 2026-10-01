/* Scintilla · C3 (1 Oct) · FOREIGN FILERS SYNC — runs on Fly, never on a Mac (the FMP key and the service key live only in
   the Fly apps' secrets; Common, 27 Sep: "the Fly is for you guys"). Reads FMP's reporting currency for every served
   company that is an ADR or domiciled outside the US, and FMP's daily CCYUSD closes since 2023-01-01 for each currency
   found, and upserts public.filer_currency and public.fx_rates (migration 20261001_fx_filer.sql must be applied first).
   Prints counts and dates only; never a key or a URL that carries one.

   The coordinator runs it as a one-off machine that copies the batch app's secrets:
     fly machine run <batch image> --rm -a scintilla-massive-stocks-batch --region <region> \
       -e SUPABASE_URL=https://wadinxqplrggagkvrdag.supabase.co -- node scripts/fx-filer-sync.mjs
   (FMP_KEY or FMP_API_KEY and SUPABASE_SERVICE_ROLE_KEY come from the app's secrets.) Re-runnable: upserts only.
   Options: FX_TICKERS=TSM,ASML (limit), FX_FROM=2023-01-01 (series start), FX_DRY=1 (read, print, write nothing). */
const FMP = process.env.FMP_KEY || process.env.FMP_API_KEY;
const SB = process.env.SUPABASE_URL, SRK = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!FMP) { console.error("no FMP key in this environment (FMP_KEY / FMP_API_KEY)"); process.exit(2); }
if (!SB || !SRK) { console.error("no SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in this environment"); process.exit(2); }
const DRY = process.env.FX_DRY === "1", FROM = process.env.FX_FROM || "2023-01-01";
const H = { apikey: SRK, Authorization: "Bearer " + SRK, "Content-Type": "application/json" };
const pg = async (p) => { const r = await fetch(SB + "/rest/v1/" + p, { headers: H }); if (!r.ok) throw new Error(p.split("?")[0] + " → " + r.status); return r.json(); };
const upsert = async (table, rows, onConflict) => { if (DRY || !rows.length) return; for (let i = 0; i < rows.length; i += 500) { const r = await fetch(`${SB}/rest/v1/${table}?on_conflict=${onConflict}`, { method: "POST", headers: { ...H, Prefer: "resolution=merge-duplicates,return=minimal" }, body: JSON.stringify(rows.slice(i, i + 500)) }); if (!r.ok) throw new Error(`${table} upsert → ${r.status} ${(await r.text()).slice(0, 200)}`); } };
const fmp = async (path) => { const r = await fetch(`https://financialmodelingprep.com${path}${path.includes("?") ? "&" : "?"}apikey=${FMP}`); if (!r.ok) return null; return r.json(); };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const asked = process.env.FX_TICKERS ? process.env.FX_TICKERS.split(",").map((t) => t.trim().toUpperCase()).filter(Boolean) : null;
const prof = await pg("company_profile?select=ticker,country,is_adr,is_etf&is_etf=not.eq.true");
const want = prof.filter((p) => asked ? asked.includes(p.ticker) : (p.is_adr === true || (p.country && String(p.country).toUpperCase() !== "US"))).map((p) => p.ticker);
console.log(`foreign filers to read: ${want.length}${asked ? " (asked)" : ""}`);
const filers = [], currencies = new Set();
for (const t of want) {
  const [inc, pr] = await Promise.all([fmp(`/api/v3/income-statement/${t}?period=quarter&limit=1`), fmp(`/api/v3/profile/${t}`)]);
  const q = Array.isArray(inc) ? inc[0] : null, p = Array.isArray(pr) ? pr[0] : null;
  if (!q || !q.reportedCurrency) { console.log(`${t}: no statement currency from FMP`); continue; }
  const ccy = String(q.reportedCurrency).toUpperCase();
  filers.push({ ticker: t, reported_currency: ccy, listing_currency: p ? p.currency : null, is_adr: p ? !!p.isAdr : null, shares_dil: q.weightedAverageShsOutDil ?? null, statement_date: q.date, source: "fmp:income-statement", updated_at: new Date().toISOString() });
  if (ccy !== "USD") currencies.add(ccy);
  await sleep(120);
}
console.log(`filers read: ${filers.length} · currencies: ${[...currencies].join(", ") || "none"}`);
await upsert("filer_currency", filers, "ticker");
let n = 0;
for (const c of currencies) {
  const h = await fmp(`/api/v3/historical-price-full/${c}USD?from=${FROM}&to=${new Date().toISOString().slice(0, 10)}`);
  const rows = h && Array.isArray(h.historical) ? h.historical.filter((d) => d.close > 0).map((d) => ({ pair: c + "USD", date: d.date, rate: d.close, source: "fmp:historical-price-full" })) : [];
  console.log(`${c}USD: ${rows.length} days${rows.length ? ` · ${rows[rows.length - 1].date} → ${rows[0].date}` : ""}`);
  await upsert("fx_rates", rows, "pair,date"); n += rows.length; await sleep(120);
}
console.log(`${DRY ? "DRY RUN · nothing written" : "written"}: ${filers.length} filer rows, ${n} rate rows`);
