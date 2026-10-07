# PF1 · structure 2 — the trend-filtered core: hold SPY by default, step aside into Treasury bills only when a regime rule
# says so. Five ways of writing that rule are run side by side (four over the whole history, one over the last two years).
#
# NO HINDSIGHT: every reading below is taken at a session's close from that close and earlier closes only (trailing averages,
# nothing shifted forward, no centred windows). pf1lib then fills the switch at the NEXT session's close.
import json, os, time
import numpy as np, pandas as pd
import pf1lib as L

T0 = time.time(); D = L.load(); N = len(D.dates); LAST = D.dates[-1]; spy = D.c["SPY"]
ma = L.sma(spy, 200); FIRST = int(np.argmax(ma.notna().values))        # the first row on which SPY's 200-day average exists
below = (spy < ma).values                                              # SPY's close under its own 200-day average

# breadth = the share of sector funds above their own 200-day average. A fund's average is taken over its own 200 closes, so a
# fund is only counted from the day it has 200 sessions of history (XLRE and XLC join late).
st = {}
for s in L.SECTORS:
    c = D.c[s].dropna(); m = L.sma(c, 200); st[s] = (c > m).astype(float).where(m.notna()).reindex(D.c.index)
ab = pd.DataFrame(st); counted = ab.notna().sum(axis=1); share = ab.sum(axis=1) / counted.where(counted > 0)
weak = (share < 0.5).values                                            # "breadth weak" = fewer than half of the counted funds above

# the monthly (Faber) reading: SPY's month-end close against the average of its last 10 month-end closes, this one included.
# Which session is a month's last is known from the exchange calendar beforehand. pf1lib.month_ends marks the last row of
# any window as a month end, so the file's final session is dropped here: its month has not ended.
me = L.month_ends(D, D.dates[0], LAST); me = me[:-1] if me and me[-1] == LAST else me
mc = spy[me]; m10 = L.sma(mc, 10); mstate = (mc >= m10).astype(float).where(m10.notna()).reindex(D.c.index).ffill()

# the Hub's own breadth (last two years only): percent of TODAY'S served companies above their 200-day, as HEAT1/R4 replayed it
R = json.load(open(os.path.join(L.DATA, "tool-replay.json")))
served = pd.DataFrame(R["series"]).set_index("date")["pct200"].reindex(D.c.index).ffill()
weak_served = (served < 50.0).values


def confirmed(raw, n=3):
    """The same rule, but a switch needs the new reading on n closes in a row (counted up to and including today's)."""
    out = raw.copy(); s = bool(raw[FIRST]); run = 0
    for i in range(FIRST, N):
        run = run + 1 if bool(raw[i]) != s else 0
        if run >= n: s, run = (not s), 0
        out[i] = s
    return out


# what each rule wants at each close: True = be in SPY, False = be in bills
WANT = {"trend_and_breadth": ~(below & weak), "trend_only": ~below, "trend_monthly": (mstate.fillna(1.0) > 0.5).values,
        "trend_and_served_breadth": ~(below & weak_served)}
WANT["trend_and_breadth_3day"] = confirmed(WANT["trend_and_breadth"], 3)


def run(want, name, start=L.FULL[0], end=L.FULL[1], initial=None):
    """All SPY or all bills. The opening position is what the rule says on the start date (unless `initial` is given)."""
    def decide(i, d, w):
        x = bool(want[i]); have = w.get("SPY", 0.0) > 0.5
        return None if x == have else ({"SPY": 1.0} if x else {})
    if initial is None: initial = {"SPY": 1.0} if want[D.ix[start]] else {}
    return L.simulate(D, decide, start, end, initial=initial, name=name)


TR = D.tr["SPY"]; CG = (1.0 + D.cash_ret).cumprod()


