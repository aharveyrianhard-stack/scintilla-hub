-- C2 (5 Oct 2026, SCI-57) — STAGED, NOT APPLIED. Adds the 366 days of 2028 to public.market_calendar.
-- Additive only: one row per calendar day, the same shape as the 2027 rows loaded on 29 Sep 2026
-- (d, is_trading_day, open_min, close_min, regular_minutes, label, source). ON CONFLICT DO NOTHING: a day that
-- already has a row is left exactly as it is. The table today ends at 2027-12-31 (read 5 Oct 2026, 9,131 rows, no gap).
-- Source: NYSE "Holidays & Trading Hours", https://www.nyse.com/markets/hours-calendars (read 5 Oct 2026):
--   closed 2028: Jan 17 · Feb 21 · Apr 14 · May 29 · Jun 19 · Jul 4 · Sep 4 · Nov 23 · Dec 25
--   New Year's Day 2028 falls on a Saturday; NYSE lists no closure for it ("—"), so Fri 31 Dec 2027 stays a session.
--   early close 13:00 ET: Mon Jul 3 and Fri Nov 24. (Dec 24 2028 is a Sunday.)
-- Minutes are ET minutes after midnight: 570 = 09:30, 960 = 16:00, 780 = 13:00.
-- Expected after: 366 rows for 2028 = 251 sessions (249 full + 2 early) + 106 weekend days + 9 holidays.
-- Rollback: 20261005_c2_market_calendar_2028_ROLLBACK.sql (write it into the rollback log BEFORE applying).
begin;
with hol(d, label) as (values
  (date '2028-01-17', 'Martin Luther King Jr Day'),
  (date '2028-02-21', 'Washingtons Birthday'),
  (date '2028-04-14', 'Good Friday'),
  (date '2028-05-29', 'Memorial Day'),
  (date '2028-06-19', 'Juneteenth'),
  (date '2028-07-04', 'Independence Day'),
  (date '2028-09-04', 'Labor Day'),
  (date '2028-11-23', 'Thanksgiving Day'),
  (date '2028-12-25', 'Christmas Day')
), early(d, label) as (values
  (date '2028-07-03', 'Day before Independence Day early close'),
  (date '2028-11-24', 'Day after Thanksgiving early close')
), days as (
  select g::date as d from generate_series(date '2028-01-01', date '2028-12-31', interval '1 day') g
)
insert into public.market_calendar (d, is_trading_day, open_min, close_min, regular_minutes, label, source)
select days.d,
       (hol.d is null and extract(isodow from days.d) < 6),
       case when hol.d is null and extract(isodow from days.d) < 6 then 570 end,
       case when hol.d is not null or extract(isodow from days.d) >= 6 then null when early.d is not null then 780 else 960 end,
       case when hol.d is not null or extract(isodow from days.d) >= 6 then 0 when early.d is not null then 210 else 390 end,
       case when hol.d is not null then hol.label when extract(isodow from days.d) >= 6 then 'weekend'
            when early.d is not null then early.label else 'regular session' end,
       case when hol.d is not null or early.d is not null then 'nyse-2028-published' else 'derived' end
from days left join hol on hol.d = days.d left join early on early.d = days.d
on conflict (d) do nothing;
commit;

-- Read-back (expect: 366 | 251 | 106 | 9 | 2 | 2028-12-29):
-- select count(*), count(*) filter (where is_trading_day), count(*) filter (where label = 'weekend'),
--        count(*) filter (where not is_trading_day and label <> 'weekend'), count(*) filter (where regular_minutes = 210),
--        max(d) filter (where is_trading_day)
-- from public.market_calendar where d between '2028-01-01' and '2028-12-31';
