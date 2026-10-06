# NQ1 · one data file for the page: bottom-up table (fundamentals rank, technicals beside it), top-down (sectors, cohorts), parent roll-ups, MU 21-day.
import json,urllib.request,urllib.parse,numpy as np,datetime as d,os,time
WT="/Users/alanharvey/SCINTILLA 0.5/_worktrees/"
A="https://scintilla-massive-chart-api.fly.dev"
GA=json.load(open('growth-all.json')); C=json.load(open('comps-upside.json')); H=json.load(open('geiger7-history.json')); S7=json.load(open('geiger7-series.json'))
LIVE=json.load(open('geiger.json')); L=LIVE['symbols']
prop=json.load(open(WT+'co1-cohorts-20261006/deliverables/20261006/cohort-proposal/proposal.json'))['cohorts']; pid={c['id']:c for c in prop}
scope={**json.load(open('scope-members.json')),**json.load(open('scope-extra.json'))}
Wp=json.load(open(WT+'provider-lb1-reviewed-lines-20261006/evidence/lb1-reviewed-lines-20261006/where-price-sits-20261006.json')); where={r['ticker']:r for r in Wp['rows']}
E=json.load(open(WT+'provider-lb1-reviewed-lines-20261006/evidence/lb1-reviewed-lines-20261006/reviewed-lines-extract.json')); pend={}
for p in E['pending_selections']: pend[p['ticker']]=pend.get(p['ticker'],0)+1
NONUSD=set(k for k,v in json.load(open(WT+'hub-c6b-outliers-price-only-20261005/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json'))['reported'].items() if v!='USD')
SG=json.load(open(WT+'sg1-sector-gauge-20261006/deliverables/20261006/sector-gauge-study/data/results.json'))
tree=json.load(open(WT+'nq1-workshop-queue-20261006/deliverables/20260929/tree-map/tree.json'))
FUNDS=['SPY','QQQ','XLV','XLU','XLK','XLE','XLF','XLI','XLY','XLP','XLB','XLRE','XLC','SMH','SOXX','IGV','IHI','XBI','DRAM','SKYY','AGIX','URA','ITA','ARKX']
# ---- fresh quotes (chart API, public read)
need=sorted(set(scope)|set(FUNDS)); Q={}
for i in range(0,len(need),40):
    u=f"{A}/quotes?symbols={urllib.parse.quote(','.join(need[i:i+40]))}"
    for att in range(3):
        try:
            j=json.load(urllib.request.urlopen(urllib.request.Request(u,headers={"Origin":"https://scintillahub.ai"}),timeout=60)); break
        except Exception as e: j=None; time.sleep(2)
    rows=(j.get('quotes') or j.get('symbols') or j) if isinstance(j,dict) else (j or [])
    if isinstance(rows,dict): rows=list(rows.values())
    for q in rows:
        if isinstance(q,dict) and q.get('symbol') and q.get('price'): Q[q['symbol']]=q
qt=max((q.get('price_observation_utc') or '') for q in Q.values()); print('quotes',len(Q),'of',len(need),'newest',qt)
def bars(s):
    f=f'bars/{s}.npz'
    return np.load(f)['tf_D'] if os.path.exists(f) else None
def tech(s,price):
    b=bars(s)
    if b is None or len(b)<30 or not price: return {}
    c=b[:,4]; sma=lambda n: float(c[-n:].mean()) if len(c)>=n else None
    hi=float(b[-252:,2].max()); o={'sma21':sma(21),'sma50':sma(50),'sma200':sma(200),'hi_52w':max(hi,price),'from_high_pct':(price/max(hi,price)-1)*100,'last_close':float(c[-1]),
       'last_close_date':d.datetime.utcfromtimestamp(b[-1,0]/1000+43200).strftime('%Y-%m-%d'),'sessions':int(len(c))}
    for k in ('sma21','sma50','sma200'): o['vs_'+k+'_pct']=None if o[k] is None else (price/o[k]-1)*100
    return o
