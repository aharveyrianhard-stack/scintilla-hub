# PF1 · structure 5 — level-based scaling in: buy in parts at price levels (the 21-day and 50-day averages) instead of all at
# once or by the calendar. Three parts:
#   1. THE ENTRY EXPERIMENT — every month since 2005, for SPY / QQQ / SMH: five ways of getting 1.00 of cash into the fund.
#   2. THE BREAKOUT RETEST CHECK — the ten 2-week-pivot breakouts of the last two years: did price come back to the line?
#   3. TWO CONTINUOUS RUNS for the comparison table — a simple in-or-out rule on SPY, buying back at once or in thirds.
# NO HINDSIGHT: a limit for session j is the average as it stood at the close of j-1. Session j's low only decides whether that
# already-placed order fills (execution); it never decides anything else. Nothing here looks at a row after the one it acts on.
import numpy as np, pandas as pd
import pf1lib as L

D = L.load()
I0, I1 = D.ix[L.FULL[0]], D.ix[L.FULL[1]]; LAST2_I = D.ix[L.LAST2[0]]
CG = (1.0 + D.cash_ret).cumprod().values                      # what 1.00 left in Treasury bills has grown to at each close
ASSETS = ["SPY", "QQQ", "SMH"]; HORIZONS = [126, 252]; STOP = 63; LEG = 126; THIRD = 1.0 / 3.0
METHODS = [
    ("M1", "All at once", "Buy everything at the close on day one (lump sum)."),
    ("M2", "Calendar thirds", "Buy a third at the close on day one, a third 21 sessions (about a month) later and the last third 42 sessions later, whatever the price."),
    ("M3", "Level thirds, no deadline", "Buy a third at the close on day one. Leave one buy order resting at the 21-day average line and one at the 50-day average line; each fills only if the price comes down to its line. A third that never fills stays in Treasury bills."),
    ("M4", "Level thirds with a 63-session deadline", "The same as level thirds, but any third still not bought 63 sessions (about three months) after day one is bought at that day's close."),
    ("M5", "Wait for the pullback with everything", "Put all the money on one buy order resting at the 50-day average line and wait, with no deadline (the cash-by-default habit). If the price is already at or under that line on day one, everything is bought that day."),
]
MK = [m[0] for m in METHODS]


def r2(x): return None if x is None or not np.isfinite(x) else round(float(x), 2)
def r1(x): return None if x is None or not np.isfinite(x) else round(float(x), 1)


# ───────────────────────────── PART 1 · the entry experiment ─────────────────────────────
def arrays(sym):
    c = D.c[sym]
    return {"c": c.values, "o": D.o[sym].values, "l": D.l[sym].values, "tr": D.tr[sym].values, "ret": D.ret[sym].values,
            "e21": L.ema(c, 21).values, "s50": L.sma(c, 50).values, "s200": L.sma(c, 200).values}


def limit_fill(A, avg, s, last):
    """A buy order that follows the average `avg` from the close of session s. Returns (session, price) or None.
    Already at or under the line on day one -> buys at that close. Otherwise the order for session j sits at the average as of
    the close of j-1 and fills if j's low reaches it, at the limit or at j's open if the open is already lower."""
    if A["c"][s] <= avg[s]: return (s, float(A["c"][s]))
    for j in range(s + 1, last + 1):
        lim = avg[j - 1]
        if A["l"][j] <= lim: return (j, float(min(lim, A["o"][j])))
    return None


def plans(A, s, e):
    """Each method as a list of (share of the money, fill) — fill = (session, price) or None for never bought."""
    c = A["c"]; first = (s, float(c[s]))
    ema3, sma3 = limit_fill(A, A["e21"], s, e), limit_fill(A, A["s50"], s, e)
    ema4, sma4 = limit_fill(A, A["e21"], s, s + STOP), limit_fill(A, A["s50"], s, s + STOP)
    stop = (s + STOP, float(c[s + STOP]))
    return {"M1": [(1.0, first)],
            "M2": [(THIRD, first), (THIRD, (s + 21, float(c[s + 21]))), (THIRD, (s + 42, float(c[s + 42])))],
            "M3": [(THIRD, first), (THIRD, ema3), (THIRD, sma3)],
            "M4": [(THIRD, first), (THIRD, ema4 or stop), (THIRD, sma4 or stop)],
            "M5": [(1.0, sma3)]}


