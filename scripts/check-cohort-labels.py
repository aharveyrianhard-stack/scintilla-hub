#!/usr/bin/env python3
"""M54 · check the claim that a block of cohort labels are just FMP industry names, machine-made.

Reads every distinct cohort label (both engines) and every FMP industry string on the Hub's own
profiles, normalises the industry the way a label generator would, and reports the exact overlap.
Nothing is written to any table. Output: data/cohort-label-origin-20260924.json
"""
import json, os, re, collections, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
s = open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="ignore").read()
SB = re.search(r'const SB\s*=\s*"([^"]+)"', s).group(1)
AN = re.search(r'"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]+)"', s).group(1)
H = {"apikey": AN, "Authorization": "Bearer " + AN}


def pg(path):
    with urllib.request.urlopen(urllib.request.Request(SB + "/rest/v1/" + path, headers=H), timeout=60) as r:
        return json.load(r)


rows, off = [], 0
while True:
    page = pg("ticker_cohorts?select=ticker,cohort&order=ticker.asc&offset=%d&limit=1000" % off)
    rows += page
    if len(page) < 1000:
        break
    off += 1000
old = pg("cohorts?select=ticker,cohort&limit=2000")
prof = pg("company_profile?select=ticker,industry,sector&limit=2000")

by_cohort = collections.defaultdict(set)
for r in rows + old:
    by_cohort[r["cohort"]].add(r["ticker"])

industries = {p["industry"] for p in prof if p.get("industry")}
norm = lambda s: re.sub(r"[^A-Z0-9]+", "_", s.upper()).strip("_")
ind_norm = {norm(i): i for i in industries}

machine = sorted(c for c in by_cohort if norm(c) in ind_norm)
hand = sorted(c for c in by_cohort if norm(c) not in ind_norm)
doc = {
    "claim_under_test": "47 cohort labels are FMP industry names, not cohorts Alan chose",
    "distinct_cohorts": len(by_cohort),
    "match_an_fmp_industry_name": len(machine),
    "do_not": len(hand),
    "plain_sentence": ("%d of the %d cohort labels are simply FMP's own industry names with the spaces "
                       "replaced — a machine made them from the data feed, nobody chose them; the other %d "
                       "are the cohorts that were chosen by hand." % (len(machine), len(by_cohort), len(hand))),
    "machine_made": [{"cohort": c, "fmp_industry": ind_norm[norm(c)], "names": len(by_cohort[c])} for c in machine],
    "chosen_by_hand_sample": hand[:40],
}
p = os.path.join(ROOT, "data", "cohort-label-origin-20260924.json")
json.dump(doc, open(p, "w"), indent=1)
print(doc["plain_sentence"])
print("wrote", p)
