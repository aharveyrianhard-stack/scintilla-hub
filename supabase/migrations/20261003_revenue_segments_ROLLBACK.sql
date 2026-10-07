-- Rollback of 20261003_revenue_segments.sql (C5, 3 Oct 2026). Drops the table and its policy; nothing else depends on it.
drop policy if exists revenue_segments_anon_read on public.revenue_segments;
drop table if exists public.revenue_segments;
