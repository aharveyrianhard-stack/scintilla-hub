#!/usr/bin/env python3
"""TREE COHORTS (28 Sep, lane N5) · the saved charts. Every chart is a PNG in ../charts/. House look: dark panel, greys,
green = up / passes, red = down / fails, Helvetica, body text 11 px or larger. One axis per chart, direct labels."""
import json, os, sys
import numpy as np
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.patches import Rectangle

HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "charts"); os.makedirs(OUT, exist_ok=True)
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
CR = json.load(open(os.path.join(HERE, "critique.json"))); CL = json.load(open(os.path.join(HERE, "clusters.json"))); PR = json.load(open(os.path.join(HERE, "..", "proposed-cohorts.json")))
CT = json.load(open(os.path.join(ROOT, "deliverables/20260928/coverage-tree/coverage-tree.json")))
GEI = json.load(open(os.path.join(ROOT, "deliverables/20260928/coverage-tree/data/geiger-snapshot-20260928.json")))["symbols"]
G = json.load(open(sys.argv[1]))
BG, INK, INK2, MUTED, GRID = "#07070C", "#B4B4C6", "#C8C8D2", "#9C9CAE", "#24242E"
GREEN, RED = "#00FFA3", "#FF2D55"
G1, G2, G3 = "#9A9AAE", "#63637A", "#3C3C4C"
plt.rcParams.update({"font.family": "Helvetica Neue", "font.size": 11, "text.color": INK, "axes.labelcolor": INK, "xtick.color": MUTED, "ytick.color": MUTED,
                     "axes.edgecolor": GRID, "axes.facecolor": BG, "figure.facecolor": BG, "savefig.facecolor": BG, "axes.grid": False, "axes.spines.top": False, "axes.spines.right": False})
def fig(w=13, h=6):
    f, ax = plt.subplots(figsize=(w, h), dpi=110); return f, ax
def save(f, name):
    f.tight_layout(); f.savefig(os.path.join(OUT, name)); plt.close(f); print("saved", name)
def title(ax, t, sub=None):
    ax.set_title(t, loc="left", color=INK2, fontsize=14, pad=30 if sub else 10)
    if sub: ax.text(0, 1.012, sub, transform=ax.transAxes, color=MUTED, fontsize=11, va="bottom")

# 1 · cohesion of each label against random sets of the same size
coh = CR["cohesion"]; null = CR["null_same_size"]
def n95(n):
    ks = sorted(int(k) for k in null); k = min(ks, key=lambda x: abs(x - n)); return null[str(k)]
rows = [(k, v["mean_pair_corr"], n95(v["n"]), v["n"]) for k, v in coh.items() if v.get("mean_pair_corr") is not None]
rows.sort(key=lambda r: r[1])
f, ax = fig(13, 11)
y = np.arange(len(rows))
for i, (k, c, nz, n) in enumerate(rows):
    ax.plot([nz["5"], nz["95"]], [i, i], color=G3, lw=6, solid_capstyle="butt")
    ax.plot(c, i, "o", color=GREEN if c > nz["95"] else RED, ms=7)
    ax.text(0.83, i, f"{c:.2f}  ·  {n} names", va="center", color=MUTED, fontsize=11)
ax.set_yticks(y); ax.set_yticklabels([r[0].replace("_", " ") for r in rows], fontsize=11); ax.set_xlim(-0.05, 1.0)
ax.set_xlabel("mean correlation between members' daily Geigers, 750 sessions to 2026-09-25")
title(ax, "Which labels are cohorts: members that move together, against random sets of the same size", "dot = the label · dark band = the 5th to 95th point of 300 random sets of the same size · green above the band, red inside it")
save(f, "1-cohesion.png")

