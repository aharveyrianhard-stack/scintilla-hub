-- 2026-10-01 · C4 COMPS, THE MECHANIC — the peer sources and the industry codes the rule reads. ADDITIVE ONLY.
-- Proposed 1 Oct 2026; the coordinator applies it and loads the rows printed by scripts/peer-sources-sync.mjs (no Fly app
-- holds a Supabase service key, so the job prints and the coordinator loads, as was done for fx_rates).
--
-- peer_sources: one row per (company, peer, source): FMP's algorithmic peers (stable/stock-peers) and Massive's related
--   companies (/v1/related-companies), with the position in each list. public.fmp_peers (20261001_fmp_peers.sql) is the
--   same thing for FMP alone; the tab reads both.
-- ticker_industry: FMP's industry and sector (stable/profile) and Massive's SIC code and description (reference/tickers)
--   per served company, so "same industry" is a stored fact, not a guess from company_profile alone.

create table if not exists public.peer_sources (
  ticker     text        not null,
  peer       text        not null,
  source     text        not null check (source in ('fmp', 'massive')),
  position   integer     not null,
  fetched_at timestamptz not null default now(),
  primary key (ticker, peer, source)
);
create index if not exists peer_sources_ticker_idx on public.peer_sources (ticker, source, position);
create table if not exists public.ticker_industry (
  ticker          text primary key,
  fmp_industry    text,
  fmp_sector      text,
  sic_code        text,
  sic_description text,
  source          text        not null default 'fmp:profile+massive:reference',
  fetched_at      timestamptz not null default now()
);
comment on table public.peer_sources is 'FMP stock-peers and Massive related companies per served company; the comps mechanic''s first two sources.';
comment on table public.ticker_industry is 'FMP industry/sector and Massive SIC per served company; the comps mechanic''s industry test.';
alter table public.peer_sources enable row level security;
alter table public.ticker_industry enable row level security;
drop policy if exists peer_sources_read_all on public.peer_sources;
create policy peer_sources_read_all on public.peer_sources for select using (true);
drop policy if exists ticker_industry_read_all on public.ticker_industry;
create policy ticker_industry_read_all on public.ticker_industry for select using (true);
grant select on public.peer_sources, public.ticker_industry to anon, authenticated;
-- ROLLBACK: supabase/migrations/20261001_peer_sources_ROLLBACK.sql
