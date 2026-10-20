#!/usr/bin/env python3
"""CW5 · the cycle arithmetic. From the raw FMP answers (quarterly statements, balance sheets, enterprise values, daily
prices, today's quote and consensus) build, per name:

- trailing-twelve-month figures at every quarter end (revenue, EBITDA, net income, diluted EPS, book value, net debt, shares);
- a MONTHLY series of multiples as the market could have known them: price at month end × the latest quarter whose
  filing was public by then (US names: FMP's filingDate; others: period end + 45 days). Trailing P/E = price ÷ TTM diluted
  EPS (n.m. when EPS ≤ 0); EV/sales and EV/EBITDA on TTM (EV = price × diluted shares + total debt − cash & short-term
  investments); P/B = price × shares ÷ total stockholders' equity. "Realised forward P/E" = price ÷ the NEXT four
  quarters' actual diluted EPS (perfect foresight; the only ten-year forward series that exists — FMP keeps no
  point-in-time consensus history). Today's forward P/E is the house NTM blend of FMP's fiscal-year consensus.
- the percentile today's multiple sits at in its own monthly history (meaningful observations only, share of n.m. months printed);
- EPS against its own ten-year high and low; gross margin against its own high (the DRAM/NAND price proxy);
- for Micron: the multiples at the 2018, 2022 and 2025 price peaks and at the trailing-EPS peaks that followed, and the
  premium or discount to SK hynix and Samsung month by month (ratio of multiples, so currencies cancel).
Data corrections are listed, never silent. Output: MEMORY-CYCLE.json (series + the figures the page prints).
usage: python3 compute.py <deliverable dir>"""
import json, os, sys, datetime as dt, statistics as st
from bisect import bisect_right

HERE = os.path.dirname(os.path.abspath(__file__))
ORDER = ["MU", "000660.KS", "005930.KS", "285A.T", "WDC", "SNDK", "2408.TW"]
US = {"MU", "WDC", "SNDK"}
LAG_DAYS = 45

def D(s): return dt.date.fromisoformat(s[:10])
def num(v):
    try:
        return None if v is None else float(v)
    except Exception:
        return None
def div(a, b):
    return a / b if (a is not None and b not in (None, 0)) else None
def pctile(series, x):
    """percentile rank of x among series (0 = lowest ever, 100 = highest ever)."""
    s = [v for v in series if v is not None]
    if not s or x is None: return None
    below = sum(1 for v in s if v < x); eq = sum(1 for v in s if v == x)
    return round(100 * (below + 0.5 * eq) / len(s), 1)
