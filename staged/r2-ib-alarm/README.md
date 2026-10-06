# R2 item 3 — an alarm for IB Gateway through the job heartbeat (staged 5 Oct 2026, nothing applied or deployed)

## What happened (read from the live database, 5 Oct 21:10 ET)
- IB Gateway on the MacBook stopped answering **Sun 4 Oct 04:39 ET** (last reading stored) and came back **Mon 5 Oct 20:37 ET**.
- Monday's put/call minute series is **empty** (0 of 390 minutes); Friday's has all 390.
- **An alarm already existed and fired.** `ibkr_gateway_watch()` (cron 275, every minute) sent 35 phone messages titled
  "IB GATEWAY NOT LOGGED IN": 6 on Sunday 17:30–18:47 ET, 2 at 03:55–04:10 Monday, 3 at 09:00–09:31, 24 through the session
  (one every 15 minutes), then "IB Gateway back" at 20:38 ET. The five whose delivery record is still kept answered HTTP 200
  from ntfy.sh. Whether Alan's phone is subscribed to that channel cannot be read from here.
- The job heartbeat (Q2b) has had a row for the counter since 3 Oct — `mac:com.scintilla.ibkr-putcall` — but nothing pings
  it, so it has sat at NEW ("waiting for its first heartbeat") and could never read LATE.

## What this adds
| File | What it does |
|---|---|
| `01_job_heartbeat_hours.sql` | Four empty columns on `job_heartbeat` (working hours) and the judge honours them. A row with no hours is judged as today. |
| `02_putcall_heartbeat_row.sql` | The counter's row: owed Mon–Fri 09:30–16:00 ET, LATE after 15 min of silence, FAILING after 3 failed landings. Plus `scin_putcall_night_line(date)`, read-only, for the night watchman. |
| `supabase/functions/ibkr-ingest/` (`index.ts`, `heartbeat.mjs`) | After each landing the function pings that row (at most once a minute; a failed write pings a failure). The ping can never fail a landing. |
| `*_ROLLBACK.sql`, `current-bodies/`, `ibkr-ingest.DEPLOYED-20261005/` | The way back: the judge body and the function source that were live on 5 Oct. |
| `dryrun/` | The SQL executed on a throw-away Postgres with a copy of the 156 live rows. |

The brief named the row `mac:ibkr-putcall`. The row Q2b registered is `mac:com.scintilla.ibkr-putcall`; it is kept, so the
jobs board does not show the same job twice.

## Neighbours, checked together
- **`ibkr_gateway_watch` (cron 275)** — untouched. It stays the loud, repeating alarm. The heartbeat adds one message when
  the counter goes LATE and one when it is back, on the same phone channel, and a row on the jobs board. Same outage, two
  routes: the old one reads the table, the new one is silence at the door.
- **`job_heartbeat_check` (cron 288)** — untouched; it calls the judge and sends from the events the judge writes.
- **The other 155 rows** — judged by the live body and the new body at 11 moments (1,716 comparisons): 0 differences.
- **`putcall-minute-session-check` (cron 273)** and the `ibkr_putcall_minute` feed contract (66 h) — untouched.
- **A market holiday on a weekday** — the counter lands around the clock while the Gateway is logged in, so nothing is raised.
  With the Gateway down on a holiday it would read LATE at 09:45 ET (as `ibkr_gateway_watch` already alerts on holidays).
- **The close** — a row LATE at 16:00 stays LATE until the counter reports again; the bell never sends "back to normal".

## Dry run (`PGLITE_DIR=<folder with @electric-sql/pglite> node dryrun/r2-dryrun.mjs`)
Replaying 4–5 Oct: weekend silent → UP · Mon 09:44 → UP · **Mon 09:45 → LATE** · 16:05 → LATE · 20:37 landing → UP ·
overnight logout → UP · 80 silent minutes mid-session → LATE · one failed landing → UP, three → FAILING · both rollbacks
restore the live judge and the row's terms. Result: `dryrun/r2-dryrun-result.json`.

## Order for the coordinator
1. `01_job_heartbeat_hours.sql`, then `02_putcall_heartbeat_row.sql` (SQL editor or `supabase db query --linked -f`).
   Nothing changes on any screen; the row stays NEW until step 2.
2. `supabase functions deploy ibkr-ingest --no-verify-jwt --project-ref wadinxqplrggagkvrdag` from this branch
   (the function is deployed with sign-in checking OFF today — the Mac presents its own ingest token — keep it off).
3. Read back within a minute while the counter is running:
   `select status, armed, last_ok_at, status_note from job_heartbeat where job = 'mac:com.scintilla.ibkr-putcall';` → armed, UP.
   `select public.scin_putcall_night_line(current_date);`
4. Then update the night watchman's files (provider branch runbook, section 3).

**Way back:** redeploy `ibkr-ingest.DEPLOYED-20261005/` (same flag) · `02_…_ROLLBACK.sql` · `01_…_ROLLBACK.sql`.
To silence only: `update job_heartbeat set alarm = false where job = 'mac:com.scintilla.ibkr-putcall';`
