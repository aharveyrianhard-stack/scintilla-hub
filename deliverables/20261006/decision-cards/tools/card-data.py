# CP1 · everything a decision card shows that is not the comps band: growth and estimates, the revisions held in the
# stored daily copies of the estimates, the last report, technicals (averages, RSI and Geiger against the name's OWN
# year, reviewed lines), and risk (its usual day against SPY's). Read-only: the Hub's public tables through its public
# read key (a private file in the working folder, never committed), the chart API's public /candles and /geiger, LB1's
# line extract. (Written by the 18:52 ET CP1 run; this run changed only where the names, prices and parents come from.)
# Run from the scratch folder after comps-run.mjs:  python3 <this file>
import json,urllib.request,urllib.parse,os,time,datetime as d,sys
import numpy as np
A="https://scintilla-massive-chart-api.fly.dev"; SB="https://wadinxqplrggagkvrdag.supabase.co"; KEY=open('.anon').read().strip()
TODAY=d.date.fromisoformat(os.environ.get('CP1_TODAY','2026-10-06'))
LB1=os.environ.get('CP1_LB1',"/Users/alanharvey/SCINTILLA 0.5/_worktrees/provider-lb1-reviewed-lines-20261006/evidence/lb1-reviewed-lines-20261006/")
C=json.load(open('comps-before-after.json')); TL=json.load(open('tree-live.json'))
RAW=json.load(open('quotes-all-raw.json'))['quotes']   # the settled 6 Oct closes, captured once for the whole universe
def settled(q):
    if not q: return None
    done=q.get('today_session_close_state')=='COMPLETED' and (q.get('today_session_close') or 0)>0
    return {'price':q['today_session_close'] if done else q.get('price'),'price_is':('session close '+str(q.get('today_session_et'))) if done else 'latest trade','session':q.get('today_session_et'),'last':q.get('price'),'last_utc':q.get('price_observation_utc'),'previous_close':q.get('previous_close'),'previous_session':q.get('previous_session_et')}
Q={t:settled(q) for t,q in RAW.items() if settled(q)}
NAMES=[t for t in "MU SNDK WDC STX AVGO NVDA LRCX AMAT VST CEG GOOGL AMZN ORCL EQIX DLR IRM LLY JPM BAC NBIS IREN CRWV BE CRDO COHR AME".split() if t in C and C[t].get('ok')]
tree={r['cohort']:r for r in TL['cohort_tree']}; refs={}
for m in TL['cohort_tree_members']:
    if m['role']=='reference': refs.setdefault(m['cohort'],[]).append(m['ticker'])
SKIP_COHORT=('MAG','CHINA','EUROPE','ASIA','CANADA','LATAM')   # the size club and the regions are not a business parent
mine={}
for m in TL['cohort_tree_members']:
    if m['role']=='member': mine.setdefault(m['ticker'],[]).append(m['cohort'])
def cohorts_of(t): return [c for c in mine.get(t,[]) if not c.startswith(SKIP_COHORT)]
def parents_of(t):
    out=[]
    for c in cohorts_of(t):
        row=tree[c]; fs=[f for f in [row.get('spine_fund')]+refs.get(c,[]) if f]
        for f in fs:
            if f not in out: out.append(f)
    return out
PARENT_EXTRA={'MU':['DRAM','SMH'],'SNDK':['DRAM','SMH'],'WDC':['DRAM','SMH'],'STX':['DRAM','SMH']}   # Alan: DRAM / SMH are Micron's parents
PAR={t:[f for f in dict.fromkeys(PARENT_EXTRA.get(t,[])+parents_of(t))][:3] for t in NAMES}
FUNDS=sorted(set(f for v in PAR.values() for f in v)|{'SPY','QQQ'})
def pg(p):
    out=[];off=0
    while True:
        r=urllib.request.Request(SB+"/rest/v1/"+p+f"&limit=1000&offset={off}",headers={"apikey":KEY,"Authorization":"Bearer "+KEY})
        for att in range(4):
            try: j=json.load(urllib.request.urlopen(r,timeout=60)); break
            except Exception as e:
                if att==3: raise
                time.sleep(1.5*(att+1))
        out+=j
        if len(j)<1000: return out
        off+=1000
def api(p):
    for att in range(4):
        try: return json.load(urllib.request.urlopen(urllib.request.Request(A+p,headers={"Origin":"https://scintillahub.ai","Accept-Encoding":"identity"}),timeout=90))
        except Exception as e:
            if att==3: return {"error":str(e)[:120]}
            time.sleep(2+2*att)
