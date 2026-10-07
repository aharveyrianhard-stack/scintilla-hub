/* Comps C6b (5 Oct · deliverables/20261005/comps-c6b): outliers count only on PRICE columns. Only the valuation
   multiples vote (trailing and forward P/E as one vote); 3+ votes, or half the votes the peer has and at least two;
   growth, margin, capex and leverage marks are information; a peer set that is mostly a different business is named
   and its same-business peers are not cut. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { columnDistances, scorePeers, businessOf, conclusion6, isVote, VOTES, COLUMNS, C6_RULE, SHARE, SHARE_MIN_FLAGS, MIN_FLAGS } from "../deliverables/20261005/comps-c6/outliers.mjs";
import { ROWS } from "../deliverables/20261003/comps-c5/field.mjs";
import { SIM_MIN } from "../deliverables/20261003/comps-c5/lines.mjs";

const here = (p) => new URL(p, import.meta.url);
const SET = (t) => JSON.parse(readFileSync(here(`../deliverables/20261005/comps-c6/set-${t}-2026-10-05.json`), "utf8"));
const LOG = new Set(ROWS), SHORTS = Object.fromEntries(COLUMNS.map((c) => [c.key, c.short]));
/* a pack of nine peers a…i around `mid` (±3% steps) and X at x; x = null: X has no figure in the column */
const col = (key, mid, x) => { const cells = "abcdefghi".split("").map((t, i) => ({ ticker: t, v: mid * (1 + (i - 4) * 0.03) })); cells.push({ ticker: "X", v: x }); return { key, short: SHORTS[key] || key, ...columnDistances(cells, { log: LOG.has(key) }) }; };
/* a whole table for X: normal everywhere unless overridden */
const NORMAL = { pe_ttm: 30, pe_fwd: 25, ev_ebitda: 20, ev_sales: 8, ps: 8, peg: 1.5, rev_g_ttm: 12, rev_g_fy: 11, rev_per_capex: 6, gm: 50, om: 20, capex_rev: 5, nd_ebitda: 1 };
const table = (over = {}) => Object.fromEntries(Object.keys(NORMAL).map((k) => [k, col(k, NORMAL[k], k in over ? over[k] : NORMAL[k])]));
const score = (over, opts) => scorePeers(table(over), ["X", "a"], opts).X;

test("what votes: the multiples only, trailing and forward P/E as ONE vote; half the votes and at least two", () => {
  assert.deepEqual(VOTES.map((v) => v.key), ["pe", "ev_ebitda", "ev_sales", "ps", "peg"]); assert.deepEqual(VOTES[0].cols, ["pe_ttm", "pe_fwd"]);
  assert.deepEqual(VOTES.flatMap((v) => v.cols).sort(), [...ROWS].sort(), "every multiple C5 shows is in exactly one vote, and nothing else is");
  assert.equal(SHARE, 0.5); assert.equal(SHARE_MIN_FLAGS, 2); assert.equal(MIN_FLAGS, 3);
  for (const c of COLUMNS) assert.equal(isVote(c.key), ROWS.includes(c.key), c.key);
});

test("a fast grower with normal multiples is NOT an outlier: three growth/capex marks are information, zero votes", () => {
  const s = score({ rev_g_ttm: 260, rev_g_fy: 180, rev_per_capex: 60, capex_rev: 40 });
  assert.equal(s.n, 0); assert.equal(s.outlier, false); assert.equal(s.words, ""); assert.equal(s.have, 5);
  assert.deepEqual(s.info.map((f) => f.key).sort(), ["capex_rev", "rev_g_fy", "rev_g_ttm", "rev_per_capex"]); assert.equal(s.marks, 4, "the cells are still marked");
  /* the same peer under C6 as first built (every column a vote) WAS an outlier — the thing C6b fixes */
  const t = table({ rev_g_ttm: 260, rev_g_fy: 180, rev_per_capex: 60, capex_rev: 40 }), old = scorePeers(t, ["X"], { ...C6_RULE, votes: Object.keys(t).map((k) => ({ key: k, short: k, cols: [k] })) }).X;
  assert.equal(old.outlier, true); assert.equal(old.n, 4);
});

