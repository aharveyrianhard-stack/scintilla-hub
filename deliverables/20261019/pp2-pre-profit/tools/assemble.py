#!/usr/bin/env python3
"""Turns the raw FMP answers (scratch cache), the Hub list reads, the 13 Oct study and the TAM notes into
PRE-PROFIT-STUDY.json: every measure on the page, the raw answers kept beside them. No network."""
import json, glob, os, sys, datetime as dt, statistics, re

S = os.environ.get("PP2_SCRATCH", "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/1e272f46-f888-4f78-a5e2-b48697d9edb5/scratchpad")
C = os.path.join(S, "fmp-cache")
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "PRE-PROFIT-STUDY.json")
OCT13 = json.load(open(os.path.join(S, "db", "oct13_compact.json")))
TONIGHT = dt.date(2026, 10, 19)

CLASS_A = "AAOI ACHR APLD ASTS AVAV BKSY BTDR CBRS CIFR CRML CRWD CRWV DKNG HUT IONQ IREN LUNR MP NBIS NET NVTS OKLO ONDS OUST PL POET RDW RIOT RKLB S SATL SERV SIDU SMR SNOW SPIR USAR UUUU WULF ZS ZETA".split()
CLASS_B = "BYND CORZ EOSE FROG GKOS HIMS JOBY LCID LYFT MARA MDB MRNA NTRA QBTS RBLX RGTI RIVN SNAP TTWO TWST TXG AUR EVTL LAC QS QUBT RVMD SHAZ".split()
OUTSIDE13 = "APD BA CLF DOW EH GILD HIVE LI MSTR NIO SEDG SFNC SPCX XPEV".split()
NEW_EXCLUDED = {"INTC": "Intel: an established chip maker whose trailing loss is a write-down year (stored TTM net income −$11.3B); operating history profitable; not a pre-profit name",
                "LITE": "Lumentum: an established optical-components maker whose trailing loss is an impairment (stored TTM net income −$6.9B against a profitable operating line); not a pre-profit name"}
CASH_FILTER_FAILERS_13 = "LCID BTDR HUT MARA CRWV RIOT CIFR APLD EOSE AAOI SPIR".split()
DEEP_B = ["LCID", "MARA", "EOSE"]

# ---------- raw cache index ----------
IDX = {}
for f in glob.glob(os.path.join(C, "*.json")):
    if os.path.basename(f).startswith("_"):
        continue
    d = json.load(open(f))
    params = dict(kv.split("=", 1) for kv in d["params"].split("&") if "=" in kv)
    IDX[(d["path"], params.get("symbol") or params.get("symbols"))] = d

def raw(path, sym):
    d = IDX.get((path, sym))
    if not d:
        return None, None
    b = d["body"]
    if isinstance(b, dict) and ("_error" in b or "_raw" in b):
        return None, d["fetched_utc"]
    return b, d["fetched_utc"]

def first(path, sym):
    b, w = raw(path, sym)
    return (b[0] if isinstance(b, list) and b else (b if isinstance(b, dict) else None)), w

# ---------- lists tonight ----------
SL = json.load(open(os.path.join(S, "db", "station_lists.json")))
HF = json.load(open(os.path.join(S, "db", "hub_favorites.json")))
LOCK = json.load(open(os.path.join(S, "db", "ipo_lockups.json")))
RADAR = [r["ticker"] for r in sorted(SL, key=lambda r: r["position"]) if r["list"] == "radar"]
FAV = [r["ticker"] for r in sorted(SL, key=lambda r: r["position"]) if r["list"] == "favorites"]
LIKED = sorted(set(r["ticker"] for r in HF))
LOCKBY = {r["ticker"]: r for r in LOCK}
TAM = {}
for f in sorted(glob.glob(os.path.join(S, "tam", "batch*.json"))):
    TAM.update(json.load(open(f)))

M = 1e6
def m(v):
    return None if v is None else round(v / M, 2)

def pct(a, b):
    if a is None or b in (None, 0):
        return None
    return round((a / b - 1) * 100, 1)

def dsum(rows, key, n=4):
    vals = [r.get(key) for r in rows[:n]]
    if any(v is None for v in vals) or len(vals) < n:
        return None
    return sum(vals)

def date(s):
    return dt.date.fromisoformat(str(s)[:10])

def lists_of(t):
    return {"radar": t in RADAR, "favorites": t in FAV, "liked": t in LIKED,
            "radar_position": (RADAR.index(t) + 1) if t in RADAR else None}

def lockup_for(t, ipo):
    row = LOCKBY.get(t)
    if row:
        sched = row.get("schedule") or []
        nxt = [s for s in sched if s.get("date") and date(s["date"]) >= TONIGHT]
        return {"on_file": True, "listing_kind": row.get("listing_kind"), "ipo_date": row.get("ipo_date"), "lockup_days": row.get("lockup_days"),
                "unlock_date": row.get("unlock_date"), "early_rule": row.get("early_rule"), "early_release": (row.get("early_release") or "")[:400],
                "schedule": sched, "next_step": (nxt[0] if nxt else None), "source_url": row.get("source_url"), "checked_utc": row.get("checked_utc"),
                "basis": row.get("basis")}
    out = {"on_file": False, "ipo_date": ipo}
    if ipo:
        try:
            days = (TONIGHT - date(ipo)).days
            out["days_since_listing"] = days
            out["words"] = ("listed %s, %d days ago: inside a typical 180-day IPO lock-up window, but no row in ipo_lockups" % (ipo, days)) if days < 180 else \
                           ("no row in ipo_lockups; listed %s (%.1f years ago), so any IPO lock-up has long expired; SPAC earn-outs or private-placement lock-ups are not read here" % (ipo, days / 365.25))
        except Exception:
            out["words"] = "no row in ipo_lockups; listing date unreadable"
    else:
        out["words"] = "no row in ipo_lockups; no listing date from FMP"
    return out

