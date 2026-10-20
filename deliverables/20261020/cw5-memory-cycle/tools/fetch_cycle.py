#!/usr/bin/env python3
"""CW5 · fetch ten years of quarterly statements, enterprise values, daily prices and today's consensus for the
memory names, through the project's fmp-proxy door (GET only; anon key read from the release's index.html at run
time, never printed or written). Every answer is kept verbatim under raw/<TICKER>.json with its fetch time; a call
log counts against the shared daily cap.

usage: python3 fetch_cycle.py <out dir>        (re-runs skip answers already on disk with status 200)
"""
import json, os, re, sys, time, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
HUB_INDEX = os.path.join(HERE, "..", "..", "..", "..", "index.html")
DOOR = "https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-proxy"

NAMES = {
    "MU":        "Micron Technology (US · DRAM + NAND)",
    "000660.KS": "SK hynix (Korea · DRAM + NAND, HBM leader)",
    "005930.KS": "Samsung Electronics (Korea · memory inside a conglomerate)",
    "285A.T":    "Kioxia (Japan · NAND only; listed Dec 2024)",
    "WDC":       "Western Digital (US · HDD since the Feb 2025 flash spin; flash + HDD before)",
    "SNDK":      "Sandisk (US · NAND; spun out of WDC Feb 2025)",
    "2408.TW":   "Nanya Technology (Taiwan · DRAM only)",
}

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
            with urllib.request.urlopen(req, timeout=90) as r:
                body = r.read().decode("utf8"); status = r.status
            break
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf8", "replace")[:300]; status = e.code
            if status in (429, 500, 502, 503, 504) and attempt < 2:
                time.sleep(2 + 3 * attempt); continue
            break
        except Exception as e:
            body = str(e); status = 0
            if attempt < 2:
                time.sleep(2 + 3 * attempt); continue
    utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    CALLS.append({"path": path, "params": params, "status": status, "ms": int((time.time() - t0) * 1000), "utc": utc})
    try:
        data = json.loads(body) if status == 200 else None
    except Exception:
        data = None
    return {"status": status, "fetched_utc": utc, "params": params, "data": data, "error": None if status == 200 else body[:300]}

PLAN = [
    ("profile",                   {}),
    ("quote",                     {}),
    ("income-statement",          {"period": "quarter", "limit": 48}),
    ("balance-sheet-statement",   {"period": "quarter", "limit": 48}),
    ("cash-flow-statement",       {"period": "quarter", "limit": 48}),
    ("enterprise-values",         {"period": "quarter", "limit": 48}),
    ("key-metrics",               {"period": "quarter", "limit": 44}),
    ("ratios",                    {"period": "quarter", "limit": 44}),
    ("key-metrics-ttm",           {}),
    ("ratios-ttm",                {}),
    ("income-statement-ttm",      {}),
    ("analyst-estimates",         {"period": "annual", "limit": 6}),
    ("price-target-summary",      {}),
    ("historical-price-eod/light", {"from": "2015-10-01", "to": "2026-10-20"}),
]

def main():
    out = sys.argv[1]; os.makedirs(os.path.join(out, "raw"), exist_ok=True)
    def load(t):
        p = os.path.join(out, "raw", t + ".json")
        return json.load(open(p)) if os.path.exists(p) else {"ticker": t, "name": NAMES[t], "answers": {}}
    def save(rec):
        json.dump(rec, open(os.path.join(out, "raw", rec["ticker"] + ".json"), "w"), indent=1)
    def work(t):
        rec = load(t)
        for path, params in PLAN:
            k = path
            if k in rec["answers"] and rec["answers"][k]["status"] == 200 and rec["answers"][k]["data"]:
                continue
            rec["answers"][k] = get(path, symbol=t, **params)
        save(rec)
        return t, {k: (len(a["data"]) if isinstance(a["data"], list) else a["status"]) for k, a in rec["answers"].items()}
    with ThreadPoolExecutor(max_workers=3) as ex:
        for t, summary in ex.map(work, list(NAMES)):
            print(t, summary, flush=True)
    json.dump({"calls": len(CALLS), "by_status": {str(s): sum(1 for c in CALLS if c["status"] == s) for s in {c["status"] for c in CALLS}}, "log": CALLS},
              open(os.path.join(out, "raw", "_calls.json"), "w"), indent=1)
    print("calls this run:", len(CALLS))

if __name__ == "__main__":
    main()
