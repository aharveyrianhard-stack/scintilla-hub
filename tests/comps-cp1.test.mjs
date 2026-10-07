/* Comps CP1 (6 Oct · deliverables/20261006/decision-cards): the fixes proposed INSIDE the comps system, each behind a
   named switch that is off by default — and tested here together with the rules they touch (C5's lines and seats, C6b's
   votes, the mostly-different-business protection, the operator's KEEP click, the five-peer floor).
   Offline: the committed fixtures only (C6's four sets, CP1's six, C5b's FMP facts). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { linesOf, similarity, buildSet, complementSet, votesFor, lineWords, CP1_DEFAULT, CP1_LINES_OFF, CP1_LINES_ON, REFERENCE_PEERS, SAME_MIN, N_MAX, SIM_MIN, N_DEFAULT } from "../deliverables/20261003/comps-c5/lines.mjs";
import { conclusion, fieldAdjust, ffoRow, measureWeights, isReit, isValuation, CP1_FIELD_OFF, CP1_FIELD_ON, GROWTH_CREDIT_MAX, MARGIN_GATE, REIT_PRIOR, ROWS, SECTOR_PRIOR } from "../deliverables/20261003/comps-c5/field.mjs";
import { conclusion6, scorePeers, columnDistances, COLUMNS, CP1_ALL, CP1_NONE, CP1_OUT_ON, CUT, CUT2, CONSIST_MIN, INFLUENCE, NO_PEER_SET, PRICE_ON_LINES, VOTES } from "../deliverables/20261005/comps-c6/outliers.mjs";
import { referenceOf, withReference, REFERENCE_JOB, REFERENCE_TABLES } from "../deliverables/20261003/comps-c5/reference.mjs";

const here = (p) => new URL(p, import.meta.url), J = (p) => JSON.parse(readFileSync(here(p), "utf8"));
const C6 = (t) => J(`../deliverables/20261005/comps-c6/set-${t}-2026-10-05.json`);
const FX = (t) => { const f = J(`../deliverables/20261006/decision-cards/data/fixtures/set-${t}-cp1-2026-10-06.json`); return { ...f, after: f.after === "same as before" ? f.before : f.after }; };
const SEG = J("../deliverables/20261003/comps-c5/segments-2026-10-03.json").companies;
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const run = (f, which, fx) => conclusion6(f[which].snap, [], f[which].estimates, f.today, "C", { set: which === "before" ? f.set_before : f.set_after, fx });
const upside = (C) => (C.band ? (C.band.mid / C.price - 1) * 100 : null);

/* ---- nothing changes until the switch is thrown ------------------------------------------------------------ */
test("off is off: the default is every switch off, and with them off the lines, the sets and the price answer exactly as C5 / C6b did", () => {
  assert.equal(CP1_DEFAULT, CP1_LINES_OFF, "the one line that takes the line fixes live still says OFF");
  assert.ok(Object.values(CP1_LINES_OFF).every((v) => v === false) && Object.values(CP1_FIELD_OFF).every((v) => v === false) && Object.values(CP1_NONE).every((v) => v === false));
  assert.ok(Object.values(CP1_ALL).every((v) => v === true) && Object.keys(CP1_ALL).length === 12, "twelve switches in all");
  for (const [t, ind] of [["MU", "Semiconductors"], ["WDC", "Computer Hardware"], ["FORM", "Semiconductors"], ["EQIX", "REIT - Specialty"], ["IRM", "REIT - Specialty"]]) assert.deepEqual(linesOf(t, { industry: ind }, SEG[t] || null), linesOf(t, { industry: ind }, SEG[t] || null, CP1_LINES_OFF), t);
  for (const t of ["MU", "NVDA", "CRWV", "CBRS"]) {
    const f = C6(t), a = conclusion6(f.snapshot, [], f.estimates, f.today, "C", { set: f.set }), b = conclusion6(f.snapshot, [], f.estimates, f.today, "C", { set: f.set, fx: CP1_NONE });
    assert.deepEqual(a.band, b.band, t); assert.deepEqual(a.c6.outliers, b.c6.outliers, t); assert.deepEqual(a.measureWeights.weights, b.measureWeights.weights, t);
    assert.equal(b.c6.noPeerSet, false); assert.equal(b.c6.self, null); assert.equal(b.c6.fragile, null); assert.deepEqual(b.c6.dominating, []);
  }
});
test("the allocation tool imports lines.mjs alone and as it is: the file imports nothing, and the switch line is there once", () => {
  const src = readFileSync(here("../deliverables/20261003/comps-c5/lines.mjs"), "utf8");
  assert.equal(/^\s*import\s/m.test(src), false, "lines.mjs must stay import-free (the knockout fetches this one file)");
  assert.equal(src.split("export const CP1_DEFAULT = CP1_LINES_OFF;").length - 1, 1, "knockout-run.mjs swaps exactly this line");
});

