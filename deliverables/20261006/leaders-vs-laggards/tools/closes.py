#!/usr/bin/env python3
"""LD1 · pull daily closes for the studied field from the chart API, through the newest finished session.

The one tool in this folder that fetches. It reads prices only (GET /candles, the same call the Hub makes),
carries no key, and writes ../data/closes-recheck.json. Everything else in the folder reads saved files.

  python3 deliverables/20261006/leaders-vs-laggards/tools/closes.py

Why it exists: the first build ranked the field on closes another lane had saved through 5 Oct. This pulls the
same symbols again, first-hand, through 6 Oct, so the returns can be re-derived and the ranking re-tested.
"""
import os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
# select.py in this folder has the same name as Python's own `select` module, which the network library imports.
# Left on the path, `import urllib.request` runs our select.py instead (it did, once: it re-wrote selection.json,
# byte-identical). So this folder comes off the import path before anything else is imported.
sys.path[:] = [p for p in sys.path if os.path.abspath(p or ".") != HERE]

import concurrent.futures, datetime, json, urllib.parse, urllib.request  # noqa: E402
API = "https://scintilla-massive-chart-api.fly.dev"
BARS = 150  # 17 Mar -> 6 Oct is 141 sessions; a little spare
FUNDS = ["SPY", "QQQ", "RSP", "SMH", "IGV", "CIBR", "XLU"]

sel = json.load(open(os.path.join(HERE, "..", "selection.json")))
field = [n["ticker"] for n in sel["all"]]
skipped = [s[0] for s in sel["skipped"]]
symbols = field + [s for s in skipped if s not in field] + FUNDS


def pull(sym):
    url = f"{API}/candles?symbol={urllib.parse.quote(sym)}&tf=1d&limit={BARS}"
    req = urllib.request.Request(url, headers={"origin": "https://scintillahub.ai"})
    last = None
    for _ in range(3):
        try:
            j = json.load(urllib.request.urlopen(req, timeout=40))
            bars = j.get("series") or []
            closes = {}
            for b in bars:
                t = b["t"] / 1000 if b["t"] > 1e11 else b["t"]
                # the session anchor is 04:00 UTC of the trading day (midnight New York), so the UTC date is the session date
                closes[datetime.datetime.fromtimestamp(t, datetime.timezone.utc).strftime("%Y-%m-%d")] = b["c"]
            return sym, {"closes": closes, "newest": j.get("newest"), "stale": j.get("stale"), "price_basis": j.get("price_basis"),
                         "full_series_count": j.get("full_series_count")}
        except Exception as e:  # noqa: BLE001 - a failed symbol is recorded, not hidden
            last = str(e)[:120]
    return sym, {"closes": {}, "error": last}


with concurrent.futures.ThreadPoolExecutor(8) as ex:
    got = dict(ex.map(pull, symbols))

failed = sorted(s for s, v in got.items() if not v["closes"])
newest = sorted({max(v["closes"]) for v in got.values() if v["closes"]})
out = {"what": "daily closes (split-adjusted) from the chart API /candles?tf=1d for the LD1 field, its skipped names and seven funds",
       "fetched_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"), "api": API, "bars_asked": BARS,
       "symbols": len(symbols), "failed": failed, "newest_session_seen": newest, "by_symbol": got}
json.dump(out, open(os.path.join(HERE, "..", "data", "closes-recheck.json"), "w"))
print("symbols", len(symbols), "failed", failed, "newest sessions seen", newest)
