-- K1 · the operator's knockout decisions and preferences. ADDITIVE ONLY. Proposed 25 Sep 2026; the coordinator applies it.
-- The workshop page (deliverables/20260925/knockout/) writes to localStorage only and never touches these tables.
-- Shapes follow the brief: operator_decisions (ticker, cohort, decision, reason, heat_at, made_at, expires_on)
-- and operator_preferences (key, value, reason, updated_at).

create table if not exists public.operator_decisions (
  id          bigint generated always as identity primary key,
  ticker      text        not null,
  cohort      text        not null,
  decision    text        not null check (decision in ('PICK', 'PASS', 'LATER')),
  reason      text        not null default '',           -- full sentence, the operator's words
  heat_at     double precision,                          -- the Geiger reading at the moment of the decision (board source, dated by made_at)
  made_at     timestamptz not null default now(),
  expires_on  date,                                      -- LATER decisions carry a date to look again; PICK/PASS may be null
  source      text        not null default 'knockout-workshop'
);
create index if not exists operator_decisions_ticker_made_idx on public.operator_decisions (ticker, made_at desc);
create index if not exists operator_decisions_cohort_made_idx on public.operator_decisions (cohort, made_at desc);

create table if not exists public.operator_preferences (
  key         text        primary key,                   -- e.g. 'fit.cap_floor_usd', 'fit.theme.URANIUM'
  value       jsonb       not null,                      -- the setting itself; a theme carries {"state":"OUT"|"CARE"|"IN"}
  reason      text        not null default '',           -- why, in the operator's words ("nuclear — its time will come, not right now")
  updated_at  timestamptz not null default now()
);

comment on table public.operator_decisions   is 'One row per PICK / PASS / LATER an operator makes in a cohort knockout. Append-only by convention: a new decision is a new row.';
comment on table public.operator_preferences is 'The operator''s editable defaults for round 1 (fit): cap floor, earnings rule, themes in play, each with its reason.';

-- Row-level security and grants are NOT set here: the anon key must not write these tables until the coordinator
-- decides how the operator authenticates. Until then the workshop keeps its state in the browser.

-- ROLLBACK (removes only what this file added; nothing else is touched)
-- drop table if exists public.operator_preferences;
-- drop table if exists public.operator_decisions;
