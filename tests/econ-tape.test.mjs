/* ECON TAPE (22 Sep 2026) — the macro nudge in the ident box and the ECON band under MACRO / ALL.
   Three things are pinned here: the ONE rule that decides what rides the tape, the FOUR states an item walks as it
   approaches (on a fixed clock, so "now" is never "whenever the suite happens to run"), and the promise that this
   change did not touch Indicator Lab's page. Everything is VM-extracted from ../index.html the way the repo's own
   tests do; pg / el / S / document are stubs, so nothing here reaches a network, a store or a browser.
   The calendar rows are a CAPTURED fixture (tests/fixtures/econ-week-us-20260921.json), not invented data. */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import crypto from "node:crypto";

const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const START = "/* ---- Room 9 · ECONOMIC", END = "/* ---- Room 3 · COMPANY";
const mod = page.slice(page.indexOf(START), page.indexOf(END));
const escSrc = page.match(/const esc = \(s\) => [\s\S]*?;\n/)[0];
const numSrc = page.match(/const num = \(x\) => [^\n]*\n/)[0];
const WEEK = JSON.parse(fs.readFileSync(new URL("./fixtures/econ-week-us-20260921.json", import.meta.url), "utf8")).rows;
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);
const plain = (x) => JSON.parse(JSON.stringify(x));

const EXPORTS = ["ECON_TAPE_RULE", "ecTapeKeep", "ecTapeItems", "ecTapeSurprise", "ecNudgeState", "ecNudgeModel",
  "macroNextHTML", "ecNudgeItemHTML", "ecBandWeek", "ecBandItems", "ecBandState", "ecBandItemHTML", "econBandHTML",
  "ecTapeWindow", "ecTapeDueMs", "ecCountdown", "ecTimeET", "ecDateKey", "EC_TAPE_ITEMS", "EC_TAPE_DAYS"];
function load({ rows = null, S = {}, pg = async () => [], nodes = null } = {}) {
  const store = {};
  const el = nodes === "auto"
    ? (id) => store[id] || (store[id] = { id, innerHTML: "", textContent: "", className: "" })
    : (id) => (nodes && nodes[id]) || null;
  const ctx = vm.createContext({
    console, setTimeout,
    S: { sec: "DASHBOARD", state: "live", econCty: "US", econCat: "ALL", econDay: null, econSpan: "MONTH", econOpen: {}, econImp: "ALL", ...S },
    pg, el, go: () => {}, SECFS_BTN: "", prevClose: {}, fmtPxIdent: (v) => String(v), fmtC: (v) => String(v),
    document: { querySelectorAll: () => [] },
  });
  const api = vm.runInContext(escSrc + numSrc + mod + "\n;({" + EXPORTS.join(",") +
    ", get MACRO_NEXT() { return MACRO_NEXT; }, set MACRO_NEXT(v) { MACRO_NEXT = v; }," +
    " get ECON_TAPE_SEEN() { return ECON_TAPE_SEEN; } })", ctx);
  api.MACRO_NEXT = rows;
  return { api, ctx, store };
}

