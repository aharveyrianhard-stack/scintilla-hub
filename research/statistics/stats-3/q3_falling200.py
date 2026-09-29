"""Q3 · Below a falling 200-day with the 50 under it: what marks the one-in-ten that fell much further, and how leaders
behaved in that state. Episodes = entries into the state, single companies, 2004 →. Walk-forward: flags chosen on entries
before 2016, read on 2016 →."""
import os, sys, json, numpy as np, pandas as pd, lib, charts as C
from scipy.stats import mannwhitneyu
# --pit (R4, 29 Sep): the same study on the point-in-time universe — every S&P 500 member since 2003 on its member days,
# typed by its cap on the day, scored to its last close if it stopped trading (pit_source.py says the three rules).
# Without the switch this file runs exactly as before and writes stats-3/data/q3.json.
PIT = "--pit" in sys.argv
if PIT: sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "point-in-time")); import pit_source as PS
S = lib.SCRATCH; OUT = PS.OUT if PIT else os.path.abspath(os.path.join(os.path.dirname(__file__), "../../../deliverables/20260928/stats-3")); CH = os.path.join(OUT, "charts"); os.makedirs(os.path.join(OUT, "data"), exist_ok=True); os.makedirs(CH, exist_ok=True)
PFX = "pit-" if PIT else ""; DATA_FILE = "pit-q3.json" if PIT else "q3.json"
P = pd.read_csv(os.path.join(S, "panel.csv"), index_col=0, parse_dates=True); prof = lib.profiles(); pit = json.load(open(os.path.join(S, "pit_top20.json"))); leaderOf = PS.pit_top20() if PIT else {int(y): set(v) for y, v in pit.items()}
if PIT: leaderOf = {y: set(v) for y, v in leaderOf.items()}
res = {"universe": "point-in-time S&P 500 members (N9), member days only, cap on the day"} if PIT else {}; eps = []; yearRows = []; stateDays = []; stoppedN = 0
def sources():
    """(sym, bars, type_at(k), member mask, stopped) — the old loop, or the point-in-time one under --pit."""
    if PIT:
        for sym, d in PS.iter_names(400): yield sym, d, (lambda k, d=d: PS.tranche(d.cap_m.iloc[k])), d.member.values.astype(bool), PS.stopped(d)
    else:
        for sym in lib.universe():
            typ = lib.security_type(sym, prof)
            if "cap" not in typ: continue
            d = lib.load_bars(sym)
            if d is None or len(d) < 400: continue
            yield sym, d, (lambda k, typ=typ: typ), np.ones(len(d), bool), False
