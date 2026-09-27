import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
  median, band, fieldRow, toggleOut, forwardPE, revenueGrowth, sessionsBetween, calendarDays,
  sigmaEvents, fit, capClass, buildRow, money, fmtMetric, METRICS, DEFAULT_PREFS,
  applyToggles, CLASS_TOGGLE, RISK_LEVEL, compareBands, orderRows,
  epsGrowth, targetUpside, THEMES, themeFit, themeAnalysis, inferTheme, lcSplit, SLEEVE_CAPS, sleeveOf, pickAllowed, roundRobin, SCENARIOS, scenarioFor, metric,
} from "../deliverables/20260925/knockout/field.mjs";

const TODAY = "2026-09-25";
const DIR = join(process.cwd(), "deliverables", "20260925", "knockout");

/* ---- band, median, knockouts ------------------------------------------------------------ */

test("median: odd, even, and nulls are not values", () => {
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
  assert.equal(median([null, 7, undefined, "x"]), 7);
  assert.equal(median([]), null);
});

test("the band is the range of the names still in, the tick is their median", () => {
  const names = [{ ticker: "A", value: 10 }, { ticker: "B", value: 20 }, { ticker: "C", value: 40 }, { ticker: "D", value: null }];
  const r = fieldRow(names);
  assert.equal(r.min, 10); assert.equal(r.max, 40); assert.equal(r.median, 20); assert.equal(r.n, 3);
  assert.equal(r.points.find((p) => p.ticker === "A").x, 0);
  assert.equal(r.points.find((p) => p.ticker === "C").x, 1);
  assert.equal(r.points.find((p) => p.ticker === "D").x, null, "a name with no value has no place on the row");
  assert.equal(r.tick, (20 - 10) / 30);
});

test("knocking a name out shrinks the band and moves the median; bringing it back restores both", () => {
  const names = [{ ticker: "A", value: 10 }, { ticker: "B", value: 20 }, { ticker: "C", value: 40 }];
  let out = toggleOut(new Set(), "C");
  let r = fieldRow(names, out);
  assert.equal(r.max, 20); assert.equal(r.median, 15); assert.equal(r.n, 2);
  const c = r.points.find((p) => p.ticker === "C");
  assert.equal(c.in, false);
  assert.equal(c.off_band, true, "the knocked-out name now sits outside the band of the names in");
  out = toggleOut(out, "C");
  r = fieldRow(names, out);
  assert.equal(r.max, 40); assert.equal(r.median, 20); assert.equal(r.n, 3);
});

test("toggleOut never mutates the set it was given", () => {
  const a = new Set(["X"]);
  const b = toggleOut(a, "Y");
  assert.deepEqual([...a], ["X"]);
  assert.deepEqual([...b].sort(), ["X", "Y"]);
});

test("a band of one value puts the name and the tick in the middle", () => {
  const r = fieldRow([{ ticker: "A", value: 5 }]);
  assert.equal(r.points[0].x, 0.5); assert.equal(r.tick, 0.5); assert.equal(r.min, r.max);
});

test("an empty round has no band", () => {
  const r = fieldRow([{ ticker: "A", value: 5 }], new Set(["A"]));
  assert.equal(r.n, 0); assert.equal(r.min, null); assert.equal(r.tick, null);
});

/* ---- derived numbers -------------------------------------------------------------------- */

const EST = [
  { period: "annual", fiscal_date: "2025-12-31", est_eps_avg: 7.28, est_revenue_avg: 37.3e9, num_analysts_eps: 16, num_analysts_rev: 17 },
  { period: "annual", fiscal_date: "2026-12-31", est_eps_avg: 30.64, est_revenue_avg: 46.29e9, num_analysts_eps: 15, num_analysts_rev: 24 },
  { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: 24.54, est_revenue_avg: 52.99e9, num_analysts_eps: 20, num_analysts_rev: 26 },
];

