/* R2 Part C (2 Oct 2026) — the REVISIONS strip: analyst-revisions (edge function, pure part) + the ESTIMATES tab's 00 REVISIONS.
   Fixtures are R1's real FMP rows (deliverables/20261002/research-sources/raw/probe-1-fmp-massive-sec.json). No network. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import * as L from "../supabase/functions/analyst-revisions/lib.ts";

const read = (p) => readFileSync(new URL("../" + p, import.meta.url), "utf8");
const html = read("index.html");
const fnSrc = read("supabase/functions/analyst-revisions/index.ts");

/* R1's rows, as FMP sent them on 2 Oct */
const MU_CLSA_T = { symbol: "MU", publishedDate: "2026-10-02T08:37:00.000Z", newsURL: "https://www.streetinsider.com/Analyst+Comments/CLSA+Reiterates+Outperform+%282%29+Rating+on+Micron+Technology+%28MU%29/27138087.html", newsTitle: "CLSA Reiterates Outperform (2) Rating on Micron Technology (MU)", analystName: "Sanjeev Rana", priceTarget: 1700, adjPriceTarget: 1700, priceWhenPosted: 1097.39, newsPublisher: "StreetInsider", newsBaseURL: "streetinsider.com", analystCompany: "CLSA" };
const MU_CLSA_G = { symbol: "MU", publishedDate: "2026-10-02T08:37:00.000Z", newsURL: MU_CLSA_T.newsURL, newsTitle: MU_CLSA_T.newsTitle, newsBaseURL: "streetinsider.com", newsPublisher: "StreetInsider", newGrade: "Outperform", previousGrade: "Outperform", gradingCompany: "CLSA", action: "hold", priceWhenPosted: 1097.39 };
const MU_DAD = { symbol: "MU", publishedDate: "2026-10-01T12:27:52.000Z", newsURL: "https://thefly.com/ajax/news_get.php?id=4433929", newsTitle: "Micron price target raised to $2,100 from $2,000 at DA Davidson", analystName: "", priceTarget: 2100, adjPriceTarget: 2100, priceWhenPosted: 1032.47, newsPublisher: "TheFly", newsBaseURL: "thefly.com", analystCompany: "D.A. Davidson" };
const NVDA_WF = { symbol: "NVDA", publishedDate: "2026-10-02T09:25:00.000Z", newsURL: "https://www.streetinsider.com/x/27138174.html", newsTitle: "Morgan Stanley Renames NVIDIA (NVDA) to Top Pick", analystName: "", priceTarget: 210, adjPriceTarget: 210, priceWhenPosted: 230.86, analystCompany: "Wells Fargo" };
const NVDA_SUM = { symbol: "NVDA", lastMonthCount: 3, lastMonthAvgPriceTarget: 246.67, lastQuarterCount: 25, lastQuarterAvgPriceTarget: 331.72, lastYearCount: 96, lastYearAvgPriceTarget: 299.77, allTimeCount: 342, allTimeAvgPriceTarget: 152.34, publishers: "[]" };
const NFLX_ROUNDUP = { symbol: "NFLX", publishedDate: "2026-10-02T18:35:10.000Z", newsURL: "https://thefly.com/ajax/news_get.php?id=4434964", newsTitle: "Buy/Sell: Wall Street's top 10 stock calls this week", newGrade: "Sell", previousGrade: "Market Perform", gradingCompany: "Citigroup", action: "downgrade", priceWhenPosted: 67.0477 };

