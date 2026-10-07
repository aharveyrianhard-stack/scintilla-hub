/* Scintilla · comps, the mechanic (C4) · the reads behind the rule, for the browser and for node.
   universe(): every served company's profile (industry, sector, market value, SIC when ticker_industry has it);
   peerRows(): fmp_peers + peer_sources (when the tables exist); funds(): the tree's fund nodes with served holdings;
   buildSet(): candidates → select; readSet(): the figures for the kept names through C3's reader (currency conversion
   included). pg: PostgREST GET (path → rows); fetchJson: url → json (for the tree and the fixture). */
import { candidates, select, sourcesFromRows, BAND_DEFAULT, N_DEFAULT } from "./peers.mjs";
import { readCohort, snapshotFromCohort } from "../comps-template/cohort.mjs";
export { snapshotFromCohort, candidates, select, BAND_DEFAULT, N_DEFAULT };

const TREE_URL = "/deliverables/20260929/tree-map/tree.json", FIXTURE_URL = "/deliverables/20261001/comps-mechanic/sources-20261001.json";

export async function universe(pg) {
  const rows = [];
  for (let off = 0; off < 5000; off += 1000) { const page = await pg(`company_profile?select=ticker,name,industry,sector,market_cap,is_etf,country&order=ticker.asc&limit=1000&offset=${off}`); rows.push(...page); if (page.length < 1000) break; }
  let ind = []; try { ind = await pg("ticker_industry?select=ticker,fmp_industry,fmp_sector,sic_code,sic_description&limit=1000"); } catch (_) { ind = null; }
  const sic = Object.fromEntries((ind || []).map((r) => [r.ticker, r]));
  const profiles = {};
  for (const r of rows) { const T = String(r.ticker).toUpperCase(), i = sic[T]; profiles[T] = { ticker: T, name: r.name, industry: (i && i.fmp_industry) || r.industry || null, sector: (i && i.fmp_sector) || r.sector || null, market_cap: Number(r.market_cap) || null, is_etf: r.is_etf === true || r.is_etf === "true", country: r.country || null, sic: i ? i.sic_code || null : null, sic_description: i ? i.sic_description || null : null }; }
  return { profiles, industry_table: ind != null, n: rows.length };
}
export async function peerRows(pg) {
  const opt = async (p) => { try { return await pg(p); } catch (_) { return null; } };
  const paged = async (base) => { const all = []; for (let off = 0; off < 100000; off += 1000) { const page = await opt(`${base}&limit=1000&offset=${off}`); if (page == null) return off ? all : null; all.push(...page); if (page.length < 1000) break; } return all; };
  const [fmp, src] = await Promise.all([paged("fmp_peers?select=ticker,peer,position,fetched_at&order=ticker.asc,position.asc"), paged("peer_sources?select=ticker,peer,source,position,fetched_at&order=ticker.asc,source.asc,position.asc")]);
  return { fmpRows: fmp || [], srcRows: src || [], tables: { fmp_peers: fmp != null, peer_sources: src != null } };
}
export async function funds(fetchJson) {
  try {
    const tree = await fetchJson(TREE_URL);
    const nodes = Object.values(tree.nodes || {});
    return nodes.filter((n) => n.kind === "fund" && n.holdings && Array.isArray(n.holdings.served_weights)).map((n) => ({ ticker: n.ticker, label: n.label, holdings: n.holdings.served_weights.map(([s, w]) => [String(s).toUpperCase(), w]) }));
  } catch (_) { return []; }
}
export async function fixture(fetchJson) { try { return await fetchJson(FIXTURE_URL); } catch (_) { return null; } }

/** Everything the rule needs, read once and cached by the caller. */
export async function inputs({ pg, fetchJson }) {
  const [u, pr, fd, fx] = await Promise.all([universe(pg), peerRows(pg), funds(fetchJson), fixture(fetchJson)]);
  return { ...u, ...pr, funds: fd, fixture: fx };
}

/** The set for one company on the rule, with the sources named and every count. */
export function buildSet(ticker, inp, { band = BAND_DEFAULT, n = N_DEFAULT } = {}) {
  const T = String(ticker).toUpperCase();
  const src = sourcesFromRows(T, { fmpRows: inp.fmpRows, srcRows: inp.srcRows, fixture: inp.fixture });
  if (src.sic && inp.profiles[T] && !inp.profiles[T].sic) inp.profiles[T] = { ...inp.profiles[T], sic: src.sic };
  const cand = candidates(T, { profiles: inp.profiles, sources: src, funds: inp.funds });
  const sel = select(cand, { band, n });
  return { ...sel, sources: src, source_state: { fmp: src.from.fmp || (inp.tables.fmp_peers || inp.tables.peer_sources ? "no rows for this company" : "table not on hand"), massive: src.from.massive || (inp.tables.peer_sources ? "no rows for this company" : "table not on hand"), fund: cand.my_funds.length ? cand.my_funds.join(", ") : "no industry fund holds it", industry: inp.profiles[T] && inp.profiles[T].industry ? inp.profiles[T].industry : "unknown" } };
}

/** The figures for the kept set. opts: { today, pg, quotes, livePrices, fxStandin, marketValueFrom (FD1: "profile" = today's market value for every company; off by default) } */
export async function readSet(ticker, set, opts) {
  const T = String(ticker).toUpperCase(), members = [T, ...set.kept.map((r) => r.ticker)];
  const ctx = await readCohort({ ticker: T, cohortAsked: null, today: opts.today, pg: opts.pg, quotes: opts.quotes, livePrices: opts.livePrices || {}, fxStandin: opts.fxStandin || null, membersAsked: members, labelAsked: `the ${set.kept.length} nearest comparables`, marketValueFrom: opts.marketValueFrom || null });
  ctx.peer_source = set.rule; ctx.set = set;
  return ctx;
}
