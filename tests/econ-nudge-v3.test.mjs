/* THE NUDGE, built to the 16 AUGUST PROTOTYPE (_ECON_TAB_REVIEW/nudge.html · scintilla-economic-tab.vercel.app/nudge).
   Alan, 23 Sep 09:43: "S&P composite PMI in two minutes. No scintillation." — and at 11:00: "review the proposal that
   the session that made the prototype made". So the prototype's own table is the spec pinned here:
       ahead  > 60 min   still, no flash, named
       soon   < 60 min   breathes at 2.4s, in its own category colour
       near   < 10 min   1.1s, tightening
       due    at the minute  0.38s hard pulse — only ever ONE item does this
       landed          stops dead, actual vs estimate, its own lane on the LEFT, never an upcoming slot,
                       clears on click or at the end of the session day
       heavy day  4+ the same day   the names collapse to a swarm of category colours and a count
       heavy ahead  up to 3 days out  a quiet, NON-flashing cluster: a warning, not an alarm
   Every state is checked on a FIXED clock, so "now" is never "whenever the suite happens to run". The rows are
   built here, not read: nothing in this file reaches a network, a store or a browser. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const START = "/* ---- Room 9 · ECONOMIC", END = "/* ---- Room 3 · COMPANY";
const mod = page.slice(page.indexOf(START), page.indexOf(END));
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
const plain = (x) => JSON.parse(JSON.stringify(x));

const EXPORTS = ["ecTapeItems", "ecNudgeState", "ecNudgeModel", "macroNextHTML", "ecNudgeNodeHTML", "ecHistBodyHTML",
  "ecTapeDueMs", "ecTapeSurprise", "ecDateKey", "ecHue", "EC_NUDGE_SWARM_MIN", "EC_NUDGE_AHEAD_MIN",
  "EC_NUDGE_AHEAD_DAYS", "EC_NUDGE_NEAR_S", "EC_NUDGE_SOON_S", "EC_NUDGE_LANDED_MAX", "EC_TAPE_ITEMS",
  "EC_WATCH_ON", "EC_WATCH_LEAD_S", "EC_WATCH_TAIL_S", "EC_HIST_MONTHS"];
function load(rows = null) {
  const ctx = vm.createContext({
    console, setTimeout,
    S: { sec: "DASHBOARD", state: "live", econCty: "US", econCat: "ALL", econSpan: "MONTH", econOpen: {} },
    pg: async () => [], el: () => null, go: () => {}, prevClose: {}, document: { querySelectorAll: () => [] },
  });
  const api = vm.runInContext(escSrc + numSrc + mod + "\n;({" + EXPORTS.join(",") +
    ", get MACRO_NEXT() { return MACRO_NEXT; }, set MACRO_NEXT(v) { MACRO_NEXT = v; }," +
    " get ECON_TAPE_SEEN() { return ECON_TAPE_SEEN; }, get ECON_TAPE_CLEARED() { return ECON_TAPE_CLEARED; } })", ctx);
  api.MACRO_NEXT = rows;
  return api;
}
/* Thursday 24 September 2026, 08:31 ET */
const NOW = ts("2026-09-24T12:31:00Z");
const R = (iso, event, extra = {}) => ({ event_ts: ts(iso), country: "US", event, impact: "High",
  actual: null, estimate: null, previous: null, ...extra });

