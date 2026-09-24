#!/usr/bin/env python3
"""M45 · build the proposed tree from measured data. Nothing is written to any table.

Inputs, all read live and all named in the output's provenance block:
  · chart API /universe   — the 364 served names (the only universe that exists)
  · chart API /geiger     — composite / trend / momentum per name
  · chart API /quotes     — price and previous close per name (the CHG column's basis)
  · PostgREST company_profile — sector, industry, market cap, is_etf
  · PostgREST ticker_cohorts and cohorts — Alan's cohorts, both engines
  · PostgREST social_sentiment — score per name where a source exists

The public anon key is read out of index.html, exactly as the browser page does.
No key is written into this file and none is printed.

Output: data/taxonomy-20260924.json  (nodes, membership, rollups, provenance)
Cache:  --cache <dir> reads the same payloads from disk so the build is repeatable offline.
"""
import json, os, re, sys, urllib.request, statistics, hashlib, datetime, argparse

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
API = "https://scintilla-massive-chart-api.fly.dev"

def creds():
    s = open(os.path.join(ROOT, "index.html"), encoding="utf-8", errors="ignore").read()
    sb = re.search(r'const SB\s*=\s*"([^"]+)"', s).group(1)
    an = re.search(r'"(eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9\.[A-Za-z0-9_.-]+)"', s).group(1)
    return sb, an

def get(url, headers=None, timeout=45):
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.load(r)

def load(cache, name, fetch):
    p = os.path.join(cache, name) if cache else None
    if p and os.path.exists(p):
        return json.load(open(p))
    v = fetch()
    if p:
        json.dump(v, open(p, "w"))
    return v

def pull(cache):
    sb, an = creds()
    H = {"apikey": an, "Authorization": "Bearer " + an}
    pg = lambda path: get(f"{sb}/rest/v1/{path}", H)
    uni = load(cache, "universe.json", lambda: get(API + "/universe"))
    syms = uni["symbols"]

    def geiger():
        out = {}
        for i in range(0, len(syms), 60):
            j = get(API + "/geiger?symbols=" + ",".join(syms[i:i + 60]) + "&detail=0")
            for k, v in (j.get("symbols") or {}).items():
                out[k] = {"composite": v.get("composite"), "trend": v.get("trend"), "momentum": v.get("momentum")}
            out.setdefault("__meta__", {})["computed_utc"] = j.get("computed_utc")
        return out

    def quotes():
        out = {}
        for i in range(0, len(syms), 40):
            j = get(API + "/quotes?symbols=" + ",".join(syms[i:i + 40]))
            out.setdefault("__meta__", {})["generated_utc"] = j.get("generated_utc")
            for k, v in (j.get("quotes") or {}).items():
                p, pc = v.get("price"), v.get("previous_close")
                out[k] = {"price": p, "prev": pc, "freshness": v.get("price_freshness"),
                          "session": v.get("price_session_et"),
                          "chg_pct": round((p - pc) / pc * 100, 3) if p and pc else None}
            out["__meta__"]["session_et"] = j.get("quotes", {}).get(list(j.get("quotes", {}))[0], {}).get("price_session_et") if j.get("quotes") else None
        return out

    def cohort_rows():
        rows = []
        for off in (0, 1000, 2000):
            page = pg(f"ticker_cohorts?select=ticker,cohort&order=ticker.asc,cohort.asc&offset={off}&limit=1000")
            rows += page
            if len(page) < 1000:
                break
        return rows

    return {
        "universe": uni,
        "profiles": load(cache, "profiles.json", lambda: pg("company_profile?select=ticker,name,exchange,sector,industry,market_cap,is_etf,avg_volume&limit=2000")),
        "geiger": load(cache, "geiger_all2.json", geiger),
        "quotes": load(cache, "quotes_api2.json", quotes),
        "cohorts_new": load(cache, "cohorts_all.json", cohort_rows),
        "cohorts_old": load(cache, "cohorts_old.json", lambda: pg("cohorts?select=ticker,cohort&limit=2000")),
        "sentiment": load(cache, "sentiment.json", lambda: pg("social_sentiment?select=ticker,score,posts,updated_ts,source&limit=2000")),
        "eps_ttm": load(cache, "eps_ttm.json", lambda: pg("fundamentals?select=ticker,eps_ttm&limit=2000")),
        "eps_ntm": load(cache, "eps_ntm.json", lambda: pg("fwd_eps_ntm?select=ticker,ntm_eps,updated_ts&limit=2000")),
        "favourites": load(cache, "favourites.json", lambda: pg("hub_favorites?select=ticker,added_at&limit=500")),
    }

SECTOR_ORDER = ["Technology", "Communication Services", "Consumer Cyclical", "Consumer Defensive",
                "Healthcare", "Financial Services", "Industrials", "Energy", "Utilities",
                "Basic Materials", "Real Estate"]

