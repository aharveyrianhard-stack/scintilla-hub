/* CP2 (7 Oct 2026) · the CARDS tab of the company view: the decision card with the business in pies.
   business.mjs    the pies, the chips, the cash rule, the data-centre rule, the blend
   card-parts.mjs  the zones nearest first, the estimates flag line
   tab.mjs         the card as HTML, the file reader and the table reader behind its switch
   index.html      the tab in the row, its key, the switch off
   Every figure is checked against the dated FMP facts beside the page; nothing here reaches the network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { RULES, DC_WORD, DC_HAND, plainLabel, pie, period, margins, freeCashFlow, dcLabelsFor, dataCentre, blend, businessOf, notItsYardstick } from "../deliverables/20261007/cards-tab/business.mjs";
import { zonesNearestFirst, flagLine, sideBySide, THIN_BELOW } from "../deliverables/20261007/cards-tab/card-parts.mjs";
import { CARDS_URL, TABLE_PATH, NARROW_BELOW, WIDE_FROM, money, pctPlain, cents, wedgePath, sliceClasses, cardHTML, flagHTML, zoneRowHTML, footballSVG, newestPerName, mountCardsTab, mountEstimatesFlag, dcTitle, cashTitle, blendTitles, CSS } from "../deliverables/20261007/cards-tab/tab.mjs";

const here = (p) => new URL(p, import.meta.url);
const J = (p) => JSON.parse(readFileSync(here(p), "utf8"));
const D = "../deliverables/20261007/cards-tab/";
const FACTS = J(D + "data/business-facts-fmp-2026-10-07.json").companies;
const STATED = J(D + "data/data-centre-stated.json").companies;
const ZONES = J(D + "data/zones-cz1-2026-10-06.json");
const FLAGS = J(D + "data/estimates-flags-er1-2026-10-06.json");
const DOC = J(D + "data/cards.json"), CARDS = DOC.cards;
const CP1 = J("../deliverables/20261006/decision-cards/data/cards.json").cards;
const page = readFileSync(here("../index.html"), "utf8");
const B = (t) => businessOf(t, FACTS[t], STATED[t] && STATED[t].share != null ? STATED[t] : undefined);
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || "") + " " + a + " vs " + b);

/* ------------------------------------------------------------------ the pies */
test("labels are in plain words, and FMP's own label is kept beside them", () => {
  assert.equal(plainLabel("product", "Cloud", "WDC"), "Data centre (cloud customers)");
  assert.equal(plainLabel("product", "Datacenter", "SNDK"), "Data centre");
  assert.equal(plainLabel("geo", "TAIWAN, PROVINCE OF CHINA", "MU"), "Taiwan");
  assert.equal(plainLabel("geo", "KOREA, REPUBLIC OF", "LRCX"), "South Korea");
  assert.equal(plainLabel("geo", "Europe Middle East And Africa", "WDC"), "Europe, Middle East & Africa");
  assert.equal(plainLabel("geo", "BRAZIL", "XXXX"), "Brazil", "a name with no table entry: capitals tidied");
  assert.equal(plainLabel("product", "Widgets Segment", "XXXX"), "Widgets");
  const p = B("WDC").lines;
  assert.deepEqual(p.slices.map((s) => [s.label, s.fmp]), [["Data centre (cloud customers)", "Cloud"], ["PCs and devices", "Client Devices"], ["Retail (consumer drives)", "Retail Products"]]);
  for (const t of Object.keys(CARDS)) for (const k of ["lines", "regions"]) for (const s of ((CARDS[t].business[k] || {}).slices || [])) {
    assert.ok(s.label && s.fmp, t + " " + k + ": every slice has a plain label and FMP's label");
    assert.ok(!/\b(Segment|PROVINCE OF)\b/.test(s.label), t + ": '" + s.label + "' is plain");
  }
});

test("a pie is FMP's newest fiscal-year split: negative rows out, shares of what it adds to, the data-centre slice first, six slices at most", () => {
  const g = B("GOOGL").lines;
  assert.ok(g.dropped.includes("Hedging gains (losses)"), "Alphabet's negative hedging row is dropped");
  near(g.slices.reduce((s, x) => s + x.share, 0), 100, 0.3, "shares add to 100");
  assert.equal(g.slices[0].fmp, "Google Cloud", "the data-centre slice leads whatever its size");
  assert.ok(g.slices[0].dc && !g.slices[1].dc);
  const m = B("MU").regions;
  assert.equal(m.slices.length, RULES.slicesMax);
  assert.match(m.slices[5].label, /^Other \(3 smaller\)$/);
  assert.equal(m.slices[5].fmp, "JAPAN + Europe + Other Foreign Countries");
  near(m.slices.reduce((s, x) => s + x.revenue, 0), m.total, 1, "folding loses no revenue");
  for (const t of Object.keys(FACTS)) for (const k of ["lines", "regions"]) { const p = B(t)[k]; if (p) { assert.ok(p.slices.length <= RULES.slicesMax, t); assert.ok(p.slices.every((s) => s.revenue > 0), t + ": no negative slice"); } }
});

