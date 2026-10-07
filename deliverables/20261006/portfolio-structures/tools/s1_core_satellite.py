# PF1 · structure 1 — CORE-SATELLITE (Alan's idea): a long index core (SPY) plus a "conviction" satellite of up to three
# 10% positions. A satellite that is sold goes back into the core, not into cash. The real conviction picks would come
# from Alan's fundamentals knockout, which has no stored history, so a mechanical stand-in picks them: recent strength.
#
# THE RULE (every number it reads is known at that session's close; the order fills at the NEXT session's close):
#   * Month-end close: rank the candidates by their total return over the last 63 sessions (about three months).
#     A candidate QUALIFIES if it is in the top 3, its close is above its own 50-day simple average, and its 63-session
#     return beats SPY's. A satellite already held is KEPT if it is still in the top 5 and above its 50-day average.
#     Free slots are filled with qualifiers, best first; never more than three held.
#   * Every session: a held satellite that closes below its 50-day simple average is sold.
#   * Targets: 10% per held satellite; SPY = 100% minus 10% per satellite ("to_core"), or SPY fixed at 70% with every
#     empty slot in Treasury bills ("to_cash").
#   * A new target is sent only on a sale day, a month end where the set changes, or a month end where a holding is
#     more than 3 points off its target.
#   * Every variant starts 100% in SPY on 3 Jan 2005 (the cash versions move to their 70% core at the first month end,
#     when the 3-point test finds SPY 30 points over its target).
# Candidates A = the 11 sector funds + SMH (no hindsight; a fund joins once it has 252 sessions of history).
# Candidates B = L.LEADERS (HINDSIGHT: a list of today's winners; a name joins once it has 126 sessions of history).
import time
import numpy as np
import pf1lib as L

T0 = time.time()
D = L.load()
SLOT = 0.10
I0, I1 = D.ix[L.FULL[0]], D.ix[L.FULL[1]]
ME = set(L.month_ends(D, *L.FULL)) - {D.dates[-1]}        # the last bar on disk (5 Oct 2026) is not a month end
CAND_A = L.SECTORS + ["SMH"]; CAND_B = list(L.LEADERS); ALL = ["SPY"] + CAND_A + CAND_B
C = {s: D.c[s].values for s in ALL}                        # closes
R63 = {s: L.trailing_tr(D, s, 63).values for s in ALL}     # 63-session total return, known at each close
AVG = {"sma50": {s: L.sma(D.c[s], 50).values for s in ALL}, "ema21": {s: L.ema(D.c[s], 21).values for s in ALL}}
HIST = {s: D.c[s].notna().cumsum().values for s in ALL}    # sessions of history so far
TR = {s: D.tr[s].values for s in ALL}                      # total-return index (for scoring finished round trips only)
SPY_OFF_HIGH = (D.tr["SPY"] / D.tr["SPY"].cummax() - 1.0).values   # how far SPY sits below its own highest level so far (description only)
AVG_WORDS = {"sma50": "50-day simple average", "ema21": "21-day exponential average (a faster line that weights recent days more)"}


