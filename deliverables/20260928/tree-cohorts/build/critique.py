#!/usr/bin/env python3
"""TREE COHORTS (28 Sep, lane N5) · part 1: critique of today's tree → cohort mapping, measured.

Inputs (all snapshots already in the repo, plus the daily Geiger replay written by scripts/replay-daily-geiger.mjs):
  deliverables/20260928/coverage-tree/coverage-tree.json      36 cohort nodes with members, parent candidates, coverage, tracking
  deliverables/20260928/coverage-tree/data/ticker_cohorts-20260928.json   the registry rows (COHSETS), 1,282 rows
  deliverables/20260928/coverage-tree/data/holdings.json       125 funds' holdings
  data/standard-tree-20260924.json                            GICS sector / industry / cap per served company
  <GEIGER_DAILY>                                              replayed daily Geiger per served symbol

Writes build/critique.json. No cut-off is chosen here: every measure is reported as a full ranking or distribution.
"""
import json, os, sys, itertools, math
import numpy as np

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
DIR = os.path.join(ROOT, "deliverables/20260928/coverage-tree")
GD = sys.argv[1]
OUT = os.path.join(os.path.dirname(__file__), "critique.json")

CT = json.load(open(os.path.join(DIR, "coverage-tree.json")))
TC = json.load(open(os.path.join(DIR, "data/ticker_cohorts-20260928.json")))
HOLD = json.load(open(os.path.join(DIR, "data/holdings.json")))["data"]
UNI = json.load(open(os.path.join(DIR, "data/universe-20260928.json")))
STD = json.load(open(os.path.join(ROOT, "data/standard-tree-20260924.json")))
ORIGIN = json.load(open(os.path.join(ROOT, "data/cohort-label-origin-20260924.json")))
G = json.load(open(GD))

SERVED = set(UNI["symbols"])
GEIGER_ONLY = set(UNI["tiers"].get("geiger_only", []))
FULL = SERVED - GEIGER_ONLY
GICS = {n["ticker"]: n for n in (STD["names"] if isinstance(STD["names"], list) else STD["names"].values())}
nodes = {n["id"]: n for n in CT["nodes"]}
FUNDS = {n["ticker"] for n in CT["nodes"] if n["kind"] == "fund"}
COH = {c["key"]: c for c in CT["cohorts"]}
rs = np.random.default_rng(20260928)

# ---------- registry shape ----------
reg = {}
for r in TC:
    reg.setdefault(r["cohort"], set()).add(r["ticker"])
machine = {m["cohort"] for m in ORIGIN.get("machine_made", [])}
served_in_reg = {t for s in reg.values() for t in s if t in SERVED}
per_name = {}
for k, s in reg.items():
    for t in s:
        if t in SERVED: per_name.setdefault(t, set()).add(k)
tree_per_name = {}
for c in CT["cohorts"]:
    for t in c["members"]:
        tree_per_name.setdefault(t, set()).add(c["key"])
registry = {
    "rows": len(TC), "distinct_labels": len(reg), "machine_made_labels": len([k for k in reg if k in machine]),
    "hand_labels": len([k for k in reg if k not in machine]),
    "served_names_in_any_label": len(served_in_reg), "served_names_in_no_label": sorted(SERVED - served_in_reg),
    "served_names_in_no_tree_cohort": sorted(t for t in FULL if t not in tree_per_name),
    "geiger_only_funds_in_no_tree_cohort": sorted(t for t in GEIGER_ONLY if t not in tree_per_name),
    "tree_cohorts_per_served_name_distribution": {str(k): v for k, v in sorted(
        {n: sum(1 for t in FULL if len(tree_per_name.get(t, ())) == n) for n in range(0, 9)}.items())},
    "most_cohorts": sorted(((t, sorted(s)) for t, s in tree_per_name.items()), key=lambda x: -len(x[1]))[:15],
    "label_sizes_registry": sorted(((k, len(s), k in machine) for k, s in reg.items()), key=lambda x: -x[1]),
}

# ---------- overlaps between the 36 tree cohorts ----------
keys = list(COH)
mem = {k: set(COH[k]["members"]) for k in keys}
pairs = []
for a, b in itertools.combinations(keys, 2):
    A, B = mem[a], mem[b]
    inter = len(A & B)
    if not inter: continue
    pairs.append({"a": a, "b": b, "n_a": len(A), "n_b": len(B), "shared": inter,
                  "jaccard": round(inter / len(A | B), 3), "overlap_coef": round(inter / min(len(A), len(B)), 3),
                  "shared_names": sorted(A & B)[:40]})
pairs.sort(key=lambda p: (-p["overlap_coef"], -p["shared"]))

# ---------- daily Geiger matrices ----------
dates = G["dates"]; T = len(dates)
syms = [s for s in G["symbols"]]
def arr(s, key="composite"):
    v = G["symbols"][s][key]
    return np.array([np.nan if x is None else x for x in v], dtype=float)
M = {s: arr(s) for s in syms}
R = {s: arr(s, "ret") for s in syms}

