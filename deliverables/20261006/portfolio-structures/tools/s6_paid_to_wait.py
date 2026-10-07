# PF1 · structure 6 · GETTING PAID TO WAIT: selling a cash-secured put at the price where you would buy, and selling covered
# calls on shares you hold. We store NO option prices, so every premium here is MODELLED (Black-Scholes fed by the VIX), not
# measured. Nothing in this file looks ahead: a strike, a premium and a limit are all fixed from the close they are set on;
# a later close only decides how the option settles.
#
# THE MODEL (the page prints this):
#   * European options on SPY. Spot = SPY close. Time = remaining sessions / 252. Rate = the 3-month bill yield at that close.
#     Dividend yield ignored. Volatility = VIX / 100 for puts (no extra for the skew), 0.90 x VIX / 100 for calls.
#     KNOWN BIAS: the VIX leans heavily on far-from-the-money puts, so options AT the money trade below it and calls above
#     the market further below still. Feeding the VIX in as-is therefore makes the at-the-money put and the 2%-above call too
#     rich; the extras re-run every variant with lower inputs so the page can show how much of the result is the model.
#   * Premium received is cut by 5% for spread and commission. Shares that change hands in the four variants (assignment,
#     call-away, the first purchase, topping up) pay the library's 5 basis points like every other fund order in the study.
#   * An option is sold at a close every 21 sessions from 2005-01-03 and settles on the close 21 sessions later.
#   * All cash (the collateral AND the premium) sits in bills. The position is marked to the model every session.
import math, time
import numpy as np, pandas as pd
import pf1lib as L

T0 = time.time()
D = L.load()
I0, I1 = D.ix[L.FULL[0]], D.ix[L.FULL[1]]; IDX = D.dates[I0:I1 + 1]
CYCLE, HAIRCUT, CALL_VOL, KBPS = 21, 0.05, 0.90, L.COST_BPS_FUND / 1e4
S, O, LO = D.c["SPY"].values, D.o["SPY"].values, D.l["SPY"].values
R = (D.c["US3M"].ffill() / 100.0).values; V = (D.vix / 100.0).values
RET, CASHR, TR = D.ret["SPY"].values, D.cash_ret.values, D.tr["SPY"].values
SMA50 = L.sma(D.c["SPY"], 50).values
QDIV = (D.div["SPY"].rolling(252, min_periods=252).sum() / D.c["SPY"]).fillna(0.0).values   # trailing dividend yield (sensitivity only)


def _N(x): return 0.5 * (1.0 + math.erf(x / math.sqrt(2.0)))


def bs(kind, s, k, n_sess, r, vol, q=0.0):
    """Black-Scholes value and delta of one European option with n_sess sessions left. At expiry: what it pays."""
    if n_sess <= 0:
        return (max(k - s, 0.0), -1.0 if s < k else 0.0) if kind == "put" else (max(s - k, 0.0), 1.0 if s > k else 0.0)
    t = n_sess / 252.0; sd = vol * math.sqrt(t); dq = math.exp(-q * t); dr = math.exp(-r * t)
    d1 = (math.log(s / k) + (r - q + 0.5 * vol * vol) * t) / sd; d2 = d1 - sd
    if kind == "put": return k * dr * _N(-d2) - s * dq * _N(-d1), -dq * _N(-d1)
    return s * dq * _N(d1) - k * dr * _N(d2), dq * _N(d1)