/* ------------------------------------------------------------------ 1 · the rule, in one named constant */
test("the rule lives in ONE constant and is the only gate the tape uses", () => {
  assert.equal((page.match(/const ECON_TAPE_RULE = /g) || []).length, 1, "one rule, one place");
  const { api } = load();
  assert.deepEqual(plain(api.ECON_TAPE_RULE.impacts), ["High", "Medium"]);
  assert.equal(api.ECON_TAPE_RULE.country, "US");
  assert.ok(Object.isFrozen(api.ECON_TAPE_RULE), "nothing rewrites the rule at runtime");
  /* the tape asks the rule and nothing else: every keep/drop below is ecTapeKeep's answer */
  const keep = (event, impact, country = "US") => api.ecTapeKeep({ country, event, impact });
  for (const [ev, imp] of [["Fed Williams Speech", "Medium"], ["Fed Jefferson Speech", "Medium"], ["Fed Barkin Speech", "Medium"],
    ["Initial Jobless Claims", "High"], ["S&P Global Composite PMI (Sep)", "Medium"], ["New Home Sales (Aug)", "High"],
    ["Durable Goods Orders MoM (Aug)", "High"], ["UN General Assembly", "Medium"], ["M2 Money Supply MoM (Aug)", "Low"],
    ["Money Supply (Aug)", "Low"]])
    assert.equal(keep(ev, imp), true, "Alan named this one: " + ev);
  for (const [ev, imp] of [["EIA Crude Oil Stocks Change (Sep/18)", "Medium"], ["API Crude Oil Stock Change (Sep/18)", "Medium"],
    ["2-Year Note Auction", "Low"], ["17-Week Bill Auction", "Low"], ["CFTC S&P 500 speculative net positions", "Medium"],
    ["MBA 30-Year Mortgage Rate (Sep/18)", "Medium"], ["MBA Mortgage Applications (Sep/18)", "Low"],
    ["30-Year Mortgage Rate (Sep/24)", "Low"], ["Fed Balance Sheet (Sep/23)", "Low"], ["Central Bank Balance Sheet", "Low"],
    ["Baker Hughes Oil Rig Count (Sep/25)", "Low"], ["Redbook YoY (Sep/19)", "Low"], ["Richmond Fed Services Index (Sep)", "Low"]])
    assert.equal(keep(ev, imp), false, "plumbing or noise: " + ev);
  assert.equal(keep("Inflation Rate YoY (Aug)", "High", "GB"), false, "US only");
});

test("this week, by the rule: everything he named is on the tape, the plumbing is not, and a release reads as ONE item", () => {
  const { api } = load({ rows: WEEK });
  const kept = WEEK.filter((r) => api.ecTapeKeep(r));
  const items = api.ecTapeItems(WEEK);
  assert.equal(kept.length, 27, "27 of the week's 82 US rows pass the rule");
  assert.equal(items.length, 20, "…and read as 20 items once a release's parts are joined");
  const names = items.map((i) => i.name);
  for (const want of ["Fed Williams Speech", "Fed Jefferson Speech", "Fed Barkin Speech", "M2 Money Supply MoM",
    "S&P Composite PMI", "Jobless Claims", "Durable Goods Orders MoM", "New Home Sales", "UN General Assembly"])
    assert.ok(names.includes(want), want + " is on the tape (" + names.join(" / ") + ")");
  for (const never of [/auction/i, /^cftc/i, /^eia /i, /^api /i, /mortgage/i, /balance sheet/i, /redbook/i])
    assert.ok(!names.some((n) => never.test(n)), "nothing matching " + never + " rides the tape");
  /* the three S&P Global PMIs, the three jobless-claims rows and the three durable-goods rows are one line each */
  const one = (name, rows) => assert.equal(items.find((i) => i.name === name).rows, rows, name);
  one("S&P Composite PMI", 3); one("Jobless Claims", 3); one("Durable Goods Orders MoM", 3); one("M2 Money Supply MoM", 2);
  /* the 13 Aug rule (High only) is what made the old reminder useless: one item for the whole week */
  assert.equal(WEEK.filter((r) => r.impact === "High").length, 7, "7 High rows this week");
  assert.equal(api.ecTapeItems(WEEK.filter((r) => r.impact === "High")).length, 3, "…which are 3 items: claims, new home sales, durable goods");
});

