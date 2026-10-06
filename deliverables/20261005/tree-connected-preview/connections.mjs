/* T14 (5 Oct 2026) · the connections of the market tree, as one small pure module the page, the build script and the tests all
   import — the maths on the screen is the maths the tests check (the pattern of aggregate.js).

   Alan, 5 Oct ~20:45: "everything feels so separate. The ticker specific things only have trees within their stuff. I don't see
   the connection of things that are under technology to other areas of the market. Like the indexes."

   indexShares(rows, fund, sectorOf)        → the fund's weight by sector: { shares: { SEC_TECH: 39.4, … }, classified_pct, unclassified_pct,
                                              total_pct, rows } — rows = [{ fund, asset, w }] (etf_holdings), sectorOf(asset) → a sector id
                                              or null. Shares are % of the WHOLE fund (the file's total), never re-scaled: what the
                                              Hub cannot place prints as "unclassified", nothing is filled in.
   heldBy(rows, onTree)                     → { asset: [[fund, w], …] } sorted by weight, for every asset onTree(asset) says yes.
   peersOf(rows, onTree)                    → { ticker: [{ t, src: ["fmp", "massive"] }] } — the union of the peer sources, in order of
                                              first appearance, for every ticker onTree says yes (peers may be off the tree: the page
                                              marks them by the close tier).
   cohortLinks(cohorts, peers, heldBy, opt) → one link per pair of cohorts in DIFFERENT sectors that share members, peers or funds:
                                              [{ a, b, sa, sb, members, peers, funds, count, shared: { members, funds } }], count = the three
                                              added, sorted by count. cohorts = [{ id, sector, members: [tickers] }].
                                              opt.narrowFund(fund) → true for a fund that may count (the broad and style funds hold
                                              everything, so they link nothing: SPY linking TECH to UTILITIES says nothing). */
export function indexShares(rows, fund, sectorOf) {
  const mine = rows.filter((r) => r.fund === fund && r.w > 0);
  const shares = {}; let total = 0, classified = 0;
  for (const r of mine) { total += r.w; const s = sectorOf(r.asset); if (s) { shares[s] = (shares[s] || 0) + r.w; classified += r.w; } }
  const round = (x) => Math.round(x * 100) / 100;
  for (const k of Object.keys(shares)) shares[k] = round(shares[k]);
  return { shares, classified_pct: round(classified), unclassified_pct: round(total - classified), total_pct: round(total), rows: mine.length };
}

export function heldBy(rows, onTree) {
  const out = {};
  for (const r of rows) { if (!(r.w > 0) || !onTree(r.asset)) continue; (out[r.asset] = out[r.asset] || []).push([r.fund, Math.round(r.w * 10000) / 10000]); }
  for (const k of Object.keys(out)) out[k].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  return out;
}

export function peersOf(rows, onTree) {
  const out = {};
  for (const r of rows) { if (!onTree(r.ticker) || !r.peer || r.peer === r.ticker) continue; const list = (out[r.ticker] = out[r.ticker] || []); let p = list.find((x) => x.t === r.peer); if (!p) { p = { t: r.peer, src: [] }; list.push(p); } if (!p.src.includes(r.source)) p.src.push(r.source); }
  return out;
}

export function cohortLinks(cohorts, peers, held, opt = {}) {
  const narrow = opt.narrowFund || (() => true);
  const C = cohorts.filter((c) => c.sector && c.members && c.members.length);
  const setOf = new Map(C.map((c) => [c.id, new Set(c.members)]));
  const peerSet = (c) => { const s = new Set(); for (const m of c.members) for (const p of peers[m] || []) s.add(p.t); return s; };
  const fundSet = (c) => { const s = new Set(); for (const m of c.members) for (const [f] of held[m] || []) if (narrow(f)) s.add(f); return s; };
  const P = new Map(C.map((c) => [c.id, peerSet(c)])), F = new Map(C.map((c) => [c.id, fundSet(c)]));
  const out = [];
  for (let i = 0; i < C.length; i++) for (let j = i + 1; j < C.length; j++) {
    const a = C[i], b = C[j]; if (a.sector === b.sector) continue;
    const sa = setOf.get(a.id), sb = setOf.get(b.id);
    const members = [...sa].filter((t) => sb.has(t));
    const pa = P.get(a.id), pb = P.get(b.id); let pr = 0; const seen = new Set();
    for (const t of sa) for (const p of peers[t] || []) if (sb.has(p.t) && !sa.has(p.t)) { const k = t < p.t ? t + "|" + p.t : p.t + "|" + t; if (!seen.has(k)) { seen.add(k); pr++; } }
    for (const t of sb) for (const p of peers[t] || []) if (sa.has(p.t) && !sb.has(p.t)) { const k = t < p.t ? t + "|" + p.t : p.t + "|" + t; if (!seen.has(k)) { seen.add(k); pr++; } }
    void pa; void pb;
    const funds = [...F.get(a.id)].filter((f) => F.get(b.id).has(f));
    const count = members.length + pr + funds.length;
    if (count) out.push({ a: a.id, b: b.id, sa: a.sector, sb: b.sector, members: members.length, peers: pr, funds: funds.length, count, shared: { members, funds } });
  }
  return out.sort((x, y) => y.count - x.count || (x.a < y.a ? -1 : 1));
}
