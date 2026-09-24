-- 2026-09-24 · M59 DILUTION — the filings pass runs by itself.
--
-- WHAT IT RUNS. The same edge function, in its own mode: `scintillas-detect?mode=dilution`.
-- In that mode it does NOTHING else — no daily bars, no heartbeat, no earnings or economic reads.
--
-- HOW OFTEN, AND WHY. Hourly while the market is open, and once after the close.
--   · An 8-K about an offering is normally filed before the open or after the close, and the SEC's
--     daily index is rebuilt through the day, so hourly catches one within the hour it appears.
--   · The evening run is the one that matters most: it sees everything filed after the close.
--   · The pass looks back three days (rules.dilution.lookback_days), because an 8-K is due within
--     four business days of the event. Re-reading the same filing is free: its accession number is
--     the dedupe key, so the database keeps one row however many times it is seen.
--
-- WHAT IT COSTS.
--   · FMP: NOTHING. Not one call. The SEC publishes all of it free and needs no key.
--   · SEC: one daily-index file per day in the window (about 600 KB), plus one document per
--     matching filing — across this universe that measured 12 documents in 90 days — plus one
--     share-count read per company that filed something. A quiet day is one file.
--   · Supabase: one insert when something fires, and nothing otherwise.
--   · Ceiling, in code: MAX_FILING_READS = 40 documents per run, whatever the index says.
--
-- THE SECRET. No key is in this file. The bearer is read by name from Vault, exactly as
-- 20260924_scintillas_cron.sql does.
--
-- ROLLBACK (exact):
--     select cron.unschedule('scintillas-dilution-hourly');
--     select cron.unschedule('scintillas-dilution-evening');
-- Stored rows are left alone; removing them is the other rollback file's job.
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('scintillas-dilution-hourly')  where exists (select 1 from cron.job where jobname = 'scintillas-dilution-hourly');
select cron.unschedule('scintillas-dilution-evening') where exists (select 1 from cron.job where jobname = 'scintillas-dilution-evening');

-- hourly, 09:00–16:00 New York (13:00–20:00 UTC), weekdays
select cron.schedule('scintillas-dilution-hourly', '5 13-20 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-detect?mode=dilution',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);

-- and once after the close, 18:55 New York (22:55 UTC), weekdays
select cron.schedule('scintillas-dilution-evening', '55 22 * * 1-5', $$
  select net.http_post(
    url     := 'https://' || current_setting('app.settings.project_ref', true) || '.functions.supabase.co/scintillas-detect?mode=dilution',
    headers := jsonb_build_object('content-type', 'application/json',
                 'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 55000);
$$);
