# GH1 · from the cached replay: the stored JSON series, each name's own-history percentiles (1 / 3 / 5 years, all), and the answers.
import json, os, sys, pickle, numpy as np, datetime as dtm
from syms import ALL, COHORTS
import gh1_replay as G
RES = pickle.load(open("replay.pkl", "rb"))
LIVE = json.load(open("geiger-live.json")); VAL = json.load(open("validate-live.json"))
WIN = {"1y": 251, "3y": 755, "5y": 1259}
r3 = lambda x: None if x is None or not np.isfinite(x) else round(float(x), 3)
r1 = lambda x: None if x is None or not np.isfinite(x) else round(float(x), 1)
r2 = lambda x: None if x is None or not np.isfinite(x) else round(float(x), 2)

def main_idx(o):
    """Sessions that carry a full seven-rung reading."""
    return np.where((o["nr"] == 7) & np.isfinite(o["g"]))[0]

def pct_at(vals, x):
    return float((vals < x).mean() * 100)

def stats(s):
    o = RES[s]; ix = main_idx(o)
    if len(ix) < 20: return None
    g = o["g"][ix]; d = [o["date"][i] for i in ix]; last = float(g[-1]); out = {"last_date": d[-1], "g": r3(last), "trend": r3(o["trend"][ix[-1]]), "mom": r3(o["mom"][ix[-1]]),
        "first": d[0], "sessions": int(len(ix)), "full_from": next((o["date"][i] for i in ix if o["full"][i]), None),
        "rsi": r1(o["rsi"][ix[-1]]), "p200": r1(o["p200"][ix[-1]]), "close": r2(o["c"][ix[-1]])}
    for k, n in WIN.items():
        w = g[-n:]
        out[k] = {"pct": r1(pct_at(w, last)), "n": int(len(w)), "complete": bool(len(g) >= n), "lo": r3(w.min()), "hi": r3(w.max()), "med": r3(np.median(w)), "p10": r3(np.percentile(w, 10)), "p90": r3(np.percentile(w, 90)),
                  "lo_date": d[len(g) - len(w) + int(np.argmin(w))], "hi_date": d[len(g) - len(w) + int(np.argmax(w))]}
    out["all"] = {"pct": r1(pct_at(g, last)), "n": int(len(g)), "lo": r3(g.min()), "hi": r3(g.max()), "med": r3(np.median(g)), "lo_date": d[int(np.argmin(g))], "hi_date": d[int(np.argmax(g))], "years": r1(len(g) / 252)}
    return out

STATS = {s: stats(s) for s in ALL if s in RES}
STATS = {k: v for k, v in STATS.items() if v}
AS_OF = STATS["SPY"]["last_date"]

# ---------- the stored series: one shared calendar (SPY's sessions), Geiger × 1000 as integers, null where no seven-rung reading
cal = RES["SPY"]["date"]; cix = {d: i for i, d in enumerate(cal)}
SER = {"what": "Daily Geiger per name, replayed with the Hub publisher's own maths and bar rules (seven rungs, today's Equalizer weights), one reading per session as the Hub would have shown it that evening.",
       "built_utc": dtm.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"), "as_of_session": AS_OF, "scale": "value = Geiger x 1000 (so -143 means -0.143); null = no seven-rung reading that session",
       "weights": G.W, "calendar": cal, "names": {}}
for s in ALL:
    if s not in RES or s not in STATS: continue
    o = RES[s]; ix = main_idx(o); i0 = cix.get(o["date"][ix[0]])
    if i0 is None: continue
    arr = [None] * (len(cal) - i0)
    for i in ix:
        j = cix.get(o["date"][i])
        if j is not None: arr[j - i0] = int(round(float(o["g"][i]) * 1000))
    SER["names"][s] = {"start": i0, "first": cal[i0], "g": arr}
json.dump(SER, open("geiger-series.json", "w"), separators=(",", ":"))

# ---------- helpers for the answers
def row_at(s, i, win=("1y", "3y", "5y")):
    o = RES[s]; ix = main_idx(o); out = {"date": o["date"][i], "g": r3(o["g"][i]), "rungs": int(o["nr"][i]), "trend": r3(o["trend"][i]), "mom": r3(o["mom"][i]), "rsi": r1(o["rsi"][i]), "p200": r1(o["p200"][i]), "close": r2(o["c"][i])}
    if o["nr"][i] == 7:
        pos = np.searchsorted(ix, i, side="right"); g = o["g"][ix[:pos]]
        for k in win:
            w = g[-WIN[k]:]; out["pct_" + k] = r1(pct_at(w, o["g"][i])); out["n_" + k] = int(len(w))
        out["pct_all"] = r1(pct_at(g, o["g"][i])); out["n_all"] = int(len(g))
    return out

