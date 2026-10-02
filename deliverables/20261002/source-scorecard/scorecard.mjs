/* C5 · THE SOURCE SCORECARD (2 Oct 2026) · which of the four comp-set sources is better? Pure maths: no fetch, no DOM,
   no table write. Alan: "I read it: one source, two, three, four. Is there any gauge of which sources are better —
   which get to the same things, better or worse?"

   The four sources, as C4 names them (peers-c4.mjs, unchanged):
     FMP        FMP's peer list for the company            (public.peer_sources, source = fmp; public.fmp_peers)
     MASSIVE    Massive's related companies                 (public.peer_sources, source = massive)
     INDUSTRY   every served company in the same industry   (public.ticker_industry: the FMP industry, or the same SIC code)
     FUND       every served holding of an industry fund that holds the company (the tree's fund nodes)
   The kept set is the standard's own rule (derive.mjs §3, re-stated here word for word, NOT changed): same industry by the
   authority (FMP industry equal, or the same SIC) AND market value inside the band (÷10…×10; widened to ×30, then any,
   when fewer than 5 survive); ranked by votes, then closeness (|log10 of the size ratio|); the nearest 10 kept.

   Six measures over every served company that has a comp set:
     1 precision     of the names a source offers, the share that ends in the kept ten
     2 agreement     for each pair of sources: Jaccard of what they offer, and the kept share of what both name
     3 reach         companies a source covers at all, names offered on average, where it is empty
     4 provenance    the kept names by how many sources named them, and which source found them alone
     5 authority     names a list offers outside the company's own industry (what the industry cut removes)
     6 by industry   precision per source inside each FMP industry, so a thin industry's weakness shows */
import { candidates, N_DEFAULT } from "../../20261001/universe-standard/peers-c4.mjs";

export const SOURCES = ["FMP", "MASSIVE", "INDUSTRY", "FUND"];
export const WORDS = { FMP: "FMP's peer list", MASSIVE: "Massive's related companies", INDUSTRY: "the same industry", FUND: "a shared industry fund" };
export const PAIRS = [["FMP", "MASSIVE"], ["FMP", "INDUSTRY"], ["FMP", "FUND"], ["MASSIVE", "INDUSTRY"], ["MASSIVE", "FUND"], ["INDUSTRY", "FUND"]];
export const pairKey = (a, b) => `${a}×${b}`;
export const norm = (t) => String(t).toUpperCase().replace(".", "-");   // Massive BRK.B = Hub BRK-B
const share = (num, den) => (den ? +(num / den).toFixed(4) : null);
const mean = (xs) => (xs.length ? +(xs.reduce((s, x) => s + x, 0) / xs.length).toFixed(4) : null);
const median = (xs) => { if (!xs.length) return null; const s = xs.slice().sort((a, b) => a - b); return +s[Math.floor(s.length / 2)].toFixed(4); };

/** The standard's selection, unchanged from derive.mjs §3. cand: the result of C4's candidates(). */
export function standardSelect(cand, { n = N_DEFAULT } = {}) {
  const me = cand.me, own = Number(me.market_cap) || null;
  const rows = cand.list.map((c) => {
    const p = c.profile || {}, mcap = Number(p.market_cap) || null, ratio = own && mcap ? mcap / own : null;
    return { ticker: c.ticker, sources: c.sources.slice(), n_votes: c.sources.length, served: c.served, industry: p.industry || null, sic: p.sic || null, market_cap: mcap, ratio, closeness: ratio ? Math.abs(Math.log10(ratio)) : null, funds: c.funds };
  });
  const sameInd = rows.filter((r) => r.served && r.industry && (r.industry === me.industry || (r.sic && me.sic && String(r.sic) === String(me.sic))));
  let bandUsed = null, inBand = [];
  for (const b of [10, 30, 1e9]) { inBand = sameInd.filter((r) => r.ratio != null && r.ratio <= b && r.ratio >= 1 / b); bandUsed = b; if (inBand.length >= 5) break; }
  const ranked = inBand.slice().sort((a, b) => b.n_votes - a.n_votes || (a.closeness ?? 9) - (b.closeness ?? 9) || a.ticker.localeCompare(b.ticker));
  const kept = ranked.slice(0, n).map((r, i) => ({ ...r, rank: i + 1 }));
  return { rows, same_industry: sameInd, in_band: inBand, band_used: bandUsed === 1e9 ? "any" : "×" + bandUsed, band_widened: bandUsed !== 10, kept };
}

