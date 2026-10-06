#!/usr/bin/env node
// TR2 (6 Oct 2026) — THE TREE REVISED ON ALAN'S NOTES. A pure transform: no database, no network, no clock.
//
//   node scripts/cohort-tree-revise.mjs            # print the plan (what changes against TR1's tree)
//   node scripts/cohort-tree-revise.mjs --write    # also write deliverables/20261006/tree-revision/revised-tree.json
//
// It takes the tree TR1 loaded (scripts/cohort-tree-loader.mjs → 91 nodes, 771 member rows) and applies Alan's
// 6 Oct notes, nothing else:
//   1. "the frontier — I don't even like the name, it just seemed like a consolidation of a bunch of stuff"
//      → FRONTIER goes; SPACE, QUANTUM, AUTONOMY/eVTOL/DRONES and DEFENCE TECH hang from what the companies make.
//   2. "the index layer should go between the other layers and the market … sector funds are parents of these
//      things, and that's where you'll see the cross relationships"
//      → THE MARKET → INDEX LAYER → eleven sector nodes (each a SPDR fund with its three twins) → theme headings
//        → cohorts. Every fund-to-cohort relationship is MEASURED from the funds' own holdings (links[]).
//   3. "packaged foods — where would that go?" → CONSUMER → CONSUMER STAPLES → PACKAGED FOODS, with the names
//      that would make it a group recorded beside it (candidates[]; never members: they are not served).
//   4. his on-Hub picks, as a RECORD (hub_pick on / off / undecided). Nothing reads it; the Hub does not change.
// The SQL that carries this to the two TR1 tables is written by scripts/cohort-tree-revise-sql.mjs from diff{}.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildTree, validate } from './cohort-tree-loader.mjs'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const CO1 = 'deliverables/20261006/cohort-proposal'
const TR1 = 'deliverables/20261006/tree-adopted'
export const TR2 = 'deliverables/20261006/tree-revision'
const J = (p) => JSON.parse(readFileSync(join(ROOT, p), 'utf8'))
export const SOURCE = 'TR2-20261006'

// THE ELEVEN SECTORS, each drawn by its SPDR fund. The other three are the same sector by another recipe; TR1 held
// all 44 in four by-family sets, which said who made the fund and hid which sector it was.
//          node id        label                            SPDR    eq-wt   Vanguard iShares
export const SECTORS = [
  ['SECTOR_XLK', 'TECHNOLOGY · XLK', 'XLK', 'RSPT', 'VGT', 'IYW'],
  ['SECTOR_XLC', 'COMMUNICATION SERVICES · XLC', 'XLC', 'RSPC', 'VOX', 'IYZ'],
  ['SECTOR_XLY', 'CONSUMER DISCRETIONARY · XLY', 'XLY', 'RSPD', 'VCR', 'IYC'],
  ['SECTOR_XLP', 'CONSUMER STAPLES · XLP', 'XLP', 'RSPS', 'VDC', 'IYK'],
  ['SECTOR_XLF', 'FINANCIALS · XLF', 'XLF', 'RSPF', 'VFH', 'IYF'],
  ['SECTOR_XLV', 'HEALTH CARE · XLV', 'XLV', 'RSPH', 'VHT', 'IYH'],
  ['SECTOR_XLI', 'INDUSTRIALS · XLI', 'XLI', 'RSPN', 'VIS', 'IYJ'],
  ['SECTOR_XLE', 'ENERGY · XLE', 'XLE', 'RSPG', 'VDE', 'IYE'],
  ['SECTOR_XLU', 'UTILITIES · XLU', 'XLU', 'RSPU', 'VPU', 'IDU'],
  ['SECTOR_XLB', 'MATERIALS · XLB', 'XLB', 'RSPM', 'VAW', 'IYM'],
  ['SECTOR_XLRE', 'REAL ESTATE · XLRE', 'XLRE', 'RSPR', 'VNQ', 'IYR']
]
const FAMILY_SETS = ['IDX_SECTOR_SPDR', 'IDX_SECTOR_EQUAL_WEIGHT', 'IDX_SECTOR_VANGUARD', 'IDX_SECTOR_ISHARES']
const BROAD = ['SPY', 'QQQ']                       // "how much of the market is this" — the two lines the Hub draws

