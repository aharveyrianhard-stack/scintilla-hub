/* R3 (27 Sep) — THE COMPANY VIEW, ROUND 3: Alan's notes on the trial.
   "REMOVE the six-key-numbers row … Use what exists: all the tabs … Stats can fit one screen; Financials seem slim and
   shitty — richer; Analyst gets more space." · "Social tab: keyword mentions (YouTube, X) belong here." · "target median —
   from the comps or what?" · the six-line RSI fan (tests/hub-company-view-r2.test.mjs) · the visual ladder
   (tests/geiger-meter-geometry.test.mjs).
   Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

/* WAVE 19 (27 Sep): R3 is NOT on the live page. It ships only as the trial copy at /preview/company-view/ until Alan
   approves it, so these checks read the trial copy (minus its <base> line and TRIAL banner) instead of index.html.
   Taken from candidate/company-view-r3-20260927 tests/hub-company-view-r3.test.mjs; only the page source and the last
   test changed. */
const trial = fs.readFileSync(new URL("../preview/company-view/index.html", import.meta.url), "utf8");
const BASE_RE = /<base href="\/">\n<!-- TRIAL COPY \((?:27|28) Sep\): company view round [34] \(R[34], candidate\/company-view-r[34]-2026092[78], built from [0-9a-f]+\)[^\n]*-->\n/;
const BANNER_RE = /<div id="trialBanner"[^\n]*TRIAL · company view round [34][^\n]*<\/div>\n<\/body>/;
const page = trial.replace(BASE_RE, "").replace(BANNER_RE, "</body>");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const ET_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
const ET_MD = new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", month: "short", day: "numeric" });

/* ── SOCIAL ─────────────────────────────────────────────────────────────────────────────────────── */
const soc = new Function("ET_DAY", "ET_MD", "esc",
  line(/^const SOC_DAYS = [^\n]*/m) + line(/^const SOC_LEGAL = [^\n]*/m) + page.match(/^const SOC_GENERIC = new Set\(\[[\s\S]*?\]\);\n/m)[0] +
  fn("socKeywords") + fn("socHits") + fn("socDay") + fn("socDaysBack") + fn("socMatchX") + fn("socMatchYT") + fn("socSeries") + fn("socAgo") + fn("socBlockHTML") +
  "\nreturn { socKeywords, socMatchX, socMatchYT, socSeries, socDaysBack, socBlockHTML, SOC_DAYS };")(ET_DAY, ET_MD, esc);
const K = (kws) => kws.map((w) => w.k);

test("SOCIAL keywords: the cashtag always; the short company name only when it is a real, specific word; a fund gets the cashtag only", () => {
  assert.deepEqual(K(soc.socKeywords("MU", "Micron Technology, Inc. · NASDAQ", false)), ["$MU", "Micron"]);
  assert.deepEqual(K(soc.socKeywords("NVDA", "NVIDIA Corporation", false)), ["$NVDA", "NVIDIA"]);
  assert.deepEqual(K(soc.socKeywords("ARM", "Arm Holdings plc", false)), ["$ARM"], "Arm is too short to count safely");
  assert.deepEqual(K(soc.socKeywords("AMD", "Advanced Micro Devices, Inc.", false)), ["$AMD"], "a generic first word is not a keyword");
  assert.deepEqual(K(soc.socKeywords("SPY", "SPDR S&P 500 ETF Trust", true)), ["$SPY"]);
  assert.deepEqual(K(soc.socKeywords("AAPL", "", false)), ["$AAPL"], "no name on file: the cashtag alone");
});

