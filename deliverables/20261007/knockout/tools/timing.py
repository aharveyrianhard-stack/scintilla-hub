# KO1 · ROUND 3's readings — WHEN, never what — for every company, and each branch's own heat.
#   GEIGER      the live reading (chart API /geiger, read once after the 6 Oct close) and where it sits among the name's own
#               last 251 evenings (the Geiger-history study's replay of the Hub's seven rungs, run here for every company
#               and checked against the live reading: tools/geiger_replay.py).
#   LEVELS      the 21 / 50 / 100 / 200-day averages of completed daily closes; for the names the Lab has reviewed, its
#               lines with the Lab's own labels (the confluence study's read of the installed line packs).
#   ZONES       the confluence study's rule — two or more levels all within 1% of each other. For a reviewed name the zones
#               are that study's own; for every other name the same rule is run on its four averages.
#   COOL-DOWN   for a name whose Geiger is above its own 70th percentile: the close at which it would be back at its 70th
#               (and at its own median), found by replaying the Hub's own Geiger maths on one more session that ends at that
#               close. One session is the fastest way down; a slower drift cools at a HIGHER price because the averages
#               catch up. How well the one-session replay matched what really happened is measured and written beside it.
# Read-only: bars and the live reading already fetched to the scratch folder; the confluence study's file.
# Run from the scratch folder:   python3 <this file>
import json, os, sys, pickle, time, collections, datetime as dtm
import numpy as np
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
os.environ.setdefault("GH1_BARS", "bars")
import geiger_replay as G
TODAY = os.environ.get("KO1_TODAY", "2026-10-06"); YEAR = 251; HOT = 70.0; ZONE_PCT = 1.0; AVGS = (21, 50, 100, 200)
HOUR = 3600000.0; DAY = 86400000.0
def pctl_of(series, v):
    """Share of the name's own evenings that read below v, in percent."""
    a = np.asarray(series, dtype=float); a = a[np.isfinite(a)]
    return None if not len(a) or v is None else float((a < v).mean() * 100)
def read_of(t, m):
    """The allocation tool's own four-way read of trend and momentum (its readOf)."""
    if t is None or m is None: return {"q": "NO READ", "kind": "none", "words": "no read"}
    if t > 0 and m > 0: return {"q": "LEADING", "kind": "go", "words": "uptrend, confirmed"}
    if t > 0 and m <= 0: return {"q": "WEAKENING", "kind": "buy", "words": "pullback in an uptrend"}
    if t <= 0 and m > 0: return {"q": "IMPROVING", "kind": "improve", "words": "bounce in a downtrend"}
    return {"q": "LAGGING", "kind": "avoid", "words": "breakdown"}
def zones_of(levels, zone_pct=ZONE_PCT):
    """The confluence study's rule on a list of {label, level}: two or more levels all within zone_pct of each other
    (top no more than zone_pct above bottom), closest neighbours joined first. Returns the zones, low to high."""
    groups = [[x] for x in sorted(levels, key=lambda x: x["level"])]
    while True:
        best = None
        for i in range(len(groups) - 1):
            lo = groups[i][0]["level"]; hi = groups[i + 1][-1]["level"]; w = (hi / lo - 1) * 100
            gap = groups[i + 1][0]["level"] / groups[i][-1]["level"] - 1
            if w <= zone_pct and (best is None or gap < best[0]): best = (gap, i)
        if best is None: break
        i = best[1]; groups[i:i + 2] = [groups[i] + groups[i + 1]]
    return [{"low": g[0]["level"], "high": g[-1]["level"], "members": [m["label"] for m in g]} for g in groups if len(g) >= 2]
class _Z(dict):
    @property
    def files(self): return list(self.keys())
def replay_arrays(z):
    """The study's replay, on arrays in hand instead of a file (its own code, called unchanged)."""
    orig = G.np.load; G.np.load = lambda *a, **k: _Z(z)
    try: return G.replay("-")
    finally: G.np.load = orig
