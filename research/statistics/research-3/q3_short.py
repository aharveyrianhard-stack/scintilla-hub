"""Q3 · the short-term adjustment mechanic: put/call 5-day vs one day, today's VIX jump against its own history, and a rule set TO TEST."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
out = {"asof": ASOF}
spy = bars("SPY").c; vix = bars("VIX"); pcc = bars("PCC").c; pcce = bars("PCCE").c; pcci = bars("PCCI").c
# ---- VIX today: Alan's numbers (28 Sep close 16.07 from 14.87, high 16.58); the chart API's daily VIX is to 25 Sep, its 30-minute bars show 16.58 high and 16.10 last bar
VIX_TODAY_CLOSE, VIX_TODAY_HIGH, VIX_PREV = 16.07, 16.58, float(vix.c.iloc[-1])
v = vix.c.copy(); v.loc[pd.Timestamp("2026-09-28")] = VIX_TODAY_CLOSE; chg = v.pct_change() * 100; usual = pd.Series(usual_day(v.values), index=v.index)
today_chg = float(chg.iloc[-1]); ud = float(usual.iloc[-1]); hist = chg.dropna().iloc[:-1]
out["vix"] = {"prev": VIX_PREV, "close": VIX_TODAY_CLOSE, "high": VIX_TODAY_HIGH, "change_pct": today_chg, "usual_day_60": ud, "x_usual": today_chg / ud, "pctile_of_all_changes": float((hist <= today_chg).mean() * 100),
    "pctile_of_up_changes": float((hist[hist > 0] <= today_chg).mean() * 100), "share_of_days_at_least_this_up": float((hist >= today_chg).mean()), "per_year": float((hist >= today_chg).sum() / (len(hist) / 252)),
    "level_pctile_since_1995": float((v.iloc[:-1] <= VIX_TODAY_CLOSE).mean() * 100), "from_1995_n": int(len(hist))}
# what followed VIX jumps like today from a calm level (VIX < 20 the day before): SPY next 1/5/21 and VIX next 5
D = pd.DataFrame({"spy": spy}).join(pd.DataFrame({"vix": v, "chg": chg, "usual": usual}), how="inner")
D["x"] = D.chg / D.usual; D["calm_prev"] = D.vix.shift(1) < 20
for h in (1, 5, 21): D[f"f{h}"] = fwd(D.spy.values, h)
D["vix_f5"] = fwd(D.vix.values, 5)
conds = {"VIX up ≥ 8% from a calm level (<20)": (D.chg >= 8) & D.calm_prev, "VIX up ≥ 2× its usual day, calm level": (D.x >= 2) & D.calm_prev, "VIX up ≥ 8%, any level": D.chg >= 8, "VIX up ≥ 15%, calm level": (D.chg >= 15) & D.calm_prev}
out["vix_after"] = {}
for name, m in conds.items():
    eps = episodes(m.values); g = {"episodes": len(eps), "h": {}}
    for col in ("f1", "f5", "f21", "vix_f5"):
        vals = D[col].values[eps]; vals = vals[np.isfinite(vals)]; base = D[col].dropna().values; hz = int(col[-1]) if col[-1].isdigit() else 5
        est, lo, hi, dr = boot(vals, horizon=hz, reps=400); g["h"][col] = {"n": int(len(vals)), "median": est, "lo": lo, "hi": hi, "share_up": float((vals > 0).mean()), "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": boot_p(dr, float(np.median(base)))}
    out["vix_after"][name] = g
# ---- put/call: one day vs the five-day average; today's (25 Sep print) own percentiles; what followed high/low five-day readings
P = pd.DataFrame({"pcc": pcc, "pcce": pcce, "pcci": pcci}); P["pcc5"] = P.pcc.rolling(5).mean(); P["pcce5"] = P.pcce.rolling(5).mean(); P["pcce20"] = P.pcce.rolling(20).mean()
for c in ("pcc", "pcc5", "pcce", "pcce5", "pcce20"): P[c + "_pct"] = pct_rank_prior(P[c].values)
last = P.dropna().iloc[-1]
out["putcall"] = {"latest_print": str(P.dropna().index[-1].date()), "pcc": float(last.pcc), "pcc_pct": float(last.pcc_pct), "pcc5": float(last.pcc5), "pcc5_pct": float(last.pcc5_pct), "pcce": float(last.pcce), "pcce_pct": float(last.pcce_pct), "pcce5": float(last.pcce5), "pcce5_pct": float(last.pcce5_pct), "pcce20": float(last.pcce20), "pcce20_pct": float(last.pcce20_pct),
    "one_day_noise": {"median_abs_day_change_pcc": float(P.pcc.diff().abs().median()), "median_abs_day_change_pcc5": float(P.pcc5.diff().abs().median()), "autocorr_pcc_1": float(P.pcc.autocorr(1)), "autocorr_pcc5_1": float(P.pcc5.autocorr(1))},
    "hub_28sep_intraday_note": "the Hub's own 28 Sep reader (IBKR running totals, audited by lane putcall-audit) is a separate feed; Cboe's 28 Sep daily print was not yet in the chart API at 23:00Z"}
PD = P.join(pd.DataFrame({"spy": spy}), how="inner")
for h in (5, 21): PD[f"f{h}"] = fwd(PD.spy.values, h)
pc_conds = {"PCC one-day ≥ 90th": PD.pcc_pct >= 90, "PCC five-day ≥ 90th": PD.pcc5_pct >= 90, "PCC five-day ≥ 80th": PD.pcc5_pct >= 80, "PCC five-day ≤ 10th": PD.pcc5_pct <= 10, "equity PCCE 20-day ≤ 20th (froth)": PD.pcce20_pct <= 20, "equity PCCE five-day ≥ 90th": PD.pcce5_pct >= 90}
out["putcall_after"] = {}
for name, m in pc_conds.items():
    eps = episodes(m.values); g = {"episodes": len(eps), "h": {}}
    for h in (5, 21):
        vals = PD[f"f{h}"].values[eps]; vals = vals[np.isfinite(vals)]; base = PD[f"f{h}"].dropna().values
        est, lo, hi, dr = boot(vals, horizon=h, reps=400); g["h"][str(h)] = {"n": int(len(vals)), "median": est, "lo": lo, "hi": hi, "share_up": float((vals > 0).mean()), "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": boot_p(dr, float(np.median(base)))}
    out["putcall_after"][name] = g
# ---- the rule set to test: put/call fear + VIX spike + Geiger speed, every cell tried, Benjamini-Hochberg over all of them
G = geiger_history("SPY"); G["dc"] = G.composite.diff()
X = PD.join(G[["composite", "dc"]], how="inner").join(D[["chg", "x", "calm_prev", "vix"]], how="inner")
X = X[X.index >= "2013-07-01"]
for h in (5, 21): X[f"f{h}"] = fwd(X.spy.values, h)
A = X.pcc5_pct >= 80; A2 = X.pcc5_pct >= 90; B = (X.x >= 2) & X.calm_prev; B2 = X.chg >= 8; Cc = X.dc <= -0.25; C2 = X.dc <= -0.35; Gpos = X.composite > 0
cells = {"A · put/call 5d ≥ 80th": A, "A2 · put/call 5d ≥ 90th": A2, "B · VIX ≥ 2× usual up, calm": B, "B2 · VIX ≥ +8%": B2, "C · Geiger fell ≥ 0.25 in a day": Cc, "C2 · Geiger fell ≥ 0.35 in a day": C2,
    "A & B": A & B, "B & C": B & Cc, "A & C": A & Cc, "A & B & C": A & B & Cc, "B & C, Geiger still > 0 (today's shape)": B & Cc & Gpos, "C & Geiger still > 0": Cc & Gpos, "A2 & B2": A2 & B2, "B2 & C2": B2 & C2}
grid = []; pv = []
for name, m in cells.items():
    eps = episodes(m.values); row = {"rule": name, "episodes": len(eps), "days": int(m.sum())}
    for h in (5, 21):
        vals = X[f"f{h}"].values[eps]; vals = vals[np.isfinite(vals)]; base = X[f"f{h}"].dropna().values
        if len(vals) >= 3: est, lo, hi, dr = boot(vals, horizon=h, reps=400); p = boot_p(dr, float(np.median(base)))
        else: est = lo = hi = np.nan; p = None
        row[f"f{h}"] = {"n": int(len(vals)), "median": est, "lo": lo, "hi": hi, "share_up": float((vals > 0).mean()) if len(vals) else None, "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": p}
        pv.append(p if p is not None else 1.0)
    grid.append(row)
rej, adj = bh(pv, 0.10); k = 0
for row in grid:
    for h in (5, 21): row[f"f{h}"]["bh_pass"] = bool(rej[k]); row[f"f{h}"]["p_adj"] = float(adj[k]); k += 1
today_flags = {"A": bool(A.iloc[-1]), "B": bool(B.iloc[-1]) if np.isfinite(X.x.iloc[-1]) else None, "C": bool(Cc.iloc[-1]), "geiger_change_today": float(X.dc.iloc[-1]), "pcc5_pct_latest": float(X.pcc5_pct.iloc[-1])}
# today's row is the 25 Sep print for put/call joined with the 28 Sep VIX/Geiger by date: recompute today's flags directly
today_flags = {"A_putcall_5d_pct_25sep": float(last.pcc5_pct), "A": bool(last.pcc5_pct >= 80), "B_vix_x_usual": out["vix"]["x_usual"], "B": bool(out["vix"]["x_usual"] >= 2 and VIX_PREV < 20), "C_geiger_change": float(G.dc.iloc[-1]), "C": bool(G.dc.iloc[-1] <= -0.25), "geiger_still_positive": bool(G.composite.iloc[-1] > 0)}
out["rules"] = {"window": "since 2013-07 (all seven Geiger rungs exist)", "tests": len(pv), "bh_q": 0.10, "grid": grid, "today": today_flags,
    "plain": ["A · FEAR: the five-day average of Cboe's total put/call ratio is in the top 20% of its own history.", "B · SPIKE: the VIX rose at least twice its usual day (median absolute daily move, prior 60 sessions) from a level under 20.", "C · SPEED: the SPY Geiger composite fell 0.25 or more from one close to the next.", "Outcome: SPY over the next 5 and 21 sessions, against every day in the same window."]}
save_json("q3-short.json", out)
# ---- charts
f, axs = C.fig(14, 5, 1, 2); axs[0].hist(hist.clip(-30, 40), bins=80, color=C.LINE2); axs[0].axvline(today_chg, color=C.DN, lw=1.5); axs[0].set_xlabel("VIX day-to-day change, %"); axs[0].set_ylabel("days since 1995"); C.title(axs[0], f"Today's VIX jump, +{today_chg:.1f}%: the {out['vix']['pctile_of_all_changes']:.0f}th percentile of all days, {out['vix']['x_usual']:.1f}× its usual day", f"such a day comes about {out['vix']['per_year']:.0f} times a year · usual day now ±{ud:.1f}%")
labs, est, lo, hi = [], [], [], []
for name, g in out["vix_after"].items():
    for col in ("f5", "f21"): c = g["h"][col]; labs.append(f"{name.split('(')[0][:22]}\n{col}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
C.range_bars(axs[1], labs, est, lo, hi, base=None, ylabel="SPY next, median %"); axs[1].tick_params(axis="x", labelsize=7); axs[1].axhline(out["vix_after"]["VIX up ≥ 8%, any level"]["h"]["f5"]["base_median"], color=C.DIM, ls="--", lw=0.8)
C.title(axs[1], "What SPY did after VIX jumps like today's", "dashed = any day (5-session base) · bar = 90% block-bootstrap range")
C.save(f, os.path.join(OUT, "charts", "q3-1-vix-jump.png"))
f, ax = C.fig(14, 4.8); T = P.loc["2024-01-01":]; ax.plot(T.index, T.pcc, color=C.LINE2, lw=0.6, label="one day"); ax.plot(T.index, T.pcc5, color=C.LINE, lw=1.4, label="five-day average"); ax.axhline(P.pcc5.quantile(0.8), color=C.DN, lw=0.8, ls="--"); ax.text(T.index[0], P.pcc5.quantile(0.8), " 80th of five-day", color=C.DN, fontsize=8, va="bottom"); ax.legend(loc="upper left"); ax.grid(axis="y")
C.title(ax, f"Cboe total put/call: one day jumps around, the five-day average is the number to read (latest {last.pcc:.2f} one day, {last.pcc5:.2f} five-day = {last.pcc5_pct:.0f}th)", "one-day median move 0.{:02.0f} vs five-day 0.{:02.0f} · day-to-day correlation {:.2f} vs {:.2f}".format(out["putcall"]["one_day_noise"]["median_abs_day_change_pcc"] * 100, out["putcall"]["one_day_noise"]["median_abs_day_change_pcc5"] * 100, out["putcall"]["one_day_noise"]["autocorr_pcc_1"], out["putcall"]["one_day_noise"]["autocorr_pcc5_1"]))
C.save(f, os.path.join(OUT, "charts", "q3-2-putcall.png"))
f, ax = C.fig(14, 6.2); M = [[r["f5"]["median"], r["f21"]["median"]] for r in grid]; yl = [f"{r['rule']}  (n {r['episodes']})" for r in grid]
C.heat(ax, M, ["next 5", "next 21"], yl, fmt="{:+.1f}", center=0)
for i, r in enumerate(grid):
    for j, h in enumerate((5, 21)):
        if r[f"f{h}"]["bh_pass"]: ax.text(j + 0.38, i - 0.32, "●", color=C.UP, fontsize=9)
C.title(ax, "The rule set TO TEST: median SPY return after each cell, next 5 and 21 sessions (2013 → today)", f"{len(pv)} cells tried · ● = survives the false-discovery check at 10% · base: 5-session {grid[0]['f5']['base_median']:+.2f}%, 21-session {grid[0]['f21']['base_median']:+.2f}%")
C.save(f, os.path.join(OUT, "charts", "q3-3-rule-grid.png"))
print(json.dumps(out["vix"], indent=0)); print(json.dumps(out["putcall"], indent=0)); print("today flags", today_flags)
for r in grid: print(f"{r['rule']:44s} n{r['episodes']:4d}  f5 {r['f5']['median']:+.2f} [{r['f5']['lo']:+.2f},{r['f5']['hi']:+.2f}] p{r['f5']['p']}  f21 {r['f21']['median']:+.2f} [{r['f21']['lo']:+.2f},{r['f21']['hi']:+.2f}] p{r['f21']['p']} bh{r['f21']['bh_pass']}")
