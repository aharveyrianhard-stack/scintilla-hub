# PF1 · the page's drawing helpers: inline SVG only (no library, no network), Scintilla's dark look, one fixed colour per
# entity (the dataviz palette's dark steps, validated on this surface), direct labels, a quiet grid, and a hover read-out.
import html, json, math

INK, INK2, INK3, LINE, PANEL, BG = "#d2d2d2", "#b4b4b8", "#8c8c92", "#2a2a30", "#121216", "#0b0b0e"
BLUE, ORANGE, AQUA, YELLOW, MAGENTA = "#3987e5", "#d95926", "#199e70", "#c98500", "#d55181"
UP, DOWN = "#19b37d", "#e0526c"          # direction, softened from the Hub's bull / bear so small text stays readable
_cid = [0]


def esc(s): return html.escape(str(s), quote=True)
def pct(x, signed=True, dp=1):
    if x is None or (isinstance(x, float) and not math.isfinite(x)): return "—"
    s = f"{abs(x):.{dp}f}%"; return f"({s})" if x < 0 else (("+" if signed else "") + s)
def pts(x, dp=1):
    if x is None: return "—"
    s = f"{abs(x):.{dp}f}"; return f"({s})" if x < 0 else "+" + s
def col(x): return "" if x is None else (' class="up"' if x > 0 else ' class="dn"' if x < 0 else "")
def cell(x, signed=True, dp=1, colour=True): return f"<td{col(x) if colour else ''}>{pct(x, signed, dp)}</td>"


def line_chart(series, title, w=1180, h=420, log=False, shades=(), unit="×", note="", ymin=None, ymax=None, fmt=None, step_series=None):
    """series: [{name, color, dates, values, dash?}] sharing one date axis (the first series' dates). Direct labels at the right."""
    _cid[0] += 1; cid = f"lc{_cid[0]}"; dates = series[0]["dates"]; n = len(dates)
    L, R, T, B = 54, 300, 16, 30; pw, ph = w - L - R, h - T - B
    vals = [v for s in series for v in s["values"] if v is not None]
    lo = min(vals) if ymin is None else ymin; hi = max(vals) if ymax is None else ymax
    f = (lambda v: math.log(v)) if log else (lambda v: v); flo, fhi = f(lo), f(hi); pad = (fhi - flo) * 0.05 or 1; flo -= pad; fhi += pad
    X = lambda i: L + pw * i / max(1, n - 1); Y = lambda v: T + ph * (1 - (f(v) - flo) / (fhi - flo))
    fmt = fmt or (lambda v: f"{v:.2f}{unit}")
    out = [f'<figure class="chart"><figcaption>{esc(title)}</figcaption><div class="cw"><svg id="{cid}" class="lc" viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}">']
    for a, b, lab in shades:                                            # shaded spans (pullbacks, out-of-market spells)
        ia = next((i for i, d in enumerate(dates) if d >= a), None); ib = next((i for i, d in enumerate(dates) if d >= b), n - 1)
        if ia is None: continue
        out.append(f'<rect x="{X(ia):.1f}" y="{T}" width="{max(1.5, X(ib) - X(ia)):.1f}" height="{ph}" fill="#8c8c92" opacity="0.13"/>')
        if lab: out.append(f'<text x="{(X(ia) + X(ib)) / 2:.1f}" y="{T + 12}" text-anchor="middle" class="ax">{esc(lab)}</text>')
    ticks = _ticks(lo, hi, log)
    for t in ticks:
        if not (flo <= f(t) <= fhi): continue
        out.append(f'<line x1="{L}" x2="{L + pw}" y1="{Y(t):.1f}" y2="{Y(t):.1f}" stroke="{LINE}" stroke-width="1"/><text x="{L - 8}" y="{Y(t) + 4:.1f}" text-anchor="end" class="ax">{esc(fmt(t))}</text>')
    yrs = sorted(set(d[:4] for d in dates)); every = max(1, len(yrs) // 11)
    if len(yrs) > 3:
        for k, y in enumerate(yrs):
            if k % every: continue
            i = next(i for i, d in enumerate(dates) if d[:4] == y)
            if X(i) > L + 14: out.append(f'<text x="{X(i):.1f}" y="{h - 9}" text-anchor="middle" class="ax">{y}</text>')
    else:
        mos = []; [mos.append(d[:7]) for d in dates if d[:7] not in mos]
        for k, m in enumerate(mos):
            if k % 3: continue
            i = next(i for i, d in enumerate(dates) if d[:7] == m)
            out.append(f'<text x="{X(i):.1f}" y="{h - 9}" text-anchor="middle" class="ax">{["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][int(m[5:]) - 1]} {m[2:4]}</text>')
    ends = []
    for s in series:
        p = [(X(i), Y(v)) for i, v in enumerate(s["values"]) if v is not None]
        if step_series and s["name"] in step_series:
            d = "M" + " ".join(f"{x:.1f},{y:.1f}" if k == 0 else f"H{x:.1f} V{y:.1f}" for k, (x, y) in enumerate(p))
        else: d = "M" + " L".join(f"{x:.1f},{y:.1f}" for x, y in p)
        out.append(f'<path d="{d}" fill="none" stroke="{s["color"]}" stroke-width="2" stroke-linejoin="round"{" stroke-dasharray=" + chr(34) + s["dash"] + chr(34) if s.get("dash") else ""}/>')
        ends.append([p[-1][1], s])
    ends.sort(key=lambda e: e[0])                                       # spread the end labels so none overlap
    for k in range(1, len(ends)):
        if ends[k][0] - ends[k - 1][0] < 15: ends[k][0] = ends[k - 1][0] + 15
    over = ends[-1][0] - (T + ph) if ends else 0
    if over > 0:
        for e in ends: e[0] -= over
    for y, s in ends:
        last = next(v for v in reversed(s["values"]) if v is not None)
        out.append(f'<circle cx="{L + pw + 9}" cy="{y - 4:.1f}" r="4" fill="{s["color"]}"/><text x="{L + pw + 18}" y="{y:.1f}" class="lb">{esc(s["name"])} <tspan class="lbv">{esc(fmt(last))}</tspan></text>')
    out.append(f'<line class="xh" x1="0" x2="0" y1="{T}" y2="{T + ph}" stroke="{INK3}" stroke-width="1" visibility="hidden"/><rect class="hit" x="{L}" y="{T}" width="{pw}" height="{ph}" fill="transparent"/></svg>')
    data = {"L": L, "pw": pw, "w": w, "dates": dates, "s": [{"n": s["name"], "c": s["color"], "v": s["values"]} for s in series], "unit": unit}
    out.append(f'<div class="tip" hidden></div><script type="application/json" data-for="{cid}">{json.dumps(data, separators=(",", ":"))}</script></div>')
    if note: out.append(f'<p class="cap">{note}</p>')
    out.append("</figure>"); return "".join(out)


def _ticks(lo, hi, log):
    if log:
        c = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64]; return [t for t in c if lo * 0.9 <= t <= hi * 1.1]
    span = hi - lo; raw = span / 5 if span > 0 else 1; mag = 10 ** math.floor(math.log10(raw)); step = min([1, 2, 2.5, 5, 10], key=lambda m: abs(m * mag - raw)) * mag
    t = math.floor(lo / step) * step; out = []
    while t <= hi + step * 0.5:
        out.append(round(t, 6)); t += step
    return out


