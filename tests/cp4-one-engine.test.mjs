/* CP4 (7 Oct 2026) · ONE ENGINE, ONE ARTIFACT, EVERY SCREEN READS IT. These tests fail when a screen computes its own comps, when the
   artifact is missing a name every screen must print, when the weights do not put growth first, or when the two copies of the
   reader drift. They also pin the pieces of the engine that are new today (the consistency cut, the debt discount, the PEG cap,
   the closeness weights, the Geiger percentile) and that the older labels say "next four quarters". */
import test from "node:test"; import assert from "node:assert/strict"; import { readFileSync, existsSync } from "node:fs"; import path from "node:path"; import { fileURLToPath } from "node:url";
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), ".."), DATA = ROOT + "/deliverables/20261007/comps-engine/data";
const J = (p) => JSON.parse(readFileSync(p, "utf8")), IDX = J(DATA + "/comps.json"), CARDS = J(DATA + "/cards.json"), KOF = J(DATA + "/knockout-comps.json");
const TWELVE = ["GOOGL", "AMZN", "AVGO", "NVDA", "TSM", "VST", "MU", "ORCL", "DLR", "EQIX", "SNDK", "WDC"];
/* CP5: a test that names a figure of the 6 Oct close skips itself when the files are from another close (the nightly rebuild's neighbour) */
const SIX_OCT = IDX.today === "2026-10-06" ? {} : { skip: "the engine's files are from the " + IDX.today + " close; this test names 6 Oct figures" };
const A = await import(ROOT + "/lib/comps-artifact.mjs"), F = await import(ROOT + "/deliverables/20261003/comps-c5/field.mjs"), E = await import(ROOT + "/lib/debt-reading.mjs");

test("the artifact carries every one of the twelve names, in full, with a blend, yardsticks, peers, weights and flags", () => {
  for (const t of TWELVE) { const s = IDX.names[t]; assert.ok(s && s.ok, t + " in the index"); assert.ok(s.blend && Number.isFinite(s.blend.centre), t + " has a centre");
    const r = J(`${DATA}/names/${t}.json`); assert.ok(r.yardsticks && Object.keys(r.yardsticks).length >= 6, t + " has the six yardsticks"); assert.ok(r.peers.length >= 4, t + " has peers"); assert.ok(r.weights && Array.isArray(r.flags) && r.sets && r.sets.old && r.sets.now, t + " has weights, flags and both sets");
    const sum = Object.values(r.weights).reduce((a, b) => a + b, 0); assert.ok(Math.abs(sum - 1) < 0.02, t + " weights add to one: " + sum); } });
test("one number per name on every screen: the cards and the knockout feed carry the artifact's centre and upside, untouched", () => {
  for (const t of TWELVE) { const s = IDX.names[t], c = CARDS.cards[t], k = KOF.names[t]; assert.ok(c && k, t + " has a card and a knockout row");
    assert.equal(c.comps.centre, s.blend.centre, t + " card centre"); assert.equal(c.comps.upside_pct, s.blend.upside_pct, t + " card upside"); assert.equal(c.fundamentals.fwd_pe, s.forward.pe, t + " card forward P/E");
    assert.equal(k.after.band.centre, s.blend.centre, t + " knockout centre"); assert.equal(k.after.upside_pct, s.blend.upside_pct, t + " knockout upside"); } });
test("the Hub's COMPS tab reads the artifact first and only falls back for a name the artifact does not carry", () => {
  const tab = readFileSync(ROOT + "/deliverables/20261003/comps-c5/tab.mjs", "utf8"), ce = readFileSync(ROOT + "/deliverables/20261007/comps-engine/tab.mjs", "utf8");
  assert.ok(/mountFromArtifact\(root, opts\)\) \{ root\.dataset\.source = "comps-engine"; return; \}/.test(tab), "the tab returns after the artifact answers, before any set is built");
  assert.ok(tab.indexOf("mountFromArtifact") < tab.indexOf("await loadSet(S)"), "the artifact is tried before loadSet");
  for (const word of ["buildSet", "conclusion6", "readSet", "snapshotFromCohort", "measureWeights"]) assert.ok(!ce.includes(word), "the engine tab never calls " + word); });
