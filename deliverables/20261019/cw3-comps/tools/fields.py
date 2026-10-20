#!/usr/bin/env python3
"""CW3 · one football field per name: implied price per multiple (peer median × the name's own NTM figure),
the analysts' low · median · high, today's price as a line. Log axis. Tight PNG, dark surface (the Hub's).
usage: python3 fields.py <deliverable dir>   → fields/<TICKER>.png
Palette (validated with the dataviz validator on the dark surface): comps rows blue #3987e5, analysts orange #d95926;
today's price is a reference line in the Hub's cyan, labelled, not a series."""
import json, os, sys, math
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter, NullFormatter, NullLocator

SURF = "#0e131b"; INK = "#e6e9ef"; INK2 = "#9aa3b2"; GRID = "#263040"
BLUE = "#3987e5"; ORANGE = "#d95926"; CYAN = "#00d4ff"

def fmt_px(v):
    if v >= 100: return f"${v:,.0f}"
    return f"${v:.2f}" if v < 10 else f"${v:.1f}"
def fmt_tick(v):
    return f"${v:,.0f}" if v >= 10 else f"${v:g}"

def draw(n, out):
    t = n["ticker"]; px = n["company"]["price"]; imp = n["implied"]; an = n["analysts"]
    rows = []
    for k, v in imp.items():
        rows.append((f"{v['label']}  ·  {v['median']:.1f}× median of {v['n']}", v["price"], BLUE))
    if an.get("low") and an.get("high"):
        rows.append((f"Analysts  ·  low · median · high ({an.get('last_quarter_n') or '?'} in last quarter)", (an["low"], an.get("median") or an.get("consensus"), an["high"]), ORANGE))
    vals = [px] + [r[1] for r in rows if not isinstance(r[1], tuple)] + [x for r in rows if isinstance(r[1], tuple) for x in r[1] if x]
    lo, hi = min(vals), max(vals)
    span = max(hi / lo, 2.5)
    xmin = lo / span ** 0.12; xmax = hi * span ** 0.12
    h = 0.62 * (len(rows) + 1) + 0.9
    fig, ax = plt.subplots(figsize=(10.4, h), dpi=160)
    fig.patch.set_facecolor(SURF); ax.set_facecolor(SURF)
    fig.subplots_adjust(left=0.30, right=0.985, top=0.86, bottom=0.14)
    import matplotlib.transforms as mtr
    gutter = mtr.blended_transform_factory(ax.transAxes, ax.transData)
    ax.set_xscale("log"); ax.set_xlim(xmin, xmax)
    ys = list(range(len(rows)))[::-1]
    for (label, val, col), y in zip(rows, ys):
        if isinstance(val, tuple):
            a, m, b = val
            ax.plot([a, b], [y, y], color=col, lw=6, solid_capstyle="round", alpha=0.55)
            if m: ax.plot([m], [y], marker="D", ms=7, color=col, mec=SURF, mew=1.2)
            ax.text(a, y + 0.3, fmt_px(a), color=INK2, fontsize=8.2, ha="center", va="bottom")
            ax.text(b, y + 0.3, fmt_px(b), color=INK2, fontsize=8.2, ha="center", va="bottom")
            if m: ax.text(m, y - 0.34, fmt_px(m), color=INK, fontsize=8.6, ha="center", va="top", fontweight="bold")
        else:
            # a bar from today's price to the implied price, data end rounded, the implied value labelled
            a, b = sorted([px, val])
            ax.plot([a, b], [y, y], color=col, lw=6, solid_capstyle="round", alpha=0.55)
            ax.plot([val], [y], marker="o", ms=7.5, color=col, mec=SURF, mew=1.2)
            d = (val / px - 1) * 100
            ax.text(val, y - 0.34, f"{fmt_px(val)}  ({d:+.0f}%)", color=INK, fontsize=8.6, ha="center", va="top", fontweight="bold")
        ax.text(-0.015, y, label.replace("  ·  ", "\n"), color=INK2, fontsize=8.4, ha="right", va="center", transform=gutter, linespacing=1.25)
    ax.axvline(px, color=CYAN, lw=1.4, ls="-", alpha=0.95, zorder=0)
    ax.text(px, len(rows) + 0.05, f"today {fmt_px(px)}", color=CYAN, fontsize=8.8, ha="center", va="bottom", fontweight="bold")
    ticks = [m * 10 ** e for e in range(-1, 7) for m in (1, 2, 5) if xmin <= m * 10 ** e <= xmax]
    ax.set_xticks(ticks)
    if n.get("midpoint"):
        ax.axvline(n["midpoint"], color=INK2, lw=0.9, ls=(0, (3, 3)), alpha=0.8, zorder=0)
        ax.text(n["midpoint"], -0.95, f"midpoint {fmt_px(n['midpoint'])}  ·  {n['read']} ({n['distance_pct']:+.0f}% from it)", color=INK2, fontsize=8.4, ha="center", va="top")
    ax.set_ylim(-1.25, len(rows) + 0.75)
    ax.set_yticks([]); ax.tick_params(axis="x", colors=INK2, labelsize=8)
    ax.xaxis.set_major_formatter(FuncFormatter(lambda v, p: fmt_tick(v)))
    ax.xaxis.set_minor_formatter(NullFormatter()); ax.xaxis.set_minor_locator(NullLocator())
    ax.grid(axis="x", color=GRID, lw=0.6, alpha=0.8); ax.set_axisbelow(True)
    for s in ax.spines.values(): s.set_visible(False)
    ax.set_title(f"{t}  ·  implied price per multiple (peer median × own NTM figure), analysts, today  ·  log axis", color=INK, fontsize=9.4, loc="left", pad=8)
    fig.savefig(out, facecolor=SURF, bbox_inches="tight", pad_inches=0.12)
    plt.close(fig)

def main():
    D = sys.argv[1]; d = json.load(open(os.path.join(D, "COMPS-RADAR.json")))
    os.makedirs(os.path.join(D, "fields"), exist_ok=True)
    for t, n in d["names"].items():
        if not n["implied"] and not n["analysts"].get("high"):
            print(t, "nothing to draw"); continue
        draw(n, os.path.join(D, "fields", t + ".png")); print(t, "ok")

if __name__ == "__main__":
    main()
