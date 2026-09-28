"""Study C · A Reality Check / SPA test over the rule families Scintilla has published so far.

Inspired by: White (2000) "A Reality Check for Data Snooping" (Econometrica), Hansen (2005) "A test for superior predictive
ability" (JBES), Sullivan, Timmermann & White (1999) "Data-snooping, technical trading rule performance, and the bootstrap"
(J. Finance) — who ran exactly this test over 7,846 technical rules on the Dow — and Romano & Wolf (2005) StepM.
Implementation: arch.bootstrap.SPA / StepM (https://bashtage.github.io/arch/multiple-comparison/multiple-comparisons.html).

The question: of every rule family our studies searched (RSI percentile rungs, RSI-with-200-day states, distance-to-the-
200-day bands, VIX levels and the VIX curve, calendar months), does the BEST rule beat "any day" once the whole search is
counted?  Each rule is long the index for h sessions after it fires and flat otherwise; its performance on day t is
(s_{t-1} − p)·r_t where p is the rule's share of days long, so the benchmark is being long the same share of days
without conditioning — the "any day" line the method standard uses.

Method standard: R4 stationary bootstrap (block 60 ≥ the longest horizon); R5 the test count is what SPA corrects for;
R6 walk-forward (best rule chosen on the first half, judged on the second); R8 effect size in points a year.
"""
import sys, os, json, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rd_data as D, rd_style as S
from arch.bootstrap import SPA, StepM, StationaryBootstrap

ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
OUT = os.path.join(ROOT, "deliverables/20260928/research-director")
CH = os.path.join(OUT, "charts"); os.makedirs(CH, exist_ok=True)
SEED = 20260928; REPS = 1000; BLOCK = 60
HORIZONS = (5, 20, 60)


def rsi_wilder(c, n=14):
    d = c.diff(); up = d.clip(lower=0); dn = -d.clip(upper=0)
    au = up.ewm(alpha=1 / n, adjust=False).mean(); ad = dn.ewm(alpha=1 / n, adjust=False).mean()
    return 100 - 100 / (1 + au / ad)


def expanding_pct(s, min_n=250):
    """Own-history percentile 1..100 of each value against every EARLIER value (no lookahead)."""
    v = s.values; out = np.full(len(v), np.nan)
    order = []
    import bisect
    for i, x in enumerate(v):
        if np.isnan(x): continue
        if len(order) >= min_n:
            out[i] = 100 * bisect.bisect_right(order, x) / len(order)
        bisect.insort(order, x)
    return pd.Series(np.clip(np.ceil(out), 1, 100), index=s.index)


def hold(fire, h):
    """Position = 1 on the h sessions after a fire (fire at close t -> long r_{t+1..t+h})."""
    f = fire.astype(float).values
    c = np.cumsum(f); pos = np.zeros(len(f))
    pos[1:] = (c[:-1] - np.concatenate([np.zeros(h), c[:-h - 1]])[:len(f) - 1] if h < len(f) else c[:-1]) > 0
    return pos


def families(close, vix=None, vix3=None, calendar=False):
    """Returns dict family -> (rule names, position matrix aligned to close.index, positions known at close t apply to r_{t+1})."""
    c = close; fam = {}
    rsi = rsi_wilder(c); pct = expanding_pct(rsi)
    sma200 = c.rolling(200).mean(); above = (c > sma200)
    # F1 RSI rungs 1..100 × horizons
    names, cols = [], []
    for h in HORIZONS:
        for r in range(1, 101):
            names.append(f"RSI pct rung {r} · hold {h}"); cols.append(hold(pct == r, h))
    fam["F1 RSI rungs (100 × 3 horizons)"] = (names, np.column_stack(cols))
    # F2 RSI bottom X% × 200-day side × horizons (the S8 family)
    names, cols = [], []
    for h in HORIZONS:
        for X in (5, 10, 20, 30):
            for side, m in (("above", above), ("below", ~above)):
                names.append(f"RSI bottom {X}% & {side} 200d · hold {h}"); cols.append(hold((pct <= X) & m, h))
            names.append(f"RSI top {X}% & above 200d · hold {h}"); cols.append(hold((pct > 100 - X) & above, h))
    fam["F2 RSI zone × 200-day side (36)"] = (names, np.column_stack(cols))
    # F3 distance to the 200-day bands
    dist = 100 * (c / sma200 - 1); names, cols = [], []
    for h in HORIZONS:
        for X in range(1, 21):
            names.append(f"> {X}% below 200d · hold {h}"); cols.append(hold(dist < -X, h))
            names.append(f"> {X}% above 200d · hold {h}"); cols.append(hold(dist > X, h))
    fam["F3 200-day distance bands (120)"] = (names, np.column_stack(cols))
    if vix is not None:
        vp = expanding_pct(vix.reindex(c.index)); names, cols = [], []
        for h in HORIZONS:
            for p in (50, 60, 70, 80, 90, 95, 99):
                names.append(f"VIX own pct ≥ {p} · hold {h}"); cols.append(hold(vp >= p, h))
            if vix3 is not None:
                ratio = (vix / vix3).reindex(c.index)
                names.append(f"VIX above VIX3M · hold {h}"); cols.append(hold(ratio > 1, h))
        fam["F4 VIX level and curve (24)"] = (names, np.column_stack(cols))
    if calendar:
        names, cols = [], []
        mo = c.index.month
        for m in range(1, 13):
            names.append(f"long in month {m}"); cols.append((mo == m).astype(float))
            names.append(f"long except month {m}"); cols.append((mo != m).astype(float))
        fam["F5 calendar months (24)"] = (names, np.column_stack(cols))
    return fam, pct


