# KO1 · the elimination rounds over the whole universe, assembled. Reads what the other tools left in the scratch folder
# (comps-universe.json, fundamentals.json, timing.json, replay.pkl, geiger-live.json, snap/) and writes data/knockout.json
# beside the page. The rules are in rounds.py; this file only joins and counts. No network, no key, no table write.
# Run from the scratch folder:   python3 <this file>
import json, os, sys, pickle, collections, datetime as dtm
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import rounds as R
TODAY = os.environ.get("KO1_TODAY", "2026-10-06"); SNAP = os.environ.get("KO1_SNAP", "snap"); OUT = os.environ.get("KO1_KNOCKOUT_OUT") or os.path.join(HERE, "..", "data", "knockout.json")
DEBT = os.environ.get("KO1_DEBT") == "1"   # CP3: leverage in the debate among the names that passed round 2 (rounds.py); off = the knockout as first published
L = lambda n: json.load(open(f"{SNAP}/{n}.json"))
r1 = lambda v: None if v is None or not np.isfinite(v) else round(float(v), 1)
r2 = lambda v: None if v is None or not np.isfinite(v) else round(float(v), 2)
CU = json.load(open("comps-universe.json")); C = CU["names"]; SKIP = CU["skipped"]
FU = json.load(open("fundamentals.json"))["names"]; TM = json.load(open("timing.json")); TN = TM["names"]
RES = pickle.load(open("replay.pkl", "rb")); LIVE = json.load(open("geiger-live.json"))["symbols"]
TREE = L("cohort_tree"); MEM = L("cohort_tree_members"); PROF = {r["ticker"]: r for r in L("company_profile")}
by = {r["cohort"]: r for r in TREE}
# ---------------------------------------------------------------- Alan's lists (read only)
lists = collections.defaultdict(list)
for r in L("station_lists"): lists[r["list"].upper()].append(r["ticker"])
lists["LIKED"] = sorted(r["ticker"] for r in L("hub_favorites"))
on_lists = lambda t: [k for k in ("RADAR", "FAVORITES", "LIKED") if t in lists[k]]
# ---------------------------------------------------------------- the tree: cohorts and the sector each hangs from
def sector_of(c):
    p = by[c]["parent_1"]
    while p and p in by and by[p]["kind"] != "heading": p = by[p]["parent_1"]
    return c if (not p or p == "MARKET") else p
cohorts = [r["cohort"] for r in TREE if r["kind"] == "cohort"]
members = collections.defaultdict(list); funds_of = collections.defaultdict(list)
for m in MEM:
    if m["role"] == "member": members[m["cohort"]].append(m["ticker"])
    elif m["role"] == "reference": funds_of[m["cohort"]].append(m["ticker"])
mine = collections.defaultdict(list)
for c in cohorts:
    for t in members[c]: mine[t].append(c)
