#!/usr/bin/env python3
"""N1 · PULLBACK PLAYBOOK — saved chart images from data/pullback-playbook.json (no network, no database).
   python3 research/statistics/pullback-playbook/charts.py [--in FILE] [--out DIR]
Look rules (BRIEF-20260923-COMMON): dark panels, mono labels, no white; every grey keeps its channels within 24 of each other
and at or under 210; green/red only for direction (up/bull = green, down/bear = red). Every line is coloured by its own direction."""
import json, pathlib, sys, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
from matplotlib.collections import LineCollection

ROOT = pathlib.Path(__file__).resolve().parents[3]
args = sys.argv[1:]
IN = pathlib.Path(args[args.index("--in") + 1]) if "--in" in args else ROOT / "deliverables/20260928/pullback-playbook/data/pullback-playbook.json"
OUT = pathlib.Path(args[args.index("--out") + 1]) if "--out" in args else ROOT / "deliverables/20260928/pullback-playbook/charts"
OUT.mkdir(parents=True, exist_ok=True)
J = json.loads(IN.read_text())
BG, PANEL, GRID, AX, INK, DIM, MUTE = "#0A0A0F", "#0D0D14", "#1A1A26", "#3A3A4E", "#C4C4D2", "#8A8A9E", "#5A5A6E"
BULL, BEAR = "#00FFA3", "#FF2D55"
plt.rcParams.update({"figure.facecolor": BG, "axes.facecolor": PANEL, "axes.edgecolor": AX, "axes.labelcolor": INK, "text.color": INK,
    "xtick.color": DIM, "ytick.color": DIM, "grid.color": GRID, "font.family": "monospace", "font.size": 11, "axes.titlesize": 13,
    "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.grid": True, "grid.linewidth": 0.6, "savefig.facecolor": BG,
    "axes.spines.top": False, "axes.spines.right": False, "axes.axisbelow": True})
D = lambda s: dt.date.fromisoformat(s)
def dirline(ax, x, y, lw=1.5, alpha=1.0):
    xs = [mdates.date2num(v) if isinstance(v, dt.date) else v for v in x]
    pts = [(a, b) for a, b in zip(xs, y) if b is not None]
    segs = [[pts[i], pts[i + 1]] for i in range(len(pts) - 1)]
    cols = [BULL if pts[i + 1][1] >= pts[i][1] else BEAR for i in range(len(pts) - 1)]
    ax.add_collection(LineCollection(segs, colors=cols, linewidths=lw, alpha=alpha)); ax.autoscale_view()
    if x and isinstance(x[0], dt.date): ax.xaxis_date(); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
def bars_dir(ax, xs, ys, width=0.7, labels=None):
    ax.bar(xs, ys, width=width, color=[BULL if v >= 0 else BEAR for v in ys], edgecolor=AX, linewidth=0.4)
def save(fig, name, note, y=-0.035):
    fig.text(0.01, y, note, color=DIM, fontsize=8.5, ha="left", va="top")
    fig.savefig(OUT / name, dpi=110, bbox_inches="tight"); plt.close(fig); print("saved", name)
NOTE = f"Scintilla · N1 pullback playbook · bars to {J['asOf']} · research, not advice"

# c1 · the gauges today, as own-history percentiles
s1 = J["s1"]; an = s1["analogs"]
names = {"depth": "SPY depth from its 252-session high", "rsi": "SPY RSI(14)", "vix": "VIX level", "pcc": "put/call, 5-day average", "a50": "% of served names above the 50-day", "wing": "bow-tie wing (sector Geiger)", "sigma": "USUAL DAY net (up − down)"}
keys = [k for k in an["keys"] if an["today"].get(k) is not None]
fig, ax = plt.subplots(figsize=(11, 4.6))
vals = [an["today"][k] for k in keys]; ax.barh(range(len(keys)), vals, color=[BEAR if k in ("pcc", "a50", "sigma") and v < 50 or k in ("wing", "vix", "depth") and v > 50 else BULL for k, v in zip(keys, vals)], edgecolor=AX)
ax.set_yticks(range(len(keys))); ax.set_yticklabels([names[k] for k in keys]); ax.set_xlim(0, 100); ax.set_xlabel("own-history percentile today (1 = lowest ever, 100 = highest ever)"); ax.axvline(50, color=AX, lw=0.8)
for i, v in enumerate(vals): ax.text(min(v + 1, 96), i, f"{v:.0f}", va="center", color=INK, fontsize=10)
ax.set_title("Where this pullback is: seven gauges, each placed in its own history (28 Sep, live where known)")
save(fig, "c1-gauges-today.png", NOTE + " · red = the side that usually reads 'stretched' for that gauge")