def corr(x, y):
    m = ~np.isnan(x) & ~np.isnan(y)
    n = int(m.sum())
    if n < 2: return None, n
    xs, ys = x[m], y[m]
    if xs.std() == 0 or ys.std() == 0: return None, n
    return float(np.corrcoef(xs, ys)[0, 1]), n

# pairwise correlation among all served names with >= 1 year of readings (a data requirement, stated, not a cut-off on results)
MIN_N = 250
ok = [s for s in syms if int(np.sum(~np.isnan(M[s]))) >= MIN_N]
short = sorted(set(syms) - set(ok))
idx = {s: i for i, s in enumerate(ok)}
X = np.vstack([M[s] for s in ok])
# pairwise correlation with NaN-aware computation
def nan_corr_matrix(X):
    n = X.shape[0]
    C = np.full((n, n), np.nan); N = np.zeros((n, n), dtype=int)
    for i in range(n):
        xi = X[i]; mi = ~np.isnan(xi)
        for j in range(i, n):
            m = mi & ~np.isnan(X[j]); k = int(m.sum())
            N[i, j] = N[j, i] = k
            if k < 60: continue
            a = xi[m]; b = X[j][m]
            sa, sb = a.std(), b.std()
            if sa == 0 or sb == 0: continue
            c = float(((a - a.mean()) * (b - b.mean())).mean() / (sa * sb))
            C[i, j] = C[j, i] = c
    return C, N
C, N = nan_corr_matrix(X)
np.save(os.path.join(os.path.dirname(__file__), "corr-geiger.npy"), C)
json.dump({"symbols": ok, "min_readings": MIN_N, "short_history": short}, open(os.path.join(os.path.dirname(__file__), "corr-geiger-index.json"), "w"))

# background: distribution of pairwise correlation among all served single names (funds excluded)
single = [s for s in ok if s not in FUNDS]
si = [idx[s] for s in single]
sub = C[np.ix_(si, si)]
iu = np.triu_indices(len(si), 1)
allpairs = sub[iu]; allpairs = allpairs[~np.isnan(allpairs)]
def pct(v, qs=(1, 5, 10, 25, 50, 75, 90, 95, 99)):
    v = np.asarray(v, dtype=float); v = v[~np.isnan(v)]
    if not len(v): return None
    return {str(q): round(float(np.percentile(v, q)), 3) for q in qs}
background = {"pairs": int(len(allpairs)), "names": len(single), "percentiles": pct(allpairs), "mean": round(float(allpairs.mean()), 3)}

# ---------- cohesion of each cohort ----------
def cohort_stats(members):
    ms = [t for t in members if t in idx]
    if len(ms) < 2: return {"n_with_history": len(ms)}
    ii = [idx[t] for t in ms]
    S = C[np.ix_(ii, ii)]
    iu2 = np.triu_indices(len(ii), 1)
    v = S[iu2]; v = v[~np.isnan(v)]
    # first principal component share of the members' Geiger (on the common days), the share of the cohort's movement that is one movement
    Xm = X[ii]; good = ~np.isnan(Xm).any(axis=0)
    pc1 = None
    if good.sum() >= 120:
        Z = Xm[:, good]; Z = Z - Z.mean(axis=1, keepdims=True)
        sd = Z.std(axis=1, keepdims=True); sd[sd == 0] = 1; Z = Z / sd
        ev = np.linalg.eigvalsh(np.cov(Z))
        pc1 = round(float(ev[-1] / ev.sum()), 3)
    # the cohort mean's correlation with SPY, and each member vs the leave-one-out mean
    mean_series = np.nanmean(Xm, axis=0)
    spy_c, _ = corr(mean_series, M["SPY"])
    loo = []
    for k, t in enumerate(ms):
        others = np.delete(Xm, k, axis=0)
        lm = np.nanmean(others, axis=0) if others.shape[0] else None
        c1, n1 = corr(Xm[k], lm) if lm is not None else (None, 0)
        loo.append({"t": t, "corr_own_cohort": None if c1 is None else round(c1, 3), "n": n1})
    return {"n_with_history": len(ms), "pairs": int(len(v)), "mean_pair_corr": round(float(v.mean()), 3) if len(v) else None,
            "pair_corr_percentiles": pct(v), "pc1_share": pc1, "mean_vs_spy": None if spy_c is None else round(spy_c, 3),
            "members_loo": loo}
cohesion = {}
for k in keys:
    st = cohort_stats(COH[k]["members"])
    st["n"] = len(COH[k]["members"]); st["origin"] = COH[k]["origin"]; st["etf_parent"] = COH[k].get("etf_parent")
    cohesion[k] = st
# a random null: cohorts of the same sizes drawn at random from the single names; mean pair corr distribution
null = {}
for n in sorted({len(COH[k]["members"]) for k in keys}):
    draws = []
    for _ in range(300):
        pick = rs.choice(si, size=min(n, len(si)), replace=False)
        S = C[np.ix_(pick, pick)]; v = S[np.triu_indices(len(pick), 1)]; v = v[~np.isnan(v)]
        if len(v): draws.append(float(v.mean()))
    null[str(n)] = pct(draws, (5, 50, 95))

