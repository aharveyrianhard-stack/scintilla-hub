/* 27 Sep (Alan's notes, section C · HUB) — the scintillating tape that replaced the company bar, the ticker in the
   header title, the earnings-room fixes, the USUAL DAY room, the NEXT-dot rule and the RSI colour. Pure pieces are
   extracted from index.html and run on their own; wiring is checked against the source. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const page = readFileSync(new URL("../index.html", import.meta.url), "utf8");
function fn(name) {
  const s = page.search(new RegExp("^(async )?function " + name + "\\b", "m"));
  assert.ok(s >= 0, name);
  const e = page.indexOf("\n}\n", s);
  return page.slice(s, e + 3);
}
const line = (re) => { const m = page.match(re); assert.ok(m, String(re)); return m[0]; };
const num = (x) => (x == null || x === "" || !isFinite(+x) ? null : +x);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

/* ── RSI ─────────────────────────────────────────────────────────────────────────────────────────── */
const rsi = new Function("num", line(/const RSI_XT_LO = [^\n]*\n/) + line(/const rsiExtreme = [^\n]*\n/) + fn("rsiGradColor") +
  "\nreturn { rsiGradColor, rsiExtreme };")(num);

test("RSI is drawn at full strength: no opacity, a readable neutral at 50, the hue deepening toward the ends", () => {
  assert.equal(rsi.rsiGradColor(50), "var(--ink2)");
  for (const v of [5, 29, 31, 45, 55, 63, 69, 71, 95]) assert.match(rsi.rsiGradColor(v), /^rgb\(\d+,\d+,\d+\)$/, "never rgba: " + v);
  const ch = (v) => rsi.rsiGradColor(v).match(/\d+/g).map(Number);
  assert.ok(ch(63)[0] > ch(55)[0] && ch(63)[1] < ch(55)[1], "further from 50 is redder");
  assert.ok(ch(37)[1] > ch(45)[1] && ch(37)[0] < ch(45)[0], "further below 50 is greener");
  assert.ok(Math.max(...ch(63)) >= 200, "an ordinary 63 is bright, not the ~35% opacity it was");
  assert.equal(rsi.rsiGradColor(null), "");
});
test("only a textbook extreme breathes, and it is gentle and switchable off by reduced motion", () => {
  assert.equal(rsi.rsiExtreme(30), true); assert.equal(rsi.rsiExtreme(70), true);
  assert.equal(rsi.rsiExtreme(31), false); assert.equal(rsi.rsiExtreme(69), false); assert.equal(rsi.rsiExtreme(null), false);
  assert.match(page, /\.sc-rsi\.is-xt\{ animation:rsi-xt 4s ease-in-out infinite; \}/);
  assert.match(page, /@media \(prefers-reduced-motion:reduce\)\{ \.sc-rsi\.is-xt\{ animation:none;/);
  assert.match(fn("paintRsiCell"), /classList\.toggle\("is-xt", rsiExtreme\(v\)\)/, "the lazy fill marks it too");
});

/* ── the tape ────────────────────────────────────────────────────────────────────────────────────── */
function tapeKit(ecItems, ernRows) {
  const ernShift = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const src = fn("ernWeek") + fn("ernWhen") + fn("ttWindow") + fn("ttErnMinute") + fn("ttEcMinute") + fn("topTapeItems") +
    "\nreturn { topTapeItems, ttErnMinute, ttWindow };";
  return new Function("ernShift", "ecTimeET", "ecTapeItems", "MACRO_NEXT", "ERN_ROWS", "UNIVERSE", "todayISO", src)(
    ernShift, (ts) => new Date(ts * 1000).toLocaleTimeString("en-GB", { timeZone: "America/New_York", hour: "2-digit", minute: "2-digit" }),
    () => ecItems, ecItems, ernRows, new Set(ernRows.map((r) => r.ticker)), () => "2026-09-27");
}
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
test("economic releases and earnings ride ONE time line: this week so far, then the next seven days", () => {
  const ec = [
    { day: "2026-09-28", ts: ts("2026-09-28T12:15:00Z"), name: "Fed Bowman Speech" },          // 08:15 ET
    { day: "2026-09-30", ts: ts("2026-09-30T12:30:00Z"), name: "GDP" },                        // 08:30 ET
    { day: "2026-10-09", ts: ts("2026-10-09T12:30:00Z"), name: "too far" },
  ];
  const ern = [
    { ticker: "MU", date: "2026-09-30", report_time: "AMC" },
    { ticker: "GIS", date: "2026-09-30", report_time: "BMO" },
    { ticker: "COST", date: "2026-09-24", report_time: "AMC", eps_actual: 6.75 },
    { ticker: "OLD", date: "2026-09-18", report_time: "BMO" },
  ];
  const K = tapeKit(ec, ern);
  assert.deepEqual(K.ttWindow("2026-09-27"), { from: "2026-09-21", to: "2026-10-04" }, "Sunday belongs to the week just ended");
  const order = K.topTapeItems(ts("2026-09-27T16:00:00Z"), "2026-09-27").map((x) => x.kind === "ec" ? x.it.name : x.r.ticker);
  assert.deepEqual(order, ["COST", "Fed Bowman Speech", "GIS", "GDP", "MU"], "before-open 07:00 sits before an 08:30 print; after-close last");
  assert.equal(K.ttErnMinute({ report_time: "BMO" }), 420);
  assert.equal(K.ttErnMinute({ report_time: "AMC" }), 965);
  assert.equal(K.ttErnMinute({ report_time: null }), 1439, "an unannounced time sorts to the end of its day");
});
test("the tape replaces the company bar, reads nothing of its own, and one word puts the old bar back", () => {
  assert.match(page, /const TOPTAPE_ON = true;/);
  assert.match(fn("dashboardHTML"), /\(TOPTAPE_ON \? topTapeWrapHTML\(\)\n\s+: '<div class="sc-identfull" id="coIdentBar">' \+ leftIdentHTML\(identBarData\(\)\) \+ "<\/div>"\)/);
  const body = fn("topTapeHTML") + fn("topTapeItems") + fn("renderTopTape");
  assert.doesNotMatch(body, /\bpg\(|pgErn\(|fetch\(/, "no read of its own: MACRO_NEXT and ERN_ROWS only");
  assert.match(fn("topTapeHTML"), /ecBandItemHTML\(x\.it, ecBandState\(x\.it, now\), today\)/, "releases walk the band's states");
  assert.match(fn("topTapeHTML"), /ernItemHTML\(x\.r, today, now \* 1000\)/, "earnings use the band's renderer (diamond on a wild result)");
  assert.match(fn("topTapeWrapHTML"), /id="macroNext"/, "the NEXT queue rides at the tape's right-hand end");
  assert.match(fn("ecTapePaint"), /renderTopTape\(nowSec\)/);
  assert.match(fn("renderErnBand"), /renderTopTape\(\)/);
});

/* ── the ticker in the title ─────────────────────────────────────────────────────────────────────── */
test("a pinned ticker takes the SCINTILLA title's place, with a close button; nothing pinned shows the wordmark", () => {
  assert.match(page, /<div class="sc-head__ident" id="headIdent" hidden><\/div>/);
  const ip = fn("identPaint");
  assert.match(ip, /const on = LEFT_STATE === "PINNED" && !!LEFT_T;/);
  assert.match(ip, /leftIdentHTML\(identBarData\(\), \{ head: true \}\)/);
  assert.match(ip, /h\.hidden = !on;/);
  assert.match(ip, /classList\.toggle\("tk-pinned", on\)/);
  assert.match(page, /body\.tk-pinned \.sc-head__wm\{ visibility:hidden; \}/);
  const li = fn("leftIdentHTML");
  assert.match(li, /data-act="headx"/, "the ✕");
  assert.match(li, /const nudge = !head && ECON_TAPE_ON/, "no queue inside the title");
  assert.match(page, /case "headx": \{[\s\S]{0,300}?startRotate\(\); identPaint\(\); break;/);
});

/* ── NEXT dots ───────────────────────────────────────────────────────────────────────────────────── */
test("the swarm's dots are still until the hour, like a single release; its pace is its soonest release's state", () => {
  assert.match(page, /\.mn-swarm \.mn-dots i\{[^}]*opacity:\.6; \}/);
  assert.doesNotMatch(page, /\.mn-swarm \.mn-dots i\{[^}]*animation:/, "no unconditional flash");
  for (const st of ["soon", "near", "due"]) assert.match(page, new RegExp("\\.mn-swarm\\.s-" + st + " +\\.mn-dots i\\{[^}]*animation:"));
  assert.match(page, /st: "swarm", pace: sameDay\[0\]\.st \}/);
});

/* ── earnings room ───────────────────────────────────────────────────────────────────────────────── */
test("the earnings room: no AI READ, its own tape, a table for upcoming, a scrolling past list", () => {
  const room = fn("eventsRoomHTML");
  assert.doesNotMatch(room, /AIREAD_SLOT/, "AI READ removed (Alan)");
  assert.match(room, /id="ernRoomTape"/);
  assert.match(room, /id="evPastRail"/);
  assert.ok(room.indexOf('id="evUpcoming"') < room.indexOf('id="evPastRail"'), "past reported sits below upcoming");
  assert.match(page, /\.ev-pastscroll\{ max-height:340px; overflow-y:auto; \}/);
});
test("the upcoming table: EPS and revenue estimates, BMO/AMC as stored, the relative day in its own colour", () => {
  const run =new Function("num", "esc", "evRel", "evDays", "fmtEvDate", "ernWhen", "ernNum", "ercMoney",
    line(/const EV_UP_RAIL_MAX = [^\n]*\n/) + fn("evUpTableHTML") + "\nreturn evUpTableHTML;")(
    num, esc, (d) => "in " + d + "d", () => 3, () => "Sep 30", (r) => (r.report_time === "AMC" ? "after the close" : ""),
    (v) => (+v).toFixed(2), (v) => "$" + (v / 1e9).toFixed(1) + "B");
  const t = run([{ ticker: "MU", date: "2026-09-30", eps_estimate: 31.52, revenue_estimate: 51.1e9, report_time: "AMC" },
                 { ticker: "X", date: "2026-09-30", eps_estimate: null, revenue_estimate: null, report_time: "TBD" }]);
  assert.match(t, /<th class="n">EPS EST<\/th><th class="n">REV EST<\/th>/);
  assert.match(t, /<b>MU<\/b><\/td><td class="n">31\.52<\/td><td class="n">\$51\.1B<\/td><td class="d">Sep 30 AMC<\/td>/);
  assert.match(t, /<span class="sc-evrel up">in 3d<\/span>/, "the relative day keeps its class, so its colour");
  assert.match(t, /<b>X<\/b><\/td><td class="n"><span class="na">—<\/span><\/td><td class="n"><span class="na">—<\/span><\/td><td class="d">Sep 30<\/td>/,
    "nothing stored is a dash, never a zero, and TBD is not printed as a time");
  assert.equal(run([]), "Nothing upcoming for this scope.");
});
test("TODAY always has a bar on the earnings slider, even on a weekend", () => {
  assert.match(fn("ercTapeHTML"), /if \(z === "DAYS" && today >= span\.from && today <= span\.to\) dated\[today\] = 1;/);
  const ernShift = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const buckets = new Function("ernShift", "ercMonday", "ercMonth1", "ercMonthShift", "ercQuarter1", "ercYear1",
    fn("ercBuckets") + "\nreturn ercBuckets;")(ernShift);
  const b = buckets("2026-09-21", "2026-10-02", "DAYS", { "2026-09-27": 1 });
  assert.ok(b.includes("2026-09-27"), "Sunday the 27th is on the slider when it is today");
  assert.ok(!b.includes("2026-09-26"), "other weekend days still are not");
  assert.match(page, /\.se-tlnow::before\{ content:"TODAY";/, "and the line says what it is");
});

/* ── USUAL DAY room ──────────────────────────────────────────────────────────────────────────────── */
const ud = (() => {
  const ernShift = (iso, n) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
  const ET_DAY = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" });
  const scintDayET = (t) => ET_DAY.format(new Date(t));
  return new Function("ernShift", "scintDayET", "ERN_MO", fn("udWeekdays") + fn("udByDay") + fn("udUnderLabel") +
    "\nreturn { udWeekdays, udByDay, udUnderLabel };")(ernShift, scintDayET,
    ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"]);
})();
test("the usual-day slider: weekdays left to right, today always on it, days grouped with up and down counted", () => {
  const days = ud.udWeekdays("2026-09-27", 6);
  assert.deepEqual(days, ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-27"]);
  /* 28 Sep — up and down count MOVES (price_outlier) only; a surprise is listed on its day but is not a name going up or down */
  const by = ud.udByDay([
    { ts: "2026-09-25T20:50:03Z", direction: 1, kind: "price_outlier" }, { ts: "2026-09-25T15:50:00Z", direction: -1, kind: "price_outlier" },
    { ts: "2026-09-25T14:00:00Z", direction: 1, kind: "price_outlier" }, { ts: "2026-09-24T14:00:00Z", direction: 0, kind: "price_outlier" },
    { ts: "2026-09-25T13:00:00Z", direction: 1, kind: "earnings_surprise" },
  ]);
  assert.deepEqual([by["2026-09-25"].n, by["2026-09-25"].up, by["2026-09-25"].dn], [4, 2, 1], "Friday's are kept, not only today's; the surprise is listed but not counted up");
  assert.deepEqual([by["2026-09-24"].n, by["2026-09-24"].up, by["2026-09-24"].dn], [1, 0, 0]);
  assert.equal(ud.udUnderLabel("2026-10-01", false), "OCT");
  assert.equal(ud.udUnderLabel("2026-09-28", false), "M");
  assert.equal(ud.udUnderLabel("2026-09-29", false), "");
});
test("the room is a master tab with its own entry, reads only, and the board no longer carries the column", () => {
  assert.match(page, /const SECTIONS = \[[^\]]*"EVENTS", "USUAL", "ECONOMIC"\]/);
  assert.match(page, /if \(h === "usual" \|\| h === "usual-day" \|\| h === "sigma"\) return "USUAL";/);
  const reads = fn("udRead") + fn("udHbEnsure");
  assert.match(reads, /pg\("scintillas\?select=ts,kind,subject,subject_kind,direction,magnitude,detail&kind=in\.\("/);
  assert.doesNotMatch(reads, /method:\s*"(POST|PATCH|DELETE)"|\.insert\(|\.upsert\(|\.update\(/, "nothing written");
  assert.match(page, /const UD_KINDS = \["price_outlier", "earnings_surprise", "econ_surprise"\];/, "a sigma event has a size: imminent releases are left out");
  assert.match(fn("udTapeHTML"), /earlier days were never recorded, they are not quiet/, "the store's start is said, not hidden");
  assert.doesNotMatch(page, /\["Usual day","hb"\]/);
});
