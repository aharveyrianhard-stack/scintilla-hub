# Seven-rung Geiger replay per name per session (SG1's rebuild.py, publisher maths unchanged), then each name's own-history percentile.
import json,os,numpy as np,datetime as d,glob
import recon_g2 as R
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}; ws=sum(W.values())
live=json.load(open('geiger.json'))['symbols']
out={}; S={}
for f in sorted(glob.glob('bars/*.npz')):
    s=os.path.basename(f)[:-4]
    if s.endswith('.tmp'): continue
    try: o,why=R.do(s)
    except Exception as e: o,why=None,'err '+str(e)[:60]
    if o is None: out[s]={'status':why}; continue
    n=len(o['t']); R_={g:np.where(np.isnan(o['M_'+g]),o['T_'+g],0.5*o['T_'+g]+0.5*o['M_'+g]) for g in W}
    ok=np.all([~np.isnan(R_[g]) for g in W],axis=0)
    comp=sum(W[g]*np.nan_to_num(R_[g]) for g in W)/ws
    dates=[d.datetime.utcfromtimestamp(x/1000+43200).strftime('%Y-%m-%d') for x in o['t']]
    ser=[(dates[i],float(comp[i])) for i in range(n) if ok[i]]
    if len(ser)<60: out[s]={'status':'thin','n':len(ser)}; continue
    S[s]=dict(ser); vals=np.array([v for _,v in ser]); last=vals[-1]; yr=vals[-251:]
    lv=(live.get(s) or {}).get('composite'); x=lv if lv is not None else last
    out[s]={'status':'ok','first':ser[0][0],'last_date':ser[-1][0],'n_sessions':len(ser),'n_12m':len(yr),'replay_last':float(last),'live':lv,
            'gap':None if lv is None else float(lv-last),'pctl_12m_close':float((yr<last).mean()*100),'pctl_12m_live':float((yr<x).mean()*100),'pctl_all_live':float((vals<x).mean()*100),
            'median_12m':float(np.median(yr)),'p10_12m':float(np.percentile(yr,10)),'p90_12m':float(np.percentile(yr,90))}
json.dump(out,open('geiger7-history.json','w'),indent=1); json.dump(S,open('geiger7-series.json','w'))
oks=[v for v in out.values() if v['status']=='ok']; gaps=[abs(v['gap']) for v in oks if v['gap'] is not None]
import collections; print(collections.Counter(v['status'] for v in out.values()))
print(len(oks),'ok | median |live today - replay last close| %.3f, 90th %.3f'%(np.median(gaps),np.percentile(gaps,90)))
for s in ['MU','SNDK','VST','CEG','NVDA','XLV','XLU','XLK','CBRS','LLY']:
    v=out.get(s,{}); print(s,{k:(round(x,3) if isinstance(x,float) else x) for k,x in v.items()})
