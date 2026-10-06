#!/usr/bin/env node
/* T14 (5 Oct 2026) · data/connections-20261005.json: the links the tree draws — the indexes' weight by sector, every fund that
   holds each served name (with its weight), each name's comps peers (the union of the FMP and Massive peer lists the C5 lane
   loaded), and the cross-sector cohort links. Built ONLY from the dated read-only exports under data/raw-20261005/ (four
   `supabase db query` reads, 6 Oct 00:56 UTC, the SQL in each file's `sql` field) plus tree.json. Nothing live is read here and
   nothing is written to a table.

   Supplier / customer links: NO data exists on the Hub. No table holds them (the only `suppliers` table is Urth's landscaping
   suppliers — Q4's audit), the FMP supply-chain route is not loaded, and the peer lists are comps peers, not customers. The page
   says so on the card instead of drawing a guess.                                      node build-connections.mjs */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { indexShares, heldBy, peersOf, cohortLinks } from "./connections.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), RAW = join(HERE, "data/raw-20261005");
const J = (p) => JSON.parse(readFileSync(p, "utf8"));
const T = J(join(HERE, "tree.json"));
const H = J(join(RAW, "etf_holdings.json")), PS = J(join(RAW, "profile_sectors.json")), PR = J(join(RAW, "peer_sources.json")), TC = J(join(RAW, "ticker_cohorts.json"));
const byId = new Map(T.nodes.map((n) => [n.id, n])), byTicker = new Map(T.nodes.filter((n) => n.ticker).map((n) => [n.ticker, n]));
const onTree = (t) => byTicker.has(t) || byTicker.has(String(t || "").replace(/\./g, "-"));
const norm = (t) => (byTicker.has(t) ? t : byTicker.has(String(t || "").replace(/\./g, "-")) ? String(t).replace(/\./g, "-") : t);

/* the sector of a holding: tree.json's own sector for a served name (the authority on the tree), else the Hub's company_profile
   sector (FMP's names mapped onto the tree's sector ids), else null = unclassified (IWM: 1,988 small caps, 56 served) */
const FMP_SECTOR = { "Technology": "SEC_TECH", "Financial Services": "SEC_FIN", "Healthcare": "SEC_HLTH", "Energy": "SEC_ENGY", "Industrials": "SEC_INDU", "Consumer Defensive": "SEC_STPL", "Consumer Cyclical": "SEC_DISC", "Utilities": "SEC_UTIL", "Basic Materials": "SEC_MATL", "Real Estate": "SEC_REIT", "Communication Services": "SEC_COMM", "CRYPTO": "CRYPTO" };
const prof = new Map(PS.rows.map((r) => [r.ticker, r]));
const sectorOf = (asset) => { const n = byTicker.get(norm(asset)); if (n && n.kind === "name" && n.sector) return n.sector; if (n && n.kind === "fund") return "FUNDS"; const p = prof.get(asset); return p && FMP_SECTOR[p.sector] ? FMP_SECTOR[p.sector] : null; };

const rows = H.rows.map((r) => ({ fund: r.fund, asset: norm(r.asset), w: +r.w }));
const BROAD = ["SPY", "QQQ", "DIA", "IWM", "RSP"], SPDR = ["XLK", "XLF", "XLV", "XLE", "XLI", "XLP", "XLY", "XLU", "XLB", "XLRE", "XLC"];
const fundsInFile = [...new Set(rows.map((r) => r.fund))].sort();
const index_sectors = {}; for (const f of [...BROAD, ...SPDR]) index_sectors[f] = indexShares(rows, f, sectorOf);
const held_by = heldBy(rows, onTree);
const funds = {}; for (const f of fundsInFile) { const mine = rows.filter((r) => r.fund === f); funds[f] = { rows: mine.length, total_pct: Math.round(mine.reduce((s, r) => s + r.w, 0) * 100) / 100, served: mine.filter((r) => onTree(r.asset)).length, on_tree: onTree(f), role: (byTicker.get(f) || {}).role || null, parent: ((byTicker.get(f) || {}).parents || [])[0] || null }; }
const peers = peersOf(PR.rows.map((r) => ({ ticker: norm(r.ticker), peer: norm(r.peer), source: r.source })), onTree);

/* cohorts and their sector: walk the first parent up to a sector heading (COHORT_AI_POWER → VPU → SEC_UTIL); members = the
   cohort node's members + every name whose also_in names it (the multi-membership) */