def ntm(est_rows, q0, ttm_rev):
    """Blend the two fiscal years that straddle the next twelve months after the latest reported quarter."""
    if not est_rows or not q0:
        return {"ntm_revenue_m": None, "growth_pct": None, "analysts": None, "how": "no estimates"}
    fys = sorted([r for r in est_rows if r.get("date") and date(r["date"]) > q0], key=lambda r: r["date"])
    if not fys:
        return {"ntm_revenue_m": None, "growth_pct": None, "analysts": None, "how": "no fiscal year beyond the latest quarter"}
    fy1 = fys[0]
    fy2 = fys[1] if len(fys) > 1 else None
    e1 = date(fy1["date"])
    f = min(1.0, max(0.0, (e1 - q0).days / 365.0))
    r1, r2 = fy1.get("revenueAvg"), (fy2.get("revenueAvg") if fy2 else None)
    if r1 is None:
        return {"ntm_revenue_m": None, "growth_pct": None, "analysts": None, "how": "no revenue estimate"}
    if fy2 is None or r2 is None:
        n = r1
        how = "FY%s only (no following year on file)" % fy1["date"][:4]
    else:
        n = f * r1 + (1 - f) * r2
        how = "%.0f%% of FY ending %s ($%.0fM) + %.0f%% of FY ending %s ($%.0fM)" % (f * 100, fy1["date"], r1 / M, (1 - f) * 100, fy2["date"], r2 / M)
    na = max([x for x in [fy1.get("numAnalystsRevenue"), (fy2 or {}).get("numAnalystsRevenue")] if x is not None] or [None]) if (fy1.get("numAnalystsRevenue") is not None or (fy2 and fy2.get("numAnalystsRevenue") is not None)) else None
    g = pct(n, ttm_rev) if ttm_rev and ttm_rev > 10 * M else None
    return {"ntm_revenue_m": m(n), "growth_pct": g, "analysts": na, "how": how,
            "fy1": {"end": fy1["date"], "revenue_m": m(r1), "low_m": m(fy1.get("revenueLow")), "high_m": m(fy1.get("revenueHigh")), "analysts": fy1.get("numAnalystsRevenue"), "eps": fy1.get("epsAvg"), "net_income_m": m(fy1.get("netIncomeAvg"))},
            "fy2": ({"end": fy2["date"], "revenue_m": m(r2), "low_m": m(fy2.get("revenueLow")), "high_m": m(fy2.get("revenueHigh")), "analysts": fy2.get("numAnalystsRevenue"), "eps": fy2.get("epsAvg"), "net_income_m": m(fy2.get("netIncomeAvg"))} if fy2 else None)}

