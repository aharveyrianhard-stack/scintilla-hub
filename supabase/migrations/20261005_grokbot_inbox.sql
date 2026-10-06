-- SCINTILLA · GB1 (5 Oct 2026): the inbox Grok Bot posts into.
--
-- Alan, 5 Oct: "Grok Bot should live on its own computer but can be set up with some forwarding that we ingest."
-- Grok Bot posts JSON over HTTPS to the edge function `grokbot-inbox`; the function validates each item and files
-- it in the tables below. Nothing here reads X, YouTube or Grok Bot's computer.
--
-- ADDITIVE ONLY. Six new tables, one new view, one new row in job_heartbeat, one new nightly clean-up job.
-- No existing table, column, view, policy or row is changed. UNDO: 20261005_grokbot_inbox_ROLLBACK.sql.
--
-- ACCESS (the Q4 rules). Every new table has row-level security ON and NO policy, and the default grants the
-- project hands to the public key are taken away again, so the public key can neither read nor write any of them.
-- No page reads these tables today, so none is opened for public reading. The only writer and the only reader is
-- the edge function, with the service role (which passes row-level security by design).
--
-- NOTE FOR THE COORDINATOR: public.x_posts did NOT exist on 5 Oct 2026 (the public API answered "table not found",
-- and the Q4 catalogue of that morning has no such table). The brief called it "existing"; this file creates it.
-- The SOCIAL tabs read the collector's published feed (/api/xfeed), not a table — see the GB1 return.

-- ---------------------------------------------------------------------------------------------------------------
-- 1. grokbot_inbox — one row per envelope received (accepted or not). Kept 30 days.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.grokbot_inbox (
  id           bigint generated always as identity primary key,
  received_at  timestamptz not null default now(),
  kind         text,                              -- null when the envelope itself could not be read
  sent_at      timestamptz,                       -- the sender's own clock
  items        integer not null default 0,        -- how many items the envelope carried
  accepted     integer not null default 0,
  rejected     integer not null default 0,
  rejections   jsonb not null default '[]'::jsonb, -- [{i, reason}], first 100
  outcome      text not null default 'ok',        -- ok · partial · all_rejected · bad_envelope · store_failed
  bytes        integer,
  body_sha256  text,
  envelope     jsonb                              -- what was sent, with transcript text removed unless Alan has allowed it
);
create index if not exists grokbot_inbox_kind_received_idx on public.grokbot_inbox (kind, received_at desc);
create index if not exists grokbot_inbox_received_idx on public.grokbot_inbox (received_at);
comment on table public.grokbot_inbox is
  'GB1: every envelope Grok Bot posted to the grokbot-inbox function. Raw log, 30-day retention (cron grokbot-inbox-retention).';

