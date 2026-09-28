#!/usr/bin/env python3
"""U2 · SECTOR ROTATION — saved chart images from sector-rotation.json (no network, no database).
   python3 research/statistics/sector-rotation/charts.py
Look rules (BRIEF-20260923-COMMON): dark panels, mono labels, no white; every grey keeps its channels within 24 of each
other and at or under 210; green/red only for direction (up/bull = green, down/bear = red)."""
import json, pathlib, datetime as dt
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.dates as mdates

ROOT = pathlib.Path(__file__).resolve().parents[3]
OUT = ROOT / "deliverables/20260928/sector-rotation"
J = json.loads((OUT / "sector-rotation.json").read_text())
BG, PANEL, GRID, AX, INK, DIM = "#0A0A0F", "#0D0D14", "#1A1A26", "#3A3A4E", "#C4C4D2", "#8A8A9E"
BULL, BEAR = "#00FFA3", "#FF2D55"
GREYS = ["#C4C4D2", "#8A8A9E", "#5A5A6E"]
plt.rcParams.update({"figure.facecolor": BG, "axes.facecolor": PANEL, "axes.edgecolor": AX, "axes.labelcolor": INK,
    "text.color": INK, "xtick.color": DIM, "ytick.color": DIM, "grid.color": GRID, "font.family": "monospace", "font.size": 11,
    "axes.titlesize": 13, "axes.titleweight": "bold", "axes.titlecolor": INK, "axes.grid": True, "grid.linewidth": 0.6,
    "savefig.facecolor": BG, "axes.spines.top": False, "axes.spines.right": False, "axes.axisbelow": True})
from matplotlib.collections import LineCollection
import matplotlib.dates as _md
def dirline(ax, x, y, lw=1.6, alpha=1.0):
    """House rule: no grey lines. Each segment is green when the line rises and red when it falls."""
    xs = [_md.date2num(v) if isinstance(v, dt.date) else v for v in x]
    pts = [(a, b) for a, b in zip(xs, y) if b is not None]
    segs = [[pts[i], pts[i + 1]] for i in range(len(pts) - 1)]
    cols = [BULL if pts[i + 1][1] >= pts[i][1] else BEAR for i in range(len(pts) - 1)]
    ax.add_collection(LineCollection(segs, colors=cols, linewidths=lw, alpha=alpha)); ax.autoscale_view()
D = lambda s: dt.date.fromisoformat(s)
tone = lambda v: BULL if v >= 0 else BEAR
MK = {"o": "●", "s": "■", "^": "▲"}
saved = []
def save(fig, name):
    fig.savefig(OUT / name, dpi=110, bbox_inches="tight"); plt.close(fig); saved.append(name)

# 1 · the four strips today, as the Hub draws them (sorted bull → bear, autoscaled)
G = J["geiger"]; fams = G["familiesToday"]
fig, axs = plt.subplots(1, 4, figsize=(16, 4.4))
for ax, (f, lab) in zip(axs, [("SPDR", "SPDR"), ("ISHARES", "iSHARES"), ("VANGUARD", "VANGUARD"), ("EQWT", "EQUAL-WT")]):
    rows = fams[f]["funds"]; v = [r["live"] for r in rows]; span = max(abs(x) for x in v)
    ax.bar(range(len(v)), v, color=[tone(x) for x in v], width=0.62)
    ax.axhline(0, color=AX, lw=1); ax.set_ylim(-span * 1.15, span * 1.15)
    ax.set_xticks(range(len(v))); ax.set_xticklabels([r["sym"] for r in rows], rotation=90, fontsize=9)
    ax.set_title(f"{lab} · wing {fams[f]['wingLive']:+.2f}", fontsize=12); ax.grid(axis="x", visible=False)
axs[0].set_ylabel("live Geiger composite")
fig.suptitle(f"Sector compare today (live /geiger, {G['replayCheck']['liveComputedUtc'][:16]}Z) · bull ◂ ▸ bear", color=INK, x=0.01, ha="left", fontsize=13)
fig.tight_layout(); save(fig, "c1-strips-today.png")

