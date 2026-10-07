# PF1 · structure 3 — DUAL MOMENTUM (Gary Antonacci). "Relative momentum": hold the stronger fund. "Absolute momentum": unless
# even the stronger one made no more than Treasury bills, in which case hold bonds. Read once a month at the last close of the
# month, filled at the next session's close. Never in cash: always in shares or in 7-10 year Treasury bonds (IEF).
#
# NO HINDSIGHT: every reading at row i is tr[i] / tr[i - n] - 1 (L.trailing_tr, a backward shift only) and bills' return over the
# same n sessions; decide(i) reads row i of those arrays and nothing later. The start holding is the rule's reading at the close
# of the session BEFORE the start date (2004-12-31, a month end), filled at the start date's close like any other order.
import time
from collections import Counter
import numpy as np
import pf1lib as L

T0 = time.time(); D = L.load(); BOND = "IEF"; I0, I1 = D.ix[L.FULL[0]], D.ix[L.FULL[1]]
MONTH_ENDS = {D.ix[d] for d in L.month_ends(D, D.dates[0], L.FULL[1])}   # the list's last entry is the data's last bar; the simulator never asks for a decision there
USED = ["SPY", "QQQ", "EFA", BOND] + L.SECTORS


def split_patch(sym, day, ratio):
    """EFA's 3-for-1 share split of 9 Jun 2005 is NOT adjusted in data/bars_*.csv.gz (close 157.00 -> 52.54) although its
    dividends are. Left alone it reads as a 66% one-day loss. This divides the earlier bars by 3 IN MEMORY ONLY (no file is
    touched) and rebuilds that one symbol's returns with the library's own formulas. It does nothing once the bars are fixed."""
    i = D.ix[day]; jump = float(D.c[sym].iloc[i] / D.c[sym].iloc[i - 1])
    if jump > 0.6: return {"sym": sym, "date": day, "applied": False, "close_ratio_found": round(jump, 4)}
    before = float(D.c[sym].iloc[i - 1])
    for k in "ohlc":
        f = getattr(D, k); j = f.columns.get_loc(sym); f.iloc[:i, j] = f.iloc[:i, j] / ratio
    c = D.c[sym]; D.ret[sym] = (c + D.div[sym]) / c.shift(1) - 1.0; D.pret[sym] = c / c.shift(1) - 1.0
    D.tr[sym] = (1.0 + D.ret[sym].fillna(0.0)).cumprod().where(c.notna())
    return {"sym": sym, "date": day, "applied": True, "ratio": ratio, "close_before": before, "close_on_day": float(c.iloc[i]),
            "one_day_return_as_stored_pct": round(100 * (jump - 1), 1), "one_day_return_after_patch_pct": round(100 * float(D.ret[sym].iloc[i]), 2)}


def lookback(spans):
    """The yardstick: the average of the total returns over each span (one span = the plain n-session return), and bills' the same way."""
    ret = {s: np.mean([L.trailing_tr(D, s, n).to_numpy() for n in spans], axis=0) for s in USED}
    return ret, np.mean([L.cash_trailing(D, n).to_numpy() for n in spans], axis=0)


# ---- the four rules. Each returns the list of "slots" to hold (equal shares): one slot = 100% in one fund.
def best_or_bond(ret, bills, syms):
    def rule(i):
        assert all(np.isfinite(ret[s][i]) for s in syms) and np.isfinite(bills[i]), f"missing reading on {D.dates[i]}"
        best = max(syms, key=lambda s: ret[s][i]); return [best if ret[best][i] > bills[i] else BOND]
    return rule

def classic(ret, bills):                                   # Antonacci's GEM: the bills test is on the US fund alone, then US against overseas
    def rule(i):
        assert all(np.isfinite(ret[s][i]) for s in ("SPY", "EFA")) and np.isfinite(bills[i]), f"missing reading on {D.dates[i]}"
        if not ret["SPY"][i] > bills[i]: return [BOND]
        return ["SPY" if ret["SPY"][i] >= ret["EFA"][i] else "EFA"]
    return rule

