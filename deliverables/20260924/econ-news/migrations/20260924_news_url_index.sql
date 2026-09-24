-- M70 (24 Sep 2026) — an index on news(url). ADDITIVE, nothing is altered or removed.
-- WHY: news is indexed on (ticker,url), so a lookup by url alone cannot use it. MEASURED 24 Sep on the
-- live database: ticker+url answered in 0.14 s, url alone hit the 3 s statement timeout (57014). The
-- Investing.com lane therefore scopes its de-duplication read to its own bucket. With this index the
-- lane can de-duplicate against EVERY ticker instead - set INVESTING_GLOBAL_DEDUPE to true in
-- news-feed once it exists.
create index concurrently if not exists news_url_idx on public.news (url);
-- ROLLBACK
-- drop index concurrently if exists public.news_url_idx;
