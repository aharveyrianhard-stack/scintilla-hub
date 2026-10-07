/* CP3 · THE DASHBOARD'S OWN FORWARD P/E CODE, lifted out of index.html as it stands and run as it stands.
   The Hub page is one HTML file with its script inline; nothing here re-implements it. dashboardApi(page) cuts the page's
   own functions out by name (the way tests/board-fpe.test.mjs does) and returns them, so the one-basis table and its test
   can ask the dashboard what it would print for a set of estimate rows and a price, and hold lib/forward-basis.mjs to it. */
export function dashboardApi(page) {
  const fn = (name) => { const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m")); if (s < 0) throw new Error("index.html no longer has function " + name); const e = page.indexOf("\n}\n", s); return page.slice(s, e + 3); };
  const line = (re) => { const m = page.match(re); if (!m) throw new Error("index.html no longer has " + re); return m[0]; };
  const src = [
    "const num = (x) => (x == null ? null : Number(x));",
    line(/^const EST_CCY_MEASURED = [^\n]*\n/m), line(/^const EST_CCY = [^\n]*\n/m), fn("ccyCode"), fn("estCcy"), fn("estNonUsd"), fn("notComparable"),
    line(/^const NTM_STORED_MAX_AGE_MS = [^\n]*\n/m), line(/^const estDate = [^\n]*\n/m),
    "const FEPS = {}, FEPS_META = {}, NTMLIVE = {}, NTMLIVE_META = {}, NTMEPS = {}, NTMEPS_AT = {}, PRICES = {}, EST_FX = {};",
    line(/^const EST_FX_TOL = [^\n]*\n/m), fn("estFxPair"), line(/^const estFx = [^\n]*\n/m), fn("plusMonthsISO"),
    fn("applyEstimates"), fn("fpeBasis"), fn("fpeVal"), fn("fpeCellText"), fn("fpeWithheldText"),
    "return { applyEstimates, fpeBasis, fpeVal, fpeCellText, fpeWithheldText, estFxPair, estCcy, estNonUsd, plusMonthsISO, EST_FX, FEPS, NTMLIVE };",
  ].join("\n");
  return new Function("cryptoSet", src)(new Set());
}
/** What the dashboard prints for each ticker. rows: analyst_estimates rows (both periods, any tickers); prices: { T: price };
    events / pairQuarters: the two reads loadEstFx() makes for the foreign reporters. The page's own queries are the filter:
    annual rows from today on; quarter rows from today to fifteen months out; each ordered by ticker, then date. */
export function dashboardPrints(page, { rows, prices, today, events = [], pairQuarters = [] }) {
  const api = dashboardApi(page), until = api.plusMonthsISO(today, 15);
  const ord = (a, b) => String(a.ticker).localeCompare(String(b.ticker)) || String(a.fiscal_date).localeCompare(String(b.fiscal_date));
  const annual = rows.filter((r) => r.period === "annual" && String(r.fiscal_date) >= today).sort(ord);
  const quarter = rows.filter((r) => r.period === "quarter" && String(r.fiscal_date) >= today && String(r.fiscal_date) <= until).sort(ord);
  api.applyEstimates({ annual, quarter });
  const out = {};
  for (const t of Object.keys(prices)) {
    if (api.estNonUsd(t)) { const pr = api.estFxPair(events.filter((r) => r.ticker === t), pairQuarters.filter((r) => r.ticker === t)); if (pr) api.EST_FX[t] = Object.assign({ ccy: api.estCcy(t) }, pr); }
    const v = api.fpeVal(t, prices[t]), b = api.fpeBasis(t);
    out[t] = { pe: v, text: v != null ? api.fpeCellText(t, v) : api.fpeWithheldText(t), eps: b ? b.eps : null, label: b ? b.label : null };
  }
  return out;
}
