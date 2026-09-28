#!/usr/bin/env python3
"""L2 CHART-SPEED — builds CHART-SPEED.html from the measurement files in ../data/final (and ../data/*.json).
Waterfalls are inline SVG, greys only (Hub look rules: channels within 24 of each other, none above 210)."""
import json, glob, os, statistics as S, html, pathlib

HERE = pathlib.Path(__file__).resolve().parent
D = HERE.parent / "data"
FINAL = D / "final"

def load(p):
    try:
        return json.load(open(p))
    except Exception:
        return None

def frame_stats(run, key):
    vals = [f.get(key) for f in run["frames"].values()]
    return vals

def med(xs):
    xs = [x for x in xs if x is not None]
    return int(S.median(xs)) if xs else None

def worst(xs):
    got = [x for x in xs if x is not None]
    if len(got) < len(xs): return None          # something never appeared inside the watch window
    return max(got) if got else None

def fmt(ms):
    if ms is None: return "—"
    return f"{ms/1000:.1f} s"

def summarize(sc, variant):
    """per run-kind: list over reps of {milestone: (median over panes, worst pane)}"""
    out = {"cold": [], "warm": []}
    for p in sorted(glob.glob(str(FINAL / f"{sc}-{variant}-*.json"))):
        j = load(p)
        if not j or j.get("error"): continue
        for r in j["runs"]:
            if not r["frames"]: continue
            row = {}
            for k in ["price", "clouds", "fanAll", "lens", "geiger"]:
                v = frame_stats(r, k)
                row[k] = (med(v), worst(v), sum(1 for x in v if x is not None), len(v))
            row["chartapi"] = sum(1 for q in r["requests"] if q["kind"] == "chartapi" and 0 <= q["start"] <= 10000)
            row["supabase"] = sum(1 for q in r["requests"] if q["kind"] == "supabase" and -1000 <= q["start"] <= 10000)
            row["task"] = r.get("taskSeconds")
            out[r["run"]].append(row)
    return out

GREY = {"bar": "#6E6E74", "geiger": "#C8C8CC", "universe": "#9A9AA0", "fan": "#56565C", "other": "#3E3E44",
        "axis": "#2B2B31", "ink": "#A8A8AE", "dim": "#8A8A92", "mark": "#CFCFD2"}

def classify(url):
    if "/geiger" in url: return "geiger", "Geiger"
    if "/universe" in url: return "universe", "ownership (/universe)"
    if "/quotes" in url or "/macro" in url: return "other", "quotes"
    if "candles" in url:
        return "bar", "candles"
    return "other", "other"

def waterfall(run, title, maxms=10000, only_frame_sym=None):
    reqs = [q for q in run["requests"] if q["kind"] == "chartapi" and -500 <= q["start"] <= maxms]
    if only_frame_sym:
        reqs = [q for q in reqs if only_frame_sym in q["url"] or "/universe" in q["url"] or "/geiger" in q["url"] or "quotes?symbols=" + only_frame_sym == q["url"].split("/")[-1]]
    reqs = reqs[:60]
    W, left, rowh, top = 1150, 300, 12, 44
    H = top + rowh * len(reqs) + 34
    sx = lambda ms: left + (max(-500, min(maxms, ms)) + 500) / (maxms + 500) * (W - left - 10)
    o = [f'<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="{html.escape(title)}" style="background:#121216;border:.5px solid #2B2B31;border-radius:3px">']
    for s in range(0, maxms + 1, 1000):
        x = sx(s)
        o.append(f'<line x1="{x:.1f}" y1="{top-6}" x2="{x:.1f}" y2="{H-24}" stroke="{GREY["axis"]}" stroke-width="1"/>')
        o.append(f'<text x="{x:.1f}" y="{H-10}" fill="{GREY["dim"]}" font-size="11" text-anchor="middle">{s//1000}s</text>')
    for i, q in enumerate(reqs):
        y = top + i * rowh
        kind, label = classify(q["url"])
        end = q["end"] if q["end"] is not None else maxms
        x0, x1 = sx(q["start"]), sx(end)
        short = q["url"].replace("scintilla-massive-chart-api.fly.dev", "").split("&authority")[0]
        short = short if len(short) < 44 else short[:42] + "…"
        tip = f'{short} · {q["start"]}→{q["end"]} ms · {q["bytes"]} bytes' + (" · browser cache" if q["cache"] else "")
        o.append(f'<g><title>{html.escape(tip)}</title>'
                 f'<rect x="{left-245}" y="{y}" width="{W-15}" height="{rowh}" fill="transparent"/>'
                 f'<text x="{left-6}" y="{y+9}" fill="{GREY["ink"] if kind!="geiger" else GREY["mark"]}" font-size="11" text-anchor="end">{html.escape(short)}</text>'
                 f'<rect x="{x0:.1f}" y="{y+2}" width="{max(2, x1-x0):.1f}" height="{rowh-3}" rx="2" fill="{GREY[kind]}"/></g>')
    # milestones of the first chart frame (Hub) or the median pane (Station)
    fr = list(run["frames"].values())
    marks = []
    for k, lbl in [("price", "PRICE"), ("clouds", "CLOUDS"), ("fanAll", "FAN"), ("geiger", "GEIGER")]:
        v = med([f.get(k) for f in fr])
        if v is not None and v <= maxms: marks.append((v, lbl))
    for j, (v, lbl) in enumerate(sorted(marks)):
        x = sx(v)
        o.append(f'<line x1="{x:.1f}" y1="{8 + (j%3)*11}" x2="{x:.1f}" y2="{H-24}" stroke="{GREY["mark"]}" stroke-width="1" stroke-dasharray="3 3"/>')
        o.append(f'<text x="{x+3:.1f}" y="{12 + (j%3)*11}" fill="{GREY["mark"]}" font-size="11">{lbl} {v/1000:.1f}s</text>')
    o.append("</svg>")
    return "\n".join(o)

