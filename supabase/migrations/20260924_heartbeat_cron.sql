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
-- THE SECRET. This migration contains NO key. It reads the bearer by name from Vault, exactly as
-- 20260924_scintillas_cron.sql does:
--     select vault.create_secret('<the functions bearer key>', 'scintilla_functions_key');
--
-- ROLLBACK (exact):
--     select cron.unschedule('heartbeat-daily');
-- Rows already stored are left alone.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('heartbeat-daily') where exists (select 1 from cron.job where jobname = 'heartbeat-daily');

select cron.schedule('heartbeat-daily', '10 23 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/heartbeat-daily',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);