// WHERE FRONTIER'S FOUR COHORTS GO, AND WHY. The numbers are frontier-rehome.json's (126 sessions, 7 Apr – 5 Oct
// 2026; "after beta" = with each side's small-cap (IWM) swing taken out). The tests hold every number here to
// that file. Said plainly: the parents below come from what the companies MAKE. On the tape SPACE, QUANTUM and
// eVTOL moved as one block of story stocks this half-year (0.37 between cohorts), not with their new neighbours.
const REHOME = {
  SPACE: { parent_1: 'AEROSPACE_DEFENCE', parent_2: null,
    why: '7 of its 11 names are filed as Aerospace & Defense, Vanguard\'s industrials fund holds 6 and the defence fund ITA holds 3. On the tape it does not follow industrials (XLI 0.33, −0.06 after beta); it follows its own fund ARKX (0.81) and eVTOL (0.66). Moves together 0.66 against 0.22 for its sector: unchanged.' },
  QUANTUM: { parent_1: 'TECH', parent_2: null,
    why: 'All 4 are filed as Technology · Computer Hardware and Vanguard\'s technology fund holds all four; the tape agrees (VGT 0.64, +0.38 after beta; industrials −0.22). Kept whole: moves together 0.87, the tightest cohort in the tree.' },
  AUTONOMY_EVTOL: { parent_1: 'AEROSPACE_DEFENCE', parent_2: null,
    why: 'The four aircraft makers (JOBY, ACHR, EVTL, EH) are filed as Industrials, three of them Aerospace & Defense. On the tape it is not an industrial or transport line (XLI 0.37, −0.14 after beta); it moves with QUANTUM (0.77) and ARKX (0.80). Moves together 0.46 against 0.22: unchanged.' },
  DEFENCE_TECH: { parent_1: 'AEROSPACE_DEFENCE', parent_2: 'SOFTWARE_INTERNET',
    why: 'Two businesses, both measured: the defence side (ITA 0.47, +0.37 after beta; ITA holds AVAV, AXON and KTOS) and the software side (IGV 0.60, +0.58 after beta; PLTR is 9.18% of IGV). Moves together 0.43 against 0.22: unchanged.' }
}

// ALAN'S ON-HUB PICKS, 6 Oct ~15:55 ET. A record only.
const PICKS_NAMED = {
  AI: ['on', 'Alan, 6 Oct: on the Hub'],
  SEMIS: ['on', 'Alan, 6 Oct: on the Hub'],
  SOFTWARE_INTERNET: ['on', 'Alan, 6 Oct: on the Hub'],
  GRID_ELECTRICAL: ['on', 'Alan, 6 Oct: on the Hub (grid & electrical)'],
  FINANCE: ['on', 'Alan, 6 Oct: on the Hub'],
  HEALTH: ['on', 'Alan, 6 Oct: health care PARTLY — he has not said which part'],
  OIL_UPSTREAM: ['off', 'Alan, 6 Oct: oil & gas off the Hub, kept statistically sound (computed and measured, not shown)'],
  OIL_MIDSTREAM: ['off', 'Alan, 6 Oct: oil & gas off the Hub, kept statistically sound (computed and measured, not shown)'],
  OIL_REFINERS: ['off', 'Alan, 6 Oct: oil & gas off the Hub, kept statistically sound (computed and measured, not shown)'],
  OIL_SERVICES: ['off', 'Alan, 6 Oct: oil & gas off the Hub, kept statistically sound (computed and measured, not shown)'],
  MATERIALS_METALS: ['off', 'Alan, 6 Oct: off the Hub'],
  INDUSTRIAL: ['off', 'Alan, 6 Oct: off the Hub'],
  REAL_ESTATE: ['off', 'Alan, 6 Oct: off the Hub']
}
// a pick said about a heading is not stretched over these: Alan spoke before they moved, or said "partly"
const PICK_NOT_INHERITED = {
  SPACE: 'moved here from FRONTIER on 6 Oct; "industrials off" was said before the move',
  AUTONOMY_EVTOL: 'moved here from FRONTIER on 6 Oct; "industrials off" was said before the move',
  DEFENCE_TECH: 'moved here from FRONTIER on 6 Oct; "industrials off" was said before the move',
  QUANTUM: 'moved here from FRONTIER on 6 Oct; technology as a whole was not named',
  AEROSPACE_DEFENCE: 'a new shelf: it holds the defence primes (off, with INDUSTRIAL) and three cohorts moved from FRONTIER'
}

