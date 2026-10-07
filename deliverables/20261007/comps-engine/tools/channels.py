# CP4 (7 Oct 2026) · THE LONG-TERM CHANNEL FOR EVERY NAME, from its own weekly bars — a stand-in where the Lab's reviewed rails
# are not on file. The channels study (deliverables/20261006/channels) reads the Indicator Lab's reviewed B2 / B4 / B6 rails,
# which exist for SPY and QQQ and a handful of names. For every other name this file draws the plainest long-term channel there
# is: a straight-line fit of the log weekly close over the last three years (156 bars, fewer when the name is younger, never
# under 78), with the rails at ± 2 standard deviations of the residuals. The place in it is the channels study's own measure,
# (close − lower rail) ÷ (upper rail − lower rail), on the 6 Oct close. Every reading SAYS it is computed, not reviewed.
# Reads the knockout's saved bars (bars/<T>.npz, tf_W = [t, o, h, l, c]); writes channels.json beside the run. No network.
import numpy as np, json, os, sys, math, datetime as dt
BARS = os.environ.get("CP4_BARS", "bars"); OUT = os.environ.get("CP4_CHANNELS_OUT", "channels.json"); TODAY = os.environ.get("CP4_TODAY", "2026-10-06")
N_MAX, N_MIN, SIG = 156, 78, 2.0
out = {"what": "a computed long-term channel per name: straight-line fit of the log weekly close over up to three years, rails at ±2 standard deviations; the place in it is (close − lower) ÷ (upper − lower). A stand-in for names without the Lab's reviewed rails — it says so on every reading.", "as_of": TODAY, "rule": {"bars": "weekly closes, the provider's own W bars, split-adjusted", "window_bars": N_MAX, "min_bars": N_MIN, "rails": "fit ± 2 σ of the log residuals"}, "names": {}}
cut = dt.datetime.strptime(TODAY, "%Y-%m-%d").timestamp() * 1000 + 86400e3
for f in sorted(os.listdir(BARS)):
    if not f.endswith(".npz"): continue
    t = f[:-4]
    try: z = np.load(os.path.join(BARS, f)); w = z["tf_W"] if "tf_W" in z.files else None
    except Exception as e: out["names"][t] = {"ok": False, "why": "bars could not be read"}; continue
    if w is None or len(w) < N_MIN: out["names"][t] = {"ok": False, "why": f"fewer than {N_MIN} weekly bars on file ({0 if w is None else len(w)})"}; continue
    w = w[w[:, 0] < cut]; w = w[-N_MAX:]
    if len(w) < N_MIN: out["names"][t] = {"ok": False, "why": f"fewer than {N_MIN} weekly bars before {TODAY}"}; continue
    c = w[:, 4]; ok = np.isfinite(c) & (c > 0); w, c = w[ok], c[ok]
    x = np.arange(len(c), dtype=float); y = np.log(c); A = np.vstack([x, np.ones_like(x)]).T
    (slope, icpt), *_ = np.linalg.lstsq(A, y, rcond=None); fit = slope * x + icpt; sd = float(np.std(y - fit))
    xe = len(c) - 1 + (dt.datetime.strptime(TODAY, "%Y-%m-%d").timestamp() * 1000 - w[-1, 0]) / (7 * 86400e3)   # the fit carried to today's date
    mid = math.exp(slope * xe + icpt); up = mid * math.exp(SIG * sd); lo = mid * math.exp(-SIG * sd)
    out["names"][t] = {"ok": True, "upper": round(up, 2), "mid": round(mid, 2), "lower": round(lo, 2), "slope_pct_year": round((math.exp(slope * 52) - 1) * 100, 1), "sigma_pct": round((math.exp(sd) - 1) * 100, 1), "bars": int(len(c)), "from": str(dt.datetime.utcfromtimestamp(w[0, 0] / 1000).date()), "to": str(dt.datetime.utcfromtimestamp(w[-1, 0] / 1000).date()), "source": "computed from its own weekly bars (not the Lab's reviewed rails)"}
json.dump(out, open(OUT, "w"))
print("channels:", sum(1 for v in out["names"].values() if v.get("ok")), "of", len(out["names"]), "→", OUT)
