"""Build the daily market panel every question reads (SPY dates, 2003-09-11 →). Writes <scratch>/panel.csv and breadth.csv.
Everything on a row is known at that row's close except columns named fwd_* / dd_* / up_* (forward outcomes)."""
import os, json, numpy as np, pandas as pd, lib

S = lib.SCRATCH
spy = lib.load_bars("SPY"); idx = spy.index
P = pd.DataFrame(index=idx); P["spy"] = spy.c; P["spy_h"] = spy.h; P["spy_l"] = spy.l; P["spy_v"] = spy.v
c = spy.c.values
P["spy_rsi"] = lib.rsi(c); P["spy_rsi_pct"] = lib.own_pct(P.spy_rsi.values)
P["spy_sma50"] = lib.sma(c, 50); P["spy_sma200"] = lib.sma(c, 200); P["spy_sma125"] = lib.sma(c, 125)
P["spy_dist200"] = 100 * (c / P.spy_sma200 - 1); P["spy_slope200"] = 100 * (P.spy_sma200 / P.spy_sma200.shift(20) - 1)
P["spy_above200"] = (c > P.spy_sma200).astype(float).where(P.spy_sma200.notna())
P["spy_hi252"] = spy.c.rolling(252).max(); P["spy_dd_from_high"] = 100 * (c / P.spy_hi252 - 1)
for h in (1, 2, 3, 5, 10, 21, 42, 63, 126, 252):
    P[f"fwd_{h}"] = lib.fwd_ret(c, h)
for h in (5, 21, 63, 126):
    P[f"dd_{h}"] = lib.fwd_maxdd(c, h); P[f"up_{h}"] = lib.fwd_maxup(c, h)

def align(series): return series.reindex(idx, method="ffill")
# VIX from 1990 (own percentile uses its whole history, never a later value)
vix = lib.load_bars("VIX", cut_faults=False); v = vix.c
vd = pd.DataFrame({"vix": v}); vd["vix_pct"] = lib.own_pct(v.values); vd["vix_sma10"] = lib.sma(v.values, 10); vd["vix_sma50"] = lib.sma(v.values, 50); vd["vix_sma200"] = lib.sma(v.values, 200)
vd["vix_vs50"] = 100 * (v / vd.vix_sma50 - 1); vd["vix_vs50_pct"] = lib.own_pct(vd.vix_vs50.values); vd["vix_chg5"] = 100 * (v / v.shift(5) - 1)
vd["vix_cloud"] = np.where(vd.vix_sma200.isna(), np.nan, np.where((v > vd.vix_sma50) & (v > vd.vix_sma200), 2, np.where((v < vd.vix_sma50) & (v < vd.vix_sma200), 0, 1)))
vd["vix_hi63"] = v.rolling(63).max(); vd["vix_off_peak"] = 100 * (v / vd.vix_hi63 - 1)
for col in vd.columns: P[col] = align(vd[col])
v3 = lib.load_fmp_eod("^VIX3M")
if v3 is not None:
    r = (align(v) / align(v3.c)); P["vix_ratio"] = r; P["vix_ratio_pct"] = lib.own_pct(r.values)
# put/call (Cboe, total and equity-only) from Nov 2006
for name in ("PCC", "PCCE"):
    d = lib.load_bars(name, cut_faults=False)
    if d is None: continue
    k = name.lower(); s = d.c; P[k] = align(s); P[k + "5"] = align(s.rolling(5).mean()); P[k + "5_pct"] = lib.own_pct(P[k + "5"].values); P[k + "_pct"] = lib.own_pct(P[k].values); P[k + "21"] = align(s.rolling(21).mean())
# rates, dollar, bonds, credit
for name, k in (("US10Y", "y10"), ("DXY", "dxy"), ("TLT", "tlt"), ("GCUSD", "gold")):
    d = lib.load_bars(name, cut_faults=False); s = d.c; P[k] = align(s); P[k + "_sma200"] = align(s.rolling(200).mean())
P["y10_above200"] = (P.y10 > P.y10_sma200).astype(float); P["dxy_above200"] = (P.dxy > P.dxy_sma200).astype(float); P["dxy_dist200"] = 100 * (P.dxy / P.dxy_sma200 - 1)
hyg = lib.load_fmp_eod("HYG"); lqd = lib.load_fmp_eod("LQD")
if hyg is not None and lqd is not None:
    P["hyg"] = align(hyg.c); P["lqd"] = align(lqd.c); P["credit20"] = 100 * (P.hyg / P.hyg.shift(20) - 1) - 100 * (P.lqd / P.lqd.shift(20) - 1)