def spells(sim):
    """Every stretch the rule spent out of the market, dated by its FILLS (the close it sold at, the close it bought back at)."""
    s = sim["stock"]; idx = list(s.index); out = s.values < 0.5; n = len(idx); rows = []; j = 0
    while j < n:
        if not out[j]: j += 1; continue
        k = j
        while k < n and out[k]: k += 1
        a = idx[j]; b = idx[k] if k < n else None; e = b or idx[-1]
        chg = TR[e] / TR[a] - 1.0; bills = CG[e] / CG[a] - 1.0; fee = (1.0 - L.COST_BPS_FUND / 1e4) ** (2 if b else 1)
        rows.append({"out": a, "back_in": b, "sessions": k - j, "spy_change_pct": round(100 * chg, 2), "bills_earned_pct": round(100 * bills, 2),
                     "net_vs_holding_pct": round(100 * ((1.0 + bills) * fee / (1.0 + chg) - 1.0), 2), "began_out_at_start": j == 0, "still_out": b is None})
        j = k
    return rows, out


def outs_block(sim, last2_only=False):
    rows, out = spells(sim); closed = [r for r in rows if not r["still_out"]]; idx = list(sim["stock"].index)
    saved = [r for r in closed if r["spy_change_pct"] < 0]; cost = [r for r in closed if r["spy_change_pct"] > 0]
    in2 = np.array([L.LAST2[0] <= d <= L.LAST2[1] for d in idx])
    l2 = [r for r in rows if r["out"] <= L.LAST2[1] and (r["back_in"] is None or r["back_in"] >= L.LAST2[0])]
    return {"spells": rows, "count": len(rows), "closed": len(closed), "still_out": len(rows) - len(closed),
            "saved": len(saved), "cost": len(cost), "flat": len(closed) - len(saved) - len(cost),
            "better_than_holding_after_bills_and_costs": sum(1 for r in closed if r["net_vs_holding_pct"] > 0),
            "avg_saved_pct": round(float(np.mean([r["spy_change_pct"] for r in saved])), 2) if saved else None,
            "avg_cost_pct": round(float(np.mean([r["spy_change_pct"] for r in cost])), 2) if cost else None,
            "worst_whipsaw": max(cost, key=lambda r: r["spy_change_pct"]) if cost else None,
            "biggest_save": min(saved, key=lambda r: r["spy_change_pct"]) if saved else None,
            "longest": max(rows, key=lambda r: r["sessions"]) if rows else None,
            "round_trips_of_10_sessions_or_fewer": sum(1 for r in closed if r["sessions"] <= 10),
            "sessions_out_pct": None if last2_only else round(100 * float(out.mean()), 1),
            "last2_sessions_out_pct": round(100 * float(out[in2].mean()), 1),
            "last2_saved": sum(1 for r in l2 if not r["still_out"] and r["spy_change_pct"] < 0),
            "last2_cost": sum(1 for r in l2 if not r["still_out"] and r["spy_change_pct"] > 0), "last2_spells": l2}


SPEC = [("trend_and_breadth", "Trend + breadth: in SPY unless SPY is under its 200-day average AND fewer than half the sector funds are above theirs",
         "the brief's rule, read at every close; a switch fills at the next close; out of SPY means Treasury bills"),
        ("trend_only", "Trend only: in SPY while its close is at or above its 200-day average, in bills whenever it is below",
         "read at every close; a switch fills at the next close"),
        ("trend_monthly", "Monthly trend (the classic 10-month rule): looked at once a month, on the month's last close",
         "SPY's month-end close against the average of its last 10 month-end closes; a switch fills on the first session of the new month"),
        ("trend_and_breadth_3day", "Trend + breadth with a 3-day wait: the headline rule, but it only switches after 3 closes in a row say so",
         "the third close in a row decides; the switch fills at the close after that")]
sims = {k: run(WANT[k], k) for k, _, _ in SPEC}
variants = [{**L.report(sims[k], D, label, note), "key": k} for k, label, note in SPEC]

# the last-two-years-only variant: the headline rule with the Hub's served-company breadth in place of the sector funds
k5 = "trend_and_served_breadth"; sims[k5] = run(WANT[k5], k5, *L.LAST2, initial={"SPY": 1.0})
r5 = L.report(sims[k5], D, "Trend + the Hub's own breadth (LAST TWO YEARS ONLY; the breadth universe is TODAY'S served company list)",
              "starts 100% SPY on 3 Oct 2024; out only when SPY is under its 200-day AND under 50% of today's served companies are above theirs")