/* ---------- the function's pure part ---------- */
test("FMP price-target-news → one TARGET row (CLSA $1,700 on Micron at $1,097.39)", () => {
  const r = L.targetRow(MU_CLSA_T, "MU");
  assert.deepEqual(r, { ticker: "MU", published_utc: "2026-10-02T08:37:00.000Z", kind: "TARGET", firm: "CLSA", analyst: "Sanjeev Rana",
    target: 1700, adj_target: 1700, prior_grade: null, new_grade: null, action: "reiterate", price_when_posted: 1097.39,
    title: MU_CLSA_T.newsTitle, url: MU_CLSA_T.newsURL });
  assert.equal(L.targetRow(MU_DAD, "MU").analyst, null, "an empty analyst name is stored as null, not ''");
  assert.equal(L.targetRow(MU_DAD, "MU").action, "raise");
  assert.equal(L.targetRow({ ...MU_DAD, publishedDate: "" }, "MU"), null, "no date → no row");
});
test("FMP grades-news → one GRADE row; FMP's action word kept", () => {
  const g = L.gradeRow(NFLX_ROUNDUP, "NFLX");
  assert.equal(g.kind, "GRADE"); assert.equal(g.firm, "Citigroup"); assert.equal(g.prior_grade, "Market Perform");
  assert.equal(g.new_grade, "Sell"); assert.equal(g.action, "downgrade"); assert.equal(g.price_when_posted, 67.0477); assert.equal(g.target, null);
});
test("the headline verb: raise / lower / initiate / reiterate / null", () => {
  assert.equal(L.targetAction("Huntsman price target lowered to $11 from $16 at Jefferies"), "lower");
  assert.equal(L.targetAction("Micron price target raised to $2,100 from $2,000 at DA Davidson"), "raise");
  assert.equal(L.targetAction("Piper starts 'long-term winner' Nvidia with an Overweight"), "initiate");
  assert.equal(L.targetAction("CLSA Reiterates Outperform (2) Rating on Micron Technology (MU)"), "reiterate");
  assert.equal(L.targetAction("Morgan Stanley Renames NVIDIA (NVDA) to Top Pick"), null);
});
test("dedupe keeps one row per (ticker, published_utc, firm, kind) — a target and a rating of one note both survive", () => {
  const rows = [L.targetRow(MU_CLSA_T, "MU"), L.targetRow(MU_CLSA_T, "MU"), L.gradeRow(MU_CLSA_G, "MU"), null];
  const d = L.dedupe(rows);
  assert.equal(d.length, 2);
  assert.deepEqual(d.map((r) => r.kind).sort(), ["GRADE", "TARGET"]);
  const nofirm = L.targetRow({ ...MU_DAD, analystCompany: null }, "MU");
  assert.equal(nofirm.firm, "", "a missing firm is '' so the unique key still holds (NULLs never collide)");
});
test("the universe: cohorts ∩ active stocks, untyped core names included, funds and crypto out", () => {
  const tickers = [
    { ticker: "NVDA", type: null, active: true }, { ticker: "MU", type: null, active: true }, { ticker: "KR", type: "stock", active: true },
    { ticker: "SPY", type: "etf", active: true }, { ticker: "BTCUSD", type: "crypto", active: true }, { ticker: "OLD", type: "stock", active: false },
    { ticker: "XYZ", type: "stock", active: true }, { ticker: "FUNDLIKE", type: null, active: true },
  ];
  const cohorts = ["NVDA", "MU", "MU", "KR", "SPY", "BTCUSD", "OLD", "FUNDLIKE"].map((ticker) => ({ ticker }));
  assert.deepEqual(L.stockUniverse(tickers, cohorts, [{ ticker: "FUNDLIKE" }]), ["KR", "MU", "NVDA"]);
});
test("price-target-summary → one daily row; an average over zero targets is null, not $0", () => {
  assert.deepEqual(L.summaryRow(NVDA_SUM, "NVDA", "2026-10-02"), { ticker: "NVDA", as_of_date: "2026-10-02", last_month_count: 3, last_month_avg: 246.67,
    last_quarter_count: 25, last_quarter_avg: 331.72, last_year_count: 96, last_year_avg: 299.77, all_time_count: 342, all_time_avg: 152.34 });
  const z = L.summaryRow({ lastMonthCount: 0, lastMonthAvgPriceTarget: 0, lastQuarterCount: 2, lastQuarterAvgPriceTarget: 50 }, "X", "2026-10-02");
  assert.equal(z.last_month_count, 0); assert.equal(z.last_month_avg, null); assert.equal(z.last_quarter_avg, 50); assert.equal(z.all_time_avg, null);
  assert.equal(L.summaryRow(undefined, "X", "2026-10-02"), null);
});
test("paging the all-ticker feed stops once a page reaches the rows already stored (minus a day of overlap)", () => {
  const page = (isoList) => isoList.map((publishedDate) => ({ publishedDate }));
  const newest = "2026-10-02T18:26:14+00:00";
  assert.equal(L.keepPaging(page(["2026-10-02T20:00:00Z", "2026-10-02T12:00:00Z"]), newest), true, "still newer than the cutoff → read the next page");
  assert.equal(L.keepPaging(page(["2026-10-02T20:00:00Z", "2026-10-01T10:00:00Z"]), newest), false, "older than newest − 24 h → stop");
  assert.equal(L.keepPaging([], newest), false, "empty page → stop");
  assert.equal(L.keepPaging(page(["2026-10-02T20:00:00Z"]), null), true, "nothing stored → keep going (the page cap bounds it)");
});
test("dates: FMP stamps are read as UTC; the summary's day is New York's", () => {
  assert.equal(L.isoUtc("2026-10-02T08:37:00.000Z"), "2026-10-02T08:37:00.000Z");
  assert.equal(L.isoUtc("2026-10-02 08:37:00"), "2026-10-02T08:37:00.000Z");
  assert.equal(L.isoUtc("2020-11-03"), "2020-11-03T00:00:00.000Z");
  assert.equal(L.isoUtc("nonsense"), null);
  assert.equal(L.nyDate(new Date("2026-10-03T01:02:24Z")), "2026-10-02", "21:02 ET on 2 Oct is still 2 Oct in New York");
  assert.deepEqual(L.slice([1, 2, 3, 4, 5], "1", "2"), [2, 3]);
  assert.deepEqual(L.slice([1, 2, 3], null, null), [1, 2, 3]);
});
test("the function: key from app_config like fmp-analyst, /stable/ routes only, writes only its two tables, never logs", () => {
  assert.match(fnSrc, /from\("app_config"\)\.select\("value"\)\.eq\("key", "FMP_KEY"\)/);
  assert.match(fnSrc, /const FMP = "https:\/\/financialmodelingprep\.com\/stable\/"/);
  for (const r of ["price-target-latest-news", "grades-latest-news", "price-target-summary", "price-target-news", "grades-news"]) assert.ok(fnSrc.includes('"' + r), r);
  assert.ok(!/console\.(log|error|warn)/.test(fnSrc), "no logging at all — nothing that could print the key");
  const writes = [...fnSrc.matchAll(/upsert\(sb, "([a-z_]+)"/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(writes)].sort(), ["analyst_target_news", "price_target_summary_daily"]);
  assert.ok(!/alert_log|\.insert\(|\.delete\(|cron/.test(fnSrc.replace(/\/\/.*$/gm, "")), "no alert rows, no deletes, no cron in code");
  assert.ok(!/apikey=[A-Za-z0-9]{8,}/.test(fnSrc + read("supabase/functions/analyst-revisions/lib.ts")), "no key value in the source");
});
test("the migration is additive: two CREATE TABLEs, anon read policy, no ALTER of an existing table", () => {
  const sql = read("supabase/migrations/20261002_analyst_revisions.sql").replace(/--.*$/gm, "");
  assert.equal((sql.match(/create table if not exists public\.(\w+)/g) || []).length, 2);
  assert.match(sql, /unique \(ticker, published_utc, firm, kind\)/);
  assert.match(sql, /primary key \(ticker, as_of_date\)/);
  const alters = [...sql.matchAll(/alter table public\.(\w+)/g)].map((m) => m[1]);
  assert.deepEqual([...new Set(alters)].sort(), ["analyst_target_news", "price_target_summary_daily"], "only the new tables are altered (RLS on)");
  assert.match(read("supabase/migrations/20261002_analyst_revisions_ROLLBACK.sql"), /drop table if exists public\.analyst_target_news;[\s\S]*drop table if exists public\.price_target_summary_daily;/);
});

/* ---------- the Hub: 00 REVISIONS on the ESTIMATES tab ---------- */
const a = html.indexOf("/* R2C-REVISIONS:BEGIN"), b = html.indexOf("/* R2C-REVISIONS:END */");
assert.ok(a > 0 && b > a, "the strip's block exists");
const escSrc = html.slice(html.indexOf("const esc = (s) =>"), html.indexOf("const el = (id) =>"));
const secSrc = html.slice(html.indexOf("const estSechead = (n, t, meta) =>"), html.indexOf("/* 01 FORECAST — one metric tile"));
const ctx = {}; vm.createContext(ctx);
vm.runInContext(escSrc + secSrc + html.slice(a, b) +
  "; this.revLines = revLines; this.revArrows = revArrows; this.revSay = revSay; this.revLineHTML = revLineHTML; this.revStripBody = revStripBody;" +
  " this.revPriorFromTitle = revPriorFromTitle; this.revDay = revDay; this.revPx = revPx; this.REV_CACHE = REV_CACHE; this.revStripHTML = revStripHTML;", ctx);
const db = (r) => ({ ...r, published_utc: r.published_utc.replace(".000Z", "+00:00") });   // PostgREST's timestamp form
const muRows = [
  db(L.targetRow(MU_CLSA_T, "MU")), db(L.gradeRow(MU_CLSA_G, "MU")), db(L.targetRow(MU_DAD, "MU")),
  db(L.targetRow({ ...MU_CLSA_T, publishedDate: "2026-08-20T08:00:00.000Z", priceTarget: 1500, adjPriceTarget: 1500, newsTitle: "CLSA note", newsURL: "u2" }, "MU")),
];

test("one line per note: CLSA's target and rating at the same minute are one line; newest first", () => {
  const lines = ctx.revLines(muRows);
  assert.equal(lines.length, 3);
  assert.equal(lines[0].firm, "CLSA"); assert.equal(lines[0].target, 1700); assert.equal(lines[0].grTo, "Outperform"); assert.equal(lines[0].px, 1097.39);
  assert.equal(lines[1].firm, "D.A. Davidson");
});
test("old → new target: from the headline's 'to $X from $Y', else the same firm's previous note", () => {
  const lines = ctx.revLines(muRows);
  assert.equal(lines[1].prior, 2000); assert.equal(lines[1].priorSrc, "headline");
  assert.equal(lines[0].prior, 1500); assert.equal(lines[0].priorSrc, "previous note");
  assert.deepEqual(JSON.parse(JSON.stringify(ctx.revPriorFromTitle("Huntsman price target lowered to $11 from $16 at Jefferies"))), { to: 11, from: 16 });
  assert.equal(ctx.revPriorFromTitle("CLSA Reiterates Outperform"), null);
});
test("a line says date · firm · analyst · old → new · the price that day · what the target implies (CLSA: +55%)", () => {
  const lines = ctx.revLines(muRows);
  const h = ctx.revLineHTML(lines[0], 2026);
  assert.match(h, /<span class="dt">2 Oct<\/span>/);
  assert.match(h, /<b>CLSA<\/b> <i>Sanjeev Rana<\/i>/);
  assert.match(h, /\$1,500 → \$1,700 ▲/);
  assert.match(h, /Outperform <i>kept<\/i>/);
  assert.match(h, /at \$1,097/);
  assert.match(h, /class="im up"[^>]*>\+55%</, "1700 / 1097.39 − 1 = +54.9% → +55%");
  assert.match(h, /^<a class="sc-rvs-row" href="https:\/\/www\.streetinsider\.com\//);
  const dad = ctx.revLineHTML(lines[1], 2026);
  assert.match(dad, /\$2,000 → \$2,100 ▲/); assert.match(dad, /\+103%/);
  const old = ctx.revLineHTML(lines[2], 2025);
  assert.match(old, /20 Aug 2026/, "a note from another year carries its year");
});
test("a cut is red ▼, an upgrade green ▲, a roundup headline is tagged", () => {
  const cut = ctx.revLines([db(L.targetRow({ symbol: "HUN", publishedDate: "2026-10-02T16:54:50.000Z", newsTitle: "Huntsman price target lowered to $11 from $16 at Jefferies", analystName: "Laurence Alexander", priceTarget: 11, adjPriceTarget: 11, priceWhenPosted: 8.565, analystCompany: "Jefferies", newsURL: "https://thefly.com/x" }, "HUN"))]);
  const h = ctx.revLineHTML(cut[0], 2026);
  assert.match(h, /<span class="dn">\$16\.00 → \$11\.00 ▼<\/span>/);
  assert.match(h, /class="im up"[^>]*>\+28%</, "a cut target can still sit above the price");
  const nf = ctx.revLineHTML(ctx.revLines([db(L.gradeRow(NFLX_ROUNDUP, "NFLX"))])[0], 2026);
  assert.match(nf, /<span class="dn">Market Perform → Sell ▼<\/span>/);
  assert.match(nf, />roundup</);
});
test("the three arrows (R1's Nvidia case): month $247 ▼ −26% vs the quarter's $332 — revising DOWN, a thin read", () => {
  const sum = { as_of_date: "2026-10-02", ...Object.fromEntries(Object.entries(L.summaryRow(NVDA_SUM, "NVDA", "2026-10-02")).filter(([k]) => k !== "ticker")) };
  const ar = ctx.revArrows(sum);
  assert.equal(ar.length, 3);
  assert.deepEqual(JSON.parse(JSON.stringify(ar.map((x) => x.label))), ["last month", "last quarter", "last year"]);
  assert.equal(Math.round(ar[0].pct), -26); assert.equal(Math.round(ar[1].pct), 11); assert.equal(Math.round(ar[2].pct), 97);
  const say = ctx.revSay(ar);
  assert.match(say, /average <b>\$247<\/b> — 26% below the \$332 of the last quarter: analysts are revising <b class="dn">DOWN<\/b>\. Only 3 targets this month — a thin read\./);
  const body = ctx.revStripBody("NVDA", { rows: [db(L.targetRow(NVDA_WF, "NVDA"))], sum, err: null }, 2026);
  assert.match(body, /^<div class="sc-rvs" data-rev-t="NVDA">/);
  assert.match(body, /<span class="n">00<\/span><span class="t">Revisions<\/span>/);
  assert.match(body, /▼ −26% vs last quarter/); assert.match(body, /▲ \+11% vs last year/); assert.match(body, /▲ \+97% vs all time/);
  assert.match(body, /Wells Fargo/); assert.match(body, /−9\.0%/, "210 / 230.86 − 1 = −9.0%");
});
test("honest empty, error and loading states; the tab opens with the strip", () => {
  const empty = ctx.revStripBody("ZZZ", { rows: [], sum: null, err: null }, 2026);
  assert.match(empty, /No analyst notes are stored for \$ZZZ yet/);
  assert.ok(!/sc-rvs-arrows/.test(empty), "no summary → no arrows drawn");
  assert.match(ctx.revStripBody("ZZZ", { rows: [], sum: null, err: "pg → 500" }, 2026), /could not be read just now \(pg → 500\)/);
  ctx.REV_CACHE.MU = { at: Date.now(), rows: muRows, sum: null, err: null };
  assert.match(ctx.revStripHTML({ t: "MU" }), /3 notes/, "a fresh cache paints at once");
  assert.equal(ctx.revStripHTML({ t: "MU", _loading: true }), "");
  assert.match(html, /function estimatesTabHTML\(data\) \{[^\n]*\n  return revStripHTML\(data\) \+ estForecastHTML\(data\)/);
  assert.ok(!/discounted-cash-flow|ratings-snapshot/.test(html.slice(a, b)), "FMP's DCF and letter ratings stay off the Hub");
  assert.ok(!/sc-rev\b(?!-)/.test(html.slice(a, b).replace(/\.sc-rev is the board/g, "")), "never the board's revenue-cell class .sc-rev (the first shot caught that collision)");
  for (const fn of ["revNum", "revPx", "revPct", "revLines", "revArrows", "revSay", "revLineHTML", "revStripHTML", "revStripLoad", "revStripPaint", "revStripBody"])
    assert.equal(html.split("function " + fn + "(").length - 1, 1, fn + " is declared once (a second declaration would silently replace the other)");
});
test("roundup headlines are set aside behind a closed fold, never in this stock's own list or its old-target lookup", () => {
  const rows = [db(L.targetRow(NVDA_WF, "NVDA")), db(L.gradeRow({ ...NFLX_ROUNDUP, symbol: "NVDA", gradingCompany: "Wells Fargo", previousGrade: "Overweight", newGrade: "Underweight" }, "NVDA")),
    db(L.targetRow({ ...NVDA_WF, publishedDate: "2026-09-11T18:05:10.000Z", priceTarget: 999, adjPriceTarget: 999, newsTitle: "Buy/Sell: Wall Street's top 10 stock calls this week" }, "NVDA"))];
  const body = ctx.revStripBody("NVDA", { rows, sum: null, err: null }, 2026);
  const [main, fold] = body.split('<details class="sc-rvs-more sc-rvs-rnd">');
  assert.ok(fold, "the fold exists");
  assert.match(main, /1 note · 2 roundup set aside/);
  assert.ok(!/Underweight/.test(main), "the roundup's downgrade is not in the main list");
  assert.match(main, /<i>target<\/i> \$210/, "Wells Fargo's own 2 Oct note has no old target: the roundup's $999 is never used as one");
  assert.match(fold, /2 roundup-headline notes set aside<\/summary>/); assert.match(fold, /Overweight → Underweight/);
});
test("one firm, two spellings (FMP: 'D.A. Davidson' in targets, 'DA Davidson' in ratings) is one note and one firm", () => {
  const t = db(L.targetRow(MU_DAD, "MU"));
  const g = db(L.gradeRow({ ...MU_CLSA_G, publishedDate: MU_DAD.publishedDate, gradingCompany: "DA Davidson", previousGrade: "Buy", newGrade: "Buy", action: "hold" }, "MU"));
  const older = db(L.targetRow({ ...MU_DAD, publishedDate: "2026-09-01T12:00:00.000Z", priceTarget: 1800, adjPriceTarget: 1800, newsTitle: "DA Davidson note", analystCompany: "DA Davidson" }, "MU"));
  const lines = ctx.revLines([t, g, older]);
  assert.equal(lines.length, 2, "the target and the rating of 1 Oct are one line");
  assert.equal(lines[0].grTo, "Buy"); assert.equal(lines[0].target, 2100);
  const solo = ctx.revLines([db(L.targetRow({ ...MU_DAD, newsTitle: "DA Davidson keeps Buy" }, "MU")), older]);
  assert.equal(solo[0].prior, 1800, "the previous note is found across the two spellings");
});