def worth(A, s, e, plan):
    """End value of 1.00: money waits in bills until its fill, is worth amount x close / price on the fill day, then follows
    the fund's total return."""
    v = 0.0
    for frac, fill in plan:
        if fill is None: v += frac * CG[e] / CG[s]
        else:
            j, p = fill; v += frac * (CG[j] / CG[s]) * (A["c"][j] / p) * (A["tr"][e] / A["tr"][j])
    return v


def walk(A, s, e, plan):
    """The same end value the slow way, one session at a time — used only as a check on `worth`."""
    hold = 0.0; cash = [frac for frac, _ in plan]
    for k in range(s, e + 1):
        if k > s:
            r = A["ret"][k]; hold *= 1.0 + (r if np.isfinite(r) else 0.0)
            cash = [x * (1.0 + D.cash_ret.iat[k]) for x in cash]
        for n, (frac, fill) in enumerate(plan):
            if fill is not None and fill[0] == k: hold += cash[n] * A["c"][k] / fill[1]; cash[n] = 0.0
    return hold + sum(cash)


def month_starts():
    return [i for i, d in enumerate(D.dates) if d[:7] >= "2005-01" and D.dates[i - 1][:7] != d[:7]]


def experiment():
    recs = {}; worst_check = 0.0; fills = []
    for sym in ASSETS:
        A = arrays(sym)
        for H in HORIZONS:
            rows = []
            for s in month_starts():
                e = s + H
                if e > I1: break
                P = plans(A, s, e); rec = {"i": s, "date": D.dates[s], "above200": bool(A["c"][s] > A["s200"][s])}
                for m in MK:
                    plan = P[m]; end = worth(A, s, e, plan)
                    rec[m] = {"end": end,
                              "uninv": sum(f for f, fl in plan if fl is None),
                              "time": sum(f * (e - fl[0]) / H for f, fl in plan if fl is not None),
                              "uninv_leg": sum(f for f, fl in plan if fl is None or fl[0] > s + LEG)}
                    if sym == "SPY" or m in ("M3", "M5"): worst_check = max(worst_check, abs(end - walk(A, s, e, plan)))
                rec["ema_fill"], rec["sma_fill"] = P["M3"][1][1], P["M3"][2][1]
                rec["ema_fill_late"], rec["sma_fill_late"] = [fl is None or fl[0] > s + STOP for fl in (rec["ema_fill"], rec["sma_fill"])]
                rows.append(rec)
            recs[(sym, H)] = rows
            for name, key in [("21-day average line", "ema_fill"), ("50-day average line", "sma_fill")]:   # how the resting orders behaved (M3)
                at0 = [r for r in rows if r[key] is not None and r[key][0] == r["i"]]; later = [r for r in rows if r[key] is not None and r[key][0] > r["i"]]
                wait = [r[key][0] - r["i"] for r in later]; disc = [100 * (r[key][1] / A["c"][r["i"]] - 1) for r in later]
                fills.append({"asset": sym, "horizon": H, "line": name, "starts": len(rows),
                              "already_under_line_on_day_one_pct": r1(100 * len(at0) / len(rows)), "filled_later_pct": r1(100 * len(later) / len(rows)),
                              "never_filled_pct": r1(100 * (len(rows) - len(at0) - len(later)) / len(rows)),
                              "still_waiting_after_63_sessions_pct": r1(100 * np.mean([r[key + "_late"] for r in rows])),
                              "median_wait_sessions": r1(np.median(wait)) if wait else None,
                              "median_fill_price_vs_day_one_pct": r2(np.median(disc)) if disc else None,
                              "later_fills_at_a_higher_price_than_day_one_pct": r1(100 * np.mean([x > 0 for x in disc])) if disc else None})
    return recs, fills, worst_check


def stat_rows(rows, sym, H):
    out = []
    if not rows: return out
    lump = np.array([r["M1"]["end"] for r in rows])
    for m, label, _ in METHODS:
        v = np.array([r[m]["end"] for r in rows]); gap = 100 * (v - lump); k = int(v.argmin())
        row = {"asset": sym, "horizon": H, "method": m, "method_label": label, "starts": len(rows), "first_start": rows[0]["date"], "last_start": rows[-1]["date"],
               "mean_pct": r2(100 * (v.mean() - 1)), "median_pct": r2(100 * (np.median(v) - 1)),
               "above_lump_share_pct": None if m == "M1" else r1(100 * (gap > 1e-7).mean()),
               "tied_with_lump_share_pct": None if m == "M1" else r1(100 * (np.abs(gap) <= 1e-7).mean()),
               "mean_gap_pts": None if m == "M1" else r2(gap.mean()), "median_gap_pts": None if m == "M1" else r2(np.median(gap)),
               "uninvested_end_pct": r1(100 * np.mean([r[m]["uninv"] for r in rows])),
               "time_invested_pct": r1(100 * np.mean([r[m]["time"] for r in rows])),
               "missed_leg_pct": r1(100 * np.mean([r[m]["uninv_leg"] >= THIRD - 1e-9 for r in rows])),
               "worst_pct": r2(100 * (v[k] - 1)), "worst_start": rows[k]["date"]}
        out.append(row)
    return out


