"""RESEARCH-3 · shared arithmetic (28 Sep 2026, lane P5). Pure functions plus loaders for this lane's chart-API cache.
No network, no database, no key. Method standard (deliverables/20260928/statistician/): full distributions, episodes as
the unit, stationary block bootstrap for every range, Benjamini-Hochberg across every cell tried, base rates beside
every conditional number, no lookahead (percentiles use prior days only).
The Geiger maths is a character-for-character port of the publisher (provider services/hot-query/geiger-publish-artifact.mjs,
verified against the live /geiger detail for SPY on 28 Sep by check_geiger()).
"""
import json, os, math, datetime as dt
import numpy as np, pandas as pd

SCRATCH = os.environ.get("R3_DATA", "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/d126563e-736a-4a31-96a2-a1eec6329834/scratchpad")
LIB = os.path.expanduser("~/Library/Application Support/scintilla/stats-cache")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.normpath(os.path.join(HERE, "../../../deliverables/20260928/research-3"))
ASOF = "2026-09-28"

# ------------------------------------------------------------------ loading
def bars(sym, tf="D"):
    """Bars as served by the chart API (finished bars only). Daily from bars/<SYM>.json, rungs from rungs/<SYM>_<tf>.json."""
    p = os.path.join(SCRATCH, "bars", sym + ".json") if tf == "D" else os.path.join(SCRATCH, "rungs", f"{sym}_{tf}.json")
    if not os.path.exists(p) and tf == "D": p = os.path.join(SCRATCH, "rungs", f"{sym}_D.json")
    j = json.load(open(p)); ser = j["series"]
    df = pd.DataFrame(ser); df = df[["t", "o", "h", "l", "c"] + (["v"] if "v" in df else [])].astype(float)
    df.index = pd.to_datetime(df.t, unit="ms", utc=True).dt.tz_convert(None); df = df.drop(columns="t")
    if tf == "D": df.index = df.index.normalize()
    df = df[~df.index.duplicated(keep="last")].sort_index(); df = df[df.c > 0]
    df.attrs["provider"] = j.get("provider"); df.attrs["src"] = p
    return df

def closes(sym): return bars(sym).c

def fmp_eod(symbol):
    """The regime lane's FMP pulls (run on Fly, 28 Sep): long equal-weight sector histories under today's tickers, ^VIX3M, ^GSPC..."""
    rows = []
    for f in ("fmp-eod.json", "fmp-eod2.json"):
        p = os.path.join(LIB, "regime-20260928", f)
        if not os.path.exists(p): continue
        for r in json.load(open(p)):
            if r.get("symbol") == symbol and r.get("rows"): rows += r["rows"]
    if not rows: return None
    df = pd.DataFrame(rows, columns=["d", "o", "h", "l", "c", "v"]); df.index = pd.to_datetime(df.d); df = df.drop(columns="d").astype(float)
    return df[~df.index.duplicated(keep="last")].sort_index()

def stitched(sym, fmp_sym=None):
    """Long series: FMP history (old tickers mapped by FMP) up to where the chart API's own bars start, then the chart API."""
    api = bars(sym); f = fmp_eod(fmp_sym or sym)
    if f is None: return api
    head = f[f.index < api.index[0]]
    if not len(head): return api
    # scale the FMP head onto the API's first close so the join is continuous (ratios only, never a price table)
    k = api.c.iloc[0] / f.c.reindex([api.index[0]], method="nearest").iloc[0]
    head = head.copy(); head[["o", "h", "l", "c"]] *= k
    out = pd.concat([head[["o", "h", "l", "c"]], api[["o", "h", "l", "c"]]]); out.attrs["join"] = str(api.index[0].date()); return out

# ------------------------------------------------------------------ Geiger (publisher port)
FAN = [("e", 5), ("e", 8), ("e", 13), ("e", 21), ("e", 34), ("s", 50), ("s", 100), ("s", 150), ("s", 200)]
RSI_OS, RSI_OB, W_OS, W_OB, WINDOW = 23, 77, -90, -10, 230
TFW = {"3h": 1.235817, "4h": 2.278755, "6h": 3.178477, "12h": 3.172702, "1d": 3.178477, "3d": 2.576738, "1w": 0.987499}
TOKEN = {"3h": "180", "4h": "240", "6h": "6h", "12h": "12h", "1d": "D", "3d": "3D", "1w": "W"}

