#!/usr/bin/env python3
"""TR2 · GROWTH, MOMENTUM, LOW VOLATILITY — a mechanical tag on every company in the tree.

LOCAL FILES ONLY. Reads CO1's copies (the tree's company list, the 6-month closes, the company profiles), the
26/28 Sep fund holdings file, and data/growth-ntm-20261006.json (a slice of the workshop-queue lane's analyst
estimates read of 6 Oct ~14:50 ET: next-twelve-month revenue growth for 192 names). Writes ONE file:
../factor-tags.json. No network, no database, no clock (as_of is the last date in the closes file).

Alan, 6 Oct ~18:10 ET: "growth names and momentum names — do we have them classified? Can I view that in the
tree? … low volatility would be like blue chip names?"   ~18:40 ET: "I would expect them to be a branch, not
just tags."

THE THREE RULES (nothing is chosen by hand; change a number in RULES and re-run)
  MOMENTUM        the name's return over the last 126 sessions (six months), ranked against every company in the
                  tree that has the full 126 sessions. Top fifth = a momentum name; bottom fifth = lagging.
                  The 12-month leg joins by itself when the closes file is long enough (253 sessions): the rank
                  is then the average of the six- and twelve-month ranks, for names that have both. Today's file
                  is six months long, so the output says momentum_legs ["6m"].
  LOW VOLATILITY  its "usual day": the median size of its daily move over the same 126 sessions, said as a
                  multiple of SPY's usual day. Calmest fifth = low volatility; jumpiest fifth = high volatility.
  GROWTH          next-twelve-month revenue growth of 15% or more, where an analyst estimate is on file (192 of
                  the names today). Where none is on file yet the index maker's own call stands in: held by
                  Vanguard's growth fund VUG and not by its value fund VTV. Each row says which of the two it is.
The fund lines each tag is compared with come from the funds' own holdings: VUG / VTV, MTUM, SPLV, QUAL.
"""
import csv, json, os, statistics, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT_DIR = os.path.dirname(HERE)
WRITE_DIR = os.environ.get("TR2_OUT_DIR") or OUT_DIR       # a trial run with another closes file writes somewhere else
ROOT = os.path.abspath(os.path.join(HERE, "..", "..", "..", ".."))
CO1 = os.path.join(ROOT, "deliverables/20261006/cohort-proposal")
P_PROPOSAL = os.path.join(CO1, "proposal.json")
P_CLOSES = os.environ.get("TR2_CLOSES_FILE") or os.path.join(CO1, "data/closes-6m-20261006.csv")   # a longer file may be named here
P_PROFILE = os.path.join(CO1, "data/company_profile-20261006.json")
P_HOLD = os.path.join(ROOT, "deliverables/20260928/coverage-tree/data/holdings.json")
P_GROWTH = os.path.join(OUT_DIR, "data/growth-ntm-20261006.json")
rel = lambda p: os.path.relpath(p, ROOT)

RULES = {
    "sessions": 126,                 # six months of trading days
    "momentum_top_pct": 80,          # rank at or above this = momentum
    "momentum_bottom_pct": 20,       # rank at or below this = lagging
    "low_vol_bottom_pct": 20,        # calmest fifth
    "high_vol_top_pct": 80,          # jumpiest fifth
    "growth_min_ntm_rev_pct": 15.0,  # next-twelve-month revenue growth, where an estimate is on file
    "slow_max_ntm_rev_pct": 5.0,
    "market": "SPY",
}
FUND_LINES = {"growth": ["VUG", "VTV"], "momentum": ["MTUM"], "low_vol": ["SPLV"], "quality": ["QUAL"]}
RETIRING = {"QRVO": "bought by Skyworks, stopped trading 5 Oct 2026", "WBD": "bought by Paramount Skydance, stopped trading 6 Oct 2026"}

def load(p):
    with open(p) as fh: return json.load(fh)
norm = lambda t: str(t).upper().replace(".", "-")
r1 = lambda x: None if x is None else round(x, 1)
r2 = lambda x: None if x is None else round(x, 2)

