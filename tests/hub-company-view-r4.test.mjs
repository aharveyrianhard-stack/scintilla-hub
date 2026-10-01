/* R4 (28 Sep) — THE COMPANY VIEW, ROUND 4: Alan's notes on the round-3 trial.
   SOCIAL: "Bera Finance is mentioned a lot. I don't think those are channels I subscribe to. Where are you pulling this
   from?" and "does it analyse bullish vs bearish?" · EARNINGS per ticker, left to right, BEAT / DOUBLE BEAT / MISS / INLINE ·
   "this weird thing that is all cropped" · the LIKED list sorts by the day's % or by Geiger.
   Offline: functions are sliced out of the page by name and run with stubs; nothing leaves the process. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const start = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(start >= 0, name + " present");
  return page.slice(start, page.indexOf("\n}\n", start) + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0] + "\n"; };
const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const num = (v) => { if (v == null) return null; const n = typeof v === "number" ? v : parseFloat(v); return Number.isFinite(n) ? n : null; };

/* ── SOCIAL: where it comes from ──────────────────────────────────────────────────────────────────── */
const soc = new Function("esc", "num",
  line(/^const SOC_LEGAL = [^\n]*/m) + page.match(/^const SOC_GENERIC = new Set\(\[[\s\S]*?\]\);\n/m)[0] +
  fn("socKeywords") + fn("socHits") + fn("socMatchYT") + fn("socLeanOf") + fn("socLeanX") + fn("socLeanYT") + fn("socLeanTally") + fn("socLeanHow") + fn("socLeanChip") +
  "\nreturn { socKeywords, socMatchYT, socLeanX, socLeanYT, socLeanTally, socLeanChip };")(esc, num);

test("SOCIAL YouTube: every video says whether it is from a channel you subscribe to or from the ticker search", () => {
  const kws = soc.socKeywords("MU", "Micron Technology, Inc.", false);
  const vids = [
    { video_id: "s1", ticker: null, channel_id: "UCsub", channel_title: "Mike Jones Investing", title: "Micron into earnings", published_at: "2026-09-26T10:00:00Z", source: "subscription", subscription_accounts: ["scintilla"] },
    { video_id: "b1", ticker: "MU", channel_id: "UCbera", channel_title: "Bera Finance", title: "MU stock prediction", published_at: "2026-09-26T09:00:00Z", source: "search", subscription_accounts: [] },
    { video_id: "s2", ticker: "MU", channel_id: "UCsub", channel_title: "Mike Jones Investing", title: "Memory names", published_at: "2026-09-25T09:00:00Z", source: "search", subscription_accounts: [] },
  ];
  const ys = soc.socMatchYT(vids, "MU", kws);
  assert.deepEqual(ys.map((y) => [y.who, y.sub]), [["Mike Jones Investing", true], ["Bera Finance", false], ["Mike Jones Investing", true]],
    "Bera Finance is search-found; a search hit from a channel you DO subscribe to counts as yours");
  const yours = ys.filter((i) => i.sub !== false);
  assert.equal(yours.length, 2, "YOUR CHANNELS leaves Bera Finance out");
});

test("SOCIAL YouTube (review fix): a search-found SPY video from a channel you subscribe to is YOURS even when no subscription video matched", () => {
  const kws = soc.socKeywords("SPY", "SPDR S&P 500 ETF Trust", true);
  const vids = [
    { video_id: "r1", ticker: "SPY", channel_id: "UClGy2KQicZBAcNWVk1pOKYA", channel_title: "Rey Jay's Trades", title: "SPY levels for Monday", published_at: "2026-09-27T10:00:00Z", source: "search", subscription_accounts: [] },
    { video_id: "b1", ticker: "SPY", channel_id: "UCbera", channel_title: "Bera Finance", title: "SPY prediction", published_at: "2026-09-27T09:00:00Z", source: "search", subscription_accounts: [] },
  ];
  /* before the fix: nothing in the read is a subscription, so nothing could be yours */
  assert.deepEqual(soc.socMatchYT(vids, "SPY", kws).map((y) => y.sub), [false, false]);
  /* with the channel-level set (what socSubChannels fills from youtube_videos, source = subscription) */
  const ys = soc.socMatchYT(vids, "SPY", kws, new Map([["UClGy2KQicZBAcNWVk1pOKYA", ["scintilla"]]]));
  assert.deepEqual(ys.map((y) => [y.who, y.sub, y.accts]), [["Rey Jay's Trades", true, ["scintilla"]], ["Bera Finance", false, []]]);
  assert.match(fn("socListHTML"), /it\.sub === false \? "YT · SEARCH" : "YT · YOURS"/);
});