test("P/E on the FY estimate uses the first fiscal year ending on or after today", () => {
  const r = forwardPE(956.56, EST, TODAY);
  assert.equal(r.fiscal_date, "2026-12-31");
  assert.ok(Math.abs(r.value - 956.56 / 30.64) < 1e-9);
  assert.equal(r.analysts, 15);
});

test("a negative estimated EPS gives no multiple, and says why", () => {
  const r = forwardPE(38, [{ period: "annual", fiscal_date: "2026-12-31", est_eps_avg: -1.0 }], TODAY);
  assert.equal(r.value, null);
  assert.match(r.reason, /not positive/);
  assert.equal(forwardPE(38, [], TODAY).reason, "no estimate on file");
});

test("revenue growth is next FY over the first FY on or after today", () => {
  const r = revenueGrowth(EST, TODAY);
  assert.equal(r.from, "2026-12-31"); assert.equal(r.to, "2027-12-31");
  assert.ok(Math.abs(r.value - (52.99 / 46.29 - 1) * 100) < 1e-9);
  assert.equal(revenueGrowth(EST.slice(0, 2), TODAY).value, null);
});

test("sessions between dates count weekdays only, and calendar days count everything", () => {
  assert.equal(sessionsBetween("2026-09-25", "2026-09-28"), 1, "Friday to Monday is one session");
  assert.equal(sessionsBetween("2026-09-25", "2026-10-27"), 22);
  assert.equal(sessionsBetween("2026-09-25", "2026-09-25"), 0);
  assert.equal(calendarDays("2026-09-25", "2026-10-27"), 32);
});

test("sigma events: a move of at least twice the usual day counts, inside the lookback only", () => {
  const closes = [100, 101, 100, 108, 108, 107.5]; // +1%, −1%, +8%, 0, −0.5%
  const r = sigmaEvents(closes, 3, { lookback: 20 });
  assert.equal(r.count, 1);
  assert.ok(Math.abs(r.events[0].x - 8 / 3) < 1e-9);
  assert.equal(sigmaEvents(closes, 3, { lookback: 2 }).count, 0, "the +8% day is outside a 2-session lookback");
  assert.equal(sigmaEvents(closes, null).count, null);
});

test("cap class prefers the cohort tag and falls back to the $10B line", () => {
  assert.equal(capClass(["AI_POWERTRAIN", "MEGA_CAP"], 3e11).label, "mega cap");
  assert.equal(capClass(["AI_POWERTRAIN"], 2e9).label, "small cap");
  assert.equal(capClass(["AI_POWERTRAIN"], 2e10).label, "large cap");
  assert.equal(capClass([], null).label, "size unknown");
});

/* ---- round 1 · fit, in sentences --------------------------------------------------------- */

test("fit: a small cap is greyed out with a full sentence that names the number, its date and the floor", () => {
  const r = fit({ ticker: "EOSE", mcap: 1999522184, mcap_date: "2026-09-18", eps_ttm: -6.68, eps_date: "2026-09-18", tags: ["SMALL_CAP"] });
  assert.equal(r.in, false);
  assert.match(r.why[0], /^EOSE is out of this round: its market value is \$2\.0B \(measured 18 Sep\), below the \$10\.0B floor you set/);
  assert.equal(r.why.length, 2, "it also fails the earnings rule, and both sentences are kept");
});

test("fit: a theme marked out carries Alan's reason in his words", () => {
  const r = fit({ ticker: "CCJ", mcap: 63e9, mcap_date: "2026-09-25", eps_ttm: 0.82, tags: ["URANIUM", "LARGE_CAP"] });
  assert.equal(r.in, false);
  assert.match(r.why[0], /tagged uranium, and you marked that theme out — nuclear — its time will come, not right now\.$/);
});

test("fit: a 'handle with care' theme stays in and says so", () => {
  const r = fit({ ticker: "CEG", mcap: 88e9, mcap_date: "2026-09-25", eps_ttm: 10.29, tags: ["UTILITIES", "LARGE_CAP"] });
  assert.equal(r.in, true);
  assert.equal(r.care.length, 1);
  assert.match(r.care[0], /^CEG stays in, with care: it is tagged utilities — utilities are super cheap/);
});

