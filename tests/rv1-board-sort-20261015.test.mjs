// RV1 (15 Oct) — the cohort board's RVOL column ranks the rows by the number beside the battery, and nothing re-ranks them
// behind that header. BRIEF-20261015-RV1. Alan, 15 Oct ~20:45 ET: "I tried ranking the dashboard cohort board table by the
// relative volume. And it does move something, but it kind of like doesn't really re-rank by volume, high or low."
// MEASURED on scintillahub.ai @7b66061 (headless, real clicks): a plain click ranked correctly and held through the 45 s pulls.
// The REWIND broke it: its repaint ranks the rows by the replayed Geiger whatever the board is sorted on (24 Sep, by design
// while rewound), and goLive() ran that same repaint after clearing ASOF, so every return to LIVE (↻ LIVE, Esc, the 45 s idle
// return, the end of a replay) left the rows in Geiger order under "RVol ▼" until the next 45 s pull.
// The page's own functions are run here (extracted from index.html), never re-typed copies.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const fn = (name) => page.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
function slice(from, to) {
  const a = page.indexOf(from);
  assert.ok(a >= 0, "missing: " + from);
  const b = page.indexOf(to, a);
  assert.ok(b > a, "missing: " + to);
  return page.slice(a, b);
}
const num = new Function(page.match(/^const num = [^\n]*/m)[0] + "\nreturn num;")();   // the line ends in a // comment
const esc = new Function("return " + page.match(/const esc = ([\s\S]*?);\nconst el = /)[1])();
const rb = new Function("return " + page.match(/^const rb = ([^\n]*);/m)[1])();
const RVOL_MAX_AGE_MS = new Function(page.match(/^const RVOL_MAX_AGE_MS = [^\n]*/m)[0] + "; return RVOL_MAX_AGE_MS;")();
const scRvolCurrent = new Function("RVOL_MAX_AGE_MS", fn("scRvolCurrent") + "; return scRvolCurrent;")(RVOL_MAX_AGE_MS);
const volCellHTML = new Function("rb", "esc", fn("volCellHTML") + "; return volCellHTML;")(rb, esc);

/* the board row's own three volume fields, as fetchBoardRows builds them from board_volume */
const field = (name) => page.match(new RegExp("        " + name + ":\\s+\\(function \\(\\) \\{[\\s\\S]*?\\}\\)\\(\\),\\n"))[0]
  .trim().replace(new RegExp("^" + name + ":\\s*"), "").replace(/,$/, "");
const RV = field("rv"), RVS = field("rvS"), RVAT = field("rvAsOf");
const rowOf = (BOARDVOL, t, g) => {
  const make = (src) => new Function("BOARDVOL", "m", "num", "scRvolCurrent", "return " + src)(BOARDVOL, { ticker: t }, num, scRvolCurrent);
  return { t, g, rv: make(RV), rvS: make(RVS), rvAsOf: make(RVAT) };
};

/* tonight's shape: board_volume 15 Oct 20:00 ET (RSPH 4.87, CRWV 3.91 … from the coordinator's read), plus every edge the cell
   has — a pace of 10 or more printed without its decimal, two paces that print alike, a zero, a numeric string, a name with only
   the whole-session figure (battery, no number), a July row (stale), and a name with no row at all */
const now = new Date().toISOString();
const BOARDVOL = {
  RSPH: { rvol_at_time: 4.87, session_rvol: 4.1, updated_ts: now },
  CRWV: { rvol_at_time: 3.91, session_rvol: 3.3, updated_ts: now },
  BIGR: { rvol_at_time: 12.3, session_rvol: 9.0, updated_ts: now },     // "12×"
  TENR: { rvol_at_time: 10.2, session_rvol: 8.0, updated_ts: now },     // "10×"
  NEAR: { rvol_at_time: 9.96, session_rvol: 7.0, updated_ts: now },     // "10.0×"
  ONEA: { rvol_at_time: 1.04, session_rvol: 0.9, updated_ts: now },     // "1.0×"
  ONEB: { rvol_at_time: 0.96, session_rvol: 0.8, updated_ts: now },     // "1.0×"
  STRN: { rvol_at_time: "2.5", session_rvol: "2.0", updated_ts: now },  // PostgREST numeric as a string
  ZERO: { rvol_at_time: 0, session_rvol: 0, updated_ts: now },          // "0.0×" is a number, not a dash
  SESS: { rvol_at_time: null, session_rvol: 1.2, updated_ts: now },     // battery charged, no number
  JULY: { rvol_at_time: 9.9, session_rvol: 9.9, updated_ts: "2026-07-06T18:03:29Z" },
};
/* arrival order, and Geiger values deliberately unrelated to the volume (the replay ranks by these) */
const T = ["JULY", "ONEA", "NONE", "CRWV", "SESS", "ZERO", "RSPH", "BIGR", "ONEB", "STRN", "TENR", "NEAR"];
const G = { JULY: 0.9, ONEA: 0.8, NONE: 0.7, CRWV: -0.7, SESS: 0.6, ZERO: 0.5, RSPH: -0.2, BIGR: -0.5, ONEB: 0.4, STRN: 0.1, TENR: 0.3, NEAR: 0.2 };
const ROWS = () => T.map((t) => rowOf(BOARDVOL, t, G[t]));

