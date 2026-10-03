-- ROLLBACK · R3 (2 Oct 2026, night) · earnings-estimate revisions
-- Drops exactly what supabase/migrations/20261002_analyst_estimates_daily.sql creates on branch hub/r3-revisions-history-20261002:
--   public.analyst_estimates_daily   (new table, its primary key, its read policy, its grants)
-- Nothing else is touched: public.analyst_estimates (written by fmp-analyst every 4 h), analyst_target_news,
-- price_target_summary_daily and every cron stay as they are. The function's mode=estimates then fails with
-- "relation does not exist" until redeployed as v1 — no other mode reads this table.
--
-- Run from the linked folder:
--   supabase db query --linked --project-ref wadinxqplrggagkvrdag "drop table if exists public.analyst_estimates_daily;"
-- To also return the function to v1: deploy supabase/functions/analyst-revisions from origin/hub/release-20260923 (6af9c2c).

drop table if exists public.analyst_estimates_daily;