def hbar_chart(rows, title, w=1180, unit="%", vmax=100, note="", label_w=400, bar_h=22, gap=12):
    """rows: [{label, value, color, right (text shown after the bar), sub?}] — one bar each, direct value label."""
    L, R, T = label_w, 250, 8; pw = w - L - R; h = T + len(rows) * (bar_h + gap) + 26
    out = [f'<figure class="chart"><figcaption>{esc(title)}</figcaption><div class="cw"><svg viewBox="0 0 {w} {h}" role="img" aria-label="{esc(title)}">']
    for t in range(0, int(vmax) + 1, 25):
        x = L + pw * t / vmax; out.append(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{T}" y2="{h - 24}" stroke="{LINE}" stroke-width="1"/><text x="{x:.1f}" y="{h - 8}" text-anchor="middle" class="ax">{t}{unit}</text>')
    for k, r in enumerate(rows):
        y = T + k * (bar_h + gap) + 2; bw = max(2, pw * max(0, r["value"]) / vmax)
        out.append(f'<text x="{L - 10}" y="{y + bar_h / 2 + 4:.1f}" text-anchor="end" class="lb{" hl" if r.get("hl") else ""}">{esc(r["label"])}</text>')
        out.append(f'<path d="M{L},{y} h{bw - 4:.1f} a4,4 0 0 1 4,4 v{bar_h - 8} a4,4 0 0 1 -4,4 h-{bw - 4:.1f} z" fill="{r["color"]}"><title>{esc(r["label"])}: {r["value"]:.0f}{unit}{" · " + esc(r.get("right", "")) if r.get("right") else ""}</title></path>')
        out.append(f'<text x="{L + bw + 8:.1f}" y="{y + bar_h / 2 + 4:.1f}" class="lb"><tspan class="lbv">{r["value"]:.0f}{unit}</tspan>{"  ·  " + esc(r["right"]) if r.get("right") else ""}</text>')
    out.append("</svg></div>")
    if note: out.append(f'<p class="cap">{note}</p>')
    out.append("</figure>"); return "".join(out)


HOVER_JS = """
document.querySelectorAll('svg.lc').forEach(function(svg){
  var box=svg.parentNode, tip=box.querySelector('.tip'), d=JSON.parse(box.querySelector('script[data-for="'+svg.id+'"]').textContent), xh=svg.querySelector('.xh');
  function move(ev){ var r=svg.getBoundingClientRect(), sx=d.w/r.width, x=(ev.clientX-r.left)*sx, n=d.dates.length;
    var i=Math.max(0,Math.min(n-1,Math.round((x-d.L)/d.pw*(n-1)))), px=d.L+d.pw*i/(n-1);
    xh.setAttribute('x1',px); xh.setAttribute('x2',px); xh.setAttribute('visibility','visible');
    var rows=d.s.map(function(s){var v=s.v[i]; return '<div><i style="background:'+s.c+'"></i>'+s.n+' <b>'+(v==null?'—':(d.unit==='%'?Math.round(v)+'%':v.toFixed(2)+d.unit))+'</b></div>';}).join('');
    tip.innerHTML='<div class="td">'+d.dates[i]+'</div>'+rows; tip.hidden=false;
    var left=(px/sx)+14; if(left>r.width-230) left=(px/sx)-230; tip.style.left=Math.max(0,left)+'px'; tip.style.top='18px'; }
  svg.addEventListener('mousemove',move); svg.addEventListener('touchstart',function(e){move(e.touches[0]);},{passive:true});
  svg.addEventListener('mouseleave',function(){tip.hidden=true; xh.setAttribute('visibility','hidden');});
});
"""

CSS = """
  :root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
  main{ max-width:1560px; margin:0 auto; padding:24px 16px 80px; }
  h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }
  .lead{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1180px; }
  .sub{ color:var(--ink3); margin-bottom:16px; max-width:1180px; }
  section{ background:var(--panel); border:1px solid var(--line); margin:0 0 6px; padding:14px 16px; }
  h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:26px 0 6px; color:var(--ink); font-weight:600; }
  h3{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:16px 0 8px; color:var(--ink); font-weight:600; }
  p{ margin:6px 0; max-width:1180px; }
  .tw{ overflow-x:auto; }
  table{ border-collapse:collapse; width:100%; min-width:980px; }
  th{ text-align:right; font-size:11px; letter-spacing:.06em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:bottom; white-space:nowrap; }
  td{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); vertical-align:top; }
  th:first-child, td:first-child{ text-align:left; color:var(--ink); white-space:normal; min-width:230px; }
  td.l, th.l{ text-align:left; white-space:normal; }
  tr.hl td{ background:#17171c; } tr.base td:first-child{ color:var(--ink2); }
  td.up{ color:#19b37d; } td.dn{ color:#e0526c; }
  b{ color:var(--ink); font-weight:600; } a{ color:var(--ink); }
  .chart{ margin:4px 0 2px; } figcaption{ color:var(--ink); font-size:12px; letter-spacing:.16em; text-transform:uppercase; margin-bottom:8px; }
  .cw{ position:relative; } .chart svg{ width:100%; height:auto; display:block; }
  .ax{ fill:#8c8c92; font:11px "SF Mono", Menlo, Consolas, monospace; } .lb{ fill:#b4b4b8; font:12px "SF Mono", Menlo, Consolas, monospace; } .lb.hl{ fill:#d2d2d2; font-weight:600; } .lbv{ fill:#d2d2d2; font-weight:600; }
  .tip{ position:absolute; background:#0b0b0e; border:1px solid var(--line); padding:8px 10px; font-size:12px; color:var(--ink2); pointer-events:none; min-width:210px; z-index:5; }
  .tip .td{ color:var(--ink3); margin-bottom:4px; } .tip i{ display:inline-block; width:9px; height:9px; border-radius:50%; margin-right:7px; } .tip b{ float:right; margin-left:14px; }
  .cap{ color:var(--ink3); font-size:12px; margin-top:6px; }
  .two{ display:grid; grid-template-columns:1fr 1fr; gap:18px; align-items:start; } .two > div{ min-width:0; }
  .pick{ border:1px solid var(--line); padding:12px 14px; } .pick h3{ margin-top:0; }
  .tag{ display:inline-block; border:1px solid var(--line); padding:1px 7px; font-size:11px; letter-spacing:.12em; color:var(--ink3); margin-right:6px; }
  ol,ul{ margin:6px 0 0 20px; padding:0; max-width:1180px; } li{ margin:5px 0; }
  details{ margin-top:14px; color:var(--ink3); font-size:13px; } summary{ cursor:pointer; letter-spacing:.2em; font-size:12px; color:var(--ink2); }
  details p, details li{ color:var(--ink2); } details.sc-pagespecs{ margin-top:26px; }
  .src{ font-size:12px; color:var(--ink3); } .src a{ color:var(--ink2); }
  .kpi{ display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:6px; margin:10px 0 4px; } .kpi > div{ border:1px solid var(--line); padding:10px 12px; }
  .kpi .v{ color:var(--ink); font-size:24px; line-height:1.2; } .kpi .k{ color:var(--ink3); font-size:11px; letter-spacing:.12em; text-transform:uppercase; } .kpi .n{ color:var(--ink2); font-size:12px; }
  @media (max-width:900px){ .two{ grid-template-columns:1fr; } .kpi{ grid-template-columns:1fr 1fr; } body{ font-size:13px; } main{ padding:16px 10px 70px; } }
"""
