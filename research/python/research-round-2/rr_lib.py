"""Research round 2 (N11, 28 Sep 2026): shared loaders and arithmetic for P4, P5, P7, P10 and the CALM/STRESS page.

Reads only files already saved on this Mac:
  - the stats-cache the 28 Sep lanes saved AS SERVED from the chart API (rd_data.py of the research director), and
  - the point-in-time S&P 500 membership + bars cache (stats-cache/point-in-time/v1, built on Fly from FMP + Massive), and
  - the USUAL DAY dump of public.sigma_day_counts committed at research/statistics/data/pullback-playbook-20260928/.
Nothing here fetches and nothing is keyed.  The one network read of the round (today's close) is in calm_today.py.
"""
import os, sys, json, gzip, hashlib
import numpy as np, pandas as pd

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
sys.path.insert(0, os.path.join(ROOT, "research/python/research-director"))
import rd_data as D  # noqa: E402  (the research director's loader: same files, same hashes)
import rd_style as S  # noqa: E402,F401

OUT = os.path.join(ROOT, "deliverables/20260928/research-round-2")
CH = os.path.join(OUT, "charts"); DATA = os.path.join(OUT, "data")
os.makedirs(CH, exist_ok=True); os.makedirs(DATA, exist_ok=True)
PIT = os.path.join(D.CACHE, "point-in-time/v1")
SIGMA = os.path.join(ROOT, "research/statistics/data/pullback-playbook-20260928/sigma_day_counts.json")
SEED = 20260928
ASOF = "2026-09-25"


def note_file(name, path, s):
    D._note(name, path, s)


def best_chart(symbol):
    """The fullest cached copy of a chart-API daily series among the stats-cache folders (some folders hold gappy copies)."""
    best = None
    for folder in ("daily-bars-rsi", "sector-rotation-20260928", "candles-f5", "daily-bars-s7", "daily-bars-s9"):
        p = f"{D.CACHE}/{folder}/{symbol}.json"
        if os.path.exists(p):
            s = D._series_from_api_json(p)
            if best is None or len(s) > len(best[1]):
                best = (p, s)
    if best is None:
        raise KeyError(symbol)
    p, s = best; s.name = symbol
    gaps = s.index.to_series().diff().dt.days
    big = gaps[gaps > 10]
    if len(big):   # a renamed / reused ticker leaves a hole (QQQ as QQQQ 2004-11, FB -> META 2022); keep the unbroken stretch only
        s = s[s.index >= big.index[-1]]
    D._note(symbol, p, s)
    if len(big): D.PROVENANCE[symbol]["trimmed"] = f"hole of {int(big.iloc[-1])} days before {big.index[-1].date()}; earlier bars not used"
    return s


def qqq():
    """QQQ as cached has no bars from Dec 2004 to Mar 2011 — the years the fund traded as QQQQ (a reused/renamed ticker the bar
    service does not stitch).  Only the unbroken stretch from April 2011 is used; the Nasdaq-100 index stands in for the long record."""
    s = best_chart("QQQ")
    return s[s.index >= "2011-04-01"]


def index(symbol):
    return D.fmp_index(symbol)


def btc():
    s = best_chart("BTCUSD")
    s = s[s.index >= "2013-01-01"]   # the pre-2013 prints are thin exchange quotes; the studies start in 2013
    return s[s.index.dayofweek < 5]  # weekday closes only, so "20 sessions" and "504 sessions" mean the same calendar span as for stocks


def pit_leaders(top_n=10):
    """Equal-weight basket of the point-in-time top-N S&P 500 names by market cap on the last session of the prior year,
    rebalanced each January (pit-leaders-basket.json, built on Fly from FMP caps).  Returns (daily return series, members by year)."""
    p = os.path.join(PIT, "pit-leaders-basket.json")
    d = json.load(open(p))
    closes = {}
    for sym, rows in d["closes"].items():
        s = pd.Series([r[4] for r in rows], index=pd.to_datetime([r[0] for r in rows]))
        closes[sym] = s[~s.index.duplicated(keep="last")].sort_index()
    C = pd.DataFrame(closes).sort_index()
    R = C.pct_change(fill_method=None)
    out = pd.Series(np.nan, index=R.index); members = {}
    for y, syms in sorted(d["top"].items()):
        yy = int(y); m = (R.index.year == yy)
        mem = [s for s in syms[:top_n] if s in R.columns]
        members[y] = mem
        # buy-and-hold inside the year from equal starting weights (drifting weights, no daily rebalance)
        sub = R.loc[m, mem].fillna(0.0)
        growth = (1 + sub).cumprod()
        val = growth.mean(axis=1)
        prev = val.shift(1).fillna(1.0)
        out.loc[m] = (val / prev - 1).values
    out = out.dropna()
    h = hashlib.sha256(open(p, "rb").read()).hexdigest()[:12]
    D.PROVENANCE[f"LEADERS{top_n} (PIT basket)"] = {"file": p.replace(os.path.expanduser("~"), "~"), "sha256_12": h, "bars": int(len(out)),
                                                    "from": str(out.index[0].date()), "to": str(out.index[-1].date())}
    return out, members


def to_close(ret):
    return (1 + ret.fillna(0)).cumprod()


