#!/usr/bin/env python3
"""TR2 (6 Oct 2026) - where packaged foods and the other consumer gaps go in the tree.

    python3 deliverables/20261006/tree-revision/tools/consumer_gaps.py      # from the worktree root

LOCAL FILES ONLY. Reads CO1's proposal, closes, profiles and gaps, TR1's weak areas, the S&P 500 GICS list, the SPY
weights and the 26/28 Sep fund holdings. Writes ONE file: deliverables/20261006/tree-revision/consumer-gaps.json.
Touches no database, no API, no other file. Python 3.9, standard library only.

METHOD (copied from CO1, deliverables/20261006/cohort-proposal/tools/build.py):
  - daily log returns over the LAST 126 sessions of closes-6m-20261006.csv (127 closes);
  - a name is "priced" when it has at least 123 of the 126 returns;
  - "moves together" = the average of every pair's correlation inside the group, on the sessions all members have;
  - the sector number = the same average over every served company FMP puts in that sector;
  - the random line = the 95th percentile of 150 random sets of the same size drawn from every priced company.
DIFFERENCES FROM CO1, all stated in the output:
  - CO1 drew its random sets from one running generator, so its random line depends on the order cohorts were tested.
    Here each size gets its own fixed seed (20261006 + size), so a re-run gives the same number. CO1's own number for
    the same size is printed beside it where CO1 tested that size.
  - a steadier random line from 2,000 draws is printed too (150 draws of three or four names is a noisy 95th percentile).
  - CO1 refuses to score fewer than three names. A pair is scored here as its ONE correlation and labelled a pair.
"""
import json, csv, math, os, random, collections, datetime

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)                                    # deliverables/20261006/tree-revision
REPO = os.path.abspath(os.path.join(OUT_DIR, "..", "..", ".."))
CO1 = os.path.join(REPO, "deliverables/20261006/cohort-proposal")
def J(*p): return json.load(open(os.path.join(*p)))

PATHS = {
    "proposal": "deliverables/20261006/cohort-proposal/proposal.json",
    "closes": "deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv",
    "company_profile": "deliverables/20261006/cohort-proposal/data/company_profile-20261006.json",
    "universe": "deliverables/20261006/cohort-proposal/data/universe-20261006.json",
    "moves_together": "deliverables/20261006/cohort-proposal/moves-together.json",
    "gaps": "deliverables/20261006/cohort-proposal/gaps.json",
    "weak_areas": "deliverables/20261006/tree-adopted/weak-areas.json",
    "holdings": "deliverables/20260928/coverage-tree/data/holdings.json",
    "spy": "data/reference/spy-holdings.json",
    "gics": "data/reference/sp500-gics.json",
}
PROPOSAL = J(REPO, PATHS["proposal"])
UNI = J(REPO, PATHS["universe"]); U = UNI["symbols"]; Uset = set(U)
CP = {r["ticker"]: r for r in J(REPO, PATHS["company_profile"])}
MOVES = J(REPO, PATHS["moves_together"])
GAPS = J(REPO, PATHS["gaps"])
WEAK = J(REPO, PATHS["weak_areas"])
HOLD = J(REPO, PATHS["holdings"])["data"]
SPYF = J(REPO, PATHS["spy"]); SPY = SPYF["holdings"]
GICSF = J(REPO, PATHS["gics"]); GICS = GICSF["members"]

def is_fund(t):
    r = CP.get(t); return (r is None) or bool(r.get("is_etf"))
COMPANIES = [t for t in U if not is_fund(t)]
sector_of = {t: CP[t]["sector"] for t in COMPANIES}
industry_of = {t: CP[t]["industry"] for t in COMPANIES}
def served(t): return t in Uset or t.replace("-", ".") in Uset or t.replace(".", "-") in Uset
def spy_w(t):
    return (SPY.get(t) or SPY.get(t.replace(".", "-")) or SPY.get(t.replace("-", ".")) or {}).get("weight_pct", 0.0)
def gics_of(t):
    return GICS.get(t) or GICS.get(t.replace("-", ".")) or GICS.get(t.replace(".", "-"))
def fund_w(fund, t):
    for h in HOLD.get(fund, {}).get("h", []):
        if h[0] == t or h[0] == t.replace("-", ".") or h[0] == t.replace(".", "-"): return h[1]
    return None

# ------------------------------------------------------------------ returns: last 126 sessions (CO1 method)
N_SESS = 126
_rows = list(csv.reader(open(os.path.join(REPO, PATHS["closes"]))))
_hdr = _rows[0][1:]; _body = _rows[1:]
_dates = [r[0] for r in _body]
_body = _body[-N_SESS - 1:]
NAN = float("nan")
RET = {}
for j, t in enumerate(_hdr):
    px = [(float(r[j + 1]) if r[j + 1] else NAN) for r in _body]
    RET[t] = [(math.log(px[i + 1] / px[i]) if (px[i] == px[i] and px[i + 1] == px[i + 1] and px[i] > 0 and px[i + 1] > 0) else NAN) for i in range(N_SESS)]
WINDOW = {"sessions": N_SESS, "from": _dates[-N_SESS], "to": _dates[-1]}
FIN = {t: sum(1 for v in r if v == v) for t, r in RET.items()}
def priced(t): return t in RET and FIN[t] >= N_SESS - 3
def _z(v):
    m = sum(v) / len(v); d = [x - m for x in v]; s = math.sqrt(sum(x * x for x in d))
    return [x / s for x in d] if s > 0 else None
ZFULL = {t: _z(RET[t]) for t in RET if FIN[t] == N_SESS}
_pc = {}
def _pair_full(a, b):
    k = (a, b) if a < b else (b, a)
    v = _pc.get(k)
    if v is None:
        za, zb = ZFULL[a], ZFULL[b]
        v = _pc[k] = sum(x * y for x, y in zip(za, zb))
    return v
