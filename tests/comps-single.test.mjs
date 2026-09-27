import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  quantile, peerBand, quarterRun, flow, growthPct, buildInputs, components, impliedPrice,
  compsRead, valuationBar, overlapBand, fairSummary, verdict, rowScale, fmt, component, COMPONENTS, VALUATION, CARD_KEYS, cohortFor,
} from "../deliverables/20260927/comps-single/comps.mjs";
import {
  propose, proposeRisk, gridAt, GRID_A, GRID_B, toK1Risk, greyingPrefs, GROUND_UP_READ, SMALL_FLOOR_PCT,
} from "../deliverables/20260927/comps-single/alloc.mjs";
import { DEFAULT_PREFS, fit } from "../deliverables/20260925/knockout/field.mjs";

const TODAY = "2026-09-27";
const DIR = join(process.cwd(), "deliverables", "20260927", "comps-single");
const near = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

/* A test company, invented for the arithmetic (numbers chosen so every answer can be worked by hand). */
const Q = (fd, p, o) => ({ period: p, fiscal_date: fd, ...o });
function company(t, { price = 100, mcap = 1000, fprice = 100, eps = 5, fy1 = 6, fy2 = 7.2, rfy1 = 1100, rfy2 = 1320, nd = 200, q = null } = {}) {
  const quarters = q || [
    Q("2026-06-30", "Q2", { revenue: 300, gross_profit: 120, operating_income: 60, ebitda: 80 }),
    Q("2026-03-31", "Q1", { revenue: 250, gross_profit: 100, operating_income: 50, ebitda: 70 }),
    Q("2025-12-31", "Q4", { revenue: 250, gross_profit: 100, operating_income: 50, ebitda: 70 }),
    Q("2025-09-30", "Q3", { revenue: 200, gross_profit: 80, operating_income: 40, ebitda: 30 }),
    Q("2025-06-30", "Q2", { revenue: 200, gross_profit: 80, operating_income: 40, ebitda: 60 }),
    Q("2025-03-31", "Q1", { revenue: 200, gross_profit: 80, operating_income: 40, ebitda: 60 }),
    Q("2024-12-31", "Q4", { revenue: 200, gross_profit: 80, operating_income: 40, ebitda: 60 }),
    Q("2024-09-30", "Q3", { revenue: 200, gross_profit: 80, operating_income: 40, ebitda: 60 }),
  ];
  const cf = [
    Q("2026-06-30", "Q2", { capex: -40, operating_cf: 90, free_cf: 50 }),
    Q("2026-03-31", "Q1", { capex: -30, operating_cf: 60, free_cf: 30 }),
    Q("2025-12-31", "Q4", { capex: -30, operating_cf: 60, free_cf: 30 }),
    Q("2025-09-30", "Q3", { capex: -20, operating_cf: 40, free_cf: 20 }),
    Q("2025-06-30", "Q2", { capex: -25, operating_cf: 40, free_cf: 15 }),
    Q("2025-03-31", "Q1", { capex: -25, operating_cf: 40, free_cf: 15 }),
    Q("2024-12-31", "Q4", { capex: -25, operating_cf: 40, free_cf: 15 }),
    Q("2024-09-30", "Q3", { capex: -25, operating_cf: 40, free_cf: 15 }),
  ];
  return buildInputs({
    ticker: t, profile: { name: t + " Corp" }, fundamentals: { price: fprice, market_cap: mcap, eps_ttm: eps, revenue_ttm: 1000 },
    quote: { price }, estimates: [
      { period: "annual", fiscal_date: "2026-12-31", est_eps_avg: fy1, est_revenue_avg: rfy1 },
      { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: fy2, est_revenue_avg: rfy2 },
      { period: "annual", fiscal_date: "2025-12-31", est_eps_avg: 1, est_revenue_avg: 1 },   // in the past: ignored
    ],
    incQ: quarters, incFY: [], cfQ: cf, cfFY: [{ fiscal_year: 2025, fiscal_date: "2025-12-31", capex: -100 }, { fiscal_year: 2024, fiscal_date: "2024-12-31", capex: -80 }],
    balance: [{ fiscal_date: "2025-12-31", net_debt: 999 }, { fiscal_date: "2026-06-30", net_debt: nd }],
  }, TODAY);
}