for sym, d, type_at, member, stop in sources():
    if stop: stoppedN += 1
    c = d.c; s50 = c.rolling(50).mean(); s200 = c.rolling(200).mean(); slope = 100 * (s200 / s200.shift(20) - 1)
    state = ((c < s200) & (slope < 0) & (s50 < s200)).where(s200.shift(20).notna()).fillna(False).astype(bool)
    below = (c < s200).astype(int); run = below.groupby((below != below.shift()).cumsum()).cumsum() * below
    rsi = lib.rsi(c.values); rsi_pct = lib.own_pct(rsi); mv = 100 * c.pct_change(); usual = mv.rolling(60).std()
    hi252 = c.rolling(252).max(); vol50 = d.v / d.v.rolling(50).mean()
    FR, FD = (PS.fwd_to_exit, PS.fwd_maxdd_to_exit) if stop else (lib.fwd_ret, lib.fwd_maxdd)   # a name that stopped trading is scored to its last close
    f252 = FR(c.values, 252); f126 = FR(c.values, 126); dd252 = FD(c.values, 252); dd126 = FD(c.values, 126)
    # reclaim of the 200-day within 252 sessions (survival)
    above = (c > s200).values; n = len(c)
    st = state.values; entries = np.where(st & ~np.r_[False, st[:-1]])[0]
    lastEntry = -10_000
    for k in entries:
        if k - lastEntry <= 21: continue     # a re-entry inside 21 sessions is the same episode
        lastEntry = k
        if not member[k]: continue           # (--pit) only a day the name was in the index
        if k + 252 >= n and not (stop and k < n - 1): continue   # (--pit) a name that stopped trading is scored to its last close
        # first reclaim after k
        rec = np.where(above[k + 1:k + 253])[0]; y = d.index[k].year; typ = type_at(k)
        eps.append({"sym": sym, "type": typ, "date": d.index[k], "year": y, "dist200": 100 * (c.iloc[k] / s200.iloc[k] - 1), "dd_from_high": 100 * (c.iloc[k] / hi252.iloc[k] - 1), "ret63": 100 * (c.iloc[k] / c.iloc[k - 63] - 1) if k >= 63 else np.nan,
            "ret252": 100 * (c.iloc[k] / c.iloc[k - 252] - 1) if k >= 252 else np.nan, "rsi_pct": rsi_pct[k], "days_below": int(run.iloc[k]), "usual": usual.iloc[k], "vol50": vol50.iloc[k], "slope200": slope.iloc[k], "dist50": 100 * (c.iloc[k] / s50.iloc[k] - 1),
            "spy_above200": P.spy_above200.get(d.index[k], np.nan), "spy_dd": P.spy_dd_from_high.get(d.index[k], np.nan), "vix_pct": P.vix_pct.get(d.index[k], np.nan), "a50": P.a50.get(d.index[k], np.nan), "leader": sym in leaderOf.get(y, set()),
            "dd252": dd252[k], "dd126": dd126[k], "f252": f252[k], "f126": f126[k], "reclaim": int(rec[0] + 1) if len(rec) else None, "reclaimed": bool(len(rec)), "sector": (prof.get(sym) or {}).get("sector")})
    # per calendar year: was the name in the state at the year's first session / any day in the prior year; its return that year; winner = top decile that year among the pool
    years = sorted(set(d.index.year))
    for y in years:
        yi = d.index.year == y
        if y < 2004 or y > 2025: continue
        if yi.sum() < 200 and not (PIT and stop and yi.sum() >= 20): continue   # (--pit) a name that stopped trading that year counts, to its last close
        first = np.where(yi)[0][0]; last = np.where(yi)[0][-1]; prev = (d.index.year == y - 1)
        if not member[first]: continue       # (--pit) in the index on the year's first session
        yearRows.append({"sym": sym, "year": y, "ret": 100 * (c.iloc[last] / c.iloc[first] - 1), "stateStart": bool(st[first]), "stateDaysPrev": int(st[prev].sum()) if prev.any() else np.nan, "stateDaysThis": int(st[yi].sum()), "leader": sym in leaderOf.get(y, set()),
            "prevRet": 100 * (c.iloc[first] / c.iloc[np.where(prev)[0][0]] - 1) if prev.sum() > 200 else np.nan})
E = pd.DataFrame(eps); Y = pd.DataFrame(yearRows); print("episodes", len(E), "names", E.sym.nunique(), "year rows", len(Y), "stopped trading", stoppedN)
if PIT: res["stoppedTrading"] = stoppedN
res["n"] = int(len(E)); res["names"] = int(E.sym.nunique()); res["from"] = E.date.min().strftime("%Y-%m-%d"); res["to"] = E.date.max().strftime("%Y-%m-%d")
# ---- 3a · the outcome distribution: worst fall within 126 / 252 sessions; the one-in-ten line
res["dd126"] = lib.dist(E.dd126, ps=(5, 10, 25, 50, 75, 90)); res["dd252"] = lib.dist(E.dd252, ps=(5, 10, 25, 50, 75, 90)); res["f252"] = lib.dist(E.f252); res["reclaim_km"] = lib.km_median(E.reclaim.fillna(253).values, E.reclaimed.values); res["reclaim_share_252"] = lib.r1(100 * E.reclaimed.mean())
p10 = float(np.nanpercentile(E.dd252, 10)); E["bad"] = E.dd252 <= p10; res["bad_line"] = lib.r1(p10); res["bad_n"] = int(E.bad.sum()); res["share_33"] = lib.r1(100 * (E.dd252 <= -33).mean()); res["share_33_126"] = lib.r1(100 * (E.dd126 <= -33).mean())
# any-day base for the same names: worst fall within 252 sessions from any day (from the pooled stock panel, approximated by SPY-era stock closes)
# ---- 3b · characteristics at entry: bad decile vs the rest; rank test (probability a bad entry has the higher value), episode bootstrap, FDR
FEATS = [("dist200", "distance below the 200-day at entry, %"), ("dd_from_high", "fall from the 252-day high, %"), ("ret63", "the 63 sessions before, %"), ("ret252", "the year before, %"), ("rsi_pct", "RSI own percentile"), ("days_below", "sessions already below the 200-day"),
    ("usual", "usual day (60-day spread of moves), %"), ("vol50", "volume vs its 50-day"), ("slope200", "200-day slope over 20 sessions, %"), ("dist50", "distance from the 50-day, %"), ("spy_dd", "SPY's fall from its high that day, %"), ("vix_pct", "VIX own percentile that day"), ("a50", "share of names above the 50-day that day, %")]