def pair_matrix(ts):
    """pairwise correlations on the sessions every member has (CO1: rows with any gap are dropped for the whole set)"""
    if all(t in ZFULL and ZFULL[t] for t in ts):
        return {(a, b): _pair_full(a, b) for i, a in enumerate(ts) for b in ts[i + 1:]}
    ok = [i for i in range(N_SESS) if all(RET[t][i] == RET[t][i] for t in ts)]
    z = {t: _z([RET[t][i] for i in ok]) for t in ts}
    return {(a, b): sum(x * y for x, y in zip(z[a], z[b])) for i, a in enumerate(ts) for b in ts[i + 1:] if z[a] and z[b]}
def avg_pair_corr(ts, min_n=3):
    ts = [t for t in ts if priced(t)]
    if len(ts) < min_n or len(ts) < 2: return None, len(ts)
    pm = pair_matrix(ts)
    return sum(pm.values()) / len(pm), len(ts)
def corr_mean_vs(ts, fund):
    """correlation of the members' equal-weight daily return with one fund's daily return (CO1)"""
    ts = [t for t in ts if priced(t)]
    if len(ts) < 2 or not priced(fund): return None
    ok = [i for i in range(N_SESS) if all(RET[t][i] == RET[t][i] for t in ts) and RET[fund][i] == RET[fund][i]]
    m = _z([sum(RET[t][i] for t in ts) / len(ts) for i in ok]); f = _z([RET[fund][i] for i in ok])
    return sum(x * y for x, y in zip(m, f))
def percentile(vals, p):                      # numpy's default (linear) rule
    s = sorted(vals); k = (len(s) - 1) * p / 100.0; f = int(math.floor(k)); c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)
PRICED_COMPANIES = [t for t in COMPANIES if priced(t)]
_null = {}
def null95(n, draws=150):
    key = (n, draws)
    if key not in _null:
        rng = random.Random(20261006 + n + (0 if draws == 150 else 1000003))
        _null[key] = percentile([avg_pair_corr(rng.sample(PRICED_COMPANIES, n), min_n=2)[0] for _ in range(draws)], 95)
    return _null[key]
CO1_NULL = {}                                 # CO1's own random line by size, read from its output
for r in MOVES["proposed"] + MOVES["today"]:
    if r.get("null95_same_size") is not None: CO1_NULL[r["n_priced"]] = r["null95_same_size"]
def r3(v): return None if v is None else round(v, 3)

SECTOR_CORR = {}
for s in ("Consumer Defensive", "Consumer Cyclical", "Communication Services"):
    c, n = avg_pair_corr([t for t in PRICED_COMPANIES if sector_of[t] == s]); SECTOR_CORR[s] = {"avg_pair_corr": r3(c), "n": n}
STAPLES_SECTOR = SECTOR_CORR["Consumer Defensive"]["avg_pair_corr"]

def test(label, ts, home="Consumer Defensive", note=None):
    ts = list(ts); n_priced = len([t for t in ts if priced(t)])
    row = {"group": label, "members": ts, "n": len(ts), "n_priced": n_priced, "avg_pair_corr": None, "sector": home,
           "sector_avg_pair_corr": SECTOR_CORR[home]["avg_pair_corr"], "delta_vs_sector": None,
           "null95_same_size": None, "null95_co1_same_size": None, "null95_2000_draws": None, "kind": None, "verdict": None, "note": note}
    if n_priced <= 1:
        row["kind"] = "single name"; row["verdict"] = "ONE NAME: a single name is not a cohort. Nothing to measure."
        return row
    c, _n = avg_pair_corr(ts, min_n=2); sc = row["sector_avg_pair_corr"]
    row["avg_pair_corr"] = r3(c); row["delta_vs_sector"] = r3(c - sc)
    if n_priced == 2:
        row["kind"] = "pair"
        row["null95_2000_draws"] = r3(null95(2, 2000))
        row["verdict"] = ("A PAIR: one number, not a group test. The two move %.2f with each other; the sector's average pair is %.2f and 95%% of random pairs are below %.2f."
                          % (c, sc, null95(2, 2000)))
        return row
    row["kind"] = "group"
    n95 = null95(n_priced); row["null95_same_size"] = r3(n95); row["null95_co1_same_size"] = CO1_NULL.get(n_priced); row["null95_2000_draws"] = r3(null95(n_priced, 2000))
    beats_sector = c > sc; beats_null = c > n95
    row["verdict"] = "STRONGER than its sector" if (beats_sector and beats_null) else ("moves together, but no tighter than its sector" if beats_null else "no tighter than a random set of that size")
    row["verdict_same_on_2000_draws"] = (c > null95(n_priced, 2000)) == beats_null
    return row

# ------------------------------------------------------------------ 1 · STAPLES today, and the split by what they sell
co1 = {c["id"]: c for c in PROPOSAL["cohorts"]}
STAPLES_NOW = list(co1["STAPLES"]["members"])
staples_today = test("STAPLES today (CO1, all 16)", STAPLES_NOW)
staples_today["co1_reported"] = co1["STAPLES"]["moves_together"]
classification = []
for t in STAPLES_NOW:
    g = gics_of(t)
    classification.append({"ticker": t, "name": CP[t]["name"], "fmp_industry": industry_of[t], "gics_sub_industry": (g or {}).get("gics_sub_industry"),
                           "in_sp500": g is not None, "spy_weight_pct": round(spy_w(t), 3), "market_cap_bn": round((CP[t].get("market_cap") or 0) / 1e9, 1)})

