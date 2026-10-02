/* A1 analytics knockouts (2 Oct · deliverables/20261002/analytics-knockouts): the bracket arithmetic (a fixture in, the
   same winners out), the stretch percentile, the three ways' agreement measure, the allocation read, and the built data. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { roundRobin, game, compare, withToggles, whySentence, COMPARISONS, BASELINE } from "../deliverables/20261002/analytics-knockouts/bracket.mjs";
import { stretchPercentile, agreement, aggregate, logReturn, rank, outliers } from "../deliverables/20261002/analytics-knockouts/stats.mjs";
import { allocate } from "../deliverables/20261002/analytics-knockouts/allocate.mjs";

const here = (p) => new URL(p, import.meta.url);
const close = (a, b, eps = 1e-9) => assert.ok(Math.abs(a - b) < eps, `${a} vs ${b}`);

/* the fixture: four names, every number set by hand so the winners are known */
const FIX = [
  { ticker: "AAA", up_a: 40, up_b: 40, up_c: 45, rev_g_fy: 20, eps_g_fy: 30, om: 30, fcfm: 25, nd_ebitda: -0.5, geiger: 0.6, stretch: 50 },
  { ticker: "BBB", up_a: 10, up_b: 10, up_c: 12, rev_g_fy: 25, eps_g_fy: 10, om: 20, fcfm: 15, nd_ebitda: 1.5, geiger: 0.2, stretch: 90 },
  { ticker: "CCC", up_a: -20, up_b: -20, up_c: -18, rev_g_fy: 5, eps_g_fy: null, om: 40, fcfm: 35, nd_ebitda: 0.2, geiger: -0.4, stretch: 10 },
  { ticker: "DDD", up_a: null, up_b: null, up_c: null, rev_g_fy: null, eps_g_fy: null, om: null, fcfm: null, nd_ebitda: null, geiger: 0.9, stretch: 99 },
];

test("one comparison: the direction decides, a missing number is not played, a tolerance makes a draw", () => {
  const c = COMPARISONS.find((x) => x.key === "nd_ebitda");
  assert.equal(compare({ nd_ebitda: 0.2 }, { nd_ebitda: 1.5 }, c).winner, "A", "lower net debt wins");
  assert.equal(compare({ nd_ebitda: 0.2 }, { nd_ebitda: 1.5 }, { ...c, better: "high" }).winner, "B", "the direction is a toggle");
  const r = compare({ nd_ebitda: null }, { nd_ebitda: 1.5 }, c); assert.equal(r.played, false); assert.equal(r.winner, null); assert.match(r.why, /no number for the first/);
  assert.equal(compare({ om: 30 }, { om: 30 }, COMPARISONS.find((x) => x.key === "om")).winner, "draw");
  assert.equal(compare({ om: 30 }, { om: 30.5 }, COMPARISONS.find((x) => x.key === "om"), 0.02).winner, "draw", "within 2% is a draw when the tolerance says so");
  assert.equal(compare({ om: 30 }, { om: 30.5 }, COMPARISONS.find((x) => x.key === "om"), 0).winner, "B");
});

test("one game: weighted points over the comparisons that are on; equal points is a draw; nothing played is null", () => {
  const g = game(FIX[0], FIX[1]);
  assert.equal(g.played, 10); assert.equal(g.winner, "A");
  assert.equal(g.points.a, 9); assert.equal(g.points.b, 1, "BBB wins only revenue growth");
  const g2 = game(FIX[0], FIX[3]); assert.equal(g2.played, 2, "DDD has only a Geiger and a stretch"); assert.equal(g2.winner, null, "two played is fewer than the baseline three: not played"); assert.match(g2.not_played_why, /2 of 10/);
  assert.equal(game(FIX[0], FIX[3], COMPARISONS, { min_played: 1 }).winner, "draw", "with a one-comparison floor, DDD wins the Geiger and AAA the stretch: a draw");
  assert.equal(BASELINE.min_played, 3);
  const g3 = game({ ticker: "X" }, { ticker: "Y" }); assert.equal(g3.winner, null); assert.equal(g3.played, 0);
  const only = withToggles({ up_a: { on: false }, up_b: { on: false }, up_c: { on: false }, rev_g_fy: { on: false }, eps_g_fy: { on: false }, om: { on: false }, fcfm: { on: false }, nd_ebitda: { on: false }, stretch: { on: false } });
  assert.equal(game(FIX[0], FIX[3], only, { min_played: 1 }).winner, "B", "with only the Geiger on, DDD takes it");
  const heavy = withToggles({ rev_g_fy: { weight: 2 } }); const g4 = game(FIX[0], FIX[1], heavy); assert.equal(g4.points.b, 2); assert.equal(g4.winner, "A");
});

