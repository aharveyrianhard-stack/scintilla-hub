#!/usr/bin/env python3
"""PB1 pictures for the relaunch studies and the open-model trials. Same house rules as charts.py:
greys for ink and reference marks, green = up / good outcome, red = down / bad outcome, direct labels, one axis per chart."""
import json, os, sys, numpy as np, pandas as pd, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(HERE, "..", "charts"); M = os.path.join(DATA, "models")
BG="#0b0b0e"; PANEL="#121216"; LINE="#2a2a30"; INK="#d2d2d2"; INK2="#b4b4b8"; INK3="#8c8c92"; GREEN="#2e9c5a"; RED="#c6413f"
plt.rcParams.update({"figure.facecolor":BG,"axes.facecolor":PANEL,"axes.edgecolor":LINE,"axes.labelcolor":INK2,"xtick.color":INK3,"ytick.color":INK2,"text.color":INK,
  "font.family":"monospace","font.size":10,"axes.grid":True,"axes.axisbelow":True,"grid.color":LINE,"grid.linewidth":0.6,"axes.spines.top":False,"axes.spines.right":False,"savefig.facecolor":BG,"savefig.dpi":110})
X = json.load(open(os.path.join(DATA, "extra.json")))
def title(fig, t): fig.suptitle(t, color=INK, fontsize=11, x=0.01, ha="left")
def J(name):
    p = os.path.join(M, name); return json.load(open(p)) if os.path.exists(p) else None

# c7 - pullbacks to the 21-day in leaders: what came first, against the base rate
P = X["pullback21"]["per_name"]; names = list(P)
fig, axes = plt.subplots(1, 2, figsize=(15, 5.4))
ax = axes[0]; y = np.arange(len(names))[::-1]
for yi, s in zip(y, names):
    t = P[s]["full_stack"]; b = P[s]["base_full_stack_sessions"]; a = t["new_high_first_share"] * 100; bb = b["new_high_first_share"] * 100
    ax.plot([bb, a], [yi, yi], color=GREEN if a >= bb else RED, lw=2); ax.plot([bb], [yi], marker="|", ms=16, mew=2, color=INK3); ax.plot([a], [yi], "o", ms=7, color=GREEN if a >= bb else RED)
    ax.text(101, yi, f"n={t['race_n']}", va="center", fontsize=9, color=INK3)
ax.set_yticks(y); ax.set_yticklabels(names); ax.set_xlim(20, 108); ax.set_xlabel("% where a new 20-session high came before a close 1 ATR under the 21-day")
ax.set_title("dot = after a fresh touch of the 21-day · grey bar = any session in the same uptrend", loc="left", fontsize=9.5, color=INK2)
ax = axes[1]
for yi, s in zip(y, names):
    t = P[s]["full_stack"]
    ax.barh(yi + 0.18, t["held_10_share"] * 100, 0.32, color=GREEN, edgecolor=BG); ax.barh(yi - 0.18, t["reached_50_in_20_share"] * 100, 0.32, color=RED, edgecolor=BG)
    ax.text(t["held_10_share"] * 100 + 1, yi + 0.18, f"{t['held_10_share']*100:.0f}% held", va="center", fontsize=9, color=INK2); ax.text(t["reached_50_in_20_share"] * 100 + 1, yi - 0.18, f"{t['reached_50_in_20_share']*100:.0f}% went on to the 50-day", va="center", fontsize=9, color=INK2)
ax.set_yticks(y); ax.set_yticklabels(names); ax.set_xlim(0, 118); ax.set_xlabel("% of fresh touches of the 21-day (uptrend: 21 over 50 over 200)")
ax.set_title("green = held 10 sessions (no close 1 ATR under) · red = reached the 50-day within 20", loc="left", fontsize=9.5, color=INK2)
title(fig, "c7 · Pullbacks to the 21-day average in the leaders · full history of each name · uptrend only"); fig.tight_layout(rect=(0, 0, 1, 0.95)); fig.savefig(os.path.join(OUT, "c7-pullback-21day.png")); plt.close()

