#!/usr/bin/env python3
"""CW6 · fill the COMPS tab's FMP answer store through the project's own door (the fmp-proxy edge function), GET only.

Why a store: the browser cannot read fmp-proxy (measured 22 Oct 2026: neither its GET nor its OPTIONS answer carries an
Access-Control-Allow-Origin header, so a page on scintillahub.ai is refused by the browser). The tab therefore reads FMP's
answers from a store this script fills server-side: one file per company under store/, in the exact shape CW3's
fetcher kept (raw/<TICKER>.json), so one engine reads CW3's raw, CW4's raw and this store. A table with the same rows
is proposed in sql/ for the coordinator (comps_fmp_answers); the tab reads the table first when it exists.

What is fetched (per company): analyst-estimates (annual, 6), income-statement-ttm, balance-sheet-statement (quarter, 1);
quotes in batches of 30 with the FX pairs; per subject (a name CW3/CW4 carried): price-target-consensus,
price-target-summary, and for a loss-maker cash-flow-statement (quarter, 4) and shares-float. A company's profile and
FMP's own peer list do not change in three days: they are reused from CW3's (19 Oct) or CW4's (20 Oct) raw answers,
dated as such; a company neither carried is fetched.

The Hub's anon key is read from the release's index.html at run time and never printed or written.
usage: python3 fill_store.py <deliverable dir> [budget]      (re-runs skip answers already on disk from today)
"""
import json, os, re, subprocess, sys, time, threading, urllib.request, urllib.parse, urllib.error
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.dirname(os.path.abspath(__file__))
HUB_INDEX = os.path.join(HERE, "..", "..", "..", "..", "index.html")
DOOR = "https://wadinxqplrggagkvrdag.supabase.co/functions/v1/fmp-proxy"
CW3_JSON = ("9325a33", "deliverables/20261019/cw3-comps/COMPS-RADAR.json")
CW4_JSON = ("17f996c", "deliverables/20261020/cw4-dow30/COMPS-DOW30.json")

def key():
    m = re.search(r'SC_ANON_KEY\)\s*\|\|\s*"(eyJ[^"]+)"', open(HUB_INDEX, encoding="utf8").read())
    if not m: raise SystemExit("anon key not found in index.html")
    return m.group(1)

KEY = key()
CALLS = []; LOCK = threading.Lock(); BUDGET = [1000]

# the fields the engine reads (everything else FMP sends is dropped to keep the store small)
KEEP = {
    "profile": ("symbol", "companyName", "industry", "sector", "exchange", "country", "ipoDate", "isAdr", "currency", "marketCap", "price"),
    "quote": ("symbol", "name", "price", "marketCap", "timestamp", "exchange", "previousClose"),
    "analyst-estimates": ("symbol", "date", "revenueAvg", "revenueLow", "revenueHigh", "ebitdaAvg", "ebitAvg", "netIncomeAvg", "epsAvg", "epsHigh", "epsLow", "numAnalystsRevenue", "numAnalystsEps"),
    "income-statement-ttm": ("symbol", "date", "reportedCurrency", "revenue", "grossProfit", "operatingIncome", "ebitda", "netIncome", "epsDiluted", "weightedAverageShsOutDil"),
    "balance-sheet-statement": ("symbol", "date", "reportedCurrency", "cashAndShortTermInvestments", "cashAndCashEquivalents", "totalDebt", "shortTermDebt", "longTermDebt", "totalStockholdersEquity", "totalEquity"),
    "price-target-consensus": ("symbol", "targetHigh", "targetLow", "targetConsensus", "targetMedian"),
    "price-target-summary": ("symbol", "lastMonthCount", "lastMonthAvgPriceTarget", "lastQuarterCount", "lastQuarterAvgPriceTarget", "lastYearCount", "lastYearAvgPriceTarget"),
    "cash-flow-statement": ("symbol", "date", "reportedCurrency", "operatingCashFlow", "capitalExpenditure", "freeCashFlow"),
    "shares-float": ("symbol", "freeFloat", "floatShares", "outstandingShares"),
    "stock-peers": ("symbol", "companyName", "mktCap", "price"),
}

def trim(path, data):
    keep = KEEP.get(path)
    if keep is None or data is None: return data
    if isinstance(data, list): return [{k: r.get(k) for k in keep if k in r} for r in data if isinstance(r, dict)]
    if isinstance(data, dict): return {k: data.get(k) for k in keep if k in data}
    return data

def get(path, **params):
    with LOCK:
        if len(CALLS) >= BUDGET[0]: return {"status": -1, "fetched_utc": None, "data": None, "error": "budget reached, not called"}
        CALLS.append(None); idx = len(CALLS) - 1
    q = urllib.parse.urlencode({"path": path, **params})
    req = urllib.request.Request(DOOR + "?" + q, headers={"Authorization": "Bearer " + KEY})
    t0 = time.time(); body = ""; status = 0
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                body = r.read().decode("utf8"); status = r.status
            break
        except urllib.error.HTTPError as e:
            body = e.read().decode("utf8", "replace")[:300]; status = e.code
            if status in (429, 500, 502, 503, 504) and attempt < 2: time.sleep(2 + 3 * attempt); continue
            break
        except Exception as e:
            body = str(e); status = 0
            if attempt < 2: time.sleep(2 + 3 * attempt); continue
    utc = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
    with LOCK: CALLS[idx] = {"path": path, "params": {k: v for k, v in params.items() if k != "symbols"}, "n_symbols": len(params.get("symbols", "").split(",")) if "symbols" in params else None, "status": status, "ms": int((time.time() - t0) * 1000), "utc": utc}
    try: data = json.loads(body) if status == 200 else None
    except Exception: data = None
    return {"status": status, "fetched_utc": utc, "data": trim(path, data), "error": None if status == 200 else body[:300]}

