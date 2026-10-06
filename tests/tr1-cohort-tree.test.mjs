// TR1 (6 Oct 2026) — the cohort tree is adopted BESIDE the sectors and without touching the Hub.
// Alan: "After the tree, we decide what goes on the hub." These tests hold the adoption to that: the tree lives in two
// new tables no page reads, the SQL on disk is exactly what the loader generates, and nothing here can reach
// public.ticker_cohorts (the table the Hub's cohort tabs are built from).
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { buildTree, validate, sqlFiles } from '../scripts/cohort-tree-loader.mjs'

const J = (p) => JSON.parse(readFileSync(new URL('../' + p, import.meta.url), 'utf8'))
const T = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8')
const universe = J('deliverables/20261006/cohort-proposal/data/universe-20261006.json')
const proposal = J('deliverables/20261006/cohort-proposal/proposal.json')
const indexLayer = J('deliverables/20261006/tree-adopted/index-layer.json')
const tree = buildTree({ proposal, indexLayer, served: universe.symbols })
const files = sqlFiles(tree)
const noComments = (s) => s.replace(/^--.*$/gm, '')
const MIG = 'supabase/migrations/20261006_tr1_cohort_tree'

test('the tree validates: one root, every parent a node, no loop, no empty cohort, no unplaced index fund', () => {
  assert.deepEqual(validate(tree), [])
  assert.equal(tree.nodes.filter(n => n.parent_1 == null).map(n => n.cohort).join(), 'MARKET')
})

test('every company CO1 placed is in the tree, except a name that is leaving the universe (QRVO)', () => {
  const co1 = new Set(proposal.cohorts.filter(c => !c.id.startsWith('IDX_')).flatMap(c => c.members))
  const mine = new Set(tree.members.filter(m => m.role === 'member').map(m => m.ticker))
  assert.deepEqual([...co1].filter(t => !mine.has(t)), ['QRVO'])
  assert.deepEqual(tree.left, ['QRVO (ANALOG_RF_POWER)'])
  assert.equal(mine.size, 453)
})

test('every member is served today or is one of the ten funds on the admission list — nothing else', () => {
  const served = new Set(universe.symbols)
  const pending = [...new Set(tree.members.filter(m => m.status === 'pending_admission').map(m => m.ticker))].sort()
  assert.deepEqual(pending, [...indexLayer.admit].sort())
  assert.equal(pending.length, 10)
  for (const m of tree.members) assert.ok(m.status === 'pending_admission' ? !served.has(m.ticker) : served.has(m.ticker), m.ticker)
  // the tree's tickers are exactly the set after the sitting: 590 - QRVO + 10
  const all = new Set(tree.members.map(m => m.ticker))
  assert.equal(all.size, 599)
  assert.deepEqual([...served].filter(t => !all.has(t)), ['QRVO'])
})

test('a fund marked a near-copy names the served fund it copies, and that fund is kept', () => {
  const byT = Object.fromEntries(indexLayer.funds.map(f => [f.ticker, f]))
  const copies = tree.members.filter(m => m.near_copy_of)
  assert.ok(copies.length >= 20)
  for (const m of copies) { assert.equal(byT[m.near_copy_of].verdict, 'KEEP', m.ticker); assert.ok(byT[m.ticker].corr_6m >= 0.9, `${m.ticker} measured ${byT[m.ticker].corr_6m}`) }
  assert.equal(byT.IYZ.verdict, 'KEEP', 'IYZ moves 0.20 with XLC: telecom is not the sector')
})

test('the SQL on disk is exactly what the loader generates', () => {
  assert.equal(T(`${MIG}.sql`), files.schema)
  assert.equal(T(`${MIG}_LOAD.sql`), files.load)
  assert.equal(T(`${MIG}_ROLLBACK.sql`), files.rollback)
  assert.equal(T(`${MIG}_AFTER_ADMISSION.sql`), files.afterAdmission)
})

test('the SQL writes only the two new tables and never names ticker_cohorts or tickers', () => {
  const sql = noComments(files.schema + files.load + files.rollback + files.afterAdmission)
  assert.doesNotMatch(sql, /ticker_cohorts/)
  const touched = new Set([...sql.matchAll(/\b(?:into|from|update|table(?: if (?:not )?exists)?|on)\s+public\.([a-z_]+)/g)].map(m => m[1]))
  assert.deepEqual([...touched].sort(), ['cohort_tree', 'cohort_tree_members'])
  assert.doesNotMatch(sql, /\b(?:alter|drop|truncate)\s+(?:table\s+)?(?:if exists\s+)?public\.(?!cohort_tree)/)
})

test('the rollback drops exactly what the schema creates', () => {
  const created = [...files.schema.matchAll(/create table if not exists public\.([a-z_]+)/g)].map(m => m[1]).sort()
  const dropped = [...files.rollback.matchAll(/drop table if exists public\.([a-z_]+)/g)].map(m => m[1]).sort()
  assert.deepEqual(dropped, created)
  const pol = [...files.schema.matchAll(/create policy ([a-z_]+)/g)].map(m => m[1]).sort()
  assert.deepEqual([...files.rollback.matchAll(/drop policy if exists ([a-z_]+)/g)].map(m => m[1]).sort(), pol)
})

test('no Hub page reads the new tables: the board page and its trial copy never name them', () => {
  for (const p of ['index.html', 'preview/company-view/index.html']) assert.doesNotMatch(T(p), /cohort_tree/, p)
})
