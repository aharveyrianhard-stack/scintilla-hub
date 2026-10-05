-- H12 05 (5 Oct 2026) — A NEW SCHEDULE (one cron row). Not applied by this lane. Rollback at the bottom.
-- Apply only after 01-04 are in and H11's evening write has been seen to land.
--
-- WHY: cron 233 publishes the day's sector ranking at 21:15 UTC (17:15 ET, 16:15 in winter). H11's job
-- writes the evening Geiger from 20:10 ET. So the 17:15 row is built from LAST evening's stock readings
-- (03 says so in the method text). This second run republishes the same day's row from tonight's readings.
-- 01:45 UTC is 21:45 ET in summer and 20:45 ET in winter: after H11's write and after cron 209 (01:10 UTC)
-- in both. The date is passed as the New York date, because at 01:45 UTC the database's own date is
-- already tomorrow.
--
-- NEIGHBOURS: cron 233 stays (same key (date, sector): the later run overwrites the earlier row for that
-- day). cron 209 and H11's job only write composite_history. cron 199 writes nothing (see 90). If H11's
-- job misses an evening this run republishes the same numbers and marks nothing new — it cannot blank or
-- hold a row.
select cron.schedule('sector-rankings-after-close', '45 1 * * 2-6',
  $$select scin_rebuild_sector_rankings((now() at time zone 'America/New_York')::date)$$);

-- ROLLBACK:
--   select cron.unschedule('sector-rankings-after-close');
