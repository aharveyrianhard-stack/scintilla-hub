// TR2 (6 Oct 2026) — the tree rows for the NEXT fund batch are files for a later sitting, never for tonight.
// TR1's after-admission step is blanket: it marks every pending row served. These tests hold the batch's files to the
// rules that keep that from serving a fund nobody admitted: the pending file refuses while another fund is pending,
// the batch's own after-admission step names its funds, and a fund held back at the gate is left out of all three.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTree } from '../scripts/cohort-tree-loader.mjs'
import { reviseTree, loadInputs } from '../scripts/cohort-tree-revise.mjs'
import { buildBatch, sqlFiles, SOURCE, MIG, DRY_RUN, REF_WHY } from '../scripts/cohort-tree-next-funds-sql.mjs'

const J = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'))
const T = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const universe = J('deliverables/20261006/cohort-proposal/data/universe-20261006.json')
const nextFunds = J('deliverables/20261006/tree-revision/next-funds.json')
const indexLayer = J('deliverables/20261006/tree-adopted/index-layer.json')
const base = buildTree({ proposal: J('deliverables/20261006/cohort-proposal/proposal.json'), indexLayer, served: universe.symbols })
const rev = reviseTree({ ...loadInputs(), base })
const inputs = { nextFunds, base, rev, served: universe.symbols }
const noComments = (s) => s.replace(/^--.*$/gm, '')
const admitNext = nextFunds.admit_next.map(f => f.ticker)
// a fund held back at the sitting is written into the files' third line; the tests follow whatever is on disk
const onDisk = { pending: T(`${MIG}_PENDING.sql`), afterAdmission: T(`${MIG}_AFTER_ADMISSION.sql`), rollback: T(`${MIG}_ROLLBACK.sql`) }
const heldOnDisk = (s) => { const m = s.match(/^-- held: (.*)$/m); assert.ok(m, 'no "-- held:" line'); return m[1] === 'none' ? [] : m[1].split(',') }
const hold = heldOnDisk(onDisk.pending)
const batch = buildBatch({ ...inputs, hold })
const files = sqlFiles(batch)

test('the batch is exactly next-funds.json admit_next: 26 funds, less any held back at the gate', () => {
  assert.equal(admitNext.length, 26)
  assert.deepEqual(batch.errors, [])
  assert.deepEqual([...batch.tickers, ...batch.held].sort(), [...admitNext].sort())
  assert.equal(batch.tickers.length, 26 - hold.length)
  assert.equal(new Set(batch.tickers).size, batch.tickers.length)
  const full = buildBatch(inputs)
  assert.deepEqual(full.tickers, admitNext)
  assert.equal(full.rows.filter(r => r.role === 'index_fund').length, 26)
  assert.equal(full.rows.filter(r => r.role === 'reference').length, nextFunds.admit_next.filter(f => f.spine_for).length)
  assert.equal(full.spines.length, nextFunds.admit_next.filter(f => f.takes_over_spine).length)
})

test('none of the 26 is served today, and none is one of TR1\'s ten', () => {
  const served = new Set(universe.symbols)
  const tr1Ten = new Set(indexLayer.admit)
  assert.equal(tr1Ten.size, 10)
  const inEitherTree = new Set([...base.members, ...rev.members].map(m => m.ticker))
  for (const t of admitNext) { assert.ok(!served.has(t), `${t} is served`); assert.ok(!tr1Ten.has(t), `${t} is one of TR1's ten`); assert.ok(!inEitherTree.has(t), `${t} is already in the tree`) }
})

