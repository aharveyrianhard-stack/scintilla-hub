/* Comps C6 (5 Oct · deliverables/20261005/comps-c6): outliers across the columns. The per-column distance (median and
   MAD, multiples on a log scale, the 3.5 cut), Alan's cross-column score (3+ columns or 40% of the columns with data),
   a single extreme column against many moderate ones, the four names he has seen, the keep click, the tab's words.
   C6b (the same night) changed WHAT VOTES (the multiples only, 50%): the tests of C6's first rule now pass C6_RULE, the
   rule as first built, which outliers.mjs keeps reproducible; the price-only rule is tested in comps-c6b.test.mjs. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { columnDistances, columnsOf, scorePeers, keptPeers, conclusion6, isFlagged, COLUMNS, C6_RULE, CUT, MIN_N, MIN_FLAGS, SHARE, SHARE_MIN_FLAGS } from "../deliverables/20261005/comps-c6/outliers.mjs";
import { conclusion, ROWS } from "../deliverables/20261003/comps-c5/field.mjs";

const here = (p) => new URL(p, import.meta.url);
const SET = (t) => JSON.parse(readFileSync(here(`../deliverables/20261005/comps-c6/set-${t}-2026-10-05.json`), "utf8"));
const cells = (o) => Object.entries(o).map(([ticker, v]) => ({ ticker, v }));
/* a pack of eight peers a…h around `mid`, with X replacing h's value */
const pack = (mid, x, step = 0.03) => cells({ a: mid * (1 - 3 * step), b: mid * (1 - 2 * step), c: mid * (1 - step), d: mid, e: mid * (1 + step), f: mid * (1 + 2 * step), g: mid * (1 + 3 * step), X: x });
/* every column its own vote at 40% — C6 as first built, on made-up columns */
const every = (cols) => ({ ...C6_RULE, votes: Object.keys(cols).map((k) => ({ key: k, short: k, cols: [k] })) });
const colsFrom = (spec) => Object.fromEntries(Object.entries(spec).map(([k, v]) => [k, { key: k, short: k, ...columnDistances(v.cells, { log: !!v.log }) }]));

test("the constants are the brief's: 3.5 spreads a cell, 3 columns or 40% a peer, 5 peers a pack", () => {
  assert.equal(CUT, 3.5); assert.equal(MIN_FLAGS, 3); assert.equal(C6_RULE.share, 0.4); assert.equal(C6_RULE.votes.length, 16); assert.equal(SHARE, 0.5, "C6b: half the votes"); assert.equal(SHARE_MIN_FLAGS, 2); assert.equal(MIN_N, 5);
  assert.equal(COLUMNS.length, 16); assert.deepEqual(COLUMNS.filter((c) => c.log).map((c) => c.key), ROWS, "the six multiples on a log scale, the ten fundamentals as they are");
});

test("one column: distance from the median in units of the spread (MAD × 1.4826); beyond 3.5 the cell is flagged", () => {
  const c = columnDistances(cells({ a: 10, b: 11, c: 12, d: 13, e: 14, X: 40 }));
  assert.equal(c.median, 12.5); assert.ok(Math.abs(c.spread - 1.5 * 1.4826) < 1e-9); assert.ok(c.judged && c.basis === "MAD");
  assert.ok(Math.abs(c.cells.X.d - (40 - 12.5) / (1.5 * 1.4826)) < 1e-9); assert.ok(c.cells.X.flag && c.cells.X.side === "high"); assert.ok(!c.cells.a.flag && c.cells.a.side === "low");
  const edge = columnDistances(cells({ a: -1, b: 0, c: 1, d: 0, e: -1, f: 1, g: 0, X: 1.4826 * 3.4 })); assert.ok(!edge.cells.X.flag, "3.4 spreads is inside"); assert.ok(columnDistances(cells({ a: -1, b: 0, c: 1, d: 0, e: -1, f: 1, g: 0, X: 1.4826 * 3.6 })).cells.X.flag, "3.6 is out");
  const neg = columnDistances(cells({ a: -5, b: 2, c: 4, d: 6, e: 8, X: -400 })); assert.ok(neg.cells.X.flag && neg.cells.X.side === "low", "a fundamental can be negative");
});

