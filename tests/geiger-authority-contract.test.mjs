import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)
const contract = require('../geiger-authority-contract.js')
const source = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const OWNER = contract.GLOBAL_OWNER_ID

function currentRows () {
  const rows = []
  const add = (dim, values) => Object.entries(values).forEach(([key, weight]) => rows.push({
    dim, key, weight, enabled: true, owner_id: OWNER
  }))
  add('fam_handle', { 0: 0.5, 1: 0.5 })
  add('family', { MOMENTUM: 0.5, TREND: 0.5 })
  add('momentum', { RSI: 0.6, WILLIAMS: 0.4 })
  add('momentum_mix', { rsi: 0.6, williams: 0.4 })
  add('tf_handle', {
    0: 0, 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0.123183,
    8: 0.388808, 9: 0.716933, 10: 1, 11: 0.998183, 12: 1,
    13: 0.810683, 14: 0.310683, 15: 0, 16: 0
  })
  add('timeframe', {
    '1m': 0, '3m': 0, '5m': 0, '10m': 0, '15m': 0, '30m': 0, '1h': 0,
    '2h': 0.391534, '3h': 1.235817, '4h': 2.278755, '6h': 3.178477,
    '12h': 3.172702, '1d': 3.178477, '3d': 2.576738, '1w': 0.987499,
    '2w': 0, '1M': 0
  })
  return rows
}

function artifactFor (equalizer, { symbols = {}, absent = 0 } = {}) {
  const expected = 364 * equalizer.participating_rungs.length
  return {
    equalizer_receipt_sha256: equalizer.receipt,
    participating_rungs: structuredClone(equalizer.participating_rungs),
    excluded_zero_weight: structuredClone(equalizer.excluded_zero_weight),
    excluded_disabled: structuredClone(equalizer.excluded_disabled),
    accounting: {
      rungs_computed: expected - absent,
      rung_absent: absent,
      named_rung_absences: Array.from({ length: absent }, (_, i) => ({
        symbol: `ABS${i}`, state: 'PROVIDER_DAILY_SESSION_ABSENT',
        equalizer_key: equalizer.participating_rungs[i % equalizer.participating_rungs.length].equalizer_key
      })),
      failed: 0,
      failures: []
    },
    symbols
  }
}

test('today\'s exact 42 saved rows derive the accepted digest and unchanged 8-rung output', async () => {
  const result = await contract.deriveOperatorEqualizer(currentRows().reverse())
  assert.equal(result.receipt, 'f6cf97b57cf26a37aeb8393dec676f1776b02da282dffcce95786e5762697ad1')
  assert.equal(result.rows.length, 42)
  assert.equal(result.timeframe_keys.length, 17)
  assert.deepEqual(result.participating_rungs.map(r => r.equalizer_key),
    ['12h', '1d', '1w', '2h', '3d', '3h', '4h', '6h'])
  assert.deepEqual(result.excluded_zero_weight,
    ['10m', '15m', '1M', '1h', '1m', '2w', '30m', '3m', '5m'])
  assert.deepEqual(result.excluded_disabled, [])
})

test('the full canonical vocabulary and explicit enabled flags fail closed', async t => {
  await t.test('missing enabled field', async () => {
    const rows = currentRows(); delete rows[0].enabled
    await assert.rejects(contract.deriveOperatorEqualizer(rows), /EQUALIZER_ROW_FIELDS_INVALID/)
  })
  await t.test('unknown timeframe replacing a canonical one', async () => {
    const rows = currentRows(); rows.find(r => r.dim === 'timeframe' && r.key === '3h').key = '8h'
    await assert.rejects(contract.deriveOperatorEqualizer(rows), /EQUALIZER_KEYS_INVALID:timeframe/)
  })
  await t.test('nonboolean enabled flag', async () => {
    const rows = currentRows(); rows.find(r => r.dim === 'timeframe').enabled = 1
    await assert.rejects(contract.deriveOperatorEqualizer(rows), /EQUALIZER_ENABLED_INVALID/)
  })
  await t.test('no enabled positive timeframe', async () => {
    const rows = currentRows(); rows.filter(r => r.dim === 'timeframe').forEach(r => { r.enabled = false })
    await assert.rejects(contract.deriveOperatorEqualizer(rows), /TIMEFRAME_PROFILE_HAS_NO_ENABLED_POSITIVE_WEIGHT/)
  })
  await t.test('disabled positive frame leaves participation and is named separately', async () => {
    const rows = currentRows(); rows.find(r => r.dim === 'timeframe' && r.key === '3h').enabled = false
    const result = await contract.deriveOperatorEqualizer(rows)
    assert.ok(!result.participating_rungs.some(r => r.equalizer_key === '3h'))
    assert.deepEqual(result.excluded_disabled, ['3h'])
    assert.ok(!result.excluded_zero_weight.includes('3h'))
  })
})

