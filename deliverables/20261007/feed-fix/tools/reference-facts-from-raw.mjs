/* FD1 · THE REFERENCE PEERS' FACTS FILE FROM RAW FMP ANSWERS. Pure assembly: no network, no key.

   The comps code prices SK hynix, Samsung and Kioxia from one dated facts file,
   deliverables/20261003/comps-c5/reference-peers-facts-<date>.json, in the shape scripts/fx-multiples-check.mjs prints on
   Fly. When that job cannot be run, the coordinator's FMP connector can answer the same nine questions per symbol and
   save each answer as it comes (any file name, one JSON answer per file) in
   workspaces/scintilla/staging/fmp-foreign-peers-20261007/. This tool reads every .json there, tells each answer by
   what is IN it (never by its file name), and writes the facts file. It invents nothing: an answer that is not there
   is listed as missing and the company goes without that figure.

     node reference-facts-from-raw.mjs <folder of raw answers> <out facts.json> [--taken 2026-10-07T05:00:00Z]

   The nine FMP /stable/ answers per symbol (000660.KS, 005930.KS, 285A.T, and SKHY as SK hynix's US line):
     profile · quote · income-statement?period=quarter&limit=8 · balance-sheet-statement?period=quarter&limit=2 ·
     key-metrics?period=quarter&limit=1 · analyst-estimates?period=annual&limit=6 · ratios-ttm · key-metrics-ttm
   and once per currency: historical-price-eod/light?symbol=KRWUSD&from=2024-01-01 (and JPYUSD). */
import { readFileSync, writeFileSync, readdirSync, statSync } from "node:fs"; import path from "node:path";

const arr = (x) => (Array.isArray(x) ? x : x && Array.isArray(x.data) ? x.data : x && Array.isArray(x.result) ? x.result : x && Array.isArray(x.historical) ? x.historical : x && typeof x === "object" ? [x] : []);
const has = (r, ...keys) => keys.every((k) => r && Object.prototype.hasOwnProperty.call(r, k));
/** Which FMP answer a list of rows is, by its fields. */
export function kindOf(rows) {
  const r = rows[0]; if (!r || typeof r !== "object") return null;
  if (has(r, "priceToEarningsRatioTTM") || has(r, "priceToSalesRatioTTM")) return "ratios_ttm";
  if (has(r, "evToSalesTTM") || has(r, "enterpriseValueTTM") || has(r, "evToEBITDATTM")) return "key_metrics_ttm";
  if (has(r, "epsAvg") || has(r, "revenueAvg")) return "estimates";
  if (has(r, "revenue", "netIncome") && (has(r, "grossProfit") || has(r, "operatingIncome"))) return "income";
  if (has(r, "cashAndCashEquivalents") && (has(r, "totalDebt") || has(r, "netDebt"))) return "balance";
  if (has(r, "enterpriseValue", "marketCap") && has(r, "date")) return "key_metrics";
  if (has(r, "companyName") || (has(r, "isAdr") && has(r, "currency"))) return "profile";
  if (has(r, "date") && (has(r, "price") || has(r, "close")) && /^[A-Z]{6}$/.test(String(r.symbol || ""))) return "fx";
  if (has(r, "price") && (has(r, "previousClose") || has(r, "dayLow") || has(r, "changePercentage") || has(r, "timestamp") || has(r, "volume"))) return "quote";
  return null;
}
const pickIS = (r) => ({ date: r.date, period: r.period, fiscalYear: r.fiscalYear, reportedCurrency: r.reportedCurrency, revenue: r.revenue, grossProfit: r.grossProfit, operatingIncome: r.operatingIncome, ebitda: r.ebitda, netIncome: r.netIncome, eps: r.eps, epsDiluted: r.epsDiluted, weightedAverageShsOutDil: r.weightedAverageShsOutDil });
const pickBS = (r) => ({ date: r.date, period: r.period, reportedCurrency: r.reportedCurrency, netDebt: r.netDebt, totalDebt: r.totalDebt, cashAndCashEquivalents: r.cashAndCashEquivalents });
const newestFirst = (a, b) => String(b.date).localeCompare(String(a.date));

