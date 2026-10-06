#!/usr/bin/env python3
"""CO1 (6 Oct 2026) — cohorts that classify the market better than the sector funds do.
Study + proposal only. Reads the copies in ../data (ticker_cohorts, company_profile, the 590 universe,
6 months of daily closes from the chart API) plus the repo's open reference files (ETF holdings pulled
from FMP on 26/28 Sep, the S&P 500 GICS list from Wikipedia, SPY holdings from SSgA, FMP peers, the
28 Sep cohort registry). Writes JSON + a text tree + an apply preview. Writes NOTHING to any live table."""
import json, csv, math, random, re, os, collections, datetime
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
D = os.path.dirname(HERE)                       # deliverables/20261006/cohort-proposal
REPO = os.path.abspath(os.path.join(D, "..", "..", ".."))
def J(p): return json.load(open(p))
def W(name, obj):
    with open(os.path.join(D, name), "w") as fh: json.dump(obj, fh, indent=1, sort_keys=False)
    print("wrote", name)

# ---------------------------------------------------------------- inputs
UNI = J(os.path.join(D, "data/universe-20261006.json"))
U = UNI["symbols"]; Uset = set(U)
TC = J(os.path.join(D, "data/ticker_cohorts-20261006.json"))
CP = {r["ticker"]: r for r in J(os.path.join(D, "data/company_profile-20261006.json"))}
FX = {r["ticker"]: r for r in J(os.path.join(REPO, "deliverables/20261001/universe-standard/data/company_profile-20261001.json"))}
REG = {r["label"]: r for r in J(os.path.join(REPO, "data/cohort-registry-step1.json"))["rows"]}
HOLD = J(os.path.join(REPO, "deliverables/20260928/coverage-tree/data/holdings.json"))["data"]   # fund -> {h:[[ticker,w]]}
SPY = J(os.path.join(REPO, "data/reference/spy-holdings.json"))["holdings"]                        # ticker -> {name, weight_pct}
GICS = J(os.path.join(REPO, "data/reference/sp500-gics.json"))["members"]                           # ticker -> {gics_sector, gics_sub_industry}
PEERS = J(os.path.join(REPO, "deliverables/20261001/universe-standard/data/fmp_peers-20261001.json"))

def is_fund(t):
    r = CP.get(t)
    return (r is None) or bool(r.get("is_etf"))
COMPANIES = [t for t in U if not is_fund(t)]
FUNDS = [t for t in U if is_fund(t)]
sector_of = {t: CP[t]["sector"] for t in COMPANIES}
industry_of = {t: CP[t]["industry"] for t in COMPANIES}
name_of = {t: (CP.get(t) or {}).get("name") or t for t in U}
cap_of = {t: (CP.get(t) or {}).get("market_cap") or 0 for t in U}
country_of = {t: (FX.get(t) or {}).get("country") for t in U}

# ---------------------------------------------------------------- returns (6 months = last 126 sessions)
rows = list(csv.reader(open(os.path.join(D, "data/closes-6m-20261006.csv"))))
hdr = rows[0][1:]; body = rows[1:]
dates = [r[0] for r in body]
M = np.full((len(body), len(hdr)), np.nan)
for i, r in enumerate(body):
    for j, v in enumerate(r[1:]):
        if v: M[i, j] = float(v)
N_SESS = 126
M = M[-N_SESS-1:]                                   # 127 closes -> 126 returns
RET = np.log(M[1:] / M[:-1])
col = {t: j for j, t in enumerate(hdr)}
WINDOW = {"sessions": N_SESS, "from": dates[-N_SESS], "to": dates[-1]}
def priced(t):
    return t in col and np.isfinite(RET[:, col[t]]).sum() >= N_SESS - 3
def avg_pair_corr(ts):
    ts = [t for t in ts if priced(t)]
    if len(ts) < 3: return None, len(ts)
    X = RET[:, [col[t] for t in ts]]
    ok = np.all(np.isfinite(X), axis=1); X = X[ok]
    C = np.corrcoef(X.T); iu = np.triu_indices(len(ts), 1)
    return float(np.nanmean(C[iu])), len(ts)
def corr_mean_vs(ts, fund):
    """correlation of the members' equal-weight daily return with one fund's daily return"""
    ts = [t for t in ts if priced(t)]
    if len(ts) < 2 or not priced(fund): return None
    X = RET[:, [col[t] for t in ts]]; f = RET[:, col[fund]]
    ok = np.all(np.isfinite(X), axis=1) & np.isfinite(f)
    m = X[ok].mean(axis=1); return float(np.corrcoef(m, f[ok])[0, 1])
random.seed(20261006)
_null_cache = {}
def null95(n, pool):
    key = (n, len(pool))
    if key in _null_cache: return _null_cache[key]
    vals = []
    for _ in range(150):
        c, _n = avg_pair_corr(random.sample(pool, n)); vals.append(c)
    v = float(np.percentile(vals, 95)); _null_cache[key] = v; return v
PRICED_COMPANIES = [t for t in COMPANIES if priced(t)]

# ---------------------------------------------------------------- PART 1 · what we have
HUB_TABS = {"AI_HARDWARE": "AI HW", "AI_SOFTWARE": "AI SW", "MEGACAP": "MEGACAP", "BLUE_CHIP": "BLUE CHIP", "GROWTH": "GROWTH",
            "CRYPTO": "CRYPTO", "INTL": "INTL", "MACRO": "MACRO", "INDEXES": "INDEXES", "THEMATIC": "THEMATIC", "METALS": "METALS",
            "AI_POWERTRAIN": "AI POWER"}
CAP = {"LARGE_CAP", "MEGA_CAP", "MID_CAP", "SMALL_CAP"}
SECTOR_LABELS = {"TECH": "Technology", "INDUSTRIAL": "Industrials", "FINANCIALS": "Financial Services", "MATERIALS": "Basic Materials",
                 "DISCRET": "Consumer Cyclical", "HEALTH": "Healthcare", "UTILITIES": "Utilities", "COMMS": "Communication Services",
                 "STAPLES": "Consumer Defensive", "ENERGY": "Energy", "REAL_ESTATE": "Real Estate"}
def norm_ind(s): return re.sub(r"[^A-Z0-9&,_]", "_", s.upper().replace(" - ", "___"))
IND_NORM = {norm_ind(i): i for i in set(industry_of.values()) if i}
members = collections.defaultdict(list)
for r in TC: members[r["cohort"]].append(r["ticker"])
TOPIC_HAND = {"AI_HARDWARE", "AI_SOFTWARE", "AI_POWERTRAIN", "CRYPTO", "METALS", "SEMICONDUCTORS"}
def kind_of(c):
    if c in HUB_TABS: return "Hub tab (hand-made)"
    if c in CAP: return "cap tranche (an attribute, not a theme)"
    if c in SECTOR_LABELS: return "sector label (duplicates GICS)"
    if c in TOPIC_HAND: return "hand-made theme"
    if c in IND_NORM: return "FMP industry copy (machine-made)"
    return "other"
