-- F5 · the morning read's two qualitative inputs, made countable. ADDITIVE ONLY. Proposed 27 Sep 2026; the coordinator applies it.
-- Nothing in this branch writes to these tables. The morning read (deliverables/20260925/rulebook-stats-deep/) shows them empty until applied.
--
-- operator_inputs: append-only dated decisions from the market discussion — a state ("ai_cycle" = FEAR | BUILD | GREED),
-- a plan of attack, or a change request — each with Alan's reason. A new decision is a new row; history is never overwritten
-- (operator_preferences from K1 keeps one row per key, which erases the history a regime column needs).
-- news_event_tags: one row per headline × ticker × tag, so study H4 can count what followed confirmed events.

create table if not exists public.operator_inputs (
  id           bigint generated always as identity primary key,
  kind         text        not null check (kind in ('state', 'plan', 'change_request')),
  name         text        not null,                        -- 'ai_cycle', 'rates_hurt_utilities', a ticker for a plan, a short title for a change
  state        text,                                        -- for kind = 'state': e.g. 'FEAR' | 'BUILD' | 'GREED' for ai_cycle
  body         jsonb       not null default '{}'::jsonb,    -- for 'plan': {"ticker":"AVGO","condition":"own P10 RSI and ≥ 1× usual pullback","wants":"tell me"}
  reason       text        not null default '',             -- Alan's words
  set_by       text        not null default 'alan',
  set_at       timestamptz not null default now(),
  review_on    date,                                        -- when the page should ask again
  supersedes   bigint references public.operator_inputs (id),
  source       text        not null default 'market-discussion'
);
create index if not exists operator_inputs_name_set_idx on public.operator_inputs (name, set_at desc);
create index if not exists operator_inputs_kind_set_idx on public.operator_inputs (kind, set_at desc);

create table if not exists public.news_event_tags (
  id                bigint generated always as identity primary key,
  news_ref          text        not null,                   -- the news row id or a stable hash of source + url
  ticker            text        not null,
  counterparty      text,                                   -- e.g. 'MSFT' when a hyperscaler deal names a preferred provider
  tag               text        not null check (tag in ('customer_concentration', 'hyperscaler_deal_named_provider', 'capex_guidance',
                                                        'export_control', 'supply_constraint', 'guidance_change', 'index_change', 'other')),
  stance            text        not null default 'unclear' check (stance in ('positive', 'negative', 'neutral', 'unclear')),  -- as the headline states it
  tone_lm           double precision,                       -- the Loughran-McDonald headline score, kept as a column, never the tag
  first_seen_utc    timestamptz not null,
  first_session     date        not null,                   -- before 09:30 ET → that session; after 16:00 ET → the next
  cluster_id        text        not null,                   -- one story = same tickers + tag within 48 h + similar title
  tagged_by         text        not null,                   -- 'rule:v1' or 'alan'
  operator_confirmed boolean,                               -- null until Alan confirms or rejects in the morning read
  confirmed_at      timestamptz,
  created_at        timestamptz not null default now()
);
create index if not exists news_event_tags_ticker_session_idx on public.news_event_tags (ticker, first_session desc);
create index if not exists news_event_tags_tag_session_idx on public.news_event_tags (tag, first_session desc);
create unique index if not exists news_event_tags_unique on public.news_event_tags (news_ref, ticker, tag);

comment on table public.operator_inputs is 'Append-only dated operator decisions from the morning market discussion (states, plans of attack, change requests), each with a reason.';
comment on table public.news_event_tags is 'Rule-tagged (and operator-confirmed) news events on names, one row per headline × ticker × tag, for event counting (study H4).';

-- Row-level security and grants are NOT set here: the anon key must not write these tables until the coordinator decides
-- how the operator authenticates (the same open point as K1's operator_decisions).

-- ROLLBACK (removes only what this file added; nothing else is touched)
-- drop table if exists public.news_event_tags;
-- drop table if exists public.operator_inputs;
