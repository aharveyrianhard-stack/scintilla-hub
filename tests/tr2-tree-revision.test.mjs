// TR2 (6 Oct 2026) — the tree revised on Alan's notes, and the migration that carries it to TR1's two tables.
// Alan: FRONTIER goes ("just a consolidation of a bunch of stuff"); "the index layer should go between the other
// layers and the market"; "packaged foods — where would that go?"; and his on-Hub picks, as a record only.
// And his evening steering of the same day: Amazon and Shopify "more like software names … I should share both";
// growth, momentum and low volatility "a branch, not just tags"; "PWR, not on AI powertrain. ETN, not on AI
// powertrain. I think they should be."; regulated utilities, housing, restaurants, aerospace off the Hub.
// These tests hold the revision to those notes and the SQL to the generator: nothing is typed by hand, nothing can
// reach the tables the Hub reads, and the migration is right whether TR1's after-admission step has run or not.
// Fast: no database, no network. The SQL itself is RUN in scripts/cohort-tree-revise-sql.mjs --pglite; the last test
// reads what that run recorded.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'
import { SECTORS, TR2, TR2_COLS, SOURCE, FACTOR_NODES } from '../scripts/cohort-tree-revise.mjs'
import { build, sqlFiles, sha, FILES, DRY_RUN, GUARD_KEYS } from '../scripts/cohort-tree-revise-sql.mjs'

const U = (p) => new URL('../' + p, import.meta.url)
const T = (p) => readFileSync(U(p), 'utf8')
const J = (p) => JSON.parse(T(p))
const { base, rev, diff, errors, files } = build()
const N = Object.fromEntries(rev.nodes.map(n => [n.cohort, n]))
const noComments = (s) => s.replace(/^\s*--.*$/gm, '')
const near = (a, b, what) => assert.ok(Math.abs(a - b) <= 0.01 + 1e-9, `${what}: quoted ${a}, the file says ${b}`)
const companies = (t) => new Set(t.members.filter(m => m.role === 'member').map(m => m.ticker))

test('the revised tree validates, and the counts are the ones the migration is written for', () => {
  assert.deepEqual(errors, [])
  assert.deepEqual([base.nodes.length, base.members.length], [91, 771])
  assert.deepEqual([rev.nodes.length, rev.members.length, rev.links.length, rev.candidates.length, rev.tags.length], [109, 1120, 359, 82, 453])
  assert.deepEqual([diff.nodes_added.length, diff.nodes_removed.length, diff.nodes_changed.length, diff.member_moves.length, diff.member_adds.length, diff.member_removed.length], [23, 5, 24, 60, 349, 0])
  // the evening steering is the difference from the afternoon's revision (19 new nodes, 20 changed, 10 new member rows):
  // 4 nodes (three factor branches, FUEL CELLS & STORAGE), 4 changed (AI POWERTRAIN and the three cohorts now under it),
  // and member rows that are every one a served name already in the tree
  const factorRows = rev.members.filter(m => m.cohort.startsWith('IDX_FACTOR_')).length
  assert.equal(diff.member_adds.length, 10 + 5 + 2 + 8 + factorRows, 'staples 10, platforms 5, fuel cells 2, grid names into AI POWERTRAIN 8, the factor branch')
  for (const n of rev.nodes) for (const c of TR2_COLS) assert.ok(c in n, `${n.cohort}.${c}`)
})

test('FRONTIER is gone; its four cohorts hang where the transform puts them, each with a reason', () => {
  assert.equal(N.FRONTIER, undefined)
  assert.ok(!rev.nodes.some(n => n.parent_1 === 'FRONTIER' || n.parent_2 === 'FRONTIER'))
  assert.deepEqual([N.AEROSPACE_DEFENCE.kind, N.AEROSPACE_DEFENCE.parent_1], ['heading', 'INDUSTRIAL'])
  const want = { SPACE: ['AEROSPACE_DEFENCE', null], QUANTUM: ['TECH', null], AUTONOMY_EVTOL: ['AEROSPACE_DEFENCE', null], DEFENCE_TECH: ['AEROSPACE_DEFENCE', 'SOFTWARE_INTERNET'] }
  for (const [id, [p1, p2]] of Object.entries(want)) {
    assert.deepEqual([N[id].parent_1, N[id].parent_2], [p1, p2], id)
    assert.ok(N[id].parent_why && N[id].parent_why.length > 40, `${id}: no reason given`)
    assert.equal(base.nodes.find(n => n.cohort === id).parent_1, 'FRONTIER', `${id} was a FRONTIER cohort`)
  }
  assert.equal(N.DEFENCE_PRIMES.parent_1, 'AEROSPACE_DEFENCE')
  assert.ok(N.DEFENCE_PRIMES.parent_why)
})

