-- SCINTILLA · L4 PREDICTION MARKETS (28 Sep 2026) — public.prediction_market_snapshots + runs log.
-- Additive only (pre-approved class): two new tables, one view, indexes, read-only RLS. Nothing existing
-- is touched; public.catalyst_odds and its cron (catalyst-odds-6h) keep running as they are.
--
-- WHAT LANDS HERE. The collector supabase/functions/prediction-markets reads every topic in its
-- topics.json from each enabled venue and appends one row per (venue, market, outcome) when the
-- probability moved >= 0.001 since the last stored row, or the last stored row is >= 6 h old
-- (kind = 'first' | 'change' | 'heartbeat'). A one-off backfill adds 7 days of Polymarket's own hourly
-- history (kind = 'backfill'). Never updated in place.
-- ROLLBACK: 20260928_prediction_market_snapshots_ROLLBACK.sql

create table if not exists public.prediction_market_snapshots (
  id             bigint generated always as identity primary key,
  ts             timestamptz  not null default now(),     -- when WE read it (backfill: the venue's own point time)
  run_id         text         not null,
  topic          text         not null,                   -- topics.json id, or 'discover'
  venue          text         not null check (venue in ('polymarket','kalshi')),
  event_id       text         not null,                   -- Polymarket event id / Kalshi event ticker
  market_id      text         not null,                   -- Polymarket market id / Kalshi market ticker
  outcome        text         not null,                   -- the venue's own label for this leg
  align_key      text         null,                       -- topics.json align key when both venues ask the same thing
  question       text         null,
  probability    numeric(6,4) not null check (probability between 0 and 1),
  bid            numeric(6,4) null,
  ask            numeric(6,4) null,
  volume         numeric      null,                       -- lifetime volume, venue units (USD on Polymarket, contracts on Kalshi)
  volume_24h     numeric      null,
  open_interest  numeric      null,                       -- Polymarket data-api /oi (USD) / Kalshi open_interest_fp (contracts)
  end_date       timestamptz  null,
  kind           text         not null default 'change' check (kind in ('first','change','heartbeat','backfill')),
  constraint prediction_market_snapshots_uniq unique (topic, venue, market_id, outcome, ts)
);

comment on table public.prediction_market_snapshots is
  'L4 prediction markets. Append-only, change-only readings of Polymarket (gamma/data-api/clob) and Kalshi (trade-api v2) public data, no API key. Topics: supabase/functions/prediction-markets/topics.json.';

create index if not exists prediction_market_snapshots_topic_ts_idx  on public.prediction_market_snapshots (topic, ts desc);
create index if not exists prediction_market_snapshots_key_ts_idx    on public.prediction_market_snapshots (topic, venue, market_id, outcome, ts desc);

create table if not exists public.prediction_market_runs (
  run_id     text primary key,
  ts         timestamptz not null default now(),
  mode       text        not null,
  version    text        null,
  read       integer     null,
  written    integer     null,
  unchanged  integer     null,
  problems   jsonb       null,
  ms         integer     null
);
comment on table public.prediction_market_runs is 'L4 prediction markets: one row per collector pass, so a pass that wrote nothing is still visible.';

-- the collector's "what did I store last" read, and the page's "now" read: latest row per leg in the
-- last 8 hours (every live leg has a heartbeat at least every 6 h)
create or replace view public.prediction_market_latest with (security_invoker = true) as
  select distinct on (topic, venue, market_id, outcome) *
  from public.prediction_market_snapshots
  where ts > now() - interval '8 hours'
  order by topic, venue, market_id, outcome, ts desc;

alter table public.prediction_market_snapshots enable row level security;
alter table public.prediction_market_runs      enable row level security;
drop policy if exists prediction_market_snapshots_read on public.prediction_market_snapshots;
create policy prediction_market_snapshots_read on public.prediction_market_snapshots for select to anon, authenticated using (true);
drop policy if exists prediction_market_runs_read on public.prediction_market_runs;
create policy prediction_market_runs_read on public.prediction_market_runs for select to anon, authenticated using (true);
grant select on public.prediction_market_snapshots, public.prediction_market_runs, public.prediction_market_latest to anon, authenticated;

-- the collector writes as service_role; on this project new tables get no default grant for it
-- (catalyst_odds carries the same explicit grant). Append-only: select + insert, no update/delete.
grant select, insert on public.prediction_market_snapshots, public.prediction_market_runs to service_role;
grant select on public.prediction_market_latest to service_role;
