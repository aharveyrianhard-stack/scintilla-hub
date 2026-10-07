#!/usr/bin/env python3
"""TR2 · THE EVENING STEERING, MEASURED — and the Market Desk queue as four lanes drawn from the tree.

LOCAL FILES ONLY. Reads the revised tree (../revised-tree.json), the tags (../factor-tags.json), CO1's six-month
closes and its 6 Oct copy of the Hub's own cohort lists, and data/review-context-20261006.json (which names the
Indicator Lab has reviewed lines for; which names listed in the last 24 months). Writes TWO files:
  ../steering-evidence.json     what the tape and the Hub's own lists say about each thing Alan steered
  ../market-desk-lanes.json     a PROPOSAL: the review queue in four lanes, with the rule of each lane and the
                                names it gives at the last close on file. It is not a queue file and is sent nowhere.
No network, no database, no clock. Run after scripts/cohort-tree-revise.mjs --write.

"Moves together" is the correlation of daily moves over the last 126 sessions (six months). "After the market's
swing is taken out" removes from each side the part explained by SPY, so two names are not called alike just
because everything rose together.
"""
import csv, json, math, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
CO1 = os.path.join(ROOT, "deliverables/20261006/cohort-proposal")
P_CLOSES = os.path.join(CO1, "data/closes-6m-20261006.csv")
P_HUB = os.path.join(CO1, "data/ticker_cohorts-20261006.json")
rel = lambda p: os.path.relpath(p, ROOT)
def load(p):
    with open(p) as fh: return json.load(fh)
TREE = load(os.path.join(OUT_DIR, "revised-tree.json")); FT = load(os.path.join(OUT_DIR, "factor-tags.json"))
CTX = load(os.path.join(OUT_DIR, "data/review-context-20261006.json"))
N = FT["rules"]["sessions"]; AS_OF = FT["as_of"]
r1 = lambda x: None if x is None else round(x, 1)
r2 = lambda x: None if x is None else round(x, 2)

# ── closes → daily moves ───────────────────────────────────────────────────────────────────────────────────────
with open(P_CLOSES) as fh: rows = list(csv.reader(fh))
head, body = rows[0], rows[1:]
if body[-1][0] != AS_OF: sys.exit("REFUSED: the tags were made on another closes file")
col = {t: i for i, t in enumerate(head)}
def closes(t):
    i = col.get(t)
    if i is None: return None
    px = [r[i] for r in body[-(N + 1):]]
    return None if any(v in ("", "null", "None") for v in px) else [float(v) for v in px]
PX = {t: closes(t) for t in head[1:]}
RET = {t: [math.log(p[i] / p[i - 1]) for i in range(1, len(p))] for t, p in PX.items() if p}
def corr(a, b):
    ma, mb = sum(a) / len(a), sum(b) / len(b)
    sa = math.sqrt(sum((x - ma) ** 2 for x in a)); sb = math.sqrt(sum((y - mb) ** 2 for y in b))
    return None if sa == 0 or sb == 0 else sum((x - ma) * (y - mb) for x, y in zip(a, b)) / (sa * sb)
def resid(x, m):                                        # x with the part explained by m taken out
    mx, mm = sum(x) / len(x), sum(m) / len(m)
    beta = sum((a - mx) * (b - mm) for a, b in zip(x, m)) / sum((b - mm) ** 2 for b in m)
    return [a - beta * b for a, b in zip(x, m)]
MKT = RET["SPY"]
RES = {t: resid(r, MKT) for t, r in RET.items() if t != "SPY"}
def basket(ts, src=RET):
    use = [src[t] for t in ts if t in src]
    return [sum(c) / len(c) for c in zip(*use)] if use else None
def both(a, b):                                         # raw and after-market, for two names, baskets or lists of names
    A = basket(a) if isinstance(a, list) else RET.get(a); B = basket(b) if isinstance(b, list) else RET.get(b)
    Ar = basket(a, RES) if isinstance(a, list) else RES.get(a); Br = basket(b, RES) if isinstance(b, list) else RES.get(b)
    return {"raw": r2(corr(A, B)) if A and B else None, "after_market": r2(corr(Ar, Br)) if Ar and Br else None}
