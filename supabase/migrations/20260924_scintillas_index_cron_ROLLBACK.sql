-- ROLLBACK for 20260924_scintillas_index_cron.sql (M63). Unschedules only what it scheduled.
select cron.unschedule('scintillas-index-morning');
select cron.unschedule('scintillas-index-evening');