Wn=lambda x,lo,hi: None if x is None else max(lo,min(hi,x))
rows=[]
for t in sorted(scope):
    g=GA.get(t) or {}; n=g.get('ntm') or {}; c=C.get(t,{}); h=H.get(t,{}); lv=(L.get(t) or {}).get('composite')
    price=(Q.get(t) or {}).get('price') or g.get('price')
    rev=n.get('rev_g'); eps=n.get('eps_g') if not n.get('eps_g_note') else None
    growth=None if rev is None else 0.6*Wn(rev,-60,150)+0.4*(Wn(eps,-60,150) if eps is not None else -60)
    fpe=None if (t in NONUSD or not n.get('eps') or n['eps']<=0 or not price) else price/n['eps']
    band=c.get('band'); up=None if not (band and band.get('centre') and price) else (band['centre']/price-1)*100
    conf='full'
    if not c.get('ok') or up is None: conf='none'
    elif c.get('rows_ok',0)<3: conf='thin'
    elif c.get('business') and c['business'].get('mostlyDifferent'): conf='different business'
    hk=h.get('status')=='ok'; w=where.get(t)
    na=nb=None
    if w and price:
        lev=[x for x in w['levels'] if x.get('level')]
        ab=[x for x in lev if x['level']>price]; be=[x for x in lev if x['level']<=price]
        mk=lambda x:{'id':x['native_id'],'level':round(x['level'],2),'pct':round((x['level']/price-1)*100,1),'approved_slope':x.get('approved_slope')}
        na=mk(min(ab,key=lambda x:x['level'])) if ab else None; nb=mk(max(be,key=lambda x:x['level'])) if be else None
    coh=scope.get(t,[]); ref=None
    for cid in coh:
        rf=pid[cid].get('reference_funds') or []
        if rf: ref=rf[0] if isinstance(rf[0],str) else rf[0].get('ticker'); break
    rows.append({'ticker':t,'name':g.get('name'),'cohorts':[pid[x]['label'] for x in coh],'cohort_ids':coh,'sector':g.get('sector'),'parent_fund':ref,'mcap':g.get('mcap'),'price':price,
      'rev_g':rev,'eps_g':eps,'eps_note':n.get('eps_g_note'),'growth_blend':growth,'fwd_pe':fpe,'fwd_pe_note':('reports in another currency' if t in NONUSD else None),'pe_ttm':g.get('pe_ttm') if t not in NONUSD else None,
      'comps_upside':up,'comps_centre':band and band.get('centre'),'comps_lo':band and band.get('lo'),'comps_hi':band and band.get('hi'),'comps_conf':conf,'comps_rows_ok':c.get('rows_ok'),
      'comps_outliers':c.get('outliers') or [],'comps_peers':c.get('kept') or [],'comps_line':c.get('lines'),'comps_same':(c.get('business') or {}).get('same'),'comps_n':(c.get('business') or {}).get('n'),
      'geiger':lv,'geiger_pctl':h.get('pctl_12m_live') if hk else None,'geiger_median':h.get('median_12m') if hk else None,'geiger_sessions':h.get('n_12m') if hk else None,'geiger_hist_why':None if hk else h.get('status','no bars'),
      'lines':(w['lines'] if w else 0),'pending':pend.get(t,0),'above':na,'below':nb,**tech(t,price)})
def prank(key,out):
    arr=np.array([r[key] for r in rows if r[key] is not None])
    for r in rows: r[out]=None if r[key] is None else float((arr<r[key]).mean()*100)
prank('growth_blend','growth_rank'); prank('comps_upside','upside_rank')
for r in rows:
    u=r['upside_rank']
    if u is None: u=0.0
    elif r['comps_conf']!='full': u=50+(u-50)*0.5
    r['upside_rank_used']=u
    r['score']=None if r['growth_rank'] is None else round(0.65*r['growth_rank']+0.35*u,1)
    p=r['geiger_pctl']; r['when']=None if p is None else ('cold for itself' if p<=25 else 'hot for itself' if p>=75 else 'inside its normal')
rows.sort(key=lambda r:-(r['score'] if r['score'] is not None else -1))
for i,r in enumerate(rows): r['rank']=i+1
# ---- parent roll-ups (cap-weighted; fund = FMP holdings weights over the names the Hub serves)
def pfx(t): 
    g=GA.get(t); return (Q.get(t) or {}).get('price') or (g or {}).get('price')
def rollup(weights,label,kind,note):
    tot=sum(w for _,w in weights)
    def agg(key,eps=False):
        num=den=0
        for t,w in weights:
            n=(GA.get(t) or {}).get('ntm')
            if not n or n.get(key) is None or (eps and n.get('eps_g_note')): continue
            num+=w*Wn(n[key],-60,200); den+=w
        return (round(num/den,1) if den else None, round(den/tot*100) if tot else None)
    def med(key,eps=False):
        v=[(GA[t]['ntm'][key]) for t,_ in weights if (GA.get(t) or {}).get('ntm') and GA[t]['ntm'].get(key) is not None and not (eps and GA[t]['ntm'].get('eps_g_note'))]
        return round(float(np.median(v)),1) if v else None
    num=den=0; tn=td=0
    for t,w in weights:
        g=GA.get(t) or {}; n=g.get('ntm') or {}; p=pfx(t)
        if t in NONUSD: continue
        if n.get('eps') and n['eps']>0 and p: num+=w*n['eps']/p; den+=w
        if g.get('pe_ttm') and g['pe_ttm']>0: tn+=w/g['pe_ttm']; td+=w
    rg,rc=agg('rev_g'); eg,ec=agg('eps_g',True)
    return {'label':label,'kind':kind,'n':len(weights),'weight_pct':round(tot,1) if kind=='fund' else None,'note':note,'fwd_pe':round(den/num,1) if num else None,'fwd_pe_cov':round(den/tot*100) if tot else None,
            'pe_ttm':round(td/tn,1) if tn else None,'rev_g':rg,'eps_g':eg,'eps_cov':ec,'rev_g_median':med('rev_g'),'eps_g_median':med('eps_g',True)}
