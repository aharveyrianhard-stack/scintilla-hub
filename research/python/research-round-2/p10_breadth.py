"""P10 · Breadth thrusts rebuilt from our own daily history, 2003 → the 25 Sep 2026 close.

Stolen from: Zweig's breadth thrust (Winning on Wall Street, 1986; StockCharts' definition,
https://school.stockcharts.com/doku.php?id=market_indicators:zweig_breadth_thrust): the 10-day average of advances ÷ (advances +
declines) climbs from under 0.40 to over 0.615 within 10 sessions; and the cumulative advance–decline line built without
look-ahead (https://github.com/IslamBaraka90/Fintech-Cumulative-Advance-Decline-Line-Market-Breadth-algorithm).

Three breadth sources, side by side:
  1. the S&P 500 as it was on each day (point-in-time membership + bars, stats-cache/point-in-time/v1): no survivorship;
  2. the served universe (the 364 names in the candles-f5 cache): today's names, survivorship built in — shown so the bias is visible;
  3. the USUAL DAY table public.sigma_day_counts (committed dump, 2003-10 → 2026-09-25): names beyond their usual day, up and down.
Rule family (counted, R5): Zweig at 2 lows x 3 highs x 2 windows (12); share above the 50-day from under X to over Y within N
(8); a USUAL-DAY thrust — the 5-day share of names with an unusual UP day in its own top 5 / 2 / 1% (3).  23 rules x 3 horizons.
Episodes: a signal counts only if no signal of the same rule fired in the 60 sessions before (R3).  Outcome: the S&P 500 index
20 / 63 / 126 / 252 sessions later against any day of 2004–2026; worst fall in the next 63.  SPA over the family with
Study C's construction (long h sessions after a fire vs the same share of days held without the signal).
"""
import os, warnings
import numpy as np, pandas as pd
warnings.filterwarnings("ignore")
import rr_lib as L
S = L.S

HORIZONS = (20, 63, 126, 252)
SPA_H = (20, 63, 126)
REFRACT = 60


def breadth(C, M=None):
    """Daily breadth of a panel: advances, declines, share above 50/200-day, new 52-week highs/lows (members only when M given)."""
    R = C.pct_change(fill_method=None)
    ok = R.notna() & C.shift(1).notna()
    if M is not None: ok &= M
    adv = ((R > 0) & ok).sum(1); dec = ((R < 0) & ok).sum(1); n = ok.sum(1)
    s50, s200 = C.rolling(50, min_periods=50).mean(), C.rolling(200, min_periods=200).mean()
    m50 = s50.notna() & (M if M is not None else True); m200 = s200.notna() & (M if M is not None else True)
    hi, lo = C.rolling(252, min_periods=252).max(), C.rolling(252, min_periods=252).min()
    m252 = hi.notna() & (M if M is not None else True)
    B = pd.DataFrame({"adv": adv, "dec": dec, "n": n,
                      "above50": 100 * ((C > s50) & m50).sum(1) / m50.sum(1).replace(0, np.nan),
                      "above200": 100 * ((C > s200) & m200).sum(1) / m200.sum(1).replace(0, np.nan),
                      "new_hi": 100 * ((C >= hi) & m252).sum(1) / m252.sum(1).replace(0, np.nan),
                      "new_lo": 100 * ((C <= lo) & m252).sum(1) / m252.sum(1).replace(0, np.nan)})
    B["ratio"] = B.adv / (B.adv + B.dec).replace(0, np.nan)
    B["zema"] = B.ratio.ewm(span=10, adjust=False).mean()
    B["ad_line"] = (B.adv - B.dec).cumsum()
    return B


def thrust(series, low, high, window):
    """True on the day the series closes above `high` having been below `low` within the last `window` sessions."""
    was_low = (series < low).astype(float).rolling(window, min_periods=1).max().shift(1).fillna(0) > 0
    return (series > high) & was_low & ~((series.shift(1) > high) & was_low.shift(1).fillna(False))


def decluster(fire, gap=REFRACT):
    f = fire.values.astype(bool); out = np.zeros(len(f), bool); last = -10 ** 9
    for i in np.where(f)[0]:
        if i - last > gap: out[i] = True
        last = i if f[i] else last
    return pd.Series(out, index=fire.index)


