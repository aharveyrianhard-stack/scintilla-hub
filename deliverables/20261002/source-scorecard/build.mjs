#!/usr/bin/env node
/* C5 · builds scorecard-2026-10-02.json and SOURCE-SCORECARD.html from dated snapshots. Read-only: no table write, no
   fetch, no key, no browser. node build.mjs [--json-only]
   Inputs:
   - ../../20261001/universe-standard/data/company_profile-20261001.json   public.company_profile (name, market value, is_etf)
   - ../../20261001/universe-standard/data/hub-geiger-20261001.json        the served 590 (the Hub's /geiger symbols)
   - ../../20261001/universe-standard/data/ticker_industry-20261002.json   public.ticker_industry: FMP industry (589) and SIC (426)
   - ../../20261001/universe-standard/data/fmp_peers-20261001.json         public.fmp_peers (4,455 rows)
   - data/peer_sources-20261002.json                                        public.peer_sources (8,897 rows: fmp 5,798 · massive 3,099), pulled 2 Oct by read-only SQL
   - ../../20260929/tree-map/tree.json                                      the tree's fund nodes (served holdings) */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { scoreUniverse, aggregate, verdict, norm, SOURCES, WORDS, PAIRS, pairKey } from "./scorecard.mjs";
import { pageHTML } from "./page.mjs";

const HERE = dirname(fileURLToPath(import.meta.url)), STD = join(HERE, "../../20261001/universe-standard");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const PROF = J(join(STD, "data/company_profile-20261001.json")), HUBG = J(join(STD, "data/hub-geiger-20261001.json")), TI = J(join(STD, "data/ticker_industry-20261002.json"));
const FMP = J(join(STD, "data/fmp_peers-20261001.json")), PS = J(join(HERE, "data/peer_sources-20261002.json")), TREE = J(join(HERE, "../../20260929/tree-map/tree.json"));

const served = new Set(Object.keys(HUBG.symbols).map(norm));
const ti = Object.fromEntries(TI.map((r) => [norm(r.ticker), r]));
const profiles = {};
for (const r of PROF) {
  const T = norm(r.ticker); if (!served.has(T)) continue;
  const i = ti[T] || {};
  profiles[T] = { ticker: T, name: r.name, industry: i.fmp_industry || r.industry || null, sector: i.fmp_sector || r.sector || null, market_cap: Number(r.market_cap) || null, is_etf: r.is_etf === true, is_fund: r.is_fund === true, sic: i.sic_code || null };
}
const funds = TREE.nodes.filter((n) => n.kind === "fund" && n.holdings && Array.isArray(n.holdings.served_weights)).map((n) => ({ ticker: n.ticker, holdings: n.holdings.served_weights.map(([s, w]) => [norm(s), w]) }));
const peerRows = [...PS.rows.map((r) => ({ ticker: r.ticker, peer: r.peer, source: r.source })), ...FMP.map((r) => ({ ticker: r.ticker, peer: r.peer, source: "fmp" }))];
const fundTickers = [...served].filter((t) => !profiles[t] || profiles[t].is_etf || profiles[t].is_fund).sort();

