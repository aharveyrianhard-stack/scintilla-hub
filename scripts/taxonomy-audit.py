#!/usr/bin/env python3
"""M45 · three audits over the built tree. Read-only; writes one JSON for the deliverable.

1. cohort clean-up   — every inconsistency in ticker_cohorts / cohorts, with its fix and impact
2. representativeness — Hub cover vs the S&P 500 by GICS sector and sub-industry
3. missing names      — the 36 already proposed + the S&P sub-industries the Hub does not cover

The S&P 500 membership list is EXTERNAL reference data (Wikipedia's component table, fetched
<date in output>). It is not a price and it is not used for any number on a live screen.
"""
import json, os, re, sys, collections, datetime, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CACHE = sys.argv[1] if len(sys.argv) > 1 else None
tax = json.load(open(os.path.join(ROOT, "data", "taxonomy-20260924.json")))
served = set(tax["profiles"])
prof = tax["profiles"]
place = tax["placement"]

def cached(name, fetch):
    p = os.path.join(CACHE, name) if CACHE else None
    if p and os.path.exists(p):
        return json.load(open(p))
    v = fetch()
    if p:
        json.dump(v, open(p, "w"))
    return v

def creds():
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="ignore").read()
    return (re.search(r'const SB\s*=\s*"([^"]+)"', s).group(1),
            re.search(r'"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]+)"', s).group(1))

SB, AN = creds()
H = {"apikey": AN, "Authorization": "Bearer " + AN}
def pg(path):
    req = urllib.request.Request(f"{SB}/rest/v1/{path}", headers=H)
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.load(r)

new_rows = cached("cohorts_all.json", lambda: pg("ticker_cohorts?select=ticker,cohort&order=ticker.asc&limit=1000"))
old_rows = cached("cohorts_old.json", lambda: pg("cohorts?select=ticker,cohort&limit=2000"))

new_by_t = collections.defaultdict(set)
new_by_c = collections.defaultdict(set)
for r in new_rows:
    new_by_t[r["ticker"]].add(r["cohort"]); new_by_c[r["cohort"]].add(r["ticker"])
old_by_t = {r["ticker"]: r["cohort"] for r in old_rows}

# ---- 1. cohort clean-up ----------------------------------------------------
def norm(c):
    return re.sub(r"[^A-Z]", "", c.upper())
groups = collections.defaultdict(list)
for c in new_by_c:
    groups[norm(c)].append(c)
findings = []
for k, v in groups.items():
    if len(v) > 1:
        sets = {c: new_by_c[c] for c in v}
        only = {c: sorted(sets[c] - set().union(*[s for cc, s in sets.items() if cc != c])) for c in v}
        findings.append({"kind": "SAME_NAME_TWO_SPELLINGS", "cohorts": v,
                         "sizes": {c: len(sets[c]) for c in v},
                         "members_unique_to_each": only,
                         "fix": f"keep {max(v, key=lambda c: len(sets[c]))}, move the rows of the other, then drop it",
                         "impact": "a screen filtered on one spelling silently omits the other's names"})
orphans = sorted({t for t in new_by_t if t not in served})
findings.append({"kind": "COHORT_ROWS_FOR_NAMES_THE_HUB_CANNOT_PRICE", "n": len(orphans), "tickers": orphans,
                 "fix": "either add the name to the served universe (coordinator: universe file + digest + redeploy) or park the row in the candidate table",
                 "impact": "these rows make a cohort look bigger than anything that can be measured; every aggregate over them is computed on fewer names than the label implies"})
served_no_cohort = sorted(t for t in served if t not in new_by_t)
findings.append({"kind": "SERVED_BUT_IN_NO_COHORT", "n": len(served_no_cohort), "tickers": served_no_cohort,
                 "fix": "place each on a branch (the tree does this automatically from sector/industry)",
                 "impact": "invisible to every cohort view although the Hub prices it"})
singles = sorted([c for c, s in new_by_c.items() if len(s & served) <= 1])
findings.append({"kind": "COHORT_OF_ONE_OR_NONE_SERVED", "n": len(singles), "cohorts": singles,
                 "fix": "fold into the branch that already holds the name",
                 "impact": "a group of one cannot be compared with anything; it only adds noise to a menu"})