test("the allocation tool reads the same files and carries a byte-identical copy of the reader", () => {
  const tool = ["alloc-cp5-comps-default-20261007", "alloc-cp4-clickthrough-20261007"].map((d) => ROOT.replace(/_worktrees\/.*$/, "_worktrees/" + d + "/index.html")).find((f) => existsSync(f)); if (!tool) return;   // the tool's worktree is beside this one on the build machine (CP5: this round's first)
  const s = readFileSync(tool, "utf8"), lib = readFileSync(ROOT + "/lib/comps-artifact.mjs", "utf8").replace(/export const /g, "const ").replace(/export function /g, "function ");
  const a = s.indexOf("/*C4-READER-BEGIN*/\n") + "/*C4-READER-BEGIN*/\n".length, b = s.indexOf("\n/*C4-READER-END*/"); assert.ok(a > 20 && b > a, "the reader block is in the tool");
  assert.equal(s.slice(a, b).trim(), lib.trim(), "the tool's reader equals lib/comps-artifact.mjs");
  assert.ok(s.includes("'https://scintillahub.ai/deliverables/20261007/comps-engine/data/cards.json'"), "the tool's cards come from the engine's file first");
  assert.ok(s.includes("/deliverables/20261007/comps-engine/data/names/"), "the tool's click-through reads names/<TICKER>.json"); });
test("growth and PEG weigh most: the prior puts PEG first and forward P/E second, and the page prints every weight", () => {
  const P = F.CP4_PRIOR; assert.ok(P.peg > P.pe_fwd && P.pe_fwd > P.ev_ebitda && P.ev_ebitda >= P.pe_ttm && P.pe_ttm > P.ev_sales && P.ev_sales > P.ps, JSON.stringify(P));
  for (const t of TWELVE) { const r = J(`${DATA}/names/${t}.json`); for (const [k, y] of Object.entries(r.yardsticks)) assert.ok(Number.isFinite(y.weight) || y.weight === null, t + " " + k + " has a weight on the page"); } });
test("the consistency check: a far yardstick is flagged with its reason and its weight is cut, more the farther it sits", () => {
  let flagged = 0; for (const t of TWELVE) { const r = J(`${DATA}/names/${t}.json`), Y = r.yardsticks, far = Object.keys(r.consistency || {}).filter((k) => r.consistency[k].far), ok = Object.keys(Y).filter((k) => !far.includes(k) && (Y[k].weight_before_check || 0) > 0);
    for (const k of far) { const c = r.consistency[k]; flagged++; assert.ok(c.why && c.words, t + " " + k + " says why"); assert.ok(c.factor <= 0.5 && c.factor > 0, t + " " + k + " factor " + c.factor); }
    /* the flagged yardsticks together lose share to the unflagged ones (when any yardstick is unflagged; all flagged = only the mix changes) */
    if (far.length && ok.length) { const sum = (ks, f) => ks.reduce((a, k) => a + (Y[k][f] || 0), 0); assert.ok(sum(far, "weight") <= sum(far, "weight_before_check") + 1e-9, t + " flagged share fell: " + sum(far, "weight").toFixed(3) + " from " + sum(far, "weight_before_check").toFixed(3)); } }
  assert.ok(flagged >= 1, "at least one yardstick flagged among the twelve"); });
test("the debt discount follows the knockout's own steps (3 / 6 / 10) plus the years of free cash flow, and Oracle carries one", SIX_OCT, () => {
  assert.deepEqual(E.DEBT_STEPS, [[2.5, 0], [4, 0.03], [6, 0.06]]); assert.equal(E.DEBT_TOP, 0.10);
  const o = J(`${DATA}/names/ORCL.json`); assert.ok(o.debt.discount.pct >= 3, "Oracle's discount " + o.debt.discount.pct); assert.ok(o.blend.centre < o.blend.centre_before_debt, "Oracle's centre is lower after the discount");
  const n = J(`${DATA}/names/NVDA.json`); assert.equal(n.debt.discount.pct, 0, "Nvidia, light debt, no discount"); });
