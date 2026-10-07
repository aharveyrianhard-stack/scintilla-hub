# PF1 · an independent re-computation of the page's load-bearing numbers. It imports nothing from this folder: the raw
# panel goes in, its own accounting runs, and the result is compared with what the structure files wrote. Run it after any
# re-run of the structures:   python3 verify_independent.py        (writes ../data/verify_independent.json)
import json, os, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "data")
OUT = sys.argv[2] if len(sys.argv) > 2 else os.path.join(DATA, "verify_independent.json")
c = pd.read_csv(f"{DATA}/bars_c.csv.gz", index_col=0); dates = list(c.index); ix = {d: i for i, d in enumerate(dates)}; N = len(dates)
divs = json.load(open(f"{DATA}/dividends.json"))
def ret(sym):
    dv = np.zeros(N)
    for d, a, _ in divs.get(sym, []):
        j = ix[d] if d in ix else int(np.searchsorted(dates, d))
        if j < N: dv[j] += a
    px = c[sym].values; r = np.full(N, np.nan); r[1:] = (px[1:] + dv[1:]) / px[:-1] - 1.0
    return np.where(np.isfinite(r), r, 0.0)
R = {s: ret(s) for s in ["SPY", "QQQ", "IEF"]}
y = c["US3M"].ffill().values; cash = np.zeros(N); cash[1:] = y[:-1] / 100.0 / 252.0; cash = np.where(np.isfinite(cash), cash, 0.0)
TR = {s: np.cumprod(1.0 + R[s]) for s in R}; CC = np.cumprod(1.0 + cash)
F0, F1 = ix["2005-01-03"], ix["2026-10-05"]; L0 = ix["2024-10-03"]
def stats(eq, a, b):                      # eq indexed by row number
    e = eq[a:b + 1]; yrs = (len(e) - 1) / 252.0; peak = np.maximum.accumulate(e)
    return round(100 * ((e[-1] / e[0]) ** (1 / yrs) - 1), 2), round(100 * (e[-1] / e[0] - 1), 1), round(100 * (e / peak - 1).min(), 1)
out = {}
# 1 · buy and hold
for s in ["SPY", "QQQ"]:
    eq = TR[s] / TR[s][F0]; out[f"hold_{s}"] = {"full": stats(eq, F0, F1), "last2": stats(eq, L0, F1)}
# 2 · one account that is all in one thing at a time, switched at the close AFTER the reading, 5 bp per side
def switcher(want_asset, start, first_asset):
    """want_asset[i] = what the rule reads at close i ('SPY','QQQ','IEF','CASH'). Fill at close i+1."""
    eq = np.ones(N); held = first_asset; pend = None; stock = np.zeros(N); stock[start] = held in ("SPY", "QQQ"); switches = 0
    for i in range(start + 1, F1 + 1):
        r = cash[i] if held == "CASH" else R[held][i]; v = eq[i - 1] * (1.0 + r)
        if pend is not None and pend != held:
            legs = (held != "CASH") + (pend != "CASH"); v *= (1.0 - 0.0005 * legs); held = pend; switches += 1
        pend = None; eq[i] = v; stock[i] = held in ("SPY", "QQQ")
        if i < F1 and want_asset[i] != held: pend = want_asset[i]
    return eq, stock, switches
spy = c["SPY"]; ma = spy.rolling(200, min_periods=200).mean(); below = (spy < ma).values
ab = {}
for s in ["XLK", "XLV", "XLF", "XLY", "XLI", "XLB", "XLE", "XLP", "XLU", "XLRE", "XLC"]:
    x = c[s].dropna(); m = x.rolling(200, min_periods=200).mean(); ab[s] = (x > m).astype(float).where(m.notna()).reindex(c.index)
ab = pd.DataFrame(ab); cnt = ab.notna().sum(axis=1); share = ab.sum(axis=1) / cnt.where(cnt > 0); weak = (share < 0.5).values
raw_in = ~(below & weak); first = int(np.argmax(ma.notna().values))
def confirm(raw, n):
    o = raw.copy(); s = bool(raw[first]); run = 0
    for i in range(first, N):
        run = run + 1 if bool(raw[i]) != s else 0
        if run >= n: s, run = (not s), 0
        o[i] = s
    return o
for key, w in [("trend_and_breadth", raw_in), ("trend_and_breadth_3day", confirm(raw_in, 3)), ("trend_only", ~below)]:
    want = ["SPY" if x else "CASH" for x in w]; eq, st, sw = switcher(want, F0, want[F0])
    out[key] = {"full": stats(eq, F0, F1), "last2": stats(eq, L0, F1), "stock_full": round(100 * st[F0:F1 + 1].mean(), 1), "stock_last2": round(100 * st[L0:F1 + 1].mean(), 1), "switches": sw}
# 3 · dual momentum, SPY / QQQ, else 7-10 year Treasuries; read at each completed month's last close
me = [i for i in range(N - 1) if dates[i][:7] != dates[i + 1][:7]]
def dm_read(i):
    a = {s: TR[s][i] / TR[s][i - 252] - 1.0 for s in ("SPY", "QQQ")}; b = CC[i] / CC[i - 252] - 1.0; best = max(a, key=a.get)
    return best if a[best] > b else "IEF"
want = [None] * N; mes = set(me); cur = dm_read(max(k for k in me if k < F0))       # the reading at the close before the start
for i in range(F0, N):
    if i in mes: cur = dm_read(i)
    want[i] = cur
