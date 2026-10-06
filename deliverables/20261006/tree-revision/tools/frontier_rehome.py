#!/usr/bin/env python3
"""TR2 (6 Oct 2026) - the measured case for dissolving the FRONTIER heading.

Alan, 6 Oct: "the frontier - I don't even like the name, it just seemed like a consolidation of a
bunch of stuff". FRONTIER's four cohorts (SPACE, QUANTUM, AUTONOMY_EVTOL, DEFENCE_TECH) need real parents.

LOCAL FILES ONLY. Reads CO1's copies (proposal.json, the 6-month closes, the company profiles, the 590
universe) and the 26/28 Sep fund holdings file. Writes ONE file: ../frontier-rehome.json. No network,
no database, no numpy (Python 3.9 standard library only).

Method = CO1's tools/build.py, re-implemented without numpy:
  - daily log returns over the LAST 126 sessions of closes-6m-20261006.csv
  - a name is "priced" when it has at least 123 of the 126 returns
  - average pairwise correlation: priced companies only, days where every member has a return
  - equal-weight basket = the mean of the members' returns each day (days where every member has one)
  - null = 95th percentile (linear interpolation) of 150 random same-size sets of priced companies
Added here: RESIDUAL returns = what is left of a series after an ordinary-least-squares fit on IWM's
daily return (with intercept). These are small, high-beta names; a parent must not be chosen on shared
small-cap beta alone.

Run from the worktree root:
    python3 deliverables/20261006/tree-revision/tools/frontier_rehome.py
The output has no timestamp: the same inputs give the same bytes.
"""
import json, csv, math, random, os, collections

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)                                   # deliverables/20261006/tree-revision
ROOT = os.path.abspath(os.path.join(OUT_DIR, "..", "..", ".."))   # the worktree root
CO1 = os.path.join(ROOT, "deliverables/20261006/cohort-proposal")
P_PROPOSAL = os.path.join(CO1, "proposal.json")
P_MOVES = os.path.join(CO1, "moves-together.json")
P_CLOSES = os.path.join(CO1, "data/closes-6m-20261006.csv")
P_PROFILE = os.path.join(CO1, "data/company_profile-20261006.json")
P_UNIVERSE = os.path.join(CO1, "data/universe-20261006.json")
P_HOLD = os.path.join(ROOT, "deliverables/20260928/coverage-tree/data/holdings.json")
def J(p):
    with open(p) as fh: return json.load(fh)
def rel(p): return os.path.relpath(p, ROOT)
def r3(v): return None if v is None else round(v, 3)

FRONTIER = ["SPACE", "QUANTUM", "AUTONOMY_EVTOL", "DEFENCE_TECH"]
CANDIDATE_FUNDS = "ITA XLI VIS RSPN XLK VGT RSPT SMH IGV ARKX QTUM BOTZ PAVE JETS IYT XLY SPY QQQ IWM".split()
NAMED_COHORTS = ["DEFENCE_PRIMES", "AI_SERVERS_DC_KIT", "AI_ACCELERATORS", "SEMICAP_EDA", "ANALOG_RF_POWER", "AI_SOFTWARE_DATA",
                 "ROBOTICS_AUTOMATION", "TRANSPORT", "AUTOS_EV", "MACHINERY_CAPGOODS"]
EVTOL_MAKERS = ["JOBY", "ACHR", "EVTL", "EH"]      # the four aircraft makers; the rest of the cohort is ONDS (drones) and AUR (self-driving trucks)
NULL_DRAWS = 150
NULL_SEED = 20261006                               # CO1's seed. CO1 drew its sets in one long stream, so its draws differ from these.
N_SESS = 126
BETA_FUND = "IWM"

# ---------------------------------------------------------------- inputs
PROPOSAL = J(P_PROPOSAL)
MOVES = J(P_MOVES)
UNI = J(P_UNIVERSE)
U = UNI["symbols"]; Uset = set(U)
CP = {r["ticker"]: r for r in J(P_PROFILE)}
HOLD_FILE = J(P_HOLD)
HOLD = HOLD_FILE["data"]
def is_fund(t):
    r = CP.get(t)
    return (r is None) or bool(r.get("is_etf"))
COMPANIES = [t for t in U if not is_fund(t)]
sector_of = {t: CP[t]["sector"] for t in COMPANIES}
industry_of = {t: CP[t]["industry"] for t in COMPANIES}

# ---------------------------------------------------------------- returns (last 126 sessions), CO1's rule
with open(P_CLOSES) as fh: rows = list(csv.reader(fh))
hdr = rows[0][1:]; body = rows[1:]
dates_all = [r[0] for r in body]
body = body[-N_SESS - 1:]                           # 127 closes -> 126 returns
WINDOW = {"sessions": N_SESS, "first_return_date": body[1][0], "last_return_date": body[-1][0],
          "closes_file_first": dates_all[0], "closes_file_last": dates_all[-1], "closes_file_sessions": len(dates_all)}
def _f(v):
    try:
        x = float(v)
        return x if x > 0 else None
    except (TypeError, ValueError):
        return None
RET = {}
for j, t in enumerate(hdr):
    c = [_f(r[j + 1]) if j + 1 < len(r) else None for r in body]
    RET[t] = [math.log(c[i + 1] / c[i]) if (c[i] is not None and c[i + 1] is not None) else None for i in range(N_SESS)]
def n_finite(x): return sum(1 for v in x if v is not None)
def priced(t): return t in RET and n_finite(RET[t]) >= N_SESS - 3
PRICED_COMPANIES = [t for t in COMPANIES if priced(t)]

# ---------------------------------------------------------------- small statistics (no numpy)
def pearson(x, y):
    n = len(x)
    if n < 3: return None
    mx = sum(x) / n; my = sum(y) / n
    sxx = sum((a - mx) ** 2 for a in x); syy = sum((b - my) ** 2 for b in y)
    if sxx <= 0 or syy <= 0: return None
    return sum((a - mx) * (b - my) for a, b in zip(x, y)) / math.sqrt(sxx * syy)
def corr_series(a, b):
    """correlation of two daily series over the days both have a value"""
    if a is None or b is None: return None
    idx = [i for i in range(N_SESS) if a[i] is not None and b[i] is not None]
    return pearson([a[i] for i in idx], [b[i] for i in idx])
