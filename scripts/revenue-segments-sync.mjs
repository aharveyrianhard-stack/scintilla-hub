/* C5 (3 Oct 2026) · revenue by segment for the served companies, from FMP, on Fly. PRINTS JSON; writes nothing.
   Runs on a throw-away machine of scintilla-massive-stocks-batch (the FMP key is FMP_API_KEY there; never printed):
     node revenue-segments-sync.mjs AMZN MSFT …        (or no arguments: every symbol of the chart API's universe)
   Output: one JSON document { source, taken, companies: { T: { product: {fy, date, currency, data}, geo: {…} } } } —
   the shape of deliverables/20261003/comps-c5/segments-<date>.json — and, with --rows, the rows of public.revenue_segments
   (ticker, kind, segment, revenue, fiscal_year, fiscal_date, reported_currency) for the coordinator to load.
   /stable/ routes only. */
const KEY = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!KEY) { console.error("no FMP key in the environment"); process.exit(2); }
const API = "https://scintilla-massive-chart-api.fly.dev", HUB = "https://scintillahub.ai";
const args = process.argv.slice(2), rows = args.includes("--rows"), asked = args.filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());
let symbols = asked;
if (!symbols.length) { const u = await (await fetch(API + "/universe", { headers: { Origin: HUB } })).json(); symbols = (u.symbols || []).filter((s) => !/USD$/.test(s)); }
const out = {}, EP = { product: "revenue-product-segmentation", geo: "revenue-geographic-segmentation" };
let i = 0;
const worker = async () => {
  while (i < symbols.length) {
    const s = symbols[i++], o = {};
    for (const [kind, ep] of Object.entries(EP)) {
      try {
        const r = await fetch(`https://financialmodelingprep.com/stable/${ep}?symbol=${encodeURIComponent(s)}&structure=flat&apikey=${KEY}`);
        if (!r.ok) { o[kind] = { status: r.status }; continue; }
        const j = await r.json(), row = Array.isArray(j) ? j.find((x) => x && x.period === "FY") || j[0] : null;
        o[kind] = row && row.data ? { fy: row.fiscalYear, date: row.date, currency: row.reportedCurrency, data: Object.fromEntries(Object.entries(row.data).filter(([, v]) => v != null)) } : null;
      } catch (e) { o[kind] = { err: String(e.message).slice(0, 80) }; }
    }
    out[s] = o;
  }
};
await Promise.all([worker(), worker(), worker(), worker()]);
const doc = { source: "FMP /stable/revenue-product-segmentation and revenue-geographic-segmentation, latest FY row", taken: new Date().toISOString().slice(0, 10), companies: out };
if (rows) {
  const R = [];
  for (const [t, o] of Object.entries(out)) for (const kind of ["product", "geo"]) { const p = o[kind]; if (!p || !p.data) continue; for (const [segment, revenue] of Object.entries(p.data)) R.push({ ticker: t, kind, segment, revenue, fiscal_year: p.fy, fiscal_date: p.date, reported_currency: p.currency }); }
  process.stdout.write(JSON.stringify(R));
} else process.stdout.write(JSON.stringify(doc));
