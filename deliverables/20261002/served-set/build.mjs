/* U2 (2 Oct 2026) · the served set decided by its parents — the builder. Reads the dated snapshots in data/ and the tree,
   runs maths.mjs, writes measure.json (every table on the page) and served-set.json (the rule and the in/out lists).
   Nothing live is read or written here: the snapshots were taken 2 Oct ~19:20Z and are named in each file's "what".
   Usage: node deliverables/20261002/served-set/build.mjs   (from the Hub root) */
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { norm, aggregate, readable, strongN, iwmRule, servedSet, spread, GRID, TOL, PASS_SHARE } from "./maths.mjs";

const DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = join(DIR, "../../..");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const r3 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 1000) / 1000);
const r2 = (x) => (x == null || !Number.isFinite(x) ? null : Math.round(x * 100) / 100);

const SEVEN = J(join(DIR, "data/seven-20261001.json"));
const DAILY = J(join(DIR, "data/daily-three-rung-5d.json"));
const HOLD = J(join(DIR, "data/holdings-20260926.json"));
const HUB = J(join(DIR, "data/hub-geiger-20261002.json"));
const UL = J(join(DIR, "data/universe-and-lists.json"));
const TREE = J(join(ROOT, "deliverables/20260929/tree-map/tree.json"));

/* ── readings ── */
const seven = new Map(), sevenRow = new Map();
for (const [t, c, tr, mo, ls, kind, rc, rungs] of SEVEN.rows) { const k = norm(t); seven.set(k, c); sevenRow.set(k, { composite: c, trend: tr, momentum: mo, last_session: ls, kind, rungs_count: rc, rungs }); }
const RUNG_KEYS = ["3h", "4h", "6h", "12h", "1d", "3d", "1w"];
const rungReading = RUNG_KEYS.map((rk) => { const m = new Map(); for (const [t, , , , , , , rungs] of SEVEN.rows) if (rungs && rungs[rk] != null) m.set(norm(t), rungs[rk]); return (x) => m.get(x) ?? null; });
const dailyReading = DAILY.dates.map((d, i) => { const m = new Map(); for (const [t, arr] of Object.entries(DAILY.rows)) if (arr[i] != null) m.set(norm(t), arr[i]); return (x) => m.get(x) ?? null; });
const draws = [...rungReading, ...dailyReading];
const drawLabels = [...RUNG_KEYS.map((k) => "1 Oct rung " + k), ...DAILY.dates.map((d) => "3-rung close " + d)];
const main = (x) => seven.get(x) ?? null;
const hub = new Map(Object.entries(HUB.symbols).map(([t, v]) => [norm(t), { composite: v[0], trend: v[1], momentum: v[2], tf: v[3] }]));
const hubReading = (x) => (hub.get(x) || {}).composite ?? null;

/* ── the tree: funds, their roles and headings, the names, the cohorts ── */
const nodes = TREE.nodes;
const byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const fundNodes = nodes.filter((n) => n.kind === "fund");
const funds = new Set(fundNodes.map((n) => norm(n.ticker)));
const universe = new Set(UL.universe.map(norm));
const nameNodes = nodes.filter((n) => n.kind === "name");
const label = Object.fromEntries(nodes.filter((n) => n.ticker).map((n) => [norm(n.ticker), n.label]));
const adopted = nodes.filter((n) => n.kind === "cohort" && n.ckind === "adopted");
const cohortMembers = new Map();
for (const c of adopted) for (const m of c.members || []) { const k = norm(m); if (!cohortMembers.has(k)) cohortMembers.set(k, []); cohortMembers.get(k).push(c.cohort); }
const heldBy = {};   // name → [[fund, weight, rank]] over the full holdings file
for (const [f, { h }] of Object.entries(HOLD.funds)) h.forEach(([t, w], i) => { const k = norm(t); (heldBy[k] ||= []).push([f, w, i + 1]); });

