// Q2b SQL test (3 Oct 2026): applies the live heartbeat migration and every STAGED file + rollback to a throw-away
// PostgreSQL (PGlite, Postgres compiled to WebAssembly) with stub `cron`, `net` and Scintilla tables shaped like the live
// ones (columns read from information_schema on 3 Oct, incl. feed_alarm.feed -> feed_contract(feed)). No network, no
// live database. Run:  PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node run.mjs
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'

const here = dirname(fileURLToPath(import.meta.url))
const MIG = join(here, '../../../../supabase/migrations')
const pgliteDir = process.env.PGLITE_DIR
if (!pgliteDir) { console.error('set PGLITE_DIR'); process.exit(2) }
const { PGlite } = await import(pathToFileURL(join(pgliteDir, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const db = new PGlite()
const sql = f => readFileSync(join(MIG, f), 'utf8')
const one = async (q, p) => (await db.query(q, p)).rows[0]
const all = async (q, p) => (await db.query(q, p)).rows
const results = []
const step = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); console.log('PASS', name) } catch (e) { results.push(['FAIL', name, e.message]); console.log('FAIL', name, '—', e.message) }
}

// ---------------------------------------------------------------------------------------------------- the stub estate
await db.exec(`
create role massive_writer; create role service_role; create role anon; create role authenticated;
create schema cron; create schema net; create schema massive_control; create schema scin_archive;
create table cron.job (jobid bigserial primary key, schedule text, command text, nodename text default 'localhost',
  nodeport int default 5432, database text default 'postgres', username text default 'postgres', active boolean default true, jobname text unique);
create table cron.job_run_details (jobid bigint, runid bigserial primary key, job_pid int, database text, username text,
  command text, status text, return_message text, start_time timestamptz, end_time timestamptz);
create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
  insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
  on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
create function cron.alter_job(job_id bigint, schedule text default null, command text default null, database text default null,
  username text default null, active boolean default null) returns void language sql as $$
  update cron.job set schedule = coalesce(alter_job.schedule, job.schedule), command = coalesce(alter_job.command, job.command),
    active = coalesce(alter_job.active, job.active) where jobid = job_id $$;
create function cron.unschedule(job_id bigint) returns boolean language sql as $$ delete from cron.job where jobid = job_id returning true $$;
create table net._http_response (id bigint, status_code int, content_type text, headers jsonb, content text, timed_out bool, error_msg text, created timestamptz default now());
create table net.calls (id bigserial primary key, method text, url text, body jsonb, at timestamptz default now());
create function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.calls (method, url, body) values ('POST', url, body) returning id $$;
create function net.http_get(url text, params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds int default 5000)
  returns bigint language sql as $$ insert into net.calls (method, url) values ('GET', url) returning id $$;
create table massive_control.service_heartbeat (service text, machine text, at_utc timestamptz);
create table public.feed_contract (feed text primary key, label text not null, kind text not null, source_table text, date_column text,
  max_age_hours int not null, repair_fn text, repair_args text default '', auto_repair boolean not null default true, enabled boolean not null default true, note text);
create table public.feed_alarm (feed text primary key references public.feed_contract(feed) on delete cascade, status text not null,
  age_hours numeric, first_seen timestamptz not null default now(), last_checked timestamptz not null default now(),
  repairs_tried int not null default 0, last_repair timestamptz, last_error text, needs_human boolean not null default false);
create table public.cron_dispatch (id bigserial primary key, jobname text, url text, request_id bigint, dispatched_at timestamptz default now(),
  completed_at timestamptz, status_code int, timed_out boolean, error_msg text, outcome text default 'pending', forwarded_at timestamptz);
create function public.scin_record(p_jobname text, p_url text, p_request_id bigint) returns bigint language plpgsql security definer as $$
begin insert into public.cron_dispatch (jobname, url, request_id) values (p_jobname, p_url, p_request_id); return p_request_id; end $$;
create table public.ibkr_gateway_watch_config (id int primary key, dry_run boolean, machine text, stale_min int, repeat_min int,
  ntfy_topic text, updated_at timestamptz, coverage_min_pct numeric, coverage_window_min int);
insert into public.ibkr_gateway_watch_config (id, dry_run, ntfy_topic) values (1, false, 'test-topic');
insert into public.feed_contract (feed, label, kind, max_age_hours) values ('ibkr_putcall_minute', 'put/call minute', 'derived', 18);
update public.feed_contract set note = 'Scintilla own intraday put/call.' where feed = 'ibkr_putcall_minute';
create table public.youtube_transcripts (video_id text primary key, text text, status text);
`)
// the jobs as they stand on 3 Oct (the ids the staged files name); bearers are fake
const BEARER = 'eyJFAKEFAKEFAKEFAKEFAKEFAKE.eyJyb2xlIjoiYW5vbiJ9.sig'
const http = (fn, extra = '') => `select net.http_post(url := 'https://x.supabase.co/functions/v1/${fn}', headers := '{"Authorization":"Bearer ${BEARER}"}'::jsonb || '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000)${extra}`
const jobs = [
  [7, 'ribbon-d-3m', '*/15 * * * *', `select scin_record('ribbon-d-3m', 'https://x.supabase.co/functions/v1/ribbon-engine', net.http_post(url:='https://x.supabase.co/functions/v1/ribbon-engine'))`],
  [8, 'health-monitor-5m', '*/5 * * * *', `select scin_record('health-monitor-5m', 'https://x.supabase.co/functions/v1/health-monitor', net.http_post(url:='https://x.supabase.co/functions/v1/health-monitor'))`],
  [18, 'bf-profile', '25 6 * * *', `SELECT net.http_post(url:='https://x.supabase.co/functions/v1/fmp-backfill?job=profile',headers:='{"Content-Type":"application/json"}'::jsonb,timeout_milliseconds:=180000)`],
  [28, 'stats-engine-30m', '*/30 * * * *', `select scin_record('stats-engine-30m', 'https://x.supabase.co/functions/v1/stats-engine', net.http_post(url:='https://x.supabase.co/functions/v1/stats-engine'))`],
  [60, 'eod-weekly-rebuild', '0 22 * * 1-5', 'select 1'],
  [62, 'audit-engine-15m', '*/15 * * * *', `select scin_record('audit-engine-15m', 'https://x.supabase.co/functions/v1/audit-engine', net.http_get('https://x.supabase.co/functions/v1/audit-engine', '{}'::jsonb, '{}'::jsonb, 120000))`],
  [220, 'mirror-tables-r2-1', '10 2 * * *', `select net.http_get('https://x.supabase.co/functions/v1/table-to-r2?chunk=2000&pause=250','{}'::jsonb,'{}'::jsonb,240000)`],
  [236, 'vacuum-ohlcv-hourly', '40 * * * *', 'select 1'],
  [256, 'mirror-gap-repair-daily', '30 5 * * *', `select net.http_get('https://x.supabase.co/functions/v1/table-to-r2?table=ribbon_signals&pause=250','{}'::jsonb,'{}'::jsonb,240000); select pg_sleep(20); select net.http_get('https://x.supabase.co/functions/v1/table-to-r2?table=ohlcv_history&pause=250','{}'::jsonb,'{}'::jsonb,240000);`],
  [261, 'sentiment-news-10m', '*/10 * * * *', http('sentiment-news?mode=live&limit=600')],
  [278, 'prediction-markets', '*/15 * * * *', '\n' + http('prediction-markets') + ` where (extract(isodow from now() at time zone 'America/New_York') between 1 and 5 and extract(hour from now() at time zone 'America/New_York') between 8 and 17) or extract(minute from now()) < 5\n`],
  [279, 'sigma-daily', '20 23 * * 1-5', '\n ' + http('sigma-daily') + ';\n']
]
for (const [id, name, sch, cmd] of jobs) await db.query('insert into cron.job (jobid, jobname, schedule, command) values ($1,$2,$3,$4)', [id, name, sch, cmd])
await db.exec(`select setval('cron.job_jobid_seq', 300)`)
// history: 256 failed 3 nights; stats-engine timed out 3 times in a row; eod ran fine
await db.exec(`
insert into cron.job_run_details (jobid, status, return_message, start_time, end_time) values
 (256,'failed','ERROR:  canceling statement due to statement timeout', now()-interval '50 hours', now()-interval '50 hours'+interval '140 s'),
 (256,'failed','ERROR:  canceling statement due to statement timeout', now()-interval '26 hours', now()-interval '26 hours'+interval '140 s'),
 (256,'failed','ERROR:  canceling statement due to statement timeout', now()-interval '2 hours', now()-interval '2 hours'+interval '140 s'),
 (60,'succeeded','1 row', now()-interval '20 hours', now()-interval '20 hours');
insert into public.cron_dispatch (jobname, url, request_id, dispatched_at, outcome, timed_out, error_msg) values
 ('stats-engine-30m','u',1, now()-interval '90 minutes','timeout',true,'Timeout of 5000 ms reached'),
 ('stats-engine-30m','u',2, now()-interval '60 minutes','timeout',true,'Timeout of 5000 ms reached'),
 ('stats-engine-30m','u',3, now()-interval '30 minutes','timeout',true,'Timeout of 5000 ms reached');
insert into massive_control.service_heartbeat values ('stocks-stream','8e7eedf7719698', now()-interval '20 seconds');
`)

