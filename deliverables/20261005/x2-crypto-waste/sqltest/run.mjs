// X2 SQL test (5 Oct 2026): runs every staged file under staged/x2/ and its rollback against a throw-away
// PostgreSQL (PGlite, Postgres compiled to WebAssembly) with a stub `cron` schema whose three crypto jobs carry
// commands shaped like the live ones (read 5 Oct with the bearer masked; the bearer here is a made-up word).
// No network, no live database. Run:  PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node run.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const STAGED = join(here, '../../../../staged/x2')
const pgliteDir = process.env.PGLITE_DIR
if (!pgliteDir) { console.error('set PGLITE_DIR'); process.exit(2) }
const { PGlite } = await import(pathToFileURL(join(pgliteDir, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const sql = f => readFileSync(join(STAGED, f), 'utf8')
const cmd = async id => (await db.query('select command from cron.job where jobid = $1', [id])).rows[0]?.command
const results = []
const step = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name) } catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '—', e.message) }
}
const fails = async (q, re) => { let err = null; try { await db.exec(q) } catch (e) { err = e }; assert.ok(err, 'expected an exception'); assert.match(err.message, re) }

const FN = 'https://example.invalid/functions/v1'
const H = `'{"Authorization":"Bearer FAKEWORD","apikey":"FAKEWORD"}'::jsonb`
const C53 = `select scin_record('crypto-candles-1m', '${FN}/crypto-candles?g=60,300,900,3600', net.http_get('${FN}/crypto-candles?g=60,300,900,3600', '{}'::jsonb, ${H}, 60000))`
const C61 = `select scin_record('crypto-coinbase-1m', '${FN}/crypto-coinbase', net.http_post(url:='${FN}/crypto-coinbase', headers:='{"Content-Type":"application/json"}'::jsonb))`

await db.exec(`
create schema cron;
create table cron.job (jobid bigint primary key, schedule text, command text, active boolean default true, jobname text unique);
create sequence cron.jobid_seq start 900;
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobid, jobname, schedule, command) values (nextval('cron.jobid_seq'), p_name, p_schedule, p_command) returning jobid $$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null, database text default null,
  username text default null, active boolean default null) returns void language sql as $$
  update cron.job set schedule = coalesce(alter_job.schedule, job.schedule), command = coalesce(alter_job.command, job.command),
    active = coalesce(alter_job.active, job.active) where jobid = job_id $$;
create function cron.unschedule(job_name text) returns boolean language sql as $$ delete from cron.job where jobname = job_name returning true $$;
`)
await db.query(`insert into cron.job (jobid, schedule, command, jobname) values (53, '* * * * *', $1, 'crypto-candles-1m'), (61, '* * * * *', $2, 'crypto-coinbase-1m')`, [C53, C61])

await step('01 apply: cron 61 gets a 15 s timeout, nothing else changes', async () => {
  await db.exec(sql('01_cron61_quote_timeout_15s.sql'))
  const c = await cmd(61)
  assert.equal(c, C61.replace(`::jsonb))`, `::jsonb, timeout_milliseconds:=15000))`))
  assert.equal(await cmd(53), C53)
})
await step('01 apply twice: refuses (a timeout is already set)', async () => { await fails(sql('01_cron61_quote_timeout_15s.sql'), /already set/) })
await step('01 rollback: cron 61 is byte-identical to before', async () => {
  await db.exec(sql('01_cron61_quote_timeout_15s_ROLLBACK.sql')); assert.equal(await cmd(61), C61)
})
await step('01 rollback twice: refuses (nothing to undo)', async () => { await fails(sql('01_cron61_quote_timeout_15s_ROLLBACK.sql'), /nothing to undo/) })

await step('02 apply: cron 53 asks for g=60 only; crypto-candles-5m asks for g=300,900,3600 at 4-59/5 with the same headers', async () => {
  await db.exec(sql('02_candles_split_slow_widths__WAITS_FOR_ALAN.sql'))
  assert.equal(await cmd(53), C53.replaceAll('g=60,300,900,3600', 'g=60'))
  const n = (await db.query(`select jobid, schedule, command from cron.job where jobname = 'crypto-candles-5m'`)).rows[0]
  assert.equal(n.schedule, '4-59/5 * * * *')
  assert.equal(n.command, C53.replaceAll('g=60,300,900,3600', 'g=300,900,3600').replace('crypto-candles-1m', 'crypto-candles-5m'))
  assert.ok(n.command.includes('Bearer FAKEWORD'))
  assert.equal(await cmd(61), C61)
})
await step('02 apply twice: refuses (command no longer the 5 Oct one)', async () => { await fails(sql('02_candles_split_slow_widths__WAITS_FOR_ALAN.sql'), /changed since 5 Oct/) })
await step('02 rollback: the new job is gone and cron 53 is byte-identical to before', async () => {
  await db.exec(sql('02_candles_split_slow_widths_ROLLBACK.sql'))
  assert.equal(await cmd(53), C53)
  assert.equal((await db.query(`select count(*)::int n from cron.job`)).rows[0].n, 2)
})
await step('02 rollback twice: harmless, still the original', async () => {
  await db.exec(sql('02_candles_split_slow_widths_ROLLBACK.sql')); assert.equal(await cmd(53), C53)
})
await step('90 proposal: running the file changes nothing (every statement is commented out)', async () => {
  await db.exec(`create table public.crypto_depth (ticker text)`)
  await db.exec(sql('90_DELETE_PROPOSAL__WAITS_FOR_ALAN.sql'))
  assert.equal((await db.query(`select to_regclass('public.crypto_depth')::text t`)).rows[0].t, 'crypto_depth')
})
await step('01 then 02 together, then both rollbacks in reverse: back to the start', async () => {
  await db.exec(sql('01_cron61_quote_timeout_15s.sql')); await db.exec(sql('02_candles_split_slow_widths__WAITS_FOR_ALAN.sql'))
  await db.exec(sql('02_candles_split_slow_widths_ROLLBACK.sql')); await db.exec(sql('01_cron61_quote_timeout_15s_ROLLBACK.sql'))
  assert.equal(await cmd(53), C53); assert.equal(await cmd(61), C61)
})
const bad = results.filter(r => r[0] !== 'PASS')
console.log(`${results.length - bad.length}/${results.length} passed`)
process.exit(bad.length ? 1 : 0)