def perf_matrix(pos, r):
    """(s_{t-1} − p_k)·r_t, one column per rule; p_k = the rule's long share over the sample."""
    s = pos[:-1]; rr = r[1:]
    p = s.mean(axis=0)
    return (s - p) * rr[:, None], p


def run_spa(perf, names, block=BLOCK, size=0.10):
    losses = -perf                        # SPA is stated in losses; benchmark = "any day" = zero excess
    bench = np.zeros(len(perf))
    spa = SPA(bench, losses, block_size=block, reps=REPS, bootstrap="stationary", seed=SEED); spa.compute()
    pv = spa.pvalues
    best = int(np.argmax(perf.mean(axis=0)))
    stepm = StepM(bench, losses, size=size, block_size=block, reps=REPS, bootstrap="stationary", seed=SEED); stepm.compute()
    sup = [names[i] for i in stepm.superior_models] if len(stepm.superior_models) else []
    return {"n_rules": int(perf.shape[1]), "n_days": int(perf.shape[0]), "best_rule": names[best],
            "best_excess_pts_per_year": round(float(252 * 100 * perf[:, best].mean()), 2),
            "spa_p_consistent": round(float(pv["consistent"]), 3), "spa_p_lower": round(float(pv["lower"]), 3), "reality_check_p_upper": round(float(pv["upper"]), 3),
            "stepm_survivors_10pct": sup}


def naive_p(x, block=BLOCK):
    bs = StationaryBootstrap(block, x, seed=SEED)
    d = np.array([float(np.mean(v[0][0])) for v in bs.bootstrap(REPS)]) - x.mean()
    return float(min(1.0, 2 * min((d >= x.mean()).mean(), (d <= x.mean()).mean()))), (float(np.percentile(d + x.mean(), 5)), float(np.percentile(d + x.mean(), 95)))


