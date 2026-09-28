"""P5 · The 200-day / 10-month trend rule as a drawdown cutter, tested the way the public work tests it.

Stolen from: Faber (2007), "A Quantitative Approach to Tactical Asset Allocation" (https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461):
hold when the month-end close is above its 10-month average, else cash — reported to cut the S&P's worst fall roughly in half
at a similar return; Hurst, Ooi & Pedersen (2017), "A Century of Evidence on Trend-Following Investing" (AQR,
https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing); and Moskowitz,
Ooi & Pedersen (2012), "Time Series Momentum" (https://doi.org/10.1016/j.jfineco.2011.11.003).

Rules (10 per instrument, counted): daily close above its N-day average (N = 50, 100, 150, 200, 250), the 200-day with a 2%
band (in above +2%, out below -2%), and Faber's month-end rule at 6, 8, 10 and 12 months.  In = long the next session; out =
cash at 0 (no bill yield in the cache, so every rule's return is understated by the bill yield times its time out).
Cost: 10 bps per switch.  What it CUTS = the worst fall from a high, the worst 12 months and the worst 5% of months;
what it COSTS = return a year, the up-months spent out, and the whipsaws (round trips that lost).
R5: SPA per instrument over its 10 rules against buy-and-hold and against the same share of days held without timing;
the search is then counted over instruments.  R6: the S&P since 1928 split at 1977 — each half on its own.
Pooled view (the "instrument effect"): 90% ranges from resampling whole instruments, so no one instrument carries the answer.
"""
import os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import rr_lib as L
S = L.S

COST = 0.0010
DAILY = (50, 100, 150, 200, 250)
MONTHLY = (6, 8, 10, 12)


def positions(c):
    """name -> 0/1 series known at close t (applies to r_{t+1})."""
    out = {}
    for n in DAILY:
        sma = c.rolling(n).mean(); out[f"{n}-day"] = (c > sma).astype(float).where(sma.notna())
    sma = c.rolling(200).mean(); pos = np.full(len(c), np.nan); state = np.nan
    cv, sv = c.values, sma.values
    for i in range(len(c)):
        if np.isnan(sv[i]): continue
        if np.isnan(state): state = 1.0 if cv[i] > sv[i] else 0.0
        elif state == 1.0 and cv[i] < sv[i] * 0.98: state = 0.0
        elif state == 0.0 and cv[i] > sv[i] * 1.02: state = 1.0
        pos[i] = state
    out["200-day ±2% band"] = pd.Series(pos, index=c.index)
    me_mask = c.index.to_series().groupby([c.index.year, c.index.month]).transform("max") == c.index.to_series()
    me = c[me_mask.values]
    for m in MONTHLY:
        sig = (me > me.rolling(m).mean()).astype(float).where(me.rolling(m).mean().notna())
        out[f"{m}-month (Faber)"] = sig.reindex(c.index).ffill()
    return out


def run(c, pos, cost=COST):
    r = c.pct_change()
    p = pos.shift(1)
    ok = p.notna() & r.notna()
    rr, pp = r[ok], p[ok]
    sw = pp.diff().abs().fillna(0)
    net = pp * rr - cost * sw
    return net, pp, sw, rr


def whipsaws(pp, rr):
    """Round trips (in -> out) and how many lost money."""
    trips, lost, cur, inside = 0, 0, 1.0, False
    for p, x in zip(pp.values, rr.values):
        if p == 1:
            if not inside: inside, cur = True, 1.0
            cur *= 1 + x
        elif inside:
            trips += 1; lost += cur < 1; inside = False
    return trips, lost


def monthly(ret):
    return (1 + ret).groupby([ret.index.year, ret.index.month]).prod() - 1