def pit_panel():
    """Point-in-time S&P 500 panel: closes (sessions x names) and a member mask, from stats-cache/point-in-time/v1/daily/*.json."""
    folder = os.path.join(PIT, "daily"); cl, mem = {}, {}
    for f in sorted(os.listdir(folder)):
        if not f.endswith(".json"): continue
        d = json.load(open(os.path.join(folder, f)))
        rows = d["rows"]
        if not rows: continue
        idx = pd.to_datetime([r[0] for r in rows])
        cl[d["symbol"]] = pd.Series([r[1] for r in rows], index=idx, dtype=float)
        mem[d["symbol"]] = pd.Series([r[3] for r in rows], index=idx, dtype=float)
    C = pd.DataFrame(cl).sort_index(); M = pd.DataFrame(mem).reindex(C.index).fillna(0) > 0
    mf = os.path.join(PIT, "manifest.json")
    D.PROVENANCE["S&P 500 point-in-time panel"] = {"file": folder.replace(os.path.expanduser("~"), "~") + "/*.json", "sha256_12": hashlib.sha256(open(mf, "rb").read()).hexdigest()[:12] + " (manifest)",
                                                   "bars": int(C.shape[0]), "from": str(C.index[0].date()), "to": str(C.index[-1].date())}
    return C, M


def served_panel():
    """The served universe: the 364 names in the candles-f5 cache (today's names, so survivorship is built in)."""
    folder = os.path.join(D.CACHE, "candles-f5"); cl = {}
    for f in sorted(os.listdir(folder)):
        if f.endswith(".json"):
            s = D._series_from_api_json(os.path.join(folder, f)); cl[f[:-5]] = s
    C = pd.DataFrame(cl).sort_index()
    D.PROVENANCE["served universe (candles-f5)"] = {"file": folder.replace(os.path.expanduser("~"), "~") + "/*.json", "sha256_12": "per-file", "bars": int(C.shape[0]),
                                                    "from": str(C.index[0].date()), "to": str(C.index[-1].date())}
    return C


def sigma_counts():
    d = pd.DataFrame(json.load(open(SIGMA))); d.index = pd.to_datetime(d.date)
    D.PROVENANCE["public.sigma_day_counts (USUAL DAY dump)"] = {"file": os.path.relpath(SIGMA, ROOT), "sha256_12": hashlib.sha256(open(SIGMA, "rb").read()).hexdigest()[:12],
                                                                 "bars": int(len(d)), "from": str(d.index[0].date()), "to": str(d.index[-1].date())}
    return d


# ---------------- arithmetic ----------------
def drawdown(close):
    c = np.asarray(close, dtype=float); peak = np.maximum.accumulate(c)
    return c / peak - 1


def max_dd(ret):
    return float(drawdown(to_close(pd.Series(ret)).values).min())


def longest_underwater(ret):
    dd = drawdown(to_close(pd.Series(ret)).values); best = cur = 0
    for v in dd:
        cur = cur + 1 if v < 0 else 0; best = max(best, cur)
    return int(best)


def cagr(ret, per_year=252):
    r = pd.Series(ret).dropna(); g = float((1 + r).prod())
    return g ** (per_year / max(len(r), 1)) - 1 if g > 0 else -1.0


def ann_vol(ret, per_year=252):
    return float(pd.Series(ret).std() * np.sqrt(per_year))


def sharpe(ret, per_year=252):
    r = pd.Series(ret).dropna(); sd = r.std()
    return float(r.mean() / sd * np.sqrt(per_year)) if sd > 0 else np.nan


def worst_12m(ret, per_year=252):
    c = to_close(pd.Series(ret)); r12 = c / c.shift(per_year) - 1
    return float(r12.min())


def stat_boot(x, fn, block=60, reps=1000, seed=SEED):
    """90% stationary-bootstrap range of fn over resampled runs of rows of x (x: 1-d or 2-d array)."""
    from arch.bootstrap import StationaryBootstrap
    bs = StationaryBootstrap(block, np.asarray(x), seed=seed)
    vals = np.array([fn(b[0][0]) for b in bs.bootstrap(reps)])
    return float(np.nanpercentile(vals, 5)), float(np.nanpercentile(vals, 95)), vals


def spa(losses_bench, losses_models, block=60, reps=1000, seed=SEED):
    """Hansen SPA p-values (lower / consistent / upper) with the benchmark's and each model's per-day LOSS (negative return)."""
    from arch.bootstrap import SPA
    s = SPA(np.asarray(losses_bench), np.asarray(losses_models), block_size=block, reps=reps, bootstrap="stationary", seed=seed)
    s.compute()
    pv = s.pvalues
    return {"lower": float(pv["lower"]), "consistent": float(pv["consistent"]), "upper": float(pv["upper"])}


def status_word(n_episodes, p_naive, p_corrected):
    """The method standard's word (R10)."""
    if n_episodes is not None and n_episodes < 20: return "a list"
    if p_corrected is not None and p_corrected < 0.10: return "luck-proof"
    if p_naive is not None and p_naive < 0.10: return "leaning"
    return "not shown"


def runs_of(mask):
    m = np.asarray(mask, dtype=bool); return int(((m[1:] & ~m[:-1]).sum()) + (1 if len(m) and m[0] else 0))


def r(x, d=2):
    return None if x is None or (isinstance(x, float) and not np.isfinite(x)) else round(float(x), d)


def clean(o):
    """JSON-safe copy: numpy scalars to Python, NaN/inf to null (Node's JSON.parse rejects NaN)."""
    if isinstance(o, dict): return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    if isinstance(o, np.ndarray): return [clean(v) for v in o.tolist()]
    if isinstance(o, (np.bool_,)): return bool(o)
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, (float, np.floating)): return float(o) if np.isfinite(o) else None
    if isinstance(o, (pd.Timestamp,)): return str(o.date())
    return o


def dump(name, obj):
    p = os.path.join(DATA, name)
    json.dump(clean(obj), open(p, "w"), indent=1, allow_nan=False)
    return p


def save_provenance(name):
    D.save_provenance(os.path.join(DATA, name)); D.PROVENANCE.clear()
