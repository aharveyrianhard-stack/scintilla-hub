-- Rollback of 20261003_f1_loader_schedules.sql: removes the two schedules it added. The rows they wrote are rolled back by
-- 20261003_f1_facts_dossiers_ROLLBACK.sql (tag FACTS:f1-v1) and, for holdings, by restoring from the weekly job's own replace.
select cron.unschedule('dossier-facts-1h');
select cron.unschedule('bf-etf-weekly');