/* ---------------------------------------------------------------- 1 · one release walks every band */
test("one release walks ahead → soon → near → due → landed on a fixed clock", () => {
  const rows = [R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62, previous: 0.607 })];
  const api = load(rows);
  const it = api.ecTapeItems(rows)[0];
  const at = (iso) => api.ecNudgeState(it, ts(iso));
  assert.equal(at("2026-09-24T12:31:00Z"), "ahead", "1h 29m out: still, no flash, named");
  assert.equal(at("2026-09-24T13:00:00Z"), "ahead", "exactly an hour out is still ahead (the prototype's own edge: dt < 3600)");
  assert.equal(at("2026-09-24T13:00:01Z"), "soon", "…one second inside the hour and it breathes");
  assert.equal(at("2026-09-24T13:50:00Z"), "soon", "exactly ten minutes out: still soon");
  assert.equal(at("2026-09-24T13:50:01Z"), "near", "…one second inside ten minutes and it tightens");
  assert.equal(at("2026-09-24T13:59:59Z"), "near", "a second before its minute");
  assert.equal(at("2026-09-24T14:00:00Z"), "due", "at the minute: the hard pulse");
  assert.equal(at("2026-09-24T14:30:00Z"), "due", "the supplier can be late; it stays due while it waits");
  /* the number lands */
  const landed = [{ ...rows[0], actual: 0.65 }];
  const api2 = load(landed);
  const l = api2.ecTapeItems(landed)[0], seen = ts("2026-09-24T15:20:00Z");
  assert.equal(api2.ecNudgeState(l, seen, seen), "landed");
  assert.equal(api2.ecNudgeState(l, seen + 14 * 60, seen), "landed");
  assert.equal(api2.ecNudgeState(l, seen + 16 * 60, seen), "gone", "a quarter of an hour, then it drops off");
  /* and the bands are the prototype's numbers, not something invented here */
  assert.equal(api.EC_NUDGE_SOON_S, 3600);
  assert.equal(api.EC_NUDGE_NEAR_S, 600);
});

/* ---------------------------------------------------------------- 2 · only ever ONE hard pulse */
test("two releases past their minute: one hammers, the other only tightens", () => {
  const rows = [
    R("2026-09-24T12:30:00Z", "Initial Jobless Claims", { estimate: 201 }),
    R("2026-09-24T12:29:00Z", "Durable Goods Orders MoM (Aug)", { estimate: 0.3 }),
  ];
  const api = load(rows);
  const model = api.ecNudgeModel(NOW);
  const states = model.map((m) => m.st);
  assert.equal(states.filter((x) => x === "due").length, 1, "only ever ONE item does the 0.38s pulse");
  assert.deepEqual(plain(states), ["due", "near"], "the second one tightens instead");
  const html = api.macroNextHTML(NOW);
  assert.equal((html.match(/class="mn-it s-due"/g) || []).length, 1);
});

/* ---------------------------------------------------------------- 3 · the landed lane */
test("a landed number sits in its own lane on the left, never takes a slot, and clears on its ✕ and at day end", () => {
  const rows = [
    R("2026-09-24T12:30:00Z", "Initial Jobless Claims", { estimate: 201, actual: 218 }),
    R("2026-09-24T13:00:00Z", "Fed Hammack Speech", { impact: "Medium" }),
    R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62 }),
    R("2026-09-25T12:30:00Z", "GDP Growth Rate QoQ (Q2)", { estimate: 3.1 }),
  ];
  const api = load(rows);
  const claims = api.ecTapeItems(rows).find((x) => /Claims/.test(x.name));
  api.ECON_TAPE_SEEN[claims.key] = NOW;
  const model = api.ecNudgeModel(NOW);
  assert.equal(model[0].st, "landed", "the lane is on the LEFT: the result is the first thing in the queue");
  assert.equal(model[0].lane, true, "and it is ruled off from what is still coming");
  assert.equal(model.filter((m) => m.st !== "landed").length, 3, "three upcoming survive beside it");
  const html = api.macroNextHTML(NOW);
  assert.match(html, /mn-lane-end/);
  assert.match(html, /<span class="mn-x" data-act="mnclear" data-k="[^"]+" title="clear">✕<\/span>/);
  /* the ✕ */
  api.ECON_TAPE_CLEARED[claims.key] = 1;
  assert.equal(api.ecNudgeModel(NOW).filter((m) => m.st === "landed").length, 0, "cleared on click");
  delete api.ECON_TAPE_CLEARED[claims.key];
  /* and the end of the session day, with no click at all */
  const nextDay = ts("2026-09-25T13:10:00Z");
  api.ECON_TAPE_SEEN[claims.key] = nextDay;
  assert.equal(api.ecNudgeModel(nextDay).filter((m) => m.st === "landed").length, 0,
    "yesterday's result never rides into the next session day");
  assert.equal(api.EC_NUDGE_LANDED_MAX, 2, "the lane holds two");
});