test("multiples sit on a log scale: 300× against a pack near 30× is flagged, and far less wildly than on a plain scale", () => {
  const p = pack(30, 300, 0.1), log = columnDistances(p, { log: true }), lin = columnDistances(p);
  assert.ok(log.cells.X.flag); assert.ok(log.cells.X.d < lin.cells.X.d / 2, `log ${log.cells.X.d} vs plain ${lin.cells.X.d}`);
  assert.ok(Math.abs(log.median - Math.sqrt(30 * 33)) < 1e-9, "the centre is the median of the logs, read back as a multiple");
  const lo = columnDistances(pack(30, 3, 0.1), { log: true }); assert.ok(lo.cells.X.flag && Math.abs(Math.abs(lo.cells.X.d) - Math.abs(columnDistances(pack(30, 330, 0.1), { log: true }).cells.X.d)) < 1.5, "a tenth and ten times sit about as far");
  const nm = columnDistances(cells({ a: 20, b: 22, c: 25, d: 27, e: 30, X: -8, Y: null }), { log: true }); assert.equal(nm.n, 5); assert.equal(nm.cells.X, undefined, "a negative multiple is no data, not a distance");
});

test("a column with fewer than five peers judges no one; a column where half the peers share one value falls back to the mean absolute deviation", () => {
  const few = columnDistances(cells({ a: 1, b: 2, c: 3, X: 900 })); assert.equal(few.judged, false); assert.equal(few.cells.X.flag, false); assert.equal(few.cells.X.d, null);
  const tied = columnDistances(cells({ a: 5, b: 5, c: 5, d: 5, e: 5, f: 6, X: 500 })); assert.equal(tied.basis, "mean absolute deviation"); assert.ok(tied.judged && tied.cells.X.flag && !tied.cells.f.flag);
  const flat = columnDistances(cells({ a: 5, b: 5, c: 5, d: 5, e: 5 })); assert.equal(flat.judged, false);
});

test("Alan's idea — a single extreme column against many moderate ones: one wild cell is a marked cell, still counted; three moderate marks make an outlier", () => {
  /* W is 100 spreads out in ONE column; M is 4-6 spreads out in THREE; Q sits in the pack everywhere */
  const col = (w, m) => ({ cells: [...pack(10, 10).filter((c) => c.ticker !== "X"), { ticker: "W", v: w }, { ticker: "M", v: m }, { ticker: "Q", v: 10.1 }] });
  const cols = colsFrom({ c1: col(60, 14.2), c2: col(10, 13.2), c3: col(9.9, 6.9), c4: col(10.2, 10), c5: col(10, 10.3) });
  const s = scorePeers(cols, ["W", "M", "Q"], every(cols));
  assert.equal(s.W.n, 1); assert.ok(Math.abs(s.W.flags[0].d) > 50); assert.equal(s.W.outlier, false, "one flag only, however far, is not an outlier");
  assert.equal(s.M.n, 3); assert.ok(s.M.flags.every((f) => Math.abs(f.d) > 3.5 && Math.abs(f.d) < 8)); assert.equal(s.M.outlier, true); assert.equal(s.M.words, "far from the group in 3 of 5 columns");
  assert.equal(s.Q.n, 0); assert.equal(s.Q.outlier, false); assert.equal(s.Q.words, "");
  assert.ok(s.W.far > s.M.far, "how far is kept beside how many");
});

test("the 40% road: 2 of 4 columns is an outlier, 2 of 6 is not, 1 of 2 is not (one flag never decides)", () => {
  const far = { cells: pack(10, 40) }, near = { cells: pack(10, 10.1) }, none = { cells: pack(10, null) };
  const sp = (spec) => { const c = colsFrom(spec); return scorePeers(c, ["X"], every(c)); };
  assert.equal(sp({ a: far, b: far, c: near, d: near }).X.outlier, true);
  const six = sp({ a: far, b: far, c: near, d: near, e: near, f: near }).X; assert.equal(six.n, 2); assert.equal(six.outlier, false);
  const two = sp({ a: far, b: near, c: none }).X; assert.equal(two.have, 2); assert.equal(two.n, 1); assert.equal(two.outlier, false);
  const thin = sp({ a: { cells: cells({ p: 1, q: 2, X: 99 }) }, b: near }).X; assert.equal(thin.have, 1, "a column that judged no one is not in the count");
});