inventory = []
for c, ms in sorted(members.items(), key=lambda kv: -len(kv[1])):
    inU = [t for t in ms if t in Uset]
    reg = REG.get(c)
    if reg: parent = reg["parent"] or (("merged into " + reg["merged_into"]) if reg["merged_into"] else None); psrc = "28 Sep registry (data/cohort-registry-step1.json)"
    elif c in IND_NORM:
        secs = collections.Counter(sector_of.get(t) for t in inU if t in sector_of); parent = (secs.most_common(1)[0][0] if secs else None); psrc = "FMP sector of its members"
    elif c in SECTOR_LABELS: parent = "MARKET"; psrc = "a sector heading"
    else: parent = None; psrc = "none recorded (ticker_cohorts has no parent column)"
    ov = []
    for c2, ms2 in members.items():
        if c2 == c: continue
        sh = len(set(ms) & set(ms2))
        if sh: ov.append((sh, round(sh / len(set(ms) | set(ms2)), 2), c2))
    ov.sort(reverse=True)
    inventory.append({"cohort": c, "kind": kind_of(c), "parent": parent, "parent_source": psrc, "rows": len(ms), "in_universe": len(inU),
                      "priced_6m": sum(1 for t in inU if priced(t)), "avg_pair_corr_6m": (avg_pair_corr([t for t in inU if not is_fund(t)])[0]),
                      "top_overlaps": [{"with": c2, "shared": sh, "jaccard": jc} for sh, jc, c2 in ov[:3]], "members": sorted(ms)})
kinds = collections.Counter(r["kind"] for r in inventory)
in_any = {r["ticker"] for r in TC}
uncovered = sorted(Uset - in_any)
unc_by_sector = collections.defaultdict(list)
for t in uncovered: unc_by_sector["FUND" if is_fund(t) else sector_of[t]].append(t)
loose = {}
for c in ["GROWTH", "THEMATIC", "MEGACAP", "INTL"]:
    out = []
    for t in sorted(members[c]):
        others = {x for x in members if t in members[x] and x != c}
        hand = others & TOPIC_HAND; indcopy = {x for x in others if x in IND_NORM}
        if not hand: out.append({"ticker": t, "name": name_of.get(t, t), "industry": industry_of.get(t), "other_cohorts": sorted(others), "only_machine_labels": not (others - CAP - set(SECTOR_LABELS) - set(IND_NORM) - {"BLUE_CHIP"})})
    loose[c] = out
what_we_have = {"what": "Every cohort in public.ticker_cohorts on 6 Oct 2026 (read through the Hub's own PostgREST read), with its kind, its parent where one is recorded, counts, overlaps and the loose names.",
                "read_utc": datetime.datetime.utcnow().isoformat() + "Z", "rows": len(TC), "cohorts": len(members), "tickers": len(in_any),
                "universe": len(U), "companies": len(COMPANIES), "funds": len(FUNDS),
                "tickers_in_cohorts_not_in_universe": sorted(in_any - Uset), "universe_names_in_no_cohort": {"count": len(uncovered), "by_sector": dict(unc_by_sector)},
                "kinds": dict(kinds), "cohorts_table": inventory, "loose_names": loose}
W("what-we-have.json", what_we_have)

# ---------------------------------------------------------------- PART 2 · the proposal
def held(fund, min_w=0.0):
    return [h[0] for h in HOLD.get(fund, {}).get("h", []) if h[0] in Uset and h[0] != fund and not is_fund(h[0]) and h[1] >= min_w]
def ind(*names): return [t for t in COMPANIES if industry_of[t] in names]
def S(*ts): return [t for t in ts if t in Uset]
HEADINGS = {
 "MARKET": {"label": "THE MARKET", "parent": None},
 "AI": {"label": "AI", "parent": "MARKET", "gics": "Technology (mostly)", "why": "Alan: 'we have AI'. The theme heading; its cohorts also hang under the sector they came from."},
 "SEMIS": {"label": "SEMICONDUCTORS", "parent": "TECH", "gics": "Technology", "why": "the open spine is SMH/SOXX/XSD holdings plus the FMP industry 'Semiconductors'"},
 "SOFTWARE_INTERNET": {"label": "SOFTWARE & INTERNET", "parent": "TECH", "gics": "Technology / Communication Services"},
 "ENERGY_POWER": {"label": "ENERGY & POWER", "parent": "MARKET", "gics": "Energy + Utilities", "why": "Alan: 'AI powertrain … is a mix of AI and energy'"},
 "FRONTIER": {"label": "FRONTIER", "parent": "MARKET", "gics": "Industrials / Technology", "why": "THEMATIC split by topic: space, quantum, autonomy, defence tech"},
 "FINANCE": {"label": "FINANCE", "parent": "MARKET", "gics": "Financial Services"},
 "HEALTH": {"label": "HEALTH", "parent": "MARKET", "gics": "Healthcare"},
 "MATERIALS_METALS": {"label": "MATERIALS & METALS", "parent": "MARKET", "gics": "Basic Materials"},
 "INDUSTRIAL": {"label": "INDUSTRIAL", "parent": "MARKET", "gics": "Industrials"},
 "CONSUMER": {"label": "CONSUMER", "parent": "MARKET", "gics": "Consumer Cyclical / Defensive / Communication"},
 "CRYPTO": {"label": "CRYPTO", "parent": "MARKET", "gics": "none (coins + equities)"},
 "INTERNATIONAL": {"label": "INTERNATIONAL", "parent": "MARKET", "gics": "none", "why": "INTL split by region and listing; the index funds of each region are its reference lines"},
 "INDEX_LAYER": {"label": "INDEX LAYER (reference lines)", "parent": "MARKET", "gics": "none"},
 "TECH": {"label": "TECHNOLOGY (sector)", "parent": "MARKET", "gics": "Technology"},
 "REAL_ESTATE": {"label": "REAL ESTATE (sector)", "parent": "MARKET", "gics": "Real Estate"},
}
# every proposed cohort: id, label, parents (1 or 2), spine (open source), members, reference funds
P = []
def C(id, label, parents, spine, members, funds=(), note=None, from_cohorts=()):
    ms = sorted(set(members)); P.append({"id": id, "label": label, "parents": parents, "spine": spine, "members": ms, "n": len(ms),
                                        "reference_funds": list(funds), "note": note, "from_cohorts": list(from_cohorts)})
# --- AI + SEMIS
C("AI_ACCELERATORS", "AI ACCELERATORS & LOGIC", ["AI", "SEMIS"], "SMH/SOXX holdings ∩ FMP 'Semiconductors', the compute and interconnect chip makers (not memory, not equipment, not analog)",
  S("NVDA", "AMD", "AVGO", "ARM", "MRVL", "TSM", "INTC", "QCOM", "GFS", "RMBS", "SIMO", "CBRS", "ALAB"), ("SMH", "SOXX", "XSD"), from_cohorts=("AI_HARDWARE", "SEMICONDUCTORS"))
C("MEMORY_STORAGE", "MEMORY & STORAGE", ["AI", "SEMIS"], "Roundhill Memory ETF (DRAM) holdings ∩ ours, plus FMP 'Computer Hardware' storage names",
  S("MU", "SNDK", "WDC", "STX", "P", "NTAP"), ("DRAM",), from_cohorts=("AI_HARDWARE",))