const norm = (t) => String(t).toUpperCase().replace(/\./g, '-')
const r3 = (x) => Math.round(x * 1000) / 1000
const pct = (x) => (Math.round(x * 10) / 10).toFixed(1)

export function reviseTree ({ base, holdings, consumer }) {
  const nodes = base.nodes.map(n => ({ ...n }))
  const members = base.members.map(m => ({ ...m }))
  const N = () => Object.fromEntries(nodes.map(n => [n.cohort, n]))
  const drop = (id) => nodes.splice(nodes.findIndex(n => n.cohort === id), 1)
  const add = (n) => nodes.push({ parent_2: null, spine: null, spine_fund: null, spine_fund_next: null, ...n })

  // ── 1. the eleven sector nodes take the 44 sector funds from the four by-family sets ──────────────────────────
  const sectorOf = {}
  for (const [id, label, spdr, ew, van, ish] of SECTORS) {
    add({ cohort: id, label, kind: 'index', parent_1: 'IDX_SECTOR_FUNDS', spine_fund: spdr,
      spine: `the sector as the S&P 500 draws it: ${spdr} is the line; ${ew} counts every name the same; ${van} (Vanguard) and ${ish} (iShares) are the same sector by another recipe` })
    for (const t of [spdr, ew, van, ish]) sectorOf[t] = id
  }
  for (const m of members) if (FAMILY_SETS.includes(m.cohort)) m.cohort = sectorOf[m.ticker]
  for (const id of FAMILY_SETS) drop(id)

  // ── 2. FRONTIER dissolves ────────────────────────────────────────────────────────────────────────────────────
  add({ cohort: 'AEROSPACE_DEFENCE', label: 'AEROSPACE & DEFENCE', kind: 'heading', parent_1: 'INDUSTRIAL',
    spine: 'a filing shelf, not one basket: every Aerospace & Defense company we serve sits in its four cohorts (24 of 34 names); the defence fund ITA holds 19 of them. Its cohorts do not move as one (0.21 between cohorts, the same as any two industrial names), so each is read on its own.' })
  let n = N()
  n.DEFENCE_PRIMES.parent_1 = 'AEROSPACE_DEFENCE'
  n.DEFENCE_PRIMES.parent_why = 'the primes are the core of Aerospace & Defense; their heading INDUSTRIAL is one step up'
  for (const [id, r] of Object.entries(REHOME)) { n[id].parent_1 = r.parent_1; n[id].parent_2 = r.parent_2; n[id].parent_why = r.why }
  drop('FRONTIER')

  // ── 3. CONSUMER STAPLES becomes a sub-heading; its 16 names go to seven groups by what they sell ──────────────
  const sub = consumer.revised_consumer_subtree.sub_heading
  n.STAPLES.kind = 'heading'; n.STAPLES.spine_fund = null
  n.STAPLES.spine = 'no longer one bag of 16 names (it moved 0.29, the same as its sector): a sub-heading whose seven groups hold the names by what they sell. XLP stays its line.'
  const candidates = []
  for (const c of sub.cohorts) {
    const mt = c.moves_together
    add({ cohort: c.id, label: c.label, kind: 'cohort', parent_1: 'STAPLES', spine_fund: 'XLP',
      spine: `${c.spine} ${mt.avg_pair_corr == null ? 'One served name: no moves-together number.' : `Moves together ${mt.avg_pair_corr.toFixed(2)} (${mt.kind === 'pair' ? 'a pair: one number, not a group test' : `sector ${mt.sector_avg_pair_corr.toFixed(2)}`}).`}` })
    for (const t of c.first_home_members) members.find(m => m.cohort === 'STAPLES' && m.ticker === t).cohort = c.id
    for (const t of c.second_home_members) members.push({ cohort: c.id, ticker: t, role: 'member', status: 'served', near_copy_of: null, why: 'also in RETAIL (a company may sit in two cohorts): filed under Consumer Staples, and among XLP\'s biggest holdings' })
    members.push({ cohort: c.id, ticker: 'XLP', role: 'reference', status: 'served', near_copy_of: null, why: 'reference line: the open fund this cohort is measured against' })
    for (const k of c.candidates) candidates.push({ cohort: c.id, ticker: k.ticker, in_sp500: !!k.in_sp500, sp500_weight_pct: k.spy_weight_pct ?? null, basis: k.basis, gap: c.label })
  }
  // the other consumer gaps go beside the cohort that already holds the nearest served name
  const seen = new Set(candidates.map(k => `${k.cohort}|${k.ticker}`))
  const put = (cohort, k, gap) => { const key = `${cohort}|${k.ticker}`; if (seen.has(key)) return; seen.add(key); candidates.push({ cohort, ticker: k.ticker, in_sp500: !!k.in_sp500, sp500_weight_pct: k.spy_weight_pct ?? null, basis: k.basis, gap }) }
  for (const g of consumer.gaps.gics_sub_industries) {
    const home = g.goes_to && N()[g.goes_to.cohort] ? g.goes_to.cohort : null
    if (!home) continue
    for (const k of [...g.candidates_sp500_by_weight, ...g.candidates_outside_sp500]) put(home, k, g.sub_industry)
  }
  for (const w of consumer.revised_consumer_subtree.waiting_not_nodes) for (const k of w.candidates) put(w.served_today_home && N()[w.served_today_home] ? w.served_today_home : 'CONSUMER', k, `${w.label} (waiting: not a node until names are served)`)

  // ── 4. the index layer goes between THE MARKET and everything else ────────────────────────────────────────────
  n = N()
  n.INDEX_LAYER.label = 'INDEX LAYER'
  n.TECH.label = 'TECHNOLOGY'; n.REAL_ESTATE.label = 'REAL ESTATE'
  const H = holdingsIndex(holdings)
  const kids = (id) => nodes.filter(x => x.parent_1 === id)
  const namesUnder = (id) => {                      // companies of the node and of everything that hangs from it first
    const out = new Set(); const walk = (c) => { for (const m of members) if (m.cohort === c && m.role === 'member') out.add(m.ticker); for (const k of kids(c)) walk(k.cohort) }
    walk(id); return [...out]
  }
  const link = (fund, tickers) => {
    const held = tickers.map(t => [t, H[fund]?.[norm(t)] ?? 0]).filter(x => x[1] > 0).sort((a, b) => b[1] - a[1])
    return { fund_weight_pct: r3(held.reduce((s, x) => s + x[1], 0)), names_held: held.length, node_names: tickers.length,
      top_names: held.slice(0, 3).map(x => `${x[0]} ${x[1].toFixed(2)}`).join(' · ') }
  }
  const rank = (id) => {                            // the rule: most names in the sector's Vanguard fund, ties by SPDR weight
    const names = namesUnder(id)
    return SECTORS.map(([sid, , spdr, , van]) => ({ sid, spdr, van, n: names.length, s: link(spdr, names), v: link(van, names) }))
      .filter(x => x.v.names_held + x.s.names_held > 0)
      .sort((a, b) => b.v.names_held - a.v.names_held || b.s.fund_weight_pct - a.s.fund_weight_pct)
  }
  const say = (x) => `${x.v.names_held} of its ${x.n} names are in Vanguard's ${x.van}; in the S&P fund they are ${pct(x.s.fund_weight_pct)}% of ${x.spdr} (${x.s.names_held} names)`
  const THEME_HEADINGS = ['AI', 'TECH', 'ENERGY_POWER', 'FINANCE', 'HEALTH', 'MATERIALS_METALS', 'INDUSTRIAL', 'CONSUMER', 'REAL_ESTATE', 'CRYPTO']
  for (const id of THEME_HEADINGS) {
    const [a, b] = rank(id)
    n[id].parent_1 = a.sid
    n[id].parent_2 = b && b.v.names_held * 10 >= b.n ? b.sid : null   // a second sector only when it holds a tenth of the names
    n[id].parent_why = say(a) + (n[id].parent_2 ? `. Second: ${say(b)}` : '')
  }
  for (const id of ['SEMIS', 'SOFTWARE_INTERNET', 'AEROSPACE_DEFENCE', 'STAPLES']) {   // sub-headings keep their theme parent
    const [a] = rank(id); const home = n[n[id].parent_1].parent_1                       // …and add their own sector when it differs
    n[id].parent_2 = a && a.sid !== home ? a.sid : null
    if (a) n[id].parent_why = (n[id].parent_2 ? 'also under its own sector fund: ' : 'same sector as its heading: ') + say(a)
  }
  const intl = namesUnder('INTERNATIONAL'); const inNoSector = intl.filter(t => !SECTORS.some(s => (H[s[2]]?.[norm(t)] ?? 0) > 0 || (H[s[4]]?.[norm(t)] ?? 0) > 0)).length
  n.INTERNATIONAL.parent_1 = 'IDX_WORLD'
  n.INTERNATIONAL.parent_why = `foreign listings: ${inNoSector} of its ${intl.length} names are in neither the S&P nor the Vanguard fund of any US sector, so it hangs from the world and country funds, which are its reference lines`
  const mag = link('SPY', namesUnder('MAG7'))
  n.MAG7.parent_1 = 'IDX_US_BROAD'
  n.MAG7.parent_why = `the top of the market itself: ${pct(mag.fund_weight_pct)}% of SPY in ${mag.names_held} lines. It spans three sectors (${['XLK', 'XLC', 'XLY'].map(f => `${pct(link(f, namesUnder('MAG7')).fund_weight_pct)}% of ${f}`).join(', ')}), so no one sector fund is its parent`

  // ── 5. layers and Alan's picks ────────────────────────────────────────────────────────────────────────────────
  for (const x of nodes) {
    x.parent_why ??= null
    x.layer = x.cohort === 'MARKET' ? 0 : x.cohort.startsWith('SECTOR_') ? 2 : (x.cohort === 'INDEX_LAYER' || x.cohort.startsWith('IDX_')) ? 1 : x.kind === 'heading' ? 3 : 4
  }
  const nearest = (id) => {                         // the nearest heading above that Alan named, walking first parents
    for (let c = n[id]; c; c = n[c.parent_1]) if (PICKS_NAMED[c.cohort]) return c.cohort
    return null
  }
  for (const x of nodes) {
    const set = (pick, source, note) => { x.hub_pick = pick; x.hub_pick_source = source; x.hub_pick_note = note }
    if (PICKS_NAMED[x.cohort]) { set(PICKS_NAMED[x.cohort][0], 'named', PICKS_NAMED[x.cohort][1]); continue }
    if (PICK_NOT_INHERITED[x.cohort]) { set('undecided', 'not_said', PICK_NOT_INHERITED[x.cohort]); continue }
    if (x.layer <= 2) { set('undecided', 'not_said', 'index layer: not part of the 6 Oct picks'); continue }
    const a = nearest(x.cohort); const b = x.parent_2 && nearest(x.parent_2)
    const pa = a && PICKS_NAMED[a][0]; const pb = b && PICKS_NAMED[b][0]
    if (a === 'HEALTH') { set('undecided', 'not_said', 'HEALTH is on in part; which cohorts is Alan\'s call'); continue }
    if (pa && pb && pa !== pb) { set('undecided', 'parents_disagree', `its two parents disagree: ${n[a].label} is ${pa}, ${n[b].label} is ${pb}`); continue }
    if (pa) { set(pa, 'inherited', `follows ${n[a].label}`); continue }
    set('undecided', 'not_said', 'not named on 6 Oct')
  }

  // ── 6. the cross-relationships: which headings and cohorts each fund holds, by weight ─────────────────────────
  const links = []
  const linked = nodes.filter(x => x.layer >= 3)
  const funds = [...SECTORS.flatMap(s => [[s[2], s[0], 'SPDR'], [s[4], s[0], 'VANGUARD']]), ...BROAD.map(f => [f, 'IDX_US_BROAD', 'BROAD'])]
  for (const x of linked) {
    const names = namesUnder(x.cohort); if (!names.length) continue
    for (const [fund, fund_node, family] of funds) {
      const l = link(fund, names); if (!l.names_held) continue
      links.push({ fund, fund_node, family, cohort: x.cohort, ...l })
    }
  }
  return { nodes, members, links, candidates }
}

