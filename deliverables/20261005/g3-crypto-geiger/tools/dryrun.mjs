// G3 dry run (read-only): one snapshot of the live rows (taken with a single SELECT), then the composite of every
// non-equity under the live rule and under the two new rules, at the same minute. Nothing is written anywhere but
// the result file. Run: node dryrun.mjs <snap.json> <dadj.json> <out.json>
import { readFileSync, writeFileSync } from 'node:fs'
import { TF_KEY, TF_SECONDS, votesOld, votesNew, momentum, composite, r4, momentumRead, threeDayFromDaily } from './geiger-rules.mjs'
const [snapF, dadjF, outF] = process.argv.slice(2)
const S = JSON.parse(readFileSync(snapF, 'utf8')), DADJ = JSON.parse(readFileSync(dadjF, 'utf8'))
const now = S.now
const W = Object.fromEntries(S.weights.map(x => [x.key, +x.w]))
const fam = Object.fromEntries(S.fam.map(x => [x.key, +x.w])), wt = fam.TREND ?? 0.5, wm = fam.MOMENTUM ?? 0.5
const type = Object.fromEntries(S.tickers.map(x => [x.ticker, x.type]))
const fan = Object.fromEntries(S.fan.map(x => [x.ticker, x.read]))
const lq = Object.fromEntries((S.lq || []).map(x => [x.ticker, +x.price]))
const staged = Object.fromEntries(S.staged.map(x => [x.ticker, x]))
const bar = {}; for (const b of S.bars) bar[b.ticker + '|' + b.tf] = b.bar
const by = (a, k) => a.reduce((m, x) => ((m[x[k]] ||= []).push(x), m), {})
const dHist = by(S.d, 'k'), b3 = by(S.b3, 'k'), dAdj = by(DADJ, 'k')
const ORDER = Object.keys(TF_KEY)
const iso = t => t == null ? null : new Date(t * 1000).toISOString().slice(0, 16) + 'Z'

const out = { snapshot_utc: iso(now), weights: W, family: { wt, wm }, port_check: [], coins: [], others: [], through_day: [] }
for (const tk of Object.keys(type).sort()) {
  const coin = type[tk] === 'crypto'
  const rows = S.ribbon.filter(r => r.ticker === tk).sort((a, b) => ORDER.indexOf(a.tf) - ORDER.indexOf(b.tf)).map(r => {
    // the daily width is read by the ribbon job from the view ohlcv_daily_adj — so that is the bar that counts
    const barTs = (r.tf === 'D' && dAdj[tk]) ? dAdj[tk][dAdj[tk].length - 1].t : bar[tk + '|' + r.tf]
    const w = W[TF_KEY[r.tf]] ?? 0
    const n = votesNew({ now, tf: r.tf, readTs: r.upd, barTs })
    return { tf: TF_KEY[r.tf], rawtf: r.tf, w, read: r.read, readTs: r.upd, barTs, old: votesOld({ now, readTs: r.upd }), neu: n.votes, why: n.why }
  })
  const before = momentum(rows.map(r => ({ ...r, votes: r.old })))
  const cBefore = r4(composite({ mom: before.mom, trend: fan[tk], wt, wm }))
  const rule = momentum(rows.map(r => ({ ...r, votes: r.neu })))
  const cRule = r4(composite({ mom: rule.mom, trend: fan[tk], wt, wm }))
  const rec = { ticker: tk, type: type[tk], trend: fan[tk], live_composite: staged[tk]?.composite, live_n: staged[tk]?.n,
    before: { composite: cBefore, momentum: r4(before.mom), n: before.n },
    rule_only: { composite: cRule, momentum: r4(rule.mom), n: rule.n }, widths: rows.map(r => ({ ...r, bar: iso(r.barTs), reading_made: iso(r.readTs) })) }
  if (coin) {
    // port check: recompute tonight's stored daily reading from the bars the job read (view) + the live price
    const chk = momentumRead(dAdj[tk], lq[tk]); const st = S.ribbon.find(r => r.ticker === tk && r.tf === 'D')
    out.port_check.push({ ticker: tk, stored_read: st.read, stored_rsi: st.center, recomputed_read: chk?.read, recomputed_rsi: chk?.rsi })
    // after the bar fixes: daily from the live Coinbase daily bars; 3-day folded from those same daily bars
    const dFresh = dHist[tk].map(x => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c }))
    const dNew = momentumRead(dFresh, lq[tk])
    const keep = (b3[tk] || []).filter(x => !String(x.s).startsWith('resampled:')).map(x => ({ t: x.t, o: x.o, h: x.h, l: x.l, c: x.c }))
    const keepTs = new Set(keep.map(x => x.t))
    const three = [...keep, ...threeDayFromDaily(dFresh).filter(x => !keepTs.has(x.t))].sort((a, b) => a.t - b.t)
    const tNew = momentumRead(three, lq[tk])
    const fixed = rows.map(r => r.rawtf === 'D' ? { ...r, read: dNew.read, barTs: dFresh.at(-1).t, readTs: now }
      : r.rawtf === '3D' ? { ...r, read: tNew.read, barTs: three.at(-1).t, readTs: now } : r)
      .map(r => ({ ...r, votes: votesNew({ now, tf: r.rawtf, readTs: r.readTs, barTs: r.barTs }).votes }))
    const aft = momentum(fixed)
    rec.after = { composite: r4(composite({ mom: aft.mom, trend: fan[tk], wt, wm })), momentum: r4(aft.mom), n: aft.n,
      daily: { old_read: rows.find(r => r.rawtf === 'D').read, new_read: dNew.read, new_rsi: dNew.rsi, newest_bar: iso(dFresh.at(-1).t) },
      three_day: { old_read: rows.find(r => r.rawtf === '3D').read, new_read: tNew.read, new_rsi: tNew.rsi, newest_bar: iso(three.at(-1).t), bars: three.length },
      votes: fixed.filter(r => r.w > 0).map(r => ({ tf: r.tf, votes: r.votes })) }
    out.coins.push(rec)
  } else out.others.push(rec)
}