test("SOCIAL X: a post counts when it or the post it quotes holds a keyword, whole words only; older than the window is left out", () => {
  const kws = soc.socKeywords("MU", "Micron Technology, Inc.", false);
  const posts = [
    { created_at: "2026-09-25T20:00:00Z", handle: "a", id: "1", text: "Loading $MU into the print" },
    { created_at: "2026-09-25T19:00:00Z", handle: "b", id: "2", text: "look at this", original: { text: "MICRON guides up" } },
    { created_at: "2026-09-25T18:00:00Z", handle: "c", id: "3", text: "$MUX is not it, nor is Micronesia" },
    { created_at: "2026-07-01T18:00:00Z", handle: "d", id: "4", text: "$MU old" },
  ];
  const hits = soc.socMatchX(posts, kws, "2026-08-27T00:00:00.000Z");
  assert.deepEqual(hits.map((h) => h.who), ["@a", "@b"]);
  assert.deepEqual(hits[1].hit, ["Micron"]);
  assert.equal(hits[0].url, "https://x.com/a/status/1", "a post without its own url links by handle and id");
});

test("SOCIAL YouTube: filed under the ticker or a keyword in the title; one row per video", () => {
  const kws = soc.socKeywords("MU", "Micron Technology, Inc.", false);
  const vids = [
    { video_id: "v1", ticker: "MU", channel_title: "A", title: "Memory stocks now", published_at: "2026-09-26T10:00:00Z" },
    { video_id: "v2", ticker: null, channel_title: "B", title: "Micron earnings preview", published_at: "2026-09-26T09:00:00Z" },
    { video_id: "v2", ticker: "MU", channel_title: "B", title: "Micron earnings preview", published_at: "2026-09-26T09:00:00Z" },
    { video_id: "v3", ticker: "NVDA", channel_title: "C", title: "Nvidia &amp; the rest", published_at: "2026-09-26T08:00:00Z" },
  ];
  const ys = soc.socMatchYT(vids, "MU", kws);
  assert.deepEqual(ys.map((y) => [y.who, y.hit.join("|")]), [["A", "filed under $MU"], ["B", "Micron"]]);
  assert.equal(ys[0].url, "https://www.youtube.com/watch?v=v1");
  /* youtube_feed is a subset of youtube_videos (measured): read once */
  assert.equal((page.match(/youtube_feed\?select=/g) || []).length, 1, "the SOCIAL tab does not read the feed a second time");
});