def sectors(ret, bills):                                   # a sector fund is ranked only once it has 252 sessions of history (its reading is not blank)
    def rule(i):
        ok = [s for s in L.SECTORS if np.isfinite(ret[s][i])]; top = sorted(ok, key=lambda s: -ret[s][i])[:3]
        return [s if ret[s][i] > bills[i] else BOND for s in top]
    return rule


def plain(slots): return " + ".join(sorted(slots, key=lambda s: (s == BOND, s))) if slots else "cash"
def target(slots): return {s: slots.count(s) / len(slots) for s in set(slots)}


def run(rule, name, rows, band=0.02):
    """One continuous FULL-window run. `rows` = the row numbers on which the rule is read. A new order goes in only when the
    holding changes, or (several holdings) when one has drifted more than 2 points from its share."""
    held = {"slots": rule(I0 - 1)}; sw = []; W = {}; last_fill = {}
    def decide(i, d, w):
        W[i] = w
        if i not in rows: return None
        new = rule(i); t = target(new); changed = sorted(new) != sorted(held["slots"])
        if not changed and all(abs(w.get(s, 0.0) - x) <= band for s, x in t.items()): return None
        if changed:
            sw.append({"decided": d, "filled": D.dates[i + 1], "from": plain(held["slots"]), "to": plain(new),
                       "funds_replaced": sum((Counter(new) - Counter(held["slots"])).values())})
            held["slots"] = new
        last_fill[i + 1] = t; return t
    sim = L.simulate(D, decide, *L.FULL, initial=target(held["slots"]), name=name)
    W[I1] = last_fill.get(I1, W[I1 - 1])                    # the simulator does not call decide on the last session
    return sim, sw, W


def in_window(sw, a, b): return [x for x in sw if a < x["filled"] <= b]
def shares(W, a, b):
    rows = range(D.ix[a], D.ix[b] + 1); tot = Counter()
    for i in rows:
        for s, x in W[i].items(): tot[s] += x
    return {s: round(100 * float(x) / len(rows), 1) for s, x in sorted(tot.items(), key=lambda kv: -kv[1]) if 100 * x / len(rows) >= 0.05}
def facts(sim, sw, W):
    l2 = in_window(sw, *L.LAST2)
    return {"switches_full": len(sw), "switches_last2": len(l2), "switches_per_year_full": round(len(sw) / ((I1 - I0) / 252.0), 2),
            "funds_replaced_full": sum(x["funds_replaced"] for x in sw), "funds_replaced_last2": sum(x["funds_replaced"] for x in l2),
            "share_of_sessions_full_pct": shares(W, *L.FULL), "share_of_sessions_last2_pct": shares(W, *L.LAST2),
            "last2_switches": l2, "holding_at_last2_start": plain(sorted(s for s, x in W[D.ix[L.LAST2[0]]].items() if s != "CASH" and x > 0.05)),
            "holding_now": plain(sorted(s for s, x in W[I1].items() if s != "CASH" and x > 0.05)), "held_since": sw[-1]["filled"] if sw else L.FULL[0],
            "start_holding": sw[0]["from"] if sw else plain(sorted(s for s, x in W[I0].items() if s != "CASH" and x > 0.05))}
def brief(sim):
    f, l = L.metrics(sim, *L.FULL), L.metrics(sim, *L.LAST2)
    return {"full_cagr_pct": float(f["cagr_pct"]), "full_max_dd_pct": float(f["max_dd_pct"]), "last2_total_return_pct": float(l["total_return_pct"]), "last2_max_dd_pct": float(l["max_dd_pct"])}
