-- SCINTILLA · M44-REGIME — public.catalyst_odds
-- Additive only: one new table, one index, read-only RLS. Nothing existing is touched.
-- Alan asked to "start with catalysts" and to parametrise a news-driven market from the
-- public prediction markets. This is where every read lands so the odds become a LINE OVER
-- TIME instead of a number that is only true the second you look at it.
--
-- One row per (market, outcome) per read. Never updated in place: a later read is a new row,
-- so the history cannot be rewritten by the next collection.

create table if not exists public.catalyst_odds (
  id           bigint generated always as identity primary key,
  ts           timestamptz  not null default now(),   -- when WE read it
  source       text         not null,                 -- 'polymarket' | 'kalshi'
  catalyst     text         not null,                 -- fomc | cpi | recession | midterms_house | midterms_senate | shutdown
  market       text         not null,                 -- venue's own id: slug or ticker
  question     text         null,                     -- the venue's wording, kept verbatim
  outcome      text         not null,                 -- the leg this probability belongs to
  probability  numeric(6,4) not null check (probability >= 0 and probability <= 1),
  volume       numeric      null,                     -- venue volume or open interest, as reported
  end_date     timestamptz  null,                     -- when the market resolves
  run_id       text         null,                     -- one id per collector pass
  constraint catalyst_odds_prob_is_fraction check (probability between 0 and 1)
);

comment on table public.catalyst_odds is
  'M44-REGIME. Append-only readings of public prediction markets (Polymarket gamma-api, Kalshi trade-api v2), no API key. One row per market/outcome per read.';

create index if not exists catalyst_odds_cat_ts_idx    on public.catalyst_odds (catalyst, ts desc);
create index if not exists catalyst_odds_market_ts_idx on public.catalyst_odds (market, outcome, ts desc);

alter table public.catalyst_odds enable row level security;

-- Read-only to the anon/authenticated roles, exactly like the other board tables: the Hub
-- reads it, and only the service role (the collector) can write.
drop policy if exists catalyst_odds_read on public.catalyst_odds;
create policy catalyst_odds_read on public.catalyst_odds for select to anon, authenticated using (true);

grant select on public.catalyst_odds to anon, authenticated;

-- ---- SCHEDULE (written, NOT applied — the coordinator schedules) --------------------------
-- The collector is supabase/functions/catalyst-odds. Four reads a day is plenty for odds that
-- move on news, and it keeps both venues well inside their free public limits.
--   select cron.schedule('catalyst-odds-6h', '7 */6 * * *', $$
--     select net.http_post(
--       url     := 'https://<project>.functions.supabase.co/catalyst-odds',
--       headers := jsonb_build_object('Authorization','Bearer '||current_setting('app.service_key',true),
--                                     'Content-Type','application/json'),
--       body    := '{}'::jsonb) $$);

-- ---- ROLLBACK ------------------------------------------------------------------------------
-- drop policy if exists catalyst_odds_read on public.catalyst_odds;
-- drop index if exists public.catalyst_odds_market_ts_idx;
-- drop index if exists public.catalyst_odds_cat_ts_idx;
-- drop table if exists public.catalyst_odds;
-- (and, if it was scheduled: select cron.unschedule('catalyst-odds-6h');)
