#!/usr/bin/env python3
"""PB1 extra studies (relaunch, 6 Oct ~15:20 ET). Conditions and counts, never verdicts.
 A. Spells between 200-day flips: how long, how far the high went, the RSI at that high, how it ended.
 B. Pullbacks to the 21-day average in leaders: how often it held, what followed.
 C. 50/200-day crosses both ways with the lag: how much of the move was already done at the cross; when the next cross falls.
 D. Index pullback depth history (SPY, QQQ, IWM, RSP).
Levels are each instrument's own (its ATR, its own history). Writes data/extra.json."""
import json, os, math, sys
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
sys.path.insert(0, HERE); import events as EV
LEADERS = ["MU", "AVGO", "NVDA", "GOOGL", "TSM", "SPY", "QQQ"]
INDEXES = ["SPY", "QQQ", "IWM", "RSP"]
EXTRA_GROUP = {"TSM": "company", "SNDK": "company", "RSP": "etf"}
ALLSYMS = list(EV.GROUP) + [s for s in EXTRA_GROUP if s not in EV.GROUP]
def grp(s): return EV.GROUP.get(s) or EXTRA_GROUP[s]
LAST2Y = "2024-10-06"

def frame(sym):
    df = EV.indicators(EV.load(sym))
    pc = df["c"].shift(1)
    tr = pd.concat([df["h"] - df["l"], (df["h"] - pc).abs(), (df["l"] - pc).abs()], axis=1).max(axis=1)
    df["atr"] = tr.ewm(alpha=1/14, adjust=False, min_periods=14).mean()
    df["hi20c_prev"] = df["c"].rolling(20).max().shift(1)
    return df

def _f(x): return None if x is None or (isinstance(x, float) and math.isnan(x)) else float(x)
def med(a): a = [x for x in a if x is not None and not (isinstance(x, float) and math.isnan(x))]; return float(np.median(a)) if a else None
def qt(a, p): a = [x for x in a if x is not None and not (isinstance(x, float) and math.isnan(x))]; return float(np.percentile(a, p)) if a else None
def share(a): a = [x for x in a if x is not None]; return float(np.mean(a)) if a else None

# ---------- A. spells between 200-day flips ----------
def spells_200(sym, df):
    ok = df["sma200"].notna(); d = df[ok]; above = (d["c"] >= d["sma200"]).values
    out = []; start = 0
    for i in range(1, len(d) + 1):
        if i == len(d) or above[i] != above[start]:
            seg = d.iloc[start:i]; open_ = (i == len(d)); c0 = seg["c"].iloc[0]
            if start > 0:  # a spell that began with a real cross
                side = "above" if above[start] else "below"
                ih = int(seg["h"].values.argmax()); il = int(seg["l"].values.argmin())
                endc = d["c"].iloc[i] if not open_ else seg["c"].iloc[-1]   # close of the day that crossed back
                s50 = seg["sma50"]
                out.append({"symbol": sym, "group": grp(sym), "side": side, "start": str(seg.index[0].date()), "sessions": int(len(seg)), "open": open_,
                            "max_up": float(seg["h"].max() / c0 - 1), "max_down": float(seg["l"].min() / c0 - 1), "exit_ret": float(endc / c0 - 1),
                            "rsi_at_high": _f(seg["rsi"].iloc[ih]), "rsi_at_low": _f(seg["rsi"].iloc[il]), "sessions_to_high": ih + 1,
                            "rsi_hi_own90": _f(seg["rsi_hi"].iloc[ih]), "tags_50": int(((seg["l"] <= s50) & (seg["l"].shift(1) > s50.shift(1))).sum()) if side == "above" else None})
            start = i
    return out

