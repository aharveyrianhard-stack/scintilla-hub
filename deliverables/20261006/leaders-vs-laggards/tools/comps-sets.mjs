/* LD1 · the comps system's comparables for every studied name, from files already in this repo (nothing is fetched).
   The rule is C5's own code (deliverables/20261003/comps-c5/lines.mjs, buildSet: business first, 12 kept).
   Inputs: CO1's company profiles of 6 Oct (industry, market value) and C5's revenue-segment file of 3 Oct.
   Not on hand here: the fmp_peers / peer_sources tables, so the rule's small "also named by FMP" bonus (0.03) is
   not applied; a peer at the very edge of the 12 can differ from the live tab. The check below measures that
   against the four sets C6 saved from the live tab on 5 Oct.
   node comps-sets.mjs  →  ../comps-sets.json */
import { readFileSync, writeFileSync } from "node:fs"; import { fileURLToPath } from "node:url"; import path from "node:path";
import { buildSet, lineWords } from "../../../20261003/comps-c5/lines.mjs";
const HERE = path.dirname(fileURLToPath(import.meta.url)), ROOT = path.resolve(HERE, "../../../..");
const J = (p) => JSON.parse(readFileSync(path.join(ROOT, p), "utf8"));
const sel = JSON.parse(readFileSync(path.join(HERE, "../selection.json"), "utf8"));
const profRows = J("deliverables/20261006/cohort-proposal/data/company_profile-20261006.json");
const profiles = Object.fromEntries(profRows.map((r) => [String(r.ticker).toUpperCase(), { ticker: String(r.ticker).toUpperCase(), name: r.name, industry: r.industry || null, sector: r.sector || null, market_cap: Number(r.market_cap) || null, is_etf: r.is_etf === true || r.is_etf === "true" }]));
const segments = J("deliverables/20261003/comps-c5/segments-2026-10-03.json").companies;
const inp = { profiles, segments, fmpRows: [], srcRows: [] };

const A = Object.fromEntries(sel.all.map((n) => [n.ticker, n]));
const NAMED_MIN_RANK = Math.ceil(sel.field * 2 / 3);   // a brief-named name counts as a laggard only from the bottom third
const leaders = sel.leaders.map((n) => n.ticker), laggardsRule = sel.laggards.map((n) => n.ticker);
const namedLag = sel.named_in_brief.filter((n) => n.rank != null && n.rank > NAMED_MIN_RANK && !laggardsRule.includes(n.ticker)).map((n) => n.ticker);
const namedMid = sel.named_in_brief.filter((n) => n.rank != null && n.rank <= NAMED_MIN_RANK && !leaders.includes(n.ticker)).map((n) => n.ticker);
const groups = { leader: leaders, laggard: [...laggardsRule, ...namedLag], named_mid: namedMid };

const sets = {};
for (const [group, list] of Object.entries(groups)) for (const T of list) {
  const s = buildSet(T, inp);
  sets[T] = { ticker: T, group, rank: A[T].rank, own_lines: lineWords(s.own_lines), lines_from: s.lines_from, counts: s.counts,
    peers: s.kept.map((r) => ({ ticker: r.ticker, name: profiles[r.ticker]?.name || null, why: r.why, sim: +r.sim.toFixed(3), market_cap: r.market_cap })) };
}
/* how close is this to the live tab? the four sets C6 saved from the live read on 5 Oct */
const check = [];
for (const T of ["CBRS", "CRWV", "MU", "NVDA"]) {
  const live = J(`deliverables/20261005/comps-c6/set-${T}-2026-10-05.json`).set.kept.map((r) => r.ticker);
  const here = buildSet(T, inp).kept.map((r) => r.ticker);
  check.push({ ticker: T, live, here, same: here.filter((t) => live.includes(t)).length, of: live.length, only_live: live.filter((t) => !here.includes(t)), only_here: here.filter((t) => !live.includes(t)) });
}
const studied = Object.keys(sets), peerOnly = [...new Set(studied.flatMap((T) => sets[T].peers.map((p) => p.ticker)))].filter((t) => !studied.includes(t)).sort();
const out = { what: "LD1: the comps rule (C5, business first, 12 kept) run on saved inputs for every studied name", profiles_from: "CO1 company_profile, 6 Oct 2026", segments_from: "C5 segments file, 3 Oct 2026",
  not_applied: "the 'also named by FMP' bonus (the peer tables are not on hand here)", named_laggard_from_rank: NAMED_MIN_RANK + 1, groups, check_against_live_5oct: check, peer_only: peerOnly, sets };
writeFileSync(path.join(HERE, "../comps-sets.json"), JSON.stringify(out, null, 1));
console.log("groups", Object.fromEntries(Object.entries(groups).map(([g, l]) => [g, l.length])), "· studied", studied.length, "· peers not studied", peerOnly.length);
for (const c of check) console.log(`check ${c.ticker}: ${c.same}/${c.of} the same as the live tab on 5 Oct · only live: ${c.only_live.join(" ") || "-"} · only here: ${c.only_here.join(" ") || "-"}`);
for (const T of studied) console.log(`${sets[T].group.padEnd(9)} ${T.padEnd(5)} [${sets[T].own_lines}] → ${sets[T].peers.map((p) => p.ticker).join(" ")}`);
console.log("peer-only:", peerOnly.join(" "));
