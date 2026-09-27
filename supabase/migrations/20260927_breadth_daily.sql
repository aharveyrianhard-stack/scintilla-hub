-- 2026-09-27 · B1 · WHOLE-MARKET BREADTH — one row per session per scope (ADDITIVE ONLY)
--
-- WHY. Alan, 27 Sep: "% of names above their 50-day and 200-day… I do not think we have that for the
-- market at large, and it would be good to have it." Earlier (11 Aug): "you can't measure breadth in
-- the Hub… my Hub is not the market." Every breadth number the Hub showed was measured on its own
-- list. This table holds the market's: every US common stock (scope US_COMMON) and the S&P 500
-- members as of each session (scope SP500), 2003 → today.
--
-- WHO WRITES IT. Only the edge function breadth-ingest (service role), copying what the batch job
-- published at https://scintilla-massive-chart-api.fly.dev/v1/breadth. Pages read it with anon.
-- The numbers come from Massive raw daily bars, split-adjusted by the job (runbooks/BREADTH.md in
-- scintilla-provider-massive, branch provider/breadth-20260927).
--
-- NOTHING IS DELETED, RENAMED OR OVERWRITTEN. One new table, one index, one read policy.
-- ROLLBACK: 20260927_breadth_daily_ROLLBACK.sql
create table if not exists public.breadth_daily (
  session_date     date        not null,
  scope            text        not null check (scope in ('US_COMMON','SP500')),
  advancers        integer     not null,
  decliners        integer     not null,
  unchanged        integer     not null,
  adv_volume       bigint      null,
  dec_volume       bigint      null,
  ad_line          bigint      not null,          -- running sum of (advancers - decliners) from the first row; the shape is the reading
  trin             numeric     null,              -- (adv/dec) / (adv_volume/dec_volume); null when a side is empty
  pct_above_50     numeric     null,              -- % of names with 50 sessions on file whose close is above their 50-day simple average
  members_50       integer     null,
  pct_above_200    numeric     null,
  members_200      integer     null,
  new_highs        integer     null,              -- high above the highest high of the previous 252 sessions
  new_lows         integer     null,
  members_highlow  integer     null,
  members          integer     not null,          -- names that printed today and the session before
  suspect_moves    integer     null,              -- names that moved more than 50% in a day (a missed split looks like this)
  source           text        not null,
  computed_utc     timestamptz not null,
  primary key (session_date, scope)
);

comment on table public.breadth_daily is
  'B1 27 Sep 2026 — whole-market breadth per session: US common stocks and the S&P 500 (point-in-time members). Written only by edge function breadth-ingest from the chart API /v1/breadth.';

create index if not exists breadth_daily_scope_date_idx on public.breadth_daily (scope, session_date desc);

alter table public.breadth_daily enable row level security;
drop policy if exists breadth_daily_read on public.breadth_daily;
create policy breadth_daily_read on public.breadth_daily for select to anon, authenticated using (true);