def classify(d, rules):
    prof = {r["ticker"]: r for r in d["profiles"]}
    coh = {}
    for r in d["cohorts_new"]:
        coh.setdefault(r["ticker"], set()).add(r["cohort"])
    placed = {}
    # trunk 1: instruments (not a company, not a fund)
    inst = rules["instrument_trunk"]
    for fam, spec in inst.items():
        for t in spec.get("tickers", []):
            if t in d["universe"]["symbols"]:
                placed[t] = {"trunk": "INSTRUMENTS", "family": fam}
    # trunk 2: funds
    funds = rules["fund_trunk"]
    for fam, spec in funds.items():
        for t in spec.get("tickers", []):
            if t in d["universe"]["symbols"] and t not in placed:
                placed[t] = {"trunk": "FUNDS", "family": fam}
    for t in d["universe"]["symbols"]:
        if t in placed:
            continue
        p = prof.get(t) or {}
        if p.get("is_etf"):
            placed[t] = {"trunk": "FUNDS", "family": "SECTOR_AND_THEME_FUNDS"}
    # trunk 3: companies -> sector / industry / branch
    unbranched = []
    for t in d["universe"]["symbols"]:
        if t in placed:
            continue
        p = prof.get(t) or {}
        br = None
        for rule in rules["branches"]:
            if t in rule.get("tickers", []):
                br = rule["id"]; break
            if set(rule.get("seed_cohorts", [])) & coh.get(t, set()):
                br = rule["id"]; break
            ind = p.get("industry") or ""
            if any(m.lower() in ind.lower() for m in rule.get("industry_match", [])):
                br = rule["id"]; break
        if br is None:
            unbranched.append(t)
        placed[t] = {"trunk": "COMPANIES", "sector": p.get("sector") or "UNKNOWN",
                     "industry": p.get("industry") or "UNKNOWN", "branch": br or "UNBRANCHED"}
    return placed, unbranched

