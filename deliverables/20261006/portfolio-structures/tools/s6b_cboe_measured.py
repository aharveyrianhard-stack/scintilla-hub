# PF1 · structure 6, the MEASURED record. We store no option prices, so our own figures for selling puts and calls are a model.
# Cboe publishes the daily history of three indexes that are exactly these strategies run for real on the S&P 500, month after
# month: PUT (sell an at-the-money put each month, cash in Treasury bills), BXM (hold the index, sell an at-the-money call each
# month) and BXY (the same with the call 2% above). This file reads those public histories, measures them with the study's own
# yardsticks over the study's own windows, and sets our model beside them so the page can say how far the model flatters.
# Only the summary numbers and thinned curves are written to ../data/; Cboe's raw files stay in the cache folder, uncommitted.
import json, os, sys, urllib.request
import numpy as np, pandas as pd
import pf1lib as L

CACHE = os.environ.get("PF1_CACHE") or os.path.join(L.DATA, "_raw"); os.makedirs(CACHE, exist_ok=True)
URL = "https://cdn-api.cboe.com/api/global/us_indices/daily_prices/{}_History.csv"
INDEXES = [("PUT", "Cboe PutWrite index (PUT) — measured: sell an at-the-money put on the S&P 500 every month, the cash in Treasury bills"),
           ("BXM", "Cboe BuyWrite index (BXM) — measured: hold the S&P 500 and sell an at-the-money call on it every month"),
           ("BXY", "Cboe 2% out-of-the-money BuyWrite index (BXY) — measured: hold the S&P 500 and sell a call 2% above it every month")]

def series(sym):
    f = os.path.join(CACHE, f"cboe_{sym}.csv")
    if not os.path.exists(f):
        r = urllib.request.Request(URL.format(sym), headers={"User-Agent": "Mozilla/5.0"}); open(f, "wb").write(urllib.request.urlopen(r, timeout=60).read())
    d = pd.read_csv(f); d["d"] = pd.to_datetime(d["DATE"], format="%m/%d/%Y").dt.strftime("%Y-%m-%d")
    return d.drop_duplicates("d", keep="last").set_index("d")[sym].astype(float)

D = L.load(); out = {"structure": "s6b_cboe_measured", "source": "Cboe Global Markets, public daily index histories (" + URL.format("PUT / BXM / BXY") + "), read 6 Oct 2026",
                     "variants": [], "coverage": {}}
spy = D.tr["SPY"]; EQ = {}
def scorecard(eq):
    pb = []; bo = []
    for p in L.pullbacks(D):
        a, b = p["peak"], p["trough"]; c = D.dates[min(D.ix[b] + 40, D.ix[L.LAST2[1]])]
        pb.append({**p, "stock_at_peak_pct": None, "stock_at_trough_pct": None, "fall_pct": round(100 * (eq[b] / eq[a] - 1), 1), "spy_fall_pct": round(100 * (spy[b] / spy[a] - 1), 1),
                   "rebound40_pct": round(100 * (eq[c] / eq[b] - 1), 1), "spy_rebound40_pct": round(100 * (spy[c] / spy[b] - 1), 1),
                   "round_trip_pct": round(100 * (eq[c] / eq[a] - 1), 1), "spy_round_trip_pct": round(100 * (spy[c] / spy[a] - 1), 1), "rebound_to": c})
    for b in L.breakouts():
        d = b["breakDate"]; j = D.ix[d] + 20; f = D.tr[b["sym"]]; row = {"sym": b["sym"], "date": d, "level": b["level"], "stock_on_break_pct": None}
        if j <= D.ix[L.LAST2[1]]: e = D.dates[j]; row.update({"next20_pct": round(100 * (eq[e] / eq[d] - 1), 1), "fund_next20_pct": round(100 * (f[e] / f[d] - 1), 1)})
        bo.append(row)
    return {"pullbacks": pb, "breakouts": bo}