test("fit: the defaults are editable — drop the floor and the earnings rule and OKLO is in", () => {
  const row = { ticker: "OKLO", mcap: 9.2e9, mcap_date: "2026-09-20", eps_ttm: -0.95, tags: ["MID_CAP", "UTILITIES"] };
  assert.equal(fit(row).in, false);
  const prefs = { ...DEFAULT_PREFS, cap_floor_usd: 1e9, needs_earnings: false, themes_care: {} };
  const r = fit(row, prefs);
  assert.equal(r.in, true);
  assert.match(r.why[0], /^OKLO stays in: \$9\.2B of market value/);
});

test("the allocation tool's toggles are presets over the same rules, and the rules stay editable", () => {
  const p = applyToggles(DEFAULT_PREFS, { cls: "LARGE_AND_SMALL", risk: "HIGH" });
  assert.equal(p.cap_floor_usd, 0); assert.equal(p.needs_earnings, false); assert.equal(p.care_is_out, false);
  const q = applyToggles(p, { risk: "LOW" });
  assert.equal(q.cap_floor_usd, 0, "the risk level does not touch the cap floor");
  assert.equal(q.needs_earnings, true); assert.equal(q.care_is_out, true);
  assert.equal(DEFAULT_PREFS.cap_floor_usd, CLASS_TOGGLE.LARGE_ONLY.cap_floor_usd, "the default is the tool's own line");
  assert.equal(RISK_LEVEL[DEFAULT_PREFS.risk_level].needs_earnings, DEFAULT_PREFS.needs_earnings);
  assert.deepEqual(applyToggles(DEFAULT_PREFS, { cls: "NOPE" }), { ...DEFAULT_PREFS }, "an unknown toggle changes nothing");
});

test("at low risk a handle-with-care theme is out, with the reason and the rule in the sentence", () => {
  const row = { ticker: "CEG", mcap: 88e9, mcap_date: "2026-09-25", eps_ttm: 10.29, tags: ["UTILITIES", "LARGE_CAP"] };
  const r = fit(row, applyToggles(DEFAULT_PREFS, { risk: "LOW" }));
  assert.equal(r.in, false);
  assert.match(r.why[0], /^CEG is out of this round: it is tagged utilities, which you marked handle with care — utilities are super cheap.*— and at low risk, care means out\.$/);
  assert.equal(fit(row, applyToggles(DEFAULT_PREFS, { risk: "MEDIUM" })).in, true);
});

test("a fund is not a company: it stays on the table and takes no part in the rounds", () => {
  const r = fit({ ticker: "XLU", is_etf: true, mcap: null, eps_ttm: null, tags: ["UTILITIES"] });
  assert.equal(r.in, false);
  assert.equal(r.why.length, 1);
  assert.match(r.why[0], /^XLU is a fund, not a company/);
  const row = buildRow({ ticker: "XLU", cohort: "UTILITIES", cohorts: ["UTILITIES"], profile: { name: "Utilities Select Sector SPDR", is_etf: true } }, TODAY);
  assert.equal(row.is_etf, true);
});

test("station targets keep Alan's order; a cohort is alphabetical", () => {
  const rows = [{ ticker: "VST", position: 6 }, { ticker: "GOOGL", position: 1 }, { ticker: "BE", position: 4 }];
  assert.deepEqual(orderRows(rows, "STATION").map((r) => r.ticker), ["GOOGL", "BE", "VST"]);
  assert.deepEqual(orderRows(rows, "AI_POWERTRAIN").map((r) => r.ticker), ["BE", "GOOGL", "VST"]);
});