def summ_spells(rows):
    out = {}
    for side in ("above", "below"):
        r = [x for x in rows if x["side"] == side and not x["open"]]
        if not r: continue
        L = [x["sessions"] for x in r]
        out[side] = {"n": len(r), "sessions_med": med(L), "sessions_p75": qt(L, 75), "sessions_p90": qt(L, 90),
                     "short_5_share": share([x["sessions"] <= 5 for x in r]), "long_60_share": share([x["sessions"] >= 60 for x in r]),
                     "max_up_med": med([x["max_up"] for x in r]), "max_down_med": med([x["max_down"] for x in r]), "exit_ret_med": med([x["exit_ret"] for x in r]),
                     "exit_pos_share": share([x["exit_ret"] > 0 for x in r]),
                     "rsi_at_high_med": med([x["rsi_at_high"] for x in r]), "rsi_at_low_med": med([x["rsi_at_low"] for x in r])}
        lr = [x for x in r if x["sessions"] >= 60]
        if lr:
            out[side + "_60plus"] = {"n": len(lr), "sessions_med": med([x["sessions"] for x in lr]), "max_up_med": med([x["max_up"] for x in lr]), "max_down_med": med([x["max_down"] for x in lr]),
                                     "exit_ret_med": med([x["exit_ret"] for x in lr]), "rsi_at_high_med": med([x["rsi_at_high"] for x in lr]), "rsi_at_low_med": med([x["rsi_at_low"] for x in lr]),
                                     "rsi_high_over_own90_share": share([(x["rsi_at_high"] >= x["rsi_hi_own90"]) if x["rsi_at_high"] is not None and x["rsi_hi_own90"] is not None else None for x in lr]),
                                     "tags_50_med": med([x["tags_50"] for x in lr]) if side == "above" else None}
    return out

# ---------- B. pullbacks to the 21-day ----------
def pullbacks21(sym, df, clear=5):
    """A fresh touch: the day's low reaches the 21-day EMA after at least `clear` sessions whose lows stayed above it."""
    e = df["ema21"]; above = (df["l"] > e); run = above.groupby((~above).cumsum()).cumsum()  # consecutive sessions fully above
    touch = (df["l"] <= e) & (run.shift(1) >= clear) & df["sma200"].notna() & df["atr"].notna()
    rows = []; n = len(df); c = df["c"].values; h = df["h"].values; l = df["l"].values; ev = e.values; atr = df["atr"].values; s50 = df["sma50"].values
    for pos in np.where(touch.values)[0]:
        c0 = c[pos]; lvl = ev[pos]; a = atr[pos]; floor_ = lvl - a
        r = {"symbol": sym, "date": str(df.index[pos].date()), "close": float(c0), "ema21": float(lvl), "atr_pct": float(a / c0),
             "stack": "full" if (df["inner_bull"].iloc[pos] and df["outer_bull"].iloc[pos]) else ("mixed" if df["outer_bull"].iloc[pos] else "below"),
             "clear_run": int(run.iloc[pos - 1]), "rsi": _f(df["rsi"].iloc[pos]), "rsi_vs_med": None,
             "close_held": bool(c0 >= lvl)}
        if r["rsi"] is not None and not math.isnan(df["rsi_med"].iloc[pos]): r["rsi_vs_med"] = "below" if r["rsi"] < df["rsi_med"].iloc[pos] else "above"
        for H in (5, 10, 20, 60):
            if pos + H < n:
                r[f"ret_{H}"] = float(c[pos + H] / c0 - 1); r[f"runup_{H}"] = float(h[pos+1:pos+1+H].max() / c0 - 1); r[f"drawdown_{H}"] = float(l[pos+1:pos+1+H].min() / c0 - 1)
            else: r[f"ret_{H}"] = r[f"runup_{H}"] = r[f"drawdown_{H}"] = None
        if pos + 10 < n:
            r["held_10"] = bool((c[pos:pos+11] >= floor_).all())       # no close more than 1 ATR under the touch-day 21-day
            r["deepest_close_10_atr"] = float((c[pos:pos+11].min() - lvl) / a)
        else: r["held_10"] = r["deepest_close_10_atr"] = None
        if pos + 20 < n: r["reached_50_in_20"] = bool((l[pos:pos+21] <= s50[pos:pos+21]).any())
        else: r["reached_50_in_20"] = None
        # race: a close above the prior 20-session closing high vs a close more than 1 ATR under the 21-day level, inside 60 sessions
        if pos + 60 < n:
            target = df["hi20c_prev"].iloc[pos]; first = "neither"; days = None
            for k in range(1, 61):
                if c[pos + k] < floor_: first = "broke_first"; days = k; break
                if c[pos + k] > target: first = "new_high_first"; days = k; break
            r["race_60"] = first; r["race_days"] = days
        else: r["race_60"] = None; r["race_days"] = None
        rows.append(r)
    return rows

