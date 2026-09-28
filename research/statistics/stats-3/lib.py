"""STATS-3 · shared arithmetic for the 28 Sep 'Geiger as a statistic, confluence, winners' study.
Pure functions plus loaders for the local caches. No network, no database, no key. Obeys the method standard
(deliverables/20260928/statistician/): full distributions, episodes as the unit, stationary block bootstrap for
every range, Benjamini–Hochberg over every cell tried, base rates beside every conditional number, no lookahead.
"""
import json, os, math
import numpy as np, pandas as pd

SCRATCH = os.environ.get("STATS3_DATA", "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/b4ebb76c-7e8c-497a-9c42-819b62fdcb14/scratchpad")
LIB = os.path.expanduser("~/Library/Application Support/scintilla/stats-cache")
ASOF = "2026-09-25"

# ---------------------------------------------------------------- loading
def _clean_wicks(df, max_wick=0.25):
    """S9 rule: a low more than 25% under the body or a high more than 25% over it is a bad print; clamp to the body."""
    body_lo = np.minimum(df.o, df.c); body_hi = np.maximum(df.o, df.c)
    bad_lo = ~(df.l > 0) | (df.l < body_lo * (1 - max_wick)); bad_hi = df.h > body_hi * (1 + max_wick)
    df = df.copy(); df.loc[bad_lo, "l"] = body_lo[bad_lo]; df.loc[bad_hi, "h"] = body_hi[bad_hi]
    return df, int(bad_lo.sum() + bad_hi.sum())

def data_faults(df, jump=2.0, hole=20):
    """Bottoms-lane rule: a close more than 2x or under 1/2x the day before, or a hole of more than 20 calendar days,
    means the ticker most likely belonged to a different security before it. Returns the index position of the LAST fault."""
    c = df.c.values; t = df.index.values.astype("datetime64[D]").astype(np.int64)
    cut = 0
    for i in range(1, len(c)):
        if c[i - 1] > 0 and (c[i] / c[i - 1] >= jump or c[i] / c[i - 1] <= 1 / jump): cut = i
        if t[i] - t[i - 1] > hole: cut = i
    return cut

def load_bars(sym, cut_faults=True):
    """Daily bars for one symbol from this lane's chart-API cache (scratch/bars) or the long series in the durable cache."""
    for p in (os.path.join(SCRATCH, "bars", sym + ".json"), os.path.join(LIB, "daily-bars-rsi", sym + ".json"), os.path.join(LIB, "candles-f5", sym + ".json")):
        if not os.path.exists(p): continue
        j = json.load(open(p)); ser = j.get("series") if isinstance(j, dict) else j
        if not ser: continue
        df = pd.DataFrame(ser)[["t", "o", "h", "l", "c", "v"]].astype(float)
        df.index = pd.to_datetime(df.t, unit="ms", utc=True).dt.tz_convert(None).dt.normalize(); df = df.drop(columns="t")
        df = df[~df.index.duplicated(keep="last")].sort_index(); df = df[df.c > 0]
        df, _ = _clean_wicks(df)
        cut = data_faults(df) if cut_faults else 0
        df = df.iloc[cut:]
        df.attrs["src"] = p; df.attrs["cut"] = cut
        return df
    return None

def load_fmp_eod(symbol):
    """Series the regime lane pulled from FMP on Fly (^VIX3M, ^GSPC, HYG/LQD dividend-adjusted...)."""
    rows = []
    for f in ("fmp-eod.json", "fmp-eod2.json"):
        p = os.path.join(LIB, "regime-20260928", f)
        if not os.path.exists(p): continue
        for r in json.load(open(p)):
            if r.get("symbol") == symbol: rows += r["rows"]
    if not rows: return None
    df = pd.DataFrame(rows, columns=["d", "o", "h", "l", "c", "v"]); df.index = pd.to_datetime(df.d); df = df.drop(columns="d").astype(float)
    return df[~df.index.duplicated(keep="last")].sort_index()

def load_geiger(sym):
    p = os.path.join(SCRATCH, "geiger", sym + ".json")
    if not os.path.exists(p): return None
    j = json.load(open(p))
    if not j.get("rows"): return None
    df = pd.DataFrame(j["rows"], columns=j["cols"]); df.index = pd.to_datetime(df.date); return df.drop(columns="date")

def universe():
    return json.load(open(os.path.join(SCRATCH, "universe.json")))["symbols"]

def profiles():
    return {r["ticker"]: r for r in json.load(open(os.path.join(SCRATCH, "db", "company_profile.json")))}

