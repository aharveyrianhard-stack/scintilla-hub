import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");

test("today is the New York market date, not the UTC date (8pm-midnight ET no longer reads as tomorrow)", () => {
  const src = page.match(/const todayISO = \(\) => [^\n]*\n/)[0];
  const RealDate = Date;
  // 2026-09-18T03:50:00Z = 2026-09-17 23:50 ET (Alan's measured evening)
  class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : ["2026-09-18T03:50:00Z"])); } static now() { return new RealDate("2026-09-18T03:50:00Z").getTime(); } }
  const todayISO = new Function("Date", src + "return todayISO;")(FakeDate);
  assert.equal(todayISO(), "2026-09-17");
  const evRel = new Function("todayISO", "DAY_MS", page.match(/const evDays = [^;]*;/)[0] + page.match(/const evRel = [^;]*;/)[0] + "return (d) => evRel(evDays(d));")(todayISO, 86400000);
  assert.equal(evRel("2026-09-17"), "today", "FedEx's Sep 17 row was '1d ago' at this moment");
  assert.equal(evRel("2026-09-11"), "6d ago");
  assert.match(page, /function scChartLive\(t, price\) \{\n  const today = new Date\(\)\.toISOString\(\)\.slice\(0, 10\);/, "chart live bar keeps its UTC-day comparison");
});

test("a past date with estimates only is labelled as having no stored result", () => {
  assert.match(page, /if \(days < 0 && !reported\) pastNoResult = true;/);
  assert.match(page, /pastNoResult \? "estimate · no result stored for this date" : "estimate"/);
});

test("the master EVENTS panel has one scroll region per column, not a second one around them", () => {
  assert.match(page, /#evList:has\(> \.sc-evcols--split\)\{ overflow:hidden; display:flex; flex-direction:column; \}/);
  assert.match(page, /#evList > \.sc-evcols--split > \.sc-evcol\{ max-height:none; min-height:0; \}/);
});

test("report time: the stored value when present, an explicit unknown otherwise, never a placeholder that reads like a value", () => {
  assert.doesNotMatch(page, /sc-ern__pill--wait">bmo\/amc</, "the BMO/AMC-looking placeholder is gone");
  assert.match(page, /sc-ern__pill--wait" title="report time not in the stored calendar">time unknown</);
  assert.match(page, /d\.confirmed === false \? '<span class="sc-ern__pill sc-ern__pill--wait"[^>]*>unconfirmed</);
  assert.match(page, /const sess = \(ev\.report_time && ev\.report_time !== "TBD"\) \? " · " \+ esc\(ev\.report_time\) : "";/, "master list rows show a stored report time");
  assert.match(page, /const sess = \(ev\.report_time && ev\.report_time !== "TBD"\) \? " " \+ esc\(ev\.report_time\) : "";/, "the upcoming rail shows a stored report time");
});

test("a company with no upcoming calendar row says so explicitly, and never claims the company has no earnings", () => {
  assert.match(page, /NEXT EARNINGS · ' \+ \(isFund/);
  assert.match(page, /no scheduled date in the stored calendar for \$" \+ esc\(data\.t\) \+ " \(absence of a stored date, not a statement that none is scheduled\)/);
  assert.match(page, /not applicable — fund \/ non-equity, no earnings calendar/);
});
