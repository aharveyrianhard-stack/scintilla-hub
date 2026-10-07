# KO1 · ROUND 2's readings that are not the comps number, for every company, from the same table snapshot:
#   GROWTH   the next twelve months against the last twelve, and the twelve months after that — revenue and EPS — with
#            every company put on the SAME calendar window whatever month its fiscal year ends (a fiscal year in progress
#            is blended with the next by the share of it still to run), and EPS on a CLEAN BASE: the estimates-versus-
#            guidance study's rule for one-offs, applied to every company.
#   REVISIONS  the analysts' own number for the same twelve months, the oldest stored copy against the newest.
#   CASH     free cash flow over market value, from the comps reader's own figures (so a foreign reporter is already in
#            dollars). Not a yardstick for a bank or an insurer: left out there, and said.
#
# THE ONE-OFF RULE (the estimates-versus-guidance study, tools/flag-rule.mjs — the same three steps and thresholds):
#   1 the consensus is on a GAAP basis when the street's reported EPS for the year's reported quarters is within 10% of the
#     filed diluted EPS; otherwise it is non-GAAP and one-off gains are already outside it;
#   2 a reported quarter carries a one-off when other (non-operating) income is more than 25% of its profit;
#   3 when the after-tax one-offs reach 15% of the year's EPS on a GAAP basis the year is marked ONE-OFF and the clean
#     base is the year's EPS less the one-offs.
#   WHAT IS READ DIFFERENTLY HERE: that study took the pre-tax, tax and other-income lines from the filings of six names.
#   The Hub's tables hold operating income and net income, not those lines. So for the whole universe a quarter is marked
#   when BOTH hold: (a) the study's 25%-of-pre-tax test at an ordinary 21% tax rate, which comes to net income above 1.054
#   times operating income — more profit than operations alone could have left after tax; and (b) it is unusual for the
#   company itself: more than a quarter of that profit sits above its own usual net income per dollar of operating income
#   (the median of its other quarters, twelve at most, at least six). The one-off is the part above its own usual, already
#   after tax. A leveraged utility never passes (a); a landlord that pays no tax or a company with steady interest income
#   passes (a) but not (b). On Alphabet's 2026 this reads about 8.2 a share against the study's 8.92 from the filings, and
#   on Amazon's 4.2 against 4.91 (tests/ko1-knockout.test.mjs) — a little under, because their usual already holds some gains.
# Read-only on files. Run from the scratch folder after comps-universe.mjs:   python3 <this file>
import json, datetime as d, collections, os, sys, math
TODAY = d.date.fromisoformat(os.environ.get("KO1_TODAY", "2026-10-06")); SNAP = os.environ.get("KO1_SNAP", "snap")
RULE = {"oneOffShareOfPretax": 0.25, "oneOffShareOfYear": 0.15, "basisBand": 0.10, "ordinaryTax": 0.21, "minQuarters": 6, "historyQuarters": 12, "thinAnalysts": 10,
        "baseShareOfValue": 0.01, "dipBelowNeighbours": 0.6, "minWeight": 0.1, "minRevisionDays": 30}
L = lambda n: json.load(open(f"{SNAP}/{n}.json"))
P = lambda s: d.date.fromisoformat(s[:10])
def usual_pass_through(others, rule=RULE):
    """The company's usual net income per dollar of operating income: the median over its other quarters with both positive."""
    r = sorted(q["ni"] / q["oi"] for q in others if q.get("oi") and q["oi"] > 0 and q.get("ni") is not None and q["ni"] > 0)
    if len(r) < rule["minQuarters"]: return None
    m = len(r) // 2
    return r[m] if len(r) % 2 else (r[m - 1] + r[m]) / 2
