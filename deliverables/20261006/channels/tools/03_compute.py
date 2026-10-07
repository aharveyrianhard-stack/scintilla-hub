# CHN1 step 3 - the study. Reads ../data (steps 1 and 2), writes ../data/results.json and ../data/series-<SYM>.json.
#
# Basis. The Lab's lines live on dividend-adjusted prices (TradingView "ADJ"); the chart API serves split-adjusted prices. A straight line
# on one basis is not straight on the other, so the study runs on the Lab's basis: every chart API bar is multiplied by the dividend
# factor in force that day. The factor is MEASURED, not looked up: Lab weekly close / chart API weekly close steps once a quarter on the
# ex-dividend day. After the conversion the chart API bars must reproduce the Lab's own bars - that parity is checked and written out.
#
# Clocks. Each rail advances once per SOURCE bar (the Lab's native rule): level = price_at_snapshot + slope x n, n = source bars after the
# snapshot bar. 1W: n counts calendar weeks. 2W: n counts the Lab's actual two-week bars. TradingView restarts the two-week count on the
# first Monday of every year, so a year with 53 Mondays ends on a single-week bar (31 Dec 2018, 30 Dec 2024). 2026 has 52 Mondays, so the
# bars after the newest saved one (28 Sep 2026) simply follow every 14 days through the look-ahead used here (to Feb 2027).
#
# Checks written into results.json, not assumed: the converted bars against the Lab's own daily and weekly bars; our 200-day, RSI and
# Williams against the values the Lab saved in its own daily capture; the two source clocks against the Lab's bar counts.
import json, os, bisect, math, statistics, datetime as dt
from collections import OrderedDict

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
LABBARS = json.load(open(os.path.join(DATA, "lab-source-bars.json")))["symbols"]
LAB = json.load(open(os.path.join(DATA, "lab-channels.json")))
MERGE_GAP = 20          # pierces fewer than this many sessions apart are one episode (one trading month)
RSI_N = 14; WPR_N = 14  # the Lab's own oscillator: ta.rsi(close,14), ta.wpr(14)
MONTH_DAYS = 365.25 / 12
HOLIDAYS = {dt.date(2026, 11, 26), dt.date(2026, 12, 25), dt.date(2027, 1, 1), dt.date(2027, 1, 18), dt.date(2027, 2, 15), dt.date(2027, 3, 26)}  # NYSE full closes ahead

def day(ms): return dt.datetime.utcfromtimestamp(ms / 1000).date()
def monday(d): return d - dt.timedelta(days=d.weekday())
def r(x, n=4): return None if x is None else round(float(x), n)
def med(xs):
    xs = [x for x in xs if x is not None]
    return statistics.median(xs) if xs else None

def sma(x, n):
    out = [None] * len(x); s = 0.0
    for i, v in enumerate(x):
        s += v
        if i >= n: s -= x[i - n]
        if i >= n - 1: out[i] = s / n
    return out
def rsi_wilder(c, n):
    out = [None] * len(c); ag = al = 0.0
    for i in range(1, len(c)):
        ch = c[i] - c[i - 1]; g = max(ch, 0.0); l = max(-ch, 0.0)
        if i <= n:
            ag += g; al += l
            if i == n:
                ag /= n; al /= n; out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
        else:
            ag = (ag * (n - 1) + g) / n; al = (al * (n - 1) + l) / n; out[i] = 100.0 if al == 0 else 100 - 100 / (1 + ag / al)
    return out
def wpr(h, l, c, n):
    out = [None] * len(c)
    for i in range(n - 1, len(c)):
        hh = max(h[i - n + 1:i + 1]); ll = min(l[i - n + 1:i + 1]); out[i] = -100 * (hh - c[i]) / (hh - ll) if hh > ll else None
    return out
def pct_rank(sorted_vals, v):   # share of the instrument's own sessions at or below this reading
    return 100.0 * bisect.bisect_right(sorted_vals, v) / len(sorted_vals)

