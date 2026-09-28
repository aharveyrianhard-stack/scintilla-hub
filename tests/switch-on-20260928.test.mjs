/* SWITCH-ON (28 Sep) — the company view switched on in the live Hub. Alan: "Let's switch on the company view… Just confirm
   I'm not losing anything… let's switch it on safely." One test per switch-checklist row this branch changed
   (staging/company-view-switch-20260928/SWITCH-CHECKLIST.json). Offline: functions are sliced out of the page by name and
   run with stubs; nothing leaves the process. */
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
const clickCase = (name) => { const m = page.match(new RegExp('    case "' + name + '": \\{[\\s\\S]*?\\n      break;\\n    \\}\\n')); assert.ok(m, name); return m[0]; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const head = page.slice(0, page.indexOf("</head>"));
const RANGES = ["15m", "30m", "1h", "2h", "3h", "4h", "6h", "12h", "1D", "3D", "1W"];
const CONSTS = line(/^const STATION_CHART_URL = [^\n]*/m) + line(/^const CO_RANGES = [^\n]*/m) + line(/^const CO_RANGE_KEY = [^\n]*/m) +
  line(/^const CO_CHART_RSI = [^\n]*/m) + line(/^const CO_CLOUDS_KEY = [^\n]*/m);

test("merge: the FMP reference list accepts all four universe digests (their omission once blanked the board RSI)", () => {
  const m = page.match(/const SC_FMP_REFERENCE_DIGESTS = "\(" \+ \[([\s\S]*?)\]\.join/);
  assert.ok(m);
  const got = [...m[1].matchAll(/"([0-9a-f]{64})"/g)].map((x) => x[1].slice(0, 8));
  for (const d of ["7ad595cc", "ab8f7965", "0c2abd57", "223dbb0f"]) assert.ok(got.includes(d), d);
});

/* B1 · B2 · B3 — the name ONCE, in the header title, with ✕, Prev close, usual day and "N× today", and ♥ ★ ◎ */
test("B1/B2/B3: the name is shown once — the company line carries no ticker, name, price or change; the header title keeps ✕, Prev, usual, N× today", () => {
  const cl = fn("cvLineHTML");
  assert.doesNotMatch(cl, /cv-t"|cvPx|cvChg|cv-px|cv-chg|cv-name/, "no second copy of the name on the company line");
  const id = fn("leftIdentHTML");
  assert.match(id, /data-act="headx"/, "✕ in the title");
  assert.match(id, /"Prev " \+ fmtPxIdent\(pc\)/, "Prev close kept");
  assert.match(id, /\\u00d7 today<\/b>/, "N× today kept");
  assert.match(fn("identPaint"), /coIdentLists\(h\)/, "♥ ★ ◎ beside the name in the title");
  /* the phone: the title has room for ticker, price and change only; the rest rides one phone-only line */
  assert.match(head, /\.cv-facts\{display:none\}/);
  assert.match(head, /@media \(max-width:560px\)\{\n  \.cv-facts\{display:flex/);
  const f = fn("cvFactsHTML");
  for (const k of ["cv-name", "Prev ", "usual ", "× today", "listCtlHTML(t)"]) assert.ok(f.includes(k), k);
  assert.match(fn("cvRepaint"), /cvSet\("cvFacts", cvFactsHTML\(LEFT_T\)\);/, "the facts follow the price");
  assert.match(fn("coListsRepaint"), /cvSet\("cvFacts", cvFactsHTML\(LEFT_T\)\)/, "the phone's ♥ ★ ◎ follow a toggle");
});

function lineKit(store) {
  return new Function("esc", "lsGet", "cohortChipHTML", "coExpandBtnHTML",
    CONSTS + fn("coRange") + fn("coCloudsOn") + fn("cvLineHTML") + "\nreturn cvLineHTML;")(
    esc, (k) => (k in store ? store[k] : null), (t) => '<span class="sc-cohwrap" data-t="' + t + '"><span class="sc-it" id="cohChip" aria-haspopup="true">COHORT ▾</span></span>', () => '<button data-act="coexpand">EXPAND</button>');
}
/* C5 · A8 · H4 · C6 · D3 — the controls line */
test("C5/A8/H4: COHORT ▾ is on the company line (the only place to set a cohort; COHORT ALLOC relies on it) and saves through operatorWrite cohort_set", () => {
  const html = lineKit({})("MU");
  assert.match(html, /class="sc-cohwrap" data-t="MU"/);
  assert.match(fn("cvLineHTML"), /cohortChipHTML\(t\)/);
  /* the controller is document-level and scoped to the clicked chip, so it works wherever the chip is drawn */
  assert.match(page, /var chip=e\.target\.closest && e\.target\.closest\("\.sc-cohwrap \[aria-haspopup\], #cohChip"\);/);
  assert.match(page, /operatorWrite\(\{action:"cohort_set", ticker:t, cohort:nv, is_primary:true\}\)/);
  assert.match(page, /tap a row → set its COHORT on the company page/, "the logo menu's COHORT ALLOC still points here");
  /* the line no longer changes on a price tick, so an open menu is not closed by one */
  assert.doesNotMatch(fn("cvLineHTML"), /cvQuote|PRICES|hbRowFor/);
});

test("C6: ⛶ fullscreen is on the company line and uses the one section-fullscreen mechanism (Esc closes it; the view's keys stand aside)", () => {
  const html = lineKit({})("MU");
  assert.match(html, /data-act="secfs">⛶<\/button>/);
  assert.match(clickCase("secfs").replace(/\n\s*S\.sec[^\n]*/, ""), /toggleSecFs\(a\.closest\("[^"]*\.sc-chartpanel/, "climbs to the company panel (#leftPanel is .sc-chartpanel)");
  assert.match(page, /id="leftPanel"/);
  assert.match(fn("cvKeysBlocked"), /SECFS/, "while fullscreen, Esc closes the fullscreen first");
});

test("D3/D2: the Station chart's eleven timeframes and the CLOUDS switch are reachable from the Hub, both remembered", () => {
  const html = lineKit({ "hub.chart.range": "2h" })("MU");
  assert.deepEqual([...html.matchAll(/data-act="corange" data-r="([^"]+)"/g)].map((m) => m[1]), RANGES);
  assert.match(html, /class="sc-cofr__tf on" aria-pressed="true" data-act="corange" data-r="2h"/);
  assert.match(html, /cv-clouds on" aria-pressed="true" data-act="coclouds"/, "clouds on by default");
  assert.match(lineKit({ "hub.chart.clouds": "0" })("MU"), /cv-clouds" aria-pressed="false" data-act="coclouds"/);
  const src = (store) => new Function("lsGet", CONSTS + fn("coRange") + fn("coCloudsOn") + fn("coChartSrc") + "\nreturn coChartSrc;")((k) => store[k]);
  assert.equal(src({})("mu", "15m", true), "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=15m&clouds=1&rsi=1");
  assert.equal(src({ "hub.chart.clouds": "0" })("MU", "12h", true), "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=12h&clouds=0&rsi=1");
  /* the last-bar stamp knows every timeframe's chart-API token */
  const STAMP = new Function(line(/^const CO_STAMP_TF = [^\n]*/m) + "return CO_STAMP_TF;")();
  assert.deepEqual(Object.keys(STAMP), RANGES);
  /* a timeframe click lights only timeframes; the CLOUDS switch writes only its memory and the frame's src */
  assert.match(clickCase("corange"), /querySelectorAll\("\.sc-cofr__tf\[data-r\]"\)/);
  const frame = { src: "" }, saved = {}, btns = [];
  const store = { "hub.chart.range": "1D" };
  new Function("a", "e", "el", "lsSet", "lsGet", "document", "LEFT_T",
    CONSTS + fn("coRange") + fn("coCloudsOn") + fn("coChartSrc") + "\nswitch (\"coclouds\") {\n" + clickCase("coclouds") + "}")(
    {}, { preventDefault() {}, stopPropagation() {} }, (id) => (id === "coChartFrame" ? frame : null), (k, v) => { saved[k] = v; store[k] = v; }, (k) => store[k],
    { querySelectorAll: () => btns }, "MU");
  assert.deepEqual(saved, { "hub.chart.clouds": "0" });
  assert.equal(frame.src, "https://station.scintillahub.ai/chart/?bare=hub&t=MU&range=1D&clouds=0&rsi=1");
});

/* F3 — STATS market cap date */
test("F3: STATS shows the market cap's 'as of' date again (R3 had hidden it)", () => {
  assert.doesNotMatch(head, /\.cv-side \.st1 \.sc-asof\{display:none\}/);
  assert.match(head, /\.cv-side \.st1 \.sc-asof\{display:block/);
  assert.match(page, /"as of " \+ a\.date/, "the date is still written by the market-cap row");
});

/* E5 — Williams %R */
test("E5: the Williams %R tile stays dropped (Alan's list), and its daily value is still readable in the GEIGER tab", () => {
  assert.match(fn("geigerSummaryHTML"), /data-gs="wpr"/);
  assert.match(fn("buildGeigerSummary"), /WP\.innerHTML = wprReadoutHTML\(d\)/);
  const wpr = new Function("num", "gsUnavailHTML", fn("wprReadoutHTML") + "\nreturn wprReadoutHTML;")(num, () => "unavailable");
  assert.match(wpr({ wprMtf: [["1D", -12.34]] }), /WILLIAMS %R \(14\) · DAILY<\/span><b class="g2-oscv">−12\.3<\/b>.*top of its 14-day range/);
  assert.match(wpr({ wprMtf: [["1D", -91]] }), /bottom of its 14-day range/);
  assert.match(wpr({ wprMtf: [["1D", -50]] }), /mid-range/);
  assert.match(wpr({ wprMtf: [], unavail: { wpr: {} } }), /unavailable/);
  assert.equal(wpr({ _seed: true }), "", "blank while the tab seeds from the board");
  assert.doesNotMatch(fn("geigerSummaryHTML"), /wprtable|gs-meterwrap/, "no Williams tile, no ring");
});

/* F9 — the empty AI READ placeholder */
test("F9: the company EVENTS tab has no 'AI READ · coming' placeholder on any path", () => {
  const f = fn("coEventsHTML");
  assert.doesNotMatch(f.replace(/const aiMini = [^\n]*\n/, "").replace(/void aiMini;/, ""), /aiMini/);
});

/* SECTORS — OUR NAMES */
test("SECTORS: MEMBERS reads 'OUR NAMES' with a count per column, the SPDR funds are the default, and the choice (OUR NAMES too) is remembered", () => {
  const fam = page.match(/window\.SECT_FAMILIES=\[([\s\S]*?)\]\];/)[1];
  const rows = [...fam.matchAll(/\["([A-Z]+)","([^"]+)"/g)].map((m) => [m[1], m[2]]);
  assert.deepEqual(rows.map((r) => r[0]), ["SPDR", "ISHARES", "VANGUARD", "EQWT", "MEMBERS"]);
  assert.deepEqual(rows.find((r) => r[0] === "MEMBERS"), ["MEMBERS", "OUR NAMES"]);
  assert.doesNotMatch(fam, /SPDR ticker labels the column/);
  assert.match(page, /window\.SECT_FAMILY="SPDR";/);
  assert.match(page, /if\(sf && \(SECT_FAMILY_FUNDS\[sf\] \|\| sf==="MEMBERS"\)\) window\.SECT_FAMILY=sf;/, "a stored OUR NAMES is honoured");
  assert.match(page, /localStorage\.setItem\("hub\.sector\.family", window\.SECT_FAMILY\)/);
  /* the OUR NAMES column never wears a fund ticker: the sector's name, and how many names it averages */
  assert.match(page, /return \{key:etf, label:name, short:name, names:vals\.length,/);
  const strip = fn("cohortCompareStripHTML");
  assert.match(strip, /r\.names \? r\.names \+ " names" : "fund only"/);
  assert.match(strip, /readTag \+ tmTag \+ nTag \+/);
  assert.match(strip, /OUR NAMES in each sector, averaged \(not the funds\)/);
});

/* C4 — AUTO / 10s: the rotation it drove was retired on 25 Sep (R41); ◂ BOARD, Esc and ✕ do its one remaining job */
test("C4/B4: ◂ BOARD, Esc and the title's ✕ all go back to the board overview", () => {
  assert.match(fn("cvLineHTML"), /data-act="unpin"[^>]*>◂ BOARD/);
  assert.match(page, /if \(e\.key === "Escape"\) \{ e\.preventDefault\(\); S\.sec = "DASHBOARD"; updateMtabs\(\); startRotate\(\); return; \}/);
  assert.match(clickCase("headx").replace(/\n\s*\/\*[\s\S]*$/, ""), /identPaint\(\)/);
});
