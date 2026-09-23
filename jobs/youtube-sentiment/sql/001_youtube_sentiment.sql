-- SCINTILLA · YouTube sentiment (SCI-16 / SCI-26). Root applies with the service role / DSN.
-- Idempotent. Adds the "latest mention" columns the SOCIAL > SENTIMENT surface renders when present,
-- and two YouTube-side tables so transcripts and per-video readings live in the database, not only on one Mac.
alter table public.social_sentiment
  add column if not exists last_video_id     text,
  add column if not exists last_channel      text,
  add column if not exists last_published_at timestamptz,
  add column if not exists window_days       integer,
  add column if not exists method            text;
create unique index if not exists social_sentiment_ticker_source_uidx on public.social_sentiment (ticker, source);

create table if not exists public.youtube_transcripts (
  video_id    text primary key references public.youtube_videos(video_id) on delete cascade,
  status      text not null check (status in (ok,none,error)),
  lang        text,
  generated   boolean,
  segments    integer,
  chars       integer,
  text        text,
  error       text,
  source      text not null default youtube timedtext via youtube-transcript-api,
  fetched_at  timestamptz not null default now()
);
create table if not exists public.youtube_video_sentiment (
  video_id     text not null references public.youtube_videos(video_id) on delete cascade,
  ticker       text not null,
  mentions     integer not null,
  lean         numeric(5,3),
  windows      integer,
  method       text not null,
  computed_at  timestamptz not null default now(),
  primary key (video_id, ticker)
);
grant select on public.youtube_transcripts, public.youtube_video_sentiment to anon, authenticated;
-- writes stay with the service role (the scheduled job); anon can read, as with youtube_videos.