/* ---------------------------------------------------------------- 4 · the heavy day */
test("three or more the same day: the names collapse to a swarm of category colours and a count", () => {
  const heavy = [
    R("2026-09-24T12:30:00Z", "Initial Jobless Claims", { estimate: 201 }),
    R("2026-09-24T12:30:00Z", "GDP Growth Rate QoQ (Q2)", { estimate: 3.1 }),
    R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62 }),
    R("2026-09-24T14:00:00Z", "Michigan Consumer Sentiment (Sep)", { estimate: 55.4 }),
    R("2026-09-24T18:00:00Z", "Fed Interest Rate Decision", { estimate: 3.75 }),
  ];
  const api = load(heavy);
  const before = ts("2026-09-24T11:00:00Z");                       // an hour before the first of them
  const model = api.ecNudgeModel(before);
  assert.equal(model.length, 1, "it stops naming them: ONE swarm, not five lines");
  assert.equal(model[0].kind, "swarm");
  assert.equal(model[0].group.length, 5);
  const html = api.macroNextHTML(before);
  assert.match(html, /<span class="mn-swarm" data-act="mngoto" data-day="2026-09-24"/);
  assert.equal((html.match(/<i style="background:/g) || []).length, 5, "one dot per release, in its own category hue");
  assert.match(html, /<b>5 due<\/b> · in 1h 30m · go to economic<\/span>/, "the count, the wait, and where to go");
  assert.doesNotMatch(html, /Jobless|Michigan|New Home/, "no names at all on a heavy day");
  /* 23 Sep: the prototype's CODE (nudge.html: sameDay.length>=3) and Alan's notes say three; its page text said four. */
  assert.equal(api.EC_NUDGE_SWARM_MIN, 3, "three or more, as the prototype's own code does");
  const three = heavy.slice(0, 3);
  const m3 = load(three).ecNudgeModel(before);
  assert.equal(m3.length, 1, "three on one day is already a heavy day");
  assert.equal(m3[0].kind, "swarm");
  /* two on the day is still a normal day, and reads by name */
  const m2 = load(heavy.slice(0, 2)).ecNudgeModel(before);
  assert.equal(m2.length, 2);
  assert.ok(m2.every((m) => m.kind === "item"), "two get named");
});

/* ---------------------------------------------------------------- 5 · the heavy day still to come */
test("a loaded day up to three days out is one quiet cluster — a warning, not an alarm", () => {
  const rows = [
    R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62 }),
    R("2026-09-26T12:30:00Z", "Core PCE Price Index MoM (Aug)", { estimate: 0.2 }),
    R("2026-09-26T12:30:00Z", "Personal Income MoM (Aug)", { estimate: 0.4 }),
    R("2026-09-26T14:00:00Z", "Michigan Consumer Sentiment (Sep)", { estimate: 55.4 }),
  ];
  const api = load(rows);
  const model = api.ecNudgeModel(NOW);
  assert.equal(model.length, 2, "today's one release, then the cluster");
  assert.equal(model[0].kind, "item");
  assert.equal(model[1].kind, "ahead");
  assert.equal(model[1].group.length, 3);
  const html = api.macroNextHTML(NOW);
  assert.match(html, /<span class="mn-ahead" data-act="mngoto" data-day="2026-09-26"/);
  assert.match(html, /<span class="mn-albl">SAT · <b>3<\/b> due<\/span>/, "the day and the count, nothing else");
  assert.doesNotMatch(html, /Core PCE|Personal Income/, "the loaded day is collapsed, not named");
  /* nothing in the cluster moves: no state class, so no animation can key off it */
  assert.doesNotMatch(html.slice(html.indexOf("mn-ahead")), /s-due|s-near|s-soon/);
  /* four days out says nothing at all */
  const far = rows.map((r) => (/2026-09-26/.test(new Date(r.event_ts * 1000).toISOString()) ? { ...r, event_ts: r.event_ts + 3 * 86400 } : r));
  assert.equal(load(far).ecNudgeModel(NOW).filter((m) => m.kind === "ahead").length, 0);
  assert.equal(api.EC_NUDGE_AHEAD_DAYS, 3);
  assert.equal(api.EC_NUDGE_AHEAD_MIN, 3);
});