r5["full"] = None; r5["curve_full"] = None; r5["stress"] = {}; variants.append({**r5, "key": k5})

# ---------------------------------------------------------------- extras
outs = {k: outs_block(sims[k], last2_only=(k == k5)) for k in sims}
i = N - 1; fa = [s for s in L.SECTORS if ab[s].iloc[i] == 1.0]; fb = [s for s in L.SECTORS if ab[s].iloc[i] == 0.0]
joined = {s: ab[s].first_valid_index() for s in L.SECTORS}
breadth_today = {"date": LAST, "sector_funds_counted": int(counted.iloc[i]), "sector_funds_above_200day": len(fa), "share_pct": round(100 * float(share.iloc[i]), 1),
                 "breadth_weak": bool(weak[i]), "funds_above": fa, "funds_below": fb,
                 "spy_close": round(float(spy.iloc[i]), 2), "spy_200day": round(float(ma.iloc[i]), 2), "spy_distance_pct": round(100 * float(spy.iloc[i] / ma.iloc[i] - 1), 1),
                 "spy_below_200day": bool(below[i]), "served_companies_above_200day_pct": float(served.iloc[i]), "served_breadth_weak": bool(weak_served[i]),
                 "rule_says_today": {k: ("IN (hold SPY)" if WANT[k][i] else "OUT (bills)") for k in WANT},
                 "holding_at_last_close": {k: ("SPY" if sims[k]["stock"].iloc[-1] > 0.5 else "bills") for k in sims}}

B = json.load(open(os.path.join(L.DATA, "s0_baselines.json")))
ladder = [v for v in B["variants"] if v["label"] == "Cash by default — the July heat ladder"][0]["last2"]
h2 = variants[0]["last2"]
cash_compare = {"window": list(L.LAST2), "sessions": h2["sessions"], "headline_sessions_in_cash_pct": outs["trend_and_breadth"]["last2_sessions_out_pct"],
                "headline_avg_cash_pct": h2["avg_cash_pct"], "heat_ladder_avg_cash_pct": ladder["avg_cash_pct"],
                "headline_total_return_pct": h2["total_return_pct"], "heat_ladder_total_return_pct": ladder["total_return_pct"],
                "headline_max_dd_pct": h2["max_dd_pct"], "heat_ladder_max_dd_pct": ladder["max_dd_pct"],
                "plain": f"Over the last two years the headline rule sat in cash on {outs['trend_and_breadth']['last2_sessions_out_pct']}% of sessions (all of the money, each time); the July heat ladder held {ladder['avg_cash_pct']}% in cash on average over the same sessions."}

# how much of the full-history result rests on 2008: the same runs measured from the first session of 2010
bh = L.fixed_mix(D, {"SPY": 1.0}, monthly=False, name="SPY"); S10 = ("2010-01-04", L.FULL[1])
def brief(sim, a, b): m = L.metrics(sim, a, b); return {"cagr_pct": m["cagr_pct"], "max_dd_pct": m["max_dd_pct"], "total_return_pct": m["total_return_pct"]}
since_2010 = {"window": list(S10), "buy_and_hold_spy": brief(bh, *S10), **{k: brief(sims[k], *S10) for k, _, _ in SPEC}}
vs_hold = {"full": brief(bh, *L.FULL), "last2": brief(bh, *L.LAST2), "stress": L.stress(bh)}