def build(t, deep=True):
    o13 = OCT13.get(t) or {}
    prof, w_prof = first("profile", t)
    km, _ = first("key-metrics-ttm", t)
    inc, w_inc = raw("income-statement", t)
    bal, w_bal = raw("balance-sheet-statement", t)
    cfs, w_cf = raw("cash-flow-statement", t)
    est, w_est = raw("analyst-estimates", t)
    pts, _ = first("price-target-summary", t)
    ptc, _ = first("price-target-consensus", t)
    grd, _ = first("grades-consensus", t)
    flt, _ = first("shares-float", t)
    seg, _ = raw("revenue-product-segmentation", t)
    inc = inc or []; bal = bal or []; cfs = cfs or []; est = est or []
    q = inc[:4]
    q0 = date(inc[0]["date"]) if inc else None
    rev = [r.get("revenue") for r in inc]
    ttm_rev = dsum(inc, "revenue")
    ttm_ni = dsum(inc, "netIncome")
    ttm_op = dsum(inc, "operatingIncome")
    yoy = []
    for i in range(min(4, len(inc))):
        prev = rev[i + 4] if i + 4 < len(rev) else None
        yoy.append({"quarter": inc[i]["date"], "period": "%s FY%s" % (inc[i].get("period"), inc[i].get("fiscalYear")), "revenue_m": m(rev[i]),
                    "yoy_pct": (pct(rev[i], prev) if (prev not in (None, 0) and rev[i] is not None) else None), "net_income_m": m(inc[i].get("netIncome")),
                    "operating_income_m": m(inc[i].get("operatingIncome"))})
    # funding
    b0 = bal[0] if bal else {}
    cash = b0.get("cashAndCashEquivalents"); sti = b0.get("shortTermInvestments"); csti = b0.get("cashAndShortTermInvestments")
    if csti is None and cash is not None:
        csti = cash + (sti or 0)
    lti = b0.get("longTermInvestments")
    debt = b0.get("totalDebt"); leases = b0.get("capitalLeaseObligations") or 0
    net_cash = (csti - debt) if (csti is not None and debt is not None) else None
    d13 = o13.get("debt") or {}
    # cash flow
    cf4 = cfs[:4]
    ocf = [r.get("operatingCashFlow") for r in cf4]
    fcf = [r.get("freeCashFlow") for r in cf4]
    capex = [r.get("capitalExpenditure") for r in cf4]
    cf_rows = [{"quarter": r["date"], "ocf_m": m(r.get("operatingCashFlow")), "capex_m": m(r.get("capitalExpenditure")), "fcf_m": m(r.get("freeCashFlow")),
                "stock_issued_m": m(r.get("commonStockIssuance")), "net_stock_issued_m": m(r.get("netCommonStockIssuance")), "net_debt_issued_m": m(r.get("netDebtIssuance")),
                "sbc_m": m(r.get("stockBasedCompensation"))} for r in cfs[:8]]
    neg = [r.get("freeCashFlow") for r in cfs[:8] if r.get("freeCashFlow") is not None and r.get("freeCashFlow") < 0]
    neg4 = [v for v in fcf if v is not None and v < 0]
    fcf_latest_positive = bool(fcf) and fcf[0] is not None and fcf[0] >= 0
    not_burning = len(neg4) == 0 and bool(fcf)
    burn = None
    if neg:
        two = neg[:2]
        burn = -statistics.mean(two)
    burn_note = None
    if not_burning:
        burn_note = "free cash flow positive in each of the last four quarters: not burning"
    elif fcf_latest_positive:
        burn_note = "free cash flow turned positive in the latest quarter (%s); burn is the mean of the last two negative quarters" % cfs[0]["date"]
    elif len(neg4) == 1:
        burn_note = "only one of the last four quarters had negative free cash flow; burn uses the two most recent negative quarters on file"
    # OCF-only basis
    neg_ocf = [r.get("operatingCashFlow") for r in cfs[:8] if r.get("operatingCashFlow") is not None and r.get("operatingCashFlow") < 0]
    ocf_burn = -statistics.mean(neg_ocf[:2]) if neg_ocf else None
    ocf4_pos = all(v is not None and v >= 0 for v in ocf) and bool(ocf)
    runway_q = (csti / burn) if (burn and csti is not None and burn > 0) else None
    runway_q_ocf = (csti / ocf_burn) if (ocf_burn and csti is not None and ocf_burn > 0) else None
    bdate = date(b0["date"]) if b0 else None
    def land(qs):
        if qs is None or bdate is None:
            return None
        return (bdate + dt.timedelta(days=min(qs, 400) * 91.31)).isoformat()
    elapsed_q = round((TONIGHT - bdate).days / 91.31, 1) if bdate else None
    accel = None
    if fcf and fcf[0] is not None and fcf[0] < 0 and burn:
        accel = round(-fcf[0] / burn, 2)
    # raises and dilution
    eq_raised = sum((r.get("commonStockIssuance") or 0) for r in cf4) if cf4 else None
    net_eq = sum((r.get("netCommonStockIssuance") or 0) for r in cf4) if cf4 else None
    net_debt_iss = sum((r.get("netDebtIssuance") or 0) for r in cf4) if cf4 else None
    sh_now = inc[0].get("weightedAverageShsOutDil") if inc else None
    sh_y1 = inc[4].get("weightedAverageShsOutDil") if len(inc) > 4 else None
    dil = pct(sh_now, sh_y1)
    # analysts
    n_est = ntm(est, q0, ttm_rev)
    tgt = None
    if ptc:
        tgt = {"low": ptc.get("targetLow"), "median": ptc.get("targetMedian"), "high": ptc.get("targetHigh"), "consensus": ptc.get("targetConsensus")}
        if tgt["low"] and tgt["high"]:
            tgt["spread_pct_of_median"] = round((tgt["high"] - tgt["low"]) / (tgt["median"] or tgt["consensus"]) * 100, 0) if (tgt["median"] or tgt["consensus"]) else None
    a13 = o13.get("analysts") or {}
    # TAM
    tam = TAM.get(t) or {}
    tam_share = None
    if tam.get("stated") and ttm_rev:
        tam_share = round(ttm_rev / (tam["stated"] * M) * 100, 2)
    price = (prof or {}).get("price"); mcap = (prof or {}).get("marketCap")
    ev = (km or {}).get("enterpriseValueTTM")
    out = {
        "ticker": t, "name": (prof or {}).get("companyName") or o13.get("name"), "class_a": deep,
        "fetched_utc": {"profile": w_prof, "income": w_inc, "balance": w_bal, "cash_flow": w_cf, "estimates": w_est},
        "lists": lists_of(t), "lists_13oct": o13.get("lists13"),
        "business": {"one_line": re.split(r"(?<=\.)\s", ((prof or {}).get("description") or "").strip())[0][:300] if prof else None,
                     "sector": (prof or {}).get("sector"), "industry": (prof or {}).get("industry"), "ipo_date": (prof or {}).get("ipoDate"), "website": (prof or {}).get("website"),
                     "country": (prof or {}).get("country"), "employees": (prof or {}).get("fullTimeEmployees")},
        "market": {"price": price, "market_cap_m": m(mcap), "ev_m": m(ev), "ev_to_sales_ttm": (km or {}).get("evToSalesTTM"), "quote_time": (prof or {}).get("quote_ts")},
        "pre_profit_test": {"ttm_net_income_m": m(ttm_ni), "ttm_operating_income_m": m(ttm_op), "ttm_revenue_m": m(ttm_rev), "latest_quarter": inc[0]["date"] if inc else None,
                            "passes_tonight": (ttm_ni is not None and ttm_ni <= 0), "class_13oct": o13.get("class"), "kind_13oct": o13.get("kind")},
        "growth": {"quarters": yoy, "ntm": n_est, "guidance": tam.get("guidance") or "none found", "guidance_src": tam.get("guidance_src"),
                   "segments": ({"fiscal_year": seg[0].get("fiscalYear"), "date": seg[0].get("date"), "data_m": {k: m(v) for k, v in (seg[0].get("data") or {}).items()}} if seg else None)},
        "tam": {"stated_m": tam.get("stated"), "stated_words": tam.get("stated_words"), "stated_year": tam.get("stated_year"), "stated_src": tam.get("stated_src"), "stated_date": tam.get("stated_date"),
                "stated_caveat": tam.get("stated_caveat"), "stated_note": tam.get("stated_note"), "independent": tam.get("independent"), "independent_m": tam.get("independent_m"),
                "independent_src": tam.get("independent_src"), "revenue_share_pct": tam_share},
        "funding": {"balance_date": b0.get("date"), "filing_date": b0.get("filingDate"), "cash_m": m(cash), "short_term_investments_m": m(sti), "cash_and_sti_m": m(csti), "long_term_investments_m": m(lti),
                    "total_debt_m": m(debt), "debt_ex_leases_m": m((debt - leases) if debt is not None else None), "leases_m": m(leases), "net_cash_m": m(net_cash),
                    "convertible_notes_m_13oct": d13.get("convertible_notes"), "debt_filing_13oct_m": d13.get("filing_borrowings"), "due_within_12m_13oct": d13.get("due_within_12m"),
                    "equity_issued_4q_m": m(eq_raised), "net_equity_issued_4q_m": m(net_eq), "net_debt_issued_4q_m": m(net_debt_iss),
                    "raised_4q_13oct": o13.get("raised_4q"), "shares_dil_wa_now_m": m(sh_now), "shares_dil_wa_year_ago_m": m(sh_y1), "dilution_12m_pct": dil,
                    "dilution_13oct_pct": (o13.get("dilution") or {}).get("d1_pct"), "shares_out_now_m": m((flt or {}).get("outstandingShares")), "float_m": m((flt or {}).get("floatShares")),
                    "free_float_pct": (flt or {}).get("freeFloat"), "float_date": (flt or {}).get("date"),
                    "shelf_13oct": (o13.get("raises") or {}).get("shelf"), "atm_13oct": (o13.get("raises") or {}).get("atm"), "atm_live_13oct": o13.get("atm_live"),
                    "cash_13oct_m": (o13.get("liquidity") or {}).get("value"), "cash_13oct_end": (o13.get("liquidity") or {}).get("stored_end")},
        "burn": {"cash_flow_quarters": cf_rows, "quarterly_burn_m": m(burn), "burn_basis": "mean of the two most recent quarters with negative free cash flow (operating cash flow less capex)",
                 "burn_note": burn_note, "not_burning": not_burning, "fcf_latest_positive": fcf_latest_positive, "latest_over_mean": accel,
                 "runway_quarters": (round(runway_q, 1) if runway_q is not None else None), "runway_lands": land(runway_q), "runway_quarters_at_1_5x": (round(runway_q / 1.5, 1) if runway_q else None),
                 "runway_lands_at_1_5x": land(runway_q / 1.5 if runway_q else None), "quarters_elapsed_since_balance": elapsed_q,
                 "ocf_burn_m": m(ocf_burn), "ocf_positive_4q": ocf4_pos, "runway_quarters_ocf_basis": (round(runway_q_ocf, 1) if runway_q_ocf is not None else None),
                 "runway_13oct_quarters": (o13.get("runway") or {}).get("quarters"), "runway_13oct_filing_basis": (o13.get("runway") or {}).get("filing_basis")},
        "lockup": lockup_for(t, (prof or {}).get("ipoDate")),
        "ownership": {"non_float_pct": (round(100 - flt["freeFloat"], 1) if flt and flt.get("freeFloat") is not None else None),
                      "note": "FMP's shares-float: the share of outstanding stock not in the float (insiders and restricted holders). Insider transactions and 13F holdings are not in the proxy's allowed paths; short interest is not in FMP."},
        "coverage": {"analysts_revenue_ntm": n_est.get("analysts"), "targets": tgt, "summary": ({k: pts.get(k) for k in ("lastMonthCount", "lastMonthAvgPriceTarget", "lastQuarterCount", "lastQuarterAvgPriceTarget", "lastYearCount", "lastYearAvgPriceTarget")} if pts else None),
                     "grades": ({k: grd.get(k) for k in ("strongBuy", "buy", "hold", "sell", "strongSell", "consensus")} if grd else None),
                     "quality_13oct": a13.get("verdict"), "quality_why_13oct": a13.get("verdict_why"), "firm_counts_13oct": a13.get("firm_counts"), "n_next_year_13oct": a13.get("n_next_year"),
                     "target_13oct": a13.get("target"), "projection_miss_13oct": (o13.get("projections") or {}).get("median_abs_miss_pct")},
        "oct13": {"rank": o13.get("rank"), "flags": o13.get("flags"), "report": o13.get("report"), "score": o13.get("score")},
    }
    ipo = (prof or {}).get("ipoDate")
    recent_ipo = False
    try:
        recent_ipo = bool(ipo) and (TONIGHT - date(ipo)).days < 540
    except Exception:
        pass
    if recent_ipo:
        out["funding"]["dilution_12m_pct"] = None
        out["funding"]["dilution_note"] = "not meaningful: listed %s, so the year-ago weighted share count straddles the IPO (pre-IPO classes)" % ipo
    builder = (o13.get("kind") == "builder") or (ocf4_pos and not not_burning)
    out["burn"]["builder"] = builder
    out["burn"]["builder_note"] = ("a builder: operating cash flow is positive and the free-cash deficit is capex, financed as it goes with debt, leases and stock; the operating-cash-flow basis is the second line" if builder else None)
    out["verdict"] = verdict(out)
    return out