def study(label, close, vix=None, vix3=None, calendar=False, split=None):
    r = np.log(close).diff().fillna(0).values
    fams, pct = families(close, vix, vix3, calendar)
    out = {"instrument": label, "from": str(close.index[0].date()), "to": str(close.index[-1].date()), "families": {}}
    all_perf, all_names = [], []
    for fk, (names, pos) in fams.items():
        perf, p = perf_matrix(pos, r)
        keep = ~np.isnan(perf).any(axis=0) & (p > 0.002)          # a rule that never fires is not a rule
        perf, names_k = perf[:, keep], [n for n, k in zip(names, keep) if k]
        if perf.shape[1] == 0: continue
        res = run_spa(perf, names_k)
        best = int(np.argmax(perf.mean(axis=0)))
        pb, rng_b = naive_p(perf[:, best] * 252 * 100)
        res["best_naive_p"] = round(pb, 3); res["best_naive_90_range_pts_per_year"] = [round(rng_b[0], 2), round(rng_b[1], 2)]
        # walk-forward: choose on the first half, judge on the second
        if split is not None:
            cut = close.index.searchsorted(pd.Timestamp(split)) - 1
            first, second = perf[:cut], perf[cut:]
            b1 = int(np.argmax(first.mean(axis=0)))
            p2, rng2 = naive_p(second[:, b1] * 252 * 100)
            res["walk_forward"] = {"split": split, "chosen_on_first_half": names_k[b1], "first_half_pts_per_year": round(float(252 * 100 * first[:, b1].mean()), 2),
                                   "second_half_pts_per_year": round(float(252 * 100 * second[:, b1].mean()), 2), "second_half_90_range": [round(rng2[0], 2), round(rng2[1], 2)], "second_half_p": round(p2, 3)}
        out["families"][fk] = res
        all_perf.append(perf); all_names += names_k
    P = np.column_stack(all_perf)
    out["union"] = run_spa(P, all_names)
    out["union"]["n_rules"] = int(P.shape[1])
    # the rung curve (hold 20) and the luck band for the best of 100
    f1 = fams["F1 RSI rungs (100 × 3 horizons)"]; perf1, p1 = perf_matrix(f1[1], r)
    i20 = [i for i, n in enumerate(f1[0]) if n.endswith("hold 20")]
    curve = 252 * 100 * perf1[:, i20].mean(axis=0)
    # luck band: centre each rule's series, resample, take the max across the 100 rungs
    cen = perf1[:, i20] - perf1[:, i20].mean(axis=0)
    bs = StationaryBootstrap(BLOCK, cen, seed=SEED)
    mx = np.array([float(np.max(252 * 100 * v[0][0].mean(axis=0))) for v in bs.bootstrap(500)])
    out["rung_curve_hold20"] = {"excess_pts_per_year": [round(float(v), 2) for v in curve], "luck_best_of_100_p90": round(float(np.percentile(mx, 90)), 2), "luck_best_of_100_p50": round(float(np.percentile(mx, 50)), 2),
                                "observed_best": round(float(curve.max()), 2), "observed_best_rung": int(np.argmax(curve)) + 1}
    # the slope across rungs (the statistician's reading): Spearman of rung vs excess, block-bootstrap p
    from scipy.stats import spearmanr
    rho = spearmanr(np.arange(1, 101), curve).correlation
    rhos = np.array([spearmanr(np.arange(1, 101), 252 * 100 * v[0][0].mean(axis=0)).correlation for v in StationaryBootstrap(BLOCK, cen, seed=SEED + 7).bootstrap(500)])
    out["rung_slope"] = {"spearman": round(float(rho), 3), "p_two_sided_vs_no_slope": round(float(min(1.0, 2 * min((rhos <= rho).mean(), (rhos >= rho).mean()))), 3)}
    return out


