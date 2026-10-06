-- R2 02 (5 Oct 2026) — the put/call counter's heartbeat row gets its real terms, and the night watchman gets
-- one read-only function. Needs 01 first. Rollback: 02_putcall_heartbeat_row_ROLLBACK.sql.
--
-- THE ROW ALREADY EXISTS: 'mac:com.scintilla.ibkr-putcall' was registered by Q2b on 3 Oct (launchd, every
-- 10 min + 10 min grace, alarm on) and has never been armed because nothing pings it. The brief called the row
-- 'mac:ibkr-putcall'; the registered name is kept so the jobs board does not grow a twin of the same job.
-- It arms itself on the first ping from the ibkr-ingest function (job_heartbeat_ping sets armed = true).
--
-- TERMS: owed Mon-Fri 09:30-16:00 New York; a landing every 5 minutes at the slowest; LATE after 15 minutes of
-- silence (5 + 10), so the earliest alarm on a dead morning is 09:45 ET. Three failed landings in a row = FAILING.
-- The counter in fact lands around the clock while the Gateway is logged in (a batch every few seconds), so a
-- weekday market holiday with the Gateway up raises nothing.
update public.job_heartbeat set
  expected_every = interval '5 minutes', grace = interval '10 minutes', fail_after = 3,
  hours_tz = 'America/New_York', hours_dow = array[1,2,3,4,5], hours_from = time '09:30', hours_to = time '16:00',
  schedule = 'launchd KeepAlive; owed Mon-Fri 09:30-16:00 ET (pinged by ibkr-ingest on each landing)',
  what = 'Runs all the time on the MacBook; reads option volume from IB Gateway and lands it through ibkr-ingest. Needs IB Gateway logged in on the MacBook.',
  updated_at = now()
where job = 'mac:com.scintilla.ibkr-putcall';

-- One line for the night watchman's report. Read-only, SECURITY DEFINER because the watchman's database role
-- (massive_writer) can execute job_heartbeat_ping but cannot select from job_heartbeat or the put/call tables.
create or replace function public.scin_putcall_night_line(p_session date)
 returns jsonb
 language sql
 stable
 security definer
 set search_path to 'public'
as $function$
  select jsonb_build_object(
    'session_et', p_session,
    'job', h.job, 'status', h.status, 'status_note', h.status_note, 'armed', h.armed, 'last_ok_at', h.last_ok_at,
    'minutes_in_session', (select count(distinct m.ts) from public.ibkr_putcall_minute m where m.session_et = p_session and m.scope = 'SCINTILLA_EQUITY'),
    'first_minute', (select min(m.ts) from public.ibkr_putcall_minute m where m.session_et = p_session and m.scope = 'SCINTILLA_EQUITY'),
    'last_minute', (select max(m.ts) from public.ibkr_putcall_minute m where m.session_et = p_session and m.scope = 'SCINTILLA_EQUITY'),
    'minutes_expected', 390,
    'last_reading', (select max(v.ts) from public.ibkr_option_volume v where v.session_et = (select max(session_et) from public.ibkr_option_volume)))
  from (select 1) one left join public.job_heartbeat h on h.job = 'mac:com.scintilla.ibkr-putcall';
$function$;
revoke all on function public.scin_putcall_night_line(date) from public, anon, authenticated;
grant execute on function public.scin_putcall_night_line(date) to service_role, massive_writer;