def expanding_pct(s, min_n=250):
    v = s.values; out = np.full(len(v), np.nan); import bisect; order = []
    for i, x in enumerate(v):
        if np.isnan(x): continue
        if len(order) >= min_n: out[i] = 100 * bisect.bisect_left(order, x) / len(order)
        bisect.insort(order, x)
    return pd.Series(out, index=s.index)


def rules(B, SG):
    out = {}
    for lo in (0.40, 0.45):
        for hi in (0.60, 0.615, 0.65):
            for w in (10, 15):
                out[f"Zweig {lo:.2f}→{hi:.3g} in {w}"] = thrust(B.zema, lo, hi, w)
    for x in (30, 40):
        for y in (60, 70):
            for w in (10, 20):
                out[f"above-50d {x}%→{y}% in {w}"] = thrust(B.above50, x, y, w)
    if SG is not None:
        up5 = SG.up_share.rolling(5).sum(); pc = expanding_pct(up5)
        net = (SG.up_share - SG.dn_share).rolling(5).sum()
        for p in (95, 98, 99):
            f = (pc >= p) & (net > 0); out[f"USUAL DAY up-thrust top {100 - p}%"] = (f & ~f.shift(1).fillna(False)).reindex(B.index).fillna(False)
    return {k: decluster(v.reindex(B.index).fillna(False)) for k, v in out.items()}


def hold(fire, h):
    f = fire.astype(float).values; c = np.cumsum(f); pos = np.zeros(len(f))
    lag = np.concatenate([np.zeros(h), c[:-h]]) if h < len(f) else np.zeros(len(f))
    pos[1:] = (c[:-1] - lag[:-1]) > 0
    return pos


def outcomes(px, fires, base_idx):
    c = px.values; n = len(c); fw = {h: pd.Series(np.r_[c[h:] / c[:-h] - 1, np.full(h, np.nan)], index=px.index) for h in HORIZONS}
    dd63 = pd.Series([c[i:i + 64].min() / c[i] - 1 if i + 63 < n else np.nan for i in range(n)], index=px.index)
    base = {h: fw[h].reindex(base_idx) for h in HORIZONS}
    res = {"base": {h: {"median_pct": L.r(100 * base[h].median()), "share_up_pct": L.r(100 * (base[h].dropna() > 0).mean(), 1)} for h in HORIZONS} | {"dd63_median_pct": L.r(100 * dd63.reindex(base_idx).median())}}
    per = {}
    for k, f in fires.items():
        d = f[f].index; row = {"episodes": int(len(d)), "dates": [str(x.date()) for x in d], "word": None}
        for h in HORIZONS:
            v = fw[h].reindex(d).dropna()
            row[f"fwd{h}"] = {"n": int(len(v)), "median_pct": L.r(100 * v.median()) if len(v) else None, "share_up_pct": L.r(100 * (v > 0).mean(), 1) if len(v) else None,
                              "vs_base_pts": L.r(100 * (v.median() - base[h].median())) if len(v) else None,
                              "false_alarms": int((v < base[h].median()).sum())}
        v = dd63.reindex(d).dropna(); row["dd63_median_pct"] = L.r(100 * v.median()) if len(v) else None
        row["cases"] = [{"date": str(x.date()), **{f"fwd{h}_pct": L.r(100 * fw[h].get(x, np.nan), 1) for h in HORIZONS}, "dd63_pct": L.r(100 * dd63.get(x, np.nan), 1)} for x in d]
        per[k] = row
    res["rules"] = per; res["_fw"] = fw
    return res


def spa_family(px, fires, idx):
    r = px.pct_change().reindex(idx).fillna(0).values; cols, names = [], []
    for h in SPA_H:
        for k, f in fires.items():
            pos = hold(f.reindex(idx).fillna(False), h); p = pos.mean()
            if p == 0: continue
            cols.append((np.r_[0, pos[:-1]] - p) * r); names.append(f"{k} · hold {h}")
    X = np.column_stack(cols)
    out = L.spa(np.zeros(len(idx)), -X)
    from arch.bootstrap import StepM
    st = StepM(np.zeros(len(idx)), -X, size=0.10, block_size=60, reps=1000, bootstrap="stationary", seed=L.SEED); st.compute()
    sup = [names[int(str(c).replace("model.", ""))] if str(c).startswith("model.") else str(c) for c in st.superior_models]
    best = int(np.argmax(X.mean(0)))
    out.update({"n_rules": X.shape[1], "best": names[best], "best_pts_per_year": L.r(100 * 252 * X[:, best].mean()), "stepm_superior": sup})
    return out


