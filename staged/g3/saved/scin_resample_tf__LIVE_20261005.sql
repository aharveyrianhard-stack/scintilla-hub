-- G3 · SAVED COPY, read 5 Oct 2026 with pg_get_functiondef. Not changed by G3; file 01 only calls it.
CREATE OR REPLACE FUNCTION public.scin_resample_tf(p_ticker text, p_src text, p_dst text, p_from bigint DEFAULT 0)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
declare
  secs bigint;
  n    int;
begin
  select seconds into secs from timeframe_registry where tf = p_dst;
  if secs is null then raise exception 'unknown destination timeframe: % (not in timeframe_registry)', p_dst; end if;
  if not exists (select 1 from timeframe_registry where tf = p_src) then
    raise exception 'unknown source timeframe: %', p_src;
  end if;

  with src as (
    select timestamp, open, high, low, close,
           case
             when p_dst = 'D'  then extract(epoch from date_trunc('day',  to_timestamp(timestamp)))::bigint
             when p_dst = 'W'  then extract(epoch from date_trunc('week', to_timestamp(timestamp)))::bigint
             when p_dst = '2W' then extract(epoch from date_trunc('week', to_timestamp(timestamp))
                                            - (extract(week from to_timestamp(timestamp))::int % 2) * interval '1 week')::bigint
             when p_dst = '1M' then extract(epoch from date_trunc('month', to_timestamp(timestamp)))::bigint
             when p_dst = '3D' then extract(epoch from (
                    date '2000-01-03' +
                    (floor((to_timestamp(timestamp)::date - date '2000-01-03') / 3) * 3) * interval '1 day'
                  ))::bigint
             else (timestamp / secs) * secs
           end bucket
      from ohlcv_history
     where ticker = p_ticker and tf = p_src and timestamp >= p_from
  ),
  folded as (
    select bucket ts,
           (array_agg(open  order by timestamp))[1]      o,
           max(high)                                     h,
           min(low)                                      l,
           (array_agg(close order by timestamp desc))[1] c,
           count(*)                                      src_bars
      from src group by bucket
  ),
  fresh as (
    select f.* from folded f
     where f.src_bars >= case when p_dst in ('W','2W','1M') then 3 when p_dst in ('D','3D') then 2 else 2 end
       -- completed buckets only on interval frames: the forming bucket never publishes
       and (p_dst in ('D','3D','W','2W','1M') or f.ts + secs <= extract(epoch from now())::bigint)
       and not exists (
         select 1 from ohlcv_history x
          where x.ticker = p_ticker and x.tf = p_dst and x.timestamp = f.ts
            and x.source not like 'resampled:%'
       )
  ),
  ins as (
    insert into ohlcv_history (ticker, tf, timestamp, open, high, low, close, source, inserted_at)
    select p_ticker, p_dst, ts, o, h, l, c,
           'resampled:' || p_src, extract(epoch from now())::bigint
      from fresh
    on conflict (ticker, tf, timestamp, source) do update
       set open = excluded.open, high = excluded.high, low = excluded.low,
           close = excluded.close
    returning 1
  )
  select count(*) into n from ins;
  return n;
end $function$
;
