-- Q2b (3 Oct 2026) · JOB HEARTBEAT — one dead-man's switch for every job that must run on time. ADDITIVE.
-- Rollback: supabase/migrations/20261003_job_heartbeat_ROLLBACK.sql (written first).
--
-- WHY. On 3 Oct the register found jobs that had been failing or dead for days with nobody told:
--   * mirror-gap-repair-daily (cron 256) failed 14 of 14 recorded nights (statement timeout; all its requests rolled back);
--   * the X-feed collector on the MacBook has not published since 25 Sep (its folder was deleted 28 Sep);
--   * 29 of 73 HTTP crons never record the real HTTP answer (only "queued", which pg_cron calls "succeeded");
--   * job_health_audit() only notices >= 3 failures inside one hour, so a nightly job can fail forever;
--   * feed_alerts holds 9,352 alerts and has delivered none (no channel).
--
-- PATTERN (public practice, not invented here):
--   healthchecks.io  — every check has a schedule (period or cron expression) + a grace time; states new / up / late /
--                      down / paused; alert only on a state CHANGE (https://healthchecks.io/docs/).
--   Prometheus       — "The key metric of a batch job is the last time it succeeded"
--                      (https://prometheus.io/docs/practices/instrumentation/#batch-jobs).
--   Google SRE book  — alert on symptoms, every page must be actionable
--                      (https://sre.google/sre-book/monitoring-distributed-systems/).
--   pg_cron          — job_run_details 'succeeded' for a net.http_* job only means the request was queued; pg_net keeps
--                      the real answer in net._http_response for 6 hours (https://github.com/supabase/pg_net). The existing
--                      public.cron_dispatch (scin_record / scin_dispatch + scin_dispatch_reap) already copies it; we read that.
--
-- WHAT IT TOUCHES. Creates three tables and seven functions, and schedules ONE cron job (job-heartbeat-check-5m).
-- It only READS cron.job, cron.job_run_details, public.cron_dispatch and public.ibkr_gateway_watch_config.
-- It writes ONLY its own three tables while job_heartbeat_state.publish_alarms = false (the default):
-- no feed_alarm row, no ntfy push, no change to any existing job, function, grant or table.
-- Turning alarms on is one line for the coordinator:  update public.job_heartbeat_state set publish_alarms = true;
-- then it writes feed_alarm rows named 'job:<name>' and pushes state changes to the ntfy topic the IB-gateway watch uses.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.job_heartbeat (
  job            text primary key,              -- cron jobname, or 'fly:<machine name>', or 'mac:<launchd label>'
  kind           text not null check (kind in ('pg_cron_sql','pg_cron_http_seen','pg_cron_http_unseen',
                                               'fly_scheduled','fly_service','launchd','external')),
  part           text,                          -- the character Alan reads ("the night watchman")
  what           text,                          -- one plain sentence: what it does
  cron_jobid     bigint,                        -- pg_cron jobid (pg_cron kinds only)
  schedule       text,                          -- cron expression in UTC (pg_cron kinds) or a note ('fly hourly, fuzzy')
  expected_every interval,                      -- for non-cron kinds: the period (healthchecks "period")
  grace          interval not null default interval '15 minutes',
  fail_after     integer not null default 1,    -- consecutive failed outcomes before FAILING (3 for jobs firing more than hourly)
  active         boolean not null default true, -- false = paused at the source (inactive cron job)
  armed          boolean not null default true, -- false = waiting for its first ping (healthchecks "new"); a ping arms it
  alarm          boolean not null default true, -- may raise feed_alarm / ntfy once publish_alarms is on
  registered_at  timestamptz not null default now(),
  last_run_at    timestamptz,                   -- last time it started (pg_cron) or pinged (others)
  last_ok_at     timestamptz,                   -- last success (for unseen HTTP jobs: last time it was queued)
  last_error_at  timestamptz,
  last_cause     text,                          -- named cause code of the last outcome (OK, SQL_ERROR, HTTP_500, HTTP_TIMEOUT, ...)
  last_detail    text,                          -- short masked detail of the last failure
  consec_fail    integer not null default 0,
  runs_ok        bigint not null default 0,
  runs_failed    bigint not null default 0,
  status         text not null default 'NEW' check (status in ('NEW','UP','LATE','FAILING','PAUSED','GONE')),
  status_since   timestamptz not null default now(),
  status_note    text,                          -- the sentence the status page prints
  updated_at     timestamptz not null default now()
);
comment on table public.job_heartbeat is
  'Q2b 3 Oct 2026: one row per job that must run on time; judged every 5 min by job_heartbeat_check(). Rollback: 20261003_job_heartbeat_ROLLBACK.sql';

create table if not exists public.job_heartbeat_state (
  id                smallint primary key default 1 check (id = 1),
  last_runid        bigint,                     -- cron.job_run_details watermark
  last_dispatch_id  bigint,                     -- public.cron_dispatch watermark
  publish_alarms    boolean not null default false,
  push_min_gap      interval not null default interval '15 minutes',
  last_push_at      timestamptz,
  last_check_at     timestamptz,
  last_check_note   text
);
insert into public.job_heartbeat_state (id) values (1) on conflict (id) do nothing;

create table if not exists public.job_heartbeat_event (
  id          bigint generated always as identity primary key,
  at          timestamptz not null default now(),
  job         text not null,
  from_status text,
  to_status   text not null,
  cause       text,
  note        text
);
create index if not exists job_heartbeat_event_job_at on public.job_heartbeat_event (job, at desc);

alter table public.job_heartbeat       enable row level security;
alter table public.job_heartbeat_state enable row level security;
alter table public.job_heartbeat_event enable row level security;
revoke all on public.job_heartbeat, public.job_heartbeat_state, public.job_heartbeat_event from anon, authenticated, public;

-- ---------------------------------------------------------------------------------------------------------------
-- 2. A cron-expression reader (standard 5 fields, UTC, the subset pg_cron accepts: * a a-b */n a-b/n lists)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_cron_field(p text, lo int, hi int) returns int[]
language plpgsql immutable as $$
declare part text; base text; step int; a int; b int; acc int[] := '{}';
begin
  if p is null or p = '' then return null; end if;
  foreach part in array string_to_array(p, ',') loop
    step := 1; base := part;
    if position('/' in part) > 0 then step := split_part(part, '/', 2)::int; base := split_part(part, '/', 1); end if;
    if base = '*' then a := lo; b := hi;
    elsif position('-' in base) > 0 then a := split_part(base, '-', 1)::int; b := split_part(base, '-', 2)::int;
    else a := base::int; b := case when step > 1 then hi else a end;
    end if;
    if step < 1 then return null; end if;
    acc := acc || array(select generate_series(a, b, step));
  end loop;
  return array(select distinct x from unnest(acc) x where x between lo and hi order by 1);
exception when others then return null;
end $$;

-- The most recent time at or before p_at when the schedule fires (UTC; pg_cron's cron.timezone is GMT here).
-- NULL when the expression is not understood. Interval schedules ('15 seconds') fire continuously: returns p_at.
create or replace function public.job_heartbeat_cron_prev_fire(p_schedule text, p_at timestamptz) returns timestamptz
language plpgsql stable as $$
declare
  f text[]; mins int[]; hrs int[]; doms int[]; mons int[]; dows int[];
  dom_star boolean; dow_star boolean; ok boolean;
  at_utc timestamp := p_at at time zone 'UTC'; d date; cand timestamp;
begin
  if p_schedule ~* '^\s*[0-9]+\s+seconds?\s*$' then return p_at; end if;
  f := regexp_split_to_array(trim(p_schedule), '\s+');
  if array_length(f, 1) <> 5 then return null; end if;
  mins := public.job_heartbeat_cron_field(f[1], 0, 59);
  hrs  := public.job_heartbeat_cron_field(f[2], 0, 23);
  doms := public.job_heartbeat_cron_field(f[3], 1, 31);
  mons := public.job_heartbeat_cron_field(f[4], 1, 12);
  dows := array(select distinct case when x = 7 then 0 else x end from unnest(public.job_heartbeat_cron_field(f[5], 0, 7)) x);
  if mins is null or hrs is null or doms is null or mons is null or cardinality(dows) = 0 then return null; end if;
  dom_star := f[3] = '*'; dow_star := f[5] = '*';
  for i in 0..35 loop
    d := at_utc::date - i;
    continue when not (extract(month from d)::int = any(mons));
    ok := case when dom_star and dow_star then true
               when dom_star then extract(dow from d)::int = any(dows)
               when dow_star then extract(day from d)::int = any(doms)
               else extract(dow from d)::int = any(dows) or extract(day from d)::int = any(doms) end;  -- cron's OR rule
    continue when not ok;
    select max(d + make_interval(hours => h, mins => m)) into cand
      from unnest(hrs) h, unnest(mins) m
     where d + make_interval(hours => h, mins => m) <= at_utc;
    if cand is not null then return cand at time zone 'UTC'; end if;
  end loop;
  return null;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 3. The ping — Fly jobs and anything outside the database call this at the end of each run (over their existing
--    Postgres connection, MASSIVE_DATABASE_URL = role massive_writer). A skip that the job decided on purpose
--    (weekend, nothing to do) is a SUCCESS: the job ran on time and answered.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_ping(p_job text, p_ok boolean, p_cause text default null, p_detail text default null)
returns text language plpgsql security definer set search_path = public as $$
declare clean text := left(regexp_replace(coalesce(p_detail, ''), 'eyJ[A-Za-z0-9._-]{20,}', '***', 'g'), 500);
begin
  insert into public.job_heartbeat as h (job, kind, part, what, expected_every, alarm, armed)
  values (left(p_job, 120), 'external', null, 'registered by its first ping', interval '1 day', false, true)
  on conflict (job) do nothing;
  update public.job_heartbeat h set
    armed = true,
    last_run_at = now(),
    last_ok_at = case when p_ok then now() else h.last_ok_at end,
    last_error_at = case when p_ok then h.last_error_at else now() end,
    last_cause = left(coalesce(p_cause, case when p_ok then 'OK' else 'FAILED' end), 80),
    last_detail = case when p_ok then h.last_detail else nullif(clean, '') end,
    consec_fail = case when p_ok then 0 else h.consec_fail + 1 end,
    runs_ok = h.runs_ok + case when p_ok then 1 else 0 end,
    runs_failed = h.runs_failed + case when p_ok then 0 else 1 end,
    updated_at = now()
  where h.job = left(p_job, 120);
  return 'ok';
end $$;
revoke all on function public.job_heartbeat_ping(text, boolean, text, text) from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'massive_writer') then
    execute 'grant execute on function public.job_heartbeat_ping(text, boolean, text, text) to massive_writer';
  end if;
end $$;
grant execute on function public.job_heartbeat_ping(text, boolean, text, text) to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 4. Collect — register new cron jobs, then fold in new run rows (incremental, by primary key watermarks)
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_collect() returns text
language plpgsql security definer set search_path = public, cron as $$
declare
  st public.job_heartbeat_state%rowtype;
  r record; n_runs int := 0; n_disp int := 0;
  max_runid bigint; min_running bigint; max_disp bigint; min_pending bigint;
  kind_of text;
begin
  select * into st from public.job_heartbeat_state where id = 1 for update;

  -- (a) every cron job has a row; a job created tomorrow is watched tomorrow
  for r in select jobid, jobname, schedule, active, command from cron.job loop
    kind_of := case when r.command ~* 'net\.http_(post|get)' then
                      case when r.command ~* 'scin_record|scin_dispatch' then 'pg_cron_http_seen' else 'pg_cron_http_unseen' end
                    else 'pg_cron_sql' end;
    insert into public.job_heartbeat as h (job, kind, part, what, cron_jobid, schedule, grace, fail_after, active, status)
    values (r.jobname, kind_of, null, null, r.jobid, r.schedule,
            case when kind_of = 'pg_cron_sql' then interval '10 minutes' else interval '15 minutes' end,
            case when split_part(r.schedule, ' ', 1) ~ '[*,/]' or r.schedule ~* 'second' then 3 else 1 end,
            r.active, case when r.active then 'NEW' else 'PAUSED' end)
    on conflict (job) do update set kind = excluded.kind, cron_jobid = excluded.cron_jobid, schedule = excluded.schedule,
        active = excluded.active, updated_at = now();
  end loop;
  update public.job_heartbeat h set active = false, status = 'GONE', status_since = now(),
         status_note = 'this cron job no longer exists', updated_at = now()
   where h.kind like 'pg_cron%' and h.status <> 'GONE'
     and not exists (select 1 from cron.job j where j.jobname = h.job);

  -- (b) pg_cron run rows since the watermark (first run: the last 15 days, all pg_cron keeps)
  if st.last_runid is null then
    select coalesce(min(runid), 0) - 1 into st.last_runid from cron.job_run_details where start_time > now() - interval '15 days';
  end if;
  select max(runid), min(runid) filter (where status in ('starting','running','connecting','sending'))
    into max_runid, min_running from cron.job_run_details where runid > st.last_runid;
  with fresh as (
    select j.jobname, d.runid, d.start_time, d.status, d.return_message
      from cron.job_run_details d join cron.job j on j.jobid = d.jobid
     where d.runid > st.last_runid and d.status in ('succeeded','failed')
       and (min_running is null or d.runid < min_running)
  ), agg as (
    select f.jobname,
           max(f.start_time) as last_run,
           max(f.start_time) filter (where f.status = 'succeeded') as last_succ,
           max(f.start_time) filter (where f.status = 'failed') as last_fail,
           count(*) filter (where f.status = 'succeeded') as n_succ,
           count(*) filter (where f.status = 'failed') as n_fail,
           (array_agg(f.return_message order by f.runid desc) filter (where f.status = 'failed'))[1] as fail_msg
      from fresh f group by f.jobname
  ), trail as (   -- failures after the last success in this batch = the current failure streak
    select a.jobname, count(f.*) filter (where f.status = 'failed' and f.start_time > coalesce(a.last_succ, '-infinity'::timestamptz)) as streak
      from agg a join fresh f on f.jobname = a.jobname group by a.jobname
  )
  update public.job_heartbeat h set
    last_run_at = greatest(coalesce(h.last_run_at, a.last_run), a.last_run),
    -- a pg_cron 'succeeded' is a real success only for SQL jobs; for an HTTP job whose answer is not recorded it means
    -- "queued", the most we can see (the status page says so); for an HTTP job whose answer IS recorded it means nothing.
    last_ok_at = case when a.last_succ is not null and h.kind <> 'pg_cron_http_seen'
                      then greatest(coalesce(h.last_ok_at, a.last_succ), a.last_succ) else h.last_ok_at end,
    last_error_at = case when a.last_fail is not null then greatest(coalesce(h.last_error_at, a.last_fail), a.last_fail) else h.last_error_at end,
    last_cause = case when a.last_fail is not null and a.last_fail >= coalesce(a.last_succ, '-infinity'::timestamptz) then 'SQL_ERROR'
                      when h.kind = 'pg_cron_http_unseen' then 'QUEUED_ANSWER_NOT_RECORDED'
                      when h.kind = 'pg_cron_sql' then 'OK' else h.last_cause end,
    last_detail = case when a.fail_msg is not null
                       then left(regexp_replace(a.fail_msg, 'eyJ[A-Za-z0-9._-]{20,}', '***', 'g'), 300) else h.last_detail end,
    consec_fail = case when h.kind = 'pg_cron_http_seen' then h.consec_fail + a.n_fail
                       when a.n_succ > 0 then t.streak else h.consec_fail + a.n_fail end,
    runs_ok = h.runs_ok + case when h.kind <> 'pg_cron_http_seen' then a.n_succ else 0 end,
    runs_failed = h.runs_failed + a.n_fail,
    updated_at = now()
  from agg a join trail t on t.jobname = a.jobname
  where h.job = a.jobname;
  get diagnostics n_runs = row_count;
  st.last_runid := case when min_running is not null then min_running - 1 else coalesce(max_runid, st.last_runid) end;

  -- (c) the real HTTP answers, as already copied into cron_dispatch by scin_dispatch_reap (every 2 min)
  if st.last_dispatch_id is null then
    select coalesce(min(id), 0) - 1 into st.last_dispatch_id from public.cron_dispatch where dispatched_at > now() - interval '15 days';
  end if;
  select max(id), min(id) filter (where outcome = 'pending') into max_disp, min_pending
    from public.cron_dispatch where id > st.last_dispatch_id;
  with fresh as (
    select id, jobname, dispatched_at, status_code, outcome, error_msg
      from public.cron_dispatch
     where id > st.last_dispatch_id and outcome <> 'pending' and (min_pending is null or id < min_pending)
  ), agg as (
    select f.jobname,
           max(f.dispatched_at) filter (where f.outcome = 'ok') as last_good,
           max(f.dispatched_at) filter (where f.outcome <> 'ok') as last_bad,
           count(*) filter (where f.outcome = 'ok') as n_good,
           count(*) filter (where f.outcome <> 'ok') as n_bad,
           (array_agg(case f.outcome when 'http_error' then 'HTTP_' || coalesce(f.status_code::text, 'ERROR')
                                     when 'timeout' then 'HTTP_TIMEOUT' when 'lost' then 'HTTP_ANSWER_LOST'
                                     else upper(f.outcome) end order by f.id desc) filter (where f.outcome <> 'ok'))[1] as bad_cause,
           (array_agg(coalesce(f.error_msg, 'HTTP ' || f.status_code) order by f.id desc) filter (where f.outcome <> 'ok'))[1] as bad_detail
      from fresh f group by f.jobname
  ), trail as (
    select a.jobname, count(f.*) filter (where f.outcome <> 'ok' and f.dispatched_at > coalesce(a.last_good, '-infinity'::timestamptz)) as streak
      from agg a join fresh f on f.jobname = a.jobname group by a.jobname
  )
  update public.job_heartbeat h set
    last_ok_at = case when a.last_good is not null then greatest(coalesce(h.last_ok_at, a.last_good), a.last_good) else h.last_ok_at end,
    last_error_at = case when a.last_bad is not null then greatest(coalesce(h.last_error_at, a.last_bad), a.last_bad) else h.last_error_at end,
    last_cause = case when a.last_bad is not null and a.last_bad >= coalesce(a.last_good, '-infinity'::timestamptz) then a.bad_cause else 'OK' end,
    last_detail = case when a.bad_detail is not null then left(a.bad_detail, 300) else h.last_detail end,
    consec_fail = case when a.n_good > 0 then t.streak else h.consec_fail + a.n_bad end,
    runs_ok = h.runs_ok + a.n_good,
    runs_failed = h.runs_failed + a.n_bad,
    updated_at = now()
  from agg a join trail t on t.jobname = a.jobname
  where h.job = a.jobname and h.kind = 'pg_cron_http_seen';
  get diagnostics n_disp = row_count;
  st.last_dispatch_id := case when min_pending is not null then min_pending - 1 else coalesce(max_disp, st.last_dispatch_id) end;

  update public.job_heartbeat_state set last_runid = st.last_runid, last_dispatch_id = st.last_dispatch_id where id = 1;
  return n_runs || ' jobs with new runs, ' || n_disp || ' jobs with new HTTP answers';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 5. Judge — the dead-man's switch. LATE = a due run did not start within its grace; FAILING = its last
--    fail_after outcomes failed; NEW = never seen yet and nothing due since it was registered.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_judge(p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public as $$
declare
  h record; pf timestamptz; new_status text; note text; changes int := 0;
begin
  for h in select * from public.job_heartbeat loop
    pf := null; note := null;
    if h.status = 'GONE' then continue; end if;
    if not h.active then
      new_status := 'PAUSED'; note := 'switched off at the source';
    elsif h.consec_fail >= h.fail_after and h.last_error_at is not null
          and h.last_error_at >= coalesce(h.last_ok_at, '-infinity'::timestamptz) then
      new_status := 'FAILING';
      note := 'last ' || h.consec_fail || ' run(s) failed: ' || coalesce(h.last_cause, '?') || coalesce(' — ' || left(h.last_detail, 140), '');
    elsif h.kind like 'pg_cron%' then
      pf := public.job_heartbeat_cron_prev_fire(h.schedule, p_at - h.grace);
      if pf is null then
        new_status := 'UP'; note := 'schedule not understood by the checker: ' || coalesce(h.schedule, '?');
      elsif h.last_run_at is null then
        if pf > h.registered_at then new_status := 'LATE'; note := 'missed its ' || to_char(pf at time zone 'America/New_York', 'Dy HH24:MI') || ' ET run (never seen running)';
        else new_status := 'NEW'; note := 'not seen running yet; nothing was due since it was registered'; end if;
      elsif h.last_run_at < pf - interval '1 minute' then
        new_status := 'LATE'; note := 'missed its ' || to_char(pf at time zone 'America/New_York', 'Dy HH24:MI') || ' ET run; last ran '
                                      || to_char(h.last_run_at at time zone 'America/New_York', 'Dy DD Mon HH24:MI') || ' ET';
      else
        new_status := 'UP';
        note := case when h.kind = 'pg_cron_http_unseen' then 'runs on time; its HTTP answer is not recorded (we only see that it was sent)'
                     else 'on time' end;
      end if;
    else
      if not h.armed or (h.last_ok_at is null and h.last_run_at is null) then
        new_status := 'NEW'; note := 'waiting for its first heartbeat';
      elsif coalesce(h.last_ok_at, '-infinity'::timestamptz) < p_at - h.expected_every - h.grace then
        new_status := 'LATE'; note := 'no successful heartbeat since ' || coalesce(to_char(h.last_ok_at at time zone 'America/New_York', 'Dy DD Mon HH24:MI') || ' ET', 'ever')
                                      || ' (expected every ' || h.expected_every || ')';
      else
        new_status := 'UP'; note := 'on time';
      end if;
    end if;

    if new_status is distinct from h.status then
      insert into public.job_heartbeat_event (at, job, from_status, to_status, cause, note)
      values (p_at, h.job, h.status, new_status, h.last_cause, note);
      changes := changes + 1;
    end if;
    update public.job_heartbeat set status = new_status, status_note = note,
           status_since = case when new_status is distinct from h.status then p_at else status_since end
     where job = h.job and (status is distinct from new_status or status_note is distinct from note);
  end loop;
  return changes || ' changes';
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 6. Check — collect + judge; when publish_alarms is on: feed_alarm rows 'job:<name>' and ONE ntfy message per tick
--    that lists what turned red or back to green (state changes only, healthchecks-style; never a repeat every 5 min).
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_check(p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public, net as $$
declare
  st public.job_heartbeat_state%rowtype; cfg record;
  c text; j text; went_bad text; went_good text; msg text;
begin
  c := public.job_heartbeat_collect();
  j := public.job_heartbeat_judge(p_at);
  select * into st from public.job_heartbeat_state where id = 1;

  if st.publish_alarms then
    insert into public.feed_alarm as fa (feed, status, age_hours, last_checked, repairs_tried, needs_human, last_error)
    select 'job:' || h.job, case when h.status = 'FAILING' then 'BREACHED' else 'LATE' end,
           round((extract(epoch from (p_at - coalesce(h.last_ok_at, h.registered_at))) / 3600)::numeric, 2),
           p_at, 0, true, left(h.status_note, 400)
      from public.job_heartbeat h where h.alarm and h.status in ('LATE','FAILING')
    on conflict (feed) do update set status = excluded.status, age_hours = excluded.age_hours, last_checked = p_at,
        needs_human = true, last_error = excluded.last_error,
        first_seen = case when fa.status = excluded.status then fa.first_seen else p_at end;
    update public.feed_alarm fa set status = 'OK', needs_human = false, last_error = null, last_checked = p_at,
           first_seen = case when fa.status = 'OK' then fa.first_seen else p_at end
     where fa.feed like 'job:%' and fa.status <> 'OK'
       and not exists (select 1 from public.job_heartbeat h where 'job:' || h.job = fa.feed and h.alarm and h.status in ('LATE','FAILING'));

    select string_agg(e.job || ' (' || e.to_status || ')', ', ' order by e.job) filter (where e.to_status in ('LATE','FAILING')),
           string_agg(e.job, ', ' order by e.job) filter (where e.to_status = 'UP' and e.from_status in ('LATE','FAILING'))
      into went_bad, went_good
      from public.job_heartbeat_event e join public.job_heartbeat h on h.job = e.job and h.alarm
     where e.at > coalesce(st.last_push_at, st.last_check_at, p_at - interval '10 minutes');

    if (went_bad is not null or went_good is not null)
       and (st.last_push_at is null or st.last_push_at < p_at - st.push_min_gap or went_bad is null) then
      select * into cfg from public.ibkr_gateway_watch_config where id = 1;
      if cfg.ntfy_topic is not null and not cfg.dry_run then
        msg := concat_ws(E'\n', 'Late or failing: ' || went_bad, 'Back to normal: ' || went_good);
        perform net.http_post(
          url := 'https://ntfy.sh/',
          body := jsonb_build_object('topic', cfg.ntfy_topic,
                    'title', case when went_bad is not null then 'Scintilla: a job is late or failing' else 'Scintilla: jobs back to normal' end,
                    'message', left(msg, 1500),
                    'priority', case when went_bad is not null then 4 else 2 end,
                    'tags', case when went_bad is not null then jsonb_build_array('warning') else jsonb_build_array('white_check_mark') end),
          headers := '{"Content-Type":"application/json"}'::jsonb,
          timeout_milliseconds := 10000);
        update public.job_heartbeat_state set last_push_at = p_at where id = 1;
      end if;
    end if;
  end if;

  update public.job_heartbeat_state set last_check_at = p_at, last_check_note = c || '; ' || j where id = 1;
  return c || '; ' || j;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 7. The status board read — plain fields only (no raw error text, no commands), for the status page.
-- ---------------------------------------------------------------------------------------------------------------
create or replace function public.job_heartbeat_status_board()
returns table (job text, part text, kind text, what text, status text, status_since timestamptz, status_note text,
               last_ok_at timestamptz, last_run_at timestamptz, last_error_at timestamptz, last_cause text,
               schedule text, alarm boolean, checker_last_run timestamptz)
language sql stable security definer set search_path = public as $$
  select h.job, h.part, h.kind, h.what, h.status, h.status_since, h.status_note,
         h.last_ok_at, h.last_run_at, h.last_error_at, h.last_cause, h.schedule, h.alarm,
         (select last_check_at from public.job_heartbeat_state where id = 1)
    from public.job_heartbeat h
   order by case h.status when 'FAILING' then 0 when 'LATE' then 1 when 'NEW' then 2 when 'UP' then 3 else 4 end, h.job;
$$;
revoke all on function public.job_heartbeat_status_board() from public;
grant execute on function public.job_heartbeat_status_board() to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. Seed the jobs that live outside the database (they arm themselves with their first ping; until then NEW, no alarm)
-- ---------------------------------------------------------------------------------------------------------------
insert into public.job_heartbeat (job, kind, part, what, schedule, expected_every, grace, armed) values
 ('fly:provider-tail-scheduled-hourly-i5', 'fly_scheduled', 'the night copyist',
  'Every hour (work only after 20:15 ET on trading days) rewrites the long bar histories behind charts asked for more than 400 bars.',
  'fly hourly (fuzzy), minute ~:43', interval '1 hour', interval '30 minutes', false),
 ('fly:provider-fan-daily-hourly-i5', 'fly_scheduled', 'the fan clerk',
  'Every hour (work only after 16:30 ET) writes each stock''s daily fan row that the Hub REWIND reads.',
  'fly hourly (fuzzy), minute ~:50', interval '1 hour', interval '30 minutes', false),
 ('fly:scout-geiger-nightly', 'fly_scheduled', 'the scout',
  'Every hour (work only after 20:15 ET) computes the off-Hub Geiger for ~5,600 names once per session.',
  'fly hourly (fuzzy), minute ~:21', interval '1 hour', interval '30 minutes', false),
 ('fly:scout-geiger-seven-hourly', 'fly_scheduled', 'the seven-rung scout',
  'Every hour (work only in the 16 and 20 ET hours) computes the seven-rung off-Hub Geiger.',
  'fly hourly (fuzzy), minute ~:17', interval '1 hour', interval '30 minutes', false),
 ('fly:geiger-publisher', 'fly_service', 'the 4-minute Geiger robot',
  'Runs all the time; every ~4 minutes reads 590 names x 7 rungs from the chart API and publishes the Geiger the Hub shows.',
  'always on (restart always)', interval '5 minutes', interval '10 minutes', false),
 ('fly:settled-close-supervisor', 'fly_service', 'the closing-bell clerk',
  'Runs inside the Geiger machine; after 16:05 ET builds the next session''s previous-close file, confirms it with Massive''s official bar.',
  'always on, inside geiger-publisher', interval '15 minutes', interval '15 minutes', false),
 ('fly:provider-bar-service', 'fly_service', 'the gatekeeper at the bar door',
  'Runs all the time; fetches and stores bars for the chart API, rebuilds intraday frames each minute, and writes relative volume.',
  'always on (restart always)', interval '5 minutes', interval '10 minutes', false),
 ('fly:market-stream', 'fly_service', 'the stream listener',
  'Runs all the time; listens to the live trade stream and marks which minutes need new bars.',
  'always on (restart on-failure)', interval '5 minutes', interval '10 minutes', false),
 ('mac:com.alanharvey.scintilla-xfeed-collector', 'launchd', 'the X-feed collector (MacBook)',
  'Nine times a day on the MacBook, reads Alan''s X timeline in a hidden browser and publishes the feed the Hub shows.',
  'launchd 06:30 08:30 10:30 12:30 14:30 16:30 18:30 21:00 23:30 local', interval '3 hours', interval '1 hour', false),
 ('mac:com.scintilla.ibkr-putcall', 'launchd', 'the put/call counter (MacBook)',
  'Runs all the time on the MacBook during the session; counts option volume at IB and sends the put/call minute.',
  'launchd KeepAlive', interval '10 minutes', interval '10 minutes', false)
on conflict (job) do nothing;

-- Measured 3 Oct (not invented): the X-feed collector's last good pass was 25 Sep 20:31:29Z (its runtime/program-health.json);
-- since 28 Sep launchd cannot start it (exit 78: its folder _worktrees/hub-xfeed-program-20260922 was deleted). Seeded so it reads LATE.
update public.job_heartbeat set armed = true, last_ok_at = '2026-09-25 20:31:29.7+00', last_run_at = '2026-09-28 01:00:02.5+00',
       last_error_at = '2026-09-28 01:00:02.5+00', last_cause = 'LAUNCHD_SPAWN_FAILED',
       last_detail = 'launchd exit 78 (EX_CONFIG): its program folder was deleted on 28 Sep; last good publish 25 Sep 20:31Z'
 where job = 'mac:com.alanharvey.scintilla-xfeed-collector' and last_ok_at is null;

-- the checker's first pass registers every cron job, then its own schedule
select public.job_heartbeat_check();
select cron.schedule('job-heartbeat-check-5m', '*/5 * * * *', 'select public.job_heartbeat_check()')
 where not exists (select 1 from cron.job where jobname = 'job-heartbeat-check-5m');