def ols_resid(y, x):
    """residual of y after an OLS fit on x (with intercept); returns (residual series, beta, r_squared)"""
    idx = [i for i in range(N_SESS) if y[i] is not None and x[i] is not None]
    n = len(idx)
    if n < 10: return None, None, None
    mx = sum(x[i] for i in idx) / n; my = sum(y[i] for i in idx) / n
    sxx = sum((x[i] - mx) ** 2 for i in idx); syy = sum((y[i] - my) ** 2 for i in idx)
    sxy = sum((x[i] - mx) * (y[i] - my) for i in idx)
    if sxx <= 0: return None, None, None
    b = sxy / sxx; a = my - b * mx
    out = [None] * N_SESS
    for i in idx: out[i] = y[i] - a - b * x[i]
    r2 = (sxy * sxy) / (sxx * syy) if syy > 0 else None
    return out, b, r2
def percentile(vals, q):
    v = sorted(vals); k = (len(v) - 1) * q / 100.0
    lo = int(math.floor(k)); hi = min(lo + 1, len(v) - 1)
    return v[lo] + (v[hi] - v[lo]) * (k - lo)

IWM = RET.get(BETA_FUND)
RES = {}; BETA = {}; R2 = {}
for t in RET:
    if t == BETA_FUND or not priced(t): continue
    res, b, r2 = ols_resid(RET[t], IWM)
    if res is not None: RES[t] = res; BETA[t] = b; R2[t] = r2
SPACES = {"raw": RET, "resid": RES}

# pair-correlation cache for names with a return on every one of the 126 days (listwise = all days for them)
_FULL = {k: {t: (n_finite(R[t]) == N_SESS) for t in R} for k, R in SPACES.items()}
_Z = {"raw": {}, "resid": {}}
_PC = {"raw": {}, "resid": {}}
def _z(space, t):
    z = _Z[space].get(t)
    if z is None:
        x = SPACES[space][t]; m = sum(x) / N_SESS; s = math.sqrt(sum((v - m) ** 2 for v in x))
        z = [(v - m) / s for v in x] if s > 0 else None
        _Z[space][t] = z if z is not None else False
    return z or None
def _pair_full(space, a, b):
    key = (a, b) if a < b else (b, a)
    c = _PC[space].get(key, 0)
    if c == 0:
        za = _z(space, a); zb = _z(space, b)
        c = None if (za is None or zb is None) else sum(p * q for p, q in zip(za, zb))
        _PC[space][key] = c
    return c
def pair_corrs(ts, space):
    """every pair's correlation, CO1-style: only the days on which EVERY member of the set has a return"""
    R = SPACES[space]
    ts = [t for t in ts if priced(t) and t in R]
    out = {}
    if all(_FULL[space][t] for t in ts):
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)): out[(ts[i], ts[j])] = _pair_full(space, ts[i], ts[j])
    else:
        ok = [i for i in range(N_SESS) if all(R[t][i] is not None for t in ts)]
        cols = {t: [R[t][i] for i in ok] for t in ts}
        for i in range(len(ts)):
            for j in range(i + 1, len(ts)): out[(ts[i], ts[j])] = pearson(cols[ts[i]], cols[ts[j]])
    return out, ts
def avg_pair_corr(ts, space="raw"):
    pc, ts = pair_corrs(ts, space)
    if len(ts) < 3: return None, len(ts)
    vals = [v for v in pc.values() if v is not None]
    return (sum(vals) / len(vals) if vals else None), len(ts)
_null_cache = {}
def null95(n, space="raw"):
    """95th percentile of 150 random same-size sets of priced companies. One fixed seed per (size, space)."""
    key = (n, space)
    if key not in _null_cache:
        rng = random.Random(NULL_SEED * 1000 + n)          # same sets for raw and residual at a given size
        pool = [t for t in PRICED_COMPANIES if t in SPACES[space]]
        vals = [avg_pair_corr(rng.sample(pool, n), space)[0] for _ in range(NULL_DRAWS)]
        _null_cache[key] = percentile([v for v in vals if v is not None], 95)
    return _null_cache[key]
def basket(ts):
    """equal-weight daily return of the priced company members; None on a day any member lacks a return"""
    ts = [t for t in ts if priced(t) and not is_fund(t)]
    if not ts: return None, ts
    out = []
    for i in range(N_SESS):
        vals = [RET[t][i] for t in ts]
        out.append(None if any(v is None for v in vals) else sum(vals) / len(vals))
    return out, ts
def resid(series):
    if series is None: return None
    return ols_resid(series, IWM)[0]

# ---------------------------------------------------------------- cohorts (CO1's tree; topic cohorts = everything that is not an index-layer fund set)
COH = {c["id"]: c for c in PROPOSAL["cohorts"]}
TOPIC = [c["id"] for c in PROPOSAL["cohorts"] if not c["id"].startswith("IDX_")]
missing_named = [c for c in NAMED_COHORTS + FRONTIER if c not in COH]
BASK = {}; BASK_RES = {}; BASK_MEMBERS = {}; BASK_BETA = {}
for cid in TOPIC:
    b, ms = basket(COH[cid]["members"])
    BASK[cid] = b; BASK_MEMBERS[cid] = ms
    if b is not None:
        res, beta, r2 = ols_resid(b, IWM)
        BASK_RES[cid] = res; BASK_BETA[cid] = (beta, r2)
    else:
        BASK_RES[cid] = None; BASK_BETA[cid] = (None, None)

# ---------------------------------------------------------------- 0 · do we reproduce CO1?
SECTOR_FUND = {"Technology": "XLK", "Financial Services": "XLF", "Healthcare": "XLV", "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP", "Energy": "XLE",
               "Industrials": "XLI", "Basic Materials": "XLB", "Utilities": "XLU", "Real Estate": "XLRE", "Communication Services": "XLC"}
sector_corr = {}; sector_corr_res = {}
for s in SECTOR_FUND:
    ts = [t for t in PRICED_COMPANIES if sector_of[t] == s]
    sector_corr[s] = avg_pair_corr(ts, "raw"); sector_corr_res[s] = avg_pair_corr(ts, "resid")
