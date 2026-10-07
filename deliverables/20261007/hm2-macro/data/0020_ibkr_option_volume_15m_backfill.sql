-- HM2, 7 Oct 2026 · the history of public.ibkr_option_volume_15m, from the readings already stored.
-- Additive: fills an empty table from public.ibkr_option_volume (stated source); `on conflict do nothing` leaves any
-- row the function has already written exactly as it is. One statement per trading session so no single query is
-- long (measured 7 Oct: 73 names over 8 sessions answered in 4 seconds; a whole session of ~590 names is the same
-- lookups, about 15,000 of them, on the table's own (ticker, ts) key).
-- THE RULE IS nameRowsAt()'s: for each name and each mark (09:45 … 15:45 New York, and 15:59 kept as 16:00), the
-- newest reading whose MINUTE is at or before the mark and at most 15 minutes older than it; no reading, no row.
-- 5 Oct is absent on purpose: IB Gateway was logged out and the session stored nothing between 09:30 and 16:00.
-- Run:  supabase db query --linked -f db/backfill/0020_ibkr_option_volume_15m_backfill.sql

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-09-24', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-09-24') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-09-24 09:45' at time zone 'America/New_York', timestamp '2026-09-24 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-09-24 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-09-24'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-09-25', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-09-25') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-09-25 09:45' at time zone 'America/New_York', timestamp '2026-09-25 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-09-25 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-09-25'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-09-28', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-09-28') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-09-28 09:45' at time zone 'America/New_York', timestamp '2026-09-28 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-09-28 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-09-28'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-09-29', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-09-29') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-09-29 09:45' at time zone 'America/New_York', timestamp '2026-09-29 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-09-29 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-09-29'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-09-30', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-09-30') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-09-30 09:45' at time zone 'America/New_York', timestamp '2026-09-30 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-09-30 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-09-30'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-10-01', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-10-01') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-10-01 09:45' at time zone 'America/New_York', timestamp '2026-10-01 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-10-01 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-10-01'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-10-02', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-10-02') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-10-02 09:45' at time zone 'America/New_York', timestamp '2026-10-02 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-10-02 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-10-02'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-10-06', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-10-06') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-10-06 09:45' at time zone 'America/New_York', timestamp '2026-10-06 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-10-06 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-10-06'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;

insert into public.ibkr_option_volume_15m (ticker, mark_ts, session_et, hhmm, call_vol, put_vol, put_call, put_call_absent, reading_age_ms)
select t.ticker, m.mark, date '2026-10-07', m.hhmm, r.call_vol, r.put_vol,
       case when r.call_vol > 0 and r.put_vol is not null then r.put_vol / r.call_vol end,
       case when r.call_vol is null or r.put_vol is null then 'NO_SNAPSHOT' when r.call_vol = 0 then 'NO_CALL_VOLUME' end,
       (extract(epoch from (m.mark - date_trunc('minute', r.ts))) * 1000)::int
from public.ibkr_session_tickers(date '2026-10-07') t
cross join (
  select g as mark, to_char(g at time zone 'America/New_York', 'HH24:MI') as hhmm
  from generate_series(timestamp '2026-10-07 09:45' at time zone 'America/New_York', timestamp '2026-10-07 15:45' at time zone 'America/New_York', interval '15 minutes') g
  union all select timestamp '2026-10-07 15:59' at time zone 'America/New_York', '16:00'
) m
join lateral (
  select v.ts, v.call_vol, v.put_vol from public.ibkr_option_volume v
  where v.ticker = t.ticker and v.session_et = date '2026-10-07'
    and v.ts < m.mark + interval '1 minute' and v.ts >= m.mark - interval '15 minutes'
  order by v.ts desc limit 1
) r on true
where m.mark <= now() and (r.call_vol is not null or r.put_vol is not null)
on conflict (ticker, mark_ts) do nothing;
