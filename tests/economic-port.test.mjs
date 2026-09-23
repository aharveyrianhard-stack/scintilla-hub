/* economic-port lane (2026-09-18) - the ported ECONOMIC room (3d69248's releases calendar + production's rail) and the
   WHAT'S COMING tape behind ECON_TAPE_ON. Everything is VM-extracted from ../index.html the way the repo's own tests do;
   pg / el / S are stubs, so nothing here reaches a network, a store or a browser. All rows below are EXAMPLE fixtures. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const START = "/* ---- Room 9 · ECONOMIC", END = "/* ---- Room 3 · COMPANY";
const mod = page.slice(page.indexOf(START), page.indexOf(END));
function fnSrc(src, name) {
  const at = src.indexOf("function " + name + "(");
  assert.notEqual(at, -1, name + " must stay statically extractable");
  return src.slice(at, src.indexOf("\n}\n", at) + 3);
}
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const GOLDEN_IDENT = fs.readFileSync(new URL("./fixtures/leftIdentHTML.2dbeb4c.js", import.meta.url), "utf8");
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
const plain = (x) => JSON.parse(JSON.stringify(x));   // VM-realm arrays/objects -> this realm, for deepEqual

const EXPORTS = ["ecInRegion", "ecCountryFilter", "ecCat", "ecBase", "ecPeriod", "ecFam", "ecShort", "ecNormalize", "ecNum", "ecFin",
  "ecImpCls", "ecDateKey", "ecTimeET", "ecShift", "ecMonthDays", "ecDaysInView", "ecCanCount", "ecRowHTML", "ecDayRowsHTML",
  "ecMonthHTML", "ecNewestActual", "ecReadNote", "ecFetchWindow", "ecLoadWindow", "renderEconTable", "econRoomHTML", "fillEcon",
  "fillEconRail", "macroNextHTML", "fillMacroNext", "ecCountdown", "leftIdentHTML", "EC_CAT_NAMES", "EC_TAPE_ITEMS", "EC_TAPE_DAYS"];
function load({ tapeOn = false, S = {}, pg = async () => [], nodes = null } = {}) {
  const store = {};
  const el = nodes === "auto"
    ? (id) => store[id] || (store[id] = { id, innerHTML: "", textContent: "", className: "" })
    : (id) => (nodes && nodes[id]) || null;
  const ctx = vm.createContext({
    console, setTimeout,
    S: { sec: "DASHBOARD", state: "live", econCty: "US", econCat: "ALL", econDay: null, econSpan: "WEEK", econOpen: {}, econImp: "ALL", ...S },
    pg, el, go: () => {}, SECFS_BTN: '<button class="sc-fsico" data-act="secfs">x</button>',
    prevClose: { MU: 100 }, fmtPxIdent: (v) => "$" + v, fmtC: (v) => (v >= 0 ? "+" : "") + v + "%",
    document: { querySelectorAll: () => [] },
  });
  let src = escSrc + numSrc + mod + fnSrc(page, "leftIdentHTML");
  /* ECON TAPE 22 Sep - the page now ships the flag ON, so the harness sets it BOTH ways: `tapeOn: false` is the
     kill-switch proof (flag off must emit production's ident markup byte for byte and read nothing). */
  assert.equal(src.split(/const ECON_TAPE_ON = (?:true|false);/).length, 2, "exactly one flag");
  src = src.replace(/const ECON_TAPE_ON = (?:true|false);/, "const ECON_TAPE_ON = " + (tapeOn ? "true" : "false") + ";");
  const api = vm.runInContext(src + "\n;({" + EXPORTS.join(",") +
    ", get ECON_CAL() { return ECON_CAL; }, get ECON_WIN() { return ECON_WIN; }, get ECON_WIN_AT() { return ECON_WIN_AT; }," +
    " get ECON_TAPE_ON() { return ECON_TAPE_ON; }, get MACRO_NEXT() { return MACRO_NEXT; }, set MACRO_NEXT(v) { MACRO_NEXT = v; } })", ctx);
  return { api, ctx, store };
}
const IDENT_INPUTS = [
  [{ t: "MU", name: "Micron", price: 101.5, chg: 1.2 }, "live"],
  [{ t: "NBIS", name: "<img src=x onerror=alert(1)>", price: null, chg: -0.4 }, "offline"],
  [{ t: "", name: "", price: 7, chg: null }, "live"],
];

