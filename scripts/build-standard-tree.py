#!/usr/bin/env python3
"""M54 · build the STANDARD tree: main indexes -> GICS sectors (SPDR anchors) -> industry groups
-> industries -> names. Nothing is written to any table; one JSON comes out.

Inputs, every one named in the output's provenance block:
  · chart API /universe, /geiger, /quotes        — the 364 served names, their Geiger and their day
  · PostgREST company_profile                    — FMP sector, industry, market cap, is_etf
  · PostgREST provider_indicators_current        — FMP daily RSI(14), SMA(50), SMA(200), Williams(14)
  · data/reference/spy-holdings.json             — State Street's own SPY file: S&P 500 weights
  · data/reference/dia-holdings.json             — State Street's own DIA file: the Dow 30
  · data/reference/sp500-gics.json               — Wikipedia's component table: GICS sector per member

The public anon key is read out of index.html exactly as the browser page does; it is never printed.
Output: data/standard-tree-20260924.json
"""
import json, os, re, sys, urllib.request, urllib.error, datetime, statistics, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://scintilla-massive-chart-api.fly.dev"

# ---------------------------------------------------------------- GICS skeleton
# FMP's sector names are not GICS names. This is the standard translation, stated once.
SECTOR_GICS = {
    "Technology": "Information Technology", "Financial Services": "Financials",
    "Healthcare": "Health Care", "Consumer Cyclical": "Consumer Discretionary",
    "Consumer Defensive": "Consumer Staples", "Basic Materials": "Materials",
    "Industrials": "Industrials", "Energy": "Energy", "Utilities": "Utilities",
    "Real Estate": "Real Estate", "Communication Services": "Communication Services",
}
SECTOR_ETF = {
    "Information Technology": "XLK", "Financials": "XLF", "Health Care": "XLV",
    "Consumer Discretionary": "XLY", "Consumer Staples": "XLP", "Materials": "XLB",
    "Industrials": "XLI", "Energy": "XLE", "Utilities": "XLU", "Real Estate": "XLRE",
    "Communication Services": "XLC",
}
SECTOR_ORDER = ["Information Technology", "Financials", "Health Care", "Consumer Discretionary",
                "Communication Services", "Industrials", "Consumer Staples", "Energy",
                "Utilities", "Real Estate", "Materials"]

