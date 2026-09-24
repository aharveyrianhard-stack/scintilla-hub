-- 2026-09-24 · M41 · SENTIMENT · one row per ticker × day × source (NEW TABLE)
--
-- WHY. Alan, 23 Sep: "this is only useful and truly checkable if theres a timeline
-- per ticker a like movement in sentiment by ticker… we should store and track thats
-- the point". A per-item table cannot draw a timeline without reading every item every
-- time; this is the row the tape scrubs, one per ticker per day per voice.
--
-- THE MEASURING STICK IS STORED WITH THE ROW. method, lexicon_sha and weighting are
-- written beside every number, so a row scored under a different word list can never
-- be silently averaged with this one.
create table if not exists public.sentiment_ticker_daily (
  day           date not null,                  -- New York trading day the items belong to
  ticker        text not null,
  source        text not null,                  -- 'news' | 'youtube' | 'x'
  score         numeric(5,3),                   -- mean of that day's SCORED items, -1..+1; null = nothing scored
  n             integer not null default 0,     -- items seen
  scored        integer not null default 0,     -- items that carried a word the list knows
  bull          integer not null default 0,
  bear          integer not null default 0,
  unscored      integer not null default 0,     -- carried no listed word; NEVER counted as zero
  questions     integer not null default 0,     -- asked rather than said; scored, then left out
  top_keywords  jsonb not null default '[]'::jsonb,  -- [{w,side,n,s}] — the word, its side, its count, a sentence
  method        text not null default 'lm-v1',
  lexicon_sha   text,
  weighting     text,                           -- the stick, in words, as it was applied
  updated_at    timestamptz not null default now(),
  primary key (day, ticker, source)
);
create index if not exists sentiment_ticker_daily_ticker_day_idx
  on public.sentiment_ticker_daily (ticker, day desc);
create index if not exists sentiment_ticker_daily_day_idx
  on public.sentiment_ticker_daily (day desc);
grant select on public.sentiment_ticker_daily to anon, authenticated;
-- writes stay with the service role (the edge functions). Nothing else writes this table.

-- ROLLBACK (exact): drop table if exists public.sentiment_ticker_daily;
