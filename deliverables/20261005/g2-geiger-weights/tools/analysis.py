import json,numpy as np,pandas as pd,warnings
warnings.filterwarnings("ignore")
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}
RUNGS=list(W); HZ=(1,5,20)
P=pd.read_pickle("panel.pkl").sort_values(["sym","date"]).reset_index(drop=True)
prof={r["ticker"]:r for r in json.load(open("profile.json"))}
uni=json.load(open("uni.json")); gonly=set(uni["tiers"]["geiger_only"])
coh={}
for r in json.load(open("cohorts.json")): coh.setdefault(r["ticker"],[]).append(r["cohort"])
def sector(s):
    p=prof.get(s)
    if s in gonly or (p and p.get("is_etf")) or "FUNDS" in coh.get(s,[]) or "INDEXES" in coh.get(s,[]): return "Funds (ETFs)"
    if p and p.get("sector"): return p["sector"]
    return "Unlabelled"
P["sector"]=P.sym.map(sector)
SIG=["COMP","EQUAL","TREND","MOM"]+["R_"+g for g in RUNGS]+["T_"+g for g in RUNGS]+["M_"+g for g in RUNGS]+["LOO_"+g for g in RUNGS]
# main sample: all seven rungs present
M=P[P.COMP.notna()].copy()
_cnt=M.groupby("date").size(); _start=_cnt[_cnt>=500].index.min(); M=M[M.date>=_start].copy()
days=np.sort(M.date.unique()); res={}
res["sample"]={"rows":int(len(M)),"names":int(M.sym.nunique()),"first":str(M.date.min().date()),"last":str(M.date.max().date()),"sessions":int(len(days)),
  "rows_fo1":int(M.fo1.notna().sum()),"rows_fo5":int(M.fo5.notna().sum()),"rows_fo20":int(M.fo20.notna().sum()),
  "names_per_day_min":int(M.groupby("date").size().min()),"names_per_day_median":float(M.groupby("date").size().median()),"names_per_day_max":int(M.groupby("date").size().max())}
fr=M.groupby("sym").date.min(); res["sample"]["names_present_from_start"]=int((fr<=days[5]).sum()); res["sample"]["names_joined_later"]=int((fr>days[5]).sum())
res["sample"]["sector_names"]=M.groupby("sector").sym.nunique().to_dict()
# market backdrop
eq=M.groupby("date").cc1.median(); res["market"]={"median_name_daily_up_share":float((M.cc1>0).mean())}
spy=P[P.sym=="SPY"].set_index("date").c; spy=spy[(spy.index>=M.date.min())&(spy.index<=M.date.max())]
res["market"]["spy_first"]=float(spy.iloc[0]); res["market"]["spy_last"]=float(spy.iloc[-1]); res["market"]["spy_change"]=float(spy.iloc[-1]/spy.iloc[0]-1)
res["market"]["spy_maxdd"]=float((spy/spy.cummax()-1).min())
tot=M.groupby("sym").apply(lambda a:a.c.iloc[-1]/a.c.iloc[0]-1); res["market"]["median_name_change"]=float(tot.median()); res["market"]["share_names_up"]=float((tot>0).mean())
for h in HZ: res["market"][f"base_up_fo{h}"]=float((M[f"fo{h}"]>0).mean()); res["market"][f"base_med_fo{h}"]=float(M[f"fo{h}"].median())
# excess vs the day median name, and move in units of the usual day
for h in HZ:
    M[f"x{h}"]=M[f"fo{h}"]-M.groupby("date")[f"fo{h}"].transform("median")
    M[f"mv{h}"]=M[f"fo{h}"].abs()/M.usual
    M[f"xc{h}"]=M[f"cc{h}"]-M.groupby("date")[f"cc{h}"].transform("median")
