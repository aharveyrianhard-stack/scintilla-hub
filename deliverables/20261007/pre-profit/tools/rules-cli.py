# PP1 · lets the Hub's tests (node) call the pure rules of the pre-profit model and of the debt reading, together with the
# knockout's own round-2 rule they lean on: one JSON object in on stdin ({"calls": [[name, [args…]], …]}), one JSON list
# out. No reads, no network.
import json, sys, os, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
sys.path.insert(0, os.path.abspath(os.path.join(HERE, "../../knockout/tools")))
import model as M, rounds as R, capex_calls as X
def branch(rows, loads, max_cut=None, wide=False):
    """The knockout's own round 2 for one branch, then the debate on top of it."""
    S = R.score_branch(rows); D = M.debate(S["rows"], loads, **({} if max_cut is None else {"max_cut": max_cut}), wide=wide)
    return {"ko": {"order": S["order"], "finalists": S["finalists"], "passes": [r["t"] for r in S["rows"] if r["passes"]]}, "debate": D}
FN = {
    "consts": lambda: {"weights": M.WEIGHTS, "sub": M.SUB, "promise": list(M.PROMISE), "footing": list(M.FOOTING), "gate": M.GROWTH_GATE, "dollar_floor": M.DOLLAR_FLOOR, "venture_share": M.VENTURE_SHARE, "thin": M.THIN_ANALYSTS,
                       "bands": M.BANDS, "max_cut": M.MAX_CUT, "even": M.EVEN, "load_even": M.LOAD_EVEN, "top": M.TOP, "not_read": list(M.NOT_READ), "missing_class": M.MISSING_CLASS, "runway_cap": M.RUNWAY_CAP,
                       "ko_weights": R.WEIGHTS, "ko_even": R.EVEN, "ko_top": R.TOP},
    "classify": lambda q, fy, venture=False, eps=None, g=None: M.classify(q, fy, venture, eps, g), "shares_pick": M.shares_pick, "runway": M.runway, "funding_gap": M.funding_gap, "financing_mix": M.financing_mix,
    "split_factor": lambda s, forward=False: M.split_factor(s, forward), "share_change": M.share_change, "leverage": lambda nd, e, i, s=None, fam=None, pre=False: M.leverage(nd, e, i, s, fam, pre), "band": M.band, "spread": M.spread,
    "growth_part": lambda a, b, c: M.growth_part(a, b, c), "calendarize": lambda a, e1, e2, e3, w: list(M.calendarize(a, e1, e2, e3, w)), "growth": M.growth, "total4": M.total4,
    "score_shelf": lambda rows: (lambda S: {"order": S["order"], "rows": {r["t"]: {"score": r["score"], "rank": r["rank"], "ranked": r["ranked"], "thin": r["thin"], "parts": r["parts"], "sub": r["sub"], "promise": r["promise"], "footing": r["footing"]} for r in S["rows"]}})(M.score_shelf(rows)),
    "debate": lambda rows, loads, max_cut=None, wide=False: M.debate(rows, loads, **({} if max_cut is None else {"max_cut": max_cut}), wide=wide), "branch": branch,
    "branches": lambda many, loads, max_cut=None, wide=False: {c: (lambda b: {"ko": b["ko"], "order": b["debate"]["order"], "finalists": b["debate"]["finalists"], "champion": b["debate"]["champion"], "passes": b["debate"]["passes"]})(branch(rows, loads, max_cut, wide)) for c, rows in many.items()},
    "read_call": lambda text: X.read_call(text), "amounts": lambda s: [list(a) for a in X.amounts(s)],
}
def clean(x):
    if isinstance(x, float): return None if (math.isnan(x) or math.isinf(x)) else x
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [clean(v) for v in x]
    return x
calls = json.load(sys.stdin)["calls"]
print(json.dumps(clean([FN[name](*args) for name, args in calls])))
