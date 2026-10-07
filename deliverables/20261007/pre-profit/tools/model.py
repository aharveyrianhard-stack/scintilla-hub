# PP1 · THE PRE-PROFIT MODEL and THE DEBT READING — pure rules, no reads. Used by tools/assemble.py and tools/history.py
# and pinned by tests/pp1-pre-profit.test.mjs (through tools/rules-cli.py). Every number a rule uses is named here, once.
#
# WHO IS ON THE SHELF   A pre-profit company: no profit now and none expected next year.
#     A · NO PROFITS, NONE EXPECTED   a loss over the last four reported quarters, at the operating line or at the bottom
#                                     line, AND the analysts expect a loss (or print nothing) for the fiscal year in progress,
#                                     AND sales expected to grow 25% or more over the next twelve months ("high-growth");
#     V · NEXT TO NO SALES            the knockout's own venture rule (sales under 1% of market value).
#   NOT on the shelf, each listed with its reason:
#     · it made a profit over the last four quarters at both lines;
#     · it lost money on the filed figures but the analysts expect a profit this fiscal year on their own footing — the
#       knockout's comps can price it (its own rule: comps are not used only when there are no earnings, trailing OR expected);
#     · it HAD steady profits and lost them (an operating profit in three or more of the five fiscal years before);
#     · it is pre-profit but its sales are expected to grow under 25%: a loss-maker, not a high-growth play.
#
# WHAT IS MEASURED      Sales in dollars on ONE calendar window for every company (the knockout's own blend of fiscal
#   years): the last twelve months, the next twelve, the twelve after. Growth. Enterprise value ÷ next year's sales.
#   Gross margin, quarter by quarter. Cash and short-term investments. Cash going out per quarter and the quarters it
#   lasts. The build-out and who paid for it. Share count a year and two years back, and the shares still to come from
#   convertibles, options and awards. Net debt, against EBITDA where there is one and against next year's sales where
#   there is not, and EBITDA against the interest bill. How many analysts, and how far apart they stand.
#
# ONE SCORE             Seven parts, each 0…1, weighed as WEIGHTS says (percent of the vote, growth the largest). A part is
#   read against the shelf's own middle half the way the knockout reads a branch (0 at the shelf's 25th, 1 at its 75th,
#   a missing reading 0.5) — except where "none" is simply good: no funding gap, no net debt, not burning cash = 1.
#   GROWTH is the rate (next year twice the weight of the year after) counted in proportion to the dollars it lands on:
#   in full on the shelf's largest next-year sales, at half on its smallest (Alan: "revenue in dollar figures matters,
#   not only growth percentages"). With FEWER THAN FOUR ANALYSTS the two parts that rest on estimates — growth and
#   price — are not read and the name is LISTED, NOT RANKED (Alan: "if three analysts imply 26% down, we shouldn't
#   have discussed it"). The growth rate is read against the shelf's names with real sales (a rate from next to no
#   sales would stretch the scale). The score's two halves are kept beside it: PROMISE (growth, price, margin) and
#   FOOTING (cash, dilution, debt, how far the analysts agree).
#
# DEBT IN THE KNOCKOUT  Every company gets a LOAD 0…1 from the rating agencies' own bands (S&P Global Ratings, Corporate
#   Methodology, cash flow / leverage, standard volatility): net debt ÷ EBITDA 3× = "significant" begins (load 0),
#   5× = "highly leveraged" (load 1); EBITDA ÷ interest 6× (load 0) down to 2× (load 1). The heavier of the two counts.
#   A company with no EBITDA is read on net debt ÷ next year's sales through the same bands at a one-third margin
#   (1× sales = 3× EBITDA … 1.67× sales = 5× EBITDA). Banks and insurers are not read: debt is their raw material.
#   The load NEVER changes who passes round 2 on its own. It acts in the debate only: among a branch's finalists the
#   score is cut by MAX_CUT × load before they are ordered, and when two names are even — on fundamentals, or among
#   the finalists after that cut — the lighter load goes first (the knockout's "more washed out goes first" stays as
#   the last resort). So a load can cost a finalist its place by up to MAX_CUT plus the tie band, never more.
import math
WEIGHTS = {"growth": 30, "price": 15, "margin": 10, "money": 15, "dilution": 10, "debt": 10, "quality": 10}   # percent of the vote
SUB = {"growth": {"rate_next": 2, "rate_after": 1}, "margin": {"level": 6, "change": 4}, "money": {"runway": 7, "gap": 8},
       "dilution": {"shares_1y": 5, "overhang": 5}, "quality": {"analysts": 4, "spread_sales": 4, "spread_eps": 2}}      # points inside a part
