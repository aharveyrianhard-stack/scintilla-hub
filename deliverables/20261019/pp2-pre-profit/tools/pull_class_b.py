#!/usr/bin/env python3
"""Class B: one batch quote for all, key-metrics-ttm per name; the three cash-filter failers not in Class A get statements too."""
import json, os, sys, time, concurrent.futures as cf
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import fmp_proxy as F
B = sys.argv[1].split(",")
DEEP = sys.argv[2].split(",") if len(sys.argv) > 2 and sys.argv[2] else []
st, body, when = F.get("batch-quote", symbols=",".join(B))
print("batch-quote", st, len(body) if isinstance(body, list) else body)
def km(t):
    s, b, w = F.get("key-metrics-ttm", symbol=t); return t, s, (len(b) if isinstance(b, list) else b)
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    for t, s, n in ex.map(km, B): 
        if s != 200 or n != 1: print("km", t, s, n)
def deep(t):
    for path, p in [("income-statement", {"period": "quarter", "limit": 9}), ("balance-sheet-statement", {"period": "quarter", "limit": 6}), ("cash-flow-statement", {"period": "quarter", "limit": 9}), ("analyst-estimates", {"period": "annual", "limit": 6})]:
        s, b, w = F.get(path, symbol=t, **p)
        if s != 200: print("deep", t, path, s)
    return t
with cf.ThreadPoolExecutor(max_workers=4) as ex:
    list(ex.map(deep, DEEP))
F.save_log(os.path.join(F.S, "fmp-cache", "_calls_class_b.json"))
print(json.dumps(F.CALLS))