test("NVDA's set: ARM is far in four columns (P/E 313×, EV/S, P/S, gross margin) → greyed out of every median and the price, never deleted; AMD's and TSM's single marks still count", () => {
  const F = SET("NVDA"), C = conclusion6(F.snapshot, [], F.estimates, F.today, "C", { rule: C6_RULE });
  assert.deepEqual(C.c6.outliers, ["ARM"]); assert.equal(C.c6.score.ARM.words, "far from the group in 4 of 16 columns");
  assert.deepEqual(C.c6.score.ARM.flags.map((f) => f.key).sort(), ["ev_sales", "gm", "pe_ttm", "ps"]);
  for (const k of ROWS) assert.ok(!C.rows.find((r) => r.key === k).peers.some((p) => p.ticker === "ARM"), "ARM is out of " + k);
  assert.ok(!C.peersOn.includes("ARM") && C.c6.peers.includes("ARM") && F.snapshot.members.includes("ARM"), "left out, not deleted");
  assert.ok(C.c6.withOutliers.rows.find((r) => r.key === "pe_ttm").peers.some((p) => p.ticker === "ARM"));
  assert.equal(C.c6.score.TSM.n, 1); assert.ok(isFlagged(C.c6, "TSM", "capex_rev") && !C.c6.score.TSM.outlier && C.peersOn.includes("TSM"));
  assert.ok(C.rows.find((r) => r.key === "pe_ttm").peers.some((p) => p.ticker === "AMD"), "a marked peer keeps counting");
  assert.ok(C.c6.centre.with > C.c6.centre.without && Math.abs(C.c6.centre.with - 394.41) < 0.01 && Math.abs(C.c6.centre.without - 385.56) < 0.01);
  assert.equal(C.sel.list.length, 0, "the rule's own rows are not shown as the operator's edits"); assert.equal(C.outliers.length, 0, "no cell is dropped on one flag any more");
});

test("the four names Alan has seen: who is out and the centre with → without, as the report prints them", () => {
  const want = { MU: [["SNDK", "NVDA"], 4456.36, 6193.94], NVDA: [["ARM"], 394.41, 385.56], CRWV: [["NBIS", "WULF", "APLD", "HUT"], 140.27, 77.97], CBRS: [["CRDO", "ALAB"], 46.2, 40.17] };
  const rep = JSON.parse(readFileSync(here("../deliverables/20261005/comps-c6/four-names-before-after.json"), "utf8"));
  for (const [t, [out, w, wo]] of Object.entries(want)) {
    const F = SET(t), C = conclusion6(F.snapshot, [], F.estimates, F.today, "C", { rule: C6_RULE });
    assert.deepEqual(C.c6.outliers, out, t); assert.ok(Math.abs(C.c6.centre.with - w) < 0.01 && Math.abs(C.c6.centre.without - wo) < 0.01, `${t} ${C.c6.centre.with} → ${C.c6.centre.without}`);
    assert.deepEqual(rep.names[t].outliers.map((o) => o.peer), out); assert.equal(rep.names[t].with_outliers.band.centre, w); assert.equal(rep.names[t].without_outliers.band.centre, wo);
    for (const o of C.c6.outliers) assert.ok(C.c6.score[o].n >= 3 || (C.c6.score[o].n >= 2 && C.c6.score[o].share >= 0.4));
  }
  const hut = conclusion6(SET("CRWV").snapshot, [], SET("CRWV").estimates, "2026-10-05", "C", { rule: C6_RULE }).c6.score.HUT; assert.equal(hut.words, "far from the group in 2 of 4 columns", "the 40% road on a thin peer");
});

