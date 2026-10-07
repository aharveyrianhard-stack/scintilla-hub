# KO1 · lets the Hub's tests (node) call the pure rules of the knockout: one JSON object in on stdin
# ({"calls": [[name, [args…]], …]}), one JSON list out. No reads, no network.
import json, sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import rounds as R, fundamentals as F
def _timing():
    import timing as T
    return T
FN = {
    "weights": lambda: R.WEIGHTS, "turn": lambda: R.TURN, "consts": lambda: {"even": R.EVEN, "hot": R.HOT, "cold": R.COLD, "top": R.TOP, "min_readings": R.MIN_READINGS, "region_or_size": list(R.REGION_OR_SIZE)},
    "quartiles": R.quartiles, "ramp": lambda v, d, lower=False: R.ramp(v, d, lower), "comps_use": lambda a: list(R.comps_use(a)), "score_branch": R.score_branch,
    "round1_rank": R.round1_rank, "timing_word": R.timing_word,
    "rule": lambda: F.RULE, "usual_pass_through": F.usual_pass_through, "one_off_quarter": lambda q, usual: list(F.one_off_quarter(q, usual)), "year_one_offs": F.year_one_offs,
    "dip_year": F.dip_year, "base_ok": lambda parts, base, sps: list(F.base_ok([tuple(p) for p in parts], base, sps)), "calendarize": lambda a, e1, e2, e3, w: list(F.calendarize(a, e1, e2, e3, w)), "growth": F.growth,
    "zones_of": lambda levels: _timing().zones_of(levels), "pctl_of": lambda s, v: _timing().pctl_of(s, v), "read_of": lambda t, m: _timing().read_of(t, m),
}
def clean(x):
    if isinstance(x, float): return None if (math.isnan(x) or math.isinf(x)) else x
    if isinstance(x, dict): return {k: clean(v) for k, v in x.items()}
    if isinstance(x, (list, tuple)): return [clean(v) for v in x]
    return x
calls = json.load(sys.stdin)["calls"]
print(json.dumps(clean([FN[name](*args) for name, args in calls])))
