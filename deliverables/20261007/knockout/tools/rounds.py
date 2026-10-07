# KO1 · THE ELIMINATION ROUNDS — pure rules, no reads. Used by tools/knockout.py and pinned by tests/ko1-knockout.test.mjs
# (through tools/rounds-cli.py). Every number a rule uses is named here, once.
#
# ROUND 1  WHERE THE MONEY SHOULD LOOK. Every branch of the tree is kept and ranked by its own heat and its trend:
#          the allocation tool's own rule — coldness × the turn — with coldness measured on the branch's OWN year
#          (1 − its percentile) instead of on one scale for every branch. The turn is the tool's: a bounce in a downtrend
#          ×1.35, an uptrend confirmed ×1, a pullback in an uptrend ×0.85, a breakdown ×0.6.
# ROUND 2  FUNDAMENTALS FIRST, INSIDE A BRANCH, NEVER ACROSS. Five readings, each read against the branch's own middle
#          half the way the knockout already does (0 at the branch's 25th, 1 at its 75th, a missing reading 0.5), then
#          weighed with growth the largest: growth next year 25, growth the year after 15, comps 30, revisions 15, cash 15.
#          A comps number that is thin OR fragile counts at half strength; one that is both, or that the comps system
#          itself withholds, or that belongs to a company with no earnings, is not used. A name passes when it stands in
#          the upper half of its branch (the middle name included) after the tie rule below. A name with fewer than three
#          of the five readings, or with sales under 1% of its market value, is NOT JUDGED: listed, never ranked.
# ROUND 3  TIMING. Never eliminates a company: it says now or wait. Above the 70th percentile of its own year = wait.
# FINALISTS the top three of a branch among those that passed round 2; within 0.02 of each other the one more washed out
#          for itself goes first (the knockout's own tie rule).
#
# CP3 (7 Oct) · DEBT AT THE DEBATE LEVEL. Alan: "are you considering debt levels in your comps eliminations? Once you reach
#          a level when you're debating things, debt should matter." Debt never decides who PASSES round 2. Among the
#          names that passed — the ones being debated for the three finalist places — leverage takes points off the score
#          they are ranked on, and the 0.02 tie rule is then read on that score. The reading is net debt ÷ EBITDA of the
#          last twelve months (the comps table's own figure): up to 2.5× nothing, 2.5–4× 0.03, 4–6× 0.06, above 6× 0.10;
#          net debt with no positive EBITDA to carry it 0.10; net cash nothing. A bank, insurer or asset manager is not
#          read (its debt is its raw material). The scale is absolute, but a name is only ever ranked inside its own
#          branch, so a branch where everyone borrows (landlords, utilities) is reordered only by who borrows MORE.
#          Interest cover is not in the rule yet: the statements on file carry no interest line (see debt_penalty).
#          Off unless asked (score_branch(…, debt=True)): the knockout as first published is reproduced without it.
DEBT_STEPS = ((2.5, 0.0), (4.0, 0.03), (6.0, 0.06)); DEBT_TOP = 0.10
def debt_penalty(nd_ebitda=None, net_debt=None, ebitda=None, exempt=False, interest_cover=None):
    """Points off a debated name's score for leverage, and the words for its row. Returns (points, words)."""
    if exempt: return 0.0, "a financial company: its debt is its raw material, not read"
    if net_debt is not None and net_debt <= 0: return 0.0, "net cash"
    if nd_ebitda is None:
        if net_debt is not None and net_debt > 0 and ebitda is not None and ebitda <= 0: return DEBT_TOP, "net debt with no positive EBITDA to carry it"
        return 0.0, "no debt reading on file"
    if nd_ebitda <= 0: return 0.0, "net cash"
    pts = DEBT_TOP
    for top, p in DEBT_STEPS:
        if nd_ebitda <= top: pts = p; break
    if interest_cover is not None and interest_cover < 2: pts = max(pts, DEBT_TOP if interest_cover < 1 else 0.06)   # used the day the statements carry interest
    return pts, f"net debt {nd_ebitda:.1f}× EBITDA" + ("" if pts == 0 else f": {pts:.2f} off in the debate")