// fund → { TICKER: weight % }, share-class spellings folded (BRK.B = BRK-B), the fund's own cash row dropped
export function holdingsIndex (holdings) {
  const out = {}
  for (const [fund, v] of Object.entries(holdings.data)) {
    const o = out[fund] = {}
    for (const [t, w] of v.h) if (w > 0 && norm(t) !== fund) o[norm(t)] = (o[norm(t)] ?? 0) + w
  }
  return out
}

const TR1_COLS = ['label', 'kind', 'parent_1', 'parent_2', 'spine', 'spine_fund', 'spine_fund_next']
export const TR2_COLS = ['layer', 'parent_why', 'hub_pick', 'hub_pick_source', 'hub_pick_note']

// What the migration has to do, row by row, to turn TR1's loaded tree into this one — and back.
export function diffTrees (base, rev) {
  const B = Object.fromEntries(base.nodes.map(n => [n.cohort, n])); const R = Object.fromEntries(rev.nodes.map(n => [n.cohort, n]))
  const nodes_added = rev.nodes.filter(n => !B[n.cohort])
  const nodes_removed = base.nodes.filter(n => !R[n.cohort])
  const nodes_changed = rev.nodes.filter(n => B[n.cohort]).map(n => {
    const cols = TR1_COLS.filter(c => (B[n.cohort][c] ?? null) !== (n[c] ?? null))
    return cols.length ? { cohort: n.cohort, before: Object.fromEntries(cols.map(c => [c, B[n.cohort][c] ?? null])), after: Object.fromEntries(cols.map(c => [c, n[c] ?? null])) } : null
  }).filter(Boolean)
  // a member row is the same row when ticker, role and why are the same: then only its cohort moved
  const key = (m) => `${m.cohort}|${m.ticker}`
  const bk = new Set(base.members.map(key)); const rk = new Set(rev.members.map(key))
  const gone = base.members.filter(m => !rk.has(key(m))); const fresh = rev.members.filter(m => !bk.has(key(m)))
  const member_moves = []; const member_adds = []
  for (const m of fresh) {
    const i = gone.findIndex(g => g.ticker === m.ticker && g.role === m.role && g.why === m.why)
    if (i >= 0) member_moves.push({ ticker: m.ticker, role: m.role, from: gone.splice(i, 1)[0].cohort, to: m.cohort }); else member_adds.push(m)
  }
  return { nodes_added, nodes_removed, nodes_changed, member_moves, member_adds, member_removed: gone }
}

