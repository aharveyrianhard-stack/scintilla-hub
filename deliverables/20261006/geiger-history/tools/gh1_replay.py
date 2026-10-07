# GH1 · the seven-rung Geiger, replayed per name per session AS THE HUB'S PUBLISHER WOULD HAVE READ IT THAT EVENING.
#
# Maths: recon_g2.read_windows() — G2's numpy port of the publisher's services/hot-query/geiger-rung-math.mjs — unchanged.
# What this file adds is the publisher's BAR SELECTION, read from its code on the live provider line
# (geiger-publish-artifact.mjs, geiger-source-contract.mjs, rest-accel/provider-bar-finality.mjs):
#   · every rung reads its newest 230 FINISHED bars (fewer while a name is young; the fan drops the lines it cannot fill);
#   · an intraday bar counts once the 20:00 ET close of its day has passed, so the evening reading holds the whole session;
#   · a 3-day or weekly bar counts only once the LAST session inside it has closed — the unfinished 3-day / weekly bar is
#     NOT read (SG1/NQ1's replay did read it; that is the one place this replay differs from theirs);
#   · an intraday rung whose newest bar is on an earlier New York date than the daily bar is left out;
#   · the Geiger is the Equalizer-weighted mean of the rungs that are present.
# 3-day and weekly bars are the provider's own (chart API tf=3D / W), not rebuilt from daily bars.
import json, os, sys, numpy as np, datetime as dtm
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import recon_g2 as R

W = {"3h": 1.235817, "4h": 2.278755, "6h": 3.178477, "12h": 3.172702, "1d": 3.178477, "3d": 2.576738, "1w": 0.987499}
RUNGS = ["3h", "4h", "6h", "12h", "1d", "3d", "1w"]
TFKEY = {"3h": "180", "4h": "240", "6h": "6h", "12h": "12h", "1d": "D", "3d": "3D", "1w": "W"}
INTRADAY = ["3h", "4h", "6h", "12h"]
NB = 230; HOUR = 3600000.0; DAY = 86400000.0
GAP_DAYS = {"180": 12, "240": 12, "6h": 12, "12h": 12, "D": 12, "3D": 16, "W": 24}   # a hole this long starts a new history (a renamed ticker whose old bars are not served)
BARS = os.environ.get("GH1_BARS", "bars")

def day_ord(t):
    """ET calendar-day number of a bar stamped at midnight ET (04:00 or 05:00 UTC)."""
    return np.floor((np.asarray(t, dtype=np.float64) + 12 * HOUR) / DAY).astype(np.int64)

def iso(t):
    return [(dtm.datetime(1970, 1, 1) + dtm.timedelta(days=int(d))).strftime("%Y-%m-%d") for d in day_ord(t)]

def seg_start(t, tf):
    """Index of the first bar of the unbroken stretch each bar belongs to."""
    n = len(t); s = np.zeros(n, dtype=np.int64)
    if n > 1:
        brk = np.where(np.diff(t) > GAP_DAYS[tf] * DAY)[0] + 1
        for b in brk: s[b:] = b
    return s

def read_at(c, h, l, last, first):
    """Publisher maths on the window ending at index `last` (-1 = no bar), never reaching back before `first`. Returns trend, momentum, bars used."""
    m = len(last); tr = np.full(m, np.nan); mo = np.full(m, np.nan)
    nb = np.where(last >= 0, np.minimum(last - first + 1, NB), 0)
    for n in np.unique(nb[nb >= 8]):
        rows = np.where(nb == n)[0]
        ii = last[rows][:, None] + np.arange(-n + 1, 1)[None, :]
        a, b = R.read_windows(c[ii], h[ii], l[ii]); tr[rows] = a; mo[rows] = b
    return tr, mo, nb

def wilder_rsi(c, p=14):
    n = len(c); out = np.full(n, np.nan)
    if n <= p: return out
    d = np.diff(c); g = np.where(d > 0, d, 0.0); ls = np.where(d < 0, -d, 0.0)
    ag = g[:p].mean(); al = ls[:p].mean()
    out[p] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    for i in range(p, n - 1):
        ag = (ag * (p - 1) + g[i]) / p; al = (al * (p - 1) + ls[i]) / p
        out[i + 1] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out

def sma(c, n):
    out = np.full(len(c), np.nan)
    if len(c) >= n:
        cs = np.cumsum(np.r_[0.0, c]); out[n - 1:] = (cs[n:] - cs[:-n]) / n
    return out