def run(cands, min_hist, slots=3, top_in=3, top_keep=5, to_core=True, exit_avg="sma50", buy_above_exit_line=False, name=""):
    """One continuous run over the FULL window. Returns the simulation and a book of every satellite bought and sold.
    `exit_avg` is the line a HELD satellite must stay above: the daily sale and the month-end keep test read it. With
    'sma50' this is exactly the rule in the header. With 'ema21' only that selling side changes — the test for a new
    pick stays as written (top of the rank, above its 50-day simple average, ahead of SPY). So at a month end a fund
    that passes the new-pick test is in the set whether or not it is above its 21-day line, and the daily sale takes
    over from the next session. `buy_above_exit_line=True` is a refinement that is NOT in the spec: a new pick must
    also be above the exit line, so nothing is bought straight into its own sell signal. With 'sma50' the two lines are
    the same line and the switch changes nothing."""
    held = []; book = {"open": {}, "trips": []}
    line, sma50 = AVG[exit_avg], AVG["sma50"]

    def target(names):
        t = {s: SLOT for s in names}; t["SPY"] = 1.0 - SLOT * (len(names) if to_core else slots); return t

    def decide(i, date, w):
        inside = sorted(s for s, x in w.items() if s not in ("SPY", "CASH") and x > 1e-9)
        if inside != sorted(held): raise RuntimeError(f"{name} {date}: the book says {sorted(held)} but the account holds {inside}")
        why = {s: "closed below its average" for s in held if C[s][i] < line[s][i]}          # the every-session exit
        keep = [s for s in held if s not in why]; add = []; month_end = date in ME
        if month_end:
            ok = [s for s in cands if HIST[s][i] >= min_hist and np.isfinite(R63[s][i])]
            ranked = sorted(ok, key=lambda s: -R63[s][i]); rank = {s: k + 1 for k, s in enumerate(ranked)}
            for s in keep:
                if rank.get(s, 999) > top_keep: why[s] = "fell out of the keep list at month end"
                elif not C[s][i] > line[s][i]: why[s] = "closed below its average"
            keep = [s for s in keep if s not in why]
            for s in ranked[:top_in]:
                if len(keep) + len(add) >= slots: break
                if s in keep: continue
                if not (C[s][i] > sma50[s][i] and R63[s][i] > R63["SPY"][i]): continue       # the new-pick test, as written
                if buy_above_exit_line and not C[s][i] > line[s][i]: continue                # the refinement (not in the spec)
                if s in why:                                                                 # held, under its exit line, yet a qualifier today: sold and re-picked at the same close = no order
                    if exit_avg == "sma50": raise RuntimeError(f"{name} {date}: {s} cannot fail and pass the same 50-day test")
                    del why[s]; keep.append(s)
                else: add.append(s)
        new = keep + add; tgt = target(new)
        if not why and not add:
            if not month_end: return None
            if max(abs(w.get(s, 0.0) - x) for s, x in tgt.items()) <= 0.03: return None      # no holding has drifted 3 points
        for s, reason in why.items(): book["trips"].append({"sym": s, "in": book["open"].pop(s), "out": i + 1, "why": reason})
        for s in add: book["open"][s] = i + 1                                                # fills at the next close
        held[:] = new
        return tgt

    sim = L.simulate(D, decide, *L.FULL, initial={"SPY": 1.0}, name=name)                    # every variant starts 100% in SPY
    return sim, book


def score_trip(t):
    """One finished round trip. `_r` and `_m` are the exact returns (percent) of the satellite and of SPY over the same
    sessions; every statistic is worked out from those. `return_pct` and `spy_same_sessions_pct` are the same numbers
    rounded to one decimal FOR DISPLAY — never compare the rounded pair (a 4.32 against 4.28 would show as a tie)."""
    a, b, s = t["in"], t["out"], t["sym"]
    r = 100 * float(TR[s][b] / TR[s][a] - 1); m = 100 * float(TR["SPY"][b] / TR["SPY"][a] - 1)
    return {"sym": s, "bought": D.dates[a], "sold": D.dates[b], "sessions": int(b - a), "why": t["why"],
            "return_pct": round(r, 1), "spy_same_sessions_pct": round(m, 1), "beat_spy": bool(r > m), "made_money": bool(r > 0), "_r": r, "_m": m}


def shown(rows): return [{k: v for k, v in x.items() if not k.startswith("_")} for x in rows]   # drop the exact working fields before saving