inq=lambda L: "in.("+",".join(urllib.parse.quote(x) for x in L)+")"
# ---------------------------------------------------------------- bars
def candles(sym,tf,lim):
    j=api(f"/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider")
    s=j.get('series') or []
    return np.array([[x["t"],x["o"],x["h"],x["l"],x["c"]] for x in s],dtype=np.float64),{"prov":j.get("provider"),"n":len(s),"newest":j.get("newest"),"err":j.get("error")}
BARS={};BMETA={}
for s in NAMES+FUNDS:
    BARS[s],BMETA[s]=candles(s,"D",1750)
print("daily bars:",{s:BMETA[s]['n'] for s in NAMES+FUNDS if BMETA[s]['n']<400} or "all ≥ 400 sessions",flush=True)
day=lambda ms: d.datetime.utcfromtimestamp(ms/1000+43200).strftime('%Y-%m-%d')
def rsi14(c):
    dl=np.diff(c); g=np.where(dl>0,dl,0.0); l=np.where(dl<0,-dl,0.0); out=np.full(len(c),np.nan)
    if len(c)<16: return out
    ag=g[:14].mean(); al=l[:14].mean(); out[14]=100-100/(1+(ag/al if al>0 else 1e9))
    for i in range(14,len(dl)):
        ag=(ag*13+g[i])/14; al=(al*13+l[i])/14; out[i+1]=100-100/(1+(ag/al if al>0 else 1e9))
    return out
def tech(sym,price):
    b=BARS.get(sym)
    if b is None or len(b)<30: return {'why':'no daily bars'}
    c=b[:,4].copy(); last_day=day(b[-1,0]); o={'last_bar_date':last_day,'last_bar_close':float(c[-1]),'sessions':int(len(c))}
    if price and last_day==str(TODAY): c[-1]=price                      # the settled close the card is priced on
    sma=lambda n,k=0: float(c[len(c)-n-k:len(c)-k].mean()) if len(c)>=n+k else None
    for n in (21,50,100,200):
        v=sma(n); o[f'sma{n}']=v; o[f'vs_sma{n}_pct']=None if v is None or not price else (price/v-1)*100
        v5=sma(n,5); o[f'sma{n}_5ago']=v5; o[f'sma{n}_rising']=None if v is None or v5 is None else bool(v>v5)
    hi=float(b[-252:,2].max()); o['hi_52w']=max(hi,price or 0); o['from_high_pct']=None if not price else (price/o['hi_52w']-1)*100
    lo=float(b[-252:,3].min()); o['lo_52w']=lo
    r=rsi14(c); yr=r[-251:]; yr=yr[~np.isnan(yr)]
    o['rsi14']=None if np.isnan(r[-1]) else float(r[-1]); o['rsi_pctl']=None if not len(yr) or np.isnan(r[-1]) else float((yr<r[-1]).mean()*100); o['rsi_n']=int(len(yr))
    o['rsi_p10']=float(np.percentile(yr,10)) if len(yr) else None; o['rsi_p90']=float(np.percentile(yr,90)) if len(yr) else None; o['rsi_min']=float(yr.min()) if len(yr) else None; o['rsi_max']=float(yr.max()) if len(yr) else None
    ret=np.diff(c)/c[:-1]*100
    o['usual_day_60_own']=float(ret[-60:].std(ddof=1)) if len(ret)>=60 else None; o['usual_day_20_own']=float(ret[-20:].std(ddof=1)) if len(ret)>=20 else None
    for k in (5,21,63): o[f'ret_{k}']=None if len(c)<=k else float((c[-1]/c[-1-k]-1)*100)
    return o
# ---------------------------------------------------------------- Geiger: live + the name's own year
G=api("/geiger"); GS=G.get('symbols') or {}
S7=json.load(open('geiger7-series-nq1.json'))
def geiger_series_for(sym):
    """names NQ1 did not replay (the banks): seven-rung replay with the same code (recon_g2.py, publisher maths)."""
    import recon_g2 as R
    z={"tf_D":BARS[sym]}; meta={"D":{"prov":BMETA[sym]["prov"]}}
    for tf,lim in {"180":3350,"240":2350,"6h":2350,"12h":1300}.items():
        a,m=candles(sym,tf,lim); z["tf_"+tf]=a; meta[tf]=m
    np.savez_compressed(f"bars/{sym}.npz",**z); json.dump(meta,open(f"bars/{sym}.meta.json","w"))
    o,why=R.do(sym)
    if o is None: return None,why
    W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}; ws=sum(W.values())
    R_={g:np.where(np.isnan(o['M_'+g]),o['T_'+g],0.5*o['T_'+g]+0.5*o['M_'+g]) for g in W}
    ok=np.all([~np.isnan(R_[g]) for g in W],axis=0); comp=sum(W[g]*np.nan_to_num(R_[g]) for g in W)/ws
    return {day(o['t'][i]):float(comp[i]) for i in range(len(o['t'])) if ok[i]},"ok"
