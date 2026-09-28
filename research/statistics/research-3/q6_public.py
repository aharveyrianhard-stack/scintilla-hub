"""Q6 · public work replicated on our data.
 (a) Lo, Mamaysky & Wang (2000, J. Finance / NBER w7613) 'Foundations of Technical Analysis': Nadaraya-Watson kernel smoothing of prices in rolling 38-day windows
     (bandwidth by leave-one-out cross-validation, then × 0.3 as they do), local extrema of the smoothed curve, ten pattern definitions on the last five extrema
     (HS, IHS, BTOP, BBOT, TTOP, TBOT, RTOP, RBOT, DTOP, DBOT), and the test: are returns after a pattern drawn from the same distribution as all returns?
     (Kolmogorov-Smirnov on standardised one-day returns three days after completion, as in the paper; plus the next 21 sessions because that is what we trade).
 (b) Harvey & Liu (2015, J. Portfolio Management) 'Backtesting': the haircut Sharpe ratio. t = SR·√years, p from the normal, then Bonferroni (p·M), Holm and BHY
     adjustments for M tests tried; the haircut is how much of the Sharpe ratio survives. Applied to the rules published on the Hub today and to this lane's own cells."""
import sys, os; sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lib import *; import charts as C
from scipy import stats
out = {"asof": ASOF}
L_, D_ = 35, 3; WIN = L_ + D_
def kernel_fit(p):
    """Nadaraya-Watson with a Gaussian kernel on x = 0..n-1; bandwidth by leave-one-out CV over a grid, then × 0.3 (LMW §III.B)."""
    n = len(p); x = np.arange(n); dx = (x[:, None] - x[None, :]) ** 2; best = None
    for h in np.linspace(2.0, 10.0, 17):
        W = np.exp(-dx / (2 * h * h)); np.fill_diagonal(W, 0); m = (W @ p) / W.sum(1); err = ((p - m) ** 2).sum()
        if best is None or err < best[0]: best = (err, h)
    h = best[1] * 0.3; W = np.exp(-dx / (2 * h * h)); return (W @ p) / W.sum(1), best[1]
def extrema(m):
    ex = []
    for i in range(1, len(m) - 1):
        if m[i] > m[i - 1] and m[i] > m[i + 1]: ex.append((i, m[i], 1))
        elif m[i] < m[i - 1] and m[i] < m[i + 1]: ex.append((i, m[i], -1))
    return ex
def near(a, b, tol): avg = (a + b) / 2; return abs(a - avg) <= tol * avg and abs(b - avg) <= tol * avg
def classify(ex):
    """The LMW definitions on the last five extrema E1..E5 (must alternate). Returns a pattern name or None."""
    if len(ex) < 5: return None
    E = ex[-5:]; t = [e[0] for e in E]; v = [e[1] for e in E]; s = [e[2] for e in E]
    if any(s[i] == s[i + 1] for i in range(4)): return None
    E1, E2, E3, E4, E5 = v
    if s[0] == 1:
        if E3 > E1 and E3 > E5 and near(E1, E5, 0.015) and near(E2, E4, 0.015): return "HS"
        if E1 < E3 < E5 and E2 > E4: return "BTOP"
        if E1 > E3 > E5 and E2 < E4: return "TTOP"
        tops = [E1, E3, E5]; bots = [E2, E4]; ta = np.mean(tops); ba = np.mean(bots)
        if all(abs(x - ta) <= 0.0075 * ta for x in tops) and all(abs(x - ba) <= 0.0075 * ba for x in bots) and min(tops) > max(bots): return "RTOP"
    else:
        if E3 < E1 and E3 < E5 and near(E1, E5, 0.015) and near(E2, E4, 0.015): return "IHS"
        if E1 > E3 > E5 and E2 < E4: return "BBOT"
        if E1 < E3 < E5 and E2 > E4: return "TBOT"
        bots = [E1, E3, E5]; tops = [E2, E4]; ta = np.mean(tops); ba = np.mean(bots)
        if all(abs(x - ba) <= 0.0075 * ba for x in bots) and all(abs(x - ta) <= 0.0075 * ta for x in tops) and max(bots) < min(tops): return "RBOT"
    return None
