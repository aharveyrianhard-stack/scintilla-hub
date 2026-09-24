-- 2026-09-23 · EVENTS earnings (M34) — a moved report date, and the row it leaves behind.
--
-- WHY. Alan, 23 Sep: "It says eight past dates without stored results. What's up with that?"
-- Identity in this table is (ticker, date), and both writers upsert on that key —
-- fmp-events:       upsert(group, { onConflict: 'ticker,date' })
-- earnings-capture: upsert(group.slice(i, i+200), { onConflict: 'ticker,date' })
-- So when the provider moves a projected report date, the write INSERTS A SECOND ROW and the
-- first one stays for ever. It never receives a result, because the company never reported on
-- that day. fmp-events' own v10 comment says exactly this and lists cases (MU 09-22/09-30,
-- NKE 09-29/10-01, FDX 09-17/10-28). earnings-date-verify does move a date in place, but only
-- for rows dated in the next ten days that have no result yet, and its update collides with the
-- (ticker, date) key whenever a row already exists on the new date — so it cannot clean these up.
--
-- MEASURED 2026-09-23 over rows dated since 1 June: 28 dates carry no result while the same
-- company has a stored result within 45 days (ORCL 08 Sep beside the reported 10 Sep; ZS 01 and
-- 02 Sep beside 03 Sep; SNOW, NTAP and MDB 26 Aug beside 01-02 Sep ...), and 12 pairs of dates
-- carry the SAME result twice (AVGO 02+03 Sep, DELL 01+03 Sep, CRWD 26 Aug + 01 Sep ...).
--
-- WHAT THIS DOES. It adds three nullable columns and one index. NOTHING IS DELETED, renamed or
-- overwritten: a superseded row keeps every value it has, and simply stops being offered as a
-- report. Deleting a row would need Alan; this does not.
alter table public.earnings_events
  add column if not exists superseded_at      timestamptz,
  add column if not exists superseded_by_date date,
  add column if not exists superseded_reason  text;

comment on column public.earnings_events.superseded_at is
  'When this date was retired as a report date. NULL = live. The row is kept in full; readers ask for superseded_at is null.';
comment on column public.earnings_events.superseded_by_date is
  'The date of the same company''s report that this row gave way to. NULL when the reason names no replacement.';
comment on column public.earnings_events.superseded_reason is
  'Plain words: why this date was retired, and on what evidence. Written by the backfill/sweep, never guessed.';

-- the Hub reads live rows by date, so that is what the index serves
create index if not exists earnings_events_live_date_idx
  on public.earnings_events (date)
  where superseded_at is null;

-- ROLLBACK (both halves are reversible, in this order):
--   update public.earnings_events set superseded_at = null, superseded_by_date = null, superseded_reason = null;
--   drop index if exists public.earnings_events_live_date_idx;
--   alter table public.earnings_events
--     drop column if exists superseded_at,
--     drop column if exists superseded_by_date,
--     drop column if exists superseded_reason;
-- The Hub keeps working through either state: its reads ask for the filter, and fall back to
-- asking without it the moment the column answers 400 (index.html, pgErn).
