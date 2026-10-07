/* FD1 (7 Oct 2026) — comps-feed v6, the feed the allocation tool's knockout reads.
   The cause of "Micron's revenue is shrinking 59%" and "every forward P/E is 0" is reproduced here from the very rows
   the deployed v5 read, then the fixed rules are tested together with the rules they touch: the comps tab's own
   twelve-month arithmetic (comps.mjs), the C5b one-currency rule, the pages' CSV parse, the 1,000-row page.
   Offline: tests/fixtures/fd1-comps-feed-20261007.json — the database's rows and the live feed's answers, 7 Oct 06:00Z. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import * as F from "../supabase/functions/comps-feed/feed.mjs";
import { flow as k2flow } from "../deliverables/20260927/comps-single/comps.mjs";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const FX = JSON.parse(read("tests/fixtures/fd1-comps-feed-20261007.json")), T = FX.tables, TODAY = FX.today;
const near = (a, b, eps, msg) => assert.ok(a != null && Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const of = (rows, t) => rows.filter((r) => r.ticker === t);
const feed = (syms, tables = T) => F.buildFeed(syms, tables, TODAY);
const rowOf = (t, tables = T) => feed([t], tables).rows[0];
/* the allocation page's own parse of the feed (index.html, loadFeeds) */
const pageParse = (csv) => { const L = csv.trim().split("\n"), head = L[0].split(","), out = {}; for (const line of L.slice(1)) { const c = line.split(","), o = {}; head.forEach((h, i) => (o[h] = c[i] === "" ? null : +c[i])); out[c[0]] = o; } return out; };