def satellite_stats(book, slots=3):
    """Slots filled per session, and every COMPLETED round trip scored against SPY over the same sessions (before costs)."""
    n = np.zeros(len(D.dates), dtype=int)
    for t in book["trips"]: n[t["in"]:t["out"]] += 1                 # in the account at the closes from the buy fill to the day before the sale fill
    for s, a in book["open"].items(): n[a:I1 + 1] += 1
    def filled(lo, hi): x = n[lo:hi + 1]; return {str(k): round(100 * float((x == k).mean()), 1) for k in range(slots + 1)}
    def trips(rows):
        if not rows: return {"completed": 0}
        r = np.array([x["_r"] for x in rows]); m = np.array([x["_m"] for x in rows]); h = np.array([x["sessions"] for x in rows])
        return {"completed": len(rows), "avg_hold_sessions": round(float(h.mean()), 1), "median_hold_sessions": float(np.median(h)),
                "beat_spy_pct": round(100 * float((r > m).mean()), 1), "made_money_pct": round(100 * float((r > 0).mean()), 1),
                "avg_return_pct": round(float(r.mean()), 2), "avg_spy_same_sessions_pct": round(float(m.mean()), 2),
                "median_return_pct": round(float(np.median(r)), 2), "median_spy_same_sessions_pct": round(float(np.median(m)), 2),
                "sold_below_average_pct": round(100 * float(np.mean([x["why"] == "closed below its average" for x in rows])), 1),
                "held_5_sessions_or_less_pct": round(100 * float((h <= 5).mean()), 1)}
    allr = sorted((score_trip(t) for t in book["trips"]), key=lambda x: (x["bought"], x["sold"])); l2 = [x for x in allr if x["bought"] >= L.LAST2[0]]
    by = {}
    for x in allr:
        b = by.setdefault(x["sym"], {"sym": x["sym"], "round_trips": 0, "sessions_held": 0, "points_vs_spy": 0.0})
        b["round_trips"] += 1; b["sessions_held"] += x["sessions"]; b["points_vs_spy"] += SLOT * (x["_r"] - x["_m"])
    points_total = round(float(sum(b["points_vs_spy"] for b in by.values())), 1)           # added up before rounding, so the per-fund figures can differ from it by 0.1
    for b in by.values(): b["points_vs_spy"] = round(b["points_vs_spy"], 1)
    before = [x for x in allr if x["bought"] < L.LAST2[0] <= x["sold"]]                     # already held when the last-two-years window opened
    still = [{"sym": s, "bought": D.dates[a], "sessions": int(I1 - a), "return_pct": round(100 * float(TR[s][I1] / TR[s][a] - 1), 1),
              "spy_same_sessions_pct": round(100 * float(TR["SPY"][I1] / TR["SPY"][a] - 1), 1)} for s, a in book["open"].items()]
    spy_x = (D.ret["SPY"] - D.cash_ret).values; by_n = []                                   # what SPY did (above the cash rate) on the session AFTER each close, by slots filled at that close
    for k in range(slots + 1):
        idx = np.nonzero(n[I0:I1] == k)[0] + I0
        by_n.append({"slots_filled": k, "sessions": int(len(idx)), "spy_minus_cash_pct_a_year": round(100 * 252 * float(spy_x[idx + 1].mean()), 1) if len(idx) else None,
                     "spy_avg_below_its_high_pct": round(100 * float(SPY_OFF_HIGH[idx].mean()), 1) if len(idx) else None})
    return {"slots_filled_pct_of_sessions": {"full": filled(I0, I1), "last2": filled(D.ix[L.LAST2[0]], I1)},
            "spy_return_by_slots_filled": by_n, "points_vs_spy_total": points_total,
            "spy_return_by_slots_filled_plain": "for each count of filled slots: on how many days the account closed that way, how far SPY then sat below its own high on average, and SPY's average gain over cash on the FOLLOWING day scaled up to a yearly rate (the one-day average times 252). It is an average of separate single days — a description of what kind of days those were, not a return earned over any year",
            "points_vs_spy_plain": "each finished trade's return minus SPY's over the same sessions, times the 10% position size, added up: a rough count (before trading costs) of what the picks added to or took from the whole portfolio over the full window",
            "avg_slots_filled": {"full": round(float(n[I0:I1 + 1].mean()), 2), "last2": round(float(n[D.ix[L.LAST2[0]]:I1 + 1].mean()), 2)},
            "round_trips": {"full": trips(allr), "last2": trips(l2)},
            "round_trips_plain": {"full": "every satellite bought and sold again between 3 Jan 2005 and 5 Oct 2026; each is scored from the close it was bought at to the close it was sold at, before trading costs, against SPY over the same days",
                                  "last2": f"trades OPENED in the last two years only: bought on or after 3 Oct 2024 and sold by 5 Oct 2026. Satellites already held on 3 Oct 2024 and sold later ({len(before)} of them) are not counted here (they are listed under held_before_last2), nor is anything still held at the end"},
            "by_symbol": sorted(by.values(), key=lambda b: -b["points_vs_spy"]), "trips_last2": shown(l2), "held_before_last2": shown(before), "still_held_at_end": still}


def brief(sim):
    f, l = L.metrics(sim, *L.FULL), L.metrics(sim, *L.LAST2)
    return {"full_cagr_pct": float(f["cagr_pct"]), "full_max_dd_pct": float(f["max_dd_pct"]), "last2_total_return_pct": float(l["total_return_pct"]),
            "last2_cagr_pct": float(l["cagr_pct"]), "last2_max_dd_pct": float(l["max_dd_pct"]), "avg_stock_pct": float(f["avg_stock_pct"]), "last2_avg_stock_pct": float(l["avg_stock_pct"])}


