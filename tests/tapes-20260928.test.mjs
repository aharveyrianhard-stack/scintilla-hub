/* 28 Sep (HUB-TAPES) — the earnings tapes walk the economic tape's rules (drawing, states, window, NOW, NEXT), the old
   drawing is one switch away, the concise tape can replace the bottom EARNINGS band behind a switch that is OFF, and
   TODAY'S SCINTILLAS shows the last session when no session has run today. The code is lifted from index.html and run
   on a FIXED clock in a VM: no network, no store, no browser. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const cut = (a, b) => {
  const i = page.indexOf(a), j = page.indexOf(b, i + 1);
  assert.ok(i > 0 && j > i, "section " + a.slice(0, 40));
  return page.slice(i, j);
};
const ECON = cut("/* ---- Room 9 · ECONOMIC", "/* ---- Room 3 · COMPANY");
const ERN = cut("const ERN_BAND_ON = true;", "/* ============================================================================\n   27 SEP · USUAL DAY + SIGMA EVENTS");
const MNPLAN = cut("const MN_SCINT_SOON_S", "/* the cell that carries the glow");
const ERNPASS = cut("function ernScintPass()", "/* THE BOARD");
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

let SCINT_ROWS = new Map(), GLOWS = [];
function load({ rows = [], today = "2026-09-28", search = "", wild = null } = {}) {
  const ctx = vm.createContext({
    console, setTimeout, URLSearchParams,
    location: { search },
    S: { sec: "EVENTS" }, pg: async () => [], pgErn: async () => [], el: () => null, go: () => {}, prevClose: {},
    document: { querySelectorAll: () => [] },
    todayISO: () => today,
    ernWildResult: (r) => (wild && wild[r.ticker]) || null,
    SCINT_GLOW_CAP: 12, scintKey: (k, sub) => k + "|" + sub, scintBy: () => SCINT_ROWS, scintGlow: (surf, ev, node) => (GLOWS.push(node), true),
  });
  const api = vm.runInContext(escSrc + numSrc + "let UNIVERSE = null;\n" + ECON + ERN + MNPLAN + ERNPASS +
    "\n;({ ernEcItem, ernEcItems, ernEcState, ernEcItemHTML, ernEcTapeHTML, ernNudgeModel, ernNudgeInnerHTML, ernNudgeNodeHTML," +
    " ernLaterHTML, ernEtSec, ecNudgeModel, topTapeHTML, ernNudgeState, mnScintPlan, ernScintPass, ERN_ECON_STYLE_ON, ERN_BOTTOM_NEW_ON, ERN_EC_HUE, ERN_NEXT_CLEARED," +
    " set doc(v) { document = v; }, set rows(v) { ERN_ROWS = v; }, set macro(v) { MACRO_NEXT = v; }, set uni(v) { UNIVERSE = v; } })", ctx);
  api.rows = rows;
  api.macro = [];
  api.uni = new Set(rows.map((r) => r.ticker));
  return api;
}
const MU = { ticker: "MU", date: "2026-09-30", report_time: "AMC", eps_estimate: 31.62 };
const NKE = { ticker: "NKE", date: "2026-10-01", report_time: "AMC", eps_estimate: 0.44 };

/* ── 1 · states: the release's four bands, at the slot ─────────────────────────────────────────────── */
test("an earnings slot walks the release's bands: still → breathing inside the hour → tightening → a hard pulse → past", () => {
  const K = load({ rows: [MU], today: "2026-09-30" });
  const it = K.ernEcItem(MU, "2026-09-30");
  assert.equal(it.ts, ts("2026-09-30T20:05:00Z"), "after the close sits at 16:05 New York time");
  assert.equal(K.ernEcState(it, ts("2026-09-30T18:00:00Z")), "up", "two hours out: still");
  assert.equal(K.ernEcState(it, ts("2026-09-30T19:30:00Z")), "soon", "35 minutes out: breathes");
  assert.equal(K.ernEcState(it, ts("2026-09-30T20:00:00Z")), "near", "5 minutes out: tightens");
  assert.equal(K.ernEcState(it, ts("2026-09-30T20:07:00Z")), "due", "past the slot, no result stored: the hard pulse");
  assert.equal(K.ernEcState(it, ts("2026-09-30T21:10:00Z")), "past", "an hour on, it stops");
  const done = K.ernEcItem({ ...MU, eps_actual: 33.1 }, "2026-09-30");
  assert.equal(K.ernEcState(done, ts("2026-09-30T20:07:00Z")), "past", "a stored result is a printed release: it stops dead");
  const bmo = K.ernEcItem({ ticker: "GIS", date: "2026-10-01", report_time: "BMO" }, "2026-09-30");
  assert.equal(bmo.ts, ts("2026-10-01T11:00:00Z"), "before the open sits at 07:00 New York time");
  assert.equal(K.ernEtSec("2026-12-02", 7 * 60), ts("2026-12-02T12:00:00Z"), "and it follows the clock change");
});
test("a report with no announced time has no minute to count to, so it never flashes", () => {
  const K = load();
  const it = K.ernEcItem({ ticker: "CBRS", date: "2026-09-30", report_time: null }, "2026-09-30");
  assert.equal(it.timed, false);
  for (const iso of ["2026-09-30T13:00:00Z", "2026-09-30T20:07:00Z", "2026-10-01T03:30:00Z"])
    assert.equal(K.ernEcState(it, ts(iso)), "up", iso);
  assert.equal(K.ernEcState(it, ts("2026-10-01T15:00:00Z")), "past", "the next day it is gone");
  assert.equal(it.cdTxt, "today");
});