test("two scenarios side by side: each metric carries both bands of the names still in", () => {
  const A = [{ ticker: "A1", metrics: { pe_ttm: 20 } }, { ticker: "A2", metrics: { pe_ttm: 30 } }, { ticker: "A3", metrics: { pe_ttm: 90 } }];
  const B = [{ ticker: "B1", metrics: { pe_ttm: 15 } }, { ticker: "B2", metrics: { pe_ttm: 17 } }];
  const c = compareBands(A, B, new Set(["A3"]));
  const pe = c.find((x) => x.key === "pe_ttm");
  assert.equal(pe.a.median, 25); assert.equal(pe.a.n, 2, "A3 is out and takes no part");
  assert.equal(pe.b.median, 16); assert.equal(pe.b.max, 17);
  assert.equal(c.find((x) => x.key === "geiger").a.n, 0, "a metric with no values has an empty band, not a fake one");
});

/* ---- a row from the Hub's own reads ------------------------------------------------------ */

test("a utility inside the UTILITIES cohort is still a utility to the theme step and the care rule", () => {
  const row = buildRow({ ticker: "ATO", cohort: "UTILITIES", cohorts: ["UTILITIES", "REGULATED_GAS", "LARGE_CAP"], fundamentals: { market_cap: 29e9, eps_ttm: 8.4 } }, TODAY);
  assert.deepEqual(row.tags, ["REGULATED_GAS", "LARGE_CAP"], "the chips do not repeat the group's own name");
  assert.deepEqual(row.all_tags, ["UTILITIES", "REGULATED_GAS", "LARGE_CAP"]);
  assert.equal(themeFit(row, THEMES.find((t) => t.key === "DEFENSIVE")).fits, true);
  assert.equal(fit(row).care.length, 1, "handle with care applies inside the cohort too");
});

test("buildRow keeps every number with its own date and never invents a missing one", () => {
  const row = buildRow({
    ticker: "GEV", cohort: "AI_POWERTRAIN", cohorts: ["AI_POWERTRAIN", "INDUSTRIAL", "MEGA_CAP"],
    profile: { name: "GE Vernova Inc.", industry: "Industrial - Machinery" },
    fundamentals: { price: 925.52, market_cap: 314862480000, trailing_pe: 26.57, adjusted_pe: 31.42, eps_ttm: 34.83, revenue_ttm: 41368000000, updated_ts: 1789711624 },
    estimates: EST, balance: { fiscal_date: "2025-12-31", net_debt: -8848000000 },
    geiger: { composite: -0.137737, updated_ts: 1787584061 }, heartbeat: { date: "2026-09-24", usual_day_60: 3.203 },
    quote: { price: 956.56, price_observation_utc: "2026-09-25T20:00:00Z" },
    earnings: [{ date: "2026-10-28", eps_estimate: 4.08 }],
  }, TODAY);
  assert.equal(row.name, "GE Vernova Inc.");
  assert.equal(row.cap.label, "mega cap");
  assert.equal(row.price, 956.56); assert.equal(row.price_from, "chart API quote");
  assert.equal(row.dates.mcap, "2026-09-18");
  assert.equal(row.dates.geiger, "2026-08-24", "the board's Geiger source carries its own, older stamp");
  assert.equal(row.metrics.net_debt, -8848000000);
  assert.equal(row.next_report.sessions, 23); assert.equal(row.next_report.days, 33);
  assert.deepEqual(row.tags, ["INDUSTRIAL", "MEGA_CAP"]);
  const bare = buildRow({ ticker: "X", cohort: "C", cohorts: ["C"] }, TODAY);
  assert.equal(bare.metrics.pe_fwd, null); assert.equal(bare.next_report, null); assert.equal(bare.price, null);
});

test("a negative trailing P/E is not a multiple", () => {
  const row = buildRow({ ticker: "OKLO", cohort: "C", cohorts: ["C"], fundamentals: { trailing_pe: -40.1, adjusted_pe: null, eps_ttm: -0.95 } }, TODAY);
  assert.equal(row.metrics.pe_ttm, null); assert.equal(row.metrics.pe_adj, null);
});

