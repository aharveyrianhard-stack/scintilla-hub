-- ROLLBACK for 20260928_prediction_market_snapshots.sql and 20260928_prediction_markets_cron.sql.
-- Stops the schedule first, then removes only what L4 added. public.catalyst_odds is not touched.
-- The edge function is removed separately:  supabase functions delete prediction-markets --project-ref wadinxqplrggagkvrdag
select cron.unschedule('prediction-markets') where exists (select 1 from cron.job where jobname = 'prediction-markets');
drop view  if exists public.prediction_market_latest;
drop table if exists public.prediction_market_runs;
drop table if exists public.prediction_market_snapshots;