# 2 · the shorter wing through history, with today's level and past episodes
ws = G["wingSeries"]; x = [D(r[0]) for r in ws]; w = [r[1] for r in ws]
fig, ax = plt.subplots(figsize=(15, 4.6))
ax.fill_between(x, 0, w, where=[v >= 0 for v in w], color=BULL, lw=0, alpha=0.45)
ax.fill_between(x, 0, w, where=[v < 0 for v in w], color=BEAR, lw=0, alpha=0.45)
lvl = G["today"]["wing"]; ax.axhline(lvl, color=INK, lw=1, ls=(0, (4, 3)))
ax.text(x[0], lvl + 0.03, f"today {lvl:+.2f} · own-history percentile {G['today']['wingPct']}", color=INK, fontsize=10)
for e in G["episodes"]: ax.plot([D(e["start"])], [e["peakWing"]], "v", color=INK, ms=7)
ax.axhline(0, color=AX, lw=1); ax.set_ylabel("shorter wing (Geiger units)")
ax.set_title("How much bow tie: the shorter wing of the SPDR strip (green = both wings present, red = one-sided) · ▼ = the 10 past episodes as wide as today")
ax.xaxis.set_major_locator(mdates.YearLocator(2)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
fig.tight_layout(); save(fig, "c2-wing-history.png")

# 3 · the last 78 weeks of SPDR Geiger: which sectors sat on which wing
rw = G["recentWeeks"]; syms = [o["sym"] for o in G["today"]["order"]]
import numpy as np
M = np.array([[r["g"].get(s) if r["g"].get(s) is not None else np.nan for r in rw] for s in syms])
from matplotlib.colors import LinearSegmentedColormap
cmap = LinearSegmentedColormap.from_list("gr", [BEAR, "#2A2A36", BULL])
fig, ax = plt.subplots(figsize=(15, 4.8))
im = ax.imshow(M, aspect="auto", cmap=cmap, vmin=-1, vmax=1, interpolation="nearest")
ax.set_yticks(range(len(syms))); ax.set_yticklabels(syms)
ticks = list(range(0, len(rw), 6)); ax.set_xticks(ticks); ax.set_xticklabels([rw[i]["d"] for i in ticks], rotation=45, fontsize=9, ha="right")
ax.grid(False); cb = fig.colorbar(im, ax=ax, fraction=0.02, pad=0.01); cb.set_label("Geiger (replayed, 1d/3d/1w rungs)")
ax.set_title("SPDR sector Geiger, last 78 weeks (rows in today's order, best at the top)")
fig.tight_layout(); save(fig, "c3-recent-weeks.png")

# 4 · rank persistence against lag, three horizons
RS = J["relativeStrength"]
fig, ax = plt.subplots(figsize=(12, 4.6))
ax.set_xscale("log")
for (k, v), mk, dy in zip(RS.items(), ["o", "s", "^"], [-0.05, 0.05, 0.0]):
    lags = [p["lag"] for p in v["persist"]]; m = [p["mean"] for p in v["persist"]]
    dirline(ax, lags, m, lw=2); ax.plot(lags, m, mk, color=INK, ms=4, ls="none")
    ax.text(lags[-1] * 1.08, m[-1] + dy, f"{MK[mk]} {k} ({v['h']})", color=INK, va="center")
    ax.axvline(v["h"], color=AX, lw=0.8, ls=":")
ax.set_xlim(0.8, 3000); ax.axhline(0, color=AX, lw=1); ax.set_xlabel("sessions later (log scale)"); ax.set_ylabel("rank correlation")
ax.set_title("Does a sector's relative-strength rank survive? Mean rank correlation between today and N sessions later")
fig.tight_layout(); save(fig, "c4-persistence.png")

# 5 · transitions (tier today → tier one horizon later)
fig, axs = plt.subplots(1, 3, figsize=(14, 4.2))
T = ["TOP", "MID", "BOTTOM"]
for ax, (k, v) in zip(axs, RS.items()):
    P = np.array([[v["transitions"][a][b] for b in T] for a in T])
    ax.imshow(P, cmap=LinearSegmentedColormap.from_list("g", ["#15151E", "#8A8A9E"]), vmin=0.2, vmax=0.5)
    for i in range(3):
        for j in range(3): ax.text(j, i, f"{100 * P[i, j]:.0f}%", ha="center", va="center", color=INK if P[i, j] < 0.38 else BG, fontsize=12)
    ax.set_xticks(range(3)); ax.set_xticklabels(T); ax.set_yticks(range(3)); ax.set_yticklabels(T); ax.grid(False)
    ax.set_xlabel(f"tier {v['h']} sessions later"); ax.set_title(f"{k} ({v['h']} sessions)")
axs[0].set_ylabel("tier today")
fig.suptitle("Relative-strength tier today → tier over the next equal period (thirds of the eleven SPDRs); a coin would be 33%", color=INK, x=0.01, ha="left")
fig.tight_layout(); save(fig, "c5-transitions.png")

# 6 · RRG today (medium), with 60-session tails
R = J["rrg"]["medium"]
fig, ax = plt.subplots(figsize=(10, 8))
for t in R["today"]:
    tail = [p for p in R["tails"][t["sym"]] if p[0] is not None][-6:]   # the last ~15 sessions, every 3rd
    xs, ys = [p[0] for p in tail], [p[1] for p in tail]
    col = BULL if t["quad"] == "LEADING" else BEAR if t["quad"] == "LAGGING" else INK
    segs = [[(xs[i], ys[i]), (xs[i + 1], ys[i + 1])] for i in range(len(xs) - 1)]
    ax.add_collection(LineCollection(segs, colors=[BULL if xs[i + 1] >= xs[i] else BEAR for i in range(len(xs) - 1)], linewidths=1.2, alpha=0.7))
    ax.plot(xs[-1], ys[-1], "o", color=col, ms=9, mfc=col if t["quad"] in ("LEADING", "LAGGING") else BG, mec=col)
    ax.annotate(t["sym"], (xs[-1], ys[-1]), textcoords="offset points", xytext=(6, 4), color=INK, fontsize=10)
ax.axhline(0, color=AX, lw=1); ax.axvline(0, color=AX, lw=1); ax.margins(0.12)
lim = ax.get_xlim(), ax.get_ylim()
for (qx, qy, lab) in [(1, 1, "LEADING"), (1, -1, "WEAKENING"), (-1, -1, "LAGGING"), (-1, 1, "IMPROVING")]:
    ax.text(0.97 if qx > 0 else 0.03, 0.97 if qy > 0 else 0.03, lab, transform=ax.transAxes, ha="right" if qx > 0 else "left", va="top" if qy > 0 else "bottom", color=DIM, fontsize=11)
ax.set_xlabel(f"RS vs its own {R['h']}-session trend (%)"); ax.set_ylabel("turn in that trend (%)")
ax.set_title(f"Rotation map, medium horizon ({R['h']} sessions) · tails = last ~15 sessions (green = RS rising, red = falling)")
fig.tight_layout(); save(fig, "c6-rrg-medium.png")

# 7 · dispersion (short horizon) through history
ds = RS["short"]["dispersion"]["series"]; x = [D(r[0]) for r in ds]; y = [r[1] for r in ds]
fig, ax = plt.subplots(figsize=(15, 4.2))
dirline(ax, x, y, lw=0.9)
ax.axhline(RS["short"]["dispersion"]["spreadNow"], color=INK, lw=1, ls=(0, (4, 3)))
ax.text(x[0], RS["short"]["dispersion"]["spreadNow"] * 1.04, f"today {RS['short']['dispersion']['spreadNow']:.1f} pts · percentile {RS['short']['dispersion']['spreadPct']}", color=INK, fontsize=10)
ax.set_ylabel("best − worst, 16-session RS (pts)"); ax.set_yscale("log")
ax.set_title("Sector dispersion, short horizon: the gap between the best and worst of the nine original SPDRs vs SPY")
ax.xaxis.set_major_locator(mdates.YearLocator(2)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
fig.tight_layout(); save(fig, "c7-dispersion.png")

# 8 · equal weight vs cap weight (RSP − SPY, cumulative log points)
cw = J["capVsEqual"]["RSPvsSPYpath"]; x = [D(r[0]) for r in cw]; y = [r[1] for r in cw]
fig, ax = plt.subplots(figsize=(15, 4.2))
dirline(ax, x, y, lw=1.4); ax.axhline(0, color=AX, lw=1)
ax.set_ylabel("RSP − SPY, cumulative (log pts)")
ax.set_title("Equal weight against cap weight since 2003 (price only): up = the average stock beating the index")
ax.xaxis.set_major_locator(mdates.YearLocator(2)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
fig.tight_layout(); save(fig, "c8-rsp-spy.png")

# 9 · what followed, across the whole range of the wing (tenths of its own history)
F = G["followed"]
fig, axs = plt.subplots(1, 2, figsize=(15, 4.4))
for ax, key, lab in [(axs[0], "spy", "SPY return (%)"), (axs[1], "wingSpread", "green wing − red wing, relative return (pts)")]:
    for (h, v), mk in zip(F.items(), ["o", "s", "^"]):
        b = v["byWingPct"]; xs = [(r["from"] + r["to"]) / 2 for r in b]; ys = [r[key] for r in b]
        dirline(ax, xs, ys, lw=2); ax.plot(xs, ys, mk, color=INK, ms=5, ls="none"); ax.text(xs[-1] + 2, ys[-1], f"{h} sessions", color=INK, va="center")
    ax.set_xlim(0, 108)
    ax.axhline(0, color=AX, lw=1); ax.set_xlabel("wing's own-history percentile (tenths)"); ax.set_ylabel(lab)
axs[0].set_title("SPY afterwards, by how wide the tie was"); axs[1].set_title("Did the green wing keep beating the red wing?")
fig.suptitle("Mean outcome over the next 16 / 38 / 72 sessions (marker = horizon), all days since 2007-07", color=INK, x=0.01, ha="left")
fig.tight_layout(w_pad=4); save(fig, "c9-followed.png")

(OUT / "charts.json").write_text(json.dumps({"charts": saved}, indent=1))
print("saved", len(saved), "charts:", ", ".join(saved))
