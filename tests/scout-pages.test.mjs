// SCOUT (28 Sep): the design page, the IWM scout and the fund-valuation page — built from one scout run.
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const D = join(ROOT, 'deliverables/20260928')
const read = p => readFileSync(join(D, p), 'utf8')
const load = (p, name) => { const ctx = { window: {} }; vm.runInNewContext(read(p), ctx); return ctx.window[name] }

const PAGES = ['scout/SCOUT-DESIGN.html', 'scout-iwm/SCOUT-IWM.html', 'etf-valuation/ETF-VALUATION.html']

test('every scout page carries the BACK / CLOSE pair and the plain-words section', () => {
  for (const p of PAGES) {
    const html = read(p)
    assert.match(html, /data-scnav-slot/, p)
    assert.match(html, /id="scnav-css"/, p)
    assert.match(html, /What could be wrong/, p)
    assert.match(html, /What was not done/, p)
  }
})

test('colours: greys only (channels within 24, none above 210) plus the up-green / down-red pair', () => {
  for (const p of PAGES) {
    const html = read(p).replace(/<!-- scnav ·[\s\S]*?<!-- \/scnav -->/, '')
    for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
      const hex = m[1].toLowerCase()
      if (['35b06a', 'd1483f', '4a2a2a', '23402f'].includes(hex)) continue
      const [r, g, b] = [0, 2, 4].map(i => parseInt(hex.slice(i, i + 2), 16))
      assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24 && Math.max(r, g, b) <= 210, `${p}: #${hex} is not a Scintilla grey`)
    }
  }
})

test('IWM scout data: ~2,000 holdings, the served names flagged, every served row carries its Geiger', () => {
  const S = load('scout-iwm/scout-iwm-data.js', 'SCOUT_IWM')
  assert.ok(S.rows.length > 1800 && S.rows.length < 2200, `holdings ${S.rows.length}`)
  assert.equal(S.served.length, S.rows.filter(r => r.served).length)
  assert.ok(S.served.length >= 20 && S.served.length <= 45)
  assert.ok(S.served.every(r => r.geiger != null), 'a served name without a Geiger')
  const w = S.rows.reduce((a, r) => a + (r.w || 0), 0)
  assert.ok(w > 95 && w < 102, `weights sum to ${w}`)
  const priced = S.rows.filter(r => r.rsi != null).length
  assert.ok(priced / S.rows.length > 0.95, `only ${priced} priced`)
})

test('IWM page filters are visible and editable, with Alan\'s $20M / day default', () => {
  const html = read('scout-iwm/SCOUT-IWM.html')
  for (const id of ['f_prof', 'f_de', 'f_dv', 'f_mc', 'f_rep', 'f_cap', 'f_show']) assert.match(html, new RegExp(`id="${id}"`))
  assert.match(html, /id="f_dv" value="20"/)
})

test('fund P/E is harmonic: recomputing it from the fund\'s own coverage and earnings yield agrees', () => {
  const E = load('etf-valuation/etf-valuation-data.js', 'ETF_VAL')
  const iwm = E.funds.find(f => f.fund === 'IWM')
  assert.ok(iwm && iwm.coverage_pct > 80, `IWM coverage ${iwm && iwm.coverage_pct}`)
  assert.ok(iwm.pe_profitable_only > 5 && iwm.pe_profitable_only < 60, `IWM profitable-only P/E ${iwm.pe_profitable_only}`)
  // the P/E with losses counted exists only when the weighted earnings yield is positive — and then it is its inverse
  for (const f of E.funds.filter(x => x.earnings_yield_all != null)) {
    if (f.earnings_yield_all <= 0) assert.equal(f.pe_all, null, f.fund)
    else assert.ok(Math.abs(f.pe_all - 1 / f.earnings_yield_all) / f.pe_all < 0.01, `${f.fund}: P/E ${f.pe_all} vs 1/EY ${1 / f.earnings_yield_all}`)
    if (f.pe_all != null && f.pe_profitable_only != null) assert.ok(f.pe_profitable_only <= f.pe_all + 1e-9, `${f.fund}: dropping loss-makers must not raise the P/E`)
  }
  for (const f of ['IWM', 'IJR', 'VB', 'SPY', 'QQQ']) assert.ok(E.funds.some(x => x.fund === f), f)
  // 28 Sep: FMP's only "direct" fund P/Es are two commodity trusts that file their own accounts (DBC, SLV);
  // no equity fund has one. If that changes, the page text must change.
  const direct = E.funds.filter(f => f.fmp_direct_pe != null && f.coverage_pct > 50).map(f => f.fund)
  assert.equal(direct.length, 0, 'FMP began answering a direct P/E for an equity fund — update the page text: ' + direct.join())
})
