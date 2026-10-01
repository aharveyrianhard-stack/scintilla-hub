/* COMPS tab (C2, 30 Sep · deliverables/20260930/comps-tab): the toggle arithmetic, save and put back, the flags, the three
   ways, the cohort table, and the Hub's wiring (own tab, ESTIMATES back to what it was). */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { selectionOf, latestDecisions, decisionRow, applySelection, isOff, flagRow, flags, ways, wayOf, cohortTable, sortCohort, FAR_K, MEASURES, median, priceAt } from "../deliverables/20260930/comps-tab/comps-tab.mjs";
import { snapshotFromCohort, cohortChoice, ROWS } from "../deliverables/20260930/comps-tab/cohort.mjs";
import { middleHalfBand, rangeOfMedians, weightedBlend } from "../deliverables/20260928/comps-r3-labels/labels-r3.mjs";
import { peerBand } from "../deliverables/20260927/comps-r3/r3.mjs";

const here = (p) => new URL(p, import.meta.url);
const SEMI = JSON.parse(readFileSync(here("../deliverables/20260930/comps-tab/cohort-SEMICONDUCTORS-2026-09-30.json"), "utf8"));
const POWER = JSON.parse(readFileSync(here("../deliverables/20260930/comps-tab/cohort-AI_POWERTRAIN-2026-09-30.json"), "utf8"));
const MU = SEMI.snapshots.find((s) => s.ticker === "MU"), GEV = POWER.snapshots.find((s) => s.ticker === "GEV");
const close = (a, b, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);
const at = (i) => new Date(Date.UTC(2026, 8, 30, 14, 0, i)).toISOString();

test("the fixtures: every peer with a positive multiple is IN (no cap), a peer without one has a named reason", () => {
  for (const S of [MU, GEV]) {
    assert.deepEqual(S.rows.map((r) => r.key), ROWS);
    for (const r of S.rows) {
      assert.equal(r.nm.length, 0, "nothing set aside by a cap");
      for (const p of r.peers) assert.ok(p.multiple > 0);
      for (const [t, v] of Object.entries(r.values)) { if (v.multiple == null) assert.ok(v.why, `${t} on ${r.key} has a reason`); else assert.ok(r.peers.some((p) => p.ticker === t)); }
    }
  }
  const pe = MU.rows.find((r) => r.key === "pe_ttm");
  assert.ok(pe.peers.some((p) => p.ticker === "AXTI" && p.multiple > 1000), "AXTI at 3000x is in ALL PEERS, not removed by a rule");
  assert.match(pe.values.INTC.why, /negative|no trailing EPS/);
  assert.ok(MU.geiger != null && MU.price > 0 && MU.members.length === 22);
});

test("decisions: latest per (peer, measure) wins; put back is a newer row that turns it on; the shape is the Hub's lists' (dated rows, append-only)", () => {
  const d = [
    decisionRow({ company: "MU", peer: "AXTI", off: true, reason: "different business", set_at: at(1) }),
    decisionRow({ company: "MU", peer: "ARM", measure: "peg", off: true, reason: "far from the pack", set_at: at(2) }),
    decisionRow({ company: "MU", peer: "AXTI", off: false, reason: "put back", set_at: at(3) }),
    decisionRow({ company: "NVDA", peer: "TSM", off: true, set_at: at(4) }),
  ];
  const sel = selectionOf(d, "MU");
  assert.equal(sel.peers.has("AXTI"), false, "put back");
  assert.equal(sel.cells.has("ARM|peg"), true);
  assert.equal(isOff(sel, "ARM", "peg"), true); assert.equal(isOff(sel, "ARM", "pe_ttm"), false);
  assert.equal(sel.list.length, 1); assert.equal(sel.list[0].reason, "far from the pack");
  assert.equal(latestDecisions(d, "MU").length, 2);
  assert.equal(selectionOf(d, "NVDA").peers.has("TSM"), true, "decisions are per company");
  for (const k of ["company", "peer", "measure", "off", "reason", "set_by", "set_at"]) assert.ok(k in d[0]);
  assert.throws(() => decisionRow({ company: "MU", peer: "X", measure: "bogus", off: true }));
  assert.deepEqual(MEASURES, ["ALL", ...ROWS]);
});

