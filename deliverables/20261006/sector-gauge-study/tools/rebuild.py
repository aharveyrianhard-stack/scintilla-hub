# Replays the publisher's Geiger maths (G2's recon_g2.py, unchanged) on the downloaded bars: one composite per name per session.
import json,os,numpy as np,sys,datetime as d
sys.path.insert(0,os.path.dirname(__file__)); import recon_g2 as R
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}
syms=['XLK','XLV','XLF','XLY','XLI','XLB','XLE','XLP','XLU','XLRE','XLC','RSPT','RSPH','RSPF','RSPD','RSPN','RSPM','RSPG','RSPS','RSPU','RSPR','RSPC','SPY','SMH','GLD','SLV','USO','IBIT','BTCUSD','GCUSD','SIUSD','CLUSD']
os.makedirs('recon',exist_ok=True); out={}
for s in syms:
    o,why=R.do(s)
    if o is None: out[s]={'status':why}; continue
    ws=sum(W.values()); n=len(o['t']); R_={}
    for g in W:
        T=o['T_'+g]; M=o['M_'+g]; R_[g]=np.where(np.isnan(M),T,0.5*T+0.5*M)
    ok=np.all([~np.isnan(R_[g]) for g in W],axis=0)
    comp=np.where(ok,sum(W[g]*R_[g] for g in W)/ws,np.nan); trend=np.where(ok,sum(W[g]*o['T_'+g] for g in W)/ws,np.nan)
    mom=np.where(ok,sum(W[g]*np.where(np.isnan(o['M_'+g]),0,o['M_'+g]) for g in W)/ws,np.nan)
    dates=[d.datetime.utcfromtimestamp(x/1000+43200).strftime('%Y-%m-%d') for x in o['t']]
    rows=[(dates[i],float(comp[i]),float(trend[i]),float(mom[i]),float(o['c'][i])) for i in range(n) if ok[i]]
    json.dump(rows,open(f'recon/{s}.json','w')); out[s]={'status':'ok','n_full':len(rows),'first':rows[0][0],'last':rows[-1][0]}
json.dump(out,open('recon_status.json','w'),indent=1); print(out)
