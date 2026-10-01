/* Scintilla · comps template (C3, 1 Oct) · FOREIGN FILERS: statements in their own currency against a USD price.
   Pure functions, no fetch. TSM's statements are in TWD (EPS 434.95, revenue 4.45 T), ASML's in EUR, BABA's in CNY,
   while every price the Hub shows is the US listing's USD price: P/E came out at 1.1x for TSM and the EV rows went blank
   (EV = USD market value + TWD net debt is not a number anyone wants). The fix: convert every statement figure to USD
   at the rate for its own statement date, convert the estimates at today's rate, check the per-share basis against the
   ADR share count, and say so on the row. The rates come from public.fx_rates and the reporting currency from
   public.filer_currency (both written by scripts/fx-filer-sync.mjs on Fly, from FMP). With no rate on file nothing is
   converted and nothing is invented: the row carries the currency and the words "no USD rate on file". */

export const CCY_FIELDS = {
  fundamentals: ["eps_ttm", "adjusted_eps_ttm", "revenue_ttm"],       // per share or money, in the reporting currency
  history: ["revenue", "gross_profit", "operating_income", "ebitda", "net_income", "eps", "eps_diluted"],
  balance: ["net_debt", "total_debt", "cash_and_equiv", "total_assets", "total_liabilities", "total_equity"],
  cashflow: ["operating_cf", "capex", "free_cf", "dividends_paid", "buybacks", "stock_comp", "debt_repayment"],
  estimates: ["est_eps_avg", "est_eps_high", "est_eps_low", "est_revenue_avg", "est_ebitda_avg", "est_net_income_avg", "price_target_avg"],
};

/** rates: [[date, usdPerUnit], ...] any order. The rate for a date = the newest rate on or before it (an exchange is
    closed on a statement's Sunday). null when the series starts after the date or is empty. */
export function rateOn(rates, dateISO) {
  if (!rates || !rates.length || !dateISO) return null;
  const d = String(dateISO).slice(0, 10);
  let best = null;
  for (const [day, r] of rates) if (day <= d && (best == null || day > best[0]) && r > 0) best = [day, r];
  return best ? { date: best[0], rate: best[1] } : null;
}

/** Which currency a company reports in. stored: the filer_currency row (authoritative, from FMP). Without a stored row
    nothing is assumed: USD filers are the default of the whole Hub, and a foreign filer without a row stays as it is and
    is named "currency unknown" when the profile says it is an ADR or foreign-domiciled. */
export function filerCurrency(ticker, profile, stored) {
  if (stored && stored.reported_currency) return { currency: String(stored.reported_currency).toUpperCase(), source: stored.source || "filer_currency", known: true };
  const p = profile || {};
  const foreign = p.is_adr === true || p.is_adr === "true" || (p.country && String(p.country).toUpperCase() !== "US");
  return { currency: foreign ? null : "USD", source: foreign ? "no filer_currency row" : "US filer (default)", known: !foreign };
}

const mul = (row, fields, k) => { const o = { ...row }; for (const f of fields) if (o[f] != null && Number.isFinite(Number(o[f]))) o[f] = Number(o[f]) * k; return o; };

/** Convert one company's raw reads (the src object buildInputs takes) to USD. ratesByCcy: { TWD: [[date, usdPerTwd]…] }.
    Returns { src, note } where note says what was done, row by row, or why nothing was. A per-share figure is per the
    US-listed share already when the diluted share count on the newest statement equals the USD market value ÷ the USD
    price (FMP serves ADR filers on the ADR's share count); the note states that check and its ratio. */
export function convertSrc(src, ccyInfo, ratesByCcy, todayISO) {
  const ccy = ccyInfo && ccyInfo.currency;
  const note = { ticker: src.ticker, currency: ccy, source: ccyInfo && ccyInfo.source, converted: false, rates: [], why: null, adr: null };
  if (!ccy) { note.why = "reporting currency unknown: no filer_currency row for this foreign filer"; return { src, note }; }
  if (ccy === "USD") { note.why = "reports in USD: nothing to convert"; return { src, note }; }
  const series = ratesByCcy && ratesByCcy[ccy];
  if (!series || !series.length) { note.why = `statements in ${ccy}: no USD rate on file (fx_rates has no ${ccy}USD)`; return { src, note }; }
  const used = new Map();
  const at = (date) => { const r = rateOn(series, date); if (r) used.set(r.date, r.rate); return r; };
  const conv = (rows, fields, dateKey) => (rows || []).map((row) => { const r = at(row[dateKey]); return r ? mul(row, fields, r.rate) : { ...row, _unconverted: true }; });
  const out = { ...src };
  const f = src.fundamentals || {};
  const fDate = f.date || (src.incQ && src.incQ[0] && src.incQ[0].fiscal_date) || todayISO;
  const fr = at(fDate);
  out.fundamentals = fr ? mul(f, CCY_FIELDS.fundamentals, fr.rate) : f;
  if (!fr) note.rates.push({ what: "fundamentals", date: fDate, rate: null });
  out.incQ = conv(src.incQ, CCY_FIELDS.history, "fiscal_date"); out.incFY = conv(src.incFY, CCY_FIELDS.history, "fiscal_date");
  out.balance = conv(src.balance, CCY_FIELDS.balance, "fiscal_date");
  out.cfQ = conv(src.cfQ, CCY_FIELDS.cashflow, "fiscal_date"); out.cfFY = conv(src.cfFY, CCY_FIELDS.cashflow, "fiscal_date");
  const tr = at(todayISO);
  out.estimates = (src.estimates || []).map((e) => tr ? mul(e, CCY_FIELDS.estimates, tr.rate) : { ...e, _unconverted: true });
  note.converted = !!fr;
  note.rates = [...note.rates, ...[...used.entries()].sort().map(([date, rate]) => ({ date, rate }))];
  note.today_rate = tr ? tr.rate : null; note.today_rate_date = tr ? tr.date : null;
  note.why = fr ? `statements in ${ccy}, converted to USD at FMP's ${ccy}USD close for each statement date (newest ${fr.date}: ${fr.rate}); estimates at ${tr ? tr.date : "—"}` : `statements in ${ccy}: the rate series starts after the newest statement (${fDate})`;
  /* the per-share basis: FMP serves an ADR on the ADR's own share count; the check is diluted shares × USD price ≈ USD market value */
  const p = src.profile || {}, newest = (src.incQ || [])[0];
  if (newest && newest.shares_dil > 0 && p.market_cap > 0 && p.price > 0) {
    const implied = p.market_cap / p.price, ratio = newest.shares_dil / implied;
    note.adr = { shares_on_statement: newest.shares_dil, shares_from_market_value: implied, ratio, basis: Math.abs(ratio - 1) < 0.15 ? "per US-listed share already (FMP serves the ADR share count)" : `per-share figures are on a different share count (ratio ${ratio.toFixed(2)}): an ADR ratio would apply` };
  } else note.adr = { basis: "share count check not possible (no diluted shares or no profile market value)" };
  return { src: out, note };
}

/** fx_rates rows → { CCY: [[date, rate]…] }. rows: { pair: 'TWDUSD', date, rate }. */
export function ratesByCurrency(rows) {
  const out = {};
  for (const r of rows || []) { const m = /^([A-Z]{3})USD$/.exec(String(r.pair || "")); if (!m) continue; (out[m[1]] = out[m[1]] || []).push([String(r.date).slice(0, 10), Number(r.rate)]); }
  for (const k of Object.keys(out)) out[k].sort((a, b) => a[0].localeCompare(b[0]));
  return out;
}
