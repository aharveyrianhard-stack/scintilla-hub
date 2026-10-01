/* 1 Oct (H3) — the two tapes renamed and reorganised (EARNINGS, one day at a time; ECONOMIC slides through a heavy day's
   releases; how heavy a day is, against the last 60 days), and the company chart's Station treatment (five timeframes, the
   context lens, the pane's top row no longer cut off). The code is lifted from index.html and run on a FIXED clock in a VM:
   no network, no store, no browser. */
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
const BANNER = "/* ============================================================================\n   ";
const ECON = cut("/* ---- Room 9 · ECONOMIC", "/* ---- Room 3 · COMPANY");
const ERN = cut("const ERN_BAND_ON = true;", BANNER + "27 SEP · USUAL DAY + SIGMA EVENTS");
const H3 = cut(BANNER + "1 OCT · H3 · THE TWO TAPES", BANNER + "R24 — CHAT AGENT");
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

function load({ rows = [], macro = [], today = "2026-10-01", search = "" } = {}) {
  const ctx = vm.createContext({
    console, setTimeout, URLSearchParams,
    location: { search },
    S: { sec: "DASHBOARD" }, pg: async () => [], pgErn: async () => [], el: () => null, go: () => {}, prevClose: {},
    document: { querySelectorAll: () => [] },
    todayISO: () => today,
    ernWildResult: () => null,
  });
  const api = vm.runInContext(escSrc + numSrc + "let UNIVERSE = null;\n" + ECON + ERN + H3 +
    "\n;({ dayWeight, ernTapeDay, ernDayTapeHTML, topTapeHTML, ecNudgeModel, ecSwarmInnerHTML, ecAheadInnerHTML, ecSwarmCycHTML," +
    " mnCycIndex, mnLblHTML, macroNextHTML, H3_TAPES_ON," +
    " set rows(v) { ERN_ROWS = v; }, set macro(v) { MACRO_NEXT = v; }, set uni(v) { UNIVERSE = v; }," +
    " set ecHist(v) { EC_DAY_HIST = v; }, set ernHist(v) { ERN_DAY_HIST = v; } })", ctx);
  api.rows = rows;
  api.macro = macro;
  api.uni = new Set(rows.map((r) => r.ticker));
  return api;
}
const ACN = { ticker: "ACN", date: "2026-10-01", report_time: "BMO", eps_estimate: 3.18 };
const NKE = { ticker: "NKE", date: "2026-10-01", report_time: "AMC", eps_estimate: 0.44 };
const PEP = { ticker: "PEP", date: "2026-10-08", report_time: "BMO", eps_estimate: 2.3 };
const DAL = { ticker: "DAL", date: "2026-10-09", report_time: "BMO", eps_estimate: 1.5 };
const rel = (iso, event, impact, estimate, previous, actual) =>
  ({ event_ts: ts(iso), country: "US", event, impact, estimate: estimate == null ? null : String(estimate), previous: previous == null ? null : String(previous), actual: actual == null ? null : String(actual) });
/* Thursday 1 Oct, as the calendar had it: four releases the same day, named out of time order on purpose */
const THU = [
  rel("2026-10-01T14:00:00Z", "ISM Manufacturing PMI", "High", 55, 54.6),
  rel("2026-10-01T12:30:00Z", "Initial Jobless Claims", "High", 200, 197),
  rel("2026-10-01T13:05:00Z", "Fed Barkin Speech", "Medium"),
  rel("2026-10-01T19:00:00Z", "Fed Bowman Speech", "Medium"),
];
/* 60 earlier days: 1, 2, 3 … 6 releases a day, ten days of each */
function hist(n = 60, from = "2026-07-01") {
  const counts = {}; const d = new Date(from + "T12:00:00Z");
  for (let i = 0; i < n; i++) { counts[d.toISOString().slice(0, 10)] = 1 + (i % 6); d.setUTCDate(d.getUTCDate() + 1); }
  return counts;
}

