/* EVENTS 23 Sep evening (M28) — THE TAPE IS THE HEADER OF THE EARNINGS ROOM.
   Alan: "I do like this timeline view, but it's very thin. So how about just having
   it on top of the other views, more like a header." · "don't you think it should be
   a little more dynamic to zoom?" · "There's a blue line. I'm trying to click on it
   and it doesn't say… nothing." · "I feel like it's empty. I'm going to the week
   view… no report."
   This file replaces tests/earnings-timeline.test.mjs (M26), which pinned TIMELINE as
   a span of its own — the thing this unit removed. The arithmetic that survived the
   change (the count colours, the on-screen scale, the month strip) is kept here, in
   its new shape. The screenshots in deliverables/20260923/earnings-4/ carry the look. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = src.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };

const shared =
  grab(/function ernShift\(iso, n\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ernWeek\(todayIso\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ERN_WD = \[[^\]]*\];/) + "\n" +
  grab(/const ERN_MO = \[[^\]]*\];/) + "\n" +
  grab(/const ernWeekday = \(iso\) =>[^\n]*\n/) +
  grab(/const ernMonthDay = \(iso\) =>[^\n]*\n/) +
  grab(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" +
  grab(/const ercMonthShift = \(iso, k\) =>[^\n]*\n/) +
  grab(/const ERC_TL_WARM = [^\n]*\n/) +
  grab(/const ERC_TL_QUIET = [^\n]*\n/) +
  grab(/const ERC_TL_NAME_PCT = [^\n]*\n/) +
  grab(/const ERC_ZOOMS = \[[^\]]*\];/) + "\n" +
  grab(/const ERC_ZOOM = \{[\s\S]*?\n\};/) + "\n" +
  grab(/const ercTapeRange = \(anchor\) => \{[\s\S]*?\n\};/) + "\n" +
  grab(/const ercMonday = \(iso\) =>[^\n]*\n/) +
  grab(/const ercMonth1 = \(iso\) =>[^\n]*\n/) +
  grab(/function ercBucketOf\(iso, z\) \{[^\n]*\n/) +
  grab(/function ercBuckets\(from, to, z, dated\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercBucketEnd = \(b, z\) =>[^\n]*\n/) +
  grab(/function ercBucketSay\(b, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercBucketTick = \(b, z\) =>[^\n]*\n/) +
  grab(/const ercBucketOpens = \(z\) =>[^\n]*\n/) +
  grab(/const ercTlLevel = \(n\) =>[^\n]*\n/) +
  grab(/function ercTapeScale\(counts\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTapeBarHTML\([\s\S]*?\n\}/) + "\n" +
  grab(/function ercTapeStripHTML\(buckets, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTapeSayHTML\(scoped, all, coh\) \{[\s\S]*?\n\}/) + "\n" +
  'const ERC_MONTH_NAME = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];\n' +
  'const S = { ernZoom: "DAYS" };\nconst ercZoom = () => "DAYS";\n';
const fn = (name) => new Function(shared + "return " + name + ";")();
const ercBuckets = fn("ercBuckets"), ercTapeScale = fn("ercTapeScale"), ercTlLevel = fn("ercTlLevel");
const ercTapeBarHTML = fn("ercTapeBarHTML"), ercTapeStripHTML = fn("ercTapeStripHTML");
const ercTapeSayHTML = fn("ercTapeSayHTML"), ercTapeRange = fn("ercTapeRange"), ercBucketOf = fn("ercBucketOf");
const sc1 = (...c) => ercTapeScale(c);

test("one bar is a day, a week or a month — and the zoom says which", () => {
  const days = ercBuckets("2026-09-21", "2026-10-02", "DAYS", {});
  assert.deepEqual(days, ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
                          "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.equal(days.filter((d) => [0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay())).length, 0, "no Saturday, no Sunday");
  /* a report DATED on a weekend still gets a bar: a row that exists must never
     disappear from the picture of the season */
  assert.ok(ercBuckets("2026-09-21", "2026-09-27", "DAYS", { "2026-09-26": 1 }).includes("2026-09-26"));
  assert.deepEqual(ercBuckets("2026-09-26", "2026-09-27", "DAYS", {}), [], "a weekend on its own is an empty tape, not a crash");
  assert.deepEqual(ercBuckets("2026-10-02", "2026-09-21", "DAYS", {}), [], "a backwards range returns nothing");
  assert.ok(ercBuckets("2028-02-28", "2028-03-01", "DAYS", {}).includes("2028-02-29"), "a leap day is a trading day like any other");

  const weeks = ercBuckets("2026-09-23", "2026-10-20", "WEEKS", {});
  assert.deepEqual(weeks, ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19"]);
  assert.ok(weeks.every((w) => new Date(w + "T12:00:00Z").getUTCDay() === 1), "a week bar starts on Monday, like the band's WEEK OF");

  const months = ercBuckets("2026-09-23", "2027-01-04", "MONTHS", {});
  assert.deepEqual(months, ["2026-09-01", "2026-10-01", "2026-11-01", "2026-12-01", "2027-01-01"]);
  /* and a date always lands in exactly one bucket of each unit */
  assert.equal(ercBucketOf("2026-10-23", "DAYS"), "2026-10-23");
  assert.equal(ercBucketOf("2026-10-23", "WEEKS"), "2026-10-19");
  assert.equal(ercBucketOf("2026-10-23", "MONTHS"), "2026-10-01");
});