co1_sector = {r["sector"]: r for r in MOVES["sectors"]}
repro_rows = []; worst = 0.0
for cid in TOPIC:
    mt = COH[cid].get("moves_together") or {}
    mine, n = avg_pair_corr([t for t in COH[cid]["members"] if not is_fund(t)], "raw")
    theirs = mt.get("avg_pair_corr")
    d = None if (mine is None or theirs is None) else abs(mine - theirs)
    if d is not None: worst = max(worst, d)
    repro_rows.append({"cohort": cid, "co1_avg_pair_corr": theirs, "recomputed": r3(mine), "abs_diff": r3(d), "n_priced": n, "co1_n_priced": mt.get("n_priced")})
sec_rows = []; worst_sec = 0.0
for s, (v, n) in sector_corr.items():
    theirs = co1_sector.get(s, {}).get("avg_pair_corr")
    d = None if theirs is None else abs(v - theirs)
    if d is not None: worst_sec = max(worst_sec, d)
    sec_rows.append({"sector": s, "co1_avg_pair_corr": theirs, "recomputed": r3(v), "abs_diff": r3(d), "n_priced": n, "co1_n_priced": co1_sector.get(s, {}).get("n_priced"),
                     "recomputed_on_iwm_residuals": r3(sector_corr_res[s][0])})
reproduction = {
    "what": "CO1's numbers recomputed here without numpy. Each cohort KEEPS its CO1 number; this only proves the method is the same.",
    "window_matches_co1": (MOVES["window"]["from"] == WINDOW["first_return_date"] and MOVES["window"]["to"] == WINDOW["last_return_date"] and MOVES["window"]["sessions"] == N_SESS),
    "co1_window": MOVES["window"],
    "cohorts_checked": sum(1 for r in repro_rows if r["abs_diff"] is not None),
    "largest_abs_diff_all_topic_cohorts": round(worst, 4),
    "largest_abs_diff_sectors": round(worst_sec, 4),
    "reproduced_to_0_01": bool(worst <= 0.01 and worst_sec <= 0.01),
    "the_four_plus_primes": [r for r in repro_rows if r["cohort"] in FRONTIER + ["DEFENCE_PRIMES"]],
    "sectors": sec_rows,
    "all_topic_cohorts": repro_rows,
}

# ---------------------------------------------------------------- 1 · each basket vs each candidate parent fund (raw and IWM-residual)
absent_funds = [f for f in CANDIDATE_FUNDS if not priced(f)]
FUND_RES = {f: (None if f == BETA_FUND else RES.get(f)) for f in CANDIDATE_FUNDS}
vs_funds = {}
for cid in FRONTIER:
    out = []
    for f in CANDIDATE_FUNDS:
        if not priced(f):
            out.append({"fund": f, "in_closes_file": False, "corr_raw": None, "corr_resid": None}); continue
        out.append({"fund": f, "in_closes_file": True, "corr_raw": r3(corr_series(BASK[cid], RET[f])),
                    "corr_resid": None if f == BETA_FUND else r3(corr_series(BASK_RES[cid], FUND_RES[f])),
                    "fund_iwm_beta": None if f == BETA_FUND else r3(BETA.get(f))})
    raw_rank = sorted([r for r in out if r["corr_raw"] is not None], key=lambda r: -r["corr_raw"])
    res_rank = sorted([r for r in out if r["corr_resid"] is not None], key=lambda r: -r["corr_resid"])
    vs_funds[cid] = {"basket_members_priced": BASK_MEMBERS[cid], "members_not_priced": [t for t in COH[cid]["members"] if t not in BASK_MEMBERS[cid]],
                     "basket_iwm_beta": r3(BASK_BETA[cid][0]), "basket_iwm_r_squared": r3(BASK_BETA[cid][1]),
                     "closest_raw": [r["fund"] for r in raw_rank[:5]], "closest_resid": [r["fund"] for r in res_rank[:5]],
                     "funds": out}

# ---------------------------------------------------------------- 2 · each basket vs every other topic cohort's basket (raw and residual)
def cohort_pair(a, b):
    shared = sorted(set(BASK_MEMBERS[a]) & set(BASK_MEMBERS[b]))
    row = {"cohort": b, "label": COH[b]["label"], "parents_today": COH[b]["parents"], "n_priced": len(BASK_MEMBERS[b]),
           "corr_raw": r3(corr_series(BASK[a], BASK[b])), "corr_resid": r3(corr_series(BASK_RES[a], BASK_RES[b])), "shared_members": shared}
    if shared:                                              # a shared name inflates the number: also give it with the shared names taken out of the OTHER basket
        ob, oms = basket([t for t in BASK_MEMBERS[b] if t not in shared])
        row["corr_raw_ex_shared"] = r3(corr_series(BASK[a], ob)) if oms else None
        row["corr_resid_ex_shared"] = r3(corr_series(BASK_RES[a], resid(ob))) if oms else None
    return row
vs_cohorts = {}
for cid in FRONTIER:
    allr = [cohort_pair(cid, o) for o in TOPIC if o != cid and BASK[o] is not None]
    def key_raw(r): return -(r.get("corr_raw_ex_shared", r["corr_raw"]) if r.get("corr_raw_ex_shared", r["corr_raw"]) is not None else -9)
    def key_res(r): return -(r.get("corr_resid_ex_shared", r["corr_resid"]) if r.get("corr_resid_ex_shared", r["corr_resid"]) is not None else -9)
    vs_cohorts[cid] = {"ranking_note": "ranked on the number with shared members removed, where a name sits in both cohorts",
                       "closest8_raw": sorted(allr, key=key_raw)[:8], "closest8_resid": sorted(allr, key=key_res)[:8],
                       "named": [next(r for r in allr if r["cohort"] == n) for n in NAMED_COHORTS if n in COH and n != cid],
                       "rank_of_named_raw": {n: 1 + [r["cohort"] for r in sorted(allr, key=key_raw)].index(n) for n in NAMED_COHORTS if n in COH and n != cid},
                       "rank_of_named_resid": {n: 1 + [r["cohort"] for r in sorted(allr, key=key_res)].index(n) for n in NAMED_COHORTS if n in COH and n != cid},
                       "others_compared": len(allr)}

