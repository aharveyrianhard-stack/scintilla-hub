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

test('the mood board: six live tiles, no control panel, real feeds only', () => {
  const html = read('visual-engine/index.html')
  assert.match(html, /src="\.\/geiger-engine\.js"/, 'the Mover and the Bar come from the engine')
  assert.match(html, /scintilla-massive-chart-api\.fly\.dev/)
  for (const p of ['/geiger', "'/geiger?symbols='", '/candles?symbol=', "'/macro'"]) assert.ok(html.includes(p), p)
  assert.equal((html.match(/<select/g) || []).length, 0, 'no pickers')
  assert.equal((html.match(/type="range"/g) || []).length, 0, 'no sliders')
  /* the BACK / CLOSE pair every Hub sub-page carries (scripts/scnav-snippet.html) is how you leave the page, not a control */
  assert.ok((html.replace(/<!-- scnav · [\s\S]*?<!-- \/scnav -->/, '').match(/<button/g) || []).length <= 2, 'at most play/pause and the way back')
  assert.equal((html.match(/key:'[a-z]+',\s*name:/g) || []).length, 6, 'six tiles, one per visual idea')
  assert.match(html, /href="\/prototypes\/"/, 'a way back to the prototypes')
  assert.match(html, /deliverables\/20260923\/context-lens\/CONTEXT-LENS\.html/, 'the Context Lens workshop stays linked')
  assert.match(html, /prefers-reduced-motion/)
  assert.doesNotMatch(html, /\{t:"[A-Z]+",\s*last:/, 'no fixture rows')
  assert.doesNotMatch(html, /sample data|dummy data|illustrative/i, 'nothing illustrative')
  assert.doesNotMatch(html, /indicator-lab/, 'never reaches into the Indicator Lab')
  assert.ok(!fs.existsSync(new URL('visual-engine/prototypes', root)))
})

test('monochrome: every colour on the page is a grey, and none of them is white or near-white', () => {
  const html = read('visual-engine/index.html')
  const seen = []
  for (const m of html.matchAll(/#([0-9a-fA-F]{6})\b/g)) {
    const h = m[1]
    seen.push([parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), '#' + h])
  }
  for (const m of html.matchAll(/rgba?\((\d+),\s*(\d+),\s*(\d+)/g)) seen.push([+m[1], +m[2], +m[3], m[0]])
  assert.ok(seen.length > 8, 'the palette is actually declared here')
  for (const [r, g, b, src] of seen) {
    assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 24, src + ' is a colour, not a grey')
    assert.ok(Math.max(r, g, b) <= 210, src + ' is white or near-white')
  }
})
