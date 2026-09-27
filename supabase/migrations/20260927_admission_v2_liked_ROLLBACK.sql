-- Rollback of 20260927_admission_v2_liked.sql. None of the 56 was liked before it (measured 27 Sep),
-- so removing them restores the prior 72. If Alan has since liked or unliked one of them by hand,
-- check with him before running this: it cannot tell his click from the migration's row.
delete from public.hub_favorites
 where owner_id = '00000000-0000-0000-0000-000000000000'
   and ticker in ('AAOI','ACHR','ALB','AMKR','ARKX','AVAV','BKSY','BOTZ','BTDR','CIBR','COHR','CRML','FDN','FINX',
     'GLW','HIVE','HUBB','IGV','IHI','ITA','ITB','IYT','JETS','KIE','KRE','KTOS','LEU','LIT','LUNR',
     'NOK','NVTS','OUST','PAVE','PEJ','PL','POET','QTUM','RDW','REMX','REZ','RIOT','SATL','SERV',
     'SIDU','SPIR','SQM','STM','SYM','TAN','TECK','TSEM','URA','UUUU','VSH','XBI','XSD');