C("SEMICAP_EDA", "SEMICAP, MATERIALS & CHIP DESIGN", ["SEMIS", "AI"], "SMH/SOXX equipment holdings + FMP 'Semiconductors' equipment names + the two EDA houses (held by SMH)",
  S("AMAT", "LRCX", "KLAC", "ASML", "TER", "ONTO", "FORM", "ACMR", "UCTT", "ENTG", "AMKR", "CDNS", "SNPS"), ("SMH", "SOXX"), from_cohorts=("AI_HARDWARE", "AI_SOFTWARE"))
C("ANALOG_RF_POWER", "ANALOG, RF & POWER SEMIS", ["SEMIS"], "FMP 'Semiconductors' minus the AI, memory and equipment names: the analog, RF, microcontroller and power-chip makers",
  S("ADI", "TXN", "NXPI", "MCHP", "ON", "MPWR", "SWKS", "QRVO", "STM", "NVTS", "VSH", "TSEM"), ("SOXX", "XSD"), from_cohorts=("SEMICONDUCTORS",))
C("AI_NETWORKING_OPTICAL", "AI NETWORKING & OPTICAL", ["AI"], "FMP 'Communication Equipment' + 'Hardware, Equipment & Parts' + the optical/compound-semi names (IYZ/SOXX spine): the datacenter's fibre, switches, connectors and lasers",
  S("ANET", "CIEN", "LITE", "COHR", "FN", "AAOI", "GLW", "APH", "TEL", "CRDO", "POET", "AXTI", "CSCO", "UI"), ("IYZ", "IGM"), from_cohorts=("AI_HARDWARE",))
C("AI_SERVERS_DC_KIT", "AI SERVERS & DATACENTER KIT", ["AI"], "the server builders and the thermal/power kit inside the hall (FMP 'Computer Hardware' + 'Electrical Equipment' hand subset)",
  S("SMCI", "DELL", "VRT", "SHAZ"), ("AGIX",), from_cohorts=("AI_HARDWARE",))
C("NEOCLOUDS_MINERS", "NEOCLOUDS & AI MINERS", ["AI", "CRYPTO"], "the GPU-cloud builders and the bitcoin miners that turned to AI hosting (FMP 'IT Services' + 'Capital Markets' miners; no open fund holds them all — WGMI would, not served)",
  S("CRWV", "NBIS", "APLD", "IREN", "CIFR", "CORZ", "WULF", "HUT", "HIVE", "BTDR", "MARA", "RIOT"), (), from_cohorts=("AI_HARDWARE", "CRYPTO"))
C("DC_PROPERTY", "DATACENTER PROPERTY", ["AI", "REAL_ESTATE"], "FMP 'REIT - Specialty' + GDS: the landlords of the halls",
  S("DLR", "EQIX", "GDS", "IRM"), ("XLRE", "VNQ"), from_cohorts=("AI_HARDWARE",))
C("AI_SOFTWARE_DATA", "AI SOFTWARE & DATA PLATFORMS", ["AI", "SOFTWARE_INTERNET"], "IGV holdings ∩ ours + FMP 'Software - Application/Infrastructure' data & AI names",
  S("PLTR", "SNOW", "MDB", "DDOG", "NOW", "CRM", "ADBE", "APP", "ZETA", "PATH", "NTNX", "FROG", "TWLO", "ORCL", "MSFT", "INTU"), ("IGV", "SKYY", "AGIX"), from_cohorts=("AI_SOFTWARE", "GROWTH", "THEMATIC"))
C("CYBER", "CYBERSECURITY", ["SOFTWARE_INTERNET"], "CIBR holdings ∩ ours (pure plays only; CSCO/AVGO/MSFT stay in their own cohorts)",
  S("CRWD", "PANW", "FTNT", "ZS", "NET", "OKTA", "S"), ("CIBR",), from_cohorts=("AI_HARDWARE", "AI_SOFTWARE", "GROWTH"))
C("AI_POWERTRAIN", "AI POWERTRAIN", ["AI", "ENERGY_POWER"], "Alan's definition (Hub comment, 24 Sep): generators selling to hyperscalers, the kit, the reactors, the fuel, the fuel cells, the storage — widened by the same rule to TLN/NRG (generators) and LEU/UUUU (fuel)",
  S("CEG", "VST", "TLN", "NRG", "GEV", "OKLO", "SMR", "CCJ", "LEU", "UUUU", "BE", "EOSE"), ("URA", "XLU", "VPU"), from_cohorts=("AI_POWERTRAIN",))
C("ROBOTICS_AUTOMATION", "ROBOTICS & AUTOMATION", ["AI", "INDUSTRIAL"], "BOTZ holdings ∩ ours, pure plays (NVDA/TSLA/GOOGL/DE stay home)",
  S("SYM", "SERV", "OUST", "ISRG", "AUR"), ("BOTZ",), from_cohorts=("THEMATIC",))
# --- FRONTIER
C("SPACE", "SPACE", ["FRONTIER"], "ARKX holdings ∩ ours + FMP 'Aerospace & Defense' satellite/launch names",
  S("RKLB", "ASTS", "LUNR", "RDW", "PL", "BKSY", "SATL", "SIDU", "SPIR", "SPCX", "VSAT"), ("ARKX",), from_cohorts=("THEMATIC", "MEGACAP"))
C("QUANTUM", "QUANTUM", ["FRONTIER"], "QTUM holdings, pure-play subset (QTUM also holds enablers such as NVDA, which stay home)",
  S("IONQ", "QBTS", "RGTI", "QUBT"), ("QTUM",), from_cohorts=("THEMATIC",))
C("AUTONOMY_EVTOL", "AUTONOMY, eVTOL & DRONES", ["FRONTIER"], "FMP 'Aerospace & Defense' + 'Airlines' eVTOL names and the autonomy names in THEMATIC",
  S("JOBY", "ACHR", "EVTL", "EH", "ONDS", "AUR"), (), from_cohorts=("THEMATIC",))
C("DEFENCE_TECH", "DEFENCE TECH", ["FRONTIER", "INDUSTRIAL"], "the new-generation defence names (drones, software, sensors) — ITA's small end plus PLTR/AXON",
  S("KTOS", "AVAV", "AXON", "LDOS", "PLTR"), ("ITA",), from_cohorts=("THEMATIC",))
# --- SOFTWARE & INTERNET
C("MAG7", "MAGNIFICENT 7", ["MARKET"], "MAGS (Roundhill Magnificent Seven ETF) holdings — the seven, both Alphabet lines",
  S("AAPL", "MSFT", "GOOGL", "GOOG", "AMZN", "META", "NVDA", "TSLA"), ("MAGS", "QQQ"), from_cohorts=("MEGACAP",), note="Alan: 'Mega caps, I don't know if that'll be a cohort … we're going to have the Mag 7.' MEGACAP becomes a cap filter; this is the cohort.")
C("INTERNET_PLATFORMS", "INTERNET & CONSUMER PLATFORMS", ["SOFTWARE_INTERNET", "CONSUMER"], "FDN holdings ∩ ours + FMP 'Internet Content & Information' / 'Travel Services' / 'Gaming' platform names",
  S("META", "GOOGL", "GOOG", "AMZN", "NFLX", "SPOT", "RDDT", "PINS", "SNAP", "MTCH", "DASH", "UBER", "LYFT", "ABNB", "BKNG", "RBLX", "TTWO", "DKNG"), ("FDN",), from_cohorts=("GROWTH", "MEGACAP", "AI_SOFTWARE"))
