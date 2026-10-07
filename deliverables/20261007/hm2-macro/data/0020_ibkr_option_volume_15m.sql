-- 0020 · HM2, 7 Oct 2026 · every name's option volume at each quarter-hour, and today against its usual day.
--
-- Alan, 7 Oct: "how do I start tracking this? I don't trade options, but it's important to understand how they're
-- moving … it's like a two-factor thing — it can move because one or the other moved."
--
-- WHAT WAS MISSING. The reader already lands every name's running call and put totals in ibkr_option_volume (9.8
-- million readings since 24 Sep), and putcall-aggregate turns them into minute LINES for the two headline scopes,
-- the cohorts and the sectors. Nothing kept the NAMES at a fixed clock time, so "calls today against calls on a
-- usual day by now" could not be asked without re-reading millions of rows.
--
-- WHAT THIS ADDS (additive: one table, one view, nothing altered):
--   public.ibkr_option_volume_15m   one row per name per quarter-hour mark of the session (09:45 … 15:45 New York,
--                                   and the last minute as 16:00). Written by putcall-aggregate, same as-of rule as
--                                   the minute lines (the newest reading at or before the mark, at most 15 min old).
--   public.putcall_names_now        the newest mark, each name against the average of its own last 20 sessions at
--                                   the SAME clock time (at least 3 needed):
--                                     calls_x  = calls so far today ÷ calls it usually has by now
--                                     puts_x   = puts  so far today ÷ puts  it usually has by now
--                                     ratio_x  = today's put/call ÷ its usual put/call  (= puts_x ÷ calls_x, exactly)
--                                     thin     = usually under 2,000 contracts by this time — shown, never flashed
--
-- NEIGHBOURS CHECKED TOGETHER: ibkr_putcall_minute, putcall_daily, putcall_gap_daily, putcall_vs_cboe and their
-- crons (270-273) are not read or written by anything here. ibkr-ingest (the Mac's only door) is unchanged: this
-- table is filled inside the database, so no new write path opens on Alan's MacBook. A market holiday on a
-- weekday would store marks with no volume; the view ignores a session in which a name traded nothing.
-- Rollback: 0020_ibkr_option_volume_15m.rollback.sql. History: db/backfill/0020_ibkr_option_volume_15m_backfill.sql.
create table if not exists public.ibkr_option_volume_15m (
  ticker           text             not null,
  mark_ts          timestamptz      not null,           -- the quarter-hour this reading stands for
  session_et       date             not null,
  hhmm             text             not null,           -- New York clock: '09:45' … '15:45', '16:00' = the day
  call_vol         double precision,                    -- running total for the session at the mark
  put_vol          double precision,
  put_call         double precision,                    -- null with a reason, never a zero standing in
  put_call_absent  text,
  reading_age_ms   integer,                             -- how old the reading used was at the mark
  source           text             not null default 'IBKR',
  formula_version  text             not null default 'pc-1.0.0',
  computed_at      timestamptz      not null default now(),
  primary key (ticker, mark_ts)
);
create index if not exists ibkr_option_volume_15m_mark_idx on public.ibkr_option_volume_15m (mark_ts);
create index if not exists ibkr_option_volume_15m_clock_idx on public.ibkr_option_volume_15m (ticker, hhmm, session_et desc);
alter table public.ibkr_option_volume_15m enable row level security;
drop policy if exists ibkr_option_volume_15m_anon_read on public.ibkr_option_volume_15m;
create policy ibkr_option_volume_15m_anon_read on public.ibkr_option_volume_15m for select to anon using (true);
grant select on public.ibkr_option_volume_15m to anon;

create or replace view public.putcall_names_now as
with cur_mark as (
  select max(mark_ts) as mark_ts from public.ibkr_option_volume_15m
), cur as (
  select n.* from public.ibkr_option_volume_15m n join cur_mark m on n.mark_ts = m.mark_ts
), hist as (
  select h.ticker, h.call_vol, h.put_vol,
         row_number() over (partition by h.ticker order by h.session_et desc) as rn
  from public.ibkr_option_volume_15m h
  join cur c on c.ticker = h.ticker and h.hhmm = c.hhmm and h.session_et < c.session_et
                and h.session_et >= c.session_et - 60      -- 20 sessions sit inside 60 days; the bound keeps a year of marks out of every read
  where h.call_vol is not null and h.put_vol is not null and (h.call_vol + h.put_vol) > 0
), usual as (
  select ticker, avg(call_vol) as usual_call_vol, avg(put_vol) as usual_put_vol, count(*)::int as usual_sessions
  from hist where rn <= 20 group by ticker
)
select c.ticker, c.session_et, c.mark_ts, c.hhmm, c.call_vol, c.put_vol,
       round(u.usual_call_vol::numeric, 0) as usual_call_vol, round(u.usual_put_vol::numeric, 0) as usual_put_vol, u.usual_sessions,
       round((c.call_vol / u.usual_call_vol)::numeric, 2) as calls_x,
       round((c.put_vol / u.usual_put_vol)::numeric, 2) as puts_x,
       round((c.put_vol / c.call_vol)::numeric, 3) as put_call,
       round((u.usual_put_vol / u.usual_call_vol)::numeric, 3) as usual_put_call,
       round(((c.put_vol / c.call_vol) / (u.usual_put_vol / u.usual_call_vol))::numeric, 2) as ratio_x,
       (u.usual_call_vol + u.usual_put_vol) < 2000 as thin
from cur c join usual u using (ticker)
where u.usual_sessions >= 3 and c.call_vol > 0 and c.put_vol is not null and u.usual_call_vol > 0 and u.usual_put_vol > 0;
grant select on public.putcall_names_now to anon;
