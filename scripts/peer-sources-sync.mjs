/* Scintilla · C4 (1 Oct) · PEER SOURCES — runs on Fly (the FMP and Massive keys live only there), PRINTS rows for the
   coordinator to load into public.peer_sources and public.ticker_industry (no Fly app holds a Supabase service key).
   FMP: /stable/stock-peers?symbol=T (the legacy /api/v3 paths return nothing) and /stable/profile?symbol=T for the
   industry and sector. Massive: /v1/related-companies/T and /v3/reference/tickers/T for the SIC code and description.
   Reads the served list from the chart API's /universe. Prints JSON lines: {"table":"peer_sources"|"ticker_industry", ...row}
   to stdout; counts to stderr; never a key.
     fly machine run <batch image> --rm -a scintilla-massive-stocks-batch -- node scripts/peer-sources-sync.mjs > peer-sources.jsonl
   Options: PEERS_TICKERS=MSFT,LRCX (limit). Then: the coordinator loads the file (e.g. with psql \\copy or a small insert). */
const FMP = process.env.FMP_KEY || process.env.FMP_API_KEY, MASSIVE = process.env.MASSIVE_KEY || process.env.MASSIVE_API_KEY || process.env.POLYGON_API_KEY;
if (!FMP) { console.error("no FMP key in this environment (FMP_KEY / FMP_API_KEY)"); process.exit(2); }
if (!MASSIVE) console.error("no Massive key in this environment: the Massive sources will be skipped");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const get = async (u) => { const r = await fetch(u); if (!r.ok) return null; return r.json(); };
const fmp = (path) => get(`https://financialmodelingprep.com${path}${path.includes("?") ? "&" : "?"}apikey=${FMP}`);
const mas = (path) => MASSIVE ? get(`https://api.massive.com${path}${path.includes("?") ? "&" : "?"}apiKey=${MASSIVE}`) : null;
const uni = await (await fetch("https://scintilla-massive-chart-api.fly.dev/universe", { headers: { Origin: "https://scintillahub.ai" } })).json();
const asked = process.env.PEERS_TICKERS ? process.env.PEERS_TICKERS.split(",").map((t) => t.trim().toUpperCase()) : null;
const want = (uni.symbols || []).filter((t) => !asked || asked.includes(t));
console.error(`companies: ${want.length}`);
const now = new Date().toISOString(); let n = 0, m = 0, k = 0;
for (const t of want) {
  const [p, pr, rel, ref] = await Promise.all([fmp(`/stable/stock-peers?symbol=${t}`), fmp(`/stable/profile?symbol=${t}`), mas(`/v1/related-companies/${t}`), mas(`/v3/reference/tickers/${t}`)]);
  const peers = Array.isArray(p) ? p.map((x) => String(x.symbol || x.peer || "").toUpperCase()).filter((x) => x && x !== t) : [];
  peers.forEach((peer, i) => { console.log(JSON.stringify({ table: "peer_sources", ticker: t, peer, source: "fmp", position: i + 1, fetched_at: now })); n++; });
  const related = rel && Array.isArray(rel.results) ? rel.results.map((x) => String(x.ticker || "").toUpperCase()).filter((x) => x && x !== t) : [];
  related.forEach((peer, i) => { console.log(JSON.stringify({ table: "peer_sources", ticker: t, peer, source: "massive", position: i + 1, fetched_at: now })); m++; });
  const prof = Array.isArray(pr) ? pr[0] : null, r = ref && ref.results ? ref.results : null;
  console.log(JSON.stringify({ table: "ticker_industry", ticker: t, fmp_industry: prof ? prof.industry || null : null, fmp_sector: prof ? prof.sector || null : null, sic_code: r ? r.sic_code || null : null, sic_description: r ? r.sic_description || null : null, source: "fmp:profile+massive:reference", fetched_at: now })); k++;
  await sleep(150);
}
console.error(`printed: ${n} FMP peer rows, ${m} Massive rows, ${k} industry rows`);
