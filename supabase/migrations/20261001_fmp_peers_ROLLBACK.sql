-- 2026-10-01 · C3b — rollback for 20261001_fmp_peers.sql. Removes the table; the COMPS tab's switch says "FMP peers: not on hand".
drop policy if exists fmp_peers_read_all on public.fmp_peers;
drop table if exists public.fmp_peers;
