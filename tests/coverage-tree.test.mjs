// COVERAGE TREE (28 Sep, lane L3) — the node JSON is whole and honest: every served symbol is placed, the coverage maths
// adds up against the holdings snapshot, the tree grows from the r3 list without moving a node, every cohort has its
// members served, every ETF parent is a fund that actually holds the members, and the page wires the bars and the sections.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/coverage-tree");
const CT = JSON.parse(readFileSync(join(DIR, "coverage-tree.json"), "utf8"));
const HOLD = JSON.parse(readFileSync(join(DIR, "data/holdings.json"), "utf8")).data;
const UNI = JSON.parse(readFileSync(join(DIR, "data/universe-20260928.json"), "utf8"));
const R3 = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/market-map-r3/nodes.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "COVERAGE-TREE.html"), "utf8");
const byId = new Map(CT.nodes.map((n) => [n.id, n]));
const SERVED = new Set(UNI.symbols);
const usTicker = (t) => (/^[A-Z]{1,5}\.[A-Z]$/.test(t) ? t.replace(".", "-") : t);

test("structure: the r3 nodes are all present, unchanged in id, kind, ticker and first parent", () => {
  for (const o of R3.nodes) {
    const n = byId.get(o.id);
    assert.ok(n, `${o.id} missing`);
    assert.equal(n.kind, o.kind); assert.equal(n.ticker, o.ticker); assert.equal(n.parents[0], o.parents[0]);
  }
  assert.equal(CT.nodes.filter((n) => n.kind !== "cohort" && n.id !== "COHORTS_NO_ETF").length, R3.nodes.length);
});

test("structure: unique ids, every parent exists, one root, every served symbol placed once as a line", () => {
  assert.equal(byId.size, CT.nodes.length);
  assert.deepEqual(CT.nodes.filter((n) => !n.parents.length).map((n) => n.id), ["MARKET"]);
  for (const n of CT.nodes) for (const p of n.parents) assert.ok(byId.has(p), `${n.id} → missing parent ${p}`);
  const lines = CT.nodes.filter((n) => n.ticker && n.kind !== "cohort").map((n) => n.ticker);
  assert.equal(new Set(lines).size, lines.length, "a ticker appears twice as a line");
  for (const s of UNI.symbols) assert.ok(lines.includes(s), `${s} served but not on the tree`);
});

test("coverage: served weight is the sum of the fund's served rows, coverage divides by max(100, file total), misses are not served", () => {
  for (const [f, c] of Object.entries(CT.coverage)) {
    const h = HOLD[f]; assert.ok(h, `${f} has coverage but no holdings`);
    let sw = 0, total = 0;
    for (const [t, w] of h.h) { if (!(w > 0)) continue; total += w; if (SERVED.has(usTicker(t))) sw += w; }
    assert.ok(Math.abs(sw - c.served_weight_pct) < 0.01, `${f} served weight ${c.served_weight_pct} vs ${sw}`);
    assert.ok(Math.abs((100 * sw) / Math.max(100, total) - c.coverage_pct) < 0.01, `${f} coverage`);
    for (const [t] of c.served) assert.ok(SERVED.has(t), `${f} lists ${t} as served`);
    for (const [t] of c.missed_top) assert.ok(!SERVED.has(t), `${f} lists ${t} as missed but it is served`);
    assert.ok(c.served_count === c.served.length);
  }
  assert.equal(Object.keys(CT.coverage).length, CT.counts.funds_with_coverage);
});

test("coverage: IWM is thin and none of its ten heaviest lines is served; SPY is covered by weight", () => {
  const iwm = CT.coverage.IWM, spy = CT.coverage.SPY;
  assert.ok(iwm.coverage_pct < 10 && iwm.served_count >= 20, "IWM coverage");
  assert.equal(iwm.top10_served, 0);
  assert.ok(spy.coverage_pct > 80 && spy.top10_served === 10, "SPY coverage");
});

test("tracking: each study has the fund's own series, a smallest set that is a subset of the served names, and a verdict", () => {
  let n = 0;
  for (const [f, t] of Object.entries(CT.tracking)) {
    if (t.skipped) continue; n++;
    const served = new Set(CT.coverage[f].served.map(([x]) => x));
    for (const x of t.smallest_set) assert.ok(served.has(x), `${f}: ${x} in the smallest set but not served`);
    for (const x of t.redundant_for_tracking) assert.ok(served.has(x) && !t.smallest_set.includes(x), `${f}: redundant ${x}`);
    assert.equal(t.smallest_set.length + t.redundant_for_tracking.length, t.members_in_study, `${f}: set + redundant = members`);
    assert.ok(["GOOD", "FAIR", "POOR"].includes(t.verdict));
    assert.ok(t.full_set.corr >= -1 && t.full_set.corr <= 1 && t.sessions >= 50);
    if (t.tracks) assert.ok(t.smallest_set_stats.corr >= t.full_set.corr - t.near.corr - 1e-9, `${f}: smallest set not within reach`);
  }
  assert.equal(n, CT.counts.funds_with_tracking);
  assert.ok(n >= 100, "most funds have a study");
});