const BLOCK_IDS = new Set(["SEC_TECH", "SEC_FIN", "SEC_HLTH", "SEC_ENGY", "SEC_INDU", "SEC_STPL", "SEC_DISC", "SEC_UTIL", "SEC_MATL", "SEC_REIT", "SEC_COMM", "US_BROAD", "US_STYLE", "INTL_DEV", "EM", "BONDS", "CMDTY", "CRYPTO", "MACRO"]);
const blockOf = (n) => { let c = n, last = null; while (c && c.parents && c.parents.length) { c = byId.get(c.parents[0]); if (!c) break; if (c.kind === "index") { if (BLOCK_IDS.has(c.id)) return c.id; last = last || c.id; } } return last || "MARKET"; };
const alsoIn = new Map(); for (const n of T.nodes) if (n.kind === "name") for (const a of n.also_in || []) { if (!alsoIn.has(a.id)) alsoIn.set(a.id, []); alsoIn.get(a.id).push(n.ticker); }
const cohorts = T.nodes.filter((n) => n.kind === "cohort" && (n.ckind === "adopted" || n.ckind === "proposed")).map((n) => ({ id: n.id, label: n.label, ckind: n.ckind, sector: blockOf(n), members: [...new Set([...(n.members || []), ...(alsoIn.get(n.id) || [])])].filter(onTree) }));
const narrowFund = (f) => { const n = byTicker.get(f); const role = n ? n.role : null; const par = n ? n.parents[0] : null; return !BROAD.includes(f) && role !== "broad" && par !== "US_STYLE" && par !== "US_BROAD" && !(funds[f] && funds[f].rows > 300); };
const cohort_links = cohortLinks(cohorts, peers, held_by, { narrowFund });

/* the multi-membership table, for the card (ticker_cohorts: the real multi-membership, the Hub reads it the same way) */
const ticker_cohorts = {}; for (const r of TC.rows) { const t = norm(r.ticker); if (onTree(t)) (ticker_cohorts[t] = ticker_cohorts[t] || []).push(r.cohort); }

const out = {
  what: "T14: the links the tree draws. index_sectors: each index's weight by sector (% of the whole fund; unclassified = holdings the Hub cannot place). held_by: every fund in etf_holdings that holds each served name, with its weight. peers: the comps peers (FMP ∪ Massive). cohort_links: cohorts in different sectors that share members, peers or narrow funds (count = members + peer pairs + funds). supplier_customer: none — no data on the Hub.",
  built_utc: new Date().toISOString(), read_utc: readFileSync(join(RAW, "read_utc.txt"), "utf8").trim(),
  sources: { etf_holdings: "public.etf_holdings (62 funds, F1 filled 61 + AGIX), read-only export data/raw-20261005/etf_holdings.json", sectors: "tree.json sector for a served name; public.company_profile.sector (FMP) for the rest — data/raw-20261005/profile_sectors.json", peers: "public.peer_sources (fmp + massive, loaded 1 Oct by the peer-sources job) — data/raw-20261005/peer_sources.json", cohorts: "tree.json cohort nodes (adopted + proposed) with also_in folded in; public.ticker_cohorts for the card — data/raw-20261005/ticker_cohorts.json", supplier_customer: "NO DATA: no Hub table (the only `suppliers` table is Urth's landscaping suppliers); FMP's supply-chain route is not loaded; the peer lists are comps peers, not customers" },
  indexes: { broad: BROAD, sector: SPDR, on_tree: [...BROAD, ...SPDR].filter(onTree), in_holdings_file: [...BROAD, ...SPDR].filter((f) => fundsInFile.includes(f)) },
  counts: { funds_in_file: fundsInFile.length, holdings_rows: rows.length, names_held: Object.keys(held_by).length, names_with_peers: Object.keys(peers).length, peer_rows: Object.values(peers).reduce((s, l) => s + l.length, 0), cohorts: cohorts.length, cohort_links: cohort_links.length, links_members: cohort_links.filter((l) => l.members).length, links_peers: cohort_links.filter((l) => l.peers).length, links_funds: cohort_links.filter((l) => l.funds).length },
  index_sectors, funds, held_by, peers, cohorts, cohort_links, ticker_cohorts, supplier_customer: null,
};
writeFileSync(join(HERE, "data/connections-20261005.json"), JSON.stringify(out));
console.log(JSON.stringify({ counts: out.counts, indexes: out.indexes, SPY: index_sectors.SPY, IWM: index_sectors.IWM, NVDA_held: (held_by.NVDA || []).length, NVDA_peers: (peers.NVDA || []).map((p) => p.t), top_links: cohort_links.slice(0, 8).map((l) => `${l.a} (${l.sa}) ↔ ${l.b} (${l.sb}) · ${l.count} = ${l.members}m + ${l.peers}p + ${l.funds}f`) }, null, 1));