/** One company: what each source offers, what passed, what was kept. sources: { fmp: [...], massive: [...] } raw lists. */
export function scoreCompany(T, { profiles, sources, funds, n = N_DEFAULT }) {
  T = norm(T);
  const cand = candidates(T, { profiles, sources: { fmp: (sources.fmp || []).map(norm), massive: (sources.massive || []).map(norm) }, funds });
  const sel = standardSelect(cand, { n });
  const me = cand.me, keptSet = new Set(sel.kept.map((k) => k.ticker)), eligible = new Set(sel.in_band.map((r) => r.ticker));
  const offers = {
    FMP: [...new Set((sources.fmp || []).map(norm))].filter((s) => s !== T),
    MASSIVE: [...new Set((sources.massive || []).map(norm))].filter((s) => s !== T),
    INDUSTRY: cand.list.filter((c) => c.sources.includes("INDUSTRY")).map((c) => c.ticker),
    FUND: cand.list.filter((c) => c.sources.includes("FUND")).map((c) => c.ticker),
  };
  const by = {};
  for (const S of SOURCES) {
    const all = offers[S], served = all.filter((s) => profiles[s]), elig = served.filter((s) => eligible.has(s)), kept = served.filter((s) => keptSet.has(s));
    // against the authority: a served name the list offers whose industry is not the company's (nor the same SIC) — the industry cut removes it
    const withInd = served.filter((s) => profiles[s].industry || profiles[s].sic);
    const outside = withInd.filter((s) => !(profiles[s].industry && profiles[s].industry === me.industry) && !(profiles[s].sic && me.sic && String(profiles[s].sic) === String(me.sic)));
    by[S] = { offered: all.length, served: served.length, unserved: all.length - served.length, eligible: elig.length, kept: kept.length, outside_industry: outside.length, with_industry: withInd.length, names: all, kept_names: kept, eligible_names: elig, outside_names: outside };
  }
  const servedSets = Object.fromEntries(SOURCES.map((S) => [S, new Set(by[S].names.filter((s) => profiles[s]))]));
  const pairs = {};
  for (const [a, b] of PAIRS) {
    const A = servedSets[a], B = servedSets[b];
    const both = [...A].filter((s) => B.has(s)), union = new Set([...A, ...B]);
    pairs[pairKey(a, b)] = { a_n: A.size, b_n: B.size, both: both.length, union: union.size, both_kept: both.filter((s) => keptSet.has(s)).length, jaccard: A.size && B.size ? share(both.length, union.size) : null };
  }
  const corroborated = {};
  for (const S of SOURCES) { const others = new Set(SOURCES.filter((o) => o !== S).flatMap((o) => [...servedSets[o]])); corroborated[S] = [...servedSets[S]].filter((s) => others.has(s)).length; }
  const servedRows = sel.rows.filter((r) => r.served);
  const byVotes = {}; for (const v of [1, 2, 3, 4]) byVotes[v] = { candidates: servedRows.filter((r) => r.n_votes === v).length, kept: sel.kept.filter((k) => k.n_votes === v).length };
  return {
    ticker: T, name: me.name || null, industry: me.industry || null, sic: me.sic || null, market_cap: me.market_cap || null, my_funds: cand.my_funds,
    counts: { candidates: cand.list.length, served: servedRows.length, same_industry: sel.same_industry.length, in_band: sel.in_band.length, kept: sel.kept.length }, band_used: sel.band_used, band_widened: sel.band_widened,
    kept: sel.kept.map((k) => ({ ticker: k.ticker, rank: k.rank, votes: k.n_votes, sources: k.sources, ratio: k.ratio != null ? +k.ratio.toFixed(3) : null })),
    sources: by, pairs, corroborated, by_votes: byVotes,
  };
}

/** Every served company: profiles (served only, normalised), industry rows, peer rows, the tree's funds. Returns the per-company records. */
export function scoreUniverse({ profiles, peerRows, funds, n = N_DEFAULT }) {
  const lists = {};
  for (const r of peerRows) { const T = norm(r.ticker), L = (lists[T] ||= { fmp: [], massive: [] }); const key = r.source === "massive" ? "massive" : "fmp"; if (!L[key].includes(norm(r.peer))) L[key].push(norm(r.peer)); }
  const out = {};
  for (const T of Object.keys(profiles).sort()) {
    const p = profiles[T];
    if (p.is_etf || p.is_fund) continue;                       // a fund has no industry and no comp set
    out[T] = scoreCompany(T, { profiles, sources: lists[T] || { fmp: [], massive: [] }, funds, n });
  }
  return { companies: out, lists };
}

