-- 2026-09-24 · M59 DILUTION — rollback for 20260924_scintillas_dilution.sql.
--
-- Puts the kind list back exactly as it was. The delete must come first: the narrower constraint
-- cannot be added while dilution rows exist. It touches ONLY rows this feature wrote — no other
-- kind, and no other table, is read or changed. Afterwards the Hub simply shows no dilution glow;
-- every other scintilla is untouched, because nothing else reads these rows.

delete from public.scintillas where kind = 'dilution';

alter table public.scintillas drop constraint if exists scintillas_kind_ck;
alter table public.scintillas add constraint scintillas_kind_ck check (kind in
  ('price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust'));