/* ---- percentiles and bands ------------------------------------------------------------------ */

test("quantile interpolates between the two nearest values; nulls are not values", () => {
  assert.equal(quantile([1, 2, 3, 4, 5], 0.25), 2);
  assert.equal(quantile([10, 20, 30, 40], 0.25), 17.5);
  assert.equal(quantile([10, 20, 30, 40], 0.75), 32.5);
  assert.equal(quantile([null, 7, "x"], 0.5), 7);
  assert.equal(quantile([], 0.5), null);
});

test("the peer band holds the range, the middle half and the median", () => {
  const b = peerBand([40, 10, null, 30, 20]);
  assert.deepEqual(b, { n: 4, min: 10, q1: 17.5, median: 25, q3: 32.5, max: 40 });
  assert.equal(peerBand([null]).n, 0);
  const one = peerBand([7]);
  assert.equal(one.min, 7); assert.equal(one.max, 7); assert.equal(one.median, 7);
});

/* ---- TTM ----------------------------------------------------------------------------------- */

test("TTM is the newest four consecutive quarters; the year before is the four before those", () => {
  const c = company("A");
  assert.equal(c.rev.basis, "TTM");
  assert.equal(c.rev.now, 1000); assert.equal(c.rev.prior, 800);
  assert.equal(c.rev.to, "2026-06-30"); assert.equal(c.rev.from, "2025-09-30");
  assert.equal(c.capex.now, 120, "CapEx is the size of the spend: stored negative, read positive");
  assert.equal(c.capex.prior, 100);
});

test("a gap in the quarters breaks the run, and the fiscal years stand in", () => {
  const rows = [Q("2026-06-30", "Q2", { revenue: 1 }), Q("2026-03-31", "Q1", { revenue: 1 }), Q("2025-09-30", "Q3", { revenue: 1 }), Q("2025-06-30", "Q2", { revenue: 1 })];
  assert.equal(quarterRun(rows).length, 2, "31 Mar → 30 Sep is 182 days, not a quarter");
  const f = flow(rows, [{ fiscal_date: "2025-12-31", revenue: 50 }, { fiscal_date: "2024-12-31", revenue: 40 }], "revenue");
  assert.equal(f.basis, "FY"); assert.equal(f.now, 50); assert.equal(f.prior, 40);
});

test("a quarter with a missing number does not make a TTM", () => {
  const rows = [Q("2026-06-30", "Q2", { revenue: 1 }), Q("2026-03-31", "Q1", { revenue: null }), Q("2025-12-31", "Q4", { revenue: 1 }), Q("2025-09-30", "Q3", { revenue: 1 })];
  assert.equal(flow(rows, [], "revenue").now, null);
});

test("growth needs a positive year before", () => {
  near(growthPct(120, 100), 20);
  assert.equal(growthPct(120, 0), null);
  assert.equal(growthPct(120, -5), null);
  assert.equal(growthPct(null, 5), null);
});

/* ---- the components ------------------------------------------------------------------------ */

test("every component of the test company, worked by hand", () => {
  const c = company("A");
  const { v, ev } = components(c);
  assert.equal(c.shares, 10, "market value 1000 ÷ its own price 100");
  assert.equal(c.net_debt, 200, "the newest balance row, not the fiscal year one");
  assert.equal(ev, 1200);
  near(v.pe_ttm, 20); near(v.pe_fwd, 100 / 6); near(v.ev_sales, 1.2); near(v.ev_ebitda, 1200 / 250);
  near(v.eps_g_fy, 20); near(v.peg, (100 / 6) / 20); near(v.rev_g_fy, 20); near(v.rev_g_ttm, 25);
  near(v.gm, 40); near(v.om, 20); near(v.fcfm, 13);
  near(v.capex, 120); near(v.capex_rev, 12); near(v.capex_g, 20);
  near(v.results, 5, 1e-9); near(v.rev_per_capex, 2, 1e-9);
  near(v.nd_ebitda, 0.8);
});

