"""Q6 · Gold's parabolic runs and the dollar's extensions, 1971/1975 → today. No cut-offs: every percentile rung of the
extension measure is reported; the named episodes are the top of that ladder, shown as a list."""
import os, json, numpy as np, pandas as pd, lib, charts as C
S = lib.SCRATCH; OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts")
res = {}
def study(sym, name, seed):
    d = lib.load_bars(sym, cut_faults=False); c = d.c.values; n = len(c)
    df = pd.DataFrame(index=d.index); df["c"] = c
    df["sma200"] = lib.sma(c, 200); df["ext200"] = 100 * (c / df.sma200 - 1)            # extension: distance above the 200-day
    df["ret252"] = 100 * (c / np.r_[np.full(252, np.nan), c[:-252]] - 1)               # 1-year gain
    df["ret63"] = 100 * (c / np.r_[np.full(63, np.nan), c[:-63]] - 1)
    df["rsi"] = lib.rsi(c); df["rsi_w"] = np.nan
    df["ext_pct"] = lib.own_pct(df.ext200.values); df["ret252_pct"] = lib.own_pct(df.ret252.values)
    for h in (21, 63, 126, 252, 504): df[f"fwd_{h}"] = lib.fwd_ret(c, h)
    for h in (126, 252, 504): df[f"dd_{h}"] = lib.fwd_maxdd(c, h)
    # time to recover: sessions until a close exceeds today's close (survival; open waits censored at the last bar)
    run_max_fwd = pd.Series(c[::-1]).cummax()[::-1].values
    rec = np.full(n, np.nan); ev = np.zeros(n, bool)
    hi_after = np.full(n, np.nan)
    # for each day i, first j>i with c[j] > c[i]: computed with a stack (next greater element)
    st = []
    nxt = np.full(n, -1)
    for i in range(n - 1, -1, -1):
        while st and c[st[-1]] <= c[i]: st.pop()
        nxt[i] = st[-1] if st else -1; st.append(i)
    rec = np.where(nxt >= 0, nxt - np.arange(n), n - 1 - np.arange(n)).astype(float); ev = nxt >= 0
    df["recover"] = rec; df["recovered"] = ev
    # ladder over the extension percentile: forward outcomes by rung band (every 5 points so each cell has enough days), plus the top rungs one by one
    base = {h: lib.dist(df[f"fwd_{h}"]) for h in (63, 126, 252)}; base_dd = lib.dist(df.dd_252)
    ladder = []
    for lo in range(0, 100, 5):
        m = (df.ext_pct >= lo) & (df.ext_pct < lo + 5) if lo < 95 else (df.ext_pct >= 95)
        g = df[m]
        row = {"from": lo, "to": lo + 5, "n": int(m.sum()), "ext_med": lib.r1(g.ext200.median())}
        for h in (63, 126, 252):
            b = lib.block_bootstrap(g[f"fwd_{h}"].values, block=h, reps=300, seed=seed + h + lo, base=base[h]["p50"]); row[f"f{h}"] = {"med": lib.r1(b["est"]), "lo": lib.r1(b["lo"]), "hi": lib.r1(b["hi"]), "p": b["p"], "up": lib.r1(100 * np.nanmean(g[f"fwd_{h}"] > 0))}
        b = lib.block_bootstrap(g.dd_252.values, block=252, reps=300, seed=seed + lo + 1, base=base_dd["p50"]); row["dd252"] = {"med": lib.r1(b["est"]), "lo": lib.r1(b["lo"]), "hi": lib.r1(b["hi"]), "p": b["p"]}
        km = lib.km_median(g.recover.values, g.recovered.values); row["recover_med"] = None if km is None else int(km)
        ladder.append(row)
    # FDR over every cell tried (20 rungs × 4 outcomes)
    ps = [r[k]["p"] for r in ladder for k in ("f63", "f126", "f252", "dd252")]; rej, adj = lib.benjamini_hochberg(ps); i = 0
    for r in ladder:
        for k in ("f63", "f126", "f252", "dd252"): r[k]["adj"] = float(adj[i]); r[k]["fdr"] = bool(rej[i]); i += 1
    # episodes: runs of days with the extension in its top 5% of own history, merged when closer than 63 sessions; each is a list entry
    top = df.ext_pct >= 95; eps = []; start = None; last = None
    for i, (dt, on) in enumerate(top.items()):
        if on:
            if start is None: start = i
            elif i - last > 63: eps.append((start, last)); start = i
            last = i
    if start is not None: eps.append((start, last))
    episodes = []
    for a, b in eps:
        seg = df.iloc[a:b + 1]; kpk = int(np.argmax(c[a:b + 1])) + a
        pk = c[kpk]; after = c[kpk + 1:]
        # the fall after the peak: worst close before the peak is exceeded (or to date), and the wait to exceed it
        nx = nxt[kpk]; trough_end = nx if nx >= 0 else n
        trough = float(100 * (c[kpk + 1:trough_end].min() / pk - 1)) if trough_end > kpk + 1 else 0.0
        t_trough = int(np.argmin(c[kpk + 1:trough_end])) + 1 if trough_end > kpk + 1 else 0
        episodes.append({"from": seg.index[0].strftime("%Y-%m-%d"), "to": seg.index[-1].strftime("%Y-%m-%d"), "days": int(b - a + 1), "peak_date": df.index[kpk].strftime("%Y-%m-%d"), "peak": lib.r2(pk),
            "ext_at_peak": lib.r1(df.ext200.iloc[kpk]), "ret252_at_peak": lib.r1(df.ret252.iloc[kpk]), "rsi_at_peak": lib.r1(df.rsi.iloc[kpk]), "fall_after": lib.r1(trough), "sessions_to_trough": t_trough,
            "recover_sessions": None if nx < 0 else int(nx - kpk), "recovered": bool(nx >= 0), "f63": lib.r1(df.fwd_63.iloc[kpk]), "f252": lib.r1(df.fwd_252.iloc[kpk]), "f504": lib.r1(df.fwd_504.iloc[kpk])})
    today = df.iloc[-1]
    res[sym] = {"name": name, "from": df.index[0].strftime("%Y-%m-%d"), "to": df.index[-1].strftime("%Y-%m-%d"), "n": int(n), "years": lib.r1((df.index[-1] - df.index[0]).days / 365.25),
        "today": {"c": lib.r2(today.c), "ext200": lib.r1(today.ext200), "ext_pct": lib.r1(today.ext_pct), "ret252": lib.r1(today.ret252), "ret252_pct": lib.r1(today.ret252_pct), "rsi": lib.r1(today.rsi), "ret63": lib.r1(today.ret63)},
        "base": {"f63": base[63], "f126": base[126], "f252": base[252], "dd252": base_dd, "recover_med": lib.km_median(df.recover.values, df.recovered.values)},
        "ladder": ladder, "episodes": episodes, "n_top5": int(top.sum()), "eff_n_top5": lib.r1(lib.effective_n(top.astype(float).values))}
    # charts: (1) price with the top-5% extension days marked; (2) ladder of next-year return and worst fall by extension rung
    f, ax = C.fig(14, 5.4); ax.plot(df.index, df.c, color=C.LINE, lw=0.9); ax.set_yscale("log")
    ax.scatter(df.index[top], df.c[top], s=6, color=C.DN, zorder=3, label="extension above the 200-day in its top 5% of own history")
    ax.plot(df.index, df.sma200, color=C.LINE2, lw=0.8, label="200-day")
    C.title(ax, f"{name}: the parabolic days", f"{df.index[0].year}–{df.index[-1].year} · log scale · {len(episodes)} separate runs (red) · today ext {lib.r1(today.ext200)}% = {lib.r1(today.ext_pct)}th pct")
    ax.legend(loc="upper left"); ax.grid(axis="y"); C.save(f, os.path.join(CH, f"q6-{sym}-runs.png"))
    f, axs = C.fig(14, 5.4, 1, 2)
    labels = [f"{r['from']}" for r in ladder]
    C.range_bars(axs[0], labels, [r["f252"]["med"] for r in ladder], [r["f252"]["lo"] for r in ladder], [r["f252"]["hi"] for r in ladder], base=base[252]["p50"], ylabel="next 252 sessions, median %")
    C.title(axs[0], f"{name}: next year by extension rung", "own-history percentile of the distance above the 200-day, rungs of 5 · dot = median, bar = 90% block-bootstrap range")
    axs[0].set_xlabel("extension percentile (rung start)"); axs[0].tick_params(axis="x", labelsize=8)
    C.range_bars(axs[1], labels, [r["dd252"]["med"] for r in ladder], [r["dd252"]["lo"] for r in ladder], [r["dd252"]["hi"] for r in ladder], base=base_dd["p50"], ylabel="worst fall within 252 sessions, median %", color_by_sign=False)
    C.title(axs[1], "worst fall inside the next year", "red side = deeper than any day"); axs[1].set_xlabel("extension percentile (rung start)"); axs[1].tick_params(axis="x", labelsize=8)
    C.save(f, os.path.join(CH, f"q6-{sym}-ladder.png"))
    return df
