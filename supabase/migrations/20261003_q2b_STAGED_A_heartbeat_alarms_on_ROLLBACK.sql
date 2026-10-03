-- ROLLBACK · Q2b STAGED A (3 Oct 2026) — puts the job heartbeat back exactly as 20261003_job_heartbeat.sql left it.
-- Undoes: alarms on, the night-watchman row, the stream fold-in, the three alarm=false rows, the 66 h contract, the
-- 'job:%' feed_alarm rows. Does NOT drop the heartbeat itself (that is 20261003_job_heartbeat_ROLLBACK.sql).

update public.job_heartbeat_state set publish_alarms = false where id = 1;
delete from public.feed_alarm where feed like 'job:%';
delete from public.feed_contract where feed like 'job:%' and source_table = 'job_heartbeat';
delete from public.job_heartbeat where job = 'fly:nightly-verdict';
delete from public.job_heartbeat_event where job = 'fly:nightly-verdict';
update public.job_heartbeat set alarm = true,
       what = replace(what, ' [Health judged by the chart API (/health, /v1/integrity — Q1), not by a ping.]', '')
 where job in ('fly:geiger-publisher', 'fly:provider-bar-service', 'fly:settled-close-supervisor');
update public.job_heartbeat set armed = false, last_run_at = null, last_ok_at = null, last_cause = null
 where job = 'fly:market-stream';
update public.feed_contract set max_age_hours = 18,
       note = replace(note, ' [Q2b 3 Oct: 18 -> 66 h so weekends stop reading LATE; weekdays are watched by cron 273 every 5 min.]', '')
 where feed = 'ibkr_putcall_minute' and max_age_hours = 66;

-- the checker as 20261003_job_heartbeat.sql defined it (section 6), then the fold-in function goes
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
drop function if exists public.job_heartbeat_collect_external();
