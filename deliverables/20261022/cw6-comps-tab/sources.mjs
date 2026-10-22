/* Scintilla · CW6 (22 Oct) · where the COMPS tab's numbers come from. Every source hands the engine the same thing: FMP's
   answers in the shape CW3's fetcher kept ({path: {status, fetched_utc, data}}), so one engine prices every name.
     store   FMP's answers for the names CW3/CW4/CW5 carried and their peers, fetched server-side through fmp-proxy
             (tools/fill_store.py) and served as files beside this one, or from public.comps_fmp_answers when the
             coordinator has applied sql/20261022_comps_fmp_answers.sql. The browser cannot call fmp-proxy itself:
             measured 22 Oct, neither its GET nor its OPTIONS answer carries Access-Control-Allow-Origin.
     hub     the Hub's own tables for every other company (company_profile, filer_currency, fundamentals_history,
             balance_history, analyst_estimates, price_target_consensus, cashflow_history): the same FMP fields, kept
             by the Hub's jobs. Two differences, printed on the row: cash is cash and equivalents (the table carries
             no short-term investments) and the trailing year is the sum of the four newest quarters on file.
     live    today's price for every US listing from the chart API (/quotes, not FMP); the market value moves with it.
   Zero FMP calls from the browser in every case. */
const STORE = "/deliverables/20261022/cw6-comps-tab/store/";
const FOREIGN_SUFFIX = /\.(KS|KQ|T|TW|TWO|HK|SZ|SS|L|PA|DE|SW|AS|MI|MC|ST|CO|HE|OL|TO|V|AX|NS|BO)$/;
export const isUSListing = (t) => !FOREIGN_SUFFIX.test(t) && !/^\d/.test(t);
const daysBefore = (iso, n) => new Date(Date.parse(iso + "T00:00:00Z") - n * 86400e3).toISOString().slice(0, 10);
const chunk = (a, n) => { const out = []; for (let i = 0; i < a.length; i += n) out.push(a.slice(i, i + n)); return out; };

/** The store: one file per company; the table first when it exists. Returns {T: answers} and what was not found. */
export async function fromStore(tickers, { fetchJson, read }) {
  const out = {}, missing = [], from = {};
  if (read) {
    try {
      const rows = [];
      for (const c of chunk(tickers, 60)) rows.push(...(await read(`comps_fmp_answers?select=ticker,path,status,fetched_at,data&ticker=in.(${c.map(encodeURIComponent).join(",")})`) || []));
      for (const r of rows) { (out[r.ticker] ||= {})[r.path] = { status: r.status, fetched_utc: r.fetched_at, data: r.data }; from[r.ticker] = "public.comps_fmp_answers"; }
    } catch (_) { /* the table is not applied yet: the files answer */ }
  }
  await Promise.all(tickers.filter((t) => !out[t]).map(async (t) => {
    try { const r = await fetchJson(STORE + encodeURIComponent(t) + ".json"); out[t] = r.answers; from[t] = "store file " + (r.filled_utc || ""); }
    catch (_) { missing.push(t); }
  }));
  return { answers: out, missing, from };
}
let FX_STORE = null;
export async function storeFx(fetchJson) { if (FX_STORE) return FX_STORE; try { FX_STORE = await fetchJson(STORE + "_fx.json"); } catch (_) { FX_STORE = { rates: {} }; } return FX_STORE; }
let STORE_INDEX = null;
export async function storeIndex(fetchJson) { if (STORE_INDEX) return STORE_INDEX; try { const i = await fetchJson(STORE + "_index.json"); delete i.log; STORE_INDEX = i; } catch (_) { STORE_INDEX = {}; } return STORE_INDEX; }

