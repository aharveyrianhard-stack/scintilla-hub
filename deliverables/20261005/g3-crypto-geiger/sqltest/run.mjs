// G3 SQL test (5 Oct 2026): runs the three staged files under staged/g3/ and their rollbacks against a throw-away
// PostgreSQL (PGlite, Postgres compiled to WebAssembly) holding stub tables shaped like the live ones and a fixture
// cut from the live rows read on 5 Oct 23:30Z (2 coins, 1 future, 1 rate). The saved live bodies are loaded first,
// so "before" is the real function. No network, no live database.
// Run:  PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node run.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
import { momentum, composite, r4 } from '../tools/geiger-rules.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const STAGED = join(here, '../../../../staged/g3')
const pgliteDir = process.env.PGLITE_DIR
if (!pgliteDir) { console.error('set PGLITE_DIR'); process.exit(2) }
const { PGlite } = await import(pathToFileURL(join(pgliteDir, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const sql = f => readFileSync(join(STAGED, f), 'utf8')
const F = JSON.parse(readFileSync(join(here, 'fixture.json'), 'utf8'))
const q = async (s, p) => (await db.query(s, p)).rows
const one = async (s, p) => (await q(s, p))[0]
const results = []
const step = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name) } catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '—', e.message) }
}
const fails = async (s, re) => { let err = null; try { await db.exec(s) } catch (e) { err = e }; assert.ok(err, 'expected an exception'); assert.match(err.message, re) }
const G = '00000000-0000-0000-0000-000000000000'
const comp = async t => one(`select composite, momentum, tf_contributors n, updated_ts from composite_staged where ticker=$1 and tf='D'`, [t])
const near = (a, b, tol = 0.00011) => assert.ok(Math.abs(a - b) <= tol, `${a} is not ${b}`)

await db.exec(`
set timezone to 'UTC';
create role anon; create role authenticated;
create schema cron;
create table cron.job (jobid bigint primary key, schedule text, command text, active boolean default true, jobname text unique);
create sequence cron.jobid_seq start 900;
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobid, jobname, schedule, command) values (nextval('cron.jobid_seq'), p_name, p_schedule, p_command) returning jobid $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ delete from cron.job where jobname = job_name returning true $$;
create table tickers (ticker text primary key, type text, active boolean default true);
create table provider_equities_stub (ticker text primary key);
create function provider_owned_equities() returns table(ticker text) language sql stable as $$ select ticker from provider_equities_stub $$;
create table operator_weights (dim text, key text, weight double precision, enabled boolean default true, owner_id uuid);
create table timeframe_registry (tf text primary key, seconds bigint);
create table ribbon_signals (ticker text, tf text, family text, read double precision, updated_ts bigint, primary key (ticker, tf, family));
create table ohlcv_history (ticker text, tf text, "timestamp" bigint, open double precision, high double precision, low double precision,
  close double precision, source text, inserted_at bigint, volume double precision, primary key (ticker, tf, "timestamp", source));
create table eod_adjusted (ticker text, d date, adj_o numeric, adj_h numeric, adj_l numeric, adj_c numeric, source text, fetched_at timestamptz);
create table fan_daily (ticker text, asof date, read double precision);
create table composite_staged (ticker text, tf text, trend double precision, momentum double precision, volatility double precision,
  conviction double precision, core double precision, composite double precision, updated_ts bigint, tf_contributors integer, primary key (ticker, tf));
insert into timeframe_registry values ('1',60),('3',180),('5',300),('10',600),('15',900),('30',1800),('60',3600),('120',7200),('180',10800),
  ('240',14400),('6h',21600),('12h',43200),('D',86400),('3D',259200),('W',604800),('2W',1209600),('1M',2592000);
`)
await db.exec(sql('saved/refresh_geiger__LIVE_20261005.sql'))
await db.exec(sql('saved/scin_resample_tf__LIVE_20261005.sql'))
await db.exec(sql('saved/ohlcv_daily_adj__LIVE_20261005.sql'))