def pick_run(sc, variant, kind, rep=None):
    """the rep whose median price is the median across reps (a typical run, not the best)"""
    cands = []
    for p in sorted(glob.glob(str(FINAL / f"{sc}-{variant}-*.json"))):
        j = load(p)
        if not j or j.get("error"): continue
        for r in j["runs"]:
            if r["run"] == kind and r["frames"]:
                fan = med([f.get("fanAll") for f in r["frames"].values()])
                cl = med([f.get("clouds") for f in r["frames"].values()])
                cands.append(((cl or 99999) + (fan or 0), p, r))
    if not cands: return None
    cands.sort(key=lambda c: c[0])
    return cands[len(cands) // 2]

def table(sc, label):
    b, a = summarize(sc, "before"), summarize(sc, "after")
    keys = [("price", "price line"), ("clouds", "clouds"), ("fanAll", "RSI fan (all six lines)"), ("lens", "lens"), ("geiger", "Geiger chip")]
    rows = []
    for kind in ["cold", "warm"]:
        for k, name in keys:
            def cell(lst):
                if not lst: return "—"
                meds = [x[k][0] for x in lst]
                if all(m is None for m in meds): return "—"
                parts = []
                for x in lst:
                    m, w, n, tot = x[k]
                    parts.append(fmt(m) + (f" <span class=d>(worst {fmt(w)})</span>" if tot > 1 and w is not None else "") +
                                 (f" <span class=d>({n}/{tot} drew)</span>" if n < tot else ""))
                return " · ".join(parts)
            cb, ca = cell(b[kind]), cell(a[kind])
            if cb == "—" and ca == "—": continue
            rows.append(f"<tr><td>{kind}</td><td>{name}</td><td>{cb}</td><td>{ca}</td></tr>")
    return (f'<div class="table-wrap"><table><thead><tr><th>open</th><th>what appears</th><th>BEFORE (live) · run 1 · 2 · 3</th>'
            f'<th>AFTER (this branch) · run 1 · 2 · 3</th></tr></thead><tbody>{"".join(rows)}</tbody></table></div>')

def overall(sc, kind, k):
    out = {}
    for v in ["before", "after"]:
        xs = [x[k][0] for x in summarize(sc, v)[kind] if x[k][0] is not None]
        out[v] = int(S.median(xs)) if xs else None
    return out

if __name__ == "__main__":
    ctx = {}
    for sc in ["hubrow", "hubearly", "st8"]:
        ctx[sc] = {"table": table(sc, sc)}
        for kind in ["cold", "warm"]:
            for v in ["before", "after"]:
                pr = pick_run(sc, v, kind)
                ctx[sc][f"wf_{v}_{kind}"] = waterfall(pr[2], f"{sc} {v} {kind}") if pr else "<p>no run</p>"
                ctx[sc][f"src_{v}_{kind}"] = os.path.basename(pr[1]) if pr else ""
        for kind in ["cold", "warm"]:
            for k in ["price", "clouds", "fanAll", "geiger", "lens"]:
                ctx[sc][f"o_{kind}_{k}"] = overall(sc, kind, k)
    json.dump({sc: {k: v for k, v in c.items() if k.startswith("o_")} for sc, c in ctx.items()}, open(D / "final-summary.json", "w"), indent=1)
    ctx["txt"] = {f.stem: f.read_text() for f in (HERE / "text").glob("*.frag")}
    tpl = (HERE / "page.tpl").read_text()
    def sub(m):
        sc, key = m.group(1), m.group(2)
        return ctx[sc][key]
    import re
    out = re.sub(r"\{\{(\w+)\.(\w+)\}\}", sub, tpl)
    (HERE.parent / "CHART-SPEED.html").write_text(out)
    print("written", len(out))
