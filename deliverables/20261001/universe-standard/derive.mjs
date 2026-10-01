#!/usr/bin/env node
/* U1 · THE UNIVERSE STANDARD (1 Oct 2026) · the derivations behind the page. DESIGN RUN: reads dated snapshots, writes
   derived-20261001.json next to this file. Nothing here touches a table, R2, Fly or a browser.

   Inputs (all read-only, all dated):
   - data/company_profile-20261001.json   public.company_profile (543 rows, the Hub's public read, 1 Oct 16:40Z)
   - data/fmp_peers-20261001.json         public.fmp_peers (4,455 rows, 452 companies, FMP /stable/stock-peers, loaded 1 Oct)
   - data/tickers-board-20261001.json     public.tickers (613 rows: the board's cohort tag)
   - data/filer_currency-20261001.json    public.filer_currency (36 rows)
   - data/sources-probe-20261001.json     keyed reads on Fly, 1 Oct: Massive SIC + market cap for 100 names, Massive related
                                          for the six worked names, FMP screener for four industries, FMP profile for four
   - data/scout-geiger-20260930.json      chart API /v1/scout-geiger (the three-rung scout, as of the 30 Sep close), 590 only
   - data/hub-geiger-20261001.json        chart API /geiger (the Hub Geiger, 590 served, computed 1 Oct)
   - ../../20260929/tree-map/tree.json    the tree with its cohort level (T1b/T3) — funds with served holdings, held_by, cohorts
   - ../../20260928/tree-cohorts/proposed-cohorts.json  the 28 Sep proposal (rules R1–R8)
   - --closes <file>                      daily closes, 130 sessions, from chart API /candles-multi (kept out of the repo)
   The comparable-set rule is C4's peers.mjs (branch hub/comps-mechanic-20261001), copied here unchanged as peers-c4.mjs. */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { candidates, select, BAND_DEFAULT, N_DEFAULT } from "./peers-c4.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const J = (p) => JSON.parse(readFileSync(join(HERE, p), "utf8"));
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };

const PROF = J("data/company_profile-20261001.json");
const PEERS = J("data/fmp_peers-20261001.json");
const BOARD = J("data/tickers-board-20261001.json");
const FILER = J("data/filer_currency-20261001.json");
const PROBE = J("data/sources-probe-20261001.json");
const SCOUT = J("data/scout-geiger-20260930.json");
const HUBG = J("data/hub-geiger-20261001.json");
const TREE = J("../../20260929/tree-map/tree.json");
const PROP = J("../../20260928/tree-cohorts/proposed-cohorts.json");
const CLOSES = arg("--closes") ? JSON.parse(readFileSync(arg("--closes"), "utf8")) : null;

const SIX = ["LRCX", "MSFT", "TSM", "MU", "JPM", "XOM"];
const norm = (t) => String(t).toUpperCase().replace(".", "-");          // Massive BRK.B = Hub BRK-B