RULES = None
def rules():
    global RULES
    if RULES is None:
        RULES = json.load(open(os.path.join(os.path.dirname(__file__), "../../../data/scintilla-rules.json")))
    return RULES

COMMODITY_FUNDS = {"GLD", "SLV", "USO", "DBC", "GDX", "GDXJ", "COPX", "SIL", "SILJ", "UUP"}
BOND_FUNDS = {"TLT", "IEF", "SHY", "HYG", "LQD", "AGG"}
def security_type(sym, prof):
    """Type of security for grouping. Stocks by today's market cap (FMP company_profile) — a survivor's view, stated."""
    cls = rules()["classes"]
    if sym in cls["crypto"]["symbols"] or sym.endswith("USD") and sym in cls["futures"]["symbols"]: return "crypto/futures"
    if sym in BOND_FUNDS: return "bond fund"
    if sym in COMMODITY_FUNDS: return "commodity fund"
    if sym in cls["index_etf"]["symbols"]: return "index fund"
    p = prof.get(sym)
    if p and p.get("is_etf"): return "sector/other fund"
    if p is None or not p.get("market_cap"):
        return "sector/other fund" if sym in cls["sector_etf"]["symbols"] else "stock (no cap)"
    mc = p["market_cap"] / 1e9
    return "mega cap (>200bn)" if mc >= 200 else "large cap (10–200bn)" if mc >= 10 else "mid cap (2–10bn)" if mc >= 2 else "small cap (<2bn)"

TYPE_ORDER = ["index fund", "sector/other fund", "commodity fund", "bond fund", "crypto/futures", "mega cap (>200bn)", "large cap (10–200bn)", "mid cap (2–10bn)", "small cap (<2bn)", "stock (no cap)"]

# ---------------------------------------------------------------- indicators (match the Hub's maths)
def rsi(c, p=14):
    """Wilder RSI(14), seeded on the first p moves like the Hub's rsiLast."""
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    if n <= p: return out
    d = np.diff(c); g = np.where(d > 0, d, 0.0); l = np.where(d < 0, -d, 0.0)
    ag = g[:p].mean(); al = l[:p].mean()
    out[p] = 100 - 100 / (1 + (ag / al if al else 1e9))
    for i in range(p + 1, n):
        ag = (ag * (p - 1) + g[i - 1]) / p; al = (al * (p - 1) + l[i - 1]) / p
        out[i] = 100 - 100 / (1 + (ag / al if al else 1e9))
    return out

def sma(x, n): return pd.Series(x).rolling(n).mean().values
def ema(x, n): return pd.Series(x).ewm(span=n, adjust=False).mean().values

def own_pct(x, min_n=250):
    """Expanding own-history percentile 1..100 using only PRIOR values (no lookahead); NaN until min_n readings."""
    x = np.asarray(x, float); n = len(x); out = np.full(n, np.nan); hist = []
    import bisect
    for i in range(n):
        v = x[i]
        if not np.isfinite(v): continue
        if len(hist) >= min_n:
            lo = bisect.bisect_left(hist, v); hi = bisect.bisect_right(hist, v)
            out[i] = 100 * (lo + (hi - lo) / 2) / len(hist)
        bisect.insort(hist, v)
    return out

def pct_of(history, v):
    h = np.asarray([x for x in history if np.isfinite(x)], float)
    if not len(h) or not np.isfinite(v): return np.nan
    return 100 * ((h < v).sum() + 0.5 * (h == v).sum()) / len(h)

def fwd_ret(c, h):
    c = np.asarray(c, float); out = np.full(len(c), np.nan); out[:-h] = 100 * (c[h:] / c[:-h] - 1) if h else 0; return out

def fwd_maxdd(c, h):
    """Deepest close below today's close within the next h sessions, % (<= 0). NaN where the window is not complete."""
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    if n <= h: return out
    s = pd.Series(c); fut_min = s[::-1].rolling(h).min()[::-1].shift(-1).values
    out[: n - h] = 100 * (fut_min[: n - h] / c[: n - h] - 1)
    return out

def fwd_maxup(c, h):
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    if n <= h: return out
    s = pd.Series(c); fut_max = s[::-1].rolling(h).max()[::-1].shift(-1).values
    out[: n - h] = 100 * (fut_max[: n - h] / c[: n - h] - 1)
    return out