# ---- the four variants ------------------------------------------------------------------------------------------------
SPEC = [
    ("sat_sectors_to_core", CAND_A, 252, True, "Core SPY + up to three 10% sector funds — a sold fund's money goes straight back into SPY",
     "candidates: the 11 sector funds + the semiconductor fund SMH, picked by recent strength (no hindsight); always fully invested"),
    ("sat_sectors_to_cash", CAND_A, 252, False, "Same sector picks — but a sold fund's money and any empty slot wait in cash",
     "identical picks and exits; it starts 100% in SPY like the headline and moves to a 70% SPY core at the first month end (31 Jan 2005); from then on the core stays at 70% SPY and each empty 10% slot sits in Treasury bills until a month end fills it"),
    ("sat_leaders_to_core", CAND_B, 126, True, "HINDSIGHT — core SPY + up to three 10% positions in today's known winners; sold money back into SPY",
     "candidates are 13 stocks chosen BECAUSE they turned out to be winners (NVDA, MSFT, AAPL, GOOGL, AMZN, META, TSLA, AVGO, MU, VST, BE, NBIS, CRWV) — nobody could have had this list in 2005; it shows the mechanics, not an achievable result"),
    ("sat_leaders_to_cash", CAND_B, 126, False, "HINDSIGHT — today's known winners; sold money and empty slots wait in cash",
     "same hindsight list; it starts 100% in SPY and moves to a 70% SPY core at the first month end (31 Jan 2005); from then on the core stays at 70% SPY and each empty 10% slot sits in Treasury bills until a month end fills it"),
]
variants = []; sims = {}; books = {}
for key, cands, hist, to_core, label, note in SPEC:
    sim, book = run(cands, hist, to_core=to_core, name=key); sims[key], books[key] = sim, book
    r = L.report(sim, D, label, note); r["key"] = key; variants.append(r)
V = {v["key"]: v for v in variants}

# ---- extras -----------------------------------------------------------------------------------------------------------
spy = L.fixed_mix(D, {"SPY": 1.0}, monthly=False, name="SPY"); spy_b = brief(spy)
zero, _ = run(CAND_A, 252, slots=0, name="no satellites"); zero_b = brief(zero)          # must equal buy-and-hold SPY
assert zero_b == spy_b, ("a run with no satellite slots must match buy-and-hold SPY", zero_b, spy_b)
assert (zero_b["full_cagr_pct"], zero_b["full_max_dd_pct"], zero_b["last2_total_return_pct"]) == (10.96, -55.2, 39.6), ("always-in-SPY must give 10.96% a year, -55.2% worst fall, +39.6% last two years", zero_b)
assert books["sat_sectors_to_core"] == books["sat_sectors_to_cash"] and books["sat_leaders_to_core"] == books["sat_leaders_to_cash"]   # same picks either way

BUY_WORDS = {False: "a new pick must be in the top of the rank, above its 50-day simple average and ahead of SPY (the rule as written)",
             True: "REFINEMENT, not in the spec: a new pick must ALSO be above the 21-day exit line"}
def sens_row(slots, top_in, top_keep, ex, both=False):
    sim, book = run(CAND_A, 252, slots=slots, top_in=top_in, top_keep=top_keep, exit_avg=ex, buy_above_exit_line=both, name=f"A {slots} slots {ex}{' both lines' if both else ''}")
    st = satellite_stats(book, slots); f = L.metrics(sim, *L.FULL); b = brief(sim)
    return {"budget_pct": int(round(100 * SLOT * slots)), "slots": slots, "picks_from_top": top_in, "keeps_while_in_top": top_keep,
            "exit_average": ex, "exit_average_plain": AVG_WORDS[ex], "buy_must_also_be_above_exit_line": bool(both), "buy_rule_plain": BUY_WORDS[both],
            "is_headline": bool(slots == 3 and ex == "sma50" and not both), **b,
            "full_cagr_minus_spy_pts": round(b["full_cagr_pct"] - spy_b["full_cagr_pct"], 2),
            "last2_total_return_minus_spy_pts": round(b["last2_total_return_pct"] - spy_b["last2_total_return_pct"], 1),
            "round_trips": st["round_trips"]["full"]["completed"], "avg_hold_sessions": st["round_trips"]["full"].get("avg_hold_sessions"),
            "held_5_sessions_or_less_pct": st["round_trips"]["full"].get("held_5_sessions_or_less_pct"),
            "avg_slots_filled": st["avg_slots_filled"]["full"], "orders_per_month": float(f["orders_per_month"]), "cost_paid_pct": round(100 * sim["cost_paid"], 2)}