test("the market value moves with the price: shares × today's price", () => {
  const c = company("A", { price: 110 });
  assert.equal(c.mcap, 1100);
  near(components(c).ev, 1300);
});

test("a loss-maker has no P/E, no PEG and no EV/EBITDA — never a negative multiple", () => {
  const c = company("L", { eps: -2, fy1: -1, fy2: 0.5, q: [
    Q("2026-06-30", "Q2", { revenue: 10, ebitda: -5 }), Q("2026-03-31", "Q1", { revenue: 10, ebitda: -5 }),
    Q("2025-12-31", "Q4", { revenue: 10, ebitda: -5 }), Q("2025-09-30", "Q3", { revenue: 10, ebitda: -5 })] });
  const { v, why } = components(c);
  assert.equal(v.pe_ttm, null); assert.match(why.pe_ttm, /not positive/);
  assert.equal(v.pe_fwd, null); assert.equal(v.peg, null); assert.equal(v.ev_ebitda, null); assert.equal(v.nd_ebitda, null);
  assert.equal(v.eps_g_fy, null, "growth on a negative base means nothing");
  assert.ok(v.ev_sales > 0, "EV/sales still prices a company with sales");
});

test("free cash flow is derived as operating cash flow − CapEx when the column is empty, and says so", () => {
  const i = buildInputs({ ticker: "F", fundamentals: { price: 1, market_cap: 1 }, cfFY: [{ fiscal_date: "2025-12-31", operating_cf: 50, capex: -20, free_cf: null }], incFY: [{ fiscal_date: "2025-12-31", revenue: 100 }] }, TODAY);
  assert.equal(i.fcf.now, 30); assert.equal(i.fcf.derived, true);
  near(components(i).v.fcfm, 30);
});

/* ---- implied value per share --------------------------------------------------------------- */

test("implied value per share on each valuation row", () => {
  const c = company("A");
  near(impliedPrice("pe_ttm", 30, c), 150);
  near(impliedPrice("pe_fwd", 20, c), 120);
  near(impliedPrice("ev_sales", 2, c), (2 * 1000 - 200) / 10);
  near(impliedPrice("ev_ebitda", 10, c), (10 * 250 - 200) / 10);
  near(impliedPrice("peg", 1, c), 1 * 20 * 6, 1e-9);
});

test("priced at its OWN multiple, every row gives back today's price", () => {
  const c = company("A");
  const { v } = components(c);
  for (const k of VALUATION) near(impliedPrice(k, v[k], c), 100, 1e-9);
});

test("an implied value below zero is shown as zero; a row that cannot price the company gives none", () => {
  const c = company("A", { nd: 5000 });
  assert.equal(impliedPrice("ev_sales", 1, c), 0);
  const l = company("L", { eps: -1 });
  assert.equal(impliedPrice("pe_ttm", 20, l), null);
});

/* ---- overlap --------------------------------------------------------------------------------- */

test("overlap: when every bar overlaps, the band is their intersection", () => {
  const b = overlapBand([{ key: "a", lo: 80, hi: 120, mid: 100 }, { key: "b", lo: 90, hi: 150, mid: 110 }, { key: "c", lo: 70, hi: 115, mid: 95 }]);
  assert.equal(b.lo, 90); assert.equal(b.hi, 115); assert.equal(b.count, 3); assert.equal(b.of, 3);
  assert.deepEqual(b.keys.sort(), ["a", "b", "c"]);
});

test("overlap: when the bars split, the band is the stretch covered by the most bars", () => {
  const b = overlapBand([{ key: "a", lo: 10, hi: 50, mid: 30 }, { key: "b", lo: 40, hi: 60, mid: 50 }, { key: "c", lo: 45, hi: 70, mid: 55 }, { key: "d", lo: 200, hi: 220, mid: 210 }]);
  assert.equal(b.lo, 45); assert.equal(b.hi, 50); assert.equal(b.count, 3); assert.equal(b.of, 4);
  assert.ok(!b.keys.includes("d"));
});

