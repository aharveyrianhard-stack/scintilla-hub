CREATE OR REPLACE PROCEDURE public.system_audit_run()
 LANGUAGE plpgsql
AS $procedure$
declare nowts bigint := extract(epoch from now())::bigint;
begin
  -- per-timeframe ready counts (the table)
  insert into system_audit_log(run_ts,check_name,detail,value,status)
  select nowts,'tf_ready', v.tf,
    count(*) filter (where exists(select 1 from ohlcv_history o where o.ticker=t.ticker and o.tf=v.tf order by o."timestamp" offset 229 limit 1)),
    case when count(*) filter (where exists(select 1 from ohlcv_history o where o.ticker=t.ticker and o.tf=v.tf order by o."timestamp" offset 229 limit 1))>=192 then 'ok' else 'filling' end
  from tickers t cross join (values('5'),('15'),('30'),('60'),('120'),('180'),('240'),('6h'),('12h'),('D'),('3D'),('W'),('2W'),('1M')) v(tf)
  where t.active group by v.tf;
  -- completeness: live geiger blanks + crypto-null structure
  insert into system_audit_log(run_ts,check_name,detail,value,status)
  select nowts,'geiger_nulls','composite_staged', count(*) filter (where composite is null), case when count(*) filter (where composite is null)=0 then 'ok' else 'bad' end from composite_staged where tf='D';
  insert into system_audit_log(run_ts,check_name,detail,value,status)
  select nowts,'structure_null','grad null (any tf=D)', count(*), case when count(*)=0 then 'ok' else 'flag' end
  from structure_state s join tickers t on t.ticker=s.ticker where s.tf='D' and s.grad is null and t.active;
  -- freshness
  insert into system_audit_log(run_ts,check_name,detail,value,status)
  select nowts,'freshness','geiger_min_ago', round((nowts-max(updated_ts))/60.0), case when nowts-max(updated_ts)<300 then 'ok' else 'stale' end from composite_staged where tf='D';
  commit;
end $procedure$
