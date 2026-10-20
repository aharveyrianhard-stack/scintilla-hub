#!/usr/bin/env python3
"""CW5 · the pictures (matplotlib, headless). One figure per name: price (log) · TTM diluted EPS · trailing P/E with the
realised-forward P/E · EV/sales · EV/EBITDA · P/B, ten years monthly, the ten-year median dashed, the 10th–90th
percentile band shaded, today's point marked. Then the Micron-vs-Korea premium chart (four panels, two lines each) and
the sector strip (where each name sits today in its own history, per multiple).
usage: python3 charts.py <deliverable dir>"""
import json, os, sys, datetime as dt
import matplotlib; matplotlib.use("Agg")
import matplotlib.pyplot as plt, matplotlib.dates as mdates
from matplotlib.ticker import FuncFormatter

BG, CARD, LINE, INK, INK2 = "#0a0e14", "#0e131b", "#263040", "#e6e9ef", "#9aa3b2"
BLUE, ORANGE, AQUA, YELLOW, RED = "#3987e5", "#d95926", "#199e70", "#c98500", "#e66767"
plt.rcParams.update({"figure.facecolor": BG, "axes.facecolor": CARD, "axes.edgecolor": LINE, "axes.labelcolor": INK2, "xtick.color": INK2, "ytick.color": INK2,
                     "text.color": INK, "grid.color": LINE, "grid.linewidth": 0.6, "font.size": 10, "font.family": "Helvetica Neue, Helvetica, Arial, sans-serif",
                     "axes.titleweight": "600", "axes.titlesize": 11, "axes.titlecolor": INK, "legend.frameon": False, "legend.fontsize": 9})
ORDER = ["MU", "000660.KS", "005930.KS", "285A.T", "WDC", "SNDK", "2408.TW"]
LABEL = {"pe": "Trailing P/E", "pe_fwd_realised": "Realised forward P/E", "ev_sales": "EV / sales (TTM)", "ev_ebitda": "EV / EBITDA (TTM)", "pb": "Price / book"}

def D(s): return dt.date.fromisoformat(s)
def xfmt(v): return f"{v:,.0f}×" if v >= 100 else (f"{v:.0f}×" if v >= 10 else f"{v:.1f}×")
def pctl(s, p):
    s = sorted(v for v in s if v is not None)
    if not s: return None
    k = (len(s) - 1) * p; f = int(k); c = min(f + 1, len(s) - 1)
    return s[f] + (s[c] - s[f]) * (k - f)
def style(ax, title):
    ax.set_title(title, loc="left", pad=6); ax.grid(True, axis="y", alpha=.5); ax.grid(False, axis="x")
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.xaxis.set_major_locator(mdates.YearLocator(2)); ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y")); ax.tick_params(length=0)

def series_panel(ax, n, k, title, today_val, today_label, color=BLUE, band=True, fwd=None):
    mon = n["monthly"]; x = [D(m["date"]) for m in mon]; y = [m.get(k) for m in mon]
    vals = [v for v in y if v is not None]
    if fwd:
        yf = [m.get(fwd) for m in mon]
        ax.plot(x, [v if v is not None else float("nan") for v in yf], color=ORANGE, lw=1.6, label="realised fwd P/E (next 4 qtrs' actual EPS)")
    ax.plot(x, [v if v is not None else float("nan") for v in y], color=color, lw=2, label=title.lower() if fwd else None)
    if vals:
        med = pctl(vals, .5); lo = pctl(vals, .1); hi = pctl(vals, .9)
        if band: ax.axhspan(lo, hi, color=color, alpha=.08, lw=0)
        ax.axhline(med, color=INK2, lw=1, ls=(0, (4, 3)))
        ax.text(x[0], med, f" median {xfmt(med)}", color=INK2, fontsize=8.5, va="bottom")
    nm = [D(m["date"]) for m in mon if m.get(k) is None]
    if nm and k in ("pe", "ev_ebitda"):
        ax.scatter(nm, [ax.get_ylim()[0]] * len(nm), marker="|", color=INK2, s=14, lw=1, label="n.m. (losses)" if k == "pe" else None)
    if today_val is not None:
        tx = dt.date(2026, 10, 20)
        ax.scatter([tx], [today_val], color=RED, s=42, zorder=5, edgecolor=BG, lw=1.2)
        ax.annotate(today_label, (tx, today_val), xytext=(-10, 10), textcoords="offset points", ha="right", color=INK, fontsize=9, fontweight="600", bbox=dict(boxstyle="round,pad=0.25", fc=BG, ec=LINE, lw=.6))
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: xfmt(v) if v > 0 else "0"))
    ax.set_ylim(bottom=0)
    if vals:
        cap = max(pctl(vals, .9) * 2.5, (today_val or 0) * 1.25, pctl(vals, .5) * 1.5)
        if max(vals) > cap * 1.4:
            ax.set_ylim(0, cap); ax.text(0.99, 0.97 if not fwd else 0.80, f"clipped at {xfmt(cap)}; high {xfmt(max(vals))} (tiny earnings)", transform=ax.transAxes, ha="right", va="top", fontsize=7.5, color=INK2)
    style(ax, title)
    if fwd: ax.legend(loc="upper left", fontsize=7.5, handlelength=1.5)

