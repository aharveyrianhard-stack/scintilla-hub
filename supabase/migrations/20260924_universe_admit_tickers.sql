-- 2026-09-24 · M66 UNIVERSE ADMIT — the Hub's own list of names.
--
-- WHY THIS FILE EXISTS. The M57 migration writes public.ticker_membership (the taxonomy behind
-- ticker_cohorts). It does NOT write public.tickers, and public.tickers is what the Hub actually
-- tracks: the `cohorts` view the board reads is that table row-for-row (measured 2026-09-24:
-- both 389 rows, identical sets), and supabase/functions/read-engine/index.ts derives its whole
-- universe from it. Without these rows the 56 admitted names would carry a price and a Geiger
-- reading from the chart API and NOTHING else on the Hub: no profile, no fundamentals, no
-- earnings, no estimates, no cohort, no read block — because every one of those pipelines walks
-- this table. Measured before writing: 0 of 56 have a row here, and 0 of 56 have a row in any of
-- the twelve Hub pillars.
--
-- ADDITIVE ONLY, and idempotent: every insert is guarded by NOT EXISTS. It changes no existing
-- row, no view, no job, no price and no favourite. The rollback is the companion file.
--
-- TWO JUDGEMENT CALLS, STATED OUT LOUD:
--  1. COHORT FOR THE 24 FUNDS. The taxonomy calls them SECTOR_AND_THEME_FUNDS, which is not one of
--     the Hub's declared cohorts, and public.tickers has no row with a null cohort. They are
--     written as THEMATIC, which is where thematic ETFs already live and which adds NO new tab.
--     They will therefore appear on the THEMATIC tab as well as ALL. If Alan wants them on their
--     own tab, or left out of THEMATIC, that is one UPDATE and it is his call.
--  2. TYPE. The 24 funds are written type='etf', the same value SPY, SMH and XLK carry, so they
--     stay inside the read engine's equity universe (its filter excludes crypto, future, index and
--     rate — never etf). The 32 operating companies are written type=null like AAPL.
--
-- AFTER RUNNING IT, the read engine's universe digest must equal the admitted identity exactly:
--   0c2abd57a836845ee120eba1e465cdb61db6a2cca5b3da1fcecbdc591936bb20  (420 names)
-- If it does not, stop: the Hub's list and the provider's list have diverged.

insert into public.tickers (ticker, cohort, type, active)
select v.ticker, v.cohort, v.type, true
from (values
  ('AAOI','AI_HARDWARE',null),
  ('ACHR','THEMATIC',null),
  ('ALB','MATERIALS',null),
  ('AMKR','AI_HARDWARE',null),
  ('ARKX','THEMATIC','etf'),
  ('AVAV','THEMATIC',null),
  ('BKSY','THEMATIC',null),
  ('BOTZ','THEMATIC','etf'),
  ('BTDR','CRYPTO',null),
  ('CIBR','THEMATIC','etf'),
  ('COHR','AI_HARDWARE',null),
  ('CRML','THEMATIC',null),
  ('FDN','THEMATIC','etf'),
  ('FINX','THEMATIC','etf'),
  ('GLW','AI_HARDWARE',null),
  ('HIVE','CRYPTO',null),
  ('HUBB','BLUE_CHIP',null),
  ('IGV','THEMATIC','etf'),
  ('IHI','THEMATIC','etf'),
  ('ITA','THEMATIC','etf'),
  ('ITB','THEMATIC','etf'),
  ('IYT','THEMATIC','etf'),
  ('JETS','THEMATIC','etf'),
  ('KIE','THEMATIC','etf'),
  ('KRE','THEMATIC','etf'),
  ('KTOS','THEMATIC',null),
  ('LEU','THEMATIC',null),
  ('LIT','THEMATIC','etf'),
  ('LUNR','THEMATIC',null),
  ('NOK','AI_HARDWARE',null),
  ('NVTS','AI_HARDWARE',null),
  ('OUST','THEMATIC',null),
  ('PAVE','THEMATIC','etf'),
  ('PEJ','THEMATIC','etf'),
  ('PL','THEMATIC',null),
  ('POET','AI_HARDWARE',null),
  ('QTUM','THEMATIC','etf'),
  ('RDW','THEMATIC',null),
  ('REMX','THEMATIC','etf'),
  ('REZ','THEMATIC','etf'),
  ('RIOT','CRYPTO',null),
  ('SATL','THEMATIC',null),
  ('SERV','THEMATIC',null),
  ('SIDU','THEMATIC',null),
  ('SPIR','THEMATIC',null),
  ('SQM','MATERIALS',null),
  ('STM','AI_HARDWARE',null),
  ('SYM','THEMATIC',null),
  ('TAN','THEMATIC','etf'),
  ('TECK','MATERIALS',null),
  ('TSEM','AI_HARDWARE',null),
  ('URA','THEMATIC','etf'),
  ('UUUU','THEMATIC',null),
  ('VSH','AI_HARDWARE',null),
  ('XBI','THEMATIC','etf'),
  ('XSD','THEMATIC','etf')
) as v(ticker, cohort, type)
where not exists (select 1 from public.tickers t where t.ticker = v.ticker);

-- PROOF, not hope: 420 active equity names after this runs.
do $$
declare n int;
begin
  select count(*) into n from public.tickers
   where active = true and (type is null or type not in ('crypto','future','index','rate'));
  if n <> 420 then
    raise exception 'universe admit: expected 420 active equity names, found %', n;
  end if;
end $$;