def auc(x, y):
    x = x[np.isfinite(x)]; y = y[np.isfinite(y)]
    if len(x) < 5 or len(y) < 5: return None
    u = mannwhitneyu(x, y, alternative="two-sided"); return float(u.statistic / (len(x) * len(y))), float(u.pvalue)
feat = []
for key, name in FEATS:
    a = auc(E[E.bad][key].values, E[~E.bad][key].values)
    if a is None: continue
    # bootstrap over episodes for the AUC range
    rng = lib.mulberry(13); bads = E[E.bad][key].dropna().values; rest = E[~E.bad][key].dropna().values; draws = []
    for _ in range(200):
        b = bads[rng.integers(len(bads), size=len(bads))]; r = rest[rng.integers(len(rest), size=min(len(rest), 3000))]; draws.append(mannwhitneyu(b, r).statistic / (len(b) * len(r)))
    feat.append({"key": key, "name": name, "bad_med": lib.r2(E[E.bad][key].median()), "rest_med": lib.r2(E[~E.bad][key].median()), "auc": lib.r3(a[0]), "auc_lo": lib.r3(np.quantile(draws, 0.05)), "auc_hi": lib.r3(np.quantile(draws, 0.95)), "p": a[1]})
rej, adj = lib.benjamini_hochberg([f["p"] for f in feat])
for i, f in enumerate(feat): f["adj"] = float(adj[i]); f["fdr"] = bool(rej[i]); f["word"] = lib.status_word(res["bad_n"], f["p"], adj[i])
res["features"] = feat
# categorical: type, leader, market state, sector
def catShare(col):
    out = []
    for v, g in E.groupby(col):
        if len(g) < 30: continue
        share = 100 * g.bad.mean(); b = lib.episode_bootstrap(g.bad.astype(float).values, stat=np.mean, reps=400, seed=17, base=E.bad.mean())
        out.append({"value": str(v), "n": int(len(g)), "bad_share": lib.r1(share), "lo": lib.r1(100 * b["lo"]), "hi": lib.r1(100 * b["hi"]), "p": b["p"], "dd252_med": lib.r1(g.dd252.median()), "f252_med": lib.r1(g.f252.median()), "share_33": lib.r1(100 * (g.dd252 <= -33).mean())})
    rej, adj = lib.benjamini_hochberg([o["p"] for o in out])
    for i, o in enumerate(out): o["adj"] = float(adj[i]); o["fdr"] = bool(rej[i])
    return out
E["market"] = np.where(E.spy_above200 == 1, "SPY above its 200-day", "SPY below its 200-day"); res["byType"] = catShare("type"); res["byMarket"] = catShare("market"); res["byLeader"] = catShare("leader"); res["bySector"] = catShare("sector"); res["byYear"] = catShare("year")
# ---- 3c · walk-forward red flags: on entries before 2016, the flags = features whose AUC clears 0.5 by their range; each flag = the feature in its worse third (pooled thirds). Read the count of flags on 2016 →
H1 = E[E.date < "2016"]; H2 = E[E.date >= "2016"]
flags = []
for f in feat:
    key = f["key"]; a = auc(H1[H1.bad][key].values, H1[~H1.bad][key].values)
    if a is None: continue
    direction = 1 if a[0] > 0.5 else -1        # bad entries have the HIGHER value when auc > .5
    cut = H1[key].quantile(2 / 3) if direction > 0 else H1[key].quantile(1 / 3)
    if abs(a[0] - 0.5) >= 0.06 and a[1] < 0.05: flags.append({"key": key, "name": f["name"], "dir": "high" if direction > 0 else "low", "cut": lib.r2(cut), "auc_h1": lib.r3(a[0])})
