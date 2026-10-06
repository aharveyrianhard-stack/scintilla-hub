import json,numpy as np,datetime as dt,sys
RW=int(sys.argv[1]) if len(sys.argv)>1 else 14   # RS-Ratio z window (weeks)
MP=int(sys.argv[2]) if len(sys.argv)>2 else 4    # momentum ROC period (weeks)
MW=int(sys.argv[3]) if len(sys.argv)>3 else RW   # momentum z window
TAIL=5
SM=4   # rrg-kit weekly: smooth=4 (RS 4-week rolling mean), window=14, momentum_period=4, tail=12
SECT={'TECH':('Technology','XLK','RSPT'),'HEALTH':('Health care','XLV','RSPH'),'FINANCIALS':('Financials','XLF','RSPF'),'DISCRET':('Consumer discretionary','XLY','RSPD'),
 'INDUSTRIAL':('Industrials','XLI','RSPN'),'MATERIALS':('Materials','XLB','RSPM'),'ENERGY':('Energy','XLE','RSPG'),'STAPLES':('Consumer staples','XLP','RSPS'),
 'UTILITIES':('Utilities','XLU','RSPU'),'REAL_ESTATE':('Real estate','XLRE','RSPR'),'COMMS':('Communications','XLC','RSPC'),
 'CRYPTO':('Crypto','BTCUSD',None),'METALS':('Metals','GCUSD',None),'OIL':('Oil','CLUSD',None)}
EXTRA=['SMH']   # semiconductors, for the worked check
alloc={r['key']:r for r in json.load(open('alloc3a.json'))['rows']}
live=json.load(open('geiger-all.json'))
livesym=live['symbols']
def pct(hist,x):
    h=np.asarray(hist,float); h=h[~np.isnan(h)]
    if len(h)==0: return None
    return float(((h<x).sum()+0.5*(h==x).sum())/len(h))
# --- own history series per symbol
def series(sym):
    try: rows=json.load(open(f'recon/{sym}.json')); return [(r[0],r[1]) for r in rows],'rebuilt from chart-API bars with the publisher maths'
    except FileNotFoundError:
        ch=[r for r in json.load(open('ch_commod.json')) if r['ticker']==sym]
        return [(r['snapshot_date'],r['composite']) for r in ch],'nightly composite_history rows (real, stamped)'
stored5={r['ticker']:r['composite'] for r in json.load(open('ch_funds.json')) if r['snapshot_date']=='2026-10-05'}
res={'as_of':{'alloc_read_utc':dt.datetime.utcnow().isoformat()+'Z','geiger_computed_utc':live['computed_utc']},'rrg_settings':{'rs_smooth_weeks':4,'ratio_window_weeks':RW,'momentum_roc_weeks':MP,'momentum_z_weeks':MW,'tail_weeks':TAIL,'benchmark':'SPY'},'sectors':{},'funds':{},'recon':{}}
def own(sym,today):
    s,src=series(sym); d=[x[0] for x in s]; v=np.array([x[1] for x in s],float)
    if len(v)==0: return None
    cut12=(dt.date.fromisoformat(d[-1])-dt.timedelta(days=365)).isoformat()
    v12=v[np.array([x>=cut12 for x in d])]
    out={'source':src,'first':d[0],'last':d[-1],'sessions_total':int(len(v)),'sessions_12m':int(len(v12)),
         'today':today,'pct_12m':pct(v12,today),'pct_all':pct(v,today),
         'p10_12m':float(np.percentile(v12,10)),'median_12m':float(np.percentile(v12,50)),'p90_12m':float(np.percentile(v12,90)),'min_12m':float(v12.min()),'max_12m':float(v12.max()),
         'median_all':float(np.median(v)),'p10_all':float(np.percentile(v,10)),'p90_all':float(np.percentile(v,90)),
         'span_years':round((dt.date.fromisoformat(d[-1])-dt.date.fromisoformat(d[0])).days/365.25,2)}
    # share of the 12 months spent "overbought" (> +0.2) and "oversold" (< -0.2) on the allocation's words
    out['share_12m_above_0p2']=float((v12>0.2).mean()); out['share_12m_below_m0p2']=float((v12<-0.2).mean())
    out['series_12m']=[(a,round(float(b),4)) for a,b in zip([x for x in d if x>=cut12],v12)]
    return out
for sym in ['XLK','XLV','XLF','XLY','XLI','XLB','XLE','XLP','XLU','XLRE','XLC','RSPT','RSPH','RSPF','RSPD','RSPN','RSPM','RSPG','RSPS','RSPU','RSPR','RSPC','SPY','SMH']:
    today=livesym[sym]['composite']
    res['funds'][sym]=own(sym,today)
    rb=json.load(open(f'recon/{sym}.json'))[-1]
    res['recon'][sym]={'rebuilt_5oct':round(rb[1],4),'stored_5oct_chart_api_geiger':stored5.get(sym),'live_today':today}
for sym in ['BTCUSD','GCUSD','CLUSD']:
    ch=[r for r in json.load(open('ch_commod.json')) if r['ticker']==sym]; today=ch[-1]['composite']
    res['funds'][sym]=own(sym,today); res['funds'][sym]['today_note']='last nightly row (5 Oct); this name is not in the chart API Geiger'