def last_reading(z):
    """The Geiger of the LAST session in the arrays only: the study's replay, line for line (its bar selection per rung,
    its read_at, its weights), asked for one evening instead of every evening. Equal to replay(...)["g"][-1]; that equality
    is checked on every name this file touches before a cool-down is trusted (see `same`)."""
    d = z["tf_D"]; dt = d[:, 0]; n = len(d); i = n - 1
    if n < 30: return None
    dord = G.day_ord(dt); T = {}; M = {}
    for r in G.INTRADAY:
        k = "tf_" + G.TFKEY[r]
        if k not in z: continue
        b = z[k]; t = b[:, 0]; ss = G.seg_start(t, G.TFKEY[r])
        j = int(np.searchsorted(t, dt[i] + 20 * HOUR, side="left") - 1); ok = j >= 0 and t[max(j, 0)] >= dt[i]
        tr, mo, _ = G.read_at(b[:, 4], b[:, 2], b[:, 3], np.array([j if ok else -1]), np.array([ss[max(j, 0)]])); T[r] = tr[0]; M[r] = mo[0]
    ss = G.seg_start(dt, "D"); tr, mo, _ = G.read_at(d[:, 4], d[:, 2], d[:, 3], np.array([i]), np.array([ss[i]])); T["1d"] = tr[0]; M["1d"] = mo[0]
    for r, wd in (("3d", 3), ("1w", 7)):
        k = "tf_" + G.TFKEY[r]
        if k not in z: continue
        b = z[k]; bd = G.day_ord(b[:, 0])
        if r == "3d": b, bd = G.fill_slow_from_daily(b, bd, d, dord, wd)
        ss = G.seg_start(b[:, 0], G.TFKEY[r]); lastsess = np.searchsorted(dord, bd + wd, side="left") - 1
        last = int(np.searchsorted(lastsess, i, side="right")) - 1; fresh = last >= 0 and (dord[i] - bd[max(last, 0)] <= 2 * wd + 5)
        tr, mo, _ = G.read_at(b[:, 4], b[:, 2], b[:, 3], np.array([last if fresh else -1]), np.array([ss[max(last, 0)]])); T[r] = tr[0]; M[r] = mo[0]
    ws = cs = 0.0
    for r in G.RUNGS:
        if r not in T or np.isnan(T[r]): continue
        ws += G.W[r]; cs += G.W[r] * (0.5 * T[r] + 0.5 * M[r] if not np.isnan(M[r]) else T[r])
    return float(cs / ws) if ws > 0 else None
def cut_to(z, n_sessions_back):
    """The arrays as they stood on the evening n sessions before the last one (0 = as they are)."""
    if n_sessions_back == 0: return {k: v for k, v in z.items()}
    d = z["tf_D"]; keep = d[:len(d) - n_sessions_back]; t_next = d[len(d) - n_sessions_back, 0]; o = {"tf_D": keep}
    for tf in ("180", "240", "6h", "12h"):
        if "tf_" + tf in z: b = z["tf_" + tf]; o["tf_" + tf] = b[b[:, 0] < t_next]
    last_ord = G.day_ord(keep[-1:, 0])[0]
    for tf, wd in (("3D", 3), ("W", 7)):
        if "tf_" + tf in z:
            b = z["tf_" + tf]; bd = G.day_ord(b[:, 0]); dord = G.day_ord(d[:, 0])
            lastsess = np.searchsorted(dord, bd + wd, side="left") - 1                      # the last session inside each bar
            o["tf_" + tf] = b[dord[np.maximum(lastsess, 0)] <= last_ord]
    return o