def runs_below(s, i0, x):
    """Stretches of sessions since index i0 (exclusive of the newest session) with a Geiger below x."""
    o = RES[s]; ix = main_idx(o); ix = ix[(ix >= i0) & (ix < ix[-1])]; g = o["g"]; out = []; cur = None
    for i in ix:
        if g[i] < x:
            if cur is None: cur = [i, i, i]
            cur[1] = i
            if g[i] < g[cur[2]]: cur[2] = i
        elif cur is not None: out.append(cur); cur = None
    if cur is not None: out.append(cur)
    return [{"from": o["date"][a], "to": o["date"][b], "sessions": int(np.sum((ix >= a) & (ix <= b))), "low": row_at(s, c)} for a, b, c in out], int(np.sum(g[ix] < x)), int(len(ix))

def parabolic(s, today_x=None):
    o = RES[s]; p = o["p200"]; n = len(p); last = n - 1
    below = np.where(np.isfinite(p) & (p < 0))[0]
    base = int(below[-1]) if len(below) else int(np.where(np.isfinite(p))[0][0]) - 1     # last close under the 200-day (or just before the 200-day first exists)
    cand = np.where(np.isfinite(p) & (p >= 50) & (np.arange(n) > base))[0]
    out = {"ticker": s, "last_below_200d": o["date"][base] if len(below) else None, "sma200_first": o["date"][int(np.where(np.isfinite(p))[0][0])]}
    if not len(cand): out["start"] = None; return out
    st = int(cand[0]); x = float(o["g"][last]) if today_x is None else today_x
    runs, nb, ntot = runs_below(s, st, x)
    ix = main_idx(o); ixr = ix[ix >= st]; lo = int(ixr[np.argmin(o["g"][ixr])]); hi = int(ixr[np.argmax(o["g"][ixr])])
    out.update({"start": o["date"][st], "start_row": row_at(s, st), "sessions_since": ntot + 1, "today": row_at(s, last), "below_today": nb, "below_share": r1(nb / max(ntot, 1) * 100), "runs": runs,
                "lowest": row_at(s, lo), "highest": row_at(s, hi), "max_p200": r1(float(np.nanmax(p[st:]))), "max_p200_date": o["date"][st + int(np.nanargmax(p[st:]))],
                "pct_since_start": r1(pct_at(o["g"][ixr], x)), "earlier_starts": [o["date"][int(c)] for c in first_crosses(p)]})
    return out

def first_crosses(p):
    """Every time a name first closed 50% above its 200-day after having been under it (the start of each past run)."""
    out = []; armed = True
    for i, v in enumerate(p):
        if not np.isfinite(v): continue
        if v < 0: armed = True
        elif v >= 50 and armed: out.append(i); armed = False
    return out

def week(s, d0, d1):
    o = RES[s]; ii = [i for i, d in enumerate(o["date"]) if d0 <= d <= d1]
    rows = [row_at(s, i) for i in ii]
    if not rows: return None
    lo = min(rows, key=lambda r: r["g"]); pl = min(ii, key=lambda i: o["l"][i])
    return {"days": rows, "low": lo, "price_low": r2(float(o["l"][pl])), "price_low_date": o["date"][pl], "close_low": r2(min(float(o["c"][i]) for i in ii))}

OUT = {"as_of_session": AS_OF, "built_utc": SER["built_utc"], "live_computed_utc": LIVE.get("computed_utc"), "stats": STATS, "cohorts": COHORTS}
# validation against the live Geiger (same evening)
ok = [r for r in VAL["rows"] if r.get("live") is not None and "g" in r]
gap = np.array([abs(r["g"] - r["live"]) for r in ok]); gf = np.array([abs(r["g_forming"] - r["live"]) for r in ok])
OUT["validation"] = {"names": len(ok), "exact_1e5": int((gap < 1e-5).sum()), "median": float(np.median(gap)), "p90": float(np.percentile(gap, 90)), "max": float(gap.max()),
                     "worst": [{"s": r["s"], "replay": r3(r["g"]), "live": r3(r["live"])} for r in sorted(ok, key=lambda r: -abs(r["g"] - r["live"]))[:8]],
                     "earlier_variant": {"exact_1e5": int((gf < 1e-5).sum()), "median": r3(np.median(gf)), "p90": r3(np.percentile(gf, 90)), "max": r3(gf.max())}}
