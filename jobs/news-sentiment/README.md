# News sentiment — one score per headline, and the words that made it

`score_news.py` reads headlines from `public.news`, scores each one with the finance lexicon in
`data/news-lexicon/lm-headline-v1.json`, and (with `--apply`) upserts one row per `(url, ticker)`
into `public.news_headline_sentiment`.

* **Reads:** `news` (anon).
* **Writes:** `news_headline_sentiment` only — never a price table, never `news`, never
  `news_sentiment` (the old per-ticker roll-up is left exactly where it is).
* **Key:** the write key is read from the environment only (`SUPABASE_SERVICE_ROLE_KEY`, else
  `SUPABASE_KEY`). It is never printed and never stored in this repo.

```bash
# what it would do, writing nothing (this is what the lane ran):
python3 jobs/news-sentiment/score_news.py score --days 3 --limit 4000 --out /tmp/news-scored.json

# the coordinator applies the migration first, then runs the same command with --apply:
psql "$SUPABASE_DSN" -f jobs/news-sentiment/sql/001_news_headline_sentiment.sql
SUPABASE_SERVICE_ROLE_KEY=… python3 jobs/news-sentiment/score_news.py score --days 3 --limit 4000 --apply

# the fixtures the browser, this job and the tests all agree on:
python3 jobs/news-sentiment/score_news.py selftest
```

The scoring rule, in words: a headline's score is the **balance** of the scoring words in it —
(positive − negative) ÷ (positive + negative) — so it runs from −1 to +1. A negator in the three
words before a match flips that match. **A headline with no scoring word in it gets no score at
all**, not a zero. The lexicon is 2,355 negative words against 354 positive ones, which is why the
balance is used rather than a count.
