"""Q1 · The Geiger as a statistic: own-history percentiles of the composite and its two families per instrument;
forward outcomes by family state (Alan's strong-trend + weak-momentum pullback cell); by security type and market-cap
tranche; and whether index funds would read differently on their own scale. Reads the Hub-maths replay (1d/3d/1w rungs,
Alan's saved weights) — the intraday rungs cannot be rebuilt from daily bars, so this is the daily part of the Geiger."""
import os, json, numpy as np, pandas as pd, lib, pooled, charts as C
S = lib.SCRATCH; OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts"); os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
P = pd.read_csv(os.path.join(S, "panel.csv"), index_col=0, parse_dates=True)
prof = lib.profiles(); res = {"asof": lib.ASOF}
rows = []; today = []; widths = []
for sym in lib.universe():
    g = lib.load_geiger(sym); d = lib.load_bars(sym)
    if g is None or d is None: continue
    g = g[g.full == 1]
    if len(g) < 300: continue
    typ = lib.security_type(sym, prof)
    df = g[["g", "tr", "mo"]].copy(); df["g_pct"] = lib.own_pct(df.g.values); df["tr_pct"] = lib.own_pct(df.tr.values); df["mo_pct"] = lib.own_pct(df.mo.values)
    c = d.c.reindex(df.index); cv = c.values
    for h in (21, 63):
        df[f"f{h}"] = lib.fwd_ret(cv, h); spyf = P[f"fwd_{h}"].reindex(df.index).values; df[f"x{h}"] = df[f"f{h}"] - spyf
    df["dd63"] = lib.fwd_maxdd(cv, 63); df["rsi"] = lib.rsi(cv)
    df["sym"] = sym; df["type"] = typ; df["spy_up"] = P.spy_above200.reindex(df.index).values
    rows.append(df.reset_index().rename(columns={"index": "date"}))
    t = df.iloc[-1]; hist = df.g.values
    today.append({"sym": sym, "type": typ, "g": lib.r2(t.g), "g_pct": lib.r1(t.g_pct), "tr": lib.r2(t.tr), "tr_pct": lib.r1(t.tr_pct), "mo": lib.r2(t.mo), "mo_pct": lib.r1(t.mo_pct), "rsi": lib.r1(t.rsi), "n": int(len(df)),
        "g_p5": lib.r2(np.percentile(hist, 5)), "g_p50": lib.r2(np.percentile(hist, 50)), "g_p95": lib.r2(np.percentile(hist, 95)), "rsi_p5": lib.r1(np.nanpercentile(df.rsi, 5)), "rsi_p95": lib.r1(np.nanpercentile(df.rsi, 95)),
        "cap_bn": (prof.get(sym) or {}).get("market_cap") and round(prof[sym]["market_cap"] / 1e9, 1)})
T = pd.DataFrame(today); D = pd.concat(rows, ignore_index=True); D["date"] = pd.to_datetime(D.date)
print("panel rows", len(D), "names", D.sym.nunique(), "from", D.date.min().date())
# ---- 1a · width of the Geiger by type (how narrow does an index fund's composite run?)
byType = []
for typ in lib.TYPE_ORDER:
    t = T[T.type == typ]
    if not len(t): continue
    byType.append({"type": typ, "n": int(len(t)), "g_p5": lib.r2(t.g_p5.median()), "g_p50": lib.r2(t.g_p50.median()), "g_p95": lib.r2(t.g_p95.median()), "width": lib.r2((t.g_p95 - t.g_p5).median()), "width_lo": lib.r2((t.g_p95 - t.g_p5).quantile(0.1)), "width_hi": lib.r2((t.g_p95 - t.g_p5).quantile(0.9)),
        "rsi_p5": lib.r1(t.rsi_p5.median()), "rsi_p95": lib.r1(t.rsi_p95.median()), "rsi_width": lib.r1((t.rsi_p95 - t.rsi_p5).median()), "today_g": lib.r2(t.g.median()), "today_g_pct": lib.r1(t.g_pct.median()), "today_tr": lib.r2(t.tr.median()), "today_mo": lib.r2(t.mo.median())})
