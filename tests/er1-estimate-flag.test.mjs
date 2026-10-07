// ER1 (6 Oct 2026) · the "estimate vs guidance" rule is mechanical: these are its fixed expectations on the data captured that night.
import test from "node:test"; import assert from "node:assert/strict"; import fs from "node:fs"; import path from "node:path";
import { flagName, cagr, RULE } from "../deliverables/20261006/estimates-vs-guidance/tools/flag-rule.mjs";
const flags = JSON.parse(fs.readFileSync(path.join("deliverables/20261006/estimates-vs-guidance/data/flags.json"), "utf8"));
test("Alphabet and Amazon: the current-year EPS carries investment mark-ups, the consensus is GAAP, so ONE-OFF fires and the clean base is below the shown year", () => {
  for (const t of ["GOOGL", "AMZN"]) {
    assert.equal(flags[t].basis, "GAAP");
    assert.ok(flags[t].flags.some(f => f.code === "ONE-OFF"), t + " ONE-OFF");
    assert.ok(flags[t].cleanFy0 < flags[t].fy0_eps, t + " clean base below shown");
    assert.ok(flags[t].growthShown < 0 && flags[t].growthClean > 0, t + " the dip turns into growth on the clean base");
  }
});
test("Western Digital: the SanDisk gains sit in GAAP only; the consensus is non-GAAP, so no ONE-OFF, and the guide check is IN LINE", () => {
  assert.equal(flags.WDC.basis, "NON-GAAP");
  assert.ok(!flags.WDC.flags.some(f => f.code === "ONE-OFF"));
  assert.ok(flags.WDC.flags.some(f => f.code === "GAAP-GAIN-OUTSIDE"));
  assert.equal(flags.WDC.guideVerdict, "IN LINE");
});
test("Seagate, Micron, Lam: next-quarter consensus within 5% of the company's guided EPS", () => {
  for (const t of ["STX", "MU", "LRCX"]) assert.equal(flags[t].guideVerdict, "IN LINE", t);
});
test("Micron: the fiscal-date key of the Hub's snapshots changed after the 30 Sep report, so KEY-CHANGED fires", () => {
  assert.ok(flags.MU.flags.some(f => f.code === "KEY-CHANGED"));
});
test("the rule itself: a quarter whose other income is a quarter of pre-tax profit, on a GAAP consensus, is a one-off", () => {
  const r = flagName({ fy0: { eps: 10, n: 30, low: 9, high: 11 }, fy1: { eps: 9, n: 30, low: 8, high: 10 },
    quarters: [{ in_fy0: true, other_inc_b: 50, pretax_b: 100, tax_b: 20, ni_b: 80, eps_dil: 4, street_eps: 4 }], guide: { eps: null }, nextQuarterConsensus: null, snapshotDays: 1, snapshotKeyChanged: false });
  assert.equal(r.basis, "GAAP"); assert.ok(r.flags.some(f => f.code === "ONE-OFF")); assert.equal(r.oneOffPerShare, 2); assert.equal(r.cleanFy0, 8);
  assert.ok(r.growthShown < 0 && r.growthClean > 0);
});
test("the rule itself: next-quarter consensus 8% above the guide is ABOVE GUIDE; within the band is IN LINE", () => {
  const base = { fy0: { eps: 10, n: 30, low: 9, high: 11 }, fy1: { eps: 12, n: 30, low: 11, high: 13 }, quarters: [], snapshotDays: 1 };
  assert.equal(flagName({ ...base, guide: { eps: 1.00 }, nextQuarterConsensus: 1.08 }).guideVerdict, "ABOVE GUIDE");
  assert.equal(flagName({ ...base, guide: { eps: 1.00 }, nextQuarterConsensus: 1.03 }).guideVerdict, "IN LINE");
  assert.equal(RULE.guideBand, 0.05);
});
test("cagr: three years from 15.15 to 25.05 is about 18%", () => { assert.ok(Math.abs(cagr(15.15, 25.05, 3) - 0.1825) < 0.001); });