test("SOCIAL YouTube (review fix): the subscribed-channel check asks only for these channels, 60 at a time, read-only, and remembers the answer", async () => {
  const calls = [];
  const pg = async (path) => { calls.push(path); const ids = path.match(/channel_id=in\.\(([^)]*)\)/)[1].split(",");
    return ids.filter((c) => c.startsWith("SUB")).map((c) => ({ channel_id: c, subscription_accounts: ["personal"] })); };
  const m = new Function("pg", page.match(/^const SOC_SUBCH = [^\n]*\n/m)[0] + fn("socSubChannels") + "\nreturn { socSubChannels, SOC_SUBCH, SOC_NOTSUB };")(pg);
  const ids = Array.from({ length: 130 }, (_, i) => (i % 13 === 0 ? "SUB" : "UC") + i);
  assert.equal(await m.socSubChannels(ids.concat([null, "bad id)"])), true);
  assert.equal(calls.length, 3, "130 channels → three reads");
  for (const c of calls) assert.match(c, /^youtube_videos\?select=channel_id,subscription_accounts&source=eq\.subscription&channel_id=in\.\([A-Za-z0-9_,-]+\)&limit=5000$/);
  assert.equal(m.SOC_SUBCH.size, 10); assert.equal(m.SOC_NOTSUB.size, 120);
  assert.equal(await m.socSubChannels(ids), true); assert.equal(calls.length, 3, "known channels are not asked again");
  const bad = new Function("pg", page.match(/^const SOC_SUBCH = [^\n]*\n/m)[0] + fn("socSubChannels") + "\nreturn { socSubChannels };")(async () => { throw new Error("503"); });
  assert.equal(await bad.socSubChannels(["UCx"]), false, "a failed read is reported, not guessed");
  assert.match(fn("socBodyHTML"), /the subscribed-channel check did not answer/);
  assert.match(fn("coSocialLoad"), /await socSubChannels\(\(vids \|\| \[\]\)\.filter\(\(r\) => r\.source !== "subscription"\)/);
});

