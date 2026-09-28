#!/usr/bin/env python3
"""TREE COHORTS (28 Sep, lane N5) · part 3: the proposed cohort system, derived from the tree and the measurements.

Reads build/critique.json, build/clusters.json, the coverage tree, holdings, the taxonomy rules, the admissions list.
Writes ../proposed-cohorts.json. Every rule is written out with its reason; every decision carries the number it rests on.
"""
import json, os, re, collections
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
CTD = os.path.join(ROOT, "deliverables/20260928/coverage-tree")
CR = json.load(open(os.path.join(HERE, "critique.json")))
CL = json.load(open(os.path.join(HERE, "clusters.json")))
CT = json.load(open(os.path.join(CTD, "coverage-tree.json")))
HOLD = json.load(open(os.path.join(CTD, "data/holdings.json")))["data"]
UNI = json.load(open(os.path.join(CTD, "data/universe-20260928.json")))
ADM = json.load(open(os.path.join(CTD, "admissions-proposed.json")))["proposals"]
RULES = json.load(open(os.path.join(ROOT, "data/taxonomy-rules-20260924.json")))
STD = json.load(open(os.path.join(ROOT, "data/standard-tree-20260924.json")))
GICS = {n["ticker"]: n for n in (STD["names"] if isinstance(STD["names"], list) else STD["names"].values())}
SERVED = set(UNI["symbols"]); GEIGER_ONLY = set(UNI["tiers"]["geiger_only"]); FULL = SERVED - GEIGER_ONLY
NODES = {n["id"]: n for n in CT["nodes"]}
FUND_NODES = {n["ticker"]: n for n in CT["nodes"] if n["kind"] == "fund"}
COH = {c["key"]: c for c in CT["cohorts"]}
COV = CT["coverage"]; TRK = CT["tracking"]
cohesion = CR["cohesion"]; null = CR["null_same_size"]; pfit = CR["parent_fit"]; rep = CL["cohort_reproducibility"]; span = CL["cohort_span"]
clusters = {c["cluster"]: c for c in CL["clusters"]}
lab = {t: c["cluster"] for c in CL["clusters"] for t in c["members"]}
misplaced = {(m["t"], m["cohort"]): m for m in CR["misplaced"]}
us = lambda t: t.replace(".", "-")
SECT_FUND = {"Information Technology": "XLK", "Financials": "XLF", "Health Care": "XLV", "Energy": "XLE", "Industrials": "XLI", "Consumer Staples": "XLP", "Consumer Discretionary": "XLY", "Utilities": "XLU", "Materials": "XLB", "Real Estate": "XLRE", "Communication Services": "XLC"}
SECT_HEAD = {"Information Technology": "SEC_TECH", "Financials": "SEC_FIN", "Health Care": "SEC_HLTH", "Energy": "SEC_ENGY", "Industrials": "SEC_INDU", "Consumer Staples": "SEC_STPL", "Consumer Discretionary": "SEC_DISC", "Utilities": "SEC_UTIL", "Materials": "SEC_MATL", "Real Estate": "SEC_REIT", "Communication Services": "SEC_COMM"}

def heavy_rows(f):
    """the fund's ten heaviest lines that each carry more than twice an equal-weight share (an equal-weight fund has none)"""
    rows = [(us(a), w) for a, w in HOLD[f]["h"] if w and w > 0]
    if not rows: return []
    avg = 100.0 / max(len(rows), HOLD[f].get("n") or len(rows))
    return [(a, w) for a, w in sorted(rows, key=lambda x: -x[1])[:10] if w > 2 * avg]
def null95(n):
    keys = sorted(int(k) for k in null); k = min(keys, key=lambda x: abs(x - n)); return null[str(k)]["95"]
def parent_by_history(key, fallback_sector=None):
    """R1: the fund whose OWN Geiger tracked the cohort's mean best over the last three years, if it beats the sector fund; else the sector heading."""
    p = pfit.get(key)
    if not p: return None, "no history"
    cands = [c for c in p["candidates"] if c["corr_history"] is not None]
    best = max(cands, key=lambda c: c["corr_history"]) if cands else None
    sec = p["yardsticks"].get("sector_fund")
    if best and (not sec or sec["corr_history"] is None or best["corr_history"] >= sec["corr_history"]):
        return best["fund"], f"{best['fund']} tracked the cohort mean at {best['corr_history']:.2f} over 750 sessions" + (f" (sector fund {sec['fund']} {sec['corr_history']:.2f})" if sec else "")
    if sec: return sec["fund"], f"no holding fund beat the sector fund {sec['fund']} ({sec['corr_history']:.2f}; best holder {best['fund']} {best['corr_history']:.2f})" if best else f"sector fund {sec['fund']} ({sec['corr_history']:.2f})"
    return None, "no fund tracked it"

