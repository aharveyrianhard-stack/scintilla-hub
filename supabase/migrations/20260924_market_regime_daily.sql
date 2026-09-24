-- SCINTILLA · M44-REGIME — public.market_regime_daily
-- Additive only: one new table, read-only RLS. One row per day: is this a rising tide, and why.
-- Lane M39 (allocation) READS this table, so the column names below are the contract. They are
-- published at the top of the deliverable and must not be renamed without telling that lane.
--
-- Every measure is stored beside the number it was computed from, so a later reader can tell a
-- stale input from a wrong formula.

create table if not exists public.market_regime_daily (
  date                    date        primary key,       -- the ET session the read describes
  tide                    text        not null check (tide in ('RISING','MIXED','FALLING')),
  score                   numeric(6,2) not null,          -- -100..+100, positive = broad tide rising
  paragraph               text        null,               -- the plain-words read shown on the page

  curve_2s10s_bp          numeric     null,               -- 10-year minus 2-year, basis points
  curve_3m10y_bp          numeric     null,               -- 10-year minus 3-month, basis points
  curve_state             text        null,               -- STEEPENING | FLATTENING | INVERTED | FLAT
  curve_asof              timestamptz null,               -- the newest point in the curve used

  breadth_rsp_spy_63d     numeric     null,               -- equal weight minus cap weight, % over 63 sessions
  credit_hyg_spy_63d      numeric     null,               -- high yield minus the index, % over 63 sessions
  credit_hy_oas           numeric     null,               -- ICE BofA US HY option-adjusted spread, %
  froth_score             numeric     null,               -- 0..100 composite, 100 = frothiest measured
  liquidity_usd_tn        numeric     null,               -- global liquidity proxy, US$ trillions
  liquidity_yoy_pct       numeric     null,               -- its year-on-year change
  liquidity_lead_r        numeric     null,               -- correlation at the best lead, with the market
  liquidity_lead_months   int         null,               -- which lead that was

  cycle_year              int         null,               -- 1..4 of the presidential cycle (2026 = 2)
  cycle_month_mean_pct    numeric     null,               -- this month's long-run mean, same index
  cycle_sample_n          int         null,               -- how many observations that mean rests on

  catalysts               jsonb       null,               -- [{catalyst, probability, source, market}]
  inputs                  jsonb       null,               -- every raw input with its own timestamp
  formula_version         text        not null default 'regime-1.0.0',
  computed_utc            timestamptz not null default now()
);

comment on table public.market_regime_daily is
  'M44-REGIME. One row per session: rising tide or not, and the measures behind it. Read by lane M39 (allocation). Column names are a contract.';

alter table public.market_regime_daily enable row level security;
drop policy if exists market_regime_daily_read on public.market_regime_daily;
create policy market_regime_daily_read on public.market_regime_daily for select to anon, authenticated using (true);
grant select on public.market_regime_daily to anon, authenticated;

-- ---- ROLLBACK ------------------------------------------------------------------------------
-- drop policy if exists market_regime_daily_read on public.market_regime_daily;
-- drop table if exists public.market_regime_daily;
