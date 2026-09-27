-- Rollback of 20260927_admission_v2_role.sql. Run AFTER the tickers rollback and AFTER the FMP
-- loaders are back on their previous versions (they read fmp_full_universe once switched).
drop view if exists public.fmp_full_universe;
alter table public.tickers drop constraint if exists tickers_role_check;
alter table public.tickers drop column if exists role;
