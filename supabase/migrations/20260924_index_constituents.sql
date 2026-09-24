-- 2026-09-24 · M39 ALLOCATION — make "is the Hub a representative sample?" answerable.
--
-- WHY. Alan asked, in these words: "is the hub a decently representative sample of the
-- market?" Tonight the allocation page cannot answer it. Breadth is measured over the
-- Hub's own 316 companies, and no table the page can read carries the S&P 500's
-- membership or its weights, so coverage by count and by weight cannot be computed.
-- The page says so out loud rather than implying its breadth is the index's breadth.
--
-- WHAT THIS DOES. One new table, filled by whichever job already holds the provider key
-- (the FMP jobs do; the page never sees it). Once a single day of rows lands, the page
-- can state coverage by count AND by weight, and the honest proxy (RSP against SPY) can
-- be checked against the real thing.
--
-- NOTHING IS APPLIED BY THIS FILE BEYOND THE EMPTY TABLE. No row is inserted here: the
-- membership is data, and data comes from the provider job, not from a migration written
-- by a worker who cannot read the provider.
--
-- ROLLBACK is the last statement in this file (commented out).

create table if not exists public.index_constituents (
  index_name  text        not null,            -- 'SP500', 'NASDAQ100', …
  ticker      text        not null,
  weight      numeric     null,                -- per cent of the index, when the source gives it
  sector      text        null,
  as_of       date        not null,
  source      text        not null,            -- which provider endpoint produced the row
  updated_ts  bigint      null,
  primary key (index_name, ticker, as_of)
);

comment on table public.index_constituents is
  'M39 — index membership and weight by date, so a page can measure how much of an index the Hub actually covers instead of guessing.';

create index if not exists index_constituents_asof_idx on public.index_constituents (index_name, as_of desc);

alter table public.index_constituents enable row level security;
drop policy if exists index_constituents_read on public.index_constituents;
create policy index_constituents_read
  on public.index_constituents for select
  to anon, authenticated
  using (true);

-- ROLLBACK (removes exactly what this migration added, nothing else):
-- drop policy if exists index_constituents_read on public.index_constituents;
-- drop table if exists public.index_constituents;