test("a 300× P/E peer IS an outlier when its price is strange across the multiples (300× earnings, 70× sales)", () => {
  const s = score({ pe_ttm: 300, pe_fwd: 180, ev_sales: 70, ps: 70 });
  assert.equal(s.outlier, true); assert.equal(s.n, 3); assert.equal(s.words, "priced far from the group on 3 of 5 multiples");
  assert.deepEqual(s.flags.map((f) => f.vote).sort(), ["ev_sales", "pe", "ps"]);
  const pe = s.flags.find((f) => f.vote === "pe"); assert.deepEqual(pe.cols.sort(), ["pe_fwd", "pe_ttm"]); assert.equal(pe.key, "pe_ttm", "the vote names its farthest column");
  /* a loss-making grower priced at 70× sales with no P/E and no PEG: 2 of the 3 votes it has */
  const loss = score({ pe_ttm: null, pe_fwd: null, peg: null, ev_sales: 70, ps: 70 }); assert.equal(loss.have, 3); assert.equal(loss.n, 2); assert.equal(loss.outlier, true);
});

test("correlated columns count once: trailing AND forward P/E both wild is one vote, not two — alone it is a marked cell", () => {
  const s = score({ pe_ttm: 300, pe_fwd: 250 });
  assert.equal(s.n, 1); assert.equal(s.have, 5); assert.equal(s.outlier, false); assert.equal(s.marks, 2);
  const one = score({ pe_ttm: 300, pe_fwd: 250, ev_ebitda: 200 }); assert.equal(one.n, 2); assert.equal(one.outlier, false, "2 of 5 is under half");
  const half = score({ pe_ttm: 300, pe_fwd: 250, ev_ebitda: 200, peg: null }); assert.equal(half.have, 4); assert.equal(half.outlier, true, "2 of the 4 it has");
  const fwdOnly = score({ pe_ttm: null, pe_fwd: 250 }); assert.equal(fwdOnly.have, 5, "one P/E column is enough to HAVE the vote"); assert.equal(fwdOnly.n, 1);
  const lone = score({ pe_ttm: 300, pe_fwd: null, ev_ebitda: null, ev_sales: null, ps: null, peg: null }); assert.equal(lone.have, 1); assert.equal(lone.outlier, false, "one flag never decides");
});

test("growth marks never tip a price verdict: 2 price votes of 5 plus four growth marks is still not an outlier", () => {
  const s = score({ ev_sales: 70, ps: 70, rev_g_ttm: 260, rev_g_fy: 180, rev_per_capex: 60, capex_rev: 40 });
  assert.equal(s.n, 2); assert.equal(s.info.length, 4); assert.equal(s.outlier, false);
});

test("the four names: only ARM (NVDA's set) is an outlier — on price; the fast growers C6 removed are all back in", () => {
  const want = { MU: [[], 4456.36, 4456.36], NVDA: [["ARM"], 394.41, 385.56], CRWV: [[], 140.27, 140.27], CBRS: [[], 46.2, 46.2] };
  const rep = JSON.parse(readFileSync(here("../deliverables/20261005/comps-c6b/four-names-c5b-c6-c6b.json"), "utf8"));
  for (const [t, [out, w, wo]] of Object.entries(want)) {
    const F = SET(t), C = conclusion6(F.snapshot, [], F.estimates, F.today, "C", { set: F.set }), old = conclusion6(F.snapshot, [], F.estimates, F.today, "C", { rule: C6_RULE });
    assert.deepEqual(C.c6.outliers, out, t); assert.ok(Math.abs(C.c6.centre.with - w) < 0.01 && Math.abs(C.c6.centre.without - wo) < 0.01, `${t} ${C.c6.centre.with} → ${C.c6.centre.without}`);
    assert.deepEqual(rep.names[t].c6b.outliers.map((o) => o.peer), out); assert.equal(rep.names[t].c6b.without.centre, wo); assert.deepEqual(rep.names[t].c6.outliers.map((o) => o.peer), old.c6.outliers);
    for (const o of old.c6.outliers.filter((x) => !out.includes(x))) { assert.ok(C.peersOn.includes(o), `${o} is back in ${t}'s medians`); assert.equal(C.c6.score[o].n, 0, `${o}: no price vote`); assert.ok(C.c6.score[o].info.length >= 2, `${o}: its growth/capex marks are still shown`); }
  }
  const N = SET("NVDA"), A = conclusion6(N.snapshot, [], N.estimates, N.today, "C", { set: N.set }).c6.score.ARM;
  assert.equal(A.words, "priced far from the group on 3 of 5 multiples"); assert.deepEqual(A.flags.map((f) => f.vote).sort(), ["ev_sales", "pe", "ps"]); assert.deepEqual(A.info.map((f) => f.key), ["gm"], "the gross-margin mark no longer votes");
});

