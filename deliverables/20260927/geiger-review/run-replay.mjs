#!/usr/bin/env node
// G2 Geiger review runner. Reads provider bars from the chart API (read-only, GET only), replays the
// live Geiger maths at every session close, and writes results.json next to this file.
// No database, no R2, no writes anywhere but this folder and the cache directory.
//
//   CACHE=/path/to/cache node run-replay.mjs
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { rungReading, composite, changePieces, varianceShares, absShares, crossings, quantile, corr }
  from './geiger-replay.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const API = 'https://scintilla-massive-chart-api.fly.dev'
const CACHE = process.env.CACHE || join(HERE, '.cache')
const SYMS = 'AAPL MSFT NVDA AMZN GOOGL META TSLA JPM XOM UNH JNJ PG KO WMT HD CAT BA NFLX AMD COST'.split(' ')
const SESSIONS = 90
const H = 3600e3, DAY = 24 * H
// equalizer key -> [chart token, bar length ms, deep limit]
const RUNGS = {
  '1m': ['1m', 60e3, 100000], '3m': ['3m', 180e3, 40000], '5m': ['5m', 300e3, 25000], '10m': ['10m', 600e3, 12000],
  '15m': ['15', 900e3, 8000], '30m': ['30', 1800e3, 4000], '1h': ['60', H, 2500], '2h': ['120', 2 * H, 2000],
  '3h': ['180', 3 * H, 1500], '4h': ['240', 4 * H, 1200], '6h': ['6h', 6 * H, 1200], '12h': ['12h', 12 * H, 800],
  '1d': ['D', DAY, 1500], '3d': ['3D', 3 * DAY, 800], '1w': ['W', 7 * DAY, 600], '2w': ['2W', 14 * DAY, 500], '1M': ['M', null, 300]
}
const KEYS = Object.keys(RUNGS)
const BELOW_2H = new Set(['1m', '3m', '5m', '10m', '15m', '30m', '1h'])
const BELOW_3H = new Set([...BELOW_2H, '2h'])
// Default = the Equalizer's flat starting curve: every handle at .55, so every timeframe saves at
// weight 1.0 (Hub index.html:23160 and eqSaveRows at :23185).
const DEFAULT_W = Object.fromEntries(KEYS.map(k => [k, 1]))
// Alan's saved row: the global operator_weights row, receipt f6cf97b5…97ad1, echoed by live /geiger.
const ALAN_W = { '1m': 0, '3m': 0, '5m': 0, '10m': 0, '15m': 0, '30m': 0, '1h': 0, '2h': 0.391534, '3h': 1.235817,
  '4h': 2.278755, '6h': 3.178477, '12h': 3.172702, '1d': 3.178477, '3d': 2.576738, '1w': 0.987499, '2w': 0, '1M': 0 }
const drop = (w, set) => Object.fromEntries(Object.entries(w).map(([k, v]) => [k, set.has(k) ? 0 : v]))
const PROFILES = { default: DEFAULT_W, alan: ALAN_W, default_from3h: drop(DEFAULT_W, BELOW_3H), alan_from3h: drop(ALAN_W, BELOW_3H) }