# FMP industry -> (GICS sector, GICS industry group, GICS industry).
# Where the third element's sector differs from FMP's sector, the name moves branch and the move
# is listed in the output under "moved_by_gics" so nothing changes silently.
IND = {
 "Entertainment": ("Communication Services", "Media & Entertainment", "Entertainment"),
 "Advertising Agencies": ("Communication Services", "Media & Entertainment", "Media"),
 "Internet Content & Information": ("Communication Services", "Media & Entertainment", "Interactive Media & Services"),
 "Telecommunications Services": ("Communication Services", "Telecommunication Services", "Diversified Telecommunication Services"),
 "Electronic Gaming & Multimedia": ("Communication Services", "Media & Entertainment", "Entertainment"),
 "Apparel - Footwear & Accessories": ("Consumer Discretionary", "Consumer Durables & Apparel", "Textiles, Apparel & Luxury Goods"),
 "Apparel - Retail": ("Consumer Discretionary", "Consumer Discretionary Distribution & Retail", "Specialty Retail"),
 "Auto - Manufacturers": ("Consumer Discretionary", "Automobiles & Components", "Automobiles"),
 "Auto - Parts": ("Consumer Discretionary", "Automobiles & Components", "Automobile Components"),
 "Gambling, Resorts & Casinos": ("Consumer Discretionary", "Consumer Services", "Hotels, Restaurants & Leisure"),
 "Home Improvement": ("Consumer Discretionary", "Consumer Discretionary Distribution & Retail", "Specialty Retail"),
 "Restaurants": ("Consumer Discretionary", "Consumer Services", "Hotels, Restaurants & Leisure"),
 "Specialty Retail": ("Consumer Discretionary", "Consumer Discretionary Distribution & Retail", "Specialty Retail"),
 "Travel Lodging": ("Consumer Discretionary", "Consumer Services", "Hotels, Restaurants & Leisure"),
 "Travel Services": ("Consumer Discretionary", "Consumer Services", "Hotels, Restaurants & Leisure"),
 "Packaging & Containers": ("Materials", "Materials", "Containers & Packaging"),
 "Agricultural Farm Products": ("Consumer Staples", "Food, Beverage & Tobacco", "Food Products"),
 "Beverages - Non-Alcoholic": ("Consumer Staples", "Food, Beverage & Tobacco", "Beverages"),
 "Discount Stores": ("Consumer Staples", "Consumer Staples Distribution & Retail", "Consumer Staples Distribution & Retail"),
 "Food Confectioners": ("Consumer Staples", "Food, Beverage & Tobacco", "Food Products"),
 "Food Distribution": ("Consumer Staples", "Consumer Staples Distribution & Retail", "Consumer Staples Distribution & Retail"),
 "Grocery Stores": ("Consumer Staples", "Consumer Staples Distribution & Retail", "Consumer Staples Distribution & Retail"),
 "Household & Personal Products": ("Consumer Staples", "Household & Personal Products", "Household Products"),
 "Packaged Foods": ("Consumer Staples", "Food, Beverage & Tobacco", "Food Products"),
 "Tobacco": ("Consumer Staples", "Food, Beverage & Tobacco", "Tobacco"),
 "Oil & Gas Equipment & Services": ("Energy", "Energy", "Energy Equipment & Services"),
 "Oil & Gas Exploration & Production": ("Energy", "Energy", "Oil, Gas & Consumable Fuels"),
 "Oil & Gas Integrated": ("Energy", "Energy", "Oil, Gas & Consumable Fuels"),
 "Oil & Gas Midstream": ("Energy", "Energy", "Oil, Gas & Consumable Fuels"),
 "Oil & Gas Refining & Marketing": ("Energy", "Energy", "Oil, Gas & Consumable Fuels"),
 "Uranium": ("Energy", "Energy", "Oil, Gas & Consumable Fuels"),
 "Solar": ("Information Technology", "Semiconductors & Semiconductor Equipment", "Semiconductors & Semiconductor Equipment"),
 "Asset Management": ("Financials", "Financial Services", "Capital Markets"),
 "Banks - Diversified": ("Financials", "Banks", "Banks"),
 "Banks - Regional": ("Financials", "Banks", "Banks"),
 "Financial - Capital Markets": ("Financials", "Financial Services", "Capital Markets"),
 "Financial - Credit Services": ("Financials", "Financial Services", "Financial Services"),
 "Financial - Data & Stock Exchanges": ("Financials", "Financial Services", "Capital Markets"),
 "Insurance - Brokers": ("Financials", "Insurance", "Insurance"),
 "Insurance - Diversified": ("Financials", "Insurance", "Insurance"),
 "Insurance - Property & Casualty": ("Financials", "Insurance", "Insurance"),
 "Investment - Banking & Investment Services": ("Financials", "Financial Services", "Capital Markets"),
 "Biotechnology": ("Health Care", "Pharmaceuticals, Biotechnology & Life Sciences", "Biotechnology"),
 "Drug Manufacturers - General": ("Health Care", "Pharmaceuticals, Biotechnology & Life Sciences", "Pharmaceuticals"),
 "Medical - Care Facilities": ("Health Care", "Health Care Equipment & Services", "Health Care Providers & Services"),
 "Medical - Devices": ("Health Care", "Health Care Equipment & Services", "Health Care Equipment & Supplies"),
 "Medical - Diagnostics & Research": ("Health Care", "Pharmaceuticals, Biotechnology & Life Sciences", "Life Sciences Tools & Services"),
 "Medical - Distribution": ("Health Care", "Health Care Equipment & Services", "Health Care Providers & Services"),
 "Medical - Healthcare Plans": ("Health Care", "Health Care Equipment & Services", "Health Care Providers & Services"),
 "Medical - Instruments & Supplies": ("Health Care", "Health Care Equipment & Services", "Health Care Equipment & Supplies"),
 "Aerospace & Defense": ("Industrials", "Capital Goods", "Aerospace & Defense"),
 "Agricultural - Machinery": ("Industrials", "Capital Goods", "Machinery"),
 "Airlines, Airports & Air Services": ("Industrials", "Transportation", "Passenger Airlines"),
 "Conglomerates": ("Industrials", "Capital Goods", "Industrial Conglomerates"),
 "Electrical Equipment & Parts": ("Industrials", "Capital Goods", "Electrical Equipment"),
 "Engineering & Construction": ("Industrials", "Capital Goods", "Construction & Engineering"),
 "Industrial - Distribution": ("Industrials", "Capital Goods", "Trading Companies & Distributors"),
 "Industrial - Machinery": ("Industrials", "Capital Goods", "Machinery"),
 "Integrated Freight & Logistics": ("Industrials", "Transportation", "Air Freight & Logistics"),
 "Railroads": ("Industrials", "Transportation", "Ground Transportation"),
 "Rental & Leasing Services": ("Industrials", "Capital Goods", "Trading Companies & Distributors"),
 "Specialty Business Services": ("Industrials", "Commercial & Professional Services", "Commercial Services & Supplies"),
 "Waste Management": ("Industrials", "Commercial & Professional Services", "Commercial Services & Supplies"),
 "REIT - Diversified": ("Real Estate", "Equity Real Estate Investment Trusts", "Diversified REITs"),
 "REIT - Healthcare Facilities": ("Real Estate", "Equity Real Estate Investment Trusts", "Health Care REITs"),
 "REIT - Industrial": ("Real Estate", "Equity Real Estate Investment Trusts", "Industrial REITs"),
 "REIT - Retail": ("Real Estate", "Equity Real Estate Investment Trusts", "Retail REITs"),
 "REIT - Specialty": ("Real Estate", "Equity Real Estate Investment Trusts", "Specialized REITs"),
 "Real Estate - Services": ("Real Estate", "Real Estate Management & Development", "Real Estate Management & Development"),
 "Communication Equipment": ("Information Technology", "Technology Hardware & Equipment", "Communications Equipment"),
 "Computer Hardware": ("Information Technology", "Technology Hardware & Equipment", "Technology Hardware, Storage & Peripherals"),
 "Consumer Electronics": ("Information Technology", "Technology Hardware & Equipment", "Technology Hardware, Storage & Peripherals"),
 "Hardware, Equipment & Parts": ("Information Technology", "Technology Hardware & Equipment", "Electronic Equipment, Instruments & Components"),
 "Information Technology Services": ("Information Technology", "Software & Services", "IT Services"),
 "Semiconductors": ("Information Technology", "Semiconductors & Semiconductor Equipment", "Semiconductors & Semiconductor Equipment"),
 "Software - Application": ("Information Technology", "Software & Services", "Software"),
 "Software - Infrastructure": ("Information Technology", "Software & Services", "Software"),
 "Diversified Utilities": ("Utilities", "Utilities", "Multi-Utilities"),
 "Independent Power Producers": ("Utilities", "Utilities", "Independent Power and Renewable Electricity Producers"),
 "Regulated Electric": ("Utilities", "Utilities", "Electric Utilities"),
 "Regulated Gas": ("Utilities", "Utilities", "Gas Utilities"),
 "Agricultural Inputs": ("Materials", "Materials", "Chemicals"),
 "Chemicals": ("Materials", "Materials", "Chemicals"),
 "Chemicals - Specialty": ("Materials", "Materials", "Chemicals"),
 "Construction Materials": ("Materials", "Materials", "Construction Materials"),
 "Copper": ("Materials", "Materials", "Metals & Mining"),
 "Gold": ("Materials", "Materials", "Metals & Mining"),
 "Industrial Materials": ("Materials", "Materials", "Metals & Mining"),
 "Other Precious Metals": ("Materials", "Materials", "Metals & Mining"),
 "Steel": ("Materials", "Materials", "Metals & Mining"),
}

