// P9 (2 Oct) — a HELD previous close on the board. The API serves previous_close_state
// PREVIOUS_CLOSE_HELD_SOURCES_DISAGREE (with previous_close_hold) for a name whose provider surfaces
// disagree beyond the cent rule. Its CHG cell shows "—" and says why on hover; every other row keeps
// its %. These read the shipped index.html and run the shipped helpers.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import vm from 'node:vm'

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const start = html.indexOf('const SC_HELD_PREV = {};')
const end = html.indexOf('\n}\n', html.indexOf('function scHeldPrevPaint')) + 3
const block = html.slice(start, end)

function sandbox () {
  const cells = {}
  const mk = id => (cells[id] ??= { attrs: {}, getAttribute (k) { return this.attrs[k] ?? null },
    setAttribute (k, v) { this.attrs[k] = String(v) }, removeAttribute (k) { delete this.attrs[k] } })
  const ctx = { el: id => mk(id), cells,
    scSetTitle (n, v) { n.setAttribute('title', v == null ? '' : v) },
    scSetAttr (n, k, v) { n.setAttribute(k, v) } }
  vm.createContext(ctx)
  vm.runInContext(block + '\nthis.SC_HELD_PREV = SC_HELD_PREV; this.scHeldPrevTitle = scHeldPrevTitle; this.scHeldPrevPaint = scHeldPrevPaint;', ctx)
  return ctx
}

const FINX_HOLD = { session_et: '2026-10-01', reason: 'CROSS_CHECK_HELD',
  sources: { daily: 24.3707, prev: 24.3707, print: 24.4 }, spread_abs: 0.0293, spread_pct: 0.120226, limit_abs: 0.01 }

test('the FINX tooltip reads exactly as the brief asks', () => {
  const c = sandbox()
  c.SC_HELD_PREV.FINX = FINX_HOLD
  assert.equal(c.scHeldPrevTitle('FINX'), 'previous close held: sources disagree by $0.03 (daily 24.37 · print 24.40)')
  assert.equal(c.scHeldPrevTitle('AAPL'), '', 'a row that is not held carries no hold text')
})

test('a disagreeing /prev is named too, and missing numbers never print NaN', () => {
  const c = sandbox()
  c.SC_HELD_PREV.X = { sources: { daily: 50, prev: 50.5 }, spread_abs: 0.5 }
  assert.equal(c.scHeldPrevTitle('X'), 'previous close held: sources disagree by $0.50 (daily 50.00 · prev 50.50)')
  c.SC_HELD_PREV.Y = {}
  assert.equal(c.scHeldPrevTitle('Y'), 'previous close held: sources disagree by more than a cent')
})

test('painting sets and clears the hover and the HELD stamp on the CHG cell', () => {
  const c = sandbox()
  c.SC_HELD_PREV.FINX = FINX_HOLD
  c.scHeldPrevPaint('FINX')
  assert.match(c.cells.lc_FINX.attrs.title, /sources disagree by \$0\.03/)
  assert.equal(c.cells.lc_FINX.attrs['data-sc-prev-close-state'], 'HELD')
  delete c.SC_HELD_PREV.FINX
  c.scHeldPrevPaint('FINX')
  assert.equal(c.cells.lc_FINX.attrs.title, '')
  assert.equal(c.cells.lc_FINX.attrs['data-sc-prev-close-state'], undefined)
})

test('wiring: the quote tick records the held state and repaints; the row template carries it', () => {
  assert.match(html, /if \(q\.previous_close_state === "PREVIOUS_CLOSE_HELD_SOURCES_DISAGREE"\) SC_HELD_PREV\[t\] = q\.previous_close_hold \|\| \{\};\n\s+else delete SC_HELD_PREV\[t\];\n\s+patch\(t, price, "PROVIDER"\);\n\s+scHeldPrevPaint\(t\);/)
  assert.match(html, /id="lc_' \+ esc\(d\.t\) \+ '"' \+ \(SC_HELD_PREV\[d\.t\] \? ' data-sc-prev-close-state="HELD" title="' \+ esc\(scHeldPrevTitle\(d\.t\)\)/)
})