def together(ts):                                       # average of every pair inside a set
    ts = [t for t in ts if t in RET]
    c = [corr(RET[a], RET[b]) for i, a in enumerate(ts) for b in ts[i + 1:]]
    return {"names": len(ts), "pairs": len(c), "avg": r2(sum(c) / len(c)) if c else None}
def across(A, B):                                       # average of every pair with one name from each set
    c = [corr(RET[a], RET[b]) for a in A for b in B if a != b and a in RET and b in RET]
    return {"pairs": len(c), "avg": r2(sum(c) / len(c)) if c else None}
def window_return(t, n=N):
    p = PX.get(t); return None if not p else r1((p[-1] / p[-(n + 1)] - 1) * 100)
def spread(a, b, n):                                    # how much a beat b over n sessions, in percentage points of the ratio
    pa, pb = PX[a], PX[b]; return r1(((pa[-1] / pb[-1]) / (pa[-(n + 1)] / pb[-(n + 1)]) - 1) * 100)

NODE = {n["cohort"]: n for n in TREE["nodes"]}
def members(c): return [m["ticker"] for m in TREE["members"] if m["cohort"] == c and m["role"] == "member"]
TAG = {o["ticker"]: o for o in FT["names"]}
label = lambda c: NODE[c]["label"]

# ── 1. Amazon, Shopify and the other marketplaces: software or shop? ─────────────────────────────────────────
PLAT = ["AMZN", "SHOP", "MELI", "BABA", "JD", "PDD"]
YARD = [("IGV", "software fund"), ("FDN", "internet fund"), ("XRT", "retail fund"), ("XLY", "consumer discretionary fund")]
def plat_row(t):
    o = {"ticker": t, "cohorts": [m["cohort"] for m in TREE["members"] if m["ticker"] == t and m["role"] == "member" and not m["cohort"].startswith("IDX_FACTOR_")],
         "tags": TAG[t]["tags"], "hub_cohorts_today": sorted(r["cohort"] for r in load(P_HUB) if r["ticker"] == t)}
    for f, _ in YARD: o[f] = both(t, f)
    # the software side is the better of the two funds made of software and internet companies; the shop side is the
    # retail fund alone (every shop counted the same, so no single name flatters it). Both after the market's swing.
    sw, shop = max(o["IGV"]["after_market"], o["FDN"]["after_market"]), o["XRT"]["after_market"]
    o["software_side"] = sw; o["shop_side"] = shop
    o["closer_to"] = ("neither closely" if max(sw, shop) < 0.15 else "the software and internet funds" if sw - shop > 0.05 else "the retail fund" if shop - sw > 0.05 else "both about equally")
    return o
platforms = {"what": "How each marketplace moved with the software fund and with the retail fund, six months to " + AS_OF,
             "yardsticks": [{"fund": f, "is": w} for f, w in YARD], "rows": [plat_row(t) for t in PLAT],
             "for_comparison": [plat_row(t) for t in ["WMT", "COST", "CRM", "NOW"]]}