const hdr = { Origin: 'https://scintillahub.ai' }
async function get (url) {
  for (let a = 0; a < 4; a++) {
    try {
      const r = await fetch(url, { headers: hdr, signal: AbortSignal.timeout(120000) })
      if (r.ok) return await r.json()
      if (r.status === 404) return null
    } catch (_) {}
    await new Promise(z => setTimeout(z, 800 * (a + 1)))
  }
  throw new Error(`GET failed ${url}`)
}
async function seriesFor (sym, key) {
  // macOS folds case, so '1m' (minute) and '1M' (month) would share one cache file. Name by token.
  const f = join(CACHE, `${sym}_tok_${RUNGS[key][0] === 'M' ? 'MONTH' : RUNGS[key][0]}.json`)
  if (existsSync(f)) return JSON.parse(await readFile(f, 'utf8'))
  const [tok, , lim] = RUNGS[key]
  const base = `${API}/candles?symbol=${sym}&tf=${encodeURIComponent(tok)}&authority=provider&limit=`
  const deep = await get(base + lim), tail = await get(base + 230)
  const m = new Map()
  for (const b of deep?.series || []) m.set(b.t, { t: b.t, c: +b.c, h: +b.h, l: +b.l })
  const deepLast = deep?.series?.at(-1)?.t ?? null
  for (const b of tail?.series || []) m.set(b.t, { t: b.t, c: +b.c, h: +b.h, l: +b.l })
  const bars = [...m.values()].sort((a, b) => a.t - b.t)
  const tailFirst = tail?.series?.[0]?.t ?? null
  const out = { sym, key, bars, deepLast, tailFirst, gap: deepLast != null && tailFirst != null && tailFirst > deepLast + (RUNGS[key][1] || 31 * DAY) }
  await writeFile(f, JSON.stringify(out))
  return out
}
const barEnd = (key, t) => {
  const len = RUNGS[key][1]
  if (len) return t + len
  const d = new Date(t); return Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), d.getUTCHours())
}
// index of the last bar complete at `asof` (binary search on bar end)
function lastComplete (key, bars, asof) {
  let lo = 0, hi = bars.length - 1, ans = -1
  while (lo <= hi) { const mid = (lo + hi) >> 1; if (barEnd(key, bars[mid].t) <= asof) { ans = mid; lo = mid + 1 } else hi = mid - 1 }
  return ans
}

await mkdir(CACHE, { recursive: true })
const data = {}
let qi = 0
const jobs = SYMS.flatMap(s => KEYS.map(k => [s, k]))
const gaps = []
await Promise.all(Array.from({ length: 4 }, async () => {
  while (qi < jobs.length) {
    const [s, k] = jobs[qi++]
    const r = await seriesFor(s, k)
    ;(data[s] ||= {})[k] = r.bars
    if (r.gap) gaps.push(`${s}/${k}`)
  }
}))
console.error(JSON.stringify({ fetched: jobs.length, gaps }))

// Session closes: each daily bar starts 04:00 UTC on its ET date; "as of" = ET midnight after it.
const sessions = data.AAPL['1d'].map(b => b.t).slice(-(SESSIONS + 1))
const asofs = sessions.map(t => t + DAY)
const perSym = {}
const rungDaily = Object.fromEntries(KEYS.map(k => [k, []]))       // |day-to-day change| pooled
const rungStats = {}
for (const s of SYMS) {
  const daily = asofs.map(asof => {
    const r = {}
    for (const k of KEYS) {
      const bars = data[s][k]; const i = lastComplete(k, bars, asof)
      if (i < 1) { r[k] = null; continue }
      const x = rungReading(bars.slice(Math.max(0, i - 229), i + 1))
      r[k] = x ? x.composite : null
    }
    return r
  })
  perSym[s] = daily
}

// ---- Q2: share of day-to-day movement, below 2h vs 2h and up --------------------------------
const q2 = {}
for (const [name, w] of Object.entries({ default: DEFAULT_W, alan: ALAN_W })) {
  const rows = [], rowsRung = []
  for (const s of SYMS) {
    const d = perSym[s]
    for (let i = 1; i < d.length; i++) {
      if (KEYS.some(k => w[k] > 0 && (d[i - 1][k] == null || d[i][k] == null))) continue
      const p = changePieces(d[i - 1], d[i], w)
      const total = Object.values(p).reduce((a, b) => a + b, 0)
      let fast = 0, slow = 0
      for (const [k, v] of Object.entries(p)) (BELOW_2H.has(k) ? (fast += v) : (slow += v))
      rows.push({ total, groups: { below_2h: fast, from_2h: slow } })
      rowsRung.push({ total, groups: p })
    }
  }
  q2[name] = { n: rows.length, variance_share: varianceShares(rows), abs_share: absShares(rows),
    per_rung_variance_share: varianceShares(rowsRung),
    typical_daily_change: quantile(rows.map(r => Math.abs(r.total)), 0.5) }
}

