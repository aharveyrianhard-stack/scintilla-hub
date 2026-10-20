#!/usr/bin/env python3
"""Pull the full set of FMP answers for the Class A names (9 calls a name). Usage: pull_class_a.py T1 T2 ..."""
import json, os, sys, time, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fmp_proxy as F

ASKS = [
    ("income-statement", {"period": "quarter", "limit": 9}),
    ("balance-sheet-statement", {"period": "quarter", "limit": 6}),
    ("cash-flow-statement", {"period": "quarter", "limit": 9}),
    ("analyst-estimates", {"period": "annual", "limit": 6}),
    ("price-target-summary", {}),
    ("profile", {}),
    ("shares-float", {}),
    ("revenue-product-segmentation", {"period": "annual"}),
    ("key-metrics-ttm", {}),
]

def one(t):
    out = {}
    for path, p in ASKS:
        st, body, when = F.get(path, symbol=t, **p)
        out[path] = {"status": st, "rows": (len(body) if isinstance(body, list) else None), "fetched_utc": when,
                     "err": (body.get("_error") or body.get("_raw")) if isinstance(body, dict) else None}
    return t, out

if __name__ == "__main__":
    names = sys.argv[1:]
    t0 = time.time()
    res = {}
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        for t, o in ex.map(one, names):
            res[t] = o
            bad = [k for k, v in o.items() if v["status"] != 200 or not v["rows"]]
            print(t, "ok" if not bad else "EMPTY/ERR: " + ",".join(bad), flush=True)
    F.save_log(os.path.join(F.S, "fmp-cache", "_calls_class_a.json"))
    print(json.dumps(F.CALLS), "%.0fs" % (time.time() - t0))
