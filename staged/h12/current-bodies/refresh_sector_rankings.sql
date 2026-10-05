CREATE OR REPLACE FUNCTION public.refresh_sector_rankings()
 RETURNS void
 LANGUAGE sql
AS $function$
  INSERT INTO public.sector_rankings (date, sector, sector_name, rank, score, trend, momentum, method, updated_at)
  SELECT current_date, cs.ticker, v.nm,
         rank() OVER (ORDER BY cs.composite DESC),
         cs.composite, cs.trend, cs.momentum,
         'composite_staged D: 0.5*trend+0.5*momentum', now()
  FROM public.composite_staged cs
  JOIN (VALUES ('XLK','Technology'),('XLC','Communication Svcs'),('XLY','Consumer Discretionary'),('XLF','Financials'),('XLI','Industrials'),('XLB','Materials'),('XLE','Energy'),('XLV','Health Care'),('XLP','Consumer Staples'),('XLU','Utilities'),('XLRE','Real Estate')) v(t,nm) ON v.t = cs.ticker
  WHERE cs.tf = 'D'
    AND EXISTS (SELECT 1 FROM public.ticker_cohorts tc WHERE tc.ticker = cs.ticker AND tc.cohort = 'MACRO')
  ON CONFLICT (date, sector) DO UPDATE
    SET rank = EXCLUDED.rank, score = EXCLUDED.score, trend = EXCLUDED.trend,
        momentum = EXCLUDED.momentum, sector_name = EXCLUDED.sector_name,
        method = EXCLUDED.method, updated_at = now();
$function$
