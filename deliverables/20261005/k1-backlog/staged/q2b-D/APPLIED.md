# Q2b fix D — applied 5 Oct 2026, 17:07:28 UTC (13:07 ET), by K1

**What it does.** 27 scheduled jobs that call a function now record the function's real answer (200, 500, timed out)
where the heartbeat can read it. Before, the scheduler only said "sent".

**Why the morning attempt failed.** The file kept its backup of the 27 job commands in a database area called
`scin_archive`. That area no longer exists (its parked tables were exported on 27 Sep and it is gone). It was not a
permission problem.

**The one change.** The backup lives in a new private area, `scin_private` (no access for the public roles; not served
by the API). Everything else is Q2b's file, character for character.

**Checked before applying.** The whole change was run inside a transaction that was rolled back: 27 of 27 jobs would be
wrapped, 27 originals backed up, each original call still inside its new command, every schedule and on/off state
unchanged; after the rollback nothing had changed (0 wrapped, no new area).

**Read back after applying.** 27 of 27 wrapped · 27 backed up · 27 still active · the public roles cannot use the area.
First answers recorded within five minutes: `putcall-aggregate-minute` 4 of 4 answered 200, `scintillas-detect-intraday`
200, `sentiment-news-10m` 200, `sentiment-news-backfill` 200; none failed.

**Undo.** `20261005_q2b_D_record_real_http_answers_ROLLBACK.sql` puts every saved command back exactly and drops the backup.

**What changes for Alan.** The phone alarms are on (since 11:34 ET). A job among these 27 that really fails will now be
seen and announced once when it turns bad and once when it recovers — it could not be seen before.

**Neighbours.** `scin_dispatch_reap` (every 2 min) fills in the answers; `purge-cron-dispatch-daily` keeps 14 days
(the minute job adds about 390 rows a session day); the heartbeat reads the same table it already read.
