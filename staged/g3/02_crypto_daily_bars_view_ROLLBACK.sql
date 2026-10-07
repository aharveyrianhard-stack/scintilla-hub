-- G3 · ROLLBACK of 02_crypto_daily_bars_view.sql: the view exactly as read on 5 Oct 2026 (pg_get_viewdef).
do $g3$
begin
  if position('crypto' in pg_get_viewdef('public.ohlcv_daily_adj'::regclass)) = 0 then
    raise exception 'G3-02 rollback: the view does not carry the G3 change - nothing to undo';
  end if;
end
$g3$;
create or replace view public.ohlcv_daily_adj as
 SELECT a.ticker,
    'D'::text AS tf,
    EXTRACT(epoch FROM a.d)::bigint AS "timestamp",
    a.adj_o::double precision AS open,
    a.adj_h::double precision AS high,
    a.adj_l::double precision AS low,
    a.adj_c::double precision AS close,
    'FMP'::text AS source,
    EXTRACT(epoch FROM a.fetched_at)::bigint AS inserted_at
   FROM eod_adjusted a
UNION ALL
 SELECT h.ticker,
    h.tf,
    h."timestamp",
    h.open,
    h.high,
    h.low,
    h.close,
    h.source,
    h.inserted_at
   FROM ohlcv_history h
  WHERE h.tf = 'D'::text AND NOT (EXISTS ( SELECT 1
           FROM eod_adjusted a2
          WHERE a2.ticker = h.ticker));