WEIGHTS = {"growth_next": 25, "growth_after": 15, "comps": 30, "revisions": 15, "cash": 15}          # percent of the vote
TURN = {"improve": 1.35, "go": 1.0, "buy": 0.85, "avoid": 0.6, "none": 1.0}                            # the allocation tool's own
COLD_FLOOR = 0.05; EVEN = 0.02; HOT = 70.0; COLD = 30.0; TOP = 3
MIN_READINGS = 3                                                                                      # a majority of the five: with fewer a name is not judged
REGION_OR_SIZE = ("MAG7", "CHINA", "EUROPE", "ASIA_PACIFIC", "CANADA", "LATAM")                        # clubs by place or size, not by business
def quartiles(values):
    """25th, 50th and 75th of a list by straight-line interpolation (numpy's default, the knockout's own)."""
    v = sorted(x for x in values if x is not None)
    if not v: return None
    def q(p):
        i = (len(v) - 1) * p; lo = int(i); hi = min(lo + 1, len(v) - 1)
        return v[lo] + (v[hi] - v[lo]) * (i - lo)
    return {"n": len(v), "q1": q(0.25), "med": q(0.5), "q3": q(0.75)}
def ramp(v, d, lower_is_better=False):
    """0 at the field's 25th, 1 at its 75th, straight between; None when the reading or the field is missing."""
    if v is None or d is None or d["n"] < 2: return None
    if d["q3"] <= d["q1"]: return 0.5
    t = max(0.0, min(1.0, (v - d["q1"]) / (d["q3"] - d["q1"])))
    return 1 - t if lower_is_better else t
def comps_use(a):
    """How a company's comps number may be used. a: its record from the comps run plus eps_ttm / eps_fy1.
    Returns (strength 1 | 0.5 | 0, the words that go on the row)."""
    if not a or not a.get("ok"): return 0, "the comps reader could not read it"
    if a.get("no_peer_set"): return 0, "no peer set: priced far from its own group, so the comps system withholds a number"
    if not a.get("band"): return 0, "cannot be priced: " + (a.get("reason") or "no measure carries figures")
    no_earnings = not ((a.get("eps_ttm") or 0) > 0) and not ((a.get("eps_fy1") or 0) > 0)
    if no_earnings: return 0, "no earnings, trailing or expected: ranked on growth, revisions and cash, not on multiples"
    thin, fragile = bool(a.get("thin")), bool(a.get("fragile"))
    if thin and fragile: return 0, f"thin ({a.get('n_behind')} peers with figures) and fragile: not a number to lean on"
    if thin: return 0.5, f"thin: {a.get('n_behind')} peers with figures"
    if fragile: return 0.5, f"fragile: the centre moves more than 10% when one of {a['fragile']['n']} peers is taken out"
    return 1, ""
