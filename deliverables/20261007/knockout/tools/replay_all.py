# KO1 · step 5 of the run (see README.md) · the Geiger replay for every name with bars, kept as replay.pkl (the last 300
# evenings of each), and its check against the live Geiger read after the close. `--new` replays only the names fetched here.
import json,os,sys,time,pickle,numpy as np,collections
sys.path.insert(0,os.path.dirname(os.path.abspath(__file__)))
os.environ["GH1_BARS"]="bars"
import geiger_replay as G
syms=json.load(open("symbols-to-replay.json")); LIVE=json.load(open("geiger-live.json"))["symbols"]
only_new="--new" in sys.argv
RES=pickle.load(open("replay.pkl","rb")) if only_new and os.path.exists("replay.pkl") else {}
t0=time.time(); why={}
for s in syms:
    if not os.path.exists(f"bars/{s}.npz"): why[s]="no bars"; continue
    if only_new and os.path.islink(f"bars/{s}.npz") and s in RES: continue
    try: o,w=G.replay(s)
    except Exception as e: o,w=None,"err "+str(e)[:90]
    if o is None: why[s]=w; RES.pop(s,None); continue
    n=len(o["t"]); k=slice(max(0,n-300),n)
    RES[s]={"date":o["date"][max(0,n-300):],"g":o["g"][k],"trend":o["trend"][k],"mom":o["mom"][k],"nr":o["nr"][k],"full":o["full"][k],"c":o["c"][k],"n_daily":n}
pickle.dump(RES,open("replay.pkl","wb"),protocol=4)
print("replayed",len(RES),"skipped",why,round(time.time()-t0),"s")
gaps=[];bad=[];lastdates=collections.Counter(); rungs=collections.Counter()
for s,o in RES.items():
    lastdates[o["date"][-1]]+=1; rungs[int(o["nr"][-1])]+=1
    lv=(LIVE.get(s) or {}).get("composite")
    if lv is None or o["date"][-1]!="2026-10-06" or not np.isfinite(o["g"][-1]): continue
    g=abs(float(o["g"][-1])-lv); gaps.append(g)
    if g>0.01: bad.append((round(g,3),s,round(float(o["g"][-1]),3),round(lv,3),int(o["nr"][-1]),(LIVE.get(s) or {}).get("tf_contributors"),"linked" if os.path.islink(f"bars/{s}.npz") else "fetched"))
gaps=np.array(gaps); print("last replayed session:",dict(lastdates),"| rungs on the last session:",dict(rungs))
print("replay of the 6 Oct evening against the live Geiger read at 01:55 ET:",len(gaps),"names · equal to 4 decimals",int((gaps<1e-4).sum()),"· within 0.01:",int((gaps<0.01).sum()),"· within 0.03:",int((gaps<0.03).sum()),"· median %.5f p90 %.4f max %.3f"%(np.median(gaps),np.percentile(gaps,90),gaps.max()))
print("gaps above 0.01:",len(bad),sorted(bad,reverse=True)[:30])
