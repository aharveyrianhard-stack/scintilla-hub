#!/usr/bin/env node
/* T1-TREE-MAP (29 Sep) — builds the ONE node list the tree map reads: deliverables/20260929/tree-map/tree.json

   market → asset class / region → sector fund → the registry parent (a fund or a heading) → COHORT → names.

   Inputs (all read-only; nothing here is written to any table, the registry or R2):
   - the structure above the cohorts: deliverables/20260928/market-map-r3/nodes.json (the 29 Sep list, 637 nodes, 590 served)
     — headings, funds (with their FMP holdings) and names with their GICS sector. Unchanged: this script only ADDS the cohort
     level and re-hangs every name under its cohort.
   - the cohort structure Alan adopted on 28 Sep (step 1, parents and merges): data/cohort-registry-step1.json — the same 38
     rows the migration wrote to public.cohort_registry. (The live table refuses the Hub's public read key — see the
     deliverable — so the file is the source; it IS what the migration inserted.)
   - who is in each cohort: the registry carries no member lists (step 1 moved no name). Members come from the 28 Sep tree
     work that the registry was derived from: deliverables/20260928/coverage-tree/coverage-tree.json cohorts[].members (the
     36 labels, 486-name universe), the merges folded in (PRECIOUS_METALS → METALS, …), and the 104 names admitted on 29 Sep
     by the cohort on their admission row (nodes.json admission_v3.cohort) when that is a registry cohort.
   - the board cohort of every ticker (public.tickers.cohort — the 17 tabs the Hub uses today): read live through the same
     public REST path the Hub page itself uses (the anon key is taken from index.html at build time, never written here),
     with --board <file> as the offline alternative. Stored per name so the page can tag the differences (Alan's step-2 list).
   - the served set: chart API /universe (live), or --universe <file>.
   Nothing here carries a Geiger reading: the page reads those live (full /geiger, scout /v1/scout-geiger). No number is invented.

   Usage: node scripts/build-tree-map.mjs [--universe u.json] [--board tickers.json] */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "deliverables/20260929/tree-map");
const OUT = join(OUT_DIR, "tree.json");
const CHART_API = "https://scintilla-massive-chart-api.fly.dev";
const SB = "https://wadinxqplrggagkvrdag.supabase.co";
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

/* ---------- inputs ---------- */
const R3 = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/market-map-r3/nodes.json"), "utf8"));
const REG = JSON.parse(readFileSync(join(ROOT, "data/cohort-registry-step1.json"), "utf8"));
const CT = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/coverage-tree/coverage-tree.json"), "utf8"));
const universe = arg("--universe") ? JSON.parse(readFileSync(arg("--universe"), "utf8"))
  : await (await fetch(CHART_API + "/universe", { headers: { Origin: "https://scintillahub.ai" } })).json();
const SERVED = new Set(universe.symbols);
let boardRows, boardSource;
if (arg("--board")) { boardRows = JSON.parse(readFileSync(arg("--board"), "utf8")); boardSource = "file " + arg("--board"); }
else {
  // the Hub page reads public.tickers with its public (anon) key; this is that same read, nothing more
  const key = (readFileSync(join(ROOT, "index.html"), "utf8").match(/"(eyJ[A-Za-z0-9_\-.]+)"/) || [])[1];
  if (!key) throw new Error("no public read key found in index.html");
  const r = await fetch(SB + "/rest/v1/tickers?select=ticker,cohort&order=ticker", { headers: { apikey: key, Authorization: "Bearer " + key, Range: "0-4999" } });
  boardRows = await r.json();
  if (!Array.isArray(boardRows)) throw new Error("tickers read failed: " + JSON.stringify(boardRows).slice(0, 200));
  boardSource = "public.tickers.cohort via the Hub's public REST read, " + new Date().toISOString().slice(0, 16) + "Z";
}
const BOARD = new Map(boardRows.map((r) => [r.ticker, r.cohort]));
const boardCounts = {}; for (const c of BOARD.values()) boardCounts[c] = (boardCounts[c] || 0) + 1;

/* ---------- the registry: 27 cohorts, 6 merges, 5 filters ---------- */
const regBy = new Map(REG.rows.map((r) => [r.label, r]));
const COHORTS = REG.rows.filter((r) => r.kind === "cohort");
const FILTERS = REG.rows.filter((r) => r.kind === "filter");
// a label → the registry cohort it counts for today (itself, or what it merged into); null for a filter / unknown label
const canon = (label) => { const r = regBy.get(label); if (!r) return null; if (r.kind === "cohort") return r.label; if (r.kind === "merged") return r.merged_into; return null; };

