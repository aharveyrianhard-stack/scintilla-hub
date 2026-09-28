import test from "node:test";
import assert from "node:assert/strict";
import { reportTiming, reportSession, eventMeasures, spread, runupStudy, sameWindows, usualDay,
         RUNUP_SESSIONS, AFTER_SESSIONS, MIN_REPORTS } from "../research/statistics/stats.mjs";

const close = (v, p = 6) => Math.round(v * 10 ** p) / 10 ** p;

// Weekdays from Monday 2024-01-01; closes oscillate 100 / 101 so every clean usual day is known by hand.
function fixture(n, overrides = {}) {
  const bars = []; let d = Date.UTC(2024, 0, 1);
  while (bars.length < n) {
    const wd = new Date(d).getUTCDay();
    if (wd !== 0 && wd !== 6) { const i = bars.length; bars.push({ t: d, c: overrides[i] ?? (i % 2 === 0 ? 100 : 101) }); }
    d += 86400e3;
  }
  return bars;
}
const day = (bars, i) => new Date(bars[i].t).toISOString().slice(0, 10);
// 30 moves of +1% and 30 of (100/101 - 1) = -0.990099%: sample sd = (a - b) / 2 * sqrt(60 / 59)
const A = 1, B = (100 / 101 - 1) * 100, SD = (A - B) / 2 * Math.sqrt(60 / 59);

test("report timing: BMO same session, AMC next, clock times by the bell, anything else unknown + flagged", () => {
  assert.deepEqual(reportTiming("BMO"), { timing: "BMO", rule: "same", flagged: false });
  assert.deepEqual(reportTiming(" amc "), { timing: "AMC", rule: "next", flagged: false });
  assert.equal(reportTiming("08:30").rule, "same");
  assert.equal(reportTiming("16:05").rule, "next");
  assert.deepEqual(reportTiming("12:00"), { timing: "during", rule: "same", flagged: true, clock: "12:00" });
  for (const v of [null, undefined, "", "TBD", "lunch"]) assert.deepEqual(reportTiming(v), { timing: "unknown", rule: "next", flagged: true });
});

test("report session: a weekend BMO trades Monday; an AMC on Friday trades Monday", () => {
  const bars = fixture(10);                                           // Mon 01-01 … Fri 01-12
  const dates = bars.map((_, i) => day(bars, i));
  assert.equal(dates[5], "2024-01-08");
  assert.equal(reportSession(dates, "2024-01-06", "same"), 5);        // Saturday, before the open -> Monday
  assert.equal(reportSession(dates, "2024-01-05", "next"), 5);        // Friday after the close -> Monday
  assert.equal(reportSession(dates, "2024-01-05", "same"), 4);
  assert.equal(reportSession(dates, "2024-01-12", "next"), null);     // nothing has traded on it yet
});

