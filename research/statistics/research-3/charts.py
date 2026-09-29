"""Chart helpers: every chart is a saved PNG in the Scintilla look — dark panel, grey text, mono labels,
up = green, down = red, no white. Nothing here reads data."""
import os, matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BG = "#07070C"; PANEL = "#0B0B12"; GRID = "#1E1E28"; TXT = "#B4B4C6"; DIM = "#8A8A9E"; LINE = "#A8A8BA"; LINE2 = "#6E6E82"
UP = "#00FFA3"; DN = "#FF2D55"; ACCENT = "#C8C8D2"
GREYS = ["#C8C8D2", "#A0A0B0", "#7C7C8E", "#5C5C6C", "#44444F"]
plt.rcParams.update({"figure.facecolor": BG, "axes.facecolor": PANEL, "axes.edgecolor": GRID, "axes.labelcolor": TXT, "xtick.color": DIM, "ytick.color": DIM,
    "text.color": TXT, "grid.color": GRID, "grid.linewidth": 0.6, "font.family": "sans-serif", "font.size": 11, "axes.titlesize": 13, "axes.titleweight": "normal",
    "legend.facecolor": PANEL, "legend.edgecolor": GRID, "legend.fontsize": 10, "savefig.facecolor": BG, "axes.spines.top": False, "axes.spines.right": False})

def fig(w=14, h=5.6, nrows=1, ncols=1, **kw):
    f, ax = plt.subplots(nrows, ncols, figsize=(w, h), **kw); return f, ax

def title(ax, t, sub=None):
    """Title above, the mono subtitle on its own line under it (28 Sep: the two overlapped at pad 14)."""
    ax.set_title(t, loc="left", color=ACCENT, pad=26 if sub else 8)
    if sub: ax.text(0, 1.03, sub, transform=ax.transAxes, color=DIM, fontsize=9.5, family="monospace", va="bottom")

def save(f, path):
    os.makedirs(os.path.dirname(path), exist_ok=True); f.tight_layout(); f.savefig(path, dpi=100); plt.close(f); return os.path.basename(path)

def updown_color(vals): return [UP if v >= 0 else DN for v in vals]

def range_bars(ax, labels, est, lo, hi, base=None, ylabel="", color_by_sign=True):
    """Point + 90% range per category; a dashed base line for any day."""
    f = lambda a: np.array([np.nan if v is None else v for v in a], float)
    x = np.arange(len(labels)); est = f(est); lo = f(lo); hi = f(hi)
    cols = updown_color(est - (base if base is not None else 0)) if color_by_sign else [LINE] * len(labels)
    for i in range(len(labels)):
        if np.isfinite(lo[i]) and np.isfinite(hi[i]): ax.plot([x[i], x[i]], [lo[i], hi[i]], color=LINE2, lw=2, solid_capstyle="round")
        ax.plot([x[i]], [est[i]], "o", color=cols[i], ms=7)
    if base is not None: ax.axhline(base, color=DIM, ls="--", lw=1); ax.text(len(labels) - 0.5, base, " any day", color=DIM, fontsize=9, va="bottom", ha="right")
    ax.set_xticks(x); ax.set_xticklabels(labels, rotation=0); ax.set_ylabel(ylabel); ax.grid(axis="y")

def band_plot(ax, x, med, lo, hi, label=None, color=LINE, fill_alpha=0.18):
    f = lambda a: np.array([np.nan if v is None else v for v in a], float); med, lo, hi = f(med), f(lo), f(hi)
    ax.plot(x, med, color=color, lw=1.8, label=label); ax.fill_between(x, lo, hi, color=color, alpha=fill_alpha, lw=0)

def heat(ax, M, xl, yl, fmt="{:.1f}", vmin=None, vmax=None, center=None, cmap=None):
    """A grid of numbers with a diverging red→grey→green fill around center."""
    M = np.array(M, float)
    if cmap is None:
        from matplotlib.colors import LinearSegmentedColormap
        cmap = LinearSegmentedColormap.from_list("sc", [DN, "#2A2A36", UP])
    c = center if center is not None else np.nanmedian(M)
    if vmin is None or vmax is None:
        span = np.nanmax(np.abs(M - c)) if np.isfinite(M).any() else 1; vmin, vmax = c - span, c + span
    im = ax.imshow(M, cmap=cmap, vmin=vmin, vmax=vmax, aspect="auto")
    ax.set_xticks(range(len(xl))); ax.set_xticklabels(xl); ax.set_yticks(range(len(yl))); ax.set_yticklabels(yl)
    for i in range(M.shape[0]):
        for j in range(M.shape[1]):
            v = M[i, j]
            if np.isfinite(v): ax.text(j, i, fmt.format(v), ha="center", va="center", color="#07070C" if abs(v - c) > 0.6 * (vmax - c) else ACCENT, fontsize=9.5, family="monospace")
    ax.grid(False); return im