/* ---------- membership: the 28 Sep member lists, merges folded, plus the 29 Sep admissions ---------- */
const ctBy = new Map(CT.cohorts.map((c) => [c.key, c]));
const members = new Map(COHORTS.map((c) => [c.label, new Map()])); // cohort → (ticker → how it got there)
const filterOf = new Map(); // ticker → [filter labels]
for (const c of CT.cohorts) {
  const r = regBy.get(c.key);
  if (!r) throw new Error(`coverage-tree cohort ${c.key} is not in the registry`);
  if (r.kind === "filter") { for (const t of c.members) { if (!filterOf.has(t)) filterOf.set(t, []); filterOf.get(t).push(c.key); } continue; }
  const target = canon(c.key);
  for (const t of c.members) if (!members.get(target).has(t)) members.get(target).set(t, r.kind === "merged" ? `28 Sep member list of ${c.key}, merged into ${target}` : "28 Sep member list");
}
for (const l of COHORTS.map((c) => c.label)) if (!ctBy.has(l)) {
  // MEMORY_SEMICAP and SECURITY_DATA exist only as merge targets: their members are their merged-in labels', folded above
  if (!members.get(l).size) throw new Error(`${l} has no member list`);
}
const v3Placed = [], v3NoCohort = [];
for (const n of R3.nodes) {
  if (!n.admission_v3 || !n.served) continue;
  const target = canon(n.admission_v3.cohort);
  if (target) { if (!members.get(target).has(n.ticker)) { members.get(target).set(n.ticker, `29 Sep admission row: ${n.admission_v3.cohort}`); v3Placed.push(n.ticker); } }
  else v3NoCohort.push([n.ticker, n.admission_v3.cohort]);
}

/* ---------- the four kinds of cohort ----------
   ADOPTED  — the 27 registry cohorts (step 1, Alan's).
   PROPOSED — the cohorts in the 28 Sep proposal that are not in the registry (a proposal id that IS a registry label, or a
              rename of one — WORLD for INTL, PHOTONICS for PHOTONICS_OPTICAL, PRECIOUS_METALS for METALS — is the adopted
              cohort and is not repeated). Under their proposed parent, with their members and the proposal's numbers.
   FUND SET — the 49 automatic fund cohorts (R8): every industry fund on the tree, members = its served holdings, with the
              smallest tracking set and the tracking verdict. Under the fund itself.
   NONE YET — whatever is still unclaimed, under its sector heading.
   Home rule (coordinator, 29 Sep): adopted > proposed > fund set > none; within a kind THEME BEATS SIZE (a name in a theme
   cohort and in MEGACAP is at home in the theme), then the smallest; every other membership is "also in". */
const PROP = JSON.parse(readFileSync(join(ROOT, "deliverables/20260928/tree-cohorts/proposed-cohorts.json"), "utf8"));
const SIZE_COHORTS = new Set(["MEGACAP"]); // the one adopted cohort that is a size bucket, not a theme
const proposedMap = new Map(); // proposal id → registry label it stands for (adopted), or null when it is new
for (const c of PROP.cohorts) {
  const r = regBy.get(c.id);
  if (r && r.kind === "cohort") { proposedMap.set(c.id, c.id); continue; }
  if (r && r.kind === "merged") { proposedMap.set(c.id, r.merged_into); continue; }
  const f = c.from_cohorts || [];
  if (f.length === 1 && regBy.get(f[0]) && regBy.get(f[0]).kind === "cohort" && c.split_of !== f[0] && !PROP.cohorts.some((o) => o.id === f[0])) { proposedMap.set(c.id, f[0]); continue; }
  proposedMap.set(c.id, null);
}
const PROPOSED = PROP.cohorts.filter((c) => proposedMap.get(c.id) === null);
const proposalFor = new Map(); // registry label → the proposal row that describes it (its note, groups, moves)
for (const [id, lab] of proposedMap) if (lab) proposalFor.set(lab, PROP.cohorts.find((c) => c.id === id));
const dissolvedFor = new Map(PROP.dissolved.map((d) => [d.key, d]));
for (const c of PROPOSED) if (!byIdR3().has(c.parent)) throw new Error(`proposed parent ${c.parent} of ${c.id} is not on the r3 tree`);
for (const f of PROP.fund_cohorts) if (!byIdR3().has(f.fund)) throw new Error(`fund set ${f.fund} is not on the r3 tree`);
function byIdR3() { return byIdR3.m || (byIdR3.m = new Map(R3.nodes.map((n) => [n.id, n]))); }