# c8 - 50/200 crosses: how much was already done at the cross
C = X["cross"]["pooled"]; fig, axes = plt.subplots(1, 2, figsize=(15, 4.4)); groups = ["company", "etf"]
ax = axes[0]
for i, g in enumerate(groups):
    d = C[g]["death"]; a = d["already_from_peak_med"] * 100; f = d["further_low_120_med"] * 100
    ax.barh(i * 2 + 0.5, a, 0.7, color=RED, edgecolor=BG); ax.barh(i * 2 - 0.3, f, 0.7, color=RED, alpha=0.55, edgecolor=BG)
    ax.text(a - 0.4, i * 2 + 0.5, f"{a:.1f}% already lost at the cross · {d['sessions_since_peak_med']:.0f} sessions after the high", ha="right", va="center", fontsize=9, color=INK)
    ax.text(f - 0.4, i * 2 - 0.3, f"{f:.1f}% lowest close in the next 120 · {d['ret_120_pos']*100:.0f}% were higher 120 sessions on", ha="right", va="center", fontsize=9, color=INK2)
ax.set_yticks([0.1, 2.1]); ax.set_yticklabels([f"companies\nn={C['company']['death']['n']}", f"funds\nn={C['etf']['death']['n']}"]); ax.set_xlim(-52, 1); ax.set_xlabel("median, % from the close named"); ax.set_title("50-day falls UNDER the 200-day", loc="left", fontsize=9.5, color=INK2)
ax = axes[1]
for i, g in enumerate(groups):
    d = C[g]["golden"]; a = d["already_from_trough_med"] * 100; f = d["further_high_120_med"] * 100
    ax.barh(i * 2 + 0.5, a, 0.7, color=GREEN, edgecolor=BG); ax.barh(i * 2 - 0.3, f, 0.7, color=GREEN, alpha=0.55, edgecolor=BG)
    ax.text(a + 0.6, i * 2 + 0.5, f"+{a:.1f}% already gained at the cross · {d['sessions_since_trough_med']:.0f} sessions after the low", va="center", fontsize=9, color=INK)
    ax.text(f + 0.6, i * 2 - 0.3, f"+{f:.1f}% highest close in the next 120 · {d['ret_120_pos']*100:.0f}% were higher 120 sessions on", va="center", fontsize=9, color=INK2)
ax.set_yticks([0.1, 2.1]); ax.set_yticklabels([f"companies\nn={C['company']['golden']['n']}", f"funds\nn={C['etf']['golden']['n']}"]); ax.set_xlim(0, 95); ax.set_xlabel("median, % from the close named"); ax.set_title("50-day rises OVER the 200-day", loc="left", fontsize=9.5, color=INK2)
title(fig, "c8 · The 50/200-day cross arrives late · strong bar = the move already made when it prints · faint bar = what was still to come"); fig.tight_layout(rect=(0, 0, 1, 0.93)); fig.savefig(os.path.join(OUT, "c8-cross-lag.png")); plt.close()

# c9 - index pullback depth history
D = X["depth"]; fig, axes = plt.subplots(4, 1, figsize=(15, 9.2), sharex=True)
for ax, s in zip(axes, D):
    ep = D[s]["episodes"]; xs = pd.to_datetime([e["peak"] for e in ep]); ds = [e["depth"] * 100 for e in ep]
    ax.vlines(xs, 0, ds, color=RED, lw=1.6); ax.plot(xs, ds, "o", ms=3.5, color=RED)
    for e in ep:
        if e["depth"] <= -0.15: ax.text(pd.to_datetime(e["peak"]), e["depth"] * 100 - 3, f"{e['depth']*100:.0f}%", ha="center", va="top", fontsize=8, color=INK3)
    cur = D[s]["current"]; sm = D[s]["summary"]
    if cur["deepest_so_far"] < 0:
        ax.vlines(pd.to_datetime(cur["peak"]), 0, cur["deepest_so_far"] * 100, color=INK, lw=2); ax.text(pd.to_datetime(cur["peak"]) + pd.Timedelta(days=40), -14, f"now {cur['deepest_so_far']*100:.1f}%", fontsize=8.5, color=INK, va="center")
    ax.axhline(-sm["depth_med"] * 100, color=INK3, lw=0.9, ls=":"); ax.text(pd.Timestamp("2004-01-01"), -sm["depth_med"] * 100 - 1.5, f"median {sm['depth_med']*100:.1f}%", fontsize=8, color=INK3, va="top")
    ax.set_xlim(pd.Timestamp("2003-10-01"), pd.Timestamp("2027-12-01")); ax.set_ylim(-66, 3); ax.set_ylabel(s, rotation=0, labelpad=22, color=INK, fontsize=11); ax.set_title(f"{sm['n']} pullbacks of 3% or more since {D[s]['first'][:4]} · {sm['per_year']:.1f} a year · median {sm['depth_med']*100:.1f}%, one in four deeper than {sm['depth_p75']*100:.1f}%, one in ten deeper than {sm['depth_p90']*100:.1f}% · median {sm['sessions_to_trough_med']:.0f} sessions to the low, {sm['sessions_to_recover_med']:.0f} back to a high", loc="left", fontsize=9, color=INK2)