def one_off_quarter(q, usual, rule=RULE):
    """One reported quarter against the company's usual. Returns (is one-off, after-tax one-off per share, its share of the profit)."""
    oi, ni, shares = q.get("oi"), q.get("ni"), q.get("shares")
    if usual is None or oi is None or ni is None or not shares or shares <= 0 or ni <= 0: return (False, 0.0, None)
    excess = ni - usual * max(oi, 0.0); share = excess / ni
    # (a) the study's own test at an ordinary tax rate: other income above a quarter of pre-tax profit, which is the same
    #     as net income above 1.054 × operating income — more profit than operations alone could have left after tax
    ordinary = ni / (1 - rule["ordinaryTax"]); beyond_operations = (ordinary - max(oi, 0.0)) / ordinary > rule["oneOffShareOfPretax"]
    # (b) and it is unusual for THIS company: more than a quarter of the profit sits above its own usual
    if not beyond_operations or share <= rule["oneOffShareOfPretax"]: return (False, 0.0, share)
    return (True, excess / shares, share)
def year_one_offs(quarters, street, year_eps, history, rule=RULE):
    """quarters: the reported quarters of one fiscal year [{date, eps_dil, oi, ni, shares}] · street: {quarter end: street EPS} ·
    history: the company's last twelve reported quarters (the usual is taken from the ones that are not the quarter judged).
    Returns {basis, one_off_ps, share_of_year, flagged, clean}. The clean base is set only on a GAAP-basis consensus."""
    s = g = 0.0; n = 0
    for q in quarters:
        e = street.get(q["date"])
        if e is not None and q["eps_dil"] is not None: s += e; g += q["eps_dil"]; n += 1
    basis = "UNKNOWN" if not n or not g else ("GAAP" if abs(s / g - 1) < rule["basisBand"] else "NON-GAAP")
    gain = 0.0; marked = []; judged = 0
    for q in quarters:
        usual = usual_pass_through([h for h in history if h["date"] != q["date"]], rule)
        if usual is not None: judged += 1
        is_one, ps, share = one_off_quarter(q, usual, rule)
        if is_one: gain += ps; marked.append({"date": q["date"], "per_share": round(ps, 3), "share_of_profit": round(share, 3), "usual": round(usual, 3)})
    inside = gain if basis == "GAAP" else 0.0
    share = inside / year_eps if year_eps and year_eps > 0 else None
    flagged = bool(share is not None and share >= rule["oneOffShareOfYear"])
    return {"basis": basis, "quarters_matched": n, "quarters_judged": judged, "quarters_marked": marked, "gaap_one_off_ps": round(gain, 3), "one_off_ps": round(inside, 3),
            "share_of_year": None if share is None else round(share, 3), "flagged": flagged, "clean": round(year_eps - inside, 4) if flagged else None}
def dip_year(before, year, after, rule=RULE):
    """A year more than 40% under BOTH its neighbours is a one-off year (a charge, a write-off), not a trend."""
    return bool(before is not None and after is not None and year is not None and before > 0 and after > 0 and year < rule["dipBelowNeighbours"] * before and year < rule["dipBelowNeighbours"] * after)
def base_ok(parts, base, sales_ps, rule=RULE):
    """Can growth be measured from this base? parts: [(weight, the year's EPS, is it a dip year)] — the fiscal years blended
    into the base. Every year that counts for a tenth or more must be a profit and not a one-off year, and the base itself
    must be at least 1% of sales per share (under that the company is at break-even, and growth from it is not a rate).
    Returns (ok, the reason when not)."""
    for w, v, dip in parts:
        if w < rule["minWeight"]: continue
        if v is None: return False, "a year of the base is not on file"
        if v <= 0: return False, "the base holds a loss: growth from it is not a rate"
        if dip: return False, "the base holds a one-off year (more than 40% under the years either side of it)"
    if base is None or base <= 0: return False, "the base is a loss"
    if sales_ps and base < rule["baseShareOfValue"] * sales_ps: return False, "the base is under 1% of sales: next to break-even, growth from it is not a rate"
    return True, None