def one_more_session(z, P, keep=250):
    """One more session after the last, ending at P: a daily bar from the last close to P; the intraday rungs get the same
    number of bars the last session had, walking in a straight line to P; a 3-day bar is added only if that session is the
    last one inside it on the name's own calendar; the weekly rung stays as it is (the session is mid-week)."""
    d = z["tf_D"]; prev = d[-1, 4]; t1 = d[-1, 0] + DAY
    wk = dtm.datetime.utcfromtimestamp((t1 + 12 * HOUR) / 1000).weekday()
    if wk == 5: t1 += 2 * DAY                                                              # Friday's next session is Monday
    o = {"tf_D": np.vstack([d[-keep:, :5], [t1, prev, max(prev, P), min(prev, P), P]])}
    for tf in ("180", "240", "6h", "12h"):
        k = "tf_" + tf
        if k not in z: continue
        b = z[k][:, :5]; sess = b[(b[:, 0] >= d[-1, 0]) & (b[:, 0] < d[-1, 0] + 20 * HOUR)]; n = len(sess)
        if not n: o[k] = b[-keep:]; continue
        c = prev + (P - prev) * (np.arange(n) + 1) / n; op = np.r_[prev, c[:-1]]
        o[k] = np.vstack([b[-keep:], np.c_[sess[:, 0] + (t1 - d[-1, 0]), op, np.maximum(op, c), np.minimum(op, c), c]])
    if "tf_3D" in z:
        b = z["tf_3D"][:, :5]; bd = G.day_ord(b[:, 0]); start = bd[-1] + 3; d2 = o["tf_D"]; dord = G.day_ord(d2[:, 0]); new_ord = dord[-1]
        inside = (dord >= start) & (dord <= start + 2)
        if new_ord == start + 2 and inside.any():
            rows = d2[inside]; b = np.vstack([b, [(start) * DAY + 4 * HOUR, rows[0, 1], rows[:, 2].max(), rows[:, 3].min(), P]])
        o["tf_3D"] = b[-keep:]
    if "tf_W" in z: o["tf_W"] = z["tf_W"][-keep:, :5]
    return o
def g_after(z, P):
    return last_reading(one_more_session(z, P))
def cool_price(z, price, target, coarse=0.02, fine=0.005, max_drop=0.40):
    """The highest close of the next session at which the Geiger reads at or under `target`: walks down in 2% steps
    until it does, then in 0.5% steps inside that last step, then reads the crossing between the two closest closes."""
    g0 = g_after(z, price)
    if g0 is None: return None
    if g0 <= target: return {"price": float(price), "pct": 0.0, "g_flat": round(g0, 4), "note": "one flat session is enough"}
    hi_p, hi_g, k = price, g0, 1
    while k * coarse <= max_drop + 1e-9:
        p = price * (1 - k * coarse); g = g_after(z, p)
        if g is not None and g <= target: break
        if g is not None: hi_p, hi_g = p, g
        k += 1
    else: return {"price": None, "pct": None, "g_flat": round(g0, 4), "note": f"not within {int(max_drop * 100)}% in one session"}
    lo_p, lo_g = p, g; q = hi_p * (1 - fine)
    while q > lo_p * (1 + 1e-9):
        gq = g_after(z, q)
        if gq is not None and gq <= target: lo_p, lo_g = q, gq; break
        if gq is not None: hi_p, hi_g = q, gq
        q *= (1 - fine)
    f = (hi_g - target) / (hi_g - lo_g) if hi_g > lo_g else 1.0; x = hi_p + (lo_p - hi_p) * f
    return {"price": round(float(x), 2), "pct": round(float((x / price - 1) * 100), 2), "g_flat": round(g0, 4)}