test("three zoom levels, the default is three months around today, and the window snaps to the month", () => {
  assert.deepEqual(fn("ERC_ZOOMS"), ["DAYS", "WEEKS", "MONTHS"]);
  assert.match(src, /ernZoom: "DAYS"/, "the room opens on days");
  const d = ercTapeRange("2026-09-23");
  assert.equal(d.from, "2026-07-18");
  assert.equal(d.to, "2026-10-26", "about three months of season on one screen");
  /* measured from the FIRST of the anchor's month, so stepping a day at a time does
     not throw the tape's read away on every step */
  assert.deepEqual(ercTapeRange("2026-09-01"), ercTapeRange("2026-09-30"));
  assert.notDeepEqual(ercTapeRange("2026-09-30"), ercTapeRange("2026-10-01"));
  assert.match(src, /const ERC_ZOOM_SPAN = \{ DAYS: "DAY", WEEKS: "WEEK", MONTHS: "MONTH" \};/,
    "a bar opens the view that matches its own unit");
});

test("the height is scaled to the busiest bar ON SCREEN; the colour is the count itself", () => {
  const busy = sc1(0, 3, 12, 38, 1, 25);
  assert.equal(busy.max, 38);
  assert.equal(busy.quiet, false);
  assert.equal(busy.pct(38), 80, "the busiest bar fills the track, less the headroom its count needs");
  assert.equal(busy.pct(0), 0, "a bar with nothing has no height at all");
  assert.equal(busy.pct(19), 40, "half the busiest bar is half the height");
  const quiet = sc1(0, 1, 2, 1);
  assert.equal(quiet.quiet, true, "a stretch whose busiest bar is under four is called quiet");
  assert.equal(quiet.pct(2), 80, "out of season the tallest thing on screen still fills the track");
  assert.equal(sc1(0, 0, 0).quiet, false, "a stretch with nothing in it is empty, not 'quiet'");
  assert.equal(sc1(1, 100).pct(1), 14, "one lone report against a 100-name day still shows a stub");
  /* the colour law is MONTH's load bar law, unchanged since M26 */
  assert.equal(ercTlLevel(0), "");
  assert.equal(ercTlLevel(11), "cool");
  assert.equal(ercTlLevel(12), "warm");
  assert.equal(ercTlLevel(24), "warm");
  assert.equal(ercTlLevel(25), "hot");
  assert.match(src, /const lvl = n >= 25 \? "var\(--sv5\)" : n >= 12 \? "var\(--sv4\)" : "var\(--crk\)";/);
});