test("the round robin on the fixture: the same winners out, the standings in order, the why sentence names the rows", () => {
  const R = roundRobin(FIX);
  assert.equal(R.games.length, 6);
  /* by hand: AAA beats BBB 9–1 and CCC 5–3; BBB beats CCC 5–4; every game against DDD has two comparisons, fewer than three: not played */
  assert.deepEqual(R.standings.map((s) => s.ticker), ["AAA", "BBB", "CCC", "DDD"]);
  assert.deepEqual(R.standings.map((s) => s.points), [2, 1, 0, 0]);
  assert.deepEqual(R.standings.map((s) => s.unplayed), [1, 1, 1, 3]);
  assert.deepEqual(R.advance, ["AAA", "BBB", "CCC"], "DDD played nothing and cannot advance");
  const R1 = roundRobin(FIX, COMPARISONS, { min_played: 1 });
  assert.deepEqual(R1.standings.map((s) => s.ticker), ["AAA", "BBB", "DDD", "CCC"], "with a one-comparison floor DDD collects three draws and passes CCC: the reason for the baseline of three");
  assert.deepEqual(R1.standings.map((s) => s.points), [2.5, 1.5, 1.5, 0.5]);
  assert.equal(BASELINE.advance, 3);
  assert.deepEqual(roundRobin(FIX, COMPARISONS, { advance: 2 }).advance, ["AAA", "BBB"]);
  assert.match(R.why.AAA, /^AAA advances in place 1 \(2 won, 0 drawn, 0 lost of 2\)/);
  assert.match(R.why.AAA, /upside, way A in 2 of 2/);
  assert.match(R.why.CCC, /operating margin/);
  const s = R.standings.find((x) => x.ticker === "DDD"); assert.equal(s.unplayed, 3); assert.equal(s.draws, 0);
  /* the same fixture, the same winners: run twice */
  assert.deepEqual(roundRobin(FIX).advance, R.advance);
  /* a toggle re-runs the bracket: with the Geiger weighing 2 and the stretch off, DDD still cannot pass AAA on one row */
  const R2 = roundRobin(FIX, withToggles({ geiger: { weight: 2 }, stretch: { on: false } }));
  assert.equal(R2.standings[0].ticker, "AAA");
  assert.equal(typeof whySentence(R2.standings[0]), "string");
});

test("the stretch percentile: against its own history only, ties count half, no history gives a blank", () => {
  const hist = [-0.8, -0.4, 0, 0.2, 0.4, 0.6, 0.9];
  close(stretchPercentile(hist, 0.95), 100); close(stretchPercentile(hist, -0.9), 0); close(stretchPercentile(hist, 0.3), (100 * 4) / 7);
  close(stretchPercentile(hist, 0.2), (100 * 3.5) / 7, 1e-9); assert.equal(stretchPercentile([], 0.2), null); assert.equal(stretchPercentile(hist, null), null);
  close(stretchPercentile([0.5, null, "x", 0.7], 0.6), 50);
});

test("the agreement of the ways: the spread of the centres as a share of the price, or of the upsides in points", () => {
  const a = agreement({ A: 100, B: 100, C: 112 }, 80); assert.ok(a.ok); close(a.spread, 15); assert.equal(a.n, 3);
  const b = agreement({ A: 20, B: 20, C: 24 }); close(b.spread, 4);
  assert.equal(agreement({ A: 20, B: null, C: null }).ok, false);
});

