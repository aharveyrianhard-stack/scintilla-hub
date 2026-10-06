// R2 dry run (5 Oct 2026): the staged heartbeat SQL EXECUTED on a throw-away PostgreSQL (PGlite - Postgres
// compiled to WebAssembly; no network, nothing live is touched), loaded with a read-only copy of the live
// job_heartbeat rows taken 5 Oct ~21:10 ET.
//   PGLITE_DIR=<folder holding node_modules/@electric-sql/pglite> node r2-dryrun.mjs [out.json]
import fs from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import assert from 'node:assert/strict'
const here = dirname(fileURLToPath(import.meta.url))
const sql = f => fs.readFileSync(join(here, '..', f), 'utf8')
const { PGlite } = await import(pathToFileURL(join(process.env.PGLITE_DIR, 'node_modules/@electric-sql/pglite/dist/index.js')).href)
const I = JSON.parse(fs.readFileSync(join(here, 'dryrun-input.json'), 'utf8'))
const db = new PGlite()
const all = async (q, p) => (await db.query(q, p)).rows
const JOB = 'mac:com.scintilla.ibkr-putcall'
await db.exec(`
  create role anon; create role authenticated; create role service_role; create role massive_writer;
  create table public.job_heartbeat (job text primary key, kind text, part text, what text, cron_jobid bigint, schedule text,
    expected_every interval, grace interval default '00:15:00', fail_after integer default 1, active boolean default true,
    armed boolean default true, alarm boolean default true, registered_at timestamptz default now(), last_run_at timestamptz,
    last_ok_at timestamptz, last_error_at timestamptz, last_cause text, last_detail text, consec_fail integer default 0,
    runs_ok bigint default 0, runs_failed bigint default 0, status text default 'NEW', status_since timestamptz default now(),
    status_note text, updated_at timestamptz);
  create table public.job_heartbeat_event (id bigserial primary key, at timestamptz default now(), job text, from_status text, to_status text, cause text, note text);
  create table public.ibkr_putcall_minute (scope text, label text, ts timestamptz, session_et date, primary key (scope, label, ts));
  create table public.ibkr_option_volume (ticker text, ts timestamptz, session_et date, primary key (ticker, ts));`)
for (const f of [...I.cron_functions].sort((a, b) => a.proname.length - b.proname.length)) await db.exec(f.def)
const load = async () => {
  await db.exec('truncate public.job_heartbeat; truncate public.job_heartbeat_event')
  for (const r of I.rows) await db.query(`insert into public.job_heartbeat (job, kind, schedule, expected_every, grace, fail_after, active, armed, alarm, registered_at,
      last_run_at, last_ok_at, last_error_at, last_cause, consec_fail, status, status_note) values ($1,$2,$3,$4::interval,$5::interval,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)`,
    [r.job, r.kind, r.schedule, r.expected_every, r.grace, r.fail_after, r.active, r.armed, r.alarm, r.registered_at, r.last_run_at, r.last_ok_at, r.last_error_at, r.last_cause, r.consec_fail, r.status, r.status_note])
}
const snapshot = () => all('select job, status, status_note from public.job_heartbeat order by job')
const out = { ran_utc: new Date().toISOString(), rows_loaded: I.rows.length }

// 1. NEIGHBOURS: every live row, judged by the live body and by the new body at the same eleven moments, must agree.
const MOMENTS = ['2026-10-05 13:29+00', '2026-10-05 13:46+00', '2026-10-05 20:01+00', '2026-10-06 01:10+00', '2026-10-06 04:00+00', '2026-10-06 13:45+00',
  '2026-10-06 21:15+00', '2026-10-10 15:00+00', '2026-10-11 03:00+00', '2026-10-12 13:50+00', '2026-10-13 00:30+00']
const judgeAll = async () => { const res = []; for (const m of MOMENTS) { await db.query('select public.job_heartbeat_judge($1::timestamptz)', [m]); res.push(await snapshot()) } return res }
await db.exec(sql('current-bodies/job_heartbeat_judge.sql')); await load(); const before = await judgeAll()
const eventsOld = (await all('select count(*)::int n from public.job_heartbeat_event'))[0].n
await db.exec(sql('01_job_heartbeat_hours.sql')); await load(); const after = await judgeAll()
const eventsNew = (await all('select count(*)::int n from public.job_heartbeat_event'))[0].n
assert.deepEqual(after, before, 'with no hours on any row the new judge must agree with the live one on every row at every moment')
assert.equal(eventsNew, eventsOld)
out.neighbours = { rows: I.rows.length, moments: MOMENTS.length, comparisons: I.rows.length * MOMENTS.length, differences: 0, status_changes_recorded_each: eventsOld }