P["safe20"] = 100 * (P.spy / P.spy.shift(20) - 1) - 100 * (P.tlt / P.tlt.shift(20) - 1)
P["mom125"] = 100 * (P.spy / P.spy_sma125 - 1)

# breadth from the cached universe (single companies only, by the rules file: anything not a fund/crypto/futures)
prof = lib.profiles(); cls = lib.rules()["classes"]
funds = set(cls["index_etf"]["symbols"]) | set(cls["sector_etf"]["symbols"]) | set(cls["crypto"]["symbols"]) | set(cls["futures"]["symbols"]) | {t for t, p in prof.items() if p.get("is_etf")} | lib.COMMODITY_FUNDS | lib.BOND_FUNDS
stocks = [s for s in lib.universe() if s not in funds]
A50 = {}; A200 = {}; NH = {}; NL = {}; ADV = {}; MEAS = {}
closes = {}
for s in stocks:
    d = lib.load_bars(s)
    if d is None or len(d) < 260: continue
    cc = d.c; closes[s] = cc
    a50 = (cc > cc.rolling(50).mean()).where(cc.rolling(50).mean().notna()); a200 = (cc > cc.rolling(200).mean()).where(cc.rolling(200).mean().notna())
    nh = (cc >= cc.rolling(252).max()).where(cc.rolling(252).max().notna()); nl = (cc <= cc.rolling(252).min()).where(cc.rolling(252).min().notna())
    adv = (cc > cc.shift(1)).where(cc.shift(1).notna())
    A50[s] = a50; A200[s] = a200; NH[s] = nh; NL[s] = nl; ADV[s] = adv
def share(D):
    M = pd.DataFrame(D).reindex(idx); return 100 * M.mean(axis=1), M.notna().sum(axis=1)
P["a50"], P["names_measured"] = share(A50); P["a200"], _ = share(A200); P["nh"], _ = share(NH); P["nl"], _ = share(NL); P["adv"], _ = share(ADV)
P.loc[P.names_measured < 50, ["a50", "a200", "nh", "nl", "adv"]] = np.nan
P["a50_pct"] = lib.own_pct(P.a50.values); P["hl"] = P.nh - P.nl; P["adv20"] = (P.adv - 50).rolling(20).mean()
# 52-week-high count style "strength" and McClellan-like breadth are own-percentile scored below
# fear & greed proxy: seven parts, each its own expanding percentile (100 = greed), averaged over the parts available
parts = {"momentum": P.mom125, "strength": P.hl, "breadth": P.adv20, "putcall": -P.pcc5 if "pcc5" in P else None, "vix": -P.vix_vs50, "safe": P.safe20, "junk": P.credit20 if "credit20" in P else None}
sc = pd.DataFrame(index=idx)
for k, s in parts.items():
    if s is None: continue
    sc["fg_" + k] = lib.own_pct(s.values)
P = pd.concat([P, sc], axis=1); P["fg"] = sc.mean(axis=1).where(sc.notna().sum(axis=1) >= 5); P["fg_parts"] = sc.notna().sum(axis=1); P["fg_pct"] = lib.own_pct(P.fg.values)
# sigma day counts (USUAL DAY history, public.sigma_day_counts)
dc = pd.DataFrame(json.load(open(os.path.join(S, "db", "sigma_day_counts.json")))); dc.index = pd.to_datetime(dc.date)
for k in ("names_measured", "n", "up", "dn"): P["sg_" + k] = dc[k].reindex(idx)
P["sg_dn_share"] = 100 * P.sg_dn / P.sg_names_measured; P["sg_up_share"] = 100 * P.sg_up / P.sg_names_measured; P["sg_n_share"] = 100 * P.sg_n / P.sg_names_measured
P["sg_dn_pct"] = lib.own_pct(P.sg_dn_share.values); P["sg_up_pct"] = lib.own_pct(P.sg_up_share.values)
P.to_csv(os.path.join(S, "panel.csv"))
pd.DataFrame(closes).reindex(idx).to_csv(os.path.join(S, "stock_closes.csv"))
print("panel", P.shape, "stocks in breadth", len(A50), "first breadth", P.a50.first_valid_index().date(), "fg from", P.fg.first_valid_index().date())
print(P.iloc[-1][["spy", "spy_rsi", "spy_rsi_pct", "vix", "vix_pct", "vix_cloud", "pcc5", "pcc5_pct", "a50", "fg", "sg_dn_share", "sg_dn_pct", "y10_above200", "dxy_above200"]].to_dict())