// every membership of every ticker, by kind
const memberships = new Map(); // ticker → [{kind, id, label, size}]
const addM = (t, m) => { if (!memberships.has(t)) memberships.set(t, []); memberships.get(t).push(m); };
for (const [c, m] of members) for (const t of m.keys()) addM(t, { kind: "adopted", id: "COHORT_" + c, cohort: c, size: m.size, theme: !SIZE_COHORTS.has(c) });
for (const c of PROPOSED) for (const t of c.members) addM(t, { kind: "proposed", id: "PROPOSED_" + c.id, cohort: c.id, size: c.members.length, theme: true });
const TRACK_RANK = { GOOD: 0, FAIR: 1, POOR: 2 };
// a fund set holds NAMES only: the 28 Sep files list the sector's own ETF among its holdings, and a fund is never its own member
const FUND_IDS = new Set(R3.nodes.filter((n) => n.kind === "fund").map((n) => n.id));
for (const f of PROP.fund_cohorts) { const ms = f.served_holdings.filter((t) => SERVED.has(t) && !FUND_IDS.has(t)); for (const t of ms) addM(t, { kind: "fundset", id: "FUNDSET_" + f.fund, cohort: f.fund, size: ms.length, theme: true, track: TRACK_RANK[f.tracking] ?? 3 }); }
const KIND_RANK = { adopted: 0, proposed: 1, fundset: 2 };
const homeOf = (t) => {
  const ms = memberships.get(t) || [];
  if (!ms.length) return null;
  const b = BOARD.get(t);
  const sorted = ms.slice().sort((x, y) => KIND_RANK[x.kind] - KIND_RANK[y.kind] || (y.theme - x.theme) || ((x.track ?? 0) - (y.track ?? 0)) || x.size - y.size || (x.cohort === b ? -1 : y.cohort === b ? 1 : 0) || (x.cohort < y.cohort ? -1 : 1));
  const home = sorted[0];
  const rule = ms.length === 1 ? "only one" : sorted[1].kind !== home.kind ? `${home.kind} beats ${sorted[1].kind}` : (!sorted[1].theme && home.theme) ? "theme beats size" : home.kind === "fundset" ? "best tracking, then smallest set" : "smallest of several";
  return { home, also: sorted.slice(1), rule };
};

/* ---------- the node list ---------- */
const byId = byIdR3();
for (const c of COHORTS) if (!byId.has(c.parent)) throw new Error(`registry parent ${c.parent} of ${c.label} is not on the r3 tree`);
const nodes = [];
const headings = R3.nodes.filter((n) => n.kind === "index");
const funds = R3.nodes.filter((n) => n.kind === "fund");
const names = R3.nodes.filter((n) => n.kind === "name");
const sectorOf = (n) => { let c = n; while (c && c.kind !== "index") c = byId.get(c.parents[0]); return c; };
for (const n of headings) nodes.push({ ...n });
for (const n of funds) nodes.push({ ...n, board_cohort: BOARD.get(n.ticker) ?? null });
const base = (id, label, parent, ckind) => ({ id, cohort: null, ticker: null, label, parents: [parent], kind: "cohort", ckind, pseudo: ckind === "none",
  served: false, tier: null, planned_tier: null, market_value_usd: null, holdings: null, members: [], member_funds: [], step2: [], diff_count: 0, board_counts: {}, merged_from: [] });