/* ── how heavy a day is ─────────────────────────────────────────────────────────────────────────── */
test("heavy / normal / light is where the day's count sits among the last 60 days that had any — no fixed number", () => {
  const K = load(), c = hist();
  assert.equal(K.dayWeight(c, "2026-10-01", 10, "2026-10-01").word, "heavy", "more than any of the 60");
  assert.equal(K.dayWeight(c, "2026-10-01", 1, "2026-10-01").word, "light", "the fewest");
  assert.equal(K.dayWeight(c, "2026-10-01", 4, "2026-10-01").word, "normal", "the middle");
  const w = K.dayWeight(c, "2026-10-01", 10, "2026-10-01");
  assert.equal(w.days, 60); assert.equal(w.pct, 1);
  assert.equal(K.dayWeight({ ...c, "2026-06-01": 99 }, "2026-10-01", 10, "2026-10-01").days, 60, "only the last 60 count");
  assert.equal(K.dayWeight({ "2026-09-30": 3 }, "2026-10-01", 10, "2026-10-01"), null, "under 20 days of history: no word at all");
  assert.equal(K.dayWeight({ ...c, "2026-10-01": 50, "2026-10-02": 50 }, "2026-10-02", 3, "2026-10-01").days, 60,
    "a day still to come is judged against the days before today, never against today or itself");
  assert.equal(K.dayWeight(c, "2026-10-01", 0, "2026-10-01"), null);
});

