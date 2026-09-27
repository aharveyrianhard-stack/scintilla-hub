import { test } from 'node:test'
import assert from 'node:assert/strict'
import { fan, rsiLast, rungReading, composite, changePieces, varianceShares, absShares, crossings, quantile, corr }
  from '../deliverables/20260927/geiger-review/geiger-replay.mjs'

const bars = closes => closes.map((c, i) => ({ t: i, c, h: c + 0.5, l: c - 0.5 }))

test('fan joins a line only once enough bars exist (maturity-aware)', () => {
  assert.equal(fan(Array(4).fill(1)).length, 0)
  assert.equal(fan(Array(5).fill(1)).length, 1)
  assert.equal(fan(Array(49).fill(1)).length, 5)
  assert.equal(fan(Array(200).fill(1)).length, 9)
})

test('a steady rise stacks the fan bullish and pins trend at +1', () => {
  const r = rungReading(bars(Array.from({ length: 230 }, (_, i) => 100 + i)))
  assert.equal(r.trend, 1)
  assert.equal(r.fanLines, 9)
  assert.ok(r.rsi > 99)
  assert.equal(r.momentum, 1)
  assert.equal(r.composite, 1)
})

test('a steady fall is the mirror image', () => {
  const r = rungReading(bars(Array.from({ length: 230 }, (_, i) => 400 - i)))
  assert.equal(r.trend, -1)
  assert.equal(r.momentum, -1)
  assert.equal(r.composite, -1)
})

test('RSI(14) of alternating equal moves is 50', () => {
  const c = Array.from({ length: 60 }, (_, i) => 100 + (i % 2))
  assert.ok(Math.abs(rsiLast(c) - 50) < 2)
})

test('only the newest 230 bars are read', () => {
  const up = Array.from({ length: 230 }, (_, i) => 100 + i)
  const junk = Array.from({ length: 500 }, () => 1)
  assert.deepEqual(rungReading(bars([...junk, ...up])), rungReading(bars(up)))
})

test('trend-only when momentum lacks 15 closes', () => {
  const r = rungReading(bars([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]))
  assert.equal(r.momentum, null)
  assert.equal(r.composite, r.trend)
})

test('composite is the weight-normalised mean and ignores zero weights and gaps', () => {
  assert.equal(composite({ a: 1, b: -1, c: 0.5 }, { a: 3, b: 1, c: 0 }), 0.5)
  assert.equal(composite({ a: 1, b: null }, { a: 1, b: 5 }), 1)
  assert.equal(composite({}, { a: 1 }), null)
})

test('change pieces add up exactly to the composite change', () => {
  const w = { a: 2, b: 1, c: 1 }
  const p = { a: 0.2, b: -0.4, c: 0.9 }, n = { a: -0.1, b: 0.3, c: 0.5 }
  const pieces = changePieces(p, n, w)
  const sum = Object.values(pieces).reduce((x, y) => x + y, 0)
  assert.ok(Math.abs(sum - (composite(n, w) - composite(p, w))) < 1e-12)
})

test('variance shares sum to 1 and give all credit to the only moving group', () => {
  const rows = [0.1, -0.3, 0.2, 0.05].map(v => ({ total: v, groups: { fast: v, slow: 0 } }))
  const s = varianceShares(rows)
  assert.ok(Math.abs(s.fast - 1) < 1e-12)
  assert.equal(s.slow, 0)
  const mixed = [[0.1, 0.2], [-0.2, 0.1], [0.3, -0.1], [0, 0.05]].map(([a, b]) => ({ total: a + b, groups: { a, b } }))
  const m = varianceShares(mixed)
  assert.ok(Math.abs(m.a + m.b - 1) < 1e-12)
})

test('absolute shares sum to 1', () => {
  const s = absShares([{ groups: { a: 0.3, b: -0.1 } }, { groups: { a: -0.1, b: 0.1 } }])
  assert.ok(Math.abs(s.a - 4 / 6) < 1e-12)
  assert.ok(Math.abs(s.a + s.b - 1) < 1e-12)
})

test('crossings measure from the last reading at or below -0.5 to the first at or above +0.5', () => {
  const s = [[0, -0.6], [1, -0.7], [2, -0.2], [3, 0.3], [5, 0.6], [6, 0.9], [9, -0.5]].map(([t, v]) => ({ t, v }))
  assert.deepEqual(crossings(s), [{ dir: 'up', ms: 4 }, { dir: 'down', ms: 3 }])
  assert.deepEqual(crossings([{ t: 0, v: 0.1 }, { t: 1, v: 0.2 }]), [])
})

test('quantile interpolates and corr is bounded', () => {
  assert.equal(quantile([1, 2, 3, 4], 0.5), 2.5)
  assert.equal(quantile([], 0.5), null)
  assert.ok(Math.abs(corr([1, 2, 3], [2, 4, 6]) - 1) < 1e-12)
  assert.ok(Math.abs(corr([1, 2, 3], [3, 2, 1]) + 1) < 1e-12)
})