test("cohorts: every member is served, the ETF parent holds at least two members and a third of them, and the node hangs under it", () => {
  const holdset = {};
  for (const [f, h] of Object.entries(HOLD)) holdset[f] = new Set(h.h.map(([t]) => usTicker(t)));
  for (const c of CT.cohorts) {
    assert.ok(c.members.length > 0);
    for (const m of c.members) assert.ok(SERVED.has(m), `${c.key}: ${m} not served`);
    const node = byId.get("COH_" + c.key); assert.ok(node && node.kind === "cohort");
    if (c.etf_parent) {
      const held = c.members.filter((m) => holdset[c.etf_parent].has(m));
      assert.ok(held.length >= 2 && held.length / c.members.length >= 1 / 3 - 1e-9, `${c.key}: parent ${c.etf_parent} holds ${held.length}`);
      const parentNode = CT.nodes.find((n) => n.kind === "fund" && n.ticker === c.etf_parent);
      assert.deepEqual(node.parents, [parentNode.id]);
    } else assert.deepEqual(node.parents, ["COHORTS_NO_ETF"]);
    for (const m of c.members) { const nn = CT.nodes.find((n) => n.ticker === m && n.kind !== "cohort"); assert.ok(nn.parents.includes(node.id), `${m} not under ${c.key}`); }
  }
  for (const k of ["QUANTUM", "SPACE", "AI_SOFTWARE", "CYBER", "MEMORY_STORAGE"]) assert.ok(CT.cohorts.some((c) => c.key === k), `${k} cohort present`);
  assert.equal(CT.cohorts.find((c) => c.key === "QUANTUM").etf_parent, "QTUM");
  assert.equal(CT.cohorts.find((c) => c.key === "AI_SOFTWARE").etf_parent, "IGV");
  assert.ok(!CT.cohorts.some((c) => /___|&/.test(c.key)), "no FMP industry label sits among the cohorts");
});

test("admissions: US listings only, none served, each add names a fund with coverage and a weight the fund's file carries", () => {
  assert.ok(CT.admissions.length > 50);
  for (const a of CT.admissions) {
    assert.match(a.ticker, /^[A-Z]{1,5}(-[A-Z])?$/);
    assert.ok(!SERVED.has(a.ticker), `${a.ticker} proposed but served`);
    for (const [f, w] of a.adds) { assert.ok(CT.coverage[f], f); assert.ok(HOLD[f].h.some(([t, ww]) => usTicker(t) === a.ticker && Math.abs(ww - w) < 0.001), `${a.ticker} weight in ${f}`); }
  }
  for (let i = 1; i < CT.admissions.length; i++) assert.ok(CT.admissions[i - 1].sum_weight_pct >= CT.admissions[i].sum_weight_pct);
});

test("MDB and APLD are placed with their families and their fund memberships", () => {
  const mdb = CT.nodes.find((n) => n.ticker === "MDB"), apld = CT.nodes.find((n) => n.ticker === "APLD");
  assert.equal(mdb.gics.industry, "Software"); assert.ok(mdb.cohorts.includes("AI_SOFTWARE")); assert.ok(mdb.in_funds.some(([f]) => f === "SKYY"));
  assert.ok(!mdb.in_funds.some(([f]) => f === "IWM") && !mdb.in_funds.some(([f]) => f === "IGV"), "MDB is in neither IWM nor IGV per FMP");
  assert.equal(apld.gics.industry, "IT Services"); assert.ok(apld.cohorts.includes("AI_DATACENTER")); assert.ok(apld.in_funds.some(([f]) => f === "AGIX"));
});

test("page: reads the node JSON and the live Geiger with the snapshot as fallback, draws both bars, carries the seven sections and the way back", () => {
  assert.ok(PAGE.includes('getJSON("coverage-tree.json")'));
  assert.ok(PAGE.includes('CHART_API + "/geiger"') && PAGE.includes("data/geiger-snapshot-20260928.json"));
  assert.ok(PAGE.includes('class="gb ') && PAGE.includes(".gb.agg i.u") && PAGE.includes("--up:#35b06a") && PAGE.includes("--dn:#d1483f"));
  for (const id of ["s1", "s2", "s3", "s4", "s5", "s6", "s7"]) assert.ok(PAGE.includes(`id="${id}"`), id);
  assert.ok(PAGE.includes("<!-- scnav ·") && PAGE.includes("data-scnav-slot"), "BACK / CLOSE pair");
  assert.ok(!/#fff\b|#ffffff|:\s*white\b|rgb\(255, ?255, ?255\)/i.test(PAGE.replace(/<!--[\s\S]*?-->/g, "")), "no white");
  assert.ok(PAGE.includes("PROPOSED · NOTHING ADMITTED"));
});
