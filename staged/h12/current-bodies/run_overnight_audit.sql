CREATE OR REPLACE FUNCTION public.run_overnight_audit()
 RETURNS void
 LANGUAGE plpgsql
AS $function$
declare et text := to_char(now() at time zone 'America/New_York','MM-DD HH12:MI AM');
  mkt boolean := coalesce((select equity_open from market_state where id=1), false);
  r record; _age bigint;
  geiger_expected int := (select count(*) from tickers t where t.active
                           and t.ticker not in (select ticker from public.provider_owned_equities()));
begin
  -- avg_tfs gate recalibrated 2026-08-19: 14 was the equity-era bound; the healthy non-equity
  -- lane measures avg 7.9 tf contributors, so 6 is the below-current-floor degradation tripwire.
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'GEIGER', case when count(*)=geiger_expected and (extract(epoch from now())::bigint-max(updated_ts))<360 and count(*) filter (where composite is null)=0 and avg(tf_contributors)>=6 then 'GREEN' else 'FLAG' end,
    'tickers '||count(*)||'/'||geiger_expected||' (non-equity lane) · fresh '||round(((extract(epoch from now())::bigint-max(updated_ts))/60.0)::numeric,1)||'min · nulls '||count(*) filter (where composite is null)||' · avg_tfs '||round(avg(tf_contributors)::numeric,1) from composite_staged where tf='D';
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'RIBBON', case when count(distinct tf)>=17 then 'GREEN' else 'FLAG' end, 'distinct_tf '||count(distinct tf)||'/17' from ribbon_signals;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'PRICE_EQUITY', case when not mkt then 'INFO' when stale>5 then 'FLAG' else 'GREEN' end, stale||' of '||n||' stale>15m · worst '||w||'min' from (
    select count(*) n, count(*) filter (where age>15) stale, round(max(age)::numeric,1) w from (select (extract(epoch from now())-extract(epoch from q.updated_ts))/60.0 age from live_quotes q join tickers t on t.ticker=q.ticker where t.active and (t.type in ('stock','etf','index') or t.type is null)) a) z;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'PRICE_CRYPTO', case when w>10 then 'FLAG' else 'GREEN' end, 'worst '||w||'min' from (select round(max((extract(epoch from now())-extract(epoch from q.updated_ts))/60.0)::numeric,1) w from live_quotes q join tickers t on t.ticker=q.ticker where t.active and t.type='crypto') z;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'PRICE_FUTURES', case when w>20 then 'FLAG' else 'GREEN' end, 'worst '||w||'min' from (select round(max((extract(epoch from now())-extract(epoch from q.updated_ts))/60.0)::numeric,1) w from live_quotes q join tickers t on t.ticker=q.ticker where t.active and t.type='future') z;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'CHG_PCT', case when nulls=0 then 'GREEN' else 'FLAG' end, nulls||' null chg_pct' from (select count(*) nulls from live_quotes q join tickers t on t.ticker=q.ticker where t.active and q.chg_pct is null) z;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'FWD_PE', case when bad=0 then 'GREEN' when bad<5 then 'INFO' else 'FLAG' end, bad||' tickers implausible fwd P/E' from (
    select count(*) bad from (select (select price from live_quotes where ticker=ae.ticker)/nullif(ae.est_eps_avg,0) pe from analyst_estimates ae join (select ticker, min(fiscal_date) fd from analyst_estimates where period='annual' and fiscal_date::date>=current_date group by ticker) nx on nx.ticker=ae.ticker and nx.fd=ae.fiscal_date join tickers t on t.ticker=ae.ticker and t.active where ae.period='annual') p where pe is not null and (pe<1 or pe>300)) z;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'NEWS', case when (extract(epoch from now())::bigint-max(updated_ts))<1200 then 'GREEN' else 'FLAG' end, round(((extract(epoch from now())::bigint-max(updated_ts))/60.0)::numeric,1)||'min' from news;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'SENTIMENT', case when (extract(epoch from now())::bigint-max(updated_ts))<1800 then 'GREEN' else 'FLAG' end, round(((extract(epoch from now())::bigint-max(updated_ts))/60.0)::numeric,1)||'min' from news_sentiment;
  insert into overnight_audit(run_at_et,area,status,note)
  select et,'READS', case when (extract(epoch from now())-extract(epoch from max(updated_ts)::timestamptz))<1800 then 'GREEN' else 'FLAG' end, round(((extract(epoch from now())-extract(epoch from max(updated_ts)::timestamptz))/60.0)::numeric,1)||'min' from read_blocks;
  insert into overnight_audit(run_at_et,area,status,note)
  values (et,'DB_SIZE', case when pg_total_relation_size('ohlcv_history')<1500000000 then 'GREEN' else 'FLAG' end, pg_size_pretty(pg_total_relation_size('ohlcv_history'))||' live');
  for r in select area, tbl, max_age_min, market_only from audit_targets loop
    begin
      execute format('select extract(epoch from now())::bigint - max(updated_ts) from %I', r.tbl) into _age;
      insert into overnight_audit(run_at_et,area,status,note)
      values (et, r.area,
        case when _age is null then 'FLAG' when r.market_only and not mkt then 'INFO' when _age > r.max_age_min*60 then 'FLAG' else 'GREEN' end,
        case when _age is null then 'no data' else round((_age/60.0)::numeric,1)||'min old (limit '||r.max_age_min||'m)' end);
    exception when others then
      insert into overnight_audit(run_at_et,area,status,note) values (et, r.area, 'FLAG', 'audit error: '||left(SQLERRM,60));
    end;
  end loop;
end $function$