def main():
    RES = {"what": "P10 breadth thrusts", "generated": pd.Timestamp.utcnow().isoformat(), "seed": L.SEED, "refractory_sessions": REFRACT}
    gspc = L.index("^GSPC")
    C, M = L.pit_panel(); C = C[C.index >= "2003-09-10"]; M = M.reindex(C.index).fillna(False)
    Bp = breadth(C, M)
    Cs = L.served_panel(); Cs = Cs[Cs.index >= "2003-09-10"]; Bs = breadth(Cs)
    SG = L.sigma_counts(); SG = SG[SG.names_measured >= 100].copy()
    SG["up_share"] = 100 * SG.up / SG.names_measured; SG["dn_share"] = 100 * SG.dn / SG.names_measured
    idx = Bp.index[(Bp.index >= "2004-09-01")]   # 252 sessions of warm-up for the 52-week and 200-day counts
    Bp, Bs = Bp.reindex(idx), Bs.reindex(idx); px = gspc.reindex(idx).ffill()
    RES["panel"] = {"pit_names_ever": int(C.shape[1]), "pit_members_median_measured": int(Bp.n.median()), "served_names": int(Cs.shape[1]), "from": str(idx[0].date()), "to": str(idx[-1].date()),
                    "sigma_rows_used": int(len(SG)), "sigma_from": str(SG.index[0].date())}
    out = {}
    for tag, B, sg in (("pit", Bp, SG), ("served", Bs, None)):
        F = rules(B, sg); O = outcomes(px, F, idx); fw = O.pop("_fw")
        O["spa"] = spa_family(px, F, idx)
        rng = np.random.default_rng(L.SEED); base126 = O["base"][126]["median_pct"] / 100; pv = []
        for k, row in O["rules"].items():
            # how sure: resample the signals by calendar year (R3/R4), p = share of resampled medians at or under the any-day median
            d = pd.to_datetime(row["dates"]); v = fw[126].reindex(d); yrs = sorted(set(d.year))
            by = {y: v[d.year == y].dropna().values for y in yrs}; meds = []
            for _ in range(2000):
                pool = np.concatenate([by[y] for y in rng.choice(yrs, len(yrs))]) if yrs else np.array([])
                if len(pool): meds.append(np.median(pool))
            meds = np.array(meds); row["fwd126"]["range90_pct"] = [L.r(100 * np.percentile(meds, 5)), L.r(100 * np.percentile(meds, 95))] if len(meds) else None
            row["fwd126"]["p_naive"] = L.r(float((meds <= base126).mean()), 3) if len(meds) else None; row["years"] = len(yrs); pv.append(row["fwd126"]["p_naive"] if len(meds) else 1.0)
        from statsmodels.stats.multitest import multipletests
        adj = multipletests(pv, method="fdr_bh")[1]
        for (k, row), a in zip(O["rules"].items(), adj):
            row["fwd126"]["p_bh"] = L.r(float(a), 3); row["word"] = L.status_word(row["episodes"], row["fwd126"]["p_naive"], float(a))
        # walk-forward halves for the classic Zweig and the classic above-50 thrust
        halves = {}
        for k in ("Zweig 0.40→0.615 in 10", "above-50d 40%→60% in 10"):
            d = pd.to_datetime(O["rules"][k]["dates"]); h = {}
            for lab, a, b in (("2004-2014", "2004", "2015"), ("2015-2026", "2015", "2027")):
                dd = d[(d >= a) & (d < b)]; v = fw[126].reindex(dd).dropna(); bb = fw[126][(fw[126].index >= a) & (fw[126].index < b)]
                h[lab] = {"episodes": int(len(dd)), "fwd126_median_pct": L.r(100 * v.median()) if len(v) else None, "base_median_pct": L.r(100 * bb.median())}
            halves[k] = h
        O["halves"] = halves
        out[tag] = O
        print(tag, O["spa"])
        for k, row in O["rules"].items(): print(f"  {k:36s} ep {row['episodes']:3d} yrs {row['years']:2d}  126: {row['fwd126']['median_pct']} {row['fwd126']['range90_pct']} p {row['fwd126']['p_naive']} bh {row['fwd126']['p_bh']} {row['word']}  false {row['fwd126']['false_alarms']}")
    RES["results"] = out
    # today (25 Sep close)
    t = idx[-1]
    RES["today"] = {"date": str(t.date()), "pit": {k: L.r(Bp.loc[t, k], 3 if k in ("ratio", "zema") else 1) for k in ("above50", "above200", "new_hi", "new_lo", "ratio", "zema")} | {"adv": int(Bp.loc[t, "adv"]), "dec": int(Bp.loc[t, "dec"])},
                    "served": {k: L.r(Bs.loc[t, k], 3 if k in ("ratio", "zema") else 1) for k in ("above50", "above200", "new_hi", "new_lo", "zema")},
                    "above50_own_pctile": L.r(100 * float((Bp.above50.dropna() < Bp.above50.iloc[-1]).mean()), 0),
                    "zema_own_pctile": L.r(100 * float((Bp.zema.dropna() < Bp.zema.iloc[-1]).mean()), 0),
                    "sigma_last": {"date": str(SG.index[-1].date()), "up": int(SG.up.iloc[-1]), "dn": int(SG.dn.iloc[-1]), "names": int(SG.names_measured.iloc[-1])},
                    "last_zweig_classic": (out["pit"]["rules"]["Zweig 0.40→0.615 in 10"]["dates"] or [None])[-1],
                    "last_above50_thrust": (out["pit"]["rules"]["above-50d 40%→60% in 10"]["dates"] or [None])[-1]}
    RES["survivorship_gap"] = {"above200_mean_served_minus_pit_pts": L.r(float((Bs.above200 - Bp.above200).mean()), 1), "above50_mean_served_minus_pit_pts": L.r(float((Bs.above50 - Bp.above50).mean()), 1)}
    L.dump("p10-breadth.json", RES); L.save_provenance("provenance-p10.json")
    charts(RES, Bp, Bs, px, idx)


