"""Study A · Market states that fall out of the data (hidden Markov model), with today's filtered probability.

Inspired by: hmmlearn (https://github.com/hmmlearn/hmmlearn), Hamilton (1989) regime switching as used in statsmodels'
MarkovRegression notebook, QuantStart's "Market regime detection using hidden Markov models", and Kritzman, Page &
Turkington (2012) "Regime shifts: implications for dynamic strategies" (FAJ), who fit two-state HMMs to returns and turbulence.

What is different from the market-regime study already published: that study asked six named questions (equal weight,
VIX curve, credit, yields, seasonality, the Fed). This one asks the data to name the states itself, reports how long each
lasts, and reports TODAY'S probability computed only from bars up to today (filtered, never smoothed), out of sample.

Method standard: R3 episodes counted; R4 stationary block bootstrap; R6 walk-forward (fit on the first half, filter the
second); R8 effect size as the shift of the forward distribution; R9 no lookahead (filtered probabilities); R10 three numbers.
"""
import sys, os, json, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rd_data as D, rd_style as S
from hmmlearn.hmm import GaussianHMM
from scipy.stats import multivariate_normal
import ruptures as rpt
from arch.bootstrap import StationaryBootstrap

ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
OUT = os.path.join(ROOT, "deliverables/20260928/research-director")
CH = os.path.join(OUT, "charts"); os.makedirs(CH, exist_ok=True)
SEED = 20260928
rng = np.random.default_rng(SEED)


# ---------- forward filter: P(state_t | x_1..x_t) using the fitted parameters only ----------
def filtered_probs(model, X):
    K = model.n_components
    logB = np.column_stack([multivariate_normal(model.means_[k], model.covars_[k], allow_singular=True).logpdf(X) for k in range(K)])
    A = model.transmat_; alpha = np.zeros((len(X), K))
    a = model.startprob_ * np.exp(logB[0] - logB[0].max()); alpha[0] = a / a.sum()
    for t in range(1, len(X)):
        a = (alpha[t - 1] @ A) * np.exp(logB[t] - logB[t].max()); alpha[t] = a / a.sum()
    return alpha


def fit_best(X, k, seeds=8):
    best = None
    for s in range(seeds):
        m = GaussianHMM(n_components=k, covariance_type="full", n_iter=500, tol=1e-4, random_state=SEED + s)
        try:
            m.fit(X)
        except Exception:
            continue
        ll = m.score(X)
        if best is None or ll > best[0]:
            best = (ll, m)
    ll, m = best
    order = np.argsort(np.sqrt(np.array([m.covars_[i][0, 0] for i in range(k)])))   # calm first, by return volatility
    # relabel so state 0 = calmest
    m2 = GaussianHMM(n_components=k, covariance_type="full")
    m2.startprob_ = m.startprob_[order]; m2.transmat_ = m.transmat_[np.ix_(order, order)]
    m2.means_ = m.means_[order]; m2.covars_ = np.array([m.covars_[i] for i in order]); m2.n_features = X.shape[1]
    return m2, ll


def runs(flag):
    out, s = [], None
    for i, v in enumerate(flag):
        if v and s is None: s = i
        if not v and s is not None: out.append((s, i - 1)); s = None
    if s is not None: out.append((s, len(flag) - 1))
    return out


def boot_diff(a, b, block, reps=2000):
    """90% stationary-bootstrap range for mean(a) - mean(b), each resampled in runs of days; p = share of draws on the other side of 0."""
    if len(a) < 30 or len(b) < 30:
        return None
    def stat(x): return float(np.mean(x))
    ra = np.array([stat(v[0][0]) for v in StationaryBootstrap(block, a, seed=SEED).bootstrap(reps)])
    rb = np.array([stat(v[0][0]) for v in StationaryBootstrap(block, b, seed=SEED + 1).bootstrap(reps)])
    d = ra - rb; est = stat(a) - stat(b)
    return {"est": est, "lo": float(np.percentile(d, 5)), "hi": float(np.percentile(d, 95)), "p": float(min(1.0, 2 * min((d <= 0).mean(), (d >= 0).mean())))}