GRID = [(2, 3, 5), (3, 3, 5), (5, 5, 7)]
sens = [sens_row(*g, ex) for g in GRID for ex in ["sma50", "ema21"]]                       # the six settings the spec asks for, each read as written
sens_both = [sens_row(*g, "ema21", both=True) for g in GRID]                              # three extra runs: the 21-day exit with the added buy condition
head = [x for x in sens if x["is_headline"]][0]
E21 = [x for x in sens if x["exit_average"] == "ema21"]; S50 = [x for x in sens if x["exit_average"] == "sma50"]
quick = lambda rows: float(np.mean([x["held_5_sessions_or_less_pct"] for x in rows]))                  # share of trades over within five sessions
ref_d = [round(b["full_cagr_pct"] - a["full_cagr_pct"], 2) for a, b in zip(E21, sens_both)]             # the refinement minus the as-written 21-day row, same budget
l2_ahead = [x for x in sens + sens_both if x["last2_total_return_minus_spy_pts"] > 0]                   # runs that finished the last two years ahead of SPY
behind_b = sum(1 for x in sens_both if x["full_cagr_minus_spy_pts"] < 0); behind_b_all = behind_b == len(sens_both)
assert head["full_cagr_pct"] == V["sat_sectors_to_core"]["full"]["cagr_pct"] and head["last2_total_return_pct"] == V["sat_sectors_to_core"]["last2"]["total_return_pct"]

def gap(a, b):
    return {"full_cagr_pts": round(float(V[a]["full"]["cagr_pct"] - V[b]["full"]["cagr_pct"]), 2), "last2_cagr_pts": round(float(V[a]["last2"]["cagr_pct"] - V[b]["last2"]["cagr_pct"]), 2),
            "last2_total_return_pts": round(float(V[a]["last2"]["total_return_pct"] - V[b]["last2"]["total_return_pct"]), 1),
            "full_max_dd_pts": round(float(V[a]["full"]["max_dd_pct"] - V[b]["full"]["max_dd_pct"]), 1), "last2_max_dd_pts": round(float(V[a]["last2"]["max_dd_pct"] - V[b]["last2"]["max_dd_pct"]), 1)}

