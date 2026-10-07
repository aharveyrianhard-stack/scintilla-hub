# PF1 · structure 4: size by jumpiness (volatility). PART A spreads the money across a basket so that every holding carries
# the same risk (calm holdings get more money, jumpy ones less) and sets it beside plain equal money. PART B holds SPY at a
# steady risk level: all in while SPY is calm, part in Treasury bills once it turns jumpy.
# NO HINDSIGHT: everything a decision reads (the 63-session and 20-session volatility, how many bars a member has) is built
# from rows 0..i only, and the target fills at the NEXT session's close (the library's one-session lag).
import math, time
import numpy as np, pandas as pd
import pf1lib as L

T0 = time.time(); D = L.load()
I0 = D.ix[L.FULL[0]]; VOL_N, SPY_N, BAND = 63, 20, 0.10
ME = [d for d in L.month_ends(D, D.dates[0], L.FULL[1]) if d != D.dates[-1]]    # the last data day is not a known month end
ME_SET = set(ME); assert D.dates[I0 - 1] in ME_SET                              # the opening target is the 31 Dec 2004 month-end decision
BASKETS = {"sectors": (L.SECTORS, 252), "leaders": (L.LEADERS, 126)}            # members and the bars each needs before it joins
NAMES = {"XLK": "technology", "XLV": "health care", "XLF": "financials", "XLY": "consumer discretionary", "XLI": "industrials", "XLB": "materials",
         "XLE": "energy", "XLP": "consumer staples", "XLU": "utilities", "XLRE": "real estate", "XLC": "communications"}


def trailing_vol(sym, n):
    """Standard deviation of the last n daily total returns the symbol actually has, as known at each close."""
    r = D.ret[sym].dropna(); return r.rolling(n, min_periods=n).std().reindex(D.c.index).ffill()


ALL = L.SECTORS + L.LEADERS
VOL = pd.DataFrame({s: trailing_vol(s, VOL_N) for s in ALL}); BARS = D.c[ALL].notna().cumsum()


def weights(i, basket, equal_risk):
    """The basket's target at the close of row i: weight ∝ 1 ÷ volatility (equal risk) or 1/N (equal money), summing to 100%."""
    syms, need = BASKETS[basket]
    v = {s: float(VOL[s].iat[i]) for s in syms if BARS[s].iat[i] >= need}
    raw = {s: (1.0 / x if equal_risk else 1.0) for s, x in v.items() if np.isfinite(x) and x > 0}; tot = sum(raw.values())
    return {s: x / tot for s, x in raw.items()}


def run_basket(basket, equal_risk, name):
    def decide(i, d, w): return weights(i, basket, equal_risk) if d in ME_SET else None
    return L.simulate(D, decide, initial=weights(I0 - 1, basket, equal_risk), name=name)


RV = D.ret["SPY"].rolling(SPY_N, min_periods=SPY_N).std() * math.sqrt(252.0)      # SPY's realised yearly volatility, known at each close


def run_spy(target, name, band=BAND, snap=False):
    """The brief's rule is band=10 points, snap=False. `snap` (sensitivity table only) also steps up whenever the formula says 100%."""
    want = (target / RV).clip(upper=1.0)                                          # the share the rule wants at each close, never above 100%
    def decide(i, d, w):
        x = want.iat[i]; cur = w.get("SPY", 0.0)
        if not np.isfinite(x): return None
        return {"SPY": float(x)} if abs(x - cur) >= band - 1e-12 or (snap and x >= 1.0 and cur < 0.995) else None
    x0 = want.iat[I0 - 1]
    return L.simulate(D, decide, initial={"SPY": float(x0)} if np.isfinite(x0) and x0 >= BAND else None, name=name), want


def pct(x, nd=1): return round(100.0 * float(x), nd)


# ---------------------------------------------------------------- the six variants, each one continuous run over the FULL window
sims = {"sectors_equal_risk": run_basket("sectors", True, "sectors_equal_risk"), "sectors_equal_dollar": run_basket("sectors", False, "sectors_equal_dollar"),
        "leaders_equal_risk": run_basket("leaders", True, "leaders_equal_risk"), "leaders_equal_dollar": run_basket("leaders", False, "leaders_equal_dollar")}