# ── the companies of the tree (CO1's topic cohorts; the index layer holds funds, not companies) ────────────────
proposal = load(P_PROPOSAL)
companies = sorted({t for c in proposal["cohorts"] if not c["id"].startswith("IDX_") for t in c["members"]} - {"QRVO"})
profile = {r["ticker"]: r for r in load(P_PROFILE)}

# ── closes ─────────────────────────────────────────────────────────────────────────────────────────────────────
with open(P_CLOSES) as fh: rows = list(csv.reader(fh))
head, body = rows[0], rows[1:]
dates = [r[0] for r in body]
col = {t: i for i, t in enumerate(head)}
def series(t):
    i = col.get(t)
    if i is None: return []
    return [(d, float(r[i])) for d, r in zip(dates, body) if i < len(r) and r[i] not in ("", "null", "None")]
N = RULES["sessions"]
N12 = 2 * N                                              # twelve months of trading days
HAS_12M = len(dates) >= N12 + 1                          # is the closes file long enough for the second leg?
AS_OF = dates[-1]

def measure(t):
    s = series(t)
    o = {"sessions_on_file": len(s), "first_close_date": s[0][0] if s else None, "last_close_date": s[-1][0] if s else None,
         "last_close": s[-1][1] if s else None}
    if not s: return o
    stale = s[-1][0] != AS_OF
    o["stale"] = stale
    px = [v for _, v in s]
    win = px[-(N + 1):]
    full = len(px) >= N + 1 and not stale
    o["full_window"] = full
    if len(win) >= 22:
        moves = [abs(win[i] / win[i - 1] - 1) * 100 for i in range(1, len(win))]
        o["usual_day_pct"] = r2(statistics.median(moves))
        hi, lo = max(win), min(win)
        o["off_high_pct"] = r1((px[-1] / hi - 1) * 100)          # 0 = at the window's high, −12 = 12% under it
        o["above_low_pct"] = r1((px[-1] / lo - 1) * 100)
        o["vs_avg21_pct"] = r1((px[-1] / (sum(px[-21:]) / 21) - 1) * 100)
        if len(px) >= 50: o["vs_avg50_pct"] = r1((px[-1] / (sum(px[-50:]) / 50) - 1) * 100)
        if len(px) >= 100: o["vs_avg100_pct"] = r1((px[-1] / (sum(px[-100:]) / 100) - 1) * 100)
        if len(px) >= 22: o["ret_21_pct"] = r1((px[-1] / px[-22] - 1) * 100)
    if full: o["ret_126_pct"] = r1((px[-1] / px[-(N + 1)] - 1) * 100)
    if HAS_12M and len(px) >= N12 + 1 and not stale: o["ret_252_pct"] = r1((px[-1] / px[-(N12 + 1)] - 1) * 100)
    return o

spy = measure(RULES["market"])
if not spy.get("full_window"): sys.exit("REFUSED: the market line has no full window in the closes file")
M = {t: measure(t) for t in companies}

def pct_rank(values):                                  # value -> 0..100, the share of the others at or below it
    srt = sorted(values)
    n = len(srt)
    def f(v):
        below = sum(1 for x in srt if x < v); same = sum(1 for x in srt if x == v)
        return round((below + 0.5 * same) / n * 100, 1)
    return f

ranked = [t for t in companies if M[t].get("full_window") and t not in RETIRING]
rank6 = pct_rank([M[t]["ret_126_pct"] for t in ranked])
if HAS_12M:                                              # both legs: the average of the two ranks, re-ranked; a name with one leg keeps that leg
    both12 = [t for t in ranked if M[t].get("ret_252_pct") is not None]
    rank12 = pct_rank([M[t]["ret_252_pct"] for t in both12])
    blend = {t: (rank6(M[t]["ret_126_pct"]) + rank12(M[t]["ret_252_pct"])) / 2 if t in set(both12) else rank6(M[t]["ret_126_pct"]) for t in ranked}
    reblend = pct_rank(list(blend.values()))
    MOM = {t: reblend(blend[t]) for t in ranked}
