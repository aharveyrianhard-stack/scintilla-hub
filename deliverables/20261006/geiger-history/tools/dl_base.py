# GH1 · 30-minute extended-hours bars for the Pine check (chart API, public read) — the base bars the Pine script rolls up.
import json, urllib.request, urllib.parse, os, sys, time, numpy as np
A = "https://scintilla-massive-chart-api.fly.dev"; os.makedirs("base30", exist_ok=True)
for sym in sys.argv[1:]:
    url = f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf=30&limit=200000&authority=provider"
    r = urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
    d = json.load(urllib.request.urlopen(r, timeout=180)); s = d["series"]
    np.save(f"base30/{sym}.npy", np.array([[x["t"], x["o"], x["h"], x["l"], x["c"]] for x in s], dtype=np.float64))
    print(sym, len(s), d.get("provider"), d.get("price_basis"), d.get("newest"), flush=True)