def describe_states(P, r, fwd20, vol20f, dates, names, block=20):
    """Per filtered state (argmax at t, information to t): next-day return, next-20 return, next-20 realised vol; episodes; durations."""
    st = P.argmax(1); res = []
    for k in range(P.shape[1]):
        m = st == k
        ep = runs(m)
        durs = [e - s + 1 for s, e in ep]
        res.append({"state": names[k], "days": int(m.sum()), "share_of_days": round(100 * m.mean(), 1), "episodes": len(ep),
                    "duration_median": float(np.median(durs)) if durs else None, "duration_p90": float(np.percentile(durs, 90)) if durs else None,
                    "next_day_mean_pct": round(100 * r[m].mean(), 3), "next_day_sd_pct": round(100 * r[m].std(), 2),
                    "next20_median_pct": round(100 * np.nanmedian(fwd20[m]), 2), "next20_mean_pct": round(100 * np.nanmean(fwd20[m]), 2),
                    "next20_p10_pct": round(100 * np.nanpercentile(fwd20[m], 10), 2), "next20_share_up": round(100 * np.nanmean(fwd20[m] > 0), 1),
                    "next20_realised_vol_ann_pct": round(100 * np.nanmedian(vol20f[m]), 1),
                    "last_start": str(dates[ep[-1][0]].date()) if ep else None})
    return res