# 2 · overlap between the 36 cohorts
keys = [c["key"] for c in CT["cohorts"]]; mem = {c["key"]: set(c["members"]) for c in CT["cohorts"]}
M = np.zeros((len(keys), len(keys)))
for i, a in enumerate(keys):
    for j, b in enumerate(keys):
        if i != j and mem[a] and mem[b]: M[i, j] = len(mem[a] & mem[b]) / min(len(mem[a]), len(mem[b]))
f, ax = fig(12, 11)
im = ax.imshow(M, cmap=matplotlib.colors.LinearSegmentedColormap.from_list("g", [BG, "#D2D2DC"]), vmin=0, vmax=1)
ax.set_xticks(range(len(keys))); ax.set_xticklabels([k.replace("_", " ") for k in keys], rotation=90, fontsize=10); ax.set_yticks(range(len(keys))); ax.set_yticklabels([k.replace("_", " ") for k in keys], fontsize=10)
for i in range(len(keys)):
    for j in range(len(keys)):
        if M[i, j] >= 0.75 and i != j: ax.text(j, i, f"{M[i, j]:.0%}" if M[i, j] < 1 else "all", ha="center", va="center", fontsize=8, color=BG)
cb = f.colorbar(im, ax=ax, fraction=0.03, pad=0.02); cb.set_label("share of the smaller cohort held by the larger", color=MUTED); cb.ax.yaxis.set_tick_params(color=MUTED); plt.setp(cb.ax.get_yticklabels(), color=MUTED)
title(ax, "How the 36 cohorts overlap: share of the smaller cohort that sits inside the larger", "row = the smaller side; 'all' = one cohort is wholly inside the other")
save(f, "2-overlap.png")

# 3 · the stability curve
cv = CL["stability_curve"]
f, ax = fig(13, 5.5)
ax.plot([r["k"] for r in cv], [r["ari_halves"] for r in cv], color=G1, lw=2); ax.text(cv[-1]["k"] + 0.5, cv[-1]["ari_halves"], "first half vs second half", color=G1, va="center")
ax.plot([r["k"] for r in cv], [r["ari_months"] for r in cv], color=INK2, lw=2); ax.text(cv[-1]["k"] + 0.5, cv[-1]["ari_months"], "odd months vs even months", color=INK2, va="center")
nz = max(n["ari_shuffled_p95"] for n in CL["ari_null"]); ax.axhline(nz, color=RED, lw=1, ls=":"); ax.text(4, nz + 0.01, "shuffled labels, 95th point", color=RED, fontsize=10)
ax.axvline(CL["k_chosen"], color=GRID, lw=1); ax.text(CL["k_chosen"] + 0.4, 0.02, f"{CL['k_chosen']} groups: the start of the plateau", color=MUTED, fontsize=10)
ax.set_xlabel("number of groups asked for"); ax.set_ylabel("agreement between the two halves (adjusted Rand)"); ax.set_xlim(4, 68); ax.set_ylim(0, 0.42)
title(ax, "How many co-movement groups the names really form: agreement of two halves of history, by group count", "337 served single names with a year of readings in both halves · Ward clustering on 1 − correlation of the daily Geiger")
save(f, "3-stability.png")

# 4 · how many groups each cohort spans
sp = CL["cohort_span"]
rows = sorted(((k, v["groups"], v["largest_share"], v["members_clustered"], CL["cohort_reproducibility"].get(k)) for k, v in sp.items()), key=lambda r: r[2])
f, ax = fig(13, 11)
for i, (k, g, ls, n, rp) in enumerate(rows):
    ax.barh(i, ls, color=G2, height=0.62)
    ax.text(ls + 0.01, i, f"{ls:.0%} in its largest group  ·  {g} groups  ·  {n} names  ·  reproducibility {rp:.2f}", va="center", color=MUTED, fontsize=11)
ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0].replace("_", " ") for r in rows], fontsize=11); ax.set_xlim(0, 1.75); ax.set_xticks([0, 0.25, 0.5, 0.75, 1]); ax.set_xticklabels(["0", "25%", "50%", "75%", "100%"])
ax.set_xlabel("share of the cohort's members that fall in one co-movement group")
title(ax, "Whole or scattered: the share of each cohort that sits in one co-movement group (53 groups)", "reproducibility = how often the cohort's pairs land together across both halves of history and every group count from 20 to 60 (0 never, 1 always)")
save(f, "4-span.png")