SECTORS = collections.OrderedDict()
for c in cohorts: SECTORS.setdefault(sector_of(c), []).append(c)
label = lambda c: by[c]["label"] if c in by else c
# ---------------------------------------------------------------- per name: the readings of every round
def name_row(t):
    c = C.get(t);
    if not c or not c.get("ok"): return None
    a = c["after"]; f = FU.get(t) or {}; tm = TN.get(t) or {}; g = tm.get("geiger") or {}
    strength, comps_words = R.comps_use(a)
    rv = f.get("revision") or {}
    row = {"t": t, "name": c.get("name"), "line": c.get("line"), "family": c.get("family"), "price": a.get("price"),
           "comps": a.get("upside_pct") if a.get("band") else None, "comps_strength": strength, "comps_words": comps_words, "comps_band": a.get("band"), "comps_peers": a.get("n_behind"),
           "comps_thin": bool(a.get("thin")) if a.get("band") else False, "comps_fragile": bool(a.get("fragile")) if a.get("band") else False, "comps_no_peer_set": bool(a.get("no_peer_set")),
           "comps_priced_on": a.get("priced_on"), "comps_before": (c.get("before") or {}).get("upside_pct"), "comps_peers_say": a.get("upside_from_peers") if a.get("no_peer_set") else None,
           "g1_rev": r1(f.get("rev_g1")), "g1_eps": r1(f.get("eps_g1")), "g2_rev": r1(f.get("rev_g2")), "g2_eps": r1(f.get("eps_g2")), "g1_eps_as_shown": r1(f.get("eps_g1_as_shown")), "eps_note": f.get("eps_note"),
           "base_basis": "row" if (f.get("fy0") or {}).get("basis", "").startswith("the analysts") else "street" if (f.get("fy0") or {}).get("basis", "").startswith("its four") else "filed", "one_off": (f.get("one_off") or {}).get("words") or [], "currency": f.get("currency"), "thin_estimates": bool(f.get("thin_estimates")), "venture": bool(f.get("venture")), "eps_note2": f.get("eps_note2"),
           "g1_rev_unranked": r1(f.get("rev_g1_unranked")), "g1_eps_unranked": r1(f.get("eps_g1_unranked")), "dip_years": f.get("dip_years") or [],
           "revisions": r1(rv.get("reading")), "revisions_on": rv.get("on"), "revisions_days": rv.get("days"), "cash": r2(f.get("fcf_yield")), "cash_why": f.get("fcf_why"), "next_report": f.get("next_report"),
           "geiger": r2(g.get("live")), "pctl": None if g.get("pctl") is None else round(g["pctl"]), "pctl_n": g.get("n"), "p50": r2(g.get("p50")), "p70": r2(g.get("p70")), "read": (g.get("read") or {}).get("words"), "kind": (g.get("read") or {}).get("kind"),
           "trend": r2(g.get("trend")), "momentum": r2(g.get("momentum")), "from_high": (tm.get("tech") or {}).get("from_high_pct"), "lo_52w": (tm.get("tech") or {}).get("lo_52w"), "usual_day": (tm.get("tech") or {}).get("usual_day_60"),
           "reviewed": bool(tm.get("reviewed")), "lists": on_lists(t), "cohorts": mine.get(t, []),
           # CP3: the debt reading (the comps table's own figures) and the forward basis the comps number was read on
           "nd_ebitda": (a.get("own") or {}).get("nd_ebitda"), "net_debt": a.get("net_debt"), "ebitda_ttm": a.get("ebitda_ttm"), "financial": (c.get("sector") or "") == "Financial Services",
           "pe_fwd": ((a.get("rows") or {}).get("pe_fwd") or {}).get("own"), "peg": ((a.get("rows") or {}).get("peg") or {}).get("own"), "fwd_label": a.get("fwd_label"), "fwd_growth": (a.get("own") or {}).get("eps_g_fy")}
    row["timing"] = R.timing_word(row["pctl"]); row["hot"] = row["pctl"] is not None and row["pctl"] > R.HOT
    # the level where it would be bought: the nearest zone at or under price, else the nearest single level under price
    px = row["price"]; below = tm.get("below") or []; zones = [z for z in (tm.get("zones") or []) if z["side"] in ("below", "at")]
    lvl = None
    if zones:
        z = zones[0]; lvl = {"kind": "zone", "low": z["low"], "high": z["high"], "members": z["members"], "pct": r1((z["high"] / px - 1) * 100) if z["side"] == "below" else 0.0, "at": z["side"] == "at", "source": z.get("source")}
    near = below[0] if below else None
    row["near_below"] = None if not near else {"label": near["label"], "level": near["level"], "pct": near["pct"], "kind": near["kind"]}
    if lvl is None or (near and lvl and not lvl["at"] and near["level"] > lvl["high"] * 1.0001): row["level_first"] = row["near_below"]
    else: row["level_first"] = None
    row["zone"] = lvl
    a100 = [x for x in (tm.get("averages_below") or []) if x["label"] == "100-day"]; row["avg100"] = None if "sma100" not in (tm.get("tech") or {}) else {"level": r2(tm["tech"]["sma100"]), "pct": r1((tm["tech"]["sma100"] / px - 1) * 100)}
    row["above"] = [{"label": x["label"], "level": x["level"], "pct": x["pct"]} for x in (tm.get("above") or [])[:1]]
    cool = tm.get("cool")
    if cool:
        f70 = cool.get("to_70th") or {}; f50 = cool.get("to_median") or {}
        nl = lambda c: None if not c.get("nearest_level") else {"label": c["nearest_level"]["label"], "level": c["nearest_level"]["level"], "pct": c["nearest_level"]["pct"]}
        row["cool"] = {"price": f70.get("price"), "pct": r1(f70.get("pct")), "near": nl(f70), "note": f70.get("note"), "median_price": f50.get("price"), "median_pct": r1(f50.get("pct")), "median_near": nl(f50), "median_note": f50.get("note"), "check": cool.get("check_median_gap"), "check_p90": cool.get("check_p90_gap")}
    return row