const SECTOR_FUND = { SEC_TECH: "XLK", SEC_FIN: "XLF", SEC_HLTH: "XLV", SEC_ENGY: "XLE", SEC_INDU: "XLI", SEC_STPL: "XLP", SEC_DISC: "XLY", SEC_UTIL: "XLU", SEC_MATL: "XLB", SEC_REIT: "XLRE", SEC_COMM: "XLC" };

/* ── 1. coverage per parent + 2. strong-N ── */
const parents = [];
for (const f of fundNodes) {
  const T = norm(f.ticker);
  const H = HOLD.funds[f.ticker];
  const row = { ticker: T, label: f.label, role: f.role, heading: f.parents[0], heading_label: (byId[f.parents[0]] || {}).label || f.parents[0], served_fund: universe.has(T), holdings_on_file: !!H };
  if (!H) { parents.push(row); continue; }
  const servedH = H.h.filter(([t]) => universe.has(norm(t)));
  const full = aggregate(H.h, main), srv = aggregate(servedH, main), srvHub = aggregate(servedH, hubReading);
  const sn = strongN(H.h, main, draws);
  const sp = spread(H.h, main);
  const byTol = {};
  for (const tol of [0.05, 0.075, 0.1, 0.15]) { const s = strongN(H.h, main, draws, { tol }); byTol[tol] = { w: s.w.n, eq: s.eq.n }; }
  const own7 = sevenRow.get(T), ownHub = hub.get(T);
  /* today's served names, tested on the same 12 draws: on how many is their aggregate within the tolerance of the full one? */
  const todayDraws = { w: 0, eq: 0, of: 0 };
  for (const r of draws) { const a = aggregate(servedH, r), f = aggregate(H.h, r); if (a.w == null || f.w == null) continue; todayDraws.of++; if (Math.abs(a.w - f.w) <= TOL) todayDraws.w++; if (Math.abs(a.eq - f.eq) <= TOL) todayDraws.eq++; }
  Object.assign(row, {
    served_today_draws: { ...todayDraws, strong_w: todayDraws.of > 0 && todayDraws.w / todayDraws.of >= PASS_SHARE && full.w != null && srv.w != null && Math.abs(srv.w - full.w) <= TOL, strong_eq: todayDraws.of > 0 && todayDraws.eq / todayDraws.of >= PASS_SHARE && full.eq != null && srv.eq != null && Math.abs(srv.eq - full.eq) <= TOL },
    count_in_fund: H.n, rows_in_file: H.h.length, total_weight_pct: r2(full.total_weight_pct),
    readable: sn.count, readable_weight_pct: r2(full.weight_pct), coverage_of_readings_pct: r2(full.coverage_pct),
    served: { count: servedH.length, weight_pct: r2(srv.weight_pct), share_of_fund_pct: r2(full.total_weight_pct > 0 ? (100 * srv.weight_pct) / full.total_weight_pct : 0), eq: r3(srv.eq), w: r3(srv.w), hub_eq: r3(srvHub.eq), hub_w: r3(srvHub.w), names: servedH.map(([t, w]) => [norm(t), w]) },
    full: { eq: r3(full.eq), w: r3(full.w) },
    own: { seven: own7 ? r3(own7.composite) : null, seven_session: own7 ? own7.last_session : null, hub: ownHub ? r3(ownHub.composite) : null },
    gap_today: { served_vs_full_eq: r3(srv.eq != null && full.eq != null ? srv.eq - full.eq : null), served_vs_full_w: r3(srv.w != null && full.w != null ? srv.w - full.w : null), served_vs_own_w: r3(srv.w != null && own7 ? srv.w - own7.composite : null), served_vs_own_eq: r3(srv.eq != null && own7 ? srv.eq - own7.composite : null) },
    strong: { eq: sn.eq.n, w: sn.w.n, eq_one_day: sn.eq.one_day_n, w_one_day: sn.w.one_day_n },
    spread: { sd: r3(sp.sd), names_for: sp.names_for }, strong_by_tolerance: byTol,
    ladder: sn.ladder.map((l) => ({ N: l.N, used: l.used, weight_pct: r2(l.weight_pct), eq: { diff: r3(l.eq.diff_main), pass: l.eq.draws_pass, of: l.eq.draws_total, strong: l.eq.strong }, w: { diff: r3(l.w.diff_main), pass: l.w.draws_pass, of: l.w.draws_total, strong: l.w.strong } })),
    top_needed_w: readable(H.h, main).slice(0, typeof sn.w.n === "number" ? sn.w.n : 0).map(([t, w]) => [t, r2(w), universe.has(t)]),
    top_needed_eq: readable(H.h, main).slice(0, typeof sn.eq.n === "number" ? sn.eq.n : 0).map(([t, w]) => [t, r2(w), universe.has(t)]),
  });
  parents.push(row);
}
const measured = parents.filter((p) => p.holdings_on_file);