// ---------------------------------------------------------------------------------------------------- the tests
await step('live migration 20261003_job_heartbeat.sql applies and schedules its checker', async () => {
  await db.exec(sql('20261003_job_heartbeat.sql'))
  assert.equal((await one(`select count(*)::int n from cron.job where jobname = 'job-heartbeat-check-5m'`)).n, 1)
  const st = await one(`select publish_alarms from job_heartbeat_state`)
  assert.equal(st.publish_alarms, false)
  assert.equal((await one(`select status from job_heartbeat where job = 'mirror-gap-repair-daily'`)).status, 'FAILING')
  assert.equal((await one(`select status from job_heartbeat where job = 'stats-engine-30m'`)).status, 'FAILING')
})

await step('BUG CONFIRMED in the live checker: with alarms on, a red job makes the whole tick fail (feed_alarm -> feed_contract key)', async () => {
  await db.exec(`update job_heartbeat_state set publish_alarms = true`)
  let threw = null
  try { await db.query(`select public.job_heartbeat_check()`) } catch (e) { threw = e.message }
  await db.exec(`update job_heartbeat_state set publish_alarms = false`)
  assert.match(String(threw), /foreign key|feed_alarm_feed_fkey|violates/)
})

await step('STAGED A applies; the next tick raises job:<name> alarms, registers disabled contracts, pushes ONE ntfy per change', async () => {
  await db.exec(sql('20261003_q2b_STAGED_A_heartbeat_alarms_on.sql'))
  assert.equal((await one(`select publish_alarms from job_heartbeat_state`)).publish_alarms, true)
  // a NEW failure after switch-on: eod-weekly-rebuild fails once (fail_after 1)
  await db.exec(`insert into cron.job_run_details (jobid, status, return_message, start_time, end_time) values (60,'failed','ERROR: boom', now(), now())`)
  const before = (await one(`select count(*)::int n from net.calls where url = 'https://ntfy.sh/'`)).n
  await db.query(`select public.job_heartbeat_check(now() + interval '20 minutes')`)
  const alarms = await all(`select feed, status from feed_alarm where feed like 'job:%' order by 1`)
  assert.ok(alarms.some(a => a.feed === 'job:eod-weekly-rebuild' && a.status === 'BREACHED'), JSON.stringify(alarms))
  assert.ok(alarms.some(a => a.feed === 'job:mirror-gap-repair-daily'))
  const c = await all(`select enabled, auto_repair from feed_contract where feed like 'job:%'`)
  assert.ok(c.length >= 2 && c.every(r => r.enabled === false && r.auto_repair === false))
  const pushes = await all(`select body from net.calls where url = 'https://ntfy.sh/' order by id`)
  assert.equal(pushes.length - before, 1, 'exactly one push')
  assert.match(pushes.at(-1).body.message, /eod-weekly-rebuild/)
  assert.doesNotMatch(pushes.at(-1).body.message, /mirror-gap-repair-daily/, 'reds that existed before switch-on are not re-announced')
  await db.query(`select public.job_heartbeat_check(now() + interval '25 minutes')`)
  assert.equal((await one(`select count(*)::int n from net.calls where url = 'https://ntfy.sh/'`)).n - before, 1, 'no repeat on the next tick')
})