C("PAYMENTS_FINTECH", "PAYMENTS & FINTECH", ["FINANCE", "SOFTWARE_INTERNET"], "IPAY/FINX holdings ∩ ours + FMP 'Financial - Credit Services'",
  S("V", "MA", "AXP", "COF", "PYPL", "XYZ", "AFRM", "SOFI", "HOOD", "GPN", "FIS", "TOST", "NU", "SYF", "PAYC"), ("IPAY", "FINX"), from_cohorts=("GROWTH",))
# --- CRYPTO
C("CRYPTO_EQUITIES", "CRYPTO EQUITIES", ["CRYPTO"], "the exchange, the treasury company, the broker with a crypto book, and the miners (FMP 'Capital Markets' / 'IT Services' miners). The coins (BTCUSD …) stay in the CRYPTO heading as reference lines; the chart API does not serve them in the 590.",
  S("COIN", "MSTR", "HOOD", "MARA", "RIOT", "HUT", "HIVE", "WULF", "CIFR", "BTDR", "CORZ", "IREN"), (), from_cohorts=("CRYPTO",))
# --- ENERGY & POWER
C("NUCLEAR_URANIUM", "NUCLEAR & URANIUM", ["ENERGY_POWER"], "URA holdings ∩ ours + FMP 'Uranium'",
  S("CCJ", "LEU", "UUUU", "OKLO", "SMR"), ("URA",), from_cohorts=("AI_POWERTRAIN",))
C("SOLAR_RENEWABLE", "SOLAR & RENEWABLE", ["ENERGY_POWER"], "TAN holdings ∩ ours + FMP 'Solar' + the clean-energy integrator (ICLN would widen it; not served)",
  S("FSLR", "ENPH", "NXT", "RUN", "SEDG", "AMRC"), ("TAN",), from_cohorts=("THEMATIC",))
C("OIL_UPSTREAM", "OIL & GAS · PRODUCERS", ["ENERGY_POWER"], "FMP 'Oil & Gas Integrated' + 'Exploration & Production' (XOP/IEO spine)", ind("Oil & Gas Integrated", "Oil & Gas Exploration & Production"), ("XOP", "IEO", "XLE"))
C("OIL_MIDSTREAM", "OIL & GAS · PIPELINES", ["ENERGY_POWER"], "FMP 'Oil & Gas Midstream'", ind("Oil & Gas Midstream"), ("XLE",))
C("OIL_REFINERS", "OIL & GAS · REFINERS", ["ENERGY_POWER"], "FMP 'Oil & Gas Refining & Marketing'", ind("Oil & Gas Refining & Marketing"), ("XLE",))
C("OIL_SERVICES", "OIL & GAS · SERVICES", ["ENERGY_POWER"], "FMP 'Oil & Gas Equipment & Services' (IEZ spine)", ind("Oil & Gas Equipment & Services"), ("IEZ",))
C("REGULATED_UTILITIES", "REGULATED UTILITIES", ["ENERGY_POWER"], "FMP 'Regulated Electric' + 'Regulated Gas' + 'Diversified Utilities' (XLU/VPU spine)", ind("Regulated Electric", "Regulated Gas", "Diversified Utilities"), ("XLU", "VPU", "IDU"))
C("POWER_GENERATORS", "INDEPENDENT POWER", ["ENERGY_POWER"], "FMP 'Independent Power Producers' minus the reactor developer", S("CEG", "VST", "NRG", "TLN"), ("XLU",))
C("GRID_ELECTRICAL", "GRID & ELECTRICAL EQUIPMENT", ["ENERGY_POWER", "INDUSTRIAL"], "FMP 'Electrical Equipment & Parts' + 'Engineering & Construction' grid builders (PAVE spine)",
  S("ETN", "GEV", "HUBB", "NVT", "AME", "PWR", "FIX", "VRT", "EMR"), ("PAVE", "XLI"))
# --- FINANCE
C("BIG_BANKS_BROKERS", "BIG BANKS & BROKERS", ["FINANCE"], "FMP 'Banks - Diversified' + the bulge-bracket 'Capital Markets' names + the two super-regionals (IYG spine)",
  S("JPM", "BAC", "C", "WFC", "GS", "MS", "SCHW", "USB", "PNC"), ("IYG", "KBE", "XLF"))
C("REGIONAL_BANKS", "REGIONAL BANKS", ["FINANCE"], "FMP 'Banks - Regional' (KRE/IAT spine)", S("CATY", "CVBF", "FULT", "HWC", "SFNC", "TRMK", "UMBF"), ("KRE", "IAT"))
C("EXCHANGES_DATA", "EXCHANGES & MARKET DATA", ["FINANCE"], "FMP 'Financial - Data & Stock Exchanges' minus COIN (IAI spine)", S("CME", "ICE", "SPGI", "MCO"), ("IAI",))
C("ASSET_MANAGERS", "ASSET MANAGERS & ALTS", ["FINANCE"], "FMP 'Asset Management' + the custodian", S("BLK", "BX", "KKR", "BNY"), ("XLF",))
C("INSURANCE", "INSURANCE", ["FINANCE"], "FMP 'Insurance - *' (KIE/IAK spine)", ind("Insurance - Brokers", "Insurance - Diversified", "Insurance - Property & Casualty"), ("KIE", "IAK"))
# --- HEALTH
C("BIG_PHARMA", "BIG PHARMA", ["HEALTH"], "FMP 'Drug Manufacturers - General' (IHE/XPH spine)", ind("Drug Manufacturers - General"), ("IHE", "XPH"))
C("BIOTECH", "BIOTECH", ["HEALTH"], "FMP 'Biotechnology' (XBI/IBB spine)", ind("Biotechnology"), ("XBI", "IBB"))
C("MEDTECH", "MEDTECH", ["HEALTH"], "FMP 'Medical - Devices' + 'Instruments & Supplies' (IHI spine)", ind("Medical - Devices", "Medical - Instruments & Supplies"), ("IHI",))
C("TOOLS_DIAGNOSTICS", "LIFE-SCIENCE TOOLS & DIAGNOSTICS", ["HEALTH"], "FMP 'Medical - Diagnostics & Research'", ind("Medical - Diagnostics & Research"), ("XLV",))
C("HEALTH_SERVICES", "INSURERS & HEALTH SERVICES", ["HEALTH"], "FMP 'Healthcare Plans' + 'Care Facilities' + 'Distribution' + 'Health Information' (IHF spine)",
  ind("Medical - Healthcare Plans", "Medical - Care Facilities", "Medical - Distribution", "Medical - Healthcare Information Services"), ("IHF",))
# --- MATERIALS & METALS
C("PRECIOUS_METALS", "PRECIOUS METALS", ["MATERIALS_METALS"], "GDX/GDXJ/SIL holdings ∩ ours + FMP 'Gold' / 'Other Precious Metals'; GLD/SLV are the metal's reference lines",
  ind("Gold", "Other Precious Metals"), ("GLD", "SLV", "GDX", "GDXJ", "SIL", "SILJ"), from_cohorts=("METALS",))