def geiger(sym):
    lv=(GS.get(sym) or {}).get('composite'); o={'live':lv,'trend':(GS.get(sym) or {}).get('trend'),'momentum':(GS.get(sym) or {}).get('momentum'),'computed_utc':(GS.get(sym) or {}).get('computed_utc')}
    ser=S7.get(sym); src='NQ1 seven-rung replay (to 5 Oct)'
    if ser is None and sym in NAMES:
        try: ser,why=geiger_series_for(sym); src='seven-rung replay, this run' if ser else None; o['replay_why']=why
        except Exception as e: ser=None; o['replay_why']='err '+str(e)[:80]
    if not ser or lv is None: o.update({'pctl':None,'why':'no replayed history' if lv is not None else 'no live reading'}); return o
    ds=sorted(k for k in ser if k<str(TODAY)); yr=np.array([ser[k] for k in ds][-251:])
    if len(yr)<60: o.update({'pctl':None,'why':f'only {len(yr)} replayed sessions'}); return o
    o.update({'pctl':float((yr<lv).mean()*100),'median':float(np.median(yr)),'p10':float(np.percentile(yr,10)),'p90':float(np.percentile(yr,90)),'n':int(len(yr)),'from':ds[-len(yr)],'to':ds[-1],'last_close_reading':float(yr[-1]),'source':src}); return o
# ---------------------------------------------------------------- public tables
est={};hist={};qhist={}
for r in pg(f"analyst_estimates?select=ticker,period,fiscal_date,est_eps_avg,est_eps_high,est_eps_low,est_revenue_avg,price_target_avg,num_analysts_eps,num_analysts_rev,updated_ts&ticker={inq(NAMES)}&fiscal_date=gte.2025-06-01&order=ticker.asc,fiscal_date.asc"): est.setdefault((r['ticker'],r['period']),[]).append(r)
for r in pg(f"fundamentals_history?select=ticker,period,fiscal_year,fiscal_date,revenue,eps_diluted,net_income&ticker={inq(NAMES)}&fiscal_date=gte.2024-06-01&order=ticker.asc,fiscal_date.desc"):
    (hist if r['period']=='FY' else qhist).setdefault(r['ticker'],[]).append(r)
RAT={r['ticker']:r for r in pg(f"analyst_ratings?select=*&ticker={inq(NAMES)}")}
SNAP={}   # (ticker, fiscal_date) -> [(as_of_date, eps, revenue, analysts)] : the stored daily copies of the analysts' estimates
for r in pg(f"analyst_estimates_daily?select=ticker,fiscal_date,as_of_date,eps_avg,revenue_avg,analysts_eps&period=eq.annual&ticker={inq(NAMES)}&fiscal_date=gte.2026-06-01&order=ticker.asc,fiscal_date.asc,as_of_date.asc"): SNAP.setdefault((r['ticker'],r['fiscal_date']),[]).append(r)
TGT={}
for r in pg(f"analyst_target_news?select=ticker,published_utc,kind,firm,target,adj_target_checked,action,price_when_posted,quality&kind=eq.TARGET&ticker={inq(NAMES)}&published_utc=gte.{TODAY-d.timedelta(days=30)}&order=ticker.asc,published_utc.desc"): TGT.setdefault(r['ticker'],[]).append(r)
PTS={}
for r in pg(f"price_target_summary_daily?select=ticker,as_of_date,last_month_count,last_month_avg,last_quarter_count,last_quarter_avg&ticker={inq(NAMES)}&as_of_date=gte.{TODAY-d.timedelta(days=10)}&order=ticker.asc,as_of_date.asc"): PTS[r['ticker']]=r
EV={}
for r in pg(f"earnings_events?select=ticker,date,eps_actual,eps_estimate,revenue_actual,revenue_estimate,surprise_pct,report_time,confirmed,superseded_at&ticker={inq(NAMES)}&date=gte.2025-06-01&order=ticker.asc,date.asc"):
    if not r.get('superseded_at'): EV.setdefault(r['ticker'],[]).append(r)