test("NOTHING ON THE TAPE IS MYSTERIOUS: every bar says what it is and a click always opens something", () => {
  const sc = sc1(3, 1);
  const big = ercTapeBarHTML("2026-11-04", "DAYS", 3, 9, "AAPL, MSFT, NVDA", "2026-09-23", null, "ALL", sc);
  assert.match(big, /data-act="erntape" data-d="2026-11-04"/, "a bar opens its own day");
  assert.match(big, /click to open the day below/, "and the tooltip says so before it is clicked");
  assert.match(big, /3 names you track report · AAPL, MSFT, NVDA/);
  assert.match(big, /class="se-tlnm"[^>]*display:inline[^>]*>AAPL</, "the biggest name rides a tall bar");
  const small = ercTapeBarHTML("2026-11-05", "DAYS", 1, 1, "AAPL", "2026-09-23", null, "ALL", sc1(38, 1));
  assert.match(small, /display:none/, "a short bar keeps its name hidden until a drag makes it tall");
  assert.match(small, /1 name you track reports/, "one name is singular");
  /* THE EMPTY DAY ALAN CLICKED: it now says what it is, how many report across all
     names, and that clicking still opens the day */
  const none = ercTapeBarHTML("2026-10-23", "DAYS", 0, 14, "", "2026-09-23", null, "FAV", sc);
  assert.match(none, /nothing for FAV · 14 reports across all names/);
  assert.match(none, /click to open the day below/);
  assert.match(none, /height:0%/, "nothing reported means no bar");
  assert.doesNotMatch(none, /se-tlv/, "a zero is never printed as a count");
  assert.match(ercTapeBarHTML("2026-10-23", "DAYS", 0, 0, "", "2026-09-23", null, "ALL", sc), /nothing reports/);
  /* THE BLUE LINE. Alan: "There's a blue line. I'm trying to click on it and it
     doesn't say… nothing." It is today's marker, and it is now a real element with
     its own words instead of a decoration nothing could explain. */
  const today = ercTapeBarHTML("2026-09-23", "DAYS", 1, 1, "MU", "2026-09-23", null, "ALL", sc);
  assert.match(today, /class="se-tlday is-today/);
  assert.match(today, /class="se-tlnow" title="the cyan line is TODAY, WED SEP 23 — everything left of it has happened/);
  assert.match(today, /this is where today sits/);
  /* a week bar and a month bar explain themselves the same way, in their own unit */
  const wk = ercTapeBarHTML("2026-10-19", "WEEKS", 14, 40, "AAPL, MSFT", "2026-09-23", null, "ALL", sc1(14));
  assert.match(wk, /the week of MON OCT 19 · 14 names you track report/);
  assert.match(wk, /click to open the week below/);
  const mo = ercTapeBarHTML("2026-11-01", "MONTHS", 120, 300, "AAPL", "2026-09-23", "2026-11-01", "ALL", sc1(120));
  assert.match(mo, /NOVEMBER 2026 · 120 names you track report/);
  assert.match(mo, /click to open the month below/);
  assert.match(mo, /is-open/, "the bar the view is sitting on says so");
  assert.match(mo, /data-n="120"/, "each bar carries its own count, so a re-scale never re-reads the rows");
  assert.match(mo, /class="se-tlx">NOV</, "a month bar is ticked NOV, not N — the tape is read without hovering");
  /* the month strip explains itself too */
  const strip = ercTapeStripHTML(["2026-09-21", "2026-09-28", "2026-10-05"], "WEEKS");
  assert.match(strip, /<span class="se-tlmo" style="width:calc\(var\(--tlw\) \* 2\)" title="SEP · 2 bars">SEP<\/span>/);
  assert.match(ercTapeStripHTML(["2027-01-04"], "WEEKS"), /JAN 2027/, "a tape that crosses a year says which year");
  assert.match(ercTapeStripHTML(["2026-01-01", "2026-02-01"], "MONTHS"), /title="2026 · 2 bars">2026</, "months are grouped by year");
  assert.match(src, /\.se-tape\{ --tlw:19px;/, "one width drives the bars and the strip under them");
});

test("the room reads ALL names by default and never looks empty by accident", () => {
  assert.match(src, /const ercCohort = \(\) => S\.ernCohPick \|\| "ALL";/);
  assert.match(src, /cohort = ercCohort\(\);/, "renderEvents uses the room's own scope, not the strip's");
  assert.match(ercTapeSayHTML(84, 84, "ALL"), /showing <b>ALL<\/b> names · 84 reports on this tape/);
  const narrowed = ercTapeSayHTML(3, 84, "FAV");
  assert.match(narrowed, /showing <b>FAV<\/b> · 3 of 84 reports/);
  assert.match(narrowed, /data-act="ernall"/, "and the way back is one tap");
  /* Alan's own case: FAV, three names, nothing in the week he was looking at */
  const empty = ercTapeSayHTML(0, 84, "FAV");
  assert.match(empty, /nothing for <b>FAV<\/b> in this stretch — 84 reports across all names/);
  assert.match(empty, /SHOW ALL NAMES/);
  /* and the same sentence appears IN THE VIEW, because a week with nothing in it is
     where Alan actually hit this */
  const view = new Function(src.match(/function ercEmptyHTML\(coh, all, what\) \{[\s\S]*?\n\}/)[0] +
    (src.match(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) || [""])[0] + "\nreturn ercEmptyHTML;")();
  assert.equal(view("ALL", 40, "week"), "", "the whole universe having a quiet week is not a warning");
  assert.match(view("FAV", 40, "week"), /nothing for <b>FAV<\/b> in this week — 40 reports across all names/);
  assert.match(view("FAV", 40, "week"), /data-act="ernall"/);
  assert.match(view("FAV", 0, "month"), /nothing for <b>FAV<\/b> in this month<\/span>/, "and it does not invent a number when there is none");
  /* entering the room starts wide again; tapping the strip inside the room narrows it */
  assert.match(src, /if \(a\.dataset\.sec === "EVENTS" && S\.sec !== "EVENTS"\) \{ S\.ernCohPick = null;/);
  assert.match(src, /const inEvents = S\.sec === "EVENTS";\s*\n\s*if \(inEvents\) \{ S\.ernCohPick = a\.dataset\.key; S\.ernPick = null; \}/);
  assert.match(src, /if \(inEvents\) renderEvents\(S\.coh\);/,
    "MEASURED: a cohort tap alone does not re-enter the room, so the room is repainted explicitly — without this the tape went on saying ALL");
  assert.match(src, /case "ernall": \{ S\.ernCohPick = "ALL";/);
});

test("the view below follows what the tape points at", () => {
  assert.match(src, /case "erntape": \{[\s\S]*?S\.ernDay = d; S\.ernSpan = ERC_ZOOM_SPAN\[ercZoom\(\)\] \|\| "DAY";[\s\S]*?renderEvents\(S\.coh\); ercRead\(false\);/);
  assert.match(src, /const ercTapePointer = \(\) => ercBucketOf\(ercAnchor\(\), ercZoom\(\)\);/,
    "and the tape marks the bucket the view is sitting in");
  assert.match(src, /ercPaintTape\(\);                                   \/\/ the header, whatever the view below is/);
  assert.match(src, /'<div id="ernTape"><\/div>' \+/, "the tape is its own element, outside the view's scroller");
  /* ONE set of arrows and one TODAY in the room: they sit on the span bar, and the
     tape carries only its own two things — how far it reaches and how big a bar is */
  const tapeHead = src.slice(src.indexOf("'<div class=\"se-tapehd\">'"), src.indexOf('id="ernTlScroll"'));
  assert.ok(!/data-act="ernnav"|data-act="erntoday"/.test(tapeHead), "the tape header does not repeat the span bar's controls");
  assert.match(tapeHead, /ercZoomBarHTML\(\)/);
});

test("zoom: pinch, ⌘/ctrl-wheel or the strip — one level per gesture, and a plain wheel still walks the season", () => {
  assert.match(src, /if \(e\.ctrlKey \|\| e\.metaKey\) \{ e\.preventDefault\(\); ercZoomStep\(e\.deltaY > 0 \? 1 : -1\); return; \}/);
  assert.match(src, /if \(Math\.abs\(e\.deltaY\) > Math\.abs\(e\.deltaX\)\) \{ sc\.scrollLeft \+= e\.deltaY; e\.preventDefault\(\); \}/);
  assert.match(src, /if \(Date\.now\(\) - ERC_ZOOM_AT < 260\) return;/, "a single pinch cannot run from days to months");
  assert.match(src, /case "ernzoom": \{ ercSetZoom\(a\.dataset\.z\); break; \}/);
  assert.match(src, /S\.ernZoom = z; ERC_TAPE_AT = null;/, "a new unit re-centres the tape on the pointer");
});

test("the tape's own read is small, wide and unscoped", () => {
  const read = src.slice(src.indexOf("async function ercTapeRead"), src.indexOf("/* ---- buckets"));
  assert.match(read, /pg\("earnings_events\?select=ticker,date&date=gte\./, "ticker and date only — not every release summary in two years");
  assert.match(read, /ercTapeChunks\(r\.from, r\.to\)/);
  assert.match(src, /const ERC_TAPE_CHUNK = 120;/, "a chunk this size cannot reach the 1,000-row ceiling");
  assert.match(read, /ERC_TAPE_TRUNC = got\.some\(\(g\) => \(g \|\| \[\]\)\.length >= ERC_MAX\);/, "and a full page is admitted out loud");
  assert.ok(!/scopeItems/.test(read), "it is read unscoped, so the room can always say how many exist across all names");
  assert.match(src, /if \(ERC_TAPE_FAIL_KEY === key && Date\.now\(\) - ERC_TAPE_FAIL_AT < ERC_RETRY_MS\) return;/, "a failed read waits before asking again");
});

test("the tape keeps its place, and a drag never opens whatever bar it ended on", () => {
  assert.match(src, /sc\.addEventListener\("scroll", \(\) => \{\s*\n\s*ERC_TAPE_AT = sc\.scrollLeft;/);
  assert.match(src, /if \(ERC_TAPE_AT == null\) centre\(\);/);
  assert.match(src, /if \(pointer && \(pointer\.offsetLeft < sc\.scrollLeft \|\| pointer\.offsetLeft \+ pointer\.offsetWidth > sc\.scrollLeft \+ sc\.clientWidth\)\) \{\s*\n\s*centre\(\); ERC_TAPE_AT = sc\.scrollLeft;/,
    "a remembered offset that no longer shows the bar the view is sitting on is re-centred");
  assert.match(src, /case "erntoday": \{ S\.ernDay = todayISO\(\); S\.ernPick = null; ERC_TAPE_AT = null;/);
  assert.match(src, /sc\.addEventListener\("click", \(e\) => \{ if \(moved > 4\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); \} \}, true\);/);
  /* the re-scale moves heights and labels only: a bar's colour cannot change because
     of what else happens to be on screen */
  const rescale = src.slice(src.indexOf("function ercTapeRescale"), src.indexOf("function ercTapeAfterPaint"));
  assert.doesNotMatch(rescale, /ercTlLevel|className|classList\.(add|remove)/);
  assert.match(src, /rafid = requestAnimationFrame\(\(\) => \{ rafid = 0; ercTapeRescale\(\); \}\);/, "re-scaling is throttled to a frame, not run per scroll event");
});

test("DAY reads across the screen, and nothing that was in it is lost", () => {
  assert.match(src, /const ERC_DAY_SLOTS = \[\[0, "before the open"\], \[1, "at a set time"\], \[2, "after the close"\], \[3, "time not announced"\]\];/,
    "a report with no stated time says the time was not announced — it is never guessed");
  assert.match(src, /\.se-dcols\{ display:flex; gap:10px; align-items:stretch; \}/);
  assert.match(src, /const grow = Math\.min\(6, 1 \+ Math\.round\(inSlot\.length \/ 3\)\);/,
    "MEASURED on Nov 4 (38 reports, 37 of them with no stated time): four equal columns pushed the names off the bottom of the panel");
  assert.match(src, /\.se-dlist\{ display:grid; grid-template-columns:repeat\(auto-fill, minmax\(94px, 1fr\)\)/,
    "a busy slot wraps its names across its own width instead of falling down the page");
  assert.match(src, /EVERYTHING UPCOMING AND EVERYTHING REPORTED · the older list/, "the older DAY list is kept, one click down");
  assert.match(src, /\(open \? ercCardHTML\(open\) : ""\)/, "a name still opens the same full card the other views draw");
  /* the room points itself at a day that has something on it, and says that it did */
  assert.match(src, /function ercResolveAnchor\(\) \{[\s\S]*?S\.ernDay = next \|\| today;/);
  assert.match(src, /nothing reports today — this is the next day that does/);
  assert.match(src, /NEXT DAY WITH REPORTS/);
});