test("numbers print in plain units", () => {
  assert.equal(money(314862480000), "$315B"); assert.equal(money(1999522184), "$2.0B"); assert.equal(money(-8848000000), "−$8.8B");
  assert.equal(fmtMetric(METRICS.find((m) => m.key === "pe_ttm"), 26.57), "26.6x");
  assert.equal(fmtMetric(METRICS.find((m) => m.key === "rev_growth"), 14.48), "+14%");
  assert.equal(fmtMetric(METRICS.find((m) => m.key === "geiger"), -0.1377), "−0.14");
  assert.equal(fmtMetric(METRICS.find((m) => m.key === "usual"), 3.203), "±3.2%");
});


/* ---- forward growth, first-class (Alan, 25 Sep 10:30 PM) ------------------------------------- */

test("EPS growth next FY is the second estimate over the first, and needs a positive first year", () => {
  const r = epsGrowth(EST, TODAY);
  assert.equal(r.from, "2026-12-31"); assert.equal(r.to, "2027-12-31");
  assert.ok(Math.abs(r.value - (24.54 / 30.64 - 1) * 100) < 1e-9, "a fall in EPS is negative growth, not hidden");
  assert.equal(epsGrowth([{ period: "annual", fiscal_date: "2026-12-31", est_eps_avg: -1 }, { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: 2 }], TODAY).value, null, "growth on a loss means nothing");
});

test("room to the analyst target is target over price minus one, in percent", () => {
  const r = targetUpside(100, [{ period: "annual", fiscal_date: "2026-12-31", price_target_avg: 125 }], TODAY);
  assert.ok(Math.abs(r.value - 25) < 1e-9);
  assert.equal(targetUpside(100, [{ period: "annual", fiscal_date: "2026-12-31" }], TODAY).value, null);
  assert.equal(targetUpside(null, [{ period: "annual", fiscal_date: "2026-12-31", price_target_avg: 125 }], TODAY).reason, "no price");
});

test("buildRow carries the two new rows with their own dates", () => {
  const row = buildRow({ ticker: "GEV", cohort: "AI_POWERTRAIN", cohorts: ["AI_POWERTRAIN"], fundamentals: { price: 925.52 },
    estimates: EST.map((e) => ({ ...e, price_target_avg: 1266.38, updated_ts: 1790338627 })) }, TODAY);
  assert.ok(Math.abs(row.metrics.eps_growth - (24.54 / 30.64 - 1) * 100) < 1e-9);
  assert.equal(row.dates.eps_growth, "FY2026→2027");
  assert.ok(Math.abs(row.metrics.target_upside - (1266.38 / 925.52 - 1) * 100) < 1e-9);
  assert.equal(row.dates.target_upside, "2026-09-25", "the target carries the estimates' own write date");
});

/* ---- the client designer's mechanic: theme first, sleeves under caps, one narrowing rule ------ */

test("a name fits a theme through its tags, or is greyed with a sentence that names its own tags", () => {
  const power = THEMES.find((t) => t.key === "POWER_FOR_AI");
  assert.equal(themeFit({ ticker: "GEV", tags: ["INDUSTRIAL", "MEGA_CAP", "RENEWABLE_UTILITIES"] }, power).fits, true);
  const g = themeFit({ ticker: "GOOGL", tags: ["COMMS", "MEGA_CAP"] }, power);
  assert.equal(g.fits, false);
  assert.match(g.why, /^GOOGL is greyed for this theme: it is tagged comms, and none of that is part of "power for AI"\.$/);
  assert.equal(themeFit({ ticker: "X", tags: [] }, THEMES[0]).fits, true, "no theme stated: everyone plays");
});

