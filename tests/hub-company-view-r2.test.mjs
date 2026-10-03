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
  line(/^const CO_CHART_RSI = [^\n]*/m) + line(/^const CO_LANDING_TAB = [^\n]*/m) + line(/^const CO_TAB_KEY = [^\n]*/m) +
  line(/^const CO_CLOUDS_KEY = [^\n]*/m) + line(/^const CO_TAB_LABEL = [^\n]*/m) + line(/^const coTabLabel = [^\n]*/m) + fn("coCloudsOn").replace("lsGet(", '(typeof lsGet === "function" ? lsGet : () => null)(');   /* SWITCH-ON */

/* R3 (27 Sep) replaced D2's "seven tabs + MORE (STATS)": Alan, "use what exists: all the tabs". */
test("R3: every tab in one row (ten since C2, 30 Sep: COMPS beside ESTIMATES), keys 1-9 and 0, no MORE; SOCIAL and STATS are in the row; no CHART tab (the chart is always on screen)", () => {
  assert.deepEqual(CO_TABS, ["GEIGER", "FUNDAMENTALS", "ESTIMATES", "COMPS", "FINANCIALS", "STATS", "NEWS", "SOCIAL", "EVENTS", "READ"]);
  assert.doesNotMatch(page, /CO_MORE_TABS|CV_MORE_OPEN|data-act="cvmore"|\.cv-x\{|cv-moreb/, "MORE is gone, with its CSS and its click");
  const S = { coTab: "STATS" };
  const tabs = new Function("S", "CO_TABS", CONSTS + fn("cvTabsHTML") + "\nreturn cvTabsHTML;")(S, CO_TABS)();
  assert.deepEqual([...tabs.matchAll(/data-tab="([A-Z]+)"/g)].map((m) => m[1]), CO_TABS);
  assert.deepEqual([...tabs.matchAll(/title="key (\d)"/g)].map((m) => +m[1]), [1, 2, 3, 4, 5, 6, 7, 8, 9, 0]);
  assert.match(tabs, /class="cv-tab sc-tab on" aria-selected="true" data-act="cotab" data-tab="STATS"/);   /* V1 (3 Oct): the company tabs carry the sheet's .sc-tab */
  /* N6 (28 Sep) — the EVENTS tab reads EARNINGS like the master tab; its key (data-tab) stays EVENTS */
  assert.match(tabs, /data-tab="EVENTS" title="key 9">EARNINGS<\/button>/);
  assert.doesNotMatch(tabs, />EVENTS<\/button>/);
  assert.match(page, /const k = \/\^\[1-9\]\$\/\.test\(e\.key\) \? \+e\.key : e\.key === "0" \? 10 : 0;[^\n]*\n  if \(k && k <= CO_TABS\.length\)/, "keys 1-9 reach the first nine, 0 the tenth (C2)");
});

test("the chart sits OUTSIDE the tab slot: the view is rail · (line, chart, numbers) · (tabs, slot)", () => {
  const html = new Function("esc", "coPaneModeProbe", "cvRailHTML", "cvLineHTML", "cvChartHTML", "cvTabsHTML", "leftBodyHTML", "cvFactsHTML", fn("coViewHTML") + "\nreturn coViewHTML;")(
    esc, () => {}, () => "RAIL", () => "LINE", () => '<div class="cv-chart" id="cvChart"><iframe id="coChartFrame"></iframe></div>', () => "TABS",
    () => '<div class="sc-chartpanel__slot" id="coRailContent">BODY</div>', () => "FACTS")("MU");
  const iframe = html.indexOf('id="coChartFrame"'), side = html.indexOf('class="cv-side"'), slot = html.indexOf('id="coRailContent"');
  assert.ok(iframe > 0 && iframe < side && side < slot, "frame in cv-main, before the side column that holds the slot");
  assert.ok(html.indexOf("LINE") < iframe, "the line above the chart");
  assert.doesNotMatch(html, /cv-nums|NUMS/, "R3 — no key-numbers row under the chart");
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
    "const scChartFirstHold = () => { env.holds = (env.holds || 0) + 1; };   /* H2 — counted: the chart first, only when it moves */\n" +
    CONSTS + fn("coRange") + fn("coChartSrc") + fn("cvUpdateInPlace").replace(/LEFT_T/g, "env.LEFT_T") + "\nreturn cvUpdateInPlace;")(
    env, (id) => dom[id] || null, (k) => store[k], () => {}, () => {}, () => "", () => "");
  assert.equal(run(), true);
  assert.equal(frame.src, "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=1D&clouds=1&rsi=1&bubble=30m%3A3");
  assert.equal(frame.sets, 1);
  run(); run();
  assert.equal(frame.sets, 1, "same name, same timeframe: the frame is not touched (no reload)");
  env.LEFT_T = "NVDA"; run();
  assert.equal(frame.sets, 2); assert.match(frame.src, /t=NVDA&range=1D/);
  assert.equal(env.holds, 2, "H2 — the sparkline reads step aside each time the frame moves, and only then");
  store["hub.chart.range"] = "4h"; run();
  assert.equal(frame.sets, 3); assert.match(frame.src, /range=4h&clouds=1&rsi=1&bubble=1d%3A60$/);
  assert.match(fn("renderLeftPanel"), /const inPlace = !LEFT_HEAT && LEFT_STATE === "PINNED" && LEFT_T && cvUpdateInPlace\(\);\n  if \(!inPlace\) lp\.innerHTML = leftPanelInnerHTML\(\);/);
  assert.match(fn("loadLeft"), /else cvRepaint\(\);/, "the payload landing on GEIGER or FUNDAMENTALS repaints the line, never the frame");
});

