"""Research director (28 Sep 2026): one loader for the daily bars every study here reads.

Every series comes from files the earlier 28 Sep lanes saved AS SERVED from the chart API
(https://scintilla-massive-chart-api.fly.dev/candles?tf=D) or from FMP pulled on Fly, under
~/Library/Application Support/scintilla/stats-cache/.  Nothing here fetches, nothing is keyed.
Bars end at the Friday 25 Sep 2026 close.  Closes only; split-adjusted where the API says so.
"""
import json, os, hashlib
import numpy as np, pandas as pd

CACHE = os.path.expanduser("~/Library/Application Support/scintilla/stats-cache")
PROVENANCE = {}


def _note(name, path, s):
    h = hashlib.sha256(open(path, "rb").read()).hexdigest()[:12]
    PROVENANCE[name] = {"file": path.replace(os.path.expanduser("~"), "~"), "sha256_12": h,
                        "bars": int(s.shape[0]), "from": str(s.index[0].date()), "to": str(s.index[-1].date())}


def _series_from_api_json(path):
    d = json.load(open(path))
    rows = d["series"] if isinstance(d, dict) else d
    t = pd.to_datetime([r["t"] for r in rows], unit="ms", utc=True).tz_convert("America/New_York").normalize().tz_localize(None)
    s = pd.Series([float(r["c"]) for r in rows], index=t, name=os.path.basename(path)[:-5])
    s = s[~s.index.duplicated(keep="last")].sort_index()
    return s


def chart(symbol, folder):
    """A chart-API cached daily close series from one of the stats-cache folders."""
    p = f"{CACHE}/{folder}/{symbol}.json"
    s = _series_from_api_json(p)
    s.name = symbol
    _note(symbol, p, s)
    return s


def fmp_rows(symbol, kinds=("eod", "eodadj")):
    """FMP end-of-day rows pulled on Fly by the regime lane (regime-20260928/fmp-eod.json), chained across its date chunks."""
    p = f"{CACHE}/regime-20260928/fmp-eod.json"
    d = json.load(open(p))
    rows = []
    for r in d:
        if r["symbol"] == symbol and r["kind"] in kinds:
            rows += r["rows"]
    if not rows:
        raise KeyError(symbol)
    # row = [date, open, high, low, close, volume]; eodadj = adjusted close in position 4
    df = pd.DataFrame(rows, columns=["d", "o", "h", "l", "c", "v"]).drop_duplicates("d")
    s = pd.Series(df["c"].astype(float).values, index=pd.to_datetime(df["d"]), name=symbol).sort_index()
    _note(symbol, p, s)
    return s


def fmp_index(symbol):
    """The long index histories the rsi lane pulled (daily-bars-rsi/fmp-indexes.json): ^GSPC 1927->, ^NDX, ^IXIC, ^RUT, ^DJI."""
    p = f"{CACHE}/daily-bars-rsi/fmp-indexes.json"
    d = json.load(open(p))[symbol]
    df = pd.DataFrame(d, columns=["d", "o", "h", "l", "c", "v"]).drop_duplicates("d")
    s = pd.Series(df["c"].astype(float).values, index=pd.to_datetime(df["d"]), name=symbol).sort_index()
    _note(symbol, p, s)
    return s


SECTORS = {"XLK": "TECH", "XLF": "FINANCIALS", "XLV": "HEALTH CARE", "XLY": "DISCRETIONARY", "XLP": "STAPLES", "XLB": "MATERIALS",
           "XLI": "INDUSTRIALS", "XLE": "ENERGY", "XLU": "UTILITIES", "XLRE": "REAL ESTATE", "XLC": "COMMUNICATION"}


def sectors():
    return pd.concat([chart(s, "sector-rotation-20260928") for s in SECTORS], axis=1)


def name_close(ticker):
    return chart(ticker, "candles-f5")


def cohorts(root):
    """Alan's cohorts = the themes of data/standard-tree-20260924.json (M45 branch rules), members as served today."""
    tr = json.load(open(os.path.join(root, "data/standard-tree-20260924.json")))
    return [(t["id"], t["label"], list(t["tickers"])) for t in tr["themes"]]


def save_provenance(path):
    json.dump(PROVENANCE, open(path, "w"), indent=1, sort_keys=True)