await step('STAGED A: the stream listener is UP from its own heartbeat; the night watchman waits as NEW; publisher rows never alarm', async () => {
  // the checks above ran 20-25 min "in the future"; give the stream its beat at that time, then tick again
  await db.exec(`insert into massive_control.service_heartbeat values ('stocks-stream','8e7eedf7719698', now() + interval '25 minutes')`)
  await db.query(`select public.job_heartbeat_check(now() + interval '26 minutes')`)
  const rows = Object.fromEntries((await all(`select job, status, alarm from job_heartbeat where job like 'fly:%'`)).map(r => [r.job, r]))
  assert.equal(rows['fly:market-stream'].status, 'UP')
  assert.equal(rows['fly:nightly-verdict'].status, 'NEW')
  assert.equal(rows['fly:geiger-publisher'].alarm, false)
  assert.equal((await one(`select max_age_hours from feed_contract where feed = 'ibkr_putcall_minute'`)).max_age_hours, 66)
})

await step('the Fly ping (massive_writer) arms a job; a later silence turns it LATE', async () => {
  await db.query(`select public.job_heartbeat_ping('fly:nightly-verdict', true, 'VERDICT_GREEN', 'all good')`)
  await db.query(`select public.job_heartbeat_judge(now() + interval '1 hour')`)
  assert.equal((await one(`select status from job_heartbeat where job = 'fly:nightly-verdict'`)).status, 'UP')
  await db.query(`select public.job_heartbeat_judge(now() + interval '27 hours')`)
  assert.equal((await one(`select status from job_heartbeat where job = 'fly:nightly-verdict'`)).status, 'LATE')
})