res["flags"] = flags
def flagCount(df): return sum(((df[fl["key"]] >= fl["cut"]) if fl["dir"] == "high" else (df[fl["key"]] <= fl["cut"])).astype(int) for fl in flags) if flags else pd.Series(0, index=df.index)
wf = []
for name, df in (("first half (where the flags were chosen)", H1), ("second half, 2016 → (the honest read)", H2)):
    fc = flagCount(df); rows = []
    for k in range(0, len(flags) + 1):
        g = df[fc == k]
        if len(g) < 10: continue
        b = lib.episode_bootstrap(g.dd252.astype(float).values, stat=np.median, reps=300, seed=19 + k, base=float(df.dd252.median()))
        rows.append({"flags": k, "n": int(len(g)), "bad_share": lib.r1(100 * (g.dd252 <= p10).mean()), "share_33": lib.r1(100 * (g.dd252 <= -33).mean()), "dd252_med": lib.r1(b["est"]), "lo": lib.r1(b["lo"]), "hi": lib.r1(b["hi"]), "p": b["p"], "f252_med": lib.r1(g.f252.median()), "reclaimed": lib.r1(100 * g.reclaimed.mean())})
    wf.append({"half": name, "n": int(len(df)), "base_dd252": lib.r1(df.dd252.median()), "base_bad": lib.r1(100 * (df.dd252 <= p10).mean()), "rows": rows})
res["walkForward"] = wf
# ---- 3d · leaders and the state: share of leader-years with the state at the year's start / in the prior year; winners (top decile that year) vs the state
Y["winner"] = Y.groupby("year").ret.transform(lambda s: s >= s.quantile(0.9)).fillna(False).astype(bool); Y["prevWinner"] = Y.groupby("year").prevRet.transform(lambda s: (s >= s.quantile(0.9)) & s.notna()).fillna(False).astype(bool); Y["leader"] = Y.leader.astype(bool)
def yearBoot(df, num, den, seed):
    ys = sorted(df.year.unique()); rng = lib.mulberry(seed); per = {y: df[df.year == y] for y in ys}; draws = []
    est = 100 * (df[num].astype(bool) & df[den].astype(bool)).sum() / max(1, df[den].astype(bool).sum())
    for _ in range(500):
        sample = pd.concat([per[ys[i]] for i in rng.integers(len(ys), size=len(ys))]); s = sample[den].astype(bool).sum(); draws.append(100 * (sample[num].astype(bool) & sample[den].astype(bool)).sum() / s if s else np.nan)
    return {"est": lib.r1(est), "lo": lib.r1(np.nanquantile(draws, 0.05)), "hi": lib.r1(np.nanquantile(draws, 0.95)), "n": int(df[den].sum()), "years": len(ys)}
Y["all"] = True; Y["stateStart"] = Y.stateStart.astype(bool); Y["stateAnyPrev"] = (Y.stateDaysPrev.fillna(0) > 0).astype(bool); Y["notState"] = ~Y.stateStart
res["leadersState"] = {"years": int(Y.year.nunique()), "rows": int(len(Y)),
    "winner_given_state": yearBoot(Y, "winner", "stateStart", 23), "winner_base": yearBoot(Y, "winner", "all", 24), "winner_given_notState": yearBoot(Y, "winner", "notState", 25),
    "state_given_winner": yearBoot(Y, "stateStart", "winner", 26), "state_base": yearBoot(Y, "stateStart", "all", 27),
    "leader_given_state": yearBoot(Y, "leader", "stateStart", 28), "leader_base": yearBoot(Y, "leader", "all", 29),
    "winner_given_prevWinner": yearBoot(Y, "winner", "prevWinner", 30), "winner_given_prevWinner_notState": yearBoot(Y.assign(pw=Y.prevWinner & ~Y.stateStart), "winner", "pw", 31),
    "stateAnyPrev_given_winner": yearBoot(Y, "stateAnyPrev", "winner", 32), "stateAnyPrev_base": yearBoot(Y, "stateAnyPrev", "all", 33)}
