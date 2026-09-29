"""Q4 · Leaders trail SPY for a quarter after bottoms: why, and rebalancing rules to test (not advice).
Leaders = each year's top 20 by market cap at the time (statistician-2's point-in-time lists), equal weight, daily rebalanced.
Lows = SPY swing lows (10-bar pivots) of 3% or more, acted on only at confirmation (10 sessions after the low)."""
import os, sys, json, numpy as np, pandas as pd, lib, charts as C
# --pit (R4, 29 Sep): the leaders basket is N9's point-in-time one (each year's 20 largest members by full cap on the
# prior year's last session, every member of the day, AIG and all) with its repaired closes, and the worst-decile
# fallers are drawn from the members of the index ON THE DAY OF THE LOW, delisted names and all. SPY, RSP, IWM, the
# lows and every rule are unchanged. Without the switch this file runs exactly as before.
PIT = "--pit" in sys.argv
if PIT: sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "point-in-time")); import pit_source as PS
S = lib.SCRATCH; OUT = PS.OUT if PIT else os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts"); os.makedirs(os.path.join(OUT, "data"), exist_ok=True); os.makedirs(CH, exist_ok=True)
PFX = "pit-" if PIT else ""; DATA_FILE = "pit-q4.json" if PIT else "q4.json"
P = pd.read_csv(os.path.join(S, "panel.csv"), index_col=0, parse_dates=True); pit = {str(y): v for y, v in PS.pit_top20().items()} if PIT else json.load(open(os.path.join(S, "pit_top20.json"))); res = {"universe": "point-in-time (N9 basket; fallers from the members on the day of the low)"} if PIT else {}
idx = P.index; closes = {}
if PIT:
    for sym, ser in PS.basket_closes().items(): closes[sym] = ser.reindex(idx)
else:
    for sym in sorted(set(sum(pit.values(), []))):
        d = lib.load_bars(sym)
        if d is not None: closes[sym] = d.c.reindex(idx)
CL = pd.DataFrame(closes); R = CL.pct_change()
lead = pd.Series(np.nan, index=idx); cnt = pd.Series(0, index=idx)
for y, names in pit.items():
    m = idx.year == int(y); cols = [s for s in names if s in R.columns]; lead[m] = R.loc[m, cols].mean(axis=1); cnt[m] = R.loc[m, cols].notna().sum(axis=1)
lead = lead.where(cnt >= 10); LEV = (1 + lead.fillna(0)).cumprod() * 100
spyR = P.spy.pct_change(); rspR = lib.load_bars("RSP").c.reindex(idx).pct_change(); iwmR = lib.load_bars("IWM").c.reindex(idx).pct_change()
# high-beta / laggard baskets from the served stocks: the worst-decile fallers into the low, equal weight (built at the low, no later information)
if PIT: SC, MEM = PS.closes_and_members(idx)
else: SC = pd.read_csv(os.path.join(S, "stock_closes.csv"), index_col=0, parse_dates=True); MEM = None
SR = SC.pct_change()
if PIT: res["fallerPool"] = int(SC.shape[1])
spy = lib.load_bars("SPY"); lows = [l for l in lib.swing_lows(spy) if l["depth"] <= -3]; start = lead.first_valid_index()
rows = []
for l in lows:
    k = l["k"]; kc = l["confirm"]; d0 = idx[k]
    if d0 < start or kc + 63 >= len(idx): continue
    def cum(r, a, b): x = r.iloc[a + 1:b + 1]; return float(100 * ((1 + x.fillna(0)).prod() - 1))
    # laggards: bottom decile of return from the top to the low among served stocks with data
    fall = 100 * (SC.iloc[k] / SC.iloc[l["kTop"]] - 1); fall = fall.dropna()
    if MEM is not None: fall = fall[MEM.iloc[k].reindex(fall.index).fillna(0).values == 1]   # (--pit) members of the index on the day of the low
    lag = fall[fall <= fall.quantile(0.1)].index; lagR = SR[lag].mean(axis=1)
    row = {"low": d0.strftime("%Y-%m-%d"), "depth": lib.r1(l["depth"]), "year": d0.year}
    for name, r in (("leaders", lead), ("spy", spyR), ("rsp", rspR), ("iwm", iwmR), ("laggards", lagR)):
        for h in (21, 63, 126, 252):
            if kc + h < len(idx): row[f"{name}_{h}"] = cum(r, kc, kc + h)
        row[f"{name}_fall"] = cum(r, l["kTop"], k)
    rows.append(row)
E = pd.DataFrame(rows); res["lows"] = int(len(E)); res["from"] = E.low.min(); res["to"] = E.low.max()
def rel(a, b, h): return E[f"{a}_{h}"] - E[f"{b}_{h}"]
def boot(v, seed, base=0): return lib.episode_bootstrap(v.values, stat=np.nanmedian, reps=1000, seed=seed, base=base)
out = {}
for name in ("leaders", "rsp", "iwm", "laggards"):
    out[name] = {h: boot(rel(name, "spy", h), 50 + h) for h in (21, 63, 126, 252) if f"{name}_{h}" in E}
    out[name]["fall"] = boot(rel(name, "spy", "fall"), 57)