def moves(key):
    """R5: members another cohort's mean tracks better than their own (leave-one-out), both numbers shown."""
    out = []
    for t in COH[key]["members"]:
        m = misplaced.get((t, key))
        if m and m["best_other_corr"] > m["own"]:
            out.append({"t": t, "own": m["own"], "better": m["best_other"], "better_corr": m["best_other_corr"], "gap": m["gap"]})
    return sorted(out, key=lambda r: -r["gap"])

def grp(members):
    """the co-movement groups a set of names spans, with the reproducibility of each group (from clusters.json)"""
    cc = collections.Counter(lab[t] for t in members if t in lab)
    return [{"cluster": c, "n_here": n, "n_group": clusters[c]["n"], "reproducibility": clusters[c]["reproducibility"], "names": [t for t in members if lab.get(t) == c]} for c, n in cc.most_common()]

# ---------------- the rules ----------------
rules = [
 {"id": "R1", "rule": "Every cohort has exactly one parent on the tree. For a cohort of companies it is the fund whose own Geiger tracked the cohort's mean best over the last three years, if that fund beats the sector fund; otherwise the sector heading. A cohort made of funds (indexes, macro, world) hangs under the heading its funds share.", "why": "A parent that holds the members on paper but does not move with them (MID CAP under IWM at 1.9% of the fund) is a filing cabinet, not a parent. The seven cohorts with no parent today are all one of these two cases."},
 {"id": "R2", "rule": "A label is a cohort only when its members move together more than a random set of the same size would (its mean pair correlation above the 95th point of 300 random draws of that size). A label that fails becomes an attribute (a cap tranche, a style) used as a filter, never a bar.", "why": "LARGE CAP (226 names) has a mean pair correlation of 0.14 against 0.15 for random sets of 226: its bar is the market's bar. The same is true of MEGA CAP and nearly true of BLUE CHIP."},
 {"id": "R3", "rule": "A cohort is split along its co-movement groups when its members fall into several groups that each reproduce across both halves of history better than the cohort as a whole does.", "why": "AI POWER's 27 names span 9 groups; its 15 regulated utilities reproduce at 0.49 while the cohort reproduces at 0.34. The utilities and the generators are two cohorts wearing one label."},
 {"id": "R4", "rule": "Two cohorts merge when one contains the other, or when the two labels' members sit in the same co-movement groups.", "why": "METALS and PRECIOUS METALS are the same 17 names; AI POWERTRAIN is 8 of AI POWER's 27; CRYPTO (2 names) is inside CRYPTO EQUITIES; MEMORY and SEMI EQUIPMENT are one group of ten (reproducibility 0.92)."},
 {"id": "R5", "rule": "A name is listed as a MOVE when another cohort's mean tracked it better than its own cohort's mean (leave-one-out), with both numbers. Alan decides; nothing moves by itself. A name outside its cohort's majority sector is flagged beside it.", "why": "NBIS sits in AI SOFTWARE at 0.15 and tracks the miners and neoclouds at 0.75. XOM sits in MEGA CAP at −0.01."},
 {"id": "R6", "rule": "A cohort's bar always carries its member count. The noise of a mean of n Geigers falls with n (measured: the day-to-day change of a 1-name bar has a spread of 0.17; of 5 names 0.09; of 20 names 0.07). Two or three names are a pair, shown, never averaged into a strip without the count.", "why": "A bow tie column built from two names swings twice as much as one built from twenty; without the count the strip reads noise as rotation."},
 {"id": "R7", "rule": "FULL treatment for a name that is (a) a member of a curated cohort, or (b) a top-10 holding by weight of a broad or sector fund on the tree, or (c) in a fund's smallest tracking set, or (d) an index or macro fund in the INDEXES, MACRO or INTL cohorts. Everything else served today is a scout candidate: it stays until Alan says otherwise, and no new name enters FULL by any other door than the scout's promote mark.", "why": "Every FULL name costs bars on seven timeframes, streams and nightly fundamentals. The tree says which names a fund's read needs; the cohorts say which names Alan watches; the rest can be screened nightly for free."},
 {"id": "R8", "rule": "Fund cohorts are automatic: every industry fund on the tree is a cohort whose members are its served holdings, refreshed with the holdings file, shown with the fund's own bar and the striped holdings bar. They are not typed by hand and never edited.", "why": "The tree already has 49 industry funds with holdings; the co-movement groups line up with them (oil majors under XLE at 0.82, gold miners under GDX at 1.00, money-centre banks under XLF at 0.94)."},
]

# ---------------- R2: which labels are cohorts ----------------
verdicts = {}
for k, st in cohesion.items():
    mp = st.get("mean_pair_corr"); n = st["n"]
    if mp is None: verdicts[k] = {"cohesion": None, "null95": None, "verdict": "no history"}; continue
    n95 = null95(n)
    verdicts[k] = {"cohesion": mp, "null95": n95, "reproducibility": rep.get(k), "groups": span.get(k, {}).get("groups"), "largest_share": span.get(k, {}).get("largest_share"),
                   "verdict": "cohort" if mp > n95 else "attribute"}

