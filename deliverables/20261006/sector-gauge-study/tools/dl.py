# Downloads the bars this study needs from the chart API (no key; the Hub's own public read). Rung bars for the Geiger replay, weekly bars for the RRG.
import json,urllib.request,urllib.parse,os,time,numpy as np
from concurrent.futures import ThreadPoolExecutor
A="https://scintilla-massive-chart-api.fly.dev"
LIM={"D":1750,"180":3350,"240":2350,"6h":2350,"12h":1300,"W":220}
syms=['XLK','XLV','XLF','XLY','XLI','XLB','XLE','XLP','XLU','XLRE','XLC','RSPT','RSPH','RSPF','RSPD','RSPN','RSPM','RSPG','RSPS','RSPU','RSPR','RSPC','SPY','SMH','GLD','SLV','USO','BTCUSD','GCUSD','SIUSD','CLUSD','IBIT']
os.makedirs("bars",exist_ok=True)
def one(sym):
    out={};meta={}
    for tf,lim in LIM.items():
        url=f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider"; d=None
        for att in range(4):
            try:
                r=urllib.request.Request(url,headers={"Origin":"https://scintillahub.ai","Accept-Encoding":"identity"}); d=json.load(urllib.request.urlopen(r,timeout=90)); break
            except Exception as e: err=str(e)[:80]; time.sleep(2+3*att)
        if d is None or not d.get("series"): meta[tf]={"err":(err if d is None else d.get("error","empty"))}; continue
        s=d["series"]; out[tf]=np.array([[x["t"],x["o"],x["h"],x["l"],x["c"]] for x in s],dtype=np.float64)
        meta[tf]={"prov":d.get("provider"),"n":len(s),"full":d.get("full_series_count"),"newest":d.get("newest"),"basis":d.get("price_basis"),"surface":d.get("surface"),"ns":d.get("source_namespace")}
    np.savez_compressed(f"bars/{sym}.npz",**{"tf_"+k:v for k,v in out.items()}); json.dump(meta,open(f"bars/{sym}.meta.json","w")); return sym,{k:(v.get("n") or v.get("err")) for k,v in meta.items()}
with ThreadPoolExecutor(3) as ex:
    for sym,st in ex.map(one,syms): print(sym,st,flush=True)