const cohortNodes = new Map();
for (const c of COHORTS) {
  const pr = proposalFor.get(c.label), dv = dissolvedFor.get(c.label);
  const node = { ...base("COHORT_" + c.label, c.display_label, c.parent, "adopted"), cohort: c.label,
    parent_reason: c.parent_reason, rule: c.rule, cohesion: c.cohesion, null95: c.null95, step2_pending: c.step2_pending,
    merged_from: REG.rows.filter((r) => r.kind === "merged" && r.merged_into === c.label).map((r) => r.label),
    admission: "an adopted cohort (the registry, step 1): its bar is the mean of its members' Geigers",
    proposal_note: pr ? pr.note : null, proposal_moves: pr ? pr.moves : [], proposal_id: pr ? pr.id : null, dissolve: dv ? { reason: dv.reason, becomes: dv.becomes } : null };
  cohortNodes.set(node.id, node); nodes.push(node);
}
for (const c of PROPOSED) {
  const node = { ...base("PROPOSED_" + c.id, c.id.replace(/_/g, " "), c.parent, "proposed"), cohort: c.id,
    parent_reason: c.parent_reason, rule: null, cohesion: null, null95: null, step2_pending: null,
    admission: "a PROPOSED cohort (28 Sep proposal, not adopted): its bar shows what adopting it would give",
    proposal_kind: c.kind, proposal_note: c.note, split_of: c.split_of, from_cohorts: c.from_cohorts, groups: c.groups, moves: c.moves, sector_odd: c.sector_odd, not_served: c.not_served,
    all_members: c.members.filter((t) => byId.has(t)) };
  cohortNodes.set(node.id, node); nodes.push(node);
}
for (const f of PROP.fund_cohorts) {
  const node = { ...base("FUNDSET_" + f.fund, f.fund + " SET", f.fund, "fundset"), cohort: f.fund,
    parent_reason: `R8: every industry fund on the tree is a cohort of its served holdings (${f.n} · ${f.coverage_pct.toFixed(0)}% of the fund's weight)`, rule: "R8", cohesion: null, null95: null, step2_pending: null,
    admission: "a FUND SET (R8, automatic): the fund's served holdings; the home of names no adopted or proposed cohort claims",
    tracking: f.tracking, coverage_pct: f.coverage_pct, smallest_set: f.smallest_set, fund_label: f.label, all_members: f.served_holdings.filter((t) => SERVED.has(t) && byId.has(t) && !FUND_IDS.has(t)) };
  cohortNodes.set(node.id, node); nodes.push(node);
}
const pseudo = new Map();
const pseudoFor = (sec) => {
  if (!pseudo.has(sec.id)) {
    const node = { ...base("NOCOHORT_" + sec.id, "NONE YET · " + sec.label.toUpperCase(), sec.id, "none"),
      parent_reason: "not a cohort: the names under this sector heading that no adopted, proposed or fund-set cohort claims", rule: null, cohesion: null, null95: null, step2_pending: null,
      admission: "not a cohort: names no adopted, proposed or fund-set cohort claims, kept under their GICS sector" };
    pseudo.set(sec.id, node); nodes.push(node);
  }
  return pseudo.get(sec.id);
};
const placed = new Map();
for (const n of names) {
  const sec = sectorOf(n);
  if (!sec) throw new Error(`${n.id} has no sector heading`);
  const h = homeOf(n.ticker);
  const cn = h ? cohortNodes.get(h.home.id) : pseudoFor(sec);
  const board = BOARD.get(n.ticker) ?? null;
  const adopted = h && h.home.kind === "adopted";
  // a served name in an adopted cohort whose board tab is another: a step-2 difference. A served name outside every adopted
  // cohort: also counted (the board has a tab for it, the registry has not). A waiting name has no board row: not counted.
  const differs = n.served ? (adopted ? board !== h.home.cohort : true) : false;
  const row = { ...n, parents: [cn.id, ...n.parents.filter((p) => p !== sec.id)], sector: sec.id, sector_label: sec.label, board_cohort: board,
    home_kind: h ? h.home.kind : "none", home_id: cn.id, registry_cohort: adopted ? h.home.cohort : null,
    also_in: h ? h.also.map((m) => ({ kind: m.kind, id: m.id, cohort: m.cohort })) : [], home_rule: h ? h.rule : "no cohort claims it",
    filters: filterOf.get(n.ticker) || [], member_source: adopted ? members.get(h.home.cohort).get(n.ticker) : null, differs };
  nodes.push(row); placed.set(n.ticker, cn.id);
  cn.members.push(n.ticker);
  cn.board_counts[board ?? "—"] = (cn.board_counts[board ?? "—"] || 0) + 1;
  if (differs) { cn.diff_count++; cn.step2.push({ ticker: n.ticker, board, note: adopted ? (h.also.length ? "also in " + h.also.map((m) => m.cohort).join(", ") : null) : (board && regBy.get(board) ? `${board} is a ${regBy.get(board).kind} in the registry` : `${board} is a board tab only`) }); }
}
// funds that are cohort members (INDEXES, MACRO, INTL, METALS, AI HARDWARE hold funds): listed in the cohort, once
for (const f of funds) {
  const h = homeOf(f.ticker); if (!h) continue;
  const cn = cohortNodes.get(h.home.id);
  cn.member_funds.push(f.ticker);
  const fn = nodes.find((x) => x.id === f.id);
  fn.home_kind = h.home.kind; fn.home_id = cn.id; fn.registry_cohort = h.home.kind === "adopted" ? h.home.cohort : null; fn.also_in = h.also.map((m) => ({ kind: m.kind, id: m.id, cohort: m.cohort })); fn.home_rule = h.rule;
  fn.differs = h.home.kind === "adopted" ? BOARD.get(f.ticker) !== h.home.cohort : true;
  if (fn.differs) { cn.diff_count++; cn.step2.push({ ticker: f.ticker, board: BOARD.get(f.ticker) ?? null, note: "a fund" }); }
}
const unservedMembers = [];
for (const [c, m] of members) for (const t of m.keys()) if (!byId.has(t)) unservedMembers.push([c, t]);
for (const c of PROPOSED) for (const t of c.members) if (!byId.has(t)) unservedMembers.push([c.id, t]);