def double(ex):
    """DTOP / DBOT: E1 a max (min); E_a the highest max (lowest min) among later extrema at least 22 days after E1; within 1.5% of each other."""
    if len(ex) < 3: return None
    for k in range(len(ex) - 2):
        i1, v1, s1 = ex[k]; later = [(i, v) for i, v, s in ex[k + 1:] if s == s1 and i - i1 > 22]
        if not later: continue
        ia, va = (max(later, key=lambda z: z[1]) if s1 == 1 else min(later, key=lambda z: z[1]))
        if near(v1, va, 0.015): return "DTOP" if s1 == 1 else "DBOT"
    return None
PATTERNS = ["HS", "IHS", "BTOP", "BBOT", "TTOP", "TBOT", "RTOP", "RBOT", "DTOP", "DBOT"]
syms = ["SPY", "QQQ", "IWM", "DIA"] + sorted(s[:-5] for s in os.listdir(os.path.join(SCRATCH, "bars")) if s.endswith(".json") and s[:-5] not in ("SPY", "QQQ", "IWM", "DIA", "VIX", "US10Y", "DXUSD", "ES", "PCC", "PCCE", "PCCI"))
hits = []; uncond = {}; bw = []
for sym in syms:
    c = bars(sym).c; c = c[c.index >= "2003-09-01"]; p = c.values; n = len(p)
    if n < 500: continue
    r1 = np.log(p[1:] / p[:-1]); r1 = np.concatenate([[np.nan], r1]); mu, sd = np.nanmean(r1), np.nanstd(r1); z = (r1 - mu) / sd
    f21 = fwd(p, 21); uncond[sym] = (z, f21)
    last_hit = {}
    for t in range(0, n - WIN - D_ - 1):
        w = p[t:t + WIN]; m, h = kernel_fit(w); bw.append(h)
        ex = [e for e in extrema(m) if e[0] <= L_ - 1]     # extrema must fall inside the first l days (LMW: pattern completes by t+l-1)
        if len(ex) < 3: continue
        pat = classify(ex) or double(ex)
        if not pat: continue
        end = t + L_ - 1                                   # completion day
        if last_hit.get(pat, -99) >= end - 20: continue    # the same five extrema seen again by the next sliding windows are the same event, not a new one
        last_hit[pat] = end
        j = end + D_                                       # LMW: return measured d = 3 days after completion
        if j + 1 >= n: continue
        hits.append({"sym": sym, "pattern": pat, "date": str(c.index[end].date()), "z1": float(z[j + 1]), "r1": float(r1[j + 1] * 100), "f21": float(f21[j]) if np.isfinite(f21[j]) else None, "bandwidth": h})
H = pd.DataFrame(hits); out["lmw"] = {"windows": f"{WIN} days sliding by 1 (l = {L_}, d = {D_}); bandwidth grid 2..10 days by CV, ×0.3; a pattern seen again within 20 days is the same event", "names": len(uncond), "hits": int(len(H)), "median_cv_bandwidth": float(np.median(bw)), "patterns": {}}
allz = np.concatenate([v[0][~np.isnan(v[0])] for v in uncond.values()]); allf = np.concatenate([v[1][~np.isnan(v[1])] for v in uncond.values()])
pv = []
for pat in PATTERNS:
    sub = H[H.pattern == pat]; z = sub.z1.dropna().values; f = sub.f21.dropna().values
    ks = stats.ks_2samp(z, allz) if len(z) >= 10 else None; ks21 = stats.ks_2samp(f, allf) if len(f) >= 10 else None
    per_year = len(sub) / max(1, len(uncond)) / ((pd.Timestamp(ASOF) - pd.Timestamp("2003-09-01")).days / 365.25)
    out["lmw"]["patterns"][pat] = {"n": int(len(sub)), "per_name_per_year": float(per_year), "mean_z1": float(z.mean()) if len(z) else None, "mean_r1_pct": float(sub.r1.mean()) if len(sub) else None, "ks_stat": float(ks.statistic) if ks else None, "ks_p": float(ks.pvalue) if ks else None,
        "f21_median": float(np.median(f)) if len(f) else None, "f21_share_up": float((f > 0).mean()) if len(f) else None, "f21_ks_p": float(ks21.pvalue) if ks21 else None, "base_f21_median": float(np.median(allf)), "base_f21_share_up": float((allf > 0).mean()), "spy_examples": sub[sub.sym == "SPY"].date.tail(5).tolist()}
    pv.append(ks.pvalue if ks else 1.0)