/* ── 2 · the item is drawn like a release ─────────────────────────────────────────────────────────── */
test("an earnings item is drawn with the release's parts: dot · day + slot · ticker · result in the three colours", () => {
  const K = load({ wild: { COST: { up: true } } });
  const up = K.ernEcItemHTML(K.ernEcItem(MU, "2026-09-28"), "up", "2026-09-28");
  assert.match(up, /class="sc-tape__item ecb-it ern-ec is-up is-high" data-act="row" data-t="MU"/);
  assert.match(up, new RegExp('<span class="ecb-dot" style="color:' + K.ERN_EC_HUE + '">●</span>'));
  assert.match(up, /<span class="ecb-when">WED AMC<\/span><span class="ecb-nm">MU<\/span>/);
  const today = K.ernEcItemHTML(K.ernEcItem(MU, "2026-09-30"), "due", "2026-09-30");
  assert.match(today, /<span class="ecb-when is-today">TODAY AMC<\/span>/);
  assert.match(today, /<span class="ecb-res">now<\/span>/, "at its slot it says now, like a release");
  const cost = { ticker: "COST", date: "2026-09-24", report_time: "AMC", eps_actual: 6.75, eps_estimate: 6.54, surprise_pct: 3.2 };
  const done = K.ernEcItemHTML(K.ernEcItem(cost, "2026-09-28"), "past", "2026-09-28");
  assert.match(done, /ecb-it ern-ec is-past/);
  assert.match(done, /<span class="ecb-res beat"><b>6\.75<\/b> vs 6\.54<\/span>/, "green beat, as the calendar colours it");
  assert.match(done, /<span class="ern-sur beat is-scint" data-up="1">◆\+3\.2%<\/span>/, "beyond its usual surprise: the diamond and the glow");
  assert.equal(K.ERN_EC_HUE, "#D4A72C");
  assert.doesNotMatch(page.match(/const EC_CAT_COLOR = \{[\s\S]*?\};/)[0], /D4A72C/i, "no economic category wears the earnings gold");
});

