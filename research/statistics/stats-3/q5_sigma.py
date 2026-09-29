"""Q5 · USUAL DAY history as data: 23 years of sigma-day counts (public.sigma_day_counts) and per-name sigma events
(public.sigma_events_daily), read through the Hub's public key. What followed one-sided days like today's; per-name
events as scan / notification triggers; leaders."""
import os, sys, json, numpy as np, pandas as pd, lib, pooled, charts as C
# --pit (R4, 29 Sep): the Hub's USUAL DAY test replayed on the point-in-time bars of every S&P 500 member on its member
# days (the same rule numbers, data/scintilla-rules.json equity), so both the day counts (5a, 5b) and the per-name
# events (5c) come from the members of the day, typed by the cap of the day, with a name that stopped trading scored to
# its last close. SPY, the panel and every rule are unchanged. Without the switch this file runs exactly as before.
PIT = "--pit" in sys.argv
if PIT: sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "point-in-time")); import pit_source as PS
S = lib.SCRATCH; OUT = PS.OUT if PIT else os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts"); os.makedirs(os.path.join(OUT, "data"), exist_ok=True); os.makedirs(CH, exist_ok=True)
PFX = "pit-" if PIT else ""; DATA_FILE = "pit-q5.json" if PIT else "q5.json"
P = pd.read_csv(os.path.join(S, "panel.csv"), index_col=0, parse_dates=True); res = {"universe": "point-in-time S&P 500 members (N9), the Hub's test replayed"} if PIT else {}
if PIT:
    EQ_RULE = lib.rules()["price"]["equity"]
    PIT_EV, PIT_DC = PS.sigma_all(EQ_RULE); print("pit sigma events", len(PIT_EV), "names", PIT_EV.ticker.nunique(), "days", len(PIT_DC))
    for k in ("names_measured", "n", "up", "dn"): P["sg_" + k] = PIT_DC[k].reindex(P.index)
    P["sg_dn_share"] = 100 * P.sg_dn / P.sg_names_measured; P["sg_up_share"] = 100 * P.sg_up / P.sg_names_measured; P["sg_n_share"] = 100 * P.sg_n / P.sg_names_measured
    P["sg_dn_pct"] = lib.own_pct(P.sg_dn_share.values); P["sg_up_pct"] = lib.own_pct(P.sg_up_share.values)