SPLIT = [   # (id, label, what they sell, members). Members are SERVED names only.
    ("PACKAGED_FOODS", "PACKAGED FOODS", "FMP 'Food Confectioners' + 'Packaged Foods'; GICS 'Packaged Foods & Meats'", ["MDLZ", "BYND"]),
    ("BEVERAGES", "BEVERAGES", "FMP 'Beverages - Non-Alcoholic'; GICS 'Soft Drinks & Non-alcoholic Beverages'", ["KO", "PEP", "KDP", "MNST"]),
    ("HOUSEHOLD_PERSONAL", "HOUSEHOLD & PERSONAL PRODUCTS", "FMP 'Household & Personal Products'; GICS 'Household Products' + 'Personal Care Products'", ["PG", "CL", "KMB", "KVUE"]),
    ("TOBACCO", "TOBACCO", "FMP 'Tobacco'; GICS 'Tobacco'", ["MO", "PM"]),
    ("FOOD_DISTRIBUTION", "FOOD DISTRIBUTION", "FMP 'Food Distribution'; GICS 'Food Distributors'", ["SYY", "USFD"]),
    ("AGRI_PRODUCTS", "AGRICULTURAL PRODUCTS", "FMP 'Agricultural Farm Products'; GICS 'Agricultural Products & Services'", ["ADM"]),
    ("GROCERY (Kroger alone)", "GROCERY", "FMP 'Grocery Stores'; GICS 'Food Retail'", ["KR"]),
]
split_tests = []
for id_, label, sells, ms in SPLIT:
    r = test(label, ms); r["id"] = id_; r["what_they_sell"] = sells; split_tests.append(r)
ALT = [
    ("GROCERY & STAPLES RETAIL: Kroger with Walmart, Costco, Target", ["KR", "WMT", "COST", "TGT"], "the three big-box names are GICS 'Consumer Staples Merchandise Retail'; they sit in RETAIL today. This is the only way grocery becomes a group."),
    ("Walmart, Costco, Target without Kroger", ["WMT", "COST", "TGT"], "for comparison"),
    ("Agricultural inputs: ADM with Corteva and Deere", ["ADM", "CTVA", "DE"], "CTVA is the one FMP 'Agricultural Inputs' name we serve (it sits in CHEMICALS & BUILDING MATERIALS); DE is farm machinery"),
    ("Food producers: MDLZ with ADM and BYND", ["MDLZ", "ADM", "BYND"], "would fold agricultural products into packaged foods"),
    ("Food & beverage brands: MDLZ with the four drinks names", ["MDLZ", "KO", "PEP", "KDP", "MNST"], "would fold packaged foods into beverages"),
    ("Food distribution with Kroger", ["SYY", "USFD", "KR"], "would fold grocery into food distribution"),
    ("Household & personal with tobacco", ["PG", "CL", "KMB", "KVUE", "MO", "PM"], "for comparison"),
    ("The nine brand names (food, drinks, household)", ["MDLZ", "KO", "PEP", "KDP", "MNST", "PG", "CL", "KMB", "KVUE"], "for comparison"),
    ("STAPLES today without Beyond Meat", [t for t in STAPLES_NOW if t != "BYND"], "shows how much one name drags the sixteen"),
    ("STAPLES today without Beyond Meat and ADM", [t for t in STAPLES_NOW if t not in ("BYND", "ADM")], "the two names that move with nothing else here"),
]
alternatives = []
for label, ms, note in ALT:
    alternatives.append(test(label, ms, note=note))
# each of the 16: how closely it moves with each proposed group (average correlation with the group's other members)
GROUPS_FOR_FIT = {"PACKAGED_FOODS": ["MDLZ"], "BEVERAGES": ["KO", "PEP", "KDP", "MNST"], "HOUSEHOLD_PERSONAL": ["PG", "CL", "KMB", "KVUE"], "TOBACCO": ["MO", "PM"],
                  "FOOD_DISTRIBUTION": ["SYY", "USFD"], "big-box retail (WMT COST TGT)": ["WMT", "COST", "TGT"], "farm (CTVA DE)": ["CTVA", "DE"]}
fit = []
for t in STAPLES_NOW:
    row = {"ticker": t}
    for g, ms in GROUPS_FOR_FIT.items():
        others = [x for x in ms if x != t]
        row[g] = None if not others else round(sum(avg_pair_corr([t, x], min_n=2)[0] for x in others) / len(others), 2)
    best = max((v, k) for k, v in row.items() if k != "ticker" and v is not None)
    row["moves_most_with"] = best[1]; row["at"] = best[0]
    fit.append(row)

# ------------------------------------------------------------------ candidates (never members)
SOURCE_SP = "MEASURED: S&P 500 member (data/reference/sp500-gics.json, Wikipedia 24 Sep) with its SPY weight (data/reference/spy-holdings.json, SSgA 22 Sep)"
def fund_basis(t, funds):
    hits = [(f, fund_w(f, t)) for f in funds]; hits = [(f, w) for f, w in hits if w is not None]
    return hits
def sp_candidates(sub_industries):
    out = []
    for t, g in GICS.items():
        if g["gics_sub_industry"] in sub_industries and not served(t):
            out.append({"ticker": t, "name": g["name"], "in_sp500": True, "gics_sub_industry": g["gics_sub_industry"], "spy_weight_pct": round(spy_w(t), 3),
                        "basis": "S&P 500 member, GICS '%s', %.3f%% of the S&P 500" % (g["gics_sub_industry"], spy_w(t)), "source": SOURCE_SP})
    return sorted(out, key=lambda r: -r["spy_weight_pct"])
def other_candidates(rows, funds):
    """rows: (ticker, what it is). The ticker and what it sells are FROM MEMORY unless a local file names it; a fund weight, where found, is MEASURED."""
    out = []
    for t, what, named_in in rows:
        hits = fund_basis(t, funds)
        held = ", ".join("%s %.2f%%" % (f, w) for f, w in hits)
        src = []
        if named_in: src.append("named in %s" % named_in)
        if hits: src.append("MEASURED: held by %s (holdings.json, 26/28 Sep)" % held)
        src.append("what it sells: FROM MEMORY")
        if not hits and not named_in: src = ["FROM MEMORY entirely: in no local file"]
        out.append({"ticker": t, "name": None, "in_sp500": gics_of(t) is not None, "gics_sub_industry": None, "spy_weight_pct": None,
                    "basis": "%s%s" % (what, (" - held by " + held) if held else ""), "source": "; ".join(src),
                    "served_now": served(t)})
    return [r for r in out if not r["served_now"]]
