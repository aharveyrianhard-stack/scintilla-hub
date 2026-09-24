-- 2026-09-24 · M42 SCINTILLAS — the detectors run by themselves.
--
-- WHAT IT RUNS. Edge function `scintillas-detect` (supabase/functions/scintillas-detect).
--   · intraday, every 10 minutes on weekdays 09:30–16:10 ET — reads quotes, examines the names that
--     are already moving, and stores any scintilla. Econ and earnings run on every pass.
--   · session, once at 18:45 ET on weekdays — the same pass with the cheap prefilter switched off,
--     so a very quiet name whose 2-sigma day is under 0.5% is still caught after the close.
-- The window is written in UTC because pg_cron runs in UTC: 13:30–20:10 UTC is 09:30–16:10 ET during
-- daylight time. THE COORDINATOR APPLIES THIS, and should re-check the hours when ET leaves DST
-- (1 Nov 2026), or replace the hour list with a single '*/10 * * * 1-5' and let the function decide.
--
-- THE SECRET. This migration contains NO key. It reads the bearer by name from Vault, the same way
-- 20260923_earnings_report_time_cron.sql does. Store it once (value never in git, never in a chat):
--     select vault.create_secret('<the functions bearer key>', 'scintilla_functions_key');
--
-- ROLLBACK (exact):
--     select cron.unschedule('scintillas-detect-intraday');
--     select cron.unschedule('scintillas-detect-session');
-- Rows already stored are left alone; nothing reads them but the Hub's own strip.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('scintillas-detect-intraday') where exists (select 1 from cron.job where jobname = 'scintillas-detect-intraday');
select cron.unschedule('scintillas-detect-session')  where exists (select 1 from cron.job where jobname = 'scintillas-detect-session');

select cron.schedule('scintillas-detect-intraday', '*/10 13-20 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-detect?mode=intraday',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);

select cron.schedule('scintillas-detect-session', '45 22 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-detect?mode=session',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);
