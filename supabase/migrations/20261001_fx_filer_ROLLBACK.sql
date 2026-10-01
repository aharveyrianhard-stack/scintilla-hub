-- 2026-10-01 · C3 — rollback for 20261001_fx_filer.sql. Removes the two tables; the comps tab then shows foreign filers
-- unconverted with "no USD rate on file" on the row, as before. Nothing else depends on them.
drop policy if exists filer_currency_read_all on public.filer_currency;
drop policy if exists fx_rates_read_all on public.fx_rates;
drop table if exists public.fx_rates;
drop table if exists public.filer_currency;
