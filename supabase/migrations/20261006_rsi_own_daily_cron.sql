-- 2026-10-06 · RS1 — each name's own RSI scale refreshes itself after the close.
--
-- WHAT IT RUNS. Edge function `rsi-own-daily` (supabase/functions/rsi-own-daily). One pass walks every name the chart
-- API serves (its own /universe, so the funds, the macro series and the crypto it serves are included), reads that
-- name's finished daily bars, and REPLACES the name's one row in public.rsi_own_percentiles.
--
-- WHEN. Two jobs, both in UTC, placed after the two jobs that already read the same bars so they never overlap:
--   rsi-own-daily          23:30 UTC Mon–Fri = 19:30 ET in daylight time — after heartbeat-daily (23:10) and sigma-daily
--                          (23:20), and after the chart API's 18:30 ET completed-session gate.
--   rsi-own-daily-catchup  11:30 UTC Tue–Sat = 07:30 ET the next morning — after sigma-daily-catchup (11:20). If the
--                          evening pass ran before a bar was ready, or failed, this pass writes it; otherwise it
--                          rewrites the same numbers.
-- After daylight time ends on 1 Nov 2026 the evening pass is 18:30 ET; a row is only ever computed from finished bars,
-- so an early pass writes yesterday's scale again and the morning pass brings it to date. Neither hour needs changing.
--
-- SAFE TO RUN TWICE. One row per name, upserted on (ticker).
--
-- THE BEARER. No key is written in this file. Like 20260928_sigma_daily_cron.sql, it prefers the Vault secret
-- 'scintilla_functions_key' and otherwise copies the bearer the live catalyst-odds-6h job already carries, server-side.
-- The function itself writes with the service role from its OWN environment (SUPABASE_SERVICE_ROLE_KEY).
--
-- NEEDS FIRST: 20261006_rsi_own_percentiles.sql (the table) and the function deployed:
--     supabase functions deploy rsi-own-daily --project-ref wadinxqplrggagkvrdag
--
-- ROLLBACK (exact): 20261006_rsi_own_daily_cron_ROLLBACK.sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $mig$
declare
  bearer text;
  body   text;
begin
  select decrypted_secret into bearer from vault.decrypted_secrets where name = 'scintilla_functions_key' limit 1;
  if bearer is null then
    select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into bearer from cron.job where jobname = 'catalyst-odds-6h' limit 1;
  end if;
  if bearer is null then
    raise exception 'rsi-own-daily cron: no bearer (no vault secret scintilla_functions_key and no catalyst-odds-6h job to copy from)';
  end if;

  body := format($cmd$
    select net.http_post(
      url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/rsi-own-daily',
      headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
      body    := '{}'::jsonb,
      timeout_milliseconds := 150000)
  $cmd$, 'Bearer ' || bearer);

  perform cron.unschedule('rsi-own-daily') where exists (select 1 from cron.job where jobname = 'rsi-own-daily');
  perform cron.unschedule('rsi-own-daily-catchup') where exists (select 1 from cron.job where jobname = 'rsi-own-daily-catchup');
  perform cron.schedule('rsi-own-daily', '30 23 * * 1-5', body);
  perform cron.schedule('rsi-own-daily-catchup', '30 11 * * 2-6', body);
end
$mig$;
