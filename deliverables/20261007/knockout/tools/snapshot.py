# KO1 · step 1 of the run (see README.md) · ONE read of every public table the study needs, for the whole universe, saved beside the run (never committed raw).
# Read-only, GET only, the Hub's public read key. ~150 requests instead of ~10 per company per comps set.
import sb,json,time,datetime as d,os,sys
TODAY=d.date(2026,10,6); db=lambda n:(TODAY-d.timedelta(days=n)).isoformat()
os.makedirs("snap",exist_ok=True); t0=time.time(); meta={}
PLAN=[
 ("company_profile","company_profile?select=ticker,name,exchange,sector,industry,market_cap,price,shares_out,is_etf,is_fund,is_adr,is_actively_trading,country,ipo_date,updated_ts,shares_outstanding,float_shares,dividend_yield,facts_as_of&order=ticker.asc"),
 ("fundamentals","fundamentals?select=*&order=ticker.asc"),
 ("ticker_industry","ticker_industry?select=ticker,fmp_industry,fmp_sector,sic_code,sic_description&order=ticker.asc"),
 ("tickers","tickers?select=*&order=ticker.asc"),
 ("ticker_cohorts","ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc"),
 ("cohort_tree","cohort_tree?select=*&order=cohort.asc"),
 ("cohort_tree_members","cohort_tree_members?select=*&order=cohort.asc,ticker.asc"),
 ("station_lists","station_lists?select=*&order=list.asc,position.asc"),
 ("hub_favorites","hub_favorites?select=ticker,added_at&order=ticker.asc"),
 ("fmp_peers","fmp_peers?select=ticker,peer,position,fetched_at&order=ticker.asc,position.asc"),
 ("peer_sources","peer_sources?select=ticker,peer,source,position,fetched_at&order=ticker.asc,source.asc,position.asc"),
 ("filer_currency","filer_currency?select=ticker,reported_currency,listing_currency,is_adr,shares_dil,statement_date,source&order=ticker.asc"),
 ("fx_rates",f"fx_rates?select=pair,date,rate&date=gte.{db(1200)}&order=date.asc,pair.asc"),
 ("composite_staged","composite_staged?select=ticker,tf,composite,updated_ts&tf=eq.D&order=ticker.asc,updated_ts.desc"),
 ("analyst_estimates",f"analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_eps_high,est_eps_low,est_revenue_avg,price_target_avg,num_analysts_eps,num_analysts_rev,updated_ts&period=eq.annual&fiscal_date=gte.2025-01-01&order=ticker.asc,fiscal_date.asc"),
 ("analyst_estimates_daily","analyst_estimates_daily?select=ticker,fiscal_date,as_of_date,eps_avg,revenue_avg,analysts_eps&period=eq.annual&fiscal_date=gte.2026-01-01&order=ticker.asc,fiscal_date.asc,as_of_date.asc"),
 ("fundamentals_history",f"fundamentals_history?select=*&fiscal_date=gte.{db(1500)}&order=ticker.asc,fiscal_date.desc"),
 ("cashflow_history",f"cashflow_history?select=ticker,period,fiscal_year,fiscal_date,operating_cf,capex,free_cf,stock_comp&fiscal_date=gte.{db(2200)}&order=ticker.asc,fiscal_date.desc"),
 ("balance_history",f"balance_history?select=*&fiscal_date=gte.{db(800)}&order=ticker.asc,fiscal_date.desc"),
 ("earnings_events","earnings_events?select=ticker,date,eps_actual,eps_estimate,revenue_actual,revenue_estimate,surprise_pct,report_time,confirmed,superseded_at&date=gte.2024-06-01&order=ticker.asc,date.asc"),
 ("analyst_ratings","analyst_ratings?select=*&order=ticker.asc"),
 ("price_target_summary_daily",f"price_target_summary_daily?select=ticker,as_of_date,last_month_count,last_month_avg,last_quarter_count,last_quarter_avg,last_year_count,last_year_avg&as_of_date=gte.{db(10)}&order=ticker.asc,as_of_date.asc"),
 ("ticker_heartbeat_daily",f"ticker_heartbeat_daily?select=ticker,date,usual_day_20,usual_day_60,usual_day_250,atr_pct_14,n&date=gte.{db(6)}&order=ticker.asc,date.asc"),
 ("etf_holdings","etf_holdings?select=ticker,asset,name,weight_pct,updated_ts&order=ticker.asc,weight_pct.desc"),
 ("composite_history","composite_history?select=snapshot_date,ticker,tf,trend,momentum,composite,source,as_of&source=eq.CHART_API_GEIGER&snapshot_date=gte.2026-09-20&order=snapshot_date.asc,ticker.asc"),
]
only=set(sys.argv[1:])
for name,path in PLAN:
    if only and name not in only: continue
    if not only and os.path.exists(f"snap/{name}.json"): print("have",name); continue
    try:
        g0=sb.N_GET; rows=sb.paged(path); json.dump(rows,open(f"snap/{name}.json","w"))
        meta[name]={"rows":len(rows),"gets":sb.N_GET-g0,"path":path,"read_utc":d.datetime.utcnow().isoformat()+"Z"}
        print(f"{name:28s} rows {len(rows):6d} gets {sb.N_GET-g0:3d}  {round(time.time()-t0)}s",flush=True)
    except Exception as e:
        meta[name]={"error":str(e)[:300]}; print(name,"ERROR",str(e)[:300],flush=True)
old=json.load(open("snap/_meta.json")) if os.path.exists("snap/_meta.json") else {}
old.update(meta); json.dump(old,open("snap/_meta.json","w"),indent=1)
print("total GETs",sb.N_GET,"in",round(time.time()-t0),"s")