# self-checks: the same machinery with the switch held ON must be buy-and-hold SPY; held OFF must be Treasury bills
on = run(np.ones(N, bool), "always in"); off = run(np.zeros(N, bool), "always out"); i0 = D.ix[L.FULL[0]]
checks = {"always_in": {"full_cagr_pct": L.metrics(on, *L.FULL)["cagr_pct"], "full_max_dd_pct": L.metrics(on, *L.FULL)["max_dd_pct"], "last2_total_return_pct": L.metrics(on, *L.LAST2)["total_return_pct"],
                        "expected": [10.96, -55.2, 39.6]},
          "always_out": {"full_cagr_pct": L.metrics(off, *L.FULL)["cagr_pct"], "last2_total_return_pct": L.metrics(off, *L.LAST2)["total_return_pct"], "expected": [1.77, 8.2]},
          "start_state_same_one_close_earlier": {k: bool(WANT[k][i0] == WANT[k][i0 - 1]) for k, _, _ in SPEC},
          "sector_funds_first_counted": joined, "spy_200day_first_exists": D.dates[FIRST]}

H = outs["trend_and_breadth"]; T = outs["trend_only"]; ww = H["worst_whipsaw"]; f0 = variants[0]["full"]; f1 = variants[1]["full"]; v3 = variants[3]
l2r = [v["last2"]["total_return_pct"] for v in variants]; l2n = sum(len(o["last2_spells"]) for o in outs.values()); l2c = sum(o["last2_cost"] for o in outs.values())
last2_exits = {"exits_all_five_rules": l2n, "bought_back_higher": l2c, "bought_back_lower": sum(o["last2_saved"] for o in outs.values()),
               "returns_pct": {v["key"]: v["last2"]["total_return_pct"] for v in variants}, "buy_and_hold_spy_pct": vs_hold["last2"]["total_return_pct"]}
verdict = "did not help" if (f0["cagr_pct"] < f1["cagr_pct"] and f0["max_dd_pct"] <= f1["max_dd_pct"]) else "gave a mixed result"
out = {"structure": "s2_trend_core", "title": "Trend-filtered core — invested by default, out only when the market's trend breaks",
       "rule_plain": [
           "The money sits in SPY (the S&P 500 fund) by default. It moves to cash (Treasury bills) only when a simple regime rule says the market's trend has broken, and moves back when the rule clears.",
           "Trend = SPY's closing price against the average of its last 200 closes (the 200-day average). Under it = trend down.",
           "Breadth [how many parts of the market are healthy] = the share of the sector funds (technology, health care, financials and so on) that closed above their own 200-day average. Under half = breadth weak.",
           "Headline rule: go to cash only when SPY is under its 200-day average AND breadth is weak, both at once. Otherwise stay in SPY.",
           "The rule is read at each close and acted on at the next session's close. Each switch costs 0.05% of the amount moved.",
           "Four other ways of writing it are shown beside it: trend alone; a once-a-month check; the headline rule with a 3-day wait; and the headline rule using the Hub's own company breadth (last two years only)."],
       "variants": variants,
       "extras": {"outs": outs, "breadth_today": breadth_today, "time_in_cash_compare": cash_compare, "last2_exits": last2_exits, "since_2010": since_2010, "buy_and_hold_spy": vs_hold, "checks": checks},
       "caveats": [
           f"The rule did not make more money than simply holding SPY: {f0['cagr_pct']}% a year against {vs_hold['full']['cagr_pct']}% over the whole history. What it bought was a shallower worst fall ({f0['max_dd_pct']}% against {vs_hold['full']['max_dd_pct']}%), and the big saving was one event, 2008. Measured from January 2010 it made {since_2010['trend_and_breadth']['cagr_pct']}% a year against {since_2010['buy_and_hold_spy']['cagr_pct']}% for holding, with a worst fall of {since_2010['trend_and_breadth']['max_dd_pct']}% against {since_2010['buy_and_hold_spy']['max_dd_pct']}%.",
           f"The rule is often wrong in a small way. Of the headline rule's {H['closed']} completed exits, {H['saved']} were followed by SPY being lower at the buy-back (the exit saved money) and {H['cost']} by SPY being higher (it cost money)." + (f" The worst single one missed a {ww['spy_change_pct']}% rise in SPY (sold {ww['out']}, bought back {ww['back_in']})." if ww else ""),
           f"Adding the breadth test to the trend test {verdict} in this history. It switched more often ({H['count']} exits against {T['count']} for trend alone), made {f0['cagr_pct']}% a year against {f1['cagr_pct']}%, and its worst fall was {f0['max_dd_pct']}% against {f1['max_dd_pct']}%. When breadth hovers near half, the rule flips in and out.",
           f"Over the last two years the five rules made between {min(l2r)}% and {max(l2r)}%, against {vs_hold['last2']['total_return_pct']}% for holding SPY. Of the {l2n} exits they made in that window, {l2c} were bought back at a higher price.",
           f"The 3-day wait has the best numbers of the four long-history rules, but it is being picked out after seeing the results, and 3 days is one untested choice. It was slower in the fast falls: {v3['stress'].get('2008 crash')}% in the 2008 crash and {v3['stress'].get('2020 crash')}% in the 2020 crash, against {variants[0]['stress'].get('2008 crash')}% and {variants[0]['stress'].get('2020 crash')}% for the headline rule.",
           "A switch fills one session after the signal, at the close. In a fast fall much of the damage is done before the rule can act, and it usually buys back above where it sold.",
           f"Breadth here is {int(counted.iloc[i])} sector funds today but only 9 before {joined['XLRE']} (the real-estate fund is counted from then, the communications fund from {joined['XLC']}). It is a coarse reading of breadth, chosen because it has a long history with no hindsight.",
           "The last-two-years variant uses the Hub's breadth, which is measured on TODAY'S list of served companies. Companies that failed or were dropped are not in it, so it flatters the past, and two years with a handful of signals proves nothing by itself.",
           "The 200-day and 10-month lengths are the textbook settings, used as given. No other lengths were tried, so nothing here says the result holds for nearby settings.",
           "No taxes are counted. In a taxable account every exit is a sale, which would lower these numbers.",
           "One history, one market, one fund. A handful of large bear markets drive the result; that is a small sample."]}