recs, fills, walk_gap = experiment()
tables = {"all": [], "above_200_day": [], "below_200_day": [], "last2_h126": []}; pooled = []
for (sym, H), rows in recs.items():
    tables["all"] += stat_rows(rows, sym, H)
    tables["above_200_day"] += stat_rows([r for r in rows if r["above200"]], sym, H)
    tables["below_200_day"] += stat_rows([r for r in rows if not r["above200"]], sym, H)
    if H == 126: tables["last2_h126"] += stat_rows([r for r in rows if r["date"][:7] >= "2024-10"], sym, H)
for H in HORIZONS:
    for sub, pick in [("all", lambda r: True), ("above_200_day", lambda r: r["above200"]), ("below_200_day", lambda r: not r["above200"])]:
        allr = [r for sym in ASSETS for r in recs[(sym, H)] if pick(r)]
        for row in stat_rows(allr, "SPY+QQQ+SMH", H): row.update({"subset": sub, "first_start": None, "last_start": None}); pooled.append(row)
l2 = [r["date"] for r in recs[("SPY", 126)] if r["date"][:7] >= "2024-10"]
l2_split = {sym: {"above_200_day": sum(r["above200"] for r in recs[(sym, 126)] if r["date"][:7] >= "2024-10"),
                  "below_200_day": sum(not r["above200"] for r in recs[(sym, 126)] if r["date"][:7] >= "2024-10")} for sym in ASSETS}


def example(sym, H, pick):
    """One start date spelled out: where each resting order filled and what each method ended at."""
    A = arrays(sym); r = pick(recs[(sym, H)]); s = r["i"]
    def leg(fl): return None if fl is None else {"date": D.dates[fl[0]], "sessions_waited": int(fl[0] - s), "price": r2(fl[1]), "price_vs_day_one_pct": r2(100 * (fl[1] / A["c"][s] - 1))}
    return {"asset": sym, "horizon": H, "start": r["date"], "end": D.dates[s + H], "day_one_close": r2(A["c"][s]), "started_above_200_day": r["above200"],
            "order_at_21_day_average": leg(r["ema_fill"]), "order_at_50_day_average": leg(r["sma_fill"]),
            "result_pct": {m: r2(100 * (r[m]["end"] - 1)) for m in MK}}


examples = {"level_thirds_furthest_behind_all_at_once": example("SPY", 126, lambda rows: min(rows, key=lambda r: r["M3"]["end"] - r["M1"]["end"])),
            "level_thirds_furthest_ahead_of_all_at_once": example("SPY", 126, lambda rows: max(rows, key=lambda r: r["M3"]["end"] - r["M1"]["end"]))}
entry = {
    "what": "Each month from January 2005, on the month's first trading day, 1.00 of cash is put to work in the fund by five different methods and valued 126 sessions (about six months) and 252 sessions (about a year) later. Cash that is waiting earns the Treasury-bill rate; money in the fund earns the fund's total return (price plus dividends).",
    "methods": [{"key": k, "label": lab, "plain": p} for k, lab, p in METHODS],
    "columns": {"starts": "how many monthly start dates are in the row",
                "mean_pct / median_pct": "average and middle result at the end of the horizon, in percent",
                "above_lump_share_pct": "share of start dates where the method finished ahead of buying all at once",
                "tied_with_lump_share_pct": "share of start dates where it finished exactly level with buying all at once (the price was already under the lines on day one, so everything was bought that day)",
                "mean_gap_pts / median_gap_pts": "the method's result minus the all-at-once result, in percentage points (minus = it finished behind)",
                "uninvested_end_pct": "average share of the starting money that had still not been bought at the end of the horizon",
                "time_invested_pct": "average share of the horizon the money spent in the fund, weighting each part by its size (all at once = 100)",
                "missed_leg_pct": "share of start dates where a third or more of the money was still not bought 126 sessions (about six months) after day one",
                "worst_pct": "the worst single result, with its start date"},
    "tables": tables, "pooled_three_funds": pooled, "resting_order_behaviour": fills,
    "start_counts": {f"{sym} H{H}": len(rows) for (sym, H), rows in recs.items()},
    "worked_examples_spy_six_months": examples,
    "last2_starts": {"count": len(l2), "first": l2[0], "last": l2[-1], "started_above_or_below_200_day": l2_split,
                     "note": "Monthly starts from October 2024 whose 126-session horizon has already finished. The October 2024 start is 1 Oct 2024, two sessions before the page's two-year window officially begins on 3 Oct 2024."},
    "check_slow_walk_max_gap": float(walk_gap),
}


