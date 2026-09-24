-- 2026-09-24 · M41 · SENTIMENT · the backfill's resume point (NEW TABLE)
--
-- WHY. There are 490,870 stored headlines. One function call cannot score them and
-- must not try: a job that dies halfway and starts again from the top never finishes.
-- The backfill walks NEWEST FIRST in bounded slices and writes where it got to, so the
-- next call continues instead of repeating. Same pattern as the X collector's resume
-- point, for the same reason.
create table if not exists public.sentiment_backfill_state (
  source       text primary key,                -- 'news' | 'youtube' | 'x'
  cursor_ts    bigint,                          -- oldest published_ts scored so far; the next slice ends here
  scanned      bigint not null default 0,
  scored       bigint not null default 0,
  unscored     bigint not null default 0,
  slices       integer not null default 0,
  oldest_seen  bigint,
  done         boolean not null default false,
  note         text,
  started_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
grant select on public.sentiment_backfill_state to anon, authenticated;

-- ROLLBACK (exact): drop table if exists public.sentiment_backfill_state;
-- Resetting a backfill without dropping the table:
--   delete from public.sentiment_backfill_state where source = 'news';