# ranks
def ic_table(col_ret):
    out={}
    for s in SIG:
        out[s]={}
        for h in HZ:
            r=f"{col_ret}{h}"; d=M[["date",s,r]].dropna()
            g=d.groupby("date"); rs=g[s].rank(); rr=g[r].rank()
            d=d.assign(rs=rs,rr=rr); ic=d.groupby("date").apply(lambda a:np.corrcoef(a.rs,a.rr)[0,1] if len(a)>=50 and a.rs.std()>0 else np.nan).dropna()
            n=len(ic); t=ic.mean()/(ic.std()/np.sqrt(max(n/h,1)))
            out[s][h]={"ic":float(ic.mean()),"days":int(n),"pos_days":float((ic>0).mean()),"t":float(t)}
            if s=="COMP": res.setdefault("ic_series_"+col_ret,{})[h]={"dates":[str(x.date()) for x in ic.index],"ic":[round(float(v),4) for v in ic.values]}
    return out
res["ic_next_open"]=ic_table("fo"); res["ic_close_to_close"]=ic_table("cc")
# cross-section deciles each day
def bstats(d,h):
    f=d[f"fo{h}"]; x=d[f"x{h}"]; mv=d[f"mv{h}"]
    return {"n":int(f.notna().sum()),"med":float(f.median()),"mean":float(f.mean()),"up":float((f.dropna()>0).mean()),"xmed":float(x.median()),"xup":float((x.dropna()>0).mean()),"mv":float(mv.median()),"big":float((mv.dropna()>=(2*np.sqrt(h))).mean()),"days":int(d.date.nunique())}
def deciles_cs(s):
    q=M.groupby("date")[s].rank(pct=True); b=np.ceil(q*10).clip(1,10)
    return {h:{int(k):bstats(g,h) for k,g in M.assign(b=b).dropna(subset=[s]).groupby("b")} for h in HZ}
def own_pct(s):
    return M.groupby("sym")[s].transform(lambda a:a.rolling(250,min_periods=120).apply(lambda x:(x[:-1]<x[-1]).mean()+0.5*(x[:-1]==x[-1]).mean(),raw=True))
def deciles_own(s,ret=False):
    q=own_pct(s); b=np.ceil(q*10).clip(1,10)
    out={h:{int(k):bstats(g,h) for k,g in M.assign(b=b).dropna(subset=["b"]).groupby("b")} for h in HZ}
    return (out,b) if ret else out
res["cs"]={s:deciles_cs(s) for s in ["COMP","EQUAL","TREND","MOM"]+["R_"+g for g in RUNGS]}
res["own"]={}
for s in ["COMP","TREND","MOM"]+["R_"+g for g in RUNGS]:
    o,b=deciles_own(s,True); res["own"][s]=o; M["ob_"+s]=b
M["cb_COMP"]=np.ceil(M.groupby("date").COMP.rank(pct=True)*10).clip(1,10)
# flash: today change in the reading against the name usual daily change
for s in ["COMP"]+["R_"+g for g in RUNGS]:
    dlt=M.groupby("sym")[s].diff(); ad=dlt.abs()
    usual=ad.groupby(M.sym).transform(lambda a:a.rolling(60,min_periods=40).median().shift(1))
    M["fl_"+s]=ad/usual; M["fd_"+s]=np.sign(dlt)
def flash(s):
    out={}
    lab=pd.cut(M["fl_"+s],[-1,1,2,3,5,1e9],labels=["<1x","1-2x","2-3x","3-5x","5x+"])
    for dirn,nm in ((1,"up"),(-1,"down")):
        d=M[M["fd_"+s]==dirn].assign(lab=lab)
        out[nm]={h:{str(k):bstats(g,h) for k,g in d.groupby("lab") if len(g)} for h in HZ}
    return out
res["flash"]={s:flash(s) for s in ["COMP"]+["R_"+g for g in RUNGS]}
# per sector: composite hot (own top decile) vs cold (own bottom decile), and cross-section IC inside the sector
sec={}
for nm,g in M.groupby("sector"):
    e={"names":int(g.sym.nunique())}
    for h in HZ:
        hot=g[g.ob_COMP==10]; cold=g[g.ob_COMP==1]; mid=g[g.ob_COMP.notna()]
        e[h]={"hot":bstats(hot,h),"cold":bstats(cold,h),"all":bstats(mid,h)}
        d=g[["date","COMP",f"fo{h}"]].dropna(); ic=d.groupby("date").apply(lambda a:a.COMP.rank().corr(a[f"fo{h}"].rank()) if len(a)>=12 else np.nan).dropna()
        e[h]["ic"]=float(ic.mean()) if len(ic) else None; e[h]["ic_days"]=int(len(ic)); e[h]["ic_t"]=float(ic.mean()/(ic.std()/np.sqrt(max(len(ic)/h,1)))) if len(ic)>5 else None
    sec[nm]=e
