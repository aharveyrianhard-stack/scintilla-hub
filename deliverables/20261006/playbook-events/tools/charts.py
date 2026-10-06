#!/usr/bin/env python3
"""PB1 pictures. House rules: greys only (channels within 24, none above 210), the only colours are daily up = green, down = red.
Thin marks, one axis per chart, direct labels, no legend boxes where one series."""
import json, os, numpy as np, pandas as pd, matplotlib
matplotlib.use("Agg"); import matplotlib.pyplot as plt
HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(HERE, "..", "charts"); os.makedirs(OUT, exist_ok=True)
import sys; sys.path.insert(0, HERE); import events as EV
BG="#0b0b0e"; PANEL="#121216"; LINE="#2a2a30"; INK="#d2d2d2"; INK2="#b4b4b8"; INK3="#8c8c92"; GREEN="#2e9c5a"; RED="#c6413f"
plt.rcParams.update({"figure.facecolor":BG,"axes.facecolor":PANEL,"axes.edgecolor":LINE,"axes.labelcolor":INK2,"xtick.color":INK3,"ytick.color":INK3,"text.color":INK,
  "font.family":"monospace","font.size":10,"axes.grid":True,"grid.color":LINE,"grid.linewidth":0.6,"axes.spines.top":False,"axes.spines.right":False,"savefig.facecolor":BG,"savefig.dpi":110})
E = pd.DataFrame(json.load(open(os.path.join(DATA,"events.json")))); T = json.load(open(os.path.join(DATA,"tables.json"))); B = json.load(open(os.path.join(DATA,"base-rates.json"))); R = json.load(open(os.path.join(DATA,"recurrence.json")))
H=[5,10,20,60]
from matplotlib.collections import LineCollection; import matplotlib.dates as mdates
def dirline(ax, x, y, lw):
    """House rule: no grey lines - a line is green on the days it rose and red on the days it fell."""
    xv = mdates.date2num(pd.DatetimeIndex(x).tz_localize(None).to_pydatetime()); yv = np.asarray(y, dtype=float); ok = ~np.isnan(yv[:-1]) & ~np.isnan(yv[1:])
    seg = np.stack([np.column_stack([xv[:-1], yv[:-1]]), np.column_stack([xv[1:], yv[1:]])], axis=1)[ok]; up = (yv[1:] >= yv[:-1])[ok]
    ax.add_collection(LineCollection(seg, colors=[GREEN if u else RED for u in up], linewidths=lw)); ax.autoscale_view()
def pct(x): return f"{x*100:+.1f}%"

# c1: after a 200-day cross, median max run-up (green) and max drawdown (red) by horizon, three groups
fig, axes = plt.subplots(1,3, figsize=(15,4.6), sharey=True)
for ax, grp in zip(axes, ["company","etf","macro"]):
    for kind, ls in (("x200_up","-"),("x200_down","--")):
        s = T["per_kind_by_group"][grp][kind]
        ax.plot(H,[s[f"runup_{h}_med"]*100 for h in H], ls, color=GREEN, lw=2, marker="o", ms=5)
        ax.plot(H,[s[f"drawdown_{h}_med"]*100 for h in H], ls, color=RED, lw=2, marker="o", ms=5)
        ax.text(62, s["runup_60_med"]*100 + (1.2 if kind.endswith('up') else -1.2), f"{'reclaim' if kind.endswith('up') else 'loss'} n={s['n']}", color=INK2, va="center", fontsize=9)
    base = T["base_by_group"][grp]
    ax.plot(H,[base[f"runup_{h}_med"]*100 for h in H], ":", color=INK3, lw=1.2); ax.plot(H,[base[f"drawdown_{h}_med"]*100 for h in H], ":", color=INK3, lw=1.2)
    ax.set_title(grp, color=INK, fontsize=10, loc="left")
    ax.set_xticks(H); ax.set_xlabel("sessions after the cross"); ax.axhline(0,color=INK3,lw=0.8)
axes[0].set_ylabel("median max run-up (green) and max drawdown (red), %")
fig.suptitle("c1 · After the close crossed the 200-day · solid = reclaim (crossed up), dashed = loss (crossed down), dotted = every session · medians", color=INK, fontsize=11, x=0.01, ha="left"); fig.tight_layout(); fig.savefig(os.path.join(OUT,"c1-200day-paths.png")); plt.close()

# c2: per name, 200-day reclaim: n and median 60-session run-up / drawdown
rows=[]
for sym in EV.GROUP:
    s = T["per_name"].get(sym,{}).get("x200_up")
    if s: rows.append((sym, EV.GROUP[sym], s["n"], s["runup_60_med"]*100, s["drawdown_60_med"]*100, s["retag200_60_share"]))