def summarise(net, pp, sw, rr):
    yrs = len(net) / 252; mb, mr = monthly(rr), monthly(net)
    trips, lost = whipsaws(pp, rr)
    up_months = mb > 0
    out_share_in_up = float(((mr.reindex(mb.index).abs() < 1e-9) & up_months).sum() / max(up_months.sum(), 1))
    return {"cagr_pct": L.r(100 * L.cagr(net)), "max_dd_pct": L.r(100 * L.max_dd(net)), "worst_12m_pct": L.r(100 * L.worst_12m(net)),
            "worst_5pct_months_pct": L.r(100 * float(mr[mr <= mr.quantile(0.05)].mean())), "sharpe": L.r(L.sharpe(net), 3),
            "time_in_pct": L.r(100 * float(pp.mean()), 1), "switches_per_year": L.r(float(sw.sum() / yrs), 2),
            "round_trips": trips, "round_trips_lost": lost, "up_months_spent_out_pct": L.r(100 * out_share_in_up, 1),
            "longest_underwater_sessions": L.longest_underwater(net)}


def study(name, c, group):
    c = c.dropna(); P = positions(c)
    ref = P["200-day"]; first = max(p.first_valid_index() for p in P.values())
    c = c[c.index >= first]
    res = {"instrument": name, "group": group, "from": str(c.index[1].date()), "to": str(c.index[-1].date()), "rules": {}}
    nets, excess = {}, {}
    bh = None
    for k, p in P.items():
        net, pp, sw, rr = run(c, p.reindex(c.index))
        if bh is None:
            bh = rr; res["buy_and_hold"] = summarise(rr, pd.Series(1.0, index=rr.index), pd.Series(0.0, index=rr.index), rr)
            res["buy_and_hold"]["switches_per_year"] = 0
        res["rules"][k] = summarise(net, pp, sw, rr)
        res["rules"][k]["dd_cut_pts"] = L.r(res["rules"][k]["max_dd_pct"] - res["buy_and_hold"]["max_dd_pct"])
        res["rules"][k]["cagr_cost_pts"] = L.r(res["rules"][k]["cagr_pct"] - res["buy_and_hold"]["cagr_pct"])
        nets[k] = net.reindex(bh.index).fillna(0); excess[k] = (net - pp.mean() * rr).reindex(bh.index).fillna(0)
    res["spa_vs_buy_and_hold"] = L.spa(-bh.values, -np.column_stack([v.values for v in nets.values()]))
    res["spa_vs_same_share_of_days"] = L.spa(np.zeros(len(bh)), -np.column_stack([v.values for v in excess.values()]))
    res["_nets"] = nets; res["_bh"] = bh; res["_close"] = c; res["_pos"] = {k: P[k].reindex(c.index) for k in ("10-month (Faber)", "200-day")}
    return res


def instruments():
    out = [("S&P 500 index since 1928", L.index("^GSPC"), "index"), ("Nasdaq-100 index since 1985", L.index("^NDX"), "index"),
           ("Russell 2000 index since 1987", L.index("^RUT"), "index"), ("Dow index since 1985", L.index("^DJI"), "index"),
           ("SPY", L.best_chart("SPY"), "fund"), ("QQQ (from Apr 2011)", L.qqq(), "fund"), ("IWM", L.best_chart("IWM"), "fund"), ("DIA", L.best_chart("DIA"), "fund")]
    for s, lab in L.D.SECTORS.items():
        out.append((f"{s} {lab.lower()}", L.best_chart(s), "sector"))
    out += [("Gold since 1975", L.best_chart("GCUSD"), "commodity"), ("Silver since 1970", L.best_chart("SIUSD"), "commodity"),
            ("Oil since 2000", L.best_chart("CLUSD"), "commodity"), ("Bitcoin since 2013", L.btc(), "crypto"), ("TLT long bonds", L.best_chart("TLT"), "bond"),
            ("SMH semis", L.best_chart("SMH"), "fund")]
    lead, _ = L.pit_leaders(10); out.append(("LEADERS10 (point-in-time top 10)", L.to_close(lead), "leaders"))
    for t in ["NVDA", "AAPL", "GOOGL", "MSFT", "AMZN", "META", "AVGO", "TSLA"]:
        out.append((t, L.best_chart(t), "today's leader (survivor)"))
    return out