test("overlap: two stretches tie — the one holding the median of the midpoints wins", () => {
  const b = overlapBand([{ key: "a", lo: 0, hi: 10, mid: 5 }, { key: "b", lo: 5, hi: 15, mid: 10 }, { key: "c", lo: 100, hi: 110, mid: 105 }, { key: "d", lo: 105, hi: 120, mid: 112 }, { key: "e", lo: 12, hi: 13, mid: 12.5 }]);
  // stretches with 2 bars: [5,10] (a,b), [12,13] (b,e), [105,110] (c,d); midpoints median = 12.5 → [12,13]
  assert.equal(b.count, 2); assert.equal(b.lo, 12); assert.equal(b.hi, 13);
});

test("overlap: bars that never touch give no band, and say so", () => {
  const b = overlapBand([{ key: "a", lo: 0, hi: 1 }, { key: "b", lo: 2, hi: 3 }]);
  assert.equal(b.lo, null); assert.match(b.reason, /no two/);
  assert.equal(overlapBand([]).of, 0);
  const one = overlapBand([{ key: "a", lo: 5, hi: 9 }]);
  assert.equal(one.lo, 5); assert.equal(one.hi, 9); assert.equal(one.count, 1);
});

test("overlap: touching ends count as overlapping at that one price", () => {
  const b = overlapBand([{ key: "a", lo: 0, hi: 10 }, { key: "b", lo: 10, hi: 20 }]);
  assert.equal(b.lo, 10); assert.equal(b.hi, 10); assert.equal(b.count, 2);
});

test("fair summary: price below, inside and above the band", () => {
  const field = [{ ok: true, at: { median: 100 } }, { ok: true, at: { median: 140 } }, { ok: false, at: { median: 999 } }];
  const band = { lo: 90, hi: 130 };
  assert.equal(fairSummary(band, field, 80).where, "below");
  assert.equal(fairSummary(band, field, 100).where, "inside");
  assert.equal(fairSummary(band, field, 150).where, "above");
  near(fairSummary(band, field, 100).toMid, 10);
  assert.equal(fairSummary(band, field, 100).point, 120, "a row that cannot price the company takes no part in the point");
});

/* ---- the whole read ------------------------------------------------------------------------- */

test("comps read: peers exclude the company itself, funds and knocked-out names", () => {
  const me = company("ME");
  const peers = [me, company("P1", { price: 150 }), company("P2", { price: 200 }), company("P3", { price: 300 }), { ...company("ETF"), is_etf: true }];
  const r = compsRead(me, peers);
  assert.deepEqual(r.peersIn, ["P1", "P2", "P3"]);
  const pe = r.rows.find((x) => x.key === "pe_ttm");
  assert.deepEqual([pe.band.min, pe.band.median, pe.band.max], [30, 40, 60]);
  assert.equal(pe.value, 20);
  assert.equal(pe.verdict.side, 1); assert.match(pe.verdict.word, /cheaper/);
  const out = compsRead(me, peers, { out: new Set(["P3"]) });
  const pe2 = out.rows.find((x) => x.key === "pe_ttm");
  assert.equal(pe2.band.max, 40); assert.equal(pe2.band.median, 35);
});

test("comps read: the valuation bar prices the company at the peer low, median and high", () => {
  const me = company("ME");
  const r = compsRead(me, [me, company("P1", { price: 150 }), company("P2", { price: 200 }), company("P3", { price: 300 })]);
  const bar = r.field.find((f) => f.key === "pe_ttm");
  assert.equal(bar.ok, true);
  near(bar.at.min, 150); near(bar.at.median, 200); near(bar.at.max, 300);
  near(bar.upside, 100);
  // every peer here is the same business at a higher price, so every row agrees the company is cheap
  assert.equal(r.fair.where, "below");
  assert.equal(r.band.of, r.field.filter((f) => f.ok).length);
});

