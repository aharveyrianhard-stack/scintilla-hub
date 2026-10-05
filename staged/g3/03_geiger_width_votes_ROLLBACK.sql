-- G3 · ROLLBACK of 03_geiger_width_votes.sql: refresh_geiger() exactly as read on 5 Oct 2026 (the fixed 3-hour rule),
-- then the two helper functions and the tf_not_voting column are removed (the column only ever held G3's marks).
do $g3$
begin
  if to_regprocedure('public.geiger_width_votes(bigint)') is null then
    raise exception 'G3-03 rollback: geiger_width_votes() is not there - nothing to undo';
  end if;
end
$g3$;
CREATE OR REPLACE FUNCTION public.refresh_geiger()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  g uuid := '00000000-0000-0000-0000-000000000000';
  wt double precision := coalesce((select weight from public.operator_weights where dim='family' and key='TREND' and enabled and owner_id=g),0.5);
  wm double precision := coalesce((select weight from public.operator_weights where dim='family' and key='MOMENTUM' and enabled and owner_id=g),0.5);
  cut bigint := extract(epoch from now())::bigint;
begin
  delete from public.composite_staged where ticker not in (select ticker from public.tickers where active);
  insert into public.composite_staged
    (ticker,tf,composite,trend,momentum,core,tf_contributors,updated_ts)
  select m.ticker,'D',
         round((case when fd.read is null then m.mom else (wt*fd.read+wm*m.mom)/nullif(wt+wm,0) end)::numeric,4),
         round(fd.read::numeric,4),round(m.mom::numeric,4),
         round((case when fd.read is null then m.mom else (wt*fd.read+wm*m.mom)/nullif(wt+wm,0) end)::numeric,4),
         m.n,cut
  from (
    select r.ticker,case when sum(w.w)>0 then sum(r.read*w.w)/sum(w.w) else avg(r.read) end mom,count(*) n
    from public.ribbon_signals r
    join public.tickers t on t.ticker=r.ticker and t.active
    join lateral (select coalesce((select ow.weight from public.operator_weights ow
      where ow.dim='timeframe' and ow.owner_id=g and ow.enabled and ow.key=case r.tf
        when '1' then '1m' when '3' then '3m' when '5' then '5m' when '10' then '10m'
        when '15' then '15m' when '30' then '30m' when '60' then '1h' when '120' then '2h'
        when '180' then '3h' when '240' then '4h' when '6h' then '6h' when '12h' then '12h'
        when 'D' then '1d' when '3D' then '3d' when 'W' then '1w' when '2W' then '2w'
        when '1M' then '1M' else r.tf end),0) w) w on true
    where r.family='MOMENTUM' and r.updated_ts>cut-10800
      and not exists (select 1 from public.provider_owned_equities() poe where poe.ticker=r.ticker)
    group by r.ticker
  ) m
  left join lateral (select read from public.fan_daily f where f.ticker=m.ticker and f.asof<=current_date order by f.asof desc limit 1) fd on true
  on conflict (ticker,tf) do update set composite=excluded.composite,trend=excluded.trend,
    momentum=excluded.momentum,core=excluded.core,tf_contributors=excluded.tf_contributors,
    updated_ts=excluded.updated_ts;
  delete from public.composite_staged cs
  where cs.tf='D' and cs.updated_ts<cut-14400
    and not exists (select 1 from public.provider_owned_equities() poe where poe.ticker=cs.ticker);
end
$function$
;

drop function if exists public.geiger_width_votes(bigint);
drop function if exists public.geiger_fresh_bar_types();
alter table public.composite_staged drop column if exists tf_not_voting;
-- CHECK AFTER: select md5(prosrc) from pg_proc where oid = 'public.refresh_geiger()'::regprocedure;  -- 187ad5b7caab41620ba3fe0fea3ea97f
