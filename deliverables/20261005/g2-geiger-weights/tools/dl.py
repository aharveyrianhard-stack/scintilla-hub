import json,urllib.request,urllib.parse,os,sys,time,numpy as np
from concurrent.futures import ThreadPoolExecutor
A="https://scintilla-massive-chart-api.fly.dev"
LIM={"D":1750,"180":3350,"240":2350,"6h":2350,"12h":1300}
syms=json.load(open("uni.json"))["symbols"]
def one(sym):
    fn=f"bars/{sym}.npz"
    if os.path.exists(fn): return sym,"cached"
    out={};meta={}
    for tf,lim in LIM.items():
        url=f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider"
        for att in range(4):
            try:
                r=urllib.request.Request(url,headers={"Origin":"https://scintillahub.ai","Accept-Encoding":"identity"})
                d=json.load(urllib.request.urlopen(r,timeout=60)); break
            except Exception as e:
                d=None; err=str(e)[:80]; time.sleep(2+3*att)
        if d is None or not d.get("series"): meta[tf]={"err": (err if d is None else "empty"), "prov": (d or {}).get("provider")}; continue
        s=d["series"]
        out[tf]=np.array([[x["t"],x["o"],x["h"],x["l"],x["c"]] for x in s],dtype=np.float64)
        meta[tf]={"prov":d.get("provider"),"n":len(s),"full":d.get("full_series_count"),"newest":d.get("newest"),"basis":d.get("price_basis"),"surface":d.get("surface")}
    np.savez_compressed(fn,**{"tf_"+k:v for k,v in out.items()})
    json.dump(meta,open(f"bars/{sym}.meta.json","w"))
    return sym,"ok" if len(out)==5 else "partial"
t0=time.time();n=0;bad=[]
with ThreadPoolExecutor(3) as ex:
    for sym,st in ex.map(one,syms):
        n+=1
        if st not in("ok","cached"): bad.append(sym)
        if n%25==0: print(n,round(time.time()-t0),"s bad",len(bad),flush=True)
print("DONE",n,round(time.time()-t0),"bad",bad,flush=True)
