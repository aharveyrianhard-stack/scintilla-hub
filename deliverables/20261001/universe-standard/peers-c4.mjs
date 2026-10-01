/* Scintilla · comps, the mechanic (C4, 1 Oct) · ONE STATED RULE for the comparable set. Pure: no fetch, no DOM.
   The July spec (scintilla-widgets/templates/fundamentals-spec.html §2): "Peer set: FMP algorithmic peers vs screener vs
   ETF constituents". The cohorts were custom watch lists and leave the rule.

   candidates = the union of four sources, each candidate carrying the sources that named it:
     FMP       FMP's algorithmic peers (stable/stock-peers → public.fmp_peers / peer_sources)
     MASSIVE   Massive's related companies (/v1/related-companies → peer_sources)
     INDUSTRY  every served company in the same FMP industry (the screener, on the names the Hub serves) or the same SIC code
     FUND      every served holding of an industry fund that holds the company (the tree's fund nodes; broad and style funds do not count)
   keep      = same industry (FMP industry equal, or SIC equal, or a shared industry fund) AND market value inside the band:
               own ÷ BAND ≤ peer ≤ own × BAND (BAND default 10, a visible control)
   rank      = industry match first (FMP industry = 0, shared industry fund = 1, SIC only = 2), then the size ratio
               |log10(peer market value ÷ own)|, then more sources naming it; keep the nearest N (default 10, a control).
   The operator's on/off (comps_decisions) sits on top of the kept list. Every step's count is returned. */

export const BAND_DEFAULT = 10, N_DEFAULT = 10, BANDS = [3, 10, 30, 1000], NS = [6, 8, 10, 12, 15];
export const SOURCE_WORDS = { FMP: "FMP peers", MASSIVE: "Massive related", INDUSTRY: "same industry", FUND: "same industry fund" };
/** Broad, style and size funds whose holdings say nothing about an industry. */
export const BROAD_FUNDS = new Set(["SPY", "VTI", "ITOT", "VT", "IWV", "RSP", "VTV", "VUG", "QQQ", "QQEW", "MTUM", "QUAL", "SPLV", "IWM", "MGK", "MDY", "IJR", "DIA", "SCHD", "VXUS"]);
export const INDUSTRY_FUND_MAX = 60;   // an industry fund holds a few dozen names; a sector fund with 50 counts, a 290-name index does not

/** The industry funds that hold a ticker. funds: [{ticker, holdings: [[sym, weight]…]}] (the tree's fund nodes). */
export function fundsHolding(ticker, funds) {
  const T = String(ticker).toUpperCase();
  return (funds || []).filter((f) => !BROAD_FUNDS.has(f.ticker) && f.holdings && f.holdings.length <= INDUSTRY_FUND_MAX && f.holdings.some(([s]) => String(s).toUpperCase() === T)).map((f) => f.ticker);
}

/** The candidates for one company.
    profiles: { T: { industry, sector, market_cap, is_etf, sic } } for every served company;
    sources: { fmp: [peers], massive: [peers] } (may be empty); funds: the tree's fund nodes. */
export function candidates(ticker, { profiles, sources = {}, funds = [] }) {
  const T = String(ticker).toUpperCase(), me = profiles[T];
  if (!me) throw new Error(`${T} has no profile`);
  const by = new Map();
  const add = (sym, src, extra = {}) => { const S = String(sym).toUpperCase(); if (S === T) return; const c = by.get(S) || { ticker: S, sources: new Set(), served: !!profiles[S], funds: new Set() }; c.sources.add(src); if (extra.fund) c.funds.add(extra.fund); by.set(S, c); };
  for (const p of sources.fmp || []) add(p, "FMP");
  for (const p of sources.massive || []) add(p, "MASSIVE");
  for (const [S, p] of Object.entries(profiles)) { if (S === T || p.is_etf) continue; if (me.industry && p.industry === me.industry) add(S, "INDUSTRY"); else if (me.sic && p.sic && String(p.sic) === String(me.sic)) add(S, "INDUSTRY"); }
  const myFunds = fundsHolding(T, funds);
  for (const f of funds || []) if (myFunds.includes(f.ticker)) for (const [s] of f.holdings) if (profiles[String(s).toUpperCase()]) add(s, "FUND", { fund: f.ticker });
  return { ticker: T, me, my_funds: myFunds, list: [...by.values()].map((c) => ({ ...c, sources: [...c.sources], funds: [...c.funds], profile: profiles[c.ticker] || null })) };
}