res["byType"] = byType
# ---- 1b · would the index funds read differently on their own scale? percentile mapped back to the −1..1 bar: 2p−1
idx = T[T.type == "index fund"].copy(); idx["own_scale"] = (2 * idx.g_pct / 100 - 1).round(2); idx["shift"] = (idx.own_scale - idx.g).round(2)
res["indexToday"] = idx.sort_values("g")[["sym", "g", "g_pct", "own_scale", "shift", "tr", "mo", "rsi", "g_p5", "g_p95", "rsi_p5", "rsi_p95"]].to_dict("records")
allT = T.copy(); allT["own_scale"] = 2 * allT.g_pct / 100 - 1; allT["shift"] = allT.own_scale - allT.g
res["shiftByType"] = [{"type": typ, "n": int((allT.type == typ).sum()), "shift_med": lib.r2(allT[allT.type == typ]["shift"].median()), "redder_share": lib.r1(100 * (allT[allT.type == typ]["shift"] < -0.2).mean()), "greener_share": lib.r1(100 * (allT[allT.type == typ]["shift"] > 0.2).mean())} for typ in lib.TYPE_ORDER if (allT.type == typ).any()]
# ---- 1c · forward outcomes by family state, pooled over single companies (own-history terciles of trend and momentum, and raw fifths of the bar)
stocks = D[D.type.str.contains("cap")].copy()
def tercile(p): return np.where(p <= 100 / 3, "weak", np.where(p <= 200 / 3, "middle", "strong"))
stocks = stocks.dropna(subset=["tr_pct", "mo_pct"]); stocks["trT"] = tercile(stocks.tr_pct.values); stocks["moT"] = tercile(stocks.mo_pct.values)
def fifth(x): return np.clip(((np.asarray(x) + 1) / 0.4).astype(int), 0, 4)
stocks["trF"] = fifth(stocks.tr.values); stocks["moF"] = fifth(stocks.mo.values)
ORDER = ["weak", "middle", "strong"]
def grid(df, key_t, key_m, outcomes=("x63", "f63", "x21", "dd63"), seed=11):
    base = {o: pooled.cell(df, "date", o, block=63, reps=200, seed=seed) for o in outcomes}
    cells = []
    for a in (ORDER if key_t == "trT" else range(5)):
        for b in (ORDER if key_m == "moT" else range(5)):
            sub = df[(df[key_t] == a) & (df[key_m] == b)]
            row = {"trend": a, "momentum": b, "share": lib.r1(100 * len(sub) / len(df))}
            for o in outcomes:
                row[o] = pooled.cell(sub, "date", o, base_med=base[o]["med"], base_up=base[o]["up"], block=63, reps=200, seed=seed + 1)
            cells.append(row)
    for o in outcomes: pooled.fdr_over([r[o] for r in cells])
    return {"base": base, "cells": cells}
res["gridTercile"] = grid(stocks, "trT", "moT"); res["gridFifth"] = grid(stocks, "trF", "moF", outcomes=("x63", "f63"))
# the pullback cell in words, in both halves of history and in both market states
pb = stocks[(stocks.trT == "strong") & (stocks.moT == "weak")]; weakg = stocks[stocks.g_pct <= 100 / 3]
def cmp(name, sub, base_df, seed):
    b = pooled.cell(base_df, "date", "x63", reps=200, seed=seed); c = pooled.cell(sub, "date", "x63", base_med=b["med"], base_up=b["up"], reps=200, seed=seed + 1)
    bf = pooled.cell(base_df, "date", "f63", reps=200, seed=seed + 2); cf = pooled.cell(sub, "date", "f63", base_med=bf["med"], base_up=bf["up"], reps=200, seed=seed + 3)
    return {"name": name, "x63": c, "x63_base": b, "f63": cf, "f63_base": bf}