def summ_pb(rows):
    if not rows: return {"n": 0}
    d = {"n": len(rows), "close_held_share": share([x["close_held"] for x in rows]), "held_10_share": share([x["held_10"] for x in rows]),
         "reached_50_in_20_share": share([x["reached_50_in_20"] for x in rows]),
         "deepest_close_10_atr_med": med([x["deepest_close_10_atr"] for x in rows])}
    rc = [x["race_60"] for x in rows if x["race_60"] is not None]
    d["race_n"] = len(rc)
    for k in ("new_high_first", "broke_first", "neither"): d[k + "_share"] = (rc.count(k) / len(rc)) if rc else None
    d["race_days_new_high_med"] = med([x["race_days"] for x in rows if x["race_60"] == "new_high_first"])
    for H in (5, 10, 20, 60):
        d[f"ret_{H}_med"] = med([x[f"ret_{H}"] for x in rows]); d[f"ret_{H}_pos"] = share([(x[f"ret_{H}"] > 0) if x[f"ret_{H}"] is not None else None for x in rows])
        d[f"runup_{H}_med"] = med([x[f"runup_{H}"] for x in rows]); d[f"drawdown_{H}_med"] = med([x[f"drawdown_{H}"] for x in rows]); d[f"drawdown_{H}_p10"] = qt([x[f"drawdown_{H}"] for x in rows], 10)
    return d

def base_any_session(df, mask=None):
    """Same measures on every session (or every session in `mask`), for the base rate beside the pullback rows."""
    c = df["c"].values; h = df["h"].values; l = df["l"].values; n = len(df); idx = np.arange(200, n - 61)
    if mask is not None: idx = idx[mask.values[idx]]
    if len(idx) == 0: return {"n": 0}
    d = {"n": int(len(idx))}
    for H in (5, 10, 20, 60):
        r = c[idx + H] / c[idx] - 1; d[f"ret_{H}_med"] = float(np.median(r)); d[f"ret_{H}_pos"] = float((r > 0).mean())
        d[f"drawdown_{H}_med"] = float(np.median([l[i+1:i+1+H].min() / c[i] - 1 for i in idx])); d[f"runup_{H}_med"] = float(np.median([h[i+1:i+1+H].max() / c[i] - 1 for i in idx]))
    hp = df["hi20c_prev"].values; atr = df["atr"].values; e = df["ema21"].values; rc = []
    for i in idx:
        fl = min(c[i], e[i]) - atr[i]; first = "neither"
        for k in range(1, 61):
            if c[i + k] < fl: first = "broke_first"; break
            if c[i + k] > hp[i]: first = "new_high_first"; break
        rc.append(first)
    for k in ("new_high_first", "broke_first", "neither"): d[k + "_share"] = rc.count(k) / len(rc)
    return d

