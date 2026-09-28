"""P4 · Volatility-managed sizing: hold more when the tape is calm, less when it is wild.

Stolen from: Moreira & Muir (2017), "Volatility-Managed Portfolios", J. Finance (NBER w22208, https://www.nber.org/papers/w22208):
weight = c / last month's realised variance, rebalanced monthly; and Harvey, Hoyle, Korgaonkar, Rattray, Sargaison & van Hemert
(2018), "The impact of volatility targeting" (https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3175538): weight = target vol /
recent realised vol, which they find cuts the left tail of equities most of all.

Our version, with no lookahead: weight at the close of day t = min(cap, (own usual vol / realised vol over the last W sessions)^p),
where "own usual vol" is the median of every EARLIER W-session realised vol of that instrument (expanding), p = 1 (vol) or 2
(variance), and the weight earns day t+1's return.  Cash earns nothing (no bill yield in the cache: this understates every
managed rule a little in its out-of-market share).  Costs: 5 bps per unit of weight traded (20 bps as the harsh case).

Counting the search (R5): 28 rules per instrument (3 windows x 2 powers x 2 caps x 2 rebalance clocks + 4 VIX-scaled);
Hansen's SPA over them against two benchmarks: buy-and-hold, and "the same average exposure held constantly" (so a rule does
not win merely by holding less in a falling market).  R6: the best rule chosen on the first half of the record is judged on the second.
"""
import os, json, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import rr_lib as L
S = L.S

COST, COST_HARSH = 0.0005, 0.0020
WINDOWS, POWERS, CAPS, CLOCKS = (10, 20, 60), (1, 2), (1.0, 1.5), ("daily", "monthly")
HEADLINE = "inv-vol W20 cap1.0 daily"
MM = "inv-var W20 cap1.0 monthly"


def realised_vol(r, w):
    return r.rolling(w).std() * np.sqrt(252)


def expanding_median(x, min_n=250):
    return x.expanding(min_periods=min_n).median()


def monthly_hold(w):
    """Weight fixed at each month's last session, held through the next month."""
    me = w.groupby([w.index.year, w.index.month]).transform("last")
    last_day = w.index.to_series().groupby([w.index.year, w.index.month]).transform("max") == w.index.to_series()
    out = pd.Series(np.where(last_day, w, np.nan), index=w.index).ffill()
    return out


def rules_for(r, vix=None):
    """dict name -> weight series known at close t (applied to r_{t+1})."""
    out = {}
    for W in WINDOWS:
        rv = realised_vol(r, W); usual = expanding_median(rv)
        for p in POWERS:
            raw = (usual / rv) ** p
            for cap in CAPS:
                w = raw.clip(upper=cap)
                for clk in CLOCKS:
                    name = f"{'inv-vol' if p == 1 else 'inv-var'} W{W} cap{cap} {clk}"
                    out[name] = monthly_hold(w) if clk == "monthly" else w
    if vix is not None:
        v = vix.reindex(r.index).ffill(); usual = expanding_median(v)
        raw = usual / v
        for cap in CAPS:
            w = raw.clip(upper=cap)
            for clk in CLOCKS:
                out[f"VIX-scaled cap{cap} {clk}"] = monthly_hold(w) if clk == "monthly" else w
    return out


def evaluate(r, w, cost=COST):
    """Net daily returns of holding weight w_t over r_{t+1}; turnover counted on the weight actually changed."""
    w = w.reindex(r.index)
    pos = w.shift(1)
    ok = pos.notna()
    rr, pp = r[ok], pos[ok]
    trade = pp.diff().abs().fillna(pp.iloc[0] if len(pp) else 0)
    net = pp * rr - cost * trade
    return net, pp, trade


