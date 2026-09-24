/* The replay's re-sort, run against the bytes index.html actually ships.
   The module is a closure, so the harness lifts the two functions that do the work
   (measurePitch + repaint) out of it and runs them over a mock board whose every
   geometry read is counted — which is the property the brief asks for: positions are
   read once per tick, never once per row. */
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
const SRC = slice("  var PERF={ticks:0,ms:0,msMax:0",
                  "  /* rank badge — fixed column hard right");

/* ---- the smallest board this code actually touches ---------------------- */
function mkBoard(n, { pitch = 20, rowsVisible = 30 } = {}) {
  const counters = { rects: 0, offsetHeight: 0, cssWrites: 0, scints: [] };
  const style = () => { const o = { _css: "" };
    return new Proxy(o, { set(t, k, v) { if (k === "cssText") counters.cssWrites++; t[k] = v; return true; } }); };
  const mkRow = (t, i) => {
    const row = {
      _t: t, _i: i, style: style(), __gwxCss: undefined,
      getAttribute: (k) => (k === "data-t" ? t : null),
      getBoundingClientRect() { counters.rects++; return { top: row._i * pitch, height: pitch }; },
      querySelector(sel) {
        if (sel === ".sc-gmini") return row._cell;
        if (sel === ".sc-ctk") return row._tick;
        return null;
      },
    };
    row._bar = { style: style() };
    row._cell = { querySelector: () => row._bar, appendChild() {} };
    row._tick = { _t: t };
    return row;
  };
  let order = Array.from({ length: n }, (_, i) => "T" + i);
  const rows = order.map(mkRow);
  const bs = {
    scrollTop: 0,
    get offsetHeight() { counters.offsetHeight++; return 800; },
    getBoundingClientRect() { counters.rects++; return { top: 0, height: rowsVisible * pitch }; },
    querySelectorAll: () => rows.slice(),
    appendChild(frag) { const ord = frag._kids.map((r) => r._t); rows.forEach((r) => { r._i = ord.indexOf(r._t); }); order = ord; },
  };
  return { bs, rows, counters, order: () => order };
}

function harness(board, S, { crossing = true } = {}) {
  const doc = {
    getElementById: (id) => (id === "boardScroll" ? board.bs : null),
    createDocumentFragment: () => ({ _kids: [], appendChild(n) { this._kids.push(n); } }),
    querySelectorAll: () => [],
    querySelector: () => null,
  };
  const src = "var PREV={};\n" + SRC +
    "\nreturn { repaint: repaint, PERF: PERF, PREV: function(){return PREV;}, setPrev: function(p){PREV=p;} };";
  return new Function(
    "E", "S", "computeBoardOrder", "scScint", "paintTM", "badges", "cohortGeigerHTML",
    "cohortCompareStripHTML", "cmpToggle", "document", "window", "clearTimeout", "setTimeout", "performance",
    src)(
    (id) => (id === "boardScroll" ? board.bs : null),
    S,
    () => S.rows.slice().sort((a, b) => (b.g == null ? -Infinity : b.g) - (a.g == null ? -Infinity : a.g)).map((r) => r.t),
    (node, up) => { if (crossing) board.counters.scints.push({ t: node && node._t, up }); },
    () => {}, () => {}, undefined, undefined, undefined,
    doc, { innerHeight: 600, performance: { now: () => 0 } },
    () => {}, () => 0, { now: () => 0 });
}

test("a tick reads geometry a handful of times, never once per row", () => {
  const n = 364;
  const board = mkBoard(n);
  const S = { rows: Array.from({ length: n }, (_, i) => ({ t: "T" + i, g: (i % 7) / 7 - 0.5 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});                       // first tick measures the pitch
  board.counters.rects = 0; board.counters.offsetHeight = 0;
  S.rows.forEach((r, i) => { r.g = Math.sin(i * 2.7); });
  api.repaint({});
  const reads = board.counters.rects + board.counters.offsetHeight;
  assert.ok(reads <= 4, `geometry reads per tick = ${reads}, expected <= 4 at ${n} rows`);
  assert.equal(api.PERF.last.mode, "pitch");
  assert.equal(api.PERF.last.rows, n);
});

test("the rows actually re-sort, by the active sort, as the replayed value changes", () => {
  const board = mkBoard(6);
  const S = { rows: [0, 1, 2, 3, 4, 5].map((i) => ({ t: "T" + i, g: i / 10 })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});
  assert.deepEqual(board.order(), ["T5", "T4", "T3", "T2", "T1", "T0"]);
  S.rows[0].g = 9;                                    // the last name becomes the leader
  api.repaint({});
  assert.equal(board.order()[0], "T0");
  assert.deepEqual(S.boardOrder, board.order());
});

test("a value that crosses zero scintillates once, through the page's own primitive", () => {
  const board = mkBoard(3);
  const S = { rows: [{ t: "T0", g: 0.4 }, { t: "T1", g: -0.4 }, { t: "T2", g: 0.1 }], boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});
  assert.equal(board.counters.scints.length, 0, "a first paint has no baseline, so nothing glows");
  S.rows[0].g = -0.2;        // bull -> bear, a crossing
  S.rows[1].g = -0.9;        // deeper into bear, not a crossing
  S.rows[2].g = 0.3;         // same side
  api.repaint({});
  assert.deepEqual(board.counters.scints, [{ t: "T0", up: false }]);
  S.rows[0].g = 0.2;         // back over the line
  api.repaint({});
  assert.deepEqual(board.counters.scints.at(-1), { t: "T0", up: true });
});

test("rows below the fold are re-ordered but not animated", () => {
  const board = mkBoard(364);                        // 20px pitch, 600px viewport
  const S = { rows: Array.from({ length: 364 }, (_, i) => ({ t: "T" + i, g: -i })), boardOrder: [] };
  const api = harness(board, S);
  api.repaint({});
  S.rows.forEach((r, i) => { r.g = i; });            // full reversal: every row moves
  api.repaint({});
  assert.equal(api.PERF.last.moved, 364, "every row moved");
  assert.ok(api.PERF.last.animated <= 40,
    `animated ${api.PERF.last.animated} rows, expected only the ones on screen`);
});

test("the replay hands the board back to live exactly, nulls included", () => {
  const src = page.slice(page.indexOf("  function goLive(){"), page.indexOf("  /* FLIP. boardRowsHTML()"));
  assert.ok(/hasOwnProperty\.call\(LIVE_G,\s*r\.t\)/.test(src),
    "goLive must restore every ticker it snapshotted, including the ones whose live value is null");
  assert.ok(/PREV=\{\}/.test(src), "the snap back to live must not glow as if it were a market move");
  const play = page.slice(page.indexOf("  function play(){"), page.indexOf("  /* TIMER now holds"));
  assert.ok(/stop\(\);\s*goLive\(\);\s*return;/.test(play), "the end of a replay returns to live");
  assert.ok(/SPEEDS\[SPEED_I\]\[1\]/.test(play), "the play loop runs at the chosen speed");
});
