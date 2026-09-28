"""Is today CALM or STRESS, and what does that mean for sizing?  The research director's two-state model, updated to today's close.

Model (unchanged from Study A, research/python/research-director/study_a_regime.py): a two-state Gaussian hidden Markov model on
the S&P 500's daily log return and the log VIX level, parameters fitted on 1990-2007 only and frozen; every later day's
probability is FILTERED forward (bars up to that day only, never smoothed).  This script re-fits it with the same seeds,
checks it reproduces the published 25 Sep reading (the fixture), then feeds it the sessions served since.

The only network read of the round: today's finished daily bars for VIX, SPY, QQQ from the chart API
(https://scintilla-massive-chart-api.fly.dev/candles?tf=D, the public read the Hub uses, no key), saved as served to
data/today-bars.json.  The chart API does not carry ^GSPC, so for sessions after 25 Sep the S&P's return is SPY's
(SPY's September ex-dividend date is past, so the two differ by basis points).
"""
import os, sys, json, urllib.request, datetime
import numpy as np, pandas as pd
import rr_lib as L
sys.path.insert(0, os.path.join(L.ROOT, "research/python/research-director"))
import study_a_regime as A  # noqa: E402  (fit_best, filtered_probs — the published code, imported, not copied)

API = "https://scintilla-massive-chart-api.fly.dev/candles"
PUBLISHED = json.load(open(os.path.join(L.ROOT, "deliverables/20260928/research-director/data/study-a-regime.json")))


def fetch(symbol, limit=15):
    req = urllib.request.Request(f"{API}?symbol={symbol}&tf=D&limit={limit}", headers={"Origin": "https://scintillahub.ai", "User-Agent": "scintilla-research-round-2"})
    d = json.load(urllib.request.urlopen(req, timeout=30))
    rows = d["series"]
    return {"symbol": symbol, "provider": d.get("provider"), "served_from": d.get("served_from"), "fetched_utc": datetime.datetime.utcnow().isoformat() + "Z",
            "rows": [{"date": str(pd.Timestamp(r["t"], unit="ms", tz="UTC").tz_convert("America/New_York").date()), "c": r["c"]} for r in rows]}