# ───────────────────────────── PART 2 · the breakout retest check ─────────────────────────────
def retests():
    rows = []
    for b in L.breakouts():
        sym, level, i = b["sym"], float(b["level"]), D.ix[b["breakDate"]]; A = arrays(sym); c, o, lo, tr = A["c"], A["o"], A["l"], A["tr"]
        e = min(i + 20, I1); complete = i + 20 <= I1; band = level * 1.005
        def first_touch(lim):
            for j in range(i + 1, e + 1):
                if lo[j] <= lim: return (j, float(min(lim, o[j])))
            return None
        def half_half(fill):
            rest = CG[e] / CG[i] if fill is None else (CG[fill[0]] / CG[i]) * (c[fill[0]] / fill[1]) * (tr[e] / tr[fill[0]])
            return 0.5 * tr[e] / tr[i] + 0.5 * rest - 1.0
        fb, fl = first_touch(band), first_touch(level); allin = tr[e] / tr[i] - 1.0
        closes_under = [j for j in range(i + 1, e + 1) if c[j] < level]
        rows.append({"sym": sym, "break_date": b["breakDate"], "level": level, "break_close": r2(c[i]), "break_close_matches_replay": bool(abs(c[i] - b["breakClose"]) < 0.011),
                     "break_close_over_level_pct": r2(100 * (c[i] / level - 1)), "break_close_already_inside_band": bool(c[i] <= band),
                     "sessions_measured": int(e - i), "complete_20_sessions": bool(complete), "measured_to": D.dates[e],
                     "retested": fb is not None, "retest_session": None if fb is None else int(fb[0] - i), "retest_date": None if fb is None else D.dates[fb[0]],
                     "limit_price": r2(band), "limit_fill_price": None if fb is None else r2(fb[1]),
                     "lowest_low_vs_level_pct": r2(100 * (lo[i + 1:e + 1].min() / level - 1)) if e > i else None,
                     "all_at_break_pct": r2(100 * allin), "half_and_half_pct": r2(100 * half_half(fb)), "half_and_half_minus_all_pts": r2(100 * (half_half(fb) - allin)),
                     "came_back_to_the_line_itself": fl is not None, "line_touch_session": None if fl is None else int(fl[0] - i),
                     "half_at_the_line_itself_pct": r2(100 * half_half(fl)), "half_at_the_line_minus_all_pts": r2(100 * (half_half(fl) - allin)),
                     "closed_back_under_the_line": bool(closes_under), "first_close_under_session": int(closes_under[0] - i) if closes_under else None})
    full = [r for r in rows if r["complete_20_sessions"]]
    def tally(rs, gap):
        return {"better": sum(r[gap] > 0.005 for r in rs), "worse": sum(r[gap] < -0.005 for r in rs), "same": sum(abs(r[gap]) <= 0.005 for r in rs)}
    counts = {"events": len(rows), "events_with_20_full_sessions": len(full),
              "retested_within_20": sum(r["retested"] for r in rows), "retested_within_20_of_complete": sum(r["retested"] for r in full),
              "retest_on_session_1": sum(r["retest_session"] == 1 for r in rows),
              "median_retest_session": r1(np.median([r["retest_session"] for r in rows if r["retested"]])) if any(r["retested"] for r in rows) else None,
              "break_close_already_inside_band": sum(r["break_close_already_inside_band"] for r in rows),
              "limit_never_filled": sum(not r["retested"] for r in full),
              "half_and_half_vs_all_complete": tally(full, "half_and_half_minus_all_pts"),
              "mean_all_at_break_pct_complete": r2(np.mean([r["all_at_break_pct"] for r in full])), "mean_half_and_half_pct_complete": r2(np.mean([r["half_and_half_pct"] for r in full])),
              "came_back_to_the_line_itself": sum(r["came_back_to_the_line_itself"] for r in rows), "came_back_to_the_line_itself_of_complete": sum(r["came_back_to_the_line_itself"] for r in full),
              "closed_back_under_the_line_of_complete": sum(r["closed_back_under_the_line"] for r in full),
              "half_at_the_line_vs_all_complete": tally(full, "half_at_the_line_minus_all_pts"),
              "mean_half_at_the_line_pct_complete": r2(np.mean([r["half_at_the_line_itself_pct"] for r in full]))}
    return {"what": "For each of the ten breakouts of the last two years (the first daily close above a confirmed 2-week pivot high in SPY or QQQ): did the day's low come back to within half a percent of the broken line in the next 20 sessions, and what did buying all at the breakout close return over those 20 sessions compared with buying half at the close and leaving half on a resting order just above the line?",
            "rule": "Retest = a session low at or under the line plus 0.5%. The resting order sits at the line plus 0.5% from the session after the breakout; it fills at that price, or at the open if the open is already lower. A half that never fills stays in Treasury bills. Results are total returns (dividends included), no trading costs.",
            "events": rows, "counts": counts}