test("the PEG yardstick counts growth up to the cap, and the growth credit never exceeds its ceiling", SIX_OCT, () => {
  assert.equal(F.PEG_GROWTH_CAP, 40); const a = J(`${DATA}/names/AVGO.json`); assert.ok(a.growth.next_to_following_pct > 40, "Broadcom grows faster than the cap"); assert.ok(a.yardsticks.peg.credit == null || a.yardsticks.peg.credit <= F.GROWTH_CREDIT_MAX);
  const cap = IDX.rule.growth_cap_pct; assert.ok(new RegExp("growth counted up to " + cap + "%").test(a.yardsticks.peg.basis || ""), "the PEG row's basis says so (CP5: the cap is a value — " + cap + " in this artifact; tests/cp5-expensive-only.test.mjs pins that it holds)"); });
test("closeness weights: a same-business peer of the company's size weighs more than a small adjacent one; the adjacent group never outweighs half the same-business group", () => {
  const snap = { ticker: "X", table: { company: { eps_g_fy: 30, om: 40 }, peers: { A: { eps_g_fy: 30, om: 40 }, B: { eps_g_fy: 30, om: 40 }, C: { eps_g_fy: 30, om: 40 }, D: { eps_g_fy: 30, om: 40 } } } };
  const set = { kept: [{ ticker: "A", ratio: 1, same_business: true }, { ticker: "B", ratio: 0.01, same_business: false }, { ticker: "C", ratio: 1, same_business: false }, { ticker: "D", ratio: 1, same_business: false }] };
  const w = F.peerWeightsCP4(snap, ["A", "B", "C", "D"], set).weights; assert.ok(w.A > w.B * 5, "A over B"); assert.ok(w.B + w.C + w.D <= 0.5 * w.A + 1e-9, "adjacent share capped"); });
test("today's Geiger is placed in today's year: the percentiles interpolate (Micron 0.14 → the 21st, as the knockout had it)", SIX_OCT, () => {
  const r = J(`${DATA}/names/MU.json`); assert.equal(A.geigerPercentile(r.geiger, 0.14), 21); const p39 = A.geigerPercentile(r.geiger, 0.39); assert.ok(p39 > 21 && p39 < 60, "0.39 sits higher: " + p39); assert.equal(A.geigerPercentile(r.geiger, 9), 100); });
test("peers by method: no stated set prices a name; the old set is shown beside the new; the four sources' dots are on every peer", async () => {
  for (const t of TWELVE) { const r = J(`${DATA}/names/${t}.json`); assert.ok(Array.isArray(r.sets.old) && Array.isArray(r.sets.now), t); for (const p of r.peers) assert.ok(p.votes && typeof p.votes.n === "number", t + " " + p.ticker + " has votes"); }
  const L = await import(ROOT + "/deliverables/20261003/comps-c5/lines.mjs"); assert.equal(L.CP4_LINES_ON.stated, false); assert.equal(L.CP4_LINES_ON.equipment, true); });
test("the automatic checks run every time: thin, fragile, size gap and business share are read for every name", () => {
  for (const [t, s] of Object.entries(IDX.names)) if (s.ok) { assert.ok(typeof s.blend.thin === "boolean" && typeof s.blend.fragile === "boolean", t); assert.ok(Array.isArray(s.flags), t); }
  assert.ok(IDX.counts.thin >= 1 && IDX.counts.fragile >= 1, "some are thin, some fragile"); });
test("the growth columns say next four quarters, not next FY est", () => {
  for (const f of ["deliverables/20260927/comps-single/comps.mjs", "deliverables/20260927/comps-r3/r3.mjs", "deliverables/20261001/comps-template/cohort.mjs", "deliverables/20261002/analytics-knockouts/bracket.mjs"]) assert.ok(!/next FY est/i.test(readFileSync(ROOT + "/" + f, "utf8")), f); });
test("the interest line: the statements job writes interest_expense and the additive migration with its rollback exists", () => {
  assert.ok(/interest_expense:num\(x\.interestExpense\)/.test(readFileSync(ROOT + "/supabase/functions/fmp-fundamentals/index.ts", "utf8")));
  assert.ok(existsSync(ROOT + "/supabase/migrations/20261007_cp3_interest_expense.sql") && existsSync(ROOT + "/supabase/migrations/20261007_cp3_interest_expense_ROLLBACK.sql")); });
test("the dry-run table design is a dry run: no insert is live", () => { const sql = readFileSync(DATA + "/comps-readings.dryrun.sql", "utf8"); assert.ok(/create table if not exists public\.comps_readings/.test(sql)); assert.ok(!/^\s*insert into/m.test(sql), "every insert is commented out"); });