NAMES = {}
for t in C:
    r = name_row(t)
    if r: NAMES[t] = r
# ---------------------------------------------------------------- ROUND 1 · every branch, its own heat and trend
ref_dates = [d for d in RES["SPY"]["date"] if d < TODAY][-TM["year"]:]
def branch_read(tickers):
    live = [(LIVE.get(t) or {}) for t in tickers]; live = [x for x in live if x.get("composite") is not None]
    if len(live) < 2: return None
    heat = float(np.mean([x["composite"] for x in live])); tr = float(np.mean([x["trend"] for x in live if x.get("trend") is not None])); mo = float(np.mean([x["momentum"] for x in live if x.get("momentum") is not None]))
    ser = []; need = max(2, (len(live) + 1) // 2)
    idx = {t: {d: i for i, d in enumerate(RES[t]["date"])} for t in tickers if t in RES}
    for d in ref_dates:
        v = [float(RES[t]["g"][idx[t][d]]) for t in idx if d in idx[t] and np.isfinite(RES[t]["g"][idx[t][d]])]
        if len(v) >= need: ser.append(float(np.mean(v)))
    pctl = float((np.array(ser) < heat).mean() * 100) if len(ser) >= 60 else None
    q = (lambda p: r2(float(np.percentile(ser, p)))) if len(ser) >= 60 else (lambda p: None)
    kind = "go" if tr > 0 and mo > 0 else "buy" if tr > 0 else "improve" if mo > 0 else "avoid"
    words = {"go": "uptrend, confirmed", "buy": "pullback in an uptrend", "improve": "bounce in a downtrend", "avoid": "breakdown"}[kind]
    return {"heat": r2(heat), "trend": r2(tr), "momentum": r2(mo), "pctl": None if pctl is None else round(pctl), "evenings": len(ser), "p10": q(10), "p50": q(50), "p90": q(90), "min": r2(min(ser)) if ser else None, "max": r2(max(ser)) if ser else None,
            "kind": kind, "read": words, "n": len(live), "tool_coldness": r2(max(0.05, (1 - heat) / 2))}
BR = {}
for c in cohorts:
    run = [t for t in members[c] if t in NAMES]; b = branch_read(run) or {}
    fund = by[c].get("spine_fund"); fg = (LIVE.get(fund) or {}).get("composite") if fund else None
    BR[c] = {"id": c, "label": label(c), "sector": sector_of(c), "sector_label": label(sector_of(c)), "second_parent": label(by[c]["parent_2"]) if by[c].get("parent_2") else None, "level": "cohort",
             "members": sorted(members[c]), "run": sorted(run), "not_run": {t: (SKIP.get(t) or "no figures on file") for t in members[c] if t not in NAMES}, "fund": fund, "fund_geiger": r2(fg), **b}
SR = {}
for s, cs in SECTORS.items():
    run = sorted({t for c in cs for t in members[c] if t in NAMES}); b = branch_read(run) or {}
    SR[s] = {"id": s, "label": label(s), "level": "sector", "cohorts": cs, "run": run, "parent": label(by[s]["parent_1"]) if s in by and by[s].get("parent_1") and by[s]["parent_1"] != "MARKET" else None, **b}
R.round1_rank(list(BR.values())); R.round1_rank(list(SR.values()))
for group in (BR, SR):                                                       # the allocation tool's own order beside it (coldness on one scale for all)
    rows = sorted(group.values(), key=lambda b: (-(b.get("tool_coldness") or 0.5) * b["turn"], b["id"]))
    for k, b in enumerate(rows): b["rank_tool"] = k + 1
# ---------------------------------------------------------------- ROUND 2 · inside each branch
for c in cohorts:
    rows = [{k: NAMES[t].get(k) for k in ("t", "g1_rev", "g1_eps", "g2_rev", "g2_eps", "comps", "comps_strength", "revisions", "cash", "pctl", "venture", "nd_ebitda", "net_debt", "ebitda_ttm", "financial")} for t in BR[c]["run"]]
    S = R.score_branch(rows, debt=DEBT); BR[c]["debt_moved"] = S.get("debt_moved") or []; BR[c]["order"] = S["order"]; BR[c]["cut"] = r2(S["cut"]) if S["cut"] is not None else None; BR[c]["finalists"] = S["finalists"]; BR[c]["champion"] = S["finalists"][0] if S["finalists"] else None
    BR[c]["field"] = {k: (None if v is None else {"n": v["n"], "q1": r1(v["q1"]), "med": r1(v["med"]), "q3": r1(v["q3"])}) for k, v in S["field"].items()}
    BR[c]["scores"] = {r["t"]: {"score": round(r["score"], 3), "rank": r["rank"], "passes": bool(r["passes"]), "n": r["n"], "judged": r["judged"], **({"debt_penalty": r["debt_penalty"], "debt_words": r["debt_words"], "debate": round(r["debate"], 3), "rank_before_debt": r.get("rank_before_debt")} if "debt_penalty" in r else {}), "parts": {k: (None if v is None else round(v, 2)) for k, v in r["parts"].items()}} for r in S["rows"]}
business = lambda t: [c for c in mine.get(t, []) if c not in R.REGION_OR_SIZE and c in BR and t in BR[c].get("scores", {})]
anyc = lambda t: [c for c in mine.get(t, []) if c in BR and t in BR[c].get("scores", {})]
WORDS = {"growth_next": "growth next year", "growth_after": "growth the year after", "comps": "comps", "revisions": "estimate revisions", "cash": "cash yield"}
pc = lambda v: "—" if v is None else (f"{v:+.0f}%" if abs(v) >= 1 or v == 0 else f"{v:+.1f}%").replace("-", "\u2212")
MATERIAL = {"revisions": 1.0, "comps": 5.0, "cash": 1.0}                    # a reading is named as a reason only when it is more than a rounding
def eps_word(n, which):
    """Earnings growth in words: the number, or why there is none to give."""
    v = n["g1_eps"] if which == 1 else n["g2_eps"]
    if v is not None: return "earnings " + pc(v)
    note = (n.get("eps_note") if which == 1 else (n.get("eps_note2") or n.get("eps_note"))) or ""
    if note.startswith("no earnings") or note.startswith("no EPS"): return "no earnings yet"
    if "one-off year" in note: return "earnings not ranked, a one-off year in the base"
    if "loss" in note: return "earnings not ranked, a loss in the base"
    if "footing" in note: return "earnings not ranked, the filed and the analysts' figures differ"
    return "earnings not ranked"
def reason(t, c):
    """The plain reason a name stands where it does in a branch: its strongest readings, with the numbers."""
    n = NAMES[t]; s = BR[c]["scores"][t]; p = s["parts"]; bits = []
    top = sorted([k for k in R.WEIGHTS if p[k] is not None], key=lambda k: -(R.WEIGHTS[k] * p[k]))
    for k in top:
        if p[k] < 0.7 or len(bits) == 2: continue
        if k == "revisions" and (n["revisions"] or 0) < MATERIAL["revisions"]: continue
        if k == "comps" and (n["comps"] or 0) < MATERIAL["comps"]: continue
        if k == "cash" and (n["cash"] or 0) < MATERIAL["cash"]: continue
        if k == "growth_next": bits.append(f"growth next year in the branch's top quarter (revenue {pc(n['g1_rev'])}, {eps_word(n, 1)})")
        elif k == "growth_after": bits.append(f"growth the year after in the top quarter (revenue {pc(n['g2_rev'])}, {eps_word(n, 2)})")
        elif k == "comps": bits.append(f"more room against its peers than most of the branch ({pc(n['comps'])}{', ' + n['comps_words'].split(':')[0] if n['comps_words'] else ''})")
        elif k == "revisions": bits.append(f"estimates raised more than most ({pc(n['revisions'])} in {n['revisions_days']} days)")
        elif k == "cash": bits.append(f"a cash yield in the top quarter ({n['cash']:.1f}%)")
    if not bits:
        best = top[0] if top else None
        bits.append(("no reading in the branch's top quarter; it leads by being weak in none" if s["rank"] == 1 else "upper half of the branch without a top-quarter reading") + (f" (its best: {WORDS[best]})" if best else ""))
    if len(BR[c]["order"]) == 1: bits = ["the only name in the branch the fundamentals can judge"] + bits[:1]
    return "; ".join(bits)
def weak(t, c):
    n = NAMES[t]; p = BR[c]["scores"][t]["parts"]; bits = []
    for k in sorted([k for k in R.WEIGHTS if p[k] is not None], key=lambda k: p[k]):
        if p[k] > 0.3 or len(bits) == 2: continue
        if k == "growth_next": bits.append(f"growth next year in the branch's bottom quarter (revenue {pc(n['g1_rev'])}, {eps_word(n, 1)})")
        elif k == "growth_after": bits.append(f"growth the year after in the bottom quarter (revenue {pc(n['g2_rev'])}, {eps_word(n, 2)})")
        elif k == "comps": bits.append(f"less room against its peers than most of the branch ({pc(n['comps'])}{', ' + n['comps_words'].split(':')[0] if n['comps_words'] else ''})")
        elif k == "revisions": v = n["revisions"] or 0; bits.append(f"estimates cut ({pc(v)} in {n['revisions_days']} days)" if v <= -1 else f"estimates raised less than most of the branch ({pc(v)})" if v >= 1 else f"estimates flat ({pc(v)}) while others in the branch were raised")
        elif k == "cash": bits.append(f"cash yield in the bottom quarter ({n['cash']:.1f}%)")
    return "; ".join(bits) or "middling on every reading: nothing in the top quarter to lift it"
def buy_level(n):
    """Where it would be bought, in words: its cool-down close when it is hot, else the nearest zone or level under price."""
    if n["hot"] and n.get("cool"):
        c = n["cool"]
        if c.get("price") is None: return {"hot": True, "words": f"hot for itself ({n['pctl']}th of its year): no one-session close within 40% cools it" + (f"; nearest level below {n['near_below']['label']} {n['near_below']['level']:,.2f}" if n["near_below"] else ""), "price": None}
        return {"hot": True, "price": c["price"], "pct": c["pct"], "near": c.get("near"), "words": f"wait: cools near {c['price']:,.2f} ({c['pct']:+.1f}%)" + (f", by the {c['near']['label']} {c['near']['level']:,.2f}" if c.get("near") else "")}
    z = n.get("zone"); lf = n.get("level_first")
    if z and z["at"]: return {"hot": False, "price": z["high"], "pct": 0.0, "words": f"at its zone now: {z['low']:,.2f}–{z['high']:,.2f} ({' + '.join(z['members'])})"}
    if lf:
        w = f"{lf['label']} {lf['level']:,.2f} ({lf['pct']:+.1f}%)"
        if z: w += f"; then the zone {z['low']:,.2f}–{z['high']:,.2f} ({' + '.join(z['members'])}, {z['pct']:+.1f}%)"
        return {"hot": False, "price": lf["level"], "pct": lf["pct"], "words": w}
    if z: return {"hot": False, "price": z["high"], "pct": z["pct"], "words": f"the zone {z['low']:,.2f}–{z['high']:,.2f} ({' + '.join(z['members'])}, {z['pct']:+.1f}%)"}
    if n.get("near_below"): nb = n["near_below"]; return {"hot": False, "price": nb["level"], "pct": nb["pct"], "words": f"{nb['label']} {nb['level']:,.2f} ({nb['pct']:+.1f}%)"}
    lo = n.get("lo_52w"); up = n["above"][0] if n.get("above") else None
    return {"hot": False, "price": lo, "pct": None if not lo else round((lo / n["price"] - 1) * 100, 1), "under_all": True,
            "words": "under all four of its averages" + (f": its 52-week low is {lo:,.2f} ({(lo / n['price'] - 1) * 100:+.1f}%)" if lo else "") + (f"; first to win back, the {up['label']} {up['level']:,.2f} ({up['pct']:+.1f}%)" if up else "")}
for n in NAMES.values(): n["buy"] = buy_level(n)
# ---------------------------------------------------------------- per name: its verdict across its branches
for t, n in NAMES.items():
    bs = business(t) or anyc(t); n["branches"] = {}
    for c in anyc(t):
        s = BR[c]["scores"][t]; n["branches"][c] = {"label": BR[c]["label"], "rank": s["rank"], "of": len(BR[c]["order"]), "score": s["score"], "passes": s["passes"], "finalist": t in BR[c]["finalists"], "champion": BR[c]["champion"] == t, "business": c not in R.REGION_OR_SIZE}
    judged = [c for c in bs if BR[c]["scores"][t]["judged"]]
    n["home"] = (sorted(judged, key=lambda c: (BR[c]["scores"][t]["rank"] or 99) / max(1, len(BR[c]["order"]))) or [None])[0]
    n["in_tree"] = bool(anyc(t)); n["r2"] = None if not judged else any(BR[c]["scores"][t]["passes"] for c in judged)
    n["r3"] = None if n["pctl"] is None else (not n["hot"])
    n["finalist_in"] = [c for c in anyc(t) if t in BR[c]["finalists"]]; n["champion_in"] = [c for c in anyc(t) if BR[c]["champion"] == t]
    # the branches its own verdict rests on: its business branches (a club by place or size only when it has no other)
    n["verdict_branches"] = bs; n["finalist_where_it_counts"] = [c for c in bs if t in BR[c]["finalists"]]; n["champion_where_it_counts"] = [c for c in bs if BR[c]["champion"] == t]
    n["verdict"] = ("not in a branch of the tree" if not n["in_tree"] else ("not judged: sales under 1% of its market value" if n["venture"] else "not judged: fewer than three of the five readings") if n["r2"] is None else "fails round 2 (fundamentals)" if not n["r2"] else "passes fundamentals; timing says wait" if n["hot"] else "passes both")
    h = n["home"]
    n["why"] = None if not h else (reason(t, h) if BR[h]["scores"][t]["passes"] else weak(t, h))
# ---------------------------------------------------------------- finalists and the champions table
champions = []
for c in sorted(cohorts, key=lambda c: BR[c]["rank"]):
    b = BR[c]; b["finalist_rows"] = []
    for k, t in enumerate(b["finalists"]):
        n = NAMES[t]; s = b["scores"][t]
        b["finalist_rows"].append({"t": t, "place": k + 1, "score": s["score"], "why": reason(t, c), "buy": n["buy"], "lists": n["lists"]})
    if b["champion"]: champions.append({"branch": c, "t": b["champion"]})
# ---------------------------------------------------------------- open the loop
allL = set(lists["RADAR"]) | set(lists["FAVORITES"]) | set(lists["LIKED"])
blind = sorted([t for t, n in NAMES.items() if n["finalist_where_it_counts"] and not n["lists"]], key=lambda t: (0 if NAMES[t]["champion_where_it_counts"] else 1, min(BR[c]["rank"] for c in NAMES[t]["finalist_where_it_counts"]), t))
tunnel = []
for t in sorted(allL):
    n = NAMES.get(t)
    if not n:
        p = PROF.get(t) or {}; why = SKIP.get(t) or ("a coin, a future or a metal: no company figures" if t.endswith("USD") else "a fund, not a company" if (p.get("is_etf") or t in LIVE) else "not in the figures on file")
        tunnel.append({"t": t, "lists": on_lists(t), "round": None, "why": "not scored: " + why}); continue
    if n["r2"] is False: tunnel.append({"t": t, "lists": n["lists"], "round": 2, "branch": BR[n["home"]]["label"] if n["home"] else None, "rank": n["branches"][n["home"]]["rank"] if n["home"] else None, "of": n["branches"][n["home"]]["of"] if n["home"] else None, "why": n["why"]})
    elif n["r2"] is None: tunnel.append({"t": t, "lists": n["lists"], "round": None, "why": n["verdict"]})
    elif n["hot"]: tunnel.append({"t": t, "lists": n["lists"], "round": 3, "branch": BR[n["home"]]["label"] if n["home"] else None, "why": f"Geiger {n['geiger']:+.2f}, the {n['pctl']}th percentile of its own year: {n['buy']['words']}"})
wait_on_lists = sorted([t for t in allL if t in NAMES and NAMES[t]["r2"] and NAMES[t]["hot"]], key=lambda t: (0 if "RADAR" in NAMES[t]["lists"] else 1 if "FAVORITES" in NAMES[t]["lists"] else 2, t))
green = sorted([t for t, n in NAMES.items() if n["hot"]], key=lambda t: (0 if NAMES[t]["lists"] else 1, -NAMES[t]["pctl"], t))
# ---------------------------------------------------------------- the funnel
in_tree = [t for t, n in NAMES.items() if n["in_tree"]]; p2 = [t for t in in_tree if NAMES[t]["r2"]]; p3 = [t for t in p2 if not NAMES[t]["hot"]]
fin = sorted({t for c in cohorts for t in BR[c]["finalists"]}); champs = sorted({x["t"] for x in champions})
A = [c["after"] for c in C.values() if c.get("ok")]
holdings = L("etf_holdings"); held = collections.defaultdict(set)
for h in holdings:
    if h.get("asset"): held[h["ticker"]].add(str(h["asset"]).upper())
fund_rows = [m["ticker"] for m in MEM if m["role"] in ("index_fund", "reference")]; admitted = sorted({f for f in fund_rows if f in held})
all_assets = set().union(*[held[f] for f in admitted]) if admitted else set()
funnel = {
    "profiles_on_file": CU["meta"]["counts"]["profiles"], "served_universe": 590,
    "skipped": dict(collections.Counter(v.split(":")[0].split(" (")[0] for v in SKIP.values())), "skipped_names": {k: v for k, v in SKIP.items() if not v.startswith("a fund") and not v.startswith("not a company")},
    "funds_holdings": {"funds_with_holdings_on_file": len(admitted), "holding_rows": sum(len(held[f]) for f in admitted), "distinct_holdings": len(all_assets), "of_them_run": len(all_assets & set(NAMES)), "not_run_no_figures": len(all_assets - set(NAMES) - set(SKIP)), "not_run_other": len((all_assets & set(SKIP)))},
    "run_through_comps": len(NAMES), "priced": sum(1 for a in A if a.get("band")), "sound": sum(1 for n in NAMES.values() if n["comps_strength"] == 1), "half_strength": sum(1 for n in NAMES.values() if n["comps_strength"] == 0.5), "not_used": sum(1 for n in NAMES.values() if n["comps_strength"] == 0),
    "thin": sum(1 for a in A if a.get("band") and a.get("thin")), "fragile": sum(1 for a in A if a.get("band") and a.get("fragile")), "thin_and_fragile": sum(1 for a in A if a.get("band") and a.get("thin") and a.get("fragile")),
    "no_peer_set": sum(1 for a in A if a.get("no_peer_set")), "cannot_be_priced": sum(1 for a in A if not a.get("band") and not a.get("no_peer_set")), "no_earnings_comps_not_used": sum(1 for n in NAMES.values() if n["comps_words"].startswith("no earnings")),
    "moved_by_the_fix_5pts": sum(1 for n in NAMES.values() if n["comps"] is not None and n["comps_before"] is not None and abs(n["comps"] - n["comps_before"]) > 5),
    "one_off_cleaned": sum(1 for n in NAMES.values() if n["one_off"]), "branches": len(cohorts), "sectors": len(SR), "round1_in_a_branch": len(in_tree), "not_in_a_branch": sorted(t for t, n in NAMES.items() if not n["in_tree"]),
    "round2_pass": len(p2), "round2_fail": len([t for t in in_tree if NAMES[t]["r2"] is False]), "round2_not_judged": len([t for t in in_tree if NAMES[t]["r2"] is None]),
    "round3_now": len(p3), "round3_wait": len(p2) - len(p3), "hot_all": len(green), "finalists": len(fin), "finalist_slots": sum(len(BR[c]["finalists"]) for c in cohorts), "champions": len(champs), "champion_slots": len(champions),
    "finalists_now": len([t for t in fin if not NAMES[t]["hot"]]), "champions_now": len([t for t in champs if not NAMES[t]["hot"]]),
}
def list_read(k):
    ts = lists[k]; sc = [t for t in ts if t in NAMES]
    return {"n": len(ts), "companies_scored": len(sc), "not_scored": [t for t in ts if t not in NAMES], "pass_both": [t for t in sc if NAMES[t]["r2"] and not NAMES[t]["hot"]], "pass_wait": [t for t in sc if NAMES[t]["r2"] and NAMES[t]["hot"]], "fail_r2": [t for t in sc if NAMES[t]["r2"] is False],
            "finalists": [t for t in sc if NAMES[t]["finalist_in"]], "champions": [t for t in sc if NAMES[t]["champion_in"]]}
sec_of = {t: BR[n["home"] or (n["verdict_branches"] or anyc(t))[0]]["sector"] for t, n in NAMES.items() if (n["home"] or n["verdict_branches"] or anyc(t))}   # the sector of the branch where it stands best
lists_by_sector = [{"sector": s, "label": SR[s]["label"], "rank": SR[s]["rank"], "heat": SR[s].get("heat"), "pctl": SR[s].get("pctl"), "read": SR[s].get("read"), "names": len(SR[s]["run"]),
                    **{k: [t for t in lists[k] if sec_of.get(t) == s] for k in ("RADAR", "FAVORITES", "LIKED")}} for s in sorted(SR, key=lambda s: SR[s]["rank"])]
out = {"today": TODAY, "built_utc": dtm.datetime.utcnow().isoformat() + "Z", "price_is": CU["meta"]["price_is"], "geiger_published_utc": TM.get("geiger_published_utc"),
       "rules": {"weights": R.WEIGHTS, "turn": R.TURN, "hot": R.HOT, "cold": R.COLD, "even": R.EVEN, "top": R.TOP, "region_or_size": list(R.REGION_OR_SIZE), "thin_below": CU["meta"]["constants"]["THIN_BELOW"], "zone_pct": TM["zone_pct"], "year": TM["year"]},
       "checks": {"replay": TM["replay_check"], "cool": TM["cool_check"], "confluence": TM["confluence_file"], "comps_switches": CU["meta"]["switches"], "tables": CU["meta"]["tables"]},
       "funnel": funnel, "sectors": SR, "branches": BR, "champions": champions, "names": NAMES, "lists": {k: lists[k] for k in ("RADAR", "FAVORITES", "LIKED")}, "list_read": {k: list_read(k) for k in ("RADAR", "FAVORITES", "LIKED")},
       "lists_by_sector": lists_by_sector, "blind_spots": blind, "tunnel": tunnel, "wait_on_lists": wait_on_lists, "green": green, "named_green": [t for t in "AVGO VST NBIS BE CRWV NVDA MSTR".split() if t in NAMES]}
os.makedirs(os.path.dirname(OUT), exist_ok=True); json.dump(out, open(OUT, "w"), separators=(",", ":"))
print("funnel:", json.dumps({k: v for k, v in funnel.items() if not isinstance(v, (dict, list))}))
print("skipped:", funnel["skipped"], "| holdings:", funnel["funds_holdings"])
print("round 1, sectors:", [(b["rank"], b["label"], b.get("heat"), b.get("pctl"), b.get("read")) for b in sorted(SR.values(), key=lambda b: b["rank"])])
print("blind spots:", len(blind), "· tunnel:", collections.Counter(x["round"] for x in tunnel), "· green:", len(green))
for k, v in out["list_read"].items(): print(k, {a: (len(b) if isinstance(b, list) else b) for a, b in v.items()})
print("wrote", os.path.getsize(OUT), "bytes")