STAPLES_FUNDS = ["XLP", "VDC", "IYK", "RSPS"]; DISC_FUNDS = ["XLY", "VCR", "XRT", "PEJ", "XHB", "ITB", "FDN"]
TH = "gaps.json themes_thin"; WK = "weak-areas.json (marked ESTIMATE there)"
CAND = {
    "PACKAGED_FOODS": sp_candidates({"Packaged Foods & Meats"}) + other_candidates([
        ("CAG", "Conagra: frozen and shelf foods", None), ("LW", "Lamb Weston: frozen potatoes", None), ("CPB", "Campbell's: soup and snacks", None),
        ("POST", "Post Holdings: cereal", None), ("PPC", "Pilgrim's Pride: chicken", None)], STAPLES_FUNDS),
    "BEVERAGES": sp_candidates({"Distillers & Vintners", "Soft Drinks & Non-alcoholic Beverages", "Brewers"}) + other_candidates([
        ("COKE", "Coca-Cola Consolidated: the bottler", None), ("TAP", "Molson Coors: beer", None), ("CELH", "Celsius: energy drinks", None),
        ("PRMB", "Primo Brands: bottled water", None), ("SAM", "Boston Beer", None)], STAPLES_FUNDS),
    "HOUSEHOLD_PERSONAL": sp_candidates({"Household Products", "Personal Care Products"}) + other_candidates([
        ("UL", "Unilever ADR: soap, food, personal care", "gaps.json themes_thin (Europe ADR row)"), ("ELF", "e.l.f. Beauty: cosmetics", None),
        ("SPB", "Spectrum Brands: home and pet products", None), ("ENR", "Energizer: batteries", None), ("COTY", "Coty: fragrance and cosmetics", None)], STAPLES_FUNDS),
    "TOBACCO": sp_candidates({"Tobacco"}) + other_candidates([
        ("BTI", "British American Tobacco ADR", None), ("TPB", "Turning Point Brands: Zig-Zag, nicotine pouches", None), ("UVV", "Universal Corp: leaf tobacco", None)], STAPLES_FUNDS),
    "FOOD_DISTRIBUTION": sp_candidates({"Food Distributors"}) + other_candidates([
        ("PFGC", "Performance Food Group: the third big food distributor", None), ("CHEF", "Chefs' Warehouse: restaurant supply", None),
        ("UNFI", "United Natural Foods: grocery wholesaler", None)], STAPLES_FUNDS),
    "AGRI_PRODUCTS": sp_candidates({"Agricultural Products & Services"}) + other_candidates([
        ("DAR", "Darling Ingredients: rendering and renewable fuel feedstock", None), ("INGR", "Ingredion: corn sweeteners and starches", None),
        ("CALM", "Cal-Maine: eggs", None), ("ANDE", "The Andersons: grain handling", None)], STAPLES_FUNDS),
    "STAPLES_RETAIL": sp_candidates({"Food Retail", "Consumer Staples Merchandise Retail"}) + other_candidates([
        ("BJ", "BJ's Wholesale: warehouse club", None), ("SFM", "Sprouts Farmers Market: grocer", None), ("ACI", "Albertsons: grocer", None),
        ("PSMT", "PriceSmart: warehouse clubs", None)], STAPLES_FUNDS + ["XRT"]),
}

# ------------------------------------------------------------------ 3 · the revised CONSUMER subtree
def moves_block(ts, home="Consumer Defensive"):
    t = test("x", ts, home); return {k: t[k] for k in ("n_priced", "avg_pair_corr", "sector_avg_pair_corr", "null95_same_size", "null95_2000_draws", "kind", "verdict")}
def fund_lines(ts, funds):
    out = []
    for f in funds:
        ws = [fund_w(f, t) for t in ts]; c = corr_mean_vs(ts, f)
        out.append({"fund": f, "served": f in Uset, "members_weight_in_fund_pct": round(sum(w for w in ws if w), 2), "members_held": sum(1 for w in ws if w),
                    "corr_members_vs_fund_6m": r3(c)})
    return out
NEW = [  # id, label, members (first home), second-home members, why, status
    ("PACKAGED_FOODS", "PACKAGED FOODS", ["MDLZ", "BYND"], [],
     "what they sell: branded food on the shelf. FMP 'Food Confectioners' + 'Packaged Foods'; GICS 'Packaged Foods & Meats'.",
     "PAIR - really one name today. Mondelez is the only S&P packaged-food name we serve; Beyond Meat is a $0.1bn stock that moves with nothing. Becomes a cohort when three of the candidates are admitted."),
    ("BEVERAGES", "BEVERAGES", ["KO", "PEP", "KDP", "MNST"], [],
     "what they sell: drinks. FMP 'Beverages - Non-Alcoholic'; GICS 'Soft Drinks & Non-alcoholic Beverages'. Alcohol (GICS 'Distillers & Vintners', none served) would join here.", "COHORT"),
    ("HOUSEHOLD_PERSONAL", "HOUSEHOLD & PERSONAL PRODUCTS", ["PG", "CL", "KMB", "KVUE"], [],
     "what they sell: soap, toothpaste, tissue, over-the-counter care. FMP 'Household & Personal Products'; GICS 'Household Products' + 'Personal Care Products'.", "COHORT"),
    ("TOBACCO", "TOBACCO", ["MO", "PM"], [],
     "what they sell: cigarettes and nicotine. FMP 'Tobacco'; GICS 'Tobacco'.", "PAIR - the S&P has only these two, so it stays a pair unless a non-S&P name is admitted."),
    ("FOOD_DISTRIBUTION", "FOOD DISTRIBUTION", ["SYY", "USFD"], [],
     "what they sell: food delivered to restaurants and canteens. FMP 'Food Distribution'; GICS 'Food Distributors'.", "PAIR - one more name (PFGC) makes it a cohort."),
    ("AGRI_PRODUCTS", "AGRICULTURAL PRODUCTS", ["ADM"], [],
     "what they sell: grain, oilseeds, ingredients - to food makers, not to shoppers. FMP 'Agricultural Farm Products'; GICS 'Agricultural Products & Services'.",
     "ONE NAME - a place in the tree, not a cohort. ADM moves with none of the other fifteen (see fit table), nor with Corteva and Deere, so it is not folded into anything."),
    ("STAPLES_RETAIL", "GROCERY & STAPLES RETAIL", ["KR"], ["WMT", "COST", "TGT"],
     "where staples are bought. FMP 'Grocery Stores' + 'Discount Stores'; GICS 'Food Retail' + 'Consumer Staples Merchandise Retail'.",
     "COHORT of four, three of them as a SECOND home (Walmart, Costco, Target stay in RETAIL). Kroger alone is one name."),
]
SUBS = {"PACKAGED_FOODS": {"Packaged Foods & Meats"}, "BEVERAGES": {"Soft Drinks & Non-alcoholic Beverages", "Distillers & Vintners"},
        "HOUSEHOLD_PERSONAL": {"Household Products", "Personal Care Products"}, "TOBACCO": {"Tobacco"}, "FOOD_DISTRIBUTION": {"Food Distributors"},
        "AGRI_PRODUCTS": {"Agricultural Products & Services"}, "STAPLES_RETAIL": {"Food Retail", "Consumer Staples Merchandise Retail"}}
