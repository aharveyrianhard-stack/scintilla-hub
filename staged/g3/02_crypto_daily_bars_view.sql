-- G3 · STAGED, NOT APPLIED · 5 Oct 2026 · the coins' DAILY reading is made from today's daily bars again
-- WHAT: the view public.ohlcv_daily_adj (the only place the ribbon job reads daily bars) passes the coins' own
--   daily bars straight through, as its header comment always said it should ("raw passthrough for crypto").
-- WHY [MEASURED 5 Oct 23:30Z]: the view serves the dividend-adjusted table eod_adjusted for any name that has a row
--   in it, and hides that name's ordinary daily bars. On 14 Aug the nine coins were loaded into eod_adjusted
--   (2,155-5,000 rows each, newest 14 Aug, never refreshed). Since then the ribbon job's daily reading for every coin
--   is computed on bars that end 14 Aug with today's price pasted on the last one. All nine read +1.00 (the maximum)
--   tonight; recomputed on the live Coinbase daily bars they read between -0.03 (XRP) and +0.80 (ADA). The daily
--   width carries the heaviest weight in the Geiger (3.18 of 16.61) and is in the vote all day.
--   Coins pay no dividends and do not split: there is nothing to adjust.
-- EFFECT ON WHAT THE HUB SHOWS: yes - the coins' daily reading and their Geiger, within 15 minutes (ribbon-d runs
--   every 15 min). NEEDS ALAN'S WORD (3 Oct rule). Stocks, funds, futures, rates and the VIX: the view returns
--   exactly the rows it returns today.
-- NOT ADDITIVE: this replaces a view definition (no table is written, no row deleted). Saved copy:
--   saved/ohlcv_daily_adj__LIVE_20261005.sql.
-- NEIGHBOURS CHECKED: readers of the view or of eod_adjusted - ribbon-engine (daily width, all names),
--   scin_rsi_gap, scin_rsi_flip, scin_proof_check, refresh_adjust_factors, adjusted_coverage_gaps. For coins they
--   start to see the Coinbase daily bars (source 'COINBASE', 0 duplicate days in the newest 230) in place of the
--   14 Aug FMP copy. The futures (ES NQ CL DX GC SI) and the VIX have the same illness but BOTH their copies stop in
--   August (eod_adjusted 14 Aug, ohlcv_history 11-12 Aug), so passing them through would fix nothing: left alone,
--   reported. Columns, order and types are unchanged, so grants and options stay as they are.
-- ROLLBACK: 02_crypto_daily_bars_view_ROLLBACK.sql
do $g3$
declare v text := pg_get_viewdef('public.ohlcv_daily_adj'::regclass);
begin
  if position('crypto' in v) > 0 then raise exception 'G3-02: the view already passes coins through - nothing to do'; end if;
  if position('eod_adjusted a2' in v) = 0 then raise exception 'G3-02: the view changed since 5 Oct - read it again before applying'; end if;
end
$g3$;
create or replace view public.ohlcv_daily_adj as
 select a.ticker,
    'D'::text as tf,
    extract(epoch from a.d)::bigint as "timestamp",
    a.adj_o::double precision as open,
    a.adj_h::double precision as high,
    a.adj_l::double precision as low,
    a.adj_c::double precision as close,
    'FMP'::text as source,
    extract(epoch from a.fetched_at)::bigint as inserted_at
   from eod_adjusted a
  where not (exists ( select 1 from tickers tc where tc.ticker = a.ticker and tc.type = 'crypto'::text))
union all
 select h.ticker,
    h.tf,
    h."timestamp",
    h.open,
    h.high,
    h.low,
    h.close,
    h.source,
    h.inserted_at
   from ohlcv_history h
  where h.tf = 'D'::text and (not (exists ( select 1 from eod_adjusted a2 where a2.ticker = h.ticker))
     or exists ( select 1 from tickers tc where tc.ticker = h.ticker and tc.type = 'crypto'::text));
-- CHECK AFTER: select ticker, to_timestamp(max("timestamp"))::date, max(source) from ohlcv_daily_adj
--   where ticker in ('BTCUSD','ETHUSD','AAPL','ESUSD') group by 1;   -- BTC/ETH: today, COINBASE; AAPL and ESUSD unchanged