# ---------- item 2
AFTERNOON = {"MU": 0.3728, "SNDK": -0.0908, "WDC": -0.4763, "NVDA": 0.894}     # the Hub's live readings NQ1 took at 15:23 ET on 6 Oct, the ones Alan quoted
OUT["parabolic"] = {s: parabolic(s) for s in ["MU", "SNDK", "WDC"]}
for s in ["MU", "SNDK", "WDC"]:
    p = OUT["parabolic"][s]
    if p.get("start"):
        o = RES[s]; st = o["date"].index(p["start"]); runs, nb, ntot = runs_below(s, st, AFTERNOON[s])
        p["afternoon"] = {"g": AFTERNOON[s], "below": nb, "of": ntot, "runs": len(runs)}
WK = {"mar30": ("2026-03-30", "2026-04-03"), "sep14": ("2026-09-14", "2026-09-18")}
OUT["weeks"] = {s: {k: week(s, *v) for k, v in WK.items()} for s in ["AVGO", "NVDA", "MU", "GOOGL", "AMZN"]}
o = RES["NVTS"]; n = len(o["g"]); OUT["nvts"] = {"last90": [row_at("NVTS", i) for i in range(n - 90, n)], "stats": STATS["NVTS"]}
OUT["nvda"] = {"stats": STATS["NVDA"], "afternoon": AFTERNOON["NVDA"]}
# ---------- item 3: the seven dates
DATES = ["2026-03-26", "2025-04-04", "2023-10-30", "2022-10-17", "2020-03-17", "2018-12-21", "2009-03-02"]
NAMES = ["SPY", "QQQ", "MU", "NVDA", "AVGO", "GOOGL", "AMZN", "TSM", "AMD", "MSFT", "AAPL"]
B = {}
for s in NAMES:
    B[s] = {}
    for D in DATES:
        src = s
        if D not in RES[s]["date"] and s == "GOOGL" and D in RES["GOOG"]["date"]: src = "GOOG"   # Alphabet before April 2014 traded as GOOG
        o = RES[src]
        if D not in o["date"]: B[s][D] = None; continue
        i = o["date"].index(D); r = row_at(src, i); r["src"] = src
        ix = main_idx(o); near = ix[(ix >= i - 5) & (ix <= i + 5)]
        if len(near):
            m = int(near[np.argmin(o["g"][near])]); r["low_pm5"] = {"date": o["date"][m], "g": r3(o["g"][m])}
        B[s][D] = r
OUT["bottoms"] = {"dates": DATES, "names": NAMES, "rows": B}
json.dump(OUT, open("gh1-core.json", "w"), indent=1)
print("as of", AS_OF, "| series file %.1f MB, %d names" % (os.path.getsize("geiger-series.json") / 1e6, len(SER["names"])))
for s in ["NVDA", "MU", "SNDK", "WDC", "AVGO", "GOOGL", "AMZN", "NVTS", "SPY", "QQQ", "TSM", "AMD", "MSFT"]:
    v = STATS[s]; print(f"{s:5s} g {v['g']:+.3f} | 1y {v['1y']['pct']:5.1f} (n{v['1y']['n']}, {v['1y']['lo']:+.2f}..{v['1y']['hi']:+.2f}) | 3y {v['3y']['pct']:5.1f} | 5y {v['5y']['pct']:5.1f} | all {v['all']['pct']:5.1f} ({v['all']['years']}y, low {v['all']['lo']:+.2f} {v['all']['lo_date']}) | rsi {v['rsi']} p200 {v['p200']}")
for s in ["MU", "SNDK", "WDC"]:
    p = OUT["parabolic"][s]; print("\n==", s, {k: p.get(k) for k in ("last_below_200d", "sma200_first", "start", "sessions_since", "below_today", "below_share", "max_p200", "max_p200_date", "pct_since_start", "earlier_starts")})
    if p.get("start"):
        print("   start row", p["start_row"]); print("   today", p["today"]); print("   lowest", p["lowest"]); print("   afternoon", p["afternoon"])
        for r in p["runs"]: print("   below-today run", r["from"], "->", r["to"], r["sessions"], "sessions, low", r["low"]["g"], r["low"]["date"], "rsi", r["low"]["rsi"], "p200", r["low"]["p200"])
