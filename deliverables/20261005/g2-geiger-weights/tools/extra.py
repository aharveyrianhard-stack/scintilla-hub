import json,numpy as np,pandas as pd,warnings
warnings.filterwarnings("ignore")
M=pd.read_pickle("M.pkl"); P=pd.read_pickle("panel.pkl")
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}; RUNGS=list(W); HZ=(1,5,20)
res={}
SIG=["COMP","TREND","MOM"]+["R_"+g for g in RUNGS]
# 1. per-name own time-series rank correlation, raw and against the same day median name
for s in SIG: M["z_"+s]=M[s]-M.groupby("date")[s].transform("median")
pn={}
for s in SIG:
    e={}
    for h in HZ:
        raw=[];exc=[]
        for sym,g in M.groupby("sym"):
            d=g[[s,"z_"+s,f"fo{h}",f"x{h}"]].dropna()
            if len(d)<150: continue
            raw.append(d[s].rank().corr(d[f"fo{h}"].rank())); exc.append(d["z_"+s].rank().corr(d[f"x{h}"].rank()))
        raw=np.array(raw);exc=np.array(exc)
        e[h]={"n":int(len(raw)),"raw_med":float(np.median(raw)),"raw_p10":float(np.percentile(raw,10)),"raw_p90":float(np.percentile(raw,90)),"raw_pos":float((raw>0).mean()),
              "exc_med":float(np.median(exc)),"exc_p10":float(np.percentile(exc,10)),"exc_p90":float(np.percentile(exc,90)),"exc_pos":float((exc>0).mean())}
        if s=="COMP": e[h]["raw_hist"]=np.histogram(raw,bins=np.linspace(-.5,.5,21))[0].tolist(); e[h]["exc_hist"]=np.histogram(exc,bins=np.linspace(-.5,.5,21))[0].tolist()
    pn[s]=e
res["per_name_ts"]=pn
# 2. own-decile hot vs cold, with and without the spring-2025 sell-off window, and on non-overlapping days
def hc(d,h):
    hot=d[d.ob_COMP==10]; cold=d[d.ob_COMP==1]; al=d[d.ob_COMP.notna()]
    f=f"fo{h}"; x=f"x{h}"
    return {"hot_n":int(hot[f].notna().sum()),"cold_n":int(cold[f].notna().sum()),"hot_med":float(hot[f].median()),"cold_med":float(cold[f].median()),"all_med":float(al[f].median()),
            "hot_up":float((hot[f].dropna()>0).mean()),"cold_up":float((cold[f].dropna()>0).mean()),"all_up":float((al[f].dropna()>0).mean()),
            "hot_x":float(hot[x].median()),"cold_x":float(cold[x].median()),"hot_days":int(hot.date.nunique()),"cold_days":int(cold.date.nunique())}
