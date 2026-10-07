# F1 loader fixes — staged for the coordinator (nothing deployed, nothing scheduled)

Source of the new code: Hub branch `hub/f1-full-treatment-20261003` @ `b5edfd6` (commit `c79140f`, "why new names did
not get everything"). Runbook: provider `runbooks/F1_FULL_TREATMENT_20261003.md` §2. F1's loads 1–5 were applied by the
coordinator on 5 Oct; this is what is left of §2.

## What was checked on 5 Oct (K1)
| function | live today | live = release branch? | F1 version | parses | F1 change in one line |
|---|---|---|---|---|---|
| `fmp-fundamentals` | v12 · JWT **on** · job 10 (`7 */6 * * *`, sends the header) | yes, byte for byte (`ad6b8b1854ff`) | `f2b63808bdec` | yes | a company with no statements goes first (5 a run), then the old round-robin; honours `tickers.fmp_symbol` |
| `fmp-analyst` | v11 · JWT **on** · job 11 (`17 */4 * * *`) | yes (`22db5f4a25f8`) | `de9572c020a7` | yes | newcomers first (10 a run); `fmp_symbol` |
| `fmp-events` | v12 · JWT **on** · job 12 (`37 */6 * * *`) | yes (`0f2d1b1a1bb1`) | `d13e96b3f0ec` | yes | newcomers first (10 a run); `fmp_symbol` |
| `fmp-backfill` | v14 · JWT **off** · job 18 `bf-profile` daily (jobs 15–17, 19–20 inactive) | yes (`05bcd8c576f3`) | `e639110b8f77` | yes | new `?job=etf`: a fund's holdings are replaced only when FMP answers with a list |
| `dossier-facts` | **not deployed** (new) | — | `6286618e4629` | yes | READ's BUSINESS / CATALYSTS / WATCH from stored facts, for names with no dossier |

"Parses" = the TypeScript-stripped source parses as a module (not run). F1's own tests on that branch: 10 of 10
(`tests/f1-facts-dossier.test.mjs`, `tests/f1-loader-slice.test.mjs`). The four `rollback/<function>/index.ts` files here
are the deployed sources downloaded 5 Oct (read-only); none holds a credential.

## The one thing the runbook does not say: the JWT setting per function
Get this wrong and the schedule "succeeds" while every call is refused (pg_cron only reports that the request was
queued — this is how jobs 10 and 12 returned 401 for three days in September).
- `fmp-fundamentals`, `fmp-analyst`, `fmp-events`: JWT is **on** and their jobs send the header → deploy **without** `--no-verify-jwt`.
- `fmp-backfill`: JWT is **off** and its jobs send no header → deploy **with** `--no-verify-jwt`.
- `dossier-facts`: F1's schedule (`dossier-facts-1h`) sends **no** header, and the runbook's dry check is a plain `curl`
  → deploy **with** `--no-verify-jwt`. (Same exposure as `read-engine` and `bf-profile` today: the address can be called by
  anyone; it only writes facts rows for names with no dossier, 60 a run.)

## Steps (from a checkout of `hub/f1-full-treatment-20261003`)
```
P=wadinxqplrggagkvrdag
supabase functions deploy fmp-fundamentals --project-ref $P
supabase functions deploy fmp-analyst      --project-ref $P
supabase functions deploy fmp-events       --project-ref $P
supabase functions deploy fmp-backfill     --project-ref $P --no-verify-jwt
supabase functions deploy dossier-facts    --project-ref $P --no-verify-jwt
```
(each bundles `supabase/functions/_shared/`). Then, in this order:
1. Dry check, nothing written: `curl 'https://wadinxqplrggagkvrdag.supabase.co/functions/v1/dossier-facts?dry=1&sym=AAOI'` → one row, `"dry":true`.
2. `supabase functions list --project-ref $P` → the four at v13 / v12 / v13 / v15 with the JWT settings above; `dossier-facts` v1, JWT off.
3. Schedules: `supabase/migrations/20261003_f1_loader_schedules.sql` (`dossier-facts-1h` at :52, `bf-etf-weekly` Sundays 07:40 UTC).
   Rollback `…_loader_schedules_ROLLBACK.sql`.
4. Read back after the next runs (never trust "succeeded" alone):
   `select count(*) from ticker_context where enrich_sources='FACTS:f1-v1' and enriched_ts > now() - interval '2 hours';` → above 0 after :52;
   `select key, value from app_config where key in ('fund_offset','analyst_offset','events_offset');` → moves on each loader run;
   `select status_code, count(*) from net._http_response where created > now() - interval '2 hours' group by 1;` → no new 401 / 404 rows.

## Rollback
`supabase functions deploy <name> --project-ref $P [--no-verify-jwt as above]` from a folder holding `rollback/<name>/index.ts`
as `supabase/functions/<name>/index.ts`; `supabase functions delete dossier-facts --project-ref $P`; the schedules' rollback file.

## Neighbours (3 Oct rule)
- The three loaders keep their busy locks and offsets (`fund_offset`, `analyst_offset`, `events_offset`); only the round-robin part
  moves the offset, so a run full of newcomers does not skip the old lap.
- `fmp-backfill?job=etf` shares no lock with `bf-profile` (06:25 daily); the weekly pass is Sundays 07:40.
  It deletes and rewrites one fund's holdings rows at a time — never when FMP answers with nothing. The 61 funds loaded by hand
  on 5 Oct (12,757 lines) will be rewritten by it on its first Sunday.
- `dossier-facts` never touches a real dossier (any other `enrich_sources`, or any words); `read-engine` (every 10 min) picks its rows up.
- K1's fund FUNDAMENTALS panel (branch `hub/k1-backlog-20261005`) reads `etf_info` / `etf_holdings`: it gains from `job=etf`, needs nothing else.
