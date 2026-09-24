/* M40 — PAST REPORTED is a tab again, and earnings scintillate on their own habit.
   Alan, 23 Sep: "I feel like we lost the tracking of the past reported… past reported
   probably a FULL TAB because we need to revamp that too, but WE NEED IT BACK" and
   "how do we make earnings scintillate".
   These tests pin the arithmetic (the name's own usual surprise, the session the
   market first traded the news, the keyset cursor that reaches 1996) and the wiring
   (the tab strip, the filters, the one glow primitive). The screenshots in
   deliverables/20260924/earnings-5/ carry the look. */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const src = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const grab = (re) => { const m = src.match(re); assert.ok(m, "not found in index.html: " + re); return m[0]; };
const shared =
  grab(/const num = \(x\) => [^\n]*\n/) +
  grab(/function ernWhen\(r\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ernSurpriseStats\(rows\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function ernZ\(sur, st\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function erpReaction\(bars, date, reportTime\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/function erpPath\(cursor\) \{[\s\S]*?\n\}/) + "\n" +
  grab(/const erpPct = [^\n]*\n/) +
  grab(/function erpCls\(v\) \{[^\n]*\n/) +
  grab(/const ERP_PAGE = \d+;\n/) +
  grab(/const ERP_SEL = "[^"]*";\n/) +
  grab(/const ERN_Z_GLOW = [^\n]*\n/);
const fn = (name) => new Function(shared + "return " + name + ";")();
const ernSurpriseStats = fn("ernSurpriseStats"), ernZ = fn("ernZ");
const erpReaction = fn("erpReaction"), erpPath = fn("erpPath"), erpPct = fn("erpPct");

test("a result is unusual against THIS name's own habit, never against a round number", () => {
  const steady = [2.1, 1.9, 2.0, 2.2, 1.8, 2.0].map((s) => ({ surprise_pct: s }));
  const st = ernSurpriseStats(steady);
  assert.equal(st.n, 6);
  assert.ok(Math.abs(st.mean - 2.0) < 0.05);
  assert.ok(st.sd > 0.1 && st.sd < 0.2);
  /* a name that always beats by 2% is not surprising when it beats by 2% */
  assert.ok(Math.abs(ernZ(2.0, st)) < 0.3, "its usual beat is not remarkable");
  assert.ok(Math.abs(ernZ(9.0, st)) >= 2, "a 9% beat from that name is");
  /* and a name that swings 30% either way is not remarkable at 30% */
  const wild = ernSurpriseStats([30, -25, 40, -35, 20, 28].map((s) => ({ surprise_pct: s })));
  assert.ok(Math.abs(ernZ(30, wild)) < 2, "a wild name beating wildly is business as usual");
  /* too little history is never called unusual */
  const thin = ernSurpriseStats([{ surprise_pct: 5 }, { surprise_pct: 400 }]);
  assert.equal(thin.n, 2);
  assert.equal(thin.sd, null);
  assert.equal(ernZ(400, thin), null, "two reports cannot say what is usual for a name");
  assert.equal(ernZ(null, ernSurpriseStats(steady)), null, "no stored surprise, no judgement");
  assert.equal(ernZ(5, ernSurpriseStats([1, 1, 1, 1, 1, 1].map((s) => ({ surprise_pct: s })))), null,
    "a name that never varies has no scale to be surprising on — and is not divided by zero");
  assert.equal(fn("ERN_Z_GLOW"), 2);
  /* the glow itself is the Hub's ONE primitive, at keyframe offset 0 */
  assert.match(src, /function ernScintPaint\(root\) \{/);
  assert.match(src, /scScint\(node, node\.dataset\.up === "1"\);/);
  assert.match(src, /if \(node\.__scintDone\) return;/, "a result glows once, not on every repaint");
  assert.match(src, /function ernWildResult\(r\) \{/, "one judgement, shared by the grid, the band and the list");
  assert.ok(new RegExp(String.raw`const wild = typeof ernWildResult === "function" \? ernWildResult\(r\) : null;`).test(src),
    "the band and the chips call it guarded, because tests extract those blocks on their own");
  assert.equal((src.match(/typeof ernWildResult === "function"/g) || []).length, 3,
    "the week chip, the day row and the bottom band — all three guarded the same way");
});

test("the price reaction is the first session the market could trade the news", () => {
  const bars = [
    { d: "2026-09-17", c: 100 }, { d: "2026-09-18", c: 102 },
    { d: "2026-09-21", c: 110 }, { d: "2026-09-22", c: 108 },
  ];
  /* after the close on the 18th: the market answers on the 21st, against the 18th */
  const amc = erpReaction(bars, "2026-09-18", "AMC");
  assert.equal(amc.day, "2026-09-21");
  assert.equal(amc.prev, "2026-09-18");
  assert.ok(Math.abs(amc.pct - 7.843) < 0.01);
  /* before the open on the 18th: that same day is the answer, against the 17th */
  const bmo = erpReaction(bars, "2026-09-18", "BMO");
  assert.equal(bmo.day, "2026-09-18");
  assert.equal(bmo.prev, "2026-09-17");
  assert.ok(Math.abs(bmo.pct - 2) < 1e-9);
  /* no stored report time: the page says which assumption it made rather than hiding it */
  const unknown = erpReaction(bars, "2026-09-18", null);
  assert.equal(unknown.day, "2026-09-21");
  assert.match(unknown.basis, /no report time stored/);
  /* and it refuses rather than inventing */
  assert.match(erpReaction(bars, "1999-04-01", "AMC").reason, /older than the stored daily history, which starts 2026-09-17/);
  assert.match(erpReaction(bars, "2026-09-22", "AMC").reason, /the session after it is not stored yet/);
  assert.match(erpReaction([], "2026-09-18", "AMC").reason, /no daily bars loaded/);
  assert.match(erpReaction([{ d: "2026-09-18", c: 5 }], "2026-09-18", "BMO").reason, /the session before it is not stored/);
  assert.equal(erpPct(-2.345), "−2.3%");
  assert.equal(erpPct(2.345), "+2.3%");
  /* the bars come from the chart API, never from a price table the Hub writes */
  assert.match(src, /SC_CHART_API \+ "\/candles\?symbol=" \+ encodeURIComponent\(k\) \+ "&tf=1d&limit="/);
  assert.match(src, /new Date\(b\.t\)\.toISOString\(\)\.slice\(0, 10\)/, "a bar's session date is its own stamp, not a guess");
});

test("PAST REPORTED pages back to 1996 with a keyset cursor, not an offset", () => {
  assert.match(erpPath(null), /^earnings_events\?select=/);
  assert.match(erpPath(null), /&eps_actual=not\.is\.null/, "REPORTED means a stored result");
  assert.match(erpPath(null), /&order=date\.desc,ticker\.asc/, "newest first, and a stable tiebreak");
  assert.match(erpPath(null), /&limit=60/);
  assert.ok(!/offset=/.test(erpPath({ d: "2025-01-02", t: "AAPL" })), "never an offset: rows are written between reads");
  assert.match(erpPath({ d: "2025-01-02", t: "AAPL" }),
    /&or=\(date\.lt\.2025-01-02,and\(date\.eq\.2025-01-02,ticker\.gt\.AAPL\)\)/,
    "the cursor is the last row on screen, so a page can neither skip nor repeat");
  /* it reads through the shared helper, so a date the provider moved is not a report */
  const read = src.slice(src.indexOf("async function erpRead(more)"), src.indexOf("function erpRender(list, cohort)"));
  assert.match(read, /await pgErn\(erpPath\(more \? ERP_CUR : null\)\)/);
  assert.match(read, /ernSupersede\(rows, rows\)/);
  assert.match(read, /UNIVERSE\.has\(x\.ticker\)/, "only the names the Hub tracks");
  assert.match(read, /ERP_DONE = \(got \|\| \[\]\)\.length < ERP_PAGE;/, "it knows when it has reached the oldest row");
});

test("the room has three tabs, and the filters are the room's own cohort strip", () => {
  assert.match(src, /const ernTab = \(\) => \(S\.ernTab === "PAST" \|\| S\.ernTab === "OLD" \? S\.ernTab : "DASH"\);/);
  assert.match(src, /one\("DASH", "DASHBOARD"/);
  assert.match(src, /one\("PAST", "PAST REPORTED"/);
  assert.match(src, /one\("OLD", "THE OLDER LIST"/);
  assert.match(src, /case "erntab": \{/);
  assert.match(src, /ernTab: scEntryTab\(\),/, "the room opens on the dashboard, or on the tab the address asks for");
  /* Alan: "either we lost it or I don't know how to get to it" — so there is a way in */
  assert.match(src, /if \(h === "earnings" \|\| h === "events"\) return "EVENTS";/);
  assert.match(src, /if \(h === "past" \|\| h === "past-reported" \|\| h === "reported"\) return "EVENTS";/);
  assert.match(src, /return \(h === "past" \|\| h === "past-reported" \|\| h === "reported"\) \? "PAST" : "DASH";/);
  /* ALL / FAV / cohort is the strip the whole room already uses — not a second filter */
  const render = src.slice(src.indexOf("function erpRender(list, cohort)"), src.indexOf("function ercSpanBarHTML"));
  assert.match(render, /scopeItems\(ERP_ROWS, cohort, S\.tq, S\.fav, COHSETS\)/);
  assert.match(render, /cohort map loading…/, "and it never draws an unscoped list");
  assert.match(render, /ernStatsEnsure\(scoped\.slice\(0, 60\)\.map\(\(r\) => r\.ticker\)\)/);
  assert.match(render, /ernScintPaint\(list\)/);
  /* every row's four readings */
  const row = src.slice(src.indexOf("function erpRowHTML(r, st)"), src.indexOf("/* ---- one name's quarter-by-quarter history"));
  for (const label of [">EPS<", ">REV<", ">REACTION<"]) assert.ok(row.includes(label), "a row prints " + label);
  assert.match(row, /ernLogoHTML\(r\.ticker, "se-lg--chip"\)/, "with the company's logo, and its ticker behind it");
  assert.match(row, /data-act="ernpast"/, "and a name opens its own history");
  /* the name's own history, quarter by quarter */
  const hist = src.slice(src.indexOf("function erpHistHTML(t)"), src.indexOf("async function erpHistLoad"));
  assert.match(hist, /<th>REPORTED<\/th><th>EPS<\/th><th>EST<\/th><th>SURPRISE<\/th><th>REVENUE<\/th><th>REACTION<\/th>/);
  assert.match(hist, /class="spark"/, "a bar per quarter, green beat and red missed");
  assert.match(hist, /too few reports to say what is usual for it/, "and it says so rather than inventing a habit");
});

test("nothing that was on Alan's screen before is gone", () => {
  /* the older section, the band, the calendar's shared words and Indicator Lab */
  assert.match(src, /function ercOldListHTML\(cohort\) \{/);
  assert.match(src, /const ERN_BAND_ON = true;/);
  for (const shared of ["ernWeek(", "ernWhen(", "ernSlot(", "ernResult("])
    assert.ok(src.includes(shared), "the room still speaks with the band's words: " + shared);
  assert.ok(!/ERC_TAPE_CHUNK/.test(src), "the old fixed-window tape read is gone, not left behind half-wired");
});
