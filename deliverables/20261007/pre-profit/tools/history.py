# PP1 · THE TEST ON HISTORY. For each of four Octobers (five, four, three and two years ago) take the companies of today's
# universe that were pre-profit and growing THEN, on the figures that had been FILED by that day, measure the model's
# parts as they stood, and ask which of them told the later winners from the losers (the price two years on, and today).
#
# WHAT CAN AND CANNOT BE TESTED
#   · The analysts' estimates as they stood on a past day are not on file anywhere we can read. So "growth next year" and
#     "EV ÷ next year's sales" are tested twice: on the TRAILING figure a reader had that day (honest), and on the sales the
#     company went on to report over the next four quarters (FORESIGHT: what a perfect forecast would have shown).
#     How far apart the analysts stood cannot be tested at all.
#   · Only companies that are still listed and in today's universe are here. The ones that ran out of money are missing,
#     so the test UNDERSTATES how much cash, dilution and debt matter, and flatters every reading.
#   · Prices are the chart API's split-adjusted weekly closes; share counts are as filed, put on today's footing where a
#     quarter's count falls by a clean reverse-split ratio. Companies that report in another currency are left out.
# Reads fmp-statements.json and the weekly bars (KO1_BARS). No network. Writes history.json in the scratch folder.
#   Run from the scratch folder:   KO1_BARS=<the knockout's bars folder> python3 <this file>
import json, os, sys, math, datetime as dt, collections
import numpy as np
from scipy.stats import spearmanr
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
import model as M
BARS = os.environ.get("KO1_BARS", "bars"); TODAY = os.environ.get("PP1_TODAY", "2026-10-06")
T_DATES = ["2021-10-06", "2022-10-06", "2023-10-06", "2024-10-06"]
GATE = M.GROWTH_GATE; LAG = 75
P = lambda s: dt.date.fromisoformat(str(s)[:10]); days = lambda a, b: (P(b) - P(a)).days
split_factor = M.split_factor                                                   # the rule is in model.py
def weekly(t):
    p = os.path.join(BARS, t + ".npz")
    if not os.path.exists(p): return None
    try: a = np.load(p)["tf_W"]
    except Exception: return None
    if a.ndim != 2 or not len(a): return None
    ts = a[:, 0] / (1000.0 if a[0, 0] > 1e11 else 1.0)
    return [(dt.datetime.utcfromtimestamp(x).date().isoformat(), float(c)) for x, c in zip(ts, a[:, 4])]
def close_before(w, day):
    """The close of the last whole week that ended before `day` (a bar is stamped with the Sunday it opens on)."""
    cut = (P(day) - dt.timedelta(days=7)).isoformat(); hit = [c for d, c in w if d <= cut]
    first = w[0][0]
    return hit[-1] if hit and first <= cut else None
def tab(n, k):
    c = n[k]["cols"]; return sorted([dict(zip(c, r)) for r in n[k]["rows"]], key=lambda r: r["date"], reverse=True)
