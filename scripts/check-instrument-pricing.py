#!/usr/bin/env python3
"""M54 · re-check the 22 cohort rows M45 called "names the Hub cannot price".

For each one, three questions, each answered by a live read:
  1. does the chart API serve daily candles for it?        GET /candles?symbol=..&tf=D
  2. is there a live quote, and how old is it?             PostgREST live_quotes
  3. what stored history exists, from which collector?     PostgREST scin_series (newest bar per ticker)

Nothing is written anywhere. Output: data/instrument-pricing-20260924.json
"""
import json, os, re, sys, time, urllib.request, urllib.error, datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://scintilla-massive-chart-api.fly.dev"
ROWS = ["ADAUSD", "AVAXUSD", "BTCUSD", "CLUSD", "DOGEUSD", "DXUSD", "ESUSD", "ETHUSD", "GCUSD",
        "LINKUSD", "LTCUSD", "NQUSD", "SIUSD", "SOLUSD", "US10Y", "US2S10S", "US2Y", "US30Y",
        "US3M", "US5Y", "VIX", "XRPUSD"]


def creds():
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="ignore").read()
    return (re.search(r'const SB\s*=\s*"([^"]+)"', s).group(1),
            re.search(r'"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]+)"', s).group(1))


SB, AN = creds()
H = {"apikey": AN, "Authorization": "Bearer " + AN}


def pg(path):
    with urllib.request.urlopen(urllib.request.Request(SB + "/rest/v1/" + path, headers=H), timeout=60) as r:
        return json.load(r)


def api(path):
    try:
        with urllib.request.urlopen(urllib.request.Request(API + path, headers={"Origin": "https://scintillahub.ai"}),
                                    timeout=60) as r:
            return json.load(r), r.status
    except urllib.error.HTTPError as e:
        return {}, e.code


inl = "(" + ",".join(ROWS) + ")"
# live_quotes is rewritten every minute, and a single read can land mid-write and miss a row.
# Read it three times a few seconds apart and keep the newest row seen for each ticker, so a
# name is only called unpriced when it is absent every time.
lq = {}
for attempt in range(3):
    for r in pg("live_quotes?select=ticker,price,chg_pct,updated_ts&ticker=in.%s&limit=60" % inl):
        cur = lq.get(r["ticker"])
        if not cur or (r.get("updated_ts") or "") > (cur.get("updated_ts") or ""):
            lq[r["ticker"]] = r
    if attempt < 2:
        time.sleep(6)
ss = {}
for r in pg("scin_series?select=ticker,tf,source,bars,t_max&ticker=in.%s&limit=2000" % inl):
    t = r["ticker"]
    if r.get("t_max") and (t not in ss or r["t_max"] > ss[t]["t_max"]):
        ss[t] = r
depth = {r["ticker"]: r for r in pg("crypto_depth?select=ticker,coinbase_product,we_hold_from&limit=50")}

out, now = {}, datetime.datetime.now(datetime.timezone.utc)
for t in ROWS:
    j, st = api("/candles?symbol=%s&tf=D&limit=3" % t)
    s = j.get("series") or []
    q, b = lq.get(t), ss.get(t)
    age_min = None
    if q and q.get("updated_ts"):
        try:
            age_min = round((now - datetime.datetime.fromisoformat(q["updated_ts"].replace("Z", "+00:00"))).total_seconds() / 60)
        except ValueError:
            pass
    served = st == 200 and bool(s)
    out[t] = {
        "chart_api_candles": {"status": st, "served": served,
                              "instrument_kind": (j.get("instrument") or {}).get("kind"),
                              "provider": j.get("provider"), "bars": j.get("full_series_count"),
                              "last_bar_et": time.strftime("%Y-%m-%d", time.gmtime(s[-1]["t"] / 1000)) if s else None,
                              "last_close": s[-1]["c"] if s else None,
                              "requested_through_et": (j.get("provider_refresh") or {}).get("requested_through_et")},
        "live_quote": {"price": q and q.get("price"), "chg_pct": q and q.get("chg_pct"),
                       "updated_utc": q and q.get("updated_ts"), "age_minutes": age_min},
        "stored_history": {"collector": b and b.get("source"), "bars": b and b.get("bars"),
                           "newest_bar_utc": time.strftime("%Y-%m-%d %H:%M", time.gmtime(b["t_max"])) if b else None},
        "coinbase_product": (depth.get(t) or {}).get("coinbase_product"),
    }
    fresh = age_min is not None and age_min <= 15
    out[t]["verdict"] = ("PRICED OUTSIDE THE STOCK LIST — chart API macro route" if served and fresh else
                         "PRICED OUTSIDE THE STOCK LIST — chart API macro route, quote stale" if served else
                         "PRICED OUTSIDE THE STOCK LIST — minute quote only, no chart" if fresh else
                         "NOT PRICED ANYWHERE TONIGHT")

doc = {"checked_utc": now.isoformat(timespec="seconds"),
       "claim_under_test": "M45 audit: 22 cohort rows are for names the Hub cannot price",
       "sources": {"candles": API + "/candles?symbol=..&tf=D",
                   "live_quote": "PostgREST live_quotes, read three times six seconds apart",
                   "stored_history": "PostgREST scin_series (newest bar per ticker, any timeframe)",
                   "coinbase_products": "PostgREST crypto_depth"},
       "summary": {v: sum(1 for r in out.values() if r["verdict"] == v)
                   for v in sorted({r["verdict"] for r in out.values()})},
       "rows": out}
p = os.path.join(ROOT, "data", "instrument-pricing-20260924.json")
json.dump(doc, open(p, "w"), indent=1)
print("wrote", p)
for k, v in doc["summary"].items():
    print(" %3d  %s" % (v, k))