// every stored time is moved forward by (now - snapshot time) so each row is exactly as old as it was when read
const now = Number((await one(`select extract(epoch from now())::bigint n`)).n), dt = now - F.now, dDays = Math.floor(dt / 86400)
for (const t of F.tickers) await db.query(`insert into tickers values ($1,$2,true)`, [t.ticker, t.type])
await db.exec(`insert into tickers values ('AAPL','stock',true); insert into provider_equities_stub values ('AAPL');
  insert into eod_adjusted values ('AAPL', current_date - 1, 200, 201, 199, 200.5, 'FMP', now());
  insert into ribbon_signals values ('AAPL','D','MOMENTUM',0.5, extract(epoch from now())::bigint);`)
for (const w of F.weights) await db.query(`insert into operator_weights values ('timeframe',$1,$2,true,$3)`, [w.key, w.w, G])
for (const w of F.fam) await db.query(`insert into operator_weights values ('family',$1,$2,true,$3)`, [w.key, w.w, G])
for (const r of F.ribbon) await db.query(`insert into ribbon_signals values ($1,$2,'MOMENTUM',$3,$4)`, [r.ticker, r.tf, r.read, r.upd + dt])
for (const f of F.fan) if (f.read != null) await db.query(`insert into fan_daily values ($1, current_date, $2)`, [f.ticker, f.read])
for (const s of F.staged) await db.query(`insert into composite_staged (ticker,tf,composite,trend,momentum,core,tf_contributors,updated_ts) values ($1,'D',$2,$3,$4,$2,$5,$6)`,
  [s.ticker, s.composite, s.trend, s.momentum, s.n, s.upd + dt])
const coins = F.tickers.filter(t => t.type === 'crypto').map(t => t.ticker)
for (const b of F.bars) { // the newest bar of each size (coins' D and 3D come with their history below)
  if (coins.includes(b.ticker) && (b.tf === 'D' || b.tf === '3D')) continue
  await db.query(`insert into ohlcv_history values ($1,$2,$3,1,1,1,1,'FIXTURE',$3,null)`, [b.ticker, b.tf, b.bar + dt])
}
for (const x of F.d) await db.query(`insert into ohlcv_history values ($1,'D',$2,$3,$4,$5,$6,$7,$2,null)`, [x.k, x.t + dt, x.o, x.h, x.l, x.c, x.s])
const FILL_11_AUG = 1786478400
for (const x of F.b3) await db.query(`insert into ohlcv_history values ($1,'3D',$2,$3,$4,$5,$6,$7,$8,null)`, [x.k, x.t + dDays * 86400, x.o, x.h, x.l, x.c, x.s, FILL_11_AUG])
for (const x of F.adj) await db.query(`insert into eod_adjusted values ($1, (to_timestamp($2::bigint) at time zone 'UTC')::date + $3::int, $4,$4,$4,$4,'FMP', now() - interval '52 days')`, [x.k, x.t, dDays, x.c])
await db.exec(`insert into eod_adjusted values ('ESUSD', current_date - 52, 1,1,1,1,'FMP', now() - interval '52 days')`)
const viewBefore = (await one(`select pg_get_viewdef('public.ohlcv_daily_adj'::regclass) v`)).v
const E = F.expected

await step('before: the saved live function gives the numbers the Hub showed at the snapshot (BTC ETH ES US2Y)', async () => {
  await db.exec(`select refresh_geiger()`)
  for (const t of Object.keys(E)) { const c = await comp(t); near(c.composite, E[t].live); assert.equal(c.n, E[t].live_n) }
})
await step('before: the live rule lets the 8 Aug 3-day bars vote for 3 hours a night and shuts the fresh 12-hour reading out', async () => {
  const r = await one(`select to_char(to_timestamp(max("timestamp")),'MM-DD') d from ohlcv_history where ticker='BTCUSD' and tf='3D'`)
  assert.equal(r.d, '08-' + String(8 + dDays).padStart(2, '0'))
  const v = await one(`select (updated_ts > extract(epoch from now())::bigint - 10800) old_vote from ribbon_signals where ticker='BTCUSD' and tf='12h' and family='MOMENTUM'`)
  assert.equal(v.old_vote, false)
})

