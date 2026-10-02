// U2 (2 Oct 2026): the served set decided by its parents — the maths behind the page is the maths the tests check, and the
// written proposal is consistent with itself: it is PROPOSED, nothing in it is applied; the kept set, the out list and the in
// list partition correctly; IWM admits nothing by itself; the page prints the counts the JSON holds and carries the BACK /
// CLOSE pair.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { norm, aggregate, readable, strongN, iwmRule, servedSet, spread, GRID, TOL } from "../deliverables/20261002/served-set/maths.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20261002/served-set");
const S = JSON.parse(readFileSync(join(DIR, "served-set.json"), "utf8"));
const M = JSON.parse(readFileSync(join(DIR, "measure.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "SERVED-SET.html"), "utf8");
const UL = JSON.parse(readFileSync(join(DIR, "data/universe-and-lists.json"), "utf8"));

const close = (a, b, eps = 1e-9) => Math.abs(a - b) <= eps;

test("norm: Massive's dot and the Hub's dash meet on one spelling", () => {
  assert.equal(norm("BRK.B"), "BRK-B");
  assert.equal(norm("brk-b"), "BRK-B");
  assert.equal(norm(" MOG.A "), "MOG-A");
});

test("aggregate: equal-weight and weight-blended over the holdings that have a reading, coverage honest", () => {
  const r = (t) => ({ A: 1, B: 0, C: -1 })[t] ?? null;
  const a = aggregate([["A", 50], ["B", 30], ["C", 20], ["D", 10]], r);
  assert.ok(close(a.eq, 0));                       // (1 + 0 − 1) / 3
  assert.ok(close(a.w, (50 - 20) / 100));           // (50·1 + 30·0 + 20·−1) / 100
  assert.equal(a.count, 3);
  assert.equal(a.weight_pct, 100);
  assert.equal(a.total_weight_pct, 110);
  assert.deepEqual(a.not_read, ["D"]);
  assert.equal(aggregate([["D", 10]], r).eq, null);
});

test("readable: biggest first, only lines with a reading, dot-spelled holdings read", () => {
  const r = (t) => ({ "BRK-B": 0.2, X: 0.1 })[t] ?? null;
  assert.deepEqual(readable([["X", 1], ["BRK.B", 5], ["NOPE", 9]], r), [["BRK-B", 5], ["X", 1]]);
});

test("strongN: a parent whose five biggest lines carry the full aggregate needs 5; one whose tail disagrees needs more than the ladder", () => {
  // ten lines, all reading 0.5: any top-N equals the full → N = 5 on every draw
  const flat = Array.from({ length: 10 }, (_, i) => ["T" + i, 10 - i]);
  const half = () => 0.5;
  const s = strongN(flat, half, [half, half]);
  assert.equal(s.w.n, 5); assert.equal(s.eq.n, 5); assert.equal(s.count, 10);
  // 200 lines: the ten biggest read +1, the rest −1 — no top-N up to 100 reaches the full equal-weight mean within 0.05
  // (full = −0.90; top-100 = −0.80, a gap of 0.10)
  const skew = Array.from({ length: 200 }, (_, i) => ["S" + i, 200 - i]);
  const rd = (t) => (Number(t.slice(1)) < 10 ? 1 : -1);
  const k = strongN(skew, rd, [rd]);
  assert.equal(k.eq.n, "more than 100");
  assert.equal(k.ladder[k.ladder.length - 1].N, 100);
  // a parent smaller than the first rung needs "all of it"
  const tiny = strongN([["A", 2], ["B", 1]], half, [half]);
  assert.equal(tiny.w.n, 2);
});

test("strongN: a draw that disagrees pulls N up; the one-day N stays", () => {
  const h = Array.from({ length: 40 }, (_, i) => ["H" + i, 40 - i]);
  const main = () => 0.3;                                   // every top-N passes on the main reading
  const bad = (t) => (Number(t.slice(1)) < 10 ? 1 : -1);    // top-10 reads +1, the rest −1: top-N fails until N = 40 on this draw
  const s = strongN(h, main, [bad, main, main, main, main, main, main, main, main, main, main, bad]);   // 2 of 12 fail → 10/12 < 90%
  assert.equal(s.eq.one_day_n, 5);
  assert.equal(s.eq.n, 40);
});

test("spread: names_for(tol) = (sd / tol)²", () => {
  const h = [["A", 1], ["B", 1], ["C", 1], ["D", 1]];
  const r = (t) => ({ A: 1, B: -1, C: 1, D: -1 })[t];
  const sp = spread(h, r);
  assert.ok(close(sp.sd, Math.sqrt(4 / 3)));
  assert.equal(sp.names_for[0.1], Math.ceil((sp.sd / 0.1) ** 2));
});

test("iwmRule: both-homes and IWM-only partition the holdings, weights add up, the inherited aggregate is over the kept names only", () => {
  const iwm = [["A", 2], ["B", 1], ["C", 1]];
  const homes = { XLK: [["A", 10]], XLF: [["A", 5], ["Z", 1]] };
  const r = (t) => ({ A: 1, B: 0, C: -1 })[t];
  const x = iwmRule(iwm, homes, new Set(["A", "C"]), r);
  assert.deepEqual(x.both_homes.map((b) => [b.ticker, b.homes]), [["A", ["XLK", "XLF"]]]);
  assert.deepEqual(x.iwm_only.map((b) => b.ticker), ["B", "C"]);
  assert.equal(x.both_weight_pct + x.iwm_only_weight_pct, 4);
  assert.ok(close(x.full.w, (2 - 1) / 4));
  assert.ok(close(x.inherited.w, (2 - 1) / 3));
  assert.equal(x.inherited.count, 2);
});

test("servedSet: top-N per parent, IWM and spread-out parents admit nothing, the cap sends a parent off-Hub, lists and cohorts are kept, out/in partition the universe", () => {
  const r = () => 0.1;
  const parents = [
    { ticker: "XLK", holdings: [["A", 5], ["B", 4], ["C", 3]], n: 2, admits: true },
    { ticker: "IWM", holdings: [["C", 1], ["D", 1]], n: 2, admits: false },
    { ticker: "SPY", holdings: [["E", 9]], n: "more than 100", admits: true },
    { ticker: "KBE", holdings: [["F", 1], ["G", 1]], n: 40, admits: true },
  ];
  const funds = new Set(["XLK", "IWM", "SPY", "KBE"]);
  const universe = new Set(["XLK", "IWM", "SPY", "KBE", "A", "C", "D", "F", "Q"]);
  const s = servedSet({ parents, lists: { RADAR: ["Q"] }, cohorts: new Set(["H"]), funds, universe, readingOf: r, cap: 30 });
  assert.deepEqual(s.keep, ["A", "B", "H", "Q"]);
  assert.deepEqual(s.out, ["C", "D", "F"]);
  assert.deepEqual(s.in, ["B", "H"]);
  assert.deepEqual(s.spread_out, ["SPY", "KBE"]);
  assert.equal(s.proposed_count, 4 + 4);
  assert.deepEqual(s.why.A.parents, [{ parent: "XLK", rank: 1, weight_pct: 5 }]);
  assert.deepEqual(s.why.Q.lists, ["RADAR"]);
  assert.equal(s.why.H.cohort, true);
  const noCap = servedSet({ parents, lists: {}, cohorts: new Set(), funds, universe, readingOf: r });
  assert.deepEqual(noCap.spread_out, ["SPY"]);
  assert.ok(noCap.keep.includes("F") && noCap.keep.includes("G"));
});

test("the written proposal is a proposal, and its counts are consistent", () => {
  assert.match(S.status, /^PROPOSED/);
  assert.equal(S.artifact_kind, "SCINTILLA_SERVED_SET_PROPOSAL");
  assert.equal(S.tolerance, TOL);
  assert.deepEqual(S.grid, GRID);
  assert.equal(S.counts.served_now, 590);
  assert.equal(S.counts.proposed, S.counts.names_proposed + S.counts.funds_proposed);
  assert.equal(S.counts.out, S.out.length);
  assert.equal(S.counts.in, S.in.length);
  assert.equal(S.rule.length, 8);
  const universe = new Set(UL.universe.map(norm)), keep = new Set(S.keep);
  for (const r of S.out) { assert.ok(universe.has(r.ticker), r.ticker + " is served today"); assert.ok(!keep.has(r.ticker)); assert.equal(r.lists.length, 0); assert.equal(r.cohort.length, 0); }
  for (const r of S.in) { assert.ok(!universe.has(r.ticker)); assert.ok(keep.has(r.ticker)); assert.ok(r.needed_by.length || r.lists.length || r.cohort.length, r.ticker + " has a reason"); }
  const treeFunds = new Set(M.parents.map((p) => p.ticker));   // a list entry that is a fund (AGIX, XBI, …) stays served by rule 5, not as a name
  for (const t of [...UL.liked, ...UL.favorites, ...UL.radar].map(norm)) assert.ok(keep.has(t) || treeFunds.has(t), t + " (a list name) is kept");
  assert.ok(S.spread_out_parents.includes("SPY") && !S.spread_out_parents.includes("IWM"), "IWM is excluded by rule 4 before the ladder; SPY is beyond the ladder");
  // IWM admits nothing by itself: no kept name is needed by IWM only
  for (const [t, w] of Object.entries(S.why)) assert.ok(!(w.parents.length && w.parents.every((p) => p.parent === "IWM")), t + " is kept by IWM alone");
  // the recommended setting is the same rule at ±0.10 / cap 30 and its lists partition the same way
  assert.equal(S.recommended.tolerance, 0.1); assert.equal(S.recommended.cap, 30);
  assert.equal(S.recommended.counts.proposed, S.recommended.keep.length + S.counts.funds_proposed);
  assert.equal(S.sensitivity["0.1"].cap_30.w.proposed, S.recommended.counts.proposed);
  for (const r of S.recommended.out) assert.ok(universe.has(r.ticker) && !S.recommended.keep.includes(r.ticker));
});

test("the measurements agree with the maths module on a real parent (XLK) and the page prints what the JSON holds", () => {
  const SEVEN = JSON.parse(readFileSync(join(DIR, "data/seven-20261001.json"), "utf8"));
  const HOLD = JSON.parse(readFileSync(join(DIR, "data/holdings-20260926.json"), "utf8"));
  const seven = new Map(SEVEN.rows.map((r) => [norm(r[0]), r[1]]));
  const main = (t) => seven.get(t) ?? null;
  const xlk = M.parents.find((p) => p.ticker === "XLK");
  const full = aggregate(HOLD.funds.XLK.h, main);
  assert.ok(close(Math.round(full.w * 1000) / 1000, xlk.full.w));
  assert.equal(readable(HOLD.funds.XLK.h, main).length, xlk.readable);
  assert.equal(M.parents.filter((p) => p.holdings_on_file).length, 51);
  assert.equal(M.parents.length, 138);
  assert.equal(M.headings.length, 11);
  assert.ok(M.iwm.both_homes.length + M.iwm.iwm_only.length >= M.iwm.full.count);
  assert.ok(PAGE.includes(`<b>${S.counts.served_now}</b>`) && PAGE.includes(`<b>${S.recommended.counts.proposed}</b>`) && PAGE.includes(`<b>${S.counts.proposed}</b>`));
  assert.ok(PAGE.includes("PROPOSED"));
  assert.ok(PAGE.includes('class="scnav"') || PAGE.includes("scnav-css"), "the BACK / CLOSE pair is placed");
  assert.ok(!/#fff\b|#ffffff\b|:\s*white\b|"white"/i.test(PAGE), "no white colour value");
});
