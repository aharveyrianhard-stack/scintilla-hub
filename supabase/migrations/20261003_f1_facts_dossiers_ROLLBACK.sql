-- Rollback of 20261003_f1_facts_dossiers.sql: removes only the rows it added (tag FACTS:f1-v1) and the READ blocks read-engine
-- derived from them (none of these names had business/catalysts/watch blocks before the load — measured 2026-10-03T16:19:40.557Z).
delete from public.read_blocks where section in ('business','catalysts','watch') and ticker in (select ticker from public.ticker_context where enrich_sources = 'FACTS:f1-v1');
update public.ticker_context set business_now = null, catalysts = null, watch_notes = null, sources = null, enrich_sources = null, enriched_ts = null, updated_ts = null where enrich_sources = 'FACTS:f1-v1' and ticker in ($f1$ABBV$f1$, $f1$ABT$f1$, $f1$BAC$f1$, $f1$BRK-B$f1$, $f1$PEP$f1$, $f1$PFE$f1$, $f1$TMO$f1$);
delete from public.ticker_context where enrich_sources = 'FACTS:f1-v1';