want = {}
for tgt in (15, 12): sims[f"spy_vol_target_{tgt}"], want[tgt] = run_spy(tgt / 100.0, f"spy_vol_target_{tgt}")
HINDSIGHT = "HINDSIGHT: the basket is today's winners, chosen knowing how the story ended — read it as an illustration of the weighting, not as a result anyone could have had"
SPEC = [("sectors_equal_risk", "Sector funds, equal risk (calm sectors get more money)",
         "the sector funds weighted by 1 ÷ their jumpiness over the last 63 sessions, reset at each month end, always fully invested"),
        ("sectors_equal_dollar", "Sector funds, equal money in each", "the same sector funds with the same amount in each (1/N), reset at each month end, always fully invested"),
        ("leaders_equal_risk", "Today's leading stocks, equal risk (hindsight basket)", "weighted by 1 ÷ jumpiness over the last 63 sessions, reset at each month end, always fully invested. " + HINDSIGHT),
        ("leaders_equal_dollar", "Today's leading stocks, equal money in each (hindsight basket)", "the same amount in each stock (1/N), reset at each month end, always fully invested. " + HINDSIGHT),
        ("spy_vol_target_15", "SPY held at a steady 15% risk level, rest in cash", "SPY share = 15% ÷ SPY's yearly jumpiness over the last 20 sessions, capped at 100%; an order only when the wanted share is 10 points or more from the held share"),
        ("spy_vol_target_12", "SPY held at a steady 12% risk level, rest in cash", "SPY share = 12% ÷ SPY's yearly jumpiness over the last 20 sessions, capped at 100%; an order only when the wanted share is 10 points or more from the held share")]
variants = [dict(L.report(sims[k], D, label, note), key=k) for k, label, note in SPEC]; V = {v["key"]: v for v in variants}


# ---------------------------------------------------------------- extras, part A: who gets how much, and how jumpy each basket was
def basket_extras(basket):
    syms, need = BASKETS[basket]; i = D.ix[ME[-1]]; wr, wd = weights(i, basket, True), weights(i, basket, False)
    rows = sorted([{"sym": s, "name": NAMES.get(s, s), "vol_63d_yearly_pct": pct(VOL[s].iat[i] * math.sqrt(252.0)), "equal_risk_pct": pct(wr[s]), "equal_dollar_pct": pct(wd[s])}
                   for s in wr], key=lambda r: -r["equal_risk_pct"])
    hist = {s: [] for s in syms}; joined = {}; top = []; low = []; count = []
    for d in ME:                                                                  # every month-end decision the simulation used
        j = D.ix[d]
        if j < I0 - 1: continue
        w = weights(j, basket, True); top.append(max(w.values())); low.append(min(w.values())); count.append(len(w))
        for s, x in w.items():
            hist[s].append(x)
            if s not in joined: joined[s] = d
    hi = max(range(len(top)), key=lambda k: top[k]); dates = [d for d in ME if D.ix[d] >= I0 - 1]; whi = weights(D.ix[dates[hi]], basket, True)
    er, ed = V[f"{basket}_equal_risk"], V[f"{basket}_equal_dollar"]
    return {"as_of": ME[-1], "min_sessions_to_join": need, "members_now": len(rows), "members_at_start": int(count[0]), "latest_weights": rows,
            "largest": rows[0], "smallest": rows[-1], "largest_to_smallest_ratio": round(rows[0]["equal_risk_pct"] / rows[-1]["equal_risk_pct"], 2),
            "joined": [{"sym": s, "first_decision": joined[s], "from_the_start": joined[s] == dates[0], "first_bar": D.meta["first_bar"][s]} for s in syms if s in joined],
            "never_joined": [s for s in syms if s not in joined],
            "average_weight_while_member": sorted([{"sym": s, "equal_risk_pct": pct(np.mean(hist[s])), "months": len(hist[s])} for s in syms if hist[s]], key=lambda r: -r["equal_risk_pct"]),
            "weight_history": {"month_ends": len(top), "average_largest_pct": pct(np.mean(top)), "average_smallest_pct": pct(np.mean(low)),
                               "largest_ever_pct": pct(top[hi]), "largest_ever_sym": max(whi, key=whi.get), "largest_ever_date": dates[hi], "members_then": int(count[hi])},
            "realised_yearly_vol_pct": {"full": {"equal_risk": er["full"]["vol_pct"], "equal_dollar": ed["full"]["vol_pct"]},
                                        "last2": {"equal_risk": er["last2"]["vol_pct"], "equal_dollar": ed["last2"]["vol_pct"]}},
            "full_cagr_pct": {"equal_risk": er["full"]["cagr_pct"], "equal_dollar": ed["full"]["cagr_pct"]},
            "full_max_dd_pct": {"equal_risk": er["full"]["max_dd_pct"], "equal_dollar": ed["full"]["max_dd_pct"]}}


