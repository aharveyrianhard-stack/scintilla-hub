-- ROLLBACK · C1 · the CAPITAL block's "first seen in the news" · 2 Oct 2026 (night)
-- Written BEFORE the table was created. Drops exactly what C1 created and nothing else.
-- Run with:  supabase db query --linked --project-ref wadinxqplrggagkvrdag "<this file's SQL>"
-- (from the linked scratch folder s6link). Takes under a second.
--
-- What it removes:
--   public.offering_news                   (the table, its index, its read policy, its grants)
-- What it does NOT touch:
--   public.offering_filings                (C1 changed no column of it; the join lives in offering_news.filing_url)
--   public.news                            (only read)
--
-- The Hub reads offering_news with .catch(() => []): after this rollback the CAPITAL block simply shows no news lines.
-- To return offering-watch to v1 (no news step), redeploy the function from commit 87f982e:
--   git -C <worktree> show 87f982e:supabase/functions/offering-watch/index.ts / classify.mjs, then
--   supabase functions deploy offering-watch --project-ref wadinxqplrggagkvrdag

drop policy if exists offering_news_read on public.offering_news;
drop table if exists public.offering_news;
