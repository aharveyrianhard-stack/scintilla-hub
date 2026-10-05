-- K1 (5 Oct 2026) — the RESOLUTION LOG for the PREDICTION MARKETS section: every market the collector once read and no
-- longer reads (no row in the last 8 hours — the same window prediction_market_latest uses), with its last reading.
-- ADDITIVE: one read-only view over prediction_market_snapshots. No table, no column, no job, no row is changed.
-- security_invoker: the view reads with the caller's rights, so it shows exactly what the caller may already read in
-- prediction_market_snapshots (the Hub reads that table today) and nothing more.
-- ROLLBACK: 20261005_prediction_market_closed_ROLLBACK.sql (drop view).
--
-- how — in plain words, from what the collector stored (it does not store Polymarket's official resolution):
--   ENDED YES   its end date has passed and the last price we read was 99% or more
--   ENDED NO    its end date has passed and the last price we read was 1% or less
--   ENDED       its end date has passed with the last price in between
--   LEFT THE LIST   a most-traded ("discover") market that dropped out of Polymarket's most-traded list; still open
--   DELISTED    one of our tracked topics' markets that Polymarket stopped listing before its end date (often re-listed under a new id)
create or replace view public.prediction_market_closed with (security_invoker = true) as
with last_row as (
  select distinct on (venue, market_id, outcome)
         topic, venue, event_id, market_id, outcome, question, probability, ts as last_ts, end_date
    from public.prediction_market_snapshots
   order by venue, market_id, outcome, ts desc
), span as (
  select venue, market_id, outcome, min(ts) as first_ts, count(*)::int as readings
    from public.prediction_market_snapshots
   group by venue, market_id, outcome
)
select l.topic, l.venue, l.event_id, l.market_id, l.outcome, l.question, l.probability as last_probability,
       s.first_ts, l.last_ts, l.end_date, s.readings,
       case when l.end_date is not null and l.end_date <= now() and l.probability >= 0.99 then 'ENDED YES'
            when l.end_date is not null and l.end_date <= now() and l.probability <= 0.01 then 'ENDED NO'
            when l.end_date is not null and l.end_date <= now() then 'ENDED'
            when l.topic = 'discover' then 'LEFT THE LIST'
            else 'DELISTED' end as how
  from last_row l
  join span s using (venue, market_id, outcome)
 where l.last_ts < now() - interval '8 hours';

comment on view public.prediction_market_closed is
  'K1 5 Oct 2026: markets the prediction-markets collector no longer reads (no row in 8 h) with their last reading; read-only, security_invoker. Rollback: drop view.';
grant select on public.prediction_market_closed to anon, authenticated, service_role;
