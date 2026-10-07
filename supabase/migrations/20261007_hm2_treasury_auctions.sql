-- HM2 (7 Oct 2026) · public.treasury_auctions: every nominal Treasury note and bond auction in the seven terms Alan
-- named (2-, 3-, 5-, 7-, 10-, 20-, 30-year), announced and auctioned, from TreasuryDirect's free web service
-- (https://www.treasurydirect.gov/TA_WS/securities/search — no key). Alan, 7 Oct: "There's a 10-year note auction …
-- should we be tracking that? … how much they fill or what? What information do we get?"
-- Additive: one new table, anon read. One row per (cusip, auction date): the announcement first (size, date), then the
-- same row gains the result (the stop, bid-to-cover, who took it) a few minutes after the 13:00 ET deadline.
-- A reopening is filed by Treasury under its remaining life ("9-Year 10-Month"); `term` is the name it trades by ("10-Year").
-- Writer: supabase/functions/treasury-auctions (mapping in ./auctions.mjs, tests/hm2-macro.test.mjs).
-- First fill: deliverables/20261007/hm2-macro/data/treasury-auctions-load.sql (712 rows, 9 Jan 2018 → 8 Oct 2026).
-- Rollback: 20261007_hm2_treasury_auctions_ROLLBACK.sql
create table if not exists public.treasury_auctions (
  cusip                text        not null,
  auction_date         date        not null,
  term                 text        not null check (term in ('2-Year','3-Year','5-Year','7-Year','10-Year','20-Year','30-Year')),
  security_term        text,                       -- as Treasury files it: '9-Year 10-Month' for a reopened 10-year
  security_type        text        not null check (security_type in ('Note','Bond')),
  reopening            boolean,
  announcement_date    date,
  issue_date           date,
  maturity_date        date,
  closing_time_et      text,                       -- the competitive deadline, New York time: '01:00 PM'
  offering_amount      numeric,                    -- dollars offered to the public
  high_yield           numeric,                    -- the stop, in percent (null until the result is printed)
  median_yield         numeric,
  low_yield            numeric,
  coupon               numeric,
  bid_to_cover         numeric,
  competitive_accepted numeric,                    -- dollars awarded to competitive bidders
  indirect_accepted    numeric,
  direct_accepted      numeric,
  dealer_accepted      numeric,
  total_accepted       numeric,
  total_tendered       numeric,
  soma_accepted        numeric,                    -- the Fed's own add-on, outside the public offering
  indirect_pct         numeric,                    -- share of competitive_accepted, 0-100
  direct_pct           numeric,
  dealer_pct           numeric,
  announcement_pdf     text,                       -- Treasury's own documents for this auction, by file name ('A_20261001_3.pdf');
  results_pdf          text,                       -- the folder is the year in the name (auctions.mjs officialPdfUrl)
  status               text        not null check (status in ('announced','auctioned')),
  source               text        not null default 'TreasuryDirect TA_WS',
  source_updated_at    timestamp,                  -- Treasury's own updatedTimestamp (New York wall clock)
  fetched_at           timestamptz not null default now(),
  primary key (cusip, auction_date)
);
create index if not exists treasury_auctions_term_date_idx on public.treasury_auctions (term, auction_date desc);
create index if not exists treasury_auctions_date_idx on public.treasury_auctions (auction_date desc);
alter table public.treasury_auctions enable row level security;
drop policy if exists treasury_auctions_anon_read on public.treasury_auctions;
create policy treasury_auctions_anon_read on public.treasury_auctions for select to anon using (true);
grant select on public.treasury_auctions to anon;