def name_figure(n, out):
    t = n["ticker"]; pct = n["percentiles"]; td = n["today"]; e = n["earnings"]
    fig, axs = plt.subplots(2, 3, figsize=(15, 7.6), dpi=130); fig.subplots_adjust(left=.05, right=.985, top=.86, bottom=.07, wspace=.22, hspace=.42)
    ccy = n["currency"]
    fig.text(.05, .955, f"{t} · {n['company']}", fontsize=15, fontweight="700", color=INK, ha="left")
    fig.text(.05, .915, n["name"] + f"  ·  prices in {ccy}, multiples unitless  ·  monthly, {n['monthly'][0]['date'][:7]} → 2026-09, today = 2026-10-20 (FMP quote {td['price']:,.2f})", fontsize=9.5, color=INK2)
    # price (log)
    ax = axs[0][0]; cl = [c for c in n["closes"] if c["price"]]
    ax.plot([D(c["date"]) for c in cl], [c["price"] for c in cl], color=INK, lw=1.6); ax.set_yscale("log")
    ax.scatter([dt.date(2026, 10, 20)], [td["price"]], color=RED, s=42, zorder=5, edgecolor=BG, lw=1.2)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}")); ax.yaxis.set_minor_formatter(FuncFormatter(lambda v, _: ""))
    style(ax, f"Price ({ccy}, log)")
    # EPS TTM by quarter
    ax = axs[0][1]; qs = [q for q in n["quarters"] if q.get("eps_ttm") is not None and q["date"] >= "2016-09-01"]
    xs = [D(q["date"]) for q in qs]; ys = [q["eps_ttm"] for q in qs]
    ax.bar(xs, ys, width=70, color=[AQUA if v >= 0 else RED for v in ys], linewidth=0)
    hi = e["eps_ttm_high"]; pr = e.get("eps_prior_cycle_high")
    if pr: ax.annotate(f"prior-cycle high {pr[1]:,.2f} ({pr[0][:7]})", (D(pr[0]), pr[1]), xytext=(0, 6), textcoords="offset points", ha="center", color=INK2, fontsize=8)
    ax.annotate(f"now {e['eps_ttm_now']:,.2f}", (xs[-1], ys[-1]), xytext=(-4, 6), textcoords="offset points", ha="right", color=INK, fontsize=9, fontweight="600")
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:,.0f}")); style(ax, f"Diluted EPS, trailing four quarters ({ccy})")
    # P/E with realised forward
    series_panel(axs[0][2], n, "pe", "Trailing P/E", td.get("pe"), f"{xfmt(td['pe'])} today · p{pct['pe']['percentile']:.0f}" if td.get("pe") else "n.m. today", fwd="pe_fwd_realised")
    if td.get("pe_fwd"):
        axs[0][2].scatter([dt.date(2026, 10, 20)], [td["pe_fwd"]], color=ORANGE, s=42, zorder=5, edgecolor=BG, lw=1.2, marker="D")
        axs[0][2].annotate(f"fwd {xfmt(td['pe_fwd'])} (consensus NTM)", (dt.date(2026, 10, 20), td["pe_fwd"]), xytext=(-10, -4), textcoords="offset points", ha="right", va="top", color=ORANGE, fontsize=8.5, fontweight="600", bbox=dict(boxstyle="round,pad=0.25", fc=BG, ec=LINE, lw=.6))
    series_panel(axs[1][0], n, "ev_sales", "EV / sales (TTM)", td.get("ev_sales"), f"{xfmt(td['ev_sales'])} today · p{pct['ev_sales']['percentile']:.0f}")
    series_panel(axs[1][1], n, "ev_ebitda", "EV / EBITDA (TTM)", td.get("ev_ebitda"), f"{xfmt(td['ev_ebitda'])} today · p{pct['ev_ebitda']['percentile']:.0f}" if td.get("ev_ebitda") else "n.m. today")
    series_panel(axs[1][2], n, "pb", "Price / book", td.get("pb"), f"{xfmt(td['pb'])} today · p{pct['pb']['percentile']:.0f}" if td.get("pb") else "n.m.")
    for ax in axs.flat: ax.set_xlim(dt.date(2016, 9, 1), dt.date(2027, 1, 31))
    fig.text(.985, .015, "FMP via the project's fmp-proxy, fetched 2026-10-20 · shaded = 10th–90th percentile of the name's own monthly history · red dot = today", color=INK2, fontsize=8, ha="right")
    p = os.path.join(out, "charts", f"cycle-{t}.png"); fig.savefig(p, facecolor=BG); plt.close(fig); return p

