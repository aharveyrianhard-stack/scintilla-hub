-- R2 02 ROLLBACK (5 Oct 2026): the row's terms as read on 5 Oct 21:03 ET, and the watchman's function removed.
-- armed / status / last_* are left as they are: they are the job's own history, not this file's settings.
-- To silence the row without rolling back: update public.job_heartbeat set alarm = false where job = 'mac:com.scintilla.ibkr-putcall';
update public.job_heartbeat set
  expected_every = interval '10 minutes', grace = interval '10 minutes', fail_after = 1,
  hours_tz = null, hours_dow = null, hours_from = null, hours_to = null,
  schedule = 'launchd KeepAlive',
  what = 'Runs all the time on the MacBook during the session; counts option volume at IB and sends the put/call minute.',
  updated_at = now()
where job = 'mac:com.scintilla.ibkr-putcall';
drop function if exists public.scin_putcall_night_line(date);