def main():
    R = {"generated": pd.Timestamp.utcnow().isoformat(), "seed": SEED, "models": {}}
    gspc = D.fmp_index("^GSPC"); vix = D.chart("VIX", "daily-bars-rsi"); vix3 = D.fmp_rows("^VIX3M")
    spy = D.chart("SPY", "daily-bars-rsi"); rsp = D.chart("RSP", "sector-rotation-20260928")

    names2 = ["CALM", "STRESS"]; names3 = ["CALM", "MIDDLE", "STRESS"]
    # ---------------- Model A0: S&P 500 returns only, 1928 -> today (the classic two-state fit) ----------------
    r0 = np.log(gspc).diff().dropna(); X0 = r0.values[:, None]; d0 = r0.index; c0 = gspc.reindex(d0).values
    m0, ll0 = fit_best(X0, 2)
    P0 = filtered_probs(m0, X0)
    cut0 = d0.searchsorted(pd.Timestamp("1977-01-01")); m0w, _ = fit_best(X0[:cut0], 2); P0w = filtered_probs(m0w, X0)
    f0 = np.full(len(r0), np.nan); f0[:-20] = np.log(c0[20:] / c0[:-20])
    v0 = pd.Series(r0.values)[::-1].rolling(20).std()[::-1].shift(-1).values * np.sqrt(252)
    A0 = m0.transmat_
    R["models"]["A0_gspc_returns_only_1928"] = {
        "loglik": float(ll0), "n_days": int(len(X0)), "from": str(d0[0].date()), "to": str(d0[-1].date()), "features": ["S&P 500 log return"],
        "states": [{"name": names2[i], "mean_daily_ret_pct": round(100 * m0.means_[i][0], 3), "ann_vol_pct": round(100 * np.sqrt(m0.covars_[i][0, 0] * 252), 1),
                    "stay_prob": round(float(A0[i, i]), 4), "expected_duration_days": round(float(1 / (1 - A0[i, i])), 1)} for i in range(2)],
        "transition": np.round(A0, 4).tolist(), "walk_forward_cut": str(d0[cut0].date()),
        "today": {"date": str(d0[-1].date()), "filtered_full_fit": {names2[i]: round(float(P0[-1, i]), 3) for i in range(2)}, "filtered_walk_forward": {names2[i]: round(float(P0w[-1, i]), 3) for i in range(2)}},
        "by_state_full_fit": describe_states(P0, r0.values, f0, v0, d0, names2),
        "by_state_walk_forward_oos": describe_states(P0w[cut0:], r0.values[cut0:], f0[cut0:], v0[cut0:], d0[cut0:], names2),
    }
    stw = P0w[cut0:].argmax(1); ff = f0[cut0:]; vv = v0[cut0:]
    R["models"]["A0_gspc_returns_only_1928"]["oos_stress_minus_calm_next20_ret"] = boot_diff(ff[(stw == 1) & ~np.isnan(ff)], ff[(stw == 0) & ~np.isnan(ff)], 20)
    R["models"]["A0_gspc_returns_only_1928"]["oos_stress_minus_calm_next20_vol"] = boot_diff(vv[(stw == 1) & ~np.isnan(vv)], vv[(stw == 0) & ~np.isnan(vv)], 20)

    # ---------------- Model A: S&P 500 return + VIX level, 1990 -> today ----------------
    df = pd.concat([np.log(gspc).diff().rename("r"), np.log(vix).rename("lv")], axis=1).dropna()
    df = df[df.index >= "1990-01-03"]
    X = df.values; dates = df.index
    r = df["r"].values
    close = gspc.reindex(dates).values
    fwd20 = np.full(len(r), np.nan); fwd20[:-20] = np.log(close[20:] / close[:-20])
    vol20f = np.full(len(r), np.nan); rs = pd.Series(r)
    v = rs[::-1].rolling(20).std()[::-1].shift(-1).values * np.sqrt(252); vol20f[:] = v
    out = {}
    for k, names in ((2, names2), (3, names3)):
        m, ll = fit_best(X, k)
        Pf = filtered_probs(m, X)
        # walk-forward: fit on 1990-2007 (the first half of the record by years), filter 2008-2026 with frozen parameters
        cut = dates.searchsorted(pd.Timestamp("2008-01-01"))
        mw, _ = fit_best(X[:cut], k)
        Pw = filtered_probs(mw, X)     # forward pass over everything, parameters from the first half only
        A = m.transmat_
        out[f"k{k}"] = {
            "loglik": float(ll), "n_days": int(len(X)), "from": str(dates[0].date()), "to": str(dates[-1].date()),
            "states": [{"name": names[i], "mean_daily_ret_pct": round(100 * m.means_[i][0], 3), "daily_vol_pct": round(100 * np.sqrt(m.covars_[i][0, 0]), 2),
                        "ann_vol_pct": round(100 * np.sqrt(m.covars_[i][0, 0] * 252), 1), "typical_vix": round(float(np.exp(m.means_[i][1])), 1),
                        "stay_prob": round(float(A[i, i]), 4), "expected_duration_days": round(float(1 / (1 - A[i, i])), 1)} for i in range(k)],
            "transition": np.round(A, 4).tolist(),
            "today": {"date": str(dates[-1].date()), "filtered_full_fit": {names[i]: round(float(Pf[-1, i]), 3) for i in range(k)},
                      "filtered_walk_forward": {names[i]: round(float(Pw[-1, i]), 3) for i in range(k)}},
            "by_state_full_fit": describe_states(Pf, r, fwd20, vol20f, dates, names),
            "by_state_walk_forward_oos": describe_states(Pw[cut:], r[cut:], fwd20[cut:], vol20f[cut:], dates[cut:], names),
            "walk_forward_cut": str(dates[cut].date()),
        }
        # effect sizes out of sample: stress vs calm, next-20 return and next-20 realised vol, block bootstrap
        stw = Pw[cut:].argmax(1); f = fwd20[cut:]; vv = vol20f[cut:]
        a, b = f[(stw == k - 1) & ~np.isnan(f)], f[(stw == 0) & ~np.isnan(f)]
        out[f"k{k}"]["oos_stress_minus_calm_next20_ret"] = boot_diff(a, b, 20)
        a, b = vv[(stw == k - 1) & ~np.isnan(vv)], vv[(stw == 0) & ~np.isnan(vv)]
        out[f"k{k}"]["oos_stress_minus_calm_next20_vol"] = boot_diff(a, b, 20)
        # against the 200-day: what does the state add inside each 200-day side (out of sample)
        sma = pd.Series(close, index=dates).rolling(200).mean().values
        above = (close > sma)[cut:]
        cross = {}
        for side, mask in (("above_200d", above), ("below_200d", ~above)):
            c = {}
            for i in range(k):
                mm = mask & (stw == i) & ~np.isnan(f)
                c[names[i]] = {"days": int(mm.sum()), "next20_median_pct": round(100 * float(np.median(f[mm])), 2) if mm.sum() else None,
                               "next20_p10_pct": round(100 * float(np.percentile(f[mm], 10)), 2) if mm.sum() else None,
                               "next20_vol_ann_pct": round(100 * float(np.nanmedian(vv[mm])), 1) if mm.sum() else None}
            cross[side] = c
        out[f"k{k}"]["oos_by_200day_side"] = cross
        if k == 2:
            Pf2, Pw2, m2 = Pf, Pw, m
    R["models"]["A_gspc_vix_1990"] = out

    # Charts for model A (2 states)
    stress_f = Pf2[:, 1]; stress_w = Pw2[:, 1]
    f, ax = S.fig(14, 6.5)
    S.updown_line(ax, dates, close, lw=0.9)
    ax.set_yscale("log"); ax.set_ylabel("S&P 500 (log scale)")
    ax2 = ax.twinx(); ax2.fill_between(dates, 0, stress_f, color=S.DN, alpha=0.22, lw=0); ax2.set_ylim(0, 1); ax2.set_ylabel("probability of the STRESS state (full-sample fit)", color=S.MUTE); ax2.grid(False)
    ax.set_title("A1 · The S&P 500 since 1990 with the data's own STRESS state shaded (two-state hidden Markov model on daily return + VIX level)")
    S.caption(f, "Shade = filtered probability of the high-volatility state (bars up to each day only). Price line: green day up, red day down. Source: FMP ^GSPC and ^VIX via the chart API cache. Features: daily log return and log VIX level.")
    S.save(f, os.path.join(CH, "a1-gspc-stress-shade.png"))

    f, ax = S.fig(14, 5)
    i0 = dates.searchsorted(pd.Timestamp("2023-09-01"))
    ax.plot(dates[i0:], stress_w[i0:], color=S.DN, lw=1.4, label="walk-forward (parameters from 1990–2007 only)")
    ax.plot(dates[i0:], stress_f[i0:], color=S.DN, lw=1.0, alpha=0.45, ls="--", label="full-sample parameters")
    ax.set_ylim(0, 1); ax.set_ylabel("probability of STRESS"); ax.legend(loc="upper left")
    ax3 = ax.twinx(); S.updown_line(ax3, dates[i0:], close[i0:], lw=0.9); ax3.grid(False); ax3.set_ylabel("S&P 500", color=S.MUTE)
    ax.set_title(f"A2 · The last three years: STRESS probability day by day, and today's reading ({dates[-1].date()}: walk-forward {stress_w[-1]:.2f}, full fit {stress_f[-1]:.2f})")
    S.caption(f, "Filtered, never smoothed: each day's number uses only bars up to that day. The dashed line re-uses the whole record's parameters; the solid one froze them at end-2007.")
    S.save(f, os.path.join(CH, "a2-stress-last3y.png"))

    f, ax = S.fig(14, 5)
    st = Pf2.argmax(1)
    bins = np.linspace(-0.08, 0.08, 81)
    ax.hist(100 * r[st == 0], bins=100 * bins, color=S.UP, alpha=0.75, density=True, label=f"CALM days (n={int((st==0).sum())})")
    ax.hist(100 * r[st == 1], bins=100 * bins, color=S.DN, alpha=0.55, density=True, label=f"STRESS days (n={int((st==1).sum())})")
    ax.set_xlabel("next-day S&P 500 return, %"); ax.set_ylabel("density"); ax.legend()
    ax.set_title("A3 · What a day looks like inside each state: the STRESS state is wider, not simply negative")
    S.caption(f, "Full-sample two-state fit, 1990-01-03 → 2026-09-25. Densities, so the two areas compare although CALM has many more days.")
    S.save(f, os.path.join(CH, "a3-state-return-densities.png"))

    # ---------------- ruptures: change points in realised volatility ----------------
    rv = pd.Series(r, index=dates).rolling(20).std().dropna() * np.sqrt(252)
    x = np.log(rv.values)
    # Penalty stated in plain terms, not the library default: with an l2 cost, splitting a stretch whose two halves (L sessions
    # each) differ by Δ in log volatility gains L·Δ²/2.  Penalty = that gain for L = 60 sessions and Δ = log(1.4): a change
    # counts when volatility shifts by 40% and holds for three months either side.  A 25% version is kept as the sensitivity row.
    algo = rpt.Pelt(model="l2", min_size=60, jump=5).fit(x)
    segsets = {}
    for shift in (1.40, 1.25):
        pen = 60 * np.log(shift) ** 2 / 2
        bk = algo.predict(pen=pen)
        segs = []; s0 = 0
        for b in bk:
            seg = rv.iloc[s0:b]
            segs.append({"from": str(seg.index[0].date()), "to": str(seg.index[-1].date()), "days": int(len(seg)), "median_ann_vol_pct": round(100 * float(seg.median()), 1)}); s0 = b
        segsets[f"shift_{int(round(100 * (shift - 1)))}pct"] = {"penalty": float(pen), "segments": segs, "n_segments": len(segs), "last_change": segs[-1]["from"]}
    segs = segsets["shift_40pct"]["segments"]
    R["ruptures_realised_vol"] = {"rule": "l2 cost on log 20-day realised vol; min segment 60; penalty = 60·log(shift)²/2", "primary": "shift_40pct", **segsets, "today_vol_ann_pct": round(100 * float(rv.iloc[-1]), 1)}
    f, ax = S.fig(14, 5)
    S.updown_line(ax, rv.index, 100 * rv.values, lw=0.8)
    for sgm in segs:
        ax.hlines(sgm["median_ann_vol_pct"], pd.Timestamp(sgm["from"]), pd.Timestamp(sgm["to"]), color=S.INK, lw=1.6)
        ax.axvline(pd.Timestamp(sgm["from"]), color=S.LINE, lw=0.8)
    ax.set_yscale("log"); ax.set_ylabel("20-day realised volatility, % a year (log)")
    ax.set_title(f"A4 · Where realised volatility changed level (PELT change points, {len(segs)} segments since 1990, a change = 40% shift held 60 sessions); the current segment began {segs[-1]['from']} at a median {segs[-1]['median_ann_vol_pct']}%")
    S.caption(f, "ruptures Pelt, l2 cost on log volatility, min segment 60 sessions, penalty = the gain of a 40% level shift held 60 sessions either side. Level bars = each segment's median. Offline: the last segment can still move.")
    S.save(f, os.path.join(CH, "a4-vol-changepoints.png"))

    # ---------------- Model B: SPY + breadth proxy + VIX curve, 2006 -> today ----------------
    dfb = pd.concat([np.log(spy).diff().rename("r"), np.log(vix).diff().rename("dv"),
                     (np.log(rsp).diff() - np.log(spy).diff()).rename("ew_spread"),
                     np.log(vix / vix3).rename("curve")], axis=1).dropna()
    Xb = dfb.values; datesb = dfb.index; rb = dfb["r"].values; closeb = spy.reindex(datesb).values
    fwd20b = np.full(len(rb), np.nan); fwd20b[:-20] = np.log(closeb[20:] / closeb[:-20])
    vol20b = pd.Series(rb)[::-1].rolling(20).std()[::-1].shift(-1).values * np.sqrt(252)
    outb = {}
    for k, names in ((2, names2), (3, names3)):
        m, ll = fit_best(Xb, k)
        Pf = filtered_probs(m, Xb)
        cut = datesb.searchsorted(pd.Timestamp("2016-07-01"))
        mw, _ = fit_best(Xb[:cut], k); Pw = filtered_probs(mw, Xb)
        A = m.transmat_
        outb[f"k{k}"] = {"loglik": float(ll), "n_days": int(len(Xb)), "from": str(datesb[0].date()), "to": str(datesb[-1].date()),
                         "features": ["SPY log return", "VIX log change", "RSP − SPY daily return (breadth proxy)", "log(VIX ÷ VIX3M)"],
                         "states": [{"name": names[i], "mean_daily_ret_pct": round(100 * m.means_[i][0], 3), "ann_vol_pct": round(100 * np.sqrt(m.covars_[i][0, 0] * 252), 1),
                                     "mean_ew_spread_bp": round(1e4 * m.means_[i][2], 1), "mean_log_curve": round(float(m.means_[i][3]), 3),
                                     "stay_prob": round(float(A[i, i]), 4), "expected_duration_days": round(float(1 / (1 - A[i, i])), 1)} for i in range(k)],
                         "transition": np.round(A, 4).tolist(),
                         "today": {"date": str(datesb[-1].date()), "filtered_full_fit": {names[i]: round(float(Pf[-1, i]), 3) for i in range(k)},
                                   "filtered_walk_forward": {names[i]: round(float(Pw[-1, i]), 3) for i in range(k)}},
                         "by_state_full_fit": describe_states(Pf, rb, fwd20b, vol20b, datesb, names),
                         "by_state_walk_forward_oos": describe_states(Pw[cut:], rb[cut:], fwd20b[cut:], vol20b[cut:], datesb[cut:], names),
                         "walk_forward_cut": str(datesb[cut].date())}
        stw = Pw[cut:].argmax(1); fb = fwd20b[cut:]; vv = vol20b[cut:]
        a, b = fb[(stw == k - 1) & ~np.isnan(fb)], fb[(stw == 0) & ~np.isnan(fb)]
        outb[f"k{k}"]["oos_stress_minus_calm_next20_ret"] = boot_diff(a, b, 20)
        a, b = vv[(stw == k - 1) & ~np.isnan(vv)], vv[(stw == 0) & ~np.isnan(vv)]
        outb[f"k{k}"]["oos_stress_minus_calm_next20_vol"] = boot_diff(a, b, 20)
        if k == 3:
            Pf3, Pw3 = Pf, Pw
    R["models"]["B_spy_breadth_vixcurve_2006"] = outb

    f, ax = S.fig(14, 5.5)
    i0 = datesb.searchsorted(pd.Timestamp("2024-09-01"))
    ax.stackplot(datesb[i0:], Pw3[i0:, 0], Pw3[i0:, 1], Pw3[i0:, 2], colors=[S.UP, S.MUTE, S.DN], alpha=0.55, labels=names3)
    ax.set_ylim(0, 1); ax.set_ylabel("filtered probability (walk-forward)"); ax.legend(loc="upper left", ncol=3)
    ax4 = ax.twinx(); S.updown_line(ax4, datesb[i0:], closeb[i0:], lw=0.9); ax4.grid(False); ax4.set_ylabel("SPY", color=S.MUTE)
    t = outb["k3"]["today"]["filtered_walk_forward"]
    ax.set_title(f"A5 · Three states from SPY, the equal-weight spread and the VIX curve, last two years — today CALM {t['CALM']:.2f} · MIDDLE {t['MIDDLE']:.2f} · STRESS {t['STRESS']:.2f}")
    S.caption(f, "Parameters fitted on 2006-07 → 2016-06 only; every later day is filtered forward with them. MIDDLE is the state between calm and stress by return volatility.")
    S.save(f, os.path.join(CH, "a5-three-state-stack.png"))

    D.save_provenance(os.path.join(OUT, "data/provenance-a.json"))
    json.dump(R, open(os.path.join(OUT, "data/study-a-regime.json"), "w"), indent=1)
    print(json.dumps({k: v["today"] for k, v in out.items()}, indent=1)); print(json.dumps({k: v["today"] for k, v in outb.items()}, indent=1))
    print("rv segments", segs[-3:])
    for k in ("k2", "k3"):
        print(k, "A oos", out[k]["oos_stress_minus_calm_next20_ret"], out[k]["oos_stress_minus_calm_next20_vol"])
        print(k, "B oos", outb[k]["oos_stress_minus_calm_next20_ret"], outb[k]["oos_stress_minus_calm_next20_vol"])


if __name__ == "__main__":
    main()
