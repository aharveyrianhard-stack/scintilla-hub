/* D2 (27 Sep) — THE COMPANY VIEW, ROUND 2.
   Alan, 27 Sep: "there's a company view there, I don't get it… it is very hard to navigate" · "I did like the moving
   average thing that we had" · "the RSI as an oscillator pane on the chart is just easier… it has to be a Station chart."
   Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const clickCase = (name) => { const m = page.match(new RegExp('    case "' + name + '": \\{[\\s\\S]*?\\n      break;\\n    \\}\\n')); assert.ok(m, name); return m[0]; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const CO_TABS = JSON.parse(page.match(/^const CO_TABS = (\[[^\]]*\]);/m)[1]);
const CONSTS = line(/^const STATION_CHART_URL = [^\n]*/m) + line(/^const CO_RANGES = [^\n]*/m) + line(/^const CO_RANGE_KEY = [^\n]*/m) +
  line(/^const CO_CHART_RSI = [^\n]*/m) + line(/^const CO_LANDING_TAB = [^\n]*/m) + line(/^const CO_MORE_TABS = [^\n]*/m) + line(/^const CO_TAB_KEY = [^\n]*/m);

test("seven tabs in one row, keys 1-7, STATS under MORE; no CHART tab (the chart is always on screen) and no SOCIAL", () => {
  assert.deepEqual(CO_TABS, ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "FINANCIALS", "NEWS", "EVENTS", "READ"]);
  assert.match(page, /^const CO_MORE_TABS = \["STATS"\];/m);
  const S = { coTab: "GEIGER" };
  const tabs = new Function("S", "CO_TABS", CONSTS + "let CV_MORE_OPEN = false;\n" + fn("cvTabsHTML") + "\nreturn (open) => { CV_MORE_OPEN = open; return cvTabsHTML(); };")(S, CO_TABS);
  const closed = tabs(false);
  assert.deepEqual([...closed.matchAll(/data-tab="([A-Z]+)"/g)].map((m) => m[1]), [...CO_TABS, "STATS"]);
  assert.match(closed, /class="cv-tabs" id="cvTabs"/, "MORE closed: STATS is in the markup but hidden (.cv-x)");
  assert.match(closed, /data-act="cvmore" aria-expanded="false">MORE ▾/);
  assert.match(tabs(true), /class="cv-tabs is-more"/);
  S.coTab = "STATS"; assert.match(tabs(false), /class="cv-tabs is-more"/, "STATS open keeps MORE open");
  assert.match(page, /\.cv-tabs \.cv-x\{display:none\}\n\.cv-tabs\.is-more \.cv-x\{display:inline-block\}/);
});

test("the chart sits OUTSIDE the tab slot: the view is rail · (line, chart, numbers) · (tabs, slot)", () => {
  const html = new Function("esc", "coPaneModeProbe", "cvRailHTML", "cvLineHTML", "cvChartHTML", "cvNumsHTML", "cvTabsHTML", "leftBodyHTML", fn("coViewHTML") + "\nreturn coViewHTML;")(
    esc, () => {}, () => "RAIL", () => "LINE", () => '<div class="cv-chart" id="cvChart"><iframe id="coChartFrame"></iframe></div>', () => "NUMS", () => "TABS",
    () => '<div class="sc-chartpanel__slot" id="coRailContent">BODY</div>')("MU");
  const iframe = html.indexOf('id="coChartFrame"'), side = html.indexOf('class="cv-side"'), slot = html.indexOf('id="coRailContent"');
  assert.ok(iframe > 0 && iframe < side && side < slot, "frame in cv-main, before the side column that holds the slot");
  assert.ok(html.indexOf("LINE") < iframe && iframe < html.indexOf("NUMS"), "line above the chart, numbers under it");
  assert.ok(html.indexOf("RAIL") < html.indexOf("LINE"), "the rail comes first (shown only when expanded)");
  /* a tab switch rewrites the slot only; nothing in it can reach the frame */
  assert.doesNotMatch(clickCase("cotab"), /coChartFrame|cvChart/);
  assert.match(clickCase("cotab"), /lsSet\(CO_TAB_KEY, S\.coTab\)/, "the tab is remembered");
});

