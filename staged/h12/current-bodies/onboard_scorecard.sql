CREATE OR REPLACE FUNCTION public.onboard_scorecard(p text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
AS $function$
  with ty as (
    select coalesce(
      (select case when is_etf then 'etf' else 'stock' end from company_profile where ticker=p),
      (select type from tickers where ticker=p)
    ) t
  )
  select jsonb_build_object(
    'ticker', p,
    'type', (select t from ty),
    'profile_ok', (select (name is not null and price is not null and avg_volume is not null) from company_profile where ticker=p),
    'battery_ok', (select (price is not null) from live_quotes where ticker=p),
    'daily_bars', (select count(*) from ohlcv_history where ticker=p and tf='D'),
    'intraday_tfs', (select count(distinct tf) from ohlcv_history where ticker=p and tf in ('1','5','15','30','60','240')),
    'statistics', (select count(*) from statistics where ticker=p),
    'structure_tfs', 'retired',
    'rvol', (select count(*) from ribbon_series where ticker=p and kind='rvol'),
    'composite', (select composite from composite_staged where ticker=p and tf='D'),
    'news', (select count(*) from news where ticker=p),
    'dossier', (select narrative is not null from ticker_context where ticker=p),
    'etf_holdings', case when (select t from ty)='etf' then (select count(*) from etf_holdings where ticker=p) else null end,
    'etf_info', case when (select t from ty)='etf' then (select etf_info is not null from company_profile where ticker=p) else null end,
    'estimates', case when (select t from ty)='etf' then 'n/a' else (select count(*)::text from analyst_estimates where ticker=p) end,
    'fundamentals_hist', case when (select t from ty)='etf' then 'n/a' else (select count(*)::text from fundamentals_history where ticker=p) end,
    'earnings_qtrs', (select count(*) from earnings_events where ticker=p and eps_actual is not null),
    'transcripts', (select count(*) from earnings_call_transcripts where ticker=p)
  );
$function$
