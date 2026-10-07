# PP1 · assembled: every company's readings, the pre-profit shelf scored and ranked, and the knockout's round 2 run again
# with the debt reading in. Reads what the other steps left in the scratch folder (README.md) and writes
# data/pre-profit.json beside the page. The rules are in model.py; this file only reads, joins and counts.
# No network, no key, no table write.   Run from the scratch folder:   python3 <this file>
import json, os, sys, math, datetime as dt, collections
HERE = os.path.dirname(os.path.abspath(__file__)); WT = os.path.abspath(os.path.join(HERE, "../../../..")); sys.path.insert(0, HERE)
import model as M
sys.path.insert(0, os.path.join(WT, "deliverables/20261007/knockout/tools")); import rounds as R       # the knockout's own rules, unchanged
TODAY = os.environ.get("PP1_TODAY", "2026-10-06"); OUT = os.path.join(HERE, "..", "data", "pre-profit.json")
P = lambda s: dt.date.fromisoformat(str(s)[:10]); days = lambda a, b: (P(b) - P(a)).days
r1 = lambda v: None if v is None or not math.isfinite(v) else round(float(v), 1)
r2 = lambda v: None if v is None or not math.isfinite(v) else round(float(v), 2)
r3 = lambda v: None if v is None or not math.isfinite(v) else round(float(v), 3)
ri = lambda v: None if v is None or not math.isfinite(v) else int(round(float(v)))
L = lambda n: json.load(open(f"snap/{n}.json"))
F = json.load(open("fmp-statements.json"))["names"]
CU = json.load(open("comps-universe.json")); C = CU["names"]
KFU = json.load(open("fundamentals.json"))["names"]
K = json.load(open(os.environ.get("PP1_KNOCKOUT", os.path.join(WT, "deliverables/20261007/knockout/data/knockout.json")))); KN = K["names"]; BR = K["branches"]
RAW = json.load(open("quotes-all-raw.json"))["quotes"]
PROF = {r["ticker"]: r for r in L("company_profile")}; FUND = {r["ticker"]: r for r in L("fundamentals")}
FX = {"USD": 1.0}
for r in L("fx_rates"):
    if r["pair"].endswith("USD"): FX[r["pair"][:3]] = r["rate"]                                   # rows are oldest first: the last one read is the newest
FX_DATE = max(r["date"] for r in L("fx_rates"))
COVER_TEXT = json.load(open("sec/cover-text.json")) if os.path.exists("sec/cover-text.json") else {}
ANNOUNCED = json.load(open(os.path.join(HERE, "..", "data", "capex-announced.json")))["names"] if os.path.exists(os.path.join(HERE, "..", "data", "capex-announced.json")) else {}
def sec(t):
    p = f"sec/{t}.json"
    return json.load(open(p)) if os.path.exists(p) else {}
def tab(n, k):
    c = n[k]["cols"]; return sorted([dict(zip(c, r)) for r in n[k]["rows"]], key=lambda r: r["date"], reverse=True)
MONEY = {"income": ("revenue", "gross_profit", "operating_income", "ebitda", "ebit", "dep_amort", "interest_expense", "interest_income", "net_income"),
         "balance": ("cash", "sti", "cash_sti", "short_debt", "long_debt", "leases", "leases_current", "leases_noncurrent", "total_debt", "net_debt", "deferred_revenue", "deferred_revenue_nc", "preferred", "minority", "ppe_net"),
         "cashflow": ("operating_cf", "capex", "ppe_spend", "acquisitions", "net_debt_issued", "net_stock_issued", "net_common_issued", "common_issued", "common_bought", "net_preferred_issued", "other_financing", "stock_comp", "dep_amort", "free_cf", "interest_paid"),
         "estimates": ("revenue_low", "revenue_high", "revenue_avg", "ebitda_avg", "eps_avg", "eps_low", "eps_high")}
def usd(rows, kind, fx):
    if fx == 1.0: return rows
    for r in rows:
        for k in MONEY[kind]:
            if r.get(k) is not None: r[k] = r[k] * fx
    return rows
def newest(sfacts, name, since=None, how="max"):
    """The newest reported value of one group of tags: {val, end, form, filed, tag} or None. Several values on the newest date
    (a company with share classes reports one each) are added for `sum`, the largest taken for `max`."""
    best = None
    for tag, rows in (sfacts.get(name) or {}).items():
        if not rows: continue
        e0 = rows[0]["end"]
        if since and e0 < since: continue
        same = [r for r in rows if r["end"] == e0]; f0 = max(r["filed"] for r in same); vals = sorted({r["val"] for r in same if r["filed"] == f0 and r["val"] is not None})
        if not vals: continue
        v = sum(vals) if how == "sum" else max(vals)
        cand = {"val": v, "end": e0, "form": same[0]["form"], "filed": f0, "tag": tag.split(":")[1], "n": len(vals)}
        if best is None or cand["end"] > best["end"] or (cand["end"] == best["end"] and cand["val"] > best["val"]): best = cand
    return best