splits = [cmp("all (2007→)", pb, stocks, 21), cmp("first half: to 2015", pb[pb.date < "2016"], stocks[stocks.date < "2016"], 23), cmp("second half: 2016→", pb[pb.date >= "2016"], stocks[stocks.date >= "2016"], 25),
    cmp("SPY above its 200-day", pb[pb.spy_up == 1], stocks[stocks.spy_up == 1], 27), cmp("SPY below its 200-day", pb[pb.spy_up == 0], stocks[stocks.spy_up == 0], 29),
    cmp("weak composite instead (bottom third)", weakg, stocks, 31), cmp("strong trend + strong momentum", stocks[(stocks.trT == "strong") & (stocks.moT == "strong")], stocks, 33), cmp("weak trend + weak momentum", stocks[(stocks.trT == "weak") & (stocks.moT == "weak")], stocks, 35)]
pooled.fdr_over([s["x63"] for s in splits]); pooled.fdr_over([s["f63"] for s in splits], key="p"); res["pullback"] = splits
# ---- 1d · by security type and by market-cap tranche: the pullback cell against the type's own any-day
byT = []
for typ in lib.TYPE_ORDER:
    sub = D[(D.type == typ)].dropna(subset=["tr_pct", "mo_pct"])
    if sub.date.nunique() < 500: continue
    cellpb = sub[(sub.tr_pct > 200 / 3) & (sub.mo_pct <= 100 / 3)]
    bF = pooled.cell(sub, "date", "f63", reps=200, seed=41); cF = pooled.cell(cellpb, "date", "f63", base_med=bF["med"], base_up=bF["up"], reps=200, seed=42)
    bX = pooled.cell(sub, "date", "x63", reps=200, seed=43); cX = pooled.cell(cellpb, "date", "x63", base_med=bX["med"], base_up=bX["up"], reps=200, seed=44)
    # also the composite ladder slope for the type: rank correlation between the composite's own percentile decile and next-63 median
    dec = (sub.g_pct // 10).clip(0, 9); lad = sub.groupby(dec).f63.median()
    from scipy.stats import spearmanr
    rho = spearmanr(lad.index, lad.values).correlation if len(lad) > 3 else None
    byT.append({"type": typ, "names": int(sub.sym.nunique()), "dates": int(sub.date.nunique()), "cell_share": lib.r1(100 * len(cellpb) / len(sub)), "f63": cF, "f63_base": bF, "x63": cX, "x63_base": bX, "ladder_rho": lib.r2(rho), "ladder": [lib.r2(v) for v in lad.values]})
pooled.fdr_over([b["f63"] for b in byT]); pooled.fdr_over([b["x63"] for b in byT]); res["byTypeCell"] = byT
# ---- 1e · the composite ladder 1..100 (own percentile) for stocks and for index funds: the slope is the finding
def ladder(sub, seed):
    out = []
    for lo in range(0, 100, 5):
        m = (sub.g_pct >= lo) & (sub.g_pct < lo + 5) if lo < 95 else (sub.g_pct >= 95)
        c = pooled.cell(sub[m], "date", "f63", reps=120, seed=seed + lo); out.append({"from": lo, "med": c["med"], "lo": c["lo"], "hi": c["hi"], "up": c["up"], "n": c["n_rows"]})
    return out
res["ladderStocks"] = ladder(stocks, 51); res["ladderIndex"] = ladder(D[D.type == "index fund"].dropna(subset=["g_pct"]), 53)
res["today"] = T.sort_values("g_pct").to_dict("records"); res["names"] = int(T.shape[0]); res["stockRows"] = int(len(stocks)); res["stockDates"] = int(stocks.date.nunique()); res["from"] = stocks.date.min().strftime("%Y-%m-%d")
json.dump(lib.clean(res), open(os.path.join(OUT, "data", "q1.json"), "w"))
# ---- charts
f, ax = C.fig(14, 5.2); labs = [b["type"] for b in byType]; x = np.arange(len(labs))
for i, b in enumerate(byType):
    ax.plot([x[i], x[i]], [b["g_p5"], b["g_p95"]], color=C.LINE2, lw=6, solid_capstyle="butt"); ax.plot([x[i]], [b["g_p50"]], "_", color=C.ACCENT, ms=16, mew=2); ax.plot([x[i]], [b["today_g"]], "o", color=C.UP if b["today_g"] >= 0 else C.DN, ms=7)
ax.axhline(0, color=C.DIM, lw=0.8); ax.set_xticks(x); ax.set_xticklabels(labs, rotation=20, ha="right", fontsize=9); ax.set_ylim(-1.05, 1.05); ax.set_ylabel("Geiger composite (daily rungs)"); ax.grid(axis="y")
C.title(ax, "How wide each type's Geiger runs", "bar = the middle member's 5th–95th percentile of its own composite · tick = its median · dot = the type's middle reading today (green up / red down)")
C.save(f, os.path.join(CH, "q1-width-by-type.png"))
f, ax = C.fig(14, 5); ix = res["indexToday"]; x = np.arange(len(ix))
ax.bar(x - 0.2, [r["g"] for r in ix], 0.4, color=[C.UP if r["g"] >= 0 else C.DN for r in ix], label="Geiger today (daily rungs)"); ax.bar(x + 0.2, [r["own_scale"] for r in ix], 0.4, color=C.LINE2, label="same reading on its own-history scale (2·percentile − 1)")
ax.set_xticks(x); ax.set_xticklabels([r["sym"] for r in ix], fontsize=9); ax.axhline(0, color=C.DIM, lw=0.8); ax.set_ylim(-1.05, 1.05); ax.legend(loc="lower right"); ax.grid(axis="y")
C.title(ax, "Index funds today: the bar as printed vs the bar on each fund's own scale", "a negative gap = the fund would read redder if the Geiger were scored against its own history")
C.save(f, os.path.join(CH, "q1-index-own-scale.png"))
f, axs = C.fig(14, 5.2, 1, 2); G = res["gridTercile"]
for k, (o, ttl) in enumerate((("x63", "next 63 sessions vs SPY, points"), ("dd63", "worst fall inside 63 sessions, %"))):
    M = np.full((3, 3), np.nan)
    for r in G["cells"]: M[ORDER.index(r["trend"]), ORDER.index(r["momentum"])] = r[o]["med"] if r[o]["med"] is not None else np.nan
    C.heat(axs[k], M, ["weak", "middle", "strong"], ["weak", "middle", "strong"], center=G["base"][o]["med"], fmt="{:+.1f}" if o == "x63" else "{:.1f}"); axs[k].set_xlabel("MOMENTUM (own-history tercile)"); axs[k].set_ylabel("TREND (own-history tercile)")
    C.title(axs[k], ttl, f"single companies pooled · any day {G['base'][o]['med']:+.1f} · colour = against any day")
C.save(f, os.path.join(CH, "q1-grid-tercile.png"))
f, ax = C.fig(14, 5); GF = res["gridFifth"]; M = np.full((5, 5), np.nan)
for r in GF["cells"]: M[r["trend"], r["momentum"]] = r["x63"]["med"] if r["x63"]["med"] is not None else np.nan
labs5 = ["−1 to −0.6", "−0.6 to −0.2", "−0.2 to 0.2", "0.2 to 0.6", "0.6 to 1"]; C.heat(ax, M, labs5, labs5, center=GF["base"]["x63"]["med"], fmt="{:+.1f}"); ax.set_xlabel("MOMENTUM family, on the bar's own scale"); ax.set_ylabel("TREND family")
C.title(ax, "Next 63 sessions vs SPY by where each family sits on the bar", f"single companies pooled · any day {GF['base']['x63']['med']:+.1f} points · cells with few days are noisy (see the table)")
C.save(f, os.path.join(CH, "q1-grid-fifth.png"))
f, ax = C.fig(14, 5); labs = [s["name"] for s in splits]
C.range_bars(ax, labs, [s["x63"]["med"] for s in splits], [s["x63"]["lo"] for s in splits], [s["x63"]["hi"] for s in splits], base=splits[0]["x63_base"]["med"], ylabel="next 63 sessions vs SPY, points (median)", color_by_sign=False); ax.set_xticklabels(labs, rotation=12, ha="right", fontsize=8.5)
for i, s in enumerate(splits):
    w = s["x63"]["word"]; ax.plot([i], [s["x63"]["med"]], "o", ms=8, color=C.UP if w == "luck-proof" else C.ACCENT if w == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2)
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown (against the split's own any-day)", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "Alan's pullback cell: strong trend + weak momentum, against alternatives and across halves", "dot = weighted median of per-date medians · bar = 90% date-block bootstrap range · dashed = the served stocks' any day (a survivor's universe, so above SPY)")
C.save(f, os.path.join(CH, "q1-pullback-splits.png"))
f, ax = C.fig(14, 5); labs = [b["type"] for b in byT]
C.range_bars(ax, labs, [b["x63"]["med"] - b["x63_base"]["med"] for b in byT], [b["x63"]["lo"] - b["x63_base"]["med"] for b in byT], [b["x63"]["hi"] - b["x63_base"]["med"] for b in byT], base=0, ylabel="cell minus the type's any-day, points (63 sessions vs SPY)", color_by_sign=False); ax.set_ylim(-4, 4); ax.set_xticklabels(labs, rotation=12, ha="right", fontsize=8.5)
for i, b in enumerate(byT):
    w = b["x63"]["word"]; ax.plot([i], [b["x63"]["med"] - b["x63_base"]["med"]], "o", ms=8, color=C.UP if w == "luck-proof" else C.ACCENT if w == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2)
    ax.text(i, 3.7, f"any day {b['x63_base']['med']:+.1f}", ha="center", va="top", fontsize=7.5, color=C.DIM, family="monospace")
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown · small caps (today's fallen names) sit off the axis at −3.2", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "The pullback cell by security type and market-cap tranche, against the type's own any-day", "stocks typed by TODAY's market cap (a survivor's view both ways) · dot = median, bar = 90% date-block range")
C.save(f, os.path.join(CH, "q1-pullback-by-type.png"))
f, ax = C.fig(14, 5); L = res["ladderStocks"]; I = res["ladderIndex"]; x = [r["from"] + 2.5 for r in L]
C.band_plot(ax, x, [r["med"] for r in L], [r["lo"] if r["lo"] is not None else np.nan for r in L], [r["hi"] if r["hi"] is not None else np.nan for r in L], label="single companies", color=C.LINE)
C.band_plot(ax, x, [r["med"] if r["med"] is not None else np.nan for r in I], [r["lo"] if r["lo"] is not None else np.nan for r in I], [r["hi"] if r["hi"] is not None else np.nan for r in I], label="index funds", color=C.LINE2)
ax.axhline(res["gridTercile"]["base"]["f63"]["med"], color=C.DIM, ls="--", lw=0.8); ax.set_xlabel("Geiger composite, own-history percentile (rungs of 5)"); ax.set_ylabel("next 63 sessions, median %"); ax.legend(); ax.grid(axis="y")
C.title(ax, "The composite ladder, 1 to 100: the slope is the finding, not any rung", "every rung shown · bands = 90% date-block range · dashed = stocks' any day")
C.save(f, os.path.join(CH, "q1-ladder.png"))
print("DONE q1"); print(json.dumps(lib.clean({"byType": byType[:3], "pullback": [(s["name"], s["x63"]["med"], s["x63"]["lo"], s["x63"]["hi"], s["x63"]["word"]) for s in splits]}), indent=0)[:2500])