def bond_spells(sw):
    """Each stay in bonds (one-holding rules): from the close it was bought to the close it was sold, and what the share funds did meanwhile."""
    out = []; a = L.FULL[0] if (sw[0]["from"] if sw else "") == BOND else None
    for x in sw + [{"filled": L.FULL[1], "from": BOND if (sw and sw[-1]["to"] == BOND) else "", "to": "", "open": True}]:
        if x["from"] == BOND and a:
            b = x["filled"]; out.append({"from": a, "to": b, "still_held": bool(x.get("open")), "sessions": D.ix[b] - D.ix[a],
                                         **{f"{s.lower()}_pct": round(100 * float(D.tr[s][b] / D.tr[s][a] - 1), 1) for s in (BOND, "SPY", "QQQ")}}); a = None
        if x["to"] == BOND: a = x["filled"]
    return out


# ---- the published version on the bars exactly as stored (before the EFA split is patched), so the size of the data fault is on record
ret_raw, bills_raw = lookback([252]); raw_sim, raw_sw, _ = run(classic(ret_raw, bills_raw), "dm_classic_raw", MONTH_ENDS)
raw = {**brief(raw_sim), "switches_full": len(raw_sw), "efa_252_session_return_on_2005_06_30_pct": round(100 * float(ret_raw["EFA"][D.ix["2005-06-30"]]), 1)}
patch = split_patch("EFA", "2005-06-09", 3.0)

R, B = lookback([252]); RB, BB = lookback([63, 126, 252])
VARIANTS = [
    ("dm_spy_qqq", best_or_bond(R, B, ["SPY", "QQQ"]), "Dual momentum — the stronger of SPY and QQQ, or bonds",
     "each month end: all of it in whichever of SPY (the S&P 500) and QQQ (the Nasdaq 100) made more over the past year (252 trading days, dividends included); if even that one made no more than Treasury bills, all of it in 7-10 year Treasury bonds (IEF)"),
    ("dm_classic", classic(R, B), "Dual momentum as published — US or overseas shares, or bonds",
     "Antonacci's published rule with our funds: if SPY made more than Treasury bills over the past year, hold whichever of SPY and EFA (developed markets outside the US) made more; otherwise hold 7-10 year Treasury bonds (IEF)"),
    ("dm_sectors", sectors(R, B), "Dual momentum across sectors — the top three sector funds, a third each",
     "each month end: the three sector funds with the best past-year return, one third each; any of the three that made no more than Treasury bills has its third in 7-10 year Treasury bonds (IEF) instead; re-weighted to thirds when the three change or one drifts more than 2 points"),
    ("dm_spy_qqq_blend", best_or_bond(RB, BB, ["SPY", "QQQ"]), "Dual momentum, SPY or QQQ — blended yardstick (3, 6 and 12 months averaged)",
     "the first rule, but 'how much it made' is the average of its returns over the past 63, 126 and 252 trading days (about 3, 6 and 12 months), and Treasury bills are measured the same way"),
]
out = {"structure": "s3_dual_momentum", "title": "Dual momentum — hold the stronger fund, or bonds when even it is behind cash",
       "rule_plain": [
           "Once a month, at the last close of the month, measure how much each fund made over the past year (252 trading days, dividends included).",
           "Hold the one that made the most, with the whole account in that single fund (this is 'relative momentum': own the stronger one).",
           "But if even the winner made no more than Treasury bills (cash) over that same year, hold 7-10 year Treasury bonds (the fund IEF) instead (this is 'absolute momentum': is it even beating cash?).",
           "Any change is made at the next session's close. Nothing is looked at between month ends, however far the market moves.",
           "The headline version chooses between SPY (the S&P 500) and QQQ (the Nasdaq 100). The published version chooses between SPY and EFA (developed markets outside the US). The sector version holds the top three of the eleven US sector funds, a third each. The blended version averages the 3-, 6- and 12-month returns instead of using 12 months alone.",
           "The rule is never in cash: it is always in shares or in bonds. The starting holding on 3 Jan 2005 is what the rule read at the previous close (31 Dec 2004).",
           "Every order pays 0.05% of the amount traded, so one full switch costs about 0.10% of the account. No taxes are counted.",
       ], "variants": [], "extras": {"by_variant": {}}, "caveats": []}
