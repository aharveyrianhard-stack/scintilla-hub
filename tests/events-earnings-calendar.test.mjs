/* EVENTS 23 Sep — the earnings section rebuilt to Alan's proposal: MONTH (the shape of
   the season), WEEK (the working view), DAY (today's UPCOMING | PAST, unchanged).
   These tests pin the decisions and the wiring, not the pixels — the screenshots in
   deliverables/20260923/events-earnings/ carry the look. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const core = src.slice(src.indexOf("const ERC_MONTH_CELL"), src.indexOf("/* AN OPEN EVENTS VIEW NEVER LOOKED AGAIN."));

/* 23 Sep evening (M28): the tape is no longer a span of its own — it is the room's
   HEADER, above MONTH · WEEK · DAY (Alan: "having it on top of the other views, more
   like a header"). DAY is where the room lands, and the anchor still starts on today
   unless today has no reports, in which case the room says so and points at the next
   day that does. */
test("the room lands on DAY under the tape, with MONTH and WEEK one tap away", () => {
  assert.match(src, /ernSpan: "DAY", ernDay: null, ernPick: null, ernZoom: "DAYS", ernCohPick: null,/);
  assert.match(core, /const ercSpan = \(\) => \(S\.ernSpan === "MONTH" \|\| S\.ernSpan === "WEEK" \? S\.ernSpan : "DAY"\);/);
  assert.match(core, /const ercAnchor = \(\) => S\.ernDay \|\| todayISO\(\);/);
  assert.match(src, /\["MONTH", "WEEK", "DAY"\]\.map/);
  assert.ok(!/"TIMELINE"/.test(src), "TIMELINE is gone as a view: the tape is the header now");
});

