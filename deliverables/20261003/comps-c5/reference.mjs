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

   referenceOf(facts)            → { T: { market_cap_usd, industry, name, currency } } for buildSet (inp.reference)
   withReference(pg, facts)      → a PostgREST GET that answers as `pg` does, plus the reference peers' rows
   withReferenceQuotes(q, facts) → the same for the chart API's /quotes */
import { tablesFrom, pgFrom, quotesFrom } from "../comps-c5b/fmp-rows.mjs";
import { REFERENCE_PEERS } from "./lines.mjs";

/** The tables the comps reader asks for by ticker; a reference peer's rows are appended to these and to no other. */
export const REFERENCE_TABLES = ["fundamentals", "fundamentals_history", "balance_history", "cashflow_history", "analyst_estimates", "company_profile", "filer_currency", "fx_rates"];

/** The reference peers a facts file actually carries (a symbol FMP did not answer for is left out, and said). */
export function referenceOf(facts) {
  const out = {}, missing = [];
  for (const [T, ref] of Object.entries(REFERENCE_PEERS)) {
    const c = facts && facts.companies && facts.companies[T];
    if (!c || !c.profile || !(Number(c.profile.marketCap) > 0) || !(c.income_q || []).length) { missing.push(T); continue; }
    out[T] = { ticker: T, name: ref.name, market_cap_usd: Number(c.profile.marketCap), currency: (c.income_q[0] && c.income_q[0].reportedCurrency) || ref.currency, industry: c.profile.industry || null, sic: null, taken: facts.taken || null };
  }
  return { peers: out, missing, taken: (facts && facts.taken) || null, source: (facts && facts.source) || null };
}

/** `pg` with the reference peers' rows appended (first page only, so a paged read never repeats them). */
export function withReference(pg, facts, { nowSec = Math.floor(Date.now() / 1000) } = {}) {
  const ref = referenceOf(facts), keep = Object.keys(ref.peers);
  if (!keep.length) return pg;
  const tables = tablesFrom({ companies: Object.fromEntries(keep.map((t) => [t, facts.companies[t]])), fx: facts.fx || {} }, { nowSec });
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
  const ref = referenceOf(facts), keep = Object.keys(ref.peers);
  if (!keep.length) return quotes;
  const refQ = quotesFrom({ companies: Object.fromEntries(keep.map((t) => [t, facts.companies[t]])) }, facts.taken || new Date().toISOString());
  return async (tickers) => { const a = await quotes(tickers.filter((t) => !keep.includes(t))), b = await refQ(tickers.filter((t) => keep.includes(t))); return { ...a, quotes: { ...(a.quotes || {}), ...(b.quotes || {}) } }; };
}

/** The exact job, for the coordinator (keys live on Fly; this file never runs there). */
export const REFERENCE_JOB = {
  script: "scripts/fx-multiples-check.mjs",
  symbols: Object.keys(REFERENCE_PEERS),
  save_as: "deliverables/20261003/comps-c5/reference-peers-facts-<date>.json",
  note: "the C5b job as it stands: /stable/ routes, prints one JSON document, writes nothing; whether FMP's plan answers for the Seoul and Tokyo listings is not yet known — SKHY (the Nasdaq ADS) is the fallback for SK hynix",
};