no_smh, book_ns = run(L.SECTORS, 252, name="sectors only, no SMH")
extras = {
    "satellites": {k: satellite_stats(books[k]) for k in ["sat_sectors_to_core", "sat_leaders_to_core"]},
    "sensitivity": sens,
    "sensitivity_note": "Candidates A (sector funds + SMH), sold money back into SPY. Budget 20% / 30% / 50% = 2 / 3 / 5 slots of 10% (5 slots: pick from the top 5, keep while in the top 7). "
                        "With the 21-day exit line only the selling side changes: the daily sale and the month-end keep test read the 21-day line, while a new pick is still judged on its 50-day average, exactly as the rule is written. "
                        "That lets a fund be picked at a month end while it is already below its 21-day line and be sold again a day or two later — one reason those rows trade so much more often "
                        f"(about {quick(E21):.0f}% of their trades are over within five trading days, against about {quick(S50):.0f}% with the 50-day line).",
    "sensitivity_buy_above_both_lines": sens_both,
    "sensitivity_buy_above_both_lines_note": "Three extra runs that are NOT part of the rule as specified: the 21-day exit line again, but a new pick must also be above that 21-day line, so nothing is bought straight into its own sell signal. "
                                             f"Against the as-written 21-day rows they differ by {min(ref_d):+.2f} to {max(ref_d):+.2f} points a year over the full window, and {'all ' + str(len(sens_both)) if behind_b_all else str(behind_b) + ' of the ' + str(len(sens_both))} still finish behind SPY over the full window. "
                                             "Shown so the reader can see the as-written 21-day rows are not being made to look worse than they need to — not as a setting to be picked afterwards as 'the best'.",
    "exit_destination_gap": {**gap("sat_sectors_to_core", "sat_sectors_to_cash"), "plain": "headline (sold money back into SPY) minus the same rule with sold money waiting in cash; positive = going back to the core was worth that much a year",
                             "leaders_hindsight": gap("sat_leaders_to_core", "sat_leaders_to_cash")},
    "versus_buy_and_hold_spy": {"spy": spy_b, **{k: {"full_cagr_pts": round(float(V[k]["full"]["cagr_pct"]) - spy_b["full_cagr_pct"], 2),
                                                      "last2_total_return_pts": round(float(V[k]["last2"]["total_return_pct"]) - spy_b["last2_total_return_pct"], 1),
                                                      "full_max_dd_pts": round(float(V[k]["full"]["max_dd_pct"]) - spy_b["full_max_dd_pct"], 1)} for k in V}},
    "robustness": {"sectors_only_no_smh": {**brief(no_smh), "full_cagr_minus_spy_pts": round(brief(no_smh)["full_cagr_pct"] - spy_b["full_cagr_pct"], 2),
                                           "plain": "the headline rule with the semiconductor fund SMH taken off the candidate list — shows how much of the result leans on that one fund"}},
    "self_check": {"no_satellite_slots_equals_buy_and_hold_spy": True, "always_in_spy_gives_10.96_cagr_-55.2_maxdd_+39.6_last2": True, "to_core_and_to_cash_make_identical_picks": True,
                   "round_trip_statistics_use_unrounded_returns": True, "spy": spy_b},
}

YEARS = (I1 - I0) / 252.0; H = V["sat_sectors_to_core"]; HS = extras["satellites"]["sat_sectors_to_core"]; HT = HS["round_trips"]["full"]
G = extras["exit_destination_gap"]; gaps = [x["full_cagr_minus_spy_pts"] for x in sens]; behind = sum(1 for g in gaps if g < 0)
gaps_b = [x["full_cagr_minus_spy_pts"] for x in sens_both]; n_runs = len(sens) + len(sens_both)
l2_words = (f"none of the {n_runs} runs finished ahead of SPY" if not l2_ahead else
            f"{len(l2_ahead)} of the {n_runs} runs finished ahead of SPY, by at most {max(x['last2_total_return_minus_spy_pts'] for x in l2_ahead):.1f} points in total — far too little, over far too short a time, to mean anything")
