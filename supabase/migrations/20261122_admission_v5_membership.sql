-- ADMISSION V5 (22 Nov 2026) — General Mills (GIS), Hershey (HSY), Kraft Heinz (KHC) become FULL board names.
-- Alan, 22 Nov (relayed by his markets session): "fully on the Hub, with the same data as every other board name".
--
-- Their Hub group rows: the same five kinds a served staples name carries today (read 22 Nov for MDLZ):
--   cohort STAPLES   the home cohort (tickers.cohort, written by 20261122_admission_v5_tickers.sql)
--   cohort DEFENSIVE Alan's DEFENSIVES board (21 Nov list "where money hides in a sell-off"; until now they were light
--                    rows from the page constant COH_LITE, which skips any name on the Hub, so nothing is drawn twice)
--   sector STAPLES   with its XLP weight in % (FMP /stable/etf/holdings for XLP, updated 2026-11-21 17:46)
--   industry         the FMP company industry (profile read 22 Nov: GIS and KHC Packaged Foods, HSY Food Confectioners)
--   size LARGE_CAP   FMP market cap 22 Nov: GIS 19.1bn, HSY 35.3bn, KHC 30.1bn (large >= 10bn, mega >= 200bn)
--
-- ADDITIVE: on conflict do nothing (primary key ticker, group_key, kind). Every row carries the source prefix
-- 'admission-v5-gis-hsy-khc-20261122', so the rollback file deletes these 15 rows and nothing else.
-- ORDER: run right AFTER 20261122_admission_v5_tickers.sql. The view ticker_cohorts joins tickers.active, so
-- rows written before the tickers rows exist are invisible (harmless either way).
insert into public.ticker_membership (ticker, group_key, kind, weight, source)
values
  ('GIS', 'STAPLES',            'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · home cohort on tickers.cohort'),
  ('HSY', 'STAPLES',            'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · home cohort on tickers.cohort'),
  ('KHC', 'STAPLES',            'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · home cohort on tickers.cohort'),
  ('GIS', 'DEFENSIVE',          'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · Alan 21 Nov: where money hides in a sell-off · consumer staples'),
  ('HSY', 'DEFENSIVE',          'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · Alan 21 Nov: where money hides in a sell-off · consumer staples'),
  ('KHC', 'DEFENSIVE',          'cohort',   null,       'admission-v5-gis-hsy-khc-20261122 · Alan 21 Nov: where money hides in a sell-off · consumer staples'),
  ('GIS', 'STAPLES',            'sector',   1.074,      'admission-v5-gis-hsy-khc-20261122 · XLP holdings via FMP /stable/etf/holdings'),
  ('HSY', 'STAPLES',            'sector',   1.484,      'admission-v5-gis-hsy-khc-20261122 · XLP holdings via FMP /stable/etf/holdings'),
  ('KHC', 'STAPLES',            'sector',   1.257,      'admission-v5-gis-hsy-khc-20261122 · XLP holdings via FMP /stable/etf/holdings'),
  ('GIS', 'PACKAGED_FOODS',     'industry', null,       'admission-v5-gis-hsy-khc-20261122 · FMP company industry - the sub-sector beneath its sector'),
  ('HSY', 'FOOD_CONFECTIONERS', 'industry', null,       'admission-v5-gis-hsy-khc-20261122 · FMP company industry - the sub-sector beneath its sector'),
  ('KHC', 'PACKAGED_FOODS',     'industry', null,       'admission-v5-gis-hsy-khc-20261122 · FMP company industry - the sub-sector beneath its sector'),
  ('GIS', 'LARGE_CAP',          'size',     null,       'admission-v5-gis-hsy-khc-20261122 · company_profile.market_cap: mega >=200bn, large >=10bn, mid >=2bn, small below'),
  ('HSY', 'LARGE_CAP',          'size',     null,       'admission-v5-gis-hsy-khc-20261122 · company_profile.market_cap: mega >=200bn, large >=10bn, mid >=2bn, small below'),
  ('KHC', 'LARGE_CAP',          'size',     null,       'admission-v5-gis-hsy-khc-20261122 · company_profile.market_cap: mega >=200bn, large >=10bn, mid >=2bn, small below')
on conflict (ticker, group_key, kind) do nothing;

-- PROOF: all fifteen rows are present under this sitting's stamp, and the three names sit on the DEFENSIVES board.
do $$
declare n int; d int;
begin
  select count(*) into n from public.ticker_membership where source like 'admission-v5-gis-hsy-khc-20261122%';
  if n <> 15 then raise exception 'admission v5 membership: expected 15 rows, found %', n; end if;
  select count(*) into d from public.ticker_cohorts where cohort = 'DEFENSIVE' and ticker in ('GIS', 'HSY', 'KHC');
  if d <> 3 then raise exception 'admission v5 membership: expected GIS HSY KHC on DEFENSIVE (needs the tickers rows first), found %', d; end if;
end $$;