test('every node the files write to exists in TR1\'s tree and in the revised one, with the same spine fund today', () => {
  const B = Object.fromEntries(base.nodes.map(n => [n.cohort, n])); const R = Object.fromEntries(rev.nodes.map(n => [n.cohort, n]))
  for (const f of nextFunds.admit_next) {
    for (const id of [f.tree_node_id, f.spine_for].filter(Boolean)) { assert.ok(B[id], `${f.ticker}: ${id} not in TR1's tree`); assert.ok(R[id], `${f.ticker}: ${id} not in the revised tree`) }
    assert.match(f.tree_node_id, /^IDX_(FACTOR|MACRO|WORLD|STYLE|COUNTRIES|THEME_FUNDS)$/, f.ticker)
    assert.equal(B[f.tree_node_id].kind, 'index'); assert.equal(R[f.tree_node_id].kind, 'index')
    if (!f.spine_for) { assert.equal(f.takes_over_spine, false, f.ticker); continue }
    assert.equal(B[f.spine_for].kind, 'cohort', f.spine_for); assert.equal(R[f.spine_for].kind, 'cohort', f.spine_for)
    assert.equal(B[f.spine_for].spine_fund, R[f.spine_for].spine_fund, f.spine_for)
    assert.equal(B[f.spine_for].spine_fund_next, null, f.spine_for); assert.equal(R[f.spine_for].spine_fund_next, null, f.spine_for)
  }
  // the four cohorts TR1 left waiting for a fund are not this batch's: its hand-over can never collide with theirs
  const waiting = base.nodes.filter(n => n.spine_fund_next).map(n => n.cohort)
  assert.equal(waiting.length, 4)
  for (const s of buildBatch(inputs).spines) assert.ok(!waiting.includes(s.cohort), s.cohort)
})

test('the rows: one index-set row per fund with its "adds" line, one reference row per spine_for, all pending', () => {
  const full = buildBatch(inputs)
  for (const f of nextFunds.admit_next) {
    const own = full.rows.filter(r => r.ticker === f.ticker)
    assert.equal(own.length, f.spine_for ? 2 : 1, f.ticker)
    const idx = own.find(r => r.role === 'index_fund')
    assert.equal(idx.cohort, f.tree_node_id)
    assert.equal(idx.why, f.adds.replace(/^adds: /, '').slice(0, 240))
    assert.ok(!idx.why.startsWith('adds') && idx.why.length > 0 && idx.why.length <= 240, f.ticker)
    const ref = own.find(r => r.role === 'reference')
    if (f.spine_for) { assert.equal(ref.cohort, f.spine_for); assert.equal(ref.why, REF_WHY) } else assert.equal(ref, undefined)
    for (const r of own) { assert.equal(r.status, 'pending_admission'); assert.equal(r.source, SOURCE); assert.equal(r.near_copy_of, null) }
    assert.equal(full.spines.some(s => s.ticker === f.ticker), !!f.takes_over_spine, f.ticker)
  }
  assert.equal(SOURCE, 'TR2-NEXT-20261006')
  assert.equal(REF_WHY, base.members.find(m => m.role === 'reference').why, 'the same words TR1 uses for a reference line')
})

test('the SQL on disk is exactly what the generator emits', () => {
  assert.equal(onDisk.pending, files.pending)
  assert.equal(onDisk.afterAdmission, files.afterAdmission)
  assert.equal(onDisk.rollback, files.rollback)
  for (const s of Object.values(onDisk)) assert.deepEqual(heldOnDisk(s), hold)
})

test('the after-admission step is targeted: no statement names pending rows without this batch\'s ticker list', () => {
  const sql = noComments(files.afterAdmission)
  const statements = sql.split(';').filter(s => /pending_admission/.test(s))
  assert.ok(statements.length >= 2)
  for (const s of statements) assert.match(s, /ticker in \('[A-Z0-9]+'(,'[A-Z0-9]+')*\)/, s.trim().slice(0, 120))
  assert.doesNotMatch(sql, /where\s+status\s*=\s*'pending_admission'\s*;/)
  assert.doesNotMatch(sql, /where\s+spine_fund_next\s+is\s+not\s+null\s*;/)
  // served only for the batch's funds; a spine only on the batch's cohorts and only while it still waits for the batch's fund
  const list = batch.tickers.map(t => `'${t}'`).join(',')
  assert.ok(sql.includes(`update public.cohort_tree_members set status = 'served' where ticker in (${list}) and status = 'pending_admission';`))
  const hand = sql.split('\n').find(l => l.startsWith('update public.cohort_tree t set spine_fund = '))
  assert.match(hand, /where t\.cohort = v\.cohort and t\.spine_fund_next = v\.fund;$/)
  for (const s of batch.spines) assert.ok(hand.includes(`('${s.cohort}','${s.ticker}')`), s.cohort)
  assert.equal([...hand.matchAll(/\('[A-Z_0-9]+','[A-Z0-9]+'\)/g)].length, batch.spines.length)
  // TR1's step, for contrast, is the blanket one this file must never copy
  assert.match(T('supabase/migrations/20261006_tr1_cohort_tree_AFTER_ADMISSION.sql'), /where status = 'pending_admission';/)
})