# ---------------------------------------------------------------- swings (S9 pivot rule, 10 bars)
def pivot_swings(h, l, ln=10):
    """Alternating swing highs and lows; each end moved to the true extreme between its neighbours. Returns list of (k, 'H'|'L', price)."""
    h = np.asarray(h, float); l = np.asarray(l, float); n = len(h); pts = []
    for k in range(ln, n - ln):
        w = slice(k - ln, k + ln + 1)
        if h[k] > h[k - ln:k].max() and h[k] >= h[k + 1:k + ln + 1].max(): pts.append((k, "H", h[k]))
        if l[k] < l[k - ln:k].min() and l[k] <= l[k + 1:k + ln + 1].min(): pts.append((k, "L", l[k]))
    pts.sort(key=lambda p: (p[0], 0 if p[1] == "H" else 1))
    alt = []
    for p in pts:
        if not alt: alt.append(list(p)); continue
        last = alt[-1]
        if last[1] == p[1]:
            if (p[1] == "H" and p[2] > last[2]) or (p[1] == "L" and p[2] < last[2]): alt[-1] = list(p)
        else: alt.append(list(p))
    for i in range(1, len(alt) - 1):
        a, b = alt[i - 1][0], alt[i + 1][0]; best = alt[i][0]
        for k in range(a + 1, b):
            if alt[i][1] == "H" and h[k] > h[best]: best = k
            if alt[i][1] == "L" and l[k] < l[best]: best = k
        alt[i] = [best, alt[i][1], h[best] if alt[i][1] == "H" else l[best]]
    return [tuple(x) for x in alt]

def swing_lows(df, ln=10):
    """Swing lows with the depth of the fall from the previous swing high (close to close, %), and the session of confirmation (low + ln)."""
    sw = pivot_swings(df.h.values, df.l.values, ln); c = df.c.values; out = []
    for i in range(1, len(sw)):
        k, typ, _ = sw[i]
        if typ != "L": continue
        kt = sw[i - 1][0]
        out.append({"k": k, "date": df.index[k], "kTop": kt, "depth": 100 * (c[k] / c[kt] - 1), "confirm": k + ln, "fallBars": k - kt})
    return out

def swing_highs(df, ln=10):
    sw = pivot_swings(df.h.values, df.l.values, ln); c = df.c.values; out = []
    for i in range(1, len(sw)):
        k, typ, _ = sw[i]
        if typ != "H": continue
        kl = sw[i - 1][0]
        out.append({"k": k, "date": df.index[k], "kLow": kl, "rise": 100 * (c[k] / c[kl] - 1), "confirm": k + ln})
    return out

# ---------------------------------------------------------------- honest statistics
def mulberry(seed=7):
    return np.random.default_rng(seed)

def stationary_indices(n, block, rng):
    p = 1.0 / max(block, 1); out = np.empty(n, dtype=np.int64); i = rng.integers(n)
    for k in range(n):
        out[k] = i
        i = rng.integers(n) if rng.random() < p else (i + 1) % n
    return out

def block_bootstrap(values, stat=np.nanmedian, block=63, reps=500, seed=7, base=None):
    """Stationary block bootstrap over a day-ordered array (Politis–Romano). Returns est, lo, hi (90%), p (two-sided vs base)."""
    v = np.asarray(values, float); v = v[np.isfinite(v)]; n = len(v)
    if n < 5: return {"est": float(stat(v)) if n else None, "lo": None, "hi": None, "p": None, "n": int(n)}
    rng = mulberry(seed); draws = np.empty(reps)
    for r in range(reps):
        idx = stationary_indices(n, block, rng); draws[r] = stat(v[idx])
    draws = np.sort(draws); est = float(stat(v))
    p = None
    if base is not None:
        below = (draws <= base).mean(); p = float(min(1, 2 * min(below, 1 - below)))
    return {"est": est, "lo": float(np.quantile(draws, 0.05)), "hi": float(np.quantile(draws, 0.95)), "p": p, "n": int(n)}

def date_block_bootstrap(df, date_col, stat, block=63, reps=300, seed=7, base=None):
    """Pooled panel (many names on shared dates): resample DATES in stationary blocks and take every row on the drawn dates,
    so names that fall together stay together. stat(frame) → number."""
    dates = np.array(sorted(df[date_col].unique())); n = len(dates)
    if n < 5: return {"est": float(stat(df)), "lo": None, "hi": None, "p": None, "n": int(n)}
    groups = {d: g for d, g in df.groupby(date_col)}
    rng = mulberry(seed); draws = []
    for r in range(reps):
        idx = stationary_indices(n, block, rng)
        sample = pd.concat([groups[dates[i]] for i in idx], ignore_index=True)
        draws.append(stat(sample))
    draws = np.sort(np.array(draws, float)); est = float(stat(df)); p = None
    if base is not None:
        below = (draws <= base).mean(); p = float(min(1, 2 * min(below, 1 - below)))
    return {"est": est, "lo": float(np.quantile(draws, 0.05)), "hi": float(np.quantile(draws, 0.95)), "p": p, "n": int(n)}