def run(name, mode, put_m=0.98, call_m=1.02, put_vol=1.0, call_vol=CALL_VOL, offset=0, use_q=False, sell=True):
    """One continuous run over the FULL window. mode 'put' = always cash, cash-settled puts on the whole account;
    'call' = always SPY, cash-settled calls on all of it (premium swept into shares at each sale); 'wheel' = puts while in
    cash, assigned into shares, calls while holding, called away into cash. `offset` shifts the 21-session calendar,
    `sell=False` sells nothing (the self-check against buy-and-hold and against bills)."""
    cash, stock, opt, holding = 1.0, 0.0, None, mode == "call"
    eq, st, trades, cycles, turnover, cost = [], [], [], [], 0.0, 0.0
    if mode == "call":                                   # bought once at the first close, like the buy-and-hold yardstick
        fee = KBPS * cash; stock, cash = cash - fee, 0.0; turnover += 1.0; cost += fee
    for i in range(I0, I1 + 1):
        if i > I0: cash *= 1.0 + CASHR[i]; stock *= 1.0 + RET[i]
        s, d, q = S[i], D.dates[i], (QDIV[i] if use_q else 0.0)
        if sell and i >= I0 + offset and (i - I0 - offset) % CYCLE == 0:
            if opt is not None:                          # 1) the option sold 21 sessions ago settles on this close
                k, n, kind = opt["k"], opt["n"], opt["kind"]; itm = (s < k) if kind == "put" else (s > k)
                if itm and mode == "wheel" and kind == "put":          # assigned: the collateral buys n shares at the strike
                    e = cash + stock - n * (k - s); fee = KBPS * n * k; cash -= n * k + fee; stock += n * s; holding = True
                    trades.append({"date": d, "sym": "SPY", "delta_pct": round(100 * n * s / e, 2), "what": "assigned - bought at the put strike"})
                    turnover += n * k / e; cost += fee / e
                elif itm and mode == "wheel":                          # called away: n shares go at the strike (dividend crumbs at the close)
                    e = cash + stock - n * (s - k); got = stock - n * (s - k); fee = KBPS * got; cash += got - fee
                    trades.append({"date": d, "sym": "SPY", "delta_pct": round(-100 * stock / e, 2), "what": "called away - sold at the call strike"})
                    turnover += got / e; cost += fee / e; stock = 0.0; holding = False
                elif itm: cash -= n * ((k - s) if kind == "put" else (s - k))   # cash-settled
                cycles.append({"start": opt["date"], "end": d, "kind": kind, "itm": bool(itm), "prem_pct": opt["prem_pct"],
                               "ret_pct": 100 * ((cash + stock) / opt["e_open"] - 1), "spy_pct": 100 * (TR[i] / TR[opt["i"]] - 1)})
            e_open = cash + stock                        # 2) the next one is sold on the same close
            if holding:
                k = call_m * s; price, delta = bs("call", s, k, CYCLE, R[i], V[i] * call_vol, q); vm = call_vol
                if mode == "call":                       # sweep the cash (premium in, last settlement out) so calls cover the whole account
                    p = (1 - HAIRCUT) * price / s; v = (stock * (1 + KBPS) + cash) / (1 - p + KBPS)
                    if v < stock: v = (stock * (1 - KBPS) + cash) / (1 - p - KBPS)
                    turnover += abs(v - stock) / e_open; cost += KBPS * abs(v - stock) / e_open; stock, cash = v, 0.0; n = stock / s
                else: n = stock / s; cash += (1 - HAIRCUT) * n * price
                coll = n * s; kind = "call"; dlt = -delta * n * s / e_open
            else:
                k = put_m * s; price, delta = bs("put", s, k, CYCLE, R[i], V[i] * put_vol, q); vm = put_vol
                n = cash / k; cash += (1 - HAIRCUT) * n * price; coll = n * k; kind = "put"; dlt = -delta * n * s / e_open
            turnover += n * price / e_open; cost += HAIRCUT * n * price / e_open
            trades.append({"date": d, "sym": "SPY " + kind, "delta_pct": round(100 * dlt, 2), "what": "sold a 21-session " + kind})
            opt = {"kind": kind, "k": k, "n": n, "exp": i + CYCLE, "i": i, "date": d, "e_open": e_open, "vm": vm,
                   "prem_pct": 100 * (1 - HAIRCUT) * n * price / coll}
        if opt is not None:                              # 3) mark to the model at this close
            val, delta = bs(opt["kind"], s, opt["k"], opt["exp"] - i, R[i], V[i] * opt["vm"], q)
            e = cash + stock - opt["n"] * val
            x = (-delta * opt["n"] * s) / e if opt["kind"] == "put" else (stock - delta * opt["n"] * s) / e
        else: e = cash + stock; x = stock / e
        eq.append(e); st.append(x)
    return {"name": name, "equity": pd.Series(eq, index=IDX), "stock": pd.Series(st, index=IDX), "bond": pd.Series(0.0, index=IDX),
            "trades": trades, "decision_days": len(set(t["date"] for t in trades)), "turnover": turnover, "cost_paid": cost,
            "cycles": cycles, "open_cycle": opt is not None}


def cycle_stats(sim):
    cy = sim["cycles"]; w = min(cy, key=lambda c: c["ret_pct"]); prem = float(np.mean([c["prem_pct"] for c in cy]))
    out = {"cycles_completed": len(cy), "cycle_still_open_at_the_end": 1 if sim["open_cycle"] else 0,
           "ended_in_the_money_pct": round(100 * float(np.mean([c["itm"] for c in cy])), 1),
           "mean_premium_pct_of_collateral": round(prem, 2), "mean_premium_annualised_pct": round(prem * 252 / CYCLE, 1),
           "mean_cycle_result_pct": round(float(np.mean([c["ret_pct"] for c in cy])), 2),
           "worst_cycle": {"start": w["start"], "end": w["end"], "kind": w["kind"], "result_pct": round(w["ret_pct"], 1), "spy_pct": round(w["spy_pct"], 1)},
           "stress": L.stress(sim)}
    kinds = sorted(set(c["kind"] for c in cy))
    if len(kinds) > 1:                                   # the wheel: split the cycles into its two halves
        for kd in kinds:
            sub = [c for c in cy if c["kind"] == kd]
            out[kd + "_cycles"] = {"cycles": len(sub), "ended_in_the_money_pct": round(100 * float(np.mean([c["itm"] for c in sub])), 1),
                                   "mean_premium_pct_of_collateral": round(float(np.mean([c["prem_pct"] for c in sub])), 2)}
        out["cycles_spent_holding_shares_pct"] = round(100 * sum(c["kind"] == "call" for c in cy) / len(cy), 1)
    return out


# ---------- the four variants ----------
SPECS = [
    ("put_at_the_money", dict(mode="put", put_m=1.00),
     "Always in cash, selling a monthly promise to buy SPY at today's price (cash-secured put - premiums modelled, not measured)",
     "Every 21 sessions: sell puts [a promise to buy] struck at that close on the whole account, cash in bills, settled in cash 21 sessions later; never owns SPY. Premiums are modelled from the VIX, not measured."),
    ("put_2pct_below", dict(mode="put", put_m=0.98),
     "Always in cash, selling a monthly promise to buy SPY 2% below today's price (cash-secured put - premiums modelled, not measured)",
     "Same, with the strike [the promised buying price] set 2% under that close. Premiums are modelled from the VIX, not measured."),
    ("covered_call_2pct", dict(mode="call", call_m=1.02),
     "Always holding SPY, selling a monthly promise to sell it 2% above today's price (covered call - premiums modelled, not measured)",
     "Holds SPY throughout. Every 21 sessions: sell calls [a promise to sell] struck 2% over that close against all of it; any rise past the strike is paid away in cash, shares kept. Premiums are modelled, not measured."),
    ("wheel", dict(mode="wheel", put_m=0.98, call_m=1.02),
     "The wheel: promise to buy 2% lower until you own SPY, then promise to sell 2% higher until it is taken (premiums modelled, not measured)",
     "In cash: sell puts struck 2% under the close; if SPY ends below, you buy at the strike. Holding: sell calls struck 2% over the close; if SPY ends above, the shares go at the strike and you are back in cash. Premiums are modelled, not measured."),
]
sims = {}; variants = []
for key, kw, label, note in SPECS:
    sims[key] = run(key, **kw); r = L.report(sims[key], D, label, note); r["key"] = key; variants.append(r)