/* the sector headings, read through their sector fund: served today = the tree's names under the heading */
const headings = [];
for (const [sec, fund] of Object.entries(SECTOR_FUND)) {
  const p = parents.find((x) => x.ticker === fund);
  const names = nameNodes.filter((n) => n.sector === sec).map((n) => norm(n.ticker));
  const inUniverse = names.filter((t) => universe.has(t));
  const a = aggregate(inUniverse.map((t) => [t, 1]), main);
  const h = { heading: sec, label: (byId[sec] || {}).label || sec, sector_fund: fund, sector_fund_on_file: !!(p && p.holdings_on_file), served_names: inUniverse.length, served_eq: r3(a.eq) };
  if (p && p.holdings_on_file) Object.assign(h, { fund_full_eq: p.full.eq, fund_full_w: p.full.w, fund_own_seven: p.own.seven, strong_eq: p.strong.eq, strong_w: p.strong.w, served_holdings_of_fund: p.served.count, served_share_of_fund_pct: p.served.share_of_fund_pct, gap_served_names_vs_fund_full_eq: r3(a.eq != null && p.full.eq != null ? a.eq - p.full.eq : null) });
  headings.push(h);
}

/* ── 4. the served set under the rule (weight-blended N primary; equal-weight N shown beside) ── */
const lists = { LIKED: UL.liked.map(norm), FAVORITES: UL.favorites.map(norm), RADAR: UL.radar.map(norm) };
const cohortSet = new Set(cohortMembers.keys());
function buildSet(kind, tol, cap) {
  const ps = measured.map((p) => ({ ticker: p.ticker, holdings: HOLD.funds[p.ticker].h, n: tol == null ? p.strong[kind] : p.strong_by_tolerance[tol][kind], admits: p.ticker !== "IWM" }));
  return servedSet({ parents: ps, lists, cohorts: cohortSet, funds, universe, readingOf: main, cap });
}
const setW = buildSet("w"), setEq = buildSet("eq");
/* the tolerance sensitivity: the same rule at four tolerances, weight-blended and equal-weight, with and without the
   cap of 30 (a parent needing more than 30 names is read off-Hub nightly from all its holdings instead) */
const sensitivity = {};
for (const tol of [0.05, 0.075, 0.1, 0.15]) {
  sensitivity[tol] = {};
  for (const cap of [Infinity, 30]) {
    const sw = buildSet("w", tol, cap), se = buildSet("eq", tol, cap);
    sensitivity[tol][cap === Infinity ? "no_cap" : "cap_30"] = { w: { proposed: sw.proposed_count, names: sw.keep.length, out: sw.out.length, in: sw.in.length, spread_out: sw.spread_out }, eq: { proposed: se.proposed_count, names: se.keep.length, out: se.out.length, in: se.in.length, spread_out: se.spread_out } };
  }
}
/* the recommended setting (decision 1–2 for Alan): tolerance 0.10, weight-blended, cap 30 */
const REC = { tol: 0.1, cap: 30 };
const setRec = buildSet("w", REC.tol, REC.cap);