/* ---------- the served universe and the readings ---------- */
const served = new Set(Object.keys(HUBG.symbols));                       // 590
const hub = HUBG.symbols;                                                // T → {composite, trend, momentum}
const scout = Object.fromEntries(SCOUT.rows.map((r) => [r[0], { composite: r[1], trend: r[2], momentum: r[3], rungs: r[4], kind: r[5], last_session: r[6] }]));
const nodes = TREE.nodes, byId = Object.fromEntries(nodes.map((n) => [n.id, n]));
const funds = nodes.filter((n) => n.kind === "fund" && n.holdings && Array.isArray(n.holdings.served_weights)).map((n) => ({ ticker: n.ticker, label: n.label, role: n.role, as_of: n.holdings.as_of, holdings: n.holdings.served_weights.map(([s, w]) => [norm(s), w]) }));
const heldBy = TREE.held_by;                                             // T → [[fund, weight]]
const board = Object.fromEntries(BOARD.map((r) => [r.ticker, r]));
const filer = Object.fromEntries(FILER.map((r) => [r.ticker, r]));
const ref = Object.fromEntries(Object.entries(PROBE.ref).map(([t, r]) => [norm(t), r]));
const profiles = {};
for (const r of PROF) { const T = norm(r.ticker); profiles[T] = { ticker: T, name: r.name, exchange: r.exchange, industry: r.industry || null, sector: r.sector || null, market_cap: Number(r.market_cap) || null, price: r.price, is_etf: r.is_etf === true, is_fund: r.is_fund === true, is_adr: r.is_adr === true, country: r.country || null, cik: r.cik || null, updated_ts: r.updated_ts, sic: ref[T] && ref[T].sic_code ? ref[T].sic_code : null, sic_description: ref[T] && ref[T].sic_description ? ref[T].sic_description : null }; }
const fmpPeers = {}; for (const r of PEERS) (fmpPeers[r.ticker] ||= []).push(r.peer);
const massiveRelated = Object.fromEntries(Object.entries(PROBE.related).map(([t, l]) => [t, [...new Set(l.map(norm))]]));   // Massive repeats AMAT/KLAC for LRCX; de-duplicated, order kept

