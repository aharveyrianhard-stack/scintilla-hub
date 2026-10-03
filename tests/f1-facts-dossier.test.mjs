// F1 (3 Oct 2026) — the facts dossier: only stated facts, no developer words, currency never guessed, nothing when there is nothing.
import test from 'node:test'; import assert from 'node:assert/strict'
import { composeFactsDossier, FACTS_TAG } from '../supabase/functions/_shared/facts-dossier.mjs'
const base = { ticker: 'AAOI', today: '2026-10-03', profile: { name: 'Applied Optoelectronics, Inc.', sector: 'Technology', industry: 'Communication Equipment', market_cap: 9.27e9, description: 'Makes optical modules. Sells to data centers.', beta: 3.78, range_52wk: '18.5-233.67' },
  fund: { revenue_ttm: 5.96e8 }, earnings: [{ date: '2026-11-05', eps_estimate: 0.14, revenue_estimate: 2.68e8 }, { date: '2026-08-06', eps_actual: 0.06, eps_estimate: 0.02 }], target: { target_avg: 184, target_low: 178, target_high: 190 }, price: 115.02, fwdEps: 3.59 }
test('a company gets all three sections, each from its numbers', () => {
  const d = composeFactsDossier(base)
  assert.match(d.business_now, /market value \$9\.3B/); assert.match(d.business_now, /Makes optical modules/)
  assert.match(d.catalysts, /Next earnings Nov 5, 2026: consensus EPS \$0\.14, revenue \$268M/); assert.match(d.catalysts, /target \$184 \(range \$178 to \$190\)/)
  assert.match(d.watch_notes, /52-week range of \$18\.50 to \$234/); assert.match(d.watch_notes, /Beta 3\.78/)
  for (const v of Object.values(d)) assert.doesNotMatch(String(v), /read_blocks|ticker_context|auto-generates|TODO|undefined|NaN/)
})
test('a negative amount reads −$0.10, never $-0.10', () => {
  const d = composeFactsDossier({ ...base, earnings: [{ date: '2026-11-05', eps_estimate: -0.1 }], fwdEps: -0.32 })
  assert.match(d.catalysts, /−\$0\.10/); assert.doesNotMatch(d.catalysts, /\$-/); assert.match(d.watch_notes, /expect a loss/)
})
test('a non-USD reporter: dates only, no estimate amount whose currency cannot be proven', () => {
  const d = composeFactsDossier({ ...base, filerCcy: 'CNY' })
  assert.match(d.catalysts, /Next earnings Nov 5, 2026\./); assert.doesNotMatch(d.catalysts, /consensus EPS/); assert.match(d.watch_notes, /Reports in CNY/)
})
test('a fund: what it is, its largest holdings, and their report dates as its catalysts', () => {
  const d = composeFactsDossier({ ticker: 'ARKX', today: '2026-10-03', profile: { name: 'ARK Space ETF', is_etf: true }, etfInfo: { etf_company: 'ARK', aum: 7.6e8, expense_ratio: 0.75 },
    holdings: [{ asset: 'RKLB', weight_pct: 6.1 }, { asset: 'LHX', weight_pct: 6.2 }], holdingEarnings: [{ ticker: 'LHX', date: '2026-10-29' }] })
  assert.match(d.business_now, /exchange-traded fund run by ARK/); assert.match(d.business_now, /Largest holdings: LHX 6\.2%, RKLB 6\.1%/)
  assert.match(d.catalysts, /LHX Oct 29/)
})
test('nothing to say → null (never an empty row); the tag is stable', () => {
  assert.equal(composeFactsDossier({ ticker: 'X', today: '2026-10-03' }), null); assert.equal(FACTS_TAG, 'FACTS:f1-v1')
})