# median calendar-year return by group, year-bootstrapped
def yearMed(df, mask, seed):
    mask = pd.Series(mask, index=df.index).fillna(False).astype(bool); ys = sorted(df.year.unique()); per = {y: df[(df.year == y) & mask].ret.values for y in ys}; rng = lib.mulberry(seed); est = float(np.nanmedian(df[mask].ret)); draws = []
    for _ in range(400):
        draws.append(np.nanmedian(np.concatenate([per[ys[i]] for i in rng.integers(len(ys), size=len(ys))])))
    return {"est": lib.r1(est), "lo": lib.r1(np.nanquantile(draws, 0.05)), "hi": lib.r1(np.nanquantile(draws, 0.95)), "n": int(mask.sum())}
res["yearReturns"] = {"in state at start": yearMed(Y, Y.stateStart, 41), "not in state": yearMed(Y, ~Y.stateStart, 42), "prior-year winner": yearMed(Y, Y.prevWinner, 43), "prior-year winner, not in state": yearMed(Y, Y.prevWinner & ~Y.stateStart, 44), "leader (top 20 by cap)": yearMed(Y, Y.leader, 45), "all": yearMed(Y, Y.all, 46)}
res["today"] = {"in_state_now": int(sum(1 for e in [] )) }
# names in the state today
now = []
for sym in lib.universe():
    typ = lib.security_type(sym, prof)
    if "cap" not in typ: continue
    d = lib.load_bars(sym)
    if d is None or len(d) < 260: continue
    c = d.c; s50 = c.rolling(50).mean(); s200 = c.rolling(200).mean(); slope = 100 * (s200 / s200.shift(20) - 1)
    if c.iloc[-1] < s200.iloc[-1] and slope.iloc[-1] < 0 and s50.iloc[-1] < s200.iloc[-1]:
        fl = 0
        row = {"dist200": 100 * (c.iloc[-1] / s200.iloc[-1] - 1), "dd_from_high": 100 * (c.iloc[-1] / c.rolling(252).max().iloc[-1] - 1), "ret63": 100 * (c.iloc[-1] / c.iloc[-64] - 1), "ret252": 100 * (c.iloc[-1] / c.iloc[-253] - 1), "rsi_pct": lib.own_pct(lib.rsi(c.values))[-1], "days_below": int(((c < s200).astype(int)[::-1].cumprod()).sum()), "usual": (100 * c.pct_change()).rolling(60).std().iloc[-1], "vol50": (d.v / d.v.rolling(50).mean()).iloc[-1], "slope200": slope.iloc[-1], "dist50": 100 * (c.iloc[-1] / s50.iloc[-1] - 1), "spy_dd": P.spy_dd_from_high.iloc[-1], "vix_pct": P.vix_pct.iloc[-1], "a50": P.a50.iloc[-1]}
        for f in flags: fl += int((row[f["key"]] >= f["cut"]) if f["dir"] == "high" else (row[f["key"]] <= f["cut"]))
        now.append({"sym": sym, "type": typ, "dist200": lib.r1(row["dist200"]), "dd_from_high": lib.r1(row["dd_from_high"]), "days_below": row["days_below"], "flags": fl})
