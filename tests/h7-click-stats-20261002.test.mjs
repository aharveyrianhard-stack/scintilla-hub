/* H7 (2 Oct) — BRIEF-20261002-H7-HUB-CLICK-STATS. Two of Alan's 2 Oct ~11:35 ET notes:
   1. "Dashboard: clicking on a ticker is not supposed to send me automatically to the EXPANDED state. It's supposed to open
      the view that replaces the cohort-compare section (the right side); then we expand."
   2. "We have really good space in the back tab for the stickers on the dashboard, but it's very hard to read — disorganized,
      like this 52-week range; the table is a little messy; the text is too big, which makes it disorganized; we should find
      some visual ways to show some stuff too."
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

/* ── 1 · THE CLICK ─────────────────────────────────────────────────────────────────────────────── */
test("the click: EXPAND is a choice per visit — the page neither reads nor writes hub.company.expanded", () => {
  assert.match(page, /^let CO_EXPANDED = false;$/m, "the state starts collapsed on every page load");
  assert.doesNotMatch(page, /lsGet\(CO_EXP_KEY\)/, "never read back");
  assert.doesNotMatch(page, /lsSet\(CO_EXP_KEY/, "never written");
  assert.doesNotMatch(page, /localStorage\.setItem\("hub\.company\.expanded"/);
  assert.match(page, /try \{ localStorage\.removeItem\(CO_EXP_KEY\); \} catch \(_\) \{\}/, "a browser that remembered the old flag has it cleared once");
});

test("the click: a fresh open (openCo — a board row, search, the map, the tapes) always starts collapsed, even after EXPAND was pressed", () => {
  const src = fn("openCo");
  assert.match(src, /CO_EXPANDED = false;/);
  const run = (expanded, mountedKey, calls) => new Function("CO_EXPANDED", "mountedKey", "S", "clearSecFs", "revealTabs", "updateMtabs", "pinLeft", "sync", "coBringIntoView",
    src + '\nopenCo("MU"); return { expanded: CO_EXPANDED, sec: S.sec, focusT: S.focusT };')(
    expanded, mountedKey, { sec: "DASHBOARD", focusT: null }, () => calls.push("clearSecFs"), () => {}, () => {}, (t) => calls.push("pinLeft:" + t), () => calls.push("sync"), () => {});
  /* on the dashboard, after EXPAND: the next ticker click pins the name into the right-side view, collapsed */
  const c1 = [], r1 = run(true, "DASH", c1);
  assert.equal(r1.expanded, false); assert.equal(r1.sec, "COMPANY"); assert.equal(r1.focusT, "MU");
  assert.deepEqual(c1, ["clearSecFs", "pinLeft:MU"], "the left panel is swapped; the board is untouched");
  /* arriving from another room: the frame is built, still collapsed */
  const c2 = [], r2 = run(true, "NEWS", c2);
  assert.equal(r2.expanded, false); assert.deepEqual(c2, ["clearSecFs", "sync"]);
  /* already collapsed stays collapsed */
  assert.equal(run(false, "DASH", []).expanded, false);
});

test("the click: EXPAND toggles for this visit only; walking the names inside the expanded view (its rail, ↑/↓) keeps it", () => {
  const sw = page.slice(page.indexOf('case "coexpand": {'), page.indexOf('case "addchart": {'));
  assert.ok(sw.length > 0 && sw.length < 1200, "the EXPAND case found");
  assert.doesNotMatch(sw, /lsSet|localStorage/, "nothing is written to the browser");
  assert.match(sw, /CO_EXPANDED = !CO_EXPANDED;/);
  const body = sw.slice(sw.indexOf("{") + 1, sw.lastIndexOf("break;"));
  const writes = [];
  const toggle = (from) => new Function("CO_EXPANDED", "e", "el", "coExpandBtnHTML", "coExpandApply", "cvRailFreeze", "cvRailRepaint", "lsSet", body + "\nreturn CO_EXPANDED;")(
    from, { preventDefault() {}, stopPropagation() {} }, () => null, () => "", () => true, () => {}, () => {}, (k, v) => writes.push(k + "=" + v));
  assert.equal(toggle(false), true, "EXPAND");
  assert.equal(toggle(true), false, "COLLAPSE");
  assert.deepEqual(writes, [], "no storage write either way");
  /* the rail (a name clicked inside the expanded view) and ↑/↓ pin directly — never through openCo — so EXPAND survives the walk */
  const rail = page.slice(page.indexOf('case "cvrail": {'), page.indexOf('case "coexpand": {'));
  assert.match(rail, /pinLeft\(a\.dataset\.t\)/); assert.doesNotMatch(rail, /openCo\(/);
  const step = fn("cvStep");
  assert.match(step, /pinLeft\(n\.t\)/); assert.doesNotMatch(step, /openCo\(/);
  assert.doesNotMatch(fn("pinLeft"), /CO_EXPANDED/, "pinning a name does not touch the choice");
  /* the rule that turns the choice into the full-width layout is unchanged: only while a company is pinned */
  const coExpandOn = new Function(fn("coExpandOn") + "return coExpandOn;")();
  assert.equal(coExpandOn(true, "PINNED", "MU", null), true);
  assert.equal(coExpandOn(true, "AUTO", null, null), false, "nothing pinned: the board is never hidden behind an empty pane");
  assert.equal(coExpandOn(false, "PINNED", "MU", null), false);
  assert.equal(coExpandOn(true, "PINNED", "MU", "XLK"), false, "the heat view keeps its own layout");
});

/* ── 2 · THE STATS TAB ─────────────────────────────────────────────────────────────────────────── */
const todayISO = () => "2026-10-02";
const fmtPxIdent = (p) => "$" + (p >= 1000 ? p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : p.toFixed(2));
const fmtC = (c) => (c >= 0 ? "+" + c.toFixed(2) + "%" : "(" + Math.abs(c).toFixed(2) + "%)");
function statsApi(opts) {
  const o = opts || {};
  const s0 = page.indexOf("const fmtBig = "), s1 = page.indexOf("function statsActivityHTML"), s2 = page.indexOf("\n}\n", s1) + 3;
  assert.ok(s0 > 0 && s1 > s0 && s2 > s1);
  const src = line(/^const MCAP_MAX_AGE_MS = [^\n]*/m) + fn("scCapAge") + fn("scCapTitle") + line(/^const rb = [^\n]*/m) + fn("volCellHTML") +
    page.slice(s0, s2) + fn("statsTabHTML") +
    "return { stBarPos, stRange52, stBarHTML, stRuleHTML, stFillHTML, statsPriceHTML, statsFundHTML, statsBalHTML, statsActivityHTML, statsTabHTML };";
  return new Function("num", "esc", "todayISO", "fmtPxIdent", "fmtC", "fwdTrailPE", "notComparable", "prevClose", "hbRowFor", "hbPct", "fmtRevCell", "fmtRevLocal", "revTitle", "coBoardRow", src)(
    num, esc, todayISO, fmtPxIdent, fmtC,
    (price, fund) => ({ trail: fund && num(fund.eps_ttm) > 0 && price > 0 ? price / num(fund.eps_ttm) : null, fwd: null, next: null, ccy: "USD" }),
    (c) => "not comparable: EPS in " + c,
    o.prevClose || {}, () => o.hb || null, (v) => "±" + v.toFixed(1) + "%",
    (v) => "$" + (v / 1e9).toFixed(1) + "B", (v, c) => c + " " + (v / 1e9).toFixed(1) + "B", () => "revenue over the last four quarters · fundamentals.revenue_ttm (FMP)",
    () => o.row || {});
}
const NOW_S = Math.floor(Date.now() / 1000) - 3600;
const MU = {
  t: "MU", price: 1074.47, chg: -2.09,
  _profile: { name: "Micron Technology", exchange: "NASDAQ", sector: "Technology", industry: "Semiconductors", market_cap: 1.24e12, beta: 1.01, avg_volume: 41.2e6,
    range_52wk: "179.61-1255", shares_out: 1.12e9, updated_ts: NOW_S },
  _fund: { eps_ttm: 74.22, revenue_ttm: 133.19e9, market_cap: 1.2e12 },
  _est: [{ period: "annual", fiscal_date: "2027-08-31", est_eps_avg: 160, est_revenue_avg: 255e9 }],
  _pt: { target_low: 900, target_high: 1500, target_avg: 1200, target_median: 1180, num_analysts: 38 },
  _ratings: { consensus: "Buy", strong_buy: 20, buy: 12, hold: 5, sell: 1, strong_sell: 0 },
  _finhist: [
    { fiscal_year: 2020, revenue: 21.4e9, gross_profit: 6.6e9, operating_income: 3.0e9, ebitda: 9.6e9, net_income: 2.7e9, eps_diluted: 2.37 },
    { fiscal_year: 2021, revenue: 27.7e9, gross_profit: 10.4e9, operating_income: 6.8e9, ebitda: 13.9e9, net_income: 5.9e9, eps_diluted: 5.14 },
    { fiscal_year: 2022, revenue: 30.8e9, gross_profit: 13.9e9, operating_income: 9.7e9, ebitda: 17.0e9, net_income: 8.7e9, eps_diluted: 7.75 },
    { fiscal_year: 2023, revenue: 15.5e9, gross_profit: -1.4e9, operating_income: -5.7e9, ebitda: 2.0e9, net_income: -5.8e9, eps_diluted: -5.34 },
    { fiscal_year: 2024, revenue: 25.1e9, gross_profit: 5.6e9, operating_income: 1.3e9, ebitda: 9.1e9, net_income: 0.78e9, eps_diluted: 0.70 },
    { fiscal_year: 2025, revenue: 133.19e9, gross_profit: 107.48e9, operating_income: 99.36e9, ebitda: 99.34e9, net_income: 84.97e9, eps_diluted: 74.22 },
  ],
  _balhist: [{ fiscal_year: 2025, cash_and_equiv: 38.36e9, total_debt: 4.69e9, net_debt: -33.68e9, total_equity: 160e9 }],
  _cfhist: [{ fiscal_year: 2025, free_cf: 89.67e9, dividends_paid: -4.5e9, buybacks: -1.2e9 }],
  events: [{ date: "2026-12-17", confirmed: true, report_time: "amc" }, { date: "2026-09-23", surprise_pct: 4.2, eps_actual: 3.1, eps_estimate: 2.98 }],
};
const ROW = { t: "MU", rev: 133.19e9, revAsOf: NOW_S, rv: 1.1, rvS: 0.62, rvAsOf: new Date().toISOString() };

test("the bar maths: where today's price sits on a low … high bar, clamped, never a bar without a range", () => {
  const api = statsApi();
  assert.equal(api.stBarPos(1074.47, 179.61, 1255).toFixed(1), "83.2", "(1074.47 − 179.61) ÷ (1255 − 179.61)");
  assert.equal(api.stBarPos(179.61, 179.61, 1255), 0, "at the low");
  assert.equal(api.stBarPos(1255, 179.61, 1255), 100, "at the high");
  assert.equal(api.stBarPos(100, 179.61, 1255), 0, "below the low sits on the end");
  assert.equal(api.stBarPos(2000, 179.61, 1255), 100, "above the high sits on the end");
  assert.equal(api.stBarPos(717.3, 179.61, 1255).toFixed(1), "50.0", "half way");
  assert.equal(api.stBarPos(null, 179.61, 1255), null);
  assert.equal(api.stBarPos(500, 1255, 1255), null, "a range of zero width is no bar");
  assert.equal(api.stBarPos(500, 1255, 179.61), null, "a high under the low is no bar");
  assert.equal(api.stBarPos("1.01", -1, 3).toFixed(2), "50.25", "beta 1.01 on the −1 … 3 rule");
  /* FMP's 52-week string, in the shapes it comes in */
  assert.deepEqual(api.stRange52("179.61-1255"), [179.61, 1255]);
  assert.deepEqual(api.stRange52("1,019.5 – 1,255.00"), [1019.5, 1255]);
  assert.deepEqual(api.stRange52("$629.28 - $779.37"), [629.28, 779.37]);
  assert.equal(api.stRange52(""), null); assert.equal(api.stRange52(null), null); assert.equal(api.stRange52("n/a"), null);
  assert.equal(api.stRange52("1255-179.61"), null, "a high under the low is refused");
});

test("the pictures: the range bar, the rule and the filled bar carry the mark where the maths says, in the day's colour", () => {
  const api = statsApi();
  const bar = api.stBarHTML("52-week range", "(14.4%) high", 179.61, 1255, 1074.47, "dn", "where it comes from", null);
  assert.match(bar, /^<div class="st-vis" title="where it comes from"><span class="st-vis__l">52-week range<\/span><b class="st-vis__v">\(14\.4%\) high<\/b>/);
  assert.match(bar, /<em class="st-bar__lo">\$179\.61<\/em><span class="st-bar" aria-hidden="true"><i class="st-bar__mark dn" style="left:83\.2%"><\/i><\/span><em class="st-bar__hi">\$1,255\.00<\/em><\/div>$/);
  const up = api.stBarHTML("price targets", "avg $1200.00", 900, 1500, 1074.47, "up", "t", 1200);
  assert.match(up, /<i class="st-bar__tick" style="left:50\.0%"><\/i><i class="st-bar__mark up" style="left:29\.1%"><\/i>/, "the average target as a tick, today's price as the mark");
  assert.doesNotMatch(api.stBarHTML("x", null, 1, 2, null, "", "", null), /st-bar__mark/, "no price: a bar with no mark, never a guessed one");
  const rule = api.stRuleHTML("beta", "1.01", 1.01, -1, 3, [0, 1, 2], "t");
  assert.match(rule, /<em class="st-bar__lo">-1<\/em><span class="st-bar st-bar--rule" aria-hidden="true"><i class="st-bar__tick" style="left:25\.0%"><\/i><i class="st-bar__tick" style="left:50\.0%"><\/i><i class="st-bar__tick" style="left:75\.0%"><\/i><i class="st-bar__mark" style="left:50\.[23]%"><\/i><\/span><em class="st-bar__hi">3<\/em>/);
  assert.equal(api.stFillHTML("gross margin", 80.7, "t"), '<div class="st-fill" title="t"><span>gross margin</span><span class="st-fill__track" aria-hidden="true"><i class="up" style="width:80.7%"></i></span><b>80.7%</b></div>');
  assert.equal(api.stFillHTML("net margin", -37.4, "t"), '<div class="st-fill" title="t"><span>net margin</span><span class="st-fill__track" aria-hidden="true"><i class="dn" style="width:37.4%"></i></span><b class="neg">(37.4%)</b></div>');
  assert.match(api.stFillHTML("gross margin", 140, "t"), /width:100\.0%/, "a share over 100 fills the bar, never spills");
  assert.equal(api.stFillHTML("gross margin", null, "t"), '<div class="st-fill" title="t"><span>gross margin</span><span class="st-fill__track" aria-hidden="true"></span><b>—</b></div>');
});

test("the blocks from a fixture (MU): six blocks, the facts of R3's three columns, the 52-week string replaced by its bar, every row with its source on hover", () => {
  const api = statsApi({ prevClose: { MU: 1097.39 }, hb: { usual_day_60: 4.8 }, row: ROW });
  const html = api.statsTabHTML(MU);
  const heads = [...html.matchAll(/<section class="st-blk"><h3 class="st1-h">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ["PRICE", "SIZE", "VALUE", "ACTIVITY &amp; DATES", "GROWTH &amp; MARGINS · FY2025", "BALANCE · FY2025"], "today's volume and the dates before the fiscal-year blocks");
  /* PRICE */
  assert.match(html, /<span>last<\/span><b>\$1,074\.47<\/b>/);
  assert.match(html, /<span>today<\/span><b class="neg">\(2\.09%\)<\/b>/);
  assert.match(html, /<span>prev close<\/span><b>\$1,097\.39<\/b>/);
  assert.doesNotMatch(html, /179\.61-1255/, "the raw range string is gone");
  assert.match(html, /<span class="st-vis__l">52-week range<\/span><b class="st-vis__v">\(14\.4%\) from high<\/b><em class="st-bar__lo">\$179\.61<\/em><span class="st-bar" aria-hidden="true"><i class="st-bar__mark dn" style="left:83\.2%"><\/i><\/span><em class="st-bar__hi">\$1,255\.00<\/em>/, "the bar, the day's colour on the mark");
  assert.match(html, /title="the 52-week low and high \(company_profile\.range_52wk, FMP, profile stored \d{4}-\d\d-\d\d\) with today&#39;s price on the bar · \(14\.4%\) from the high, \+498\.2% from the low"/, "the from-low lives on the hover");
  assert.match(html, /<span class="st-vis__l">beta<\/span><b class="st-vis__v">1\.01<\/b><em class="st-bar__lo">-1<\/em><span class="st-bar st-bar--rule"/);
  assert.match(html, /<span>usual day<\/span><b>±4\.8% · 0\.4× today<\/b>/);
  /* SIZE — the market cap keeps its as-of note (SWITCH-ON), revenue is the board row's, shares out from the profile */
  assert.match(html, /<span>market cap<\/span><b>1\.24T <i class="sc-asof"[^>]*title="market cap as stored \d{4}-\d\d-\d\d \(company_profile\)">as of \d{4}-\d\d-\d\d<\/i><\/b>/);
  assert.match(html, /<span>revenue TTM<\/span><b>\$133\.2B<\/b>/);
  assert.match(html, /<span>shares out<\/span><b>1\.12B<\/b>/);
  assert.doesNotMatch(html, /fund assets/, "a company has no fund rows");
  /* VALUE — the multiples as before, the targets as a bar with the average tick, the consensus */
  assert.match(html, /<span>trailing P\/E<\/span><b>14\.5<\/b>/);
  assert.match(html, /<span>earnings yield<\/span><b>6\.9%<\/b>/);
  assert.match(html, /<span>EPS \(ttm\)<\/span><b>\$74\.22<\/b>/);
  assert.match(html, /<span class="st-vis__l">price targets<\/span><b class="st-vis__v">avg \$1200\.00<\/b><em class="st-bar__lo">\$900\.00<\/em><span class="st-bar" aria-hidden="true"><i class="st-bar__tick" style="left:50\.0%"><\/i><i class="st-bar__mark dn" style="left:29\.1%"><\/i><\/span><em class="st-bar__hi">\$1,500\.00<\/em>/);
  assert.match(html, /title="the analysts&#39; lowest and highest 12-month price targets[^"]*38 analysts · median \$1180\.00"/, "the hover is an attribute: its apostrophe is escaped");
  assert.match(html, /<span>consensus<\/span><b>Buy<\/b>/);
  /* GROWTH & MARGINS — the margins as filled bars, the growth rows as before */
  assert.match(html, /<span>gross margin<\/span><span class="st-fill__track" aria-hidden="true"><i class="up" style="width:80\.7%"><\/i><\/span><b>80\.7%<\/b>/);
  assert.match(html, /<span>net margin<\/span><span class="st-fill__track" aria-hidden="true"><i class="up" style="width:63\.8%"><\/i><\/span><b>63\.8%<\/b>/);
  assert.match(html, /<span>revenue YoY<\/span><b>\+430\.6%<\/b>/);
  assert.match(html, /<span>revenue 5y CAGR<\/span><b>\+44\.1%<\/b>/);
  assert.match(html, /<span>revenue fwd FY27e<\/span><b>\+91\.5%<\/b>/);
  assert.match(html, /<span>eps fwd FY27e<\/span><b>\+115\.6%<\/b>/);
  /* BALANCE — the sheet and the year's lines, a net cash position in red brackets as before */
  assert.match(html, /<span>cash &amp; equiv<\/span><b>\$38\.36B<\/b>/);
  assert.match(html, /<span>net debt<\/span><b class="neg">\(\$33\.68B\) net cash<\/b>/);
  assert.match(html, /<span>debt \/ equity<\/span><b>0\.03<\/b>/);
  assert.match(html, /<span>free cash flow<\/span><b>\$89\.67B<\/b>/);
  /* ACTIVITY & DATES — the board's battery and number, the dates, the year's dividends with the yield, the buybacks */
  assert.match(html, /<span>volume today<\/span><b><span class="sc-vol" title="[^"]*62% of a usual session[^"]*"><span class="sc-vol__dots" aria-hidden="true">(<i( class="on")?><\/i>){5}<\/span><span class="sc-vol__n">1\.1×<\/span><\/span><\/b>/);
  assert.match(html, /<span>avg volume<\/span><b>41\.2M<\/b>/);
  assert.match(html, /<div title="the next earnings report · earnings_events \(FMP\) · confirmed by the company"><span>next report<\/span><b>Dec 17 2026 · AMC<\/b>/);
  assert.match(html, /<div title="the last earnings report, Sep 23 2026, EPS \+4\.2% against the estimate · earnings_events \(FMP\)"><span>last report<\/span><b>Sep 23 · EPS \+4\.2%<\/b>/);
  assert.match(html, /<span>dividends FY25<\/span><b>\$4\.50B · 0\.4% yield<\/b>/);
  assert.match(html, /<span>buybacks FY25<\/span><b>\$1\.20B<\/b>/);
  /* the foot line, and every row says where its number comes from */
  assert.match(html, /<div class="st-foot" title="sector · industry · exchange \(company_profile, FMP\)">Technology · Semiconductors · NASDAQ<\/div><\/div>$/);
  const untitled = (html.match(/<div(?![^>]*\btitle=)[^>]*>/g) || []).filter((x) => x !== '<div class="st1">');
  assert.deepEqual(untitled, [], "every row carries its source on hover");
  assert.doesNotMatch(html, /class="kv2"|class="estsec"|st1-col/, "R3's rails are gone");
});

test("a fund (SPY): PRICE, SIZE with the fund's own facts, ACTIVITY — no column of dashes for the blocks it has no numbers for", () => {
  const api = statsApi({ row: { t: "SPY" } });
  const SPY = { t: "SPY", price: 769.22, chg: 0.68,
    _profile: { name: "SPDR S&P 500 ETF", exchange: "NYSE", sector: "Financial Services", industry: "Asset Management", is_etf: true, market_cap: 6.5e11, beta: 1.0, avg_volume: 48.6e6, range_52wk: "629.28-779.37", updated_ts: NOW_S },
    _fund: null, _est: [], _pt: null, _ratings: null, _finhist: [], _balhist: [], _cfhist: [], events: [],
    _etf: { aum: 650e9, nav: 769.1, holdings_count: 503, expense_ratio: 0.09, inception_date: "1993-01-22" } };
  const html = api.statsTabHTML(SPY);
  const heads = [...html.matchAll(/<section class="st-blk"><h3 class="st1-h">([^<]+)<\/h3>/g)].map((m) => m[1]);
  assert.deepEqual(heads, ["PRICE", "SIZE", "ACTIVITY &amp; DATES"]);
  assert.match(html, /<i class="st-bar__mark up" style="left:93\.2%"><\/i>/, "up day: a green mark near the high");
  assert.match(html, /<span>fund assets \(AUM\)<\/span><b>\$650\.00B<\/b>/);
  assert.match(html, /<span>NAV<\/span><b>\$769\.10<\/b>/);
  assert.match(html, /<span>holdings<\/span><b>503<\/b>/);
  assert.match(html, /<span>expense ratio<\/span><b>0\.09%<\/b>/);
  assert.match(html, /<span>inception<\/span><b>Jan 22 1993<\/b>/);
  assert.match(html, /class="sc-vol sc-vol--none"/, "no relative-volume row: the empty battery, never a borrowed charge");
  assert.doesNotMatch(html, /next report|dividends|trailing P\/E/);
  /* nothing at all: no crash, the honest line */
  assert.equal(statsApi().statsTabHTML({ t: "X" }).includes('<section class="st-blk"><h3 class="st1-h">PRICE</h3>'), false);
});

test("the look: the grid, greys only, the row type 10 CSS px only where the page is zoomed (drawn 11.2 px and up), 11 px elsewhere", () => {
  assert.match(page, /\.cv-side \.st1\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(210px,1fr\)\);gap:4px 18px;align-content:start;font-family:var\(--mono\)\}/);
  const a = page.indexOf("/* H7 (2 Oct; Alan: \"very hard to read"), b = page.indexOf("@media (min-width:1400px){ .cv-side .st1 .st-blk > div", a);
  assert.ok(a > 0 && b > a, "the H7 block is there");
  const css = page.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, hex + " is a grey");
  }
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "font " + m[0]);
  assert.match(page.slice(b, b + 200), /^@media \(min-width:1400px\)\{ \.cv-side \.st1 \.st-blk > div, \.cv-side \.st1 \.st-foot\{font-size:10px\} \}/, "the smaller row type is gated on the zoomed widths only");
  assert.match(page, /@media \(min-width:1400px\)\{ body\{ zoom:1\.12;/, "…where the page is zoomed ×1.12 (11.2 px drawn) and ×1.28 at 1680 (12.8 px)");
  assert.match(css, /\.st-bar__mark\.up\{background:var\(--bull\)/); assert.match(css, /\.st-bar__mark\.dn\{background:var\(--bear\)/);
  assert.doesNotMatch(page, /\.kv2\b|kvRow|ST_TABS|stSec\(/, "R3's rails and their CSS are retired, not left dead");
});
