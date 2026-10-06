#!/usr/bin/env python3
"""TR2 (6 Oct 2026) - real estate in plain numbers, and where the data-center REITs sit.

LOCAL FILES ONLY. Reads copies already in the repo; calls no network, no database, no API.
Python 3.9, standard library only. Writes ONE file: ../real-estate.json

Method for the correlations is CO1's (deliverables/20261006/cohort-proposal/tools/build.py):
daily log returns over the LAST 126 sessions of closes-6m-20261006.csv (127 closes -> 126 returns);
a name is "priced" when it has at least 123 of the 126 returns; a basket is the equal-weight mean of
its members' daily returns on the days every member has a return (build.py corr_mean_vs); the
correlation is Pearson. Beta = covariance(basket, fund) / variance(fund).

Nothing here measures a valuation level: the Hub holds no FFO, AFFO, NAV or cap-rate field.
"""
import csv, datetime, json, math, os, re

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)                                   # deliverables/20261006/tree-revision
REPO = os.path.abspath(os.path.join(OUT_DIR, "..", "..", ".."))   # the Hub worktree


def P(rel):
    return os.path.join(REPO, rel)


def J(rel):
    with open(P(rel), encoding="utf-8") as fh:
        return json.load(fh)


SRC = {
    "holdings": "deliverables/20260928/coverage-tree/data/holdings.json",
    "closes": "deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv",
    "profile": "deliverables/20261006/cohort-proposal/data/company_profile-20261006.json",
    "universe": "deliverables/20261006/cohort-proposal/data/universe-20261006.json",
    "proposal": "deliverables/20261006/cohort-proposal/proposal.json",
    "gics": "data/reference/sp500-gics.json",
    "spy_ssga": "data/reference/spy-holdings.json",
    "comps_template": "deliverables/20261001/comps-template/template.mjs",
    "comps_rows": "deliverables/20261001/comps-template/cohort.mjs",
    "comps_tab": "deliverables/20261001/comps-mechanic/tab.mjs",
    "hub_page": "index.html",
}

# ------------------------------------------------------------------ inputs
HOLD = J(SRC["holdings"])["data"]
UNI = J(SRC["universe"])
U = set(UNI["symbols"])
CP = {r["ticker"]: r for r in J(SRC["profile"])}
PROP = J(SRC["proposal"])
COH = {c["id"]: c for c in PROP["cohorts"]}
GICS = J(SRC["gics"])["members"]
SSGA = J(SRC["spy_ssga"])

NAMES = "EQIX DLR IRM AMT CCI SBAC PLD WELL O SPG PSA EXR VICI VTR CBRE RHP GDS".split()
FUNDS = ["XLRE", "VNQ", "IYR", "RSPR", "SPY"]
BASKETS = {                                             # the three real-estate cohorts, read from proposal.json
    "DC_PROPERTY": list(COH["DC_PROPERTY"]["members"]),
    "TOWERS": list(COH["TOWERS"]["members"]),
    "REITS": list(COH["REITS"]["members"]),
}
AI_BASKETS = {k: list(COH[k]["members"]) for k in ("AI_SERVERS_DC_KIT", "AI_POWERTRAIN", "NEOCLOUDS_MINERS")}
EXTRA = {"DC_PROPERTY_US3 (DLR EQIX IRM, no GDS)": ["DLR", "EQIX", "IRM"]}
SINGLES = ["EQIX", "DLR", "IRM", "GDS"]
TARGET_FUNDS = ["XLRE", "VNQ", "TLT", "IEF", "SPY", "XLK", "SMH", "XLU"]

# ------------------------------------------------------------------ returns (CO1 method)
with open(P(SRC["closes"]), newline="") as fh:
    rows = list(csv.reader(fh))
hdr = rows[0][1:]
body = rows[1:]
dates = [r[0] for r in body]
N_SESS = 126
tail = body[-N_SESS - 1:]                               # 127 closes -> 126 returns
col = {t: j + 1 for j, t in enumerate(hdr)}


def series(t):
    """126 daily log returns, None where a close is missing."""
    if t not in col:
        return None
    j = col[t]
    px = [float(r[j]) if r[j] else None for r in tail]
    out = []
    for a, b in zip(px[:-1], px[1:]):
        out.append(math.log(b / a) if (a and b and a > 0 and b > 0) else None)
    return out


