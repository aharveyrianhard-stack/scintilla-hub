import json,sys,subprocess,os,concurrent.futures as cf
tag=sys.argv[1]; runs=int(sys.argv[2]) if len(sys.argv)>2 else 3
HUB=sys.argv[3] if len(sys.argv)>3 else "/Users/alanharvey/SCINTILLA 0.5/_worktrees/hub-switch-on-20260928"
def job(target,cold,width,i):
    steps=[] if cold else [{"do":"waitFor","sel":'.sc-board__row[data-t="MU"]',"ms":60000}]
    if cold: steps=[{"do":"waitFor","sel":"#boardScroll, body","ms":30000}]
    steps+= [{"do":"open","t":"MU","clouds":True,"rsi":True,"ms":90000}]
    j={"name":f"{target}-{cold}-{width}-{i}","target":target,"path":"/","hubRoot":HUB,"width":width,"height":844 if width<500 else 1050,"mobile":width<500,"apiLog":True,
       "localStorage":{"hub.company.expanded":"0"},"steps":steps}
    f=f".sj-{target}-{cold}-{width}-{i}.json"; open(f,"w").write(json.dumps(j))
    out=json.loads(subprocess.run(["node","harness.mjs",f],capture_output=True,text=True,timeout=300).stdout); os.unlink(f)
    o=[r for r in out["results"] if r["step"]=="open"][0]
    frame=[a for a in out.get("api",[]) if a["from"]=="frame" and "candles" in a["path"]]
    return dict(target=target,cold=cold,width=width,run=i,how=o.get("how"),priceMs=o.get("priceMs"),cloudsMs=o.get("cloudsMs"),rsiMs=o.get("rsiMs"),
                fanLines=(o.get("probe") or {}).get("rsiLines"),frameCandles=[(a["path"].split("?")[1],a["start"],a["end"]) for a in frame][:10],errors=out.get("errors"))
res=[]
for i in range(runs):
  for cold in (True,False):
    for width in (1680,390):
      with cf.ThreadPoolExecutor(2) as ex:
        res+=list(ex.map(lambda t: job(t,cold,width,i),["live","local"]))
json.dump(res,open(f"../measure/{tag}.json","w"),indent=1)
for r in res: print(r["target"],"cold" if r["cold"] else "warm",r["width"],r["run"],r["how"],"price",r["priceMs"],"clouds",r["cloudsMs"],"rsi",r["rsiMs"],len(r["fanLines"] or []))
