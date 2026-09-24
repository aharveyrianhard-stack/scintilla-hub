-- 2026-09-24 · M52 HEARTBEAT — rollback for 20260924_ticker_heartbeat_daily.sql.
-- Removes the table and everything created with it (primary key, indexes, policy and grants go
-- with it). Nothing in the estate depended on this table before the migration, and every Hub
-- surface that reads it falls back to the words "not enough history yet" rather than a blank —
-- so dropping it cannot blank a screen that was working before.
drop policy if exists thd_read_all on public.ticker_heartbeat_daily;
drop table if exists public.ticker_heartbeat_daily;