# ---------- names in the wrong place: own cohort vs best other cohort (by the cohort mean, leave-one-out for own) ----------
cohort_mean = {}
for k in keys:
    ms = [t for t in COH[k]["members"] if t in idx]
    if len(ms) >= 2: cohort_mean[k] = np.nanmean(X[[idx[t] for t in ms]], axis=0)
misplaced = []
for k in keys:
    for row in cohesion[k].get("members_loo", []):
        t = row["t"]; own = row["corr_own_cohort"]
        if own is None: continue
        best = None
        for k2, mseries in cohort_mean.items():
            if k2 == k or t in mem[k2]: continue
            c2, n2 = corr(X[idx[t]], mseries)
            if c2 is not None and (best is None or c2 > best[1]): best = (k2, round(c2, 3))
        if best:
            g = GICS.get(t, {})
            misplaced.append({"t": t, "cohort": k, "own": own, "best_other": best[0], "best_other_corr": best[1], "gap": round(best[1] - own, 3),
                              "gics_sector": g.get("gics_sector"), "gics_industry": g.get("gics_industry"), "cohort_sector_majority": COH[k].get("sector_majority")})
misplaced.sort(key=lambda r: -r["gap"])

# sector mismatches: members whose GICS sector is not the cohort's majority
sector_mismatch = {}
for k in keys:
    maj = COH[k].get("sector_majority")
    if not maj: continue
    odd = [(t, GICS[t]["gics_sector"]) for t in COH[k]["members"] if t in GICS and GICS[t]["gics_sector"] != maj]
    if odd: sector_mismatch[k] = {"majority": maj, "n": len(COH[k]["members"]), "odd": odd}

# ---------- parent fit measured on history: does the parent fund's OWN Geiger track the cohort's mean? ----------
parent_fit = {}
for k in keys:
    c = COH[k]
    if k not in cohort_mean: continue
    cands = []
    for cand in (c.get("parent_candidates") or []):
        f = cand["fund"]
        if f in M:
            r_, n_ = corr(cohort_mean[k], M[f])
            cands.append({"fund": f, "share": cand["share"], "weight_pct": cand["fund_weight_in_cohort_pct"], "fit_static": cand["fit"], "corr_history": None if r_ is None else round(r_, 3), "n": n_})
    # the sector fund of the majority sector and SPY, as yardsticks
    SECT = {"Information Technology": "XLK", "Financials": "XLF", "Health Care": "XLV", "Energy": "XLE", "Industrials": "XLI", "Consumer Staples": "XLP", "Consumer Discretionary": "XLY", "Utilities": "XLU", "Materials": "XLB", "Real Estate": "XLRE", "Communication Services": "XLC"}
    yard = {}
    for lab, f in (("SPY", "SPY"), ("sector_fund", SECT.get(c.get("sector_majority")))):
        if f and f in M:
            r_, n_ = corr(cohort_mean[k], M[f]); yard[lab] = {"fund": f, "corr_history": None if r_ is None else round(r_, 3)}
    parent_fit[k] = {"etf_parent": c.get("etf_parent"), "candidates": cands, "yardsticks": yard}

# ---------- thin cohorts: how noisy is a mean of n Geigers? empirical: the day-to-day std of a cohort mean vs n ----------
thin = []
for n in (2, 3, 4, 5, 6, 8, 10, 15, 20, 30, 50):
    sds = []
    for _ in range(200):
        pick = rs.choice(si, size=n, replace=False)
        m_ = np.nanmean(X[pick], axis=0)
        d = np.diff(m_); d = d[~np.isnan(d)]
        if len(d): sds.append(float(np.std(d)))
    thin.append({"n": n, "daily_change_sd_median": round(float(np.median(sds)), 4), "p5": round(float(np.percentile(sds, 5)), 4), "p95": round(float(np.percentile(sds, 95)), 4)})
one = []
for s in si[:400]:
    d = np.diff(X[s]); d = d[~np.isnan(d)]
    if len(d): one.append(float(np.std(d)))
thin.insert(0, {"n": 1, "daily_change_sd_median": round(float(np.median(one)), 4), "p5": round(float(np.percentile(one, 5)), 4), "p95": round(float(np.percentile(one, 95)), 4)})

out = {"built_from": {"geiger_daily": os.path.basename(GD), "sessions": T, "from": dates[0], "to": dates[-1], "symbols_with_history": len(ok), "short_history": short, "min_readings_for_correlation": MIN_N},
       "registry": registry, "overlaps": pairs, "background_pair_corr": background, "cohesion": cohesion, "null_same_size": null,
       "misplaced": misplaced, "sector_mismatch": sector_mismatch, "parent_fit": parent_fit, "thin": thin,
       "no_parent": [{"key": k, "reason": COH[k].get("no_parent_reason"), "members": COH[k]["members"]} for k in keys if not COH[k].get("etf_parent")]}
json.dump(out, open(OUT, "w"), indent=1)
print(json.dumps({"cohorts": len(keys), "overlapping_pairs": len(pairs), "names_with_history": len(ok), "short": len(short), "background_mean_corr": background["mean"]}))