test("a repaint of a pinned view patches in place: the frame element is kept and its src changes only with the name or the timeframe", () => {
  const frame = { src: null, sets: 0, title: "", getAttribute() { return this.src; }, setAttribute(k, v) { this.src = v; this.sets++; } };
  const store = { "hub.chart.range": "1D" }; const env = { LEFT_T: "MU" };
  const dom = { cv: { dataset: {} }, coChartFrame: frame };
  const run = new Function("env", "el", "lsGet", "cvRepaint", "cvRailRepaint", "cvTabsHTML", "leftBodyHTML",
    CONSTS + fn("coRange") + fn("coChartSrc") + fn("cvUpdateInPlace").replace(/LEFT_T/g, "env.LEFT_T") + "\nreturn cvUpdateInPlace;")(
    env, (id) => dom[id] || null, (k) => store[k], () => {}, () => {}, () => "", () => "");
  assert.equal(run(), true);
  assert.equal(frame.src, "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=1D&clouds=1&rsi=1D");
  assert.equal(frame.sets, 1);
  run(); run();
  assert.equal(frame.sets, 1, "same name, same timeframe: the frame is not touched (no reload)");
  env.LEFT_T = "NVDA"; run();
  assert.equal(frame.sets, 2); assert.match(frame.src, /t=NVDA&range=1D/);
  store["hub.chart.range"] = "4h"; run();
  assert.equal(frame.sets, 3); assert.match(frame.src, /range=4h&clouds=1&rsi=4h$/);
  assert.match(fn("renderLeftPanel"), /const inPlace = !LEFT_HEAT && LEFT_STATE === "PINNED" && LEFT_T && cvUpdateInPlace\(\);\n  if \(!inPlace\) lp\.innerHTML = leftPanelInnerHTML\(\);/);
  assert.match(fn("loadLeft"), /else cvRepaint\(\);/, "the payload landing on GEIGER or FUNDAMENTALS repaints the numbers, never the frame");
});

test("the RSI is one line of the chart's own timeframe for all five ranges; clouds always on; the Hub pane, never bare=1", () => {
  const src = new Function(CONSTS + fn("coRange") + fn("coChartSrc") + "\nreturn coChartSrc;")();
  for (const r of ["1h", "4h", "1D", "3D", "1W"])
    assert.equal(src("mu", r, "match"), "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=" + r + "&clouds=1&rsi=" + r);
  assert.match(src("MU", "1D", true), /rsi=1$/, "the fan can still be asked for");
  assert.doesNotMatch(src("MU", "1D", false), /rsi/);
});