def slow_from_daily(d, dord, wd, phase):
    """Finished multi-day bars from daily bars on the provider's calendar lattice: bar start day ≡ phase (mod wd)."""
    bid = (dord - phase) // wd; ub, first = np.unique(bid, return_index=True); last = np.r_[first[1:] - 1, len(d) - 1]
    out = np.zeros((len(ub), 5)); out[:, 0] = (ub * wd + phase) * DAY + 4 * HOUR
    out[:, 1] = d[first, 1]; out[:, 2] = np.maximum.reduceat(d[:, 2], first); out[:, 3] = np.minimum.reduceat(d[:, 3], first); out[:, 4] = d[last, 4]
    return out, ub * wd + phase

def lattice(bd, wd=3):
    """Which calendar the provider's multi-day bars sit on for this name: start day mod wd (it is 2 for most names, 1 for some)."""
    return int(np.bincount((bd % wd).astype(np.int64), minlength=wd).argmax())

def fill_slow_from_daily(b, bd, d, dord, wd):
    if len(bd) < 2 or np.diff(bd).max() <= 4 * wd: return b, bd                # no hole to fill
    built, sd = slow_from_daily(d, dord, wd, lattice(bd, wd))                # on the name's OWN lattice
    have = np.isin(sd, bd)
    last_complete = bd.max() if len(bd) else -1                              # never add the bar the provider is still holding back as unfinished
    add = (~have) & (sd < last_complete)
    if not add.any(): return b, bd
    bb = np.vstack([b[:, :5], built[add]]); dd = np.r_[bd, sd[add]]; o = np.argsort(dd, kind="stable")
    return bb[o], dd[o]