def main():
    R = {"generated": pd.Timestamp.utcnow().isoformat(), "seed": SEED, "reps": REPS, "block": BLOCK, "horizons": HORIZONS, "results": {}}
    spy = D.chart("SPY", "daily-bars-rsi"); vix = D.chart("VIX", "daily-bars-rsi"); vix3 = D.fmp_rows("^VIX3M")
    gspc = D.fmp_index("^GSPC"); qqq = D.chart("QQQ", "daily-bars-rsi"); iwm = D.chart("IWM", "daily-bars-rsi"); dia = D.chart("DIA", "daily-bars-rsi")
    R["results"]["SPY"] = study("SPY 2003→", spy, vix, vix3, calendar=False, split="2015-01-01")
    R["results"]["GSPC"] = study("S&P 500 index 1928→", gspc, None, None, calendar=True, split="1977-01-01")
    R["results"]["QQQ"] = study("QQQ 2003→", qqq, split="2015-01-01")
    R["results"]["IWM"] = study("IWM 2003→", iwm, split="2015-01-01")
    R["results"]["DIA"] = study("DIA 2003→", dia, split="2015-01-01")
    D.save_provenance(os.path.join(OUT, "data/provenance-c.json"))
    json.dump(R, open(os.path.join(OUT, "data/study-c-spa.json"), "w"), indent=1)

    # chart C1: SPA p-values per family per instrument
    f, ax = S.fig(14, 6)
    inst = list(R["results"]); fams = sorted({fk for k in inst for fk in R["results"][k]["families"]})
    width = 0.8 / (len(fams) + 1)
    for j, fk in enumerate(fams + ["UNION of every rule searched"]):
        xs, ys = [], []
        for i, k in enumerate(inst):
            v = R["results"][k]["union"] if fk.startswith("UNION") else R["results"][k]["families"].get(fk)
            if v: xs.append(i + (j - len(fams) / 2) * width); ys.append(v["spa_p_consistent"])
        ax.bar(xs, ys, width=width * 0.95, color=[S.UP if y < 0.10 else S.DN for y in ys], edgecolor=S.INK if fk.startswith("UNION") else "none", lw=0.8, label=fk)
    ax.axhline(0.10, color=S.INK, lw=1, ls="--"); ax.text(len(inst) - 0.5, 0.105, "p = 0.10 line: below it the best rule beats luck", color=S.MUTE, fontsize=9, ha="right")
    ax.set_xticks(range(len(inst))); ax.set_xticklabels([R["results"][k]["instrument"] for k in inst]); ax.set_ylabel("SPA p-value (consistent) for the best rule of the family"); ax.set_ylim(0, 1.05)
    ax.legend(fontsize=8, loc="upper left", ncol=2)
    ax.set_title("C1 · Does the best rule in each family beat 'any day' once the whole search is counted? (Hansen SPA, stationary bootstrap, block 60)")
    S.caption(f, "Green = the family's best rule survives at 10%; red = it does not. Legend order is the bar order within each instrument. Rules: long h sessions after the condition, benchmark = long the same share of days unconditionally.")
    S.save(f, os.path.join(CH, "c1-spa-by-family.png"))

    # chart C2: the 100-rung curve vs the luck band, SPY and GSPC
    f, axes = S.fig(14, 5.5, rows=1, cols=2)
    for ax, k in zip(axes, ("SPY", "GSPC")):
        rc = R["results"][k]["rung_curve_hold20"]; y = np.array(rc["excess_pts_per_year"])
        S.bars_updown(ax, np.arange(1, 101), y)
        ax.axhline(rc["luck_best_of_100_p90"], color=S.INK, lw=1.2, ls="--"); ax.text(99, rc["luck_best_of_100_p90"], "best of 100 by luck alone, 90th pct", color=S.INK2, fontsize=9, ha="right", va="bottom")
        ax.axhline(-rc["luck_best_of_100_p90"], color=S.INK, lw=1.2, ls="--")
        ax.set_xlabel("RSI own-history percentile rung"); ax.set_ylabel("excess over any day, points a year (hold 20 sessions)")
        sl = R["results"][k]["rung_slope"]
        ax.set_title(f"{R['results'][k]['instrument']}: best rung {rc['observed_best_rung']} at {rc['observed_best']:+.1f} vs luck {rc['luck_best_of_100_p90']:+.1f} · slope ρ={sl['spearman']:+.2f} (p={sl['p_two_sided_vs_no_slope']})", fontsize=10)
    f.suptitle("C2 · The 100 RSI rungs against what the best of 100 looks like by luck (stationary bootstrap of the centred rules)", color=S.INK, fontsize=13, fontweight="semibold")
    S.caption(f, "Each bar = mean excess of 'long 20 sessions after RSI sits in that own-history rung' over being long the same share of days unconditionally. Dashed = the 90th percentile of the best rung's excess when every rung is pure luck.")
    S.save(f, os.path.join(CH, "c2-rung-curve-luck-band.png"))

    # chart C3: walk-forward, the rule chosen on the first half judged on the second
    f, ax = S.fig(14, 5.5)
    rows = []
    for k in inst:
        for fk, v in R["results"][k]["families"].items():
            if "walk_forward" in v: rows.append((k, fk, v["walk_forward"]))
    for i, (k, fk, w) in enumerate(rows):
        lo, hi = w["second_half_90_range"]; m = w["second_half_pts_per_year"]
        ax.errorbar(i, m, yerr=[[m - lo], [hi - m]], fmt="o", color=S.UP if lo > 0 else S.DN, capsize=5, lw=1.4, ms=6)
        ax.scatter([i], [w["first_half_pts_per_year"]], marker="_", s=200, color=S.INK, zorder=4)
    ax.axhline(0, color=S.INK, lw=0.8)
    ax.set_xticks(range(len(rows))); ax.set_xticklabels([f"{k} · {fk.split(' (')[0][:22]}" for k, fk, _ in rows], rotation=35, ha="right", fontsize=8)
    ax.set_ylabel("excess, points a year"); ax.set_title("C3 · Walk-forward: the best rule of each family chosen on the first half (white tick) and what it did on the second half (dot, 90% range)")
    S.caption(f, "Green dot = the second-half range clears zero; red = it does not. SPY/QQQ/IWM/DIA split at 2015-01-01; the S&P index split at 1977-01-01.")
    S.save(f, os.path.join(CH, "c3-walk-forward.png"))
    for k in inst:
        print("=====", R["results"][k]["instrument"])
        for fk, v in R["results"][k]["families"].items(): print(" ", fk, v["best_rule"], v["best_excess_pts_per_year"], "naive p", v["best_naive_p"], "SPA", v["spa_p_consistent"], "RC", v["reality_check_p_upper"], "StepM", v["stepm_survivors_10pct"], v.get("walk_forward"))
        print("  UNION", R["results"][k]["union"]); print("  rung", R["results"][k]["rung_curve_hold20"]["observed_best"], R["results"][k]["rung_curve_hold20"]["luck_best_of_100_p90"], R["results"][k]["rung_slope"])


if __name__ == "__main__":
    main()