res["today"] = {"in_state_now": len(now), "names": sorted(now, key=lambda r: -r["flags"])}
json.dump(lib.clean(res), open(os.path.join(OUT, "data", DATA_FILE), "w"))
# ---- charts
f, ax = C.fig(14, 5); v = E.dd252.dropna().values; ax.hist(v, bins=np.arange(-100, 1, 2.5), color=C.LINE2, edgecolor=C.BG); ax.axvline(p10, color=C.DN, lw=1.2); ax.text(p10, ax.get_ylim()[1] * 0.9, f" one in ten: {p10:.0f}%", color=C.DN, fontsize=10); ax.axvline(np.median(v), color=C.ACCENT, lw=1); ax.text(np.median(v), ax.get_ylim()[1] * 0.8, f" median {np.median(v):.0f}%", color=C.ACCENT, fontsize=10)
ax.set_xlabel("worst close within the next 252 sessions, % from the entry close"); ax.set_ylabel("entries"); ax.grid(axis="y"); C.title(ax, "Entering 'below a falling 200-day with the 50 under it': how far it fell afterwards", f"{len(E)} entries, {E.sym.nunique()} single companies, {res['from'][:4]}–{res['to'][:4]} · a re-entry within 21 sessions is the same episode")
C.save(f, os.path.join(CH, PFX + "q3-outcome-hist.png"))
f, ax = C.fig(14, 5.4); fs = sorted(feat, key=lambda x: -abs(x["auc"] - 0.5)); x = np.arange(len(fs))
for i, ft in enumerate(fs): ax.plot([x[i], x[i]], [ft["auc_lo"], ft["auc_hi"]], color=C.LINE2, lw=2); ax.plot([x[i]], [ft["auc"]], "o", color=C.DN if ft["fdr"] else C.LINE, ms=7)
ax.axhline(0.5, color=C.DIM, ls="--", lw=0.8); ax.set_xticks(x); ax.set_xticklabels([ft["name"] for ft in fs], rotation=30, ha="right", fontsize=8); ax.set_ylabel("chance a bad entry has the higher value"); ax.grid(axis="y")
C.title(ax, "What marks the one-in-ten at entry", "0.5 = no difference · red = survives the false-discovery check · bar = 90% episode-bootstrap range")
C.save(f, os.path.join(CH, PFX + "q3-features.png"))
f, axs = C.fig(14, 5, 1, 2)
for k, w in enumerate(wf):
    rows = w["rows"]; x = [r["flags"] for r in rows]; axs[k].bar(x, [r["share_33"] for r in rows], color=[C.DN if r["share_33"] > (w["base_bad"] if False else 10) else C.LINE2 for r in rows], width=0.6)
    for r in rows: axs[k].text(r["flags"], r["share_33"], f"n{r['n']}", ha="center", va="bottom", fontsize=8, color=C.DIM)
    axs[k].set_xlabel("red flags at entry (count)"); axs[k].set_ylabel("share that fell 33%+ within a year, %"); axs[k].grid(axis="y"); C.title(axs[k], w["half"], f"{w['n']} entries · flags: {', '.join(fl['key'] for fl in flags)}")
C.save(f, os.path.join(CH, PFX + "q3-flags-walkforward.png"))
f, ax = C.fig(14, 4.8); L = res["leadersState"]; items = [("winner that year | in the state at year start", L["winner_given_state"]), ("winner | not in the state", L["winner_given_notState"]), ("winner | any name", L["winner_base"]), ("winner | prior-year winner", L["winner_given_prevWinner"]), ("winner | prior-year winner and not in the state", L["winner_given_prevWinner_notState"]), ("top-20-by-cap leader | in the state", L["leader_given_state"]), ("top-20-by-cap leader | any name", L["leader_base"])]
C.range_bars(ax, [i[0] for i in items], [i[1]["est"] for i in items], [i[1]["lo"] for i in items], [i[1]["hi"] for i in items], base=L["winner_base"]["est"], ylabel="share, %"); ax.tick_params(axis="x", labelsize=7.5, rotation=12)
C.title(ax, "Does being in the state disqualify a name from leading that year?", "winner = top decile of calendar-year return among the served single companies · bar = 90% range over resampled years")
C.save(f, os.path.join(CH, PFX + "q3-leaders.png"))
print("DONE q3"); print(json.dumps(lib.clean({"n": res["n"], "bad_line": res["bad_line"], "share_33": res["share_33"], "flags": flags, "wf": wf, "L": res["leadersState"], "yr": res["yearReturns"], "now": res["today"]["in_state_now"]}), indent=0)[:3500])