// 2. THE PUT/CALL ROW under 02: the outage of 4-5 Oct replayed minute by minute where it matters.
await load(); await db.exec(sql('02_putcall_heartbeat_row.sql'))
const row = async () => (await all('select status, status_note, armed from public.job_heartbeat where job = $1', [JOB]))[0]
const at = async (ts, ping) => {
  if (ping) await db.query("update public.job_heartbeat set armed = true, last_run_at = $2::timestamptz, last_ok_at = $2::timestamptz, last_cause = 'OK', consec_fail = 0 where job = $1", [JOB, ts])
  await db.query('select public.job_heartbeat_judge($1::timestamptz)', [ts]); const r = await row(); return { at_utc: ts, ping: !!ping, status: r.status, note: r.status_note }
}
const T = []
T.push({ step: 'before the first ping the row waits', ...(await at('2026-10-02 15:00+00')) })
T.push({ step: 'Fri 2 Oct 15:59 ET, landing', ...(await at('2026-10-02 19:59+00', true)) })
T.push({ step: 'Sun 4 Oct 04:38 ET, last landing before the logout', ...(await at('2026-10-04 08:38+00', true)) })
T.push({ step: 'Sun 4 Oct 18:00 ET, silent, weekend', ...(await at('2026-10-04 22:00+00')) })
T.push({ step: 'Mon 5 Oct 09:29 ET, silent, before the open', ...(await at('2026-10-05 13:29+00')) })
T.push({ step: 'Mon 5 Oct 09:44 ET, silent, 14 min after the open', ...(await at('2026-10-05 13:44+00')) })
T.push({ step: 'Mon 5 Oct 09:45 ET, silent, 15 min after the open', ...(await at('2026-10-05 13:45+00')) })
T.push({ step: 'Mon 5 Oct 16:05 ET, still silent after the close', ...(await at('2026-10-05 20:05+00')) })
T.push({ step: 'Mon 5 Oct 20:37 ET, Gateway back, first landing', ...(await at('2026-10-06 00:37+00', true)) })
T.push({ step: 'Tue 6 Oct 02:00 ET, IB nightly logout, silent', ...(await at('2026-10-06 06:00+00')) })
T.push({ step: 'Tue 6 Oct 09:40 ET, landing', ...(await at('2026-10-06 13:40+00', true)) })
T.push({ step: 'Tue 6 Oct 11:00 ET, 80 min silent mid-session', ...(await at('2026-10-06 15:00+00')) })
T.push({ step: 'Tue 6 Oct 11:02 ET, landing again', ...(await at('2026-10-06 15:02+00', true)) })
assert.deepEqual(T.map(x => x.status), ['NEW', 'UP', 'UP', 'UP', 'UP', 'UP', 'LATE', 'LATE', 'UP', 'UP', 'UP', 'LATE', 'UP'])
out.putcall_timeline = T
out.putcall_events = await all('select at, from_status, to_status, note from public.job_heartbeat_event where job = $1 order by id', [JOB])
// the phone message rides on events of rows with alarm = true: exactly LATE, UP, LATE, UP after the first arming
assert.deepEqual(out.putcall_events.map(e => e.to_status), ['UP', 'LATE', 'UP', 'LATE', 'UP'])

// 3. Three failed landings in a row = FAILING; one is not.
await db.query("update public.job_heartbeat set last_error_at = '2026-10-06 15:03+00', consec_fail = 1, last_cause = 'WRITE_FAILED' where job = $1", [JOB])
const one = await at('2026-10-06 15:03+00')
await db.query("update public.job_heartbeat set last_error_at = '2026-10-06 15:04+00', consec_fail = 3 where job = $1", [JOB])
const three = await at('2026-10-06 15:04+00')
assert.equal(one.status, 'UP'); assert.equal(three.status, 'FAILING')
out.failing = { after_one_failed_landing: one.status, after_three: three.status, note: three.note }

// 4. The watchman's line.
await db.exec(`insert into public.ibkr_putcall_minute select 'SCINTILLA_EQUITY', 'ALL', timestamptz '2026-10-02 13:30+00' + g * interval '1 minute', date '2026-10-02' from generate_series(0, 389) g;
               insert into public.ibkr_option_volume values ('AAPL', '2026-10-06 00:37+00', '2026-10-05');`)
out.night_line = { full_session: (await all("select public.scin_putcall_night_line('2026-10-02') j"))[0].j, empty_session: (await all("select public.scin_putcall_night_line('2026-10-05') j"))[0].j }
assert.equal(out.night_line.full_session.minutes_in_session, 390); assert.equal(out.night_line.empty_session.minutes_in_session, 0)
const priv = (await all("select has_function_privilege('massive_writer', 'public.scin_putcall_night_line(date)', 'execute') mw, has_function_privilege('anon', 'public.scin_putcall_night_line(date)', 'execute') anon"))[0]
assert.deepEqual(priv, { mw: true, anon: false }); out.night_line.privileges = priv

// 5. Rollbacks restore what was live.
await db.exec(sql('02_putcall_heartbeat_row_ROLLBACK.sql')); await db.exec(sql('01_job_heartbeat_hours_ROLLBACK.sql'))
const cols = (await all("select column_name from information_schema.columns where table_name = 'job_heartbeat' and column_name like 'hours_%'")).length
const fn = (await all("select count(*)::int n from pg_proc where proname = 'scin_putcall_night_line'"))[0].n
const terms = (await all('select expected_every::text e, grace::text g, fail_after f, schedule s from public.job_heartbeat where job = $1', [JOB]))[0]
assert.equal(cols, 0); assert.equal(fn, 0); assert.deepEqual(terms, { e: '00:10:00', g: '00:10:00', f: 1, s: 'launchd KeepAlive' })
await load(); assert.deepEqual(await judgeAll(), before, 'after the rollback the judge is the live one again')
out.rollback = { hours_columns_left: cols, night_line_function_left: fn, putcall_terms: terms, judge_agrees_with_live_again: true }
out.result = 'ALL CHECKS PASSED'
fs.writeFileSync(process.argv[2] || join(here, 'r2-dryrun-result.json'), JSON.stringify(out, null, 1))
console.log(JSON.stringify({ result: out.result, neighbours: out.neighbours, timeline: T.map(x => `${x.step} -> ${x.status}`), failing: out.failing, night_line_empty: out.night_line.empty_session }, null, 1))
