#!/usr/bin/env python3
"""PB1 event studies on our own daily bars. Conditions and counts, never verdicts.
Events: close x 200-day SMA, close x 50-day SMA, Lab cloud flips (13/21 EMA, 21 EMA/50 SMA, 50/200 SMA,
bullish when faster >= slower at the daily close, exactly as SCINTILLA_Clean_Clouds_V17_Readable.pine),
RSI(14) and Williams %R(14) tags of each name's OWN trailing 2-year percentiles (10th/90th).
Outputs data/events.json (per-event rows), data/tables.json (per-name + pooled summaries), data/recurrence.json."""
import json, os, math
import numpy as np, pandas as pd
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
HORIZONS = [5, 10, 20, 60]
PCT_WINDOW = 504; LOW_PCT = 0.10; HIGH_PCT = 0.90
REVIEWED = ["AMZN","AVGO","BE","CRWV","GOOGL","MU","NBIS","NVDA","VST","WMT","SPY","QQQ","VIX","US10Y","BTCUSD","PCC","CLUSD","GCUSD","SIUSD"]
INDEX = ["IWM","SMH"]; SECTORS = ["XLK","XLF","XLV","XLY","XLP","XLE","XLI","XLB","XLU","XLRE","XLC"]
COMPANY = ["AMZN","AVGO","BE","CRWV","GOOGL","MU","NBIS","NVDA","VST","WMT"]
MACRO = ["VIX","US10Y","BTCUSD","PCC","CLUSD","GCUSD","SIUSD"]
GROUP = {**{s:"company" for s in COMPANY}, **{s:"etf" for s in ["SPY","QQQ"]+INDEX+SECTORS}, **{s:"macro" for s in MACRO}}

def load(sym):
    rows = json.load(open(os.path.join(DATA, "bars", sym + ".json")))
    df = pd.DataFrame(rows); df["date"] = pd.to_datetime(df["t"], unit="ms", utc=True).dt.tz_convert("US/Eastern").dt.normalize()
    df = df.drop_duplicates("date").set_index("date").sort_index()
    df = df[df["c"] > 0]
    # repair missing/zero highs and lows (index series from FMP sometimes carry 0)
    bad = (df["h"] <= 0) | (df["l"] <= 0) | df["h"].isna() | df["l"].isna()
    df.loc[bad, "h"] = df.loc[bad, "c"]; df.loc[bad, "l"] = df.loc[bad, "c"]
    return df

def rsi(c, n=14):
    d = c.diff(); up = d.clip(lower=0); dn = -d.clip(upper=0)
    au = up.ewm(alpha=1/n, adjust=False, min_periods=n).mean(); ad = dn.ewm(alpha=1/n, adjust=False, min_periods=n).mean()
    rs = au / ad.replace(0, np.nan); return 100 - 100/(1+rs)

def willr(df, n=14):
    hh = df["h"].rolling(n).max(); ll = df["l"].rolling(n).min()
    return -100 * (hh - df["c"]) / (hh - ll).replace(0, np.nan)

def indicators(df):
    c = df["c"]
    df["ema13"] = c.ewm(span=13, adjust=False).mean(); df["ema21"] = c.ewm(span=21, adjust=False).mean()
    df["sma50"] = c.rolling(50).mean(); df["sma200"] = c.rolling(200).mean()
    df["rsi"] = rsi(c); df["wr"] = willr(df)
    df["rsi_lo"] = df["rsi"].rolling(PCT_WINDOW, min_periods=252).quantile(LOW_PCT).shift(1)
    df["rsi_hi"] = df["rsi"].rolling(PCT_WINDOW, min_periods=252).quantile(HIGH_PCT).shift(1)
    df["rsi_med"] = df["rsi"].rolling(PCT_WINDOW, min_periods=252).median().shift(1)
    df["wr_lo"] = df["wr"].rolling(PCT_WINDOW, min_periods=252).quantile(LOW_PCT).shift(1)
    df["wr_hi"] = df["wr"].rolling(PCT_WINDOW, min_periods=252).quantile(HIGH_PCT).shift(1)
    df["fast_bull"] = df["ema13"] >= df["ema21"]; df["inner_bull"] = df["ema21"] >= df["sma50"]; df["outer_bull"] = df["sma50"] >= df["sma200"]
    df["hi20_prev"] = df["h"].rolling(20).max().shift(1)
    df["sma200_slope"] = df["sma200"] - df["sma200"].shift(20)
    return df