/* ---------- who holds what: the reverse of every fund's served holdings (FMP 26 Sep) + the r3 fund parents ---------- */
const heldBy = {};
for (const f of funds) {
  const sw = f.holdings && f.holdings.served_weights;
  if (sw) for (const [t, w] of sw) { if (!heldBy[t]) heldBy[t] = []; heldBy[t].push([f.ticker, w]); }
}
for (const n of names) for (const p of n.parents.slice(1)) { if (!heldBy[n.ticker]) heldBy[n.ticker] = []; if (!heldBy[n.ticker].some(([f]) => f === p)) heldBy[n.ticker].push([p, null]); }
for (const t of Object.keys(heldBy)) heldBy[t].sort((a, b) => (b[1] ?? -1) - (a[1] ?? -1) || (a[0] < b[0] ? -1 : 1));

/* ---------- counts and checks ---------- */
const servedNames = names.filter((n) => n.served).map((n) => n.ticker);
const missing = universe.symbols.filter((s) => !byId.has(s));
const cohortList = nodes.filter((n) => n.kind === "cohort");
const ofKind = (k) => cohortList.filter((c) => c.ckind === k);
const namesOfKind = (k) => names.filter((n) => (placed.get(n.ticker) || "").startsWith({ adopted: "COHORT_", proposed: "PROPOSED_", fundset: "FUNDSET_", none: "NOCOHORT_" }[k]));
const counts = {
  nodes: nodes.length, headings: headings.length, funds: funds.length, names: names.length,
  cohorts: ofKind("adopted").length, proposed_cohorts: ofKind("proposed").length, fund_sets: ofKind("fundset").length, pseudo_cohorts: ofKind("none").length,
  served: universe.count, served_names: names.filter((n) => n.served).length, served_funds: funds.filter((f) => f.served).length, universe_missed: missing,
  names_at_home_in: { adopted: namesOfKind("adopted").length, proposed: namesOfKind("proposed").length, fundset: namesOfKind("fundset").length, none: namesOfKind("none").length },
  names_in_a_registry_cohort: names.filter((n) => (memberships.get(n.ticker) || []).some((m) => m.kind === "adopted")).length,
  names_in_no_registry_cohort: names.filter((n) => !(memberships.get(n.ticker) || []).some((m) => m.kind === "adopted")).length,
  names_in_several: names.filter((n) => (memberships.get(n.ticker) || []).length > 1).length,
  funds_in_a_registry_cohort: funds.filter((f) => (memberships.get(f.ticker) || []).some((m) => m.kind === "adopted")).length,
  admitted_29sep_placed_by_admission_cohort: v3Placed.length, admitted_29sep_with_no_registry_cohort: v3NoCohort.length,
  differences: cohortList.reduce((s, c) => s + c.diff_count, 0),
  differences_in_real_cohorts: ofKind("adopted").reduce((s, c) => s + c.diff_count, 0),
  differences_outside_adopted: cohortList.filter((c) => c.ckind !== "adopted").reduce((s, c) => s + c.diff_count, 0),
  differences_no_cohort: ofKind("none").reduce((s, c) => s + c.diff_count, 0),
  unserved_members: unservedMembers.length,
};
if (missing.length) throw new Error("served but not on the r3 tree: " + missing.join(" "));
for (const t of servedNames) if (!placed.has(t)) throw new Error(`served name ${t} was not placed in a cohort`);