test("the tape ships ON — and with its one flag off the ident bar is byte-identical to production 2dbeb4c", () => {
  assert.equal((page.match(/const ECON_TAPE_ON = /g) || []).length, 1, "exactly one flag");
  assert.match(page, /const ECON_TAPE_ON = true;/, "22 Sep: the nudge is on");
  const { api, ctx } = load();
  assert.equal(api.ECON_TAPE_ON, false, "…and the rollback is that one word");
  const golden = vm.runInContext(GOLDEN_IDENT.replace("function leftIdentHTML(", "function goldenIdent(") + "\n;goldenIdent", ctx);
  for (const sec of ["DASHBOARD", "COMPANY"]) for (const [data, state] of IDENT_INPUTS) {
    ctx.S.sec = sec; ctx.S.state = state;
    const got = api.leftIdentHTML(data);
    assert.equal(got, golden(data), "flag off must emit production's exact markup (" + sec + ", " + state + ")");
    assert.doesNotMatch(got, /macroNext|sc-cident--nudge/);
  }
  assert.match(page, /\n    if \(ECON_TAPE_ON\) fillMacroNext\(\);/, "the dashboard mount only calls the tape behind the flag");
  assert.equal(page.split("fillMacroNext();").length - 1, 1, "one call site, the guarded one - nothing else invokes the tape");
});

test("fillMacroNext never reads while the flag is off, even if a #macroNext node exists", async () => {
  let n = 0;
  const { api } = load({ pg: async () => { n++; return []; }, nodes: { macroNext: { innerHTML: "" } } });
  await api.fillMacroNext();
  assert.equal(n, 0);
});

