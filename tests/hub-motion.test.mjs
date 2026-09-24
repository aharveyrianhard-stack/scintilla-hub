/* M61 — THE REPLAY PLAYS LIKE THE APPROVED PROPOSAL, and the ECONOMIC room flashes what the
   top tape flashes. Everything here is lifted from the bytes ../index.html ships and run as
   written: no browser, no network, no store. What is pinned is what Alan asked for on 24 Sep —
   "The columns disappear. The Geigers get bigger. And it was just the bars moving" — and what
   must not quietly come back:
     · motion mode hides every column but TICKER and the GEIGER bar, and the bar takes the width;
     · the movement is the proposal's default, SETTLE → REFLOW: values first, then the order;
     · the rank arrow clears after 1400ms, the proposal's own timing;
     · the % change is measured from the window's FIRST day to the frame on screen, green or red;
     · M55's "every column plays its own history" is GONE, including its live-tick freeze;
     · the tick still costs two geometry reads;
     · the room runs the TAPE's own model, plan and primitive, so the two cannot drift. */
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

/* ── motion mode, as the stylesheet ships it ───────────────────────────────────────────────── */
test("motion mode leaves exactly three cells: the star, the TICKER and the GEIGER bar", () => {
  const css = slice("body.gwx-motion .ch{", "/* % PRICE CHANGE over the replayed span");
  const grid = css.match(/body\.gwx-motion \.ch\{[\s\S]*?grid-template-columns:([^;]+)!important/);
  assert.ok(grid, "motion mode must override the board's track list");
  const tracks = grid[1].match(/minmax\([^)]*\)/g) || [];
  assert.equal(tracks.length, 3, "three cells remain, so the grid must be three tracks at every width");
  /* the phone gave the ticker a 25px track and clipped MRVL to "MRVI" until these floors existed */
  assert.match(tracks[0], /minmax\(13px,/, "the star keeps its own 13px");
  assert.match(tracks[1], /minmax\(46px,/, "the ticker never gets less than its 44px cell needs");
  assert.match(css, /body\.gwx-motion \.sc-ctk\{width:auto/);
  const [star, ticker, geiger] = tracks.map((t) => parseFloat(t.match(/([\d.]+)fr/)[1]));
  assert.ok(geiger > 5 * ticker && geiger > 20 * star,
    `the geiger track (${geiger}fr) must take the freed width — ticker ${ticker}fr, star ${star}fr`);

  /* the defect this replaced: nth-child(12) is NOT the Geiger cell at =<560px, because the page
     already display:none's F P/E and READ there, so every later cell shifts two tracks left. */
  assert.equal(/nth-child\(n\+3\)/.test(css), false, "column index is not a safe way to find the bar");
  assert.match(css, /body\.gwx-motion \.ch > \*\{display:none !important\}/);
  assert.match(css, /body\.gwx-motion \.ch > \.gwx-read \+ \*/,
    "the Geiger cell is named by structure: the cell straight after READ");
  assert.match(css, /body\.gwx-motion \.ch > span\[style\*="text-align:center"\]/,
    "including the honest dash a row with no reading draws instead of a bar");
  for (const keep of ["\\.sc-star", "\\.sc-ctk", "\\.gwx-pct", "\\.gwx-rk"])
    assert.match(css, new RegExp("body\\.gwx-motion \\.ch > " + keep));
  assert.match(css, /\.ch\.hdr > \*:first-child[\s\S]{0,120}\[data-key="t"\][\s\S]{0,60}\[data-key="g"\][\s\S]{0,40}display:block/,
    "the header keeps the same three slots, so its labels stay over the right cells");
  assert.match(css, /body\.gwx-motion \.sc-gmini\{height:18px\}/, "the Geigers get bigger");
});

test("the % change sits beside the bar, in its own reserve, and is never a grid item", () => {
  const css = slice(".gwx-pct{", "body.gwx-motion .gwx-pct{opacity:1}");
  assert.match(css, /position:absolute/, "an extra grid item would shift every track");
  const reserve = page.match(/body\.gwx-motion \.sc-board__row, body\.gwx-motion \.ch\.hdr\{padding-right:(\d+)px\}/);
  assert.ok(reserve && +reserve[1] >= 90, "the row must reserve room for the badge and the % together");
  assert.match(page, /@media\(max-width:560px\)\{[\s\S]{0,400}\.gwx-pct\{right:\d+px;width:\d+px/,
    "the phone gets its own, narrower reserve");
});

/* ── the movement itself, run against the bytes ────────────────────────────────────────────── */
const SRC = slice("  var PERF={ticks:0,ms:0,msMax:0",
                  "  /* rank badge — fixed column hard right");

function mkBoard(n, { pitch = 20, rowsVisible = 30 } = {}) {
  const counters = { rects: 0, offsetHeight: 0, cssWrites: 0, css: [] };
  const style = () => { const o = { _css: "" };
    return new Proxy(o, { set(t, k, v) { if (k === "cssText") { counters.cssWrites++; counters.css.push(v); } t[k] = v; return true; } }); };
  const mkRow = (t, i) => {
    const row = { _t: t, _i: i, style: style(), __gwxCss: undefined,
      getAttribute: (k) => (k === "data-t" ? t : null),
      getBoundingClientRect() { counters.rects++; return { top: row._i * pitch, height: pitch }; },
      querySelector(sel) { return sel === ".sc-gmini" ? row._cell : sel === ".sc-ctk" ? row._tick : null; } };
    row._bar = { style: style() };
    row._cell = { querySelector: () => row._bar, appendChild() {} };
    row._tick = { _t: t };
    return row;
  };
  let order = Array.from({ length: n }, (_, i) => "T" + i);
  const rows = order.map(mkRow);
  const bs = { scrollTop: 0,
    get offsetHeight() { counters.offsetHeight++; return 800; },
    getBoundingClientRect() { counters.rects++; return { top: 0, height: rowsVisible * pitch }; },
    querySelectorAll: () => rows.slice().sort((a, b) => a._i - b._i),   // DOM order, like the real one
    appendChild(frag) { const ord = frag._kids.map((r) => r._t); rows.forEach((r) => { r._i = ord.indexOf(r._t); }); order = ord; } };
  return { bs, rows, counters, order: () => order };
}

function harness(board, S, { speedMs = 700 } = {}) {
  const timers = [];
  const classes = new Set();
  const doc = { getElementById: (id) => (id === "boardScroll" ? board.bs : null),
    createDocumentFragment: () => ({ _kids: [], appendChild(n) { this._kids.push(n); } }),
    querySelectorAll: () => [], querySelector: () => null,
    body: { classList: { toggle: (c, on) => { on ? classes.add(c) : classes.delete(c); } } } };
  const src = "var PREV={}, SPEEDS=[['\\u00bd\\u00d7',1400],['1\\u00d7'," + speedMs + "]], SPEED_I=1;\n" + SRC +
    "\nreturn { repaint, motionOn, flushPend, PERF, motion: () => MOTION, dur: motionDur };";
  const api = new Function(
    "E", "S", "computeBoardOrder", "scScint", "paintTM", "badges", "cohortGeigerHTML",
    "cohortCompareStripHTML", "cmpToggle", "document", "window", "clearTimeout", "setTimeout", "performance", src)(
    (id) => (id === "boardScroll" ? board.bs : null), S,
    () => S.rows.slice().sort((a, b) => (b.g == null ? -Infinity : b.g) - (a.g == null ? -Infinity : a.g)).map((r) => r.t),
    () => {}, () => { board.counters.paintTM = (board.counters.paintTM || 0) + 1; }, () => {},
    undefined, undefined, undefined, doc,
    { innerHeight: 600, performance: { now: () => 0 } },
    (h) => { const t = timers.find((x) => x.h === h); if (t) t.cancelled = true; },
    (fn, ms) => { const h = timers.length + 1; timers.push({ h, fn, ms }); return h; },
    { now: () => 0 });
  api.timers = timers; api.classes = classes;
  api.fire = (ms) => { timers.filter((t) => !t.cancelled && !t.done && t.ms === ms).forEach((t) => { t.done = true; t.fn(); }); };
  return api;
}

test("the movement is the proposal's default: the bars settle first, then the rows reflow", () => {
  const board = mkBoard(6);
  const S = { rows: [0, 1, 2, 3, 4, 5].map((i) => ({ t: "T" + i, g: i / 10 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});                                   // live: everything lands in one pass
  assert.deepEqual(board.order(), ["T5", "T4", "T3", "T2", "T1", "T0"]);

  api.motionOn(true);
  assert.equal(api.classes.has("gwx-motion"), true, "the body carries the mode the stylesheet keys off");
  const { v, r } = api.dur();
  assert.equal(v, 231, "settle = 33% of a 700ms day — the proposal's 230ms MEDIUM");
  assert.equal(r, 399, "reflow = 57% of the day — the proposal's 400ms");

  S.rows[0].g = 9;                                   // the last name becomes the leader
  const before = board.counters.cssWrites;
  api.repaint({});
  assert.ok(board.counters.cssWrites > before, "the bars are rewritten immediately — values first");
  assert.match(board.counters.css.at(-1), /transition:left 231ms ease-out/, "and they EASE to their new value");
  assert.equal(board.order()[0], "T5", "the order has NOT moved yet — that is the whole point of settle → reflow");

  api.fire(v + 20);
  assert.equal(board.order()[0], "T0", "the reflow lands one settle later");
  assert.deepEqual(S.boardOrder, board.order());
  assert.equal(api.PERF.last.motion, "settle-reflow");
});

test("a frame that arrives during the settle flushes the reflow it owes, and never skips one", () => {
  const board = mkBoard(5);
  const S = { rows: [0, 1, 2, 3, 4].map((i) => ({ t: "T" + i, g: i / 10 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({}); api.motionOn(true);
  S.rows[0].g = 9;
  api.repaint({});                                   // reflow pending
  assert.equal(board.order()[0], "T4");
  S.rows[1].g = 99;                                  // the next day arrives before the settle finished
  api.repaint({});
  assert.equal(board.order()[0], "T1",
    "the owed reflow ran before this frame measured anything, and it ordered on what is true NOW");
  const settled = board.order().join(",");
  api.fire(api.dur().v + 20);
  assert.equal(board.order().join(","), settled, "this frame's own reflow lands on the same order, not a second jump");
  assert.equal(api.timers.filter((t) => !t.done && !t.cancelled && t.ms === api.dur().v + 20).length, 0,
    "no reflow is left owed");
});

test("motion mode costs the same two geometry reads a tick, and re-measures the pitch when it turns on", () => {
  const n = 364;
  const board = mkBoard(n);
  const S = { rows: Array.from({ length: n }, (_, i) => ({ t: "T" + i, g: (i % 7) / 7 - 0.5 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});
  api.motionOn(true);                                 // taller bars: the old pitch is not true any more
  S.rows.forEach((r, i) => { r.g = Math.sin(i * 2.7); });
  api.repaint({}); api.fire(api.dur().v + 20);
  assert.ok(api.PERF.last.pitchReads > 0, "turning motion on must re-measure the row pitch");
  board.counters.rects = 0; board.counters.offsetHeight = 0;
  S.rows.forEach((r, i) => { r.g = Math.cos(i * 1.3); });
  api.repaint({}); api.fire(api.dur().v + 20);
  const reads = board.counters.rects + board.counters.offsetHeight;
  assert.ok(reads <= 4, `geometry reads per motion tick = ${reads}, expected <= 4 at ${n} rows`);
  assert.equal(api.PERF.last.pitchReads, 0, "a steady tick re-measures nothing");
  assert.equal(api.PERF.last.mode, "pitch");
  assert.equal(api.PERF.last.rows, n);
});

test("the hidden columns are not painted while they are hidden", () => {
  const board = mkBoard(4);
  const S = { rows: [0, 1, 2, 3].map((i) => ({ t: "T" + i, g: i / 10 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});
  const live = board.counters.paintTM;
  assert.ok(live >= 1, "live paints TREND · MOM · READ");
  api.motionOn(true);
  api.repaint({}); api.fire(api.dur().v + 20);
  assert.equal(board.counters.paintTM, live, "motion mode paints no column the reader cannot see");
  api.motionOn(false);
  api.repaint({});
  assert.ok(board.counters.paintTM > live, "LIVE paints them again");
});

/* ── the % change over the replayed span ───────────────────────────────────────────────────── */
const PCT = slice("  var PXC={}, PXQ=[], PXQS={}, PXN=0",
                  "  /* which rows are on screen, from numbers repaint() has ALREADY read - no new reads */");

function pctWorld({ rows, asof, dates, startI = 0, px = {} }) {
  const counters = { rects: 0 };
  const bs = { scrollTop: 0,
    getBoundingClientRect() { counters.rects++; return { top: 0, height: 600 }; },
    querySelectorAll: (sel) => (sel === ".sc-board__row" ? rows.slice() : rows.map((r) => r._pct).filter(Boolean)) };
  const src = "var ASOF=arguments[6], DATES=arguments[7], START_I=arguments[8], SEED=arguments[9];\n" +
    PCT + "\nfor (const k in SEED) PXC[k]=SEED[k];\nreturn { paintPct, pctFor, spanFirst, clearPct, PXC };";
  const api = new Function("E", "document", "setTimeout", "ET_DAY", "SC_CHART_API", "fetch",
    "ASOF_IN", "DATES_IN", "START_IN", "PX_IN", src)(
    (id) => (id === "boardScroll" ? bs : null),
    { createElement: () => ({ className: "", textContent: "", style: {}, attrs: {},
        setAttribute(k, v) { this.attrs[k] = v; }, removeAttribute(k) { delete this.attrs[k]; } }) },
    () => 0, { format: (d) => d.toISOString().slice(0, 10) }, "", () => {},
    asof, dates, startI, px);
  return { api, counters };
}
const mkPctRow = (t) => {
  const row = { _t: t, _pct: null, getAttribute: (k) => (k === "data-t" ? t : null),
    querySelector: (q) => (q === ".gwx-pct" ? row._pct : null),
    appendChild(n) { row._pct = n; } };
  return row;
};
const series = (o) => { const m = { __d: Object.keys(o).sort() }; for (const d in o) m[d] = { c: o[d], p: null }; return m; };

test("the % is measured from the window's FIRST day to the frame on screen, green up and red down", () => {
  const rows = [mkPctRow("AAA"), mkPctRow("BBB")];
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const { api } = pctWorld({ rows, asof: "2026-09-03", dates, startI: 0,
    px: { AAA: series({ "2026-09-01": 100, "2026-09-02": 105, "2026-09-03": 110 }),
          BBB: series({ "2026-09-01": 50, "2026-09-02": 48, "2026-09-03": 45 }) } });
  api.paintPct();
  assert.equal(rows[0]._pct.textContent, "+10.0%");
  assert.equal(rows[0]._pct.style.color, "var(--bull)");
  assert.equal(rows[1]._pct.textContent, "-10.0%");
  assert.equal(rows[1]._pct.style.color, "var(--bear)");
  assert.match(rows[0]._pct.attrs.title, /2026-09-01 → 2026-09-03/);
  assert.ok(!/var\(--mute\)/.test(rows[0]._pct.style.color), "a price move is never drawn grey");
});

test("moving the START handle moves what the % is measured from", () => {
  const rows = [mkPctRow("AAA")];
  const dates = ["2026-09-01", "2026-09-02", "2026-09-03"];
  const px = { AAA: series({ "2026-09-01": 100, "2026-09-02": 200, "2026-09-03": 220 }) };
  const a = pctWorld({ rows, asof: "2026-09-03", dates, startI: 1, px }).api;
  a.paintPct();
  assert.equal(rows[0]._pct.textContent, "+10.0%", "from 2 Sep, not from the whole year");
  assert.equal(a.spanFirst(), "2026-09-02");
});

test("a weekend frame carries the last close instead of blanking, and a real hole stays empty", () => {
  const rows = [mkPctRow("AAA"), mkPctRow("BBB")];
  const dates = ["2026-09-17", "2026-09-18", "2026-09-19"];
  const { api } = pctWorld({ rows, asof: "2026-09-19", dates, startI: 0,   // a Saturday
    px: { AAA: series({ "2026-09-17": 100, "2026-09-18": 120 }),
          BBB: series({ "2026-09-01": 10, "2026-09-02": 11 }) } });        // 17 days stale
  api.paintPct();
  assert.equal(rows[0]._pct.textContent, "+20.0%", "Saturday reads Friday's close");
  assert.equal(rows[1]._pct.textContent, "", "a gap of weeks is a hole, and a hole shows nothing");
});

test("a name whose bars are still in flight waits — it never shows a number it has not got", () => {
  const rows = [mkPctRow("AAA")];
  const { api } = pctWorld({ rows, asof: "2026-09-03", dates: ["2026-09-01", "2026-09-03"], px: {} });
  api.paintPct();
  assert.equal(rows[0]._pct.textContent, "…");
  assert.equal(api.pctFor("AAA", "2026-09-01", "2026-09-03"), undefined);
});

test("the % pass reads no geometry at all", () => {
  const rows = Array.from({ length: 40 }, (_, i) => mkPctRow("T" + i));
  const px = {}; rows.forEach((r) => { px[r._t] = series({ "2026-09-01": 10, "2026-09-03": 11 }); });
  const { api, counters } = pctWorld({ rows, asof: "2026-09-03", dates: ["2026-09-01", "2026-09-03"], px });
  api.paintPct();
  assert.equal(counters.rects, 0);
});

/* ── what M55 left behind, and what must not come back ─────────────────────────────────────── */
test("the rank arrow clears after 1400ms, the proposal's own timing", () => {
  const src = slice("  function badges(before){", "  function play(){");
  assert.match(src, /b\.__hide=setTimeout\(function\(\)\{b\.classList\.remove\("show"\);\},1400\);/);
  assert.match(src, /b\.textContent=\(d>0\?"▲":"▼"\)\+Math\.abs\(d\);/, "positions changed, with a direction");
  assert.match(page, /\.gwx-rk\{position:absolute;right:0/, "in the fixed column, hard right");
});

test("the speed chip sits beside PLAY and says which speed is running", () => {
  const bar = slice("  function bar(){", "  /* say what the window IS");
  const play = bar.indexOf('id="gwxPlay"'), speed = bar.indexOf('id="gwxSpeed"');
  assert.ok(play > 0 && speed > play, "the speed chip is the next control after PLAY");
  assert.match(bar, /id="gwxSpeed"[^>]*>'\+SPEEDS\[SPEED_I\]\[0\]\+'/, "the chip shows the CURRENT speed");
  const speeds = page.match(/var SPEEDS=\[(.+?)\], SPEED_I=(\d+);/);
  assert.ok(speeds, "the speed table must exist");
  assert.ok(/1\\u00d7/.test(speeds[1]) && /2\\u00d7/.test(speeds[1]) && /4\\u00d7/.test(speeds[1]),
    "1x, 2x and 4x are all offered");
  assert.equal(speeds[2], "1", "and the board starts at 1x");
});

test("M55's every-column replay is gone: no column painter, no reasons table, no RSI on the rewind read", () => {
  assert.equal(page.includes("function paintCols("), false, "paintCols() must not come back");
  assert.equal(page.includes("var NOHIST={"), false, "the no-history reasons table went with it");
  assert.equal(page.includes("function waitCell("), false, "the generic waiting writer went with it");
  assert.equal(page.includes("momentum_daily?select=ticker,read,rsi"), false,
    "the rewind no longer asks for a day's RSI it does not paint");
  assert.equal(page.includes("__rsi"), false);
});

test("the live tick is no longer frozen by a rewind — the columns it writes are hidden, not replayed", () => {
  assert.equal(/!scRewoundNow\(\)/.test(page), false,
    "M55's freeze existed so today's price could not sit on a past row; motion mode hides the row instead");
  assert.equal(/scRewoundNow\(\) \? null :/.test(page), false, "and the price-repeat path is not frozen either");
  assert.ok(page.includes("function scRewoundNow()"),
    "the shared reader stays — other painting contexts are handed it — it just gates nothing now");
  assert.match(page, /const sameCell = el\("lc_" \+ t\);/);
});

test("LIVE is one class away: nothing is rebuilt and the cells were never written to", () => {
  const src = slice("  function goLive(){", "  /* FLIP. boardRowsHTML()");
  assert.match(src, /motionOn\(false\);/, "the mode comes off with the rewind");
  assert.match(src, /hasOwnProperty\.call\(LIVE_G,\s*r\.t\)/, "and every snapshotted value goes back, nulls included");
  assert.equal(/innerHTML\s*=\s*boardRowsHTML/.test(src), false, "returning to live must not rebuild the board");
  const seek = slice("  function seek(d, dNext, frac){", "  function seekFetch(d){");
  assert.match(seek, /motionOn\(true\);/, "and it goes on with the first scrubbed frame");
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
