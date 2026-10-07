# GH1 · the Pine oscillator on a 30-MINUTE EXTENDED-HOURS chart, bar by bar, against the Hub's live rule worked out
# independently from the provider's own 3h / 4h / 6h / 12h bars (finished bars only at each moment; publisher's finality).
import json, numpy as np, pickle, time
import pine_port as PP, gh1_replay as G, recon_g2 as R
RES = pickle.load(open("replay.pkl", "rb")); LAT = json.load(open("lattice-survey.json"))["phase"]; H = 3600000.0; W = G.W
NH = {"3h": 3, "4h": 4, "6h": 6, "12h": 12}
def reference(sym, base, d):
    """The Hub's reading at the close of each 30-minute bar, from the provider's multi-hour bars."""
    z = np.load(f"bars/{sym}.npz"); o = RES[sym]; dt = d[:, 0]; t = base[:, 0]; T = t + 30 * 60000.0; n = len(base)
    i = np.searchsorted(dt, t, side="right") - 1; ok = (i >= 1) & (t < dt[np.maximum(i, 0)] + 24 * H)
    eve = T >= dt[np.maximum(i, 0)] + 20 * H; cash = t >= dt[np.maximum(i, 0)] + 16 * H
    dnew = np.where(cash | eve, i, i - 1)                                   # the newest finished daily bar
    snew = np.where(eve, i, i - 1)                                          # the evening the 3-day / weekly rungs stand at
    ws = np.zeros(n); cs = np.zeros(n); nr = np.zeros(n, dtype=int); dropped = np.zeros(n, dtype=bool)
    for r, nh in NH.items():
        b = z["tf_" + G.TFKEY[r]]; bt = b[:, 0]
        j = np.where(eve, np.searchsorted(bt, dt[np.maximum(i, 0)] + 20 * H, side="left") - 1, np.searchsorted(bt + nh * H, T, side="right") - 1)
        good = ok & (j >= G.NB - 1); jj = np.where(good, j, G.NB - 1); ii = jj[:, None] + np.arange(-G.NB + 1, 1)[None, :]
        tr, mo = R.read_windows(b[:, 4][ii], b[:, 2][ii], b[:, 3][ii])
        stale = bt[jj] < dt[np.maximum(dnew, 0)]                            # newest finished bar began before the daily reference day
        if r == "12h": dropped |= good & stale
        use = good & ~stale; rv = 0.5 * tr + 0.5 * mo
        ws += np.where(use, W[r], 0); cs += np.where(use, W[r] * rv, 0); nr += use
    for r, src in (("1d", dnew), ("3d", snew), ("1w", snew)):
        k = np.maximum(src, 0); tr = o["T_" + r][k]; mo = o["M_" + r][k]; rv = np.where(np.isnan(mo), tr, 0.5 * tr + 0.5 * mo); use = ok & np.isfinite(rv)
        ws += np.where(use, W[r], 0); cs += np.where(use, W[r] * np.nan_to_num(rv), 0); nr += use
    with np.errstate(invalid="ignore", divide="ignore"): g = np.where(ws > 0, cs / ws, np.nan)
    return g, nr, dropped, i
OUT = {}
for s in ["MU", "NVDA", "SPY"]:
    t0 = time.time(); base = np.load(f"base30/{s}.npy"); d = np.load(f"bars/{s}.npz")["tf_D"]; d = d[d[:, 0] <= base[-1, 0]]; o = RES[s]
    ga, fl = PP.intraday_chart(d, base, phase3=LAT[s], premarket="prev"); gb, _ = PP.intraday_chart(d, base, phase3=LAT[s], premarket="same")
    same = np.nanmax(np.abs(ga - gb)[np.isfinite(ga) & np.isfinite(gb)]); both = int((np.isfinite(ga) != np.isfinite(gb)).sum())
    ref, nr, dropped, di = reference(s, base, d); recent = base[:, 0] >= base[-1, 0] - 400 * 86400000.0
    res = {"premarket_mapping_max_difference": float(same), "bars_drawn_under_one_mapping_only": both}
    for name, mask in (("pre-market", fl == 1), ("regular hours", fl == 0), ("after hours, 12h rung present at the Hub", (fl == 2) & ~dropped), ("after hours, Hub leaves its 12h rung out (winter)", (fl == 2) & dropped), ("last bar of the day", fl == 3)):
        m = mask & recent & np.isfinite(ga) & np.isfinite(ref) & ((nr == 7) | dropped)
        if not m.any(): res[name] = {"bars": 0}; continue
        gap = np.abs(ga[m] - ref[m]); res[name] = {"bars": int(m.sum()), "exact_pct": round(float((gap < 1e-4).mean() * 100), 2), "mean_gap": round(float(gap.mean()), 5), "p99_gap": round(float(np.percentile(gap, 99)), 5), "max_gap": round(float(gap.max()), 4)}
    # the day's last bar against the replay's stored evening reading
    m = (fl == 3) & recent & np.isfinite(ga); gap = np.abs(ga[m] - o["g"][di[m]])
    res["last bar of the day vs the replay evening"] = {"bars": int(m.sum()), "exact_pct": round(float((gap < 1e-4).mean() * 100), 2), "max_gap": round(float(gap.max()), 5)}
    OUT[s] = res; print(s, round(time.time() - t0), "s"); [print("   ", k, v) for k, v in res.items()]
json.dump(OUT, open("pine-check-intraday.json", "w"), indent=1)