rej, adj = bh(pv, 0.05)
for k, pat in enumerate(PATTERNS): out["lmw"]["patterns"][pat]["ks_p_bonferroni"] = float(min(1, pv[k] * len(PATTERNS))); out["lmw"]["patterns"][pat]["ks_bh_pass_5pct"] = bool(rej[k])
out["lmw"]["what_lmw_found"] = "LMW (NYSE/AMEX & Nasdaq 1962-1996): several patterns (notably HS, IHS, DTOP, DBOT on Nasdaq stocks) gave conditional return distributions that differed from the unconditional at conventional levels; the differences were in shape (spread, skew), not obviously in mean, and they wrote that this does not by itself imply profitable trading."
# ---- (b) Harvey-Liu haircut Sharpe ratios
from scipy.stats import norm
def hl_haircut(sr_annual, years, M, others=None):
    """Harvey & Liu (2015) haircut. sr_annual: annualised Sharpe; years: sample length; M: number of tests tried.
       Bonferroni exactly; Holm and BHY on the actual set of p-values when `others` (the study's other p-values) is given."""
    if sr_annual is None or years <= 0: return None
    t = abs(sr_annual) * math.sqrt(years); p = 2 * (1 - norm.cdf(t)); res = {"t": t, "p": p, "M": M}
    def back(p_adj):
        p_adj = min(max(p_adj, 1e-12), 1 - 1e-12); sr_adj = norm.ppf(1 - p_adj / 2) / math.sqrt(years); return sr_adj, (1 - sr_adj / abs(sr_annual)) if sr_annual else None
    res["bonferroni"] = dict(zip(("p_adj", "sr_adj", "haircut"), (min(1, p * M),) + back(min(1, p * M))))
    if others is not None:
        ps = sorted(list(others) + [p]); k = ps.index(p); M = max(M, len(ps)); res["M"] = M
        holm = max(min(1, ps[i] * (M - i)) for i in range(k + 1)); res["holm"] = dict(zip(("p_adj", "sr_adj", "haircut"), (holm,) + back(holm)))
        c = sum(1 / i for i in range(1, M + 1)); bhy = min(1, min(ps[i] * M * c / (i + 1) for i in range(k, len(ps)))); res["bhy"] = dict(zip(("p_adj", "sr_adj", "haircut"), (bhy,) + back(bhy)))
    return res
def overlay_sharpe(price, signal_days, hold):
    """Annualised Sharpe of 'hold the instrument for `hold` sessions after each signal, else cash', daily returns, and the years spanned."""
    r = price.pct_change().values; on = np.zeros(len(price), bool)
    for i in signal_days: on[i + 1:i + 1 + hold] = True
    s = np.where(on, r, 0.0); s = s[1:]; years = len(s) / 252
    if s.std() == 0: return None, years, int(on.sum())
    return float(s.mean() / s.std() * math.sqrt(252)), years, int(on.sum())
