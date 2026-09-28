"""Chart style shared by the research-director studies: dark panels, greys, green up / red down, saved as PNG."""
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import numpy as np

BG, PANEL, INK, INK2, MUTE, LINE = "#07070C", "#0B0B12", "#C8C8D2", "#B4B4C6", "#8A8A9E", "#24242E"
UP, DN = "#00FFA3", "#FF2D55"
MONO = "Menlo"

plt.rcParams.update({
    "figure.facecolor": BG, "axes.facecolor": PANEL, "savefig.facecolor": BG,
    "axes.edgecolor": LINE, "axes.labelcolor": INK2, "xtick.color": MUTE, "ytick.color": MUTE,
    "text.color": INK, "grid.color": LINE, "grid.linewidth": 0.6, "axes.grid": True,
    "font.family": "sans-serif", "font.sans-serif": ["Helvetica Neue", "Helvetica", "Arial", "DejaVu Sans"],
    "font.size": 11, "axes.titlesize": 13, "axes.titleweight": "semibold", "legend.frameon": False,
    "axes.spines.top": False, "axes.spines.right": False, "figure.dpi": 100, "savefig.dpi": 100,
})


def fig(w=14, h=6, rows=1, cols=1, **kw):
    f, ax = plt.subplots(rows, cols, figsize=(w, h), **kw)
    return f, ax


def updown_line(ax, x, y, lw=1.2, alpha=1.0):
    """A line coloured by its own daily direction: green where it rose from the day before, red where it fell."""
    x = np.asarray(x); y = np.asarray(y, dtype=float)
    d = np.diff(y)
    for col, mask in ((UP, d >= 0), (DN, d < 0)):
        seg_x, seg_y = [], []
        for i in range(len(d)):
            if mask[i]:
                seg_x += [x[i], x[i + 1], None]; seg_y += [y[i], y[i + 1], np.nan]
        if seg_x:
            ax.plot([v if v is not None else np.nan for v in seg_x] if False else _nan_x(seg_x, x), seg_y, color=col, lw=lw, alpha=alpha, solid_capstyle="round")


def _nan_x(seg_x, x):
    # matplotlib needs a real x for the NaN break; reuse the previous x
    out, last = [], x[0]
    for v in seg_x:
        if v is None:
            out.append(last)
        else:
            out.append(v); last = v
    return out


def bars_updown(ax, x, y, width=0.8):
    y = np.asarray(y, dtype=float)
    ax.bar(x, y, width=width, color=[UP if v >= 0 else DN for v in y], edgecolor="none")


def caption(f, text):
    f.text(0.01, 0.005, text, color=MUTE, fontsize=9, ha="left", va="bottom", family=MONO)


def save(f, path):
    f.tight_layout(rect=(0, 0.03, 1, 1))
    f.savefig(path)
    plt.close(f)
    return path