/* ---- 1 · memory and storage are one line; complement, not destroy; reference peers ------------------------------- */
test("memoryStorage: Micron, SanDisk, Western Digital and Seagate share ONE line; FormFactor's probe cards leave it", () => {
  const P = { MU: "Semiconductors", SNDK: "Computer Hardware", WDC: "Computer Hardware", STX: "Computer Hardware" }, L = (t, fx) => linesOf(t, { industry: P[t] }, SEG[t] || null, fx);
  for (const t of Object.keys(P)) assert.deepEqual(L(t, CP1_LINES_ON).lines, { "memory & storage": 1 }, t);
  assert.equal(similarity(L("MU", CP1_LINES_OFF), L("WDC", CP1_LINES_OFF)).exact, 0, "before: memory and storage share nothing");
  assert.equal(similarity(L("MU", CP1_LINES_ON), L("WDC", CP1_LINES_ON)).exact, 1, "after: one line");
  const before = linesOf("FORM", { industry: "Semiconductors" }, SEG.FORM), after = linesOf("FORM", { industry: "Semiconductors" }, SEG.FORM, CP1_LINES_ON);
  assert.ok(before.lines.memory > 0.3 && before.lines.foundry > 0.4, "before: probe-card segments named DRAM, Flash and Foundry read as memory and foundry revenue");
  assert.deepEqual(after.lines, { "semiconductor equipment": 1 }); assert.equal(after.source, "hand"); assert.match(after.from, /probe cards/);
  assert.deepEqual(linesOf("NVDA", { industry: "Semiconductors" }, SEG.NVDA, CP1_LINES_ON).lines, linesOf("NVDA", { industry: "Semiconductors" }, SEG.NVDA).lines, "a name on neither line is untouched");
});
/* a small universe: four memory-and-storage names (Micron with its real DRAM / NAND segments), fourteen chip names, one components name */
const CHIPS = "AMD INTC LRCX AMAT ARM KLAC TXN NVDA ASML QCOM ADI MRVL ON MCHP".split(" ");
const UNI = () => ({ profiles: Object.fromEntries([["MU", ["Semiconductors", 1100]], ["SNDK", ["Computer Hardware", 250]], ["WDC", ["Computer Hardware", 150]], ["STX", ["Computer Hardware", 200]], ["COHR", ["Hardware, Equipment & Parts", 60]], ...CHIPS.map((t, i) => [t, ["Semiconductors", 900 - i * 50]])].map(([t, [industry, cap]]) => [t, { ticker: t, industry, market_cap: cap * 1e9, is_etf: false }])), segments: { MU: SEG.MU }, fmpRows: [], srcRows: [{ ticker: "MU", peer: "SNDK", source: "massive" }, { ticker: "MU", peer: "WDC", source: "massive" }], funds: [{ ticker: "DRAM", holdings: [["MU", 1], ["SNDK", 5], ["WDC", 4], ["STX", 5]], all: [["MU", 1], ["SNDK", 5], ["WDC", 4], ["STX", 5], ["285A.T", 3], ["SKHY", 1]], count: 26 }, { ticker: "SPY", holdings: [["MU", 1], ["STX", 1]], count: 500 }] });
test("complement, not destroy: the kept set stays whole; the same-business names it lacks are added; then the reference peers; it says when the line runs out", () => {
  const inp = UNI(), base = buildSet("MU", inp, { fx: CP1_LINES_OFF }), S = buildSet("MU", inp, { fx: CP1_LINES_ON });
  assert.equal(base.kept.length, N_DEFAULT); assert.deepEqual(S.kept.slice(0, N_DEFAULT).map((r) => r.ticker), base.kept.map((r) => r.ticker), "every peer the method keeps today is still there, in the same order");
  assert.deepEqual(S.base_kept, base.kept.map((r) => r.ticker));
  const added = S.kept.filter((r) => r.added && !r.reference).map((r) => r.ticker), have = new Set(base.kept.map((r) => r.ticker));
  assert.deepEqual([...added].sort(), ["STX", "WDC"].filter((t) => !have.has(t)).sort(), "only the same-business names the kept set lacked are added");
  assert.deepEqual(S.reference, Object.keys(REFERENCE_PEERS), "SK hynix, Samsung and Kioxia are listed");
  for (const r of S.kept.filter((x) => x.reference)) { assert.equal(r.has_figures, false, "no facts file, no figures"); assert.equal(r.same_business, true); assert.match(r.why, /comps-only reference peer, not served on the Hub/); }
  assert.equal(S.same.n, SAME_MIN); assert.equal(S.same.short, null); assert.equal(S.same.line, "memory & storage"); assert.deepEqual([...S.same.pool].sort(), ["SNDK", "STX", "WDC"]);
  assert.ok(S.kept.length <= N_MAX);
  const noRef = buildSet("MU", inp, { fx: { ...CP1_LINES_ON, reference: false } });
  assert.equal(noRef.same.n, 3); assert.match(noRef.same.short, /the Hub serves 3 other companies on the memory & storage line: 3 same-business peers, not 6/);
  const figs = buildSet("MU", { ...inp, reference: { "000660.KS": { market_cap_usd: 3e11 } } }, { fx: CP1_LINES_ON }).kept.find((r) => r.ticker === "000660.KS");
  assert.equal(figs.has_figures, true); near(figs.ratio, 3e11 / 1.1e12, 1e-9);
});
test("a set that already carries six same-business peers gains nothing, and a reference peer joins only a company on the line it is listed for", () => {
  const inp = UNI(), amd = buildSet("AMD", inp, { fx: CP1_LINES_ON });
  assert.deepEqual(amd.added, []); assert.deepEqual(amd.reference, []); assert.equal(amd.kept.length, N_DEFAULT); assert.ok(amd.same.n >= SAME_MIN);
  const cohr = buildSet("COHR", inp, { fx: CP1_LINES_ON });
  assert.deepEqual(cohr.reference, [], "Samsung's hand vector carries 15% electronic components; it is still not a reference peer for a components company");
  for (const r of Object.values(REFERENCE_PEERS)) assert.equal(r.for_line, "memory & storage");
});
test("the four sources vote on every added peer: FMP, Massive, same industry, shared industry fund — an unserved peer's industry is 'not on file', a broad fund never counts", () => {
  const inp = UNI();
  const wdc = votesFor("MU", "WDC", inp); assert.deepEqual([wdc.fmp, wdc.massive, wdc.industry, wdc.fund], [false, true, false, true]); assert.deepEqual(wdc.funds, ["DRAM"]); assert.equal(wdc.n, 2);
  const stx = votesFor("MU", "STX", inp); assert.deepEqual([stx.fmp, stx.massive, stx.industry, stx.fund], [false, false, false, true]); assert.deepEqual(stx.funds, ["DRAM"], "SPY holds both and does not count");
  const hynix = votesFor("MU", "000660.KS", inp, { also: REFERENCE_PEERS["000660.KS"].also }); assert.equal(hynix.industry, null); assert.equal(hynix.fund, true, "the memory fund's file names it under its US line"); assert.match(hynix.words, /industry not on file/);
  const samsung = votesFor("MU", "005930.KS", inp, { also: REFERENCE_PEERS["005930.KS"].also }); assert.equal(samsung.n, 0); assert.equal(samsung.fund, false);
  assert.equal(votesFor("AMD", "INTC", inp).industry, true);
});
test("reference peers are priced from the facts file the C5b job prints, through the Hub's own table rows — and from nothing else", async () => {
  const facts = J("../deliverables/20261003/comps-c5b/fmp-facts-2026-10-03.json");
  assert.deepEqual(referenceOf(null).peers, {}); assert.deepEqual(referenceOf(null).missing, Object.keys(REFERENCE_PEERS));
  const stand = { source: facts.source, taken: facts.taken, fx: facts.fx, companies: { "000660.KS": facts.companies.TSM } };   /* TSMC's facts standing in: a foreign filer the job has already printed */
  const ref = referenceOf(stand); assert.deepEqual(Object.keys(ref.peers), ["000660.KS"]); assert.ok(ref.peers["000660.KS"].market_cap_usd > 0); assert.deepEqual(ref.missing, ["005930.KS", "285A.T"]);
  const asked = []; const pg0 = async (p) => { asked.push(p); return p.startsWith("fx_rates") ? [{ pair: "TWDUSD", date: "2026-10-01", rate: 0.03 }] : [{ ticker: "MU" }]; };
  const pg = withReference(pg0, stand);
  const fund = await pg("fundamentals?select=ticker,price&ticker=in.(MU,000660.KS)"); assert.deepEqual(fund.map((r) => r.ticker), ["MU", "000660.KS"]);
  assert.deepEqual((await pg("fundamentals?select=ticker&ticker=in.(MU)")).map((r) => r.ticker), ["MU"], "not asked for, not added");
  assert.deepEqual(await pg("fundamentals_history?select=ticker&ticker=in.(MU,000660.KS)&limit=1000&offset=1000"), [{ ticker: "MU" }], "a later page never repeats them");
  assert.deepEqual(await pg("ticker_cohorts?select=ticker&ticker=eq.000660.KS"), [{ ticker: "MU" }], "only the figure tables gain rows");
  const fx = await pg("fx_rates?select=pair,date,rate&date=gte.2024-01-01"); assert.equal(fx.filter((r) => r.pair === "TWDUSD").length, 1, "a pair the Hub already carries is not doubled"); assert.ok(fx.length > 1);
  assert.equal(withReference(pg0, null), pg0, "no facts file: the reader is untouched");
  assert.ok(REFERENCE_TABLES.includes("analyst_estimates")); assert.equal(REFERENCE_JOB.script, "scripts/fx-multiples-check.mjs"); assert.ok(existsSync(here("../" + REFERENCE_JOB.script)), "the job exists; nothing new runs on Fly");
});

