"""N9 · stats-3 §1d again, on the point-in-time universe: the pullback cell (trend strong, momentum weak, each an own-history
tercile of the replayed daily Geiger) by market-cap tranche, against the tranche's own any-day, next 63 sessions vs SPY.
Differences from stats-3 §1d, and only these: (1) the names are every S&P 500 member since 2003, counted only on days they
were members (was: today's served names, every day); (2) each name-day is typed by its full market cap ON THAT DAY (was:
today's cap); (3) a name that stops trading inside the 63 sessions is scored to its last close (was: dropped, which only a
survivor list can afford). Same Geiger maths, same percentile, same date-block bootstrap, same tranche lines.
python3 research/statistics/point-in-time/q1d_pit.py  (STATS3_DATA → the stats-3 scratch that holds panel.csv)"""
import os, sys, json, numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, os.path.join(HERE, "..", "stats-3"))
import lib, pooled
PIT = os.path.expanduser("~/Library/Application Support/scintilla/stats-cache/point-in-time/v1")
OUT = os.path.abspath(os.path.join(HERE, "../../../deliverables/20260928/point-in-time/data"))
P = pd.read_csv(os.path.join(lib.SCRATCH, "panel.csv"), index_col=0, parse_dates=True)
H = 63

def fwd_to_exit(c, h):
    """Forward h-session return; when the series ends inside the window, the return to its last close (delisted / acquired)."""
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    for i in range(n - 1):
        j = min(i + h, n - 1); out[i] = 100 * (c[j] / c[i] - 1)
    return out

def tranche(cap_m):
    if cap_m is None or not np.isfinite(cap_m): return "stock (no cap)"
    return "mega cap (>200bn)" if cap_m > 200e3 else "large cap (10–200bn)" if cap_m > 10e3 else "mid cap (2–10bn)" if cap_m > 2e3 else "small cap (<2bn)"

rows = []; exits = 0
for f in sorted(os.listdir(os.path.join(PIT, "geiger"))):
    sym = f[:-5]; j = json.load(open(os.path.join(PIT, "geiger", f)))
    if not j.get("rows"): continue
    g = pd.DataFrame(j["rows"], columns=j["cols"]); g.index = pd.to_datetime(g.date); g = g[g.full == 1]
    if len(g) < 300: continue
    dp = os.path.join(PIT, "daily", f)
    if not os.path.exists(dp): continue
    d = json.load(open(dp)); d = pd.DataFrame(d["rows"], columns=d["cols"]); d.index = pd.to_datetime(d.date)
    df = g[["g", "tr", "mo"]].copy()
    for k in ("g", "tr", "mo"): df[k + "_pct"] = lib.own_pct(df[k].values)
    last_ok = d.index[-1] < pd.Timestamp("2026-09-01")
    f63 = pd.Series(fwd_to_exit(d.c.values, H) if last_ok else lib.fwd_ret(d.c.values, H), index=d.index)
    df["f63"] = f63.reindex(df.index).values
    df["x63"] = df.f63 - P[f"fwd_{H}"].reindex(df.index).values
    df["member"] = d.member.reindex(df.index).values; df["cap_m"] = d.cap_m.reindex(df.index).values
    df["sym"] = sym; df = df[df.member == 1]
    if last_ok: exits += 1
    rows.append(df.reset_index().rename(columns={"index": "date"}))
D = pd.concat(rows, ignore_index=True); D["date"] = pd.to_datetime(D.date)
D["type"] = [tranche(x) for x in D.cap_m.values]
# SPY's forward return exists only where the panel has one: drop the last 63 sessions like stats-3 did
D = D.dropna(subset=["tr_pct", "mo_pct", "x63"])
print("rows", len(D), "names", D.sym.nunique(), "names that stopped trading", exits, "from", D.date.min().date())
res = {"asof": lib.ASOF, "rows": int(len(D)), "names": int(D.sym.nunique()), "from": D.date.min().strftime("%Y-%m-%d"), "stoppedTrading": exits, "byTypeCell": []}
from scipy.stats import spearmanr
for typ in [t for t in lib.TYPE_ORDER if "cap" in t]:
    sub = D[D.type == typ]
    if sub.date.nunique() < 500: continue
    cellpb = sub[(sub.tr_pct > 200 / 3) & (sub.mo_pct <= 100 / 3)]
    bF = pooled.cell(sub, "date", "f63", reps=200, seed=41); cF = pooled.cell(cellpb, "date", "f63", base_med=bF["med"], base_up=bF["up"], reps=200, seed=42)
    bX = pooled.cell(sub, "date", "x63", reps=200, seed=43); cX = pooled.cell(cellpb, "date", "x63", base_med=bX["med"], base_up=bX["up"], reps=200, seed=44)
    dec = (sub.g_pct // 10).clip(0, 9); lad = sub.groupby(dec).f63.median(); rho = spearmanr(lad.index, lad.values).correlation if len(lad) > 3 else None
    res["byTypeCell"].append({"type": typ, "names": int(sub.sym.nunique()), "dates": int(sub.date.nunique()), "name_days": int(len(sub)), "cell_share": lib.r1(100 * len(cellpb) / len(sub)), "f63": cF, "f63_base": bF, "x63": cX, "x63_base": bX, "ladder_rho": lib.r2(rho), "ladder": [lib.r2(v) for v in lad.values]})
pooled.fdr_over([b["f63"] for b in res["byTypeCell"]]); pooled.fdr_over([b["x63"] for b in res["byTypeCell"]])
# the all-members pullback cell (stats-3 §1c's headline cell) on the same universe, for the page
cellAll = D[(D.tr_pct > 200 / 3) & (D.mo_pct <= 100 / 3)]
bX = pooled.cell(D, "date", "x63", reps=200, seed=21); res["allCell"] = {"x63": pooled.cell(cellAll, "date", "x63", base_med=bX["med"], base_up=bX["up"], reps=200, seed=22), "x63_base": bX, "share": lib.r1(100 * len(cellAll) / len(D))}
json.dump(lib.clean(res), open(os.path.join(OUT, "pit-q1d.json"), "w"))
for b in res["byTypeCell"]: print(b["type"], b["names"], b["dates"], "cell x63", b["x63"]["med"], b["x63"]["lo"], b["x63"]["hi"], b["x63"].get("word"), "| any-day x63", b["x63_base"]["med"], "| f63 cell/base", b["f63"]["med"], b["f63_base"]["med"], "rho", b["ladder_rho"])
print("all", res["allCell"]["x63"]["med"], res["allCell"]["x63_base"]["med"])