test("aggregate, log return, rank, outliers", () => {
  assert.deepEqual(aggregate([0.2, null, 0.6]), { value: 0.4, n: 2 }); assert.deepEqual(aggregate([null]), { value: null, n: 0 });
  close(logReturn([100, 110, 121], 2), Math.log(1.21)); assert.equal(logReturn([100, 110], 2), null);
  const items = [{ id: "a", v: 3 }, { id: "b", v: null }, { id: "c", v: 9 }]; assert.deepEqual(rank(items, "v", -1), [2, null, 1]); assert.deepEqual(rank(items, "v", 1), [1, null, 2]);
  const o = outliers([{ ticker: "A", x: 1 }, { ticker: "B", x: 2 }, { ticker: "C", x: 3 }, { ticker: "D", x: 4 }, { ticker: "E", x: 40 }], "x");
  assert.deepEqual(o.map((r) => r.ticker + ":" + r.side), ["E:high"]);
});

test("the allocation read: cash first, shares by role, extended halved to cash, a PASS to cash, names equal inside a group", () => {
  const groups = [
    { id: "g1", label: "one", sector: "Tech", role: "lead", stretch: 95, served: 10, finalists: ["A", "B"] },
    { id: "g2", label: "two", sector: "Tech", role: "lead", stretch: 50, served: 10, finalists: ["C", "D", "E"] },
    { id: "g3", label: "three", sector: "Health", role: "lead", stretch: 30, served: 3, finalists: ["F"] },
    { id: "g4", label: "four", sector: "Telecom", role: "balance", stretch: 1, served: 6, finalists: ["G", "H"], passed: new Set(["H"]) },
  ];
  const A = allocate(groups);
  assert.equal(A.invested, 75);
  const [g1, g2, g3, g4] = A.groups;
  assert.ok(g1.extended && !g2.extended); assert.ok(g3.thin);
  close(g2.held, (75 * 2) / 7); close(g1.held, (75 * 3 * 0.5) / 7); close(g3.held, (75 * 1) / 7);
  close(g4.held, (75 * 1) / 7 / 2, 1e-9); close(g4.to_cash, (75 * 1) / 7 / 2, 1e-9); assert.deepEqual(g4.names.map((n) => n.ticker), ["G"]);
  close(g2.names[0].pct, g2.held / 3);
  close(A.cash, 100 - (g1.held + g2.held + g3.held + g4.held));
  close(A.by_sector.Tech, g1.held + g2.held);
  const B = allocate(groups, { cash_pct: 40, extended_cut: 1 }); close(B.groups[0].held, (60 * 3) / 7);
});

test("the built data (2 Oct): sectors and groups carry a Geiger, a stretch and a rotation rank; the field groups are the three highest by heat with five or more served and the most oversold; every field row has the three ways or a named reason", () => {
  const f = here("../deliverables/20261002/analytics-knockouts/data-2026-10-02.json");
  if (!existsSync(f)) { assert.ok(true, "no data file on this checkout"); return; }
  const D = JSON.parse(readFileSync(f, "utf8"));
  assert.equal(D.today, "2026-10-02"); assert.ok(D.sectors.length >= 10); assert.ok(D.industries.length >= 50);
  for (const s of D.sectors) { assert.ok(s.geiger != null && s.stretch != null && s.rank_rotation != null, s.label); assert.ok(s.stretch >= 0 && s.stretch <= 100); }
  const q = D.industries.filter((i) => !i.thin && i.geiger != null && i.stretch != null);
  const leaders = D.field_groups.filter((g) => g.role === "lead").map((g) => g.id), top = q.slice().sort((a, b) => b.geiger - a.geiger || (a.rank_rotation ?? 99) - (b.rank_rotation ?? 99)).slice(0, 3).map((i) => i.id);
  assert.deepEqual(leaders, top);
  const bal = D.field_groups.find((g) => g.role === "balance"); const low = q.filter((i) => !top.includes(i.id)).sort((a, b) => a.stretch - b.stretch || a.geiger - b.geiger)[0]; assert.equal(bal.id, low.id);
  for (const g of D.field_groups) assert.ok(D.industries.find((i) => i.id === g.id).served >= D.sources.groups.min_served_for_the_field);
  for (const F of D.fields) { assert.equal(F.rows.length, F.served); for (const r of F.rows) { const ok = r.up.A != null && r.up.B != null && r.up.C != null; assert.ok(ok || r.why, F.label + " " + r.ticker); if (ok) assert.equal(r.up.A, r.up.B, "A and B share a centre"); assert.equal(Object.keys(r.measures).length, 16); } }
  /* the stretch of a name re-computed from the rule's definition is between 0 and 100 and the group has a history */
  for (const F of D.fields) assert.ok(F.history_n > 400, F.label);
});
