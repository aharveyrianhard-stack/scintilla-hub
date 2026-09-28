-- 2026-09-28 (N6) · rollback for 20260928_sigma_daily_cron.sql — stops the nightly top-up.
-- The two tables and the 28 Sep load are left exactly as they are (their own rollback is 20260928_sigma_history_ROLLBACK.sql).
select cron.unschedule('sigma-daily') where exists (select 1 from cron.job where jobname = 'sigma-daily');
select cron.unschedule('sigma-daily-catchup') where exists (select 1 from cron.job where jobname = 'sigma-daily-catchup');
-- To also remove the function:  supabase functions delete sigma-daily --project-ref wadinxqplrggagkvrdag
-- OPTIONAL, NEEDS ALAN (it deletes rows): the rows the top-up added are every row dated after the 28 Sep load's last day.
--   delete from public.sigma_events_daily where date > '2026-09-25';
--   delete from public.sigma_day_counts   where date > '2026-09-25';
