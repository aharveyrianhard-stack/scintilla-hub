// T1-TREE-MAP (29 Sep): the tree that goes market → … → registry parent → cohort → names is whole and honest.
// Every served name is on the tree exactly once as a cohort member; every adopted registry cohort is on it exactly once,
// under the parent the registry names; the finder resolves all 590 served lines; the board cohort is carried as a tag and
// counted, never written back; the page never carries a reading in its structure file.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260929/tree-map");
const T = JSON.parse(readFileSync(join(DIR, "tree.json"), "utf8"));
const R3 = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/market-map-r3/nodes.json"), "utf8"));
const REG = JSON.parse(readFileSync(join(ROOT, "data/cohort-registry-step1.json"), "utf8")).rows;
const CT = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/coverage-tree/coverage-tree.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "index.html"), "utf8");
const byId = new Map(T.nodes.map((n) => [n.id, n]));
const cohorts = T.nodes.filter((n) => n.kind === "cohort");
const real = cohorts.filter((c) => !c.pseudo), pseudo = cohorts.filter((c) => c.pseudo);
const names = T.nodes.filter((n) => n.kind === "name");
const funds = T.nodes.filter((n) => n.kind === "fund");
const SERVED = new Set(R3.provenance.universe.symbols);

test("the structure above the cohorts is the r3 tree, unchanged: same headings and funds, same served set", () => {
  assert.equal(T.provenance.structure.universe_sha256, R3.provenance.universe.sha256);
  for (const n of R3.nodes.filter((x) => x.kind !== "name")) {
    const m = byId.get(n.id);
    assert.ok(m, `${n.id} missing from the tree map`);
    assert.deepEqual(m.parents, n.parents, `${n.id}: parents changed`);
    assert.equal(m.kind, n.kind);
  }
  for (const n of R3.nodes.filter((x) => x.kind === "name")) assert.ok(byId.has(n.id), `${n.id} missing`);
  assert.equal(T.counts.served, R3.counts.served);
  assert.deepEqual(T.counts.universe_missed, []);
});

test("every adopted registry cohort is on the tree exactly once, under the parent the registry names, with its reason", () => {
  const regCohorts = REG.filter((r) => r.kind === "cohort");
  assert.equal(regCohorts.length, 27);
  assert.equal(real.length, 27);
  for (const r of regCohorts) {
    const on = real.filter((c) => c.cohort === r.label);
    assert.equal(on.length, 1, `${r.label} appears ${on.length} times`);
    assert.equal(on[0].parents[0], r.parent, `${r.label} should hang under ${r.parent}`);
    assert.ok(byId.has(r.parent), `${r.label}: parent ${r.parent} is not a node`);
    assert.equal(on[0].parent_reason, r.parent_reason);
    assert.equal(on[0].label, r.display_label);
  }
  // merges are carried on the target, never as nodes of their own
  for (const r of REG.filter((x) => x.kind === "merged")) {
    assert.ok(!cohorts.some((c) => c.cohort === r.label), `${r.label} was merged and must not be a node`);
    assert.ok(byId.get("COHORT_" + r.merged_into).merged_from.includes(r.label), `${r.merged_into} should list ${r.label} as merged in`);
  }
  // filters are attributes on names, never nodes
  for (const r of REG.filter((x) => x.kind === "filter")) assert.ok(!cohorts.some((c) => c.cohort === r.label), `${r.label} is a filter, not a node`);
  assert.deepEqual(T.filters.map((f) => f.label).sort(), ["BLUE_CHIP", "LARGE_CAP", "MEGA_CAP", "MID_CAP", "SMALL_CAP"]);
});