# c2 · the depth ladder: given the pullback reached x, the final depth (median and 25–75 band) and the odds it goes 5 further
ld = s1["ladder"]["^GSPC"]; cur = ld["curve"]
fig, ax = plt.subplots(figsize=(11, 5))
xs = [r["x"] for r in cur if r.get("n", 0) >= 10]; med = [r["finalMed"] for r in cur if r.get("n", 0) >= 10]; q25 = [r["finalQ"][1] for r in cur if r.get("n", 0) >= 10]; q75 = [r["finalQ"][3] for r in cur if r.get("n", 0) >= 10]
ax.fill_between(xs, q25, q75, color=MUTE, alpha=0.35, label="middle half of episodes")
dirline(ax, xs, med, lw=2); ax.plot([], [], color=BULL, label="median final depth (line coloured by its own direction)")
ax.plot(xs, xs, color=AX, lw=0.8, ls="--", label="no further fall")
ax2 = ax.twinx(); ax2.grid(False); ax2.plot(xs, [r["pGoesOn5"] for r in cur if r.get("n", 0) >= 10], color=DIM, lw=1.2, ls=":", label="% that went at least 5 points deeper"); ax2.set_ylabel("% of episodes", color=DIM); ax2.set_ylim(0, 100)
ax.set_xlabel("closing depth already reached, % below the prior high"); ax.set_ylabel("final depth of the pullback, %"); ax.set_title(f"S&P 500 since {ld['from'][:4]}: once a pullback has reached x, how deep did it end? ({ld['episodes']} completed pullbacks)")
ax.legend(loc="upper left", fontsize=9, facecolor=PANEL, edgecolor=AX); ax2.legend(loc="lower right", fontsize=9, facecolor=PANEL, edgecolor=AX)
save(fig, "c2-depth-ladder.png", NOTE + " · every pullback from a closing high, 1927 →; the current one (from 13 Aug) is open and not counted")

# c3 · USUAL DAY net history with today
sg = s1["sigma"]; ser = sg["series"]
fig, ax = plt.subplots(figsize=(13, 4.2))
ax.bar([D(r[0]) for r in ser], [r[1] for r in ser], width=4, color=[BULL if r[1] >= 0 else BEAR for r in ser], linewidth=0)
ax.axhline(sg["today"]["net"], color=INK, lw=1, ls="--"); ax.text(D(ser[0][0]), sg["today"]["net"] - 1.2, f"today so far: 0 up / 20 down of 486 = {sg['today']['net']:.1f} (the {sg['todayNetPct']:.0f}th percentile)", color=INK, fontsize=9, va="top")
ax.set_ylabel("(up − down) ÷ names measured, %"); ax.set_title(f"USUAL DAY, every session since {sg['from']}: names beyond their usual day, up minus down")
save(fig, "c3-sigma-history.png", NOTE + " · public.sigma_day_counts (every third session drawn); today from the live detector at ~13:30 ET")

# c4 · analogs: what followed the 20 nearest days
v = an["variants"]["20"]; L = v["list"]
fig, axs = plt.subplots(1, 3, figsize=(13, 4.4))
for ax, key, ttl in zip(axs, ["moreDown60", "f63", "rspRel63"], ["further fall within 60 sessions, %", "SPY 63 sessions later, %", "equal weight minus SPY, 63 sessions, pts"]):
    ys = [x[key] for x in L if x[key] is not None]; xs = list(range(len(ys)))
    ax.bar(xs, ys, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=AX, linewidth=0.3)
    b = v["base"].get(key); 
    if b: ax.axhline(b["med"], color=DIM, lw=1, ls="--"); ax.text(0, b["med"], f" all days median {b['med']}", color=DIM, fontsize=8, va="bottom")
    ax.set_xticks(xs); ax.set_xticklabels([x["d"][2:7] for x in L if x[key] is not None], rotation=90, fontsize=7); ax.set_title(ttl, fontsize=11)
