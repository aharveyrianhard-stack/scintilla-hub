#!/usr/bin/env python3
"""Pull daily bars for the PB1 study from the chart API (read-only). Writes data/bars/<SYMBOL>.json."""
import json, os, sys, time, urllib.request
API = "https://scintilla-massive-chart-api.fly.dev"
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "..", "data", "bars")
os.makedirs(OUT, exist_ok=True)
REVIEWED = ["AMZN","AVGO","BE","CRWV","GOOGL","MU","NBIS","NVDA","VST","WMT",
            "SPY","QQQ","VIX","US10Y","BTCUSD","PCC","CLUSD","GCUSD","SIUSD"]
INDEX = ["IWM","SMH"]
SECTORS = ["XLK","XLF","XLV","XLY","XLP","XLE","XLI","XLB","XLU","XLRE","XLC"]
manifest = {}
for sym in REVIEWED + INDEX + SECTORS:
    url = f"{API}/candles?symbol={sym}&tf=D&limit=10000"
    try:
        with urllib.request.urlopen(url, timeout=90) as r:
            d = json.load(r)
    except Exception as e:
        manifest[sym] = {"error": str(e)}; print(sym, "ERR", e); continue
    if "series" not in d:
        manifest[sym] = {"error": d.get("error"), "state": d.get("state")}; print(sym, "NO SERIES", d.get("error")); continue
    s = d["series"]
    rows = [{"t": b["t"], "o": b["o"], "h": b["h"], "l": b["l"], "c": b["c"], "v": b.get("v")} for b in s if b.get("c") is not None]
    json.dump(rows, open(os.path.join(OUT, sym + ".json"), "w"))
    manifest[sym] = {"bars": len(rows), "first": time.strftime("%Y-%m-%d", time.gmtime(rows[0]["t"]/1000)),
                     "last": time.strftime("%Y-%m-%d", time.gmtime(rows[-1]["t"]/1000)),
                     "provider": d.get("provider"), "provider_symbol": d.get("provider_symbol"),
                     "price_basis": d.get("price_basis"), "newest": d.get("newest")}
    print(sym, manifest[sym]["bars"], manifest[sym]["first"], manifest[sym]["last"], d.get("provider"))
json.dump(manifest, open(os.path.join(HERE, "..", "data", "bars-manifest.json"), "w"), indent=1)
