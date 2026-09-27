-- 2026-09-27 · B1 · SCHEDULES ONLY (apply after 20260927_breadth_daily.sql and after deploying breadth-ingest)
--
--   breadth-ingest-hourly     :55 past every hour · copies any new /v1/breadth rows into public.breadth_daily.
--                                The batch job appends after 16:45 ET; the hourly copy picks it up within the hour.
--                                A run with nothing new writes nothing.
--   index-constituents-daily  06:20 UTC daily     · FMP sp500-constituent + nasdaq-constituent → public.index_constituents
--                                (one row per index, ticker, as_of date; additive).
-- No key in this file: the bearer is read from Vault by name, as 20260924_sentiment_cron.sql does.
create extension if not exists pg_cron;
create extension if not exists pg_net;
select cron.unschedule('breadth-ingest-hourly')    where exists (select 1 from cron.job where jobname = 'breadth-ingest-hourly');
select cron.unschedule('index-constituents-daily') where exists (select 1 from cron.job where jobname = 'index-constituents-daily');
select cron.schedule('breadth-ingest-hourly', '55 * * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/breadth-ingest?mode=breadth',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 120000);
$$);
select cron.schedule('index-constituents-daily', '20 6 * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/breadth-ingest?mode=constituents',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 60000);
$$);