await step('STAGED A rollback restores the live state (alarms off, no job: rows, original checker works)', async () => {
  await db.exec(sql('20261003_q2b_STAGED_A_heartbeat_alarms_on_ROLLBACK.sql'))
  assert.equal((await one(`select publish_alarms from job_heartbeat_state`)).publish_alarms, false)
  assert.equal((await one(`select count(*)::int n from feed_alarm where feed like 'job:%'`)).n, 0)
  assert.equal((await one(`select count(*)::int n from feed_contract where feed like 'job:%'`)).n, 0)
  assert.equal((await one(`select count(*)::int n from job_heartbeat where job = 'fly:nightly-verdict'`)).n, 0)
  assert.equal((await one(`select max_age_hours from feed_contract where feed = 'ibkr_putcall_minute'`)).max_age_hours, 18)
  assert.equal((await one(`select to_regproc('public.job_heartbeat_collect_external') is null x`)).x, true)
  await db.query(`select public.job_heartbeat_check()`)
})

await step('STAGED B moves the five schedules; its rollback puts them back', async () => {
  const get = async () => Object.fromEntries((await all(`select jobid, schedule from cron.job where jobid in (7,8,28,62,236)`)).map(r => [r.jobid, r.schedule]))
  const orig = await get()
  await db.exec(sql('20261003_q2b_STAGED_B_stagger_busy_minutes.sql'))
  assert.deepEqual(await get(), { 7: '1-59/15 * * * *', 8: '3-59/5 * * * *', 28: '13,43 * * * *', 62: '2-59/15 * * * *', 236: '43 * * * *' })
  await db.exec(sql('20261003_q2b_STAGED_B_stagger_busy_minutes_ROLLBACK.sql'))
  assert.deepEqual(await get(), orig)
})

