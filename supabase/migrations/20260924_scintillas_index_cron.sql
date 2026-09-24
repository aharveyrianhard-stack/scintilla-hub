-- 2026-09-24 · M63 — the index-change pass, on a schedule. WRITTEN, NOT APPLIED.
--
-- CADENCE, AND WHY IT IS SO LOW. An index change is announced days before it binds and the
-- provider's list does not move intraday, so reading it more than twice a day buys nothing and
-- spends a paid provider call each time. Twice on weekdays: once before the open, once after the
-- close. THREE provider reads per run, six a day, and nothing else in the function touches FMP.
--
-- THE KEY IS NOT IN THIS FILE. The function reads FMP_API_KEY from its own environment; this
-- migration only carries the function's bearer token out of the vault, exactly as the dilution
-- cron does. No secret value is written here.
--
-- ROLLBACK (exact) — 20260924_scintillas_index_cron_ROLLBACK.sql:
--     select cron.unschedule('scintillas-index-morning');
--     select cron.unschedule('scintillas-index-evening');
-- Stored rows are left alone; removing them is the other rollback file's job.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('scintillas-index-morning') where exists (select 1 from cron.job where jobname = 'scintillas-index-morning');
select cron.unschedule('scintillas-index-evening') where exists (select 1 from cron.job where jobname = 'scintillas-index-evening');

-- 08:40 New York (12:40 UTC), weekdays — before the open, so an effective date that binds today
-- is on the tape when he opens the Hub
select cron.schedule('scintillas-index-morning', '40 12 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-index',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);

-- 18:40 New York (22:40 UTC), weekdays — after the close, for announcements made during the day
select cron.schedule('scintillas-index-evening', '40 22 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-index',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);