def main():
    gspc = L.index("^GSPC"); vix = L.best_chart("VIX")
    df = pd.concat([np.log(gspc).diff().rename("r"), np.log(vix).rename("lv")], axis=1).dropna(); df = df[df.index >= "1990-01-03"]
    X = df.values; dates = df.index; cut = dates.searchsorted(pd.Timestamp("2008-01-01"))
    A.SEED = 20260928
    mw, _ = A.fit_best(X[:cut], 2)
    Pw = A.filtered_probs(mw, X)
    pub = PUBLISHED["models"]["A_gspc_vix_1990"]["k2"]["today"]
    fixture = {"published_date": pub["date"], "published_walk_forward": pub["filtered_walk_forward"], "reproduced": {"CALM": round(float(Pw[-1, 0]), 3), "STRESS": round(float(Pw[-1, 1]), 3)},
               "reproduced_date": str(dates[-1].date())}
    fixture["match"] = abs(fixture["reproduced"]["STRESS"] - pub["filtered_walk_forward"]["STRESS"]) < 0.005 and fixture["reproduced_date"] == pub["date"]
    print("fixture", fixture)

    # today's bars as served
    served = {s: fetch(s) for s in ("VIX", "SPY", "QQQ")}
    json.dump(served, open(os.path.join(L.DATA, "today-bars.json"), "w"), indent=1)
    spy_s = pd.Series({pd.Timestamp(r["date"]): r["c"] for r in served["SPY"]["rows"]}).sort_index()
    vix_s = pd.Series({pd.Timestamp(r["date"]): r["c"] for r in served["VIX"]["rows"]}).sort_index()
    new_days = [d for d in spy_s.index if d > dates[-1] and d in vix_s.index]
    alpha = Pw[-1].copy(); path = [{"date": str(dates[-1].date()), "STRESS": round(float(alpha[1]), 4), "source": "S&P 500 index + VIX (cache)"}]
    from scipy.stats import multivariate_normal
    for d in new_days:
        r = np.log(spy_s[d] / spy_s[spy_s.index < d].iloc[-1]); lv = np.log(vix_s[d])
        b = np.array([multivariate_normal(mw.means_[k], mw.covars_[k]).pdf([r, lv]) for k in range(2)])
        alpha = (alpha @ mw.transmat_) * b; alpha /= alpha.sum()
        path.append({"date": str(d.date()), "STRESS": round(float(alpha[1]), 4), "spy_ret_pct": round(100 * float(np.expm1(r)), 2), "vix": float(vix_s[d]), "source": "SPY return + VIX (chart API)"})
    today = path[-1]
    A_ = mw.transmat_; stay = {n: float(A_[i, i]) for i, n in enumerate(("CALM", "STRESS"))}
    k2 = PUBLISHED["models"]["A_gspc_vix_1990"]["k2"]
    oos = {s["state"]: s for s in k2["by_state_walk_forward_oos"]}
    states = {s["name"]: s for s in k2["states"]}
    # the chance the model is still CALM in 5 / 20 / 60 sessions from today's filtered reading (Markov chain forward)
    ahead = {}
    for h in (5, 20, 60):
        ahead[h] = round(float((alpha @ np.linalg.matrix_power(A_, h))[0]), 3)
    # the vol-managed weights (P4's headline rule) at the latest close for SPY and QQQ, using today's served close
    P4 = json.load(open(os.path.join(L.DATA, "p4-volsize.json")))
    weights = {}
    for sym, key in (("SPY", "SPY"), ("QQQ", "QQQ (from Apr 2011)")):
        c = L.best_chart(sym)
        extra = pd.Series({pd.Timestamp(r["date"]): r["c"] for r in served[sym]["rows"]}).sort_index(); extra = extra[extra.index > c.index[-1]]
        c = pd.concat([c, extra]); rv = c.pct_change().rolling(20).std() * np.sqrt(252); usual = rv.expanding(250).median()
        weights[sym] = {"date": str(c.index[-1].date()), "rv20_pct": L.r(100 * rv.iloc[-1], 1), "usual_pct": L.r(100 * usual.iloc[-1], 1), "weight": L.r(min(1.0, usual.iloc[-1] / rv.iloc[-1]), 2),
                        "rv20_own_pctile": L.r(100 * float((rv.dropna() < rv.iloc[-1]).mean()), 0)}
    weights["LEADERS10 (point-in-time top 10)"] = P4["instruments"]["LEADERS10 (point-in-time top 10)"]["today"] | {"weight": P4["instruments"]["LEADERS10 (point-in-time top 10)"]["today"]["headline_weight"]}
    P10 = json.load(open(os.path.join(L.DATA, "p10-breadth.json")))
    P5 = json.load(open(os.path.join(L.DATA, "p5-trend.json")))
    RES = {"what": "CALM or STRESS today", "generated": pd.Timestamp.utcnow().isoformat(), "fixture": fixture, "path": path, "today": today,
           "state_today": "STRESS" if today["STRESS"] >= 0.5 else "CALM", "new_sessions_since_cache": [str(d.date()) for d in new_days],
           "model": {"features": ["S&P 500 daily log return", "log VIX level"], "fit": "1990-01-03 → 2007-12-31, frozen", "stay_prob": stay,
                     "expected_duration_sessions": {n: round(1 / (1 - p), 1) for n, p in stay.items()},
                     "typical_vix": {n: round(float(np.exp(mw.means_[i][1])), 1) for i, n in enumerate(("CALM", "STRESS"))},
                     "ann_vol_pct": {n: round(float(100 * np.sqrt(mw.covars_[i][0, 0] * 252)), 1) for i, n in enumerate(("CALM", "STRESS"))}},
           "calm_ahead_prob": ahead, "oos_by_state": oos, "oos_vol_diff": k2["oos_stress_minus_calm_next20_vol"], "oos_ret_diff": k2["oos_stress_minus_calm_next20_ret"],
           "oos_by_200day_side": k2["oos_by_200day_side"], "vol_weights": weights,
           "breadth": P10["today"], "trend_today": {k: P5["today"][k] for k in ("S&P 500 index since 1928", "SPY", "QQQ (from Apr 2011)", "LEADERS10 (point-in-time top 10)", "SMH semis", "Gold since 1975")}}
    L.dump("calm-today.json", RES)
    print(json.dumps({k: RES[k] for k in ("today", "state_today", "calm_ahead_prob", "vol_weights", "new_sessions_since_cache")}, indent=1, default=str))
    chart(RES, Pw, dates, gspc)


def chart(RES, Pw, dates, gspc):
    S = L.S
    f, ax = S.fig(14, 5.2); i0 = dates.searchsorted(pd.Timestamp("2025-01-01"))
    d = list(dates[i0:]) + [pd.Timestamp(p["date"]) for p in RES["path"][1:]]
    y = list(Pw[i0:, 1]) + [p["STRESS"] for p in RES["path"][1:]]
    ax.fill_between(d, 0, y, color=S.DN, alpha=0.35, lw=0, step="post"); ax.plot(d, y, color=S.DN, lw=1.2, drawstyle="steps-post")
    ax.axhline(0.5, color=S.MUTE, lw=1, ls="--"); ax.set_ylim(0, 1); ax.set_ylabel("probability of STRESS")
    ax3 = ax.twinx(); c = gspc.reindex(dates[i0:]); S.updown_line(ax3, c.index, c.values, lw=0.9); ax3.grid(False); ax3.set_ylabel("S&P 500", color=S.MUTE)
    t = RES["today"]; ax.annotate(f"{t['date']}: STRESS {t['STRESS']:.2f}", (pd.Timestamp(t["date"]), t["STRESS"]), xytext=(-150, 40), textcoords="offset points", color=S.INK, fontsize=12, arrowprops={"arrowstyle": "-", "color": S.MUTE})
    ax.set_title("CALM or STRESS · since January 2025, the model's STRESS probability day by day (parameters frozen at end-2007, bars to each day only)")
    S.caption(f, "Shaded red = probability of the high-volatility state. Above the dashed line = STRESS. S&P line: green day up, red day down. After 25 Sep the day's S&P return is SPY's, VIX from the chart API.")
    S.save(f, os.path.join(L.CH, "calm-1-stress-probability.png"))


if __name__ == "__main__":
    main()