breakout = retests()


# ───────────────────────────── PART 3 · two continuous runs for the comparison table ─────────────────────────────
spy = D.c["SPY"]; SPYC = spy.values; E21 = L.ema(spy, 21).values; S50 = L.sma(spy, 50).values
sec = {}
for s in L.SECTORS:                                                                      # as in s2_trend_core: a fund's average is over its own 200 closes
    cs = D.c[s].dropna(); ms = L.sma(cs, 200); sec[s] = (cs > ms).astype(float).where(ms.notna()).reindex(D.c.index)
sec = pd.DataFrame(sec); have = sec.notna(); counted = have.sum(axis=1)                   # funds with 200 sessions of history
breadth = sec.sum(axis=1) / counted.where(counted > 0)
IN = (~((spy < L.sma(spy, 200)) & (breadth < 0.5))).values                               # OUT only when both are bad; known at each close


def run_at_once(force=None, name="reenter_at_once"):
    """force=True holds the switch IN, force=False holds it OUT (both only for the self-checks)."""
    st = {"in": bool(IN[I0]) if force is None else force}
    def decide(i, d, w):
        now = bool(IN[i]) if force is None else force
        if now == st["in"]: return None
        st["in"] = now; return {"SPY": 1.0} if now else {}
    return L.simulate(D, decide, initial={"SPY": 1.0} if st["in"] else None, name=name)


def run_thirds():
    st = {"in": bool(IN[I0]), "turn": None, "e": True, "s": True}; log = []
    def decide(i, d, w):
        now = bool(IN[i])
        if not now:
            if not st["in"]: return None
            st["in"] = False
            if log and log[-1]["out"] is None: log[-1]["out"] = d; log[-1]["thirds_when_sold"] = 1 + int(st["e"]) + int(st["s"])
            return {}
        if not st["in"]:                                                                  # the rule has just turned IN: first third
            st.update({"in": True, "turn": i, "e": False, "s": False})
            log.append({"turn": d, "second": None, "second_why": None, "third": None, "third_why": None, "full_after_sessions": None, "out": None, "thirds_when_sold": None})
            return {"SPY": THIRD}
        if st["turn"] is None or (st["e"] and st["s"]): return None
        ch = False
        for k, line, slot in [("e", E21, "second"), ("s", S50, "third")]:
            if st[k]: continue
            why = "price came back to the line" if SPYC[i] <= line[i] else ("63-session deadline" if i - st["turn"] >= STOP else None)
            if why: st[k] = True; ch = True; log[-1][slot] = d; log[-1][slot + "_why"] = why
        if ch and st["e"] and st["s"]: log[-1]["full_after_sessions"] = i - st["turn"]
        return {"SPY": (1 + int(st["e"]) + int(st["s"])) / 3.0} if ch else None
    sim = L.simulate(D, decide, initial={"SPY": 1.0} if st["in"] else None, name="reenter_in_thirds")
    return sim, log


def episode_summary(log, start):
    ep = [x for x in log if x["turn"] >= start]; done = [x for x in ep if x["full_after_sessions"] is not None]
    def why(slot): return {w: sum(x[slot + "_why"] == w for x in ep) for w in ["price came back to the line", "63-session deadline"]}
    return {"turns_in": len(ep), "reached_fully_invested": len(done),
            "sold_again_with_one_third": sum(x["thirds_when_sold"] == 1 for x in ep), "sold_again_with_two_thirds": sum(x["thirds_when_sold"] == 2 for x in ep),
            "sold_again_within_5_sessions": sum(x["out"] is not None and D.ix[x["out"]] - D.ix[x["turn"]] <= 5 for x in ep),
            "second_third_bought_because": why("second"), "last_third_bought_because": why("third"),
            "median_sessions_from_turn_to_fully_invested": r1(np.median([x["full_after_sessions"] for x in done])) if done else None}