def fiscal_years(inc):
    """Completed fiscal years from the quarter rows: [{fy, end, revenue, operating_income}] newest first (a year needs its four quarters)."""
    by = collections.defaultdict(list)
    for r in inc:
        if r.get("fy") is not None and r.get("period") in ("Q1", "Q2", "Q3", "Q4"): by[r["fy"]].append(r)
    out = []
    for fy, rows in by.items():
        if {r["period"] for r in rows} != {"Q1", "Q2", "Q3", "Q4"} or len(rows) != 4: continue
        end = max(r["date"] for r in rows)
        sm = lambda k: None if any(r.get(k) is None for r in rows) else sum(r[k] for r in rows)
        out.append({"fy": fy, "end": end, "revenue": sm("revenue"), "operating_income": sm("operating_income"), "net_income": sm("net_income")})
    return sorted(out, key=lambda y: y["end"], reverse=True)
def month(s): return P(s).strftime("%b %Y")
def reading(t):
    """Everything the model measures for one company, in dollars. None when there is no quarter on file."""
    n = F.get(t)
    if not n or not n["income"]["rows"]: return None
    inc, bal, cf, est = tab(n, "income"), tab(n, "balance"), tab(n, "cashflow"), sorted(tab(n, "estimates"), key=lambda r: r["date"])
    ccy = inc[0].get("ccy") or "USD"; fx = FX.get(ccy)
    if fx is None: return {"t": t, "why": f"reports in {ccy}: no exchange rate on file"}
    usd(inc, "income", fx); usd(bal, "balance", fx); usd(cf, "cashflow", fx); usd(est, "estimates", fx)
    c = C.get(t) or {}; a = c.get("after") or {}; q = RAW.get(t) or {}; prof = PROF.get(t) or {}
    price = a.get("price") or (q.get("today_session_close") if q.get("today_session_et") == TODAY else None)
    o = {"t": t, "name": c.get("name") or prof.get("name"), "family": c.get("family"), "line": c.get("line"), "price": price, "currency": ccy, "fx": None if fx == 1.0 else r3(fx), "quarter_end": inc[0]["date"], "filed": inc[0].get("filed"), "quarters_on_file": len(inc)}
    # ---- who it is: the profit record
    FY = fiscal_years(inc); before = [y["operating_income"] for y in FY if len(inc) > 4 and y["end"] <= inc[4]["date"]]
    venture = bool((KFU.get(t) or {}).get("venture"))
    o["oi4"] = M.total4(inc, "operating_income"); o["ni4"] = M.total4(inc, "net_income")
    # ---- sales, on one calendar window
    fy0 = FY[0] if FY else None; sales = {"booked": M.total4(inc, "revenue"), "booked_to": inc[0]["date"], "years": []}
    k0 = (KFU.get(t) or {}).get("fy0")                                           # a new listing has too few quarters on file to add up a fiscal year: the Hub's own annual row then
    if (not fy0 or (k0 and k0.get("date") and k0["date"] > fy0["end"])) and k0 and k0.get("revenue") is not None: fy0 = {"fy": None, "end": k0["date"], "revenue": k0["revenue"] * (1.0 if (KFU[t].get("currency") or "USD") == "USD" else fx), "operating_income": None, "from": "the Hub's annual row"}
    fut = [e for e in est if fy0 and days(fy0["end"], e["date"]) > 60]
    e1 = fut[0] if fut else None
    o["venture"] = venture; o["eps_this_year"] = None if e1 is None else e1.get("eps_avg"); o["_classify"] = (inc, before)
    if fy0 and e1 and 300 <= days(fy0["end"], e1["date"]) <= 430 and len(fut) >= 2:
        e2 = fut[1]; e3 = fut[2] if len(fut) > 2 else None
        w = max(0.0, min(1.0, days(TODAY, e1["date"]) / 365.25)); g = lambda e, k: None if e is None else e.get(k)
        unit_ok = fx == 1.0 or (fy0["revenue"] and g(e1, "revenue_avg") and 0.3 <= g(e1, "revenue_avg") / fy0["revenue"] <= 8)
        if unit_ok:
            Lr, N1, N2 = M.calendarize(fy0["revenue"], g(e1, "revenue_avg"), g(e2, "revenue_avg"), g(e3, "revenue_avg"), w)
            _, lo1, _ = M.calendarize(None, g(e1, "revenue_low"), g(e2, "revenue_low"), None, w); _, hi1, _ = M.calendarize(None, g(e1, "revenue_high"), g(e2, "revenue_high"), None, w)
            _, na, _ = M.calendarize(None, g(e1, "n_rev"), g(e2, "n_rev"), None, w)
            sales.update({"w": round(w, 6), "fy0_end": fy0["end"], "last": Lr, "next": N1, "after": N2, "next_low": lo1, "next_high": hi1, "g1": M.growth(N1, Lr), "g2": M.growth(N2, N1), "added": None if N1 is None or Lr is None else N1 - Lr,
                          "window": f"the twelve months to {month((P(TODAY) + dt.timedelta(days=365)).isoformat())}", "analysts": None if na is None else int(round(na))})
            # the EPS range, the two years blended the same way, in dollars a share
            _, el, _ = M.calendarize(None, g(e1, "eps_low"), g(e2, "eps_low"), None, w); _, eh, _ = M.calendarize(None, g(e1, "eps_high"), g(e2, "eps_high"), None, w)
            sales["eps_range_next"] = None if el is None or eh is None else eh - el
        else: sales["why"] = f"reports in {ccy}: the analysts' figures and the filed figures are not on the same footing"
        sales["years"] = [{"end": y["end"], "kind": "reported", "avg": y["revenue"]} for y in FY[:1]] + [
            {"end": e["date"], "kind": "estimate", "avg": e.get("revenue_avg"), "low": e.get("revenue_low"), "high": e.get("revenue_high"), "n": e.get("n_rev"), "eps": e.get("eps_avg"), "eps_low": e.get("eps_low"), "eps_high": e.get("eps_high"), "n_eps": e.get("n_eps"),
             "spread_sales": r1(M.spread(e.get("revenue_high"), e.get("revenue_low"), e.get("revenue_avg"))), "spread_eps": r1(M.spread(e.get("eps_high"), e.get("eps_low"), e.get("eps_avg")))} for e in fut[:3]]
        if len(sales["years"]) > 1 and sales["years"][0]["avg"] and sales["years"][1]["avg"]:
            for i in range(1, len(sales["years"])):
                p0 = sales["years"][i - 1]["avg"]; sales["years"][i]["growth"] = r1(M.growth(sales["years"][i]["avg"], p0))
    else: sales["why"] = "no reported fiscal year on file" if not fy0 else "fewer than two forward estimate years on file" if len(fut) < 2 else f"the first estimate year ({e1['date']}) does not follow the last reported year ({fy0['end']})"
    o["sales"] = sales
    cl = M.classify(inc, before, venture, o["eps_this_year"], sales.get("g1")); o["tier"] = cl["tier"]; o["tier_words"] = cl["words"]; o["why_not"] = cl["why_not"]; del o["_classify"]
    # ---- the share count and the value of the company
    b = bal[0] if bal else {}; sf = sec(t)
    tg = newest(sf, "cover_shares", how="sum"); tx = COVER_TEXT.get(t) or {}
    pick = M.shares_pick({"total": tg["val"], "as_of": tg["end"], "n_classes": tg["n"]} if tg else None, {"total": tx.get("total"), "as_of": tx.get("as_of"), "n_classes": len(tx.get("classes") or [])} if tx.get("total") else None, inc[0].get("shares"), inc[0]["date"], a.get("shares"))
    vendor_mv = a.get("mcap") or ((FUND.get(t) or {}).get("market_cap"))
    adr = bool(prof.get("is_adr")) or fx != 1.0
    if adr: mv = vendor_mv; pick = {**pick, "shares": None, "source": "the vendor's market value (a foreign listing: its share units are not checked here)"}
    elif not pick["shares"] or not price: mv = vendor_mv; pick = {**pick, "source": pick["source"] or "the vendor's market value (no share count on file)"}
    else: mv = pick["shares"] * price
    o["shares"] = {"count": pick["shares"], "source": pick["source"], "as_of": pick["as_of"], "classes": pick.get("classes"), "quote": tx.get("quote") if pick["source"] == "cover" and tx.get("total") and pick["as_of"] == tx.get("as_of") else None,
                   "quarter_average": inc[0].get("shares"), "vendor_implied": a.get("shares"), "profile": prof.get("shares_out")}
    o["market_value"] = mv; o["vendor_market_value"] = vendor_mv; o["value_gap_pct"] = r1((vendor_mv / mv - 1) * 100) if (mv and vendor_mv) else None
    cash_sti = b.get("cash_sti") if b.get("cash_sti") is not None else (None if b.get("cash") is None else b["cash"] + (b.get("sti") or 0.0))
    o["cash"] = {"cash": b.get("cash"), "sti": b.get("sti"), "cash_sti": cash_sti, "as_of": b.get("date")}
    debt_total = b.get("total_debt"); net_debt = None if debt_total is None or cash_sti is None else debt_total - cash_sti
    ev = None if mv is None or net_debt is None else mv + net_debt + (b.get("preferred") or 0.0) + (b.get("minority") or 0.0)
    o["ev"] = ev; o["ev_sales"] = None if not ev or not sales.get("next") or ev <= 0 else ev / sales["next"]
    o["ev_sales_booked"] = None if not ev or not sales.get("booked") or ev <= 0 or sales["booked"] <= 0 else ev / sales["booked"]
    # ---- gross margin, quarter by quarter (oldest first for the picture)
    gmq = [{"end": r["date"], "gm": r1(r["gross_profit"] / r["revenue"] * 100) if r.get("revenue") and r["revenue"] > 0 and r.get("gross_profit") is not None else None} for r in inc[:8]][::-1]
    gp4, rv4, gp4b, rv4b = M.total4(inc, "gross_profit"), M.total4(inc, "revenue"), M.total4(inc, "gross_profit", 4), M.total4(inc, "revenue", 4)
    ok = lambda rv: rv is not None and rv >= M.MARGIN_MIN_SALES                          # under $25M of sales a margin is noise (figures are already in dollars)
    gm = None if not ok(rv4) or gp4 is None else gp4 / rv4 * 100; gmb = None if not ok(rv4b) or gp4b is None else gp4b / rv4b * 100
    o["margin"] = {"quarters": gmq if ok(rv4) else [], "now": gm, "year_ago": gmb, "change": None if gm is None or gmb is None else gm - gmb, "why": None if ok(rv4) else "sales under $25M over four quarters: too small to read a margin"}
    # ---- cash going out, the quarters it lasts
    fcf = [None if r.get("operating_cf") is None else r["operating_cf"] - abs(r.get("capex") or 0.0) for r in cf[:4]]
    run = M.runway(cash_sti, fcf); o["burn"] = {**run, "fcf_quarters": fcf, "to": cf[0]["date"] if cf else None}
    # ---- the build-out and who paid for it
    cap4 = None if len(cf) < 4 else sum(abs(r.get("capex") or 0.0) for r in cf[:4]); cap_last = abs(cf[0].get("capex") or 0.0) if cf else None
    ocf4 = M.total4(cf, "operating_cf"); sm4 = lambda k: None if len(cf) < 4 else sum((r.get(k) or 0.0) for r in cf[:4])
    pace = None if cap4 is None else max(cap4, 4 * cap_last); ann = ANNOUNCED.get(t)
    plan = pace; basis = None if pace is None else ("the last quarter's pace, four times over" if 4 * cap_last >= cap4 else "the last four quarters as they were")
    if ann and ann.get("use") and ann.get("amount"): plan = ann["amount"]; basis = "announced by the company"
    gap = M.funding_gap(plan, b.get("short_debt"), ocf4, cash_sti, mv)
    uses = None if cap4 is None else cap4 + max(0.0, -(ocf4 or 0.0))
    mix = M.financing_mix(uses, ocf4, sm4("net_debt_issued"), (sm4("net_stock_issued") or 0.0), sm4("other_financing")) if uses and uses > 0 else None
    leases_now = b.get("leases"); leases_then = bal[4].get("leases") if len(bal) > 4 else None
    o["capex"] = {"year": cap4, "last_quarter": cap_last, "plan": plan, "plan_basis": basis, "announced": ann, "operating_cf_year": ocf4, "of_sales": None if not cap4 or not rv4 or rv4 <= 0 else cap4 / rv4 * 100,
                  "mix": mix, "debt_issued": sm4("net_debt_issued"), "shares_issued": sm4("net_stock_issued"), "other_financing": sm4("other_financing"), "leases_now": leases_now, "leases_added": None if leases_now is None or leases_then is None else leases_now - leases_then}
    o["gap"] = {**gap, "debt_due": b.get("short_debt")}
    # ---- dilution
    sh = [r.get("shares") for r in inc]; ipo = prof.get("ipo_date")
    def back(k, yrs):
        if len(inc) <= k or not sh[0] or not sh[k]: return None, "no quarter that far back on file"
        if not (yrs * 365 - 25 <= days(inc[k]["date"], inc[0]["date"]) <= yrs * 365 + 25): return None, "the quarters on file do not line up a year apart"
        if ipo and str(ipo)[:10] > str(inc[k]["date"]): return None, f"listed {month(ipo)}: the window would cross its listing"
        if adr: return None, "a foreign listing: the vendor's share units change between filings"
        return M.share_change(sh[0], sh[k] * M.split_factor(sh[k::-1])), None                    # a split in between is not dilution
    c1, w1 = back(4, 1); c2, w2 = back(8, 2)
    since = (P(inc[0]["date"]) - dt.timedelta(days=460)).isoformat()
    oh = newest(sf, "left_out_of_diluted", since); cv = None
    tot = [newest({"x": {k: v}}, "x", since) for k, v in (sf.get("convertible") or {}).items()]
    tot = {x["tag"]: x for x in tot if x}
    if tot:
        whole = [tot[k] for k in ("ConvertibleNotesPayable", "ConvertibleDebt") if k in tot]
        if whole: cv = max(whole, key=lambda x: (x["end"], x["val"]))
        else:
            e0 = max(x["end"] for x in tot.values()); parts = [x for x in tot.values() if x["end"] == e0]
            cv = {"val": sum(x["val"] for x in parts), "end": e0, "form": parts[0]["form"], "filed": parts[0]["filed"], "tag": " + ".join(x["tag"] for x in parts)}
    raised = 0.0; raised_years = []
    for tag, rows in (sf.get("convertible_raised") or {}).items():
        seen = set()
        for r in rows:
            if r.get("form") in ("10-K", "20-F", "40-F", "10-K/A", "20-F/A") and r.get("start") and 340 <= days(r["start"], r["end"]) <= 380 and r["end"] not in seen and r["end"] >= (P(inc[0]["date"]) - dt.timedelta(days=3 * 366 + 30)).isoformat():
                seen.add(r["end"]); raised += r["val"] or 0.0; raised_years.append(r["end"][:7])
    o["dilution"] = {"shares_now": sh[0], "change_1y": c1, "why_1y": w1, "change_2y": c2, "why_2y": w2, "overhang_shares": oh["val"] if oh else None, "overhang_as_of": oh["end"] if oh else None,
                     "overhang_pct": None if not oh or not pick["shares"] or adr else oh["val"] / pick["shares"] * 100, "convertible": cv["val"] if cv and cv["val"] else None, "convertible_as_of": cv["end"] if cv and cv["val"] else None,
                     "convertible_raised_3y": raised if raised > 0 else None, "convertible_raised_years": sorted(set(raised_years)) if raised > 0 else [], "stock_pay_year": sm4("stock_comp")}
    # ---- debt
    da = M.total4(cf, "dep_amort");
    if da is None: da = M.total4(inc, "dep_amort")
    oi4 = o["oi4"]; ebitda = None if oi4 is None or da is None else oi4 + abs(da)
    interest = None if len(inc) < 4 else sum(abs(r.get("interest_expense") or 0.0) for r in inc[:4])
    # the vendor files bitcoin miners and AI hosts under capital markets, so the comps system holds them as "banks": they are
    # companies with ordinary debt, and are read as such
    miner = "NEOCLOUDS_MINERS" in ((KN.get(t) or {}).get("cohorts") or [])
    lev = M.leverage(net_debt, ebitda, interest, sales.get("next"), None if miner else o["family"], pre_profit=o["tier"] is not None)
    o["debt"] = {"total": debt_total, "leases": leases_now, "net_debt": net_debt, "ebitda": ebitda, "ebitda_vendor": M.total4(inc, "ebitda"), "interest": interest, "due_12m": b.get("short_debt"), **lev}
    # ---- how far apart the analysts stand
    ys = sales["years"][1:] if len(sales["years"]) > 1 else []
    o["quality"] = {"analysts": sales.get("analysts"), "spread_sales": M.spread(sales.get("next_high"), sales.get("next_low"), sales.get("next")), "thin": bool(sales.get("analysts") is not None and sales["analysts"] < M.THIN_ANALYSTS),
                    "spread_eps_vs_price": None if not price or sales.get("eps_range_next") is None else sales["eps_range_next"] / price * 100, "spread_eps_vs_average": ys[0].get("spread_eps") if ys else None,
                    "spread_sales_after": None if len(ys) < 2 else ys[1].get("spread_sales")}
    rpo = newest(sf, "under_contract", since); pc = newest(sf, "purchase_commitments", since)
    o["under_contract"] = None if not rpo or not rpo["val"] else {"amount": rpo["val"] * (fx if fx != 1.0 else 1.0), "as_of": rpo["end"], "times_next_year": None if not sales.get("next") else rpo["val"] * fx / sales["next"]}
    o["purchase_commitments"] = None if not pc or not pc["val"] else {"amount": pc["val"] * fx, "as_of": pc["end"]}
    return o