# ── 2. AI POWERTRAIN: do the grid names belong, and do the regulated utilities not? ─────────────────────────
HUB = {}
for r in load(P_HUB): HUB.setdefault(r["cohort"], []).append(r["ticker"])
now20 = members("AI_POWERTRAIN"); grid = members("GRID_ELECTRICAL"); util = members("REGULATED_UTILITIES")
was12 = [m["ticker"] for m in TREE["members"] if m["cohort"] == "AI_POWERTRAIN" and m["role"] == "member" and not m["why"].startswith("also in GRID_ELECTRICAL") and not m["why"].startswith("also in AI_SERVERS_DC_KIT")]
joined = [t for t in now20 if t not in was12]
GROUP_ORDER = ["GRID_ELECTRICAL", "POWER_GENERATORS", "NUCLEAR_URANIUM", "FUEL_CELLS_STORAGE"]      # the order Alan named them in
groups = sorted([n["cohort"] for n in TREE["nodes"] if n["parent_1"] == "AI_POWERTRAIN"], key=lambda c: GROUP_ORDER.index(c) if c in GROUP_ORDER else 99)
powertrain = {
    "what": "AI POWERTRAIN before and after the grid and electrical names joined, six months to " + AS_OF,
    "on_the_hub_today": {"cohort": "AI_POWERTRAIN", "names": sorted(HUB.get("AI_POWERTRAIN", [])),
                         "in_the_tree_not_on_the_hub": sorted(set(now20) - set(HUB.get("AI_POWERTRAIN", []))), "source": rel(P_HUB) + " (CO1's copy of the Hub's cohort lists, 6 Oct)"},
    "before": {"names": was12, "moves_together": together(was12)},
    "joined": {"names": joined, "moves_together": together(joined), "with_the_names_already_there": across(joined, was12),
               "basket_against_the_old_basket": both(joined, was12)},
    "after": {"names": now20, "moves_together": together(now20)},
    "groups": [{"cohort": g, "label": label(g), "names": members(g), "moves_together": together(members(g)),
                "against_the_rest_of_ai_powertrain": both(members(g), [t for t in now20 if t not in members(g)])} for g in groups],
    "regulated_utilities": {"names": len(util), "moves_together": together(util), "with_ai_powertrain_names": across(util, now20),
                            "basket_against_ai_powertrain": both(util, now20), "basket_against_XLU": both(util, "XLU")},
    "each_joined_name": [{"ticker": t, "with_the_old_ai_powertrain_basket": both(t, was12), "with_industrials_XLI": both(t, "XLI"),
                          "with_utilities_XLU": both(t, "XLU"), "with_chips_SMH": both(t, "SMH"), "tags": TAG[t]["tags"]} for t in joined],
    "baskets_against_funds": {name: {f: both(ts, f) for f in ["SMH", "XLI", "XLU", "PAVE", "URA"]} for name, ts in [("AI POWERTRAIN (20)", now20), ("the 8 that joined", joined), ("regulated utilities (24)", util)]},
}

# ── 3. the hand-made lists already on the Hub, against the rule ──────────────────────────────────────────────
def hand(hub_cohort, tag, why):
    h = sorted(t for t in HUB.get(hub_cohort, []) if t in TAG); ours = {t for t in TAG if tag in TAG[t]["tags"]}
    return {"hub_cohort": hub_cohort, "hub_names": len(h), "rule": tag, "rule_names": len(ours), "both": len(set(h) & ours),
            "on_the_hub_list_not_by_rule": [{"ticker": t, **dict(zip(("group", "detail"), why(TAG[t])))} for t in h if t not in ours]}
def why_not_growth(o):                                    # → (the reason, said once for the group; the name's own number)
    if o.get("growth_ntm_rev_pct") is not None: return (f"an estimate is on file and it is under {FT['rules']['growth_min_ntm_rev_pct']:.0f}%", f"{o['growth_ntm_rev_pct']:+.1f}%")
    return ("no estimate on file, and " + ("both VUG and VTV hold it" if o.get("growth_basis", "") and "both" in o["growth_basis"] else "VTV holds it, VUG does not" if o.get("growth_basis") else "in neither VUG nor VTV (a foreign listing or a smaller company)"), None)
hand_lists = {"what": "The Hub already carries two lists made by hand early on. This is how the rule sees the same names.",
              "growth": hand("GROWTH", "GROWTH", why_not_growth),
              "blue_chip_vs_low_volatility": hand("BLUE_CHIP", "LOW VOLATILITY", lambda o: ("not in the calmest fifth; its usual day, as a multiple of the market's", f"{o['usual_day_vs_market']:.1f}×") if o.get("usual_day_rank") is not None else ("short history", None)),
              "blue_chip_vs_quality": hand("BLUE_CHIP", "QUALITY (QUAL holds it)", lambda o: ("QUAL does not hold it", None))}

# ── 4. the fund lines as readings, and our lists against them ────────────────────────────────────────────────
PAIRS = [("VUG", "VTV", "growth against value", "rising = investors are paying up for growth; falling = they are moving to cheaper, steadier companies"),
         ("MTUM", "SPLV", "momentum against low volatility", "rising = risk appetite: what has been winning keeps beating what is calm; falling = money is hiding"),
         ("QUAL", "SPY", "quality against the market", "rising = money prefers the profitable, low-debt companies; falling = lower-quality names are leading, usually late in a rally"),
         ("RSP", "SPY", "the average stock against the index", "rising = the rally is broad; falling = a few giants are carrying it"),
         ("SPLV", "SPY", "calm stocks against the market", "rising = defensive; falling = the market is being led by its jumpy names")]