# 5 · thin cohorts: noise of a mean of n
th = CR["thin"]
f, ax = fig(11, 5)
ax.plot([t["n"] for t in th], [t["daily_change_sd_median"] for t in th], color=INK2, lw=2, marker="o", ms=6)
ax.fill_between([t["n"] for t in th], [t["p5"] for t in th], [t["p95"] for t in th], color=G3, alpha=0.8, lw=0)
for t in th:
    if t["n"] in (1, 2, 3, 5, 10, 20, 50): ax.text(t["n"], t["daily_change_sd_median"] + 0.006, f"{t['daily_change_sd_median']:.3f}", ha="center", color=MUTED, fontsize=10)
ax.set_xscale("log"); ax.set_xticks([1, 2, 3, 5, 10, 20, 50]); ax.set_xticklabels(["1", "2", "3", "5", "10", "20", "50"]); ax.set_xlabel("names averaged"); ax.set_ylabel("spread of the bar's day-to-day change")
title(ax, "How much a cohort bar jumps day to day, by the number of names in it", "median of 200 random sets at each size, band = 5th to 95th · a 2-name bar moves twice as much as a 20-name bar")
save(f, "5-thin.png")

# 6 · parent fit on history
pf = CR["parent_fit"]; COH = {c["key"]: c for c in CT["cohorts"]}
rows = []
for k, v in pf.items():
    par = v["etf_parent"]; pc = next((c["corr_history"] for c in v["candidates"] if c["fund"] == par), None)
    best = max((c for c in v["candidates"] if c["corr_history"] is not None), key=lambda c: c["corr_history"], default=None)
    rows.append((k, par, pc, best["fund"] if best else None, best["corr_history"] if best else None, v["yardsticks"].get("sector_fund", {}).get("corr_history"), v["yardsticks"].get("SPY", {}).get("corr_history")))
rows.sort(key=lambda r: (r[2] if r[2] is not None else (r[4] if r[4] is not None else -1)))
f, ax = fig(13, 11)
for i, (k, par, pc, bf, bc, sc, spy) in enumerate(rows):
    if spy is not None: ax.plot(spy, i, "|", color=G2, ms=12, mew=2)
    if sc is not None: ax.plot(sc, i, "|", color=G1, ms=12, mew=2)
    if pc is not None: ax.plot(pc, i, "o", color=GREEN if (sc is None or pc >= sc) else RED, ms=7)
    if bc is not None and bf != par: ax.plot(bc, i, "o", mfc="none", mec=INK2, ms=9)
    ax.text(1.02, i, (f"{par} {pc:.2f}" if pc is not None else "no parent") + (f"  ·  best {bf} {bc:.2f}" if bc is not None and bf != par else ""), va="center", color=MUTED, fontsize=10.5)
ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0].replace("_", " ") for r in rows], fontsize=11); ax.set_xlim(-0.1, 1.45); ax.set_xticks([0, 0.25, 0.5, 0.75, 1])
ax.set_xlabel("correlation of the fund's own daily Geiger with the cohort's mean, 750 sessions")
title(ax, "Does the parent fund move with its cohort? Today's parent (dot), the best holding fund (ring), the sector fund and SPY (ticks)", "green dot = the parent beats the majority-sector fund (light tick); red = it does not; dark tick = SPY")
save(f, "6-parent-fit.png")

