-- ROLLBACK · R2 Part C (2 Oct 2026) · REVISIONS strip
-- Drops exactly what supabase/migrations/20261002_analyst_revisions.sql creates on branch hub/r2-revisions-20261002:
--   public.analyst_target_news          (new table, its unique constraint, its read policy)
--   public.price_target_summary_daily   (new table, its primary key, its read policy)
-- Nothing else is touched: the existing analyst tables (analyst_estimates, analyst_ratings,
-- price_target_consensus, analyst_grades) and the fmp-analyst job stay as they are.
-- Policies, constraints and grants go with their tables.
--
-- Run from the linked folder:
--   supabase db query --linked --project-ref wadinxqplrggagkvrdag "<the two lines below>"
-- The edge function is removed separately (only if Alan or the coordinator decides to retire it):
--   supabase functions delete analyst-revisions --project-ref wadinxqplrggagkvrdag

drop table if exists public.analyst_target_news;
drop table if exists public.price_target_summary_daily;