def panel(F):
    rows = []; skipped = collections.Counter()
    for t, n in sorted(F.items()):
        if not n["income"]["rows"]: continue
        inc, bal, cf = tab(n, "income"), tab(n, "balance"), tab(n, "cashflow")
        if (inc[0].get("ccy") or "USD") != "USD": skipped["reports in another currency"] += 1; continue
        w = weekly(t)
        if not w: skipped["no weekly bars"] += 1; continue
        avail = lambda r: r.get("filed") if (r.get("filed") and r["filed"] >= r["date"]) else (P(r["date"]) + dt.timedelta(days=LAG)).isoformat()
        now_px = w[-1][1]
        for T in T_DATES:
            I = [r for r in inc if avail(r) <= T]; Bq = [r for r in bal if avail(r) <= T]; Cq = [r for r in cf if avail(r) <= T]
            if len(I) < 8 or not Bq or len(Cq) < 4: continue
            if days(I[0]["date"], T) > 200: continue                                   # its newest filed quarter is stale
            px = close_before(w, T)
            if px is None or px <= 0: continue
            rev4, rev4b = M.total4(I, "revenue"), M.total4(I, "revenue", 4); oi4, ni4 = M.total4(I, "operating_income"), M.total4(I, "net_income")
            if oi4 is None or ni4 is None or rev4 is None: continue
            if not (oi4 <= 0 or ni4 <= 0): continue                                    # it made a profit then: not pre-profit
            newer = [r for r in inc if r["date"] > I[0]["date"]]                         # the quarters it went on to report
            chain = [I[0].get("shares")] + [r.get("shares") for r in sorted(newer, key=lambda r: r["date"])]
            sh = I[0].get("shares")
            if not sh: continue
            sh_today = sh * split_factor(chain)
            mv = px * sh_today; b = Bq[0]
            cash = b.get("cash_sti") if b.get("cash_sti") is not None else ((b.get("cash") or 0.0) + (b.get("sti") or 0.0))
            debt = b.get("total_debt") or 0.0; nd = debt - cash; ev = mv + nd
            venture = rev4 <= 0 or (mv > 0 and rev4 / mv < M.VENTURE_SHARE)
            g = M.growth(rev4, rev4b)
            if not venture and (g is None or g < GATE): continue                        # the shelf's own gate, on the trailing figure
            fcf = [None if r.get("operating_cf") is None else r["operating_cf"] - abs(r.get("capex") or 0.0) for r in Cq[:4]]
            run = M.runway(cash, fcf); cap4 = sum(abs(r.get("capex") or 0.0) for r in Cq[:4]); cap_last = abs(Cq[0].get("capex") or 0.0)
            gap = M.funding_gap(max(cap4, 4 * cap_last), b.get("short_debt"), M.total4(Cq, "operating_cf"), cash, mv)
            gp4, gp4b = M.total4(I, "gross_profit"), M.total4(I, "gross_profit", 4)
            ok = lambda rv: rv is not None and rv >= M.MARGIN_MIN_SALES
            gm = gp4 / rev4 * 100 if ok(rev4) and gp4 is not None else None; gmb = gp4b / rev4b * 100 if ok(rev4b) and gp4b is not None else None
            s1 = None
            if len(I) > 4 and I[4].get("shares") and 340 <= days(I[4]["date"], I[0]["date"]) <= 390:
                s1 = M.share_change(sh, I[4]["shares"] * split_factor([I[4]["shares"]] + [r.get("shares") for r in I[3::-1]]))
            nxt = sorted(newer, key=lambda r: r["date"])[:4]
            next4 = sum(r["revenue"] for r in nxt) if len(nxt) == 4 and all(r.get("revenue") is not None for r in nxt) else None
            later = lambda d_: close_before(w, (P(T) + dt.timedelta(days=d_)).isoformat()) if (P(T) + dt.timedelta(days=d_)).isoformat() <= TODAY else None
            p1, p2 = later(365), later(730)
            rows.append({"t": t, "T": T, "venture": venture, "g": g, "sales": rev4, "ev_sales": ev / rev4 if rev4 > 0 and ev > 0 else None, "gm": gm, "gm_change": None if gm is None or gmb is None else gm - gmb,
                         "burning": None if run["burn_q"] is None else run["burn_q"] > 0, "runway_q": run["quarters"], "gap_pct": gap["pct_of_value"], "shares_1y": s1, "nd_sales": nd / rev4 if rev4 > 0 else None, "net_debt": nd,
                         "g_real": M.growth(next4, rev4), "ev_sales_real": ev / next4 if next4 and next4 > 0 and ev > 0 else None, "mv": mv,
                         "r1": None if p1 is None else (p1 / px - 1) * 100, "r2": None if p2 is None else (p2 / px - 1) * 100, "r_now": (now_px / px - 1) * 100})
    return rows, dict(skipped)
