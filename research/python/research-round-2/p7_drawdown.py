"""P7 · Drawdown and recovery as survival curves, and what follows a parabolic run.

Stolen from: Goldberg & Mahmoud (2017), "Drawdown: from practice to theory and back again" (https://arxiv.org/abs/1404.7493);
Bailey & López de Prado (2014), "Drawdown-based stop-outs and the triple penance rule" (https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2201302):
under their assumptions the time spent climbing back after the deepest point is about three times the time spent falling to it;
Greenwood, Shleifer & You (2019), "Bubbles for Fama", JFE (NBER w23191, https://www.nber.org/papers/w23191): after an industry
doubles in two years, how often does a 40% crash follow within two years?

Drawdown spells: from a closing high until the close first gets back to that high.  Depth = the worst close in the spell.
Open spells (still under water at the last bar) are CENSORED, never dropped (R9): the survival curves are Kaplan–Meier.
Parabolic runs: the trailing 2-year (504-session) return first crossing +100% (also +150%, +200%); one event per instrument per
two years.  Outcome: did the price fall 40% from its highest close in the 2 years after the event (GSY's crash), and did it fall
40% below the event's own close; time to that fall as a survival curve, censored when fewer than 2 years have passed.
Base rate: the same outcome measured from EVERY day of the same instruments.  Pools: the point-in-time S&P 500 members (no
survivorship: every name that was in the index on the event day, including the ones that later left), commodities, crypto,
semis and today's leaders (survivors, a list).  R3: events are counted by instrument and by calendar year (the 1999-2000 run is
one cluster, not forty coin flips); ranges resample whole years.
"""
import os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import rr_lib as L
S = L.S

DEPTHS = (10, 20, 30, 50)
RUNUPS = (100, 150, 200)
H = 504


def spells(close, member=None):
    """Drawdown spells of at least 10%: peak date, depth, sessions to the low, sessions from low back to the peak (None if open)."""
    c = close.values; idx = close.index; out = []
    peak_i, low_i, in_dd = 0, 0, False
    for i in range(1, len(c)):
        if c[i] >= c[peak_i]:
            if in_dd:
                depth = c[low_i] / c[peak_i] - 1
                if depth <= -0.10:
                    out.append((peak_i, low_i, i, depth))
            peak_i, low_i, in_dd = i, i, False
        else:
            in_dd = True
            if c[i] < c[low_i]: low_i = i   # low_i was reset to the peak, so the first close under it becomes the low
    if in_dd:
        depth = c[low_i] / c[peak_i] - 1
        if depth <= -0.10: out.append((peak_i, low_i, None, depth))
    rows = []
    for p, lo, rec, d in out:
        if member is not None and not bool(member.iloc[p]): continue   # point in time: the spell must START while a member
        rows.append({"peak": str(idx[p].date()), "low": str(idx[lo].date()), "recovered": str(idx[rec].date()) if rec is not None else None,
                     "depth_pct": round(100 * d, 1), "to_low": int(lo - p), "low_to_back": int(rec - lo) if rec is not None else None,
                     "under_water": int((rec if rec is not None else len(c) - 1) - p), "open": rec is None})
    return rows


def km(durations, observed, grid):
    """Kaplan–Meier survival S(t) on the grid (share still under water / not yet crashed at t)."""
    d = np.asarray(durations, float); o = np.asarray(observed, bool)
    times = np.unique(d[o]); Sv, s = [], 1.0; surv = {}
    for t in times:
        at_risk = (d >= t).sum(); ev = ((d == t) & o).sum()
        if at_risk > 0: s *= 1 - ev / at_risk
        surv[t] = s
    out = []
    for g in grid:
        ks = [t for t in times if t <= g]; out.append(surv[ks[-1]] if ks else 1.0)
    return np.array(out)


def km_median(durations, observed):
    grid = np.arange(0, int(max(durations) + 1)); sv = km(durations, observed, grid)
    below = np.where(sv <= 0.5)[0]
    return int(grid[below[0]]) if len(below) else None


