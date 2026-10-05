-- H12 04 (5 Oct 2026) — REPLACES ONE FUNCTION BODY. Needs 01 and 02 first.
-- Rollback: 04_recompute_cohort_divergence_ROLLBACK.sql (the body live on 5 Oct, saved before this was written).
--
-- WHAT WAS WRONG [MEASURED 5 Oct, read-only]: cron 25 (every 5 minutes) calls this; it compares each
-- name's composite_staged reading with its cohort's mean. 364 of its 386 inputs are 24 Aug readings, so
-- every stock's "in line / DIVERGENT" flag is a 24 Aug comparison recomputed 288 times a day. The reader
-- is the read-engine edge function (cron 27, every 10 minutes), which writes the sentence
-- "Against its <cohort> peers it is diverging from the group / roughly in line" into read_blocks — the
-- READ text on the Hub's company view. 391 names carry that sentence today, 84 of them "diverging".
--
-- WHAT CHANGES: one thing — the readings come from scin_geiger_latest_d() instead of composite_staged.
-- Same cohort (tickers.cohort), same mean, same rule (|gap| >= 0.3 and opposite signs), same key.
-- Each row now also carries as_of / source (this name's reading), cohort_as_of_oldest (the oldest
-- reading inside its cohort's mean) and updated_at.
-- The set of names grows from the 386 in composite_staged to every name with a reading (612 after
-- H11's first evening): 226 served names that never had a peer comparison get one, and each cohort's
-- mean is taken over all of its names instead of the subset that happened to be in the old table.
--
-- NOT CHANGED: no row is deleted. 5 rows in cohort_divergence belong to names no longer in
-- composite_staged (AVB, BRK.A, EQR, UUP, VXX — the function has never removed a row). Two of them have a
-- live reading and are refreshed; the other three stay as they are, and their empty as_of marks them.
-- Removing them is a delete, which is Alan's call.
--
-- NEIGHBOURS: cron 25 unchanged. read-engine names its columns (ticker,cohort,geiger,cohort_mean,flag),
-- so it keeps working; its sentence still prints the date of composite_staged ("compared on the legacy
-- daily composite of 24 Aug") until read-engine is changed to print cohort_divergence.as_of — that is an
-- edge-function deploy and waits for Alan (see README). recompute_news_cohort (cron 34) does not read this table.
create or replace function public.recompute_cohort_divergence()
 returns void
 language sql
as $function$
  WITH g AS (
    SELECT cs.ticker, COALESCE(t.cohort,'UNCLASSIFIED') AS cohort, cs.composite AS geiger, cs.as_of, cs.source
    FROM scin_geiger_latest_d() cs LEFT JOIN tickers t ON t.ticker=cs.ticker
    WHERE cs.composite IS NOT NULL),
  m AS (SELECT cohort, avg(geiger) cm, min(as_of) oldest FROM g GROUP BY cohort)
  INSERT INTO cohort_divergence(ticker,cohort,geiger,cohort_mean,divergence,flag,as_of,source,cohort_as_of_oldest,updated_at)
  SELECT g.ticker, g.cohort, round(g.geiger::numeric,4), round(m.cm::numeric,4), round((g.geiger-m.cm)::numeric,4),
    CASE WHEN abs(g.geiger-m.cm)>=0.3 AND ((g.geiger>=0)<>(m.cm>=0)) THEN 'DIVERGENT' ELSE 'inline' END,
    g.as_of, g.source, m.oldest, now()
  FROM g JOIN m ON m.cohort=g.cohort
  ON CONFLICT (ticker) DO UPDATE SET cohort=EXCLUDED.cohort, geiger=EXCLUDED.geiger,
    cohort_mean=EXCLUDED.cohort_mean, divergence=EXCLUDED.divergence, flag=EXCLUDED.flag,
    as_of=EXCLUDED.as_of, source=EXCLUDED.source, cohort_as_of_oldest=EXCLUDED.cohort_as_of_oldest,
    updated_at=EXCLUDED.updated_at;
$function$;