fig.suptitle("The 20 days most like today on the seven gauges, and what followed each", color=INK, fontweight="bold")
save(fig, "c4-analogs.png", NOTE + " · nearest by root-mean-square percentile distance; picks at least 40 sessions apart")

# c5 · bow-tie wing, daily, with its percentile
w = J["s2"]["wing"]; ser = w["series"]
fig, ax = plt.subplots(figsize=(13, 4.4))
dirline(ax, [D(r[0]) for r in ser], [r[1] for r in ser], lw=1.1); ax.axhline(w["medianWing"], color=DIM, lw=0.9, ls="--"); ax.text(D(ser[0][0]), w["medianWing"], f" median {w['medianWing']}", color=DIM, fontsize=9, va="bottom")
ax.set_ylabel("shorter wing (Geiger units)"); ax.set_title(f"The bow tie's shorter wing, every session since {w['from']} — today {w['today']['wing']} ({w['today']['pct']:.0f}th percentile)")
save(fig, "c5-wing-daily.png", NOTE + " · the sector-rotation lane's replay of the Hub's Geiger on the eleven SPDR sector funds (every fifth session drawn)")

# c6 · how the tie rebalanced by decile of wing percentile: which wing moved
dec = w["deciles"]
fig, axs = plt.subplots(1, 2, figsize=(13, 4.6))
xs = [r["decile"] for r in dec]
for ax, h in zip(axs, [16, 72]):
    g = [r[f"dGreen{h}"]["med"] if r.get(f"dGreen{h}") else 0 for r in dec]; rr = [r[f"dRed{h}"]["med"] if r.get(f"dRed{h}") else 0 for r in dec]; wg = [r[f"dWing{h}"]["med"] if r.get(f"dWing{h}") else 0 for r in dec]
    ax.bar([x - 0.22 for x in xs], g, width=0.42, color=[BULL if y >= 0 else BEAR for y in g], edgecolor=AX, label="green wing: change of its average Geiger")
    ax.bar([x + 0.22 for x in xs], rr, width=0.42, color=[BULL if y >= 0 else BEAR for y in rr], edgecolor=AX, hatch="//", label="red wing: change of its average Geiger")
    ax.plot(xs, wg, color=INK, lw=1.4, marker="o", ms=3, label="the wing itself (change)")
    ax.set_xticks(xs); ax.set_xlabel("decile of the wing's own percentile (10 = widest tenth)"); ax.set_title(f"{h} sessions later", fontsize=11); ax.axhline(0, color=AX, lw=0.8)
axs[0].legend(fontsize=8, facecolor=PANEL, edgecolor=AX, loc="upper right"); axs[0].set_ylabel("median change, Geiger units")
fig.suptitle("Which wing moves when a bow tie narrows: the red wing rises; the green wing barely moves", color=INK, fontweight="bold")
save(fig, "c6-which-wing.png", NOTE + " · medians per decile; the widest tenth's ranges are in the page's table")

# c7 · index-fund Geiger range
ir = J["s2"]["indexRange"]; ser = ir["series"]
fig, ax = plt.subplots(figsize=(13, 4.2))
dirline(ax, [D(r[0]) for r in ser], [r[1] for r in ser], lw=1.1)
for q, c in [(50, DIM), (90, MUTE)]: ax.axhline(ir["quantiles"][str(q)], color=c, lw=0.9, ls="--"); ax.text(D(ser[0][0]), ir["quantiles"][str(q)], f" {q}th pct {ir['quantiles'][str(q)]}", color=c, fontsize=8, va="bottom")
ax.set_ylabel("best minus worst Geiger, seven index funds"); ax.set_title(f"Index-fund Geiger range (SPY, QQQ, IWM, DIA, MDY, RSP, VTI) — today {ir['range']} ({ir['rangePct']:.0f}th percentile)")
save(fig, "c7-index-range.png", NOTE + " · replayed with the Hub's Geiger maths from the daily bars (every fifth session drawn)")