Q = P.dropna(subset=["sg_dn_share"]).copy(); Q = Q[Q.sg_names_measured >= 100]
res["counts"] = {"from": Q.index[0].strftime("%Y-%m-%d"), "to": Q.index[-1].strftime("%Y-%m-%d"), "days": int(len(Q)), "names_now": int(Q.sg_names_measured.iloc[-1]), "names_2004": int(Q.sg_names_measured.iloc[0])}
# ---- 5a · the ladder of the down-share (own percentile, rungs of 5) → SPY next 5 / 21 / 63, worst fall in 21
def ladder(df, col, seed, outs=("fwd_5", "fwd_21", "fwd_63", "dd_21")):
    """The share is a count over ~500 names, so it takes few distinct values; rungs of its own percentile would be lumpy.
    The ladder is therefore in the share's own units: every whole percent from 0 to 9, then 10% and more."""
    base = {o: lib.dist(df[o]) for o in outs}; out = []
    bins = [(k, k + 1) for k in range(10)] + [(10, 1000)]
    for lo, hi in bins:
        m = (df[col] >= lo) & (df[col] < hi); g = df[m]; row = {"from": lo, "to": hi, "label": f"{lo}%" if hi < 1000 else "10%+", "n": int(m.sum()), "runs": lib.runs_of(m.values), "pct": lib.r1(100 * float((df[col] < lo).mean() + 0.5 * m.mean()))}
        for o in outs:
            h = int(o.split("_")[1]); b = lib.block_bootstrap(g[o].values, block=max(h, 5), reps=300, seed=seed + lo + h, base=base[o]["p50"]); row[o] = {"med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "up": lib.r1(100 * np.nanmean(g[o] > 0)) if len(g) else None, "n": b["n"]}
        out.append(row)
    for o in outs:
        rej, adj = lib.benjamini_hochberg([r[o]["p"] for r in out])
        for i, r in enumerate(out): r[o]["adj"] = float(adj[i]); r[o]["fdr"] = bool(rej[i]); r[o]["word"] = lib.status_word(r["runs"], r[o]["p"], adj[i])
    return {"base": base, "rungs": out}
res["dnLadder"] = ladder(Q, "sg_dn_share", 101); res["upLadder"] = ladder(Q, "sg_up_share", 103)
# ---- 5b · one-sided days like today's (0 up, many down): every threshold of the down share with up = 0, plus the 5-day cluster
def cond(name, m, seed):
    g = Q[m]; base = {o: float(Q[o].median()) for o in ("fwd_5", "fwd_21", "fwd_63")}; row = {"name": name, "n": int(m.sum()), "runs": lib.runs_of(m.values), "years": int(Q.index[m].year.nunique()), "last": Q.index[m][-1].strftime("%Y-%m-%d") if m.any() else None}
    for o in ("fwd_5", "fwd_21", "fwd_63"):
        h = int(o.split("_")[1]); b = lib.block_bootstrap(g[o].values, block=max(h, 5), reps=400, seed=seed + h, base=base[o]); row[o] = {"med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "up": lib.r1(100 * np.nanmean(g[o] > 0)), "base": lib.r2(base[o]), "base_up": lib.r1(100 * np.nanmean(Q[o] > 0))}
    b = lib.block_bootstrap(g.dd_21.values, block=21, reps=400, seed=seed + 9, base=float(Q.dd_21.median())); row["dd_21"] = {"med": lib.r2(b["est"]), "lo": lib.r2(b["lo"]), "hi": lib.r2(b["hi"]), "p": b["p"], "base": lib.r2(float(Q.dd_21.median()))}
    # more sigma days ahead? share of the next 10 sessions that were themselves top-decile down-sigma days
    nxt = pd.Series(Q.sg_dn_pct.values >= 90, index=Q.index).astype(float); ahead = nxt[::-1].rolling(10).mean()[::-1].shift(-1)
    row["more_ahead"] = lib.r1(100 * float(ahead[m].mean())); row["more_ahead_base"] = lib.r1(100 * float(ahead.mean()))
    return row
sides = []
for k in (1, 2, 3, 4, 5, 6, 8, 10):
    sides.append(cond(f"0 up · down share ≥ {k}%", (Q.sg_up == 0) & (Q.sg_dn_share >= k), 110 + k))
sides.append(cond("today's class: up share ≤ 0.5% · down share ≥ 4%", (Q.sg_up_share <= 0.5) & (Q.sg_dn_share >= 4), 130))
sides.append(cond("mirror: 0 down · up share ≥ 4%", (Q.sg_dn == 0) & (Q.sg_up_share >= 4), 131))
sides.append(cond("both sides: up ≥ 2% and down ≥ 2%", (Q.sg_up_share >= 2) & (Q.sg_dn_share >= 2), 132))
clus = Q.sg_dn_share.rolling(5).sum(); Q["sg_dn5"] = clus; Q["sg_dn5_pct"] = lib.own_pct(clus.values)
sides.append(cond("5-day cluster of down-sigma share in its top 5%", Q.sg_dn5_pct >= 95, 133)); sides.append(cond("5-day cluster in its top 1%", Q.sg_dn5_pct >= 99, 134))
for o in ("fwd_5", "fwd_21", "fwd_63"):
    rej, adj = lib.benjamini_hochberg([s[o]["p"] for s in sides])
    for i, s in enumerate(sides): s[o]["adj"] = float(adj[i]); s[o]["fdr"] = bool(rej[i]); s[o]["word"] = lib.status_word(s["runs"], s[o]["p"], adj[i])
res["oneSided"] = sides
t23 = P.loc["2026-09-23"]; res["today"] = {"date_last_row": Q.index[-1].strftime("%Y-%m-%d"), "sep23": {"up": int(t23.sg_up), "dn": int(t23.sg_dn), "names": int(t23.sg_names_measured), "dn_share": lib.r2(t23.sg_dn_share), "dn_pct": lib.r1(t23.sg_dn_pct)}, "sep28_reported": {"up": 0, "dn": 20, "note": "Alan's reading on the live strip (28 Sep); the history table ends at the 25 Sep close"}}
# what preceded days like 23 Sep (0 up / 25 dn of 486 = 5.1%): the 20 sessions before, SPY's distance from its high and the VIX
like = (Q.sg_up_share <= 0.5) & (Q.sg_dn_share >= 4); res["likeToday"] = {"n": int(like.sum()), "dates": [d.strftime("%Y-%m-%d") for d in Q.index[like][-25:]], "spy_dd_from_high_med": lib.r1(Q[like].spy_dd_from_high.median()), "vix_pct_med": lib.r1(Q[like].vix_pct.median()), "spy_above200_share": lib.r1(100 * Q[like].spy_above200.mean()),
    "ret20_before_med": lib.r1((100 * (Q.spy / Q.spy.shift(20) - 1))[like].median())}
# ---- 5c · per-name sigma events as triggers
ev = PIT_EV if PIT else pd.DataFrame(json.load(open(os.path.join(S, "db", "sigma_events_daily.json")))); ev["date"] = pd.to_datetime(ev.date); ev = ev[ev.date <= Q.index[-1]]
prof = lib.profiles(); pit = json.load(open(os.path.join(S, "pit_top20.json"))); leaderOf = {y: set(v) for y, v in PS.pit_top20().items()} if PIT else {int(y): set(v) for y, v in pit.items()}
rows = []
for sym, e in ev.groupby("ticker"):
    d = PS.load_daily(sym) if PIT else lib.load_bars(sym)
    if d is None or len(d) < 300: continue
    stop = PIT and PS.stopped(d); FR, FD = (PS.fwd_to_exit, PS.fwd_maxdd_to_exit) if stop else (lib.fwd_ret, lib.fwd_maxdd)
    c = d.c; s200 = c.rolling(200).mean(); s50 = c.rolling(50).mean(); rs = lib.rsi(c.values)
    df = pd.DataFrame(index=d.index); df["above200"] = (c > s200).where(s200.notna()); df["order"] = (s50 > s200).where(s200.notna()); df["dist200"] = 100 * (c / s200 - 1); df["rsi_pct"] = lib.own_pct(rs)
    for h in (5, 21, 63): df[f"f{h}"] = FR(c.values, h); df[f"x{h}"] = df[f"f{h}"] - P[f"fwd_{h}"].reindex(df.index).values
    df["dd21"] = FD(c.values, 21)
    g = None if PIT else lib.load_geiger(sym)
    if g is not None: df["tr"] = g.tr.reindex(df.index); df["mo"] = g.mo.reindex(df.index)
    j = e.set_index("date").join(df, how="inner"); j.index.name = "date"; j["sym"] = sym; j["type"] = [PS.tranche(x) for x in j.cap_m.values] if PIT else lib.security_type(sym, prof); j["leader"] = [s in leaderOf.get(y, set()) for y, s in zip(j.index.year, j.sym)]
    rows.append(j.reset_index())
E = pd.concat(rows, ignore_index=True); E["absx"] = E.x_usual.abs()
E["band"] = pd.cut(E.absx, [0, 2, 3, 4, 100], labels=["raw only (<2× usual)", "2–3× usual", "3–4× usual", "4×+ usual"], right=False)
E["state"] = np.where(E.above200 == 1, "above 200-day", "below 200-day")
res["events"] = {"n": int(len(E)), "names": int(E.sym.nunique()), "from": E.date.min().strftime("%Y-%m-%d"), "leader_rows": int(E.leader.sum())}
E["dir"] = np.where(E.direction > 0, "up day", "down day"); stocksE = E[E.type.str.contains("cap")]
def cells(df, keys, seed):
    base = {o: pooled.cell(df, "date", o, reps=200, seed=seed) for o in ("x5", "x21", "x63", "f21")}; out = []
    for key, sub in df.groupby(keys, observed=True):
        row = {"key": key if isinstance(key, str) else " · ".join(str(k) for k in key), "n": int(len(sub)), "dates": int(sub.date.nunique())}
        for o in ("x5", "x21", "x63", "f21"): row[o] = pooled.cell(sub, "date", o, base_med=base[o]["med"], base_up=base[o]["up"], reps=200, seed=seed + 1)
        out.append(row)
    for o in ("x5", "x21", "x63", "f21"): pooled.fdr_over([r[o] for r in out])
    return {"base": base, "cells": out}
E["dir"] = np.where(E.direction > 0, "up day", "down day")
res["byDirBandState"] = cells(stocksE, ["dir", "band", "state"], 141)
res["byDirLeader"] = cells(stocksE, ["dir", "state", "leader"], 143)
res["byDirType"] = cells(E, ["dir", "type"], 145)
# the trigger candidates in words: leaders + above the 200-day + down sigma day (Alan's pullback entry), and the same for any name
trig = []
for name, m in (("leader · above 200-day · down day", (stocksE.leader) & (stocksE.state == "above 200-day") & (stocksE.dir == "down day")),
                ("any stock · above 200-day · down day 2×+", (stocksE.state == "above 200-day") & (stocksE.dir == "down day") & (stocksE.absx >= 2)),
                ("any stock · above 200-day · 50 over 200 · down day 2×+", (stocksE.state == "above 200-day") & (stocksE.order == 1) & (stocksE.dir == "down day") & (stocksE.absx >= 2)),
                ("any stock · below 200-day · down day 2×+", (stocksE.state == "below 200-day") & (stocksE.dir == "down day") & (stocksE.absx >= 2)),
                ("any stock · above 200-day · up day 2×+", (stocksE.state == "above 200-day") & (stocksE.dir == "up day") & (stocksE.absx >= 2)),
                ("any stock · below 200-day · up day 2×+", (stocksE.state == "below 200-day") & (stocksE.dir == "up day") & (stocksE.absx >= 2)),
                ("leader · below 200-day · down day", (stocksE.leader) & (stocksE.state == "below 200-day") & (stocksE.dir == "down day"))):
    sub = stocksE[m]; row = {"name": name, "n": int(len(sub)), "dates": int(sub.date.nunique()), "names": int(sub.sym.nunique())}
    for o in ("x5", "x21", "x63"): row[o] = pooled.cell(sub, "date", o, base_med=res["byDirBandState"]["base"][o]["med"], base_up=res["byDirBandState"]["base"][o]["up"], reps=300, seed=151)
    for half, mm in (("h1", sub.date < "2016"), ("h2", sub.date >= "2016")): row["x21_" + half] = pooled.cell(sub[mm], "date", "x21", base_med=res["byDirBandState"]["base"]["x21"]["med"], reps=200, seed=153)
    trig.append(row)
for o in ("x5", "x21", "x63"): pooled.fdr_over([r[o] for r in trig])
res["triggers"] = trig
json.dump(lib.clean(res), open(os.path.join(OUT, "data", DATA_FILE), "w"))
# ---- charts
f, axs = C.fig(14, 5.2, 1, 2); L = res["dnLadder"]["rungs"]; x = [r["from"] + 0.5 for r in L]
for k, (o, ttl) in enumerate((("fwd_21", "SPY next 21 sessions, median %"), ("fwd_63", "SPY next 63 sessions, median %"))):
    C.band_plot(axs[k], x, [r[o]["med"] for r in L], [r[o]["lo"] for r in L], [r[o]["hi"] for r in L], color=C.LINE); axs[k].axhline(res["dnLadder"]["base"][o]["p50"], color=C.DIM, ls="--", lw=0.8)
    for r in L:
        if r[o]["fdr"]: axs[k].plot([r["from"] + 0.5], [r[o]["med"]], "o", color=C.UP if r[o]["med"] > res["dnLadder"]["base"][o]["p50"] else C.DN, ms=6)
    axs[k].set_xticks([r["from"] + 0.5 for r in L]); axs[k].set_xticklabels([r["label"] for r in L]); axs[k].set_xlabel("share of names with a DOWN sigma day that session (23 Sep: 5.1%)"); axs[k].set_ylabel(ttl); axs[k].grid(axis="y"); C.title(axs[k], ttl, "band = 90% range · dot = clears the false-discovery check · dashed = any day")
C.save(f, os.path.join(CH, PFX + "q5-down-ladder.png"))
f, ax = C.fig(14, 5.4); labs = [s["name"].replace("today's class: ", "") for s in sides]
C.range_bars(ax, labs, [s["fwd_21"]["med"] for s in sides], [s["fwd_21"]["lo"] for s in sides], [s["fwd_21"]["hi"] for s in sides], base=sides[0]["fwd_21"]["base"], ylabel="SPY next 21 sessions, median %", color_by_sign=False); ax.tick_params(axis="x", labelsize=7.5, rotation=18)
for i, s in enumerate(sides):
    w = s["fwd_21"]["word"]; ax.plot([i], [s["fwd_21"]["med"]], "o", ms=8, color=C.UP if w == "luck-proof" else C.ACCENT if w == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2); ax.text(i, s["fwd_21"]["hi"], f"{s['runs']} visits", ha="center", va="bottom", fontsize=7, color=C.DIM, family="monospace")
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown · visits = separate episodes", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "One-sided sigma days like 23 / 28 Sep (0 up, many down): what SPY did next", "every threshold shown · dot = median, bar = 90% block-bootstrap range")
C.save(f, os.path.join(CH, PFX + "q5-one-sided.png"))
f, ax = C.fig(14, 4.8); ax.plot(Q.index, Q.sg_dn_share, color=C.DN, lw=0.6, label="down-sigma share of names, %"); ax.plot(Q.index, -Q.sg_up_share, color=C.UP, lw=0.6, label="up-sigma share (drawn downward)"); ax.axhline(0, color=C.DIM, lw=0.6)
ax.scatter(Q.index[like], Q.sg_dn_share[like], s=14, color=C.ACCENT, zorder=3, label=f"days like 23 Sep ({int(like.sum())})"); ax.legend(loc="upper left"); ax.grid(axis="y")
C.title(ax, "23 years of USUAL DAY: the share of names beyond their usual day, up and down", "public.sigma_day_counts · share, not count (the universe was smaller in 2003)")
C.save(f, os.path.join(CH, PFX + "q5-history.png"))
f, ax = C.fig(14, 5.4); labs = [t["name"] for t in trig]
C.range_bars(ax, labs, [t["x21"]["med"] for t in trig], [t["x21"]["lo"] for t in trig], [t["x21"]["hi"] for t in trig], base=res["byDirBandState"]["base"]["x21"]["med"], ylabel="the name's next 21 sessions vs SPY, points", color_by_sign=False); ax.tick_params(axis="x", labelsize=7.5, rotation=14)
for i, t in enumerate(trig):
    w = t["x21"]["word"]; ax.plot([i], [t["x21"]["med"]], "o", ms=8, color=C.UP if w == "luck-proof" else C.ACCENT if w == "leaning" else C.PANEL, markeredgecolor=C.LINE, markeredgewidth=1.2); ax.text(i, t["x21"]["hi"], f"{t['n']} events", ha="center", va="bottom", fontsize=7, color=C.DIM, family="monospace")
ax.text(0.01, 0.97, "filled green = luck-proof · grey = leaning · hollow = not shown · dashed = all sigma events' any-day", transform=ax.transAxes, color=C.DIM, fontsize=8.5, va="top")
C.title(ax, "Per-name sigma events as triggers: what the name did in the next 21 sessions, against SPY", "single companies · date-block bootstrap · leaders = each year's top 20 by market cap at the time")
C.save(f, os.path.join(CH, PFX + "q5-triggers.png"))
print("DONE q5"); print(json.dumps(lib.clean({"today": res["today"], "like": res["likeToday"]["n"], "sides": [(s["name"], s["n"], s["fwd_21"]["med"], s["fwd_21"]["word"]) for s in sides], "trig": [(t["name"], t["n"], t["x21"]["med"], t["x21"]["word"]) for t in trig]}), indent=0)[:3000])
