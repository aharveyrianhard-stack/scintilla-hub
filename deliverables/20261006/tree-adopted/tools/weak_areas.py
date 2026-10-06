#!/usr/bin/env python3
"""TR1 · weak areas: from CO1's gaps list, the eight biggest by market weight, three candidate names each.
Weight = the S&P 500 sub-industry's share of SPY (CO1: SSgA holdings file, 22 Sep 2026). A sub-industry where the S&P
has ONE name and we already hold it (Berkshire, Deere, Uber, Newmont, Prologis, Freeport) is complete, not weak, and
is skipped — said on the page. Where the S&P list gives fewer than three names we do not hold, the row is filled from
outside the S&P 500 and those names are marked: they are from memory of the industry (ESTIMATE), not from a provider
read, and the provider's gap report decides whether any name can be admitted."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.dirname(HERE); CO1 = os.path.join(os.path.dirname(D), "cohort-proposal")
G = json.load(open(os.path.join(CO1, "gaps.json"))); SERVED = set(json.load(open(os.path.join(CO1, "data", "universe-20261006.json")))["symbols"])
# names outside the S&P 500 list CO1 read, used only to reach three (ESTIMATE: industry knowledge, not a provider read)
FILL = {"Broadline Retail": [("CPNG", "Coupang"), ("ETSY", "Etsy")], "Heavy Electrical Equipment": [("FLNC", "Fluence Energy"), ("POWL", "Powell Industries")],
        "Automotive Retail": [("KMX", "CarMax")]}
ALSO = {"Broadline Retail": "outside the S&P we also hold MELI, PDD, BABA, JD (in LATAM / CHINA)", "Heavy Electrical Equipment": "outside the S&P we also hold BE, SMR, OKLO",
        "Regional Banks": "we hold seven regional banks, but none of the six in the S&P 500"}
rows, skipped = [], []
for r in sorted(G["gics_sub_industries_thin"], key=lambda r: -r["spy_weight_pct"]):
    cands = [dict(ticker=c["ticker"], name=c["name"].title(), spy_weight_pct=c.get("spy_weight_pct"), basis="S&P 500 member (CO1)") for c in r["candidates"] if c["ticker"] not in SERVED]
    for t, n in FILL.get(r["gics_sub_industry"], []):
        if len(cands) < 3 and t not in SERVED: cands.append(dict(ticker=t, name=n, spy_weight_pct=None, basis="outside the S&P 500 (ESTIMATE)"))
    if not r["candidates"]: skipped.append(dict(sub_industry=r["gics_sub_industry"], spy_weight_pct=r["spy_weight_pct"], we_hold=r["we_hold"], why="the S&P has one name here and we hold it")); continue
    if len(cands) < 3: skipped.append(dict(sub_industry=r["gics_sub_industry"], spy_weight_pct=r["spy_weight_pct"], we_hold=r["we_hold"], why=f"only {len(cands)} candidate(s) to offer: {[c['ticker'] for c in cands]}")); continue
    rows.append(dict(rank=len(rows) + 1, sub_industry=r["gics_sub_industry"], sector=r["gics_sector"], spy_weight_pct=r["spy_weight_pct"], sp500_names=r["sp500_names"], we_hold=r["we_hold"], also=ALSO.get(r["gics_sub_industry"]), candidates=cands[:3]))
    if len(rows) == 8: break
json.dump(dict(what="the eight biggest weak areas by S&P 500 weight, three candidates each; proposals only", source="CO1 gaps.json (gics_sub_industries_thin)", weak=rows, skipped_above_the_eighth=skipped), open(os.path.join(D, "weak-areas.json"), "w"), indent=1)
for r in rows: print(r["rank"], r["spy_weight_pct"], r["sub_industry"], r["we_hold"], [c["ticker"] for c in r["candidates"]])
print("skipped:", [(s["sub_industry"], s["why"][:40]) for s in skipped])
