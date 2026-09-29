"""Q5 · names: VST deep dive (its own falling-knife history, earnings reactions), ORCL's drop today, and which fund / cohort measures the software bucket."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
out = {"asof": ASOF}
spy = bars("SPY").c
live = json.load(open(os.path.join(SCRATCH, "geiger_names.json")))["symbols"]
def state(sym):
    D = bars(sym); c = D.c; r = rsi_series(c.values); p = pct_rank_prior(r); hi = c.rolling(252).max(); ud = usual_day(c.values)
    G = rung_series_fast(D)
    return D, {"close": float(c.iloc[-1]), "day_pct": float(c.iloc[-1] / c.iloc[-2] - 1) * 100, "x_usual": float((c.iloc[-1] / c.iloc[-2] - 1) * 100 / ud[-1]), "usual_day": float(ud[-1]), "rsi": float(r[-1]), "rsi_pct": float(p[-1]), "drawdown_from_252d_high": float(c.iloc[-1] / hi.iloc[-1] - 1) * 100,
        "high_252_date": str(c.iloc[-252:].idxmax().date()), "sessions_since_high": int(len(c) - 1 - c.values[-252:].argmax() - (len(c) - 252)), "ytd": float(c.iloc[-1] / c[c.index < "2026-01-01"].iloc[-1] - 1) * 100, "one_year": float(c.iloc[-1] / c.iloc[-253] - 1) * 100,
        "below_200d": bool(c.iloc[-1] < c.rolling(200).mean().iloc[-1]), "dist_200d_pct": float(c.iloc[-1] / c.rolling(200).mean().iloc[-1] - 1) * 100, "daily_rung": {"trend": float(G.trend.iloc[-1]), "momentum": float(G.momentum.iloc[-1]), "composite": float(G.composite.iloc[-1])},
        "live_geiger": {k: live[sym][k] for k in ("composite", "trend", "momentum")} if sym in live else None, "first_bar": str(c.index[0].date())}
# ---- VST
D, s = state("VST"); c = D.c; out["vst"] = {"state": s}
# falling-knife on its own history: first day the close sits ≥ 20% (and ≥ 30%) under its 252-day high after having been within 5% of it inside the prior 60 sessions
hi252 = c.rolling(252).max(); dd = (c / hi252 - 1) * 100
T = pd.DataFrame({"c": c, "dd": dd}); T["near_hi_recent"] = (dd.rolling(60).max() >= -5)
for h in (21, 63, 126, 252): T[f"f{h}"] = fwd(c.values, h)
T["dd_next126_min"] = (T.c.rolling(126).min().shift(-126) / T.c - 1) * 100
knives = {}
for thr in (-20, -30, -40):
    m = (T.dd <= thr) & T.near_hi_recent.shift(1).fillna(False); eps = episodes(m.values); g = {"episodes": len(eps), "dates": [str(T.index[i].date()) for i in eps], "dd_at_entry": [round(float(T.dd.iloc[i]), 1) for i in eps], "h": {}}
    for h in (21, 63, 126, 252):
        v = T[f"f{h}"].values[eps]; v = v[np.isfinite(v)]; base = T[f"f{h}"].dropna().values
        g["h"][str(h)] = {"n": int(len(v)), "values": [round(float(x), 1) for x in v], "median": float(np.median(v)) if len(v) else None, "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean())}
    v = T.dd_next126_min.values[eps]; v = v[np.isfinite(v)]; g["further_fall_next_126_median"] = float(np.median(v)) if len(v) else None; g["further_fall_values"] = [round(float(x), 1) for x in v]
    knives[str(thr)] = g
out["vst"]["knife"] = knives; out["vst"]["today_dd"] = float(dd.iloc[-1]); out["vst"]["near_hi_recent"] = bool(T.near_hi_recent.iloc[-1])
# earnings reactions from the timed export (BMO → same-day move; AMC → next-day), joined to the bars
E = [r for r in json.load(open(os.path.join(HERE, "../data/earnings-export-timed-20260927.json"))) if r["ticker"] == "VST" and r.get("eps_estimate") is not None]
rx = []
for r in E:
    d = pd.Timestamp(r["date"]); i = c.index.searchsorted(d)
    if i >= len(c) or i == 0: continue
    j = i if r.get("report_time") == "BMO" else i + 1
    if j >= len(c): continue
    rx.append({"date": r["date"], "eps_actual": r["eps_actual"], "eps_estimate": r["eps_estimate"], "surprise_pct": round(r["surprise_pct"], 1), "report_time": r.get("report_time"), "reaction_pct": float(c.iloc[j] / c.iloc[j - 1] - 1) * 100, "next_21_pct": float(c.iloc[min(j + 21, len(c) - 1)] / c.iloc[j] - 1) * 100 if j + 21 < len(c) else None})
out["vst"]["earnings"] = rx; misses = [r for r in rx if r["surprise_pct"] < 0]
out["vst"]["earnings_summary"] = {"reports": len(rx), "misses": len(misses), "share_miss": len(misses) / max(1, len(rx)), "median_reaction_on_miss": float(np.median([r["reaction_pct"] for r in misses])) if misses else None, "median_reaction_on_beat": float(np.median([r["reaction_pct"] for r in rx if r["surprise_pct"] >= 0])) if len(rx) > len(misses) else None,
    "last_8": rx[-8:], "corr_surprise_reaction": float(np.corrcoef([r["surprise_pct"] for r in rx], [r["reaction_pct"] for r in rx])[0, 1]) if len(rx) > 3 else None}
# ---- ORCL today
D, s = state("ORCL"); c = D.c; out["orcl"] = {"state": s}
r = c.pct_change() * 100; ud = pd.Series(usual_day(c.values), index=c.index); x = r / ud
T = pd.DataFrame({"c": c, "r": r, "x": x, "below200": c < c.rolling(200).mean(), "dd": (c / c.rolling(252).max() - 1) * 100})
for h in (5, 21, 63): T[f"f{h}"] = fwd(c.values, h)
after = {}
for name, m in (("day ≤ −3%", T.r <= -3), ("day ≤ −3% while below its 200-day", (T.r <= -3) & T.below200), ("day ≤ −3%, already 25%+ under its year high", (T.r <= -3) & (T.dd <= -25)), ("≥ 2× usual day down", T.x <= -2)):
    eps = episodes(m.fillna(False).values); g = {"episodes": len(eps), "h": {}}
    for h in (5, 21, 63):
        v = T[f"f{h}"].values[eps]; v = v[np.isfinite(v)]; base = T[f"f{h}"].dropna().values
        est, lo, hi, dr = boot(v, horizon=h, reps=300) if len(v) >= 3 else (np.nan, np.nan, np.nan, np.array([]))
        g["h"][str(h)] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None, "base_median": float(np.median(base)), "p": boot_p(dr, float(np.median(base)))}
    after[name] = g
out["orcl"]["after"] = after; out["orcl"]["today_pct_of_down_days"] = float((r.dropna()[:-1] <= r.iloc[-1]).mean() * 100)
out["orcl"]["sources"] = ["tradingkey.com 28 Sep: −3.61% on the day; Project Jupiter (2.45 GW, New Mexico) force majeure on permitting/pipeline; S&P cut to BBB−; workforce cuts; Ellison pledged shares +19%; avg target $246.48",
    "invezz.com 28 Sep (403 to us; headline only): 'why is Oracle falling 2% today'", "gurufocus 28 Sep: −3.3% to $132.60 (matches the chart API close 132.60)"]
# ---- the software bucket: which fund and which cohort measures it
BUCKET = ["MDB", "HOOD", "SHOP", "ORCL", "CRM", "SNOW", "APP", "NFLX", "LYFT"]; FUNDS = ["IGV", "SKYY", "XLK", "VGT", "QQQ", "SPY", "IWM", "XLC", "XLF"]
R = pd.DataFrame({s: bars(s).c.pct_change() for s in BUCKET + FUNDS}).dropna(how="all"); R = R.loc["2024-09-01":]
bucket_ew = R[BUCKET].mean(axis=1); R["BUCKET_EW"] = bucket_ew
corr = R.corr(); fund_corr = {s: {f: float(corr.loc[s, f]) for f in FUNDS} for s in BUCKET + ["BUCKET_EW"]}
best = {s: max(FUNDS, key=lambda f: fund_corr[s][f]) for s in BUCKET + ["BUCKET_EW"]}
tax = json.load(open(os.path.join(HERE, "../../../data/taxonomy-20260924.json")))["nodes"]
cohorts = {s: [k for k, v in tax.items() if s in (v.get("members") or []) and (k.startswith("IND:") or k.startswith("BR:"))] for s in BUCKET}
perf = {s: {"ytd": float(bars(s).c.iloc[-1] / bars(s).c[bars(s).c.index < "2026-01-01"].iloc[-1] - 1) * 100, "one_year": float(bars(s).c.iloc[-1] / bars(s).c.iloc[-253] - 1) * 100, "day": float(bars(s).c.iloc[-1] / bars(s).c.iloc[-2] - 1) * 100, "rsi": float(rsi_series(bars(s).c.values)[-1]), "geiger": live.get(s, {}).get("composite")} for s in BUCKET + ["IGV", "SKYY", "XLK", "QQQ"]}
ewc = (1 + bucket_ew).cumprod(); perf["BUCKET_EW"] = {"ytd": float(ewc.iloc[-1] / ewc[ewc.index < "2026-01-01"].iloc[-1] - 1) * 100, "one_year": float(ewc.iloc[-1] / ewc.iloc[-253] - 1) * 100 if len(ewc) > 253 else None, "day": float(bucket_ew.iloc[-1] * 100)}
# pairwise co-movement inside the bucket: is it one bucket at all?
inner = corr.loc[BUCKET, BUCKET].values; iu = np.triu_indices(len(BUCKET), 1)
out["software"] = {"bucket": BUCKET, "window": "daily returns since 2024-09-01", "fund_corr": fund_corr, "best_fund": best, "mean_pairwise_corr_inside": float(inner[iu].mean()), "min_pairwise": float(inner[iu].min()), "cohorts": cohorts, "perf": perf,
    "tree_note": "In the 24 Sep taxonomy all nine sit in the branch BR:AI_SOFTWARE; by industry they split: Software–Application (APP, CRM, LYFT, SHOP, SNOW), Software–Infrastructure (MDB, ORCL), Entertainment (NFLX), Capital Markets (HOOD)."}
save_json("q5-names.json", out)
# ---- charts
f, axs = C.fig(14, 5.2, 1, 2); c = bars("VST").c.loc["2023-01-01":]; axs[0].plot(c.index, c, color=C.LINE, lw=0.9); axs[0].plot(c.index, c.rolling(200).mean(), color=C.LINE2, lw=0.8, ls="--")
for r_ in out["vst"]["earnings"][-10:]:
    d = pd.Timestamp(r_["date"]); 
    if d >= c.index[0]: axs[0].plot([d], [c.reindex([d], method="nearest").iloc[0]], "o", color=C.UP if r_["surprise_pct"] >= 0 else C.DN, ms=6)
axs[0].set_ylabel("VST"); axs[0].grid(axis="y"); C.title(axs[0], f"VST since 2023: {s and out['vst']['state']['drawdown_from_252d_high']:.0f}% under its year high, {'below' if out['vst']['state']['below_200d'] else 'above'} its 200-day (dashed)", "dots = earnings reports: green beat, red miss (FMP export)")
labs, vals = [], []
for thr, g in knives.items():
    for h in ("63", "126", "252"): labs.append(f"{thr}% {h}d\nn{g['h'][h]['n']}"); vals.append(g["h"][h]["median"] if g["h"][h]["median"] is not None else np.nan)
axs[1].bar(labs, vals, color=C.updown_color([0 if v != v else v for v in vals])); axs[1].axhline(knives["-20"]["h"]["63"]["base_median"], color=C.DIM, ls="--", lw=0.8); axs[1].grid(axis="y"); axs[1].tick_params(axis="x", labelsize=8); axs[1].set_ylabel("median next return, %")
C.title(axs[1], "VST's own falling-knife history: what followed each time it sat 20/30/40% under its year high", "few episodes (its history starts 2017) · dashed = any day, 63 sessions")
C.save(f, os.path.join(OUT, "charts", "q5-1-vst.png"))
f, ax = C.fig(14, 5); M = [[fund_corr[s][f_] for f_ in FUNDS] for s in BUCKET + ["BUCKET_EW"]]; C.heat(ax, M, FUNDS, BUCKET + ["bucket EW"], fmt="{:.2f}", vmin=0, vmax=1, center=0.5)
C.title(ax, "Which fund moves with the software bucket? correlation of daily returns since Sep 2024", f"bucket names move together at {out['software']['mean_pairwise_corr_inside']:.2f} on average · best fund for the equal-weight bucket: {best['BUCKET_EW']}")
C.save(f, os.path.join(OUT, "charts", "q5-2-software-bucket.png"))
f, ax = C.fig(14, 4.8); c = bars("ORCL").c.loc["2025-06-01":]; ax.plot(c.index, c, color=C.LINE, lw=0.9); ax.plot(c.index, c.rolling(200).mean().reindex(c.index), color=C.LINE2, lw=0.8, ls="--"); ax.plot([c.index[-1]], [c.iloc[-1]], "o", color=C.DN, ms=7); ax.grid(axis="y")
C.title(ax, f"ORCL: {out['orcl']['state']['day_pct']:+.1f}% today ({out['orcl']['state']['x_usual']:.1f}× its usual day), {out['orcl']['state']['drawdown_from_252d_high']:.0f}% under its year high, RSI {out['orcl']['state']['rsi']:.0f}", "dashed = 200-day")
C.save(f, os.path.join(OUT, "charts", "q5-3-orcl.png"))
print(json.dumps(out["vst"]["state"], indent=0)); print("knife", {k: (v["episodes"], v["dates"], v["h"]["63"]["values"], v["further_fall_values"]) for k, v in knives.items()}); print(json.dumps(out["vst"]["earnings_summary"], indent=0)[:1500])
print(json.dumps(out["orcl"]["state"], indent=0)); print({k: (v["episodes"], round(v["h"]["21"]["median"], 2), v["h"]["21"]["share_up"]) for k, v in after.items()})
print("best fund", best, "inner corr", out["software"]["mean_pairwise_corr_inside"]); print(cohorts); print({k: {kk: round(vv, 1) if isinstance(vv, float) else vv for kk, vv in v.items()} for k, v in perf.items()})
