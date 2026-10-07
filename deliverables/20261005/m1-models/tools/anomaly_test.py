# Our "N x its usual day" rule vs three public approaches, on real daily bars from our chart service (read-only GETs).
import json,sys,time,urllib.request,statistics,math,concurrent.futures as cf
S=sys.argv[1]
tks=[r['ticker'] for r in json.load(open(S+'/data/tk_raw.json'))['rows']]
def get(t):
    try:
        req=urllib.request.Request(f"https://scintilla-massive-chart-api.fly.dev/candles?symbol={t}&tf=1d&limit=330",headers={'origin':'https://scintillahub.ai'})
        j=json.load(urllib.request.urlopen(req,timeout=25)); bars=j.get('series') or []
        c=[(b.get('time') or b.get('t'), b.get('close') if b.get('close') is not None else b.get('c')) for b in bars]
        return t,[x for x in c if x[1]]
    except Exception as e: return t,[]
with cf.ThreadPoolExecutor(6) as ex: data=dict(ex.map(get,tks))
data={t:c for t,c in data.items() if len(c)>=300}
print('names with >=300 daily bars:',len(data),flush=True)
from river import anomaly
EVAL=250; LAST=5
methods=['ours: |move| >= 2 x stdev of last 60 moves, and >= 1%','robust: |move - median| >= 3 x (1.4826 x MAD) over last 60, and >= 1%','EWMA volatility (RiskMetrics, lambda 0.94): |move| >= 2 x, and >= 1%','river HalfSpaceTrees (streaming, window 60): score >= 0.9, and >= 1%']
flags={m:{} for m in methods}; t_spent={m:0.0 for m in methods}
for t,c in data.items():
    px=[x[1] for x in c]; r=[(px[i]/px[i-1]-1)*100 for i in range(1,len(px))]
    n=len(r); start=n-EVAL
    f={m:[] for m in methods}
    t0=time.time()
    for i in range(start,n):
        h=r[i-60:i]; f[methods[0]].append(abs(r[i])>=2*statistics.pstdev(h) and abs(r[i])>=1)
    t_spent[methods[0]]+=time.time()-t0; t0=time.time()
    for i in range(start,n):
        h=r[i-60:i]; med=statistics.median(h); mad=statistics.median([abs(x-med) for x in h])*1.4826 or 1e-9
        f[methods[1]].append(abs(r[i]-med)>=3*mad and abs(r[i])>=1)
    t_spent[methods[1]]+=time.time()-t0; t0=time.time()
    v=statistics.pvariance(r[:start][-60:])
    for i in range(start,n):
        f[methods[2]].append(abs(r[i])>=2*math.sqrt(v) and abs(r[i])>=1); v=0.94*v+0.06*r[i]*r[i]
    t_spent[methods[2]]+=time.time()-t0; t0=time.time()
    lo,hi=min(r),max(r); hst=anomaly.HalfSpaceTrees(n_trees=25,height=8,window_size=60,seed=1,limits={'x':(lo,hi)})
    for i in range(n):
        s=hst.score_one({'x':r[i]}); hst.learn_one({'x':r[i]})
        if i>=start: f[methods[3]].append(s>=0.9 and abs(r[i])>=1)
    t_spent[methods[3]]+=time.time()-t0
    for m in methods: flags[m][t]=f[m]
out=[]; base=methods[0]
for m in methods:
    tot=sum(sum(v) for v in flags[m].values()); days=EVAL*len(data)
    last=sum(sum(v[-LAST:]) for v in flags[m].values())
    both=sum(sum(a and b for a,b in zip(flags[m][t],flags[base][t])) for t in data); either=sum(sum(a or b for a,b in zip(flags[m][t],flags[base][t])) for t in data)
    # follow-through check: does a flag mark a bigger-than-usual next day? ratio of mean |next-day move| after a flag vs unconditional
    nxt=[];allm=[]
    for t,c in data.items():
        px=[x[1] for x in c]; r=[(px[i]/px[i-1]-1)*100 for i in range(1,len(px))][-EVAL:]
        for i in range(len(r)-1):
            allm.append(abs(r[i+1]))
            if flags[m][t][i]: nxt.append(abs(r[i+1]))
    d={'method':m,'share_of_name_days_flagged':round(tot/days,4),'flags_per_day_per_100_names':round(tot/days*100,1),'flags_in_last_5_sessions':last,'overlap_with_ours_jaccard':round(both/either,2) if either else None,'next_day_move_vs_normal':round((sum(nxt)/len(nxt))/(sum(allm)/len(allm)),2) if nxt else None,'ms_per_name_250_days':round(t_spent[m]/len(data)*1000,1)}
    out.append(d); print(d,flush=True)
json.dump({'names':len(data),'sessions_evaluated':EVAL,'source':'scintilla-massive-chart-api /candles tf=1d (split-adjusted daily closes)','results':out},open(S+'/data/anomaly_test.json','w'),indent=1)