test("one name, three reports, every number by hand", () => {
  // A: BMO on index 90       -> r = 90,  run-up 69 -> 89, day 89 -> 90, after 90 -> 95
  // B: AMC on index 199      -> r = 200, run-up 179 -> 199, day 199 -> 200, after 200 -> 205
  // C: no time on index 300  -> unknown, next session r = 301, run-up 280 -> 300; after missing (series ends at 303)
  const bars = fixture(304, { 89: 110, 90: 121, 199: 95, 300: 103, 301: 99 });
  const reports = [
    { date: day(bars, 90), report_time: "BMO" },
    { date: day(bars, 90), report_time: "BMO" },                      // duplicate row, same (ticker, date)
    { date: day(bars, 199), report_time: "AMC" },
    { date: day(bars, 300), report_time: null },
    { date: "2031-01-01", report_time: "AMC" },                       // nothing has traded on it
  ];
  const s = runupStudy(bars, reports);
  assert.equal(s.reports_listed, 4);
  assert.equal(s.reports_used, 3);
  assert.equal(s.enough, false, `3 reports is fewer than ${MIN_REPORTS}`);
  assert.deepEqual(s.timing, { BMO: 1, AMC: 2, during: 0, unknown: 1 }, "timing counts every listed report, measured or not");
  assert.deepEqual(s.excluded.map((e) => e.reason), ["no session has traded on it yet in the stored bars"]);

  const [a, b, c] = s.events;
  // the yardstick is the usual day at the run-up's first close, and all three windows are clean oscillation there
  for (const e of [a, b, c]) assert.equal(close(e.usual_day), close(SD));

  assert.equal(a.session, day(bars, 90)); assert.equal(a.runup_from, day(bars, 69));
  assert.equal(close(a.runup_pct), close((110 / 101 - 1) * 100));    // +8.910891%
  assert.equal(close(a.day_pct), close((121 / 110 - 1) * 100));      // +10%
  assert.equal(close(a.after_pct), close((101 / 121 - 1) * 100));    // -16.528926%
  assert.equal(close(a.runup_sd), close((110 / 101 - 1) * 100 / SD));

  assert.equal(b.session, day(bars, 200)); assert.equal(b.timing, "AMC");
  assert.equal(close(b.runup_pct), close((95 / 101 - 1) * 100));     // -5.940594%
  assert.equal(close(b.day_pct), close((100 / 95 - 1) * 100));       // +5.263158%
  assert.equal(close(b.after_pct), close((101 / 100 - 1) * 100));    // +1%

  assert.equal(c.session, day(bars, 301)); assert.equal(c.timing, "unknown"); assert.equal(c.timing_flagged, true);
  assert.equal(close(c.runup_pct), close((103 / 100 - 1) * 100));    // +3%
  assert.equal(close(c.day_pct), close((99 / 103 - 1) * 100));       // -3.883495%
  assert.equal(c.after_pct, null); assert.match(c.after_note, /fewer than 5 sessions/);

  const r = s.summary.runup.pct;                                      // {-5.94, +3, +8.91}
  assert.equal(r.n, 3); assert.equal(close(r.median), 3); assert.equal(r.positive, 2);
  assert.equal(close(r.share_positive), close(200 / 3));
  const lo = (95 / 101 - 1) * 100; assert.equal(close(r.q10), close(lo + (3 - lo) * 0.2));    // position 0.2 between the lowest two
  assert.equal(s.summary.after.pct.n, 2, "the latest report drops out of the five-after column only");
  assert.equal(close(s.summary.after.pct.median), close(((101 / 121 - 1) * 100 + 1) / 2));
});

test("prior observations only: the run-up's own moves are never inside its yardstick", () => {
  const bars = fixture(120, { 99: 150 });                              // a huge jump inside the run-up
  const closes = bars.map((b) => b.c);
  const usual = usualDay(closes, 60);
  const m = eventMeasures(closes, usual, 100);                         // run-up 79 -> 99
  assert.equal(close(m.usual_day), close(SD), "read at close 79, before the jump");
  assert.ok(usual[99] > m.usual_day, "the usual day measured after the jump is larger and is not used");
});

test("too early to measure is excluded with its reason, not scaled by a guess", () => {
  const bars = fixture(200);
  const closes = bars.map((b) => b.c);
  const usual = usualDay(closes, 60);
  assert.match(eventMeasures(closes, usual, 15).excluded, /fewer than 21 sessions/);
  assert.match(eventMeasures(closes, usual, 50).excluded, /usual day is not yet defined/);   // start 29 < 60
  assert.equal(RUNUP_SESSIONS, 20); assert.equal(AFTER_SESSIONS, 5);
});

test("spread: median, bands and share above zero by hand; zero is not positive", () => {
  const s = spread([4, -2, 0, 10, null, 6]);
  assert.equal(s.n, 5); assert.equal(s.median, 4); assert.equal(s.positive, 3); assert.equal(s.share_positive, 60);
  assert.equal(s.q25, 0); assert.equal(s.q75, 6); assert.equal(close(s.q10), close(-2 + 2 * 0.4));
  assert.deepEqual(spread([]).n, 0);
});

test("a fund over the very same sessions: matched by date, flat fund reads zero", () => {
  const bars = fixture(304, { 89: 110, 90: 121, 199: 95, 300: 103, 301: 99 });
  const s = runupStudy(bars, [{ date: day(bars, 90), report_time: "BMO" }, { date: day(bars, 199), report_time: "AMC" }]);
  const fund = fixture(304);
  const f = sameWindows(fund, s.events);
  assert.equal(f.windows_asked, 2); assert.equal(f.windows_matched, 2);
  assert.equal(f.summary.runup.pct.median, 0);
  const shortFund = fixture(150);                                      // does not hold the second window
  assert.equal(sameWindows(shortFund, s.events).windows_matched, 1);
});