test('every number quoted in the four re-homing reasons agrees with frontier-rehome.json to 0.01', () => {
  const fr = J(`${TR2}/frontier-rehome.json`)
  const fund = (c, f) => fr['1_and_3_baskets_vs_candidate_parent_funds'][c].funds.find(x => x.fund === f)
  const cross = (c, other) => fr['2_and_3_baskets_vs_other_topic_cohorts'][c].closest8_raw.find(x => x.cohort === other).corr_raw
  const M = fr['4_members']
  const together = (c) => fr.co1_reproduction.the_four_plus_primes.find(x => x.cohort === c).co1_avg_pair_corr
  const industrials = fr.co1_reproduction.sectors.find(s => s.sector === 'Industrials').co1_avg_pair_corr
  const heldBy = (c, family, f) => M[c].members.filter(m => (m[family] ?? {})[f] > 0).map(m => m.ticker).sort()
  // every numeral in each text, in the order it is written, with where frontier-rehome.json holds it.
  // Quoted numbers this test could NOT locate in the file: none. (Counts written as words are checked below too:
  // QUANTUM "all four", AUTONOMY "the four aircraft makers … three of them", DEFENCE_TECH's three ITA names.)
  const quoted = {
    SPACE: [[7, M.SPACE.fmp_industry_counts['Aerospace & Defense']], [11, M.SPACE.members.length], [6, heldBy('SPACE', 'sector_funds_vanguard', 'VIS').length], [3, heldBy('SPACE', 'theme_funds', 'ITA').length],
      [0.33, fund('SPACE', 'XLI').corr_raw], [-0.06, fund('SPACE', 'XLI').corr_resid], [0.81, fund('SPACE', 'ARKX').corr_raw], [0.66, cross('SPACE', 'AUTONOMY_EVTOL')], [0.66, together('SPACE')], [0.22, industrials]],
    QUANTUM: [[4, M.QUANTUM.fmp_industry_counts['Computer Hardware']], [0.64, fund('QUANTUM', 'VGT').corr_raw], [0.38, fund('QUANTUM', 'VGT').corr_resid], [-0.22, fund('QUANTUM', 'XLI').corr_resid], [0.87, together('QUANTUM')]],
    AUTONOMY_EVTOL: [[0.37, fund('AUTONOMY_EVTOL', 'XLI').corr_raw], [-0.14, fund('AUTONOMY_EVTOL', 'XLI').corr_resid], [0.77, cross('AUTONOMY_EVTOL', 'QUANTUM')], [0.80, fund('AUTONOMY_EVTOL', 'ARKX').corr_raw], [0.46, together('AUTONOMY_EVTOL')], [0.22, industrials]],
    DEFENCE_TECH: [[0.47, fund('DEFENCE_TECH', 'ITA').corr_raw], [0.37, fund('DEFENCE_TECH', 'ITA').corr_resid], [0.60, fund('DEFENCE_TECH', 'IGV').corr_raw], [0.58, fund('DEFENCE_TECH', 'IGV').corr_resid],
      [9.18, M.DEFENCE_TECH.members.find(m => m.ticker === 'PLTR').theme_funds.IGV], [0.43, together('DEFENCE_TECH')], [0.22, industrials]]
  }
  for (const [id, list] of Object.entries(quoted)) {
    const inText = [...N[id].parent_why.matchAll(/[−+-]?\d+(?:\.\d+)?/g)].map(x => Number(x[0].replace('−', '-').replace('+', '')))
    assert.deepEqual(inText, list.map(x => x[0]), `${id}: the reason quotes a number this test does not check`)
    list.forEach(([said, held], i) => { assert.equal(typeof held, 'number', `${id} #${i}: not found in the file`); near(said, held, `${id} #${i}`) })
  }
  assert.equal(M.QUANTUM.fmp_sector_counts.Technology, 4)
  assert.equal(heldBy('QUANTUM', 'sector_funds_vanguard', 'VGT').length, 4, 'Vanguard\'s technology fund holds all four')
  const makers = M.AUTONOMY_EVTOL.members.filter(m => ['JOBY', 'ACHR', 'EVTL', 'EH'].includes(m.ticker))
  assert.deepEqual([makers.length, makers.filter(m => m.fmp_sector === 'Industrials').length, makers.filter(m => m.fmp_industry === 'Aerospace & Defense').length], [4, 4, 3])
  assert.deepEqual(heldBy('DEFENCE_TECH', 'theme_funds', 'ITA'), ['AVAV', 'AXON', 'KTOS'])
  assert.deepEqual([fr.method.window.sessions, fr.method.window.first_return_date, fr.method.window.last_return_date], [126, '2026-04-07', '2026-10-05'])
})

test('the index layer sits between THE MARKET and everything else: every layer-3 node reaches MARKET only through INDEX_LAYER', () => {
  const paths = (id) => {                              // every way up, by first and second parents
    if (id === 'MARKET') return [['MARKET']]
    return [N[id].parent_1, N[id].parent_2].filter(Boolean).flatMap(p => paths(p).map(rest => [id, ...rest]))
  }
  const layer3 = rev.nodes.filter(n => n.layer === 3)
  assert.equal(layer3.length, 15)
  for (const n of rev.nodes.filter(x => x.layer >= 3)) {
    const up = paths(n.cohort)
    assert.ok(up.length >= 1, n.cohort)
    for (const p of up) assert.ok(p.includes('INDEX_LAYER'), `${n.cohort} reaches MARKET without the index layer: ${p.join(' → ')}`)
    assert.notEqual(n.parent_1, 'MARKET', n.cohort); assert.notEqual(n.parent_2, 'MARKET', n.cohort)
  }
  assert.deepEqual(rev.nodes.filter(n => n.parent_1 === 'MARKET').map(n => n.cohort), ['INDEX_LAYER'])
  assert.deepEqual(rev.nodes.filter(n => n.layer === 2).map(n => n.cohort), SECTORS.map(s => s[0]))
  for (const s of SECTORS) assert.equal(N[s[0]].parent_1, 'IDX_SECTOR_FUNDS')
})

test('the 44 sector funds sit in the eleven sector nodes, four each, and TR1\'s four by-family sets are gone', () => {
  const funds = new Set()
  for (const [id, , ...four] of SECTORS) {
    const rows = rev.members.filter(m => m.cohort === id)
    assert.deepEqual(rows.map(m => m.ticker).sort(), [...four].sort(), id)
    for (const m of rows) { assert.equal(m.role, 'index_fund'); funds.add(m.ticker) }
  }
  assert.equal(funds.size, 44)
  const sets = ['IDX_SECTOR_SPDR', 'IDX_SECTOR_EQUAL_WEIGHT', 'IDX_SECTOR_VANGUARD', 'IDX_SECTOR_ISHARES']
  assert.deepEqual(new Set(base.members.filter(m => sets.includes(m.cohort)).map(m => m.ticker)), funds)
  for (const id of sets) assert.equal(N[id], undefined)
  assert.deepEqual(diff.nodes_removed.map(n => n.cohort).sort(), ['FRONTIER', ...sets].sort())
})