function numsKit(row, data, extra) {
  const today = "2026-09-27";
  const ctx = Object.assign({ S: { coData: data }, PRICES: { MU: 1085.02 }, coBoardRow: () => row, hbRowFor: () => ({ usual_day_60: 4.9 }),
    hbPct: (v) => "±" + v.toFixed(1) + "%", hbXUsual: (m, u) => (m == null || !u ? null : m / u), fmtCap: (v) => "$" + (v / 1e12).toFixed(1) + "T",
    fmtC: (c) => (c >= 0 ? "+" : "(") + Math.abs(c).toFixed(2) + "%" + (c >= 0 ? "" : ")"), fmtPxIdent: (p) => "$" + p.toFixed(2),
    geigerMiniHTML: () => "<bar>", todayISO: () => today, ernWhen: () => "after the close", ernMonthDay: (d) => "SEP " + +d.slice(8, 10),
    fwdTrailPE: (px, f, est) => ({ fwd: est && est.length ? px / 25 : null, next: { label: "NTM" }, ccy: "USD" }) }, extra || {});
  const names = Object.keys(ctx);
  return new Function(...names, "num", "esc", fn("cvQuote") + line(/^function cvLean[^\n]*/m) + line(/^function cvSgn[^\n]*/m) + fn("cvNextReport") + fn("cvNumsHTML") + "\nreturn cvNumsHTML;")(
    ...names.map((k) => ctx[k]), num, esc);
}
test("six key numbers, in order, from data the Hub already holds; MKT CAP is company_profile (today's), never fundamentals", () => {
  const data = { t: "MU", price: 1085.02, chg: 0.42, _profile: { market_cap: 1.22e12 }, _fund: { market_cap: 0.9e12 }, _est: [1],
    events: [{ date: "2026-06-25" }, { date: "2026-09-30", report_time: "AMC" }, { date: "2026-12-17" }], _pt: { target_median: 1500, num_analysts: 24 } };
  const html = numsKit({ t: "MU", g: 0.76, c: 0.42, mc: 1.0e12 }, data)("MU");
  assert.deepEqual([...html.matchAll(/<i>([A-Z /]+)<\/i>/g)].map((m) => m[1]), ["GEIGER", "TODAY", "MKT CAP", "FWD P/E", "NEXT REPORT", "TARGET MEDIAN"]);
  assert.match(html, /<i>GEIGER<\/i><b class="up">\+0\.76<\/b><span><bar> bull lean/);
  assert.match(html, /<i>TODAY<\/i><b class="up">\+0\.42%<\/b><span>0\.1× its usual ±4\.9%/);
  assert.match(html, /<i>MKT CAP<\/i><b>\$1\.2T<\/b>/, "company_profile's 1.22T, not fundamentals' 0.9T or the row's 1.0T");
  assert.match(html, /<i>FWD P\/E<\/i><b>43\.4×<\/b><span>NTM EPS estimate/);
  assert.match(html, /<i>NEXT REPORT<\/i><b>SEP 30<\/b><span>in 3 d · after the close/, "the next date on or after today");
  assert.match(html, /<i>TARGET MEDIAN<\/i><b class="up">\$1500\.00<\/b><span>\+38% vs price · 24 analysts/);
  assert.match(html, /title="company_profile\.market_cap: today&#39;s value/);
});
test("before the payload lands the tiles wait (…), a fund says so, and a name with no report on file says none", () => {
  const wait = numsKit({ t: "MU", g: null, c: null }, { t: "MU", _loading: true })("MU");
  assert.equal((wait.match(/<b>…<\/b>/g) || []).length, 4, "MKT CAP, FWD P/E, NEXT REPORT and TARGET wait");
  const spy = numsKit({ t: "SPY", g: 0.79, c: 0.54, mc: 8.2e11 }, { t: "SPY", _profile: { market_cap: 8.2e11, is_etf: true }, events: [], _pt: null })("SPY");
  assert.equal((spy.match(/<span>a fund<\/span>/g) || []).length, 3, "FWD P/E, NEXT REPORT, TARGET: a fund");
  const none = numsKit({ t: "MU", g: 0.1, c: 0.1 }, { t: "MU", _profile: {}, events: [{ date: "2026-06-25" }], _est: [], _pt: null })("MU");
  assert.match(none, /<i>NEXT REPORT<\/i><b>—<\/b><span>none on file/);
});

test("keys: Esc back to the board, ↑/↓ the next name in the board's own order, 1–7 a tab; never while typing or over another surface", () => {
  const m = page.match(/window\.addEventListener\("keydown", \(e\) => \{\n  if \(e\.altKey[\s\S]*?\n\}, true\);/);
  assert.ok(m, "one capture-phase handler");
  const h = m[0];
  assert.match(h, /LEFT_STATE !== "PINNED"/, "only while a company is open");
  assert.match(h, /if \(cvKeysBlocked\(e\)\) return;/);
  assert.match(h, /e\.key === "Escape"\) \{ e\.preventDefault\(\); S\.sec = "DASHBOARD"; updateMtabs\(\); startRotate\(\); return; \}/, "Esc = the same path as ◂ BOARD");
  assert.match(h, /cvStep\(e\.key === "ArrowDown" \? 1 : -1\)/);
  assert.match(h, /k <= CO_TABS\.length/);
  const blocked = new Function("el", "SECFS", "YT_IDX", "document", fn("cvKeysBlocked") + "\nreturn cvKeysBlocked;");
  const doc = { fullscreenElement: null, body: { classList: { contains: () => false } } };
  const none = blocked(() => null, null, -1, doc);
  assert.equal(none({ target: { tagName: "INPUT" } }), true, "typing in a field");
  assert.equal(none({ target: { tagName: "DIV" } }), false);
  assert.equal(blocked((id) => (id === "chatPop" ? { classList: { contains: (c) => c === "open" } } : null), null, -1, doc)({ target: {} }), true, "the chat panel owns Esc");
  assert.equal(blocked(() => null, {}, -1, doc)({ target: {} }), true, "a fullscreen section owns Esc");
  const step = []; const cvStep = new Function("orderedShownRows", "pinLeft", "LEFT_T", fn("cvStep") + "\nreturn cvStep;");
  const rows = () => [{ t: "AMD" }, { t: "MU" }, { t: "BE" }];
  cvStep(rows, (t) => step.push(t), "MU")(1); cvStep(rows, (t) => step.push(t), "MU")(-1);
  cvStep(rows, (t) => step.push(t), "BE")(1); cvStep(rows, (t) => step.push(t), "AMD")(-1);
  assert.deepEqual(step, ["BE", "AMD", "AMD", "BE"], "down / up, wrapping at both ends");
  assert.match(fn("pinLeft"), /S\.coTab = coSavedTab\(\);/, "a switch keeps the tab");
});

test("EXPAND: a name rail in the board's own order, chart + numbers ~60%, tabs ~40%; a rail click keeps the view", () => {
  assert.match(page, /body\.co-exp \.cv\{display:grid;grid-template-columns:156px minmax\(0,60fr\) minmax\(0,40fr\)/);
  assert.match(fn("cvRailHTML"), /const rows = orderedShownRows\(\);/);
  assert.match(clickCase("cvrail"), /if \(a\.dataset\.t && a\.dataset\.t !== LEFT_T\) pinLeft\(a\.dataset\.t\);/);
  assert.doesNotMatch(clickCase("cvrail"), /CO_EXPANDED|coExpandApply/, "switching names never collapses");
});

test("the company view's look: greys only (channels within 24, none above 210), no cyan, text 11 px and up", () => {
  const a = page.indexOf("/* ── D2 (27 Sep) · the company view, round 2."), b = page.indexOf("\n}\n", page.indexOf("@media (max-width:760px){", a));
  assert.ok(a > 0 && b > a);
  const css = page.slice(a, b).replace(/\/\*[\s\S]*?\*\//g, "");   /* rules only, not the notes */
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, bl) - Math.min(r, g, bl) <= 24 && Math.max(r, g, bl) <= 210, hex + " is a grey");
  }
  assert.doesNotMatch(css, /cyan|00D4FF|22D3EE|rgba\(0,\s*212/i);
  for (const m of css.matchAll(/font(?:-size)?:[^;}]*?(\d+(?:\.\d+)?)px/g)) assert.ok(+m[1] >= 11, "font " + m[0]);
});

