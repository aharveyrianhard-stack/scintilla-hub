-- R2 Part A · OFFERING alert (2 Oct 2026) — one row per SEC offering filing by a stock the Hub serves.
-- Written by the edge function offering-watch (service role). Read by the Hub with the anon key.
-- Rollback (written first): /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-offering_filings-20261002.sql
create table if not exists public.offering_filings (
  url            text primary key,                         -- the SEC document (FMP finalLink, else link); one row per filing
  ticker         text not null,
  cik            text,
  form           text not null,                            -- 424B5 · 424B4 · S-3 · S-3ASR · S-1
  filed_date     date not null,
  accepted_utc   timestamptz,                              -- EDGAR acceptance time (FMP acceptedDate is New York time; converted)
  class          text not null check (class in ('EQUITY','CONVERTIBLE','ATM','DEBT','UNCLASSIFIED')),
  sentence       text check (sentence is null or char_length(sentence) <= 300),   -- the text that decided the class
  size_text      text,                                     -- shares / dollars as printed on the cover, if found
  first_seen_utc timestamptz not null default now()
);
create index if not exists offering_filings_ticker_filed on public.offering_filings (ticker, filed_date desc);
create index if not exists offering_filings_filed on public.offering_filings (filed_date desc);
alter table public.offering_filings enable row level security;
create policy offering_filings_read on public.offering_filings for select to anon, authenticated using (true);
grant select on public.offering_filings to anon, authenticated;
comment on table public.offering_filings is 'R2 Part A (2 Oct 2026): SEC offering filings (424B5/424B4/S-3/S-3ASR/S-1) by Hub stocks, classified from the first ~60 KB of the document. Writer: edge function offering-watch. Rollback: _archive/backend-fix-20260928/ROLLBACK-offering_filings-20261002.sql';
-- the writer: offering-watch runs as service_role (insert new filings; update only when re-classifying)
grant select, insert, update on public.offering_filings to service_role;