def cross_events(df, col, name):
    above = df["c"] >= df[col]; prev = above.shift(1)
    ok = df[col].notna() & df[col].shift(1).notna()
    up = ok & above & (prev == False); dn = ok & (~above) & (prev == True)
    return [(i, f"{name}_up") for i in df.index[up]] + [(i, f"{name}_down") for i in df.index[dn]]

def flip_events(df, col, name):
    s = df[col]; prev = s.shift(1)
    ok = df["sma200"].notna() if "outer" in name else (df["sma50"].notna() if "inner" in name else df["ema21"].notna())
    ok = ok & ok.shift(1).fillna(False)
    up = ok & s & (prev == False); dn = ok & (~s) & (prev == True)
    return [(i, f"{name}_bull") for i in df.index[up]] + [(i, f"{name}_bear") for i in df.index[dn]]

def tag_events(df, col, lo, hi, name):
    inlo = df[col] <= df[lo]; inhi = df[col] >= df[hi]
    ok = df[lo].notna()
    lo_e = ok & inlo & (inlo.shift(1) == False); hi_e = ok & inhi & (inhi.shift(1) == False)
    return [(i, f"{name}_low") for i in df.index[lo_e]] + [(i, f"{name}_high") for i in df.index[hi_e]]

OPPOSITE = {"up":"down","down":"up","bull":"bear","bear":"bull","low":"high","high":"low"}

def forward(df, pos, sym, kind):
    c0 = df["c"].iloc[pos]; n = len(df); row = {"symbol": sym, "group": GROUP[sym], "event": kind, "date": str(df.index[pos].date()), "close": float(c0),
           "rsi": float(df["rsi"].iloc[pos]) if not math.isnan(df["rsi"].iloc[pos]) else None,
           "rsi_vs_med": None, "above200": bool(df["c"].iloc[pos] >= df["sma200"].iloc[pos]) if not math.isnan(df["sma200"].iloc[pos]) else None,
           "sma200_rising": bool(df["sma200_slope"].iloc[pos] > 0) if not math.isnan(df["sma200_slope"].iloc[pos]) else None,
           "outer_bull": bool(df["outer_bull"].iloc[pos]) if not math.isnan(df["sma200"].iloc[pos]) else None,
           "inner_bull": bool(df["inner_bull"].iloc[pos]) if not math.isnan(df["sma50"].iloc[pos]) else None}
    if row["rsi"] is not None and not math.isnan(df["rsi_med"].iloc[pos]): row["rsi_vs_med"] = "below" if row["rsi"] < df["rsi_med"].iloc[pos] else "above"
    for h in HORIZONS:
        seg = df.iloc[pos+1:pos+1+h]
        if len(seg) < h: row[f"runup_{h}"] = row[f"drawdown_{h}"] = row[f"ret_{h}"] = None; continue
        row[f"runup_{h}"] = float(seg["h"].max()/c0 - 1); row[f"drawdown_{h}"] = float(seg["l"].min()/c0 - 1); row[f"ret_{h}"] = float(seg["c"].iloc[-1]/c0 - 1)
    seg = df.iloc[pos+1:pos+61]
    if len(seg) >= 60:
        ih = int(seg["h"].values.argmax()); row["rsi_at_high_60"] = float(seg["rsi"].iloc[ih]) if not math.isnan(seg["rsi"].iloc[ih]) else None; row["days_to_high_60"] = ih + 1
        s200 = seg["sma200"]
        if row["above200"] is True: row["retag200_60"] = bool((seg["l"] <= s200).any())
        elif row["above200"] is False: row["retag200_60"] = bool((seg["h"] >= s200).any())
        else: row["retag200_60"] = None
        row["breakout_20_within_20"] = bool((df["c"].iloc[pos+1:pos+21] > df["hi20_prev"].iloc[pos+1:pos+21]).any()) if pos+21 <= n else None
    else: row["rsi_at_high_60"] = row["days_to_high_60"] = row["retag200_60"] = row["breakout_20_within_20"] = None
    return row

