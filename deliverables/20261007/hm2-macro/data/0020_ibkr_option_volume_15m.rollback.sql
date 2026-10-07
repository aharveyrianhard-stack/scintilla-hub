-- Rollback of 0020_ibkr_option_volume_15m.sql (HM2, 7 Oct 2026). WRITTEN BEFORE THE MIGRATION.
-- Drops the view and the table. Nothing else reads them: the put/call strip (Hub dashboard, Station tape area)
-- simply disappears when putcall_names_now cannot be read, and putcall-aggregate reports `names_error` in its
-- answer and carries on writing its minute lines exactly as before (aggregate-run.mjs never fails a run on it).
-- To take the function back as well: redeploy branch fix/putcall-20260928 @089a73d (the version live on 7 Oct).
drop view if exists public.putcall_names_now;
drop policy if exists ibkr_option_volume_15m_anon_read on public.ibkr_option_volume_15m;
drop table if exists public.ibkr_option_volume_15m;