# ---------------------------------------------------------------- 4 · per member: classification, who holds it, where it trades
SPDR = "XLK XLF XLV XLY XLP XLE XLI XLB XLU XLRE XLC".split()
VANG = "VGT VFH VDE VHT VIS VCR VDC VPU VAW VNQ VOX".split()
ISHR = "IYW IYF IYE IYH IYJ IYC IYK IDU IYM IYR IYZ".split()
INVESCO_EW = "RSPT RSPF RSPH RSPD RSPS RSPG RSPN RSPM RSPU RSPR RSPC".split()
BROAD = set("SPY QQQ QQQE QQEW DIA IWM RSP MDY IJR VTI ITOT IWV VT VXUS VUG VTV MGK MTUM QUAL SPLV SCHD EFA EEM EZU EWG EWJ EWU EWY FXI MCHI ASHR".split())
FUND_SECTOR = {"XLK": "Technology", "VGT": "Technology", "IYW": "Technology", "RSPT": "Technology", "XLI": "Industrials", "VIS": "Industrials", "IYJ": "Industrials", "RSPN": "Industrials",
               "XLF": "Financials", "VFH": "Financials", "IYF": "Financials", "RSPF": "Financials", "XLV": "Health Care", "VHT": "Health Care", "IYH": "Health Care", "RSPH": "Health Care",
               "XLY": "Consumer Discretionary", "VCR": "Consumer Discretionary", "IYC": "Consumer Discretionary", "RSPD": "Consumer Discretionary",
               "XLP": "Consumer Staples", "VDC": "Consumer Staples", "IYK": "Consumer Staples", "RSPS": "Consumer Staples", "XLE": "Energy", "VDE": "Energy", "IYE": "Energy", "RSPG": "Energy",
               "XLB": "Materials", "VAW": "Materials", "IYM": "Materials", "RSPM": "Materials", "XLU": "Utilities", "VPU": "Utilities", "IDU": "Utilities", "RSPU": "Utilities",
               "XLRE": "Real Estate", "VNQ": "Real Estate", "IYR": "Real Estate", "RSPR": "Real Estate", "XLC": "Communication Services", "VOX": "Communication Services", "IYZ": "Telecommunications", "RSPC": "Communication Services"}
def alt(t): return {t, t.replace(".", "-"), t.replace("-", "."), t.replace(".", "/"), t.replace(".", "")}
HELD_BY = collections.defaultdict(dict)                     # ticker -> {fund: weight_pct}
for f, v in HOLD.items():
    for h in v.get("h", []):
        if h and h[0]: HELD_BY[h[0]][f] = h[1]
def holders(t):
    out = {}
    for a in alt(t):
        for f, w in HELD_BY.get(a, {}).items(): out[f] = w
    return out
def fam(hs, funds): return {f: round(hs[f], 3) for f in funds if f in hs}
def self_ex(cid, t):
    """the cohort's basket with this one name taken out (so a name is never compared with itself)"""
    b, ms = basket([m for m in BASK_MEMBERS[cid] if m != t]); return b, ms
members_out = {}
for cid in FRONTIER:
    rowsm = []
    for t in COH[cid]["members"]:
        p = CP.get(t) or {}
        hs = holders(t)
        sect = {**fam(hs, SPDR), **fam(hs, VANG), **fam(hs, ISHR)}
        row = {"ticker": t, "name": p.get("name"), "fmp_sector": p.get("sector"), "fmp_industry": p.get("industry"),
               "market_cap_usd_bn": None if not p.get("market_cap") else round(p["market_cap"] / 1e9, 2), "priced_126": priced(t),
               "returns_in_window": n_finite(RET[t]) if t in RET else 0,
               "sector_funds_spdr": fam(hs, SPDR), "sector_funds_vanguard": fam(hs, VANG), "sector_funds_ishares": fam(hs, ISHR), "sector_funds_invesco_equal_weight": fam(hs, INVESCO_EW),
               "sector_per_the_sector_funds": sorted({FUND_SECTOR[f] for f in sect}),
               "theme_funds": {f: round(w, 3) for f, w in sorted(hs.items(), key=lambda kv: -kv[1]) if f not in BROAD and f not in FUND_SECTOR},
               "broad_funds": {f: round(w, 3) for f, w in sorted(hs.items(), key=lambda kv: -kv[1]) if f in BROAD},
               "iwm_beta": r3(BETA.get(t)), "iwm_r_squared": r3(R2.get(t))}
        if priced(t):
            fits = []
            for o in TOPIC:
                if BASK[o] is None: continue
                if t in BASK_MEMBERS[o]:
                    ob, oms = self_ex(o, t)
                    if len(oms) < 2: continue
                else:
                    ob = BASK[o]
                fits.append({"cohort": o, "is_member": t in BASK_MEMBERS[o], "corr_raw": r3(corr_series(RET[t], ob)), "corr_resid": r3(corr_series(RES.get(t), resid(ob)))})
            own = next((f for f in fits if f["cohort"] == cid), None)
            row["corr_with_own_cohort_ex_self"] = own
            row["closest_cohorts_raw"] = sorted([f for f in fits if f["corr_raw"] is not None], key=lambda f: -f["corr_raw"])[:4]
            row["closest_cohorts_resid"] = sorted([f for f in fits if f["corr_resid"] is not None], key=lambda f: -f["corr_resid"])[:4]
            row["vs_named"] = {f["cohort"]: {"raw": f["corr_raw"], "resid": f["corr_resid"]} for f in fits if f["cohort"] in NAMED_COHORTS + FRONTIER}
            row["vs_funds_raw"] = {f: r3(corr_series(RET[t], RET[f])) for f in CANDIDATE_FUNDS if priced(f)}
            row["vs_funds_resid"] = {f: r3(corr_series(RES.get(t), FUND_RES[f])) for f in CANDIDATE_FUNDS if priced(f) and f != BETA_FUND}
        rowsm.append(row)
    sectors = collections.Counter(r["fmp_sector"] for r in rowsm); inds = collections.Counter(r["fmp_industry"] for r in rowsm)
    held_ind = sum(1 for r in rowsm if "Industrials" in r["sector_per_the_sector_funds"]); held_tech = sum(1 for r in rowsm if "Technology" in r["sector_per_the_sector_funds"])
    members_out[cid] = {"fmp_sector_counts": dict(sectors.most_common()), "fmp_industry_counts": dict(inds.most_common()),
                        "held_by_an_industrials_sector_fund": held_ind, "held_by_a_technology_sector_fund": held_tech,
                        "held_by_no_sector_fund_in_the_file": [r["ticker"] for r in rowsm if not r["sector_per_the_sector_funds"]],
                        "members": rowsm}
