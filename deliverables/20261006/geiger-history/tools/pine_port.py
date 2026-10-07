# GH1 · the Pine oscillator's algorithm, line for line, in Python — so it can be run on the same bars as the replay.
# Mirrors pine/SCINTILLA-GEIGER-OSCILLATOR.pine: rungRead(), rung(), gridId()/gridDone(), epochDay(), easterDay(),
# isHoliday(), nextSession(), intraRungs(), dailyRungs() and the chart-side Equalizer mean. Names follow the Pine source.
import math, json, sys, os, pickle, numpy as np, datetime as dtm
DAY_MS = 86400000; HOUR_MS = 3600000; GRID_MS = 4 * 3600000; WINDOW = 230; MATURE = 200
RSI_OS, RSI_OB, W_OS, W_OB = 23.0, 77.0, -90.0, -10.0
K5, K8, K13, K21, K34 = 2.0 / 6.0, 2.0 / 9.0, 2.0 / 14.0, 2.0 / 22.0, 2.0 / 35.0
W = {"3h": 1.235817, "4h": 2.278755, "6h": 3.178477, "12h": 3.172702, "1d": 3.178477, "3d": 2.576738, "1w": 0.987499}
famT, famM, mixR, mixW = 0.5, 0.5, 0.6, 0.4
NA = float("nan"); isna = lambda x: x != x
clamp1 = lambda x: max(-1.0, min(1.0, x))

def ymd(ed):
    d = dtm.date(1970, 1, 1) + dtm.timedelta(days=int(ed)); return d.year, d.month, d.day
def easterDay(y):
    a = y % 19; b = y // 100; c = y % 100; d = b // 4; e = b % 4; f = (b + 8) // 25; g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30; i = c // 4; k = c % 4; l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451; mo = (h + l - 7 * m + 114) // 31; dd = (h + l - 7 * m + 114) % 31 + 1
    return (dtm.date(y, mo, dd) - dtm.date(1970, 1, 1)).days
def isHoliday(ed):
    y, mo, d = ymd(ed); wd = (ed + 4) % 7
    newYear = mo == 1 and (d == 1 or (d == 2 and wd == 1))
    mlk = mo == 1 and wd == 1 and 15 <= d <= 21
    pres = mo == 2 and wd == 1 and 15 <= d <= 21
    goodFri = ed == easterDay(y) - 2
    memorial = mo == 5 and wd == 1 and d >= 25
    june = y >= 2022 and mo == 6 and (d == 19 or (d == 18 and wd == 5) or (d == 20 and wd == 1))
    july4 = mo == 7 and (d == 4 or (d == 3 and wd == 5) or (d == 5 and wd == 1))
    labor = mo == 9 and wd == 1 and d <= 7
    thanks = mo == 11 and wd == 4 and 22 <= d <= 28
    xmas = mo == 12 and (d == 25 or (d == 24 and wd == 5) or (d == 26 and wd == 1))
    return newYear or mlk or pres or goodFri or memorial or june or july4 or labor or thanks or xmas
def nextSession(ed):
    nx = ed + 1
    for _ in range(8):
        wd = (nx + 4) % 7
        if wd == 0 or wd == 6 or isHoliday(nx): nx += 1
        else: break
    return nx

