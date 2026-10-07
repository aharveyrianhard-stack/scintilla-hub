# KO1 · step 3 of the run (see README.md) · bars for the seven-rung Geiger replay of every served company, from the chart API (the Hub's own public read; no key).
# Enough of each rung for a full 230-bar window on each of the last ~260 sessions. Names the Geiger-history study already
# holds at full depth (fetched after the 6 Oct close) are linked, not fetched again. Three requests at a time, as that study ran.
import json, urllib.request, urllib.parse, os, sys, time, numpy as np
from concurrent.futures import ThreadPoolExecutor
A = "https://scintilla-massive-chart-api.fly.dev"
LIM = {"D": 560, "3D": 400, "W": 310, "180": 2200, "240": 1700, "6h": 1400, "12h": 850}
GH = os.environ.get("KO1_FULL_BARS", "")   # a folder of full-depth bars already fetched after the close (the Geiger-history study's), if there is one
syms = json.load(open("symbols-to-replay.json"))
linked = 0
for s in list(syms):
    if os.path.exists(f"bars/{s}.npz"): continue
    if GH and os.path.exists(f"{GH}/{s}.npz") and os.path.exists(f"{GH}/{s}.meta.json"):
        os.symlink(f"{GH}/{s}.npz", f"bars/{s}.npz"); os.symlink(f"{GH}/{s}.meta.json", f"bars/{s}.meta.json"); linked += 1
todo = [s for s in syms if not os.path.exists(f"bars/{s}.npz")]
print("symbols", len(syms), "linked from the Geiger-history study", linked, "to fetch", len(todo), flush=True)
NREQ = [0]
def one(sym):
    out = {}; meta = {}
    for tf, lim in LIM.items():
        url = f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={lim}&authority=provider"; d = None; err = ""
        for att in range(4):
            try:
                r = urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
                NREQ[0] += 1
                d = json.load(urllib.request.urlopen(r, timeout=120)); break
            except Exception as e:
                err = str(e)[:80]; time.sleep(2 + 3 * att)
        if d is None or not d.get("series"):
            meta[tf] = {"err": (err if d is None else d.get("error", "empty"))}; continue
        s = d["series"]
        out[tf] = np.array([[x["t"], x["o"], x["h"], x["l"], x["c"]] for x in s], dtype=np.float64)
        meta[tf] = {"prov": d.get("provider"), "n": len(s), "full": d.get("full_series_count"), "newest": d.get("newest"), "basis": d.get("price_basis"),
                    "dropped_forming": d.get("incomplete_trailing_dropped"), "stale": d.get("stale"), "limit": lim}
    np.savez_compressed(f"bars/{sym}.tmp.npz", **{"tf_" + k: v for k, v in out.items()}); os.replace(f"bars/{sym}.tmp.npz", f"bars/{sym}.npz")
    json.dump(meta, open(f"bars/{sym}.meta.json", "w"))
    return sym, {k: (v.get("n") or v.get("err")) for k, v in meta.items()}
t0 = time.time(); k = 0
with ThreadPoolExecutor(3) as ex:
    for sym, st in ex.map(one, todo):
        k += 1
        if k % 20 == 0 or any(isinstance(v, str) for v in st.values()): print(k, sym, st, round(time.time() - t0), flush=True)
print("DONE", len(todo), "requests", NREQ[0], round(time.time() - t0), "s", flush=True)