fn={n['ticker']:n for n in tree['nodes'] if n.get('kind')=='fund' and n.get('holdings') and n['holdings'].get('served_weights')}
P={'funds':{},'cohorts':{}}
for tk in FUNDS:
    n=fn.get(tk)
    if not n: P['funds'][tk]={'label':tk,'missing':True}
    else:
        h=n['holdings']; sw=[(s,w) for s,w in h['served_weights'] if s in GA]
        P['funds'][tk]=rollup(sw,tk,'fund',f"holdings as of {h.get('as_of')}")
    hh=H.get(tk,{}); lv=(L.get(tk) or {}).get('composite'); P['funds'][tk].update({'geiger':lv,'geiger_pctl':hh.get('pctl_12m_live'),'geiger_median':hh.get('median_12m'),'price':(Q.get(tk) or {}).get('price'),**tech(tk,(Q.get(tk) or {}).get('price'))})
for c in prop:
    if c['id'].startswith('IDX_'): continue
    mem=[(t,GA[t]['mcap']) for t in c['members'] if t in GA and GA[t].get('mcap')]
    if not mem: continue
    o=rollup(mem,c['label'],'cohort',f"{len(mem)} of {len(c['members'])} members")
    o['parents']=c.get('parents'); o['members']=c['members']
    ms=[t for t in c['members'] if t in S7]
    if len(ms)>=3:
        alld=sorted(set().union(*[set(S7[t]) for t in ms])); ser=[]
        for dd in alld[-300:]:
            v=[S7[t][dd] for t in ms if dd in S7[t]]
            if len(v)>=max(2,int(0.67*len(ms))): ser.append(float(np.mean(v)))
        lvv=[L[t]['composite'] for t in ms if t in L and L[t].get('composite') is not None]
        if len(ser)>=120 and lvv:
            yr=np.array(ser[-251:]); x=float(np.mean(lvv)); o.update({'geiger':round(x,3),'geiger_pctl':round(float((yr<x).mean()*100)),'geiger_median':round(float(np.median(yr)),3),'geiger_n':len(ms)})
    P['cohorts'][c['id']]=o
# ---- sectors (SG1 gauge, 5 Oct evening) joined to the fund roll-up
sectors=[]
for k,v in SG['sectors'].items():
    cw=v.get('cw'); f=P['funds'].get(cw) or {}
    sectors.append({'key':k,'name':v['name'],'fund':cw,'sg1_geiger':v['own_cw'].get('today'),'sg1_pctl':round(v['own_cw'].get('pct_12m',0)*100),'rrg':(v.get('rrg_cw') or {}).get('box') or (v.get('rrg_cw') or {}).get('quadrant'),'gauge':(v.get('gauge') or {}).get('words') or (v.get('gauge') or {}).get('label') or str(v.get('gauge'))[:80],
                    'geiger_now':f.get('geiger'),'pctl_now':f.get('geiger_pctl'),'fwd_pe':f.get('fwd_pe'),'pe_ttm':f.get('pe_ttm'),'rev_g':f.get('rev_g'),'eps_g':f.get('eps_g'),'eps_g_median':f.get('eps_g_median')})
# ---- XLV / XLU against the market on price, and the sector trailing P/E table
def rel(a,b='SPY'):
    x=bars(a); y=bars(b); dx={int(r[0]):r[4] for r in x}; dy={int(r[0]):r[4] for r in y}; ks=sorted(set(dx)&set(dy)); r=np.array([dx[k]/dy[k] for k in ks])
    pa=(Q.get(a) or {}).get('price'); pb=(Q.get(b) or {}).get('price'); now=pa/pb if pa and pb else r[-1]
    return {'years':round(len(r)/252,1),'pctl_all':round(float((r<now).mean()*100)),'pctl_12m':round(float((r[-251:]<now).mean()*100)),'chg_12m_pct':round((now/r[-252]-1)*100,1),'chg_3y_pct':round((now/r[-756]-1)*100,1) if len(r)>756 else None}
