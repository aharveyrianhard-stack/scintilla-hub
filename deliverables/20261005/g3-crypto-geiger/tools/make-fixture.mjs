// Cuts a small test fixture out of the read-only snapshot: 2 coins, 1 future, 1 rate, with the rows the Geiger
// job reads (readings, weights, newest bars, 130 daily bars per coin) and the dry run's expected numbers.
// Run: node make-fixture.mjs <snap.json> <dadj.json> <g3-dryrun.json> <fixture.json>
import { readFileSync, writeFileSync } from 'node:fs'
const [snapF, dadjF, dryF, outF] = process.argv.slice(2)
const S = JSON.parse(readFileSync(snapF, 'utf8')), A = JSON.parse(readFileSync(dadjF, 'utf8')), R = JSON.parse(readFileSync(dryF, 'utf8'))
const KEEP = ['BTCUSD', 'ETHUSD', 'ESUSD', 'US2Y'], COINS = ['BTCUSD', 'ETHUSD']
const k = x => KEEP.includes(x.ticker ?? x.k)
const exp = {}
for (const c of [...R.coins, ...R.others].filter(k)) exp[c.ticker] = { live: c.live_composite, live_n: c.live_n, rule_only: c.rule_only,
  after: c.after && { composite: c.after.composite, n: c.after.n, d_read: c.after.daily.new_read, t_read: c.after.three_day.new_read } }
writeFileSync(outF, JSON.stringify({ now: S.now, tickers: S.tickers.filter(k), weights: S.weights, fam: S.fam,
  ribbon: S.ribbon.filter(k).map(r => ({ ticker: r.ticker, tf: r.tf, read: r.read, upd: r.upd })),
  bars: S.bars.filter(k).filter(b => b.bar != null), fan: S.fan.filter(k), staged: S.staged.filter(k),
  d: S.d.filter(x => COINS.includes(x.k) && x.t >= S.now - 86400 * 130),
  b3: S.b3.filter(x => COINS.includes(x.k) && x.t >= S.now - 86400 * 200),
  adj: A.filter(x => COINS.includes(x.k)).filter((x, i, a) => !a[i + 1] || a[i + 1].k !== x.k || a.slice(i + 1).filter(y => y.k === x.k).length < 5),
  expected: exp }))
console.log('fixture written', Object.keys(exp).join(','))
