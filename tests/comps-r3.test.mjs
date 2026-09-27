import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROWS, GROUPS, row, VALUATION, buildInputs, components, whoSets, outliers, rowRead, positionIn, verdict,
  priceBar, fairBand, targetBar, compsRead, niceTicks, rowScale, fmt, endWords, outlierWords, cohortFor, targetOf, OUTLIER_K,
} from "../deliverables/20260927/comps-r3/r3.mjs";
import { METRICS } from "../deliverables/20260925/knockout/field.mjs";
import { COMPONENTS as K2 } from "../deliverables/20260927/comps-single/comps.mjs";

const TODAY = "2026-09-27";
const DIR = join(process.cwd(), "deliverables", "20260927", "comps-r3");
const near = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≉ ${b}`);

/* An invented company whose every number can be worked by hand. */
function company(t, { price = 100, mcap = 1000, eps = 5, fy1 = 6, fy2 = 7.2, nd = 200, adj = 18, target = null, geiger = 0.1, usual = 2, report = "2026-10-15" } = {}) {
  return buildInputs({
    ticker: t, profile: { name: t + " Corp" }, fundamentals: { price, market_cap: mcap, eps_ttm: eps, revenue_ttm: 1000, adjusted_pe: adj },
    quote: { price },
    estimates: [
      { period: "annual", fiscal_date: "2026-12-31", est_eps_avg: fy1, est_revenue_avg: 1100, price_target_avg: 130, updated_ts: 1790000000 },
      { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: fy2, est_revenue_avg: 1320 },
    ],
    incQ: [], incFY: [{ fiscal_date: "2025-12-31", revenue: 1000, gross_profit: 400, operating_income: 200, ebitda: 250 }, { fiscal_date: "2024-12-31", revenue: 800, gross_profit: 300, operating_income: 150, ebitda: 200 }],
    cfQ: [], cfFY: [{ fiscal_year: 2025, fiscal_date: "2025-12-31", capex: -100, operating_cf: 300, free_cf: 200 }, { fiscal_year: 2024, fiscal_date: "2024-12-31", capex: -80, operating_cf: 250, free_cf: 170 }],
    balance: [{ fiscal_date: "2025-12-31", net_debt: nd }],
    target, geiger: { composite: geiger, updated_ts: "2026-09-26" }, heartbeat: { usual_day_60: usual, date: "2026-09-26" },
    next_report: report ? { date: report } : null,
  }, TODAY);
}

/* ---- every round-1 column is a row ------------------------------------------------------------- */

test("every column of the round-1 table has a row here, and every round-2 component too", () => {
  const keys = new Set(ROWS.map((r) => r.key));
  const map = { pe_ttm: "pe_ttm", pe_adj: "pe_adj", pe_fwd: "pe_fwd", eps_growth: "eps_g_fy", rev_ttm: "rev_ttm", rev_growth: "rev_g_fy", target_upside: "target_upside", mcap: "mcap", net_debt: "net_debt", geiger: "geiger", usual: "usual" };
  for (const m of METRICS) assert.ok(keys.has(map[m.key]), `round-1 column ${m.key} (${m.label}) is missing`);
  assert.ok(keys.has("report_days"), "the round-1 Reports column is the days-to-report row");
  for (const c of K2) assert.ok(keys.has(c.key), `round-2 component ${c.key} is missing`);
  for (const r of ROWS) assert.ok(GROUPS.some((g) => g.key === r.group), r.key + " sits in a listed group");
  assert.deepEqual(GROUPS.map((g) => g.key), ["SIZE", "VAL", "GROW", "PROF", "CAPEX", "BAL", "AN", "TIME"]);
  assert.ok(ROWS.every((r) => r.axis && r.axis.length === 2 && r.basis), "every row names its axis ends and its basis");
});

test("the new inputs are read: adjusted P/E, the target band, the Geiger, the usual day, days to the report", () => {
  const c = company("A", { target: { target_low: 90, target_avg: 120, target_median: 118, target_high: 150, num_analysts: 12, updated_ts: "2026-09-25" } });
  assert.equal(c.adjusted_pe, 18);
  assert.deepEqual(c.target, { low: 90, avg: 120, median: 118, high: 150, n: 12, date: "2026-09-25", from: "price_target_consensus" });
  assert.equal(c.geiger, 0.1); assert.equal(c.usual, 2); assert.equal(c.report_days, 18);
  const v = components(c).v;
  assert.equal(v.mcap, 1000); assert.equal(v.rev_ttm, 1000); assert.equal(v.ev, 1200); assert.equal(v.net_debt, 200);
  assert.equal(v.pe_adj, 18); near(v.target_upside, 20); assert.equal(v.geiger, 0.1); assert.equal(v.usual, 2); assert.equal(v.report_days, 18);
});

test("without a consensus row the average target on the estimates row stands in, and says so", () => {
  const c = company("A");
  assert.equal(c.target.from, "analyst_estimates.price_target_avg");
  assert.equal(c.target.avg, 130); assert.equal(c.target.low, null);
  const t = targetBar(c, { lo: 80, hi: 90 });
  assert.equal(t.ok, true); assert.equal(t.hasRange, false); near(t.upside.mid, 30);
  assert.equal(t.vsBand, "the whole analyst band is above the comps band");
  assert.equal(targetOf({ estimates: [] }, TODAY).avg, null);
});

/* ---- who sets what, and the outliers ----------------------------------------------------------- */

test("who sets the ends and the median: the middle one when odd, the two middle when even", () => {
  const odd = whoSets([{ ticker: "A", value: 3 }, { ticker: "B", value: 1 }, { ticker: "C", value: 2 }]);
  assert.equal(odd.low, "B"); assert.equal(odd.high, "A"); assert.deepEqual(odd.median, ["C"]);
  const even = whoSets([{ ticker: "A", value: 4 }, { ticker: "B", value: 1 }, { ticker: "C", value: 2 }, { ticker: "D", value: 3 }]);
  assert.deepEqual(even.median, ["C", "D"]);
  assert.equal(whoSets([{ ticker: "A", value: null }]).n, 0);
});

test("Tukey's rule names the outliers and gives the band without them", () => {
  const vals = [10, 12, 13, 14, 15, 16, 50].map((v, i) => ({ ticker: "P" + i, value: v }));
  const o = outliers(vals);
  assert.equal(o.k, OUTLIER_K);
  // q1 = 12.5, q3 = 15.5, iqr = 3 → fences 8 and 20
  near(o.fence.lo, 8); near(o.fence.hi, 20);
  assert.deepEqual(o.out.map((x) => [x.ticker, x.side]), [["P6", "high"]]);
  assert.equal(o.kept.length, 6);
  assert.equal(o.all.max, 50); assert.equal(o.kept_band.max, 16);
  near(o.all.median, 14); near(o.kept_band.median, 13.5);
});

test("with fewer than four peers nobody is an outlier, and the rule says why", () => {
  const o = outliers([1, 2, 100].map((v, i) => ({ ticker: "P" + i, value: v })));
  assert.equal(o.out.length, 0); assert.equal(o.fence, null);
  assert.match(o.rule, /fewer than four/);
});

test("a row read carries both bands: outliers in by default, out on request", () => {
  const peers = [10, 12, 13, 14, 15, 16, 50].map((v, i) => ({ ticker: "P" + i, value: v }));
  const rin = rowRead("pe_ttm", 20, peers);
  assert.equal(rin.band.max, 50); assert.equal(rin.n, 7); assert.equal(rin.outliers.out[0].ticker, "P6");
  const rout = rowRead("pe_ttm", 20, peers, { outOut: true });
  assert.equal(rout.band.max, 16); assert.equal(rout.n, 6); assert.equal(rout.sets.high, "P5");
  assert.equal(rin.verdict.side, -1, "20x is dearer than the 14x median");
  assert.equal(rout.position.where, "above the peer range");
  assert.equal(rin.position.where, "inside the peer range");
  assert.equal(rin.position.rank, 2);
});

test("NM multiples are set aside before the outlier rule, so a 3296x P/E is NM, not an outlier", () => {
  const peers = [10, 12, 13, 14, 3296].map((v, i) => ({ ticker: "P" + i, value: v }));
  const r = rowRead("pe_ttm", 11, peers);
  assert.deepEqual(r.nm.map((x) => x.ticker), ["P4"]);
  assert.equal(r.n, 4); assert.equal(r.outliers.out.length, 0);
  const keep = rowRead("pe_ttm", 11, peers, { nm: false });
  assert.equal(keep.n, 5); assert.equal(keep.outliers.out[0].ticker, "P4");
});

test("the outlier words name the ends, the median setters and the band without the outliers", () => {
  const peers = [10, 12, 13, 14, 15, 16, 50].map((v, i) => ({ ticker: "P" + i, value: v }));
  const w = outlierWords(rowRead("pe_ttm", 20, peers));
  assert.equal(w, "low end P0 · high end P6 · median set by P3 · outlier: P6 50.0x (high) · without it: 10.0x – 16.0x, median 13.5x");
  const none = outlierWords(rowRead("pe_ttm", 20, peers.slice(0, 6)));
  assert.match(none, /no outlier by the rule/);
});

/* ---- the $ field, every end explained ---------------------------------------------------------- */

test("a price bar explains each end: the multiple, whose it is, and the price it implies on the company's own figure", () => {
  const me = company("ME", { price: 100, eps: 5, fy1: 6 });
  const peers = [["A", 4], ["B", 5], ["C", 6], ["D", 7], ["E", 8]].map(([t, e]) => company(t, { eps: e }));   // P/E trailing 25, 20, 16.7, 14.3, 12.5
  const read = compsRead(me, peers);
  const bar = read.bars.find((b) => b.key === "pe_ttm");
  assert.equal(bar.ok, true);
  assert.deepEqual(bar.ends.min.who, ["E"]); near(bar.ends.min.m, 12.5); near(bar.ends.min.price, 62.5);
  assert.deepEqual(bar.ends.max.who, ["A"]); near(bar.ends.max.price, 125);
  assert.deepEqual(bar.ends.median.who, ["C"]); near(bar.ends.median.price, 100 / 6 * 5);
  assert.equal(endWords(bar, "min"), "12.5x (E) × EPS, last twelve months $5.00 = $62.50");
  assert.equal(endWords(bar, "max"), "25.0x (A) × EPS, last twelve months $5.00 = $125");
  assert.match(endWords(read.bars.find((b) => b.key === "ev_sales"), "median"), /× revenue TTM \$1000, less net debt, ÷ shares = \$/);
  assert.match(endWords(read.bars.find((b) => b.key === "peg"), "median"), /× \+20% growth × EPS \$6\.00 = \$/);
});

test("the fair band names which row sets its left edge and which its right, and who sits outside", () => {
  const bars = [
    { key: "pe_ttm", label: "P/E, trailing", ok: true, ends: { min: { price: 50, m: 10 }, q1: { price: 80, m: 16 }, median: { price: 100, m: 20 }, q3: { price: 120, m: 24 }, max: { price: 150, m: 30 } } },
    { key: "pe_fwd", label: "P/E, forward", ok: true, ends: { min: { price: 60, m: 8 }, q1: { price: 90, m: 12 }, median: { price: 105, m: 14 }, q3: { price: 130, m: 17 }, max: { price: 160, m: 21 } } },
    { key: "peg", label: "PEG", ok: true, ends: { min: { price: 300, m: 1 }, q1: { price: 320, m: 1.1 }, median: { price: 340, m: 1.2 }, q3: { price: 360, m: 1.3 }, max: { price: 380, m: 1.4 } } },
    { key: "ev_sales", label: "EV / sales", ok: false, ends: {} },
  ];
  const b = fairBand(bars, "mid");
  assert.equal(b.lo, 90); assert.equal(b.hi, 120); assert.equal(b.count, 2); assert.equal(b.of, 3);
  assert.equal(b.edge.lo.key, "pe_fwd"); assert.equal(b.edge.lo.word, "P/E, forward at its 25th-percentile multiple");
  assert.equal(b.edge.hi.key, "pe_ttm"); assert.equal(b.edge.hi.word, "P/E, trailing at its 75th-percentile multiple");
  assert.deepEqual(b.outside, [{ key: "peg", label: "PEG", where: "entirely above the band" }]);
  const full = fairBand(bars, "full");
  assert.equal(full.lo, 60); assert.equal(full.hi, 150); assert.equal(full.edge.lo.word, "P/E, forward at its peer-low multiple");
});

test("outliers OUT changes the implied prices and the band, and the read says so", () => {
  const me = company("ME", { eps: 5 });
  const peers = [4, 5, 5.5, 6, 6.5, 7, 0.4].map((e, i) => company("P" + i, { eps: e }));   // P/E: 25, 20, 18.2, 16.7, 15.4, 14.3, 250 (NM)
  const inn = compsRead(me, peers, { nm: false });
  const out = compsRead(me, peers, { nm: false, outOut: true });
  const bi = inn.bars.find((b) => b.key === "pe_ttm"), bo = out.bars.find((b) => b.key === "pe_ttm");
  assert.equal(bi.ends.max.who[0], "P6"); near(bi.ends.max.price, 1250);
  assert.equal(bo.ends.max.who[0], "P0"); near(bo.ends.max.price, 125);
  assert.equal(inn.outOut, false); assert.equal(out.outOut, true);
  assert.equal(inn.rows.find((r) => r.key === "pe_ttm").outliers.out[0].ticker, "P6");
});

test("the size row places the company: rank, share of the peer range, neighbours", () => {
  const me = company("ME", { mcap: 5000 });
  const peers = [1000, 2000, 8000, 60000].map((m, i) => company("P" + i, { mcap: m }));
  const read = compsRead(me, peers);
  assert.equal(read.size.key, "mcap");
  assert.deepEqual(read.size.position, { rank: 3, of: 5, above: 2, below: 2, along: 4000 / 59000, where: "inside the peer range" });
  assert.equal(read.size.sets.low, "P0"); assert.equal(read.size.sets.high, "P3");
  const sc = rowScale(read.size.peers.map((p) => p.value), read.size.value, { log: true });
  assert.equal(sc.log, true); assert.deepEqual(sc.ticks, [1000, 10000, 100000]);
  near(sc.x(1000), 0); near(sc.x(100000), 1);
});

/* ---- axes and words ---------------------------------------------------------------------------- */

test("nice ticks and the linear row scale", () => {
  assert.deepEqual(niceTicks(0, 100, 5), [0, 20, 40, 60, 80, 100]);
  assert.deepEqual(niceTicks(0.5, 3.7, 5), [1, 2, 3]);
  const sc = rowScale([10, 20, 30], 25);
  assert.equal(sc.log, false); near(sc.x(10) + sc.x(30), 1);
  assert.equal(rowScale([], null), null);
  const same = rowScale([5, 5], 5); assert.ok(same.hi > same.lo);
});

test("the number words", () => {
  assert.equal(fmt("price", 1565.4), "$1,565"); assert.equal(fmt("price", 45.85), "$45.85");
  assert.equal(fmt("money", 1041730560000), "$1.04T"); assert.equal(fmt("money", -18.6e9), "−$18.6B");
  assert.equal(fmt("signed", 0.3447), "+0.345"); assert.equal(fmt("pct1", 4.905), "4.9%"); assert.equal(fmt("days", 3.2), "3 d");
  assert.equal(fmt("x", null), "—");
});

test("verdicts speak for the group; describing rows judge nobody", () => {
  assert.equal(verdict(row("pe_ttm"), 10, 20).side, 1);
  assert.equal(verdict(row("mcap"), 10, 20).side, 0);
  assert.equal(verdict(row("mcap"), 10, 20).word, "smaller than the median peer");
  assert.equal(verdict(row("net_debt"), 10, 20).side, 1);
  assert.equal(verdict(row("results"), 10, 20).word, "weaker results than the peers");
  assert.equal(verdict(row("target_upside"), 30, 20).word, "more room to the target than the peers");
  assert.equal(verdict(row("geiger"), null, 20).word, "no comparison");
});

test("NVDA and MU compare inside semiconductors, GEV inside AI powertrain, others by their first theme tag", () => {
  assert.equal(cohortFor("NVDA", ["TECH"]), "SEMICONDUCTORS");
  assert.equal(cohortFor("MU", []), "SEMICONDUCTORS");
  assert.equal(cohortFor("GEV", []), "AI_POWERTRAIN");
  assert.equal(cohortFor("XYZ", ["MEGA_CAP", "UTILITIES"]), "UTILITIES");
  assert.equal(cohortFor("XYZ", ["MEGA_CAP"], "ai_hardware"), "AI_HARDWARE");
});

/* ---- the page ------------------------------------------------------------------------------------ */

test("the page reads the round-1 columns' tables, carries the way back, and never holds a key", () => {
  const html = readFileSync(join(DIR, "index.html"), "utf8");
  for (const t of ["price_target_consensus", "composite_staged", "ticker_heartbeat_daily", "adjusted_pe", "fundamentals_history", "cashflow_history", "balance_history"]) assert.ok(html.includes(t), "reads " + t);
  assert.ok(html.includes("<!-- scnav ·") && html.includes("data-scnav-slot"), "the BACK / CLOSE pair");
  assert.ok(!/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.\-]{20,}/.test(html), "no key value in the file");
  for (const w of ["off the chart", "outlier", "layoutLabels", "EVERY BAR END, WORKED".toLowerCase(), "proposed, not built"]) assert.ok(html.toLowerCase().includes(w.toLowerCase()), "the page has: " + w);
  assert.ok(html.includes('data-act="outOut"'), "the outliers control");
  assert.ok(!/(#|rgba?\()[^;]*\b(fff|ffffff|white)\b/i.test(html.replace(/--ink:#F2F2F8/g, "")), "no white");
});

test("the write-up exists and covers what the brief asks in plain words", () => {
  const html = readFileSync(join(DIR, "COMPS-R3.html"), "utf8");
  for (const w of ["what the page shows", "where each number comes from", "what could be wrong", "what I did not do", "outlier", "allocation", "cohort", "decisions"]) assert.ok(html.toLowerCase().includes(w), "write-up covers: " + w);
});