// ---- Q2b: what changes if everything below 3h is dropped ------------------------------------
const q2b = {}
for (const [base, cut] of [['default', 'default_from3h'], ['alan', 'alan_from3h']]) {
  const a = [], b = [], da = [], db = [], signFlips = []
  for (const s of SYMS) {
    const d = perSym[s]
    const ca = d.map(r => composite(r, PROFILES[base])), cb = d.map(r => composite(r, PROFILES[cut]))
    for (let i = 0; i < d.length; i++) {
      if (ca[i] == null || cb[i] == null) continue
      a.push(ca[i]); b.push(cb[i])
      if (Math.sign(ca[i]) !== Math.sign(cb[i])) signFlips.push(1); else signFlips.push(0)
      if (i && ca[i - 1] != null && cb[i - 1] != null) { da.push(Math.abs(ca[i] - ca[i - 1])); db.push(Math.abs(cb[i] - cb[i - 1])) }
    }
  }
  const diff = a.map((x, i) => Math.abs(x - b[i]))
  q2b[base] = { n: a.length, corr_level: corr(a, b), median_abs_level_diff: quantile(diff, 0.5), p90_abs_level_diff: quantile(diff, 0.9),
    sign_disagree_share: signFlips.reduce((x, y) => x + y, 0) / signFlips.length,
    median_daily_change_before: quantile(da, 0.5), median_daily_change_after: quantile(db, 0.5) }
}

// ---- Q4: speed per rung (day-to-day) and crossing time (in the rung's own bars) ---------------
for (const k of KEYS) {
  const ch = []
  for (const s of SYMS) { const d = perSym[s]; for (let i = 1; i < d.length; i++) if (d[i][k] != null && d[i - 1][k] != null) ch.push(Math.abs(d[i][k] - d[i - 1][k])) }
  const cross = []
  const slow = ['1d', '3d', '1w', '2w', '1M'].includes(k)
  const from = slow ? asofs.at(-1) - 3 * 365 * DAY : asofs[0]
  for (const s of SYMS) {
    const bars = data[s][k]; const ser = []
    for (let i = 0; i < bars.length; i++) {
      if (bars[i].t < from || barEnd(k, bars[i].t) > asofs.at(-1)) continue
      const x = rungReading(bars.slice(Math.max(0, i - 229), i + 1))
      ser.push({ t: barEnd(k, bars[i].t), v: x ? x.composite : null })
    }
    cross.push(...crossings(ser))
  }
  const hrs = cross.map(c => c.ms / H)
  rungStats[k] = { median_abs_daily_change: quantile(ch, 0.5), p90_abs_daily_change: quantile(ch, 0.9), n_changes: ch.length,
    crossing_window: slow ? '3 years' : `${SESSIONS} sessions`, crossings: cross.length,
    crossings_per_name_per_month: cross.length / SYMS.length / (slow ? 36 : SESSIONS / 21),
    median_cross_hours: quantile(hrs, 0.5), p25_cross_hours: quantile(hrs, 0.25), p75_cross_hours: quantile(hrs, 0.75) }
}
// composite crossing at daily sampling
const compStats = {}
for (const [name, w] of Object.entries(PROFILES)) {
  const ch = [], cross = []
  for (const s of SYMS) {
    const c = perSym[s].map((r, i) => ({ t: asofs[i], v: composite(r, w) }))
    for (let i = 1; i < c.length; i++) if (c[i].v != null && c[i - 1].v != null) ch.push(Math.abs(c[i].v - c[i - 1].v))
    cross.push(...crossings(c))
  }
  const days = cross.map(c => c.ms / DAY)
  compStats[name] = { median_abs_daily_change: quantile(ch, 0.5), p90_abs_daily_change: quantile(ch, 0.9),
    crossings: cross.length, median_cross_calendar_days: quantile(days, 0.5), p25: quantile(days, 0.25), p75: quantile(days, 0.75) }
}