class Rung:
    def __init__(s):
        s.cl = []; s.hi = []; s.lo = []; s.n = 0
        s.e5 = s.e8 = s.e13 = s.e21 = s.e34 = NA
        s.s50 = s.s100 = s.s150 = s.s200 = 0.0
        s.ag = s.al = NA; s.sumG = s.sumL = 0.0; s.prevC = NA
        s.curId = None; s.curH = s.curL = s.curC = NA
    def read(s, plus, h, l, c):
        n = s.n; m = min(n + (1 if plus else 0), WINDOW); trend = NA; mom = NA
        if m >= 8:
            sz = len(s.cl)
            x5 = c * K5 + s.e5 * (1.0 - K5) if plus else s.e5
            x8 = c * K8 + s.e8 * (1.0 - K8) if plus else s.e8
            x13 = c * K13 + s.e13 * (1.0 - K13) if plus else s.e13
            x21 = c * K21 + s.e21 * (1.0 - K21) if plus else s.e21
            x34 = c * K34 + s.e34 * (1.0 - K34) if plus else s.e34
            pairs = 1; inOrd = 1 if x5 > x8 else 0; prev = x8
            for need, x in ((13, x13), (21, x21), (34, x34)):
                if m >= need: pairs += 1; inOrd += 1 if prev > x else 0; prev = x
            for need, ssum in ((50, s.s50), (100, s.s100), (150, s.s150), (200, s.s200)):
                if m >= need:
                    a = (ssum - (s.cl[sz - need] if n >= need else 0.0) + c) / need if plus else ssum / need
                    pairs += 1; inOrd += 1 if prev > a else 0; prev = a
            trend = (2.0 * inOrd - pairs) / pairs
            if m >= 15:
                g = s.ag; ls = s.al
                if plus:
                    dlt = c - s.prevC; up = dlt if dlt > 0 else 0.0; dn = -dlt if dlt < 0 else 0.0
                    if n >= 15: g = (s.ag * 13.0 + up) / 14.0; ls = (s.al * 13.0 + dn) / 14.0
                    else: g = (s.sumG + up) / 14.0; ls = (s.sumL + dn) / 14.0
                rsi = 100.0 - 100.0 / (1.0 + (1e9 if ls == 0 else g / ls))
                hh = h if plus else -1e18; ll = l if plus else 1e18; kk = 13 if plus else 14; hs = len(s.hi)
                for j in range(kk):
                    hh = max(hh, s.hi[hs - 1 - j]); ll = min(ll, s.lo[hs - 1 - j])
                last = c if plus else s.prevC
                wr = (hh - last) / (hh - ll) * -100.0 if hh > ll else -50.0
                mw = mixR + mixW if mixR + mixW > 0 else 1.0
                mom = (clamp1((rsi - RSI_OS) / (RSI_OB - RSI_OS) * 2.0 - 1.0) * mixR + clamp1((wr - W_OS) / (W_OB - W_OS) * 2.0 - 1.0) * mixW) / mw
        return trend, mom
    def step(s, bid, doneNow, high, low, close):
        if s.curId is None or bid != s.curId:
            if s.curId is not None:
                c = s.curC; n = s.n
                if n == 0: s.e5 = s.e8 = s.e13 = s.e21 = s.e34 = c
                else:
                    s.e5 = c * K5 + s.e5 * (1.0 - K5); s.e8 = c * K8 + s.e8 * (1.0 - K8); s.e13 = c * K13 + s.e13 * (1.0 - K13)
                    s.e21 = c * K21 + s.e21 * (1.0 - K21); s.e34 = c * K34 + s.e34 * (1.0 - K34)
                sz = len(s.cl)
                s.s50 += c - (s.cl[sz - 50] if n >= 50 else 0.0); s.s100 += c - (s.cl[sz - 100] if n >= 100 else 0.0)
                s.s150 += c - (s.cl[sz - 150] if n >= 150 else 0.0); s.s200 += c - (s.cl[sz - 200] if n >= 200 else 0.0)
                s.cl.append(c)
                if len(s.cl) > 200: s.cl.pop(0)
                if n >= 1:
                    dlt = c - s.prevC; up = dlt if dlt > 0 else 0.0; dn = -dlt if dlt < 0 else 0.0
                    if n <= 13: s.sumG += up; s.sumL += dn
                    elif n == 14: s.ag = (s.sumG + up) / 14.0; s.al = (s.sumL + dn) / 14.0
                    else: s.ag = (s.ag * 13.0 + up) / 14.0; s.al = (s.al * 13.0 + dn) / 14.0
                s.prevC = c; s.hi.append(s.curH); s.lo.append(s.curL)
                if len(s.hi) > 14: s.hi.pop(0); s.lo.pop(0)
                s.n += 1
            s.curId = bid; s.curH = high; s.curL = low; s.curC = close
        else:
            s.curH = max(s.curH, high); s.curL = min(s.curL, low); s.curC = close
        tDev, mDev = s.read(True, s.curH, s.curL, s.curC); tFin, mFin = s.read(False, s.curH, s.curL, s.curC)
        return (tDev, mDev, tDev if doneNow else tFin, mDev if doneNow else mFin, s.n)