# ---------------- the proposed list ----------------
P = []
def add(id_, label, kind, parent, parent_reason, members, tab=None, note=None, from_cohorts=(), members_not_served=(), split_of=None, merged_from=()):
    members = [t for t in dict.fromkeys(members)]
    served = [t for t in members if t in SERVED]
    st = cohesion.get(from_cohorts[0]) if from_cohorts and len(from_cohorts) == 1 else None
    P.append({"id": id_, "label": label, "kind": kind, "parent": parent, "parent_reason": parent_reason, "members": served, "not_served": [t for t in members if t not in SERVED] + list(members_not_served),
              "n": len(served), "board_tab": tab, "note": note, "from_cohorts": list(from_cohorts), "split_of": split_of, "merged_from": list(merged_from),
              "groups": grp(served), "moves": list({m["t"]: m for c in from_cohorts for m in moves(c) if m["t"] in served and m["t"] not in FUND_NODES}.values()) if from_cohorts else [],
              "sector_odd": [(t, GICS[t]["gics_sector"]) for t in served if t in GICS and SECT_HEAD.get(GICS[t]["gics_sector"]) and parent in SECT_HEAD.values() and SECT_HEAD[GICS[t]["gics_sector"]] != parent]})

M = lambda k: COH[k]["members"]
# --- headings for cohorts of funds (R1, second sentence)
add("INDEXES", "INDEXES", "curated", "US_BROAD", "a cohort of index funds hangs under the broad-market heading, not under a fund (today: no parent)", M("INDEXES") + ["ITOT", "IWV"], tab="INDEXES", from_cohorts=("INDEXES",), note="The INDEX-FUNDS bow-tie tab (section 8) reads this cohort.")
add("MACRO", "MACRO", "curated", "MACRO", "a cohort of macro funds hangs under the MACRO heading (today: no parent). GLD and SLV also sit in METALS, where the rotation Alan wants to see lives.", M("MACRO"), tab="MACRO", from_cohorts=("MACRO",))
add("WORLD", "INTL · developed and emerging", "curated", "WORLD", "funds and ADRs of other markets hang under WORLD (today: no parent). Two groups inside: the China names (BABA, JD, PDD, BIDU, FXI, MCHI, ASHR) reproduce together; the developed-market funds are the other.", M("INTL"), tab="INTL", from_cohorts=("INTL",), note="Split candidate: CHINA (BABA JD PDD BIDU FXI MCHI ASHR) and DEVELOPED (EFA EWJ EWG EWU EZU EWY).")
# --- Alan's board tabs, re-parented and cleaned
p, r = parent_by_history("MEGACAP"); add("MEGACAP", "MEGACAP", "curated", p, r, M("MEGACAP"), tab="MEGACAP", from_cohorts=("MEGACAP",), note="BA and SPCX are outside every mega-cap fund; they are listed as moves, not removed.")
p, r = parent_by_history("GROWTH"); add("GROWTH", "GROWTH", "curated", p, r, M("GROWTH"), tab="GROWTH", from_cohorts=("GROWTH",))
# AI hardware → four cohorts by co-movement group (R3)
add("AI_ACCELERATORS", "AI ACCELERATORS", "curated", "SMH", "SMH tracked the accelerators' mean at 0.89 (VGT 0.86, XLK 0.87); it is the fund Alan reads for chips", [t for t in M("AI_ACCELERATORS") if t not in M("MEMORY_STORAGE") and t not in M("SEMI_EQUIPMENT")], tab="AI HW", from_cohorts=("AI_ACCELERATORS",), split_of="AI_HARDWARE", note="Today's AI HW tab (43 names, 12 groups) becomes this plus the three below.")
add("MEMORY_SEMICAP", "MEMORY & SEMI EQUIPMENT", "curated", "SMH", "one co-movement group of ten (reproducibility 0.92): the memory makers and the equipment makers move as one; SMH holds 8 of them; DRAM holds 4", M("MEMORY_STORAGE") + M("SEMI_EQUIPMENT") + ["AMKR"], tab=None, from_cohorts=("MEMORY_STORAGE", "SEMI_EQUIPMENT"), merged_from=("MEMORY_STORAGE", "SEMI_EQUIPMENT"), split_of="AI_HARDWARE", note="MU, SNDK, STX, WDC, SIMO with AMAT, ASML, KLAC, LRCX, AMKR.")
add("PHOTONICS", "PHOTONICS & OPTICAL", "curated", "IYZ", "IYZ tracked the three at 0.70; the group also carries GLW", M("PHOTONICS_OPTICAL") + ["GLW"], from_cohorts=("PHOTONICS_OPTICAL",), split_of="AI_HARDWARE", members_not_served=["FN", "INFN"])
add("NEOCLOUDS_MINERS", "NEOCLOUDS & BITCOIN MINERS", "curated", "CRYPTO", "one co-movement group of nine (reproducibility 0.77): the bitcoin miners that became AI hosts move with the neoclouds, not with the exchanges; no fund on the tree holds them together, so they hang under the CRYPTO heading", ["APLD", "CRWV", "NBIS", "CORZ", "CIFR", "IREN", "RIOT", "WULF", "BTDR", "HIVE"], from_cohorts=("CRYPTO_EQUITIES", "AI_DATACENTER"), split_of="AI_HARDWARE", note="NBIS was in AI SOFTWARE (0.15) and tracks this group at 0.75.", members_not_served=["MARA", "CLSK", "HUT", "BITF"])
add("DATACENTER_REITS", "DATA-CENTRE PROPERTY", "curated", "XLRE", "DLR and EQIX move with the specialised REITs (XLRE 0.44 for the old AI DATACENTER mean), not with the neoclouds", ["DLR", "EQIX", "IRM"], from_cohorts=("AI_DATACENTER",), split_of="AI_DATACENTER", members_not_served=["GDS"])
# software
p, r = parent_by_history("AI_SOFTWARE"); add("AI_SOFTWARE", "AI SOFTWARE", "curated", p, r, [t for t in M("AI_SOFTWARE") if t not in ("NBIS",)], tab="AI SW", from_cohorts=("AI_SOFTWARE",), note="Two groups inside: the enterprise platforms (ADBE CRM INTU NOW, 0.51) and the security and data names below.")
add("SECURITY_DATA", "SECURITY & DATA PLATFORMS", "curated", "CIBR", "CIBR tracked CYBER at 0.85 and IGV at 0.78; the seven names (CRWD DDOG MDB PANW PATH SNOW ZS) are one group (0.67)", ["CRWD", "PANW", "ZS", "DDOG", "MDB", "SNOW", "PATH"], from_cohorts=("CYBER",), merged_from=("CYBER",), members_not_served=["FTNT", "S", "CYBR", "OKTA", "NET"])
# power (R3 split)
add("AI_POWER", "AI POWER", "curated", "SEC_UTIL", "the generators and the kit: no fund holds them together (URA tracked the old AI POWERTRAIN at 0.70, XLU 0.42), so the cohort hangs under the utilities heading; its regulated-utility members go to the fund cohort XLU", ["CEG", "VST", "GEV", "ETN", "PWR", "BE", "EOSE", "OKLO", "SMR", "CCJ", "VRT"], tab="AI POWER", from_cohorts=("AI_POWERTRAIN", "AI_POWER"), merged_from=("AI_POWERTRAIN",), split_of="AI_POWER", members_not_served=["NRG", "TLN"], note="Alan's own definition (CEG, VST, GEV, OKLO, SMR, CCJ, BE, EOSE) plus ETN, PWR and VRT, which reproduce with GEV in the electrification group (0.34).")
add("ELECTRIFICATION", "ELECTRIFICATION & MACHINERY", "group", "XLI", "a group the data found (12 names, reproducibility 0.34): CAT CMI ETN FIX GEV HUBB JCI PH PWR TT URI VRT, the physical build-out; XLI holds all of them", clusters[[c for c in clusters if "FIX" in clusters[c]["members"] and "HUBB" in clusters[c]["members"]][0]]["members"], note="New. It overlaps AI POWER on GEV, ETN, PWR and VRT; the rest were loose in LARGE CAP and BLUE CHIP.")
add("REGULATED_UTILITIES", "REGULATED UTILITIES", "fund", "XLU", "the fund cohort XLU: its 19 served holdings; the 15 regulated names reproduce at 0.49 against 0.34 for AI POWER as a whole", [t for t, w in COV["XLU"]["served"]], from_cohorts=("AI_POWER",), split_of="AI_POWER")
# crypto
add("CRYPTO_TREASURIES", "CRYPTO · EXCHANGES & TREASURIES", "curated", "CRYPTO", "COIN, MSTR and HOOD move with each other and with the generators CEG and VST (one group, 0.66), not with the miners; the cohort hangs under the CRYPTO heading with the coins", ["COIN", "MSTR", "HOOD"], tab="CRYPTO", from_cohorts=("CRYPTO", "CRYPTO_EQUITIES"), merged_from=("CRYPTO",))
# metals
add("PRECIOUS_METALS", "METALS · GOLD & SILVER", "curated", "GDX", "GDX tracked the 17 at 0.98; METALS and PRECIOUS METALS were the same list", M("METALS") + ["GLD", "SLV"], tab="METALS", from_cohorts=("METALS", "PRECIOUS_METALS"), merged_from=("PRECIOUS_METALS",), note="The ten miners are one group at reproducibility 1.00, the tightest in the whole set.")
p, r = parent_by_history("COPPER_STEEL"); add("COPPER_STEEL", "COPPER, STEEL & INDUSTRIAL METALS", "curated", p, r, M("COPPER_STEEL") + ["TECK", "DOW"], from_cohorts=("COPPER_STEEL",), members_not_served=["X", "CLF", "RS", "ATI"], note="TECK and DOW sat in the same group (0.35) and in no cohort.")
p, r = parent_by_history("CRITICAL_MINERALS"); add("CRITICAL_MINERALS", "RARE EARTHS & CRITICAL MINERALS", "curated", p, r, M("CRITICAL_MINERALS"), from_cohorts=("CRITICAL_MINERALS",), note="ALB, LAC, SQM (lithium) are one group at 0.59; MP, USAR, CRML, UUUU are looser.")
p, r = parent_by_history("NUCLEAR_URANIUM"); add("NUCLEAR_URANIUM", "NUCLEAR & URANIUM", "curated", p, r, M("NUCLEAR_URANIUM"), from_cohorts=("NUCLEAR_URANIUM",), note="CCJ, LEU, UUUU are one group at 0.91; OKLO and SMR move with the speculative small caps (below) and stay here only by Alan's choice.")
# speculative themes
p, r = parent_by_history("QUANTUM"); add("QUANTUM", "QUANTUM COMPUTING", "curated", p, r, M("QUANTUM"), from_cohorts=("QUANTUM",))
p, r = parent_by_history("SPACE"); add("SPACE", "SPACE", "curated", p, r, M("SPACE"), from_cohorts=("SPACE",), note="Two groups: the small caps (BKSY LUNR PL SATL SIDU, 0.44) and RKLB / ASTS / ONDS elsewhere.")
add("EVTOL_AUTONOMY", "eVTOL, AUTONOMY & NEW MOBILITY", "curated", "SEC_DISC", "no fund tracked it (ARKX 0.74, XLY 0.61 for the old mean); the cohort hangs under the discretionary heading. Cohesion 0.29 against 0.23 for random sets: a cohort, but a loose one.", [t for t in M("EVTOL_AUTONOMY") if t != "TSLA"], from_cohorts=("EVTOL_AUTONOMY",), members_not_served=["RIVN", "XPEV"], note="TSLA is listed as a move to MEGACAP.")
add("SPECULATIVE_SMALLCAPS", "HIGH-BETA SMALL CAPS", "group", "IWM", "a group the data found (7 names, reproducibility 0.80): IONQ QBTS QUBT RGTI ACHR JOBY OKLO move as one whatever their theme; IWM holds five of them", clusters[[c for c in clusters if "IONQ" in clusters[c]["members"] and "JOBY" in clusters[c]["members"]][0]]["members"], note="New. It cuts across QUANTUM, eVTOL and NUCLEAR: the market trades them as one retail-momentum basket. Worth a tab of its own for the sigma days.")
p, r = parent_by_history("SOLAR_RENEWABLE"); add("SOLAR_RENEWABLE", "SOLAR & RENEWABLES", "fund", "TAN", "three served names in three groups (cohesion 0.22 against 0.36 for random sets of 3): not a cohort until ENPH, SEDG, RUN, NXT and AMRC are served; until then the fund TAN is the cohort", ["FSLR"], from_cohorts=("SOLAR_RENEWABLE",), members_not_served=["ENPH", "SEDG", "RUN", "NXT", "AMRC"])
# defence, financials, payments, platforms
p, r = parent_by_history("DEFENCE_AEROSPACE"); add("DEFENCE_AEROSPACE", "DEFENCE & AEROSPACE", "curated", p, r, M("DEFENCE_AEROSPACE") + ["KTOS", "AVAV"], from_cohorts=("DEFENCE_AEROSPACE",), members_not_served=["HEI", "AXON", "LDOS"], note="Two groups: the primes (GD LHX LMT NOC RTX, 0.80) and the engines and commercial names (GE HWM TDG, 0.50).")
add("MONEY_CENTER_BANKS", "MONEY-CENTRE BANKS & CARDS", "curated", "XLF", "one group of eight at 0.94 (AXP BAC C COF GS JPM MS WFC); XLF tracked the old BANKS MARKETS mean at 0.90", ["AXP", "BAC", "C", "COF", "GS", "JPM", "MS", "WFC"], from_cohorts=("BANKS_MARKETS",), split_of="BANKS_MARKETS")
add("CAPITAL_MARKETS", "CAPITAL MARKETS, ALTS & EXCHANGES", "curated", "IAI", "the second group inside BANKS MARKETS (BLK BX ICE KKR MCO SPGI CME SCHW, 0.31); IAI is the fund of brokers and exchanges", ["BLK", "BX", "ICE", "KKR", "MCO", "SPGI", "CME", "SCHW", "BNY"], from_cohorts=("BANKS_MARKETS",), split_of="BANKS_MARKETS")
add("INSURANCE", "INSURANCE", "fund", "IAK", "the fund cohort IAK: BRK-B CB PGR TRV are one group (0.43) that no cohort held", ["BRK-B", "CB", "PGR", "TRV", "AON", "MRSH"])
p, r = parent_by_history("PAYMENTS_FINTECH"); add("PAYMENTS_FINTECH", "PAYMENTS & FINTECH", "curated", p, r, M("PAYMENTS_FINTECH"), from_cohorts=("PAYMENTS_FINTECH",), members_not_served=["PYPL", "FI", "FIS", "GPN", "TOST", "XYZ", "NU", "DFS", "SYF"])
p, r = parent_by_history("MEGACAP_PLATFORMS"); add("INTERNET_PLATFORMS", "INTERNET & CONSUMER PLATFORMS", "curated", p, r, [t for t in M("MEGACAP_PLATFORMS") if t not in ("AAPL", "META", "NFLX")], from_cohorts=("MEGACAP_PLATFORMS",), members_not_served=["EA", "SNAP", "PINS", "RDDT"], note="AAPL, META and NFLX stay in MEGACAP only; the rest (AMZN's marketplace peers, travel, gig) are what FDN holds.")
# the sector-industry groups the data found, as fund cohorts (R8)
add("OIL_MAJORS_EP", "OIL MAJORS & E&P", "fund", "XLE", "the fund cohort XLE: its nine producers are one group at 0.82; the pipes (KMI OKE WMB TRGP, 0.70) are the other group inside XLE", [t for t, w in COV["XLE"]["served"]])
add("PHARMA_BIOTECH", "PHARMA & BIOTECH", "fund", "IBB", "AMGN LLY MRK REGN VRTX are one group at 0.75; IBB is the fund (10 of its heaviest lines are un-served: the admissions list starts with them)", ["AMGN", "LLY", "MRK", "REGN", "VRTX", "GILD", "ABBV", "JNJ", "BMY", "PFE"], members_not_served=["MRNA"])
add("TOWERS", "TOWERS & SPECIALISED REITS", "fund", "XLRE", "AMT CCI SBAC are one group at 1.00", ["AMT", "CCI", "SBAC"])
add("TELECOM", "TELECOM", "fund", "XLC", "T TMUS VZ sit together in every split", ["T", "TMUS", "VZ"])
add("MANAGED_CARE", "MANAGED CARE", "fund", "XLV", "UNH and ELV are a pair (0.75); CVS and MCK are near them", ["UNH", "ELV", "CVS", "MCK"])
add("CHINA", "CHINA", "curated", "MCHI", "MCHI tracked the old INTL mean at 0.81; the ADRs BABA JD PDD BIDU and the funds FXI MCHI ASHR", ["BABA", "JD", "PDD", "BIDU", "FXI", "MCHI", "ASHR", "NIO", "LI"], from_cohorts=("INTL",), split_of="INTL")