# ---------- extras ----------
def window(sim, a, b):
    m = L.metrics(sim, a, b); return {"cagr_pct": m["cagr_pct"], "vol_pct": m["vol_pct"], "max_dd_pct": m["max_dd_pct"], "total_return_pct": m["total_return_pct"]}


spy = L.fixed_mix(D, {"SPY": 1.0}, monthly=False, name="SPY"); bills = L.fixed_mix(D, {}, monthly=False, name="bills")
MC = ("2007-06-29", "2018-12-31")
extras = {
    "model": {"pricing": "Black-Scholes, European, on SPY", "time": "remaining sessions / 252", "rate": "3-month bill yield at that close",
              "dividend_yield": "ignored", "put_volatility": "VIX / 100, nothing added for the skew", "call_volatility": "0.90 x VIX / 100",
              "premium_cut_pct": 100 * HAIRCUT, "share_cost_bps": L.COST_BPS_FUND, "cycle_sessions": CYCLE, "first_sale": IDX[0],
              "contracts": "puts: account / strike (the full strike sits in bills); calls: one per share held",
              "premium_figures": "net of the 5% cut; annualised = per-cycle mean x 12 (252 / 21), not compounded. Premium collected is NOT profit: what the options cost at settlement comes out of it (see mean_cycle_result_pct)",
              "turnover_counts": "option premium traded plus the value of shares that changed hands, each as a share of the account"},
    "per_variant": {k: cycle_stats(s) for k, s in sims.items()},
    "stress_spy": L.stress(spy), "stress_bills": L.stress(bills),
    "contract_size_today": {"date": D.dates[-1], "SPY_close": float(D.c["SPY"].iloc[-1]), "QQQ_close": float(D.c["QQQ"].iloc[-1]),
                            "SPY_one_contract_usd": round(100 * float(D.c["SPY"].iloc[-1])), "QQQ_one_contract_usd": round(100 * float(D.c["QQQ"].iloc[-1])),
                            "note": "one option contract covers 100 shares, so one cash-secured put ties up about this much cash (a little less: 100 x the strike)"},
    "model_check": {"window": list(MC), "note": "modelled put-at-the-money variant beside SPY (total return) over the same dates; the page sets these against the published Cboe PUT index",
                    "put_at_the_money_modelled": window(sims["put_at_the_money"], *MC), "SPY": window(spy, *MC)},
}
sk = run("skew", mode="put", put_m=0.98, put_vol=1.15); skm = L.metrics(sk, *L.FULL); b0 = variants[1]["full"]
extras["skew_sensitivity"] = {"what": "put_2pct_below re-run with the put volatility input raised from 1.00 x VIX to 1.15 x VIX (modelled)",
                              "base": {"full_cagr_pct": b0["cagr_pct"], "full_max_dd_pct": b0["max_dd_pct"], "mean_premium_pct_of_collateral": extras["per_variant"]["put_2pct_below"]["mean_premium_pct_of_collateral"]},
                              "vol_1_15x": {"full_cagr_pct": skm["cagr_pct"], "full_max_dd_pct": skm["max_dd_pct"], "last2_total_return_pct": L.metrics(sk, *L.LAST2)["total_return_pct"],
                                            "mean_premium_pct_of_collateral": cycle_stats(sk)["mean_premium_pct_of_collateral"]}}

# not in the brief, added because each could mislead: (a) the volatility fed to the model decides most of the answer; (b) the
# model ignores dividends, which under-prices puts and over-prices calls; (c) the answer depends on WHICH day of the month the
# 21-session calendar happens to land on.
PUT_DAILY = ("2007-01-03", L.FULL[1])                    # the span Cboe's PUT index has a daily history for (see s6b_cboe_measured)
GRID = {"put_at_the_money": [(x, None) for x in (1.00, 0.95, 0.90, 0.85, 0.80)], "put_2pct_below": [(x, None) for x in (1.15, 1.00, 0.95, 0.90, 0.85)],
        "covered_call_2pct": [(None, x) for x in (0.90, 0.85, 0.80, 0.75, 0.70, 0.65)], "wheel": [(1.00, 0.90), (1.00, 0.70), (0.95, 0.70), (0.90, 0.70)]}