def run():
    events = []; base = {}
    for sym in GROUP:
        p = os.path.join(DATA, "bars", sym + ".json")
        if not os.path.exists(p): continue
        df = indicators(load(sym)); idx = {d: i for i, d in enumerate(df.index)}
        ev = cross_events(df, "sma200", "x200") + cross_events(df, "sma50", "x50") + flip_events(df, "fast_bull", "cloud_fast") + flip_events(df, "inner_bull", "cloud_inner") + flip_events(df, "outer_bull", "cloud_outer") + tag_events(df, "rsi", "rsi_lo", "rsi_hi", "rsi") + tag_events(df, "wr", "wr_lo", "wr_hi", "wr")
        ev.sort()
        by_kind = {}
        for d, k in ev: by_kind.setdefault(k, []).append(d)
        for d, k in ev:
            pos = idx[d]; row = forward(df, pos, sym, k)
            fam, side = k.rsplit("_", 1); opp = f"{fam}_{OPPOSITE[side]}"
            nxt = [x for x in by_kind.get(opp, []) if x > d]
            row["days_to_opposite"] = int(idx[nxt[0]] - pos) if nxt else None
            # whipsaw: the opposite event inside 5 sessions
            row["whipsaw_5"] = (row["days_to_opposite"] is not None and row["days_to_opposite"] <= 5)
            events.append(row)
        # base rates: every session with a full 60-day future
        c = df["c"].values; h = df["h"].values; l = df["l"].values; n = len(df); b = {}
        for H in HORIZONS:
            ru = np.array([h[i+1:i+1+H].max()/c[i]-1 for i in range(n-H-1)]); dd = np.array([l[i+1:i+1+H].min()/c[i]-1 for i in range(n-H-1)]); r = c[1+H:]/c[:-1-H]-1
            b[f"runup_{H}_med"] = float(np.median(ru)); b[f"drawdown_{H}_med"] = float(np.median(dd)); b[f"ret_{H}_med"] = float(np.median(r)); b[f"ret_{H}_pos"] = float((r > 0).mean())
        bo = (df["c"].shift(-1).rolling(20).max().shift(-19) > df["hi20_prev"].shift(-1))  # any close above prior-20 high in the next 20
        bo_any = np.array([(c[i+1:i+21] > df["hi20_prev"].values[i+1:i+21]).any() for i in range(n-21)])
        b["breakout_20_within_20"] = float(np.nanmean(bo_any)); b["sessions"] = int(n); b["first"] = str(df.index[0].date()); b["last"] = str(df.index[-1].date())
        s200 = df["sma200"].values
        rt = []
        for i in range(200, n-61):
            seg_l = l[i+1:i+61]; seg_h = h[i+1:i+61]; seg_s = s200[i+1:i+61]
            rt.append((seg_l <= seg_s).any() if c[i] >= s200[i] else (seg_h >= seg_s).any())
        b["retag200_60"] = float(np.mean(rt)) if rt else None
        base[sym] = b
        print(sym, len(ev), "events")
    json.dump(events, open(os.path.join(DATA, "events.json"), "w"))
    json.dump(base, open(os.path.join(DATA, "base-rates.json"), "w"), indent=1)
    return events, base

def _clean(a): return [float(x) for x in a if x is not None and not (isinstance(x, float) and math.isnan(x))]
def q(a, p): a = _clean(a); return float(np.percentile(a, p)) if a else None
def med(a): return q(a, 50)
def share(a): a = _clean(a); return float(np.mean(a)) if a else None

