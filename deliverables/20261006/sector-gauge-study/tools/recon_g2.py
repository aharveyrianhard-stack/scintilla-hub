# Replays the publisher maths (services/hot-query/geiger-rung-math.mjs) on chart-API bars, one reading per name per session.
import json,os,sys,numpy as np,glob
W={"3h":1.235817,"4h":2.278755,"6h":3.178477,"12h":3.172702,"1d":3.178477,"3d":2.576738,"1w":0.987499}
RUNGS=["3h","4h","6h","12h","1d","3d","1w"]; TFKEY={"3h":"180","4h":"240","6h":"6h","12h":"12h","1d":"D"}
NB=230; DAY=86400000.0
def cl(x): return np.clip(x,-1,1)
def read_windows(C,H,L):
    """C,H,L: (m,n) chronological windows (same n). returns trend,mom (m,) ; publisher maths."""
    m,n=C.shape
    lines=[]
    for ty,k in [("e",5),("e",8),("e",13),("e",21),("e",34),("s",50),("s",100),("s",150),("s",200)]:
        if n<k: continue
        if ty=="e":
            a=2/(k+1); e=C[:,0].copy()
            for j in range(1,n): e=C[:,j]*a+e*(1-a)
            lines.append(e)
        else: lines.append(C[:,n-k:].mean(axis=1))
    pairs=len(lines)-1
    if pairs<=0: return np.full(m,np.nan),np.full(m,np.nan)
    ino=np.zeros(m)
    for i in range(pairs): ino+= (lines[i]>lines[i+1])
    trend=(2*ino-pairs)/pairs
    if n>=15:
        d=np.diff(C,axis=1); g=np.where(d>0,d,0.0); l=np.where(d<0,-d,0.0)
        ag=g[:,:14].mean(axis=1); al=l[:,:14].mean(axis=1)
        for j in range(14,n-1): ag=(ag*13+g[:,j])/14; al=(al*13+l[:,j])/14
        rsi=100-100/(1+np.where(al==0,1e9,ag/np.where(al==0,1,al)))
        hh=H[:,n-14:].max(axis=1); ll=L[:,n-14:].min(axis=1); close=C[:,-1]
        wr=np.where(hh>ll,(hh-close)/np.where(hh>ll,hh-ll,1)*-100,-50.0)
        mom=cl((rsi-23)/54*2-1)*0.6+cl((wr+90)/80*2-1)*0.4
    else: mom=np.full(m,np.nan)
    return trend,mom
def windows_from_idx(arr,idx):
    """arr (N,) ; idx (m,) index of last bar; returns list of (n, rows, matrix) grouped by window length."""
    return None
def rung_intraday(b,dt):
    """b: bars (N,5) t,o,h,l,c ; dt: daily session timestamps (ms, midnight ET). reading as of the end of each session date."""
    H=3600000.0
    t=b[:,0]; j=np.searchsorted(t,dt+20*H,side="left")-1         # last bar that STARTS before 20:00 ET of the session date (evening session end)
    prev=np.searchsorted(t,dt-4*H,side="left")-1                 # ... and after 20:00 ET the evening before
    ok=(j>=NB-1)&(j>prev)                                         # full 230 bars and at least one bar inside the session date
    tr=np.full(len(dt),np.nan); mo=np.full(len(dt),np.nan)
    if ok.any():
        ii=j[ok][:,None]+np.arange(-NB+1,1)[None,:]
        a,bm=read_windows(b[:,4][ii],b[:,2][ii],b[:,3][ii]); tr[ok]=a; mo[ok]=bm
    return tr,mo
def rung_daily(d):
    n=len(d); tr=np.full(n,np.nan); mo=np.full(n,np.nan)
    if n>=NB:
        ii=np.arange(NB-1,n)[:,None]+np.arange(-NB+1,1)[None,:]
        a,bm=read_windows(d[:,4][ii],d[:,2][ii],d[:,3][ii]); tr[NB-1:]=a; mo[NB-1:]=bm
    return tr,mo
def rung_bucket(d,bid):
    """3D / W rungs built from daily bars on the provider grid; the forming bar holds only days up to the reading day."""
    n=len(d); c=d[:,4];h=d[:,2];l=d[:,3]
    ub,first=np.unique(bid,return_index=True); k=np.searchsorted(ub,bid)          # bucket ordinal of each day
    last=np.r_[first[1:]-1,n-1]
    Cc=c[last]; Hc=np.maximum.reduceat(h,first); Lc=np.minimum.reduceat(l,first)   # completed bucket bars
    fh=h.copy(); fl=l.copy()
    for i in range(1,n):
        if bid[i]==bid[i-1]: fh[i]=max(fh[i-1],h[i]); fl[i]=min(fl[i-1],l[i])
    tr=np.full(n,np.nan); mo=np.full(n,np.nan)
    by={}
    for i in range(n):
        ln=min(k[i]+1,NB)
        if ln>=8: by.setdefault(ln,[]).append(i)
    for ln,rows in by.items():
        rows=np.array(rows); kk=k[rows]
        if ln>1:
            ii=kk[:,None]+np.arange(-ln+1,0)[None,:]
            C=np.c_[Cc[ii],c[rows]]; H=np.c_[Hc[ii],fh[rows]]; L=np.c_[Lc[ii],fl[rows]]
        a,bm=read_windows(C,H,L); tr[rows]=a; mo[rows]=bm
    return tr,mo
def do(sym):
    z=np.load(f"bars/{sym}.npz"); meta=json.load(open(f"bars/{sym}.meta.json"))
    if any(k not in z for k in ["tf_D","tf_180","tf_240","tf_6h","tf_12h"]): return None,"missing_tf"
    if meta["D"]["prov"]!="MASSIVE": return None,"not_massive"
    d=z["tf_D"]; dt=d[:,0]; n=len(d)
    if n<300: return None,"short"
    out={"t":dt,"o":d[:,1],"h":d[:,2],"l":d[:,3],"c":d[:,4]}
    for r in ["3h","4h","6h","12h"]:
        out["T_"+r],out["M_"+r]=rung_intraday(z["tf_"+TFKEY[r]],dt)
    out["T_1d"],out["M_1d"]=rung_daily(d)
    dayno=np.round(dt/DAY).astype(np.int64)                      # midnight ET expressed in UTC ms -> day ordinal
    import datetime as _d
    utcday=np.array([int(( _d.datetime.utcfromtimestamp(x/1000)+_d.timedelta(hours=12)).timestamp()//86400) for x in dt])  # calendar day number
    out["T_3d"],out["M_3d"]=rung_bucket(d,(utcday+1)//3)
    out["T_1w"],out["M_1w"]=rung_bucket(d,(utcday+4)//7)        # weeks start on Sunday (1970-01-01 was a Thursday)
    return out,"ok"
if __name__=="__main__":
    syms=json.load(open("uni.json"))["symbols"]; os.makedirs("recon",exist_ok=True); st={}
    for s in syms:
        if not os.path.exists(f"bars/{s}.npz"): st[s]="no_file"; continue
        o,why=do(s); st[s]=why
        if o is not None: np.savez_compressed(f"recon/{s}.npz",**o)
    import collections; print(collections.Counter(st.values())); json.dump(st,open("recon_status.json","w"))
