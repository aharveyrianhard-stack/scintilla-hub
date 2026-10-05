-- N1 · 5 Oct 2026 · STAGED — NOT APPLIED. WAITS FOR ALAN: it changes numbers the Hub shows
--       (SOCIAL → SENTIMENT news rows for 23 Sep → today gain the headlines that were never scored).
-- APPLY ONLY AFTER the function on branch hub/n1-sentiment-alerts-20261005 is deployed
--       (supabase/functions/sentiment-news + _shared/db.ts) AND 01 is applied. With the old function this
--       file would only repeat the old fault (one slice, then "finished").
--
-- WHAT: the back-filler (cron 262, every 5 min) has answered "finished" since 24 Sep 02:18Z after ONE slice
--       of 1,000. It called itself done when a slice was shorter than the 1,500 it asked for, and the
--       database never hands out more than 1,000. Of the 81,790 headlines published since 23 Sep, about
--       40,000 are scored; the rest arrived late and were never seen.
-- THIS FILE: sets the back-filler's bookmark to "not finished, start from now" and tells it to stop at
--       23 Sep (the first day of the sentiment store). About 82 slices ≈ 7 hours at one slice per 5 min.
--       Already-scored headlines are skipped, never scored twice.
-- BREAKS: nothing. While it runs, the news rows of earlier days change as their missing headlines are added.
-- NEIGHBOURS CHECKED: single-flight flag sentiment_news_backfill_busy (25 min) — unchanged; the live job
--       (261) uses its own flag and its own waiting list; heartbeat row 'sentiment-news-backfill' keeps
--       reading UP (it answers 200 either way); no key is written here — the command is edited in place.
begin;
-- guard: stop if the job or the bookmark is not what was measured on 5 Oct
do $$
begin
  if not exists (select 1 from cron.job where jobid = 262 and jobname = 'sentiment-news-backfill'
                 and command like '%sentiment-news?mode=backfill&limit=1500''%') then
    raise exception 'cron 262 is not the measured sentiment-news-backfill command — do not apply';
  end if;
  if not exists (select 1 from public.sentiment_backfill_state where source = 'news' and done and cursor_ts = 1790188605) then
    raise exception 'sentiment_backfill_state is not the measured row (done, cursor 1790188605) — do not apply';
  end if;
end $$;
select cron.alter_job(262, command := replace((select command from cron.job where jobid = 262),
  'sentiment-news?mode=backfill&limit=1500''', 'sentiment-news?mode=backfill&limit=1000&since=2026-09-23'''));
update public.sentiment_backfill_state
   set done = false, cursor_ts = null, note = 'N1 5 Oct 2026: restarted, floor 2026-09-23', updated_at = now()
 where source = 'news';
commit;

-- CHECK AFTER (read-only), ten minutes later:
--   select done, to_timestamp(cursor_ts) reached, scanned, slices, note, updated_at from public.sentiment_backfill_state;
--   select key, left(value, 400) from public.app_config where key in ('sentiment_news_last','sentiment_news_error');
-- It is complete when done = true and note ends "reached the since floor".