RET = {}


def ret(t):
    if t not in RET:
        RET[t] = series(t)
    return RET[t]


def priced(t):
    r = ret(t)
    return r is not None and sum(1 for v in r if v is not None) >= N_SESS - 3


def basket(ts):
    """equal-weight mean of the members' daily returns, on days every member has one"""
    ts = [t for t in ts if priced(t)]
    if not ts:
        return None, []
    cols = [ret(t) for t in ts]
    out = []
    for i in range(N_SESS):
        vals = [c[i] for c in cols]
        out.append(sum(vals) / len(vals) if all(v is not None for v in vals) else None)
    return out, ts


def pair(a, b, lo=0, hi=N_SESS):
    xs, ys = [], []
    for i in range(lo, hi):
        if a[i] is not None and b[i] is not None:
            xs.append(a[i]); ys.append(b[i])
    return xs, ys


def mean(v):
    return sum(v) / len(v)


def corr(a, b, lo=0, hi=N_SESS):
    if a is None or b is None:
        return None
    xs, ys = pair(a, b, lo, hi)
    if len(xs) < 20:
        return None
    mx, my = mean(xs), mean(ys)
    sxy = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    sxx = sum((x - mx) ** 2 for x in xs); syy = sum((y - my) ** 2 for y in ys)
    return sxy / math.sqrt(sxx * syy) if sxx > 0 and syy > 0 else None


def beta(y, x):
    """slope of y on x: how many % y moves, on average, for a 1% move in x"""
    if y is None or x is None:
        return None
    xs, ys = pair(x, y)
    mx, my = mean(xs), mean(ys)
    sxx = sum((v - mx) ** 2 for v in xs)
    return sum((a - mx) * (b - my) for a, b in zip(xs, ys)) / sxx if sxx > 0 else None


def beta2(y, x1, x2):
    """two-factor least squares: y = a + b1*x1 + b2*x2 (x1 = the stock market, x2 = long bonds)"""
    if y is None or x1 is None or x2 is None:
        return None
    t = [(a, b, c) for a, b, c in zip(y, x1, x2) if a is not None and b is not None and c is not None]
    my, m1, m2 = mean([r[0] for r in t]), mean([r[1] for r in t]), mean([r[2] for r in t])
    s11 = sum((r[1] - m1) ** 2 for r in t); s22 = sum((r[2] - m2) ** 2 for r in t)
    s12 = sum((r[1] - m1) * (r[2] - m2) for r in t)
    s1y = sum((r[1] - m1) * (r[0] - my) for r in t); s2y = sum((r[2] - m2) * (r[0] - my) for r in t)
    det = s11 * s22 - s12 * s12
    if det == 0:
        return None
    return {"SPY": round((s1y * s22 - s2y * s12) / det, 3), "TLT": round((s2y * s11 - s1y * s12) / det, 3)}


def avg_pair_corr(ts):
    ts = [t for t in ts if priced(t)]
    if len(ts) < 3:
        return None
    c = [corr(ret(a), ret(b)) for i, a in enumerate(ts) for b in ts[i + 1:]]
    return sum(c) / len(c)


def r3(v):
    return None if v is None else round(v, 3)


# ------------------------------------------------------------------ PART 1a - weights in the funds
def weights_of(fund):
    """ticker -> weight %. Rows carrying the fund's own ticker are its cash / other lines (the file labels them
    that way); they are summed apart and are not a holding."""
    w, cash = {}, 0.0
    for h in HOLD[fund]["h"]:
        if h[1] is None:
            continue
        if h[0] == fund or not h[0]:
            cash += h[1]
        else:
            w[h[0]] = w.get(h[0], 0.0) + h[1]
    return w, cash


W, CASH = {}, {}
for f in FUNDS:
    W[f], CASH[f] = weights_of(f)
fund_meta = {f: {"rows_in_file": len(HOLD[f]["h"]), "holdings_reported_by_fund": HOLD[f].get("n"), "stock_rows": len(W[f]),
                 "weight_listed_pct": round(sum(W[f].values()), 3), "cash_or_other_rows_pct": round(CASH[f], 3),
                 "source": HOLD[f].get("source"), "updated": HOLD[f].get("updated")} for f in FUNDS}