res["sector"]=sec
# per name: own time-series rank correlation and hot minus cold
pn=[]
for s,g in M.groupby("sym"):
    if g.ob_COMP.notna().sum()<150: continue
    e={"sym":s,"sector":g.sector.iloc[0],"n":int(g.ob_COMP.notna().sum())}
    for h in HZ:
        d=g[["COMP",f"fo{h}"]].dropna(); e[f"ts{h}"]=float(d.COMP.rank().corr(d[f"fo{h}"].rank()))
        hot=g[g.ob_COMP==10][f"fo{h}"]; cold=g[g.ob_COMP==1][f"fo{h}"]
        e[f"hot{h}"]=float(hot.median()) if hot.notna().sum()>=8 else None; e[f"cold{h}"]=float(cold.median()) if cold.notna().sum()>=8 else None
        e[f"hotn{h}"]=int(hot.notna().sum()); e[f"coldn{h}"]=int(cold.notna().sum())
    e["p10"]=float(g.COMP.quantile(.1)); e["p50"]=float(g.COMP.quantile(.5)); e["p90"]=float(g.COMP.quantile(.9)); e["usual"]=float(g.usual.median())
    pn.append(e)
res["per_name"]=pn
# stability: composite IC by half-year
M["half"]=M.date.dt.year.astype(str)+np.where(M.date.dt.month<=6,"-H1","-H2")
st={}
for hf,g in M.groupby("half"):
    e={"days":int(g.date.nunique())}
    for h in HZ:
        d=g[["date","COMP",f"fo{h}"]].dropna(); ic=d.groupby("date").apply(lambda a:a.COMP.rank().corr(a[f"fo{h}"].rank()) if len(a)>=50 else np.nan).dropna()
        e[h]={"ic":float(ic.mean()) if len(ic) else None,"days":int(len(ic))}
        hot=g[g.cb_COMP==10]; cold=g[g.cb_COMP==1]
        e[h]["hot_x"]=float(hot[f"x{h}"].median()); e[h]["cold_x"]=float(cold[f"x{h}"].median())
    st[hf]=e
res["halves"]=st
# look-ahead size: the same hot/cold comparison measured close-to-close (includes the after-hours move the reading already saw)
la={}
for h in HZ:
    hot=M[M.cb_COMP==10]; cold=M[M.cb_COMP==1]
    la[h]={"hot_cc_x":float(hot[f"xc{h}"].median()),"cold_cc_x":float(cold[f"xc{h}"].median()),"hot_fo_x":float(hot[f"x{h}"].median()),"cold_fo_x":float(cold[f"x{h}"].median())}
la["gap_hot_med"]=float(M[M.cb_COMP==10].gap.median()); la["gap_cold_med"]=float(M[M.cb_COMP==1].gap.median())
res["lookahead"]=la
# rung relationships
res["rung_corr"]=M[["R_"+g for g in RUNGS]].corr(method="spearman").round(3).values.tolist()
res["comp_dist"]={"p1":float(M.COMP.quantile(.01)),"p10":float(M.COMP.quantile(.1)),"p50":float(M.COMP.median()),"p90":float(M.COMP.quantile(.9)),"p99":float(M.COMP.quantile(.99))}
res["weights"]=W
json.dump(res,open("results/C.json","w")); M.to_pickle("M.pkl")
print(json.dumps(res["sample"],indent=0)); print(res["market"])
for s in ["COMP","EQUAL","TREND","MOM"]+["R_"+g for g in RUNGS]: print(s,{h:(round(v["ic"],4),round(v["t"],1),round(v["pos_days"],2)) for h,v in res["ic_next_open"][s].items()})