sim3, log = run_thirds(); sim1 = run_at_once(); hold = run_at_once(True, "always in"); bills = run_at_once(False, "always out"); bh = L.fixed_mix(D, {"SPY": 1.0}, monthly=False)
in_full = IN[I0:I1 + 1]; turns_in = int(((in_full[1:]) & (~in_full[:-1])).sum())
prev_out = max(k for k in range(I0) if not IN[k]) if (~IN[:I0]).any() else None
full_by_start = prev_out is None or (any(SPYC[k] <= E21[k] for k in range(prev_out + 2, I0)) and any(SPYC[k] <= S50[k] for k in range(prev_out + 2, I0)))
checks = {"always_in_matches_buy_and_hold_spy": bool(np.allclose(hold["equity"].values, bh["equity"].values)),
          "always_in": {"full_cagr_pct": L.metrics(hold, *L.FULL)["cagr_pct"], "full_max_dd_pct": L.metrics(hold, *L.FULL)["max_dd_pct"],
                        "last2_total_return_pct": L.metrics(hold, *L.LAST2)["total_return_pct"], "expected": [10.96, -55.2, 39.6]},
          "always_out": {"full_cagr_pct": L.metrics(bills, *L.FULL)["cagr_pct"], "last2_total_return_pct": L.metrics(bills, *L.LAST2)["total_return_pct"], "expected": [1.77, 8.2]},
          "entry_experiment_slow_walk_max_gap": float(walk_gap),
          "rule_in_share_of_sessions_full_pct": r1(100 * in_full.mean()), "rule_in_share_of_sessions_last2_pct": r1(100 * IN[LAST2_I:I1 + 1].mean()),
          "rule_turns_in_full": turns_in, "sector_funds_counted_at_start": int(have.iloc[I0].sum()), "sector_funds_counted_at_end": int(have.iloc[I1].sum()),
          "rule_in_at_start": bool(IN[I0]), "thirds_rule_would_also_be_fully_invested_by_start": bool(full_by_start), "last_out_session_before_start": None if prev_out is None else D.dates[prev_out]}