def money(v):
    if v is None:
        return "—"
    a = abs(v)
    s = "−" if v < 0 else ""
    return "%s$%.1fB" % (s, a / 1000) if a >= 1000 else "%s$%.0fM" % (s, a)

def verdict(o):
    b, f, g, c = o["burn"], o["funding"], o["growth"], o["coverage"]
    liq = f["cash_and_sti_m"]; rq = b["runway_quarters"]; mcap = o["market"]["market_cap_m"]
    pre_rev = (o["pre_profit_test"]["ttm_revenue_m"] or 0) < 10
    if b["not_burning"]:
        read = "funded"
    elif rq is None:
        read = "unknown"
    elif rq >= 12:
        read = "funded"
    elif rq >= 6:
        read = "tight"
    else:
        read = "on the clock"
    yoy = next((q["yoy_pct"] for q in g["quarters"] if q["yoy_pct"] is not None), None)
    ntm_g = g["ntm"].get("growth_pct")
    s1 = []
    lti = f.get("long_term_investments_m") or 0
    if b["not_burning"]:
        s1.append("Self-funding: free cash flow was positive in each of the last four quarters, with %s of cash and short-term investments%s against %s of debt at %s." % (money(liq), (" (plus %s of longer-dated securities)" % money(lti)) if lti > 50 else "", money(f["total_debt_m"]), f["balance_date"]))
    elif rq is not None and rq > 40:
        s1.append("Funded for 40+ quarters at the current burn of %s a quarter of free cash (%s of cash and short-term investments at %s); the burn is too small to set a date." % (money(b["quarterly_burn_m"]), money(liq), f["balance_date"]))
    elif rq is not None and b.get("builder"):
        s1.append("A builder: %s of cash and short-term investments at %s covers %.1f quarters of the free-cash deficit (%s a quarter, almost all capex), but operating cash flow is positive%s, so the clock is on the financing, not the business." % (money(liq), f["balance_date"], rq, money(b["quarterly_burn_m"]), (" (%.0f quarters of cash on that basis)" % b["runway_quarters_ocf_basis"]) if b.get("runway_quarters_ocf_basis") and b["runway_quarters_ocf_basis"] < 400 else ""))
    elif rq is not None:
        s1.append("Funded for %.1f quarters at the current burn of %s a quarter of free cash (%s of cash and short-term investments at %s, which lands around %s; %.1f quarters at 1.5× the burn)." % (rq, money(b["quarterly_burn_m"]), money(liq), f["balance_date"], b["runway_lands"], b["runway_quarters_at_1_5x"]))
    else:
        s1.append("Runway cannot be measured from FMP's cash-flow rows for this name.")
    if pre_rev:
        s1.append("It is pre-revenue (%s of trailing revenue), so growth is not yet a measure%s." % (money(o["pre_profit_test"]["ttm_revenue_m"] or 0), "; the Street's first-year revenue estimate is %s" % money(g["ntm"]["ntm_revenue_m"]) if g["ntm"].get("ntm_revenue_m") else ""))
    else:
        gw = []
        if yoy is not None:
            gw.append("revenue %s %s%% y/y in the latest quarter" % ("grew" if yoy >= 0 else "fell", ("%+.0f" % yoy).replace("-", "−")))
        if ntm_g is not None:
            gw.append("the Street has %s%% for the next twelve months (%s analysts)" % (("%+.0f" % ntm_g).replace("-", "−"), g["ntm"].get("analysts") or "?"))
        if gw:
            s1.append("Growth: " + " and ".join(gw) + ".")
    if g.get("guidance") and g["guidance"] not in ("none found", "none", "none; pre-revenue") and not g["guidance"].startswith("none"):
        s1.append("The company's own guidance: %s." % g["guidance"].rstrip("."))
    # next raise
    shelf = f.get("shelf_13oct") or {}; atm = f.get("atm_13oct") or {}
    paper = []
    if atm and atm.get("status") == "open":
        paper.append("an at-the-market programme is open (%s)" % (atm.get("size_text") or "size not printed"))
    elif f.get("atm_live_13oct"):
        paper.append("an at-the-market programme was live at the 13 Oct read")
    if shelf.get("open"):
        paper.append("a shelf is open (%s, %s)" % (shelf.get("form"), shelf.get("filed")))
    elif shelf:
        paper.append("a shelf is filed (%s, %s)" % (shelf.get("form"), shelf.get("filed")))
    else:
        paper.append("no shelf on file at the 13 Oct read")
    burn_share = (b["quarterly_burn_m"] / mcap * 100) if (b["quarterly_burn_m"] and mcap) else None
    sold = f.get("equity_issued_4q_m") or 0
    if b.get("builder") and read in ("on the clock", "tight"):
        s2 = "The next financing is a question of debt, leases and the programme, not a cash cliff: it raised %s of net debt and %s of stock in the last four quarters; %s; at this pace the next round is due inside %s months." % (
            money(f.get("net_debt_issued_4q_m")), money(sold), "; ".join(paper), ("%d" % max(1, round((rq or 0) * 3))) if rq else "a few")
    elif read == "on the clock":
        s2 = "The next raise is due inside %s months: %s; a quarter's burn is %.1f%% of today's market value, so the likely shape is %s." % (
            ("%d" % max(1, round((rq or 0) * 3 - 3))) if rq else "a few", "; ".join(paper), burn_share or 0,
            "stock through the programme" if (atm or f.get("atm_live_13oct")) else ("equity or a convert off the shelf" if shelf else "a new shelf first, then equity"))
    elif read == "tight":
        s2 = "A raise is likely within %d to %d months, before cash falls under a year of burn: %s; it sold %s of stock in the last four quarters (shares up %s%% in a year)." % (
            max(1, round(((rq or 6) - 4) * 3)), max(3, round(((rq or 6) - 2) * 3)), "; ".join(paper), money(sold), ("%.0f" % f["dilution_12m_pct"]) if f.get("dilution_12m_pct") is not None else "?")
    elif read == "funded":
        far = b["not_burning"] or (rq is not None and rq > 40)
        s2 = "No raise is forced before %s%s: %s; it sold %s of stock in the last four quarters%s." % (
            "any date in view" if far else b["runway_lands"], " on cash flow alone" if b["not_burning"] else "", "; ".join(paper), money(sold),
            (" (shares %s%% in a year)" % ("%+.0f" % f["dilution_12m_pct"]).replace("-", "−")) if f.get("dilution_12m_pct") is not None else "")
    else:
        s2 = "The shape of the next raise cannot be read without a burn figure: %s." % "; ".join(paper)
    # dominant risk
    risk = None
    lk = o["lockup"]
    if lk.get("on_file") and lk.get("unlock_date") and (date(lk["unlock_date"]) - TONIGHT).days <= 120 and (date(lk["unlock_date"]) - TONIGHT).days >= -1:
        risk = "the lock-up: it ends %s%s, and %.0f%% of the stock is outside the float today" % (lk["unlock_date"], (" or earlier (%s)" % lk["early_rule"]) if lk.get("early_rule") else "", o["ownership"]["non_float_pct"] or 0)
    elif (not b["not_burning"]) and f.get("net_cash_m") is not None and f["net_cash_m"] < 0 and f.get("total_debt_m") and liq and f["total_debt_m"] > liq:
        risk = "the debt: %s of borrowings and leases against %s of cash" % (money(f["total_debt_m"]), money(liq))
    elif b.get("latest_over_mean") and b["latest_over_mean"] >= 1.5 and not b["not_burning"]:
        risk = "burn is accelerating: the latest quarter took %s against a %s mean (%.1f×), so the runway above overstates the time" % (money(-(b["cash_flow_quarters"][0]["fcf_m"] or 0)), money(b["quarterly_burn_m"]), b["latest_over_mean"])
    elif pre_rev:
        risk = "pre-revenue: the equity is a financing story until the first contracted dollar is booked"
    elif b.get("builder") and f.get("net_cash_m") is not None and f["net_cash_m"] < 0:
        risk = "the financing: %s of debt and leases against %s of cash, with the capex still to come" % (money(f["total_debt_m"]), money(liq))
    elif f.get("dilution_12m_pct") is not None and f["dilution_12m_pct"] >= 25:
        risk = "dilution: the diluted share count is up %.0f%% in a year" % f["dilution_12m_pct"]
    elif ntm_g is not None and yoy is not None and ntm_g < yoy - 20:
        risk = "deceleration: the Street's %+.0f%% for the next twelve months is well under the %+.0f%% just printed" % (ntm_g, yoy)
    elif ntm_g is not None:
        risk = "execution against the Street's %+.0f%% growth; a miss re-opens the funding question" % ntm_g
    else:
        risk = "the absence of a consensus: no analyst revenue estimate on file"
    s3 = "The one risk that dominates: %s." % risk
    return {"read": read, "sentences": [" ".join(s1), s2, s3], "rule": "funded = not burning or ≥12 quarters of runway; tight = 6 to 12; on the clock = under 6"}