/* ---- 1b · on the lines Alan named, the same-business peers set the price -------------------------------------- */
test("Micron: +324% on twelve chip names → +99% on SanDisk, Western Digital and Seagate; the whole-set reading stays beside it; adding the peers alone changed almost nothing", () => {
  const f = FX("MU"), B = run(f, "before", CP1_NONE), S = run(f, "after", { ...CP1_NONE }), A = run(f, "after", CP1_ALL);
  near(upside(B), f.expect.before_upside_pct, 0.06, "before"); near(upside(A), f.expect.after_upside_pct, 0.06, "after"); near(A.band.mid, f.expect.after_centre, 0.01);
  assert.ok(upside(S) > 290, "the complemented set, priced by all fourteen: nine chip makers still outvote three memory names");
  assert.equal(A.c6.pricedOn, "business"); assert.deepEqual([...A.c6.businessPeers].sort(), ["SNDK", "STX", "WDC"]); assert.equal(A.c6.business.line, "memory & storage"); assert.equal(A.c6.business.mostlyDifferent, true);
  assert.equal(A.c6.notPriced.length, 11, "the eleven others stay on the page, not priced"); assert.ok(A.c6.wholeSet.bandFromPeers.mid > A.band.mid * 2, "the whole-set reading is kept, and is far above");
  assert.deepEqual(PRICE_ON_LINES, ["memory & storage", "data-centre reit"], "only the lines Alan named the comps of");
  const off = run(f, "after", { ...CP1_ALL, priceOnBusiness: false }); assert.equal(off.c6.pricedOn, undefined); assert.ok(upside(off) > 290);
});