PROMISE = ("growth", "price", "margin"); FOOTING = ("money", "dilution", "debt", "quality")       # what it may become · what it stands on
VENTURE_SHARE = 0.01                    # sales under 1% of market value (the knockout's own venture rule)
GROWTH_GATE = 25.0                      # "high-growth": sales expected to grow a quarter or more over the next twelve months
DOLLAR_FLOOR = 0.5                      # a growth rate on the shelf's smallest sales counts at half; on its largest, in full
ESTABLISHED_YEARS = 5; ESTABLISHED_PROFITS = 3
MARGIN_MIN_SALES = 25e6                 # under $25M of sales over four quarters a gross margin is noise
RUNWAY_CAP = 40.0                       # quarters shown and scored at most (ten years)
THIN_ANALYSTS = 4                       # fewer than four analysts on sales = thin (the estimates path's own cut)
BANDS = {"nd_ebitda": (3.0, 5.0), "cover": (6.0, 2.0), "mature_margin": 1.0 / 3.0}
MAX_CUT = 0.15                          # the most a full load takes off a finalist's score: 15 points, the weight of cash or of revisions
EVEN = 0.02; LOAD_EVEN = 0.25; TOP = 3  # the knockout's own tie band and finalist count; a load difference under 0.25 is no difference
NOT_READ = ("BANKS", "INSURANCE")       # the knockout's own families for which cash yield is not a yardstick either

# ------------------------------------------------------------------ small tools
def quartiles(values):
    """25th, 50th and 75th by straight-line interpolation (the knockout's own)."""
    v = sorted(x for x in values if x is not None and not (isinstance(x, float) and math.isnan(x)))
    if not v: return None
    def q(p):
        i = (len(v) - 1) * p; lo = int(i); hi = min(lo + 1, len(v) - 1)
        return v[lo] + (v[hi] - v[lo]) * (i - lo)
    return {"n": len(v), "q1": q(0.25), "med": q(0.5), "q3": q(0.75)}
def ramp(v, d, lower_is_better=False):
    """0 at the field's 25th, 1 at its 75th, straight between; None when the reading or the field is missing."""
    if v is None or d is None or d["n"] < 2: return None
    if d["q3"] <= d["q1"]: return 0.5
    t = max(0.0, min(1.0, (v - d["q1"]) / (d["q3"] - d["q1"])))
    return 1 - t if lower_is_better else t
def band(v, zero_at, one_at):
    """0 at `zero_at`, 1 at `one_at`, straight between, held outside (works in either direction)."""
    if v is None: return None
    if one_at == zero_at: return 0.0
    return max(0.0, min(1.0, (v - zero_at) / (one_at - zero_at)))
def total4(rows, key, start=0):
    """The sum of one line over four quarters in a row (rows newest first), or None when one is missing."""
    part = rows[start:start + 4]
    if len(part) < 4 or any(r.get(key) is None for r in part): return None
    return float(sum(r[key] for r in part))
def calendarize(a, e1, e2, e3, w):
    """Last twelve months, next twelve, and the twelve after, from fiscal years: w = the share of e1's year still to run (the knockout's own)."""
    bl = lambda x, y: None if x is None or y is None else w * x + (1 - w) * y
    return bl(a, e1), bl(e1, e2), bl(e2, e3)
def growth(now, base):
    return None if now is None or base is None or base <= 0 or now <= 0 else (now / base - 1) * 100