def summarize(events, base):
    E = pd.DataFrame(events); out = {"per_kind_pooled": {}, "per_kind_by_group": {}, "per_name": {}, "last2y": {}}
    def summ(g):
        d = {"n": int(len(g))}
        for H in HORIZONS:
            d[f"runup_{H}_med"] = med(g[f"runup_{H}"].tolist()); d[f"drawdown_{H}_med"] = med(g[f"drawdown_{H}"].tolist()); d[f"ret_{H}_med"] = med(g[f"ret_{H}"].tolist())
            d[f"ret_{H}_pos"] = share([(x > 0) if x is not None and not (isinstance(x, float) and math.isnan(x)) else None for x in g[f"ret_{H}"].tolist()])
        d["days_to_opposite_med"] = med(g["days_to_opposite"].tolist()); d["whipsaw_5_share"] = share(g["whipsaw_5"].tolist())
        d["retag200_60_share"] = share([x for x in g["retag200_60"].tolist() if x is not None]) if g["retag200_60"].notna().any() else None
        d["rsi_at_high_60_med"] = med(g["rsi_at_high_60"].tolist()); d["rsi_med"] = med(g["rsi"].tolist()); d["days_to_high_60_med"] = med(g["days_to_high_60"].tolist())
        d["breakout_20_within_20_share"] = share([x for x in g["breakout_20_within_20"].tolist() if x is not None]) if g["breakout_20_within_20"].notna().any() else None
        return d
    for k, g in E.groupby("event"): out["per_kind_pooled"][k] = summ(g)
    for (grp, k), g in E.groupby(["group", "event"]): out["per_kind_by_group"].setdefault(grp, {})[k] = summ(g)
    for (sym, k), g in E.groupby(["symbol", "event"]): out["per_name"].setdefault(sym, {})[k] = summ(g)
    E2 = E[E["date"] >= "2024-10-06"]
    for k, g in E2.groupby("event"): out["last2y"][k] = summ(g)
    # pooled base rate (median of per-name medians, and pooled sessions-weighted)
    B = pd.DataFrame(base).T
    out["base_pooled"] = {c: float(B[c].median()) for c in B.columns if c not in ("first", "last", "sessions")}
    out["base_pooled"]["sessions"] = int(B["sessions"].sum())
    out["base_by_group"] = {}
    for grp in ("company", "etf", "macro"):
        Bg = B.loc[[s for s in B.index if GROUP[s] == grp]]
        out["base_by_group"][grp] = {c: float(Bg[c].median()) for c in Bg.columns if c not in ("first", "last", "sessions")}
        out["base_by_group"][grp]["sessions"] = int(Bg["sessions"].sum()); out["base_by_group"][grp]["names"] = int(len(Bg))
    for (grp, k), g in E2.groupby(["group", "event"]): out.setdefault("last2y_by_group", {}).setdefault(grp, {})[k] = summ(g)
    json.dump(out, open(os.path.join(DATA, "tables.json"), "w"), indent=1)
    return E, out

def recurrence(E_all, base_all):
    R_all = {}
    for grp in ("company", "etf", "macro"):
        E = E_all[E_all["group"] == grp]; base = {k: v for k, v in base_all.items() if GROUP[k] == grp}
        R_all[grp] = _recurrence(E, base)
    json.dump(R_all, open(os.path.join(DATA, "recurrence.json"), "w"), indent=1)
    return R_all

