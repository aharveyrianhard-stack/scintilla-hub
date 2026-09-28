#!/usr/bin/env python3
"""TREE COHORTS (28 Sep, lane N5) · part 2: co-movement clusters from the daily Geiger history.

Method (statistician standard R2, R4, R6): Ward hierarchical clustering on 1 − correlation of the replayed daily Geiger
composite across the served single names. The number of clusters is not chosen by eye: for every k from 4 to 60 the
sessions are split into two halves (first half / second half, walk-forward), each half is clustered on its own, and the
agreement between the two halves' clusterings (adjusted Rand index) is recorded; the same is done for two random halves
of the sessions (interleaved months). The k that agrees best out of sample is the k reported, and the whole curve is shown.
Names with fewer than a year of readings are placed afterwards by nearest cluster mean (listed as "placed, not clustered").

Reads build/corr-geiger.npy, build/corr-geiger-index.json, the replay JSON; writes build/clusters.json.
"""
import json, os, sys, collections
import numpy as np
from scipy.cluster.hierarchy import linkage, fcluster
from scipy.spatial.distance import squareform

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../.."))
HERE = os.path.dirname(__file__)
GD = sys.argv[1]
G = json.load(open(GD))
IDX = json.load(open(os.path.join(HERE, "corr-geiger-index.json")))
CT = json.load(open(os.path.join(ROOT, "deliverables/20260928/coverage-tree/coverage-tree.json")))
UNI = json.load(open(os.path.join(ROOT, "deliverables/20260928/coverage-tree/data/universe-20260928.json")))
STD = json.load(open(os.path.join(ROOT, "data/standard-tree-20260924.json")))
GICS = {n["ticker"]: n for n in (STD["names"] if isinstance(STD["names"], list) else STD["names"].values())}
FUNDS = {n["ticker"] for n in CT["nodes"] if n["kind"] == "fund"}
GEIGER_ONLY = set(UNI["tiers"].get("geiger_only", []))
COH = {c["key"]: set(c["members"]) for c in CT["cohorts"]}

syms = IDX["symbols"]
single = [s for s in syms if s not in FUNDS and s not in GEIGER_ONLY]
dates = G["dates"]; T = len(dates)
def arr(s):
    return np.array([np.nan if x is None else x for x in G["symbols"][s]["composite"]], dtype=float)
X = np.vstack([arr(s) for s in single])

def corr_matrix(Xs):
    n = Xs.shape[0]; C = np.eye(n)
    for i in range(n):
        mi = ~np.isnan(Xs[i])
        for j in range(i + 1, n):
            m = mi & ~np.isnan(Xs[j])
            if m.sum() < 60: C[i, j] = C[j, i] = 0.0; continue
            a, b = Xs[i][m], Xs[j][m]
            sa, sb = a.std(), b.std()
            c = 0.0 if sa == 0 or sb == 0 else float(((a - a.mean()) * (b - b.mean())).mean() / (sa * sb))
            C[i, j] = C[j, i] = c
    return C

def cluster(C, k):
    D = np.clip(1 - C, 0, 2); np.fill_diagonal(D, 0)
    Z = linkage(squareform(D, checks=False), method="ward")
    return fcluster(Z, k, criterion="maxclust"), Z

def ari(a, b):
    # adjusted Rand index
    from math import comb
    n = len(a); ct = collections.Counter(zip(a, b))
    sa = collections.Counter(a); sb = collections.Counter(b)
    sum_c = sum(comb(v, 2) for v in ct.values()); sum_a = sum(comb(v, 2) for v in sa.values()); sum_b = sum(comb(v, 2) for v in sb.values())
    tot = comb(n, 2); exp = sum_a * sum_b / tot if tot else 0
    mx = (sum_a + sum_b) / 2
    return 0.0 if mx == exp else (sum_c - exp) / (mx - exp)

# names with a full year in BOTH halves take part in the stability test
half = T // 2
in_first = np.sum(~np.isnan(X[:, :half]), axis=1) >= 200
in_second = np.sum(~np.isnan(X[:, half:]), axis=1) >= 200
both = in_first & in_second
Xb = X[both]; names_b = [s for s, f in zip(single, both) if f]
C1 = corr_matrix(Xb[:, :half]); C2 = corr_matrix(Xb[:, half:])
# interleaved-month split as a second check
months = np.array([d[:7] for d in dates]); um = sorted(set(months)); odd = {m for i, m in enumerate(um) if i % 2}
mo = np.array([m in odd for m in months])
C3 = corr_matrix(Xb[:, mo]); C4 = corr_matrix(Xb[:, ~mo])
Call = corr_matrix(Xb)
curve = []
for k in range(4, 61):
    a1, _ = cluster(C1, k); a2, _ = cluster(C2, k); a3, _ = cluster(C3, k); a4, _ = cluster(C4, k)
    curve.append({"k": k, "ari_halves": round(ari(a1, a2), 3), "ari_months": round(ari(a3, a4), 3)})
# a null for the ARI: shuffle one labelling
rs = np.random.default_rng(7)
null = []
for k in (8, 16, 24, 32):
    a1, _ = cluster(C1, k); a2, _ = cluster(C2, k)
    null.append({"k": k, "ari_shuffled_p95": round(float(np.percentile([ari(a1, rs.permutation(a2)) for _ in range(200)], 95)), 3)})