empty, all3 = HS["spy_return_by_slots_filled"][0], HS["spy_return_by_slots_filled"][3]; d_cagr = float(H["full"]["cagr_pct"]) - spy_b["full_cagr_pct"]; d_l2 = float(H["last2"]["total_return_pct"]) - spy_b["last2_total_return_pct"]
assert G["full_cagr_pts"] > 0 and empty["spy_minus_cash_pct_a_year"] > all3["spy_minus_cash_pct_a_year"], "the 'back into SPY beat cash' caveat below is worded for this outcome — reword it if the numbers turn"
CAVEATS = [
    "The satellite picks here are a recent-strength rule, not Alan's fundamentals knockout — the knockout's picks have no history to test. So this shows how the STRUCTURE behaves, not how good the real picks would be.",
    f"The honest (sector-fund) version {'did not beat' if d_cagr < 0 else 'beat'} simply holding SPY: {H['full']['cagr_pct']:.2f}% a year against {spy_b['full_cagr_pct']:.2f}% over the full window ({d_cagr:+.2f} points a year), "
    f"and {H['last2']['total_return_pct']:+.1f}% against {spy_b['last2_total_return_pct']:+.1f}% over the last two years ({d_l2:+.1f} points). {'All' if behind == len(sens) else str(behind) + ' of the'} {len(sens)} settings tried finished behind SPY over the full window "
    f"(from {min(gaps):+.2f} to {max(gaps):+.2f} points a year), as did {'all' if behind_b_all else str(behind_b) + ' of the'} {len(sens_both)} extra runs with a stricter buy test (from {min(gaps_b):+.2f} to {max(gaps_b):+.2f}). "
    f"Over the last two years alone {l2_words}. The differences between settings are small; picking the best one afterwards would itself be hindsight.",
    f"Why the honest version lagged: {HT['completed']} satellite trades were finished, only {HT['beat_spy_pct']:.0f}% of them beat SPY over the same days (average {HT['avg_return_pct']:+.2f}% against SPY's {HT['avg_spy_same_sessions_pct']:+.2f}%), "
    f"and trading costs took about {float(H['cost_paid_pct']) / YEARS:.2f} points a year. The typical trade lasted {HT['median_hold_sessions']:.0f} trading days and {HT['held_5_sessions_or_less_pct']:.0f}% lasted five days or fewer — "
    "a fund bought at month end can close below its 50-day average within days and be sold again.",
    "The two 'today's known winners' versions use HINDSIGHT: the list of 13 stocks was chosen knowing how the story ended. Their returns could not have been earned and must not be set beside the honest versions as if they could.",
    "With sold money going back into SPY the portfolio is 100% in stocks every day, so it falls about as far as the market in a crash "
    f"(its worst fall was {H['full']['max_dd_pct']}%, against SPY's {spy_b['full_max_dd_pct']}%). This structure cures 'sitting in cash'; it does not cushion a bear market.",
    f"'Back into SPY' beat 'wait in cash' by {G['full_cagr_pts']:.2f} points a year (full window). The reason: the slots tend to be empty just after the market has fallen, and those turned out to be good days to own SPY. "
    f"On the {empty['sessions']:,} days that closed with all three slots empty, SPY sat on average {abs(empty['spy_avg_below_its_high_pct']):.0f}% below its high, and its average gain on the following day — scaled up to a yearly rate — "
    f"was about {empty['spy_minus_cash_pct_a_year']:.0f} points above cash (against about {all3['spy_minus_cash_pct_a_year']:.0f} on the days when all three slots were full). That is an average of separate single days, not a return anyone earned over a year. "
    f"The cash version did fall less in the worst periods ({-G['full_max_dd_pts']:.1f} points shallower at worst).",
    "A sector fund is a slice of the S&P 500, so a 10% satellite in, say, technology on top of SPY is a tilt towards something already owned, not a new source of return.",
    f"The last-two-years figures rest on a few dozen satellite trades in one particular market ({HS['round_trips']['last2']['completed']} sector-fund trades were opened on or after 3 Oct 2024 and closed by 5 Oct 2026; "
    f"the {len(HS['held_before_last2'])} already held on that date are not in that count); they describe what happened, not what to expect.",
    "Costs are counted at 0.05% per fund order and 0.10% per stock order, orders fill at the next day's close, and taxes on the frequent sales are not counted.",
    "Some candidates arrive late: the real-estate fund XLRE from late 2016 and the communications fund XLC from mid 2019; in the hindsight list Google's bars start in April 2014, and NBIS and CRWV only exist from 2024-25.",
    "The numbers 63 days, 50 days, top 3 and 3 points are one reasonable choice — not tuned, and not proven best.",
]

out = {
    "structure": "s1_core_satellite",
    "title": "Core and satellite — an index core that is always invested, plus up to three 10% conviction positions",
    "rule_plain": [
        "The core is SPY (the S&P 500 fund). Up to 30% of the portfolio can sit in a 'satellite': three slots of 10% each.",
        "Alan's real conviction picks come from his fundamentals knockout, which has no stored history, so the test uses a mechanical stand-in: recent strength.",
        "On the last trading day of each month, the candidates are ranked by their total return (price plus dividends) over the last 63 trading days — about three months.",
        "A candidate qualifies for an empty slot if it is in the top 3, its price is above its own 50-day average, and it has beaten SPY over those three months.",
        "A satellite already held is kept at month end while it is still in the top 5 and above its 50-day average.",
        "Every day: a satellite that closes below its 50-day average is sold. Every order is filled at the next day's close.",
        "Headline version: the money from a sold satellite goes straight back into SPY, so the portfolio is always fully invested (SPY = 100% minus 10% per satellite held).",
        "Comparison version: the money from a sold satellite, and any empty slot, waits in cash (Treasury bills) until a month end fills the slot — the core stays at 70% SPY.",
        "Every version starts on 3 January 2005 with 100% in SPY; the first satellites can be picked at the end of that month (and that is when the comparison version first moves down to its 70% core).",
        "Candidates, honest version: the 11 sector funds plus the semiconductor fund SMH (a fund joins the list once it has a year of history).",
        "Candidates, HINDSIGHT version: 13 stocks picked because we already know they became winners — shown for the mechanics only.",
        "Positions are trimmed back to their targets only when something is sold, when the set of satellites changes at a month end, or when a holding has drifted more than 3 points from target at a month end.",
    ],
    "variants": variants,
    "extras": extras,
    "caveats": CAVEATS,
}
L.save("s1_core_satellite.json", out)

