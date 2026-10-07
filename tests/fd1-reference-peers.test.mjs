/* FD1 (7 Oct 2026) — the foreign memory peers' figures, converted to dollars (C5b's one-currency rule), tested with the
   rules they touch: C5b's foreign-filer conversion (fx.mjs), CP1's reference path (reference.mjs), the comps reader.
   No figure of SK hynix, Samsung or Kioxia is in this file or in the repo: FMP could not be reached from this lane.
   Every number below is FMP's own, from the committed C5b facts (deliverables/20261003/comps-c5b/fmp-facts-2026-10-03.json):
   TSMC stands in for a home listing by being restated the way FMP quotes one — its price and market value in Taiwan
   dollars — so the test can hold the answer against the same company's dollar line, which the reader already prices. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCohort, snapshotFromCohort } from "../deliverables/20261001/comps-template/cohort.mjs";
import { tablesFrom, pgFrom, quotesFrom } from "../deliverables/20261003/comps-c5b/fmp-rows.mjs";
import { inDollars, referenceOf, withReference, withReferenceQuotes, rateOnOrBefore, shareBasis, SHARE_BASIS_TOL, REFERENCE_JOB } from "../deliverables/20261003/comps-c5/reference.mjs";
import { REFERENCE_PEERS } from "../deliverables/20261003/comps-c5/lines.mjs";
import { assemble, kindOf } from "../deliverables/20261007/feed-fix/tools/reference-facts-from-raw.mjs";

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const FACTS = J("../deliverables/20261003/comps-c5b/fmp-facts-2026-10-03.json"), standin = J("../deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json"), reported = J("../deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json");
const near = (a, b, rel, msg) => assert.ok(a != null && b != null && Math.abs(a - b) <= rel * Math.abs(b), `${msg || ""} ${a} vs ${b}`);
const TODAY = "2026-10-03", TSM = FACTS.companies.TSM, RATE = rateOnOrBefore(FACTS.fx.TWD, TODAY);
/* TSMC as FMP would quote its home listing: the same share count, the price and the market value in Taiwan dollars */
const homeListing = (c, rate, ccy) => ({ ...c, profile: { ...c.profile, price: c.profile.price / rate, marketCap: c.profile.marketCap / rate, currency: ccy, isAdr: false, exchange: "HOME" }, quote: { ...c.quote, price: c.quote.price / rate, marketCap: c.quote.marketCap / rate } });
const HOME = homeListing(TSM, RATE.rate, "TWD");
const withPeer = (key, c, fx = FACTS.fx) => ({ source: FACTS.source, taken: FACTS.taken, fx, companies: { MU: FACTS.companies.MU, TSM, [key]: c } });
const multiples = async (facts, key, { dollars = true } = {}) => {
  const use = dollars ? inDollars(facts).facts : facts, tables = tablesFrom(use);
  const ctx = await readCohort({ ticker: "MU", today: TODAY, pg: pgFrom(tables), quotes: quotesFrom(use), fxStandin: { ...standin, reported: { ...reported.reported, [key]: "TWD" } }, membersAsked: ["MU", "TSM", key], labelAsked: "test" });
  const s = snapshotFromCohort(ctx, "MU");
  return { row: Object.fromEntries(s.rows.map((r) => [r.key, { home: r.values[key] ? r.values[key].multiple : null, adr: r.values.TSM ? r.values.TSM.multiple : null }])), fx: s.fx_peers[key] };
};

