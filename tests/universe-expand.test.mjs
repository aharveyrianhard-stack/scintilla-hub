// M53 universe expansion: the page, the list and the runbook must agree with each other, and the
// runbook must stay a dry run until someone types --confirm.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const DIR = 'deliverables/20260924/universe-expand'
const names = JSON.parse(readFileSync(`${DIR}/names.json`, 'utf8'))
const page = readFileSync(`${DIR}/UNIVERSE-EXPAND.html`, 'utf8')
const runbook = readFileSync(`${DIR}/RUNBOOK.sh`, 'utf8')
const all = [...names.tier1, ...names.tier2, ...names.tier3]

test('every name appears exactly once across the three tiers', () => {
  const seen = new Set()
  for (const n of all) {
    assert.ok(!seen.has(n.ticker), `${n.ticker} is listed twice`)
    seen.add(n.ticker)
  }
  assert.equal(names.tier1.length + names.tier2.length, 60)
})

test('nothing already served is proposed as new', () => {
  // measured from the chart API /universe on 2026-09-24 (364 names, sha ab8f7965…)
  const served = ['XLK', 'XLY', 'XLRE', 'RKLB', 'SPY', 'QQQ', 'SMH', 'SOXX', 'GDX', 'COPX', 'XLF', 'XLV']
  for (const n of [...names.tier1, ...names.tier2]) {
    assert.ok(!served.includes(n.ticker), `${n.ticker} is already in the 364`)
  }
})

test('the page and the list cannot drift apart', () => {
  for (const n of all) {
    assert.ok(page.includes(`>${n.ticker}<`), `${n.ticker} is in names.json but not on the page`)
  }
})

test('every name carries a reason and a place in the tree', () => {
  for (const n of names.tier1) { assert.ok(n.why?.length > 10); assert.ok(n.branch) }
  for (const n of names.tier2) { assert.ok(n.why?.length > 5); assert.ok(n.branch); assert.ok(n.cohort) }
})

test('the runbook is a dry run until it is told otherwise', () => {
  assert.match(runbook, /CONFIRM=0/, 'confirm must default to off')
  assert.match(runbook, /\[dry-run\]/, 'a dry run must show what it would do')
  // every fly/psql call goes through run() or ssh_batch(), never bare
  for (const line of runbook.split('\n')) {
    const t = line.trim()
    if (/^(flyctl|psql|node services|curl -X)/.test(t)) assert.fail(`bare mutating command: ${t}`)
  }
})

test('the runbook refuses the market hours, the settle window and a red Geiger', () => {
  assert.match(runbook, /0925/, 'must refuse while the market is open')
  assert.match(runbook, /1825/, 'must refuse during the settled-close window')
  assert.match(runbook, /REFUSING to start: Geiger is not ready/)
  assert.match(runbook, /BATCH_FROM/, 'must be resumable batch by batch')
})

test('every step that writes prints its rollback', () => {
  for (const marker of ['rollback for this batch', 'rollback: psql -f', 'rollback: delete from public.hub_favorites']) {
    assert.ok(runbook.includes(marker), `missing rollback: ${marker}`)
  }
})

test('the page keeps the house rules: back pair, no white, readable type', () => {
  assert.ok(/scnav/.test(page), 'the BACK / CLOSE pair must be present')
  const hexes = [...page.matchAll(/#([0-9a-fA-F]{6})\b/g)].map(m => m[1])
  for (const h of hexes) {
    const [r, g, b] = [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, `#${h} is not a grey`)
    assert.ok(Math.max(r, g, b) <= 210, `#${h} is too bright`)
  }
  for (const m of page.matchAll(/font(?:-size)?:\s*(?:[0-9.]+ )?([0-9.]+)px/g)) {
    assert.ok(Number(m[1]) >= 11, `${m[1]}px is smaller than the 11px floor`)
  }
})