# ---------------------------------------------------------------- extras, part B: how much SPY the rule held, and when
def share_stats(x):
    return {"sessions": int(len(x)), "average_share_pct": pct(x.mean()), "at_100_pct_of_sessions": pct((x >= 0.995).mean()),
            "under_75_pct_of_sessions": pct((x < 0.75).mean()), "under_50_pct_of_sessions": pct((x < 0.50).mean()), "lowest_share_pct": pct(x.min())}


def spy_extras(tgt):
    sim = sims[f"spy_vol_target_{tgt}"]; held = sim["stock"]; w = want[tgt]; spy = D.c["SPY"]; pbs = []; last = D.ix[L.LAST2[1]]
    for p in L.pullbacks(D):
        a, b = p["peak"], p["trough"]; h = held.loc[a:b]; cuts = [t["date"] for t in sim["trades"] if a < t["date"] <= b and t["delta_pct"] < 0]
        # what happened AFTER the low (description only, nothing here feeds a decision): the scorecard's 40-session rebound window
        reb = held.loc[a:D.dates[min(D.ix[b] + 40, last)]]; low_d = reb.idxmin(); late_sells = [t["date"] for t in sim["trades"] if b < t["date"] <= D.dates[min(D.ix[b] + 10, last)] and t["delta_pct"] < 0]
        back = next((d for d in held.loc[low_d:].index if d > low_d and held[d] >= 0.90), None) if reb.min() < 0.90 else None
        pbs.append({**p, "sessions_peak_to_trough": int(len(h)), "average_held_share_pct": pct(h.mean()), "held_at_peak_pct": pct(held[a]), "held_at_trough_pct": pct(held[b]),
                    "lowest_held_share_pct": pct(h.min()), "average_wanted_share_pct": pct(w.loc[a:b].mean()), "first_cut_filled": cuts[0] if cuts else None,
                    "spy_already_down_at_first_cut_pct": pct(spy[cuts[0]] / spy[a] - 1) if cuts else None,
                    "sessions_from_peak_to_first_cut": (D.ix[cuts[0]] - D.ix[a]) if cuts else None,
                    "lowest_share_through_rebound_pct": pct(reb.min()), "lowest_share_date": low_d, "sessions_from_trough_to_lowest_share": D.ix[low_d] - D.ix[b],
                    "sells_in_10_sessions_after_trough": len(late_sells), "back_to_90pct_date": back,
                    "spy_up_from_trough_by_then_pct": pct(D.tr["SPY"][back] / D.tr["SPY"][b] - 1) if back else None})
    f = V[f"spy_vol_target_{tgt}"]["full"]
    return {"target_yearly_vol_pct": tgt, "realised_yearly_vol_full_pct": f["vol_pct"], "wanted_share_now_pct": pct(w.iat[-1]), "held_share_now_pct": pct(held.iloc[-1]),
            "held_share": {"full": share_stats(held.loc[L.FULL[0]:L.FULL[1]]), "last2": share_stats(held.loc[L.LAST2[0]:L.LAST2[1]])},
            "wanted_share": {"full": share_stats(w.loc[L.FULL[0]:L.FULL[1]]), "last2": share_stats(w.loc[L.LAST2[0]:L.LAST2[1]])},
            "pullbacks_last2": pbs}


