// Cold-load / remount stability of the Hub dashboard board. Drop into <worktree>/tests/ (reads ../index.html), or point
// SC_PAGE at any copy of the page:  SC_PAGE=/path/to/index.html node --test dashboard-cold-load.test.mjs
// Every test below FAILS on the page at a985532 (sha256 da883340...6ba4) and passes on the candidate.
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
// a function nested in the rewind module's IIFE (two-space indent), up to its closing "  }\n"
function innerFn(name) {
  const start = page.search(new RegExp("^  (async )?function " + name + "\\(", "m"));
  assert.ok(start >= 0, name + " present");
  const end = page.indexOf("\n  }\n", start);
  return page.slice(start, end + 5);
}
// direct children of the first element in an HTML string (tags here are always explicitly closed)
function topLevelChildren(html) {
  let depth = 0, n = 0;
  for (const m of html.matchAll(/<(\/?)([a-zA-Z][a-zA-Z0-9]*)\b[^>]*>/g)) {
    if (m[1]) depth--; else { if (depth === 1) n++; depth++; }
  }
  assert.equal(depth, 0, "balanced markup");
  return n;
}
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

function boardRenderer(S) {
  // M52 — the USUAL DAY cell is a real page function, not a stub: this test's whole job is to prove
  // every column renders exactly one cell in every row state, and a stub would hide a second one.
  const src = page.match(/const BOARD_COLS = [^\n]*\n/)[0] + page.match(/const SC_PENDING = [^\n]*\n/)[0] +
    page.match(/^const SC_HB_STALE_DAYS = [^\n]*\n/m)[0] + page.match(/^const SC_HB_X_UNUSUAL\s+= [^\n]*\n/m)[0] +
    fn("hbAgeDays") + fn("hbPct") + fn("hbXUsual") + fn("hbTitle") + fn("hbCellHTML") +
    fn("boardTMCellsHTML") + fn("boardHeaderHTML") + fn("geigerMiniHTML") + fn("boardRowsHTML") +
    "\nreturn { BOARD_COLS, boardHeaderHTML, boardRowsHTML };";
  const cell = (cls) => () => '<span class="' + cls + '"></span>';
  const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
  return new Function("S", "esc", "num", "orderedShownRows", "COH_ABBR", "fpeTitle", "fmtCap", "fmtC", "rsiGradColor",
    "volCellHTML", "mktDotHTML", "scQuoteObservationLabel", "mcapCellHTML", "fpeWithheldText", src)(
    S, esc, num, () => S.rows, {}, () => "", () => "$1B", (c) => c.toFixed(2) + "%", () => "#fff",
    cell("sc-vol"), cell("sc-mktdot"), () => "", cell("sc-mcap"), () => "—");   // numeric-closure: the MKT CAP cell and the F P/E withheld text are page functions
}