vg = {}
for key, kw, _, _ in SPECS:
    rows = []
    for pv, cv in GRID[key]:
        x = run(key, **{**kw, **({} if pv is None else {"put_vol": pv}), **({} if cv is None else {"call_vol": cv})})
        f, l2, cs = L.metrics(x, *L.FULL), L.metrics(x, *L.LAST2), cycle_stats(x)
        rows.append({"put_vol_x_vix": pv, "call_vol_x_vix": cv, "as_published": bool((pv in (None, 1.0)) and (cv in (None, CALL_VOL))),
                     "full_cagr_pct": f["cagr_pct"], "full_max_dd_pct": f["max_dd_pct"], "full_cagr_minus_spy_pts": round(f["cagr_pct"] - L.metrics(spy, *L.FULL)["cagr_pct"], 2),
                     "last2_total_return_pct": l2["total_return_pct"], "last2_max_dd_pct": l2["max_dd_pct"],
                     "cagr_pct_2007_01_03_on": L.metrics(x, *PUT_DAILY)["cagr_pct"], "model_check_window_cagr_pct": L.metrics(x, *MC)["cagr_pct"],
                     "mean_premium_pct_of_collateral": cs["mean_premium_pct_of_collateral"]})
    vg[key] = rows
extras["vol_input_sensitivity"] = {
    "what": "each variant re-run with a different volatility input (a multiple of the VIX); everything else unchanged. Modelled, not measured.",
    "why": "options at the money usually trade BELOW the VIX and calls above the market lower still, so the published inputs (1.00 x VIX for puts, 0.90 x VIX for calls) make those premiums too rich. Read the rows to see which input brings the model into line with Cboe's measured PUT and BXY indexes.",
    "spy": {"full_cagr_pct": L.metrics(spy, *L.FULL)["cagr_pct"], "full_max_dd_pct": L.metrics(spy, *L.FULL)["max_dd_pct"], "last2_total_return_pct": L.metrics(spy, *L.LAST2)["total_return_pct"],
            "cagr_pct_2007_01_03_on": L.metrics(spy, *PUT_DAILY)["cagr_pct"], "model_check_window_cagr_pct": L.metrics(spy, *MC)["cagr_pct"]},
    "variants": vg}

dv = {}
for key, kw, _, _ in SPECS:
    m = L.metrics(run(key + "_q", use_q=True, **kw), *L.FULL); f = variants[[v["key"] for v in variants].index(key)]["full"]
    dv[key] = {"full_cagr_pct_dividends_ignored": f["cagr_pct"], "full_cagr_pct_dividends_in_model": m["cagr_pct"], "change_points": round(m["cagr_pct"] - f["cagr_pct"], 2),
               "full_max_dd_pct_dividends_in_model": m["max_dd_pct"]}
extras["dividend_sensitivity"] = {"what": "each variant re-run with SPY's trailing-12-month dividend yield (known at each close) fed into the option model instead of zero", "variants": dv}
rd = {}
for key, kw, _, _ in SPECS:
    ms = [(L.metrics(x, *L.FULL), L.metrics(x, *L.LAST2)) for x in (run(key, offset=o, **kw) for o in range(CYCLE))]
    cg = [a["cagr_pct"] for a, _ in ms]; dd = [a["max_dd_pct"] for a, _ in ms]; l2 = [b["total_return_pct"] for _, b in ms]
    rd[key] = {"full_cagr_pct": {"min": min(cg), "median": round(float(np.median(cg)), 2), "max": max(cg), "as_published_offset_0": cg[0]},
               "full_max_dd_pct": {"worst": min(dd), "median": round(float(np.median(dd)), 1), "mildest": max(dd), "as_published_offset_0": dd[0]},
               "last2_total_return_pct": {"min": min(l2), "median": round(float(np.median(l2)), 1), "max": max(l2), "as_published_offset_0": l2[0]}}
extras["roll_day_sensitivity"] = {"what": "each variant re-run 21 times, the selling calendar starting 0 to 20 sessions after 2005-01-03 (before its first sale the account just sits in its resting state)", "variants": rd}

# self-checks the page can quote: with nothing sold, the engine must reproduce the library's own yardsticks
c0, p0 = run("check", mode="call", sell=False), run("check", mode="put", sell=False)
extras["self_checks"] = {"engine_with_no_options_sold_vs_library": {
    "holding_SPY": {"engine": window(c0, *L.FULL), "library_buy_and_hold": window(spy, *L.FULL), "last2_engine": window(c0, *L.LAST2)["total_return_pct"], "last2_library": window(spy, *L.LAST2)["total_return_pct"],
                    "largest_daily_gap": float(np.abs(c0["equity"].values / spy["equity"].values - 1).max())},
    "in_cash": {"engine": window(p0, *L.FULL), "library_bills": window(bills, *L.FULL), "last2_engine": window(p0, *L.LAST2)["total_return_pct"], "last2_library": window(bills, *L.LAST2)["total_return_pct"],
                "largest_daily_gap": float(np.abs(p0["equity"].values / bills["equity"].values - 1).max())}}}


# ---------- the entry experiment: "paid to wait" against "just waiting" ----------
def e_lump(s, H): return {"end": TR[s + H] / TR[s], "inv": s}


def e_limit(s, H):
    """Everything on one resting limit at the 50-day average: session j's limit is the average at the close of j-1."""
    if S[s] <= SMA50[s]: return {**e_lump(s, H), "at_start": True}
    cash = 1.0
    for j in range(s + 1, s + H + 1):
        cash *= 1.0 + CASHR[j]; lim = SMA50[j - 1]
        if LO[j] <= lim:
            px = min(lim, O[j]); return {"end": cash / px * S[j] * TR[s + H] / TR[j], "inv": j}
    return {"end": cash, "inv": None}


