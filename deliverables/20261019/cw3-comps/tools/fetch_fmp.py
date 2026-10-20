#!/usr/bin/env python3
"""CW3 · fetch tonight's FMP figures through the project's own door (the fmp-proxy edge function),
GET only, with the Hub's anon key read from the release's index.html at run time. The key is never
printed or written. Every answer is kept verbatim under raw/<TICKER>.json with its fetch time; a run
log counts the calls against the daily cap.

usage: python3 fetch_fmp.py <peers.json> <out dir>      (re-runs skip answers already on disk)
"""
import json, os, re, sys, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

HUB_INDEX = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "..", "..", "..", "index.html")
DOOR = "https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-proxy"

def key():
    src = open(HUB_INDEX, encoding="utf8").read()
    m = re.search(r'SC_ANON_KEY\)\s*\|\|\s*"(eyJ[^"]+)"', src)
    if not m:
        raise SystemExit("anon key not found in index.html")
    return m.group(1)

KEY = key()
CALLS = []

def get(path, **params):
    q = urllib.parse.urlencode({"path": path, **params})
    req = urllib.request.Request(DOOR + "?" + q, headers={"Authorization": "Bearer " + KEY})
    t0 = time.time()
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf8")
                status = r.status
            break
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf8", "replace")[:300]; status = e.code
            if status in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 + 3 * attempt); continue
            break
        except Exception as e:  # network
            body = str(e); status = 0
            if attempt < 2:
                time.sleep(2 + 3 * attempt); continue
    CALLS.append({"path": path, "params": params, "status": status, "ms": int((time.time() - t0) * 1000), "utc": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())})
    try:
        data = json.loads(body) if status == 200 else None
    except Exception:
        data = None
    return {"status": status, "fetched_utc": CALLS[-1]["utc"], "data": data, "error": None if status == 200 else body[:300]}

# what every company gets, and what the RADAR names get on top
COMMON = [
    ("profile",                 {}),
    ("analyst-estimates",       {"period": "annual", "limit": 6}),
    ("income-statement-ttm",    {}),
    ("balance-sheet-statement", {"period": "quarter", "limit": 1}),
    ("key-metrics-ttm",         {}),
]
RADAR_EXTRA = [
    ("price-target-consensus",  {}),
    ("price-target-summary",    {}),
    ("grades-consensus",        {}),
    ("shares-float",            {}),
    ("cash-flow-statement",     {"period": "quarter", "limit": 4}),
    ("stock-peers",             {}),
]

def main():
    peers = json.load(open(sys.argv[1]))
    out = sys.argv[2]; os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    radar = peers["radar"]; tickers = peers["all"]
    fx_pairs = sorted({v["fx"] for v in peers["foreign"].values()})

    def load(t):
        p = os.path.join(out, "raw", t + ".json")
        return json.load(open(p)) if os.path.exists(p) else {"ticker": t, "answers": {}}
    def save(rec):
        json.dump(rec, open(os.path.join(out, "raw", rec["ticker"] + ".json"), "w"), indent=1)

    # 1 · quotes in batches (one call per 30 symbols), FX in one call
    quotes = {}
    for i in range(0, len(tickers), 30):
        chunk = tickers[i:i + 30]
        a = get("batch-quote", symbols=",".join(chunk))
        for row in (a["data"] or []):
            quotes[row["symbol"]] = {"status": a["status"], "fetched_utc": a["fetched_utc"], "data": row}
    fx = get("batch-quote", symbols=",".join(fx_pairs))
    json.dump({"fetched_utc": fx["fetched_utc"], "rates": {r["symbol"]: r for r in (fx["data"] or [])}}, open(os.path.join(out, "raw", "_fx.json"), "w"), indent=1)

    # 2 · per-company answers, four at a time
    def work(t):
        rec = load(t)
        if t in quotes:
            rec["answers"]["quote"] = quotes[t]
        plan = COMMON + (RADAR_EXTRA if t in radar else [])
        for path, params in plan:
            if path in rec["answers"] and rec["answers"][path]["status"] == 200:
                continue
            rec["answers"][path] = get(path, symbol=t, **params)
        save(rec)
        return t, sum(1 for a in rec["answers"].values() if a["status"] != 200)
    with ThreadPoolExecutor(max_workers=4) as ex:
        for t, bad in ex.map(work, tickers):
            print(t, "ok" if not bad else f"{bad} failed", flush=True)

    json.dump({"calls": len(CALLS), "by_status": {str(s): sum(1 for c in CALLS if c["status"] == s) for s in {c["status"] for c in CALLS}}, "log": CALLS}, open(os.path.join(out, "raw", "_calls.json"), "w"), indent=1)
    print("calls this run:", len(CALLS), "quotes:", len(quotes), "of", len(tickers))

if __name__ == "__main__":
    main()