test("every served name is on the tree exactly once, as a member of exactly one cohort (real or the sector's NO COHORT YET)", () => {
  const seen = new Map();
  for (const c of cohorts) for (const t of c.members) seen.set(t, (seen.get(t) || 0) + 1);
  const servedNames = names.filter((n) => n.served);
  assert.equal(servedNames.length, T.counts.served_names);
  for (const n of servedNames) assert.equal(seen.get(n.ticker), 1, `${n.ticker} is a member ${seen.get(n.ticker) || 0} times`);
  for (const n of names) {
    assert.equal(n.parents[0], n.registry_cohort ? "COHORT_" + n.registry_cohort : "NOCOHORT_" + n.sector, `${n.ticker}: primary parent is not its cohort`);
    assert.ok(byId.get(n.parents[0]).members.includes(n.ticker), `${n.ticker}: not listed by its cohort`);
    assert.ok(n.sector.startsWith("SEC_") || n.sector === "CRYPTO", `${n.ticker}: sector ${n.sector}`);
  }
  // a member is never counted twice across real cohorts and the NO COHORT YET buckets
  const all = cohorts.flatMap((c) => c.members);
  assert.equal(new Set(all).size, all.length);
  // the served set is the names plus the served funds, nothing else
  assert.equal(servedNames.length + funds.filter((f) => f.served).length, SERVED.size);
});

test("a fund is a structural node once and a member of at most one cohort; fund members are the 28 Sep lists' funds", () => {
  const ids = T.nodes.map((n) => n.id);
  assert.equal(new Set(ids).size, ids.length, "duplicate node id");
  const asMember = new Map();
  for (const c of cohorts) for (const t of c.member_funds) asMember.set(t, (asMember.get(t) || 0) + 1);
  for (const [t, k] of asMember) { assert.equal(k, 1, `${t} is a member of ${k} cohorts`); assert.equal(byId.get(t).kind, "fund"); }
  for (const f of funds) if (f.registry_cohort) assert.ok(byId.get("COHORT_" + f.registry_cohort).member_funds.includes(f.ticker), `${f.ticker}: cohort does not list it`);
  assert.equal(asMember.size, T.counts.funds_in_a_registry_cohort);
});

test("membership is the 28 Sep member lists with the merges folded in, plus the 29 Sep admissions by their admission cohort", () => {
  const canon = new Map(REG.map((r) => [r.label, r.kind === "cohort" ? r.label : r.kind === "merged" ? r.merged_into : null]));
  const listed = new Map();
  for (const c of CT.cohorts) { const t = canon.get(c.key); if (!t) continue; if (!listed.has(t)) listed.set(t, new Set()); for (const m of c.members) listed.get(t).add(m); }
  for (const c of real) {
    const on = new Set([...c.members, ...c.member_funds]);
    for (const t of on) {
      const n = byId.get(t);
      const from28 = listed.get(c.cohort) && listed.get(c.cohort).has(t);
      const fromV3 = n.admission_v3 && canon.get(n.admission_v3.cohort) === c.cohort;
      assert.ok(from28 || fromV3, `${t} in ${c.cohort}: not on the 28 Sep list and not its admission cohort`);
    }
  }
  // the home rule is stated and followed: a name in several cohorts sits in the smallest of them, size = the member
  // list as it stands before placement (the 28 Sep list plus the 29 Sep admissions), the same size the build compared
  const rawSize = new Map();
  for (const [c, set] of listed) rawSize.set(c, new Set(set));
  for (const n of T.nodes) if (n.admission_v3 && n.served) { const c = canon.get(n.admission_v3.cohort); if (c) { if (!rawSize.has(c)) rawSize.set(c, new Set()); rawSize.get(c).add(n.ticker); } }
  for (const n of names.filter((x) => x.also_in && x.also_in.length)) {
    const hs = rawSize.get(n.registry_cohort).size;
    for (const o of n.also_in) { assert.ok(rawSize.get(o).size >= hs, `${n.ticker}: ${o} (${rawSize.get(o).size}) is smaller than its home ${n.registry_cohort} (${hs})`); assert.ok(rawSize.get(o).has(n.ticker), `${n.ticker}: also_in ${o} unsupported`); }
  }
  assert.equal(names.filter((x) => x.also_in && x.also_in.length).length, T.counts.names_in_several);
});

