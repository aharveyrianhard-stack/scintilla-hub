# H12 — staged SQL (5 Oct 2026). Nothing here has been applied.

Order to apply: `01` → `02` → `03` → `04`, then (optional, later) `05`. Order to roll back: `04` → `03` → `02` → `01`.

| File | What it is | Kind | Who applies |
|---|---|---|---|
| `01_geiger_latest_d.sql` (+ `_ROLLBACK`) | New read-only function: newest daily Geiger per name, with its true time | additive | coordinator |
| `02_age_columns.sql` (+ `_ROLLBACK`) | Empty columns that record how old the inputs are | additive | coordinator |
| `03_scin_rebuild_sector_rankings.sql` (+ `_ROLLBACK`) | Sector ranking reads the newest reading, and says its age | body swap — changes numbers on the allocation page and four Station pages | with Alan's yes |
| `04_recompute_cohort_divergence.sql` (+ `_ROLLBACK`) | Peer comparison reads the newest reading | body swap — changes the "peers" sentence on the Hub READ text | with Alan's yes |
| `05_cron_sector_rankings_after_close.sql` | A second, evening run of the ranking | new schedule | after 03 is in |
| `90_RETIRE_PROPOSAL_waits_for_alan.sql` | Five things nothing reads | destructive, all commented out | Alan |
| `current-bodies/` | The ten live bodies exactly as read on 5 Oct, before anything was written | reference | — |
| `dryrun/` | The staged SQL run on a throw-away Postgres, and its result | proof | — |

`01` and `02` change nothing on any screen. `03` and `04` applied before H11's first evening write publish
the same numbers as today (the dry run asserts it) — the only difference is that the ranking's method text
then says, truthfully, "16 of 16 OLD". The numbers change on the first run after H11's rows exist.

After `03` is in and H11's write has landed, one manual run refreshes tonight's row instead of waiting for
tomorrow 17:15 ET: `select scin_rebuild_sector_rankings((now() at time zone 'America/New_York')::date);`

Not staged, and why:
- `read-engine` (edge function) still prints "compared on the legacy daily composite of 24 Aug" beside the
  peers sentence. After `04` the comparison is fresh, so that date would be wrong the other way. The fix is
  to select `as_of, cohort_as_of_oldest` from `cohort_divergence` and print that date. It is an edge-function
  deploy that changes Hub text: Alan's approval. `04` should go in together with it, or the sentence carries
  a stale date for the days in between.
- `run_overnight_audit`: its GEIGER line counts all 386 rows against an expected 22 and has been FLAG on
  every run. No screen reads `overnight_audit`. Changing a guard needs its neighbours listed; not done here.

Dry run: `PGLITE_DIR=<folder with node_modules/@electric-sql/pglite> node dryrun/h12-dryrun.mjs <input.json> <out.json>`.
The input is a read-only copy of the live rows; it is not committed. The result is `dryrun/h12-dryrun-result.json`.
