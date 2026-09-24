-- ROLLBACK for 20260924_universe_admit_membership.sql.
--
-- It removes ONLY the rows that migration inserted, identified by the source stamp it wrote and by
-- the exact ticker list. No other membership row, favourite, cohort, view or price is touched, and
-- nothing acquired for these names is affected: a rolled-back name keeps every bar it earned.
--
-- Removing a favourite and a membership row does NOT hide a name that is already live in the
-- universe — that is `expansion-admit.mjs --rollback` (active=false plus the membership object), and
-- it is a separate step, in the other direction.

delete from public.ticker_membership
where source = 'universe expansion 2026-09-24 (M57)'
  and ticker in ('KRE', 'KIE', 'ITB', 'REZ', 'BJK', 'IHI', 'IYT', 'FDN', 'XBI', 'IGV', 'CIBR', 'URA', 'ARKX', 'BOTZ', 'LIT', 'REMX', 'JETS', 'PEJ', 'TAN', 'QTUM', 'FINX', 'ITA', 'PAVE', 'XSD', 'AAOI', 'ACHR', 'ALB', 'AMKR', 'AVAV', 'BKSY', 'BTDR', 'CLSK', 'COHR', 'CRML', 'GLW', 'HIVE', 'HUBB', 'KTOS', 'LEU', 'LUNR', 'NOK', 'NVTS', 'OUST', 'PL', 'POET', 'RDW', 'RIOT', 'SATL', 'SERV', 'SIDU', 'SIVE', 'SPIR', 'SQM', 'STM', 'SYM', 'TECK', 'TMRC', 'TSEM', 'UUUU', 'VSH');

delete from public.hub_favorites
where owner_id = '00000000-0000-0000-0000-000000000000'::uuid
  and ticker in ('AAOI', 'ACHR', 'ALB', 'AMKR', 'AVAV', 'BKSY', 'BTDR', 'CLSK', 'COHR', 'CRML', 'GLW', 'HIVE', 'HUBB', 'KTOS', 'LUNR', 'NOK', 'NVTS', 'OUST', 'PL', 'RDW', 'RIOT', 'SATL', 'SERV', 'SIDU', 'SIVE', 'SPIR', 'SQM', 'STM', 'SYM', 'TECK', 'TMRC', 'TSEM', 'UUUU', 'VSH');