# ====================================================================== every company
READ = {}
for t in sorted(C):
    r = reading(t)
    if r: READ[t] = r
label = lambda c: BR[c]["label"] if c in BR else c
def branches_of(t): return [c for c in (KN.get(t) or {}).get("cohorts", []) if c in BR]
# ====================================================================== the shelf
COMPARE = [x for x in os.environ.get("PP1_COMPARE", "BE").split(",") if x]        # profitable names measured the same way and shown beside the shelf (Alan set Bloom against Nebius and IREN)
shelf_in = []; off_shelf = []
for t, o in READ.items():
    if "sales" not in o: continue
    if o["tier"] is None:
        if o.get("why_not") and not o["why_not"].startswith("made a profit"):
            off_shelf.append({"t": t, "name": o["name"], "why": o["why_not"], "kind": "lost" if o["why_not"].startswith("had steady") else "slow" if o["why_not"].startswith("pre-profit") else "expected", "oi4": o["oi4"], "ni4": o["ni4"], "eps_this_year": o.get("eps_this_year"),
                              "growth": r1(o["sales"].get("g1")), "sales_next": ri(o["sales"].get("next")), "branches": [label(c) for c in branches_of(t)], "lists": (KN.get(t) or {}).get("lists", []),
                              # measured the same way, though not ranked here
                              "ev_sales": r2(o["ev_sales"]), "gm": r1(o["margin"]["now"]), "gm_change": r1(o["margin"]["change"]), "cash_sti": ri(o["cash"]["cash_sti"]), "runway_q": r1(o["burn"]["quarters"]), "burn_basis": o["burn"]["basis"], "gap_pct": r1(o["gap"]["pct_of_value"]),
                              "shares_1y": r1(o["dilution"]["change_1y"]), "shares_2y": r1(o["dilution"]["change_2y"]), "overhang_pct": r1(o["dilution"]["overhang_pct"]), "net_debt": ri(o["debt"]["net_debt"]), "nd_sales": r2(o["debt"]["nd_sales"]), "nd_ebitda": r2(o["debt"]["nd_ebitda"]), "cover": r2(o["debt"]["cover"]),
                              "analysts": o["quality"]["analysts"], "spread_sales": r1(o["quality"]["spread_sales"]), "value_source": o["shares"]["source"]})
        if t not in COMPARE: continue
    s = o["sales"]; d = o["dilution"]; g = o["gap"]
    shelf_in.append({"t": t, "venture": o["tier"] == "V", "g1": s.get("g1"), "g2": s.get("g2"), "sales_next": s.get("next"), "ev_sales": o["ev_sales"], "gm": o["margin"]["now"], "gm_change": o["margin"]["change"],
                     "runway_q": o["burn"]["quarters"], "burning": None if o["burn"]["burn_q"] is None else o["burn"]["burn_q"] > 0, "gap_pct": g["pct_of_value"], "shares_1y": d["change_1y"], "overhang": d["overhang_pct"],
                     "nd_sales": o["debt"]["nd_sales"], "net_debt": o["debt"]["net_debt"], "analysts": o["quality"]["analysts"], "spread_sales": o["quality"]["spread_sales"], "spread_eps": o["quality"]["spread_eps_vs_price"]})