def month_ends(start, end):
    out = []; y, m = start.year, start.month
    while True:
        nm = dt.date(y + (m // 12), m % 12 + 1, 1); me = nm - dt.timedelta(days=1)
        if me > end: break
        out.append(me); y, m = nm.year, nm.month
    return out

def build(t, raw):
    A = raw["answers"]; notes = []; corrections = []
    prof = A["profile"]["data"][0]; quote = A["quote"]["data"]; quote = quote[0] if isinstance(quote, list) else quote
    ccy = prof.get("currency")
    inc = sorted([r for r in A["income-statement"]["data"] if r.get("revenue")], key=lambda r: r["date"])
    bs = {r["date"]: r for r in A["balance-sheet-statement"]["data"]}
    evs = {r["date"]: r for r in A["enterprise-values"]["data"]}
    px = sorted(((D(r["date"]), num(r["price"])) for r in A["historical-price-eod/light"]["data"] if r.get("price")), key=lambda x: x[0])
    px_dates = [d for d, _ in px]
    def price_at(day):
        i = bisect_right(px_dates, day) - 1
        return px[i][1] if i >= 0 and (day - px_dates[i]).days <= 10 else None

    # 1 · quarterly rows, with the cumulative-net-income correction (a quarter whose net income exceeds its revenue is a
    #     half-year or nine-month figure in FMP's row; the previous quarters of the same fiscal year are subtracted)
    Q = []
    for i, r in enumerate(inc):
        rev = num(r["revenue"]); ni = num(r.get("netIncome")); eps = num(r.get("epsDiluted")); ebitda = num(r.get("ebitda")); gp = num(r.get("grossProfit"))
        sh = num(r.get("weightedAverageShsOutDil")) or num(r.get("weightedAverageShsOut"))
        if ni is not None and rev and ni > rev:
            prev = [q for q in Q if q["fy"] == r.get("fiscalYear") and q["date"] < r["date"]]
            if prev:
                ni2 = ni - sum(q["ni"] for q in prev if q["ni"] is not None); eps2 = (eps - sum(q["eps"] for q in prev if q["eps"] is not None)) if eps is not None else None
                corrections.append({"ticker": t, "quarter": r["date"], "field": "netIncome/epsDiluted", "fmp": [ni, eps], "used": [ni2, eps2], "reason": "net income > revenue in FMP's row: read as cumulative for the fiscal year, prior quarters subtracted"})
                ni, eps = ni2, eps2
            else:
                corrections.append({"ticker": t, "quarter": r["date"], "field": "netIncome", "fmp": [ni, eps], "used": [None, None], "reason": "net income > revenue with no prior quarter to net against: left out"})
                ni, eps = None, None
        b = bs.get(r["date"]) or {}
        e = evs.get(r["date"]) or {}
        known = D(r["filingDate"]) if (t in US and r.get("filingDate") and D(r["filingDate"]) > D(r["date"])) else D(r["date"]) + dt.timedelta(days=LAG_DAYS)
        Q.append({"date": r["date"], "d": D(r["date"]), "known": known, "fy": r.get("fiscalYear"), "period": r.get("period"),
                  "rev": rev, "gp": gp, "ebit": num(r.get("operatingIncome")), "ebitda": ebitda, "ni": ni, "eps": eps, "shares": sh,
                  "ev_shares": num(e.get("numberOfShares")), "fmp_ev": num(e.get("enterpriseValue")), "fmp_mcap": num(e.get("marketCapitalization")), "fmp_px": num(e.get("stockPrice")),
                  "debt": num(b.get("totalDebt")), "cash": num(b.get("cashAndShortTermInvestments")) if b.get("cashAndShortTermInvestments") is not None else num(b.get("cashAndCashEquivalents")),
                  "equity": num(b.get("totalStockholdersEquity")), "has_bs": bool(b)})
    # TTM at each quarter end
    for i, q in enumerate(Q):
        w = Q[max(0, i - 3): i + 1]
        if len(w) == 4 and all(x["rev"] for x in w):
            q["rev_ttm"] = sum(x["rev"] for x in w)
            q["gp_ttm"] = sum(x["gp"] for x in w) if all(x["gp"] is not None for x in w) else None
            q["ebitda_ttm"] = sum(x["ebitda"] for x in w) if all(x["ebitda"] is not None for x in w) else None
            q["ni_ttm"] = sum(x["ni"] for x in w) if all(x["ni"] is not None for x in w) else None
            q["ebit_ttm"] = sum(x["ebit"] for x in w) if all(x["ebit"] is not None for x in w) else None
            q["eps_ttm"] = sum(x["eps"] for x in w) if all(x["eps"] is not None for x in w) else None
            q["gm_ttm"] = div(q["gp_ttm"], q["rev_ttm"])
        else:
            q["rev_ttm"] = q["gp_ttm"] = q["ebitda_ttm"] = q["ni_ttm"] = q["eps_ttm"] = q["gm_ttm"] = q["ebit_ttm"] = None
        nxt = Q[i + 1: i + 5]
        q["eps_next4"] = sum(x["eps"] for x in nxt) if (len(nxt) == 4 and all(x["eps"] is not None for x in nxt)) else None
        q["net_debt"] = (q["debt"] - q["cash"]) if (q["debt"] is not None and q["cash"] is not None) else None
        q["shares_used"] = q["shares"] or q["ev_shares"]

    def multiples(price, q):
        sh = q["shares_used"]
        if not price or not sh: return None
        mcap = price * sh; ev = mcap + (q["net_debt"] or 0)
        return {"price": price, "mcap": mcap, "ev": ev,
                "pe": div(price, q["eps_ttm"]) if (q["eps_ttm"] or 0) > 0 else None,
                "pe_nm": q["eps_ttm"] is not None and q["eps_ttm"] <= 0,
                "pe_fwd_realised": div(price, q["eps_next4"]) if (q["eps_next4"] or 0) > 0 else None,
                "ev_sales": div(ev, q["rev_ttm"]),
                "ev_ebitda": div(ev, q["ebitda_ttm"]) if (q["ebitda_ttm"] or 0) > 0 else None,
                "pb": div(mcap, q["equity"]) if (q["equity"] or 0) > 0 else None,
                "eps_ttm": q["eps_ttm"], "gm_ttm": q["gm_ttm"], "quarter": q["date"]}

    # 2 · monthly series as known at the time
    first_px = px_dates[0] if px_dates else None
    start = max(dt.date(2016, 10, 31), first_px) if first_px else dt.date(2016, 10, 31)
    monthly = []
    known_sorted = sorted(Q, key=lambda q: q["known"])
    kdates = [q["known"] for q in known_sorted]
    for me in month_ends(start, dt.date(2026, 9, 30)):
        i = bisect_right(kdates, me) - 1
        if i < 0: continue
        q = known_sorted[i]
        if q["rev_ttm"] is None: continue
        p = price_at(me)
        m = multiples(p, q)
        if m: m["date"] = me.isoformat(); monthly.append(m)
    quarterly = []
    for q in Q:
        if q["rev_ttm"] is None or q["d"] < dt.date(2016, 9, 1): continue
        p = price_at(q["d"])
        m = multiples(p, q)
        if m:
            m["date"] = q["date"]; m["fmp_ev"] = q["fmp_ev"]; m["fmp_mcap"] = q["fmp_mcap"]; quarterly.append(m)

    # 3 · today: quote price, latest TTM, consensus NTM (house blend)
    price_now = num(quote.get("price")); latest = [q for q in Q if q["rev_ttm"] is not None][-1]
    today = multiples(price_now, latest); today["date"] = "2026-10-20"
    today["fmp_mcap_profile"] = num(prof.get("marketCap"))
    est = sorted([r for r in (A["analyst-estimates"]["data"] or []) if r.get("date")], key=lambda r: r["date"])
    fut = [r for r in est if D(r["date"]) > dt.date(2026, 10, 20)]
    ntm = {"basis": "no estimate"}
    if fut:
        d1 = D(fut[0]["date"]); w = max(0.0, min(1.0, (d1 - dt.date(2026, 10, 20)).days / 365.0)); r1 = fut[0]; r2 = fut[1] if len(fut) > 1 else None
        def blend(k):
            a = num(r1.get(k)); b = num(r2.get(k)) if r2 else None
            if a is None: return None
            return a if b is None else w * a + (1 - w) * b
        ntm = {"basis": "NTM blend" if r2 else "FY1 only", "fy1": r1["date"], "fy2": r2["date"] if r2 else None, "w": round(w, 3),
               "revenue": blend("revenueAvg"), "ebitda": blend("ebitdaAvg"), "net_income": blend("netIncomeAvg"), "eps": blend("epsAvg"),
               "n_analysts_eps": r1.get("numAnalystsEps"), "n_analysts_rev": r1.get("numAnalystsRevenue"),
               "fy1_eps": num(r1.get("epsAvg")), "fy2_eps": num(r2.get("epsAvg")) if r2 else None, "fy1_ni": num(r1.get("netIncomeAvg")), "fy2_ni": num(r2.get("netIncomeAvg")) if r2 else None}
        today["pe_fwd"] = div(today["mcap"], ntm["net_income"]) if (ntm.get("net_income") or 0) > 0 else None
        today["pe_fwd_eps"] = div(price_now, ntm["eps"]) if (ntm.get("eps") or 0) > 0 else None
        today["ev_sales_fwd"] = div(today["ev"], ntm["revenue"]) if ntm.get("revenue") else None
        today["ev_ebitda_fwd"] = div(today["ev"], ntm["ebitda"]) if (ntm.get("ebitda") or 0) > 0 else None
        today["ni_growth_ntm_pct"] = (ntm["net_income"] / latest["ni_ttm"] - 1) * 100 if (ntm.get("net_income") and (latest["ni_ttm"] or 0) > 0) else None
    else:
        today["pe_fwd"] = today["pe_fwd_eps"] = today["ev_sales_fwd"] = today["ev_ebitda_fwd"] = today["ni_growth_ntm_pct"] = None

    # 4 · percentiles and the earnings position
    hist = monthly
    def series(k): return [m[k] for m in hist]
    pct = {}
    for k in ("pe", "pe_fwd_realised", "ev_sales", "ev_ebitda", "pb"):
        s = series(k); meaningful = [v for v in s if v is not None]
        pct[k] = {"today": today.get(k), "percentile": pctile(meaningful, today.get(k)), "n": len(meaningful), "n_months": len(s),
                  "median": st.median(meaningful) if meaningful else None, "low": min(meaningful) if meaningful else None, "high": max(meaningful) if meaningful else None,
                  "nm_months": len(s) - len(meaningful)}
    # forward P/E today against the realised-forward history (the only forward history there is)
    pct["pe_fwd_vs_realised"] = {"today": today.get("pe_fwd"), "percentile": pctile([m["pe_fwd_realised"] for m in hist], today.get("pe_fwd")),
                                 "median_realised": pct["pe_fwd_realised"]["median"]}
    eps_q = [(q["date"], q["eps_ttm"]) for q in Q if q["eps_ttm"] is not None and q["d"] >= dt.date(2016, 9, 1)]
    eps_hi = max(eps_q, key=lambda x: x[1]) if eps_q else None; eps_lo = min(eps_q, key=lambda x: x[1]) if eps_q else None
    gm_q = [(q["date"], q["gm_ttm"]) for q in Q if q["gm_ttm"] is not None and q["gm_ttm"] < 0.99 and q["d"] >= dt.date(2016, 9, 1)]
    gm_hi = max(gm_q, key=lambda x: x[1]) if gm_q else None; gm_lo = min(gm_q, key=lambda x: x[1]) if gm_q else None
    rev_q = [(q["date"], q["rev_ttm"]) for q in Q if q["rev_ttm"] is not None and q["d"] >= dt.date(2016, 9, 1)]
    rev_hi = max(rev_q, key=lambda x: x[1]) if rev_q else None
    earnings = {"eps_ttm_now": latest["eps_ttm"], "eps_ttm_quarter": latest["date"], "eps_ttm_high": eps_hi, "eps_ttm_low": eps_lo,
                "eps_now_vs_high_pct": (latest["eps_ttm"] / eps_hi[1] * 100) if (eps_hi and eps_hi[1] > 0 and latest["eps_ttm"] is not None) else None,
                "eps_prior_cycle_high": None, "gm_ttm_now": latest["gm_ttm"], "gm_high": gm_hi, "gm_low": gm_lo, "rev_ttm_now": latest["rev_ttm"], "rev_high": rev_hi,
                "latest_quarter_eps": latest["eps"], "latest_quarter_eps_annualised_vs_ttm": div(latest["eps"] * 4 if latest["eps"] is not None else None, latest["eps_ttm"]),
                "ntm_eps_vs_ttm": div(ntm.get("eps"), latest["eps_ttm"]) if (latest["eps_ttm"] or 0) > 0 else None,
                "ntm_ni_vs_ttm": div(ntm.get("net_income"), latest["ni_ttm"]) if (latest["ni_ttm"] or 0) > 0 else None}
    gm_prior = [x for x in gm_q if x[0] < "2025-01-01"]
    earnings["gm_prior_cycle_high"] = max(gm_prior, key=lambda x: x[1]) if gm_prior else None
    opex_ratio = (latest["gm_ttm"] - latest["ebit_ttm"] / latest["rev_ttm"]) if (latest["gm_ttm"] is not None and latest["ebit_ttm"] is not None and latest["rev_ttm"]) else None
    earnings["opex_ratio_ttm"] = opex_ratio
    if earnings["gm_prior_cycle_high"] and opex_ratio is not None and latest["eps_ttm"] and latest["gm_ttm"] and (latest["gm_ttm"] - opex_ratio) > 0:
        gmp = earnings["gm_prior_cycle_high"][1]
        earnings["eps_at_prior_peak_gm"] = latest["eps_ttm"] * (gmp - opex_ratio) / (latest["gm_ttm"] - opex_ratio)
        earnings["pe_at_prior_peak_gm"] = div(price_now, earnings["eps_at_prior_peak_gm"]) if earnings["eps_at_prior_peak_gm"] > 0 else None
    else:
        earnings["eps_at_prior_peak_gm"] = earnings["pe_at_prior_peak_gm"] = None
    before_2025 = [x for x in eps_q if x[0] < "2025-01-01"]
    if before_2025: earnings["eps_prior_cycle_high"] = max(before_2025, key=lambda x: x[1])
    # the number that decides: at the ten-year median trailing P/E, what EPS does today's price pay for, against consensus NTM EPS
    med_pe = pct["pe"]["median"]
    earnings["eps_implied_at_median_pe"] = div(price_now, med_pe)
    earnings["implied_vs_ntm_eps_pct"] = (earnings["eps_implied_at_median_pe"] / ntm["eps"] - 1) * 100 if (earnings["eps_implied_at_median_pe"] and (ntm.get("eps") or 0) > 0) else None
    earnings["implied_vs_ttm_eps_pct"] = (earnings["eps_implied_at_median_pe"] / latest["eps_ttm"] - 1) * 100 if (earnings["eps_implied_at_median_pe"] and (latest["eps_ttm"] or 0) > 0) else None

    # 5 · price history (monthly closes) for the chart strip, and the quarterly table
    closes = [{"date": me.isoformat(), "price": price_at(me)} for me in month_ends(start, dt.date(2026, 9, 30))]
    closes.append({"date": "2026-10-20", "price": price_now})
    if t == "285A.T": notes.append("Kioxia listed 18 Dec 2024: the multiple history is 22 months, the statements go back to FY2019 (pre-listing filings) so TTM EPS and the realised-forward series exist from 2020.")
    if t == "SNDK": notes.append("Sandisk was spun out of Western Digital on 13 Feb 2025: 20 months of prices; the statements are the carve-out financials from FY2024.")
    if t == "WDC": notes.append("Western Digital's figures before February 2025 include the flash business that became Sandisk; after it they are the HDD company. The ten-year series spans both.")
    if t == "005930.KS": notes.append("Samsung Electronics is a conglomerate: memory is one division (DS) beside foundry, phones, displays and appliances. Its multiples are a blended-company multiple, not a memory multiple.")
    if t not in US: notes.append(f"Non-US filings carry no filing date in FMP: a quarter is treated as public {LAG_DAYS} days after period end.")
    return {"ticker": t, "name": raw["name"], "currency": ccy, "company": prof.get("companyName"), "price_now": price_now, "fetched_utc": A["quote"]["fetched_utc"],
            "fmp_marketcap_profile": num(prof.get("marketCap")), "shares_used_latest": latest["shares_used"], "latest_quarter": latest["date"],
            "today": today, "ntm": ntm, "percentiles": pct, "earnings": earnings, "monthly": monthly, "quarterly": quarterly, "closes": closes,
            "quarters": [{k: (v.isoformat() if isinstance(v, dt.date) else v) for k, v in q.items()} for q in Q if q["d"] >= dt.date(2015, 9, 1)],
            "corrections": corrections, "notes": notes, "price_target_summary": A.get("price-target-summary", {}).get("data")}

def micron_cycle(res):
    mu = res["MU"]; mon = {m["date"]: m for m in mu["monthly"]}; closes = {c["date"]: c["price"] for c in mu["closes"] if c["price"]}
    def peak(lo, hi, fn=max):
        cands = [(d, p) for d, p in closes.items() if lo <= d <= hi]
        return fn(cands, key=lambda x: x[1]) if cands else None
    out = {"windows": {}}
    for label, lo, hi in (("2018", "2017-06-30", "2018-12-31"), ("2022", "2021-06-30", "2022-12-31"), ("2025", "2024-06-30", "2025-12-31"), ("2026 (to date)", "2026-01-01", "2026-10-20")):
        pk = peak(lo, hi)
        m = mon.get(pk[0]) if pk else None
        # trailing-EPS peak in the window or the two quarters after the price peak
        qs = [q for q in mu["quarters"] if q.get("eps_ttm") is not None and lo <= q["date"] <= hi[:4] + "-12-31"]
        eq = max(qs, key=lambda q: q["eps_ttm"]) if qs else None
        eq_m = None
        if eq:
            after = [x for x in mu["monthly"] if x["quarter"] == eq["date"]]
            eq_m = after[0] if after else None
        out["windows"][label] = {"price_peak": {"date": pk[0], "price": pk[1]} if pk else None, "at_price_peak": m,
                                 "eps_ttm_peak": {"quarter": eq["date"], "eps_ttm": eq["eps_ttm"], "gm_ttm": eq.get("gm_ttm")} if eq else None, "at_eps_peak": eq_m}
    for label, lo, hi in (("2016-17 low", "2016-10-01", "2017-03-31"), ("2019 trough", "2018-10-01", "2019-06-30"), ("2022-23 trough", "2022-06-30", "2023-06-30")):
        tr = peak(lo, hi, min); out["windows"][label] = {"price_trough": {"date": tr[0], "price": tr[1]} if tr else None, "at_price_trough": mon.get(tr[0]) if tr else None}
    out["today"] = mu["today"]
    # the premium to Korea, month by month
    prem = {}
    for peer in ("000660.KS", "005930.KS"):
        pm = {m["date"]: m for m in res[peer]["monthly"]}
        rows = []
        for d, m in mon.items():
            p = pm.get(d)
            if not p: continue
            rows.append({"date": d, **{k: (m[k] / p[k] - 1) * 100 if (m.get(k) and p.get(k)) else None for k in ("pe", "ev_sales", "ev_ebitda", "pb", "pe_fwd_realised")}})
        tp = res[peer]["today"]; tm = mu["today"]
        now = {k: (tm[k] / tp[k] - 1) * 100 if (tm.get(k) and tp.get(k)) else None for k in ("pe", "ev_sales", "ev_ebitda", "pb")}
        now["pe_fwd"] = (tm["pe_fwd"] / tp["pe_fwd"] - 1) * 100 if (tm.get("pe_fwd") and tp.get("pe_fwd")) else None
        summ = {}
        for k in ("pe", "ev_sales", "ev_ebitda", "pb"):
            s = [r[k] for r in rows if r[k] is not None]
            summ[k] = {"median": st.median(s) if s else None, "low": min(s) if s else None, "high": max(s) if s else None, "n": len(s), "today": now[k], "percentile": pctile(s, now[k])}
        summ["pe_fwd_today"] = now["pe_fwd"]
        prem[peer] = {"rows": rows, "summary": summ}
    out["premium_to"] = prem
    return out

def sector(res):
    keys = ("pe", "ev_sales", "ev_ebitda", "pb")
    rows = []
    for t, n in res.items():
        e = n["earnings"]; p = n["percentiles"]; td = n["today"]
        rows.append({"ticker": t, "pe": td.get("pe"), "pe_pct": p["pe"]["percentile"], "pe_median": p["pe"]["median"], "pe_fwd": td.get("pe_fwd"), "pe_fwd_vs_realised_pct": p["pe_fwd_vs_realised"]["percentile"],
                     "ev_sales": td.get("ev_sales"), "ev_sales_pct": p["ev_sales"]["percentile"], "ev_ebitda": td.get("ev_ebitda"), "ev_ebitda_pct": p["ev_ebitda"]["percentile"], "pb": td.get("pb"), "pb_pct": p["pb"]["percentile"],
                     "eps_vs_high_pct": e["eps_now_vs_high_pct"], "eps_vs_prior_cycle_high_x": div(e["eps_ttm_now"], e["eps_prior_cycle_high"][1]) if (e.get("eps_prior_cycle_high") and e["eps_prior_cycle_high"][1] > 0) else None,
                     "gm_now": e["gm_ttm_now"], "gm_prior_peak": e["gm_prior_cycle_high"][1] if e.get("gm_prior_cycle_high") else None, "ntm_eps_vs_ttm_x": e["ntm_eps_vs_ttm"],
                     "implied_vs_ntm_eps_pct": e["implied_vs_ntm_eps_pct"], "implied_vs_ttm_eps_pct": e["implied_vs_ttm_eps_pct"], "pe_at_prior_peak_gm": e.get("pe_at_prior_peak_gm"), "months": p["pe"]["n_months"]})
    def med(k):
        s = [r[k] for r in rows if r[k] is not None]; return st.median(s) if s else None
    return {"rows": rows, "medians": {k: med(k) for k in ("pe_pct", "ev_sales_pct", "ev_ebitda_pct", "pb_pct", "pe_fwd", "pe", "implied_vs_ntm_eps_pct", "ntm_eps_vs_ttm_x", "pe_at_prior_peak_gm")}}

def main():
    out = sys.argv[1]; res = {}
    for t in ORDER:
        p = os.path.join(out, "raw", t + ".json")
        if not os.path.exists(p): continue
        res[t] = build(t, json.load(open(p)))
        pc = res[t]["percentiles"]; e = res[t]["earnings"]
        print(f"{t:10s} px {res[t]['price_now']:>12,.2f} {res[t]['currency']}  P/E {pc['pe']['today'] and round(pc['pe']['today'],1)} (p{pc['pe']['percentile']}, med {pc['pe']['median'] and round(pc['pe']['median'],1)})  fwd {res[t]['today'].get('pe_fwd') and round(res[t]['today']['pe_fwd'],1)}  EV/S {round(pc['ev_sales']['today'],2)} (p{pc['ev_sales']['percentile']})  EV/EBITDA {pc['ev_ebitda']['today'] and round(pc['ev_ebitda']['today'],1)} (p{pc['ev_ebitda']['percentile']})  P/B {pc['pb']['today'] and round(pc['pb']['today'],2)} (p{pc['pb']['percentile']})  EPS vs high {e['eps_now_vs_high_pct'] and round(e['eps_now_vs_high_pct'])}%  months {pc['pe']['n_months']} corr {len(res[t]['corrections'])}")
    calls = json.load(open(os.path.join(out, "raw", "_calls.json")))
    doc = {"dispatch": "SCINTILLA-20261020-CW5", "written_utc": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "fetch_utc_first": calls["log"][0]["utc"], "fetch_utc_last": calls["log"][-1]["utc"], "fmp_calls": calls["calls"], "fmp_calls_by_status": calls["by_status"],
           "method": __doc__, "names": res, "micron_cycle": micron_cycle(res), "sector": sector(res)}
    json.dump(doc, open(os.path.join(out, "MEMORY-CYCLE.json"), "w"), indent=1, default=str)
    print("wrote MEMORY-CYCLE.json")

if __name__ == "__main__":
    main()
