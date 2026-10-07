# GH1 · full-depth bars for the seven-rung Geiger replay, from the chart API (the Hub's own public read; no key).
# NQ1/SG1 asked for ~2 years of intraday bars; the API holds every rung back to Sept 2003, so this asks for all of it.
import json, urllib.request, urllib.parse, os, sys, time, numpy as np
from concurrent.futures import ThreadPoolExecutor
from syms import ALL
A = "https://scintilla-massive-chart-api.fly.dev"
TFS = ["D", "3D", "W", "180", "240", "6h", "12h"]
LIM = 60000
os.makedirs("bars", exist_ok=True)
syms = [s for s in (sys.argv[1:] or ALL) if not os.path.exists(f"bars/{s}.npz")]
def one(sym):
    out = {}; meta = {}
    for tf in TFS:
        url = f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf={tf}&limit={LIM}&authority=provider"; d = None; err = ""
        for att in range(4):
            try:
                r = urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
                d = json.load(urllib.request.urlopen(r, timeout=120)); break
            except Exception as e:
                err = str(e)[:80]; time.sleep(2 + 3 * att)
        if d is None or not d.get("series"):
            meta[tf] = {"err": (err if d is None else d.get("error", "empty"))}; continue
        s = d["series"]
        out[tf] = np.array([[x["t"], x["o"], x["h"], x["l"], x["c"]] for x in s], dtype=np.float64)
        meta[tf] = {"prov": d.get("provider"), "n": len(s), "full": d.get("full_series_count"), "newest": d.get("newest"), "basis": d.get("price_basis"),
                    "dropped_forming": d.get("incomplete_trailing_dropped"), "ticker_join": d.get("ticker_join"), "history_floor": d.get("history_floor"),
                    "finality": (d.get("bar_finality") or {}).get("verified"), "stale": d.get("stale")}
    np.savez_compressed(f"bars/{sym}.tmp.npz", **{"tf_" + k: v for k, v in out.items()}); os.replace(f"bars/{sym}.tmp.npz", f"bars/{sym}.npz")
    json.dump(meta, open(f"bars/{sym}.meta.json", "w"))
    return sym, {k: (v.get("n") or v.get("err")) for k, v in meta.items()}
t0 = time.time()
with ThreadPoolExecutor(3) as ex:
    for sym, st in ex.map(one, syms): print(sym, st, round(time.time() - t0), flush=True)
print("DONE", len(syms), round(time.time() - t0), "s")
