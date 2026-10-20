"""CW3 · the peer sets, chosen by business (not by tag). One entry per RADAR name.
Each peer carries a 4–8 word reason: what it shares (product, customer, cycle).
Names off the Hub's universe (the tickers table, 613 names on 19 Oct) are still used when
they are the true peer; the builder marks them and the FX date for foreign listings.
"""

RADAR_BUSINESS = {
    "MU":   "DRAM and NAND memory maker; HBM for AI accelerators",
    "NBIS": "AI neocloud: GPU capacity rented by the hour, built on own data centres",
    "GOOGL":"Search and YouTube advertising, Google Cloud, Android; Gemini models",
    "AMZN": "E-commerce and logistics, AWS cloud, advertising",
    "IREN": "Bitcoin miner turning its power sites into GPU cloud capacity",
    "AVGO": "Custom AI accelerators and networking silicon; VMware infrastructure software",
    "BE":   "Solid-oxide fuel cells for on-site power, sold into data centres",
    "VST":  "Merchant power generator (nuclear, gas, coal) selling into Texas and PJM",
    "NVDA": "AI accelerators, networking and systems; the data-centre GPU standard",
    "CRDO": "Active electrical cables and SerDes for AI racks",
    "CBRS": "Wafer-scale AI chip and inference cloud; listed 2025",
    "WMT":  "Largest grocer and discounter; growing marketplace and ads",
    "WDC":  "Hard-disk drives for hyperscale storage (NAND spun out as Sandisk)",
    "SNDK": "NAND flash maker spun out of Western Digital in 2025",
    "ORCL": "Database and applications; now a large AI-cloud landlord on borrowed money",
    "NFLX": "Subscription streaming with an advertising tier",
    "CAT":  "Construction and mining machines; engines and gensets for data centres",
    "AAOI": "Optical transceivers for data-centre and cable networks",
    "TSM":  "The leading-edge contract chip foundry",
    "APLD": "Data-centre developer leasing AI capacity to CoreWeave",
    "SHOP": "Commerce platform for merchants; take-rate on payments",
    "QCOM": "Handset modems and application processors; licensing; autos and PCs",
    "AXTI": "Compound-semiconductor substrates (InP, GaAs, Ge) for lasers and RF",
}