/* ---------- 1. the placement record: one worked record per name, and field coverage on the 590 ---------- */
const STATUS = { table: "IN A TABLE TODAY", job: "ONE JOB AWAY", new: "NEW" };
function record(T) {
  const p = profiles[T] || {}, r = ref[T] || null, f = filer[T] || null, b = board[T] || null;
  const fundRows = (heldBy[T] || []).map(([fund, w]) => ({ fund, weight_pct: w, source: "FMP holdings", as_of: (funds.find((x) => x.ticker === fund) || {}).as_of || "2026-09-26" }));
  const nameNode = byId[T];
  return {
    ticker: T, as_of: "2026-10-01", served: served.has(T),
    identity: { name: p.name || null, exchange: p.exchange || null, primary_exchange_mic: r ? r.primary_exchange : null, country: p.country || null, is_adr: p.is_adr === true, listing_currency: f ? f.listing_currency : "USD", statement_currency: f ? f.reported_currency : null, statement_date: f ? f.statement_date : null, cik: p.cik || (r ? r.cik : null), _status: { name: STATUS.table, exchange: STATUS.table, country: STATUS.table, is_adr: STATUS.table, listing_currency: STATUS.table, statement_currency: f ? STATUS.table : STATUS.job, primary_exchange_mic: STATUS.job } },
    classification: { sic_code: r ? r.sic_code : null, sic_description: r ? r.sic_description : null, fmp_sector: p.sector || null, fmp_industry: p.industry || null, gics_industry: nameNode ? nameNode.gics_industry || null : null, _status: { sic_code: r && r.sic_code ? "probed 1 Oct · " + STATUS.job : STATUS.job, fmp_industry: STATUS.table, fmp_sector: STATUS.table } },
    size: { market_value_usd: r && r.market_cap ? Math.round(r.market_cap) : p.market_cap || null, source: r && r.market_cap ? "Massive reference (all share classes)" : "FMP profile", date: "2026-10-01", check_fmp_market_cap: p.market_cap || null, check_massive_market_cap: r ? r.market_cap : null, disagreement_pct: r && r.market_cap && p.market_cap ? +((r.market_cap / p.market_cap - 1) * 100).toFixed(1) : null, _status: { market_value_usd: STATUS.job, check_fmp_market_cap: STATUS.table } },
    membership: { funds: fundRows, _status: fundRows.length ? STATUS.table + " (tree.json, FMP holdings 26 Sep)" : STATUS.table },
    relations: { fmp_peers: fmpPeers[T] || [], massive_related: massiveRelated[T] || null, _status: { fmp_peers: STATUS.table, massive_related: massiveRelated[T] ? "probed 1 Oct · " + STATUS.job : STATUS.job } },
    readings: { scout_three_rung: scout[T] || null, hub_geiger: hub[T] || null, seven_rung: null, _status: { scout_three_rung: STATUS.table + " (massive_stocks.scout_geiger_daily, /v1/scout-geiger)", seven_rung: "P8 (table 0025, not applied)", hub_geiger: "live route /geiger, 590 only" } },
    comps_measures_usd: { keys: ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg", "rev_g_ttm", "rev_g_fy", "eps_g_fy", "gm", "om", "fcfm", "nd_ebitda", "capex_rev", "capex_g", "rev_per_capex"], fx: f && f.reported_currency !== "USD" ? `${f.reported_currency}USD at the statement date ${f.statement_date} (public.fx_rates)` : "USD, no conversion", _status: STATUS.job + " (C3's reader computes them on demand today; the record stores them nightly)" },
    board_tag: b ? b.cohort : null,
    tree: nameNode ? { home: nameNode.home_id, home_kind: nameNode.home_kind, home_rule: nameNode.home_rule, also_in: (nameNode.also_in || []).map((a) => a.id), filters: nameNode.filters || [] } : null,
    provenance: { profile: { source: "FMP /stable/profile → public.company_profile", fetched_at: p.updated_ts ? new Date(p.updated_ts * 1000).toISOString() : null }, sic: r ? { source: "Massive /v3/reference/tickers", fetched_at: "2026-10-01T16:45Z (probe)" } : null, peers: { source: "FMP /stable/stock-peers → public.fmp_peers", fetched_at: "2026-10-01T14:14Z" }, related: massiveRelated[T] ? { source: "Massive /v1/related-companies", fetched_at: "2026-10-01T16:45Z (probe)" } : null, holdings: { source: "FMP holdings", as_of: "2026-09-26" }, scout: { source: "/v1/scout-geiger", as_of: SCOUT.as_of, computed_utc: SCOUT.computed_utc }, hub_geiger: { source: "/geiger", computed_utc: HUBG.computed_utc } },
  };
}
const examples = Object.fromEntries(SIX.map((t) => [t, record(t)]));
const servedNames = [...served].filter((t) => profiles[t] && !profiles[t].is_etf && !profiles[t].is_fund);
const servedFunds = [...served].filter((t) => !servedNames.includes(t));
const coverage = {
  served: served.size, served_names: servedNames.length, served_funds: servedFunds.length,
  with_profile: [...served].filter((t) => profiles[t]).length,
  with_fmp_industry: servedNames.filter((t) => profiles[t].industry).length,
  with_market_cap: servedNames.filter((t) => profiles[t].market_cap).length,
  with_fmp_peers: servedNames.filter((t) => fmpPeers[t]).length,
  with_sic_probed: servedNames.filter((t) => profiles[t].sic).length,
  with_fund_membership: [...served].filter((t) => (heldBy[t] || []).length).length,
  with_scout: [...served].filter((t) => scout[t]).length,
  with_hub_geiger: [...served].filter((t) => hub[t]).length,
  with_filer_currency: servedNames.filter((t) => filer[t]).length,
  non_usd_statements: FILER.filter((r) => r.reported_currency !== "USD").map((r) => `${r.ticker} ${r.reported_currency}`),
  profile_industries: new Set(servedNames.map((t) => profiles[t].industry).filter(Boolean)).size,
};

/* ---------- 2. authorities: where two providers disagree ---------- */
const probed = Object.keys(ref).filter((t) => profiles[t] && ref[t].status === "OK");
const sicRows = probed.map((t) => ({ ticker: t, fmp_sector: profiles[t].sector, fmp_industry: profiles[t].industry, sic: ref[t].sic_code, sic_description: ref[t].sic_description, fmp_mcap: profiles[t].market_cap, massive_mcap: ref[t].market_cap ? Math.round(ref[t].market_cap) : null, mcap_gap_pct: ref[t].market_cap && profiles[t].market_cap ? +((ref[t].market_cap / profiles[t].market_cap - 1) * 100).toFixed(1) : null }));
// a disagreement: the same FMP industry carries several SIC codes, or the same SIC code spans several FMP industries
const byInd = {}, bySic = {};
for (const r of sicRows) { if (r.fmp_industry && r.sic) { (byInd[r.fmp_industry] ||= new Set()).add(r.sic); (bySic[r.sic] ||= new Set()).add(r.fmp_industry); } }
const industryDisagreements = sicRows.filter((r) => r.fmp_industry && r.sic && (byInd[r.fmp_industry].size > 1 || bySic[r.sic].size > 1)).map((r) => ({ ...r, note: byInd[r.fmp_industry].size > 1 && bySic[r.sic].size > 1 ? "FMP industry spans several SIC codes and this SIC spans several FMP industries" : byInd[r.fmp_industry].size > 1 ? `FMP's "${r.fmp_industry}" spans SIC ${[...byInd[r.fmp_industry]].join(", ")}` : `SIC ${r.sic} spans FMP ${[...bySic[r.sic]].join(" · ")}` }));
const sicMissing = sicRows.filter((r) => !r.sic).map((r) => r.ticker);
const mcapDisagreements = sicRows.filter((r) => r.mcap_gap_pct != null && Math.abs(r.mcap_gap_pct) >= 2).sort((a, b) => Math.abs(b.mcap_gap_pct) - Math.abs(a.mcap_gap_pct));
const authorities = { probed: probed.length, sic_missing: sicMissing, industry_disagreements: industryDisagreements, industry_groups: Object.fromEntries(Object.entries(byInd).map(([k, v]) => [k, [...v]])), sic_groups: Object.fromEntries(Object.entries(bySic).map(([k, v]) => [k, [...v]])), mcap_disagreements: mcapDisagreements, mcap_within_1pct: sicRows.filter((r) => r.mcap_gap_pct != null && Math.abs(r.mcap_gap_pct) < 1).length, mcap_compared: sicRows.filter((r) => r.mcap_gap_pct != null).length };

/* ---------- 3. comp sets for the six, on C4's rule, with the four votes and the screener's extra names ---------- */
const screenerByIndustry = Object.fromEntries(Object.entries(PROBE.screener).map(([ind, rows]) => [ind, Array.isArray(rows) ? rows.map((r) => ({ ticker: norm(r[0]), name: r[1], market_cap: r[2], exchange: r[5], country: r[6] })) : []]));
const compSets = {};
for (const T of SIX) {
  const sources = { fmp: fmpPeers[T] || [], massive: massiveRelated[T] || [] };
  const cand = candidates(T, { profiles, sources, funds });
  const sel = select(cand, { band: BAND_DEFAULT, n: N_DEFAULT });
  const scr = screenerByIndustry[profiles[T].industry] || null;
  const scrExtra = scr ? scr.filter((r) => r.ticker !== T && !profiles[r.ticker]).map((r) => r.ticker) : null;
  const scrServed = scr ? scr.filter((r) => r.ticker !== T && profiles[r.ticker]).map((r) => r.ticker) : null;
  // the ladder: every candidate with its four votes, sorted by votes then closeness; kept marked
  const keptSet = new Set(sel.kept.map((k) => k.ticker));
  const own = profiles[T].market_cap;
  const ladder = cand.list.map((c) => {
    const p = c.profile || {}, mcap = p.market_cap || null, ratio = own && mcap ? mcap / own : null;
    const votes = { FMP: c.sources.includes("FMP"), MASSIVE: c.sources.includes("MASSIVE"), INDUSTRY: c.sources.includes("INDUSTRY"), FUND: c.sources.includes("FUND") };
    const n = Object.values(votes).filter(Boolean).length;
    const k = sel.kept.find((x) => x.ticker === c.ticker), d = sel.dropped.find((x) => x.ticker === c.ticker);
    return { ticker: c.ticker, votes, n_votes: n, served: c.served, industry: p.industry || null, sic: p.sic || null, market_cap: mcap, ratio, closeness: ratio ? Math.abs(Math.log10(ratio)) : null, kept: keptSet.has(c.ticker), rank: k ? k.rank : null, why: k ? k.match_word : d ? d.why : null, funds: c.funds };
  }).sort((a, b) => b.n_votes - a.n_votes || (a.closeness ?? 9) - (b.closeness ?? 9) || a.ticker.localeCompare(b.ticker));
  // THE STANDARD'S OWN SELECTION (proposed here, differs from C4 in one place): a shared industry fund is a VOTE, never an
  // industry match. keep = same industry by the authority (FMP industry today; the same SIC code counts too) AND inside the
  // band; if fewer than 5 survive ×10 the band widens one step (×30, then any) and the record says so; rank = votes desc,
  // then closeness (|log10 of the size ratio|); the nearest N = 10.
  const sameInd = ladder.filter((r) => r.served && r.industry && (r.industry === profiles[T].industry || (r.sic && profiles[T].sic && r.sic === profiles[T].sic)));
  let bandUsed = null, inBand = [];
  for (const b of [10, 30, 1e9]) { inBand = sameInd.filter((r) => r.ratio != null && r.ratio <= b && r.ratio >= 1 / b); bandUsed = b; if (inBand.length >= 5) break; }
  const stdRanked = inBand.slice().sort((a, b) => b.n_votes - a.n_votes || (a.closeness ?? 9) - (b.closeness ?? 9) || a.ticker.localeCompare(b.ticker));
  const stdKept = stdRanked.slice(0, N_DEFAULT).map((r, i) => ({ ticker: r.ticker, rank: i + 1, votes: r.n_votes, sources: Object.keys(r.votes).filter((k) => r.votes[k]), market_cap: r.market_cap, ratio: r.ratio != null ? +r.ratio.toFixed(3) : null, sic: r.sic, same_sic: !!(r.sic && profiles[T].sic && r.sic === profiles[T].sic) }));
  const stdDropped = ladder.filter((r) => !stdKept.some((k) => k.ticker === r.ticker)).map((r) => ({ ticker: r.ticker, votes: r.n_votes, why: !r.served ? "not served on the Hub (no figures)" : !sameInd.includes(r) ? `other industry by the authority (${r.industry || "unknown"}) — a fund vote alone does not make a peer` : !inBand.includes(r) ? (r.ratio > 1 ? `too big (${r.ratio.toFixed(1)}× the company)` : `too small (${(1 / r.ratio).toFixed(1)}× smaller)`) : `beyond the nearest ${N_DEFAULT}` }));
  const standard = { band_used: bandUsed === 1e9 ? "any" : "×" + bandUsed, band_widened: bandUsed !== 10, counts: { candidates: ladder.length, served: ladder.filter((r) => r.served).length, same_industry_by_authority: sameInd.length, in_band: inBand.length, kept: stdKept.length }, kept: stdKept, dropped: stdDropped, differs_from_c4: { c4_only: sel.kept.map((k) => k.ticker).filter((t) => !stdKept.some((k) => k.ticker === t)), standard_only: stdKept.map((k) => k.ticker).filter((t) => !keptSet.has(t)) } };
  compSets[T] = { ticker: T, name: profiles[T].name, standard, industry: profiles[T].industry, sic: profiles[T].sic, sic_description: profiles[T].sic_description, market_cap: own, my_funds: cand.my_funds, sources: { fmp: sources.fmp, massive: sources.massive, massive_state: massiveRelated[T] ? (massiveRelated[T].length ? "probed" : "probed: Massive names none") : "not probed" }, screener: scr ? { industry: profiles[T].industry, total: scr.length, served: scrServed, unserved: scrExtra } : null, rule: sel.rule, counts: sel.counts, kept: sel.kept.map((k) => ({ ticker: k.ticker, rank: k.rank, sources: k.sources, match: k.match_word, market_cap: k.market_cap, ratio: +k.ratio.toFixed(3), size_distance: +k.size_distance.toFixed(3) })), dropped: sel.dropped.map((d) => ({ ticker: d.ticker, sources: d.sources, why: d.why })), ladder, agreement: { four: ladder.filter((r) => r.n_votes === 4).map((r) => r.ticker), three: ladder.filter((r) => r.n_votes === 3).map((r) => r.ticker), two: ladder.filter((r) => r.n_votes === 2).map((r) => r.ticker), one: ladder.filter((r) => r.n_votes === 1).map((r) => r.ticker) } };
}

/* ---------- 4. cohorts, the dry run on the 590 (provisional: three-rung scout today; 60-session return co-movement as the stand-in for the Geiger series) ---------- */
let dry = { note: "no closes file given: the dry run was not computed" };
if (CLOSES) {
  const N = 60;
  // align on dates: the last N+1 sessions every name shares
  const dateSets = Object.values(CLOSES).map((s) => new Set(s.map((b) => b[0])));
  const allDates = [...new Set(Object.values(CLOSES).flat().map((b) => b[0]))].sort((a, b) => a - b);
  const dates = allDates.filter((d) => dateSets.filter((s) => s.has(d)).length >= 0.95 * dateSets.length).slice(-(N + 1));
  const R = {};   // T → returns over the N sessions (null where a bar is missing)
  for (const [t, s] of Object.entries(CLOSES)) { const m = new Map(s); const r = []; for (let i = 1; i < dates.length; i++) { const a = m.get(dates[i - 1]), b = m.get(dates[i]); r.push(a && b ? Math.log(b / a) : null); } if (r.filter((x) => x != null).length >= N - 5) R[t] = r; }
  const have = (t) => !!R[t];
  const corr = (a, b) => { let n = 0, sa = 0, sb = 0, saa = 0, sbb = 0, sab = 0; for (let i = 0; i < a.length; i++) { if (a[i] == null || b[i] == null) continue; n++; sa += a[i]; sb += b[i]; saa += a[i] * a[i]; sbb += b[i] * b[i]; sab += a[i] * b[i]; } if (n < 20) return null; const c = (sab - sa * sb / n) / Math.sqrt((saa - sa * sa / n) * (sbb - sb * sb / n)); return Number.isFinite(c) ? c : null; };
  const meanPair = (ts) => { const xs = ts.filter(have); let s = 0, n = 0; for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) { const c = corr(R[xs[i]], R[xs[j]]); if (c != null) { s += c; n++; } } return n ? s / n : null; };
  const pool = servedNames.filter(have);
  let seed = 20261001; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const nullCache = {};
  const null95 = (k) => { if (k < 2) return null; if (nullCache[k]) return nullCache[k]; const draws = []; for (let d = 0; d < 200; d++) { const pick = new Set(); while (pick.size < Math.min(k, pool.length)) pick.add(pool[Math.floor(rnd() * pool.length)]); const m = meanPair([...pick]); if (m != null) draws.push(m); } draws.sort((a, b) => a - b); return (nullCache[k] = draws[Math.floor(0.95 * (draws.length - 1))]); };
  const meanSeries = (ts, except) => { const xs = ts.filter((t) => have(t) && t !== except); if (!xs.length) return null; const out = []; for (let i = 0; i < N; i++) { let s = 0, n = 0; for (const t of xs) if (R[t][i] != null) { s += R[t][i]; n++; } out.push(n ? s / n : null); } return out; };
  const scoutStats = (ts) => { const xs = ts.map((t) => scout[t]).filter(Boolean); if (!xs.length) return null; const m = xs.reduce((s, x) => s + x.composite, 0) / xs.length; const up = xs.filter((x) => x.composite > 0).length; return { n: xs.length, mean: +m.toFixed(3), up, down: xs.length - up, same_sign_share: +(xs.filter((x) => Math.sign(x.composite) === Math.sign(m)).length / xs.length).toFixed(2) }; };
  // 4a. every cohort node on the tree today, measured
  const cohortNodes = nodes.filter((n) => n.kind === "cohort");
  const measured = cohortNodes.map((n) => { const members = (n.members || []).map(norm).filter((t) => servedNames.includes(t)); const coh = members.length >= 2 ? meanPair(members) : null; const nl = members.length >= 2 ? null95(members.filter(have).length) : null; return { id: n.id, label: n.label, kind: n.ckind, parent: n.parents[0], n_members: members.length, n_measured: members.filter(have).length, cohesion: coh != null ? +coh.toFixed(3) : null, null95: nl != null ? +nl.toFixed(3) : null, verdict: coh == null || nl == null ? "too few" : coh > nl ? "COHESIVE" : "NOT ABOVE RANDOM", scout_today: scoutStats(members) }; }).sort((a, b) => (b.cohesion ?? -9) - (a.cohesion ?? -9));
  // 4b. the rule's own candidates: shared FMP industry among served names (the industry authority's stand-in until SIC is loaded), ≥4 names
  const byIndustry = {}; for (const t of servedNames) if (profiles[t].industry) (byIndustry[profiles[t].industry] ||= []).push(t);
  const industryGroups = Object.entries(byIndustry).filter(([, v]) => v.length >= 4).map(([ind, ts]) => { const coh = meanPair(ts), nl = null95(ts.filter(have).length); const sharedFunds = funds.filter((f) => f.role !== "broad" && f.holdings.length <= 60 && ts.filter((t) => f.holdings.some(([s]) => s === t)).length >= Math.max(3, ts.length / 2)).map((f) => f.ticker); const adoptedOverlap = cohortNodes.filter((n) => n.ckind === "adopted").map((n) => ({ id: n.id, shared: (n.members || []).map(norm).filter((t) => ts.includes(t)).length })).filter((x) => x.shared >= 3).sort((a, b) => b.shared - a.shared).slice(0, 2); return { industry: ind, sic_codes: [...new Set(ts.map((t) => profiles[t].sic).filter(Boolean))], n: ts.length, members: ts, cohesion: coh != null ? +coh.toFixed(3) : null, null95: nl != null ? +nl.toFixed(3) : null, verdict: coh == null ? "too few" : coh > nl ? "COHESIVE" : "NOT ABOVE RANDOM", shared_funds: sharedFunds, adopted_overlap: adoptedOverlap, scout_today: scoutStats(ts) }; }).sort((a, b) => (b.cohesion ?? -9) - (a.cohesion ?? -9));
  // 4c. step-2 moves: leave-one-out on the adopted cohorts, 60 sessions
  const adopted = cohortNodes.filter((n) => n.ckind === "adopted").map((n) => ({ id: n.id, label: n.label, members: (n.members || []).map(norm).filter((t) => servedNames.includes(t)) }));
  const moves = [];
  for (const t of servedNames) { const home = adopted.find((c) => c.members.includes(t)); if (!home || !have(t)) continue; const hm = meanSeries(home.members, t); const hc = hm ? corr(R[t], hm) : null; let best = null; for (const c of adopted) { if (c.id === home.id || c.members.length < 3) continue; const m = meanSeries(c.members, t); const cc = m ? corr(R[t], m) : null; if (cc != null && (!best || cc > best.corr)) best = { id: c.id, label: c.label, corr: cc }; } if (hc != null && best && best.corr - hc >= 0.10) moves.push({ ticker: t, home: home.label, home_corr: +hc.toFixed(2), better: best.label, better_corr: +best.corr.toFixed(2), gain: +(best.corr - hc).toFixed(2), board: board[t] ? board[t].cohort : null }); }
  moves.sort((a, b) => b.gain - a.gain);
  dry = { window_sessions: N, first_session: new Date(dates[1]).toISOString().slice(0, 10), last_session: new Date(dates[dates.length - 1]).toISOString().slice(0, 10), names_with_returns: pool.length, null_draws: 200, scout_as_of: SCOUT.as_of, cohorts_measured: measured, industry_groups: industryGroups, moves, counts: { cohorts: measured.length, cohesive: measured.filter((m) => m.verdict === "COHESIVE").length, not_above_random: measured.filter((m) => m.verdict === "NOT ABOVE RANDOM").length, too_few: measured.filter((m) => m.verdict === "too few").length, industry_groups: industryGroups.length, industry_cohesive: industryGroups.filter((g) => g.verdict === "COHESIVE").length, moves: moves.length } };
}

/* ---------- 5. the Hub Geiger against the three-rung scout, for the six and the 590 ---------- */
const pairs = [...served].filter((t) => hub[t] && scout[t]).map((t) => [t, hub[t].composite, scout[t].composite]);
const gaps = pairs.map(([, a, b]) => Math.abs(a - b)).sort((a, b) => a - b);
const geigerVsScout = { names: pairs.length, median_gap: +gaps[Math.floor(gaps.length / 2)].toFixed(3), p90_gap: +gaps[Math.floor(0.9 * gaps.length)].toFixed(3), sign_agree: pairs.filter(([, a, b]) => Math.sign(a) === Math.sign(b)).length, six: Object.fromEntries(SIX.map((t) => [t, { hub: hub[t] ? hub[t].composite : null, scout: scout[t] ? scout[t].composite : null }])), note: "the Hub Geiger is computed 1 Oct intraday on seven rungs; the scout is the 30 Sep close on three rungs — the gap is both the rungs and the clock. P8's seven-rung close run is the one to compare (its own evidence: corr 0.934 on the 590 before, see provider branch)" };

/* ---------- 6. the tree today, counted from tree.json ---------- */
const treeCounts = { ...TREE.counts, levels: { L0: 1, L1: nodes.filter((n) => n.kind === "index" && n.parents.length === 1).length, L2: nodes.filter((n) => n.kind === "index" && n.parents.length && n.parents[0] !== "MARKET" && byId[n.parents[0]] && byId[n.parents[0]].parents.length === 1).length, funds: funds.length, cohorts: nodes.filter((n) => n.kind === "cohort").length, names: nodes.filter((n) => n.kind === "name").length } , headings: nodes.filter((n) => n.kind === "index").map((n) => ({ id: n.id, label: n.label, parent: n.parents[0] || null })) };

/* ---------- 7. the proposal's rules and states, for citation ---------- */
const proposal = { rules: PROP.rules.map((r) => ({ id: r.id, rule: r.rule })), cohorts: PROP.cohorts.length, fund_cohorts: PROP.fund_cohorts.length, dissolved: PROP.dissolved.map((d) => d.key), treatment_counts: PROP.treatment_counts, status: PROP.status };

const out = { what: "U1 universe standard · derivations (1 Oct 2026) · PROPOSED, nothing deployed", built_utc: new Date().toISOString(), six: SIX, coverage, examples, authorities, comp_sets: compSets, dry_run: dry, geiger_vs_scout: geigerVsScout, tree: treeCounts, proposal, sources: { profile_count: PROF.length, fmp_peers_rows: PEERS.length, fmp_peers_companies: Object.keys(fmpPeers).length, board_rows: BOARD.length, filer_rows: FILER.length, probe: PROBE.source, scout: { as_of: SCOUT.as_of, computed_utc: SCOUT.computed_utc, run_id: SCOUT.run_id, rungs: SCOUT.equalizer.rungs.map((r) => r.key) }, hub_geiger: { computed_utc: HUBG.computed_utc, rungs: HUBG.participating_rungs }, tree_built: TREE.built_utc, proposal_status: PROP.status } };
writeFileSync(join(HERE, "derived-20261001.json"), JSON.stringify(out, null, 1));
console.log(JSON.stringify({ coverage, authorities: { probed: authorities.probed, industry_disagreements: industryDisagreements.length, sic_missing: sicMissing, mcap_disagreements: mcapDisagreements.map((m) => `${m.ticker} ${m.mcap_gap_pct}%`) }, sets: Object.fromEntries(SIX.map((t) => [t, compSets[t].counts])), dry: dry.counts || dry.note, geigerVsScout: { ...geigerVsScout, six: undefined } }, null, 1));
