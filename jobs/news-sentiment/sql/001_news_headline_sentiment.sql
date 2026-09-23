-- SCINTILLA · per-headline news sentiment (SCI-5 / lane M27). Root applies with the service role.
-- Idempotent. One row per (url, ticker): the same story is filed against several tickers by the feed,
-- and each filing is scored in its own right.
--
-- WHY THIS TABLE EXISTS. Until now the only stored news reading was news_sentiment: one number per
-- ticker, written by a job whose code is not on this Mac, so nobody could say how it was produced.
-- Every row here carries the words that fired, so any reading can be taken apart down to the word.
create table if not exists public.news_headline_sentiment (
  url           text not null,
  ticker        text not null,
  published_ts  bigint,
  method        text not null,                 -- "lm-v1" = Loughran-McDonald + headline verbs
  lexicon_sha   text,                          -- sha256 of the lexicon file that produced this row
  score         numeric(5,3),                  -- -1..+1 balance of hits; NULL = no lexicon word fired
  question      boolean not null default false, -- a headline that asks rather than says; never counted in a total
  pos_n         integer not null default 0,
  neg_n         integer not null default 0,
  flip_n        integer not null default 0,    -- how many hits a negator flipped
  unc_n         integer not null default 0,    -- Loughran-McDonald "uncertainty" words present
  hits          jsonb   not null default '[]'::jsonb,   -- [{w,list,polarity,negated,effect}]
  scored_at     timestamptz not null default now(),
  primary key (url, ticker)
);
create index if not exists news_headline_sentiment_ticker_ts_idx
  on public.news_headline_sentiment (ticker, published_ts desc);
create index if not exists news_headline_sentiment_ts_idx
  on public.news_headline_sentiment (published_ts desc);
grant select on public.news_headline_sentiment to anon, authenticated;
-- writes stay with the service role (the scheduled job). Nothing else writes this table.
