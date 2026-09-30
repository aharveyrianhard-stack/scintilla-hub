-- 2026-09-30 · C2 COMPS TAB — rollback for 20260930_comps_decisions.sql.
-- Removes the decisions table and its policies. Nothing else depended on it; the COMPS tab falls back to the browser's
-- own storage and says so on the page, so no screen goes blank. The decisions stored in the table are lost with it:
-- export them first if they matter (select * from public.comps_decisions order by set_at).
drop policy if exists comps_decisions_read_all on public.comps_decisions;
drop policy if exists comps_decisions_insert_anon on public.comps_decisions;
drop table if exists public.comps_decisions;
