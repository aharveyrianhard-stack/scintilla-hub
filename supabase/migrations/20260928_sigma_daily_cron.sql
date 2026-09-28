-- 2026-09-28 (N6) · USUAL DAY — the sigma history tops itself up after each close.
--
-- WHAT IT RUNS. Edge function `sigma-daily` (supabase/functions/sigma-daily). Each pass reads the newest date already in
-- public.sigma_day_counts, measures every settled session from there with the backfill's own test, and ADDS the rows to
-- public.sigma_events_daily and public.sigma_day_counts (insert, on conflict do nothing: a stored row is never changed).
--
-- WHEN. Two jobs, both in UTC:
--   sigma-daily          23:20 UTC Mon–Fri = 19:20 ET in daylight time, after heartbeat-daily (23:10) and after the chart
--                        API has the session's completed bar.
--   sigma-daily-catchup  11:20 UTC Tue–Sat = 07:20 ET the next morning. If the evening pass found a bar late (the newest day
--                        is held, never half-written) or failed, this pass writes it. With nothing new it adds nothing.
-- After daylight time ends on 1 Nov 2026 the evening pass is 18:20 ET; if that is before a bar is ready, the day is held
-- and the morning pass writes it, so neither hour needs changing.
--
-- SAFE TO RUN TWICE. Rows are keyed (ticker, date) and (date) and inserted with do-nothing on conflict.
--
-- THE BEARER. No key is written in this file. Like 20260928_prediction_markets_cron.sql, it prefers the Vault secret
-- 'scintilla_functions_key' and otherwise copies the bearer the live catalyst-odds-6h job already carries, server-side.
-- The function itself writes with the service role from its OWN environment (SUPABASE_SERVICE_ROLE_KEY).
--
-- NEEDS FIRST: 20260928_sigma_history.sql (the two tables) and the function deployed:
--     supabase functions deploy sigma-daily --project-ref wadinxqplrggagkvrdag
--
-- ROLLBACK (exact): 20260928_sigma_daily_cron_ROLLBACK.sql
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
    raise exception 'sigma-daily cron: no bearer (no vault secret scintilla_functions_key and no catalyst-odds-6h job to copy from)';
  end if;

  body := format($cmd$
    select net.http_post(
      url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/sigma-daily',
      headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
      body    := '{}'::jsonb,
      timeout_milliseconds := 150000)
  $cmd$, 'Bearer ' || bearer);

  perform cron.unschedule('sigma-daily') where exists (select 1 from cron.job where jobname = 'sigma-daily');
  perform cron.unschedule('sigma-daily-catchup') where exists (select 1 from cron.job where jobname = 'sigma-daily-catchup');
  perform cron.schedule('sigma-daily', '20 23 * * 1-5', body);
  perform cron.schedule('sigma-daily-catchup', '20 11 * * 2-6', body);
end
$mig$;