def _ema_last(a, n):
    k = 2 / (n + 1); e = a[0]
    for x in a[1:]: e = x * k + e * (1 - k)
    return e
def _rsi_last(c, p=14):
    g = l = 0.0
    for i in range(1, p + 1):
        d = c[i] - c[i - 1]
        if d > 0: g += d
        else: l -= d
    g /= p; l /= p
    for i in range(p + 1, len(c)):
        d = c[i] - c[i - 1]; g = (g * (p - 1) + (d if d > 0 else 0)) / p; l = (l * (p - 1) + (-d if d < 0 else 0)) / p
    return 100 - 100 / (1 + (1e9 if l == 0 else g / l))
def rung(c, h, l, mix=(0.6, 0.4), fam=(0.5, 0.5)):
    """One rung's reading from its newest bars (the publisher slices the newest 230). Returns dict or None."""
    c = list(c[-WINDOW:]); h = list(h[-WINDOW:]); l = list(l[-WINDOW:])
    fan = []
    for ty, n in FAN:
        if len(c) < n: continue
        fan.append(_ema_last(c, n) if ty == "e" else sum(c[-n:]) / n)
    pairs = len(fan) - 1
    if pairs <= 0: return None
    in_order = sum(1 for i in range(pairs) if fan[i] > fan[i + 1])
    trend = (2 * in_order - pairs) / pairs
    mom = rsi = wr = None
    if len(c) >= 15:
        rsi = _rsi_last(c); hh = max(h[-14:]); ll = min(l[-14:]); close = c[-1]
        wr = (hh - close) / (hh - ll) * -100 if hh > ll else -50
        cl = lambda x: max(-1, min(1, x))
        mom = (cl((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2 - 1) * mix[0] + cl((wr - W_OS) / (W_OB - W_OS) * 2 - 1) * mix[1]) / sum(mix)
    comp = trend if mom is None else (fam[0] * trend + fam[1] * mom) / sum(fam)
    return {"trend": trend, "momentum": mom, "composite": comp, "rsi": rsi, "wr": wr, "fan_lines": len(fan), "pairs": pairs}

def composite(readings, weights=TFW):
    ws = s = st = sm = wm = 0.0
    for k, w in weights.items():
        r = readings.get(k)
        if r is None or w <= 0: continue
        ws += w; s += w * r["composite"]; st += w * r["trend"]
        if r["momentum"] is not None: wm += w; sm += w * r["momentum"]
    return None if not ws else {"composite": s / ws, "trend": st / ws, "momentum": (sm / wm if wm else None)}

def rung_series(df, step=1):
    """Replay one rung over its whole history: a reading at every bar (needs 230 prior bars for a full fan; fewer lines earlier, as the publisher does)."""
    c = df.c.values; h = df.h.values; l = df.l.values; out = []
    for i in range(1, len(c) + 1):
        if i % step: out.append(None); continue
        out.append(rung(c[max(0, i - WINDOW):i], h[max(0, i - WINDOW):i], l[max(0, i - WINDOW):i]))
    return out

def geiger_daily_history(sym, since="2004-01-01"):
    """Daily composite replay (all 7 rungs) evaluated at each session close: each rung uses the bars that had finished by that close."""
    R = {k: bars(sym, TOKEN[k]) for k in TFW}
    D = R["1d"]; days = D.index[D.index >= pd.Timestamp(since)]
    rows = []
    # per rung, precompute readings at each bar and map each session to the last finished bar of that rung on/before the session end
    pre = {}
    for k, df in R.items():
        rs = rung_series(df); pre[k] = (df.index, rs)
    for d in days:
        end = d + pd.Timedelta(hours=23, minutes=59)
        readings = {}
        for k, (idx, rs) in pre.items():
            j = idx.searchsorted(end, side="right") - 1
            if j >= 0 and (end - idx[j]).days <= 14: readings[k] = rs[j]
        agg = composite(readings)
        if agg: rows.append({"date": d, **agg, **{f"c_{k}": (readings[k]["composite"] if readings.get(k) else np.nan) for k in TFW}})
    return pd.DataFrame(rows).set_index("date")

# ------------------------------------------------------------------ statistics (method standard)
def mulberry32(seed=1):
    a = seed & 0xFFFFFFFF
    def rng():
        nonlocal a
        a = (a + 0x6D2B79F5) & 0xFFFFFFFF; t = a
        t = ((t ^ (t >> 15)) * (t | 1)) & 0xFFFFFFFF
        t ^= (t + ((t ^ (t >> 7)) * (t | 61) & 0xFFFFFFFF)) & 0xFFFFFFFF
        return ((t ^ (t >> 14)) & 0xFFFFFFFF) / 4294967296
    return rng

def autocorr(x, k):
    x = np.asarray(x, float); x = x[np.isfinite(x)]; n = len(x)
    if n <= k + 1: return 0.0
    m = x.mean(); d = x - m; den = (d * d).sum()
    return float((d[:-k] * d[k:]).sum() / den) if den > 0 else 0.0
def block_length(x, horizon=1, max_lag=250):
    n = np.isfinite(np.asarray(x, float)).sum(); cut = 2 / math.sqrt(max(n, 4)); k = 1
    while k <= max_lag and autocorr(x, k) >= cut: k += 1
    return max(horizon, k, 2)
def effective_n(x, max_lag=250):
    x = np.asarray(x, float); x = x[np.isfinite(x)]; n = len(x); cut = 2 / math.sqrt(max(n, 4)); s = 0.0; k = 1
    while k <= max_lag:
        r = autocorr(x, k)
        if r < cut: break
        s += r; k += 1
    return n / (1 + 2 * s)
def stationary_indices(n, block, rs):
    p = 1 / block; out = np.empty(n, int); i = rs.integers(n)
    for k in range(n):
        out[k] = i; i = rs.integers(n) if rs.random() < p else (i + 1) % n
    return out
def boot(values, stat=np.nanmedian, block=None, reps=1000, seed=7, horizon=1):
    """Politis-Romano stationary bootstrap of a statistic over a day-ordered array. Returns (estimate, lo5, hi95, draws)."""
    v = np.asarray(values, float); v = v[np.isfinite(v)]
    if len(v) < 3: return (float(stat(v)) if len(v) else np.nan, np.nan, np.nan, np.array([]))
    block = block or block_length(v, horizon); rs = np.random.default_rng(seed); draws = []
    for _ in range(reps): draws.append(stat(v[stationary_indices(len(v), block, rs)]))
    draws = np.sort(np.array(draws, float))
    return float(stat(v)), float(np.quantile(draws, 0.05)), float(np.quantile(draws, 0.95)), draws
def boot_p(draws, base):
    if not len(draws) or base is None or not np.isfinite(base): return None
    below = (draws <= base).mean(); return float(min(1, 2 * min(below, 1 - below)))
def bh(pvals, q=0.10):
    p = np.array([1.0 if v is None or not np.isfinite(v) else v for v in pvals], float); m = len(p); order = np.argsort(p)
    adj = np.ones(m); running = 1.0; reject = np.zeros(m, bool); kmax = -1
    for r in range(m - 1, -1, -1):
        i = order[r]; running = min(running, p[i] * m / (r + 1)); adj[i] = running
        if kmax < 0 and p[i] <= q * (r + 1) / m: kmax = r
    for r in range(kmax + 1): reject[order[r]] = True
    return reject, adj
def episodes(mask):
    """First index of each unbroken run of True."""
    m = np.asarray(mask, bool); return [i for i in range(len(m)) if m[i] and not (i > 0 and m[i - 1])]
def fwd(c, h):
    """Forward return over h bars, in %, NaN where the future does not exist yet."""
    c = np.asarray(c, float); out = np.full(len(c), np.nan); out[:-h] = (c[h:] / c[:-h] - 1) * 100 if h > 0 else 0; return out
def pct_rank_prior(x, min_n=250):
    """Own-history percentile using prior days only (no lookahead): share of earlier values at or below today's, 0..100."""
    x = np.asarray(x, float); out = np.full(len(x), np.nan)
    order = []
    import bisect
    for i, v in enumerate(x):
        if len(order) >= min_n and np.isfinite(v): out[i] = 100 * bisect.bisect_right(order, v) / len(order)
        if np.isfinite(v): bisect.insort(order, v)
    return out
def usual_day(c, n=60):
    """The Hub's USUAL DAY: the median absolute daily % move over the prior 60 sessions (usual_day_60 in sigma_events_daily)."""
    r = pd.Series(c).pct_change().abs() * 100
    return r.rolling(n).median().shift(1).values
def rsi_series(c, p=14):
    c = np.asarray(c, float); d = np.diff(c); g = np.where(d > 0, d, 0); l = np.where(d < 0, -d, 0)
    out = np.full(len(c), np.nan); ag = g[:p].mean(); al = l[:p].mean(); out[p] = 100 - 100 / (1 + (1e9 if al == 0 else ag / al))
    for i in range(p + 1, len(c)):
        ag = (ag * (p - 1) + g[i - 1]) / p; al = (al * (p - 1) + l[i - 1]) / p; out[i] = 100 - 100 / (1 + (1e9 if al == 0 else ag / al))
    return out
def save_json(name, obj):
    os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
    def clean(o):
        if isinstance(o, dict): return {str(k): clean(v) for k, v in o.items()}
        if isinstance(o, (list, tuple)): return [clean(v) for v in o]
        if isinstance(o, (np.floating, float)): return None if not np.isfinite(o) else round(float(o), 6)
        if isinstance(o, (np.integer,)): return int(o)
        if isinstance(o, (pd.Timestamp, dt.date, dt.datetime)): return str(o)[:10]
        if isinstance(o, np.ndarray): return clean(o.tolist())
        return o
    json.dump(clean(obj), open(os.path.join(OUT, "data", name), "w"), indent=1)

# ------------------------------------------------------------------ fast exact replay (kernel form of the publisher's window maths)
def _kernels(n_win=WINDOW):
    K = {}
    for ty, n in FAN:
        if ty == "e":
            k = 2 / (n + 1); w = np.zeros(n_win); w[0] = (1 - k) ** (n_win - 1)
            for j in range(1, n_win): w[j] = k * (1 - k) ** (n_win - 1 - j)
        else:
            w = np.zeros(n_win); w[-n:] = 1 / n
        K[(ty, n)] = w
    return K
_K = _kernels()
def _win_apply(x, w):
    """y[i] = Σ_j w[j]·x[i-len(w)+1+j] for i ≥ len(w)-1, NaN before."""
    n = len(w); out = np.full(len(x), np.nan)
    if len(x) >= n: out[n - 1:] = np.convolve(x, w[::-1], mode="valid")
    return out
def rung_series_fast(df):
    """Every bar's rung reading with the publisher's exact window maths, vectorised. Bars before 230 use the shorter window
    the publisher would have seen (fewer fan lines) — computed by the slow path only for the last few, else NaN-skipped."""
    c = df.c.values.astype(float); h = df.h.values.astype(float); l = df.l.values.astype(float); n = len(c)
    fan = np.stack([_win_apply(c, _K[key]) for key in _K])          # 9 × n
    in_order = np.zeros(n); pairs = 8
    for i in range(pairs): in_order += (fan[i] > fan[i + 1])
    trend = (2 * in_order - pairs) / pairs
    # RSI seeded on the first 14 diffs of the window, then Wilder — linear in gains/losses with a fixed kernel of 229 diffs
    d = np.diff(c); g = np.where(d > 0, d, 0.0); lo = np.where(d < 0, -d, 0.0); p = 14; m = WINDOW - 1
    wk = np.zeros(m); wk[:p] = (1 / p) * ((p - 1) / p) ** (m - p)
    for j in range(p, m): wk[j] = (1 / p) * ((p - 1) / p) ** (m - 1 - j)
    ag = np.full(n, np.nan); al = np.full(n, np.nan)
    if len(d) >= m: ag[m:] = np.convolve(g, wk[::-1], mode="valid"); al[m:] = np.convolve(lo, wk[::-1], mode="valid")
    with np.errstate(divide="ignore", invalid="ignore"):
        rsi = 100 - 100 / (1 + np.where(al == 0, 1e9, ag / al))
    hh = pd.Series(h).rolling(14).max().values; ll = pd.Series(l).rolling(14).min().values
    wr = np.where(hh > ll, (hh - c) / (hh - ll) * -100, -50.0)
    cl = lambda x: np.clip(x, -1, 1)
    mom = (cl((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2 - 1) * 0.6 + cl((wr - W_OS) / (W_OB - W_OS) * 2 - 1) * 0.4)
    comp = 0.5 * trend + 0.5 * mom
    out = pd.DataFrame({"trend": trend, "momentum": mom, "composite": comp, "rsi": rsi, "wr": wr}, index=df.index)
    out.iloc[:WINDOW - 1] = np.nan
    return out

def geiger_history(sym, since="2004-01-01", rungs=TFW):
    """Composite at every session close of the daily rung, each rung read at its last finished bar on or before that close."""
    D = bars(sym, "D"); pre = {}
    for k in rungs:
        try: df = bars(sym, TOKEN[k])
        except FileNotFoundError: continue
        pre[k] = rung_series_fast(df)
    days = D.index[D.index >= pd.Timestamp(since)]; ends = days + pd.Timedelta(hours=23, minutes=59)
    cols = {}
    for k, rs in pre.items():
        j = rs.index.searchsorted(ends, side="right") - 1
        ok = (j >= 0) & ((ends.values - rs.index.values[np.clip(j, 0, None)]) <= np.timedelta64(14, "D"))
        for f in ("composite", "trend", "momentum"):
            v = rs[f].values[np.clip(j, 0, None)].copy(); v[~ok] = np.nan; cols[f"{f}_{k}"] = v
    T = pd.DataFrame(cols, index=days)
    for f in ("composite", "trend", "momentum"):
        W = np.array([[rungs[k] for k in pre]]); V = T[[f"{f}_{k}" for k in pre]].values
        m = np.isfinite(V); T[f] = np.where(m.any(1), np.nansum(V * W, 1) / (m * W).sum(1), np.nan)
    T["close"] = D.c.reindex(days).values
    return T

# ------------------------------------------------------------------ point-in-time leaders basket (N9 lane cache, read-only)
def leaders_basket():
    """Equal-weight daily returns of the prior year-end's top-20 by full market cap (point-in-time, from the N9 cache).
    Returns a Series of daily returns (fraction) indexed by date, and the membership dict."""
    p = os.path.join(LIB, "point-in-time/v1/pit-leaders-basket.json")
    if not os.path.exists(p): return None, None
    J = json.load(open(p)); top = J["top"]; C = {}
    for s, rows in J["closes"].items():
        sr = pd.Series({r[0]: r[4] for r in rows}); sr.index = pd.to_datetime(sr.index); C[s] = sr.sort_index()
    frames = []
    for y, syms in top.items():
        y = int(y); lo = pd.Timestamp(f"{y}-01-01"); hi = pd.Timestamp(f"{y}-12-31")
        rets = []
        for s in syms:
            if s not in C: continue
            sr = C[s]; sr = sr[(sr.index >= lo - pd.Timedelta(days=10)) & (sr.index <= hi)]
            r = sr.pct_change(); r = r[(r.index >= lo)]; rets.append(r)
        if rets: frames.append(pd.concat(rets, axis=1).mean(axis=1))
    R = pd.concat(frames).sort_index(); R = R[~R.index.duplicated(keep="last")]
    return R, top
def long_series(sym):
    """Longest close series we can defend: chart API bars if cached, FMP head (regime lane, Fly) stitched before it."""
    p = os.path.join(SCRATCH, "bars", sym + ".json")
    if os.path.exists(p): return stitched(sym)
    f = fmp_eod(sym); return f
