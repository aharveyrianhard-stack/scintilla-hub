# 06 — delete the 9,352 old feed alerts · PROPOSAL, nothing to run

**Destructive — Alan's call.** Not SQL on purpose.

- **Rows:** 9,352 in `public.feed_alerts` (ids 1 → 9383; 31 ids were never used).
- **Date span:** 18 Jun 2026 13:38 UTC → 18 Sep 2026 05:40 UTC. By month: June 2,102 · July 1,513 · August 3,818 · September 1,919.
- **Size:** 1.3 MB with its index. Deleting them frees nothing that matters.
- **What they are:** one line each time one of ten feeds read RED — the only stored record of when the old feeds were down
  in June–September (e.g. `equity_price` 2,507 times before the Massive provider took prices over on 18 Aug).
- **What would be lost:** that outage history. Nothing reads it except the Station ALERTS panel, which shows the newest few.
- **Recommendation:** do not delete. Mark them void (05) — same clean count, history kept, fully reversible.
- If Alan still wants them gone: export first (`select * from public.feed_alerts order by id` → a file in the archive),
  then `delete from public.feed_alerts where id <= 9383 and fired_ts < '2026-09-19T00:00:00Z'` — there is no rollback
  for a delete except re-loading that export.