relp={a:rel(a) for a in ['XLV','XLU','XLK','SMH']}
spe=json.load(open('sector-pe-summary.json'))
# ---- MU and its 21-day average
def ma_hist(s,n=21,look=251):
    b=bars(s); c=b[:,4]; lo=b[:,3]; dt=[d.datetime.utcfromtimestamp(x/1000+43200).strftime('%Y-%m-%d') for x in b[:,0]]
    sma=np.full(len(c),np.nan); cs=np.cumsum(np.r_[0,c]); sma[n-1:]=(cs[n:]-cs[:-n])/n
    i0=len(c)-look; above=c>sma; tests=[]; i=i0
    while i<len(c):
        # a test = a session whose low reaches the average after at least 5 straight closes above it
        if i>=5 and above[i-5:i].all() and lo[i]<=sma[i]:
            j=i; below=0
            while j<len(c) and not (above[j] and lo[j]>sma[j]): below+= (not above[j]); j+=1
            worst=float(((c[i:j+1 if j<len(c) else j]/sma[i:j+1 if j<len(c) else j])-1).min()*100) if j>i else float((c[i]/sma[i]-1)*100)
            tests.append({'date':dt[i],'level':round(float(sma[i]),2),'closes_below':int(below),'sessions_to_clear':int(j-i),'deepest_close_vs_avg_pct':round(worst,1),'held':below<=1}); i=j+1
        else: i+=1
    run=0
    for k in range(len(c)-1,-1,-1):
        if above[k]: run+=1
        else: break
    return {'n':n,'avg_last_close':round(float(sma[-1]),2),'avg_5_sessions_ago':round(float(sma[-6]),2),'last_close':round(float(c[-1]),2),'last_close_date':dt[-1],'share_closes_above_12m_pct':round(float(above[i0:].mean()*100)),
            'closes_above_in_a_row':run,'tests':tests,'held':sum(1 for t in tests if t['held']),'lost':sum(1 for t in tests if not t['held'])}
mu=ma_hist('MU'); mu['price_now']=(Q.get('MU') or {}).get('price')
out={'as_of':{'quotes_newest_utc':qt,'geiger_published_utc':LIVE.get('published_utc'),'geiger_history_last_close':H['MU']['last_date'],'lines_file_generated':Wp['generated_at'],'sector_gauge_as_of':SG.get('as_of'),'estimates':'analyst_estimates table read 6 Oct ~14:50 ET','comps_run':'6 Oct ~14:50 ET (band), re-priced at the newest quote'},
     'rows':rows,'parents':P,'sectors':sectors,'relative_price':relp,'sector_trailing_pe':spe,'mu_21d':mu,'reviewed_tickers':[r['ticker'] for r in Wp['rows']]}
json.dump(out,open('nq1-data.json','w'),indent=1)
f=lambda x,n=0: '—' if x is None else f'{x:+.{n}f}'
print('SECTORS'); [print(s) for s in sectors[:3]]
print('REL',relp); print('MU',{k:v for k,v in mu.items() if k!='tests'}); [print('  ',t) for t in mu['tests']]
print(f"{'#':>3} {'tk':5s} {'rev':>5} {'eps':>5} {'fPE':>5} {'up':>6} {'conf':9s} {'G':>5} {'pct':>3} {'hi%':>5} {'v21':>5} ln score when")
want=set("SNDK NFLX IBM NKE MCD CBRS WDC VST CEG WMT IREN ASTS HUT ACHR SPIR KTOS GOOGL AMZN CRWV AVGO LRCX MU META ASML NBIS TSM AAOI AXTI LITE COHR CIEN FN POET CRDO GLW NVDA LLY UNH".split())
for r in rows:
    if r['rank']<=30 or r['ticker'] in want:
        print(f"{r['rank']:3d} {r['ticker']:5s} {f(r['rev_g']):>5} {f(r['eps_g']):>5} {('—' if r['fwd_pe'] is None else '%.0f'%r['fwd_pe']):>5} {f(r['comps_upside']):>6} {r['comps_conf'][:9]:9s} {f(r['geiger'],2):>5} {('—' if r['geiger_pctl'] is None else '%3.0f'%r['geiger_pctl']):>3} {f(r.get('from_high_pct')):>5} {f(r.get('vs_sma21_pct')):>5} {r['lines']:2d} {r['score']} {r['when']} {'*' if r['ticker'] in want else ''} {(r['cohorts'] or ['—'])[0][:22]} {r['parent_fund']}")