const doc = {
  artifact_kind: "SCINTILLA_TREE_MAP_NODES",
  built_utc: new Date().toISOString(),
  what: "The market tree with the cohort level: the r3 node list (headings, funds, names) plus one node per cohort of four kinds — ADOPTED (registry), PROPOSED (28 Sep proposal, not adopted), FUND SET (R8 fund tracking sets), NONE YET — every name re-hung under exactly one of them. Structure only: no Geiger, price or change is stored here — the page reads those live.",
  provenance: {
    structure: { source: "deliverables/20260928/market-map-r3/nodes.json", built_utc: R3.built_utc, universe_sha256: R3.provenance.universe.sha256 },
    registry: { source: "data/cohort-registry-step1.json", rows: REG.rows.length, cohorts: COHORTS.length, merged: REG.rows.filter((r) => r.kind === "merged").length, filters: FILTERS.length, note: "the same 38 rows the 28 Sep migration wrote to public.cohort_registry (step 1: parents and merges; step 2 splits/moves pending)" },
    members: { source: "deliverables/20260928/coverage-tree/coverage-tree.json cohorts[].members (28 Sep, 486-name universe) with the registry's merges folded in; the 104 names admitted 29 Sep by their admission row's cohort (nodes.json admission_v3.cohort) where that is a registry cohort", admitted_29sep_placed: v3Placed, admitted_29sep_no_registry_cohort: v3NoCohort },
    board: { source: boardSource, rows: BOARD.size, counts: boardCounts },
    universe: { source: arg("--universe") ? "file" : CHART_API + "/universe", count: universe.count, sha256: universe.universe_sha256 },
    holdings: R3.provenance.holdings,
    home_rule: "adopted > proposed > fund set > none; within a kind theme beats size (MEGACAP is the size bucket), then best tracking (fund sets), then the smallest; every other membership is also_in",
    proposal: { source: "deliverables/20260928/tree-cohorts/proposed-cohorts.json", proposed_new: PROPOSED.map((c) => c.id), stands_for_adopted: Object.fromEntries([...proposedMap].filter(([, v]) => v)), fund_sets: PROP.fund_cohorts.length, dissolved_notes_on: [...dissolvedFor.keys()] },
  },
  counts, filters: FILTERS.map((f) => ({ label: f.label, attribute: f.filter_attribute, value: f.filter_value })),
  held_by: heldBy, unserved_members: unservedMembers, nodes,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(OUT, JSON.stringify(doc));
console.log(OUT, JSON.stringify(counts));

/* ---------- the scout snapshot next to the page: tonight's /v1/scout-geiger rows for the tree's tickers only ----------
   The page reads the route live; this file is its fallback when the route does not answer (r3 keeps one the same way).
   It is a reading, dated, and the page says "page snapshot" when it has to use it. --no-scout skips it. */
if (!process.argv.includes("--no-scout")) {
  try {
    const sc = await (await fetch(CHART_API + "/v1/scout-geiger", { headers: { Origin: "https://scintillahub.ai" } })).json();
    const want = new Set(nodes.filter((n) => n.ticker).map((n) => n.ticker));
    const rows = sc.rows.filter((r) => want.has(r[0]) || want.has(String(r[0]).replace(/\./g, "-")));
    const snap = { what: sc.what, as_of: sc.as_of, computed_utc: sc.computed_utc, run_id: sc.run_id, equalizer: sc.equalizer, row_columns: sc.row_columns, rows, note: "rows for the tree's tickers only; the page reads the route first" };
    writeFileSync(join(OUT_DIR, "scout-geiger-snapshot.json"), JSON.stringify(snap));
    console.log(join(OUT_DIR, "scout-geiger-snapshot.json"), JSON.stringify({ as_of: sc.as_of, rows: rows.length }));
  } catch (e) { console.log("scout snapshot not written: " + e.message); }
}