/* ---------------------------------------------------------------- 6 · the release watcher */
test("the watcher asks once a minute from one minute before to fifteen after, and stops when the number lands", () => {
  const rows = [R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62 })];
  const api = load(rows);
  assert.equal(api.EC_WATCH_ON, true);
  assert.equal(api.EC_WATCH_LEAD_S, 60);
  assert.equal(api.EC_WATCH_TAIL_S, 15 * 60);
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T13:58:00Z")), 10 * 60e3, "two minutes before: the slow cadence");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T13:59:00Z")), 60e3, "one minute before: it starts asking");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T14:14:00Z")), 60e3, "fourteen minutes after: still asking");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T14:16:00Z")), 2 * 60e3, "past fifteen: back to every two minutes");
  /* the number lands → it stops immediately, whatever the clock says */
  const landed = [{ ...rows[0], actual: 0.65 }];
  assert.equal(load(landed).ecTapeDueMs(ts("2026-09-24T14:05:00Z")), 10 * 60e3, "stop when the number lands");
  /* it is a cadence on the one reader, not a second timer */
  const tape = page.slice(page.indexOf("const ECON_TAPE_ON"), page.indexOf("/* PORT — 3d69248's window fetch"));
  assert.equal((tape.match(/setInterval\(/g) || []).length, 1, "one timer for the page's life");
  for (const w of [/method\s*:/, /pgPatch\(/, /localStorage/, /\/rpc\//]) assert.doesNotMatch(tape, w, "the watcher writes nothing");
});

/* ---------------------------------------------------------------- 7 · two years of this print */
test("the history behind a landed number reads the same table and colours prints the way the calendar does", () => {
  const api = load([]);
  assert.equal(api.EC_HIST_MONTHS, 24);
  const rows = [
    { event_ts: ts("2026-09-24T12:30:00Z"), event: "Initial Jobless Claims", actual: 218, estimate: 201 },
    { event_ts: ts("2026-09-17T12:30:00Z"), event: "Initial Jobless Claims", actual: 196, estimate: 205 },
    { event_ts: ts("2026-09-10T12:30:00Z"), event: "Initial Jobless Claims", actual: 205, estimate: 205 },
  ];
  const html = api.ecHistBodyHTML(rows);
  assert.equal((html.match(/class="mn-hr"/g) || []).length, 3, "one row per print");
  assert.match(html, /<i class="miss" style="width:100%">/, "more people out of work than expected: the red one, and the longest bar");
  assert.match(html, /<i class="beat" style="width:90%">/);
  assert.match(html, /<i class="inline" style="width:94%">/);
  assert.match(html, /<b>218<\/b> vs 201/);
  /* the read itself: one page of the same table, US, two years, only prints that happened, nothing written */
  assert.match(page, /pg\("econ_calendar\?select=event_ts,event,actual,estimate,previous&country=eq\.US&event=like\."/);
  assert.match(page, /&actual=not\.is\.null&order=event_ts\.desc&limit=26"/);
  assert.match(page, /encodeURIComponent\(ev \+ "\*"\)/, "the event name is encoded, never pasted into the query raw");
});

/* ---------------------------------------------------------------- 8 · the hues are the calendar's own */
test("every dot takes its hue from the calendar's category colours, and the quiet categories stay quiet", () => {
  const api = load([]);
  assert.equal(api.ecHue("LABOR"), "#2D9CFF");
  assert.equal(api.ecHue("INFLATION"), "#FF8A00");
  assert.equal(api.ecHue("CENTRAL BANK"), "#FF3DBE");
  assert.equal(api.ecHue("OTHER"), "var(--dim)", "OTHER's near-black would read as a dead pixel");
  const rows = [R("2026-09-24T14:00:00Z", "Inflation Rate YoY (Aug)", { estimate: 3.4 })];
  assert.match(load(rows).macroNextHTML(NOW), /<span class="mn-dot" style="color:#FF8A00">●<\/span>/);
});
