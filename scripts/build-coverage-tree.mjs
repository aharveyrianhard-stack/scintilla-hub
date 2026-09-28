#!/usr/bin/env node
/* COVERAGE TREE (28 Sep, lane L3) — how well the names we serve cover each fund, and a Geiger tree that runs
   market → regions/asset classes → sector funds → industry/theme funds → Alan's cohorts (with ETF parents) → names.

   Reads (all snapshots in deliverables/20260928/coverage-tree/data/, nothing live at build time):
     holdings.json                 125 funds' holdings as [ticker, weight %] (51 from the 26 Sep FMP file, 74 pulled 28 Sep on Fly)
     universe-20260928.json        the chart API's /universe: 486 served symbols and their tiers
     geiger-snapshot-20260928.json the chart API's /geiger at build time (the page reads live and falls back to this)
     ticker_cohorts-20260928.json  Supabase ticker_cohorts (COHSETS), 1,282 rows
     ../market-map-r3/nodes.json   the r3 tree (544 nodes): the structure this tree grows from
     data/taxonomy-rules-20260924.json  the 30 theme branches (quantum, space, …) seeded from the cohorts
     data/standard-tree-20260924.json   GICS sector per served company
     data/cohort-label-origin-20260924.json  which cohort labels are machine-made FMP industry names
   Optional: CANDLES_DIR (daily bars per served symbol, [t,o,h,l,c,v]) → the tracking study. Without it, tracking is skipped.

   Writes deliverables/20260928/coverage-tree/coverage-tree.json (nodes + coverage + tracking + admissions).
   Usage: CANDLES_DIR=… node scripts/build-coverage-tree.mjs */
