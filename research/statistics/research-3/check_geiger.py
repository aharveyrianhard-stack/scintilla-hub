"""Prove the Python port equals the live publisher: replay SPY and QQQ's 7 rungs from the same bars and compare with /geiger detail (28 Sep 23:00Z)."""
import json, os, sys; sys.path.insert(0, os.path.dirname(__file__))
from lib import *
live = json.load(open(os.path.join(SCRATCH, "geiger_fut.json")))
rows = []
for sym in ("SPY", "QQQ"):
    readings = {}
    for k in TFW:
        df = bars(sym, TOKEN[k]); r = rung(df.c.values, df.h.values, df.l.values); readings[k] = r
        L = live["symbols"][sym]["rungs"][k]
        rows.append((sym, k, round(r["composite"], 6), L["tf_composite"], round(r["trend"], 4), L["trend_signed"], round(r["rsi"], 4), L["rsi14"], str(df.index[-1])))
    agg = composite(readings); print(sym, "port composite", round(agg["composite"], 6), "live", live["symbols"][sym]["composite"], "| trend", round(agg["trend"], 6), live["symbols"][sym]["trend"], "| mom", round(agg["momentum"], 6), live["symbols"][sym]["momentum"])
for r in rows: print(r)
