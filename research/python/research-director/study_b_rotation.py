"""Study B · Change points in sector relative strength, and a relative-rotation graph (RRG) of Alan's cohorts.

Inspired by: ruptures (https://github.com/deepcharles/ruptures, PELT: Killick, Fearnhead & Eckley 2012), the public RRG
implementations (RRG-Lite https://github.com/BennyThadikaran/RRG-Lite, RRGPy https://github.com/An0n1mity/RRGPy, the
tuhuynh27 TypeScript gist) and the StockCharts RRG description (https://school.stockcharts.com/doku.php?id=chart_analysis:rrg_charts).
JdK's exact constants are proprietary; every open implementation uses the same approximation used here.

Not a redo: the sector-rotation study (28 Sep) measured rank persistence, tier transitions and its own rotation map at
16/72/646 sessions.  This study asks two new questions: (1) WHEN did each sector's trend against SPY last change, found by
a change-point search rather than a fixed window, and does a freshly detected change carry forward (walk-forward test);
(2) where Alan's 20 cohorts sit on the rotation wheel this week, with eight weeks of tail, under the public JdK approximation (26-week window, 4-week momentum; the quadrant is re-checked at 14 and 52 weeks).

Method standard: R2 penalty shown at two strengths, not one; R3 flags counted as episodes; R4 stationary bootstrap;
R6 walk-forward halves; R9 the online test only ever sees bars up to the decision week.
"""
import sys, os, json, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rd_data as D, rd_style as S
import ruptures as rpt
from arch.bootstrap import StationaryBootstrap

ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
OUT = os.path.join(ROOT, "deliverables/20260928/research-director")
CH = os.path.join(OUT, "charts"); os.makedirs(CH, exist_ok=True)
SEED = 20260928


def weekly(s):
    return s.resample("W-FRI").last().dropna(how="all")


def pelt_segments(x, pen, min_size=8, jump=1):
    bk = rpt.Pelt(model="l2", min_size=min_size, jump=jump).fit(x).predict(pen=pen)
    segs, s0 = [], 0
    for b in bk:
        segs.append((s0, b - 1, float(np.mean(x[s0:b])))); s0 = b
    return segs


def boot_mean(a, block, reps=2000, seed=SEED):
    a = np.asarray(a, dtype=float)
    if len(a) < 10:
        return {"n": int(len(a)), "mean": float(np.mean(a)) if len(a) else None, "lo": None, "hi": None}
    bs = StationaryBootstrap(block, a, seed=seed)
    d = np.array([float(np.mean(v[0][0])) for v in bs.bootstrap(reps)])
    return {"n": int(len(a)), "mean": float(np.mean(a)), "lo": float(np.percentile(d, 5)), "hi": float(np.percentile(d, 95))}


