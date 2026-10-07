# 03 — score the whole news history · PROPOSAL, nothing to run

**Alan's call.** Not SQL on purpose, so nobody applies it by accident.

- **What exists:** 594,917 stored headlines; 513,131 were published before 23 Sep 2026 and none of them is scored.
  The function's own header says the back-fill "walks backwards through the 490,870" — it never did (see 02).
- **What it would do:** sentiment history on the Hub would start where the news starts instead of on 23 Sep.
- **Cost:** about 520 slices ≈ 43 hours at one slice per 5 minutes, unattended. The per-headline store grows from
  49 MB (40,236 rows) to roughly 700 MB; the database is 10 GB today. No model or paid API is called — the scorer
  is a word list.
- **How:** after 02 has finished, the same command with the floor removed —
  `replace(command, '&since=2026-09-23', '')` on cron job 262, and `done = false` on `sentiment_backfill_state`
  (keep the cursor: it continues downward from 23 Sep). Rollback = put `&since=2026-09-23` back; scored rows stay.
- **Recommendation:** do 02 first and look at the SENTIMENT tab; decide on the full history after that.
