/* EVENTS 23 Sep evening (M26) — the earnings TIMELINE: the tape of the season,
   one bar per trading day, dragged left for history and right for what is coming.
   Alan: "a chart of the tick of the earnings tape… a scrollable oscillator."
   These tests pin the arithmetic and the wiring, not the pixels — the screenshots
   in deliverables/20260923/earnings-timeline/ carry the look. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = src.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };

const shared =
  grab(/function ernShift\(iso, n\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ERN_WD = \[[^\]]*\];/) + "\n" +
  grab(/const ERN_MO = \[[^\]]*\];/) + "\n" +
  grab(/const ernWeekday = \(iso\) =>[^\n]*\n/) +
  grab(/const ernMonthDay = \(iso\) =>[^\n]*\n/) +
  grab(/const esc = \(s\) => String[\s\S]*?&#39;"\);/) + "\n" +
  grab(/const ERC_TL_BACK = [^\n]*\n/) +
  grab(/const ERC_TL_WARM = [^\n]*\n/) +
  grab(/const ERC_TL_QUIET = [^\n]*\n/) +
  grab(/const ERC_TL_NAME_PCT = [^\n]*\n/) +
  grab(/const ercTlRange = \(anchor\) =>[^\n]*\n/) +
  grab(/function ercTlDays\(from, to\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercTlLevel = \(n\) =>[^\n]*\n/) +
  grab(/function ercTlScale\(counts\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercTlMonthSeg = \(ym, n\) =>[\s\S]*?"<\/span>";/) + "\n" +
  grab(/function ercTlColHTML\(d, list, sc, today, open\) \{[\s\S]*?\n\}/) + "\n" +
  'const ERC_MONTH_NAME = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];\n';
const fn = (name) => new Function(shared + "return " + name + ";")();
const ercTlDays = fn("ercTlDays"), ercTlScale = fn("ercTlScale"), ercTlLevel = fn("ercTlLevel");
const ercTlRange = fn("ercTlRange"), ercTlColHTML = fn("ercTlColHTML"), ercTlMonthSeg = fn("ercTlMonthSeg");
const ev = (ticker) => ({ ticker });

test("one bar per TRADING day: weekends carry no reports, so they carry no bar", () => {
  const days = ercTlDays("2026-09-21", "2026-10-02");   // two whole working weeks, Mon to Fri
  assert.deepEqual(days, ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25",
                          "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]);
  assert.equal(days.filter((d) => [0, 6].includes(new Date(d + "T12:00:00Z").getUTCDay())).length, 0, "no Saturday, no Sunday");
  assert.deepEqual(ercTlDays("2026-09-26", "2026-09-27"), [], "a weekend on its own is an empty tape, not a crash");
  assert.deepEqual(ercTlDays("2026-10-02", "2026-09-21"), [], "a backwards range returns nothing");
  const leap = ercTlDays("2028-02-28", "2028-03-01");
  assert.ok(leap.includes("2028-02-29"), "a leap day is a trading day like any other");
});

test("the window reaches back further than it reaches forward, because history is the point", () => {
  const r = ercTlRange("2026-09-23");
  assert.equal(r.from, "2026-03-27");
  assert.equal(r.to, "2027-01-21");
  assert.ok(r.from < "2026-09-23" && r.to > "2026-09-23", "today sits inside its own window");
});

test("the height is scaled to the busiest day ON SCREEN, so a quiet stretch still has a shape", () => {
  const busy = ercTlScale([0, 3, 12, 38, 1, 25]);
  assert.equal(busy.max, 38);
  assert.equal(busy.quiet, false);
  assert.equal(busy.pct(38), 82, "the busiest day fills the track, less the headroom its own count and name need");
  assert.equal(busy.pct(0), 0, "a day with nothing has no bar at all");
  assert.equal(busy.pct(19), 41, "half the busiest day is half the height");
  const quiet = ercTlScale([0, 1, 2, 1]);
  assert.equal(quiet.quiet, true, "a stretch whose busiest day is under four is called quiet");
  assert.equal(quiet.pct(2), 82, "out of season the tallest thing on screen still fills the track");
  assert.equal(quiet.pct(1), 41, "and the shape between days survives");
  assert.ok(ercTlScale([0, 0, 0]).quiet === false, "a stretch with nothing in it is empty, not 'quiet'");
  assert.equal(ercTlScale([1, 100]).pct(1), 12, "one lone report against a 100-name day still shows a stub");
});

test("the colour is the count itself and keeps MONTH's law: cyan under 12, orange from 12, red from 25", () => {
  assert.equal(ercTlLevel(0), "");
  assert.equal(ercTlLevel(1), "cool");
  assert.equal(ercTlLevel(11), "cool");
  assert.equal(ercTlLevel(12), "warm");
  assert.equal(ercTlLevel(24), "warm");
  assert.equal(ercTlLevel(25), "hot");
  assert.equal(ercTlLevel(38), "hot");
  /* the same two thresholds the MONTH cell uses, so the two views can never disagree */
  assert.match(src, /const lvl = n >= 25 \? "var\(--sv5\)" : n >= 12 \? "var\(--sv4\)" : "var\(--crk\)";/);
});

