import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const page = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
test("ECONOMIC prints carry a cadence and are called STALE past it; the raw series keys are labelled; the rail no longer says live", () => {
  const src = page.match(/const ECON_LBL = \{[\s\S]*?\n\};\n/)[0] + page.match(/const ECON_CADENCE = \{[\s\S]*?\};\n/)[0] + page.match(/const ECON_CADENCE_WORD = [^\n]*\n/)[0] + page.match(/function econAge\(dateStr, cadenceDays\) \{[\s\S]*?\n\}\n/)[0] + "return { ECON_LBL, ECON_CADENCE, ECON_CADENCE_WORD, econAge };";
  const RealDate = Date; class FakeDate extends RealDate { constructor(...a) { super(...(a.length ? a : ["2026-09-18T05:00:00Z"])); } static now() { return RealDate.parse("2026-09-18T05:00:00Z"); } static parse(s) { return RealDate.parse(s); } }
  const api = new Function("Date", src)(FakeDate);
  assert.equal(api.econAge("2025-10-01", api.ECON_CADENCE.GDP).stale, true, "GDP dated a year ago is stale");
  assert.equal(api.econAge("2026-08-01", api.ECON_CADENCE.CPI).stale, false, "an August monthly print in mid-September is within cadence");
  assert.equal(api.econAge("2026-04-01", api.ECON_CADENCE.M2SL).stale, true, "M2 from April is stale");
  assert.equal(api.econAge("2026-06-03", api.ECON_CADENCE.WALCL).stale, true, "a weekly series from June is stale");
  assert.equal(api.econAge("2026-09-17", api.ECON_CADENCE["30YearFixedRateMortgageAverage"]).stale, false);
  for (const k of ["15YearFixedRateMortgageAverage", "commercialBankInterestRateOnCreditCardPlansAllAccounts", "newPrivatelyOwnedHousingUnitsStartedTotalUnits", "nominalPotentialGDP", "realGDPPerCapita", "smoothedUSRecessionProbabilities"]) assert.ok(api.ECON_LBL[k], k + " labelled");
  assert.match(page, /macro rail · <b>stored prints<\/b>/); assert.doesNotMatch(page, /<h4>Source \(live\)<\/h4>/);
  assert.match(page, /econ_history\?select=series,date,value,updated_ts&order=date\.desc&limit=1000/);
  assert.match(page, /STALE ' \+ \(age\.days >= 60 \? Math\.round\(age\.days \/ 30\) \+ " months" : age\.days \+ "d"\)/);
});
