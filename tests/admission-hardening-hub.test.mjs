// ADMISSION HARDENING (27 Sep): the FMP reference-row list is written by the provider builder from the canonical
// file's digest_history. It must hold the current set's digest (new rows) and every earlier one (old rows keep
// their stamp), in the shape PostgREST's in.(…) filter reads, on the board AND its trial company-view copy.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync } from 'node:fs'

const pages = ['index.html', 'preview/company-view/index.html'].filter(p => existsSync(new URL('../' + p, import.meta.url)))
const listOf = (src) => {
  const m = src.match(/const SC_FMP_REFERENCE_DIGESTS = ("\(" \+ \[[\s\S]*?\]\.join\(","\) \+ "\)");/)
  assert.ok(m, 'SC_FMP_REFERENCE_DIGESTS is not in the builder-written form')
  return Function('return ' + m[1])()
}

for (const page of pages) {
  test(`${page}: FMP reference digests = the whole history, ending at the current set`, () => {
    const src = readFileSync(new URL('../' + page, import.meta.url), 'utf8')
    const current = src.match(/const SC_EQUITY_UNIVERSE_DIGEST = "([a-f0-9]{64})";/)[1]
    const list = listOf(src)
    assert.match(list, /^\([a-f0-9]{64}(,[a-f0-9]{64})*\)$/)
    const ds = list.slice(1, -1).split(',')
    assert.equal(ds.at(-1), current, 'the newest FMP rows would be filtered out')
    assert.equal(new Set(ds).size, ds.length)
    // the rows written before 27 Sep carry the 364-name stamp; dropping it blanked the RSI column once
    assert.ok(ds.includes('ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3'))
    assert.match(src, /universe_hash=in\." \+ SC_FMP_REFERENCE_DIGESTS/)
  })
}

test('the chat prompt names the same identities, current last', () => {
  const chat = readFileSync(new URL('../supabase/functions/chat/index.ts', import.meta.url), 'utf8')
  const board = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
  const ds = listOf(board).slice(1, -1).split(',')
  assert.ok(chat.includes(`Accepted source-artifact identities (oldest to current) are ${ds.join(', ')}.`))
})
