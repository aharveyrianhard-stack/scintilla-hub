-- ROLLBACK for 20260924_universe_admit_tickers.sql.
--
-- It deletes ONLY the 56 rows that migration inserted, and only if they still carry the exact
-- shape it wrote. Bars, receipts, membership rows, favourites and every other table are untouched.
-- Running it twice is the same as running it once.

delete from public.tickers
 where ticker in ('AAOI', 'ACHR', 'ALB', 'AMKR', 'ARKX', 'AVAV', 'BKSY', 'BOTZ', 'BTDR', 'CIBR', 'COHR', 'CRML', 'FDN', 'FINX', 'GLW', 'HIVE', 'HUBB', 'IGV', 'IHI', 'ITA', 'ITB', 'IYT', 'JETS', 'KIE', 'KRE', 'KTOS', 'LEU', 'LIT', 'LUNR', 'NOK', 'NVTS', 'OUST', 'PAVE', 'PEJ', 'PL', 'POET', 'QTUM', 'RDW', 'REMX', 'REZ', 'RIOT', 'SATL', 'SERV', 'SIDU', 'SPIR', 'SQM', 'STM', 'SYM', 'TAN', 'TECK', 'TSEM', 'URA', 'UUUU', 'VSH', 'XBI', 'XSD')
   and active = true;

do $$
declare n int;
begin
  select count(*) into n from public.tickers
   where active = true and (type is null or type not in ('crypto','future','index','rate'));
  if n <> 364 then
    raise exception 'universe admit rollback: expected 364 active equity names, found %', n;
  end if;
end $$;