# ------------------------------------------------------------------ who is on the shelf
def classify(quarters, fiscal_years, venture=False, eps_next=None, growth_next=None):
    """quarters: the reported quarters newest first [{operating_income, net_income}] · fiscal_years: operating income of the
    completed fiscal years BEFORE the last four quarters, newest first · eps_next: the analysts' EPS for the fiscal year in
    progress (None when they print none) · growth_next: sales growth expected over the next twelve months, percent.
    Returns {tier: 'A' | 'V' | None, words, why_not}."""
    q4 = quarters[:4]
    if not q4: return {"tier": None, "words": None, "why_not": "no quarter on file"}
    oi4 = sum(r["operating_income"] for r in q4 if r.get("operating_income") is not None); ni4 = sum(r["net_income"] for r in q4 if r.get("net_income") is not None)
    losing = (oi4 <= 0) or (ni4 <= 0); short = "" if len(q4) == 4 else f" (only {len(q4)} quarter{'s' if len(q4) > 1 else ''} on file)"
    fy = [x for x in fiscal_years[:ESTABLISHED_YEARS] if x is not None]
    established = len(fy) >= ESTABLISHED_YEARS and sum(1 for x in fy if x > 0) >= ESTABLISHED_PROFITS
    if venture and not established: return {"tier": "V", "words": "next to no sales yet: under 1% of its market value", "why_not": None}
    if not losing: return {"tier": None, "words": None, "why_not": "made a profit over its last four quarters, at the operating line and the bottom line" + short}
    if established: return {"tier": None, "words": None, "why_not": f"had steady profits and lost them: an operating profit in {sum(1 for x in fy if x > 0)} of the {len(fy)} fiscal years before"}
    if eps_next is not None and eps_next > 0: return {"tier": None, "words": None, "why_not": "a loss on its filed figures, but the analysts expect a profit this fiscal year on their own footing: the knockout's comps can price it"}
    if growth_next is not None and growth_next < GROWTH_GATE: return {"tier": None, "words": None, "why_not": f"pre-profit, but its sales are expected to grow under {GROWTH_GATE:.0f}% over the next twelve months: a loss-maker, not a high-growth play"}
    which = "at the operating line and the bottom line" if (oi4 <= 0 and ni4 <= 0) else "at the operating line (a paper gain lifted the bottom line)" if oi4 <= 0 else "at the bottom line (operations made a profit; interest and other items took it)"
    return {"tier": "A", "words": f"a loss over its last four quarters {which}{short}, and none expected to end this fiscal year", "why_not": None}

# ------------------------------------------------------------------ the share count
MISSING_CLASS = 1.5                     # no cover count, and the vendor's own count is more than 1.5× the quarter's: a share class is missing from it
def shares_pick(tagged, text, weighted, quarter_end, implied=None):
    """The share count to price the company on: the newest count the company itself printed on a report's cover, when that
    is not older than the last quarter end; else the quarter's weighted average (an average: behind when shares are being issued).
    tagged / text: {total, as_of} or None · weighted: the last quarter's basic weighted count."""
    covers = [c for c in (tagged, text) if c and c.get("total") and c.get("as_of")]
    covers.sort(key=lambda c: c["as_of"], reverse=True)
    if covers and quarter_end and covers[0]["as_of"] >= quarter_end:
        c = covers[0]; return {"shares": float(c["total"]), "source": "cover", "as_of": c["as_of"], "classes": c.get("n_classes")}
    if weighted and implied and implied > MISSING_CLASS * weighted:
        return {"shares": None, "source": "not verified: the quarter's count looks like one share class of several", "as_of": quarter_end, "classes": None}
    if weighted: return {"shares": float(weighted), "source": "quarter average", "as_of": quarter_end, "classes": None}
    if covers: c = covers[0]; return {"shares": float(c["total"]), "source": "cover (older than the last quarter)", "as_of": c["as_of"], "classes": c.get("n_classes")}
    return {"shares": None, "source": None, "as_of": None, "classes": None}

