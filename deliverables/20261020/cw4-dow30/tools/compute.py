#!/usr/bin/env python3
"""CW4 · from the raw FMP answers to every figure on the page. Deterministic: same raw, same JSON. The CW3 rules, plus
one rule for balance-sheet businesses and the steadiness block.

usage: python3 compute.py <peers.json> <deliverable dir> [today YYYY-MM-DD]

Rules (also printed on the page):
- ONE forward basis: next twelve months (NTM) = time-weighted blend of the two fiscal-year consensus rows that
  straddle the next 12 months (FMP analyst-estimates, annual). w = days left in FY1 / 365.25. NTM = w·FY1 + (1−w)·FY2.
  FY2 missing → FY1 alone, marked. No row → "no estimate"; a peer with no estimate goes in on trailing twelve
  months (TTM) with a T mark.
- Price and market cap: FMP quote on the fetch date. EV = market cap + total debt (incl. leases, FMP's totalDebt)
  − cash and short-term investments, latest quarterly balance sheet. All stated in USD at the fetch date's FX.
- Forward P/E = market cap ÷ NTM net income (so ADR ratios and share-count mismatches cannot bend it).
  PEG = forward P/E ÷ NTM net-income growth in % (growth = NTM ÷ TTM − 1; needs both > 0). EV/sales and EV/EBITDA
  on NTM. Gross margin TTM (consensus carries no gross profit). EBIT margin NTM (consensus EBIT ÷ consensus revenue).
  Net debt ÷ TTM EBITDA.
- Balance-sheet businesses (banks, brokers, insurers, card lenders: GS, JPM, AXP, TRV and their bank and insurer
  peers): EV, EV/sales, EV/EBITDA and net debt/EBITDA mean nothing and are not shown; they are priced on forward
  P/E, PEG and price/book (market cap ÷ latest total shareholders' equity), with return on equity (TTM net income ÷
  equity) and NTM net margin beside them; their revenue growth is consensus FY2 over FY1 (a bank's statement revenue
  is gross of interest expense, consensus is net, so NTM over TTM would not compare). Card networks and processors
  (V, MA, PayPal, Fiserv) are ordinary companies.
- Loss-maker: TTM net income ≤ 0 or NTM net income ≤ 0 (or no estimate). Priced on EV/sales (NTM) and EV/gross profit
  (TTM); EV/EBITDA kept only when NTM EBITDA > 0.
- "Not meaningful": P/E over 100× or under 4×, EV/sales or EV/EBITDA over 60×, EV/EBITDA under 3×, PEG over 10, EV/gross
  profit over 150×, P/B over 30× are printed struck and left out of the median; a row needs three meaningful peers to price. PEG is priced only
  where NTM net-income growth is 10–100% with three peers carrying one.
- Implied price per multiple = peer median × the name's own figure, net debt taken out for EV rows, divided by shares
  (market cap ÷ price). Midpoint = geometric middle of the lowest and highest implied price. Read: cheap when the
  price is more than 15% under the midpoint; rich when more than 15% over; fair between.
- Mismatch: where FMP's consensus does not fit its own statements (NTM revenue outside 0.4–2.5× TTM) the consensus is a
  unit or currency break (Embraer's was, on 20 Oct, so Howmet took its place); it is dropped and the name goes in on
  trailing, marked T, with the reason printed. Net income is not tested this way: a trailing year depressed by a charge
  (Merck's Verona write-off) makes a 6× recovery real, not a break; Samsung's 2.7× P/E is caught by the under-4× rule.
- Steadiness (the defensive block): NTM-EPS spread = (epsHigh − epsLow) ÷ epsAvg of the consensus rows, blended with
  the same w (the dispersion of the Street's next-twelve-month EPS; FMP carries no revision history through the
  proxy, so dispersion stands in for revision spread, and the page says so); 5-year revenue volatility = standard
  deviation of the five year-on-year revenue growth rates from the last six fiscal-year income statements. The ten
  steadiest = lowest sum of the two ranks across the 30.
"""
import json, os, sys, math, datetime as dt
from statistics import median, pstdev

def num(x):
    try:
        if x is None: return None
        v = float(x)
        if math.isnan(v) or math.isinf(v): return None
        return v
    except Exception:
        return None