await step('01 apply: 3-day bars reach this week for both coins, the August and DRV bars stay, the nightly job is 02:30', async () => {
  const drv = (await one(`select count(*)::int n, sum(close) s from ohlcv_history where tf='3D' and source='DRV'`))
  await db.exec(sql('01_crypto_3d_bars_refresh.sql'))
  for (const t of coins) {
    const r = await one(`select extract(epoch from now())::bigint - max("timestamp") age from ohlcv_history where ticker=$1 and tf='3D'`, [t])
    assert.ok(Number(r.age) < 2 * 259200, `${t} newest 3-day bar is ${r.age}s old`)
  }
  assert.deepEqual(await one(`select count(*)::int n, sum(close) s from ohlcv_history where tf='3D' and source='DRV'`), drv)
  assert.equal((await one(`select count(*)::int n from ohlcv_history where tf='3D' and ticker in ('ESUSD','US2Y','AAPL') and source like 'resampled%'`)).n, 0)
  const j = await one(`select schedule, command from cron.job where jobname='crypto-3d-bars-nightly'`)
  assert.equal(j.schedule, '30 2 * * *'); assert.equal(j.command, 'select public.scin_refresh_3d_from_daily()')
})
await step('01: a 3-day bar is the fold of its daily bars (first open, highest high, lowest low, last close)', async () => {
  const b = await one(`select "timestamp" t, open, high, low, close from ohlcv_history where ticker='BTCUSD' and tf='3D' and source='resampled:D' order by "timestamp" desc offset 1 limit 1`)
  const d = await q(`select open, high, low, close from ohlcv_history where ticker='BTCUSD' and tf='D' and (to_timestamp("timestamp"))::date >= (to_timestamp($1::bigint))::date and (to_timestamp("timestamp"))::date < (to_timestamp($1::bigint))::date + 3 order by "timestamp"`, [b.t])
  assert.equal(d.length, 3)
  assert.deepEqual([b.open, b.high, b.low, b.close], [d[0].open, Math.max(...d.map(x => x.high)), Math.min(...d.map(x => x.low)), d[2].close])
})
await step('01 apply twice: refuses (already scheduled)', async () => { await fails(sql('01_crypto_3d_bars_refresh.sql'), /already scheduled/) })
await step('01: running the nightly function again changes no bar (same folds)', async () => {
  const a = await one(`select count(*)::int n, sum(close) s from ohlcv_history where tf='3D'`)
  await db.exec(`select scin_refresh_3d_from_daily()`)
  assert.deepEqual(await one(`select count(*)::int n, sum(close) s from ohlcv_history where tf='3D'`), a)
})

await step('02 apply: the daily view serves the coins their own fresh daily bars; the stock and the future are untouched', async () => {
  const before = await q(`select ticker, max("timestamp") t, count(*)::int n from ohlcv_daily_adj where ticker in ('AAPL','ESUSD','US2Y') group by 1 order by 1`)
  const stale = await one(`select extract(epoch from now())::bigint - max("timestamp") age, max(source) s from ohlcv_daily_adj where ticker='BTCUSD'`)
  assert.ok(Number(stale.age) > 50 * 86400 && stale.s === 'FMP', 'fixture: the view should serve the 14 Aug copy first')
  await db.exec(sql('02_crypto_daily_bars_view.sql'))
  for (const t of coins) {
    const r = await one(`select extract(epoch from now())::bigint - max("timestamp") age, max(source) s, count(*)::int n, count(distinct "timestamp")::int u from ohlcv_daily_adj where ticker=$1`, [t])
    assert.ok(Number(r.age) < 86400 && r.s === 'COINBASE' && r.n === r.u, JSON.stringify(r))
  }
  assert.deepEqual(await q(`select ticker, max("timestamp") t, count(*)::int n from ohlcv_daily_adj where ticker in ('AAPL','ESUSD','US2Y') group by 1 order by 1`), before)
})
await step('02 apply twice: refuses', async () => { await fails(sql('02_crypto_daily_bars_view.sql'), /already passes coins through/) })