test('CONSUMER STAPLES is a sub-heading; all 16 of its old names land in exactly one of the seven groups', () => {
  const groups = rev.nodes.filter(n => n.parent_1 === 'STAPLES').map(n => n.cohort)
  assert.equal(groups.length, 7)
  assert.ok(groups.includes('PACKAGED_FOODS'))
  assert.equal(N.STAPLES.kind, 'heading')
  assert.equal(N.STAPLES.parent_1, 'CONSUMER')
  const old = base.members.filter(m => m.cohort === 'STAPLES' && m.role === 'member').map(m => m.ticker)
  assert.equal(old.length, 16)
  for (const t of old) assert.equal(rev.members.filter(m => m.ticker === t && m.role === 'member' && groups.includes(m.cohort)).length, 1, t)
  // no company is left on the heading itself; the two rows that stay are its reference lines (TR1's rows, not lost)
  assert.deepEqual(rev.members.filter(m => m.cohort === 'STAPLES').map(m => `${m.ticker} ${m.role}`).sort(), ['VDC reference', 'XLP reference'])
})

test('no member row was lost and the set of companies is unchanged (453)', () => {
  assert.equal(diff.member_removed.length, 0)
  const a = companies(base); const b = companies(rev)
  assert.equal(a.size, 453)
  assert.deepEqual([...b].sort(), [...a].sort())
  // every TR1 row is still there, in its old cohort or the one it moved to, with role, status and why untouched
  const moved = Object.fromEntries(diff.member_moves.map(m => [`${m.from}|${m.ticker}`, m.to]))
  for (const m of base.members) {
    const now = rev.members.find(x => x.ticker === m.ticker && x.cohort === (moved[`${m.cohort}|${m.ticker}`] ?? m.cohort))
    assert.ok(now, `${m.cohort}|${m.ticker}`)
    assert.deepEqual([now.role, now.status, now.near_copy_of, now.why], [m.role, m.status, m.near_copy_of, m.why], `${m.cohort}|${m.ticker}`)
  }
  assert.ok(diff.member_adds.every(m => m.status === 'served'))
})

test('no candidate is a served name, and every candidate sits beside a real node', () => {
  const served = new Set(J('deliverables/20261006/cohort-proposal/data/universe-20261006.json').symbols)
  const inTree = new Set(rev.members.map(m => m.ticker))
  for (const k of rev.candidates) { assert.ok(!served.has(k.ticker), `${k.ticker} is served`); assert.ok(!inTree.has(k.ticker), `${k.ticker} is in the tree`); assert.ok(N[k.cohort], k.cohort) }
  assert.equal(new Set(rev.candidates.map(k => `${k.cohort}|${k.ticker}`)).size, 82)
  assert.deepEqual(rev.candidates.slice(-7).map(k => `${k.cohort}|${k.ticker}`), ['GRID_ELECTRICAL|GNRC', 'GRID_ELECTRICAL|POWL', 'FUEL_CELLS_STORAGE|FLNC', 'FUEL_CELLS_STORAGE|PLUG', 'INTERNET_PLATFORMS|EBAY', 'INTERNET_PLATFORMS|CPNG', 'INTERNET_PLATFORMS|SE'])
  for (const k of rev.candidates.slice(-7)) assert.match(k.basis, /from memory, not a provider read$/, k.ticker)
  assert.ok(rev.candidates.some(k => k.cohort === 'PACKAGED_FOODS'))
})

test('links recomputed here from holdings.json equal links[] for five (fund, cohort) pairs', () => {
  const H = J('deliverables/20260928/coverage-tree/data/holdings.json').data
  const fold = (t) => String(t).toUpperCase().replace(/\./g, '-')
  const under = (id, out = new Set()) => {            // the node's companies and those of everything hanging from it first
    for (const m of rev.members) if (m.cohort === id && m.role === 'member') out.add(m.ticker)
    for (const k of rev.nodes) if (k.parent_1 === id) under(k.cohort, out)
    return out
  }
  for (const [f, c] of [['XLK', 'AI'], ['XLI', 'AEROSPACE_DEFENCE'], ['VGT', 'QUANTUM'], ['SPY', 'MAG7'], ['XLP', 'PACKAGED_FOODS']]) {
    const w = {}
    for (const [t, x] of H[f].h) if (x > 0 && fold(t) !== f) w[fold(t)] = (w[fold(t)] ?? 0) + x
    const names = [...under(c)]; const held = names.filter(t => (w[fold(t)] ?? 0) > 0)
    const l = rev.links.find(x => x.fund === f && x.cohort === c)
    assert.ok(l, `${f} → ${c}`)
    assert.equal(l.fund_weight_pct, Math.round(held.reduce((s, t) => s + w[fold(t)], 0) * 1000) / 1000, `${f} → ${c} weight`)
    assert.deepEqual([l.names_held, l.node_names], [held.length, names.length], `${f} → ${c} names`)
  }
})