for sym, label in INDEXES:
    raw = series(sym); dense = raw[[d for d in raw.index if d in D.ix]]
    # the index is daily only from some date on; use it from the first session after which no session of ours is missing
    idx = [d for d in D.dates if L.FULL[0] <= d <= L.FULL[1]]; have = pd.Series([d in dense.index for d in idx], index=idx)
    first = next(d for d in idx if have[d] and have.loc[d:].mean() > 0.995)   # daily from here on; a stray missing session is carried forward and counted
    stray = [d for d in idx if d >= first and not have[d]]
    eq = dense.reindex([d for d in D.dates if first <= d <= L.FULL[1]]).ffill()
    sim = {"name": sym, "equity": eq, "stock": pd.Series(np.nan, index=eq.index), "bond": pd.Series(0.0, index=eq.index), "trades": [], "decision_days": 0, "turnover": 0.0, "cost_paid": 0.0}
    full = L.metrics(sim, first, L.FULL[1]); last2 = L.metrics(sim, *L.LAST2)
    for m in (full, last2):
        m["avg_stock_pct"] = None; m["avg_cash_pct"] = None; m["days_under_half_stock_pct"] = None; m["days_out_of_stock_pct"] = None
        m["decision_days_per_month"] = 1.0; m["orders_per_month"] = 1.0                      # one option sold a month, by the index's own rules
    spy_sim = {"equity": spy.loc[first:L.FULL[1]], "stock": pd.Series(1.0, index=spy.loc[first:L.FULL[1]].index), "bond": pd.Series(0.0, index=spy.loc[first:L.FULL[1]].index), "trades": []}
    spy_same = L.metrics(spy_sim, first, L.FULL[1])
    stress = {k: round(100 * (eq[b] / eq[a] - 1), 1) for k, (a, b) in L.STRESS.items() if a in eq.index and b in eq.index}
    v = {"key": sym.lower() + "_measured", "label": label, "note": f"measured index history from {first}", "full": full, "full_from": first, "last2": last2, "stress": stress,
         "years": L.year_table(sim), "scorecard": scorecard(eq), "curve_full": L.curve(sim, step=5), "curve_last2": L.curve(sim, *L.LAST2), "cost_paid_pct": None, "turnover_x": None,
         "spy_same_window": {"cagr_pct": spy_same["cagr_pct"], "max_dd_pct": spy_same["max_dd_pct"], "vol_pct": spy_same["vol_pct"]}, "measured": True}
    for c in ("curve_full", "curve_last2"): v[c]["stock"] = [None] * len(v[c]["stock"])
    out["variants"].append(v); out["coverage"][sym] = {"first_daily_session_used": first, "rows_in_file": int(len(raw)), "last": raw.index[-1], "sessions_carried_forward": stray}; EQ[sym] = eq

# one picture needs one date grid: SPY, PUT and BXM each set to 1.00 on the first session all three have, every fifth session
first_all = max(EQ["PUT"].index[0], EQ["BXM"].index[0]); grid = [d for d in D.dates if first_all <= d <= L.FULL[1]]
pick = grid[::5] if grid[-1] in grid[::5] else grid[::5] + [grid[-1]]
out["chart_same_dates"] = {"from": first_all, "dates": pick, "SPY": [round(float(spy[d] / spy[first_all]), 4) for d in pick],
                           "PUT": [round(float(EQ["PUT"][d] / EQ["PUT"][first_all]), 4) for d in pick], "BXM": [round(float(EQ["BXM"][d] / EQ["BXM"][first_all]), 4) for d in pick]}

# our model beside the measured record, over the SAME dates — how far does the model flatter?
M = json.load(open(os.path.join(L.DATA, "s6_paid_to_wait.json"))) if os.path.exists(os.path.join(L.DATA, "s6_paid_to_wait.json")) else None
if M:
    gap = []
    for mk, ck in [("put_at_the_money", "PUT"), ("covered_call_2pct", "BXY")]:
        mv = next((x for x in M["variants"] if x.get("key") == mk), None); cv = next(x for x in out["variants"] if x["key"] == ck.lower() + "_measured")
        if not mv: continue
        a = cv["full_from"]; c = mv["curve_full"]                       # the model's thinned curve is enough for a growth rate over the common window
        ds, es = c["dates"], c["equity"]; i = next(k for k, d in enumerate(ds) if d >= a); yrs = (D.ix[ds[-1]] - D.ix[ds[i]]) / 252.0
        model_cagr = round(100 * ((es[-1] / es[i]) ** (1 / yrs) - 1), 2)
        gap.append({"model": mk, "measured": ck, "from": ds[i], "to": ds[-1], "model_cagr_pct": model_cagr, "measured_cagr_pct": cv["full"]["cagr_pct"], "model_minus_measured_pts": round(model_cagr - cv["full"]["cagr_pct"], 2),
                    "model_last2_pct": mv["last2"]["total_return_pct"], "measured_last2_pct": cv["last2"]["total_return_pct"], "model_max_dd_pct": mv["full"]["max_dd_pct"], "measured_max_dd_pct": cv["full"]["max_dd_pct"]})
    out["model_gap"] = gap
L.save("s6b_cboe_measured.json", out)
for v in out["variants"]:
    f, l = v["full"], v["last2"]
    print(f"{v['key']:14s} from {v['full_from']} cagr {f['cagr_pct']:5.2f} dd {f['max_dd_pct']:6.1f} vol {f['vol_pct']:5.1f} | SPY same window cagr {v['spy_same_window']['cagr_pct']:5.2f} dd {v['spy_same_window']['max_dd_pct']:6.1f} | LAST2 {l['total_return_pct']:5.1f} dd {l['max_dd_pct']:6.1f} | stress {v['stress']}")
print("model gap", json.dumps(out.get("model_gap")))