def main():
    D = sys.argv[1]; BUDGET[0] = int(sys.argv[2]) if len(sys.argv) > 2 else 1000
    S = os.path.join(D, "store"); os.makedirs(S, exist_ok=True)
    sets = json.load(open(os.path.join(D, "sets.json")))
    subjects = list(sets["names"].keys()); tickers = sets["all"]
    old = {}
    for commit, path in (CW4_JSON, CW3_JSON):   # CW3 last so its 19 Oct answers win where both carried a company
        d = json.loads(subprocess.check_output(["git", "show", f"{commit}:{path}"]))
        for t, ans in d.get("raw", {}).items():
            for p in ("profile", "stock-peers"):
                a = ans.get(p)
                if a and a.get("status") == 200: old.setdefault(t, {})[p] = {**a, "data": trim(p, a.get("data")), "from": f"{'CW3' if commit == CW3_JSON[0] else 'CW4'} raw ({a.get('fetched_utc')})"}
    def load(t):
        p = os.path.join(S, t + ".json")
        return json.load(open(p)) if os.path.exists(p) else {"ticker": t, "answers": {}}
    def save(rec): json.dump(rec, open(os.path.join(S, rec["ticker"] + ".json"), "w"), separators=(",", ":"))
    # 1 · quotes (30 a call) and the FX pairs in one call
    quotes = {}
    for i in range(0, len(tickers), 30):
        chunk = tickers[i:i + 30]
        a = get("batch-quote", symbols=",".join(chunk))
        for row in (a["data"] or []): quotes[row["symbol"]] = {"status": a["status"], "fetched_utc": a["fetched_utc"], "data": trim("quote", row)}
    pairs = sorted({v["fx"] for v in sets["foreign"].values()})
    fx = get("batch-quote", symbols=",".join(pairs))
    json.dump({"fetched_utc": fx["fetched_utc"], "rates": {r["symbol"]: trim("quote", r) for r in (fx["data"] or [])}}, open(os.path.join(S, "_fx.json"), "w"), indent=1)
    # 2 · per company
    COMMON = [("analyst-estimates", {"period": "annual", "limit": 6}), ("income-statement-ttm", {}), ("balance-sheet-statement", {"period": "quarter", "limit": 1})]
    SUBJ = [("price-target-consensus", {}), ("price-target-summary", {})]
    LOSS = [("cash-flow-statement", {"period": "quarter", "limit": 4}), ("shares-float", {})]
    today = time.strftime("%Y-%m-%d", time.gmtime())
    def fresh(rec, p): a = rec["answers"].get(p); return a and a.get("status") == 200 and str(a.get("fetched_utc") or "").startswith(today)
    def work(t):
        rec = load(t)
        if t in quotes: rec["answers"]["quote"] = quotes[t]
        for p in ("profile", "stock-peers"):
            if p not in rec["answers"] and t in old and p in old[t]: rec["answers"][p] = old[t][p]
        plan = list(COMMON) + ([("profile", {})] if "profile" not in rec["answers"] else []) + (SUBJ if t in subjects else [])
        for path, params in plan:
            if fresh(rec, path): continue
            rec["answers"][path] = get(path, symbol=t, **params)
        if t in subjects:   # a loss-maker gets the cash-flow and float reads (the pre-profit facts)
            ttm = ((rec["answers"].get("income-statement-ttm") or {}).get("data") or [{}])
            ni = (ttm[0] or {}).get("netIncome") if ttm else None
            ests = sorted((rec["answers"].get("analyst-estimates") or {}).get("data") or [], key=lambda r: r.get("date") or "")
            fut = [r for r in ests if (r.get("date") or "") > today]
            nin = fut[0].get("netIncomeAvg") if fut else None
            if (ni is not None and ni <= 0) or (nin is not None and nin <= 0) or nin is None:
                for path, params in LOSS:
                    if not fresh(rec, path): rec["answers"][path] = get(path, symbol=t, **params)
        rec["filled_utc"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        save(rec)
        return t, [p for p, a in rec["answers"].items() if a.get("status") != 200]
    order = subjects + [t for t in tickers if t not in subjects]
    with ThreadPoolExecutor(max_workers=4) as ex:
        for t, bad in ex.map(work, order):
            print(t, "ok" if not bad else "not 200: " + ",".join(bad), flush=True)
    log = [c for c in CALLS if c]
    idx = {"what": "CW6 · the COMPS tab's FMP answer store, filled through fmp-proxy (GET only)", "door": DOOR,
           "fetch_utc_first": min((c["utc"] for c in log), default=None), "fetch_utc_last": max((c["utc"] for c in log), default=None),
           "calls": len(log), "by_status": {str(s): sum(1 for c in log if c["status"] == s) for s in {c["status"] for c in log}}, "budget": BUDGET[0],
           "tickers": tickers, "subjects": subjects, "quotes": len(quotes), "fx_pairs": pairs, "reused": "profile and stock-peers from CW3 raw (19 Oct) or CW4 raw (20 Oct) where they carried the company", "log": log}
    json.dump(idx, open(os.path.join(S, "_index.json"), "w"), indent=1)
    print("calls:", len(log), idx["by_status"], "quotes:", len(quotes), "of", len(tickers))

if __name__ == "__main__":
    main()