C("COPPER_STEEL", "COPPER & STEEL", ["MATERIALS_METALS"], "FMP 'Copper' + 'Steel' (COPX spine)", ind("Copper", "Steel"), ("COPX", "XLB"), from_cohorts=("METALS",))
C("CRITICAL_MINERALS", "CRITICAL MINERALS & LITHIUM", ["MATERIALS_METALS"], "REMX/LIT holdings ∩ ours + FMP 'Industrial Materials' + the lithium chemicals", S("ALB", "SQM", "MP", "LAC", "USAR", "CRML"), ("REMX", "LIT"), from_cohorts=("THEMATIC",))
C("CHEMICALS_BUILDING", "CHEMICALS & BUILDING MATERIALS", ["MATERIALS_METALS"], "FMP 'Chemicals*' + 'Construction Materials' + 'Agricultural Inputs' minus the lithium names",
  [t for t in ind("Chemicals - Specialty", "Chemicals", "Construction Materials", "Agricultural Inputs") if t not in ("ALB", "SQM")], ("XLB", "VAW"))
# --- INDUSTRIAL
C("DEFENCE_PRIMES", "AEROSPACE & DEFENCE PRIMES", ["INDUSTRIAL"], "ITA holdings ∩ ours, the primes and their suppliers (FMP 'Aerospace & Defense' minus space/eVTOL/drones)",
  S("LMT", "NOC", "GD", "RTX", "LHX", "BA", "GE", "HWM", "HEI", "TDG", "MOG.A", "ATI"), ("ITA",), from_cohorts=("MEGACAP",))
C("MACHINERY_CAPGOODS", "MACHINERY & CAPITAL GOODS", ["INDUSTRIAL"], "FMP 'Industrial - Machinery' + 'Agricultural - Machinery' + 'Conglomerates' + 'Industrial - Distribution' + rental (XLI/VIS spine)",
  [t for t in ind("Industrial - Machinery", "Agricultural - Machinery", "Conglomerates", "Industrial - Distribution", "Rental & Leasing Services") if t not in ("GEV", "SERV", "SYM", "EMR")], ("XLI", "VIS"))
C("TRANSPORT", "RAIL, FREIGHT & AIRLINES", ["INDUSTRIAL"], "IYT/JETS holdings ∩ ours (FMP 'Railroads' + 'Freight' + 'Trucking' + 'Airlines' minus JOBY)",
  [t for t in ind("Railroads", "Integrated Freight & Logistics", "Trucking", "Airlines, Airports & Air Services") if t != "JOBY"], ("IYT", "JETS"))
C("HOUSING", "HOUSING & HOME IMPROVEMENT", ["INDUSTRIAL", "CONSUMER"], "XHB/ITB holdings ∩ ours", S("DHI", "HD", "LOW"), ("XHB", "ITB"))
C("BUSINESS_SERVICES", "BUSINESS SERVICES & PAYROLL", ["INDUSTRIAL"], "FMP 'Specialty Business Services' + 'Waste Management' + the payroll processors", S("CTAS", "WM", "ADP", "PAYC"), ("XLI",))
# --- CONSUMER
C("AUTOS_EV", "AUTOS & EV", ["CONSUMER"], "FMP 'Auto - Manufacturers' + 'Auto - Parts' (the Chinese EV makers also sit in CHINA)", ind("Auto - Manufacturers", "Auto - Parts"), ("XLY", "VCR"), from_cohorts=("THEMATIC",))
C("RETAIL", "RETAIL & E-COMMERCE (US)", ["CONSUMER"], "XRT holdings ∩ ours + FMP retail industries, US-listed domestic names (the ADR e-commerce names sit in their region)",
  S("AMZN", "WMT", "COST", "TGT", "TJX", "ROST", "ORLY", "KR", "NKE"), ("XRT", "XLY"))
C("TRAVEL_LEISURE", "TRAVEL & LEISURE", ["CONSUMER"], "PEJ holdings ∩ ours + FMP 'Travel *' + 'Entertainment' live/parks + 'Gambling'", S("ABNB", "BKNG", "RCL", "HLT", "MAR", "DIS", "LYV", "DKNG"), ("PEJ",), from_cohorts=("GROWTH",))
C("RESTAURANTS", "RESTAURANTS", ["CONSUMER"], "FMP 'Restaurants'", ind("Restaurants"), ("XLY",))
C("STAPLES", "CONSUMER STAPLES", ["CONSUMER"], "FMP Consumer Defensive industries minus the discount stores (which sit in RETAIL) (XLP/VDC spine)",
  [t for t in COMPANIES if sector_of[t] == "Consumer Defensive" and industry_of[t] != "Discount Stores"], ("XLP", "VDC"))
C("MEDIA_TELECOM", "MEDIA & TELECOM", ["CONSUMER"], "FMP 'Entertainment' studios + 'Telecommunications Services' + 'Advertising' minus the platforms (XLC/VOX spine)",
  S("DIS", "FOXA", "WBD", "CMCSA", "CHTR", "T", "TMUS", "VZ", "OMC"), ("XLC", "VOX"))
# --- REAL ESTATE + the leftovers that are real cohorts
C("REITS", "REITs (property)", ["REAL_ESTATE"], "FMP 'REIT - *' minus the datacenter and tower landlords + the broker (VNQ/XLRE/REZ spine)",
  S("EXR", "PLD", "PSA", "O", "SPG", "VICI", "VTR", "WELL", "RHP", "CBRE"), ("VNQ", "XLRE", "REZ"))
C("TOWERS", "TELECOM TOWERS", ["REAL_ESTATE"], "FMP 'REIT - Specialty' tower owners", S("AMT", "CCI", "SBAC"), ("XLRE",))
C("IT_SERVICES", "IT SERVICES & CONSULTING", ["SOFTWARE_INTERNET"], "FMP 'Information Technology Services' + 'Technology Distributors' minus the miners and neoclouds", S("ACN", "IBM", "SNX"), ("IGM",))
C("PACKAGING", "PACKAGING", ["MATERIALS_METALS"], "FMP 'Packaging & Containers'", ind("Packaging & Containers"), ("XLB",))
# --- INTERNATIONAL (by region / ADR). Country = FMP profile country (1 Oct export) or is_adr; the domicile-of-convenience names stay US.
C("CHINA", "CHINA (ADRs)", ["INTERNATIONAL"], "FMP country CN/HK or is_adr, Chinese operating companies (FXI/MCHI/ASHR are the reference lines)",
  S("BABA", "JD", "PDD", "BIDU", "LI", "NIO", "XPEV", "EH", "GDS"), ("FXI", "MCHI", "ASHR"), from_cohorts=("INTL", "THEMATIC"))
C("EUROPE", "EUROPE (listed here)", ["INTERNATIONAL"], "FMP country NL/GB/SE/BE/CH operating companies and the European ADRs (EZU/EWG/EWU/EFA reference lines)",
  S("ASML", "ARM", "SPOT", "NOK", "STM", "NBIS", "EVTL", "ARGX"), ("EZU", "EWG", "EWU", "EFA"), from_cohorts=("INTL",))
C("ASIA_PACIFIC", "ASIA-PACIFIC ex-CHINA", ["INTERNATIONAL"], "FMP country TW/HK(Taiwanese)/AU/IL operating companies (EWJ/EWY reference lines; no Japanese or Korean single name is served)",
  S("TSM", "SIMO", "IREN", "TSEM"), ("EWJ", "EWY", "EEM"))