/* ── 3. the IWM rule ── */
const homes = {};
for (const p of measured) if (p.role !== "broad" && p.ticker !== "IWM") homes[p.ticker] = HOLD.funds[p.ticker].h;
const inheritedW = new Set(setW.keep);
const iwm = iwmRule(HOLD.funds.IWM.h, homes, inheritedW, main);
const iwmP = parents.find((p) => p.ticker === "IWM");
const iwmServedToday = iwmP.served.names.map(([t, w]) => t);
const iwmOut = iwmServedToday.filter((t) => setW.out.includes(t));

/* ── per-name detail for the in / out lists ── */
const fresh = (t) => { const s = sevenRow.get(t), h = hub.get(t); return { seven_session: s ? s.last_session : null, seven_rungs: s ? s.rungs_count : null, seven: s ? r3(s.composite) : null, hub: h ? r3(h.composite) : null, hub_rungs: h ? h.tf : null }; };
const detail = (t, why) => {
  const hb = (heldBy[t] || []).sort((a, b) => a[2] - b[2]);
  const best = hb[0] || null;
  return { ticker: t, name: label[t] || null, parents: hb.map(([f, w, r]) => ({ fund: f, weight_pct: r2(w), rank: r })), best_rank: best ? { fund: best[0], rank: best[2], weight_pct: r2(best[1]) } : null,
    needed_by: why ? why.parents : [], lists: why ? why.lists : [], cohort: why ? (cohortMembers.get(t) || []) : [], ...fresh(t) };
};
const outRows = setW.out.map((t) => detail(t, null));
const inRows = setW.in.map((t) => detail(t, setW.why[t]));
const inEquity = inRows.filter((r) => r.seven_session != null);
const inNoReading = inRows.filter((r) => r.seven_session == null);
const recOutRows = setRec.out.map((t) => detail(t, null));
const recInRows = setRec.in.map((t) => detail(t, setRec.why[t]));

/* ── the parents whose strong-N is not met today (names to admit, per parent) ── */
const underServed = measured.filter((p) => typeof p.strong.w === "number" && p.ticker !== "IWM").map((p) => ({ ticker: p.ticker, role: p.role, strong_w: p.strong.w, missing: p.top_needed_w.filter(([, , s]) => !s).map(([t, w]) => [t, w]) })).filter((p) => p.missing.length);
const overServedParents = measured.map((p) => ({ ticker: p.ticker, role: p.role, served: p.served.count, strong_w: p.strong.w, strong_eq: p.strong.eq }));

/* ── cost side ── */
const RUNGS = 7;
const cost = { served_now: universe.size, proposed: setW.proposed_count, names_now: universe.size - [...universe].filter((t) => funds.has(t)).length, names_proposed: setW.keep.length, funds_kept: funds.size,
  geiger_runner_rung_computations_now: HUB.rungs_computed, geiger_runner_rung_computations_proposed: setW.proposed_count * RUNGS, stream_live_lines_now: universe.size, stream_live_lines_proposed: setW.proposed_count };

