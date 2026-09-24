-- ROLLBACK for 20260924_scintillas_index_change.sql (M63). Removes only what that feature wrote.
delete from public.scintillas where kind = 'index_change';
alter table public.scintillas drop constraint scintillas_kind_ck;
alter table public.scintillas add constraint scintillas_kind_ck check (kind in
  ('price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust','dilution'));
