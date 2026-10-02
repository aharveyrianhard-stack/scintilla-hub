/* H8 (2 Oct) — BRIEF-20261002-H8-STATS-FACTS-FUNDS. Alan's standing rule for the company view: every fact shown is a real
   fact or a plain "not stored" — never a silent dash where a number should be. Two rules on the STATS tab:
     1. the "not stored" rule — a row with no value prints "not stored" (a live reading that is not there: "no reading") in the
        dim style; the facts FMP now gives (shares outstanding, the float, the last dividend / ex-date / yield) are drawn from
        company_profile's H8 columns; short interest, which FMP does not carry, says so;
     2. the fund rule — a fund (company_profile.is_etf, or a crypto name) gets no earnings rows, no VALUE / GROWTH / BALANCE
        block, and lists its own facts (AUM, NAV, holdings, expense ratio, inception) every time; company_profile.is_fund is
        never the gate (FMP sets it on O, a REIT that reports every quarter).
   Offline: the page's own functions are sliced out of index.html by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const todayISO = () => "2026-10-02";
const fmtPxIdent = (p) => "$" + (p >= 1000 ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2));
const fmtC = (c) => (c >= 0 ? "+" + c.toFixed(2) + "%" : "(" + Math.abs(c).toFixed(2) + "%)");
function statsApi(opts) {   // the same slice H7's tests run: everything from fmtBig to the end of statsActivityHTML, plus statsTabHTML
  const o = opts || {};
  const s0 = page.indexOf("const fmtBig = "), s1 = page.indexOf("function statsActivityHTML"), s2 = page.indexOf("\n}\n", s1) + 3;
  assert.ok(s0 > 0 && s1 > s0 && s2 > s1);
  const src = line(/^const MCAP_MAX_AGE_MS = [^\n]*/m) + fn("scCapAge") + fn("scCapTitle") + line(/^const rb = [^\n]*/m) + fn("volCellHTML") +
    page.slice(s0, s2) + fn("statsTabHTML") +
    "return { stRow, stBlock, stIsFund, stFactsDate, stBarHTML, stRuleHTML, stFillHTML, statsPriceHTML, statsFundHTML, statsBalHTML, statsActivityHTML, statsTabHTML };";
  return new Function("num", "esc", "todayISO", "fmtPxIdent", "fmtC", "fwdTrailPE", "notComparable", "prevClose", "hbRowFor", "hbPct", "fmtRevCell", "fmtRevLocal", "revTitle", "coBoardRow", "isNonOp", src)(
    num, esc, todayISO, fmtPxIdent, fmtC,
    (price, fund) => ({ trail: fund && num(fund.eps_ttm) > 0 && price > 0 ? price / num(fund.eps_ttm) : null, fwd: null, next: null, ccy: "USD" }),
    (c) => "not comparable: EPS in " + c,
    o.prevClose || {}, () => o.hb || null, (v) => "±" + v.toFixed(1) + "%",
    (v) => "$" + (v / 1e9).toFixed(1) + "B", (v, c) => c + " " + (v / 1e9).toFixed(1) + "B", () => "revenue over the last four quarters · fundamentals.revenue_ttm (FMP)",
    () => o.row || {}, o.isNonOp);
}
const NOW_S = Math.floor(Date.now() / 1000) - 3600;
const FACTS = { shares_outstanding: 1129390000, float_shares: 1124578798, dividend_per_share: 0.15, dividend_yield: 0.052649725569129543, ex_dividend_date: "2026-10-14", facts_as_of: "2026-10-02T20:24:37.405+00:00" };   // MU as loaded on 2 Oct (MEASURED)
const MU = {
  t: "MU", price: 1074.47, chg: -2.09,
  _profile: { name: "Micron Technology", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", market_cap: 1.24e12, beta: 1.01, avg_volume: 41.2e6,
    range_52wk: "179.61-1255", shares_out: 1129390000, is_etf: false, is_fund: false, updated_ts: NOW_S, ...FACTS },
  _fund: { eps_ttm: 74.22, revenue_ttm: 133.19e9, market_cap: 1.2e12 },
  _est: [], _pt: null, _ratings: null,
  _finhist: [{ fiscal_year: 2025, revenue: 133.19e9, gross_profit: 107.48e9, operating_income: 99.36e9, ebitda: 99.34e9, net_income: 84.97e9, eps_diluted: 74.22 }],
  _balhist: [{ fiscal_year: 2025, cash_and_equiv: 38.36e9, total_debt: 4.69e9, net_debt: -33.68e9, total_equity: 160e9 }],
  _cfhist: [{ fiscal_year: 2025, free_cf: 89.67e9, dividends_paid: -4.5e9, buybacks: -1.2e9 }],
  events: [{ date: "2026-12-17", confirmed: true, report_time: "amc" }, { date: "2026-09-23", surprise_pct: 4.2 }],
};
const ROW = { t: "MU", rev: 133.19e9, revAsOf: NOW_S, rv: 1.1, rvS: 0.62, rvAsOf: new Date().toISOString() };
const SPY = (extra) => ({ t: "SPY", price: 769.22, chg: 0.68,
  _profile: { name: "SPDR S&P 500 ETF", exchange: "NYSE", sector: "Financial Services", industry: "Asset Management", is_etf: true, is_fund: false, market_cap: 8.13e11, beta: 1.01, avg_volume: 48.6e6,
    range_52wk: "629.28-779.37", updated_ts: NOW_S, shares_outstanding: 1065238226, float_shares: null, dividend_per_share: 1.88883, dividend_yield: 0.9955, ex_dividend_date: "2026-09-18", facts_as_of: "2026-10-02T20:24:37.405+00:00" },
  /* stale rows the store really holds for a fund, which the tab must not draw as reports or statements */
  _fund: { eps_ttm: 5.1, revenue_ttm: 1e9 }, _est: [{ period: "annual", fiscal_date: "2027-12-31", est_eps_avg: 6 }], _pt: { target_low: 700, target_high: 900, target_avg: 800 }, _ratings: { consensus: "Buy" },
  _finhist: [{ fiscal_year: 2024, revenue: 1e9, net_income: 1e8 }, { fiscal_year: 2025, revenue: 2e9, net_income: 2e8 }], _balhist: [{ fiscal_year: 2025, cash_and_equiv: 1e9, total_debt: 0 }], _cfhist: [{ fiscal_year: 2025, dividends_paid: -1e9, buybacks: 0 }],
  events: [{ date: "2017-11-29", surprise_pct: 1 }, { date: "2008-02-16" }],
  _etf: { aum: 809216140000, nav: 762.27, holdings_count: 504, expense_ratio: 0.09, inception_date: "1993-01-22", updated_ts: "2026-10-02T20:40:00+00:00" }, ...(extra || {}) });
