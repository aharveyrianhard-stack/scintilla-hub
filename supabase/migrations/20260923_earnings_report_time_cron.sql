-- 2026-09-23 · EVENTS earnings (M28) — the report-time fill runs by itself.
--
-- WHY. M26 measured it: of the upcoming rows the Hub tracks, almost none carried a
-- report time, because the job that catches earnings (fmp-events v2) writes ticker,
-- date, EPS and revenue and has no report_time field at all. A Mac filled 44 rows by
-- hand on 23 Sep. This schedules the same fill, with the same rules, in Supabase — so
-- it keeps itself current and needs no key on anybody's laptop.
--
-- WHAT IT RUNS. Edge function `earnings-report-time` (supabase/functions/earnings-report-time),
-- once a day on weekday mornings. It only ever writes report_time into a row that has
-- none, and records which source said so and when.
--
-- THE SECRET. This migration contains NO key. It reads the bearer the function is called
-- with from Vault, by name. Store it once (value never in git, never in a chat):
--     select vault.create_secret('<the functions bearer key>', 'scintilla_functions_key');
-- If this estate's other crons already pass their key a different way, use that way
-- instead — the schedule and the body below are what matter.
--
-- ROLLBACK (exact):
--     select cron.unschedule('earnings-report-time-1d');
-- Nothing it wrote is removed by that: a filled report_time stays, with its source
-- recorded beside it. To undo the writes themselves as well:
--     update public.earnings_events set report_time = null, report_time_source = null,
--            report_time_set_at = null
--      where report_time_source = 'nasdaq-calendar';
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('earnings-report-time-1d')
 where exists (select 1 from cron.job where jobname = 'earnings-report-time-1d');

-- 09:23 ET on weekdays, before the American morning fills up with reports.
select cron.schedule('earnings-report-time-1d', '23 13 * * 1-5', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/earnings-report-time?days=45',
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret
                                                  from vault.decrypted_secrets
                                                 where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb,
    timeout_milliseconds := 280000);
$$);

comment on extension pg_cron is
  'Scintilla schedules: earnings-report-time-1d fills a missing earnings report_time from Nasdaq''s calendar, weekdays 09:23 ET.';
