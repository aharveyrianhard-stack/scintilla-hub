import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
const src = page.match(/const ECON_RELEASE = \{[\s\S]*?\n\};\n/)[0] + page.match(/function econSeriesLastWrite\(rows\) \{[\s\S]*?\n\}\n/)[0] + page.match(/function econFreshness\(series, dateStr, updatedTs, nowMs\) \{[\s\S]*?\n\}\n/)[0] + "return { ECON_RELEASE, econFreshness, econSeriesLastWrite };";
const api = new Function(src)();
const NOW = Date.parse("2026-09-18T06:00:00Z"), sec = (iso) => Math.floor(Date.parse(iso) / 1000);
const RAN = sec("2026-09-18T05:47:03Z"), JUNE = sec("2026-06-09T23:05:50Z");

// Stored newest observation per series on 2026-09-18, and whether FRED itself carried anything newer that day
// (run evidence econ/RELEASE-VALIDATION-2026-09-18.json). behind=0 must read current; behind>0 must read behind.
const ACTUAL = [
  ["CPI", "2026-08-01", 0, RAN], ["federalFunds", "2026-08-01", 0, RAN], ["unemploymentRate", "2026-08-01", 0, RAN], ["totalNonfarmPayroll", "2026-08-01", 0, RAN],
  ["inflationRate", "2026-09-17", 0, RAN], ["retailSales", "2026-08-01", 0, RAN], ["consumerSentiment", "2026-07-01", 0, RAN], ["durableGoods", "2026-07-01", 0, RAN],
  ["initialClaims", "2026-09-12", 0, RAN], ["totalVehicleSales", "2026-08-01", 0, RAN], ["industrialProductionTotalIndex", "2026-07-01", 0, RAN],
  ["30YearFixedRateMortgageAverage", "2026-09-17", 0, RAN], ["15YearFixedRateMortgageAverage", "2026-09-17", 0, RAN],
  ["newPrivatelyOwnedHousingUnitsStartedTotalUnits", "2026-08-01", 0, RAN], ["smoothedUSRecessionProbabilities", "2026-07-01", 0, RAN],
  ["GDP", "2025-10-01", 2, RAN], ["realGDP", "2025-10-01", 2, RAN], ["realGDPPerCapita", "2025-10-01", 2, RAN], ["commercialBankInterestRateOnCreditCardPlansAllAccounts", "2025-11-01", 2, RAN],
  ["M2SL", "2026-04-01", 3, JUNE], ["WALCL", "2026-06-03", 15, JUNE], ["WTREGEN", "2026-06-03", 15, JUNE], ["RRPONTSYD", "2026-06-09", 69, JUNE],
];
test("ECONOMIC freshness agrees with what FRED had actually released on 2026-09-18, series by series", () => {
  for (const [series, date, releasesBehind, wrote] of ACTUAL) {
    const f = api.econFreshness(series, date, wrote, NOW);
    assert.equal(f.behind, releasesBehind > 0, series + " observed " + date + " (" + f.days + "d) with " + releasesBehind + " newer FRED releases");
  }
  assert.equal(ACTUAL.length + 1, Object.keys(api.ECON_RELEASE).length, "every known series is covered by the validation (plus the projection series)");
});
test("a valid latest release is not called stale just because its period began long ago (root review 02:03)", () => {
  for (const s of ["consumerSentiment", "durableGoods", "industrialProductionTotalIndex", "smoothedUSRecessionProbabilities"]) {
    const f = api.econFreshness(s, "2026-07-01", RAN, NOW); assert.equal(f.state, "WITHIN_RELEASE_LAG", s); assert.equal(f.days, 79); assert.equal(f.note, ""); }
  assert.equal(api.econFreshness("durableGoods", "2026-07-01", RAN, Date.parse("2026-09-24T12:00:00Z")).behind, false, "the day before August durable goods are published, July is still the latest release");
  assert.equal(api.econFreshness("durableGoods", "2026-07-01", RAN, Date.parse("2026-10-12T12:00:00Z")).behind, true, "two weeks after that release it is behind");
  assert.equal(api.econFreshness("GDP", "2026-04-01", RAN, NOW).behind, false, "Q2 GDP is the latest GDP in mid-September");
});
test("behind says WHY: the source supplied nothing newer, or the writer stopped, or the write time is unknown", () => {
  const src = api.econFreshness("GDP", "2025-10-01", RAN, NOW);
  assert.equal(src.state, "BEHIND_SOURCE"); assert.match(src.note, /^BEHIND - observed 352d ago, a newer release is normal after 225d - writer ran 2026-09-18, its source supplied no newer print$/);
  const stopped = api.econFreshness("WALCL", "2026-06-03", JUNE, NOW);
  assert.equal(stopped.state, "BEHIND_WRITER_STOPPED"); assert.match(stopped.note, /no writer has written this series since 2026-06-09$/);
  assert.equal(api.econFreshness("WALCL", "2026-06-03", null, NOW).state, "BEHIND_WRITE_UNKNOWN");
  assert.equal(api.econFreshness("WALCL", "2026-06-03", JUNE * 1000, NOW).wrote, "2026-06-09", "epoch milliseconds are read as such");
});
test("unknown is not stale: no rule, a projection, or an unreadable date make no staleness claim", () => {
  const u = api.econFreshness("someNewSeries", "2020-01-01", RAN, NOW); assert.equal(u.state, "UNKNOWN"); assert.equal(u.behind, false); assert.match(u.note, /no freshness claim/);
  const p = api.econFreshness("nominalPotentialGDP", "2026-07-01", RAN, NOW); assert.equal(p.state, "PROJECTION"); assert.equal(p.behind, false);
  const bad = api.econFreshness("CPI", "soon", RAN, NOW); assert.equal(bad.state, "UNKNOWN"); assert.equal(bad.behind, false);
});
test("the panel keeps observation, release lag and ingestion apart, tops up series the window missed, and labels every raw key", () => {
  assert.doesNotMatch(page, /ECON_CADENCE|function econAge\(/, "the two-periods rule is gone");
  assert.match(page, /const when = "observed " \+ esc\(r\.date\)/);
  assert.match(page, /const missing = Object\.keys\(ECON_RELEASE\)\.filter\(\(k\) => !inWindow\.has\(k\)\);/);
  assert.match(page, /series=eq\." \+ encodeURIComponent\(k\) \+ "&order=date\.desc&limit=1"/);
  assert.match(page, /could not read: ' \+ esc\(topUpFailed\.join\(", "\)\)/);
  assert.match(page, /behind their normal release lag/);
  assert.match(page, /macro rail · <b>stored prints<\/b>/); assert.doesNotMatch(page, /<h4>Source \(live\)<\/h4>/);
  assert.match(page, /econ_history\?select=series,date,value,updated_ts&order=date\.desc&limit=1000/);
  const lbl = new Function(page.match(/const ECON_LBL = \{[\s\S]*?\n\};\n/)[0] + "return ECON_LBL;")();
  for (const k of Object.keys(api.ECON_RELEASE)) assert.ok(lbl[k], k + " has a display label");
});
test("a live writer is not blamed for a silent source: the series' last write is its newest stamp across ALL rows, not the newest row's frozen stamp", () => {
  // federalFunds: FMP stops publishing after the 2026-08-01 print; the writer keeps running daily but only re-upserts rows inside its ~90-day window
  const now = Date.parse("2026-11-04T12:00:00Z");
  const rows = [{ series: "federalFunds", date: "2026-08-01", value: 3.63, updated_ts: sec("2026-10-30T17:47:00Z") },      // newest print: left the writer's window on 10-30, its stamp froze
                { series: "federalFunds", date: "2025-11-01", value: 3.9, updated_ts: sec("2026-11-04T05:47:00Z") },       // the year-ago slice the writer now gets back, rewritten today
                { series: "WALCL", date: "2026-06-03", value: 6711495, updated_ts: sec("2026-06-09T23:05:50Z") }, { series: "WALCL", date: "2026-05-27", value: 6704383, updated_ts: sec("2026-06-09T23:05:50Z") }];
  const last = api.econSeriesLastWrite(rows);
  assert.equal(api.econFreshness("federalFunds", "2026-08-01", rows[0].updated_ts, now).state, "BEHIND_WRITER_STOPPED", "the newest row's own stamp gets it wrong (the shipped c40fbc8 behaviour)");
  const f = api.econFreshness("federalFunds", "2026-08-01", last.federalFunds, now); assert.equal(f.state, "BEHIND_SOURCE"); assert.match(f.note, /writer ran 2026-11-04, its source supplied no newer print$/);
  assert.equal(api.econFreshness("WALCL", "2026-06-03", last.WALCL, now).state, "BEHIND_WRITER_STOPPED", "a series nobody writes is still called that");
  assert.deepEqual(api.econSeriesLastWrite([{ series: "x", updated_ts: null }, { series: "x", updated_ts: "junk" }]), {});
  assert.match(page, /const lastWrite = econSeriesLastWrite\(eh\);/); assert.match(page, /econFreshness\(r\.series, r\.date, lastWrite\[r\.series\] != null \? lastWrite\[r\.series\] : r\.updated_ts\)/);
});
