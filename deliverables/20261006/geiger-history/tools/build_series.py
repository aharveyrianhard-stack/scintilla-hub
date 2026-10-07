# GH1 · replays every name once and stores the daily Geiger series + each name's own-history percentiles.
import json, os, sys, time, numpy as np, pickle, datetime as dtm
from syms import ALL, COHORTS
import gh1_replay as G
t0 = time.time(); RES = {}; why = {}
for s in ALL:
    try: o, w = G.replay(s)
    except Exception as e: o, w = None, "err " + str(e)[:90]
    if o is None: why[s] = w; continue
    RES[s] = o
pickle.dump(RES, open("replay.pkl", "wb"), protocol=4)
print("replayed", len(RES), "skipped", why, round(time.time() - t0), "s")