staples_children = []
for id_, label, ms, second, why, status in NEW:
    allm = ms + second
    assert all(t in Uset for t in allm), ("not served", id_, allm)
    cands = CAND[id_]
    assert not any(served(c["ticker"]) for c in cands), ("a candidate is already served", id_)
    staples_children.append({
        "id": id_, "label": label, "kind": "cohort", "parents": ["STAPLES"], "path": "THE MARKET > CONSUMER > CONSUMER STAPLES > " + label,
        "members": allm, "n": len(allm), "first_home_members": ms, "second_home_members": second,
        "second_home_reason": None if not second else "GICS puts all four in Consumer Staples and XLP's two biggest holdings are WMT (%.2f%%) and COST (%.2f%%); the four move together %.2f. They keep their RETAIL row: they are also retailers." % (fund_w("XLP", "WMT"), fund_w("XLP", "COST"), avg_pair_corr(allm)[0]),
        "spine": why, "status": status, "moves_together": moves_block(allm),
        "reference_funds": ["XLP", "RSPS", "VDC"], "reference_fund_lines": fund_lines(allm, ["XLP", "RSPS", "VDC"]),
        "candidates": cands,
        "gics_sub_industries": sorted(SUBS[id_]),
        "sp500_names": len([t for t, g in GICS.items() if g["gics_sub_industry"] in SUBS[id_]]),
        "sp500_names_served": sorted(t for t, g in GICS.items() if g["gics_sub_industry"] in SUBS[id_] and served(t)),
        "sp500_weight_pct": round(sum(spy_w(t) for t, g in GICS.items() if g["gics_sub_industry"] in SUBS[id_]), 3),
    })
# where each of the 16 lands
landing = collections.defaultdict(list)
for c in staples_children:
    for t in c["first_home_members"]: landing[t].append(c["id"])
staples_moves = [{"ticker": t, "from": "STAPLES", "to": landing[t][0] if landing[t] else None, "also_in": [c["id"] for c in PROPOSAL["cohorts"] if t in c["members"] and c["id"] != "STAPLES"]} for t in STAPLES_NOW]
assert all(len(landing[t]) == 1 for t in STAPLES_NOW), "every one of the 16 must land exactly once"
assert sorted(landing) == sorted(STAPLES_NOW)

def keep(cid):
    c = co1[cid]
    return {"id": c["id"], "label": c["label"], "kind": "cohort", "parents": c["parents"], "members": c["members"], "n": c["n"], "status": "UNCHANGED from CO1/TR1",
            "moves_together": c["moves_together"], "reference_funds": c["reference_funds"], "candidates": []}
subtree = {
    "heading": {"id": "CONSUMER", "label": "CONSUMER", "kind": "heading", "parent": "MARKET"},
    "sub_heading": {"id": "STAPLES", "label": "CONSUMER STAPLES", "kind": "heading (was a cohort of 16)", "parent": "CONSUMER", "reference_funds": ["XLP", "RSPS", "VDC"],
                    "why": "STAPLES keeps its id and its place but stops holding names itself: it becomes a sub-heading, the way SEMICONDUCTORS sits under TECHNOLOGY. Its seven cohorts hold the names. XLP stays its line; RSPS (every name counted the same) is the fairer line for the small groups; VDC is a near-copy of XLP (0.98, TR1).",
                    "all_16_today": staples_today, "cohorts": staples_children},
    "cohorts_unchanged": [keep(c) for c in ("AUTOS_EV", "RETAIL", "TRAVEL_LEISURE", "RESTAURANTS", "MEDIA_TELECOM")],
    "second_parent_unchanged": [keep(c) for c in ("INTERNET_PLATFORMS", "HOUSING")],
    "waiting_not_nodes": [],
    "staples_moves": staples_moves,
}