// ---- Q5: a light tier fed by daily bars alone (1d, 3d, 1w) vs the full composite --------------
const LIGHT = {
  alan_weights: { '1d': ALAN_W['1d'], '3d': ALAN_W['3d'], '1w': ALAN_W['1w'] },
  equal: { '1d': 1, '3d': 1, '1w': 1 }
}
const q5 = {}
for (const [name, lw] of Object.entries(LIGHT)) {
  const full = [], light = [], agree = [], dl = []
  for (const s of SYMS) {
    const d = perSym[s]
    let prev = null
    for (const r of d) {
      const a = composite(r, ALAN_W), b = composite(r, lw)
      if (a == null || b == null) continue
      full.push(a); light.push(b); agree.push(Math.sign(a) === Math.sign(b) ? 1 : 0)
      if (prev != null) dl.push(Math.abs(b - prev)); prev = b
    }
  }
  q5[name] = { n: full.length, corr_with_full: corr(full, light),
    median_abs_diff: quantile(full.map((x, i) => Math.abs(x - light[i])), 0.5),
    p90_abs_diff: quantile(full.map((x, i) => Math.abs(x - light[i])), 0.9),
    same_sign_share: agree.reduce((x, y) => x + y, 0) / agree.length,
    median_abs_daily_change: quantile(dl, 0.5) }
}

// ---- How alike are neighbouring rungs (daily readings pooled over names) ----------------------
const PAIRS = [['15m', '1h'], ['1h', '2h'], ['2h', '3h'], ['3h', '4h'], ['4h', '6h'], ['6h', '12h'], ['12h', '1d'], ['1d', '3d'], ['3d', '1w']]
const rungCorr = {}
for (const [a, b] of PAIRS) {
  const x = [], y = []
  for (const s of SYMS) for (const r of perSym[s]) if (r[a] != null && r[b] != null) { x.push(r[a]); y.push(r[b]) }
  rungCorr[`${a}~${b}`] = corr(x, y)
}

// ---- Fidelity: replay "now" vs live /geiger?detail=1 -----------------------------------------
const live = await get(`${API}/geiger?symbols=${SYMS.join(',')}&detail=1`)
const fid = []
const now = Date.now()
for (const s of SYMS) {
  const r = {}
  for (const k of KEYS) { const bars = data[s][k]; const i = lastComplete(k, bars, now); const x = i >= 1 ? rungReading(bars.slice(Math.max(0, i - 229), i + 1)) : null; r[k] = x ? x.composite : null }
  const mine = composite(r, ALAN_W), theirs = live?.symbols?.[s]?.composite
  const rungDiff = {}
  for (const k of Object.keys(ALAN_W)) if (ALAN_W[k] > 0) { const lv = live?.symbols?.[s]?.rungs?.[k]?.tf_composite; if (lv != null && r[k] != null) rungDiff[k] = +(r[k] - lv).toFixed(4) }
  fid.push({ s, replay: mine == null ? null : +mine.toFixed(4), live: theirs, diff: mine == null || theirs == null ? null : +(mine - theirs).toFixed(4), rungDiff })
}

const out = { generated_utc: new Date().toISOString(), symbols: SYMS, sessions: SESSIONS,
  first_session: new Date(sessions[0]).toISOString().slice(0, 10), last_session: new Date(sessions.at(-1)).toISOString().slice(0, 10),
  live_computed_utc: live?.computed_utc, live_receipt: live?.equalizer_receipt_sha256, gaps,
  profiles: PROFILES, q2, q2b, q5, rungCorr, rungStats, compStats, fidelity: fid }
await writeFile(join(HERE, 'results.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({ ok: true, q2, q2b, compStats }, null, 1))