res["relSPY"] = out
# why: (1) beta — leaders fell as much as SPY (fall ratio); (2) the bounce is broad — equal weight, small caps and the worst fallers beat SPY after the low; (3) leaders' bounce relative to their own fall
E["lead_ratio_fall"] = E.leaders_fall / E.spy_fall; E["lead_bounce_over_fall"] = E.leaders_63 / (-E.leaders_fall); E["spy_bounce_over_fall"] = E.spy_63 / (-E.spy_fall)
res["why"] = {"fall_ratio": boot(E.lead_ratio_fall, 61, base=1), "lead_bounce_over_fall": boot(E.lead_bounce_over_fall, 62), "spy_bounce_over_fall": boot(E.spy_bounce_over_fall, 63),
    "laggards_63_vs_spy": out["laggards"][63], "rsp_63_vs_spy": out["rsp"][63], "iwm_63_vs_spy": out["iwm"][63], "leaders_63_vs_spy": out["leaders"][63], "leaders_252_vs_spy": out["leaders"].get(252)}
# by depth of the low, and by market state at the low (above / below the 200-day)
E["state"] = [("SPY above its 200-day" if P.spy_above200.get(pd.Timestamp(d), 0) == 1 else "SPY below its 200-day") for d in E.low]
res["byDepth"] = []
for a, b in ((3, 5), (5, 10), (10, 100)):
    g = E[(E.depth <= -a) & (E.depth > -b)]; res["byDepth"].append({"band": f"{a}–{b}%", "n": int(len(g)), "leaders_63": boot(g.leaders_63 - g.spy_63, 71), "leaders_252": boot(g.leaders_252 - g.spy_252, 72) if "leaders_252" in g else None, "rsp_63": boot(g.rsp_63 - g.spy_63, 73), "laggards_63": boot(g.laggards_63 - g.spy_63, 74)})
res["byState"] = [{"state": s, "n": int(len(g)), "leaders_63": boot(g.leaders_63 - g.spy_63, 75), "rsp_63": boot(g.rsp_63 - g.spy_63, 76)} for s, g in E.groupby("state")]
res["halves"] = [{"half": h, "n": int(len(g)), "leaders_63": boot(g.leaders_63 - g.spy_63, 77), "leaders_252": boot(g.leaders_252 - g.spy_252, 78) if "leaders_252" in g else None} for h, g in E.groupby(E.year < 2016)]
for r in res["halves"]: r["half"] = "2007–2015" if r["half"] else "2016 →"
# ---- rules to test (not advice): starting from all-leaders, at confirmation of a SPY low move x% into equal weight (RSP) for h sessions, then back.
# Compared with holding leaders through the same window. Also the bow tie: a fixed leaders/RSP mix rebalanced quarterly vs never.
rules = []
for x in (25, 50, 100):
    for h in (21, 63, 126):
        if f"rsp_{h}" not in E: continue
        gain = (E[f"rsp_{h}"] - E[f"leaders_{h}"]) * x / 100; b = boot(gain, 80 + x + h)
        rules.append({"rule": f"move {x}% to equal weight for {h} sessions", "x": x, "h": h, "gain_med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "win": lib.r1(100 * (gain > 0).mean()), "n": int(gain.notna().sum()),
            "h1": lib.r2(gain[E.year < 2016].median()), "h2": lib.r2(gain[E.year >= 2016].median())})
