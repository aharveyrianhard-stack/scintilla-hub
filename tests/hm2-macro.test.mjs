/* HM2 (7 Oct 2026) — the macro screens: the economic slider, the yield curve as a picture, Treasury auctions, the
   surprise strips and the put/call tape. Offline: the page's own helpers and the HM2 block are run in a VM with stubs;
   nothing here reaches a network, a store or a browser. Every row below is an EXAMPLE fixture unless it says "real". */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { fileURLToPath } from "node:url";
import { auctionRow, auctionRows, againstLastSix, TERMS, searchUrl } from "../supabase/functions/treasury-auctions/auctions.mjs";
import { calendarRows, windows, toSql, FAMILIES, baseOf } from "../scripts/hm2-econ-calendar-backfill.mjs";

const P = (rel) => fileURLToPath(new URL(rel, import.meta.url));
const read = (rel) => fs.readFileSync(P(rel), "utf8");
const page = read("../index.html");
const block = read("../deliverables/20261007/hm2-macro/tools/hm2-block.js");
const css = read("../deliverables/20261007/hm2-macro/tools/hm2-style.css");
const mig = read("../supabase/migrations/20261007_hm2_treasury_auctions.sql");
const rollback = read("../supabase/migrations/20261007_hm2_treasury_auctions_ROLLBACK.sql");
const cron = read("../supabase/migrations/20261007_hm2_treasury_auctions_cron.sql");

/* ---- the page's own helpers + the block, in a VM ---------------------------------------------------- */
const grab = (re, what) => { const m = page.match(re); assert.ok(m, what + " must exist on the page"); return m[0]; };
const helpers = [
  grab(/const num = \(x\) => [^\n]*\n/, "num"), grab(/const esc = \(s\) => [\s\S]*?;\n/, "esc"),
  grab(/const ecDateKey\s+= [^\n]*\n/, "ecDateKey"), grab(/const ecToday\s+= [^\n]*\n/, "ecToday"),
  grab(/const ecAnchor\s+= [^\n]*\n/, "ecAnchor"), grab(/const ecShift\s+= [^\n]*\n/, "ecShift"),
  grab(/const EC_G7\s+= [^\n]*\n/, "EC_G7"), grab(/const EC_G20 = [^\n]*\n/, "EC_G20"), grab(/const EC_EM\s+= \[[\s\S]*?\];\n/, "EC_EM"),
  grab(/function ecInRegion\(country, region\) \{[\s\S]*?\n\}\n/, "ecInRegion"), grab(/const ecPassImp = [^\n]*\n/, "ecPassImp"),
  grab(/const EC_CATS = \[[\s\S]*?\n\];\n/, "EC_CATS"), grab(/const EC_INVERT = [^\n]*\n/, "EC_INVERT"),
  grab(/const EC_MONTH_TAG = [^\n]*\n/, "EC_MONTH_TAG"), grab(/const ecBase\s+= [^\n]*\n/, "ecBase"),
  grab(/const ecPeriod = [^\n]*\n/, "ecPeriod"), grab(/const ecCat = [^\n]*\n/, "ecCat"),
].join("");
const EXPORTS = "hm2Monday, hm2Bucket, hm2BucketEnd, hm2Buckets, hm2TlIndex, hm2TlLevel, hm2TlBarHTML, hm2EcTapeHTML, hm2CurveHTML, hm2AucVsSix, hm2AuctionsHTML, " +
  "hm2StripRows, hm2StripHTML, hm2PcOrder, hm2PcItemHTML, hm2PcHTML, hm2RailCardsHTML, hm2TlSpan, HM2_ZOOMS, HM2_ZOOM, HM2_TL, HM2_TL_HOT, HM2_STRIPS, HM2_CURVE_OLD, HM2_PC_FLASH_X, HM2_SPECS, HM2_ON, HM2_PC_ON";
function load(S = {}) {
  const ctx = { S: Object.assign({ econCty: "US", econCat: "ALL", econImp: "ALL", econDay: null }, S), el: () => null, pg: async () => [], console };
  vm.runInNewContext(helpers + "const ecNormalize = (r) => r; const ecCountryFilter = () => '&country=eq.US'; const ecKeysetAfter = () => '';\n" +
    block + "\nglobalThis.out = { " + EXPORTS + ", ecToday, ecShift, ecAnchor };", ctx);
  return Object.assign(ctx.out, { ctx });
}
const ts = (iso) => Math.floor(Date.parse(iso) / 1000);