# --- RRG from weekly closes
def wk(sym):
    z=np.load(f'bars/{sym}.npz'); b=z['tf_W']; return {int(r[0]):r[4] for r in b}
spy=wk('SPY'); ts=sorted(spy)
def rrg(sym):
    c=wk(sym); common=[t for t in ts if t in c]
    if len(common)<RW+MP+MW+TAIL+2: return None
    rs_raw=np.array([100*c[t]/spy[t] for t in common])
    rs=np.full(len(rs_raw),np.nan)
    for i in range(SM-1,len(rs_raw)): rs[i]=rs_raw[i-SM+1:i+1].mean()
    def rz(x,w):
        out=np.full(len(x),np.nan)
        for i in range(w-1,len(x)):
            seg=x[i-w+1:i+1]; sd=seg.std()
            out[i]=(x[i]-seg.mean())/sd if sd>0 else 0.0
        return out
    ratio=100+rz(rs,RW); roc=np.full(len(ratio),np.nan); roc[MP:]=ratio[MP:]-ratio[:-MP]; mom=100+rz(roc,MW)
    pts=[(dt.datetime.utcfromtimestamp(common[i]/1000).strftime('%Y-%m-%d'),round(float(ratio[i]),3),round(float(mom[i]),3)) for i in range(len(common)) if not np.isnan(mom[i])]
    x,y=pts[-1][1],pts[-1][2]
    box='LEADING' if x>=100 and y>=100 else 'WEAKENING' if x>=100 else 'IMPROVING' if y>=100 else 'LAGGING'
    return {'week_end':pts[-1][0],'rs_ratio':x,'rs_momentum':y,'box':box,'tail':pts[-TAIL-1:],'weeks_used':len(common),'last_close':round(float(c[common[-1]]),4),'spy_close':round(float(spy[common[-1]]),4),'rs':round(float(rs[-1]),4),'rs_raw':round(float(rs_raw[-1]),4)}
for key,(name,cw,ew) in SECT.items():
    a=alloc.get(key,{})
    f=res['funds'].get(cw); r=rrg(cw); rew=rrg(ew) if ew else None
    # gauge: stretch = own 12m percentile of the cap-weighted fund's Geiger (the one reading with history); box from RRG of the same fund
    g=None
    if f and f['pct_12m'] is not None and r:
        p=f['pct_12m']; g={'stretch_pct':p,'box':r['box'],
           'word': ('HOT FOR ITSELF' if p>=0.8 else 'COLD FOR ITSELF' if p<=0.2 else 'INSIDE ITS NORMAL'),
           'case': ('leader on a pullback — its own low, still leading the market' if r['box'] in('LEADING','WEAKENING') and p<=0.3 else
                    'laggard that is simply low — low for itself and behind the market' if r['box'] in('LAGGING','IMPROVING') and p<=0.3 else
                    'leader running hot for itself' if r['box'] in('LEADING','WEAKENING') and p>=0.8 else
                    'laggard bouncing hot for itself' if r['box'] in('LAGGING','IMPROVING') and p>=0.8 else 'nothing unusual against its own normal')}
    res['sectors'][key]={'name':name,'cw':cw,'ew':ew,'alloc_blend_today':a.get('score'),'alloc_box_word':a.get('q'),'alloc_parts':a.get('parts'),'alloc_missing':a.get('missing'),
        'own_cw':f,'own_ew':res['funds'].get(ew) if ew else None,'rrg_cw':r,'rrg_ew':rew,'gauge':g}
for s in EXTRA: res['sectors']['SEMIS']={'name':'Semiconductors','cw':'SMH','ew':None,'alloc_blend_today':None,'own_cw':res['funds']['SMH'],'own_ew':None,'rrg_cw':rrg('SMH'),'rrg_ew':None,'gauge':None}
r=res['sectors']['SEMIS']; f=r['own_cw']; rr=r['rrg_cw']
if f and rr: p=f['pct_12m']; r['gauge']={'stretch_pct':p,'box':rr['box'],'word':('HOT FOR ITSELF' if p>=0.8 else 'COLD FOR ITSELF' if p<=0.2 else 'INSIDE ITS NORMAL')}
res['spy_rrg_check']={'spy_own':res['funds']['SPY']['pct_12m']}
json.dump(res,open('results.json','w'),indent=1,default=str)
print(f"{'sector':22s} {'blend':>6s} {'cw today':>8s} {'pct12m':>6s} {'pctAll':>6s} {'n12':>4s} {'nAll':>4s} {'ratio':>7s} {'mom':>7s} box")
for k,v in res['sectors'].items():
    f=v['own_cw']; r=v['rrg_cw']
    print(f"{v['name'][:22]:22s} {str(round(v['alloc_blend_today'],3)) if v['alloc_blend_today'] is not None else '-':>6s} {f['today']:>8.3f} {f['pct_12m']:>6.2f} {f['pct_all']:>6.2f} {f['sessions_12m']:>4d} {f['sessions_total']:>4d} {r['rs_ratio'] if r else float('nan'):>7.2f} {r['rs_momentum'] if r else float('nan'):>7.2f} {r['box'] if r else '-'}  {v['gauge']['word'] if v['gauge'] else ''}")
print('recon XLK',res['recon']['XLK'],'XLRE',res['recon']['XLRE'])
print('EW boxes',{k:(v['rrg_ew']['box'] if v['rrg_ew'] else None) for k,v in res['sectors'].items()})