fund_file_depth = {f: {"holdings_in_fund": HOLD[f].get("n"), "rows_in_our_file": HOLD[f].get("rows"), "weight_covered_pct": HOLD[f].get("total"), "source": HOLD[f].get("source")}
                   for f in SPDR + VANG + ISHR + INVESCO_EW + ["ITA", "ARKX", "QTUM", "BOTZ", "PAVE", "JETS", "IYT", "IGV", "SMH", "IWM"] if f in HOLD}

# ---------------------------------------------------------------- 5 · grouping tests, CO1-style
def home_sector(ts):
    c = collections.Counter(sector_of.get(t) for t in ts if t in sector_of)
    return c.most_common(1)[0][0] if c else None
def verdict(c, sc, nl):
    if c is None: return None
    beats_sector = sc is not None and c > sc; beats_null = c > nl
    return "STRONGER than its sector" if (beats_sector and beats_null) else ("moves together, but no tighter than its sector" if beats_null else "no tighter than a random set of that size")
def co1_null_for(n):
    for r in MOVES["proposed"] + MOVES["today"]:
        if r.get("n_priced") == n and r.get("null95_same_size") is not None: return r["null95_same_size"]
    return None
def group_test(key, label, parts):
    """parts = {block name: [tickers]}; the group is the union"""
    ts = []
    for p in parts.values():
        for t in p:
            if t not in ts and not is_fund(t): ts.append(t)
    home = home_sector(ts)
    out = {"test": key, "label": label, "blocks": {k: [t for t in v if priced(t)] for k, v in parts.items()}, "members_not_priced": [t for t in ts if not priced(t)], "home_sector": home}
    for space in ("raw", "resid"):
        pc, pts = pair_corrs(ts, space)
        n = len(pts)
        sc = (sector_corr if space == "raw" else sector_corr_res).get(home, (None, 0))[0]
        if n >= 3:
            vals = [v for v in pc.values() if v is not None]; c = sum(vals) / len(vals); nl = null95(n, space)
            res = {"n_priced": n, "pairs": len(vals), "avg_pair_corr": r3(c), "sector_avg_pair_corr": r3(sc), "null95_same_size": r3(nl), "delta_vs_sector": r3(c - sc) if sc is not None else None,
                   "verdict": verdict(c, sc, nl)}
            if space == "raw": res["co1_null95_for_this_size"] = co1_null_for(n)
        elif n == 2:
            c = list(pc.values())[0]
            res = {"n_priced": 2, "pairs": 1, "avg_pair_corr": r3(c), "sector_avg_pair_corr": r3(sc), "null95_same_size": None,
                   "verdict": "only two names: one pair, not a group (CO1's test needs three)"}
        else:
            res = {"n_priced": n, "avg_pair_corr": None, "verdict": None}
        # inside each block, and between each two blocks: where the togetherness actually lives
        names = list(parts.keys()); blk = {t: k for k, v in parts.items() for t in v}
        within = collections.defaultdict(list); between = collections.defaultdict(list)
        for (a, b), v in pc.items():
            if v is None: continue
            ka, kb = blk[a], blk[b]
            if ka == kb: within[ka].append(v)
            else: between[" x ".join(sorted([ka, kb], key=names.index))].append(v)
        res["inside_each_block_same_days"] = {k: {"pairs": len(v), "avg_pair_corr": r3(sum(v) / len(v))} for k, v in within.items()}
        res["between_blocks"] = {k: {"pairs": len(v), "avg_pair_corr": r3(sum(v) / len(v))} for k, v in between.items()}
        allb = [x for v in between.values() for x in v]
        res["all_cross_block_pairs_avg"] = r3(sum(allb) / len(allb)) if allb else None
        out[space] = res
    # each block's own CO1 number, untouched
    out["co1_own_numbers"] = {k: (COH[k].get("moves_together") or {}).get("avg_pair_corr") for k in parts if k in COH}
    return out
M = lambda cid: list(COH[cid]["members"])
rest = [t for t in M("AUTONOMY_EVTOL") if t not in EVTOL_MAKERS]
grouping = [
    group_test("a", "AEROSPACE & DEFENCE family = primes + defence tech + space + autonomy/eVTOL", {"DEFENCE_PRIMES": M("DEFENCE_PRIMES"), "DEFENCE_TECH": M("DEFENCE_TECH"), "SPACE": M("SPACE"), "AUTONOMY_EVTOL": M("AUTONOMY_EVTOL")}),
    group_test("b", "DEFENCE PRIMES + DEFENCE TECH", {"DEFENCE_PRIMES": M("DEFENCE_PRIMES"), "DEFENCE_TECH": M("DEFENCE_TECH")}),
    group_test("c", "SPACE + DEFENCE TECH", {"SPACE": M("SPACE"), "DEFENCE_TECH": M("DEFENCE_TECH")}),
    group_test("d", "QUANTUM + AI SERVERS & DATACENTER KIT", {"QUANTUM": M("QUANTUM"), "AI_SERVERS_DC_KIT": M("AI_SERVERS_DC_KIT")}),
    group_test("e", "QUANTUM + AI ACCELERATORS & LOGIC", {"QUANTUM": M("QUANTUM"), "AI_ACCELERATORS": M("AI_ACCELERATORS")}),
    group_test("f1", "AUTONOMY_EVTOL, the eVTOL makers only (JOBY ACHR EVTL EH)", {"EVTOL_MAKERS": EVTOL_MAKERS}),
    group_test("f2", "AUTONOMY_EVTOL, the rest (ONDS drones, AUR self-driving trucks)", {"REST": rest}),
    group_test("f3", "AUTONOMY_EVTOL whole, split into the two blocks (shows the cross-block number)", {"EVTOL_MAKERS": EVTOL_MAKERS, "REST": rest}),
    # extra checks the first six make necessary
    group_test("x1", "EXTRA: SPACE + AUTONOMY_EVTOL (the two 'new aerospace' cohorts)", {"SPACE": M("SPACE"), "AUTONOMY_EVTOL": M("AUTONOMY_EVTOL")}),
    group_test("x2", "EXTRA: all four FRONTIER cohorts as one set (what the heading claims today)", {k: M(k) for k in FRONTIER}),
    group_test("x3", "EXTRA: SPACE + QUANTUM (do the two 'story' cohorts just trade as one?)", {"SPACE": M("SPACE"), "QUANTUM": M("QUANTUM")}),
]
# the eVTOL split, as baskets against the candidate homes
evb, evm = basket(EVTOL_MAKERS)
split_detail = {"evtol_makers_priced": evm, "rest": rest}
def vs(series, target): return {"raw": r3(corr_series(series, target)), "resid": r3(corr_series(resid(series), resid(target)))}
for name, series in [("evtol_makers_basket", evb)] + [(t, RET[t]) for t in rest if priced(t)]:
    d = {}
    for o in ["SPACE", "DEFENCE_TECH", "DEFENCE_PRIMES", "ROBOTICS_AUTOMATION", "TRANSPORT", "AUTOS_EV", "QUANTUM", "AI_SOFTWARE_DATA", "CHINA", "AI_NETWORKING_OPTICAL"]:
        if o not in COH or BASK[o] is None: continue
        ob = BASK[o]
        if name in BASK_MEMBERS[o]: ob, _ = basket([m for m in BASK_MEMBERS[o] if m != name])
        d[o] = vs(series, ob)
    for f in ["ITA", "JETS", "IYT", "XLI", "ARKX", "BOTZ", "XLY", "QQQ"]:
        if priced(f): d[f] = {"raw": r3(corr_series(series, RET[f])), "resid": r3(corr_series(resid(series), RES.get(f)))}
    split_detail[name] = d