test("comps read: a row with one peer draws no bar and says why", () => {
  const me = company("ME");
  const r = compsRead(me, [me, company("P1", { price: 150 }), company("L1", { eps: -1, fy1: -1 })]);
  const bar = r.field.find((f) => f.key === "pe_ttm");
  assert.equal(bar.ok, false); assert.match(bar.reason, /only 1 peer/);
  const row = r.rows.find((x) => x.key === "pe_ttm");
  assert.deepEqual(row.missing, ["L1"]);
});

test("verdicts: which side of the median is favourable, and CapEx size is described, not judged", () => {
  assert.equal(verdict(component("om"), 30, 20).side, 1);
  assert.equal(verdict(component("nd_ebitda"), 3, 1).side, -1);
  assert.match(verdict(component("nd_ebitda"), 3, 1).word, /more indebted/);
  assert.equal(verdict(component("capex_rev"), 30, 10).side, 0);
  assert.equal(verdict(component("results"), -10, 5).side, -1);
  assert.equal(verdict(component("om"), null, 5).side, null);
});

test("the row scale always holds the company, even off the peer range", () => {
  const s = rowScale({ min: 10, max: 20 }, 40);
  assert.ok(s.x(40) <= 1 && s.x(40) > 0.9); assert.ok(s.x(10) >= 0 && s.x(10) < 0.1);
  const flat = rowScale({ min: 5, max: 5 }, 5);
  near(flat.x(5), 0.5);
});

test("formats: multiples, percents, points, money", () => {
  assert.equal(fmt("x", 26.57), "26.6x"); assert.equal(fmt("x", 123.4), "123x"); assert.equal(fmt("x", -0.5), "−0.5x");
  assert.equal(fmt("pct", 14.48), "+14%"); assert.equal(fmt("pct", -3.21), "−3.2%"); assert.equal(fmt("pp", -12.4), "−12 pts");
  assert.equal(fmt("price", 957.1), "$957"); assert.equal(fmt("money", 41.368e9), "$41.4B"); assert.equal(fmt("x", null), "—");
});

test("every component the brief lists is on the field, and the card carries eight", () => {
  const keys = COMPONENTS.map((c) => c.key);
  for (const k of ["pe_ttm", "pe_fwd", "ev_sales", "ev_ebitda", "peg", "rev_g_ttm", "rev_g_fy", "eps_g_fy", "gm", "om", "fcfm", "capex", "capex_rev", "capex_g", "results", "nd_ebitda"]) assert.ok(keys.includes(k), k);
  assert.equal(CARD_KEYS.length, 8);
  for (const k of CARD_KEYS) assert.ok(keys.includes(k));
});

test("the three companies of the brief find their peers", () => {
  assert.equal(cohortFor("GEV", []), "AI_POWERTRAIN");
  assert.equal(cohortFor("VST", []), "AI_POWERTRAIN");
  assert.equal(cohortFor("MU", []), "SEMICONDUCTORS");
  assert.equal(cohortFor("XYZ", ["MEGA_CAP", "SOFTWARE"]), "SOFTWARE");
  assert.equal(cohortFor("GEV", [], "utilities"), "UTILITIES");
});

/* ---- the allocation default ------------------------------------------------------------------ */

test("the grids copied from GROUND UP give back what GROUND UP printed on 26 Sep", () => {
  const r = GROUND_UP_READ;
  near(gridAt(GRID_A, r.pct, 1), 80);
  near(gridAt(GRID_B, r.pct, 1), 25);
  const p = propose({ x: r.pct, spread: r.gIWM - r.gSPY });
  assert.equal(Math.round(p.invested), r.invested);
  assert.equal(Math.round(p.lc), r.lc);
  assert.equal(p.riskName, r.risk);
  // the other two readings in its deliverable: aggressive → 100% and 15 / 85
  assert.equal(Math.round(propose({ x: r.pct, spread: r.gIWM - r.gSPY, over: { R: 2 } }).invested), 100);
  assert.equal(Math.round(propose({ x: r.pct, spread: r.gIWM - r.gSPY, over: { R: 2 } }).lc), 15);
});