test("a pie says when it is not the whole year or not the newest year", () => {
  const w = B("WDC");
  assert.equal(w.lines.partial, false); assert.equal(w.lines.covers_pct, 100);
  assert.equal(w.regions.partial, true, "FMP's regions for Western Digital add to 92% of the year's revenue");
  assert.equal(w.regions.covers_pct, 92);
  const m = B("MU");
  assert.equal(m.lines.fy, 2025); assert.equal(m.lines.behind, true, "Micron's split is fiscal 2025 while its statements are fiscal 2026");
  assert.equal(m.lines.newest_fy, 2026);
  assert.equal(B("SNDK").lines.behind, false);
  assert.equal(B("STX").lines, null, "FMP carries no business split for Seagate");
  assert.equal(B("BE").regions, null);
});

/* ------------------------------------------------------------------ the period, the margins, the cash */
test("the twelve months: the fiscal-year statement when the year has just ended, otherwise four quarters added", () => {
  const w = B("WDC").period;
  assert.equal(w.basis, "fy"); assert.equal(w.end, "2026-07-03"); assert.equal(w.revenue, 12919000000);
  const n = B("NVDA").period, q = FACTS.NVDA.income_q.slice(0, 4);
  assert.equal(n.basis, "q4"); assert.equal(n.end, q[0].date);
  assert.equal(n.revenue, q.reduce((s, r) => s + r.revenue, 0));
  assert.ok(n.revenue > FACTS.NVDA.income[0].revenue, "the four quarters are newer than Nvidia's January fiscal year");
  const broken = period(FACTS.NVDA.income, FACTS.NVDA.income_q.slice(0, 3));
  assert.equal(broken.basis, "fy_older", "fewer than four quarters: the fiscal year, marked older");
  const gap = period(FACTS.NVDA.income, [FACTS.NVDA.income_q[0], FACTS.NVDA.income_q[2], FACTS.NVDA.income_q[3], FACTS.NVDA.income_q[4]]);
  assert.equal(gap.basis, "fy_older", "a missing quarter in the run is not four consecutive quarters");
  assert.equal(period([], []), null);
});

test("margins are the period's own; a bank and a landlord carry none", () => {
  const w = B("WDC");
  near(w.margins.gross, 48.9, 0.05); near(w.margins.operating, 34.5, 0.05);
  near(B("SNDK").margins.gross, 71.5, 0.05);
  near(B("MU").margins.gross, 80.7, 0.05); near(B("STX").margins.gross, 45.6, 0.05);
  for (const t of ["JPM", "BAC"]) { const b = B(t); assert.equal(b.margins.gross, null); assert.match(b.margins.why, /bank/); assert.equal(b.cash.fcf, null); assert.match(b.cash.why, /bank/); assert.ok(b.lines, t + " keeps its pies"); }
  for (const t of ["EQIX", "DLR", "IRM"]) { const b = B(t); assert.equal(b.margins.gross, null); assert.match(b.margins.why, /landlord/); assert.equal(b.cash.fcf, null); assert.ok(b.data_centre.share != null, t + " keeps its data-centre share"); }
  assert.equal(notItsYardstick({ industry: "Semiconductors", sector: "Technology" }), null);
});

test("free cash flow: the fiscal-year statement for the same twelve months, unless its capital-spending line is not there yet", () => {
  const w = B("WDC").cash;
  assert.equal(w.basis, "fy"); assert.equal(w.fcf, 3511000000); assert.equal(w.ocf, 3929000000); assert.equal(w.capex, -418000000);
  assert.equal(w.other.basis, "q4"); assert.equal(w.other.fcf, 3221000000);
  assert.equal(w.differs, true, "FMP's full-year statement and its four quarters differ by more than 5% for Western Digital");
  near(w.differs_pct, -8.3, 0.1);
  const m = B("MU").cash;
  assert.equal(FACTS.MU.cash[0].investmentsInPropertyPlantAndEquipment, 0, "the fact this rule rests on: Micron's fiscal-year row has an empty property-and-equipment line");
  assert.equal(m.basis, "q4", "so the four quarters are used");
  assert.equal(m.fcf, 52908000000); assert.equal(m.capex, -36767000000);
  assert.equal(m.other.ok, false); assert.match(m.other.bad, /no property-and-equipment line/);
  assert.equal(m.other.fcf, 58963000000); assert.equal(m.differs, true);
  const s = B("SNDK").cash;
  assert.equal(s.fcf, 11494000000); assert.equal(s.differs, false);
});

test("free cash flow: a quarter that files capital spending as a positive number is not added", () => {
  const x = B("STX").cash, slip = FACTS.STX.cash_q.slice(0, 4).filter((r) => r.capitalExpenditure > 0);
  assert.equal(slip.length, 1, "the fact this rule rests on: one of Seagate's four quarters has capital spending with the wrong sign");
  assert.equal(x.basis, "fy"); assert.equal(x.fcf, 3105000000);
  assert.equal(x.other.ok, false); assert.match(x.other.bad, /positive number/);
  /* the same slip with no fiscal-year statement for those twelve months: no figure is formed from the quarters */
  const only = freeCashFlow([], FACTS.STX.cash_q, B("STX").period, FACTS.STX.profile);
  assert.equal(only.fcf, null); assert.match(only.why, /positive number/);
});