/* ---- the cause, on the rows v5 read ------------------------------------------------------------------ */
test("v5 growth: the two newest statement rows whatever their period — Micron's year-end reads −59% or +146%, never the +256% it grew", () => {
  const mu = of(T.history, "MU").filter((r) => r.fiscal_date === "2026-09-03");
  assert.deepEqual(mu.map((r) => r.period).sort(), ["FY", "Q4"], "the quarter and the fiscal year carry ONE date");
  const q4 = mu.find((r) => r.period === "Q4").revenue, fy = mu.find((r) => r.period === "FY").revenue;
  assert.equal(q4, 54229000000); assert.equal(fy, 133188000000);
  const v5 = (rev) => rev[0] / rev[1] - 1;   /* v5: growth = rev[0] / rev[1] − 1 over rows ordered by fiscal_date only */
  near(v5([q4, fy]), -0.5928386941766526, 1e-12, "Q4 first");
  near(v5([fy, q4]), 1.4560290619410279, 1e-12, "FY first");
  /* the deployed function answered BOTH within one minute, depending on how many names were asked */
  near(FX.v5.answered_alone.rev_growth, v5([q4, fy]), 1e-12, "asked alone");
  near(FX.v5.answered_batch60.MU.rev_growth, v5([fy, q4]), 1e-12, "asked in a batch of 60");
  const fy25 = of(T.history, "MU").find((r) => r.period === "FY" && r.fiscal_date === "2025-08-28").revenue;
  near(fy / fy25 - 1, 2.5633, 1e-4, "what it grew: FY2026 over FY2025");
});
test("v5 forward P/E: a QUARTER's estimate when Micron is asked alone (27.8×), and nothing at all in a batch of 60 — printed as 0", () => {
  const rows = FX.v5.micron_estimates_as_v5_read_them;   /* no period asked, oldest first */
  assert.ok(rows.some((r) => r.period === "quarter") && rows.some((r) => r.period === "annual"), "the table holds quarters and years");
  const firstFuture = rows.find((r) => r.fiscal_date > TODAY && r.est_eps_avg != null);
  assert.equal(firstFuture.period, "quarter"); assert.equal(firstFuture.fiscal_date, "2026-12-03");
  const price = of(T.fundamentals, "MU")[0].price;
  near(price / firstFuture.est_eps_avg, FX.v5.answered_alone.fwd_pe, 1e-9, "price ÷ ONE quarter's EPS is what v5 answered");
  /* sixty names: 7,104 rows, the API serves the first 1,000, oldest first — none is in the future */
  assert.ok(FX.v5.estimate_rows_in_batch60 > 6 * F.PAGE); assert.equal(FX.v5.first_page.rows, F.PAGE);
  assert.ok(FX.v5.first_page.newest_fiscal_date < "2010-01-01"); assert.equal(FX.v5.first_page.future_rows, 0);
  assert.equal(FX.v5.forward_pe_zero_in_batch60, FX.v5.batch60_names, "every name of the batch read 0");
  const n = (x) => (x == null || !isFinite(Number(x))) ? "" : Number(x);   /* v5's cell */
  assert.equal(n(""), 0, "v5: a blank became 0");
  assert.equal(F.cell(""), ""); assert.equal(F.cell(null), ""); assert.equal(F.cell(undefined), ""); assert.equal(F.cell(NaN), ""); assert.equal(F.cell(0), "0"); assert.equal(F.cell("6.5"), "6.5");
});
test("v5 ratios: a single quarter under a full market value (Micron P/S 20 against 8.1) and a single quarter's margin (Alphabet 94%)", () => {
  const R = FX.v5.ratio_rows_as_v5_read_them, mu = R.filter((r) => r.ticker === "MU" && r.fiscal_date === "2026-09-03");
  assert.deepEqual(mu.map((r) => r.period).sort(), ["FY", "Q4"]);
  const q4 = mu.find((r) => r.period === "Q4"), fy = mu.find((r) => r.period === "FY");
  assert.ok([q4.ps, fy.ps].some((v) => Math.abs(v - FX.v5.answered_alone.ps) < 1e-9), "v5 answered one of the two rows of that date — whichever came first");
  near(q4.ps / fy.ps, 133188 / 54229, 0.02, "the quarter's P/S is the year's × (the year's sales ÷ the quarter's), to the share count");
  near(q4.ps, 19.9657, 1e-3); near(fy.ps, 8.1077, 1e-3);
  const g = R.filter((r) => r.ticker === "GOOGL")[0];
  assert.match(g.period, /^Q[1-4]$/); near(FX.v5.answered_batch60.GOOGL.net_m, g.net_margin, 1e-9, "the newest row is a quarter, and v5 printed its margin");
  assert.ok(g.net_margin > 0.9, "a quarter of paper gains: " + g.net_margin); assert.ok(rowOf("GOOGL").net_m < 0.6, "twelve months: " + rowOf("GOOGL").net_m);
  /* Western Digital in one night: the quarter's row (49.6) at 05:45Z, the fiscal year's (14.4) at 06:02Z — the same request */
  const wdc = R.filter((r) => r.ticker === "WDC" && r.fiscal_date === "2026-07-03"), E = FX.v5.earlier_same_night;
  near(E.batch60_0545Z.WDC.ps, wdc.find((r) => r.period === "Q4").ps, 1e-9); near(FX.v5.answered_batch60.WDC.ps, wdc.find((r) => r.period === "FY").ps, 1e-9);
  near(rowOf("WDC").ps, of(T.profiles, "WDC")[0].market_cap / 12919000000, 1e-9, "v6: today's market value ÷ twelve months of sales, every time"); assert.ok(rowOf("WDC").ps > 10.5 && rowOf("WDC").ps < 11.5);
  /* and the growth flips with the batch: Micron −59% in one batch of sixty and +146% in the next; SanDisk, Oracle, IREN likewise */
  near(E.batch60_0545Z.MU.rev_growth, -0.5928386941766526, 1e-12); near(E.batch18_0545Z.MU.rev_growth, 1.4560290619410279, 1e-12);
  for (const t of ["SNDK", "ORCL", "IREN"]) assert.ok(Math.abs(E.batch60_0545Z[t].rev_growth - E.batch18_0545Z[t].rev_growth) > 0.5, t + " read two different growths within a minute");
});