# c8 · the narrowness composite
s3 = J["s3"]; ser = s3["series"]
fig, ax = plt.subplots(figsize=(13, 4.2))
dirline(ax, [D(r[0]) for r in ser], [r[1] for r in ser], lw=1.1); ax.set_ylim(0, 100); ax.axhline(50, color=AX, lw=0.8)
ax.set_ylabel("narrowness, 0–100"); ax.set_title(f"NARROW: the mean of six percentile gauges — today {s3['today']['narrow']} ({s3['today']['pct']:.0f}th percentile of its own history)")
save(fig, "c8-narrowness.png", NOTE + " · components in the page's table; a reading needs at least three of the six")

# c9 · narrowness deciles → what followed
dec = s3["deciles"]; xs = [r["decile"] for r in dec]
fig, axs = plt.subplots(1, 3, figsize=(13, 4.2))
for ax, key, ttl in zip(axs, ["spy126", "rspMinusSpy126", "leadersMinusSpy126"], ["SPY, 126 sessions later, %", "equal weight minus SPY, 126 sessions, pts", "leaders basket minus SPY, 126 sessions, pts"]):
    ys = [r[key]["med"] if r.get(key) else 0 for r in dec]; ax.bar(xs, ys, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=AX); ax.set_xticks(xs); ax.set_xlabel("narrowness decile (10 = narrowest)"); ax.set_title(ttl, fontsize=10.5); ax.axhline(0, color=AX, lw=0.8)
fig.suptitle("After narrow readings the index did its usual thing and equal weight kept trailing: rebalancing, not catch-up", color=INK, fontweight="bold")
save(fig, "c9-narrow-followed.png", NOTE + " · medians per decile, 2008 →")

# c10 · tranche results: improvement, worst mark-to-cost, return at 126, time in market — per strategy, SPY and QQQ at 3%
s4 = J["s4"]; order = ["single", "dca", "fan", "pivots", "rsi", "all", "state"]
fig, axs = plt.subplots(2, 2, figsize=(13, 8))
for ax, key, ttl in zip(axs.flat, ["improvement", "worst126", "ret126", "tim"], ["average cost vs the trigger close, % (positive = cheaper)", "worst mark-to-cost within 126 sessions, %", "return on cost 126 sessions after the trigger, %", "time in market over the 60-session window, %"]):
    for k, (nm, off) in enumerate([("SPY", -0.2), ("QQQ", 0.2)]):
        B = s4["instruments"][nm]["byDepth"].get("3"); 
        if not B: continue
        ys = [(B["strategies"][s][key] or {}).get("med", 0) or 0 for s in order]
        ax.bar([i + off for i in range(len(order))], ys, width=0.38, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=AX, hatch="" if nm == "SPY" else "//", label=f"{nm} (n={B['n']})")
    ax.set_xticks(range(len(order))); ax.set_xticklabels(order); ax.set_title(ttl, fontsize=10.5); ax.axhline(0, color=AX, lw=0.8)
axs[0][0].legend(fontsize=9, facecolor=PANEL, edgecolor=AX)
fig.suptitle("Tranche campaigns triggered at 3% below the 252-session high: medians per strategy (hatched = QQQ)", color=INK, fontweight="bold")
save(fig, "c10-tranches.png", NOTE + " · unfilled money is bought at the window's close, so every strategy ends fully invested")

# c11 · by trigger depth: fan vs single, improvement and worst126 (SPY)
fig, axs = plt.subplots(1, 2, figsize=(13, 4.2))
B = s4["instruments"]["SPY"]["byDepth"]; depths = sorted(int(d) for d in B)
for ax, key, ttl in zip(axs, ["improvement", "worst126"], ["average cost vs trigger, % — SPY", "worst mark-to-cost within 126 sessions, % — SPY"]):
    for j, (s, hb) in enumerate(zip(["dca", "fan", "rsi", "state"], ["", "//", "..", "xx"])):
        ys = [(B[str(d)]["strategies"][s][key] or {}).get("med", 0) or 0 for d in depths]
        ax.bar([i + (j - 1.5) * 0.2 for i in range(len(depths))], ys, width=0.19, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=INK, linewidth=0.5, hatch=hb)
        ax.bar([0], [0], color=PANEL, edgecolor=INK, hatch=hb, label=s)
    if key == "worst126": ax.plot(range(len(depths)), [(B[str(d)]["strategies"]["single"][key] or {}).get("med") for d in depths], color=INK, marker="o", lw=1.2, label="single entry")
    ax.set_xticks(range(len(depths))); ax.set_xticklabels([f"{d}%\nn={B[str(d)]['n']}" for d in depths]); ax.set_xlabel("campaign trigger: depth below the 252-session high"); ax.set_title(ttl, fontsize=10.5); ax.axhline(0, color=AX, lw=0.8)