def e_put(s, H):
    """Every 21 sessions while not holding: a put on the whole amount, struck at the 50-day average, kept between 90% and 98% of spot."""
    cash, t, prem_total, ks = 1.0, s, 0.0, []
    while t + CYCLE <= s + H:
        k = min(max(SMA50[t], 0.90 * S[t]), 0.98 * S[t]); n = cash / k; prem = (1 - HAIRCUT) * n * bs("put", S[t], k, CYCLE, R[t], V[t])[0]
        cash += prem; prem_total += prem; ks.append(k / S[t]); x = t + CYCLE
        for j in range(t + 1, x + 1): cash *= 1.0 + CASHR[j]
        if S[x] < k:                                     # assigned: buy n shares at the strike, then simply hold; the spare premium stays in bills
            cash -= n * k
            for j in range(x + 1, s + H + 1): cash *= 1.0 + CASHR[j]
            return {"end": cash + n * S[x] * TR[s + H] / TR[x], "inv": x, "prem": prem_total, "k": ks}
        t = x
    return {"end": cash, "inv": None, "prem": prem_total, "k": ks}


def month_firsts(a, b): return [d for i, d in enumerate(D.dates) if a <= d <= b and (i == 0 or D.dates[i - 1][:7] != d[:7])]


def experiment(starts, H, marks):
    """The table: one row of numbers per method. Column names follow the level-scaling study (s5) where the idea is the same."""
    idxs = [D.ix[d] for d in starts]; res = {"lump": [], "wait_limit_50d": [], "put_at_level": []}
    for s in idxs: res["lump"].append(e_lump(s, H)); res["wait_limit_50d"].append(e_limit(s, H)); res["put_at_level"].append(e_put(s, H))
    lump = np.array([x["end"] for x in res["lump"]]); out = {}
    def r(x, n=2): return round(float(x), n)
    for mth, rows in res.items():
        end = np.array([x["end"] for x in rows]); gap = 100 * (end - lump); kw, kg = int(end.argmin()), int(gap.argmin()); first = mth == "lump"
        held = np.array([0.0 if x["inv"] is None else (s + H - x["inv"]) / H for x, s in zip(rows, idxs)])
        o = {"mean_pct": r(100 * (end.mean() - 1)), "median_pct": r(100 * (np.median(end) - 1)),
             "above_lump_share_pct": None if first else r(100 * (gap > 1e-7).mean(), 1), "tied_with_lump_share_pct": None if first else r(100 * (np.abs(gap) <= 1e-7).mean(), 1),
             "mean_gap_pts": None if first else r(gap.mean()), "median_gap_pts": None if first else r(np.median(gap)),
             "worst_gap_pts": None if first else r(gap[kg]), "worst_gap_start": None if first else starts[kg],
             "uninvested_end_pct": r(100 * np.mean([x["inv"] is None for x in rows]), 1), "time_invested_pct": r(100 * held.mean(), 1),
             "worst_pct": r(100 * (end[kw] - 1)), "worst_start": starts[kw], "best_pct": r(100 * (end.max() - 1))}
        if mth == "put_at_level":
            o["mean_premium_collected_pct"] = r(100 * np.mean([x["prem"] for x in rows])); o["mean_strike_pct_of_spot"] = r(100 * np.mean([k for x in rows for k in x["k"]]), 1)
            for mk in marks: o["assigned_within_%d_pct" % mk] = r(100 * np.mean([x["inv"] is not None and x["inv"] - s <= mk for x, s in zip(rows, idxs)]), 1)
            never = np.array([x["inv"] is None for x in rows])       # the two ways it ends: never made to buy (SPY stayed up) / made to buy
            for nm, pick in [("when_never_made_to_buy", never), ("when_made_to_buy", ~never)]:
                o[nm] = {"starts": int(pick.sum())} if not pick.any() else {"starts": int(pick.sum()), "put_at_level_mean_pct": r(100 * (end[pick].mean() - 1)), "lump_mean_pct": r(100 * (lump[pick].mean() - 1)),
                                                                             "mean_gap_pts": r(gap[pick].mean()), "above_lump_share_pct": r(100 * (gap[pick] > 1e-7).mean(), 1)}
        out[mth] = o
    return {"starts": len(starts), "first_start": starts[0], "last_start": starts[-1], "horizon_sessions": H, "methods": out}


full_starts = [d for d in month_firsts(L.FULL[0], L.FULL[1]) if D.ix[d] + 252 <= I1]
last2_starts = [d for d in month_firsts("2024-10-01", L.LAST2[1]) if D.ix[d] + 126 <= I1]     # October 2024 on, as the level-scaling study counts them
extras["entry_experiment"] = {
    "design": "You hold 1.00 of cash and want to own SPY. One start per month (its first session). Idle cash earns Treasury bills; SPY earns its total return (price plus dividends); no trading costs, as in the level-scaling study; put premiums are MODELLED (VIX in, 5% cut), not measured; the end value is counted at the close of the last session of the horizon.",
    "methods_plain": {"lump": "buy everything at the start close",
                      "wait_limit_50d": "one resting buy order for everything at the 50-day average (each day's limit = the average at the previous close; filled when the day's low reaches it, at the limit or at the open if the open is lower); if the start close is already at or below the average, buy at the start close",
                      "put_at_level": "every 21 sessions while still in cash, sell a 21-session put on the whole amount struck at the 50-day average (never above 98% nor below 90% of that close); if SPY closes below the strike at expiry you buy at the strike and then just hold; otherwise keep the premium and repeat"},
    "columns": {"mean_pct / median_pct": "average and middle result at the end of the horizon, in percent", "above_lump_share_pct": "share of starts that finished ahead of buying all at once",
                "tied_with_lump_share_pct": "share of starts that finished exactly level with it (SPY was already at or under the average on day one, so everything was bought that day)",
                "mean_gap_pts / median_gap_pts": "the method's result minus the all-at-once result, in percentage points (minus = it finished behind)",
                "uninvested_end_pct": "share of starts where SPY had still not been bought at the end of the horizon", "time_invested_pct": "average share of the horizon spent holding SPY",
                "mean_premium_collected_pct": "modelled premium kept per start, as a percent of the money, summed over the puts sold before SPY was bought",
                "assigned_within_N_pct": "share of starts where a put had made you buy SPY within N sessions"},
    "full": experiment(full_starts, 252, [63, 126, 252]),
    "last2": experiment(last2_starts, 126, [63, 126]),
    "last2_note": "%d monthly starts from October 2024 whose 126-session horizon has already finished (the same starts the level-scaling study uses). The first, 1 Oct 2024, is two sessions before the page's two-year window officially begins on 3 Oct 2024. So few starts, in a market that mostly rose: an illustration, not a statistic." % len(last2_starts)}