/* ---- 2 · the tighter outlier rule and its neighbours ---------------------------------------------------------- */
const LOG = new Set(ROWS), SHORTS = Object.fromEntries(COLUMNS.map((c) => [c.key, c.short]));
const pack = (key, mid, x) => { const cells = "abcdefghi".split("").map((t, i) => ({ ticker: t, v: mid * (1 + (i - 4) * 0.03) })); cells.push({ ticker: "X", v: x }); return { key, short: SHORTS[key] || key, ...columnDistances(cells, { log: LOG.has(key) }) }; };
const NORMAL = { pe_ttm: 30, pe_fwd: 25, ev_ebitda: 20, ev_sales: 8, ps: 8, peg: 1.5 };
/* the multiple that sits `target` spreads above a nine-peer pack around mid */
const at = (key, target) => { let m = NORMAL[key]; for (let f = 1.02; f < 4; f += 0.004) { const d = pack(key, NORMAL[key], NORMAL[key] * f).cells.X.d; if (d >= target) { m = NORMAL[key] * f; break; } } return m; };
const table = (over) => Object.fromEntries(Object.keys(NORMAL).map((k) => [k, pack(k, NORMAL[k], k in over ? over[k] : NORMAL[k])]));
test("one peer, far on nearly everything: 3 spreads above on four of the five votes is an outlier under the tighter rule and not under C6b; three of five is not; the cuts are the stated ones", () => {
  assert.equal(CUT, 3.5); assert.equal(CUT2, 2.5); assert.equal(CONSIST_MIN, 4); assert.equal(INFLUENCE, 0.1);
  const four = table({ pe_ttm: at("pe_ttm", 3), ev_ebitda: at("ev_ebitda", 3), ev_sales: at("ev_sales", 3), ps: at("ps", 3) });
  for (const k of ["pe_ttm", "ev_ebitda", "ev_sales", "ps"]) assert.ok(four[k].cells.X.d > CUT2 && four[k].cells.X.d < CUT, `${k} sits between the two cuts (${four[k].cells.X.d})`);
  const c6b = scorePeers(four, ["X", "a"]).X; assert.equal(c6b.n, 0); assert.equal(c6b.outlier, false, "C6b: no single multiple reaches 3.5, so nothing");
  const cp1 = scorePeers(four, ["X", "a"], { consistency: true }); assert.equal(cp1.X.outlier, true); assert.equal(cp1.X.consistent, true); assert.equal(cp1.X.side, 4); assert.match(cp1.X.words, /above the group by more than 2\.5 spreads on 4 of 5 multiples/);
  assert.equal(cp1.a.outlier, false, "an ordinary peer is untouched");
  const three = scorePeers(table({ pe_ttm: at("pe_ttm", 3), ev_sales: at("ev_sales", 3), ps: at("ps", 3) }), ["X"], { consistency: true }).X;
  assert.equal(three.side, 3); assert.equal(three.outlier, false, "three of five is 60%: under the three-quarters bar");
  const mixed = scorePeers(table({ pe_ttm: at("pe_ttm", 3), ev_ebitda: at("ev_ebitda", 3), ev_sales: NORMAL.ev_sales / (at("ev_sales", 3) / NORMAL.ev_sales), ps: NORMAL.ps / (at("ps", 3) / NORMAL.ps) }), ["X"], { consistency: true }).X;
  assert.equal(mixed.outlier, false, "two above and two below is not 'far on nearly everything': the votes must sit on one side");
  const wild = scorePeers(table({ pe_ttm: 300, pe_fwd: 180, ev_sales: 70, ps: 70 }), ["X"], { consistency: true }).X; assert.equal(wild.outlier, true); assert.equal(wild.consistent, false, "C6b's own verdict still speaks first"); assert.equal(wild.words, "priced far from the group on 3 of 5 multiples");
  const grower = scorePeers({ ...table({}), rev_g_ttm: pack("rev_g_ttm", 12, 260), rev_g_fy: pack("rev_g_fy", 11, 180) }, ["X"], { consistency: true }).X; assert.equal(grower.outlier, false, "growth still never votes");
});
test("one multiple: Palantir's 120× forward earnings and ARM's two earnings multiples leave their own measures in Broadcom's set; both peers stay; the centre is marked fragile and nobody is cut for it", () => {
  const f = FX("AVGO"), A = run(f, "after", CP1_ALL), B = run(f, "before", CP1_NONE);
  near(upside(B), f.expect.before_upside_pct, 0.06); near(upside(A), f.expect.after_upside_pct, 0.06);
  const cells = A.outliers.filter((o) => o.excluded).map((o) => o.ticker + "|" + o.key).sort();
  assert.deepEqual(cells, ["ARM|pe_fwd", "ARM|pe_ttm", "PLTR|pe_fwd"]); assert.deepEqual(A.c6.outliers, [], "neither is far on enough of the votes to leave the set");
  assert.ok(A.c6.score.PLTR.n === 1 && A.c6.score.ARM.n === 1 && A.c6.score.ARM.side === 3);
  assert.equal(A.c6.fragile.n, 7); assert.equal(A.c6.fragile.of, 12); assert.match(A.c6.fragile.words, /it sits in a gap of the field/); assert.deepEqual(A.c6.dominating, []);
  assert.deepEqual(B.outliers.filter((o) => o.excluded), [], "C6b as it stands drops no cell");
});
test("the neighbours hold: C6b's verdict on Nvidia's set is unchanged (ARM, by the rule), the operator's KEEP still wins, and a pivot peer with ordinary multiples is never cut", () => {
  const f = C6("NVDA"), base = conclusion6(f.snapshot, [], f.estimates, f.today, "C", { set: f.set }), on = conclusion6(f.snapshot, [], f.estimates, f.today, "C", { set: f.set, fx: { ...CP1_OUT_ON } });
  assert.deepEqual(base.c6.outliers, ["ARM"]); assert.deepEqual(on.c6.byRule, ["ARM"]); assert.equal(on.c6.score.ARM.consistent, false);
  const keep = [{ company: "NVDA", peer: "ARM", measure: "ALL", off: false, reason: "keep", set_by: "operator", set_at: "2026-10-06T12:00:00.000Z" }];
  const kept = conclusion6(f.snapshot, keep, f.estimates, f.today, "C", { set: f.set, fx: { ...CP1_OUT_ON } }); assert.deepEqual(kept.c6.outliers, []); assert.deepEqual(kept.c6.kept, ["ARM"]);
  for (const d of on.c6.dominating) assert.ok(on.c6.score[d.ticker].n >= 1 || on.c6.score[d.ticker].side >= 2, "a dominating peer is influential AND unusual");
  const mu = C6("MU"), m = conclusion6(mu.snapshot, [], mu.estimates, mu.today, "C", { set: mu.set, fx: { ...CP1_OUT_ON, priceOnBusiness: false } });
  assert.deepEqual(m.c6.notCut.filter((t) => !m.c6.business.same.includes(t)), [], "C6b 4: in a mostly-different-business set only the peers that share the business are shielded");
});

