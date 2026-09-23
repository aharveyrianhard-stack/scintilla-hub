-- 2026-09-23 · EVENTS earnings (M34) — retire the dates that were moved. IDEMPOTENT.
--
-- Run after 20260923_earnings_superseded.sql. Every statement only ever touches rows that are
-- still live (superseded_at is null), so running it twice changes nothing the second time, and
-- it is safe to schedule (see the note at the bottom).
--
-- IT WRITES ONLY WHERE THERE IS EVIDENCE IN THE DATABASE ITSELF. Two rules, nothing else:
--   A. a date with NO stored result, when the same company HAS a stored result within 21 days.
--      A quarter is about 90 days, so a report 21 days away is the same report, moved — not the
--      next one. 21 days, not 45: it leaves the far-apart cases to a person.
--   B. two dates carrying the SAME result within 7 days, where exactly ONE of them is the day
--      the company's earnings call is stored against. The call is the evidence; the other date
--      is the provider's older guess. MEASURED 2026-09-23: this decides all 12 such pairs.
-- Anything else is left alone and listed by the SELECT at the end, for a person to judge.

-- ---- A. the date that was moved ------------------------------------------------------------
update public.earnings_events e
   set superseded_at      = now(),
       superseded_by_date = x.kept,
       superseded_reason  = 'moved date: no result was ever stored here, and this company''s report of '
                            || x.kept || ' is ' || abs(x.kept - x.stale_date) || ' day(s) away (M34 backfill, 2026-09-23)'
  from (
    select s.ticker, s.date as stale_date, m.date as kept
      from public.earnings_events s
      cross join lateral (
        select r.date
          from public.earnings_events r
         where r.ticker = s.ticker
           and r.date <> s.date
           and r.superseded_at is null
           and (r.eps_actual is not null or r.revenue_actual is not null)
           and abs(r.date - s.date) <= 21
         order by abs(r.date - s.date), r.date
         limit 1
      ) m
     where s.eps_actual is null
       and s.revenue_actual is null
       and s.superseded_at is null
  ) x
 where e.ticker = x.ticker and e.date = x.stale_date and e.superseded_at is null;

-- ---- B. the same result stored twice -------------------------------------------------------
update public.earnings_events e
   set superseded_at      = now(),
       superseded_by_date = x.kept,
       superseded_reason  = 'duplicate result: the same figures are stored on ' || x.kept
                            || ', which is the day this company''s earnings call is stored against (M34 backfill, 2026-09-23)'
  from (
    select b.ticker, b.date as dup_date, a.date as kept
      from public.earnings_events a
      join public.earnings_events b
        on b.ticker = a.ticker
       and b.date <> a.date
       and abs(b.date - a.date) <= 7
       and a.eps_actual     is not distinct from b.eps_actual
       and a.revenue_actual is not distinct from b.revenue_actual
     where a.eps_actual is not null
       and a.superseded_at is null
       and b.superseded_at is null
       and     exists (select 1 from public.earnings_call_transcripts c where c.ticker = a.ticker and c.call_date = a.date)
       and not exists (select 1 from public.earnings_call_transcripts c where c.ticker = b.ticker and c.call_date = b.date)
  ) x
 where e.ticker = x.ticker and e.date = x.dup_date and e.superseded_at is null;

-- ---- what is left for a person -------------------------------------------------------------
-- Near-duplicate dates this backfill deliberately did NOT judge: two dates neither of which has
-- a result (the provider is still moving a future date), and result pairs the call date cannot
-- separate. Nothing is written here.
select a.ticker,
       a.date as date_a, b.date as date_b, (b.date - a.date) as days_apart,
       (a.eps_actual is not null) as a_reported, (b.eps_actual is not null) as b_reported,
       a.confirmed as a_confirmed, b.confirmed as b_confirmed
  from public.earnings_events a
  join public.earnings_events b
    on b.ticker = a.ticker and b.date > a.date and (b.date - a.date) <= 21
 where a.superseded_at is null and b.superseded_at is null
 order by a.date desc;

-- SCHEDULING (the durable half, for the coordinator to decide — see the deliverable):
-- the two UPDATEs above are idempotent and cheap, so the same file can be run by pg_cron every
-- ten minutes beside earnings-sweep-generic. That retires a stale row within ten minutes of the
-- provider moving a date, without deploying or changing any edge function:
--   select cron.schedule('earnings-superseded-sweep', '*/10 * * * *', $$ ...the two UPDATEs... $$);