S = M.score_shelf([r for r in shelf_in if READ[r["t"]]["tier"] is not None])                       # the shelf proper sets the field and the ranks
SCORED = {r["t"]: r for r in S["rows"]}
if any(READ[r["t"]]["tier"] is None for r in shelf_in):                                            # a comparison name is read against that same field and shown where it would stand
    S2 = M.score_shelf(shelf_in); both = {r["t"]: r for r in S2["rows"]}
    for r in shelf_in:
        if READ[r["t"]]["tier"] is None:
            x = dict(both[r["t"]]); better = sum(1 for z in S["rows"] if z["ranked"] and z["score"] > x["score"]); x["rank"] = None; x["ranked"] = False; x["would_rank"] = better + 1; SCORED[r["t"]] = x
def money(o):                                                                    # everything rounded for the page; dollars kept whole
    def walk(x):
        if isinstance(x, float): return None if not math.isfinite(x) else (round(x) if abs(x) >= 1000 else round(x, 3))
        if isinstance(x, dict): return {k: walk(v) for k, v in x.items()}
        if isinstance(x, list): return [walk(v) for v in x]
        return x
    return walk(o)
shelf = []
for t in S["order"] + sorted(t for t, r in SCORED.items() if not r["ranked"]):
    o = READ[t]; sc = SCORED[t]; kn = KN.get(t) or {}
    row = {**o, "compare": o["tier"] is None, "would_rank": sc.get("would_rank"), "branches": [label(c) for c in branches_of(t)], "lists": kn.get("lists", []), "geiger": kn.get("geiger"), "pctl": kn.get("pctl"), "knockout_verdict": kn.get("verdict"),
           "knockout_g1": kn.get("g1_rev") if kn.get("g1_rev") is not None else kn.get("g1_rev_unranked"),
           "score": round(sc["score"], 3), "promise": round(sc["promise"], 3), "footing": round(sc["footing"], 3), "rank": sc["rank"], "ranked": sc["ranked"], "thin": sc["thin"], "n_parts": sc["n"], "parts": {k: (None if v is None else round(v, 2)) for k, v in sc["parts"].items()}, "sub": {k: (None if v is None else round(v, 2)) for k, v in sc["sub"].items()}}
    shelf.append(money(row))