eq, st, sw = switcher(want, F0, dm_read(max(k for k in me if k < F0)))
out["dm_spy_qqq"] = {"full": stats(eq, F0, F1), "last2": stats(eq, L0, F1), "stock_full": round(100 * st[F0:F1 + 1].mean(), 1), "switches": sw}
# 4 · the tool's own ladder: its percent invested held in SPY, the rest in bills (drifts; re-set when 2 points off; next close)
T = json.load(open(f"{DATA}/tool-replay.json")); ser = {r["date"]: r for r in T["series"]}
def exposure(xs, floor=0.0):
    x0 = floor + (1 - floor) * xs[dates[L0]]; vs, vc = x0, 1.0 - x0; eq = np.ones(N); st = np.zeros(N); st[L0] = x0; pend = None
    for i in range(L0 + 1, F1 + 1):
        vs *= 1.0 + R["SPY"][i]; vc *= 1.0 + cash[i]; tot = vs + vc
        if pend is not None:
            d = pend * tot - vs
            if abs(d) >= 0.0025 * tot: vs += d; vc -= d + abs(d) * 0.0005
            tot = vs + vc
        pend = None; eq[i] = tot; st[i] = vs / tot
        x = xs.get(dates[i])
        if x is not None and i < F1:
            x = floor + (1 - floor) * x
            if abs(vs / tot - x) >= 0.02: pend = x
    return eq, st
rung = {d: r["heatRung"] / 100.0 for d, r in ser.items()}
for name, fl in [("ladder", 0.0), ("ladder_floor_60", 0.6)]:
    eq, st = exposure(rung, fl); out[name] = {"last2": stats(eq, L0, F1), "stock_last2": round(100 * st[L0:F1 + 1].mean(), 1)}
avg = float(np.mean([rung[d] for d in dates[L0:F1 + 1] if d in rung])); out["ladder_avg_share_pct"] = round(100 * avg, 1)
# ---- compare with the files
def J(n): return json.load(open(f"{DATA}/{n}.json"))
def V(j, key): return next(v for v in j["variants"] if v.get("key") == key or v["label"] == key)
s0, s2, s3, s7 = J("s0_baselines"), J("s2_trend_core"), J("s3_dual_momentum"), J("s7_combined")
rows = []
def cmp(name, mine, theirs, tol):
    rows.append((name, mine, theirs, abs(mine - theirs) <= tol))
for s in ["SPY", "QQQ"]:
    v = V(s0, f"Buy and hold {s}"); m = out[f"hold_{s}"]
    cmp(f"hold {s} full yearly", m["full"][0], v["full"]["cagr_pct"], 0.02); cmp(f"hold {s} full worst fall", m["full"][2], v["full"]["max_dd_pct"], 0.1)
    cmp(f"hold {s} last2 total", m["last2"][1], v["last2"]["total_return_pct"], 0.1); cmp(f"hold {s} last2 worst fall", m["last2"][2], v["last2"]["max_dd_pct"], 0.1)
for k in ["trend_and_breadth", "trend_and_breadth_3day", "trend_only"]:
    v = V(s2, k); m = out[k]
    cmp(f"{k} full yearly", m["full"][0], v["full"]["cagr_pct"], 0.05); cmp(f"{k} full worst fall", m["full"][2], v["full"]["max_dd_pct"], 0.1)
    cmp(f"{k} full in stocks", m["stock_full"], v["full"]["avg_stock_pct"], 0.2); cmp(f"{k} last2 total", m["last2"][1], v["last2"]["total_return_pct"], 0.2)
    cmp(f"{k} last2 worst fall", m["last2"][2], v["last2"]["max_dd_pct"], 0.1); cmp(f"{k} last2 in stocks", m["stock_last2"], v["last2"]["avg_stock_pct"], 0.2)
v = V(s3, "dm_spy_qqq"); m = out["dm_spy_qqq"]
cmp("dual momentum full yearly", m["full"][0], v["full"]["cagr_pct"], 0.05); cmp("dual momentum full worst fall", m["full"][2], v["full"]["max_dd_pct"], 0.1)
cmp("dual momentum last2 total", m["last2"][1], v["last2"]["total_return_pct"], 0.2); cmp("dual momentum full in stocks", m["stock_full"], v["full"]["avg_stock_pct"], 0.2)
v = V(s0, "Cash by default — the July heat ladder"); m = out["ladder"]
cmp("ladder last2 total", m["last2"][1], v["last2"]["total_return_pct"], 0.2); cmp("ladder last2 worst fall", m["last2"][2], v["last2"]["max_dd_pct"], 0.2); cmp("ladder last2 in stocks", m["stock_last2"], v["last2"]["avg_stock_pct"], 0.3)
v = V(s7, "ladder_floor_60"); m = out["ladder_floor_60"]
cmp("ladder + 60% floor last2 total", m["last2"][1], v["last2"]["total_return_pct"], 0.2); cmp("ladder + 60% floor last2 worst fall", m["last2"][2], v["last2"]["max_dd_pct"], 0.2); cmp("ladder + 60% floor in stocks", m["stock_last2"], v["last2"]["avg_stock_pct"], 0.3)
bad = 0
for n, a, b, ok in rows:
    bad += (not ok); print(f"{'ok ' if ok else 'XX '} {n:42s} mine {a:8.2f}  file {b:8.2f}")
print("switches: trend+breadth", out["trend_and_breadth"]["switches"], "| 3-close", out["trend_and_breadth_3day"]["switches"], "| dual momentum", out["dm_spy_qqq"]["switches"], "| ladder average share", out["ladder_avg_share_pct"])
print(f"{len(rows)} comparisons, {bad} outside tolerance")
json.dump({"comparisons": [{"what": n, "mine": float(a), "file": float(b), "ok": bool(ok)} for n, a, b, ok in rows], "outside_tolerance": bad}, open(OUT, "w"), indent=1)
sys.exit(1 if bad else 0)