test("theme analysis says which themes can carry the group, per sleeve, in the designer's idiom", () => {
  const rows = [
    { ticker: "GEV", tags: ["AI_POWERTRAIN", "MEGA_CAP"], cap: { tag: "MEGA_CAP" }, mcap: 3e11 },
    { ticker: "CEG", tags: ["AI_POWERTRAIN", "UTILITIES", "LARGE_CAP"], cap: { tag: "LARGE_CAP" }, mcap: 9e10 },
    { ticker: "SMR", tags: ["AI_POWERTRAIN", "MID_CAP"], cap: { tag: "MID_CAP" }, mcap: 3.6e9 },
    { ticker: "XLU", tags: ["UTILITIES"], is_etf: true, cap: { tag: null } },
  ];
  const a = themeAnalysis(rows, THEMES, { LC: 4, SC: 2, total: 12 }, true);
  const power = a.find((x) => x.key === "POWER_FOR_AI");
  assert.equal(power.lc, 2); assert.equal(power.sc, 1);
  assert.match(power.verdict, /^thin: 2 large caps for a sleeve of 4$/);
  assert.equal(a.find((x) => x.key === "MEGA_EARNERS").names.join(), "GEV");
  const both = themeAnalysis(rows, THEMES, { LC: 2, SC: 1, total: 12 }, false).find((x) => x.key === "POWER_FOR_AI");
  assert.equal(both.verdict, "fills both sleeves");
  assert.equal(themeAnalysis(rows, THEMES, SLEEVE_CAPS, false).find((x) => x.key === "DEFENSIVE").verdict, "cannot fill the small-cap sleeve", "the fund does not count and SMR is not a utility tag");
});

test("the reverse direction: the liked list says which theme you are already in", () => {
  const rows = [
    { ticker: "GOOGL", tags: ["COMMS", "MEGA_CAP"] }, { ticker: "AVGO", tags: ["AI_HARDWARE", "MEGA_CAP"] },
    { ticker: "MU", tags: ["AI_HARDWARE", "MEGA_CAP"] }, { ticker: "WMT", tags: ["STAPLES", "MEGA_CAP"] },
  ];
  const r = inferTheme(rows, new Set(["AVGO", "MU", "WMT"]));
  assert.equal(r.top.key, "MEGA_EARNERS", "3 of 3 liked are mega caps");
  assert.match(r.sentence, /^You already like AVGO, MU, WMT; 3 of 3 fit "mega caps that already earn"/);
  assert.equal(inferTheme(rows, new Set()).top, null);
});

test("the allocation tool's split: 50% + (IWM − SPY) × 50%, capped 20–80", () => {
  assert.ok(Math.abs(lcSplit(0.17783, 0.189475).lc - 50.58225) < 1e-6);
  assert.equal(lcSplit(-0.9, 0.9).lc, 80); assert.equal(lcSplit(0.9, -0.9).lc, 20);
  assert.equal(lcSplit(null, 0.1).lc, null);
});

test("PICK is refused, with a sentence, when the sleeve or the book is full", () => {
  const gev = { ticker: "GEV", cap: { tag: "MEGA_CAP" }, mcap: 3e11 };
  const smr = { ticker: "SMR", cap: { tag: "MID_CAP" }, mcap: 3.6e9 };
  assert.equal(sleeveOf(gev), "LC"); assert.equal(sleeveOf(smr), "SC");
  const picks = [{ ticker: "CEG", sleeve: "LC", cohort: "AI_POWERTRAIN" }, { ticker: "VST", sleeve: "LC", cohort: "AI_POWERTRAIN" }];
  assert.equal(pickAllowed(gev, picks, { LC: 2, SC: 2, total: 12 }, "AI_POWERTRAIN").ok, false);
  assert.match(pickAllowed(gev, picks, { LC: 2, SC: 2, total: 12 }, "AI_POWERTRAIN").why, /large-cap sleeve of this group already holds 2 \(CEG, VST\), its cap of 2 names\.$/);
  assert.equal(pickAllowed(gev, picks, { LC: 4, SC: 2, total: 12 }, "AI_POWERTRAIN").ok, true);
  assert.equal(pickAllowed(smr, picks, { LC: 2, SC: 2, total: 12 }, "AI_POWERTRAIN").ok, true, "the small-cap sleeve is empty");
  assert.match(pickAllowed(smr, picks, { LC: 4, SC: 2, total: 2 }).why, /hard cap of 2/);
  assert.equal(pickAllowed(gev, [...picks, { ticker: "GEV", sleeve: "LC", cohort: "AI_POWERTRAIN" }], { LC: 3, SC: 2, total: 12 }, "AI_POWERTRAIN").ok, true, "a name already picked is not counted against itself");
  assert.equal(pickAllowed(gev, [...picks, { ticker: "GEV", sleeve: "LC", cohort: "AI_POWERTRAIN" }], { LC: 2, SC: 2, total: 12 }, "AI_POWERTRAIN").ok, false, "but the others still fill the sleeve");
});