# ====================================================================== debt in the knockout
cohorts = sorted(BR)
LOAD = {t: (o.get("debt") or {}).get("load") for t, o in READ.items()}
def rerun(max_cut=M.MAX_CUT, loads=LOAD, wide=False):
    out = {}
    for c in cohorts:
        rows = [{k: KN[t][k] for k in ("t", "g1_rev", "g1_eps", "g2_rev", "g2_eps", "comps", "comps_strength", "revisions", "cash", "pctl", "venture")} for t in BR[c]["run"]]
        S2 = R.score_branch(rows)                                               # the knockout's own round 2, exactly as it ran
        D = M.debate(S2["rows"], loads, max_cut=max_cut, wide=wide)
        out[c] = {"ko": S2, "debate": D}
    return out
BASE = rerun(loads={}); BASEW = rerun(loads={}, wide=True); RUN = rerun(); WIDE = rerun(wide=True)
same_as_ko1 = all(X[c]["debate"]["finalists"] == BR[c]["finalists"] and X[c]["debate"]["order"] == BR[c]["order"] and X[c]["ko"]["finalists"] == BR[c]["finalists"] for c in cohorts for X in (BASE, BASEW))
def lev_words(t):
    d = (READ.get(t) or {}).get("debt") or {}
    if d.get("words"): return d["words"]
    if d.get("load") is None: return "no leverage reading"
    bits = []
    if d.get("nd_ebitda") is not None: bits.append(f"net debt {d['nd_ebitda']:.1f}× EBITDA")
    if d.get("cover") is not None: bits.append(f"EBITDA {d['cover']:.1f}× its interest")
    if d.get("nd_ebitda") is None and d.get("nd_sales") is not None: bits.append(f"net debt {d['nd_sales']:.2f}× next year's sales")
    return ", ".join(bits) or "no net debt"
