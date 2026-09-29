// N4 scout Geiger on the round-3 market map (28 Sep): the snapshot's shape, where scout bars may appear, and the shader.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
const D = new URL('../deliverables/20260928/market-map-r3/', import.meta.url)
const html = readFileSync(new URL('index.html', D), 'utf8')
const snap = JSON.parse(readFileSync(new URL('scout-geiger.json', D), 'utf8'))
const nodes = JSON.parse(readFileSync(new URL('nodes.json', D), 'utf8')).nodes

test('the scout snapshot names itself, its close and its Equalizer, and carries only daily-rung readings in range', () => {
  assert.match(snap.what, /not the Hub Geiger/i)
  assert.match(snap.as_of, /^\d{4}-\d{2}-\d{2}$/)
  assert.deepEqual(snap.equalizer.rungs.map(r => r.key), ['1d', '3d', '1w'])
  for (const [t, v] of Object.entries(snap.v)) { assert.equal(v.length, 3, t); for (const x of v) assert.ok(x === null || (x >= -1 && x <= 1), t) }
  for (const f of Object.values(snap.funds)) assert.ok(f.cov >= 0 && f.cov <= 100.5 && f.blend >= -1 && f.blend <= 1)
})

test('every waiting ball that has a scout reading gets one; the snapshot covers the map', () => {
  const waiting = nodes.filter(n => n.ticker && !n.served)
  const withScout = waiting.filter(n => snap.v[n.ticker.replace(/-/g, '.')])
  assert.ok(withScout.length >= waiting.length - 2, `${withScout.length} of ${waiting.length}`)
})

test('a scout bar is drawn only where the full Geiger is missing, and the divergence compares scout with scout', () => {
  assert.match(html, /sg: gg \? null : scoutOf\(n\.ticker\)/)
  assert.ok(html.includes('own = Number.isFinite(f.own) ? f.own : null'))
  assert.match(html, /slim bar = scout Geiger/)
})

test('the bar shader uses no GLSL reserved word as a name (a "half" once blanked every bar)', () => {
  const frag = html.slice(html.indexOf('fragmentShader:'), html.indexOf('const barMesh'))
  for (const w of ['half', 'input', 'output', 'filter', 'sample', 'fixed', 'common', 'partition', 'active']) assert.doesNotMatch(frag, new RegExp(`\\b(float|vec[234]|int|bool)\\s+${w}\\b`), w)
})

test('N12: readings come from the chart API route first, the snapshot is the fallback, and snapshot fund blends never sit beside a different close', () => {
  assert.ok(html.includes('getJSON(CHART_API + "/v1/scout-geiger")'))
  assert.ok(html.includes('snap && snap.as_of === sr.value.as_of ? snap.funds || {} : {}'))
  assert.match(html, /source: "route"/)
  assert.match(html, /source: "snapshot"/)
  assert.match(html, /"chart API" : "page snapshot"/)
})
