"""CW4 · the 30 Dow Jones Industrial Average members and their peer sets, chosen by business (not by tag).
Each peer carries a 4–8 word reason: what it shares (product, customer, cycle). Foreign listings are used
when they are the true peer; the builder marks them and the FX date. The DJIA list: FMP's index-constituent
route is not on the proxy's allow-list (checked 20 Oct 2026), so this is the lane's own list of the 30 as
constituted since the 8 Nov 2024 reconstitution (Nvidia for Intel, Sherwin-Williams for Dow Inc.; Amazon for
Walgreens 26 Feb 2024), taken 20 Oct 2026, every symbol checked live against FMP's quote on the fetch date. One 2026 change found by a web
check on 20 Oct: S&P Dow Jones Indices announced on 23 Jun 2026 that Alphabet (GOOGL) replaces Verizon (VZ) before the
open on 29 Jun 2026, and that Honeywell stays in after spinning off Honeywell Aerospace (HONA) the same day
(press.spglobal.com, 2026-06-23). So the 30 here are the post-29-June list.
"""

DOW_BUSINESS = {
    "AAPL": "iPhone, Mac, iPad and wearables; services on 2.3 billion devices",
    "AMGN": "Large-cap biotech: Repatha, Prolia, Enbrel, Otezla; obesity pipeline (MariTide)",
    "AMZN": "E-commerce and logistics, AWS cloud, advertising",
    "AXP":  "Closed-loop card network and lender to affluent consumers and small business",
    "BA":   "Commercial jets (737, 787), defence and space, services",
    "CAT":  "Construction and mining machines; engines and gensets for data centres",
    "CRM":  "Enterprise CRM software: Sales, Service, Marketing, Data clouds; Agentforce",
    "CSCO": "Networking switches and routers, security and observability software (Splunk)",
    "CVX":  "Integrated oil and gas: Permian, Gulf, Kazakhstan; Hess after 2025",
    "DIS":  "Theme parks and cruises, studios, streaming (Disney+, Hulu), ESPN",
    "GS":   "Investment banking, trading, asset and wealth management",
    "HD":   "Largest home-improvement retailer; pro contractors and DIY",
    "HON":  "Building and industrial automation, energy and sustainability; aerospace spun off 29 Jun 2026 (HONA)",
    "IBM":  "Hybrid cloud (Red Hat), consulting, mainframes, AI software",
    "JNJ":  "Pharma (oncology, immunology) and medtech; consumer health spun out 2023",
    "JPM":  "Largest US bank: consumer, cards, investment bank, asset management",
    "KO":   "Non-alcoholic beverages sold through bottlers worldwide",
    "MCD":  "Franchised quick-service restaurants, 43,000 units; rent and royalty model",
    "MMM":  "Diversified industrial: safety, abrasives, adhesives, electronics materials",
    "MRK":  "Pharma: Keytruda, Gardasil, animal health; Keytruda patent cliff 2028",
    "MSFT": "Azure cloud, Office and Windows, LinkedIn, gaming; OpenAI partner",
    "NKE":  "Athletic footwear and apparel; wholesale and direct",
    "NVDA": "AI accelerators, networking and systems; the data-centre GPU standard",
    "PG":   "Household and personal-care brands: Tide, Pampers, Gillette",
    "SHW":  "Architectural and industrial paint, own-store distribution",
    "TRV":  "Property and casualty insurance: commercial, personal, bond and specialty",
    "UNH":  "Largest health insurer plus Optum (care delivery, PBM, data)",
    "V":    "Card payment network; take-rate on global card spend",
    "WMT":  "Largest grocer and discounter; growing marketplace and ads",
    "GOOGL":"Search and YouTube advertising, Google Cloud, Android; Gemini models (in the Dow since 29 Jun 2026)",
}

