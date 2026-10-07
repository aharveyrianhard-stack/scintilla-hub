/* Scintilla · comps CP1 (6 Oct) · COMPS-ONLY REFERENCE PEERS. Pure: no fetch, no key, no DOM.

   Alan, 6 Oct: "the comps for Micron should be memory companies. SanDisk has to be in there. SK Hynix should be in there."
   SK hynix, Samsung Electronics and Kioxia are not served on the Hub, so they have no rows in our tables. They are not
   admitted to the board for this: they are priced beside a set from a dated FACTS file and nowhere else.

   THE FACTS FILE is what the C5b job already prints on Fly — scripts/fx-multiples-check.mjs <symbols> (profile, quote, eight
   quarterly income statements, two balance sheets, the newest key-metrics row, annual estimates, FMP's own one-currency
   multiples, and the daily <CCY>USD closes). C5b's tablesFrom() turns those facts into the Hub's own table rows, so the
   comps reader (cohort.mjs: readCohort → snapshotFromCohort) prices a reference peer exactly as it prices a served
   company, C5b's one-currency rule included. Nothing here invents a figure: a reference peer with no facts carries no
   multiple and enters no median.

   FD1 (7 Oct) · A HOME LISTING IS PUT IN DOLLARS FIRST. C5b's one-currency rule was built for a foreign company with a US
   line (TSMC's ADR: statements in Taiwan dollars, the price in dollars) and CP1 tested the reference path with TSMC's
   facts standing in. SK hynix, Samsung and Kioxia are asked for on their HOME exchanges (000660.KS, 005930.KS, 285A.T):
   FMP quotes the price and the market value in won and yen too. Read as they come, a won price would be divided by
   dollar earnings — a P/E some 1,400 times too high. inDollars() restates the listing's price and market value in
   dollars at the FMP <CCY>USD close on or before the quote's day (facts.fx, the series the job already prints), so
   from there on the company is exactly the case C5b handles: statements at each period-end rate, estimates at today's,
   the market value and price in dollars together. A home listing with no rate in the facts is LEFT OUT and named —
   never mixed. When a home listing brought no figures, the US line named in REFERENCE_PEERS.also (SKHY for SK hynix)
   stands in only if its own share count checks against its market value (an ADS that is a fraction of a share would
   put a per-share figure on the wrong count); otherwise the peer is left out and the reason is given.

   referenceOf(facts)            → { T: { market_cap_usd, industry, name, currency } } for buildSet (inp.reference)
   withReference(pg, facts)      → a PostgREST GET that answers as `pg` does, plus the reference peers' rows
   withReferenceQuotes(q, facts) → the same for the chart API's /quotes
   inDollars(facts)              → the facts with every home listing restated in dollars, and what was done to each */
import { tablesFrom, pgFrom, quotesFrom } from "../comps-c5b/fmp-rows.mjs";
import { REFERENCE_PEERS } from "./lines.mjs";

/** The tables the comps reader asks for by ticker; a reference peer's rows are appended to these and to no other. */
export const REFERENCE_TABLES = ["fundamentals", "fundamentals_history", "balance_history", "cashflow_history", "analyst_estimates", "company_profile", "filer_currency", "fx_rates"];

const n = (v) => { const x = Number(v); return Number.isFinite(x) ? x : null; };
/** The newest [date, rate] of a series on or before a day (an exchange is closed on a Sunday): { date, rate } or null. */
export function rateOnOrBefore(series, dayISO) {
  let best = null;
  for (const [d, r] of series || []) if (d <= dayISO && Number(r) > 0 && (!best || d > best.date)) best = { date: d, rate: Number(r) };
  return best;
}
const hasFigures = (c) => !!(c && c.profile && n(c.profile.marketCap) > 0 && (c.income_q || []).length);
/** How far a company's own statement share count is from market value ÷ price (1 = the same count). null when it cannot be checked. */
export function shareBasis(c) {
  const sh = n(((c && c.income_q) || [])[0] && c.income_q[0].weightedAverageShsOutDil), mc = n(c && c.profile && c.profile.marketCap), px = n(c && ((c.quote && c.quote.price) ?? (c.profile && c.profile.price)));
  return sh > 0 && mc > 0 && px > 0 ? sh / (mc / px) : null;
}
export const SHARE_BASIS_TOL = 0.15;   // convertSrc's own tolerance for "per US-listed share already"
/** The facts with every HOME LISTING restated in dollars (see the header). Pure: the input is not changed.
    Returns { facts, listing: { T: { currency, rate, rate_date, price_local, market_cap_local, price_usd, market_cap_usd } }, left_out: { T: why }, stand_in: { T: symbol } }. */