else:
    MOM = {t: rank6(M[t]["ret_126_pct"]) for t in ranked}

vol_rank = pct_rank([M[t]["usual_day_pct"] for t in ranked])

# ── the fund lines: who holds the name, at what weight ───────────────────────────────────────────────────────
hold = load(P_HOLD)["data"]
def weights(fund):
    out = {}
    for t, w in hold[fund]["h"]:
        if w > 0 and norm(t) != fund: out[norm(t)] = out.get(norm(t), 0) + w
    return out
ALL_FUNDS = sorted({f for fs in FUND_LINES.values() for f in fs})
W = {f: weights(f) for f in ALL_FUNDS}

# ── growth: the estimate on file, else the index maker's side ────────────────────────────────────────────────
growth_src = load(P_GROWTH)
G = {r["ticker"]: r for r in growth_src["rows"]}

names = []
for t in companies:
    m = M[t]; p = profile.get(t, {})
    held = {f: r2(W[f].get(norm(t))) for f in ALL_FUNDS if W[f].get(norm(t))}
    o = {"ticker": t, "name": p.get("name"), "sector": p.get("sector"), "industry": p.get("industry"), "market_cap": p.get("market_cap"),
         **{k: m.get(k) for k in ("sessions_on_file", "first_close_date", "last_close_date", "last_close", "ret_126_pct", "ret_21_pct",
                                  "usual_day_pct", "off_high_pct", "above_low_pct", "vs_avg21_pct", "vs_avg50_pct", "vs_avg100_pct")},
         "held_by": held, "tags": [], "notes": []}
    if t in RETIRING: o["notes"].append(RETIRING[t]); names.append(o); continue
    if m.get("usual_day_pct") is not None: o["usual_day_vs_market"] = r2(m["usual_day_pct"] / spy["usual_day_pct"])
    if m.get("full_window"):
        o["momentum_rank"] = MOM[t]; o["usual_day_rank"] = vol_rank(m["usual_day_pct"])
        if m.get("ret_252_pct") is not None: o["ret_252_pct"] = m["ret_252_pct"]
        if o["momentum_rank"] >= RULES["momentum_top_pct"]: o["tags"].append("MOMENTUM")
        elif o["momentum_rank"] <= RULES["momentum_bottom_pct"]: o["tags"].append("LAGGING")
        if o["usual_day_rank"] <= RULES["low_vol_bottom_pct"]: o["tags"].append("LOW VOLATILITY")
        elif o["usual_day_rank"] >= RULES["high_vol_top_pct"]: o["tags"].append("HIGH VOLATILITY")
    else:
        o["notes"].append(f"short history: {m.get('sessions_on_file', 0)} sessions on file, {N + 1} needed for the six-month rank")
    g = G.get(t)
    in_vug, in_vtv = "VUG" in held, "VTV" in held
    if g is not None and g.get("rev_g") is not None:
        o["growth_ntm_rev_pct"] = r1(g["rev_g"]); o["growth_basis"] = "estimate"
        if g["rev_g"] >= RULES["growth_min_ntm_rev_pct"]: o["tags"].append("GROWTH")
        elif g["rev_g"] < RULES["slow_max_ntm_rev_pct"]: o["tags"].append("SLOW GROWTH")
    elif in_vug and not in_vtv: o["growth_basis"] = "index maker (VUG holds it, VTV does not)"; o["tags"].append("GROWTH")
    elif in_vtv and not in_vug: o["growth_basis"] = "index maker (VTV holds it, VUG does not)"; o["tags"].append("VALUE")
    elif in_vug and in_vtv: o["growth_basis"] = "index maker (both VUG and VTV hold it)"
    else: o["growth_basis"] = None; o["notes"].append("growth not classified: no estimate on file, and in neither VUG nor VTV (a foreign listing or a small company)")
    if "QUAL" in held: o["tags"].append("QUALITY (QUAL holds it)")
    names.append(o)