extras = {"baskets": {b: basket_extras(b) for b in BASKETS}, "spy_vol_target": {str(t): spy_extras(t) for t in (15, 12)},
          "definitions": {"basket_volatility": f"standard deviation of the last {VOL_N} daily total returns (dividends included), known at the month-end close",
                          "spy_volatility": f"standard deviation of SPY's last {SPY_N} daily total returns × √252, known at each close",
                          "at_100": "held share of 99.5% or more", "held_share": "the SPY weight the portfolio actually had at each close",
                          "wanted_share": "what the formula asked for at each close, before the 10-point no-trade band and the one-session delay"},
          "spy_realised_vol_now_pct": pct(RV.iat[-1]), "spy_realised_vol_median_full_pct": pct(RV.loc[L.FULL[0]:L.FULL[1]].median())}

# sensitivity (NOT variants): how much of Part B's result is the 10-point no-trade band rather than the idea itself
def band_row(tgt, label, band, snap):
    sim = run_spy(tgt / 100.0, "band")[0] if (band == BAND and not snap) else run_spy(tgt / 100.0, "band", band, snap)[0]
    f, l = L.metrics(sim, *L.FULL), L.metrics(sim, *L.LAST2)
    return {"rule": label, "is_the_tested_rule": band == BAND and not snap, "full_cagr_pct": f["cagr_pct"], "full_max_dd_pct": f["max_dd_pct"], "full_average_share_pct": f["avg_stock_pct"],
            "full_orders_per_month": f["orders_per_month"], "last2_total_return_pct": l["total_return_pct"], "last2_max_dd_pct": l["max_dd_pct"],
            "last2_average_share_pct": l["avg_stock_pct"], "last2_orders_per_month": l["orders_per_month"], "cost_paid_pct": round(100 * sim["cost_paid"], 2)}


BANDS = [("10-point band (the rule as tested)", 0.10, False), ("10-point band, but always step up to 100% when the formula says 100%", 0.10, True),
         ("5-point band", 0.05, False), ("2-point band", 0.02, False)]
extras["band_sensitivity"] = {"note": "not variants: the same Part B rule with a different no-trade band, to show how much the band itself matters",
                              **{str(t): [band_row(t, *b) for b in BANDS] for t in (15, 12)}}
for t in (15, 12):                                                                # the tested row has to reproduce the variant exactly
    r0, v0 = extras["band_sensitivity"][str(t)][0], V[f"spy_vol_target_{t}"]
    assert (r0["full_cagr_pct"], r0["last2_total_return_pct"]) == (v0["full"]["cagr_pct"], v0["last2"]["total_return_pct"])

# data flag: XLF on the day the real-estate fund was spun out of it (a fall the market did not have)
fd = "2016-09-19"; fm = max(d for d in ME if d < fd); fr = float(D.ret["XLF"][fd])
fw = {"equal_risk": weights(D.ix[fm], "sectors", True)["XLF"], "equal_dollar": weights(D.ix[fm], "sectors", False)["XLF"]}
extras["data_flags"] = [{"sym": "XLF", "date": fd, "our_one_day_return_pct": pct(fr), "spy_same_day_pct": pct(D.ret["SPY"][fd]),
                         "what": "the real-estate fund (XLRE) was spun out of XLF on this day; the source prices look only partly adjusted for it, so XLF shows a fall the market did not have",
                         "xlf_weight_then_pct": {k: pct(x) for k, x in fw.items()}, "one_off_hit_to_basket_pct": {k: pct(x * fr, 2) for k, x in fw.items()}}]
flag = extras["data_flags"][0]

# self-check: a volatility target nobody can exceed is "always 100% SPY" and has to equal the baseline file's buy-and-hold SPY
chk = L.report(run_spy(1e6, "check")[0], D, "check"); ref = {"full_cagr_pct": 10.96, "full_max_dd_pct": -55.2, "last2_total_return_pct": 39.6}
got = {"full_cagr_pct": chk["full"]["cagr_pct"], "full_max_dd_pct": chk["full"]["max_dd_pct"], "last2_total_return_pct": chk["last2"]["total_return_pct"]}
extras["self_check_always_100pct_spy"] = {"got": got, "buy_and_hold_spy": ref, "match": got == ref}
assert got == ref, f"always-in-SPY check failed: {got} vs {ref}"

