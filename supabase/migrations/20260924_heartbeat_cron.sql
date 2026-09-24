-- 2026-09-24 · M52 HEARTBEAT — the heartbeat writes itself after the close.
--
-- WHAT IT RUNS. Edge function `heartbeat-daily` (supabase/functions/heartbeat-daily). One pass
-- walks every served name (the chart API's own /universe, so the non-equities it serves are
-- included), reads that name's daily bars, and upserts one row per name into
-- public.ticker_heartbeat_daily for the session that just closed.
--
-- WHEN. 23:10 UTC on weekdays = 19:10 ET during daylight time, after the 18:30 ET completed-session
-- gate the chart API already uses, so the day being stored is a settled one and not a forming bar.
-- pg_cron runs in UTC. THE COORDINATOR APPLIES THIS and should re-check the hour when ET leaves
-- DST on 1 Nov 2026 (23:10 UTC becomes 18:10 ET, still after the gate, so this schedule stays
-- correct either way — it is stated here so nobody has to rediscover it).
--
-- SAFE TO RUN TWICE. The function upserts on (ticker, date), so a manual re-run or an overlapping
-- catch-up leaves one row per name per day.
--
-- THE SECRET. This migration contains NO key, and there is no Vault secret to read: the name
-- 'scintilla_functions_key' this file first used does not exist in this project (checked 24 Sep).
-- The bearer is copied server-side from the live earnings-report-time job (jobid 259), exactly as
-- scintillas-detect-intraday/-session (266/267) were scheduled, so it never passes through a file,
-- a log or a chat. Coordinator, applied 24 Sep 2026.
--
-- ROLLBACK (exact):
--     select cron.unschedule('heartbeat-daily');
-- Rows already stored are left alone.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('heartbeat-daily') where exists (select 1 from cron.job where jobname = 'heartbeat-daily');

select cron.schedule('heartbeat-daily', '10 23 * * 1-5', format(
  $cmd$select net.http_post(url := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/heartbeat-daily', headers := %s::jsonb || '{"Content-Type":"application/json"}'::jsonb, body := '{}'::jsonb, timeout_milliseconds := 120000)$cmd$,
  quote_literal((select substring(command from $re$'(\{"Authorization":[^']+\})'::jsonb$re$) from cron.job where jobid = 259))));
