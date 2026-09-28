-- 2026-09-28 · USUAL DAY HISTORY — rollback for 20260928_sigma_history.sql.
-- Removes both tables and everything created with them. Nothing depended on them before; the Hub's USUAL DAY room
-- falls back to the detector's own store (public.scintillas, from 23 Sep) and says so, so no screen goes blank.
drop policy if exists sed_read_all on public.sigma_events_daily;
drop policy if exists sdc_read_all on public.sigma_day_counts;
drop table if exists public.sigma_events_daily;
drop table if exists public.sigma_day_counts;