rows.sort(key=lambda r:(r[1],r[0]))
fig, ax = plt.subplots(figsize=(15,6.2)); x=np.arange(len(rows))
ax.bar(x-0.2,[r[3] for r in rows],0.38,color=GREEN,edgecolor=BG,linewidth=1); ax.bar(x+0.2,[r[4] for r in rows],0.38,color=RED,edgecolor=BG,linewidth=1)
for i,r in enumerate(rows): ax.text(i, r[3]+0.6, f"n={r[2]}", ha="center", fontsize=7.5, color=INK3)
ax.set_xticks(x); ax.set_xticklabels([r[0] for r in rows], rotation=60, ha="right"); ax.axhline(0,color=INK3,lw=0.8)
ax.set_ylabel("median within 60 sessions, %: max run-up (green), max drawdown (red)")
ax.set_title("c2 · 200-day reclaims by name · how far up and how far down the next 60 sessions went (medians), with the event count", color=INK, fontsize=11, loc="left")
fig.tight_layout(); fig.savefig(os.path.join(OUT,"c2-200day-by-name.png")); plt.close()

# c3: RSI tag of own 10th pct: share of names' events with a higher close 60 sessions later vs the name's base rate
rows=[]
for sym in EV.GROUP:
    s = T["per_name"].get(sym,{}).get("rsi_low"); b = B.get(sym)
    if s and s["ret_60_pos"] is not None: rows.append((sym, s["n"], s["ret_60_pos"]*100, b["ret_60_pos"]*100, s["ret_60_med"]*100))
rows.sort(key=lambda r:(EV.GROUP[r[0]],r[0]))
fig, ax = plt.subplots(figsize=(15,5.6)); x=np.arange(len(rows))
for i,r in enumerate(rows):
    col = GREEN if r[2]>=r[3] else RED
    ax.vlines(i, r[3], r[2], color=col, lw=2); ax.plot(i, r[2], "o", color=col, ms=6); ax.plot(i, r[3], "_", color=INK3, ms=12, mew=2)
    ax.text(i, max(r[2],r[3])+1.5, f"n={r[1]}", ha="center", fontsize=7.5, color=INK3)
ax.set_xticks(x); ax.set_xticklabels([r[0] for r in rows], rotation=60, ha="right"); ax.set_ylabel("% of events with a higher close 60 sessions later")
ax.set_title("c3 · RSI tags its OWN 10th percentile (trailing 2 years) · dot = after the tag, grey dash = that name's every-session rate · green when the tag did better", color=INK, fontsize=10.5, loc="left")
fig.tight_layout(); fig.savefig(os.path.join(OUT,"c3-rsi-low-vs-base.png")); plt.close()

# c4: cloud flips: median sessions until the opposite flip, per group and layer
fig, ax = plt.subplots(figsize=(13,4.8)); layers=[("cloud_fast","13 / 21 EMA"),("cloud_inner","21 EMA / 50 SMA"),("cloud_outer","50 / 200 SMA")]
x=np.arange(3); w=0.26
for j,grp in enumerate(["company","etf","macro"]):
    for i,(k,lab) in enumerate(layers):
        bu = T["per_kind_by_group"][grp][k+"_bull"]; be = T["per_kind_by_group"][grp][k+"_bear"]
        ax.bar(i+ (j-1)*w - 0.06, bu["days_to_opposite_med"], w*0.45, color=GREEN, edgecolor=BG); ax.bar(i+(j-1)*w+0.06, be["days_to_opposite_med"], w*0.45, color=RED, edgecolor=BG)
        ax.text(i+(j-1)*w, max(bu["days_to_opposite_med"],be["days_to_opposite_med"])+2, f"{grp}\nn={bu['n']}/{be['n']}", ha="center", fontsize=7, color=INK3)
ax.set_xticks(x); ax.set_xticklabels([l for _,l in layers]); ax.set_ylabel("median sessions a flip lasted")
ax.set_title("c4 · The Lab's three clouds · median sessions a bull flip (green) and a bear flip (red) lasted\nbefore the opposite flip, by group", color=INK, fontsize=10.5, loc="left")
fig.tight_layout(); fig.savefig(os.path.join(OUT,"c4-cloud-flip-life.png")); plt.close()