/* ------------------------------------------------------------------ 2 · the four states, on a fixed clock */
const NOW = ts("2026-09-24T12:31:00Z");                 // Thu 24 Sep 2026, 08:31 ET — one minute after the 08:30 prints
const R = (iso, event, extra = {}) => ({ event_ts: ts(iso), country: "US", event, impact: "High", actual: null, estimate: null, previous: null, ...extra });
const QUEUE = [
  R("2026-09-24T12:30:00Z", "Initial Jobless Claims", { estimate: 201, previous: 196 }),      // due one minute ago
  R("2026-09-24T13:00:00Z", "Fed Hammack Speech", { impact: "Medium" }),                       // in 29 minutes
  R("2026-09-24T14:00:00Z", "New Home Sales (Aug)", { estimate: 0.62, previous: 0.607 }),      // in 1h 29m
  R("2026-09-30T12:30:00Z", "Core PCE Price Index MoM (Aug)", { estimate: 0.2, previous: 0.2 }),   // the calendar shortens this to "Core PCE Price MoM"
];
test("the bands: in 6d → in 34m → tightening → one hard pulse → the result, then it drops off and the next moves up", () => {
  const { api } = load({ rows: QUEUE });
  const it = (name) => api.ecTapeItems(QUEUE).find((x) => x.name === name);
  const st = (name, now, seen) => api.ecNudgeState(it(name), now, seen);
  assert.equal(st("Core PCE Price MoM", NOW), "ahead", "next week: quiet");
  assert.equal(st("New Home Sales", NOW), "ahead", "1h 29m out is still quiet");
  assert.equal(st("New Home Sales", ts("2026-09-24T13:26:00Z")), "soon", "inside the hour: the go-look signal");
  assert.equal(st("Fed Hammack Speech", NOW), "soon");
  /* 16 Aug: inside ten minutes it tightens — the band the 22 Sep build did not have (Alan, 23 Sep 09:43) */
  assert.equal(st("New Home Sales", ts("2026-09-24T13:51:00Z")), "near", "nine minutes out: tightening");
  assert.equal(st("New Home Sales", ts("2026-09-24T13:49:00Z")), "soon", "eleven minutes out is still just soon");
  assert.equal(st("Jobless Claims", NOW), "due", "its minute has passed and the number is not in yet");
  assert.equal(api.ecCountdown(it("Core PCE Price MoM").ts, NOW), "in 5d");
  assert.equal(api.ecCountdown(NOW + 6 * 86400 + 3600, NOW), "in 6d", "the proposal's own wording");
  assert.equal(api.ecCountdown(it("New Home Sales").ts, ts("2026-09-24T13:26:00Z")), "in 34m");

  /* the number lands (the supplier rewrites the near band hourly, so it can be an hour late — the result shows for a
     quarter of an hour from the moment THIS page first sees it, then it drops off) */
  const landedRows = QUEUE.map((r) => (/Jobless/.test(r.event) ? { ...r, actual: 218 } : r));
  const L = load({ rows: landedRows });
  const claims = L.api.ecTapeItems(landedRows).find((x) => x.name === "Jobless Claims");
  const seen = ts("2026-09-24T13:20:00Z");                                   // first seen 50 minutes after the print
  assert.equal(L.api.ecNudgeState(claims, seen, seen), "landed");
  assert.equal(L.api.ecNudgeState(claims, seen + 14 * 60, seen), "landed", "still up a quarter of an hour later");
  assert.equal(L.api.ecNudgeState(claims, seen + 16 * 60, seen), "gone", "…then it drops off");
  assert.equal(L.api.ecNudgeState(claims, ts("2026-09-24T16:00:00Z"), ts("2026-09-24T16:00:00Z")), "gone",
    "a result first seen hours after its release is not replayed");
  /* a release that prints no number at all (a speech) says "now" for a quarter of an hour, then goes */
  const speech = L.api.ecTapeItems(landedRows).find((x) => x.name === "Fed Hammack Speech");
  assert.equal(L.api.ecNudgeState(speech, speech.ts + 60), "due");
  assert.equal(L.api.ecNudgeState(speech, speech.ts + 16 * 60), "gone");
  /* and a number still missing an hour after its minute stops shouting */
  assert.equal(api.ecNudgeState(it("Jobless Claims"), it("Jobless Claims").ts + 61 * 60), "gone");
});