def main():
    RES = {"what": "P5 trend rule as a drawdown cutter", "generated": pd.Timestamp.utcnow().isoformat(), "seed": L.SEED, "cost_bps_per_switch": 1e4 * COST,
           "rules": [f"{n}-day" for n in DAILY] + ["200-day ±2% band"] + [f"{m}-month (Faber)" for m in MONTHLY], "instruments": {}}
    keep = {}
    for name, c, g in instruments():
        res = study(name, c, g)
        keep[name] = {k: res.pop(k) for k in ("_nets", "_bh", "_close", "_pos")}
        RES["instruments"][name] = res
        r10, r200 = res["rules"]["10-month (Faber)"], res["rules"]["200-day"]
        print(f"{name:34s} BH dd {res['buy_and_hold']['max_dd_pct']:7.1f} | 10m dd {r10['max_dd_pct']:7.1f} cagr {r10['cagr_cost_pts']:+5.1f} | 200d dd {r200['max_dd_pct']:7.1f} cagr {r200['cagr_cost_pts']:+5.1f} | spa {res['spa_vs_buy_and_hold']['consistent']:.2f} {res['spa_vs_same_share_of_days']['consistent']:.2f}")
    # pooled over the evidence set (indexes, funds, sectors, commodities, crypto, bonds, PIT leaders — not today's survivors)
    ev = [k for k, v in RES["instruments"].items() if v["group"] != "today's leader (survivor)"]
    rng = np.random.default_rng(L.SEED); pooled = {}
    for rule in RES["rules"]:
        cut = np.array([RES["instruments"][k]["rules"][rule]["dd_cut_pts"] for k in ev]); cost = np.array([RES["instruments"][k]["rules"][rule]["cagr_cost_pts"] for k in ev])
        w12 = np.array([RES["instruments"][k]["rules"][rule]["worst_12m_pct"] - RES["instruments"][k]["buy_and_hold"]["worst_12m_pct"] for k in ev])
        B = rng.integers(0, len(ev), size=(4000, len(ev)))
        pooled[rule] = {"instruments": len(ev), "median_dd_cut_pts": L.r(np.median(cut)), "dd_cut_range90": [L.r(np.percentile(np.median(cut[B], 1), 5)), L.r(np.percentile(np.median(cut[B], 1), 95))],
                        "share_instruments_dd_cut": L.r(100 * float((cut > 0).mean()), 0), "median_cagr_cost_pts": L.r(np.median(cost)),
                        "cagr_cost_range90": [L.r(np.percentile(np.median(cost[B], 1), 5)), L.r(np.percentile(np.median(cost[B], 1), 95))],
                        "share_instruments_cagr_higher": L.r(100 * float((cost > 0).mean()), 0), "median_worst12m_better_pts": L.r(np.median(w12))}
    RES["pooled_evidence_set"] = pooled
    ps = [RES["instruments"][k]["spa_vs_buy_and_hold"]["consistent"] for k in ev]; ps2 = [RES["instruments"][k]["spa_vs_same_share_of_days"]["consistent"] for k in ev]
    RES["search_count"] = {"rules_per_instrument": len(RES["rules"]), "instruments": len(RES["instruments"]), "rules_tested_total": len(RES["rules"]) * len(RES["instruments"]),
                           "evidence_instruments": len(ev), "spa_vs_bh_p_below_10pct": int(sum(p < 0.10 for p in ps)), "spa_same_share_p_below_10pct": int(sum(p < 0.10 for p in ps2)),
                           "expected_by_luck_at_10pct": L.r(0.10 * len(ev), 1), "min_spa_vs_bh": L.r(min(ps), 3), "min_spa_same_share": L.r(min(ps2), 3),
                           "bonferroni_min_vs_bh": L.r(min(1, min(ps) * len(ev)), 3)}
    # R6 · the S&P since 1928 in two halves, the two headline rules
    k = keep["S&P 500 index since 1928"]; halves = {}
    for lab, a, b in (("1928-1976", "1928-01-01", "1976-12-31"), ("1977-2026", "1977-01-01", "2026-12-31")):
        bh = k["_bh"][(k["_bh"].index >= a) & (k["_bh"].index <= b)]; h = {"buy_and_hold": {"cagr_pct": L.r(100 * L.cagr(bh)), "max_dd_pct": L.r(100 * L.max_dd(bh)), "worst_12m_pct": L.r(100 * L.worst_12m(bh))}}
        for rule in ("10-month (Faber)", "200-day"):
            n = k["_nets"][rule]; n = n[(n.index >= a) & (n.index <= b)]
            h[rule] = {"cagr_pct": L.r(100 * L.cagr(n)), "max_dd_pct": L.r(100 * L.max_dd(n)), "worst_12m_pct": L.r(100 * L.worst_12m(n))}
        halves[lab] = h
    RES["walk_forward_gspc"] = halves
    # today: where each instrument sits against its 200-day and its 10-month line
    today = {}
    for name, v in keep.items():
        c = v["_close"]; s200 = c.rolling(200).mean()
        me = c.groupby([c.index.year, c.index.month]).last(); m10 = me.rolling(10).mean()
        today[name] = {"date": str(c.index[-1].date()), "pct_vs_200d": L.r(100 * (c.iloc[-1] / s200.iloc[-1] - 1), 1), "above_200d": bool(c.iloc[-1] > s200.iloc[-1]),
                       "last_month_end_above_10m": bool(me.iloc[-2] > m10.iloc[-2]) if len(me) > 11 else None}
    RES["today"] = today
    L.dump("p5-trend.json", RES); L.save_provenance("provenance-p5.json")
    charts(RES, keep, ev)