g = study("GCUSD", "Gold (futures, continuous)", 61)
d = study("DXY", "US dollar index", 62)
# gold vs dollar: gold's next year by the dollar's extension rung (both known at the close)
j = pd.DataFrame({"gold_f252": g.fwd_252, "gold_f126": g.fwd_126, "dxy_ext_pct": d.ext_pct.reindex(g.index, method="ffill"), "dxy_ext": d.ext200.reindex(g.index, method="ffill")}).dropna()
cross = []
for lo in range(0, 100, 10):
    m = (j.dxy_ext_pct >= lo) & (j.dxy_ext_pct < lo + 10) if lo < 90 else (j.dxy_ext_pct >= 90)
    b = lib.block_bootstrap(j[m].gold_f252.values, block=252, reps=300, seed=70 + lo, base=float(j.gold_f252.median()))
    cross.append({"from": lo, "to": lo + 10, "n": int(m.sum()), "gold_f252": {"med": lib.r1(b["est"]), "lo": lib.r1(b["lo"]), "hi": lib.r1(b["hi"]), "p": b["p"]}, "dxy_ext_med": lib.r1(j[m].dxy_ext.median())})
ps = [r["gold_f252"]["p"] for r in cross]; rej, adj = lib.benjamini_hochberg(ps)
for i, r in enumerate(cross): r["gold_f252"]["adj"] = float(adj[i]); r["gold_f252"]["fdr"] = bool(rej[i])
res["cross"] = {"base_gold_f252": lib.r1(j.gold_f252.median()), "rows": cross, "n": int(len(j)), "today_dxy_ext_pct": lib.r1(d.ext_pct.iloc[-1]), "today_dxy_ext": lib.r1(d.ext200.iloc[-1])}
f, ax = C.fig(14, 5); C.range_bars(ax, [f"{r['from']}–{r['to']}" for r in cross], [r["gold_f252"]["med"] for r in cross], [r["gold_f252"]["lo"] for r in cross], [r["gold_f252"]["hi"] for r in cross], base=res["cross"]["base_gold_f252"], ylabel="gold, next 252 sessions, median %")
C.title(ax, "Gold's next year by how stretched the dollar was", "dollar's distance from its 200-day, own-history percentile deciles · 1975 → · dot = median, bar = 90% range"); ax.set_xlabel("dollar extension percentile")
C.save(f, os.path.join(CH, "q6-gold-by-dollar.png"))
# the two side by side today: gold and dollar extension percentiles over the last 3 years
f, ax = C.fig(14, 4.6); last = g.index >= pd.Timestamp("2023-09-25")
ax.plot(g.index[last], g.ext_pct[last], color=C.LINE, lw=1.4, label="gold: extension percentile"); ax.plot(d.index[d.index >= pd.Timestamp("2023-09-25")], d.ext_pct[d.index >= pd.Timestamp("2023-09-25")], color=C.LINE2, lw=1.4, label="dollar: extension percentile")
ax.axhline(95, color=C.DN, lw=0.8, ls="--"); ax.axhline(5, color=C.UP, lw=0.8, ls="--"); ax.set_ylim(0, 100); ax.legend(loc="lower left"); ax.grid(axis="y")
C.title(ax, "Where both sit today, in their own histories", "distance above/below the 200-day as an expanding own-history percentile · last three years")
C.save(f, os.path.join(CH, "q6-today.png"))
json.dump(lib.clean(res), open(os.path.join(OUT, "data", "q6.json"), "w")) if os.path.isdir(os.path.join(OUT, "data")) else (os.makedirs(os.path.join(OUT, "data")), json.dump(lib.clean(res), open(os.path.join(OUT, "data", "q6.json"), "w")))
print("gold today", res["GCUSD"]["today"], "episodes", len(res["GCUSD"]["episodes"])); print("dollar today", res["DXY"]["today"], "episodes", len(res["DXY"]["episodes"]))
for e in res["GCUSD"]["episodes"]: print(e)
print("cross", [(r["from"], r["n"], r["gold_f252"]["med"], r["gold_f252"]["fdr"]) for r in cross])