# ------------------------------------------------------------------ 2 · every consumer gap already found, and where it goes
P_RETAIL = "CONSUMER > RETAIL & E-COMMERCE (US)"; P_TL = "CONSUMER > TRAVEL & LEISURE"; P_MT = "CONSUMER > MEDIA & TELECOM"; P_AUTO = "CONSUMER > AUTOS & EV"
P_HOUSE = "INDUSTRIAL + CONSUMER > HOUSING & HOME IMPROVEMENT"; P_NET = "SOFTWARE & INTERNET + CONSUMER > INTERNET & CONSUMER PLATFORMS"
def P_ST(x): return "CONSUMER > CONSUMER STAPLES > " + x
WAIT_APPAREL = "CONSUMER > RETAIL & E-COMMERCE (US) today (Nike's home); becomes CONSUMER > APPAREL & FOOTWEAR (new, id APPAREL_FOOTWEAR) once two of the candidates are admitted"
WAIT_LEISURE = "no cohort yet: we serve none. Recorded beside the CONSUMER heading as LEISURE GOODS (waiting, id LEISURE_GOODS); a node only once a name is admitted"
PLACE = {  # GICS sub-industry -> (cohort id, path, new?, why, extra non-S&P candidates)
    "Broadline Retail": ("RETAIL", P_RETAIL, False, "Amazon is already there; the next names are marketplaces", [("CPNG", "Coupang: Korean e-commerce", WK), ("ETSY", "Etsy: marketplace", WK)]),
    "Packaged Foods & Meats": ("PACKAGED_FOODS", P_ST("PACKAGED FOODS"), True, "a real group in the market (8 S&P names) where we serve one", None),
    "Automotive Retail": ("RETAIL", P_RETAIL, False, "O'Reilly is already there", [("KMX", "CarMax: used cars", WK)]),
    "Wireless Telecommunication Services": ("MEDIA_TELECOM", P_MT, False, "T-Mobile is already there with AT&T and Verizon", []),
    "Homebuilding": ("HOUSING", P_HOUSE, False, "D.R. Horton is already there; XHB and ITB are its lines and hold all three candidates", [("TOL", "Toll Brothers", TH), ("KBH", "KB Home", TH)]),
    "Apparel, Accessories & Luxury Goods": ("RETAIL -> APPAREL_FOOTWEAR", WAIT_APPAREL, True, "brands, not shops: a real group, but with one served name (Nike) it is not a cohort yet", [("ONON", "On Holding: running shoes", TH)]),
    "Specialized Consumer Services": ("INTERNET_PLATFORMS", P_NET, False, "not a real gap: the S&P has one name here (DoorDash) and we serve it", []),
    "Agricultural Products & Services": ("AGRI_PRODUCTS", P_ST("AGRICULTURAL PRODUCTS"), True, "ADM alone today; Bunge is its S&P twin", None),
    "Food Retail": ("STAPLES_RETAIL", P_ST("GROCERY & STAPLES RETAIL"), True, "Kroger with the big-box staples sellers", None),
    "Consumer Electronics": ("LEISURE_GOODS (waiting)", WAIT_LEISURE, True, "one S&P name (Garmin), none served", []),
    "Other Specialty Retail": ("RETAIL", P_RETAIL, False, "specialty shops; XRT holds both", []),
    "Food Distributors": ("FOOD_DISTRIBUTION", P_ST("FOOD DISTRIBUTION"), True, "not a gap by the S&P's count (it has one name, Sysco, and we serve it); we also serve US Foods", None),
    "Interactive Home Entertainment": ("INTERNET_PLATFORMS", P_NET, False, "not a real gap: the S&P has one name here (Take-Two) and we serve it, beside Roblox", []),
    "Homefurnishing Retail": ("HOUSING", P_HOUSE, False, "Williams-Sonoma furnishes homes; XHB, the housing line, holds it", []),
    "Casinos & Gaming": ("TRAVEL_LEISURE", P_TL, False, "DraftKings is already there (FMP 'Gambling, Resorts & Casinos'); casinos are resorts", []),
    "Distillers & Vintners": ("BEVERAGES", P_ST("BEVERAGES"), True, "drinks: alcohol joins the soft-drink names", [("TAP", "Molson Coors: beer", None), ("SAM", "Boston Beer", None)]),
    "Computer & Electronics Retail": ("RETAIL", P_RETAIL, False, "Best Buy is a shop; XRT holds it", []),
    "Distributors": ("RETAIL", P_RETAIL, False, "Genuine Parts sells car parts (NAPA): it sits with O'Reilly", []),
    "Publishing": ("MEDIA_TELECOM", P_MT, False, "News Corp is media; it sits with Fox", []),
    "Leisure Products": ("LEISURE_GOODS (waiting)", WAIT_LEISURE, True, "one S&P name (Hasbro), none served", []),
    "Footwear": ("RETAIL -> APPAREL_FOOTWEAR", WAIT_APPAREL, True, "Deckers makes shoes: it goes wherever Nike goes", []),
    "Automotive Parts & Equipment": ("AUTOS_EV", P_AUTO, False, "the cohort's spine already takes FMP 'Auto - Parts'", []),
}
CONSUMER_SECTORS = ("Consumer Discretionary", "Consumer Staples", "Communication Services")
weak_rank = {w["sub_industry"]: w["rank"] for w in WEAK["weak"]}
gap_rows = []
for g in GAPS["gics_sub_industries_thin"]:
    if g["gics_sector"] not in CONSUMER_SECTORS: continue
    si = g["gics_sub_industry"]; cid, path, new, why, extra = PLACE[si]
    sp = sp_candidates({si})
    for c in sp:
        c["held_by_served_funds"] = ["%s %.2f%%" % (f, w) for f, w in fund_basis(c["ticker"], STAPLES_FUNDS + DISC_FUNDS + ["XLC", "VOX", "RSPD", "RSPC"])]
    if extra is None:
        key = cid; others = [c for c in CAND[key] if not c["in_sp500"]]
    else:
        others = other_candidates(extra, STAPLES_FUNDS + DISC_FUNDS)
    gap_rows.append({"found_in": ["gaps.json gics_sub_industries_thin"] + (["weak-areas.json rank %d" % weak_rank[si]] if si in weak_rank else []),
                     "sub_industry": si, "gics_sector": g["gics_sector"], "share_of_sp500_pct": g["spy_weight_pct"], "sp500_names": g["sp500_names"],
                     "we_hold": g["we_hold"], "candidates_sp500_by_weight": sp, "candidates_outside_sp500": others,
                     "goes_to": {"cohort": cid, "path": "THE MARKET > " + path, "new_cohort": new, "why": why}})