/* ---- round 2 · the round robin ---------------------------------------------------------------- */

test("round robin: every name plays every other on every playing row; the better number wins", () => {
  const rows = [
    { ticker: "A", metrics: { pe_ttm: 10, pe_fwd: 8,  eps_growth: 20,  rev_growth: 10, target_upside: 5,  net_debt: -1 } },
    { ticker: "B", metrics: { pe_ttm: 20, pe_fwd: 12, eps_growth: 30,  rev_growth: 10, target_upside: 15, net_debt: 5 } },
    { ticker: "C", metrics: { pe_ttm: null, pe_fwd: 30, eps_growth: null, rev_growth: 40, target_upside: null, net_debt: 0 } },
  ];
  const rr = roundRobin(rows);
  assert.deepEqual(rr.metrics, ["pe_ttm", "pe_fwd", "eps_growth", "rev_growth", "target_upside", "net_debt"], "the rows that play by default");
  const A = rr.standings.find((s) => s.ticker === "A"), B = rr.standings.find((s) => s.ticker === "B"), C = rr.standings.find((s) => s.ticker === "C");
  assert.equal(A.seed, 1);
  assert.equal(A.wins, 5); assert.equal(A.draws, 1); assert.equal(A.losses, 3); assert.equal(A.points, 5.5); assert.equal(A.played, 9);
  assert.equal(rr.matrix.A.B.for, 3); assert.equal(rr.matrix.A.B.against, 2); assert.equal(rr.matrix.A.B.draws, 1, "A and B drew on revenue growth");
  assert.equal(rr.matrix.A.C.played, 3, "games where C has no number are not played");
  assert.equal(C.played, 6);
  assert.equal(A.byMetric.pe_ttm, 1, "A beat B on trailing P/E; C had none");
  assert.equal(rr.games, 12);
});

test("round robin: a knocked-out name sits out, and a row can be taken out of the game", () => {
  const rows = [
    { ticker: "A", metrics: { pe_ttm: 10, pe_fwd: 8 } }, { ticker: "B", metrics: { pe_ttm: 20, pe_fwd: 6 } }, { ticker: "C", metrics: { pe_ttm: 5, pe_fwd: 50 } },
  ];
  const all = roundRobin(rows, new Set(), new Set(["pe_ttm", "pe_fwd"]));
  assert.equal(all.standings[0].ticker, "A", "A wins 2 of 4 with the better balance");
  const noFwd = roundRobin(rows, new Set(), new Set(["pe_ttm"]));
  assert.equal(noFwd.standings[0].ticker, "C", "on trailing P/E alone the cheapest name leads");
  const cOut = roundRobin(rows, new Set(["C"]), new Set(["pe_ttm"]));
  assert.deepEqual(cOut.standings.map((s) => s.ticker), ["A", "B"]);
  assert.equal(cOut.matrix.C, undefined);
  const one = roundRobin(rows.slice(0, 1));
  assert.equal(one.standings[0].pct, null, "one name plays nobody and has no percentage");
});

test("higher-is-better rows win the other way, and a size row never judges", () => {
  const rows = [{ ticker: "A", metrics: { eps_growth: 10, rev_ttm: 1e9 } }, { ticker: "B", metrics: { eps_growth: 30, rev_ttm: 9e9 } }];
  const rr = roundRobin(rows, new Set(), new Set(["eps_growth", "rev_ttm"]));
  assert.equal(rr.standings[0].ticker, "B");
  assert.deepEqual(rr.metrics, ["eps_growth"], "rev_ttm has no direction and is ignored even when asked for");
  assert.equal(metric("geiger").plays, false, "timing rows sit out of the comps round robin by default");
});