g = lambda key, pv, cv: next(x for x in vg[key] if x["put_vol_x_vix"] == pv and x["call_vol_x_vix"] == cv)
spy_cagr = L.metrics(spy, *L.FULL)["cagr_pct"]; EX = extras["entry_experiment"]["full"]; EE = EX["methods"]; PL = EE["put_at_level"]
spread = [x["full_cagr_pct"]["max"] - x["full_cagr_pct"]["min"] for x in rd.values()]
h0, hx, st0, sts = variants[0], extras["per_variant"]["put_at_the_money"], variants[0]["stress"], extras["stress_spy"]
extras["plain_findings"] = [
    f"As MODELLED, selling a put at today's price every month made {h0['full']['cagr_pct']:.1f}% a year since 2005 against {spy_cagr:.1f}% for simply holding SPY, with a worst fall of {h0['full']['max_dd_pct']:.0f}% against {L.metrics(spy, *L.FULL)['max_dd_pct']:.0f}%. The modelled premium is too rich (see the caveats): with nine-tenths of the VIX fed in, the same rule makes {g('put_at_the_money', 0.9, None)['full_cagr_pct']:.1f}% a year.",
    f"It softened the crashes; it did not step aside: 2008 {st0['2008 crash']:.0f}% (SPY {sts['2008 crash']:.0f}%), 2020 {st0['2020 crash']:.0f}% (SPY {sts['2020 crash']:.0f}%), 2022 {st0['2022 bear']:.0f}% (SPY {sts['2022 bear']:.0f}%). Its worst single month-long cycle lost {abs(hx['worst_cycle']['result_pct']):.1f}% ({hx['worst_cycle']['start']} to {hx['worst_cycle']['end']}, SPY {hx['worst_cycle']['spy_pct']:.1f}%).",
    f"Last two years, as modelled: {h0['last2']['total_return_pct']:+.1f}% against {L.metrics(spy, *L.LAST2)['total_return_pct']:+.1f}% for SPY and {L.metrics(bills, *L.LAST2)['total_return_pct']:+.1f}% for cash.",
    f"Premium is not profit: the at-the-money put collected {hx['mean_premium_pct_of_collateral']:.2f}% of the cash per cycle on average ({hx['mean_premium_annualised_pct']:.0f}% a year), but {hx['ended_in_the_money_pct']:.0f}% of cycles ended with SPY under the strike and the average cycle kept {hx['mean_cycle_result_pct']:.2f}%, bill interest included.",
    f"Paid to wait against just waiting ({EX['starts']} monthly starts, valued a year later, premiums modelled): buying at once ended {EE['lump']['mean_pct']:+.2f}% on average; one resting order at the 50-day average {EE['wait_limit_50d']['mean_pct']:+.2f}%; selling puts at that level {PL['mean_pct']:+.2f}%. The put seller finished ahead of buying at once in {PL['above_lump_share_pct']:.0f}% of starts, but spent only {PL['time_invested_pct']:.0f}% of the year holding SPY, and in the {PL['when_never_made_to_buy']['starts']} starts where SPY never came back to the strike it finished {abs(PL['when_never_made_to_buy']['mean_gap_pts']):.1f} points behind on average. The premium collected ({PL['mean_premium_collected_pct']:.1f}% of the money) was smaller than the rise it sat out.",
    f"One contract is 100 shares: a single cash-secured SPY put ties up about {extras['contract_size_today']['SPY_one_contract_usd']:,} dollars today, a QQQ put about {extras['contract_size_today']['QQQ_one_contract_usd']:,}.",
]
out = {"structure": "s6_paid_to_wait", "title": "Getting paid to wait - selling puts where you would buy, selling calls on what you hold (premiums modelled, not measured)",
       "rule_plain": [
           "A put you SELL is a promise to buy SPY at a set price [the strike] on a set date; you are paid a fee [the premium] up front for making it, and the full purchase price waits in Treasury bills meanwhile [cash-secured].",
           "A call you SELL on shares you own is a promise to sell them at a set price on a set date; you are paid a premium, and give up any rise beyond that price [covered call].",
           "Every 21 sessions (about a month) the rule sells a fresh 21-session option at the close and the old one settles on that same close. Nothing is predicted: the calendar alone decides the day.",
           "Put at the money: always in cash, promising to buy at today's close. If SPY ends lower, the shortfall is paid from the cash; SPY is never owned (the Cboe PutWrite index works this way).",
           "Put 2% below: the same with the promise set 2% under today's close - a smaller premium, and the first 2% of a fall costs nothing.",
           "Covered call 2% above: hold SPY all the time and promise to sell 2% over today's close; a month's rise beyond 2% is paid away in cash and the shares are kept.",
           "The wheel: sell puts 2% below while in cash; if SPY ends under the strike you buy there. While holding, sell calls 2% above; if SPY ends over the strike the shares go at that price and you are back in cash selling puts.",
           "We hold no option prices, so every premium is MODELLED, not measured: the standard option formula [Black-Scholes] fed with the market's own fear gauge [the VIX] at that close, then cut by 5% for the dealing spread and commission.",
           "The account is revalued with the same model at every close, so the falls shown are daily, not just month-end.",
       ],
       "variants": variants, "extras": extras,
       "caveats": [
           "Every premium here is modelled, not measured: we store no option prices. Real quotes differ from the formula, most of all in a panic, when the gap between the buying and selling price of an option widens far beyond the flat 5% assumed here.",
           "The model pays the seller too much where it matters most. The VIX leans heavily on the prices of puts far below the market, so options AT the market usually trade below it, and calls above the market lower still. Fed the VIX as it stands, the at-the-money put and the covered call come out better than the real thing. Where Cboe publishes a measured index for the same strategy (PUT, BXY), believe the index, not this model.",
           f"How much of the result is the model: the at-the-money put makes {g('put_at_the_money', 1.0, None)['full_cagr_pct']:.1f}% a year with the VIX fed in whole, {g('put_at_the_money', 0.9, None)['full_cagr_pct']:.1f}% at nine-tenths of it and {g('put_at_the_money', 0.8, None)['full_cagr_pct']:.1f}% at eight-tenths. The covered call makes {g('covered_call_2pct', None, 0.9)['full_cagr_pct']:.1f}% a year as published (SPY itself: {spy_cagr:.1f}%), {g('covered_call_2pct', None, 0.8)['full_cagr_pct']:.1f}% with the call input at 0.80 x VIX and {g('covered_call_2pct', None, 0.7)['full_cagr_pct']:.1f}% at 0.70. The modelled covered call beating plain SPY is the model talking, not a finding.",
           f"For puts well BELOW the market the lean runs the other way: they usually cost more than the VIX implies [the skew]. For a put only 2% below we cannot tell from our own data which side the real price sits on; the re-runs bracket it, from {g('put_2pct_below', 0.9, None)['full_cagr_pct']:.1f}% a year at 0.90 x VIX to {g('put_2pct_below', 1.15, None)['full_cagr_pct']:.1f}% at 1.15 x VIX - the input decides the answer.",
           "The model ignores SPY's dividends. That under-prices the puts but over-prices the calls, so the covered-call and wheel figures are flattered a little more; the dividend re-run in the extras puts a number on it.",
           "The 21-session calendar starting 3 January 2005 is not the exchange's real expiry calendar (the third Friday), and the result depends on which day the cycle happens to land: the roll-day re-run shows the spread across all 21 possible calendars (" + f"{min(spread):.1f} to {max(spread):.1f}" + " points a year between the luckiest and the unluckiest, depending on the variant).",
           "One SPY contract covers 100 shares, so these rules come in lumps of roughly %s dollars of cash per put at today's price; the test assumes any fraction can be traded." % format(int(round(extras["contract_size_today"]["SPY_one_contract_usd"], -3)), ","),
           "Real SPY options can be exercised early [American style], chiefly calls just before a dividend; the test treats them as settle-at-expiry only [European style]. Taxes are ignored: option premiums are taxed as short-term gains.",
           "A sold put does not avoid a crash: it takes nearly the full fall beyond the strike, and in return gives up the rise. The stock share shown is the option's equivalent holding [delta] at each close, which climbs toward 100% exactly when SPY is falling. Premium collected is not profit - the settlements come out of it.",
           "In the entry experiment the put strikes sit 2% to 10% below the market; for the deeper ones real puts are priced above the VIX, so the modelled premium there is, if anything, on the low side.",
           "The entry experiment's last-two-years table has few starts and a half-year horizon, in a market that mostly rose: it shows what happened, not what to expect.",
       ]}