# ---------------------------------------------------------------- yardstick: how much do cohorts that ALREADY share a heading move together?
def baskets_ex_shared(a, b):
    """basket a against basket b with any shared names taken out of b; (raw, resid) or None"""
    shared = set(BASK_MEMBERS[a]) & set(BASK_MEMBERS[b])
    ob = BASK[b]
    if shared:
        ob, oms = basket([t for t in BASK_MEMBERS[b] if t not in shared])
        if not oms: return None
    cr = corr_series(BASK[a], ob); cs = corr_series(BASK_RES[a], resid(ob))
    return None if cr is None or cs is None else (cr, cs)
HEAD_CHILDREN = {h: [c for c in TOPIC if h in COH[c]["parents"] and c not in FRONTIER and BASK[c] is not None] for h in ["AI", "SEMIS", "SOFTWARE_INTERNET", "INDUSTRIAL", "CONSUMER", "ENERGY_POWER"]}
HEAD_CHILDREN["TECH"] = sorted(set(HEAD_CHILDREN["SEMIS"]) | set(HEAD_CHILDREN["SOFTWARE_INTERNET"]))     # TECH has no cohorts of its own; SEMIS and SOFTWARE_INTERNET hang from it
def mean(v): return sum(v) / len(v) if v else None
heading_fit = {"what": "For each existing heading: the average basket-to-basket correlation between the cohorts that already sit under it (the heading's own norm), and each FRONTIER cohort's average against those same cohorts. A cohort fits a heading on the tape when its number is near the heading's norm. FRONTIER cohorts are left out of every heading's children. Shared names are removed from the second basket.",
               "headings": {}, "cohorts": {c: {} for c in FRONTIER}}
for h, kids in HEAD_CHILDREN.items():
    prs = [baskets_ex_shared(a, b) for i, a in enumerate(kids) for b in kids[i + 1:]]
    prs = [p for p in prs if p]
    heading_fit["headings"][h] = {"children": kids, "norm_raw": r3(mean([p[0] for p in prs])), "norm_resid": r3(mean([p[1] for p in prs])), "pairs": len(prs)}
    for c in FRONTIER:
        v = [baskets_ex_shared(c, k) for k in kids]; v = [p for p in v if p]
        heading_fit["cohorts"][c][h] = {"avg_raw": r3(mean([p[0] for p in v])), "avg_resid": r3(mean([p[1] for p in v])),
                                        "heading_norm_raw": heading_fit["headings"][h]["norm_raw"], "heading_norm_resid": heading_fit["headings"][h]["norm_resid"]}

# ---------------------------------------------------------------- DEFENCE_TECH is five different businesses: how much of its software look is PLTR?
def sub_basket_row(ts):
    b, ms = basket(ts); d = {"members": ms}
    c, n = avg_pair_corr(ms, "raw"); cr, _ = avg_pair_corr(ms, "resid")
    d["avg_pair_corr_raw"] = r3(c) if n >= 3 else (r3(list(pair_corrs(ms, "raw")[0].values())[0]) if n == 2 else None)
    d["avg_pair_corr_resid"] = r3(cr) if n >= 3 else (r3(list(pair_corrs(ms, "resid")[0].values())[0]) if n == 2 else None)
    for f in ["ITA", "IGV", "XLI", "VIS", "XLK", "ARKX", "SPY"]:
        if priced(f): d[f] = {"raw": r3(corr_series(b, RET[f])), "resid": r3(corr_series(resid(b), RES.get(f)))}
    for o in ["DEFENCE_PRIMES", "SPACE", "AUTONOMY_EVTOL", "AI_SOFTWARE_DATA", "CYBER", "BUSINESS_SERVICES", "IT_SERVICES"]:
        if o in COH and BASK[o] is not None:
            ob, oms = basket([t for t in BASK_MEMBERS[o] if t not in ms])
            d[o] = {"raw": r3(corr_series(b, ob)), "resid": r3(corr_series(resid(b), resid(ob)))}
    return d
defence_tech_detail = {"whole": sub_basket_row(M("DEFENCE_TECH")), "without_PLTR": sub_basket_row([t for t in M("DEFENCE_TECH") if t != "PLTR"]),
                       "drone_and_missile_makers_KTOS_AVAV": sub_basket_row(["KTOS", "AVAV"]), "software_and_services_PLTR_AXON_LDOS": sub_basket_row(["PLTR", "AXON", "LDOS"]),
                       "with_ONDS_added": sub_basket_row(M("DEFENCE_TECH") + ["ONDS"])}