lg = lambda v: None if v is None or v <= 0 else math.log10(v)
def parts_of(cohort, foresight=False):
    """The model's parts for one October's cohort, read against that cohort's own middle half — the shelf's rule, with the
    trailing figure (or, with foresight, the sales it went on to report) standing where the analysts' figure stands today."""
    gk, ek = ("g_real", "ev_sales_real") if foresight else ("g", "ev_sales")
    F = {"g": M.quartiles([r[gk] for r in cohort if not r["venture"]]), "sales": M.quartiles([lg(r["sales"]) for r in cohort]), "ev": M.quartiles([lg(r[ek]) for r in cohort]), "gm": M.quartiles([r["gm"] for r in cohort]), "gmc": M.quartiles([r["gm_change"] for r in cohort]),
         "run": M.quartiles([r["runway_q"] for r in cohort if r["burning"]]), "gap": M.quartiles([r["gap_pct"] for r in cohort if (r["gap_pct"] or 0) > 0]), "s1": M.quartiles([r["shares_1y"] for r in cohort]), "nd": M.quartiles([r["nd_sales"] for r in cohort if (r["nd_sales"] or 0) > 0])}
    avg = lambda pairs: (sum(w * v for w, v in pairs if v is not None) / sum(w for w, v in pairs if v is not None)) if any(v is not None for _, v in pairs) else None
    out = []
    for r in cohort:
        rate = M.ramp(r[gk], F["g"]); scale = M.ramp(lg(r["sales"]), F["sales"])
        p = {"rate": rate, "scale": scale, "growth": M.growth_part(rate, None, scale),
             "price": M.ramp(lg(r[ek]), F["ev"], True), "margin": avg([(M.SUB["margin"]["level"], M.ramp(r["gm"], F["gm"])), (M.SUB["margin"]["change"], M.ramp(r["gm_change"], F["gmc"]))]),
             "runway": 1.0 if r["burning"] is False else M.ramp(r["runway_q"], F["run"]) if r["burning"] else None, "gap": M.none_is_good(r["gap_pct"], F["gap"], r["gap_pct"] is not None),
             "dilution": M.ramp(r["shares_1y"], F["s1"], True), "debt": 1.0 if r["net_debt"] <= 0 else M.none_is_good(r["nd_sales"], F["nd"], r["nd_sales"] is not None)}
        p["money"] = avg([(M.SUB["money"]["runway"], p["runway"]), (M.SUB["money"]["gap"], p["gap"])])
        out.append({**r, "p": p})
    return out
def rho(xs, ys):
    pairs = [(x, y) for x, y in zip(xs, ys) if x is not None and y is not None]
    if len(pairs) < 8: return None, len(pairs)
    a, b = zip(*pairs)
    if len(set(a)) < 3: return None, len(pairs)
    return float(spearmanr(a, b).correlation), len(pairs)
def thirds(scored, key):
    """Median outcome of the top third and of the bottom third by score."""
    s = sorted([r for r in scored if r.get("score") is not None and r.get(key) is not None], key=lambda r: -r["score"]); k = len(s) // 3
    if k < 3: return None
    med = lambda v: float(np.median(v))
    return {"n": len(s), "top": med([r[key] for r in s[:k]]), "bottom": med([r[key] for r in s[-k:]]), "all": med([r[key] for r in s])}
SCHEMES = {"the model's weights": {k: v for k, v in M.WEIGHTS.items() if k != "quality"}, "every part equal": {k: 1 for k in M.WEIGHTS if k != "quality"},
           "growth alone": {"growth": 1}, "price alone": {"price": 1}, "cash, dilution and debt alone": {"money": 1, "dilution": 1, "debt": 1}}
def score(rows, weights):
    for r in rows:
        tot = sum(weights.values()); r["score"] = sum(w * (0.5 if r["p"].get(k) is None else r["p"][k]) for k, w in weights.items()) / tot
    return rows