for v in variants:                                       # the two rows the model flatters carry the warning with them
    if v["key"] in ("put_at_the_money", "covered_call_2pct"): v["note"] += " This is where the model is most generous to the seller - see the caveats and the measured Cboe index."
L.save("s6_paid_to_wait.json", out)

# ---------- compact summary ----------
print(f"{'variant (MODELLED)':18s} | {'FULL cagr':>9s} {'vol':>5s} {'maxdd':>6s} {'stock':>5s} | {'L2 ret':>6s} {'L2 dd':>6s} {'stock':>5s} {'dec/mo':>6s} | {'cyc':>3s} {'itm%':>5s} {'prem%':>5s} {'/yr':>5s} {'worst':>6s} | 2008 / 2020 / 2022")
for v in variants:
    f, l, x = v["full"], v["last2"], extras["per_variant"][v["key"]]; st = x["stress"]
    print(f"{v['key']:18s} | {f['cagr_pct']:9.2f} {f['vol_pct']:5.1f} {f['max_dd_pct']:6.1f} {f['avg_stock_pct']:5.1f} | {l['total_return_pct']:6.1f} {l['max_dd_pct']:6.1f} {l['avg_stock_pct']:5.1f} {l['decision_days_per_month']:6.2f}"
          f" | {x['cycles_completed']:3d} {x['ended_in_the_money_pct']:5.1f} {x['mean_premium_pct_of_collateral']:5.2f} {x['mean_premium_annualised_pct']:5.1f} {x['worst_cycle']['result_pct']:6.1f} | {st['2008 crash']:.1f} / {st['2020 crash']:.1f} / {st['2022 bear']:.1f}")
