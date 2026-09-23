-- SCINTILLA · YouTube per-video evidence (SCI-5 / lane M27). Root applies with the service role.
-- Idempotent. 001 created youtube_video_sentiment with the numbers; this adds the WORDS, so a
-- reading on the Hub can be opened down to the transcript window it came from.
alter table public.youtube_video_sentiment
  add column if not exists bullish_hits integer,
  add column if not exists bearish_hits integer,
  add column if not exists hits         jsonb default '[]'::jsonb,   -- [{w,polarity,negated,effect,src}]
  add column if not exists sample       text,                        -- the ±40-word window the lean came from
  add column if not exists sample_src   text;                        -- "transcript" or "title"
-- the job upserts on (video_id, ticker); 001 already made that the primary key.
grant select on public.youtube_video_sentiment to anon, authenticated;