# 7 · index funds' Geiger range against single names
def arr(s): return np.array([np.nan if x is None else x for x in G["symbols"][s]["composite"]], dtype=float)
FUNDS = {n["ticker"] for n in CT["nodes"] if n["kind"] == "fund"}
idx = ["SPY", "RSP", "QQQ", "QQQE", "DIA", "MDY", "IWM", "IJR", "VTI", "MAGS", "EFA", "EEM", "GLD", "TLT"]
pooled = np.concatenate([arr(s)[~np.isnan(arr(s))] for s in G["symbols"] if s not in FUNDS])
rows = [("single names, pooled", pooled)] + [(s, arr(s)[~np.isnan(arr(s))]) for s in idx if s in G["symbols"]]
f, ax = fig(13, 7)
for i, (lab, v) in enumerate(rows):
    p = np.percentile(v, [1, 5, 25, 50, 75, 95, 99])
    ax.plot([p[0], p[6]], [i, i], color=G3, lw=3); ax.plot([p[1], p[5]], [i, i], color=G2, lw=7); ax.plot([p[2], p[4]], [i, i], color=G1, lw=11)
    ax.plot(p[3], i, "|", color=BG, ms=14, mew=2)
    today = GEI.get(lab, {}).get("composite")
    if today is not None: ax.plot(today, i, "o", color=GREEN if today >= 0 else RED, ms=8)
    ax.text(1.03, i, f"1%: {p[0]:+.2f}   5%: {p[1]:+.2f}   median {p[3]:+.2f}   95%: {p[5]:+.2f}   99%: {p[6]:+.2f}" + (f"   today {today:+.2f}" if today is not None else ""), va="center", color=MUTED, fontsize=10)
ax.set_yticks(range(len(rows))); ax.set_yticklabels([r[0] for r in rows], fontsize=11); ax.set_xlim(-1.05, 2.3); ax.set_xticks([-1, -0.5, 0, 0.5, 1]); ax.axvline(0, color=GRID, lw=1)
ax.set_xlabel("daily-rung Geiger composite, every session 2023-09-29 to 2026-09-25")
title(ax, "An index fund's Geiger lives in a narrower band than a stock's: the range each spends its days in", "bars: 1st to 99th point (dark), 5th to 95th, 25th to 75th (light); notch = median; dot = today's live reading (green up, red down)")
save(f, "7-index-range.png")

# 8 · the INDEX-FUNDS bow tie, drawn from today's readings, with the holdings blend
COV = CT["coverage"]
def blend(fund):
    rows = [(t, w) for t, w in COV.get(fund, {}).get("served", []) if GEI.get(t, {}).get("composite") is not None]
    if not rows: return None, 0, 0
    W = sum(w for t, w in rows); return sum(GEI[t]["composite"] * w for t, w in rows) / W, len(rows), COV[fund]["coverage_pct"]
cols = []
for s in ["SPY", "RSP", "QQQ", "QQQE", "DIA", "MDY", "IWM", "IJR", "VTI", "MAGS", "ITOT", "IWV"]:
    g = GEI.get(s, {}).get("composite")
    if g is None: continue
    b, n, cov = blend(s); cols.append((s, g, b, n, cov))
cols.sort(key=lambda c: -c[1])
f, ax = fig(13, 5.5)
x = np.arange(len(cols))
for i, (s, g, b, n, cov) in enumerate(cols):
    ax.bar(i - 0.2, g, width=0.38, color=GREEN if g >= 0 else RED)
    if b is not None: ax.bar(i + 0.2, b, width=0.38, color=GREEN if b >= 0 else RED, hatch="////", edgecolor=BG, lw=0, alpha=0.75)
    ax.text(i - 0.2, g + (0.03 if g >= 0 else -0.06), f"{g:+.2f}", ha="center", color=INK2, fontsize=10)
    if b is not None: ax.text(i + 0.2, b + (0.03 if b >= 0 else -0.06), f"{b:+.2f}", ha="center", color=MUTED, fontsize=10)
    ax.text(i, -1.08, f"{n} names\n{cov:.0f}% of fund", ha="center", va="top", color=MUTED, fontsize=9.5)