# The standard lines traders use. Every one is a default a person can change on the page.
THRESHOLDS = [
 {"key": "rsi_oversold", "label": "RSI(14) at or below", "value": 30, "unit": "", "scope": "name",
  "means": "the daily Relative Strength Index, the line most desks call oversold"},
 {"key": "rsi_overbought", "label": "RSI(14) at or above", "value": 70, "unit": "", "scope": "name",
  "means": "the same line on the other side, called overbought"},
 {"key": "above_200dma", "label": "distance from the 200-day, in %", "value": 0, "unit": "%", "scope": "name",
  "means": "0 means the average itself; raise it to ask for names clearly above their long trend line"},
 {"key": "above_50dma", "label": "distance from the 50-day, in %", "value": 0, "unit": "%", "scope": "name",
  "means": "the same dial on the medium trend line"},
 {"key": "breadth_strong", "label": "branch breadth at or above", "value": 80, "unit": "%", "scope": "branch",
  "means": "share of the branch's names above their own 200-day average; 80% is the usual strong reading"},
 {"key": "breadth_weak", "label": "branch breadth at or below", "value": 20, "unit": "%", "scope": "branch",
  "means": "the same measure at the weak end"},
 {"key": "williams_oversold", "label": "Williams %R at or below", "value": -80, "unit": "", "scope": "name",
  "means": "a second oversold line, on a scale that runs 0 to -100"},
 {"key": "golden_cross", "label": "50-day over 200-day (no dial)", "value": 0, "unit": "", "scope": "name",
  "means": "the crossing traders call golden (above) or death (below); it is a state, not a number to set"},
]