/* ---- 3 · growth credit ----------------------------------------------------------------------------------- */
test("growth credit: the PEG row's prior is multiplied by the company's forward EPS growth over its peers', never under 1, never over 3; a slower grower is untouched", () => {
  assert.equal(GROWTH_CREDIT_MAX, 3);
  const f = FX("VST"), off = run(f, "after", CP1_NONE), on = run(f, "after", { ...CP1_NONE, growthCredit: true }), g = on.cp1.growth;
  assert.ok(g.own > g.peers && g.ratio > 2 && g.ratio < 3); near(g.credit, g.ratio, 1e-12); near(on.measureWeights.parts.peg.prior, off.measureWeights.parts.peg.prior * g.credit, 1e-9);
  assert.ok(on.measureWeights.weights.peg > off.measureWeights.weights.peg); near(Object.values(on.measureWeights.weights).reduce((a, b) => a + b, 0), 1, 1e-9, "the weights still add to one");
  assert.ok(upside(on) > upside(off), "Vistra's PEG is under its peers', so more weight on it lifts the centre");
  const be = FX("BE"), b = run(be, "after", { ...CP1_NONE, growthCredit: true }); assert.equal(b.cp1.growth.credit, GROWTH_CREDIT_MAX, "capped"); assert.ok(b.cp1.growth.ratio > 3);
  const go = FX("GOOGL"), x = run(go, "after", { ...CP1_NONE, growthCredit: true }); assert.equal(x.cp1.growth.credit, 1); assert.deepEqual(x.measureWeights.weights, run(go, "after", CP1_NONE).measureWeights.weights, "a company growing slower than its peers: nothing changes");
});