def calendarize(a, e1, e2, e3, w):
    """Last twelve months, next twelve, and the twelve after, from fiscal years: w = the share of e1's year still to run."""
    bl = lambda x, y: None if x is None or y is None else w * x + (1 - w) * y
    return bl(a, e1), bl(e1, e2), bl(e2, e3)
def growth(now, base):
    return None if now is None or base is None or base <= 0 or now <= 0 else (now / base - 1) * 100
if __name__ == "__main__":
    C = json.load(open("comps-universe.json"))["names"]
    WT = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "../../../.."))
    REPORTED = json.load(open(WT + "/deliverables/20261003/comps-c5b/reporting-currency-fmp-2026-10-03.json"))["reported"]
    for r in L("filer_currency"): REPORTED.setdefault(r["ticker"], r["reported_currency"])
    est = collections.defaultdict(list); hist = collections.defaultdict(list); qh = collections.defaultdict(list); evs = collections.defaultdict(list); snaps = collections.defaultdict(list)
    for r in L("analyst_estimates"): est[r["ticker"]].append(r)
    for r in L("fundamentals_history"): (hist if r["period"] == "FY" else qh)[r["ticker"]].append(r)
    for r in L("earnings_events"):
        if not r.get("superseded_at"): evs[r["ticker"]].append(r)
    for r in L("analyst_estimates_daily"): snaps[r["ticker"]].append(r)
    for v in hist.values(): v.sort(key=lambda r: r["fiscal_date"], reverse=True)
    for v in qh.values(): v.sort(key=lambda r: r["fiscal_date"])
    for v in est.values(): v.sort(key=lambda r: r["fiscal_date"])
    for v in evs.values(): v.sort(key=lambda r: r["date"])
    out = {}
    for t, c in C.items():
        if not c.get("ok"): out[t] = {"why": "the comps reader could not read it"}; continue
        o = {"currency": REPORTED.get(t) or "USD"}; foreign = o["currency"] != "USD"; H = hist.get(t, []); E = est.get(t, []); Q = qh.get(t, [])
        a = c["after"]; own = a.get("own") or {}
        # ---- cash: free cash flow ÷ market value = FCF margin ÷ price-to-sales, both from the comps reader
        ps = ((a.get("rows") or {}).get("ps") or {}).get("own"); fam = c.get("family")
        if fam in ("BANKS", "INSURANCE"): o["fcf_yield"] = None; o["fcf_why"] = "a bank or an insurer: free cash flow is not a yardstick for it"
        elif own.get("fcfm") is None or not ps or ps <= 0: o["fcf_yield"] = None; o["fcf_why"] = "no free cash flow or no sales multiple on file"
        else: o["fcf_yield"] = round(own["fcfm"] / ps, 2); o["fcf_why"] = None
        if not H: o["why"] = "no reported fiscal year on file"; out[t] = o; continue
        last = H[0]; fd0 = P(last["fiscal_date"])
        fut = [e for e in E if (P(e["fiscal_date"]) - fd0).days > 60]
        if len(fut) < 2: o["why"] = "fewer than two forward estimate years on file"; out[t] = o; continue
        e1, e2 = fut[0], fut[1]; e3 = fut[2] if len(fut) > 2 else None
        if not (300 <= (P(e1["fiscal_date"]) - fd0).days <= 430): o["why"] = f"the first estimate year ({e1['fiscal_date']}) does not follow the last reported year ({last['fiscal_date']})"; out[t] = o; continue
        w = max(0.0, min(1.0, (P(e1["fiscal_date"]) - TODAY).days / 365.25)); o["w_fy1"] = round(w, 3)
        # ---- the street's reported EPS per quarter end (the report that follows the quarter end inside 100 days)
        street = {}
        for q in Q:
            qd = P(q["fiscal_date"]); m = [e for e in evs.get(t, []) if e.get("eps_actual") is not None and 0 < (P(e["date"]) - qd).days <= 100]
            if m: street[q["fiscal_date"]] = m[0]["eps_actual"]
        qrow = lambda q: {"date": q["fiscal_date"], "eps_dil": q.get("eps_diluted"), "oi": q.get("operating_income"), "ni": q.get("net_income"), "shares": q.get("shares_dil") or ((q["net_income"] / q["eps_diluted"]) if q.get("eps_diluted") and q.get("net_income") else None)}
        fy0q = [qrow(q) for q in Q if fd0 - d.timedelta(days=320) < P(q["fiscal_date"]) <= fd0]                    # the last reported year's four quarters (the one before them ended about 364 days earlier)
        fy1q = [qrow(q) for q in Q if fd0 < P(q["fiscal_date"]) <= P(e1["fiscal_date"])]                            # the year in progress, as far as reported
        # ---- EPS of the last reported year: the analysts' basis when its four quarters are on file, else the filed figure
        # EPS of the last reported year, on the analysts' footing wherever it can be had: (1) its four quarters as the street
        # scored them; (2) else the analysts' own row for that year (their last number for it, on the footing of the years
        # ahead); (3) else the filed figure (the year's row, or its four filed quarters when that row is empty).
        s4 = [street.get(q["date"]) for q in fy0q]; q4 = [q["eps_dil"] for q in fy0q]
        filed = last.get("eps_diluted") if last.get("eps_diluted") not in (None, 0) else (sum(q4) if len(q4) == 4 and all(x is not None for x in q4) else last.get("eps_diluted"))
        same_year = [e for e in E if abs((P(e["fiscal_date"]) - fd0).days) <= 45 and e.get("est_eps_avg") not in (None, 0)]
        if len(fy0q) == 4 and all(x is not None for x in s4) and not foreign: a_eps = sum(s4); basis = "its four quarters as the street scored them"
        elif same_year: a_eps = same_year[0]["est_eps_avg"]; basis = "the analysts' own row for that year"
        else: a_eps = filed; basis = "the filed figure"
        o["fy0"] = {"date": last["fiscal_date"], "revenue": last.get("revenue"), "eps": a_eps, "eps_filed": filed, "basis": basis}
        for k, e in (("fy1", e1), ("fy2", e2), ("fy3", e3)):
            o[k] = None if e is None else {"date": e["fiscal_date"], "revenue": e.get("est_revenue_avg"), "eps": e.get("est_eps_avg"), "n": e.get("num_analysts_eps")}
        # ---- the one-off rule on the last reported year and on the year in progress
        clean0 = a_eps; clean1 = e1.get("est_eps_avg"); flags = []
        if foreign: o["one_off"] = {"why": f"reports in {o['currency']}: the street's per-share figures are not on the same footing as the filings, so the rule is not applied"}
        else:
            hq = [qrow(q) for q in Q][-RULE["historyQuarters"]:]
            y0 = year_one_offs(fy0q, street, a_eps, hq); y1 = year_one_offs(fy1q, street, e1.get("est_eps_avg"), hq) if fy1q else None
            # the last year is cleaned only when its EPS here is the filed (GAAP) figure or the street followed GAAP
            if y0["flagged"]: clean0 = y0["clean"]; flags.append(f"last year ({last['fiscal_date'][:4]}) carries about {y0['one_off_ps']:.2f} a share of one-off gains: clean base {y0['clean']:.2f}")
            if y1 and y1["flagged"]: clean1 = y1["clean"]; flags.append(f"this year's estimate ({e1['fiscal_date'][:4]}: {e1['est_eps_avg']:.2f}) carries about {y1['one_off_ps']:.2f} a share of one-off gains already reported: clean base {y1['clean']:.2f}")
            o["one_off"] = {"fy0": y0, "fy1": y1, "flagged": bool(flags), "words": flags}
        ee = lambda e: None if e is None else e.get("est_eps_avg"); er = lambda e: None if e is None else e.get("est_revenue_avg")
        # a foreign reporter's filed EPS and the analysts' EPS can be per share against per ADS: EPS growth only from estimate to estimate
        unit_ok = not foreign or (a_eps and ee(e1) and a_eps > 0 and ee(e1) > 0 and 0.4 <= ee(e1) / a_eps <= 2.5)
        Lr, Nr, N2r = calendarize(last.get("revenue"), er(e1), er(e2), er(e3), w)
        Le, Ne, N2e = calendarize(clean0 if unit_ok else None, clean1, ee(e2), ee(e3), w)
        Le_raw, Ne_raw, _ = calendarize(a_eps if unit_ok else None, ee(e1), ee(e2), ee(e3), w)
        if not unit_ok and w < 0.15: Le = clean1; Le_raw = ee(e1)                                                   # the year in progress is nearly all of the last twelve months
        o["rev_g1"] = growth(Nr, Lr); o["rev_g2"] = growth(N2r, Nr); o["eps_g1"] = growth(Ne, Le); o["eps_g2"] = growth(N2e, Ne); o["eps_g1_as_shown"] = growth(Ne_raw, Le_raw)
        o["eps_note"] = None if o["eps_g1"] is not None else ("no earnings in the last twelve months or the next" if (Le is not None and Ne is not None) else "the filed EPS and the analysts' EPS are not on the same footing" if not unit_ok else "no EPS on file")
        # ---- can growth be measured from these bases? (a loss, a one-off year or next to nothing cannot be grown from)
        price = a.get("price"); mcap = a.get("mcap"); prev = H[1].get("eps_diluted") if len(H) > 1 and not foreign else None
        shares = a.get("shares"); sps = (Lr / shares) if (not foreign and shares and Lr) else None; sps2 = (Nr / shares) if (not foreign and shares and Nr) else None   # sales per share, last and next twelve months
        dA = dip_year(prev, clean0, clean1) if unit_ok else False; d1 = dip_year(clean0 if unit_ok else None, clean1, ee(e2)); d2 = dip_year(clean1, ee(e2), ee(e3))
        o["dip_years"] = [y for y, dd in ((last["fiscal_date"][:4], dA), (e1["fiscal_date"][:4], d1), (e2["fiscal_date"][:4], d2)) if dd]
        if o["eps_g1"] is not None:
            ok, why = base_ok([(w, clean0, dA), (1 - w, clean1, d1)], Le, sps)
            if not ok: o["eps_g1_unranked"] = o["eps_g1"]; o["eps_g1"] = None; o["eps_note"] = why
        if o["eps_g2"] is not None:
            ok, why = base_ok([(w, clean1, d1), (1 - w, ee(e2), d2)], Ne, sps2)
            if not ok: o["eps_g2_unranked"] = o["eps_g2"]; o["eps_g2"] = None; o["eps_note2"] = why
        # sales: under 1% of market value is next to no sales yet — a venture bet, whose growth is from nothing
        # The measure is the comps reader's own price-to-sales on the sales already reported (above 100 = sales under 1% of
        # market value); where it has none, the last twelve months blended here against the market value.
        share = None
        if ps and ps > 0: share = 1 / ps
        elif not foreign and mcap and Lr is not None: share = Lr / mcap
        o["sales_share_of_value"] = None if share is None else round(share, 4)
        o["venture"] = bool(share is not None and share < RULE["baseShareOfValue"]) or bool(not foreign and Lr is not None and Lr <= 0)
        if o["venture"]:
            o["rev_g1_unranked"] = o["rev_g1"]; o["rev_g2_unranked"] = o["rev_g2"]; o["rev_g1"] = None; o["rev_g2"] = None
            o["venture_words"] = "its sales are under 1% of its market value: the price rests on what it may become, and growth from so small a base is not a rate"
        o["ntm_eps"] = Ne; o["ltm_eps"] = Le; o["ntm_rev"] = Nr; o["ltm_rev"] = Lr
        o["thin_estimates"] = bool(e1.get("num_analysts_eps") is not None and e1["num_analysts_eps"] < RULE["thinAnalysts"])
        # ---- revisions: the same twelve months in the oldest stored copy against the newest (joined on the fiscal year, ±45 days)
        S = snaps.get(t, []); asof = sorted({s["as_of_date"] for s in S})
        def copy(as_of, e, key):
            if e is None: return None
            m = [s for s in S if s["as_of_date"] == as_of and abs((P(s["fiscal_date"]) - P(e["fiscal_date"])).days) <= 45 and s.get(key) is not None]
            return m[0][key] if m else None
        rv = {"why": "fewer than two stored copies of the estimates"}
        if len(asof) >= 2:
            a0, a1 = asof[0], asof[-1]
            old_e = calendarize(None, copy(a0, e1, "eps_avg"), copy(a0, e2, "eps_avg"), None, w)[1]; new_e = calendarize(None, copy(a1, e1, "eps_avg"), copy(a1, e2, "eps_avg"), None, w)[1]
            old_r = calendarize(None, copy(a0, e1, "revenue_avg"), copy(a0, e2, "revenue_avg"), None, w)[1]; new_r = calendarize(None, copy(a1, e1, "revenue_avg"), copy(a1, e2, "revenue_avg"), None, w)[1]
            rv = {"from": a0, "to": a1, "days": (P(a1) - P(a0)).days, "copies": len(asof), "eps_pct": growth(new_e, old_e), "rev_pct": growth(new_r, old_r)}
            rv["reading"] = rv["eps_pct"] if rv["eps_pct"] is not None else rv["rev_pct"]; rv["on"] = "EPS" if rv["eps_pct"] is not None else "revenue" if rv["rev_pct"] is not None else None
            if rv["reading"] is None: rv["why"] = "the two copies do not both carry the year"
            elif rv["days"] < RULE["minRevisionDays"]: rv["short"] = rv["reading"]; rv["reading"] = None; rv["why"] = f"the stored copies are only {rv['days']} days apart: too short to set beside a 56-day change"
        o["revision"] = rv
        nxt = [e for e in evs.get(t, []) if P(e["date"]) > TODAY]; o["next_report"] = nxt[0]["date"] if nxt else None
        out[t] = o
    json.dump({"today": str(TODAY), "rule": RULE, "names": out}, open("fundamentals.json", "w"), indent=1)
    ok = [o for o in out.values() if "why" not in o]
    print("companies", len(out), "· with growth", len(ok), "· not read:", collections.Counter(o["why"].split("(")[0][:60] for o in out.values() if "why" in o).most_common())
    fl = {t: o["one_off"]["words"] for t, o in out.items() if o.get("one_off", {}).get("flagged")}
    print("ONE-OFF flagged:", len(fl)); [print("  ", t, w) for t, w in sorted(fl.items())]
    print("basis:", collections.Counter((o.get("one_off") or {}).get("fy0", {}).get("basis") for o in ok if "fy0" in (o.get("one_off") or {})))
    for t in "GOOGL AMZN MU WDC STX LRCX NVDA VST LLY NBIS BABA JPM".split():
        o = out.get(t, {}); f = lambda x: "—" if x is None else f"{x:+.0f}%"
        print(f"{t:6s} w {o.get('w_fy1')} rev {f(o.get('rev_g1'))} / {f(o.get('rev_g2'))} · eps {f(o.get('eps_g1'))} (as shown {f(o.get('eps_g1_as_shown'))}) / {f(o.get('eps_g2'))} · rev'n {f((o.get('revision') or {}).get('reading'))} on {(o.get('revision') or {}).get('on')} · fcf {o.get('fcf_yield')} · {o.get('eps_note') or ''}")
