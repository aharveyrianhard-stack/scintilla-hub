-- H12 04 ROLLBACK: the body of public.recompute_cohort_divergence as it ran on 5 Oct 2026 (read with
-- pg_get_functiondef before H12 wrote anything). Restores the composite_staged read. Run before 02/01 rollbacks.
-- Rows the new body added for names outside composite_staged stay (no delete here); they stop being refreshed.
CREATE OR REPLACE FUNCTION public.recompute_cohort_divergence()
 RETURNS void
 LANGUAGE sql
AS $function$
  WITH g AS (
    SELECT cs.ticker, COALESCE(t.cohort,'UNCLASSIFIED') AS cohort, cs.composite AS geiger
    FROM composite_staged cs LEFT JOIN tickers t ON t.ticker=cs.ticker
    WHERE cs.tf='D' AND cs.composite IS NOT NULL),
  m AS (SELECT cohort, avg(geiger) cm FROM g GROUP BY cohort)
  INSERT INTO cohort_divergence(ticker,cohort,geiger,cohort_mean,divergence,flag)
  SELECT g.ticker, g.cohort, round(g.geiger::numeric,4), round(m.cm::numeric,4), round((g.geiger-m.cm)::numeric,4),
    CASE WHEN abs(g.geiger-m.cm)>=0.3 AND ((g.geiger>=0)<>(m.cm>=0)) THEN 'DIVERGENT' ELSE 'inline' END
  FROM g JOIN m ON m.cohort=g.cohort
  ON CONFLICT (ticker) DO UPDATE SET cohort=EXCLUDED.cohort, geiger=EXCLUDED.geiger,
    cohort_mean=EXCLUDED.cohort_mean, divergence=EXCLUDED.divergence, flag=EXCLUDED.flag;
$function$
;
