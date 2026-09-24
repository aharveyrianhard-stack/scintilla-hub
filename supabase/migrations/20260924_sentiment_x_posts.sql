-- 2026-09-24 · M41 · SENTIMENT · the X voice, stored per post (NEW TABLE)
--
-- WHY. The X reading existed only inside one browser tab: the room scored the
-- collector's published feed on the fly and stored nothing, so there was no history
-- and no way to check a reading after the fact. The handle is kept, because "voices as
-- chips" (Alan) needs to know who moved the read.
--
-- IT NEVER TOUCHES THE COLLECTOR. The function reads the feed the collector already
-- publishes; nothing here writes, schedules or changes anything on Alan's Mac.
create table if not exists public.x_post_sentiment (
  post_id       text not null,
  ticker        text not null,                  -- one row per (post, $TICKER) the post names
  handle        text,                           -- the voice
  published_ts  bigint,                         -- epoch seconds, as the feed states it
  method        text not null default 'lm-v1',
  lexicon_sha   text,
  score         numeric(5,3),
  question      boolean not null default false,
  pos_n         integer not null default 0,
  neg_n         integer not null default 0,
  flip_n        integer not null default 0,
  unc_n         integer not null default 0,
  hits          jsonb not null default '[]'::jsonb,   -- [{w,list,polarity,negated,effect,s}]
  sample        text,
  scored_at     timestamptz not null default now(),
  primary key (post_id, ticker)
);
create index if not exists x_post_sentiment_ticker_ts_idx on public.x_post_sentiment (ticker, published_ts desc);
create index if not exists x_post_sentiment_handle_idx on public.x_post_sentiment (handle);
grant select on public.x_post_sentiment to anon, authenticated;

-- ROLLBACK (exact): drop table if exists public.x_post_sentiment;