const computeBoardOrderFor = (S, window) =>
  new Function("S", "window", "num", fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + "\nreturn computeBoardOrder;")(S, window, num);

/* what the board PRINTS beside the battery for a row, through the page's own cell: a number, or null for a dash */
const shownOf = (r) => {
  const m = volCellHTML(r.rv, r.rvS, r.rvAsOf).match(/<span class="sc-vol__n">([^<]*)<\/span>/);
  assert.ok(m, "every row draws the number slot");
  const v = parseFloat(m[1]);
  return Number.isFinite(v) ? v : null;
};
/* the rule Alan asked for, as one check: the printed numbers step one way only, and every dash is below every number */
function assertRanked(order, rows, dir, what) {
  const byT = Object.fromEntries(rows.map((r) => [r.t, r]));
  const shown = order.map((t) => shownOf(byT[t]));
  const firstDash = shown.indexOf(null);
  if (firstDash >= 0) assert.ok(shown.slice(firstDash).every((v) => v == null), what + ": a number below a dash: " + order.join(" "));
  const nums = shown.filter((v) => v != null);
  for (let i = 1; i < nums.length; i++)
    assert.ok(dir < 0 ? nums[i] <= nums[i - 1] : nums[i] >= nums[i - 1],
      what + ": " + nums[i - 1] + " then " + nums[i] + " (" + order.join(" ") + ")");
  return shown;
}

test("RVol high→low is monotone in the number shown beside the battery; names with no number last", () => {
  const rows = ROWS();
  const order = computeBoardOrderFor({ sort: { key: "rv", dir: -1 }, rows }, { SC_RANK_READY: true })();
  const shown = assertRanked(order, rows, -1, "high to low");
  assert.deepEqual(order, ["BIGR", "TENR", "NEAR", "RSPH", "CRWV", "STRN", "ONEA", "ONEB", "ZERO", "JULY", "NONE", "SESS"]);
  assert.deepEqual(shown, [12, 10, 10, 4.9, 3.9, 2.5, 1, 1, 0, null, null, null]);
  /* the dashes keep their arrival order among themselves (JULY, NONE, SESS arrived in that order) */
});

test("the second click: low→high, still monotone in the shown number, and the dashes still last", () => {
  const rows = ROWS();
  const order = computeBoardOrderFor({ sort: { key: "rv", dir: 1 }, rows }, { SC_RANK_READY: true })();
  assertRanked(order, rows, 1, "low to high");
  assert.deepEqual(order.slice(-3), ["JULY", "NONE", "SESS"]);
  assert.equal(order[0], "ZERO");
});

test("the board DRAWS that order: the click stores it, and the rows are rendered from it", () => {
  const rows = ROWS();
  const S = { sort: { key: "g", dir: -1 }, rows, boardOrder: [], tq: "" };
  const win = { SC_RANK_READY: true };
  const api = new Function("S", "window", "num", "updateBoard", "ALLROWS",
    fn("boardSortValue") + fn("boardSortNumber") + fn("computeBoardOrder") + fn("sortBoardBy") + fn("orderedShownRows") +
    "\nreturn { sortBoardBy, orderedShownRows };")(S, win, num, () => {}, []);
  api.sortBoardBy("rv");
  assertRanked(api.orderedShownRows().map((r) => r.t), rows, -1, "drawn, first click");
  api.sortBoardBy("rv");
  assertRanked(api.orderedShownRows().map((r) => r.t), rows, 1, "drawn, second click");
});

