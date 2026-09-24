-- 2026-09-24 · M68 SIGMA HISTORY — two years of sigma events, and a daily count of them.
--
-- WHY. Alan, 24 Sep: "Are you capturing this going backwards for other companies? … How are you
-- registering the sigma? Against what is it computing? Where is it being saved? Is it on database?"
-- The events were only ever stored from the day the detector was switched on (23 Sep 2026). The
-- backfill (scintillas-detect ?mode=backfill) writes the two years before that into the SAME table,
-- with the SAME dedupe key, so nothing new has to be learned to read them.
--
-- WHAT THIS MIGRATION ADDS. Nothing is renamed, deleted or overwritten. It is two objects:
--   1. an index that makes "every sigma day for this session" cheap — the question the breadth
--      series and the Playbook study both ask, hundreds of times;
--   2. a view that counts, per session, how many names had a sigma day, up and down separately.
--      A view holds no data of its own: it is the same rows, counted.
--
-- THE BACKFILL NEEDS NO TABLE OF ITS OWN. It is resumable through the cursor in its own URL and
-- idempotent through the dedupe key already on public.scintillas, so the detector keeps its promise
-- of writing to exactly ONE table.
--
-- ROLLBACK (exact): see 20260924_scintillas_backfill_ROLLBACK.sql
--     drop view if exists public.scintilla_breadth_daily;
--     drop index if exists public.scintillas_session_idx;

-- the session a price move belongs to lives in detail->>'session' (a plain 'YYYY-MM-DD')
create index if not exists scintillas_session_idx
  on public.scintillas (kind, ((detail->>'session')) desc);

-- BREADTH OF THE UNUSUAL: one row per session, how many names moved further than their own usual
-- day, up and down separately. Alan reads this beside the Geiger: a market where many names are
-- unusual at once is a different market from one where a single name is.
create or replace view public.scintilla_breadth_daily as
select
  (detail->>'session')::date                                        as session,
  count(*)                                                          as events,
  count(*) filter (where direction > 0)                             as up,
  count(*) filter (where direction < 0)                             as down,
  count(distinct subject)                                           as names,
  count(*) filter (where detail->>'asset_class' = 'equity')         as equity,
  count(*) filter (where detail->>'asset_class' in ('index_etf','sector_etf')) as funds,
  count(*) filter (where (detail->'fired') ? 'statistical')         as statistical,
  count(*) filter (where (detail->'fired') ? 'raw')                 as raw,
  count(*) filter (where (detail->>'backfilled')::boolean is true)  as backfilled,
  min(ts)                                                           as first_ts,
  max(ts)                                                           as last_ts
from public.scintillas
where kind = 'price_outlier'
  and detail ? 'session'
  and (detail->>'session') ~ '^\d{4}-\d{2}-\d{2}$'
group by 1;

comment on view public.scintilla_breadth_daily is
  'One row per trading session: how many names had a sigma day, up and down separately, and which rule family said so. Counted from public.scintillas; holds no data of its own.';

grant select on public.scintilla_breadth_daily to anon, authenticated;
