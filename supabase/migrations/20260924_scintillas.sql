-- 2026-09-24 · M42 SCINTILLAS — a scintilla becomes a stored event.
--
-- WHY. Alan, 23 Sep: "the hub dashboard is scintillating telling me to go to economic … i go to
-- economic and i dont see scintillating"; "we need to broaden scintillation as a signal thats why
-- its called scintilla"; "its a scintilla that can be part of a measure of criticality and the stat
-- analysis tells us probabilities for better judgement".
-- Until now a scintilla was a 520 ms glow and nothing else: it existed only while it was on screen,
-- so nothing could count them, compare them, or carry one from the dashboard into the room it points
-- at. This table is the memory. One row per detected scintilla, with the number that made it one.
--
-- WHAT A ROW MEANS. Something moved further than that subject's own history says it usually moves.
--   kind        which detector said so
--   subject     the ticker, the release, the cohort or the market it happened to
--   direction   +1 / 0 / -1 — the sign of the move or of the surprise (actual − estimate)
--   magnitude   HOW UNUSUAL, as |z| against the subject's OWN history — never a raw percentage,
--               so a 2% day on a quiet utility outranks a 2% day on a meme stock
--   detail      the inputs behind the number, so any row can be recomputed by hand
--   source      which feed the inputs came from (chart API /candles, earnings_events, econ_calendar)
--
-- ADDITIVE ONLY: one new table, nothing else is read, renamed or written. Reads are public (anon
-- SELECT) because the Hub reads it with the anon key; WRITES stay with the service role, so only the
-- detector edge function can add a row.
--
-- ROLLBACK (exact):
--     drop table public.scintillas;

create table if not exists public.scintillas (
  id            bigserial primary key,
  ts            timestamptz  not null default now(),
  kind          text         not null,
  subject       text         not null,
  subject_kind  text         not null default 'ticker',
  direction     smallint     not null default 0,
  magnitude     double precision,
  source        text         not null,
  detail        jsonb        not null default '{}'::jsonb,
  dedupe_key    text,
  created_at    timestamptz  not null default now(),
  constraint scintillas_kind_ck check (kind in
    ('price_outlier','earnings_surprise','econ_surprise','econ_imminent','sentiment_spike','breadth_thrust')),
  constraint scintillas_subject_kind_ck check (subject_kind in ('ticker','event','cohort','market')),
  constraint scintillas_direction_ck check (direction in (-1,0,1)),
  constraint scintillas_magnitude_ck check (magnitude is null or magnitude >= 0)
);

-- A detector that runs every few minutes must be able to run twice with the same inputs and leave
-- one row. dedupe_key is that promise: kind + subject + the occurrence it belongs to.
create unique index if not exists scintillas_dedupe_uidx on public.scintillas (dedupe_key)
  where dedupe_key is not null;
create index if not exists scintillas_ts_idx         on public.scintillas (ts desc);
create index if not exists scintillas_kind_ts_idx    on public.scintillas (kind, ts desc);
create index if not exists scintillas_subject_ts_idx on public.scintillas (subject, ts desc);

comment on table public.scintillas is
  'One row per detected scintilla: something that moved further than its own history says it usually does. magnitude is |z| against the subject''s own history, never a raw percentage. Written only by the scintillas-detect edge function (service role); read publicly by the Hub.';
comment on column public.scintillas.magnitude is
  'How unusual, as an absolute z-score against the subject''s own history. NULL where no z can be formed honestly (an imminent release has not printed a number yet).';
comment on column public.scintillas.detail is
  'The inputs behind the number (move, volatility, n, estimate, actual), so any row can be recomputed by hand.';

alter table public.scintillas enable row level security;

drop policy if exists scintillas_read_all on public.scintillas;
create policy scintillas_read_all on public.scintillas for select using (true);

grant select on public.scintillas to anon, authenticated;
revoke insert, update, delete on public.scintillas from anon, authenticated;