/* ---- 4 · property trusts ------------------------------------------------------------------------------------ */
test("the data-centre landlords are one line and price each other; a property trust is weighed on P/FFO and EV/EBITDA, hardly on earnings", () => {
  for (const t of ["EQIX", "DLR", "IRM"]) assert.deepEqual(linesOf(t, { industry: "REIT - Specialty" }, SEG[t] || null, CP1_LINES_ON).lines, { "data-centre reit": 1 }, t);
  assert.match(linesOf("IRM", { industry: "REIT - Specialty" }, SEG.IRM, CP1_LINES_ON).from, /13% data centres, 87% records storage/, "Iron Mountain's seat says what it is");
  assert.deepEqual(linesOf("AMT", { industry: "REIT - Specialty" }, SEG.AMT, CP1_LINES_ON).lines, { "specialty reit": 1 }, "a tower company is not a data-centre landlord");
  const f = FX("EQIX"), B = run(f, "before", CP1_NONE), A = run(f, "after", CP1_ALL);
  assert.equal(isReit(f.after.snap), true); assert.equal(B.rows.some((r) => r.key === "p_ffo"), false); assert.equal(A.cp1.reit, true);
  const ffo = A.rows.find((r) => r.key === "p_ffo"); assert.ok(ffo && ffo.ok && ffo.own.multiple > 20 && ffo.own.multiple < 35, "Equinix on about 27 times funds from operations"); assert.match(ffo.basis, /approximated/);
  assert.equal(isValuation("p_ffo"), true); assert.equal(ROWS.includes("p_ffo"), false, "C5's six rows are still six: the seventh exists only for a property trust");
  const w = A.measureWeights.weights; assert.ok(w.p_ffo > 0.25 && w.ev_ebitda > 0.25 && w.pe_ttm + w.pe_fwd < 0.15, JSON.stringify(w)); near(Object.values(w).reduce((a, b) => a + b, 0), 1, 1e-9);
  assert.ok(REIT_PRIOR.p_ffo > REIT_PRIOR.ev_ebitda && REIT_PRIOR.pe_ttm < 0.5 && !("reit" in SECTOR_PRIOR), "the reit table is CP1's own and replaces nothing");
  assert.equal(A.c6.pricedOn, "business"); assert.deepEqual([...A.c6.businessPeers].sort(), ["DLR", "IRM"]);
  near(upside(B), f.expect.before_upside_pct, 0.06); near(upside(A), f.expect.after_upside_pct, 0.06);
  assert.equal(isReit(FX("MU").after.snap), false); assert.equal(run(FX("MU"), "after", CP1_ALL).rows.some((r) => r.key === "p_ffo"), false);
});