test("SOCIAL counts: one bar per New York day for 30 days, today last; 24 h, 7 days, the 7 before, and the change", () => {
  const days = soc.socDaysBack("2026-09-27", 30);
  assert.equal(days.length, 30); assert.equal(days[29], "2026-09-27"); assert.equal(days[0], "2026-08-29");
  const now = Date.parse("2026-09-27T20:00:00Z");
  const at = (h) => ({ at: new Date(now - h * 3600e3).toISOString() });
  const ser = soc.socSeries([at(1), at(2), at(30), at(100), at(200), at(24 * 9), at(24 * 40)], days, now);
  assert.equal(ser.h24, 2); assert.equal(ser.d7, 4, "1 h, 2 h, 30 h, 100 h"); assert.equal(ser.p7, 2, "200 h and 9 days"); assert.equal(ser.n, 6, "the 40-day-old one is outside the bars");
  assert.equal(ser.bars[29], 2, "today's two"); assert.equal(ser.bars.reduce((a, b) => a + b, 0), 6);
  const html = soc.socBlockHTML("X", "posts", ser, days, "fresh note");
  assert.match(html, /<i>LAST 24 H<\/i><b>2<\/b>/);
  assert.match(html, /<i>CHANGE<\/i><b class="up">\+100%<\/b>/, "4 against 2");
  assert.equal((html.match(/<span title="/g) || []).length, 30, "thirty bars");
  assert.match(html, /SEP 27 · TODAY/);
  assert.match(html, /fresh note/, "the X feed's own newest post and size are printed under its bars");
});

test("SOCIAL is a tab again, with the keywords printed on it; nothing is written", () => {
  assert.match(fn("coTabHTML"), /case "SOCIAL":\s+return coSocialHTML\(data\);/);
  const h = fn("coSocialHTML");
  assert.match(h, /<i>KEYWORDS<\/i>/);
  assert.match(h, /= a word-list lean, not AI/, "R4: the lean is shown per mention, and says what it is");
  const load = fn("coSocialLoad");
  assert.match(load, /sentiX\(\)/, "the X feed through the SENTIMENT room's shared ten-minute cache");
  assert.match(load, /pg\("youtube_videos\?select=video_id,ticker,channel_id,channel_title,title,published_at,source,subscription_accounts&published_at=gte\./, "R4: each video carries where it came from");
  assert.doesNotMatch(load, /method:\s*"(POST|PATCH|DELETE)"/);
});

/* ── FINANCIALS ─────────────────────────────────────────────────────────────────────────────────── */
const finB = new Function(line(/^const finB = [^\n]*/m).replace(/\n$/, "") + page.slice(page.indexOf("const finB = ") + page.match(/^const finB = [^\n]*/m)[0].length, page.indexOf("\n};\n", page.indexOf("const finB = ")) + 3) + "\nreturn finB;")();
const finEPS = new Function(page.slice(page.indexOf("const finEPS = "), page.indexOf("\n};\n", page.indexOf("const finEPS = ")) + 3) + "\nreturn finEPS;")();
const fin = new Function("num", "esc", "finB", "finEPS", "QORD",
  line(/^const finPct = [^\n]*/m) + line(/^const finChg = [^\n]*/m) + line(/^const finX = [^\n]*/m) + fn("finRatio") + fn("finGrowth") + fn("finQuarters") + fn("finTable") +
  line(/^const finCell = [^\n]*/m) + fn("finQBarsHTML") + fn("financialsTabHTML") + "\nreturn { finQuarters, financialsTabHTML };")(num, esc, finB, finEPS, { Q1: 1, Q2: 2, Q3: 3, Q4: 4 });
const q = (period, fiscal_year, revenue, gp, oi, ni, eps) => ({ period, fiscal_year, revenue, gross_profit: gp, operating_income: oi, net_income: ni, eps_diluted: eps });
/* MU's stored quarters (fundamentals_history, 27 Sep), $ */
const MUQ = [q("Q2", 2025, 8.053e9, 2.96e9, 1.77e9, 1.583e9, 1.41), q("Q3", 2025, 9.301e9, 3.51e9, 2.17e9, 1.885e9, 1.68),
  q("Q4", 2025, 11.315e9, 5.05e9, 3.75e9, 3.201e9, 2.83), q("Q1", 2026, 13.643e9, 7.64e9, 6.14e9, 5.24e9, 4.60),
  q("Q2", 2026, 23.86e9, 17.755e9, 16.135e9, 13.785e9, 12.08), q("Q3", 2026, 41.456e9, 35.056e9, 33.318e9, 28.243e9, 24.67),
  q("Q4", 2024, 7.75e9, 2.74e9, 1.52e9, 0.887e9, 0.79), q("Q1", 2025, 8.709e9, 3.35e9, 2.17e9, 1.87e9, 1.67), q("Q3", 2024, 6.811e9, 1.83e9, 0.72e9, 0.332e9, 0.30)];

test("FINANCIALS quarters: the last eight in fiscal order, each against the same quarter a year before", () => {
  const qs = fin.finQuarters(MUQ, 8);
  assert.deepEqual(qs.map((x) => x.short), ["Q4·24", "Q1·25", "Q2·25", "Q3·25", "Q4·25", "Q1·26", "Q2·26", "Q3·26"]);
  assert.equal(qs[7].prev.fiscal_year, 2025, "Q3·26 is set against Q3·25");
  assert.equal(qs[1].prev, null, "Q1·24 is not on file: no comparison, not a zero");
});

test("FINANCIALS draws the quarters as bars (green bigger than a year before, red smaller, grey unknown) and four tables from the three statement tables", () => {
  const data = { t: "MU", _finq: MUQ.concat([q("Q2", 2024, 9e9, 1, 1, 1, 1)]),
    _finhist: [{ fiscal_year: 2024, revenue: 25.1e9, gross_profit: 5.6e9, operating_income: 1.3e9, ebitda: 8.9e9, net_income: 0.8e9, eps_diluted: 0.70 },
               { fiscal_year: 2025, revenue: 37.4e9, gross_profit: 14.9e9, operating_income: 9.9e9, ebitda: 18.5e9, net_income: 8.5e9, eps_diluted: 7.59 }],
    _balhist: [{ fiscal_year: 2025, cash_and_equiv: 9.6e9, total_debt: 15.3e9, net_debt: 5.6e9, total_assets: 82.8e9, total_liabilities: 28.1e9, total_equity: 54.2e9, current_assets: 28.8e9, current_liabilities: 11.0e9, inventory: 8.4e9 }],
    _balq: { period: "Q3", fiscal_year: 2026, cash_and_equiv: 25.0e9, total_debt: 6.4e9, net_debt: -18.6e9, total_assets: 134.1e9, total_liabilities: 33.4e9, total_equity: 100.7e9, current_assets: 66.7e9, current_liabilities: 19.5e9, inventory: 8.6e9 },
    _cfhist: [{ fiscal_year: 2025, operating_cf: 17.5e9, capex: -15.9e9, free_cf: 1.7e9, dividends_paid: -0.5e9, buybacks: -0.3e9, stock_comp: 0.9e9, debt_repayment: -4e9 }] };
  const html = fin.financialsTabHTML(data);
  for (const h of ["QUARTERS · REVENUE", "FISCAL YEARS · INCOME", "BALANCE SHEET", "CASH FLOW"]) assert.ok(html.includes(h), h);
  assert.equal((html.match(/class="fn3-bar up"/g) || []).length, 5, "five quarters beat their year-before quarter");
  assert.equal((html.match(/class="fn3-bar dn"/g) || []).length, 1, "Q2·25 (8.1) against a 9.0 Q2·24: red");
  assert.equal((html.match(/class="fn3-bar"/g) || []).length, 2, "Q4·24 and Q1·25 have no year-before quarter on file: grey");
  assert.match(html, /Q3 FY26 · revenue \$41\.5B · \+346% on Q3 FY25/);
  assert.match(html, /<td>vs a year before<\/td>(<td[^>]*>[^<]*<\/td>){7}<td class="cur up">\+346%<\/td>/);
  assert.match(html, /<td>Gross margin<\/td>(<td[^>]*>[^<]*<\/td>){7}<td class="cur">84\.6%<\/td>/, "margin = the line ÷ revenue");
  assert.match(html, /<th class="cur">LATEST Q3 FY26<\/th>/, "the newest quarterly balance sheet beside the years");
  assert.match(html, /<td>Net debt \$B<\/td><td>5\.6<\/td><td class="cur dn">\(18\.6\)<\/td>/, "net cash shows in brackets");
  assert.match(html, /<td>Current ratio<\/td><td>2\.62×<\/td><td class="cur">3\.42×<\/td>/);
  assert.match(html, /<td>FCF as % of revenue<\/td><td>—<\/td><td class="cur">4\.5%<\/td>/, "cash flow keeps the income table's years so the columns line up; a year it lacks is a dash");
  assert.match(html, /<td>Revenue growth<\/td><td[^>]*>—<\/td><td class="cur up">\+49\.0%<\/td>/);
  const none = fin.financialsTabHTML({ t: "ZZ", _finq: [], _finhist: [], _balhist: [], _cfhist: [] });
  assert.match(none, /No financial statements on record for/);   // H10 — plain words, no table names
});

test("FINANCIALS reads only tables the payload already reads; the extra columns and the newest quarter are the same tables", () => {
  const f = fn("fetchCompanyData");
  assert.match(f, /fundamentals_history\?ticker=eq\." \+ e \+ "&period=in\.\(Q1,Q2,Q3,Q4\)&select=period,fiscal_year,fiscal_date,/);
  assert.match(f, /balance_history\?ticker=eq\." \+ e \+ "&period=eq\.FY&select=[^"]*total_liabilities,total_equity,current_assets,current_liabilities,inventory/);
  assert.match(f, /cashflow_history\?ticker=eq\." \+ e \+ "&period=eq\.FY&select=[^"]*stock_comp,debt_repayment/);
  assert.match(f, /balance_history\?ticker=eq\." \+ e \+ "&period=in\.\(Q1,Q2,Q3,Q4\)[^"]*&order=fiscal_date\.desc&limit=1"\)\.catch\(\(\) => \[\]\)/);
  assert.match(f, /_balq: \(balq && balq\[0\]\) \|\| null,/);
});

/* ── STATS · ESTIMATES ──────────────────────────────────────────────────────────────────────────── */
test("STATS on one screen: no sub-tabs to click (H7, 2 Oct: six blocks in one grid, the sector · industry line under them)", () => {
  const st = new Function("statsPriceHTML", "statsFundHTML", "statsBalHTML", "statsActivityHTML", "coBoardRow", "esc", "stIsFund", fn("statsTabHTML") + "\nreturn statsTabHTML;")(
    () => "P", () => "F", () => "B", () => "A", () => ({}), esc, (d) => d.t === "SPY");   /* H8 — stIsFund: a fund gets no GROWTH / BALANCE */
  assert.equal(st({ t: "MU" }), '<div class="st1">PAFB</div>', "PRICE · SIZE · VALUE, ACTIVITY & DATES, GROWTH & MARGINS, BALANCE");
  assert.equal(st({ t: "SPY" }), '<div class="st1">PA</div>', "H8 — a fund: PRICE · SIZE and ACTIVITY & DATES only");
  assert.equal(st({ t: "MU", _profile: { sector: "Technology", industry: "Semiconductors", exchange: "NASDAQ" } }),
    '<div class="st1">PAFB<div class="st-foot" title="sector · industry · exchange (company_profile, FMP)">Technology · Semiconductors · NASDAQ</div></div>');
  assert.doesNotMatch(fn("statsTabHTML"), /data-act="stattab"/);
  assert.match(page, /\.cv-side \.st1\{display:grid;grid-template-columns:repeat\(auto-fit,minmax\(210px,1fr\)\)/, "two blocks across the ~640 CSS px tab column, three when EXPANDED, one on a phone");
});

test("the median target says where it comes from: the analysts' own targets, not the comps", () => {
  const f = fn("estConvictionHTML");
  assert.match(f, /MEDIAN TARGET = the middle of the price targets published by the /);
  assert.match(f, /\(FMP price_target_consensus\)\. Not from the comps\./);
});

/* ── LOOK · TRIAL COPY ──────────────────────────────────────────────────────────────────────────── */
test("R3's new CSS is greys only (channels within 24, none above 210), text 11 px and up", () => {
  const a = page.indexOf("/* R3 — the visual ladder"), b = page.indexOf("/* PHONE — one column", a);
  assert.ok(a > 0 && b > a);
  const css = page.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, hex + " is a grey");
  }
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "font " + m[0]);
});

test("the trial copy carries <base href=\"/\"> and the grey TRIAL banner; the live page carries no banner (switched on 28 Sep)", () => {
  assert.match(trial, BASE_RE, "base href line");
  assert.match(trial, BANNER_RE, "TRIAL banner");
  const banner = trial.match(/<div id="trialBanner" style="([^"]+)"/)[1];
  for (const hex of banner.match(/#[0-9A-Fa-f]{6}\b/g)) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, "banner " + hex + " is a grey");
  }
  const live = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  assert.ok(!live.includes('id="trialBanner"'), "no trial banner on the live page");
  /* SWITCH-ON (28 Sep) — Alan approved it: "Let's switch on the company view… let's switch it on safely." The live page now
     carries the company view (SOCIAL included); the trial copy is the same page plus its <base> line and banner. */
  assert.ok(/^function socBlockHTML\b/m.test(live), "the company view (and its SOCIAL block) is on the live page after the switch-on");
});