test("toggling a peer off recomputes the percentiles, the band and the upside at once; ALL PEERS never changes", () => {
  const d = [decisionRow({ company: "MU", peer: "AXTI", off: true, set_at: at(1) }), decisionRow({ company: "MU", peer: "ARM", off: true, set_at: at(2) })];
  const sel = selectionOf(d, "MU"), R = applySelection(MU, sel);
  for (const r of R) {
    const orig = MU.rows.find((x) => x.key === r.key);
    const kept = orig.peers.filter((p) => !["AXTI", "ARM"].includes(p.ticker));
    assert.deepEqual(r.dropped.sort(), orig.peers.filter((p) => ["AXTI", "ARM"].includes(p.ticker)).map((p) => p.ticker).sort());
    assert.deepEqual(r.band, peerBand(kept.map((p) => p.multiple)), r.key);
    for (const k of ["min", "q1", "median", "q3", "max"]) { const want = priceAt(r.key, r.band[k], MU); if (want == null) assert.equal(r.ends[k].price, null); else close(r.ends[k].price, want); }
    assert.deepEqual(orig.band, MU.rows.find((x) => x.key === r.key).band, "ALL PEERS untouched");
  }
  const pe = R.find((r) => r.key === "pe_ttm"), pe0 = MU.rows.find((r) => r.key === "pe_ttm");
  assert.ok(pe.band.max < pe0.band.max, "AXTI (3000x) set the old high end");
  const B0 = middleHalfBand(MU.rows), B1 = middleHalfBand(R);
  assert.ok(B0.ok && B1.ok && (B0.hi !== B1.hi || B0.lo !== B1.lo || B0.mid !== B1.mid), "the band moved");
  const back = applySelection(MU, selectionOf([...d, decisionRow({ company: "MU", peer: "AXTI", off: false, set_at: at(3) }), decisionRow({ company: "MU", peer: "ARM", off: false, set_at: at(4) })], "MU"));
  for (const r of back) { assert.deepEqual(r.dropped, []); assert.deepEqual(r.band, MU.rows.find((x) => x.key === r.key).band); }
});

test("a single cell off: only that measure of that peer leaves the count", () => {
  const sel = selectionOf([decisionRow({ company: "MU", peer: "ARM", measure: "peg", off: true, set_at: at(1) })], "MU");
  const R = applySelection(MU, sel);
  assert.equal(R.find((r) => r.key === "peg").n, MU.rows.find((r) => r.key === "peg").n - 1);
  for (const k of ROWS.filter((k) => k !== "peg")) assert.equal(R.find((r) => r.key === k).n, MU.rows.find((r) => r.key === k).n);
});

test("flags: NOT MEANINGFUL when there is no number; FAR FROM THE PACK beyond 3 typical gaps (the typical gap = median distance from the median), both numbers carried", () => {
  const f = flagRow(MU.rows.find((r) => r.key === "pe_ttm"));
  const vals = MU.rows.find((r) => r.key === "pe_ttm").peers.map((p) => p.multiple);
  close(f.median, median(vals)); close(f.typical, median(vals.map((v) => Math.abs(v - f.median)))); close(f.threshold, FAR_K * f.typical); assert.equal(f.k, 3);
  assert.equal(f.cells.INTC.flag, "nm"); assert.ok(f.cells.INTC.why);
  assert.equal(f.cells.AXTI.flag, "far"); assert.ok(f.cells.AXTI.gaps > 3); assert.equal(f.cells.AXTI.side, "high");
  assert.equal(f.cells.NVDA.flag, null);
  const hand = flagRow({ key: "x", peers: [{ ticker: "A", multiple: 10 }, { ticker: "B", multiple: 12 }, { ticker: "C", multiple: 11 }, { ticker: "D", multiple: 40 }], values: { A: { multiple: 10 }, B: { multiple: 12 }, C: { multiple: 11 }, D: { multiple: 40 }, E: { multiple: null, why: "loss" } } });
  assert.equal(hand.median, 11.5); assert.equal(hand.typical, 1); assert.equal(hand.threshold, 3);
  assert.equal(hand.cells.D.flag, "far"); assert.equal(hand.cells.B.flag, null); assert.equal(hand.cells.E.flag, "nm");
  const all = flags(MU); assert.deepEqual(Object.keys(all), ROWS);
});

test("the three ways: A = lowest to highest implied median, B = middle of the 25ths / medians / 75ths, C = the weighted blend; each with the upside", () => {
  const W = ways(MU.rows, MU.price);
  const A = wayOf(W, "A"), B = wayOf(W, "B"), C = wayOf(W, "C");
  const meds = MU.rows.filter((r) => r.ok).map((r) => r.ends.median.price);
  assert.equal(A.lo, Math.min(...meds)); assert.equal(A.hi, Math.max(...meds)); close(A.mid, median(meds));
  const B2 = middleHalfBand(MU.rows); close(B.lo, B2.lo); close(B.mid, B2.mid); close(B.hi, B2.hi);
  const C2 = weightedBlend(MU.rows); close(C.mid, C2.mid);
  for (const w of [A, B, C]) { assert.ok(w.plain.length > 20); close(w.upsidePct.mid, (w.mid / MU.price - 1) * 100); }
  const G = ways(GEV.rows, GEV.price); assert.ok(wayOf(G, "B").ok); assert.equal(wayOf(G, "B").points.length, 5, "GEV: PEG cannot price it, five rows");
});