HB={}
for r in pg(f"ticker_heartbeat_daily?select=ticker,date,usual_day_20,usual_day_60,usual_day_250,atr_pct_14,n&ticker={inq(NAMES+FUNDS)}&date=gte.{TODAY-d.timedelta(days=10)}&order=ticker.asc,date.asc"): HB[r['ticker']]=r   # newest row per name
P=lambda s: d.date.fromisoformat(s[:10]); g=lambda a,b: None if a is None or b is None or b<=0 else (a/b-1)*100
def fundamentals(t,price):
    o={}; H=hist.get(t,[]); E=est.get((t,'annual'),[]); evs=EV.get(t,[])
    if not H: o['why']='no reported fiscal year on file'; return o
    last=H[0]; fut=[e for e in E if e['fiscal_date']>last['fiscal_date']]; fd0=P(last['fiscal_date'])
    # last year's EPS on the ANALYSTS' basis: the four reported quarters of that fiscal year (earnings_events.eps_actual is the
    # figure the estimate was scored against). The filed (GAAP) figure can carry one-offs and is kept beside it.
    q4=[e for e in evs if e.get('eps_actual') is not None and fd0-d.timedelta(days=290)<P(e['date'])<=fd0+d.timedelta(days=80)]
    adj=sum(e['eps_actual'] for e in q4) if len(q4)==4 else None
    eps0=adj if adj is not None else last['eps_diluted']
    o['fy0']={'date':last['fiscal_date'],'revenue':last['revenue'],'eps':eps0,'eps_filed':last['eps_diluted'],'eps_basis':"the four reported quarters, analysts' basis" if adj is not None else 'the filed figure (the four quarterly reports are not all on file)'}
    if len(fut)<2: o['why']='fewer than two forward estimate years'; return o
    f1,f2=fut[0],fut[1]
    for k,f,prev in (('fy1',f1,(last['revenue'],eps0)),('fy2',f2,(f1['est_revenue_avg'],f1['est_eps_avg']))):
        o[k]={'date':f['fiscal_date'],'revenue':f['est_revenue_avg'],'eps':f['est_eps_avg'],'eps_low':f.get('est_eps_low'),'eps_high':f.get('est_eps_high'),'n_eps':f.get('num_analysts_eps'),'n_rev':f.get('num_analysts_rev'),'rev_g':g(f['est_revenue_avg'],prev[0]),'eps_g':g(f['est_eps_avg'],prev[1])}
    w=max(0,min(1,(P(f1['fiscal_date'])-TODAY).days/365.0)); bl=lambda a,b: None if a is None or b is None else w*a+(1-w)*b
    nr=bl(f1['est_revenue_avg'],f2['est_revenue_avg']); pr=bl(last['revenue'],f1['est_revenue_avg']); ne=bl(f1['est_eps_avg'],f2['est_eps_avg']); pe=bl(eps0,f1['est_eps_avg'])
    o['ntm']={'w_fy1':round(w,2),'rev':nr,'eps':ne,'rev_g':g(nr,pr),'eps_g':g(ne,pe) if pe and pe>0 else None,'eps_g_note':None if pe and pe>0 else 'the prior twelve months were not profitable','fwd_pe':(price/ne if price and ne and ne>0 else None)}
    o['target_avg']=f1.get('price_target_avg'); o['target_vs_price_pct']=g(f1.get('price_target_avg'),price); o['est_updated']=None if not f1.get('updated_ts') else d.datetime.utcfromtimestamp(f1['updated_ts']).strftime('%Y-%m-%d')
    r=RAT.get(t)
    if r: o['ratings']={'consensus':r.get('consensus'),'buy':(r.get('strong_buy') or 0)+(r.get('buy') or 0),'hold':r.get('hold') or 0,'sell':(r.get('sell') or 0)+(r.get('strong_sell') or 0)}
    # ---- revisions: the same fiscal year's estimate, the oldest stored copy against the newest (analyst_estimates_daily)
    rev={}
    for k,f in (('fy1',f1),('fy2',f2)):
        ss=[x for x in SNAP.get((t,f['fiscal_date']),[]) if x.get('eps_avg') is not None]
        if len(ss)>=2 and ss[0]['as_of_date']!=ss[-1]['as_of_date']:
            a,b=ss[0],ss[-1]; rev[k]={'from':a['as_of_date'],'to':b['as_of_date'],'days':(P(b['as_of_date'])-P(a['as_of_date'])).days,'eps_then':a['eps_avg'],'eps_now':b['eps_avg'],'eps_pct':g(b['eps_avg'],a['eps_avg']) if a['eps_avg']>0 else None,
                    'rev_then':a.get('revenue_avg'),'rev_now':b.get('revenue_avg'),'rev_pct':g(b.get('revenue_avg'),a.get('revenue_avg')),'copies':len(ss)}
    o['revision']=rev or {'why':'fewer than two stored copies of the estimates'}
    tg=TGT.get(t,[]); cnt={}
    for x in tg: cnt[x.get('action') or 'other']=cnt.get(x.get('action') or 'other',0)+1
    ps=PTS.get(t) or {}
    o['targets']={'days':30,'n':len(tg),'raised':cnt.get('raise',0),'lowered':cnt.get('lower',0),'kept':sum(v for k,v in cnt.items() if k not in ('raise','lower')),
                  'latest':[{'date':x['published_utc'][:10],'firm':x.get('firm'),'action':x.get('action'),'target':x.get('adj_target_checked') or x.get('target'),'price_then':x.get('price_when_posted')} for x in tg[:4]],
                  'month_avg':ps.get('last_month_avg'),'month_n':ps.get('last_month_count'),'quarter_avg':ps.get('last_quarter_avg'),'quarter_n':ps.get('last_quarter_count'),'summary_as_of':ps.get('as_of_date')}
    done=[e for e in evs if e.get('eps_actual') is not None and P(e['date'])<=TODAY]; nxt=[e for e in evs if P(e['date'])>TODAY]
    if done: e=done[-1]; o['last_report']={'date':e['date'],'eps_actual':e['eps_actual'],'eps_estimate':e['eps_estimate'],'surprise_pct':g(e['eps_actual'],e['eps_estimate']) if (e.get('eps_estimate') or 0)>0 else None,'rev_surprise_pct':g(e.get('revenue_actual'),e.get('revenue_estimate'))}
    if nxt: e=nxt[0]; o['next_report']={'date':e['date'],'time':e.get('report_time'),'confirmed':e.get('confirmed'),'days':(P(e['date'])-TODAY).days}
    return o