def lev_row(t):
    d = (READ.get(t) or {}).get("debt") or {}
    kn = KN.get(t) or {}; home = kn.get("home") or ((kn.get("cohorts") or [None])[0])
    return {"t": t, "name": kn.get("name"), "branch": label(home) if home else None, "pre_profit": (READ.get(t) or {}).get("tier") is not None, "load": r2(d.get("load")), "basis": d.get("basis"), "nd_ebitda": r2(d.get("nd_ebitda")), "cover": r2(d.get("cover")), "nd_sales": r2(d.get("nd_sales")), "net_debt": ri(d.get("net_debt")), "ebitda": ri(d.get("ebitda")), "interest": ri(d.get("interest")), "words": lev_words(t)}
moves = []; branch_rows = []
for c in sorted(cohorts, key=lambda c: BR[c]["rank"]):
    D = RUN[c]["debate"]; B = BR[c]
    fin_before = B["finalists"]; fin_after = D["finalists"]; ch_before = B["champion"]; ch_after = D["champion"]
    pass_before = [t for t in B["order"] if B["scores"][t]["passes"]]; pass_after = D["passes"]
    row = {"branch": c, "label": B["label"], "rank": B["rank"], "sector": B["sector_label"], "champion_before": ch_before, "champion_after": ch_after, "finalists_before": fin_before, "finalists_after": fin_after,
           "champion_moved": ch_before != ch_after, "finalists_moved": fin_before != fin_after, "set_changed": set(fin_before) != set(fin_after), "pass_in": sorted(set(pass_after) - set(pass_before)), "pass_out": sorted(set(pass_before) - set(pass_after)),
           "swaps": [s for s in D["swaps"] if s["why"] == "debt"], "rows": [{**lev_row(t), "score": round(D["rows"][t]["score"], 3), "cut": round(D["rows"][t]["cut"], 3), "debated": round(D["rows"][t]["debated"], 3), "place_before": (fin_before.index(t) + 1) if t in fin_before else None, "place_after": (fin_after.index(t) + 1) if t in fin_after else None}
                                                                               for t in dict.fromkeys(fin_before + fin_after)]}
    branch_rows.append(row)
    if row["champion_moved"] or row["finalists_moved"] or row["pass_in"] or row["pass_out"]: moves.append(row)
