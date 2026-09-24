# fmp-economic — proposed change (NOT written, NOT deployed)

**Why this is a proposal and not a patch.** `fmp-economic` is the live loader that writes
`public.econ_calendar`. It is not in git, this session has no Supabase MCP and no access token on this
machine, so I could not read the deployed source. The only local copy
(`SCINTILLA 0.5/supabase/functions/fmp-economic/index.ts`, 10 Jun) does not even write `econ_calendar`
any more — it writes `treasury_rates` and `econ_history`. Patching bytes I cannot read would be guessing,
so this file says exactly what to change instead.

## What is wrong
On 24 Sep the loader wrote New Home Sales (Aug) as **actual 684, previous 607** (thousands) with
**estimate 0.62** (millions). Anything that subtracts those is wrong by a factor of a thousand. By the
afternoon the row had been rewritten to 0.684 / 0.62 / 0.643, so the fault is **intermittent** — it lives
in the window between the first print and a later refresh.

## What NOT to do
**Do not rescale the values on the way in.** `econ_calendar` should keep exactly what the supplier sent:
that is the audit trail, and a loader that silently rewrites numbers cannot be checked against FMP later.
The Hub and the detector already put the row on one scale at the moment of use (M70), and
`econ_calendar_unified` does the same in SQL.

## What TO do — one field, no rewriting
1. Apply `migrations/20260924_econ_calendar_unit_rule.sql` (additive, nullable, rollback included).
2. At the point where a calendar row is built for upsert, call the shared rule and store its verdict
   **beside** the supplier's values:

```ts
// the identical rule the Hub (ecNormalize) and scintillas-detect (econUnify) apply
const u = econUnify({ actual: row.actual, estimate: row.estimate, previous: row.previous })
row.unit_rule = u.unit_fix ? 'rescaled to ' + u.unit_fix.ref : (u.unit_ambiguous ? 'ambiguous' : 'as supplied')
// row.actual / row.estimate / row.previous are NOT changed
```

   `econUnify` is ~35 lines and already tested: copy it from
   `supabase/functions/scintillas-detect/detect.mjs` (search for `THE SAME-SCALE TRIO`), or import the
   SQL function `public.econ_unify` if the loader would rather ask the database.

3. Nothing else changes: same table, same upsert key, same columns, same cadence.

## What this buys
Every consumer — including any that never reads the view — can see, per row, whether the supplier's three
numbers agreed on a scale, without having to work it out again. It also makes the fault countable: a query
for `unit_rule <> 'as supplied'` over a week says how often FMP actually does this.

## Do not undo
`public.econ_calendar_drop_moved()` (cron job 269) removes stale re-timed rows hourly and logs them in
`econ_calendar_moved_log`. Nothing proposed here interacts with it.
