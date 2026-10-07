/* C5b (3 Oct) — one currency per multiple. Pinned to FMP's facts of 3 Oct (deliverables/20261003/comps-c5b/fmp-facts-2026-10-03.json,
   printed on Fly by scripts/fx-multiples-check.mjs) rebuilt as the Hub's tables (fmp-rows.mjs); no network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { readCohort, snapshotFromCohort } from "../deliverables/20261001/comps-template/cohort.mjs";
import { filerCurrency, withholdSrc, usdMarketValue, epsTtmByQuarter } from "../deliverables/20261001/comps-template/fx.mjs";
import { tablesFrom, pgFrom, quotesFrom, fmpAtUsListing } from "../deliverables/20261003/comps-c5b/fmp-rows.mjs";

const D = "deliverables/20261003/comps-c5b/";
const facts = JSON.parse(readFileSync(D + "fmp-facts-2026-10-03.json", "utf8"));
const reported = JSON.parse(readFileSync(D + "reporting-currency-fmp-2026-10-03.json", "utf8"));
const check = JSON.parse(readFileSync(D + "check-2026-10-03.json", "utf8"));
const standin = JSON.parse(readFileSync("deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "utf8"));
const tables = tablesFrom(facts, { noFilerRow: ["PDD"], noFundPrice: ["TSM", "ASML"] });
const TOL = 0.10;   // the stated tolerance against FMP's own TTM multiple (restated at the US listing's market value)
const snap = async (t, mate = "AMZN") => snapshotFromCohort(await readCohort({ ticker: t, today: "2026-10-03", pg: pgFrom(tables), quotes: quotesFrom(facts), fxStandin: { ...standin, reported: reported.reported }, membersAsked: [t, mate], labelAsked: "test" }), t);
const rate = (ccy) => { const s = facts.fx[ccy]; return s[s.length - 1][1]; };

test("the sweep: FMP's statements name 16 non-USD reporters among the served companies, PDD among them", () => {
  assert.equal(reported.not_usd.length, 16);
  for (const t of ["PDD", "BABA", "JD", "TSM", "ASML", "SPOT", "CCJ", "EVTL"]) assert.notEqual(reported.reported[t], "USD", t);
  assert.equal(reported.reported.AMZN, "USD"); assert.equal(reported.reported.MELI, "USD");
});

test("PDD without a filer_currency row and with a profile that reads as a US filer: its statements' currency wins, never the USD default", () => {
  assert.equal(filerCurrency("PDD", { country: "US" }, null).currency, "USD");   // the old fall-through, kept for a true US filer
  assert.equal(filerCurrency("PDD", { country: "US" }, null, reported.reported).currency, "CNY");
  assert.equal(filerCurrency("PDD", {}, { reported_currency: "cny" }, { PDD: "USD" }).currency, "CNY");   // a stored row still outranks
});

test("foreign reporters: P/E, EV/EBITDA and P/S equal FMP's own within 10%", async () => {
  for (const t of ["BABA", "JD", "PDD", "ASML", "TSM", "TECK", "CCJ"]) {
    const s = await snap(t), o = fmpAtUsListing(facts.companies[t], rate(s.fx.currency));
    for (const k of ["pe_ttm", "ev_ebitda", "ps"]) {
      const v = s.table.company[k];
      assert.ok(v != null && o[k] != null, `${t} ${k} computed`);
      assert.ok(Math.abs(v / o[k] - 1) <= TOL, `${t} ${k} ${v.toFixed(2)} vs FMP ${o[k].toFixed(2)}`);
    }
  }
});

test("every non-USD reporter's P/S and EV/sales within 10% of FMP's (the currency artefacts were 5-33x)", async () => {
  for (const t of reported.not_usd.map((x) => x.split(" ")[0])) {
    const s = await snap(t), o = fmpAtUsListing(facts.companies[t], rate(s.fx.currency));
    for (const k of ["ev_sales", "ps"]) if (o[k] != null && s.table.company[k] != null) assert.ok(Math.abs(s.table.company[k] / o[k] - 1) <= TOL, `${t} ${k} ${s.table.company[k]} vs ${o[k]}`);
  }
});

test("the defect as it was: BABA EV/EBITDA ~87x and PDD P/E 1.2x before; ~15x and ~8x after", () => {
  const row = (t) => check.table.find((r) => r.ticker === t);
  assert.ok(row("BABA").before.ev_ebitda > 70 && row("BABA").after.ev_ebitda < 20);
  assert.ok(row("PDD").before.pe_ttm < 2 && row("PDD").after.pe_ttm > 6);
  assert.ok(row("JD").before.ev_ebitda > 40 && row("JD").after.ev_ebitda < 12);
});

test("a USD reporter is unchanged: the new reader gives the old reader's numbers to the cent", async () => {
  for (const t of ["AMZN", "MELI", "WMT", "NVDA", "SHOP", "ARM"]) {
    const s = await snap(t, t === "AMZN" ? "MELI" : "AMZN"), was = check.table.find((r) => r.ticker === t).before;
    for (const k of ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps"]) {
      if (was[k] == null) { assert.equal(s.table.company[k], null, `${t} ${k}`); continue; }
      assert.ok(Math.abs(s.table.company[k] - was[k]) < 1e-9, `${t} ${k} ${s.table.company[k]} vs ${was[k]}`);
    }
    assert.equal(s.fx.market_value, undefined);
  }
});

test("the market value of a foreign reporter is FMP's USD profile: shares = the ADR count", () => {
  const src = { profile: { market_cap: 253708913584, price: 105.85 }, fundamentals: { market_cap: 1519786511033.5, price: 105.85 } };
  const { src: out, from } = usdMarketValue(src, "CNY");
  assert.ok(Math.abs(out.fundamentals.market_cap / out.fundamentals.price - 2.3968e9) < 1e6); assert.match(from, /company_profile/);
  assert.equal(usdMarketValue(src, "USD").src, src);
  assert.equal(usdMarketValue({ profile: {}, fundamentals: { market_cap: 5, price: 1 } }, "CNY").src.fundamentals.market_cap, null);
});

test("a foreign figure in an unknown currency is withheld: every multiple prints — with the reason, never yuan ÷ dollars", async () => {
  /* PDD as FMP's profile has it (Ireland, ADR), no filer_currency row and no sweep: the currency is unknown */
  const t2 = tablesFrom(facts, { noFundPrice: ["TSM", "ASML"] }); t2.filer_currency = t2.filer_currency.filter((r) => r.ticker !== "PDD");
  const ctx = await readCohort({ ticker: "PDD", today: "2026-10-03", pg: pgFrom(t2), quotes: quotesFrom(facts), fxStandin: null, membersAsked: ["PDD", "AMZN"], labelAsked: "t" });
  const s = snapshotFromCohort(ctx, "PDD");
  for (const k of ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps"]) assert.equal(s.table.company[k], null, k);
  assert.equal(s.fx.withheld, true); assert.match(s.fx.why, /currency unknown/); assert.match(s.fx.why, /withheld/);
  assert.match(s.rows.find((r) => r.key === "pe_ttm").own_why || "", /reporting currency unknown: withheld/);
  const w = withholdSrc({ fundamentals: { eps_ttm: 1, market_cap: 2, price: 3 }, incQ: [{ revenue: 1, fiscal_date: "x" }], estimates: [{ est_eps_avg: 1 }] });
  assert.equal(w.fundamentals.eps_ttm, null); assert.equal(w.fundamentals.market_cap, null); assert.equal(w.fundamentals.price, 3); assert.equal(w.incQ[0].revenue, null); assert.equal(w.estimates[0].est_eps_avg, null);
});