def replay(sym, forming_slow=False):
    """forming_slow=True reproduces SG1/NQ1's variant (the unfinished 3-day / weekly bar is read) for the comparison only."""
    z = np.load(f"{BARS}/{sym}.npz")
    if "tf_D" not in z.files: return None, "no_daily"
    d = z["tf_D"]; dt = d[:, 0]; n = len(d)
    if n < 30: return None, "short"
    dord = day_ord(dt); idx = np.arange(n)
    out = {"t": dt, "date": iso(dt), "o": d[:, 1], "h": d[:, 2], "l": d[:, 3], "c": d[:, 4]}
    T = {}; M = {}; NBU = {}
    # --- intraday rungs: bars that START before 20:00 ET of the session date; dropped when none of them is on the session date
    for r in INTRADAY:
        k = "tf_" + TFKEY[r]
        if k not in z.files: T[r] = np.full(n, np.nan); M[r] = np.full(n, np.nan); NBU[r] = np.zeros(n, dtype=np.int64); continue
        b = z[k]; t = b[:, 0]; ss = seg_start(t, TFKEY[r])
        j = np.searchsorted(t, dt + 20 * HOUR, side="left") - 1
        ok = (j >= 0) & (t[np.maximum(j, 0)] >= dt)
        tr, mo, nb = read_at(b[:, 4], b[:, 2], b[:, 3], np.where(ok, j, -1), ss[np.maximum(j, 0)])
        T[r] = tr; M[r] = mo; NBU[r] = nb
    # --- daily rung: the session's own settled daily bar is the newest
    ss = seg_start(dt, "D"); tr, mo, nb = read_at(d[:, 4], d[:, 2], d[:, 3], idx, ss); T["1d"] = tr; M["1d"] = mo; NBU["1d"] = nb
    # --- 3-day and weekly rungs: the provider's own bars, each counted from the evening of the last session inside it
    for r, wd in (("3d", 3), ("1w", 7)):
        k = "tf_" + TFKEY[r]
        if k not in z.files: T[r] = np.full(n, np.nan); M[r] = np.full(n, np.nan); NBU[r] = np.zeros(n, dtype=np.int64); continue
        b = z[k]; bd = day_ord(b[:, 0])
        if r == "3d":
            # A renamed ticker's old 3-day bars are not served (the API joins D and W only): fill the hole with 3-day bars built
            # from the joined daily bars on that name's own provider lattice. Checked equal to the provider's bars on SPY, NVDA, MU, GFS, CIEN.
            b, bd = fill_slow_from_daily(b, bd, d, dord, wd)
        ss = seg_start(b[:, 0], TFKEY[r])
        lastsess = np.searchsorted(dord, bd + wd, side="left") - 1          # last session of the name that falls inside each bar
        if forming_slow:
            # SG1/NQ1 variant: the bar that holds the session is read as it stood that evening (close = the session's close,
            # high / low = the extremes of the bar's sessions so far), in front of the finished bars before it
            tail = dord[dord >= bd[-1] + wd]                                    # sessions after the last finished bar: their bar is still forming and is not served
            if len(tail):
                st = np.unique(bd[-1] + wd * ((tail - bd[-1]) // wd))            # the provider's grid for this name, continued
                b = np.vstack([b, np.zeros((len(st), b.shape[1]))]); bd = np.r_[bd, st]; ss = np.r_[ss, np.full(len(st), ss[-1])]
            kk = np.searchsorted(bd, dord, side="right") - 1                   # the bar each session sits in
            inb = (kk >= 0) & (dord < bd[np.maximum(kk, 0)] + wd)
            fh = d[:, 2].copy(); fl = d[:, 3].copy()
            for i in range(1, n):
                if kk[i] == kk[i - 1]: fh[i] = max(fh[i - 1], d[i, 2]); fl[i] = min(fl[i - 1], d[i, 3])
            f0 = ss[np.maximum(kk, 0)]; nb = np.where(inb, np.minimum(kk - f0 + 1, NB), 0)
            tr = np.full(n, np.nan); mo = np.full(n, np.nan)
            for ln in np.unique(nb[nb >= 8]):
                rows = np.where(nb == ln)[0]; ii = kk[rows][:, None] + np.arange(-ln + 1, 1)[None, :]
                C = b[:, 4][ii].copy(); Hh = b[:, 2][ii].copy(); Ll = b[:, 3][ii].copy()
                C[:, -1] = d[rows, 4]; Hh[:, -1] = fh[rows]; Ll[:, -1] = fl[rows]
                a_, b_ = R.read_windows(C, Hh, Ll); tr[rows] = a_; mo[rows] = b_
        else:
            cnt = np.searchsorted(lastsess, idx, side="right")                # bars finished by the evening of each session
            last = cnt - 1
            fresh = (last >= 0) & (dord - bd[np.maximum(last, 0)] <= 2 * wd + 5)   # the newest finished bar must be the current one, not a relic across a hole
            tr, mo, nb = read_at(b[:, 4], b[:, 2], b[:, 3], np.where(fresh, last, -1), ss[np.maximum(last, 0)])
        T[r] = tr; M[r] = mo; NBU[r] = nb
    ws = np.zeros(n); cs = np.zeros(n); tsum = np.zeros(n); mw = np.zeros(n); ms = np.zeros(n); nr = np.zeros(n, dtype=np.int64)
    for r in RUNGS:
        a = ~np.isnan(T[r]); hm = a & ~np.isnan(M[r])
        rr = np.where(hm, 0.5 * T[r] + 0.5 * np.nan_to_num(M[r]), np.nan_to_num(T[r]))
        ws += a * W[r]; cs += np.where(a, W[r] * rr, 0.0); tsum += np.where(a, W[r] * np.nan_to_num(T[r]), 0.0)
        mw += hm * W[r]; ms += np.where(hm, W[r] * np.nan_to_num(M[r]), 0.0); nr += a
        out["T_" + r] = T[r]; out["M_" + r] = M[r]; out["N_" + r] = NBU[r]
    with np.errstate(invalid="ignore", divide="ignore"):
        out["g"] = np.where(ws > 0, cs / ws, np.nan); out["trend"] = np.where(ws > 0, tsum / ws, np.nan); out["mom"] = np.where(mw > 0, ms / mw, np.nan)
    out["nr"] = nr
    out["full"] = np.all([out["N_" + r] == NB for r in RUNGS], axis=0)       # every rung on its full 230-bar window
    out["rsi"] = wilder_rsi(d[:, 4]); s200 = sma(d[:, 4], 200); out["sma200"] = s200
    with np.errstate(invalid="ignore"): out["p200"] = (d[:, 4] / s200 - 1) * 100
    return out, "ok"

if __name__ == "__main__":
    for s in sys.argv[1:]:
        o, why = replay(s)
        if o is None: print(s, why); continue
        i = len(o["t"]) - 1
        print(s, o["date"][i], "g %.6f trend %.6f mom %.6f rungs %d" % (o["g"][i], o["trend"][i], o["mom"][i], o["nr"][i]),
              {r: (round(float(o["T_" + r][i]), 4), round(float(o["M_" + r][i]), 4), int(o["N_" + r][i])) for r in RUNGS})
