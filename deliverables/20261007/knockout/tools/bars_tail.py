# KO1 · step 4 of the run (see README.md) · the newest session's intraday bars. A request deeper than the chart API's short tail is answered from its full
# store, which is refreshed once a night and so ends one session early; the short tail holds the newest session. This reads
# the tail (40 bars per rung, a few kB) and joins it on, after checking that the bars the two share are the same bars.
import json, urllib.request, urllib.parse, os, sys, time, numpy as np
from concurrent.futures import ThreadPoolExecutor
A = "https://scintilla-massive-chart-api.fly.dev"; TFS = ["180", "240", "6h", "12h", "D"]
syms = [s for s in json.load(open("symbols-to-replay.json")) if os.path.exists(f"bars/{s}.npz") and not os.path.islink(f"bars/{s}.npz")]
NREQ = [0]
def one(sym):
    z = dict(np.load(f"bars/{sym}.npz")); meta = json.load(open(f"bars/{sym}.meta.json")); st = {}
    if meta.get("_tail_joined") == 2: return sym, "already"
    for tf in TFS:
        k = "tf_" + tf
        if k not in z: st[tf] = "no base"; continue
        d = None
        for att in range(4):
            try:
                r = urllib.request.Request(f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit=40&authority=provider", headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
                NREQ[0] += 1; d = json.load(urllib.request.urlopen(r, timeout=60)); break
            except Exception as e: time.sleep(1.5 + 2 * att)
        if d is None or not d.get("series"): st[tf] = "tail not read"; continue
        t = np.array([[x["t"], x["o"], x["h"], x["l"], x["c"]] for x in d["series"]], dtype=np.float64); b = z[k]
        common = np.intersect1d(b[:, 0], t[:, 0])
        if not len(common): st[tf] = "no shared bar: not joined"; continue
        bi = np.searchsorted(b[:, 0], common); ti = np.searchsorted(t[:, 0], common)
        # the bars the two share: closes must agree (a different close would be a different series); highs and lows may
        # differ by an odd extended-hours print and are recorded, not refused
        dc = float(np.abs(b[bi, 4] / t[ti, 4] - 1).max()); dhl = float(np.abs(b[bi, 2:4] / t[ti, 2:4] - 1).max())
        new = t[t[:, 0] > b[-1, 0]]
        if meta.get(tf, {}).get("tail_added") is not None: st[tf] = "joined before"; continue
        if dc > 0.02: st[tf] = f"shared closes differ by {dc:.4f}: not joined"; continue
        z[k] = np.vstack([b, new]); st[tf] = int(len(new)); meta.setdefault(tf, {})["tail_added"] = int(len(new)); meta[tf]["newest_after_tail"] = d.get("newest"); meta[tf]["shared_close_diff"] = round(dc, 5); meta[tf]["shared_highlow_diff"] = round(dhl, 5)
    meta["_tail_joined"] = 2
    np.savez_compressed(f"bars/{sym}.tmp.npz", **z); os.replace(f"bars/{sym}.tmp.npz", f"bars/{sym}.npz"); json.dump(meta, open(f"bars/{sym}.meta.json", "w"))
    return sym, st
t0 = time.time(); import collections; C = collections.Counter(); odd = []
with ThreadPoolExecutor(3) as ex:
    for sym, st in ex.map(one, syms):
        if st == "already": C["already"] += 1; continue
        C[json.dumps({k: v for k, v in st.items()})] += 1
        if any(isinstance(v, str) for v in st.values()): odd.append((sym, st))
print("names", len(syms), "requests", NREQ[0], round(time.time() - t0), "s"); print(C.most_common(8)); print("not joined:", odd[:20])