export function validateRevision (base, rev) {
  const errors = validate({ nodes: rev.nodes, members: rev.members, dropped: [] })
  const ids = new Set(rev.nodes.map(n => n.cohort))
  if (ids.has('FRONTIER')) errors.push('FRONTIER is still a node')
  for (const x of rev.nodes) {
    if (!['on', 'off', 'undecided'].includes(x.hub_pick)) errors.push(`${x.cohort}: hub_pick ${x.hub_pick}`)
    if (x.cohort !== 'MARKET' && !(rev.nodes.find(p => p.cohort === x.parent_1).layer <= x.layer)) errors.push(`${x.cohort}: hangs from a deeper layer`)
    if (x.layer >= 3 && x.parent_1 === 'MARKET') errors.push(`${x.cohort}: hangs from THE MARKET, not through the index layer`)
  }
  const d = diffTrees(base, rev)
  if (d.member_removed.length) errors.push(`member rows lost: ${d.member_removed.map(m => m.cohort + '|' + m.ticker)}`)
  const co = (t) => new Set(t.members.filter(m => m.role === 'member').map(m => m.ticker))
  const a = co(base); const b = co(rev)
  if (a.size !== b.size || [...a].some(t => !b.has(t))) errors.push('the set of companies changed')
  for (const m of rev.members) if (m.status === 'pending_admission' && !base.members.some(x => x.ticker === m.ticker && x.status === 'pending_admission')) errors.push(`${m.ticker}: a new pending row (TR1's after-admission step is blanket)`)
  const served = new Set(base.members.map(m => m.ticker))
  for (const k of rev.candidates) { if (served.has(k.ticker)) errors.push(`candidate ${k.ticker} is already in the tree`); if (!ids.has(k.cohort)) errors.push(`candidate ${k.ticker}: ${k.cohort} is not a node`) }
  for (const l of rev.links) if (!ids.has(l.cohort) || !ids.has(l.fund_node)) errors.push(`link ${l.fund}→${l.cohort}: not a node`)
  return errors
}