# ---------------- dissolved labels ----------------
dissolved = [
 {"key": "LARGE_CAP", "n": 226, "reason": f"cohesion {cohesion['LARGE_CAP']['mean_pair_corr']} against {null95(226)} for random sets of 226: it is the market. Becomes the cap tranche LARGE (an attribute, a filter).", "becomes": "attribute: cap tranche"},
 {"key": "MEGA_CAP", "n": 62, "reason": f"cohesion {cohesion['MEGA_CAP']['mean_pair_corr']} against {null95(62)}: barely above random, spans 29 groups, tracks SPY at 0.90. Becomes the cap tranche MEGA; the 12-name MEGACAP tab stays.", "becomes": "attribute: cap tranche"},
 {"key": "BLUE_CHIP", "n": 128, "reason": f"cohesion {cohesion['BLUE_CHIP']['mean_pair_corr']} against {null95(128)}: a hair above random, 36 groups, its parent VTV is a style fund. Becomes the style attribute VALUE / QUALITY (the tree's US_STYLE heading already carries VTV, VUG, MGK, QUAL, MTUM, SCHD).", "becomes": "attribute: style"},
 {"key": "MID_CAP", "n": 21, "reason": "a size label whose 21 names are quantum, eVTOL, nuclear and crypto names; its parent IWM holds them at 1.9% of the fund. Its members go to their themes; the size goes to the cap tranche.", "becomes": "attribute: cap tranche"},
 {"key": "SMALL_CAP", "n": 6, "reason": "six names in four groups, no parent. Same as MID CAP.", "becomes": "attribute: cap tranche"},
 {"key": "THEMATIC", "n": 23, "reason": "a bucket of five themes (quantum, space, eVTOL, minerals, China), 11 groups, no parent. Each member already sits in its theme cohort.", "becomes": "its five theme cohorts"},
 {"key": "AI_HARDWARE", "n": 43, "reason": "43 names in 12 groups; the four cohorts above (accelerators, memory & semicap, photonics, neoclouds & miners) are what it contains.", "becomes": "four cohorts"},
 {"key": "BANKS_MARKETS", "n": 20, "reason": "two groups: the money-centre banks (0.94) and the capital-markets names (0.31).", "becomes": "two cohorts"},
 {"key": "AI_POWERTRAIN", "n": 8, "reason": "inside AI POWER; the merged AI POWER keeps Alan's eight and the tab name.", "becomes": "AI POWER"},
 {"key": "CRYPTO", "n": 2, "reason": "two names; inside CRYPTO EQUITIES. The exchanges and treasuries keep the tab.", "becomes": "CRYPTO · EXCHANGES & TREASURIES"},
 {"key": "CRYPTO_EQUITIES", "n": 8, "reason": "two groups: exchanges and treasuries (with CEG, VST) and the miners (with the neoclouds).", "becomes": "two cohorts"},
 {"key": "METALS / PRECIOUS_METALS", "n": 17, "reason": "the same list twice.", "becomes": "METALS · GOLD & SILVER"},
 {"key": "MEMORY_STORAGE / SEMI_EQUIPMENT", "n": 11, "reason": "one co-movement group of ten (0.92).", "becomes": "MEMORY & SEMI EQUIPMENT"},
 {"key": "AI_DATACENTER", "n": 6, "reason": "the REITs and the neoclouds are in different groups.", "becomes": "DATA-CENTRE PROPERTY + NEOCLOUDS & MINERS"},
 {"key": "CYBER", "n": 3, "reason": "the three sit in one group with DDOG, MDB, SNOW and PATH.", "becomes": "SECURITY & DATA PLATFORMS"},
 {"key": "MEGACAP_PLATFORMS", "n": 15, "reason": "15 names in 9 groups, cohesion 0.30; AAPL, META and NFLX belong to MEGACAP; the rest is what FDN holds.", "becomes": "INTERNET & CONSUMER PLATFORMS"},
 {"key": "INTL", "n": 13, "reason": "kept under WORLD, with CHINA split out.", "becomes": "WORLD + CHINA"},
]

