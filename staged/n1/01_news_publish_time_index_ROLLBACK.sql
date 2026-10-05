-- N1 · ROLLBACK of 01_news_publish_time_index.sql. Run outside a transaction. Returns the table to its
-- four original indexes; the news-mood job goes back to reading the whole table (slow, not broken).
drop index concurrently if exists public.news_published_ts_desc_idx;