def creds():
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="ignore").read()
    return (re.search(r'const SB\s*=\s*"([^"]+)"', s).group(1),
            re.search(r'"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]+)"', s).group(1))


def main(cache):
    SB, AN = creds()
    H = {"apikey": AN, "Authorization": "Bearer " + AN}

    def get(url, headers=None, timeout=90):
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers or {}), timeout=timeout) as r:
            return json.load(r)

    def pg(path):
        return get("%s/rest/v1/%s" % (SB, path), H)

    def load(name, fetch):
        p = os.path.join(cache, name) if cache else None
        if p and os.path.exists(p):
            return json.load(open(p))
        v = fetch()
        if p:
            os.makedirs(cache, exist_ok=True)
            json.dump(v, open(p, "w"))
        return v

    uni = load("universe.json", lambda: get(API + "/universe"))
    syms = uni["symbols"]

    def geiger():
        out, meta = {}, {}
        for i in range(0, len(syms), 60):
            j = get(API + "/geiger?symbols=" + ",".join(syms[i:i + 60]) + "&detail=0")
            meta["computed_utc"] = j.get("computed_utc")
            for k, v in (j.get("symbols") or {}).items():
                out[k] = {"composite": v.get("composite"), "trend": v.get("trend"), "momentum": v.get("momentum")}
        out["__meta__"] = meta
        return out

    def quotes():
        out, meta = {}, {}
        for i in range(0, len(syms), 40):
            j = get(API + "/quotes?symbols=" + ",".join(syms[i:i + 40]))
            meta["generated_utc"] = j.get("generated_utc")
            for k, v in (j.get("quotes") or {}).items():
                p, pc = v.get("price"), v.get("previous_close")
                meta.setdefault("session_et", v.get("price_session_et"))
                out[k] = {"price": p, "prev": pc, "session": v.get("price_session_et"),
                          "chg_pct": round((p - pc) / pc * 100, 3) if p and pc else None}
        out["__meta__"] = meta
        return out

    def indicators():
        rows, off = [], 0
        while True:
            page = pg("provider_indicators_current?select=ticker,indicator,period_length,value,source_date,"
                      "session_state&provider=eq.FMP&timeframe=eq.1day&indicator=in.(rsi,sma,williams)"
                      "&order=ticker.asc,indicator.asc,period_length.asc&offset=%d&limit=1000" % off)
            rows += page
            if len(page) < 1000:
                return rows
            off += 1000

    gg = load("geiger.json", geiger)
    qq = load("quotes.json", quotes)
    prof = load("profiles.json", lambda: pg("company_profile?select=ticker,name,sector,industry,market_cap,"
                                            "is_etf,exchange&limit=2000"))
    ind_rows = load("indicators.json", indicators)
    ref = lambda n: json.load(open(os.path.join(ROOT, "data", "reference", n)))
    spy, dia, gics = ref("spy-holdings.json"), ref("dia-holdings.json"), ref("sp500-gics.json")

    served = set(syms)
    P = {r["ticker"]: r for r in prof if r["ticker"] in served}
    IX = {}
    for r in ind_rows:
        k = r["indicator"] if r["indicator"] != "sma" else "sma%d" % int(r["period_length"])
        if r["indicator"] == "rsi" and int(r["period_length"]) != 14:
            continue
        if r["indicator"] == "williams" and int(r["period_length"]) != 14:
            continue
        if r["indicator"] == "sma" and int(r["period_length"]) not in (50, 200):
            continue
        IX.setdefault(r["ticker"], {})[k if r["indicator"] != "rsi" else "rsi"] = r["value"]
        IX[r["ticker"]]["source_date"] = str(r["source_date"])[:10]
        IX[r["ticker"]]["session_state"] = r["session_state"]

    # ---------------------------------------------------------------- names
    names, moved, unmapped = {}, [], set()
    for t, p in sorted(P.items()):
        if p.get("is_etf"):
            continue
        fmp_ind = p.get("industry") or ""
        m = IND.get(fmp_ind)
        if not m:
            unmapped.add((p.get("sector"), fmp_ind))
            gs = SECTOR_GICS.get(p.get("sector"), "Unclassified")
            m = (gs, "Other " + gs, "Other " + gs)
        gsec, group, industry = m
        fmp_gsec = SECTOR_GICS.get(p.get("sector"))
        if fmp_gsec and fmp_gsec != gsec:
            moved.append({"ticker": t, "from_sector": fmp_gsec, "to_sector": gsec,
                          "fmp_industry": fmp_ind, "gics_industry": industry})
        g = gg.get(t) or {}
        q = qq.get(t) or {}
        ix = IX.get(t) or {}
        price = q.get("price")
        s50, s200 = ix.get("sma50"), ix.get("sma200")
        names[t] = {
            "ticker": t, "name": p.get("name"), "cap": p.get("market_cap"),
            "gics_sector": gsec, "gics_group": group, "gics_industry": industry,
            "fmp_sector": p.get("sector"), "fmp_industry": fmp_ind,
            "geiger": g.get("composite"), "trend": g.get("trend"), "momentum": g.get("momentum"),
            "price": price, "chg_pct": q.get("chg_pct"),
            "rsi": ix.get("rsi"), "williams": ix.get("williams"), "sma50": s50, "sma200": s200,
            "above50": (price > s50) if price and s50 else None,
            "above200": (price > s200) if price and s200 else None,
            "golden": (s50 > s200) if s50 and s200 else None,
            "indicator_date": ix.get("source_date"), "indicator_state": ix.get("session_state"),
            "sp500": t in spy["holdings"], "sp500_weight": (spy["holdings"].get(t) or {}).get("weight_pct"),
            "dow": t in dia["holdings"],
            "gics_sector_official": (gics["members"].get(t) or {}).get("gics_sector"),
            "gics_sub_official": (gics["members"].get(t) or {}).get("gics_sub_industry"),
        }

    etfs = {}
    for t, p in P.items():
        if not p.get("is_etf"):
            continue
        g, q = gg.get(t) or {}, qq.get(t) or {}
        etfs[t] = {"ticker": t, "name": p.get("name"), "geiger": g.get("composite"),
                   "trend": g.get("trend"), "momentum": g.get("momentum"), "chg_pct": q.get("chg_pct"),
                   "price": q.get("price")}

    # ---------------------------------------------------------------- the S&P 500 itself
    sp_sector_cap, sp_sector_n, sp_total_w, sp_total_n = {}, {}, 0.0, 0
    for t, h in spy["holdings"].items():
        sec = (gics["members"].get(t) or {}).get("gics_sector")
        if not sec:
            continue
        sp_sector_cap[sec] = sp_sector_cap.get(sec, 0.0) + h["weight_pct"]
        sp_sector_n[sec] = sp_sector_n.get(sec, 0) + 1
        sp_total_w += h["weight_pct"]
        sp_total_n += 1

    hub_cap_total = sum(n["cap"] or 0 for n in names.values())
    hub_n_total = len(names)

    def agg(members):
        ms = [names[t] for t in members]
        cap = sum(m["cap"] or 0 for m in ms)
        gv = [(m["geiger"], m["cap"] or 0) for m in ms if m["geiger"] is not None]
        cv = [(m["chg_pct"], m["cap"] or 0) for m in ms if m["chg_pct"] is not None]
        wmean = lambda pairs: (sum(v * w for v, w in pairs) / sum(w for _, w in pairs)) if pairs and sum(w for _, w in pairs) else None
        emean = lambda pairs: (sum(v for v, _ in pairs) / len(pairs)) if pairs else None
        a200 = [m["above200"] for m in ms if m["above200"] is not None]
        a50 = [m["above50"] for m in ms if m["above50"] is not None]
        rsi = [m["rsi"] for m in ms if m["rsi"] is not None]
        adv = [m["chg_pct"] for m in ms if m["chg_pct"] is not None]
        spw = sum(m["sp500_weight"] or 0 for m in ms if m["sp500"])
        r = lambda x, d=4: None if x is None else round(x, d)
        return {
            "n": len(ms), "cap_usd": cap,
            "geiger_cap": r(wmean(gv)), "geiger_eq": r(emean(gv)), "geiger_n": len(gv),
            "chg_cap_pct": r(wmean(cv), 3), "chg_eq_pct": r(emean(cv), 3),
            "advancers_pct": r(100 * sum(1 for c in adv if c > 0) / len(adv), 1) if adv else None,
            "above200_pct": r(100 * sum(1 for x in a200 if x) / len(a200), 1) if a200 else None,
            "above200_n": len(a200),
            "above50_pct": r(100 * sum(1 for x in a50 if x) / len(a50), 1) if a50 else None,
            "rsi_median": r(statistics.median(rsi), 1) if rsi else None,
            "hub_cap_share_pct": r(100 * cap / hub_cap_total, 2) if hub_cap_total else None,
            "hub_count_share_pct": r(100 * len(ms) / hub_n_total, 2) if hub_n_total else None,
            "sp500_members": sum(1 for m in ms if m["sp500"]),
            "sp500_weight_of_members_pct": r(spw, 3),
            "dow_members": sum(1 for m in ms if m["dow"]),
            "lists": {
                "oversold": sorted([m["ticker"] for m in ms if m["rsi"] is not None and m["rsi"] <= 30]),
                "overbought": sorted([m["ticker"] for m in ms if m["rsi"] is not None and m["rsi"] >= 70]),
                "below_200dma": sorted([m["ticker"] for m in ms if m["above200"] is False]),
                "golden_cross": sorted([m["ticker"] for m in ms if m["golden"]]),
                "williams_oversold": sorted([m["ticker"] for m in ms if m["williams"] is not None and m["williams"] <= -80]),
            },
        }

    nodes = {}

    def put(nid, label, level, parent, members, extra=None):
        nodes[nid] = dict({"id": nid, "label": label, "level": level, "parent": parent,
                           "members": sorted(members), "children": []}, **(agg(members)))
        if parent:
            nodes[parent]["children"].append(nid)
        if extra:
            nodes[nid].update(extra)

    all_t = list(names)
    put("MARKET", "The market Scintilla watches", "market", None, all_t,
        {"anchor_etf": "SPY", "anchor": etfs.get("SPY")})
    for sec in SECTOR_ORDER:
        mem = [t for t in all_t if names[t]["gics_sector"] == sec]
        etf = SECTOR_ETF[sec]
        sid = "SEC:" + sec
        put(sid, sec, "sector", "MARKET", mem, {
            "anchor_etf": etf, "anchor": etfs.get(etf),
            "sp500_sector_weight_pct": round(sp_sector_cap.get(sec, 0.0), 3),
            "sp500_sector_count": sp_sector_n.get(sec, 0),
            "sp500_sector_count_pct": round(100 * sp_sector_n.get(sec, 0) / sp_total_n, 2) if sp_total_n else None,
        })
        nodes[sid]["sp500_cover_of_sector_weight_pct"] = (
            round(100 * (nodes[sid]["sp500_weight_of_members_pct"] or 0) / sp_sector_cap[sec], 1)
            if sp_sector_cap.get(sec) else None)
        groups = sorted({names[t]["gics_group"] for t in mem})
        for grp in groups:
            gmem = [t for t in mem if names[t]["gics_group"] == grp]
            gid = "GRP:%s:%s" % (sec, grp)
            put(gid, grp, "group", sid, gmem)
            for industry in sorted({names[t]["gics_industry"] for t in gmem}):
                imem = [t for t in gmem if names[t]["gics_industry"] == industry]
                put("IND:%s:%s" % (sec, industry), industry, "industry", gid, imem)

    indexes = [
        {"id": "SPX", "label": "S&P 500", "anchor_etf": "SPY", "anchor": etfs.get("SPY"),
         "membership": "measured", "members_in_hub": sum(1 for n in names.values() if n["sp500"]),
         "hub_weight_of_index_pct": round(sum(n["sp500_weight"] or 0 for n in names.values() if n["sp500"]), 2),
         "index_members": spy["n"], "as_of": spy["as_of"], "source": "State Street's own SPY holdings file"},
        {"id": "NDX", "label": "Nasdaq-100", "anchor_etf": "QQQ", "anchor": etfs.get("QQQ"),
         "membership": "not obtained", "members_in_hub": None, "hub_weight_of_index_pct": None,
         "index_members": 100, "as_of": None,
         "source": "member list not obtained tonight; the branch reads its anchor ETF only"},
        {"id": "RUT", "label": "Russell 2000", "anchor_etf": "IWM", "anchor": etfs.get("IWM"),
         "membership": "not obtained", "members_in_hub": None, "hub_weight_of_index_pct": None,
         "index_members": 2000, "as_of": None,
         "source": "member list not obtained tonight; the branch reads its anchor ETF only"},
        {"id": "DJIA", "label": "Dow Jones Industrial Average", "anchor_etf": "DIA", "anchor": etfs.get("DIA"),
         "membership": "measured", "members_in_hub": sum(1 for n in names.values() if n["dow"]),
         "hub_weight_of_index_pct": round(sum((dia["holdings"].get(t) or {}).get("weight_pct", 0)
                                              for t, n in names.items() if n["dow"]), 2),
         "index_members": 30, "as_of": dia["as_of"], "source": "State Street's own DIA holdings file"},
    ]

    # Alan's own themes stay a lens across the trunk, never trunk branches (M45's rules file).
    themes = []
    try:
        rules = json.load(open(os.path.join(ROOT, "data", "taxonomy-rules-20260924.json")))
        for b in rules.get("branches", []):
            ts = sorted(t for t in (b.get("tickers") or []) if t in names)
            if ts:
                themes.append({"id": b["id"], "label": b.get("label") or b["id"], "tickers": ts,
                               "n_served": len(ts), "n_listed": len(b.get("tickers") or [])})
    except FileNotFoundError:
        pass

    comparison = []
    for sec in SECTOR_ORDER:
        sid = "SEC:" + sec
        nd = nodes[sid]
        comparison.append({
            "gics_sector": sec, "anchor_etf": SECTOR_ETF[sec],
            "hub_cap_share_pct": nd["hub_cap_share_pct"], "sp500_cap_share_pct": round(sp_sector_cap.get(sec, 0.0), 2),
            "hub_count_share_pct": nd["hub_count_share_pct"], "sp500_count_share_pct": nodes[sid]["sp500_sector_count_pct"],
            "hub_n": nd["n"], "sp500_n": nodes[sid]["sp500_sector_count"],
            "hub_names_in_sp500": nd["sp500_members"],
            "hub_share_of_sector_index_weight_pct": nd["sp500_cover_of_sector_weight_pct"],
        })

    out = {
        "built_utc": datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds"),
        "provenance": {
            "universe": {"count": uni["count"], "sha256": uni["universe_sha256"], "source": API + "/universe"},
            "geiger": {"computed_utc": gg.get("__meta__", {}).get("computed_utc"), "source": API + "/geiger"},
            "quotes": {"generated_utc": qq.get("__meta__", {}).get("generated_utc"),
                       "session_et": qq.get("__meta__", {}).get("session_et"), "source": API + "/quotes"},
            "profiles": {"source": "PostgREST company_profile (FMP sector, industry, market cap)",
                         "served_companies": len(names), "served_etfs": len(etfs)},
            "indicators": {"source": "PostgREST provider_indicators_current, provider FMP, timeframe 1day",
                           "rows": len(ind_rows),
                           "source_date": sorted({v.get("source_date") for v in IX.values() if v.get("source_date")})[-1:],
                           "names_with_rsi": sum(1 for v in IX.values() if "rsi" in v),
                           "names_with_sma200": sum(1 for v in IX.values() if "sma200" in v)},
            "spy": {"as_of": spy["as_of"], "holdings": spy["n"], "source": spy["source"]},
            "dia": {"as_of": dia["as_of"], "holdings": dia["n"], "source": dia["source"]},
            "sp500_gics": {"members": gics["n"], "source": gics["source"], "fetched_utc": gics["fetched_utc"]},
            "themes": {"source": "data/taxonomy-rules-20260924.json (M45) — Alan's own branch list, "
                              "used here only as a lens over the standard trunk"},
            "classification": "FMP sector and industry, translated into GICS sector / industry group / "
                              "industry by a stated table. It is a translation, not S&P's own GICS feed.",
        },
        "thresholds": THRESHOLDS,
        "indexes": indexes,
        "themes": sorted(themes, key=lambda t: -t["n_served"]),
        "sector_etf": SECTOR_ETF,
        "comparison": comparison,
        "moved_by_gics": moved,
        "unmapped_industries": sorted("%s | %s" % (s, i) for s, i in unmapped),
        "nodes": nodes,
        "names": names,
        "etfs": etfs,
        "sp500_totals": {"weight_pct": round(sp_total_w, 2), "members_classified": sp_total_n},
        "hub_totals": {"companies": hub_n_total, "cap_usd": hub_cap_total,
                       "in_sp500": sum(1 for n in names.values() if n["sp500"]),
                       "in_dow": sum(1 for n in names.values() if n["dow"])},
    }
    p = os.path.join(ROOT, "data", "standard-tree-20260924.json")
    json.dump(out, open(p, "w"), indent=1)
    print("wrote", p)
    print("companies %d · etfs %d · nodes %d · unmapped industries %d · moved by GICS %d"
          % (len(names), len(etfs), len(nodes), len(unmapped), len(moved)))
    for u in out["unmapped_industries"]:
        print("  UNMAPPED:", u)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=None)
    a = ap.parse_args()
    main(a.cache)