# c5: recurrence: share vs base, company + etf
for grp in ["company","etf","macro"]:
    rr = R[grp]; fig, ax = plt.subplots(figsize=(15,7.2)); y=np.arange(len(rr))
    for i,r in enumerate(rr):
        if r["share"] is None: continue
        col = GREEN if r["share"]>=r["base"] else RED
        ax.hlines(i, r["base"]*100, r["share"]*100, color=col, lw=2); ax.plot(r["share"]*100, i, "o", color=col, ms=6); ax.plot(r["base"]*100, i, "|", color=INK3, ms=12, mew=2)
        ax.text(101, i, f"n={r['n']}", va="center", fontsize=8, color=INK3)
    ax.set_yticks(y); ax.set_yticklabels([f"{r['condition']}\n→ {r['follow']}" for r in rr], fontsize=7.6); ax.invert_yaxis(); ax.set_xlim(20,108)
    ax.set_xlabel("% of events where the follow-on happened · dot = after the condition · grey bar = base rate")
    ax.set_title(f"c5 · Recurrence · {grp} · conditions with counts, each beside its base rate", color=INK, fontsize=11, loc="left")
    fig.tight_layout(); fig.savefig(os.path.join(OUT,f"c5-recurrence-{grp}.png")); plt.close()

# c6: example: SPY last 2 years with the clouds and the events marked
for sym in ["SPY","NVDA"]:
    df = EV.indicators(EV.load(sym)); d = df.loc["2024-10-01":]
    fig, (ax, ax2) = plt.subplots(2,1, figsize=(15,7.4), sharex=True, gridspec_kw={"height_ratios":[3,1]})
    up = d["c"]>=d["c"].shift(1)
    ax.vlines(d.index[up], d["l"][up], d["h"][up], color=GREEN, lw=0.9); ax.vlines(d.index[~up], d["l"][~up], d["h"][~up], color=RED, lw=0.9)
    dirline(ax, d.index, d["ema13"], 0.7); dirline(ax, d.index, d["ema21"], 0.9); dirline(ax, d.index, d["sma50"], 1.3); dirline(ax, d.index, d["sma200"], 1.9)
    ax.fill_between(d.index, d["ema21"], d["sma50"], where=d["inner_bull"], color="#3a3a40", alpha=.55, lw=0); ax.fill_between(d.index, d["ema21"], d["sma50"], where=~d["inner_bull"], color="#1c1c22", alpha=.9, lw=0)
    ax.fill_between(d.index, d["sma50"], d["sma200"], where=d["outer_bull"], color="#2c2c32", alpha=.5, lw=0); ax.fill_between(d.index, d["sma50"], d["sma200"], where=~d["outer_bull"], color="#161619", alpha=.9, lw=0)
    ev = E[(E.symbol==sym)&(E.date>="2024-10-01")]
    for _,r in ev[ev.event.isin(["x200_up","x200_down"])].iterrows():
        ax.annotate("200↑" if r.event=="x200_up" else "200↓", (pd.Timestamp(r.date, tz="US/Eastern"), r.close), textcoords="offset points", xytext=(0,-22 if r.event=="x200_down" else 14), ha="center", fontsize=8, color=GREEN if r.event=="x200_up" else RED)
    for _,r in ev[ev.event.isin(["cloud_inner_bull","cloud_inner_bear"])].iterrows():
        ax.plot(pd.Timestamp(r.date, tz="US/Eastern"), r.close, marker="^" if r.event.endswith("bull") else "v", color=GREEN if r.event.endswith("bull") else RED, ms=7, mec=BG)
    for lab, col in (("13 EMA","ema13"),("21 EMA","ema21"),("50 SMA","sma50"),("200 SMA","sma200")): ax.text(d.index[-1], d[col].iloc[-1], "  "+lab, fontsize=8, va="center", color=INK2)
    ax.set_title(f"c6 · {sym} since Oct 2024 · green/red = each line's own daily direction · clouds shaded (21/50, 50/200) · 200-day crosses labelled · triangles = 21/50 flips", color=INK, fontsize=10.5, loc="left")
    dirline(ax2, d.index, d["rsi"], 1.0); ax2.plot(d.index, d["rsi_lo"], ":", color=INK3, lw=1); ax2.plot(d.index, d["rsi_hi"], ":", color=INK3, lw=1)
    lo = d["rsi"]<=d["rsi_lo"]; hi = d["rsi"]>=d["rsi_hi"]; ax2.plot(d.index[lo], d["rsi"][lo], "o", color=GREEN, ms=4); ax2.plot(d.index[hi], d["rsi"][hi], "o", color=RED, ms=4)
    ax2.set_ylabel("RSI 14"); ax2.text(d.index[0], d["rsi_lo"].iloc[-1]-7, f"dotted = {sym}'s own 10th / 90th percentile over the trailing 2 years (not 30/70)", fontsize=8, color=INK3)
    fig.tight_layout(); fig.savefig(os.path.join(OUT,f"c6-{sym.lower()}-example.png")); plt.close()
print("charts written:", sorted(os.listdir(OUT)))
