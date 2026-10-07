# PF1 · the two best-fit structures put together, and one synthesis Alan did not ask for.
#   A. Core + satellite with the core under the slow trend rule: structure 1's plumbing (index core, three 10% conviction slots,
#      a sold satellite goes back to the core) with structure 2's only reason to hold cash (SPY under its 200-day AND breadth
#      weak, on three closes running). When the rule says OUT the core waits in bills; satellites keep their own rules.
#   B. A floor under the July ladder: the allocation tool's own percent-invested, but applied only to the part ABOVE a fixed
#      index floor (50 / 60 / 70%). Two years only — that is all the ladder's replay covers.
# Written from scratch (it shares no code with s1_core_satellite.py or s2_trend_core.py), so with the trend rule switched off
# it doubles as a second independent check of structure 1's headline numbers.
import json, os
import numpy as np, pandas as pd
import pf1lib as L

D = L.load(); FIRST, LASTI = D.ix[L.FULL[0]], D.ix[L.FULL[1]]; N = len(D.dates)
CAND = L.SECTORS + ["SMH"]; SLOT, SLOTS, TOP_IN, TOP_KEEP, MIN_HIST = 0.10, 3, 3, 5, 252
ME = set(L.month_ends(D, *L.FULL)) - {D.dates[-1]}                    # the last bar on disk is not a month end
C = {s: D.c[s].values for s in CAND + ["SPY"]}; S50 = {s: L.sma(D.c[s], 50).values for s in CAND}
R63 = {s: L.trailing_tr(D, s, 63).values for s in CAND + ["SPY"]}; HIST = {s: D.c[s].notna().cumsum().values for s in CAND}

# the slow regime rule, exactly as structure 2 words it: OUT only when SPY's close is under its 200-day AND fewer than half the
# sector funds (each counted once it has 200 sessions) are above their own 200-day — and only after three closes in a row.
spy = D.c["SPY"]; below = (spy < L.sma(spy, 200)).values
s200 = D.c[L.SECTORS].rolling(200, min_periods=200).mean(); counted = s200.notna()
share = ((D.c[L.SECTORS] > s200) & counted).sum(axis=1) / counted.sum(axis=1).replace(0, np.nan); weak = (share < 0.5).values
raw_in = ~(below & weak)
def confirmed(raw, n=3):
    out = raw.copy(); s = bool(raw[FIRST]); run = 0
    for i in range(FIRST, N):
        run = run + 1 if bool(raw[i]) != s else 0
        if run >= n: s, run = (not s), 0
        out[i] = s
    return out
REGIME_IN = confirmed(raw_in, 3)


def run(filtered, name):
    held = []
    def decide(i, date, w):
        core_on = bool(REGIME_IN[i]) if filtered else True
        sell = [s for s in held if C[s][i] < S50[s][i]]; keep = [s for s in held if s not in sell]; add = []; month_end = date in ME
        if month_end:
            ok = [s for s in CAND if HIST[s][i] >= MIN_HIST and np.isfinite(R63[s][i])]; ranked = sorted(ok, key=lambda s: -R63[s][i]); rank = {s: k + 1 for k, s in enumerate(ranked)}
            drop = [s for s in keep if rank.get(s, 999) > TOP_KEEP or not C[s][i] > S50[s][i]]; sell += drop; keep = [s for s in keep if s not in drop]
            for s in ranked[:TOP_IN]:
                if len(keep) + len(add) >= SLOTS: break
                if s in keep or s in sell: continue
                if C[s][i] > S50[s][i] and R63[s][i] > R63["SPY"][i]: add.append(s)
        new = keep + add; tgt = {s: SLOT for s in new}
        if core_on: tgt["SPY"] = 1.0 - SLOT * len(new)
        flipped = core_on != (w.get("SPY", 0.0) > 0.005)
        if not sell and not add and not flipped:
            if not month_end: return None
            want = dict(tgt); want["CASH"] = 1.0 - sum(tgt.values())
            if max(abs(w.get(s, 0.0) - x) for s, x in want.items()) <= 0.03: return None
        held[:] = new; return tgt
    first = {"SPY": 1.0} if (not filtered or REGIME_IN[FIRST]) else {}
    return L.simulate(D, decide, *L.FULL, initial=first, name=name)