for x in (25, 50):
    for h in (21, 63):
        gain = (E[f"laggards_{h}"] - E[f"leaders_{h}"]) * x / 100; b = boot(gain, 90 + x + h)
        rules.append({"rule": f"move {x}% to the worst-decile fallers for {h} sessions", "x": x, "h": h, "gain_med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "win": lib.r1(100 * (gain > 0).mean()), "n": int(gain.notna().sum()), "h1": lib.r2(gain[E.year < 2016].median()), "h2": lib.r2(gain[E.year >= 2016].median())})
rej, adj = lib.benjamini_hochberg([r["p"] for r in rules])
for i, r in enumerate(rules): r["adj"] = float(adj[i]); r["fdr"] = bool(rej[i]); r["word"] = lib.status_word(r["n"], r["p"], adj[i])
res["rules"] = rules
# bow tie: leaders/RSP mixes, rebalanced quarterly vs buy-and-hold, whole period from the leaders' start
W = pd.DataFrame({"lead": lead, "rsp": rspR}).dropna(); res["bowtie"] = []
for w in (1.0, 0.75, 0.5, 0.25, 0.0):
    reb = (1 + (w * W.lead + (1 - w) * W.rsp)).cumprod()      # daily rebalanced to the fixed mix
    # never rebalanced: two buckets grow apart
    a = w * (1 + W.lead).cumprod(); b = (1 - w) * (1 + W.rsp).cumprod(); hold = a + b
    def stats(lv):
        yrs = (lv.index[-1] - lv.index[0]).days / 365.25; cagr = 100 * (lv.iloc[-1] / lv.iloc[0]) ** (1 / yrs) - 100; dd = 100 * (lv / lv.cummax() - 1).min(); return {"cagr": lib.r1(cagr), "maxdd": lib.r1(dd)}
    res["bowtie"].append({"leaders_weight": w, "rebalanced_daily": stats(reb), "never": stats(hold), "from": W.index[0].strftime("%Y-%m-%d")})
res["today"] = {"last_low": E.low.iloc[-1], "depth": float(E.depth.iloc[-1]), "leaders_names_now": pit["2026"], "leaders_loaded": int(len(closes))}
json.dump(lib.clean(res), open(os.path.join(OUT, "data", DATA_FILE), "w"))
# charts
f, ax = C.fig(14, 5.2); H = [21, 63, 126, 252]; x = np.arange(len(H)); wdt = 0.2
for i, (name, lab) in enumerate((("leaders", "leaders (top 20 by cap)"), ("rsp", "equal weight (RSP)"), ("iwm", "small caps (IWM)"), ("laggards", "worst-decile fallers"))):
    est = [out[name][h]["est"] if h in out[name] else np.nan for h in H]; lo = [out[name][h]["lo"] if h in out[name] else np.nan for h in H]; hi = [out[name][h]["hi"] if h in out[name] else np.nan for h in H]
    ax.bar(x + (i - 1.5) * wdt, est, wdt, color=[C.UP if v >= 0 else C.DN for v in est], alpha=0.35 + 0.15 * i, label=lab); ax.errorbar(x + (i - 1.5) * wdt, est, yerr=[np.array(est) - np.array(lo), np.array(hi) - np.array(est)], fmt="none", ecolor=C.LINE2, lw=1.4)
ax.axhline(0, color=C.DIM, lw=0.8); ax.set_xticks(x); ax.set_xticklabels([f"{h} sessions" for h in H]); ax.set_ylabel("return minus SPY from the low's confirmation, points"); ax.legend(fontsize=9); ax.grid(axis="y")
C.title(ax, f"After a SPY low is confirmed: who beats SPY, and for how long ({len(E)} lows, {res['from'][:4]}–{res['to'][:4]})", "median with a 90% range over resampled lows · acted on 10 sessions after the low (the pivot's confirmation)")
C.save(f, os.path.join(CH, PFX + "q4-after-lows.png"))
f, ax = C.fig(14, 5); labs = [r["rule"] for r in rules]
C.range_bars(ax, range(len(rules)), [r["gain_med"] for r in rules], [r["lo"] for r in rules], [r["hi"] for r in rules], base=0, ylabel="gain over holding leaders, points per low", color_by_sign=False); ax.set_xticks(range(len(rules))); ax.set_xticklabels(labs, rotation=25, ha="right", fontsize=8)
for i, r in enumerate(rules):
    ax.plot([i], [r["gain_med"]], "o", ms=8, color=C.UP if r["word"] == "luck-proof" else C.ACCENT if r["word"] == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2)
    ax.text(i, r["hi"], f"{r['win']:.0f}%", ha="center", va="bottom", fontsize=7.5, color=C.DIM, family="monospace")
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown · number = share of lows where the rule gained", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "Rebalancing rules to test, not advice: shift part of a leaders book after a confirmed low", "each rule's gain per low, median and 90% range; false-discovery corrected over every rule tried")
C.save(f, os.path.join(CH, PFX + "q4-rules.png"))
f, ax = C.fig(14, 4.8); bt = res["bowtie"]; x = [b["leaders_weight"] * 100 for b in bt]
ax.plot(x, [b["rebalanced_daily"]["cagr"] for b in bt], marker="o", color=C.LINE, label="yearly return, rebalanced to the mix"); ax.plot(x, [b["never"]["cagr"] for b in bt], marker="o", color=C.LINE2, label="yearly return, never rebalanced")
ax2 = ax.twinx(); ax2.plot(x, [b["rebalanced_daily"]["maxdd"] for b in bt], marker="s", color=C.DN, ls="--", label="worst fall, rebalanced"); ax2.set_ylabel("worst fall, %", color=C.DN); ax.set_xlabel("share in the leaders (rest in equal weight), %"); ax.set_ylabel("yearly return, %"); ax.legend(loc="upper left", fontsize=9); ax2.legend(loc="lower right", fontsize=9); ax.grid(axis="y")
C.title(ax, f"The bow tie as a fixed mix, {bt[0]['from'][:4]} →: return and worst fall by leaders share", "leaders basket = each year's top 20 by cap, equal weight · equal weight = RSP · price only, before costs")
C.save(f, os.path.join(CH, PFX + "q4-bowtie.png"))
print("DONE q4"); print(json.dumps(lib.clean({"lows": res["lows"], "rel63": out["leaders"][63], "rel252": out["leaders"].get(252), "why": {k: (v["est"], v["lo"], v["hi"]) for k, v in res["why"].items() if v}, "rules": [(r["rule"], r["gain_med"], r["win"], r["word"]) for r in rules], "bowtie": res["bowtie"]}), indent=0)[:3000])