test('links agree with the analyst\'s independent fund-links.json wherever both have the pair, except STAPLES', () => {
  const fl = J(`${TR2}/fund-links.json`)
  const mine = Object.fromEntries(rev.links.map(l => [`${l.fund}|${l.cohort}`, l]))
  let both = 0
  for (const a of fl.links) {
    const l = mine[`${a.fund}|${a.cohort}`]
    if (!l || ['STAPLES', 'AI_POWERTRAIN', 'INTERNET_PLATFORMS'].includes(a.cohort)) continue   // STAPLES was one cohort of 16 names there, here a heading of seven; the evening steering added names to the other two
    both++
    assert.ok(Math.abs(l.fund_weight_pct - a.fund_weight_pct) <= 0.0011, `${a.fund} → ${a.cohort}: ${l.fund_weight_pct} against ${a.fund_weight_pct}`)
    assert.deepEqual([l.names_held, l.node_names], [a.names_held, a.cohort_names], `${a.fund} → ${a.cohort}`)
  }
  assert.ok(both >= 150, `only ${both} pairs in both`)
  // headings: only where the revision left the heading's set of companies as the analyst had it
  const namesUnder = (t, id, out = new Set()) => { for (const m of t.members) if (m.cohort === id && m.role === 'member') out.add(m.ticker); for (const k of t.nodes) if (k.parent_1 === id) namesUnder(t, k.cohort, out); return out }
  let heads = 0
  for (const a of fl.heading_links) {
    const l = mine[`${a.fund}|${a.heading}`]
    if (!l || a.heading === 'STAPLES' || !N[a.heading]) continue
    const was = [...namesUnder(base, a.heading)].sort(); const is = [...namesUnder(rev, a.heading)].sort()
    if (was.join() !== is.join()) continue
    heads++
    assert.ok(Math.abs(l.fund_weight_pct - a.fund_weight_pct) <= 0.0011, `${a.fund} → ${a.heading}: ${l.fund_weight_pct} against ${a.fund_weight_pct}`)
    assert.equal(l.names_held, a.names_held, `${a.fund} → ${a.heading}`)
  }
  assert.ok(heads >= 20, `only ${heads} heading pairs in both`)
})

test('hub_pick records Alan\'s words and stretches them no further', () => {
  const named = { AI: 'on', SEMIS: 'on', SOFTWARE_INTERNET: 'on', GRID_ELECTRICAL: 'on', FINANCE: 'on', HEALTH: 'on',
    OIL_UPSTREAM: 'off', OIL_MIDSTREAM: 'off', OIL_REFINERS: 'off', OIL_SERVICES: 'off', MATERIALS_METALS: 'off', INDUSTRIAL: 'off', REAL_ESTATE: 'off' }
  assert.equal(Object.keys(named).length, 13)
  for (const [id, pick] of Object.entries(named)) {
    assert.deepEqual([N[id].hub_pick, N[id].hub_pick_source], [pick, 'named'], id)
    assert.match(N[id].hub_pick_note, /^Alan, 6 Oct: /, id)
  }
  // the evening's four: in the tree for the regime read, off the Hub
  const regimeOnly = ['REGULATED_UTILITIES', 'HOUSING', 'RESTAURANTS', 'AEROSPACE_DEFENCE']
  for (const id of regimeOnly) {
    assert.deepEqual([N[id].hub_pick, N[id].hub_pick_source], ['off', 'named'], id)
    assert.match(N[id].hub_pick_note, /^Alan, 6 Oct ~19:20 ET: .*in the tree for the regime read, off the Hub$/, id)
    named[id] = 'off'
  }
  assert.deepEqual(rev.nodes.filter(n => n.hub_pick_source === 'named').map(n => n.cohort).sort(), Object.keys(named).sort())
  assert.match(N.HEALTH.hub_pick_note, /PARTLY/)
  for (const id of ['OIL_UPSTREAM', 'OIL_MIDSTREAM', 'OIL_REFINERS', 'OIL_SERVICES']) assert.match(N[id].hub_pick_note, /kept statistically sound/, id)
  for (const id of ['DC_PROPERTY', 'ROBOTICS_AUTOMATION']) {
    assert.deepEqual([N[id].hub_pick, N[id].hub_pick_source], ['undecided', 'parents_disagree'], id)
    assert.match(N[id].hub_pick_note, /its two parents disagree: AI is on, .* is off/, id)
  }
  for (const id of ['SPACE', 'QUANTUM', 'AUTONOMY_EVTOL', 'DEFENCE_TECH']) {
    assert.deepEqual([N[id].hub_pick, N[id].hub_pick_source], ['undecided', 'not_said'], id)
    assert.match(N[id].hub_pick_note, /moved here from FRONTIER/, id)
  }
  for (const n of rev.nodes) assert.ok(['on', 'off', 'undecided'].includes(n.hub_pick), n.cohort)
  for (const n of rev.nodes.filter(x => x.layer <= 2)) assert.equal(n.hub_pick, 'undecided', `${n.cohort}: the index layer was not picked`)
})

test('the SQL on disk is exactly what the generator emits, and the generator is a pure function of the two trees', () => {
  assert.equal(T(FILES.forward), files.forward)
  assert.equal(T(FILES.rollback), files.rollback)
  assert.equal(T(FILES.undoAfterAdmission), files.undoAfterAdmission)
  assert.deepEqual(sqlFiles({ base, rev, diff }), files)
  for (const f of Object.values(files)) { assert.equal(f.match(/^begin;$/gm).length, 1); assert.equal(f.match(/^commit;$/gm).length, 1); assert.ok(f.trimEnd().endsWith('commit;')) }
})