def metrics(net, pos=None, trade=None, bh=None):
    yrs = len(net) / 252
    m = {"cagr_pct": L.r(100 * L.cagr(net)), "vol_pct": L.r(100 * L.ann_vol(net)), "sharpe": L.r(L.sharpe(net), 3),
         "max_dd_pct": L.r(100 * L.max_dd(net)), "longest_underwater_sessions": L.longest_underwater(net), "worst_12m_pct": L.r(100 * L.worst_12m(net))}
    if pos is not None:
        m["avg_weight"] = L.r(pos.mean(), 3); m["share_days_below_half"] = L.r(100 * (pos < 0.5).mean(), 1)
    if trade is not None:
        m["turnover_per_year"] = L.r(trade.sum() / yrs, 2); m["cost_drag_bps_per_year"] = L.r(1e4 * COST * trade.sum() / yrs, 1)
    return m


def episode_dd(net, start, end):
    s = net[(net.index >= start) & (net.index <= end)]
    return L.r(100 * L.max_dd(s)) if len(s) > 20 else None


EPISODES = [("2008 crisis", "2007-10-01", "2009-06-30"), ("2011 debt scare", "2011-04-01", "2011-12-31"), ("2018 Q4", "2018-09-01", "2019-01-31"),
            ("2020 Covid", "2020-02-01", "2020-06-30"), ("2022 bear", "2022-01-01", "2022-12-31"), ("2025 tariff fall", "2025-02-01", "2025-06-30")]
LONG_EPISODES = [("1929-32", "1929-09-01", "1932-12-31"), ("1937-38", "1937-01-01", "1938-12-31"), ("1973-74", "1973-01-01", "1974-12-31"),
                 ("1987 crash", "1987-08-01", "1987-12-31"), ("2000-02", "2000-03-01", "2002-12-31")] + EPISODES