weights_table = {}
for t in NAMES:
    row = {f: (round(W[f][t], 4) if t in W[f] else None) for f in FUNDS}
    ss = SSGA["holdings"].get(t)
    row["SPY_ssga_22Sep"] = round(ss["weight_pct"], 4) if ss else None
    weights_table[t] = row

DC_PURE = ["EQIX", "DLR"]                    # GICS sub-industry "Data Center REITs" (sp500-gics.json)
DC_ADJ = ["IRM"]                             # GICS "Other Specialized REITs"
TOW = ["AMT", "CCI", "SBAC"]
REITS = BASKETS["REITS"]


def share(fund):
    w = W[fund]
    tot = sum(w.values())
    s = lambda ts: round(sum(w.get(t, 0.0) for t in ts), 3)
    served = {t: v for t, v in w.items() if t in U}
    not_served = sorted(((t, v) for t, v in w.items() if t not in U), key=lambda kv: -kv[1])
    return {
        "listed_weight_pct": round(tot, 3), "cash_or_other_rows_pct": round(CASH[fund], 3),
        "data_centers_EQIX_DLR_pct": s(DC_PURE),
        "IRM_pct": s(DC_ADJ),
        "DC_PROPERTY_cohort_pct (EQIX+DLR+IRM+GDS)": s(BASKETS["DC_PROPERTY"]),
        "towers_AMT_CCI_SBAC_pct": s(TOW),
        "other_served_REITS_cohort_pct": s(REITS),
        "REITS_cohort_members_held": [t for t in REITS if t in w],
        "served_names": len(served), "holdings_in_file": len(w),
        "served_weight_pct": round(sum(served.values()), 3),
        "not_served_weight_pct": round(sum(v for _, v in not_served), 3),
        "not_served_names": len(not_served),
        "biggest_not_served": [{"ticker": t, "weight_pct": round(v, 3)} for t, v in not_served[:8]],
    }


fund_shares = {f: share(f) for f in ["XLRE", "VNQ", "IYR", "RSPR"]}
xl = fund_shares["XLRE"]
xlre_split = {
    "data_centers (EQIX + DLR)": xl["data_centers_EQIX_DLR_pct"],
    "IRM (records storage + data centers)": xl["IRM_pct"],
    "towers (AMT + CCI + SBAC)": xl["towers_AMT_CCI_SBAC_pct"],
    "everything else we serve (%d names)" % len(xl["REITS_cohort_members_held"]): xl["other_served_REITS_cohort_pct"],
    "not served by us (%d names)" % xl["not_served_names"]: xl["not_served_weight_pct"],
    "check_sum": round(xl["data_centers_EQIX_DLR_pct"] + xl["IRM_pct"] + xl["towers_AMT_CCI_SBAC_pct"]
                       + xl["other_served_REITS_cohort_pct"] + xl["not_served_weight_pct"], 3),
}

# ------------------------------------------------------------------ PART 1b - correlations and betas
subjects = {}
for k, ts in list(BASKETS.items()) + list(EXTRA.items()):
    b, used = basket(ts)
    subjects[k] = {"ret": b, "members": ts, "priced": used, "kind": "basket"}
for t in SINGLES:
    subjects[t] = {"ret": ret(t) if priced(t) else None, "members": [t], "priced": [t] if priced(t) else [], "kind": "single"}

targets = {}
for f in TARGET_FUNDS:
    targets[f] = {"ret": ret(f) if priced(f) else None, "what": "fund"}
for k, ts in AI_BASKETS.items():
    b, used = basket(ts)
    targets[k] = {"ret": b, "what": "AI cohort basket, %d of %d members priced" % (len(used), len(ts)), "members": used}
for k in ("REITS", "TOWERS", "DC_PROPERTY"):
    targets[k + " (basket)"] = {"ret": subjects[k]["ret"], "what": "our cohort basket", "members": subjects[k]["priced"]}

