CREATE OR REPLACE FUNCTION public.refresh_ribbon_geiger()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE n int;
BEGIN
  n := compute_ribbon_trend('D');
  UPDATE composite_staged cs SET
    trend = rs.read,
    core = round((0.34*rs.read+0.30*cs.momentum+0.24*cs.structure+0.12*cs.volatility)::numeric,4)::float,
    composite = round((cs.conviction*(0.34*rs.read+0.30*cs.momentum+0.24*cs.structure+0.12*cs.volatility))::numeric,4)::float,
    updated_ts = extract(epoch from now())::bigint
  FROM ribbon_signals rs
  WHERE rs.ticker=cs.ticker AND rs.tf='D' AND rs.family='TREND' AND cs.tf='D';
  RETURN n;
END $function$