def charts(RES, keep, ev):
    I = RES["instruments"]
    # P5-1 · S&P since 1928 with Faber's out-of-market months shaded, and the two drawdown curves
    k = keep["S&P 500 index since 1928"]; c = k["_close"]; pos = k["_pos"]["10-month (Faber)"].reindex(c.index)
    f, (ax, axd) = S.fig(14, 8, rows=2, sharex=True, gridspec_kw={"height_ratios": [2, 1.2]})
    S.updown_line(ax, c.index, c.values, lw=0.9); ax.set_yscale("log"); ax.set_ylabel("S&P 500 (log)")
    out = (pos == 0).values; ax.fill_between(c.index, c.min(), c.max() * 1.2, where=out, color=S.MUTE, alpha=0.18, lw=0, step="post")
    gb, gr = L.to_close(k["_bh"]), L.to_close(k["_nets"]["10-month (Faber)"])
    axd.fill_between(gb.index, 100 * L.drawdown(gb.values), 0, color=S.DN, alpha=0.55, lw=0, label="buy and hold")
    axd.fill_between(gr.index, 100 * L.drawdown(gr.values), 0, color=S.MUTE, alpha=0.6, lw=0, label="10-month rule")
    axd.set_ylabel("below the high, %"); axd.legend(loc="lower right")
    r10 = I["S&P 500 index since 1928"]["rules"]["10-month (Faber)"]; bh = I["S&P 500 index since 1928"]["buy_and_hold"]
    ax.set_title(f"P5-1 · S&P 500 since 1928: grey = months Faber's 10-month rule sat in cash · worst fall {bh['max_dd_pct']:.0f}% held, {r10['max_dd_pct']:.0f}% with the rule")
    S.caption(f, "Month-end close vs its 10-month average decides the next month. Price only, cash at 0, 10 bps a switch. Source: FMP ^GSPC via the chart-API cache.")
    S.save(f, os.path.join(L.CH, "p5-1-gspc-faber.png"))
    # P5-2 · what it cuts vs what it costs, 10-month and 200-day, every instrument
    for rule, fn, tag in (("10-month (Faber)", "p5-2-cut-vs-cost-10m.png", "P5-2"), ("200-day", "p5-3-cut-vs-cost-200d.png", "P5-3")):
        names = sorted(I, key=lambda n: I[n]["rules"][rule]["dd_cut_pts"])
        f, (a1, a2) = S.fig(15, 10, cols=2, sharey=True)
        y = np.arange(len(names))
        cut = [I[n]["rules"][rule]["dd_cut_pts"] for n in names]; cost = [I[n]["rules"][rule]["cagr_cost_pts"] for n in names]
        a1.barh(y, cut, color=[S.UP if v >= 0 else S.DN for v in cut]); a2.barh(y, cost, color=[S.UP if v >= 0 else S.DN for v in cost])
        for i, n in enumerate(names):
            a1.text(cut[i] + (1 if cut[i] >= 0 else -1), i, f"{I[n]['buy_and_hold']['max_dd_pct']:.0f}% → {I[n]['rules'][rule]['max_dd_pct']:.0f}%", va="center", ha="left" if cut[i] >= 0 else "right", fontsize=9, color=S.INK2)
            a2.text(cost[i] + (0.1 if cost[i] >= 0 else -0.1), i, f"{cost[i]:+.1f}", va="center", ha="left" if cost[i] >= 0 else "right", fontsize=9, color=S.INK2)
        a1.set_yticks(y); a1.set_yticklabels([n + ("  *" if I[n]["group"] == "today's leader (survivor)" else "") for n in names], fontsize=10)
        a1.axvline(0, color=S.MUTE, lw=1); a2.axvline(0, color=S.MUTE, lw=1)
        a1.set_xlabel("worst fall made SMALLER by (points)"); a2.set_xlabel("return a year, rule minus holding (points)")
        lo1, hi1 = min(cut), max(cut); a1.set_xlim(lo1 - 18, hi1 + 22); lo2, hi2 = min(cost), max(cost); a2.set_xlim(lo2 - 4, hi2 + 4)
        a1.set_title(f"{tag} · {rule}: what it cuts"); a2.set_title("… and what it costs")
        p = RES["pooled_evidence_set"][rule]
        S.caption(f, f"Median over the {p['instruments']} evidence instruments: worst fall cut {p['median_dd_cut_pts']:.1f} pts (90% {p['dd_cut_range90'][0]:.1f} to {p['dd_cut_range90'][1]:.1f}), return {p['median_cagr_cost_pts']:+.1f} pts a year. * = today's leaders, chosen after the fact (survivors).")
        S.save(f, os.path.join(L.CH, fn))
    # P5-4 · lookback grid: median drawdown cut and median return cost across the evidence set
    rules = RES["rules"]; f, ax = S.fig(14, 5)
    x = np.arange(len(rules)); P = RES["pooled_evidence_set"]
    for i, rname in enumerate(rules):
        p = P[rname]
        ax.plot([i - 0.12, i - 0.12], p["dd_cut_range90"], color=S.UP, lw=6, alpha=0.45, solid_capstyle="butt"); ax.plot([i - 0.12], [p["median_dd_cut_pts"]], "o", color=S.UP)
        ax.plot([i + 0.12, i + 0.12], p["cagr_cost_range90"], color=S.DN, lw=6, alpha=0.45, solid_capstyle="butt"); ax.plot([i + 0.12], [p["median_cagr_cost_pts"]], "o", color=S.DN)
        ax.text(i - 0.12, p["dd_cut_range90"][1] + 0.8, f"{p['median_dd_cut_pts']:.0f}", ha="center", fontsize=10, color=S.INK2); ax.text(i + 0.12, p["cagr_cost_range90"][0] - 0.8, f"{p['median_cagr_cost_pts']:+.1f}", ha="center", va="top", fontsize=10, color=S.INK2)
    ax.axhline(0, color=S.MUTE, lw=1); ax.set_xticks(x); ax.set_xticklabels(rules, fontsize=10); ax.set_ylabel("points")
    ax.set_title("P5-4 · Every lookback tried: worst fall cut (green, points) and return a year given up (red), median across instruments with 90% ranges")
    S.caption(f, "Ranges resample whole instruments (4,000 draws): no single market carries the answer. Evidence set excludes today's hand-picked leaders.")
    S.save(f, os.path.join(L.CH, "p5-4-lookback-grid.png"))


if __name__ == "__main__":
    main()
