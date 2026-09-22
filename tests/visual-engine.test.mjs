/* The Visual Engine workbench: the five characters exist and behave, the page runs on real feeds only,
   and it touches nothing of the Hub's. Node-only (no browser); the browser proof lives in the run dir. */
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8')
const require = createRequire(import.meta.url)
const E = require(fileURLToPath(new URL('visual-engine/geiger-engine.js', root)))

test('the crew: Bar, Mover, Quiet Rule, Clock, Label — and the agreed defaults', () => {
  for (const k of ['Bar', 'Mover', 'QuietRule', 'Clock', 'Label']) assert.ok(E[k], k)
  assert.equal(E.DEFAULTS.geiger, 'composite', 'the Hub Geiger composite drives the motion, not the fan read')
  assert.equal(E.DEFAULTS.mover, 'settle-reflow', 'settle-then-reflow is the default movement')
  assert.equal(E.SPEC_CURVE, 'cubic-bezier(.34,.02,.2,1)')
  assert.equal(E.DEFAULTS.returnToLiveMs, 45000)
})

test('the Mover holds near-ties and lets a real change through', () => {
  const fake = { classList: { add() {}, remove() {}, toggle() {} }, style: {}, appendChild() {} }
  const m = new E.Mover(fake, { tieHold: 0.02 })
  m.rows = { A: {}, B: {}, C: {} }; m.prev = ['A', 'B', 'C']; m.order = m.prev.slice()
  assert.deepEqual(m.computeOrder({ A: 0.50, B: 0.51, C: -0.2 }), ['A', 'B', 'C'], 'B is 0.01 ahead: within the hold, order kept')
  assert.deepEqual(m.computeOrder({ A: 0.50, B: 0.60, C: -0.2 }), ['B', 'A', 'C'], 'B is 0.10 ahead: it moves')
  assert.deepEqual(m.computeOrder({ A: null, B: 0.1, C: 0.2 }), ['C', 'B', 'A'], 'no reading ranks last, never as zero')
})

test('the Clock: rewind, play to the end, and the 45-second return to live', async () => {
  const c = new E.Clock({ returnToLiveMs: 40, playMs: 5 })
  c.setTimeline([{ t: '1' }, { t: '2' }, { t: '3' }])
  c.rewindTo(0); assert.equal(c.mode, 'rewind'); assert.equal(c.idx, 0)
  c.rewindTo(2); assert.equal(c.mode, 'live', 'the newest stop is live')
  c.rewindTo(1)
  await new Promise((r) => setTimeout(r, 90))
  assert.equal(c.mode, 'live', 'untouched, it returned to live on its own')
  c.play(); assert.equal(c.playing, true)
  await new Promise((r) => setTimeout(r, 200))
  assert.equal(c.mode, 'live', 'playback ends at live'); assert.equal(c.playing, false)
})

test('the Label names the Geiger and its freshness, and reduced motion is stated', () => {
  const t = E.Label.text({ geiger: 'Hub composite (chart API /geiger)', computed: new Date(Date.now() - 65000).toISOString(), verification: 'COMPLETE_UNSTAMPED', quotes: { n: 58, oldestMs: 12000, medianMs: 4000 } })
  assert.match(t, /GEIGER: Hub composite/); assert.match(t, /1 min ago/); assert.match(t, /COMPLETE_UNSTAMPED/); assert.match(t, /quotes 58 names/)
})

test('the workbench page: real feeds only, engine attached, nothing of the Hub or the Lab touched', () => {
  const html = read('visual-engine/index.html')
  assert.match(html, /src="\.\/geiger-engine\.js"/)
  assert.match(html, /scintilla-massive-chart-api\.fly\.dev/)
  for (const p of ['/geiger', '/quotes?symbols=', '/candles?symbol=', '/universe']) assert.ok(html.includes(p), p)
  assert.doesNotMatch(html, /\{t:"[A-Z]+",\s*last:/, 'no fixture rows like the motion bench')
  assert.doesNotMatch(html, /sample data|dummy data|illustrative/i, 'nothing illustrative on the workbench')
  assert.doesNotMatch(html, /indicator-lab/, 'never reaches into the Indicator Lab')
  assert.ok(!fs.existsSync(new URL('visual-engine/prototypes', root)))
  assert.match(html, /prefers-reduced-motion/)
  assert.match(html, /class="seat"/, 'the LIVE chip has a reserved seat')
})