def study(sym):
    bars = json.load(open(os.path.join(DATA, f"bars-D-{sym}.json")))
    D = [day(x[0]) for x in bars["rows"]]; O = [x[1] for x in bars["rows"]]; H = [x[2] for x in bars["rows"]]; Lw = [x[3] for x in bars["rows"]]; C = [x[4] for x in bars["rows"]]
    N = len(D); wk = OrderedDict()
    for i, d in enumerate(D): wk.setdefault(monday(d), []).append(i)

    # ---- the dividend factor, measured from the Lab's weekly bars ------------------------------------------------------------
    W = LABBARS[sym]["1W"]["rows"][:-1]     # the newest Lab week was still forming when it was saved; leave it out
    seg = []; prev = None
    for t, o, h, l, c in W:
        ids = wk[monday(day(t))]; fo = o / O[ids[0]]; fc = c / C[ids[-1]]
        if prev is None: seg.append({"from": dt.date(1900, 1, 1), "factor": fo}); prev = fo
        if abs(fo - prev) > 2e-5:            # the step is already in Monday's open: ex-dividend on the week's first session
            seg.append({"from": D[ids[0]], "factor": fo, "pinned_by": "open of the week already carries the new factor"}); prev = fo
        if abs(fc - prev) > 2e-5:            # the step happens inside the week: find the session that reproduces the Lab's weekly high and low
            errs = []
            for j in range(1, len(ids)):
                hi = max(H[i] * (prev if k < j else fc) for k, i in enumerate(ids)); lo = min(Lw[i] * (prev if k < j else fc) for k, i in enumerate(ids))
                errs.append((abs(hi - h) + abs(lo - l), j))
            mn = min(e for e, _ in errs); Z = [j for e, j in errs if e <= mn + 1e-6]
            j = Z[-1] if (len(ids) - 1) in Z else Z[0]
            seg.append({"from": D[ids[j]], "factor": fc, "pinned_by": "weekly high/low test" + ("" if len(Z) == 1 else f" ({len(Z)} sessions fit; took the " + ("last, the fund's usual Friday" if (len(ids) - 1) in Z else "first") + ")")}); prev = fc
    starts = [s["from"] for s in seg]
    F = [seg[bisect.bisect_right(starts, d) - 1]["factor"] for d in D]
    for k in range(1, len(seg)):
        i = D.index(seg[k]["from"]); seg[k]["implied_cash_dividend"] = r(C[i - 1] * (1 - seg[k - 1]["factor"] / seg[k]["factor"]), 4)
    aC = [C[i] * F[i] for i in range(N)]; aH = [H[i] * F[i] for i in range(N)]; aL = [Lw[i] * F[i] for i in range(N)]; aO = [O[i] * F[i] for i in range(N)]
    first_known = day(W[0][0])               # before this week the factor is the earliest measured one (older dividends are not applied)

    # parity: the converted chart API bars against the Lab's own daily and weekly bars
    idx = {d: i for i, d in enumerate(D)}
    L1 = LABBARS[sym]["1D"]["rows"][:-1]
    dpar = [max(abs(aO[idx[day(t)]] - o), abs(aH[idx[day(t)]] - h), abs(aL[idx[day(t)]] - l), abs(aC[idx[day(t)]] - c)) for t, o, h, l, c in L1]
    wpar = []
    for t, o, h, l, c in W:
        ids = wk[monday(day(t))]; wpar.append(max(abs(aO[ids[0]] - o), abs(max(aH[i] for i in ids) - h), abs(min(aL[i] for i in ids) - l), abs(aC[ids[-1]] - c)))
    parity = {"daily": {"lab_days_compared": len(dpar), "from": str(day(L1[0][0])), "to": str(day(L1[-1][0])), "max_abs_error_usd_any_of_ohlc": r(max(dpar), 6)},
              "weekly": {"lab_weeks_compared": len(wpar), "from": str(day(W[0][0])), "to": str(day(W[-1][0])), "max_abs_error_usd_any_of_ohlc": r(max(wpar), 6)}}

    # ---- indicators ------------------------------------------------------------------------------------------------------
    ma = sma(aC, 200); ma_raw = sma(C, 200)
    rsi = rsi_wilder(aC, RSI_N); wp = wpr(aH, aL, aC, WPR_N)

    # parity: our 200-day, RSI and Williams against the Lab's own saved daily values. The Lab's multi-timeframe oscillator prints, on each
    # daily bar, the value of the last COMPLETED day, so its RSI / Williams columns are compared with ours one session earlier.
    LI = LABBARS[sym]["1D_lab_indicators"]["rows"][:-1]
    e_ma = [abs(v[1] - ma[idx[day(v[0])]]) for v in LI if v[1] is not None]
    def osc_err(col, mine, shift):
        return [abs(v[col] - mine[idx[day(v[0])] - shift]) for v in LI if v[col] is not None and mine[idx[day(v[0])] - shift] is not None]
    wp100 = [None if x is None else x + 100 for x in wp]
    parity["sma200_vs_lab_saved_daily"] = {"days": len(e_ma), "max_abs_error_usd": r(max(e_ma), 6), "lab_study": LABBARS[sym]["1D_lab_indicators"]["studies"]["sma200"]}
    parity["rsi14_vs_lab_saved_daily"] = {"days": len(osc_err(2, rsi, 1)), "max_abs_error_points_lab_bar_vs_our_previous_session": r(max(osc_err(2, rsi, 1)), 6),
                                          "max_abs_error_points_same_day_for_contrast": r(max(osc_err(2, rsi, 0)), 3), "lab_study": LABBARS[sym]["1D_lab_indicators"]["studies"]["oscillators"]}
    parity["williams14_plus100_vs_lab_saved_daily"] = {"days": len(osc_err(3, wp100, 1)), "max_abs_error_points_lab_bar_vs_our_previous_session": r(max(osc_err(3, wp100, 1)), 6),
                                                       "max_abs_error_points_same_day_for_contrast": r(max(osc_err(3, wp100, 0)), 3)}

    # ---- the two source clocks and the rails -----------------------------------------------------------------------------
    ch = LAB["symbols"][sym]["channels"]; c1, c2 = ch["1W B"], ch["2W B"]
    snap1 = monday(day(c1["snapshot_bar_ms"])); T2 = [monday(day(x[0])) for x in LABBARS[sym]["2W"]["rows"]]; i2s = T2.index(monday(day(c2["snapshot_bar_ms"])))
    def n1(d): return (monday(d) - snap1).days // 7
    def n2(d):
        m = monday(d)
        if m <= T2[-1]: return bisect.bisect_right(T2, m) - 1 - i2s
        return len(T2) - 1 - i2s + (m - T2[-1]).days // 14   # after the newest saved bar: one step every 14 days (see the note on clocks above)
    clock = {"1W": {"n_at_origin": n1(day(c1["origin_ms"])), "lab_base_offset": c1["base_offset_bars"], "span_origin_to_endpoint": n1(day(c1["endpoint_ms"])) - n1(day(c1["origin_ms"])), "lab_span": c1["anchor_span_bars"]},
             "2W": {"n_at_origin": n2(day(c2["origin_ms"])), "lab_base_offset": c2["base_offset_bars"], "span_origin_to_endpoint": n2(day(c2["endpoint_ms"])) - n2(day(c2["origin_ms"])), "lab_span": c2["anchor_span_bars"],
                    "single_week_bars": [str(T2[i - 1]) for i in range(1, len(T2)) if (T2[i] - T2[i - 1]).days == 7 and T2[i] >= dt.date(2021, 1, 1)]}}
    clock["ok"] = (clock["1W"]["n_at_origin"] == -c1["base_offset_bars"] and clock["1W"]["span_origin_to_endpoint"] == c1["anchor_span_bars"]
                   and clock["2W"]["n_at_origin"] == -c2["base_offset_bars"] and clock["2W"]["span_origin_to_endpoint"] == c2["anchor_span_bars"])
    def rails(c, n):
        s = c["slope_per_source_bar"]; return (c["upper"]["at_snapshot"] + s * n, c["mid"]["at_snapshot"] + s * n, c["lower"]["at_snapshot"] + s * n)
    R1 = [rails(c1, n1(d)) for d in D]; R2 = [rails(c2, n2(d)) for d in D]
    s1w = c1["slope_usd_per_7d"]; s2w = c2["slope_usd_per_7d"]     # the Lab's comparable unit: USD per 7 days

    life0 = next(i for i, d in enumerate(D) if d >= day(min(c1["origin_ms"], c2["origin_ms"])))
    last = N - 1

    # ---- the channel table ---------------------------------------------------------------------------------------------------
    def chan_row(name, c, R, susd):
        U, M, Lo = R[last]; px = aC[last]
        U0, M0, L0 = c["upper"]["at_snapshot"], c["mid"]["at_snapshot"], c["lower"]["at_snapshot"]
        pos = [(aC[i] - R[i][2]) / (R[i][0] - R[i][2]) * 100 for i in range(life0, N)]
        inside = sum(1 for p in pos if 0 <= p <= 100); below = sum(1 for p in pos if p < 0); above = sum(1 for p in pos if p > 100)
        imin = min(range(len(pos)), key=lambda k: pos[k]); imax = max(range(len(pos)), key=lambda k: pos[k])
        return {"name": name, "source_timeframe": c["source_timeframe"], "record_hash": c["record_hash"],
                "ids": {"upper": c["upper"]["id"], "mid": c["mid"]["id"], "lower": c["lower"]["id"]},
                "equations": {"n": f"number of {c['source_timeframe']} source bars after the snapshot bar of {str(day(c['snapshot_bar_ms']))} (negative in the past)",
                              "upper": f"{U0:.4f} + {c['slope_per_source_bar']:.10f} x n", "mid": f"{M0:.4f} + {c['slope_per_source_bar']:.10f} x n", "lower": f"{L0:.4f} + {c['slope_per_source_bar']:.10f} x n"},
                "upper_anchors": [{"date": str(day(c["origin_ms"])), "price": r(c["origin_price_upper"], 4)}, {"date": str(day(c["endpoint_ms"])), "price": r(U0 + c["slope_per_source_bar"] * (n_end(c)), 4)}],
                "height_usd": r(U0 - L0, 4),
                "slope": {"lab_native": r(c["slope_per_source_bar"], 10), "lab_native_unit": c["slope_unit"], "usd_per_7d": r(susd, 6),
                          "pct_of_close_per_7d": r(100 * susd / px, 4), "lab_strip_reads": f"{100 * susd / px:+.2f}% / 7d",
                          "native_usd_per_calendar_week": r(c["slope_per_source_bar"] / (1 if c["source_timeframe"] == "1W" else 2), 10),
                          "usd_per_month": r(susd * MONTH_DAYS / 7, 4), "pct_of_close_per_month": r(100 * susd * MONTH_DAYS / 7 / px, 4), "pct_of_mid_per_month": r(100 * susd * MONTH_DAYS / 7 / M, 4),
                          "usd_per_year": r(susd * 365.25 / 7, 3), "pct_of_close_per_year": r(100 * susd * 365.25 / 7 / px, 3)},
                "today": {"session": str(D[last]), "close": px, "upper": r(U), "mid": r(M), "lower": r(Lo),
                          "position_pct_of_height": r((px - Lo) / (U - Lo) * 100, 2),
                          # every distance below is the move the PRICE would have to make from today's close to stand on that line
                          "move_to_upper_pct": r((U / px - 1) * 100, 3), "move_to_upper_usd": r(U - px, 3),
                          "move_to_mid_pct": r((M / px - 1) * 100, 3), "move_to_mid_usd": r(M - px, 3),
                          "move_to_lower_pct": r((Lo / px - 1) * 100, 3), "move_to_lower_usd": r(Lo - px, 3),
                          "close_above_mid_pct_of_mid": r((px / M - 1) * 100, 3), "close_above_lower_pct_of_lower": r((px / Lo - 1) * 100, 3),
                          "sma200_position_pct_of_height": r((ma[last] - Lo) / (U - Lo) * 100, 2)},
                "life": {"from": str(D[life0]), "sessions": N - life0, "closes_inside": inside, "closes_below_lower": below, "closes_above_upper": above,
                         "share_inside_pct": r(100 * inside / (N - life0), 1),
                         "share_of_closes_above_the_midline_pct": r(100 * sum(1 for p in pos if p > 50) / len(pos), 1), "median_position_pct": r(med(pos), 1),
                         "slope_pct_of_close_per_month_at_the_start": r(100 * susd * MONTH_DAYS / 7 / aC[life0], 3),
                         "lowest_position": {"date": str(D[life0 + imin]), "pct": r(pos[imin], 1)}, "highest_position": {"date": str(D[life0 + imax]), "pct": r(pos[imax], 1)},
                         "sessions_closed_above_upper": [str(D[life0 + k]) for k, p in enumerate(pos) if p > 100]}}
    def n_end(c):
        return (n1(day(c["endpoint_ms"])) if c["source_timeframe"] == "1W" else n2(day(c["endpoint_ms"])))
    channels = [chan_row("1W B", c1, R1, s1w), chan_row("2W B", c2, R2, s2w)]

    # the Lab's slope strip, reproduced: B 2W, B 1W, SMA200 1D live (last two completed daily values, scaled to 7 days)
    def ma_week(i): return (ma[i] - ma[i - 1]) * 7 / (D[i] - D[i - 1]).days
    strip = {"close_used": aC[last],
             "B_2W_retained": {"usd_per_7d": r(s2w, 4), "pct_per_7d": r(100 * s2w / aC[last], 4), "reads": f"{100 * s2w / aC[last]:+.2f}% / 7d"},
             "B_1W_retained": {"usd_per_7d": r(s1w, 4), "pct_per_7d": r(100 * s1w / aC[last], 4), "reads": f"{100 * s1w / aC[last]:+.2f}% / 7d"},
             "SMA200_1D_live": {"through_session": str(D[last]), "usd_per_7d": r(ma_week(last), 4), "pct_per_7d": r(100 * ma_week(last) / aC[last], 4), "reads": f"{100 * ma_week(last) / aC[last]:+.2f}% / 7d",
                                "previous_pair": {"through_session": str(D[last - 1]), "usd_per_7d": r(ma_week(last - 1), 4), "reads_at_that_close": f"{100 * ma_week(last - 1) / aC[last - 1]:+.2f}% / 7d"}}}

    # ---- every pierce of the 200-day by daily close, in the channel's life -----------------------------------------------------
    below = [(ma[i] is not None and aC[i] < ma[i]) for i in range(N)]
    dips = []; i = life0
    while i < N:
        if below[i] and not below[i - 1]:
            j = i
            while j + 1 < N and below[j + 1]: j += 1
            dips.append((i, j)); i = j + 1
        else: i += 1
    groups = []
    for a, b in dips:
        if groups and a - groups[-1][-1][1] - 1 < MERGE_GAP: groups[-1].append((a, b))
        else: groups.append([(a, b)])
    wick_only = [str(D[i]) for i in range(life0, N) if ma[i] is not None and aL[i] < ma[i] and not below[i] and not below[i - 1]]

    S_RSI = sorted(v for v in rsi if v is not None); S_WPR = sorted(v for v in wp if v is not None)
    S_RSI_L = sorted(v for v in rsi[life0:] if v is not None); S_WPR_L = sorted(v for v in wp[life0:] if v is not None)
    first_pierces = [g[0][0] for g in groups]

    def leg(k, j, susd):          # the move from session k to session j, in the Lab's units and as a multiple of the channel slope
        if j is None: return None
        wks = (D[j] - D[k]).days / 7; usd = aC[j] - aC[k]
        return {"date": str(D[j]), "sessions": j - k, "calendar_days": (D[j] - D[k]).days, "close": r(aC[j], 2), "gain_pct": r((aC[j] / aC[k] - 1) * 100, 2),
                "usd_per_7d": r(usd / wks, 3), "multiple_of_channel_slope": r(usd / wks / susd, 2), "pct_per_month": r((aC[j] / aC[k] - 1) * 100 / ((D[j] - D[k]).days / MONTH_DAYS), 2),
                "later_pierces_on_the_way": sum(1 for p in first_pierces if k < p <= j)}
    def first_at(k, cond):
        return next((j for j in range(k + 1, N) if cond(j)), None)

    episodes = []
    for g in groups:
        a0, b1 = g[0][0], g[-1][1]; inb = [q for a, b in g for q in range(a, b + 1)]
        k = min(inb, key=lambda q: aC[q]); kd = min(inb, key=lambda q: aC[q] / ma[q]); kl = min(inb, key=lambda q: aL[q] / ma[q]); kr = min(inb, key=lambda q: rsi[q])
        reclaimed = b1 + 1 if b1 + 1 < N else None
        e = {"label": f"{D[a0].strftime('%b %Y')}" if (D[b1] - D[a0]).days < 45 else f"{D[a0].strftime('%b %Y')} – {D[b1].strftime('%b %Y')}",
             "first_pierce": str(D[a0]), "back_above_for_good": None if reclaimed is None else str(D[reclaimed]), "sessions_first_pierce_to_reclaim": None if reclaimed is None else reclaimed - a0,
             "sessions_closed_below": len(inb),
             "pierces": [{"pierce": str(D[a]), "back_above": (str(D[b + 1]) if b + 1 < N else None), "sessions_below": b - a + 1,
                          "low_close_date": str(D[min(range(a, b + 1), key=lambda q: aC[q])]), "low_close": r(min(aC[a:b + 1]), 2),
                          "max_depth_close_pct": r(min(aC[q] / ma[q] - 1 for q in range(a, b + 1)) * 100, 2), "max_depth_low_pct": r(min(aL[q] / ma[q] - 1 for q in range(a, b + 1)) * 100, 2)} for a, b in g],
             "low": {"date": str(D[k]), "close": r(aC[k], 2), "close_unadjusted": C[k], "sma200": r(ma[k], 2), "below_sma200_pct": r((aC[k] / ma[k] - 1) * 100, 2),
                     "sessions_from_first_pierce": k - a0, "sessions_to_reclaim": None if reclaimed is None else reclaimed - k,
                     "position_1W_B_pct": r((aC[k] - R1[k][2]) / (R1[k][0] - R1[k][2]) * 100, 1), "position_2W_B_pct": r((aC[k] - R2[k][2]) / (R2[k][0] - R2[k][2]) * 100, 1),
                     "rails_1W_B": [r(v, 2) for v in R1[k]], "rails_2W_B": [r(v, 2) for v in R2[k]]},
             "max_depth": {"by_close_pct": r((aC[kd] / ma[kd] - 1) * 100, 2), "by_close_date": str(D[kd]), "by_intraday_low_pct": r((aL[kl] / ma[kl] - 1) * 100, 2), "by_intraday_low_date": str(D[kl])},
             "oscillators_at_low": {"rsi14": r(rsi[k], 1), "rsi14_own_percentile": r(pct_rank(S_RSI, rsi[k]), 1), "rsi14_percentile_channel_life": r(pct_rank(S_RSI_L, rsi[k]), 1),
                                    "williams14": r(wp[k], 1), "williams14_plus100_as_on_the_lab_pane": r(wp[k] + 100, 1), "williams14_own_percentile": r(pct_rank(S_WPR, wp[k]), 1),
                                    "williams14_percentile_channel_life": r(pct_rank(S_WPR_L, wp[k]), 1),
                                    "lowest_rsi14_in_episode": r(rsi[kr], 1), "lowest_rsi14_date": str(D[kr]), "lowest_rsi14_own_percentile": r(pct_rank(S_RSI, rsi[kr]), 1)}}
        e["rebound"] = {
            "to_2W_B4_mid": leg(k, first_at(k, lambda j: aC[j] >= R2[j][1]), s2w),
            "to_1W_B4_mid": leg(k, first_at(k, lambda j: aC[j] >= R1[j][1]), s1w),
            "to_upper_touch": leg(k, first_at(k, lambda j: aH[j] >= R1[j][0]), s1w),      # 1W B2 = 2W B2: the session's high reaches the rail
            "to_upper_close": leg(k, first_at(k, lambda j: aC[j] >= R1[j][0]), s1w),
            "first_20_sessions": leg(k, k + 20 if k + 20 < N else None, s1w), "first_60_sessions": leg(k, k + 60 if k + 60 < N else None, s1w),
            "low_to_today": leg(k, last, s1w)}
        e["_k"] = k; e["_a0"] = a0; e["_b1"] = b1
        episodes.append(e)

    # ---- the same pierce test on the Hub's own prices (split-adjusted, dividends NOT taken out), to show what depends on the basis ----
    below_raw = [(ma_raw[i] is not None and C[i] < ma_raw[i]) for i in range(N)]
    raw_dips = []; i = life0
    while i < N:
        if below_raw[i] and not below_raw[i - 1]:
            j = i
            while j + 1 < N and below_raw[j + 1]: j += 1
            raw_dips.append((i, j)); i = j + 1
        else: i += 1
    adj_days = {q for a, b in dips for q in range(a, b + 1)}; raw_days = {q for a, b in raw_dips for q in range(a, b + 1)}
    raw_groups = []
    for a, b in raw_dips:
        if raw_groups and a - raw_groups[-1][-1][1] - 1 < MERGE_GAP: raw_groups[-1].append((a, b))
        else: raw_groups.append([(a, b)])
    raw_basis = {"what": "the same test on the chart API's own split-adjusted closes and their own 200-day (what the Hub and Station charts show)",
                 "count_pierces": len(raw_dips), "count_episodes": len(raw_groups), "sessions_closed_below": len(raw_days),
                 "sessions_below_on_the_lab_basis": len(adj_days),
                 "below_only_on_the_hub_basis": [str(D[q]) for q in sorted(raw_days - adj_days)], "below_only_on_the_lab_basis": [str(D[q]) for q in sorted(adj_days - raw_days)],
                 "episodes_first_pierce": [str(D[g[0][0]]) for g in raw_groups], "episodes_low_close_date": [str(D[min((q for a, b in g for q in range(a, b + 1)), key=lambda q: C[q])]) for g in raw_groups]}

    # ---- closes above the upper rail (1W B2 = 2W B2), and what followed each stretch ----------------------------------------------------
    over = [aC[i] > R1[i][0] for i in range(N)]; runs = []; i = life0
    while i < N:
        if over[i]:
            j = i
            while j + 1 < N and over[j + 1]: j += 1
            runs.append((i, j)); i = j + 1
        else: i += 1
    stretches = []; OVER_GAP = 10          # closes above the rail fewer than 10 sessions apart are one stretch
    for a, b in runs:
        if stretches and a - stretches[-1][-1][1] - 1 < OVER_GAP: stretches[-1].append((a, b))
        else: stretches.append([(a, b)])
    above_upper = []
    for gi, g in enumerate(stretches):
        a0, b1 = g[0][0], g[-1][1]; days_over = [q for a, b in g for q in range(a, b + 1)]
        kp = max(range(a0, b1 + 1), key=lambda q: aC[q]); kx = max(days_over, key=lambda q: aC[q] / R1[q][0])
        e = {"first_close_above": str(D[a0]), "last_close_above": str(D[b1]), "sessions_closed_above": len(days_over), "still_above_at_the_last_close": b1 == last,
             "furthest_above_pct": r((aC[kx] / R1[kx][0] - 1) * 100, 2), "furthest_above_date": str(D[kx]), "furthest_position_1W_B_pct": r((aC[kx] - R1[kx][2]) / (R1[kx][0] - R1[kx][2]) * 100, 1),
             "peak_close": r(aC[kp], 2), "peak_close_date": str(D[kp]), "peak_intraday_high": r(max(aH[a0:b1 + 1]), 2)}
        if b1 < last:
            end = stretches[gi + 1][0][0] - 1 if gi + 1 < len(stretches) else last
            kl = min(range(b1 + 1, end + 1), key=lambda q: aC[q]); kw = min(range(b1 + 1, end + 1), key=lambda q: aL[q])
            e["afterwards"] = {"window": f"{D[b1 + 1]} to {D[end]}", "lowest_close": r(aC[kl], 2), "lowest_close_date": str(D[kl]),
                               "fall_from_peak_close_pct": r((aC[kl] / aC[kp] - 1) * 100, 2), "sessions_peak_to_low": kl - kp,
                               "lowest_intraday": r(aL[kw], 2), "lowest_intraday_date": str(D[kw]), "fall_peak_high_to_low_pct": r((aL[kw] / max(aH[a0:b1 + 1]) - 1) * 100, 2),
                               "position_1W_B_at_low_pct": r((aC[kl] - R1[kl][2]) / (R1[kl][0] - R1[kl][2]) * 100, 1), "position_2W_B_at_low_pct": r((aC[kl] - R2[kl][2]) / (R2[kl][0] - R2[kl][2]) * 100, 1),
                               "low_vs_sma200_pct": r((aC[kl] / ma[kl] - 1) * 100, 2), "closed_below_sma200_in_window": any(below[q] for q in range(b1 + 1, end + 1)),
                               "sessions_low_back_to_the_rail": next((q - kl for q in range(kl + 1, N) if aC[q] > R1[q][0]), None)}
        above_upper.append(e)
    touched = [i for i in range(life0, N) if aH[i] >= R1[i][0]]
    posU = [(aC[i] - R1[i][2]) / (R1[i][0] - R1[i][2]) * 100 for i in range(N)]
    kn = max(range(life0, N), key=lambda q: posU[q])
    nearest = {"highest_close_position_1W_B_pct": r(posU[kn], 1), "date": str(D[kn]), "close": r(aC[kn], 2), "gap_to_rail_pct": r((R1[kn][0] / aC[kn] - 1) * 100, 2)}
    if kn < last:
        kl = min(range(kn + 1, N), key=lambda q: aC[q])
        nearest["afterwards"] = {"lowest_close": r(aC[kl], 2), "lowest_close_date": str(D[kl]), "fall_pct": r((aC[kl] / aC[kn] - 1) * 100, 2), "sessions": kl - kn,
                                 "position_1W_B_at_low_pct": r(posU[kl], 1), "low_vs_sma200_pct": r((aC[kl] / ma[kl] - 1) * 100, 2)}
    upper_rail = {"rail": "1W B2 = 2W B2", "stretches_of_closes_above": above_upper, "sessions_closed_above_total": sum(over[life0:]),
                  "sessions_the_high_reached_it": len(touched), "first_session_the_high_reached_it": str(D[touched[0]]) if touched else None,
                  "last_session_the_high_reached_it": str(D[touched[-1]]) if touched else None, "nearest_close": nearest}

    # ---- the 200-day's own pace (the Lab's strip cell uses two daily values only, so it swings with weekends) ----------------------------
    def ma_pace(n): return (ma[last] - ma[last - n]) / ((D[last] - D[last - n]).days / 7)
    ma_pace_out = {"last_5_sessions_usd_per_7d": r(ma_pace(5), 3), "last_20_sessions_usd_per_7d": r(ma_pace(20), 3), "last_60_sessions_usd_per_7d": r(ma_pace(60), 3),
                   "last_20_sessions_pct_of_close_per_7d": r(100 * ma_pace(20) / aC[last], 3), "last_20_sessions_multiple_of_channel_slope": r(ma_pace(20) / s1w, 2),
                   "lab_strip_cell_last_10_pairs_pct_per_7d": [{"through": str(D[i]), "days_between_the_two_values": (D[i] - D[i - 1]).days, "reads": f"{100 * ma_week(i) / aC[i]:+.2f}"} for i in range(last - 9, last + 1)]}

    # ---- the rebounds, summed up (small samples: every value is listed beside its median) ---------------------------------------------
    def col(key, field, clean=False):
        out = []
        for e in episodes:
            v = e["rebound"][key]
            if v is None or (clean and v["later_pierces_on_the_way"] > 0): continue
            out.append(v[field])
        return out
    def stat(vals, nd=2):
        vals = [v for v in vals if v is not None]
        return {"n": len(vals), "median": r(med(vals), nd), "min": r(min(vals), nd) if vals else None, "max": r(max(vals), nd) if vals else None, "values": [r(v, nd) for v in vals]}
    summary = {"episodes": len(episodes),
               "sessions_closed_below": stat([e["sessions_closed_below"] for e in episodes], 0),
               "max_depth_by_close_pct": stat([e["max_depth"]["by_close_pct"] for e in episodes]),
               "sessions_low_to_reclaim": stat([e["low"]["sessions_to_reclaim"] for e in episodes], 0),
               "rsi14_at_low": stat([e["oscillators_at_low"]["rsi14"] for e in episodes], 1), "williams14_at_low": stat([e["oscillators_at_low"]["williams14"] for e in episodes], 1)}
    for key in ("to_2W_B4_mid", "to_1W_B4_mid", "to_upper_touch", "first_20_sessions", "first_60_sessions"):
        summary[key] = {"sessions": stat(col(key, "sessions"), 0), "multiple_of_channel_slope": stat(col(key, "multiple_of_channel_slope")),
                        "usd_per_7d": stat(col(key, "usd_per_7d"), 3), "pct_per_month": stat(col(key, "pct_per_month")), "gain_pct": stat(col(key, "gain_pct")),
                        "uninterrupted_only": {"sessions": stat(col(key, "sessions", True), 0), "multiple_of_channel_slope": stat(col(key, "multiple_of_channel_slope", True))}}

    # ---- today's read ------------------------------------------------------------------------------------------------------
    px = aC[last]; U_now = R1[last][0]; room_usd = U_now - px; room_pct = (U_now / px - 1) * 100
    def sessions_at(pace_usd_7d):     # walk the calendar forward: price rises at the pace, the rail steps up once a week
        if room_usd <= 0: return 0
        if pace_usd_7d is None or pace_usd_7d <= s1w: return None
        d = D[last]; n = 0
        for _ in range(2000):
            d += dt.timedelta(days=1)
            if d.weekday() >= 5 or d in HOLIDAYS: continue
            n += 1
            if px + pace_usd_7d * (d - D[last]).days / 7 >= rails(c1, n1(d))[0]: return n
        return None
    def rail_catches_flat_price():   # price stands still at today's close; the rail steps up once a week
        if room_usd > 0: return None
        d = D[last]; n = 0
        for _ in range(2000):
            d += dt.timedelta(days=1)
            if d.weekday() >= 5 or d in HOLIDAYS: continue
            n += 1
            if rails(c1, n1(d))[0] > px: return {"sessions": n, "date": str(d), "rail_then": r(rails(c1, n1(d))[0], 2)}
        return None
    # the paces are MULTIPLES of the channel's own slope (a rebound at 340 and one at 630 are compared on the same footing), turned into
    # today's dollars with today's channel slope
    mults = [e["rebound"]["to_2W_B4_mid"]["multiple_of_channel_slope"] for e in episodes if e["rebound"]["to_2W_B4_mid"]]
    def mm(key): return med(col(key, "multiple_of_channel_slope"))
    cur = episodes[-1]["rebound"]["low_to_today"]
    paces = OrderedDict()
    paces["median rebound, low to the 2W B4 midline"] = mm("to_2W_B4_mid") * s1w
    paces["median rebound, low to the 1W B4 midline"] = mm("to_1W_B4_mid") * s1w
    paces["median rebound, first 60 sessions off the low"] = mm("first_60_sessions") * s1w
    paces["median rebound, low to the upper rail"] = mm("to_upper_touch") * s1w
    paces["this rebound's own pace since its low"] = cur["usd_per_7d"]
    paces["the last 20 sessions"] = (aC[last] - aC[last - 20]) / ((D[last] - D[last - 20]).days / 7)
    paces["slowest rebound to the 2W B4 midline"] = min(mults) * s1w
    paces["fastest rebound to the 2W B4 midline"] = max(mults) * s1w
    today = {"session": str(D[last]), "close": px, "sma200": r(ma[last], 3), "sma200_unadjusted_basis": r(ma_raw[last], 3), "pct_above_sma200": r((px / ma[last] - 1) * 100, 2),
             "pct_drop_to_sma200": r((ma[last] / px - 1) * 100, 2), "rsi14": r(rsi[last], 1), "rsi14_own_percentile": r(pct_rank(S_RSI, rsi[last]), 1),
             "williams14": r(wp[last], 1), "williams14_own_percentile": r(pct_rank(S_WPR, wp[last]), 1),
             "upper_rail": {"ids": "1W B2 / 2W B2 (coincide)", "level": r(U_now, 4), "room_pct": r(room_pct, 3), "room_usd": r(room_usd, 3), "rail_rises_usd_per_7d": r(s1w, 4)},
             "sessions_to_upper_rail": [{"pace": name, "usd_per_7d": r(v, 3), "multiple_of_channel_slope": r(v / s1w, 2) if v else None, "sessions": sessions_at(v)} for name, v in paces.items()],
             "if_price_stands_still_the_rail_passes_it": rail_catches_flat_price(),
             "distances_from_close_pct": {"to 1W B2 / 2W B2 (upper)": r(room_pct, 2), "to 1W B4 (mid)": r((R1[last][1] / px - 1) * 100, 2), "to 2W B4 (mid)": r((R2[last][1] / px - 1) * 100, 2),
                                          "to the 200-day": r((ma[last] / px - 1) * 100, 2), "to 1W B6 (lower)": r((R1[last][2] / px - 1) * 100, 2), "to 2W B6 (lower)": r((R2[last][2] / px - 1) * 100, 2)},
             "position_pct": {"1W B": r((px - R1[last][2]) / (R1[last][0] - R1[last][2]) * 100, 1), "2W B": r((px - R2[last][2]) / (R2[last][0] - R2[last][2]) * 100, 1)},
             "sessions_since_last_close_below_sma200": last - max(i for i in range(N) if below[i]),
             "median_rebound_multiple": r(med(mults), 2), "episodes_in_median": len(mults),
             "current_rebound": {"low_date": episodes[-1]["low"]["date"], "low_close": episodes[-1]["low"]["close"], **cur}}

    # ---- compact series for the pictures -----------------------------------------------------------------------------------
    s0 = max(0, life0 - 30)
    series = {"symbol": sym, "from": str(D[s0]), "to": str(D[last]), "life_start": str(D[life0]),
              "columns": ["date", "close", "high", "low", "sma200", "u", "m1", "l1", "m2", "l2", "rsi14", "williams14"],
              "rows": [[str(D[i]), r(aC[i], 3), r(aH[i], 3), r(aL[i], 3), r(ma[i], 3), r(R1[i][0], 3), r(R1[i][1], 3), r(R1[i][2], 3), r(R2[i][1], 3), r(R2[i][2], 3), r(rsi[i], 2), r(wp[i], 2)] for i in range(s0, N)],
              "future": []}
    d = D[last]
    for _ in range(140):          # the rails carried forward on their own clocks, for the dotted continuation
        d += dt.timedelta(days=1)
        if d.weekday() >= 5 or d in HOLIDAYS: continue
        a, b = rails(c1, n1(d)), rails(c2, n2(d)); series["future"].append([str(d), r(a[0], 3), r(a[1], 3), r(a[2], 3), r(b[1], 3), r(b[2], 3)])
    json.dump(series, open(os.path.join(DATA, f"series-{sym}.json"), "w"), separators=(",", ":"))
    for e in episodes:
        for key in ("_k", "_a0", "_b1"): e.pop(key)

    return {"symbol": sym, "feed": LAB["symbols"][sym]["feed"],
            "price_source": bars["meta"], "basis": {"study_runs_on": "the Lab's dividend-adjusted basis", "factor_known_from": str(first_known),
                                                     "dividend_factor_steps": [{"ex_date": str(s["from"]), "factor_from_here": r(s["factor"], 6), "implied_cash_dividend": s.get("implied_cash_dividend"), "pinned_by": s.get("pinned_by")} for s in seg[1:]],
                                                     "factor_before_first_step": r(seg[0]["factor"], 6), "parity_with_lab_bars": parity},
            "clock_check": clock, "channels": channels, "lab_slope_strip_reproduced": strip,
            "pierces": {"definition": f"a session whose close is under the 200-day average after a close at or above it; pierces fewer than {MERGE_GAP} sessions apart form one episode",
                        "count_pierces": len(dips), "count_episodes": len(episodes), "wick_only_sessions_not_counted": wick_only, "on_the_hub_price_basis": raw_basis},
            "episodes": episodes, "rebound_summary": summary, "upper_rail": upper_rail, "sma200_pace": ma_pace_out, "today": today,
            "oscillator_reference": {"rsi": f"Wilder RSI {RSI_N} of the close", "williams": f"Williams %R {WPR_N} (0 = at the 14-session high, -100 = at the 14-session low)",
                                     "own_percentile_over": {"sessions": len(S_RSI), "from": str(D[RSI_N]), "to": str(D[last])}, "channel_life_sessions": len(S_RSI_L)}}