spy = bars("SPY").c; rows = []
# 1 · RSI ladder: SPY RSI at or under its prior-only 10th percentile → hold 20 sessions. The ladder lane tried 100 rungs × 4 horizons on each instrument.
r = rsi_series(spy.values); p = pct_rank_prior(r); sig = episodes(p <= 10); sr, yrs, days = overlay_sharpe(spy, sig, 20)
rows.append({"rule": "RSI ladder · SPY RSI in its bottom 10% → hold 20 sessions", "source": "rsi-ladder (28 Sep)", "sr": sr, "years": yrs, "M": 400, "hl": hl_haircut(sr, yrs, 400), "signals": len(sig)})
# 2 · P5 trend rules: their own Sharpe on the S&P 500 index since 1928, M = rules × instruments tried
p5 = json.load(open(os.path.join(OUT, "../research-round-2/data/p5-trend.json"))); Mp5 = len(p5["rules"]) * len(p5["instruments"])
inst = p5["instruments"].get("S&P 500 index since 1928") or list(p5["instruments"].values())[0]; yrs5 = (pd.Timestamp(inst["to"]) - pd.Timestamp(inst["from"])).days / 365.25
others5 = [2 * (1 - norm.cdf(abs(x["sharpe"]) * math.sqrt(yrs5))) for x in inst["rules"].values()]
for name in ("10-month (Faber)", "200-day"):
    x = inst["rules"][name]; rows.append({"rule": f"P5 trend rule · {name} on the S&P 500 since 1928 (their Sharpe {x['sharpe']:.2f})", "source": "research-round-2 P5", "sr": x["sharpe"], "years": yrs5, "M": Mp5, "hl": hl_haircut(x["sharpe"], yrs5, Mp5, [o for o in others5 if o != 2 * (1 - norm.cdf(abs(x["sharpe"]) * math.sqrt(yrs5)))]), "signals": x.get("round_trips")})