# ---------------------------------------------------------------- the proposed AEROSPACE & DEFENCE shelf: who is classified there?
AD_FAMILY = ["DEFENCE_PRIMES", "DEFENCE_TECH", "SPACE", "AUTONOMY_EVTOL"]
ad_rows = []
for cid in AD_FAMILY:
    ms = COH[cid]["members"]
    ad_rows.append({"cohort": cid, "members": len(ms), "fmp_industry_aerospace_and_defense": sum(1 for t in ms if industry_of.get(t) == "Aerospace & Defense"),
                    "fmp_sector_industrials": sum(1 for t in ms if sector_of.get(t) == "Industrials"),
                    "held_by_ITA": sum(1 for t in ms if "ITA" in holders(t)), "held_by_ARKX": sum(1 for t in ms if "ARKX" in holders(t)),
                    "held_by_XLI_VIS_or_IYJ": sum(1 for t in ms if any(f in holders(t) for f in ("XLI", "VIS", "IYJ"))),
                    "held_by_a_tech_sector_fund_XLK_VGT_IYW": sum(1 for t in ms if any(f in holders(t) for f in ("XLK", "VGT", "IYW"))),
                    "not_aerospace_and_defense": {t: industry_of.get(t) for t in ms if industry_of.get(t) != "Aerospace & Defense"}})
ad_total = {k: sum(r[k] for r in ad_rows) for k in ("members", "fmp_industry_aerospace_and_defense", "fmp_sector_industrials", "held_by_ITA", "held_by_ARKX", "held_by_XLI_VIS_or_IYJ", "held_by_a_tech_sector_fund_XLK_VGT_IYW")}
all_ad = [t for t in COMPANIES if industry_of.get(t) == "Aerospace & Defense"]
ad_shelf = {"by_cohort": ad_rows, "total": ad_total, "all_served_companies_fmp_aerospace_and_defense": len(all_ad),
            "of_which_outside_these_four_cohorts": sorted(t for t in all_ad if not any(t in COH[c]["members"] for c in AD_FAMILY))}

# ---------------------------------------------------------------- SpaceX (SPCX): too new for the 126-day test; shown on its own shorter window, clearly apart
spcx = None
if "SPCX" in RET and not priced("SPCX"):
    x = RET["SPCX"]; idx = [i for i in range(N_SESS) if x[i] is not None]
    def short(series):
        j = [i for i in idx if series is not None and series[i] is not None]
        return r3(pearson([x[i] for i in j], [series[i] for i in j])) if len(j) >= 20 else None
    spcx = {"why_apart": "SPCX has fewer than 123 of the 126 daily returns, so CO1's rule leaves it out of every number above. These are on its own shorter window and are NOT comparable with the 126-day numbers.",
            "returns_available": len(idx), "first_return_date": body[idx[0] + 1][0] if idx else None, "last_return_date": body[idx[-1] + 1][0] if idx else None,
            "fmp_sector": (CP.get("SPCX") or {}).get("sector"), "fmp_industry": (CP.get("SPCX") or {}).get("industry"),
            "market_cap_usd_bn": round(((CP.get("SPCX") or {}).get("market_cap") or 0) / 1e9, 1),
            "corr_raw_short_window": {**{c: short(BASK[c]) for c in ["SPACE", "DEFENCE_PRIMES", "DEFENCE_TECH", "AUTONOMY_EVTOL", "QUANTUM", "MAG7", "AI_ACCELERATORS"] if c in BASK},
                                      **{f: short(RET[f]) for f in ["ARKX", "ITA", "XLI", "QQQ", "IWM", "SPY"] if priced(f)}},
            "held_by": holders("SPCX")}

# ---------------------------------------------------------------- write
out = {
    "what": "TR2, 6 Oct 2026: the measured case for dissolving the FRONTIER heading. For each of its four cohorts: how its equal-weight basket moves against each candidate parent fund and against every other topic cohort, on raw daily returns and again after removing small-cap (IWM) beta; how each member is classified and which sector fund holds it; and CO1-style grouping tests of the candidate new families. Study only. Nothing written to any live table.",
    "measured_from": {"closes": rel(P_CLOSES), "tree": rel(P_PROPOSAL), "co1_results": rel(P_MOVES), "profiles": rel(P_PROFILE), "universe": rel(P_UNIVERSE), "fund_holdings": rel(P_HOLD),
                      "universe_sha256": UNI.get("universe_sha256"), "served_symbols": len(U), "priced_companies": len(PRICED_COMPANIES), "topic_cohorts": len(TOPIC),
                      "fund_holdings_pulled": "26/28 Sep 2026 (per the holdings file's own source lines)"},
    "method": {"returns": "daily log returns, last 126 sessions", "window": WINDOW, "priced_rule": "at least 123 of 126 returns",
               "basket": "equal-weight: the mean of the priced company members' returns each day",
               "residual": "each series minus its ordinary-least-squares fit on IWM's daily return (with intercept); a basket's residual is the residual of the basket",
               "null": "95th percentile (linear interpolation) of %d random same-size sets drawn from all %d priced companies; seed %d*1000+size. CO1 used the same seed in one long stream, so its sets differ; CO1's own null for the same size is printed beside ours where it exists." % (NULL_DRAWS, len(PRICED_COMPANIES), NULL_SEED),
               "shared_members": "where a name sits in both cohorts (AUR, PLTR) the cross-cohort number is also given with the shared names taken out of the other basket, and ranking uses that one",
               "caveat": "126 trading days, one regime. A correlation says two things moved together in this half-year; it does not say what a company makes."},
    "candidate_funds": {"asked": CANDIDATE_FUNDS, "absent_from_closes_file": absent_funds},
    "named_cohorts": {"asked": NAMED_COHORTS, "missing_from_proposal": missing_named, "note": "MACHINERY in the brief = MACHINERY_CAPGOODS in proposal.json"},
    "co1_reproduction": reproduction,
    "1_and_3_baskets_vs_candidate_parent_funds": vs_funds,
    "2_and_3_baskets_vs_other_topic_cohorts": vs_cohorts,
    "4_members": members_out,
    "4_fund_file_depth": {"note": "a member can only show as held if it is inside the rows our holdings file carries for that fund", "funds": fund_file_depth},
    "5_grouping_tests": grouping,
    "5f_autonomy_split_detail": split_detail,
    "extra_heading_yardstick": heading_fit,
    "extra_defence_tech_detail": defence_tech_detail,
    "extra_aerospace_defence_shelf": ad_shelf,
    "spacex_short_window": spcx,
}
os.makedirs(OUT_DIR, exist_ok=True)
with open(os.path.join(OUT_DIR, "frontier-rehome.json"), "w") as fh:
    json.dump(out, fh, indent=1, sort_keys=False)
    fh.write("\n")

