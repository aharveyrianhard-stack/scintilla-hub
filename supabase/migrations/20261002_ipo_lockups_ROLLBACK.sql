-- ROLLBACK · R2 Part B (UNLOCK watch), 2 Oct 2026 — written BEFORE the table was created.
-- Drops exactly what supabase/migrations/20261002_ipo_lockups.sql (Hub repo) creates: the policy, then the table (its rows go with it).
-- Nothing else was created or changed (no other table, no cron). The edge function unlock-watch is removed separately:
--   supabase functions delete unlock-watch --project-ref wadinxqplrggagkvrdag
drop policy if exists ipo_lockups_read on public.ipo_lockups;
drop table if exists public.ipo_lockups;
