-- SCINTILLA · P2 PREDICTION MARKETS SECTION (2 Oct 2026) — public.prediction_topic_proposals.
-- Additive only (pre-approved class): one new table, one index, read-only RLS for the page. Nothing existing is
-- touched: topics.json, the collector, prediction_market_snapshots / _runs / _latest and cron 278 stay as they are.
--
-- WHAT LANDS HERE. The topic method (supabase/functions/prediction-topic-proposals, same code as
-- scripts/prediction-topic-proposals.mjs) reads our own news reel for the last 7 days, counts headlines per theme,
-- and writes one row per PROPOSAL: kind 'add' (a heavy theme with an open Polymarket market and no tracked topic)
-- or 'remove' (a tracked topic whose theme is quiet and which has no live market). Alan approves; nothing is added
-- to topics.json by a machine. status moves proposed → approved | declined by hand (the coordinator), never by the page.
-- ROLLBACK: 20261002_prediction_topic_proposals_ROLLBACK.sql
--           (also kept at /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-prediction_topic_proposals-20261002.sql)

create table if not exists public.prediction_topic_proposals (
  id            bigint generated always as identity primary key,
  run_id        text         not null,                       -- one id per run of the method
  ts            timestamptz  not null default now(),
  kind          text         not null check (kind in ('add','remove')),
  theme         text         not null,                       -- the news theme (lib.mjs THEMES)
  topic         text         null,                           -- topics.json id for a 'remove'; null for an 'add'
  headline_7d   integer      null,                           -- headlines in our reel over 7 days that say this theme
  market_title  text         null,                           -- the open Polymarket market proposed (an 'add')
  event_id      text         null,                           -- Polymarket event id
  series_id     text         null,                           -- Polymarket series id when the market rolls
  volume_24h    numeric      null,                           -- USD traded in the last day, from the public search
  why           text         not null,                       -- the reason in one plain sentence, printed on the page
  status        text         not null default 'proposed' check (status in ('proposed','no-market','approved','declined'))
);
comment on table public.prediction_topic_proposals is
  'P2 prediction markets: proposals from the topic method (our 7-day news reel × Polymarket public search). Alan approves; topics.json is edited by hand.';
create index if not exists prediction_topic_proposals_run_idx on public.prediction_topic_proposals (ts desc, run_id);

alter table public.prediction_topic_proposals enable row level security;
drop policy if exists prediction_topic_proposals_read on public.prediction_topic_proposals;
create policy prediction_topic_proposals_read on public.prediction_topic_proposals for select to anon, authenticated using (true);
grant select on public.prediction_topic_proposals to anon, authenticated;
-- the method writes as service_role (same explicit grant pattern as prediction_market_snapshots); update is for the
-- status column when Alan decides. No delete.
grant select, insert, update on public.prediction_topic_proposals to service_role;
