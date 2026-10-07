/* CP2 (7 Oct 2026) · the business facts a decision card's BUSINESS block needs, from FMP, on Fly. PRINTS JSON; writes
   nothing to any table. Runs on a throw-away machine of scintilla-massive-stocks-batch (the FMP key is FMP_API_KEY there;
   it is never printed, and no address that carries it is ever printed):
     node business-facts-fmp.mjs MU SNDK WDC STX …
   Per symbol, /stable/ routes only:
     revenue-product-segmentation, revenue-geographic-segmentation (structure=flat)   the fiscal-year rows, the two newest kept
     income-statement (annual, 3)            revenue, gross profit, operating income
     income-statement (quarter, 6)           the same by quarter: the last four are added for the trailing twelve months
     cash-flow-statement (annual, 3)         cash from operations, capital spending, free cash flow
     cash-flow-statement (quarter, 6)        the same by quarter: four quarters are added when the fiscal-year row has no
                                             capital-spending line yet, and the two readings are compared when both exist
     cash-flow-statement-ttm                 FMP's own trailing twelve months, kept for the comparison
     profile                                 market value, price, currency
   Output: { source, taken_utc, calls, http, companies: { T: { product, geo, income, income_q, cash, cash_q, cash_ttm, profile } } }.
   A route that does not answer is carried as { status } so the gap is visible instead of silent.
   (FMP's QUARTERLY revenue splits were read once on 7 Oct and are not used: they are patchy — half-year totals filed as a
   quarter, negative quarters after a spin-off — so the pies use the fiscal-year rows only.) */
const KEY = process.env.FMP_API_KEY || process.env.FMP_KEY;
if (!KEY) { console.error("no FMP key in the environment"); process.exit(2); }
const symbols = process.argv.slice(2).filter((a) => !a.startsWith("--")).map((s) => s.toUpperCase());
if (!symbols.length) { console.error("name the symbols"); process.exit(2); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let calls = 0; const http = {};
async function fmp(route, q) {
  for (let a = 0; a < 4; a++) {
    calls++;
    let r;
    try { r = await fetch("https://financialmodelingprep.com/stable/" + route + "?" + q + "&apikey=" + KEY); }
    catch (e) { await sleep(700 * (a + 1)); continue; }
    http[r.status] = (http[r.status] || 0) + 1;
    if (r.status === 429) { await sleep(1500 * (a + 1)); continue; }
    if (!r.ok) return { status: r.status };
    try { return await r.json(); } catch (_) { return { status: "bad-json" }; }
  }
  return { status: "gave-up" };
}
const fyRows = (j) => !Array.isArray(j) ? j : j.filter((x) => x && x.data && (x.period === "FY" || x.period == null))
  .sort((a, b) => String(b.date).localeCompare(String(a.date))).slice(0, 2)
  .map((x) => ({ fy: x.fiscalYear, date: x.date, period: x.period, currency: x.reportedCurrency, data: Object.fromEntries(Object.entries(x.data).filter(([, v]) => v != null)) }));
const pick = (j, keys, n) => !Array.isArray(j) ? j : j.slice(0, n).map((x) => Object.fromEntries(keys.map((k) => [k, x[k] ?? null])));
const INC = ["date", "fiscalYear", "period", "reportedCurrency", "filingDate", "revenue", "costOfRevenue", "grossProfit", "operatingIncome", "netIncome", "ebitda"];
const CASH = ["date", "fiscalYear", "period", "reportedCurrency", "filingDate", "netCashProvidedByOperatingActivities", "operatingCashFlow", "capitalExpenditure", "investmentsInPropertyPlantAndEquipment", "freeCashFlow"];
const out = {};
let i = 0;
const worker = async () => {
  while (i < symbols.length) {
    const s = symbols[i++], e = encodeURIComponent(s), o = {};
    o.product = fyRows(await fmp("revenue-product-segmentation", "symbol=" + e + "&structure=flat"));
    o.geo = fyRows(await fmp("revenue-geographic-segmentation", "symbol=" + e + "&structure=flat"));
    o.income = pick(await fmp("income-statement", "symbol=" + e + "&period=annual&limit=3"), INC, 3);
    o.income_q = pick(await fmp("income-statement", "symbol=" + e + "&period=quarter&limit=6"), INC, 6);
    o.cash = pick(await fmp("cash-flow-statement", "symbol=" + e + "&period=annual&limit=3"), CASH, 3);
    o.cash_q = pick(await fmp("cash-flow-statement", "symbol=" + e + "&period=quarter&limit=6"), CASH, 6);
    const ttm = await fmp("cash-flow-statement-ttm", "symbol=" + e + "&limit=1");
    o.cash_ttm = Array.isArray(ttm) && ttm[0] ? Object.fromEntries(CASH.map((k) => [k, ttm[0][k] ?? null])) : ttm;
    const p = await fmp("profile", "symbol=" + e);
    const pr = Array.isArray(p) ? p[0] : null;
    o.profile = pr ? { symbol: pr.symbol, companyName: pr.companyName, marketCap: pr.marketCap ?? null, price: pr.price ?? null, currency: pr.currency ?? null, sector: pr.sector ?? null, industry: pr.industry ?? null, isEtf: pr.isEtf ?? null, isFund: pr.isFund ?? null } : p;
    out[s] = o;
    await sleep(120);
  }
};
await Promise.all([worker(), worker(), worker()]);
process.stdout.write(JSON.stringify({
  source: "FMP /stable/: revenue-product-segmentation, revenue-geographic-segmentation (structure=flat), income-statement and cash-flow-statement (annual and quarter), cash-flow-statement-ttm, profile",
  taken_utc: new Date().toISOString(), calls, http, companies: out }));