def episode_bootstrap(values, stat=np.nanmedian, reps=1000, seed=7, base=None):
    v = np.asarray(values, float); v = v[np.isfinite(v)]; n = len(v)
    if n < 3: return {"est": float(stat(v)) if n else None, "lo": None, "hi": None, "p": None, "n": int(n)}
    rng = mulberry(seed); draws = np.sort(np.array([stat(v[rng.integers(n, size=n)]) for _ in range(reps)]))
    est = float(stat(v)); p = None
    if base is not None:
        below = (draws <= base).mean(); p = float(min(1, 2 * min(below, 1 - below)))
    return {"est": est, "lo": float(np.quantile(draws, 0.05)), "hi": float(np.quantile(draws, 0.95)), "p": p, "n": int(n)}

def benjamini_hochberg(pvals, q=0.1):
    p = np.array([1.0 if v is None or not np.isfinite(v) else v for v in pvals], float); m = len(p)
    order = np.argsort(p); adj = np.empty(m); running = 1.0; kmax = -1
    for r in range(m - 1, -1, -1):
        i = order[r]; running = min(running, p[i] * m / (r + 1)); adj[i] = running
        if kmax < 0 and p[i] <= q * (r + 1) / m: kmax = r
    reject = np.zeros(m, bool)
    for r in range(kmax + 1): reject[order[r]] = True
    return reject, adj

def status_word(n, p, p_adj, q=0.1):
    """R10: luck-proof (adjusted p clears, n ≥ 20), leaning (raw p clears), a list (n < 20), not shown."""
    if p is None or not np.isfinite(p): return "no data"
    if n < 20: return "a list"
    if p_adj is not None and np.isfinite(p_adj) and p_adj <= q: return "luck-proof"
    if p <= q: return "leaning"
    return "not shown"

def effective_n(x, max_lag=250):
    x = np.asarray(x, float); x = x[np.isfinite(x)]; n = len(x)
    if n < 10: return float(n)
    m = x.mean(); den = ((x - m) ** 2).sum(); cut = 2 / math.sqrt(n); s = 0.0
    for k in range(1, min(max_lag, n - 2)):
        r = ((x[:-k] - m) * (x[k:] - m)).sum() / den if den else 0
        if r < cut: break
        s += r
    return n / (1 + 2 * max(0.0, s))

def runs_of(mask):
    """How many separate visits a true/false series has (the honest count of a clustered signal)."""
    m = np.asarray(mask, bool); return int((m & ~np.r_[False, m[:-1]]).sum())

def km_median(times, events):
    """Kaplan–Meier median wait; censored items (event False) stay in the risk set."""
    a = sorted(zip(times, events)); at_risk = len(a); S = 1.0; i = 0
    while i < len(a):
        t = a[i][0]; d = c = 0
        while i < len(a) and a[i][0] == t:
            if a[i][1]: d += 1
            else: c += 1
            i += 1
        if d and at_risk: S *= 1 - d / at_risk
        if S <= 0.5: return t
        at_risk -= d + c
    return None

def dist(x, ps=(10, 25, 50, 75, 90)):
    v = np.asarray(x, float); v = v[np.isfinite(v)]
    if not len(v): return None
    o = {"n": int(len(v))}
    for p in ps: o["p%d" % p] = float(np.percentile(v, p))
    o["up"] = float(100 * (v > 0).mean()); return o

def r1(x): return None if x is None or not np.isfinite(x) else round(float(x), 1)
def r2(x): return None if x is None or not np.isfinite(x) else round(float(x), 2)
def r3(x): return None if x is None or not np.isfinite(x) else round(float(x), 3)
def clean(o):
    """JSON-safe: numpy → python, NaN → None."""
    if isinstance(o, dict): return {str(k): clean(v) for k, v in o.items()}
    if isinstance(o, (list, tuple)): return [clean(v) for v in o]
    if isinstance(o, (np.integer,)): return int(o)
    if isinstance(o, (np.floating, float)): return None if not np.isfinite(o) else float(o)
    if isinstance(o, (np.bool_,)): return bool(o)
    if isinstance(o, pd.Timestamp): return o.strftime("%Y-%m-%d")
    return o
