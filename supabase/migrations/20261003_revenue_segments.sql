-- C5 (3 Oct 2026) · public.revenue_segments: FMP's revenue by product and by geography, the latest fiscal year per
-- company, the input of the comps business-line rule (deliverables/20261003/comps-c5/lines.mjs). Additive: a new
-- table, anon read; the job scripts/revenue-segments-sync.mjs prints the rows on Fly and the coordinator loads them.
-- Until it is loaded the tab reads deliverables/20261003/comps-c5/segments-2026-10-03.json (the same rows, dated).
-- Rollback: 20261003_revenue_segments_ROLLBACK.sql
create table if not exists public.revenue_segments (
  ticker            text        not null,
  kind              text        not null check (kind in ('product', 'geo')),
  segment           text        not null,
  revenue           numeric,
  fiscal_year       integer,
  fiscal_date       date,
  reported_currency text,
  fetched_at        timestamptz not null default now(),
  primary key (ticker, kind, segment)
);
create index if not exists revenue_segments_ticker_idx on public.revenue_segments (ticker);
alter table public.revenue_segments enable row level security;
drop policy if exists revenue_segments_anon_read on public.revenue_segments;
create policy revenue_segments_anon_read on public.revenue_segments for select to anon using (true);
grant select on public.revenue_segments to anon;