test("risk-averse in risky moments: the proposal eases to conservative as the market stretches", () => {
  assert.equal(proposeRisk(0), 1, "a washed-out market does not propose aggressive by itself");
  assert.equal(proposeRisk(0.25), 1);
  assert.equal(proposeRisk(0.5), 1);
  assert.equal(proposeRisk(0.75), 0.5);
  assert.equal(proposeRisk(1), 0);
  const hot = propose({ x: 0.95, spread: 0 });
  assert.equal(hot.risk, "LOW");
  assert.ok(hot.invested < 20);
  assert.ok(hot.lc > 75, "stretched: most of what is invested sits in large caps");
});

test("the blend decides whether small caps may play; the dial decides the earnings rule", () => {
  const today = propose({ x: 0.25, spread: 0.01 });
  assert.equal(today.cls, "LARGE_AND_SMALL"); assert.equal(today.risk, "MEDIUM");
  const thin = propose({ x: 0.25, spread: 0.01, over: { lc: 85 } });
  assert.equal(thin.sc < SMALL_FLOOR_PCT, true); assert.equal(thin.cls, "LARGE_ONLY");
  assert.equal(toK1Risk(0), "LOW"); assert.equal(toK1Risk(0.5), "LOW"); assert.equal(toK1Risk(1), "MEDIUM"); assert.equal(toK1Risk(1.5), "HIGH");
  assert.equal(thin.overridden, true); assert.equal(today.overridden, false);
});

test("the proposal feeds the K1 fit rules: small cap in or out, earning or not", () => {
  const small = { ticker: "SMOL", mcap: 3e9, eps_ttm: 1, tags: ["SMALL_CAP"] };
  const loss = { ticker: "LOSS", mcap: 50e9, eps_ttm: -1, tags: ["LARGE_CAP"] };
  const open = greyingPrefs(DEFAULT_PREFS, propose({ x: 0.25, spread: 0 }));
  assert.equal(fit(small, open).in, true);
  assert.equal(fit(loss, open).in, false, "balanced: a name must earn");
  const shut = greyingPrefs(DEFAULT_PREFS, propose({ x: 0.25, spread: 0, over: { lc: 90 } }));
  assert.equal(fit(small, shut).in, false);
  const wild = greyingPrefs(DEFAULT_PREFS, propose({ x: 0.25, spread: 0, over: { R: 2 } }));
  assert.equal(fit(loss, wild).in, true, "aggressive: no earnings rule");
  assert.deepEqual(DEFAULT_PREFS.themes_out, { URANIUM: "nuclear — its time will come, not right now" }, "the operator's own rules are not rewritten");
});

/* ---- the page ------------------------------------------------------------------------------- */

test("the page imports the tested files, reads no key on localhost, and carries the way back", () => {
  const html = readFileSync(join(DIR, "index.html"), "utf8");
  assert.match(html, /from "\.\/comps\.mjs"/);
  assert.match(html, /from "\.\/alloc\.mjs"/);
  assert.match(html, /data-scnav-slot/);
  assert.match(html, /<!-- scnav · /);
  assert.ok(!/eyJhbGciOi[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/.test(html), "no key is written into the page");
  assert.match(html, /if \(LOCAL\) return snapshot\(\)/, "on localhost the page draws the committed snapshot and never reads the database");
  assert.ok(!/localStorage\.setItem\(["']k1\./.test(html), "K1's saved rules are read, never written");
});

test("the page uses the Hub's tokens and no text smaller than the brief allows", () => {
  const html = readFileSync(join(DIR, "index.html"), "utf8");
  for (const t of ["--bg:#0A0A0F", "--panel:#0D0D14", "--line:#1A1A2A", "--crk:#00D4FF"]) assert.ok(html.includes(t), t);
  const sizes = [...html.matchAll(/font(?:-size)?:\s*(?:\d{3}\s+)?(\d+(?:\.\d+)?)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10);
  assert.ok(Math.min(...sizes) >= 10, "smallest font " + Math.min(...sizes) + "px");
});
