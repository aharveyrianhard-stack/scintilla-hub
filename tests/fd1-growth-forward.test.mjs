/* FD1 (7 Oct 2026) — growth measured from one forecast year to the next (CP1's decision 2, approved), inside the comps
   field (deliverables/20261003/comps-c5/field.mjs), tested together with the rules it touches: CP1's growth credit and
   its 1…3 limits, the PEG row, CP1's twelve switches (off is off), the same-business pricing of the memory line.
   Offline: three sets captured on the 6 Oct closes by tools/comps-rerun.mjs — Lilly, Vistra, Micron. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { pegGrowth, pegRow, fieldAdjust, CP1_FIELD_ON, CP1_FIELD_OFF, FD1_FIELD_ON, FD1_FIELD_LAST, GROWTH_CREDIT_MAX, LAST_YEAR_MAX, PEG_YEARS_MAX } from "../deliverables/20261003/comps-c5/field.mjs";
import { conclusion6, CP1_ALL, CP1_NONE, FD1_ALL, FD1_ALL_LAST } from "../deliverables/20261005/comps-c6/outliers.mjs";

const J = (p) => JSON.parse(readFileSync(new URL(p, import.meta.url), "utf8"));
const FX = (t) => J(`../deliverables/20261007/feed-fix/data/fixtures/set-${t}-fd1-2026-10-06.json`);
const CP1FX = (t) => { const f = J(`../deliverables/20261006/decision-cards/data/fixtures/set-${t}-cp1-2026-10-06.json`); return { ...f, after: f.after === "same as before" ? f.before : f.after }; };
const run = (f, fx) => conclusion6(f.after.snap, [], f.after.estimates, f.today, "C", { set: f.set_after, fx });
const upside = (C) => (C.band ? Math.round((C.band.mid / C.price - 1) * 1000) / 10 : null);
const near = (a, b, eps, msg) => assert.ok(a != null && Math.abs(a - b) <= eps, `${msg || ""} ${a} vs ${b}`);
const r1 = (v) => Math.round(v * 10) / 10;

test("off is off: CP1's twelve switches are still twelve, and with them the three sets answer exactly as CP1's run did", () => {
  assert.equal(Object.keys(CP1_ALL).length, 12); assert.equal(CP1_ALL.growthForward, undefined); assert.equal(CP1_FIELD_ON.growthForward, undefined); assert.equal(CP1_FIELD_OFF.growthForward, undefined);
  assert.deepEqual(FD1_ALL, { ...CP1_ALL, growthForward: true }); assert.deepEqual(FD1_ALL_LAST, { ...CP1_ALL, growthForward: true, growthFromLastYear: true });
  assert.deepEqual(FD1_FIELD_ON, { ...CP1_FIELD_ON, growthForward: true }); assert.deepEqual(FD1_FIELD_LAST, { ...FD1_FIELD_ON, growthFromLastYear: true });
  for (const [t, was] of [["LLY", -35.9], ["VST", 22.2], ["MU", 98.8]]) { const f = FX(t), C = run(f, CP1_ALL); assert.equal(upside(C), was, t + " under CP1's switches, as CP1 reported it"); assert.equal(upside(C), f.expect.cp1_upside_pct); assert.equal(C.cp1.growth.from, "trailing"); }
  /* the wider estimate read (the year just reported is on file) changes nothing until a switch asks for it */
  const f = FX("LLY"), noPast = { ...f, after: { ...f.after, estimates: Object.fromEntries(Object.entries(f.after.estimates).map(([t, e]) => [t, { ...e, est: e.est.filter((x) => x.fiscal_date >= f.today) }])) } };
  assert.deepEqual(run(f, CP1_ALL).band, run(noPast, CP1_ALL).band); assert.deepEqual(run(f, CP1_NONE).band, run(noPast, CP1_NONE).band); assert.deepEqual(run(f, FD1_ALL).band, run(noPast, FD1_ALL).band);
});
test("the reason for the switch, on the rows: measured from reported earnings AbbVie 'grows' 70% a year and Pfizer 42%; from one forecast year to the next, 12% and −8%", () => {
  const f = FX("LLY"), E = f.after.estimates, T = f.today, g = (t, o) => pegGrowth(E[t], T, o);
  assert.equal(r1(g("ABBV").pct), 70.2); assert.match(g("ABBV").basis, /^trailing EPS \$3\.55 → FY2029 consensus \$19\.85/);
  assert.equal(r1(g("ABBV", { consensusOnly: true }).pct), 12.2); assert.match(g("ABBV", { consensusOnly: true }).basis, /^FY2026 consensus \$14\.04 → FY2029 consensus \$19\.85, 3\.0 years/);
  assert.equal(r1(g("PFE").pct), 42.1); assert.equal(r1(g("PFE", { consensusOnly: true }).pct), -7.5, "a peer whose earnings are expected to shrink reads below zero, as it should");
  assert.equal(r1(g("LLY").pct), 24.8); assert.equal(r1(g("LLY", { consensusOnly: true }).pct), 18.5);
  /* the same window as before: the furthest forecast year inside three and a half years; only the starting point moves */
  assert.equal(g("LLY").to_date, g("LLY", { consensusOnly: true }).to_date); assert.equal(PEG_YEARS_MAX, 3.5);
});
test("Lilly: −35.9% → −30.6%. Its growth is 18.5% a year against the peers' 12.2% (all ten, the two shrinking ones counted), so PEG weighs 1.52×", () => {
  const f = FX("LLY"), a = run(f, CP1_ALL), b = run(f, FD1_ALL), g = b.cp1.growth;
  assert.equal(upside(a), -35.9); assert.equal(upside(b), -30.6); assert.equal(upside(b), f.expect.fd1_upside_pct);
  assert.equal(g.from, "forecast"); assert.equal(r1(g.own), 18.5); assert.equal(r1(g.peers), 12.2); assert.equal(g.n, 10); near(g.credit, g.own / g.peers, 1e-12); assert.ok(g.credit > 1.5 && g.credit < 1.55);
  assert.equal(a.cp1.growth.n, 10); assert.equal(r1(a.cp1.growth.peers), 21.4, "measured from reported earnings the peers looked nearly as fast as Lilly");
  const pa = a.rows.find((r) => r.key === "peg"), pb = b.rows.find((r) => r.key === "peg");
  assert.ok(pb.band.median > pa.band.median * 1.5, "the peers' PEG is no longer flattered by write-offs: " + pa.band.median + " → " + pb.band.median);
  assert.ok(pb.ends.median.price > pa.ends.median.price); assert.equal(pb.growth_from, "forecast"); assert.match(pb.basis, /from the first forecast year to the furthest/); assert.match(pa.basis, /three years out/);
  assert.equal(pb.values.PFE.multiple, null); assert.equal(pb.values.PFE.why, "EPS is not expected to grow", "a shrinking peer still has no PEG");
  near(Object.values(b.measureWeights.weights).reduce((x, y) => x + y, 0), 1, 1e-9, "the weights still add to one");
  /* every other yardstick is untouched */
  for (const k of ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps"]) assert.deepEqual(b.rows.find((r) => r.key === k).band, a.rows.find((r) => r.key === k).band, k);
});
test("Vistra: +22.2% → +25.1%. 18.1% a year against the regulated utilities' 9.4%: the credit is 1.92×, inside CP1's 1…3", () => {
  const f = FX("VST"), a = run(f, CP1_ALL), b = run(f, FD1_ALL), g = b.cp1.growth;
  assert.equal(upside(a), 22.2); assert.equal(upside(b), 25.1); assert.equal(r1(g.own), 18.1); assert.equal(r1(g.peers), 9.4); assert.ok(g.credit > 1.9 && g.credit < 1.95 && g.credit <= GROWTH_CREDIT_MAX);
  assert.ok(b.measureWeights.parts.peg.credit === g.credit); assert.equal(GROWTH_CREDIT_MAX, 3);
});
test("what the approved rule cannot see: the fiscal year in progress. Micron's own growth reads 11% a year (FY27 → FY29) where its earnings are more than doubling this year", () => {
  const f = FX("MU"), E = f.after.estimates, T = f.today;
  assert.equal(r1(pegGrowth(E.MU, T).pct), 44); assert.equal(r1(pegGrowth(E.MU, T, { consensusOnly: true }).pct), 11.1);
  assert.match(pegGrowth(E.MU, T, { consensusOnly: true }).basis, /^FY2027 consensus \$173\.77 → FY2029 consensus \$214\.65, 2\.0 years/);
  const a = run(f, CP1_ALL), b = run(f, FD1_ALL), c = run(f, FD1_ALL_LAST);
  assert.equal(upside(a), 98.8); assert.equal(upside(b), 89.3); assert.equal(upside(c), 105.5);
  for (const C of [a, b, c]) { assert.equal(C.c6.pricedOn, "business", "the memory line is still priced on the memory and storage peers"); assert.deepEqual(C.c6.businessPeers.slice().sort(), ["SNDK", "STX", "WDC"]); assert.equal(C.cp1.growth.credit, 1); }
  /* the proposal beside it: start from the year just reported, on the analysts' basis — the year in progress counts */
  const last = pegGrowth(E.MU, T, { consensusOnly: true, fromLast: true });
  assert.equal(r1(last.pct), 42.7); assert.match(last.basis, /^FY2026 consensus \(the year just reported\) \$73\.85 → FY2029 consensus \$214\.65, 3\.0 years/);
  assert.equal(c.cp1.growth.from, "last year");
});
test("from the year just reported: Lilly −25.5% and Vistra +34.5%; without that year on file it is the approved rule; a year older than thirteen months is not 'just reported'", () => {
  const lly = FX("LLY"), vst = FX("VST");
  assert.equal(upside(run(lly, FD1_ALL_LAST)), -25.5); assert.equal(upside(run(vst, FD1_ALL_LAST)), 34.5); assert.equal(run(vst, FD1_ALL_LAST).cp1.growth.credit, GROWTH_CREDIT_MAX, "capped at 3");
  const E = lly.after.estimates, T = lly.today;
  assert.equal(r1(pegGrowth(E.ABBV, T, { consensusOnly: true, fromLast: true }).pct), 18.9); assert.equal(r1(pegGrowth(E.MRK, T, { consensusOnly: true, fromLast: true }).pct), 3.5, "Merck: 55% a year from a forecast year that carries a charge, 3.5% from the year just reported");
  assert.equal(r1(pegGrowth(E.MRK, T, { consensusOnly: true }).pct), 55.5);
  const future = { ...E.ABBV, est: E.ABBV.est.filter((x) => x.fiscal_date >= T) };
  assert.deepEqual(pegGrowth(future, T, { consensusOnly: true, fromLast: true }), pegGrowth(future, T, { consensusOnly: true }));
  assert.equal(pegGrowth(E.ABBV, T, { fromLast: true }).basis, pegGrowth(E.ABBV, T).basis, "fromLast means nothing without consensusOnly: the trailing rule is CP1's");
  const old = { eps_ttm: 5, est: [{ fiscal_date: "2025-06-30", eps: 4 }, { fiscal_date: "2026-12-31", eps: 6 }, { fiscal_date: "2027-12-31", eps: 8 }] };
  assert.match(pegGrowth(old, "2026-10-06", { consensusOnly: true, fromLast: true }).basis, /^FY2026 consensus \$6\.00/, "a year that ended 15 months ago is not the starting point"); assert.equal(LAST_YEAR_MAX, 1.1);
  /* CP1's own Micron set holds future years only: there the two FD1 settings are one */
  const cp1mu = CP1FX("MU"), x = conclusion6(cp1mu.after.snap, [], cp1mu.after.estimates, cp1mu.today, "C", { set: cp1mu.set_after, fx: FD1_ALL }), y = conclusion6(cp1mu.after.snap, [], cp1mu.after.estimates, cp1mu.today, "C", { set: cp1mu.set_after, fx: FD1_ALL_LAST });
  assert.deepEqual(x.band, y.band);
});
test("the credit's neighbours: growers only when the switch is off (CP1 to the letter); every measured peer when on; a growing company among shrinking peers takes the full credit", () => {
  const row = (own, peers) => [{ key: "peg", figure: { growth: own }, growth: Object.fromEntries(peers.map((p, i) => ["P" + i, p == null ? null : { pct: p }])) }];
  const names = (n) => Array.from({ length: n }, (_, i) => "P" + i), snap = { table: { company: {}, peers: {} } };
  const off = fieldAdjust(snap, row(20, [10, -5, -8, 12, 30]), names(5), { growthCredit: true });
  assert.equal(off.growth.n, 3); assert.equal(off.growth.peers, 12); near(off.growth.credit, 20 / 12, 1e-12); assert.equal(off.growth.from, "trailing");
  const on = fieldAdjust(snap, row(20, [10, -5, -8, 12, 30]), names(5), { growthCredit: true, growthForward: true });
  assert.equal(on.growth.n, 5); assert.equal(on.growth.peers, 10); assert.equal(on.growth.credit, 2); assert.equal(on.growth.from, "forecast");
  const shrinking = fieldAdjust(snap, row(8, [-3, -5, -8, 2]), names(4), { growthCredit: true, growthForward: true });
  assert.equal(shrinking.growth.credit, GROWTH_CREDIT_MAX); assert.equal(shrinking.growth.ratio, null); assert.equal(shrinking.adj.credit.peg, GROWTH_CREDIT_MAX);
  assert.equal(fieldAdjust(snap, row(8, [-3, -5, -8, 2]), names(4), { growthCredit: true }).growth.credit, 1, "off: one grower is fewer than three peers, no credit");
  assert.equal(fieldAdjust(snap, row(-4, [10, 12, 14]), names(3), { growthCredit: true, growthForward: true }).growth.credit, 1, "a company not expected to grow gets none, either way");
  assert.equal(fieldAdjust(snap, row(20, [10, null, 12]), names(3), { growthCredit: true, growthForward: true }).growth.credit, 1, "still three measured peers or nothing");
  assert.equal(fieldAdjust(snap, row(5, [10, 12, 14]), names(3), { growthCredit: true, growthForward: true }).growth.credit, 1, "never under 1");
  assert.equal(fieldAdjust(snap, row(20, [10, 12, 14]), names(3), { growthForward: true }).growth, null, "growthForward alone gives no credit: it only says how growth is measured");
});
test("the PEG row both ways on one set: the multiples move, the price formula does not", () => {
  const f = FX("VST"), a = pegRow(f.after.snap, f.after.estimates, f.today), b = pegRow(f.after.snap, f.after.estimates, f.today, { forward: true }), c = pegRow(f.after.snap, f.after.estimates, f.today, { forward: true, fromLast: true });
  assert.equal(a.growth_from, "trailing"); assert.equal(b.growth_from, "forecast"); assert.equal(c.growth_from, "last year");
  for (const r of [a, b, c]) { near(r.own.multiple, r.values ? f.after.snap.rows.find((x) => x.key === "pe_fwd").own.multiple / r.figure.growth : 0, 1e-9, "PEG = forward P/E ÷ growth"); near(r.ends.median.price, r.band.median * r.figure.growth * f.after.snap.eps_fy1, 1e-6, "price = peers' PEG × own growth × own EPS"); }
  assert.ok(b.own.multiple > a.own.multiple && b.band.median > a.band.median);
  /* a foreign filer was already measured consensus to consensus; the switch changes nothing for it */
  const g = (o) => pegGrowth({ eps_ttm: null, est: [{ fiscal_date: "2026-12-31", eps: 10 }, { fiscal_date: "2028-12-31", eps: 14.4 }] }, "2026-10-06", o);
  assert.deepEqual(g({}), g({ consensusOnly: true })); near(g({}).pct, 20, 0.2);
});