test("one click keeps an outlier (a comps_decisions row, off = false, reason keep, measure ALL); a later unkeep hands it back to the rule; an operator's own off still wins", () => {
  const F = SET("MU"), keep = { company: "MU", peer: "SNDK", measure: "ALL", off: false, reason: "keep: outlier, far from the group in 3 of 16 columns", set_at: "2026-10-05T22:00:00Z" };
  assert.ok(keptPeers([keep], "MU").has("SNDK")); assert.ok(!keptPeers([{ ...keep, reason: "put back" }], "MU").has("SNDK")); assert.ok(!keptPeers([{ ...keep, measure: "pe_ttm" }], "MU").has("SNDK"));
  const R = ["C", { rule: C6_RULE }], K = conclusion6(F.snapshot, [keep], F.estimates, F.today, ...R); assert.deepEqual(K.c6.outliers, ["NVDA"]); assert.deepEqual(K.c6.kept, ["SNDK"]); assert.ok(K.peersOn.includes("SNDK")); assert.ok(Math.abs(K.c6.centre.without - 4827) < 1);
  const U = conclusion6(F.snapshot, [keep, { ...keep, reason: "unkeep: back to the rule", set_at: "2026-10-05T22:05:00Z" }], F.estimates, F.today, ...R); assert.deepEqual(U.c6.outliers, ["SNDK", "NVDA"]);
  const O = conclusion6(F.snapshot, [{ company: "MU", peer: "ARM", measure: "ALL", off: true, reason: "not memory", set_at: "2026-10-05T22:00:00Z" }], F.estimates, F.today, ...R);
  assert.ok(!O.c6.peers.includes("ARM") && O.sel.userPeers.has("ARM") && O.sel.list.length === 1 && O.off === 1, "the operator's off peer is not judged and stays the operator's");
});

test("C5's own conclusion is unchanged when no option is passed (its per-measure flag at 3 MAD still answers its tests)", () => {
  const F = SET("NVDA"), a = conclusion(F.snapshot, [], F.estimates, F.today), b = conclusion(F.snapshot, [], F.estimates, F.today, "C", {});
  assert.equal(a.band.mid, b.band.mid); assert.ok(a.outliers.length > 0); assert.equal(conclusion(F.snapshot, [], F.estimates, F.today, "C", { k: Infinity }).outliers.length, 0);
});

test("the tab: marks on flagged cells, outlier rows last and greyed with the count, the centre with / without outliers, the rule in one sentence in PAGE SPECS, no sentence in the content", () => {
  const src = readFileSync(here("../deliverables/20261003/comps-c5/tab.mjs"), "utf8"), code = src.replace(/\/\*[\s\S]*?\*\//g, "");
  const specsStart = code.indexOf("function pageSpecsHTML"), specsEnd = code.indexOf("/* ---- events", src.indexOf("function pageSpecsHTML")) > 0 ? code.indexOf("function wire") : code.length, specs = code.slice(specsStart, specsEnd), content = code.slice(0, specsStart) + code.slice(specsEnd);
  assert.match(code, /conclusion6\(S\.snap, S\.decisions, S\.estimates, S\.opts\.today, S\.way, \{ set: S\.set \}\)/); assert.match(code, /comps-c6\/outliers\.mjs/);
  assert.match(content, /with outliers <b>/); assert.match(content, /without outliers <b>/); assert.match(content, /data-cm="keeppeer"/); assert.match(content, /class="\$\{o6 \? "o6"/); assert.match(content, /▲/);
  assert.match(content, /set\.kept\.filter\(\(r\) => !c6\.ruleOff\.has\(r\.ticker\)\), \.\.\.c6\.outliers/, "outlier rows sit at the bottom of the set");
  assert.match(specs, /Outliers, on price only\./); assert.match(specs, /median absolute deviation/); assert.match(specs, /log scale/); assert.match(specs, /never deleted/);
  assert.ok(!/median absolute deviation|typical spread/.test(content), "the rule's sentence lives in PAGE SPECS only");
  assert.match(readFileSync(here("../index.html"), "utf8"), /import\("\/deliverables\/20261003\/comps-c5\/tab\.mjs"\)/, "index.html is untouched: the Hub still mounts the same file");
  const page = readFileSync(here("../deliverables/20261005/comps-c6/COMPS-C6.html"), "utf8"); assert.match(page, /sc-pagespecs/); for (const t of ["MU", "NVDA", "CRWV", "CBRS"]) assert.ok(page.includes(`shots/after/${t}-set-1680.png`), t + " picture");
});