test("a home listing read as it comes would be priced some thirty times too high: a Taiwan-dollar price over dollar earnings", async () => {
  assert.equal(RATE.date, "2026-10-02"); near(RATE.rate, 0.031397, 1e-9);
  assert.equal(HOME.profile.currency, "TWD"); near(HOME.profile.price, 472.78 / 0.031397, 1e-12); assert.ok(HOME.profile.price > 15000);
  const raw = await multiples(withPeer("000660.KS", HOME), "000660.KS", { dollars: false });
  assert.ok(raw.row.pe_ttm.home > 25 * raw.row.pe_ttm.adr, `as it comes: ${raw.row.pe_ttm.home} against the dollar line's ${raw.row.pe_ttm.adr}`);
  near(raw.row.pe_ttm.home / raw.row.pe_ttm.adr, 1 / RATE.rate, 0.02, "off by the exchange rate, exactly");
});
test("put in dollars first, the home listing is priced as the same company's dollar line is: every multiple, to the rounding", async () => {
  const D = inDollars(withPeer("000660.KS", HOME)), c = D.facts.companies["000660.KS"], L = D.listing["000660.KS"];
  assert.equal(c.profile.currency, "USD"); assert.equal(c.profile.listing_currency, "TWD"); near(c.profile.price, TSM.profile.price, 1e-9); near(c.profile.marketCap, TSM.profile.marketCap, 1e-9); near(c.quote.price, TSM.quote.price, 1e-9);
  assert.deepEqual({ currency: L.currency, rate: L.rate, rate_date: L.rate_date }, { currency: "TWD", rate: RATE.rate, rate_date: "2026-10-02" }); near(L.price_local, HOME.profile.price, 1e-12); near(L.market_cap_usd, TSM.profile.marketCap, 1e-9);
  assert.equal(HOME.profile.currency, "TWD", "the facts given are not changed"); assert.deepEqual(D.facts.companies.MU, FACTS.companies.MU, "a dollar listing passes through untouched"); assert.deepEqual(D.left_out, {}); assert.deepEqual(D.stand_in, {});
  assert.deepEqual(c.income_q, TSM.income_q, "statements stay in their own currency: C5b converts each at its period-end rate");
  const m = await multiples(withPeer("000660.KS", HOME), "000660.KS");
  for (const k of ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps"]) { assert.ok(m.row[k].adr > 0, k + " is priced for the dollar line"); near(m.row[k].home, m.row[k].adr, 1e-6, k); }
  assert.ok(m.row.pe_ttm.home > 20 && m.row.pe_ttm.home < 45, "a P/E a chip maker carries: " + m.row.pe_ttm.home);
  assert.equal(m.fx.currency, "TWD"); assert.equal(m.fx.converted, true); assert.match(m.fx.market_value, /company_profile \(FMP, USD\)/);
  assert.match(m.fx.adr.basis, /per US-listed share already/, "the share count holds, so per-share figures are on the right count");
});
test("no rate, no figure: a home listing whose currency has no series in the facts is left out and named — never mixed", () => {
  const facts = withPeer("000660.KS", { ...HOME, profile: { ...HOME.profile, currency: "KRW" } }), D = inDollars(facts);
  assert.equal(D.facts.companies["000660.KS"], undefined); assert.match(D.left_out["000660.KS"], /quoted in KRW and the facts carry no KRWUSD rate on or before 2026-10-03: left out/);
  const R = referenceOf(facts); assert.deepEqual(Object.keys(R.peers), []); assert.ok(R.missing.includes("000660.KS")); assert.match(R.why_missing["000660.KS"], /no KRWUSD rate/); assert.match(R.why_missing["285A.T"], /no profile, market value or quarterly statements/);
  /* a rate dated after the quote is not used */
  assert.equal(rateOnOrBefore([["2026-10-05", 9], ["2026-10-01", 0.03], ["2026-09-30", 0.02]], "2026-10-03").rate, 0.03); assert.equal(rateOnOrBefore([["2026-10-05", 9]], "2026-10-03"), null); assert.equal(rateOnOrBefore(null, "2026-10-03"), null);
  assert.match(inDollars(withPeer("000660.KS", HOME, { TWD: [["2026-10-09", 0.03]] })).left_out["000660.KS"], /no TWDUSD rate on or before/);
});
test("the reference path end to end: the peer reaches the comps reader's tables and quotes in dollars, with what was done to it on the record", async () => {
  const facts = withPeer("000660.KS", HOME), R = referenceOf(facts);
  assert.deepEqual(Object.keys(R.peers), ["000660.KS"]); near(R.peers["000660.KS"].market_cap_usd, TSM.profile.marketCap, 1e-9); assert.equal(R.peers["000660.KS"].listing.currency, "TWD"); assert.equal(R.peers["000660.KS"].currency, "TWD", "its statements' currency");
  const pg = withReference(async () => [], facts), prof = await pg("company_profile?select=ticker,price,market_cap&ticker=in.(000660.KS)"), fund = await pg("fundamentals?select=ticker,price&ticker=in.(000660.KS)");
  near(prof[0].price, TSM.profile.price, 1e-9); near(prof[0].market_cap, TSM.profile.marketCap, 1e-9); near(fund[0].price, TSM.quote.price, 1e-9);
  const q = await withReferenceQuotes(async () => ({ quotes: {} }), facts)(["000660.KS"]); near(q.quotes["000660.KS"].price, TSM.quote.price, 1e-9);
  const hist = await pg("fundamentals_history?select=ticker,revenue&ticker=in.(000660.KS)"); assert.equal(hist[0].revenue, TSM.income_q[0].revenue, "statements arrive in their own currency, for C5b to convert");
  assert.equal(REFERENCE_JOB.script, "scripts/fx-multiples-check.mjs"); assert.deepEqual(REFERENCE_JOB.symbols, Object.keys(REFERENCE_PEERS));
});
test("the US line stands in for a home listing that brought nothing only when its share count holds; an ADS that is a fraction of a share is refused", () => {
  assert.deepEqual(REFERENCE_PEERS["000660.KS"].also, ["SKHY", "SKHYV"]);
  near(shareBasis(TSM), 1, SHARE_BASIS_TOL, "TSMC's ADR: statements on the ADR's own count"); assert.equal(SHARE_BASIS_TOL, 0.15);
  const ok = inDollars({ taken: FACTS.taken, fx: FACTS.fx, companies: { SKHY: TSM } });
  assert.equal(ok.stand_in["000660.KS"], "SKHY"); assert.deepEqual(ok.facts.companies["000660.KS"], TSM); assert.equal(referenceOf({ taken: FACTS.taken, fx: FACTS.fx, companies: { SKHY: TSM } }).peers["000660.KS"].stand_in, "SKHY");
  const tenth = { ...TSM, income_q: TSM.income_q.map((r) => ({ ...r, weightedAverageShsOutDil: r.weightedAverageShsOutDil / 10 })) };
  const bad = inDollars({ taken: FACTS.taken, fx: FACTS.fx, companies: { SKHY: tenth } });
  assert.equal(bad.facts.companies["000660.KS"], undefined); assert.match(bad.left_out["000660.KS"], /its US line SKHY cannot stand in: its statements are on 0\.10× the listed share count/);
  /* the home listing, when it has figures, is always the one used */
  const both = inDollars({ taken: FACTS.taken, fx: FACTS.fx, companies: { "000660.KS": HOME, SKHY: tenth } }); assert.deepEqual(both.stand_in, {}); assert.equal(both.facts.companies["000660.KS"].profile.listing_currency, "TWD");
  assert.equal(shareBasis({ profile: {}, income_q: [] }), null);
});
test("the facts file from raw FMP answers: each answer is told by what is in it, and the result is the Fly job's own shape to the field", () => {
  /* TSMC's committed facts, taken apart into the answers FMP gives (its own field names), saved under file names that say nothing */
  const sym = (rows) => rows.map((r) => ({ symbol: "TSM", ...r }));
  const raw = [
    { file: "a.json", json: [{ symbol: "TSM", companyName: "Taiwan Semiconductor", industry: "Semiconductors", ...TSM.profile }] },
    { file: "b.json", json: [{ symbol: "TSM", previousClose: 470, ...TSM.quote }] },
    { file: "c.json", json: sym(TSM.income_q).reverse() },
    { file: "d.json", json: { data: sym(TSM.balance_q) } },
    { file: "e.json", json: [{ symbol: "TSM", period: "Q2", ...TSM.key_metrics_q }] },
    { file: "f.json", json: sym(TSM.estimates) },
    { file: "g.json", json: [{ symbol: "TSM", priceToEarningsRatioTTM: TSM.fmp_ttm.pe, priceToSalesRatioTTM: TSM.fmp_ttm.ps, enterpriseValueMultipleTTM: TSM.fmp_ttm.ev_ebitda_ratios, priceToEarningsGrowthRatioTTM: TSM.fmp_ttm.peg, forwardPriceToEarningsGrowthRatioTTM: TSM.fmp_ttm.fpeg }] },
    { file: "h.json", json: [{ symbol: "TSM", evToSalesTTM: TSM.fmp_ttm.ev_sales_km, evToEBITDATTM: TSM.fmp_ttm.ev_ebitda_km, marketCap: TSM.fmp_ttm.marketCap_km, enterpriseValueTTM: TSM.fmp_ttm.enterpriseValue_km }] },
    { file: "i.json", json: FACTS.fx.TWD.map(([date, price]) => ({ symbol: "TWDUSD", date, price, volume: 0 })).reverse() },
    { file: "junk.json", json: { hello: "world" } }, { file: "broken.json", json: null },
  ];
  assert.deepEqual(raw.slice(0, 9).map((a) => kindOf(Array.isArray(a.json) ? a.json : a.json.data)), ["profile", "quote", "income", "balance", "key_metrics", "estimates", "ratios_ttm", "key_metrics_ttm", "fx"]);
  const A = assemble(raw, { taken: FACTS.taken, symbols: ["TSM", "285A.T"] }), c = A.doc.companies.TSM;
  assert.deepEqual(A.unread, ["junk.json", "broken.json"]);
  assert.deepEqual({ ...c.profile, industry: undefined }, { ...TSM.profile, industry: undefined }); assert.equal(c.profile.industry, "Semiconductors", "the industry is kept, for the same-industry vote");
  assert.deepEqual(c.quote, { ...TSM.quote, sharesOutstanding: undefined }); assert.deepEqual(c.income_q, TSM.income_q); assert.deepEqual(c.balance_q, TSM.balance_q); assert.deepEqual(c.key_metrics_q, TSM.key_metrics_q); assert.deepEqual(c.fmp_ttm, TSM.fmp_ttm);
  assert.deepEqual(c.estimates, TSM.estimates.slice().sort((x, y) => x.date.localeCompare(y.date))); assert.deepEqual(A.doc.fx.TWD, FACTS.fx.TWD); assert.equal(A.doc.taken, FACTS.taken);
  assert.deepEqual(A.report.TSM.missing, []); assert.equal(A.report.TSM.quarters, 8); assert.equal(A.report.TSM.statement_currency, "TWD"); assert.equal(A.report.TSM.listing_currency, "USD");
  assert.deepEqual(A.report["285A.T"].arrived, []); assert.equal(A.doc.companies["285A.T"], undefined, "nothing arrived for it: it is not in the file, and it is said");
  assert.deepEqual(A.currencies, { TWD: { rate_days: FACTS.fx.TWD.length, newest: FACTS.fx.TWD[FACTS.fx.TWD.length - 1] } });
  /* the assembled file prices exactly as the Fly job's does */
  assert.deepEqual(tablesFrom({ companies: { TSM: c }, fx: A.doc.fx }).fundamentals, tablesFrom({ companies: { TSM }, fx: FACTS.fx }).fundamentals);
  /* an annual income statement is not taken for the quarterly one, and the report says what to ask for */
  const annual = assemble([{ file: "x.json", json: [{ symbol: "285A.T", period: "FY", date: "2026-03-31", revenue: 1, grossProfit: 1, netIncome: 1 }] }], { symbols: ["285A.T"] });
  assert.equal(annual.report["285A.T"].quarters, 0); assert.match(annual.report["285A.T"].note, /annual: the comps reader needs the quarterly one/);
  /* a currency with no series is named, so its companies are known to be left out before any price is read */
  const noFx = assemble(raw.filter((a) => a.file !== "i.json").slice(0, 8).map((a) => (a.file === "a.json" ? { ...a, json: [{ ...a.json[0], currency: "TWD" }] } : a)), { symbols: ["TSM"] });
  assert.deepEqual(noFx.currencies, { TWD: { rate_days: 0, newest: null } });
});
