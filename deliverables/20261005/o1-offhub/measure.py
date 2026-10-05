#!/usr/bin/env python3
"""O1 · soundness of the off-Hub (close) tier, B1's rule unchanged, before → after the ADRs join.
   python3 measure.py before | after      reads data/, writes data/soundness-<tag>.json and prints the counts.
   Rule (T12 + B1): sound = n read ≥ 8 · standard error ≤ 0.10 · held on each of the 6 closes · the names read carry ≥ 90 %
   of the market value of the names that exist. thin = enough and steady but under-covered or disagreeing. not yet = too few or not steady.
   Who exists: FMP /stable/company-screener (NASDAQ, NYSE, AMEX) with B1's filters, one company counted once. A second line
   ('strict') also drops the symbols Massive types as a note, preferred, unit, warrant, right or closed-end fund (SP, PFD, UNIT, WARRANT, RIGHT, FUND)
   — those repeat a company's value under a different paper (SOJE / SOMN for SO, SMCIP for SMCI) and are not equities the Geiger should read."""
import json, math, os, re, sys
from collections import defaultdict, Counter
HERE = os.path.dirname(os.path.abspath(__file__)); D = f"{HERE}/data"
tag = sys.argv[1] if len(sys.argv) > 1 else "before"
def J(p): return json.load(open(p))
def norm(t): return (t or "").upper().replace(".", "-")
SECTOR_MAP = {"Basic Materials": "MATERIALS", "Energy": "ENERGY", "Financial Services": "FINANCIALS", "Industrials": "INDUSTRIAL",
              "Technology": "TECH", "Consumer Defensive": "STAPLES", "Real Estate": "REAL ESTATE", "Utilities": "UTILITIES",
              "Healthcare": "HEALTH", "Consumer Cyclical": "DISCRET", "Communication Services": "COMMS"}
NOTE_RX = re.compile(r"(\bnotes?\b|preferred|debenture|depositary|%|\bdue\s+\d{4}|capital securities|subordinated|trust pfd|\bpfd\b|warrant|\bunits?\b|\brights?\b)", re.I)
scr = J(f"{D}/fmp-screener-20261005.json")
types = J(f"{D}/massive-types-20261005.json")
mtype = {norm(r[0]): r[1] for r in types["non_cs"]}
for t in types["cs"]: mtype.setdefault(norm(t), "CS")
hub_ind = {norm(r["ticker"]): r for r in J(f"{D}/hub-ticker-industry.json")}
hub_prof = {norm(r["ticker"]): r for r in J(f"{D}/hub-company-profile.json")}
memb_rows = J(f"{D}/hub-ticker-membership.json")
live_doc = J(f"{D}/hub-geiger-live-20261005.json")
route = J(f"{D}/scout-route-{tag}-20261005.json")
DATES = ["2026-09-25", "2026-09-28", "2026-09-29", "2026-09-30", "2026-10-01", "2026-10-02"]
six = {d: J(f"{D}/close-{tag}-{d}.json")["rows"] for d in DATES}

def who_exists(strict):
    exists = {}
    for sym, sector, industry, mcap, is_etf, is_fund, active, exch, country, name in scr["rows"]:
        if is_etf or is_fund or not active: continue
        if sector not in SECTOR_MAP: continue
        if industry == "Shell Companies": continue
        if re.search(r"-P[A-Z]?$|-W[A-Z]?$|-U$|-R$", sym) or NOTE_RX.search(name or ""): continue
        t = norm(sym)
        if strict and mtype.get(t) in ("SP", "PFD", "UNIT", "WARRANT", "RIGHT", "FUND"): continue
        if t in exists and (exists[t]["mcap"] or 0) >= (mcap or 0): continue
        exists[t] = {"t": t, "sector": SECTOR_MAP[sector], "industry": industry or "—", "mcap": float(mcap or 0), "name": name, "country": country, "exch": exch, "mtype": mtype.get(t)}
    return exists

# ---- what we compute (the route: the seven-rung reading where it exists, else the three-rung close) ----
close = {}
cols = route["row_columns"]
for r in route["rows"]:
    o = dict(zip(cols, r))
    if o["composite"] is None: continue
    close[norm(o["ticker"])] = {"g": o["composite"], "kind": o["kind"], "session": o["last_session"], "reading": o.get("reading"), "raw": o["ticker"]}
live = {norm(t): {"g": v["composite"]} for t, v in live_doc["symbols"].items() if v and v.get("composite") is not None}
hist = defaultdict(dict)
for d, rows in six.items():
    for t, c, kind, sess in rows:
        if c is not None: hist[norm(t)][d] = float(c)

