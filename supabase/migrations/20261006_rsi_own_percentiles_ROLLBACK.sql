-- 2026-10-06 · RS1 — rollback for 20261006_rsi_own_percentiles.sql.
-- Removes the table and everything created with it (primary key, index, policy and grants go with it).
-- Nothing in the estate depended on this table before the migration, and every surface that reads it (the Hub board's
-- RSI cell, the Station chart's RSI chip) falls back to the 30 / 70 colouring it had before — so dropping it cannot
-- blank a cell that was working. If the nightly job was scheduled, run 20261006_rsi_own_daily_cron_ROLLBACK.sql first.
drop policy if exists rop_read_all on public.rsi_own_percentiles;
drop table if exists public.rsi_own_percentiles;
