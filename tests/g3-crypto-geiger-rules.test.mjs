// G3 (5 Oct 2026): the two voting rules of the non-equity Geiger, and the staged SQL that carries them.
// The SQL itself is exercised on a throw-away database by deliverables/20261005/g3-crypto-geiger/sqltest/run.mjs
// (25 steps); here the rules are pinned as plain functions and the staged files are checked for their shape.
import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { votesOld, votesNew, momentum, composite, r4, threeDayFromDaily, momentumRead, TF_SECONDS } from '../deliverables/20261005/g3-crypto-geiger/tools/geiger-rules.mjs'

const S = f => readFileSync(new URL('../staged/g3/' + f, import.meta.url), 'utf8')
const NOW = Date.UTC(2026, 9, 5, 23, 30) / 1000, H = 3600, DAY = 86400
const W = { '3h': 1.235817, '4h': 2.278755, '6h': 3.178477, '12h': 3.172702, '1d': 3.178477, '3d': 2.576738, '1w': 0.987499 }

test('rule 1: a bar size with no fresh bar does not vote as today\'s — the 8 Aug 3-day bars', () => {
  const stale = { now: NOW, tf: '3D', readTs: NOW - 21 * H, barTs: Date.UTC(2026, 7, 8) / 1000 }
  assert.equal(votesOld({ now: Date.UTC(2026, 9, 5, 3, 0) / 1000, readTs: Date.UTC(2026, 9, 5, 2, 34) / 1000 }), true, 'live rule: it voted 02:34-05:34 every night')
  assert.deepEqual(votesNew(stale), { votes: false, why: 'no fresh bar' })
  assert.deepEqual(votesNew({ ...stale, barTs: NOW - 2 * DAY }), { votes: true, why: null }, 'the forming 3-day bar votes')
  assert.deepEqual(votesNew({ ...stale, barTs: NOW - 5 * DAY }), { votes: true, why: null }, 'the bar just closed still votes')
  assert.deepEqual(votesNew({ ...stale, barTs: NOW - 6 * DAY }), { votes: false, why: 'no fresh bar' }, 'two bar-lengths old: out')
  assert.deepEqual(votesNew({ ...stale, barTs: null }), { votes: false, why: 'no bar stored' })
})

test('rule 1: the dropped size leaves the weight sum and the rest is renormalised', () => {
  const rows = [{ tf: '1d', w: W['1d'], read: 0.5, votes: true }, { tf: '6h', w: W['6h'], read: 0.1, votes: true }, { tf: '3d', w: W['3d'], read: 0.96, votes: false }]
  const m = momentum(rows)
  assert.equal(m.n, 2)
  assert.equal(r4(m.mom), r4((0.5 * W['1d'] + 0.1 * W['6h']) / (W['1d'] + W['6h'])))
  assert.equal(r4(composite({ mom: m.mom, trend: 1 })), r4((1 + m.mom) / 2))
  assert.deepEqual(momentum(rows.map(r => ({ ...r, votes: false }))), { mom: null, n: 0 }, 'no size can vote: no new number is published (the name is carried)')
  assert.equal(composite({ mom: null, trend: 1 }), null)
})

test('rule 2: every size votes until its next bar is due (+1 bar-length of grace), not for a fixed 3 hours', () => {
  for (const [tf, ageH] of [['240', 3.3], ['6h', 5.1], ['12h', 11], ['W', 20.3]]) {
    const r = { now: NOW, tf, readTs: NOW - ageH * H, barTs: NOW - Math.min(ageH * H, TF_SECONDS[tf] - 60) }
    assert.equal(votesOld(r), false, `live rule drops the ${tf} reading at ${ageH} h`)
    assert.equal(votesNew(r).votes, true, `new rule keeps the ${tf} reading at ${ageH} h`)
  }
  assert.deepEqual(votesNew({ now: NOW, tf: '12h', readTs: NOW - 25 * H, barTs: NOW - H }), { votes: false, why: 'reading too old' })
  assert.equal(votesNew({ now: NOW, tf: '1', readTs: NOW - 170, barTs: NOW - 200 }).votes, true, '15-minute floor for the 1-minute size')
  assert.equal(votesNew({ now: NOW, tf: '1', readTs: NOW - 1000, barTs: NOW - 30 }).votes, false)
})