# ---------------- fund cohorts (R8): every industry fund on the tree ----------------
fund_cohorts = []
for t, n in FUND_NODES.items():
    if n.get("role") != "industry": continue
    cv = COV.get(t); tr = TRK.get(t, {})
    fund_cohorts.append({"fund": t, "label": n["label"], "parent": n["parents"][0], "served_holdings": [x[0] for x in (cv["served"] if cv else [])], "n": len(cv["served"]) if cv else 0,
                         "coverage_pct": cv["coverage_pct"] if cv else None, "tracking": tr.get("verdict") or tr.get("skipped"), "smallest_set": tr.get("smallest_set"),
                         "cohort_bar": "holdings blend" if cv and cv["served"] else "the fund's own bar only (no served holding)"})
fund_cohorts.sort(key=lambda f: -(f["coverage_pct"] or 0))

# ---------------- R7: treatment per served name ----------------
curated = {t for p in P for t in p["members"] if p["kind"] in ("curated", "group")}
top10 = {}
for f, n in FUND_NODES.items():
    if n.get("role") in ("broad", "sector") and f in HOLD:
        for a, w in heavy_rows(f): top10.setdefault(a, []).append(f)
smallest = {}
for f, tr in TRK.items():
    for t in tr.get("smallest_set") or []: smallest.setdefault(t, []).append(f)