# ---------------------------------------------------------------- reviewed lines (the Lab's labels, verbatim)
Wp=json.load(open(LB1+"where-price-sits-20261006.json")); WHERE={r['ticker']:r for r in Wp['rows']}
EX=json.load(open(LB1+"reviewed-lines-extract.json")); PEND={}
for p in EX['pending_selections']: PEND.setdefault(p['ticker'],[]).append(f"{p['source_timeframe']} {p['native_id']}")
def lines(t,price):
    w=WHERE.get(t)
    if not w: return {'reviewed':False,'why':'the Lab has not reviewed this name yet (no lines in the V24 packs)','pending':PEND.get(t,[])}
    lev=[{'label':x['native_id'],'tf':x['tf'],'kind':x['kind'],'level':round(x['level'],2),'pct':round((x['level']/price-1)*100,2),'approved_slope':bool(x.get('approved_slope')),'state_at_extract':x.get('state')} for x in w['levels'] if x.get('level')]
    lev.sort(key=lambda x:-x['level']); ab=[x for x in lev if x['level']>price]; be=[x for x in lev if x['level']<=price]
    return {'reviewed':True,'n':len(lev),'above':ab[-1] if ab else None,'below':be[0] if be else None,'above2':ab[-3:][::-1],'below2':be[:4],'all':lev,'pending':PEND.get(t,[]),'levels_as_of':Wp['generated_at'],'extract_price':w['price']}
# ---------------------------------------------------------------- assemble
SPYP=Q.get('SPY',{}).get('price'); FQ={}
miss=[f for f in FUNDS if f not in Q]
if miss:
    j=api("/quotes?symbols="+urllib.parse.quote(",".join(miss)))
    for f,q in (j.get('quotes') or {}).items():
        Q[f]={'price':q.get('today_session_close') if q.get('today_session_close_state')=='COMPLETED' else q.get('price'),'last':q.get('price'),'last_utc':q.get('price_observation_utc'),'previous_close':q.get('previous_close'),'session':q.get('today_session_et'),'price_is':'session close '+str(q.get('today_session_et')) if q.get('today_session_close_state')=='COMPLETED' else 'latest trade'}
