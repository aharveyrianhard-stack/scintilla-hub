/* M55 — THE WHOLE TABLE REPLAYS, and the ECONOMIC room flashes what the top tape flashes.
   Everything here is lifted from the bytes ../index.html ships and run as written: no browser, no
   network, no store. What is pinned is what Alan asked for and what must not quietly come back:
     · every column plays its own history, and a column with no history shows a dash, never today;
     · the replay still costs two geometry reads a tick — the column pass reads none;
     · the room runs the TAPE's own model, plan and primitive, so the two cannot drift;
     · the release the tape sent him to is named in the room, in every view. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

function slice(from, to) {
  const a = page.indexOf(from);
  assert.ok(a >= 0, "missing: " + from);
  const b = page.indexOf(to, a);
  assert.ok(b > a, "missing: " + to);
  return page.slice(a, b);
}

/* ── the column layer, exactly as it ships ─────────────────────────────────────────────────── */
const COLS = slice("  var PXC={}, PXQ=[], PXQS={}, PXN=0", "  function seek(d, dNext, frac){");

function cell(cls) {
  const n = { _cls: cls, textContent: "", innerHTML: "", attrs: {}, style: { color: "", opacity: "" },
    className: cls, setAttribute(k, v) { n.attrs[k] = String(v); }, getAttribute: (k) => (k in n.attrs ? n.attrs[k] : null),
    removeAttribute(k) { delete n.attrs[k]; } };
  return n;
}
function mkRow(t) {
  const kids = { ".sc-last": cell("sc-last"), ".sc-chg": cell("sc-chg"), ".sc-fpe": cell("sc-fpe"),
    ".sc-mcap": cell("sc-mcap"), ".sc-rsi": cell("sc-rsi"), ".sc-vol": cell("sc-vol"), ".sc-mktdot": cell("sc-mktdot") };
  return { _t: t, kids, getAttribute: (k) => (k === "data-t" ? t : null), querySelector: (q) => kids[q] || null };
}
function colsWorld({ rows, asof = "2026-08-20", cache = {}, px = {}, sRows = [], order = null } = {}) {
  const counters = { rects: 0, fetched: [] };
  const bs = {
    scrollTop: 0, getBoundingClientRect() { counters.rects++; return { top: 0, height: 600 }; },
    querySelectorAll: () => rows.slice(),
  };
  const S = { rows: sRows, boardOrder: order || rows.map((r) => r._t) };
  const src = "var ASOF=arguments[7], CACHE=arguments[8], PITCH=20, PITCH_OK=true, PX_SEED=arguments[9];\n" +
    COLS + "\nfor (const k in PX_SEED) PXC[k]=PX_SEED[k];\n" +
    "return { paintCols, wantVisible, pxDay, pxWant, queued: () => PXQ.slice(), PXC };";
  const api = new Function("E", "S", "SC_PENDING", "fmtC", "rsiGradColor", "fmtCap", "volCellHTML",
    "ASOF_IN", "CACHE_IN", "PX_IN", "ET_DAY", "SC_CHART_API", "fetch", "setTimeout", "fpeWithheldText", src)(
    (id) => (id === "boardScroll" ? bs : null), S, "…",
    (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%",
    () => "rgba(200,200,200,.5)", (v) => (v == null ? "—" : String(v)),
    () => '<span class="sc-vol">live</span>',
    asof, cache, px,
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }),
    "https://example.invalid", (u) => { counters.fetched.push(u); return new Promise(() => {}); }, () => 0, () => "—");
  return { api, counters, S, bs };
}

const bars = (map) => map;   /* { "2026-08-20": {c: 210, p: 200} } */