/* ---- 5 · the margin gate --------------------------------------------------------------------------------------- */
test("margin gate: Alphabet's margin is 2.5 times its peers', so EV/sales and P/S leave the price (weight 0, the rows still there, the reason on them); a loss-maker keeps them", () => {
  assert.equal(MARGIN_GATE, 2);
  const f = FX("GOOGL"), off = run(f, "after", CP1_NONE), on = run(f, "after", { ...CP1_NONE, marginGate: true }), m = on.cp1.margin;
  assert.ok(m.ratio > 2 && m.off === true); assert.equal(on.measureWeights.weights.ev_sales, 0); assert.equal(on.measureWeights.weights.ps, 0);
  assert.match(on.measureWeights.parts.ev_sales.off, /more than 2× apart/); assert.ok(on.rows.find((r) => r.key === "ev_sales").ok, "the row is still drawn");
  near(Object.values(on.measureWeights.weights).reduce((a, b) => a + b, 0), 1, 1e-9); assert.ok(off.measureWeights.weights.ev_sales > 0.15);
  assert.ok(upside(off) < -30 && upside(on) > 0, `Alphabet ${upside(off).toFixed(0)}% → ${upside(on).toFixed(0)}%`);
  const snap = f.after.snap, peers = snap.members.filter((t) => t !== snap.ticker), loss = { ...snap, table: { ...snap.table, company: { ...snap.table.company, om: -12 } } };
  const adj = fieldAdjust(loss, snap.rows, peers, CP1_FIELD_ON); assert.equal(adj.margin.off, false); assert.match(adj.margin.why, /runs at a loss: the sales rows stay/); assert.ok(!(adj.adj && adj.adj.off.ev_sales), "nothing is switched off for a loss-maker");
  const near2 = fieldAdjust({ ...snap, table: { ...snap.table, company: { ...snap.table.company, om: adj.margin.peers * 1.9 } } }, snap.rows, peers, CP1_FIELD_ON); assert.equal(near2.margin.off, false, "1.9 times is inside the gate");
});

/* ---- 6 · no peer set ---------------------------------------------------------------------------------------- */
test("no peer set: Bloom is itself far from its peers on three of five price votes, so the card shows no number — and keeps what the peers would have said beside it", () => {
  const f = FX("BE"), B = run(f, "before", CP1_NONE), A = run(f, "after", CP1_ALL);
  assert.ok(B.band && upside(B) < -75, "before: a number, and a meaningless one"); near(upside(B), f.expect.before_upside_pct, 0.06);
  assert.equal(A.band, null); assert.equal(A.upside, null); assert.equal(A.reason, NO_PEER_SET); assert.equal(NO_PEER_SET, "no peer set — valued on growth (PEG) and estimates");
  assert.equal(A.c6.noPeerSet, true); assert.equal(A.c6.self.outlier, true); assert.equal(A.c6.self.n, 3); assert.equal(A.c6.self.have, 5); assert.match(A.c6.self.words, /BE itself is priced far from this group on 3 of 5 multiples/);
  assert.ok(A.c6.bandFromPeers && A.c6.bandFromPeers.mid > 0 && A.c6.bandFromPeers.mid < A.price / 3, "the peers' reading is kept, greyed, not used");
  for (const t of ["MU", "EQIX", "GOOGL", "AVGO", "VST"]) assert.equal(run(FX(t), "after", CP1_ALL).c6.noPeerSet, false, t);
});