def risk(t):
    hb=HB.get(t) or {}; sp=HB.get('SPY') or {}; T_=TECH[t]; S_=TECH['SPY']
    u=hb.get('usual_day_60') or T_.get('usual_day_60_own'); us=sp.get('usual_day_60') or S_.get('usual_day_60_own')
    return {'usual_day_60':u,'usual_day_source':'ticker_heartbeat_daily' if hb.get('usual_day_60') else 'this run, 60 daily moves','as_of':hb.get('date'),'usual_day_20':hb.get('usual_day_20'),'usual_day_250':hb.get('usual_day_250'),'atr_pct_14':hb.get('atr_pct_14'),
            'own_check_60':T_.get('usual_day_60_own'),'spy_usual_day_60':us,'spy_as_of':sp.get('date'),'x_spy':None if not u or not us else u/us,'risk_equal_share':None if not u or not us else us/u}
TECH={s:tech(s,(Q.get(s) or {}).get('price')) for s in NAMES+FUNDS}
out={'as_of':{'card_date':str(TODAY),'price_is':'the 6 Oct regular-session close (chart API, session COMPLETED); the after-hours trade is shown beside it','geiger_published_utc':G.get('published_utc'),'lines_extract':Wp['generated_at'],'tree_read_utc':TL['read_utc'],'built_utc':d.datetime.utcnow().isoformat()+'Z','heartbeat_date':(HB.get('SPY') or {}).get('date')},'names':{},'funds':{}}
for f in FUNDS: out['funds'][f]={'quote':Q.get(f),'tech':TECH[f],'geiger':geiger(f),'risk':{'usual_day_60':(HB.get(f) or {}).get('usual_day_60') or TECH[f].get('usual_day_60_own'),'as_of':(HB.get(f) or {}).get('date')}}
for t in NAMES:
    price=(Q.get(t) or {}).get('price')
    out['names'][t]={'quote':Q.get(t),'parents':PAR[t],'cohorts':[{'cohort':c,'label':tree[c].get('label'),'parent_1':tree[c].get('parent_1'),'parent_2':tree[c].get('parent_2'),'spine':tree[c].get('spine_fund'),'mates':sorted(m['ticker'] for m in TL['cohort_tree_members'] if m['cohort']==c and m['role']=='member' and m['ticker']!=t)} for c in cohorts_of(t)],'fund':fundamentals(t,price),'tech':TECH[t],'geiger':geiger(t),'lines':lines(t,price),'risk':risk(t)}
    n=out['names'][t]; F=n['fund']; T_=n['tech']; G_=n['geiger']; L_=n['lines']; R_=n['risk']; f=lambda x,k=1: '—' if x is None else f'{x:+.{k}f}'
    print(f"{t:5s} {price:>9.2f} | rev {f((F.get('ntm') or {}).get('rev_g'),0):>5} eps {f((F.get('ntm') or {}).get('eps_g'),0):>5} fpe {('—' if not (F.get('ntm') or {}).get('fwd_pe') else '%.1f'%F['ntm']['fwd_pe']):>5} revFY1 {f(((F.get('revision') or {}).get('fy1') or {}).get('eps_pct'),0):>5} tgt↑{(F.get('targets') or {}).get('raised')}↓{(F.get('targets') or {}).get('lowered')} | G {f(G_.get('live'),2):>6} p{('—' if G_.get('pctl') is None else '%2.0f'%G_['pctl']):>3} | rsi {('—' if T_.get('rsi14') is None else '%.0f'%T_['rsi14']):>3} p{('—' if T_.get('rsi_pctl') is None else '%2.0f'%T_['rsi_pctl']):>3} | 21d {f(T_.get('vs_sma21_pct')):>6} 50d {f(T_.get('vs_sma50_pct')):>6} 200d {f(T_.get('vs_sma200_pct')):>6} | usual {R_['usual_day_60'] and round(R_['usual_day_60'],2)} = {R_['x_spy'] and round(R_['x_spy'],1)}x SPY | lines {L_.get('n','none')} below {(L_.get('below') or {}).get('label')} above {(L_.get('above') or {}).get('label')} | bar {T_.get('last_bar_date')} {T_.get('last_bar_close')}",flush=True)
json.dump(out,open('cards-data.json','w'),indent=1)
print("funds:",{f:(round(out['funds'][f]['geiger'].get('live') or 0,2),out['funds'][f]['geiger'].get('pctl') and round(out['funds'][f]['geiger']['pctl'])) for f in FUNDS})
print("heartbeat newest:",(HB.get('SPY') or {}).get('date'),"SPY usual",(HB.get('SPY') or {}).get('usual_day_60'),"MU",(HB.get('MU') or {}).get('usual_day_60'))