/* ---- the fix ---------------------------------------------------------------------------------------- */
test("v6 Micron: +256% a year, forward P/E 6.0 on the fiscal year to Sep 2027, P/S 8.9 on today's market value, margins of the twelve months", () => {
  const r = rowOf("MU");
  near(r.rev_growth, 133188 / 37378 - 1, 1e-9); assert.equal(r.basis.growth, "twelve months over the twelve before"); assert.equal(r.basis.sales_to, "2026-09-03");
  near(r.fwd_pe, 1045.56 / 173.77169, 1e-9); assert.equal(r.basis.forward_year, "2027-09-03");
  near(r.ps, 1180845008400 / 133188000000, 1e-9); near(r.net_m, 84969 / 133188, 1e-9); near(r.gross_m, 107504 / 133188, 1e-9);
  near(r.pe, 1045.56 / 74.22, 1e-9, "today's price over the last twelve months' EPS"); assert.equal(r.mktcap, 1180845008400);
  /* the comps tab's own Micron figures on the 6 Oct close (CP1's set, the company's own multiples): the same numbers */
  const own = JSON.parse(read("deliverables/20261007/feed-fix/data/fixtures/set-MU-fd1-2026-10-06.json")).after.snap.rows;
  near(r.pe, own.find((x) => x.key === "pe_ttm").own.multiple, 1e-6, "trailing P/E = the comps tab's"); near(r.fwd_pe, own.find((x) => x.key === "pe_fwd").own.multiple, 1e-4, "forward P/E = the comps tab's");
  assert.equal(r.updated, "2026-10-01T12:07:05.000Z", "the row's own date, not the minute of the request");
  const p = pageParse(feed(["MU"]).csv).MU;
  near(p.fwd_pe, 6.0169, 1e-3); near(p.rev_growth, 2.5633, 1e-4); assert.ok(p.fwd_pe > 0 && p.pe > 0);
});
test("the header and the units are v5's, so no page changes", () => {
  assert.equal(F.HEAD, "sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated");
  assert.match(read("supabase/functions/comps-feed/index.ts.ROLLBACK-v5-20260720"), /const head = 'sym,mktcap,pe,fwd_pe,ps,pb,gross_m,net_m,de,div_yld,rev_growth,updated';/);
  const csv = feed(FX.names).csv, L = csv.split("\n");
  assert.equal(L[0], F.HEAD); assert.equal(L.length, FX.names.length + 1);
  for (const l of L.slice(1)) assert.equal(l.split(",").length, 12, l);
  const p = pageParse(csv);
  for (const t of FX.names) { assert.ok(p[t].net_m == null || Math.abs(p[t].net_m) < 5, t + " margin is a fraction"); assert.ok(p[t].rev_growth == null || p[t].rev_growth > -1, t); }
});
test("the answer does not depend on the order the rows arrive in, nor on which other names are asked", () => {
  const base = feed(FX.names).csv;
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648, shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  for (let k = 0; k < 25; k++) assert.equal(feed(FX.names, Object.fromEntries(Object.entries(T).map(([n, rows]) => [n, shuffle(rows)]))).csv, base, "shuffle " + k);
  assert.equal(feed(FX.names, Object.fromEntries(Object.entries(T).map(([n, rows]) => [n, rows.slice().reverse()]))).csv, base, "reversed");
  for (const t of FX.names) assert.equal(feed([t]).csv.split("\n")[1], base.split("\n").find((l) => l.startsWith(t + ",")), t + " alone = " + t + " in the batch");
});
test("a quarter's estimate never enters the forward P/E; the nearest fiscal year ending today or later does (the comps tab's FY1)", () => {
  const withQuarters = { ...T, estimates: [...FX.v5.micron_estimates_as_v5_read_them.filter((r) => r.fiscal_date >= TODAY), ...T.estimates.filter((r) => r.ticker !== "MU")] };
  assert.ok(withQuarters.estimates.some((r) => r.ticker === "MU" && r.period === "quarter"));
  near(rowOf("MU", withQuarters).fwd_pe, rowOf("MU").fwd_pe, 1e-12);
  const e = [{ period: "annual", fiscal_date: "2026-12-31", est_eps_avg: 10 }, { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: 12 }, { period: "quarter", fiscal_date: "2026-10-31", est_eps_avg: 2 }];
  assert.deepEqual(F.forwardYear(e, "2026-12-31"), { eps: 10, fiscal_date: "2026-12-31" }, "a year ending today is still the year in progress");
  assert.deepEqual(F.forwardYear(e, "2027-01-01"), { eps: 12, fiscal_date: "2027-12-31" });
  assert.equal(F.forwardYear(e, "2028-01-01"), null);
  assert.equal(F.forwardYear([{ period: "annual", fiscal_date: "2026-12-31", est_eps_avg: null }, { period: "annual", fiscal_date: "2027-12-31", est_eps_avg: 12 }], "2026-10-07").eps, null, "a year with no EPS is not skipped for the next one");
  const loss = rowOf("NBIS"); assert.equal(loss.fwd_pe, null, "a loss has no forward P/E: blank, not 0"); assert.ok(loss.pe < 0 && loss.ps > 0, "the page falls to P/S for a loss-maker, as before");
});
test("twelve months are the comps tab's twelve months (comps.mjs flow), number for number", () => {
  for (const t of ["MU", "SNDK", "NVDA", "GOOGL", "ORCL", "TSM", "STX", "NBIS"]) {
    const h = of(T.history, t), k2 = k2flow(h.filter((r) => r.period !== "FY"), h.filter((r) => r.period === "FY"), "revenue"), mine = F.flow(h, "revenue");
    assert.equal(mine.now, k2.now, t + " now"); assert.equal(mine.prior, k2.prior, t + " the year before"); assert.equal(mine.basis, k2.basis, t); assert.equal(mine.to, k2.to, t);
  }
  assert.equal(rowOf("STX").basis.sales, "FY", "Seagate has fiscal years only on file: the last year stands in, and is named");
  near(rowOf("STX").rev_growth, 12195 / 9097 - 1, 1e-9);
  near(rowOf("ORCL").rev_growth, F.flow(of(T.history, "ORCL"), "revenue").now / F.flow(of(T.history, "ORCL"), "revenue").prior - 1, 1e-12);
  assert.ok(rowOf("ORCL").rev_growth > 0 && rowOf("ORCL").rev_growth < 1, "Oracle: a year over a year — v5 read −71% (a quarter over a fiscal year)");
  assert.ok(FX.v5.answered_batch60.ORCL.rev_growth < 0.05, "v5 in the same minute: " + FX.v5.answered_batch60.ORCL.rev_growth);
});
test("a restated year: Western Digital's FY2025 quarters still carry SanDisk, so they are not summed — the fiscal years are; quarters that add up to less are left alone", () => {
  const h = of(T.history, "WDC");
  assert.deepEqual([...F.restatedYears(h)], [2025]);
  const q25 = h.filter((r) => r.fiscal_year === 2025 && r.period !== "FY").reduce((s, r) => s + r.revenue, 0), fy25 = h.find((r) => r.fiscal_year === 2025 && r.period === "FY").revenue;
  assert.equal(q25, 11396000000); assert.equal(fy25, 9520000000, "the fiscal-year row is the drives business alone");
  const r = rowOf("WDC");
  near(r.rev_growth, 12919 / 9520 - 1, 1e-9); assert.match(r.basis.growth, /last fiscal year over the one before \(the year before was restated/);
  near(k2flow(h.filter((x) => x.period !== "FY"), h.filter((x) => x.period === "FY"), "revenue").now / 11396000000 - 1, 0.1336, 1e-3, "summing the quarters would say +13%");
  assert.equal(r.basis.sales, "TTM", "the newest four quarters add up to FY2026: they are used");
  near(r.ps, of(T.profiles, "WDC")[0].market_cap / 12919000000, 1e-9);
  assert.deepEqual([...F.restatedYears(of(T.history, "MU"))], []); assert.deepEqual([...F.restatedYears(of(T.history, "SNDK"))], []);
  /* the other direction — Nebius: its 2024 quarters add up to LESS (105m) than the year row (117m). A sold business only
     ever takes sales out, so there the quarters are the restated side: they are summed as they are, the comps tab's rule */
  const nb = F.yearSums(of(T.history, "NBIS")).get(2024); assert.ok(nb.sum < nb.fy * 0.95, `${nb.sum} against ${nb.fy}`);
  assert.deepEqual([...F.restatedYears(of(T.history, "NBIS"))], []); assert.equal(rowOf("NBIS").basis.growth, "twelve months over the twelve before"); assert.equal(rowOf("NBIS").basis.sales, "TTM");
  /* a year is judged only with its row and all four quarters; within 2% it is as filed; only quarters that add up to MORE count */
  const y = (fy, qs) => [{ period: "FY", fiscal_year: 2025, fiscal_date: "2025-12-31", revenue: fy }, ...qs.map((v, i) => ({ period: "Q" + (i + 1), fiscal_year: 2025, fiscal_date: `2025-${String(3 * (i + 1)).padStart(2, "0")}-28`, revenue: v }))];
  assert.deepEqual([...F.restatedYears(y(100, [25, 25, 25, 26.9]))], []); assert.deepEqual([...F.restatedYears(y(100, [25, 25, 25, 28]))], [2025]); assert.deepEqual([...F.restatedYears(y(100, [25, 25, 25]))], []);
  assert.deepEqual([...F.restatedYears(y(100, [20, 20, 20, 20]))], [], "quarters below the year row: the quarters stand"); assert.equal(F.yearSums(y(100, [25, 25, 25])).get(2025).sum, null); assert.equal(F.yearSums(y(100, [25, 25, 25, 28])).get(2025).sum, 103);
});
test("one currency per multiple (C5b): TSMC's EPS and sales are put in dollars at the stored rate; with no rate the multiples are withheld, never mixed", () => {
  const f = of(T.fundamentals, "TSM")[0], pr = of(T.profiles, "TSM")[0], rate = F.rateToUsd("TWD", T.fx, TODAY), r = rowOf("TSM");
  assert.ok(f.trailing_pe < 2, "the stored trailing P/E divides dollars by Taiwan dollars: " + f.trailing_pe);
  assert.ok(rate && rate.rate > 0.02 && rate.rate < 0.05 && rate.date <= TODAY);
  near(r.pe, pr.price / (f.eps_ttm * rate.rate), 1e-9); assert.ok(r.pe > 15 && r.pe < 60, "a P/E a chip foundry can carry: " + r.pe);
  assert.equal(r.mktcap, pr.market_cap, "the profile's market value is the US listing's, in dollars"); assert.ok(r.mktcap > 1e12 && r.mktcap < 5e12);
  assert.ok(r.fwd_pe > 10 && r.fwd_pe < r.pe); assert.equal(r.pb, null); assert.equal(r.div_yld, null); assert.equal(r.basis.currency, "TWD");
  near(r.ps, pr.market_cap / (F.flow(of(T.history, "TSM"), "revenue").now * rate.rate), 1e-9, "P/S: dollars over dollars"); assert.ok(r.ps > 10 && r.ps < 25);
  const noRate = rowOf("TSM", { ...T, fx: [] });
  assert.equal(noRate.pe, null); assert.equal(noRate.fwd_pe, null); assert.equal(noRate.ps, null); assert.equal(noRate.basis.withheld, true);
  assert.equal(noRate.mktcap, pr.market_cap, "the dollar market value needs no rate"); assert.ok(noRate.net_m > 0 && noRate.rev_growth != null && noRate.de != null, "what needs no rate stays");
  /* no profile figures: the fundamentals row stands in — its market value is in Taiwan dollars, so it takes the rate, or is withheld */
  const noProfile = rowOf("TSM", { ...T, profiles: [] });
  near(noProfile.mktcap, f.market_cap * rate.rate, 1); near(noProfile.pe, f.price / (f.eps_ttm * rate.rate), 1e-9); assert.match(noProfile.basis.market_value_from, /fundamentals row/);
  assert.equal(rowOf("TSM", { ...T, profiles: [], fx: [] }).mktcap, null);
  assert.equal(rowOf("TSM", { ...T, filers: [] }).basis.currency, "TWD", "the C5b list covers a company filer_currency does not carry");
  assert.equal(rowOf("TSM", { ...T, filers: [{ ticker: "TSM", reported_currency: "USD" }] }).basis.currency, "USD", "filer_currency outranks the list");
  assert.equal(F.rateToUsd("TWD", [{ pair: "TWDUSD", date: "2026-10-08", rate: 9 }, { pair: "TWDUSD", date: "2026-10-06", rate: 0.03 }], TODAY).rate, 0.03, "never a rate from after today");
  assert.equal(rowOf("MU").basis.rate, null); assert.equal(Object.keys(F.REPORTS_IN).length, 16);
});
test("the market value is today's: the stored one is the last fiscal period end's (its writer says so), 31% high for Western Digital and 18% low for Nvidia", () => {
  assert.match(read("supabase/functions/fmp-fundamentals/index.ts"), /market_cap: FMP key-metrics marketCap at the latest FISCAL PERIOD END \(kmAll\[0\]\), not a current value/);
  const ratio = (t) => of(T.fundamentals, t)[0].market_cap / of(T.profiles, t)[0].market_cap;
  near(ratio("WDC"), 1.313, 0.002); near(ratio("NVDA"), 0.820, 0.002); near(ratio("NBIS"), 1.289, 0.002); near(ratio("MU"), 0.917, 0.002);
  for (const t of ["MU", "WDC", "NVDA", "NBIS", "SNDK", "STX", "GOOGL", "ORCL"]) {
    const r = rowOf(t), pr = of(T.profiles, t)[0];
    assert.equal(r.mktcap, pr.market_cap, t); assert.match(r.basis.market_value_from, /company_profile \(today's price × shares\)/); assert.equal(r.basis.price_at, "2026-10-07");
    near(r.ps, pr.market_cap / (F.flow(of(T.history, t), "revenue").now ?? of(T.fundamentals, t)[0].revenue_ttm), 1e-9, t + " P/S");
  }
  near(rowOf("WDC").ps / (of(T.fundamentals, "WDC")[0].market_cap / 12919000000), 1 / 1.313, 0.002, "on the stored market value Western Digital's P/S read 14.4; it is 11.0");
  /* a company with no profile figures: the fundamentals row stands in, and the basis says which */
  const bare = rowOf("MU", { ...T, profiles: [] });
  assert.equal(bare.mktcap, 1082720800000); near(bare.pe, 1058.74 / 74.22, 1e-9); assert.match(bare.basis.market_value_from, /fundamentals row \(the last fiscal period end's\)/); assert.equal(bare.basis.price_at, null);
  const pr = of(T.profiles, "MU")[0], half = rowOf("MU", { ...T, profiles: [{ ...pr, market_cap: null }] });
  assert.equal(half.mktcap, 1082720800000, "price and market value are taken together or not at all"); near(half.pe, 1058.74 / 74.22, 1e-9);
  /* a profile row that was not refreshed is not "today's": a week old it still stands, older or undated it does not */
  const at = (iso) => Math.floor(Date.parse(iso) / 1000), with_ = (ts) => rowOf("MU", { ...T, profiles: [{ ...pr, updated_ts: ts }] });
  assert.equal(with_(at("2026-09-30T06:25:00Z")).mktcap, pr.market_cap); assert.equal(with_(at("2026-09-29T06:25:00Z")).mktcap, 1082720800000, "eight days old");
  assert.equal(with_(at("2026-08-10T06:25:00Z")).basis.price_at, null); assert.equal(with_(null).mktcap, 1082720800000, "no date on the row"); assert.equal(F.PROFILE_FRESH_DAYS, 7);
});
test("a name with nothing on file is a line of blanks, and the page reads each as not held", () => {
  const csv = feed(["ZZZZ", "MU"]).csv, p = pageParse(csv);
  assert.equal(csv.split("\n")[1], "ZZZZ,,,,,,,,,,,");
  for (const k of ["mktcap", "pe", "fwd_pe", "ps", "pb", "gross_m", "net_m", "de", "div_yld", "rev_growth"]) assert.equal(p.ZZZZ[k], null, k);
  assert.ok(p.MU.fwd_pe > 0);
});
test("the request: sixty symbols at most, upper case, no repeats, nothing that is not a ticker", () => {
  assert.deepEqual(F.parseSyms(" mu, SNDK ,mu,,BRK.B,BF-B, 000660.KS ,DROP TABLE,a'b,"), ["MU", "SNDK", "BRK.B", "BF-B", "000660.KS"]);
  assert.equal(F.parseSyms(Array.from({ length: 90 }, (_, i) => "T" + i).join(",")).length, F.MAX_SYMS);
  assert.deepEqual(F.parseSyms(""), []); assert.deepEqual(F.parseSyms(null), []);
});
test("every read names its period, carries a total order and is paged to its end", async () => {
  const q = F.queries(["MU", "BRK.B"], TODAY);
  assert.match(q.estimates, /period=eq\.annual/); assert.match(q.estimates, /fiscal_date=gte\.2026-10-07/); assert.match(q.estimates, /order=ticker\.asc,fiscal_date\.asc$/);
  assert.match(q.history, /order=ticker\.asc,fiscal_date\.desc,period\.asc$/); assert.match(q.ratios, /order=ticker\.asc,fiscal_date\.desc,period\.asc$/);
  assert.match(q.history, /fiscal_date=gte\.2023-10-0[0-9]/, "three years: eight quarters and two fiscal years with room");
  for (const k of ["fundamentals", "profiles", "history", "ratios", "estimates", "filers"]) assert.match(q[k], /ticker=in\.\(%22MU%22,%22BRK\.B%22\)/, k);
  assert.match(q.profiles, /^company_profile\?select=ticker,price,market_cap,updated_ts&/);
  for (const p of Object.values(q)) assert.ok(!/limit=|offset=/.test(p), "the caller pages");
  const rows = Array.from({ length: 2345 }, (_, i) => ({ i })), asked = [];
  const get = async (p) => { asked.push(p); const lim = +/limit=(\d+)/.exec(p)[1], off = +/offset=(\d+)/.exec(p)[1]; return rows.slice(off, off + lim); };
  const all = await F.readAll(get, "t?select=i");
  assert.equal(all.length, 2345); assert.equal(asked.length, 3); assert.deepEqual(asked.map((p) => +/offset=(\d+)/.exec(p)[1]), [0, 1000, 2000]);
  await assert.rejects(F.readAll(async () => ({ message: "nope" }), "t?x=1"), /read failed: t/);
  await assert.rejects(F.readAll(async () => rows.slice(0, 1000), "t?x=1", { max: 3 }), /did not end/);
  /* the two optional tables read as empty when they fail; a failing main read fails the request */
  const tables = await F.readTables(async (p) => { if (/^(filer_currency|fx_rates)/.test(p)) throw new Error("no such table"); return []; }, ["MU"], TODAY);
  assert.deepEqual(tables.filers, []); assert.deepEqual(tables.fx, []);
  await assert.rejects(F.readTables(async (p) => { if (/^analyst_estimates/.test(p)) throw new Error("down"); return []; }, ["MU"], TODAY), /down/);
});
test("the function: read-only, GET only, the header alone with 503 when a read fails, no key in any answer; the rollback is v5 to the byte", () => {
  const src = read("supabase/functions/comps-feed/index.ts");
  assert.match(src, /import \{ HEAD, VERSION, parseSyms, readTables, buildFeed \} from "\.\/feed\.mjs";/);
  assert.ok(!/method:\s*"(POST|PATCH|PUT|DELETE)"/.test(src) && !/\.(insert|upsert|update|delete)\(/.test(src), "no write of any kind");
  assert.match(src, /req\.method !== "GET"/); assert.match(src, /status: 503/); assert.match(src, /"x-comps-feed-version": VERSION/);
  assert.ok(!/financialmodelingprep|FMP_/.test(src + read("supabase/functions/comps-feed/feed.mjs").replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "")), "no FMP call: the SCINTILLA database only");
  assert.equal(F.VERSION, "comps-feed-v6");
  assert.equal(createHash("sha256").update(readFileSync(new URL("../supabase/functions/comps-feed/index.ts.ROLLBACK-v5-20260720", import.meta.url))).digest("hex"), "3b21b8cab905ae02caf40fa4bda47c7c5d50c30ecc6c8ff655ad5d086cb49a33", "the deployed v5 source, as kept in the 20 Aug security copy");
});
test("the function itself, run end to end on the fixture: the same line as the pure part, 503 with the header alone when a read fails, GET only", async () => {
  /* the edge runtime's two globals, stubbed; PostgREST answered from the fixture's rows (ticker list, limit and offset honoured) */
  let handler = null, fail = null; const asked = [];
  const realFetch = globalThis.fetch, realDeno = globalThis.Deno;
  globalThis.Deno = { env: { get: (k) => (k === "SUPABASE_URL" ? "https://db.test" : k === "SUPABASE_SERVICE_ROLE_KEY" ? "test-key" : "") }, serve: (h) => { handler = h; } };
  const TABLE = { fundamentals: T.fundamentals, company_profile: T.profiles, fundamentals_history: T.history, ratios_history: T.ratios, analyst_estimates: T.estimates, filer_currency: T.filers, fx_rates: T.fx };
  globalThis.fetch = async (url, init) => {
    const u = new URL(url), name = u.pathname.split("/").pop(); asked.push({ name, method: (init && init.method) || "GET", auth: init && init.headers && init.headers.Authorization });
    if (fail === name) return new Response("{}", { status: 500 });
    const list = /in\.\((.*)\)/.exec(u.searchParams.get("ticker") || ""), want = list ? list[1].split(",").map((s) => s.replace(/"/g, "")) : null;
    const rows = (TABLE[name] || []).filter((r) => !want || want.includes(r.ticker)), off = +(u.searchParams.get("offset") || 0), lim = +(u.searchParams.get("limit") || 1000);
    return new Response(JSON.stringify(rows.slice(off, off + lim)), { status: 200, headers: { "content-type": "application/json" } });
  };
  try {
    await import("../supabase/functions/comps-feed/index.ts");
    assert.equal(typeof handler, "function");
    const ok = await handler(new Request("https://fn.test/comps-feed?syms=mu,WDC,zzzz"));
    assert.equal(ok.status, 200); assert.match(ok.headers.get("content-type"), /text\/csv/); assert.equal(ok.headers.get("x-comps-feed-version"), "comps-feed-v6"); assert.equal(ok.headers.get("access-control-allow-origin"), "*"); assert.equal(ok.headers.get("cache-control"), "no-store");
    const text = await ok.text(), lines = text.split("\n");
    assert.equal(lines[0], F.HEAD); assert.equal(lines.length, 4);
    assert.equal(lines[1], feed(["MU"]).csv.split("\n")[1]); assert.equal(lines[2], feed(["WDC"]).csv.split("\n")[1]); assert.equal(lines[3], "ZZZZ,,,,,,,,,,,");
    assert.ok(asked.length >= 7 && asked.every((a) => a.method === "GET" && a.auth === "Bearer test-key"), "seven reads, all GET");
    assert.deepEqual([...new Set(asked.map((a) => a.name))].sort(), ["analyst_estimates", "company_profile", "filer_currency", "fundamentals", "fundamentals_history", "fx_rates", "ratios_history"]);
    assert.ok(!text.includes("test-key"));
    const js = await (await handler(new Request("https://fn.test/comps-feed?syms=MU&format=json"))).json();
    assert.equal(js.version, "comps-feed-v6"); assert.equal(js.rows[0].basis.forward_year, "2027-09-03"); assert.equal(js.rows[0].basis.growth, "twelve months over the twelve before");
    assert.equal(await (await handler(new Request("https://fn.test/comps-feed"))).text(), F.HEAD, "no symbol: the header alone, as before");
    fail = "analyst_estimates";
    const bad = await handler(new Request("https://fn.test/comps-feed?syms=MU"));
    assert.equal(bad.status, 503); assert.equal(await bad.text(), F.HEAD, "a failed read is no line at all — never a guess"); assert.match(bad.headers.get("x-comps-feed-error"), /analyst_estimates 500/);
    fail = "fx_rates";
    const soft = await handler(new Request("https://fn.test/comps-feed?syms=MU,TSM")); assert.equal(soft.status, 200);
    const sp = pageParse(await soft.text()); assert.ok(sp.MU.fwd_pe > 0); assert.equal(sp.TSM.pe, null, "no rates → the foreign multiples are withheld"); assert.equal(sp.TSM.ps, null); assert.ok(sp.TSM.mktcap > 1e12 && sp.TSM.net_m > 0);
    fail = null;
    assert.equal((await handler(new Request("https://fn.test/comps-feed?syms=MU", { method: "POST" }))).status, 405);
    assert.equal((await handler(new Request("https://fn.test/comps-feed", { method: "OPTIONS" }))).headers.get("access-control-allow-origin"), "*");
  } finally { globalThis.fetch = realFetch; if (realDeno === undefined) delete globalThis.Deno; else globalThis.Deno = realDeno; }
});