fund_lines = {"what": "Each pair is one line: how much the first fund beat the second. Six months and the last 20 sessions, to " + AS_OF,
              "pairs": [{"a": a, "b": b, "is": w, "reads": rd, "a_return_6m_pct": window_return(a), "b_return_6m_pct": window_return(b),
                         "a_beat_b_6m_pct": spread(a, b, N), "a_beat_b_20_sessions_pct": spread(a, b, 20), "move_together": both(a, b)["raw"]} for a, b, w, rd in PAIRS]}
def ours_vs(node, fund):
    ts = members(node); px = [PX[t] for t in ts if PX.get(t)]
    eq = r1((sum(p[-1] / p[0] for p in px) / len(px) - 1) * 100)
    return {"branch": label(node), "names": len(ts), "our_list_return_6m_pct": eq, "fund": fund, "fund_return_6m_pct": window_return(fund), "move_together": both(ts, fund)}
fund_lines["our_lists_against_the_funds"] = [ours_vs("IDX_FACTOR_MOMENTUM", "MTUM"), ours_vs("IDX_FACTOR_LOW_VOL", "SPLV"), ours_vs("IDX_FACTOR_LOW_VOL", "QUAL"), ours_vs("IDX_FACTOR_GROWTH", "VUG")]
fund_lines["note"] = "Our lists hold names of every size with each counted the same; the funds hold large companies weighted by size and are rebuilt on their own calendars. A six-month return on our momentum list is high by construction: the list is the names that rose most."

# ── 5. the factor tags inside the tree: which cohorts are made of what ───────────────────────────────────────
def mix(c):
    ts = members(c); k = lambda tag: sum(1 for t in ts if tag in TAG[t]["tags"])
    return {"cohort": c, "label": label(c), "hub_pick": NODE[c]["hub_pick"], "names": len(ts), "growth": k("GROWTH"), "momentum": k("MOMENTUM"), "low_volatility": k("LOW VOLATILITY"),
            "lagging": k("LAGGING"), "high_volatility": k("HIGH VOLATILITY"), "value": k("VALUE")}
tag_mix = [mix(n["cohort"]) for n in TREE["nodes"] if n["layer"] == 4 and not n["cohort"].startswith("IDX_") and members(n["cohort"])]

evidence = {"what": "TR2: Alan's evening steering of 6 Oct, measured from local files. Generated by tools/steering_evidence.py. Nothing here is written to any table.",
            "as_of": AS_OF, "window": FT["window"], "measured_from": {"closes": rel(P_CLOSES), "hub_cohorts": rel(P_HUB), "tree": "deliverables/20261006/tree-revision/revised-tree.json", "tags": "deliverables/20261006/tree-revision/factor-tags.json"},
            "platforms": platforms, "ai_powertrain": powertrain, "hand_made_lists": hand_lists, "fund_lines": fund_lines, "tag_mix_by_cohort": tag_mix}
with open(os.path.join(OUT_DIR, "steering-evidence.json"), "w") as fh: json.dump(evidence, fh, indent=1); fh.write("\n")

# ── 6. THE MARKET DESK QUEUE AS FOUR LANES ───────────────────────────────────────────────────────────────────
LANE_RULES = {"per_lane_cap": 8, "pullback_min_off_high_pct": 7.0, "support_max_above_low_pct": 8.0, "new_listing_months": 24}
REVIEWED = {r["ticker"]: r for r in CTX["reviewed_lines"]["rows"]}; LISTED = {r["ticker"]: r for r in CTX["new_listings"]["rows"]}
ON = {}                                                   # company → the on-Hub cohorts it sits in (the factor branch is not a pick)
for m in TREE["members"]:
    c = NODE[m["cohort"]]
    if m["role"] == "member" and c["hub_pick"] == "on" and not m["cohort"].startswith("IDX_"): ON.setdefault(m["ticker"], []).append(c["label"])