ex=M[(M.date<"2025-03-01")|(M.date>"2025-05-31")]
days=np.sort(M.date.unique())
res["own_hot_cold"]={h:{"all":hc(M,h),"ex_spring_2025":hc(ex,h),"non_overlap":hc(M[M.date.isin(days[::h])],h)} for h in HZ}
# where do the cold readings sit in time? share of all own-cold-decile rows by month
cm=M[M.ob_COMP==1].groupby(M.date.dt.strftime("%Y-%m")).size(); hm=M[M.ob_COMP==10].groupby(M.date.dt.strftime("%Y-%m")).size(); am=M[M.ob_COMP.notna()].groupby(M.date.dt.strftime("%Y-%m")).size()
res["own_by_month"]={"months":list(am.index),"cold_share":[float(cm.get(k,0)/am[k]) for k in am.index],"hot_share":[float(hm.get(k,0)/am[k]) for k in am.index]}
spy=P[P.sym=="SPY"].set_index("date").c; spy=spy[spy.index>=M.date.min()]
res["spy"]={"dates":[str(x.date()) for x in spy.index[::5]],"c":[float(v) for v in spy.values[::5]]}
# 3. weights tuned on the first half, judged on the second half
feat=["T_"+g for g in RUNGS]+["M_"+g for g in RUNGS]; mid=days[len(days)//2]; tune={}
for h in HZ:
    d=M[["date"]+feat+[f"fo{h}","COMP"]].dropna().copy()
    for c in feat+[f"fo{h}","COMP"]: d[c]=d.groupby("date")[c].rank(pct=True)-0.5
    a=d[d.date<mid]; b=d[d.date>=mid]
    beta=np.linalg.lstsq(a[feat].values,a[f"fo{h}"].values,rcond=None)[0]
    def ic(dd,sig): 
        t=dd.assign(s=sig); v=t.groupby("date").apply(lambda q:q.s.rank().corr(q[f"fo{h}"].rank())); return float(v.mean()),int(v.notna().sum()),float(v.mean()/(v.std()/np.sqrt(max(len(v)/h,1))))
    tune[h]={"beta":dict(zip(feat,[float(x) for x in beta])),"in_sample":ic(a,a[feat].values@beta),"out_sample":ic(b,b[feat].values@beta),"today_in":ic(a,a.COMP.values),"today_out":ic(b,b.COMP.values),"split":str(pd.Timestamp(mid).date())}
res["tuned"]=tune
# 4. extremes either way: is a reading far from the name usual level followed by a larger move?
q=M.ob_COMP; M["ext"]=np.where(q.isin([1,10]),"extreme (own top or bottom tenth)",np.where(q.isin([5,6]),"middle (own 5th-6th tenth)",None))
res["extreme_move"]={h:{k:{"n":int(g[f"mv{h}"].notna().sum()),"mv":float(g[f"mv{h}"].median()),"big":float((g[f"mv{h}"].dropna()>=2*np.sqrt(h)).mean())} for k,g in M.dropna(subset=["ext"]).groupby("ext")} for h in HZ}
# 5. stored snapshots (composite_history) - real ones only
hst=pd.DataFrame(json.load(open("composite_history.json"))); hst["src"]=pd.to_datetime(hst.source_ts,unit="s"); hst["et"]=(hst.src-pd.Timedelta(hours=4))
real=hst.drop_duplicates(["ticker","source_ts"]).copy(); real["date"]=real.et.dt.normalize()
res["stored"]={"rows_total":int(len(hst)),"rows_distinct_reading":int(len(real)),"names":int(hst.ticker.nunique()),"dates_total":int(hst.snapshot_date.nunique()),
  "frozen_rows":int(len(hst)-len(real)),"frozen_names":int((hst[hst.snapshot_date=="2026-10-02"].src<"2026-08-25").sum()),"live_names_after_24aug":int((hst[hst.snapshot_date=="2026-10-02"].src>="2026-08-25").sum())}
j=real.merge(P[["sym","date","fo1","fo5","fo20","COMP"]],left_on=["ticker","date"],right_on=["sym","date"])
j=j[(j.et.dt.hour>=20)]            # evening captures only: the next open is strictly later
res["stored"]["rows_joined_evening"]=int(len(j)); res["stored"]["dates_joined"]=sorted({str(x.date()) for x in j.date}); res["stored"]["names_joined"]=int(j.sym.nunique())
st={}
for h in HZ:
    d=j[["date","composite",f"fo{h}"]].dropna(); v=d.groupby("date").apply(lambda q:q.composite.rank().corr(q[f"fo{h}"].rank()) if len(q)>=50 else np.nan).dropna()
    st[h]={"rows":int(len(d)),"days":int(len(v)),"ic":float(v.mean()) if len(v) else None,"ic_by_day":{str(k.date()):round(float(x),3) for k,x in v.items()}}
    qq=d.groupby("date").composite.rank(pct=True); hot=d[qq>0.9][f"fo{h}"]; cold=d[qq<=0.1][f"fo{h}"]
    st[h].update({"hot_n":int(len(hot)),"cold_n":int(len(cold)),"hot_med":float(hot.median()),"cold_med":float(cold.median()),"hot_up":float((hot>0).mean()),"cold_up":float((cold>0).mean())})
res["stored"]["h"]=st
res["stored"]["agreement"]={str(k.date()):{"n":int(len(g)),"corr":float(np.corrcoef(g.COMP,g.composite)[0,1]),"med_abs_diff":float((g.COMP-g.composite).abs().median())} for k,g in j.dropna(subset=["COMP","composite"]).groupby("date") if len(g)>50}
json.dump(res,open("results/D.json","w"))
for s in SIG: print(s,{h:(round(v["raw_med"],3),round(v["raw_pos"],2),round(v["exc_med"],3),round(v["exc_pos"],2)) for h,v in pn[s].items()})
print(json.dumps(res["own_hot_cold"],indent=0)[:2500]); print({h:(v["in_sample"],v["out_sample"],v["today_in"],v["today_out"]) for h,v in tune.items()}); print(res["extreme_move"]); print({k:v for k,v in res["stored"].items() if k not in("h",)}); print(st)
print(list(zip(res["own_by_month"]["months"],np.round(res["own_by_month"]["cold_share"],2),np.round(res["own_by_month"]["hot_share"],2))))