# ---------- C. 50/200 crosses with the lag ----------
def crosses_50_200(sym, df):
    ok = df["sma200"].notna(); d = df[ok]; bull = (d["sma50"] >= d["sma200"]).values; rows = []
    c = d["c"].values; h = d["h"].values; l = d["l"].values; n = len(d)
    for i in range(1, n):
        if bull[i] == bull[i - 1]: continue
        kind = "golden" if bull[i] else "death"; c0 = c[i]; lo = max(0, i - 252)
        r = {"symbol": sym, "group": grp(sym), "kind": kind, "date": str(d.index[i].date()), "close": float(c0)}
        if kind == "death":
            ip = lo + int(np.argmax(c[lo:i + 1])); r["already_from_peak"] = float(c0 / c[ip] - 1); r["sessions_since_peak"] = int(i - ip)
            il = ip + int(np.argmin(c[ip:i + 1])); r["low_before_cross"] = float(c[il] / c[ip] - 1)   # deepest close between the peak and the cross
            if i + 120 < n:
                fut_low = c[i+1:i+121].min(); r["further_low_120"] = float(fut_low / c0 - 1); r["low_was_already_in_120"] = bool(fut_low >= c[il])
            else: r["further_low_120"] = r["low_was_already_in_120"] = None
        else:
            it = lo + int(np.argmin(c[lo:i + 1])); r["already_from_trough"] = float(c0 / c[it] - 1); r["sessions_since_trough"] = int(i - it)
            if i + 120 < n: r["further_high_120"] = float(c[i+1:i+121].max() / c0 - 1)
            else: r["further_high_120"] = None
        for H in (20, 60, 120):
            if i + H < n: r[f"ret_{H}"] = float(c[i + H] / c0 - 1); r[f"drawdown_{H}"] = float(l[i+1:i+1+H].min() / c0 - 1); r[f"runup_{H}"] = float(h[i+1:i+1+H].max() / c0 - 1)
            else: r[f"ret_{H}"] = r[f"drawdown_{H}"] = r[f"runup_{H}"] = None
        nxt = [j for j in range(i + 1, n) if bull[j] != bull[i]]
        r["sessions_to_next_cross"] = int(nxt[0] - i) if nxt else None
        rows.append(r)
    return rows

def summ_cross(rows):
    out = {}
    for kind in ("golden", "death"):
        r = [x for x in rows if x["kind"] == kind]
        if not r: continue
        d = {"n": len(r), "sessions_to_next_cross_med": med([x["sessions_to_next_cross"] for x in r]), "whipsaw_20_share": share([(x["sessions_to_next_cross"] <= 20) if x["sessions_to_next_cross"] is not None else None for x in r])}
        for H in (20, 60, 120):
            d[f"ret_{H}_med"] = med([x[f"ret_{H}"] for x in r]); d[f"ret_{H}_pos"] = share([(x[f"ret_{H}"] > 0) if x[f"ret_{H}"] is not None else None for x in r])
            d[f"drawdown_{H}_med"] = med([x[f"drawdown_{H}"] for x in r]); d[f"runup_{H}_med"] = med([x[f"runup_{H}"] for x in r])
        if kind == "death":
            d["already_from_peak_med"] = med([x["already_from_peak"] for x in r]); d["sessions_since_peak_med"] = med([x["sessions_since_peak"] for x in r])
            d["low_before_cross_med"] = med([x["low_before_cross"] for x in r]); d["further_low_120_med"] = med([x["further_low_120"] for x in r])
            d["low_was_already_in_120_share"] = share([x["low_was_already_in_120"] for x in r])
        else:
            d["already_from_trough_med"] = med([x["already_from_trough"] for x in r]); d["sessions_since_trough_med"] = med([x["sessions_since_trough"] for x in r]); d["further_high_120_med"] = med([x["further_high_120"] for x in r])
        out[kind] = d
    return out

def project_cross(df, max_sessions=120):
    """When does the 50-day cross the 200-day if price follows a simple path? Paths: flat at the last close, and +/-0.5% a session drifts
    (about +/-10% a month) capped at 60 sessions. Pure arithmetic on the bars that roll out of each window; not a forecast."""
    c = list(df["c"].values); last = c[-1]; s50 = np.mean(c[-50:]); s200 = np.mean(c[-200:]); bull = s50 >= s200; res = {"sma50": float(s50), "sma200": float(s200), "gap_pct": float(s50 / s200 - 1), "state": "50 over 200" if bull else "50 under 200", "last": float(last)}
    for name, step in (("flat", 0.0), ("down_0.5pct_a_day", -0.005), ("up_0.5pct_a_day", 0.005), ("down_0.25pct_a_day", -0.0025), ("up_0.25pct_a_day", 0.0025)):
        cc = list(c); p = last; hit = None
        for k in range(1, max_sessions + 1):
            if k <= 60: p = p * (1 + step)
            cc.append(p); a = np.mean(cc[-50:]); b = np.mean(cc[-200:])
            if (a >= b) != bull: hit = k; break
        res[name] = hit
    return res

