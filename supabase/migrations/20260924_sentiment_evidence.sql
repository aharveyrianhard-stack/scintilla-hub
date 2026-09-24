-- 2026-09-24 · M41 · SENTIMENT · the evidence columns (ADDITIVE ONLY)
--
-- WHY. The room said "nothing was stored" on every panel, and it was telling the
-- truth: news_headline_sentiment existed but held 0 rows, because the scorer was a
-- Mac script that needed the service-role key copied onto the Mac. Nobody did that,
-- so nine months of headlines were never scored. The scorer now runs in Supabase
-- (supabase/functions/sentiment-news), where the key is injected into the function
-- and no laptop ever holds it.
--
-- WHAT THIS ADDS. Four nullable columns, so a stored reading can be opened all the
-- way down to the sentence a word was said in — Alan, 23 Sep: "tap a keyword to see
-- where it was said". No column is dropped, renamed or rewritten.
--   title      — the headline itself, so the tape can show it on hover
--   site       — who published it, so voices can be grouped by outlet
--   sample     — the sentence the strongest word fired in
--   source     — which voice wrote this row ('news'); one vocabulary across three tables
-- The per-word sentences live inside the existing hits jsonb, as {w,list,polarity,
-- negated,effect,s}. jsonb needs no migration to carry one more key.
alter table public.news_headline_sentiment
  add column if not exists title   text,
  add column if not exists site    text,
  add column if not exists sample  text,
  add column if not exists source  text default 'news';

-- the timeline reads (ticker, day) and the backfill reads (scored_at); both are covered
create index if not exists news_headline_sentiment_scored_idx
  on public.news_headline_sentiment (scored_at desc);
grant select on public.news_headline_sentiment to anon, authenticated;

-- ROLLBACK (exact, and it loses only the new columns):
--   drop index if exists public.news_headline_sentiment_scored_idx;
--   alter table public.news_headline_sentiment
--     drop column if exists title, drop column if exists site,
--     drop column if exists sample, drop column if exists source;