runs = {}
for key, rule, label, note in VARIANTS:
    sim, sw, W = run(rule, key, MONTH_ENDS); runs[key] = (sim, sw, W)
    r = L.report(sim, D, label, note); r["key"] = key; out["variants"].append(r); out["extras"]["by_variant"][key] = facts(sim, sw, W)
    if key != "dm_sectors": out["extras"]["by_variant"][key]["bond_spells"] = bond_spells(sw)
out["extras"]["by_variant"]["dm_sectors"]["note"] = "a 'switch' here is a month end on which the three holdings changed (funds_replaced counts the funds swapped); 'share of sessions' is the average share of the account in each fund"

# ---- timing luck: the headline rule read every 21 sessions instead of at month ends, starting 0 / 5 / 10 / 15 sessions into the FULL window
def luck(k):
    sim, sw, _ = run(VARIANTS[0][1], f"luck{k}", set(range(I0 + k, I1 + 1, 21)))
    return {"offset_sessions": k, "first_reading": D.dates[I0 + k], **brief(sim), "switches_full": len(sw), "switches_last2": len(in_window(sw, *L.LAST2))}
def spread(rows, fields=("full_cagr_pct", "full_max_dd_pct", "last2_total_return_pct")):
    return {f: {"best": max(r[f] for r in rows), "worst": min(r[f] for r in rows), "spread": round(max(r[f] for r in rows) - min(r[f] for r in rows), 2)} for f in fields}
four = [luck(k) for k in (0, 5, 10, 15)]; every = [luck(k) for k in range(21)]; me_run = brief(runs["dm_spy_qqq"][0])
out["extras"]["timing_luck"] = {
    "what": "the headline rule (stronger of SPY and QQQ, or bonds), read every 21 sessions instead of at month ends, starting 0, 5, 10 and 15 sessions after 3 Jan 2005 — the same rule, only the day of the month differs",
    "runs": four, "spread": spread(four), "month_end_run": {**me_run, "switches_full": len(runs["dm_spy_qqq"][1]), "switches_last2": len(in_window(runs["dm_spy_qqq"][1], *L.LAST2))},
    "all_21_offsets": {"what": "not asked for, added as a cross-check: the same test for every possible starting day, 0 to 20 sessions", "spread": spread(every),
                       "month_end_beats_n_of_21": {f: sum(r[f] < me_run[f] for r in every) for f in ("full_cagr_pct", "last2_total_return_pct")},
                       "median": {f: round(float(np.median([r[f] for r in every])), 2) for f in ("full_cagr_pct", "full_max_dd_pct", "last2_total_return_pct")},
                       "runs": [{k: r[k] for k in ("offset_sessions", "full_cagr_pct", "full_max_dd_pct", "last2_total_return_pct")} for r in every]}}

# ---- what each yardstick read at the last month end (the reading the current holding rests on) and at the latest close
def reading(i): return {"date": D.dates[i], "past_year_pct": {s: round(100 * float(R[s][i]), 1) for s in ["SPY", "QQQ", "EFA", BOND] + L.SECTORS}, "bills_past_year_pct": round(100 * float(B[i]), 1),
                        "blend_pct": {s: round(100 * float(RB[s][i]), 1) for s in ("SPY", "QQQ")}, "bills_blend_pct": round(100 * float(BB[i]), 1), "rule_says": {k: plain(rule(i)) for k, rule, _, _ in VARIANTS}}
out["extras"]["readings"] = {"last_month_end": reading(max(i for i in MONTH_ENDS if i < I1)), "latest_close": reading(I1)}

