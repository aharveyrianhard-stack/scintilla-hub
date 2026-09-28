-- SCINTILLA · L4 PREDICTION MARKETS — the schedule.
--
-- ONE job, 'prediction-markets', fires every 15 minutes; the WHERE clause decides whether to call:
--   * New York weekday 08:00–17:59  -> every 15 minutes (US hours)
--   * any other time                -> only at :00 (hourly)
-- Written in America/New_York, so it stays right when daylight time ends on 1 Nov. Same rule as
-- isUsHours() in supabase/functions/prediction-markets/lib.ts. Calls per day: 40 + 14 = 54 on a
-- weekday, 24 on a weekend day.
--
-- THE BEARER. No key is written in this file. The live function crons on this project carry their
-- bearer inline (catalyst-odds-6h, scintillas-detect-*); this reuses the one catalyst-odds-6h already
-- uses, copied server-side inside the database, and prefers the Vault secret
-- 'scintilla_functions_key' if someone has created it. If neither exists it stops with an error.
--
-- ROLLBACK: select cron.unschedule('prediction-markets');   (or the full _ROLLBACK.sql)
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
    raise exception 'prediction-markets cron: no bearer (no vault secret scintilla_functions_key and no catalyst-odds-6h job to copy from)';
  end if;

  body := format($cmd$
    select net.http_post(
      url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/prediction-markets',
      headers := jsonb_build_object('Authorization', %L, 'Content-Type', 'application/json'),
      body    := '{}'::jsonb,
      timeout_milliseconds := 120000)
    where (extract(isodow from now() at time zone 'America/New_York') between 1 and 5
           and extract(hour from now() at time zone 'America/New_York') between 8 and 17)
       or extract(minute from now()) < 5
  $cmd$, 'Bearer ' || bearer);

  perform cron.unschedule('prediction-markets') where exists (select 1 from cron.job where jobname = 'prediction-markets');
  perform cron.schedule('prediction-markets', '*/15 * * * *', body);
end
$mig$;