/* ---- the page carries the block, and can be put back ------------------------------------------------ */
test("the page carries the HM2 block and its stylesheet byte for byte, once", () => {
  assert.equal(page.split(block).length - 1, 1, "tools/hm2-block.js is the source of what the page runs");
  assert.equal(page.split('<style id="hm2-macro-20261007">\n' + css + "</style>\n").length - 1, 1);
  const at = page.indexOf(block), room = page.indexOf("/* ---- Room 9 · ECONOMIC"), regime = page.indexOf("/* ---- Room 9b · REGIME view (M44");
  assert.ok(at > 0 && at + block.length === room, "it sits just ABOVE the economic room's own module, never inside it");
  const mod = page.slice(room, regime);
  assert.deepEqual([...new Set([...mod.matchAll(/"([a-z_]+)\?select=/g)].map((m) => m[1]))].sort(), ["econ_calendar", "econ_history", "treasury_rates"], "that module still reads its three tables and no other");
  assert.equal((mod.match(/econ_calendar\?select=/g) || []).length, 2, "and still holds exactly two calendar reads");
});
test("seven one-line hooks connect it; switched off, the room draws the two cards it drew before", () => {
  const ON = 'typeof HM2_ON !== "undefined" && HM2_ON';
  assert.ok(page.includes("(" + ON + " ? '<div id=\"hm2EcTape\"></div>' : \"\") +"));
  assert.match(page, /&& HM2_ON \? hm2RailCardsHTML\(\) :\n\s+'<div class="card"><h4>Treasury curve<\/h4><div class="sc-senttxt" id="econCurve">—<\/div><\/div>' \+\n\s+'<div class="card" id="econLadder"><h4>UST ladder<\/h4><div class="sc-senttxt">—<\/div><\/div>'\) \+/,
    "the one-line curve and the UST ladder are still in the page, behind the switch");
  assert.match(page, /  try \{ hm2Mount\(\); \} catch \(_\) \{\}[^\n]*\n  await Promise\.all\(\[ecLoadWindow\(\), fillEconRail\(\)\]\);/, "beside the room's mount and never awaited by it: the room's own line is untouched");
  assert.equal((page.match(/typeof HM2_ON !== "undefined" && HM2_ON/g) || []).length, 4, "every HTML hook reads the switch so that a context without the block draws the room as before");
  assert.match(page, /function renderEconTable\(\) \{\n  try \{ hm2EcTapePaint\(\); \} catch \(_\) \{\}/);
  assert.ok(page.includes("(" + ON + " && HM2_PC_ON ? '<div class=\"sc-scintstrip\" id=\"hm2PcStrip\"></div>' : \"\") +"));
  assert.match(page, /try \{ hm2PcFill\(\); hm2PcArm\(\); \} catch \(_\) \{\}/);
  assert.ok(page.includes("(" + ON + " ? HM2_SPECS : \"\") +"));
  assert.match(block, /^var HM2_ON = true;/m, "var, so a builder that runs before the block reads the switch as off, never as an error");
});
test("a part paints only into an element its own HTML drew: with a stand-in or nothing, it neither reads nor paints", async () => {
  let reads = 0;
  const fake = { id: "x", innerHTML: "untouched" };                       /* what the economic tests' harness hands out for ANY id */
  const ctx = { S: { econCty: "US", econCat: "ALL", econImp: "ALL" }, el: () => fake, pg: async () => { reads++; return []; }, console };
  vm.runInNewContext(helpers + "const ecNormalize = (r) => r; const ecCountryFilter = () => ''; const ecKeysetAfter = () => ''; const ecFetchWindow = async () => { throw new Error('must not be asked'); };\n" +
    block + "\nglobalThis.run = async () => { hm2Mount(); hm2EcTapePaint(); await hm2CurveFill(); await hm2AuctionsFill(); await hm2StripsFill(); await hm2PcFill(); return hm2PcFlash(); };", ctx);
  assert.equal(await ctx.run(), 0);
  assert.equal(reads, 0, "not one request"); assert.equal(fake.innerHTML, "untouched");
  assert.match(block, /^function hm2Mount\(\) \{\n  if \(!HM2_ON\) return;/m, "and the mount is a plain call, not a promise the room could be made to wait on");
});
test("nothing explains itself inside a panel: the rules are in PAGE SPECS at the bottom of the rail", () => {
  const { HM2_SPECS, hm2RailCardsHTML } = load();
  assert.match(HM2_SPECS, /^<details class="sc-pagespecs hm2-specs"><summary>PAGE SPECS<\/summary>/);
  for (const word of ["The slider", "Treasury curve", "Treasury auctions", "Macro prints"]) assert.ok(HM2_SPECS.includes("<b>" + word + ".</b>"), word);
  assert.doesNotMatch(hm2RailCardsHTML(), /<p>/, "the cards carry labels and numbers only");
  assert.match(HM2_SPECS, /The tail is not shown: it needs the yield the new issue traded at one minute before the deadline, and no free source carries it\./);
});
test("the new text is 11 px or more, and no line or label is a grey", () => {
  const sizes = [...css.matchAll(/font-size:([\d.]+)px/g)].map((m) => +m[1]);
  assert.ok(sizes.length > 10); assert.ok(Math.min(...sizes) >= 11, "smallest is " + Math.min(...sizes));
  const { HM2_CURVE_OLD } = load();
  for (const [lbl, , col] of HM2_CURVE_OLD) {
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(col.slice(i, i + 2), 16));
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) > 24, lbl + " " + col + " is a hue, not a grey");
  }
  assert.match(css, /\.hm2-cl--now\.up, \.hm2-sl\.up\{ stroke:var\(--bull\); \} \.hm2-cl--now\.dn, \.hm2-sl\.dn\{ stroke:var\(--bear\); \}/, "today's line is the day's colour");
});

/* ---- 1 · the economic slider ------------------------------------------------------------------------ */
test("the slider is built like the earnings one: its frame, its bar, its TODAY line, its zoom chips", () => {
  const h = load({ econDay: null });
  h.HM2_TL.key = (() => { const s = h.hm2TlSpan("DAYS"); return "US|DAYS|" + s.from + "|" + s.to; })();
  const today = h.ecToday();
  h.HM2_TL.rows = [
    { event_ts: ts(today + "T12:30:00Z"), country: "US", event: "Non Farm Payrolls (Sep)", impact: "High" },
    { event_ts: ts(today + "T12:30:00Z"), country: "US", event: "Unemployment Rate (Sep)", impact: "High" },
    { event_ts: ts(today + "T14:00:00Z"), country: "US", event: "Factory Orders MoM (Aug)", impact: "Low" },
    { event_ts: ts(today + "T14:00:00Z"), country: "DE", event: "Industrial Production MoM (Aug)", impact: "High" },
  ];
  const html = h.hm2EcTapeHTML();
  for (const cls of ["se-tape", "se-tapehd", "se-zooms", "se-zm", "se-tlscroll", "se-tlgrid", "se-tlday", "se-tlb", "se-tlv", "se-tlx", "se-tlmos", "se-tltoday", "se-tapesay"])
    assert.ok(html.includes('class="' + cls) || html.includes(" " + cls + '"') || html.includes(cls + " "), "the earnings slider's ." + cls);
  assert.match(html, /<div class="se-tlday is-today[^"]*" data-hm2="bar" data-d="\d{4}-\d\d-\d\d"/, "today has its bar");
  assert.match(html, /data-hm2="zoom" data-z="DAYS"[^>]*>DAYS<\/span>/); assert.match(html, /data-hm2="zoom" data-z="WEEKS"/);
  assert.match(html, /<b>TODAY · (SUN|MON|TUE|WED|THU|FRI|SAT) [A-Z]{3} \d+<\/b>/);
  assert.match(html, /showing <b>US<\/b> · 3 releases on this slider · 2 high-importance/, "the German row is not a US release");
  assert.match(html, /<span class="se-tlstar" title="Non Farm Payrolls prints here">★<\/span>/, "a star where a market mover prints");
});
test("a bar counts what the table shows: the region tab, the category chip and HIGH ONLY", () => {
  const rows = [
    { event_ts: ts("2026-10-07T12:30:00Z"), country: "US", event: "Initial Jobless Claims", impact: "Medium" },
    { event_ts: ts("2026-10-07T17:00:00Z"), country: "US", event: "10-Year Note Auction", impact: "Low" },
    { event_ts: ts("2026-10-07T18:00:00Z"), country: "US", event: "FOMC Minutes", impact: "High" },
    { event_ts: ts("2026-10-07T09:00:00Z"), country: "DE", event: "Industrial Production MoM (Aug)", impact: "High" },
  ];
  assert.equal(load().hm2TlIndex(rows, "DAYS")["2026-10-07"].n, 3);
  assert.equal(load({ econCty: "G7" }).hm2TlIndex(rows, "DAYS")["2026-10-07"].n, 4);
  assert.equal(load({ econCat: "AUCTIONS" }).hm2TlIndex(rows, "DAYS")["2026-10-07"].n, 1);
  assert.equal(load({ econImp: "HIGH" }).hm2TlIndex(rows, "DAYS")["2026-10-07"].n, 1);
  assert.equal(load({ econCat: "TRADE" }).hm2TlIndex(rows, "DAYS")["2026-10-07"], undefined, "nothing of that kind: no bar count at all");
});
test("weeks run Monday to Sunday; a weekend day has a bar only when something is scheduled; red is five or more", () => {
  const h = load();
  assert.equal(h.hm2Monday("2026-10-07"), "2026-10-05"); assert.equal(h.hm2Monday("2026-10-11"), "2026-10-05"); assert.equal(h.hm2Monday("2026-10-05"), "2026-10-05");
  assert.equal(h.hm2BucketEnd("2026-10-05", "WEEKS"), "2026-10-11"); assert.equal(h.hm2Bucket("2026-10-10", "WEEKS"), "2026-10-05");
  assert.deepEqual(Array.from(h.hm2Buckets("2026-10-02", "2026-10-06", "DAYS", {})), ["2026-10-02", "2026-10-05", "2026-10-06"]);
  assert.deepEqual(Array.from(h.hm2Buckets("2026-10-02", "2026-10-06", "DAYS", { "2026-10-04": 1 })), ["2026-10-02", "2026-10-04", "2026-10-05", "2026-10-06"], "OPEC on a Sunday gets its bar");
  assert.deepEqual(Array.from(h.hm2Buckets("2026-09-28", "2026-10-13", "WEEKS", {})), ["2026-09-28", "2026-10-05", "2026-10-12"]);
  assert.deepEqual(Array.from(h.HM2_ZOOMS), ["DAYS", "WEEKS"], "no MONTHS: a month of releases is nearly the same number every month");
  assert.equal(h.HM2_TL_HOT, 5, "measured: 23 of the last 190 US weekdays carried five or more high-importance releases");
  assert.equal(h.hm2TlLevel({ hi: 0 }, "DAYS", 9), "cool"); assert.equal(h.hm2TlLevel({ hi: 4 }, "DAYS", 9), "warm"); assert.equal(h.hm2TlLevel({ hi: 5 }, "DAYS", 9), "hot");
  assert.equal(h.hm2TlLevel({ hi: 6 }, "WEEKS", 12), "warm"); assert.equal(h.hm2TlLevel({ hi: 8 }, "WEEKS", 12), "hot"); assert.equal(h.hm2TlLevel(undefined, "DAYS", 0), "cool");
});

/* ---- 2 · the yield curve ---------------------------------------------------------------------------- */
const curveRow = (date, base, slope) => ({ date, m1: base, m2: base + 0.02, m3: base + 0.05, m6: base + 0.1, y1: base + 0.2, y2: base + 0.3 + slope * 0.2,
  y3: base + 0.4 + slope * 0.3, y5: base + 0.5 + slope * 0.5, y7: base + 0.6 + slope * 0.7, y10: base + 0.7 + slope, y20: base + 1.0 + slope, y30: base + 0.95 + slope });
function curveRows() {      /* newest first, one row a weekday for 400 days (270 rows is what the page reads: a year and a little more) */
  const out = []; let d = "2026-10-06";
  const h = load();
  for (let i = 0; i < 400; i++) { const wd = new Date(h.ecAnchor(d) * 1000).getUTCDay(); if (wd !== 0 && wd !== 6) out.push(curveRow(d, 4.0 + i * 0.001, 0.5 - i * 0.002)); d = h.ecShift(d, -1); }
  return out;
}
test("the curve is today against a week, a month and a year ago, with 2s10s and 3m10y", () => {
  const h = load(), rows = curveRows().slice(0, 270), html = h.hm2CurveHTML(rows, 560);
  assert.match(block, /pg\("treasury_rates\?select=\*&order=date\.desc&limit=270"\)/, "one read: 270 sessions reach a year back");
  assert.equal((html.match(/<polyline class="hm2-cl"/g) || []).length, 3, "three older curves");
  assert.equal((html.match(/<polyline class="hm2-cl hm2-cl--now (up|dn)"/g) || []).length, 1, "and today's, in the day's colour");
  assert.match(html, /TODAY 10-06/); assert.match(html, /1W AGO 09-29/); assert.match(html, /1M AGO 09-0[4-7]/); assert.match(html, /1Y AGO 2025-10-06/);
  assert.match(html, /<b>2s10s<\/b><span class="hm2-sp__v (up|dn)">[+−]\d\.\d\d<\/span>/); assert.match(html, /<b>3m10y<\/b>/);
  assert.match(html, /bp today/); assert.equal((html.match(/<svg class="hm2-spark"/g) || []).length, 2, "each spread carries its own year");
  assert.match(html, /<table class="hm2-ytbl"><tr><th><\/th><th>3M<\/th><th>2Y<\/th><th>5Y<\/th><th>10Y<\/th><th>30Y<\/th><\/tr>/, "the ladder's numbers stay in the room");
  assert.doesNotMatch(html, /stroke:#(8|9|a|b|c)[0-9a-f]\1/i, "no grey line");
});
test("the day's colour follows the 10-year; an inverted spread says so; a short table draws what it has", () => {
  const h = load();
  const up = h.hm2CurveHTML([curveRow("2026-10-06", 4.1, 0.5), curveRow("2026-10-05", 4.0, 0.5)], 400);
  assert.match(up, /hm2-cl--now up/); assert.equal((up.match(/<polyline class="hm2-cl"/g) || []).length, 0, "no older curve stored: none drawn");
  const dn = h.hm2CurveHTML([curveRow("2026-10-06", 4.0, 0.5), curveRow("2026-10-05", 4.1, 0.5)], 400);
  assert.match(dn, /hm2-cl--now dn/);
  const inv = h.hm2CurveHTML([curveRow("2026-10-06", 4.0, -1.2), curveRow("2026-10-05", 4.0, -1.1)], 400);
  assert.match(inv, /<span class="hm2-sp__inv">INVERTED<\/span>/);
  const flat = h.hm2CurveHTML([curveRow("2026-10-06", 4.0, 0.5), curveRow("2026-10-05", 4.0, 0.5)], 400);
  assert.match(flat, /hm2-cl--now flat/, "an unchanged 10-year is the accent colour (flat), never a grey");
  assert.match(css, /\.hm2-cl--now\.flat, \.hm2-sl\.flat\{ stroke:var\(--crk\); \}/);
  assert.match(h.hm2CurveHTML([], 400), /the curve is not stored yet/);
});

/* ---- 3 · Treasury auctions -------------------------------------------------------------------------- */
const TD = (o) => Object.assign({ securityType: "Note", securityTerm: "10-Year", originalSecurityTerm: "10-Year", tips: "No", floatingRate: "No", reopening: "No",
  cusip: "91282CRF0", auctionDate: "2026-08-12T00:00:00", announcementDate: "2026-08-05T00:00:00", issueDate: "2026-08-17T00:00:00", maturityDate: "2036-08-15T00:00:00",
  closingTimeCompetitive: "01:00 PM", offeringAmount: "42000000000", highYield: "4.6830", averageMedianYield: "4.6300", lowYield: "4.5000", interestRate: "4.625000",
  bidToCoverRatio: "2.530000", competitiveAccepted: "41821613600", indirectBidderAccepted: "32087936000", directBidderAccepted: "6135867600",
  primaryDealerAccepted: "3597810000", totalAccepted: "52623557100", totalTendered: "116957209500", somaAccepted: "10623511200", updatedTimestamp: "2026-08-12T13:03:16" }, o);
test("a TreasuryDirect row becomes a table row: the stop, the cover and who took it (real 12 Aug 2026 10-year)", () => {
  const r = auctionRow(TD({}));
  assert.equal(r.term, "10-Year"); assert.equal(r.auction_date, "2026-08-12"); assert.equal(r.status, "auctioned"); assert.equal(r.reopening, false);
  assert.equal(r.offering_amount, 42e9); assert.equal(r.high_yield, 4.683); assert.equal(r.bid_to_cover, 2.53); assert.equal(r.closing_time_et, "01:00 PM");
  assert.equal(r.indirect_pct, 76.726); assert.equal(r.direct_pct, 14.672); assert.equal(r.dealer_pct, 8.603);
  assert.ok(Math.abs(r.indirect_pct + r.direct_pct + r.dealer_pct - 100) < 0.01, "the three classes are the whole competitive award");
});
test("a reopening is kept under the name it trades by; an announcement has a size and no result yet", () => {
  const today = auctionRow(TD({ securityTerm: "9-Year 10-Month", reopening: "Yes", auctionDate: "2026-10-07T00:00:00", offeringAmount: "39000000000", highYield: "5.3000", bidToCoverRatio: "2.770000" }));
  assert.equal(today.term, "10-Year"); assert.equal(today.security_term, "9-Year 10-Month"); assert.equal(today.reopening, true);
  const tomorrow = auctionRow(TD({ securityType: "Bond", securityTerm: "29-Year 10-Month", originalSecurityTerm: "30-Year", reopening: "Yes", cusip: "912810UW6", auctionDate: "2026-10-08T00:00:00",
    offeringAmount: "22000000000", highYield: "", bidToCoverRatio: "", competitiveAccepted: "", indirectBidderAccepted: "", directBidderAccepted: "", primaryDealerAccepted: "" }));
  assert.equal(tomorrow.term, "30-Year"); assert.equal(tomorrow.status, "announced"); assert.equal(tomorrow.offering_amount, 22e9);
  assert.equal(tomorrow.high_yield, null); assert.equal(tomorrow.bid_to_cover, null); assert.equal(tomorrow.indirect_pct, null, "an empty field is absent, never a zero");
});
test("only the seven nominal coupon terms are kept: no TIPS, no floating-rate notes, no bills, no odd terms", () => {
  assert.deepEqual([...TERMS], ["2-Year", "3-Year", "5-Year", "7-Year", "10-Year", "20-Year", "30-Year"]);
  assert.equal(auctionRow(TD({ tips: "Yes" })), null); assert.equal(auctionRow(TD({ floatingRate: "Yes", securityTerm: "2-Year", originalSecurityTerm: "2-Year" })), null);
  assert.equal(auctionRow(TD({ securityType: "Bill", securityTerm: "13-Week", originalSecurityTerm: "13-Week" })), null);
  assert.equal(auctionRow(TD({ cusip: "" })), null); assert.equal(auctionRow(null), null);
  const rows = auctionRows([TD({}), TD({}), TD({ cusip: "X1", auctionDate: "2026-09-09T00:00:00" }), TD({ tips: "Yes", cusip: "T1" })]);
  assert.deepEqual(rows.map((r) => r.cusip + " " + r.auction_date), ["X1 2026-09-09", "91282CRF0 2026-08-12"], "one row per security and date, newest first");
  assert.match(searchUrl("Note", "2026-09-01", "2026-11-21"), /^https:\/\/www\.treasurydirect\.gov\/TA_WS\/securities\/search\?format=json&type=Note&startDate=2026-09-01&endDate=2026-11-21&dateFieldName=auctionDate$/);
});
const auc = (term, date, btc, ind, dlr, extra = {}) => Object.assign({ cusip: term + date, auction_date: date, term, status: "auctioned", reopening: false, closing_time_et: "01:00 PM",
  offering_amount: 39e9, high_yield: 5.3, median_yield: 5.25, bid_to_cover: btc, indirect_pct: ind, direct_pct: 100 - ind - dlr, dealer_pct: dlr }, extra);
test("each result stands against the six auctions of the SAME term before it", () => {
  const rows = [auc("10-Year", "2026-10-07", 2.77, 80.3, 2.5), auc("3-Year", "2026-10-06", 2.62, 57.6, 10.7),
    auc("10-Year", "2026-09-09", 2.71, 79.2, 4.3), auc("10-Year", "2026-08-12", 2.53, 76.7, 8.6), auc("10-Year", "2026-07-08", 2.59, 74, 9), auc("10-Year", "2026-06-10", 2.57, 73, 10),
    auc("10-Year", "2026-05-12", 2.40, 64, 12), auc("10-Year", "2026-04-08", 2.43, 77.5, 9.1), auc("10-Year", "2026-03-11", 9.99, 1, 99)];
  const six = againstLastSix(rows, rows[0]);
  assert.equal(six.n, 6); assert.deepEqual(six.prior.map((r) => r.auction_date), ["2026-09-09", "2026-08-12", "2026-07-08", "2026-06-10", "2026-05-12", "2026-04-08"], "the seventh back and the 3-year are not in it");
  assert.equal(+six.bid_to_cover.toFixed(3), 2.538, "the real six-auction average the 7 Oct reopening was measured against");
  const h = load(), mine = h.hm2AucVsSix(rows.filter((r) => r.status === "auctioned"), rows[0]);
  assert.equal(mine.n, 6); assert.equal(+mine.btc.toFixed(3), 2.538, "the page computes the same average as the writer's module");
});
test("the card: the stop, cover and takedown each against the six; green is more demand, and for dealers LESS is the stronger auction", () => {
  const h = load(), today = h.ecToday();
  const rows = [auc("30-Year", h.ecShift(today, 1), null, null, null, { status: "announced", reopening: true, offering_amount: 22e9, high_yield: null, bid_to_cover: null, indirect_pct: null, direct_pct: null, dealer_pct: null }),
    auc("10-Year", today, 2.77, 80.3, 2.5, { reopening: true }),
    auc("10-Year", h.ecShift(today, -28), 2.71, 79.2, 4.3), auc("10-Year", h.ecShift(today, -56), 2.53, 76.7, 8.6), auc("10-Year", h.ecShift(today, -84), 2.59, 74, 9)];
  const html = h.hm2AuctionsHTML(rows);
  assert.match(html, /<b>10Y · REOPENING<\/b><span>\$39B · TODAY 1:00 PM ET<\/span>/); assert.match(html, /STOPPED AT<\/span><b>5\.300%<\/b>/);
  assert.match(html, /BID-TO-COVER<\/span><b>2\.77×<\/b><span class="hm2-avs up"[^>]*>\+0\.16 vs 6<\/span>/, "more cover than the three before it: green");
  assert.match(html, /DEALERS<\/span><b>2\.5%<\/b><span class="hm2-avs up"[^>]*>−4\.8 vs 6<\/span>/, "dealers left with less than usual: also green");
  assert.match(html, /<span class="hm2-aup__i"><b>30Y reopening<\/b> \$22B · tomorrow 1:00 PM ET<\/span>/, "what is coming, with its size");
  assert.match(h.hm2AuctionsHTML([]), /no auctions stored yet/);
});
test("the table and its way back: additive, anon read, and the rollback drops exactly what was added", () => {
  assert.match(mig, /create table if not exists public\.treasury_auctions \(/); assert.match(mig, /primary key \(cusip, auction_date\)/);
  assert.match(mig, /alter table public\.treasury_auctions enable row level security;/); assert.match(mig, /for select to anon using \(true\);/);
  assert.doesNotMatch(mig, /\b(drop table|alter table (?!public\.treasury_auctions)|delete from|update public\.)/i, "nothing that exists is altered");
  assert.match(rollback, /drop policy if exists treasury_auctions_anon_read on public\.treasury_auctions;\ndrop table if exists public\.treasury_auctions;/);
  assert.match(rollback, /cron\.unschedule\(jobname\) from cron\.job where jobname in \('treasury-auctions-results', 'treasury-auctions-daily'\)/, "and the two schedules, if they were ever made");
  assert.match(cron, /cron\.schedule\('treasury-auctions-results', '\*\/5 17-18 \* \* 1-5'/); assert.match(cron, /cron\.schedule\('treasury-auctions-daily', '10 12 \* \* 1-5'/);
  for (const col of Object.keys(auctionRow(TD({})))) assert.match(mig, new RegExp("\\n  " + col + "\\s"), "the module writes " + col + "; the table has it");
  const fn = read("../supabase/functions/treasury-auctions/index.ts");
  assert.match(fn, /treasury_auctions\?on_conflict=cusip,auction_date/, "the function writes this one table, by its own key");
  assert.equal((fn.match(/\/rest\/v1\//g) || []).length, 1, "and no other");
  assert.match(fn, /const from = asked \? \(asked < FIRST_FILL_FROM \? FIRST_FILL_FROM : asked\)/, "an open door is a small one: no history before the first fill's start");
  assert.match(fn, /if \(!rows\.length\) return J\(\{ \.\.\.out, ok: false,/, "a source that answered nothing is said out loud, never an empty success");
});

/* ---- 4 · the surprise strips ------------------------------------------------------------------------ */
const print = (event, day, actual, estimate, previous = null) => ({ event_ts: ts(day + "T12:30:00Z"), country: "US", event, actual, estimate, previous, impact: "High" });
test("better than expected is up and green, worse is down and red — and for unemployment and inflation a LOWER number is the better one", () => {
  const h = load();
  const by = h.hm2StripRows([print("Non Farm Payrolls (Aug)", "2026-09-04", 142, 75, 114), print("Non Farm Payrolls (Sep)", "2026-10-02", 29, 90, 142),
    print("Unemployment Rate (Aug)", "2026-09-04", 4.0, 4.1), print("Unemployment Rate (Sep)", "2026-10-02", 4.2, 4.1),
    print("Inflation Rate YoY (Aug)", "2026-09-11", 3.4, 3.4), print("Inflation Rate YoY (Jul)", "2026-08-12", 3.2, 3.3),
    print("Nonfarm Payrolls Private (Sep)", "2026-10-02", 10, 80), print("Unemployment Rate (Oct)", "2026-11-06", null, 4.2)]);
  assert.deepEqual(Object.keys(by).sort(), ["Inflation Rate YoY", "Non Farm Payrolls", "Unemployment Rate"], "only the named indicators, only prints that came with a consensus");
  const nfp = h.hm2StripHTML("Non Farm Payrolls", by["Non Farm Payrolls"]);
  assert.match(nfp, /<i class="up" style="height:13px;margin-top:2px"[^>]*better than expected[^>]*><\/i><i class="dn" style="height:1[0-3]px;margin-top:15px"/, "oldest on the left: the beat, then the miss");
  assert.match(nfp, /<span class="hm2-st__v is-dn"><b>29<\/b> vs 90<\/span>/); assert.match(nfp, /<span class="hm2-st__l">PAYROLLS<\/span>/);
  const ur = h.hm2StripHTML("Unemployment Rate", by["Unemployment Rate"]);
  assert.match(ur, /<i class="up"[^>]*actual 4 · expected 4\.1[^>]*better than expected/, "4.0% against 4.1% expected: fewer out of work, green");
  assert.match(ur, /<span class="hm2-st__v is-dn"><b>4\.2<\/b> vs 4\.1<\/span>/, "4.2% against 4.1%: worse, red");
  const cpi = h.hm2StripHTML("Inflation Rate YoY", by["Inflation Rate YoY"]);
  assert.match(cpi, /<i class="up"[^>]*actual 3\.2 · expected 3\.3/, "cooler than expected: green"); assert.match(cpi, /<i class="eq" style="margin-top:13px"[^>]*on consensus/, "exactly on consensus: the room's yellow dot on the line");
  assert.doesNotMatch(nfp + ur + cpi, /class="(flat|grey|gray|mute)"/, "no grey bar");
});
test("every indicator on the strips is one the room prints, and the read asks for exactly those", () => {
  const { HM2_STRIPS } = load();
  assert.equal(HM2_STRIPS.length, 18); assert.equal(new Set(HM2_STRIPS).size, 18);
  for (const n of ["Non Farm Payrolls", "Unemployment Rate", "Initial Jobless Claims", "Inflation Rate YoY", "Core PCE Price Index MoM", "Retail Sales MoM", "ISM Manufacturing PMI", "GDP Growth Rate QoQ", "Fed Interest Rate Decision"])
    assert.ok(HM2_STRIPS.includes(n), n);
  assert.match(block, /country=eq\.US&actual=not\.is\.null&estimate=not\.is\.null&or=\(/, "only prints that came with both numbers");
  assert.match(block, /"&event_ts=gte\." \+ after : ""\) \+ "&order=event_ts\.asc,event\.asc&limit=1000"/, "payrolls and unemployment share a minute: the next page starts ON the last minute, and a set drops the repeats");
});

/* ---- 5 · the put/call tape -------------------------------------------------------------------------- */
const pc = (ticker, calls_x, puts_x, o = {}) => Object.assign({ ticker, hhmm: "13:30", call_vol: 1000 * calls_x, put_vol: 500 * puts_x, usual_call_vol: 1000, usual_put_vol: 500,
  usual_sessions: 8, calls_x, puts_x, put_call: +(0.5 * puts_x / calls_x).toFixed(3), usual_put_call: 0.5, ratio_x: +(puts_x / calls_x).toFixed(2), thin: false }, o);
test("each name shows the two factors apart, then the ratio against its usual — which is exactly puts× ÷ calls×", () => {
  const h = load(), html = h.hm2PcItemHTML(pc("SOFI", 0.83, 2.22));
  assert.match(html, /<b class="sc-ss__tk">SOFI<\/b>/); assert.match(html, /<span class="hm2-pc__c">C 0\.8×<\/span><span class="hm2-pc__p">P 2\.2×<\/span>/);
  assert.match(html, /<span class="hm2-pc__r dn">P\/C 1\.34 · 2\.7×<\/span>/, "2.22 ÷ 0.83 = 2.67: put-heavier than its usual, red");
  assert.match(html, /<rect class="c" x="1" y="1" width="8" height="4"\/><rect class="p" x="1" y="7" width="22" height="4"\/>/, "two bars on one scale, 0 to 3× the usual day");
  assert.match(html, /<line class="u" x1="11" x2="11"/, "the upright line is 1×: the usual day");
  assert.match(h.hm2PcItemHTML(pc("MU", 2.5, 2.05)), /<span class="hm2-pc__r up">P\/C 0\.41 · 0\.8×<\/span>/, "both heavy, calls heavier: the ratio is BELOW its usual, green");
});
test("a name flashes at 1.5× its own usual ratio, never below it, and never when it is thinly traded", () => {
  const h = load();
  assert.equal(h.HM2_PC_FLASH_X, 1.5);
  assert.match(h.hm2PcItemHTML(pc("A", 1, 1.5)), /class="sc-ss__it hm2-pc is-hot"/); assert.doesNotMatch(h.hm2PcItemHTML(pc("A", 1, 1.49)), /is-hot/);
  const thin = h.hm2PcItemHTML(pc("AGIX", 0.47, 26.67, { thin: true }));
  assert.match(thin, /class="sc-ss__it hm2-pc is-thin"/); assert.doesNotMatch(thin, /is-hot/); assert.match(thin, /thinly traded: never flashes/);
  assert.match(block, /scScint\(node\.querySelector\("\.sc-ss__tk"\), false\)/, "the flash is the Hub's one primitive, on the name itself");
  assert.doesNotMatch(block, /@keyframes|animation:/, "no second animation is invented");
});
test("SPY and QQQ lead, then the favourites and radar names, furthest above their usual first; the tape is the scintillas tape's own box", () => {
  const h = load(), rows = [pc("MU", 2.5, 2.05), pc("QQQ", 0.75, 0.87), pc("AGIX", 0.47, 26.67, { thin: true }), pc("SOFI", 0.83, 2.22), pc("SPY", 0.83, 0.98), pc("XOM", 1, 5)];
  assert.deepEqual(Array.from(h.hm2PcOrder(rows, new Set(["SPY", "QQQ", "MU", "SOFI", "AGIX"])), (r) => r.ticker), ["SPY", "QQQ", "SOFI", "MU", "AGIX"]);
  const html = h.hm2PcHTML(h.hm2PcOrder(rows, new Set(["SPY", "QQQ", "MU", "SOFI"])));
  assert.match(html, /^<div class="sc-ss sc-ss--one sc-ss--tape hm2-pcbox"/); assert.match(html, /<span class="sc-ss__lbl">PUT \/ CALL<\/span><span class="sc-ss__n"[^>]*>1<\/span><span class="sc-ss__coh">13:30 ET<\/span>/);
  assert.equal((html.match(/data-hm2="pc"/g) || []).length, 8, "the items twice over, so the tape runs without a seam");
  assert.match(block, /catch \(_\) \{ host\.innerHTML = ""; return; \}/, "until the view exists the strip is absent and the dashboard is as it was");
});

/* ---- the deeper history (a job for the machine that holds the key; here only its mapping) ------------- */
test("the history job keeps the strips' own eighteen US families, maps them as the live job does, and can only ADD rows", () => {
  const { HM2_STRIPS } = load();
  assert.deepEqual([...FAMILIES], Array.from(HM2_STRIPS), "the same eighteen names the strips draw");
  assert.equal(baseOf("Non Farm Payrolls (Feb)"), "Non Farm Payrolls"); assert.equal(baseOf("GDP Growth Rate QoQ (Q4)"), "GDP Growth Rate QoQ");
  assert.match(page, /const EC_MONTH_TAG = \/\\s\*\\\(\(Q\[1-4\]\|Jan\|Feb\|Mar\|Apr\|May\|Jun\|Jul\|Aug\|Sep\|Oct\|Nov\|Dec\)\[\^\)\]\*\\\)\\s\*\$\/i;/, "the page's own month-tag rule, which the job copies");
  const rows = calendarRows([
    { date: "2019-03-08 13:30:00", country: "US", event: "Non Farm Payrolls (Feb)", actual: 20, estimate: 180, previous: 311, impact: "High" },
    { date: "2019-03-08 13:30:00", country: "US", event: "Non Farm Payrolls (Feb)", actual: 20, estimate: 180 },
    { date: "2019-03-08 13:30:00", country: "DE", event: "Unemployment Rate (Feb)", actual: 5 },
    { date: "2019-03-08 13:30:00", country: "US", event: "Nonfarm Payrolls Private (Feb)", actual: 25, estimate: 170 },
    { date: "2019-03-08 13:30:00", country: "US", event: "Unemployment Rate (Feb)", actual: 3.8, estimate: "", previous: 4.0, impact: "High" }]);
  assert.deepEqual(rows.map((r) => r.event), ["Non Farm Payrolls (Feb)", "Unemployment Rate (Feb)"], "US only, the named families only, one row per release");
  assert.equal(rows[0].event_ts, 1552051800); assert.equal(rows[0].estimate, 180); assert.equal(rows[1].estimate, null, "an empty consensus is absent, never a zero");
  assert.deepEqual(windows("2024-01-01", "2024-03-05").map((w) => w.join("→")), ["2024-01-01→2024-01-30", "2024-01-31→2024-02-29", "2024-03-01→2024-03-05"], "30-day windows: one long window comes back cut short");
  const out = toSql(rows);
  assert.match(out, /on conflict \(event_ts, country, event\) do nothing;\n$/, "a row the live job wrote can never be changed");
  assert.doesNotMatch(out, /\b(update|delete)\b/i);
  const job = fs.readFileSync(P("../scripts/hm2-econ-calendar-backfill.mjs"), "utf8");
  assert.match(job, /process\.env\.FMP_API_KEY \|\| process\.env\.FMP_KEY/); assert.doesNotMatch(job, /console\.(log|error)\([^)]*\bK\b/, "the key is never printed");
});