test("the four open decisions are the proposal's own, each one word to change", () => {
  assert.match(core, /const ERC_MONTH_CELL = "LOAD\+NAMES";/);   // load bar + count + top names
  assert.match(core, /const ERC_NAME_ORDER = "MCAP";/);          // biggest first
  assert.match(core, /const ERC_COHORT_HUE = true;/);            // the dot is the cohort
  /* the fourth: DIVIDENDS stays a sub-tab beside ALL and EARNINGS, untouched */
  assert.match(src, /\["ALL", "EARNINGS", "DIVIDENDS"\]\.map\(\(t\) =>/);
  assert.match(src, /data-act="caltype"/);
});

test("the calendar and the EARNINGS band speak with one voice — no second definition", () => {
  for (const shared of ["ernWeek(", "ernWhen(", "ernSlot(", "ernResult(", "ernWeekday(", "ernMonthDay(", "ernShift("])
    assert.ok(core.includes(shared), "the calendar reuses the band's " + shared);
  assert.ok(!/function ernWeek\b|function ernResult\b/.test(core), "and never redefines them");
});

test("both views start their week on Monday, exactly as the band's WEEK OF does", () => {
  assert.match(core, /const lead = dow === 0 \? 6 : dow - 1;/);
  assert.match(core, /\["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"\]/);
  assert.match(src, /const mon = ernShift\(todayIso, dow === 0 \? -6 : 1 - dow\);/);   // the band, unchanged
});

test("MONTH carries load and hands the names to WEEK", () => {
  assert.match(core, /data-act="ernday" data-d="/, "a day opens its week");
  assert.match(core, /list\.slice\(0, ERC_NAMES_PER_CELL\)/, "only the biggest names get through");
  assert.match(core, /\+" more<\/div>"|\+ " more<\/div>"/, "the rest are counted, never dropped");
  assert.match(core, /const lvl = n >= 25 \? "var\(--sv5\)" : n >= 12 \? "var\(--sv4\)" : "var\(--crk\)";/);
});

test("the load bar is how many report, and never a result", () => {
  const cell = core.slice(core.indexOf("function ercCellEvHTML"), core.indexOf("function ercChipHTML"));
  assert.ok(cell.includes("res && res.cls"), "the ticker carries beat / in line / miss");
  assert.ok(/the load bar is HOW MANY report, never a result/.test(core));
});

test("a chip opens the same card the DAY view draws — nothing is lost", () => {
  assert.match(core, /earningsBlockHTML\(earningsRowToBlock\(r, CALLSUM_IDX\)\)/);
  /* and it is read with the same columns, so no field on that card can be missing */
  for (const col of ["release_link", "release_summary", "release_metrics", "call_url", "transcript_url", "confirmed", "report_time", "revenue_estimate"])
    assert.ok(core.includes(col), "the calendar reads " + col);
});

test("a blank report time is a real group, not an edge case", () => {
  assert.match(core, /\[3, "time not set"\]/);
  assert.match(core, /\[0, "before the open"\], \[1, "at a set time"\], \[2, "after the close"\]/);
});

test("the calendar reads earnings_events and writes nothing", () => {
  const reads = core.match(/pg\("[^"]+/g) || [];
  /* two read paths now — the view's own range with every column, and the tape's much
     wider range with ticker and date only — and both touch the same two tables. */
  assert.deepEqual([...new Set(reads.map((r) => r.slice(4).split("?")[0].replace(/"/g, "")))].sort(), ["cohorts", "earnings_events"]);
  assert.match(core, /pg\("earnings_events\?select=ticker,date&date=gte\./, "the tape reads two columns, not every release summary in the season");
  assert.ok(!/POST|PATCH|DELETE|operatorWrite|upsert/.test(core), "nothing is written");
});

test("one read per span, and a quiet re-read that does not move the reader", () => {
  assert.match(core, /if \(!quiet && key === ERC_KEY && ERC_ROWS\) return;/);
  assert.match(core, /changed = key !== ERC_KEY \|\| sig !== ERC_SIG;/);
  assert.match(core, /now\.scrollTop = at;/);
  assert.match(src, /if \(typeof ercRead === "function"\) ercRead\(!!quiet\);/, "and fillEvents still stands on its own");
  assert.match(src, /if \(typeof ercTapeRead === "function"\) ercTapeRead\(!!quiet\);/, "the header tape is kept fresh by the same quiet re-read");
});

test("a size that has not arrived is said out loud, never guessed, and redrawn once it lands", () => {
  assert.match(core, /sizes have not arrived yet, so names are in alphabetical order for the moment/);
  assert.match(core, /if \(\(ma == null\) !== \(mb == null\)\) return ma == null \? 1 : -1;/);
  assert.match(core, /function ercWaitForSizes\(\)/);
  assert.ok(!/pg\("company_profile/.test(core), "the calendar never asks for sizes itself: it uses the board's");
});

test("the cohort scope gate is the same honest one the list uses", () => {
  assert.match(core, /if \(!COHSETS && cohort !== "ALL" && cohort !== "FAV" && !S\.tq\)/);
  assert.match(core, /scopeItems\(ERC_ROWS, cohort, S\.tq, S\.fav, COHSETS\)/);
});

test("DAY is the list that is already there, untouched", () => {
  assert.match(src, /if \(ercSpan\(\) !== "DAY"\) \{ ercRenderCal\(list, cohort\); return; \}/);
  assert.match(src, /'<div class="sc-evcol"><div class="sc-evsec">UPCOMING<\/div>'/);
  assert.match(src, /PAST · REPORTED<\/div>/);
});

test("the ECONOMIC tab and its nudge are not touched by any of this", () => {
  assert.match(src, /econCty: "US", econCat: "ALL", econDay: null, econSpan: "MONTH", econZoom: false/);
  assert.ok(!/ec-cell|ec-cal|econSpan/.test(core), "the earnings calendar has its own classes and its own state");
});

test("no white anywhere in the new styles", () => {
  const css = src.slice(src.indexOf("THE EARNINGS CALENDAR — MONTH and WEEK"), src.indexOf("FIX 1 — GLOBAL SCALE LAW"));
  const surfaces = css.replace(/rgba\(255,255,255,\.022\)/g, "").replace(/white-space/g, "nowrap-rule");
  assert.ok(!/#fff\b|#ffffff|\bwhite\b/i.test(surfaces), "only the panel's own 2.2% hover tint, as the economic grid already uses");
});