# ticker -> list of (peer, reason)
PEERS = {
    "MU": [
        ("000660.KS", "DRAM and HBM, same memory cycle"),
        ("005930.KS", "Largest DRAM and NAND maker"),
        ("285A.T",    "NAND pure play, same flash cycle"),
        ("SNDK",      "NAND flash, Micron's other half"),
        ("2408.TW",   "Commodity DRAM pure play"),
        ("WDC",       "Hyperscale storage, same data-centre demand"),
        ("STX",       "Hyperscale storage, same data-centre demand"),
    ],
    "NBIS": [
        ("CRWV", "GPU neocloud, same customers and GPUs"),
        ("IREN", "Power sites converting to GPU cloud"),
        ("APLD", "AI data-centre landlord, leased capacity"),
        ("CIFR", "Miner turning sites into AI hosting"),
        ("WULF", "Miner turning sites into AI hosting"),
        ("CORZ", "AI hosting on former mining sites"),
        ("DOCN", "Small-cloud with GPU rental line"),
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
    "AMZN": [
        ("WMT",  "Mass retail and marketplace, same shopper"),
        ("COST", "Membership retail, same grocery basket"),
        ("TGT",  "General merchandise retail, same shopper"),
        ("MSFT", "Hyperscale cloud rival to AWS"),
        ("GOOGL","Hyperscale cloud and ads rival"),
        ("BABA", "E-commerce plus cloud, China mirror"),
        ("MELI", "E-commerce plus logistics, Latin America"),
    ],
    "IREN": [
        ("APLD", "Power-site AI hosting, same customers"),
        ("WULF", "Miner converting to AI hosting"),
        ("CIFR", "Miner converting to AI hosting"),
        ("HUT",  "Miner with AI hosting line"),
        ("CORZ", "Former miner, AI hosting leases"),
        ("RIOT", "Bitcoin miner, same hash-price cycle"),
        ("MARA", "Bitcoin miner, same hash-price cycle"),
        ("NBIS", "GPU neocloud, the business IREN wants"),
    ],
    "AVGO": [
        ("NVDA", "AI accelerators and networking, same customers"),
        ("MRVL", "Custom AI silicon and optics, same hyperscalers"),
        ("AMD",  "Data-centre accelerators and CPUs"),
        ("QCOM", "Diversified fabless chip, licensing-heavy"),
        ("ARM",  "Licensed compute IP, same device cycle"),
        ("TXN",  "Diversified analog, same industrial cycle"),
        ("ALAB", "AI connectivity silicon, same racks"),
    ],
    "BE": [
        ("GEV",  "Gas turbines for data-centre power"),
        ("CMI",  "Engines and gensets, backup power"),
        ("CAT",  "Gensets and turbines, same data-centre buyers"),
        ("VRT",  "Data-centre power and cooling gear"),
        ("PLUG", "Fuel-cell maker, same hydrogen tech"),
        ("FCEL", "Fuel-cell maker, same stationary power"),
        ("FLNC", "Grid storage, same behind-the-meter buyers"),
    ],
    "VST": [
        ("CEG", "Nuclear fleet selling power to hyperscalers"),
        ("NRG", "Texas merchant generator and retailer"),
        ("TLN", "PJM nuclear and gas merchant generator"),
        ("NEE", "Largest renewables developer, regulated utility"),
        ("PEG", "PJM nuclear plus regulated wires"),
        ("AES", "Renewables for data centres, merchant exposure"),
        ("D",   "Data-centre load growth, regulated utility"),
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
    "CRDO": [
        ("MRVL", "SerDes and interconnect, same hyperscalers"),
        ("ALAB", "Rack connectivity silicon, same AI servers"),
        ("AVGO", "SerDes leader, same switch and rack"),
        ("MTSI", "High-speed analog for optical links"),
        ("LITE", "Optical components for the same links"),
        ("COHR", "Transceivers and lasers, same data-centre links"),
        ("AAOI", "Transceivers, same hyperscale customers"),
    ],
    "CBRS": [
        ("NVDA", "AI accelerators, the incumbent it fights"),
        ("AMD",  "AI accelerators, same inference customers"),
        ("AVGO", "Custom AI silicon, same hyperscalers"),
        ("MRVL", "Custom AI silicon, same hyperscalers"),
        ("ARM",  "Compute IP, same AI device cycle"),
        ("INTC", "AI chips and foundry, same socket"),
        ("CRWV", "Inference cloud, same rented-compute buyers"),
    ],
    "WMT": [
        ("COST", "Membership warehouse, same grocery basket"),
        ("TGT",  "Discount general merchandise, same shopper"),
        ("AMZN", "Marketplace and grocery rival"),
        ("KR",   "Grocery, same food inflation cycle"),
        ("DG",   "Rural discount, same low-income shopper"),
        ("BJ",   "Membership warehouse, same basket"),
        ("DLTR", "Discount variety, same low-income shopper"),
    ],
    "WDC": [
        ("STX",   "Hard disks, the other half of the duopoly"),
        ("SNDK",  "The NAND half Western Digital spun out"),
        ("MU",    "Memory, same hyperscale storage demand"),
        ("NTAP",  "Storage systems, same enterprise buyers"),
        ("PSTG",  "Flash storage systems, same buyers"),
        ("285A.T","NAND maker, same storage cycle"),
    ],
    "SNDK": [
        ("MU",        "NAND and DRAM, same flash cycle"),
        ("285A.T",    "NAND pure play and JV partner"),
        ("000660.KS", "NAND and DRAM, same memory cycle"),
        ("005930.KS", "Largest NAND maker, same flash cycle"),
        ("WDC",       "Former parent, hard disks"),
        ("STX",       "Hard disks, same storage demand"),
        ("SIMO",      "NAND controllers, same flash volumes"),
    ],
    "ORCL": [
        ("MSFT", "Cloud, database and applications"),
        ("SAP",  "Enterprise applications, same ERP buyers"),
        ("CRM",  "Enterprise applications, same CIO budget"),
        ("NOW",  "Enterprise workflow, same CIO budget"),
        ("IBM",  "Legacy software plus hybrid cloud"),
        ("GOOGL","Hyperscale cloud, same AI capex"),
        ("AMZN", "Hyperscale cloud leader, same AI capex"),
        ("CRWV", "Leveraged AI-cloud landlord, same tenants"),
    ],
    "NFLX": [
        ("DIS",   "Streaming plus studios, same subscriber"),
        ("WBD",   "Streaming plus studios, same content cycle"),
        ("SPOT",  "Subscription media, same household wallet"),
        ("ROKU",  "Streaming platform and ads"),
        ("CMCSA", "Peacock plus cable, same household"),
        ("PSKY",  "Paramount+ plus studios, same content cycle"),
    ],
    "CAT": [
        ("DE",     "Heavy equipment, same dealer and finance model"),
        ("CMI",    "Engines and gensets, same data-centre power"),
        ("PCAR",   "Heavy trucks, same industrial cycle"),
        ("6301.T", "Mining and construction machines, global rival"),
        ("TEX",    "Construction equipment, same cycle"),
        ("OSK",    "Specialty vehicles and access equipment"),
        ("AGCO",   "Farm machinery, same dealer cycle"),
    ],
    "AAOI": [
        ("LITE",      "Optical transceivers and lasers, same hyperscalers"),
        ("COHR",      "Optical transceivers, same hyperscalers"),
        ("FN",        "Optical module manufacturing, same customers"),
        ("CRDO",      "Rack interconnect, same AI clusters"),
        ("300308.SZ", "Transceiver leader, same 800G cycle"),
        ("300502.SZ", "Transceiver maker, same 800G cycle"),
        ("MTSI",      "Analog chips inside the modules"),
    ],
    "TSM": [
        ("GFS",       "Contract foundry, trailing nodes"),
        ("UMC",       "Contract foundry, mature nodes"),
        ("INTC",      "Would-be leading-edge foundry rival"),
        ("0981.HK",   "China's largest foundry, mature nodes"),
        ("005930.KS", "Only other leading-edge foundry"),
        ("TSEM",      "Specialty foundry, same fab economics"),
    ],
    "APLD": [
        ("IREN", "Power-site AI hosting, same leases"),
        ("WULF", "Miner turning sites into AI hosting"),
        ("CIFR", "Miner turning sites into AI hosting"),
        ("NBIS", "GPU neocloud, its tenant's business"),
        ("CRWV", "Its anchor tenant, same demand"),
        ("HUT",  "Miner with AI hosting line"),
        ("CORZ", "AI hosting leases to CoreWeave"),
        ("DLR",  "Data-centre landlord, lease economics"),
    ],
    "SHOP": [
        ("XYZ",  "Merchant payments and software, same take-rate"),
        ("TOST", "Vertical merchant platform, payments take-rate"),
        ("WIX",  "Website and commerce tools for small business"),
        ("GDDY", "Small-business web platform, same merchant"),
        ("PYPL", "Online checkout, same transaction volume"),
        ("HUBS", "Small-business software, same subscriber"),
        ("MELI", "Marketplace plus payments, same merchant"),
    ],
    "QCOM": [
        ("2454.TW", "Handset chip rival, same phone cycle"),
        ("AVGO",    "Fabless RF and networking, same handsets"),
        ("MRVL",    "Fabless connectivity silicon, same handsets"),
        ("ARM",     "Compute IP in every Qualcomm chip"),
        ("AMD",     "Fabless CPUs, PC rival"),
        ("SWKS",    "RF front-end, same handset volumes"),
        ("QRVO",    "RF front-end, same handset volumes"),
        ("TXN",     "Diversified chips, autos and industrial"),
    ],
    "AXTI": [
        ("IQE.L",  "Compound-semi epiwafers, same customers"),
        ("SOI.PA", "Engineered substrates, same wafer economics"),
        ("WOLF",   "Compound-semi substrates (silicon carbide)"),
        ("MTSI",   "InP chips built on these wafers"),
        ("COHR",   "InP lasers, substrate customer"),
        ("LITE",   "InP lasers, substrate customer"),
    ],
}

# Foreign listings: trading currency and the FX pair used to state market cap and EV in USD.
FOREIGN = {
    "000660.KS": ("KRW", "USDKRW", "SK hynix"),
    "005930.KS": ("KRW", "USDKRW", "Samsung Electronics"),
    "285A.T":    ("JPY", "USDJPY", "Kioxia"),
    "2408.TW":   ("TWD", "USDTWD", "Nanya Technology"),
    "2454.TW":   ("TWD", "USDTWD", "MediaTek"),
    "0981.HK":   ("HKD", "USDHKD", "SMIC"),
    "6301.T":    ("JPY", "USDJPY", "Komatsu"),
    "300308.SZ": ("CNY", "USDCNY", "Zhongji Innolight"),
    "300502.SZ": ("CNY", "USDCNY", "Eoptolink"),
    "IQE.L":     ("GBP", "GBPUSD", "IQE"),
    "SOI.PA":    ("EUR", "EURUSD", "Soitec"),
}

RADAR_ORDER = list(RADAR_BUSINESS.keys())

def all_tickers():
    s = set(RADAR_ORDER)
    for t, ps in PEERS.items():
        for p, _ in ps:
            s.add(p)
    return sorted(s)

if __name__ == "__main__":
    import json, sys
    out = {"radar": RADAR_ORDER, "business": RADAR_BUSINESS, "peers": {k: [{"peer": p, "why": w} for p, w in v] for k, v in PEERS.items()}, "foreign": {k: {"ccy": a, "fx": b, "name": c} for k, (a, b, c) in FOREIGN.items()}, "all": all_tickers()}
    for k, v in PEERS.items():
        assert 5 <= len(v) <= 8, (k, len(v))
        for p, w in v:
            n = len(w.split()); assert 4 <= n <= 8, (k, p, w, n)
    json.dump(out, sys.stdout, indent=1)
    print("\n#", len(out["all"]), "distinct tickers", file=sys.stderr)