if __name__ == "__main__":
    F = json.load(open("fmp-statements.json"))["names"]
    rows, skipped = panel(F)
    by = collections.defaultdict(list)
    for r in rows: by[r["T"]].append(r)
    READINGS = [("growth", "sales growth", "rate"), ("scale", "sales in dollars", "scale"), ("growth_part", "growth as the model reads it (rate, counted more where the dollars are real)", "growth"), ("price", "EV ÷ sales (cheaper = better)", "price"),
                ("margin", "gross margin, level and direction", "margin"), ("runway", "quarters of cash", "runway"), ("gap", "funding gap (smaller = better)", "gap"), ("dilution", "share count over the year before (less = better)", "dilution"), ("debt", "net debt ÷ sales (less = better)", "debt")]
    out = {"dates": T_DATES, "gate": GATE, "skipped": skipped, "cohorts": [], "readings": [], "schemes": [], "foresight": {"readings": [], "schemes": []}, "names": {}}
    P_ = {T: parts_of(by[T]) for T in T_DATES}; PF = {T: parts_of([r for r in by[T] if r["g_real"] is not None], True) for T in T_DATES}
    for T in T_DATES:
        c = by[T]; med = lambda k: (None if not [r[k] for r in c if r[k] is not None] else round(float(np.median([r[k] for r in c if r[k] is not None])), 1))
        out["cohorts"].append({"T": T, "n": len(c), "venture": sum(1 for r in c if r["venture"]), "median_r1": med("r1"), "median_r2": med("r2"), "median_r_now": med("r_now"), "with_r2": sum(1 for r in c if r["r2"] is not None)})
    def table(PP, outcome):
        res = []
        for key, words, pk in READINGS:
            per = []
            for T in T_DATES:
                r_, n_ = rho([x["p"][pk] for x in PP[T]], [x[outcome] for x in PP[T]]); per.append({"T": T, "rho": None if r_ is None else round(r_, 2), "n": n_})
            ok = [(x["rho"], x["n"]) for x in per if x["rho"] is not None]
            res.append({"key": key, "words": words, "per": per, "avg": None if not ok else round(sum(r_ * n_ for r_, n_ in ok) / sum(n_ for _, n_ in ok), 2), "n": sum(n_ for _, n_ in ok), "positive_in": sum(1 for r_, _ in ok if r_ > 0), "of": len(ok)})
        return res
    def schemes(PP, outcome):
        res = []
        for name, wts in SCHEMES.items():
            per = []
            for T in T_DATES:
                s = score([dict(x) for x in PP[T]], wts); r_, n_ = rho([x["score"] for x in s], [x[outcome] for x in s]); th = thirds(s, outcome)
                per.append({"T": T, "rho": None if r_ is None else round(r_, 2), "n": n_, "top": None if not th else round(th["top"], 1), "bottom": None if not th else round(th["bottom"], 1), "all": None if not th else round(th["all"], 1)})
            ok = [(x["rho"], x["n"]) for x in per if x["rho"] is not None]
            res.append({"name": name, "weights": wts, "per": per, "avg": None if not ok else round(sum(r_ * n_ for r_, n_ in ok) / sum(n_ for _, n_ in ok), 2), "top_beat_bottom_in": sum(1 for x in per if x["top"] is not None and x["top"] > x["bottom"]), "of": sum(1 for x in per if x["top"] is not None)})
        return res
    out["readings"] = table(P_, "r2"); out["readings_to_date"] = table(P_, "r_now"); out["schemes"] = schemes(P_, "r2"); out["schemes_to_date"] = schemes(P_, "r_now")
    out["foresight"]["readings"] = table(PF, "r2"); out["foresight"]["schemes"] = schemes(PF, "r2")
    for T in T_DATES:                                                             # the names, so the test can be checked by eye
        s = sorted(score([dict(x) for x in P_[T]], SCHEMES["the model's weights"]), key=lambda r: -r["score"])
        out["names"][T] = [{"t": r["t"], "score": round(r["score"], 3), "g": None if r["g"] is None else round(r["g"]), "sales": round(r["sales"]), "ev_sales": None if r["ev_sales"] is None else round(r["ev_sales"], 1),
                            "r1": None if r["r1"] is None else round(r["r1"]), "r2": None if r["r2"] is None else round(r["r2"]), "r_now": round(r["r_now"]), "venture": r["venture"]} for r in s]
    json.dump(out, open("history.json", "w"), indent=1)
    print("panel rows", len(rows), "· skipped", skipped)
    for c in out["cohorts"]: print("  ", c)
    for label, tb in (("TWO YEARS ON", out["readings"]), ("TO TODAY", out["readings_to_date"]), ("FORESIGHT, two years on", out["foresight"]["readings"])):
        print("\n" + label + " · rank correlation of each reading with the later price move, by October")
        for r in tb: print(f"  {r['words'][:60]:60s} " + " ".join(f"{(x['rho'] if x['rho'] is not None else float('nan')):+.2f}({x['n']:2d})" for x in r["per"]) + f"  avg {r['avg'] if r['avg'] is not None else float('nan'):+.2f}  positive in {r['positive_in']}/{r['of']}")
    for label, tb in (("TWO YEARS ON", out["schemes"]), ("TO TODAY", out["schemes_to_date"]), ("FORESIGHT", out["foresight"]["schemes"])):
        print("\n" + label + " · the score: rank correlation, and the median move of its top third against its bottom third")
        for r in tb: print(f"  {r['name'][:32]:32s} " + " ".join(f"{(x['rho'] if x['rho'] is not None else float('nan')):+.2f} [{x['top']}/{x['bottom']}]" for x in r["per"]) + f"  avg {r['avg']}  top beat bottom in {r['top_beat_bottom_in']}/{r['of']}")
