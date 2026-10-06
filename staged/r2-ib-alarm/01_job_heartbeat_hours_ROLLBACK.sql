-- R2 01 ROLLBACK (5 Oct 2026): the judge body that was live on 5 Oct, byte for byte, then the four columns removed.
-- The columns are empty on every row except the put/call row set by 02 - run 02's rollback first.
CREATE OR REPLACE FUNCTION public.job_heartbeat_judge(p_at timestamp with time zone DEFAULT now())
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
end $function$;
alter table public.job_heartbeat drop column if exists hours_tz, drop column if exists hours_dow, drop column if exists hours_from, drop column if exists hours_to;