def summarise_spells(rows, depth):
    sel = [r for r in rows if r["depth_pct"] <= -depth]
    if not sel: return None
    dur = [r["under_water"] for r in sel]; obs = [not r["open"] for r in sel]
    grid = [252, 504, 1260]; sv = km(dur, obs, grid)
    rec = [r for r in sel if not r["open"] and r["to_low"] > 0]
    ratio = [r["low_to_back"] / r["to_low"] for r in rec]
    return {"spells": len(sel), "open": int(sum(not o for o in obs)), "median_under_water_sessions_km": km_median(dur, obs),
            "back_within_1y_pct": L.r(100 * (1 - sv[0]), 1), "back_within_2y_pct": L.r(100 * (1 - sv[1]), 1), "back_within_5y_pct": L.r(100 * (1 - sv[2]), 1),
            "median_depth_pct": L.r(float(np.median([r["depth_pct"] for r in sel])), 1),
            "penance_ratio_median": L.r(float(np.median(ratio)), 2) if ratio else None, "penance_ratio_ge3_pct": L.r(100 * float(np.mean(np.array(ratio) >= 3)), 1) if ratio else None,
            "penance_n": len(ratio)}


def run_events(close, thr, member=None):
    """Parabolic-run events on one series: first crossing of the 2-year return over thr%, one per 504 sessions."""
    c = close.values; n = len(c); ev = []
    r2 = np.full(n, np.nan); r2[H:] = c[H:] / c[:-H] - 1
    last = -10 ** 9; prev_above = False
    for i in range(H, n):
        above = r2[i] >= thr / 100
        if above and not prev_above and i - last >= H and (member is None or bool(member.iloc[i])):
            ev.append(i); last = i
        prev_above = above
    out = []
    for i in ev:
        j = min(n - 1, i + H); seg = c[i:j + 1]
        runmax = np.maximum.accumulate(seg); dd_from_peak = seg / runmax - 1; below_event = seg / c[i] - 1
        crash_i = np.where(dd_from_peak <= -0.40)[0]; crash2_i = np.where(below_event <= -0.40)[0]
        complete = (i + H) <= n - 1
        out.append({"date": str(close.index[i].date()), "runup_pct": L.r(100 * r2[i], 0), "complete": complete, "sessions_seen": int(j - i),
                    "crash_from_peak": bool(len(crash_i)), "sessions_to_crash": int(crash_i[0]) if len(crash_i) else None,
                    "fell_40_below_event": bool(len(crash2_i)), "worst_from_event_pct": L.r(100 * below_event.min(), 1),
                    "ret_1y_pct": L.r(100 * (c[i + 252] / c[i] - 1), 1) if i + 252 < n else None, "ret_2y_pct": L.r(100 * (c[i + H] / c[i] - 1), 1) if i + H < n else None,
                    "gain_after_before_crash_pct": L.r(100 * (runmax.max() / c[i] - 1), 1)})
    return out


HALF_BASE = {"2005-2014": [0, 0], "2015-2024": [0, 0]}


def base_rate(close, member=None, step=21, tag=False):
    """Any-day base rate: the same 2-year crash-from-peak outcome measured from every 21st session (monthly, to keep overlap honest)."""
    c = close.values; n = len(c); hits, tot = 0, 0
    for i in range(0, n - H, step):
        if member is not None and not bool(member.iloc[i]): continue
        seg = c[i:i + H + 1]; runmax = np.maximum.accumulate(seg)
        hit = bool((seg / runmax - 1).min() <= -0.40); hits += hit; tot += 1
        if tag and close.index[i].year >= 2005:
            k = "2005-2014" if close.index[i].year < 2015 else "2015-2024"; HALF_BASE[k][0] += hit; HALF_BASE[k][1] += 1
    return hits, tot