def build_b(t):
    o13 = OCT13.get(t) or {}
    bq = None
    for (p, s), d in IDX.items():
        if p == "batch-quote":
            for r in d["body"]:
                if r.get("symbol") == t:
                    bq = r
    km, _ = first("key-metrics-ttm", t)
    row = {"ticker": t, "name": o13.get("name"), "class": o13.get("class"), "kind": o13.get("kind"), "price": (bq or {}).get("price"), "market_cap_m": m((bq or {}).get("marketCap")),
           "ev_m": m((km or {}).get("enterpriseValueTTM")), "ev_to_sales_ttm": (km or {}).get("evToSalesTTM"),
           "runway_13oct_quarters": (o13.get("runway") or {}).get("quarters"), "not_burning_13oct": (o13.get("runway") or {}).get("not_burning"),
           "cash_13oct_m": (o13.get("liquidity") or {}).get("value"), "cash_13oct_end": (o13.get("liquidity") or {}).get("stored_end"),
           "debt_13oct_m": (o13.get("debt") or {}).get("provider_total"), "dilution_13oct_pct": (o13.get("dilution") or {}).get("d1_pct"),
           "analysts_13oct": (o13.get("analysts") or {}).get("n_next_year"), "coverage_13oct": (o13.get("analysts") or {}).get("verdict"),
           "growth_13oct_pct": (o13.get("score") or {}).get("growth_pct"), "rank_13oct": o13.get("rank"),
           "lockup": lockup_for(t, (o13.get("profile") or {}).get("ipo_date")), "lists": lists_of(t)}
    nc = None
    if row["cash_13oct_m"] is not None and row["debt_13oct_m"] is not None:
        nc = round(row["cash_13oct_m"] - row["debt_13oct_m"], 1)
    row["net_cash_13oct_m"] = nc
    rq = row["runway_13oct_quarters"]
    row["read"] = "funded" if (row["not_burning_13oct"] or (rq is not None and rq >= 12)) else ("tight" if (rq is not None and rq >= 6) else ("on the clock" if rq is not None else "unknown"))
    if t in DEEP_B:
        live = build(t, deep=False)
        row["live"] = {"funding": live["funding"], "burn": live["burn"], "growth_quarters": live["growth"]["quarters"], "ntm": live["growth"]["ntm"], "pre_profit_test": live["pre_profit_test"], "verdict": live["verdict"]}
    return row