correlations, halves, betas = {}, {}, {}
for s, sv in subjects.items():
    correlations[s] = {}
    for tname, tv in targets.items():
        same = tname.split(" ")[0] == s
        correlations[s][tname] = None if same else r3(corr(sv["ret"], tv["ret"]))
    halves[s] = {tname: {"first_63": r3(corr(sv["ret"], targets[tname]["ret"], 0, 63)),
                         "last_63": r3(corr(sv["ret"], targets[tname]["ret"], 63, 126))}
                 for tname in ("REITS (basket)", "XLRE", "SMH", "SPY", "TLT", "AI_SERVERS_DC_KIT")
                 if tname.split(" ")[0] != s}
    betas[s] = {"to_TLT": r3(beta(sv["ret"], targets["TLT"]["ret"])),
                "to_IEF": r3(beta(sv["ret"], targets["IEF"]["ret"])),
                "to_SPY": r3(beta(sv["ret"], targets["SPY"]["ret"])),
                "to_SMH": r3(beta(sv["ret"], targets["SMH"]["ret"])),
                "two_factor_SPY_and_TLT": beta2(sv["ret"], targets["SPY"]["ret"], targets["TLT"]["ret"])}

basket_info = {}
for k, ts in list(BASKETS.items()) + list(EXTRA.items()) + list(AI_BASKETS.items()):
    used = [t for t in ts if priced(t)]
    mt = (COH.get(k) or {}).get("moves_together") or {}
    basket_info[k] = {"members": ts, "priced": used, "not_priced": [t for t in ts if t not in used],
                      "avg_pair_corr": r3(avg_pair_corr(ts)), "CO1_avg_pair_corr": mt.get("avg_pair_corr"),
                      "CO1_sector_avg_pair_corr": mt.get("sector_avg_pair_corr"), "CO1_verdict": mt.get("verdict"),
                      "parents": (COH.get(k) or {}).get("parents")}

context = {"TLT_vs_SPY": r3(corr(ret("TLT"), ret("SPY"))), "TLT_vs_IEF": r3(corr(ret("TLT"), ret("IEF"))),
           "SMH_vs_SPY": r3(corr(ret("SMH"), ret("SPY"))), "XLRE_vs_VNQ": r3(corr(ret("XLRE"), ret("VNQ"))),
           "XLRE_vs_SPY": r3(corr(ret("XLRE"), ret("SPY"))), "XLRE_vs_TLT": r3(corr(ret("XLRE"), ret("TLT"))),
           "XLRE_vs_SMH": r3(corr(ret("XLRE"), ret("SMH"))), "XLU_vs_TLT": r3(corr(ret("XLU"), ret("TLT"))),
           "XLRE_beta_to_TLT": r3(beta(ret("XLRE"), ret("TLT"))), "SPY_beta_to_TLT": r3(beta(ret("SPY"), ret("TLT")))}

# ------------------------------------------------------------------ PART 1c - labels
labels = {}
for t in NAMES:
    p = CP.get(t) or {}
    g = GICS.get(t) or {}
    labels[t] = {"name": p.get("name"), "served": t in U, "fmp_sector": p.get("sector"), "fmp_industry": p.get("industry"),
                 "market_cap_usd_bn": round(p["market_cap"] / 1e9, 1) if p.get("market_cap") else None,
                 "gics_sub_industry": g.get("gics_sub_industry"), "in_sp500_gics_list": bool(g),
                 "tree_cohorts": [c["id"] for c in PROP["cohorts"] if t in c["members"]]}

# ------------------------------------------------------------------ PART 2 - what the Hub does for REITs today
def text(rel):
    with open(P(rel), encoding="utf-8", errors="replace") as fh:
        return fh.read()


PATS = {"FFO (whole word)": r"\bFFO\b", "AFFO (whole word)": r"\bAFFO\b", "funds from operations": r"(?i)funds from operations",
        "REIT": r"REIT", "NAV (whole word)": r"\bNAV\b", "net asset value": r"(?i)net asset value", "cap rate": r"(?i)cap(italisation|italization)? rate"}
hub_page = text(SRC["hub_page"])
grep_index = {k: len(re.findall(p, hub_page)) for k, p in PATS.items()}
grep_scripts = {k: {} for k in PATS}
for fn in sorted(os.listdir(P("scripts"))):
    full = P(os.path.join("scripts", fn))
    if not os.path.isfile(full):
        continue
    s = text(os.path.join("scripts", fn))
    for k, p in PATS.items():
        n = len(re.findall(p, s))
        if n:
            grep_scripts[k][fn] = n
comps_files = [SRC["comps_template"], SRC["comps_rows"], SRC["comps_tab"], "deliverables/20261001/comps-mechanic/peers.mjs",
               "deliverables/20261001/comps-mechanic/read.mjs", "deliverables/20260930/comps-tab/comps-tab.mjs"]
