"""Runs the round's arithmetic on small hand-made inputs and saves the answers to data/fixtures.json.
tests/research-round-2-20260928.test.mjs holds the answers worked out by hand and checks these against them."""
import numpy as np, pandas as pd
import rr_lib as L, p4_volsize as P4, p5_trend as P5, p7_drawdown as P7, p10_breadth as P10

d = pd.date_range("2020-01-01", periods=11, freq="B")
out = {}
# P7 · drawdown spells: 100 → 80 (−20%) back to 101, then 101 → 50 (open)
out["spells"] = P7.spells(pd.Series([100, 90, 80, 95, 101, 100, 70, 60, 65, 50, 55], index=d, dtype=float))
# P7 · Kaplan–Meier with one censored duration
out["km"] = P7.km([10, 20, 30, 40], [True, False, True, True], [5, 15, 25, 35, 45]).tolist()
# P10 · thrust: below 0.40 then above 0.615 within 3 sessions; the day after a fire does not fire again
s = pd.Series([0.5, 0.35, 0.5, 0.62, 0.63, 0.3, 0.7], index=d[:7])
out["thrust"] = P10.thrust(s, 0.40, 0.615, 3).tolist()
# P10 · hold h sessions after a fire (fire at close 2 → long the returns of sessions 3, 4, 5)
out["hold"] = P10.hold(pd.Series([0, 0, 1, 0, 0, 0, 0, 0], dtype=bool), 3).tolist()
# P10 · declustering: fires 0, 30, 70 with a 60-session gap → 0 and 70 survive? (70 − 30 = 40 ≤ 60, so 70 is suppressed too)
f = pd.Series(False, index=range(150)); f.iloc[[0, 30, 70, 140]] = True
out["decluster"] = [int(i) for i in np.where(P10.decluster(f, 60).values)[0]]
# P4 · evaluate: weight known at close t earns r_{t+1}; the first trade is the whole first weight; 5 bps per unit traded
r = pd.Series([0.01, -0.02, 0.03], index=d[:3]); w = pd.Series([0.5, 1.0, 1.0], index=d[:3])
net, pos, trade = P4.evaluate(r, w)
out["p4_net"] = [round(x, 8) for x in net.tolist()]; out["p4_trade"] = trade.tolist()
# P4 · the headline weight: usual ÷ recent, capped at 1
out["p4_weight"] = [min(1.0, 12.6 / 10.8), min(1.0, 18.0 / 24.0)]
# P5 · the 200-day ±2% band holds its state inside the band
c = pd.Series(np.r_[np.full(200, 100.0), [101.0, 103.0, 101.0, 97.0, 99.0]], index=pd.date_range("2019-01-01", periods=205, freq="B"))
out["band"] = P5.positions(c)["200-day ±2% band"].iloc[199:].tolist()
# drawdown and CAGR helpers
out["max_dd"] = round(L.max_dd(pd.Series([0.1, -0.5, 0.2])), 6)
L.dump("fixtures.json", out)
print(out)