/** The Hub's tables, put in FMP's shape. pg: PostgREST GET. One read per table for the whole list (60 names a read). */
export async function fromHub(tickers, { pg, today, subject = null }) {
  const opt = (p) => pg(p).catch(() => []);
  const T = [...new Set(tickers)], since = daysBefore(today, 560);
  const rows = { prof: [], filer: [], inc: [], bal: [], est: [] };
  for (const c of chunk(T, 60)) {
    const inq = "in.(" + c.map(encodeURIComponent).join(",") + ")";
    const [prof, filer, inc, bal, est] = await Promise.all([
      opt(`company_profile?select=ticker,name,industry,sector,country,ipo_date,is_adr,is_etf,price,market_cap,shares_outstanding,facts_as_of&ticker=${inq}`),
      opt(`filer_currency?select=ticker,reported_currency,listing_currency&ticker=${inq}`),
      opt(`fundamentals_history?select=ticker,period,fiscal_date,revenue,gross_profit,operating_income,ebitda,net_income,eps_diluted,shares_dil&ticker=${inq}&period=neq.FY&fiscal_date=gte.${since}&order=ticker.asc,fiscal_date.desc&limit=1000`),
      opt(`balance_history?select=ticker,period,fiscal_date,total_debt,cash_and_equiv,total_equity&ticker=${inq}&period=neq.FY&fiscal_date=gte.${daysBefore(today, 400)}&order=ticker.asc,fiscal_date.desc&limit=1000`),
      opt(`analyst_estimates?select=ticker,fiscal_date,est_revenue_avg,est_ebitda_avg,est_ebit_avg,est_net_income_avg,est_eps_avg,est_eps_high,est_eps_low,num_analysts_eps,num_analysts_rev,updated_ts&period=eq.annual&ticker=${inq}&fiscal_date=gte.${daysBefore(today, 1)}&order=ticker.asc,fiscal_date.asc&limit=1000`),
    ]);
    rows.prof.push(...prof); rows.filer.push(...filer); rows.inc.push(...inc); rows.bal.push(...bal); rows.est.push(...est);
  }
  let ptc = [], cf = [];
  if (subject) [ptc, cf] = await Promise.all([opt(`price_target_consensus?select=ticker,target_high,target_low,target_avg,target_median,num_analysts,updated_ts&ticker=eq.${encodeURIComponent(subject)}`),
    opt(`cashflow_history?select=ticker,period,fiscal_date,operating_cf,capex,free_cf&ticker=eq.${encodeURIComponent(subject)}&period=neq.FY&order=fiscal_date.desc&limit=4`)]);
  const out = {}, notes = {};
  const ok = (data, at) => ({ status: 200, fetched_utc: at || null, data });
  for (const t of T) {
    const p = rows.prof.find((r) => r.ticker === t), f = rows.filer.find((r) => r.ticker === t) || {};
    if (!p) continue;
    const a = {}, n = [];
    const listing = f.listing_currency || "USD", reported = f.reported_currency || "USD";
    a.profile = ok([{ symbol: t, companyName: p.name, industry: p.industry, sector: p.sector, country: p.country, ipoDate: p.ipo_date, isAdr: p.is_adr, currency: listing }], p.facts_as_of);
    const shares = Number(p.shares_outstanding) > 0 ? Number(p.shares_outstanding) : (Number(p.market_cap) > 0 && Number(p.price) > 0 ? p.market_cap / p.price : null);
    if (Number(p.price) > 0) a.quote = ok({ symbol: t, name: p.name, price: Number(p.price), marketCap: shares ? Number(p.price) * shares : Number(p.market_cap) || null, timestamp: p.facts_as_of ? Math.floor(Date.parse(p.facts_as_of) / 1000) : null, shares }, p.facts_as_of);
    const q = rows.inc.filter((r) => r.ticker === t).sort((x, y) => String(y.fiscal_date).localeCompare(String(x.fiscal_date)));
    const seen = new Set(), last4 = []; for (const r of q) { if (seen.has(r.fiscal_date)) continue; seen.add(r.fiscal_date); last4.push(r); if (last4.length === 4) break; }
    if (last4.length === 4 && (Date.parse(last4[0].fiscal_date) - Date.parse(last4[3].fiscal_date)) / 86400e3 < 330) {
      const s = (k) => last4.reduce((acc, r) => acc + (r[k] == null ? NaN : Number(r[k])), 0);
      const v = (x) => Number.isFinite(x) ? x : null;
      a["income-statement-ttm"] = ok([{ symbol: t, date: last4[0].fiscal_date, reportedCurrency: reported, revenue: v(s("revenue")), grossProfit: v(s("gross_profit")), operatingIncome: v(s("operating_income")), ebitda: v(s("ebitda")), netIncome: v(s("net_income")), epsDiluted: v(s("eps_diluted")), weightedAverageShsOutDil: last4[0].shares_dil }]);
      n.push("trailing year: the four newest quarters on the Hub, through " + last4[0].fiscal_date);
    } else n.push("fewer than four recent quarters on the Hub: no trailing year");
    const b = rows.bal.filter((r) => r.ticker === t)[0];
    if (b) { a["balance-sheet-statement"] = ok([{ symbol: t, date: b.fiscal_date, reportedCurrency: reported, cashAndCashEquivalents: b.cash_and_equiv, totalDebt: b.total_debt, totalStockholdersEquity: b.total_equity }]); n.push("cash without short-term investments (the Hub's balance table carries none)"); }
    const e = rows.est.filter((r) => r.ticker === t);
    if (e.length) a["analyst-estimates"] = ok(e.map((r) => ({ symbol: t, date: r.fiscal_date, revenueAvg: r.est_revenue_avg, ebitdaAvg: r.est_ebitda_avg, ebitAvg: r.est_ebit_avg, netIncomeAvg: r.est_net_income_avg, epsAvg: r.est_eps_avg, epsHigh: r.est_eps_high, epsLow: r.est_eps_low, numAnalystsRevenue: r.num_analysts_rev, numAnalystsEps: r.num_analysts_eps })), e[0].updated_ts ? new Date(e[0].updated_ts * 1000).toISOString() : null);
    if (t === subject) {
      const c = ptc[0]; if (c) a["price-target-consensus"] = ok([{ symbol: t, targetHigh: c.target_high, targetLow: c.target_low, targetConsensus: c.target_avg, targetMedian: c.target_median }], c.updated_ts ? new Date(c.updated_ts * 1000).toISOString() : null);
      if (cf.length) a["cash-flow-statement"] = ok(cf.map((r) => ({ symbol: t, date: r.fiscal_date, operatingCashFlow: r.operating_cf, capitalExpenditure: r.capex, freeCashFlow: r.free_cf })));
    }
    out[t] = a; notes[t] = n;
  }
  return { answers: out, notes, missing: T.filter((t) => !out[t]) };
}

/** Today's prices for US listings (the chart API), put into each company's quote: the market value moves with the price. */
export async function withLivePrices(answersBy, { quotes, livePrices = {} }) {
  const us = Object.keys(answersBy).filter(isUSListing);
  let q = {};
  try { const r = us.length ? await quotes(us) : null; q = (r && r.quotes) || {}; } catch (_) { q = {}; }
  const at = new Date().toISOString().slice(0, 16) + "Z", moved = [];
  for (const t of us) {
    const a = answersBy[t]; if (!a || !a.quote || a.quote.status !== 200) continue;
    const live = Number(livePrices[t]) > 0 ? Number(livePrices[t]) : (q[t] && Number(q[t].price) > 0 ? Number(q[t].price) : null);
    const old = a.quote.data || {}; if (!live || !(Number(old.price) > 0)) continue;
    a.quote = { ...a.quote, data: { ...old, price: live, marketCap: old.marketCap != null ? old.marketCap * live / old.price : null, timestamp: Math.floor(Date.now() / 1000), price_from: "chart API " + at, price_at_fetch: old.price } };
    moved.push(t);
  }
  return { moved, at };
}
