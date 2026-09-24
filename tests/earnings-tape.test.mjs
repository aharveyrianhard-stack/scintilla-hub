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
  grab(/function ercTlMissing\(from, to, have\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTlMerge\(have, add\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTlChunks\(r\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ERC_TL_CHUNK = [^\n]*\n/) +
  grab(/const ERC_TR = 1e12, ERC_BN = 1e9;\n/) +
  grab(/function ercMoney\(v\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTlIndex\(rows, z, mcap, fav\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercLogoURL = \(t\) =>[^\n]*\n/) +
  grab(/function ernLogoHTML\(t, cls\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercQuarter1 = \(iso\) =>[^\n]*\n/) +
  grab(/const ercYear1 = \(iso\) =>[^\n]*\n/) +
  grab(/const ercQuarterNo = \(b\) =>[^\n]*\n/) +
  grab(/const ercMonday = \(iso\) =>[^\n]*\n/) +
  grab(/const ercMonth1 = \(iso\) =>[^\n]*\n/) +
  grab(/function ercBucketOf\(iso, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercBuckets\(from, to, z, dated\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercBucketEnd\(b, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercBucketSay\(b, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercBucketTick\(b, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const ercBucketOpens = \(z\) =>[^\n]*\n/) +
  grab(/const ercTlLevel = \(n\) =>[^\n]*\n/) +
  grab(/function ercTapeScale\(counts\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTlBarHTML\([\s\S]*?\n\}/) + "\n" +
  grab(/function ercTapeStripHTML\(buckets, z\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ercTapeSayHTML\(scoped, all, coh\) \{[\s\S]*?\n\}/) + "\n" +
  'const ERC_MONTH_NAME = ["JANUARY","FEBRUARY","MARCH","APRIL","MAY","JUNE","JULY","AUGUST","SEPTEMBER","OCTOBER","NOVEMBER","DECEMBER"];\n' +
  'const S = { ernZoom: "DAYS" };\nconst ercZoom = () => "DAYS";\n';
const fn = (name) => new Function(shared + "return " + name + ";")();
const ercBuckets = fn("ercBuckets"), ercTapeScale = fn("ercTapeScale"), ercTlLevel = fn("ercTlLevel");
const ercTapeStripHTML = fn("ercTapeStripHTML");
const ercTapeSayHTML = fn("ercTapeSayHTML"), ercBucketOf = fn("ercBucketOf");
const ercTlBarHTML = fn("ercTlBarHTML"), ercTlIndex = fn("ercTlIndex"), ercMoney = fn("ercMoney");
const ercTlMissing = fn("ercTlMissing"), ercTlMerge = fn("ercTlMerge"), ercTlChunks = fn("ercTlChunks");
/* the bar HTML takes one bucket's reading, so the tests build it the way the page does */
const bucket = (n, opt = {}) => ({ n, wt: opt.wt || 0, unk: opt.unk || 0, fav: !!opt.fav,
  names: (opt.names || []).map((t) => ({ t, m: null })) });
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

test("M40 — five zoom levels, and the timeline pages instead of re-reading a fixed window", () => {
  assert.deepEqual(fn("ERC_ZOOMS"), ["DAYS", "WEEKS", "MONTHS", "QUARTERS", "YEARS"]);
  assert.match(src, /ernZoom: "DAYS"/, "the room still opens on days");
  const Z = fn("ERC_ZOOM");
  assert.equal(Z.DAYS.back + Z.DAYS.fwd, 120, "four months of days on the first screen");
  assert.ok(Z.YEARS.back >= 2920, "a bar-a-year opens on at least eight years of season");
  for (const k of ["DAYS", "WEEKS", "MONTHS", "QUARTERS", "YEARS"]) assert.ok(Z[k].page > 0 && Z[k].w > 0);
  /* Alan: "the lookback should be way longer, months doesn't even fill the screen."
     The window is no longer pinned to the anchor's month: it GROWS as it is dragged,
     and only the stretches it does not already hold are asked for. */
  assert.deepEqual(ercTlMissing("2026-01-01", "2026-03-31", []), [{ from: "2026-01-01", to: "2026-03-31" }]);
  assert.deepEqual(ercTlMissing("2026-01-01", "2026-03-31", [{ from: "2026-01-01", to: "2026-02-10" }]),
    [{ from: "2026-02-11", to: "2026-03-31" }], "only the part that is not held is asked for");
  assert.deepEqual(ercTlMissing("2026-01-01", "2026-03-31", [{ from: "2025-01-01", to: "2027-01-01" }]), [],
    "a stretch already held is never asked for twice");
  assert.deepEqual(ercTlMissing("2026-01-01", "2026-03-31",
    [{ from: "2026-01-05", to: "2026-01-20" }, { from: "2026-02-01", to: "2026-02-28" }]),
    [{ from: "2026-01-01", to: "2026-01-04" }, { from: "2026-01-21", to: "2026-01-31" }, { from: "2026-03-01", to: "2026-03-31" }],
    "holes in the middle are found, in order");
  assert.deepEqual(ercTlMerge([{ from: "2026-01-01", to: "2026-01-31" }], { from: "2026-02-01", to: "2026-02-28" }),
    [{ from: "2026-01-01", to: "2026-02-28" }], "two touching stretches become one");
  const chunks = ercTlChunks({ from: "2026-01-01", to: "2026-12-31" });
  assert.ok(chunks.length >= 2 && chunks.every((c) => c.from <= c.to));
  assert.equal(chunks[0].from, "2026-01-01");
  assert.equal(chunks[chunks.length - 1].to, "2026-12-31", "the chunks cover the range exactly, with no gap and no overlap");
  for (let i = 1; i < chunks.length; i++) assert.ok(chunks[i].from > chunks[i - 1].to);
  assert.match(src, /const ERC_TL_FLOOR = "1996-01-01";/, "the tape stops where the stored calendar starts");
  assert.match(src, /const ERC_ZOOM_SPAN = \{ DAYS: "DAY", WEEKS: "WEEK", MONTHS: "MONTH", QUARTERS: "MONTH", YEARS: "MONTH" \};/);
  /* a quarter and a year are buckets like any other */
  assert.equal(ercBucketOf("2026-10-23", "QUARTERS"), "2026-10-01");
  assert.equal(ercBucketOf("2026-02-09", "QUARTERS"), "2026-01-01");
  assert.equal(ercBucketOf("2026-10-23", "YEARS"), "2026-01-01");
  assert.deepEqual(fn("ercBuckets")("2026-02-01", "2026-11-30", "QUARTERS", {}), ["2026-01-01", "2026-04-01", "2026-07-01", "2026-10-01"]);
  assert.deepEqual(fn("ercBuckets")("2024-06-01", "2026-03-01", "YEARS", {}), ["2024-01-01", "2025-01-01", "2026-01-01"]);
  assert.equal(fn("ercBucketEnd")("2026-10-01", "QUARTERS"), "2026-12-31");
  assert.equal(fn("ercBucketEnd")("2026-01-01", "YEARS"), "2026-12-31");
  assert.equal(fn("ercBucketSay")("2026-10-01", "QUARTERS"), "Q4 2026");
  assert.equal(fn("ercBucketTick")("2026-10-01", "QUARTERS"), "Q4");
  assert.equal(fn("ercBucketTick")("2026-01-01", "YEARS"), "2026", "a year bar is ticked with its year, not one digit");
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

test("NOTHING ON THE TAPE IS MYSTERIOUS: every bar says what it is, and now says what it weighs", () => {
  const sc = sc1(3, 1), w0 = sc1(0);
  const big = ercTlBarHTML("2026-11-04", "DAYS", bucket(3, { names: ["AAPL", "MSFT", "NVDA"] }), 9, "2026-09-23", null, "ALL", sc, w0);
  assert.match(big, /data-act="erntape" data-d="2026-11-04"/, "a bar opens its own day");
  assert.match(big, /click to open the day below/, "and the tooltip says so before it is clicked");
  assert.match(big, /3 names you track report · AAPL, MSFT, NVDA/);
  assert.match(big, /class="se-tlnm"[^>]*display:inline-flex[^>]*>.*AAPL/, "the biggest name rides a tall bar");
  const small = ercTlBarHTML("2026-11-05", "DAYS", bucket(1, { names: ["AAPL"] }), 1, "2026-09-23", null, "ALL", sc1(38, 1), w0);
  assert.match(small, /display:none/, "a short bar keeps its name hidden until a drag makes it tall");
  assert.match(small, /1 name you track reports/, "one name is singular");
  const none = ercTlBarHTML("2026-10-23", "DAYS", null, 14, "2026-09-23", null, "FAV", sc, w0);
  assert.match(none, /nothing for FAV · 14 reports across all names/);
  assert.match(none, /click to open the day below/);
  assert.match(none, /height:0%/, "nothing reported means no bar");
  assert.doesNotMatch(none, /se-tlv/, "a zero is never printed as a count");
  assert.doesNotMatch(none, /se-tlw/, "and nothing reporting weighs nothing");
  assert.match(ercTlBarHTML("2026-10-23", "DAYS", null, 0, "2026-09-23", null, "ALL", sc, w0), /nothing reports/);
  /* THE BLUE LINE — Alan: "I'm trying to click on it and it doesn't say… nothing." */
  const today = ercTlBarHTML("2026-09-23", "DAYS", bucket(1, { names: ["MU"] }), 1, "2026-09-23", null, "ALL", sc, w0);
  assert.match(today, /class="se-tlday is-today/);
  assert.match(today, /class="se-tlnow" title="the cyan line is TODAY, WED SEP 23 — everything left of it has happened/);
  assert.match(today, /this is where today sits/);
  /* M40 — THE MARKET-CAP WEIGHT (Alan: "a graphic or measure in the timeline that
     measures like the market cap weight of the companies reporting"). */
  const wsc = sc1(4e12, 1e11);
  const heavy = ercTlBarHTML("2026-10-29", "DAYS", bucket(4, { wt: 4e12, names: ["AAPL"] }), 4, "2026-09-23", null, "ALL", sc1(4), wsc);
  assert.match(heavy, /<u class="se-tlw" style="height:80%">/, "the heaviest bar's wash fills the track");
  assert.match(heavy, /\$4\.0T of market cap reporting/, "and the tooltip says the figure in words");
  assert.match(heavy, /data-w="4000000000000"/, "the weight rides the bar, so a re-scale never re-reads the rows");
  const partial = ercTlBarHTML("2026-10-30", "DAYS", bucket(5, { wt: 2e11, unk: 2, names: ["X"] }), 5, "2026-09-23", null, "ALL", sc1(5), wsc);
  assert.match(partial, /\(2 without a stored size\)/, "the names whose size has not arrived are counted, never guessed at");
  assert.equal(ercMoney(0), "", "no size is not a zero");
  assert.equal(ercMoney(3.14e12), "$3.1T");
  assert.equal(ercMoney(2.5e10), "$25.0B");
  /* M40 — the favourite star and the company logo */
  const fav = ercTlBarHTML("2026-10-29", "DAYS", bucket(2, { fav: true, names: ["MU"] }), 2, "2026-09-23", null, "ALL", sc1(2), w0);
  assert.match(fav, /class="se-tlstar"[^>]*>★</);
  assert.match(fav, /one of your favourites reports here/);
  assert.doesNotMatch(ercTlBarHTML("2026-10-29", "DAYS", bucket(2, { names: ["MU"] }), 2, "2026-09-23", null, "ALL", sc1(2), w0),
    /se-tlstar/, "a bar with no favourite in it wears no star");
  const logo = fn("ernLogoHTML")("NVDA", "se-lg--tl");
  assert.match(logo, /financialmodelingprep\.com\/image-stock\/NVDA\.png/);
  assert.match(logo, /onerror="ernLogoFail\(this\)"/, "an image that does not load steps aside");
  assert.match(logo, /<i>NVDA<\/i>/, "and the ticker is already in the page behind it");
  assert.match(src, /\.se-lg i\{ display:none;/, "the fallback is hidden until the image fails");
  /* a week, a quarter and a year bar explain themselves in their own unit */
  const wk = ercTlBarHTML("2026-10-19", "WEEKS", bucket(14, { names: ["AAPL", "MSFT"] }), 40, "2026-09-23", null, "ALL", sc1(14), w0);
  assert.match(wk, /the week of MON OCT 19 · 14 names you track report/);
  assert.match(wk, /click to open the week below/);
  const mo = ercTlBarHTML("2026-11-01", "MONTHS", bucket(120, { names: ["AAPL"] }), 300, "2026-09-23", "2026-11-01", "ALL", sc1(120), w0);
  assert.match(mo, /NOVEMBER 2026 · 120 names you track report/);
  assert.match(mo, /is-open/, "the bar the grid is sitting on says so");
  assert.match(mo, /data-n="120"/);
  assert.match(mo, /class="se-tlx">NOV</);
  const q = ercTlBarHTML("2026-10-01", "QUARTERS", bucket(340, { names: ["AAPL"] }), 340, "2026-09-23", null, "ALL", sc1(340), w0);
  assert.match(q, /Q4 2026 · 340 names you track report/);
  const yr = ercTlBarHTML("2019-01-01", "YEARS", bucket(1200, { names: ["AAPL"] }), 1200, "2026-09-23", null, "ALL", sc1(1200), w0);
  assert.match(yr, /2019 · 1200 names you track report/);
  assert.match(yr, /is-past/, "a year that is over is drawn as past");
  /* the strip under the bars */
  const strip = ercTapeStripHTML(["2026-09-21", "2026-09-28", "2026-10-05"], "WEEKS");
  assert.match(strip, /<span class="se-tlmo" style="width:calc\(var\(--tlw\) \* 2\)" title="SEP · 2 bars">SEP<\/span>/);
  assert.match(ercTapeStripHTML(["2027-01-04"], "WEEKS"), /JAN 2027/);
  assert.match(ercTapeStripHTML(["2026-01-01", "2026-02-01"], "MONTHS"), /title="2026 · 2 bars">2026</);
  assert.match(ercTapeStripHTML(["2019-01-01", "2018-01-01"], "YEARS"), /2010s/, "a tape of years is grouped by decade");
  assert.match(src, /style="--tlw:' \+ ERC_ZOOM\[z\]\.w \+ 'px"/, "one width per zoom drives the bars and the strip under them");
});

test("M40 — the weight, the star and the names come from one pure index", () => {
  const rows = [
    { ticker: "AAPL", date: "2026-10-29" }, { ticker: "MSFT", date: "2026-10-29" },
    { ticker: "TINY", date: "2026-10-29" }, { ticker: "MU", date: "2026-11-02" },
  ];
  const idx = ercTlIndex(rows, "DAYS", { AAPL: 3.4e12, MSFT: 3.1e12, MU: 2e11 }, ["MU"]);
  assert.equal(idx["2026-10-29"].n, 3);
  assert.equal(idx["2026-10-29"].wt, 6.5e12, "the weight is the sum of the sizes it knows");
  assert.equal(idx["2026-10-29"].unk, 1, "and the one it does not know is counted, not guessed");
  assert.equal(idx["2026-10-29"].fav, false);
  assert.deepEqual(idx["2026-10-29"].names.map((x) => x.t), ["AAPL", "MSFT", "TINY"], "biggest first, the unsized last");
  assert.equal(idx["2026-11-02"].fav, true, "a favourite in the bucket raises the star");
  const byMonth = ercTlIndex(rows, "MONTHS", {}, []);
  assert.equal(byMonth["2026-10-01"].n, 3);
  assert.equal(byMonth["2026-11-01"].n, 1);
  assert.equal(ercTlIndex([], "DAYS", {}, [])["2026-10-29"], undefined, "no rows, no bucket");
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

test("M40 — the tape moves the grid; the grid never moves the tape", () => {
  assert.match(src, /case "erntape": \{[\s\S]*?S\.ernDay = d; S\.ernSpan = ERC_ZOOM_SPAN\[ercZoom\(\)\] \|\| "DAY";/);
  const tap = src.slice(src.indexOf('case "erntape"'), src.indexOf('case "ernchip"'));
  assert.ok(!/ERC_TL_FROM|ERC_TL_TO|S\.ernTlAt|ERC_TAPE_AT = null/.test(tap),
    "tapping a bar must not re-range or re-centre the tape the reader is dragging");
  const nav = src.slice(src.indexOf('case "ernnav"'), src.indexOf('case "erntlnow"'));
  assert.ok(!/ERC_TL_FROM|ERC_TL_TO|S\.ernTlAt|ERC_TAPE_AT/.test(nav),
    "Alan: the timeline header is not ruled by the date selector arrows");
  assert.match(src, /case "erntlnow": \{ ercTlToday\(\); break; \}/, "the timeline has a TODAY of its own");
  assert.match(src, /const ercTlCentre = \(\) => S\.ernTlAt \|\| todayISO\(\);/);
  assert.match(src, /const ercTapePointer = \(\) => ercBucketOf\(ercAnchor\(\), ercZoom\(\)\);/,
    "and the tape still marks the bucket the grid is sitting in");
  assert.match(src, /'<div id="ernTape"><\/div>' \+/, "the tape is its own element, outside the grid's scroller");
  const tapeHead = src.slice(src.indexOf("'<div class=\"se-tapehd\">'"), src.indexOf('id="ernTlScroll"'));
  assert.ok(!/data-act="ernnav"/.test(tapeHead), "the tape header does not repeat the grid's arrows");
  assert.match(tapeHead, /ercZoomBarHTML\(\)/);
});

test("zoom: pinch, ⌘/ctrl-wheel or the strip — one level per gesture, and a plain wheel still walks the season", () => {
  assert.match(src, /if \(e\.ctrlKey \|\| e\.metaKey\) \{ e\.preventDefault\(\); ercZoomStep\(e\.deltaY > 0 \? 1 : -1\); return; \}/);
  assert.match(src, /if \(Math\.abs\(e\.deltaY\) > Math\.abs\(e\.deltaX\)\) \{ sc\.scrollLeft \+= e\.deltaY; e\.preventDefault\(\); \}/);
  assert.match(src, /if \(Date\.now\(\) - ERC_ZOOM_AT < 260\) return;/, "a single pinch cannot run from days to months");
  assert.match(src, /case "ernzoom": \{ ercSetZoom\(a\.dataset\.z\); break; \}/);
  assert.match(src, /S\.ernZoom = z; ERC_TAPE_AT = null;/, "a new unit re-centres the tape on the pointer");
});

test("the timeline's own read is small, wide, unscoped — and paged", () => {
  const read = src.slice(src.indexOf("async function ercTlPump"), src.indexOf("/* the old name, kept"));
  assert.match(read, /pgErn\("earnings_events\?select=ticker,date&date=gte\./, "ticker and date only, live rows only (a retired date is not a report)");
  assert.match(read, /if \(\(got \|\| \[\]\)\.length >= ERC_MAX\) ERC_TL_TRUNC = true;/, "a full page is admitted out loud");
  assert.match(read, /if \(ERC_TL_SEEN\.has\(k\)\) return;/, "a report already held is never counted twice");
  assert.ok(!/scopeItems/.test(read), "it is read unscoped, so the room can always say how many exist across all names");
  assert.match(src, /const ERC_TL_CHUNK = 180;/, "a chunk this size cannot reach the 1,000-row ceiling");
  assert.match(src, /const ERC_TL_MAXQ = 3;/, "a long stretch pages in a few requests at a time, not all at once");
  assert.match(src, /if \(ERC_TL_FAIL_AT && Date\.now\(\) - ERC_TL_FAIL_AT < ERC_RETRY_MS\) return;/, "a failed read waits before asking again");
  assert.match(read, /ERC_TL_Q\.unshift\(ch\);/, "and the stretch that failed is put back, not dropped");
  assert.match(src, /ERC_TL_Q\.sort\(\(a, b\) => ercTlDist\(c, a\) - ercTlDist\(c, b\)\);/, "the season nearest the reader arrives first");
});

test("the tape keeps its place, pages at its edges, and a drag never opens the bar it ended on", () => {
  assert.match(src, /sc\.addEventListener\("scroll", \(\) => \{\s*\n\s*ERC_TAPE_AT = sc\.scrollLeft;/);
  assert.match(src, /if \(ERC_TAPE_AT == null\) centre\(\);/);
  assert.match(src, /sc\.addEventListener\("click", \(e\) => \{ if \(moved > 4\) \{ e\.stopPropagation\(\); e\.preventDefault\(\); \} \}, true\);/);
  /* M40 — dragging towards an end asks for the next stretch instead of stopping dead */
  const edge = src.slice(src.indexOf("function ercTlEdgeCheck"), src.indexOf("/* after every paint"));
  assert.match(edge, /if \(sc\.scrollLeft < ERC_TL_EDGE_PX && span\.from > ercTlFloor\(\)\)/);
  assert.match(edge, /if \(sc\.scrollWidth - sc\.clientWidth - sc\.scrollLeft < ERC_TL_EDGE_PX && span\.to < ercTlCeil\(\)\)/);
  assert.match(edge, /ERC_TAPE_AT = sc\.scrollLeft;/, "the offset is kept, so the season grows without moving under the thumb");
  assert.match(src, /rafid = requestAnimationFrame\(\(\) => \{ rafid = 0; ercTapeRescale\(\); ercTlEdgeCheck\(sc\); \}\);/);
  /* the re-scale moves heights only: a bar's colour cannot change because of what
     else happens to be on screen */
  const rescale = src.slice(src.indexOf("function ercTapeRescale"), src.indexOf("/* PAGING AS YOU MOVE"));
  assert.doesNotMatch(rescale, /ercTlLevel|className|classList\.(add|remove)/);
  assert.match(rescale, /wash\.style\.height = wscale\.pct/, "the weight wash rescales with the bars it sits behind");
});

test("DAY reads across the screen, and nothing that was in it is lost", () => {
  assert.match(src, /const ERC_DAY_SLOTS = \[\[0, "before the open"\], \[1, "at a set time"\], \[2, "after the close"\], \[3, "time not announced"\]\];/,
    "a report with no stated time says the time was not announced — it is never guessed");
  assert.match(src, /\.se-dcols\{ display:flex; gap:10px; align-items:stretch; \}/);
  assert.match(src, /const grow = Math\.min\(6, 1 \+ Math\.round\(inSlot\.length \/ 3\)\);/,
    "MEASURED on Nov 4 (38 reports, 37 of them with no stated time): four equal columns pushed the names off the bottom of the panel");
  assert.match(src, /\.se-dlist\{ display:grid; grid-template-columns:repeat\(auto-fill, minmax\(94px, 1fr\)\)/,
    "a busy slot wraps its names across its own width instead of falling down the page");
  /* M40 — the older list moved from a <details> under the day to a TAB of its own.
     Alan: "the slider tape of earnings is not a replacement for the earnings section
     we had before… not ready to trash what I had." */
  assert.match(src, /one\("OLD", "THE OLDER LIST", "the earnings section as it was before this revamp — kept, not thrown away"\)/);
  assert.match(src, /function ercOldListHTML\(cohort\) \{/);
  assert.match(src, /the earnings section as it was before the 24 Sep revamp · kept here until you say it can go/);
  assert.match(src, /\(open \? ercCardHTML\(open\) : ""\)/, "a name still opens the same full card the other views draw");
  /* the room points itself at a day that has something on it, and says that it did */
  assert.match(src, /function ercResolveAnchor\(\) \{[\s\S]*?S\.ernDay = next \|\| today;/);
  assert.match(src, /nothing reports today — this is the next day that does/);
  assert.match(src, /NEXT DAY WITH REPORTS/);
});