def rollup(members, d):
    g, q = d["geiger"], d["quotes"]
    prof = {r["ticker"]: r for r in d["profiles"]}
    sent = {}
    for r in d["sentiment"]:
        if r.get("score") is not None:
            sent.setdefault(r["ticker"], []).append(r["score"])
    comps = [g[t]["composite"] for t in members if t in g and g[t].get("composite") is not None]
    chgs = [q[t]["chg_pct"] for t in members if t in q and q[t].get("chg_pct") is not None]
    caps = [prof[t].get("market_cap") or 0 for t in members if t in prof]
    ss = [statistics.mean(sent[t]) for t in members if t in sent]
    scint = [t for t in members if t in q and q[t].get("chg_pct") is not None and abs(q[t]["chg_pct"]) >= 3.0]
    return {
        "n": len(members),
        "geiger_mean": round(statistics.mean(comps), 4) if comps else None,
        "geiger_n": len(comps),
        "breadth_pct": round(100 * sum(1 for c in comps if c >= 0.5) / len(comps), 1) if comps else None,
        "chg_mean_pct": round(statistics.mean(chgs), 3) if chgs else None,
        "advancers_pct": round(100 * sum(1 for c in chgs if c > 0) / len(chgs), 1) if chgs else None,
        "market_cap": sum(caps) or None,
        "sentiment_mean": round(statistics.mean(ss), 3) if ss else None,
        "sentiment_n": len(ss),
        "scintillas": sorted(scint, key=lambda t: -abs(q[t]["chg_pct"]))[:12],
        "put_call": None,
        "put_call_reason": "per-ticker option volume is lane M38's work and does not exist yet",
    }

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--cache", default=None)
    ap.add_argument("--out", default=os.path.join(ROOT, "data", "taxonomy-20260924.json"))
    a = ap.parse_args()
    if a.cache:
        os.makedirs(a.cache, exist_ok=True)
    d = pull(a.cache)
    rules = json.load(open(os.path.join(ROOT, "data", "taxonomy-rules-20260924.json")))
    placed, unbranched = classify(d, rules)
    prof = {r["ticker"]: r for r in d["profiles"]}

    nodes = {}
    def node(nid, label, level, parent, members):
        nodes[nid] = {"id": nid, "label": label, "level": level, "parent": parent,
                      "members": sorted(members), **rollup(sorted(members), d)}

    allsyms = list(d["universe"]["symbols"])
    node("MARKET", "The market Scintilla watches", "market", None, allsyms)
    for trunk in ("COMPANIES", "FUNDS", "INSTRUMENTS"):
        mem = [t for t, v in placed.items() if v["trunk"] == trunk]
        label = {"COMPANIES": "Companies", "FUNDS": "Funds", "INSTRUMENTS": "Instruments and rates"}[trunk]
        node(trunk, label, "trunk", "MARKET", mem)
    # funds / instruments families
    for trunk in ("FUNDS", "INSTRUMENTS"):
        fams = sorted({v["family"] for v in placed.values() if v["trunk"] == trunk})
        for f in fams:
            node(f"{trunk}:{f}", f.replace("_", " ").title(), "family", trunk,
                 [t for t, v in placed.items() if v["trunk"] == trunk and v["family"] == f])
    # sectors -> industries
    comp = {t: v for t, v in placed.items() if v["trunk"] == "COMPANIES"}
    for sec in sorted({v["sector"] for v in comp.values()}, key=lambda s: (SECTOR_ORDER.index(s) if s in SECTOR_ORDER else 99, s)):
        smem = [t for t, v in comp.items() if v["sector"] == sec]
        node(f"SEC:{sec}", sec, "sector", "COMPANIES", smem)
        for ind in sorted({comp[t]["industry"] for t in smem}):
            node(f"IND:{sec}:{ind}", ind, "industry", f"SEC:{sec}",
                 [t for t in smem if comp[t]["industry"] == ind])
    # branches (cross-cutting overlay on companies)
    node("BRANCHES", "Branches (themes)", "trunk", "MARKET", list(comp))
    blabel = {r["id"]: r["label"] for r in rules["branches"]}
    for b in sorted({v["branch"] for v in comp.values()}):
        bmem = [t for t, v in comp.items() if v["branch"] == b]
        node(f"BR:{b}", blabel.get(b, "Not yet on a branch"), "branch", "BRANCHES", bmem)

    eps_ttm = {r["ticker"]: r.get("eps_ttm") for r in d["eps_ttm"] if r.get("eps_ttm")}
    eps_ntm = {r["ticker"]: r.get("ntm_eps") for r in d["eps_ntm"] if r.get("ntm_eps")}
    out = {
        "built_utc": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        "provenance": {
            "universe": {"count": d["universe"]["count"], "sha256": d["universe"].get("universe_sha256"),
                         "source": API + "/universe"},
            "geiger": {"computed_utc": d["geiger"].get("__meta__", {}).get("computed_utc"), "source": API + "/geiger"},
            "quotes": {"generated_utc": d["quotes"].get("__meta__", {}).get("generated_utc"),
                       "session_et": d["quotes"].get("__meta__", {}).get("session_et"), "source": API + "/quotes",
                       "basis": "price vs previous_close of the session strictly before the displayed session"},
            "profile": {"source": "PostgREST company_profile (FMP sector/industry/market cap)"},
            "cohorts": {"source": "PostgREST ticker_cohorts (new engine) + cohorts (older engine)",
                        "rows_new": len(d["cohorts_new"]), "rows_old": len(d["cohorts_old"])},
            "sentiment": {"source": "PostgREST social_sentiment", "rows": len(d["sentiment"])},
            "eps": {"source": "PostgREST fundamentals.eps_ttm + fwd_eps_ntm.ntm_eps",
                    "ntm_updated_ts": max([r.get("updated_ts") or "" for r in d["eps_ntm"]] or [""]) or None},
            "favourites": {"source": "PostgREST hub_favorites", "n": len({r["ticker"] for r in d["favourites"]})},
            "rules": rules["version"],
        },
        "placement": placed,
        "unbranched": sorted(unbranched),
        "nodes": nodes,
        "favourites": sorted({r["ticker"] for r in d["favourites"]}),
        "profiles": {t: {"name": (prof.get(t) or {}).get("name"), "sector": (prof.get(t) or {}).get("sector"),
                         "industry": (prof.get(t) or {}).get("industry"),
                         "market_cap": (prof.get(t) or {}).get("market_cap"),
                         "geiger": (d["geiger"].get(t) or {}).get("composite"),
                         "trend": (d["geiger"].get(t) or {}).get("trend"),
                         "momentum": (d["geiger"].get(t) or {}).get("momentum"),
                         "chg_pct": (d["quotes"].get(t) or {}).get("chg_pct"),
                         "price": (d["quotes"].get(t) or {}).get("price"),
                         "eps_ttm": eps_ttm.get(t), "eps_ntm": eps_ntm.get(t),
                         "pe_ttm": round((d["quotes"].get(t) or {}).get("price") / eps_ttm[t], 2)
                                   if eps_ttm.get(t) and (d["quotes"].get(t) or {}).get("price") and eps_ttm[t] > 0 else None,
                         "pe_ntm": round((d["quotes"].get(t) or {}).get("price") / eps_ntm[t], 2)
                                   if eps_ntm.get(t) and (d["quotes"].get(t) or {}).get("price") and eps_ntm[t] > 0 else None,
                         "eps_growth_pct": round((eps_ntm[t] / eps_ttm[t] - 1) * 100, 1)
                                   if eps_ttm.get(t) and eps_ntm.get(t) and eps_ttm[t] > 0 else None,
                         "fav": t in {r["ticker"] for r in d["favourites"]},
                         "branch": (placed.get(t) or {}).get("branch"),
                         "trunk": (placed.get(t) or {}).get("trunk")}
                     for t in allsyms},
    }
    json.dump(out, open(a.out, "w"), indent=1, sort_keys=False)
    print("nodes", len(nodes), "· companies", len(comp), "· funds",
          sum(1 for v in placed.values() if v["trunk"] == "FUNDS"), "· instruments",
          sum(1 for v in placed.values() if v["trunk"] == "INSTRUMENTS"),
          "· unbranched", len(unbranched))
    print("unbranched:", " ".join(sorted(unbranched)) or "none")
    print("out", a.out, os.path.getsize(a.out), "bytes")

if __name__ == "__main__":
    main()
