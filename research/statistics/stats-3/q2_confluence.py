"""Q2 · Confluence at lows and tops: fear & greed proxy, VIX (level, own percentile, cloud), put/call 5-day, RSI percentile,
breadth — each alone and in combination; and the framing 'VIX = slow/deep, put/call = fast/short' tested on bar-hour horizons."""
import os, json, itertools, numpy as np, pandas as pd, lib, charts as C
S = lib.SCRATCH; OUT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts"); os.makedirs(os.path.join(OUT, "data"), exist_ok=True)
P = pd.read_csv(os.path.join(S, "panel.csv"), index_col=0, parse_dates=True); res = {}
spy = lib.load_bars("SPY"); lows = lib.swing_lows(spy); highs = lib.swing_highs(spy)
lowK = np.array([l["k"] for l in lows if l["depth"] <= -3]); highK = np.array([h["k"] for h in highs if h["rise"] >= 3])
n = len(P); pos = np.arange(n)
def near(ks, before=5, after=15):
    f = np.zeros(n, bool)
    for k in ks: f[max(0, k - after):k + before + 1] = True   # the signal day sits between k-after ... k+before → a low within (−before … +after) of the signal
    return f
P["nearLow"] = near(lowK); P["nearHigh"] = near(highK)
# the six fear signals (own-history percentiles; the fear side is the high side of each score)
F = pd.DataFrame(index=P.index)
F["VIX level"] = P.vix_pct; F["VIX over its 50-day"] = P.vix_vs50_pct; F["VIX cloud: above both averages"] = np.where(P.vix_cloud == 2, 100.0, np.where(P.vix_cloud.isna(), np.nan, 0.0))
F["put/call 5-day"] = P.pcc5_pct; F["RSI (low = fear)"] = 100 - P.spy_rsi_pct; F["breadth: share above 50-day (low = fear)"] = 100 - P.a50_pct; F["fear & greed proxy (low = fear)"] = 100 - P.fg_pct
G = 100 - F; G["VIX cloud: above both averages"] = np.where(P.vix_cloud == 0, 100.0, np.where(P.vix_cloud.isna(), np.nan, 0.0)); G = G.rename(columns={"VIX cloud: above both averages": "VIX cloud: below both averages"})
NAMES = list(F.columns); res["from"] = str(P.pcc5.first_valid_index().date()); W = P.index >= P.pcc5.first_valid_index()   # the common window where every signal exists
base = {o: lib.dist(P[o][W]) for o in ("fwd_5", "fwd_21", "fwd_63", "dd_21", "up_21")}; base["nearLow"] = float(100 * P.nearLow[W].mean()); base["nearHigh"] = float(100 * P.nearHigh[W].mean()); res["base"] = base
def measure(mask, seed, side="low"):
    g = P[mask & W]; row = {"n": int((mask & W).sum()), "runs": lib.runs_of((mask & W).values), "years": int(g.index.year.nunique()) if len(g) else 0}
    if not len(g): return row
    for o in ("fwd_5", "fwd_21", "fwd_63", "dd_21"):
        h = int(o.split("_")[1]); b = lib.block_bootstrap(g[o].values, block=max(h, 5), reps=300, seed=seed + h, base=base[o]["p50"]); row[o] = {"med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "up": lib.r1(100 * np.nanmean(g[o] > 0))}
    hit = g.nearLow if side == "low" else g.nearHigh; b = lib.block_bootstrap(hit.astype(float).values, stat=np.mean, block=10, reps=300, seed=seed + 1, base=(base["nearLow"] if side == "low" else base["nearHigh"]) / 100)
    pc = lambda v: None if v is None else lib.r1(100 * v)
    row["hit"] = {"rate": pc(b["est"]), "lo": pc(b["lo"]), "hi": pc(b["hi"]), "p": b["p"]}
    return row
# ---- 2a · each signal alone, ladder of its own percentile (rungs of 10) → next 21 / further fall
ladders = {}
for name in NAMES:
    s = F[name]; rungs = []
    if "cloud" in name: continue
    for lo in range(0, 100, 10):
        m = (s >= lo) & (s < lo + 10) if lo < 90 else (s >= 90); r = measure(m, 200 + lo); r["from"] = lo; rungs.append(r)
    ladders[name] = rungs
res["ladders"] = ladders
# ---- 2b · combinations at the fear end: every subset of the signals 'on' at once, at three thresholds (top 5 / 10 / 20 % of own history)
def on(side, th):
    X = F if side == "low" else G; return {nm: ((X[nm] >= 100 - th) if "cloud" not in nm else (X[nm] >= 100)) for nm in X.columns}
combos = {}
for side in ("low", "high"):
    for th in (5, 10, 20):
        O = on(side, th); names = list(O.keys()); rows = []
        for k in (1, 2, 3):
            for sub in itertools.combinations(names, k):
                m = np.ones(n, bool)
                for nm in sub: m &= O[nm].fillna(False).values
                if m.sum() < 10: continue
                r = measure(pd.Series(m, index=P.index), 300 + k, side); r["signals"] = list(sub); r["k"] = k; rows.append(r)
        for o in ("fwd_21", "fwd_63", "dd_21", "hit"):
            key = "p"; ps = [r[o]["p"] if o in r else None for r in rows]; rej, adj = lib.benjamini_hochberg(ps)
            for i, r in enumerate(rows):
                if o in r: r[o]["adj"] = float(adj[i]); r[o]["fdr"] = bool(rej[i]); r[o]["word"] = lib.status_word(int(r["runs"]), r[o]["p"], adj[i])
        # does a pair beat its best single? gain of the pair's median next-21 over the better of its two singles
        singles = {tuple(r["signals"]): r for r in rows if r["k"] == 1}
        for r in rows:
            if r["k"] >= 2 and "fwd_21" in r:
                best = max((singles.get((nm,), {}).get("fwd_21", {}).get("med") or -99) for nm in r["signals"]); r["gain_over_best_single_21"] = lib.r2(r["fwd_21"]["med"] - best)
        combos[f"{side}_{th}"] = {"tests": len(rows), "rows": rows}
res["combos"] = combos
# ---- 2c · VIX slow/deep vs put/call fast/short: the forward path in bar-hours after each gauge's extreme, and the state of the decline it sits in
HORIZ = [1, 2, 3, 5, 10, 21, 42, 63]
def path(mask, seed):
    g = P[mask & W]; out = []
    for h in HORIZ:
        b = lib.block_bootstrap(g[f"fwd_{h}"].values, block=max(h, 5), reps=300, seed=seed + h, base=float(P[f"fwd_{h}"][W].median())); out.append({"h": h, "hours": h * 6.5, "med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "base": lib.r2(float(P[f"fwd_{h}"][W].median())), "up": lib.r1(100 * np.nanmean(g[f"fwd_{h}"] > 0))})
    return out
def context(mask):
    g = P[mask & W]; runs = []; cur = 0
    for v in (mask & W).values:
        if v: cur += 1
        elif cur: runs.append(cur); cur = 0
    return {"n": int(len(g)), "dd_from_high_med": lib.r1(g.spy_dd_from_high.median()), "dd_from_high_p25": lib.r1(g.spy_dd_from_high.quantile(0.25)), "further_fall_21_med": lib.r1(g.dd_21.median()), "further_fall_63_med": lib.r1(g.dd_63.median()),
            "run_med": lib.r1(np.median(runs)) if runs else None, "visits": len(runs), "hit_low": lib.r1(100 * g.nearLow.mean()), "share_deep": lib.r1(100 * (g.spy_dd_from_high <= -10).mean())}
gauges = {"VIX level top 10%": F["VIX level"] >= 90, "VIX over its 50-day top 10%": F["VIX over its 50-day"] >= 90, "put/call 5-day top 10%": F["put/call 5-day"] >= 90, "put/call 5-day top 5%": F["put/call 5-day"] >= 95, "VIX level top 5%": F["VIX level"] >= 95, "RSI bottom 10%": F["RSI (low = fear)"] >= 90, "breadth bottom 10%": F["breadth: share above 50-day (low = fear)"] >= 90}
res["paths"] = {k: {"path": path(m, 400 + i * 10), "context": context(m)} for i, (k, m) in enumerate(gauges.items())}
# the decline each gauge fires in: share of firings by depth band of SPY's fall from its 252-day high (fast/short vs slow/deep)
bands = [(0, 3), (3, 5), (5, 10), (10, 20), (20, 100)]
res["depthMix"] = {k: [lib.r1(100 * ((P[m & W].spy_dd_from_high <= -a) & (P[m & W].spy_dd_from_high > -b)).mean()) for a, b in bands] for k, m in gauges.items()}; res["depthBands"] = [f"{a}–{b}%" for a, b in bands]
# how early: sessions from a gauge's first firing in a decline to the swing low (lead), by depth of the low
def lead(mask):
    out = []
    for l in lows:
        if l["depth"] > -3: continue
        k = l["k"]; kt = l["kTop"]; seg = mask.values[kt:k + 1]
        if not len(seg) or k < np.where(W)[0][0]: continue
        idx = np.where(seg)[0]; out.append({"depth": l["depth"], "lead": int(k - (kt + idx[0])) if len(idx) else None, "fired": bool(len(idx))})
    d = pd.DataFrame(out); rows = []
    for a, b in ((3, 5), (5, 10), (10, 20), (20, 100)):
        s = d[(d.depth <= -a) & (d.depth > -b)]; rows.append({"band": f"{a}–{b}%", "lows": int(len(s)), "fired": lib.r1(100 * s.fired.mean()) if len(s) else None, "lead_med": lib.r1(s.lead.median()) if s.fired.any() else None})
    return rows
res["leads"] = {k: lead(m) for k, m in gauges.items() if "10%" in k}
res["today"] = {nm: lib.r1(F[nm].iloc[-1]) for nm in NAMES}; res["today"].update({"vix": lib.r2(P.vix.iloc[-1]), "pcc5": lib.r2(P.pcc5.iloc[-1]), "a50": lib.r1(P.a50.iloc[-1]), "fg": lib.r1(P.fg.iloc[-1]), "spy_rsi": lib.r1(P.spy_rsi.iloc[-1]), "vix_cloud": int(P.vix_cloud.iloc[-1])})
json.dump(lib.clean(res), open(os.path.join(OUT, "data", "q2.json"), "w"))
# ---- charts
f, ax = C.fig(14, 5.4)
for i, (name, rungs) in enumerate(ladders.items()):
    ax.plot([r["from"] + 5 for r in rungs], [r["fwd_21"]["med"] for r in rungs], lw=1.6, color=C.GREYS[i % 5] if i < 5 else C.UP, label=name, marker="o", ms=3)
ax.axhline(base["fwd_21"]["p50"], color=C.DIM, ls="--", lw=0.8); ax.set_xlabel("signal's own-history percentile (100 = most fear)"); ax.set_ylabel("SPY next 21 sessions, median %"); ax.legend(fontsize=8.5, ncol=2); ax.grid(axis="y")
C.title(ax, "Each fear gauge alone, every rung: SPY's next 21 sessions", f"{res['from']} → · rungs of 10 · dashed = any day · ranges in the table")
C.save(f, os.path.join(CH, "q2-singles-ladder.png"))
f, ax = C.fig(14, 5.4); k = "low_10"; rows = sorted([r for r in combos[k]["rows"] if "fwd_21" in r], key=lambda r: -(r["fwd_21"]["med"] or -99))[:18]
labs = [" + ".join(s.split(" (")[0].split(":")[0] for s in r["signals"]) for r in rows]
C.range_bars(ax, range(len(rows)), [r["fwd_21"]["med"] for r in rows], [r["fwd_21"]["lo"] for r in rows], [r["fwd_21"]["hi"] for r in rows], base=base["fwd_21"]["p50"], ylabel="SPY next 21 sessions, median %", color_by_sign=False)
ax.set_xticks(range(len(rows))); ax.set_xticklabels(labs, rotation=35, ha="right", fontsize=7.5)
for i, r in enumerate(rows):
    w = r["fwd_21"]["word"]; ax.plot([i], [r["fwd_21"]["med"]], "o", ms=8, color=C.UP if w == "luck-proof" else C.ACCENT if w == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2)
    ax.text(i, r["fwd_21"]["hi"], f"{r['runs']} visits", ha="center", va="bottom", fontsize=7, color=C.DIM, family="monospace")
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown · visits = separate episodes (the honest count)", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "Fear combinations, top 10% of own history, ranked by SPY's next 21 sessions", f"{combos[k]['tests']} combinations tested, false-discovery corrected · n = days (clustered) · alone, in pairs and in threes")
C.save(f, os.path.join(CH, "q2-combos-low10.png"))
f, axs = C.fig(14, 5.4, 1, 2)
for k, m in (("VIX level top 10%", 0), ("put/call 5-day top 10%", 1), ("VIX over its 50-day top 10%", 0), ("put/call 5-day top 5%", 1)):
    p = res["paths"][k]["path"]; x = [q["hours"] for q in p]; col = C.LINE if "VIX" in k else C.UP
    axs[m].plot(x, [q["med"] for q in p], marker="o", ms=4, lw=1.6, color=col if "top 10" in k else C.LINE2, label=k); axs[m].fill_between(x, [q["lo"] for q in p], [q["hi"] for q in p], color=col, alpha=0.12, lw=0)
for m, ttl in ((0, "after a VIX extreme"), (1, "after a put/call extreme")):
    p = res["paths"]["VIX level top 10%"]["path"]; axs[m].plot([q["hours"] for q in p], [q["base"] for q in p], color=C.DIM, ls="--", lw=0.8, label="any day"); axs[m].set_xscale("log"); axs[m].set_xticks([6.5, 13, 32.5, 65, 136.5, 273, 409.5]); axs[m].set_xticklabels(["6.5h\n1 day", "13h", "32h\n1 wk", "65h", "137h\n1 mo", "273h", "410h\n1 qtr"], fontsize=8)
    axs[m].set_ylabel("SPY forward return, median %"); axs[m].legend(fontsize=8.5); axs[m].grid(axis="y"); C.title(axs[m], f"SPY's path in bar-hours {ttl}", "6.5 bar-hours = one session · band = 90% block-bootstrap range")
C.save(f, os.path.join(CH, "q2-bar-hours.png"))
f, ax = C.fig(14, 4.8); keys = list(gauges.keys()); M = np.array([res["depthMix"][k] for k in keys], float)
C.heat(ax, M, res["depthBands"], keys, fmt="{:.0f}", center=20, cmap=None); ax.set_xlabel("SPY's fall from its 252-day high on the day the gauge fired"); ax.tick_params(axis="y", labelsize=8.5)
C.title(ax, "Which kind of decline each gauge fires in (share of its firing days, %)", "slow/deep gauges fire in the deep bands; fast/short gauges fire in the shallow ones")
C.save(f, os.path.join(CH, "q2-depth-mix.png"))
print("DONE q2"); print(json.dumps(lib.clean({"today": res["today"], "vix": res["paths"]["VIX level top 10%"]["context"], "pcc": res["paths"]["put/call 5-day top 10%"]["context"], "top": [(r["signals"], r["n"], r["fwd_21"]["med"], r["fwd_21"]["word"]) for r in rows[:6]]}), indent=0)[:2500])