# ------------------------------------------------------------------ cash, burn, runway, the gap
def runway(cash_sti, fcf_quarters):
    """fcf_quarters: free cash flow of the last four quarters, newest first (operating cash flow less the build-out).
    The pace is the faster of the last quarter's and the last year's average. Returns {burn_q, quarters, basis} —
    quarters None and basis 'not burning' when cash is coming in."""
    f = [x for x in fcf_quarters[:4] if x is not None]
    if not f or cash_sti is None: return {"burn_q": None, "quarters": None, "basis": "no cash-flow figures"}
    last = max(0.0, -f[0]); avg = max(0.0, -sum(f) / len(f)); burn = max(last, avg)
    if burn <= 0: return {"burn_q": 0.0, "quarters": None, "basis": "not burning"}
    return {"burn_q": burn, "quarters": min(RUNWAY_CAP, cash_sti / burn) if cash_sti > 0 else 0.0, "basis": "the last quarter's pace" if last >= avg else "the last year's average pace"}
def funding_gap(capex_plan, debt_due, operating_cf_year, cash_sti, market_value):
    """Alan, 2 Oct: "if projected capex isn't covered by cash, we assume there's going to be new dilution."
    Need = the build-out planned for the next twelve months + debt due inside them + the operating cash going out if
    operations lose cash. Have = cash and short-term investments + the operating cash coming in if operations bring it.
    Returns {need, have, gap, pct_of_value}: gap 0 when covered; pct = the gap as a share of market value (the dilution
    if it were all raised in shares at today's price)."""
    if capex_plan is None or cash_sti is None: return {"need": None, "have": None, "gap": None, "pct_of_value": None}
    ocf = operating_cf_year or 0.0
    need = abs(capex_plan) + max(0.0, debt_due or 0.0) + max(0.0, -ocf); have = max(0.0, cash_sti) + max(0.0, ocf)
    gap = max(0.0, need - have)
    return {"need": need, "have": have, "gap": gap, "pct_of_value": (gap / market_value * 100) if market_value and market_value > 0 else None}
def financing_mix(uses, operating_cf, net_debt_issued, net_stock_issued, other_financing):
    """Who paid for the last four quarters' build-out. uses = the build-out (and the operating cash going out, if any).
    Returns each source as a percent of the uses; 'cash on hand' is what is left (negative = cash was built up)."""
    if not uses or uses <= 0: return None
    src = {"operations": max(0.0, operating_cf or 0.0), "new debt": net_debt_issued or 0.0, "new shares": net_stock_issued or 0.0, "other financing": other_financing or 0.0}
    src["cash on hand"] = uses - sum(src.values())
    return {k: round(v / uses * 100, 1) for k, v in src.items()}

# ------------------------------------------------------------------ dilution
CLEAN_SPLITS = (2, 3, 4, 5, 6, 7, 8, 10, 15, 20, 25, 30, 40, 50); SPLIT_BAND = 0.12
def split_factor(shares, forward=False):
    """shares: filed share counts oldest → newest. A one-quarter FALL to within 12% of a clean ratio (a half, a tenth, a
    twentieth …) is read as a reverse split — a count cannot fall that way by buying shares back — and the factor returned
    puts the FIRST count on the last one's footing. A one-quarter RISE is left alone unless `forward` is asked for: among
    companies without profits a count that triples in a quarter is far more often shares sold (Sidus, USA Rare Earth)
    than a split, and reading it as a split would hide exactly the dilution being measured."""
    f = 1.0
    for a, b in zip(shares, shares[1:]):
        if not a or not b or a <= 0 or b <= 0: continue
        r = b / a
        for c in CLEAN_SPLITS:
            if forward and abs(r / c - 1) <= SPLIT_BAND: f *= c; break
            if abs(r * c - 1) <= SPLIT_BAND: f /= c; break
    return f
def share_change(now, then):
    return None if not now or not then or then <= 0 else (now / then - 1) * 100