def first(d, *keys):
    for k in keys:
        if isinstance(d, dict) and d.get(k) is not None: return d[k]
    return None

NM = {"pe": 100, "ev_sales": 60, "ev_ebitda": 60, "peg": 10, "ev_gp": 150, "pb": 30}   # above these a multiple is "not meaningful"
NM_LOW = {"pe": 4, "ev_ebitda": 3}   # and below these (a 2× P/E on a going concern is a data break, not a bargain)
COLS = ["pe", "ev_sales", "ev_ebitda", "peg", "pb", "rev_growth_ntm_pct", "gross_margin_ttm_pct", "ebit_margin_pct", "net_margin_pct", "roe_ttm_pct", "net_debt_ebitda", "ev_gp"]
PREM = ("pe", "ev_sales", "ev_ebitda", "peg", "pb", "ev_gp")

def main():
    peers = json.load(open(sys.argv[1])); D = sys.argv[2]
    today = dt.date.fromisoformat(sys.argv[3]) if len(sys.argv) > 3 else dt.date.today()
    FIN = set(peers["financial"])
    raw = {}
    for f in os.listdir(os.path.join(D, "raw")):
        if f.endswith(".json") and not f.startswith("_"):
            r = json.load(open(os.path.join(D, "raw", f))); raw[r["ticker"]] = r
    fxraw = json.load(open(os.path.join(D, "raw", "_fx.json")))
    calls = json.load(open(os.path.join(D, "raw", "_calls.json")))

    rates = {"USD": 1.0}
    for sym, row in fxraw["rates"].items():
        p = num(row.get("price"))
        if not p: continue
        if sym.startswith("USD"): rates[sym[3:]] = 1.0 / p
        elif sym.endswith("USD"): rates[sym[:3]] = p
    if "GBP" in rates: rates["GBp"] = rates["GBP"] / 100.0
    fx_date = fxraw["fetched_utc"]

    def ans(t, path):
        a = raw.get(t, {}).get("answers", {}).get(path)
        return a["data"] if a and a.get("status") == 200 else None

    companies = {}
    for t in peers["all"]:
        c = {"ticker": t, "issues": [], "financial": t in FIN}
        prof = (ans(t, "profile") or [{}])[0]
        q = ans(t, "quote") or {}
        c["name"] = prof.get("companyName") or q.get("name") or t
        c["industry"] = prof.get("industry"); c["sector"] = prof.get("sector"); c["exchange"] = prof.get("exchange")
        c["country"] = prof.get("country"); c["ipo_date"] = prof.get("ipoDate"); c["is_adr"] = bool(prof.get("isAdr"))
        c["description"] = (prof.get("description") or "")[:400]
        tccy = prof.get("currency") or "USD"; c["trading_ccy"] = tccy
        c["price"] = num(q.get("price")); c["quote_ts"] = q.get("timestamp")
        c["quote_utc"] = dt.datetime.utcfromtimestamp(q["timestamp"]).strftime("%Y-%m-%dT%H:%MZ") if q.get("timestamp") else None
        if not q: c["issues"].append("no quote on FMP")
        mcap_local = num(q.get("marketCap"))
        fxt = rates.get(tccy)
        if fxt is None: c["issues"].append(f"no FX for trading currency {tccy}"); fxt = None
        mcap_fx = rates.get("GBP") if tccy == "GBp" else fxt
        c["mcap_usd"] = mcap_local * mcap_fx if (mcap_local and mcap_fx) else None
        c["price_usd"] = c["price"] * fxt if (c["price"] and fxt) else None
        c["fx_to_usd"] = fxt; c["fx_date"] = fx_date if tccy != "USD" else None
        ttm = (ans(t, "income-statement-ttm") or [{}])[0]
        rccy = ttm.get("reportedCurrency") or tccy; c["reporting_ccy"] = rccy
        fxr = rates.get(rccy)
        if fxr is None: c["issues"].append(f"no FX for reporting currency {rccy}"); fxr = 0
        c["ttm_date"] = ttm.get("date")
        def usd(v): v = num(v); return v * fxr if v is not None else None
        c["ttm"] = {"revenue": usd(ttm.get("revenue")), "gross_profit": usd(ttm.get("grossProfit")), "ebit": usd(ttm.get("operatingIncome")),
                    "ebitda": usd(ttm.get("ebitda")), "net_income": usd(ttm.get("netIncome")), "eps_diluted": num(ttm.get("epsDiluted")),
                    "shares_diluted": num(ttm.get("weightedAverageShsOutDil"))}
        if c["ttm"]["revenue"] is None: c["issues"].append("no TTM income statement")
        bs = (ans(t, "balance-sheet-statement") or [{}])[0]
        c["bs_date"] = bs.get("date")
        cash = usd(first(bs, "cashAndShortTermInvestments"))
        if cash is None: cash = usd(bs.get("cashAndCashEquivalents"))
        debt = usd(bs.get("totalDebt"))
        if debt is None and bs: debt = (usd(bs.get("shortTermDebt")) or 0) + (usd(bs.get("longTermDebt")) or 0)
        c["cash_usd"] = cash; c["debt_usd"] = debt
        c["equity_usd"] = usd(first(bs, "totalStockholdersEquity", "totalEquity"))
        c["net_debt_usd"] = (debt or 0) - (cash or 0) if (bs and (cash is not None or debt is not None)) else None
        if not bs: c["issues"].append("no balance sheet")
        c["ev_usd"] = c["mcap_usd"] + c["net_debt_usd"] if (c["mcap_usd"] is not None and c["net_debt_usd"] is not None) else None
        km = (ans(t, "key-metrics-ttm") or [{}])[0]
        c["fmp_check"] = {"ev_ttm_local": num(km.get("enterpriseValueTTM")), "ev_to_sales_ttm": num(km.get("evToSalesTTM")), "ev_to_ebitda_ttm": num(km.get("evToEBITDATTM")), "net_debt_to_ebitda_ttm": num(km.get("netDebtToEBITDATTM")), "pb_ttm": num(km.get("pbRatioTTM"))} if km else None
        if c["price"] and c["ttm"]["shares_diluted"] and mcap_local:
            alt = c["price"] * c["ttm"]["shares_diluted"]
            ratio = mcap_local / alt if alt else None
            c["mcap_vs_price_x_shares"] = round(ratio, 2) if ratio else None
            if ratio and (ratio > 1.3 or ratio < 0.7) and not c["is_adr"] and rccy == tccy:
                c["issues"].append(f"market cap is {ratio:.2f}× price × diluted shares (FMP share count or quote mismatch)")
        # estimates → NTM
        est = ans(t, "analyst-estimates") or []
        rows = []
        for r in est:
            try: d = dt.date.fromisoformat(r["date"][:10])
            except Exception: continue
            rows.append((d, r))
        rows.sort(key=lambda x: x[0])
        fut = [(d, r) for d, r in rows if d > today]
        ntm = {"revenue": None, "ebitda": None, "ebit": None, "net_income": None, "eps": None, "eps_spread_pct": None, "basis": "no estimate", "fy1": None, "fy2": None, "w": None, "n_rev": None, "n_eps": None}
        if fut:
            d1, r1 = fut[0]; r2 = fut[1][1] if len(fut) > 1 else None
            w = min(1.0, max(0.0, (d1 - today).days / 365.25))
            def blend(k):
                a = num(r1.get(k)); b = num(r2.get(k)) if r2 else None
                if a in (None, 0): return None
                if b in (None, 0): return a * fxr
                return (w * a + (1 - w) * b) * fxr
            def spread(r):
                a, h, l = num(r.get("epsAvg")), num(r.get("epsHigh")), num(r.get("epsLow"))
                return (h - l) / abs(a) * 100 if (a and h is not None and l is not None) else None
            s1 = spread(r1); s2 = spread(r2) if r2 else None
            eps_spread = (w * s1 + (1 - w) * s2) if (s1 is not None and s2 is not None) else (s1 if s1 is not None else s2)
            ntm = {"revenue": blend("revenueAvg"), "ebitda": blend("ebitdaAvg"), "ebit": blend("ebitAvg"), "net_income": blend("netIncomeAvg"),
                   "eps": (lambda a, b: (w * a + (1 - w) * b) if (a and b) else (a or None))(num(r1.get("epsAvg")), num(r2.get("epsAvg")) if r2 else None),
                   "eps_spread_pct": eps_spread,
                   "basis": "NTM blend" if r2 else "FY1 only", "fy1": d1.isoformat(), "fy2": fut[1][0].isoformat() if r2 else None, "w": round(w, 3),
                   "n_rev": r1.get("numAnalystsRevenue"), "n_eps": r1.get("numAnalystsEps"),
                   "fy1_row": {k: r1.get(k) for k in ("date", "revenueAvg", "ebitdaAvg", "ebitAvg", "netIncomeAvg", "epsAvg", "epsLow", "epsHigh", "numAnalystsRevenue", "numAnalystsEps")},
                   "fy2_row": {k: r2.get(k) for k in ("date", "revenueAvg", "ebitdaAvg", "ebitAvg", "netIncomeAvg", "epsAvg", "epsLow", "epsHigh", "numAnalystsRevenue", "numAnalystsEps")} if r2 else None}
        else:
            c["issues"].append("no forward estimate on FMP")
        # unit or currency mismatch between FMP's consensus and its statements (seen on Samsung and Embraer): the consensus is
        # dropped and the peer goes in on trailing, marked T, with the reason printed
        Tr, Tn = c["ttm"]["revenue"], c["ttm"]["net_income"]
        rr = (ntm["revenue"] / Tr) if (ntm["revenue"] and Tr) else None
        rn = (ntm["net_income"] / Tn) if (ntm["net_income"] and Tn and Tn > 0 and ntm["net_income"] > 0) else None
        if rr is not None and not (0.4 <= rr <= 2.5):
            c["issues"].append(f"consensus does not fit the statements (NTM revenue {rr:.2f}× TTM): a unit or currency mismatch in FMP's answers; consensus dropped, trailing used (T)")
            c["ntm_dropped"] = ntm
            ntm = {"revenue": None, "ebitda": None, "ebit": None, "net_income": None, "eps": None, "eps_spread_pct": None, "basis": "no estimate (consensus dropped: mismatch)", "fy1": None, "fy2": None, "w": None, "n_rev": None, "n_eps": None}
        c["ntm"] = ntm
        KNOWN = {"HON": "TTM statements still carry Honeywell Aerospace (spun off 29 Jun 2026 as HONA); consensus rows are for the remaining company, so NTM-over-TTM growth and the TTM margins are not like-for-like",
                 "CVX": "TTM carries Hess from the July 2025 close, so trailing growth is acquisition-lifted",
                 }
        if t in KNOWN and t in peers["dow"]: c["issues"].append(KNOWN[t])
        # five fiscal years of revenue growth (Dow names only have the annual statements)
        inc = ans(t, "income-statement") or []
        ann = sorted([(r.get("date"), usd(r.get("revenue"))) for r in inc if r.get("date") and num(r.get("revenue"))], key=lambda x: x[0])
        gr = [(ann[i][0][:4], (ann[i][1] / ann[i - 1][1] - 1) * 100) for i in range(1, len(ann)) if ann[i - 1][1]]
        gr = gr[-5:]
        c["rev_growth_5y"] = [{"fy": y, "pct": g} for y, g in gr]
        c["rev_vol_5y_pct"] = pstdev([g for _, g in gr]) if len(gr) >= 4 else None
        # multiples
        m = {}; T = c["ttm"]; E = c["ev_usd"]; M = c["mcap_usd"]; fin = c["financial"]
        fwd = ntm["revenue"] is not None
        c["forward_basis"] = fwd
        ni_f = ntm["net_income"]; ni_t = T["net_income"]
        c["loss_maker"] = (ni_t is not None and ni_t <= 0) or (ni_f is not None and ni_f <= 0) or (ni_f is None and (ni_t is None or ni_t <= 0))
        m["pe"] = M / ni_f if (M and ni_f and ni_f > 0) else (M / ni_t if (M and not fwd and ni_t and ni_t > 0) else None)
        m["pe_basis"] = "NTM" if (ni_f and ni_f > 0) else ("TTM" if (not fwd and ni_t and ni_t > 0) else None)
        m["pe_ttm"] = M / ni_t if (M and ni_t and ni_t > 0) else None
        g = (ni_f / ni_t - 1) * 100 if (ni_f and ni_t and ni_f > 0 and ni_t > 0) else None
        m["ni_growth_ntm_pct"] = g
        m["peg"] = m["pe"] / g if (m["pe"] and m["pe_basis"] == "NTM" and g and g > 0) else None
        m["pb"] = M / c["equity_usd"] if (M and c["equity_usd"] and c["equity_usd"] > 0) else None
        m["roe_ttm_pct"] = ni_t / c["equity_usd"] * 100 if (ni_t is not None and c["equity_usd"] and c["equity_usd"] > 0) else None
        rev_b = ntm["revenue"] if fwd else T["revenue"]
        m["net_margin_pct"] = (ni_f / ntm["revenue"] * 100) if (fwd and ni_f is not None and ntm["revenue"]) else ((ni_t / T["revenue"] * 100) if (ni_t is not None and T["revenue"]) else None)
        m["net_margin_basis"] = "NTM" if (fwd and ni_f is not None) else "TTM"
        if fin:
            m["ev_sales"] = m["ev_ebitda"] = m["net_debt_ebitda"] = m["ev_gp"] = None
            m["ev_sales_basis"] = m["ev_ebitda_basis"] = "n/a (balance-sheet business)"
            m["ev_sales_ttm"] = m["ev_ebitda_ttm"] = None
        else:
            m["ev_sales"] = E / rev_b if (E is not None and rev_b and rev_b > 0) else None
            m["ev_sales_basis"] = "NTM" if fwd else "TTM"
            m["ev_sales_ttm"] = E / T["revenue"] if (E is not None and T["revenue"]) else None
            eb_b = ntm["ebitda"] if (fwd and ntm["ebitda"]) else (T["ebitda"] if not fwd else None)
            m["ev_ebitda"] = E / eb_b if (E is not None and eb_b and eb_b > 0) else None
            m["ev_ebitda_basis"] = "NTM" if (fwd and ntm["ebitda"]) else ("TTM" if not fwd else None)
            m["ev_ebitda_ttm"] = E / T["ebitda"] if (E is not None and T["ebitda"] and T["ebitda"] > 0) else None
            m["ev_gp"] = E / T["gross_profit"] if (E is not None and T["gross_profit"] and T["gross_profit"] > 0) else None
            m["net_debt_ebitda"] = c["net_debt_usd"] / T["ebitda"] if (c["net_debt_usd"] is not None and T["ebitda"] and T["ebitda"] > 0) else None
        if fin and fwd and ntm.get("fy1_row") and ntm.get("fy2_row") and num(ntm["fy1_row"].get("revenueAvg")) and num(ntm["fy2_row"].get("revenueAvg")):
            m["rev_growth_ntm_pct"] = (num(ntm["fy2_row"]["revenueAvg"]) / num(ntm["fy1_row"]["revenueAvg"]) - 1) * 100   # FY2 over FY1, both consensus (net revenue)
            m["rev_growth_basis"] = "FY2/FY1 consensus"
        else:
            m["rev_growth_ntm_pct"] = (ntm["revenue"] / T["revenue"] - 1) * 100 if (fwd and T["revenue"] and not fin) else None
            m["rev_growth_basis"] = "NTM/TTM" if m["rev_growth_ntm_pct"] is not None else None
        m["gross_margin_ttm_pct"] = T["gross_profit"] / T["revenue"] * 100 if (T["gross_profit"] is not None and T["revenue"] and not fin) else None
        m["ebit_margin_pct"] = ntm["ebit"] / ntm["revenue"] * 100 if (fwd and ntm["ebit"] is not None and ntm["revenue"]) else (T["ebit"] / T["revenue"] * 100 if (T["ebit"] is not None and T["revenue"]) else None)
        m["ebit_margin_basis"] = "NTM" if (fwd and ntm["ebit"] is not None) else "TTM"
        m["ebit_margin_ttm_pct"] = T["ebit"] / T["revenue"] * 100 if (T["ebit"] is not None and T["revenue"]) else None
        c["m"] = m
        companies[t] = c

    def meaningful(k, v): return v is not None and (k not in NM or v <= NM[k]) and (k not in NM_LOW or v >= NM_LOW[k])
    names = {}
    for t in peers["dow"]:
        c = companies[t]; ps = peers["peers"][t]
        rows = [{"ticker": p["peer"], "why": p["why"], **{k: companies[p["peer"]].get(k) for k in ("name", "price", "trading_ccy", "mcap_usd", "ev_usd", "equity_usd", "forward_basis", "fx_date", "issues", "loss_maker", "financial")}, "m": companies[p["peer"]]["m"]} for p in ps]
        med = {}; cnt = {}
        for k in COLS:
            vals = [r["m"][k] for r in rows if meaningful(k, r["m"].get(k))]
            med[k] = median(vals) if len(vals) >= (3 if k in NM else 1) else None; cnt[k] = len(vals)
            for r in rows: r.setdefault("nm", {})[k] = (r["m"].get(k) is not None and not meaningful(k, r["m"].get(k)))
        prem = {k: (c["m"][k] / med[k] - 1) * 100 if (c["m"].get(k) is not None and med[k]) else None for k in PREM}
        shares = c["mcap_usd"] / c["price_usd"] if (c["mcap_usd"] and c["price_usd"]) else None
        nd = c["net_debt_usd"] or 0; N = c["ntm"]; T = c["ttm"]
        imp = {}; peg_note = None
        def eq_to_px(eq): return eq / shares if (shares and eq is not None and eq > 0) else None
        g = c["m"]["ni_growth_ntm_pct"]
        def peg_row():
            nonlocal peg_note
            if med["peg"] and g and 10 <= g <= 100 and cnt["peg"] >= 3 and N["net_income"]: imp["peg"] = {"label": "PEG", "median": med["peg"], "n": cnt["peg"], "price": eq_to_px(med["peg"] * g * N["net_income"])}
            elif g is not None: peg_note = f"PEG not priced: NTM net-income growth {g:.0f}% is outside the 10–100% band where a PEG means anything" + ("" if cnt["peg"] >= 3 else f" (and only {cnt['peg']} peers carry one)")
            else: peg_note = "PEG not priced: no positive net-income growth to divide by"
        if c["financial"]:
            if med["pe"] and N["net_income"]: imp["pe"] = {"label": "Fwd P/E", "median": med["pe"], "n": cnt["pe"], "price": eq_to_px(med["pe"] * N["net_income"])}
            peg_row()
            if med["pb"] and c["equity_usd"]: imp["pb"] = {"label": "Price/book", "median": med["pb"], "n": cnt["pb"], "price": eq_to_px(med["pb"] * c["equity_usd"])}
        elif not c["loss_maker"]:
            if med["pe"] and N["net_income"]: imp["pe"] = {"label": "Fwd P/E", "median": med["pe"], "n": cnt["pe"], "price": eq_to_px(med["pe"] * N["net_income"])}
            if med["ev_sales"] and N["revenue"]: imp["ev_sales"] = {"label": "EV/sales NTM", "median": med["ev_sales"], "n": cnt["ev_sales"], "price": eq_to_px(med["ev_sales"] * N["revenue"] - nd)}
            if med["ev_ebitda"] and N["ebitda"] and N["ebitda"] > 0: imp["ev_ebitda"] = {"label": "EV/EBITDA NTM", "median": med["ev_ebitda"], "n": cnt["ev_ebitda"], "price": eq_to_px(med["ev_ebitda"] * N["ebitda"] - nd)}
            peg_row()
        else:
            if med["ev_sales"] and N["revenue"]: imp["ev_sales"] = {"label": "EV/sales NTM", "median": med["ev_sales"], "n": cnt["ev_sales"], "price": eq_to_px(med["ev_sales"] * N["revenue"] - nd)}
            elif med["ev_sales"] and T["revenue"]: imp["ev_sales"] = {"label": "EV/sales (TTM, no estimate)", "median": med["ev_sales"], "n": cnt["ev_sales"], "price": eq_to_px(med["ev_sales"] * T["revenue"] - nd)}
            if med["ev_gp"] and T["gross_profit"] and T["gross_profit"] > 0: imp["ev_gp"] = {"label": "EV/gross profit TTM", "median": med["ev_gp"], "n": cnt["ev_gp"], "price": eq_to_px(med["ev_gp"] * T["gross_profit"] - nd)}
            if med["ev_ebitda"] and N["ebitda"] and N["ebitda"] > 0: imp["ev_ebitda"] = {"label": "EV/EBITDA NTM", "median": med["ev_ebitda"], "n": cnt["ev_ebitda"], "price": eq_to_px(med["ev_ebitda"] * N["ebitda"] - nd)}
        imp = {k: v for k, v in imp.items() if v["price"]}
        pxs = [v["price"] for v in imp.values()]
        mid = math.sqrt(min(pxs) * max(pxs)) if pxs else None
        dist = (c["price"] / mid - 1) * 100 if (mid and c["price"]) else None
        read = None if dist is None else ("cheap" if dist <= -15 else ("rich" if dist >= 15 else "fair"))
        ptc = (ans(t, "price-target-consensus") or [{}])[0]; pts = (ans(t, "price-target-summary") or [{}])[0]
        gr = (ans(t, "grades-consensus") or [{}])[0]; sf = (ans(t, "shares-float") or [{}])[0]
        analysts = {"low": num(ptc.get("targetLow")), "median": num(ptc.get("targetMedian")), "high": num(ptc.get("targetHigh")), "consensus": num(ptc.get("targetConsensus")),
                    "last_quarter_n": pts.get("lastQuarterCount"), "last_quarter_avg": num(pts.get("lastQuarterAvgPriceTarget")), "last_year_n": pts.get("lastYearCount"),
                    "grades": {k: gr.get(k) for k in ("strongBuy", "buy", "hold", "sell", "strongSell", "consensus")}}
        pp = None
        if c["loss_maker"]:
            cf = ans(t, "cash-flow-statement") or []
            fcf = [num(r.get("freeCashFlow")) for r in cf[:4]]
            fcf_sum = sum(v for v in fcf if v is not None) * (companies[t]["fx_to_usd"] or 1) if fcf else None
            burn_q = -fcf_sum / len([v for v in fcf if v is not None]) if (fcf_sum is not None and fcf_sum < 0) else None
            latest = fcf[0] * (companies[t]["fx_to_usd"] or 1) if fcf and fcf[0] is not None else None
            burn_latest = -latest if (latest is not None and latest < 0) else None
            pp = {"cash_usd": c["cash_usd"], "debt_usd": c["debt_usd"], "fcf_4q_usd": fcf_sum, "quarters_on_file": len([v for v in fcf if v is not None]), "fcf_quarters": [{"date": r.get("date"), "cfo": num(r.get("operatingCashFlow")), "capex": num(r.get("capitalExpenditure")), "fcf": num(r.get("freeCashFlow"))} for r in cf[:4]],
                  "burn_per_quarter_usd": burn_q, "runway_quarters": (c["cash_usd"] / burn_q) if (burn_q and c["cash_usd"]) else None,
                  "burn_latest_quarter_usd": burn_latest, "runway_quarters_latest_basis": (c["cash_usd"] / burn_latest) if (burn_latest and c["cash_usd"]) else None,
                  "not_burning": fcf_sum is not None and fcf_sum >= 0, "ipo_date": c.get("ipo_date"), "lockup_end": None,
                  "float_pct": num(sf.get("freeFloat")), "float_shares": num(sf.get("floatShares")), "shares_out": num(sf.get("outstandingShares"))}
        fmp_peers = [r.get("symbol") for r in (ans(t, "stock-peers") or [])]
        names[t] = {"ticker": t, "business": peers["business"][t], "company": {k: v for k, v in c.items() if k != "description"}, "peers": rows, "median": med, "n": cnt, "premium_pct": prem,
                    "implied": imp, "peg_note": peg_note, "midpoint": mid, "distance_pct": dist, "read": read, "analysts": analysts, "pre_profit": pp, "fmp_peers": fmp_peers,
                    "peer_median_growth": med["rev_growth_ntm_pct"], "peer_median_ebit_margin": med["ebit_margin_pct"], "peer_median_net_margin": med["net_margin_pct"]}

    ranked = sorted([n for n in names.values() if n["distance_pct"] is not None], key=lambda n: n["distance_pct"])
    summary = [{"ticker": n["ticker"], "price": n["company"]["price"], "midpoint": n["midpoint"], "distance_pct": n["distance_pct"], "analyst_median": n["analysts"]["median"],
                "growth": n["company"]["m"]["rev_growth_ntm_pct"], "peer_growth": n["peer_median_growth"],
                "ebit_margin": n["company"]["m"]["ebit_margin_pct"] if not n["company"]["financial"] else n["company"]["m"]["net_margin_pct"],
                "peer_ebit_margin": n["peer_median_ebit_margin"] if not n["company"]["financial"] else n["peer_median_net_margin"], "margin_label": "EBIT margin" if not n["company"]["financial"] else "net margin",
                "read": n["read"], "loss_maker": n["company"]["loss_maker"], "financial": n["company"]["financial"], "rows": list(n["implied"].keys())} for n in ranked]
    closer = [s for s in summary if s["read"] == "cheap" and s["growth"] is not None and s["peer_growth"] is not None and s["growth"] > s["peer_growth"]][:5]
    richest = list(reversed(summary))[:5]
    unranked = [t for t in peers["dow"] if names[t]["distance_pct"] is None]
    # steadiness block
    st = []
    for t in peers["dow"]:
        c = companies[t]
        st.append({"ticker": t, "eps_spread_pct": c["ntm"]["eps_spread_pct"], "n_eps": c["ntm"]["n_eps"], "rev_vol_5y_pct": c["rev_vol_5y_pct"], "rev_growth_5y": c["rev_growth_5y"],
                   "rev_growth_ntm_pct": c["m"]["rev_growth_ntm_pct"], "ebit_margin_pct": c["m"]["ebit_margin_pct"], "read": names[t]["read"], "distance_pct": names[t]["distance_pct"], "price": c["price"], "pe": c["m"]["pe"]})
    have = [s for s in st if s["eps_spread_pct"] is not None and s["rev_vol_5y_pct"] is not None]
    for key in ("eps_spread_pct", "rev_vol_5y_pct"):
        for i, s in enumerate(sorted(have, key=lambda s: s[key])): s["rank_" + key] = i + 1
    for s in have: s["rank_sum"] = s["rank_eps_spread_pct"] + s["rank_rev_vol_5y_pct"]
    have.sort(key=lambda s: (s["rank_sum"], s["eps_spread_pct"]))
    steadiest = have[:10]; st_unranked = [s["ticker"] for s in st if s not in have]
    out = {"what": "CW4 · comps of the 30 Dow Jones Industrial Average names against peers chosen by business; every figure from FMP through the project's fmp-proxy door on the fetch date",
           "built_utc": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"), "today": today.isoformat(), "fetch_utc_first": calls["log"][0]["utc"] if calls["log"] else None,
           "fetch_utc_last": calls["log"][-1]["utc"] if calls["log"] else None, "fmp_calls": calls["calls"], "fmp_calls_by_status": calls["by_status"], "fx": {"date": fx_date, "rates_to_usd": rates, "quotes": fxraw["rates"]},
           "rules": __doc__, "dow_list": {"tickers": peers["dow"], "taken": peers["list_taken"], "source": peers["list_source"], "changes_2026": peers["changes_2026"]},
           "summary": summary, "closer_look": closer, "richest": richest, "unranked": unranked, "steadiest": steadiest, "steadiness_all": sorted(have, key=lambda s: s["rank_sum"]) , "steadiness_unranked": st_unranked,
           "names": names, "companies": companies, "raw": {t: raw[t]["answers"] for t in peers["all"] if t in raw}}
    json.dump(out, open(os.path.join(D, "COMPS-DOW30.json"), "w"), indent=1, default=str)
    for s in summary:
        print(f"{s['ticker']:6} {s['read'] or '-':5} px {s['price']:>9.2f} mid {s['midpoint']:>9.2f} dist {s['distance_pct']:>7.1f}%  tgt {s['analyst_median']}  g {s['growth'] and round(s['growth'],1)} vs {s['peer_growth'] and round(s['peer_growth'],1)}  rows {s['rows']}{'  LOSS' if s['loss_maker'] else ''}{'  FIN' if s['financial'] else ''}")
    print("unranked:", unranked)
    print("steadiest:", [(s["ticker"], round(s["eps_spread_pct"], 1), round(s["rev_vol_5y_pct"], 1), s["rank_sum"]) for s in steadiest], "unranked:", st_unranked)
    for t, c in companies.items():
        if c["issues"]: print("ISSUE", t, c["issues"])

if __name__ == "__main__":
    main()
