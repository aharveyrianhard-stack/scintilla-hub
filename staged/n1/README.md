# staged/n1 — NOT APPLIED

From the N1 lane (5 Oct 2026, Linear SCI-63): the news-mood job and the old alert writer. Every `.sql` sits beside its
`_ROLLBACK.sql`. Nothing here has been run; the lane only read the database. Report:
`deliverables/20261005/n1-sentiment-alerts/N1-SENTIMENT-ALERTS.html`.

| # | file | what it does | who says yes | needs first |
|---|------|--------------|--------------|-------------|
| 1 | `01_news_publish_time_index.sql` | one new index on `news(published_ts)` — ends the full-table read behind the 500 "read news" answers | coordinator (additive, pre-approved class) | nothing; run outside a transaction |
| 2 | `02_news_mood_backfill_restart_since_23sep.sql` | restarts the back-filler so the ~41,000 unscored headlines since 23 Sep get scored | **Alan** (changes Hub numbers) | the branch's `sentiment-news` function deployed, and 01 |
| 3 | `03_news_mood_backfill_full_history_PROPOSAL.md` | score the 513,131 older headlines too | **Alan** | 02 finished |
| 4 | `04_feed_alerts_writer_stop.sql` | switches cron 129 `feed-alerts-5m` off | coordinator — **not recommended yet** (see BREAKS in the file) | seven feeds given a contract in `feed_alarm` |
| 5 | `05_feed_alerts_mark_void.sql` | marks the 9,352 rows void (delivered = NULL, channel = marker) | **Alan** (overwrite; changes the Station label) | nothing |
| 6 | `06_feed_alerts_delete_PROPOSAL.md` | delete the 9,352 rows | **Alan** (destructive) — not recommended | an export |

The code fix (branch `hub/n1-sentiment-alerts-20261005`, not deployed): `supabase/functions/sentiment-news/` + `_shared/db.ts`,
tests in `tests/sentiment-news-plan.test.mjs`. `_shared/db.ts` is also bundled into `sentiment-x` and `sentiment-youtube`;
its one change (a failed read now carries the database's message) reaches them only when they are next deployed.
