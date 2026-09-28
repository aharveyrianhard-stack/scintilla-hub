"""Q4 · playbook theses to test: financials after the first cut; rate-sensitive washouts when yields turn; Dow vs S&P vs Nasdaq in narrow / rising-rate regimes; WMT & COST defensive or falling knife; leaders below the 200-day that still lead."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
out = {"asof": ASOF}
spy = bars("SPY").c; rsp = bars("RSP").c; y10 = bars("US10Y").c; dia = bars("DIA").c; qqq = bars("QQQ").c
# ---- (a) financials after the first cut of a cycle. Our fund histories start Sep 2003, so 2001 (3 Jan) and the 1995/1998 cuts are outside the data: n = 3.
CUTS = {"2007-09-18": "2007 (50bp, before the crisis)", "2019-07-31": "2019 (25bp, mid-cycle)", "2024-09-18": "2024 (50bp)"}
F = {s: bars(s).c for s in ("XLF", "KRE", "KBE", "IYF")}
paths = {}; rows = []
for d, lab in CUTS.items():
    i = spy.index.searchsorted(pd.Timestamp(d)); rec = {"cut": d, "label": lab}
    for s, ser in F.items():
        j = ser.index.searchsorted(pd.Timestamp(d))
        if j >= len(ser): continue
        path = (ser.iloc[j:j + 253] / ser.iloc[j] - 1) * 100 - (spy.iloc[i:i + 253] / spy.iloc[i] - 1).values[:len(ser.iloc[j:j + 253])] * 100
        paths[(s, d)] = path.values; rec[s] = {str(h): float(path.iloc[h]) if h < len(path) else None for h in (21, 63, 126, 252)}
    rows.append(rec)
# base: XLF − SPY over any 252-session window since 2003 (so the reader sees what 'normal' relative drift looks like)
xr = (F["XLF"] / F["XLF"].shift(252) - 1) * 100 - (spy / spy.shift(252) - 1) * 100; kr = (F["KRE"] / F["KRE"].shift(252) - 1) * 100 - (spy.reindex(F["KRE"].index) / spy.reindex(F["KRE"].index).shift(252) - 1) * 100
out["financials_after_cut"] = {"n": len(CUTS), "not_covered": ["2001-01-03", "1998-09-29", "1995-07-06 (fund histories start Sep 2003)"], "rows": rows,
    "base_xlf_minus_spy_252": {"median": float(xr.dropna().median()), "share_positive": float((xr.dropna() > 0).mean())}, "base_kre_minus_spy_252": {"median": float(kr.dropna().median()), "share_positive": float((kr.dropna() > 0).mean())}}
# ---- (b) rate-sensitive washouts: XLU / XLRE / VNQ / VPU at their bottom-1% RSI (own history, prior days), split by whether the 10-year had already turned down over the prior 10 sessions
wash = {}
for s in ("XLU", "XLRE", "VNQ", "VPU"):
    D = bars(s); c = D.c; r = rsi_series(c.values); p = pct_rank_prior(r); T = pd.DataFrame({"c": c, "rsi": r, "pct": p}, index=D.index)
    T["y10"] = y10.reindex(T.index).ffill(); T["y_chg10"] = T.y10 - T.y10.shift(10); T["y_next21"] = T.y10.shift(-21) - T.y10
    for h in (21, 63): T[f"f{h}"] = fwd(c.values, h)
    m1 = T.pct <= 1; m5 = T.pct <= 5
    res = {"rsi_today": float(T.rsi.iloc[-1]), "rsi_pct_today": float(T.pct.iloc[-1]), "bottom1_rsi_level": float(np.nanquantile(T.rsi.dropna(), 0.01)), "groups": {}}
    for name, m in (("bottom 1%", m1), ("bottom 5%", m5), ("bottom 5%, 10-year already falling (prior 10 sessions)", m5 & (T.y_chg10 < 0)), ("bottom 5%, 10-year still rising", m5 & (T.y_chg10 >= 0)), ("bottom 5%, and yields THEN fell over the next 21 (hindsight, the thesis's best case)", m5 & (T.y_next21 < 0))):
        eps = episodes(m.fillna(False).values); g = {"episodes": len(eps), "h": {}}
        for h in (21, 63):
            v = T[f"f{h}"].values[eps]; v = v[np.isfinite(v)]; base = T[f"f{h}"].dropna().values
            if len(v) >= 3: est, lo, hi, dr = boot(v, horizon=h, reps=400); pp = boot_p(dr, float(np.median(base)))
            else: est, lo, hi, pp = (float(np.median(v)) if len(v) else np.nan), np.nan, np.nan, None
            g["h"][str(h)] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None, "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": pp}
        res["groups"][name] = g
    wash[s] = res
out["washouts"] = wash
# ---- (c) Dow vs S&P vs Nasdaq by regime: narrow = RSP÷SPY fell over 63 sessions (bottom 20% of its 63-day changes); rising rates = 10-year up over 63 sessions (top 20%)
R = pd.DataFrame({"spy": spy, "rsp": rsp, "dia": dia, "qqq": qqq}).dropna(); R["y10"] = y10.reindex(R.index).ffill()
R["narrow63"] = (R.rsp / R.rsp.shift(63)) / (R.spy / R.spy.shift(63)) - 1; R["y63"] = R.y10 - R.y10.shift(63)
R["narrow"] = R.narrow63 <= R.narrow63.quantile(0.2); R["rising"] = R.y63 >= R.y63.quantile(0.8)
for a, b in (("dia", "spy"), ("qqq", "spy"), ("dia", "qqq")): R[f"{a}_{b}_f63"] = fwd(R[a].values, 63) - fwd(R[b].values, 63)
regimes = {"narrow & rising rates (today's kind)": R.narrow & R.rising, "narrow, rates not rising": R.narrow & ~R.rising, "broad (not narrow)": ~R.narrow, "rising rates, any breadth": R.rising, "all days": pd.Series(True, index=R.index)}
dsn = {"today": {"narrow63": float(R.narrow63.iloc[-1]), "narrow_flag": bool(R.narrow.iloc[-1]), "y63_bp": float(R.y63.iloc[-1] * 100), "rising_flag": bool(R.rising.iloc[-1]), "narrow_threshold": float(R.narrow63.quantile(0.2)), "rising_threshold_bp": float(R.y63.quantile(0.8) * 100)}, "regimes": {}}
for name, m in regimes.items():
    g = {"days": int(m.sum()), "pairs": {}}
    for col in ("dia_spy_f63", "qqq_spy_f63", "dia_qqq_f63"):
        v = R[col][m].dropna().values; est, lo, hi, dr = boot(v, horizon=63, reps=300); base = R[col].dropna().values
        g["pairs"][col] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()), "base_median": float(np.median(base)), "p": boot_p(dr, float(np.median(base)))}
    dsn["regimes"][name] = g
out["dow_spx_ndx"] = dsn
# ---- (d) WMT and COST: defensive (what they do on SPY's worst days and months) and falling knife (their own sharp drops)
st = {}
for s in ("WMT", "COST", "XLP"):
    c = bars(s).c; X = pd.DataFrame({"c": c, "spy": spy}).dropna(); X["r"] = X.c.pct_change() * 100; X["rs"] = X.spy.pct_change() * 100
    bad = X.rs <= -1.5; beta = np.polyfit(X.rs.dropna(), X.r.dropna(), 1)[0]
    M = X[["c", "spy"]].resample("M").last().pct_change() * 100; dm = M[M.spy <= -3]
    hi252 = X.c.rolling(252).max(); dd = (X.c / hi252 - 1) * 100; since_hi = X.c.expanding().apply(lambda a: len(a) - 1 - np.argmax(a.values), raw=False) if False else None
    knife = (dd <= -10) & (dd.shift(15) > -3)   # fell 10%+ from its year high within 15 sessions of being within 3% of it
    for h in (21, 63, 126): X[f"f{h}"] = fwd(X.c.values, h)
    eps = episodes(knife.fillna(False).values); kn = {"episodes": len(eps), "dates": [str(X.index[i].date()) for i in eps][-8:], "h": {}}
    for h in (21, 63, 126):
        v = X[f"f{h}"].values[eps]; v = v[np.isfinite(v)]; base = X[f"f{h}"].dropna().values
        est, lo, hi, dr = boot(v, horizon=h, reps=400) if len(v) >= 3 else (np.nan, np.nan, np.nan, np.array([]))
        kn["h"][str(h)] = {"n": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None, "base_median": float(np.median(base)), "base_share_up": float((base > 0).mean()), "p": boot_p(dr, float(np.median(base)))}
    st[s] = {"beta_to_spy": float(beta), "on_spy_days_below_minus1p5": {"n": int(bad.sum()), "median_own": float(X.r[bad].median()), "median_spy": float(X.rs[bad].median()), "share_beat_spy": float((X.r[bad] > X.rs[bad]).mean()), "share_up": float((X.r[bad] > 0).mean())},
        "on_spy_months_below_minus3": {"n": int(len(dm)), "median_own": float(dm.c.median()), "median_spy": float(dm.spy.median()), "share_beat_spy": float((dm.c > dm.spy).mean())},
        "today": {"drawdown_from_252d_high_pct": float(dd.iloc[-1]), "sessions_since_252d_high": int(len(X) - 1 - int(np.argmax(X.c.values[-252:])) - (len(X) - 252)), "rsi": float(rsi_series(X.c.values)[-1]), "ret_21": float(X.c.iloc[-1] / X.c.iloc[-22] - 1) * 100, "ret_63": float(X.c.iloc[-1] / X.c.iloc[-64] - 1) * 100, "vs_spy_63": float((X.c.iloc[-1] / X.c.iloc[-64] - X.spy.iloc[-1] / X.spy.iloc[-64]) * 100)},
        "knife": kn}
out["staples"] = st
# ---- (e) leaders below their 200-day that still lead: point-in-time top-20 names (prior year-end caps). State = name below its 200-day while SPY is above its own; 'still leading' = its 63-day return beats SPY's. What came next.
p = os.path.join(LIB, "point-in-time/v1/pit-leaders-basket.json"); J = json.load(open(p)); top = J["top"]
C_ = {s: pd.Series({r[0]: r[4] for r in rows}) for s, rows in J["closes"].items()}
spy200 = spy.rolling(200).mean(); spy63 = fwd(spy.values, 0)
recs = []
for y, syms in top.items():
    lo = pd.Timestamp(f"{y}-01-01"); hi = pd.Timestamp(f"{y}-12-31")
    for s in syms:
        if s not in C_: continue
        c = C_[s]; c.index = pd.to_datetime(c.index); c = c.sort_index(); c = c[~c.index.duplicated()]
        if len(c) < 300: continue
        sma = c.rolling(200).mean(); r63 = c / c.shift(63) - 1; f63 = pd.Series(fwd(c.values, 63), index=c.index); f126 = pd.Series(fwd(c.values, 126), index=c.index)
        T = pd.DataFrame({"c": c, "below": c < sma, "r63": r63, "f63": f63, "f126": f126}).loc[lo:hi]
        T["spy_above"] = (spy > spy200).reindex(T.index).ffill(); T["spy_r63"] = (spy / spy.shift(63) - 1).reindex(T.index).ffill(); T["spy_f63"] = pd.Series(fwd(spy.values, 63), index=spy.index).reindex(T.index); T["spy_f126"] = pd.Series(fwd(spy.values, 126), index=spy.index).reindex(T.index)
        T["sym"] = s; recs.append(T.dropna(subset=["below", "spy_above"]))
L = pd.concat(recs); L["ex63"] = L.f63 - L.spy_f63; L["ex126"] = L.f126 - L.spy_f126; L["leading"] = L.r63 > L.spy_r63
states = {"leader below its 200-day, market above, still leading over 63d": L.below & L.spy_above & L.leading, "leader below its 200-day, market above, no longer leading": L.below & L.spy_above & ~L.leading,
          "leader above its 200-day, market above": ~L.below & L.spy_above, "leader below its 200-day, market below": L.below & ~L.spy_above, "all leader-days": pd.Series(True, index=L.index)}
lead = {"names_years": int(len(recs)), "states": {}}
for name, m in states.items():
    sub = L[m]; g = {"name_days": int(len(sub)), "share_of_leader_days": float(m.mean())}
    # episodes: first day of each run per name
    eps_vals = []
    for s, grp in sub.groupby("sym"):
        idx = grp.index; runs = [i for k, i in enumerate(idx) if k == 0 or (i - idx[k - 1]).days > 7]
        eps_vals.append(grp.loc[runs, ["ex63", "ex126", "f63"]])
    E = pd.concat(eps_vals).sort_index() if eps_vals else pd.DataFrame(columns=["ex63", "ex126", "f63"])
    for col in ("ex63", "ex126", "f63"):
        v = E[col].dropna().values; est, lo, hi, dr = boot(v, horizon=63 if col != "ex126" else 126, reps=300) if len(v) >= 5 else (np.nan, np.nan, np.nan, np.array([]))
        g[col] = {"episodes": int(len(v)), "median": est, "lo": lo, "hi": hi, "share_up": float((v > 0).mean()) if len(v) else None}
    lead["states"][name] = g
base63 = L.ex63.dropna(); lead["base_ex63_median_all_days"] = float(base63.median()); lead["base_ex126_median_all_days"] = float(L.ex126.dropna().median())
# today: which of this year's top-20 sit below their 200-day while SPY is above, and are they still leading
cur = []
for s in top.get("2026", []):
    if s not in C_: continue
    c = C_[s]; c.index = pd.to_datetime(c.index); c = c.sort_index()
    if len(c) < 260: continue
    cur.append({"sym": s, "below_200d": bool(c.iloc[-1] < c.rolling(200).mean().iloc[-1]), "r63_minus_spy": float((c.iloc[-1] / c.iloc[-64] - spy.iloc[-1] / spy.iloc[-64]) * 100), "as_of": str(c.index[-1].date())})
lead["today_top20"] = cur; out["leaders_below_200"] = lead
save_json("q4-playbook.json", out)
# ---- charts
f, axs = C.fig(14, 5, 1, 2)
for k, s in enumerate(("XLF", "KRE")):
    for d, lab in CUTS.items():
        if (s, d) in paths: axs[k].plot(np.arange(len(paths[(s, d)])), paths[(s, d)], lw=1.3, label=lab, color={"2007-09-18": C.DN, "2019-07-31": C.LINE2, "2024-09-18": C.UP}[d])
    axs[k].axhline(0, color=C.DIM, lw=0.6); axs[k].set_xlabel("sessions after the first cut"); axs[k].set_ylabel(f"{s} minus SPY, points"); axs[k].legend(loc="lower left"); axs[k].grid(axis="y")
    C.title(axs[k], f"{s} against SPY after the first cut of a cycle: three cuts, three different years", "2001, 1998 and 1995 are outside our fund histories (start Sep 2003)")
C.save(f, os.path.join(OUT, "charts", "q4-1-financials-first-cut.png"))
f, axs = C.fig(14, 5, 1, 2)
for k, s in enumerate(("XLU", "VNQ")):
    labs, est, lo, hi = [], [], [], []
    for name, g in wash[s]["groups"].items():
        c = g["h"]["63"]; labs.append(f"{name[:26]}\nn{c['n']}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
    C.range_bars(axs[k], labs, est, lo, hi, base=wash[s]["groups"]["bottom 1%"]["h"]["63"]["base_median"], ylabel="next 63 sessions, median %"); axs[k].tick_params(axis="x", labelsize=7)
    C.title(axs[k], f"{s} washouts (RSI at its own bottom) and the 10-year's direction", "bar = 90% block-bootstrap range · dashed = any day")
C.save(f, os.path.join(OUT, "charts", "q4-2-washouts.png"))
f, ax = C.fig(14, 5); labs, est, lo, hi = [], [], [], []
for name, g in dsn["regimes"].items():
    for col, short in (("dia_spy_f63", "Dow−S&P"), ("qqq_spy_f63", "Nasdaq−S&P")):
        c = g["pairs"][col]; labs.append(f"{name[:22]}\n{short}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
C.range_bars(ax, labs, est, lo, hi, base=0, ylabel="next 63 sessions, points"); ax.tick_params(axis="x", labelsize=7)
C.title(ax, "Dow vs S&P vs Nasdaq by regime (narrow breadth = RSP÷SPY fell over 63 sessions, bottom fifth; rising rates = 10-year up, top fifth)", f"today: narrow63 {dsn['today']['narrow63']*100:+.1f}% ({'narrow' if dsn['today']['narrow_flag'] else 'not narrow'}), 10-year {dsn['today']['y63_bp']:+.0f}bp over 63 ({'rising' if dsn['today']['rising_flag'] else 'not rising'})")
C.save(f, os.path.join(OUT, "charts", "q4-3-dow-spx-ndx.png"))
f, axs = C.fig(14, 5, 1, 2)
labs = []; est = []; lo = []; hi = []
for s in ("WMT", "COST", "XLP"):
    for h in (21, 63): c = st[s]["knife"]["h"][str(h)]; labs.append(f"{s} {h}d\nn{c['n']}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
C.range_bars(axs[0], labs, est, lo, hi, base=None, ylabel="after a 10% drop from the year high, median %"); C.title(axs[0], "Falling knife test: WMT, COST, XLP after a fast 10% drop from their year high", "own history since 2003 · bar = 90% range")
x = np.arange(3); own = [st[s]["on_spy_days_below_minus1p5"]["median_own"] for s in ("WMT", "COST", "XLP")]; sp = [st[s]["on_spy_days_below_minus1p5"]["median_spy"] for s in ("WMT", "COST", "XLP")]
axs[1].bar(x - 0.2, own, 0.4, color=C.DN, label="the name"); axs[1].bar(x + 0.2, sp, 0.4, color=C.LINE2, label="SPY"); axs[1].set_xticks(x); axs[1].set_xticklabels(["WMT", "COST", "XLP"]); axs[1].legend(); axs[1].grid(axis="y")
C.title(axs[1], "Defensive? median move on SPY's days of −1.5% or worse", " · ".join(f"{s} beat SPY on {st[s]['on_spy_days_below_minus1p5']['share_beat_spy']*100:.0f}% of them" for s in ("WMT", "COST", "XLP")))
C.save(f, os.path.join(OUT, "charts", "q4-4-staples.png"))
f, ax = C.fig(14, 5); labs, est, lo, hi = [], [], [], []
for name, g in lead["states"].items():
    c = g["ex63"]; labs.append(f"{name[:34]}\nn{c['episodes']}"); est.append(c["median"]); lo.append(c["lo"]); hi.append(c["hi"])
C.range_bars(ax, labs, est, lo, hi, base=lead["base_ex63_median_all_days"], ylabel="next 63 sessions minus SPY, points"); ax.tick_params(axis="x", labelsize=7)
C.title(ax, "Leaders (point-in-time top 20 by market cap) below their 200-day while the market is above: did the ones still leading keep leading?", "episodes = first day of each run per name · bar = 90% date-block bootstrap")
C.save(f, os.path.join(OUT, "charts", "q4-5-leaders-below-200.png"))
print(json.dumps(out["financials_after_cut"]["rows"], indent=0)[:1500]); print("dsn today", dsn["today"]); print({k: (v["days"], round(v["pairs"]["dia_spy_f63"]["median"], 2), round(v["pairs"]["qqq_spy_f63"]["median"], 2)) for k, v in dsn["regimes"].items()})
print("staples", {s: (round(st[s]["beta_to_spy"], 2), st[s]["on_spy_days_below_minus1p5"]["share_beat_spy"], st[s]["today"]) for s in st}); print("knife", {s: (st[s]["knife"]["episodes"], st[s]["knife"]["h"]["63"]) for s in st})
print("leaders", {k: (v["ex63"]["episodes"], round(v["ex63"]["median"], 2), v["ex63"]["share_up"]) for k, v in lead["states"].items()}, lead["today_top20"])
print("wash", {s: (v["rsi_today"], v["rsi_pct_today"], {k: (g["episodes"], round(g["h"]["63"]["median"], 2) if g["h"]["63"]["median"] == g["h"]["63"]["median"] else None) for k, g in v["groups"].items()}) for s, v in wash.items()})