def instruments():
    out = [("S&P 500 index since 1928", L.index("^GSPC"), "index"), ("Nasdaq-100 index since 1985", L.index("^NDX"), "index"),
           ("Russell 2000 index since 1987", L.index("^RUT"), "index"), ("SPY", L.best_chart("SPY"), "fund"), ("QQQ (from Apr 2011)", L.qqq(), "fund"),
           ("IWM", L.best_chart("IWM"), "fund")]
    for s, lab in L.D.SECTORS.items(): out.append((f"{s} {lab.lower()}", L.best_chart(s), "sector"))
    out += [("Gold since 1975", L.best_chart("GCUSD"), "gold & silver"), ("Silver since 1970", L.best_chart("SIUSD"), "gold & silver"),
            ("Oil since 2000", L.best_chart("CLUSD"), "oil"), ("Bitcoin since 2013", L.btc(), "bitcoin"), ("TLT long bonds", L.best_chart("TLT"), "bonds"),
            ("SMH semis", L.best_chart("SMH"), "semis"), ("SOXX semis", L.best_chart("SOXX"), "semis")]
    lead, _ = L.pit_leaders(10); out.append(("LEADERS10 (point-in-time top 10)", L.to_close(lead), "leaders basket"))
    for t in ["NVDA", "AVGO", "MU", "TSM", "AMD", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA", "MSTR"]:
        out.append((t, L.best_chart(t), "today's leaders (survivors)"))
    return out


def main():
    RES = {"what": "P7 drawdown survival and parabolic runs", "generated": pd.Timestamp.utcnow().isoformat(), "seed": L.SEED, "horizon_sessions": H,
           "instruments": {}, "groups": {}, "pit_stocks": {}, "runups": {}}
    allspells = {}; closes = {}
    for name, c, g in instruments():
        c = c.dropna(); rows = spells(c); allspells[name] = (g, rows); closes[name] = (g, c)
        cur = rows[-1] if rows and rows[-1]["open"] else None
        RES["instruments"][name] = {"group": g, "from": str(c.index[0].date()), "by_depth": {d: summarise_spells(rows, d) for d in DEPTHS},
                                    "worst": min(rows, key=lambda r: r["depth_pct"]) if rows else None, "open_now": cur,
                                    "below_high_now_pct": L.r(100 * (c.iloc[-1] / c.max() - 1), 1), "spells_20": [r for r in rows if r["depth_pct"] <= -20]}
    # point-in-time S&P 500 members: every spell that started while the name was in the index (no survivorship)
    C, M = L.pit_panel(); pit_rows = []; pit_events = {t: [] for t in RUNUPS}; pit_base = [0, 0]
    for sym in C.columns:
        s = C[sym].dropna()
        if len(s) < 300: continue
        m = M[sym].reindex(s.index).fillna(False)
        rr = spells(s, m); [x.update({"sym": sym}) for x in rr]; pit_rows += rr
        for t in RUNUPS:
            for e in run_events(s, t, m): e["sym"] = sym; pit_events[t].append(e)
        h, n = base_rate(s, m, tag=True); pit_base[0] += h; pit_base[1] += n
    RES["pit_stocks"] = {"names": int(C.shape[1]), "spells_10pct_plus": len(pit_rows), "by_depth": {d: summarise_spells(pit_rows, d) for d in DEPTHS},
                         "base_rate_crash_2y": {"hits": pit_base[0], "starts": pit_base[1], "pct": L.r(100 * pit_base[0] / max(pit_base[1], 1), 1)}}
    groups = {}
    for name, (g, rows) in allspells.items(): groups.setdefault(g, []).extend(rows)
    groups["S&P 500 stocks, point in time"] = pit_rows
    RES["groups"] = {g: {d: summarise_spells(rows, d) for d in DEPTHS} for g, rows in groups.items()}
    # parabolic runs
    rng = np.random.default_rng(L.SEED)
    for t in RUNUPS:
        evs = pit_events[t]; done = [e for e in evs if e["complete"]]
        years = sorted({e["date"][:4] for e in done}); by_year = {y: [e for e in done if e["date"][:4] == y] for y in years}
        hits = np.array([e["crash_from_peak"] for e in done], float)
        boots = []
        for _ in range(2000):
            ys = rng.choice(years, size=len(years), replace=True); pool = sum((by_year[y] for y in ys), [])
            if pool: boots.append(np.mean([e["crash_from_peak"] for e in pool]))
        dur = [e["sessions_to_crash"] if e["crash_from_peak"] else e["sessions_seen"] for e in evs]; obs = [e["crash_from_peak"] for e in evs]
        sv = km(dur, obs, [126, 252, 504])
        RES["runups"][f"pit_{t}"] = {"threshold_pct": t, "events": len(evs), "complete": len(done), "names": len({e["sym"] for e in evs}), "years": len(years),
                                     "crash_pct": L.r(100 * hits.mean(), 1) if len(done) else None, "crash_range90": [L.r(100 * np.percentile(boots, 5), 1), L.r(100 * np.percentile(boots, 95), 1)] if boots else None,
                                     "fell_40_below_event_pct": L.r(100 * np.mean([e["fell_40_below_event"] for e in done]), 1) if done else None,
                                     "km_crash_by_6m_1y_2y_pct": [L.r(100 * (1 - v), 1) for v in sv],
                                     "median_ret_1y_pct": L.r(float(np.median([e["ret_1y_pct"] for e in evs if e["ret_1y_pct"] is not None])), 1),
                                     "median_ret_2y_pct": L.r(float(np.median([e["ret_2y_pct"] for e in done])), 1) if done else None,
                                     "share_up_2y_pct": L.r(100 * np.mean([e["ret_2y_pct"] > 0 for e in done]), 1) if done else None,
                                     "median_gain_after_event_pct": L.r(float(np.median([e["gain_after_before_crash_pct"] for e in done])), 1) if done else None,
                                     "events_by_year": {y: len(v) for y, v in by_year.items()},
                                     "halves": {lab: {"complete": len(sub), "crash_pct": L.r(100 * np.mean([e["crash_from_peak"] for e in sub]), 1) if sub else None}
                                                for lab, sub in (("2005-2014", [e for e in done if e["date"] < "2015"]), ("2015-2024", [e for e in done if e["date"] >= "2015"]))}}

    RES["runups"]["pit_base_rate_any_day"] = RES["pit_stocks"]["base_rate_crash_2y"]
    RES["runups"]["pit_base_rate_halves"] = {k: L.r(100 * v[0] / max(v[1], 1), 1) for k, v in HALF_BASE.items()}
    # the named assets one by one (gold, silver, semis, bitcoin, oil, today's leaders): a list, each event shown
    named = {}
    for name, (g, c) in closes.items():
        if g in ("index", "fund", "sector", "bonds", "leaders basket"): continue
        e = {t: run_events(c, t) for t in RUNUPS}; h, n = base_rate(c)
        named[name] = {"group": g, "events": e, "base_rate_crash_2y_pct": L.r(100 * h / max(n, 1), 1), "base_starts": n,
                       "runup_2y_now_pct": L.r(100 * (c.iloc[-1] / c.iloc[-1 - H] - 1), 1) if len(c) > H else None,
                       "runup_1y_now_pct": L.r(100 * (c.iloc[-1] / c.iloc[-253] - 1), 1) if len(c) > 253 else None}
        r1 = c / c.shift(252) - 1; named[name]["runup_1y_own_pctile_now"] = L.r(100 * float((r1.dropna() < r1.iloc[-1]).mean()), 0)
    RES["named_assets"] = named
    L.dump("p7-drawdown.json", RES); L.save_provenance("provenance-p7.json")
    charts(RES, groups, closes, pit_events)
    for g, v in RES["groups"].items(): print(g, v[20])
    for k, v in RES["runups"].items(): print(k, v)
    for k in ("Gold since 1975", "Silver since 1970", "Bitcoin since 2013", "SMH semis", "NVDA", "MU"): print(k, {x: named[k][x] for x in ("runup_2y_now_pct", "runup_1y_now_pct", "runup_1y_own_pctile_now", "base_rate_crash_2y_pct")}, [(e["date"], e["crash_from_peak"]) for e in named[k]["events"][100]])


GROUP_ORDER = ["index", "S&P 500 stocks, point in time", "gold & silver", "semis", "bitcoin", "today's leaders (survivors)", "sector"]


def charts(RES, groups, closes, pit_events):
    # P7-1 · survival curves: share still under water t sessions after the high, falls of 20%+
    f, ax = S.fig(14, 6.5); grid = np.arange(0, 2521, 5)
    styles = {"index": (S.INK, 2.2, "-"), "S&P 500 stocks, point in time": (S.MUTE, 2.2, "-"), "gold & silver": (S.INK2, 1.6, "--"), "semis": (S.UP, 1.6, "-"),
              "bitcoin": (S.DN, 1.6, "-"), "today's leaders (survivors)": (S.UP, 1.2, ":"), "sector": (S.MUTE, 1.2, "--")}
    for g in GROUP_ORDER:
        rows = [r for r in groups[g] if r["depth_pct"] <= -20]
        if len(rows) < 3: continue
        sv = km([r["under_water"] for r in rows], [not r["open"] for r in rows], grid)
        col, lw, ls = styles[g]; ax.step(grid / 252, 100 * sv, where="post", color=col, lw=lw, ls=ls, label=f"{g} ({len(rows)} falls, {sum(r['open'] for r in rows)} still open)")
    ax.set_xlabel("years since the high"); ax.set_ylabel("% of falls still below the old high"); ax.set_ylim(0, 101); ax.legend(loc="upper right", fontsize=10)
    ax.set_title("P7-1 · After a fall of 20% or more: how long until the old high comes back (Kaplan–Meier, open falls counted as open)")
    S.caption(f, "A fall is a spell from a closing high until the close regains it. Stocks = every S&P 500 member at the time of its high, 2003→, including names that later left the index.")
    S.save(f, os.path.join(L.CH, "p7-1-recovery-survival.png"))
    # P7-2 · depth against time under water, S&P since 1928, gold, silver, bitcoin, SMH
    f, ax = S.fig(14, 6.5)
    marks = {"S&P 500 index since 1928": ("o", S.INK), "Gold since 1975": ("s", S.INK2), "Silver since 1970": ("D", S.MUTE), "Bitcoin since 2013": ("^", S.DN), "SMH semis": ("v", S.UP), "NVDA": ("P", S.UP)}
    for name, (mk, col) in marks.items():
        rows = [r for r in RES["instruments"][name]["spells_20"]] if name in RES["instruments"] else []
        x = [r["depth_pct"] for r in rows]; y = [max(r["under_water"], 1) / 252 for r in rows]
        ax.scatter(x, y, marker=mk, s=60, color=col, alpha=0.9, label=name, edgecolors="none")
        for r in rows:
            if r["open"]: ax.annotate("open", (r["depth_pct"], max(r["under_water"], 1) / 252), xytext=(4, 4), textcoords="offset points", fontsize=9, color=col)
            elif r["depth_pct"] <= -45 or r["under_water"] > 2500: ax.annotate(r["peak"][:4], (r["depth_pct"], r["under_water"] / 252), xytext=(4, -10), textcoords="offset points", fontsize=9, color=S.MUTE)
    ax.set_yscale("log"); ax.set_xlabel("depth of the fall, % from the high"); ax.set_ylabel("years below the old high (log)"); ax.legend(loc="lower left", fontsize=10)
    ax.set_title("P7-2 · Every fall of 20%+: how deep, and how many years until the old high came back")
    S.caption(f, "'open' = still below the old high at the 25 Sep 2026 close (time shown so far). Year labels = the year of the high, for the deepest and longest falls.")
    S.save(f, os.path.join(L.CH, "p7-2-depth-vs-time.png"))
    # P7-3 · the triple penance ratio
    f, ax = S.fig(14, 5); allr = []
    for g in ("index", "sector", "S&P 500 stocks, point in time", "gold & silver", "semis", "bitcoin"):
        allr += [r["low_to_back"] / r["to_low"] for r in groups[g] if not r["open"] and r["to_low"] > 0 and r["depth_pct"] <= -20]
    allr = np.array(allr); bins = np.logspace(-1.5, 2, 50)
    ax.hist(allr, bins=bins, color=S.MUTE, alpha=0.8); ax.set_xscale("log"); ax.axvline(3, color=S.DN, lw=2); ax.axvline(np.median(allr), color=S.UP, lw=2)
    ax.text(3.2, ax.get_ylim()[1] * 0.9, "3 = triple penance", color=S.DN, fontsize=11); ax.text(np.median(allr) * 1.05, ax.get_ylim()[1] * 0.78, f"median {np.median(allr):.2f}", color=S.UP, fontsize=11)
    ax.set_xlabel("time from the low back to the high ÷ time from the high down to the low (log)"); ax.set_ylabel("falls of 20%+ that recovered")
    ax.set_title(f"P7-3 · Does the climb back take three times the fall? {len(allr):,} recovered falls: median {np.median(allr):.2f}, {100 * np.mean(allr >= 3):.0f}% took 3x or longer")
    S.caption(f, "Only falls that recovered can give a ratio, so this leans short (the slowest climbs are still open). Indexes, sectors, point-in-time stocks, gold, silver, semis, bitcoin.")
    S.save(f, os.path.join(L.CH, "p7-3-triple-penance.png"))
    # P7-4 · parabolic runs: crash probability by run-up size (S&P stocks, point in time) vs any day
    f, ax = S.fig(14, 5); R = RES["runups"]; base = R["pit_base_rate_any_day"]["pct"]
    for i, t in enumerate(RUNUPS):
        v = R[f"pit_{t}"]; lo, hi = v["crash_range90"]
        ax.bar(i, v["crash_pct"], 0.55, color=S.DN, alpha=0.8); ax.plot([i, i], [lo, hi], color=S.INK, lw=2)
        ax.text(i, hi + 1.5, f"{v['crash_pct']:.0f}%  ({v['complete']} runs, {v['years']} years)", ha="center", fontsize=11, color=S.INK)
    ax.axhline(base, color=S.MUTE, lw=2, ls="--"); ax.text(2.45, base + 1, f"any day: {base:.0f}%", color=S.MUTE, fontsize=11, ha="right")
    ax.set_xticks(range(len(RUNUPS))); ax.set_xticklabels([f"up {t}%+ in two years" for t in RUNUPS]); ax.set_ylabel("% followed by a 40% fall from the high within 2 years")
    ax.set_ylim(0, 100); ax.set_title("P7-4 · After a stock doubles in two years, how often does it lose 40% from its high within the next two? (S&P 500 members, point in time)")
    S.caption(f, "Black bar = 90% range from resampling whole calendar years of events (the 1999-2000 and 2020-21 runs are clusters, not separate coin flips). Greenwood-Shleifer-You's test on our stocks.")
    S.save(f, os.path.join(L.CH, "p7-4-runup-crash.png"))
    # P7-5 · gold and silver: price with every 2-year doubling marked, and where each stands today
    f, axs = S.fig(14, 8, rows=2)
    for ax, name in zip(axs, ("Gold since 1975", "Silver since 1970")):
        g, c = closes[name]; S.updown_line(ax, c.index, c.values, lw=0.8); ax.set_yscale("log")
        for e in RES["named_assets"][name]["events"][100]:
            d = pd.Timestamp(e["date"]); y = c.loc[d]
            ax.plot([d], [y], "o", color=S.DN if e["crash_from_peak"] else S.UP, ms=9)
            ax.annotate(f"{e['date'][:7]} · {'40% fall followed' if e['crash_from_peak'] else ('no 40% fall' if e['complete'] else 'open')}", (d, y), xytext=(6, 8), textcoords="offset points", fontsize=9, color=S.INK2)
        na = RES["named_assets"][name]
        ax.set_title(f"{name}: dots = the day the 2-year gain first passed +100% · today: up {na['runup_2y_now_pct']:.0f}% in 2 years, {na['runup_1y_now_pct']:.0f}% in 1 year")
    S.caption(f, "Red dot = a 40% fall from the high came within the next two years; green = it did not; 'open' = fewer than two years have passed. Source: FMP GCUSD / SIUSD futures via the chart-API cache.")
    S.save(f, os.path.join(L.CH, "p7-5-gold-silver-runs.png"))


if __name__ == "__main__":
    main()
