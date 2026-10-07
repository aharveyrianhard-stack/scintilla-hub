/* F1 (3 Oct 2026) · WHAT THE DEPLOYED PAGE SAID, AS CELLS — and where it agrees with the data matrix.
   Reads page-probe.mjs output (the real page, headless) and the data matrix for the same moment; classifies every tab the page drew
   with rules written from the page's own words (sampled 3 Oct), and lists each disagreement. Also flags developer words on screen
   (table and job names Alan asked to keep out of panels: "Please remove descriptions from my Hub").
     node page-classify.mjs <page.json> <matrix.json> <out.json> */
import fs from 'node:fs'
const [pageF, matrixF, outF] = process.argv.slice(2)
const page = JSON.parse(fs.readFileSync(pageF, 'utf8')), matrix = JSON.parse(fs.readFileSync(matrixF, 'utf8'))
const M = Object.fromEntries(matrix.rows.map((r) => [r.ticker, r]))
const has = (s, re) => re.test(s || '')
const DEV = /\b(read_blocks|ticker_context|balance_history|cashflow_history|fundamentals_history|company_releases|etf_holdings|etf_info|youtube_videos|social_sentiment|earnings_call_transcripts|analyst-revisions job|company_profile|ratios_history)\b/g
const NONOP = /Not an operating company/
export function classify (r) {
  const T = r.tabs || {}, txt = (k) => (T[k] && T[k].text) || '', c = {}
  const nonop = has(txt('ESTIMATES'), NONOP)
  c['tab.geiger'] = !has(txt('GEIGER'), /GEIGER COMPOSITE [+−-]?\d/) ? 'EMPTY' : has(txt('GEIGER'), /UNAVAILABLE/) ? 'ERROR' : 'OK'
  const fr = (T.FUNDAMENTALS && T.FUNDAMENTALS.frameText) || ''
  c['tab.fundamentals'] = !fr ? 'ERROR' : has(fr, /REVENUE TTM not stored/) ? 'EMPTY' : 'OK'
  c['tab.estimates'] = nonop ? 'OK' : has(txt('ESTIMATES'), /FY\+1 EPS|EPS year to/) ? 'OK' : 'EMPTY'
  c['tab.comps'] = nonop ? 'OK' : has(txt('COMPS'), /could not be built|could not be loaded/) ? 'ERROR' : has(txt('COMPS'), /COMPARABLES/) ? 'OK' : 'EMPTY'
  const fin = txt('FINANCIALS')
  c['tab.financials'] = has(fin, /No etf_holdings rows/) ? 'EMPTY' : has(fin, /FMP statements stored|HOLDINGS|AUM \$/) && !has(fin, /^CAPITAL new shares/) ? 'OK' : 'EMPTY'
  c['tab.capital'] = nonop ? 'OK' : has(fin, /CASH ON HAND — not stored/) ? 'EMPTY' : has(fin, /CAPITAL/) ? 'OK' : 'EMPTY'
  c['tab.stats'] = has(txt('STATS'), /market cap [\d.]+[KMBT]/i) ? 'OK' : 'EMPTY'
  c['tab.news'] = has(txt('NEWS'), /No recent headlines/) ? 'EMPTY' : 'OK'
  c['tab.social'] = has(txt('SOCIAL'), /STALE/) ? 'ERROR' : 'OK'
  c['tab.earnings'] = nonop ? 'OK' : has(txt('EVENTS'), /NO SCHEDULED DATE IN THE STORED CALENDAR/) || !has(txt('EVENTS'), /\d+ reports/) ? 'EMPTY' : 'OK'
  for (const [k, id] of [['BUSINESS', 'tab.read_business'], ['VERDICT', 'tab.read_verdict'], ['CATALYSTS', 'tab.read_catalysts'], ['WATCH', 'tab.read_watch']])
    c[id] = has((r.read || {})[k], /Desk narrative auto-generates/) ? 'PLACEHOLDER' : (r.read || {})[k] ? 'OK' : 'EMPTY'
  const b = r.board || {}
  c['board.price'] = b.price > 0 ? 'OK' : 'EMPTY'
  c['board.mktcap'] = b.mc > 0 ? 'OK' : 'EMPTY'
  c['board.geiger'] = b.g != null && b.g !== 'undefined' ? 'OK' : 'EMPTY'
  const dev = new Set(); for (const k of Object.keys(T)) for (const m of (txt(k).match(DEV) || [])) dev.add(k + ': ' + m)
  for (const v of Object.values(r.read || {})) for (const m of (String(v || '').match(DEV) || [])) dev.add('READ: ' + m)
  return { cells: c, dev: [...dev] }
}
const rows = [], agree = {}, disagree = []
for (const r of page.rows) {
  const { cells, dev } = classify(r), m = M[r.ticker]
  rows.push({ ticker: r.ticker, cells, dev })
  if (!m) continue
  for (const [id, s] of Object.entries(cells)) {
    const d = m.cells[id] && m.cells[id].s
    if (!d) continue
    ;(agree[id] ||= { same: 0, differ: 0 })[d === s ? 'same' : 'differ']++
    if (d !== s) disagree.push({ ticker: r.ticker, surface: id, page: s, data: d, data_why: m.cells[id].why, page_text: id.startsWith('tab.read') ? (r.read || {})[id.replace('tab.read_', '').toUpperCase()]?.slice(0, 160) : ((r.tabs || {})[{ 'tab.geiger': 'GEIGER', 'tab.fundamentals': 'FUNDAMENTALS', 'tab.estimates': 'ESTIMATES', 'tab.comps': 'COMPS', 'tab.financials': 'FINANCIALS', 'tab.capital': 'FINANCIALS', 'tab.stats': 'STATS', 'tab.news': 'NEWS', 'tab.social': 'SOCIAL', 'tab.earnings': 'EVENTS' }[id]] || {}).text?.slice(0, 200) })
  }
}
const tally = {}; for (const r of rows) for (const [id, s] of Object.entries(r.cells)) { (tally[id] ||= { OK: 0, EMPTY: 0, PLACEHOLDER: 0, ERROR: 0 })[s]++ }
const devNames = rows.filter((r) => r.dev.length)
fs.writeFileSync(outF, JSON.stringify({ built_utc: new Date().toISOString(), site: page.site, probed_utc: page.built_utc, names: rows.length, writes_blocked: page.writes_blocked, tally, agree, disagree, developer_words: { names: devNames.length, phrases: [...new Set(devNames.flatMap((r) => r.dev))].sort() }, rows }))
console.log(JSON.stringify({ names: rows.length, disagreements: disagree.length, developer_word_names: devNames.length }))
for (const [id, a] of Object.entries(agree)) console.log(id.padEnd(22), JSON.stringify(a), JSON.stringify(tally[id]))