ax.axhline(0, color=GRID, lw=1); ax.set_xticks(x); ax.set_xticklabels([c[0] for c in cols], fontsize=11); ax.set_ylim(-1.35, 1.1); ax.set_yticks([-1, -0.5, 0, 0.5, 1]); ax.set_ylabel("Geiger composite")
title(ax, "INDEX FUNDS bow tie, today: each fund's own Geiger (solid) beside the blend of the holdings we serve (striped)", f"readings from the chart API snapshot of {GEI and '2026-09-28 16:05 UTC'} · sorted best to worst · the gap between the two bars is the divergence line")
save(f, "8-bowtie-index.png")

# 9 · the proposed cohorts' bow tie today
rows = []
for c in PR["cohorts"]:
    vals = [GEI[t]["composite"] for t in c["members"] if GEI.get(t, {}).get("composite") is not None]
    if len(vals) >= 2: rows.append((c["label"], float(np.mean(vals)), len(vals), c["kind"]))
rows.sort(key=lambda r: -r[1])
f, ax = fig(15, 7)
for i, (lab, g, n, kind) in enumerate(rows):
    ax.bar(i, g, width=0.7, color=GREEN if g >= 0 else RED, alpha=1 if kind == "curated" else 0.6)
    ax.text(i, g + (0.02 if g >= 0 else -0.05), f"{g:+.2f}", ha="center", color=INK2, fontsize=9.5, rotation=0)
    ax.text(i, -1.02, str(n), ha="center", va="top", color=MUTED, fontsize=9.5)
ax.axhline(0, color=GRID, lw=1); ax.set_xticks(range(len(rows))); ax.set_xticklabels([r[0] for r in rows], rotation=60, ha="right", fontsize=9.5); ax.set_ylim(-1.15, 1.05); ax.set_ylabel("mean Geiger of the members")
title(ax, "The proposed cohorts as a bow tie, today: mean Geiger of each cohort's served members, best to worst", "number under each column = names averaged (R6) · lighter columns = fund cohorts and data-found groups, full columns = curated cohorts")
save(f, "9-bowtie-cohorts.png")

# 10 · the 216 admissions: what they add to, by verdict
A = PR["admissions"]["rows"]
import collections
byf = collections.defaultdict(collections.Counter)
for r in A:
    for fnd in r["funds"]: byf[fnd][r["verdict"]] += 1
funds = sorted(byf, key=lambda fnd: -sum(byf[fnd].values()))
f, ax = fig(14, 6)
order = ["KEEP · FULL", "KEEP · SCOUT", "DROP"]; colors = {"KEEP · FULL": INK2, "KEEP · SCOUT": G2, "DROP": "#2A2A36"}
bottom = np.zeros(len(funds))
for v in order:
    vals = np.array([byf[fnd][v] for fnd in funds]); ax.bar(range(len(funds)), vals, bottom=bottom, color=colors[v], width=0.7, edgecolor=BG if v != "DROP" else G2, lw=1, hatch="///" if v == "DROP" else None); bottom += vals
ax.set_xticks(range(len(funds))); ax.set_xticklabels(funds, rotation=60, ha="right", fontsize=10); ax.set_ylabel("of the 216, how many add weight to this fund")
for v, y_ in zip(order, (0.95, 0.88, 0.81)):
    ax.add_patch(Rectangle((0.90, y_ - 0.02), 0.03, 0.05, transform=ax.transAxes, color=colors[v], hatch="///" if v == "DROP" else None, ec=G2 if v == "DROP" else BG))
    ax.text(0.94, y_, v, transform=ax.transAxes, ha="left", va="center", color=INK2, fontsize=11)
title(ax, "The 216 proposed admissions are the heaviest un-served lines of 36 funds across the tree, not of IWM alone", f"only {PR['admissions']['iwm_only']} of the 216 add weight to IWM alone; {PR['admissions']['touch_small_or_mid']} touch IWM, IJR or MDY at all · a name counts once per fund it sits in")
save(f, "10-admissions.png")