def build(strict):
    exists = who_exists(strict)
    computed_syms = set(close) | set(live)
    def namekey(n): return re.sub(r"\s+", " ", re.sub(r"\b(class [abc]|ordinary shares|common stock|inc\.?|corp\.?|corporation|plc|ltd\.?|limited|the|s\.a\.|n\.v\.|ag|sa|co\.?)\b", "", (n or "").lower().replace(",", ""))).strip()
    byname = defaultdict(list)
    for t, e in exists.items(): byname[namekey(e["name"])].append(t)
    dropped = []
    for k, ts in byname.items():
        if len(ts) < 2 or not k: continue
        ts.sort(key=lambda t: (t not in computed_syms, len(t), t))
        for t in ts[1:]: dropped.append(t); exists.pop(t, None)
    for t, r in hub_ind.items():
        s = SECTOR_MAP.get(r["fmp_sector"]); p = hub_prof.get(t, {})
        if t not in exists and s and not p.get("is_etf"):
            exists[t] = {"t": t, "sector": s, "industry": r["fmp_industry"] or "—", "mcap": float(p.get("market_cap") or 0), "name": p.get("name"), "country": p.get("country"), "exch": "hub", "from": "ticker_industry", "mtype": mtype.get(t)}

    def reading(t, mode):
        if mode == "blend" and t in live: return live[t]["g"], "live"
        if t in close: return close[t]["g"], "close"
        return None, None
    def mean(xs): return sum(xs) / len(xs) if xs else None
    def sd(xs):
        if len(xs) < 2: return None
        m = mean(xs); return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))
    def measure(members, label, kind, mode, exists_members=None):
        rows = []
        for t in members:
            g, src = reading(t, mode); e = exists.get(t) or {}
            rows.append({"t": t, "g": g, "src": src, "mcap": e.get("mcap", 0.0), "name": e.get("name"), "industry": e.get("industry"), "country": e.get("country"), "mtype": e.get("mtype")})
        read = [r for r in rows if r["g"] is not None]; gs = [r["g"] for r in read]
        ew = mean(gs); capw = [r for r in read if r["mcap"] > 0]
        cw = (sum(r["g"] * r["mcap"] for r in capw) / sum(r["mcap"] for r in capw)) if capw else None
        se = (sd(gs) / math.sqrt(len(gs))) if len(gs) > 1 else None
        ex = exists_members if exists_members is not None else members
        ex_rows = [exists[t] for t in ex if t in exists]
        mv_exist = sum(r["mcap"] for r in ex_rows); mv_have = sum(r["mcap"] for r in read)
        mv_share = (mv_have / mv_exist) if mv_exist > 0 else None
        closes = []
        for d in DATES:
            xs = [hist[t][d] for t in members if d in hist.get(t, {})]
            closes.append({"date": d, "n": len(xs), "mean": round(mean(xs), 3) if xs else None, "se": round(sd(xs) / math.sqrt(len(xs)), 3) if len(xs) > 1 else None})
        means = [c["mean"] for c in closes if c["mean"] is not None]
        closes_pass = sum(1 for c in closes if c["n"] >= 8 and c["se"] is not None and c["se"] <= 0.10)
        rules = {"enough": len(gs) >= 8, "agree": se is not None and se <= 0.10, "steady": closes_pass == len(DATES), "covered": mv_share is not None and mv_share >= 0.90}
        if rules["enough"] and rules["agree"] and rules["steady"] and rules["covered"]: verdict = "sound"
        elif rules["enough"] and rules["steady"]: verdict = "thin"
        else: verdict = "not yet"
        missing = sorted([r for r in ex_rows if r["t"] not in {x["t"] for x in read}], key=lambda r: -r["mcap"])
        need, have = [], mv_have
        for r in missing:
            if mv_exist > 0 and have / mv_exist >= 0.90: break
            need.append({"t": r["t"], "name": r["name"], "mcap_bn": round(r["mcap"] / 1e9, 1), "country": r["country"], "mtype": r.get("mtype")}); have += r["mcap"]
            if len(need) >= 40: break
        weak = []
        if not rules["enough"]: weak.append(f"only {len(gs)} with a reading (needs 8)")
        if se is not None and se > 0.10: weak.append(f"the names disagree: standard error {se:.2f} (limit 0.10)")
        if closes_pass < len(DATES): weak.append(f"held on {closes_pass} of {len(DATES)} closes")
        if mv_share is not None and mv_share < 0.90: weak.append(f"covers {mv_share*100:.0f}% of the market value that exists (needs 90%)")
        return {"label": label, "kind": kind, "n_exist": len(ex_rows), "n_read": len(gs), "n_live": sum(1 for r in read if r["src"] == "live"), "n_close": sum(1 for r in read if r["src"] == "close"),
                "n_adr": sum(1 for r in read if (r["mtype"] == "ADRC")), "ew": round(ew, 4) if ew is not None else None, "cw": round(cw, 4) if cw is not None else None,
                "bowtie": round(ew - cw, 4) if (ew is not None and cw is not None) else None, "se": round(se, 3) if se is not None else None,
                "mv_exist_bn": round(mv_exist / 1e9, 1), "mv_have_bn": round(mv_have / 1e9, 1), "mv_share": round(mv_share, 4) if mv_share is not None else None,
                "closes": closes, "closes_pass": closes_pass, "rules": rules, "verdict": verdict, "weak": weak, "need": need, "missing_n": len(missing),
                "missing_top": [{"t": r["t"], "mcap_bn": round(r["mcap"] / 1e9, 1), "country": r["country"], "mtype": r.get("mtype")} for r in missing[:5]]}
    by_sector = defaultdict(list); by_ind = defaultdict(list)
    for t, e in exists.items(): by_sector[e["sector"]].append(t); by_ind[(e["sector"], e["industry"])].append(t)
    out = {"strict": strict, "counts": {"exist": len(exists), "computed_close_rows": len(close), "live_hub": len(live),
           "exist_not_computed": sum(1 for t in exists if t not in close and t not in live),
           "exist_not_computed_by_type": dict(Counter((exists[t].get("mtype") or "ABSENT") for t in exists if t not in close and t not in live)),
           "exist_not_computed_value_bn": round(sum(exists[t]["mcap"] for t in exists if t not in close and t not in live) / 1e9),
           "adr_rows_read": sum(1 for t, c in close.items() if c["kind"] == "ADRC"), "second_classes_dropped": len(dropped)}, "modes": {}}
    for mode in ("blend", "close"):
        sectors = []
        for s in SECTOR_MAP.values():
            ex = sorted(set(by_sector[s])); col = measure(ex, s, "sector", mode, ex)
            inds = []
            for (s2, ind), tk in by_ind.items():
                if s2 != s: continue
                m = measure(sorted(set(tk)), ind, "industry", mode, tk); m["sector"] = s; inds.append(m)
            inds.sort(key=lambda m: (m["ew"] is None, -(m["ew"] or -9)))
            col["industries"] = [m for m in inds if m["n_read"] >= 8]; col["industries_small"] = sum(1 for m in inds if m["n_read"] < 8)
            sectors.append(col)
        groups = defaultdict(list)
        for r in memb_rows:
            if r["kind"] == "cohort": groups[r["group_key"]].append(norm(r["ticker"]))
        cohorts = []
        for gk, tk in sorted(groups.items()):
            if len(tk) < 2: continue
            m = measure(sorted(set(tk)), gk.replace("_", " "), "cohort", mode, tk); m["funds_or_macro"] = gk in ("INDEXES", "MACRO")
            if m["mv_exist_bn"] == 0:
                m["rules"]["covered"] = m["n_read"] >= 0.9 * len(set(tk)); m["mv_share"] = None
                m["verdict"] = "sound" if all(m["rules"].values()) else ("thin" if (m["rules"]["enough"] and m["rules"]["steady"]) else "not yet")
            m["members_no_reading"] = sorted(t for t in set(tk) if reading(t, mode)[0] is None)
            cohorts.append(m)
        allm = sorted(exists); market = measure(allm, "MARKET", "market", mode, allm)
        out["modes"][mode] = {"sectors": sectors, "cohorts": cohorts, "market": market}
    def counts(items): return dict(Counter(i["verdict"] for i in items))
    for mode in ("blend", "close"):
        M = out["modes"][mode]
        out["modes"][mode]["verdicts"] = {"sectors": counts(M["sectors"]), "industries": counts([i for s in M["sectors"] for i in s["industries"]]),
            "industries_n": sum(len(s["industries"]) for s in M["sectors"]), "industries_small": sum(s["industries_small"] for s in M["sectors"]), "cohorts": counts(M["cohorts"]),
            "names_needed": sorted({n["t"] for s in M["sectors"] for n in s["need"]} | {n["t"] for s in M["sectors"] for i in s["industries"] for n in i["need"]})}
    return out

res = {"tag": tag, "rule": "T12 + B1 (unchanged)", "dates": DATES, "route_as_of": route.get("as_of"), "route_rows": len(route["rows"]), "route_seven_rows": route.get("seven", {}).get("rows"),
       "live_computed_utc": live_doc["computed_utc"], "b1": build(False), "strict": build(True)}
json.dump(res, open(f"{D}/soundness-{tag}.json", "w"), indent=0)
for k in ("b1", "strict"):
    r = res[k]
    for mode in ("blend", "close"):
        v = r["modes"][mode]["verdicts"]
        print(f"[{tag}] {k:6} {mode:5} sectors {v['sectors']} · industries ({v['industries_n']}, 8+ read) {v['industries']} · cohorts {v['cohorts']} · names still needed {len(v['names_needed'])}")
    print(f"[{tag}] {k:6} counts {r['counts']}")