EP = episode_summary(log, L.FULL[0]); BC = breakout["counts"]
RULE_NOTE = "OUT (all in Treasury bills) only when SPY closes under its 200-day average AND fewer than half of the sector funds are above their own 200-day average; IN otherwise"
variants = [
    {**L.report(sim3, D, "Trend rule on SPY — buy back in thirds at price levels",
                RULE_NOTE + ". When the rule turns IN: buy a third; add a third on the first later close at or under SPY's 21-day average and the last third on the first later close at or under its 50-day average; anything not bought 63 sessions after the turn is bought then; sell everything if the rule turns OUT"), "key": "reenter_in_thirds"},
    {**L.report(sim1, D, "Trend rule on SPY — buy back all at once", RULE_NOTE + ". When the rule turns IN, go straight back to 100% SPY"), "key": "reenter_at_once"},
]
BH = {"full": L.metrics(bh, *L.FULL), "last2": L.metrics(bh, *L.LAST2)}
out = {
    "structure": "s5_level_scaling",
    "title": "Buying in parts at price levels (the 21-day and 50-day averages) instead of all at once",
    "rule_plain": [
        "The question: when you are in cash and want to own a fund, is it better to buy it all today, to buy it in three parts by the calendar, or to buy it in three parts as the price comes back down to its average lines?",
        "The two lines are the 21-day average (an exponential average, which leans on the most recent days — roughly the last month of trading) and the 50-day average (a simple average of the last 50 closes — roughly the last ten weeks).",
        "The entry experiment: on the first trading day of every month since January 2005, for SPY, QQQ and SMH, 1.00 of cash is put to work five ways and valued about six months (126 sessions) and about a year (252 sessions) later. Waiting cash earns the Treasury-bill rate.",
        "All at once: buy everything at day one's close. Calendar thirds: a third on day one, a third 21 sessions later, a third 42 sessions later.",
        "Level thirds: a third on day one; one buy order left resting at the 21-day average and one at the 50-day average. Each order is set from the previous close's average, so its price is known before the day opens; it fills if that day's low reaches it (at the open if the price gaps under it). If the price is already at or under a line on day one, that third is bought on day one. A third that never fills stays in bills — it never chases.",
        "Level thirds with a deadline: the same, but any third still not bought 63 sessions (about three months) after day one is bought at that day's close.",
        "Wait for the pullback with everything: all the money sits on one resting order at the 50-day average, with no deadline (the cash-by-default habit). If the price is already at or under that line on day one, everything is bought that day.",
        "The breakout retest check: for the ten breakouts of the last two years (first daily close above a confirmed 2-week pivot high), did the low come back to within 0.5% of the broken line in the next 20 sessions, and did buying half at the breakout and half on a resting order just above the line beat buying it all at the breakout?",
        "The two continuous runs for the comparison table use one simple in-or-out rule on SPY: " + RULE_NOTE + ". One run buys back everything when the rule turns IN; the other buys back in thirds at the same two lines, with the 63-session deadline, checked on closing prices.",
        "In the two continuous runs every decision is taken at a close and traded at the next session's close, and each order costs 0.05% of the amount traded.",
    ],
    "variants": variants,
    "extras": {"entry_experiment": entry, "breakout_retests": breakout,
               "reentry_episodes": {"what": "Every time the in-or-out rule turned IN, and how the buy-back in thirds went. Dates are the closes at which the rule decided; the trade is at the next close.",
                                    "full": EP, "last2": episode_summary(log, L.LAST2[0]),
                                    "last2_log": [x for x in log if x["turn"] >= L.LAST2[0]]},
               "buy_and_hold_spy": {w: {k: BH[w][k] for k in ["cagr_pct", "total_return_pct", "max_dd_pct", "avg_stock_pct"]} for w in BH},
               "checks": checks},
    "caveats": [
        "The monthly start dates overlap heavily: a six-month result shares five of its six months with the next start's result. About 260 starts per fund are far fewer than 260 independent tests.",
        "2005 to 2026 was, on balance, a strongly rising market for all three funds. In a rising market any method that waits tends to lose to buying at once, simply because it spends less time invested. A long falling market would favour the waiting methods.",
        "The average lines move. In a rising market the 50-day average climbs while you wait, so an order that fills 'on the pullback' often fills at a higher price than day one's close (the resting_order_behaviour table shows how often).",
        "A resting order is counted as filled whenever the day's low touched its price. In real trading an order that is only just touched can go unfilled, so the level methods are flattered slightly.",
        "The entry experiment and the breakout check charge no trading costs (the cost would be at most 0.05% of the money, nearly the same for every method). The two continuous runs do charge costs.",
        "The last-two-years table has few start dates, all in a market that mostly rose, and they overlap; read it as an illustration, not as proof.",
        f"The breakout check is only {BC['events']} events in two funds over two years. In {BC['break_close_already_inside_band']} of the {BC['events']}, the breakout close was itself already inside the 0.5% band above the line, so 'coming back to within 0.5%' mostly means the price had not yet left ({BC['retest_on_session_1']} of the retests are on the very next session) — it is not evidence that breakouts usually pull back. The extra columns for a return to the line itself are the stricter test: that happened in {BC['came_back_to_the_line_itself_of_complete']} of the {BC['events_with_20_full_sessions']} breakouts that have 20 full sessions behind them.",
        *[f"The breakout of {r['sym']} on {r['break_date']} has only {r['sessions_measured']} session(s) after it in the data; it is shown but left out of the averages." for r in breakout["events"] if not r["complete_20_sessions"]],
        "In the two continuous runs the levels are checked on closing prices and traded a session later, so they are not the same thing as the resting intraday orders of the entry experiment.",
        f"The in-or-out rule changes its mind often around the 200-day average: it turned IN {EP['turns_in']} times, and {EP['sold_again_within_5_sessions']} of those were sold again within 5 sessions. In {EP['sold_again_with_one_third']} of the {EP['turns_in']} the thirds version was sold again with only one third bought. So its smaller falls owe a lot to simply holding less during those flips, which is a different thing from 'buying at better prices'.",
        "When the rule turns IN, SPY is often still under its 21-day and 50-day averages, so the second and last thirds are bought within a day or two; in a sharp V-shaped recovery the opposite happens and the thirds version sits two-thirds in cash for weeks while the market runs (May to August 2025 is the example in the last two years).",
        f"Both continuous runs made less than simply holding SPY: {variants[0]['full']['cagr_pct']}% a year (thirds) and {variants[1]['full']['cagr_pct']}% (at once) against {BH['full']['cagr_pct']}% for holding SPY since 2005, and {variants[0]['last2']['total_return_pct']}% and {variants[1]['last2']['total_return_pct']}% against {BH['last2']['total_return_pct']}% over the last two years (holding SPY also fell {abs(BH['full']['max_dd_pct'])}% at its worst, against {abs(variants[0]['full']['max_dd_pct'])}% and {abs(variants[1]['full']['max_dd_pct'])}%). They are here to compare buying back at once with buying back in thirds, not as a recommended rule.",
        "Both continuous runs start fully invested on 3 Jan 2005 because the rule was already IN on that day (it had last turned IN in October 2004).",
        "This is a study of past prices only. It places no orders and is not advice.",
    ],
}
L.save("s5_level_scaling.json", out)

