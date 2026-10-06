# Adds the four intraday rung timeframes to each name's bar file so the Geiger can be replayed with all seven rungs (SG1's method).
import json,urllib.request,urllib.parse,os,time,numpy as np,glob
from concurrent.futures import ThreadPoolExecutor
A="https://scintilla-massive-chart-api.fly.dev"
LIM={"180":3350,"240":2350,"6h":2350,"12h":1300}
pri="SNDK XLU XLV MU VST CEG NFLX IBM NKE MCD CBRS WDC WMT IREN ASTS HUT ACHR SPIR KTOS GOOGL AMZN CRWV AVGO LRCX META ASML NBIS TSM AAOI AXTI LITE COHR CIEN FN POET CRDO GLW NVDA SPY QQQ SMH XLK DRAM LLY UNH".split()
allb=sorted(os.path.basename(f)[:-4] for f in glob.glob('bars/*.npz'))
syms=[s for s in pri if s in allb]+[s for s in allb if s not in pri]
def one(sym):
    z=dict(np.load(f"bars/{sym}.npz")); meta=json.load(open(f"bars/{sym}.meta.json"))
    if all("tf_"+k in z for k in LIM): return sym,'have'
    for tf,lim in LIM.items():
        url=f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider"; d=None; err=''
        for att in range(3):
            try:
                r=urllib.request.Request(url,headers={"Origin":"https://scintillahub.ai","Accept-Encoding":"identity"}); d=json.load(urllib.request.urlopen(r,timeout=90)); break
            except Exception as e: err=str(e)[:80]; time.sleep(2+3*att)
        if d is None or not d.get("series"): meta[tf]={"err":(err if d is None else d.get("error","empty"))}; continue
        s=d["series"]; z["tf_"+tf]=np.array([[x["t"],x["o"],x["h"],x["l"],x["c"]] for x in s],dtype=np.float64)
        meta[tf]={"prov":d.get("provider"),"n":len(s),"newest":d.get("newest")}
    np.savez_compressed(f"bars/{sym}.tmp.npz",**z); os.replace(f"bars/{sym}.tmp.npz",f"bars/{sym}.npz"); json.dump(meta,open(f"bars/{sym}.meta.json","w")); return sym,{k:(meta[k].get("n") or meta[k].get("err")) for k in LIM}
with ThreadPoolExecutor(5) as ex:
    for sym,st in ex.map(one,syms): print(sym,st,flush=True)
print("DONE",len(syms))
