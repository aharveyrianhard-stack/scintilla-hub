-- 2026-10-07 · CP1 DECISION CARDS — one card per name per session, and Alan's plan fields. ADDITIVE ONLY.
-- PROPOSED, NOT APPLIED. The coordinator applies it when Alan says; until then nothing reads or writes these tables and
-- the cards exist only as the study page deliverables/20261006/decision-cards/ (data/cards.json is the row shape).
--
-- WHY. Alan, 6 Oct: "the system stops being a dashboard and starts being the way we actually make decisions." A card
-- lays out the facts and the levels for one name (growth first, the comps range, the Geiger and RSI against the name's
-- own year, the reviewed lines, its usual day against SPY's) and leaves the plan to him. The allocation tool's knockout
-- (step 5) and PICKS (step 6) and a Hub CARDS view read the same row, so the three never disagree.
--
-- decision_cards       one row per (ticker, card_date), written once after the close by the daily job and never
--                      overwritten (a re-run on the same day writes a new built_utc; the newest is the card).
--   card               the whole record as JSON (the shape of data/cards.json → cards.<TICKER>): fundamentals, comps,
--                      technicals, risk, and the plan fields empty
--   comps_code         which comps code and which switches produced it, so a number can always be traced
-- decision_card_plans  what Alan types into a card's plan fields. APPEND-ONLY, like public.comps_decisions: the
--                      latest row per (owner, ticker, field) is the state, the history is kept.
--   field              core_or_conviction · entry_levels · size_by_risk · exit_trim_rule · stop · note

create table if not exists public.decision_cards (
  id          bigint generated always as identity primary key,
  ticker      text        not null,
  card_date   date        not null,
  card        jsonb       not null,
  price       numeric,
  comps_centre numeric,
  comps_upside_pct numeric,
  comps_priced_on text    check (comps_priced_on in ('set', 'business', 'none')),
  knockout_score numeric,
  comps_code  text        not null default '',
  built_utc   timestamptz not null default now(),
  source      text        not null default 'decision-cards-daily'
);
create index if not exists decision_cards_ticker_idx on public.decision_cards (ticker, card_date desc, built_utc desc);
create index if not exists decision_cards_date_idx on public.decision_cards (card_date desc, knockout_score desc);
comment on table public.decision_cards is 'One decision card per name per session (facts and levels; never a buy or sell instruction). The newest built_utc per (ticker, card_date) is the card.';

create table if not exists public.decision_card_plans (
  id        bigint generated always as identity primary key,
  owner_id  uuid        not null default '00000000-0000-0000-0000-000000000000'::uuid,
  ticker    text        not null,
  field     text        not null check (field in ('core_or_conviction', 'entry_levels', 'size_by_risk', 'exit_trim_rule', 'stop', 'note')),
  value     text        not null default '',
  set_by    text        not null default 'alan',
  set_at    timestamptz not null default now(),
  source    text        not null default 'allocation-picks'
);
create index if not exists decision_card_plans_ticker_idx on public.decision_card_plans (owner_id, ticker, field, set_at desc);
comment on table public.decision_card_plans is 'Append-only: what the operator writes into a decision card''s plan fields; the latest row per (owner, ticker, field) is the state.';

-- The cards are read with the public key like every Hub table; only the daily job writes them (service role, inside
-- Supabase). The plan fields are written from the page with the public key, exactly as public.comps_decisions is.
alter table public.decision_cards enable row level security;
drop policy if exists decision_cards_read_all on public.decision_cards;
create policy decision_cards_read_all on public.decision_cards for select using (true);
grant select on public.decision_cards to anon, authenticated;

alter table public.decision_card_plans enable row level security;
drop policy if exists decision_card_plans_read_all on public.decision_card_plans;
create policy decision_card_plans_read_all on public.decision_card_plans for select using (true);
drop policy if exists decision_card_plans_insert_anon on public.decision_card_plans;
create policy decision_card_plans_insert_anon on public.decision_card_plans for insert with check (true);
grant select, insert on public.decision_card_plans to anon, authenticated;

-- ROLLBACK: supabase/migrations/20261007_cp1_decision_cards_ROLLBACK.sql (removes only what this file added).