test("free cash flow: newer quarters win over an older fiscal year; no capital-spending line, no figure", () => {
  const g = B("GOOGL").cash;
  assert.equal(g.basis, "q4"); assert.equal(g.end, "2026-06-30"); assert.equal(g.older, false);
  near(g.fcf, FACTS.GOOGL.cash_ttm.freeCashFlow, 1, "the four quarters added equal FMP's own trailing figure");
  assert.ok(Math.abs(g.fcf - FACTS.GOOGL.cash[0].freeCashFlow) > 1e9, "and differ from the December fiscal year");
  const none = freeCashFlow([{ date: "2025-12-31", fiscalYear: "2025", netCashProvidedByOperatingActivities: 5e9, capitalExpenditure: 0, investmentsInPropertyPlantAndEquipment: 0, freeCashFlow: 5e9 }], [], null, { industry: "Software", sector: "Technology" });
  assert.equal(none.fcf, null); assert.match(none.why, /no capital-spending line/);
  /* the margin is over the revenue of the same twelve months as the cash */
  const w = B("WDC"); near(w.cash.margin, (3511 / 12919) * 100, 0.06);
  near(w.cash.yield, (3511000000 / FACTS.WDC.profile.marketCap) * 100, 0.006);
});

/* ------------------------------------------------------------------ the data-centre share and the blend */
test("data-centre share: FMP's own data-centre line, the hand list with its reason, or the company's own words marked approximate", () => {
  assert.ok(DC_WORD.test("Datacenter") && DC_WORD.test("Data Center") && DC_WORD.test("Global Data Centre Business") && !DC_WORD.test("Cloud"));
  const w = B("WDC").data_centre;
  assert.equal(w.share, 88.9); assert.equal(w.basis, "hand"); assert.deepEqual(w.counts, ["Cloud"]); assert.match(w.why, /data centres/);
  const s = B("SNDK").data_centre;
  assert.equal(s.share, 25.4); assert.equal(s.basis, "segments"); assert.deepEqual(s.counts, ["Datacenter"]); assert.equal(s.approx, false);
  assert.equal(B("NVDA").data_centre.share, 89.7);
  const m = B("MU").data_centre;
  assert.equal(m.basis, "stated"); assert.equal(m.approx, true); assert.equal(m.share, 60);
  assert.equal(m.quote, "The AEBU and MCBU businesses — both non-data center — are almost 40% of our company revenue.");
  assert.match(m.call, /^Q3 FY2026 call, 24 Jun 2026$/);
  const x = B("STX").data_centre;
  assert.equal(x.basis, "stated"); assert.equal(x.share, 80); assert.match(x.quote, /80% of revenue/);
  const a = B("AVGO").data_centre; assert.equal(a.share, null); assert.match(a.why, /not split out/);
  assert.equal(B("EQIX").data_centre.share, 100); assert.equal(B("EQIX").data_centre.basis, "hand");
  assert.match(B("COHR").data_centre.note, /more than data centre/, "Coherent's line is data centre AND communications: said, not hidden");
  assert.equal(B("LLY").data_centre.share, null);
  for (const [t, h] of Object.entries(DC_HAND)) assert.ok(h.why && h.why.length > 20, t + ": every hand entry says why");
  /* the stated sentences are copied from the stored calls, not typed */
  for (const t of ["MU", "STX"]) { assert.ok(STATED[t].quote.length > 40 && STATED[t].call && STATED[t].covers, t); assert.ok(Array.isArray(STATED[t].earlier) && STATED[t].earlier.length >= 1); }
});

test("the blend, per dollar of stock, for the four names Alan asked about", () => {
  const want = { WDC: [3.96, 2.48, false], SNDK: [1.5, 4.67, false], MU: [5.46, 4.48, true], STX: [2.46, 1.72, true] };
  for (const [t, [dc, cash, approx]] of Object.entries(want)) {
    const b = B(t), bl = b.blend;
    near(bl.dc_profit_per_dollar, dc, 0.011, t + " data-centre profit per dollar");
    near(bl.cash_per_dollar, cash, 0.011, t + " cash per dollar");
    assert.equal(bl.approx, approx, t);
    /* the arithmetic, written out: share × revenue × gross margin ÷ market value, in cents */
    near(bl.dc_profit_per_dollar, (b.data_centre.share / 100) * b.period.revenue * (b.margins.gross / 100) / b.market_value * 100, 0.006, t + " formula");
    near(bl.cash_per_dollar, (b.cash.fcf / b.market_value) * 100, 0.006, t + " cash formula");
    assert.equal(bl.cash_per_dollar, b.cash.yield, t + ": cash per dollar of stock is the free-cash-flow yield");
    assert.deepEqual(CARDS[t].business.blend, bl, t + ": the card on file carries these figures");
  }
  /* Western Digital has the bigger data-centre share, SanDisk the fatter margin: the blend puts them on one yardstick */
  assert.ok(B("WDC").data_centre.share > B("SNDK").data_centre.share && B("SNDK").margins.gross > B("WDC").margins.gross);
  assert.ok(B("WDC").blend.dc_profit_per_dollar > B("SNDK").blend.dc_profit_per_dollar && B("SNDK").blend.cash_per_dollar > B("WDC").blend.cash_per_dollar);
});

test("the blend forms no figure across two currencies, and none where a part is missing", () => {
  const per = { basis: "fy", end: "2025-12-31", fy: 2025, currency: "CNY", revenue: 100e9, gross_profit: 40e9, operating_income: 20e9 };
  const b = blend({ share: 50, approx: false }, per, { gross: 40, operating: 20, why: null }, { fcf: 10e9 }, { marketCap: 200e9, currency: "USD" });
  assert.equal(b.dc_profit_per_dollar, null); assert.equal(b.cash_per_dollar, null); assert.match(b.why_dc, /same currency/);
  const jpm = B("JPM").blend; assert.equal(jpm.dc_profit_per_dollar, null); assert.equal(jpm.cash_per_dollar, null);
  const avgo = B("AVGO").blend; assert.equal(avgo.dc_profit_per_dollar, null); assert.ok(avgo.cash_per_dollar != null, "Broadcom: no data-centre figure, but its cash per dollar stands");
  const mv = blend({ share: 50 }, per, { gross: 40 }, { fcf: 1 }, { marketCap: null, currency: "CNY" });
  assert.match(mv.why_dc, /no market value/);
});

