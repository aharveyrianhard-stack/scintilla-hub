-- ROLLBACK for 20260927_breadth_daily.sql and 20260927_breadth_cron.sql — removes exactly what they added.
select cron.unschedule('breadth-ingest-hourly')        where exists (select 1 from cron.job where jobname = 'breadth-ingest-hourly');
select cron.unschedule('index-constituents-daily')     where exists (select 1 from cron.job where jobname = 'index-constituents-daily');
drop policy if exists breadth_daily_read on public.breadth_daily;
drop table if exists public.breadth_daily;
-- public.index_constituents is NOT dropped: it predates this lane (20260924_index_constituents.sql).
-- Rows the constituents job added can be removed with:
--   delete from public.index_constituents where source like 'FMP stable/%-constituent%';