# ---------------------------------------------------------------- the words
sx, lx, b15, b12 = extras["baskets"]["sectors"], extras["baskets"]["leaders"], extras["spy_vol_target"]["15"], extras["spy_vol_target"]["12"]
bs15 = extras["band_sensitivity"]["15"]; p1 = b15["pullbacks_last2"][0]; ncut = sum(1 for q in b15["pullbacks_last2"] if q["first_cut_filled"])
late = lambda bx: ", ".join(f"{j['sym']} from {j['first_decision']}" for j in sorted(bx["joined"], key=lambda j: j["first_decision"]) if not j["from_the_start"])
rule_plain = [
    f"PART A, spreading the money. Once a month, at the last close of the month, measure how jumpy each holding has been over its last {VOL_N} trading days, about three months [jumpiness = volatility: the typical size of its daily moves, dividends included].",
    "Equal risk: give each holding money in proportion to 1 ÷ its jumpiness, so a calm holding gets more money and a jumpy one less, and each is expected to swing the portfolio by about the same amount. The shares are scaled to add up to 100%.",
    "Equal money: the plain comparison, the same amount in every holding [1/N], reset at the same month ends.",
    f"Basket one is the sector funds: {sx['members_at_start']} of them in 2005, {sx['members_now']} today. A fund joins at the first month end after it has {BASKETS['sectors'][1]} sessions (a year) of history ({late(sx)}).",
    f"Basket two is today's leading stocks: {lx['members_at_start']} of them in 2005, {lx['members_now']} today. A stock joins at the first month end after it has {BASKETS['leaders'][1]} sessions (six months) of history ({late(lx)}). This basket was picked with hindsight.",
    "Part A is always 100% invested: it changes how the money is spread, never how much is in the market.",
    f"PART B, a steady risk level. Every day at the close, measure SPY's jumpiness over its last {SPY_N} trading days and express it as a yearly figure. SPY share = 15% ÷ that figure (a second version uses 12%), never more than 100%; the rest sits in Treasury bills. Example: SPY running at 30% a year gives a 50% share; at 15% or calmer it is fully invested.",
    "To avoid trading every day, an order is sent only when the wanted share is 10 points or more away from the share actually held.",
    "Every decision uses only what was known at that close and is filled at the next session's close, paying the study's standard trading cost."]
