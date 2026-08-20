import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')

test('the selected equity visibly names the provider previous-close baseline', () => {
  assert.match(source, /class="sc-cprev" id="coPrev"/)
  assert.match(source, /"Prev " \+ fmtPxIdent\(pc\)/)
  assert.match(source, /pc\.textContent = base != null && base !== 0 \? "Prev " \+ fmtPxIdent\(base\) : ""/)
})

test('company detail never requests retired Structure or conviction columns', () => {
  assert.match(source, /&select=composite,trend,momentum,updated_ts/g)
  assert.equal((source.match(/&select=composite,trend,momentum,updated_ts/g) || []).length, 2)
  assert.doesNotMatch(source, /&select=composite,trend,momentum,structure/)
  assert.doesNotMatch(source, /&select=composite,trend,momentum,[^"\n]*conviction/)
})
