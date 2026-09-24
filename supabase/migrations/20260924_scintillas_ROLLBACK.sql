-- 2026-09-24 · M42 SCINTILLAS — rollback for 20260924_scintillas.sql.
-- Removes the table and everything created with it (indexes, policy, grants go with it).
-- Nothing else in the estate reads public.scintillas, so this cannot blank a screen that
-- was working before the migration: the Hub's scintilla strip simply reports no events.
drop policy if exists scintillas_read_all on public.scintillas;
drop table if exists public.scintillas;
