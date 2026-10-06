import json,urllib.request,urllib.parse,os,time,numpy as np,sys
from concurrent.futures import ThreadPoolExecutor
A="https://scintilla-massive-chart-api.fly.dev"
LIM={"D":1750,"W":220}
syms=sorted(json.load(open('scope-extra.json')).keys())+['XLC','XLY','XLP','XLI','ITA','ARKX','XLF','XLE']
syms=[s for s in syms if not os.path.exists(f'bars/{s}.npz')]
def one(sym):
    out={};meta={}
    for tf,lim in LIM.items():
        url=f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider"; d=None; err=''
        for att in range(4):
            try:
                r=urllib.request.Request(url,headers={"Origin":"https://scintillahub.ai","Accept-Encoding":"identity"}); d=json.load(urllib.request.urlopen(r,timeout=90)); break
            except Exception as e: err=str(e)[:80]; time.sleep(2+3*att)
        if d is None or not d.get("series"): meta[tf]={"err":(err if d is None else d.get("error","empty"))}; continue
        s=d["series"]; out[tf]=np.array([[x["t"],x["o"],x["h"],x["l"],x["c"]] for x in s],dtype=np.float64)
        meta[tf]={"prov":d.get("provider"),"n":len(s),"newest":d.get("newest"),"basis":d.get("price_basis")}
    np.savez_compressed(f"bars/{sym}.npz",**{"tf_"+k:v for k,v in out.items()}); json.dump(meta,open(f"bars/{sym}.meta.json","w")); return sym,{k:(v.get("n") or v.get("err")) for k,v in meta.items()}
with ThreadPoolExecutor(3) as ex:
    for sym,st in ex.map(one,syms): print(sym,st,flush=True)
print("DONE",len(syms))
