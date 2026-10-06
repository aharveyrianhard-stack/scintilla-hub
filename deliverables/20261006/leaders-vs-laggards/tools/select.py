#!/usr/bin/env python3
"""LD1 · pick the leaders and the laggards among the AI / semis / software / grid cohorts.

Inputs (all already committed in this repo; nothing is fetched):
  - deliverables/20261006/cohort-proposal/proposal.json            CO1's cohort tree (who sits where)
  - deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv   daily closes 17 Mar -> 5 Oct 2026
  - deliverables/20261006/cohort-proposal/data/company_profile-20261006.json   name, industry, market value
  - deliverables/20261006/bt1-bowtie-check/data/geiger-as-live-page-received.json   the Hub Geiger, 6 Oct 14:53 ET

Rule: every company in the cohorts below is ranked on three things, each as a percentile inside the field:
  3-month return (63 sessions), 1-month return (21 sessions), the Hub Geiger. The score is the plain average.
  Leaders = the 25 highest scores. Laggards = the 20 lowest. The brief's named laggards are carried and marked
  with where they really rank, so a name that is not lagging on the numbers is shown as such.
Output: ../selection.json
"""
import csv, json, os, statistics

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
P = lambda *a: os.path.join(ROOT, *a)

COHORTS = [  # AI heading (9), SEMIS (2), SOFTWARE & INTERNET (3), and grid
    "AI_ACCELERATORS", "MEMORY_STORAGE", "AI_NETWORKING_OPTICAL", "AI_SERVERS_DC_KIT", "NEOCLOUDS_MINERS",
    "DC_PROPERTY", "AI_SOFTWARE_DATA", "AI_POWERTRAIN", "ROBOTICS_AUTOMATION",
    "SEMICAP_EDA", "ANALOG_RF_POWER",
    "CYBER", "INTERNET_PLATFORMS", "IT_SERVICES",
    "GRID_ELECTRICAL",
]
NAMED_LAGGARDS = ["CBRS", "CRWV", "IREN", "NBIS", "MU", "SNDK", "WDC", "STX"]  # the brief: "incl. CBRS, CRWV, IREN, NBIS, memory names if lagging"
N_LEAD, N_LAG = 25, 20
RUN_START = "2026-09-15"     # the low before the run: QQQ 705, SMH 542 (lowest closes since 3 Aug)
SELLOFF_START = "2026-06-30"  # QQQ and SMH peak before the summer fall

prop = json.load(open(P("deliverables/20261006/cohort-proposal/proposal.json")))
home = {}
labels = {}
for c in prop["cohorts"]:
    labels[c["id"]] = c["label"]
    if c["id"] in COHORTS:
        for t in c["members"]:
            home.setdefault(t, []).append(c["id"])
missing = [c for c in COHORTS if c not in labels]
assert not missing, missing

rows = list(csv.reader(open(P("deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv"))))
hdr, body = rows[0], rows[1:]
dates = [r[0] for r in body]
def series(t):
    if t not in hdr: return None
    i = hdr.index(t); out = []
    for r in body:
        try: out.append(float(r[i]))
        except Exception: out.append(None)
    return out
i_run, i_sell = dates.index(RUN_START), dates.index(SELLOFF_START)

prof = {r["ticker"]: r for r in json.load(open(P("deliverables/20261006/cohort-proposal/data/company_profile-20261006.json")))}
gj = json.load(open(P("deliverables/20261006/bt1-bowtie-check/data/geiger-as-live-page-received.json")))
geiger = {t: v.get("composite") for t, v in gj["symbols"].items()}

def ret(s, back):
    a, b = s[-1 - back], s[-1]
    return None if a in (None, 0) or b is None else b / a - 1

names = []
skipped = []
for t in sorted(home):
    s = series(t)
    p = prof.get(t, {})
    if p.get("is_etf") in (True, "true"): skipped.append([t, "fund"]); continue
    if s is None or s[-1] is None: skipped.append([t, "no closes on hand"]); continue
    r1, r3 = ret(s, 21), ret(s, 63)
    if r1 is None or r3 is None: skipped.append([t, "listed too recently for a 3-month return"]); continue
    seg = [x for x in s[i_sell:i_run + 1] if x is not None]
    names.append({
        "ticker": t, "name": p.get("name"), "industry": p.get("industry"), "cohorts": home[t],
        "cohort_labels": [labels[c] for c in home[t]],
        "close_last": s[-1], "close_last_date": dates[-1],
        "close_run_start": s[i_run], "close_selloff_start": s[i_sell],
        "close_3m_ago": s[-64], "date_3m_ago": dates[-64], "close_1m_ago": s[-22], "date_1m_ago": dates[-22],
        "r1m": r1, "r3m": r3,
        "r_run": None if s[i_run] in (None, 0) else s[-1] / s[i_run] - 1,           # 15 Sep close -> 5 Oct close
        "r_selloff": None if (s[i_sell] in (None, 0) or s[i_run] is None) else s[i_run] / s[i_sell] - 1,  # 30 Jun -> 15 Sep
        "worst_in_selloff": None if (s[i_sell] in (None, 0) or not seg) else min(seg) / s[i_sell] - 1,
        "vs_selloff_start": None if s[i_sell] in (None, 0) else s[-1] / s[i_sell] - 1,   # where it stands against the June peak
        "geiger": geiger.get(t), "market_cap_profile": p.get("market_cap"),
    })