test("the market value is at the card's own close", () => {
  for (const t of Object.keys(CARDS)) near(FACTS[t].profile.price, CARDS[t].price, 0.011, t + ": FMP's profile price is the card's 6 Oct close");
});

/* ------------------------------------------------------------------ the zones and the flag line */
test("the levels are CZ1's zones, nearest to the price first, members by the Lab's labels exactly", () => {
  const z = zonesNearestFirst(ZONES.names.MU);
  assert.equal(z.length, 8);
  assert.deepEqual(z.map((x) => Math.abs(x.d)), [...z.map((x) => Math.abs(x.d))].sort((a, b) => a - b), "nearest first");
  assert.deepEqual(z[0].members.map((m) => m.label), ["1D C3", "1D T80.U"]);
  assert.deepEqual(z[1].members.map((m) => m.label), ["3D P1", "2W D3", "21-day"], "the zone Alan named: the 21-day, the 2W D3 and the 3D P1");
  assert.deepEqual(z.find((x) => x.lo === 959.57).members.map((m) => m.label), ["50-day", "100-day"]);
  const labels = new Set(z.flatMap((x) => x.members.map((m) => m.label)));
  for (const l of ["3D B4 · near 1W/2W", "2W P1 / 1W P1", "1D T80.U"]) assert.ok(labels.has(l), "the Lab's label '" + l + "' is carried whole");
  for (const [t, c] of Object.entries(CARDS)) {
    if (!c.zones) { assert.ok(ZONES.without.includes(t), t + ": no zones only where CZ1 has none"); continue; }
    const src = new Map(ZONES.names[t].zones.flatMap((x) => x.members.map((m) => [m.label + "|" + m.v, true])));
    for (const x of c.zones.list) for (const m of x.members) assert.ok(src.has(m.label + "|" + m.v), t + ": " + m.label + " " + m.v + " is CZ1's, unchanged");
    assert.equal(c.zones.list.length, ZONES.names[t].zones.length, t + ": every zone, none added");
    near(c.zones.price, c.price, 0.011, t + ": the zones were measured from the card's close");
  }
  assert.equal(Object.values(CARDS).filter((c) => c.zones).length, 12);
});

test("the estimates flag line: one-off, guidance, thin — in that order, in plain words", () => {
  const g = flagLine(FLAGS.names.GOOGL);
  assert.deepEqual(g.chips.map((c) => [c.word, c.tone]), [["ONE-OFF IN THIS YEAR", "warn"], ["NO EPS GUIDANCE", "quiet"], ["41 ANALYSTS", "quiet"]]);
  const txt = (p) => p.bits.map((b) => (b.dot ? "·" : b.t != null ? b.t : Math.round(b.pct) + "%")).join(" ");
  assert.equal(txt(g.parts[0]), "FY2026 EPS 20.61 holds ~8.92 a share of one-off gains · clean 11.69 · FY2027 15.15 = 30% on the clean base, -26% as shown");
  assert.equal(txt(g.parts[1]), "the company gives no EPS number");
  const w = flagLine(FLAGS.names.WDC);
  assert.deepEqual(w.chips.map((c) => c.word), ["ONE-OFF GAIN LEFT OUT", "IN LINE WITH GUIDANCE", "12 ANALYSTS"]);
  assert.equal(w.chips[1].tone, "ok");
  assert.equal(txt(w.parts[0]), "next quarter · analysts 4.07 against the company's 4.00 ± 0.15 · FY2027 20.39 needs 5.44 a quarter after that");
  assert.deepEqual(flagLine(FLAGS.names.STX).chips.map((c) => c.word), ["NO ONE-OFF", "IN LINE WITH GUIDANCE", "12 ANALYSTS"]);
  assert.ok(flagLine(FLAGS.names.MU).chips.some((c) => c.word === "REVISIONS NOT COMPARABLE" && c.tone === "quiet"));
  const thin = flagLine({ ...FLAGS.names.STX, fy1_n: THIN_BELOW - 1, guide_verdict: "ABOVE GUIDE", flags: [{ code: "WIDE" }] });
  assert.deepEqual(thin.chips.map((c) => [c.word, c.tone]), [["NO ONE-OFF", "quiet"], ["ABOVE GUIDANCE", "warn"], ["THIN · 9 ANALYSTS", "warn"], ["WIDE RANGE", "warn"]]);
  assert.equal(flagLine(undefined), null);
  assert.equal(Object.values(CARDS).filter((c) => c.estimates_flag).length, 6, "six names checked so far");
});

test("nothing damaged is carried from the estimates study: numbers and the rule's flags only", () => {
  const raw = readFileSync(here(D + "data/estimates-flags-er1-2026-10-06.json"), "utf8");
  assert.ok(!/\/bin\/|"quotes"|what_it_guides|rev_guide/.test(raw), "no quoted sentence, no 'what it guides' line, no shell residue");
  const all = JSON.stringify(Object.values(CARDS).map((c) => c.estimates_flag));
  assert.ok(!/\/bin\/zsh|\s\.\d+B\b|billion to\s+billion/.test(all));
  for (const f of Object.values(FLAGS.names)) { assert.equal(typeof f.fy1_eps, "number"); assert.ok(f.guide_eps == null || typeof f.guide_eps === "number"); }
});