# ---------- D. index pullback depth ----------
def pullback_episodes(sym, df, lookback=252, min_depth=0.03):
    """An episode starts at a 252-session closing high and ends at the next one; depth = the lowest close in between."""
    c = df["c"]; hi = c.rolling(lookback, min_periods=lookback).max(); at_high = (c >= hi) & hi.notna()
    idx = np.where(at_high.values)[0]; cv = c.values; lv = df["l"].values; rows = []; n = len(df)
    e21 = df["ema21"].values; s50 = df["sma50"].values; s200 = df["sma200"].values
    for a, b in zip(idx[:-1], idx[1:]):
        if b - a < 2: continue
        seg = cv[a:b + 1]; it = a + int(np.argmin(seg)); depth = cv[it] / cv[a] - 1
        if depth > -min_depth: continue
        rows.append({"symbol": sym, "peak": str(df.index[a].date()), "trough": str(df.index[it].date()), "recovered": str(df.index[b].date()), "depth": float(depth),
                     "sessions_to_trough": int(it - a), "sessions_to_recover": int(b - a), "open": False,
                     "reached_21": bool((lv[a+1:b+1] <= e21[a+1:b+1]).any()), "reached_50": bool((lv[a+1:b+1] <= s50[a+1:b+1]).any()),
                     "reached_200": bool((lv[a+1:b+1] <= s200[a+1:b+1]).any()) if not np.isnan(s200[a+1:b+1]).all() else None,
                     "rsi_at_trough": _f(df["rsi"].iloc[it])})
    # the open episode (since the last 252-session closing high)
    a = int(idx[-1]) if len(idx) else None; cur = None
    if a is not None:
        seg = cv[a:]; it = a + int(np.argmin(seg))
        cur = {"symbol": sym, "peak": str(df.index[a].date()), "peak_close": float(cv[a]), "last_close": float(cv[-1]), "now_from_peak": float(cv[-1] / cv[a] - 1),
               "deepest_so_far": float(cv[it] / cv[a] - 1), "deepest_date": str(df.index[it].date()), "sessions_since_peak": int(n - 1 - a)}
    return rows, cur

def summ_depth(rows, years):
    D = [-x["depth"] for x in rows]
    d = {"n": len(rows), "per_year": len(rows) / years, "depth_med": med(D), "depth_p75": qt(D, 75), "depth_p90": qt(D, 90), "depth_max": max(D) if D else None,
         "sessions_to_trough_med": med([x["sessions_to_trough"] for x in rows]), "sessions_to_recover_med": med([x["sessions_to_recover"] for x in rows]),
         "reached_50_share": share([x["reached_50"] for x in rows]), "reached_200_share": share([x["reached_200"] for x in rows]),
         "rsi_at_trough_med": med([x["rsi_at_trough"] for x in rows])}
    for lo, hi_, lab in ((0.03, 0.05, "3_5"), (0.05, 0.10, "5_10"), (0.10, 0.20, "10_20"), (0.20, 9, "20_plus")):
        sel = [x for x in rows if lo <= -x["depth"] < hi_]
        d["bucket_" + lab] = {"n": len(sel), "sessions_to_trough_med": med([x["sessions_to_trough"] for x in sel]), "sessions_to_recover_med": med([x["sessions_to_recover"] for x in sel]),
                              "reached_50_share": share([x["reached_50"] for x in sel]), "reached_200_share": share([x["reached_200"] for x in sel])}
    return d