# ---- self-checks: the same engine told "always SPY" must equal buy and hold; told "hold nothing" must equal bills
spy_sim = run(lambda i: ["SPY"], "check_spy", MONTH_ENDS)[0]; cash_sim = run(lambda i: [], "check_cash", MONTH_ENDS)[0]; bh = L.fixed_mix(D, {"SPY": 1.0}, monthly=False); bhq = brief(L.fixed_mix(D, {"QQQ": 1.0}, monthly=False))
out["extras"]["self_check"] = {"always_spy": brief(spy_sim), "buy_and_hold_spy": brief(bh), "hold_nothing": brief(cash_sim),
                               "buy_and_hold_qqq": bhq, "avg_stock_matches_share_of_sessions": {k: [float(out["variants"][n]["full"]["avg_stock_pct"]), round(sum(x for s, x in out["extras"]["by_variant"][k]["share_of_sessions_full_pct"].items() if s in L.STOCKLIKE), 1)] for n, (k, _, _, _) in enumerate(VARIANTS)}}
assert abs(spy_sim["equity"].iloc[-1] / bh["equity"].iloc[-1] - 1) < 1e-9, "always-SPY does not match buy and hold"
out["extras"]["data_patch"] = {"efa_split": patch, "dm_classic_on_bars_as_stored": raw,
                               "why": "EFA's 3-for-1 split of 9 Jun 2005 is not adjusted in the stored bars; as stored, the published version is holding EFA that day and books a 66% one-day loss that never happened"}

h = out["extras"]["by_variant"]; tl = out["extras"]["timing_luck"]; a21 = tl["all_21_offsets"]; v0 = out["variants"][0]
out["caveats"] = [
    "Bonds here are IEF (7-10 year Treasuries). Antonacci's published rule uses a broad bond fund (AGG), but AGG has no dividend history in our tables, so its total return cannot be built. IEF moves more than a broad bond fund when interest rates move, in both directions.",
    "The published rule compares the US with ALL markets outside the US; our overseas fund is EFA, which covers developed markets only (no emerging markets).",
    "EFA's 3-for-1 share split of 9 Jun 2005 was not adjusted in the stored prices: a 66% one-day loss that never happened. The study's own copy of the prices is repaired (earlier EFA prices divided by 3; the repair is listed in the page specs). Only the published version uses EFA.",
    f"Timing luck: the same headline rule read every 21 sessions, starting on a different day, gives {tl['spread']['full_cagr_pct']['worst']}% to {tl['spread']['full_cagr_pct']['best']}% a year over the full window, a worst fall of {tl['spread']['full_max_dd_pct']['worst']}% to {tl['spread']['full_max_dd_pct']['best']}%, and {tl['spread']['last2_total_return_pct']['worst']}% to {tl['spread']['last2_total_return_pct']['best']}% over the last two years. The month-end figure is one draw from that range, not the answer."
    + f" Tried on all 21 possible days, the range is {a21['spread']['full_cagr_pct']['worst']}% to {a21['spread']['full_cagr_pct']['best']}% a year (middle {a21['median']['full_cagr_pct']}%), and the month-end run ({me_run['full_cagr_pct']}%) beats {a21['month_end_beats_n_of_21']['full_cagr_pct']} of the 21: the headline number sits at the lucky end of the range, about a point a year above the middle.",
    f"The last two years hold very few decisions: {h['dm_spy_qqq']['switches_last2']} switches for the headline rule, {h['dm_classic']['switches_last2']} for the published one. Two years cannot show whether the rule works; the full window ({h['dm_spy_qqq']['switches_full']} switches in almost 22 years) is the better guide and even that is a small number.",
    "The whole account sits in ONE fund (three in the sector version). When it is in shares it takes the full fall of that fund until the next month end; the rule only steps aside after a year-long return has dropped below cash, which is slow. Fast falls (2020) are over before it reacts.",
    "'Bonds' is not 'safe': in 2022 shares and bonds fell together. The headline rule moved to bonds in May 2022 and stayed a year; the bond fund lost money over that stay (see bond_spells), and the year 2022 still ended " + f"{v0['years']['2022']}%.",
    f"SPY and QQQ were chosen today, knowing QQQ was the big winner of these 22 years; the headline rule sat in QQQ {h['dm_spy_qqq']['share_of_sessions_full_pct'].get('QQQ', 0)}% of the time. Simply holding QQQ made {bhq['full_cagr_pct']}% a year (worst fall {bhq['full_max_dd_pct']}%) against the rule's {v0['full']['cagr_pct']}% (worst fall {v0['full']['max_dd_pct']}%): the rule did not add return over QQQ, it cut the worst fall. The published version, which has no QQQ, made {out['variants'][1]['full']['cagr_pct']}% a year — less than holding SPY ({brief(bh)['full_cagr_pct']}%).",
    "252 trading days stands in for Antonacci's 12 calendar months; the two differ by a day or two. The sector funds XLRE (from Oct 2015) and XLC (from Jun 2018) join the ranking only once they have 252 sessions of history, so the sector list is 9 funds until late 2016 and 11 only from mid 2019.",
    "No taxes: every switch out of a winning fund would realise a gain in a taxable account.",
]
out["extras"]["runtime_seconds"] = round(time.time() - T0, 1)
L.save("s3_dual_momentum.json", out)

