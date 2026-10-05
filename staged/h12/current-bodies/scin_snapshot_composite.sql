CREATE OR REPLACE FUNCTION public.scin_snapshot_composite()
 RETURNS TABLE(taken_for date, rows_written integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  d date := (now() at time zone 'America/New_York')::date;
  n int;
begin
  insert into composite_history as h
    (snapshot_date, ticker, tf, trend, momentum, volatility,
     conviction, core, composite, source_ts, as_of, source)
  select d, c.ticker, c.tf, c.trend, c.momentum, c.volatility,
         c.conviction, c.core, c.composite, c.updated_ts, to_timestamp(c.updated_ts),
         case when (to_timestamp(c.updated_ts) at time zone 'America/New_York')::date < d
              then 'COMPOSITE_STAGED_CARRIED' else 'COMPOSITE_STAGED' end
  from composite_staged c
  on conflict (snapshot_date, ticker, tf) do update
    set trend=excluded.trend, momentum=excluded.momentum,
        volatility=excluded.volatility, conviction=excluded.conviction, core=excluded.core,
        composite=excluded.composite, source_ts=excluded.source_ts,
        as_of=excluded.as_of, source=excluded.source,
        captured_at=now()
    where h.source is null or h.source not like 'CHART_API_GEIGER%';
  get diagnostics n = row_count;
  return query select d, n;
end $function$
