-- SCINTILLA · GB1 (5 Oct 2026) · ROLLBACK of 20261005_grokbot_inbox.sql. READ BEFORE RUNNING.
--
-- This removes everything the migration added, INCLUDING THE ROWS Grok Bot has posted since (X posts, YouTube
-- chunk scores, following lists, channel map, news scores, the 30-day raw log). Dropping stored rows is a delete:
-- it needs Alan's word. To stop the inbox WITHOUT losing anything, do not run this file — delete the function
-- secret instead (`supabase secrets unset GROKBOT_INBOX_TOKEN`); the function then refuses every request.
--
-- Nothing that existed before the migration is touched: no other table, view, policy, cron job or app_config row.

do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('grokbot-inbox-retention') where exists (select 1 from cron.job where jobname = 'grokbot-inbox-retention');
  end if;
end $$;

do $$ begin
  if to_regclass('public.job_heartbeat') is not null then
    delete from public.job_heartbeat where job = 'grokbot:inbox';
  end if;
  if to_regclass('public.job_heartbeat_event') is not null then
    delete from public.job_heartbeat_event where job = 'grokbot:inbox';
  end if;
end $$;

drop view  if exists public.grokbot_inbox_last;
drop table if exists public.grokbot_news_scores;
drop table if exists public.x_youtube_channel_map;
drop table if exists public.x_following;
drop table if exists public.youtube_chunks;
drop table if exists public.x_posts;
drop table if exists public.grokbot_inbox;