fl = lambda d: {k: float(v) for k, v in d.items()}
for v in out["variants"]:
    f, l = v["full"], v["last2"]
    print(f"{v['key']:17s} FULL cagr {f['cagr_pct']:6.2f} dd {f['max_dd_pct']:6.1f} stock {f['avg_stock_pct']:5.1f} | LAST2 ret {l['total_return_pct']:6.1f} dd {l['max_dd_pct']:6.1f} stock {l['avg_stock_pct']:5.1f} dec/mo {l['decision_days_per_month']:.2f} | stress {fl(v['stress'])}")
for k, x in h.items():
    print(f"{k:17s} switches full {x['switches_full']:3d} last2 {x['switches_last2']:2d} | full {x['share_of_sessions_full_pct']} | last2 {x['share_of_sessions_last2_pct']} | now {x['holding_now']} since {x['held_since']}")
    for y in x["last2_switches"]: print(f"{'':17s}   {y['decided']} -> filled {y['filled']}: {y['from']} -> {y['to']}")
for r in four: print(f"timing luck  offset {r['offset_sessions']:2d} (first reading {r['first_reading']})  FULL cagr {r['full_cagr_pct']:6.2f} dd {r['full_max_dd_pct']:6.1f} | LAST2 ret {r['last2_total_return_pct']:6.1f} | switches {r['switches_full']}")
print(f"timing luck  month end{'':28s} FULL cagr {me_run['full_cagr_pct']:6.2f} dd {me_run['full_max_dd_pct']:6.1f} | LAST2 ret {me_run['last2_total_return_pct']:6.1f} | switches {len(runs['dm_spy_qqq'][1])}")
print("timing luck  spread best-worst (4 offsets):", {k: v["spread"] for k, v in tl["spread"].items()}, "| all 21 offsets worst/median/best:", {k: (v["worst"], a21["median"][k], v["best"]) for k, v in a21["spread"].items()}, "| month end beats", a21["month_end_beats_n_of_21"], "of 21")
print("bond spells (headline):", [(b["from"], b["to"], b["ief_pct"], b["spy_pct"], b["qqq_pct"]) for b in h["dm_spy_qqq"]["bond_spells"]])
print("self check: always-SPY", out["extras"]["self_check"]["always_spy"], "| buy and hold SPY", out["extras"]["self_check"]["buy_and_hold_spy"], "| hold nothing", out["extras"]["self_check"]["hold_nothing"])
print("EFA split patch:", patch, "| published version on the bars as stored:", raw)
print("rule says at last month end:", out["extras"]["readings"]["last_month_end"]["rule_says"], "| runtime", out["extras"]["runtime_seconds"], "s")
