-- 2026-09-24 · M59 DILUTION — rollback for 20260924_scintillas_dilution_cron.sql.
-- Stops the filings pass running. The other detectors' schedules are untouched, and rows already
-- stored stay where they are (20260924_scintillas_dilution_ROLLBACK.sql removes those).
select cron.unschedule('scintillas-dilution-hourly')  where exists (select 1 from cron.job where jobname = 'scintillas-dilution-hourly');
select cron.unschedule('scintillas-dilution-evening') where exists (select 1 from cron.job where jobname = 'scintillas-dilution-evening');