await step('03 before the 3-day ribbon job has re-read the new bars: refuses, naming the coins', async () => { await fails(sql('03_geiger_width_votes.sql'), /BTCUSD.*wait for the 02:34 UTC ribbon-3d run/) })
await step('03 apply (after the ribbon jobs re-read): every weighted size votes; BTC and ETH match the dry run; nothing is marked', async () => {
  for (const t of coins) await db.query(`update ribbon_signals set read = case tf when 'D' then $2::float8 else $3::float8 end, updated_ts = extract(epoch from now())::bigint where ticker=$1 and tf in ('D','3D')`, [t, E[t].after.d_read, E[t].after.t_read])
  await db.exec(sql('03_geiger_width_votes.sql'))
  await db.exec(`select refresh_geiger()`)
  for (const t of coins) {
    const c = await comp(t); near(c.composite, E[t].after.composite); assert.equal(c.n, E[t].after.n)
    const v = await q(`select tf_key from geiger_width_votes() where ticker=$1 and w>0 and votes order by 1`, [t])
    assert.deepEqual(v.map(x => x.tf_key), ['12h', '1d', '1w', '3d', '3h', '4h', '6h'])
    assert.equal((await one(`select tf_not_voting j from composite_staged where ticker=$1`, [t])).j, null)
  }
})
await step('03: the future and the rate keep the live 3-hour rule and the same number', async () => {
  for (const t of ['ESUSD', 'US2Y']) { const c = await comp(t); near(c.composite, E[t].live); assert.equal(c.n, E[t].live_n) }
  assert.equal((await one(`select count(*)::int n from geiger_width_votes() where ticker in ('ESUSD','US2Y') and (new_rule or why is not null)`)).n, 0)
  assert.equal((await one(`select count(*)::int n from geiger_width_votes() where ticker='AAPL'`)).n, 0)
})
await step('RULE 2: a 12-hour reading made 11 hours ago votes (the live rule dropped it after 3 hours); made 25 hours ago it does not', async () => {
  const a = await one(`select votes, why, extract(epoch from now())::bigint - read_ts age from geiger_width_votes() where ticker='BTCUSD' and tf='12h'`)
  assert.ok(Number(a.age) > 10800 && a.votes === true, JSON.stringify(a))
  await db.exec(`update ribbon_signals set updated_ts = extract(epoch from now())::bigint - 25*3600 where ticker='ETHUSD' and tf='12h'`)
  const b = await one(`select votes, why from geiger_width_votes() where ticker='ETHUSD' and tf='12h'`)
  assert.deepEqual(b, { votes: false, why: 'reading too old' })
  await db.exec(`update ribbon_signals set updated_ts = extract(epoch from now())::bigint - 11*3600 where ticker='ETHUSD' and tf='12h'`)
})
await step('BOTH RULES: the 1-minute size is not dropped between two runs of its jobs (15-minute floor), and is after 15 minutes', async () => {
  await db.exec(`update ribbon_signals set updated_ts = extract(epoch from now())::bigint - 170 where ticker='BTCUSD' and tf='1';
    update ohlcv_history set "timestamp" = extract(epoch from now())::bigint - 200 where ticker='BTCUSD' and tf='1'`)
  assert.equal((await one(`select votes from geiger_width_votes() where ticker='BTCUSD' and tf='1'`)).votes, true)
  await db.exec(`update ohlcv_history set "timestamp" = extract(epoch from now())::bigint - 1000 where ticker='BTCUSD' and tf='1'`)
  assert.deepEqual(await one(`select votes, why from geiger_width_votes() where ticker='BTCUSD' and tf='1'`), { votes: false, why: 'no fresh bar' })
  await db.exec(`update ohlcv_history set "timestamp" = extract(epoch from now())::bigint - 100 where ticker='BTCUSD' and tf='1'`)
})
await step('RULE 1: with the 3-day bars back at 8 Aug the 3-day size does not vote, is named with its bar date, and the rest is renormalised', async () => {
  await db.exec(`create table keep3d as select * from ohlcv_history where ticker='BTCUSD' and tf='3D' and inserted_at > ${FILL_11_AUG};
    delete from ohlcv_history where ticker='BTCUSD' and tf='3D' and inserted_at > ${FILL_11_AUG}`)
  await db.exec(`select refresh_geiger()`)
  const rows = (await q(`select w, read, votes, tf_key from geiger_width_votes() where ticker='BTCUSD'`)).map(r => ({ w: r.w, read: r.read, votes: r.votes, tf: r.tf_key }))
  assert.equal(rows.find(r => r.tf === '3d').votes, false)
  const m = momentum(rows), trend = F.fan.find(f => f.ticker === 'BTCUSD').read
  const c = await comp('BTCUSD'); near(c.composite, r4(composite({ mom: m.mom, trend }))); assert.equal(c.n, E.BTCUSD.after.n - 1)
  const manual = rows.filter(r => r.w > 0 && r.tf !== '3d'); near(c.momentum, manual.reduce((p, r) => p + r.read * r.w, 0) / manual.reduce((p, r) => p + r.w, 0))
  const j = (await one(`select tf_not_voting j from composite_staged where ticker='BTCUSD'`)).j
  assert.equal(j.length, 1); assert.equal(j[0].tf, '3d'); assert.equal(j[0].why, 'no fresh bar'); near(j[0].weight, 2.576738, 1e-6)
  assert.match(j[0].newest_bar, /^2026-08-/)
  await db.exec(`insert into ohlcv_history select * from keep3d; select refresh_geiger()`)
  assert.equal((await one(`select tf_not_voting j from composite_staged where ticker='BTCUSD'`)).j, null)
})
await step('RULE 1: a size with no bar at all is named "no bar stored" and does not vote', async () => {
  await db.exec(`create table keepw as select * from ohlcv_history where ticker='ETHUSD' and tf='W'; delete from ohlcv_history where ticker='ETHUSD' and tf='W'`)
  assert.deepEqual(await one(`select votes, why from geiger_width_votes() where ticker='ETHUSD' and tf='W'`), { votes: false, why: 'no bar stored' })
  await db.exec(`insert into ohlcv_history select * from keepw`)
})
await step('CARRIED NAME: a coin with no size able to vote keeps its row and its old time (not re-stamped, not deleted after 4 h); the mark names why', async () => {
  await db.exec(`create table keepr as select * from ribbon_signals where ticker='ETHUSD';
    update ribbon_signals set updated_ts = extract(epoch from now())::bigint - 90*86400 where ticker='ETHUSD';
    update composite_staged set updated_ts = extract(epoch from now())::bigint - 5*3600 where ticker in ('ETHUSD','ESUSD')`)
  const before = await comp('ETHUSD')
  await db.exec(`select refresh_geiger()`)
  const after = await comp('ETHUSD')
  assert.deepEqual(after, before)
  const j = (await one(`select tf_not_voting j from composite_staged where ticker='ETHUSD'`)).j
  assert.equal(j.length, 7); assert.ok(j.every(x => x.why === 'reading too old'))
  assert.ok(Number((await comp('ESUSD')).updated_ts) > now - 120, 'the future, on the live rule and with fresh readings, is simply republished')
  await db.exec(`delete from ribbon_signals where ticker='ETHUSD'; insert into ribbon_signals select * from keepr; select refresh_geiger()`)
  near((await comp('ETHUSD')).composite, E.ETHUSD.after.composite)
})
await step('LIVE RULE KEPT for the others: a future whose readings stop is still removed after 4 hours, exactly as today', async () => {
  await db.exec(`create table keepe as select * from ribbon_signals where ticker='ESUSD';
    update ribbon_signals set updated_ts = extract(epoch from now())::bigint - 6*3600 where ticker='ESUSD';
    update composite_staged set updated_ts = extract(epoch from now())::bigint - 5*3600 where ticker='ESUSD'; select refresh_geiger()`)
  assert.equal(await comp('ESUSD'), undefined)
  await db.exec(`delete from ribbon_signals where ticker='ESUSD'; insert into ribbon_signals select * from keepe; select refresh_geiger()`)
  near((await comp('ESUSD')).composite, E.ESUSD.live)
})
await step('03: the new functions are closed to the public key', async () => {
  const r = await one(`select has_function_privilege('anon','public.geiger_width_votes(bigint)','execute') a, has_function_privilege('anon','public.scin_refresh_3d_from_daily()','execute') b,
    has_function_privilege('authenticated','public.geiger_width_votes(bigint)','execute') c, has_function_privilege('authenticated','public.scin_refresh_3d_from_daily()','execute') d`)
  assert.deepEqual(r, { a: false, b: false, c: false, d: false })
})
await step('03 apply twice: refuses', async () => { await fails(sql('03_geiger_width_votes.sql'), /not the body read on 5 Oct/) })