names = {t: build(t) for t in CLASS_A}
classb = {t: build_b(t) for t in CLASS_B}
excluded = [{"ticker": t, "name": (OCT13.get(t) or {}).get("name"), "why": "; ".join((OCT13.get(t) or {}).get("outside_reasons") or [])} for t in OUTSIDE13]
for t, why in NEW_EXCLUDED.items():
    inc, _ = raw("income-statement", t)
    ttm = dsum(inc or [], "netIncome"); op = dsum(inc or [], "operatingIncome")
    excluded.append({"ticker": t, "name": why.split(":")[0], "why": why, "ttm_net_income_m_live": m(ttm), "ttm_operating_income_m_live": m(op), "on_lists": lists_of(t)})

def rank_key(o):
    b = o["burn"]
    if b["not_burning"]:
        return (0, -1e9)
    rq = b["runway_quarters"]
    return (1, -(rq if rq is not None else -1))
ranked = sorted(names.values(), key=rank_key)
summary_a = []
for o in ranked:
    lk = o["lockup"]
    summary_a.append({"ticker": o["ticker"], "name": o["name"], "read": o["verdict"]["read"], "runway_quarters": o["burn"]["runway_quarters"], "not_burning": o["burn"]["not_burning"],
                      "runway_lands": o["burn"]["runway_lands"], "ntm_growth_pct": o["growth"]["ntm"].get("growth_pct"), "latest_yoy_pct": next((q["yoy_pct"] for q in o["growth"]["quarters"] if q["yoy_pct"] is not None), None),
                      "net_cash_m": o["funding"]["net_cash_m"], "cash_and_sti_m": o["funding"]["cash_and_sti_m"], "total_debt_m": o["funding"]["total_debt_m"], "dilution_12m_pct": o["funding"]["dilution_12m_pct"],
                      "next_lockup": (lk.get("unlock_date") if lk.get("on_file") else None), "lockup_words": lk.get("words"), "analysts": o["coverage"]["analysts_revenue_ntm"], "market_cap_m": o["market"]["market_cap_m"],
                      "lists": o["lists"], "ttm_net_income_m": o["pre_profit_test"]["ttm_net_income_m"], "passes_tonight": o["pre_profit_test"]["passes_tonight"], "class_13oct": o["pre_profit_test"]["class_13oct"],
                      "tam_stated_m": o["tam"]["stated_m"], "tam_share_pct": o["tam"]["revenue_share_pct"], "quarterly_burn_m": o["burn"]["quarterly_burn_m"], "price": o["market"]["price"], "builder": o["burn"]["builder"], "runway_ocf": o["burn"]["runway_quarters_ocf_basis"], "ocf_positive_4q": o["burn"]["ocf_positive_4q"], "guidance": o["growth"]["guidance"]})
