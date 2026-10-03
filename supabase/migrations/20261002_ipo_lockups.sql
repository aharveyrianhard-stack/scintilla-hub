-- R2 Part B (UNLOCK watch), 2 Oct 2026 — one new table, additive (pre-approved: new tables). Rollback written first:
-- supabase/migrations/20261002_ipo_lockups_ROLLBACK.sql (= _archive/backend-fix-20260928/ROLLBACK-ipo_lockups-20261002.sql).
-- Written only by the edge function unlock-watch (service role); read by the Hub with the anon key (one SELECT policy,
-- the pattern of public.prediction_market_snapshots behind prediction_market_latest).
create table if not exists public.ipo_lockups (
  ticker          text primary key,
  company         text,
  listing_kind    text not null check (listing_kind in ('IPO','RELISTING','DIRECT_LISTING','SPAC','SPINOFF')),
  ipo_date        date,                       -- the first day of trading (FMP ipos-calendar, else FMP profile ipoDate)
  lockup_days     integer,                    -- the prospectus's day count
  unlock_date     date,                       -- when the main lock-up ends: prospectus date + lockup_days (SPAC: from the closing)
  basis           text check (basis in ('PROSPECTUS','ASSUMED_180')),   -- null when there is no lock-up (relisting, direct listing, spin-off)
  early_release   text,                       -- the prospectus sentence that sets an earlier or staged release, when there is one
  source_url      text,                       -- the SEC document read
  checked_utc     timestamptz not null default now(),
  prospectus_date date,                       -- the cover's "Prospectus dated …" — the day the count starts
  clause          text,                       -- the sentence the day count came from
  early_rule      text,                       -- the early or staged release in short words, for the Hub
  schedule        jsonb,                      -- the prospectus's own "Earliest Date Available for Sale" table, row by row
  source_form     text                        -- 424B4 · 424B1 · 424B3 (a SPAC's merger prospectus) · S-1
);
comment on table public.ipo_lockups is 'IPO lock-up expiry per Hub stock, read from the SEC prospectus by the edge function unlock-watch (R2 Part B, 2 Oct 2026). Rollback: supabase/migrations/20261002_ipo_lockups_ROLLBACK.sql';
alter table public.ipo_lockups enable row level security;
drop policy if exists ipo_lockups_read on public.ipo_lockups;
create policy ipo_lockups_read on public.ipo_lockups for select to anon, authenticated using (true);
revoke all on public.ipo_lockups from anon, authenticated;
grant select on public.ipo_lockups to anon, authenticated;
-- the writer: this project grants the service role explicitly (prediction_market_snapshots has INSERT,SELECT); an upsert also updates
grant select, insert, update on public.ipo_lockups to service_role;