def pct(key):
    vals = sorted(n[key] for n in names if n[key] is not None)
    for n in names:
        v = n[key]
        n["pct_" + key] = None if v is None else sum(1 for x in vals if x <= v) / len(vals)
for k in ("r3m", "r1m", "geiger"): pct(k)
for n in names:
    ps = [n["pct_r3m"], n["pct_r1m"], n["pct_geiger"]]
    ps = [p for p in ps if p is not None]
    n["score"] = sum(ps) / len(ps)
    n["score_parts"] = len(ps)
names.sort(key=lambda n: -n["score"])
for i, n in enumerate(names): n["rank"] = i + 1
N = len(names)
leaders = names[:N_LEAD]
laggards = names[-N_LAG:][::-1]  # weakest first
for n in names:
    n["group"] = "leader" if n in leaders else ("laggard" if n in laggards else "middle")
named = [{"ticker": t, "rank": next((n["rank"] for n in names if n["ticker"] == t), None), "of": N,
          "group": next((n["group"] for n in names if n["ticker"] == t), "not ranked")} for t in NAMED_LAGGARDS]

def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None
by_cohort = []
for c in COHORTS:
    ms = [n for n in names if c in n["cohorts"]]
    by_cohort.append({"cohort": c, "label": labels[c], "n": len(ms), "median_r3m": med(n["r3m"] for n in ms), "median_r1m": med(n["r1m"] for n in ms),
                      "median_r_run": med(n["r_run"] for n in ms), "median_geiger": med(n["geiger"] for n in ms),
                      "leaders": [n["ticker"] for n in ms if n["group"] == "leader"], "laggards": [n["ticker"] for n in ms if n["group"] == "laggard"]})
bench = {}
for t in ("SPY", "QQQ", "RSP", "SMH", "IGV", "CIBR", "XLU"):
    s = series(t)
    if s: bench[t] = {"r1m": ret(s, 21), "r3m": ret(s, 63), "r_run": s[-1] / s[i_run] - 1, "r_selloff": s[i_run] / s[i_sell] - 1, "vs_selloff_start": s[-1] / s[i_sell] - 1}

out = {"what": "LD1 selection: leaders and laggards among the AI / semis / software / grid cohorts",
       "rule": "score = average of three percentiles inside the field: 3-month return (63 sessions), 1-month return (21 sessions), Hub Geiger; top 25 = leaders, bottom 20 = laggards",
       "closes_through": dates[-1], "geiger_published_utc": gj.get("published_utc"), "run_start": RUN_START, "selloff_start": SELLOFF_START,
       "field": N, "cohorts": COHORTS, "skipped": skipped, "named_in_brief": named, "benchmarks": bench, "by_cohort": by_cohort,
       "leaders": leaders, "laggards": laggards, "all": names}
json.dump(out, open(os.path.join(HERE, "..", "selection.json"), "w"), indent=1)
f = lambda v: "   n/a" if v is None else f"{v*100:6.1f}"
print("field", N, "skipped", skipped)
print("benchmarks", {k: {a: round(b, 3) for a, b in v.items()} for k, v in bench.items()})
for title, grp in (("LEADERS", leaders), ("LAGGARDS", laggards)):
    print(title)
    for n in grp:
        print(f" {n['rank']:3d} {n['ticker']:5s} 3M {f(n['r3m'])} 1M {f(n['r1m'])} run {f(n['r_run'])} selloff {f(n['r_selloff'])} G {n['geiger'] if n['geiger'] is None else round(n['geiger'],2)}  {','.join(n['cohorts'])}")
print("named:", named)
for c in sorted(by_cohort, key=lambda c: -(c["median_r1m"] or -9)):
    print(f" {c['label'][:34]:34s} n{c['n']:3d} med 3M {f(c['median_r3m'])} 1M {f(c['median_r1m'])} run {f(c['median_r_run'])} G {c['median_geiger'] and round(c['median_geiger'],2)}  L:{len(c['leaders'])} lag:{len(c['laggards'])}")