# ------------------------------------------------------------------ debt
def leverage(net_debt, ebitda, interest, next_year_sales=None, family=None, pre_profit=False):
    """One company's leverage reading. ebitda = operating profit + depreciation over four quarters (no paper gains);
    interest = the interest bill over the same four. Returns {nd_ebitda, cover, nd_sales, load 0…1, basis, words}.
    load is None when it cannot or should not be read.
      a company with steady profits   the heavier of net debt ÷ EBITDA and EBITDA ÷ interest;
      a pre-profit company            net debt ÷ next year's sales (its EBITDA is next to nothing either side of zero,
                                      so a ratio to it says little); the other two are still given where EBITDA is positive;
      no EBITDA and not pre-profit    net debt ÷ next year's sales as well."""
    none = {"nd_ebitda": None, "cover": None, "nd_sales": None, "load": None, "basis": None}
    if family in NOT_READ: return {**none, "words": "a bank or an insurer: debt is its raw material, not read"}
    if net_debt is None: return {**none, "words": "no balance sheet on file"}
    o = dict(none); o["words"] = None
    if next_year_sales and next_year_sales > 0: o["nd_sales"] = net_debt / next_year_sales
    has_ebitda = ebitda is not None and ebitda > 0
    if has_ebitda and interest and interest > 0: o["cover"] = ebitda / interest
    if has_ebitda and net_debt > 0: o["nd_ebitda"] = net_debt / ebitda
    if net_debt <= 0: return {**o, "load": 0.0, "basis": "net cash", "words": "net cash: it holds more cash than it owes"}
    m = BANDS["mature_margin"]; on_sales = None if o["nd_sales"] is None else ("nd_sales", band(o["nd_sales"], BANDS["nd_ebitda"][0] * m, BANDS["nd_ebitda"][1] * m))
    on_profit = []
    if has_ebitda:
        on_profit.append(("nd_ebitda", band(o["nd_ebitda"], *BANDS["nd_ebitda"])))
        if o["cover"] is not None: on_profit.append(("cover", band(o["cover"], *BANDS["cover"])))
    loads = ([on_sales] if on_sales else on_profit) if (pre_profit or not has_ebitda) else on_profit
    if not loads: return {**o, "words": "net debt with no EBITDA and no sales estimate to set it against"}
    basis, load = max(loads, key=lambda x: x[1])
    return {**o, "load": load, "basis": basis}

# ------------------------------------------------------------------ estimates
def spread(high, low, avg):
    """(high − low) ÷ |average|, in percent; None when the average is zero or a figure is missing."""
    if high is None or low is None or avg is None or avg == 0: return None
    return (high - low) / abs(avg) * 100

# ------------------------------------------------------------------ the score
def growth_part(rate_next, rate_after, scale, sub=None):
    """Growth, 0…1: the rate (next year twice the year after) × how real the dollars are (DOLLAR_FLOOR on the shelf's
    smallest next-year sales, 1 on its largest). None when there is no rate to read."""
    sub = sub or SUB["growth"]; pairs = [(sub["rate_next"], rate_next), (sub["rate_after"], rate_after)]
    if all(v is None for _, v in pairs): return None
    rate = sum(w * v for w, v in pairs if v is not None) / sum(w for w, v in pairs if v is not None)
    return rate * (DOLLAR_FLOOR + (1 - DOLLAR_FLOOR) * (scale or 0.0))
def none_is_good(v, field, has_reading=True):
    """For readings where 'none' is simply good (no gap, no net debt): v <= 0 → 1; else ramped against the field of the
    names that DO carry one, heavier = worse."""
    if not has_reading or v is None: return None
    if v <= 0: return 1.0
    r = ramp(v, field, lower_is_better=True)
    return 0.5 if r is None else r * 0.75                                   # carrying any at all never scores above 0.75
