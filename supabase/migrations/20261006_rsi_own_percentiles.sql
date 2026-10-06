-- 2026-10-06 · RS1 — every name's daily RSI, read against ITS OWN last two years.
--
-- WHY. Alan, 6 Oct ~15:25 ET: "I see Netflix at 33 and I don't think that's green enough." And ~15:55 ET, on colouring
-- RSI by each name's own extremes: "dude, that would be awesome … this is an interesting metric, playbook-level, at the
-- important levels, for the SPY, for the QQQ, for the macro … what would the RSI on the SPY and the QQQ say against
-- its own extremes?" (26 Sep, the standing rule: levels are per instrument, never one threshold for every name.)
-- The board colours RSI on a fixed 30 / 70 scale. A name that has spent two years between 40 and 70 is deeply
-- stretched at 38; a name that visits 20 every quarter is not. This table gives each name its own ruler.
--
-- WHAT A ROW MEANS. One name, as of its newest finished daily session:
--   as_of        the session the row was computed on (a settled close, never a forming bar)
--   window_from  the first day of the window: every finished session in the two calendar years BEFORE as_of (as_of is
--                the reading being judged, so it is not inside the sample it is compared with)
--   sessions     how many days stood in that window (about 501 for a stock, 729 for a 7-day series like Bitcoin)
--   eligible     true when the name has at least ONE YEAR of its own RSI (and 200+ days). False = too young for an own
--                scale: the Hub and the Station keep the usual 30 / 70 colouring for it and say so on hover.
--   rsi          Wilder's RSI(14) at the as_of close, from the chart API's finished daily bars
--   pct          where that close sat among the window's days: 0 = under its lowest day, 100 = at or over its highest
--   p10 p20 p50 p80 p90   the RSI value at its own 10th, 20th, 50th, 80th and 90th percentile
--   grid         the same for EVERY percentile, 0th to 100th (101 numbers). The page places today's moving RSI on this
--                grid in the browser, so the colour follows the live number without reading two years of bars.
--                (Alan, 28 Sep: "percentiles 1..100, not a forced 10%".)
--   source       where the bars came from          version   which formula produced the row
--
-- ONE ROW PER NAME, replaced each night (primary key ticker). It is a current index, not a history: the history is
-- the bars, and any past day can be recomputed from them.
--
-- ADDITIVE ONLY. One new table. Nothing existing is read, renamed, written or dropped; no price table is touched.
-- Reads are public (the Hub and the Station read with the anon key); writes stay with the service role
-- (supabase/functions/rsi-own-daily and scripts/rsi-own-load.mjs).
--
-- SAFE BEFORE AND AFTER. The Hub and Station code that reads this table falls back to today's 30 / 70 colouring when
-- the table is missing, empty, older than three weeks, or the name is not eligible — so the page can ship before
-- this migration is applied, and dropping the table cannot blank a cell.
--
-- ROLLBACK (exact): 20261006_rsi_own_percentiles_ROLLBACK.sql

create table if not exists public.rsi_own_percentiles (
  ticker       text             not null,
  as_of        date             not null,
  window_from  date             not null,
  sessions     integer          not null,
  eligible     boolean          not null default false,
  rsi          double precision not null,
  pct          double precision not null,
  p10          double precision not null,
  p20          double precision not null,
  p50          double precision not null,
  p80          double precision not null,
  p90          double precision not null,
  grid         double precision[] not null,
  source       text             not null default 'chart-api:/candles?tf=1d',
  version      text             not null default 'ro-1',
  computed_at  timestamptz      not null default now(),
  constraint rsi_own_percentiles_pkey primary key (ticker),
  -- an RSI and a percentile both live between 0 and 100; anything else is a broken input, not a reading
  constraint rop_rsi_ck      check (rsi >= 0 and rsi <= 100),
  constraint rop_pct_ck      check (pct >= 0 and pct <= 100),
  constraint rop_order_ck    check (p10 <= p20 and p20 <= p50 and p50 <= p80 and p80 <= p90),
  constraint rop_grid_ck     check (array_length(grid, 1) = 101),
  constraint rop_sessions_ck check (sessions >= 20),
  constraint rop_window_ck   check (window_from <= as_of)
);

-- the board asks for many names at once and only wants rows that are recent
create index if not exists rop_as_of_idx on public.rsi_own_percentiles (as_of desc);

comment on table public.rsi_own_percentiles is
  'One row per name: its daily RSI(14) read against its OWN last two calendar years of finished sessions. p10/p20/p50/p80/p90 and grid (0th..100th percentile, 101 numbers) are RSI values; pct is where the as_of close sat among those days (0 lowest, 100 highest). eligible=false means under one year of own history: readers keep the 30/70 colouring. Written nightly by the rsi-own-daily edge function (service role); replaced, not appended.';
comment on column public.rsi_own_percentiles.grid is
  'The RSI value at each percentile 0..100 of the window (index 1 = the lowest day, index 101 = the highest). A live RSI is placed on it by straight-line interpolation to get its percentile.';
comment on column public.rsi_own_percentiles.eligible is
  'True when the window spans at least 365 days and holds at least 200 sessions. False: too young for an own scale; the Hub and the Station fall back to 30 / 70 for this name.';
comment on column public.rsi_own_percentiles.pct is
  'Percentile of the as_of close''s RSI inside the window, 0..100. "Lower than N% of its last two years" is 100 - pct.';

alter table public.rsi_own_percentiles enable row level security;

-- the 2 Oct access block (20261002_analyst_estimates_daily.sql, after the Q4 access audit): the read policy names its
-- roles, everything is revoked from the public roles, then only SELECT is granted back
drop policy if exists rop_read_all on public.rsi_own_percentiles;
create policy rop_read_all on public.rsi_own_percentiles for select to anon, authenticated using (true);
revoke all on table public.rsi_own_percentiles from anon, authenticated;
grant select on table public.rsi_own_percentiles to anon, authenticated;

-- THE WRITER. A table made by migration gets no default grants here (the miss on allocation_operator_votes and the
-- scintillas tables, 23-24 Sep), so the service role the function writes with is granted explicitly.
grant select, insert, update on table public.rsi_own_percentiles to service_role;
