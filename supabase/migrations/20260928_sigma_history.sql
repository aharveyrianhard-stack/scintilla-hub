-- 2026-09-28 · USUAL DAY HISTORY — every past day a name moved beyond its own usual day, measured close to close.
--
-- WHY. Alan, 28 Sep: "Why do we have such little history when we have such a complete database? These are
-- candidates for scintillation." and "Shouldn't this just be measured versus previous day close?"
-- public.scintillas (the live detector's store) began on 23 Sep and keeps the FIRST minute a move crossed the line.
-- These two tables hold the whole history, measured on each day's CLOSE against the previous CLOSE with the same
-- rules file (data/scintilla-rules.json), from the daily bars the chart API serves (back to 11 Sep 2003).
--
-- WHAT A ROW MEANS.
--   sigma_events_daily  one name, one day that fired: close, previous close, the move, the usual day it was judged
--                       against (the spread of the 60 moves BEFORE that day), how many usual days the move was, the
--                       direction and which family fired (statistical, raw, or both).
--   sigma_day_counts    one date across every name: how many names had a usual day that date (names_measured), how
--                       many fired, how many up and how many down. A quiet day is a stored zero, never a missing row,
--                       so a percentile of "today" against its own history has an honest denominator.
--
-- ADDITIVE ONLY. Two new tables; nothing existing is read, renamed, written or dropped; no price table is touched.
-- Reads are public (the Hub reads with the anon key); writes stay with the service role (scripts/sigma-history-backfill.mjs).
-- IDEMPOTENT: primary keys (ticker, date) and (date), so a re-run updates rows instead of adding them.
--
-- ROLLBACK (exact): 20260928_sigma_history_ROLLBACK.sql

create table if not exists public.sigma_events_daily (
  ticker          text             not null,
  date            date             not null,
  close           double precision,
  prev_close      double precision,
  move_pct        double precision not null,
  usual_day_60    double precision not null,
  usual_sessions  integer          not null,
  x_usual         double precision not null,
  direction       smallint         not null,
  fired           text[]           not null default '{}',
  asset_class     text,
  rules_version   text,
  source          text             not null default 'chart-api:/candles?tf=1d',
  version         text             not null default 'sg-1',
  computed_at     timestamptz      not null default now(),
  constraint sigma_events_daily_pkey primary key (ticker, date),
  constraint sed_direction_ck check (direction in (-1, 0, 1)),
  constraint sed_usual_ck     check (usual_day_60 > 0 and usual_day_60 <= 200),
  constraint sed_sessions_ck  check (usual_sessions >= 20)
);
create index if not exists sed_date_idx        on public.sigma_events_daily (date desc);
create index if not exists sed_ticker_date_idx on public.sigma_events_daily (ticker, date desc);

create table if not exists public.sigma_day_counts (
  date            date        not null primary key,
  names_measured  integer     not null,
  n               integer     not null,
  up              integer     not null,
  dn              integer     not null,
  version         text        not null default 'sg-1',
  computed_at     timestamptz not null default now(),
  constraint sdc_counts_ck check (names_measured >= 0 and n >= 0 and up >= 0 and dn >= 0 and up + dn <= n and n <= names_measured)
);

comment on table public.sigma_events_daily is
  'One row per name per trading day whose close-to-previous-close move fired the rules file (data/scintilla-rules.json): statistical (x its usual day) or raw (a plain % floor). usual_day_60 is the spread of the 60 moves before that day. Written by scripts/sigma-history-backfill.mjs (service role); read publicly by the Hub (USUAL DAY).';
comment on table public.sigma_day_counts is
  'One row per trading date: names_measured (names with a usual day that date), n fired, up, dn. Compare across years by share (dn / names_measured) — the universe was smaller in 2003.';

alter table public.sigma_events_daily enable row level security;
alter table public.sigma_day_counts  enable row level security;
drop policy if exists sed_read_all on public.sigma_events_daily;
create policy sed_read_all on public.sigma_events_daily for select using (true);
drop policy if exists sdc_read_all on public.sigma_day_counts;
create policy sdc_read_all on public.sigma_day_counts for select using (true);
grant select on public.sigma_events_daily, public.sigma_day_counts to anon, authenticated;
revoke insert, update, delete on public.sigma_events_daily, public.sigma_day_counts from anon, authenticated;