/* ── write ── */
const rule = [
  "1. The parents are the funds on the tree that have a holdings file (51 today, FMP holdings of 26 Sep) and the eleven sector headings, each read through its sector fund (XLK, XLF, XLV, XLE, XLI, XLP, XLY, XLU, XLB, XLRE, XLC).",
  `2. Every parent gets a measured N: the smallest N on the ladder ${GRID.join("/")} whose top-N-by-weight aggregate stays within ${TOL} of the aggregate of ALL its holdings — on the seven-rung close reading and on at least ${Math.round(PASS_SHARE * 100)}% of the extra draws (the seven rungs of that close and the five daily three-rung closes; 12 draws today, days as they accumulate).`,
  "3. A name is served live on the Hub if it is inside the top-N of a parent (by weight), or on LIKED / FAVORITES / RADAR, or a member of an adopted cohort (the registry, step 1).",
  "4. IWM admits nothing by itself: an IWM name is served only where another parent, a list or a cohort places it (Alan, 2 Oct: 'put the IWM names that belong to other areas where they coincide'). The same holds for every parent the ladder cannot reproduce (its N is 'more than 100'): it is spread out the way IWM is, its names are served where other parents need them, its own line stays on the Hub as its bar, and its full aggregate is read off-Hub nightly.",
  "5. Every fund on the tree stays served: the parents are Hub lines in their own right, and their own Geiger is the check on the aggregate.",
  "6. Everything else is off-Hub: the nightly seven-rung close reading covers it (5,560 instruments today), the tree shows it there, and nothing is lost — it is read once a day instead of live.",
  "7. Re-measured nightly after the seven-rung run. A name changes side only when its status has held for five consecutive closes, so the Hub does not churn on one day's reading (this guard is the builder's addition, not Alan's words).",
  "8. A fund with no holdings file (87 today) keeps its served names as they are until its holdings are fetched; it is listed, not guessed.",
];
const servedSetOut = {
  artifact_kind: "SCINTILLA_SERVED_SET_PROPOSAL", status: "PROPOSED — nothing here is written to the universe, a table, the registry or the tree; Alan decides",
  built_utc: new Date().toISOString(), tolerance: TOL, pass_share: PASS_SHARE, grid: GRID, aggregate_used: "weight-blended (equal-weight set beside it)",
  rule, counts: { served_now: universe.size, names_now: cost.names_now, funds_now: universe.size - cost.names_now, proposed: setW.proposed_count, names_proposed: setW.keep.length, funds_proposed: funds.size, out: setW.out.length, in: setW.in.length, in_with_reading: inEquity.length, in_without_reading: inNoReading.length, proposed_equal_weight: setEq.proposed_count, out_equal_weight: setEq.out.length, in_equal_weight: setEq.in.length },
  spread_out_parents: setW.spread_out, sensitivity,
  recommended: { tolerance: REC.tol, cap: REC.cap, aggregate: "weight-blended", counts: { proposed: setRec.proposed_count, names: setRec.keep.length, funds: funds.size, out: setRec.out.length, in: setRec.in.length }, spread_out_parents: setRec.spread_out, keep: setRec.keep, why: setRec.why, out: recOutRows, in: recInRows },
  keep: setW.keep, why: setW.why, out: outRows, in: inRows, in_equal_weight: setEq.in, out_equal_weight: setEq.out,
  sources: { seven: { as_of: SEVEN.as_of, run_id: SEVEN.seven_run_id, computed_utc: SEVEN.computed_utc }, daily_three_rung: DAILY.dates, holdings: HOLD.as_of, hub_geiger_computed_utc: HUB.computed_utc, universe_sha256: UL.universe_sha256, tree_built: TREE.built_utc, lists_read: "2 Oct 2026 ~19:20Z" },
};
const measure = {
  what: "U2 · the served set decided by its parents · measurements (2 Oct 2026) · PROPOSED, nothing deployed", built_utc: servedSetOut.built_utc,
  tolerance: TOL, pass_share: PASS_SHARE, grid: GRID, draws: drawLabels, limits: [
    "Only ONE seven-rung close run exists (2 Oct 00:17Z, as of the 1 Oct close): the endpoint and massive_stocks.scout_geiger_seven hold the same run. The brief hoped for the 30 Sep close too; it is not there.",
    "The '9 days out of 10' test therefore runs on 12 draws that are not days: the seven rungs of the 1 Oct close plus the five daily three-rung closes (25, 28, 29, 30 Sep, 1 Oct). The day test proper starts when the seven-rung table has ten closes.",
    "Holdings exist for 51 of the 138 tree funds (the 26 Sep FMP file); public.etf_holdings holds one fund (AGIX, July). The other 87 funds cannot be measured and keep their names.",
    "The Hub's live /geiger is intraday (computed 2 Oct 19:15Z, seven rungs) while the seven-rung close reading is the 1 Oct close: the two are shown side by side, never mixed in one aggregate.",
  ],
  parents, headings, iwm: { ...iwm, both_homes: iwm.both_homes.map((x) => ({ ...x, weight_pct: r2(x.weight_pct) })), iwm_only: iwm.iwm_only.map((x) => ({ ...x, weight_pct: r2(x.weight_pct) })), iwm_only_weight_pct: r2(iwm.iwm_only_weight_pct), both_weight_pct: r2(iwm.both_weight_pct), full: { eq: r3(iwm.full.eq), w: r3(iwm.full.w), count: iwm.full.count }, inherited: { eq: r3(iwm.inherited.eq), w: r3(iwm.inherited.w), count: iwm.inherited.count, weight_pct: r2(iwm.inherited.weight_pct) }, gap: { eq: r3(iwm.gap.eq), w: r3(iwm.gap.w) }, served_today: iwmServedToday.length, served_today_out: iwmOut.length, strong: iwmP.strong },
  under_served: underServed, parents_served_vs_strong: overServedParents, cost, spread_out_parents: setW.spread_out, sensitivity,
  today_strong: { w: measured.filter((p) => p.served_today_draws.strong_w).length, eq: measured.filter((p) => p.served_today_draws.strong_eq).length, within_tol_on_close_w: measured.filter((p) => p.gap_today.served_vs_full_w != null && Math.abs(p.gap_today.served_vs_full_w) <= TOL).length, of: measured.length },
  recommended: { tolerance: REC.tol, cap: REC.cap, counts: { proposed: setRec.proposed_count, names: setRec.keep.length, out: setRec.out.length, in: setRec.in.length }, spread_out_parents: setRec.spread_out, cost: { geiger_runner_rung_computations_proposed: setRec.proposed_count * RUNGS, stream_live_lines_proposed: setRec.proposed_count } },
};
writeFileSync(join(DIR, "measure.json"), JSON.stringify(measure));
writeFileSync(join(DIR, "served-set.json"), JSON.stringify(servedSetOut, null, 1));
console.log(JSON.stringify({ parents_measured: measured.length, parents_unmeasured: parents.length - measured.length, counts: servedSetOut.counts, today_strong: measure.today_strong, recommended: measure.recommended, rec_in_by_parent: Object.entries(recInRows.reduce((m, r) => { const k = r.needed_by[0] ? r.needed_by[0].parent : (r.lists.length ? "list" : "cohort"); m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]), rec_out: recOutRows.map((r) => r.ticker), cost, spread_out: setW.spread_out, sensitivity, iwm: { both: iwm.both_homes.length, only: iwm.iwm_only.length, only_w: r2(iwm.iwm_only_weight_pct), gap: measure.iwm.gap, inherited_count: iwm.inherited.count, served_today: iwmServedToday.length, served_today_out: iwmOut.length }, under_served: underServed.map((u) => [u.ticker, u.strong_w, u.missing.length]), out: outRows.map((r) => r.ticker), in_sample: inRows.slice(0, 40).map((r) => [r.ticker, (r.needed_by[0] || {}).parent, r.seven_session]) }, null, 1));
console.log("per parent (w): ticker role served strongW strongEq sd gapServedVsFullW gapServedVsOwnW ownSeven fullW servedW | N@0.075 N@0.10 N@0.15");
for (const p of measured) console.log([p.ticker, p.role, p.served.count, p.strong.w, p.strong.eq, p.spread.sd, p.gap_today.served_vs_full_w, p.gap_today.served_vs_own_w, p.own.seven, p.full.w, p.served.w, "|", p.strong_by_tolerance["0.075"].w, p.strong_by_tolerance["0.1"].w, p.strong_by_tolerance["0.15"].w].join("\t"));