/* ── EARNINGS ───────────────────────────────────────────────────────────────────────────────────── */
test("EARNINGS sticks to today, in time order, and carries the day's count and weight", () => {
  const K = load({ rows: [NKE, PEP, ACN, DAL] });
  K.ernHist = { day: "2026-10-01", counts: hist() };
  const now = ts("2026-10-01T15:00:00Z");   // 11:00 ET
  const p = K.ernTapeDay(now, "2026-10-01");
  assert.equal(p.day, "2026-10-01"); assert.equal(p.rolled, false);
  assert.deepEqual(p.items.map((x) => x.ticker), ["ACN", "NKE"], "before the open, then after the close");
  const html = K.ernDayTapeHTML(now, "2026-10-01");
  assert.match(html, />EARNINGS →<\/b>/);
  assert.doesNotMatch(html, />EVENTS →</);
  assert.match(html, /TODAY · THU OCT 1 · <b>2<\/b> REPORTS · <i class="mn-wt mn-wt--light"/);
  const seg = html.slice(0, html.indexOf("LATER"));
  assert.ok(seg.indexOf('data-t="ACN"') < seg.indexOf('data-t="NKE"'), "ACN then NKE");
  assert.ok(seg.indexOf("ec-now--tape") > seg.indexOf('data-t="ACN"') && seg.indexOf("ec-now--tape") < seg.indexOf('data-t="NKE"'), "NOW between them");
  assert.doesNotMatch(seg, /data-t="PEP"/, "another day is not on today's tape (it is only named, dimmed, under LATER)");
});
test("EARNINGS rolls to the next day with reports once today's have all reported, or at 20:00 ET", () => {
  const done = load({ rows: [{ ...ACN, eps_actual: 3.29 }, { ...NKE, eps_actual: 0.5 }, PEP, DAL] });
  const p = done.ernTapeDay(ts("2026-10-01T21:00:00Z"), "2026-10-01");
  assert.equal(p.day, "2026-10-08"); assert.equal(p.rolled, true); assert.deepEqual(p.items.map((x) => x.ticker), ["PEP"]);
  assert.match(done.ernDayTapeHTML(ts("2026-10-01T21:00:00Z"), "2026-10-01"), /TODAY&#39;S 2 DONE · NEXT THU OCT 8 · <b>1<\/b> REPORT/);
  const late = load({ rows: [{ ...ACN, eps_actual: 3.29 }, NKE, PEP] });
  assert.equal(late.ernTapeDay(ts("2026-10-01T23:30:00Z"), "2026-10-01").day, "2026-10-01", "19:30 ET, NKE not stored yet: still today");
  assert.equal(late.ernTapeDay(ts("2026-10-02T00:05:00Z"), "2026-10-01").day, "2026-10-08", "20:05 ET: after-hours are over, it rolls");
  const sat = load({ rows: [PEP, DAL], today: "2026-10-03" });
  const q = sat.ernTapeDay(ts("2026-10-03T15:00:00Z"), "2026-10-03");
  assert.equal(q.day, "2026-10-08"); assert.match(sat.ernDayTapeHTML(ts("2026-10-03T15:00:00Z"), "2026-10-03"), />NEXT THU OCT 8 · /, "no reports today: the next day that has some");
  const none = load({ rows: [] });
  assert.match(none.ernDayTapeHTML(ts("2026-10-01T15:00:00Z"), "2026-10-01"), /no earnings for the names you track in the next 21 days/);
});
test("?tapes=old puts the 27 Sep EVENTS tape and the NEXT label back", () => {
  const old = load({ rows: [ACN, NKE], macro: THU, search: "?tapes=old" });
  assert.equal(old.H3_TAPES_ON, false);
  assert.match(old.topTapeHTML(ts("2026-10-01T15:00:00Z"), "2026-10-01"), />EVENTS →<\/b>/);
  assert.match(old.macroNextHTML(ts("2026-10-01T12:00:00Z")), /^<span class="mn-lbl">next<\/span>/);
  const on = load({ rows: [ACN, NKE], macro: THU });
  assert.match(on.topTapeHTML(ts("2026-10-01T15:00:00Z"), "2026-10-01"), />EARNINGS →<\/b>/);
  assert.match(on.macroNextHTML(ts("2026-10-01T12:00:00Z")), /^<span class="mn-lbl mn-lbl--econ">economic<\/span>/);
  assert.equal(on.mnLblHTML({ id: "ernNext" }), '<span class="mn-lbl">next</span>', "the earnings room's own queue keeps NEXT");
});

/* ── ECONOMIC ───────────────────────────────────────────────────────────────────────────────────── */
test("ECONOMIC: a heavy day's chip slides through its releases in time order — name, time, consensus vs prior — and back to the count", () => {
  const K = load({ macro: THU });
  K.ecHist = { day: "2026-10-01", counts: hist() };
  const now = ts("2026-10-01T12:00:00Z");   // 08:00 ET
  const sw = K.ecNudgeModel(now).find((m) => m.kind === "swarm");
  assert.ok(sw, "four the same day collapse to the swarm");
  const html = K.ecSwarmInnerHTML(sw, now);
  assert.match(html, /<span class="mn-cyc mn-slbl"><span class="mn-face mn-face--count"><b>THU<\/b> · <b>4<\/b> due · <i class="mn-wt mn-wt--normal"[^>]*>normal<\/i> · in 30m<\/span>/);
  const faces = [...html.matchAll(/<span class="mn-face" [^>]*>([\s\S]*?)<\/span>(?=<span class="mn-face"|<\/span>$)/g)].map((m) => m[1].replace(/<[^>]+>/g, ""));
  assert.deepEqual(faces, ["● Jobless Claims 08:30 · est 200 vs prior 197", "● Fed Barkin Speech 09:05", "● ISM Manufacturing PMI 10:00 · est 55 vs prior 54.6", "● Fed Bowman Speech 15:00"]);
  assert.doesNotMatch(html.replace(/^[\s\S]*?mn-cyc/, ""), /data-k=/, "a face never carries data-k: the queue painter would slide it out as a stranger");
  assert.match(html, /data-act="mngoto" data-day="2026-10-01" data-fk="[^"]+" data-esub="ISM Manufacturing PMI"/, "a tap on a sliding release opens that release");
  /* the clock decides which face is on screen: the count holds two turns, then each release one */
  const seq = Array.from({ length: 12 }, (_, i) => K.mnCycIndex(5, i * 3000 + 100));
  assert.deepEqual(seq, [0, 0, 1, 2, 3, 4, 0, 0, 1, 2, 3, 4]);
  assert.equal(K.mnCycIndex(1, 9e12), 0);
});
test("ECONOMIC: a printed release slides by with its number against the consensus; a quiet day carries its weight too", () => {
  const K = load();
  const cyc = K.ecSwarmCycHTML({ kind: "swarm", day: "2026-10-01", it: { ts: ts("2026-10-01T13:05:00Z"), day: "2026-10-01" },
    group: [{ key: "a", st: "landed", it: { ts: ts("2026-10-01T12:30:00Z"), day: "2026-10-01", name: "Jobless Claims", event: "Initial Jobless Claims", cat: "LABOUR", actual: 205, estimate: 200, previous: 197 } }] },
    ts("2026-10-01T12:40:00Z"));
  assert.match(cyc, /<b>205<\/b> vs est 200/);
  K.ecHist = { day: "2026-10-01", counts: hist() };
  const ahead = K.ecAheadInnerHTML({ day: "2026-10-02", it: { day: "2026-10-02" }, group: [1, 2, 3].map(() => ({ it: { cat: "OTHER" } })) });
  assert.match(ahead, /FRI · <b>3<\/b> due · <i class="mn-wt mn-wt--normal"/);
});

/* ── the company chart ──────────────────────────────────────────────────────────────────────────── */
test("the company chart asks the Station pane for its timeframe's own context lens (the Station's LENS_FOR_RANGE)", () => {
  const src = new Function(page.match(/^const STATION_CHART_URL = [^\n]*/m)[0] + "\n" + page.match(/^const CO_RANGES = [^\n]*/m)[0] +
    "\nconst coCloudsOn = () => true;\n" + page.match(/function coRange\(stored\) \{[\s\S]*?\n\}\n/)[0] + page.match(/function coChartSrc\(t, range, rsi\) \{[\s\S]*?\n\}\n/)[0] +
    "return { coChartSrc, CO_RANGES };")();
  assert.deepEqual(src.CO_RANGES, ["1h", "4h", "1D", "3D", "1W"]);
  /* /_indicators/station-lens.mjs, 29 Sep: intraday → 1d:60, 1D → 30m:3, 3D → 4h:12, 1W → 1d:20 */
  const want = { "1h": "1d:60", "4h": "1d:60", "1D": "30m:3", "3D": "4h:12", "1W": "1d:20" };
  for (const [r, lens] of Object.entries(want))
    assert.equal(new URL(src.coChartSrc("MU", r, true)).searchParams.get("bubble"), lens, r);
});
test("once the Station answers that it knows ?bare=hub, the company view's frame is released too (its badge and Geiger chip were cut off)", () => {
  const probe = page.match(/function coPaneModeProbe\(\) \{[\s\S]*?\n\}\n/)[0];
  assert.match(probe, /querySelectorAll\("\.sc-cofr\.is-legacy, \.cv-chart\.is-legacy"\)/);
});

/* ── a path to the tree map ─────────────────────────────────────────────────────────────────────── */
test("TREE is a master tab, after STATION, opening the tree map in this tab (its BACK returns here); the studies index has its card", () => {
  const SECTIONS = JSON.parse(page.match(/^const SECTIONS = (\[[^\]]*\]);/m)[1]);
  const box = { innerHTML: "" };
  new Function("el", "SECTIONS", page.match(/^const STATION_PUBLIC_URL = [^\n]*/m)[0] + "\n" + page.match(/^const TREE_MAP_URL = [^\n]*/m)[0] + "\n" +
    page.match(/^const ALLOCATION_PUBLIC_URL = [^\n]*/m)[0] + "\n" + page.match(/^const MTAB_LABEL = [^\n]*/m)[0] + "\n" +
    page.match(/function buildMtabs\(\) \{[\s\S]*?\n\}\n/)[0] + "buildMtabs();")(() => box, SECTIONS);
  const tabs = [...box.innerHTML.matchAll(/data-sec="([A-Z]+)"/g)].map((m) => m[1]);
  assert.deepEqual(tabs.slice(0, 4), ["DASHBOARD", "ALLOCATION", "STATION", "TREE"]);
  assert.match(box.innerHTML, /<a role="tab" class="sc-mtab" data-sec="TREE" href="\/deliverables\/20260929\/tree-map\/" title="[^"]+">TREE<\/a>/);
  assert.doesNotMatch(box.innerHTML.match(/<a[^>]*data-sec="TREE"[^>]*>/)[0], /target=/, "same tab, so the page's BACK comes home");
  assert.ok(fs.existsSync(new URL("../deliverables/20260929/tree-map/index.html", import.meta.url)));
  assert.match(fs.readFileSync(new URL("../deliverables/20260929/tree-map/index.html", import.meta.url), "utf8"), /data-go="back"/, "the grey BACK / CLOSE pair");
  const studies = fs.readFileSync(new URL("../deliverables/20260928/studies-index/STUDIES.html", import.meta.url), "utf8");
  assert.match(studies, /href="\/deliverables\/20260929\/tree-map\/"[^>]*><img src="thumbs\/tree-map\.png"/);
  assert.ok(fs.existsSync(new URL("../deliverables/20260928/studies-index/thumbs/tree-map.png", import.meta.url)));
});

