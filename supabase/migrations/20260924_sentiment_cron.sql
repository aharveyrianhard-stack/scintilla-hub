-- 2026-09-24 · M41 · SENTIMENT · the scorers run themselves (SCHEDULES ONLY)
--
-- WHY. Every sentiment table in this estate was empty because the scoring only ever ran
-- when a person ran it on a laptop with a key they should not have. These four schedules
-- call edge functions instead: Supabase injects SUPABASE_SERVICE_ROLE_KEY into the
-- function, so the key exists only inside the platform and no Mac ever holds it.
--
-- WHAT RUNS (all three use the SAME measuring stick, supabase/functions/_shared/sentiment-core.mjs):
--   sentiment-news-10m       every 10 minutes  · newest headlines, bounded, then rebuild the days it touched
--   sentiment-news-backfill  every 5 minutes   · walks backwards through the 490,870 stored headlines,
--                                                1,500 at a time, resuming from sentiment_backfill_state.
--                                                UNSCHEDULE IT once that row reads done = true (below).
--   sentiment-youtube-6h     every 6 hours     · after the collector's sweep, per (video, ticker)
--   sentiment-x-2h           every 2 hours     · the collector's published feed, on its own rhythm
--
-- SINGLE FLIGHT is inside each function (app_config flag), so an overlapping call returns
-- ANOTHER_RUN_IN_FLIGHT and writes nothing. Each function also leaves its last receipt in
-- app_config (sentiment_news_last, sentiment_youtube_last, sentiment_x_last).
--
-- THE SECRET. This migration contains NO key: it reads the functions bearer from Vault by
-- name, exactly as 20260923_earnings_report_time_cron.sql does. Store it once if it is not
-- already there (the value never appears in git or in a chat):
--     select vault.create_secret('<the functions bearer key>', 'scintilla_functions_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('sentiment-news-10m')      where exists (select 1 from cron.job where jobname = 'sentiment-news-10m');
select cron.unschedule('sentiment-news-backfill') where exists (select 1 from cron.job where jobname = 'sentiment-news-backfill');
select cron.unschedule('sentiment-youtube-6h')    where exists (select 1 from cron.job where jobname = 'sentiment-youtube-6h');
select cron.unschedule('sentiment-x-2h')          where exists (select 1 from cron.job where jobname = 'sentiment-x-2h');

select cron.schedule('sentiment-news-10m', '*/10 * * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/sentiment-news?mode=live&limit=600',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 280000);
$$);

select cron.schedule('sentiment-news-backfill', '*/5 * * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/sentiment-news?mode=backfill&limit=1500',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 280000);
$$);

select cron.schedule('sentiment-youtube-6h', '25 */6 * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/sentiment-youtube?days=7',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 280000);
$$);

select cron.schedule('sentiment-x-2h', '40 */2 * * *', $$
  select net.http_post(
    url     := 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/sentiment-x?days=3',
    headers := jsonb_build_object('Content-Type','application/json',
                 'Authorization','Bearer ' || (select decrypted_secret from vault.decrypted_secrets
                                                where name = 'scintilla_functions_key')),
    body    := '{}'::jsonb, timeout_milliseconds := 280000);
$$);

-- WHEN THE BACKFILL IS DONE (check first, then unschedule — it is the only job meant to end):
--     select source, scanned, scored, done, updated_at from public.sentiment_backfill_state;
--     select cron.unschedule('sentiment-news-backfill');
--
-- ROLLBACK (exact, and it removes no data):
--     select cron.unschedule('sentiment-news-10m');
--     select cron.unschedule('sentiment-news-backfill');
--     select cron.unschedule('sentiment-youtube-6h');
--     select cron.unschedule('sentiment-x-2h');