/* ------------------------------------------------------------------ the card on file */
test("the card on file is CP1's card, untouched, plus the three parts — and matches what the code makes today", () => {
  assert.deepEqual(Object.keys(CARDS), Object.keys(CP1), "the same 26 names in the same order");
  assert.equal(Object.keys(CARDS).length, 26);
  for (const [t, c] of Object.entries(CARDS)) {
    const { business, zones, estimates_flag, ...rest } = c;
    assert.deepEqual(rest, CP1[t], t + ": nothing of CP1's record changed");
    const made = B(t); made.side_by_side = business.side_by_side;
    assert.deepEqual(business, JSON.parse(JSON.stringify(made)), t + ": the business block on file is what business.mjs makes from the dated facts (rebuild: tools/build-cards.mjs)");
    assert.deepEqual(estimates_flag, FLAGS.names[t] ? JSON.parse(JSON.stringify(flagLine(FLAGS.names[t]))) : null, t);
  }
  for (const t of ["WDC", "SNDK", "MU", "STX"]) assert.deepEqual([...CARDS[t].business.side_by_side].sort(), ["MU", "SNDK", "STX", "WDC"], t + ": the four storage-and-memory names side by side");
  assert.deepEqual(sideBySide("AMZN", ["GOOGL", "ZZZZ"], CARDS), ["AMZN", "GOOGL"], "only names that have a card are put beside it");
  assert.match(DOC.sources.zones, /cbe856c/); assert.match(DOC.sources.estimates_flag, /38f043b/); assert.match(DOC.sources.card, /f198dc6/);
});

/* ------------------------------------------------------------------ the tab */
test("formatting: no plus sign on a share, negatives in parentheses, cents per dollar", () => {
  assert.equal(pctPlain(48.85), "48.9%"); assert.equal(pctPlain(-1.5), "(1.5%)"); assert.equal(pctPlain(-434.2), "(434%)"); assert.equal(pctPlain(null), "—");
  assert.equal(cents(3.96), "3.96¢"); assert.equal(cents(-27.29), "(27.3¢)"); assert.equal(cents(null), "—");
  assert.equal(money(11490000000), "$11.5B"); assert.equal(money(726000000), "$726M"); assert.equal(money(1180845008400), "$1.18T"); assert.equal(money(-11625000000), "($11.6B)"); assert.equal(money(3511000000), "$3.51B");
});

