-- ROLLBACK · A4 (3 Oct 2026) · analyst_target_news quality columns
-- Drops exactly the three columns supabase/migrations/20261003_analyst_target_news_quality.sql adds (and their check constraint,
-- which goes with the column). No row is deleted; every other column, the unique key, the policies and grants stay as they are.
-- After it, the Hub's live ESTIMATES tab is unaffected (it never read these columns); branch hub/a3-analysts-tab-20261003 would
-- fall back to showing every row (its reader treats a missing quality as kept).
--
-- Run from the linked folder:
--   supabase db query --linked --project-ref wadinxqplrggagkvrdag "<the line below>"

alter table public.analyst_target_news drop column if exists quality, drop column if exists quality_reason, drop column if exists adj_target_checked;
