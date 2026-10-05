-- ROLLBACK for 20260924_scintillas_backfill.sql (M68).
-- Drops only what that migration created. No stored event is touched: the view holds no data of its
-- own, and the index is only a lookup path. Backfilled rows, if any were written, stay in
-- public.scintillas and can be removed separately with:
--     delete from public.scintillas where (detail->>'backfilled')::boolean is true;
-- That delete is NOT part of this rollback, because deleting stored events needs Alan's word.
drop view  if exists public.scintilla_breadth_daily;
drop index if exists public.scintillas_session_idx;