sens = []
for mc in (0.05, 0.10, 0.15, 0.20, 0.30):
    X = rerun(max_cut=mc)
    sens.append({"max_cut": mc, "champions_changed": [{"branch": BR[c]["label"], "before": BR[c]["champion"], "after": X[c]["debate"]["champion"]} for c in cohorts if X[c]["debate"]["champion"] != BR[c]["champion"]],
                 "finalist_orders_changed": sum(1 for c in cohorts if X[c]["debate"]["finalists"] != BR[c]["finalists"])})
wide_rows = [{"branch": BR[c]["label"], "id": c, "before": BR[c]["finalists"], "narrow": RUN[c]["debate"]["finalists"], "wide": WIDE[c]["debate"]["finalists"]} for c in sorted(cohorts, key=lambda c: BR[c]["rank"]) if WIDE[c]["debate"]["finalists"] != RUN[c]["debate"]["finalists"]]
def where(t):
    """One name's place in each of its branches, before and after the debt reading."""
    out = []
    for c in (KN.get(t) or {}).get("cohorts", []):
        if c not in BR or t not in BR[c].get("scores", {}): continue
        s = BR[c]["scores"][t]; D = RUN[c]["debate"]; a = D["rows"].get(t)
        out.append({"branch": BR[c]["label"], "of": len(BR[c]["order"]), "judged": bool(s["judged"]), "rank_before": s["rank"], "rank_after": None if not a else a["rank"], "passes_before": bool(s["passes"]), "passes_after": None if not a else bool(a["passes"]),
                    "place_before": (BR[c]["finalists"].index(t) + 1) if t in BR[c]["finalists"] else None, "place_after": (D["finalists"].index(t) + 1) if t in D["finalists"] else None, "score": s["score"], "finalists_before": BR[c]["finalists"], "finalists_after": D["finalists"]})
    return out
FOCUS = [x for x in os.environ.get("PP1_FOCUS", "CRWV,NBIS,IREN,BE").split(",") if x in KN]
judged_names = sorted({t for c in cohorts for t in BR[c]["order"]})
loads_read = [t for t in judged_names if LOAD.get(t) is not None]
lev_all = {t: lev_row(t) for t in sorted(KN) if t in READ}
heavy = sorted([t for t in judged_names if (LOAD.get(t) or 0) >= 1.0])
fin_all = sorted({t for c in cohorts for t in BR[c]["finalists"]})
knockout = {"same_as_ko1_without_loads": same_as_ko1, "max_cut": M.MAX_CUT, "even": M.EVEN, "load_even": M.LOAD_EVEN, "bands": M.BANDS, "branches": branch_rows, "moves": [m["branch"] for m in moves],
            "champions_changed": [{"branch": m["label"], "id": m["branch"], "before": m["champion_before"], "after": m["champion_after"]} for m in moves if m["champion_moved"]],
            "finalists_reordered": [{"branch": m["label"], "id": m["branch"], "before": m["finalists_before"], "after": m["finalists_after"]} for m in moves if m["finalists_moved"] and not m["champion_moved"]],
            "pass_flips": [{"branch": m["label"], "in": m["pass_in"], "out": m["pass_out"]} for m in moves if m["pass_in"] or m["pass_out"]], "sensitivity": sens,
            "wide": {"differs_in": wide_rows, "champions_changed": [{"branch": BR[c]["label"], "before": BR[c]["champion"], "after": WIDE[c]["debate"]["champion"]} for c in cohorts if WIDE[c]["debate"]["champion"] != BR[c]["champion"]]},
            "counts": {"judged": len(judged_names), "with_a_reading": len(loads_read), "not_read": len(judged_names) - len(loads_read),
                       "not_read_banks_insurers": sum(1 for t in judged_names if LOAD.get(t) is None and (READ.get(t) or {}).get("debt", {}).get("words", "").startswith("a bank")), "not_read_other": sorted(t for t in judged_names if LOAD.get(t) is None and not (READ.get(t) or {}).get("debt", {}).get("words", "").startswith("a bank")), "net_cash": sum(1 for t in judged_names if LOAD.get(t) == 0 and ((READ[t]["debt"].get("net_debt") or 0) <= 0)),
                       "some_load": sum(1 for t in judged_names if (LOAD.get(t) or 0) > 0), "full_load": len(heavy), "finalists": len(fin_all), "finalists_with_some_load": sum(1 for t in fin_all if (LOAD.get(t) or 0) > 0), "finalists_full_load": sorted(t for t in fin_all if (LOAD.get(t) or 0) >= 1.0),
                       "champions_before": len({BR[c]["champion"] for c in cohorts if BR[c]["champion"]}), "champion_slots": sum(1 for c in cohorts if BR[c]["champion"])},
            "focus": [{**lev_row(t), "verdict": KN[t].get("verdict"), "where": where(t)} for t in FOCUS], "leverage": lev_all}
# ====================================================================== checks, and out
chk = []
for t, o in READ.items():
    kg = (KN.get(t) or {}).get("g1_rev");
    if kg is None: kg = (KN.get(t) or {}).get("g1_rev_unranked")
    mg = (o.get("sales") or {}).get("g1")
    if kg is not None and mg is not None: chk.append((abs(mg - kg), t, round(mg, 1), kg))
