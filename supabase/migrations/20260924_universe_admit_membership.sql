-- 2026-09-24 · M57 UNIVERSE ADMIT — where the 60 new names belong, and which ones Alan starts on.
--
-- ADDITIVE ONLY. It inserts membership rows and favourites for names the expansion admitted. It
-- changes no existing row, no view, no job and no price. Every insert is guarded by NOT EXISTS, so
-- running it twice is the same as running it once. The rollback is the companion file.
--
-- WHERE THE CATEGORIES COME FROM. names.json (M53) gives each name a trunk, a branch and a cohort,
-- derived from the M54/M45 taxonomy tree. `ticker_cohorts`, which the Hub reads, is a VIEW over
-- `public.ticker_membership`, so the membership table is what has to be written.
--
-- TWO JUDGEMENT CALLS, STATED OUT LOUD:
--  1. MATERIALS (ALB, SQM, TECK) is a SECTOR key in this table, not one of the Hub's twelve declared
--     cohorts. Writing it as a cohort row would put a thirteenth tab on the strip — the exact
--     bleed-through the Hub removed in September. These three are written as kind='sector', which is
--     where MATERIALS already lives, and they still appear on the board's ALL tab.
--  2. The 24 funds carry cohort SECTOR_AND_THEME_FUNDS, which the Hub does not declare either. The
--     rows are written truthfully, because the data is true, but NO cohort tab is added: that is a
--     visible change to Alan's strip and it is his call. Until he says yes, the funds are visible on
--     ALL, in search, and on the company page; they simply have no tab of their own.
--
-- FAVOURITES. The 34 Claude Check names are the tier-2 entries that carry a mentions count in
-- names.json (the two additions LEU and POET, and the fund IGV, are not from that folder). The
-- candidate table itself is not readable with the anon role, so the list is derived from names.json;
-- cross-check with `select ticker from public.claude_check_candidates order by 1` under a role that
-- can read it before running this, if you want belt and braces.

insert into public.ticker_membership (ticker, group_key, kind, source)
select v.ticker, v.group_key, v.kind, 'universe expansion 2026-09-24 (M57)'
from (values
  ('KRE','SECTOR_AND_THEME_FUNDS','cohort'),
  ('KIE','SECTOR_AND_THEME_FUNDS','cohort'),
  ('ITB','SECTOR_AND_THEME_FUNDS','cohort'),
  ('REZ','SECTOR_AND_THEME_FUNDS','cohort'),
  ('BJK','SECTOR_AND_THEME_FUNDS','cohort'),
  ('IHI','SECTOR_AND_THEME_FUNDS','cohort'),
  ('IYT','SECTOR_AND_THEME_FUNDS','cohort'),
  ('FDN','SECTOR_AND_THEME_FUNDS','cohort'),
  ('XBI','SECTOR_AND_THEME_FUNDS','cohort'),
  ('IGV','SECTOR_AND_THEME_FUNDS','cohort'),
  ('CIBR','SECTOR_AND_THEME_FUNDS','cohort'),
  ('URA','SECTOR_AND_THEME_FUNDS','cohort'),
  ('ARKX','SECTOR_AND_THEME_FUNDS','cohort'),
  ('BOTZ','SECTOR_AND_THEME_FUNDS','cohort'),
  ('LIT','SECTOR_AND_THEME_FUNDS','cohort'),
  ('REMX','SECTOR_AND_THEME_FUNDS','cohort'),
  ('JETS','SECTOR_AND_THEME_FUNDS','cohort'),
  ('PEJ','SECTOR_AND_THEME_FUNDS','cohort'),
  ('TAN','SECTOR_AND_THEME_FUNDS','cohort'),
  ('QTUM','SECTOR_AND_THEME_FUNDS','cohort'),
  ('FINX','SECTOR_AND_THEME_FUNDS','cohort'),
  ('ITA','SECTOR_AND_THEME_FUNDS','cohort'),
  ('PAVE','SECTOR_AND_THEME_FUNDS','cohort'),
  ('XSD','SECTOR_AND_THEME_FUNDS','cohort'),
  ('AAOI','AI_HARDWARE','cohort'),
  ('ACHR','THEMATIC','cohort'),
  ('ALB','MATERIALS','sector'),
  ('AMKR','AI_HARDWARE','cohort'),
  ('AVAV','THEMATIC','cohort'),
  ('BKSY','THEMATIC','cohort'),
  ('BTDR','CRYPTO','cohort'),
  ('CLSK','CRYPTO','cohort'),
  ('COHR','AI_HARDWARE','cohort'),
  ('CRML','THEMATIC','cohort'),
  ('GLW','AI_HARDWARE','cohort'),
  ('HIVE','CRYPTO','cohort'),
  ('HUBB','BLUE_CHIP','cohort'),
  ('KTOS','THEMATIC','cohort'),
  ('LEU','THEMATIC','cohort'),
  ('LUNR','THEMATIC','cohort'),
  ('NOK','AI_HARDWARE','cohort'),
  ('NVTS','AI_HARDWARE','cohort'),
  ('OUST','THEMATIC','cohort'),
  ('PL','THEMATIC','cohort'),
  ('POET','AI_HARDWARE','cohort'),
  ('RDW','THEMATIC','cohort'),
  ('RIOT','CRYPTO','cohort'),
  ('SATL','THEMATIC','cohort'),
  ('SERV','THEMATIC','cohort'),
  ('SIDU','THEMATIC','cohort'),
  ('SIVE','AI_HARDWARE','cohort'),
  ('SPIR','THEMATIC','cohort'),
  ('SQM','MATERIALS','sector'),
  ('STM','AI_HARDWARE','cohort'),
  ('SYM','THEMATIC','cohort'),
  ('TECK','MATERIALS','sector'),
  ('TMRC','THEMATIC','cohort'),
  ('TSEM','AI_HARDWARE','cohort'),
  ('UUUU','THEMATIC','cohort'),
  ('VSH','AI_HARDWARE','cohort')
) as v(ticker, group_key, kind)
where not exists (
  select 1 from public.ticker_membership m
  where m.ticker = v.ticker and m.group_key = v.group_key and m.kind = v.kind
);

insert into public.hub_favorites (ticker, owner_id)
select v.ticker, '00000000-0000-0000-0000-000000000000'::uuid
from (values
  ('AAOI'),
  ('ACHR'),
  ('ALB'),
  ('AMKR'),
  ('AVAV'),
  ('BKSY'),
  ('BTDR'),
  ('CLSK'),
  ('COHR'),
  ('CRML'),
  ('GLW'),
  ('HIVE'),
  ('HUBB'),
  ('KTOS'),
  ('LUNR'),
  ('NOK'),
  ('NVTS'),
  ('OUST'),
  ('PL'),
  ('RDW'),
  ('RIOT'),
  ('SATL'),
  ('SERV'),
  ('SIDU'),
  ('SIVE'),
  ('SPIR'),
  ('SQM'),
  ('STM'),
  ('SYM'),
  ('TECK'),
  ('TMRC'),
  ('TSEM'),
  ('UUUU'),
  ('VSH')
) as v(ticker)
where not exists (
  select 1 from public.hub_favorites f
  where f.ticker = v.ticker and f.owner_id = '00000000-0000-0000-0000-000000000000'::uuid
);

-- WHAT TO EXPECT: 60 membership rows and 34 favourites on a first run, 0 and 0 on a second.