test("the replayed row shows THAT DAY's price, its own day change and its own RSI", () => {
  const rows = [mkRow("AAPL")];
  const { api } = colsWorld({
    rows, asof: "2026-08-20",
    cache: { "2026-08-20": { AAPL: 0.4, __mom: { AAPL: 0.2 }, __rsi: { AAPL: 61.4 } } },
    px: { AAPL: bars({ "2026-08-20": { c: 210.5, p: 200 } }) },
    sRows: [{ t: "AAPL", price: 999, c: 12, rsi: 30, fpe: 41.2, mc: 4e12 }],
  });
  api.paintCols();
  const k = rows[0].kids;
  assert.equal(k[".sc-last"].textContent, "210.50", "the close on the replayed day, not today's 999");
  assert.equal(k[".sc-chg"].textContent, "+5.25%", "(210.5/200-1) — the day's own move");
  assert.equal(k[".sc-chg"].className, "sc-chg up");
  assert.equal(k[".sc-rsi"].textContent, 61, "momentum_daily's RSI for that date, not today's 30");
  assert.match(k[".sc-last"].attrs.title, /close on 2026-08-20/);
});

test("a column with no history for that date is a quiet dash that says why — never today's value", () => {
  const rows = [mkRow("AAPL")];
  const { api } = colsWorld({
    rows, cache: { "2026-08-20": { AAPL: 0.4, __mom: {}, __rsi: {} } },
    px: { AAPL: bars({ "2026-08-20": { c: 210.5, p: 200 } }) },
    sRows: [{ t: "AAPL", price: 999, c: 12, rsi: 30, fpe: 41.2, mc: 4e12, rv: 1.4 }],
  });
  api.paintCols();
  const k = rows[0].kids;
  for (const sel of [".sc-fpe", ".sc-mcap", ".sc-vol", ".sc-rsi"]) {
    assert.equal(k[sel].textContent, "—", sel + " has no dated history, so it shows nothing");
    assert.equal(k[sel].style.color, "var(--mute)");
  }
  assert.match(k[".sc-fpe"].attrs.title, /today's consensus estimate/);
  assert.match(k[".sc-mcap"].attrs.title, /current profile field/);
  assert.match(k[".sc-vol"].attrs.title, /only true for its own session/);
  assert.ok(!/41\.2|4e\+?12|1\.4/.test(k[".sc-fpe"].textContent + k[".sc-mcap"].textContent + k[".sc-vol"].textContent),
    "not one of today's numbers leaked onto a past row");
});

test("a ticker the provider has no bar for waits, then dashes — it never borrows the live price", () => {
  const rows = [mkRow("ESUSD")];
  const w = colsWorld({ rows, cache: { "2026-08-20": { ESUSD: 0.1, __mom: {}, __rsi: {} } },
    px: {}, sRows: [{ t: "ESUSD", price: 5555, c: 1 }] });
  w.api.paintCols();
  assert.equal(rows[0].kids[".sc-last"].textContent, "…", "while the bars are in flight it is pending");
  assert.notEqual(rows[0].kids[".sc-last"].textContent, "5555");
});

test("LIVE hands every column back to the live row, and the dashes' reasons go with them", () => {
  const rows = [mkRow("AAPL")];
  const { api } = colsWorld({ rows, asof: null,
    sRows: [{ t: "AAPL", price: 1234.5, c: -2.5, rsi: 44, fpe: 30, mc: 1e12, rv: 1.2 }] });
  api.paintCols();
  const k = rows[0].kids;
  assert.equal(k[".sc-last"].textContent, "1,234.50");
  assert.equal(k[".sc-chg"].textContent, "-2.50%");
  assert.equal(k[".sc-chg"].className, "sc-chg dn");
  assert.equal(k[".sc-rsi"].textContent, 44);
  assert.equal(k[".sc-fpe"].textContent, "30.0×");
  assert.equal(k[".sc-fpe"].attrs.title, undefined, "the replay's explanation is not left behind");
});

test("the column pass reads no geometry at all, and only the rows on screen are fetched", () => {
  const rows = Array.from({ length: 364 }, (_, i) => mkRow("T" + i));
  const w = colsWorld({ rows, cache: { "2026-08-20": { __mom: {}, __rsi: {} } },
    sRows: rows.map((r) => ({ t: r._t })) });
  w.counters.rects = 0;
  w.api.paintCols();
  assert.equal(w.counters.rects, 0, "painting 364 rows' columns must not force a single layout");
  w.api.wantVisible(0, 0, 600);                       // the numbers repaint() has already read
  const asked = w.counters.fetched.map((u) => decodeURIComponent(u).replace(/.*symbol=([^&]+).*/, "$1")).concat(w.api.queued());
  assert.equal(w.counters.rects, 0, "and neither may deciding who is on screen");
  assert.ok(asked.length > 0 && asked.length <= 45, `asked for ${asked.length} tickers, expected the visible window only`);
  assert.equal(asked[0], "T0", "starting at the top of the board, where the reader is");
  assert.ok(!asked.includes("T200"), "a row 200 places down the board is not fetched until it is reached");
  assert.ok(w.counters.fetched.length <= 4, "at most four requests in flight");
  assert.match(w.counters.fetched[0], /\/candles\?symbol=T0&tf=1d&limit=\d+/, "one daily series per ticker, for the whole window");
});

test("a daily bar is filed under the session it belongs to, in New York, across the DST line", () => {
  const { api } = colsWorld({ rows: [], sRows: [] });
  assert.equal(api.pxDay(Date.parse("2026-09-23T04:00:00Z")), "2026-09-23", "summer: the bar anchors at 04:00Z");
  assert.equal(api.pxDay(Date.parse("2026-01-05T05:00:00Z")), "2026-01-05", "winter: 05:00Z, same session date");
});

/* ── the page's own wiring, read from the bytes ────────────────────────────────────────────── */
test("the rewind asks for the day's RSI on the request it was already making", () => {
  assert.equal((page.match(/momentum_daily\?select=ticker,read,rsi&asof=eq\./g) || []).length, 2,
    "both the seek and the warm-ahead read carry it");
  assert.ok(!/momentum_daily\?select=ticker,read&asof/.test(page), "and neither is left on the old two-column read");
});

test("nothing live writes over a rewound cell — including the path that returns early", () => {
  /* MEASURED before this guard: on a rewound board every column replayed EXCEPT the day change,
     because the tick has a second, earlier branch for a price that repeats — which, with the market
     closed, is the branch that runs all day. */
  const guard = slice("function scRewoundNow() {", "\n}\n");
  assert.match(guard, /classList\.contains\("gwx-on"\)/);
  const repeat = slice("    const sameChange = (pc0 &&", "    return;");
  assert.match(repeat, /scRewoundNow\(\) \? null : el\("lc_" \+ t\)/, "the price-repeat path asks too");
  assert.match(repeat, /LEFT_T === t && !scRewoundNow\(\)/, "and it leaves the company ident alone as well");
  assert.match(page, /if \(lp && !scRewoundNow\(\)\)/, "so does the moved-price path");
  const rsi = slice("function paintRsiCell(t, v) {", "\n}\n");
  assert.match(rsi, /scRewoundNow\(\)/, "and so does the lazy RSI loader");
  assert.equal((page.match(/classList\.contains\("gwx-on"\)/g) || []).length, 1,
    "ONE reader of that state, so a future writer cannot answer the question differently");
});

test("the tick still costs two geometry reads: the column work reuses what repaint already read", () => {
  const rep = slice("      var box=bs.getBoundingClientRect(); reads++;", "      badges(before);");
  assert.match(rep, /wantVisible\(box\.top, scrolled, vh\)/, "no new reads — the numbers are passed in");
  const extra = rep.split("\n").filter((l) => /getBoundingClientRect\(\)/.test(l) && !/var box=/.test(l));
  assert.ok(extra.every((l) => /rectMode/.test(l)),
    "every other rect read is the rectMode fallback, taken only when the rows are not uniform:\n" + extra.join("\n"));
});

/* ── the room and the tape ─────────────────────────────────────────────────────────────────── */
test("the room's queue is painted by the SAME function as the header tape", () => {
  const paint = slice("function ecNudgePaint(nowSec) {", "function ecNudgePaintBox(box, nowSec, modelIn) {");
  assert.match(paint, /ecNudgePaintBox\(el\("macroNext"\), nowSec\)/);
  assert.match(paint, /ecNudgePaintBox\(room, nowSec, ecRoomModel\(/, "the room, same painter, expanded model");
  assert.match(page, /<div class="ec-next" id="ecRoomQueue"><\/div>/, "and the room actually has the box");
  const room = slice('<div class="ec-next" id="ecRoomQueue">', '<div class="scroller" id="econTbl">');
  assert.ok(room.length < 200, "the strip sits directly above the table, so every view carries it");
});

test("a day the header COLLAPSES into one chip is opened back up in the room, release by release", () => {
  /* Alan: "colors flashing like crazy, six … And then I go there … I don't get it." The header has one
     line and is right to collapse; the room has the width and must say which six. */
  const src = slice("function ecRoomModel(nowSec) {", "function ecNudgePaintBox(");
  const fn = new Function("ecNudgeModel", "EC_ROOM_QUEUE_MAX", src + "; return ecRoomModel;")(
    () => [
      { kind: "item", key: "A", it: { event: "Initial Jobless Claims", day: "2026-09-24" }, st: "near" },
      { kind: "swarm", key: "SWARM2026-09-24", day: "2026-09-24", it: {}, st: "swarm",
        group: [{ kind: "item", key: "S1", it: { event: "Fed Williams Speech" }, st: "soon" },
                { kind: "item", key: "S2", it: { event: "New Home Sales" }, st: "ahead" }] },
      { kind: "ahead", key: "AHEAD2026-09-25", day: "2026-09-25", it: {}, st: "cluster",
        group: [{ kind: "item", key: "H1", it: { event: "PCE Price Index" }, st: "ahead" }] },
    ], 8);
  const out = fn(0);
  assert.deepEqual(out.map((m) => m.key), ["A", "SWARM2026-09-24", "S1", "S2", "AHEAD2026-09-25", "H1"],
    "the chip the header flashes is here too — and the releases behind it are named, in order");
  assert.ok(out.filter((m) => m.kind === "item").every((m) => m.it && m.it.event),
    "each named release is a real item, so it carries its own dot, its own state and its own way through");
  const head = slice("function macroNextHTML(nowSec) {", "/* Repaint the queue IN PLACE");
  assert.ok(!/ecRoomModel/.test(head), "the HEADER still collapses — it has one line");
});

test("the room flashes on the TAPE's cadence, not one of its own", () => {
  const pass = slice("function ecRoomScintPass(nowMs, modelIn) {", "function mnScintArm() {");
  assert.match(pass, /ecRoomModel\(nowSec\)/, "the same model the room is showing");
  assert.match(pass, /mnScintPlan\(m\.it, m\.st, nowSec\)/, "same plan");
  assert.match(pass, /scScint\(cell, plan\.tone\)/, "same primitive, same tone");
  assert.match(pass, /plan\.everyMs/, "the cadence comes from the plan, nowhere else");
  assert.ok(!/setInterval|_MS\s*=|everyMs\s*[:=]\s*\d/.test(pass),
    "no new timing constant is invented in the room's pass — it carries the tape's plan, whole");
  assert.match(pass, /document\.visibilityState === "hidden"/, "a hidden tab flashes nothing");
  assert.match(pass, /SCINT_OFF/, "and reduced motion switches it off with everything else");
  const arm = slice("function mnScintArm() {", "function scintPaint() {");
  assert.match(arm, /ecRoomScintPass\(\)/, "it runs on the same 2 s clock as the tape");
  assert.match(arm, /MN_SCINT_TICK_MS/);
});

test("the room keeps its own memory of what it has flashed, and the tape's keys are untouched", () => {
  const mn = slice("function mnScintPass(nowMs, boxIn, modelIn, surface) {", "function ecRoomScintPass");
  assert.match(mn, /const sk = surface \? surface \+ "\|" \+ m\.key : m\.key;/,
    "with no surface the header's keys are exactly what they were");
});

test("what the tape points at and what the room shows are ONE identity", () => {
  const node = slice("function ecNudgeNodeHTML(m, nowSec) {", "/* kept for the suite");
  assert.match(node, /data-esub="' \+ esc\(ecBase\(m\.it\.event\)\)/, "the tape node carries the room's own key");
  const rowFn = slice('  return \'<div class="ec-row ', "\n}");
  assert.match(rowFn, /data-esub="/, "which is the attribute the room's rows carry");
  assert.match(page, /\.ec-row\[data-esub\], \.ec-ev\[data-esub\]/, "and the month chips answer to it too");
});

test("arriving from the tape names the release in the room, and scrolls to it once", () => {
  const focus = slice("function ecFocusPaint() {", "\n}\n");
  assert.match(focus, /classList\.toggle\("is-focus", on\)/);
  assert.match(focus, /f\.scrolled = 1/, "scrolled once, never fighting a reader who is already scrolling");
  assert.match(focus, /\.ec-next \[data-esub\]/, "the queue node is named too, so MONTH has something to point at");
  const goto = slice('    case "mngoto": {', "      break;");
  assert.match(goto, /S\.econFocus = a\.dataset\.esub/, "the trip carries the release's identity");
  const span = slice('    case "ecspan": {', "      break;");
  assert.match(span, /S\.econFocus\) S\.econFocus\.scrolled = 0/, "changing the view keeps the release named");
  const day = slice('    case "ecday": {', "      const d = +a.dataset.d");
  assert.match(day, /S\.econFocus = null/, "moving the calendar by hand lets it go");
});

/* ── the notifications ─────────────────────────────────────────────────────────────────────── */
test("a scintilla lands in the bell as its own kind, de-duped on kind|subject|time", () => {
  const key = slice("  function alertKey(a){", "  function pushAlerts(items){");
  assert.match(key.replace(/\s+/g, ""), /a\.kind\+"\|"\+String\(a\.sub\|\|a\.ticker\|\|""\)\.toUpperCase\(\)\+"\|"\+a\.ts/,
    "re-reading the table cannot post the same scintilla twice");
  const push = slice("  function pushAlerts(items){", "  function poll(){");
  assert.match(push, /if\(news\) chime\(\)/, "a dozen scintillas a day must not train the chime out of him");
  assert.match(push, /alerts\.sort/, "one list, newest first, whatever kind each row is");
});

test("a scintilla notification goes to the PLACE, not to a story", () => {
  const click = slice('    var srow = t.closest && t.closest(".sc-alert--scint");', '    var row = t.closest && t.closest(".sc-alert");');
  assert.match(click, /openCo\(sub\)/, "a price or earnings move opens the company");
  assert.match(click, /S\.econDay = srow\.getAttribute\("data-day"\)/, "a release opens its own day");
  assert.match(click, /S\.econFocus = sub/, "and the room names it when he lands");
  assert.match(click, /go\("ECONOMIC"\)/);
});

test("the page hands the bell its rows through one door, and opens it through another", () => {
  assert.match(page, /window\.scAlertsAdd = function\(items\)/);
  assert.match(page, /window\.scAlertsOpen = function\(\)/);
  assert.match(page, /data-act="scintbell"/, "the one-line strip is what opens it");
  const notify = slice("function scintNotify() {", "\n}\n");
  assert.match(notify, /window\.scAlertsAdd/);
  assert.match(notify, /scintToday\(\)/, "today's rows, not the whole table");
});