chk.sort(reverse=True)
hist = json.load(open("history.json")) if os.path.exists("history.json") else None
big_gap = sorted([(abs(r["value_gap_pct"]), r["t"], r["value_gap_pct"]) for r in shelf if r.get("value_gap_pct") is not None and abs(r["value_gap_pct"]) > 10], reverse=True)
out = {"today": TODAY, "built_utc": dt.datetime.utcnow().isoformat() + "Z", "price_is": CU["meta"]["price_is"], "fx_date": FX_DATE,
       "rules": {"weights": M.WEIGHTS, "sub": M.SUB, "venture_share": M.VENTURE_SHARE, "growth_gate": M.GROWTH_GATE, "dollar_floor": M.DOLLAR_FLOOR, "thin_analysts": M.THIN_ANALYSTS, "runway_cap": M.RUNWAY_CAP, "margin_min_sales": M.MARGIN_MIN_SALES, "missing_class": M.MISSING_CLASS, "compare": COMPARE, "focus": os.environ.get("PP1_FOCUS", "CRWV,NBIS,IREN,BE").split(","), "max_cut": M.MAX_CUT, "bands": M.BANDS, "even": M.EVEN, "load_even": M.LOAD_EVEN, "established": [M.ESTABLISHED_PROFITS, M.ESTABLISHED_YEARS]},
       "counts": {"companies_read": len(READ), "on_shelf": sum(1 for r in shelf if not r["compare"]), "ranked": len(S["order"]), "compare": [r["t"] for r in shelf if r["compare"]], "tier": dict(collections.Counter(r["tier"] for r in shelf)), "off_shelf_lost_profits": sum(1 for x in off_shelf if x["kind"] == "lost"), "off_shelf_profit_expected": sum(1 for x in off_shelf if x["kind"] == "expected"), "off_shelf_slow": sum(1 for x in off_shelf if x["kind"] == "slow"),
                  "cover_counts": sum(1 for r in shelf if (r["shares"]["source"] or "").startswith("cover") and r["shares"]["source"] == "cover"), "quarter_average_counts": sum(1 for r in shelf if r["shares"]["source"] == "quarter average"), "vendor_value": sum(1 for r in shelf if (r["shares"]["source"] or "").startswith("the vendor")),
                  "value_gap_over_10pct": len(big_gap), "with_overhang": sum(1 for r in shelf if r["dilution"]["overhang_pct"] is not None), "with_convertible": sum(1 for r in shelf if r["dilution"]["convertible"] or r["dilution"]["convertible_raised_3y"]), "with_announced_capex": sum(1 for r in shelf if (r["capex"]["announced"] or {}).get("amount")),
                  "thin_estimates": sum(1 for r in shelf if r["quality"]["thin"]), "thin_not_ranked": sum(1 for r in shelf if r["thin"]), "no_estimates": sum(1 for r in shelf if not r["ranked"] and not r["thin"] and not r["compare"])},
       "field": {k: (None if v is None else {"n": v["n"], "q1": r3(v["q1"]), "med": r3(v["med"]), "q3": r3(v["q3"])}) for k, v in S["field"].items()},
       "shelf": shelf, "off_shelf": sorted(off_shelf, key=lambda r: r["t"]), "knockout": knockout, "history": hist,
       "checks": {"growth_vs_knockout": {"n": len(chk), "within_2pts": sum(1 for x in chk if x[0] <= 2), "worst": [{"t": t, "here": a, "knockout": b} for _, t, a, b in chk[:8]]}, "value_gaps": [{"t": t, "pct": p} for _, t, p in big_gap[:40]]}}
os.makedirs(os.path.dirname(OUT), exist_ok=True); json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("companies read", len(READ), "· on the shelf", len(shelf), "ranked", len(S["order"]), "· tiers", out["counts"]["tier"], "· off the shelf:", dict(collections.Counter(x["kind"] for x in off_shelf)))
print("share counts: cover", out["counts"]["cover_counts"], "· quarter average", out["counts"]["quarter_average_counts"], "· vendor value", out["counts"]["vendor_value"], "· market value differs from the Hub's by more than 10%:", len(big_gap))
print("growth here vs the knockout's:", out["checks"]["growth_vs_knockout"]["within_2pts"], "of", len(chk), "within 2 points; worst", out["checks"]["growth_vs_knockout"]["worst"][:4])
print("KNOCKOUT without loads equals KO1:", same_as_ko1, "· judged", len(judged_names), "with a reading", len(loads_read), "· some load", knockout["counts"]["some_load"], "· full load", len(heavy))
print("champions changed:", [(m["branch"], m["before"], "→", m["after"]) for m in knockout["champions_changed"]])
print("finalists reordered (champion kept):", [(m["branch"], m["before"], "→", m["after"]) for m in knockout["finalists_reordered"]])
print("pass flips at ties:", knockout["pass_flips"])
print("sensitivity:", [(s["max_cut"], len(s["champions_changed"]), s["finalist_orders_changed"]) for s in sens])
print("WIDE debate (every name that passed): champions changed", [(x["branch"], x["before"], "→", x["after"]) for x in knockout["wide"]["champions_changed"]])
for x in wide_rows: print("   wide differs:", x["branch"], x["before"], "| narrow", x["narrow"], "| wide", x["wide"])
print("wrote", os.path.getsize(OUT), "bytes")
