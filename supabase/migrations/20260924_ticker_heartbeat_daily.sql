-- 2026-09-24 · M52 HEARTBEAT — every name's usual day, stored once a day.
--
-- WHY. Alan, 24 Sep: "Normally we move five percent a day. Measured how? Okay, that's an important
-- metric. That seems to me like a range of a normal day-to-day heartbeat. That's important to track
-- everywhere. I don't think I have that on the hub much, which means I don't have it on the
-- database, which means we don't use it at all."
-- He is right. Until now the number existed only for the length of one calculation: scintillas-detect
-- worked it out from bars every time it ran, used it to decide whether a move was unusual, and threw
-- it away. Nothing could put it in a column, compare two names by it, or ask the question that makes
-- it interesting — IS THIS NAME CALMER OR WILDER THAN ITS OWN NORMAL? That needs the heartbeat to
-- have a history of its own. This table is that history.
--
-- WHAT A ROW MEANS. One name, one trading date, and the size of a typical day for it as of that date.
--   usual_day_20   the spread (standard deviation) of the last 20 daily close-to-close % moves — now
--   usual_day_60   the same over 60 sessions — the season, and the window M48's rules file judges by
--   usual_day_250  the same over 250 sessions — the year, the baseline the other two are read against
--   atr_pct_14     average true range over 14 days as a % of price: the day's WHOLE travel, gaps and
--                  wicks included, because a quiet close can hide a wild day
--   n              how many daily moves stood behind the longest window (capped at 250)
--   source         where the bars came from (chart API /candles?tf=1d)
--   version        which formula produced the row, so a later change is visible instead of silent
-- A window with fewer than 20 moves behind it is NULL, never 0: zero would read as "this name does
-- not move". Every number is a percentage, already multiplied by 100 (1.45 means ±1.45% a day).
--
-- SIGMA, STANDARD DEVIATION AND "USUAL DAY" ARE THE SAME THING. Sigma (σ) is just the symbol for
-- standard deviation. The Hub writes "usual day" and never asks the reader to learn a Greek letter.
--
-- ADDITIVE ONLY. One new table. Nothing existing is read, renamed, written or dropped; no price
-- table is touched. Reads are public (the Hub reads with the anon key); writes stay with the service
-- role, so only the heartbeat-daily edge function and the backfill can add rows.
--
-- IDEMPOTENT BY CONSTRUCTION. The primary key is (ticker, date), so re-running a day — the scheduled
-- pass, a catch-up, or the backfill overlapping itself — updates that day's row instead of adding a
-- second one.
--
-- ROLLBACK (exact): see 20260924_ticker_heartbeat_daily_ROLLBACK.sql
--     drop table public.ticker_heartbeat_daily;

create table if not exists public.ticker_heartbeat_daily (
  ticker        text        not null,
  date          date        not null,
  usual_day_20  double precision,
  usual_day_60  double precision,
  usual_day_250 double precision,
  atr_pct_14    double precision,
  n             integer     not null default 0,
  source        text        not null default 'chart-api:/candles?tf=1d',
  version       text        not null default 'hb-1',
  computed_at   timestamptz not null default now(),
  constraint ticker_heartbeat_daily_pkey primary key (ticker, date),
  -- a spread cannot be negative; a percentage above 200 a day is a broken input, not a heartbeat
  constraint thd_usual20_ck  check (usual_day_20  is null or (usual_day_20  >= 0 and usual_day_20  <= 200)),
  constraint thd_usual60_ck  check (usual_day_60  is null or (usual_day_60  >= 0 and usual_day_60  <= 200)),
  constraint thd_usual250_ck check (usual_day_250 is null or (usual_day_250 >= 0 and usual_day_250 <= 200)),
  constraint thd_atr_ck      check (atr_pct_14    is null or (atr_pct_14    >= 0 and atr_pct_14    <= 200)),
  constraint thd_n_ck        check (n >= 0)
);

-- the board asks for many names on one date; a company page asks for one name across dates
create index if not exists thd_date_idx        on public.ticker_heartbeat_daily (date desc);
create index if not exists thd_ticker_date_idx on public.ticker_heartbeat_daily (ticker, date desc);

comment on table public.ticker_heartbeat_daily is
  'One row per name per trading date: the size of a typical daily move for that name (the standard deviation of its daily close-to-close % changes) over 20, 60 and 250 sessions, plus ATR% over 14 days. Percentages, already x100. NULL where fewer than 20 sessions of history exist. Written by the heartbeat-daily edge function (service role); read publicly by the Hub.';
comment on column public.ticker_heartbeat_daily.usual_day_60 is
  'The season: the spread of the last 60 daily % moves. This is the window data/scintilla-rules.json uses to decide whether a day is unusual, so a stored heartbeat and a live scintilla agree by construction.';
comment on column public.ticker_heartbeat_daily.usual_day_250 is
  'The year. Reading usual_day_20 against this answers "is this name calmer or wilder than its own normal?" — 0.33 means it is moving a third as much as it did over the year.';
comment on column public.ticker_heartbeat_daily.atr_pct_14 is
  'Average true range over 14 days as a % of price: the whole day including the overnight gap and the wicks. Much larger than usual_day_60 means a name that travels inside the day and settles quietly.';
comment on column public.ticker_heartbeat_daily.n is
  'How many daily moves stood behind the longest window that could be filled (capped at 250). It is how a reader knows a 250-session number is real and not 30 days wearing a year''s label.';

alter table public.ticker_heartbeat_daily enable row level security;

drop policy if exists thd_read_all on public.ticker_heartbeat_daily;
create policy thd_read_all on public.ticker_heartbeat_daily for select using (true);

grant select on public.ticker_heartbeat_daily to anon, authenticated;
revoke insert, update, delete on public.ticker_heartbeat_daily from anon, authenticated;

-- THE WRITER. A table made by migration gets no default grants here, so the service role the
-- heartbeat-daily function writes with could not insert (the same miss as allocation_operator_votes
-- and the scintillas tables on 23-24 Sep). Coordinator, applied 24 Sep 2026.
grant select, insert, update on public.ticker_heartbeat_daily to service_role;