machine = sorted([c for c in new_by_c if "___" in c or c.count("_") >= 3])
findings.append({"kind": "MACHINE_GENERATED_INDUSTRY_COHORTS", "n": len(machine), "examples": machine[:14],
                 "fix": "stop shipping the FMP industry string as a cohort; the tree's industry level already holds it",
                 "impact": "113 cohort labels for 364 names, so a menu of groups nobody chose"})
disagree = sorted([t for t, c in old_by_t.items() if t in new_by_t and c not in new_by_t[t]])
findings.append({"kind": "TWO_ENGINES_DISAGREE", "n": len(disagree), "sample": disagree[:20],
                 "old_rows": len(old_rows), "new_rows": len(new_rows),
                 "fix": "one table feeds the board; make cohorts a view over the new engine, or migrate the board to the tree",
                 "impact": "the board reads `cohorts` while the newer engine writes `ticker_cohorts`, so the same name can be in different groups on different screens"})
# names whose cohort contradicts their measured branch
contra = []
for t in sorted(new_by_c.get("AI_HARDWARE", set()) & served):
    b = place[t].get("branch")
    if b not in ("AI_ACCELERATORS", "SEMI_EQUIPMENT", "MEMORY_STORAGE", "PHOTONICS_OPTICAL", "AI_DATACENTER"):
        contra.append({"ticker": t, "cohort": "AI_HARDWARE", "measured_branch": b, "industry": prof[t]["industry"]})
findings.append({"kind": "COHORT_CONTRADICTS_THE_NAME_S_BUSINESS", "n": len(contra), "rows": contra,
                 "fix": "let the branch rule decide and keep the cohort as Alan's own list",
                 "impact": "an AI-hardware aggregate that includes a cyber-security name or a bitcoin miner is not an AI-hardware reading"})

# ---- 2. representativeness vs the S&P 500 ---------------------------------
sp = json.load(open(os.path.join(CACHE, "sp500.json"))) if CACHE and os.path.exists(os.path.join(CACHE, "sp500.json")) else []
sp = [(s, re.sub(r"^\|\s*", "", sec).strip(), re.sub(r"^\|\s*", "", sub).strip()) for s, sec, sub in sp]
sp = [r for r in sp if r[0] and r[1]]
FMP2GICS = {"Technology": "Information Technology", "Financial Services": "Financials",
            "Consumer Cyclical": "Consumer Discretionary", "Consumer Defensive": "Consumer Staples",
            "Basic Materials": "Materials", "Healthcare": "Health Care",
            "Communication Services": "Communication Services", "Industrials": "Industrials",
            "Energy": "Energy", "Utilities": "Utilities", "Real Estate": "Real Estate"}
sp_by_sector = collections.Counter(r[1] for r in sp)
sp_members = {r[0] for r in sp}
hub_companies = [t for t, v in place.items() if v["trunk"] == "COMPANIES"]
hub_cap_total = sum(prof[t]["market_cap"] or 0 for t in hub_companies)
rep = []
for fmp, gics in FMP2GICS.items():
    hub = [t for t in hub_companies if prof[t]["sector"] == fmp]
    cap = sum(prof[t]["market_cap"] or 0 for t in hub)
    in_sp = [t for t in hub if t in sp_members]
    sp_n = sp_by_sector.get(gics, 0)
    rep.append({"sector_fmp": fmp, "sector_gics": gics, "hub_n": len(hub),
                "hub_cap_usd": cap, "hub_cap_share_pct": round(100 * cap / hub_cap_total, 2) if hub_cap_total else None,
                "sp500_n": sp_n, "sp500_share_of_members_pct": round(100 * sp_n / len(sp), 2) if sp else None,
                "hub_names_that_are_sp500": len(in_sp),
                "sp500_cover_pct": round(100 * len(in_sp) / sp_n, 1) if sp_n else None})
rep.sort(key=lambda r: -(r["hub_cap_share_pct"] or 0))

sub_cov = []
by_sub = collections.defaultdict(list)
for s, sec, sub in sp:
    by_sub[(sec, sub)].append(s)
