-- 2026-09-24 · M52 HEARTBEAT — where each name's own history starts.
--
-- WHY. The first two-year backfill was refused by this table's own 200% ceiling: ten daily series
-- in the chart API join an older security to the current one under the same ticker (BNY $10.20 ->
-- $138.98 across a 103-day hole on 21 May 2026; SPCX, SHAZ, MAGS, CORZ, P, DRAM, ARM, AGIX, ALAB).
-- heartbeat.mjs (hb-2) now measures only the bars after the last calendar gap longer than 20 days,
-- and this column says the date that history starts, so "±1.5% a day" can be read as "since BNY
-- Mellon took the ticker" and never as a year it does not have.
--
-- ADDITIVE: one nullable column, no data rewritten. Coordinator, applied 24 Sep 2026.
-- ROLLBACK (exact):
--     alter table public.ticker_heartbeat_daily drop column if exists history_from;
alter table public.ticker_heartbeat_daily add column if not exists history_from date;
comment on column public.ticker_heartbeat_daily.history_from is
  'The first daily bar the usual day was measured from. Normally the start of the served history; later when the ticker''s series joins an older security across a gap of more than 20 calendar days (hb-2), in which case only the name as it trades today is measured.';
