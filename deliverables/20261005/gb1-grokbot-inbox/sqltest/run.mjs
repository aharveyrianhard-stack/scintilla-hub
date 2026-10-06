// GB1 SQL test (5 Oct 2026): applies the inbox migration and its rollback to a throw-away PostgreSQL (PGlite —
// Postgres compiled to WebAssembly) with stand-ins for the roles, pg_cron and the job_heartbeat table (columns
// copied from supabase/migrations/20261003_job_heartbeat.sql on hub/q2b-keepalives-20261003). No network, no
// live database. Run:  PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node run.mjs
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const here = dirname(fileURLToPath(import.meta.url));
const MIG = join(here, '../../../../supabase/migrations');
if (!process.env.PGLITE_DIR) { console.error('set PGLITE_DIR'); process.exit(2); }
const { PGlite } = await import(pathToFileURL(join(process.env.PGLITE_DIR, 'node_modules/@electric-sql/pglite/dist/index.js')).href);
const UP = readFileSync(join(MIG, '20261005_grokbot_inbox.sql'), 'utf8'), DOWN = readFileSync(join(MIG, '20261005_grokbot_inbox_ROLLBACK.sql'), 'utf8');
const TABLES = ['grokbot_inbox', 'x_posts', 'youtube_chunks', 'x_following', 'x_youtube_channel_map', 'grokbot_news_scores'];
let failed = 0;
const step = async (name, fn) => { try { await fn(); console.log('PASS', name); } catch (e) { failed++; console.log('FAIL', name, '—', e.message); } };
const ROLES = `create role service_role bypassrls; create role anon; create role authenticated;
  grant usage on schema public to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;`;   // what Supabase does: new tables are handed to the public key
const CRON = `create schema cron;
  create table cron.job (jobid bigserial primary key, schedule text, command text, active boolean default true, jobname text unique);
  create function cron.schedule(p_name text, p_schedule text, p_command text) returns bigint language sql as $$
    insert into cron.job (jobname, schedule, command) values (p_name, p_schedule, p_command)
    on conflict (jobname) do update set schedule = excluded.schedule, command = excluded.command returning jobid $$;
  create function cron.unschedule(p_name text) returns boolean language sql as $$ delete from cron.job where jobname = p_name returning true $$;`;
const HEARTBEAT = `create table public.job_heartbeat (job text primary key,
    kind text not null check (kind in ('pg_cron_sql','pg_cron_http_seen','pg_cron_http_unseen','fly_scheduled','fly_service','launchd','external')),
    part text, what text, cron_jobid bigint, schedule text, expected_every interval, grace interval not null default interval '15 minutes',
    fail_after integer not null default 1, active boolean not null default true, armed boolean not null default true, alarm boolean not null default true,
    registered_at timestamptz not null default now(), last_run_at timestamptz, last_ok_at timestamptz, last_error_at timestamptz, last_cause text,
    last_detail text, consec_fail integer not null default 0, runs_ok bigint not null default 0, runs_failed bigint not null default 0,
    status text not null default 'NEW' check (status in ('NEW','UP','LATE','FAILING','PAUSED','GONE')), status_since timestamptz not null default now(),
    status_note text, updated_at timestamptz not null default now());
  create table public.job_heartbeat_event (id bigint generated always as identity primary key, at timestamptz not null default now(), job text not null, from_status text, to_status text not null, cause text, note text);
  insert into public.job_heartbeat (job, kind) values ('some-other-job', 'pg_cron_sql');`;