test("the board cohort is carried as a tag and counted per cohort; the step-2 list is exactly the served members whose board tab differs", () => {
  assert.equal(Object.keys(T.provenance.board.counts).length, 17, "the board has 17 cohorts today");
  let total = 0;
  for (const c of cohorts) {
    const ms = [...c.members, ...c.member_funds].map((t) => byId.get(t));
    const differing = ms.filter((m) => m.differs);
    assert.equal(c.diff_count, differing.length, `${c.id} diff_count`);
    assert.deepEqual(c.step2.map((s) => s.ticker).sort(), differing.map((m) => m.ticker).sort(), `${c.id} step2 list`);
    for (const m of ms) {
      if (!m.served) { assert.equal(m.differs, false, `${m.ticker} is waiting and cannot differ`); continue; }
      if (m.kind === "name") assert.equal(m.differs, c.pseudo ? true : m.board_cohort !== c.cohort, `${m.ticker} differs flag`);
      if (m.board_cohort) assert.ok(T.provenance.board.counts[m.board_cohort] > 0, `${m.ticker}: board cohort ${m.board_cohort} unknown`);
    }
    total += c.diff_count;
  }
  assert.equal(total, T.counts.differences);
  assert.equal(T.counts.differences, T.counts.differences_in_real_cohorts + T.counts.differences_no_cohort);
  assert.equal(pseudo.reduce((s, c) => s + c.members.length, 0), T.counts.names_in_no_registry_cohort);
});

test("the finder resolves every served line to a path from THE MARKET and every fund that holds it", () => {
  const pathOf = (n) => { const out = []; let c = n; while (c.parents.length) { c = byId.get(c.parents[0]); assert.ok(c, `${n.id}: broken path`); out.unshift(c.id); } return out; };
  let withFunds = 0;
  for (const t of SERVED) {
    const n = byId.get(t);
    assert.ok(n && n.ticker === t, `${t} not resolvable`);
    const p = pathOf(n);
    assert.equal(p[0], "MARKET", `${t}: path does not start at the market`);
    if (n.kind === "name") { assert.ok(p.length >= 3, `${t}: path too short ${p.join(" › ")}`); assert.ok(p[p.length - 1].startsWith("COHORT_") || p[p.length - 1].startsWith("NOCOHORT_"), `${t}: last step is not a cohort`); }
    const held = T.held_by[t];
    if (held) { withFunds++; for (const [f, w] of held) { assert.equal(byId.get(f).kind, "fund", `${t}: held by ${f} which is not a fund`); assert.ok(w == null || w > 0); } }
  }
  assert.ok(withFunds >= 400, `only ${withFunds} served lines have a holder list`);
  // every served weight in a fund's file is answered by held_by, and vice versa
  for (const f of funds) if (f.holdings && f.holdings.served_weights) for (const [t, w] of f.holdings.served_weights) assert.ok((T.held_by[t] || []).some(([x, y]) => x === f.ticker && y === w), `${t}: ${f.ticker} weight missing from held_by`);
});

test("the structure file carries no reading, and the page draws full, scout and aggregate bars and says which", () => {
  const txt = JSON.stringify(T.nodes);
  assert.doesNotMatch(txt, /"composite"|"geiger"|"price"|"change_pct"/, "tree.json must not carry a reading");
  assert.match(PAGE, /\/geiger/); assert.match(PAGE, /\/v1\/scout-geiger/); assert.match(PAGE, /scout-geiger-snapshot\.json/);
  assert.match(PAGE, /GEIGER · SCOUT/); assert.match(PAGE, /GEIGER · FULL/); assert.match(PAGE, /full and scout are never mixed/);
  assert.match(PAGE, /board ≠ registry|BOARD ≠ REGISTRY/);
  assert.match(PAGE, /scnav ·/, "the BACK / CLOSE pair");
  assert.match(PAGE, /map3d\.js/); assert.ok(existsSync(join(DIR, "map3d.js")) && existsSync(join(DIR, "layout.js")) && existsSync(join(DIR, "aggregate.js")));
  // never a write: the page and the build script only read
  const build = readFileSync(join(ROOT, "scripts/build-tree-map.mjs"), "utf8");
  for (const src of [PAGE, build]) { assert.doesNotMatch(src, /method:\s*["'](POST|PATCH|PUT|DELETE)/i); assert.doesNotMatch(src, /\b(insert into|update .* set|delete from)\b/i); }
  assert.ok(existsSync(join(DIR, "TREE-MAP.html")), "the plain-words deliverable");
});