grep_comps = {f: {k: len(re.findall(p, text(f))) for k, p in PATS.items()} for f in comps_files}

tmpl = text(SRC["comps_template"])
rules = re.findall(r'if \(/(.+?)/\.test\(s\)\) return "([^"]+)";', tmpl)          # the Hub's own sectorClass rules
prior = {m.group(1): m.group(2) for m in re.finditer(r'^\s*"?([a-z-]+)"?: (\{ pe_ttm.+?\}),', tmpl, re.M)}
rows_m = re.search(r"export const ROWS = \[(.+?)\];", text(SRC["comps_rows"]))
comps_rows = re.findall(r'"([a-z_]+)"', rows_m.group(1)) if rows_m else None


def sector_class(sector, industry):
    s = " ".join(x for x in (sector, industry) if x).lower()
    for rx, cls in rules:
        if re.search(rx, s):
            return cls
    return "default"


comps_class = {t: sector_class(labels[t]["fmp_sector"], labels[t]["fmp_industry"]) for t in NAMES}
hub_today = {
    "grep_index_html": grep_index,
    "grep_scripts": grep_scripts,
    "grep_comps_modules": grep_comps,
    "comps_valuation_rows (cohort.mjs ROWS)": comps_rows,
    "comps_weight_classes (template.mjs SECTOR_PRIOR keys)": sorted(prior),
    "comps_class_each_REIT_lands_in (template.mjs sectorClass on FMP sector + industry)": comps_class,
    "peer_rule (peers.mjs header, read not run)": "peers are kept when they share the FMP industry and sit inside a market-value band. EQIX, DLR, IRM, AMT, CCI and SBAC all carry the one FMP industry 'REIT - Specialty', so by that rule a data-center landlord's comparable set is filled with tower companies.",
    "non_operating_gate (index.html isNonOp)": "only funds (is_etf) and crypto are sent to the non-operating view; a REIT gets the ordinary COMPS tab.",
    "note": "sectorClass also reads the cohort name the comps set was built for, so a REIT opened from a cohort whose name contains e.g. 'hardware' is classed capital-intensive.",
    "finding": "The comps tab and its football field price every company on the same six rows (trailing P/E, forward P/E, EV/EBITDA, EV/sales, P/S, PEG). There is no real-estate class and no FFO, AFFO, NAV or cap-rate row or field; a REIT lands in a weight class by the accident of a word in its FMP industry label.",
}