const { companies, lists } = scoreUniverse({ profiles, peerRows, funds });
const industryOf = Object.fromEntries(Object.values(profiles).filter((p) => !p.is_etf && !p.is_fund).map((p) => [p.ticker, p.industry]));
const agg = aggregate(companies, { lists, fundTickers, industryOf });
const v = verdict(agg);
const out = {
  what: "C5 · source scorecard (2 Oct 2026) · the four comp-set sources measured on every served company with a comp set · read-only, nothing deployed",
  built_utc: new Date().toISOString(), as_of: { peer_sources: PS.rows[0].fetched_at.slice(0, 10), ticker_industry: "2026-10-02", company_profile: "2026-10-01", tree_funds: TREE.built_utc },
  rule: "the standard's rule, unchanged: same industry by the authority (FMP industry, or the same SIC) → market value inside ÷10…×10 (widened to ×30, then any, when fewer than 5 survive) → ranked by votes then closeness → the nearest 10 kept",
  universe: { served: served.size, companies: Object.keys(companies).length, funds: fundTickers.length, with_sic: Object.values(profiles).filter((p) => p.sic && !p.is_etf && !p.is_fund).length, with_set: agg.companies_with_set, without_set: agg.provenance.without_set_names },
  verdict: v, measures: agg,
  worked: Object.fromEntries(["LRCX", "JPM"].map((t) => {
    const c = companies[t], names = {};
    for (const S of SOURCES) for (const s of c.sources[S].names) { const p = profiles[s], k = c.kept.find((x) => x.ticker === s); names[s] ||= { served: !!p, industry: p ? p.industry : null, market_cap: p ? p.market_cap : null, kept: !!k, rank: k ? k.rank : null, votes: SOURCES.filter((X) => c.sources[X].names.includes(s)).length, eligible: SOURCES.some((X) => c.sources[X].eligible_names.includes(s)), outside: SOURCES.some((X) => c.sources[X].outside_names.includes(s)) }; }
    return [t, { ...c, names }];
  })),
  companies: Object.fromEntries(Object.values(companies).map((c) => [c.ticker, { industry: c.industry, sic: c.sic, market_cap: c.market_cap, band_used: c.band_used, kept: c.kept.map((k) => `${k.ticker}:${k.votes}`), counts: c.counts, sources: Object.fromEntries(SOURCES.map((S) => [S, { offered: c.sources[S].offered, served: c.sources[S].served, eligible: c.sources[S].eligible, kept: c.sources[S].kept, outside: c.sources[S].outside_industry }])), pairs: Object.fromEntries(PAIRS.map(([a, b]) => [pairKey(a, b), c.pairs[pairKey(a, b)].jaccard])) }])),
};
writeFileSync(join(HERE, "scorecard-2026-10-02.json"), JSON.stringify(out, null, 1));
if (!process.argv.includes("--json-only")) writeFileSync(join(HERE, "SOURCE-SCORECARD.html"), pageHTML(out, { shotExists: (f) => existsSync(join(HERE, "shots", f)) }));

const pc = (x) => (x == null ? "—" : (x * 100).toFixed(1) + "%");
console.log(JSON.stringify({
  universe: out.universe,
  precision: Object.fromEntries(SOURCES.map((S) => [S, { offered: agg.precision[S].offered, served: agg.precision[S].served, kept: agg.precision[S].kept, kept_of_offered: pc(agg.precision[S].kept_of_offered), kept_of_served: pc(agg.precision[S].kept_of_served), eligible_of_served: pc(agg.precision[S].eligible_of_served), median: pc(agg.precision[S].median_per_company) }])),
  agreement: Object.fromEntries(Object.entries(agg.agreement).map(([k, a]) => [k, { both: a.companies_both, pooled_j: pc(a.pooled_jaccard), mean_j: pc(a.mean_jaccard), named_by_both: a.named_by_both, kept_of_both: pc(a.kept_of_named_by_both) }])),
  per_source: agg.per_source,
  reach: Object.fromEntries(SOURCES.map((S) => [S, { covered: agg.reach[S].covered, empty: agg.reach[S].empty, mean_offered: agg.reach[S].mean_offered, mean_served: agg.reach[S].mean_served, funds: agg.reach[S].funds }])),
  provenance: { total: agg.provenance.kept_total, by_votes: agg.provenance.by_votes, by_source: agg.provenance.by_source },
  authority: agg.authority,
  industries: agg.by_industry.length, thin: agg.by_industry.filter((g) => g.thin).length,
  verdict: v.sentence,
  six: Object.fromEntries(["LRCX", "MSFT", "TSM", "MU", "JPM", "XOM"].map((t) => [t, companies[t] ? { band: companies[t].band_used, kept: companies[t].kept.map((k) => k.ticker + ":" + k.votes).join(" ") } : null])),
}, null, 1));
