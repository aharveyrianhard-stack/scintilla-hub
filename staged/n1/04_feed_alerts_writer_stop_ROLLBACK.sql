-- N1 · ROLLBACK of 04: switches cron 129 'feed-alerts-5m' back on. Nothing else changed, nothing else to undo.
select cron.alter_job(129, active := true);
-- CHECK AFTER: select status from public.job_heartbeat where job = 'feed-alerts-5m';   -- UP within 10 min