test("trailing EPS in dollars quarter by quarter, only when the four quarters are the stored sum", () => {
  const raw = { fundamentals: { eps_ttm: 10 }, incQ: [1, 2, 3, 4].map((e) => ({ eps_diluted: e })) };
  const conv = { incQ: [1, 2, 3, 4].map((e, i) => ({ eps_diluted: e * (0.1 + i * 0.01) })) };
  assert.ok(Math.abs(epsTtmByQuarter(raw, conv) - (0.1 + 0.22 + 0.36 + 0.52)) < 1e-12);
  assert.equal(epsTtmByQuarter({ ...raw, fundamentals: { eps_ttm: 12 } }, conv), null);
  assert.equal(epsTtmByQuarter({ ...raw, incQ: raw.incQ.slice(0, 3) }, conv), null);
});

test("the nine sets after: no flagged foreign peer is off FMP by more than the tolerance (no currency artefact left)", () => {
  const fmp = Object.fromEntries(check.table.map((r) => [r.ticker, r.fmp]));
  for (const [T, s] of Object.entries(check.sets)) for (const o of s.after.outliers) {
    if (!fmp[o.ticker] || (check.table.find((r) => r.ticker === o.ticker) || {}).currency === "USD") continue;
    const f = fmp[o.ticker][o.key];
    if (f != null) assert.ok(Math.abs(o.multiple / f - 1) <= TOL, `${T}: ${o.ticker} ${o.key} ${o.multiple} vs FMP ${f}`);
  }
  assert.ok(check.sets.AMZN.before.outliers.some((o) => o.ticker === "PDD" && o.key === "pe_ttm"));
  assert.ok(!check.sets.AMZN.after.outliers.some((o) => o.ticker === "PDD" && o.key === "pe_ttm"));
  assert.ok(!check.sets.AMZN.after.outliers.some((o) => o.ticker === "BABA"));
});