fund_cohort_members = {t for fc in fund_cohorts for t in fc["served_holdings"]}
treat = {}
for t in sorted(SERVED):
    if t in GEIGER_ONLY: treat[t] = {"treatment": "GEIGER-ONLY", "why": "a fund used in the compare strips; unchanged"}; continue
    why = []
    if t in curated: why.append("in a curated cohort: " + ", ".join(p["id"] for p in P if t in p["members"] and p["kind"] in ("curated", "group")))
    if t in top10: why.append("top-10 holding of " + ", ".join(top10[t]))
    if t in smallest: why.append("in the smallest tracking set of " + ", ".join(smallest[t]))
    if FUND_NODES.get(t): why.append("an index or macro fund on the board")
    if why: treat[t] = {"treatment": "FULL", "why": "; ".join(why)}
    else:
        extra = []
        if t in fund_cohort_members: extra.append("a served holding of " + ", ".join(fc["fund"] for fc in fund_cohorts if t in fc["served_holdings"]) + " (the fund cohort keeps it in the tree)")
        treat[t] = {"treatment": "SCOUT CANDIDATE", "why": "in no curated cohort, not a top-10 holding of a broad or sector fund, not needed to track any fund" + ("; " + "; ".join(extra) if extra else ""),
                    "cohorts_today": sorted(k for k, c in COH.items() if t in c["members"]), "gics": GICS.get(t, {}).get("gics_industry")}
