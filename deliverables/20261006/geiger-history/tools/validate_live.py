# GH1 · does the replay's newest evening equal the Hub's live Geiger read the same evening? (live file saved 6 Oct 23:5x ET)
import json, numpy as np, time
from syms import ALL
import gh1_replay as G
live = json.load(open("geiger-live.json")); L = live["symbols"]
rows = []; t0 = time.time()
for s in ALL:
    try: o, why = G.replay(s)
    except Exception as e: o, why = None, "err " + str(e)[:80]
    if o is None: rows.append({"s": s, "why": why}); continue
    i = len(o["t"]) - 1; lv = L.get(s) or {}
    f, _ = G.replay(s, forming_slow=True)
    rows.append({"s": s, "date": o["date"][i], "g": float(o["g"][i]), "trend": float(o["trend"][i]), "mom": float(o["mom"][i]), "nr": int(o["nr"][i]),
                 "g_forming": float(f["g"][i]), "live": lv.get("composite"), "live_trend": lv.get("trend"), "live_mom": lv.get("momentum"), "live_n": lv.get("tf_contributors")})
json.dump({"live_computed_utc": live.get("computed_utc"), "rows": rows}, open("validate-live.json", "w"), indent=1)
ok = [r for r in rows if r.get("live") is not None and "g" in r]
gap = np.array([abs(r["g"] - r["live"]) for r in ok]); gt = np.array([abs(r["trend"] - r["live_trend"]) for r in ok]); gm = np.array([abs(r["mom"] - r["live_mom"]) for r in ok if r["live_mom"] is not None])
gf = np.array([abs(r["g_forming"] - r["live"]) for r in ok])
print("names", len(rows), "with live", len(ok), "no replay", [(r["s"], r["why"]) for r in rows if "why" in r], "not in live", [r["s"] for r in rows if "g" in r and r.get("live") is None], round(time.time() - t0), "s")
print("THIS replay vs live  : median %.7f  90th %.7f  max %.7f  | exact to 1e-5: %d of %d" % (np.median(gap), np.percentile(gap, 90), gap.max(), (gap < 1e-5).sum(), len(gap)))
print("   trend max %.7f  momentum max %.7f" % (gt.max(), gm.max()))
print("NQ1/SG1 variant vs live: median %.4f  90th %.4f  max %.4f  | exact to 1e-5: %d" % (np.median(gf), np.percentile(gf, 90), gf.max(), (gf < 1e-5).sum()))
for r in sorted(ok, key=lambda r: -abs(r["g"] - r["live"]))[:12]:
    print("  ", r["s"], r["date"], "replay %.6f live %.6f gap %.6f rungs %d/%s  forming-variant %.4f" % (r["g"], r["live"], r["g"] - r["live"], r["nr"], r["live_n"], r["g_forming"]))
