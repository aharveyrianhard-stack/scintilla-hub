-- R2 01 (5 Oct 2026) — ADDITIVE columns + ONE function body replaced. Rollback: 01_job_heartbeat_hours_ROLLBACK.sql
-- (the judge body live on 5 Oct is saved in current-bodies/job_heartbeat_judge.sql).
--
-- WHY: job_heartbeat judges a heartbeat job LATE when its last success is older than expected_every + grace,
-- at any hour of any day. That is right for a job that runs around the clock. The MacBook's put/call counter is
-- only OWED during the market day (09:30-16:00 New York, Mon-Fri): IB logs the Gateway out every night and for
-- its weekend maintenance, so a rule without hours would page Alan every night. This gives a row optional
-- working hours; a row with none (every row today) is judged exactly as before.
--
-- NEIGHBOURS (read 5 Oct): job_heartbeat_check (cron 288) calls collect, collect_external, then this judge, then
-- sends the phone message from job_heartbeat_event - unchanged. job_heartbeat_status_board() names its columns -
-- unchanged. ibkr_gateway_watch (cron 275) is its own alarm with its own messages - unchanged, see README.
-- Pattern: a monitoring schedule / "active hours" on a dead-man switch (healthchecks.io schedules,
-- Prometheus Alertmanager time_intervals): outside the interval nothing is due and nothing changes state.
alter table public.job_heartbeat add column if not exists hours_tz   text;
alter table public.job_heartbeat add column if not exists hours_dow  integer[];
alter table public.job_heartbeat add column if not exists hours_from time;
alter table public.job_heartbeat add column if not exists hours_to   time;
comment on column public.job_heartbeat.hours_tz   is 'Time zone of hours_from / hours_to (default America/New_York). R2.';
comment on column public.job_heartbeat.hours_dow  is 'ISO weekdays the job is owed on (1 = Monday); null = every day. R2.';
comment on column public.job_heartbeat.hours_from is 'A heartbeat is owed from this local time. Null = around the clock. R2.';
comment on column public.job_heartbeat.hours_to   is 'A heartbeat is owed until this local time (exclusive). R2.';

CREATE OR REPLACE FUNCTION public.job_heartbeat_judge(p_at timestamp with time zone DEFAULT now())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  h record; pf timestamptz; new_status text; note text; changes int := 0;
  lt timestamp; in_hours boolean; opened timestamptz; tz text;
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
      -- R2: optional working hours. No hours on the row = owed around the clock = the rule as it was.
      in_hours := true; opened := null;
      if h.hours_from is not null and h.hours_to is not null then
        tz := coalesce(h.hours_tz, 'America/New_York');
        lt := p_at at time zone tz;
        in_hours := (h.hours_dow is null or extract(isodow from lt)::int = any (h.hours_dow))
                    and lt::time >= h.hours_from and lt::time < h.hours_to;
        opened := (lt::date + h.hours_from) at time zone tz;
      end if;
      if not h.armed or (h.last_ok_at is null and h.last_run_at is null) then
        new_status := 'NEW'; note := 'waiting for its first heartbeat';
      elsif h.last_ok_at >= p_at - h.expected_every - h.grace then
        new_status := 'UP'; note := 'on time';
      elsif not in_hours or p_at < opened + h.expected_every + h.grace then
        -- Nothing is owed right now (outside its hours, or its hours opened less than one period + grace ago).
        -- A job that was fine stays fine; a job that was LATE when its hours ended stays LATE until it reports again,
        -- so the closing bell never sends a false "back to normal".
        if h.status = 'LATE' then new_status := 'LATE'; note := h.status_note;
        else new_status := 'UP';
             note := 'nothing owed outside its hours (' || to_char(h.hours_from, 'HH24:MI') || '–' || to_char(h.hours_to, 'HH24:MI') || ' ' || tz
                     || case when h.hours_dow is null then '' else ', weekdays ' || array_to_string(h.hours_dow, ',') end || ')';
        end if;
      else
        new_status := 'LATE'; note := 'no successful heartbeat since ' || coalesce(to_char(h.last_ok_at at time zone 'America/New_York', 'Dy DD Mon HH24:MI') || ' ET', 'ever')
                                      || ' (expected every ' || h.expected_every || ')';
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
end $function$;