// Through a day under the LIVE rule: which weighted widths are inside the 3-hour window at six times, from the
// ribbon jobs' own schedules (UTC), and what tonight's readings would add up to with only those widths counted.
const lastRun = { '180': h => Math.floor((h * 60 - 12) / 180) * 180 + 12, '240': h => Math.floor((h * 60 - 6) / 240) * 240 + 6,
  '6h': h => Math.floor((h * 60 - 19) / 360) * 360 + 19, '12h': h => Math.floor((h * 60 - 24) / 720) * 720 + 24,
  'D': h => Math.floor((h * 60 - 1) / 15) * 15 + 1, '3D': h => (h * 60 >= 154 ? 154 : 154 - 1440), 'W': h => (h * 60 >= 189 ? 189 : 189 - 1440) }
for (const hhmm of ['01:00', '04:00', '08:00', '11:00', '16:00', '21:30']) {
  const [H, M] = hhmm.split(':').map(Number), h = H + M / 60
  const inWin = Object.fromEntries(Object.entries(lastRun).map(([tf, f]) => [tf, h * 60 - f(h) < 180]))
  const row = { utc: hhmm, voting: Object.entries(inWin).filter(([, v]) => v).map(([tf]) => TF_KEY[tf]),
    weight_in: r4(Object.entries(inWin).filter(([, v]) => v).reduce((p, [tf]) => p + (W[TF_KEY[tf]] || 0), 0)), coins: {} }
  for (const c of out.coins) {
    const m = momentum(c.widths.filter(r => r.w > 0).map(r => ({ ...r, votes: !!inWin[r.rawtf] })))
    row.coins[c.ticker] = r4(composite({ mom: m.mom, trend: c.trend, wt, wm }))
  }
  out.through_day.push(row)
}
out.weight_total = r4(Object.values(W).reduce((p, x) => p + x, 0))
writeFileSync(outF, JSON.stringify(out, null, 1))
console.log('snapshot', out.snapshot_utc, 'total weight', out.weight_total)
console.log('port check (stored vs recomputed daily reading):'); for (const p of out.port_check) console.log(' ', p.ticker, p.stored_read, p.recomputed_read, '| rsi', p.stored_rsi, p.recomputed_rsi)
console.log('coin | live | before(recomputed) n | rule only n | after n | D old->new | 3D old->new (newest bar)')
for (const c of out.coins) console.log(c.ticker, c.live_composite, c.before.composite, c.before.n, '|', c.rule_only.composite, c.rule_only.n, '|', c.after.composite, c.after.n, '|', c.after.daily.old_read, '->', c.after.daily.new_read, '|', c.after.three_day.old_read, '->', c.after.three_day.new_read, c.after.three_day.newest_bar)
console.log('others: ticker live before | widths voting now (weighted)'); for (const c of out.others) console.log(c.ticker, c.live_composite, c.before.composite, c.widths.filter(r => r.w > 0 && r.old).map(r => r.tf).join(','))
for (const r of out.through_day) console.log(r.utc, r.voting.join(','), r.weight_in, JSON.stringify(r.coins))