test("the queue: three items ahead, the landed one in its own lane on the left, click opens that day in ECONOMIC", () => {
  const rows = QUEUE.map((r) => (/Jobless/.test(r.event) ? { ...r, actual: 218 } : r));
  const { api } = load({ rows });
  const key = api.ecTapeItems(rows).find((x) => x.name === "Jobless Claims").key;
  api.ECON_TAPE_SEEN[key] = NOW;                                        // the number has just been seen
  const html = api.macroNextHTML(NOW);
  /* 16 Aug: "landed … in its own lane on the left. NEVER takes an upcoming slot" — so three upcoming AND the result */
  assert.equal((html.match(/class="mn-it s-(?!landed)/g) || []).length, 3, "three upcoming (proposal v2: 'Three items. Yours.')");
  assert.equal((html.match(/class="mn-it s-landed/g) || []).length, 1, "and the landed one beside them, not instead of one");
  assert.match(html, /^<span class="mn-lbl">next<\/span><span class="mn-it s-landed mn-lane-end"/, "the landed lane comes first, and is ruled off");
  assert.match(html, /<span class="mn-dot" style="color:#2D9CFF">●<\/span><span class="mn-nm">Jobless Claims<\/span><span class="mn-res"[^>]*><b>218<\/b> vs 201<\/span><span class="mn-sur miss">\+17 above<\/span>/,
    "LABOR blue, actual vs estimate, and more people out of work than expected is the red one");
  assert.match(html, /data-act="mnclear" data-k="[^"]+" title="clear">✕/, "and it clears on click");
  assert.match(html, /<span class="mn-it s-soon"[^>]*>.*Fed Hammack Speech.*<span class="mn-cd">in 29m<\/span>/);
  assert.match(html, /<span class="mn-it s-ahead"[^>]*>.*New Home Sales.*<span class="mn-cd">in 1h 29m<\/span>/);
  assert.match(html, /Core PCE/, "with the result out of the queue, the fourth fits");
  for (const m of html.matchAll(/data-day="([^"]+)"/g)) assert.match(m[1], /^\d{4}-\d{2}-\d{2}$/);
  assert.match(html, /data-act="mngoto" data-day="2026-09-24"/, "clicking opens that day");
  /* once the result has had its quarter of an hour, it drops off and the next one moves up */
  const later = api.macroNextHTML(NOW + 16 * 60);
  assert.doesNotMatch(later, /Jobless Claims/);
  assert.match(later, /Core PCE Price MoM/, "the fourth is still there; the lane emptied, the queue did not move");
  assert.equal((later.match(/class="mn-it s-/g) || []).length, 3);
});

test("a surprise is coloured the way the calendar colours it, and an escaped name stays escaped", () => {
  const { api } = load();
  const sur = (event, actual, estimate) => api.ecTapeSurprise({ event, actual, estimate });
  assert.deepEqual(plain(sur("Inflation Rate YoY (Aug)", 3.5, 3.4)), { cls: "miss", txt: "+0.1 hotter" });
  assert.deepEqual(plain(sur("Core PCE Price Index MoM (Aug)", 0.1, 0.5)), { cls: "beat", txt: "−0.4 cooler" });
  assert.deepEqual(plain(sur("Non Farm Payrolls (Sep)", 200, 150)), { cls: "beat", txt: "+50 above" });
  assert.deepEqual(plain(sur("Initial Jobless Claims", 218, 201)), { cls: "miss", txt: "+17 above" });
  assert.deepEqual(plain(sur("Retail Sales MoM (Aug)", 0.5, 0.5)), { cls: "inline", txt: "in line" });
  assert.equal(sur("Fed Barkin Speech", null, null), null, "a speech has no number and no colour");
  /* a release the supplier carries with no estimate at all (M2 is the one he named) reads against its prior print */
  const M = load({ rows: [R("2026-09-24T13:00:00Z", "M2 Money Supply MoM (Aug)", { impact: "Low", actual: 23.34, previous: 23.22 })] });
  assert.match(M.api.macroNextHTML(ts("2026-09-24T13:05:00Z")), /<span class="mn-res"[^>]*><b>23.34<\/b> vs prior 23.22<\/span>/);
  const evil = [R("2026-09-24T13:00:00Z", '<img src=x onerror=alert(1)> & "q" (Aug)', { actual: 1, estimate: 0 })];
  const E = load({ rows: evil });
  const one = E.api.macroNextHTML(ts("2026-09-24T13:01:00Z"));
  assert.doesNotMatch(one, /<img|<b>x/, "no tag the row invented reaches the box");
  assert.match(one, /&lt;img src=x onerror=alert\(1\)&gt; &amp; &quot;q&quot;/);
});

/* ------------------------------------------------------------------ 3 · the ECON band */
test("the ECON band is this week, in the same tape part, at the same speed, with the result once it prints", () => {
  const { api } = load({ rows: WEEK });
  const week = api.ecBandWeek(NOW);
  assert.deepEqual(plain(week), ["2026-09-21", "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-26", "2026-09-27"]);
  assert.equal(plain(api.ecBandWeek(ts("2026-09-26T01:00:00Z")))[0], "2026-09-21", "Friday evening ET still shows this week…");
  assert.equal(plain(api.ecBandWeek(ts("2026-09-26T20:00:00Z")))[0], "2026-09-28", "…and the weekend rolls to the week ahead, which is what is still to happen");
  const html = api.econBandHTML(NOW);
  assert.match(html, /^<div class="sc-tape sc-tape--econ" id="econBand"><b class="sc-tape__lbl">ECON →<\/b>/, "the same part as MACRO / ALL");
  const seg = html.split('<span class="sc-tape__track">')[1];
  assert.equal((seg.match(/class="sc-tape__item ecb-it/g) || []).length, 40, "20 items, twice — the marquee's two copies");
  assert.match(html, /WEEK OF SEP 21, 2026/);
  assert.match(html, /<span class="ecb-when">MON 06:30<\/span><span class="ecb-nm">Fed Goolsbee Speech<\/span>/, "day, time, name");
  assert.match(html, /Chicago Fed National Activity Index<\/span><span class="ecb-res miss"><b>-0\.04<\/b> vs 0\.2<\/span>/, "and the result once it printed");
  assert.match(html, /class="sc-tape__item ecb-it is-past[^"]*" data-act="mngoto" data-day="2026-09-21"/, "Monday is past, and still clickable");
  assert.match(html, /class="sc-tape__item ecb-it is-up[^"]*" data-act="mngoto" data-day="2026-09-25"/, "Friday is still to come");
  assert.match(html, /is-high/, "a High-impact release is set bolder");
  assert.match(html, /<span class="ecb-when is-today">TODAY 08:30<\/span>/, "today says TODAY");
  /* an empty week is an honest empty band, and a failed read says so rather than showing nothing */
  const empty = load({ rows: [] });
  assert.match(empty.api.econBandHTML(NOW), /no US releases on the watch list this week/);
  const never = load();
  assert.match(never.api.econBandHTML(NOW), /reading this week's economic calendar…/);
});

test("the band and the price bands share ONE speed law, and a price tick never rewinds the week", () => {
  assert.match(page, /function tapeSpeed\(track, startAt\) \{\n  const PX_S = 45;/, "one speed, 45 px/s");
  assert.doesNotMatch(page, /Math\.max\(20, half \/ 45\)/, "no 20 s floor: a short band is never slowed below the others");
  assert.match(page, /px\.querySelectorAll\("\.sc-tape__track"\)\.forEach\(\(track\) => tapeSpeed\(track\)\);/, "MACRO / ALL use it");
  assert.match(page, /if \(track\) tapeSpeed\(track, slot\.querySelector\("\.ecb-it\.is-due, \.ecb-it\.is-near, \.ecb-it\.is-soon, \.ecb-it\.is-up"\)\);/, "and so does the ECON band");
  /* 23 Sep — the EARNINGS band joined the strip, so the promise pinned here is the one that matters:
     the price bands own #bandsPx and the ECON band has its own slot right after it. A further band is a
     further sibling slot and must not rewind this one either. */
  assert.match(page, /<div class="bands" id="bands"><div id="bandsPx"><\/div><div id="econBandSlot"><\/div>/);
  assert.match(page, /const px = el\("bandsPx"\) \|\| el\("bands"\);/, "renderTapes writes into its own slot, not over the band");
  assert.match(page, /if \(html === ECON_BAND_HTML && slot\.innerHTML\) return;/, "and the band is only repainted when the week changes");
});

/* ------------------------------------------------------------------ 4 · reads, cadence, and the tab nobody is looking at */
test("one read for both surfaces: 10 minutes normally, 2 while a number is due, none while the tab is hidden", () => {
  const { api } = load({ rows: WEEK });
  const w = api.ecTapeWindow(NOW);
  assert.ok(w.from <= NOW - 3 * 3600 && w.to >= NOW + 8 * 86400, "the window carries this morning's results and the next seven days");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T11:00:00Z")), 10 * 60e3, "nothing due: one read per ten minutes");
  /* THE WATCHER (proposal v2): one a minute from one minute before to fifteen after, then back to the slow cadence */
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T12:29:30Z")), 60e3, "thirty seconds before the print: watching");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T12:35:00Z")), 60e3, "five minutes after, still no number: watching");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T12:47:00Z")), 2 * 60e3, "past the fifteen minutes: back to every two");
  assert.equal(api.ecTapeDueMs(ts("2026-09-24T15:30:00Z")), 10 * 60e3, "an hour after the last one it stops asking");
  assert.match(page, /function ecTapeTick\(\) \{\n  if \(typeof document !== "undefined" && document\.visibilityState === "hidden"\) return;/,
    "a hidden tab neither paints nor reads");
  const tape = page.slice(page.indexOf("const ECON_TAPE_ON"), page.indexOf("/* PORT — 3d69248's window fetch"));
  for (const w2 of [/method\s*:/, /\bfetch\(/, /pgPatch\(/, /localStorage/, /sessionStorage/, /\/rpc\//])
    assert.doesNotMatch(tape, w2, "the tape writes nothing: " + w2);
  assert.doesNotMatch(tape, /live_quotes\.volume|composite_staged\.structure|\bvolume\b|\bstructure\b/,
    "and never asks for a column the database dropped");
});

/* ------------------------------------------------------------------ 5 · Indicator Lab, untouched */
test("Indicator Lab's newest page is byte-identical to the Lab's own commit 990712a", () => {
  /* the Lab thread owns these files and this branch must not move them by one byte. First pinned to the
     restore commit 8211c8f (22 Sep); moved on 24 Sep to the Lab's own commit 990712a (detailed views and the
     statistical brief), which the coordinator carried into the release after two Hub deploys had rolled the
     page back to 8211c8f. Only the Lab moves these pins. */
  const EXPECT = {
    "prototypes/indicator-lab/index.html": ["47e51e10e9fcce6fffbd43188e4d9494557d1ac6", 19854],
    "prototypes/indicator-lab/captures/mcp-six-chart-20260919.png": ["4591a283ddca44efed9be1d70832eff276a3e52a", 737757],
    "tests/indicator-lab-methods.test.mjs": ["57ab583cf3710597935c72cdb60b768847645521", 3624],
  };
  for (const [rel, [sha1, bytes]] of Object.entries(EXPECT)) {
    const buf = fs.readFileSync(new URL("../" + rel, import.meta.url));
    assert.equal(buf.length, bytes, rel + " changed size");
    assert.equal(crypto.createHash("sha1").update(buf).digest("hex"), sha1, rel + " is not the Lab's file any more");
  }
  const dir = new URL("../prototypes/indicator-lab/", import.meta.url);
  assert.deepEqual(fs.readdirSync(dir).sort(), ["briefs", "captures", "index.html"], "no file added to the Lab's folder either");
  assert.deepEqual(fs.readdirSync(new URL("briefs/", dir)).sort(),
    ["DETAILED_INDICATORS_2026-09-24.html", "DETAILED_INDICATORS_2026-09-24.md"]);
  assert.deepEqual(fs.readdirSync(new URL("captures/", dir)).sort(), ["mcp-six-chart-20260919.png"]);
});

test("the nudge walks the 16 Aug prototype's bands — still, breathing, tightening, one hard pulse — and no white", () => {
  /* Alan, 23 Sep 09:43: "S&P composite PMI in two minutes. No scintillation." and 11:00: "review the proposal that the
     session that made the prototype made" — _ECON_TAB_REVIEW/nudge.html. That page's own table is the spec, so the
     breathing BEFORE the release minute which 22 Sep did not have is now required. This supersedes the 13 Aug timing. */
  assert.match(page, /\.mn-it\.s-ahead \.mn-dot\{ opacity:\.6; text-shadow:none; \}/, "ahead: still, no flash, named");
  assert.match(page, /\.mn-it\.s-soon\s+\.mn-dot\{[^}]*animation:mn-breathe 2\.4s/, "soon: breathes at 2.4s");
  assert.match(page, /\.mn-it\.s-near\s+\.mn-dot\{[^}]*animation:mn-breathe 1\.1s/, "near: 1.1s, tightening");
  assert.match(page, /\.mn-it\.s-due\s+\.mn-dot\{[^}]*animation:mn-hard \.38s/, "due: one hard 0.38s pulse");
  assert.match(page, /\.ecb-it\.is-soon \.ecb-dot\{ animation:mn-breathe 2\.4s/, "and the ECON band keeps the same time");
  assert.doesNotMatch(page, /\.mn-[a-z0-9-]*[^{]*\{[^}]*#fff|\.ecb-[a-z0-9-]*[^{]*\{[^}]*#fff/, "no white on the tape");
  /* the dot's hue is never hard-coded: it comes from the calendar's own category colour, inline */
  assert.match(page, /const ecHue = \(cat\) => \(cat === "OTHER" \? "var\(--dim\)" : EC_CAT_COLOR\[cat\] \|\| "var\(--dim\)"\);/);
});

test("the bottom tapes fold away like the top tabs and come back when the mouse nears the bottom (23 Sep)", () => {
  assert.match(page, /body\.btuck \.bands\{ max-height:7px; opacity:\.4; \}/);
  assert.match(page, /if \(fromBottom <= 90 \|\| overTapes\) \{ reveal\(\); return; \}/);
  assert.match(page, /hideTimer = setTimeout\(tuck, 3000\);\n\}\)\(\);\n\n\/\* R19/);
});

/* 23 Sep — Alan: "they're all moving at different speeds… it makes me dizzy", and the EARNINGS band "fills in like batches".
   Both came from short bands: the 20 s floor slowed them, and a band narrower than its window left the window's right side
   empty until the loop jumped back. */
test("every band moves at 45 px/s, and a band narrower than its window is repeated until one loop fills it", () => {
  const src = page.match(/function tapeSpeed\(track, startAt\) \{[\s\S]*?\n\}/)[0];
  const tapeSpeed = new Function(src + "; return tapeSpeed;")();
  const W = 50;                                   // every fake item is 50 px wide
  const band = (n, winW) => {
    let kids = Array.from({ length: 2 * n }, (_, i) => ({ outerHTML: "<i>" + (i % n) + "</i>", offsetLeft: i * W }));
    const t = { style: {}, isConnected: true, parentElement: { clientWidth: winW } };
    Object.defineProperty(t, "children", { get: () => kids });
    Object.defineProperty(t, "scrollWidth", { get: () => kids.length * W });
    Object.defineProperty(t, "innerHTML", { set: (h) => { kids = (h.match(/<i>\d+<\/i>/g) || []).map((x, i) => ({ outerHTML: x, offsetLeft: i * W })); } });
    return t;
  };
  const long = band(40, 1000);                   // one loop = 2000 px, wider than the 1000 px window: left alone
  tapeSpeed(long);
  assert.equal(long.children.length, 80);
  assert.equal(+parseFloat(long.style.animationDuration).toFixed(6), +(2000 / 45).toFixed(6));
  const short = band(6, 1000);                   // one loop = 300 px in a 1000 px window
  tapeSpeed(short);
  assert.equal(short.children.length, 48, "repeated four times, still two equal halves");
  assert.ok(short.scrollWidth / 2 >= 1000, "one loop is at least a window wide, so the window is never half empty");
  assert.equal(+parseFloat(short.style.animationDuration).toFixed(6), +(1200 / 45).toFixed(6), "and it runs at the same 45 px/s");
  const opener = band(6, 1000); const first = opener.children[3];
  tapeSpeed(opener, first);                      // the band that opens on today still opens on today after the repeat
  assert.equal(+parseFloat(opener.style.animationDelay).toFixed(6), +(-(150 / 1200) * (1200 / 45)).toFixed(6));
});
