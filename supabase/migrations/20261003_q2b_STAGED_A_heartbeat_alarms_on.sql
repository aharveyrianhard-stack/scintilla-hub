-- Q2b (3 Oct 2026) · STAGED A — switch the job heartbeat's alarms on, and give it the three signals it lacks.
-- STATUS: NOT APPLIED. Staged for Alan's approval (Alan, 3 Oct ~11:00 ET: "I don't want you guys to make any changes on
-- my Hub without my approval"). Rollback: 20261003_q2b_STAGED_A_heartbeat_alarms_on_ROLLBACK.sql
--
-- PRECONDITION. 20261003_job_heartbeat.sql is ALREADY LIVE (applied 14:48Z 3 Oct by the first Q2b run, before the brief
-- was changed to "staged only"; alarms off: publish_alarms = false, no ntfy sent — last_push_at is null). This file only
-- touches objects that migration created, plus feed_alarm rows named 'job:%' and one feed_contract number.
--
-- WHAT IT DOES
--  1. The night watchman (Q2a's nightly second opinion, services/stocks-ops/nightly-verdict.mjs) gets a row. Its job pings
--     job_heartbeat_ping('fly:nightly-verdict', true, 'VERDICT_<colour>', <summary>) after it writes the night file,
--     and pings a skip on non-session nights. Division of labour agreed with Q1/Q2a: Q1's /v1/integrity check alarms on
--     what the verdict SAYS (RED); this heartbeat alarms only if the night watchman DID NOT RUN (dead-man's switch).
--  2. The stream listener (fly:market-stream) is judged from the heartbeat it already writes every ~30 s into
--     massive_control.service_heartbeat (service 'stocks-stream'), folded in by the checker on each tick.
--  3. The Geiger publisher, the bar service and the settled-close clerk have no ping and run all the time; their health is
--     the chart API's own (/health, Q1's /v1/integrity). They keep a row for the status page but never alarm from here,
--     so one fault never pages twice.
--  4. ibkr_putcall_minute's freshness contract (max 18 h) cannot know weekends: it reads LATE every Saturday and Sunday
--     (open since 28 Sep 13:30Z on 3 Oct). The in-session check (cron 273, every 5 min) already covers weekdays, so the
--     long contract moves to 66 h (Friday 16:00 ET to Monday 09:30 ET = 65.5 h). Neighbour: scin_feed_watchdog only.
--  5. publish_alarms = true: from the next tick, a job that turns LATE or FAILING writes feed_alarm 'job:<name>' and ONE
--     ntfy message per tick listing what changed (state changes only — healthchecks.io's rule; never a repeat every 5 min).
--
-- PUBLIC PRACTICE FOLLOWED: healthchecks.io (period + grace, alert on state change; https://healthchecks.io/docs/),
-- Google SRE "Monitoring Distributed Systems" (every page actionable, symptoms first), Prometheus alerting `for:` /
-- batch-job "last success" (https://prometheus.io/docs/practices/instrumentation/#batch-jobs).
--
-- APPLY (coordinator, after Alan's yes):
--   cd "/Users/alanharvey/SCINTILLA 0.5/_deploy/s6link" && supabase db query --linked --project-ref wadinxqplrggagkvrdag -- "$(cat <this file>)"
-- FIX INSIDE: the live checker writes feed_alarm 'job:<name>' rows, but feed_alarm.feed is a foreign key to
--   feed_contract(feed); with alarms on, the first LATE/FAILING job would make every tick fail and roll back. The
--   re-stated checker below registers a disabled feed_contract row first (tested on PGlite with the same key).
-- CHECK: select status, count(*) from job_heartbeat group by 1;  select * from feed_alarm where feed like 'job:%';

do $$ begin
  if to_regclass('public.job_heartbeat') is null then
    raise exception 'public.job_heartbeat is missing: apply 20261003_job_heartbeat.sql first';
  end if;
end $$;

-- 1. the night watchman
insert into public.job_heartbeat (job, kind, part, what, schedule, expected_every, grace, armed, alarm) values
 ('fly:nightly-verdict', 'fly_scheduled', 'the night watchman',
  'Every night checks every name''s daily bar and previous close against Massive''s whole-market file and FMP, and that every Geiger cell is fresh; writes one verdict (GREEN / AMBER / RED) with named causes.',
  'fly daily (after 20:15 ET); pings a skip on non-session nights', interval '1 day', interval '2 hours', false, true)
on conflict (job) do nothing;

-- 3. watched elsewhere: keep the row, never alarm from here
update public.job_heartbeat set alarm = false,
       what = what || ' [Health judged by the chart API (/health, /v1/integrity — Q1), not by a ping.]'
 where job in ('fly:geiger-publisher', 'fly:provider-bar-service', 'fly:settled-close-supervisor')
   and what not like '%judged by the chart API%';

-- 4. calendar-blind freshness contract
update public.feed_contract set max_age_hours = 66,
       note = note || ' [Q2b 3 Oct: 18 -> 66 h so weekends stop reading LATE; weekdays are watched by cron 273 every 5 min.]'
 where feed = 'ibkr_putcall_minute' and max_age_hours = 18;

-- 2. fold the stream's own heartbeat in, then run the original collect + judge (+ alarms) — the checker, re-stated
create or replace function public.job_heartbeat_collect_external() returns text
language plpgsql security definer set search_path = public as $$
declare last_beat timestamptz;
begin
  select max(at_utc) into last_beat from massive_control.service_heartbeat
   where service = 'stocks-stream' and at_utc > now() - interval '2 days';
  if last_beat is not null then
    update public.job_heartbeat set armed = true, last_run_at = last_beat,
           last_ok_at = greatest(coalesce(last_ok_at, last_beat), last_beat), last_cause = 'OK', consec_fail = 0, updated_at = now()
     where job = 'fly:market-stream' and (last_ok_at is null or last_ok_at < last_beat);
  end if;
  return 'stream beat ' || coalesce(to_char(last_beat at time zone 'UTC', 'HH24:MI:SS'), 'none');
end $$;
revoke all on function public.job_heartbeat_collect_external() from public, anon, authenticated;

create or replace function public.job_heartbeat_check(p_at timestamptz default now()) returns text
language plpgsql security definer set search_path = public, net as $$
declare
  st public.job_heartbeat_state%rowtype; cfg record;
  c text; x text; j text; went_bad text; went_good text; msg text;
begin
  c := public.job_heartbeat_collect();
  x := public.job_heartbeat_collect_external();
  j := public.job_heartbeat_judge(p_at);
  select * into st from public.job_heartbeat_state where id = 1;

  if st.publish_alarms then
    -- feed_alarm.feed REFERENCES feed_contract(feed): register the job first (enabled = false, so scin_feed_watchdog
    -- never walks it — this checker owns it). Without this the first red job would fail the whole tick (found 3 Oct).
    insert into public.feed_contract (feed, label, kind, source_table, date_column, max_age_hours, repair_fn, repair_args,
                                      auto_repair, enabled, note)
    select 'job:' || h.job, left(coalesce(h.part, h.job), 120), 'derived', 'job_heartbeat', 'last_ok_at',
           greatest(1, ceil(extract(epoch from coalesce(h.expected_every, interval '1 hour') + h.grace) / 3600))::int,
           null, '', false, false,
           'Q2b job heartbeat (job_heartbeat_check, cron 288) owns this alarm; scin_feed_watchdog does not walk it.'
      from public.job_heartbeat h where h.alarm and h.status in ('LATE','FAILING')
    on conflict (feed) do nothing;
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

  update public.job_heartbeat_state set last_check_at = p_at, last_check_note = c || '; ' || x || '; ' || j where id = 1;
  return c || '; ' || x || '; ' || j;
end $$;

-- 5. alarms on (the first tick after this only pushes jobs that CHANGE state from now on: mark the current reds as
--    already announced so Alan is not woken by a backlog — they are listed on the status page instead)
update public.job_heartbeat_state set publish_alarms = true, last_push_at = now() where id = 1;