failers = []
for t in CASH_FILTER_FAILERS_13:
    if t in names:
        o = names[t]
        failers.append({"ticker": t, "name": o["name"], "runway_13oct": o["burn"]["runway_13oct_quarters"], "runway_tonight": o["burn"]["runway_quarters"], "not_burning": o["burn"]["not_burning"],
                        "runway_ocf_basis": o["burn"]["runway_quarters_ocf_basis"], "cash_and_sti_m": o["funding"]["cash_and_sti_m"], "cash_13oct_m": o["funding"]["cash_13oct_m"], "balance_date": o["funding"]["balance_date"],
                        "read": o["verdict"]["read"], "burn_m": o["burn"]["quarterly_burn_m"], "ocf_burn_m": o["burn"]["ocf_burn_m"], "equity_issued_4q_m": o["funding"]["equity_issued_4q_m"], "where": "class A"})
    else:
        r = classb[t]; lv = r.get("live") or {}
        failers.append({"ticker": t, "name": r["name"], "runway_13oct": r["runway_13oct_quarters"], "runway_tonight": (lv.get("burn") or {}).get("runway_quarters"), "not_burning": (lv.get("burn") or {}).get("not_burning"),
                        "runway_ocf_basis": (lv.get("burn") or {}).get("runway_quarters_ocf_basis"), "cash_and_sti_m": (lv.get("funding") or {}).get("cash_and_sti_m"), "cash_13oct_m": r["cash_13oct_m"], "balance_date": (lv.get("funding") or {}).get("balance_date"),
                        "read": (lv.get("verdict") or {}).get("read"), "burn_m": (lv.get("burn") or {}).get("quarterly_burn_m"), "ocf_burn_m": (lv.get("burn") or {}).get("ocf_burn_m"), "equity_issued_4q_m": (lv.get("funding") or {}).get("equity_issued_4q_m"), "where": "class B"})

