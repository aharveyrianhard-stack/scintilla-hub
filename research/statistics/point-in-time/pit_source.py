"""R4 · point-in-time sources for the stats-3 studies. Imported only when a study runs with --pit; without the switch
the studies read exactly what they read before (today's served names). Read-only: the research cache on this Mac,
no network, no key, no database.

What "point-in-time" means here, and the three rules every --pit run shares:
  1. the names are every company that was an S&P 500 member since 2 Jan 2003 (N9's universe), and a name is counted
     on a day only if it was a member THAT day;
  2. a name-day is typed by the full market cap the company had ON THAT DAY (N9's month-end cap carried by price),
     not by today's cap;
  3. a name that stopped trading (delisted, bought, bankrupt) is scored to its LAST close where a forward window runs
     past its end — instead of being dropped, which only a survivor list can afford.
"""
import os, json, numpy as np, pandas as pd

PIT = os.path.expanduser("~/Library/Application Support/scintilla/stats-cache/point-in-time/v1")
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.abspath(os.path.join(HERE, "../../../deliverables/20260928/point-in-time"))
LIVE_AFTER = pd.Timestamp("2026-09-01")     # a series whose last bar is before this stopped trading (bars run to 2026-09-25)

def tranche(cap_m):
    """stats-3's tranche lines (nominal $bn), read on the cap of the day; None → 'stock (no cap)'."""
    if cap_m is None or not np.isfinite(cap_m): return "stock (no cap)"
    return "mega cap (>200bn)" if cap_m > 200e3 else "large cap (10–200bn)" if cap_m > 10e3 else "mid cap (2–10bn)" if cap_m > 2e3 else "small cap (<2bn)"

def names():
    return sorted(f[:-5] for f in os.listdir(os.path.join(PIT, "daily")) if f.endswith(".json"))

def load_daily(sym):
    """One member: repaired daily close, volume, cap ($m) and member flag, indexed by date. None when the file is empty."""
    p = os.path.join(PIT, "daily", sym + ".json")
    if not os.path.exists(p): return None
    j = json.load(open(p))
    if not j["rows"]: return None
    d = pd.DataFrame(j["rows"], columns=j["cols"]); d.index = pd.to_datetime(d.date); d = d.drop(columns="date")
    d["c"] = d.c.astype(float); d["cap_m"] = d.cap_m.astype(float); d["member"] = d.member.astype(int)
    if "v" in d: d["v"] = d.v.astype(float)
    d = d[d.c > 0]
    return d

def iter_names(min_len=400):
    for sym in names():
        d = load_daily(sym)
        if d is None or len(d) < min_len or not d.member.any(): continue
        yield sym, d

def stopped(d):
    """True when the series ends before the live window: the company stopped trading."""
    return d.index[-1] < LIVE_AFTER

def fwd_to_exit(c, h):
    """Forward h-session return, %; where the series ends inside the window, the return to its last close."""
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    if n < 2: return out
    j = np.minimum(np.arange(n) + h, n - 1); out[:-1] = 100 * (c[j[:-1]] / c[:-1] - 1)
    return out

def fwd_maxdd_to_exit(c, h):
    """Deepest close below today's within the next h sessions or until the series ends, % (<= 0)."""
    c = np.asarray(c, float); n = len(c); out = np.full(n, np.nan)
    if n < 2: return out
    s = pd.Series(c); fut_min = s[::-1].rolling(h, min_periods=1).min()[::-1].shift(-1).values
    out[:-1] = 100 * (fut_min[:-1] / c[:-1] - 1)
    return out

def pit_top20():
    """Each year's 20 largest S&P members by full cap on the prior year's last session (N9's basket), {year: [sym]}."""
    j = json.load(open(os.path.join(PIT, "pit-leaders-basket.json")))
    return {int(y): v for y, v in j["top"].items()}

def basket_closes():
    """Repaired closes of every name that was ever in the point-in-time leaders basket, {sym: Series}."""
    j = json.load(open(os.path.join(PIT, "pit-leaders-basket.json"))); out = {}
    for s, rows in j["closes"].items():
        ser = pd.Series([r[4] for r in rows], index=pd.to_datetime([r[0] for r in rows]), dtype=float); out[s] = ser[~ser.index.duplicated()]
    return out

def closes_and_members(idx):
    """Wide frames on the SPY calendar: repaired closes of every member (NaN outside its bars) and the member flag."""
    C, M = {}, {}
    for sym, d in iter_names(2):
        C[sym] = d.c.reindex(idx); M[sym] = d.member.reindex(idx).fillna(0).astype(int)
    return pd.DataFrame(C), pd.DataFrame(M)

# ---------------------------------------------------------------- the Hub's USUAL DAY test, replayed on the point-in-time bars
USUAL_SESSIONS, MIN_SESSIONS = 60, 20
def sigma_events(sym, d, rule):
    """The Hub's own test (supabase/functions/heartbeat-daily/sigma.mjs, data/scintilla-rules.json), day by day:
    move = close / previous close − 1 (%); usual day = the n−1 spread of the 60 moves BEFORE the day (at least 20);
    a day fires when |move / usual| ≥ x_usual and |move| ≥ needs_move (STATISTICAL) or |move| ≥ raw (RAW).
    Returns (events DataFrame, measured dates Index) over the name's MEMBER days only."""
    mv = 100 * d.c.pct_change()
    usual = mv.rolling(USUAL_SESSIONS, min_periods=MIN_SESSIONS).std(ddof=1).shift(1)
    ok = (usual > 0) & mv.notna() & (d.member == 1)
    x = mv / usual
    stat = (x.abs() >= rule["x_usual"]) & (mv.abs() >= rule["x_usual_needs_move_pct"]); raw = mv.abs() >= rule["raw_move_pct"]
    hit = ok & (stat | raw)
    ev = pd.DataFrame({"ticker": sym, "date": d.index[hit], "move_pct": mv[hit].values, "usual_day_60": usual[hit].values, "x_usual": x[hit].values,
        "direction": np.sign(mv[hit].values).astype(int), "cap_m": d.cap_m[hit].values})
    return ev, d.index[ok]

def sigma_all(rule):
    """Every member's events and the day counts (names_measured, n, up, dn) — the shape of public.sigma_day_counts."""
    evs, meas = [], {}
    for sym, d in iter_names(MIN_SESSIONS + 5):
        ev, m = sigma_events(sym, d, rule); evs.append(ev)
        for dt in m: meas[dt] = meas.get(dt, 0) + 1
    E = pd.concat(evs, ignore_index=True)
    cnt = E.groupby("date").agg(n=("direction", "size"), up=("direction", lambda s: int((s > 0).sum())), dn=("direction", lambda s: int((s < 0).sum())))
    dc = pd.DataFrame({"names_measured": pd.Series(meas)}).join(cnt, how="left").fillna(0).astype(int).sort_index()
    return E, dc
