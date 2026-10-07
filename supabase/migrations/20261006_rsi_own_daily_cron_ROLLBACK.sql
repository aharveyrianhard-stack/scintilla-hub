-- 2026-10-06 · RS1 — rollback for 20261006_rsi_own_daily_cron.sql — stops the nightly refresh.
-- The table and its rows are left exactly as they are (their own rollback is 20261006_rsi_own_percentiles_ROLLBACK.sql).
-- With the refresh stopped the rows age; three weeks later the Hub and the Station stop reading them and return to the
-- 30 / 70 colouring by themselves, so a stopped job can never leave a stale scale on screen.
-- Every job the schedule file can have created is removed by name: the shares (however many `parts` was set to) and the
-- two single-call jobs of the 6 Oct version of that file.
select cron.unschedule(jobname) from cron.job
 where jobname ~ '^rsi-own-daily(-catchup)?(-[0-9]+)?$';
-- To also remove the function:  supabase functions delete rsi-own-daily --project-ref wadinxqplrggagkvrdag