calls = {}
for f in glob.glob(os.path.join(C, "_calls_*.json")):
    d = json.load(open(f)); calls[os.path.basename(f)] = d["calls"]
fetch_times = sorted(d["fetched_utc"] for d in IDX.values())
meta = {"title": "The pre-profit study: growth, market size, funding, debt, cash, burn, runway, lock-ups", "lane": "SCINTILLA-20261019-PP2", "built_utc": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"),
        "fmp_fetch_window_utc": [fetch_times[0], fetch_times[-1]] if fetch_times else None, "fmp_calls": calls, "fmp_calls_total": sum(v.get("network", 0) for v in calls.values()),
        "lists_read_utc": dt.datetime.utcfromtimestamp(os.path.getmtime(os.path.join(S, "db", "station_lists.json"))).strftime("%Y-%m-%dT%H:%MZ"),
        "radar": RADAR, "favorites_count": len(FAV), "liked_count": len(LIKED), "class_a_count": len(CLASS_A), "class_b_count": len(CLASS_B),
        "rules": {"pre_profit": "trailing-twelve-month GAAP net income ≤ 0 on FMP's quarterly income statements tonight, or the 13 Oct study's class (pre-profit or pre-revenue)",
                  "class_a": "every pre-profit name on tonight's RADAR, FAVORITES (station_lists) and LIKED (hub_favorites) lists; names on those lists outside the 13 Oct set were tested on stored trailing net income (Zeta joins; Intel and Lumentum are excluded as established names on write-downs)",
                  "burn": "mean of the two most recent quarters with negative free cash flow (operating cash flow less capex), from FMP's quarterly cash-flow statements",
                  "runway": "cash and short-term investments at the latest balance sheet ÷ quarterly burn, in quarters; the landing date counts from the balance-sheet date; sensitivity at 1.5× burn",
                  "ntm": "next-twelve-month consensus revenue = time-weighted blend of the two fiscal-year estimates straddling the twelve months after the latest reported quarter; growth is against trailing-twelve-month revenue",
                  "dilution": "diluted weighted-average shares, latest quarter against the same quarter a year earlier",
                  "read": "funded = not burning or ≥12 quarters; tight = 6 to 12; on the clock = under 6",
                  "tam": "the company's own stated figure with source and date from the web (read-only), one independent figure where easy to cite; 'no stated TAM' when nothing credible was found; nothing invented"},
        "not_measured": ["Company guidance beyond what the TAM search surfaced: FMP's earnings-call and press paths are not in the proxy's allowed list",
                         "Insider transactions and 13F institutional holdings: not in the proxy's allowed paths; FMP's shares-float non-float share stands in",
                         "Short interest: not in FMP",
                         "Convertible notes: FMP's balance sheet does not separate them; the 13 Oct filing-tagged figure is shown where it exists",
                         "Lock-ups beyond the three rows in ipo_lockups: SPAC earn-outs, PIPE and private-placement lock-ups were not read",
                         "Capital raised: FMP's cash-flow 'common stock issuance' line (gross), not the offering documents",
                         "TAM figures: read from web search results and secondary press quoting company decks; the decks themselves were not opened unless the SEC filing was the hit"],
        "read_only": True, "tables_written": 0, "deploys": 0, "subagents": 0, "paid_apis": 0}
json.dump({"meta": meta, "summary_a": summary_a, "class_a": names, "class_b": classb, "excluded": excluded, "cash_filter_failers_13oct": failers,
           "lists_tonight": {"radar": RADAR, "favorites": FAV, "liked": LIKED}, "lockups_table": LOCK}, open(OUT, "w"), indent=1, default=str)
print("wrote", OUT, "class A", len(names), "class B", len(classb), "excluded", len(excluded))
for s in summary_a:
    print("%-5s %-13s rq=%-6s nb=%-5s ntm=%-7s yoy=%-7s netcash=%-9s dil=%-6s n=%-4s lock=%s" % (s["ticker"], s["read"], s["runway_quarters"], s["not_burning"], s["ntm_growth_pct"], s["latest_yoy_pct"], s["net_cash_m"], s["dilution_12m_pct"], s["analysts"], s["next_lockup"]))
