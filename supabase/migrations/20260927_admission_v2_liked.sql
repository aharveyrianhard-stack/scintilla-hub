-- 2026-09-27 · ADMISSION V2 — the 56 FULL names on LIKED.
-- Alan (27 Sep): "give them the full treatment and throw them on LIKED; from there I route".
-- LIKED is public.hub_favorites for the global owner (the board key FAV). Measured 27 Sep: 72 rows,
-- none of these 56. ADDITIVE: NOT EXISTS-guarded, so a name Alan likes in the meantime is untouched.
-- Run after 20260927_admission_v2_tickers.sql, in the same window. Rollback: _liked_ROLLBACK.sql.
insert into public.hub_favorites (ticker)
select v.ticker
from unnest(array[
  'AAOI','ACHR','ALB','AMKR','ARKX','AVAV','BKSY','BOTZ','BTDR','CIBR','COHR','CRML','FDN','FINX',
  'GLW','HIVE','HUBB','IGV','IHI','ITA','ITB','IYT','JETS','KIE','KRE','KTOS','LEU','LIT','LUNR',
  'NOK','NVTS','OUST','PAVE','PEJ','PL','POET','QTUM','RDW','REMX','REZ','RIOT','SATL','SERV',
  'SIDU','SPIR','SQM','STM','SYM','TAN','TECK','TSEM','URA','UUUU','VSH','XBI','XSD'
]) as v(ticker)
where not exists (select 1 from public.hub_favorites f
                   where f.ticker = v.ticker and f.owner_id = '00000000-0000-0000-0000-000000000000');

do $$
declare n int;
begin
  select count(*) into n from public.hub_favorites
   where owner_id = '00000000-0000-0000-0000-000000000000'
     and ticker in ('AAOI','ACHR','ALB','AMKR','ARKX','AVAV','BKSY','BOTZ','BTDR','CIBR','COHR','CRML','FDN','FINX',
       'GLW','HIVE','HUBB','IGV','IHI','ITA','ITB','IYT','JETS','KIE','KRE','KTOS','LEU','LIT','LUNR',
       'NOK','NVTS','OUST','PAVE','PEJ','PL','POET','QTUM','RDW','REMX','REZ','RIOT','SATL','SERV',
       'SIDU','SPIR','SQM','STM','SYM','TAN','TECK','TSEM','URA','UUUU','VSH','XBI','XSD');
  if n <> 56 then raise exception 'admission v2 liked: expected 56 of the FULL names on LIKED, found %', n; end if;
end $$;