export function loadInputs () {
  const universe = J(`${CO1}/data/universe-20261006.json`)
  const base = buildTree({ proposal: J(`${CO1}/proposal.json`), indexLayer: J(`${TR1}/index-layer.json`), served: universe.symbols })
  return { base, holdings: J('deliverables/20260928/coverage-tree/data/holdings.json'), consumer: J(`${TR2}/consumer-gaps.json`) }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { base, holdings, consumer } = loadInputs()
  const rev = reviseTree({ base, holdings, consumer })
  const errors = validateRevision(base, rev); const d = diffTrees(base, rev)
  const by = (arr, k) => arr.reduce((o, r) => (o[r[k]] = (o[r[k]] ?? 0) + 1, o), {})
  const plan = {
    nodes: { tr1: base.nodes.length, tr2: rev.nodes.length, added: d.nodes_added.map(n => n.cohort), removed: d.nodes_removed.map(n => n.cohort), changed: d.nodes_changed.map(n => n.cohort) },
    members: { tr1: base.members.length, tr2: rev.members.length, moved: d.member_moves.length, added: d.member_adds.map(m => `${m.cohort}|${m.ticker}`), removed: d.member_removed.length },
    by_layer: by(rev.nodes, 'layer'), hub_pick: by(rev.nodes, 'hub_pick'), hub_pick_source: by(rev.nodes, 'hub_pick_source'),
    links: rev.links.length, candidates: rev.candidates.length, errors
  }
  if (errors.length) { console.log(JSON.stringify(plan, null, 1)); console.error('REFUSED: the revised tree does not validate'); process.exit(2) }
  if (process.argv.includes('--write')) {
    writeFileSync(join(ROOT, `${TR2}/revised-tree.json`), JSON.stringify({ what: 'TR2: the tree revised on Alan\'s 6 Oct notes. Generated by scripts/cohort-tree-revise.mjs from TR1\'s tree, the funds\' holdings and consumer-gaps.json. Nothing here is written to any table.', source: SOURCE, plan, nodes: rev.nodes, members: rev.members, links: rev.links, candidates: rev.candidates, diff: d }, null, 1) + '\n')
    plan.wrote = `${TR2}/revised-tree.json`
  }
  console.log(JSON.stringify(plan, null, 1))
}