/* ---- the report and the card records ---------------------------------------------------------------------- */
const DIR = "../deliverables/20261006/decision-cards/";
test("the cards: one record per name with the facts and the levels; the plan is Alan's — blank everywhere, and on Micron only what he said", () => {
  const cards = J(DIR + "data/cards.json").cards, names = Object.keys(cards);
  assert.equal(names.length, 26); assert.deepEqual(names.slice(0, 2), ["MU", "SNDK"]);
  for (const t of "WDC SNDK AVGO GOOGL AMZN VST NBIS BE IREN EQIX DLR IRM LRCX CRDO COHR".split(" ")) assert.ok(cards[t], t + " has a card");
  for (const [t, c] of Object.entries(cards)) {
    for (const k of ["core_or_conviction", "entry_levels", "size_by_risk", "exit_trim_rule"]) assert.equal(c.plan[k], null, `${t}.${k} is left for Alan`);
    assert.ok(c.price > 0 && c.risk.x_spy > 1 && c.technicals.sma21 > 0, t); assert.match(c.price_is, /^session close 2026-10-06$/, t);
    if (c.comps.priced_on === "none") assert.equal(c.comps.centre, null, t); else assert.ok(c.comps.low <= c.comps.centre && c.comps.centre <= c.comps.high, t);
    for (const l of [...c.technicals.lines_below, ...c.technicals.lines_above]) assert.match(l.label, /^(1D|3D|1W|2W) \S/, `${t}: a line is named with its timeframe (${l.label})`);
  }
  assert.equal(Object.values(cards).filter((c) => c.plan.given).length, 1); const mu = cards.MU;
  assert.match(mu.plan.given.buy_zone, /below 1,000 down to ~920 \(his drawn box 920–966\)/); assert.match(mu.plan.given.stop, /below ~900/); assert.match(mu.plan.given.entries, /first part at the 21-day \(~1,028\) · second at the 50-day/);
  near(mu.technicals.sma21, 1028.24, 0.01); near(mu.technicals.sma50, 961.81, 0.01); near(mu.technicals.sma100, 959.57, 0.01); assert.deepEqual(mu.parents, ["DRAM", "SMH"]);
  near(mu.risk.x_spy, 6.9, 0.06); near(mu.risk.risk_equal_share, 1 / mu.risk.x_spy, 1e-9); assert.deepEqual(mu.technicals.lines_below.map((l) => l.label), ["3D P1", "2W D3", "3D P3"]);
  assert.deepEqual(mu.comps.peers_priced, ["SNDK", "WDC", "STX"]); assert.equal(cards.BE.comps.priced_on, "none"); assert.deepEqual([...cards.EQIX.comps.peers_priced].sort(), ["DLR", "IRM"]);
});
test("the page: pictures first, every sentence in PAGE SPECS, the way back, no instruction to buy or sell, the lines named as the Lab names them", () => {
  const html = readFileSync(here(DIR + "DECISION-CARDS.html"), "utf8"), cards = J(DIR + "data/cards.json").cards;
  assert.equal(html.split('<article class="card').length - 1, 26); assert.ok(html.indexOf('id="card-MU"') < html.indexOf('id="card-SNDK"') && html.indexOf('id="card-SNDK"') < html.indexOf('id="card-WDC"'), "Micron first, SanDisk beside it");
  const specs = html.indexOf('<details class="sc-pagespecs"><summary>PAGE SPECS</summary>'); assert.ok(specs > 0);
  assert.equal(html.slice(0, specs).includes("<p>"), false, "no paragraph outside PAGE SPECS"); assert.ok(html.slice(specs).split("<p>").length > 12);
  assert.ok(html.includes("<!-- scnav ·") && html.includes("<!-- /scnav -->") && html.includes("data-scnav-slot"), "the BACK / CLOSE pair");
  const text = html.replace(/<style[\s\S]*?<\/style>/g, " ").replace(/<[^>]+>/g, " ");
  assert.equal(/\b(buy now|sell now|you should (buy|sell)|we recommend (buying|selling)|is a (buy|sell)\b)/i.test(text), false);
  for (const l of ["3D P1", "2W D3", "3D P3", "3D C3", "3D D2", "3D D1", "1D D3"]) assert.ok(html.includes(l), l);
  assert.equal(/>\s*(P|C|D|B)[1-6]\s*</.test(html), false, "never a bare P1");
  assert.ok(html.includes("$" + Math.round(cards.MU.comps.centre).toLocaleString("en-US")) && html.includes("NO PEER SET — VALUED ON GROWTH (PEG) AND ESTIMATES"));
  assert.ok(html.includes("fx-multiples-check.mjs 000660.KS 005930.KS 285A.T SKHY"), "the one command for the reference peers is on the page");
  for (const c of html.match(/#[0-9a-fA-F]{6}\b/g) || []) { const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)); assert.ok(Math.max(r, g, b) <= 210, `${c}: no channel above 210`); }
  const shots = J(DIR + "shots/shots-facts.json");
  for (const w of ["1680", "390"]) { assert.equal(shots[w].sideways, false, w + ": no sideways scroll"); assert.deepEqual(shots[w].page_errors, []); assert.ok(shots[w].smallest_font_px >= 11 && shots[w].smallest_drawn_svg_text_px >= 11, w + ": text is 11px or more as drawn"); assert.equal(shots[w].cards, 26); assert.equal(shots[w].scnav, true); }
});
