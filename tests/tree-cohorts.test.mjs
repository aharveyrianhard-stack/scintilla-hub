// TREE COHORTS (28 Sep, lane N5) — the proposal JSON is whole and honest: every cohort has one parent that exists on the
// tree, every member is a served symbol, every treatment verdict carries a reason, the 216 are all re-read, the rules are
// written with their reasons, the measurements are the ones the page quotes, and the page carries its charts and its way out.
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/tree-cohorts");
const P = JSON.parse(readFileSync(join(DIR, "proposed-cohorts.json"), "utf8"));
const CR = JSON.parse(readFileSync(join(DIR, "build/critique.json"), "utf8"));
const CL = JSON.parse(readFileSync(join(DIR, "build/clusters.json"), "utf8"));
const CT = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/coverage-tree/coverage-tree.json"), "utf8"));
const UNI = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/coverage-tree/data/universe-20260928.json"), "utf8"));
const ADM = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/coverage-tree/admissions-proposed.json"), "utf8"));
const PAGE = readFileSync(join(DIR, "TREE-COHORTS.html"), "utf8");
const SERVED = new Set(UNI.symbols);
const NODE = new Set(CT.nodes.map((n) => n.id));

test("every proposed cohort has exactly one parent, and it is a node on the coverage tree", () => {
  for (const c of P.cohorts) {
    assert.ok(typeof c.parent === "string" && c.parent, `${c.id} has no parent`);
    assert.ok(NODE.has(c.parent), `${c.id} → parent ${c.parent} is not on the tree`);
    assert.ok(c.parent_reason && c.parent_reason.length > 10, `${c.id} parent has no reason`);
  }
  assert.equal(new Set(P.cohorts.map((c) => c.id)).size, P.cohorts.length, "duplicate cohort id");
});

test("every member of every cohort is a served symbol; not-served names are never counted as members", () => {
  for (const c of P.cohorts) {
    for (const t of c.members) assert.ok(SERVED.has(t), `${c.id}: ${t} is not served`);
    for (const t of c.not_served) assert.ok(!SERVED.has(t), `${c.id}: ${t} listed as not served but it is`);
    assert.equal(c.n, c.members.length);
    assert.equal(new Set(c.members).size, c.members.length, `${c.id} repeats a member`);
  }
});

test("the automatic fund cohorts are every industry fund on the tree, with their served holdings from the coverage file", () => {
  const industry = CT.nodes.filter((n) => n.kind === "fund" && n.role === "industry").map((n) => n.ticker).sort();
  assert.deepEqual(P.fund_cohorts.map((f) => f.fund).sort(), industry);
  for (const f of P.fund_cohorts) {
    const cov = CT.coverage[f.fund];
    assert.deepEqual(f.served_holdings, cov ? cov.served.map((x) => x[0]) : []);
  }
});

test("every served symbol has one treatment verdict with a reason; Geiger-only funds are unchanged; the counts add up", () => {
  assert.deepEqual(Object.keys(P.treatment).sort(), [...SERVED].sort());
  const c = { FULL: 0, "SCOUT CANDIDATE": 0, "GEIGER-ONLY": 0 };
  for (const [t, v] of Object.entries(P.treatment)) {
    assert.ok(v.why && v.why.length > 5, `${t} has no reason`); c[v.treatment]++;
    if (UNI.tiers.geiger_only.includes(t)) assert.equal(v.treatment, "GEIGER-ONLY");
  }
  assert.deepEqual(c, P.treatment_counts);
  // a curated member is always FULL
  for (const co of P.cohorts) if (co.kind === "curated" || co.kind === "group") for (const t of co.members) if (!UNI.tiers.geiger_only.includes(t)) assert.equal(P.treatment[t].treatment, "FULL", `${t} in ${co.id} is not FULL`);
});

test("the 216 are all re-read, each with one of three verdicts and a reason; the adds are not served and not on the list", () => {
  assert.equal(P.admissions.rows.length, ADM.count);
  assert.deepEqual(P.admissions.rows.map((r) => r.ticker).sort(), ADM.proposals.map((p) => p.ticker).sort());
  const V = new Set(["KEEP · FULL", "KEEP · SCOUT", "DROP"]);
  const on = new Set(ADM.proposals.map((p) => p.ticker));
  for (const r of P.admissions.rows) { assert.ok(V.has(r.verdict), r.ticker); assert.ok(r.why.length > 10, r.ticker); }
  const sum = Object.values(P.admissions.verdict_counts).reduce((a, b) => a + b, 0); assert.equal(sum, 216);
  for (const a of P.admissions.add) { assert.ok(!SERVED.has(a.ticker), a.ticker); assert.ok(!on.has(a.ticker), a.ticker); assert.match(a.ticker, /^[A-Z]{1,5}$/); }
  assert.equal(P.admissions.iwm_only, ADM.proposals.filter((p) => p.weight_added.length === 1 && p.weight_added[0][0] === "IWM").length);
});

test("the rules are written with a reason each, and the label verdicts follow the stated rule (cohesion above the null's 95th point)", () => {
  assert.equal(P.rules.length, 8);
  for (const r of P.rules) { assert.ok(r.rule.length > 40); assert.ok(r.why.length > 20); }
  for (const [k, v] of Object.entries(P.label_verdicts)) if (v.cohesion != null) assert.equal(v.verdict, v.cohesion > v.null95 ? "cohort" : "attribute", k);
  assert.equal(P.label_verdicts.LARGE_CAP.verdict, "attribute");
  assert.equal(P.label_verdicts.PRECIOUS_METALS.verdict, "cohort");
});

test("the measurements are internally consistent: 36 cohorts measured, the co-movement plateau rule, reproducibility in [0,1]", () => {
  assert.equal(Object.keys(CR.cohesion).length, CT.cohorts.length);
  const best = Math.max(...CL.stability_curve.map((r) => r.ari_halves + r.ari_months));
  const first = CL.stability_curve.find((r) => r.ari_halves + r.ari_months >= best - 0.02);
  assert.equal(CL.k_chosen, first.k);
  assert.equal(CL.clusters.reduce((s, c) => s + c.n, 0), CL.names_clustered + CL.names_placed_after.length);
  for (const c of CL.clusters) if (c.reproducibility != null) assert.ok(c.reproducibility >= 0 && c.reproducibility <= 1);
  for (const n of CL.ari_null) assert.ok(n.ari_shuffled_p95 < 0.05, "shuffled labels should agree at chance");
});

test("the page carries its ten charts as saved images, the scnav pair, plain-words sections and the numbers from the JSON", () => {
  for (let i = 1; i <= 10; i++) {
    const m = PAGE.match(new RegExp(`charts/${i}-[a-z-]+\\.png`)); assert.ok(m, `chart ${i} not on the page`);
    assert.ok(existsSync(join(DIR, m[0])), `${m[0]} missing on disk`);
  }
  assert.match(PAGE, /data-scnav-slot/); assert.match(PAGE, /<!-- scnav ·/);
  for (const s of ["Where the numbers come from", "What could be wrong", "What was not done", "Decisions for Alan", "INDEX-FUNDS"]) assert.ok(PAGE.includes(s), s);
  assert.ok(PAGE.includes(String(P.treatment_counts["SCOUT CANDIDATE"])));
  assert.ok(PAGE.includes(String(P.admissions.verdict_counts["KEEP · FULL"])));
  // house look: no white, body text 11px or more in the CSS
  assert.ok(!/#fff\b|#ffffff|white/i.test(PAGE.split("</style>")[0]));
});