test("the cohort table: every member with today's price, the Geiger, and the way's low / centre / high for ALL PEERS and for its own selection; sortable", () => {
  const d = [decisionRow({ company: "MU", peer: "AXTI", off: true, set_at: at(1) }), decisionRow({ company: "NVDA", peer: "TSM", measure: "pe_ttm", off: true, set_at: at(2) })];
  const T = cohortTable(SEMI.snapshots, d, "B");
  assert.equal(T.rows.length, SEMI.snapshots.length);
  const mu = T.rows.find((r) => r.ticker === "MU"), nv = T.rows.find((r) => r.ticker === "NVDA"), adi = T.rows.find((r) => r.ticker === "ADI");
  assert.ok(mu.price > 0 && mu.geiger != null && mu.all && mu.sel);
  assert.equal(mu.off, 1); assert.equal(nv.off, 1); assert.equal(adi.off, 0);
  close(adi.all.mid, adi.sel.mid, 1e-9); assert.ok(Math.abs(mu.all.mid - mu.sel.mid) > 1e-9 || Math.abs(mu.all.hi - mu.sel.hi) > 1e-9, "MU's own selection differs");
  close(mu.all.mid, (middleHalfBand(MU.rows).mid / MU.price - 1) * 100);
  const byMid = sortCohort(T.rows, "sel.mid", -1); for (let i = 1; i < byMid.length; i++) if (byMid[i].sel && byMid[i - 1].sel) assert.ok(byMid[i - 1].sel.mid >= byMid[i].sel.mid);
  const byT = sortCohort(T.rows, "ticker", 1); assert.equal(byT[0].ticker, "ADI");
  const byG = sortCohort(T.rows, "geiger", -1); assert.ok(byG[0].geiger >= byG[1].geiger);
  const TA = cohortTable(SEMI.snapshots, d, "A"); assert.equal(TA.way, "A"); assert.ok(TA.rows[0].all.hi >= TA.rows[0].all.lo);
});

test("cohortChoice keeps the round-3 rule", () => {
  assert.equal(cohortChoice("MU", ["MEGA_CAP", "SEMICONDUCTORS"]).cohort, "SEMICONDUCTORS");
  assert.equal(cohortChoice("X", ["LARGE_CAP"]).cohort, null);
});

test("the Hub: COMPS is its own tab beside ESTIMATES, ESTIMATES is exactly what it was before C1, keys 1–9 and 0, the migration and its rollback exist", () => {
  const html = readFileSync(here("../index.html"), "utf8");
  assert.match(html, /const CO_TABS = \["GEIGER","FUNDAMENTALS","ESTIMATES","COMPS","FINANCIALS","STATS","NEWS","SOCIAL","EVENTS","READ"\]/);
  assert.match(html, /case "COMPS":\s+return nonOp \? nonOpTabHTML\(data\) : compsTabHTML\(data\)/);
  assert.match(html, /estConvictionHTML\(data\) \+ estPTGaugeHTML\(data\) \+\n\s+estValuationHTML\(data\)/, "the ESTIMATES tab as before C1");
  assert.ok(!/estCompsHTML|compsLiveMount|sc-comps-live|scCompsLive/.test(html), "no trace of the C1 section");
  assert.match(html, /import\("\/deliverables\/2026(0930\/comps-tab|1001\/comps-template)\/tab\.mjs"\)/, "the COMPS tab loads the comps module (C3 moved it to the template, 1 Oct)");
  assert.match(html, /e\.key === "0" \? 10 : 0/);
  for (const f of ["../supabase/migrations/20260930_comps_decisions.sql", "../supabase/migrations/20260930_comps_decisions_ROLLBACK.sql"]) assert.ok(existsSync(here(f)), f);
  const mig = readFileSync(here("../supabase/migrations/20260930_comps_decisions.sql"), "utf8");
  assert.match(mig, /create table if not exists public\.comps_decisions/); assert.match(mig, /measure in \('ALL', 'pe_ttm', 'pe_fwd', 'ev_sales', 'ev_ebitda', 'ps', 'peg'\)/);
  assert.match(readFileSync(here("../supabase/migrations/20260930_comps_decisions_ROLLBACK.sql"), "utf8"), /drop table if exists public\.comps_decisions/);
});

test("the tab's styling is the Hub's: tokens only, no white, no imported deliverable styling", () => {
  const src = readFileSync(here("../deliverables/20260930/comps-tab/tab.mjs"), "utf8");
  const css = src.slice(src.indexOf("export const CSS = `") + 20, src.indexOf("`;", src.indexOf("export const CSS = `")));
  for (const hex of css.match(/#[0-9A-Fa-f]{6}\b/g) || []) { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)); assert.ok(Math.max(r, g, b) <= 210, hex + " is not white"); }
  assert.ok(!/#fff\b|#ffffff|:\s*white\b/i.test(css), "no white");
  for (const v of ["--panel", "--line2", "--ink", "--ink3", "--dim", "--mute", "--crk", "--bull", "--bear", "--mono"]) assert.ok(css.includes("var(" + v), v + " token used");
  assert.ok(!/comps-live\/draw\.mjs|\.cl-/.test(src), "nothing from the C1 deliverable styling");
  assert.ok(existsSync(here("../deliverables/20260930/comps-tab/COMPS-TAB.html")));
  for (const f of ["tab-1680.png", "tab-390.png", "off-1680.png", "off-390.png", "back-1680.png", "cohort-1680.png", "cohort-390.png", "board-1680.png"]) assert.ok(existsSync(here("../deliverables/20260930/comps-tab/shots/" + f)), f);
});
