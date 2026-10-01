/* Comps template (C3, 1 Oct · deliverables/20261001/comps-template): the foreign-filer conversion, the four ways and the
   disagreement line, the weights, the row summaries, the full table, the cohort table, and the Hub's wiring. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { rateOn, filerCurrency, convertSrc, ratesByCurrency, CCY_FIELDS } from "../deliverables/20261001/comps-template/fx.mjs";
import { snapshotFromCohort, TABLE, ROWS, cohortChoice } from "../deliverables/20261001/comps-template/cohort.mjs";
import { fourWays, wayOf, disagreement, conclusion, rowSummaries, reliability, equalWeights, sectorClass, cohortTable, sortCohort, WAYS } from "../deliverables/20261001/comps-template/template.mjs";
import { decisionRow } from "../deliverables/20260930/comps-tab/comps-tab.mjs";
import { middleHalfBand, rangeOfMedians, weightedBlend, median } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";
import { buildInputs } from "../deliverables/20260927/comps-r3/r3.mjs";

const here = (p) => new URL(p, import.meta.url);
const FIX = JSON.parse(readFileSync(here("../deliverables/20261001/comps-template/cohort-AI_HARDWARE-2026-10-01.json"), "utf8"));
const snap = (t) => FIX.snapshots.find((s) => s.ticker === t);
const TSM = snap("TSM"), MU = snap("MU"), NVDA = snap("NVDA"), ASML = snap("ASML");
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const at = (i) => new Date(Date.UTC(2026, 9, 1, 14, 0, i)).toISOString();

test("rateOn: the newest rate on or before the date; nothing before the series starts", () => {
  const s = [["2026-06-27", 0.0330], ["2026-06-30", 0.0328], ["2026-07-01", 0.0329]];
  assert.deepEqual(rateOn(s, "2026-06-29"), { date: "2026-06-27", rate: 0.033 });
  assert.deepEqual(rateOn(s, "2026-06-30"), { date: "2026-06-30", rate: 0.0328 });
  assert.equal(rateOn(s, "2026-06-01"), null); assert.equal(rateOn([], "2026-06-30"), null);
});

test("filerCurrency: USD by default for a US filer; a foreign filer without a row is unknown, never assumed", () => {
  assert.deepEqual(filerCurrency("MU", { country: "US" }, null).currency, "USD");
  assert.equal(filerCurrency("TSM", { is_adr: true, country: "TW" }, null).currency, null);
  assert.equal(filerCurrency("TSM", { is_adr: true }, { reported_currency: "twd", source: "fmp" }).currency, "TWD");
});

test("convertSrc: every statement figure at its own date's rate, estimates at today's, the share basis checked; nothing invented without a rate", () => {
  const src = { ticker: "X", profile: { market_cap: 1000, price: 10 }, fundamentals: { date: "2026-06-30", eps_ttm: 300, revenue_ttm: 9000, price: 10, market_cap: 1000 },
    incQ: [{ fiscal_date: "2026-06-30", revenue: 3000, ebitda: 1000, eps_diluted: 100, shares_dil: 100 }, { fiscal_date: "2026-03-31", revenue: 2000, ebitda: 500, eps_diluted: 50, shares_dil: 100 }], incFY: [],
    balance: [{ fiscal_date: "2026-06-30", net_debt: -500, total_debt: 100, cash_and_equiv: 600 }], cfQ: [{ fiscal_date: "2026-06-30", operating_cf: 400, capex: -100, free_cf: 300 }], cfFY: [],
    estimates: [{ fiscal_date: "2026-12-31", est_eps_avg: 400, est_revenue_avg: 12000 }] };
  const rates = { TWD: [["2026-03-31", 0.03], ["2026-06-30", 0.032], ["2026-09-30", 0.031]] };
  const { src: c, note } = convertSrc(src, { currency: "TWD", source: "test" }, rates, "2026-10-01");
  assert.equal(note.converted, true);
  close(c.fundamentals.eps_ttm, 300 * 0.032); close(c.fundamentals.revenue_ttm, 9000 * 0.032); assert.equal(c.fundamentals.price, 10, "the USD price is left alone");
  close(c.incQ[0].revenue, 3000 * 0.032); close(c.incQ[1].revenue, 2000 * 0.03); close(c.incQ[0].eps_diluted, 100 * 0.032); assert.equal(c.incQ[0].shares_dil, 100, "a share count is not money");
  close(c.balance[0].net_debt, -500 * 0.032); close(c.cfQ[0].capex, -100 * 0.032);
  close(c.estimates[0].est_eps_avg, 400 * 0.031); assert.equal(note.today_rate_date, "2026-09-30");
  assert.equal(note.adr.ratio, 1); assert.match(note.adr.basis, /per US-listed share already/);
  const none = convertSrc(src, { currency: "TWD", source: "test" }, {}, "2026-10-01");
  assert.equal(none.note.converted, false); assert.match(none.note.why, /no USD rate on file/); assert.equal(none.src.fundamentals.eps_ttm, 300);
  const usd = convertSrc(src, { currency: "USD", source: "test" }, rates, "2026-10-01"); assert.equal(usd.note.why, "reports in USD: nothing to convert");
  const unknown = convertSrc(src, { currency: null, source: "x" }, rates, "2026-10-01"); assert.match(unknown.note.why, /currency unknown/);
  assert.deepEqual(ratesByCurrency([{ pair: "TWDUSD", date: "2026-06-30", rate: 0.032 }, { pair: "EURUSD", date: "2026-06-30", rate: 1.1 }, { pair: "XXX", date: "2026-01-01", rate: 1 }]), { TWD: [["2026-06-30", 0.032]], EUR: [["2026-06-30", 1.1]] });
  assert.ok(CCY_FIELDS.history.includes("ebitda") && CCY_FIELDS.balance.includes("net_debt"));
});

test("the fixture: TSM converted from TWD carries every valuation multiple (the defect is gone); ASML from EUR; the US filers untouched; the stand-in is named", () => {
  assert.equal(FIX.cohort, "AI_HARDWARE");
  assert.equal(TSM.fx.currency, "TWD"); assert.equal(TSM.fx.converted, true); assert.match(TSM.fx.why, /implied by FMP's USD market value over its TWD market value/); assert.match(TSM.fx.why, /stand-in/);
  for (const k of ROWS) { const r = TSM.rows.find((x) => x.key === k); assert.ok(r.own.multiple > 0, `TSM ${k} = ${r.own.multiple}`); }
  const pe = TSM.rows.find((r) => r.key === "pe_ttm").own.multiple;
  assert.ok(pe > 15 && pe < 60, `TSM P/E ${pe} is a P/E, not 1.1x`);
  assert.ok(TSM.table.company.ev_ebitda > 0 && TSM.table.company.ev_sales > 0 && TSM.table.company.ps > 0);
  assert.equal(ASML.fx.currency, "EUR"); assert.equal(ASML.fx.converted, true); assert.match(ASML.fx.why, /ECB reference rates/);
  assert.match(ASML.fx.adr.basis, /per US-listed share already/);
  assert.equal(MU.fx.currency, "USD"); assert.equal(FIX.fx.ARM.currency, "USD"); assert.equal(FIX.fx.SIMO.currency, "USD");
  assert.equal(FIX.fx_tables.fx_rates, false, "the FMP tables were not applied when this fixture was taken");
  assert.ok(!FIX.snapshots.some((s) => s.ticker === "NVO"), "NVO is not served on the Hub");
});

test("the full table: every column of the original comps table for the company and each peer", () => {
  assert.deepEqual(TABLE.map((c) => c.key), ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg", "rev_g_ttm", "rev_g_fy", "eps_g_fy", "gm", "om", "fcfm", "nd_ebitda", "capex_rev", "capex_g", "rev_per_capex"]);
  for (const c of TABLE) assert.ok(c.key in MU.table.company, c.key);
  const peers = Object.keys(MU.table.peers); assert.ok(peers.length >= 30 && !peers.includes("MU"));
  assert.ok(MU.table.company.gm > 0 && MU.table.company.capex_rev > 0);
  assert.equal(cohortChoice("MU", ["MEGA_CAP", "SEMICONDUCTORS"], "AI_HARDWARE").cohort, "AI_HARDWARE", "the home cohort is asked for");
});

test("the four ways: A, B, C equal, C weighted — each with the upside; the disagreement line measures the spread of the centres", () => {
  const W = fourWays(MU.rows, MU.price, { peerCount: 38, cls: "capital-intensive" });
  assert.deepEqual(W.map((w) => w.way), WAYS);
  const A = wayOf(W, "A"), B = wayOf(W, "B"), CE = wayOf(W, "CE"), CW = wayOf(W, "CW");
  const A2 = rangeOfMedians(MU.rows), B2 = middleHalfBand(MU.rows); close(A.mid, A2.mid); close(B.lo, B2.lo); close(B.hi, B2.hi);
  const eq = equalWeights(MU.rows); close(Object.values(eq).reduce((s, x) => s + x, 0), 1); close(CE.mid, weightedBlend(MU.rows, eq).mid);
  close(Object.values(CW.weights).reduce((s, x) => s + x, 0), 1); assert.ok(CW.reliability.parts.ev_ebitda.prior > CW.reliability.parts.ps.prior, "capital-intensive prior leans on EV/EBITDA");
  for (const w of W) { assert.ok(w.ok); close(w.upside.mid.pct, (w.mid / MU.price - 1) * 100); assert.ok(w.plain.length > 20); }
  const d = disagreement(W, MU.price); assert.ok(d.ok && d.spread >= 0 && /centres sit between/.test(d.words));
  close(d.spread, (Math.max(...W.map((w) => w.mid)) - Math.min(...W.map((w) => w.mid))) / MU.price * 100);
});

test("reliability weights: coverage, tightness and pricing fit from the rows themselves; a row that cannot price the company gets no weight", () => {
  const rows = [
    { key: "pe_ttm", ok: true, ends: { median: { price: 100 }, q1: { price: 80 }, q3: { price: 120 } }, band: { n: 4, q1: 10, median: 12, q3: 14 }, peers: [{ multiple: 10 }, { multiple: 11 }, { multiple: 13 }, { multiple: 14 }], values: {} },
    { key: "ps", ok: true, ends: { median: { price: 100 }, q1: { price: 50 }, q3: { price: 150 } }, band: { n: 2, q1: 2, median: 5, q3: 8 }, peers: [{ multiple: 2 }, { multiple: 8 }], values: {} },
    { key: "peg", ok: false, ends: {}, band: { n: 0 }, peers: [], values: {} },
  ];
  const R = reliability(rows, 4, "default");
  assert.equal(R.parts.pe_ttm.coverage, 1); assert.equal(R.parts.ps.coverage, 0.5); assert.equal(R.weights.peg, 0);
  assert.ok(R.parts.pe_ttm.tightness > R.parts.ps.tightness && R.parts.pe_ttm.fit > R.parts.ps.fit);
  assert.ok(R.weights.pe_ttm > R.weights.ps); close(R.weights.pe_ttm + R.weights.ps, 1);
  close(R.parts.pe_ttm.median_error, median([10, 11, 13, 14].map((v) => Math.abs(12 / v - 1))));
  assert.equal(sectorClass("Technology", "Semiconductors", "AI_HARDWARE"), "capital-intensive"); assert.equal(sectorClass("Technology", "Software - Application", "AI_SOFTWARE"), "software-services"); assert.equal(sectorClass("Financial Services", "Banks", "FIN"), "financial"); assert.equal(sectorClass(null, null, "X"), "default");
});

test("the conclusion on the selection in force: turning a peer off moves the range; the row summaries carry one upside per row and the 25th / 75th in the detail", () => {
  const C0 = conclusion(MU, [], "B"), C1 = conclusion(MU, [decisionRow({ company: "MU", peer: "AXTI", off: true, set_at: at(1) }), decisionRow({ company: "MU", peer: "CRWD", off: true, set_at: at(2) })], "B");
  assert.ok(C0.band && C1.band && C1.off === 2 && (C0.band.hi !== C1.band.hi || C0.band.lo !== C1.band.lo));
  assert.deepEqual(C0.waysAll.map((w) => w.mid), conclusion(MU, [], "A").waysAll.map((w) => w.mid), "ALL PEERS ways do not depend on the choice");
  const rs = rowSummaries(C0.rows, "MU");
  assert.equal(rs.length, 6);
  for (const r of rs) { if (r.ok) { assert.ok(r.own > 0 && r.median > 0 && r.upside != null && r.detail.q1 && r.detail.q3); close(r.upside, (r.detail.median.price / MU.price - 1) * 100); } }
  const cw = conclusion(MU, [], "CW"); assert.equal(cw.way, "CW"); assert.ok(cw.band.mid > 0);
});

test("the cohort table on the chosen way: every member, price, Geiger, both sets, the currency column; sortable", () => {
  const T = cohortTable(FIX.snapshots, [decisionRow({ company: "MU", peer: "AXTI", off: true, set_at: at(1) })], "CE");
  assert.equal(T.rows.length, FIX.snapshots.length);
  const mu = T.rows.find((r) => r.ticker === "MU"), tsm = T.rows.find((r) => r.ticker === "TSM");
  assert.equal(mu.off, 1); assert.ok(mu.all && mu.sel && mu.geiger != null);
  assert.equal(tsm.fx, "TWD → USD"); assert.ok(tsm.all && Math.abs(tsm.all.mid) < 300, `TSM's upside is a number now (${tsm.all.mid}), not +3872%`);
  const byT = sortCohort(T.rows, "ticker", 1); assert.equal(byT[0].ticker, byT.map((r) => r.ticker).sort()[0]);
});

test("the Hub: the COMPS tab loads the C3 module; migration, rollback and Fly job exist; the C2 tab list and ESTIMATES untouched", () => {
  const html = readFileSync(here("../index.html"), "utf8");
  assert.match(html, /import\("\/deliverables\/20261001\/comps-(template|table-first|mechanic)\/tab\.mjs"\)/, "the COMPS tab loads the C3 template or a module built on it (C3b, C4)");
  assert.match(html, /const CO_TABS = \["GEIGER","FUNDAMENTALS","ESTIMATES","COMPS","FINANCIALS","STATS","NEWS","SOCIAL","EVENTS","READ"\]/);
  assert.ok(!/estCompsHTML|scCompsLive/.test(html));
  for (const f of ["../supabase/migrations/20261001_fx_filer.sql", "../supabase/migrations/20261001_fx_filer_ROLLBACK.sql", "../scripts/fx-filer-sync.mjs", "../deliverables/20261001/comps-template/fx-standin-ecb-2026-10-01.json", "../deliverables/20261001/comps-template/COMPS-TEMPLATE.html"]) assert.ok(existsSync(here(f)), f);
  const job = readFileSync(here("../scripts/fx-filer-sync.mjs"), "utf8"); assert.match(job, /reportedCurrency/); assert.match(job, /historical-price-full/); assert.ok(!/apikey=[A-Za-z0-9]{10,}/.test(job), "no key in the script");
  const src = readFileSync(here("../deliverables/20261001/comps-template/tab.mjs"), "utf8");
  const css = src.slice(src.indexOf("export const CSS = `") + 20, src.indexOf("`;", src.indexOf("export const CSS = `")));
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); assert.ok(Math.max(r, g, b) <= 210, hex); }
  assert.ok(!/the peers, from the lowest to the highest|instructions/.test(src), "no legend sentences");
  for (const f of ["TSM-1680.png", "TSM-390.png", "MU-1680.png", "NVDA-1680.png", "TSM-table-1680.png", "TSM-cw-1680.png", "MU-390.png", "NVDA-390.png"]) assert.ok(existsSync(here("../deliverables/20261001/comps-template/shots/" + f)), f);
});