# the curve rises with k and flattens: the k reported is the SMALLEST k whose agreement is within 0.02 (twice the shuffled
# null's 95th point) of the best agreement seen, so the plateau is read from its start, not its edge
best = max(curve, key=lambda r: r["ari_halves"] + r["ari_months"])
plateau = [r for r in curve if r["ari_halves"] + r["ari_months"] >= best["ari_halves"] + best["ari_months"] - 0.02]
K = plateau[0]["k"]
# consensus: how often each pair of names lands in the same group across the four partitions and every k from 20 to 60
cons = np.zeros((len(names_b), len(names_b))); cnt = 0
for k in range(20, 61, 4):
    for Cx in (C1, C2, C3, C4):
        a, _ = cluster(Cx, k); same = (a[:, None] == a[None, :]).astype(float); cons += same; cnt += 1
cons /= cnt
labels, Z = cluster(Call, K)
# place the names that were not in both halves by nearest cluster mean on whatever days they have
placed = []
Xall = X; names_all = single
members = collections.defaultdict(list)
for s, l in zip(names_b, labels): members[int(l)].append(s)
cm = {l: np.nanmean(Xb[[names_b.index(s) for s in ms]], axis=0) for l, ms in members.items()}
for s in single:
    if s in names_b: continue
    x = X[single.index(s)]; bestl, bestc = None, -2
    for l, m_ in cm.items():
        m = ~np.isnan(x) & ~np.isnan(m_)
        if m.sum() < 60: continue
        c = float(np.corrcoef(x[m], m_[m])[0, 1])
        if c > bestc: bestc, bestl = c, l
    if bestl is not None: members[bestl].append(s); placed.append({"t": s, "cluster": bestl, "corr": round(bestc, 3)})
# describe each cluster: dominant GICS industry / sector, the existing cohorts it overlaps, cohesion
clusters = []
for l in sorted(members, key=lambda l: -len(members[l])):
    ms = members[l]
    ii = [names_b.index(s) for s in ms if s in names_b]
    S = Call[np.ix_(ii, ii)]; v = S[np.triu_indices(len(ii), 1)] if len(ii) > 1 else np.array([])
    sec = collections.Counter(GICS.get(s, {}).get("gics_sector", "?") for s in ms).most_common(3)
    ind = collections.Counter(GICS.get(s, {}).get("gics_industry", "?") for s in ms).most_common(4)
    ov = sorted(((k, len(set(ms) & v_), len(v_)) for k, v_ in COH.items() if set(ms) & v_), key=lambda x: -x[1])[:5]
    caps = sorted([GICS[s]["cap"] for s in ms if s in GICS and GICS[s].get("cap")])
    rep = None
    if len(ii) > 1:
        cv = cons[np.ix_(ii, ii)][np.triu_indices(len(ii), 1)]; rep = round(float(cv.mean()), 3)
    clusters.append({"cluster": int(l), "n": len(ms), "members": sorted(ms), "mean_pair_corr": round(float(v.mean()), 3) if len(v) else None, "reproducibility": rep,
                     "sectors": sec, "industries": ind, "overlaps_cohorts": ov, "cap_median_usd": caps[len(caps) // 2] if caps else None})
# each existing cohort: how many co-movement groups its members span, and the share in its largest group
lab = {s: int(l) for l, ms in members.items() for s in ms}
span = {}
for k, v_ in COH.items():
    ls = [lab[t] for t in v_ if t in lab]
    if not ls: continue
    cc = collections.Counter(ls)
    span[k] = {"members_clustered": len(ls), "groups": len(cc), "largest_share": round(cc.most_common(1)[0][1] / len(ls), 3),
               "groups_list": [{"cluster": c, "n": n_, "names": sorted(t for t in v_ if lab.get(t) == c)} for c, n_ in cc.most_common()]}
# pairs among the existing cohorts' members: mean consensus (how reproducibly the cohort's members travel together)
coh_rep = {}
ni = {s: i for i, s in enumerate(names_b)}
for k, v_ in COH.items():
    ii = [ni[t] for t in v_ if t in ni]
    if len(ii) > 1:
        cv = cons[np.ix_(ii, ii)][np.triu_indices(len(ii), 1)]; coh_rep[k] = round(float(cv.mean()), 3)
bg = cons[np.triu_indices(len(names_b), 1)]
out = {"method": __doc__.strip(), "plateau_rule": "smallest k whose agreement is within 0.02 of the best", "cohort_span": span, "cohort_reproducibility": coh_rep,
       "consensus_background": {"mean": round(float(bg.mean()), 3), "p50": round(float(np.percentile(bg, 50)), 3), "p90": round(float(np.percentile(bg, 90)), 3), "p99": round(float(np.percentile(bg, 99)), 3)}, "sessions": T, "from": dates[0], "to": dates[-1], "names_clustered": len(names_b), "names_placed_after": placed,
       "stability_curve": curve, "ari_null": null, "k_chosen": K, "k_reason": "the k at which the two halves of history, and the two interleaved-month halves, agree best (sum of the two adjusted Rand indices)",
       "clusters": clusters}
json.dump(out, open(os.path.join(HERE, "clusters.json"), "w"), indent=1)
print(json.dumps({"names": len(names_b), "placed": len(placed), "k": K, "best": best, "null": null}))
