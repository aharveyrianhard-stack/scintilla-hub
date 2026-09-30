-- 2026-09-30 · C2 COMPS TAB — the operator's on/off decisions on a company's comparable peers. ADDITIVE ONLY.
-- Proposed 30 Sep 2026; the coordinator applies it. Until it is applied the COMPS tab keeps the decisions in the
-- browser's own storage (localStorage sc_comps_decisions) and says so on the page.
--
-- WHY. Alan, 30 Sep: "having the capacity to toggle off and on certain edges or outliers of the comparable companies
-- list … that operator decision should be saved but we should also be able to add that outlier back later on."
--
-- SHAPE. The same idea as the Hub's lists (public.station_lists: one dated row per state, written on every toggle,
-- read at load so every device converges): one row per decision, APPEND-ONLY. The latest row per
-- (owner, company, peer, measure) is the state; "put back" is a new row with off = false, so the history is kept.
--   company  the company whose comps the decision belongs to (MU)
--   peer     the comparable that is turned off or back on (AXTI)
--   measure  'ALL' = the whole peer; else one of pe_ttm · pe_fwd · ev_sales · ev_ebitda · ps · peg = one cell
--   off      true = out of the percentiles, the band and the upside; false = put back
--   reason   the operator's words (DIFFERENT BUSINESS, FAR FROM THE PACK, NOT MEANINGFUL, or free text)
--   owner_id the same placeholder owner the Hub's favourites use until the operator authenticates

create table if not exists public.comps_decisions (
  id        bigint generated always as identity primary key,
  owner_id  uuid        not null default '00000000-0000-0000-0000-000000000000'::uuid,
  company   text        not null,
  peer      text        not null,
  measure   text        not null default 'ALL' check (measure in ('ALL', 'pe_ttm', 'pe_fwd', 'ev_sales', 'ev_ebitda', 'ps', 'peg')),
  "off"     boolean     not null,
  reason    text        not null default '',
  set_by    text        not null default 'alan',
  set_at    timestamptz not null default now(),
  source    text        not null default 'hub-comps-tab'
);
create index if not exists comps_decisions_company_idx on public.comps_decisions (owner_id, company, set_at desc);
create index if not exists comps_decisions_peer_idx on public.comps_decisions (company, peer, measure, set_at desc);
comment on table public.comps_decisions is 'Append-only operator decisions on comparable peers per company (off / put back), with the reason; the latest row per (owner, company, peer, measure) is the state.';

-- The Hub reads and writes this table directly with the public key, as it does public.station_lists.
-- The coordinator decides whether that is right here; without these two policies the tab stays in browser storage.
alter table public.comps_decisions enable row level security;
drop policy if exists comps_decisions_read_all on public.comps_decisions;
create policy comps_decisions_read_all on public.comps_decisions for select using (true);
drop policy if exists comps_decisions_insert_anon on public.comps_decisions;
create policy comps_decisions_insert_anon on public.comps_decisions for insert with check (true);
grant select, insert on public.comps_decisions to anon, authenticated;

-- ROLLBACK: supabase/migrations/20260930_comps_decisions_ROLLBACK.sql (removes only what this file added).