test('the SQL names only TR1\'s two tables and TR2\'s four, and never the tables the Hub reads', () => {
  const sql = noComments(files.forward + files.rollback + files.undoAfterAdmission)
  assert.doesNotMatch(sql, /ticker_cohorts/)
  assert.doesNotMatch(sql, /\btickers\b/)
  const named = new Set([...sql.matchAll(/\bpublic\.([a-z0-9_]+)/g)].map(m => m[1]))
  assert.deepEqual([...named].sort(), ['cohort_tree', 'cohort_tree_candidates', 'cohort_tree_fund_links', 'cohort_tree_members', 'cohort_tree_name_tags', 'cohort_tree_tr2_removed'])
  // every table a statement acts on is written public.<name>: nothing reaches a table by a bare name
  // (quoted text is taken out first: a reason such as "…join here." is words, not SQL)
  const bare = sql.replace(/'(?:[^']|'')*'/g, "''")
  const acted = [...bare.matchAll(/\b(?:insert into|delete from|update|join|alter table|drop table(?: if exists)?|create table(?: if not exists)?|references|truncate)\s+(?:only\s+)?([a-z0-9_."]+)/g)].map(m => m[1])
  assert.ok(acted.length > 40)
  for (const t of acted) assert.match(t, /^public\.cohort_tree(_members|_fund_links|_candidates|_name_tags|_tr2_removed)?$/, t)
  assert.doesNotMatch(sql, /\btruncate\b|\bcascade\b|\bcreate (?:or replace )?(?:function|view|trigger)\b|\bcron\b/)
  assert.deepEqual(new Set([...noComments(files.undoAfterAdmission).matchAll(/\bpublic\.([a-z0-9_]+)/g)].map(m => m[1])), new Set(['cohort_tree', 'cohort_tree_members']))
})

test('the forward file never assigns status or spine_fund_next, and never tests them on a row it does not change', () => {
  const sql = noComments(files.forward)
  const sets = [...sql.matchAll(/\bupdate\s+public\.[a-z_]+(?:\s+[a-z])?\s+set\s+([\s\S]*?)(?=\n|\bwhere\b|\bfrom\b)/g)].map(m => m[1])
  assert.equal(sets.length, diff.nodes_changed.length + 2, 'the changed nodes, the member move and the marking of every node')
  for (const s of sets) assert.doesNotMatch(s, /\b(status|spine_fund_next)\s*=/, s)
  assert.doesNotMatch(sql, /\bset\s+[^;]*\bstatus\s*=/)
  assert.doesNotMatch(sql, /pending_admission'\s*(,|\))/, 'no row is written as pending')
  // the one insert into cohort_tree does not name spine_fund_next; the member insert writes only served rows
  assert.match(sql, /insert into public\.cohort_tree \(cohort,label,kind,parent_1,parent_2,spine,spine_fund,source\) values/)
  assert.equal(sql.match(/insert into public\.cohort_tree \(/g).length, 1)
  assert.ok(diff.member_adds.every(m => m.status === 'served'))
  // status is only ever COUNTED (pending at entry, pending at the end)
  assert.deepEqual([...sql.matchAll(/[^\n]*\bstatus\b[^\n]*/g)].map(m => m[0].trim()).filter(l => !/^select count\(\*\) into (pending_at_entry|k) from public\.cohort_tree_members where status = 'pending_admission';$/.test(l) && !/^insert into public\.cohort_tree_members \(cohort,ticker,role,status,near_copy_of,why,source\) values$/.test(l)), [])
  // none of the 25 nodes whose TR1 values it tests is one TR1's after-admission step changes
  const handover = new Set(base.nodes.filter(n => n.spine_fund_next != null).map(n => n.cohort))
  assert.deepEqual([...handover].sort(), ['ASIA_PACIFIC', 'CANADA', 'IDX_WORLD', 'LATAM'])
  for (const id of [...diff.nodes_changed.map(c => c.cohort), ...diff.nodes_removed.map(n => n.cohort)]) assert.ok(!handover.has(id), id)
  for (const c of diff.nodes_changed) assert.ok(!('spine_fund_next' in c.after), c.cohort)
  const pending = new Set(base.members.filter(m => m.status === 'pending_admission').map(m => `${m.cohort}|${m.ticker}`))
  assert.equal(pending.size, 10)
  for (const m of diff.member_moves) assert.ok(!pending.has(`${m.from}|${m.ticker}`), m.ticker)
})

test('the three foreign keys that close TR1\'s LOAD and ROLLBACK are named, not cascading, not deferrable', () => {
  const sql = noComments(files.forward)
  for (const k of Object.values(GUARD_KEYS)) { assert.ok(k.length <= 63, `${k} is longer than Postgres keeps`); assert.match(k, /_tr2_roll_back_tr2_first$/); assert.ok(sql.includes(`constraint ${k} foreign key`), k) }
  const table = sql.slice(sql.indexOf('create table if not exists public.cohort_tree_fund_links'), sql.indexOf('comment on table public.cohort_tree_fund_links'))
  assert.doesNotMatch(table, /on delete|deferrable/)
  assert.match(sql, /constraint cohort_tree_hub_pick_check check \(hub_pick in \('on','off','undecided'\)\)/)
  for (const c of TR2_COLS) assert.match(sql, new RegExp(`add column if not exists ${c} `), c)
  for (const t of ['cohort_tree_fund_links', 'cohort_tree_candidates', 'cohort_tree_name_tags', 'cohort_tree_tr2_removed']) { assert.ok(sql.includes(`alter table public.${t} enable row level security;`), t); assert.match(sql, new RegExp(`^comment on table public\\.${t} is '.*Not read by the Hub\\.';$`, 'm'), t) }
  assert.deepEqual([...sql.matchAll(/create policy ([a-z_]+)/g)].map(m => m[1]).sort(), ['cohort_tree_candidates_read', 'cohort_tree_fund_links_read', 'cohort_tree_name_tags_read'])
  assert.ok(sql.includes(`default '${SOURCE}'`))
})

test('the rollback undoes exactly what the forward file does; the undo file is built from TR1\'s own tree', () => {
  const f = noComments(files.forward); const r = noComments(files.rollback); const u = noComments(files.undoAfterAdmission)
  const created = [...f.matchAll(/create table if not exists public\.([a-z0-9_]+)/g)].map(m => m[1]).sort()
  assert.deepEqual([...r.matchAll(/drop table public\.([a-z0-9_]+)/g)].map(m => m[1]).sort(), created)
  for (const c of TR2_COLS) assert.ok(r.includes(`drop column if exists ${c}`), c)
  assert.ok(r.includes('drop constraint if exists cohort_tree_hub_pick_check'))
  for (const c of diff.nodes_changed) for (const [col, v] of Object.entries(c.before)) assert.ok(r.includes(`${col} = ${v == null ? 'null' : `'${String(v).replace(/'/g, "''")}'`}`) && r.includes(`where cohort = '${c.cohort}';`), `${c.cohort}.${col}`)
  assert.doesNotMatch(r, /\bset\s+[^;]*\bstatus\s*=/)
  assert.doesNotMatch(r, /spine_fund_next\s*=/)
  for (const m of base.members.filter(x => x.status === 'pending_admission')) assert.ok(u.includes(`('${m.cohort}'`) && u.includes(`'${m.ticker}'`), m.ticker)
  for (const n of base.nodes.filter(x => x.spine_fund_next != null)) assert.ok(u.includes(`'${n.cohort}'`) && u.includes(`'${n.spine_fund}'`) && u.includes(`'${n.spine_fund_next}'`), n.cohort)
  assert.equal(u.match(/set status = 'pending_admission'/g).length, 1)
})

test('revised-tree.json on disk equals the transform\'s output', () => {
  const disk = J(`${TR2}/revised-tree.json`)
  assert.equal(disk.source, SOURCE)
  assert.deepEqual(disk.nodes, JSON.parse(JSON.stringify(rev.nodes)))
  assert.deepEqual(disk.members, JSON.parse(JSON.stringify(rev.members)))
  assert.deepEqual(disk.links, JSON.parse(JSON.stringify(rev.links)))
  assert.deepEqual(disk.candidates, JSON.parse(JSON.stringify(rev.candidates)))
  assert.deepEqual(disk.diff, JSON.parse(JSON.stringify(diff)))
})

test('no Hub page reads the tree: the board page and its trial copy never name cohort_tree', () => {
  for (const p of ['index.html', 'preview/company-view/index.html']) assert.doesNotMatch(T(p), /cohort_tree/, p)
})

test('the dry run was made on the SQL that is on disk, and every scenario in it is ok', () => {
  assert.ok(existsSync(U(DRY_RUN)), `${DRY_RUN} is missing: run node scripts/cohort-tree-revise-sql.mjs --write --pglite <dir>`)
  const dry = J(DRY_RUN)
  assert.match(dry.engine, /PGlite/)
  assert.deepEqual(Object.keys(dry.scenarios), ['A', 'B', 'C', 'D', 'E', 'F'])
  for (const [k, s] of Object.entries(dry.scenarios)) assert.equal(s.ok, true, `scenario ${k}`)
  assert.equal(dry.all_ok, true)
  assert.deepEqual([dry.sql_sha256.forward, dry.sql_sha256.rollback, dry.sql_sha256.undoAfterAdmission], [sha(files.forward), sha(files.rollback), sha(files.undoAfterAdmission)], 'the SQL changed after the dry run: run it again')
  const { A, B, C, D, E, F } = dry.scenarios
  assert.deepEqual([A.after_forward.nodes, A.after_forward.members, A.after_forward.pending, A.after_forward.links, A.after_forward.candidates, A.after_forward.tags], [109, 1120, 10, 359, 82, 453])
  // what the throw-away database held after the forward file, for the evening steering
  const st = A.checks.steering
  assert.deepEqual(st.ai_powertrain_groups, ['FUEL_CELLS_STORAGE', 'GRID_ELECTRICAL', 'NUCLEAR_URANIUM', 'POWER_GENERATORS'])
  assert.deepEqual([st.ai_powertrain_names, st.regulated_utilities_in_ai_powertrain, st.name_tags], [20, 0, 453])
  assert.deepEqual(st.platforms_under_both_parents, ['AMZN', 'BABA', 'JD', 'MELI', 'PDD', 'SHOP'])
  assert.deepEqual(Object.keys(st.factor_branch), ['GROWTH', 'LOW VOLATILITY', 'MOMENTUM'])
  assert.deepEqual([st.factor_branch.GROWTH.fund_lines, st.factor_branch.MOMENTUM.fund_lines, st.factor_branch['LOW VOLATILITY'].fund_lines], ['VTV VUG', 'MTUM', 'QUAL SPLV'])
  assert.deepEqual(st.off_the_hub_regime_only, ['AEROSPACE_DEFENCE', 'HOUSING', 'REGULATED_UTILITIES', 'RESTAURANTS'])
  assert.equal(A.fingerprint_equals_before_forward, true)
  assert.equal(A.forward_again.changed_anything, false); assert.equal(A.rollback_again.changed_anything, false)
  assert.deepEqual([B.middle.nodes, B.middle.members, B.middle.pending, B.middle.spines.IDX_WORLD], [109, 1120, 0, 'ACWI → null'])
  assert.equal(B.fingerprint_equals_reference, true)
  assert.deepEqual([C.after_forward.nodes, C.after_forward.members, C.after_forward.pending], [109, 1120, 0])
  assert.equal(C.fingerprint_equals_before_forward, true)
  assert.ok(D.cases.length >= 1 && D.cases.every(c => c.refused && c.untouched))
  assert.equal(E.tr1_load_after_tr2.failed, true); assert.equal(E.tr1_load_after_tr2.changed_anything, false)
  assert.deepEqual(E.tr1_rollback_after_tr2_statement_by_statement.tables_lost, [])
  assert.deepEqual(E.tr1_rollback_after_tr2_one_batch.tables_lost, [])
  assert.equal(E.undo_after_admission.pending_after_undo, 10)
  assert.equal(E.undo_after_admission.spines_as_tr1_loaded, true)
  assert.equal(F.distinct_fingerprints_seen, 1)
})

// ── THE EVENING STEERING (6 Oct 18:10 – 19:20 ET) ───────────────────────────────────────────────────────────────
const membersOf = (id) => rev.members.filter(m => m.cohort === id && m.role === 'member').map(m => m.ticker)
const under = (id) => { const out = new Set(); const walk = (c) => { for (const t of membersOf(c)) out.add(t); for (const k of rev.nodes) if (k.parent_1 === c) walk(k.cohort) }; walk(id); return out }

test('Amazon, Shopify and the other online marketplaces sit under SOFTWARE & INTERNET and CONSUMER at once, and keep their first home', () => {
  assert.deepEqual([N.INTERNET_PLATFORMS.parent_1, N.INTERNET_PLATFORMS.parent_2], ['SOFTWARE_INTERNET', 'CONSUMER'])
  assert.match(N.INTERNET_PLATFORMS.parent_why, /I should share both/)
  const inP = new Set(membersOf('INTERNET_PLATFORMS'))
  const firstHome = { AMZN: 'MAG7', SHOP: 'CANADA', MELI: 'LATAM', BABA: 'CHINA', JD: 'CHINA', PDD: 'CHINA' }
  for (const [t, home] of Object.entries(firstHome)) {
    assert.ok(inP.has(t), `${t} is not in INTERNET_PLATFORMS`)
    assert.ok(rev.members.some(m => m.cohort === home && m.ticker === t && m.role === 'member'), `${t} lost ${home}`)
    assert.ok(base.members.some(m => m.cohort === home && m.ticker === t), `${t} was not in ${home} in TR1`)
  }
  for (const t of ['SHOP', 'MELI', 'BABA', 'JD', 'PDD']) assert.match(rev.members.find(m => m.cohort === 'INTERNET_PLATFORMS' && m.ticker === t).why, /^also in (CANADA|LATAM|CHINA) \(a company may sit in two cohorts\): an online marketplace/, t)
  assert.ok(rev.members.some(m => m.cohort === 'RETAIL' && m.ticker === 'AMZN'), 'Amazon keeps its consumer home too')
})

test('AI POWERTRAIN holds the grid and electrical build-out names, has four groups under it, and no regulated utility', () => {
  const own = new Set(membersOf('AI_POWERTRAIN'))
  for (const t of ['PWR', 'ETN', 'GEV', 'VRT', 'VST', 'CEG', 'BE']) assert.ok(own.has(t), `${t} is not on AI POWERTRAIN`)
  const groups = rev.nodes.filter(n => n.parent_1 === 'AI_POWERTRAIN').map(n => n.cohort).sort()
  assert.deepEqual(groups, ['FUEL_CELLS_STORAGE', 'GRID_ELECTRICAL', 'NUCLEAR_URANIUM', 'POWER_GENERATORS'])
  // the four groups together are exactly the names AI POWERTRAIN holds itself: nothing in a group that is not on the cohort, nothing left over
  const inGroups = new Set(groups.flatMap(membersOf))
  assert.deepEqual([...inGroups].sort(), [...own].sort())
  assert.equal(own.size, 20)
  assert.deepEqual([N.GRID_ELECTRICAL.parent_2, N.POWER_GENERATORS.parent_2, N.NUCLEAR_URANIUM.parent_2, N.FUEL_CELLS_STORAGE.parent_2], ['INDUSTRIAL', 'ENERGY_POWER', 'ENERGY_POWER', 'ENERGY_POWER'])
  assert.deepEqual([N.AI_POWERTRAIN.parent_1, N.AI_POWERTRAIN.parent_2], ['AI', 'ENERGY_POWER'])
  assert.match(N.GRID_ELECTRICAL.parent_why, /PWR, not on AI powertrain\. ETN, not on AI powertrain\. I think they should be\./)
  // regulated utilities: in the tree, under ENERGY & POWER, off the Hub, and not one of them inside AI POWERTRAIN
  const utilities = membersOf('REGULATED_UTILITIES'); const pt = under('AI_POWERTRAIN')
  assert.equal(utilities.length, 24)
  assert.deepEqual(utilities.filter(t => pt.has(t)), [])
  assert.deepEqual([N.REGULATED_UTILITIES.parent_1, N.REGULATED_UTILITIES.parent_2, N.REGULATED_UTILITIES.hub_pick], ['ENERGY_POWER', null, 'off'])
  for (const id of ['AI_POWERTRAIN', ...groups]) assert.equal(N[id].hub_pick, 'on', id)
  // every row the steering added is a name the tree already held: no new company, nothing unserved
  for (const m of diff.member_adds.filter(m => m.role === 'member')) assert.ok(companies(base).has(m.ticker), `${m.cohort}|${m.ticker} is a new company`)
})

test('data-centre landlords sit under both AI and REAL ESTATE, and REAL ESTATE hangs from its sector fund', () => {
  assert.deepEqual([N.DC_PROPERTY.parent_1, N.DC_PROPERTY.parent_2], ['AI', 'REAL_ESTATE'])
  for (const t of ['EQIX', 'DLR', 'IRM']) assert.ok(membersOf('DC_PROPERTY').includes(t), t)
  assert.equal(N.REAL_ESTATE.parent_1, 'SECTOR_XLRE')
  assert.deepEqual(rev.nodes.filter(n => n.parent_1 === 'REAL_ESTATE').map(n => n.cohort).sort(), ['REITS', 'TOWERS'])
})

test('GROWTH, MOMENTUM and LOW VOLATILITY are a branch of the index layer whose members are assigned by rule', () => {
  const ft = J(`${TR2}/factor-tags.json`)
  const tag = Object.fromEntries(rev.tags.map(t => [t.ticker, t]))
  assert.deepEqual(FACTOR_NODES.map(f => f[0]), ['IDX_FACTOR_GROWTH', 'IDX_FACTOR_MOMENTUM', 'IDX_FACTOR_LOW_VOL'])
  for (const [id, label, key, funds] of FACTOR_NODES) {
    assert.deepEqual([N[id].label, N[id].kind, N[id].parent_1, N[id].layer, N[id].spine_fund], [label, 'cohort', 'IDX_FACTOR', 1, funds[0]], id)
    assert.match(N[id].spine, /^by rule: /, id)
    assert.deepEqual(membersOf(id), ft.branches[key].map(m => m.ticker), `${id}: the members are the tagger's list, in its order`)
    assert.deepEqual(rev.members.filter(m => m.cohort === id && m.role === 'reference').map(m => m.ticker), funds, `${id}: fund lines`)
    for (const f of funds) assert.ok(base.members.some(m => m.ticker === f && m.role === 'index_fund' && m.status === 'served'), `${f} is not a served fund of the index layer`)
    for (const t of membersOf(id)) assert.ok(companies(base).has(t), `${id}|${t} is not a company of the tree`)
  }
  assert.equal(N.IDX_FACTOR_GROWTH.parent_2, 'IDX_STYLE')
  // the rule, checked row by row against the numbers in tags[]
  const R = ft.rules
  for (const t of membersOf('IDX_FACTOR_MOMENTUM')) assert.ok(tag[t].momentum_rank >= R.momentum_top_pct, `${t}: momentum rank ${tag[t].momentum_rank}`)
  for (const t of membersOf('IDX_FACTOR_LOW_VOL')) assert.ok(tag[t].usual_day_rank <= R.low_vol_bottom_pct, `${t}: usual-day rank ${tag[t].usual_day_rank}`)
  for (const t of membersOf('IDX_FACTOR_GROWTH')) {
    if (tag[t].growth_basis === 'estimate') assert.ok(tag[t].growth_ntm_rev_pct >= R.growth_min_ntm_rev_pct, `${t}: growth ${tag[t].growth_ntm_rev_pct}`)
    else { assert.match(tag[t].growth_basis, /^index maker \(VUG holds it, VTV does not\)$/, t); assert.match(tag[t].held_by, /\bVUG \d/, t); assert.doesNotMatch(tag[t].held_by, /\bVTV \d/, t) }
  }
  // …and nobody who meets a rule was left out
  const ranked = rev.tags.filter(t => t.momentum_rank != null)
  assert.equal(ranked.filter(t => t.momentum_rank >= R.momentum_top_pct).length, membersOf('IDX_FACTOR_MOMENTUM').length)
  assert.equal(ranked.filter(t => t.usual_day_rank <= R.low_vol_bottom_pct).length, membersOf('IDX_FACTOR_LOW_VOL').length)
  // one tag row per company; a name that stopped trading carries a note and no tag
  assert.deepEqual(rev.tags.map(t => t.ticker).sort(), [...companies(rev)].sort())
  assert.equal(tag.WBD.tags, null); assert.match(tag.WBD.note, /stopped trading 6 Oct 2026/)
  for (const t of rev.tags) assert.equal(t.as_of, ft.as_of)
})

test('the six-month return and the usual day are recomputed here from the closes file for five names', () => {
  const ft = J(`${TR2}/factor-tags.json`)
  const rows = T('deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv').trim().split('\n').map(l => l.split(','))
  const head = rows[0]; const body = rows.slice(1)
  assert.equal(body.at(-1)[0], ft.as_of)
  const tag = Object.fromEntries(rev.tags.map(t => [t.ticker, t]))
  const n = ft.rules.sessions
  const usual = (t) => {
    const px = body.map(r => Number(r[head.indexOf(t)])).slice(-(n + 1))
    const moves = px.slice(1).map((v, i) => Math.abs(v / px[i] - 1) * 100).sort((a, b) => a - b)
    return { ret: (px.at(-1) / px[0] - 1) * 100, day: (moves[n / 2 - 1] + moves[n / 2]) / 2 }
  }
  const spy = usual('SPY')
  assert.ok(Math.abs(spy.day - ft.market.usual_day_pct) <= 0.005 + 1e-9, `SPY usual day ${spy.day}`)
  for (const t of ['NVDA', 'PWR', 'KO', 'AMZN', 'DUK']) {
    const u = usual(t)
    assert.ok(Math.abs(u.ret - tag[t].ret_6m_pct) <= 0.05 + 1e-9, `${t}: six-month return ${u.ret} against ${tag[t].ret_6m_pct}`)
    assert.ok(Math.abs(u.day - tag[t].usual_day_pct) <= 0.005 + 1e-9, `${t}: usual day ${u.day} against ${tag[t].usual_day_pct}`)
    assert.ok(Math.abs(tag[t].usual_day_pct / ft.market.usual_day_pct - tag[t].usual_day_vs_market) <= 0.005 + 1e-9, `${t}: against the market`)
  }
})
