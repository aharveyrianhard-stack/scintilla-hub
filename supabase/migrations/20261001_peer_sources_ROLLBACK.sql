-- 2026-10-01 · C4 — rollback for 20261001_peer_sources.sql. The comps mechanic then runs on the industry and fund sources
-- alone (and the dated fixture for the four test names) and says so.
drop policy if exists peer_sources_read_all on public.peer_sources;
drop policy if exists ticker_industry_read_all on public.ticker_industry;
drop table if exists public.peer_sources;
drop table if exists public.ticker_industry;