L.save("s2_trend_core.json", out)

print(f"{'variant':26s} | FULL  cagr     dd  stock | LAST2  ret     dd  stock dec/mo | outs saved cost  worst-whipsaw  out%")
for v in variants:
    f, l, o = v["full"], v["last2"], outs[v["key"]]; w = o["worst_whipsaw"]
    print(f"{v['key']:26s} | " + (f"{f['cagr_pct']:10.2f} {f['max_dd_pct']:6.1f} {f['avg_stock_pct']:6.1f}" if f else " " * 24)
          + f" | {l['total_return_pct']:10.1f} {l['max_dd_pct']:6.1f} {l['avg_stock_pct']:6.1f} {l['decision_days_per_month']:6.2f}"
          + f" | {o['count']:4d} {o['saved']:5d} {o['cost']:4d}  " + (f"{w['spy_change_pct']:+6.2f}% {w['out']}" if w else " " * 18) + f"  {o['sessions_out_pct'] if o['sessions_out_pct'] is not None else o['last2_sessions_out_pct']}")
print("buy and hold SPY", vs_hold["full"], "last2", vs_hold["last2"]["total_return_pct"], "| stress", vs_hold["stress"])
for v in variants[:4]: print(f"  {v['key']:24s} stress {v['stress']}  since 2010 {since_2010[v['key']]}")
print("since 2010 buy and hold", since_2010["buy_and_hold_spy"])
print("breadth today", {k: breadth_today[k] for k in ["date", "sector_funds_above_200day", "sector_funds_counted", "share_pct", "spy_distance_pct", "served_companies_above_200day_pct"]}, breadth_today["rule_says_today"])
print("time in cash", cash_compare)
for k, o in outs.items():
    print(f"  last2 exits {k:26s}", "  ".join(f"{r['out']}>{r['back_in']} {r['spy_change_pct']:+.1f}%" for r in o["last2_spells"]))
print("last2 exits, all five rules", {k: last2_exits[k] for k in ["exits_all_five_rules", "bought_back_higher", "bought_back_lower"]})
print("checks", {k: checks[k] for k in ["always_in", "always_out", "start_state_same_one_close_earlier"]})
print(f"done in {time.time() - T0:.1f}s")
