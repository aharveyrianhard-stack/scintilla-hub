-- 2026-10-03 · F1 (full Hub treatment) · item 3: the two jobs a new ticker was missing, on a schedule.
-- APPLY ONLY AFTER the functions on this branch are deployed (dossier-facts is new; fmp-backfill gains job=etf).
-- Same shape as the existing jobs that call these functions without a header (bf-profile, jobid 18; read-engine, jobid 27).
--   dossier-facts      hourly at :52 — a facts dossier for every full name with none (60 a run), its own rows re-read about every 6 h.
--   fmp-backfill etf   Sundays 07:40 UTC — fund holdings replaced only when FMP answers with a list (a failed answer keeps the stored list).
-- Neighbours checked: read-engine (*/10) reads ticker_context after these rows land; fmp-backfill's other jobs share no lock with job=etf;
-- bf-profile runs 06:25 daily, so the weekly etf pass never overlaps it. Rollback beside this file.
select cron.schedule('dossier-facts-1h', '52 * * * *',
  $$select net.http_post(url:='https://wadinxqplrggagkvrdag.supabase.co/functions/v1/dossier-facts', headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=140000)$$);
select cron.schedule('bf-etf-weekly', '40 7 * * 0',
  $$select net.http_post(url:='https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-backfill?job=etf', headers:='{"Content-Type":"application/json"}'::jsonb, timeout_milliseconds:=180000)$$);
