-- ROLLBACK of 20261122_admission_v5_membership.sql: removes the fifteen GIS / HSY / KHC group rows written
-- under this sitting's stamp, and nothing else (no other writer uses the 'admission-v5-gis-hsy-khc-20261122' prefix).
-- Run it BEFORE 20261122_admission_v5_tickers_ROLLBACK.sql when unwinding the sitting.
delete from public.ticker_membership where source like 'admission-v5-gis-hsy-khc-20261122%';
do $$
declare n int;
begin
  select count(*) into n from public.ticker_membership where source like 'admission-v5-gis-hsy-khc-20261122%';
  if n <> 0 then raise exception 'admission v5 membership rollback: % rows remain', n; end if;
  raise notice 'admission v5 membership rollback: 0 rows remain under the v5 stamp';
end $$;