C("CANADA", "CANADA", ["INTERNATIONAL"], "FMP country CA", S("AEM", "CCJ", "FNV", "KGC", "LAC", "PAAS", "SHOP", "WPM", "TECK"), ("EFA",))
C("LATAM", "LATIN AMERICA", ["INTERNATIONAL"], "FMP country UY/BR/CL + the Peru-weighted copper miner", S("MELI", "NU", "SQM", "SCCO"), ("EEM",))
# --- INDEX LAYER (funds only; reference lines)
IDX = [
 ("IDX_US_BROAD", "US BROAD", "SPY QQQ QQQE DIA IWM RSP MDY IJR VTI ITOT IWV", "the five the Hub already draws, plus the equal-weight and total-market lines"),
 ("IDX_WORLD", "WORLD & REGIONS", "VT VXUS EFA EEM EZU EWJ EWG EWU EWY FXI MCHI ASHR", "VT stands in for MSCI ACWI until URTH/ACWI are served; EFA = developed ex-US, EEM = emerging, EZU = euro area, EWJ = Japan"),
 ("IDX_STYLE", "STYLE & FACTOR", "VUG VTV MGK MTUM QUAL SPLV SCHD", "growth, value, momentum, quality, low-vol, dividend"),
 ("IDX_SECTOR_FUNDS", "SECTOR FUNDS", "XLK XLF XLV XLY XLP XLE XLI XLB XLU XLRE XLC VGT VFH VHT VCR VDC VDE VIS VAW VPU VNQ VOX IYW IYF IYH IYC IYK IYE IYJ IYM IDU IYR IYZ RSPT RSPF RSPH RSPD RSPS RSPG RSPN RSPM RSPU RSPR RSPC", "the GICS side of the compare toggle — unchanged, the tree sits beside it"),
 ("IDX_MACRO", "MACRO", "TLT IEF SHY AGG LQD HYG UUP USO DBC GLD SLV VXX", "rates, credit, dollar, oil, metals, volatility (the futures/yields in today's MACRO cohort are not in the 590)"),
]
for id, label, ts, why in IDX:
    P.append({"id": id, "label": label, "parents": ["INDEX_LAYER"], "spine": why, "members": S(*ts.split()), "n": len(S(*ts.split())), "reference_funds": [], "note": "funds only — reference lines, not a cohort of companies", "from_cohorts": ["INDEXES", "MACRO", "INTL"]})
THEME_FUNDS = sorted({f for c in P for f in c["reference_funds"] if f in Uset} - set(sum([x[2].split() for x in IDX], [])))
P.append({"id": "IDX_THEME_FUNDS", "label": "THEME FUNDS (each is its cohort's spine line)", "parents": ["INDEX_LAYER"], "spine": "every theme fund we serve, hung as the reference line of the cohort it defines", "members": THEME_FUNDS, "n": len(THEME_FUNDS), "reference_funds": [], "note": "funds only", "from_cohorts": []})

# coverage: which companies land nowhere
covered = collections.Counter()
for c in P:
    for t in c["members"]: covered[t] += 1
unplaced = sorted(t for t in COMPANIES if covered[t] == 0)
unplaced_funds = sorted(t for t in FUNDS if covered[t] == 0)
for c in P:
    c["home_sector"] = collections.Counter(sector_of.get(t) for t in c["members"] if t in sector_of).most_common(1)[0][0] if any(t in sector_of for t in c["members"]) else None
multi = {t: [c["id"] for c in P if t in c["members"]] for t in COMPANIES if covered[t] >= 2}

# ---------------------------------------------------------------- PART 3 · moves together
SECTOR_FUND = {"Technology": "XLK", "Financial Services": "XLF", "Healthcare": "XLV", "Consumer Cyclical": "XLY", "Consumer Defensive": "XLP", "Energy": "XLE",
               "Industrials": "XLI", "Basic Materials": "XLB", "Utilities": "XLU", "Real Estate": "XLRE", "Communication Services": "XLC"}
sector_corr = {}
for s in SECTOR_FUND:
    ts = [t for t in PRICED_COMPANIES if sector_of[t] == s]
    c, n = avg_pair_corr(ts); sector_corr[s] = {"avg_pair_corr": c, "n": n, "fund": SECTOR_FUND[s]}
def test_row(label, ts, home, tag):
    comp = [t for t in ts if not is_fund(t)]
    c, n = avg_pair_corr(comp)
    row = {"cohort": label, "set": tag, "n_priced": n, "avg_pair_corr": None if c is None else round(c, 3), "home_sector": home,
           "sector_avg_pair_corr": None if not home or home not in sector_corr else round(sector_corr[home]["avg_pair_corr"], 3),
           "sector_fund": SECTOR_FUND.get(home), "corr_with_sector_fund": None, "null95_same_size": None, "verdict": None}
    if c is not None:
        row["null95_same_size"] = round(null95(n, PRICED_COMPANIES), 3)
        if row["sector_fund"]: row["corr_with_sector_fund"] = (lambda v: None if v is None else round(v, 3))(corr_mean_vs(comp, row["sector_fund"]))
        sc = row["sector_avg_pair_corr"]
        beats_sector = sc is not None and c > sc; beats_null = c > row["null95_same_size"]
        row["verdict"] = "STRONGER than its sector" if (beats_sector and beats_null) else ("moves together, but no tighter than its sector" if beats_null else "no tighter than a random set of that size")
        row["delta_vs_sector"] = None if sc is None else round(c - sc, 3)
    return row
test_after = []
for c in P:
    if c["id"].startswith("IDX_"): continue
    test_after.append(test_row(c["label"], c["members"], c["home_sector"], "proposed"))
test_before = []
for cname in ["AI_HARDWARE", "AI_SOFTWARE", "AI_POWERTRAIN", "CRYPTO", "METALS", "SEMICONDUCTORS", "GROWTH", "THEMATIC", "MEGACAP", "INTL", "BLUE_CHIP", "LARGE_CAP", "MEGA_CAP"]:
    ts = [t for t in members[cname] if t in Uset]
    home = collections.Counter(sector_of.get(t) for t in ts if t in sector_of).most_common(1)[0][0] if any(t in sector_of for t in ts) else None
    test_before.append(test_row(cname, ts, home, "today"))
sectors_table = [{"sector": s, "fund": v["fund"], "n_priced": v["n"], "avg_pair_corr": round(v["avg_pair_corr"], 3)} for s, v in sector_corr.items()]
moves = {"what": "Average pairwise correlation of daily log returns over the last 126 sessions, companies only (funds excluded). A cohort is STRONGER when its members move together more than all our names in its home GICS/FMP sector do, and more than the 95th percentile of 150 random sets of the same size.",
         "window": WINDOW, "sectors": sectors_table, "today": test_before, "proposed": test_after,
         "summary": {"proposed_cohorts_tested": sum(1 for r in test_after if r["avg_pair_corr"] is not None),
                     "stronger_than_sector": sum(1 for r in test_after if r["verdict"] and r["verdict"].startswith("STRONGER")),
                     "today_tested": sum(1 for r in test_before if r["avg_pair_corr"] is not None),
                     "today_stronger": sum(1 for r in test_before if r["verdict"] and r["verdict"].startswith("STRONGER"))}}