by = lambda tag: [o for o in names if tag in o["tags"]]
def branch(tag, sort_key, why):
    out = sorted(by(tag), key=sort_key)
    return [{"ticker": o["ticker"], "why": why(o)[:240]} for o in out]
pm = lambda x: ("+" if x >= 0 else "−") + f"{abs(x):.1f}%"
fund_say = lambda o, funds: "; ".join(f"{f} holds it ({o['held_by'][f]:.2f}%)" if f in o["held_by"] else f"{f} does not hold it" for f in funds)

branches = {
    "MOMENTUM": branch("MOMENTUM", lambda o: -o["momentum_rank"],
        lambda o: f"six-month return {pm(o['ret_126_pct'])}, rank {o['momentum_rank']:.0f} of 100 among the tree's companies ({AS_OF}); {fund_say(o, ['MTUM'])}"),
    "LOW_VOLATILITY": branch("LOW VOLATILITY", lambda o: o["usual_day_rank"],
        lambda o: f"its usual day is {o['usual_day_pct']:.2f}%, {o['usual_day_vs_market']:.1f} times the market's; calmest {o['usual_day_rank']:.0f} of 100 ({AS_OF}); {fund_say(o, ['SPLV', 'QUAL'])}"),
    "GROWTH": branch("GROWTH", lambda o: (0, -o["growth_ntm_rev_pct"]) if o.get("growth_ntm_rev_pct") is not None else (1, o["ticker"]),
        lambda o: (f"next-twelve-month revenue growth {pm(o['growth_ntm_rev_pct'])} (analyst estimates, read 6 Oct); {fund_say(o, ['VUG', 'VTV'])}"
                   if o.get("growth_ntm_rev_pct") is not None else
                   f"no estimate on file yet: stands on the index maker's call — VUG holds it ({o['held_by']['VUG']:.2f}%), VTV does not")),
}

# how well our own tag agrees with the fund built for the same idea (only names the fund could hold: S&P 500 size)
def agree(tag, fund):
    ours = {o["ticker"] for o in by(tag)}; theirs = {o["ticker"] for o in names if fund in o["held_by"]}
    return {"ours": len(ours), "fund_holds_of_our_companies": len(theirs), "both": len(ours & theirs),
            "ours_not_fund": sorted(ours - theirs)[:40], "fund_not_ours": sorted(theirs - ours)[:40]}