/* ── THE CAUSE: the rewind's repaint, run against the bytes ────────────────────────────────────────────────────────────── */
const SRC = slice("  var PERF={ticks:0,ms:0,msMax:0", "  /* rank badge — fixed column hard right");
function mkBoard(tickers, pitch = 20) {
  const mkRow = (t, i) => {
    const row = { _t: t, _i: i, style: {}, getAttribute: (k) => (k === "data-t" ? t : null),
      getBoundingClientRect: () => ({ top: row._i * pitch, height: pitch }),
      querySelector: (sel) => (sel === ".sc-gmini" ? row._cell : null) };
    row._bar = { style: {} };
    row._cell = { querySelector: () => row._bar, appendChild() {} };
    return row;
  };
  let order = tickers.slice();
  const rows = order.map(mkRow);
  const bs = { scrollTop: 0, offsetHeight: 800,
    getBoundingClientRect: () => ({ top: 0, height: 600 }),
    querySelectorAll: () => rows.slice().sort((a, b) => a._i - b._i),
    appendChild(frag) { const ord = frag._kids.map((r) => r._t); rows.forEach((r) => { r._i = ord.indexOf(r._t); }); order = ord; } };
  return { bs, order: () => order };
}
/* asof: the rewound day (a replayed day) or null (LIVE: goLive() clears ASOF before its repaint) */
function rewindRepaint(S, board, asof) {
  const doc = { getElementById: (id) => (id === "boardScroll" ? board.bs : null),
    createDocumentFragment: () => ({ _kids: [], appendChild(n) { this._kids.push(n); } }),
    querySelectorAll: () => [], querySelector: () => null, body: { classList: { toggle() {} } } };
  const win = { innerHeight: 600, performance: { now: () => 0 }, SC_RANK_READY: true };
  return new Function("E", "S", "computeBoardOrder", "scScint", "paintTM", "badges", "document", "window", "clearTimeout", "setTimeout", "performance",
    "var PREV={}, ASOF=" + JSON.stringify(asof) + ";\n" + SRC + "\nreturn repaint;")(
    (id) => (id === "boardScroll" ? board.bs : null), S, computeBoardOrderFor(S, win),
    () => {}, () => {}, () => {}, doc, win, () => {}, () => 0, { now: () => 0 });
}

test("back to LIVE after a rewind, the board ranks by ITS OWN sort (RVol), not the replay's Geiger", () => {
  const rows = ROWS();
  const S = { sort: { key: "rv", dir: -1 }, rows, boardOrder: [] };
  const board = mkBoard(T);
  rewindRepaint(S, board, null)({});                                  // the repaint goLive() runs
  assertRanked(S.boardOrder, rows, -1, "LIVE after the rewind");
  assert.deepEqual(board.order(), S.boardOrder, "the rows on the board are moved into that order");
  assert.deepEqual(S.sort, { key: "rv", dir: -1 }, "the header's sort is the one used");
});

test("while rewound the replay still ranks by the Geiger alone (24 Sep), and leaves the board's sort untouched", () => {
  const rows = ROWS();
  const S = { sort: { key: "rv", dir: -1 }, rows, boardOrder: [] };
  const board = mkBoard(T);
  rewindRepaint(S, board, "2026-09-24")({});
  const byG = rows.slice().sort((a, b) => b.g - a.g).map((r) => r.t);
  assert.deepEqual(S.boardOrder, byG);
  assert.deepEqual(board.order(), byG);
  assert.deepEqual(S.sort, { key: "rv", dir: -1 });
});

test("goLive() clears ASOF before its repaint, so that repaint is a LIVE one", () => {
  const src = slice("  function goLive(){", "  /* FLIP. boardRowsHTML()");
  const cleared = src.indexOf("ASOF=null"), painted = src.indexOf("repaint(before)");
  assert.ok(cleared > 0 && painted > cleared, "ASOF=null must come before repaint(before) in goLive()");
});

test("while rewound the RVol header is not on the board, so the return to LIVE is where its order comes back", () => {
  /* motion mode (body.gwx-motion, on for as long as the board is rewound) hides every column but the ticker and the Geiger
     bar, headers included: a rewound board cannot be re-sorted by RVol, and the fix above is the whole path */
  const css = slice("body.gwx-motion .ch > *{display:none !important}", "body.gwx-motion .sc-board__row, body.gwx-motion .ch.hdr{");
  assert.match(css, /\.ch\.hdr > \[data-key="t"\],\s*body\.gwx-motion \.ch\.hdr > \[data-key="g"\]\{display:block !important\}/);
  assert.doesNotMatch(css, /data-key="rv"/, "the RVol header stays hidden while rewound");
  const seek = slice("  function seek(d, dNext, frac){", "  var DAYQ={};");
  assert.match(seek, /ASOF=d;[\s\S]*motionOn\(true\)/, "every rewound day turns motion mode on");
  const live = slice("  function goLive(){", "  /* FLIP. boardRowsHTML()");
  assert.match(live, /ASOF=null;[\s\S]*motionOn\(false\)/, "and the return to LIVE turns it off");
});