# ticker -> list of (peer, reason)
PEERS = {
    "AAPL": [
        ("MSFT",      "Consumer and developer platform, same device cycle"),
        ("GOOGL",     "Android and services rival, same handsets"),
        ("005930.KS", "Largest smartphone rival, same phone cycle"),
        ("1810.HK",   "Smartphone and wearables rival, same cycle"),
        ("DELL",      "PCs, same PC refresh cycle"),
        ("HPQ",       "PCs and printers, same consumer hardware"),
        ("SONY",      "Consumer electronics plus content and services"),
    ],
    "AMGN": [
        ("GILD", "Large biotech, same mature-franchise profile"),
        ("REGN", "Large biotech, antibody franchises"),
        ("VRTX", "Large biotech, concentrated franchise"),
        ("ABBV", "Immunology franchise, same biosimilar erosion"),
        ("BMY",  "Mature pharma, same patent cliffs"),
        ("LLY",  "Obesity pipeline rival, same GLP-1 race"),
        ("BIIB", "Mid biotech, same erosion of old drugs"),
    ],
    "AMZN": [
        ("WMT",  "Mass retail and marketplace, same shopper"),
        ("COST", "Membership retail, same grocery basket"),
        ("TGT",  "General merchandise retail, same shopper"),
        ("MSFT", "Hyperscale cloud rival to AWS"),
        ("GOOGL","Hyperscale cloud and ads rival"),
        ("BABA", "E-commerce plus cloud, China mirror"),
        ("MELI", "E-commerce plus logistics, Latin America"),
    ],
    "AXP": [
        ("V",    "Card network, same spend volumes"),
        ("MA",   "Card network, same spend volumes"),
        ("COF",  "Card lender, same consumer credit cycle"),
        ("SYF",  "Card lender, same consumer credit cycle"),
        ("JPM",  "Largest card issuer, same affluent customer"),
        ("C",    "Global card issuer, same spend"),
    ],
    "BA": [
        ("AIR.PA", "The other half of the jet duopoly"),
        ("GE",     "Engines on the same jets, same deliveries"),
        ("RTX",    "Engines and aerostructures, same aircraft cycle"),
        ("LMT",    "Defence prime, same Pentagon budget"),
        ("GD",     "Business jets and defence, same cycle"),
        ("NOC",    "Defence prime, same Pentagon budget"),
        ("HWM",    "Engine and airframe parts, same deliveries"),
    ],
    "CAT": [
        ("DE",     "Heavy equipment, same dealer model and cycle"),
        ("CMI",    "Engines and gensets, same data-centre buyers"),
        ("PCAR",   "Heavy trucks, same freight and dealer cycle"),
        ("6301.T", "Mining and construction machines, same cycle"),
        ("AGCO",   "Farm machinery, same dealer-inventory cycle"),
        ("TEX",    "Aerial and materials-handling machines, same buyers"),
        ("OSK",    "Specialty vehicles and access equipment"),
    ],
    "CRM": [
        ("MSFT", "Dynamics and Copilot, same enterprise seat"),
        ("ORCL", "Enterprise applications, same CIO budget"),
        ("SAP",  "Enterprise applications, same CIO budget"),
        ("NOW",  "Workflow SaaS, same enterprise seat"),
        ("ADBE", "Marketing cloud rival, same creative-marketing budget"),
        ("WDAY", "HR and finance SaaS, same seat-based model"),
        ("HUBS", "CRM for small business, same product"),
    ],
    "CSCO": [
        ("ANET", "Data-centre switching rival, same hyperscalers"),
        ("HPE",  "Networking after Juniper, same enterprise buyer"),
        ("DELL", "Servers and storage, same enterprise buyer"),
        ("PANW", "Network security, same enterprise buyer"),
        ("FFIV", "Application networking, same enterprise buyer"),
        ("NOK",  "Carrier networking gear, same telco capex"),
        ("ERIC", "Carrier networking gear, same telco capex"),
    ],
    "CVX": [
        ("XOM", "US integrated major, same barrels"),
        ("SHEL","European integrated major, same barrels"),
        ("BP",  "European integrated major, same barrels"),
        ("TTE", "European integrated major, same barrels"),
        ("COP", "Largest US independent producer, same oil price"),
        ("OXY", "Permian producer, same oil price"),
        ("EOG", "Shale producer, same oil price"),
    ],
    "DIS": [
        ("NFLX",  "Streaming rival, same subscriber"),
        ("CMCSA", "Parks, studios and streaming, same mix"),
        ("WBD",   "Studios, networks and streaming, same decline"),
        ("FOXA",  "Linear networks and sports rights"),
        ("PSKY",  "Studios, networks and streaming, same cycle"),
        ("LYV",   "Live entertainment, same consumer leisure wallet"),
        ("SONY",  "Studios and games, same content economics"),
    ],
    "GS": [
        ("MS",  "Investment bank plus wealth management, same model"),
        ("JPM", "Largest investment-banking fee pool rival"),
        ("C",   "Global markets and banking, same fee pool"),
        ("BAC", "Global markets and banking, same fee pool"),
        ("UBS", "Wealth management and investment bank"),
        ("EVR", "Advisory boutique, same deal cycle"),
        ("LAZ", "Advisory boutique, same deal cycle"),
    ],
    "HD": [
        ("LOW",  "Home-improvement duopoly partner, same housing cycle"),
        ("FND",  "Flooring retail, same home-renovation spend"),
        ("TSCO", "Rural lifestyle retail, same big-box model"),
        ("WMT",  "Big-box retail, same shopper"),
        ("TGT",  "Big-box retail, same shopper"),
        ("COST", "Big-box retail, same shopper"),
        ("FAST", "Pro and industrial distribution, same contractor"),
    ],
    "HON": [
        ("EMR",    "Industrial automation, same factory capex"),
        ("ETN",    "Electrical and building systems, same capex"),
        ("ROK",    "Factory automation, same industrial capex"),
        ("JCI",    "Building automation and controls, same buildings"),
        ("TT",     "Building HVAC and controls, same buildings"),
        ("SIE.DE", "Automation and building tech, same markets"),
        ("MMM",    "Diversified industrial, same short-cycle mix"),
    ],
    "IBM": [
        ("ACN",  "IT consulting and systems integration"),
        ("ORCL", "Enterprise software and cloud infrastructure"),
        ("MSFT", "Hybrid cloud and AI platform rival"),
        ("HPE",  "Enterprise servers and hybrid cloud"),
        ("DELL", "Enterprise infrastructure, same data-centre buyer"),
        ("CTSH", "IT services, same outsourcing budgets"),
        ("SAP",  "Enterprise software, same CIO budget"),
    ],
    "JNJ": [
        ("MRK",  "Big pharma, oncology and vaccines"),
        ("PFE",  "Big pharma, same patent cliffs"),
        ("ABBV", "Immunology rival, same Stelara-style erosion"),
        ("LLY",  "Big pharma, diabetes and obesity"),
        ("ABT",  "Diversified medtech, same hospital customers"),
        ("MDT",  "Medtech, same surgical and cardiology markets"),
        ("NVS",  "European big pharma, same pipeline bets"),
    ],
    "JPM": [
        ("BAC",  "US universal bank, same deposit franchise"),
        ("C",    "US universal bank, same global markets"),
        ("WFC",  "US universal bank, same consumer and commercial"),
        ("GS",   "Investment bank, same fee pool"),
        ("MS",   "Investment bank and wealth, same fee pool"),
        ("HSBC", "Global universal bank, same rate cycle"),
        ("USB",  "Large regional bank, same rate cycle"),
    ],
    "KO": [
        ("PEP",     "Beverage and snack rival, same shelf"),
        ("KDP",     "US beverages, same shelf and bottlers"),
        ("MNST",    "Energy drinks, distributed by Coke's bottlers"),
        ("MDLZ",    "Global snacks, same emerging-market consumer"),
        ("KHC",     "Packaged food, same grocery shelf"),
        ("NESN.SW", "Global food and beverage, same consumer"),
        ("DEO",     "Global spirits, same bar and shelf"),
    ],
    "MCD": [
        ("YUM", "Franchised global QSR, same royalty model"),
        ("CMG", "Fast-casual rival, same lunch occasion"),
        ("SBUX","Global quick-service, same consumer traffic"),
        ("QSR", "Franchised burger chain (Burger King)"),
        ("DPZ", "Franchised pizza delivery, same royalty model"),
        ("WEN", "Franchised burger chain, same traffic"),
        ("DRI", "Casual dining, same restaurant wallet"),
    ],
    "MMM": [
        ("HON", "Diversified industrial, same short-cycle mix"),
        ("ITW", "Diversified industrial, same decentralised model"),
        ("EMR", "Industrial automation and tools"),
        ("DOV", "Diversified industrial, same end markets"),
        ("PH",  "Motion and control, same industrial cycle"),
        ("ETN", "Electrical and industrial, same capex cycle"),
        ("ROK", "Factory automation, same industrial capex"),
    ],
    "MRK": [
        ("PFE",  "Big pharma, same patent cliffs"),
        ("BMY",  "Big pharma, same oncology and cliffs"),
        ("LLY",  "Big pharma, diabetes and obesity"),
        ("ABBV", "Big pharma, immunology and oncology"),
        ("JNJ",  "Big pharma, oncology and vaccines"),
        ("AZN",  "Oncology rival, same immuno-oncology market"),
        ("NVS",  "European big pharma, same pipeline bets"),
    ],
    "MSFT": [
        ("GOOGL", "Cloud and AI platform, same capex cycle"),
        ("AMZN",  "Hyperscale cloud rival to Azure"),
        ("ORCL",  "Database and AI cloud, same capex cycle"),
        ("CRM",   "Enterprise SaaS, same seat"),
        ("SAP",   "Enterprise applications, same CIO budget"),
        ("NOW",   "Workflow SaaS, same enterprise seat"),
        ("META",  "AI platform and capex, same scale"),
    ],
    "NKE": [
        ("ADS.DE", "Athletic footwear duopoly partner"),
        ("PUM.DE", "Athletic footwear and apparel, same shelf"),
        ("LULU",   "Premium athletic apparel, same consumer"),
        ("DECK",   "Footwear brands (Hoka, UGG), same running shelf"),
        ("ONON",   "Running footwear challenger, same shelf"),
        ("SKX",    "Footwear, same wholesale channel"),
        ("UAA",    "Athletic apparel, same wholesale channel"),
    ],
    "NVDA": [
        ("AMD",  "Data-centre GPUs and CPUs, same buyers"),
        ("AVGO", "Custom accelerators and networking, same racks"),
        ("MRVL", "Custom AI silicon, same hyperscalers"),
        ("ARM",  "Compute IP licensed to the same devices"),
        ("INTC", "CPUs and foundry, same data-centre socket"),
        ("TSM",  "Builds every NVIDIA chip, same cycle"),
        ("QCOM", "Fabless chip maker, same TSMC capacity"),
    ],
    "PG": [
        ("CL",   "Oral and home care, same shelf"),
        ("KMB",  "Tissue and diapers, same shelf"),
        ("CHD",  "Household and personal care, same shelf"),
        ("CLX",  "Household cleaning, same shelf"),
        ("UL",   "Global personal and home care"),
        ("KVUE", "Consumer health and skin care, same shelf"),
        ("EL",   "Prestige beauty, same personal-care wallet"),
    ],
    "SHW": [
        ("PPG",     "Paint and coatings, same raw materials"),
        ("RPM",     "Coatings and sealants, same contractor"),
        ("AXTA",    "Industrial and refinish coatings"),
        ("AKZA.AS", "Decorative paint, same raw materials"),
        ("4612.T",  "Decorative paint, same raw materials"),
        ("FUL",     "Adhesives, same construction and industrial cycle"),
        ("MAS",     "Paint (Behr) and building products, same housing"),
    ],
    "TRV": [
        ("CB",   "Commercial P&C, same pricing cycle"),
        ("ALL",  "Personal lines P&C, same catastrophe exposure"),
        ("PGR",  "Personal auto, same pricing cycle"),
        ("HIG",  "Commercial and personal P&C, same mix"),
        ("CINF", "Agency-distributed P&C, same mix"),
        ("WRB",  "Specialty commercial P&C, same cycle"),
        ("AIG",  "Commercial P&C, same pricing cycle"),
    ],
    "UNH": [
        ("ELV", "Managed care and services, same model"),
        ("CI",  "Managed care plus PBM (Evernorth)"),
        ("HUM", "Medicare Advantage, same rate cycle"),
        ("CVS", "Managed care (Aetna) plus PBM"),
        ("CNC", "Medicaid and exchange insurer, same utilisation"),
        ("MOH", "Medicaid managed care, same utilisation"),
    ],
    "V": [
        ("MA",       "Card network duopoly partner"),
        ("AXP",      "Card network and issuer, same spend"),
        ("PYPL",     "Digital checkout, same transaction volume"),
        ("FI",       "Merchant acquiring and bank processing"),
        ("FIS",      "Bank payment processing, same volumes"),
        ("GPN",      "Merchant acquiring, same card volumes"),
        ("ADYEN.AS", "Merchant acquiring, same card volumes"),
    ],
    "GOOGL": [
        ("META", "Digital advertising duopoly partner, AI capex"),
        ("AMZN", "Cloud plus advertising, same hyperscale capex"),
        ("MSFT", "Cloud and AI platform, same capex cycle"),
        ("AAPL", "Consumer platform, search default partner"),
        ("ORCL", "AI cloud landlord, same capex cycle"),
        ("TTD",  "Ad-tech pure play, same ad budgets"),
        ("PINS", "Ad-supported consumer platform, same budgets"),
    ],
    "WMT": [
        ("COST", "Membership warehouse, same grocery basket"),
        ("TGT",  "General merchandise, same shopper"),
        ("KR",   "Largest pure grocer, same basket"),
        ("DG",   "Discount retail, same low-income shopper"),
        ("DLTR", "Discount retail, same low-income shopper"),
        ("AMZN", "Marketplace and ads rival, same shopper"),
        ("BJ",   "Membership warehouse, same basket"),
    ],
}