const heads = (html) => [...html.matchAll(/<section class="st-blk"><h3 class="st1-h">([^<]+)<\/h3>/g)].map((m) => m[1]);
const rowsOf = (html) => [...html.matchAll(/<div[^>]*><span>([^<]+)<\/span><b/g)].map((m) => [m[1]]);   // the plain rows' labels, in order (the bars carry their own span class)

/* ── 1 · THE "NOT STORED" RULE ────────────────────────────────────────────────────────────────── */
test("a row with no value prints 'not stored' in the dim style (a live reading: 'no reading') — the dash is gone from the row, bar and rule builders", () => {
  const api = statsApi();
  assert.equal(api.stRow("float", null, "why"), '<div title="why"><span>float</span><b class="ns">not stored</b></div>');
  assert.equal(api.stRow("float", "", "why"), '<div title="why"><span>float</span><b class="ns">not stored</b></div>');
  assert.equal(api.stRow("today", null, "why", null, "no reading"), '<div title="why"><span>today</span><b class="ns">no reading</b></div>');
  assert.equal(api.stRow("today", "(2.09%)", "why", true), '<div title="why"><span>today</span><b class="neg">(2.09%)</b></div>', "a value is drawn as before");
  assert.match(api.stBarHTML("price targets", null, 900, 1500, 1074, "dn", "t", null), /<b class="st-vis__v ns">not stored<\/b>/);
  assert.match(api.stRuleHTML("beta", null, null, -1, 3, [0, 1, 2], "t"), /<b class="st-vis__v ns">not stored<\/b>/);
  const src = page.slice(page.indexOf("const ST_NS"), page.indexOf("function cohortEditorHTML"));
  assert.doesNotMatch(src.replace(/\/\*[\s\S]*?\*\//g, ""), /"—"/, "no builder falls back to a dash");
  assert.equal(api.stFillHTML("gross margin", null, "t"), '<div class="st-fill" title="t"><span>gross margin</span><span class="st-fill__track" aria-hidden="true"></span><b class="ns">not stored</b></div>');
  /* a block whose rows are all 'not stored' is not drawn — not a column of 'not stored' either */
  assert.equal(api.stBlock("VALUE", [api.stRow("a", null), api.stRow("b", null)]), "");
  assert.match(api.stBlock("VALUE", [api.stRow("a", null), api.stRow("b", "1")]), /^<section class="st-blk"><h3 class="st1-h">VALUE<\/h3>/);
});

test("MU with the facts FMP gave on 2 Oct: shares out and the float from the H8 columns, short interest named as not carried, the last dividend with its ex-date and yield — and no dash anywhere", () => {
  const api = statsApi({ prevClose: { MU: 1097.39 }, hb: { usual_day_60: 4.8 }, row: ROW });
  const html = api.statsTabHTML(MU);
  assert.deepEqual(heads(html), ["PRICE", "SIZE", "VALUE", "ACTIVITY &amp; DATES", "GROWTH &amp; MARGINS · FY2025", "BALANCE · FY2025"]);
  assert.doesNotMatch(html, /<b>—<\/b>|>—</, "never a dash");
  assert.match(html, /<div title="shares outstanding · company_profile\.shares_outstanding \(FMP \/stable\/shares-float\) · facts as of Oct 2 2026 \(FMP\)"><span>shares out<\/span><b>1\.13B<\/b>/);
  assert.match(html, /<div title="shares free to trade \(the float\) · 99\.6% of shares out · company_profile\.float_shares \(FMP \/stable\/shares-float\) · facts as of Oct 2 2026 \(FMP\)"><span>float<\/span><b>1\.12B<\/b>/);
  assert.match(html, /<div title="not in our tables: FMP&#39;s stable routes carry no short interest \(checked 2 Oct 2026: \/stable\/short-interest answers 404[^"]*"><span>short interest<\/span><b class="ns">not stored<\/b>/);
  assert.match(html, /<div title="the last dividend declared, per share, ex-dividend Oct 14 2026 · company_profile\.dividend_per_share \/ ex_dividend_date \(FMP \/stable\/dividends\) · facts as of Oct 2 2026 \(FMP\)"><span>dividend<\/span><b>\$0\.15 · ex Oct 14<\/b>/);
  assert.match(html, /<div title="FMP&#39;s annualised yield at the last ex-date[^"]*"><span>div\. yield<\/span><b>0\.05%<\/b>/, "under 0.1% keeps two decimals");
  assert.match(html, /<span>dividends FY25<\/span><b>\$4\.50B · 0\.4% yield<\/b>/, "the year's dividends paid stay beside it");
  /* the order inside ACTIVITY & DATES: the battery, avg volume, the two reports, then the dividend facts, then the year's money */
  const act = html.slice(html.indexOf("ACTIVITY &amp; DATES"), html.indexOf("GROWTH &amp; MARGINS"));
  assert.deepEqual(rowsOf(act).map((r) => r[0]), ["volume today", "avg volume", "next report", "last report", "dividend", "div. yield", "dividends FY25", "buybacks FY25"]);
  const untitled = (html.match(/<div(?![^>]*\btitle=)[^>]*>/g) || []).filter((x) => x !== '<div class="st1">');
  assert.deepEqual(untitled, [], "every row still says where its number comes from");
});

test("a company whose facts are not loaded yet, and one with no dividend on record: 'not stored' where the store is empty, 'none on record' where FMP says none, 'no reading' where the quote has no change", () => {
  const api = statsApi({ row: ROW });
  const bare = { ...MU, chg: null, price: null, _profile: { ...MU._profile, shares_outstanding: null, float_shares: null, dividend_per_share: null, dividend_yield: null, ex_dividend_date: null, facts_as_of: null, shares_out: 1.12e9 } };
  let html = api.statsTabHTML(bare);
  assert.match(html, /<span>last<\/span><b class="ns">no reading<\/b>/);
  assert.match(html, /<div title="today&#39;s change against the previous close · Massive live quote · neither the quote row nor the board carries a change figure right now"><span>today<\/span><b class="ns">no reading<\/b>/);
  /* the quote row carries no change but the board row does (after the close, MEASURED 2 Oct): the board's reading, said so on hover */
  const viaBoard = statsApi({ row: { ...ROW, c: -2.15 } }).statsTabHTML(bare);
  assert.match(viaBoard, /<div title="today&#39;s change against the previous close · the board row&#39;s reading \(the quote row carried none\)"><span>today<\/span><b class="neg">\(2\.15%\)<\/b>/);
  assert.match(html, /<div title="shares outstanding · company_profile\.shares_outstanding \(FMP \/stable\/shares-float\) · no facts date stored"><span>shares out<\/span><b>1\.12B<\/b>/, "the older shares_out column is read second");
  assert.match(html, /<span>float<\/span><b class="ns">not stored<\/b>/);
  assert.match(html, /<span>dividend<\/span><b class="ns">not stored<\/b>/);
  assert.doesNotMatch(html, /div\. yield/, "no yield row without a dividend");
  assert.doesNotMatch(html, /<b>—<\/b>/);
  const none = { ...MU, _profile: { ...MU._profile, dividend_per_share: 0, dividend_yield: 0, ex_dividend_date: null } };
  html = api.statsTabHTML(none);
  assert.match(html, /<div title="FMP lists no dividend for this name \(its dividend list is empty\) · company_profile\.dividend_per_share · facts as of Oct 2 2026 \(FMP\)"><span>dividend<\/span><b>none on record<\/b>/);
  assert.doesNotMatch(html, /div\. yield/);
  /* a loss-maker: the multiple does not exist — a fact, said as "none · loss", never "not stored" */
  html = api.statsTabHTML({ ...MU, _fund: { eps_ttm: -2.5, revenue_ttm: 1e9 }, _est: [{ period: "annual", fiscal_date: "2027-08-31", est_eps_avg: -1 }] });
  assert.match(html, /<div title="price ÷ EPS of the last four quarters \(fundamentals\.eps_ttm, FMP\) · computed live, never the stored multiple · no multiple: EPS over the last four quarters is at or below zero"><span>trailing P\/E<\/span><b>none · loss<\/b>/);
  assert.match(html, /<span>earnings yield<\/span><b>none · loss<\/b>/);
  assert.doesNotMatch(html, /<b>—<\/b>/);
  /* a tiny dividend keeps four decimals so it never prints as $0.00 */
  html = api.statsTabHTML({ ...MU, _profile: { ...MU._profile, dividend_per_share: 0.0075 } });
  assert.match(html, /<span>dividend<\/span><b>\$0\.0075 · ex Oct 14<\/b>/);
});

/* ── 2 · THE FUND RULE ─────────────────────────────────────────────────────────────────────────── */
test("a fund (SPY): no earnings rows, no VALUE / GROWTH / BALANCE even when stale rows exist, its own facts listed every time, the dividend kept", () => {
  const api = statsApi({ row: { t: "SPY" } });
  const html = api.statsTabHTML(SPY());
  assert.deepEqual(heads(html), ["PRICE", "SIZE", "ACTIVITY &amp; DATES"]);
  assert.doesNotMatch(html, /next report|last report|Nov 29 2017|2008/, "the 2017 / 2008 earnings_events rows are not reports");
  assert.doesNotMatch(html, /trailing P\/E|EPS \(ttm\)|price targets|consensus|gross margin|revenue YoY|cash &amp; equiv|dividends FY|buybacks|revenue TTM|<span>float<\/span>|short interest/);
  const size = html.slice(html.indexOf("<h3 class=\"st1-h\">SIZE"), html.indexOf("ACTIVITY &amp; DATES"));
  assert.deepEqual(rowsOf(size).map((r) => r[0]), ["market cap", "shares out", "fund assets (AUM)", "NAV", "holdings", "expense ratio", "inception"]);
  assert.match(html, /<span>shares out<\/span><b>1\.07B<\/b>/);
  assert.match(html, /<div title="assets under management · etf_info \(FMP \/stable\/etf\/info\), stored Oct 2 2026"><span>fund assets \(AUM\)<\/span><b>\$809\.22B<\/b>/);
  assert.match(html, /<span>NAV<\/span><b>\$762\.27<\/b>/); assert.match(html, /<span>holdings<\/span><b>504<\/b>/);
  assert.match(html, /<span>expense ratio<\/span><b>0\.09%<\/b>/); assert.match(html, /<span>inception<\/span><b>Jan 22 1993<\/b>/);
  assert.match(html, /<span>dividend<\/span><b>\$1\.89 · ex Sep 18<\/b>/); assert.match(html, /<span>div\. yield<\/span><b>1\.0%<\/b>/);
  assert.doesNotMatch(html, /<b>—<\/b>/);
});

test("a fund with no etf_info row lists its five facts as 'not stored' (never silently absent); a crypto name is a fund by the page's own test; a REIT FMP flags is_fund keeps its reports", () => {
  const api = statsApi({ row: { t: "SPY" } });
  let html = api.statsTabHTML(SPY({ _etf: null }));
  for (const lbl of ["fund assets \\(AUM\\)", "NAV", "holdings", "expense ratio", "inception"])
    assert.match(html, new RegExp('<div title="[^"]* · no etf_info row for this fund yet"><span>' + lbl + '</span><b class="ns">not stored</b>'), lbl);
  assert.doesNotMatch(html, /last report/);
  /* the page's own non-operating test decides (is_etf, or a crypto name): a crypto row with is_etf false is still a fund here */
  const crypto = statsApi({ row: { t: "BTC" }, isNonOp: (d) => d.t === "BTC" });
  html = crypto.statsTabHTML({ ...SPY({ _etf: null }), t: "BTC", _profile: { ...SPY()._profile, is_etf: false } });
  assert.deepEqual(heads(html), ["PRICE", "SIZE", "ACTIVITY &amp; DATES"]); assert.doesNotMatch(html, /last report|trailing P\/E/);
  /* O (Realty Income) carries company_profile.is_fund = true from FMP; it is a REIT with real quarterly reports — not a fund here */
  const reit = { ...MU, t: "O", _profile: { ...MU._profile, is_etf: false, is_fund: true } };
  html = statsApi({ row: ROW }).statsTabHTML(reit);
  assert.match(html, /<span>next report<\/span><b>Dec 17 2026 · AMC<\/b>/); assert.match(html, /GROWTH &amp; MARGINS/); assert.match(html, /<span>float<\/span>/);
  assert.equal(api.stIsFund({ t: "O", _profile: { is_etf: false, is_fund: true } }), false);
  assert.equal(api.stIsFund({ t: "SPY", _profile: { is_etf: "true" } }), true, "a string flag counts, as elsewhere on the page");
});

/* ── 3 · THE WIRING AND THE LOOK ───────────────────────────────────────────────────────────────── */
test("the company read carries the six H8 columns (and is_fund, read but never a gate); the dim style is a grey inside the H7 block", () => {
  assert.match(page, /pg\("company_profile\?ticker=eq\." \+ e \+ "&select=[^"]*,shares_outstanding,float_shares,dividend_per_share,dividend_yield,ex_dividend_date,facts_as_of,ir_url,updated_ts"\)/, "the six columns, with updated_ts still last (an older test pins that)");
  assert.match(page, /&select=ticker,name,exchange,sector,industry,market_cap,beta,avg_volume,range_52wk,shares_out,price,is_etf,is_fund,website,description,/, "nothing dropped from the read");
  const a = page.indexOf("/* H7 (2 Oct; Alan: \"very hard to read"), b = page.indexOf("@media (min-width:1400px){ .cv-side .st1 .st-blk > div", a);
  const css = page.slice(a, b);
  assert.match(css, /\.cv-side \.st1 \.st-blk b\.ns, \.cv-side \.st1 \.st-vis__v\.ns\{color:#6E6E76;font-weight:400\}/, "inside the H7 block, so its grey test covers it");
  assert.doesNotMatch(page.slice(page.indexOf("const ST_NS"), page.indexOf("function cohortEditorHTML")).replace(/\/\*[\s\S]*?\*\//g, ""), /is_fund/, "is_fund never gates the stats (it appears in the comments only)");
  /* the trial copy at /preview/company-view/ carries the same page (rebuilt by build-trial.py) */
  const trial = fs.readFileSync(new URL("../preview/company-view/index.html", import.meta.url), "utf8");
  assert.ok(trial.includes("const ST_NS = '<b class=\"ns\">';"), "the trial copy carries the H8 rule");
});