count = lambda tag: len(by(tag))
out = {
    "what": "TR2: growth, momentum and low volatility as mechanical tags on every company in the tree, and the three branch lists built from them. Generated by tools/factor_tags.py from local files; nothing here is written to any table.",
    "as_of": AS_OF, "window": {"sessions": N, "first": dates[-(N + 1)], "last": AS_OF, "closes_file_sessions": len(dates)},
    "rules": RULES, "fund_lines": FUND_LINES, "momentum_legs": ["6m", "12m"] if HAS_12M else ["6m"],
    "to_complete": {"momentum_12m": f"put a closes file of {N12 + 1} sessions or more at {rel(P_CLOSES)} (same shape: date, then one column a ticker) and re-run; the second leg joins by itself",
                    "growth_for_every_name": f"replace {rel(P_GROWTH)} with the same slice for every company (rows: ticker, rev_g in percent) and re-run; names with an estimate stop standing on the index maker's call",
                    "then": "node scripts/cohort-tree-revise.mjs --write, then node scripts/cohort-tree-revise-sql.mjs --write --pglite <dir>: the branch lists, the tags and the migration follow"},
    "measured_from": {"closes": rel(P_CLOSES), "tree": rel(P_PROPOSAL), "profiles": rel(P_PROFILE), "fund_holdings": rel(P_HOLD), "growth": rel(P_GROWTH),
                      "growth_source": growth_src.get("source"), "holdings_dates": "26 and 28 Sep 2026"},
    "market": {"ticker": RULES["market"], "usual_day_pct": spy["usual_day_pct"], "ret_126_pct": spy["ret_126_pct"]},
    "counts": {"companies": len(companies), "ranked_full_window": len(ranked), "short_history": sum(1 for t in companies if not M[t].get("full_window") and t not in RETIRING),
               "stopped_trading": sorted(t for t in companies if t in RETIRING),
               "growth_estimate_on_file": sum(1 for o in names if o.get("growth_basis") == "estimate"),
               "growth_by_index_maker": sum(1 for o in names if (o.get("growth_basis") or "").startswith("index maker")),
               "growth_not_classified": sum(1 for o in names if o.get("growth_basis") is None and o["ticker"] not in RETIRING),
               "tags": {k: count(k) for k in ["GROWTH", "VALUE", "SLOW GROWTH", "MOMENTUM", "LAGGING", "LOW VOLATILITY", "HIGH VOLATILITY", "QUALITY (QUAL holds it)"]},
               "momentum_and_growth": len({o["ticker"] for o in by("MOMENTUM")} & {o["ticker"] for o in by("GROWTH")}),
               "low_vol_and_quality": len({o["ticker"] for o in by("LOW VOLATILITY")} & {o["ticker"] for o in by("QUALITY (QUAL holds it)")})},
    "agreement_with_the_funds": {"momentum_vs_MTUM": agree("MOMENTUM", "MTUM"), "low_volatility_vs_SPLV": agree("LOW VOLATILITY", "SPLV"),
                                 "growth_vs_VUG": agree("GROWTH", "VUG"), "low_volatility_vs_QUAL": agree("LOW VOLATILITY", "QUAL")},
    "blue_chip_answer": None,
    "honest_notes": [
        ("Momentum is both legs: six and twelve months, the average of the two ranks." if HAS_12M else f"Momentum is the six-month leg only: the closes file on this Mac is {len(dates)} sessions long. The 12-month leg joins by itself when the file is {N12 + 1} sessions or longer (tried on a made-up longer file; see to_complete).") + " MTUM itself blends 6 and 12 months and divides by volatility, which is why it and our list differ.",
        f"Growth is measured for {sum(1 for o in names if o.get('growth_basis') == 'estimate')} names (the analyst estimates the workshop-queue lane read on 6 Oct); for the rest the index maker's VUG / VTV side stands in, and each row says which. The full read is one query for the coordinator.",
        "One half-year is one regime: a name that is calm or strong now is not calm or strong for ever. The lists need a refresh date; MSCI rebuilds MTUM twice a year and S&P rebuilds SPLV four times.",
        "A name can carry more than one tag, and most carry none: the middle three fifths of a rank are not tagged.",
    ],
    "branches": branches, "names": names,
}
lv = {o["ticker"] for o in by("LOW VOLATILITY")}; ql = {o["ticker"] for o in names if "QUAL" in o["held_by"]}; sp = {o["ticker"] for o in names if "SPLV" in o["held_by"]}
out["blue_chip_answer"] = {
    "plain": "Low volatility means the price moves little from day to day. 'Blue chip' is closer to what index makers call QUALITY: steady profits, little debt. They overlap but are not the same list.",
    "low_volatility_names": len(lv), "of_them_held_by_QUAL": len(lv & ql), "of_them_held_by_SPLV": len(lv & sp),
    "QUAL_holds_of_our_companies": len(ql), "of_them_low_volatility": len(ql & lv),
    "calm_but_not_quality": sorted(lv - ql)[:25], "quality_but_not_calm": sorted(ql - lv)[:25],
}
with open(os.path.join(WRITE_DIR, "factor-tags.json"), "w") as fh:
    json.dump(out, fh, indent=1); fh.write("\n")
print("wrote", rel(os.path.join(WRITE_DIR, "factor-tags.json")))
print(json.dumps(out["counts"], indent=1)); print("market", out["market"])
for k, v in out["agreement_with_the_funds"].items(): print(k, {a: b for a, b in v.items() if isinstance(b, int)})
print("blue chip", {a: b for a, b in out["blue_chip_answer"].items() if isinstance(b, int)})
for k, v in branches.items(): print(k, len(v), "|", " ".join(r["ticker"] for r in v[:28]))