se, sd, le, ld, v15, v12 = [V[k] for k, _, _ in SPEC]
SPY_FULL, SPY_LAST2, SPY_2008 = ref["full_cagr_pct"], ref["last2_total_return_pct"], abs(chk["stress"]["2008 crash"])   # buy-and-hold SPY, re-run above as the self-check
caveats = [
    "The leading-stocks basket is hindsight: these are today's winners, so its returns say nothing about what a stock picker could have earned.",
    f"Even the comparison between the two weightings of that basket is tilted. In a basket chosen because every member won, the jumpiest members were the biggest winners, so giving them less money (equal risk: {le['full']['cagr_pct']}% a year against {ld['full']['cagr_pct']}% for equal money) is bound to look worse than it would in a basket chosen without hindsight. The part that does carry over is the smoother ride: yearly jumpiness {le['full']['vol_pct']}% against {ld['full']['vol_pct']}%.",
    f"The leading-stocks basket is not the same thing all the way through: it starts with {lx['members_at_start']} stocks and ends with {lx['members_now']}. Our price history for GOOGL starts on {D.meta['first_bar']['GOOGL']} and for NBIS on {D.meta['first_bar']['NBIS']}, although Google has been listed since 2004 and Nebius's predecessor company traded for years before, so both are missing from the basket's early years.",
    f"In its early years the leading-stocks basket held only {lx['members_at_start']} stocks, and equal risk put as much as {lx['weight_history']['largest_ever_pct']}% of the money in one of them ({lx['weight_history']['largest_ever_sym']}, {lx['weight_history']['largest_ever_date']}). That is concentration, not spreading.",
    "Part A never holds cash, so it does not protect in a crash: " + f"in the 2008 crash the equal-risk sector basket lost {abs(se['stress']['2008 crash'])}% against {abs(sd['stress']['2008 crash'])}% for equal money and {SPY_2008}% for SPY, and that was also its deepest fall of the whole test.",
    f"Both sector baskets trailed plain SPY: {se['full']['cagr_pct']}% (equal risk) and {sd['full']['cagr_pct']}% (equal money) a year against {SPY_FULL}% over the full window, and {se['last2']['total_return_pct']}% and {sd['last2']['total_return_pct']}% against {SPY_LAST2}% over the last two years, because spreading across sectors holds far less technology than SPY does.",
    "Equal risk here looks at each holding on its own. It ignores that the holdings rise and fall together, so it does not make every holding contribute the same share of the portfolio's total risk.",
    f"The jumpiness measure looks backward ({VOL_N} sessions for Part A, {SPY_N} for Part B). It only rises after prices have already started to swing, so the cut comes after the first part of a fall, and the return to full size comes after the first part of the rebound. In the {p1['peak']} to {p1['trough']} fall the 15% rule first sold with SPY already {abs(p1['spy_already_down_at_first_cut_pct'])}% down, was still selling after the low (its smallest share, {p1['lowest_share_through_rebound_pct']}%, came {p1['sessions_from_trough_to_lowest_share']} sessions after it) because violent rebound days count as jumpiness too, and was not back to 90% until SPY had already risen {p1['spy_up_from_trough_by_then_pct']}% from the low. Its round trip (peak, low, 40 sessions on) was {v15['scorecard']['pullbacks'][0]['round_trip_pct']}% against {v15['scorecard']['pullbacks'][0]['spy_round_trip_pct']}% for SPY.",
    f"Part B does not deliver its label: with no borrowing the share is capped at 100%, so in calm markets it is simply SPY. The 15% version's own yearly jumpiness over the full window came out at {b15['realised_yearly_vol_full_pct']}%, the 12% version's at {b12['realised_yearly_vol_full_pct']}%.",
    f"The 10-point no-trade band means the held share can sit up to 10 points away from the wanted share for long stretches: over the full window the 15% formula wanted 100% on {b15['wanted_share']['full']['at_100_pct_of_sessions']}% of sessions but the portfolio was at 100% on {b15['held_share']['full']['at_100_pct_of_sessions']}%. That idle sliver of cash is part of the result: letting the 15% rule always step up to 100% when the formula says so would have made {bs15[1]['full_cagr_pct']}% a year instead of {bs15[0]['full_cagr_pct']}%, and {bs15[1]['last2_total_return_pct']}% instead of {bs15[0]['last2_total_return_pct']}% over the last two years.",
    f"The 15% and 12% targets, the 20- and 63-session windows and the 10-point band are the brief's round numbers. Nothing was tuned, but other choices would give different results, and a single 22-year history has only three big falls to learn from. In the last two years the 15% rule sold on the way down in only {ncut} of the {len(b15['pullbacks_last2'])} SPY pullbacks of 5% or more, so the recent scorecard rests on very few events.",
    "The sector funds changed shape during the test: real estate was carved out of financials in 2016 and communications was built partly from technology and consumer discretionary in 2018, so the basket of 2005 is not the basket of today.",
    f"A data blemish: XLF's price series falls {abs(flag['our_one_day_return_pct'])}% on {flag['date']}, the day the real-estate fund was spun out of it, while SPY moved {flag['spy_same_day_pct']}%. That looks like a spin-off the source prices only partly adjust for. It takes about {abs(flag['one_off_hit_to_basket_pct']['equal_risk'])}% off the equal-risk sector basket and {abs(flag['one_off_hit_to_basket_pct']['equal_dollar'])}% off the equal-money one, once; too small to change any conclusion.",
    "No taxes are counted. Monthly resets and the Part B orders would create taxable sales in a normal account."]

out = {"structure": "s4_vol_sizing", "title": "Size by jumpiness: equal risk across holdings, and SPY held at a steady risk level",
       "rule_plain": rule_plain, "variants": variants, "extras": extras, "caveats": caveats}


def scan(o, path="$"):                                                            # the page reads this file: no NaN, no numpy types
    if isinstance(o, dict):
        for k, x in o.items(): scan(x, f"{path}.{k}")
    elif isinstance(o, (list, tuple)):
        for k, x in enumerate(o): scan(x, f"{path}[{k}]")
    elif isinstance(o, float) and not math.isfinite(o): raise ValueError(f"not a finite number at {path}")
    elif not isinstance(o, (str, int, float, bool, type(None))): raise TypeError(f"{type(o)} at {path}")


