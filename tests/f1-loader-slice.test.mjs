// F1 (3 Oct 2026) — the loaders' newcomer-first slice (supabase/functions/_shared/loader-slice.mjs) and its neighbours.
import test from 'node:test'; import assert from 'node:assert/strict'
import { planSlice, fmpSymbolMap } from '../supabase/functions/_shared/loader-slice.mjs'
const U = Array.from({ length: 50 }, (_, i) => 'T' + String(i).padStart(2, '0'))
const old = (off, size) => { let s = U.slice(off, off + size); if (s.length < size) s = s.concat(U.slice(0, size - s.length)); return s }
test('no newcomer: the slice and the next offset are exactly the old round-robin', () => {
  for (const off of [0, 7, 45]) { const p = planSlice({ universe: U, have: U, offset: off, size: 10 }); assert.deepEqual(p.slice, old(off, 10)); assert.equal(p.next, (off + 10) % 50); assert.deepEqual(p.newcomers, []) }
})
test('newcomers go first, capped, and the slice never grows (the FMP call budget is unchanged)', () => {
  const have = U.filter((t) => !['T03', 'T30', 'T31', 'T40'].includes(t))
  const p = planSlice({ universe: U, have, offset: 10, size: 10, cap: 3 })
  assert.equal(p.slice.length, 10); assert.equal(p.newcomers.length, 3)
  assert.deepEqual(p.slice.slice(0, 3), p.newcomers); assert.equal(new Set(p.slice).size, 10)
  assert.equal(p.next, (10 + 7) % 50)   // only the round-robin part moves the stored offset
})
test('a name the provider never answers cannot hold a seat forever (the newcomer seats rotate)', () => {
  const missing = ['T01', 'T02', 'T03', 'T04', 'T05', 'T06'], have = U.filter((t) => !missing.includes(t))
  const seen = new Set(); let off = 0
  for (let run = 0; run < 12; run++) { const p = planSlice({ universe: U, have, offset: off, size: 10, cap: 2 }); p.newcomers.forEach((t) => seen.add(t)); off = p.next }
  assert.deepEqual([...seen].sort(), missing)
})
test('funds are not newcomers when the pool excludes them; names outside the universe are ignored', () => {
  const p = planSlice({ universe: U, have: [], newcomerPool: ['T05', 'ZZZ'], offset: 0, size: 10, cap: 5 })
  assert.deepEqual(p.newcomers, ['T05'])
})
test('FMP spelling: tickers.fmp_symbol wins (MOG.A → MOG-A), else the ticker', () => {
  const f = fmpSymbolMap([{ ticker: 'MOG.A', fmp_symbol: 'MOG-A' }, { ticker: 'AAPL', fmp_symbol: null }])
  assert.equal(f('MOG.A'), 'MOG-A'); assert.equal(f('AAPL'), 'AAPL'); assert.equal(f('BRK-B'), 'BRK-B')
})