W("moves-together.json", moves)
for c in P:
    r = next((x for x in test_after if x["cohort"] == c["label"]), None)
    c["moves_together"] = None if not r else {k: r[k] for k in ("n_priced", "avg_pair_corr", "sector_avg_pair_corr", "null95_same_size", "verdict")}

# ---------------------------------------------------------------- PART 4 · gaps
# (a) GICS sub-industries by SPY weight, where we hold 0 or 1 S&P name
subind = collections.defaultdict(lambda: {"weight": 0.0, "names": []})
def spy_key(t): return t.replace(".", "-") if t not in SPY and t.replace(".", "-") in SPY else t
for t, g in GICS.items():
    w = (SPY.get(t) or SPY.get(t.replace(".", "-")) or SPY.get(t.replace("-", ".")) or {}).get("weight_pct", 0.0)
    si = g["gics_sub_industry"]; subind[si]["weight"] += w; subind[si]["names"].append((t, w, g["gics_sector"]))
Ualt = Uset | {t.replace("-", ".") for t in Uset} | {t.replace(".", "-") for t in Uset}
gaps_gics = []
for si, v in subind.items():
    ours = [t for t, w, s in v["names"] if t in Ualt]
    if len(ours) <= 1:
        cands = sorted([x for x in v["names"] if x[0] not in Ualt], key=lambda x: -x[1])[:5]
        gaps_gics.append({"gics_sub_industry": si, "gics_sector": v["names"][0][2], "spy_weight_pct": round(v["weight"], 3), "sp500_names": len(v["names"]), "we_hold": ours,
                          "candidates": [{"ticker": t, "name": (SPY.get(t) or {}).get("name"), "spy_weight_pct": round(w, 3)} for t, w, s in cands]})
gaps_gics.sort(key=lambda r: -r["spy_weight_pct"])
# (b) theme funds: our coverage of each theme fund we hold holdings for, and the biggest US-listed names we lack
theme_cov = []
for f in sorted(HOLD):
    if f not in Uset: continue
    hs = [h for h in HOLD[f]["h"] if h[0] != f and "." not in h[0] and not re.match(r"^\d", h[0]) and len(h[0]) <= 5]
    ours = [h for h in hs if h[0] in Uset]; lack = [h for h in hs if h[0] not in Uset]
    theme_cov.append({"fund": f, "name": name_of.get(f, f), "us_listed_holdings": len(hs), "we_hold": len(ours), "weight_held_pct": round(sum(h[1] for h in ours), 1),
                      "biggest_missing": [{"ticker": h[0], "weight_pct": round(h[1], 2)} for h in sorted(lack, key=lambda h: -h[1])[:5]]})
theme_cov.sort(key=lambda r: (r["we_hold"], -r["us_listed_holdings"]))
# (c) index layer gaps
idx_gaps = [{"ticker": t, "what": w} for t, w in [("URTH", "iShares MSCI World — Alan: 'the MSCI World Index, I'm not sure we have' (we do not)"), ("ACWI", "iShares MSCI ACWI (world incl. EM)"),
             ("VGK", "Vanguard FTSE Europe"), ("IEFA", "iShares Core MSCI EAFE"), ("VWO", "Vanguard FTSE Emerging"), ("INDA", "iShares MSCI India"), ("EWZ", "iShares MSCI Brazil"),
             ("EWT", "iShares MSCI Taiwan"), ("KWEB", "KraneShares China Internet"), ("ICLN", "iShares Global Clean Energy (the brief's example spine)"), ("ARKK", "ARK Innovation (the brief's example spine)"),
             ("WGMI", "Valkyrie Bitcoin Miners (would define NEOCLOUDS & MINERS)"), ("HACK", "Amplify Cybersecurity"), ("IBIT", "iShares Bitcoin Trust (the coin, tradeable, priceable by the chart API)")] if t not in Uset]
# (d) FMP peers of each proposed cohort's members that we do not serve
peer_by = collections.defaultdict(list)
for r in PEERS: peer_by[r["ticker"]].append(r["peer"])
cohort_peer_gaps = []
for c in P:
    if c["id"].startswith("IDX_"): continue
    cnt = collections.Counter()
    for t in c["members"]:
        for p in peer_by.get(t, []):
            if p not in Uset and "." not in p: cnt[p] += 1
    top = [{"ticker": p, "named_by": n} for p, n in cnt.most_common(5) if n >= 2]
    if top: cohort_peer_gaps.append({"cohort": c["label"], "candidates": top})
# (e) themes we hold nothing or one name in (hand list, open spines named)
theme_gaps = [
 {"theme": "Japan / Korea single names", "we_hold": [], "candidates": ["TM", "SONY", "MUFG", "HMC", "KB"], "spine": "EWJ / EWY holdings (ADRs)"},
 {"theme": "India", "we_hold": [], "candidates": ["INFY", "HDB", "IBN", "WIT", "INDA"], "spine": "INDA holdings (ADRs)"},
 {"theme": "Europe industrial & luxury ADRs", "we_hold": ["ASML", "ARM", "SPOT", "NOK"], "candidates": ["SAP", "NVO", "AZN", "SHEL", "TTE", "UL", "BP", "RIO", "BHP"], "spine": "EFA / EZU holdings with US ADRs"},
 {"theme": "Homebuilders", "we_hold": ["DHI"], "candidates": ["LEN", "PHM", "NVR", "TOL", "KBH"], "spine": "XHB / ITB holdings"},
 {"theme": "Managed care is covered; hospitals & labs thin", "we_hold": ["HCA"], "candidates": ["THC", "UHS", "LH", "DGX"], "spine": "IHF holdings"},
 {"theme": "Apparel & luxury", "we_hold": ["NKE"], "candidates": ["LULU", "RL", "TPR", "DECK", "ONON"], "spine": "XLY holdings"},
 {"theme": "Water & environmental utilities", "we_hold": [], "candidates": ["AWK", "XYL", "WTRG", "RSG"], "spine": "PHO / IDU holdings"},
 {"theme": "Bitcoin itself (priceable)", "we_hold": [], "candidates": ["IBIT", "BITO", "GBTC"], "spine": "the coin the CRYPTO cohort compares against; BTCUSD is in ticker_cohorts but not in the 590"},
 {"theme": "Clean energy beyond solar", "we_hold": ["AMRC"], "candidates": ["GEV (held)", "VWS (ADR VWDRY)", "PLUG", "ARRY", "FLNC"], "spine": "ICLN holdings"},
 {"theme": "Agriculture & food producers", "we_hold": ["ADM", "CTVA", "DE"], "candidates": ["BG", "TSN", "HRL", "GIS", "CF", "MOS"], "spine": "MOO / XLP holdings"},
]
gaps = {"what": "Where the market has an industry or theme and we hold zero or one name. (a) is open and measured: S&P 500 GICS sub-industries by SPY weight (SSgA file, 22 Sep; Wikipedia GICS list, 24 Sep). (b) is measured: each theme fund we serve, how much of its US-listed book we hold. (c) and (e) are named lists. (d) is FMP's own peer lists. Proposals only; admissions are the coordinator's and Alan's.",
        "gics_sub_industries_thin": gaps_gics, "theme_fund_coverage": theme_cov, "index_layer_missing": idx_gaps, "fmp_peer_candidates": cohort_peer_gaps, "themes_thin": theme_gaps}
W("gaps.json", gaps)

