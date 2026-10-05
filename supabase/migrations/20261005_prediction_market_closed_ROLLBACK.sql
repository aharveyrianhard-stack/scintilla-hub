-- ROLLBACK for 20261005_prediction_market_closed.sql (K1, 5 Oct 2026). Removes only the view K1 added.
-- The collector, its tables (prediction_market_snapshots / _runs), the view prediction_market_latest and cron 278 are not touched.
drop view if exists public.prediction_market_closed;
