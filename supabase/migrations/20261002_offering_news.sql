-- C1 (2 Oct 2026, night) · the press release first — one row per offering headline about a Hub stock, from our own news
-- table (news-feed, cron 6), joined to the SEC filing it announced once that filing is stored. Additive: a new table, no
-- existing table changed. Written by the edge function offering-watch v2 (pass mode, service role); read by the Hub
-- (FINANCIALS → CAPITAL) with the anon key.
-- Rollback (written first): /Users/alanharvey/SCINTILLA 0.5/_archive/backend-fix-20260928/ROLLBACK-offering_news-20261002.sql
--   (= supabase/migrations/20261002_offering_news_ROLLBACK.sql)
create table if not exists public.offering_news (
  ticker         text not null,                            -- the Hub's ticker (public.news.ticker)
  url            text not null,                            -- the headline's link (public.news.url)
  published_utc  timestamptz not null,                     -- public.news.published_ts
  source         text,                                     -- public.news.site (businesswire.com, Google News, …)
  feed           text,                                     -- public.news.feed (fmp · google · investing)
  title          text not null check (char_length(title) <= 400),
  kind           text not null check (kind in ('EQUITY','CONVERTIBLE','ATM','DEBT','PLACEMENT','SHELF')),
  filing_url     text,                                     -- offering_filings.url once the filing it announced is stored
  first_seen_utc timestamptz not null default now(),
  primary key (ticker, url)
);
create index if not exists offering_news_ticker_pub on public.offering_news (ticker, published_utc);
alter table public.offering_news enable row level security;
drop policy if exists offering_news_read on public.offering_news;
create policy offering_news_read on public.offering_news for select to anon, authenticated using (true);
revoke all on public.offering_news from anon, authenticated;
grant select on public.offering_news to anon, authenticated;
grant select, insert, update on public.offering_news to service_role;
comment on table public.offering_news is 'C1 (2 Oct 2026): offering headlines about Hub stocks from public.news, joined to offering_filings by offering-watch v2. Rollback: _archive/backend-fix-20260928/ROLLBACK-offering_news-20261002.sql';
