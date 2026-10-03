-- R2 Part C (2 Oct 2026) · REVISIONS strip — who moved a price target or a rating, from what to what, at what price.
-- Additive only: two NEW tables. No existing table, column, constraint or row is changed.
-- Written by supabase/functions/analyst-revisions (service role). Read by the Hub's company view, ESTIMATES tab,
-- with the anon key (the same read pattern as public.prediction_market_snapshots: RLS on, one SELECT policy).
-- Rollback: supabase/migrations/20261002_analyst_revisions_ROLLBACK.sql
--   (copy: /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-analyst_target_news-20261002.sql)

-- One row per analyst action FMP reports: kind TARGET (price-target-news) or GRADE (grades-news).
create table if not exists public.analyst_target_news (
  ticker            text        not null,
  published_utc     timestamptz not null,
  kind              text        not null check (kind in ('TARGET','GRADE')),
  firm              text        not null default '',   -- '' when FMP gives no firm, so the unique key still holds
  analyst           text,
  target            numeric,                            -- TARGET rows: the new price target
  adj_target        numeric,                            -- TARGET rows: split-adjusted target (FMP adjPriceTarget)
  prior_grade       text,                               -- GRADE rows
  new_grade         text,                               -- GRADE rows
  action            text,                               -- GRADE: FMP's word (upgrade / downgrade / hold / initialise …); TARGET: read from the headline (raise / lower / initiate / reiterate) or null
  price_when_posted numeric,                            -- the stock price when the note was published (FMP priceWhenPosted)
  title             text,
  url               text,
  first_seen_utc    timestamptz not null default now(), -- when this job first stored the row (what a pass "found tonight")
  constraint analyst_target_news_uniq unique (ticker, published_utc, firm, kind)
);
comment on table public.analyst_target_news is
  'R2 Part C (2 Oct 2026): analyst price-target and rating moves from FMP price-target-news / grades-news (+ the all-ticker latest feeds), Hub stocks only. Writer: edge function analyst-revisions. Reader: Hub ESTIMATES tab REVISIONS strip.';

-- One row per stock per New York day: FMP price-target-summary, so the month / quarter / year averages can be compared and kept as history.
create table if not exists public.price_target_summary_daily (
  ticker             text    not null,
  as_of_date         date    not null,
  last_month_count   integer,
  last_month_avg     numeric,
  last_quarter_count integer,
  last_quarter_avg   numeric,
  last_year_count    integer,
  last_year_avg      numeric,
  all_time_count     integer,
  all_time_avg       numeric,
  fetched_utc        timestamptz not null default now(),
  primary key (ticker, as_of_date)
);
comment on table public.price_target_summary_daily is
  'R2 Part C (2 Oct 2026): FMP price-target-summary per Hub stock per New York day (count and average target last month / quarter / year / all time). Writer: edge function analyst-revisions. Reader: Hub ESTIMATES tab REVISIONS arrows.';

alter table public.analyst_target_news enable row level security;
alter table public.price_target_summary_daily enable row level security;
create policy analyst_target_news_read on public.analyst_target_news for select to anon, authenticated using (true);
create policy price_target_summary_daily_read on public.price_target_summary_daily for select to anon, authenticated using (true);
revoke all on table public.analyst_target_news, public.price_target_summary_daily from anon, authenticated;
grant select on table public.analyst_target_news, public.price_target_summary_daily to anon, authenticated;
grant select, insert, update on table public.analyst_target_news, public.price_target_summary_daily to service_role;