await step('03 rollback: refresh_geiger is the 5 Oct body to the byte; helpers and column gone; the Hub numbers are the live rule again', async () => {
  await db.exec(sql('03_geiger_width_votes_ROLLBACK.sql'))
  assert.equal((await one(`select md5(prosrc) m from pg_proc where oid='public.refresh_geiger()'::regprocedure`)).m, '187ad5b7caab41620ba3fe0fea3ea97f')
  assert.equal((await one(`select to_regprocedure('public.geiger_width_votes(bigint)') is null a, to_regprocedure('public.geiger_fresh_bar_types()') is null b`)).a, true)
  assert.equal((await one(`select count(*)::int n from information_schema.columns where table_name='composite_staged' and column_name='tf_not_voting'`)).n, 0)
  await db.exec(`select refresh_geiger()`); assert.ok((await comp('BTCUSD')).n < E.BTCUSD.after.n)
})
await step('03 rollback twice: refuses', async () => { await fails(sql('03_geiger_width_votes_ROLLBACK.sql'), /nothing to undo/) })
await step('02 rollback: the view definition is identical to the one saved', async () => {
  await db.exec(sql('02_crypto_daily_bars_view_ROLLBACK.sql'))
  assert.equal((await one(`select pg_get_viewdef('public.ohlcv_daily_adj'::regclass) v`)).v, viewBefore)
})
await step('02 rollback twice: refuses', async () => { await fails(sql('02_crypto_daily_bars_view_ROLLBACK.sql'), /nothing to undo/) })
await step('01 rollback: job and function gone, the bars stay', async () => {
  const a = await one(`select count(*)::int n from ohlcv_history where tf='3D'`)
  await db.exec(sql('01_crypto_3d_bars_refresh_ROLLBACK.sql'))
  assert.equal((await one(`select count(*)::int n from cron.job`)).n, 0)
  assert.equal((await one(`select to_regprocedure('public.scin_refresh_3d_from_daily()') is null a`)).a, true)
  assert.deepEqual(await one(`select count(*)::int n from ohlcv_history where tf='3D'`), a)
})
await step('01 rollback twice: refuses', async () => { await fails(sql('01_crypto_3d_bars_refresh_ROLLBACK.sql'), /nothing to undo/) })

const bad = results.filter(r => r[0] === 'FAIL')
console.log(`\n${results.length - bad.length}/${results.length} passed`)
process.exit(bad.length ? 1 : 0)
