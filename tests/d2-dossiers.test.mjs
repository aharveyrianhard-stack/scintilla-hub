// D2 (6 Oct 2026) — every active name gets a dossier: funds say what they hold, rates / futures / crypto say what they are.
import test from 'node:test'; import assert from 'node:assert/strict'; import fs from 'node:fs'
import { composeFactsDossier, composeInstrumentDossier, instrumentOf, rangeOf, INSTRUMENTS, FACTS_TAG } from '../supabase/functions/_shared/facts-dossier.mjs'
const bars = (from, n, f) => Array.from({ length: n }, (_, i) => { const c = f(i); return { t: Date.parse(from) + i * 86400e3, h: c + 0.02, l: c - 0.02, c } })
const DEV = /read_blocks|ticker_context|auto-generates|TODO|undefined|NaN|null|not available/
test('a fund: the ten largest lines with weights, fees, assets, the sector mix, and its range when it has no profile', () => {
  const holdings = ['V', 'MA', 'CAT', 'GE', 'GEV', 'RTX', 'DE', 'ETN', 'UNP', 'AXP', 'HON'].map((a, i) => ({ asset: a, weight_pct: 8 - i * 0.5 }))
  const d = composeFactsDossier({ ticker: 'IYJ', today: '2026-10-06', isFund: true, etfInfo: { name: 'iShares U.S. Industrials ETF', etf_company: 'iShares', aum: 2.01e9, expense_ratio: 0.37, holdings_count: 13384, description: 'Follows an index of U.S. industrial companies. It holds stocks.',
    sectors: [{ industry: 'Industrials', exposure: 67.41 }, { industry: 'Financial Services', exposure: 18.59 }, { industry: 'Healthcare', exposure: 0.45 }] }, holdings, range: rangeOf(bars('2025-10-06', 250, (i) => 140 + i / 10)) })
  assert.match(d.business_now, /^iShares U\.S\. Industrials ETF is an exchange-traded fund run by iShares\. Assets \$2\.0B\. Expense ratio 0\.37%\. 13,384 holdings\./)
  assert.match(d.business_now, /Largest holdings: V 8\.0%, MA 7\.5%.*AXP 3\.5%\. Together 58% of the fund\./); assert.doesNotMatch(d.business_now, /HON/)
  assert.match(d.business_now, /Sector mix: Industrials 67%, Financial Services 19%\./); assert.doesNotMatch(d.business_now, /Healthcare/)
  assert.match(d.watch_notes, /traded between \$140 .* and \$165 /)
  for (const v of Object.values(d)) if (v) assert.doesNotMatch(v, DEV)
})
test('a fund whose facts are not loaded yet still gets plain words, 40 characters or more — never the developer line', () => {
  const d = composeFactsDossier({ ticker: 'IAI', today: '2026-10-06', isFund: true })
  assert.ok(d.business_now.length >= 40); assert.match(d.business_now, /IAI is an exchange-traded fund\. Its holdings, fees and size have not been loaded/)
})
test('a bond fund: one "Cash & Others" slice is not a sector mix; a description is never cut inside "U.S."', () => {
  const d = composeFactsDossier({ ticker: 'AGG', today: '2026-10-06', isFund: true, etfInfo: { name: 'iShares Core U.S. Aggregate Bond ETF', sectors: [{ industry: 'Cash & Others', exposure: 100 }], description: ('It invests in bonds. ').repeat(34) + 'iShares Core U.S. Aggregate Bond ETF was formed in 2003 and is domiciled in the United States.' } })
  assert.doesNotMatch(d.business_now, /Sector mix/); assert.doesNotMatch(d.business_now, /U\.S\.$/)
})
test('a rate: what the series is, in percent, with its range; the 2s10s says which way the curve slopes', () => {
  const d = composeInstrumentDossier({ ticker: 'US10Y', type: 'index', bars: bars('2025-10-06', 260, (i) => 4 + i / 200) })
  assert.match(d.business_now, /^US10Y is the 10-year US Treasury yield\./); assert.match(d.business_now, /A yield in percent, not a price/)
  assert.match(d.watch_notes, /ranged from 3\.98% \(Oct 6, 2025\) to 5\.3\d% /); assert.match(d.catalysts, /Federal Reserve/)
  const s = composeInstrumentDossier({ ticker: 'US2S10S', type: 'rate', bars: bars('2025-10-06', 260, (i) => -0.5 + i / 400) })
  assert.match(s.watch_notes, /ranged from −0\.52 points/); assert.match(s.watch_notes, /The curve slopes upward/)
  assert.match(composeInstrumentDossier({ ticker: 'US2S10S', type: 'rate', bars: bars('2025-10-06', 60, () => -0.3) }).watch_notes, /The curve is inverted/)
})
test('a future and a coin: the contract, the session, dollars with thousands; no bars → the words stay, no range is guessed', () => {
  const g = composeInstrumentDossier({ ticker: 'GCUSD', type: 'future', bars: bars('2025-11-21', 260, (i) => 4000 + i) })
  assert.match(g.business_now, /Gold futures/); assert.match(g.business_now, /100 troy ounces/); assert.match(g.business_now, /Sunday 6 p\.m\. to Friday 5 p\.m\./)
  assert.match(g.watch_notes, /between \$4,000 /)
  const b = composeInstrumentDossier({ ticker: 'BTCUSD', type: 'crypto', bars: [] })
  assert.match(b.business_now, /every hour of every day/); assert.equal(b.watch_notes, null); assert.ok(b.catalysts)
  assert.equal(rangeOf(bars('2026-09-01', 19, () => 5)), null)
})
test('every listed series and any unlisted non-company type gets 40+ characters; a company or fund is not an instrument', () => {
  for (const t of Object.keys(INSTRUMENTS)) { const d = composeInstrumentDossier({ ticker: t, bars: [] }); assert.ok(d.business_now.length >= 40, t); assert.doesNotMatch(d.business_now, DEV) }
  for (const ty of ['rate', 'index', 'future', 'crypto']) assert.ok(composeInstrumentDossier({ ticker: 'NEWONE', type: ty, bars: [] }).business_now.length >= 40, ty)
  assert.equal(instrumentOf('AAPL', 'stock'), null); assert.equal(instrumentOf('XLI', 'etf'), null); assert.equal(instrumentOf('ABC', null), null); assert.equal(FACTS_TAG, 'FACTS:f1-v1')
})
test('the function walks every active name, keeps its three guarded writes, and the fund loader walks every active fund', () => {
  const f = fs.readFileSync(new URL('../supabase/functions/dossier-facts/index.ts', import.meta.url), 'utf8')
  assert.match(f, /from\('tickers'\)\.select\('ticker'\)\.eq\('active', true\)/); assert.match(f, /from\('fmp_full_universe'\)/)
  assert.match(f, /ignoreDuplicates: true/); assert.match(f, /\.update\(set\)\.eq\('ticker', t\)\.eq\('enrich_sources', FACTS_TAG\)/); assert.match(f, /\.is\('narrative', null\)\.is\('business_now', null\)\.is\('catalysts', null\)\.is\('watch_notes', null\)\.is\('enrich_sources', null\)/)
  assert.doesNotMatch(f, /\.delete\(/); assert.doesNotMatch(f, /method:\s*'(POST|PUT|PATCH|DELETE)'/)
  const b = fs.readFileSync(new URL('../supabase/functions/fmp-backfill/index.ts', import.meta.url), 'utf8')
  assert.match(b, /\.eq\('type','etf'\)\.eq\('active',true\)/)
})
test('the dry run on the 6 Oct snapshot: 72 names without a dossier → 0, no real dossier touched, nothing under 40 characters', () => {
  const r = JSON.parse(fs.readFileSync(new URL('../deliverables/20261006/d2-dossiers/data/dry-run-20261006.json', import.meta.url), 'utf8'))
  for (const k of ['A', 'B']) { const s = r.stages[k]; assert.equal(s.before, 72); assert.equal(s.after, 0); assert.equal(s.real_dossiers_untouched, true); assert.ok(s.shortest_business[0][1] >= 40); for (const run of s.runs) assert.deepEqual(run.errors, []) }
  for (const d of Object.values(r.stages.B.texts)) for (const v of Object.values(d)) if (v) assert.doesNotMatch(v, DEV)
})