test("a bar carries its day, its count and — only when it is tall — its biggest name", () => {
  const sc = ercTlScale([3, 1]);   // the three-name day IS the busiest on this screen, so its bar is full height
  const big = ercTlColHTML("2026-11-04", [ev("AAPL"), ev("MSFT"), ev("NVDA")], sc, "2026-09-23", null);
  assert.match(big, /data-act="erntlday" data-d="2026-11-04"/, "a bar opens its own day");
  assert.match(big, /class="se-tlnm"[^>]*>AAPL</, "the biggest name rides the tall bar");
  assert.match(big, /3 names you track report · AAPL, MSFT, NVDA/, "the tooltip names them even when the bar cannot");
  const small = ercTlColHTML("2026-11-05", [ev("AAPL")], ercTlScale([38, 1]), "2026-09-23", null);   // one report against a 38-name day
  assert.doesNotMatch(small, /se-tlnm/, "a short bar carries no name, or the tape turns into text");
  assert.match(small, /1 name you track reports/, "one name is singular");
  const none = ercTlColHTML("2026-11-06", [], sc, "2026-09-23", null);
  assert.match(none, /height:0%/, "nothing reported means no bar");
  assert.match(none, /· nothing ·/, "and the tooltip says so rather than showing an empty box");
  assert.doesNotMatch(none, /se-tlv/, "a zero is never printed as a count");
  const today = ercTlColHTML("2026-09-23", [ev("MU")], sc, "2026-09-23", null);
  assert.match(today, /class="se-tlday is-today/, "today is marked");
  assert.match(today, /· today ·/);
  const past = ercTlColHTML("2026-09-22", [ev("MU")], sc, "2026-09-23", null);
  assert.match(past, /is-past/, "history is dimmed, not hidden");
  const open = ercTlColHTML("2026-11-04", [ev("AAPL")], sc, "2026-09-23", "2026-11-04");
  assert.match(open, /is-open/, "the day that is open on screen says so on its bar");
});

test("the month strip is built from the same column width as the bars, so it cannot drift", () => {
  assert.equal(ercTlMonthSeg("2026-09", 22), '<span class="se-tlmo" style="width:calc(var(--tlw) * 22)">SEP</span>');
  assert.match(ercTlMonthSeg("2027-01", 20), /JAN 2027/, "January carries the year, so a tape that crosses one says so");
  assert.match(src, /\.se-tl\{ --tlw:19px;/, "one width drives both rows");
  assert.match(src, /\.se-tlday\{ width:var\(--tlw\); flex:0 0 var\(--tlw\)/);
});

test("ten months of tape is read as two requests, and a full page is admitted out loud", () => {
  assert.match(src, /const parts = ercSpan\(\) === "TIMELINE"\s*\n\s*\? \[\{ from: r\.from, to: ernShift\(ercAnchor\(\), -1\) \}, \{ from: ercAnchor\(\), to: r\.to \}\]/);
  assert.match(src, /ERC_TRUNC = got\.some\(\(g\) => \(g \|\| \[\]\)\.length >= ERC_MAX\);/);
  assert.match(src, /bits\.push\("this range holds more rows than one read returns"\)/);
});

test("the tape keeps its place: a re-read never yanks it, a new window re-centres", () => {
  assert.match(src, /sc\.addEventListener\("scroll", \(\) => \{\s*\n\s*ERC_TL_AT = sc\.scrollLeft;/);
  assert.match(src, /if \(ERC_TL_AT != null\) sc\.scrollLeft = ERC_TL_AT;/);
  assert.match(src, /if \(ercSpan\(\) === "TIMELINE"\) ERC_TL_AT = null;/, "the arrows move the window, so the window re-centres");
  assert.match(src, /case "erntoday": \{ S\.ernDay = todayISO\(\); S\.ernPick = null; ERC_TL_AT = null;/);
  assert.match(src, /sc\.addEventListener\("click", \(e\) => \{ if \(moved > 4\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); \} \}, true\);/,
    "a drag across the tape must not open whatever day it ended on");
});

test("a bar opens that day underneath the tape, and opening it never moves the season", () => {
  assert.match(src, /case "erntlday": \{[\s\S]*?S\.ernTlDay = \(\(openEl \? openEl\.dataset\.d : ""\) === d \? "" : d\);[\s\S]*?renderEvents\(S\.coh\);/);
  /* the panel reuses the WEEK view's own chips and card, so a day here and a day
     there can never show different numbers */
  assert.match(src, /function ercTlDayHTML\(byDay, sc\) \{[\s\S]*?inSlot\.map\(ercChipHTML\)\.join\(""\)/);
  assert.match(src, /function ercTlDayHTML\(byDay, sc\) \{[\s\S]*?\(open \? ercCardHTML\(open\) : ""\)/);
  assert.match(src, /\[\[0, "before the open"\], \[1, "at a set time"\], \[2, "after the close"\], \[3, "time not announced"\]\]/,
    "a report with no stated time says the time was not announced — it is never guessed");
});

test("the tape auto-adjusts to what is on screen: the busiest VISIBLE day sets the height", () => {
  /* Alan: "the view should kind of auto-adjust in some way." The first paint is
     scaled to the whole window; from then on every drag re-scales to the days
     actually in front of the reader, and the name appears or goes as its bar
     crosses the threshold. The colour is never re-scaled — it stays the count. */
  assert.match(src, /const vis = cols\.filter\(\(c\) => c\.offsetLeft \+ c\.offsetWidth > L && c\.offsetLeft < R\);/);
  assert.match(src, /const scale = ercTlScale\(on\);/);
  assert.match(src, /bar\.style\.height = pct \+ "%";/);
  assert.match(src, /cnt\.style\.bottom = "calc\(" \+ pct \+ "% \+ 3px\)";/, "the count travels with the bar top");
  assert.match(src, /nm\.style\.display = pct >= ERC_TL_NAME_PCT \? "" : "none";/);
  assert.match(src, /rafid = requestAnimationFrame\(\(\) => \{ rafid = 0; ercTlRescale\(\); \}\);/, "re-scaling is throttled to a frame, not run per scroll event");
  assert.doesNotMatch(src.slice(src.indexOf("function ercTlRescale"), src.indexOf("function ercTlAfterPaint")),
    /ercTlLevel|className|classList\.(add|remove)/,
    "the re-scale moves heights and labels only: a day's colour cannot change because of what else is on screen");
  const col = ercTlColHTML("2026-11-04", [ev("AAPL"), ev("MSFT")], ercTlScale([2]), "2026-09-23", null);
  assert.match(col, /data-n="2"/, "each bar carries its own count, so the re-scale never has to re-read the rows");
  assert.match(ercTlColHTML("2026-11-06", [], ercTlScale([2]), "2026-09-23", null), /data-n="0"/);
});

test("the tape opens on the next day that has reports, and a deliberate close stays closed", () => {
  const src2 = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
  const def = new Function(src2.match(/function ercTlDefaultDay\(byDay, today\) \{[\s\S]*?\n\}/)[0] + "return ercTlDefaultDay;")();
  assert.equal(def({ "2026-09-23": [1], "2026-09-24": [1] }, "2026-09-23"), "2026-09-23", "today, when today has reports");
  assert.equal(def({ "2026-09-21": [1], "2026-09-25": [1] }, "2026-09-23"), "2026-09-25", "otherwise the next day that has some");
  assert.equal(def({ "2026-09-21": [1] }, "2026-09-23"), null, "nothing ahead means nothing is opened");
  assert.equal(def({ "2026-09-24": [] }, "2026-09-23"), null, "a day with an empty list is not 'the next day with reports'");
  /* "" is the reader closing it on purpose, and it is not overridden */
  assert.match(src2, /const ercTlOpenDay = \(byDay, today\) => \(S\.ernTlDay === "" \? null : \(S\.ernTlDay \|\| ercTlDefaultDay\(byDay, today\)\)\);/);
  assert.match(src2, /S\.ernTlDay = \(\(openEl \? openEl\.dataset\.d : ""\) === d \? "" : d\);/);
});
