-- H12 03 (5 Oct 2026) — REPLACES ONE FUNCTION BODY. Needs 01 and 02 first.
-- Rollback: 03_scin_rebuild_sector_rankings_ROLLBACK.sql (the body live on 5 Oct, saved before this was written).
--
-- WHAT WAS WRONG [MEASURED 5 Oct, read-only]: cron 233 (15 21 * * 1-5 UTC) calls this; it averages each
-- sector's members from composite_staged. 11 of the 13 rows (the SPDR sectors) and the METALS row are
-- averages of stock readings last computed 24 Aug 15:07Z, re-published every evening under the day's date.
-- Only CRYPTO is built from fresh rows.
--
-- WHAT CHANGES: one thing — the member readings come from scin_geiger_latest_d() (newest reading per
-- name, with its as_of) instead of composite_staged. Same sectors, same members, same formula
-- (mean of 0.5*trend + 0.5*momentum), same >= 3 names rule, same rank, same key, same signature.
-- Each row now also says how old its inputs are: as_of_oldest / as_of_newest / n_names / n_old, and the
-- method text (which the Station prints verbatim) carries the reading date and, when any member is old,
-- how many. Nothing is held back: a sector whose members are all old is still published, and says so.
--
-- NEIGHBOURS: cron 233 unchanged. refresh_sector_rankings (cron 199) writes the same table but has
-- written 0 rows since 10 Aug (its MACRO-cohort filter matches no fund) — no collision. Readers name
-- their columns; the method text has no test pinned to it in the Hub or Station suites (checked).
create or replace function public.scin_rebuild_sector_rankings(p_date date default current_date)
 returns integer
 language plpgsql
as $function$
declare n int;
begin
  with sectors as (
    select v.group_key, v.spdr sector_code, v.vendor_sector sector_name, 'sector'::text kind
      from sector_vendor_map v
     where v.spdr is not null
    union all
    select 'CRYPTO', 'CRYPTO', 'Crypto',            'sector'
    union all select 'METALS', 'METALS', 'Metals & Mining', 'cohort'
  ),
  scored as (
    select s.sector_code, s.sector_name,
           avg(c.trend)     trend,
           avg(c.momentum)  momentum,
           avg(0.5 * c.trend + 0.5 * c.momentum) score,
           count(*)         n_names,
           min(c.as_of)     as_of_oldest,
           max(c.as_of)     as_of_newest,
           count(*) filter (where c.as_of is null
                               or (c.as_of at time zone 'America/New_York')::date < p_date - 4) n_old
      from sectors s
      join ticker_membership m on m.group_key = s.group_key and m.kind = s.kind
      join scin_geiger_latest_d() c on c.ticker = m.ticker
     where c.trend is not null and c.momentum is not null
     group by s.sector_code, s.sector_name
    having count(*) >= 3          -- a "sector" of two names is not a sector reading
  ),
  ranked as (select *, row_number() over (order by score desc) rnk from scored),
  ins as (
    insert into sector_rankings (date, sector, sector_name, rank, score, trend, momentum, method, updated_at,
                                 as_of_oldest, as_of_newest, n_names, n_old)
    select p_date, sector_code, sector_name, rnk,
           round(score::numeric, 4), round(trend::numeric, 4), round(momentum::numeric, 4),
           'constituent mean, newest daily Geiger per name: 0.5*trend+0.5*momentum, n=' || n_names
             || ' · readings ' || coalesce(to_char(as_of_oldest at time zone 'America/New_York', 'YYYY-MM-DD'), 'undated')
             || case when (as_of_oldest at time zone 'America/New_York')::date
                          is distinct from (as_of_newest at time zone 'America/New_York')::date
                     then ' to ' || to_char(as_of_newest at time zone 'America/New_York', 'YYYY-MM-DD') else '' end
             || case when n_old > 0 then ' · ' || n_old || ' of ' || n_names || ' OLD' else '' end,
           now(), as_of_oldest, as_of_newest, n_names, n_old
      from ranked
    on conflict (date, sector) do update
       set sector_name = excluded.sector_name, rank = excluded.rank, score = excluded.score,
           trend = excluded.trend, momentum = excluded.momentum,
           method = excluded.method, updated_at = now(),
           as_of_oldest = excluded.as_of_oldest, as_of_newest = excluded.as_of_newest,
           n_names = excluded.n_names, n_old = excluded.n_old
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $function$;
