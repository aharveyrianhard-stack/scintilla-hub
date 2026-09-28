// N4 scout Geiger (28 Sep): turns one run of provider/scout-geiger-20260928 (services/scout-geiger, SCOUT_GEIGER_MODE=analysis)
// into the files the Hub serves. Reads the gzipped run output; writes:
//   deliverables/20260928/market-map-r3/scout-geiger.json   the map's scout bars (only the tickers the map draws) + fund blends
//   deliverables/20260928/scout-geiger/data/*.json           rows, tracking, nodes, admissions — the page's numbers
//   node scripts/build-scout-geiger.mjs <scout-geiger-out.json.gz>
import { readFileSync, writeFileSync } from 'node:fs'
import { gunzipSync } from 'node:zlib'
const src = process.argv[2]
const o = JSON.parse(gunzipSync(readFileSync(src)).toString())
const a = o.analysis
const r4 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4
const VISIBLE_GAIN = 0.005   // same rule as services/scout-geiger/scout-geiger-analysis.mjs (half a printed step)

// the map
const nodes = JSON.parse(readFileSync('deliverables/20260928/market-map-r3/nodes.json', 'utf8')).nodes
const want = new Set(nodes.filter(n => n.ticker).map(n => n.ticker.replace(/-/g, '.')))
const v = {}
for (const r of o.rows) if (want.has(r.ticker) && r.last_session === o.as_of) v[r.ticker] = [r4(r.composite), r4(r.trend), r4(r.momentum)]
const funds = {}
for (const n of a.nodes) if (n.kind === 'fund' && n.blend_scout != null) funds[n.ticker] = { blend: n.blend_scout, cov: n.coverage_scout_pct, n: n.names_read, own: n.own_scout }
writeFileSync('deliverables/20260928/market-map-r3/scout-geiger.json', JSON.stringify({
  what: 'Scout Geiger: the Hub Geiger restricted to its D, 3D and W rungs, computed off the Hub (services/scout-geiger). Not the Hub Geiger. v = [composite, trend, momentum].',
  as_of: o.as_of, computed_utc: o.computed_utc, run_id: o.run_id, code_commit: o.code_commit, equalizer: o.equalizer, v, funds }))

// the page's data
const ranked = a.admissions.ranked.map(r => {
  if (r.recommendation === 'FULL HUB' && !(r.gap_closed >= VISIBLE_GAIN)) return { ...r, recommendation: 'SCOUT ONLY', why: `the gain is real but below ${VISIBLE_GAIN} Geiger points, so it would not change a number the Hub shows for ${r.best_fund}` }
  return r
})
const D = 'deliverables/20260928/scout-geiger/data/'
writeFileSync(D + 'run.json', JSON.stringify({ run_id: o.run_id, code_commit: o.code_commit, computed_utc: o.computed_utc, as_of: o.as_of, first_session: o.first_session,
  sessions: o.sessions, bar_sources: o.bar_sources, missing_sessions: o.missing_sessions, splits_in_window: o.splits_in_window, equalizer: o.equalizer, counts: o.counts }, null, 1))
writeFileSync(D + 'rows-' + o.as_of + '.json', JSON.stringify({ columns: ['ticker', 'composite', 'trend', 'momentum', 'rungs_used', 'kind', 'last_session'],
  rows: o.rows.map(r => [r.ticker, r4(r.composite), r4(r.trend), r4(r.momentum), r.rungs_used, r.kind, r.last_session]) }))
writeFileSync(D + 'tracking-vs-full.json', JSON.stringify(a.tracking_vs_full))
writeFileSync(D + 'nodes.json', JSON.stringify(a.nodes))
writeFileSync(D + 'admissions.json', JSON.stringify({ ...a.admissions, ranked, visible_gain: VISIBLE_GAIN, track_sessions: [a.track_sessions[0], a.track_sessions.at(-1)] }))
const c = ranked.reduce((m, r) => (m[r.recommendation] = (m[r.recommendation] || 0) + 1, m), {})
console.log(JSON.stringify({ map_tickers: Object.keys(v).length, map_funds: Object.keys(funds).length, recommendations: c }))
