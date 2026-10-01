-- 2026-10-01 · C3 COMPS TEMPLATE — foreign filers: the reporting currency per company and FMP's daily USD rates. ADDITIVE ONLY.
-- Proposed 1 Oct 2026; the coordinator applies it, then runs scripts/fx-filer-sync.mjs on Fly (the FMP key lives there).
--
-- WHY. TSM's statements are in TWD, ASML's in EUR, BABA's in CNY; every price on the Hub is the US listing's USD price.
-- A P/E of USD price ÷ TWD EPS is 1.1x, EV = USD market value + TWD net debt is nothing, and the cohort table showed
-- +3872% for TSM. Alan, 1 Oct: "why would a TSM not have EV sales, EV EBITDA, price to sales". The comps tab converts
-- every statement figure at the rate for its statement date from these two tables; with no row it says "no USD rate on file".

create table if not exists public.filer_currency (
  ticker            text        primary key,
  reported_currency text        not null,                 -- FMP income statement reportedCurrency (TWD, EUR, CNY, USD…)
  listing_currency  text,                                 -- FMP profile currency of the US listing (USD)
  is_adr            boolean,
  shares_dil        double precision,                     -- weighted average diluted shares on the newest quarter (the per-share basis)
  statement_date    date,                                 -- the newest quarter the currency was read from
  source            text        not null default 'fmp:income-statement',
  updated_at        timestamptz not null default now()
);
create table if not exists public.fx_rates (
  pair   text  not null,                                  -- e.g. TWDUSD = US dollars per one TWD
  date   date  not null,
  rate   double precision not null,
  source text  not null default 'fmp:historical-price-full',
  primary key (pair, date)
);
create index if not exists fx_rates_pair_date_idx on public.fx_rates (pair, date desc);
comment on table public.filer_currency is 'Reporting currency per served company, from FMP statements; written by scripts/fx-filer-sync.mjs.';
comment on table public.fx_rates is 'Daily USD rate per foreign currency (pair = CCYUSD, rate = USD per unit), from FMP; written by scripts/fx-filer-sync.mjs.';
alter table public.filer_currency enable row level security;
alter table public.fx_rates enable row level security;
drop policy if exists filer_currency_read_all on public.filer_currency;
create policy filer_currency_read_all on public.filer_currency for select using (true);
drop policy if exists fx_rates_read_all on public.fx_rates;
create policy fx_rates_read_all on public.fx_rates for select using (true);
grant select on public.filer_currency, public.fx_rates to anon, authenticated;
-- writes: the service role only (the Fly job); nothing in the browser writes these.
-- ROLLBACK: supabase/migrations/20261001_fx_filer_ROLLBACK.sql