/* ── RVOL ───────────────────────────────────────────────────────────────────────────────────────── */
/* H5 (1 Oct) superseded three H3 details on purpose (BRIEF-20261001-H5-RVOL-BATTERY): the number is rvol_at_time only and the
   battery is session_rvol (no folding of one into the other), a stale row draws the EMPTY battery and a dash (not "…"), and
   the dots are back on the board. What H3 established still holds and is still asserted here: a stale or missing row is no
   reading, the inflated live/avg fallback is gone, the words carry the source date, the table is read on every pull. */
test("RVOL: a current board_volume row shows its at-this-minute reading; a stale or missing one says no reading yet (no inflated fallback)", () => {
  const fnSrc = (name) => page.match(new RegExp("function " + name + "\\([^)]*\\) \\{[\\s\\S]*?\\n\\}\\n"))[0];
  const K = new Function("esc", page.match(/^const RVOL_MAX_AGE_MS = [^\n]*/m)[0] + "\n" + fnSrc("rvolNoteHTML") + fnSrc("scRvolCurrent") +
    "const rb = (v) => (v < 0.8 ? 1 : v < 1.2 ? 2 : v < 1.8 ? 3 : v < 2.5 ? 4 : 5);\n" + fnSrc("volCellHTML") + "return { rvolNoteHTML, scRvolCurrent, volCellHTML };")(
    (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])));
  const rvSrc = page.match(/        rv:    \(function \(\) \{[\s\S]*?\}\)\(\),\n/)[0];
  assert.doesNotMatch(rvSrc, /live_quotes|lqv|avg_volume/, "the ~3.5× inflated live/avg ratio is gone");
  const pick = (bv) => new Function("BOARDVOL", "m", "num", "scRvolCurrent", "return " + rvSrc.trim().replace(/^rv:\s*/, "").replace(/,$/, ""))(
    { MU: bv }, { ticker: "MU" }, (v) => (v == null ? null : Number.isFinite(+v) ? +v : null), K.scRvolCurrent);
  const now = new Date().toISOString();
  assert.equal(pick({ rvol_at_time: 1.7, session_rvol: 0.4, updated_ts: now }), 1.7, "at this minute first");
  assert.equal(pick({ rvol_at_time: null, session_rvol: 0.4, updated_ts: now }), null, "H5: the number is the at-time value only (the session ratio is the battery)");
  assert.equal(pick({ rvol_at_time: 1.7, session_rvol: 0.4, updated_ts: "2026-07-06T18:03:29Z" }), null, "a 6 Jul row is no reading");
  assert.equal(pick(undefined), null);
  assert.match(K.volCellHTML(null, null, "2026-07-06T18:03:29Z"), /title="no reading yet — the newest relative-volume row for this name was written 2026-07-06, not this session">…<\/span>/);
  assert.match(K.volCellHTML(null, null, null), /title="no reading yet — no relative-volume row for this name yet">…<\/span>/);
  assert.match(K.volCellHTML(1.7, 0.4, now), /1\.7×<\/span><\/span>$/);
  assert.match(K.rvolNoteHTML([{ t: "A", rv: null }, { t: "B", rv: null }]), />RVOL no reading yet<\/span>$/);
  assert.match(K.rvolNoteHTML([{ t: "A", rv: 1.2 }, { t: "B", rv: null }]), />RVOL 1 of 2 read<\/span>$/);
  assert.equal(K.rvolNoteHTML([{ t: "A", rv: 1.2 }]), "", "all read: nothing to say");
  assert.match(page, /scOpt\('board_volume',\s+pg\("board_volume\?select=ticker,rvol_at_time,cum_rvol,session_rvol,updated_ts"\)/, "read on every board pull");
  assert.doesNotMatch(page, /\.sc-board__row \.sc-vol \.sc-vol__dots\{display:none\}/, "H5: the battery is back on the board (the track now has the room)");
});

/* ── speed ──────────────────────────────────────────────────────────────────────────────────────── */
test("with /sparklines in use, a clicked chart no longer holds or aborts the board's tiles; without it the H2 hold stays", () => {
  const src = page.match(/function scChartFirstHold\(\) \{[\s\S]*?\n\}\n/)[0];
  const run = (batch) => {
    let aborted = 0;
    const PACE = { holdUntil: 0, inflight: new Set([{ ctl: { abort: () => aborted++ } }]) };
    new Function("SPARK_PACE", "SPARK_BATCH", "SPARK_HOLD_MAX_MS", "sparkPump", src + "scChartFirstHold();")(PACE, batch, 8000, () => {});
    return { held: PACE.holdUntil > 0, aborted };
  };
  assert.deepEqual(run(true), { held: false, aborted: 0 });
  assert.deepEqual(run(null), { held: true, aborted: 1 }, "route not known yet: the hold, as before");
  assert.deepEqual(run(false), { held: true, aborted: 1 }, "no /sparklines: the hold, as before");
});
