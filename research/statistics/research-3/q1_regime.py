"""Q1 · the lopsided equal-weight pairs: what the split means, is EW trailing normal, what cap-weight leaders did when breadth swung."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
PAIRS = [("RSP","SPY","S&P 500"),("QQEW","QQQ","Nasdaq-100 (First Trust)"),("QQQE","QQQ","Nasdaq-100 (Direxion)"),("EQAL","IWB","Russell 1000"),
 ("RSPT","XLK","Technology"),("RSPF","XLF","Financials"),("RSPH","XLV","Health care"),("RSPN","XLI","Industrials"),("RSPG","XLE","Energy"),("RSPU","XLU","Utilities"),
 ("RSPS","XLP","Consumer staples"),("RSPD","XLY","Consumer discretionary"),("RSPM","XLB","Materials"),("RSPR","XLRE","Real estate"),("RSPC","XLC","Communication services")]
SECTOR = {"Technology","Financials","Health care","Industrials","Energy","Utilities","Consumer staples","Consumer discretionary","Materials","Real estate","Communication services"}
out = {"asof": ASOF, "pairs": [], "notes": []}
ratios = {}; pct = {}
for ew, cw, label in PAIRS:
    a = long_series(ew); b = long_series(cw)
    if a is None or b is None: out["notes"].append(f"{label}: no series"); continue
    r = (a.c / b.c).dropna(); r = r[r.index >= "2003-01-01"]
    p = pct_rank_prior(r.values); P = pd.Series(p, index=r.index)
    ratios[label] = r; pct[label] = P
    one_year = float(r.iloc[-1] / r.iloc[-253] - 1) * 100 if len(r) > 253 else None
    out["pairs"].append({"label": label, "ew": ew, "cw": cw, "from": str(r.index[0].date()), "to": str(r.index[-1].date()), "n": int(len(r)), "ratio": float(r.iloc[-1]), "pctile": float(P.iloc[-1]),
        "one_year_pct": one_year, "days_since_low": int((r.index[-1] - r.idxmin()).days), "low_date": str(r.idxmin().date()), "high_date": str(r.idxmax().date())})
tbl = sorted(out["pairs"], key=lambda x: x["pctile"])
print("pairs today:"); [print(f"  {t['label']:28s} {t['pctile']:6.1f}th  1y {t['one_year_pct']:+.1f}%  to {t['to']}") for t in tbl]
# ---- the split among sector pairs: every day, highest minus lowest own-history percentile; and 'both tails' (one ≤5th and one ≥95th)
Pdf = pd.DataFrame({k: v for k, v in pct.items() if k in SECTOR}).dropna(thresh=8)
split = (Pdf.max(1) - Pdf.min(1)); both = ((Pdf.min(1) <= 5) & (Pdf.max(1) >= 95)).astype(int); n_pairs = Pdf.notna().sum(1)
spy = bars("SPY").c; rsp = bars("RSP").c; LB, TOP = leaders_basket()
common = split.index.intersection(spy.index)
S = pd.DataFrame({"split": split, "both": both, "n_pairs": n_pairs}).loc[common]
S["spy"] = spy.loc[common]; S["rsp"] = rsp.loc[common]
lb_cum = (1 + LB).cumprod() if LB is not None else None
if lb_cum is not None: S["lead"] = lb_cum.reindex(common).ffill()
for h in (21, 63, 126, 252):
    S[f"spy_f{h}"] = fwd(S.spy.values, h); S[f"ew_minus_cw_f{h}"] = fwd(S.rsp.values, h) - fwd(S.spy.values, h)
    if "lead" in S: S[f"lead_minus_spy_f{h}"] = fwd(S.lead.values, h) - fwd(S.spy.values, h)
today_split = float(S.split.iloc[-1]); split_pct = float(pct_rank_prior(S.split.values)[-1])
print(f"sector split today {today_split:.1f} points ({split_pct:.1f}th of its own history, n_pairs {int(S.n_pairs.iloc[-1])}); both-tails days share {S.both.mean()*100:.1f}%")
def study(mask, name, horizons=(21, 63, 126, 252)):
    eps = episodes(mask.values); res = {"name": name, "days": int(mask.sum()), "episodes": len(eps), "dates": [str(S.index[i].date()) for i in eps][-12:], "h": {}}
    for h in horizons:
        for col in (f"spy_f{h}", f"ew_minus_cw_f{h}", f"lead_minus_spy_f{h}"):
            if col not in S: continue
            v = S[col].values[eps]; v = v[np.isfinite(v)]; base = S[col].values; base = base[np.isfinite(base)]
            est, lo, hi, dr = boot(v, horizon=h, reps=600) if len(v) >= 3 else (np.nan, np.nan, np.nan, np.array([]))
            res["h"].setdefault(str(h), {})[col.split("_f")[0]] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None,
                "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": boot_p(dr, float(np.median(base)))}
    return res
out["split"] = {"today": today_split, "pctile": split_pct, "history_from": str(S.index[0].date()), "n_days": int(len(S)),
    "studies": [study(S.split >= np.nanquantile(S.split, 0.95), "split in its top 5%"), study(S.both == 1, "one pair ≤5th and one ≥95th at once"),
                study(S.split >= today_split, f"split at or above today's ({today_split:.0f} points)")]}
# ---- is EW trailing the normal state?  RSP ÷ SPY since 2003: rolling one-year change, share of days behind, today's own percentile
r = ratios["S&P 500"]; ch252 = (r / r.shift(252) - 1) * 100; ch252 = ch252.dropna()
out["ew_normal"] = {"share_of_days_ew_behind_1y": float((ch252 < 0).mean()), "share_since_2015": float((ch252[ch252.index >= "2015-01-01"] < 0).mean()), "share_2003_2014": float((ch252[ch252.index < "2015-01-01"] < 0).mean()),
    "today_1y_change": float(ch252.iloc[-1]), "today_1y_pctile": float(pct_rank_prior(ch252.values)[-1]), "median_1y_change": float(ch252.median()),
    "worst_1y": float(ch252.min()), "worst_1y_date": str(ch252.idxmin().date()), "ratio_today": float(r.iloc[-1]), "ratio_pctile": float(pct["S&P 500"].iloc[-1]),
    "ratio_2003": float(r.iloc[0]), "ratio_peak": float(r.max()), "ratio_peak_date": str(r.idxmax().date())}
# after the ratio's own bottom-5% entries: next year for SPY, EW−CW, leaders−SPY (63-session refractory)
R = pd.DataFrame({"spy": spy, "rsp": rsp}).loc[r.index.intersection(spy.index)]; R["pct"] = pct["S&P 500"].reindex(R.index)
if lb_cum is not None: R["lead"] = lb_cum.reindex(R.index).ffill()
for h in (63, 126, 252):
    R[f"spy_f{h}"] = fwd(R.spy.values, h); R[f"ew_minus_cw_f{h}"] = fwd(R.rsp.values, h) - fwd(R.spy.values, h)
    if "lead" in R: R[f"lead_minus_spy_f{h}"] = fwd(R.lead.values, h) - fwd(R.spy.values, h)
low = (R.pct <= 5).values; eps = []; last = -999
for i in range(len(low)):
    if low[i] and i - last > 63: eps.append(i); last = i
ent = {"episodes": len(eps), "dates": [str(R.index[i].date()) for i in eps], "h": {}}
for h in (63, 126, 252):
    for col in (f"spy_f{h}", f"ew_minus_cw_f{h}", f"lead_minus_spy_f{h}"):
        if col not in R: continue
        v = R[col].values[eps]; v = v[np.isfinite(v)]; base = R[col].values; base = base[np.isfinite(base)]
        ent["h"].setdefault(str(h), {})[col.split("_f")[0]] = {"n": int(len(v)), "median": float(np.median(v)) if len(v) else None, "values": [round(float(x), 1) for x in v], "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean())}
out["ratio_bottom5_entries"] = ent
# ---- cap-weight leaders when breadth swung: down days where EW fell less (today's pattern) vs days where EW fell more
D = pd.DataFrame({"spy": spy, "rsp": rsp}).dropna(); D["r_spy"] = D.spy.pct_change() * 100; D["r_rsp"] = D.rsp.pct_change() * 100; D["gap"] = D.r_rsp - D.r_spy
if lb_cum is not None: D["lead"] = lb_cum.reindex(D.index).ffill(); D["r_lead"] = D.lead.pct_change() * 100
for h in (5, 21, 63):
    D[f"spy_f{h}"] = fwd(D.spy.values, h); D[f"ew_minus_cw_f{h}"] = fwd(D.rsp.values, h) - fwd(D.spy.values, h)
    if "lead" in D: D[f"lead_minus_spy_f{h}"] = fwd(D.lead.values, h) - fwd(D.spy.values, h)
down = D.r_spy <= -0.5
groups = {"down day, EW fell less by ≥0.15 (today's shape)": down & (D.gap >= 0.15), "down day, EW fell more by ≥0.15": down & (D.gap <= -0.15), "any down day ≤ −0.5%": down}
sw = {"today": {"spy": float(D.r_spy.iloc[-1]), "rsp": float(D.r_rsp.iloc[-1]), "gap": float(D.gap.iloc[-1]), "lead": float(D.r_lead.iloc[-1]) if "r_lead" in D else None},
      "share_of_down_days_ew_fell_less": float(((D.gap >= 0.15) & down).sum() / down.sum()), "groups": {}}
for name, m in groups.items():
    g = {"days": int(m.sum()), "h": {}}
    for h in (5, 21, 63):
        for col in (f"spy_f{h}", f"ew_minus_cw_f{h}", f"lead_minus_spy_f{h}"):
            if col not in D: continue
            v = D[col].values[m.values]; v = v[np.isfinite(v)]; base = D[col].values; base = base[np.isfinite(base)]
            est, lo, hi, dr = boot(v, horizon=h, reps=400)
            g["h"].setdefault(str(h), {})[col.split("_f")[0]] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()), "base_median": float(np.median(base)), "p": boot_p(dr, float(np.median(base)))}
    sw["groups"][name] = g
# leaders on the swing day itself: did the heavy names sell off?  distribution of leaders − SPY on those days
if "r_lead" in D:
    m = groups["down day, EW fell less by ≥0.15 (today's shape)"]; v = (D.r_lead - D.r_spy)[m].dropna()
    sw["leaders_minus_spy_on_such_days"] = {"median": float(v.median()), "share_leaders_worse": float((v < 0).mean()), "n": int(len(v))}
# rolling-20-session breadth swing (RSP−SPY 20d gap in its top 5%) → leaders next 21/63
D["gap20"] = (D.rsp / D.rsp.shift(20) - D.spy / D.spy.shift(20)) * 100; q95 = D.gap20.quantile(0.95); m = D.gap20 >= q95
eps = episodes(m.values); g = {"threshold_pts": float(q95), "episodes": len(eps), "today_gap20": float(D.gap20.iloc[-1]), "h": {}}
for h in (21, 63):
    for col in (f"spy_f{h}", f"lead_minus_spy_f{h}"):
        if col not in D: continue
        v = D[col].values[eps]; v = v[np.isfinite(v)]; base = D[col].values; base = base[np.isfinite(base)]
        est, lo, hi, dr = boot(v, horizon=h, reps=400); g["h"].setdefault(str(h), {})[col.split("_f")[0]] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "base_median": float(np.median(base)), "p": boot_p(dr, float(np.median(base)))}
sw["breadth_swing_20d"] = g; out["swing"] = sw
save_json("q1-regime.json", out)
# ---- charts
f, ax = C.fig(14, 5.2); labs = [t["label"] for t in tbl]; vals = [t["pctile"] for t in tbl]
ax.barh(labs, vals, color=[C.DN if v <= 5 else (C.UP if v >= 95 else C.LINE2) for v in vals]); ax.axvline(5, color=C.DN, lw=0.8, ls="--"); ax.axvline(95, color=C.UP, lw=0.8, ls="--"); ax.set_xlim(0, 100); ax.grid(axis="x"); ax.invert_yaxis()
for i, t in enumerate(tbl): ax.text(min(vals[i] + 1, 88), i, f"{vals[i]:.1f}th · 1y {t['one_year_pct']:+.1f}%", va="center", fontsize=9, family="monospace", color=C.TXT)
C.title(ax, "Equal weight ÷ cap weight, every pair: where today sits in its own history (percentile, prior days only)", f"{ASOF} close · red = bottom 5% · green = top 5% · FMP history under today's tickers stitched to the chart API")
C.save(f, os.path.join(OUT, "charts", "q1-1-pairs-today.png"))
f, ax = C.fig(14, 5.2); ax.plot(S.index, S.split, color=C.LINE, lw=0.8); ax.axhline(today_split, color=C.UP, lw=0.8, ls="--"); ax.fill_between(S.index, 0, 100, where=S.both == 1, color=C.DN, alpha=0.25, lw=0)
ax.set_ylabel("highest − lowest sector-pair percentile"); ax.grid(axis="y"); C.title(ax, f"The split between the strongest and weakest sector pair: today {today_split:.0f} points ({split_pct:.0f}th of its history)", "red bands = at least one pair in its bottom 5% while another sits in its top 5% (today's combination)")
C.save(f, os.path.join(OUT, "charts", "q1-2-sector-split.png"))
f, ax = C.fig(14, 5.2); ax.plot(r.index, r / r.iloc[0], color=C.LINE, lw=0.9); ax2 = ax.twinx(); ax2.plot(pct["S&P 500"].index, pct["S&P 500"], color=C.LINE2, lw=0.5, alpha=0.7); ax2.set_ylim(0, 100); ax2.set_ylabel("own percentile", color=C.DIM)
ax.set_ylabel("RSP ÷ SPY, 2003 = 1"); ax.grid(axis="y"); C.title(ax, "Equal weight against cap weight since 2003: it rose until 2007, held to 2013–14, and has fallen since", f"today's ratio is at the {out['ew_normal']['ratio_pctile']:.1f}th percentile of its own past · one-year change {out['ew_normal']['today_1y_change']:+.1f}% ({out['ew_normal']['today_1y_pctile']:.0f}th)")
C.save(f, os.path.join(OUT, "charts", "q1-3-rsp-spy.png"))
f, axs = C.fig(14, 5.2, 1, 3)
for k, (col, ttl) in enumerate([("spy", "SPY, next %"), ("ew_minus_cw", "equal minus cap weight, points"), ("lead_minus_spy", "top-20 leaders minus SPY, points")]):
    labs, est, lo, hi, base = [], [], [], [], None
    for name, g in sw["groups"].items():
        for h in (21, 63):
            c = g["h"][str(h)].get(col)
            if not c: continue
            labs.append(f"{name.split(',')[1].strip()[:14] if ',' in name else 'any'}\n{h}d"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"]); base = c["base_median"]
    C.range_bars(axs[k], labs, est, lo, hi, base=base, ylabel=ttl); axs[k].tick_params(axis="x", labelsize=8)
    C.title(axs[k], ttl, "down days ≤ −0.5%: EW fell less (today) · EW fell more · any")
C.save(f, os.path.join(OUT, "charts", "q1-4-after-swing-days.png"))
print(json.dumps(out["ew_normal"], indent=0)); print("swing", json.dumps(sw["groups"]["down day, EW fell less by ≥0.15 (today's shape)"]["h"]["21"], indent=0)); print("split studies", [(s["name"], s["episodes"], s["h"]["63"]["spy"]) for s in out["split"]["studies"]])