test("the header and every row are built from ONE static column model: same cell count in every row state", () => {
  const S = { sort: { key: "g", dir: -1 }, fav: ["AMD"], boardPending: null, rows: [
    { t: "AMD", name: "Advanced Micro Devices", state: "OK", priceSource: "MASSIVE_PROVIDER", price: 544.12, c: -0.18, pc: 545.1, fpe: 48.4, mc: 766e9, rsi: 61, g: 0.74 },
    { t: "META", state: "CONNECTING", priceSource: "UNKNOWN", price: null, c: null, fpe: null, mc: 1.5e12, rsi: null, g: null },   // cached layout, pending
    { t: "SIUSD", state: "NON_EQUITY_OWNER", priceSource: "NON_EQUITY_OWNER", price: 66.74, c: null, fpe: null, mc: null, rsi: null, g: null, nf: true },   // values unavailable
  ] };
  const api = boardRenderer(S);
  assert.equal(api.BOARD_COLS.length, 14, "14 columns from the first render (Trend/Mom/Read are no longer spliced in later; M52 added USUAL DAY)");
  assert.deepEqual(api.BOARD_COLS.slice(7, 12).map((c) => c[0]), ["RSI", "Trend", "Mom", "Read", "Geiger"]);
  const html = api.boardRowsHTML();
  const header = html.slice(0, html.indexOf('<div class="ch sc-board__row'));
  const rows = html.slice(header.length).split(/(?=<div class="ch sc-board__row)/);
  assert.equal(rows.length, 3);
  const headerCells = topLevelChildren(header);
  assert.equal(headerCells, 14);
  for (const r of rows) assert.equal(topLevelChildren(r), headerCells, "row cells = header cells: " + r.slice(0, 80));
  // the Geiger cell sits in the Geiger column (index 10) in each state, not under TREND (index 7)
  for (const r of rows) {
    const cells = [...r.matchAll(/<(span|button) (?:class|style)="([^"]*)"/g)].map((m) => m[2]);
    assert.ok(cells.indexOf("gwx-read") > cells.indexOf("sc-rsi"), "component cells follow RSI");
  }
  assert.match(api.boardRowsHTML(), /class="gwx-tm"><span class="sc-pending"/, "component cells are born pending, never as a dash");
});

test("a pending board (no rows yet) still renders the full header from the model", () => {
  const S = { sort: { key: "g", dir: -1 }, fav: [], boardPending: "MEGACAP", rows: [] };
  const html = boardRenderer(S).boardRowsHTML();
  assert.equal(topLevelChildren(html.slice(0, html.indexOf('<div class="sc-board__pending"'))), 14);
  assert.match(html, /loading MEGACAP …/);
});

test("the final board geometry is in the head stylesheet, before any script can paint", () => {
  const head = page.slice(0, page.indexOf("</head>"));
  const tracks = head.match(/\n\.ch\{grid-template-columns:([^;]*) !important;gap:5px\}/);
  assert.ok(tracks, "the .ch track rule is static");
  assert.equal(tracks[1].split("minmax(").length - 1, 14, "one track per column, M52 included");
  assert.match(head, /\n\.gwx-tm\{[^}]*text-align:right/);
  assert.match(head, /\n\.sc-cohstrip__read\{[^}]*height:16px !important/, "the compare strip's final height is static too (it grew 5px after first paint)");
  assert.match(head, /\n\.gwx\{display:flex;align-items:center;gap:7px;padding:6px 10px;border-bottom:\.4px solid var\(--line\)\}/, "the rewind bar's box exists for the reserved slot");
  // verbatim copy: the rule injected by addCols() and the static one are the same text
  const injected = page.match(/"\.ch\{grid-template-columns:([\s\S]*?) !important;gap:5px\}"/)[1].replace(/"\+\s*"/g, "");
  assert.equal(tracks[1], injected, "static tracks are a verbatim copy of the injected tracks");
});

test("the rewind bar's place is reserved by the board template and mount() fills it in place", () => {
  const panel = fn("boardPanelHTML");
  assert.match(panel, /id="gwxSlot"/);
  assert.ok(panel.indexOf('id="cohGeiger"') < panel.indexOf('id="gwxSlot"') && panel.indexOf('id="gwxSlot"') < panel.indexOf('id="boardScroll"'),
    "slot sits exactly where the bar goes: after the cohort geiger, before the rows");
  assert.match(panel, /class="gwx gwx--slot"[^>]*aria-hidden="true"><button class="sc-l0chip"/, "slot is the bar's box holding one control of the bar's class (same height, no magic number)");
  const mount = innerFn("mount");
  assert.match(mount, /var slot=E\("gwxSlot"\);\s*if\(slot\) slot\.outerHTML=bar\(\); else host\.insertAdjacentHTML\("afterend", bar\(\)\);/);
  // behaviour, with a fake DOM: the slot is replaced, nothing is inserted beside it
  const calls = [];
  const els = { cohGeiger: { insertAdjacentHTML: () => calls.push("insert") }, gwxSlot: { set outerHTML(v) { calls.push("replace:" + v); delete els.gwxSlot; els.gwxBar = {}; } } };
  const E = (id) => els[id] || null;
  const head = mount.slice(0, mount.indexOf('E("gwxPlay")'));   // the mounting part, before the control wiring
  new Function("E", "bar", head + "}\nmount();")(E, () => "<bar>");
  assert.deepEqual(calls, ["replace:<bar>"]);
});

test("the bar and the component cells are mounted in the parsing task and on every remount, not on a timer", () => {
  assert.match(page, /try\{ mount\(\); \}catch\(e\)\{\}/, "bar mounted at parse time");
  assert.match(page, /try\{ watchBoard\(\); watchStrip\(\); watchMain\(\); loadTM\(\); \}catch\(e\)\{\}/);
  const wm = innerFn("watchMain");
  assert.match(wm, /observe\(m,\{childList:true\}\)/, "#main is watched: a room change is seen in its own frame");
  assert.match(wm, /mount\(\);\s*watchBoard\(\); watchStrip\(\);/);
  const wb = innerFn("watchBoard");
  assert.match(wb, /if\(!TIMER && needsTM\(bs\)\) paintTM\(\);/, "a board mounted while unobserved is painted on attach");
});

test("needsTM: freshly templated or cell-less rows need painting; painted rows do not (no double paint on an in-place move)", () => {
  const needsTM = new Function(innerFn("needsTM") + "return needsTM;")();
  const bs = (has) => ({ querySelector: (sel) => (has.includes(sel) ? {} : null) });
  assert.equal(needsTM(bs([".gwx-tm > .sc-pending", ".gwx-tm", ".sc-board__row"])), true, "template placeholders");
  assert.equal(needsTM(bs([".sc-board__row"])), true, "rows without cells (older template)");
  assert.equal(needsTM(bs([".gwx-tm", ".sc-board__row"])), false, "already painted");
  assert.equal(needsTM(bs([])), false, "no rows");
});

test("component cells say pending until the first component read completes, then a dash means absent", () => {
  const paint = innerFn("paintTM");
  assert.match(paint, /var NONE=\(TM_LOADED\|\|ASOF\)\?"—":"…";/);
  assert.doesNotMatch(paint, /textContent="—"; mo\.textContent="—"/, "no unconditional dash for a value that is only pending");
  assert.match(innerFn("loadTM"), /TM_LOADED=true;/);
});

test("favourites load: the running feed is not restarted for an unchanged list", () => {
  const sameTickerSet = new Function(fn("sameTickerSet") + "return sameTickerSet;")();
  assert.equal(sameTickerSet(["MU", "NBIS", "SNDK"], ["SNDK", "mu", "NBIS"]), true, "order and case do not matter");
  assert.equal(sameTickerSet(["MU", "NBIS"], ["MU", "NBIS", "SNDK"]), false);
  assert.equal(sameTickerSet(["MU", "AMD"], ["MU", "NBIS"]), false);
  assert.equal(sameTickerSet([], []), true);
  assert.equal(sameTickerSet(null, undefined), true);
});

test("favLoad behaviour: unchanged list leaves the feed alone; a changed FAV scope restarts it; another scope only repaints stars", async () => {
  const run = async (local, server, coh) => {
    const calls = [];
    const S = { fav: local.slice(), coh };
    const src = fn("sameTickerSet") + fn("favLoad") + "\nreturn favLoad;";
    const favLoad = new Function("S", "pg", "operatorWrite", "lsSet", "NEWS_CACHE", "restartFeed", "updateBoard", "console", src)(
      S, async () => server.map((t) => ({ ticker: t })), async () => {}, () => calls.push("ls"),
      { delete: () => calls.push("news") }, () => calls.push("restartFeed"), () => calls.push("updateBoard"), console);
    await favLoad();
    return { calls, fav: S.fav };
  };
  assert.deepEqual((await run(["MU", "NBIS"], ["NBIS", "MU"], "FAV")).calls, ["ls"], "same set: no restart, boot pull keeps running");
  const changed = await run(["MU"], ["MU", "AMD"], "FAV");
  assert.deepEqual(changed.calls, ["ls", "news", "restartFeed"]); assert.deepEqual(changed.fav, ["MU", "AMD"]);
  assert.deepEqual((await run(["MU"], ["MU", "AMD"], "MEGACAP")).calls, ["ls", "news", "updateBoard"], "other scope: stars only");
});

test("cohort membership is read in full: paged, ordered, through the same reader as the estimates", async () => {
  assert.match(page, /pgAll\("ticker_cohorts\?select=ticker,cohort&order=ticker\.asc,cohort\.asc"\)/);
  assert.doesNotMatch(page, /[^A-Za-z]pg\("ticker_cohorts\?/, "no unpaged read left");
  // pgAll + buildCohSets over a 1,280-row table served 1,000 rows at a time
  const table = []; for (let i = 0; i < 1280; i++) table.push({ ticker: "T" + String(i).padStart(4, "0"), cohort: i % 2 ? "MEGACAP" : "BLUE_CHIP" });
  const requests = [];
  const pg = async (path) => { requests.push(path); const o = +(/offset=(\d+)/.exec(path) || [0, 0])[1]; return table.slice(o, o + 1000); };
  const src = page.match(/const EST_TTL_MS = [^\n]*\n/)[0] + fn("pgAll") + fn("buildCohSets") + "\nreturn { pgAll, buildCohSets };";
  const api = new Function("pg", src)(pg);
  const rows = await api.pgAll("ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc");
  assert.equal(rows.length, 1280, "all memberships, not the first 1,000");
  assert.equal(requests.length, 2);
  const sets = api.buildCohSets(rows);
  assert.equal(sets.MEGACAP.size + sets.BLUE_CHIP.size, 1280);
  assert.ok(sets.MEGACAP.has("T1279"), "a row past the 1,000-row cap is a member");
});

test("the ident bar is left as shipped (the scope-label change is held for the user's eye by review fix-A)", () => {
  assert.doesNotMatch(page, /function scopeIdentData\(/);
  assert.match(fn("identBarData"), /\{ t: LEFT_T \|\| "", name: "", price: PRICES\[LEFT_T\] != null \? PRICES\[LEFT_T\] : null, chg: null \}/);
  assert.match(fn("leftIdentHTML"), /\(data\.price != null \? fmtPxIdent\(data\.price\) : "—"\)/);
  assert.doesNotMatch(fn("updateBoard"), /coIdentBar/);
});

test("a scope that has not loaded is not reported as empty, and the map is built when its first rows arrive", () => {
  const scopeEmptyNote = new Function(fn("scopeEmptyNote") + "return scopeEmptyNote;")();
  assert.equal(scopeEmptyNote("AI_HARDWARE", { AI_HARDWARE: "AI HW" }), "loading AI HW …");
  assert.equal(scopeEmptyNote("XLK", {}), "loading XLK …");
  assert.equal(scopeEmptyNote(null, {}), "no tickers in this scope");
  assert.doesNotMatch(fn("l0BodyHTML"), />no tickers in this scope</, "the MAP no longer hard-codes the empty claim");
  assert.match(fn("updateBoard"), /else if \(inL0 && LAYER0_TAB === "MAP" && shownRows\(\)\.length && document\.querySelector\("#l0body > \.sc-l0note"\)\) paintL0Body\(\);/);
});

test("the cohort summary keeps one shape in all three states: pending, no contributors (Geiger refused), and live", () => {
  const SC_PENDING = eval(page.match(/const SC_PENDING = ('[^\n]*');/)[1]);
  const num = (v) => { const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };
  // M52 — the header now also carries the cohort's own usual day; its helpers come from the page.
  const render = (S) => new Function("S", "esc", "num", "geigerMiniHTML", "SC_PENDING",
    fn("hbPct") + fn("hbMedian") + fn("hbGroupLabel") + "return " + fn("cohortGeigerHTML") + ";")(
      S, esc, num, () => '<span class="sc-gmini"></span>', SC_PENDING)();
  const shape = (html) => [/class="sc-cohgeiger__hd"/.test(html), (html.match(/sc-cohgeiger__line is-mean/g) || []).length, /sc-cohgeiger__big/.test(html)];
  const pending = render({ coh: "FAV", boardPending: null, cohGeigerOpen: false, rows: [{ t: "AMD", g: null, state: "CONNECTING" }] });
  const refused = render({ coh: "FAV", boardPending: null, cohGeigerOpen: false, rows: [{ t: "AMD", g: null, state: "OK" }, { t: "BE", g: null, state: "OK" }] });
  const live    = render({ coh: "FAV", boardPending: null, cohGeigerOpen: false, rows: [{ t: "AMD", g: 0.74, state: "OK" }, { t: "BE", g: null, state: "OK" }] });
  assert.deepEqual(shape(pending), [true, 1, false]);
  assert.deepEqual(shape(refused), [true, 1, false], "no short 'awaiting data' block when a pull carries no Geiger (the 16px jump)");
  assert.deepEqual(shape(live), [true, 1, false]);
  assert.match(refused, /0\/2 contributors · awaiting data/, "still says what is observed");
  assert.match(refused, /sc-cohgeiger__v" style="color:var\(--mute\)">—</, "unavailable is a dash, not a pending mark");
  assert.match(live, /1\/2 contributors/);
});