test("a mostly-different-business set is named, and the rule does not cut the peers that share the business", () => {
  const set = { own_lines: { lines: { memory: 1 } }, kept: [{ ticker: "X", exact: 1 }, { ticker: "a", exact: 0.34 }, ...["b", "c", "d", "e", "f", "g", "h", "i"].map((t) => ({ ticker: t, exact: 0 }))] };
  const b = businessOf(set, ["X", ..."abcdefghi".split("")]); assert.deepEqual(b.same, ["X", "a"]); assert.equal(b.n, 10); assert.equal(b.line, "memory"); assert.equal(b.mostlyDifferent, true);
  assert.equal(businessOf({ kept: [{ ticker: "a", exact: 1 }, { ticker: "b", exact: 0 }] }, ["a", "b"]).mostlyDifferent, false, "exactly half is not fewer than half");
  assert.equal(businessOf({ kept: [{ ticker: "a", exact: SIM_MIN - 0.01 }, { ticker: "b", exact: 0 }, { ticker: "c", exact: 0 }] }, ["a", "b", "c"]).same.length, 0, "under C5's membership bar is not sharing");
  assert.equal(businessOf(null, ["a"]), null);
  /* the real sets: MU 2 of 12 memory, NVDA 3 of 12 data-center chips → named; CRWV 7 of 12, CBRS 12 of 12 → not */
  const B = Object.fromEntries(["MU", "NVDA", "CRWV", "CBRS"].map((t) => { const F = SET(t); return [t, conclusion6(F.snapshot, [], F.estimates, F.today, "C", { set: F.set }).c6]; }));
  assert.deepEqual([B.MU.business.same.length, B.MU.business.mostlyDifferent, B.MU.business.line], [2, true, "memory"]); assert.deepEqual([B.NVDA.business.same.length, B.NVDA.business.mostlyDifferent], [3, true]);
  assert.deepEqual([B.CRWV.business.same.length, B.CRWV.business.mostlyDifferent, B.CRWV.business.line], [7, false, "ai cloud & hosting"]); assert.deepEqual([B.CBRS.business.same.length, B.CBRS.business.mostlyDifferent], [12, false]);
  assert.deepEqual(B.NVDA.outliers, ["ARM"], "ARM does not share NVDA's line, so the rule still cuts it"); assert.deepEqual(B.NVDA.notCut, []);
  /* MU's set with SNDK (memory, shares the business) made wildly dear: flagged, NOT cut; the same prices on ARM (not memory): cut */
  const F = SET("MU"), wild = (who) => { const s = JSON.parse(JSON.stringify(F.snapshot)); for (const r of s.rows) if (r.values && r.values[who] && r.values[who].multiple > 0) r.values[who].multiple *= 40; return s; };
  const S = conclusion6(wild("SNDK"), [], null, F.today, "C", { set: F.set }); assert.ok(S.c6.score.SNDK.outlier); assert.deepEqual(S.c6.notCut, ["SNDK"]); assert.ok(!S.c6.outliers.includes("SNDK") && S.peersOn.includes("SNDK"));
  const A = conclusion6(wild("ARM"), [], null, F.today, "C", { set: F.set }); assert.ok(A.c6.outliers.includes("ARM") && !A.peersOn.includes("ARM"));
  const noSet = conclusion6(wild("SNDK"), [], null, F.today); assert.ok(noSet.c6.outliers.includes("SNDK"), "without the set's lines nothing is protected");
});

test("the tab: info marks fainter and labelled, the business line under the set's header, the sentences in PAGE SPECS only; the report page carries the pictures", () => {
  const src = readFileSync(here("../deliverables/20261003/comps-c5/tab.mjs"), "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const a = code.indexOf("function pageSpecsHTML"), b = code.indexOf("function wire"), specs = code.slice(a, b), content = code.slice(0, a) + code.slice(b);
  assert.match(content, /class="fl\$\{isVote\(c\.key\) \? "" : " inf"\}"/); assert.match(content, /information only/); assert.match(content, /id="cm5Biz"/); assert.match(content, /peer set mostly different business/); assert.match(content, /fix the peers, not the outliers/);
  assert.match(specs, /Only the valuation multiples vote/); assert.match(specs, /trailing and forward P\/E as one vote/); assert.match(specs, /never count/); assert.match(specs, /Same business\?/);
  assert.match(readFileSync(here("../index.html"), "utf8"), /import\("\/deliverables\/20261003\/comps-c5\/tab\.mjs"\)/, "index.html is untouched");
  const page = readFileSync(here("../deliverables/20261005/comps-c6b/COMPS-C6B.html"), "utf8"); assert.match(page, /sc-pagespecs/); for (const t of ["MU", "NVDA", "CRWV", "CBRS"]) assert.ok(page.includes(`shots/${t}-set-1680.png`), t + " picture");
});