test("the three scenarios are fixed; any other cohort is one at a time", () => {
  assert.deepEqual(Object.keys(SCENARIOS), ["UTILITIES", "AI_POWERTRAIN", "STATION"]);
  assert.equal(SCENARIOS.STATION.kind, "targets");
  assert.equal(scenarioFor("station").key, "STATION");
  assert.equal(scenarioFor(null, "ai_hardware").cohort, "AI_HARDWARE");
});

/* ---- the page and the migration ---------------------------------------------------------- */

test("the workshop page imports this arithmetic, carries the three rounds, and keeps the house rules", () => {
  const html = readFileSync(join(DIR, "index.html"), "utf8");
  assert.match(html, /from ["']\.\/field\.mjs["']/, "the page must use the tested arithmetic, not a copy");
  for (const s of ["TABLE", "FIELD", "CARDS", "FIT", "COMPS", "TIMING", "FINAL"]) assert.ok(html.includes(`data-stage="${s}"`), `stage ${s} is on the page`);
  for (const s of ["UTILITIES", "AI_POWERTRAIN", "STATION"]) assert.ok(html.includes(`data-scenario="${s}"`), `scenario ${s} is on the page`);
  assert.ok(html.includes("station_targets?select=") && html.includes("order=position.asc"), "the station scenario reads station_targets in position order");
  assert.ok(html.includes("hub_favorites?select=ticker"), "the reverse direction reads the LIKED list");
  assert.ok(html.includes('data-act="theme-pick"') && html.includes("themeAnalysis(") && html.includes("inferTheme("), "the theme step is the client designer's mechanic");
  assert.ok(html.includes("roundRobin(") && html.includes("pickAllowed("), "round 2 is a round robin and the final is capped");
  assert.ok(html.includes("quotes.quotes"), "the price comes from the chart API's quotes map");
  assert.doesNotMatch(html, /#fff\b|#ffffff|\bwhite\b(?!-space)/i, "no white");
  const hexes = [...html.matchAll(/#([0-9a-f]{6})\b/gi)].map((m) => m[1].toLowerCase());
  const greys = hexes.filter((h) => { const [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) <= 24; });
  const colour = hexes.filter((h) => !greys.includes(h));
  for (const h of greys) assert.ok(Math.max(...[0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16))) <= 210, `#${h} is brighter than the house allows`);
  assert.ok(colour.every((h) => html.includes(`--up:#${h}`) || html.includes(`--dn:#${h}`)), `only the up/down pair may carry colour: ${colour.join(",")}`);
  assert.doesNotMatch(html, /eyJ[A-Za-z0-9._-]{40,}/, "no key is committed in the page");
  assert.ok(html.includes("localStorage"), "the workshop saves to this browser only");
  assert.doesNotMatch(html, /operator_decisions\?|operator_preferences\?/, "the page never writes the proposed tables");
});

test("the migration adds the two operator tables, is additive, and carries its rollback", () => {
  const sql = readFileSync(join(process.cwd(), "supabase", "migrations", "20260925_operator_decisions.sql"), "utf8");
  assert.match(sql, /create table if not exists public\.operator_decisions/);
  assert.match(sql, /create table if not exists public\.operator_preferences/);
  for (const c of ["ticker", "cohort", "decision", "reason", "heat_at", "made_at", "expires_on"]) assert.ok(sql.includes(c), `operator_decisions carries ${c}`);
  for (const c of ["key", "value", "reason", "updated_at"]) assert.ok(sql.includes(c), `operator_preferences carries ${c}`);
  const applied = sql.slice(0, sql.indexOf("-- ROLLBACK"));
  assert.ok(applied.length > 0, "the rollback section is marked");
  assert.doesNotMatch(applied, /\b(drop|delete|truncate|alter table .* drop)\b/i, "the applied half never removes anything");
  assert.match(sql.slice(sql.indexOf("-- ROLLBACK")), /drop table if exists public\.operator_decisions/);
});

test("the write-up exists beside the workshop", () => {
  assert.ok(existsSync(join(DIR, "KNOCKOUT.html")));
});