/* R3 — Alan, 27 Sep: "the Lab's MULTI-TIMEFRAME RSI FAN (six RSI lines — the Station already draws it with ?rsi=1) …
   that should happen immediately. Not a single RSI line." */
test("R3: the chart asks the Station for the Lab's six-line RSI fan (rsi=1) at every timeframe; clouds always on; the Hub pane, never bare=1", () => {
  assert.match(page, /^const CO_CHART_RSI = true;/m);
  const src = new Function(CONSTS + fn("coRange") + fn("coChartSrc") + "\nreturn coChartSrc;")();
  for (const [r, lens] of Object.entries({"1h": "1d%3A60", "4h": "1d%3A60", "1D": "30m%3A3", "3D": "4h%3A12", "1W": "1d%3A20"}))   /* H3 — five timeframes, each with the Station's own context lens */
    assert.equal(src("mu", r, true), "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=" + r + "&clouds=1&rsi=1&bubble=" + lens);
  assert.match(src("MU", "4h", "match"), /rsi=4h&bubble=1d%3A60$/, "one line of the chart's own timeframe can still be asked for");
  assert.doesNotMatch(src("MU", "1D", false), /rsi/);
  assert.match(fn("cvChartHTML"), /coChartSrc\(t, lsGet\(CO_RANGE_KEY\), CO_CHART_RSI\)/, "the view's frame uses the setting");
});

/* R3 — Alan, 27 Sep: "who decides the key? you? I'm not ready for that." */
test("R3: the six key numbers are gone — no tiles, no builder, no CSS; the line and the rail still repaint in place", () => {
  assert.doesNotMatch(page, /function cvNumsHTML|function cvNextReport|id="cvNums"|\.cv-nums\{|\.cv-n\{/);
  assert.match(fn("cvRepaint"), /cvSet\("cvLine", cvLineHTML\(LEFT_T\)\);/);
  assert.doesNotMatch(fn("cvRepaint"), /cvNums/);
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
  /* R4 — with the list on screen (EXPAND) the keys follow the list's own sort (cvRailRows); collapsed, the board's order */
  const docC = { body: { classList: { contains: () => false } } };
  const step = []; const cvStep = (rows, pin, T) => new Function("orderedShownRows", "cvRailRows", "pinLeft", "LEFT_T", "document", fn("cvStep") + "\nreturn cvStep;")(rows, () => [], pin, T, docC);
  const rows = () => [{ t: "AMD" }, { t: "MU" }, { t: "BE" }];
  cvStep(rows, (t) => step.push(t), "MU")(1); cvStep(rows, (t) => step.push(t), "MU")(-1);
  cvStep(rows, (t) => step.push(t), "BE")(1); cvStep(rows, (t) => step.push(t), "AMD")(-1);
  assert.deepEqual(step, ["BE", "AMD", "AMD", "BE"], "down / up, wrapping at both ends");
  assert.match(fn("pinLeft"), /S\.coTab = coSavedTab\(\);/, "a switch keeps the tab");
});

test("EXPAND: a name rail in the board's own order, the chart half, the tabs half (R3: the tabs get the numbers' room); a rail click keeps the view", () => {
  assert.match(page, /body\.co-exp \.cv\{display:grid;grid-template-columns:156px minmax\(0,50fr\) minmax\(0,50fr\)/);
  assert.match(fn("cvRailFreeze"), /cvRailOrder\(orderedShownRows\(\), cvRailSort\(\)\)/, "R4: the board's rows, in the list's own sort (DAY % or GEIGER)");
  assert.match(fn("cvRailRows"), /return cvRailFreeze\(\);[\s\S]*cvRailHeld\(orderedShownRows\(\), CV_RAIL_FROZEN\)/, "R4 review fix: sorted once, then held");
  assert.match(fn("cvRailHTML"), /const by = cvRailSort\(\), rows = cvRailRows\(\);/);
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
  for (const n of ["coTabOk", "coSavedTab", "cvLean", "cvSgn", "cvQuote", "cvTabsHTML", "cvLineHTML", "cvRailHTML", "cvChartHTML",
    "coViewHTML", "cvSet", "cvRepaint", "cvRailRepaint", "cvUpdateInPlace", "cvStep", "cvKeysBlocked", "gsCloudInk", "gsLadderHTML", "gsTfTableHTML"])
    assert.equal((page.match(new RegExp("(^|[^.\\w])function " + n + "\\(", "gm")) || []).length, 1, n);
  for (const n of ["CO_TAB_KEY", "GS_MA_ORDER", "GS_CLOUD_PAIR", "GS_CLOUD_INK", "GS_TF_ROWS"])
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