test('artifact digest and all three profile partitions must match current saved state exactly', async () => {
  const equalizer = await contract.deriveOperatorEqualizer(currentRows())
  const artifact = artifactFor(equalizer)
  assert.equal(contract.validateArtifactProfile(artifact, equalizer), true)

  const reordered = structuredClone(artifact)
  reordered.participating_rungs.reverse(); reordered.excluded_zero_weight.reverse()
  assert.equal(contract.validateArtifactProfile(reordered, equalizer), true)

  for (const [field, mutate, pattern] of [
    ['digest', a => { a.equalizer_receipt_sha256 = '0'.repeat(64) }, /DIGEST_MISMATCH/],
    ['rungs', a => { a.participating_rungs[0].weight += 1 }, /PARTICIPATING_RUNGS_MISMATCH/],
    ['zero', a => { a.excluded_zero_weight.pop() }, /EXCLUDED_ZERO_WEIGHT_MISMATCH/],
    ['disabled', a => { delete a.excluded_disabled }, /EXCLUDED_DISABLED_MISMATCH/]
  ]) {
    const broken = structuredClone(artifact); mutate(broken)
    assert.throws(() => contract.validateArtifactProfile(broken, equalizer), pattern, field)
  }
})

test('accounting admits named absences but rejects failures and unexplained cells', async () => {
  const equalizer = await contract.deriveOperatorEqualizer(currentRows())
  const accounted = artifactFor(equalizer, { absent: 2 })
  assert.deepEqual(contract.auditArtifactAccounting(accounted, 364), {
    expected_cells: 2912, computed: 2910, named_absent: 2, unexplained: 0, failed: 0
  })

  const missing = structuredClone(accounted); delete missing.accounting
  assert.throws(() => contract.auditArtifactAccounting(missing, 364), /ACCOUNTING_MISSING/)

  const failed = structuredClone(accounted)
  failed.accounting.failed = 1; failed.accounting.failures = ['AAPL: provider failure']
  assert.throws(() => contract.auditArtifactAccounting(failed, 364), /ACCOUNTING_FAILED/)

  const unexplained = structuredClone(accounted)
  unexplained.accounting.rungs_computed--
  assert.throws(() => contract.auditArtifactAccounting(unexplained, 364), /ACCOUNTING_UNEXPLAINED:1/)
})

test('per-symbol contributor coverage, not a fresh top-level timestamp, controls rank readiness', () => {
  const full = contract.contributorCoverage({ AAPL: { tf_contributors: 8 }, MSFT: { tf_contributors: 8 } }, 8)
  assert.equal(full.complete, true)
  const staleOrIncomplete = contract.contributorCoverage({
    AAPL: { tf_contributors: 8 }, MSFT: { tf_contributors: 3, computed_utc: new Date().toISOString() }
  }, 8)
  assert.equal(staleOrIncomplete.complete, false)
  assert.deepEqual(staleOrIncomplete.incomplete_symbols, ['MSFT'])
})

test('Hub wiring has no static receipt or exactly-eight admission and preserves fixed universe identity', () => {
  assert.match(source, /src="\/geiger-authority-contract\.js"/)
  assert.match(source, /operator_weights\?select=dim,key,weight,enabled,owner_id/)
  assert.match(source, /SC_GEIGER_AUTHORITY\.deriveOperatorEqualizer\(rows\)/)
  assert.match(source, /validateArtifactProfile\(j, currentEqualizer\)/)
  assert.match(source, /auditArtifactAccounting\(j, SC_EXPECTED_EQUITY_COUNT\)/)
  assert.match(source, /SC_CG\.meta\.coverage\.complete === true/)
  assert.match(source, /SC_CG\.meta\.accounting\.named_absent === 0/)
  assert.match(source, /SC_CG\.meta\.accounting\.computed === SC_CG\.meta\.accounting\.expected_cells/)
  assert.match(source, /const SC_EXPECTED_EQUITY_COUNT = 424/)
  assert.match(source, /const SC_EQUITY_UNIVERSE_DIGEST = "4a5dd2ac74dee077ab23c0a6f237844ec83821957a2d305653771f0154e06621"/)
  /* M57: the superseded identity must remain ACCEPTED for FMP reference rows, or the RSI column
     blanks for every name that was already working. */
  assert.match(source, /SC_PREVIOUS_EQUITY_UNIVERSE_DIGEST = "ab8f7965258d939f0a97fbfeac9a271547c258df7a2616aff6ccff746bb5d9d3"/)
  assert.match(source, /SC_FMP_REFERENCE_DIGESTS = "\(7ad595cc[0-9a-f]*," \+\s*\n?\s*SC_PREVIOUS_EQUITY_UNIVERSE_DIGEST \+ "," \+ SC_EQUITY_UNIVERSE_DIGEST/)
  assert.doesNotMatch(source, /const SC_EQUALIZER_RECEIPT/)
  assert.doesNotMatch(source, /participating_rungs\.length !== 8/)
  assert.doesNotMatch(source, /rungs\.length === 8/)
})