counts = collections.Counter(v["treatment"] for v in treat.values())

# ---------------- the 216 admissions against the tree ----------------
theme_missing = {}
for b in RULES["branches"]:
    for t in (b.get("members") or b.get("tickers") or []):
        if t not in SERVED: theme_missing.setdefault(t, []).append(b["id"])
INTL_FUNDS = {f for f, n in FUND_NODES.items() if n["parents"][0] in ("INTL_DEV", "EM", "WORLD")}
tree_top10_missing = {}
def heavy_rows(f):
    """the fund's ten heaviest lines that each carry more than twice an equal-weight share (an equal-weight fund has none)"""
    rows = [(us(a), w) for a, w in HOLD[f]["h"] if w and w > 0]
    if not rows: return []
    avg = 100.0 / max(len(rows), HOLD[f].get("n") or len(rows))
    return [(a, w) for a, w in sorted(rows, key=lambda x: -x[1])[:10] if w > 2 * avg]
for f, n in FUND_NODES.items():
    if f in HOLD:
        rows = heavy_rows(f)
        for a, w in rows:
            if a not in SERVED and re.fullmatch(r"[A-Z]{1,5}", a) and not a.endswith("XXX") and f not in INTL_FUNDS: tree_top10_missing.setdefault(a, []).append([f, w])