# ───────────────────────────── summary ─────────────────────────────
for v in out["variants"]:
    f, l = v["full"], v["last2"]
    print(f"{v['label'][:54]:54s} FULL cagr {f['cagr_pct']:6.2f} dd {f['max_dd_pct']:6.1f} stock {f['avg_stock_pct']:5.1f} | LAST2 ret {l['total_return_pct']:6.1f} dd {l['max_dd_pct']:6.1f} stock {l['avg_stock_pct']:5.1f} dec/mo {l['decision_days_per_month']}")
print("checks", checks)
print("episodes FULL", out["extras"]["reentry_episodes"]["full"]); print("episodes LAST2", out["extras"]["reentry_episodes"]["last2"])
def show(title, rows):
    print(f"\n{title}\n{'fund':12s} {'H':>3s} {'m':2s} {'n':>4s} {'mean':>7s} {'median':>7s} {'>lump%':>6s} {'tie%':>5s} {'gap':>6s} {'medgap':>6s} {'uninv%':>6s} {'time%':>6s} {'miss%':>6s} {'worst':>7s}")
    for r in rows:
        g = lambda k, w, p: (f"{r[k]:{w}.{p}f}" if r[k] is not None else " " * (w - 1) + "-")
        print(f"{r['asset']:12s} {r['horizon']:3d} {r['method']:2s} {r['starts']:4d} {r['mean_pct']:7.2f} {r['median_pct']:7.2f} {g('above_lump_share_pct', 6, 1)} {g('tied_with_lump_share_pct', 5, 1)} {g('mean_gap_pts', 6, 2)} {g('median_gap_pts', 6, 2)} {r['uninvested_end_pct']:6.1f} {r['time_invested_pct']:6.1f} {r['missed_leg_pct']:6.1f} {r['worst_pct']:7.2f}")
show("ENTRY EXPERIMENT — all monthly starts (per-fund above/below-200-day tables are in the JSON)", tables["all"])
for sub, title in [("all", "all starts"), ("above_200_day", "start close ABOVE the 200-day average"), ("below_200_day", "start close BELOW the 200-day average")]:
    show("THREE FUNDS POOLED — " + title, [r for r in pooled if r["subset"] == sub])
show(f"LAST2 starts, H=126 ({len(l2)} starts {l2[0]} to {l2[-1]}; above/below 200-day at the start: {l2_split})", tables["last2_h126"])
print("\nRESTING ORDERS (level thirds, no deadline; six-month horizon)")
for r in fills:
    if r["horizon"] == 126: print(f"{r['asset']:4s} {r['line']:20s} under on day one {r['already_under_line_on_day_one_pct']:5.1f}%  filled later {r['filled_later_pct']:5.1f}%  never {r['never_filled_pct']:4.1f}%  still waiting after 63 {r['still_waiting_after_63_sessions_pct']:4.1f}%  median wait {r['median_wait_sessions']}  fill vs day-one price {r['median_fill_price_vs_day_one_pct']}%  filled higher than day one {r['later_fills_at_a_higher_price_than_day_one_pct']}%")
for k, x in examples.items(): print(k, x)
print("\nBREAKOUT RETESTS")
for r in breakout["events"]:
    print(f"{r['sym']:4s} {r['break_date']} level {r['level']:7.2f} close {r['break_close']:7.2f} (+{r['break_close_over_level_pct']:.2f}%) inside-band {str(r['break_close_already_inside_band']):5s} retest {str(r['retest_session']):>4s} line-touch {str(r['line_touch_session']):>4s} | n={r['sessions_measured']:2d} all {r['all_at_break_pct']:6.2f} half/half {r['half_and_half_pct']:6.2f} half@line {r['half_at_the_line_itself_pct']:6.2f}")
print(breakout["counts"])
