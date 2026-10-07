# PF1 · the yardsticks: buy and hold, a plain 60/40, Treasury bills, and "cash by default" as the allocation tool's own
# ladder actually read it over the last two years (the July heat ladder and R4's two dials, both replayed by earlier lanes).
import json, os
import pandas as pd
import pf1lib as L

D = L.load(); out = {"structure": "baselines", "variants": []}
for sym in ["SPY", "QQQ"]:
    out["variants"].append(L.report(L.fixed_mix(D, {sym: 1.0}, monthly=False, name=sym), D, f"Buy and hold {sym}", "bought once on 3 Jan 2005 and never touched"))
out["variants"].append(L.report(L.fixed_mix(D, {"SPY": 0.6, "IEF": 0.4}, name="60/40"), D, "60/40 (SPY / 7-10y Treasuries)", "rebalanced at month end when more than 2 points off"))
out["variants"].append(L.report(L.fixed_mix(D, {}, monthly=False, name="bills"), D, "All cash (Treasury bills)", "the 3-month bill yield, nothing else"))

# "cash by default": the tool's own percent-invested, applied to SPY, the rest in bills. Two years only — that is all the replay covers.
R = json.load(open(os.path.join(L.DATA, "tool-replay.json"))); s = pd.DataFrame(R["series"]).set_index("date")
for col, label, note in [("heatRung", "Cash by default — the July heat ladder", "the allocation tool's own heat ladder as HEAT1 replayed it: percent invested per session, held in SPY, the rest in bills"),
                         ("twoDial", "R4's two dials (REGIME + STRETCH)", "R4's proposed percent invested per session, held in SPY, the rest in bills")]:
    sim = L.from_exposure(D, (s[col] / 100.0).to_dict(), name=col)
    r = L.report(sim, D, label, note); r["full"] = None; r["curve_full"] = None; r["stress"] = {}
    r["rung_days"] = {str(k): int(v) for k, v in s[col].value_counts().sort_index().items()} if col == "heatRung" else None
    out["variants"].append(r)

# the ladder taken apart: the same AVERAGE share in SPY held flat (rebalanced monthly). The gap between this and the ladder is
# what the ladder's timing added; the gap between this and buy-and-hold is what its low average share cost.
avg = round(float(s["heatRung"].mean()) / 100.0, 4)
r = L.report(L.fixed_mix(D, {"SPY": avg}, start=L.LAST2[0], end=L.LAST2[1], name="flat"), D, "A flat share in SPY equal to the ladder's average", f"{avg * 100:.1f}% in SPY, the rest in bills, rebalanced monthly; two years only")
r["full"] = None; r["curve_full"] = None; r["stress"] = {}; r["flat_share_pct"] = round(avg * 100, 1); out["variants"].append(r)

# checks the page quotes: SPY's calendar-year total returns from our bars + dividends, against the published figures
pub = {"2008": -36.8, "2013": 32.3, "2019": 31.2, "2020": 18.4, "2021": 28.7, "2022": -18.2, "2023": 26.2, "2024": 24.9}
ours = out["variants"][0]["years"]; out["spy_year_check"] = [{"year": y, "ours": ours[y], "published": p, "gap": round(ours[y] - p, 1)} for y, p in pub.items()]
out["pullbacks_last2"] = L.pullbacks(D); out["breakouts_last2"] = L.breakouts()
L.save("s0_baselines.json", out)
for v in out["variants"]:
    f, l = v["full"], v["last2"]
    print(f"{v['label'][:44]:44s} FULL " + (f"cagr {f['cagr_pct']:6.2f} dd {f['max_dd_pct']:6.1f} stock {f['avg_stock_pct']:5.1f}" if f else " " * 38) + f" | LAST2 ret {l['total_return_pct']:6.1f} dd {l['max_dd_pct']:6.1f} stock {l['avg_stock_pct']:5.1f} dec/mo {l['decision_days_per_month']}")
print("SPY year check", out["spy_year_check"]); print("pullbacks", out["pullbacks_last2"])