def fund_measure(t):
    p = [float(r[col[t]]) for r in body if r[col[t]] not in ("", "null", "None")]
    win = p[-(N + 1):]
    return {"ret_6m_pct": r1((win[-1] / win[0] - 1) * 100), "off_high_pct": r1((win[-1] / max(win) - 1) * 100), "vs_avg21_pct": r1((p[-1] / (sum(p[-21:]) / 21) - 1) * 100),
            "vs_avg100_pct": r1((p[-1] / (sum(p[-100:]) / 100) - 1) * 100), "last_close": p[-1]}
def lines_of(t):
    r = REVIEWED.get(t)
    if not r: return {"reviewed": t in CTX["reviewed_lines"]["reviewed_tickers"], "lines": 0}
    f = lambda x: None if not x else {"line": x["id"], "level": x["level"], "pct_from_price": x["pct"]}
    return {"reviewed": True, "lines": r["lines"], "nearest_above": f(r.get("above")), "nearest_below": f(r.get("below")), "priced_at": r.get("price")}
def item(t, why):
    o = TAG[t]
    return {"ticker": t, "name": o["name"], "on_hub_cohorts": ON.get(t, []), "why": why, "ret_6m_pct": o.get("ret_126_pct"), "momentum_rank": o.get("momentum_rank"),
            "off_high_pct": o.get("off_high_pct"), "above_low_pct": o.get("above_low_pct"), "vs_avg21_pct": o.get("vs_avg21_pct"), "vs_avg100_pct": o.get("vs_avg100_pct"),
            "growth_ntm_rev_pct": o.get("growth_ntm_rev_pct"), "tags": o["tags"], "last_close": o.get("last_close"), "lines": lines_of(t)}
core_funds = [("SPY", "S&P 500"), ("QQQ", "Nasdaq-100"), ("DIA", "Dow"), ("IWM", "small companies"), ("RSP", "S&P 500, every name counted the same")] + \
             [(n["spine_fund"], n["label"].split(" · ")[0].title()) for n in TREE["nodes"] if n["layer"] == 2]