# 3-6 · this lane's own cells
q3 = json.load(open(os.path.join(OUT, "data/q3-short.json"))); q3p = [c[f"f{h}"]["p"] for c in q3["rules"]["grid"] for h in (5, 21) if c[f"f{h}"]["p"] is not None]
pcc5 = bars("PCC").c.rolling(5).mean(); pp = pd.Series(pct_rank_prior(pcc5.values), index=pcc5.index).reindex(spy.index); sig = episodes((pp >= 80).fillna(False).values); sr, yrs, days = overlay_sharpe(spy, sig, 21)
rows.append({"rule": "Q3 · put/call five-day ≥ 80th → hold SPY 21 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": q3["rules"]["tests"], "hl": hl_haircut(sr, yrs, q3["rules"]["tests"], q3p), "signals": len(sig)})
vix = bars("VIX").c; ch = vix.pct_change() * 100; ud = pd.Series(usual_day(vix.values), index=vix.index); x = (ch / ud); calm = vix.shift(1) < 20; m = ((x >= 2) & calm).reindex(spy.index).fillna(False); sig = episodes(m.values); sr, yrs, days = overlay_sharpe(spy, sig, 5)
rows.append({"rule": "Q3 · VIX ≥ 2× usual day up from under 20 → hold SPY 5 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": q3["rules"]["tests"], "hl": hl_haircut(sr, yrs, q3["rules"]["tests"], q3p), "signals": len(sig)})
G = rung_series_fast(bars("SPY")); sma200 = spy.rolling(200).mean(); corner = (G.trend <= -0.5) & ((G.momentum - G.momentum.shift(5)) >= 0.25) & (G.momentum > G.trend) & (spy > sma200); sig = episodes(corner.fillna(False).values); sr, yrs, days = overlay_sharpe(spy, sig, 21)
q2 = json.load(open(os.path.join(OUT, "data/q2-geiger.json"))); q2p = [v[reg]["p"] for v in q2["corner"]["indexes"].values() for reg in v if v[reg].get("p") is not None] + [v.get("p_vs_base") for k, v in q2["corner"]["pooled"].items() if v.get("p_vs_base") is not None]
rows.append({"rule": "Q2 · opposite corner on SPY in a rising market → hold 21 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": len(q2p) + 2, "hl": hl_haircut(sr, yrs, len(q2p) + 2, q2p), "signals": len(sig)})
q4 = json.load(open(os.path.join(OUT, "data/q4-playbook.json"))); xlu = bars("XLU").c; r = rsi_series(xlu.values); p = pct_rank_prior(r); sig = episodes(p <= 5); sr, yrs, days = overlay_sharpe(xlu, sig, 63)
q4p = [g["h"][h]["p"] for v in q4["washouts"].values() for g in v["groups"].values() for h in ("21", "63") if g["h"][h]["p"] is not None]
rows.append({"rule": "Q4 · XLU RSI in its bottom 5% → hold XLU 63 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": len(q4p), "hl": hl_haircut(sr, yrs, len(q4p), q4p), "signals": len(sig)})
wmt = bars("WMT").c; hi = wmt.rolling(252).max(); dd = (wmt / hi - 1) * 100; knife = (dd <= -10) & (dd.shift(15) > -3); sig = episodes(knife.fillna(False).values); sr, yrs, days = overlay_sharpe(wmt, sig, 63)
q4k = [q4["staples"][s]["knife"]["h"][h]["p"] for s in q4["staples"] for h in ("21", "63", "126") if q4["staples"][s]["knife"]["h"][h]["p"] is not None]
rows.append({"rule": "Q4 · WMT fast 10% drop from its year high → hold WMT 63 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": len(q4k), "hl": hl_haircut(sr, yrs, len(q4k), q4k), "signals": len(sig)})
# 7 · LMW inverse head-and-shoulders on SPY → hold 21 (M = 10 patterns × 2 horizons)
ihs = H[(H.sym == "SPY") & (H.pattern == "IHS")]; idx = [spy.index.get_loc(pd.Timestamp(d)) + D_ for d in ihs.date]; sr, yrs, days = overlay_sharpe(spy, idx, 21)
rows.append({"rule": "Q6 · LMW inverse head-and-shoulders on SPY → hold 21 sessions", "source": "this lane", "sr": sr, "years": yrs, "M": 20, "hl": hl_haircut(sr, yrs, 20, [v["f21_ks_p"] for v in out["lmw"]["patterns"].values() if v["f21_ks_p"] is not None] + [v["ks_p"] for v in out["lmw"]["patterns"].values() if v["ks_p"] is not None]), "signals": len(idx)})
bh_sr, bh_y, _ = overlay_sharpe(spy, [0], len(spy)); rows.append({"rule": "buy and hold SPY (for scale; no test to haircut)", "source": "—", "sr": bh_sr, "years": bh_y, "M": 1, "hl": hl_haircut(bh_sr, bh_y, 1), "signals": 1})
out["harvey_liu"] = {"method": "t = SR·√years; p two-sided normal; Bonferroni p·M; Holm and BHY on the study's own p-values where we have them; haircut = 1 − SR_adjusted / SR (Harvey & Liu 2015, 'Backtesting', JPM 42(1)).", "rows": rows,
    "reading": "Harvey-Liu's own rule of thumb: with the number of tests the profession has run, a strategy needs a t-statistic near 3 (not 2) before it deserves belief; a Sharpe under ~1 on a short sample rarely survives any multiple-testing haircut."}
save_json("q6-public.json", out)
# ---- charts
f, axs = C.fig(14, 5.2, 1, 2); pats = PATTERNS; ns = [out["lmw"]["patterns"][p]["n"] for p in pats]; axs[0].bar(pats, ns, color=C.LINE2); axs[0].grid(axis="y"); axs[0].set_ylabel("patterns found")
C.title(axs[0], f"LMW on our data: {len(H)} pattern completions across {len(uncond)} names since 2003", f"38-day windows · CV bandwidth × 0.3 (median h {out['lmw']['median_cv_bandwidth']:.1f} days)")
med = [out["lmw"]["patterns"][p]["f21_median"] or 0 for p in pats]; axs[1].bar(pats, med, color=C.updown_color(med)); axs[1].axhline(out["lmw"]["patterns"]["HS"]["base_f21_median"], color=C.DIM, ls="--", lw=0.8); axs[1].grid(axis="y"); axs[1].set_ylabel("next 21 sessions, median %")
for i, p_ in enumerate(pats):
    if out["lmw"]["patterns"][p_]["ks_bh_pass_5pct"]: axs[1].text(i, max(med) * 1.05, "●", ha="center", color=C.UP)
