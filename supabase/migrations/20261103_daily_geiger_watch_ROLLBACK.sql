-- Rollback for 20261103_daily_geiger_watch_APPLIED.sql. Nothing else depends on it.
select cron.unschedule('daily-geiger-watch');
drop function if exists public.daily_geiger_watch(timestamptz, boolean);