# Foreign listings: trading currency and the FX pair used to state market cap and EV in USD.
FOREIGN = {
    "005930.KS": ("KRW", "USDKRW", "Samsung Electronics"),
    "1810.HK":   ("HKD", "USDHKD", "Xiaomi"),
    "AIR.PA":    ("EUR", "EURUSD", "Airbus"),
    "6301.T":    ("JPY", "USDJPY", "Komatsu"),
    "SIE.DE":    ("EUR", "EURUSD", "Siemens"),
    "NESN.SW":   ("CHF", "USDCHF", "Nestle"),
    "ADS.DE":    ("EUR", "EURUSD", "adidas"),
    "PUM.DE":    ("EUR", "EURUSD", "Puma"),
    "AKZA.AS":   ("EUR", "EURUSD", "AkzoNobel"),
    "4612.T":    ("JPY", "USDJPY", "Nippon Paint"),
    "ADYEN.AS":  ("EUR", "EURUSD", "Adyen"),
}
# FX pairs fetched: the trading currencies above plus the reporting currencies of the US-listed ADRs
# (SAP, NOK, UL report EUR; NVS, ONON CHF; DEO GBP; SONY JPY; ERIC SEK; BABA and Xiaomi CNY; Embraer BRL; TSMC TWD).
FX_PAIRS = ["USDKRW", "USDHKD", "EURUSD", "USDJPY", "USDCHF", "GBPUSD", "USDSEK", "USDCNY", "USDBRL", "USDTWD"]

