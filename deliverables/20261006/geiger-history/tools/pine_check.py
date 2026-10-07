# GH1 · the Pine oscillator (through its Python port) against the replay, on the same chart-API bars, five names.
import json, numpy as np, pickle, time, sys
import pine_port as PP, gh1_replay as G
RES = pickle.load(open("replay.pkl", "rb")); OUT = {"names": {}}
# 1) the calendar rule against the real sessions (SPY's daily bars, 2003 to today)
d = np.load("bars/SPY.npz")["tf_D"]; eds = [PP.epoch_day_of_daily(t) for t in d[:, 0]]
miss = [(PP.ymd(eds[i]), PP.ymd(eds[i + 1]), PP.ymd(PP.nextSession(eds[i]))) for i in range(len(eds) - 1) if PP.nextSession(eds[i]) != eds[i + 1]]
OUT["calendar"] = {"sessions": len(eds), "next_session_wrong": len(miss), "cases": [{"after": "%04d-%02d-%02d" % a, "real_next": "%04d-%02d-%02d" % b, "rule_next": "%04d-%02d-%02d" % c} for a, b, c in miss]}
print("calendar rule: %d sessions, next-session wrong on %d:" % (len(eds), len(miss)), OUT["calendar"]["cases"])
# 2) do bars rolled up from 30-minute bars on the UTC grid equal the provider's own 3h / 4h / 6h / 12h bars?
base = np.load("base30/MU.npy"); z = np.load("bars/MU.npz"); OUT["rollup"] = {}
for nh, key in ((3, "tf_180"), (4, "tf_240"), (6, "tf_6h"), (12, "tf_12h")):
    ids = np.array([PP.gridId(t, nh) for t in base[:, 0]]); ub, first = np.unique(ids, return_index=True); last = np.r_[first[1:] - 1, len(base) - 1]
    built = {int(u) * nh * PP.HOUR_MS + PP.GRID_MS: (base[f, 1], base[f:l + 1, 2].max(), base[f:l + 1, 3].min(), base[l, 4]) for u, f, l in zip(ub, first, last)}
    pb = z[key]; pb = pb[(pb[:, 0] >= base[0, 0] + 2 * 86400000) & (pb[:, 0] <= base[-1, 0] - 86400000)]
    hit = [(row[1:5], built.get(int(row[0]))) for row in pb]; have = [h for h in hit if h[1] is not None]
    eq = np.array([np.isclose(a, np.array(b), atol=0.0051) for a, b in have])
    OUT["rollup"][str(nh) + "h"] = {"provider_bars": len(pb), "same_start_found": len(have), "ohlc_equal_pct": [round(float(x) * 100, 2) for x in eq.mean(axis=0)], "all_four_pct": round(float(eq.all(axis=1).mean() * 100), 2)}
    print("roll-up %2dh: provider bars %d, same start found %d, O/H/L/C equal %s, all four %.2f%%" % (nh, len(pb), len(have), OUT["rollup"][str(nh) + "h"]["ohlc_equal_pct"], eq.all(axis=1).mean() * 100))
# 3) the oscillator on a daily chart against the replay's evening reading
LAT = json.load(open("lattice-survey.json"))["phase"]
for s in ["MU", "NVDA", "AVGO", "SPY", "SNDK", "GFS", "CIEN"]:
    t0 = time.time(); base = np.load(f"base30/{s}.npy"); d = np.load(f"bars/{s}.npz")["tf_D"]; o = RES[s]
    lastday = base[-1, 0]; keep = d[:, 0] <= lastday; rep = o["g"]; res = {"grid": "B" if LAT[s] == 1 else "A"}
    for mp in ("session_end", "cash_close", "wrong_grid"):
        g = PP.daily_chart(d, base, mapping=("session_end" if mp == "wrong_grid" else mp), waitFull=(s != "SNDK"), phase3=(LAT[s] if mp != "wrong_grid" else (2 if LAT[s] == 1 else 1)))
        m = keep & np.isfinite(g) & np.isfinite(rep) & (o["nr"] == 7)
        if s == "SNDK": m &= np.arange(len(d)) >= 230                      # a young listing: compare once its own history has 230 daily bars
        gap = np.abs(g[m] - rep[m]); idx = np.where(m)[0]
        res[mp] = {"sessions": int(m.sum()), "from": o["date"][idx[0]], "to": o["date"][idx[-1]], "corr": round(float(np.corrcoef(g[m], rep[m])[0, 1]), 6),
                   "mean_gap": round(float(gap.mean()), 5), "median_gap": round(float(np.median(gap)), 6), "p95_gap": round(float(np.percentile(gap, 95)), 5), "max_gap": round(float(gap.max()), 5),
                   "max_gap_date": o["date"][idx[int(np.argmax(gap))]], "within_0.01_pct": round(float((gap < 0.01).mean() * 100), 1), "within_0.05_pct": round(float((gap < 0.05).mean() * 100), 1),
                   "last": {"date": o["date"][idx[-1]], "pine": round(float(g[idx[-1]]), 4), "replay": round(float(rep[idx[-1]]), 4)}}
        if mp == "session_end":
            res["worst"] = [{"date": o["date"][idx[k]], "pine": round(float(g[idx[k]]), 4), "replay": round(float(rep[idx[k]]), 4)} for k in np.argsort(-gap)[:5]]
    OUT["names"][s] = res
    print(s, "grid", res["grid"], round(time.time() - t0), "s"); [print("   ", k, {a: b for a, b in v.items() if a in ("sessions", "from", "to", "corr", "mean_gap", "p95_gap", "max_gap", "max_gap_date")} if isinstance(v, dict) else v) for k, v in res.items() if k != "worst"]
json.dump(OUT, open("pine-check.json", "w"), indent=1)