import { readFileSync, writeFileSync, existsSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const DIR = join(ROOT, "deliverables/20260928/coverage-tree");
const D = (f) => JSON.parse(readFileSync(join(DIR, "data", f), "utf8"));
const R = (f) => JSON.parse(readFileSync(join(ROOT, f), "utf8"));
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const r3 = (x) => Math.round(x * 1e3) / 1e3;

const HOLD = D("holdings.json").data;
const UNI = D("universe-20260928.json");
const GEI = D("geiger-snapshot-20260928.json");
const TC = D("ticker_cohorts-20260928.json");
const R3 = R("deliverables/20260928/market-map-r3/nodes.json");
const RULES = R("data/taxonomy-rules-20260924.json");
const STD = R("data/standard-tree-20260924.json");
const ORIGIN = R("data/cohort-label-origin-20260924.json");
const { rungReading } = await import(pathToFileURL(join(ROOT, "deliverables/20260927/geiger-review/geiger-replay.mjs")));

const SERVED = new Set(UNI.symbols);
const TIER = {}; for (const [tier, list] of Object.entries(UNI.tiers || {})) if (Array.isArray(list)) for (const s of list) TIER[s] = tier;
const GS = GEI.symbols || {};
const gOf = (t) => (GS[t] && Number.isFinite(GS[t].composite) ? GS[t].composite : null);
const usTicker = (t) => (/^[A-Z]{1,5}\.[A-Z]$/.test(t) ? t.replace(".", "-") : t);
const GICS = {}; for (const n of (Array.isArray(STD.names) ? STD.names : Object.values(STD.names))) GICS[n.ticker] = { sector: n.gics_sector, industry: n.gics_industry, name: n.name, cap: n.cap };
const NAMES = {}; for (const n of R3.nodes) if (n.ticker) NAMES[n.ticker] = n.label;
const fundNodes = R3.nodes.filter((n) => n.kind === "fund");
const byId = new Map(R3.nodes.map((n) => [n.id, n]));
const SECTOR_HEAD = { "Information Technology": "SEC_TECH", Financials: "SEC_FIN", "Health Care": "SEC_HLTH", Energy: "SEC_ENGY", Industrials: "SEC_INDU",
  "Consumer Staples": "SEC_STPL", "Consumer Discretionary": "SEC_DISC", Utilities: "SEC_UTIL", Materials: "SEC_MATL", "Real Estate": "SEC_REIT", "Communication Services": "SEC_COMM" };

/* ---------- 1 · coverage per fund ---------- */
function coverage(ticker) {
  const h = HOLD[ticker]; if (!h) return null;
  const negRows = h.h.filter(([, w]) => !(w > 0)).length;                 // short / hedge lines (MAGS carries a −51% row): not coverage
  const rows = h.h.filter(([, w]) => w > 0).map(([t, w]) => [usTicker(t), w]);
  const total = rows.reduce((s, [, w]) => s + w, 0);
  const denom = Math.max(100, total);
  const servedMap = new Map(); const missed = [];
  for (const [t, w] of rows) { if (SERVED.has(t)) servedMap.set(t, (servedMap.get(t) || 0) + w); else missed.push([t, w]); }
  const served = [...servedMap].sort((a, b) => b[1] - a[1]);
  const sw = served.reduce((s, [, w]) => s + w, 0);
  missed.sort((a, b) => b[1] - a[1]);
  const top10 = rows.slice().sort((a, b) => b[1] - a[1]).slice(0, 10);
  const top10served = top10.filter(([t]) => SERVED.has(t));
  const thin = served.filter(([, w]) => w < 0.5);
  return {
    ticker, rows_in_file: rows.length, rows_dropped_nonpositive: negRows, fund_lines: h.n, file_total_pct: r3(total), file_short: total < 98, source: h.source, updated: h.updated || "2026-09-26",
    served_count: served.length, served_weight_pct: r3(sw), coverage_pct: r3((100 * sw) / denom),
    served: served.map(([t, w]) => [t, r4(w)]),
    top10_served: top10served.length, top10_weight_pct: r3(top10.reduce((s, [, w]) => s + w, 0)),
    top10_served_weight_pct: r3(top10served.reduce((s, [, w]) => s + w, 0)),
    missed_top: missed.slice(0, 15).map(([t, w]) => [t, r4(w), (HOLD_NAME(t) || "")]),
    missed_count: missed.length, missed_weight_pct: r3(missed.reduce((s, [, w]) => s + w, 0)),
    thin_served_count: thin.length, thin_served_weight_pct: r3(thin.reduce((s, [, w]) => s + w, 0)),
    weight_per_served_name_pct: served.length ? r3(sw / served.length) : null,
  };
}
const NAMEFILE = (() => { try { const s = readFileSync(join(process.env.HOME, "Library/Application Support/scintilla/market-map/pplx-holdings.js"), "utf8"); const i = s.indexOf("const NAMES="); const j = s.indexOf("};", i); return JSON.parse(s.slice(i + 12, j + 1)); } catch { return {}; } })();
function HOLD_NAME(t) { return NAMEFILE[t] || NAMEFILE[t.replace("-", ".")] || null; }

const COV = {}; for (const f of fundNodes) { const c = coverage(f.ticker); if (c) COV[f.ticker] = c; }

/* ---------- 2 · tracking: daily-rung Geiger replay, fund vs its served holdings blended by weight ---------- */
const CANDLES = process.env.CANDLES_DIR && existsSync(process.env.CANDLES_DIR) ? process.env.CANDLES_DIR : null;
const WINDOW = 230, SESSIONS = 500, NEAR_CORR = 0.02, NEAR_MAE = 0.02, GOOD = 0.9, FAIR = 0.8;
let SERIES = null, DATES = null, TRACK = {};
if (CANDLES) {
  const raw = {};
  for (const f of readdirSync(CANDLES)) if (f.endsWith(".json")) { const j = JSON.parse(readFileSync(join(CANDLES, f), "utf8")); raw[j.symbol] = j.series; }
  // dates = SPY's last SESSIONS sessions (needs WINDOW bars before each)
  const spy = raw.SPY; const spyDates = spy.map((b) => new Date(b[0]).toISOString().slice(0, 10));
  DATES = spyDates.slice(-SESSIONS);
  SERIES = {};
  for (const [s, bars] of Object.entries(raw)) {
    const idx = new Map(bars.map((b, i) => [new Date(b[0]).toISOString().slice(0, 10), i]));
    const out = new Array(DATES.length).fill(null); let full = true;
    for (let k = 0; k < DATES.length; k++) {
      const i = idx.get(DATES[k]);
      if (i == null || i + 1 < WINDOW) { full = false; continue; }
      const win = bars.slice(i + 1 - WINDOW, i + 1).map((b) => ({ c: b[4], h: b[2], l: b[3] }));
      const r = rungReading(win); out[k] = r ? r.composite : null; if (out[k] == null) full = false;
    }
    SERIES[s] = { v: out, full };
  }
  const stats = (F, B) => { let n = 0, sf = 0, sb = 0, sff = 0, sbb = 0, sfb = 0, mae = 0, sign = 0; for (let k = 0; k < F.length; k++) { const f = F[k], b = B[k]; if (f == null || b == null) continue; n++; sf += f; sb += b; sff += f * f; sbb += b * b; sfb += f * b; mae += Math.abs(f - b); if ((f >= 0) === (b >= 0)) sign++; } if (n < 50) return null; const cov = sfb / n - (sf / n) * (sb / n), vf = sff / n - (sf / n) ** 2, vb = sbb / n - (sb / n) ** 2; return { n, corr: vf > 0 && vb > 0 ? cov / Math.sqrt(vf * vb) : null, mae: mae / n, sign: sign / n }; };
  for (const [ticker, c] of Object.entries(COV)) {
    const fund = SERIES[ticker]; if (!fund || !fund.full) { TRACK[ticker] = { skipped: fund ? "fund history shorter than the study window" : "fund not served (no bars)" }; continue; }
    const F = fund.v;
    const members = c.served.filter(([t]) => SERIES[t] && SERIES[t].full && t !== ticker);
    const shortHist = c.served.filter(([t]) => !(SERIES[t] && SERIES[t].full) && t !== ticker).map(([t]) => t);
    if (!members.length) { TRACK[ticker] = { skipped: "no served holding with a full history", short_history: shortHist }; continue; }
    const T = F.length;
    const blend = (sum, W) => sum.map((x) => (W > 0 ? x / W : null));
    // full served set
    const sumAll = new Array(T).fill(0); let WAll = 0;
    for (const [t, w] of members) { const v = SERIES[t].v; for (let k = 0; k < T; k++) sumAll[k] += w * v[k]; WAll += w; }
    const full = stats(F, blend(sumAll, WAll));
    // forward greedy: add the name that most raises the correlation with the fund, until the set is within NEAR_CORR / NEAR_MAE
    // of the full served set (the point of diminishing returns). The level gap (MAE) is structural: a fund's own Geiger is not a
    // linear blend of its members' Geigers (fan ordering and RSI are non-linear), so correlation and sign agreement are the read.
    const done = (s) => s && s.corr >= full.corr - NEAR_CORR && s.mae <= full.mae + NEAR_MAE;
    const chosen = []; const left = new Set(members.map(([t]) => t)); const wOf = Object.fromEntries(members);
    let sum = new Array(T).fill(0), W = 0, cur = null, steps = [];
    while (left.size && !done(cur)) {
      let best = null;
      for (const t of left) { const v = SERIES[t].v, w = wOf[t]; const B = new Array(T); for (let k = 0; k < T; k++) B[k] = (sum[k] + w * v[k]) / (W + w); const s = stats(F, B); if (s && (!best || s.corr > best.s.corr)) best = { t, s }; }
      if (!best) break;
      const v = SERIES[best.t].v, w = wOf[best.t]; for (let k = 0; k < T; k++) sum[k] += w * v[k]; W += w; left.delete(best.t); chosen.push(best.t); cur = best.s;
      steps.push({ add: best.t, weight_pct: r4(w), corr: r4(cur.corr), mae: r4(cur.mae) });
    }
    const tracks = done(cur);
    const verdict = full.corr >= GOOD ? "GOOD" : full.corr >= FAIR ? "FAIR" : "POOR";
    TRACK[ticker] = {
      sessions: full.n, window_bars: WINDOW, members_in_study: members.length, short_history: shortHist,
      full_set: { corr: r4(full.corr), mae: r4(full.mae), sign_agreement: r4(full.sign), weight_pct: r3(WAll) },
      verdict, verdict_rule: { GOOD: ">= " + GOOD + " correlation", FAIR: ">= " + FAIR, POOR: "below " + FAIR }, near: { corr: NEAR_CORR, mae: NEAR_MAE },
      tracks, smallest_set: chosen, smallest_set_n: chosen.length, smallest_set_weight_pct: r3(chosen.reduce((s, t) => s + wOf[t], 0)),
      smallest_set_stats: cur ? { corr: r4(cur.corr), mae: r4(cur.mae), sign_agreement: r4(cur.sign) } : null,
      redundant_for_tracking: tracks ? [...left] : [], steps: steps.slice(0, 40),
    };
  }
}

/* ---------- 3 · cohorts: registry, members, ETF parents ---------- */
const machine = new Set((ORIGIN.machine_made || []).map((m) => m.cohort));
for (const k of ["RENEWABLE_UTILITIES", "SILVER", "GOLD", "COPPER", "URANIUM", "SOLAR", "STEEL"]) machine.add(k); // FMP industry labels in the table
for (const n of (Array.isArray(STD.names) ? STD.names : Object.values(STD.names))) if (n.fmp_industry) machine.add(String(n.fmp_industry).toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/_+$/, ""));
const SECTOR_KEYS = { TECH: "SEC_TECH", FINANCIALS: "SEC_FIN", HEALTH: "SEC_HLTH", ENERGY: "SEC_ENGY", INDUSTRIAL: "SEC_INDU", STAPLES: "SEC_STPL", DISCRET: "SEC_DISC", UTILITIES: "SEC_UTIL", MATERIALS: "SEC_MATL", REAL_ESTATE: "SEC_REIT", COMMS: "SEC_COMM" };
const TABS = ["AI_HARDWARE", "AI_SOFTWARE", "MEGACAP", "BLUE_CHIP", "GROWTH", "CRYPTO", "INTL", "MACRO", "INDEXES", "THEMATIC", "METALS", "AI_POWERTRAIN"];
const COHSETS = {}; for (const r of TC) { (COHSETS[r.cohort] ||= new Set()).add(r.ticker); }
const cohorts = [];
for (const [key, set] of Object.entries(COHSETS)) {
  if (machine.has(key) || SECTOR_KEYS[key] || /___|&|,/.test(key)) continue; // FMP industry labels (also by their spelling) and the eleven sectors are not Alan's cohorts
  const members = [...set].filter((t) => SERVED.has(t)).sort();
  if (!members.length) continue;
  cohorts.push({ key, label: key.replace(/_/g, " "), origin: TABS.includes(key) ? "board tab (COHORTS list in index.html)" : "ticker_cohorts, chosen by hand", members, listed: set.size });
}
for (const b of RULES.branches) {                                       // the 24 Sep theme branches (quantum, space, photonics …)
  const fromSeeds = (b.seed_cohorts || []).flatMap((c) => [...(COHSETS[c] || [])]);
  const all = [...new Set([...(b.tickers || []), ...fromSeeds])];
  const members = all.filter((t) => SERVED.has(t)).sort();
  if (!members.length) continue;
  if (cohorts.some((c) => c.key === b.id)) continue;
  cohorts.push({ key: b.id, label: b.label, origin: "theme branch (data/taxonomy-rules-20260924.json)" + (b.seed_cohorts ? ", seeded from " + b.seed_cohorts.join("/") : ""), members, listed: all.length, not_served: all.filter((t) => !SERVED.has(t)) });
}
const BROAD = new Set(["SPY", "VTI", "ITOT", "IWV", "RSP", "VT", "VXUS", "QQQ", "QQEW", "QQQE", "VUG", "VTV", "MGK", "SCHD", "SPLV", "QUAL", "MTUM", "DIA", "MDY", "IWM", "IJR", "MAGS", "EFA", "EZU", "EWG", "EWU", "EWJ", "EEM", "FXI", "MCHI", "ASHR", "EWY"]);
const SIZE_LIKE = new Set(["LARGE_CAP", "MID_CAP", "SMALL_CAP", "MEGA_CAP", "MEGACAP", "BLUE_CHIP", "GROWTH", "INDEXES", "INTL", "MACRO", "THEMATIC", "MEGACAP_PLATFORMS"]);
const HOLDSET = {}; for (const [f, h] of Object.entries(HOLD)) { const m = new Map(); for (const [t, w] of h.h) { const u = usTicker(t); m.set(u, (m.get(u) || 0) + w); } HOLDSET[f] = m; }
for (const c of cohorts) {
  const cands = [];
  for (const [f, m] of Object.entries(HOLDSET)) {
    if (BROAD.has(f) && !SIZE_LIKE.has(c.key)) continue;
    const held = c.members.filter((t) => m.has(t)); if (!held.length) continue;
    const conc = held.reduce((s, t) => s + m.get(t), 0);
    const share = held.length / c.members.length;
    // fit = (share of the cohort's members the fund holds) × (share of the fund that those members are): a theme fund that is
    // mostly the cohort beats a broad fund that happens to hold everyone at a hundredth of a percent each
    cands.push({ fund: f, held: held.length, share: r3(share), fund_weight_in_cohort_pct: r3(conc), fit: r3(share * conc) });
  }
  cands.sort((a, b) => b.fit - a.fit);
  const MIN_FIT = 1;                                                     // share × weight ≥ 1: a fund that is 3% the cohort and holds a third of it
  const pick = cands.find((x) => x.held >= 2 && x.share >= 1 / 3 && x.fit >= MIN_FIT) || null;
  c.parent_candidates = cands.slice(0, 5);
  if (pick) { c.etf_parent = pick.fund; c.etf_parent_share = pick.share; c.etf_parent_weight_pct = pick.fund_weight_in_cohort_pct; c.etf_parent_fit = pick.fit; }
  else { c.etf_parent = null; c.no_parent_reason = cands[0] ? (cands[0].held >= 2 && cands[0].share >= 1 / 3 ? `the best fund, ${cands[0].fund}, holds ${cands[0].held} of ${c.members.length} members but they are only ${cands[0].fund_weight_in_cohort_pct}% of it` : `the best fund, ${cands[0].fund}, holds only ${cands[0].held} of ${c.members.length} members`) : "no fund with holdings holds any member"; }
  // sector home = majority GICS sector of members (funds count as none)
  const sec = {}; for (const t of c.members) { const g = GICS[t]; if (g && g.sector) sec[g.sector] = (sec[g.sector] || 0) + 1; }
  c.sector_majority = Object.entries(sec).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

/* ---------- 4 · the tree ---------- */
const nodes = R3.nodes.map((n) => ({ ...n, parents: [...n.parents] }));
const fundIdOf = {}; for (const n of nodes) if (n.kind === "fund") fundIdOf[n.ticker] = n.id;
for (const n of nodes) if (n.kind === "fund" && COV[n.ticker]) {
  const c = COV[n.ticker];
  n.holdings = { ...(n.holdings || {}), rows_in_file: c.rows_in_file, total_weight_pct: c.file_total_pct, served_weights: c.served, coverage_pct: c.coverage_pct, source: c.source, updated: c.updated };
  if (TRACK[n.ticker]) n.tracking = TRACK[n.ticker];
}
const NO_PARENT_HEAD = "COHORTS_NO_ETF";
nodes.push({ id: NO_PARENT_HEAD, ticker: null, label: "Cohorts with no ETF parent", parents: ["US"], kind: "index", issuer: null, served: false, tier: null, planned_tier: null,
  admission: "a heading: these cohorts of Alan's have no fund that holds at least half their members", market_value_usd: null, holdings: null });
for (const c of cohorts) {
  const id = "COH_" + c.key;
  const parent = c.etf_parent && fundIdOf[c.etf_parent] ? fundIdOf[c.etf_parent] : (c.sector_majority && SECTOR_HEAD[c.sector_majority] && !c.etf_parent ? NO_PARENT_HEAD : NO_PARENT_HEAD);
  nodes.push({ id, ticker: null, label: c.label, parents: [parent], kind: "cohort", cohort_key: c.key, origin: c.origin, members: c.members, listed: c.listed, not_served: c.not_served || [],
    etf_parent: c.etf_parent, etf_parent_share: c.etf_parent_share ?? null, etf_parent_weight_pct: c.etf_parent_weight_pct ?? null, parent_candidates: c.parent_candidates, no_parent_reason: c.no_parent_reason || null,
    sector_majority: c.sector_majority, served: false, tier: null, planned_tier: null, admission: "a cohort: its bar is the plain mean of its members' Geigers", market_value_usd: null, holdings: null });
  for (const t of c.members) { const nn = nodes.find((x) => x.ticker === t && x.kind !== "cohort"); if (nn && !nn.parents.includes(id)) nn.parents.push(id); }
}
// names: GICS + the funds that hold them (for MDB / APLD and the card)
for (const n of nodes) if (n.kind === "name" || (n.kind === "fund" && n.ticker)) {
  const t = n.ticker; const inFunds = [];
  for (const [f, m] of Object.entries(HOLDSET)) if (m.has(t)) inFunds.push([f, r4(m.get(t))]);
  inFunds.sort((a, b) => b[1] - a[1]);
  n.in_funds = inFunds.slice(0, 12);
  if (GICS[t]) n.gics = GICS[t];
  n.cohorts = cohorts.filter((c) => c.members.includes(t)).map((c) => c.key);
}

/* ---------- 5 · admissions proposal (propose, don't admit) ---------- */
const PRIORITY = ["IWM", "IJR", "MDY", "IGV", "QQQ", "SPY", "IYW", "VGT", "IYF", "VFH", "IYH", "VHT", "IYJ", "VIS", "IYC", "VCR", "IYK", "VDC", "IYE", "VDE", "IDU", "VPU", "IYM", "VAW", "IYR", "VNQ", "IYZ", "VOX", "SMH", "SOXX", "IBB", "XBI", "KRE", "KBE", "IHI", "ITA"];
const adm = new Map();
for (const f of PRIORITY) { const c = COV[f]; if (!c) continue; for (const [t, w, name] of c.missed_top.slice(0, 10)) { const a = adm.get(t) || { ticker: t, name: name || HOLD_NAME(t), adds: [], max_weight_pct: 0, sum_weight_pct: 0 }; a.adds.push([f, w]); a.max_weight_pct = Math.max(a.max_weight_pct, w); a.sum_weight_pct = r3(a.sum_weight_pct + w); adm.set(t, a); } }
const admissions = [...adm.values()].filter((a) => /^[A-Z]{1,5}(-[A-Z])?$/.test(a.ticker)).sort((a, b) => b.sum_weight_pct - a.sum_weight_pct);

/* ---------- write ---------- */
const out = {
  artifact_kind: "SCINTILLA_COVERAGE_TREE", built_utc: new Date().toISOString(),
  what: "Coverage of each fund by the names we serve, the smallest served set that tracks each fund's Geiger, and a Geiger tree down to Alan's cohorts with their ETF parents. Structure + snapshots only: the page reads the live Geiger and falls back to the snapshot.",
  provenance: { universe: { source: "https://scintilla-massive-chart-api.fly.dev/universe", count: UNI.count, sha256: UNI.universe_sha256, tiers: Object.fromEntries(Object.entries(UNI.tiers || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : v])) },
    geiger_snapshot: { computed_utc: GEI.computed_utc, rungs: (GEI.participating_rungs || []).map((r) => r.equalizer_key) },
    holdings: { funds: Object.keys(HOLD).length, from_file_26sep: Object.values(HOLD).filter((h) => !h.updated).length, fresh_28sep: Object.values(HOLD).filter((h) => h.updated).length },
    cohorts: { ticker_cohorts_rows: TC.length, distinct: Object.keys(COHSETS).length, machine_made_skipped: [...Object.keys(COHSETS)].filter((k) => machine.has(k)).length, sector_keys_skipped: Object.keys(SECTOR_KEYS).filter((k) => COHSETS[k]).length, cohort_nodes: cohorts.length },
    structure: { source: "deliverables/20260928/market-map-r3/nodes.json", nodes: R3.nodes.length },
    tracking: CANDLES ? { sessions: SESSIONS, window_bars: WINDOW, dates: [DATES[0], DATES[DATES.length - 1]], method: "daily-rung Geiger replay (geiger-replay.mjs rungReading on the newest 230 daily bars, each session); fund vs its served holdings blended by weight; forward greedy adds the name that most raises the correlation until the set is within 0.02 correlation and 0.02 MAE of the full served set; verdict GOOD/FAIR/POOR by the full set's correlation (0.9 / 0.8)", verdict: { GOOD, FAIR }, near: { corr: NEAR_CORR, mae: NEAR_MAE } } : null },
  counts: { nodes: nodes.length, cohorts: cohorts.length, cohorts_with_parent: cohorts.filter((c) => c.etf_parent).length, cohorts_without_parent: cohorts.filter((c) => !c.etf_parent).length, funds_with_coverage: Object.keys(COV).length, funds_with_tracking: Object.values(TRACK).filter((t) => !t.skipped).length, admissions_proposed: admissions.length },
  coverage: COV, tracking: TRACK, cohorts, admissions, nodes,
};
writeFileSync(join(DIR, "coverage-tree.json"), JSON.stringify(out, null, 1) + "\n");
console.log(JSON.stringify(out.counts));