-- ---------------------------------------------------------------------------------------------------------------
-- 2. x_posts — the X posts themselves, one row per post (a repost is its own row: who reposted what).
--    Same fields the X collector's ledger keeps (scripts/xfeed-ingest.mjs normalizePost).
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.x_posts (
  record_key    text primary key,                 -- 'post:<id>' or 'repost:<handle>:<id>' (xfeed-ingest recordKey)
  post_id       text not null,                    -- X's id, kept as text (it does not fit a JavaScript number)
  handle        text not null,                    -- the account, without @
  kind          text not null check (kind in ('original','reply','quote','repost')),
  created_at    timestamptz not null,             -- when it was posted, as X states it
  text          text not null default '',
  url           text not null,                    -- the x.com address it was read from
  tickers       text[] not null default '{}',     -- $TICKERS named in the post or the post it quotes
  photos        jsonb not null default '[]'::jsonb,
  videos        jsonb not null default '[]'::jsonb,
  video_url     text,
  has_video     boolean not null default false,
  youtube_id    text,
  links         jsonb not null default '[]'::jsonb,
  original      jsonb,                            -- the quoted / reposted / replied-to post, same shape
  provenance    jsonb not null default '{}'::jsonb,
  list          text,                             -- which of his ledgers: tracked · bell · bell_only
  source        text not null default 'grokbot',  -- who filed the row
  first_seen_at timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists x_posts_created_idx on public.x_posts (created_at desc);
create index if not exists x_posts_handle_created_idx on public.x_posts (lower(handle), created_at desc);
create index if not exists x_posts_tickers_idx on public.x_posts using gin (tickers);
create index if not exists x_posts_post_id_idx on public.x_posts (post_id);
comment on table public.x_posts is
  'GB1: X posts filed by the grokbot-inbox function (source = grokbot). Replies are kept (kind = reply); a reader hides them.';

-- ---------------------------------------------------------------------------------------------------------------
-- 3. youtube_chunks — one scored piece of a video, per ticker it names.
--    text stays NULL until Alan allows transcript text to be stored (function secret GROKBOT_TEXT_ALLOWED).
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.youtube_chunks (
  video_id    text not null,
  t_start     integer not null check (t_start >= 0),          -- seconds from the start of the video
  t_end       integer check (t_end is null or t_end >= t_start),
  ticker      text not null default '',                       -- '' = the chunk names no ticker
  model       text not null,                                  -- which model produced the score
  score       numeric(5,3) check (score is null or (score >= -1 and score <= 1)),
  preview     text check (preview is null or char_length(preview) <= 200),
  text        text,                                           -- transcript text: NULL until Alan OKs storing it
  channel_id  text,
  source      text not null default 'grokbot',
  first_seen_at timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (video_id, t_start, ticker, model)
);
create index if not exists youtube_chunks_ticker_idx on public.youtube_chunks (ticker, updated_at desc);
comment on table public.youtube_chunks is
  'GB1: scored pieces of YouTube videos from Grok Bot. Link to the second: https://www.youtube.com/watch?v=<video_id>&t=<t_start>s';

-- ---------------------------------------------------------------------------------------------------------------
-- 4. x_following — who Alan follows on X, per list, as Grok Bot last saw it.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.x_following (
  handle        text not null,                    -- without @, as X spells it
  handle_lc     text generated always as (lower(handle)) stored,
  list          text not null,                    -- following · trading · tracked · bell · bell_only · …
  name          text,
  seen_at       timestamptz not null,             -- when Grok Bot last saw the account on that list
  source        text not null default 'grokbot',
  first_seen_at timestamptz not null default now(),
  primary key (handle_lc, list)                   -- one row per account per list, whatever the capitals
);
create index if not exists x_following_list_idx on public.x_following (list, handle_lc);

-- ---------------------------------------------------------------------------------------------------------------
-- 5. x_youtube_channel_map — Grok Bot's own map: this X account has that YouTube channel.
--    This is NOT the bridge row (app_config.yt_bridge_channels). The feed keeps following the bridge row only;
--    nothing here changes which channels ride the YouTube feed.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.x_youtube_channel_map (
  x_handle      text not null,
  x_handle_lc   text generated always as (lower(x_handle)) stored,
  channel_id    text not null,                    -- UC… (24 characters)
  channel_title text,
  channel_handle text,                            -- the @name on YouTube, without @
  confidence    text check (confidence is null or confidence in ('high','medium','low')),
  evidence      text,
  seen_at       timestamptz not null,
  source        text not null default 'grokbot',
  first_seen_at timestamptz not null default now(),
  primary key (x_handle_lc, channel_id)
);

-- ---------------------------------------------------------------------------------------------------------------
-- 6. grokbot_news_scores — his score for one news item, per ticker, per model.
-- ---------------------------------------------------------------------------------------------------------------
create table if not exists public.grokbot_news_scores (
  url          text not null check (char_length(url) <= 1000),
  ticker       text not null default '',
  model        text not null,
  score        numeric(5,3) check (score is null or (score >= -1 and score <= 1)),
  title        text,
  published_at timestamptz,
  scored_at    timestamptz not null,
  source       text not null default 'grokbot',
  first_seen_at timestamptz not null default now(),
  primary key (url, ticker, model)
);
create index if not exists grokbot_news_scores_ticker_idx on public.grokbot_news_scores (ticker, scored_at desc);

-- ---------------------------------------------------------------------------------------------------------------
-- 7. Access: rules on, no policy, and the public key's default grants removed.
-- ---------------------------------------------------------------------------------------------------------------
alter table public.grokbot_inbox         enable row level security;
alter table public.x_posts               enable row level security;
alter table public.youtube_chunks        enable row level security;
alter table public.x_following           enable row level security;
alter table public.x_youtube_channel_map enable row level security;
alter table public.grokbot_news_scores   enable row level security;
revoke all on public.grokbot_inbox, public.x_posts, public.youtube_chunks, public.x_following,
              public.x_youtube_channel_map, public.grokbot_news_scores from anon, authenticated, public;
grant select, insert, update, delete on public.grokbot_inbox, public.x_posts, public.youtube_chunks, public.x_following,
              public.x_youtube_channel_map, public.grokbot_news_scores to service_role;

-- the newest envelope per kind, for the function's GET (one small read instead of six)
create or replace view public.grokbot_inbox_last with (security_invoker = true) as
  select kind, max(received_at) as last_received_at, count(*)::int as envelopes_30d
    from public.grokbot_inbox where kind is not null and outcome in ('ok','partial') group by kind;
revoke all on public.grokbot_inbox_last from anon, authenticated, public;
grant select on public.grokbot_inbox_last to service_role;

-- ---------------------------------------------------------------------------------------------------------------
-- 8. The heartbeat row. Every POST the function accepts pings job_heartbeat_ping('grokbot:inbox', …).
--    Late after 2 hours (1 h 45 min + 15 min grace). The checker (job_heartbeat_judge) has no notion of a market
--    day — it measures "time since the last good ping" — so the 2 hours hold every day; Grok Bot posts at least
--    hourly outside market hours, and the contract asks for an hourly heartbeat when he has nothing new.
--    alarm = false: the status page shows LATE, nothing is pushed to Alan until the coordinator turns it on.
--    Skipped cleanly where the heartbeat tables are not installed.
-- ---------------------------------------------------------------------------------------------------------------
do $$ begin
  if to_regclass('public.job_heartbeat') is not null then
    insert into public.job_heartbeat (job, kind, part, what, expected_every, grace, fail_after, alarm, armed)
    values ('grokbot:inbox', 'external', 'Grok Bot''s postman',
            'Grok Bot posts his X tape, YouTube scores and lists to our inbox; this row says when he last got through.',
            interval '1 hour 45 minutes', interval '15 minutes', 3, false, false)
    on conflict (job) do nothing;
  end if;
end $$;

-- ---------------------------------------------------------------------------------------------------------------
-- 9. 30-day retention of the raw log only (the filed rows in x_posts, youtube_chunks … are kept).
--    03:17 UTC daily. Skipped cleanly where pg_cron is not installed.
-- ---------------------------------------------------------------------------------------------------------------
do $$ begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule('grokbot-inbox-retention') where exists (select 1 from cron.job where jobname = 'grokbot-inbox-retention');
    perform cron.schedule('grokbot-inbox-retention', '17 3 * * *',
      $cmd$delete from public.grokbot_inbox where received_at < now() - interval '30 days'$cmd$);
  end if;
end $$;
