-- CW6 (22 Oct 2026) · rollback of 20261022_comps_fmp_answers.sql. The COMPS tab falls back to the store files on its own
-- (sources.mjs: a table read that fails is ignored), so dropping the table changes nothing the page shows beyond freshness.
drop policy if exists comps_fmp_answers_read on public.comps_fmp_answers;
drop index if exists public.comps_fmp_answers_fetched_at_idx;
drop table if exists public.comps_fmp_answers;
