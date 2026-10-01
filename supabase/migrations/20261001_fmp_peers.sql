-- 2026-10-01 · C3b COMPS, TABLE FIRST — FMP's own peer list per served company. ADDITIVE ONLY.
-- Proposed 1 Oct 2026; the coordinator applies it, then runs scripts/fmp-peers-sync.mjs on Fly (the FMP key lives there).
-- Alan, 1 Oct: "we pulled the comp set from FMP… let's at least check the FMP one." The COMPS tab offers it as one of the
-- peer sets on its switch; until rows exist the switch says "not on hand".
create table if not exists public.fmp_peers (
  ticker     text        not null,                        -- the served company
  peer       text        not null,                        -- a peer FMP names (may not be served on the Hub; the tab says so)
  position   integer     not null,                        -- FMP's order, 1..n
  source     text        not null default 'fmp:stock_peers',
  fetched_at timestamptz not null default now(),
  primary key (ticker, peer)
);
create index if not exists fmp_peers_ticker_idx on public.fmp_peers (ticker, position);
comment on table public.fmp_peers is 'FMP stock_peers per served company (v4 /stock_peers), written by scripts/fmp-peers-sync.mjs; the COMPS tab offers it as a peer set.';
alter table public.fmp_peers enable row level security;
drop policy if exists fmp_peers_read_all on public.fmp_peers;
create policy fmp_peers_read_all on public.fmp_peers for select using (true);
grant select on public.fmp_peers to anon, authenticated;
-- writes: the service role only (the Fly job). ROLLBACK: supabase/migrations/20261001_fmp_peers_ROLLBACK.sql