test("a pie is drawn clockwise from twelve o'clock; the data-centre slice is cyan and the rest step down in grey", () => {
  assert.equal(wedgePath(0, 0.25), "M50 50 L50.00 4.00 A46 46 0 0 1 96.00 50.00 Z");
  assert.match(wedgePath(0, 0.889), / 0 1 1 /, "a slice over half the pie takes the long way round");
  assert.deepEqual(sliceClasses([{ dc: true }, { dc: false }, { dc: false }]), ["dc", "g0", "g1"]);
  assert.deepEqual(sliceClasses([{ dc: false }, { dc: false }]), ["g0", "g1"], "no data-centre line: no cyan");
  assert.match(CSS, /\.cd \.w\.dc\{fill:var\(--crk\)\}/);
  for (const hex of CSS.match(/\.cd \.w\.g\d\{fill:(#[0-9A-F]{6})\}/g).map((m) => m.slice(-8, -1))) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 36 && Math.max(r, g, b) <= 210, hex + " is a quiet grey, never white");
  }
});

test("the card: the business first (two pies, five chips, the blend, the same business side by side), then the rest in order", () => {
  const h = cardHTML(CARDS.WDC, CARDS, DOC, 496, "Read from the dated file");
  const at = (s) => { const i = h.indexOf(s); assert.ok(i >= 0, "'" + s + "' is on the card"); return i; };
  const order = ["THE BUSINESS", "BY BUSINESS LINE", "BY REGION", "DATA-CENTRE SHARE", "GROSS MARGIN", "OPERATING MARGIN", "FREE-CASH-FLOW MARGIN", "FREE-CASH-FLOW YIELD", "DATA-CENTRE PROFIT PER DOLLAR OF STOCK", "CASH PER DOLLAR OF STOCK", "SAME BUSINESS", ">FUNDAMENTALS<", ">ESTIMATES<", "COMPS CENTRE", ">TECHNICALS<", ">LEVELS<", ">RISK<", "THE PLAN", "PAGE SPECS"].map(at);
  assert.deepEqual(order, [...order].sort((a, b) => a - b), "in this order, top to bottom");
  assert.equal((h.match(/<div class="cd-pie">/g) || []).length, 2, "two pies");
  assert.equal((h.match(/class="w dc"/g) || []).length, 1, "one cyan slice: the data centre");
  assert.equal((h.match(/class="cd-chip(?: no)?"/g) || []).length, 5, "five chips");
  assert.equal((h.match(/class="cd-chips"/g) || []).length, 1, "in one row");
  assert.equal((h.match(/class="cd-bl"/g) || []).length, 2, "the blend: two figures side by side");
  assert.ok(h.includes(">3.96¢<") && h.includes(">2.48¢<"));
  assert.match(h, /Segment margins are not reported, so the company's gross margin is applied\./, "said on hover, as asked");
  assert.match(h, /title="[^"]*FMP's label: Cloud/, "FMP's own label on the slice");
  const side = h.slice(h.indexOf('class="cd-side"'), h.indexOf("</table>", h.indexOf('class="cd-side"')));
  assert.deepEqual([...side.matchAll(/<td class="tk">(?:<button[^>]*>)?([A-Z]+)/g)].map((m) => m[1]), ["WDC", "SNDK", "MU", "STX"]);
  assert.match(side, /<tr class="me"><td class="tk">WDC<\/td>/, "this name's own row is marked, and is not a link to itself");
  /* no name, ticker or price heading: the Hub's header shows them once */
  assert.ok(!/Western Digital Corporation/.test(h));
});

test("the card: the flag line sits at the top of the estimates block, before its numbers", () => {
  const h = cardHTML(CARDS.GOOGL, CARDS, DOC, 496, "x");
  const est = h.indexOf(">ESTIMATES<"), flag = h.indexOf('class="cd-flag"'), kv = h.indexOf("FORWARD P/E");
  assert.ok(est > 0 && est < flag && flag < kv);
  assert.match(h, /<span class="f warn">ONE-OFF IN THIS YEAR<\/span><span class="f quiet">NO EPS GUIDANCE<\/span><span class="f quiet">41 ANALYSTS<\/span>/);
  assert.match(h, /= <span class="up">\+30%<\/span> on the clean base, <span class="dn">−26%<\/span> as shown/);
  assert.match(flagHTML(null), /ESTIMATES NOT YET CHECKED AGAINST THE COMPANY'S GUIDANCE/);
  assert.match(cardHTML(CARDS.CRDO, CARDS, DOC, 496, "x"), /ESTIMATES NOT YET CHECKED/);
});

test("the card: zones nearest first with every member's label; fewer columns when there is less room; an honest line when there are none", () => {
  const h = cardHTML(CARDS.MU, CARDS, DOC, 496, "x");
  const rows = [...h.matchAll(/<div class="zr"[^>]*>(.*?)<\/div>/g)].map((m) => m[1]);
  assert.equal(rows.length, 8);
  assert.match(rows[0], /1,049\.57–1,052\.86/); assert.match(rows[1], /1,028\.24–1,036\.13.*3D P1.*2W D3.*21-day/);
  assert.match(h, /3D B4 · near 1W\/2W/); assert.match(h, /2W P1 \/ 1W P1/);
  assert.match(h, /class="cd-zones c4"/, "four columns in the company view's own width");
  assert.match(cardHTML(CARDS.MU, CARDS, DOC, 320, "x"), /class="cd-zones c3"/, "three on a phone");
  assert.match(cardHTML(CARDS.MU, CARDS, DOC, 900, "x"), /class="cd-zones c5"/, "five where there is room");
  assert.match(zoneRowHTML(CARDS.MU.zones.list[1], 5), /<i class="below"><\/i>.*<span class="s">TWO OR MORE<\/span><span class="l">FRI 9 OCT<\/span>/);
  assert.match(zoneRowHTML(CARDS.MU.zones.list[0], 4), /<i class="above"><\/i>.*<span class="l">TODAY<\/span>/);
  assert.match(cardHTML(CARDS.STX, CARDS, DOC, 496, "x"), /NO REVIEWED LINES FOR STX YET · NO ZONES/);
  assert.ok(NARROW_BELOW < 454 && 454 < WIDE_FROM, "the company view's panel (454 wide before the Hub scales it) is neither a phone nor wide");
});

test("the card: what ≈ and ≠ stand for is in sight as well as on hover; every sentence is in PAGE SPECS", () => {
  const mu = cardHTML(CARDS.MU, CARDS, DOC, 496, "Read from the dated file");
  assert.match(mu, />≈60%</); assert.match(mu, />≈5\.46¢</);
  assert.match(mu, /≈ · <b>THE COMPANY'S OWN WORDS, Q3 FY2026 CALL, 24 JUN 2026<\/b>/);
  assert.match(mu, /≠ · <b>FMP'S OTHER CASH READING \$59\.0B · FULL-YEAR STATEMENT<\/b>/);
  assert.match(mu, /A YEAR BEHIND · THE STATEMENTS ARE FISCAL 2026/);
  assert.match(dcTitle(CARDS.MU.business), /almost 40% of our company revenue/);
  assert.match(cashTitle(CARDS.WDC.business), /full-year statement to 3 Jul 2026\. FMP's other reading for the same twelve months, four quarters added, is \$3\.22B/);
  assert.match(blendTitles(CARDS.MU.business).dc, /data-centre share about 60% × revenue \$133B × gross margin 80\.7% ÷ market value \$1\.18T.*approximate/);
  assert.match(blendTitles(CARDS.JPM.business).dc, /^No figure: /);
  for (const t of ["WDC", "MU", "JPM", "CRDO", "EQIX", "AMZN"]) {
    const h = cardHTML(CARDS[t], CARDS, DOC, 496, "Read from the dated file");
    assert.ok(!/undefined|NaN|\[object/.test(h), t + ": no hole in the card");
    const i = h.indexOf('<details class="sc-pagespecs">'); assert.ok(i > 0, t + ": PAGE SPECS at the bottom");
    const content = h.slice(0, i).replace(/title="[^"]*"/g, "").replace(/aria-label="[^"]*"/g, "").replace(/<[^>]+>/g, " ");
    assert.ok(!/[a-z]{3,} [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+ [a-z]+/.test(content.replace(/THE PLAN[\s\S]*$/, "")), t + ": no explanatory sentence outside PAGE SPECS (the plan holds Alan's own words)");
    assert.ok(!/<details class="sc-pagespecs" open/.test(h), "closed until asked for");
  }
});

test("the comps range is CP1's picture, drawn at the width it is shown at", () => {
  const svg = footballSVG(CARDS.MU, 472);
  assert.match(svg, /^<svg viewBox="0 0 472 /); assert.match(svg, /THE RANGE/); assert.match(svg, /PRICE 1,045\.56/); assert.match(svg, /\$2,078/);
  assert.match(footballSVG(CARDS.MU, 700), /CENTRE \$2,078/, "the wide picture names the centre");
  assert.match(cardHTML(CARDS.BE, CARDS, DOC, 496, "x"), /NO PEER SET — VALUED ON GROWTH \(PEG\) AND ESTIMATES/);
});

/* ------------------------------------------------------------------ reading the card: the file, and the table behind its switch */
function fakeRoot(w = 496) { const cls = new Set(); return { classList: { add: (c) => cls.add(c), toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), has: (c) => cls.has(c) }, innerHTML: "", clientWidth: w, isConnected: true, onclick: null }; }

test("the tab reads the dated file by default and never asks the table", async () => {
  const root = fakeRoot(); let asked = 0, got = null;
  await mountCardsTab(root, { ticker: "WDC", fromTable: false, read: () => { asked++; return []; }, fetchJSON: async (u) => { got = u; return DOC; } });
  assert.equal(got, CARDS_URL); assert.equal(CARDS_URL, "/deliverables/20261007/cards-tab/data/cards.json");
  assert.equal(asked, 0);
  assert.match(root.innerHTML, /class="cd-card"/); assert.match(root.innerHTML, />3\.96¢</); assert.match(root.innerHTML, /Read from the dated file/);
  assert.ok(root.classList.has("cd") && !root.classList.has("narrow") && !root.classList.has("wide"));
  assert.ok(existsSync(here(".." + CARDS_URL)), "the file the tab reads is in the repo");
});

test("the switch: the newest row per name from decision_cards; a name the table lacks falls back to the file and says so", async () => {
  const path = TABLE_PATH(["WDC", "SNDK"]);
  assert.match(path, /^decision_cards\?ticker=in\.\(WDC,SNDK\)&select=ticker,card_date,built_utc,card&order=card_date\.desc,built_utc\.desc&limit=\d+$/);
  const newer = { ...CARDS.WDC, price: 999.99, card_date: "2026-10-07" }, older = { ...CARDS.WDC, price: 1.11, card_date: "2026-10-06" };
  assert.equal(newestPerName([{ ticker: "WDC", card: newer }, { ticker: "WDC", card: older }, { ticker: "MU", card: CARDS.MU }]).WDC.price, 999.99, "rows come newest first; the first per name is the card");
  let seen = null;
  const root = fakeRoot();
  await mountCardsTab(root, { ticker: "WDC", fromTable: true, read: async (p) => { seen = p; return [{ ticker: "WDC", card_date: "2026-10-07", built_utc: "x", card: newer }, { ticker: "WDC", card_date: "2026-10-06", built_utc: "y", card: older }]; }, fetchJSON: async () => DOC });
  assert.match(seen, /^decision_cards\?ticker=in\.\(WDC,SNDK,MU,STX\)/, "one read: the name and the names beside it");
  assert.match(root.innerHTML, /7 OCT CLOSE 999\.99/); assert.match(root.innerHTML, /Read from the table decision_cards/);
  const empty = fakeRoot();
  await mountCardsTab(empty, { ticker: "WDC", fromTable: true, read: async () => [], fetchJSON: async () => DOC });
  assert.match(empty.innerHTML, /6 OCT CLOSE 411\.04/); assert.match(empty.innerHTML, /The table holds no card for WDC: read from the dated file/);
  const down = fakeRoot();
  await mountCardsTab(down, { ticker: "WDC", fromTable: true, read: async () => { throw new Error("decision_cards → 404"); }, fetchJSON: async () => DOC });
  assert.match(down.innerHTML, /class="cd-err">The card could not be read: decision_cards → 404/, "a table that does not answer is said, not papered over");
});

test("a name with no card says so and offers the names that have one; a phone gets the narrow layout", async () => {
  const root = fakeRoot(318); let opened = null;
  await mountCardsTab(root, { ticker: "TSLA", fromTable: false, fetchJSON: async () => DOC, open: (t) => { opened = t; } });
  assert.match(root.innerHTML, /NO DECISION CARD FOR TSLA YET/); assert.match(root.innerHTML, /CARDS ON FILE · 26/);
  assert.equal((root.innerHTML.match(/data-cd-open="/g) || []).length, 26);
  assert.ok(root.classList.has("narrow"));
  root.onclick({ target: { closest: () => ({ getAttribute: () => "MU" }) } });
  assert.equal(opened, "MU", "a name on the card opens that name's company view");
});

/* ------------------------------------------------------------------ the Hub */
test("the Hub: CARDS is a tab beside COMPS, on key 5; the eleventh tab is on −; the tab loads this module and writes nothing", () => {
  assert.match(page, /^const CO_TABS = \["GEIGER","FUNDAMENTALS","ESTIMATES","COMPS","CARDS","FINANCIALS","STATS","NEWS","SOCIAL","EVENTS","READ"\];/m);
  assert.match(page, /case "CARDS":\s+return nonOp \? nonOpTabHTML\(data\) : cardsTabHTML\(data\);/);
  assert.match(page, /import\("\/deliverables\/20261007\/cards-tab\/tab\.mjs"\)/);
  assert.match(page, /e\.key === "0" \? 10 : e\.key === "-" \? 11 : 0;/);
  assert.match(page, /\(i === 9 \? 0 : i === 10 \? "−" : i \+ 1\)/);
  const mount = page.slice(page.indexOf("function cardsTabMount()"), page.indexOf("function cardsTabMount()") + 1200);
  assert.match(mount, /m\.mountCardsTab\(live, \{ ticker: t, fromTable: CARDS_FROM_TABLE, read: \(path\) => pg\(path, 1\), open: \(x\) => openCo\(x\) \}\)/);
  assert.ok(!/write|POST|method:/.test(mount), "the mount hands the tab a reader and nothing that writes");
  for (const f of ["tab.mjs", "business.mjs", "card-parts.mjs"]) { const src = readFileSync(here(D + f), "utf8"); assert.ok(!/method:\s*"(POST|PATCH|PUT|DELETE)"|\.insert\(|localStorage/.test(src), f + " writes nothing and stores nothing"); }
});

test("the switch for the table reader is OFF: the migration is proposed, not applied", () => {
  assert.match(page, /^const CARDS_FROM_TABLE = \(typeof window !== "undefined" && window\.SC_CARDS_FROM_TABLE === true\);/m);
  assert.ok(!/SC_CARDS_FROM_TABLE\s*=\s*true/.test(page), "nothing in the page turns it on");
  const sql = readFileSync(here("../supabase/migrations/20261007_cp1_decision_cards.sql"), "utf8");
  assert.match(sql, /PROPOSED, NOT APPLIED/); assert.match(sql, /card\s+jsonb\s+not null/, "the three new parts ride in the card's own jsonb: no new column is needed");
  assert.ok(existsSync(here("../supabase/migrations/20261007_cp1_decision_cards_ROLLBACK.sql")));
});

test("the same flag line for the top of the ESTIMATES tab is built and OFF: the tab is exactly as it was", async () => {
  assert.match(page, /^const EST_FLAG_LINE = \(typeof window !== "undefined" && window\.SC_EST_FLAG_LINE === true\);/m);
  assert.ok(!/SC_EST_FLAG_LINE\s*=\s*true/.test(page), "nothing in the page turns it on");
  assert.match(page, /case "ESTIMATES":\s+return nonOp \? nonOpTabHTML\(data\) : \(EST_FLAG_LINE \? estFlagHTML\(data\) : ""\) \+ estimatesTabHTML\(data\);/, "off: the empty string in front of the tab as it was");
  assert.match(page, /function estimatesTabHTML\(data\) \{[^\n]*\n  return revStripHTML\(data\) \+/, "estimatesTabHTML itself is untouched");
  /* on: the line for a name that has been checked, nothing at all for one that has not, nothing if the read fails */
  const g = fakeRoot();
  await mountEstimatesFlag(g, { ticker: "GOOGL", fromTable: false, fetchJSON: async () => DOC });
  assert.match(g.innerHTML, /^<div class="cd-flag"><div class="fc"><span class="f warn">ONE-OFF IN THIS YEAR<\/span>/); assert.ok(g.classList.has("cd"));
  assert.equal(g.innerHTML, flagHTML(CARDS.GOOGL.estimates_flag), "the very line the card shows");
  const n = fakeRoot();
  await mountEstimatesFlag(n, { ticker: "NVDA", fromTable: false, fetchJSON: async () => DOC });
  assert.equal(n.innerHTML, "", "not checked: nothing added, not even a 'not checked' line"); assert.ok(!n.classList.has("cd"));
  const x = fakeRoot();
  await mountEstimatesFlag(x, { ticker: "TSLA", fromTable: true, read: async () => { throw new Error("down"); }, fetchJSON: async () => DOC });
  assert.equal(x.innerHTML, "");
});

test("the FMP job prints facts and never a key; the tools read the other branches without merging them", () => {
  const job = readFileSync(here(D + "tools/business-facts-fmp.mjs"), "utf8");
  assert.match(job, /process\.env\.FMP_API_KEY \|\| process\.env\.FMP_KEY/); assert.match(job, /\/stable\//);
  assert.ok(!/console\.log\([^)]*KEY/.test(job) && !/stdout\.write\([^)]*KEY/.test(job), "the key is never printed");
  assert.ok(!/supabase|rest\/v1|INSERT|upsert/i.test(job), "no table is written from Fly");
  for (const f of ["data/business-facts-fmp-2026-10-07.json", "data/cards.json", "data/data-centre-stated.json"]) assert.ok(!/apikey|eyJ[A-Za-z0-9_-]{20,}|sb_publishable_|sb_secret_/.test(readFileSync(here(D + f), "utf8")), f + " carries no key");
  const ex = readFileSync(here(D + "tools/extract-inputs.mjs"), "utf8");
  assert.match(ex, /commit: "cbe856c"/); assert.match(ex, /commit: "38f043b"/); assert.match(ex, /"show", commit \+ ":" \+ file/);
  const st = readFileSync(here(D + "tools/read-stated-share.mjs"), "utf8");
  assert.ok(!/method:|POST/.test(st), "the stored calls are read, never written");
});
