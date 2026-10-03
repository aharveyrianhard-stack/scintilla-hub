-- R3 (2 Oct 2026, night) · earnings-estimate revisions beside price-target revisions.
-- Alan, 2 Oct: "Are we tracking revisions in the actual earnings estimates? It sounds like they're revising earnings up but prices down."
-- public.analyst_estimates keeps no history: fmp-analyst deletes and rewrites each stock's rows every 4 hours. This table keeps
-- one copy a New York day of FMP's analyst-estimates per Hub stock, so the ESTIMATES tab can say FY+1 / FY+2 EPS and revenue
-- now against 30 / 60 / 90 days ago.
-- Additive only: one NEW table. No existing table, column, constraint or row is changed.
-- Writer: edge function analyst-revisions v2, ?mode=estimates (service role). Reader: the Hub's ESTIMATES tab (anon).
-- Rollback: supabase/migrations/20261002_analyst_estimates_daily_ROLLBACK.sql
--   (copy: /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-analyst_estimates_daily-20261002.sql)

create table if not exists public.analyst_estimates_daily (
  ticker            text    not null,
  period            text    not null check (period in ('annual','quarter')),
  fiscal_date       date    not null,
  as_of_date        date    not null,                 -- the New York day the estimate was read (for seeded rows: the day fmp-analyst last wrote it)
  revenue_avg       numeric,
  revenue_low       numeric,
  revenue_high      numeric,
  ebitda_avg        numeric,
  net_income_avg    numeric,
  eps_avg           numeric,
  eps_low           numeric,
  eps_high          numeric,
  analysts_revenue  integer,
  analysts_eps      integer,
  source            text    not null default 'fmp',   -- 'fmp' (a live read) or 'r2:<key>' (rebuilt from an old mirror copy of analyst_estimates)
  fetched_utc       timestamptz not null default now(),
  primary key (ticker, period, fiscal_date, as_of_date)
);
comment on table public.analyst_estimates_daily is
  'R3 (2 Oct 2026): one snapshot per Hub stock per New York day of FMP analyst-estimates (annual + quarter, the periods near today). Writer: edge function analyst-revisions ?mode=estimates. Reader: Hub ESTIMATES tab (EPS / revenue now vs 30 / 60 / 90 days ago).';

alter table public.analyst_estimates_daily enable row level security;
create policy analyst_estimates_daily_read on public.analyst_estimates_daily for select to anon, authenticated using (true);
revoke all on table public.analyst_estimates_daily from anon, authenticated;
grant select on table public.analyst_estimates_daily to anon, authenticated;
grant select, insert, update on table public.analyst_estimates_daily to service_role;