adm = []
in216 = set()
for p_ in ADM:
    t = p_["ticker"]; in216.add(t)
    funds = [f for f, w in p_["weight_added"]]
    smallmid = [f for f in funds if f in ("IWM", "IJR", "MDY")]
    good_only = all((TRK.get(f, {}).get("verdict") == "GOOD") for f in funds) and not (t in theme_missing) and not (t in tree_top10_missing)
    top_needy = [(f, w) for f, w in tree_top10_missing.get(t, []) if TRK.get(f, {}).get("verdict") != "GOOD"]
    top_good = [(f, w) for f, w in tree_top10_missing.get(t, []) if TRK.get(f, {}).get("verdict") == "GOOD"]
    if t in theme_missing: verdict, why = "KEEP · FULL", "completes the cohort " + ", ".join(theme_missing[t])
    elif top_needy: verdict, why = "KEEP · FULL", "a top-10 line of a fund our names do not yet track well: " + ", ".join(f"{f} ({w:.1f}%, {TRK.get(f, {}).get('verdict') or 'no tracking'})" for f, w in top_needy)
    elif top_good: verdict, why = "KEEP · SCOUT", "a top-10 line of " + ", ".join(f"{f} ({w:.1f}%)" for f, w in top_good) + ", but our names already track that fund at GOOD; scout it, promote by hand"
    elif smallmid and len(smallmid) == len(funds): verdict, why = "KEEP · SCOUT", "adds weight only to " + ", ".join(smallmid) + ": the scout screen covers it; it enters FULL only by a promote mark"
    elif good_only: verdict, why = "DROP", "adds weight only to funds our names already track at GOOD (" + ", ".join(funds) + ") and is not a top-10 line: no read gained"
    else: verdict, why = "KEEP · SCOUT", "adds weight to " + ", ".join(funds) + " but is not a top-10 line of any fund and completes no cohort"
    if not re.fullmatch(r"[A-Z]{1,5}", t): why += " · not a plain US ticker: check the listing before any admission"
    adm.append({"rank": p_["rank"], "ticker": t, "name": p_["name"], "funds": funds, "weight_added_sum_pct": p_["weight_added_sum_pct"], "largest_single_fund_weight_pct": p_["largest_single_fund_weight_pct"], "verdict": verdict, "why": why, "cohort": theme_missing.get(t)})
adds = []
for t, br in sorted(theme_missing.items()):
    if t not in in216 and t not in SERVED: adds.append({"ticker": t, "why": "completes " + ", ".join(br), "kind": "theme"})
for t, fs in sorted(tree_top10_missing.items(), key=lambda kv: -max(w for f, w in kv[1])):
    if t not in in216 and t not in SERVED and t not in theme_missing:
        needy = [(f, w) for f, w in fs if TRK.get(f, {}).get("verdict") != "GOOD"]
        adds.append({"ticker": t, "why": "top-10 holding of " + ", ".join(f"{f} ({w:.1f}%)" for f, w in fs), "kind": "top10 · fund needs it" if needy else "top10 · fund already tracked", "max_weight": max(w for f, w in fs), "funds": [f for f, w in fs]})
adm_counts = collections.Counter(a["verdict"] for a in adm)
fund_mix = collections.Counter(f for a in adm for f in a["funds"])
iwm_only = sum(1 for a in adm if set(a["funds"]) == {"IWM"})
smallmid_any = sum(1 for a in adm if set(a["funds"]) & {"IWM", "IJR", "MDY"})

out = {"artifact_kind": "SCINTILLA_TREE_COHORTS_PROPOSAL", "status": "PROPOSED — nothing here is written to the registry, the Hub or the database; Alan decides",
       "built_from": CR["built_from"], "rules": rules, "label_verdicts": verdicts, "cohorts": P, "dissolved": dissolved, "fund_cohorts": fund_cohorts,
       "treatment": treat, "treatment_counts": dict(counts),
       "admissions": {"count": len(adm), "verdict_counts": dict(adm_counts), "fund_mix": fund_mix.most_common(), "iwm_only": iwm_only, "touch_small_or_mid": smallmid_any, "rows": adm,
                      "add": adds, "add_counts": collections.Counter(a["kind"] for a in adds)}}
json.dump(out, open(os.path.join(HERE, "..", "proposed-cohorts.json"), "w"), indent=1)
print(json.dumps({"cohorts": len(P), "fund_cohorts": len(fund_cohorts), "treatment": dict(counts), "admissions": dict(adm_counts), "adds": dict(collections.Counter(a["kind"] for a in adds)), "iwm_only": iwm_only, "smallmid_any": smallmid_any}))