{ // ---- the full estate: roles, pg_cron, heartbeat
  const db = new PGlite();
  const one = async (q) => (await db.query(q)).rows[0];
  await db.exec(ROLES + CRON + HEARTBEAT + `create table public.app_config (key text primary key, value text); insert into public.app_config values ('yt_bridge_channels', '{}');`);
  await step('the migration applies', () => db.exec(UP));
  await step('it applies a second time without error or duplicates', async () => {
    await db.exec(UP);
    assert.equal((await one(`select count(*)::int n from cron.job where jobname = 'grokbot-inbox-retention'`)).n, 1);
    assert.equal((await one(`select count(*)::int n from public.job_heartbeat where job = 'grokbot:inbox'`)).n, 1);
  });
  await step('all six tables exist with row-level security on and no policy', async () => {
    for (const t of TABLES) {
      const r = await one(`select relrowsecurity rls, (select count(*)::int from pg_policies where tablename = '${t}') pol from pg_class where oid = 'public.${t}'::regclass`);
      assert.deepEqual(r, { rls: true, pol: 0 }, t);
    }
  });
  await step('the public key (anon) and a signed-in user can neither read nor write any of them, nor the view', async () => {
    for (const role of ['anon', 'authenticated']) for (const t of [...TABLES, 'grokbot_inbox_last']) {
      for (const q of [`select * from public.${t} limit 1`, ...(t === 'grokbot_inbox_last' ? [] : [`delete from public.${t}`, `insert into public.${t} default values`])]) {
        await db.exec(`set role ${role}`);
        let err = null; try { await db.query(q); } catch (e) { err = e.message; } finally { await db.exec('reset role'); }
        assert.match(String(err), /permission denied/, `${role}: ${q}`);
      }
    }
  });
  await step('the service role files rows, and the same key twice is one row (the upserts the function sends)', async () => {
    await db.exec(`set role service_role`);
    try {
      for (let i = 0; i < 2; i++) {
        await db.exec(`insert into public.x_posts (record_key, post_id, handle, kind, created_at, text, url, tickers, list, updated_at)
          values ('post:1975000000000000001', '1975000000000000001', 'alphatrends', 'original', '2026-10-06T13:31:07Z', 'v${i}', 'https://x.com/alphatrends/status/1975000000000000001', '{NVDA,AMD}', 'tracked', now())
          on conflict (record_key) do update set text = excluded.text, updated_at = excluded.updated_at`);
        await db.exec(`insert into public.youtube_chunks (video_id, t_start, t_end, ticker, model, score, preview) values ('dQw4w9WgXcQ', 754, 812, 'MU', 'm1', 0.${i}2, 'p')
          on conflict (video_id, t_start, ticker, model) do update set score = excluded.score`);
        await db.exec(`insert into public.x_following (handle, list, seen_at) values ('${i ? 'AlphaTrends' : 'alphatrends'}', 'following', now())
          on conflict (handle_lc, list) do update set handle = excluded.handle, seen_at = excluded.seen_at`);
        await db.exec(`insert into public.x_youtube_channel_map (x_handle, channel_id, seen_at) values ('${i ? 'wolf_tradingx' : 'WOLF_TradingX'}', 'UCvTUPg9PxLq3DO72AZBygNg', now())
          on conflict (x_handle_lc, channel_id) do update set seen_at = excluded.seen_at`);
        await db.exec(`insert into public.grokbot_news_scores (url, ticker, model, score, scored_at) values ('https://example.com/a', 'MU', 'm1', 0.4, now())
          on conflict (url, ticker, model) do update set score = excluded.score`);
        await db.exec(`insert into public.grokbot_inbox (kind, sent_at, items, accepted, outcome, envelope) values ('x_posts', now(), 1, 1, 'ok', '{"kind":"x_posts"}')`);
      }
      for (const t of TABLES.slice(1)) assert.equal((await one(`select count(*)::int n from public.${t}`)).n, 1, t);
      assert.deepEqual(await one(`select text, first_seen_at <= updated_at ok from public.x_posts`), { text: 'v1', ok: true });
      assert.equal((await one(`select text from public.youtube_chunks`)).text, null, 'text is empty unless it is sent');
      assert.deepEqual(await one(`select kind, envelopes_30d from public.grokbot_inbox_last`), { kind: 'x_posts', envelopes_30d: 2 });
    } finally { await db.exec('reset role'); }
  });
  await step('the checks refuse what the function would never send', async () => {
    for (const q of [`insert into public.youtube_chunks (video_id, t_start, ticker, model, preview) values ('dQw4w9WgXcQ', 1, '', 'm', repeat('p', 201))`,
      `insert into public.youtube_chunks (video_id, t_start, ticker, model, score) values ('dQw4w9WgXcQ', 2, '', 'm', 1.5)`,
      `insert into public.youtube_chunks (video_id, t_start, t_end, ticker, model) values ('dQw4w9WgXcQ', 9, 3, '', 'm')`,
      `insert into public.x_posts (record_key, post_id, handle, kind, created_at, url) values ('k', '1', 'a', 'thread', now(), 'u')`]) {
      await assert.rejects(db.query(q), /violates check constraint/, q);
    }
  });
  await step('the heartbeat row: late after 2 hours, waits for the first ping, raises no alarm by itself', async () => {
    assert.deepEqual(await one(`select kind, (expected_every + grace)::text late_after, armed, alarm, status, fail_after from public.job_heartbeat where job = 'grokbot:inbox'`),
      { kind: 'external', late_after: '02:00:00', armed: false, alarm: false, status: 'NEW', fail_after: 3 });
  });
  await step('the clean-up job deletes log rows older than 30 days and nothing else', async () => {
    await db.exec(`insert into public.grokbot_inbox (received_at, kind, outcome) values (now() - interval '31 days', 'x_posts', 'ok'), (now() - interval '29 days', 'x_posts', 'ok')`);
    const job = await one(`select schedule, command from cron.job where jobname = 'grokbot-inbox-retention'`);
    assert.equal(job.schedule, '17 3 * * *');
    await db.exec(job.command);
    assert.equal((await one(`select count(*)::int n from public.grokbot_inbox`)).n, 3);
    assert.equal((await one(`select count(*)::int n from public.x_posts`)).n, 1);
  });
  await step('the rollback removes exactly what was added and leaves the neighbours alone', async () => {
    await db.exec(DOWN);
    for (const t of [...TABLES, 'grokbot_inbox_last']) assert.equal((await one(`select to_regclass('public.${t}') is null x`)).x, true, t);
    assert.equal((await one(`select count(*)::int n from cron.job`)).n, 0);
    assert.deepEqual((await db.query(`select job from public.job_heartbeat`)).rows, [{ job: 'some-other-job' }]);
    assert.equal((await one(`select count(*)::int n from public.app_config`)).n, 1);
    await db.exec(DOWN);   // twice is harmless
    await db.exec(UP);     // and it can be applied again afterwards
  });
}
{ // ---- a database without pg_cron and without the heartbeat tables
  const db = new PGlite();
  await db.exec(ROLES);
  await step('applies and rolls back cleanly where pg_cron and job_heartbeat are not installed', async () => {
    await db.exec(UP); await db.exec(DOWN);
  });
}
console.log(failed ? `\n${failed} FAILED` : '\nALL PASS');
process.exit(failed ? 1 : 0);