core = [{"ticker": t, "name": nm, "kind": "index" if i < 5 else "sector parent", **fund_measure(t), "lines": lines_of(t)} for i, (t, nm) in enumerate(core_funds)]
cand = [t for t in ON if t in TAG and TAG[t].get("momentum_rank") is not None]
leaders_all = sorted([t for t in cand if "MOMENTUM" in TAG[t]["tags"] and TAG[t]["off_high_pct"] <= -LANE_RULES["pullback_min_off_high_pct"] and (TAG[t].get("vs_avg100_pct") or 0) > 0], key=lambda t: -TAG[t]["momentum_rank"])
laggards_all = sorted([t for t in cand if "LAGGING" in TAG[t]["tags"] and TAG[t]["above_low_pct"] <= LANE_RULES["support_max_above_low_pct"]], key=lambda t: TAG[t]["above_low_pct"])
new_all = [t for t in sorted(LISTED, key=lambda t: LISTED[t]["listed_on"], reverse=True) if t in TAG]
cap = LANE_RULES["per_lane_cap"]
lanes = {
    "what": "PROPOSAL (not a queue file, sent nowhere): the Market Desk review queue as four lanes drawn from the tree, with the rule of each lane and what it gives at the close of " + AS_OF + ". The Indicator Lab still owns the review; a lane only says which names to look at and why.",
    "as_of": AS_OF, "rules": LANE_RULES,
    "honest_notes": [
        "'Pullback' and 'support' here are stand-ins measured from closes: distance under the six-month high, distance over the six-month low, and the 100-day average. The real support is Alan's reviewed lines; where a name has them the nearest line above and below is shown with its own label.",
        "'On the Hub' means the name sits in a cohort recorded as on in the tree's hub_pick column (AI, semis, software & internet, grid & electrical, finance). HEALTH is on only in part, so its names are left out until Alan says which.",
        "The momentum rank is the six-month leg only. A lane changes every day; this is the fill at one close, to show what the rule gives.",
        "Favorites and radar are not read here (they live in the Hub's database); joining them is the next step: a name on either list should jump to the top of its lane.",
    ],
    "lanes": [
        {"lane": "CORE", "what": "the indexes and the eleven sector parents: reviewed first, every day, because every name below hangs from one of them",
         "rule": "the five index lines the Hub draws (SPY, QQQ, DIA, IWM, RSP) and the SPDR fund of each of the eleven sector nodes of the tree", "always": True, "count": len(core), "items": core},
        {"lane": "LEADERS ON A PULLBACK", "what": "strong names that have come back: where to add",
         "rule": f"on the Hub; top fifth by six-month return (the MOMENTUM tag); at least {LANE_RULES['pullback_min_off_high_pct']:.0f}% under its six-month high; still above its 100-day average. Strongest first.",
         "count": len(leaders_all), "shown": min(cap, len(leaders_all)), "items": [item(t, f"rank {TAG[t]['momentum_rank']:.0f} of 100, {abs(TAG[t]['off_high_pct']):.0f}% under its six-month high") for t in leaders_all[:cap]], "also": leaders_all[cap:]},
        {"lane": "ROTATION LAGGARDS AT SUPPORT", "what": "weak names sitting near their low: where money rotates to next, if the level holds",
         "rule": f"on the Hub; bottom fifth by six-month return (the LAGGING tag); within {LANE_RULES['support_max_above_low_pct']:.0f}% of its six-month low. Closest to the low first.",
         "count": len(laggards_all), "shown": min(cap, len(laggards_all)), "items": [item(t, f"rank {TAG[t]['momentum_rank']:.0f} of 100, {TAG[t]['above_low_pct']:.0f}% over its six-month low") for t in laggards_all[:cap]], "also": laggards_all[cap:]},
        {"lane": "NEW NAMES", "what": "names with little history: listed in the last two years, so they need a first review and their own, shorter yardsticks",
         "rule": f"a company of the tree that listed within {LANE_RULES['new_listing_months']} months; newest first. A name waiting for admission joins this lane the night it is admitted.",
         "count": len(new_all), "shown": len(new_all), "items": [{**item(t, f"listed {LISTED[t]['listed_on']} ({LISTED[t]['months']:.0f} months ago)"), "listed_on": LISTED[t]["listed_on"], "in_tree_cohorts": [label(m["cohort"]) for m in TREE["members"] if m["ticker"] == t and m["role"] == "member" and not m["cohort"].startswith("IDX_FACTOR_")]} for t in new_all], "also": []},
    ],
}
lanes["counts"] = {l["lane"]: l["count"] for l in lanes["lanes"]}
lanes["reviewed_so_far"] = CTX["reviewed_lines"]["reviewed_tickers"]
with open(os.path.join(OUT_DIR, "market-desk-lanes.json"), "w") as fh: json.dump(lanes, fh, indent=1); fh.write("\n")

print("wrote steering-evidence.json and market-desk-lanes.json")
for r in platforms["rows"] + platforms["for_comparison"]: print(" ", r["ticker"].ljust(5), "IGV", r["IGV"], "FDN", r["FDN"], "XRT", r["XRT"], "XLY", r["XLY"], "→", r["closer_to"])
print("powertrain before", powertrain["before"]["moves_together"], "joined", powertrain["joined"]["moves_together"], powertrain["joined"]["with_the_names_already_there"], powertrain["joined"]["basket_against_the_old_basket"], "after", powertrain["after"]["moves_together"])
print("utilities", powertrain["regulated_utilities"])
for g in powertrain["groups"]: print("  group", g["cohort"], g["moves_together"], g["against_the_rest_of_ai_powertrain"])
for k, v in powertrain["baskets_against_funds"].items(): print("  ", k, v)
print("hub today", powertrain["on_the_hub_today"]["names"], "missing", powertrain["on_the_hub_today"]["in_the_tree_not_on_the_hub"])
for p in fund_lines["pairs"]: print("  pair", p["a"], p["b"], p["a_beat_b_6m_pct"], p["a_beat_b_20_sessions_pct"], p["move_together"])
for o in fund_lines["our_lists_against_the_funds"]: print("  ours", o)
print("hand", {k: (v["hub_names"], v["rule_names"], v["both"]) for k, v in hand_lists.items() if isinstance(v, dict)})
for l in lanes["lanes"]: print(l["lane"], l["count"], [i["ticker"] for i in l["items"]], l.get("also", [])[:12])
