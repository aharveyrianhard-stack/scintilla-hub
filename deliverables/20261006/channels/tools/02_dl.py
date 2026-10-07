# CHN1 step 2 - the daily bars, from the chart API only (no key; the Hub's own public read). Split-adjusted, provider-built, final.
import json, urllib.request, urllib.parse, os, time, datetime as dt

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
A = "https://scintilla-massive-chart-api.fly.dev"
for sym in ("SPY", "QQQ"):
    url = f"{A}/candles?symbol={urllib.parse.quote(sym)}&tf=D&limit=6000&authority=provider"; d = None; err = None
    for att in range(4):
        try:
            r = urllib.request.Request(url, headers={"Origin": "https://scintillahub.ai", "Accept-Encoding": "identity"})
            d = json.load(urllib.request.urlopen(r, timeout=120)); break
        except Exception as e:
            err = str(e)[:120]; time.sleep(2 + 3 * att)
    if d is None or not d.get("series"):
        raise SystemExit(f"{sym}: no bars ({err or d.get('error')})")
    s = d["series"]
    rows = [[x["t"], x["o"], x["h"], x["l"], x["c"]] for x in s]
    fin = d.get("bar_finality") or {}
    meta = {"symbol": sym, "tf": "D", "fetched_at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "url": url, "provider": d.get("provider"),
            "surface": d.get("surface"), "price_basis": d.get("price_basis"), "bar_authority": d.get("bar_authority"), "source_namespace": d.get("source_namespace"),
            "full_series_count": d.get("full_series_count"), "n": len(rows),
            "first_session": dt.datetime.utcfromtimestamp(rows[0][0] / 1000).strftime("%Y-%m-%d"), "last_session": dt.datetime.utcfromtimestamp(rows[-1][0] / 1000).strftime("%Y-%m-%d"),
            "bar_finality": {k: fin.get(k) for k in ("policy", "verified", "bars_verified", "newest_value_close_utc", "checked_utc")},
            "ticker_join": (d.get("ticker_join") or {}).get("state")}
    json.dump({"meta": meta, "columns": ["t_ms", "o", "h", "l", "c"], "rows": rows}, open(os.path.join(DATA, f"bars-D-{sym}.json"), "w"), separators=(",", ":"))
    print(sym, json.dumps(meta))