test('the pending file refuses while another fund is pending, checks its nodes and never steals a promised spine', () => {
  const sql = noComments(files.pending)
  assert.match(sql, /^begin;/m); assert.match(sql, /^commit;/m)
  assert.match(sql, /where status = 'pending_admission' and ticker not in \(/)
  assert.match(sql, /raise exception 'TR2-NEXT refused: other funds are still pending admission/)
  assert.match(sql, /raise exception 'TR2-NEXT refused: the tree has no node/)
  assert.match(sql, /raise exception 'TR2-NEXT refused: a spine is already promised to another fund/)
  assert.match(sql, /on conflict \(cohort, ticker\) do nothing;/, 'safe to run twice')
  assert.match(sql, /set spine_fund_next = v\.fund .* and t\.spine_fund_next is null;/)
  for (const n of batch.nodes) assert.ok(sql.includes(`'${n}'`), n)
  assert.equal([...sql.matchAll(/'pending_admission',null,/g)].length, batch.rows.length)
  // the refusals come before the first write
  assert.ok(sql.indexOf('raise exception \'TR2-NEXT refused: a spine') < sql.indexOf('insert into'))
})

test('the rollback refuses once a fund is served, and offers the reverse of the admission only as a commented block', () => {
  const sql = noComments(files.rollback)
  assert.match(sql, /raise exception 'TR2-NEXT rollback refused: already served/)
  assert.ok(sql.indexOf('already served') < sql.indexOf('delete from'))
  assert.match(sql, /delete from public\.cohort_tree_members where ticker in \([^)]*\) and status = 'pending_admission' and source = 'TR2-NEXT-20261006';/)
  assert.doesNotMatch(sql, /set status = 'pending_admission'/, 'block 2 must not run with the file')
  assert.doesNotMatch(sql, /\bdrop\b|\btruncate\b/)
  for (const line of files.rollbackReverse.trimEnd().split('\n')) assert.ok(files.rollback.includes(`\n-- ${line}\n`), line.slice(0, 60))
  assert.match(files.rollbackReverse, /set status = 'pending_admission' where ticker in \([^)]*\) and status = 'served' and source = 'TR2-NEXT-20261006';/)
  for (const s of batch.spines) assert.ok(files.rollbackReverse.includes(`('${s.cohort}','${s.ticker}',${s.was == null ? 'null' : `'${s.was}'`}::text)`), s.cohort)
})

test('the files write only the two tree tables and never name ticker_cohorts or tickers', () => {
  const all = files.pending + files.afterAdmission + files.rollback + files.rollbackReverse
  assert.doesNotMatch(all, /ticker_cohorts/)
  const sql = noComments(files.pending + files.afterAdmission + files.rollback) + files.rollbackReverse
  assert.doesNotMatch(sql, /\btickers\b/)
  assert.deepEqual([...new Set([...sql.matchAll(/public\.([a-z_]+)/g)].map(m => m[1]))].sort(), ['cohort_tree', 'cohort_tree_members'])
  const bare = sql.replace(/'(?:[^']|'')*'/g, "''")   // the words inside quotes are reasons and messages, not SQL
  const touched = new Set([...bare.matchAll(/\b(?:insert into|from|update|join|table)\s+(?:public\.)?([a-z_]+)\b/g)].map(m => m[1]))
  for (const t of touched) assert.ok(['cohort_tree', 'cohort_tree_members', 'unnest'].includes(t), `names ${t}`)
  assert.doesNotMatch(sql, /\b(?:create|alter|drop|truncate|grant)\b/)
  // inserts go to the member table only; the node table gets its two spine columns set and nothing else
  assert.deepEqual([...sql.matchAll(/insert into public\.([a-z_]+)/g)].map(m => m[1]), ['cohort_tree_members'])
  for (const m of sql.matchAll(/update public\.cohort_tree t set ([^;]*?) from /g)) assert.match(m[1], /^spine_fund(_next)? = [a-z_.]+(, spine_fund_next = [a-z_.]+)?$/, m[1])
  assert.doesNotMatch(sql, /delete from public\.cohort_tree\b(?!_members)/)
})

test('--hold: a fund held back at the gate is left out of all three files, and a typing slip is refused', () => {
  const b = buildBatch({ ...inputs, hold: ['FXY', 'xar'] })
  assert.deepEqual(b.errors, [])
  assert.deepEqual(b.held, ['FXY', 'XAR'])
  assert.equal(b.tickers.length, 24)
  assert.ok(!b.tickers.includes('FXY') && !b.tickers.includes('XAR'))
  assert.equal(b.rows.filter(r => r.role === 'index_fund').length, 24)
  assert.equal(b.rows.filter(r => r.role === 'reference').length, 9, 'XAR was the reference line of DEFENCE_PRIMES')
  assert.equal(b.spines.length, 7, 'neither held fund takes a spine over')
  const f = sqlFiles(b)
  for (const s of [f.pending, f.afterAdmission, f.rollback]) assert.match(s, /^-- held: FXY,XAR$/m)
  // the held funds are named only to take out rows an earlier, fuller run left pending: never inserted, never served
  const insert = f.pending.slice(f.pending.indexOf('insert into'), f.pending.indexOf('on conflict'))
  assert.doesNotMatch(insert, /'FXY'|'XAR'/)
  assert.doesNotMatch(noComments(f.afterAdmission).split('\n').find(l => l.includes("set status = 'served'")), /'FXY'|'XAR'/)
  assert.doesNotMatch(f.rollbackReverse, /'FXY'|'XAR'/)
  for (const s of [f.pending, f.afterAdmission]) {
    const naming = noComments(s).split(';').filter(x => /'FXY'|'XAR'/.test(x))
    assert.equal(naming.length, 1)
    assert.match(naming[0], /delete from public\.cohort_tree_members where ticker in \('FXY','XAR'\) and status = 'pending_admission' and source = 'TR2-NEXT-20261006'$/)
  }
  assert.notEqual(f.pending, sqlFiles(buildBatch(inputs)).pending)
  // a held fund that was to take a spine over: the hand-over goes with it, and the promise is cleared
  const w = buildBatch({ ...inputs, hold: ['WGMI'] })
  assert.equal(w.spines.length, 6); assert.deepEqual(w.heldSpines.map(s => s.cohort), ['NEOCLOUDS_MINERS'])
  assert.ok(sqlFiles(w).pending.includes("set spine_fund_next = null from (values ('NEOCLOUDS_MINERS','WGMI'))"))
  assert.doesNotMatch(sqlFiles(w).pending.split('\n').find(l => l.startsWith('update public.cohort_tree t set spine_fund_next = v.fund')), /WGMI/)
  // slips
  assert.match(buildBatch({ ...inputs, hold: ['FXZ'] }).errors.join(), /--hold FXZ: not one of the batch/)
  assert.match(buildBatch({ ...inputs, hold: admitNext }).errors.join(), /every fund is held back/)
})

test('the generator refuses a fund that is already served or a node that is missing from either tree', () => {
  const clone = (o) => JSON.parse(JSON.stringify(o))
  const a = clone(nextFunds); a.admit_next[0].ticker = 'SPY'
  assert.match(buildBatch({ ...inputs, nextFunds: a }).errors.join(), /SPY: already served/)
  const b = clone(nextFunds); b.admit_next[0].ticker = 'ACWI'
  assert.match(buildBatch({ ...inputs, nextFunds: b }).errors.join(), /ACWI: already in the tree/)
  const c = clone(nextFunds); c.admit_next.find(f => f.ticker === 'SHLD').spine_for = 'FRONTIER'
  assert.match(buildBatch({ ...inputs, nextFunds: c }).errors.join(), /FRONTIER is not a node in the revised tree/)
  const d = clone(nextFunds); d.admit_next[0].tree_node_id = 'IDX_SECTOR_SPDR'
  assert.match(buildBatch({ ...inputs, nextFunds: d }).errors.join(), /IDX_SECTOR_SPDR is not a node in the revised tree/)
  const e = clone(nextFunds); e.admit_next[0].ticker = "X'; drop"
  assert.match(buildBatch({ ...inputs, nextFunds: e }).errors.join(), /not a plain fund symbol/)
})

test('the dry run on disk: every scenario ran in the throw-away Postgres and behaved as written', () => {
  const run = J(DRY_RUN)
  assert.match(run.engine, /PGlite/)
  assert.equal(run.source, SOURCE)
  assert.deepEqual(run.held, hold)
  assert.equal(run.funds, batch.tickers.length)
  assert.deepEqual(run.scenarios.map(s => s.n), [1, 2, 3, 4, 5, 6])
  for (const s of run.scenarios) assert.equal(s.ok, true, `scenario ${s.n}: ${s.name}`)
  assert.equal(run.all_ok, true)
  const [s1, s2, s3, s4, s5, s6] = run.scenarios
  const step = (s, i) => s.steps[i]
  // 1. TR1's ten still pending: refused, nothing changed
  assert.equal(step(s1, 0).accepted, false); assert.equal(step(s1, 0).changed, false)
  for (const t of indexLayer.admit) assert.ok(step(s1, 0).message.includes(t), t)
  // 2. accepted, twice the same, rollback returns the state before
  assert.deepEqual(s2.steps.map(x => [x.accepted, x.changed]), [[true, true], [true, false], [true, true]])
  assert.deepEqual(step(s2, 0).proof, { step: 'TR2-NEXT pending', index_fund_rows: batch.tickers.length, reference_rows: batch.rows.length - batch.tickers.length, pending_funds: batch.tickers.length, spines_waiting: batch.spines.length })
  assert.equal(s2.after_pending.pending_funds, batch.tickers.length)
  assert.deepEqual(s2.after_rollback, { pending_rows: 0, batch_rows: [] })
  // 3. served, spines handed over, rollback refused
  assert.equal(s3.after_admission.pending_rows, 0)
  assert.deepEqual(s3.spines_handed_over.map(x => [x.cohort, x.was, x.now]), batch.spines.map(x => [x.cohort, x.was, x.ticker]))
  assert.equal(step(s3, 3).file, 'ROLLBACK'); assert.equal(step(s3, 3).accepted, false); assert.equal(step(s3, 3).changed, false)
  // 4. the warning: TR1's blanket step marks this batch served
  assert.equal(s4.what_it_does.funds_marked_served, batch.tickers.length)
  assert.equal(s4.what_it_does.rows_marked_served, batch.rows.length)
  assert.equal(s4.what_it_does.spines_handed_over.length, batch.spines.length)
  assert.equal(s4.what_it_does.same_rows_as_the_targeted_step, true)
  // 5. two funds held back
  assert.equal(s5.funds, batch.tickers.length - s5.held.length); assert.ok(s5.held.length >= 1)
  assert.equal(s5.after_pending.pending_funds, s5.funds)
  assert.equal(s5.held_after_full_load.after_admission.pending_rows, 0)
  assert.equal(s5.rollback_after_full_load.back_to_start, true)
  // 6. the same round on the revised tree's rows
  assert.deepEqual(s6.steps.map(x => [x.accepted, x.changed]), [[true, true], [true, false], [true, true]])
  assert.equal(s6.after_pending.pending_funds, batch.tickers.length)
})

test('no Hub page reads the tree, and nothing here is wired to run by itself', () => {
  for (const p of ['index.html', 'preview/company-view/index.html']) assert.doesNotMatch(T(p), /cohort_tree|next_funds_tree/, p)
  const gen = T('scripts/cohort-tree-next-funds-sql.mjs')
  assert.doesNotMatch(gen, /supabase-js|createClient|fetch\(|https?:\/\//, 'the generator has no way to reach a database')
})
