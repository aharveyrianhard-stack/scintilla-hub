-- H12 01 ROLLBACK. Run only AFTER 03 and 04 are rolled back (they call this function).
drop function if exists public.scin_geiger_latest_d();