/** The six measures over the per-company records. fundTickers: served funds (for the reach measure, where FMP/Massive may be empty). */
export function aggregate(companies, { lists = {}, fundTickers = [], industryOf = {} } = {}) {
  const all = Object.values(companies), withSet = all.filter((c) => c.counts.kept > 0);
  const N = withSet.length;
  // 1 · precision per source (pooled over every company with a comp set; and the median per company)
  const precision = {};
  for (const S of SOURCES) {
    const off = withSet.reduce((s, c) => s + c.sources[S].offered, 0), srv = withSet.reduce((s, c) => s + c.sources[S].served, 0), elig = withSet.reduce((s, c) => s + c.sources[S].eligible, 0), kept = withSet.reduce((s, c) => s + c.sources[S].kept, 0);
    const per = withSet.filter((c) => c.sources[S].served > 0).map((c) => c.sources[S].kept / c.sources[S].served);
    precision[S] = { offered: off, served: srv, eligible: elig, kept, kept_of_offered: share(kept, off), kept_of_served: share(kept, srv), eligible_of_served: share(elig, srv), kept_of_eligible: share(kept, elig), median_per_company: median(per), mean_per_company: mean(per), companies_with_names: per.length };
  }
  // 2 · agreement between sources
  const agreement = {};
  for (const [a, b] of PAIRS) {
    const k = pairKey(a, b), rows = withSet.map((c) => c.pairs[k]), both = rows.filter((r) => r.a_n > 0 && r.b_n > 0);
    const sb = both.reduce((s, r) => s + r.both, 0), su = both.reduce((s, r) => s + r.union, 0), sk = both.reduce((s, r) => s + r.both_kept, 0);
    agreement[k] = { a, b, companies_both: both.length, pooled_jaccard: share(sb, su), mean_jaccard: mean(both.map((r) => r.jaccard)), median_jaccard: median(both.map((r) => r.jaccard)), named_by_both: sb, named_by_both_kept: sk, kept_of_named_by_both: share(sk, sb) };
  }
  const perSource = {};
  for (const S of SOURCES) {
    const js = PAIRS.filter((p) => p.includes(S)).map((p) => agreement[pairKey(p[0], p[1])].pooled_jaccard).filter((x) => x != null);
    const srv = withSet.reduce((s, c) => s + c.sources[S].served, 0), cor = withSet.reduce((s, c) => s + c.corroborated[S], 0);
    perSource[S] = { mean_pooled_jaccard_with_others: mean(js), corroborated: cor, corroborated_share: share(cor, srv) };
  }
  // 3 · reach: over every served company (names), and FMP / Massive over the served funds too
  const reach = {};
  for (const S of SOURCES) {
    const covered = all.filter((c) => c.sources[S].offered > 0), coveredServed = all.filter((c) => c.sources[S].served > 0);
    const r = { companies: all.length, covered: covered.length, covered_with_served_names: coveredServed.length, empty: all.length - covered.length, empty_names: all.filter((c) => c.sources[S].offered === 0).map((c) => c.ticker), mean_offered: mean(all.map((c) => c.sources[S].offered)), mean_served: mean(all.map((c) => c.sources[S].served)), mean_offered_when_covered: mean(covered.map((c) => c.sources[S].offered)) };
    if (S === "FMP" || S === "MASSIVE") { const key = S.toLowerCase(); const fc = fundTickers.filter((t) => lists[t] && lists[t][key] && lists[t][key].length); r.funds = { count: fundTickers.length, covered: fc.length, empty: fundTickers.length - fc.length }; }
    else r.funds = { count: fundTickers.length, covered: 0, empty: fundTickers.length, note: "a fund has no industry: not applicable" };
    reach[S] = r;
  }
  // 4 · provenance of the kept names
  const keptAll = withSet.flatMap((c) => c.kept.map((k) => ({ ...k, company: c.ticker })));
  const byVotes = {};
  for (const v of [4, 3, 2, 1]) { const cand = withSet.reduce((s, c) => s + c.by_votes[v].candidates, 0), kept = withSet.reduce((s, c) => s + c.by_votes[v].kept, 0); byVotes[v] = { served_candidates: cand, kept, kept_share: share(kept, cand), share_of_kept: share(kept, keptAll.length) }; }
  const bySource = {};
  for (const S of SOURCES) { const named = keptAll.filter((k) => k.sources.includes(S)), alone = named.filter((k) => k.sources.length === 1); bySource[S] = { names_kept: named.length, share_of_kept: share(named.length, keptAll.length), found_alone: alone.length, found_alone_share: share(alone.length, keptAll.length), missed_without_it: alone.length }; }
  const provenance = { kept_total: keptAll.length, companies_with_set: N, companies_without_set: all.length - N, without_set_names: all.filter((c) => c.counts.kept === 0).map((c) => c.ticker), by_votes: byVotes, by_source: bySource, one_source_only: keptAll.filter((k) => k.sources.length === 1).length };
  // 5 · against the authority: what the industry cut removes from each list
  const authority = {};
  for (const S of SOURCES) { const w = withSet.reduce((s, c) => s + c.sources[S].with_industry, 0), o = withSet.reduce((s, c) => s + c.sources[S].outside_industry, 0), un = withSet.reduce((s, c) => s + c.sources[S].unserved, 0), off = withSet.reduce((s, c) => s + c.sources[S].offered, 0); authority[S] = { offered: off, unserved: un, unserved_share: share(un, off), served_with_industry: w, outside_industry: o, outside_share: share(o, w), companies_with_an_outsider: withSet.filter((c) => c.sources[S].outside_industry > 0).length }; }
  // 6 · per FMP industry
  const groups = {};
  for (const c of withSet) { const g = (groups[c.industry || "(no industry)"] ||= { industry: c.industry || "(no industry)", companies: 0, served_in_industry: 0, kept_total: 0, band_widened: 0, sources: Object.fromEntries(SOURCES.map((S) => [S, { served: 0, kept: 0, offered: 0, empty: 0 }])) }); g.companies++; g.kept_total += c.counts.kept; if (c.band_widened) g.band_widened++; for (const S of SOURCES) { g.sources[S].served += c.sources[S].served; g.sources[S].kept += c.sources[S].kept; g.sources[S].offered += c.sources[S].offered; if (!c.sources[S].offered) g.sources[S].empty++; } }
  for (const g of Object.values(groups)) { g.served_in_industry = Object.values(industryOf).filter((i) => i === g.industry).length || g.companies; g.mean_kept = +(g.kept_total / g.companies).toFixed(2); g.thin = g.served_in_industry < 5; for (const S of SOURCES) g.sources[S].kept_of_served = share(g.sources[S].kept, g.sources[S].served); }
  const byIndustry = Object.values(groups).sort((a, b) => b.companies - a.companies || a.industry.localeCompare(b.industry));
  return { companies: all.length, companies_with_set: N, precision, agreement, per_source: perSource, reach, provenance, authority, by_industry: byIndustry };
}