test('through a day the live rule changes who votes; the new rule does not', () => {
  // the 12-hour ribbon job runs at 00:24 and 12:24 UTC; its reading is current for 12 hours
  const day = Date.UTC(2026, 9, 5) / 1000, made = h => (h >= 12.4 ? day + 12.4 * H : h >= 0.4 ? day + 0.4 * H : day - 11.6 * H)
  const hours = [1, 4, 8, 11, 16, 21.5]
  assert.deepEqual(hours.map(h => votesOld({ now: day + h * H, readTs: made(h) })), [true, false, false, false, false, false])
  assert.deepEqual(hours.map(h => votesNew({ now: day + h * H, tf: '12h', readTs: made(h), barTs: day + (h >= 12 ? 12 : 0) * H }).votes), [true, true, true, true, true, true])
})

test('3-day bars are folded from daily bars on the resampler\'s own anchor and need 2 days', () => {
  const d0 = Date.UTC(2026, 9, 1) / 1000 // Thu 1 Oct 2026 opens a bucket (anchor Mon 3 Jan 2000, every 3 days)
  const daily = [0, 1, 2, 3].map(i => ({ t: d0 + i * DAY, o: 10 + i, h: 20 + i, l: 5 - i, c: 11 + i }))
  assert.deepEqual(threeDayFromDaily(daily), [{ t: d0, o: 10, h: 22, l: 3, c: 13, n: 3 }], 'the 4th day alone does not make a bar yet')
  assert.equal(threeDayFromDaily([...daily, { t: d0 + 4 * DAY, o: 1, h: 30, l: 1, c: 2 }]).length, 2)
})

test('the momentum port: needs 15 bars, stays inside -1..+1, and a live price only moves the last bar', () => {
  const bars = Array.from({ length: 40 }, (_, i) => ({ c: 100 + i, h: 101 + i, l: 99 + i }))
  assert.equal(momentumRead(bars.slice(0, 14)), null)
  assert.equal(momentumRead(bars).read, 1)
  assert.ok(momentumRead(bars, 60).read < momentumRead(bars).read)
})

test('staged files: each has its rollback and its saved body, the rule lines are there, no credential is', () => {
  const files = readdirSync(new URL('../staged/g3/', import.meta.url)).filter(f => f.endsWith('.sql'))
  for (const f of files.filter(f => !f.includes('ROLLBACK'))) assert.ok(files.includes(f.replace('.sql', '_ROLLBACK.sql')), f + ' has a rollback')
  const live = S('saved/refresh_geiger__LIVE_20261005.sql'), body = live.slice(live.indexOf('CREATE OR REPLACE FUNCTION'))
  assert.ok(live.includes('r.updated_ts>cut-10800'), 'the saved live body carries the fixed 3-hour line')
  assert.ok(S('03_geiger_width_votes_ROLLBACK.sql').includes(body), 'the rollback restores the saved body to the byte')
  const v = S('03_geiger_width_votes.sql')
  assert.match(v, /p_now - x\.bar_ts < greatest\(2 \* x\.secs, 900\)/)
  assert.match(v, /p_now - x\.read_ts < greatest\(2 \* x\.secs, 900\)/)
  assert.match(v, /x\.read_ts > p_now - 10800/, 'the live rule is kept for the tickers not yet in scope')
  assert.match(v, /array\['crypto'\]/)
  assert.ok(S('02_crypto_daily_bars_view_ROLLBACK.sql').includes(S('saved/ohlcv_daily_adj__LIVE_20261005.sql').split('create or replace view')[1]))
  for (const f of [...files, 'saved/refresh_geiger__LIVE_20261005.sql', 'saved/scin_resample_tf__LIVE_20261005.sql', 'saved/ohlcv_daily_adj__LIVE_20261005.sql']) {
    assert.doesNotMatch(S(f), /Bearer\s+[A-Za-z0-9._-]{12,}|eyJ[A-Za-z0-9_-]{20,}|service_role/i, f + ' carries no credential')
  }
})