def score_shelf(rows, weights=WEIGHTS, sub=SUB):
    """rows: [{t, g1, g2, sales_next, ev_sales, gm, gm_change, runway_q, burning, gap_pct, shares_1y, overhang, nd_sales,
    net_debt, analysts, spread_sales, spread_eps, venture}]. Returns the rows with `parts` (0…1 each), `sub` (each reading's
    0…1), `score`, `promise` and `footing` (the score's two halves), `n` parts read, `thin` (fewer than four analysts),
    `rank` and `ranked`: a name is ranked when it has estimates and they are not thin; the others are listed, never ranked."""
    col = lambda k, f=lambda r: True: [r.get(k) for r in rows if f(r)]
    lg = lambda v: None if v is None or v <= 0 else math.log10(v)
    real = lambda r: not r.get("venture")                                       # a rate from next to no sales would stretch the scale: the field for growth is the names with real sales
    F = {"g1": quartiles(col("g1", real)), "g2": quartiles(col("g2", real)), "dollars": quartiles([lg(r.get("sales_next")) for r in rows]), "ev_sales": quartiles([lg(r.get("ev_sales")) for r in rows]),
         "gm": quartiles(col("gm")), "gm_change": quartiles(col("gm_change")), "runway": quartiles(col("runway_q", lambda r: r.get("burning"))),
         "gap": quartiles([r.get("gap_pct") for r in rows if (r.get("gap_pct") or 0) > 0]), "shares_1y": quartiles(col("shares_1y")), "overhang": quartiles(col("overhang")),
         "nd_sales": quartiles([r.get("nd_sales") for r in rows if (r.get("nd_sales") or 0) > 0]), "analysts": quartiles(col("analysts")), "spread_sales": quartiles(col("spread_sales")), "spread_eps": quartiles(col("spread_eps"))}
    avg = lambda pairs: (sum(w * v for w, v in pairs if v is not None) / sum(w for w, v in pairs if v is not None)) if any(v is not None for _, v in pairs) else None
    out = []
    for r in rows:
        thin = r.get("analysts") is not None and r["analysts"] < THIN_ANALYSTS
        s = {"rate_next": ramp(r.get("g1"), F["g1"]), "rate_after": ramp(r.get("g2"), F["g2"]), "dollars": ramp(lg(r.get("sales_next")), F["dollars"]),
             "ev_sales": ramp(lg(r.get("ev_sales")), F["ev_sales"], True), "level": ramp(r.get("gm"), F["gm"]), "change": ramp(r.get("gm_change"), F["gm_change"]),
             "runway": (1.0 if r.get("burning") is False else ramp(r.get("runway_q"), F["runway"]) if r.get("burning") else None),
             "gap": none_is_good(r.get("gap_pct"), F["gap"], r.get("gap_pct") is not None), "shares_1y": ramp(r.get("shares_1y"), F["shares_1y"], True), "overhang": ramp(r.get("overhang"), F["overhang"], True),
             "nd_sales": (1.0 if (r.get("net_debt") is not None and r["net_debt"] <= 0) else none_is_good(r.get("nd_sales"), F["nd_sales"], r.get("nd_sales") is not None)),
             "analysts": ramp(r.get("analysts"), F["analysts"]), "spread_sales": ramp(r.get("spread_sales"), F["spread_sales"], True), "spread_eps": ramp(r.get("spread_eps"), F["spread_eps"], True)}
        p = {"growth": None if thin else growth_part(s["rate_next"], s["rate_after"], s["dollars"], sub["growth"]), "price": None if thin else s["ev_sales"],
             "margin": avg([(sub["margin"]["level"], s["level"]), (sub["margin"]["change"], s["change"])]), "money": avg([(sub["money"]["runway"], s["runway"]), (sub["money"]["gap"], s["gap"])]),
             "dilution": avg([(sub["dilution"]["shares_1y"], s["shares_1y"]), (sub["dilution"]["overhang"], s["overhang"])]), "debt": s["nd_sales"],
             "quality": avg([(sub["quality"]["analysts"], s["analysts"]), (sub["quality"]["spread_sales"], s["spread_sales"]), (sub["quality"]["spread_eps"], s["spread_eps"])])}
        n = sum(1 for v in p.values() if v is not None)
        score = sum(weights[k] * (0.5 if p[k] is None else p[k]) for k in weights) / float(sum(weights.values()))
        out.append({**r, "sub": s, "parts": p, "score": score, "n": n, "thin": bool(thin), "ranked": (not thin) and r.get("g1") is not None and r.get("ev_sales") is not None,
                    "promise": sum(weights[k] * (0.5 if p[k] is None else p[k]) for k in PROMISE) / float(sum(weights[k] for k in PROMISE)), "footing": sum(weights[k] * (0.5 if p[k] is None else p[k]) for k in FOOTING) / float(sum(weights[k] for k in FOOTING))})
    order = sorted([r for r in out if r["ranked"]], key=lambda r: (-r["score"], r["t"]))
    for k, r in enumerate(order): r["rank"] = k + 1
    for r in out:
        if not r["ranked"]: r["rank"] = None
    return {"rows": out, "order": [r["t"] for r in order], "field": F}