def main():
    out = {"spells": {}, "pullback21": {}, "cross": {}, "depth": {}, "project": {}}
    frames = {}
    for s in ALLSYMS:
        if os.path.exists(os.path.join(DATA, "bars", s + ".json")): frames[s] = frame(s)
    # A
    allsp = []
    for s in EV.GROUP:
        if s in frames: allsp += spells_200(s, frames[s])
    out["spells"]["pooled"] = {g: summ_spells([x for x in allsp if x["group"] == g]) for g in ("company", "etf", "macro")}
    out["spells"]["per_name"] = {s: summ_spells([x for x in allsp if x["symbol"] == s]) for s in EV.GROUP if s in frames}
    out["spells"]["open_now"] = [x for x in allsp if x["open"]]
    out["spells"]["last2y"] = {g: summ_spells([x for x in allsp if x["group"] == g and x["start"] >= LAST2Y]) for g in ("company", "etf", "macro")}
    # B
    allpb = []; pbn = {}
    for s in LEADERS:
        df = frames[s]; rows = pullbacks21(s, df); allpb += rows
        full = df["inner_bull"] & df["outer_bull"] & df["sma200"].notna()
        pbn[s] = {"all": summ_pb(rows), "full_stack": summ_pb([x for x in rows if x["stack"] == "full"]), "not_full_stack": summ_pb([x for x in rows if x["stack"] != "full"]),
                  "full_stack_last2y": summ_pb([x for x in rows if x["stack"] == "full" and x["date"] >= LAST2Y]),
                  "full_stack_last5y": summ_pb([x for x in rows if x["stack"] == "full" and x["date"] >= "2021-10-06"]),
                  "base_all_sessions": base_any_session(df), "base_full_stack_sessions": base_any_session(df, full),
                  "recent": [x for x in rows if x["date"] >= "2025-10-06"],
                  "now": {"close": float(df["c"].iloc[-1]), "ema21": float(df["ema21"].iloc[-1]), "dist_pct": float(df["c"].iloc[-1] / df["ema21"].iloc[-1] - 1), "dist_atr": float((df["c"].iloc[-1] - df["ema21"].iloc[-1]) / df["atr"].iloc[-1]),
                          "atr_pct": float(df["atr"].iloc[-1] / df["c"].iloc[-1]), "stack": "full" if (df["inner_bull"].iloc[-1] and df["outer_bull"].iloc[-1]) else "not full"}}
    out["pullback21"]["per_name"] = pbn
    out["pullback21"]["pooled"] = {"all": summ_pb(allpb), "full_stack": summ_pb([x for x in allpb if x["stack"] == "full"]), "not_full_stack": summ_pb([x for x in allpb if x["stack"] != "full"]),
                                   "full_stack_rsi_below_med": summ_pb([x for x in allpb if x["stack"] == "full" and x["rsi_vs_med"] == "below"]),
                                   "full_stack_rsi_above_med": summ_pb([x for x in allpb if x["stack"] == "full" and x["rsi_vs_med"] == "above"]),
                                   "full_stack_last2y": summ_pb([x for x in allpb if x["stack"] == "full" and x["date"] >= LAST2Y]),
                                   "full_stack_close_held": summ_pb([x for x in allpb if x["stack"] == "full" and x["close_held"]]),
                                   "full_stack_close_lost": summ_pb([x for x in allpb if x["stack"] == "full" and not x["close_held"]])}
    # C
    allx = []
    for s in ALLSYMS:
        if s in frames: allx += crosses_50_200(s, frames[s])
    out["cross"]["pooled"] = {g: summ_cross([x for x in allx if x["group"] == g]) for g in ("company", "etf", "macro")}
    out["cross"]["per_name"] = {s: summ_cross([x for x in allx if x["symbol"] == s]) for s in frames}
    out["cross"]["last5"] = {s: [x for x in allx if x["symbol"] == s][-5:] for s in LEADERS + ["SNDK", "XLV", "IWM", "RSP"] if s in frames}
    out["project"] = {s: project_cross(frames[s]) for s in frames if len(frames[s]) >= 260}
    # D
    for s in INDEXES:
        df = frames[s]; rows, cur = pullback_episodes(s, df); years = len(df) / 252.0
        D = sorted(-x["depth"] for x in rows)
        cur["deepest_so_far_rank"] = float(np.mean([d <= -cur["deepest_so_far"] for d in D])) if D and cur["deepest_so_far"] <= -0.03 else None
        out["depth"][s] = {"summary": summ_depth(rows, years), "current": cur, "episodes": rows, "first": str(df.index[0].date())}
    json.dump(out, open(os.path.join(DATA, "extra.json"), "w"), indent=1)
    return out