C.title(axs[1], "What followed: next 21 sessions after each pattern (dashed = any day)", "● = the one-day return distribution differs from all days (KS, false-discovery 5%), which is LMW's test — not a profit claim")
C.save(f, os.path.join(OUT, "charts", "q6-1-lmw.png"))
# an example: the most recent SPY pattern, drawn
ex = H[H.sym == "SPY"].tail(1)
if len(ex):
    d = pd.Timestamp(ex.date.iloc[0]); i = spy.index.get_loc(d); w = spy.values[i - L_ + 1:i - L_ + 1 + WIN]; m, h = kernel_fit(w); f, ax = C.fig(14, 4.6)
    ax.plot(range(WIN), w, color=C.LINE2, lw=0.8, marker=".", label="SPY close"); ax.plot(range(WIN), m, color=C.LINE, lw=1.6, label="kernel smooth (h × 0.3)")
    for (k, v, s) in extrema(m): ax.plot([k], [v], "o", color=C.UP if s < 0 else C.DN, ms=7)
    ax.axvline(L_ - 1, color=C.DIM, ls="--", lw=0.8); ax.legend(); ax.grid(axis="y"); C.title(ax, f"How LMW sees a chart: SPY window ending {ex.date.iloc[0]}, classified {ex.pattern.iloc[0]}", "dots = local extrema of the smoothed curve (green lows, red highs) · dashed = pattern must complete here; the return is read 3 days later")
    C.save(f, os.path.join(OUT, "charts", "q6-2-lmw-example.png"))
f, ax = C.fig(14, 5.6); labs = [r["rule"][:52] for r in rows]; sr0 = [r["sr"] or 0 for r in rows]; srb = [r["hl"]["bonferroni"]["sr_adj"] if r["hl"] else 0 for r in rows]; srh = [r["hl"]["holm"]["sr_adj"] if r["hl"] and "holm" in r["hl"] else np.nan for r in rows]
y = np.arange(len(rows)); ax.barh(y + 0.25, sr0, 0.25, color=C.LINE2, label="Sharpe as measured"); ax.barh(y, srb, 0.25, color=C.DN, label="after Bonferroni haircut"); ax.barh(y - 0.25, [0 if v != v else v for v in srh], 0.25, color=C.UP, label="after Holm haircut (where the study's other p-values exist)")
ax.set_yticks(y); ax.set_yticklabels(labs, fontsize=8); ax.invert_yaxis(); ax.legend(loc="lower right"); ax.grid(axis="x"); ax.set_xlabel("annualised Sharpe ratio")
C.title(ax, "Harvey–Liu haircuts on the rules published today: what is left after counting the tests that were tried", "t = SR·√years · Bonferroni multiplies p by the number of tests M · Holm uses the study's own ordered p-values")
C.save(f, os.path.join(OUT, "charts", "q6-3-harvey-liu.png"))
for p_, v in out["lmw"]["patterns"].items(): print(p_, v["n"], round(v["per_name_per_year"], 2), "z1", None if v["mean_z1"] is None else round(v["mean_z1"], 3), "ks_p", None if v["ks_p"] is None else round(v["ks_p"], 4), "f21", v["f21_median"], v["f21_share_up"], "bh", v["ks_bh_pass_5pct"], v["spy_examples"][-2:])
for r in rows: print(f"{r['rule'][:60]:60s} SR {r['sr'] if r['sr'] is None else round(r['sr'],2)} yrs {r['years']:.0f} M {r['M']} sig {r['signals']} | t {r['hl']['t']:.2f} p {r['hl']['p']:.3f} bonf haircut {r['hl']['bonferroni']['haircut']}" + (f" holm {r['hl']['holm']['haircut']:.2f} bhy {r['hl']['bhy']['haircut']:.2f}" if 'holm' in r['hl'] else ""))