if __name__ == "__main__":
    t0 = time.time()
    RES = pickle.load(open("replay.pkl", "rb")); LIVE = json.load(open("geiger-live.json")); LS = LIVE["symbols"]
    RAW = json.load(open("quotes-all-raw.json"))["quotes"]
    close_of = lambda t: (RAW.get(t) or {}).get("today_session_close") if (RAW.get(t) or {}).get("today_session_close_state") == "COMPLETED" and (RAW.get(t) or {}).get("today_session_et") == TODAY else None
    WT = os.path.abspath(os.path.join(HERE, "../../../..")); CZ_FILE = os.environ.get("KO1_CZ", "confluence-20261006.json")
    CZ = json.load(open(CZ_FILE)); CZR = CZ["results"]
    out = {}; gaps = []; ALLBELOW = {}
    for t, o in RES.items():
        lv = LS.get(t) or {}; live = lv.get("composite"); px = close_of(t)
        if live is None or px is None: continue
        dates = o["date"]; g = np.asarray(o["g"], dtype=float)
        idx = [i for i, dd in enumerate(dates) if dd < TODAY]; yr = g[idx][-YEAR:]; yr = yr[np.isfinite(yr)]
        e = {"geiger": {"live": round(live, 4), "trend": lv.get("trend"), "momentum": lv.get("momentum"), "rungs": lv.get("tf_contributors"), "read": read_of(lv.get("trend"), lv.get("momentum"))}}
        if dates[-1] == TODAY and np.isfinite(g[-1]): e["geiger"]["replay_gap"] = round(abs(float(g[-1]) - live), 4); gaps.append(e["geiger"]["replay_gap"])
        if len(yr) < 60: e["geiger"].update({"pctl": None, "why": f"only {len(yr)} evenings on file: too new for a place in its own year", "n": int(len(yr))})
        else: e["geiger"].update({"pctl": round(pctl_of(yr, live), 1), "n": int(len(yr)), "from": dates[idx[-len(yr)]] if len(idx) >= len(yr) else dates[0], "to": dates[idx[-1]],
                                  "p10": round(float(np.percentile(yr, 10)), 4), "p30": round(float(np.percentile(yr, 30)), 4), "p50": round(float(np.percentile(yr, 50)), 4), "p70": round(float(np.percentile(yr, 70)), 4), "p90": round(float(np.percentile(yr, 90)), 4), "min": round(float(yr.min()), 4), "max": round(float(yr.max()), 4)})
        # ---- levels: the four averages of completed daily closes (the last bar is the 6 Oct close)
        z = np.load(f"bars/{t}.npz"); d = z["tf_D"]; c = d[:, 4]
        lev = []; tech = {"close": px, "last_bar": G.iso(d[-1:, 0])[0], "sessions": int(len(c))}
        for n in AVGS:
            if len(c) >= n + 5:
                v = float(c[-n:].mean()); v5 = float(c[-n - 5:-5].mean()); tech[f"sma{n}"] = round(v, 4); tech[f"sma{n}_rising"] = bool(v > v5)
                lev.append({"label": f"{n}-day", "level": v, "kind": "average"})
        tech["hi_52w"] = float(max(d[-252:, 2].max(), px)); tech["from_high_pct"] = round((px / tech["hi_52w"] - 1) * 100, 1); tech["lo_52w"] = round(float(min(d[-252:, 3].min(), px)), 2)
        ret = np.diff(c) / c[:-1] * 100; tech["usual_day_60"] = round(float(ret[-60:].std(ddof=1)), 2) if len(ret) >= 60 else None
        cz = CZR.get(t) if (CZR.get(t) or {}).get("has_reviewed_lines") else None
        if cz:
            lines = [{"label": x["label"], "level": float(x["level"]), "kind": "line", "tf": x.get("tf")} for x in cz["levels_today"] if x.get("level") and x.get("family") == "line"]   # its averages are the same four computed above
            lev = lev + lines; e["reviewed"] = {"n": len(lines), "pack": cz.get("pack_version"), "as_of": cz.get("as_of_date"), "price_then": cz.get("price")}
            zs = [{"low": zz["low"], "high": zz["high"], "members": [m["label"] for m in zz["members"]], "source": "the confluence study"} for zz in cz["zones_today"]]
        else:
            e["reviewed"] = None; zs = [dict(zz, source="the same rule on its four averages") for zz in zones_of([x for x in lev if x["kind"] == "average"])]
        for x in lev: x["pct"] = round((x["level"] / px - 1) * 100, 2); x["level"] = round(x["level"], 2)
        for zz in zs: zz["low"] = round(zz["low"], 2); zz["high"] = round(zz["high"], 2); zz["pct"] = round(((zz["low"] + zz["high"]) / 2 / px - 1) * 100, 2); zz["side"] = "below" if zz["high"] < px else "above" if zz["low"] > px else "at"
        below = sorted([x for x in lev if x["level"] <= px], key=lambda x: -x["level"]); above = sorted([x for x in lev if x["level"] > px], key=lambda x: x["level"])
        e["tech"] = tech; e["below"] = below[:6]; e["above"] = above[:3]; ALLBELOW[t] = below; e["zones"] = sorted(zs, key=lambda q: -q["high"]); e["averages_below"] = [x for x in below if x["kind"] == "average"]
        out[t] = e
    gaps = np.array(gaps); print(f"timing for {len(out)} names · replay against the live reading: {int((gaps < 1e-4).sum())} of {len(gaps)} equal to four decimals, {int((gaps < 0.01).sum())} within 0.01, largest {gaps.max():.3f} · {round(time.time() - t0)}s", flush=True)
    # ---- cool-down for every company above its own 70th percentile
    COMP = set(json.load(open("comps-universe.json"))["names"].keys())
    hot = sorted([t for t, e in out.items() if t in COMP and e["geiger"].get("pctl") is not None and e["geiger"]["pctl"] > HOT], key=lambda t: -out[t]["geiger"]["pctl"])
    print("above their own 70th percentile:", len(hot), "companies", flush=True)
    errs = []; SAME = []
    for i, t in enumerate(hot):
        e = out[t]; z = dict(np.load(f"bars/{t}.npz")); z = {k: v[-520:] for k, v in z.items()}; px = e["tech"]["close"]; ge = e["geiger"]
        lr = last_reading(z); same = lr is not None and abs(lr - float(RES[t]["g"][-1])) < 1e-9; SAME.append(same)   # one evening equals the whole replay's last evening
        c70 = cool_price(z, px, ge["p70"]); c50 = cool_price(z, px, ge["p50"])
        # how well the one-session replay matches what really happened: the last 20 sessions, each replayed from the evening before
        bt = []
        for k in range(1, 21):
            try:
                zc = cut_to(z, k); zn = cut_to(z, k - 1); actual = last_reading(zn); sim = g_after(zc, float(zn["tf_D"][-1, 4]))
                if actual is not None and sim is not None: bt.append(abs(sim - actual))
            except Exception: pass
        e["cool"] = {"one_evening_equals_replay": bool(same), "to_70th": c70, "to_median": c50, "check_median_gap": round(float(np.median(bt)), 3) if bt else None, "check_p90_gap": round(float(np.percentile(bt, 90)), 3) if bt else None, "check_n": len(bt)}
        errs += bt
        for key in ("to_70th", "to_median"):
            c = e["cool"][key]
            if c and c.get("price"):
                allb = sorted(ALLBELOW[t], key=lambda x: abs(x["level"] - c["price"]))          # the named level nearest that close
                c["nearest_level"] = allb[0] if allb else None
        if (i + 1) % 20 == 0: print(f"  cool-down {i + 1} of {len(hot)} · {round(time.time() - t0)}s", flush=True)
    errs = np.array(errs) if errs else np.array([0.0])
    print("one evening read alone equals the whole replay's last evening:", sum(SAME), "of", len(SAME), flush=True)
    check = {"one_evening_equals_replay": [int(sum(SAME)), len(SAME)], "sessions": int(len(errs)), "median_gap": round(float(np.median(errs)), 3), "p90_gap": round(float(np.percentile(errs, 90)), 3), "max_gap": round(float(errs.max()), 3)}
    print("one-session replay against what really happened:", check, flush=True)
    json.dump({"today": TODAY, "year": YEAR, "hot_above": HOT, "zone_pct": ZONE_PCT, "geiger_published_utc": LIVE.get("published_utc"), "geiger_read_utc": LIVE.get("computed_utc"),
               "replay_check": {"names": int(len(gaps)), "equal_4dp": int((gaps < 1e-4).sum()), "within_0_01": int((gaps < 0.01).sum()), "max": round(float(gaps.max()), 4)},
               "cool_check": check, "confluence_file": {"generated_at": CZ.get("generated_at"), "names_with_lines": CZ.get("names_with_lines"), "pack": (CZ.get("sources") or {}).get("extract", {}).get("pack_version"), "approved_by_alan": (((CZ.get("sources") or {}).get("extract") or {}).get("installed_registry") or {}).get("visually_approved_by_alan")},
               "hot": hot, "names": out}, open("timing.json", "w"))
    print("DONE", len(out), "names ·", round(time.time() - t0), "s")
