-- ROLLBACK for 20261005_c2_market_calendar_2028.sql (C2, SCI-57): removes only the 2028 days that file adds.
-- Safe only while nothing else has written 2028 rows; on 5 Oct 2026 the table had none (max d = 2027-12-31).
delete from public.market_calendar where d between '2028-01-01' and '2028-12-31';