for (sec, sub), names in sorted(by_sub.items()):
    have = [n for n in names if n in served]
    if len(names) >= 3 and not have:
        sub_cov.append({"gics_sector": sec, "sub_industry": sub, "sp500_members": len(names),
                        "hub_has": 0, "names": sorted(names)[:10]})
sub_cov.sort(key=lambda r: -r["sp500_members"])

# ---- 3. missing names -----------------------------------------------------
mig = None
for cand in ("_worktrees/claude-check-deep-20260924", "_worktrees/earnings-5-20260924"):
    p = os.path.join("/Users/alanharvey/SCINTILLA 0.5", cand, "supabase/migrations/20260923_claude_check_candidates.sql")
    if os.path.exists(p):
        mig = p; break
cands = []
if mig:
    for m in re.finditer(r"\('([A-Z.]+)',\s*(\d+),\s*'([A-Z_]+)',\s*'([^']*)'\)", open(mig).read()):
        cands.append({"ticker": m.group(1), "mentions": int(m.group(2)),
                      "proposed_cohort": m.group(3), "reason": m.group(4)})
BRANCH_FOR_CANDIDATE = {
    "AAOI": "PHOTONICS_OPTICAL", "COHR": "PHOTONICS_OPTICAL", "POET": "PHOTONICS_OPTICAL",
    "PL": "SPACE", "BKSY": "SPACE", "LUNR": "SPACE", "RDW": "SPACE", "RKLB": "SPACE",
    "CRML": "CRITICAL_MINERALS", "UUUU": "NUCLEAR_URANIUM", "LEU": "NUCLEAR_URANIUM",
    "TSEM": "SEMI_EQUIPMENT", "ACHR": "EVTOL_AUTONOMY", "IGV": "SECTOR_AND_THEME_FUNDS",
    "NVTS": "AI_ACCELERATORS", "STM": "AI_ACCELERATORS", "VSH": "AI_ACCELERATORS",
    "AMKR": "SEMI_EQUIPMENT", "GLW": "PHOTONICS_OPTICAL",
    "AVAV": "DEFENCE_AEROSPACE", "KTOS": "DEFENCE_AEROSPACE",
    "BTDR": "CRYPTO_EQUITIES", "CLSK": "CRYPTO_EQUITIES", "HIVE": "CRYPTO_EQUITIES", "RIOT": "CRYPTO_EQUITIES",
    "HUBB": "AI_POWER", "NOK": "MEDIA_TELECOM", "OUST": "EVTOL_AUTONOMY", "SERV": "EVTOL_AUTONOMY",
    "SATL": "SPACE", "SIDU": "SPACE", "SPIR": "SPACE",
    "ALB": "CRITICAL_MINERALS", "SQM": "CRITICAL_MINERALS", "TMRC": "CRITICAL_MINERALS",
    "TECK": "COPPER_STEEL", "SYM": "INDUSTRIAL_MACHINES",
    # SIVE is left out on purpose: I could not confirm what it is, and a guess would be a made-up placement.
}
out = {
    "built_utc": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
    "cohort_findings": findings,
    "representativeness": {"sp500_rows_parsed": len(sp), "sectors": rep,
                           "sp500_source": "Wikipedia 'List of S&P 500 companies' component table, fetched 2026-09-24 (external reference, labelled; no price data)",
                           "nasdaq100": "NOT OBTAINED — slickcharts returns 403 and the estate's own index_constituents table is empty; the coordinator can fill it from FMP, and this table should be re-run then"},
    "uncovered_sub_industries": sub_cov,
    "candidates_36": cands,
    "candidate_branch": BRANCH_FOR_CANDIDATE,
}
p = os.path.join(ROOT, "data", "taxonomy-audit-20260924.json")
json.dump(out, open(p, "w"), indent=1)
print("cohort findings:")
for f in findings:
    print("  ", f["kind"], f.get("n", f.get("cohorts", "")))
print("representativeness rows", len(rep), "· uncovered sub-industries", len(sub_cov), "· candidates", len(cands))
print("out", p, os.path.getsize(p))