def charts(RES, Bp, Bs, px, idx):
    P = RES["results"]["pit"]["rules"]
    f, (ax, ab) = S.fig(14, 8.5, rows=2, sharex=True, gridspec_kw={"height_ratios": [1.6, 1]})
    S.updown_line(ax, idx, px.values, lw=0.9); ax.set_yscale("log"); ax.set_ylabel("S&P 500 (log)")
    for k, mk, col in (("Zweig 0.40→0.615 in 10", "^", S.UP), ("above-50d 40%→60% in 10", "o", S.INK)):
        d = pd.to_datetime(P[k]["dates"]); ax.plot(d, px.reindex(d).values * 0.93, mk, color=col, ms=9, ls="none", label=f"{k} ({len(d)})")
    ax.legend(loc="upper left", fontsize=10)
    ab.fill_between(idx, 0, Bp.above50.values, color=S.MUTE, alpha=0.35, lw=0, label="% above 50-day"); ab.plot(idx, Bp.above200.values, color=S.INK, lw=1.0, label="% above 200-day")
    ab.axhline(40, color=S.DN, lw=0.8, ls="--"); ab.axhline(60, color=S.UP, lw=0.8, ls="--"); ab.set_ylim(0, 100); ab.set_ylabel("% of S&P 500 members"); ab.legend(loc="lower left", fontsize=10)
    ax.set_title("P10-1 · 22 years of S&P 500 breadth, rebuilt point in time: the thrust days marked (triangles: Zweig; dots: above-50-day 40%→60%)")
    S.caption(f, "Members as they were on each day (FMP constituents, Massive bars, built on Fly). One signal per 60 sessions. The 200-day line is a share, not a price.")
    S.save(f, os.path.join(L.CH, "p10-1-breadth-history.png"))
    # P10-2 · what followed each classic Zweig thrust, path by path, against the any-day band
    f, ax = S.fig(14, 6); c = px.values; H = 252
    starts = np.arange(0, len(c) - H, 5); paths = np.array([c[i:i + H + 1] / c[i] - 1 for i in starts]) * 100
    x = np.arange(H + 1); ax.fill_between(x, np.percentile(paths, 10, 0), np.percentile(paths, 90, 0), color=S.MUTE, alpha=0.2, lw=0, label="any day: 10th–90th percentile")
    ax.plot(x, np.percentile(paths, 50, 0), color=S.MUTE, lw=2, ls="--", label="any day: median")
    for dstr in P["Zweig 0.40→0.615 in 10"]["dates"] + P["above-50d 40%→60% in 10"]["dates"]:
        i = idx.get_loc(pd.Timestamp(dstr)); seg = c[i:i + H + 1] / c[i] * 100 - 100
        S.updown_line(ax, np.arange(len(seg)), seg, lw=1.1)
        ax.annotate(dstr[:7], (len(seg) - 1, seg[-1]), xytext=(4, 0), textcoords="offset points", fontsize=9, color=S.INK2)
    ax.axhline(0, color=S.MUTE, lw=0.8); ax.set_xlabel("sessions after the signal"); ax.set_ylabel("S&P 500 change, %"); ax.legend(loc="upper left", fontsize=10)
    ax.set_title("P10-2 · After each breadth thrust (Zweig and above-50-day 40→60): the S&P's next year, one line per signal")
    S.caption(f, "Each line is one signal's next 252 sessions, green where the day rose, red where it fell. The band is every 5th day of 2004-2025 as a starting point.")
    S.save(f, os.path.join(L.CH, "p10-2-after-thrusts.png"))
    # P10-3 · every rule in the family: median next-126 against any day, with episode counts
    R = RES["results"]["pit"]; names = list(R["rules"]); base = R["base"][126]["median_pct"]
    f, ax = S.fig(14, 7.5); y = np.arange(len(names))
    vals = [R["rules"][n]["fwd126"]["median_pct"] if R["rules"][n]["fwd126"]["median_pct"] is not None else np.nan for n in names]
    ax.barh(y, [v - base if np.isfinite(v) else 0 for v in vals], left=base, color=[S.UP if (np.isfinite(v) and v >= base) else S.DN for v in vals], height=0.6)
    for i, n in enumerate(names):
        r = R["rules"][n]; ax.text(max(vals[i], base) + 0.3 if np.isfinite(vals[i]) else base + 0.3, i, f"{r['episodes']} signals · {r['fwd126']['false_alarms']} below any-day", va="center", fontsize=9, color=S.INK2)
    ax.axvline(base, color=S.MUTE, lw=1.5); ax.set_yticks(y); ax.set_yticklabels(names, fontsize=10); ax.invert_yaxis()
    ax.set_xlabel(f"S&P 500 median change over the next 126 sessions, % (any day: {base:.1f}%)"); ax.set_xlim(None, np.nanmax(vals) + 9)
    ax.set_title(f"P10-3 · The whole family of 23 breadth rules against any day: none survives the counted search (SPA over {R['spa']['n_rules']} rule-horizons: p = {R['spa']['consistent']:.2f})")
    S.caption(f, "Point-in-time S&P 500 breadth. 'below any-day' = signals whose next 126 sessions did worse than the median day: the false alarms.")
    S.save(f, os.path.join(L.CH, "p10-3-rule-family.png"))
    # P10-4 · survivorship made visible: share above the 200-day, served universe vs point in time
    f, ax = S.fig(14, 4.8)
    ax.plot(idx, Bs.above200.values, color=S.INK, lw=0.9, label="served universe (today's 364 names)"); ax.plot(idx, Bp.above200.values, color=S.MUTE, lw=0.9, label="S&P 500 as it was each day")
    ax.fill_between(idx, Bp.above200.values, Bs.above200.values, where=(Bs.above200 > Bp.above200).values, color=S.UP, alpha=0.25, lw=0)
    ax.set_ylim(0, 100); ax.set_ylabel("% above the 200-day"); ax.legend(loc="lower left", fontsize=10)
    g = RES["survivorship_gap"]; ax.set_title(f"P10-4 · Survivorship, made visible: today's names look healthier in the past by {g['above200_mean_served_minus_pit_pts']:+.1f} points on average")
    S.caption(f, "Green = where the list of today's names reads more names above the 200-day than the index as it really was. This is why the thrust counts use the point-in-time list.")
    S.save(f, os.path.join(L.CH, "p10-4-survivorship.png"))


if __name__ == "__main__":
    main()