test("flag ON: three items inside the ident box, escaped, passed ones drop off, the queue rides with a pinned ticker too", () => {
  const { api, ctx } = load({ tapeOn: true });
  const now = ts("2030-01-07T12:00:00Z");
  api.MACRO_NEXT = [
    { event_ts: ts("2030-01-07T11:00:00Z"), country: "US", event: "EXAMPLE Passed Release", impact: "High" },
    { event_ts: ts("2030-01-07T13:30:00Z"), country: "US", event: "EXAMPLE CPI <b>x</b> (Dec)", impact: "High" },
    { event_ts: ts("2030-01-08T15:00:00Z"), country: "US", event: "EXAMPLE ISM Services PMI", impact: "High" },
    { event_ts: ts("2030-01-09T19:00:00Z"), country: "US", event: "EXAMPLE FOMC Minutes", impact: "High" },
    { event_ts: ts("2030-01-10T13:30:00Z"), country: "US", event: "EXAMPLE Jobless Claims", impact: "High" },
  ];
  const html = api.macroNextHTML(now);
  assert.equal((html.match(/class="mn-it s-/g) || []).length, 3, "three items (proposal v2)");
  assert.doesNotMatch(html, /Passed Release/, "an hour past its minute with no number, it has dropped off");
  assert.doesNotMatch(html, /<b>x<\/b>/, "names are escaped");
  assert.match(html, /EXAMPLE CPI &lt;b&gt;x&lt;\/b&gt;<\/span>/, "the period tag is dropped, the name kept and escaped");
  assert.match(html, /data-act="mngoto" data-day="2030-01-07"/);
  assert.match(html, /<span class="mn-cd">in 1h 30m<\/span>/);
  assert.match(html, /<span class="mn-when">08:30<\/span>/, "ET wall time; today needs no weekday");
  assert.match(html, /<span class="mn-when">Tue 10:00<\/span>/, "another day carries its weekday");
  api.MACRO_NEXT = [];
  assert.equal(api.macroNextHTML(now), "", "a quiet week shows nothing at all — silence is information");
  for (const sec of ["DASHBOARD", "COMPANY"]) {     // COMPANY is the same dashboard mount with a ticker pinned
    ctx.S.sec = sec;
    const on = api.leftIdentHTML({ t: "MU", name: "Micron", price: 1, chg: 1 });
    assert.match(on, /^<div class="sc-cident sc-cident--nudge">/, sec);
    assert.match(on, /<span class="sc-macronext" id="macroNext">.*<\/span><\/div>$/, sec);
  }
  ctx.S.sec = "NEWS";
  assert.doesNotMatch(api.leftIdentHTML({ t: "MU", name: "Micron", price: 1, chg: 1 }), /macroNext/, "no other room grows a queue");
  assert.equal(api.ecCountdown(ts("2030-01-09T12:00:00Z"), now), "in 2d");
  assert.equal(api.ecCountdown(now - 5, now), "now");
});

test("flag ON: ONE read, the room's own window read scoped to US, then a 10-minute cache", async () => {
  const paths = [];
  const rows = [
    { event_ts: ts("2030-01-07T13:30:00Z"), country: "US", event: "Fed Chair Powell Speech", impact: "Medium" },
    { event_ts: ts("2030-01-07T15:00:00Z"), country: "US", event: "Existing Home Sales", impact: "Medium" },
    { event_ts: ts("2030-01-07T15:30:00Z"), country: "US", event: "EIA Crude Oil Stocks Change (Jan/04)", impact: "Medium" },
    { event_ts: ts("2030-01-07T18:00:00Z"), country: "US", event: "M2 Money Supply MoM (Nov)", impact: "Low" },
    { event_ts: ts("2030-01-08T13:30:00Z"), country: "US", event: "Inflation Rate YoY (Dec)", impact: "High" },
  ];
  const box = { innerHTML: "" };
  const { api } = load({ tapeOn: true, pg: async (p, tries) => { paths.push([p, tries]); return rows.map((r) => ({ ...r })); }, nodes: { macroNext: box } });
  const now = Math.floor(Date.now() / 1000);
  await api.fillMacroNext();
  assert.equal(paths.length, 1);
  const [p] = paths[0];
  assert.match(p, /^econ_calendar\?select=event_ts,country,event,actual,estimate,previous,impact&country=eq\.US&event_ts=gte\.(\d+)&event_ts=lte\.(\d+)&order=event_ts\.asc,country\.asc,event\.asc&limit=1000$/,
    "the ECONOMIC room's own window read, asked for US");
  const [, from, to] = p.match(/gte\.(\d+)&event_ts=lte\.(\d+)/);
  assert.ok(+from <= now - 3 * 3600, "back far enough to still carry this morning's results");
  assert.ok(+to >= now + 8 * 86400, "forward past the nudge's seven days");
  assert.deepEqual(plain(api.MACRO_NEXT.map((r) => [r.event, r.impact])),
    [["Fed Chair Powell Speech", "High"], ["Existing Home Sales", "Medium"], ["M2 Money Supply MoM (Nov)", "Low"], ["Inflation Rate YoY (Dec)", "High"]],
    "High + Medium + M2 by name; the office row is High with the supplier's own name kept; oil inventories are not news");
  await api.fillMacroNext();
  assert.equal(paths.length, 1, "no second read inside the TTL");
});

test("regions nest (US in G7 in G20 in ALL), EM is its own bloc, and the fetch asks only for the region on screen", () => {
  const { api, ctx } = load();
  assert.equal(api.ecInRegion("US", "G7"), true); assert.equal(api.ecInRegion("DE", "G7"), true);
  assert.equal(api.ecInRegion("TR", "G7"), false); assert.equal(api.ecInRegion("TR", "G20"), true);
  assert.equal(api.ecInRegion("IL", "G20"), false); assert.equal(api.ecInRegion("IL", "EM"), true);
  assert.equal(api.ecInRegion("NZ", "ALL"), true); assert.equal(api.ecInRegion("US", "nonsense"), false);
  ctx.S.econCty = "US"; assert.equal(api.ecCountryFilter(), "&country=eq.US");
  ctx.S.econCty = "ALL"; assert.equal(api.ecCountryFilter(), "");
  ctx.S.econCty = "G7"; assert.equal(api.ecCountryFilter(), "&country=in.(US,CA,JP,UK,GB,DE,FR,IT,EU)");
  assert.equal(api.ecCanCount("US", "G20"), true); assert.equal(api.ecCanCount("EM", "US"), false, "a zero that only means 'not fetched' is never shown");
});

test("taxonomy: first match wins, OTHER is a leak detector, and the chair is an office", () => {
  const { api } = load();
  const cases = {
    "EIA Crude Oil Stocks Change": "ENERGY", "10-Year Note Auction": "AUCTIONS", "CFTC S&P 500 speculative net positions": "POSITIONING",
    "Fed Interest Rate Decision": "CENTRAL BANK", "MBA Mortgage Applications": "HOUSING", "House Price Index MoM": "HOUSING",
    "Non Farm Payrolls": "LABOR", "Core Inflation Rate YoY (Aug)": "INFLATION", "Import Prices MoM": "INFLATION",
    "Balance of Trade": "TRADE", "Michigan Consumer Sentiment": "GROWTH", "EXAMPLE Unclassifiable Thing": "OTHER",
  };
  for (const [ev, cat] of Object.entries(cases)) assert.equal(api.ecCat(ev), cat, ev);
  assert.deepEqual(plain(api.EC_CAT_NAMES), ["ALL", "ENERGY", "AUCTIONS", "POSITIONING", "CENTRAL BANK", "HOUSING", "LABOR", "INFLATION", "TRADE", "GROWTH", "OTHER"]);
  assert.equal(api.ecBase("Core CPI (Jul)"), "Core CPI"); assert.equal(api.ecPeriod("GDP Growth Rate QoQ (Q2)"), "Q2");
  // release closure: the office only where the supplier names it; names are kept; no person is promoted to the office
  const a = api.ecNormalize({ event: "Fed Chair Powell Speech", impact: "Medium" });
  assert.equal(a.event, "Fed Chair Powell Speech"); assert.equal(a.impact, "High");
  const b = api.ecNormalize({ event: "Fed Powell Speech", impact: "Low" });
  assert.equal(b.event, "Fed Powell Speech"); assert.equal(b.impact, "Low");
  const c = api.ecNormalize({ event: "Fed Waller Speech", impact: "Medium" });
  assert.equal(c.event, "Fed Waller Speech"); assert.equal(c.impact, "Medium", "other speakers keep the feed's grade");
  assert.equal(api.ecShort("Michigan Consumer Sentiment"), "Michigan Sentiment");
});

test("a release row: every data string escaped, surprise coloured by meaning, a non-number reads as a dash", () => {
  const { api } = load();
  const evil = api.ecRowHTML({ event_ts: ts("2026-09-22T12:30:00Z"), country: '"><script>x</script>', event: "<img src=x onerror=alert(1)> (Aug)",
    actual: "abc", estimate: 1, previous: null, impact: '"><b>' }, "", true);
  assert.doesNotMatch(evil, /<script|<img|<b>/);
  assert.match(evil, /&lt;img src=x onerror=alert\(1\)&gt;/);
  assert.match(evil, /<span class="v act na">—<\/span>/, "a stored non-number is not printed as NaN");
  assert.doesNotMatch(evil, /NaN/);
  assert.match(evil, /<span class="v">08:30<\/span>/, "times are New York wall time");
  const row = (event, actual, estimate) => api.ecRowHTML({ event_ts: ts("2026-09-22T12:30:00Z"), country: "US", event, actual, estimate, previous: 1, impact: "High" }, "", false);
  assert.match(row("Inflation Rate YoY (Aug)", 3.5, 3.4), /<span class="v up">\+0\.1<\/span>/, "hotter inflation = worse = --sv5");
  assert.match(row("Non Farm Payrolls", 200, 150), /<span class="v dn">\+50<\/span>/, "stronger payrolls = better = --sv1");
  assert.match(row("Unemployment Rate", 4.1, 4.3), /<span class="v dn">−0\.2<\/span>/, "lower unemployment = better");
  assert.match(row("Retail Sales MoM", 0.5, 0.5), /<span class="v flat">0<\/span>/, "in line = --sv3");
  assert.equal(api.ecNum(1177000), "1,177,000"); assert.equal(api.ecNum("1.1770"), "1.177"); assert.equal(api.ecNum(""), null);
  assert.equal(api.ecImpCls('x" onmouseover="y'), "low"); assert.equal(api.ecImpCls("High"), "high");
});

test("a composite release collapses to one headline row and opens inline", () => {
  const { api, ctx } = load();
  const at = ts("2026-09-22T12:30:00Z");
  const rows = ["Inflation Rate YoY (Aug)", "Core Inflation Rate YoY (Aug)", "CPI (Aug)", "Inflation Rate MoM (Aug)"].map((event) =>
    ({ event_ts: at, country: "US", event, actual: 1, estimate: 1, previous: 1, impact: "High" }))
    .concat([{ event_ts: at, country: "US", event: "Initial Jobless Claims", actual: 1, estimate: 1, previous: 1, impact: "Medium" }]);
  const closed = api.ecDayRowsHTML(rows, false);
  /* 23 Sep — the class list now carries the colour law's weight and result channels too (ec-row par imp-high res-flat) */
  assert.equal((closed.match(/class="ec-row par[ "]/g) || []).length, 1);
  assert.equal((closed.match(/class="ec-row sub[ "]/g) || []).length, 0);
  assert.match(closed, /data-act="ecfam" data-k="US\|08:30\|CPI"[\s\S]*Inflation Rate YoY/, "the family's named head leads");
  ctx.S.econOpen = { "US|08:30|CPI": 1 };
  assert.equal((api.ecDayRowsHTML(rows, false).match(/class="ec-row sub[ "]/g) || []).length, 3);
});

