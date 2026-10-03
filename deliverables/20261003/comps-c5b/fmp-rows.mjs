/* C5b (3 Oct) · the Hub's tables rebuilt from FMP's own facts (fmp-facts-<date>.json, printed on Fly by
   scripts/fx-multiples-check.mjs), row for row the way supabase/functions/fmp-fundamentals/index.ts writes them:
   fundamentals.price = the quote, fundamentals.market_cap = key-metrics marketCap at the last fiscal period end (in the
   REPORTING currency, as FMP serves it), eps_ttm / revenue_ttm = the four newest quarters summed; fundamentals_history,
   balance_history, analyst_estimates (annual), company_profile (USD), filer_currency, fx_rates. pgFrom() answers the
   PostgREST paths readCohort asks for, so the comps reader runs unchanged on them. Pure: no fetch, no key. */
const sum4 = (rows, k) => (rows.length >= 4 ? rows.slice(0, 4).reduce((s, r) => s + (Number(r[k]) || 0), 0) : null);

/** facts: { companies: {T: …}, fx: {CCY: [[date, rate]…]} }. opts.noFilerRow: tickers that get no filer_currency row and a
    profile that does not read as foreign (PDD as C5's run recorded it: "US filer (default)"). */
export function tablesFrom(facts, { noFilerRow = [], noFundPrice = [], nowSec = Math.floor(Date.parse("2026-10-03T15:00:00Z") / 1000) } = {}) {
  const T = { fundamentals: [], fundamentals_history: [], balance_history: [], cashflow_history: [], analyst_estimates: [], company_profile: [], filer_currency: [], fx_rates: [], ticker_cohorts: [], tickers: [], composite_staged: [] };
  for (const [t, c] of Object.entries(facts.companies)) {
    const iq = c.income_q || [], ccy = (iq[0] && iq[0].reportedCurrency) || "USD", bare = noFilerRow.includes(t);
    const eps = sum4(iq.map((r) => ({ e: r.epsDiluted ?? r.eps })), "e"), rev = sum4(iq, "revenue"), px = c.quote.price ?? c.profile.price;
    T.fundamentals.push({ ticker: t, price: noFundPrice.includes(t) ? null : px, market_cap: c.key_metrics_q.marketCap ?? null, eps_ttm: eps, adjusted_eps_ttm: null, revenue_ttm: rev, trailing_pe: px && eps ? px / eps : null, adjusted_pe: null, updated_ts: nowSec });
    for (const r of iq) T.fundamentals_history.push({ ticker: t, period: r.period, fiscal_year: r.fiscalYear, fiscal_date: r.date, revenue: r.revenue, gross_profit: r.grossProfit, operating_income: r.operatingIncome, ebitda: r.ebitda, net_income: r.netIncome, eps_diluted: r.epsDiluted ?? r.eps, shares_dil: r.weightedAverageShsOutDil });
    for (const b of c.balance_q || []) T.balance_history.push({ ticker: t, period: b.period, fiscal_date: b.date, net_debt: b.netDebt, total_debt: b.totalDebt, cash_and_equiv: b.cashAndCashEquivalents });
    for (const e of c.estimates || []) T.analyst_estimates.push({ ticker: t, period: "annual", fiscal_date: e.date, est_eps_avg: e.epsAvg, est_revenue_avg: e.revenueAvg, price_target_avg: null, updated_ts: nowSec });
    T.company_profile.push({ ticker: t, name: t, industry: null, sector: null, is_etf: false, is_adr: bare ? false : !!c.profile.isAdr, country: bare ? null : c.profile.country || null, price: c.profile.price, market_cap: c.profile.marketCap });
    if (!bare) T.filer_currency.push({ ticker: t, reported_currency: ccy, listing_currency: c.profile.currency || "USD", is_adr: !!c.profile.isAdr, shares_dil: iq[0] ? iq[0].weightedAverageShsOutDil : null, statement_date: iq[0] ? iq[0].date : null, source: "fmp:income-statement" });
    T.ticker_cohorts.push({ ticker: t, cohort: "C5B" });
  }
  for (const [ccy, series] of Object.entries(facts.fx || {})) for (const [date, rate] of series) T.fx_rates.push({ pair: ccy + "USD", date, rate });
  return T;
}

/** A PostgREST GET over the tables: `table?select=…&ticker=in.(A,B)` / `ticker=eq.A`, `fiscal_date=gte.D`, `date=gte.D`,
    `period=eq.annual`, limit/offset paging. Enough for readCohort; anything else returns every row. */
export function pgFrom(tables) {
  return async (path) => {
    const [name, qs = ""] = path.split("?"), rows = tables[name];
    if (!rows) throw new Error(name + " → 404");
    let out = rows.slice(), limit = Infinity, offset = 0;
    for (const part of qs.split("&")) {
      const [k, v = ""] = part.split("="), val = decodeURIComponent(v);
      if (k === "limit") limit = +val; else if (k === "offset") offset = +val;
      else if (k === "select" || k === "order") continue;
      else if (val.startsWith("in.(")) { const set = new Set(val.slice(4, -1).split(",")); out = out.filter((r) => set.has(String(r[k]))); }
      else if (val.startsWith("eq.")) out = out.filter((r) => String(r[k]) === val.slice(3));
      else if (val.startsWith("gte.")) out = out.filter((r) => String(r[k]) >= val.slice(4));
    }
    return out.slice(offset, offset + limit);
  };
}

/** The chart API's /quotes answer from the same facts. */
export const quotesFrom = (facts, observed = "2026-10-03T15:00:00Z") => async (tickers) => ({ quotes: Object.fromEntries(tickers.filter((t) => facts.companies[t]).map((t) => [t, { price: facts.companies[t].quote.price ?? facts.companies[t].profile.price, price_observation_utc: observed }])) });

/** FMP's own one-currency multiples for one company (ratios-ttm, key-metrics-ttm): the outside value. */
export function fmpOutside(c) {
  const f = c.fmp_ttm || {}, pos = (v) => (Number(v) > 0 ? Number(v) : null);
  return { pe_ttm: pos(f.pe), ev_ebitda: pos(f.ev_ebitda_km), ev_sales: pos(f.ev_sales_km), ps: pos(f.ps) };
}
/** FMP's multiples restated at the US listing's market value. FMP computes a foreign reporter's TTM ratios on its HOME
    listing's market value in the reporting currency (TSM: 64.8 T TWD on the Taipei shares, about 20% under the ADRs'
    $2.45 T). k = the profile's USD market value ÷ (FMP's TTM market value × today's rate); P/E and P/S scale by k, the EV
    rows by the change in EV. k ≈ 1 for every reporter whose ADRs trade at par with home shares. */
export function fmpAtUsListing(c, rateToday) {
  const o = fmpOutside(c), f = c.fmp_ttm || {}, mcF = Number(f.marketCap_km) * rateToday, evF = Number(f.enterpriseValue_km) * rateToday, mcU = Number(c.profile.marketCap);
  if (!(mcF > 0 && mcU > 0 && rateToday > 0)) return { ...o, k: null };
  const k = mcU / mcF, kev = evF > 0 ? (evF + mcU - mcF) / evF : null;
  const s = (v, m) => (v == null || m == null ? null : v * m);
  return { pe_ttm: s(o.pe_ttm, k), ev_ebitda: s(o.ev_ebitda, kev), ev_sales: s(o.ev_sales, kev), ps: s(o.ps, k), k };
}
