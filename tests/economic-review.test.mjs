/* economic-review lane (2026-09-18) - adversarial checks of the ported ECONOMIC room, VM-extracted from ../index.html
   (or $ECON_REVIEW_PAGE). Tests that compare against production need $ECON_REVIEW_BASE (an a13a486 index.html) and are
   skipped without it. pg / el / S / go are stubs: nothing here reaches a network, a store or a browser. All rows are
   EXAMPLE fixtures. Tests marked "review:" assert behaviour the unfixed port (economic-port.patch) gets wrong. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";

const P = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const page = fs.readFileSync(process.env.ECON_REVIEW_PAGE || P("../index.html"), "utf8");
const base = process.env.ECON_REVIEW_BASE ? fs.readFileSync(process.env.ECON_REVIEW_BASE, "utf8") : null;
const NEEDS_BASE = { skip: base ? false : "set ECON_REVIEW_BASE to an a13a486 index.html" };
const START = "/* ---- Room 9 · ECONOMIC", END = "/* ---- Room 3 · COMPANY";
const slice = (src) => src.slice(src.indexOf(START), src.indexOf(END));
function fnSrc(src, name) {
  const at = src.indexOf("function " + name + "(");
  assert.notEqual(at, -1, name);
  return src.slice(at, src.indexOf("\n}\n", at) + 3);
}
const helpers = (src) => src.match(/const esc = \(s\) => [\s\S]*?;\n/)[0] + src.match(/const num = \(x\) => [^\n]*\n/)[0];
const CLICKS = page.slice(page.indexOf('case "ecctry"'), page.indexOf('/* R34 — removed orphaned case "systems"'));
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

function load({ src = page, tapeOn = false, S = {}, pg = async () => [], nowMs = null, ident = true } = {}) {
  const store = {};
  const el = (id) => store[id] || (store[id] = { id, innerHTML: "", textContent: "", className: "" });
  const pills = [];
  const ctx = vm.createContext({
    console, setTimeout, encodeURIComponent,
    S: { sec: "ECONOMIC", state: "live", econCty: "US", econCat: "ALL", econDay: null, econSpan: "WEEK", econOpen: {}, econImp: "ALL", ...S },
    pg, el, go: (s) => { ctx.S.sec = s; }, SECFS_BTN: '<button class="sc-fsico" data-act="secfs">x</button>',
    prevClose: { MU: 100 }, fmtPxIdent: (v) => "$" + v, fmtC: (v) => (v >= 0 ? "+" : "") + v + "%",
    document: { querySelectorAll: () => pills },
  });
  if (nowMs != null) vm.runInContext("(() => { const R = Date, F = " + nowMs + "; class D extends R { constructor(...a) { if (a.length) super(...a); else super(F); } static now() { return F; } } globalThis.Date = D; })()", ctx);
  const isPort = src.includes("const ECON_TAPE_ON");
  let code = helpers(src) + slice(src) + (ident && isPort ? fnSrc(src, "leftIdentHTML") : "");
  if (tapeOn) code = code.replace("const ECON_TAPE_ON = false;", "const ECON_TAPE_ON = true;");
  if (isPort) code += "\nfunction click(act, ds) { const a = { dataset: ds }; switch (act) {\n" + CLICKS + "\n} }";
  const names = isPort
    ? ["fillEcon", "fillEconRail", "ecLoadWindow", "ecFetchWindow", "renderEconTable", "ecRowHTML", "ecDayRowsHTML", "ecMonthHTML",
       "macroNextHTML", "fillMacroNext", "ecTimeET", "ecDateKey", "ecToday", "ecDaysInView", "ecShift", "ecDayLbl", "ecWinKey", "click", "leftIdentHTML",
       ...(src.includes("function ecRefreshTick") ? ["ecRefreshTick", "ecNormalize", "ecKeysetAfter"] : [])]
    : ["fillEcon"];
  const api = vm.runInContext(code + "\n;({" + names.join(",") + (isPort ? ", get ECON_CAL() { return ECON_CAL; }, get ECON_WIN() { return ECON_WIN; }, set MACRO_NEXT(v) { MACRO_NEXT = v; }" + (src.includes("function ecRefreshTick") ? ", get ECON_WINS() { return ECON_WINS; }" : "") + "" : "") + "})", ctx);
  return { api, ctx, store };
}
const row = (iso, event, extra = {}) => ({ event_ts: ts(iso), country: "US", event, actual: 1, estimate: 1, previous: 1, impact: "High", ...extra });
const deferred = () => { const q = []; const pg = (p) => new Promise((resolve, reject) => q.push({ p, resolve, reject })); return { q, pg }; };
const flush = () => new Promise((r) => setImmediate(r));

/* ---------------------------------------------------------------- (a) ident bar + tape, flag OFF */
test("(a) flag OFF: leftIdentHTML output equals a13a486's for every room, state and input tried", NEEDS_BASE, () => {
  const { api, ctx } = load({ S: { sec: "DASHBOARD" } });
  const prod = vm.runInContext(fnSrc(base, "leftIdentHTML").replace("function leftIdentHTML(", "function prodIdent(") + "\n;prodIdent", ctx);
  const inputs = [{ t: "MU", name: "Micron", price: 101.5, chg: 1.2 }, { t: "NBIS", name: '<img src=x onerror=alert(1)> & "q"', price: null, chg: -0.4 },
    { t: "", name: "", price: 7, chg: null }, { t: "MU", name: "M", price: 0, chg: 0 }, {}, { t: "BTC-USD", name: "Bitcoin", price: 65000.12, chg: -3.21 }];
  let n = 0;
  for (const sec of ["DASHBOARD", "COMPANY", "ECONOMIC", "NEWS", "EVENTS", "SCENES"]) for (const state of ["live", "offline", "stale", undefined])
    for (const d of inputs) { ctx.S.sec = sec; ctx.S.state = state; assert.equal(api.leftIdentHTML(d), prod(d)); n++; }
  assert.equal(n, 144);
});
test("(a) flag OFF: the tape makes zero requests and the only dashboard call is guarded", async () => {
  let n = 0;
  const { api, store } = load({ S: { sec: "DASHBOARD" }, pg: async () => { n++; return []; } });
  store.macroNext = { innerHTML: "untouched" };
  await api.fillMacroNext(); await api.fillMacroNext();
  assert.equal(n, 0); assert.equal(store.macroNext.innerHTML, "untouched");
  assert.equal((page.match(/fillMacroNext\(\);/g) || []).length, 1, "one call site");
  assert.match(page, /\n    if \(ECON_TAPE_ON\) fillMacroNext\(\);/);
  assert.equal((page.match(/econ_calendar\?select=/g) || []).length, 2, "the page names econ_calendar twice: the room's window read and the tape");
  assert.match(fnSrc(page, "fillMacroNext"), /^function fillMacroNext\(\) \{\n  if \(!ECON_TAPE_ON\) return;/, "first statement returns while the flag is off");
});

/* ---------------------------------------------------------------- (b) escaping */
const EVIL = ['Fed "Chair" Q&A (Sep) <img src=x onerror=alert(1)>', "Core CPI's \"MoM\" & <b>x</b> (Aug)", "</span><script>alert(1)</script>",
  "Inflation Rate YoY (Aug)", "Core Inflation Rate YoY (Aug)", "`${x}` 'single' \"double\"", "CFTC S&P 500 speculative net positions"];
const CTYS = ["US", 'US" onmouseover="x', "<i>GB</i>", "EU", "__proto__"];
const IMPS = ["High", "Medium", "Low", "None", null, 'High" onclick="x', "constructor", "__proto__", "toString"];   // prototype keys: see the DEFECT-low test
function evilRows() {
  const out = []; let i = 0;
  for (const event of EVIL) for (const country of CTYS) for (const impact of IMPS)
    out.push({ event_ts: ts("2026-09-21T12:30:00Z") + (i++ % 5) * 3600, country, event, impact,
      actual: [1.5, "abc", null, "", "2", 1e6][i % 6], estimate: [1.4, null, "x", 2][i % 4], previous: [null, 3, "y"][i % 3] });
  return out;
}
const ALLOWED_ATTR = new Set(["class", "style", "title", "id", "data-act", "data-k", "data-day", "data-c", "data-s", "data-d", "aria-label"]);
const ALLOWED_STYLE = /^(color:var\(--(sv[1345]|dim)\)(;text-shadow:0 0 7px rgba\(255,138,0,\.85\)|;opacity:\.7)?|background:(#[0-9A-F]{6}|var\(--mute\)))$/;
function auditHTML(html, where, strictStyle = false) {
  const tag = /<\/?([a-z0-9]+)((?:\s+[a-z-]+="[^"<>]*")*)\s*>/gi;
  let m, covered = 0, lt = 0;
  for (const ch of html) if (ch === "<") lt++;
  while ((m = tag.exec(html))) {
    covered++;
    for (const a of m[2].matchAll(/([a-z-]+)="([^"]*)"/gi)) {
      assert.ok(ALLOWED_ATTR.has(a[1]), where + ": unexpected attribute " + a[1]);
      if (a[1] === "class") assert.match(a[2], /^[a-z0-9 -]*$/i, where + ": class carries data: " + a[2]);
      if (a[1] === "style") { assert.doesNotMatch(a[2], /["<>]/, where); if (strictStyle) assert.match(a[2], ALLOWED_STYLE, where + ": style not from the fixed set: " + a[2]); }
    }
  }
  assert.equal(covered, lt, where + ": a raw '<' that is not a well-formed tag");
  assert.doesNotMatch(html, /<script|<img|<i>|<b>x/i, where);
}
test("(b) every econ_calendar string reaching innerHTML is escaped; attributes stay well-formed", () => {
  const rows = evilRows();
  const { api, store, ctx } = load({ S: { econDay: "2026-09-21", econCty: "ALL" } });
  for (const r of rows) auditHTML(api.ecRowHTML(r, "", true), "ecRowHTML");
  ctx.S.econOpen = new Proxy({}, { get: () => 1 });                   // every family open
  auditHTML(api.ecDayRowsHTML(rows, true), "ecDayRowsHTML(open)");
  ctx.S.econSpan = "MONTH"; auditHTML(api.ecMonthHTML(rows), "ecMonthHTML");
  const seed = (span, cty, imp) => { ctx.S.econSpan = span; ctx.S.econCty = cty; ctx.S.econImp = imp; ctx.S.econOpen = {}; };
  for (const [span, cty, imp] of [["DAY", "ALL", "ALL"], ["WEEK", "ALL", "HIGH"], ["MONTH", "ALL", "ALL"], ["WEEK", "US", "ALL"], ["DAY", "EM", "ALL"]]) {
    seed(span, cty, imp);
    vm.runInContext("ECON_CAL = " + JSON.stringify(rows) + "; ECON_WIN = ecWinKey(); ECON_WIN_AT = Date.now();", ctx);
    api.renderEconTable();
    for (const id of ["econTbl", "econCtry", "econCat", "econHigh"]) auditHTML(store[id].innerHTML, "renderEconTable " + span + "/" + cty + " #" + id);
  }
});
test("(b) flag ON (proof copy only): the tape escapes names and the ident box keeps its markup", () => {
  const { api, ctx } = load({ tapeOn: true, S: { sec: "DASHBOARD" } });
  api.MACRO_NEXT = evilRows().map((r) => ({ ...r, event_ts: ts("2030-01-07T13:30:00Z") }));
  const html = api.macroNextHTML(ts("2030-01-07T12:00:00Z"));
  auditHTML(html, "macroNextHTML");
  auditHTML(api.leftIdentHTML({ t: "MU", name: "M", price: 1, chg: 1 }), "leftIdentHTML(on)");
});
test("(b) review: the impact dot's style is looked up with the row's impact on a plain object (prototype keys leak)", () => {
  const { api } = load();
  for (const impact of ["constructor", "__proto__", "toString"]) {
    const h = api.ecRowHTML({ event_ts: ts("2026-09-21T12:30:00Z"), country: "US", event: "X", impact }, "", false);
    const style = h.match(/<span class="dot" style="([^"]*)">/)[1];
    assert.match(style, ALLOWED_STYLE, "impact " + impact + " gives style " + JSON.stringify(style));
  }
});

/* ---------------------------------------------------------------- (c) reads only */
test("(c) the room and its clicks write nothing and read only econ_calendar / treasury_rates / econ_history", async () => {
  const mod = slice(page);
  for (const w of [/method\s*:/, /\bfetch\(/, /operatorWrite\(/, /pgPatch\(/, /pgAll\(/, /functions\/v1/, /\/rpc\//, /localStorage/, /sessionStorage/, /lsSet\(/,
    /indexedDB/, /caches\./, /sendBeacon/, /XMLHttpRequest/, /WebSocket/, /EventSource/, /new Image\(/, /\.src\s*=/, /postMessage/, /history\.(push|replace)State/])
    { assert.doesNotMatch(mod, w, "module: " + w); assert.doesNotMatch(CLICKS, w, "clicks: " + w); }
  const paths = [];
  const pg = async (p, tries) => {
    paths.push(p);
    if (p.startsWith("treasury_rates?")) return [{ date: "2026-09-17", y2: 4.6, y10: 4.9 }];
    if (p.startsWith("econ_history?")) return [];
    if (p.startsWith("econ_calendar?")) return [row("2026-09-18T12:30:00Z", "EXAMPLE CPI")];
    throw new Error("unexpected " + p);
  };
  const { api, ctx } = load({ pg, tapeOn: true, S: { econDay: "2026-09-18" } });
  await api.fillEcon();
  for (const [act, ds] of [["ecctry", { c: "G7" }], ["ecctry", { c: "ALL" }], ["eccat", { c: "LABOR" }], ["ecimp", {}], ["ecfam", { k: "US|08:30|CPI" }],
    ["ecday", { d: "1" }], ["ecday", { d: "-1" }], ["ecday", { d: "0" }], ["ecspan", { s: "MONTH" }], ["ecday", { d: "1" }], ["ecgoto", { day: "2026-10-05" }], ["ecspan", { s: "DAY" }]])
    { api.click(act, ds); await flush(); }
  ctx.S.sec = "DASHBOARD"; await api.fillMacroNext();
  assert.ok(paths.length > 0);
  for (const p of paths) assert.match(p, /^(econ_calendar|treasury_rates|econ_history)\?select=/, p);
  assert.match(fnSrc(page, "pg"), /^function pg\(path, _tries\) \{[\s\S]*fetch\(SB \+ "\/rest\/v1\/" \+ path, \{\s*headers: \{[^}]*\},\s*\}\);/, "pg is a plain GET");
});

/* ---------------------------------------------------------------- (d) window paging / races */
test("(d) two quick arrow presses answered out of order: only the newest window paints", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  await (async () => { const p = api.ecLoadWindow(); q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A")]); await p; })();
  api.click("ecday", { d: "1" }); api.click("ecday", { d: "1" });           // → 09-14, → 09-21
  q[2].resolve([row("2026-09-22T12:30:00Z", "EXAMPLE C")]); await flush();
  q[1].resolve([row("2026-09-15T12:30:00Z", "EXAMPLE B")]); await flush();
  assert.match(store.econTbl.innerHTML, /EXAMPLE C/); assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE [AB]/);
  assert.match(store.econDayLbl.textContent, /SEP 21, 2026/);
});
test("(d) review: a failed read shows its failure under ITS OWN label, not the previous window's", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  const p0 = api.ecLoadWindow(); q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A")]); await p0;
  assert.match(store.econDayLbl.textContent, /^MON, SEP 07, 2026/);
  api.click("ecday", { d: "1" });                                             // → 09-14
  q[1].reject(new Error("pg 500")); await flush();
  assert.match(store.econTbl.innerHTML, /could not be read/);
  assert.match(store.econDayLbl.textContent, /^MON, SEP 14, 2026/, "label still reads " + JSON.stringify(store.econDayLbl.textContent));
});
test("(d) review: a failed REGION read does not leave the previous region highlighted", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  const p0 = api.ecLoadWindow(); q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A")]); await p0;
  api.click("ecctry", { c: "G7" }); q[1].reject(new Error("pg 500")); await flush();
  assert.match(store.econTbl.innerHTML, /could not be read/);
  assert.match(store.econCtry.innerHTML, /class="ec-ct on[^"]*" data-act="ecctry" data-c="G7"/, "the failed region is the one highlighted");
});
test("(d) review: a chip click while a new window is in flight never draws the previous window's rows under the new label", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  const p0 = api.ecLoadWindow();
  q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE US Row"), row("2026-09-11T12:30:00Z", "EXAMPLE US Friday")]); await p0;
  api.click("ecctry", { c: "G7" });                                          // G7 read in flight
  api.click("ecimp", {});                                                    // HIGH ONLY → repaint
  assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE US/, "US-only rows drawn as G7");
  assert.doesNotMatch(store.econCtry.innerHTML, /data-c="G7">G7<span class="n">/, "a G7 count computed from US rows");
  api.click("ecday", { d: "1" });                                            // week of 09-14 in flight
  api.click("eccat", { c: "ALL" });
  assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE US/);
});
test("(d) review: an arrow press moves the label at once and shows 'loading', never the previous window's rows, while the read is in flight", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  const p0 = api.ecLoadWindow(); q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A")]); await p0;
  api.click("ecday", { d: "1" });                                             // → 09-14, read pending
  assert.equal(q.length, 2);
  assert.match(store.econDayLbl.textContent, /^MON, SEP 14, 2026/, "label still reads " + JSON.stringify(store.econDayLbl.textContent));
  assert.match(store.econTbl.innerHTML, /loading economic calendar/);
  assert.doesNotMatch(store.econTbl.innerHTML, /EXAMPLE A/);
  q[1].resolve([row("2026-09-15T12:30:00Z", "EXAMPLE B")]); await flush();
  assert.match(store.econTbl.innerHTML, /EXAMPLE B/);
});
test("(d) review: after a failed read, a chip click still says 'could not be read' (not an endless 'loading…')", async () => {
  const { q, pg } = deferred();
  const { api, store } = load({ pg, S: { econDay: "2026-09-07" } });
  const p0 = api.ecLoadWindow(); q[0].reject(new Error("pg 500")); await p0;
  assert.match(store.econTbl.innerHTML, /could not be read/);
  api.click("ecimp", {});
  assert.match(store.econTbl.innerHTML, /could not be read/, "now reads " + JSON.stringify(store.econTbl.innerHTML));
});
test("(d) paging cannot loop: a server that always answers a full page stops at 20 pages", async () => {
  let n = 0;
  const { api } = load({ pg: async () => { n++; return Array.from({ length: 1000 }, (_, i) => ({ event_ts: n * 1000 + i, country: "US", event: "X" + i, impact: "Low" })); } });
  const rows = await api.ecFetchWindow(0, 1);
  assert.equal(n, 20); assert.equal(rows.length, 20000);
});
test("(d) a stale cached window that fails its re-read keeps its rows AND its label; a later success replaces them", async () => {
  let t = Date.parse("2026-09-18T14:00:00Z");
  const { q, pg } = deferred();
  const { api, store, ctx } = load({ pg, S: { econDay: "2026-09-07" } });
  vm.runInContext("Date.now = () => globalThis.__t", ctx); ctx.__t = t;
  const p0 = api.ecLoadWindow(); q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A", { actual: null })]); await p0;
  ctx.__t = t + 11 * 60e3;
  const p1 = api.ecLoadWindow(); assert.equal(q.length, 2, "stale → re-read"); q[1].reject(new Error("x")); await p1;
  assert.match(store.econTbl.innerHTML, /EXAMPLE A/); assert.match(store.econDayLbl.textContent, /SEP 07/);
  const p2 = api.ecLoadWindow(); q[2].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A")]); await p2;
  assert.match(store.econTbl.innerHTML, /<span class="v act">1<\/span>/, "the late actual appears");
});

/* ---------------------------------------------------------------- (e) times */
test("(e) ET wall time and ET day across the 2026-11-01 DST change (independent of the machine's zone)", () => {
  const { api } = load();
  const T = (iso) => [api.ecDateKey(ts(iso)), api.ecTimeET(ts(iso))];
  assert.deepEqual(T("2026-10-30T12:30:00Z"), ["2026-10-30", "08:30"]);      // EDT
  assert.deepEqual(T("2026-11-02T13:30:00Z"), ["2026-11-02", "08:30"]);      // EST
  assert.deepEqual(T("2026-11-01T04:30:00Z"), ["2026-11-01", "00:30"]);      // EDT just after midnight (never "24:30")
  assert.deepEqual(T("2026-11-01T05:30:00Z"), ["2026-11-01", "01:30"]);      // first 01:30 (EDT)
  assert.deepEqual(T("2026-11-01T06:30:00Z"), ["2026-11-01", "01:30"]);      // second 01:30 (EST)
  assert.deepEqual(T("2026-11-03T04:59:00Z"), ["2026-11-02", "23:59"]);      // EST: still the 2nd in New York
  assert.deepEqual(T("2026-11-03T05:00:00Z"), ["2026-11-03", "00:00"]);
  assert.deepEqual(T("2027-03-14T06:59:00Z"), ["2027-03-14", "01:59"]);      // spring forward
  assert.deepEqual(T("2027-03-14T07:00:00Z"), ["2027-03-14", "03:00"]);
});
test("(e) a WEEK / MONTH across the change: days, window bounds and the month grid", async () => {
  const seen = [];
  const { api, ctx } = load({ S: { econDay: "2026-10-29", econSpan: "WEEK" }, pg: async (p) => { seen.push(p); return [row("2026-11-02T13:30:00Z", "EXAMPLE ISM"), row("2026-10-29T12:30:00Z", "EXAMPLE GDP")]; } });
  assert.deepEqual([...api.ecDaysInView()], ["2026-10-29", "2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"]);
  await api.ecLoadWindow();
  const [, from, to] = seen[0].match(/gte\.(\d+)&event_ts=lte\.(\d+)/);
  assert.ok(+from <= ts("2026-10-29T04:00:00Z") && +to >= ts("2026-11-05T05:00:00Z"), "the window covers the ET days on screen");
  const tbl = ctx.el("econTbl").innerHTML;
  assert.match(tbl, /THU, OCT 29, 2026<\/div>[\s\S]*EXAMPLE GDP[\s\S]*MON, NOV 02, 2026<\/div>[\s\S]*EXAMPLE ISM/i);
  ctx.S.econSpan = "MONTH"; ctx.S.econDay = "2026-11-01";
  const m = api.ecMonthHTML([row("2026-11-02T13:30:00Z", "EXAMPLE ISM")]);
  assert.equal((m.match(/class="ec-cell/g) || []).length, 35, "Nov 2026 starts on a Sunday: Nov 1 .. Dec 5");
  assert.match(m, /data-day="2026-11-02"><div class="ec-dnum"><span>2<\/span><\/div><div class="ec-ev imp-high inline"[^>]*><span class="sp"[^>]*><\/span><span class="nm">EXAMPLE ISM<\/span><span class="tm">08:30<\/span>/);
});
test("(e) 'today' is the New York date: 23:30 EST on Nov 1 is still Nov 1; midnight rolls it", () => {
  const a = load({ nowMs: Date.parse("2026-11-02T04:30:00Z") });
  assert.equal(a.api.ecToday(), "2026-11-01");
  const b = load({ nowMs: Date.parse("2026-11-02T05:00:00Z") });
  assert.equal(b.api.ecToday(), "2026-11-02");
  const c = load({ nowMs: Date.parse("2026-09-19T03:59:00Z") });            // 23:59 EDT Sep 18
  assert.equal(c.api.ecToday(), "2026-09-18");
});

/* ---------------------------------------------------------------- (h) request volume */
function counter(calRowsPerRead = 1) {
  const log = [];
  const pg = async (p) => {
    log.push(p.split("?")[0]);
    if (p.startsWith("treasury_rates?")) return [{ date: "2026-09-17", y2: 4.6, y10: 4.9 }];
    if (p.startsWith("econ_history?") && p.includes("limit=1000")) return [{ series: "CPI", date: "2026-08-01", value: 1, updated_ts: 1 }];
    if (p.startsWith("econ_history?")) return [{ series: "x", date: "2026-08-01", value: 1, updated_ts: 1 }];
    // release closure: keyset pages — page N+1 starts after the cursor's "EXAMPLE <n>" row
    const cur = (decodeURIComponent((p.match(/&or=([^&]+)/) || [, ""])[1]).match(/event\.gt\."EXAMPLE (\d+)"/) || [])[1];
    const off = cur == null ? 0 : +cur + 1;
    return Array.from({ length: Math.max(0, Math.min(1000, calRowsPerRead - off)) }, (_, i) => row("2026-09-18T12:30:00Z", "EXAMPLE " + (off + i)));
  };
  return { log, pg };
}
const tally = (log) => log.reduce((o, t) => ((o[t] = (o[t] || 0) + 1), o), {});
test("(h) request volume: room open (vs a13a486 when given); arrow presses; chips; cached steps", async () => {
  const port = counter(); const P1 = load({ pg: port.pg, S: { econDay: "2026-09-18" } });
  await P1.api.fillEcon();
  const tq = tally(port.log);
  if (base) {
    const prod = counter(); const P0 = load({ src: base, pg: prod.pg }); P0.store.econList = { innerHTML: "" };
    await P0.api.fillEcon();
    const tp = tally(prod.log);
    console.log("# open  a13a486:", JSON.stringify(tp), " port:", JSON.stringify(tq));
    assert.equal(tq.treasury_rates, tp.treasury_rates); assert.equal(tq.econ_history, tp.econ_history);
  }
  assert.equal(tq.econ_calendar, 1, "one calendar read on open (US WEEK)");
  const at = () => port.log.length;
  let n0 = at(); for (const [a, d] of [["eccat", { c: "LABOR" }], ["ecimp", {}], ["ecfam", { k: "k" }], ["eccat", { c: "ALL" }]]) { P1.api.click(a, d); await flush(); }
  assert.equal(at() - n0, 0, "chips, HIGH ONLY and family toggles never read");
  n0 = at(); P1.api.click("ecday", { d: "1" }); await flush(); assert.equal(at() - n0, 1, "an uncached arrow press = one read (US)");
  n0 = at(); P1.api.click("ecday", { d: "-1" }); await flush(); assert.equal(at() - n0, 0, "stepping back inside 10 min = no read");
  console.log("# per press (US, <1000 rows): 1 read; cached back-step: 0; chips: 0");
  const big = counter(4950); const P2 = load({ pg: big.pg, S: { econDay: "2026-09-18", econCty: "ALL", econSpan: "MONTH" } });
  await P2.api.ecLoadWindow();
  console.log("# one ALL/MONTH window of 4,950 rows (assumed):", big.log.length, "reads");
  assert.equal(big.log.length, 5);
});
test("(h) review: a window superseded by a quick second press is thrown away, so stepping back re-reads it", async () => {
  const c = counter(); const { api } = load({ pg: c.pg, S: { econDay: "2026-09-07" } });
  await api.ecLoadWindow();
  api.click("ecday", { d: "1" }); api.click("ecday", { d: "1" }); api.click("ecday", { d: "1" }); await flush(); await flush();
  const n0 = c.log.length;
  api.click("ecday", { d: "-1" }); await flush(); api.click("ecday", { d: "-1" }); await flush();
  assert.equal(c.log.length - n0, 0, "two back-steps over windows already read cost " + (c.log.length - n0) + " more reads");
});
test("(h) review: a click on a MONTH day re-reads the month and stays in MONTH (the legend promises 'click any day to open it')", async () => {
  const c = counter(); const { api, ctx } = load({ pg: c.pg, S: { econDay: "2026-09-01", econSpan: "MONTH" } });
  await api.ecLoadWindow();
  const n0 = c.log.length;
  api.click("ecgoto", { day: "2026-09-16" }); await flush();
  assert.equal(ctx.S.econSpan, "DAY", "still " + ctx.S.econSpan + ", " + (c.log.length - n0) + " read(s) spent");
});

/* ---------------------------------------------------------------- (g) production's rail */
test("(g) the rail paints what a13a486's fillEcon paints, except the ladder's card, the footer's first phrase and the high dot's hue", NEEDS_BASE, async () => {
  const pg = async (p) => {
    if (p.startsWith("treasury_rates?")) return [{ date: "2026-09-17", m1: 4.3, m3: 4.2, y2: 4.67, y10: 4.94, y30: 5.1 }];
    if (p.startsWith("econ_history?") && p.includes("limit=1000")) return [
      { series: "CPI", date: "2026-08-01", value: 331.2, updated_ts: ts("2026-09-18T17:47:00Z") }, { series: "GDP", date: "2025-10-01", value: 30000, updated_ts: ts("2026-09-18T17:47:00Z") },
      { series: "WALCL", date: "2026-06-03", value: 6711495, updated_ts: ts("2026-06-09T23:05:50Z") }, { series: "EXAMPLE_X", date: "2026-08-01", value: 1, updated_ts: 1 }];
    if (p.includes("series=eq.M2SL")) throw new Error("pg 500");
    if (p.includes("series=eq.initialClaims")) return [{ series: "initialClaims", date: "2026-09-12", value: 230000, updated_ts: ts("2026-09-18T17:47:00Z") }];
    return [];
  };
  const A = load({ src: base, pg }); await A.api.fillEcon();
  const B = load({ pg }); await B.api.fillEconRail();
  const prodList = A.store.econList.innerHTML.split("color:#FF5500;text-shadow:0 0 7px rgba(255,85,0,.85)").join("color:var(--sv4);text-shadow:0 0 7px rgba(255,138,0,.85)");   // C4: on-palette high dot (0ca1d0d), intended
  const card = prodList.match(/^<div class="card" style="margin:4px 0 10px">[\s\S]*?<\/div><\/div>(?=<div class="sc-plabel")/)[0];
  assert.equal(B.store.econList.innerHTML, prodList.slice(card.length), "the prints list is production's, byte for byte");
  assert.equal(B.store.econSource.innerHTML, "releases: econ_calendar (FMP economic calendar, via fmp-economic; times in ET) · " + A.store.econSource.innerHTML);
  assert.equal(B.store.econCurve.innerHTML, A.store.econCurve.innerHTML);
  const rungs = (h) => [...h.matchAll(/<b>(UST [0-9]+[MY])<\/b>[\s\S]*?<span class="econ-val">([^<]*)</g)].map((m) => m[1] + "=" + m[2]).join(",");
  assert.equal(rungs(B.store.econLadder.innerHTML), rungs(card), "the same UST rungs, now in #econLadder");
});


/* ---------------------------------------------------------------- RELEASE CLOSURE (2026-09-19, root review 10:48Z) */
function liveRoom(S) {           // a room with a controllable clock, visibility, timer and listener registry
  const q = [], timers = [], listeners = [];
  const pg = (p) => p.startsWith("econ_calendar") ? new Promise((resolve, reject) => q.push({ p, resolve, reject })) : Promise.resolve([]);   // the rail answers at once
  const L = load({ pg, S: { econDay: "2026-09-07", ...S } });
  vm.runInContext("Date.now = () => globalThis.__t", L.ctx); L.ctx.__t = Date.parse("2026-09-09T13:00:00Z");
  L.ctx.setInterval = (fn, ms) => { timers.push({ fn, ms }); return timers.length; }; L.ctx.clearInterval = () => {};
  L.ctx.document.visibilityState = "visible"; L.ctx.document.addEventListener = (ev, fn) => listeners.push({ ev, fn });
  return { ...L, q, timers, listeners, advance: (min) => { L.ctx.__t += min * 60e3; } };
}
const mount = async (R, resolveRows) => { const p = R.api.fillEcon(); await flush(); R.q[R.q.length - 1].resolve(resolveRows); await flush(); await p; };
test("closure: a long-open, visible room re-reads after 10 min and shows an actual that landed after the first render; view state kept", async () => {
  const R = liveRoom({ econCat: "LABOR", econSpan: "WEEK" });
  await mount(R, [row("2026-09-09T12:30:00Z", "Initial Jobless Claims", { actual: null })]);
  assert.match(R.store.econTbl.innerHTML, /Initial Jobless Claims/); assert.doesNotMatch(R.store.econTbl.innerHTML, /<span class="v act">231/);
  const n0 = R.q.length; R.advance(5); R.api.ecRefreshTick(); assert.equal(R.q.length, n0, "younger than 10 min: no read");
  R.advance(6); R.api.ecRefreshTick(); assert.equal(R.q.length, n0 + 1, "older than 10 min: one read");
  R.q[n0].resolve([row("2026-09-09T12:30:00Z", "Initial Jobless Claims", { actual: 231 })]); await flush();
  assert.match(R.store.econTbl.innerHTML, /<span class="v act">231<\/span>/, "the late actual is shown");
  assert.equal(R.ctx.S.econCat, "LABOR"); assert.equal(R.ctx.S.econSpan, "WEEK"); assert.equal(R.ctx.S.econDay, "2026-09-07");
  assert.match(R.store.econTbl.innerHTML, /read 09:11 ET/, "the legend shows the real read time of the refresh (13:11Z = 09:11 ET)");
});
test("closure: hidden tab reads nothing; returning to the tab re-reads a stale window once; one timer and one listener however often the room mounts", async () => {
  const R = liveRoom({});
  await mount(R, [row("2026-09-08T12:30:00Z", "EXAMPLE A")]);
  const p2 = R.api.fillEcon(); await flush(); await p2; const p3 = R.api.fillEcon(); await flush(); await p3;   // remounts
  assert.equal(R.timers.length, 1, "one interval"); assert.equal(R.timers[0].ms, 60e3);
  assert.equal(R.listeners.filter((l) => l.ev === "visibilitychange").length, 1, "one visibility listener");
  const n0 = R.q.length; R.ctx.document.visibilityState = "hidden"; R.advance(30); R.timers[0].fn(); R.timers[0].fn();
  assert.equal(R.q.length, n0, "hidden: no reads");
  R.ctx.document.visibilityState = "visible"; R.listeners[0].fn(); R.listeners[0].fn();
  assert.equal(R.q.length, n0 + 1, "visible again: exactly one read, even when the event fires twice (in-flight read is shared)");
  R.q[n0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE A", { actual: 7 })]); await flush();
  assert.match(R.store.econTbl.innerHTML, /<span class="v act">7<\/span>/);
});
test("closure: a failed refresh keeps the last good rows, says so with real times, backs off 2 min, and the next success clears it", async () => {
  const R = liveRoom({});
  await mount(R, [row("2026-09-08T12:30:00Z", "EXAMPLE Kept")]);
  R.advance(11); R.api.ecRefreshTick(); const n0 = R.q.length; R.q[n0 - 1].reject(new Error("pg 503")); await flush();
  assert.match(R.store.econTbl.innerHTML, /EXAMPLE Kept/, "last good rows retained");
  assert.match(R.store.econTbl.innerHTML, /read 09:00 ET · refresh failed 09:11 ET, showing that read/);
  R.advance(1); R.api.ecRefreshTick(); assert.equal(R.q.length, n0, "no retry inside 2 min");
  R.advance(2); R.api.ecRefreshTick(); assert.equal(R.q.length, n0 + 1, "retry after 2 min");
  R.q[n0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE Kept")]); await flush();
  assert.doesNotMatch(R.store.econTbl.innerHTML, /refresh failed/);
});
test("closure: a rescheduled event leaves no ghost - the refreshed window is replaced, the overlapping cached window is spliced, disjoint and newer ones are untouched", async () => {
  const R = liveRoom({});
  await mount(R, [row("2026-09-10T12:30:00Z", "EXAMPLE Moved"), row("2026-09-08T12:30:00Z", "EXAMPLE Stays")]);        // week 09-07 (+pad to 09-19)
  R.api.click("ecday", { d: "1" }); await flush();                                                                   // week 09-14 (pad from 09-09) - overlaps
  R.q[R.q.length - 1].resolve([row("2026-09-10T12:30:00Z", "EXAMPLE Moved"), row("2026-09-16T12:30:00Z", "EXAMPLE Next Week"), row("2026-09-22T12:30:00Z", "EXAMPLE Far")]); await flush();
  R.api.click("ecday", { d: "-1" }); await flush();                                                                  // back to 09-07 (cached)
  R.advance(11); R.api.ecRefreshTick();                                                                               // refresh 09-07: the store moved the event to 09-11
  // the 09-07 window reads 09-02 … 09-18 (5-day pad), so the store's answer covers 09-16 too
  R.q[R.q.length - 1].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE Stays"), row("2026-09-11T14:00:00Z", "EXAMPLE Moved"), row("2026-09-16T12:30:00Z", "EXAMPLE Next Week")]); await flush();
  const html = R.store.econTbl.innerHTML;
  const per = (html.match(/EXAMPLE Stays/g) || []).length;                                                      // how often one row names itself
  assert.ok(per >= 1); assert.equal((html.match(/EXAMPLE Moved/g) || []).length, per, "shown once (as one row), at its new time");
  const W = R.api.ECON_WINS["US|WEEK|2026-09-14"].rows.map((r) => r.event + "@" + new Date(r.event_ts * 1000).toISOString().slice(5, 10));
  assert.deepEqual(JSON.parse(JSON.stringify(W)), ["EXAMPLE Moved@09-11", "EXAMPLE Next Week@09-16", "EXAMPLE Far@09-22"],
    "the overlapping week lost the ghost (09-10) and gained the moved row; its row outside the overlap (09-22) is untouched");
});
test("closure: an OLDER read never splices over a window read later (sequence, not clock)", async () => {
  const R = liveRoom({});
  const p1 = R.api.ecLoadWindow(); R.ctx.S.econDay = "2026-09-14"; const p2 = R.api.ecLoadWindow();           // same millisecond
  R.q[1].resolve([row("2026-09-16T12:30:00Z", "EXAMPLE New")]); await p2;
  R.q[0].resolve([row("2026-09-08T12:30:00Z", "EXAMPLE Old")]); await p1;                                      // older read lands last
  assert.deepEqual(JSON.parse(JSON.stringify(R.api.ECON_WINS["US|WEEK|2026-09-14"].rows.map((r) => r.event))), ["EXAMPLE New"]);
  assert.match(R.store.econTbl.innerHTML, /EXAMPLE New/);
});
test("closure: keyset paging - an insert between pages neither duplicates nor drops a row that existed throughout (offsets would duplicate)", async () => {
  const mk = (i) => ({ event_ts: 1000 + Math.floor(i / 3), country: "US", event: "E" + String(i).padStart(5, "0"), impact: "Low" });
  const table = Array.from({ length: 2500 }, (_, i) => mk(i));
  const ord = (a, b) => (a.event_ts - b.event_ts) || (a.country < b.country ? -1 : a.country > b.country ? 1 : 0) || (a.event < b.event ? -1 : a.event > b.event ? 1 : 0);
  let calls = 0;
  const pg = async (p) => { calls++;
    if (calls === 2) table.push({ event_ts: 1000, country: "US", event: "E00000a", impact: "Low" });              // written behind the cursor mid-read
    const all = table.slice().sort(ord); const m = decodeURIComponent((p.match(/&or=([^&]+)/) || [, ""])[1]).match(/event_ts\.gt\.(\d+),.*country\.gt\."([^"]*)".*event\.gt\."([^"]*)"/);
    const after = m ? { event_ts: +m[1], country: m[2], event: m[3] } : null;
    return all.filter((r) => !after || ord(r, after) > 0).slice(0, 1000).map((r) => ({ ...r })); };
  const { api } = load({ pg });
  const rows = await api.ecFetchWindow(0, 9e9);
  const keys = rows.map((r) => r.event);
  assert.equal(new Set(keys).size, keys.length, "no duplicates");
  for (let i = 0; i < 2500; i++) assert.ok(keys.includes(mk(i).event), "row " + i + " present");
  assert.equal(calls, 3);
});
test("closure: names and offices exactly as supplied - no person is promoted to Fed Chair, an office row names nobody new", () => {
  const { api } = load();
  const N = (event, impact) => { const r = api.ecNormalize({ event, impact }); return [r.event, r.impact]; };
  for (const who of ["Powell", "Bernanke", "Yellen", "Greenspan"]) assert.deepEqual(N("Fed " + who + " Speech", "Medium"), ["Fed " + who + " Speech", "Medium"], who);
  assert.deepEqual(N("Fed Chair Powell Speech", "Medium"), ["Fed Chair Powell Speech", "High"], "named by the supplier as the office: kept, High");
  assert.deepEqual(N("Fed Chair Speech", "Low"), ["Fed Chair Speech", "High"], "the office alone: no holder invented");
  assert.deepEqual(N("Fed Vice Chair Jefferson Speech", "Medium"), ["Fed Vice Chair Jefferson Speech", "Medium"], "vice chair is not the chair");
  assert.deepEqual(N("  Fed   Chair  Speech ", "Low"), ["Fed Chair Speech", "High"], "only whitespace is normalised");
  assert.doesNotMatch(page, /EC_CHAIR_NAMES|powell\|bernanke|\(powell\|/i, "no person-to-office list (constant or name alternation) remains in code");
  assert.match(page, /\nconst ECON_TAPE_ON = false;/, "tape stays off");
});