await step('STAGED C switches 256 off and adds four single-call jobs that record their answer; rollback reverses it', async () => {
  await db.exec(sql('20261003_q2b_STAGED_C_mirror_gap_repair_split.sql'))
  assert.equal((await one(`select active from cron.job where jobid = 256`)).active, false)
  const parts = await all(`select jobname, schedule, command from cron.job where jobname like 'mirror-gap-repair-_' order by 1`)
  assert.equal(parts.length, 4)
  for (const p of parts) { assert.match(p.command, /^select scin_record\('mirror-gap-repair-\d'/); assert.doesNotMatch(p.command, /pg_sleep|;/); await db.query('explain ' + p.command) }
  await db.query(parts[1].command)  // one real run against the stubs: one call queued, one dispatch row
  assert.equal((await one(`select count(*)::int n from cron_dispatch where jobname = 'mirror-gap-repair-2'`)).n, 1)
  await db.exec(sql('20261003_q2b_STAGED_C_mirror_gap_repair_split_ROLLBACK.sql'))
  assert.equal((await one(`select count(*)::int n from cron.job where jobname like 'mirror-gap-repair-_'`)).n, 0)
  assert.equal((await one(`select active from cron.job where jobid = 256`)).active, true)
})

await step('STAGED D wraps single-call jobs (leading newline, WHERE, trailing ;) without changing the call; rollback is exact', async () => {
  const orig = Object.fromEntries((await all(`select jobid, command from cron.job`)).map(r => [r.jobid, r.command]))
  await db.exec(sql('20261003_q2b_STAGED_D_record_real_http_answers.sql'))
  const now = Object.fromEntries((await all(`select jobid, command from cron.job`)).map(r => [r.jobid, r.command]))
  for (const id of [18, 220, 261, 278, 279]) {
    assert.match(now[id], /^select scin_record\('/, `job ${id} wrapped`)
    const call = orig[id].trim().replace(/;\s*$/, '').replace(/\s+where\s+[\s\S]*$/i, '').replace(/^select\s+/i, '')
    assert.ok(now[id].includes(call), `job ${id}: the net.http call is carried over unchanged`)
    assert.ok(now[id].includes(BEARER) === orig[id].includes(BEARER))
  }
  assert.match(now[278], /\) where \(extract\(isodow/, 'the WHERE condition stays outside the call')
  assert.equal(now[256], orig[256], 'multi-statement 256 untouched')
  assert.equal(now[7], orig[7], 'already-recorded jobs untouched')
  await db.query(now[261])
  assert.equal((await one(`select count(*)::int n from cron_dispatch where jobname = 'sentiment-news-10m'`)).n, 1, 'a run now leaves a dispatch row')
  // the heartbeat re-classifies the wrapped job as one whose answer is seen
  await db.query(`select public.job_heartbeat_collect()`)
  assert.equal((await one(`select kind from job_heartbeat where job = 'sentiment-news-10m'`)).kind, 'pg_cron_http_seen')
  await db.exec(sql('20261003_q2b_STAGED_D_record_real_http_answers_ROLLBACK.sql'))
  const back = Object.fromEntries((await all(`select jobid, command from cron.job`)).map(r => [r.jobid, r.command]))
  for (const id of Object.keys(orig)) assert.equal(back[id], orig[id], `job ${id} restored byte for byte`)
  assert.equal((await one(`select to_regclass('scin_archive.q2b_cron_command_backup_20261003') is null x`)).x, true)
})

await step('STAGED E grants service_role read on youtube_transcripts; rollback revokes it', async () => {
  await db.exec(sql('20261003_q2b_STAGED_E_youtube_transcripts_grant.sql'))
  assert.equal((await one(`select has_table_privilege('service_role','public.youtube_transcripts','SELECT') x`)).x, true)
  await db.exec(sql('20261003_q2b_STAGED_E_youtube_transcripts_grant_ROLLBACK.sql'))
  assert.equal((await one(`select has_table_privilege('service_role','public.youtube_transcripts','SELECT') x`)).x, false)
})

await step('the live migration\'s own rollback removes everything it made', async () => {
  await db.exec(sql('20261003_job_heartbeat_ROLLBACK.sql'))
  assert.equal((await one(`select to_regclass('public.job_heartbeat') is null x`)).x, true)
  assert.equal((await one(`select count(*)::int n from cron.job where jobname = 'job-heartbeat-check-5m'`)).n, 0)
})

const failed = results.filter(r => r[0] === 'FAIL')
console.log(`\n${results.length - failed.length} of ${results.length} passed`)
process.exit(failed.length ? 1 : 0)