scan(out); p = L.save("s4_vol_sizing.json", out)

for v in variants:
    f, l = v["full"], v["last2"]
    print(f"{v['key']:22s} FULL cagr {f['cagr_pct']:6.2f} vol {f['vol_pct']:5.1f} dd {f['max_dd_pct']:6.1f} stock {f['avg_stock_pct']:5.1f} | LAST2 ret {l['total_return_pct']:6.1f} dd {l['max_dd_pct']:6.1f} "
          f"stock {l['avg_stock_pct']:5.1f} dec/mo {l['decision_days_per_month']:5.2f} | cost {v['cost_paid_pct']:5.2f}% turnover {v['turnover_x']:5.1f}x | " + " ".join(f"{k.split()[0]} {float(x):6.1f}" for k, x in v["stress"].items()))
for b, bx in extras["baskets"].items():
    print(f"{b}: {bx['members_now']} members on {bx['as_of']}; equal money = {bx['latest_weights'][0]['equal_dollar_pct']}% each; largest {bx['largest']['sym']} {bx['largest']['equal_risk_pct']}% "
          f"(vol {bx['largest']['vol_63d_yearly_pct']}%), smallest {bx['smallest']['sym']} {bx['smallest']['equal_risk_pct']}% (vol {bx['smallest']['vol_63d_yearly_pct']}%); yearly vol full: equal risk {bx['realised_yearly_vol_pct']['full']['equal_risk']}% / equal money {bx['realised_yearly_vol_pct']['full']['equal_dollar']}%")
    print("   latest:", ", ".join(f"{r['sym']} {r['equal_risk_pct']}" for r in bx["latest_weights"]))
    print("   joined later:", late(bx), "| history:", bx["weight_history"])
for t, sx_ in extras["spy_vol_target"].items():
    print(f"spy vol target {t}%: own yearly vol {sx_['realised_yearly_vol_full_pct']}% (full); share now: wanted {sx_['wanted_share_now_pct']}%, held {sx_['held_share_now_pct']}%")
    for kind in ("held_share", "wanted_share"):
        for win in ("full", "last2"):
            q = sx_[kind][win]; print(f"   {kind:12s} {win:5s} average {q['average_share_pct']:5.1f}% | at 100% {q['at_100_pct_of_sessions']:5.1f}% of sessions | under 75% {q['under_75_pct_of_sessions']:5.1f}% | under 50% {q['under_50_pct_of_sessions']:5.1f}% | lowest {q['lowest_share_pct']:5.1f}%")
    for q in sx_["pullbacks_last2"]:
        print(f"   pullback {q['peak']} → {q['trough']} ({q['depth_pct']}%): average held {q['average_held_share_pct']}%, at peak {q['held_at_peak_pct']}%, at trough {q['held_at_trough_pct']}%, "
              f"first cut {q['first_cut_filled']} with SPY already {q['spy_already_down_at_first_cut_pct']}%; lowest share {q['lowest_share_through_rebound_pct']}% on {q['lowest_share_date']} "
              f"({q['sessions_from_trough_to_lowest_share']:+d} sessions vs the low), back to 90% {q['back_to_90pct_date']} with SPY {q['spy_up_from_trough_by_then_pct']}% off the low")
for t in ("15", "12"):
    for r in extras["band_sensitivity"][t]:
        print(f"band check {t}% | {r['rule'][:68]:68s} FULL cagr {r['full_cagr_pct']:5.2f} dd {r['full_max_dd_pct']:6.1f} share {r['full_average_share_pct']:5.1f} orders/mo {r['full_orders_per_month']:5.2f} | LAST2 ret {r['last2_total_return_pct']:5.1f} dd {r['last2_max_dd_pct']:6.1f}")
print("data flag:", {k: (float(x) if isinstance(x, float) else x) for k, x in flag.items() if k != "what"})
print("self-check (always 100% SPY):", "PASS" if extras["self_check_always_100pct_spy"]["match"] else "FAIL", {k: float(x) for k, x in got.items()}); print(f"saved {p} in {time.time() - T0:.1f}s")