# ---------------------------------------------------------------- PART 2 output + tree text + apply preview
proposal = {"what": "A theme tree beside the GICS sectors, not instead of them. Every topic cohort names its parent(s), its open spine and its members from the 590. Study only — nothing written to ticker_cohorts or any live table.",
            "built_utc": datetime.datetime.utcnow().isoformat() + "Z", "headings": HEADINGS, "cohorts": P,
            "coverage": {"companies": len(COMPANIES), "placed": len(COMPANIES) - len(unplaced), "unplaced": unplaced, "funds": len(FUNDS), "funds_unplaced": unplaced_funds,
                         "companies_in_two_or_more": len(multi), "two_or_more": multi},
            "dissolved_or_demoted": {"GROWTH": "split by topic into AI SOFTWARE & DATA, INTERNET PLATFORMS, PAYMENTS & FINTECH, CYBER, TRAVEL & LEISURE (Alan: 'my growth names should be split into further cohorts by topic, with their right parents')",
                                     "THEMATIC": "split into SPACE, QUANTUM, AUTONOMY/eVTOL, ROBOTICS, SOLAR, CRITICAL MINERALS, AUTOS & EV, CHINA (Alan: 'Thematic: split up')",
                                     "MEGACAP": "becomes the cap filter MEGA (as the 28 Sep registry already proposed); MAGNIFICENT 7 is the cohort",
                                     "INTL": "split by region: CHINA, EUROPE, ASIA-PACIFIC, CANADA, LATAM; the region funds become the WORLD & REGIONS index layer",
                                     "AI_HARDWARE": "split into ACCELERATORS, MEMORY & STORAGE, SEMICAP & EDA, NETWORKING & OPTICAL, SERVERS & DC KIT, NEOCLOUDS & MINERS, DC PROPERTY",
                                     "BLUE_CHIP / LARGE_CAP / MEGA_CAP / MID_CAP / SMALL_CAP": "stay as filters (attributes), not bars — unchanged from the 28 Sep registry",
                                     "the 47 FMP-industry copies and the 11 sector labels": "left in place; the tree reads them as the GICS side, not as cohorts"}}
W("proposal.json", proposal)

# tree text
lines = []
def kids_of(h): return [c for c in P if c["parents"][0] == h]
def second_of(h): return [c for c in P if len(c["parents"]) > 1 and c["parents"][1] == h]
lines.append(f"THE MARKET  ({len(COMPANIES)} companies · {len(FUNDS)} funds · 6 Oct 2026)")
order = ["AI", "SEMIS", "SOFTWARE_INTERNET", "ENERGY_POWER", "FRONTIER", "FINANCE", "HEALTH", "MATERIALS_METALS", "INDUSTRIAL", "CONSUMER", "REAL_ESTATE", "CRYPTO", "INTERNATIONAL", "INDEX_LAYER"]
for h in order:
    ks = kids_of(h); ss = second_of(h)
    tot = len({t for c in ks for t in c["members"]})
    lines.append(f"├── {HEADINGS[h]['label']}  ({len(ks)} cohorts · {tot} names)")
    for c in ks:
        extra = f"  ← also under {HEADINGS[c['parents'][1]]['label']}" if len(c["parents"]) > 1 else ""
        mt = c.get("moves_together") or {}
        corr = f"  · moves together {mt['avg_pair_corr']:.2f} vs sector {mt['sector_avg_pair_corr']:.2f}" if mt.get("avg_pair_corr") is not None and mt.get("sector_avg_pair_corr") is not None else ""
        lines.append(f"│   ├── {c['label']}  ({c['n']}){extra}{corr}")
    for c in ss:
        lines.append(f"│   ├── ({c['label']} — second parent, {c['n']}; home {HEADINGS[c['parents'][0]]['label']})")
mag = next(c for c in P if c["id"] == "MAG7")
lines.append(f"├── {mag['label']}  ({mag['n']})  — hangs from THE MARKET itself")
lines.append(f"└── GICS SECTORS (unchanged: the SECTORS side of the compare toggle; 11 sector funds + {len(unplaced)} names in no theme cohort read there)")
open(os.path.join(D, "tree.txt"), "w").write("\n".join(lines) + "\n"); print("wrote tree.txt")

# apply preview — what the apply WOULD write (not run)
sql = ["-- CO1 APPLY PREVIEW (6 Oct 2026) — NOT RUN. Additive. The coordinator applies only what Alan approves.",
       "-- 1. a parents table (new, additive): one row per cohort, up to two parents, the open spine.",
       "create table if not exists public.cohort_tree (cohort text primary key, label text not null, parent_1 text not null, parent_2 text, spine text, proposed_by text default 'CO1-20261006');",
       "-- rollback: drop table if exists public.cohort_tree;"]
for c in P:
    sql.append("insert into public.cohort_tree (cohort,label,parent_1,parent_2,spine) values ('%s','%s','%s',%s,'%s') on conflict (cohort) do nothing;" %
               (c["id"], c["label"].replace("'", "''"), c["parents"][0], ("'%s'" % c["parents"][1]) if len(c["parents"]) > 1 else "null", (c["spine"] or "").replace("'", "''")))
sql.append("-- 2. memberships: rows into public.ticker_cohorts (ticker, cohort). Existing rows are NOT deleted here; GROWTH/THEMATIC/MEGACAP/INTL rows stay until Alan says otherwise.")
n_rows = 0
for c in P:
    for t in c["members"]:
        sql.append("insert into public.ticker_cohorts (ticker,cohort) values ('%s','%s') on conflict do nothing;" % (t, c["id"])); n_rows += 1
sql.append(f"-- {n_rows} membership rows across {len(P)} cohorts; {len(P) - 6} are cohorts of companies, 6 are index-layer fund sets.")
sql.append("-- rollback: delete from public.ticker_cohorts where cohort in (" + ",".join("'%s'" % c["id"] for c in P) + ");")
open(os.path.join(D, "apply-preview.sql"), "w").write("\n".join(sql) + "\n"); print("wrote apply-preview.sql", n_rows, "rows")

# console summary
print("\n".join(lines))
print("\nUNPLACED companies:", len(unplaced), unplaced)
print("UNPLACED funds:", unplaced_funds)
print("\nMOVES TOGETHER — today:")
for r in test_before: print(f"  {r['cohort']:16s} n={r['n_priced']:3d} corr={r['avg_pair_corr']} sector={r['home_sector']} {r['sector_avg_pair_corr']} null95={r['null95_same_size']} → {r['verdict']}")
print("MOVES TOGETHER — proposed:")
for r in test_after: print(f"  {r['cohort']:36s} n={r['n_priced']:3d} corr={r['avg_pair_corr']} sector={r['home_sector']} {r['sector_avg_pair_corr']} null95={r['null95_same_size']} → {r['verdict']}")
print("summary", moves["summary"])
print("\nGICS gaps top 12:"); [print("  ", g["gics_sub_industry"], g["spy_weight_pct"], g["we_hold"], [c["ticker"] for c in g["candidates"]]) for g in gaps_gics[:12]]
print("\nkinds:", dict(kinds)); print("uncovered by sector:", {k: len(v) for k, v in unc_by_sector.items()})
print("loose:", {k: [x["ticker"] for x in v] for k, v in loose.items()})
