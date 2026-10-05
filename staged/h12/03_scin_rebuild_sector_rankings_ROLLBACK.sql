-- H12 03 ROLLBACK: the body of public.scin_rebuild_sector_rankings as it ran on 5 Oct 2026 (read with
-- pg_get_functiondef before H12 wrote anything). Restores the composite_staged read. Run before 02/01 rollbacks.
CREATE OR REPLACE FUNCTION public.scin_rebuild_sector_rankings(p_date date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
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
           count(*)         n_names
      from sectors s
      join ticker_membership m on m.group_key = s.group_key and m.kind = s.kind
      join composite_staged c  on c.ticker = m.ticker and c.tf = 'D'
     where c.trend is not null and c.momentum is not null
     group by s.sector_code, s.sector_name
    having count(*) >= 3          -- a "sector" of two names is not a sector reading
  ),
  ranked as (select *, row_number() over (order by score desc) rnk from scored),
  ins as (
    insert into sector_rankings (date, sector, sector_name, rank, score, trend, momentum, method, updated_at)
    select p_date, sector_code, sector_name, rnk,
           round(score::numeric, 4), round(trend::numeric, 4), round(momentum::numeric, 4),
           'constituent mean, composite_staged D: 0.5*trend+0.5*momentum, n=' || n_names,
           now()
      from ranked
    on conflict (date, sector) do update
       set sector_name = excluded.sector_name, rank = excluded.rank, score = excluded.score,
           trend = excluded.trend, momentum = excluded.momentum,
           method = excluded.method, updated_at = now()
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $function$
;