# ---------------------------------------------------------------- console summary
print("wrote", rel(os.path.join(OUT_DIR, "frontier-rehome.json")))
print("window", WINDOW["first_return_date"], "to", WINDOW["last_return_date"], "| priced companies", len(PRICED_COMPANIES), "| absent funds", absent_funds)
print("CO1 reproduction: worst cohort diff %.4f, worst sector diff %.4f, ok=%s" % (worst, worst_sec, reproduction["reproduced_to_0_01"]))
for r in reproduction["the_four_plus_primes"]: print("  ", r)
for cid in FRONTIER:
    v = vs_funds[cid]
    print("\n== %s  members %s  not priced %s  IWM beta %s  R2 %s" % (cid, v["basket_members_priced"], v["members_not_priced"], v["basket_iwm_beta"], v["basket_iwm_r_squared"]))
    print("  funds raw  :", "  ".join("%s %.2f" % (r["fund"], r["corr_raw"]) for r in sorted([x for x in v["funds"] if x["corr_raw"] is not None], key=lambda r: -r["corr_raw"])))
    print("  funds resid:", "  ".join("%s %+.2f" % (r["fund"], r["corr_resid"]) for r in sorted([x for x in v["funds"] if x["corr_resid"] is not None], key=lambda r: -r["corr_resid"])))
    c = vs_cohorts[cid]
    def show(r, k): return "%s %+.2f%s" % (r["cohort"], r.get(k + "_ex_shared", r[k]), "*" if r["shared_members"] else "")
    print("  closest8 raw  :", "  ".join(show(r, "corr_raw") for r in c["closest8_raw"]))
    print("  closest8 resid:", "  ".join(show(r, "corr_resid") for r in c["closest8_resid"]))
    print("  named raw     :", "  ".join(show(r, "corr_raw") for r in c["named"]))
    print("  named resid   :", "  ".join(show(r, "corr_resid") for r in c["named"]))
    m = members_out[cid]
    print("  FMP sectors", m["fmp_sector_counts"], "| industries", m["fmp_industry_counts"])
    for r in m["members"]:
        sf = {**r["sector_funds_spdr"], **r["sector_funds_vanguard"], **r["sector_funds_ishares"]}
        own = r.get("corr_with_own_cohort_ex_self") or {}
        print("   %-5s %-22s %-34s cap %7s  held %s | theme %s | own %s/%s | nearest resid %s" % (
            r["ticker"], r["fmp_sector"], r["fmp_industry"], r["market_cap_usd_bn"], sf, dict(list(r["theme_funds"].items())[:4]),
            own.get("corr_raw"), own.get("corr_resid"), [(f["cohort"], f["corr_resid"]) for f in r.get("closest_cohorts_resid", [])[:3]]))
print("\nGROUPING TESTS (sector Industrials raw %.3f resid %.3f | Technology raw %.3f resid %.3f)" % (
    sector_corr["Industrials"][0], sector_corr_res["Industrials"][0], sector_corr["Technology"][0], sector_corr_res["Technology"][0]))
for g in grouping:
    a, b = g["raw"], g["resid"]
    print(" (%s) %s" % (g["test"], g["label"]))
    print("     raw   n=%s corr=%s sector=%s null95=%s (CO1 null %s) -> %s | cross-block %s" % (a.get("n_priced"), a.get("avg_pair_corr"), a.get("sector_avg_pair_corr"), a.get("null95_same_size"), a.get("co1_null95_for_this_size"), a.get("verdict"), a.get("all_cross_block_pairs_avg")))
    print("     resid n=%s corr=%s sector=%s null95=%s -> %s | cross-block %s" % (b.get("n_priced"), b.get("avg_pair_corr"), b.get("sector_avg_pair_corr"), b.get("null95_same_size"), b.get("verdict"), b.get("all_cross_block_pairs_avg")))
    print("     inside raw", {k: v["avg_pair_corr"] for k, v in a.get("inside_each_block_same_days", {}).items()}, "| between raw", {k: v["avg_pair_corr"] for k, v in a.get("between_blocks", {}).items()})
    print("     inside resid", {k: v["avg_pair_corr"] for k, v in b.get("inside_each_block_same_days", {}).items()}, "| between resid", {k: v["avg_pair_corr"] for k, v in b.get("between_blocks", {}).items()})
print("\neVTOL split detail:")
for k, v in split_detail.items():
    if isinstance(v, dict): print("  ", k, {o: (d["raw"], d["resid"]) for o, d in v.items()})
print("\nHEADING YARDSTICK (avg basket corr with the heading's cohorts raw/resid | heading's own norm raw/resid):")
for h, v in heading_fit["headings"].items(): print("   %-18s norm %s / %s  (%d cohorts)" % (h, v["norm_raw"], v["norm_resid"], len(v["children"])))
for c in FRONTIER: print("   %-15s" % c, "  ".join("%s %s/%s" % (h, v["avg_raw"], v["avg_resid"]) for h, v in heading_fit["cohorts"][c].items()))
print("\nDEFENCE_TECH detail:")
for k, v in defence_tech_detail.items(): print("   %-38s pair %s/%s |" % (k, v["avg_pair_corr_raw"], v["avg_pair_corr_resid"]), "  ".join("%s %s/%s" % (o, d["raw"], d["resid"]) for o, d in v.items() if isinstance(d, dict)))
print("\nA&D shelf:", ad_total, "| all served A&D companies", len(all_ad), "| outside the four", ad_shelf["of_which_outside_these_four_cohorts"])
for r in ad_rows: print("   ", {k: v for k, v in r.items()})
print("\nSPCX short window:", spcx and {k: spcx[k] for k in ("returns_available", "first_return_date", "corr_raw_short_window", "held_by")})