# Balance-sheet businesses (banks, brokers, insurers, card lenders): EV, EV/sales, EV/EBITDA and net debt/EBITDA
# mean nothing; they are priced on forward P/E, PEG and price/book. Networks and processors (V, MA, PYPL, FI...) are not.
FINANCIAL = {"GS", "JPM", "AXP", "TRV", "MS", "C", "BAC", "WFC", "USB", "HSBC", "UBS", "EVR", "LAZ", "COF", "SYF",
             "CB", "ALL", "PGR", "HIG", "CINF", "WRB", "AIG"}

DOW_ORDER = list(DOW_BUSINESS.keys())

def all_tickers():
    s = set(DOW_ORDER)
    for t, ps in PEERS.items():
        for p, _ in ps:
            s.add(p)
    return sorted(s)

if __name__ == "__main__":
    import json, sys
    assert len(DOW_ORDER) == 30, len(DOW_ORDER)
    out = {"dow": DOW_ORDER, "list_taken": "2026-10-20", "list_source": "lane's own list (FMP index-constituent route not on the proxy allow-list); constituents since 8 Nov 2024",
           "changes_2026": "GOOGL in for VZ before the open 29 Jun 2026; HON stays after the HONA spin (S&P DJI announcement 23 Jun 2026)",
           "business": DOW_BUSINESS, "peers": {k: [{"peer": p, "why": w} for p, w in v] for k, v in PEERS.items()},
           "foreign": {k: {"ccy": a, "fx": b, "name": c} for k, (a, b, c) in FOREIGN.items()}, "fx_pairs": FX_PAIRS,
           "financial": sorted(FINANCIAL), "all": all_tickers()}
    for k, v in PEERS.items():
        assert 5 <= len(v) <= 8, (k, len(v))
        for p, w in v:
            n = len(w.split()); assert 4 <= n <= 8, (k, p, w, n)
    json.dump(out, sys.stdout, indent=1)
    print("\n#", len(out["all"]), "distinct tickers", file=sys.stderr)