if __name__ == "__main__":
    o = main(); p = lambda x: "  n/a" if x is None else f"{x*100:5.1f}%"
    print("A spells (closed), pooled")
    for g, v in o["spells"]["pooled"].items():
        for k, d in v.items(): print(f"  {g:8s} {k:13s} n={d['n']:5d} med sessions {d['sessions_med']:.0f} max_up {p(d['max_up_med'])} max_down {p(d['max_down_med'])} exit {p(d['exit_ret_med'])} rsi@high {d['rsi_at_high_med']:.0f}")
    print("B pullbacks to 21-day")
    for s, v in list(o["pullback21"]["per_name"].items()) + [("POOLED", o["pullback21"]["pooled"])]:
        for k in ("all", "full_stack", "not_full_stack", "full_stack_last2y"):
            d = v.get(k)
            if d and d["n"]: print(f"  {s:6s} {k:18s} n={d['n']:4d} close-held {p(d['close_held_share'])} held10 {p(d['held_10_share'])} newhigh-first {p(d['new_high_first_share'])} broke-first {p(d['broke_first_share'])} to50 {p(d['reached_50_in_20_share'])} ret20 {p(d['ret_20_med'])} pos20 {p(d['ret_20_pos'])} dd20 {p(d['drawdown_20_med'])}")
        if "base_full_stack_sessions" in v:
            b = v["base_full_stack_sessions"]; print(f"  {s:6s} base(full stack)    n={b['n']:5d} newhigh-first {p(b['new_high_first_share'])} broke-first {p(b['broke_first_share'])} ret20 {p(b['ret_20_med'])} pos20 {p(b['ret_20_pos'])} dd20 {p(b['drawdown_20_med'])}")
    print("C crosses")
    for g, v in o["cross"]["pooled"].items():
        for k, d in v.items(): print(f"  {g:8s} {k:6s} n={d['n']:4d} ret60 {p(d['ret_60_med'])} pos60 {p(d['ret_60_pos'])} ret120 {p(d['ret_120_med'])} pos120 {p(d['ret_120_pos'])} next-cross {d['sessions_to_next_cross_med']:.0f} whipsaw20 {p(d['whipsaw_20_share'])}", {kk: (round(vv, 3) if isinstance(vv, float) else vv) for kk, vv in d.items() if 'already' in kk or 'since' in kk or 'further' in kk or 'low_' in kk})
    for s in ("AVGO", "MU", "NVDA", "SPY", "QQQ", "XLV", "IWM"): print("  project", s, {k: (round(v, 4) if isinstance(v, float) else v) for k, v in o["project"][s].items()})
    print("D depth")
    for s, v in o["depth"].items():
        d = v["summary"]; print(f"  {s} n={d['n']} per-year {d['per_year']:.1f} depth med {p(d['depth_med'])} p75 {p(d['depth_p75'])} p90 {p(d['depth_p90'])} max {p(d['depth_max'])} to-trough {d['sessions_to_trough_med']:.0f} recover {d['sessions_to_recover_med']:.0f} reached50 {p(d['reached_50_share'])} reached200 {p(d['reached_200_share'])}", {k: b['n'] for k, b in d.items() if k.startswith('bucket')}, v["current"])