/** The plain answer, from the numbers (so the standalone page, the cone and the ladder say the same thing).
    The same-industry source is the GATE by construction: the rule keeps only same-industry names, and that source offers every
    one of them, so every kept name is in it; what it alone contributes is the kept names no list and no fund named. */
export function verdict(agg) {
  const P = agg.precision, R = agg.reach, Pr = agg.provenance.by_source, A = agg.authority, AG = agg.agreement;
  const lists = ["FMP", "MASSIVE"];
  const sharpest = lists.slice().sort((a, b) => (P[b].kept_of_served ?? -1) - (P[a].kept_of_served ?? -1))[0], runner = lists.find((s) => s !== sharpest);
  const widest = SOURCES.slice().sort((a, b) => (R[b].mean_offered ?? -1) - (R[a].mean_offered ?? -1))[0];
  const noisiest = SOURCES.slice().sort((a, b) => (P[a].kept_of_served ?? 2) - (P[b].kept_of_served ?? 2))[0];
  const pc = (x) => (x == null ? "—" : Math.round(x * 100) + "%");
  const n = (x) => Number(x).toLocaleString("en-US");
  const both = AG[pairKey("FMP", "MASSIVE")];
  const sentence = `${WORDS[sharpest]} is the sharpest (${pc(P[sharpest].kept_of_served)} of the served names it offers end in the kept ten), ${WORDS[runner]} just behind (${pc(P[runner].kept_of_served)}); when the two lists agree on a name it is kept ${pc(both.kept_of_named_by_both)} of the time. ${WORDS[widest].charAt(0).toUpperCase() + WORDS[widest].slice(1)} is the widest net (${R[widest].mean_offered.toFixed(0)} names per company on average) and ${widest === noisiest ? "mostly noise" : WORDS[noisiest] + " is mostly noise"}: ${pc(P[noisiest].kept_of_served)} of its names are kept and ${pc(A[noisiest].outside_share)} are in another industry. ${WORDS.INDUSTRY.charAt(0).toUpperCase() + WORDS.INDUSTRY.slice(1)} is the gate, not a voter: every kept name is in it by construction, and ${n(Pr.INDUSTRY.found_alone)} of the ${n(agg.provenance.kept_total)} kept (${pc(Pr.INDUSTRY.found_alone_share)}) were found by it alone — names no list and no fund offered. FMP's list reaches furthest outside the Hub (${pc(A.FMP.unserved_share)} of its names have no figures here, against ${pc(A.MASSIVE.unserved_share)} for Massive); Massive is missing for ${R.MASSIVE.empty} companies and ${R.MASSIVE.funds ? R.MASSIVE.funds.empty : "—"} of the ${R.MASSIVE.funds ? R.MASSIVE.funds.count : "—"} served funds.`;
  return { sharpest, runner, widest, noisiest, gate: "INDUSTRY", sentence };
}
