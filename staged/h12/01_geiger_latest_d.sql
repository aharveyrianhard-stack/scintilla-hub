-- H12 01 (5 Oct 2026) — ADDITIVE. One place that answers "what is each name's newest daily Geiger, and when
-- was it computed". Rollback: 01_geiger_latest_d_ROLLBACK.sql. Apply BEFORE 03 and 04.
--
-- WHY: composite_staged holds 386 tf=D rows; 364 of them (provider-owned stocks and funds) were last written
-- 24 Aug 2026 15:07Z, 22 non-equities are rewritten every minute by refresh_geiger (cron 57). The live
-- reading for the 590 provider-owned names is the chart API /geiger; from tonight H11's job writes it into
-- composite_history each evening with source 'CHART_API_GEIGER' (or '..._CARRIED') and its true as_of.
--
-- RULE (one, plain): per name, the reading with the NEWEST as_of wins, whichever table holds it.
--   - a stock tonight      -> composite_history, CHART_API_GEIGER, as_of this evening
--   - a crypto / future    -> composite_staged, as_of this minute
--   - the live writer missed a night -> the last live evening still wins over the 24 Aug row
--   - a name the live writer has never written -> its composite_staged row, with its real (old) as_of
-- Nothing is ever withheld: an old reading is returned with its age, and the callers print that age
-- (Alan, 3 Oct: publish and mark, never hold). Before H11's first write this returns exactly what
-- composite_staged holds, so applying it early changes nothing.
--
-- NEIGHBOURS: reads only. composite_staged, refresh_geiger (cron 57), composite_history, cron 209 and
-- H11's publish_composite_history_v1 are not touched. Runs as its caller (cron = postgres); under the
-- staged Q4 access rules both tables stay readable to the public key, so nothing changes there either.
create or replace function public.scin_geiger_latest_d()
 returns table(ticker text, composite double precision, trend double precision,
               momentum double precision, as_of timestamptz, source text)
 language sql
 stable
 set search_path to 'public'
as $function$
  select distinct on (u.ticker) u.ticker, u.composite, u.trend, u.momentum, u.as_of, u.source
  from (
    select h.ticker, h.composite, h.trend, h.momentum,
           coalesce(h.as_of, to_timestamp(h.source_ts)) as as_of, h.source, 0 as pref
      from composite_history h
     where h.tf = 'D' and h.source like 'CHART_API_GEIGER%' and h.composite is not null
    union all
    select c.ticker, c.composite, c.trend, c.momentum,
           to_timestamp(c.updated_ts), 'COMPOSITE_STAGED', 1
      from composite_staged c
     where c.tf = 'D'
  ) u
  order by u.ticker, u.as_of desc nulls last, u.pref
$function$;
comment on function public.scin_geiger_latest_d() is
  'Newest daily Geiger per name with its true as_of: composite_history live rows (CHART_API_GEIGER%) or composite_staged, whichever is newer (H12, 5 Oct 2026).';
