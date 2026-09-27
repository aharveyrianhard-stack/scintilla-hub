#!/usr/bin/env node
// Speed of the STORED Geiger history (fan_daily + momentum_daily, blended 0.5/0.5 as the board
// rewind does), measured from the extract already committed at
// deliverables/20260925/geiger-visuals/data.js (pulled 2026-09-25 19:27Z). No database read.
import { readFileSync, writeFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { crossings, quantile } from './geiger-replay.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(HERE, '../../20260925/geiger-visuals/data.js'), 'utf8')
const window = {}
new Function('window', src)(window)
const D = window.GV_DATA
const DAY = 864e5
const weekend = d => { const w = new Date(d + 'T12:00:00Z').getUTCDay(); return w === 0 || w === 6 }
// The stored dates are not clean sessions: some Sundays carry fresh values and some Fridays are
// missing. A weekend row that merely repeats the row before it is a carry and is dropped; any row
// with a new value is kept.
const dropCarries = rows => rows.filter((x, i) => !(i && weekend(x.d) && x.v === rows[i - 1].v))

function measure (series) {        // series: [{ d, v }] trading days only
  const ch = [], cross = []
  for (const s of series) {
    for (let i = 1; i < s.length; i++) if (s[i].v != null && s[i - 1].v != null) ch.push(Math.abs(s[i].v - s[i - 1].v))
    cross.push(...crossings(s.map(x => ({ t: Date.parse(x.d), v: x.v }))))
  }
  const days = cross.map(c => c.ms / DAY)
  return { n_changes: ch.length, median_abs_daily_change: quantile(ch, 0.5), p90_abs_daily_change: quantile(ch, 0.9),
    crossings: cross.length, median_cross_calendar_days: quantile(days, 0.5), p25: quantile(days, 0.25), p75: quantile(days, 0.75) }
}

const dates = D.META.hist_dates
const cohort = Object.entries(D.HIST).map(([, vals]) => dates.map((d, i) => ({ d, v: vals[i] }))).map(dropCarries)
// MU_HIST rows are [date, blended, fan read, momentum read]. Column 1 = 0.5*fan + 0.5*momentum on
// all 235 rows that carry momentum (checked); the first 25 rows have no momentum and are fan only.
const mu = [dropCarries(D.MU_HIST.map(r => ({ d: r[0], v: r[1] })))]
const out = {
  source: 'fan_daily + momentum_daily via deliverables/20260925/geiger-visuals/data.js',
  cohort_window: `${dates[0]} .. ${dates.at(-1)}`, cohort_names: cohort.length,
  cohort: measure(cohort),
  mu_window: `${D.MU_HIST[0][0]} .. ${D.MU_HIST.at(-1)[0]}`, mu_sessions: mu[0].length,
  mu_blended: measure(mu)
}
writeFileSync(join(HERE, 'stored-history-speed.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify(out, null, 1))
