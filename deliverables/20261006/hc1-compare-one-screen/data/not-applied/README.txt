NOT APPLIED — kept for the record only.

The first HC1 run (6 Oct, 18:54-19:14 ET) found why FAVORITES stopped taking names: public.station_lists allowed
positions 1-64 (station_lists_position_check) and the list held 64. It wrote the two SQL files here (cap 64 -> 500, with a
guarded rollback) and proved them on a local Postgres engine (migration-check.mjs -> migration-check.json). It then ran
out of credit before committing.

At ~19:40 ET the coordinator fixed the table himself: the check is now 256 (his rollback:
_archive/backend-fix-20260928/ROLLBACK-station-lists-cap-20261006.sql) and STM, TXN, ADI, CRWD, NET, OKTA, EQIX were
appended (71 names; read back by GET on 6 Oct 23:45 ET). His word to this lane: "do NOT change the table."

So these files are NOT a migration and must not be run. They were moved out of supabase/migrations/ for that reason.
What is still worth reading in them: the Hub reads FAVORITES and RADAR in ONE request and the API returns at most 1,000
rows; the Hub's write path trims every position above what it read. Two lists of 256 (512 rows) fit that answer whole,
so the coordinator's 256 is safe. A cap above 500 would not be, until that read is paged.

migration-check.json also records the database engine's own words for the refusal (SQLSTATE 23514, "… violates check
constraint "station_lists_position_check""), which is what tests/hc1-favorites-cap.test.mjs feeds the page.