def _recurrence(E, base):
    R = []
    def cond(name, mask, follow_label, follow_mask, base_label, base_val, note=""):
        g = E[mask]; n = int(len(g)); f = g[follow_mask(g)] if n else g
        R.append({"condition": name, "n": n, "names": int(g["symbol"].nunique()), "follow": follow_label, "n_follow": int(len(f)),
                  "share": float(len(f)/n) if n else None, "base_label": base_label, "base": base_val,
                  "ret_60_med": med(g["ret_60"].tolist()), "runup_60_med": med(g["runup_60"].tolist()), "drawdown_60_med": med(g["drawdown_60"].tolist()), "note": note})
    B = pd.DataFrame(base).T
    all200up = E["event"] == "x200_up"
    bo_base_any200 = share([x for x in E[all200up]["breakout_20_within_20"].tolist() if x is not None])
    cond("200-day reclaim (close crosses up) with RSI below its own 2-year median", all200up & (E["rsi_vs_med"] == "below"),
         "a close above the prior 20-session high within 20 sessions", lambda g: g["breakout_20_within_20"] == True,
         "same after ANY 200-day reclaim", bo_base_any200, "Alan's example combination.")
    cond("200-day reclaim with RSI above its own 2-year median", all200up & (E["rsi_vs_med"] == "above"),
         "a close above the prior 20-session high within 20 sessions", lambda g: g["breakout_20_within_20"] == True, "same after ANY 200-day reclaim", bo_base_any200)
    cond("200-day reclaim while the 200-day is rising", all200up & (E["sma200_rising"] == True), "price re-tags the 200-day within 60 sessions", lambda g: g["retag200_60"] == True,
         "every session: 200-day re-tagged within 60 (median of names)", float(B["retag200_60"].median()))
    cond("200-day reclaim while the 200-day is falling", all200up & (E["sma200_rising"] == False), "price re-tags the 200-day within 60 sessions", lambda g: g["retag200_60"] == True,
         "every session: 200-day re-tagged within 60 (median of names)", float(B["retag200_60"].median()))
    cond("200-day loss (close crosses down) while the 200-day is rising", (E["event"] == "x200_down") & (E["sma200_rising"] == True), "price re-tags the 200-day within 60 sessions", lambda g: g["retag200_60"] == True,
         "every session: 200-day re-tagged within 60 (median of names)", float(B["retag200_60"].median()))
    cond("200-day loss while the 200-day is falling", (E["event"] == "x200_down") & (E["sma200_rising"] == False), "price re-tags the 200-day within 60 sessions", lambda g: g["retag200_60"] == True,
         "every session: 200-day re-tagged within 60 (median of names)", float(B["retag200_60"].median()))
    pos60 = float(B["ret_60_pos"].median())
    cond("RSI tags its own 10th percentile while price is ABOVE the 200-day", (E["event"] == "rsi_low") & (E["above200"] == True), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("RSI tags its own 10th percentile while price is BELOW the 200-day", (E["event"] == "rsi_low") & (E["above200"] == False), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("RSI tags its own 90th percentile while price is ABOVE the 200-day", (E["event"] == "rsi_high") & (E["above200"] == True), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("RSI tags its own 90th percentile while price is BELOW the 200-day", (E["event"] == "rsi_high") & (E["above200"] == False), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("Inner cloud flips bull (21 EMA over 50 SMA) while the outer cloud is bull (50 over 200)", (E["event"] == "cloud_inner_bull") & (E["outer_bull"] == True), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60, "the pullback-resumption shape")
    cond("Inner cloud flips bull while the outer cloud is bear", (E["event"] == "cloud_inner_bull") & (E["outer_bull"] == False), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("Inner cloud flips bear while the outer cloud is bull", (E["event"] == "cloud_inner_bear") & (E["outer_bull"] == True), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("50-day reclaim while price is above the 200-day", (E["event"] == "x50_up") & (E["above200"] == True), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("50-day reclaim while price is below the 200-day", (E["event"] == "x50_up") & (E["above200"] == False), "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("Outer cloud flips bull (golden cross)", E["event"] == "cloud_outer_bull", "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("Outer cloud flips bear (death cross)", E["event"] == "cloud_outer_bear", "60-session close is higher", lambda g: g["ret_60"] > 0, "every session: 60-session close higher (median of names)", pos60)
    cond("Williams %R tags its own 10th percentile with RSI also below its median", (E["event"] == "wr_low") & (E["rsi_vs_med"] == "below"), "20-session close is higher", lambda g: g["ret_20"] > 0, "every session: 20-session close higher (median of names)", float(B["ret_20_pos"].median()))
    return R

if __name__ == "__main__":
    ev, base = run(); E, out = summarize(ev, base); R = recurrence(E, base)
    print(json.dumps({k: v["n"] for k, v in out["per_kind_pooled"].items()}, indent=0))
    for grp, RR in R.items():
      print("##", grp)
      for r in RR: print(f"{r['n']:5d} {r['share'] if r['share'] is None else round(r['share'],3)} base {round(r['base'],3) if r['base'] is not None else None} | {r['condition']} -> {r['follow']}")