def study(name, close, vix=None, split=None, episodes=EPISODES):
    r = close.pct_change().dropna()
    R = rules_for(r, vix)
    first = max(w.first_valid_index() for w in R.values())
    r = r[r.index > first]
    bh = r
    res = {"instrument": name, "from": str(r.index[0].date()), "to": str(r.index[-1].date()), "n_rules": len(R), "buy_and_hold": metrics(bh),
           "rules": {}, "episodes": {}}
    nets, excess_same, pos_all = {}, {}, {}
    for k, w in R.items():
        net, pos, trade = evaluate(r, w)
        net_h, _, _ = evaluate(r, w, COST_HARSH)
        m = metrics(net, pos, trade); m["cagr_pct_harsh_cost"] = L.r(100 * L.cagr(net_h)); m["sharpe_harsh_cost"] = L.r(L.sharpe(net_h), 3)
        res["rules"][k] = m
        nets[k] = net; pos_all[k] = pos
        excess_same[k] = net - pos.mean() * r.reindex(net.index)
    idx = nets[HEADLINE].index
    for k in nets: nets[k] = nets[k].reindex(idx).fillna(0)
    bhx = bh.reindex(idx)
    for lab, a, b in episodes:
        e = {"buy_and_hold": episode_dd(bhx, a, b), "headline": episode_dd(nets[HEADLINE], a, b), "moreira_muir": episode_dd(nets[MM], a, b)}
        if e["buy_and_hold"] is not None: res["episodes"][lab] = e
    # SPA 1: against buy-and-hold (losses = negative daily returns)
    Lm = -np.column_stack([nets[k].values for k in nets]); Lb = -bhx.values
    res["spa_vs_buy_and_hold"] = L.spa(Lb, Lm)
    # SPA 2: against the same average exposure held constantly (timing value only)
    Ex = np.column_stack([excess_same[k].reindex(idx).fillna(0).values for k in nets])
    res["spa_vs_same_exposure"] = L.spa(np.zeros(len(idx)), -Ex)
    # SPA 3: risk-adjusted — each rule levered/de-levered AFTER THE FACT to buy-and-hold's volatility (Moreira–Muir's comparison)
    vol_bh = bhx.std(); Lr = -np.column_stack([(nets[k] * (vol_bh / nets[k].std())).values for k in nets])
    res["spa_vol_matched_vs_buy_and_hold"] = L.spa(Lb, Lr)
    res["spa_vol_matched_vs_buy_and_hold"]["note"] = "each rule scaled after the fact to buy-and-hold's volatility; a Sharpe comparison, not a tradeable rule"
    # Sharpe difference, headline and Moreira–Muir, 90% stationary-bootstrap range (block 60)
    for key, k in (("headline", HEADLINE), ("moreira_muir", MM)):
        X = np.column_stack([nets[k].values, bhx.values])
        est = L.sharpe(X[:, 0]) - L.sharpe(X[:, 1])
        lo, hi, vals = L.stat_boot(X, lambda b: L.sharpe(b[:, 0]) - L.sharpe(b[:, 1]), block=60, reps=600)
        X2 = np.column_stack([nets[k].values, bhx.values])
        dd_est = L.max_dd(X2[:, 0]) - L.max_dd(X2[:, 1])
        res[f"{key}_sharpe_minus_bh"] = {"est": L.r(est, 3), "lo": L.r(lo, 3), "hi": L.r(hi, 3), "p_le_0": L.r(float((vals <= 0).mean()), 3)}
        res[f"{key}_maxdd_minus_bh_pts"] = L.r(100 * dd_est)
    # walk-forward (R6): best Sharpe rule on the first half, judged on the second
    cut = idx[len(idx) // 2] if split is None else pd.Timestamp(split)
    first = {k: L.sharpe(v[v.index < cut]) for k, v in nets.items()}
    best = max(first, key=first.get)
    sec = lambda s: s[s.index >= cut]
    res["walk_forward"] = {"cut": str(cut.date()), "chosen_on_first_half": best, "first_half_sharpe": L.r(first[best], 3),
                           "first_half_bh_sharpe": L.r(L.sharpe(bhx[bhx.index < cut]), 3),
                           "second_half": metrics(sec(nets[best])), "second_half_bh": metrics(sec(bhx)),
                           "second_half_headline": metrics(sec(nets[HEADLINE]))}
    res["_series"] = {"idx": idx, "bh": bhx, "head": nets[HEADLINE], "mm": nets[MM], "w": pos_all[HEADLINE].reindex(idx)}
    # today's reading: the headline weight at the last close, and the realised vol behind it
    rv20 = realised_vol(close.pct_change(), 20); usual = expanding_median(rv20)
    res["today"] = {"date": str(close.index[-1].date()), "realised_vol_20d_pct": L.r(100 * rv20.iloc[-1], 1), "usual_vol_pct": L.r(100 * usual.iloc[-1], 1),
                    "headline_weight": L.r(min(1.0, usual.iloc[-1] / rv20.iloc[-1]), 2),
                    "rv20_own_percentile": L.r(100 * float((rv20.dropna() < rv20.iloc[-1]).mean()), 0)}
    return res


def main():
    vix = L.best_chart("VIX")
    inst = [("SPY", L.best_chart("SPY"), vix, None, EPISODES), ("QQQ (from Apr 2011)", L.qqq(), vix, None, EPISODES), ("Nasdaq-100 index since 1985", L.index("^NDX"), None, None, LONG_EPISODES),
            ("S&P 500 index since 1928", L.index("^GSPC"), None, "1977-01-01", LONG_EPISODES)]
    lead, members = L.pit_leaders(10)
    inst.append(("LEADERS10 (point-in-time top 10)", L.to_close(lead), vix, None, EPISODES))
    today8 = ["NVDA", "AAPL", "GOOGL", "MSFT", "AMZN", "META", "AVGO", "TSLA"]
    RES = {"what": "P4 volatility-managed sizing", "generated": pd.Timestamp.utcnow().isoformat(), "seed": L.SEED, "cost_bps_per_unit_traded": 1e4 * COST,
           "harsh_cost_bps": 1e4 * COST_HARSH, "headline_rule": HEADLINE, "moreira_muir_rule": MM, "grid": {"windows": WINDOWS, "powers": POWERS, "caps": CAPS, "clocks": CLOCKS, "vix_scaled": 4},
           "leaders_members_by_year": members, "instruments": {}, "today_leaders_individual": {}}
    series = {}
    for name, close, vx, split, eps in inst:
        res = study(name, close.dropna(), vx, split, eps)
        series[name] = res.pop("_series"); RES["instruments"][name] = res
        print(name, res["buy_and_hold"]["max_dd_pct"], res["rules"][HEADLINE]["max_dd_pct"], res["headline_sharpe_minus_bh"], res["spa_vs_same_exposure"])
    # today's eight leaders, one by one (survivorship: chosen because they are today's leaders — a list, not evidence)
    for t in today8:
        c = L.best_chart(t).dropna(); c = c[c.index >= "2005-01-01"]
        res = study(t, c, None); series.pop(t, None); res.pop("_series")
        RES["today_leaders_individual"][t] = {k: res[k] for k in ("from", "buy_and_hold", "headline_sharpe_minus_bh", "headline_maxdd_minus_bh_pts", "spa_vs_same_exposure", "today")} | {"headline": res["rules"][HEADLINE]}
    # count the whole search: every rule on every instrument (R5) — the smallest consistent SPA p across the four instruments, Bonferroni over 4
    ps = [RES["instruments"][k]["spa_vs_same_exposure"]["consistent"] for k in RES["instruments"]]
    RES["search_count"] = {"rules_per_instrument": 28, "instruments_tested": len(ps) + len(today8), "rules_tested_total": 28 * (len(ps) + len(today8)),
                           "min_spa_p_same_exposure": L.r(min(ps), 3), "bonferroni_over_instruments": L.r(min(1, min(ps) * len(ps)), 3)}
    L.dump("p4-volsize.json", RES); L.save_provenance("provenance-p4.json")
    charts(RES, series)


def charts(RES, series):
    # P4-1 · SPY growth, buy-and-hold vs the headline rule, with the weight underneath
    s = series["SPY"]; f, (ax, axw) = S.fig(14, 7.5, rows=2, sharex=True, gridspec_kw={"height_ratios": [3, 1]})
    gb, gh = L.to_close(s["bh"]), L.to_close(s["head"])
    S.updown_line(ax, s["idx"], gb.values, lw=1.4); S.updown_line(ax, s["idx"], gh.values, lw=0.8, alpha=0.55)
    ax.set_yscale("log"); ax.set_ylabel("growth of $1 (log)")
    ax.annotate(f"buy and hold  {gb.iloc[-1]:.1f}x", (s["idx"][-1], gb.iloc[-1]), xytext=(-8, 6), textcoords="offset points", ha="right", color=S.INK, fontsize=11)
    ax.annotate(f"volatility-managed  {gh.iloc[-1]:.1f}x", (s["idx"][-1], gh.iloc[-1]), xytext=(-8, -16), textcoords="offset points", ha="right", color=S.MUTE, fontsize=11)
    ax.set_title("P4-1 · SPY since 2005: buy and hold (thick) against holding usual-vol ÷ last-20-day vol, never above 100% (thin)")
    axw.fill_between(s["idx"], 0, s["w"].values, color=S.MUTE, alpha=0.35, lw=0); axw.set_ylim(0, 1.05); axw.set_ylabel("share held")
    S.caption(f, "Weight set at each close from bars to that close, earns the next day. 5 bps per unit traded. Cash earns 0. Lines: green where the day rose, red where it fell. Source: chart-API cache (Massive SPY, split-adjusted closes, no dividends).")
    S.save(f, os.path.join(L.CH, "p4-1-spy-growth-weight.png"))
    # P4-2 · worst fall, buy-and-hold vs headline, per instrument and episode
    I = RES["instruments"]; names = list(I)
    f, ax = S.fig(14, 5.5); x = np.arange(len(names)); wdt = 0.36
    b = [I[n]["buy_and_hold"]["max_dd_pct"] for n in names]; h = [I[n]["rules"][HEADLINE]["max_dd_pct"] for n in names]
    ax.bar(x - wdt / 2, b, wdt, color=S.DN, alpha=0.9, label="buy and hold"); ax.bar(x + wdt / 2, h, wdt, color=S.DN, alpha=0.4, label="volatility-managed")
    for i in range(len(names)):
        ax.text(x[i] - wdt / 2, b[i] - 2, f"{b[i]:.0f}%", ha="center", va="top", color=S.INK, fontsize=10); ax.text(x[i] + wdt / 2, h[i] - 2, f"{h[i]:.0f}%", ha="center", va="top", color=S.INK, fontsize=10)
    ax.set_xticks(x); ax.set_xticklabels(names, fontsize=10); ax.set_ylabel("worst fall from a high, %"); ax.legend(loc="lower right")
    ax.set_title("P4-2 · The worst fall from a high: buy and hold (solid) against the volatility-managed rule (faded)")
    S.caption(f, "Whole record of each instrument, net of 5 bps per unit traded. S&P 500 index from 1928 (includes 1929-32). LEADERS10 = the ten biggest S&P names at each year's start, point in time.")
    S.save(f, os.path.join(L.CH, "p4-2-worst-fall.png"))
    # P4-3 · Sharpe difference with 90% ranges
    f, ax = S.fig(14, 5)
    for i, n in enumerate(names):
        for j, (key, lab) in enumerate((("headline", "20-day inverse vol, daily"), ("moreira_muir", "Moreira–Muir, monthly"))):
            d = I[n][f"{key}_sharpe_minus_bh"]; y = i + (j - 0.5) * 0.3; col = S.UP if d["est"] >= 0 else S.DN
            ax.plot([d["lo"], d["hi"]], [y, y], color=col, lw=3, alpha=0.5 if j else 0.9, solid_capstyle="butt"); ax.plot([d["est"]], [y], "o", color=col)
            ax.text(d["hi"] + 0.01, y, f"{lab}: {d['est']:+.2f} ({d['lo']:+.2f} to {d['hi']:+.2f})", va="center", fontsize=10, color=S.INK2)
    ax.axvline(0, color=S.MUTE, lw=1); ax.set_yticks(range(len(names))); ax.set_yticklabels(names); ax.invert_yaxis()
    ax.set_xlabel("Sharpe ratio of the rule minus buy and hold (90% range from resampled 60-day runs)")
    ax.set_title("P4-3 · Return per unit of risk: does volatility management beat holding? (0 = no difference)")
    xmax = max(max(I[n][f"{k}_sharpe_minus_bh"]["hi"] for k in ("headline", "moreira_muir")) for n in names); ax.set_xlim(None, xmax + 0.55)
    S.caption(f, "Stationary bootstrap, mean block 60 sessions, 600 draws, seed 20260928. A range crossing 0 means the difference is within luck.")
    S.save(f, os.path.join(L.CH, "p4-3-sharpe-diff.png"))
    # P4-4 · S&P since 1928: growth and drawdown both ways
    s = series["S&P 500 index since 1928"]; f, (ax, axd) = S.fig(14, 7.5, rows=2, sharex=True, gridspec_kw={"height_ratios": [2, 1.3]})
    gb, gh = L.to_close(s["bh"]), L.to_close(s["head"])
    S.updown_line(ax, s["idx"], gb.values, lw=1.2); S.updown_line(ax, s["idx"], gh.values, lw=0.7, alpha=0.5); ax.set_yscale("log"); ax.set_ylabel("growth of $1 (log), price only")
    axd.fill_between(s["idx"], 100 * L.drawdown(gb.values), 0, color=S.DN, alpha=0.55, lw=0, label="buy and hold")
    axd.fill_between(s["idx"], 100 * L.drawdown(gh.values), 0, color=S.MUTE, alpha=0.55, lw=0, label="volatility-managed")
    axd.set_ylabel("below the high, %"); axd.legend(loc="lower left")
    ax.set_title("P4-4 · The S&P 500 since 1928: the same rule, and how far below its high each version sat")
    S.caption(f, "Price index, no dividends, cash at 0. Thin line = volatility-managed, thick = buy and hold. Source: FMP ^GSPC via the rsi lane's cache.")
    S.save(f, os.path.join(L.CH, "p4-4-gspc-1928.png"))


if __name__ == "__main__":
    main()
