import json,os,numpy as np,pandas as pd,glob,datetime as dt
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}
RUNGS=list(W)
rows=[]
for fn in sorted(glob.glob("recon/*.npz")):
    s=os.path.basename(fn)[:-4]; z=np.load(fn); n=len(z["t"])
    d=pd.DataFrame({k:z[k] for k in z.files}); d["sym"]=s
    d["date"]=(pd.to_datetime(d.t,unit="ms")+pd.Timedelta(hours=12)).dt.normalize()
    c=d.c.values;o=d.o.values
    def sh(a,k): 
        r=np.full(n,np.nan); r[:n-k]=a[k:]; return r
    o1=sh(o,1)
    for h in (1,5,20):
        d[f"fo{h}"]=sh(c,h)/o1-1; d[f"cc{h}"]=sh(c,h)/c-1
    d["gap"]=o1/c-1
    r=pd.Series(c).pct_change().abs(); d["usual"]=r.rolling(60,min_periods=40).median().values
    for g in RUNGS:
        T=d["T_"+g];M=d["M_"+g]; d["R_"+g]=np.where(M.notna(),0.5*T+0.5*M,T)
    ws=sum(W.values()); allok=np.all([d["R_"+g].notna() for g in RUNGS],axis=0)
    d["COMP"]=np.where(allok,sum(W[g]*d["R_"+g] for g in RUNGS)/ws,np.nan)
    d["EQUAL"]=np.where(allok,sum(d["R_"+g] for g in RUNGS)/7,np.nan)
    d["TREND"]=np.where(allok,sum(W[g]*d["T_"+g] for g in RUNGS)/ws,np.nan)
    d["MOM"]=np.where(allok,sum(W[g]*d["M_"+g] for g in RUNGS)/ws,np.nan)
    for g in RUNGS:
        d["LOO_"+g]=np.where(allok,sum(W[k]*d["R_"+k] for k in RUNGS if k!=g)/(ws-W[g]),np.nan)
    d["first_bar"]=d.date.iloc[0]
    rows.append(d[d.COMP.notna()|d.R_1d.notna()].drop(columns=["t","h","l"]))
P=pd.concat(rows,ignore_index=True)
P=P[P.date>=pd.Timestamp("2024-06-01")]
P.to_pickle("panel.pkl"); print(len(P),P.sym.nunique(),P.date.min(),P.date.max())
c=P[P.COMP.notna()].groupby("date").size(); print(c.describe()); print(c.iloc[::40])