out = {"schema": "scintilla.chn1.results.v1", "built_at": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
       "lab_sources": LAB["sources"], "settings": {"merge_gap_sessions": MERGE_GAP, "rsi": RSI_N, "williams": WPR_N, "month_days": MONTH_DAYS},
       "symbols": {s: study(s) for s in ("SPY", "QQQ")}}
json.dump(out, open(os.path.join(DATA, "results.json"), "w"), indent=1)

# ---- a readable dump -----------------------------------------------------------------------------------------------------------
for sym, S in out["symbols"].items():
    print("=" * 110); print(sym, "| parity", json.dumps(S["basis"]["parity_with_lab_bars"]), "| clocks ok:", S["clock_check"]["ok"])
    print(" strip:", S["lab_slope_strip_reproduced"]["B_2W_retained"]["reads"], S["lab_slope_strip_reproduced"]["B_1W_retained"]["reads"], S["lab_slope_strip_reproduced"]["SMA200_1D_live"]["reads"],
          "| prev pair:", S["lab_slope_strip_reproduced"]["SMA200_1D_live"]["previous_pair"]["reads_at_that_close"], "| 200-day pace:", json.dumps(S["sma200_pace"]))
    for c in S["channels"]:
        t = c["today"]; print(f" {c['name']}: U {t['upper']} M {t['mid']} L {t['lower']} | pos {t['position_pct_of_height']}% | to upper {t['move_to_upper_pct']}% | to mid {t['move_to_mid_pct']}% | to lower {t['move_to_lower_pct']}% |"
                              f" slope {c['slope']['usd_per_7d']} USD/7d = {c['slope']['pct_of_close_per_7d']}%/7d = {c['slope']['pct_of_close_per_month']}%/mo of close, {c['slope']['pct_of_mid_per_month']}%/mo of mid ({c['slope']['pct_of_close_per_year']}%/yr) | life {json.dumps(c['life'])}")
    print(" pierces:", S["pierces"]["count_pierces"], "episodes:", S["pierces"]["count_episodes"], "| hub basis:", json.dumps(S["pierces"]["on_the_hub_price_basis"]))
    for e in S["episodes"]:
        lo = e["low"]; o = e["oscillators_at_low"]; rb = e["rebound"]
        print(f"  [{e['label']}] first pierce {e['first_pierce']} · {len(e['pierces'])} pierces · {e['sessions_closed_below']} sessions below · reclaimed {e['back_above_for_good']}")
        print(f"     low {lo['date']} {lo['close']} ({lo['below_sma200_pct']}% vs 200d) depth close {e['max_depth']['by_close_pct']}% ({e['max_depth']['by_close_date']}) wick {e['max_depth']['by_intraday_low_pct']}% | pos 1W {lo['position_1W_B_pct']}% 2W {lo['position_2W_B_pct']}%"
              f" | RSI {o['rsi14']} (p{o['rsi14_own_percentile']}, life p{o['rsi14_percentile_channel_life']}) W%R {o['williams14']} (p{o['williams14_own_percentile']}) minRSI {o['lowest_rsi14_in_episode']} {o['lowest_rsi14_date']}")
        for k2 in ("to_2W_B4_mid", "to_1W_B4_mid", "to_upper_touch", "to_upper_close", "first_20_sessions", "first_60_sessions", "low_to_today"):
            v = rb[k2]; print(f"       {k2:<18}", "not reached" if v is None else f"{v['date']} · {v['sessions']} sessions · {v['gain_pct']:+}% · {v['usd_per_7d']} USD/7d = {v['multiple_of_channel_slope']}x · {v['pct_per_month']}%/mo · later pierces on the way {v['later_pierces_on_the_way']}")
    print(" SUMMARY", json.dumps(S["rebound_summary"]))
    print(" UPPER RAIL", json.dumps(S["upper_rail"]))
    t = S["today"]; print(" TODAY", json.dumps({k: v for k, v in t.items() if k not in ("sessions_to_upper_rail", "current_rebound")}))
    for p in t["sessions_to_upper_rail"]: print("    ", p)
    print("   wick-only:", S["pierces"]["wick_only_sessions_not_counted"])