title(fig, "c9 · Index pullback depth · red stem = one pullback from a 252-session closing high to its lowest close · white = the one open now")
fig.tight_layout(rect=(0, 0, 1, 0.96)); fig.savefig(os.path.join(OUT, "c9-index-pullback-depth.png")); plt.close()

# c10 - the reviewer scoreboard
S = J("summary.json")
if S:
    L = S["reviewers"]; labels = [r["name"] for r in L]; y = np.arange(len(L))[::-1]
    fig, axes = plt.subplots(1, 3, figsize=(15, 4.2), sharey=True)
    for ax, key, base, ttl in ((axes[0], "tech_quiz", S["baselines"]["tech_always_yes"], "technical facts read correctly, % of 39"), (axes[1], "fund_quiz", S["baselines"]["fund_always_yes"], "fundamental facts read correctly, % of 24"), (axes[2], "tone_acc", 1/3, "headline tone, % right of 240 labelled")):
        for yi, r in zip(y, L):
            v = r.get(key)
            if v is None: ax.text(2, yi, "not run", va="center", fontsize=9, color=INK3); continue
            ax.barh(yi, v * 100, 0.6, color=GREEN if v > base + 0.1 else RED, edgecolor=BG); ax.text(v * 100 + 1.5, yi, f"{v*100:.0f}%", va="center", fontsize=9.5, color=INK)
        ax.axvline(base * 100, color=INK3, lw=1.2, ls=":"); ax.text(base * 100 + 0.8, len(L) - 0.45, "guessing", fontsize=8, color=INK3); ax.set_xlim(0, 112); ax.set_title(ttl, loc="left", fontsize=9.5, color=INK2); ax.set_ylim(-0.6, len(L) - 0.2)
    axes[0].set_yticks(y); axes[0].set_yticklabels(labels)
    title(fig, "c10 · Open models as reviewers · same facts sheet to every model, on this Mac, no API · dotted = what answering blindly scores"); fig.tight_layout(rect=(0, 0, 1, 0.93)); fig.savefig(os.path.join(OUT, "c10-reviewer-scoreboard.png")); plt.close()

# c11 - forecasting models against doing nothing
F = J("forecast.json")
if F:
    keys = [k for k in ("chronos_bolt_base", "kronos_small", "kronos_base") if k in F and "per_name" in F[k]]
    if keys:
        fig, axes = plt.subplots(1, len(keys), figsize=(15, 4.4), sharey=True)
        axes = np.atleast_1d(axes)
        for ax, k in zip(axes, keys):
            pn = F[k]["per_name"]; nm = list(pn) + ["ALL"]; y = np.arange(len(nm))[::-1]
            for yi, s in zip(y, nm):
                sc = pn[s]["score"] if s != "ALL" else F[k]["pooled"]; a = sc["direction_hit"] * 100; b = sc["always_up_hit"] * 100
                ax.plot([b, a], [yi, yi], color=GREEN if a >= b else RED, lw=2); ax.plot([b], [yi], marker="|", ms=16, mew=2, color=INK3); ax.plot([a], [yi], "o", ms=7, color=GREEN if a >= b else RED)
                ax.text(101, yi, f"n={sc['n']}", va="center", fontsize=8.5, color=INK3)
            ax.set_yticks(y); ax.set_yticklabels(nm); ax.set_xlim(0, 110); ax.set_title(F[k]["model"], loc="left", fontsize=9.5, color=INK2); ax.set_xlabel("% of 20-session forecasts with the direction right")
        title(fig, "c11 · Open forecasting models, walk-forward on our bars · dot = the model · grey bar = always saying 'up'"); fig.tight_layout(rect=(0, 0, 1, 0.93)); fig.savefig(os.path.join(OUT, "c11-forecast-models.png")); plt.close()
print("charts written")