# ---- summary ----------------------------------------------------------------------------------------------------------
print(f"{'variant':24s} {'FULL cagr':>9s} {'maxdd':>7s} {'stock':>6s} | {'LAST2 ret':>9s} {'maxdd':>7s} {'stock':>6s} {'dec/mo':>6s} | 2008 / 2020 / 2022 | cost% turnover")
print(f"{'buy and hold SPY':24s} {spy_b['full_cagr_pct']:9.2f} {spy_b['full_max_dd_pct']:7.1f} {spy_b['avg_stock_pct']:6.1f} | {spy_b['last2_total_return_pct']:9.1f} {spy_b['last2_max_dd_pct']:7.1f} {spy_b['last2_avg_stock_pct']:6.1f}")
for v in variants:
    f, l, s = v["full"], v["last2"], v["stress"]
    print(f"{v['key']:24s} {f['cagr_pct']:9.2f} {f['max_dd_pct']:7.1f} {f['avg_stock_pct']:6.1f} | {l['total_return_pct']:9.1f} {l['max_dd_pct']:7.1f} {l['avg_stock_pct']:6.1f} {l['decision_days_per_month']:6.2f} | "
          f"{s['2008 crash']:6.1f} {s['2020 crash']:6.1f} {s['2022 bear']:6.1f} | {v['cost_paid_pct']:5.2f} {v['turnover_x']:6.1f}")
for k, st in extras["satellites"].items():
    print(f"\n{k}: slots filled (share of sessions, full) {st['slots_filled_pct_of_sessions']['full']}  last2 {st['slots_filled_pct_of_sessions']['last2']}")
    print("   round trips full ", st["round_trips"]["full"]); print("   round trips last2", st["round_trips"]["last2"])
    print("   by symbol (points vs SPY):", ", ".join(f"{b['sym']} {b['points_vs_spy']:+.1f} ({b['round_trips']})" for b in st["by_symbol"]))
    print("   still held at end:", st["still_held_at_end"])
    print("   held on 3 Oct 2024, sold later (not in the last2 count):", [(x["sym"], x["bought"], x["sold"]) for x in st["held_before_last2"]])
    print("   SPY by slots filled (sessions, avg % below high, next-day gain over cash x252):", [(r["slots_filled"], r["sessions"], r["spy_avg_below_its_high_pct"], r["spy_minus_cash_pct_a_year"]) for r in st["spy_return_by_slots_filled"]], " points vs SPY total", st["points_vs_spy_total"])
def sens_line(x):
    return (f"   budget {x['budget_pct']:2d}%  exit {x['exit_average']:5s}  FULL cagr {x['full_cagr_pct']:6.2f} ({x['full_cagr_minus_spy_pts']:+.2f} vs SPY) dd {x['full_max_dd_pct']:6.1f} | LAST2 ret {x['last2_total_return_pct']:6.1f} dd {x['last2_max_dd_pct']:6.1f} | "
            f"stock {x['avg_stock_pct']:5.1f} trips {x['round_trips']:4d} hold {x['avg_hold_sessions']} (<=5 days {x['held_5_sessions_or_less_pct']}%) orders/mo {x['orders_per_month']}" + ("   <- headline" if x["is_headline"] else ""))
print("\nsensitivity (candidates A, sold money back into SPY; the six settings read as written)")
for x in sens: print(sens_line(x))
print("extra, not in the spec: 21-day exit AND a new pick must also be above the 21-day line")
for x in sens_both: print(sens_line(x))
print("\nexit destination gap (to core minus to cash):", {k: v for k, v in extras["exit_destination_gap"].items() if k not in ("plain",)})
print("sectors only, no SMH:", {k: v for k, v in extras["robustness"]["sectors_only_no_smh"].items() if k != "plain"})
print("versus SPY:", {k: v for k, v in extras["versus_buy_and_hold_spy"].items() if k != "spy"})
print(f"\nsaved data/s1_core_satellite.json in {time.time() - T0:.1f}s")