fs, ls, ss = L.metrics(spy, *L.FULL), L.metrics(spy, *L.LAST2), extras["stress_spy"]
print(f"{'SPY buy and hold':18s} | {fs['cagr_pct']:9.2f} {fs['vol_pct']:5.1f} {fs['max_dd_pct']:6.1f} {100.0:5.1f} | {ls['total_return_pct']:6.1f} {ls['max_dd_pct']:6.1f} {'':5s} {'':6s} | {'':3s} {'':5s} {'':5s} {'':5s} {'':6s} | {ss['2008 crash']:.1f} / {ss['2020 crash']:.1f} / {ss['2022 bear']:.1f}")
sc = extras["self_checks"]["engine_with_no_options_sold_vs_library"]
print("self-check (nothing sold): holding SPY cagr %.2f dd %.1f last2 %.1f, largest daily gap to the library %.1e | cash cagr %.2f last2 %.1f, gap %.1e" % (
    sc["holding_SPY"]["engine"]["cagr_pct"], sc["holding_SPY"]["engine"]["max_dd_pct"], sc["holding_SPY"]["last2_engine"], sc["holding_SPY"]["largest_daily_gap"], sc["in_cash"]["engine"]["cagr_pct"], sc["in_cash"]["last2_engine"], sc["in_cash"]["largest_daily_gap"]))
mcp, mcs = extras["model_check"]["put_at_the_money_modelled"], extras["model_check"]["SPY"]
print(f"model check {MC[0]} -> {MC[1]}: put at the money (modelled) cagr {mcp['cagr_pct']:.2f} vol {mcp['vol_pct']:.1f} dd {mcp['max_dd_pct']:.1f} | SPY cagr {mcs['cagr_pct']:.2f} vol {mcs['vol_pct']:.1f} dd {mcs['max_dd_pct']:.1f}")
sv = extras["skew_sensitivity"]; print(f"skew: put 2% below, full cagr {sv['base']['full_cagr_pct']:.2f} dd {sv['base']['full_max_dd_pct']:.1f} -> at 1.15 x VIX cagr {sv['vol_1_15x']['full_cagr_pct']:.2f} dd {sv['vol_1_15x']['full_max_dd_pct']:.1f}")
print("volatility input -> full cagr (2007-01-03 on) [last2 ret]:")
for key in vg: print(f"   {key:18s} " + "  ".join(f"{(x['put_vol_x_vix'] if x['put_vol_x_vix'] is not None else '-')}/{(x['call_vol_x_vix'] if x['call_vol_x_vix'] is not None else '-')}: {x['full_cagr_pct']:.2f} ({x['cagr_pct_2007_01_03_on']:.2f}) [{x['last2_total_return_pct']:.1f}]" for x in vg[key]))
print("dividends in the model, full cagr:", "  ".join(f"{k} {x['full_cagr_pct_dividends_ignored']:.2f}->{x['full_cagr_pct_dividends_in_model']:.2f}" for k, x in dv.items()))
print("roll day, full cagr min/median/max and worst/mildest max dd:", "  ".join(f"{k} {x['full_cagr_pct']['min']:.2f}/{x['full_cagr_pct']['median']:.2f}/{x['full_cagr_pct']['max']:.2f} dd {x['full_max_dd_pct']['worst']:.1f}/{x['full_max_dd_pct']['mildest']:.1f}" for k, x in rd.items()))
print("one contract ties up: SPY $%s, QQQ $%s" % (format(extras["contract_size_today"]["SPY_one_contract_usd"], ","), format(extras["contract_size_today"]["QQQ_one_contract_usd"], ",")))
for w in ["full", "last2"]:
    e = extras["entry_experiment"][w]; print(f"ENTRY {w}: {e['starts']} starts {e['first_start']} -> {e['last_start']}, horizon {e['horizon_sessions']} sessions")
    print(f"   {'method':15s} {'mean':>7s} {'median':>7s} {'>lump%':>6s} {'tie%':>5s} {'gap':>6s} {'medgap':>6s} {'uninv%':>6s} {'time%':>6s} {'worst':>7s}")
    for mth, o in e["methods"].items():
        h = lambda k, wd, p: (f"{o[k]:{wd}.{p}f}" if o[k] is not None else " " * (wd - 1) + "-")
        print(f"   {mth:15s} {o['mean_pct']:7.2f} {o['median_pct']:7.2f} {h('above_lump_share_pct', 6, 1)} {h('tied_with_lump_share_pct', 5, 1)} {h('mean_gap_pts', 6, 2)} {h('median_gap_pts', 6, 2)} {o['uninvested_end_pct']:6.1f} {o['time_invested_pct']:6.1f} {o['worst_pct']:7.2f}")
    o = e["methods"]["put_at_level"]; print(f"   put_at_level: premium {o['mean_premium_collected_pct']:.2f}% of the money, strike {o['mean_strike_pct_of_spot']:.1f}% of spot, assigned within " + ", ".join(f"{k.split('_')[2]}: {x:.1f}%" for k, x in o.items() if k.startswith("assigned_within")) + f" | never made to buy: {o['when_never_made_to_buy']} | made to buy: {o['when_made_to_buy']}")
print(f"saved data/s6_paid_to_wait.json in {time.time() - T0:.1f}s")