/** Apply the rule to the candidates. Returns kept (ranked), dropped with reasons, and the counts at every step. */
export function select(cand, { band = BAND_DEFAULT, n = N_DEFAULT } = {}) {
  const me = cand.me, own = Number(me.market_cap) || null, myFunds = new Set(cand.my_funds);
  const rows = cand.list.map((c) => {
    const p = c.profile || {};
    const industry = p.industry && me.industry && p.industry === me.industry ? 0 : c.funds.some((f) => myFunds.has(f)) ? 1 : (p.sic && me.sic && String(p.sic) === String(me.sic)) ? 2 : null;
    const mcap = Number(p.market_cap) || null;
    const ratio = own > 0 && mcap > 0 ? mcap / own : null;
    const inBand = ratio != null ? ratio <= band && ratio >= 1 / band : null;
    let why = null;
    if (!c.served) why = "not served on the Hub (no figures)";
    else if (industry == null) why = `different industry (${p.industry || "unknown"})`;
    else if (ratio == null) why = "no market value on file";
    else if (!inBand) why = ratio > band ? `too big (${ratio.toFixed(1)}× the company)` : `too small (${(1 / ratio).toFixed(1)}× smaller)`;
    return { ticker: c.ticker, sources: c.sources, funds: c.funds, served: c.served, industry: p.industry || null, sic: p.sic || null, market_cap: mcap, ratio, match: industry, match_word: industry === 0 ? "same FMP industry" : industry === 1 ? "same industry fund" : industry === 2 ? "same SIC code" : "other industry", why };
  });
  const served = rows.filter((r) => r.served), sameInd = served.filter((r) => r.match != null), inBand = sameInd.filter((r) => !r.why);
  const ranked = inBand.slice().sort((a, b) => a.match - b.match || Math.abs(Math.log10(a.ratio)) - Math.abs(Math.log10(b.ratio)) || b.sources.length - a.sources.length || a.ticker.localeCompare(b.ticker));
  const kept = ranked.slice(0, n).map((r, i) => ({ ...r, rank: i + 1, size_distance: Math.abs(Math.log10(r.ratio)) }));
  const beyond = ranked.slice(n).map((r) => ({ ...r, why: `beyond the nearest ${n}` }));
  return {
    ticker: cand.ticker, band, n, own_market_cap: own, own_industry: me.industry || null, own_sic: me.sic || null, my_funds: cand.my_funds,
    counts: { candidates: rows.length, served: served.length, same_industry: sameInd.length, in_band: inBand.length, kept: kept.length },
    kept, dropped: rows.filter((r) => r.why).concat(beyond),
    rule: `candidates from four sources → same industry (FMP industry, SIC, or a shared industry fund) → market value between ÷${band} and ×${band} of the company → ranked by industry match then size, the nearest ${n} kept`,
  };
}

/** The sources from the tables, or from the dated fixture when the tables are empty. rows: peer_sources / fmp_peers rows. */
export function sourcesFromRows(ticker, { fmpRows = [], srcRows = [], fixture = null }) {
  const T = String(ticker).toUpperCase();
  const fmp = [...new Set([...fmpRows.filter((r) => r.ticker === T).map((r) => r.peer), ...srcRows.filter((r) => r.ticker === T && r.source === "fmp").map((r) => r.peer)])];
  const massive = [...new Set(srcRows.filter((r) => r.ticker === T && r.source === "massive").map((r) => r.peer))];
  const out = { fmp, massive, from: { fmp: fmp.length ? "table" : null, massive: massive.length ? "table" : null } };
  if (fixture && fixture.companies && fixture.companies[T]) {
    const f = fixture.companies[T];
    if (!fmp.length && f.fmp) { out.fmp = f.fmp.slice(); out.from.fmp = fixture.source || "fixture"; }
    if (!massive.length && f.massive) { out.massive = f.massive.slice(); out.from.massive = fixture.source || "fixture"; }
    if (f.sic) out.sic = f.sic;
  }
  return out;
}