/* ── 3 · the tape: window, NOW, LATER ─────────────────────────────────────────────────────────────── */
test("the concise tape: the EVENTS tape's window, the NOW marker, and a thin week names what comes after it", () => {
  const later = ["PEP", "APLD", "DAL", "C", "GS", "JPM"].map((t, i) => ({ ticker: t, date: "2026-10-" + String(8 + i).padStart(2, "0"), report_time: "BMO" }));
  const K = load({ rows: [MU, NKE, { ticker: "OLD", date: "2026-09-18", report_time: "BMO" }, ...later] });
  const html = K.ernEcTapeHTML(ts("2026-09-28T13:30:00Z"), "2026-09-28", "ernRoomBand");
  assert.match(html, /^<div class="sc-tape sc-tape--ern sc-tape--ernec" id="ernRoomBand">/);
  const seg = html.slice(0, html.length / 2 + 200);
  assert.ok(seg.indexOf("ec-now--tape") < seg.indexOf('data-t="MU"'), "NOW sits before the first report still to come");
  assert.doesNotMatch(html, /data-t="OLD"/, "last week's report is outside the window");
  assert.match(html, /ecb-wk ern-later[^>]*>LATER</, "two reports in seven days: the tape names the next ones");
  assert.match(html, /ern-ec--later is-up" data-act="row" data-t="PEP"[\s\S]*?THU OCT 8 BMO/);
  assert.match(html, /\+2 more by OCT 13/, "and counts the rest in the three weeks the band reads");
  const busy = load({ rows: ["A", "B", "C", "D", "E", "F"].map((t) => ({ ticker: t, date: "2026-09-30", report_time: "AMC" })) });
  assert.doesNotMatch(busy.ernEcTapeHTML(ts("2026-09-28T13:30:00Z"), "2026-09-28"), /LATER/, "a full week needs no LATER");
  const quiet = load({ rows: later });
  assert.match(quiet.ernEcTapeHTML(ts("2026-09-28T13:30:00Z"), "2026-09-28"),
    /no earnings for the names you track in the next seven days · next PEP THU OCT 8/);
});

/* ── 4 · NEXT: the economic queue's own model ─────────────────────────────────────────────────────── */
test("the earnings NEXT runs the SAME ecNudgeModel: names, a swarm for a heavy day, still until the hour", () => {
  const K = load({ rows: [MU, NKE] });
  const m = K.ernNudgeModel(ts("2026-09-28T13:30:00Z"));
  assert.deepEqual(JSON.parse(JSON.stringify(m.map((x) => [x.kind, x.it.ticker, x.st]))), [["item", "MU", "ahead"], ["item", "NKE", "ahead"]]);
  const inner = K.ernNudgeInnerHTML(m[0].it, m[0].st, ts("2026-09-28T13:30:00Z"));
  assert.match(inner, /<span class="mn-nm">MU<\/span><span class="mn-when">Wed AMC<\/span><span class="mn-cd">in 2d<\/span>/);
  assert.match(K.ernNudgeNodeHTML(m[0], ts("2026-09-28T13:30:00Z")), /^<span class="mn-it s-ahead" data-act="row" data-t="MU"/,
    "a name opens its company");
  const soon = K.ernNudgeModel(ts("2026-09-30T19:30:00Z"));
  assert.equal(soon[0].st, "soon", "inside the hour before its slot it breathes");
  const heavy = load({ rows: ["A", "B", "C", "D"].map((t) => ({ ticker: t, date: "2026-10-01", report_time: "BMO" })) });
  const hm = heavy.ernNudgeModel(ts("2026-09-28T13:30:00Z"));
  assert.equal(hm[0].kind, "swarm", "three or more the same day collapse to dots and a count");
  assert.equal(hm[0].pace, "ahead", "and the dots are still three days out");
  assert.match(heavy.ernNudgeNodeHTML(hm[0], ts("2026-09-28T13:30:00Z")), /data-act="ernday" data-d="2026-10-01"[\s\S]*4 report<\/b>/);
  assert.match(page, /case "ernnextclear":[\s\S]{0,120}ERN_NEXT_CLEARED\[a\.dataset\.k\] = 1; ernNextPaint\(\); break;/);
});
test("with no source the economic queue is exactly what it was", () => {
  const K = load();
  assert.deepEqual(JSON.parse(JSON.stringify(K.ecNudgeModel(ts("2026-09-28T13:30:00Z")))), []);
  assert.match(page, /function ecNudgeModel\(nowSec, src\) \{\n[\s\S]{0,400}const SEEN = src \? src\.seen : ECON_TAPE_SEEN, CLEARED = src \? src\.cleared : ECON_TAPE_CLEARED;/);
});

/* ── 5 · the switches ─────────────────────────────────────────────────────────────────────────────── */
test("one switch each: the new drawing ON by default, the bottom swap OFF by default, both settable from the address", () => {
  assert.match(page, /var ERN_ECON_STYLE_DEFAULT = true;/);
  assert.match(page, /var ERN_BOTTOM_NEW_DEFAULT = false;/, "Alan decides the swap");
  const d = load();
  assert.equal(d.ERN_ECON_STYLE_ON, true); assert.equal(d.ERN_BOTTOM_NEW_ON, false);
  const old = load({ search: "?ernstyle=old" });
  assert.equal(old.ERN_ECON_STYLE_ON, false, "?ernstyle=old puts the 27 Sep drawing back");
  const sw = load({ search: "?ernbottom=new" });
  assert.equal(sw.ERN_BOTTOM_NEW_ON, true, "?ernbottom=new shows the swap");
});
test("the EVENTS tape draws earnings the new way when ON and the 27 Sep way when OFF", () => {
  const on = load({ rows: [MU] }), off = load({ rows: [MU], search: "?ernstyle=old" });
  const now = ts("2026-09-28T13:30:00Z");
  assert.match(on.topTapeHTML(now, "2026-09-28"), /ecb-it ern-ec is-up is-high" data-act="row" data-t="MU"[\s\S]*?WED AMC/);
  assert.match(off.topTapeHTML(now, "2026-09-28"), /ern-it is-up ern-t-week" data-act="row" data-t="MU"/);
  assert.doesNotMatch(off.topTapeHTML(now, "2026-09-28"), /ern-ec/);
});
test("the wiring: the room tape carries NEXT, the bottom band swaps behind its switch, one tick paints all of it", () => {
  const room = cut("function renderErnRoomTape(nowSec) {", "\n}\n");
  assert.match(room, /ERN_ECON_STYLE_ON/);
  assert.match(room, /ernRoomEcHTML\(nowSec\)/);
  assert.match(page, /<span class="sc-macronext sc-toptape__next" id="ernNext"><\/span>/);
  const band = cut("function renderErnBand() {", "\nasync function ernRead()");
  assert.match(band, /ERN_BOTTOM_NEW_ON && typeof renderErnBandNew === "function"/);
  assert.match(cut("function renderErnBandNew(nowSec) {", "\n}\n"), /ernEcTapeHTML\(nowSec, null, "ernBand"\)/,
    "the swapped band keeps the id the bottom band always had");
  assert.match(cut("function ecTapePaint(nowSec) {", "\n}\n"), /ernEcPaint\(nowSec\)/, "on the economic tape's 15 s tick");
  assert.match(cut("function mnScintArm() {", "\n}\n"), /ernNextScintPass\(\)/, "and the NEXT flashes on the same 2 s clock");
  const block = cut("28 SEP · EARNINGS WALK", "27 SEP · USUAL DAY + SIGMA EVENTS");
  assert.doesNotMatch(block, /\bpg\(|pgErn\(|fetch\(/, "nothing new is read");
});

/* ── 6 · TODAY'S SCINTILLAS on a day with no session ──────────────────────────────────────────────── */
function strip(nowIso, rows) {
  const LAYER = cut("/* ── M42 SCINTILLAS — the glow becomes a signal", "function scSetTitle (node, value) {");
  const GS = cut("var GS_NYSE_HOLIDAYS = [", "function gsExpectedSettledSession(");
  const now = Date.parse(nowIso);
  const src = GS + "const UD_KINDS = [\"price_outlier\", \"earnings_surprise\", \"econ_surprise\"];\nconst COHSETS = null;\n" + LAYER +
    "\nreturn { scintStripHTML, scintSessionToday, scintLastSession, setRows: (r) => { SCINT_ROWS = r; SCINT_BY = null; } };";
  const api = new Function("document", "ET_DAY", "ET_HM", "todayISO", "esc", "fmtC", "el", "scScint", "pg", "setInterval", "Date", src)(
    { visibilityState: "visible", querySelectorAll: () => [], addEventListener: () => {}, documentElement: {} },
    new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }),
    new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(new Date(now)),
    (s) => String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"),
    (v) => (v >= 0 ? "+" : "") + Number(v).toFixed(2) + "%", () => null, () => {}, async () => [], () => 1,
    class FakeDate extends Date { constructor(...a) { super(...(a.length ? a : [now])); } static now() { return now; } });
  api.setRows(rows);
  return api;
}
const ev = (tsIso, o = {}) => ({ ts: tsIso, kind: "price_outlier", subject: "UNH", subject_kind: "ticker", direction: 1, magnitude: 2.6,
  detail: { move_pct: 3.95, daily_vol_pct: 1.5, n_days: 88 }, ...o });
const FRI = [ev("2026-09-25T20:50:00Z"), ev("2026-09-25T15:50:00Z", { subject: "CME", direction: -1 }),
  ev("2026-09-25T14:00:00Z", { subject: "CPI", kind: "econ_imminent", subject_kind: "econ" })];
test("a closed day says so and shows the last session, counted as USUAL DAY counts it — never a bare 0", () => {
  const sun = strip("2026-09-27T18:00:00Z", FRI);
  assert.deepEqual(JSON.parse(JSON.stringify(sun.scintSessionToday(Date.parse("2026-09-27T18:00:00Z")))),
    { ran: false, date: "2026-09-27", why: "market closed" });
  const html = sun.scintStripHTML();
  assert.match(html, /<span class="sc-ss__lbl">SCINTILLAS<\/span>/, "not TODAY'S — it is not today's");
  assert.match(html, /<span class="sc-ss__why">market closed<\/span><span class="sc-ss__n">Fri 25 Sep: 2 scintillas<\/span>/,
    "the about-to-print notice is left out, as in USUAL DAY");
  assert.match(html, /data-act="scintlast" data-day="2026-09-25"/, "tap: that day in USUAL DAY");
  assert.match(html, /<span class="sc-ss__w">UNH<\/span>/, "the newest one of that day");
  assert.doesNotMatch(html, /nothing has moved further than its own history today/);
  assert.match(page, /case "scintlast": \{ S\.udCohPick = null; S\.udDay = a\.dataset\.day \|\| null; go\("USUAL"\); break; \}/);
});
test("before the open it says so too; once the session has run, an empty day is still an honest 0", () => {
  const pre = strip("2026-09-28T12:00:00Z", FRI);                     // Monday 08:00 ET
  assert.match(pre.scintStripHTML(), /before the open<\/span><span class="sc-ss__n">Fri 25 Sep: 2 scintillas/);
  const open = strip("2026-09-28T15:00:00Z", FRI);                    // Monday 11:00 ET, nothing stored today
  assert.equal(open.scintLastSession(Date.parse("2026-09-28T15:00:00Z")), null);
  assert.match(open.scintStripHTML(), /TODAY’S SCINTILLAS<\/span><span class="sc-ss__n">0<\/span>[\s\S]*nothing has moved further than its own history today/);
  const holiday = strip("2026-11-26T16:00:00Z", [ev("2026-11-25T16:00:00Z")]);   // Thanksgiving
  assert.match(holiday.scintStripHTML(), /market closed<\/span><span class="sc-ss__n">Wed 25 Nov: 1 scintilla</);
  const quietFri = strip("2026-09-27T18:00:00Z", []);
  assert.match(quietFri.scintStripHTML(), /market closed<\/span><span class="sc-ss__d">Fri 25 Sep: nothing moved further than its own history/);
});

/* ── 7 · review fixes (28 Sep) ────────────────────────────────────────────────────────────────────── */
/* a node as ernScintPass meets it: its classes, its data-t, and the cells it can pick for the glow */
function fakeItem(cls, t, cells) {
  const set = new Set(cls.split(" "));
  return { dataset: { t }, classes: set, classList: { add: (c) => set.add(c) },
    querySelector: (sel) => (cells.includes(sel) ? { cell: sel } : null) };
}
test("a stored earnings surprise glows on an item in the new drawing — the EVENTS tape, the room's tape, the bottom swap", () => {
  const K = load({ rows: [MU] });
  const html = K.ernEcItemHTML(K.ernEcItem({ ...MU, eps_actual: 33.1 }, "2026-09-30"), "past", "2026-09-30");
  assert.match(html, /class="sc-tape__item ecb-it ern-ec is-past is-high" data-act="row" data-t="MU"/, "the node the pass must find");
  assert.match(html, /<span class="ecb-res /, "with a result cell to carry the glow");
  const printed = fakeItem("sc-tape__item ecb-it ern-ec is-past is-high", "MU", [".ecb-res", ".ecb-nm"]);
  const coming = fakeItem("sc-tape__item ecb-it ern-ec is-up is-high", "NKE", [".ecb-nm"]);
  const other = fakeItem("sc-tape__item ecb-it ern-ec is-up is-high", "GIS", [".ecb-nm"]);
  let asked = "";
  K.doc = { querySelectorAll: (sel) => { asked = sel; return /\.ern-ec\[data-t\]/.test(sel) ? [printed, coming, other] : []; } };
  SCINT_ROWS = new Map([["earnings_surprise|MU", { kind: "earnings_surprise", subject: "MU" }],
                        ["earnings_surprise|NKE", { kind: "earnings_surprise", subject: "NKE" }]]);
  GLOWS = [];
  assert.equal(K.ernScintPass(), 2);
  assert.match(asked, /\.ern-it\[data-t\], \.ern-ec\[data-t\], \.sc-evrow\[data-t\]/, "the old drawing and the timeline are still read");
  assert.ok(printed.classes.has("is-scint") && coming.classes.has("is-scint"), "both stored surprises wear is-scint");
  assert.ok(!other.classes.has("is-scint"), "a name with no stored surprise does not");
  assert.deepEqual(GLOWS.map((g) => g.cell), [".ecb-res", ".ecb-nm"], "the glow lands on the result, or on the ticker");
  /* every surface that rebuilds new-style items runs the pass after it, as renderErnBand always has (M42) */
  for (const fn of ["function renderErnRoomTape(", "function renderErnBandNew(", "function renderTopTape("]) {
    const body = page.slice(page.indexOf(fn), page.indexOf("\n}\n", page.indexOf(fn)));
    assert.match(body, /ernScintPass\(\)/, fn + " runs ernScintPass after it redraws");
  }
  assert.match(page, /\.ern-ec\.is-scint \.ecb-nm/, "the ticker of a new-style item glows like the old one's");
});
test("a report with no announced time never counts down in NEXT — not with a result stored, not in a swarm", () => {
  const K = load();
  const WFC = { ticker: "WFC", date: "2026-10-13", report_time: null, eps_estimate: 1.55 };
  const done = K.ernEcItem({ ...WFC, eps_actual: 1.6 }, "2026-10-13");
  const seen = ts("2026-10-13T13:50:00Z");
  assert.equal(K.ernEcState(done, ts("2026-10-13T14:00:00Z")), "past", "the tape draws it as printed");
  assert.equal(K.ernNudgeState(done, ts("2026-10-13T14:00:00Z"), seen), "landed", "NEXT: it lands, it is not upcoming");
  for (const iso of ["2026-10-13T14:30:00Z", "2026-10-14T03:10:00Z", "2026-10-14T03:55:00Z"])
    assert.equal(K.ernNudgeState(done, ts(iso), seen), "gone", iso + " — never soon, never near");
  /* the reviewer's exact case, a page opened late that evening: the printed result lands ONCE (its one glow, as a
     release's number does) and never enters the soon / near countdown */
  for (const iso of ["2026-10-14T03:10:00Z", "2026-10-14T03:55:00Z"]) {
    const st = K.ernNudgeState(done, ts(iso), ts(iso) - 60);
    assert.equal(st, "landed", iso);
    const plan = K.mnScintPlan(done, st, ts(iso));
    assert.equal(plan.phase, "landed"); assert.equal(plan.once, true, "one glow, not a pulse");
  }
  const open = K.ernEcItem(WFC, "2026-10-13");
  assert.equal(K.ernNudgeState(open, ts("2026-10-14T03:55:00Z"), undefined), "ahead", "no result, no time: still, named");
  assert.equal(K.mnScintPlan(open, "ahead", ts("2026-10-14T03:55:00Z")), null);
  /* a swarm led by an untimed report plans no glow at any minute of its day */
  for (const iso of ["2026-10-14T03:50:00Z", "2026-10-14T03:58:00Z", "2026-10-14T04:00:30Z"])
    assert.equal(K.mnScintPlan(open, "swarm", ts(iso)), null, iso);
  const sw = load({ rows: ["BLK", "WFC", "PGR"].map((t) => ({ ticker: t, date: "2026-10-13", report_time: null })), today: "2026-10-13" });
  const m = sw.ernNudgeModel(ts("2026-10-14T03:55:00Z"));
  assert.equal(m[0].kind, "swarm");
  assert.equal(m[0].pace, "ahead", "its dots stay still");
  assert.equal(sw.mnScintPlan(m[0].it, m[0].st, ts("2026-10-14T03:55:00Z")), null, "and it never glows");
  /* a timed report and an economic release still count down exactly as before */
  const mu = K.ernEcItem(MU, "2026-09-30");
  assert.equal(K.mnScintPlan(mu, "soon", ts("2026-09-30T19:55:00Z")).phase, "soon");
  assert.equal(K.mnScintPlan({ ts: ts("2026-09-30T12:30:00Z") }, "due", ts("2026-09-30T12:31:00Z")).phase, "due");
  /* a timed report whose result is stored before its conventional slot lands, it does not keep counting */
  const early = K.ernEcItem({ ...MU, eps_actual: 33.1 }, "2026-09-30");
  assert.equal(K.ernNudgeState(early, ts("2026-09-30T20:03:00Z"), ts("2026-09-30T20:02:00Z")), "landed");
});