plain = L.report(run(False, "plain"), D, "check: core + satellite with the trend rule off")
both = L.report(run(True, "both"), D, "Core + satellite, the core under the slow trend rule (the two best-fit structures together)",
                "index core + up to three 10% sector satellites picked by recent strength; a sold satellite goes back to the core; the core waits in bills only while SPY is under its 200-day AND breadth is weak on three closes running")
both["key"] = "core_sat_filtered"
out = {"structure": "s7_combined", "title": "The two best-fit structures together, and a floor under the ladder", "variants": [both], "extras": {}, "caveats": [
    "The satellite picks are the same mechanical stand-in as in structure 1 (recent strength among sector funds), not the fundamentals knockout, whose picks have no stored history.",
    "The floor-under-the-ladder rows cover two years only and rest on HEAT1's replay of the ladder, which used 20 of the 21 voters and the default weights."],
    "rule_plain": ["Hold an index core (SPY). Up to three 10% slots hold the strongest sector funds of the last three months, bought at a month end only if above their own 50-day average and ahead of SPY.",
                   "A satellite that closes under its 50-day average is sold and its money goes back to the core.",
                   "The core is in SPY unless SPY has closed under its 200-day average AND fewer than half the sector funds are above theirs, on three closes in a row; then the core waits in Treasury bills until that reading has been gone for three closes.",
                   "Floor under the ladder: percent in SPY = floor + (100 − floor) × the July ladder's percent ÷ 100, the rest in bills."]}

# B · a floor under the July ladder (two years only)
R = json.load(open(os.path.join(L.DATA, "tool-replay.json"))); rung = pd.DataFrame(R["series"]).set_index("date")["heatRung"] / 100.0
for floor in (0.5, 0.6, 0.7):
    sim = L.from_exposure(D, (floor + (1 - floor) * rung).to_dict(), name=f"floor{int(floor * 100)}")
    r = L.report(sim, D, f"The July ladder with a {int(floor * 100)}% index floor under it (two years only)", "the ladder decides only the part above the floor"); r["full"] = None; r["curve_full"] = None; r["stress"] = {}
    r["key"] = f"ladder_floor_{int(floor * 100)}"; out["variants"].append(r)

S1 = json.load(open(os.path.join(L.DATA, "s1_core_satellite.json"))); h = S1["variants"][0]
chk = {f"{w}_{k}": {"s1": float(h[w][k]), "mine": float(plain[w][k])} for w, k in [("full", "cagr_pct"), ("full", "max_dd_pct"), ("last2", "total_return_pct"), ("last2", "max_dd_pct")]}
out["extras"]["check_against_structure_1"] = {"what": "this file's own from-scratch core + satellite (trend rule off) against structure 1's headline", "numbers": chk,
                                              "agree": all(abs(v["s1"] - v["mine"]) <= 0.15 for v in chk.values())}
out["extras"]["regime_out_share_pct"] = {"full": round(100 * (1 - REGIME_IN[FIRST:LASTI + 1].mean()), 1), "last2": round(100 * (1 - REGIME_IN[D.ix[L.LAST2[0]]:LASTI + 1].mean()), 1)}
L.save("s7_combined.json", out)
for v in [plain] + out["variants"]:
    f, l = v.get("full"), v["last2"]
    print(f"{v['label'][:70]:70s} " + (f"FULL {f['cagr_pct']:6.2f} dd {f['max_dd_pct']:6.1f} st {f['avg_stock_pct']:5.1f} " if f else " " * 36) + f"| L2 {l['total_return_pct']:6.1f} dd {l['max_dd_pct']:6.1f} st {l['avg_stock_pct']:5.1f} dec {l['decision_days_per_month']} | {v.get('stress')}")
print("check vs S1:", out["extras"]["check_against_structure_1"]); print("regime out share", out["extras"]["regime_out_share_pct"])
