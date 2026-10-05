-- G3 · STAGED, NOT APPLIED · 5 Oct 2026 · the two voting rules of the non-equity Geiger (cron 57 geiger-1m)
-- RULE 1: a bar size whose newest stored bar is older than two bar-lengths does not vote; its weight leaves the sum
--   (the remaining weights are renormalised - the formula already divides by the sum of the weights that vote) and
--   the size is written, with its bar date and the reason, in composite_staged.tf_not_voting.
-- RULE 2: a bar size votes from the moment its reading is made until its next bar is due, plus one bar-length of
--   grace for a late ribbon job (reading younger than two bar-lengths; never less than 15 minutes) - not for a fixed
--   3 hours.
-- WHY "DROPPED AND MARKED", NOT "CARRIED": the stock Geiger carries a whole NAME (last value, shown with its age and
--   cause - G1). One bar size inside a blended number cannot show an age: carried, it is exactly the stale reading
--   dressed as today's. So inside the blend it is dropped and named. The NAME follows the stock rule: if no bar
--   size of a coin can vote, its row is kept with its own old updated_ts (age visible) and is no longer deleted
--   after 4 hours.
-- WHERE THE OLD RULE LIVED [MEASURED 5 Oct]: one line of refresh_geiger - "r.updated_ts > cut - 10800". updated_ts is
--   the time the ribbon job ran, not the bar's date, so a job that re-reads 58-day-old bars every night votes as
--   today's, and a 12-hour reading that is perfectly current stops counting 3 hours after it was made.
-- SCOPE: the new rules apply to the tickers whose type is listed by geiger_fresh_bar_types() - 'crypto' (9 coins).
--   The other 13 non-equities (6 futures, 6 rates, VIX) keep the live rule to the row: checked - the dry run gives
--   them the same number to 4 decimals. Their bars have a worse illness (most stop 11-14 Aug) and need their own
--   repair before the rule is widened; widening is one word in that function. Stocks and funds are published by the
--   provider and are not touched by refresh_geiger at all.
-- EFFECT ON WHAT THE HUB SHOWS: yes - the nine coins' Geiger. NEEDS ALAN'S WORD (3 Oct rule).
-- LIVENESS (3 Oct "a little wrong rather than a little old"): nothing here can hold a cycle. Every minute the job
--   publishes each coin from whatever sizes can vote; a size that cannot is named, never waited for.
-- ADDITIVE PART: one new nullable column composite_staged.tf_not_voting (jsonb); two new functions.
-- NEIGHBOURS CHECKED: weights (operator_weights, global owner) and the "all weights zero -> plain mean" fallback:
--   unchanged; the trend half (fan_daily) and the 0.5/0.5 family blend: unchanged; the purge of inactive tickers:
--   unchanged; the 4-hour purge: unchanged for the 13, off for coins (see above); provider_owned_equities(): still
--   excluded; scin_snapshot_composite / composite_history (cron 209) name their columns - unaffected by the new
--   column; vacuum job 237: unaffected; geiger_for_user() has its OWN copy of the 3-hour line and serves all names
--   per user - not changed here, reported; X2's staged 02 (coin candles every 5 min): still inside two bar-lengths.
--   The mark is rewritten only when it changes, so no extra row rewrites per minute.
-- PATTERN: Prometheus - a series with no fresh sample inside the lookback window returns no value instead of its
--   last one, and stale series are marked (prometheus.io/docs/prometheus/latest/querying/basics/#staleness).
-- ORDER: apply 01 and 02 first, then this file AFTER the next 02:34 UTC ribbon-3d run. The guard below refuses
--   while a coin's 3-day reading is older than its refreshed 3-day bars.
-- ROLLBACK: 03_geiger_width_votes_ROLLBACK.sql (puts back saved/refresh_geiger__LIVE_20261005.sql byte for byte).
do $g3$
declare bad text;
begin
  if (select md5(prosrc) from pg_proc where oid = to_regprocedure('public.refresh_geiger()')) is distinct from '187ad5b7caab41620ba3fe0fea3ea97f' then
    raise exception 'G3-03: refresh_geiger() is not the body read on 5 Oct (already applied, or changed) - read it again before applying';
  end if;
  select string_agg(r.ticker, ',') into bad
    from public.ribbon_signals r
    join public.tickers t on t.ticker = r.ticker and t.active and t.type = 'crypto'
   where r.family = 'MOMENTUM' and r.tf = '3D'
     and r.updated_ts < (select min(h.inserted_at) from public.ohlcv_history h
                          where h.ticker = r.ticker and h.tf = '3D' and h."timestamp" > 1786147200);  -- bars after 8 Aug 2026
  if bad is not null then
    raise exception 'G3-03: the 3-day reading of % was made before its 3-day bars were refreshed - wait for the 02:34 UTC ribbon-3d run', bad;
  end if;
end
$g3$;

alter table public.composite_staged add column if not exists tf_not_voting jsonb;
comment on column public.composite_staged.tf_not_voting is
  'G3: the weighted bar sizes left out of this reading, each with its newest bar and the reason. NULL = every weighted size voted (or the old 3-hour rule applies to this ticker).';

create or replace function public.geiger_fresh_bar_types()
 returns text[]
 language sql
 immutable
as $fn$ select array['crypto']::text[] $fn$;

create or replace function public.geiger_width_votes(p_now bigint default (extract(epoch from now()))::bigint)
 returns table(ticker text, tf text, tf_key text, w double precision, read double precision, read_ts bigint,
               bar_ts bigint, secs bigint, new_rule boolean, votes boolean, why text)
 language sql
 stable
 set search_path to 'public'
as $fn$
  with r as (
    select rs.ticker, rs.tf, rs.read, rs.updated_ts as read_ts,
           coalesce(t.type = any (public.geiger_fresh_bar_types()), false) as new_rule,
           case rs.tf
             when '1' then '1m' when '3' then '3m' when '5' then '5m' when '10' then '10m'
             when '15' then '15m' when '30' then '30m' when '60' then '1h' when '120' then '2h'
             when '180' then '3h' when '240' then '4h' when '6h' then '6h' when '12h' then '12h'
             when 'D' then '1d' when '3D' then '3d' when 'W' then '1w' when '2W' then '2w'
             when '1M' then '1M' else rs.tf end as tf_key
      from public.ribbon_signals rs
      join public.tickers t on t.ticker = rs.ticker and t.active
     where rs.family = 'MOMENTUM'
       and not exists (select 1 from public.provider_owned_equities() poe where poe.ticker = rs.ticker)
  ), x as (
    select r.*,
           coalesce((select ow.weight from public.operator_weights ow
                      where ow.dim = 'timeframe' and ow.owner_id = '00000000-0000-0000-0000-000000000000'::uuid
                        and ow.enabled and ow.key = r.tf_key), 0)::double precision as w,
           (select reg.seconds from public.timeframe_registry reg where reg.tf = r.tf)::bigint as secs,
           -- the bar the ribbon job itself reads: the daily view for 'D', the bar table for every other size
           case when not r.new_rule then null
                when r.tf = 'D' then (select max(v."timestamp") from public.ohlcv_daily_adj v where v.ticker = r.ticker and v.tf = 'D')
                else (select max(h."timestamp") from public.ohlcv_history h where h.ticker = r.ticker and h.tf = r.tf)
           end as bar_ts
      from r
  )
  select x.ticker, x.tf, x.tf_key, x.w, x.read, x.read_ts, x.bar_ts, x.secs, x.new_rule,
         case when not x.new_rule or x.secs is null then coalesce(x.read_ts > p_now - 10800, false)   -- the live rule, kept
              else x.read_ts is not null and x.bar_ts is not null
                   and p_now - x.bar_ts < 2 * x.secs                       -- RULE 1: newest bar is the forming one or the one just closed
                   and p_now - x.read_ts < greatest(2 * x.secs, 900)       -- RULE 2: until the next bar is due + one bar-length of grace
         end as votes,
         case when not x.new_rule or x.secs is null then null
              when x.read_ts is null then 'no reading'
              when x.bar_ts is null then 'no bar stored'
              when p_now - x.bar_ts >= 2 * x.secs then 'no fresh bar'
              when p_now - x.read_ts >= greatest(2 * x.secs, 900) then 'reading too old'
         end as why
    from x
$fn$;
revoke all on function public.geiger_width_votes(bigint) from public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_geiger()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare
  g uuid := '00000000-0000-0000-0000-000000000000';
  wt double precision := coalesce((select weight from public.operator_weights where dim='family' and key='TREND' and enabled and owner_id=g),0.5);
  wm double precision := coalesce((select weight from public.operator_weights where dim='family' and key='MOMENTUM' and enabled and owner_id=g),0.5);
  cut bigint := extract(epoch from now())::bigint;
begin
  delete from public.composite_staged where ticker not in (select ticker from public.tickers where active);
  insert into public.composite_staged
    (ticker,tf,composite,trend,momentum,core,tf_contributors,updated_ts)
  select m.ticker,'D',
         round((case when fd.read is null then m.mom else (wt*fd.read+wm*m.mom)/nullif(wt+wm,0) end)::numeric,4),
         round(fd.read::numeric,4),round(m.mom::numeric,4),
         round((case when fd.read is null then m.mom else (wt*fd.read+wm*m.mom)/nullif(wt+wm,0) end)::numeric,4),
         m.n,cut
  from (
    -- G3: which bar sizes vote is decided in geiger_width_votes() (rules 1 and 2 for coins, the 3-hour rule for the rest)
    select v.ticker,case when sum(v.w)>0 then sum(v.read*v.w)/sum(v.w) else avg(v.read) end mom,count(*) n
    from public.geiger_width_votes(cut) v
    where v.votes
    group by v.ticker
  ) m
  left join lateral (select read from public.fan_daily f where f.ticker=m.ticker and f.asof<=current_date order by f.asof desc limit 1) fd on true
  on conflict (ticker,tf) do update set composite=excluded.composite,trend=excluded.trend,
    momentum=excluded.momentum,core=excluded.core,tf_contributors=excluded.tf_contributors,
    updated_ts=excluded.updated_ts;
  -- G3: a coin with no bar size able to vote keeps its last row, with its own old updated_ts (carried, age visible)
  delete from public.composite_staged cs
  where cs.tf='D' and cs.updated_ts<cut-14400
    and not exists (select 1 from public.provider_owned_equities() poe where poe.ticker=cs.ticker)
    and not exists (select 1 from public.tickers t where t.ticker=cs.ticker and t.type = any (public.geiger_fresh_bar_types()));
  -- G3: name the weighted bar sizes that were left out (rewritten only when it changes)
  update public.composite_staged cs set tf_not_voting = k.j
  from (
    select v.ticker,
           jsonb_agg(jsonb_build_object('tf',v.tf_key,'weight',v.w,'why',v.why,
                       'newest_bar',to_char(to_timestamp(v.bar_ts) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'),
                       'reading_made',to_char(to_timestamp(v.read_ts) at time zone 'UTC','YYYY-MM-DD"T"HH24:MI"Z"'))
                     order by v.w desc, v.tf_key)
             filter (where not v.votes and v.w > 0) j
    from public.geiger_width_votes(cut) v
    where v.new_rule
    group by v.ticker
  ) k
  where cs.ticker = k.ticker and cs.tf = 'D' and cs.tf_not_voting is distinct from k.j;
end
$function$;
-- CHECK AFTER (a minute later):
--   select ticker, composite, tf_contributors, tf_not_voting, to_timestamp(updated_ts) from composite_staged
--    where ticker in (select ticker from tickers where active and type='crypto') order by 1;
--   select tf_key, w, votes, why, to_timestamp(bar_ts) from geiger_width_votes() where ticker='BTCUSD' order by w desc;