def gridId(t, nh): return math.floor((t - GRID_MS) / (nh * 3600000.0))
def epoch_day_of_daily(t): return int(math.floor((t + 12 * HOUR_MS) / DAY_MS))        # daily bars are stamped at midnight New York

def intra_context(base, base_minutes=30):
    """One row per base bar: for each of the four intraday rungs (dev T, dev M, cmp T, cmp M, n)."""
    R = {3: Rung(), 4: Rung(), 6: Rung(), 12: Rung()}; out = np.full((len(base), 20), NA)
    for i, (t, o, h, l, c) in enumerate(base):
        tc = t + base_minutes * 60000; k = 0
        for nh in (3, 4, 6, 12):
            b = gridId(t, nh); out[i, k:k + 5] = R[nh].step(b, tc >= (b + 1) * nh * HOUR_MS + GRID_MS, h, l, c); k += 5
    return out
def daily_context(d, phase3=2):
    """One row per daily bar: evening D, 3D, W (T, M each). phase3: the 3-day calendar (2 = Grid A, 1 = Grid B)."""
    RD, R3, RW = Rung(), Rung(), Rung(); out = np.full((len(d), 6), NA)
    for i, (t, o, h, l, c) in enumerate(d):
        ed = epoch_day_of_daily(t); nx = nextSession(ed); k3 = math.floor((ed - phase3) / 3.0); kw = math.floor((ed + 4) / 7.0)
        a = RD.step(ed, True, h, l, c); b = R3.step(k3, math.floor((nx - phase3) / 3.0) != k3, h, l, c); w = RW.step(kw, math.floor((nx + 4) / 7.0) != kw, h, l, c)
        out[i] = (a[2], a[3], b[2], b[3], w[2], w[3])
    return out
def rungVal(t, m): return NA if isna(t) else (t if isna(m) else (famT * t + famM * m) / (famT + famM))
def daily_chart(d, base, mapping="session_end", waitFull=True, phase3=2):
    """What the script plots on a DAILY chart. mapping: which intrabar TradingView hands to the daily bar —
       'session_end' = the day's last extended-hours bar; 'cash_close' = the last bar before 16:00 New York."""
    ic = intra_context(base); dc = daily_context(d, phase3); tb = base[:, 0]; n = len(d); g = np.full(n, NA)
    for i in range(n):
        t0 = d[i, 0]; hi = t0 + (20 if mapping == "session_end" else 16) * HOUR_MS
        j = int(np.searchsorted(tb, hi, side="left")) - 1
        if j < 0 or tb[j] < t0: continue                                   # no intrabar on that date
        row = ic[j]; vals = {}; ok = True
        for r, k in (("3h", 0), ("4h", 5), ("6h", 10), ("12h", 15)):
            vals[r] = rungVal(row[k], row[k + 1])
            if waitFull and not (row[k + 4] >= MATURE): ok = False
        vals["1d"] = rungVal(dc[i, 0], dc[i, 1]); vals["3d"] = rungVal(dc[i, 2], dc[i, 3]); vals["1w"] = rungVal(dc[i, 4], dc[i, 5])
        if not ok or any(isna(v) for v in vals.values()): continue
        g[i] = sum(W[r] * vals[r] for r in W) / sum(W.values())
    return g