def score_branch(members, debt=False):
    """members: [{t, g1_rev, g1_eps, g2_rev, g2_eps, comps, comps_strength, revisions, cash, pctl}]. Returns the same rows with
    `parts` (each reading's 0…1), `score`, `n` readings, `judged`, `rank`, `passes` (upper half), and the branch's fields."""
    cols = ["g1_rev", "g1_eps", "g2_rev", "g2_eps", "revisions", "cash"]
    field = {c: quartiles([m.get(c) for m in members]) for c in cols}
    field["comps"] = quartiles([m.get("comps") for m in members if (m.get("comps_strength") or 0) > 0])
    avg = lambda xs: (sum(xs) / len(xs)) if xs else None
    out = []
    for m in members:
        p = {}
        p["growth_next"] = avg([x for x in (ramp(m.get("g1_rev"), field["g1_rev"]), ramp(m.get("g1_eps"), field["g1_eps"])) if x is not None])
        p["growth_after"] = avg([x for x in (ramp(m.get("g2_rev"), field["g2_rev"]), ramp(m.get("g2_eps"), field["g2_eps"])) if x is not None])
        st = m.get("comps_strength") or 0; c = ramp(m.get("comps"), field["comps"]) if st > 0 else None
        p["comps"] = None if c is None else 0.5 + (c - 0.5) * st                                          # half strength pulls it halfway to the middle
        p["revisions"] = ramp(m.get("revisions"), field["revisions"]); p["cash"] = ramp(m.get("cash"), field["cash"])
        n = sum(1 for v in p.values() if v is not None)
        score = sum(WEIGHTS[k] * (0.5 if p[k] is None else p[k]) for k in WEIGHTS) / 100.0
        # a company whose sales are under 1% of its market value is priced on what it may become: nothing here can rank it
        out.append({**m, "parts": p, "score": score, "n": n, "judged": n >= MIN_READINGS and not m.get("venture")})
    judged = [r for r in out if r["judged"]]
    med = quartiles([r["score"] for r in judged]); cut = med["med"] if med else None
    order = sorted(judged, key=lambda r: (-r["score"], r["t"]))
    i = 0
    while i < len(order) - 1:                                                                               # one pass, top down: even on fundamentals → the more washed out goes first
        a, b = order[i], order[i + 1]
        if a["score"] - b["score"] < EVEN and a.get("pctl") is not None and b.get("pctl") is not None and b["pctl"] < a["pctl"]: order[i], order[i + 1] = b, a
        i += 1
    half = (len(order) + 1) // 2                                                                            # the upper half, the middle name included
    for k, r in enumerate(order): r["rank"] = k + 1; r["passes"] = k < half
    debt_moved = []
    if debt:                                                                                                # CP3: the debate among those that passed
        passed = [r for r in order if r["passes"]]; was = [r["t"] for r in passed]
        for r in passed:
            pts, words = debt_penalty(r.get("nd_ebitda"), r.get("net_debt"), r.get("ebitda_ttm"), bool(r.get("financial")))
            r["debt_penalty"] = pts; r["debt_words"] = words; r["debate"] = r["score"] - pts
        passed.sort(key=lambda r: (-r["debate"], r["t"]))
        i = 0
        while i < len(passed) - 1:                                                                          # the same tie rule, on the debated score
            a, b = passed[i], passed[i + 1]
            if a["debate"] - b["debate"] < EVEN and a.get("pctl") is not None and b.get("pctl") is not None and b["pctl"] < a["pctl"]: passed[i], passed[i + 1] = b, a
            i += 1
        order = passed + [r for r in order if not r["passes"]]
        for k, r in enumerate(order): r["rank_before_debt"] = r["rank"]; r["rank"] = k + 1
        debt_moved = [r["t"] for k, r in enumerate(passed) if was[k] != r["t"]]
    for r in out:
        if not r["judged"]: r["rank"] = None; r["passes"] = False
    return {"rows": out, "order": [r["t"] for r in order], "cut": cut, "field": field, "judged": len(judged), "finalists": [r["t"] for r in order if r["passes"]][:TOP], "debt_moved": debt_moved}
def round1_rank(branches):
    """branches: [{id, pctl (own-year percentile of its heat, or None), kind (the allocation tool's read of trend × momentum)}].
    Adds coldness, turn, raw and rank (1 = where the money should look first). A branch with no percentile is ranked last
    among its equals on a neutral 0.5 and says so."""
    for b in branches:
        b["coldness"] = max(COLD_FLOOR, 1 - b["pctl"] / 100.0) if b.get("pctl") is not None else 0.5
        b["turn"] = TURN.get(b.get("kind") or "none", 1.0); b["raw"] = b["coldness"] * b["turn"]
    for k, b in enumerate(sorted(branches, key=lambda b: (-b["raw"], b["id"]))): b["rank"] = k + 1
    return branches
def timing_word(pctl):
    if pctl is None: return "no place in its own year yet"
    return "hot for itself: wait" if pctl > HOT else "washed out for itself" if pctl < COLD else "in its usual range"
