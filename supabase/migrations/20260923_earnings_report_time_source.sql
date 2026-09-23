-- 2026-09-23 · EVENTS earnings (M26) — where a report time came from.
--
-- WHY. An upcoming earnings row almost never carries a report time. MEASURED on
-- 2026-09-23 over the names the Hub tracks: of the 81 rows dated in the next 30
-- days, 2 carried a report_time; of the 42 rows in the 30 days behind, 39 did. So
-- the Hub's cards read "time unknown" for nearly every report that has not yet
-- happened — which is exactly what Alan saw on Costco, Micron and ASML.
-- Nasdaq's own earnings calendar states "before the open" or "after the close" for
-- 35 of those 81, including all three of the names he named.
--
-- WHAT THIS DOES. It adds nothing to the calendar itself: it adds the two columns
-- that make a filled time auditable — WHERE it came from and WHEN it was written.
-- A time whose source is not recorded can never be told apart from a guess, and a
-- guessed report time is worse than an honest "time not announced".
--
-- Nothing here changes report_time itself; scripts/earnings-report-time-backfill.mjs
-- does that, only where a source states a time, and only into rows that are empty.
alter table public.earnings_events
  add column if not exists report_time_source text,
  add column if not exists report_time_set_at  timestamptz;

comment on column public.earnings_events.report_time_source is
  'Where report_time came from: nasdaq-calendar | fmp | issuer-ir | manual. NULL means the value predates this column (or there is no value).';
comment on column public.earnings_events.report_time_set_at is
  'When report_time was last written by a backfill run. NULL means it was never written by one.';

create index if not exists earnings_events_report_time_source_idx
  on public.earnings_events (report_time_source);