test("SOCIAL: the tab defaults to YOUR CHANNELS, keeps + YOUTUBE SEARCH as a labelled second view, and prints each source", () => {
  assert.match(fn("socView"), /=== "ALL" \? "ALL" : "YOURS"/, "anything but an explicit ALL is YOURS");
  const note = fn("socSourceNoteHTML");
  assert.match(note, /YOUTUBE · YOUR CHANNELS<\/b> only channels your YouTube accounts subscribe to \(youtube_videos, source = subscription\)\. Search-found channels are left out\./);
  assert.match(note, /e\.g\. Bera Finance/);
  assert.match(note, /X · YOUR LIST/);
  const body = fn("socBodyHTML");
  assert.match(body, /v === "ALL" \? d\.ys : d\.ys\.filter\(\(i\) => i\.sub !== false\)/);
  assert.match(fn("socListHTML"), /it\.sub === false \? "YT · SEARCH" : "YT · YOURS"/, "every YouTube row names its source");
  const h = fn("coSocialHTML");
  assert.match(h, /data-act="socview" data-v="YOURS"[^>]*>YOUR CHANNELS</);
  assert.match(h, /data-act="socview" data-v="ALL"[^>]*>\+ YOUTUBE SEARCH</);
  assert.match(page, /case "socview": \{[\s\S]{0,200}lsSet\(SOC_VIEW_KEY, a\.dataset\.v === "ALL" \? "ALL" : "YOURS"\);/);
});

test("SOCIAL lean: a scored video carries its STORED lean; anything else is read on the page and marked ·p; nothing is written", () => {
  const items = [
    { src: "YT", id: "v1", sub: false, text: "MU crash coming", at: "2026-09-27T10:00:00Z" },
    { src: "YT", id: "v2", sub: false, text: "MU to the moon", at: "2026-09-27T10:00:00Z" },
    { src: "YT", id: "v3", sub: true, text: "Micron breakout, strong buy", at: "2026-09-27T10:00:00Z" },
    { src: "YT", id: "v4", sub: true, text: "Micron earnings preview", at: "2026-09-27T10:00:00Z" },
    { src: "X", text: "breakout, strong buy", at: "2026-09-27T10:00:00Z" },
    { src: "X", text: "weak guide, sell", at: "2026-09-27T10:00:00Z" },
  ];
  const lex = (t) => (/buy|breakout/.test(t) ? 2 : 0) - (/sell|weak/.test(t) ? 2 : 0);
  soc.socLeanYT(items, [{ video_id: "v1", lean: 0.5, sample_src: "title" }, { video_id: "v2", lean: -0.25, sample_src: "title" }], lex);
  soc.socLeanX(items, lex);
  assert.deepEqual(items.map((i) => i.lean), ["bull", "bear", "bull", "flat", "bull", "bear"], "the STORED lean wins over the page's reading of the same title");
  assert.deepEqual(items.map((i) => i.leanHow), ["stored", "stored", "page", "page", "page", "page"]);
  const tally = soc.socLeanTally(items, Date.parse("2026-09-28T10:00:00Z"), 7);
  assert.deepEqual(tally, { bull: 3, bear: 2, flat: 1, none: 0 });
  assert.match(soc.socLeanChip(items[0]), /▲ BULLISH<\/span>/, "a stored lean has no ·p mark");
  assert.match(soc.socLeanChip(items[2]), /▲ BULLISH<i>·p<\/i>/, "a page reading is marked ·p");
  assert.match(soc.socLeanChip(items[2]), /worked out on this page from the title/);
  assert.match(soc.socLeanChip({ src: "YT", lean: null, leanHow: "none" }), /NOT SCORED/);
  const load = fn("coSocialLoad");
  assert.match(load, /pg\("youtube_video_sentiment\?select=video_id,lean,sample_src&ticker=eq\." \+ T/, "one read of the stored leans for this name");
  assert.match(load, /SENTI\.lexLean/, "the page's reading is the SENTIMENT room's own word list");
  assert.doesNotMatch(load, /method:\s*"(POST|PATCH|DELETE)"/, "nothing is written");
});

test("SOCIAL: a stale X feed is called STALE, not shown as today's silence", () => {
  const load = fn("coSocialLoad");
  assert.match(load, /const xStale = newestX && nowMs - Date\.parse\(newestX\) > 36 \* 3600e3;/);
  assert.match(load, /STALE<\/b>/);
});

/* ── EARNINGS strip ───────────────────────────────────────────────────────────────────────────────── */
const ern = new Function("num", "transcriptExists",
  line(/^const ERN_INLINE_PCT = [^\n]*/m) + fn("ernMetricVerdict") + fn("ernQuarterVerdict") + fn("ernStripCells") +
  "\nreturn { ernMetricVerdict, ernQuarterVerdict, ernStripCells, ERN_INLINE_PCT };")(num, (t, d, days) => (days || []).includes(d));

test("EARNINGS: each metric is a beat above +1%, a miss below −1%, in line between; the quarter's word combines both", () => {
  assert.equal(ern.ERN_INLINE_PCT, 1);
  const v = (a, e) => ern.ernMetricVerdict(a, e).v;
  assert.equal(v(25.11, 20.98), "beat");
  assert.equal(v(8709e6, 8714.4e6), "inline", "MU Dec 2024 revenue: −0.06% is in line");
  assert.equal(v(0.95, 1.0), "miss");
  assert.equal(v(-0.95, -0.99), "beat", "a smaller loss than expected is a beat (divides by |estimate|)");
  assert.equal(v(1, null), null, "no estimate, no verdict");
  const q = (e, r) => ern.ernQuarterVerdict({ v: e }, { v: r });
  assert.equal(q("beat", "beat"), "DOUBLE BEAT");
  assert.equal(q("beat", "inline"), "BEAT");
  assert.equal(q("beat", null), "BEAT", "revenue not stored");
  assert.equal(q("inline", "inline"), "INLINE");
  assert.equal(q("beat", "miss"), "MIXED");
  assert.equal(q("miss", "inline"), "MISS");
  assert.equal(q("miss", "miss"), "DOUBLE MISS");
  assert.equal(q(null, null), null);
});

test("EARNINGS strip: oldest left, newest right, the next report last; transcripts only where a call is stored", () => {
  const rows = [
    { ticker: "MU", date: "2026-09-30", eps_actual: null, eps_estimate: 31.62, revenue_estimate: 51192760000, report_time: "AMC" },
    { ticker: "MU", date: "2026-06-24", eps_actual: 25.11, eps_estimate: 20.98, revenue_actual: 41456000000, revenue_estimate: 35911900000, report_time: "AMC" },
    { ticker: "MU", date: "2024-12-18", eps_actual: 1.79, eps_estimate: 1.75, revenue_actual: 8709000000, revenue_estimate: 8714396051 },
    { ticker: "MU", date: "2026-03-18", eps_actual: 12.2, eps_estimate: 9.19, revenue_actual: 23860000000, revenue_estimate: 19966650000, release_link: "https://sec.gov/x" },
    { ticker: "MU", date: "2025-08-01", eps_actual: null, eps_estimate: 2 },   /* a past date with no result is not a report */
  ];
  const cells = ern.ernStripCells(rows, "2026-09-28", ["2026-06-24"], 16);
  assert.deepEqual(cells.map((c) => c.date), ["2024-12-18", "2026-03-18", "2026-06-24", "2026-09-30"]);
  assert.deepEqual(cells.map((c) => c.verdict || (c.next ? "NEXT" : "")), ["BEAT", "DOUBLE BEAT", "DOUBLE BEAT", "NEXT"]);
  assert.equal(cells[2].transcript, true); assert.equal(cells[1].transcript, false);
  assert.equal(cells[1].release, "https://sec.gov/x");
  assert.equal(Math.round(cells[2].eps.pct * 10) / 10, 19.7);
  assert.equal(cells[3].epsEst, 31.62);
});

test("EARNINGS strip on a report day: once today's numbers are stored they are a result card, and NEXT moves on", () => {
  const est = { ticker: "MU", date: "2026-09-30", eps_actual: null, eps_estimate: 31.62, revenue_estimate: 51192760000, report_time: "AMC" };
  const prior = { ticker: "MU", date: "2026-06-24", eps_actual: 25.11, eps_estimate: 20.98, revenue_actual: 41456000000, revenue_estimate: 35911900000 };
  const later = { ticker: "MU", date: "2026-12-16", eps_actual: null, eps_estimate: 33.1 };
  /* evening of Sep 30, before the result is stored: the day's report is still NEXT */
  let cells = ern.ernStripCells([est, prior, later], "2026-09-30", [], 16);
  assert.deepEqual(cells.map((c) => [c.date, !!c.next]), [["2026-06-24", false], ["2026-09-30", true]]);
  /* the result lands the same evening: Sep 30 is a result card, and NEXT is the following report */
  const landed = Object.assign({}, est, { eps_actual: 33.4, revenue_actual: 52000000000 });
  cells = ern.ernStripCells([landed, prior, later], "2026-09-30", [], 16);
  assert.deepEqual(cells.map((c) => [c.date, !!c.next]), [["2026-06-24", false], ["2026-09-30", false], ["2026-12-16", true]]);
  assert.equal(cells[1].verdict, "DOUBLE BEAT", "EPS +5.6% and revenue +1.6% against estimates");
});

test("EARNINGS strip leads the company EVENTS tab, with its legend, and the AI READ placeholder is gone from it", () => {
  const ev = fn("coEventsHTML");
  assert.match(ev, /'<div class="sc-evfix">' \+ ernStripHTML\(data\) \+ topRow/);
  assert.doesNotMatch(ev, /sc-evtop2__ai/, "no AI READ · coming box beside the next report");
  const h = fn("ernStripHTML");
  for (const w of ["DOUBLE BEAT", "BEAT", "INLINE", "MIXED", "MISS", "DOUBLE MISS"]) assert.ok(h.includes(">" + w + "</b>"), w + " is in the legend");
  assert.match(h, /is our setting, not a market rule/);
  assert.match(h, /no transcript web link is stored/);
  assert.match(h, /data-act="fulltranscript"/, "the stored transcript opens in the Hub's own reader");
  assert.match(page, /order=date\.desc&limit=24";/, "enough rows for 16 reports");
});

/* ── LIKED list sort ─────────────────────────────────────────────────────────────────────────────── */
test("LIKED list: sorts by the day's % or by Geiger, highest first, a missing value last; the keys follow it", () => {
  const order = new Function("num", fn("cvRailOrder") + "\nreturn cvRailOrder;")(num);
  const rows = [{ t: "A", c: -1.2, g: 0.6 }, { t: "B", c: 2.0, g: null }, { t: "C", c: null, g: 0.9 }, { t: "D", c: 0.4, g: -0.3 }];
  assert.deepEqual(order(rows, "CHG").map((r) => r.t), ["B", "D", "A", "C"]);
  assert.deepEqual(order(rows, "GEIGER").map((r) => r.t), ["C", "A", "D", "B"]);
  assert.match(fn("cvRailSort"), /=== "CHG" \? "CHG" : "GEIGER"/);
  const h = fn("cvRailHTML");
  assert.match(h, /sw\("CHG", "DAY %"/); assert.match(h, /sw\("GEIGER", "GEIGER"/);
  assert.match(h, /geigerMiniHTML\(num\(r\.g\), 1\)/, "the slim mini Geiger stays under every name");
  assert.match(fn("cvStep"), /document\.body\.classList\.contains\("co-exp"\) \? cvRailRows\(\) : orderedShownRows\(\)/);
});

test("LIKED list (review fix): the order holds still between explicit sorts — ticks update values, not places", () => {
  const S = { coh: "FAV", tq: "" }, ls = { "hub.company.railsort": "CHG" };
  let live = [{ t: "A", c: 1.0 }, { t: "B", c: 2.0 }, { t: "VIX", c: null }, { t: "D", c: 0.5 }];
  const m = new Function("num", "S", "lsGet", "orderedShownRows",
    line(/^const CV_RAIL_SORT_KEY = [^\n]*/m) + fn("cvRailSort") + fn("cvRailOrder") + line(/^let CV_RAIL_FROZEN = [^\n]*/m) +
    fn("cvRailKey") + fn("cvRailFreeze") + fn("cvRailHeld") + fn("cvRailRows") + "\nreturn { cvRailRows, cvRailFreeze };")(num, S, (k) => ls[k], () => live);
  assert.deepEqual(m.cvRailRows().map((r) => r.t), ["B", "A", "D", "VIX"], "first look: sorted by DAY %, no value last");
  /* ticks: D jumps to the top of the day, VIX gets a value, a new name E arrives, A leaves */
  live = [{ t: "B", c: 2.0 }, { t: "VIX", c: 9.9 }, { t: "D", c: 5.5 }, { t: "E", c: 7.0 }];
  const held = m.cvRailRows();
  assert.deepEqual(held.map((r) => r.t), ["B", "D", "VIX", "E"], "places hold; the newcomer goes last; the leaver is dropped");
  assert.equal(held[1].c, 5.5, "values are the live ones");
  m.cvRailFreeze();   /* a click on DAY % */
  assert.deepEqual(m.cvRailRows().map((r) => r.t), ["VIX", "E", "D", "B"], "an explicit click re-sorts");
  ls["hub.company.railsort"] = "GEIGER";
  assert.equal(m.cvRailRows().length, 4, "switching the sort (or the cohort, or a search) takes a fresh order");
  assert.match(page, /case "cvrailsort": \{[\s\S]{0,260}cvRailFreeze\(\);[\s\S]{0,120}cvRailRepaint\(true\);/);   /* H2 (30 Sep) — a re-sort also brings the open name into view */
  assert.match(page, /if \(CO_EXPANDED\) cvRailFreeze\(\);/);
  assert.doesNotMatch(fn("cvRailRepaint"), /cvRailFreeze/, "a repaint (every tick) never re-sorts");
});

/* ── cropped things ──────────────────────────────────────────────────────────────────────────────── */
test("CROPPED: short names where the legal name was cut, a K tier for small revenue, the one-line scintilla fits", () => {
  const short = new Function(fn("scShortName") + "\nreturn scShortName;")();
  assert.equal(short("Micron Technology, Inc. · NASDAQ"), "Micron Technology");
  assert.equal(short("NVIDIA Corporation"), "NVIDIA");
  assert.equal(short("Arm Holdings plc"), "Arm");
  assert.equal(short("SPDR S&P 500 ETF Trust"), "SPDR S&P 500 ETF Trust");
  const cap = new Function("num", fn("fmtCap") + "\nreturn fmtCap;")(num);
  assert.equal(cap(768574), "$769K"); assert.equal(cap(31.9e6), "$31.9M"); assert.equal(cap(1.2e12), "$1.2T");
  const says = new Function("scintSays", fn("scintSaysShort") + "\nreturn scintSaysShort;")(() =>
    "(4.89%) · 1.5× its usual day (usual: ±3.3% a day, measured over its last 250 sessions) · a big move on its own (over the 8% floor for equity)");
  assert.equal(says({}), "(4.89%) · 1.5× its usual day (usual: ±3.3% a day)");
});

test("CROPPED: the R4 fit sheet is last in the page — READ gets its width, the phone board keeps six columns, tabs wrap", () => {
  const i = page.indexOf('<style id="r4-fit">');
  assert.ok(i > 0 && page.indexOf("<style", i + 10) < 0, "no stylesheet after it");
  const css = page.slice(i, page.indexOf("</style>", i));
  assert.match(css, /\.ch\{grid-template-columns:(minmax\(0,\d+fr\) ?){14} !important\}/, "14 desk tracks");
  assert.match(css, /minmax\(0,15fr\) minmax\(0,13fr\)/, "READ 15fr before GEIGER");
  assert.match(css, /\.ch > \*:nth-child\(5\), \.ch > \*:nth-child\(6\), \.ch > \*:nth-child\(7\), \.ch > \*:nth-child\(9\), \.ch > \*:nth-child\(10\),\s+\.ch > \*:nth-child\(11\), \.ch > \*:nth-child\(13\)\{display:none !important\}/);
  assert.match(css, /\.sc-mtabs\{display:grid !important;grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.sc-head__wm\{left:52px;transform:translateY\(-50%\)/);
  assert.match(css, /\.cv-tabs\{flex-wrap:wrap !important/);
});

test("MERGE: the live Hub's digests are all accepted", () => {
  for (const d of ["7ad595cc4db5e1fd0bb63bb3780ac1450a938e6fa068df944aeec71445556063", "ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3",
    "0c2abd57a836845ee120eba1e465cdb61db6a2cca5b3da1fcecbdc591936bb20", "223dbb0ff58eda0363c7882d493ad09bef932fbf953f80d6849882242ecc316e"])
    assert.ok(page.slice(page.indexOf("const SC_FMP_REFERENCE_DIGESTS"), page.indexOf("].join"),).includes(d), d.slice(0, 8));
  assert.match(fn("renderLeftPanel"), /identPaint\(\);[\s\S]*const inPlace = !LEFT_HEAT && LEFT_STATE === "PINNED" && LEFT_T && cvUpdateInPlace\(\);/);
});