# ------------------------------------------------------------------ debt in the knockout
def debate(rows, loads, max_cut=MAX_CUT, even=EVEN, load_even=LOAD_EVEN, top=TOP, wide=False):
    """Round 2 of the knockout with the debt reading in, for ONE branch.
    rows: the knockout's own scored rows [{t, score, judged, pctl}] (rounds.score_branch(...)['rows']). loads: {t: load 0…1 or None}.
    The order starts as the knockout's (score, then ticker). ONE pass, top down, over pairs that are even on fundamentals
    (within `even`): the lighter load goes first when the loads differ by more than `load_even`; when they do not, the more
    washed out for itself goes first (the knockout's own rule). The upper half passes, the middle name included (unchanged).
    Then the debate: the first `top` that passed are ordered again on score − max_cut × load (see below). `wide=True`
    puts every name that passed into the debate instead, so a fourth name can take a finalist's place.
    With no loads either way returns exactly the knockout's own order and finalists."""
    L = lambda t: (loads.get(t) or 0.0)
    judged = [dict(r) for r in rows if r.get("judged")]
    order = sorted(judged, key=lambda r: (-r["score"], r["t"])); swaps = []
    i = 0
    while i < len(order) - 1:
        a, b = order[i], order[i + 1]
        if a["score"] - b["score"] < even:
            d = L(a["t"]) - L(b["t"])
            if d > load_even: order[i], order[i + 1] = b, a; swaps.append({"up": b["t"], "down": a["t"], "why": "debt"})
            elif abs(d) <= load_even and a.get("pctl") is not None and b.get("pctl") is not None and b["pctl"] < a["pctl"]: order[i], order[i + 1] = b, a; swaps.append({"up": b["t"], "down": a["t"], "why": "washed out"})
        i += 1
    half = (len(order) + 1) // 2
    for k, r in enumerate(order): r["rank"] = k + 1; r["passes"] = k < half; r["load"] = loads.get(r["t"]); r["cut"] = max_cut * L(r["t"]); r["debated"] = r["score"] - r["cut"]
    passed = [r for r in order if r["passes"]]
    fin = passed if wide else passed[:top]                                     # wide: every name that passed is in the debate, and the first three after the cut are the finalists
    before = [r["t"] for r in passed[:top]]; at = {r["t"]: k for k, r in enumerate(passed)}
    # the debate: first by the score after the cut; then ONE pass, top down, over pairs that are even after the cut —
    # the lighter load first, and where the loads are no different the order they already stood in (which holds the
    # knockout's own score order and its washed-out rule). With no loads this leaves the finalists exactly as they stood.
    fin = sorted(fin, key=lambda r: (-r["debated"], at[r["t"]]))
    i = 0
    while i < len(fin) - 1:
        a, b = fin[i], fin[i + 1]
        if a["debated"] - b["debated"] < even:
            d = L(a["t"]) - L(b["t"])
            if d > load_even or (abs(d) <= load_even and at[b["t"]] < at[a["t"]]): fin[i], fin[i + 1] = b, a
        i += 1
    fin = fin[:top]
    return {"order": [r["t"] for r in order], "passes": [r["t"] for r in order if r["passes"]], "finalists": [r["t"] for r in fin], "finalists_before_the_cut": before,
            "champion": fin[0]["t"] if fin else None, "swaps": swaps, "rows": {r["t"]: {"score": r["score"], "rank": r["rank"], "passes": r["passes"], "load": r["load"], "cut": r["cut"], "debated": r["debated"]} for r in order}}