def main():
    R = {"generated": pd.Timestamp.utcnow().isoformat(), "seed": SEED}
    sec = D.sectors(); spy = D.chart("SPY", "sector-rotation-20260928")
    W = weekly(pd.concat([sec, spy.rename("SPY")], axis=1))
    rs = np.log(W[list(D.SECTORS)].div(W["SPY"], axis=0))         # relative strength, log points
    drs = rs.diff()                                                # weekly relative return

    # ---------------- 1 · offline change points per sector, two penalty strengths ----------------
    cp = {}
    for pen_mult, tag in ((1.0, "bic"), (2.0, "bic2")):
        cp[tag] = {}
        for s in D.SECTORS:
            x = drs[s].dropna()
            n = len(x); sig = float(x.std()); pen = pen_mult * np.log(n) * sig ** 2
            segs = pelt_segments(x.values, pen)
            rows = [{"from": str(x.index[a].date()), "to": str(x.index[b].date()), "weeks": b - a + 1, "mean_weekly_rel_pct": round(100 * m, 2),
                     "ann_rel_pct": round(100 * m * 52, 1)} for a, b, m in segs]
            cp[tag][s] = {"n_weeks": n, "penalty": pen, "sigma_weekly_pct": round(100 * sig, 2), "segments": rows, "current": rows[-1],
                          "previous": rows[-2] if len(rows) > 1 else None, "n_changes": len(rows) - 1}
    R["changepoints"] = cp

    # chart B1: the 11 relative-strength lines with change points (BIC penalty), current segment slope in the label
    f, axes = S.fig(14, 13, rows=4, cols=3, sharex=False)
    axes = axes.ravel()
    for i, s in enumerate(D.SECTORS):
        ax = axes[i]; x = rs[s].dropna()
        S.updown_line(ax, x.index, 100 * x.values, lw=0.8)
        for seg in cp["bic"][s]["segments"]:
            ax.axvline(pd.Timestamp(seg["from"]), color=S.LINE, lw=0.8)
            a, b = pd.Timestamp(seg["from"]), pd.Timestamp(seg["to"])
            y0 = 100 * x.loc[:a].iloc[-1] if len(x.loc[:a]) else 100 * x.iloc[0]
            ax.plot([a, b], [y0, y0 + seg["mean_weekly_rel_pct"] * seg["weeks"]], color=S.INK, lw=1.2, alpha=0.9)
        cur = cp["bic"][s]["current"]
        ax.set_title(f"{D.SECTORS[s]} ({s}) · since {cur['from']}: {cur['ann_rel_pct']:+.0f}%/yr vs SPY", fontsize=10)
        ax.tick_params(labelsize=8)
    axes[-1].axis("off")
    axes[-1].text(0, 0.9, "Each panel: log relative strength vs SPY\n(green week up, red week down).\nVertical lines = change points found by PELT\non weekly relative returns (BIC penalty).\nWhite segments = the mean slope PELT fitted\nto each stretch. The title gives the current\nstretch's start and its pace against SPY.", color=S.INK2, fontsize=10, va="top")
    f.suptitle("B1 · When each sector's trend against SPY last changed (change-point search, weekly, 2003 → 25 Sep 2026)", color=S.INK, fontsize=13, fontweight="semibold")
    S.caption(f, "ruptures Pelt, l2 cost, min segment 8 weeks, penalty log(n)·σ² per sector. Offline: the most recent change can still move as weeks arrive. XLRE from 2015-10, XLC from 2018-06.")
    S.save(f, os.path.join(CH, "b1-sector-changepoints.png"))

    # ---------------- 2 · does a fresh change carry forward? online, every 4 weeks, walk-forward ----------------
    flags = []   # one row per (decision week, sector) where a change point sits within the last 8 weeks
    weeks = drs.index
    start = weeks.searchsorted(pd.Timestamp("2008-01-01"))
    H = 13
    for wi in range(start, len(weeks) - H, 4):
        for s in D.SECTORS:
            x = drs[s].iloc[max(0, wi + 1 - 520):wi + 1].dropna()      # the last ten years of weeks, as a nightly job would hold
            if len(x) < 104:
                continue
            n = len(x); pen = np.log(n) * float(x.std()) ** 2
            segs = pelt_segments(x.values, pen, jump=2)
            if len(segs) < 2:
                continue
            a, b, m = segs[-1]
            age = b - a + 1
            if age <= 8:
                prev_m = segs[-2][2]
                fwd = float(rs[s].iloc[wi + H] - rs[s].iloc[wi])
                flags.append({"week": str(weeks[wi].date()), "sector": s, "age_weeks": int(age), "direction": "up" if m > prev_m else "down",
                              "new_mean_weekly_pct": round(100 * m, 2), "prev_mean_weekly_pct": round(100 * prev_m, 2), "fwd13_rel_pct": round(100 * fwd, 2)})
    F = pd.DataFrame(flags)
    # the unflagged comparison: every (decision week, sector) pair on the same grid
    base = []
    for wi in range(start, len(weeks) - H, 4):
        for s in D.SECTORS:
            if pd.notna(rs[s].iloc[wi]) and pd.notna(rs[s].iloc[wi + H]):
                base.append(float(rs[s].iloc[wi + H] - rs[s].iloc[wi]))
    res = {"decision_grid": "every 4th week from 2008-01, horizon 13 weeks, sector relative return vs SPY (log points)",
           "flags_total": int(len(F)), "any_pair_fwd13": boot_mean(100 * np.array(base), 3)}
    halves = {"first_2008_2016": F[F.week < "2017-01-01"], "second_2017_2026": F[F.week >= "2017-01-01"], "all": F}
    for hk, Fh in halves.items():
        res[hk] = {}
        for d in ("up", "down"):
            sub = Fh[Fh.direction == d]
            res[hk][d] = boot_mean(sub.fwd13_rel_pct.values, 3)
            res[hk][d]["share_positive"] = round(100 * float((sub.fwd13_rel_pct > 0).mean()), 1) if len(sub) else None
            res[hk][d]["episodes"] = int(sub.groupby("sector").week.apply(lambda w: (pd.to_datetime(w).diff().dt.days.fillna(999) > 60).sum()).sum()) if len(sub) else 0
    R["fresh_change_forward"] = res
    F.to_json(os.path.join(OUT, "data/study-b-flags.json"), orient="records", indent=1)

    f, ax = S.fig(14, 5)
    if len(F):
        for d, col, off in (("up", S.UP, -0.18), ("down", S.DN, 0.18)):
            for j, hk in enumerate(("first_2008_2016", "second_2017_2026", "all")):
                r0 = res[hk][d]
                if r0["lo"] is not None:
                    ax.errorbar(j + off, r0["mean"], yerr=[[r0["mean"] - r0["lo"]], [r0["hi"] - r0["mean"]]], fmt="o", color=col, capsize=6, lw=1.6, ms=7)
                    ax.text(j + off, r0["hi"] + 0.3, f"n={r0['n']}", color=col, ha="center", fontsize=9, family=S.MONO)
        b = res["any_pair_fwd13"]; ax.axhline(b["mean"], color=S.INK, lw=1, ls="--"); ax.text(2.45, b["mean"], "any sector, any week", color=S.MUTE, fontsize=9, va="bottom", ha="right")
        ax.set_xticks([0, 1, 2]); ax.set_xticklabels(["2008–2016", "2017–2026", "all"]); ax.set_ylabel("relative return vs SPY over the next 13 weeks, points")
        ax.set_title("B2 · After a freshly detected change (≤ 8 weeks old): green = the new stretch is stronger than the last, red = weaker. Dots = mean, bars = 90% resampled range")
        S.caption(f, "Online: the search at each decision week only sees bars to that week. Decision grid every 4 weeks, so neighbouring flags overlap; the range resamples runs of flags (block 3).")
    S.save(f, os.path.join(CH, "b2-fresh-change-forward.png"))

    # ---------------- 3 · RRG of Alan's cohorts (and the 11 sectors) under the public JdK approximation ----------------
    cohorts = D.cohorts(ROOT)
    idx = {}
    members_used = {}
    for cid, label, tickers in cohorts:
        rets = []
        for t in tickers:
            try:
                c = D.name_close(t)
            except FileNotFoundError:
                continue
            rets.append(np.log(c).diff().rename(t))
        if not rets:
            continue
        Rm = pd.concat(rets, axis=1)
        ew = Rm.mean(axis=1, skipna=True)          # equal weight of the members that exist on each day
        cnt = Rm.notna().sum(axis=1)
        ew = ew[cnt >= max(1, min(3, len(tickers)))]
        idx[cid] = np.exp(ew.cumsum())
        members_used[cid] = {"label": label, "n": int(Rm.shape[1]), "first_day_with_3": str(ew.index[0].date())}
    CI = pd.concat(idx, axis=1)
    spyd = D.chart("SPY", "daily-bars-rsi")
    Wc = weekly(pd.concat([CI, spyd.rename("SPY")], axis=1))

    def rrg(Wx, bench, win=26, mom=4):
        rsx = 100 * Wx.div(Wx[bench], axis=0)
        ratio = 100 + (rsx - rsx.rolling(win).mean()) / rsx.rolling(win).std()
        roc = ratio.pct_change(mom) * 100
        momz = 100 + (roc - roc.rolling(win).mean()) / roc.rolling(win).std()
        return ratio, momz

    def quadrant(x, y):
        if x >= 100 and y >= 100: return "LEADING"
        if x >= 100: return "WEAKENING"
        if y >= 100: return "IMPROVING"
        return "LAGGING"

    rrg_out = {}
    for name, Wx, cols, labels in (("cohorts", Wc, list(CI.columns), {k: v["label"] for k, v in members_used.items()}),
                                   ("sectors", W, list(D.SECTORS), D.SECTORS)):
        ratio, momz = rrg(Wx, "SPY")
        table = []
        for c in cols:
            if c not in ratio or pd.isna(ratio[c].iloc[-1]):
                continue
            q = quadrant(ratio[c].iloc[-1], momz[c].iloc[-1])
            # weeks in the current quadrant
            k = 0
            for i in range(len(ratio) - 1, -1, -1):
                if pd.isna(ratio[c].iloc[i]) or quadrant(ratio[c].iloc[i], momz[c].iloc[i]) != q: break
                k += 1
            # stability of the quadrant across windows 8 / 12 / 20
            qs = []
            for wv in (14, 26, 52):
                ra, mo = rrg(Wx, "SPY", win=wv)
                qs.append(quadrant(ra[c].iloc[-1], mo[c].iloc[-1]) if pd.notna(ra[c].iloc[-1]) else None)
            table.append({"id": c, "label": labels.get(c, c), "rs_ratio": round(float(ratio[c].iloc[-1]), 2), "rs_momentum": round(float(momz[c].iloc[-1]), 2),
                          "quadrant": q, "weeks_in_quadrant": k, "quadrant_by_window_14_26_52": qs, "same_in_all_windows": len(set(qs)) == 1,
                          "rel_13w_pct": round(100 * float(np.log(Wx[c].iloc[-1] / Wx[c].iloc[-14]) - np.log(Wx["SPY"].iloc[-1] / Wx["SPY"].iloc[-14])), 1)})
        table.sort(key=lambda r: -r["rs_ratio"])
        rrg_out[name] = {"as_of": str(ratio.index[-1].date()), "window_weeks": 26, "momentum_weeks": 4, "benchmark": "SPY", "table": table}
        # chart
        f, ax = S.fig(11, 10)
        tail = 8
        for c in cols:
            if c not in ratio or pd.isna(ratio[c].iloc[-1]): continue
            xs = ratio[c].iloc[-tail:].values; ys = momz[c].iloc[-tail:].values
            col = S.UP if quadrant(xs[-1], ys[-1]) in ("LEADING", "IMPROVING") else S.DN
            ax.plot(xs, ys, color=col, lw=1.0, alpha=0.7)
            ax.scatter(xs[:-1], ys[:-1], s=10, color=col, alpha=0.6)
            ax.scatter([xs[-1]], [ys[-1]], s=60, color=col, edgecolor=S.INK, lw=0.6, zorder=5)
            ax.annotate(labels.get(c, c) if name == "sectors" else c, (xs[-1], ys[-1]), xytext=(5, 4), textcoords="offset points", fontsize=8, color=S.INK)
        ax.axhline(100, color=S.INK, lw=0.8); ax.axvline(100, color=S.INK, lw=0.8)
        lim = max(3.0, np.nanmax(np.abs(np.concatenate([ratio[cols].iloc[-tail:].values.ravel() - 100, momz[cols].iloc[-tail:].values.ravel() - 100]))) + 0.3)
        ax.set_xlim(100 - lim, 100 + lim); ax.set_ylim(100 - lim, 100 + lim)
        for txt, pos in (("LEADING", (1, 1)), ("WEAKENING", (1, 0)), ("LAGGING", (0, 0)), ("IMPROVING", (0, 1))):
            ax.text(100 + (lim - 0.15) * (1 if pos[0] else -1), 100 + (lim - 0.15) * (1 if pos[1] else -1), txt, color=S.MUTE, fontsize=11, family=S.MONO,
                    ha="right" if pos[0] else "left", va="top" if pos[1] else "bottom")
        ax.set_xlabel("RS-Ratio (relative strength vs SPY, z-scored over 26 weeks, +100)"); ax.set_ylabel("RS-Momentum (4-week change of RS-Ratio, z-scored, +100)")
        ax.set_title(f"B{'3' if name == 'cohorts' else '4'} · Rotation graph of {'Alan’s 20 cohorts' if name == 'cohorts' else 'the 11 SPDR sectors'} vs SPY, week ending {ratio.index[-1].date()}, 8-week tails")
        S.caption(f, "Public JdK approximation (RS = 100·price÷SPY; ratio = z-score over 26 weeks + 100; momentum = z-score of the 4-week change + 100). Green = leading or improving, red = weakening or lagging. Cohort index = equal weight of today's members: survivorship applies to the past, not to this week's position.")
        S.save(f, os.path.join(CH, f"b{'3' if name == 'cohorts' else '4'}-rrg-{name}.png"))
    R["rrg"] = rrg_out; R["cohorts"] = members_used
    D.save_provenance(os.path.join(OUT, "data/provenance-b.json"))
    json.dump(R, open(os.path.join(OUT, "data/study-b-rotation.json"), "w"), indent=1)
    print(json.dumps(res, indent=1))
    for r in rrg_out["cohorts"]["table"]: print(r["id"], r["quadrant"], r["rs_ratio"], r["rs_momentum"], r["weeks_in_quadrant"], r["quadrant_by_window_14_26_52"])
    for s in D.SECTORS: print(s, cp["bic"][s]["n_changes"], cp["bic"][s]["current"], "| bic2", cp["bic2"][s]["n_changes"], cp["bic2"][s]["current"]["from"])


if __name__ == "__main__":
    main()