def premium_figure(mc, out):
    fig, axs = plt.subplots(2, 2, figsize=(13, 7.2), dpi=130); fig.subplots_adjust(left=.06, right=.985, top=.85, bottom=.08, wspace=.18, hspace=.4)
    fig.text(.06, .95, "Micron's premium to SK hynix and Samsung, through the cycle", fontsize=15, fontweight="700")
    fig.text(.06, .905, "Micron's multiple ÷ the Korean name's multiple − 1, month by month (currencies cancel) · dashed = ten-year median · dot = today", fontsize=9.5, color=INK2)
    for ax, k in zip(axs.flat, ("pe", "ev_ebitda", "ev_sales", "pb")):
        for peer, color, lab in (("000660.KS", BLUE, "vs SK hynix"), ("005930.KS", ORANGE, "vs Samsung")):
            rows = mc["premium_to"][peer]["rows"]; s = mc["premium_to"][peer]["summary"][k]
            x = [D(r["date"]) for r in rows]; y = [r[k] if r[k] is not None else float("nan") for r in rows]
            ax.plot(x, y, color=color, lw=1.8, label=f"{lab} · median {s['median']:+.0f}% · today {s['today']:+.0f}% (p{s['percentile']:.0f})")
            if s["median"] is not None: ax.axhline(s["median"], color=color, lw=1, ls=(0, (4, 3)), alpha=.7)
            if s["today"] is not None: ax.scatter([dt.date(2026, 10, 20)], [s["today"]], color=color, s=40, zorder=5, edgecolor=BG, lw=1.2)
        ax.axhline(0, color=INK2, lw=.8)
        allv = [r[k] for peer in ("000660.KS", "005930.KS") for r in mc["premium_to"][peer]["rows"] if r[k] is not None]
        if allv and max(allv) > 320:
            ax.set_ylim(-100, 320); ax.text(0.99, 0.03, f"axis clipped at +320%; high {max(allv):+,.0f}% (a loss year's tiny earnings)", transform=ax.transAxes, ha="right", va="bottom", fontsize=7.5, color=INK2)
        ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f"{v:+.0f}%")); style(ax, LABEL[k] + " · Micron premium")
        ax.legend(loc="upper left", fontsize=8); ax.set_xlim(dt.date(2016, 9, 1), dt.date(2027, 1, 31))
    fig.text(.985, .015, "FMP via the project's fmp-proxy, fetched 2026-10-20 · premium printed only in months where both names' multiple is meaningful", color=INK2, fontsize=8, ha="right")
    p = os.path.join(out, "charts", "premium-MU-vs-Korea.png"); fig.savefig(p, facecolor=BG); plt.close(fig); return p

def sector_figure(sec, names, out):
    rows = sec["rows"]; fig, ax = plt.subplots(figsize=(13, 4.6), dpi=130); fig.subplots_adjust(left=.12, right=.985, top=.8, bottom=.12)
    fig.text(.12, .93, "Where each name sits today in its own ten-year history, per multiple (percentile; 0 = cheapest ever, 100 = richest ever)", fontsize=13, fontweight="700")
    fig.text(.12, .875, "Trailing P/E in the cheaper half for six of seven; EV/sales and price-to-book near the top of their histories — a cyclical at peak earnings (dots offset so coincident values show)", fontsize=9.5, color=INK2)
    keys = [("pe_pct", "Trailing P/E", BLUE), ("ev_ebitda_pct", "EV/EBITDA", AQUA), ("ev_sales_pct", "EV/sales", YELLOW), ("pb_pct", "P/B", ORANGE)]
    ys = list(range(len(rows)))[::-1]
    for i, r in zip(ys, rows):
        ax.plot([0, 100], [i, i], color=LINE, lw=1)
        for j, (k, lab, c) in enumerate(keys):
            v = r[k]
            if v is not None: ax.scatter([v], [i + (j - 1.5) * 0.12], color=c, s=60, zorder=4, edgecolor=BG, lw=1.2, label=lab if i == ys[0] else None)
        ax.text(-2, i, f"{r['ticker']}  ({r['months']} mo)", ha="right", va="center", color=INK, fontsize=9.5)
    ax.axvline(50, color=INK2, lw=.8, ls=(0, (4, 3)))
    ax.set_xlim(0, 100); ax.set_ylim(-.7, len(rows) - .3); ax.set_yticks([]); ax.grid(False)
    for s in ("top", "right", "left"): ax.spines[s].set_visible(False)
    ax.set_xlabel("percentile of the name's own monthly history (meaningful observations only)"); ax.legend(loc="upper center", bbox_to_anchor=(.5, -.18), ncol=4)
    p = os.path.join(out, "charts", "sector-percentiles.png"); fig.savefig(p, facecolor=BG); plt.close(fig); return p

