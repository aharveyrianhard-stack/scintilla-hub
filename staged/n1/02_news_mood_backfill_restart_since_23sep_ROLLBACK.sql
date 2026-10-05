-- N1 · ROLLBACK of 02. Puts the back-filler's command and bookmark back to what was measured on 5 Oct 2026
-- (finished after one slice, cursor 1790188605 = 23 Sep 18:36:45Z). Headlines scored in between STAY scored:
-- they are correct rows; removing them would be a delete, which is Alan's call.
begin;
select cron.alter_job(262, command := replace((select command from cron.job where jobid = 262),
  'sentiment-news?mode=backfill&limit=1000&since=2026-09-23''', 'sentiment-news?mode=backfill&limit=1500'''));
update public.sentiment_backfill_state
   set done = true, cursor_ts = 1790188605, scanned = 1000, scored = 153, unscored = 247, slices = 1,
       oldest_seen = 1790188605,
       note = 'newest-first, bounded slices; cursor is the oldest published_ts scored so far', updated_at = now()
 where source = 'news';
commit;
