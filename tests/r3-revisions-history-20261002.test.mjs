/* R3 (2 Oct 2026, night) — analyst revisions part two: the deep backfill and the estimate snapshots (analyst-revisions v2,
   pure part) + the ESTIMATES tab's rating tape, 00b TARGETS BY FIRM and the FY+1 / FY+2 estimates beside the arrows.
   Fixtures are rows as FMP and the database returned them on 2 Oct. No network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as L from "../supabase/functions/analyst-revisions/lib.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const html = read("index.html");
const fnSrc = read("supabase/functions/analyst-revisions/index.ts");
const mig = read("supabase/migrations/20261002_analyst_estimates_daily.sql");
const rb = read("supabase/migrations/20261002_analyst_estimates_daily_ROLLBACK.sql");

/* ---------- the function's pure part ---------- */
test("deep paging: keep going while the page's oldest note is newer than the cutoff; stop past it or on an empty page", () => {
  const cut = "2024-10-02T00:00:00.000Z";
  assert.equal(L.deepKeepPaging([{ publishedDate: "2026-01-01T00:00:00.000Z" }, { publishedDate: "2025-03-01T00:00:00.000Z" }], cut), true);
  assert.equal(L.deepKeepPaging([{ publishedDate: "2025-03-01T00:00:00.000Z" }, { publishedDate: "2024-09-30T00:00:00.000Z" }], cut), false, "this page reaches past 2 years: it is the last");
  assert.equal(L.deepKeepPaging([], cut), false);
  assert.equal(L.deepKeepPaging([{ publishedDate: "" }], cut), false, "no dates → stop, never loop");
  assert.equal(L.oldestOf([{ publishedDate: "2025-03-01T00:00:00.000Z" }, { publishedDate: "2024-01-19 15:04:00" }]), "2024-01-19T15:04:00.000Z");
});
test("FMP analyst-estimates → one snapshot row (NVDA FY ending 25 Jan 2028, as FMP sent it on 2 Oct)", () => {
  const x = { symbol: "NVDA", date: "2028-01-25", revenueLow: 601e9, revenueHigh: 790e9, revenueAvg: 691862290915, ebitdaAvg: 4.5e11, netIncomeAvg: 3.8e11,
    epsAvg: 15.75077, epsHigh: 18.1, epsLow: 13.2, numAnalystsRevenue: 35, numAnalystsEps: 33 };
  const r = L.estimateRow(x, "NVDA", "annual", "2026-10-02");
  assert.deepEqual(r, { ticker: "NVDA", period: "annual", fiscal_date: "2028-01-25", as_of_date: "2026-10-02", revenue_avg: 691862290915, revenue_low: 601e9,
    revenue_high: 790e9, ebitda_avg: 4.5e11, net_income_avg: 3.8e11, eps_avg: 15.75077, eps_low: 13.2, eps_high: 18.1, analysts_revenue: 35, analysts_eps: 33, source: "fmp" });
  assert.equal(L.estimateRow({ ...x, date: "" }, "NVDA", "annual", "2026-10-02"), null);
});
test("the snapshot window keeps the years and quarters near today, not FMP's 40 years", () => {
  const d = "2026-10-02";
  assert.equal(L.inSnapshotWindow("annual", "2027-01-25", d), true);
  assert.equal(L.inSnapshotWindow("annual", "2026-01-25", d), true, "the year just ended (~8 months) stays");
  assert.equal(L.inSnapshotWindow("annual", "2024-01-25", d), false);
  assert.equal(L.inSnapshotWindow("annual", "2035-01-25", d), false);
  assert.equal(L.inSnapshotWindow("quarter", "2026-07-25", d), true);
  assert.equal(L.inSnapshotWindow("quarter", "2025-12-31", d), false);
  assert.equal(L.inSnapshotWindow("quarter", "2030-01-25", d), false);
});
test("the R2 mirror's CSV: quoted fields, header order, as-of = the row's own updated_ts as a New York date", () => {
  const csv = 'ticker,period,fiscal_date,est_eps_avg,est_eps_high,est_eps_low,est_revenue_avg,price_target_avg,updated_ts,est_ebitda_avg,est_ebit_avg,est_net_income_avg,num_analysts_eps,num_analysts_rev\n' +
    'NVDA,annual,2028-01-25,12.77625,14,11,563601060724,,1786460000,,,,31,33\n' +
    '"BRK,B",annual,2026-12-31,1,,,"2",,1786460000,,,,,\n' +
    'MU,quarter,2026-11-27,10,,,5,,0,,,,,\n';
  const recs = L.parseCsv(csv);
  assert.equal(recs.length, 3);
  assert.equal(recs[1].ticker, "BRK,B");
  const r = L.mirrorEstimateRow(recs[0], "r2:tables/analyst_estimates/all.csv.gz");
  assert.equal(r.as_of_date, "2026-08-11");
  assert.equal(r.eps_avg, 12.77625); assert.equal(r.revenue_avg, 563601060724); assert.equal(r.analysts_eps, 31); assert.equal(r.analysts_revenue, 33);
  assert.equal(r.revenue_low, null, "the August copy has no revenue low / high: null, never 0");
  assert.equal(L.mirrorEstimateRow(recs[2], "x"), null, "no updated_ts → no date → no row");
  const dd = L.dedupeEst([r, { ...r }, null]);
  assert.equal(dd.length, 1);
});
test("the function: v2, three modes, the R2 read is GET-only and the error text hides keys", () => {
  assert.match(fnSrc, /const VERSION = "analyst-revisions-v2"/);
  assert.match(fnSrc, /mode !== "pass" && mode !== "backfill" && mode !== "estimates"/);
  assert.match(fnSrc, /analyst_estimates_daily/);
  assert.ok(!/"PUT"|"DELETE"|method: "POST"/.test(fnSrc), "R2 is only read");
  assert.match(fnSrc, /ignoreDuplicates: true/, "the seed never overwrites a row already stored");
  assert.match(fnSrc, /Credential=…/);
  assert.ok(!/console\.log\([^)]*K\b/.test(fnSrc), "the key is never logged");
  assert.match(fnSrc, /\/stable\//);
});
test("the migration is additive with a rollback that drops only the new table", () => {
  assert.match(mig, /create table if not exists public\.analyst_estimates_daily/);
  assert.match(mig, /primary key \(ticker, period, fiscal_date, as_of_date\)/);
  assert.match(mig, /for select to anon/);
  assert.ok(!/\b(alter|drop)\s+table\s+(?!public\.analyst_estimates_daily)/i.test(mig.replace(/alter table public\.analyst_estimates_daily enable row level security;/, "")));
  assert.deepEqual(rb.split("\n").filter((l) => l && !l.startsWith("--")), ["drop table if exists public.analyst_estimates_daily;"]);
});

/* ---------- the Hub ---------- */
const a = html.indexOf("/* R2C-REVISIONS:BEGIN"), b = html.indexOf("/* R2C-REVISIONS:END */");
const a3 = html.indexOf("/* R3-REVISIONS:BEGIN"), b3 = html.indexOf("/* R3-REVISIONS:END */");
assert.ok(a > 0 && b > a && a3 > b && b3 > a3, "both blocks exist, R3 after R2");
const escSrc = html.slice(html.indexOf("const esc = (s) =>"), html.indexOf("const el = (id) =>"));
const secSrc = html.slice(html.indexOf("const estSechead = (n, t, meta) =>"), html.indexOf("/* 01 FORECAST — one metric tile"));
const ctx = { todayISO: () => "2026-10-02", pg: () => Promise.resolve([]) }; vm.createContext(ctx);
vm.runInContext(escSrc + secSrc + html.slice(a, b) + html.slice(a3, b3) +
  "; Object.assign(this, { revLines, revTapeItems, revTapeHTML, revHistFirms, revHistNotesHTML, revEstPick, revEstHTML, revStripBody, REV_CACHE, REV_HIST_FIRM });", ctx);

const NOW = Date.parse("2026-10-03T02:00:00Z");
const note = (o) => ({ kind: "TARGET", firm: "", analyst: null, target: null, adj_target: null, prior_grade: null, new_grade: null, action: null, price_when_posted: null, title: "", url: "", ...o });
const nvRows = [
  note({ published_utc: "2026-10-02T09:25:00+00:00", firm: "Wells Fargo", target: 210, adj_target: 210, price_when_posted: 230.86, title: "Wells Fargo lowers Nvidia price target to $210 from $265" }),
  note({ published_utc: "2026-10-02T09:25:00+00:00", kind: "GRADE", firm: "Wells Fargo", prior_grade: "Overweight", new_grade: "Equal Weight", action: "downgrade" }),
  note({ published_utc: "2026-09-20T12:00:00+00:00", firm: "Melius", target: 300, adj_target: 300, title: "Melius raises Nvidia price target to $300 from $250" }),
  note({ published_utc: "2026-06-01T12:00:00+00:00", firm: "Wells Fargo", target: 265, adj_target: 265, title: "x" }),
  note({ published_utc: "2025-12-01T12:00:00+00:00", firm: "Melius", target: 250, adj_target: 250, title: "y" }),
  note({ published_utc: "2026-09-11T12:00:00+00:00", firm: "Citi", target: 999, adj_target: 999, title: "Wall Street's top 10 stock calls this week" }),
];

test("the rating tape: firm · old → new · date, coloured by direction; the rating move wins over the target on one note", () => {
  const items = ctx.revTapeItems(ctx.revLines(nvRows.filter((r) => !/top 10/.test(r.title))), NOW, 120);
  assert.equal(items[0].firm, "Wells Fargo"); assert.equal(items[0].what, "rating");
  assert.equal(items[0].from, "Overweight"); assert.equal(items[0].to, "Equal Weight"); assert.equal(items[0].dir, -1);
  assert.equal(items[1].firm, "Melius"); assert.equal(items[1].from, "$250"); assert.equal(items[1].to, "$300"); assert.equal(items[1].dir, 1);
  assert.ok(items.every((x) => Date.parse(x.at) >= NOW - 120 * 864e5), "only the last 120 days");
  const h = ctx.revTapeHTML("NVDA", { rows: nvRows }, NOW);
  assert.match(h, /class="sc-tape sc-tape--rvt sc-rvt"/);
  assert.match(h, /RATINGS →/);
  assert.match(h, /<b class="rvt-fm">Wells Fargo<\/b> <span class="dn">Overweight → Equal Weight ▼<\/span>/);
  assert.match(h, /<span class="up">\$250 → \$300 ▲<\/span>/);
  assert.ok(!/Citi/.test(h), "a roundup headline never reaches the tape");
  assert.equal((h.match(/rvt-it/g) || []).length % 2, 0, "the track is doubled for a seamless loop");
  assert.match(ctx.revTapeHTML("NVDA", null, NOW), /reading/);
  assert.match(ctx.revTapeHTML("NVDA", { rows: [] }, NOW), /no rating or target moves/);
});
test("targets by firm: one step series per firm, newest mover first, split-adjusted, roundups out, hot = moved in 30 days", () => {
  const firms = ctx.revHistFirms(nvRows.filter((r) => r.kind === "TARGET"), NOW);
  assert.deepEqual([...firms.map((f) => f.firm)], ["Wells Fargo", "Melius"]);
  assert.equal(firms[0].lastDir, -1); assert.equal(firms[0].hot, true); assert.equal(firms[0].steps.length, 2);
  assert.equal(firms[1].lastDir, 1);
  const split = ctx.revHistFirms([note({ published_utc: "2024-05-01T00:00:00Z", firm: "X", target: 1000, adj_target: 100 })], NOW);
  assert.equal(split[0].last.v, 100, "the split-adjusted target");
});
/* A3 (3 Oct): 00b's step chart, its 12 months / 2 years switch and the firm chips gave way to one swipe of firm cards on ESTIMATES →
   FIRMS (Alan: "36 firms… very hard to read"); the cards and the swipe are tested in tests/a3-analysts-tab-20261003.test.mjs. A firm's
   notes still open from revHistNotesHTML. */
test("a firm's notes, newest first, old → new in colour (opened under the A3 firm swipe)", () => {
  const firms = ctx.revHistFirms(nvRows.filter((r) => r.kind === "TARGET"), NOW);
  const h = ctx.revHistNotesHTML(firms[0], 2026);
  assert.match(h, /sc-rvh-notes/); assert.match(h, /<b>Wells Fargo<\/b> · 2 target notes/); assert.match(h, /\$265 → \$210 ▼/);
  assert.match(h, /class="sc-rvh-x" data-rvh-firm=""/, "the close button");
});

/* the database's rows for NVDA on 2 Oct: the 11 Aug copy rebuilt from R2 and the first daily copy */
const est = [
  { fiscal_date: "2026-01-25", as_of_date: "2026-10-02", eps_avg: "4.69", revenue_avg: "213656385457" },
  { fiscal_date: "2027-01-25", as_of_date: "2026-10-02", eps_avg: "9.27461", revenue_avg: "409426638637" },
  { fiscal_date: "2028-01-25", as_of_date: "2026-10-02", eps_avg: "15.75077", revenue_avg: "691862290915" },
  { fiscal_date: "2029-01-25", as_of_date: "2026-10-02", eps_avg: "21.36544", revenue_avg: "924114668482" },
  { fiscal_date: "2027-01-25", as_of_date: "2026-08-11", eps_avg: "8.99738", revenue_avg: "393652880225" },
  { fiscal_date: "2028-01-25", as_of_date: "2026-08-11", eps_avg: "12.77625", revenue_avg: "563601060724" },
];
test("FY+1 / FY+2: the years in progress; 30 / 60 / 90 days use the snapshot within ±12 days or say where history starts", () => {
  const P = ctx.revEstPick(est, "2026-10-02");
  assert.equal(P.newest, "2026-10-02"); assert.equal(P.start, "2026-08-11");
  assert.deepEqual([...P.fy.map((f) => f.fiscal)], ["2027-01-25", "2028-01-25"]);
  assert.deepEqual([...P.cols.map((c) => c.asOf)], [null, "2026-08-11", null], "60 days back is 3 Aug; 11 Aug is 8 days off — the only one in reach");
  assert.equal(+P.fy[1].past[1].eps_avg, 12.77625);
  assert.equal(+P.fy[1].oldest.eps_avg, 12.77625);
});
test("a moved fiscal year-end still matches (Micron's FY27: 28 Aug in August, 3 Sep in October)", () => {
  const mu = [
    { fiscal_date: "2027-09-03", as_of_date: "2026-10-02", eps_avg: "170.79", revenue_avg: "270592826110" },
    { fiscal_date: "2028-09-03", as_of_date: "2026-10-02", eps_avg: "205.26", revenue_avg: "317895990186" },
    { fiscal_date: "2027-08-28", as_of_date: "2026-08-11", eps_avg: "154.67", revenue_avg: "249491340729" },
  ];
  const P = ctx.revEstPick(mu, "2026-10-02");
  assert.equal(+P.fy[0].oldest.eps_avg, 154.67);
  assert.equal(P.fy[1].oldest, null, "no August copy of FY28 within 45 days → no comparison");
});
test("the estimates box: plain numbers, the change in colour, 'history starts' where nothing was kept, no advice words", () => {
  const h = ctx.revEstHTML("NVDA", { rows: [], est }, "2026-10-02");
  assert.match(h, /FY\+1 EPS/); assert.match(h, /FY\+2 Revenue/);
  assert.match(h, /\$15\.75/); assert.match(h, /\$12\.78/);
  assert.match(h, /<span class="up">\+23%<\/span>/, "FY+2 EPS 12.78 → 15.75");
  assert.match(h, /90d ago<br><i>history starts 11 Aug/, "4 Jul is before the first copy");
  assert.match(h, /30d ago<br><i>no copy near 2 Sep/, "2 Sep is after the first copy: a gap, not the start");
  assert.ok(!/\b(buy|sell|should|recommend|bullish|bearish)\b/i.test(h.replace(/<[^>]+>/g, " ")));
  assert.match(ctx.revEstHTML("NVDA", { rows: [], est: [] }, "2026-10-02"), /kept once a day from 2 Oct 2026/);
});
test("wiring: the tape heads 05 Rating changes, the box sits beside the arrows; the R2 strip still renders alone (A3: the step chart is gone)", () => {
  assert.ok(!/function revHistSVG|function revHistBody|REV_HIST_SPAN/.test(html), "A3 removed the step chart and its switch");
  assert.match(html, /return head \+ tape \+ '<div class="sc-grsec">'/);
  assert.match(html, /<div class="sc-rvs-top">/);
  const sum = { as_of_date: "2026-10-02", last_month_count: 3, last_month_avg: 246.67, last_quarter_count: 25, last_quarter_avg: 331.72, last_year_count: 96, last_year_avg: 299.77, all_time_count: 342, all_time_avg: 152.34 };
  const body = ctx.revStripBody("NVDA", { rows: nvRows, sum, est }, 2026);
  assert.match(body, /sc-rvs-arrows/); assert.match(body, /sc-rve/);
});