axs[0].legend(fontsize=8, facecolor=PANEL, edgecolor=AX)
save(fig, "c11-by-depth.png", NOTE + " · medians; the deeper the trigger, the fewer campaigns; colour = sign, hatch = strategy", y=-0.09)

# c12 · the worked example
ex = s4.get("example")
if ex:
    fig, ax = plt.subplots(figsize=(13, 5.2)); W = ex["window"]; xs = [D(r[0]) for r in W]
    dirline(ax, xs, [r[1] for r in W], lw=1.6)
    for j, (lab, c) in enumerate([("e8", DIM), ("e21", DIM), ("s50", MUTE), ("s100", MUTE), ("s200", MUTE), ("w200", MUTE)]):
        ys = [r[3 + j] for r in W]; 
        if any(y is not None for y in ys): dirline(ax, xs, ys, lw=0.7, alpha=0.55); ax.text(xs[-1], [y for y in ys if y is not None][-1], " " + lab, color=DIM, fontsize=8, va="center")
    for f in ex["fills"]: ax.scatter([D(f["d"])], [f["px"]], s=46 if not f["forced"] else 22, color=BULL if not f["forced"] else BEAR, marker="^" if not f["forced"] else "x", zorder=5)
    ax.scatter([], [], color=BULL, marker="^", label="tranche filled at its level"); ax.scatter([], [], color=BEAR, marker="x", label="unfilled at 60 sessions: bought at that close")
    ax.axvline(D(ex["d"]), color=INK, lw=0.8, ls="--"); ax.text(D(ex["d"]), max(r[1] for r in W), f" trigger {ex['d']} at {ex['trigger']}; average cost {ex['avgCost']}", color=INK, fontsize=9, va="top")
    ax.legend(fontsize=9, facecolor=PANEL, edgecolor=AX, loc="lower right"); ax.set_title("A worked campaign on SPY: every level (fan + pivots + RSI rungs) after the 3% trigger of " + ex["d"])
    save(fig, "c12-example.png", NOTE + " · the fan lines drawn are the ones known at each open; thirteen rungs, four filled at levels")

# c13 · Wednesday: MU reaction days and PCE days, SPY's move, in and out of pullbacks
s5 = J["s5"]; rows = s5["mu"]["rows"]
fig, axs = plt.subplots(1, 2, figsize=(13, 4.4))
ax = axs[0]; ys = [r["spy"] for r in rows]; ax.bar(range(len(rows)), ys, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=AX, linewidth=0.3)
for i, r in enumerate(rows):
    if r["inPullback3"]: ax.plot([i], [0], marker="|", color=INK, ms=8)
ax.set_xticks(range(0, len(rows), 4)); ax.set_xticklabels([rows[i]["reactionDay"][:7] for i in range(0, len(rows), 4)], rotation=90, fontsize=7); ax.set_title(f"SPY on MU's reaction day, {len(rows)} reports (tick = SPY was ≥3% off its high)", fontsize=10.5)
ax = axs[1]; pr = s5["pce"]["rows"]; ys = [r["move"] for r in pr]; ax.bar(range(len(pr)), ys, color=[BULL if y >= 0 else BEAR for y in ys], edgecolor=AX)
for i, r in enumerate(pr):
    if r["inPullback3"]: ax.plot([i], [0], marker="|", color=INK, ms=8)
ax.set_xticks(range(len(pr))); ax.set_xticklabels([r["d"][2:7] for r in pr], rotation=90, fontsize=7); ax.set_title(f"SPY on PCE day, the {len(pr)} releases on file (from Jun 2024)", fontsize=10.5)
save(fig, "c13-wednesday.png", NOTE + " · MU: 8 dated calls + reaction days inferred from volume before Sep 2024 (marked in the table)")
print("done")
