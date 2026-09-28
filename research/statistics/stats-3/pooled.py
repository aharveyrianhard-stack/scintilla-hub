"""Pooled-panel statistics for many names on shared dates. The unit that is resampled is the DATE (in stationary blocks),
because names move together; the statistic is the count-weighted median of per-date medians ('the typical day's typical
name'), so a crash day with 400 names counts once as a day, not 400 times."""
import numpy as np, pandas as pd, lib

def per_date(df, date_col, val_col):
    g = df.groupby(date_col)[val_col]; return pd.DataFrame({"med": g.median(), "n": g.count(), "up": g.apply(lambda s: float((s > 0).mean()) if len(s) else np.nan)}).dropna()

def wmedian(v, w):
    o = np.argsort(v); v = v[o]; w = w[o]; cw = np.cumsum(w); return float(v[np.searchsorted(cw, 0.5 * cw[-1])])

def cell(df, date_col, val_col, base_med=None, base_up=None, block=63, reps=300, seed=7):
    pdm = per_date(df, date_col, val_col); n = len(pdm)
    if n < 5: return {"n_rows": int(len(df)), "n_dates": int(n), "med": None, "lo": None, "hi": None, "p": None, "up": None, "up_lo": None, "up_hi": None, "p_up": None}
    v = pdm.med.values; w = pdm.n.values.astype(float); u = pdm.up.values
    est = wmedian(v, w); est_up = float(np.average(u, weights=w)); rng = lib.mulberry(seed); dm = np.empty(reps); du = np.empty(reps)
    for r in range(reps):
        idx = lib.stationary_indices(n, block, rng); dm[r] = wmedian(v[idx], w[idx]); du[r] = np.average(u[idx], weights=w[idx])
    dm.sort(); du.sort(); out = {"n_rows": int(len(df)), "n_dates": int(n), "eff_dates": lib.r1(n / block), "med": lib.r2(est), "lo": lib.r2(np.quantile(dm, 0.05)), "hi": lib.r2(np.quantile(dm, 0.95)), "up": lib.r1(100 * est_up), "up_lo": lib.r1(100 * np.quantile(du, 0.05)), "up_hi": lib.r1(100 * np.quantile(du, 0.95)), "p": None, "p_up": None}
    if base_med is not None: b = (dm <= base_med).mean(); out["p"] = float(min(1, 2 * min(b, 1 - b)))
    if base_up is not None: b = (du <= base_up / 100).mean(); out["p_up"] = float(min(1, 2 * min(b, 1 - b)))
    return out

def fdr_over(cells, key="p", q=0.1):
    ps = [c[key] for c in cells]; rej, adj = lib.benjamini_hochberg(ps, q)
    for i, c in enumerate(cells): c[key + "_adj"] = float(adj[i]); c[key + "_fdr"] = bool(rej[i]); c["word"] = lib.status_word(c.get("n_dates", 0) // 63 * 1 if False else c.get("n_dates", 0), c[key], adj[i])
    return cells