test("the GEIGER tab dropped the ring, the RSI / Williams / MACD / volume tiles and the rewind; every new name is declared once", () => {
  const g = fn("geigerSummaryHTML");
  for (const gone of ["gs-meterwrap", "rsitable", "wprtable", "data-gs=\"macd\"", "data-gs=\"vol\"", "gsladtoggle", "PLAY"]) assert.ok(!g.includes(gone), gone + " gone");
  for (const n of ["coTabOk", "coSavedTab", "cvLean", "cvSgn", "cvQuote", "cvTabsHTML", "cvLineHTML", "cvNextReport", "cvNumsHTML", "cvRailHTML", "cvChartHTML",
    "coViewHTML", "cvSet", "cvRepaint", "cvRailRepaint", "cvUpdateInPlace", "cvStep", "cvKeysBlocked", "gsCloudInk", "gsLadderHTML", "gsTfTableHTML"])
    assert.equal((page.match(new RegExp("(^|[^.\\w])function " + n + "\\(", "gm")) || []).length, 1, n);
  for (const n of ["CO_MORE_TABS", "CO_TAB_KEY", "CV_MORE_OPEN", "GS_MA_ORDER", "GS_CLOUD_PAIR", "GS_CLOUD_INK", "GS_TF_ROWS"])
    assert.equal((page.match(new RegExp("(const|let|var) " + n + " ?=", "g")) || []).length, 1, n);
});

test("the Hub's fundamentals copy reads today's market cap from company_profile (fundamentals only as a fallback)", () => {
  const f = fs.readFileSync(new URL("../fundamentals/index.html", import.meta.url), "utf8");
  assert.match(f, /company_profile\?select=ticker,beta,market_cap,updated_ts/);
  assert.match(f, /cap=profCap!=null\?profCap:\(f\?f\.market_cap:null\)/);
  assert.match(f, /capProf\.forEach\(c=>\{ if\(\+c\.market_cap>0\) capByT\[c\.ticker\]=\+c\.market_cap; \}\)/);
  assert.match(f, /const cap = \(cpArr\[0\]&&\+cpArr\[0\]\.market_cap>0 \? \+cpArr\[0\]\.market_cap : f\.market_cap\)\|\|0/);
  assert.doesNotMatch(f, /cap=f\?f\.market_cap:null/);
});