export function inDollars(facts) {
  const out = { ...(facts || {}), companies: {} }, listing = {}, leftOut = {}, standIn = {};
  const day = String((facts && facts.taken) || "").slice(0, 10) || "9999-12-31";
  const src = { ...((facts && facts.companies) || {}) };
  /* a reference peer whose home listing brought no figures: its US line, when one is in the facts and its share count holds */
  for (const [T, ref] of Object.entries(REFERENCE_PEERS)) {
    if (hasFigures(src[T])) continue;
    const alt = (ref.also || []).find((s) => hasFigures(src[s]));
    if (!alt) continue;
    const basis = shareBasis(src[alt]);
    if (basis != null && Math.abs(basis - 1) <= SHARE_BASIS_TOL) { src[T] = src[alt]; standIn[T] = alt; }
    else leftOut[T] = `${T} brought no figures and its US line ${alt} cannot stand in: its statements are on ${basis == null ? "a share count that cannot be checked" : basis.toFixed(2) + "× the listed share count"}, so a per-share figure would sit on the wrong count`;
  }
  for (const [T, c] of Object.entries(src)) {
    const ccy = String((c && c.profile && c.profile.currency) || "USD").toUpperCase();
    if (!c || !c.profile || ccy === "USD") { out.companies[T] = c; continue; }
    const r = rateOnOrBefore(facts.fx && facts.fx[ccy], day);
    if (!r) { leftOut[T] = `${T} is quoted in ${ccy} and the facts carry no ${ccy}USD rate on or before ${day}: left out, never divided by a dollar figure`; continue; }
    const k = (v) => (n(v) == null ? v : n(v) * r.rate), pxLocal = n((c.quote && c.quote.price) ?? c.profile.price), mcLocal = n(c.profile.marketCap);
    out.companies[T] = { ...c, profile: { ...c.profile, price: k(c.profile.price), marketCap: k(c.profile.marketCap), currency: "USD", listing_currency: ccy }, quote: { ...(c.quote || {}), price: k(c.quote && c.quote.price), marketCap: k(c.quote && c.quote.marketCap) } };
    listing[T] = { currency: ccy, rate: r.rate, rate_date: r.date, price_local: pxLocal, market_cap_local: mcLocal, price_usd: pxLocal == null ? null : pxLocal * r.rate, market_cap_usd: mcLocal == null ? null : mcLocal * r.rate };
  }
  return { facts: out, listing, left_out: leftOut, stand_in: standIn };
}

/** The reference peers a facts file actually carries (a symbol FMP did not answer for is left out, and said). */
export function referenceOf(facts) {
  const out = {}, missing = [], D = inDollars(facts), F = D.facts;
  for (const [T, ref] of Object.entries(REFERENCE_PEERS)) {
    const c = F && F.companies && F.companies[T];
    if (!hasFigures(c)) { missing.push(T); continue; }
    out[T] = { ticker: T, name: ref.name, market_cap_usd: Number(c.profile.marketCap), currency: (c.income_q[0] && c.income_q[0].reportedCurrency) || ref.currency, industry: c.profile.industry || null, sic: null, taken: facts.taken || null,
      ...(D.listing[T] ? { listing: D.listing[T] } : {}), ...(D.stand_in[T] ? { stand_in: D.stand_in[T] } : {}) };
  }
  return { peers: out, missing, why_missing: Object.fromEntries(missing.map((T) => [T, D.left_out[T] || `${T}: no profile, market value or quarterly statements in the facts`])), taken: (facts && facts.taken) || null, source: (facts && facts.source) || null };
}

/** `pg` with the reference peers' rows appended (first page only, so a paged read never repeats them). */
export function withReference(pg, facts, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const ref = referenceOf(facts), keep = Object.keys(ref.peers), usd = inDollars(facts).facts;
  if (!keep.length) return pg;
  const tables = tablesFrom({ companies: Object.fromEntries(keep.map((t) => [t, usd.companies[t]])), fx: facts.fx || {} }, { nowSec });
  for (const row of tables.company_profile) { row.name = ref.peers[row.ticker].name; row.industry = ref.peers[row.ticker].industry; }
  const refPg = pgFrom(tables);
  return async (path) => {
    const rows = await pg(path), name = path.split("?")[0], offset = Number((/[?&]offset=(\d+)/.exec(path) || [])[1] || 0);
    if (!REFERENCE_TABLES.includes(name) || offset > 0) return rows;
    /* fx_rates is asked without a ticker: add only the pairs the Hub's table does not already carry */
    if (name === "fx_rates") { const have = new Set(rows.map((r) => r.pair)); return [...rows, ...(await refPg(path.replace(/&limit=\d+/, "").replace(/&offset=\d+/, ""))).filter((r) => !have.has(r.pair))]; }
    return [...rows, ...(await refPg(path.replace(/&limit=\d+/, "").replace(/&offset=\d+/, "")))];
  };
}

/** The chart API's /quotes answer with the reference peers' prices (their own listing's, as FMP quoted them). */
export function withReferenceQuotes(quotes, facts) {
  const ref = referenceOf(facts), keep = Object.keys(ref.peers), usd = inDollars(facts).facts;
  if (!keep.length) return quotes;
  const refQ = quotesFrom({ companies: Object.fromEntries(keep.map((t) => [t, usd.companies[t]])) }, facts.taken || new Date().toISOString());
  return async (tickers) => { const a = await quotes(tickers.filter((t) => !keep.includes(t))), b = await refQ(tickers.filter((t) => keep.includes(t))); return { ...a, quotes: { ...(a.quotes || {}), ...(b.quotes || {}) } }; };
}

/** The exact job, for the coordinator (keys live on Fly; this file never runs there). */
export const REFERENCE_JOB = {
  script: "scripts/fx-multiples-check.mjs",
  symbols: Object.keys(REFERENCE_PEERS),
  save_as: "deliverables/20261003/comps-c5/reference-peers-facts-<date>.json",
  note: "the C5b job as it stands: /stable/ routes, prints one JSON document, writes nothing; whether FMP's plan answers for the Seoul and Tokyo listings is not yet known — SKHY (the Nasdaq ADS) is the fallback for SK hynix",
};
