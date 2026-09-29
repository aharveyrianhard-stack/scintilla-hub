"""Q2 · Geiger mechanics: why it moved today while SPY fell 0.7%, its own-history percentile, the opposite corner, futures vs SPY/QQQ."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
out = {"asof": ASOF, "weights": TFW}
H = geiger_history("SPY"); Q = geiger_history("QQQ")
# ---- 1 · today's path: evaluate the composite each time a rung's bar finished on 28 Sep (what the publisher would have shown at that moment)
R = {k: bars("SPY", TOKEN[k]) for k in TFW}; F = {k: rung_series_fast(R[k]) for k in TFW}
def at(ts):
    readings = {}
    for k in TFW:
        j = F[k].index.searchsorted(ts, side="right") - 1
        if j >= 0: readings[k] = {"composite": F[k].composite.iloc[j], "trend": F[k].trend.iloc[j], "momentum": F[k].momentum.iloc[j]}
    return readings
stamps = sorted(set([pd.Timestamp("2026-09-25 23:59")] + [t for k in ("3h", "4h", "6h", "12h", "1d") for t in F[k].index if t >= pd.Timestamp("2026-09-28")]))
path = []
prev = None
for ts in stamps:
    rd = at(ts); agg = composite(rd)
    row = {"stamp_utc": str(ts)[:16], "composite": agg["composite"], "trend": agg["trend"], "momentum": agg["momentum"], "rungs": {k: rd[k]["composite"] for k in TFW}}
    if prev: row["change"] = agg["composite"] - prev["composite"]; row["pieces"] = {k: TFW[k] / sum(TFW.values()) * (rd[k]["composite"] - prev["rungs"][k]) for k in TFW}
    path.append(row); prev = row
out["today_path"] = path
for p in path: print(p["stamp_utc"], round(p["composite"], 3), {k: round(v, 2) for k, v in p["rungs"].items()}, {k: round(v, 3) for k, v in p.get("pieces", {}).items() if abs(v) > 0.005})
# how much of the weight sits on rungs that finish inside a day
intra = sum(TFW[k] for k in ("3h", "4h", "6h")); out["intraday_weight_share"] = intra / sum(TFW.values()); out["with_12h"] = (intra + TFW["12h"]) / sum(TFW.values())
# ---- 2 · the composite's day-to-day change vs SPY's daily move: typical size, today's rank, how much of the change SPY's return explains
H["dc"] = H.composite.diff(); H["r"] = H.close.pct_change() * 100
h = H.dropna(subset=["dc", "r"]); h = h[h.index >= "2013-07-01"]   # all seven rungs exist from mid-2013 (3h bars)
slope, icpt = np.polyfit(h.r, h.dc, 1); r2 = np.corrcoef(h.r, h.dc)[0, 1] ** 2
today_dc = float(H.dc.iloc[-1]); out["change"] = {"today": today_dc, "median_abs_change": float(h.dc.abs().median()), "pctile_of_abs_change": float((h.dc.abs() <= abs(today_dc)).mean() * 100),
    "slope_per_1pct": float(slope), "r2": float(r2), "expected_from_spy_move": float(icpt + slope * H.r.iloc[-1]), "share_of_days_change_beyond_0_3": float((h.dc.abs() >= 0.3).mean()),
    "after_up_day_share_falls": float((h.dc[h.r > 0] < 0).mean()), "n": int(len(h))}
# ---- 3 · own-history percentile: distribution since 2013 (7 rungs) and since 2004 (fewer rungs early), and where +0.29 sits
full = H.composite.dropna(); p_all = pct_rank_prior(full.values); seven = full[full.index >= "2013-07-01"]
out["percentile"] = {"today": float(full.iloc[-1]), "pctile_prior_all": float(p_all[-1]), "pctile_since_2013": float((seven.values[:-1] <= full.iloc[-1]).mean() * 100),
    "quantiles_since_2013": {str(q): float(np.quantile(seven, q / 100)) for q in (1, 5, 10, 25, 50, 75, 90, 95, 99)}, "share_above_zero": float((seven > 0).mean()), "friday": float(full.iloc[-2]), "friday_pctile": float((seven.values[:-2] <= full.iloc[-2]).mean() * 100),
    "qqq_today": float(Q.composite.iloc[-1]), "qqq_pctile": float((Q.composite.dropna()[Q.index >= "2013-07-01"].values[:-1] <= Q.composite.iloc[-1]).mean() * 100)}
# what followed by composite decile (SPY next 21/63) — the base-rate map for reading the number
for hh in (21, 63): H[f"f{hh}"] = fwd(H.close.values, hh)
dec = pd.cut(seven, np.quantile(seven, np.linspace(0, 1, 11)), labels=False, include_lowest=True)
rows = []
for d in range(10):
    m = (dec == d).values; sub = H.loc[seven.index[m]]
    rows.append({"decile": d + 1, "lo": float(np.quantile(seven, d / 10)), "hi": float(np.quantile(seven, (d + 1) / 10)), "n": int(m.sum()), "f21": float(np.nanmedian(sub.f21)), "f63": float(np.nanmedian(sub.f63)), "up21": float((sub.f21 > 0).mean())})
out["deciles"] = rows; out["base"] = {"f21": float(np.nanmedian(H.f21[H.index >= "2013-07-01"])), "f63": float(np.nanmedian(H.f63[H.index >= "2013-07-01"]))}
# ---- 4 · the opposite corner: weak trend + rising momentum, in rising vs falling markets. Daily rung only (long, clean), on SPY/QQQ/IWM/DIA plus every equity in the cache.
def corner_study(sym, D=None):
    D = D if D is not None else bars(sym); G = rung_series_fast(D); c = D.c.values; sma200 = pd.Series(c).rolling(200).mean().values
    T = pd.DataFrame({"trend": G.trend, "mom": G.momentum, "close": c, "rising": c > sma200}, index=D.index)
    T["mom5"] = T.mom - T.mom.shift(5); T["f21"] = fwd(c, 21); T["f63"] = fwd(c, 63)
    T = T.dropna(subset=["trend"])
    corner = (T.trend <= -0.5) & (T.mom5 >= 0.25) & (T.mom > T.trend)
    strong_weak = (T.trend >= 0.5) & (T.mom <= -0.25)
    return T, corner, strong_weak
res = {}
pool = {"corner_rising": [], "corner_falling": [], "base_rising": [], "base_falling": [], "sw_rising": [], "sw_falling": []}
syms = [s[:-5] for s in os.listdir(os.path.join(SCRATCH, "bars")) if s.endswith(".json") and s[:-5] not in ("VIX", "US10Y", "DXUSD", "ES", "PCC", "PCCE", "PCCI")]
for sym in syms:
    try: T, corner, sw = corner_study(sym)
    except Exception as e: continue
    for reg, m in (("rising", T.rising), ("falling", ~T.rising)):
        for name, mm in (("corner", corner), ("base", pd.Series(True, index=T.index)), ("sw", sw)):
            eps = episodes((mm.reindex(T.index).fillna(False) & m).values) if name != "base" else np.flatnonzero(m.values)
            v = T.f21.values[eps]; v = v[np.isfinite(v)]; pool[f"{name}_{reg}"].append(pd.Series(v, index=T.index[eps][np.isfinite(T.f21.values[eps])]))
    if sym in ("SPY", "QQQ", "IWM", "DIA"):
        r = {}
        for reg, m in (("rising", T.rising), ("falling", ~T.rising)):
            eps = episodes((corner & m).values); v = T.f21.values[eps]; v = v[np.isfinite(v)]; base = T.f21[m].dropna().values
            est, lo, hi, dr = boot(v, horizon=21, reps=400) if len(v) >= 3 else (np.nan, np.nan, np.nan, np.array([]))
            r[reg] = {"episodes": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None, "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": boot_p(dr, float(np.median(base)))}
        res[sym] = r
# pooled across names: date-block bootstrap on the pooled episodes (each row = one name-episode, blocks by date)
pooled = {}
for key, lst in pool.items():
    s = pd.concat(lst).sort_index() if lst else pd.Series(dtype=float); v = s.values
    est, lo, hi, dr = boot(v, horizon=21, reps=300) if len(v) > 10 else (np.nan, np.nan, np.nan, np.array([]))
    pooled[key] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None}
for reg in ("rising", "falling"):
    for name in ("corner", "sw"):
        b = pooled[f"base_{reg}"]["median"]; dr = boot(pd.concat(pool[f"{name}_{reg}"]).sort_index().values, horizon=21, reps=300)[3] if pool[f"{name}_{reg}"] else np.array([])
        pooled[f"{name}_{reg}"]["p_vs_base"] = boot_p(dr, b)
out["corner"] = {"definition": "daily rung: TREND ≤ −0.5 (at most 2 of 8 fan pairs in order) AND MOMENTUM up ≥ 0.25 over 5 sessions AND momentum above trend; strong-weak = TREND ≥ +0.5 AND MOMENTUM ≤ −0.25. Rising market = close above its own 200-day average. Outcome = next 21 sessions, %.", "indexes": res, "pooled": pooled, "names": len(syms)}
# ---- 5 · futures: replay ESUSD / NQUSD with their own rung histories; how many fan lines each rung had; the gap by rung against SPY / QQQ
fut = {}
for f_sym, cash in (("ESUSD", "SPY"), ("NQUSD", "QQQ")):
    rd = {}; info = {}
    for k in TFW:
        df = bars(f_sym, TOKEN[k]); r = rung(df.c.values, df.h.values, df.l.values); rd[k] = r
        dc = bars(cash, TOKEN[k]); rc = rung(dc.c.values, dc.h.values, dc.l.values)
        info[k] = {"fut_bars": int(len(df)), "fut_fan_lines": r["fan_lines"], "fut_composite": r["composite"], "fut_trend": r["trend"], "fut_momentum": r["momentum"], "fut_rsi": r["rsi"], "fut_newest": str(df.index[-1])[:16],
                   "cash_composite": rc["composite"], "cash_trend": rc["trend"], "cash_momentum": rc["momentum"], "cash_fan_lines": rc["fan_lines"], "weight": TFW[k], "history_from": str(df.index[0])[:10]}
    agg = composite(rd); fut[f_sym] = {"composite": agg["composite"], "trend": agg["trend"], "momentum": agg["momentum"], "cash": cash, "rungs": info}
    # same futures, daily rung alone vs the cash daily rung, over the last 250 sessions: how far apart do they usually sit?
    Gd = rung_series_fast(bars(f_sym, "D")).composite; Gc = rung_series_fast(bars(cash, "D")).composite
    both = pd.DataFrame({"f": Gd, "c": Gc}).dropna().tail(250); fut[f_sym]["daily_rung_gap_median_abs_250d"] = float((both.f - both.c).abs().median()); fut[f_sym]["daily_rung_gap_today"] = float(both.f.iloc[-1] - both.c.iloc[-1])
out["futures"] = fut
for s, v in fut.items(): print(s, round(v["composite"], 3), "cash", v["cash"], {k: (i["fut_fan_lines"], i["fut_bars"], round(i["fut_composite"], 2), round(i["cash_composite"], 2)) for k, i in v["rungs"].items()})
save_json("q2-geiger.json", out)
# ---- charts
f, ax = C.fig(14, 5.6); seven.plot(ax=ax, color=C.LINE, lw=0.6); ax.axhline(0, color=C.DIM, lw=0.6)
for q, ls in ((5, ":"), (25, "--"), (75, "--"), (95, ":")): ax.axhline(np.quantile(seven, q / 100), color=C.LINE2, lw=0.7, ls=ls); ax.text(seven.index[0], np.quantile(seven, q / 100), f" {q}th", color=C.DIM, fontsize=8, va="bottom")
ax.plot([seven.index[-1]], [seven.iloc[-1]], "o", color=C.DN, ms=7); ax.set_ylabel("SPY Geiger composite, −1..+1"); ax.grid(axis="y")
C.title(ax, f"SPY's Geiger replayed at every close since 2013 (all seven rungs): today +{seven.iloc[-1]:.2f} sits at the {out['percentile']['pctile_since_2013']:.0f}th percentile", "Alan's Equalizer weights · the publisher's exact maths · dotted 5/95th, dashed 25/75th")
C.save(f, os.path.join(OUT, "charts", "q2-1-composite-history.png"))
f, axs = C.fig(14, 5, 1, 2); axs[0].hist(seven, bins=60, color=C.LINE2); axs[0].axvline(seven.iloc[-1], color=C.DN, lw=1.5); axs[0].axvline(full.iloc[-2], color=C.UP, lw=1.2, ls="--"); axs[0].set_xlabel("composite"); axs[0].set_ylabel("sessions"); C.title(axs[0], "Where +0.29 sits: the shape of the composite's own history", "red = today · green dashed = Friday's +0.66")
axs[1].scatter(h.r, h.dc, s=4, color=C.LINE2, alpha=0.5); xs = np.linspace(-5, 5, 10); axs[1].plot(xs, icpt + slope * xs, color=C.LINE, lw=1); axs[1].plot([H.r.iloc[-1]], [today_dc], "o", color=C.DN, ms=8); axs[1].set_xlim(-5, 5); axs[1].set_xlabel("SPY day, %"); axs[1].set_ylabel("change in composite, close to close"); axs[1].grid(True)
C.title(axs[1], f"A day's move explains only {r2*100:.0f}% of the composite's change", f"slope {slope:+.2f} per 1% · today: SPY {H.r.iloc[-1]:+.2f}% → composite {today_dc:+.2f} (expected {out['change']['expected_from_spy_move']:+.2f})")
C.save(f, os.path.join(OUT, "charts", "q2-2-percentile-and-speed.png"))
f, ax = C.fig(14, 4.8); xs = [p["stamp_utc"][5:] for p in path]; ax.plot(range(len(xs)), [p["composite"] for p in path], "-o", color=C.LINE, lw=1.2)
for k, col in (("3h", C.DN), ("4h", "#B07070"), ("6h", "#8E5C5C"), ("12h", C.LINE2), ("1d", C.UP)): ax.plot(range(len(xs)), [p["rungs"][k] for p in path], lw=0.8, ls="--", color=col, label=k)
ax.set_xticks(range(len(xs))); ax.set_xticklabels(xs, fontsize=8, family="monospace"); ax.axhline(0, color=C.DIM, lw=0.6); ax.legend(ncol=5, loc="lower left"); ax.set_ylabel("reading"); ax.grid(axis="y")
C.title(ax, "28 Sep, bar by bar (UTC): the composite (solid) and the rungs that moved it (dashed)", "each point = the reading the publisher would show once that bar finished · 3h/4h/6h rungs carry 40% of the weight and finish inside the day")
C.save(f, os.path.join(OUT, "charts", "q2-3-today-path.png"))
f, axs = C.fig(14, 5, 1, 2)
for k, (reg, ttl) in enumerate((("rising", "market above its 200-day"), ("falling", "market below its 200-day"))):
    labs, est, lo, hi = [], [], [], []
    for sym in ("SPY", "QQQ", "IWM", "DIA"):
        c = res.get(sym, {}).get(reg)
        if c and c["episodes"] >= 3: labs.append(f"{sym}\nn{c['episodes']}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
    pc = pooled[f"corner_{reg}"]; labs.append(f"all {len(syms)} names\nn{pc['n']}"); est.append(pc["median"]); lo.append(pc["lo"]); hi.append(pc["hi"])
    ps = pooled[f"sw_{reg}"]; labs.append(f"strong+weak\nn{ps['n']}"); est.append(ps["median"]); lo.append(ps["lo"]); hi.append(ps["hi"])
    C.range_bars(axs[k], labs, est, lo, hi, base=pooled[f"base_{reg}"]["median"], ylabel="next 21 sessions, median %"); C.title(axs[k], f"Opposite corner in a {ttl}", "weak trend + momentum turning up · dashed = any day in that regime · bar = 90% block-bootstrap range")
C.save(f, os.path.join(OUT, "charts", "q2-4-opposite-corner.png"))
f, axs = C.fig(14, 4.8, 1, 2)
for k, (fs, cash) in enumerate((("ESUSD", "SPY"), ("NQUSD", "QQQ"))):
    ks = list(TFW); x = np.arange(len(ks)); fv = [fut[fs]["rungs"][r]["fut_composite"] for r in ks]; cv = [fut[fs]["rungs"][r]["cash_composite"] for r in ks]
    axs[k].bar(x - 0.2, fv, 0.4, color=[C.UP if v >= 0 else C.DN for v in fv], label=fs); axs[k].bar(x + 0.2, cv, 0.4, color=[C.UP if v >= 0 else C.DN for v in cv], alpha=0.45, label=cash)
    for i, r in enumerate(ks): axs[k].text(x[i], 1.02, f"{fut[fs]['rungs'][r]['fut_fan_lines']}/{fut[fs]['rungs'][r]['cash_fan_lines']} lines", ha="center", fontsize=8, family="monospace", color=C.DIM)
    axs[k].set_xticks(x); axs[k].set_xticklabels(ks); axs[k].set_ylim(-1.1, 1.15); axs[k].axhline(0, color=C.DIM, lw=0.6); axs[k].legend(loc="lower left"); axs[k].grid(axis="y")
    C.title(axs[k], f"{fs} {fut[fs]['composite']:+.2f} vs {cash} {composite({r: rung(bars(cash, TOKEN[r]).c.values, bars(cash, TOKEN[r]).h.values, bars(cash, TOKEN[r]).l.values) for r in TFW})['composite']:+.2f}, rung by rung", "solid = futures, faint = cash fund · 'lines' = how many of the 9 fan lines the rung could form (futures / cash)")
C.save(f, os.path.join(OUT, "charts", "q2-5-futures-gap.png"))
print("pct", json.dumps(out["percentile"], indent=0)); print("change", json.dumps(out["change"], indent=0)); print("pooled", json.dumps(pooled, indent=0))
