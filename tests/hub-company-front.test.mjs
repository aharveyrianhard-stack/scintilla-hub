// H-FRONT (P3, 25 Sep) — the Hub's company front: a company opens on CHART (the Station chart pane, timeframe row local
// to the Hub), EXPAND gives it the full width, REVENUE sits on the board, FUNDAMENTALS embeds the Station's shell under
// one line of the Hub's own numbers, and the three lists (LIKED / FAVORITES / RADAR). Offline: functions are sliced
// out of the page by name and run with stubs; nothing leaves the process.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(process.env.SC_PAGE || new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n}\n", start);
  return page.slice(start, end + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const clickCase = (name) => { const m = page.match(new RegExp('    case "' + name + '": \\{[\\s\\S]*?\\n      break;\\n    \\}\\n')); assert.ok(m, name); return m[0]; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
const LISTS_SRC = page.slice(page.indexOf("const LIST_COHS = "), page.indexOf("/* apply one intent"));
const FRONT_CONSTS = line(/^const CO_LANDING_TAB = [^\n]*/m) + line(/^const STATION_CHART_URL = [^\n]*/m) + line(/^const STATION_FUND_URL = [^\n]*/m) +
  line(/^const CO_RANGES = [^\n]*/m) + line(/^const CO_RANGE_KEY = [^\n]*/m) + line(/^const CO_CHART_RSI = [^\n]*/m) + line(/^const CO_FRAME_TABS = [^\n]*/m);
const CO_TABS = JSON.parse(page.match(/^const CO_TABS = (\[[^\]]*\]);/m)[1]);
const fmtCap = new Function("num", fn("fmtCap") + "\nreturn fmtCap;")(num);

/* ── HF-1 · CHART first ─────────────────────────────────────────────────────────────────────── */
test("a company opened from the board lands on CHART; GEIGER stays a tab but is never the landing tab", () => {
  assert.deepEqual(CO_TABS.slice(0, 4), ["GEIGER", "CHART", "FUNDAMENTALS", "STATS"]);
  const S = { coTab: "FINANCIALS", readTab: "BUSINESS" };
  let seen = null;
  const pinLeft = new Function("S", "clearRotate", "favList", "loadLeft", "LEFT_STATE", "ROT_INDEX", FRONT_CONSTS + fn("pinLeft") + "\nreturn pinLeft;")(
    S, () => {}, () => ["MU"], () => { seen = S.coTab; }, "AUTO", 0);
  pinLeft("NVDA");
  assert.equal(seen, "CHART", "the tab is CHART by the time the company loads");
  assert.equal(S.readTab, "VERDICT");
  /* every entry that opens a company goes through pinLeft: the board row, search, a ticker link */
  assert.match(fn("openCo"), /if \(wasDash\) pinLeft\(t\);/);
  assert.match(page, /LEFT_HEAT = false; openCo\(a\.dataset\.t\); break;/, "a board row opens through openCo");
});

function chartKit(stored) {
  const store = { "hub.chart.range": stored };
  return new Function("esc", "lsGet", FRONT_CONSTS + fn("coRange") + fn("coChartSrc") + fn("coChartTabHTML") +
    "\nreturn { coRange, coChartSrc, coChartTabHTML };")(esc, (k) => (k in store ? store[k] : null));
}
test("the CHART tab is the Station chart pane, with the timeframe row 1h 4h 1D 3D 1W and the remembered range", () => {
  const k = chartKit("4h");
  const html = k.coChartTabHTML("MU");
  assert.deepEqual([...html.matchAll(/data-r="([^"]+)"/g)].map((m) => m[1]), ["1h", "4h", "1D", "3D", "1W"]);
  assert.match(html, /class="sc-cofr__tf on" aria-pressed="true" data-act="corange" data-r="4h"/, "the remembered range is lit");
  assert.match(html, /<iframe class="sc-cofr__frame" id="coChartFrame"[^>]*src="https:\/\/station\.scintillahub\.ai\/chart\/\?t=MU&amp;range=4h&amp;clouds=1"/);
  assert.doesNotMatch(html, /tradingview/i, "never a TradingView embed");
  assert.equal(chartKit(null).coRange(null), "1D", "default 1D");
  assert.equal(chartKit("garbage").coRange("15m"), "1D", "a range outside the row falls back to 1D");
  assert.doesNotMatch(k.coChartSrc("MU", "1D", false), /rsi/, "the RSI fan is off");
  assert.match(k.coChartSrc("mu", "1W", true), /\?t=MU&range=1W&clouds=1&rsi=1$/, "and is one switch away");
  assert.match(page, /^const CO_CHART_RSI = false;/m);
});

test("clicking a timeframe writes ONLY the iframe's src and the browser's memory", () => {
  const frame = { src: "https://station.scintillahub.ai/chart/?t=MU&range=1D&clouds=1" };
  const btns = ["1h", "4h", "1D", "3D", "1W"].map((r) => ({ dataset: { r }, on: r === "1D", attrs: {},
    classList: { toggle(c, v) { this.o.on = v; } }, setAttribute(k, v) { this.attrs[k] = v; } }));
  btns.forEach((b) => { b.classList.o = b; });
  const saved = {};
  const run = new Function("a", "e", "el", "lsSet", "document", "LEFT_T", "esc",
    FRONT_CONSTS + fn("coRange") + fn("coChartSrc") + "\nswitch (\"corange\") {\n" + clickCase("corange") + "}");
  const e = { stopped: false, preventDefault() {}, stopPropagation() { this.stopped = true; } };
  run({ dataset: { r: "3D" } }, e, (id) => (id === "coChartFrame" ? frame : null), (k, v) => { saved[k] = v; },
    { querySelectorAll: () => btns }, "MU", esc);
  assert.equal(frame.src, "https://station.scintillahub.ai/chart/?t=MU&range=3D&clouds=1");
  assert.deepEqual(saved, { "hub.chart.range": "3D" });
  assert.deepEqual(btns.filter((b) => b.on).map((b) => b.dataset.r), ["3D"]);
  assert.ok(e.stopped, "a timeframe click never reaches the board row underneath");
});

test("the embedded tabs are not reloaded when the company payload lands, and never blanked to 'loading'", () => {
  const ll = fn("loadLeft");
  assert.match(ll, /\} else if \(S\.coTab !== "GEIGER" && !CO_FRAME_TABS\.has\(S\.coTab\)\) \{/);
  assert.match(ll, /if \(S\.coTab !== "GEIGER" && !CO_FRAME_TABS\.has\(S\.coTab\)\) renderLeftPanel\(\);/);
  assert.match(clickCase("cotab"), /S\.coTab !== "GEIGER" && !CO_FRAME_TABS\.has\(S\.coTab\) && !heavyReady/);
});

test("EXPAND hides the board and gives the company the full width; COLLAPSE restores it; remembered per browser", () => {
  const head = page.slice(0, page.indexOf("</head>"));
  assert.match(head, /body\.co-exp #boardPanel\{display:none !important\}/);
  assert.match(head, /body\.co-exp \.sc-body2\{grid-template-columns:minmax\(0,1fr\) !important\}/);
  const cls = new Set(), saved = {}, btn = { outerHTML: "" };
  const env = { LEFT_STATE: "PINNED", LEFT_T: "MU", LEFT_HEAT: false };
  const kit = new Function("S", "document", "lsGet", "lsSet", "el", "env",
    line(/^const CO_RANGE_KEY = [^\n]*/m) + "let CO_EXPANDED = false;\n" +
    "Object.defineProperty(globalThis, '__hf', { value: 1, configurable: true });\n" +
    fn("coExpandOn") + fn("coExpandBtnHTML") +
    fn("coExpandApply").replace("LEFT_STATE, LEFT_T, LEFT_HEAT", "env.LEFT_STATE, env.LEFT_T, env.LEFT_HEAT") +
    "\nreturn { click(e) { const a = null; switch (\"coexpand\") {\n" + clickCase("coexpand") + "} }, apply: coExpandApply, get on() { return CO_EXPANDED; } };")(
    { sec: "COMPANY" }, { body: { classList: { toggle(c, v) { if (v) cls.add(c); else cls.delete(c); } } } },
    () => null, (k, v) => { saved[k] = v; }, (id) => (id === "coExpBtn" ? btn : null), env);
  const e = { preventDefault() {}, stopPropagation() {} };
  kit.click(e);
  assert.ok(cls.has("co-exp"), "expanded: the board hides");
  assert.equal(saved["hub.company.expanded"], "1");
  assert.match(btn.outerHTML, />COLLAPSE</);
  kit.click(e);
  assert.ok(!cls.has("co-exp"), "collapsed: the board is back");
  assert.equal(saved["hub.company.expanded"], "0");
  assert.match(btn.outerHTML, />EXPAND</);
  /* expanded is remembered but only applies while a company is pinned: never an empty pane over a hidden board */
  kit.click(e); env.LEFT_STATE = "AUTO"; kit.apply();
  assert.ok(!cls.has("co-exp"), "no company pinned → the board is never hidden");
  env.LEFT_STATE = "PINNED"; kit.apply();
  assert.ok(cls.has("co-exp"), "pin again → it comes back expanded");
  assert.match(page, /^let CO_EXPANDED = lsGet\(CO_EXP_KEY\) === "1";/m, "read from the browser at load");
  assert.match(fn("renderLeftPanel"), /coExpandApply\(\);/, "every left-panel paint re-applies it");
  assert.match(fn("leftHeadHTML"), /coExpandBtnHTML\(\)/, "the control sits top-right on the company view");
});

/* ── HF-2 · REVENUE ─────────────────────────────────────────────────────────────────────────── */
const revKit = new Function("num", "esc", "fmtCap", fn("fmtRev") + fn("revTitle") + fn("revCellHTML") + "\nreturn { fmtRev, revTitle, revCellHTML };")(num, esc, fmtCap);
test("REVENUE is a board column beside MKT CAP, read from fundamentals.revenue_ttm in the board's own read", () => {
  const cols = page.match(/const BOARD_COLS = \[(.*?)\];/s)[1];
  assert.match(cols, /\["Mkt Cap","mc"\], \["Revenue","rev"\]/);
  assert.match(page, /pg\("fundamentals\?select=ticker,eps_ttm,revenue_ttm,updated_ts"\)/, "the read the board already made, two columns wider");
  assert.match(page, /REVTTM\[r\.ticker\] = \{ v: \(rv != null && rv > 0\) \? rv : null/, "a stored 0 is not a revenue");
  assert.match(fn("boardRowsHTML"), /mcapCellHTML\(d\.t, d\.mc, d\.mcAsOf\) \+\n\s+revCellHTML\(d\.t, d\.rev, d\.revAsOf\)/);
});
test("REVENUE formats as $12.3B / $845M and absent is a blank cell, never 0", () => {
  assert.equal(revKit.fmtRev(12.3e9), "$12.3B");
  assert.equal(revKit.fmtRev(845e6), "$845M");
  assert.equal(revKit.fmtRev(90274000000), "$90.3B");
  for (const absent of [null, undefined, 0, -5]) assert.equal(revKit.fmtRev(absent), "", String(absent));
  const blank = revKit.revCellHTML("BTCUSD", null, null);
  assert.match(blank, /<span class="sc-rev" id="lrv_BTCUSD" title="revenue not on file \(fundamentals\.revenue_ttm\)"><\/span>/);
  assert.match(revKit.revCellHTML("MU", 90274000000, 1789884421), /title="trailing-twelve-month revenue · fundamentals\.revenue_ttm · stored 2026-09-20">\$90\.3B</);
});
test("sorting by REVENUE orders numerically; a name with no revenue sorts as lowest, exactly like every other column", () => {
  const rows = [{ t: "A", rev: 2e9 }, { t: "B", rev: null }, { t: "C", rev: 90e9 }, { t: "D", rev: 845e6 }, { t: "E", rev: 12.3e9 }];
  const order = (dir) => new Function("S", "window", fn("computeBoardOrder") + "\nreturn computeBoardOrder();")(
    { sort: { key: "rev", dir }, rows }, { SC_RANK_READY: true });
  assert.deepEqual(order(-1), ["C", "E", "A", "D", "B"], "largest first, numerically (not $845M above $2.0B as text would)");
  assert.deepEqual(order(1), ["B", "D", "A", "E", "C"], "ascending: the blank first (the shared rule: absent = lowest), then smallest to largest");
});

/* ── HF-3 · FUNDAMENTALS ────────────────────────────────────────────────────────────────────── */
const fundKit = (rows) => new Function("S", "ALLROWS", "PRICES", "esc", "num", "fmtCap", "fmtC", "fmtPxIdent", "fmtRev", "revTitle",
  FRONT_CONSTS + fn("coFundSrc") + fn("coBoardRow") + fn("coFundLineHTML") + fn("coFundTabHTML") + "\nreturn { coFundTabHTML, coFundLineHTML };")(
  { rows }, [], {}, esc, num, fmtCap, (c) => (c >= 0 ? "+" + c.toFixed(2) + "%" : "(" + Math.abs(c).toFixed(2) + "%)"), (p) => p.toFixed(2), revKit.fmtRev, revKit.revTitle);
test("FUNDAMENTALS embeds the Station's fundamentals shell under one line of the Hub's own numbers", () => {
  const html = fundKit([{ t: "MU", price: 157.2, c: -1.25, rev: 90274000000, revAsOf: 1789884421, mc: 1041730560000 }]).coFundTabHTML("MU");
  assert.match(html, /<iframe class="sc-cofr__frame" id="coFundFrame"[^>]*src="https:\/\/station\.scintillahub\.ai\/station-shells\/fundamentals-v1\/\?t=MU"/);
  const ln = html.slice(0, html.indexOf("<iframe"));
  assert.match(ln, /<i>PRICE<\/i>157\.20/);
  assert.match(ln, /class="sc-cofl__c dn"[^>]*><i>DAY<\/i>\(1\.25%\)/, "down in red");
  assert.match(ln, /<i>REVENUE TTM<\/i>\$90\.3B/);
  assert.match(ln, /<i>MKT CAP<\/i>\$1\.0T/);
  const none = fundKit([]).coFundTabHTML("ZZZZ");
  assert.equal((none.match(/<i>[A-Z ]+<\/i>—/g) || []).length, 4, "a ticker the board does not hold says absent in all four — the line is never empty");
});

/* ── HF-5 · LIKED / FAVORITES / RADAR ───────────────────────────────────────────────────────── */
const pure = new Function(LISTS_SRC + fn("listApply") + fn("listRowsFor") + fn("listsFromRows") + "\nreturn { LIST_COHS, isListCoh, listApply, listRowsFor, listsFromRows };")();
test("the strip reads ♥ LIKED · ★ FAVORITES · ◎ RADAR; LIKED keeps the FAV key so every scope rule still applies", () => {
  const strip = new Function("S", "COHORTS", fn("cohStripHTML") + "\nreturn cohStripHTML();")({ coh: "RADAR" }, [["MEGACAP", "MEGACAP"]]);
  const tabs = [...strip.matchAll(/data-key="([^"]+)">([^<]+)</g)].map((m) => m[1] + "=" + m[2]);
  assert.deepEqual(tabs.slice(0, 4), ["FAV=♥ LIKED", "FAVORITES=★ FAVORITES", "RADAR=◎ RADAR", "ALL=ALL"]);
  assert.match(strip, /sc-coh--fav is-active" data-act="coh" data-key="RADAR"/);
  assert.deepEqual(Object.keys(pure.LIST_COHS), ["FAV", "FAVORITES", "RADAR"]);
  assert.match(page, /pg\("hub_favorites\?select=ticker"\)/, "LIKED is still hub_favorites");
});
test("positions are append order from 1, a removal closes the gap, and a name is never on a list twice", () => {
  let l = [];
  for (const t of ["MU", "nvda", "AMD"]) l = pure.listApply(l, t, true);
  assert.deepEqual(l, ["MU", "NVDA", "AMD"]);
  assert.deepEqual(pure.listApply(l, "MU", true), l, "adding a present name changes nothing");
  l = pure.listApply(l, "NVDA", false);
  assert.deepEqual(pure.listRowsFor("radar", l, "T").map((r) => [r.position, r.ticker]), [[1, "MU"], [2, "AMD"]], "compacted: no gap at 2");
  const rows = [{ list: "radar", position: 2, ticker: "AMD" }, { list: "favorites", position: 1, ticker: "mu" },
    { list: "radar", position: 1, ticker: "MU" }, { list: "radar", position: 3, ticker: "AMD" }, { list: "scratch", position: 1, ticker: "X" }];
  assert.deepEqual(pure.listsFromRows(rows), { favorites: ["MU"], radar: ["MU", "AMD"] },
    "position order; a mid-write duplicate counts once; the Station's other lists are not ours");
});

function listsHarness(stored, fav) {
  const calls = [];
  const S = { coh: "ALL", fav: fav.slice() };
  const pg = async (path) => { calls.push(["GET", path]); return stored.map((r) => Object.assign({}, r)); };
  const fetch = async (url, o) => { calls.push([o.method, url, o.body ? JSON.parse(o.body) : null, o.headers.Prefer || null]); return { ok: true, status: 201 }; };
  const favToggles = [];
  const api = new Function("S", "pg", "fetch", "SB", "ANON", "restartFeed", "updateBoard", "el", "LEFT_T", "toggleFav", "console",
    LISTS_SRC + fn("listApply") + fn("listRowsFor") + fn("listsFromRows") + fn("coListsRepaint") + fn("listsRepaint") +
    fn("listsLoad") + fn("listStore") + "let LIST_WRITES = Promise.resolve();\n" + fn("listIntent") + fn("toggleList") +
    "\nreturn { LISTS, toggleList, listIntent, listsLoad, done: () => LIST_WRITES };")(
    S, pg, fetch, "https://sb.invalid", "anon", () => calls.push(["restartFeed"]), () => {}, () => null, null,
    (t) => { favToggles.push(t); S.fav = S.fav.includes(t) ? S.fav.filter((x) => x !== t) : S.fav.concat([t]); }, { error() {} });
  return { api, calls, S, favToggles };
}
test("a toggle is an intent applied to what is stored NOW: another device's (or the Station's) change is kept", async () => {
  /* this device read RADAR = [MU]; since then the Station's SAVE AS RADAR stored [MU, AMD] */
  const h = listsHarness([{ list: "radar", position: 1, ticker: "MU" }, { list: "radar", position: 2, ticker: "AMD" }], ["MU", "AMD", "NVDA"]);
  h.api.LISTS.radar = ["MU"];
  await h.api.toggleList("radar", "NVDA");
  await h.api.done();
  const post = h.calls.find((c) => c[0] === "POST"), del = h.calls.find((c) => c[0] === "DELETE");
  assert.ok(post && del && h.calls.indexOf(post) < h.calls.indexOf(del), "upsert first, trim second: the list is never empty mid-write");
  assert.equal(post[1], "https://sb.invalid/rest/v1/station_lists?on_conflict=list,position");
  assert.equal(post[3], "resolution=merge-duplicates,return=minimal");
  assert.deepEqual(post[2].map((r) => [r.list, r.position, r.ticker]), [["radar", 1, "MU"], ["radar", 2, "AMD"], ["radar", 3, "NVDA"]]);
  assert.ok(post[2].every((r) => typeof r.updated_at === "string"));
  assert.equal(del[1], "https://sb.invalid/rest/v1/station_lists?list=eq.radar&position=gt.3");
  assert.deepEqual(h.api.LISTS.radar, ["MU", "AMD", "NVDA"], "the screen ends on what is stored");
});
test("adding to a subset likes the name too; a liked name is not liked twice", async () => {
  const h = listsHarness([], ["MU"]);
  await h.api.toggleList("favorites", "TSM");
  await h.api.done();
  assert.deepEqual(h.favToggles, ["TSM"], "not liked → liked");
  assert.deepEqual(h.S.fav, ["MU", "TSM"]);
  await h.api.toggleList("radar", "MU");
  await h.api.done();
  assert.deepEqual(h.favToggles, ["TSM"], "already liked → left alone");
});
test("removing from a subset closes the gap in the store", async () => {
  const h = listsHarness([{ list: "favorites", position: 1, ticker: "MU" }, { list: "favorites", position: 2, ticker: "AMD" }, { list: "favorites", position: 3, ticker: "TSM" }], ["MU", "AMD", "TSM"]);
  h.api.LISTS.favorites = ["MU", "AMD", "TSM"];
  await h.api.toggleList("favorites", "MU");
  await h.api.done();
  const post = h.calls.find((c) => c[0] === "POST"), del = h.calls.find((c) => c[0] === "DELETE");
  assert.deepEqual(post[2].map((r) => [r.position, r.ticker]), [[1, "AMD"], [2, "TSM"]]);
  assert.match(del[1], /position=gt\.2$/);
});
test("unliking takes the name off FAVORITES and RADAR (a subset holds only liked names)", () => {
  const tf = fn("toggleFav");
  assert.match(tf, /if \(!S\.fav\.includes\(t\)\) SUB_LISTS\.forEach\(\(l\) => \{ if \(LISTS\[l\]\.includes\(t\)\) listIntent\(l, t, false\); \}\);/);
});
test("the lists are read at load and every 5 minutes; a changed list on screen re-pulls the board", async () => {
  assert.match(page, /\nlistsLoad\(\); setInterval\(listsLoad, 300000\);/);
  const h = listsHarness([{ list: "radar", position: 1, ticker: "AMD" }], ["AMD"]);
  h.S.coh = "RADAR";
  await h.api.listsLoad();
  assert.deepEqual(h.api.LISTS.radar, ["AMD"]);
  assert.ok(h.calls.some((c) => c[0] === "restartFeed"), "the RADAR board follows the stored list");
});
test("FAVORITES and RADAR scope the board, news and earnings like LIKED does", () => {
  const COHSETS = { MEGACAP: new Set(["AAPL"]) };
  const src = LISTS_SRC + fn("boardScopeHas") + "\nlet BOARD_SNAPSHOT = null;\n" + line(/const BOARD_SNAPSHOT_MAX_AGE_MS = [^\n]*/) +
    fn("scopeRowsFromSnapshot") + fn("scopeItems") + "\nreturn { LISTS, set: (s) => { BOARD_SNAPSHOT = s; }, scopeRowsFromSnapshot, scopeItems };";
  const api = new Function("COHSETS", "cohKey", "S", src)(COHSETS, (k) => k, { fav: ["NBIS", "AMD"] });
  api.LISTS.radar = ["AMD"];
  api.set({ at: Date.now(), rows: [{ t: "AAPL" }, { t: "AMD" }, { t: "NBIS" }], cohByT: {} });
  assert.deepEqual(api.scopeRowsFromSnapshot("RADAR", ["NBIS", "AMD"]).map((r) => r.t), ["AMD"]);
  assert.deepEqual(api.scopeRowsFromSnapshot("FAV", ["NBIS", "AMD"]).map((r) => r.t), ["AMD", "NBIS"], "LIKED unchanged");
  assert.deepEqual(api.scopeItems([{ ticker: "AMD" }, { ticker: "NBIS" }], "RADAR", "", ["NBIS", "AMD"], COHSETS).map((n) => n.ticker), ["AMD"]);
  const nq = new Function("S", "NEWS_SEL", "encodeURIComponent", LISTS_SRC + fn("newsQueryFor") + "\nreturn { LISTS, newsQueryFor };")({ fav: ["MU"] }, "select=x", encodeURIComponent);
  assert.equal(nq.newsQueryFor("FAVORITES"), null, "an empty list pulls nothing (never an unscoped read)");
  nq.LISTS.favorites = ["MU", "TSM"];
  assert.equal(nq.newsQueryFor("FAVORITES"), "news?ticker=in.(MU,TSM)&select=x");
});
test("every board row and the company view carry ♥ ★ ◎; a list click never opens the company page", () => {
  const ctl = new Function("S", "esc", LISTS_SRC + fn("listCtlHTML") + "\nreturn { LISTS, listCtlHTML };")({ fav: ["MU"] }, esc);
  ctl.LISTS.radar = ["MU"];
  const row = ctl.listCtlHTML("MU", "row");
  assert.match(row, /class="sc-star is-fav" aria-pressed="true"[^>]*data-act="star" data-t="MU"><span class="sc-star__on">♥/, "♥ is the existing star mechanism");
  assert.match(row, /class="sc-lst sc-lst--favorites" aria-pressed="false"[^>]*data-act="lst" data-l="favorites" data-t="MU">☆</);
  assert.match(row, /class="sc-lst sc-lst--radar is-on" aria-pressed="true"[^>]*data-act="lst" data-l="radar" data-t="MU">◉</);
  assert.match(ctl.listCtlHTML("MU", "co"), /^<span class="sc-lists sc-lists--co" id="coLists">/);
  assert.match(fn("boardRowsHTML"), /listCtlHTML\(d\.t, "row"\)/);
  assert.match(fn("leftHeadHTML"), /listCtlHTML\(t, "co"\)/);
  assert.match(page, /case "lst":\s+e\.preventDefault\(\); e\.stopPropagation\(\); toggleList\(a\.dataset\.l, a\.dataset\.t\); break;/);
});