assert len(gap_rows) == sum(1 for g in GAPS["gics_sub_industries_thin"] if g["gics_sector"] in CONSUMER_SECTORS)
theme_place = {
    "Homebuilders": [("HOUSING", "THE MARKET > " + P_HOUSE, "all five candidates")],
    "Apparel & luxury": [("RETAIL -> APPAREL_FOOTWEAR", "THE MARKET > " + WAIT_APPAREL, "all five candidates")],
    "Agriculture & food producers": [("PACKAGED_FOODS", "THE MARKET > " + P_ST("PACKAGED FOODS"), "TSN, HRL, GIS (they sell packaged food and meat)"),
                                     ("AGRI_PRODUCTS", "THE MARKET > " + P_ST("AGRICULTURAL PRODUCTS"), "BG (with ADM)"),
                                     ("CHEMICALS_BUILDING", "THE MARKET > MATERIALS & METALS > CHEMICALS & BUILDING MATERIALS", "CF, MOS (fertiliser: not consumer; they sit with Corteva)")],
    "Europe industrial & luxury ADRs": [("HOUSEHOLD_PERSONAL", "THE MARKET > " + P_ST("HOUSEHOLD & PERSONAL PRODUCTS"), "UL only (Unilever); the other eight names are not consumer and are not placed here")],
}
theme_rows = []
for t in GAPS["themes_thin"]:
    if t["theme"] in theme_place:
        theme_rows.append({"found_in": "gaps.json themes_thin", "theme": t["theme"], "we_hold": t["we_hold"],
                           "we_hold_where": {x: [c["id"] for c in PROPOSAL["cohorts"] if x in c["members"]] for x in t["we_hold"]},
                           "candidates": t["candidates"], "candidates_already_served": [x for x in t["candidates"] if served(x)], "spine": t["spine"],
                           "share_of_sp500_pct": None, "goes_to": [{"cohort": c, "path": p, "which": w} for c, p, w in theme_place[t["theme"]]]})
weak_rows = [{"found_in": "weak-areas.json", "rank": w["rank"], "sub_industry": w["sub_industry"], "share_of_sp500_pct": w["spy_weight_pct"], "we_hold": w["we_hold"], "also": w.get("also"),
              "candidates": [{"ticker": c["ticker"], "spy_weight_pct": c["spy_weight_pct"], "basis": c["basis"]} for c in w["candidates"]],
              "goes_to": PLACE[w["sub_industry"]][0], "path": "THE MARKET > " + PLACE[w["sub_industry"]][1]}
             for w in WEAK["weak"] if w["sector"] in CONSUMER_SECTORS]
subtree["waiting_not_nodes"] = [
    {"id": "APPAREL_FOOTWEAR", "label": "APPAREL & FOOTWEAR", "would_hang_under": "CONSUMER", "served_today": ["NKE"], "served_today_home": "RETAIL",
     "candidates": sp_candidates({"Apparel, Accessories & Luxury Goods", "Footwear"}) + other_candidates([("ONON", "On Holding: running shoes", TH)], DISC_FUNDS),
     "rule": "not a node today: with one served name it would be Nike under another label. Create it, and move Nike into it, when two of the candidates are admitted."},
    {"id": "LEISURE_GOODS", "label": "LEISURE GOODS", "would_hang_under": "CONSUMER", "served_today": [], "served_today_home": None,
     "candidates": sp_candidates({"Consumer Electronics", "Leisure Products"}),
     "rule": "not a node: no served name. Two S&P names in two one-name sub-industries; the smallest gap on the list."},
]

