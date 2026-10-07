-- 2026-10-06 · RS1 — each name's own RSI scale refreshes itself after the close.
--
-- WHAT IT RUNS. Edge function `rsi-own-daily` (supabase/functions/rsi-own-daily). It walks every name the chart API
-- serves (its own /universe plus the macro series it serves), reads that name's finished daily bars, and REPLACES the
-- name's one row in public.rsi_own_percentiles.
--
-- IN SIX CALLS, NOT ONE (changed 7 Oct). The platform allows one call 2 seconds of CPU. Measured on 7 Oct, one call for
-- the whole night (603 names x 900 daily bars, 53 MB) used between 0.8 and 1.8 s of CPU over six runs on an Apple M5 Max, a much
-- faster core than the platform's, so a single call would very likely be cut off every night. Each job below asks for one
-- sixth of the names (?part=K&of=6; the function sorts the list, so the shares never overlap and together are
-- everything). A sixth is about 90,000 bars — half of what heartbeat-daily's one call is known to manage, so the served
-- list can double first — and a call that is cut short still keeps the names it finished, because rows are written as
-- the call goes.
--
-- WHEN. Twelve jobs, all in UTC, placed after the two jobs that already read the same bars so they never overlap
-- (checked 7 Oct: no other job in supabase/migrations is scheduled between :25 and :40 of these two hours):
--   rsi-own-daily-1..6          23:30 to 23:35 UTC Mon–Fri = 19:30 ET in daylight time — after heartbeat-daily (23:10)
--                               and sigma-daily (23:20), and after the chart API's 18:30 ET completed-session gate.
--   rsi-own-daily-catchup-1..6  11:30 to 11:35 UTC Tue–Sat = 07:30 ET the next morning — after sigma-daily-catchup
--                               (11:20). If the evening pass ran before a bar was ready, or failed, this pass writes
--                               it; otherwise it rewrites the same numbers.
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
-- CHECK ONCE BEFORE APPLYING THIS FILE (added 7 Oct). The function has not yet run on the platform. Call the deployed
-- function once by hand, dry — it computes one sixth and writes nothing:
--     .../functions/v1/rsi-own-daily?dry=1&part=1&of=6        (same bearer header as the jobs below)
--   a 200 whose "rows" is near 100  -> apply this file as it is.
--   a 546 (the platform's worker limit) -> a sixth is still too much there: change `parts` below to 12 (and nothing
--                                       else) and apply; the function takes up to 24 shares.
--
-- ROLLBACK (exact): 20261006_rsi_own_daily_cron_ROLLBACK.sql
create extension if not exists pg_cron;
create extension if not exists pg_net;

do $mig$
declare
  bearer text;
  body   text;
  parts  constant integer := 6;   -- how many calls share one night (NIGHT_SHARES in rsi-own.mjs; a test keeps them equal)
begin
  select decrypted_secret into bearer from vault.decrypted_secrets where name = 'scintilla_functions_key' limit 1;
  if bearer is null then
    select substring(command from 'Bearer ([A-Za-z0-9._-]+)') into bearer from cron.job where jobname = 'catalyst-odds-6h' limit 1;
  end if;
  if bearer is null then
    raise exception 'rsi-own-daily cron: no bearer (no vault secret scintilla_functions_key and no catalyst-odds-6h job to copy from)';
  end if;

  /* the single-call jobs of the 6 Oct version of this file, if they were ever scheduled */
  perform cron.unschedule('rsi-own-daily') where exists (select 1 from cron.job where jobname = 'rsi-own-daily');
  perform cron.unschedule('rsi-own-daily-catchup') where exists (select 1 from cron.job where jobname = 'rsi-own-daily-catchup');

  for k in 1..parts loop
    body := format($cmd$
      select net.http_post(
        url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/rsi-own-daily?part=%s&of=%s',
        headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
        body    := '{}'::jsonb,
        timeout_milliseconds := 150000)
    $cmd$, k, parts, 'Bearer ' || bearer);

    perform cron.unschedule('rsi-own-daily-' || k) where exists (select 1 from cron.job where jobname = 'rsi-own-daily-' || k);
    perform cron.unschedule('rsi-own-daily-catchup-' || k) where exists (select 1 from cron.job where jobname = 'rsi-own-daily-catchup-' || k);
    perform cron.schedule('rsi-own-daily-' || k, format('%s 23 * * 1-5', 29 + k), body);            -- 23:30 … 23:35
    perform cron.schedule('rsi-own-daily-catchup-' || k, format('%s 11 * * 2-6', 29 + k), body);    -- 11:30 … 11:35
  end loop;
end
$mig$;