# ------------------------------------------------------------------ write
n = N_SESS
out = {
    "what": "TR2 - real estate in plain numbers: weights of the REIT names in the sector funds, 126-session correlations and bond betas of the three real-estate cohorts and of EQIX / DLR / IRM, the labels, and what the Hub's comps do for REITs today. LOCAL FILES ONLY; nothing live was read.",
    "built_utc": datetime.datetime.utcnow().isoformat(timespec="seconds") + "Z",
    "status": "MEASURED from the local files named in 'sources'. No valuation multiple level is measured: the Hub holds no FFO, AFFO, NAV or cap-rate field.",
    "sources": SRC,
    "universe": {"count": UNI["count"], "sha256_12": UNI["universe_sha256"][:12]},
    "method": {"returns": "daily log returns, last 126 sessions (127 closes)", "window": {"sessions": n, "from": dates[-n], "to": dates[-1]},
               "priced_rule": "at least 123 of 126 returns", "basket": "equal-weight mean of members' daily returns (CO1 corr_mean_vs)",
               "correlation": "Pearson", "beta": "covariance with the fund / variance of the fund",
               "noise_floor": "with 126 days a correlation needs to be beyond about +/-%.2f to differ from zero at 95%%; two correlations closer than about 0.1 are not reliably different" % (1.96 / math.sqrt(n - 3)),
               "TLT_reading": "TLT = 20+ year Treasuries, IEF = 7-10 year. A POSITIVE correlation means the stock tends to rise on days bond prices rise, i.e. on days yields fall.",
               "holdings_dates": "fund weights are the 26/28 Sep 2026 pull; SPY second column is the SSgA file of 22 Sep 2026"},
    "labels": labels,
    "weights_pct": {"funds": fund_meta, "table": weights_table},
    "fund_shares": fund_shares,
    "xlre_split_pct": xlre_split,
    "baskets": basket_info,
    "correlations": correlations,
    "correlations_two_halves": halves,
    "correlations_two_halves_note": "the same window cut in two (first 63 sessions, last 63). With 63 days a correlation needs about +/-0.25 to differ from zero, and a change between halves needs about 0.35 to be reliable: read these as a drift, not a proof.",
    "betas": betas,
    "context": context,
    "hub_today": hub_today,
    "not_measured": ["price / FFO", "price / AFFO", "premium or discount to NAV", "implied cap rate and its gap to the 10-year Treasury yield",
                     "AFFO payout ratio", "same-store growth", "occupancy", "net debt / EBITDA for the REITs as a REIT-specific read",
                     "megawatts leased, backlog, renewal rent per kW, development yield"],
    "fields_needed_to_measure_REITs_properly": {
        "per company, quarterly + trailing 12 months": ["ffo_per_share (Nareit definition)", "affo_per_share (company-reported; also called core or normalized FFO)",
                                                       "real_estate_depreciation_amortization", "gains_on_property_sales", "recurring_capex (maintenance capital spending)",
                                                       "straight_line_rent_adjustment", "noi (net operating income)", "same_store_noi_growth_pct", "occupancy_pct",
                                                       "net_debt", "ebitda_re (EBITDA for real estate)", "weighted_avg_lease_term_years", "pct_debt_fixed_rate", "debt_maturities_next_3y"],
        "estimates": ["ffo_per_share_fwd (consensus)", "affo_per_share_fwd (consensus)", "nav_per_share (analyst estimate; not a reported number)"],
        "derived once the above exist": ["price_to_ffo", "price_to_affo (trailing and forward)", "premium_discount_to_nav_pct", "implied_cap_rate_pct",
                                        "cap_rate_minus_10y_treasury_pct", "affo_payout_ratio_pct", "net_debt_to_ebitda"],
        "market series": ["us_10y_treasury_yield (the 590 carries TLT and IEF, bond prices, not the yield itself)"],
        "data-center only": ["mw_leased_in_quarter", "backlog_signed_not_commenced_usd (and MW)", "renewal_cash_rent_change_pct", "rent_per_kw_month",
                             "development_pipeline_mw", "development_yield_pct", "capital_raised_equity_and_debt", "interconnection_revenue (EQIX)", "churn_pct"],
        "already held (Hub page selects them from company_profile)": ["dividend_per_share", "dividend_yield", "market_cap", "sector", "industry"],
    },
}
dst = os.path.join(OUT_DIR, "real-estate.json")
with open(dst, "w", encoding="utf-8") as fh:
    json.dump(out, fh, indent=1, sort_keys=False)
print("wrote", dst)

# ------------------------------------------------------------------ console summary
print("window", out["method"]["window"], "| universe", out["universe"])
print("\nWEIGHTS %")
print("  %-5s" % "" + "".join("%9s" % f for f in FUNDS) + "  SPY(SSgA)")
for t in NAMES:
    r = weights_table[t]
    print("  %-5s" % t + "".join("%9s" % ("-" if r[f] is None else "%.2f" % r[f]) for f in FUNDS) + "  %s" % ("-" if r["SPY_ssga_22Sep"] is None else "%.3f" % r["SPY_ssga_22Sep"]))
for f, v in fund_shares.items():
    print(" ", f, {k: v[k] for k in ("data_centers_EQIX_DLR_pct", "IRM_pct", "towers_AMT_CCI_SBAC_pct", "other_served_REITS_cohort_pct", "served_weight_pct", "not_served_weight_pct", "served_names", "holdings_in_file")})
print("  XLRE split", xlre_split)
print("\nCORRELATIONS")
tn = list(targets)
print("  %-40s" % "" + "".join("%8s" % x[:7] for x in tn))
for s in correlations:
    print("  %-40s" % s[:40] + "".join("%8s" % ("-" if correlations[s][x] is None else "%.2f" % correlations[s][x]) for x in tn))
print("\nBETAS")
for s in betas:
    print("  %-40s" % s[:40], betas[s])
print("\ncontext", context)
print("baskets", {k: (v["priced"], v["avg_pair_corr"], v["CO1_avg_pair_corr"]) for k, v in basket_info.items()})
print("\nHUB TODAY", json.dumps({k: hub_today[k] for k in hub_today if k not in ("grep_comps_modules",)}, indent=1)[:2600])
