# fmp-economic — staged change: `unit_rule` (not deployed)

**What it is.** The economic-calendar loader stores, beside each row's three numbers, whether they agree on a
scale: `as supplied` · `rescaled to <field>` · `ambiguous`. It changes no number: actual / estimate / previous
stay exactly what FMP sent. (24 Sep: New Home Sales arrived as actual 684 and previous 607, in thousands, with
estimate 0.62, in millions.)

**Files here**
- `index.v12-LIVE-ROLLBACK.ts` — the deployed source, downloaded 5 Oct 2026 (version 12, `verify_jwt` false,
  last deployed 16 Aug). This is the rollback.
- `index.ts` — the candidate: v12 plus three edits (the rule, the field on the row, a safe write). A test
  (`tests/k1-backlog-20261005.test.mjs`) proves it differs from v12 only there and that its rule gives the
  same verdicts as the Hub's and the detector's.

**For the coordinator (edge-function deploys are yours)**
1. Column (additive, nullable): `deliverables/20260924/econ-news/migrations/20260924_econ_calendar_unit_rule.sql`.
   Rollback: `alter table public.econ_calendar drop column if exists unit_rule;`
2. Deploy: copy `index.ts` to `supabase/functions/fmp-economic/index.ts`, then
   `supabase functions deploy fmp-economic --project-ref wadinxqplrggagkvrdag --no-verify-jwt`
   (v12 runs with `verify_jwt` false; keep it).
3. Read back after the next pass (05:47 / 17:47 UTC, or the hourly `?only=recent`):
   `select unit_rule, count(*) from econ_calendar where updated_ts > extract(epoch from now()) - 7200 group by 1;`
   Expect mostly `as supplied`.
4. Rollback: deploy `index.v12-LIVE-ROLLBACK.ts` the same way.

**Order does not matter.** If the function is live before the column exists (or after it is dropped), the
write falls back to exactly what v12 wrote, so the calendar never stops over this note.

**Neighbours checked (3 Oct rule: no new rule without its neighbours)**
- `econ_calendar_drop_moved()` (cron 269, hourly): deletes re-timed rows by key; it does not read `unit_rule`.
- `econ_calendar_unified` (view) and `public.econ_unify`: compute the same verdict themselves; unchanged.
- The Hub's ECONOMIC room (`ecNormalize`) and `scintillas-detect` (`econUnify`): read actual / estimate /
  previous, which this change does not touch.
- The upsert key (`event_ts,country,event`), the cadence, the FMP calls and the busy lock are unchanged.