def mu_two_readings(mc, n, out):
    """Micron at each cycle turn: trailing P/E against realised forward P/E — the earnings-peak signature."""
    pts = []
    for lab, w in mc["windows"].items():
        for kind in ("at_price_peak", "at_eps_peak", "at_price_trough"):
            m = w.get(kind)
            if m: pts.append((lab + {"at_price_peak": " price peak", "at_eps_peak": " EPS peak", "at_price_trough": ""}[kind], m["date"][:7], m.get("pe"), m.get("pe_fwd_realised"), m.get("price")))
    pts = [p for p in pts if p[2] is not None]
    seen = set(); pts2 = []
    for p in pts:
        if p[1] in seen: continue
        seen.add(p[1]); pts2.append(p)
    pts = sorted(pts2, key=lambda p: p[1])
    fig, ax = plt.subplots(figsize=(13, 4.8), dpi=130); fig.subplots_adjust(left=.06, right=.985, top=.8, bottom=.3)
    fig.text(.06, .93, "Micron at each turn of the cycle: what the trailing P/E said, and what the next four quarters' actual earnings made of it", fontsize=13, fontweight="700")
    fig.text(.06, .875, "At an earnings peak the trailing P/E is at its lowest and the realised forward P/E jumps (earnings fell) · today the consensus forward P/E is the orange diamond", fontsize=9.5, color=INK2)
    xs = list(range(len(pts))); wdt = .36
    ax.bar([x - wdt / 2 for x in xs], [p[2] for p in pts], width=wdt, color=BLUE, label="trailing P/E")
    ax.bar([x + wdt / 2 for x in xs], [p[3] if p[3] is not None else 0 for p in pts], width=wdt, color=ORANGE, label="realised forward P/E (next 4 quarters' actual EPS)")
    for x, p in zip(xs, pts):
        ax.text(x - wdt / 2, p[2] + .4, xfmt(p[2]), ha="center", fontsize=8.5, color=INK)
        ax.text(x + wdt / 2, (p[3] or 0) + .4, xfmt(p[3]) if p[3] is not None else "n.m.\n(losses)", ha="center", fontsize=8.5, color=INK)
    td = n["today"]; x = len(pts)
    ax.bar([x - wdt / 2], [td["pe"]], width=wdt, color=BLUE); ax.text(x - wdt / 2, td["pe"] + .4, xfmt(td["pe"]), ha="center", fontsize=8.5, color=INK)
    ax.scatter([x + wdt / 2], [td["pe_fwd"]], color=ORANGE, marker="D", s=60, zorder=5, edgecolor=BG, label="consensus forward P/E today"); ax.text(x + wdt / 2, td["pe_fwd"] + .9, xfmt(td["pe_fwd"]), ha="center", fontsize=8.5, color=ORANGE)
    ax.set_xticks(xs + [x]); ax.set_xticklabels([f"{p[0]}\n{p[1]} · ${p[4]:,.0f}" for p in pts] + [f"today\n2026-10 · ${td['price']:,.0f}"], fontsize=8.5)
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: xfmt(v) if v > 0 else "0")); ax.grid(True, axis="y", alpha=.5); ax.grid(False, axis="x"); ax.tick_params(length=0)
    for s in ("top", "right"): ax.spines[s].set_visible(False)
    ax.legend(loc="upper left", ncol=3, fontsize=8.5)
    p = os.path.join(out, "charts", "MU-two-readings.png"); fig.savefig(p, facecolor=BG); plt.close(fig); return p

def main():
    out = sys.argv[1]; os.makedirs(os.path.join(out, "charts"), exist_ok=True)
    d = json.load(open(os.path.join(out, "MEMORY-CYCLE.json")))
    made = [name_figure(d["names"][t], out) for t in ORDER if t in d["names"]]
    made.append(premium_figure(d["micron_cycle"], out)); made.append(sector_figure(d["sector"], d["names"], out)); made.append(mu_two_readings(d["micron_cycle"], d["names"]["MU"], out))
    for p in made: print(p, os.path.getsize(p) // 1024, "KB")

if __name__ == "__main__":
    main()