# ------------------------------------------------------------------ write
checks = {
    "staples_16_recomputed": staples_today["avg_pair_corr"], "staples_16_co1": co1["STAPLES"]["moves_together"]["avg_pair_corr"],
    "sector_recomputed": STAPLES_SECTOR, "sector_co1": next(s["avg_pair_corr"] for s in MOVES["sectors"] if s["sector"] == "Consumer Defensive"),
    "restaurants_recomputed": r3(avg_pair_corr(co1["RESTAURANTS"]["members"])[0]), "restaurants_co1": co1["RESTAURANTS"]["moves_together"]["avg_pair_corr"],
    "retail_recomputed": r3(avg_pair_corr(co1["RETAIL"]["members"])[0]), "retail_co1": co1["RETAIL"]["moves_together"]["avg_pair_corr"],
    "every_staples_member_lands_once": True, "staples_members": len(STAPLES_NOW), "new_cohorts_under_staples": len(staples_children),
    "member_rows_under_staples_after": sum(c["n"] for c in staples_children), "second_home_rows_added": sum(len(c["second_home_members"]) for c in staples_children),
    "xlp_weight_held_by_the_seven_groups_pct": round(sum(w for t, w in HOLD["XLP"]["h"] if t in {m for c in staples_children for m in c["members"]}), 2),
    "xlp_holdings": len(HOLD["XLP"]["h"]), "xlp_holdings_served": sum(1 for t, w in HOLD["XLP"]["h"] if served(t)),
    "sp500_staples_names": sum(1 for g in GICS.values() if g["gics_sector"] == "Consumer Staples"), "sp500_staples_names_served": sum(1 for t, g in GICS.items() if g["gics_sector"] == "Consumer Staples" and served(t)),
    "no_candidate_is_served": True, "every_member_is_served": True,
    "gap_rows_gics": len(gap_rows), "gap_rows_themes": len(theme_rows), "gap_rows_weak_areas": len(weak_rows),
}
assert checks["staples_16_recomputed"] == checks["staples_16_co1"] and checks["sector_recomputed"] == checks["sector_co1"], checks
pf = next(c for c in staples_children if c["id"] == "PACKAGED_FOODS")
out = {
    "what": "TR2 (6 Oct 2026): where packaged foods and the other consumer gaps go in the tree. A proposal from local files only; nothing is written to any table.",
    "built_utc": datetime.datetime.utcnow().replace(microsecond=0).isoformat() + "Z",
    "answer_packaged_foods": {
        "path": pf["path"],
        "served_today": pf["members"],
        "plain": "Packaged foods goes at CONSUMER > CONSUMER STAPLES > PACKAGED FOODS: Staples stops being one bag of 16 and becomes a sub-heading with seven groups by what the companies sell. Today that group holds Mondelez and Beyond Meat only (the S&P 500 has 8 packaged-food names worth %.3f%% of the index and we serve 1), so it is a place with one real name until Hershey, Kraft Heinz, General Mills and Tyson are admitted." % next(g["spy_weight_pct"] for g in GAPS["gics_sub_industries_thin"] if g["gics_sub_industry"] == "Packaged Foods & Meats"),
        "candidates_first_four": [c["ticker"] for c in pf["candidates"][:4]]},
    "method": {"window": WINDOW, "rule": "average pairwise correlation of daily log returns, last 126 sessions, companies only; STRONGER = above its sector's number AND above the 95th percentile of 150 random same-size sets (CO1, tools/build.py)",
               "random_line": "fixed seed per size (20261006 + size), 150 draws from the %d priced companies; CO1's own figure for the same size is shown as null95_co1_same_size; null95_2000_draws is a steadier figure" % len(PRICED_COMPANIES),
               "pairs_and_singles": "CO1 does not score fewer than three names. A pair is shown as its one correlation and called a pair; a single name gets no number.",
               "sector_numbers": SECTOR_CORR},
    "inputs": PATHS, "spy_as_of": SPYF.get("as_of"), "gics_fetched_utc": GICSF.get("fetched_utc"), "universe_count": len(U), "universe_sha256": UNI.get("universe_sha256"),
    "staples_today": {"members": STAPLES_NOW, "test": staples_today, "by_what_they_sell": classification,
                      "plain": "The 16 move %.2f with each other; every served Consumer Defensive company (19, which adds Walmart, Costco, Target) moves %.2f. CO1's rule calls that STRONGER, but the gap is %.3f: Staples is the sector under another name, not a group inside it." % (staples_today["avg_pair_corr"], STAPLES_SECTOR, staples_today["avg_pair_corr"] - STAPLES_SECTOR)},
    "split_tests": split_tests, "alternatives_tested": alternatives, "fit_of_each_of_the_16": fit,
    "gaps": {"gics_sub_industries": gap_rows, "themes": theme_rows, "weak_areas": weak_rows,
             "not_listed": ["gaps.json themes_thin 'Japan / Korea single names' (TM, SONY, HMC are consumer companies) is an international gap: it is placed by region, not here.",
                            "weak-areas.json 'skipped_above_the_eighth' has no consumer row (Multi-Sector Holdings, Agricultural & Farm Machinery).",
                            "Of the 22 sub-industry rows, 3 are not real gaps: the S&P has one name and we serve it (Specialized Consumer Services, Food Distributors, Interactive Home Entertainment)."]},
    "revised_consumer_subtree": subtree,
    "checks": checks,
    "from_memory": [
        "Every candidate OUTSIDE the S&P 500 list (%d of them under Staples): which company the ticker is and what it sells are from memory. Where a served fund holds it, that weight is measured and shown. In no local file at all: %s." % (sum(1 for v in CAND.values() for c in v if not c["in_sp500"]), ", ".join(c["ticker"] for v in CAND.values() for c in v if c["source"].startswith("FROM MEMORY entirely")) or "none"),
        "CPNG, ETSY, KMX come from TR1's weak-areas.json, which marks them ESTIMATE; TOL, KBH, ONON, UL from CO1's themes_thin hand list. None of these has a measured S&P weight.",
        "That GICS groups 'Packaged Foods & Meats' and 'Agricultural Products & Services' under one industry (Food Products) is from memory; the local file carries the sub-industry only.",
        "That PBJ (a food-and-beverage fund) exists and is not served is from memory; no local file has its holdings, so XLP / RSPS / VDC are the only lines offered.",
        "No candidate has a moves-together number: we hold no closes for names we do not serve. Whether Hershey, Kraft Heinz and the rest move together is NOT measured here.",
        "The placement of each gap (which cohort it goes to) is a judgement from what the company sells, backed where possible by a measured fund holding (shown per candidate).",
    ],
}
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, "consumer-gaps.json"), "w") as fh: json.dump(out, fh, indent=1)
print("wrote deliverables/20261006/tree-revision/consumer-gaps.json")

# ------------------------------------------------------------------ console
def line(r): return "%-58s n=%-2d corr=%-6s sector=%s null95=%s (co1 %s, 2000 draws %s) -> %s" % (r["group"][:58], r["n_priced"], r["avg_pair_corr"], r["sector_avg_pair_corr"], r["null95_same_size"], r["null95_co1_same_size"], r["null95_2000_draws"], r["verdict"])
print("window", WINDOW, "| priced companies", len(PRICED_COMPANIES)); print(line(staples_today)); print("SPLIT:")
for r in split_tests: print("  " + line(r))
print("ALTERNATIVES:")
for r in alternatives: print("  " + line(r))
print("FIT:")
for r in fit: print("  ", r)
print("SUBTREE (staples):")
for c in staples_children:
    print("  %-20s %-28s %s  S&P %d names (%d served) %.3f%%  cands: %s" % (c["id"], " ".join(c["members"]), c["moves_together"]["avg_pair_corr"], c["sp500_names"], len(c["sp500_names_served"]), c["sp500_weight_pct"], " ".join("%s%s" % (x["ticker"], "" if x["in_sp500"] else "~") for x in c["candidates"])))
    print("      lines:", [(l["fund"], l["members_weight_in_fund_pct"], l["corr_members_vs_fund_6m"]) for l in c["reference_fund_lines"]])
print("GAPS:")
for g in gap_rows:
    print("  %-40s %6.3f%% hold=%-10s sp=%s other=%s -> %s" % (g["sub_industry"][:40], g["share_of_sp500_pct"], ",".join(g["we_hold"]) or "-", " ".join("%s:%.3f" % (c["ticker"], c["spy_weight_pct"]) for c in g["candidates_sp500_by_weight"]), " ".join(c["ticker"] for c in g["candidates_outside_sp500"]), g["goes_to"]["cohort"]))
for t in theme_rows: print("  THEME", t["theme"], t["we_hold"], t["candidates"], "already served:", t["candidates_already_served"], "->", [x["cohort"] for x in t["goes_to"]])
for w in weak_rows: print("  WEAK", w["rank"], w["sub_industry"], "->", w["goes_to"])
print("OUTSIDE-S&P candidate sources:")
for k, v in CAND.items():
    for c in v:
        if not c["in_sp500"]: print("  ", k, c["ticker"], "|", c["source"])
print("checks", checks)