/** answers: [{ file, json }] → { doc (the facts file), report: { per symbol: what arrived, what is missing }, unread: [files] }. */
export function assemble(answers, { taken = new Date().toISOString(), symbols = ["000660.KS", "005930.KS", "285A.T", "SKHY"] } = {}) {
  const got = {}, fx = {}, unread = [];
  const slot = (s) => (got[s] ||= {});
  for (const { file, json } of answers) {
    const rows = arr(json), kind = kindOf(rows);
    if (!kind) { unread.push(file); continue; }
    if (kind === "fx") { const ccy = String(rows[0].symbol).slice(0, 3); if (String(rows[0].symbol).slice(3) !== "USD") { unread.push(file); continue; } fx[ccy] = rows.filter((x) => x.date && Number(x.price ?? x.close) > 0).map((x) => [String(x.date).slice(0, 10), Number(x.price ?? x.close)]).sort((a, b) => a[0].localeCompare(b[0])); continue; }
    const sym = String(rows[0].symbol || path.basename(file).replace(/\.json$/, "").split(/[_ ]/).find((p) => /^[0-9A-Z.]+$/.test(p)) || "").toUpperCase();
    if (!sym) { unread.push(file); continue; }
    const g = slot(sym);
    if (kind === "income") { const q = rows.filter((r) => /^Q[1-4]$/.test(String(r.period))); if (q.length) g.income_q = q.sort(newestFirst).slice(0, 8).map(pickIS); else g.income_annual_only = true; }
    else if (kind === "balance") g.balance_q = rows.slice().sort(newestFirst).slice(0, 2).map(pickBS);
    else if (kind === "estimates") g.estimates = rows.slice().sort((a, b) => String(a.date).localeCompare(String(b.date))).map((e) => ({ date: e.date, epsAvg: e.epsAvg, revenueAvg: e.revenueAvg, ebitdaAvg: e.ebitdaAvg }));
    else g[kind] = rows.slice().sort(newestFirst)[0];
  }
  const doc = { source: "FMP /stable/ (profile, quote, income-statement, balance-sheet-statement, key-metrics, analyst-estimates, ratios-ttm, key-metrics-ttm, historical-price-eod/light) — raw answers assembled by deliverables/20261007/feed-fix/tools/reference-facts-from-raw.mjs", taken, companies: {}, fx }, report = {};
  for (const s of [...new Set([...symbols, ...Object.keys(got)])]) {
    const g = got[s] || {}, p = g.profile || {}, q = g.quote || {}, r = g.ratios_ttm || {}, k = g.key_metrics_ttm || {}, m = g.key_metrics || {};
    const need = ["profile", "quote", "income_q", "balance_q", "key_metrics", "estimates", "ratios_ttm", "key_metrics_ttm"], missing = need.filter((x) => !g[x] || (Array.isArray(g[x]) && !g[x].length));
    report[s] = { arrived: need.filter((x) => !missing.includes(x)), missing, listing_currency: p.currency || null, statement_currency: (g.income_q && g.income_q[0] && g.income_q[0].reportedCurrency) || null, quarters: (g.income_q || []).length, estimate_years: (g.estimates || []).length, ...(g.income_annual_only ? { note: "the income statement that arrived is annual: the comps reader needs the quarterly one (period=quarter)" } : {}) };
    if (!g.profile && !g.quote && !g.income_q) continue;
    doc.companies[s] = { profile: { price: p.price, marketCap: p.marketCap ?? p.mktCap, currency: p.currency, country: p.country, isAdr: p.isAdr, exchange: p.exchange ?? p.exchangeShortName, industry: p.industry ?? null },
      quote: { price: q.price, marketCap: q.marketCap, sharesOutstanding: q.sharesOutstanding, timestamp: q.timestamp },
      income_q: g.income_q || [], balance_q: g.balance_q || [], key_metrics_q: { date: m.date, reportedCurrency: m.reportedCurrency, marketCap: m.marketCap, enterpriseValue: m.enterpriseValue }, estimates: g.estimates || [],
      fmp_ttm: { pe: r.priceToEarningsRatioTTM, ps: r.priceToSalesRatioTTM, ev_ebitda_ratios: r.enterpriseValueMultipleTTM, ev_sales_km: k.evToSalesTTM, ev_ebitda_km: k.evToEBITDATTM, marketCap_km: k.marketCap, enterpriseValue_km: k.enterpriseValueTTM, peg: r.priceToEarningsGrowthRatioTTM, fpeg: r.forwardPriceToEarningsGrowthRatioTTM } };
  }
  const ccys = [...new Set(Object.values(doc.companies).flatMap((c) => [c.profile.currency, ...(c.income_q || []).map((x) => x.reportedCurrency)]).filter((c) => c && c !== "USD"))];
  return { doc, report, unread, currencies: Object.fromEntries(ccys.map((c) => [c, { rate_days: (fx[c] || []).length, newest: (fx[c] || []).slice(-1)[0] || null }])) };
}

if (process.argv[1] && process.argv[1].endsWith("reference-facts-from-raw.mjs")) {
  const dir = process.argv[2], out = process.argv[3], ti = process.argv.indexOf("--taken");
  if (!dir || !out) { console.error("usage: node reference-facts-from-raw.mjs <folder of raw answers> <out facts.json> [--taken ISO]"); process.exit(2); }
  const files = readdirSync(dir).filter((f) => f.endsWith(".json")).map((f) => path.join(dir, f));
  const answers = files.map((file) => { try { return { file: path.basename(file), json: JSON.parse(readFileSync(file, "utf8")) }; } catch (e) { return { file: path.basename(file), json: null }; } });
  const newest = files.length ? new Date(Math.max(...files.map((f) => statSync(f).mtimeMs))).toISOString() : new Date().toISOString();
  const A = assemble(answers, { taken: ti > 0 ? process.argv[ti + 1] : newest });
  writeFileSync(out, JSON.stringify(A.doc));
  console.log("raw answers read:", answers.length, "· not recognised:", A.unread.length ? A.unread.join(", ") : "none");
  for (const [s, r] of Object.entries(A.report)) console.log(" ", s.padEnd(10), "arrived:", r.arrived.join(" ") || "nothing", r.missing.length ? "· MISSING: " + r.missing.join(" ") : "", "· quoted in", r.listing_currency || "?", "· statements in", r.statement_currency || "?", "·", r.quarters, "quarters,", r.estimate_years, "estimate years", r.note ? "· " + r.note : "");
  for (const [c, x] of Object.entries(A.currencies)) console.log(" ", c + "USD", x.rate_days ? x.rate_days + " daily rates, newest " + x.newest[0] : "NO RATES: this currency's companies will be left out (ask FMP for historical-price-eod/light?symbol=" + c + "USD&from=2024-01-01)");
  console.log("facts →", out);
}