test("MONTH: a Sunday-first grid of whole weeks, impact class from a fixed list, cells escaped", () => {
  const { api, ctx } = load({ S: { econDay: "2026-09-18", econSpan: "MONTH" } });
  const html = api.ecMonthHTML([
    { event_ts: ts("2026-09-16T12:30:00Z"), country: "US", event: "<i>EXAMPLE</i> Retail Sales MoM (Aug)", actual: 0.6, estimate: 0.2, impact: 'x" onmouseover="y' },
  ]);
  assert.equal((html.match(/class="ec-cell/g) || []).length, 35, "Sep 2026: Tue 1st .. Wed 30th -> 5 whole weeks");
  assert.match(html, /^<div class="ec-cal"><div class="ec-dow">Sun<\/div>/);
  assert.match(html, /class="ec-ev imp-low beat"/, "unknown impact falls back to low; a beat on the name");
  assert.doesNotMatch(html, /" onmouseover="|<i>/, "the impact and the name arrive escaped");
  assert.equal(plain(api.ecMonthDays("2026-02-10")).length, 28);
  ctx.S.econSpan = "WEEK"; ctx.S.econDay = "2026-09-18";
  assert.deepEqual(plain(api.ecDaysInView()), ["2026-09-18", "2026-09-19", "2026-09-20", "2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24"]);
});

test("the window fetch is a region-scoped GET that pages until a short page", async () => {
  const calls = [];
  const { api } = load({ S: { econCty: "G20" }, pg: async (p) => { calls.push(p); return calls.length === 1 ? Array.from({ length: 1000 }, (_, i) => ({ event_ts: 150, country: "US", event: "X" + String(i).padStart(4, "0"), impact: "Low" })) : [{ event_ts: 151, country: "US", event: "Y", impact: "Low" }]; } });
  const rows = await api.ecFetchWindow(100, 200);
  assert.equal(rows.length, 1001);
  assert.equal(calls.length, 2);
  assert.match(calls[0], /^econ_calendar\?select=event_ts,country,event,actual,estimate,previous,impact&country=in\.\(US,CA,JP,UK,GB,DE,FR,IT,EU,CN,IN,BR,MX,KR,AU,RU,ZA,TR,SA,ID,AR\)&event_ts=gte\.100&event_ts=lte\.200&order=event_ts\.asc,country\.asc,event\.asc&limit=1000$/);
  // release closure: page 2 is a KEYSET page after page 1's last row, never an offset
  assert.doesNotMatch(calls.join(" "), /offset=/);
  assert.equal(decodeURIComponent(calls[1].match(/&or=([^&]+)/)[1]), '(event_ts.gt.150,and(event_ts.eq.150,country.gt."US"),and(event_ts.eq.150,country.eq."US",event.gt."X0999"))');
});

test("ecLoadWindow: a stale response never repaints, a failed new window says so, a fresh cached window is not re-read", async () => {
  const pending = [];
  const pg = (p) => new Promise((resolve, reject) => pending.push({ p, resolve, reject }));
  const { api, ctx, store } = load({ nodes: "auto", pg, S: { econCty: "US", econSpan: "WEEK", econDay: "2026-08-31" } });
  const row = (iso, event) => ({ event_ts: ts(iso), country: "US", event, actual: 1, estimate: 1, previous: 1, impact: "High" });
  const p1 = api.ecLoadWindow();
  ctx.S.econDay = "2026-09-07";
  const p2 = api.ecLoadWindow();
  assert.equal(pending.length, 2);
  pending[1].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE Second Window"), { ...row("2026-09-10T12:30:00Z", "EXAMPLE Not Yet"), actual: null }]);
  await p2;
  pending[0].resolve([row("2026-09-01T12:30:00Z", "EXAMPLE First Window")]);
  await p1;
  assert.match(store.econTbl.innerHTML, /EXAMPLE Second Window/);
  assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE First Window/, "the slower, older response was dropped");
  assert.equal(api.ECON_WIN, "US|WEEK|2026-09-07");
  assert.match(store.econTbl.innerHTML, /newest actual in this window: Tue, Sep 08, 2026 08:30 ET \u00b7 read \d\d:\d\d ET/);
  ctx.S.econCty = "G7";
  const p3 = api.ecLoadWindow();
  pending[2].reject(new Error("pg 500"));
  await p3;
  assert.match(store.econTbl.innerHTML, /economic calendar could not be read/);
  assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE Second Window/, "the US rows are not left under the G7 label");
  ctx.S.econCty = "US";
  await api.ecLoadWindow();
  assert.equal(pending.length, 3, "a window read under ten minutes ago is shown from cache, not re-read");
  assert.match(store.econTbl.innerHTML, /EXAMPLE Second Window/);
});

test("newest-actual note only counts actuals that have landed inside the window", () => {
  const { api } = load();
  const rows = [
    { event_ts: 100, actual: 1 }, { event_ts: 300, actual: null }, { event_ts: 250, actual: "2" }, { event_ts: 900, actual: 5 }, { event_ts: 260, actual: "n/a" },
  ];
  assert.equal(api.ecNewestActual(rows, 500).event_ts, 250);
  assert.equal(api.ecNewestActual([], 500), null);
});

test("the ported module only READS three tables and writes nothing", () => {
  for (const w of [/method\s*:/, /\bfetch\(/, /operatorWrite\(/, /pgPatch\(/, /functions\/v1/, /\/rpc\//, /localStorage\.setItem/, /sessionStorage/])
    assert.doesNotMatch(mod, w, "no write path: " + w);
  const tables = new Set([...mod.matchAll(/"([a-z_]+)\?select=/g)].map((m) => m[1]));
  assert.deepEqual([...tables].sort(), ["econ_calendar", "econ_history", "treasury_rates"]);
  const args = [...mod.matchAll(/\bpg\(([^,)]{0,32})/g)].map((m) => m[1]);
  assert.ok(args.length >= 4, "window (the tape shares it), curve, prints, per-series top-up");
  /* TWO calendar reads, and only two (23 Sep): the room's window read, which the tape and the band share, and the
     two-year history behind a landed number, which runs only when the number itself is clicked. Neither writes. */
  assert.equal((mod.match(/econ_calendar\?select=/g) || []).length, 2, "the shared window read, plus the click-only history");
  assert.equal((mod.match(/&actual=not\.is\.null&order=event_ts\.desc&limit=26/g) || []).length, 1, "the history read is the second one");
  assert.match(fnSrc(page, "ecHistShow"), /await pg\("econ_calendar\?select=/, "and it lives in the click handler, not on a timer");
  for (const a of args) assert.match(a, /^("econ_calendar\?|"econ_history\?|"treasury_rates\?|path$|$)/, "every read names one of the three tables: " + a);
});

test("the rail is production's: stored prints with freshness, writer footer, and the releases source named", () => {
  const { api } = load();
  const room = api.econRoomHTML();
  for (const id of ["econCtry", "econCat", "econDayLbl", "econHigh", "econTbl", "econCurve", "econLadder", "econList", "econSource"])
    assert.match(room, new RegExp('id="' + id + '"'), id);
  assert.match(room, /macro rail · <b>stored prints<\/b>/);
  assert.doesNotMatch(room, /<h4>Source \(live\)<\/h4>|macro rail · <b>live<\/b>/);
  const rail = fnSrc(page, "fillEconRail");
  assert.match(rail, /econ_history\?select=series,date,value,updated_ts&order=date\.desc&limit=1000/);
  assert.match(rail, /const lastWrite = econSeriesLastWrite\(eh\);/);
  assert.match(rail, /releases: econ_calendar \(FMP economic calendar, via fmp-economic; times in ET\)/);
  assert.match(fnSrc(page, "fillEcon"), /Promise\.all\(\[ecLoadWindow\(\), fillEconRail\(\)\]\)/);
  const clicks = page.slice(page.indexOf('case "ecctry"'), page.indexOf('/* R34 — removed orphaned case "systems"'));
  assert.doesNotMatch(clicks, /fillEcon\(\)/, "an arrow press never re-reads the rail");
  /* ecctry · ecgoto · ecday · ecspan, plus (22 Sep) mngoto when the ECON band is clicked from inside the room itself */
  assert.equal((clicks.match(/ecLoadWindow\(\);/g) || []).length, 5);
  assert.doesNotMatch(page, /URLSearchParams\(location\.search\)\.get\("room"\)/, "the review build's ?room= boot parameter is not ported");
  assert.doesNotMatch(page, /'<div class="sc-macronext" id="macroNext"><\/div>' \+/, "8995c4b's full-width dashboard row is not ported");
});

test("a room mount paints both halves from EXAMPLE rows: releases left, production's rail right", async () => {
  const seen = [];
  const pg = async (p) => {
    seen.push(p.split("?")[0]);
    if (p.startsWith("treasury_rates?")) return [{ date: "2026-09-17", m1: 4.3, m3: 4.2, y2: 4.67, y10: 4.94, y30: 5.1 }];
    if (p.startsWith("econ_history?") && p.includes("limit=1000"))
      return [{ series: "CPI", date: "2026-08-01", value: 331.2, updated_ts: ts("2026-09-18T17:47:00Z") },
              { series: "EXAMPLE_UNKNOWN_SERIES", date: "2026-08-01", value: 1, updated_ts: ts("2026-09-18T17:47:00Z") }];
    if (p.startsWith("econ_history?")) return [];
    if (p.startsWith("econ_calendar?")) return [{ event_ts: ts("2026-09-08T12:30:00Z"), country: "US", event: "EXAMPLE Non Farm Payrolls", actual: 22, estimate: 75, previous: 73, impact: "High" }];
    throw new Error("unexpected read " + p);
  };
  const { api, store } = load({ nodes: "auto", pg, S: { econCty: "US", econSpan: "WEEK", econDay: "2026-09-07" } });
  await api.fillEcon();
  assert.deepEqual([...new Set(seen)].sort(), ["econ_calendar", "econ_history", "treasury_rates"]);
  assert.match(store.econTbl.innerHTML, /EXAMPLE Non Farm Payrolls[\s\S]*<span class="v up">−53<\/span>/, "weaker payrolls read red");
  assert.match(store.econLadder.innerHTML, /^<h4>UST ladder · 2026-09-17<\/h4>[\s\S]*UST 10Y/);
  assert.match(store.econList.innerHTML, /macro prints · <b>latest stored<\/b> · 2 series/);
  assert.match(store.econList.innerHTML, /observed 2026-08-01 · monthly/);
  assert.match(store.econSource.innerHTML, /^releases: econ_calendar \(FMP economic calendar, via fmp-economic; times in ET\) · treasury_rates \(job treasury-curve-daily/);
  assert.match(store.econSource.innerHTML, /never stored: /, "series the store has never held are named, as production does");
  assert.match(store.econCurve.innerHTML, /2s10s \+0\.27%/);
});
