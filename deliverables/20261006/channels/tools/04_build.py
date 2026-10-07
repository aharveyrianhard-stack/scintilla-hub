# CHN1 step 4 - the page. Reads ../data/results.json and ../data/series-<SYM>.json, writes ../CHANNELS.html (one self-contained file:
# inline SVG pictures, the tables, a small hover reader; no outside request). Every number on the page is read from results.json.
#
# Look: the Scintilla study look (dark panels, mono labels, greys with no channel above 210). Colour only where it carries meaning:
# daily up = green, daily down = red (Alan's standing rule), the Lab's own cyan for its rails, amber for the 200-day. The four were
# checked on the panel colour with the dataviz palette validator (lightness band, chroma, colour-blind separation, contrast): all pass.
import json, os, html, datetime as dt, bisect, math

HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); DATA = os.path.join(ROOT, "data")
R = json.load(open(os.path.join(DATA, "results.json")))
SER = {s: json.load(open(os.path.join(DATA, f"series-{s}.json"))) for s in ("SPY", "QQQ")}
BG, PANEL, LINE, GRID, INK, INK2, INK3 = "#0b0b0e", "#121216", "#2a2a30", "#1e1e24", "#d2d2d2", "#b4b4b8", "#8c8c92"
RAIL, MA, UP, DOWN = "#2fa5ba", "#c98500", "#22ad79", "#c0403c"
NAME = {"SPY": "SPY", "QQQ": "QQQ"}
MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]

def D(s): return dt.date.fromisoformat(s)
def dstr(s, year=True):
    d = D(s) if isinstance(s, str) else s
    return f"{d.day} {MON[d.month - 1]}" + (f" {d.year}" if year else "")
def usd(v, nd=2): return f"{v:,.{nd}f}"
def pct(v, nd=2, sign=True): return ("—" if v is None else (f"{v:+.{nd}f}%" if sign else f"{v:.{nd}f}%")).replace("-", "−")
def num(v, nd=1): return "—" if v is None else f"{v:.{nd}f}".replace("-", "−")
def mult(v): return "—" if v is None else (f"{v:.0f}×" if v >= 20 else f"{v:.1f}×")
def esc(s): return html.escape(str(s), quote=True)
def ses(n): return f"{int(n)} session" + ("" if int(n) == 1 else "s")
def below_pct(p): return f"bottom {p:.1f}%" if p < 50 else f"top {100 - p:.1f}%"

# ------------------------------------------------------------------------------------------------------------------------------- charts
def nice_step(span, target):
    raw = span / target; mag = 10 ** math.floor(math.log10(raw))
    for m in (1, 2, 2.5, 5, 10):
        if raw <= m * mag: return m * mag
    return 10 * mag

def chart(sym, x_from, fut_sessions, title, sub, zoom, W=1490, H=620):
    S = R["symbols"][sym]; ser = SER[sym]; col = {c: i for i, c in enumerate(ser["columns"])}
    rows = [r for r in ser["rows"] if r[0] >= x_from]; fut = ser["future"][:fut_sessions]
    L, Rm, T, B = 58, 214, 52, 30; PW, PH = W - L - Rm, H - T - B
    d0 = D(rows[0][0]); d1 = D(fut[-1][0]) if fut else D(rows[-1][0]); span = (d1 - d0).days
    def X(ds): return L + (D(ds) - d0).days / span * PW
    # y range: everything that matters inside the window
    los = [r[col["low"]] for r in rows] + [r[col["sma200"]] for r in rows if r[col["sma200"]]]; his = [r[col["high"]] for r in rows] + [f[1] for f in fut] + [r[col["u"]] for r in rows]
    if not zoom: los += [r[col["l2"]] for r in rows]
    else: los += [rows[-1][col["l1"]]]
    lo, hi = min(los), max(his); pad = (hi - lo) * 0.045; lo -= pad; hi += pad
    def Y(v): return T + (hi - v) / (hi - lo) * PH
    o = []; a = o.append
    cid = f"clip-{sym}-{'z' if zoom else 'a'}"
    a(f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{esc(title)}" data-chart="1" data-sym="{sym}" data-from="{rows[0][0]}" data-to="{d1}" data-l="{L}" data-pw="{PW}" data-w="{W}" data-t="{T}" data-ph="{PH}">')
    a(f'<defs><clipPath id="{cid}"><rect x="{L}" y="{T}" width="{PW}" height="{PH}"/></clipPath></defs>')
    a(f'<text x="{L}" y="18" fill="{INK}" font-size="12" letter-spacing="1.5">{esc(title)}</text><text x="{L}" y="36" fill="{INK3}" font-size="11">{esc(sub)}</text>')
    # grid: solid hairlines, one step off the surface
    st = nice_step(hi - lo, 7); v = math.ceil(lo / st) * st
    while v <= hi:
        a(f'<line x1="{L}" x2="{L + PW}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{GRID}" stroke-width="1"/><text x="{L - 8}" y="{Y(v) + 4:.1f}" fill="{INK3}" font-size="11" text-anchor="end">{v:,.0f}</text>'); v += st
    d = dt.date(d0.year, d0.month, 1)
    while d <= d1:
        if d >= d0 and (zoom or d.month == 1):
            x = L + (d - d0).days / span * PW
            lab = (MON[d.month - 1] + (" " + str(d.year) if d.month == 1 else "")) if zoom else str(d.year)
            a(f'<line x1="{x:.1f}" x2="{x:.1f}" y1="{T}" y2="{T + PH}" stroke="{GRID}" stroke-width="1"/>')
            if x + 4 + 7 * len(lab) <= L + PW: a(f'<text x="{x + 4:.1f}" y="{T + PH + 18}" fill="{INK3}" font-size="11">{lab}</text>')
        d = dt.date(d.year + (d.month == 12), d.month % 12 + 1, 1)
    a(f'<line x1="{L}" x2="{L + PW}" y1="{T + PH}" y2="{T + PH}" stroke="{LINE}" stroke-width="1"/>')
    a(f'<g clip-path="url(#{cid})">')
    # where the close is under the 200-day: a red wash between the two
    ci, mi = col["close"], col["sma200"]; i = 0
    while i < len(rows):
        if rows[i][mi] is not None and rows[i][ci] < rows[i][mi]:
            j = i
            while j + 1 < len(rows) and rows[j + 1][mi] is not None and rows[j + 1][ci] < rows[j + 1][mi]: j += 1
            a0, b0 = max(i - 1, 0), min(j + 1, len(rows) - 1)
            pts = [f"{X(rows[k][0]):.1f},{Y(rows[k][ci]):.1f}" for k in range(a0, b0 + 1)] + [f"{X(rows[k][0]):.1f},{Y(rows[k][mi]):.1f}" for k in range(b0, a0 - 1, -1)]
            a(f'<polygon points="{" ".join(pts)}" fill="{DOWN}" opacity="0.26"/>'); i = j + 1
        else: i += 1
    # the rails: one straight stroke through the first session of every source bar, as the Lab draws them; dotted past today
    today_x = X(rows[-1][0])
    rail_end = {}
    def rail(key, fidx, width, dash, alpha):
        seq = [(r[0], r[col[key]]) for r in rows] + [(f[0], f[fidx]) for f in fut]
        pts = [(X(ds), Y(v)) for k, (ds, v) in enumerate(seq) if k > 0 and v != seq[k - 1][1]]     # the first session of each source bar
        def at(x, p, q): return p[1] + (q[1] - p[1]) * (x - p[0]) / (q[0] - p[0])
        left = (L, at(L, pts[0], pts[1])); right = (L + PW, at(L + PW, pts[-2], pts[-1]))
        k = next(i for i, p in enumerate(pts) if p[0] > today_x); cut = (today_x, at(today_x, pts[k - 1] if k else left, pts[k]))
        solid = [left] + pts[:k] + [cut]; dotted = [cut] + pts[k:] + [right]; rail_end[key] = right[1]
        a(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in solid)}" fill="none" stroke="{RAIL}" stroke-width="{width}" stroke-opacity="{alpha}" stroke-linejoin="round"{dash}/>')
        a(f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in dotted)}" fill="none" stroke="{RAIL}" stroke-width="{width}" stroke-opacity="{alpha * 0.8:.2f}" stroke-dasharray="2 5" stroke-linecap="round"/>')
    rail("l2", 5, 1.6, "", 0.75); rail("m2", 4, 1.2, ' stroke-dasharray="7 5"', 0.75)
    rail("l1", 3, 1.6, "", 1); rail("m1", 2, 1.2, ' stroke-dasharray="7 5"', 1); rail("u", 1, 2.2, "", 1)
    # the 200-day
    mp = [f"{X(r[0]):.1f},{Y(r[mi]):.1f}" for r in rows if r[mi] is not None]
    a(f'<polyline points="{" ".join(mp)}" fill="none" stroke="{MA}" stroke-width="2" stroke-linejoin="round"/>')
    # price: daily closes, green on an up day, red on a down day
    up, dn = [], []
    for k in range(1, len(rows)):
        seg = f"M{X(rows[k - 1][0]):.1f} {Y(rows[k - 1][ci]):.1f}L{X(rows[k][0]):.1f} {Y(rows[k][ci]):.1f}"
        (up if rows[k][ci] >= rows[k - 1][ci] else dn).append(seg)
    sw = 1.7 if zoom else 1.25
    a(f'<path d="{"".join(dn)}" fill="none" stroke="{DOWN}" stroke-width="{sw}" stroke-linecap="round"/><path d="{"".join(up)}" fill="none" stroke="{UP}" stroke-width="{sw}" stroke-linecap="round"/>')
    # the rebounds: the first 60 sessions off each low as one straight stroke, and the low itself, numbered
    idx = {r[0]: k for k, r in enumerate(rows)}
    for n, e in enumerate(S["episodes"], 1):
        lo_d = e["low"]["date"]
        if lo_d not in idx: continue
        k = idx[lo_d]; x, y = X(lo_d), Y(rows[k][ci]); f60 = e["rebound"]["first_60_sessions"]
        if f60 and f60["date"] in idx:
            x2, y2 = X(f60["date"]), Y(rows[idx[f60["date"]]][ci])
            a(f'<line x1="{x:.1f}" y1="{y:.1f}" x2="{x2:.1f}" y2="{y2:.1f}" stroke="{INK}" stroke-width="1.8" stroke-linecap="round"/>')
        a(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="5" fill="{INK}" stroke="{PANEL}" stroke-width="2"/>')
        a(f'<text x="{x:.1f}" y="{y + 21:.1f}" fill="{INK}" font-size="12" text-anchor="middle" paint-order="stroke" stroke="{PANEL}" stroke-width="4"><tspan font-weight="700">{n}</tspan>{" · " + mult(f60["multiple_of_channel_slope"]) if f60 else ""}</text>')
    # the days that matter at the top rail
    ur = S["upper_rail"]; notes = []
    for g in ur["stretches_of_closes_above"]:
        if g["peak_close_date"] in idx and not g["still_above_at_the_last_close"]:
            notes.append((g["peak_close_date"], rows[idx[g["peak_close_date"]]][ci], f"closed above the rail on {g['sessions_closed_above']} sessions", -14))
            aft = g.get("afterwards")
            if aft and aft["lowest_close_date"] in idx:
                notes.append((aft["lowest_close_date"], aft["lowest_close"], f"{pct(aft['fall_from_peak_close_pct'], 1)} in {aft['sessions_peak_to_low']} sessions", 20))
    if not ur["stretches_of_closes_above"]:
        nc = ur["nearest_close"]
        if nc["date"] in idx:
            notes.append((nc["date"], rows[idx[nc["date"]]][col["high"]], "the high the rail is drawn through", -14))
            aft = nc.get("afterwards")
            if aft and aft["lowest_close_date"] in idx: notes.append((aft["lowest_close_date"], aft["lowest_close"], f"{pct(aft['fall_pct'], 1)} in {aft['sessions']} sessions", 20))
    if zoom:
        for ds, v, txt, dy in notes:
            x, y = X(ds), Y(v)
            a(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4" fill="{PANEL}" stroke="{INK2}" stroke-width="1.6"/>')
            if dy < 0: a(f'<text x="{x + 6:.1f}" y="{y - 12:.1f}" fill="{INK2}" font-size="11" text-anchor="end" paint-order="stroke" stroke="{PANEL}" stroke-width="5">{esc(dstr(ds, False))} · {esc(txt)}</text>')
            else: a(f'<text x="{x:.1f}" y="{y + 24:.1f}" fill="{INK2}" font-size="11" text-anchor="middle" paint-order="stroke" stroke="{PANEL}" stroke-width="5">{esc(dstr(ds, False))} · {esc(txt)}</text>')
    # today
    tx, ty = today_x, Y(rows[-1][ci])
    a(f'<line x1="{tx:.1f}" x2="{tx:.1f}" y1="{T}" y2="{T + PH}" stroke="{INK3}" stroke-width="1" stroke-opacity="0.55"/>')
    a(f'<circle cx="{tx:.1f}" cy="{ty:.1f}" r="5" fill="{INK}" stroke="{PANEL}" stroke-width="2"/>')
    a('</g>')
    a(f'<text x="{tx:.1f}" y="{T - 5}" fill="{INK3}" font-size="11" text-anchor="middle">{esc(dstr(rows[-1][0], False))}</text>')
    # direct labels at the right edge, pushed apart, each with a short key and a leader to its own line
    t = S["today"]; c1, c2 = S["channels"][0]["today"], S["channels"][1]["today"]
    def endy(fidx, key): return rail_end[key]
    labs = [(endy(1, "u"), RAIL, "1W B2 = 2W B2", usd(c1["upper"]), ""), (ty, None, "close", usd(t["close"]), ""),
            (endy(2, "m1"), RAIL, "1W B4", usd(c1["mid"]), "7 5"), (Y(rows[-1][mi]), MA, "200-day", usd(t["sma200"]), ""),
            (endy(4, "m2"), RAIL, "2W B4", usd(c2["mid"]), "7 5"), (endy(3, "l1"), RAIL, "1W B6", usd(c1["lower"]), ""), (endy(5, "l2"), RAIL, "2W B6", usd(c2["lower"]), "")]
    vis = [l for l in labs if T - 2 <= l[0] <= T + PH + 2]; hidden = [l for l in labs if l not in vis]
    vis.sort(key=lambda l: l[0]); ys = [l[0] for l in vis]; GAP = 17
    for k in range(1, len(ys)): ys[k] = max(ys[k], ys[k - 1] + GAP)
    over = ys[-1] - (T + PH - (30 if hidden else 2)) if ys else 0
    if over > 0:
        ys[-1] -= over
        for k in range(len(ys) - 2, -1, -1): ys[k] = min(ys[k], ys[k + 1] - GAP)
    lx = L + PW + 12
    for (y0, colr, name, val, dash), y in zip(vis, ys):
        src_x = today_x if name in ("close", "200-day") else L + PW
        a(f'<polyline points="{src_x + 4:.1f},{y0:.1f} {lx - 2:.1f},{y0:.1f} {lx + 6:.1f},{y:.1f}" fill="none" stroke="{colr or INK}" stroke-width="1" stroke-opacity="0.5"/>')
        if colr: a(f'<line x1="{lx + 8}" x2="{lx + 26}" y1="{y:.1f}" y2="{y:.1f}" stroke="{colr}" stroke-width="2"{(" stroke-dasharray=" + chr(34) + "5 3" + chr(34)) if dash else ""}/>')
        else: a(f'<circle cx="{lx + 17}" cy="{y:.1f}" r="4" fill="{INK}"/>')
        a(f'<text x="{lx + 32}" y="{y + 4:.1f}" fill="{INK2}" font-size="11">{esc(name)} <tspan fill="{INK}">{val}</tspan></text>')
    if hidden:
        a(f'<text x="{lx + 8}" y="{T + PH - 6}" fill="{INK3}" font-size="11">below this view:</text><text x="{lx + 8}" y="{T + PH + 10}" fill="{INK3}" font-size="11">{esc(", ".join(f"{l[2]} {l[3]}" for l in hidden))}</text>')
    if zoom:   # the room, written at today's line
        room = t["upper_rail"]["room_pct"]; yu = Y(c1["upper"])
        txt = (f"{abs(room):.2f}% · ${abs(t['upper_rail']['room_usd']):.2f} " + ("of room to the rail" if room > 0 else "ABOVE the rail"))
        a(f'<line x1="{tx - 9:.1f}" x2="{tx - 9:.1f}" y1="{min(yu, ty):.1f}" y2="{max(yu, ty):.1f}" stroke="{INK}" stroke-width="1.4"/>')
        a(f'<text x="{tx - 16:.1f}" y="{min(yu, ty) - 30:.1f}" fill="{INK}" font-size="12" font-weight="700" text-anchor="end" paint-order="stroke" stroke="{PANEL}" stroke-width="4">{esc(txt)}</text>')
        a(f'<polyline points="{tx - 9:.1f},{min(yu, ty):.1f} {tx - 9:.1f},{min(yu, ty) - 34:.1f} {tx - 13:.1f},{min(yu, ty) - 34:.1f}" fill="none" stroke="{INK}" stroke-width="1" stroke-opacity="0.6"/>')
    a(f'<line class="hair" x1="0" x2="0" y1="{T}" y2="{T + PH}" stroke="{INK2}" stroke-width="1" visibility="hidden"/><rect class="hit" x="{L}" y="{T}" width="{PW}" height="{PH}" fill="transparent"/>')
    a('</svg>')
    return "".join(o)

STRIP_N = 120          # sessions drawn after each low
def strip_paths(sym):
    """For each episode: the gain since its low, session by session, and the dollars the rail climbed over the same sessions as a
    percentage of the same starting price - so the gap between the two lines IS the multiple of the channel's slope."""
    S = R["symbols"][sym]; ser = SER[sym]; col = {c: i for i, c in enumerate(ser["columns"])}; idx = {r[0]: k for k, r in enumerate(ser["rows"])}; out = []
    for n, e in enumerate(S["episodes"], 1):
        k = idx[e["low"]["date"]]; rows = ser["rows"][k:k + STRIP_N + 1]; c0 = rows[0][col["close"]]; u0 = rows[0][col["u"]]
        out.append({"n": n, "e": e, "gain": [(r[col["close"]] / c0 - 1) * 100 for r in rows], "rail": [(r[col["u"]] - u0) / c0 * 100 for r in rows], "dates": [r[0] for r in rows]})
    return out
STRIPS = {s_: strip_paths(s_) for s_ in ("SPY", "QQQ")}
STRIP_MAX = math.ceil(max(max(p["gain"]) for v in STRIPS.values() for p in v) / 10) * 10

def rebound_strip(sym, W=1490, H=262):
    """Small multiples: one panel per low, all on one scale, so the rebounds can be compared at a glance."""
    paths = STRIPS[sym]; gap = 22; pw = (W - 4 * gap) / 5; L, T, B, Rm = 34, 46, 24, 46; PW, PH = pw - L - Rm, H - T - B
    o = [f'<svg viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="{sym}: the first {STRIP_N} sessions after each low, as gain since the low, beside the channel\'s own climb">']
    for j, p in enumerate(paths):
        x0 = j * (pw + gap); e = p["e"]; rb = e["rebound"]; g = p["gain"]; rl = p["rail"]
        def X(i): return x0 + L + i / STRIP_N * PW
        def Y(v): return T + (STRIP_MAX - v) / STRIP_MAX * PH
        f20, f60 = rb["first_20_sessions"], rb["first_60_sessions"]
        tip = (f"{sym} {p['n']}, low {dstr(e['low']['date'])} at {usd(e['low']['close'])}. After 20 sessions {pct(f20['gain_pct'], 1)} ({mult(f20['multiple_of_channel_slope'])} the channel's slope), after 60 sessions {pct(f60['gain_pct'], 1)} ({mult(f60['multiple_of_channel_slope'])}), "
               f"after {len(g) - 1} sessions {pct(g[-1], 1)}; the rail climbed {pct(rl[-1], 1)} of the same starting price.")
        o.append(f'<g><title>{esc(tip)}</title><rect x="{x0:.1f}" y="0" width="{pw:.1f}" height="{H}" fill="transparent"/>')
        o.append(f'<text x="{x0:.1f}" y="14" fill="{INK}" font-size="12" letter-spacing="1"><tspan font-weight="700">{sym} {p["n"]}</tspan> · low {esc(dstr(e["low"]["date"]))}</text>')
        o.append(f'<text x="{x0:.1f}" y="32" fill="{INK3}" font-size="11">20 sessions {mult(f20["multiple_of_channel_slope"])} · 60 sessions {mult(f60["multiple_of_channel_slope"])}</text>')
        for v in range(0, STRIP_MAX + 1, 10):
            o.append(f'<line x1="{X(0):.1f}" x2="{X(STRIP_N):.1f}" y1="{Y(v):.1f}" y2="{Y(v):.1f}" stroke="{LINE if v == 0 else GRID}" stroke-width="1"/><text x="{X(0) - 6:.1f}" y="{Y(v) + 4:.1f}" fill="{INK3}" font-size="11" text-anchor="end">{v}%</text>')
        for i in (20, 60, 120):
            o.append(f'<line x1="{X(i):.1f}" x2="{X(i):.1f}" y1="{T}" y2="{T + PH}" stroke="{GRID}" stroke-width="1"/><text x="{X(i):.1f}" y="{T + PH + 16}" fill="{INK3}" font-size="11" text-anchor="middle">{i}</text>')
        o.append(f'<polyline points="{" ".join(f"{X(i):.1f},{Y(v):.1f}" for i, v in enumerate(rl))}" fill="none" stroke="{RAIL}" stroke-width="2" stroke-linejoin="round"/>')
        up, dn = [], []
        for i in range(1, len(g)): (up if g[i] >= g[i - 1] else dn).append(f"M{X(i - 1):.1f} {Y(g[i - 1]):.1f}L{X(i):.1f} {Y(g[i]):.1f}")
        o.append(f'<path d="{"".join(dn)}" fill="none" stroke="{DOWN}" stroke-width="1.8" stroke-linecap="round"/><path d="{"".join(up)}" fill="none" stroke="{UP}" stroke-width="1.8" stroke-linecap="round"/>')
        for key in ("to_2W_B4_mid", "to_1W_B4_mid", "to_upper_touch"):      # where it reached each line, when that came inside the window
            v = rb[key]
            if v and v["sessions"] < len(g): o.append(f'<circle cx="{X(v["sessions"]):.1f}" cy="{Y(g[v["sessions"]]):.1f}" r="4" fill="{PANEL}" stroke="{INK}" stroke-width="1.6"/>')
        o.append(f'<circle cx="{X(len(g) - 1):.1f}" cy="{Y(g[-1]):.1f}" r="4" fill="{INK}" stroke="{PANEL}" stroke-width="2"/>')
        ye, yr = Y(g[-1]), Y(rl[-1])
        if yr - ye < 15: yr = ye + 15
        o.append(f'<text x="{X(len(g) - 1) + 8:.1f}" y="{ye + 4:.1f}" fill="{INK}" font-size="11">{pct(g[-1], 0)}</text><text x="{X(len(g) - 1) + 8:.1f}" y="{yr + 4:.1f}" fill="{INK3}" font-size="11">{pct(rl[-1], 0)}</text></g>')
    o.append('</svg>'); return "".join(o)

def meter(sym, ci):
    """Position inside one channel: lower rail = 0, upper rail = 100, on a 0-110 track. Plain boxes and text, so it reads at full size anywhere."""
    S = R["symbols"][sym]; c = S["channels"][ci]; t = c["today"]; pos = t["position_pct_of_height"]; mapos = t["sma200_position_pct_of_height"]
    def X(p): return f"{max(0, min(110, p)) / 110 * 100:.2f}%"
    fill = f'<i class="fill" style="width:{X(min(pos, 100))}"></i>' + (f'<i class="over" style="left:{X(100)};width:{(min(pos, 110) - 100) / 110 * 100:.2f}%"></i>' if pos > 100 else "")
    return (f'<div class="meter" role="img" aria-label="{sym} is {pos:.1f} percent of the way from the lower rail to the upper rail of its {c["source_timeframe"]} channel">'
            f'<div class="mh"><span>{sym} · {c["source_timeframe"]} channel</span><b>{pos:.1f}% of the way up</b></div>'
            f'<div class="mt"><i class="trk"></i>{fill}<i class="tk" style="left:{X(0)}"></i><i class="tk" style="left:{X(50)}"></i><i class="tk" style="left:{X(100)}"></i>'
            f'<i class="ma" style="left:{X(mapos)}"></i><i class="dot" style="left:{X(pos)}"></i></div>'
            f'<div class="mb"><span style="left:{X(0)}">{c["ids"]["lower"]} {usd(t["lower"])}</span><span class="c" style="left:{X(50)}">{c["ids"]["mid"]} {usd(t["mid"])}</span><span class="r" style="left:{X(100)}">{c["ids"]["upper"]} {usd(t["upper"])}</span></div>'
            f'<div class="mn">close {usd(S["today"]["close"])} · 200-day at {mapos:.0f}% of the way up</div></div>')

# ------------------------------------------------------------------------------------------------------------------------------- tables
def table(head, rows, cls="", minw=None):
    th = "".join(f"<th>{h}</th>" for h in head)
    tr = "".join("<tr>" + "".join(c if c.startswith("<td") else f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tw"><table class="{cls}"{f" style=" + chr(34) + "min-width:" + str(minw) + "px" + chr(34) if minw else ""}><thead><tr>{th}</tr></thead><tbody>{tr}</tbody></table></div>'

def rails_table():
    rows = []
    for sym in ("SPY", "QQQ"):
        S = R["symbols"][sym]
        for ci, c in enumerate(S["channels"]):
            L = R["lab_sources"]; tf = c["source_timeframe"]; sl = c["slope"]; n0 = dstr(c["equations"]["n"].split("snapshot bar of ")[1][:10])
            unit = "week" if tf == "1W" else "two-week bar"
            for li, (key, role) in enumerate((("upper", "upper rail"), ("mid", "midline (arithmetic)"), ("lower", "lower rail"))):
                lab = c["ids"][key] + (" <span class=dim>= " + ("2W B2" if tf == "1W" else "1W B2") + "</span>" if key == "upper" else "")
                r = []
                if li == 0:
                    r.append(f'<td rowspan="3"><b>{sym}</b><br>B · {tf}<br><span class=dim>record {c["record_hash"]}</span></td>')
                r += [f"<td><b>{lab}</b><br><span class=dim>{role}</span></td>", f'<td>{usd(c["today"][key], 4)}</td>',
                      f'<td class=eq>{c["equations"][key].replace(" x n", " × n").replace("+", "+ ").replace("  ", " ")}</td>']
                if li == 0:
                    r.append(f'<td rowspan="3">n = {unit}s after the {unit} of {n0}<br><span class=dim>top rail drawn from {dstr(c["upper_anchors"][0]["date"])} ({usd(c["upper_anchors"][0]["price"])}) to {dstr(c["upper_anchors"][1]["date"])} ({usd(c["upper_anchors"][1]["price"])})</span></td>')
                    r.append(f'<td rowspan="3">{sl["lab_native"]:.7f} USD per {tf} bar<br><span class=dim>= ${sl["native_usd_per_calendar_week"]:.4f} a week</span></td>')
                    r.append(f'<td rowspan="3"><b>{sl["lab_strip_reads"]}</b><br><span class=dim>{sl["usd_per_7d"]:.4f} USD / 7d</span></td>')
                    r.append(f'<td rowspan="3"><b>{pct(sl["pct_of_close_per_month"], 2)}</b> a month of today\'s close<br>{pct(sl["pct_of_mid_per_month"], 2)} a month of its midline<br><span class=dim>${sl["usd_per_month"]:.2f} a month · {pct(sl["pct_of_close_per_year"], 1)} a year · it was {pct(c["life"]["slope_pct_of_close_per_month_at_the_start"], 2)} a month when the channel began</span></td>')
                rows.append(r)
    return table(["INDEX · CHANNEL", "LINE (EXACT LABEL)", "THIS WEEK", "EQUATION", "WHAT n COUNTS", "SLOPE · LAB'S NATIVE UNIT", "SLOPE · LAB'S STRIP", "SLOPE · % A MONTH"], rows, "rails", 1480)

def today_table():
    rows = []
    for sym in ("SPY", "QQQ"):
        S = R["symbols"][sym]
        for c in S["channels"]:
            t = c["today"]; lf = c["life"]
            rows.append([f'<b>{sym}</b> · B · {c["source_timeframe"]}', usd(t["close"]), usd(t["upper"]), usd(t["mid"]), usd(t["lower"]),
                         f'<b>{t["position_pct_of_height"]:.1f}%</b>',
                         f'<b>{pct(t["move_to_upper_pct"])}</b> <span class=dim>{"−" if t["move_to_upper_usd"] < 0 else "+"}${abs(t["move_to_upper_usd"]):.2f}</span>',
                         f'{pct(t["move_to_mid_pct"])} <span class=dim>−${abs(t["move_to_mid_usd"]):.2f}</span>', f'{pct(t["move_to_lower_pct"])} <span class=dim>−${abs(t["move_to_lower_usd"]):.2f}</span>',
                         f'{lf["share_inside_pct"]:.1f}% <span class=dim>of {lf["sessions"]:,} closes</span>', f'{lf["share_of_closes_above_the_midline_pct"]:.1f}%'])
    return table(["INDEX · CHANNEL", "CLOSE 6 OCT", "UPPER RAIL", "MIDLINE", "LOWER RAIL", "POSITION<br>0% = lower · 100% = upper", "MOVE TO THE UPPER RAIL", "MOVE TO THE MIDLINE", "MOVE TO THE LOWER RAIL", "CLOSES INSIDE<br>since the channel began", "CLOSES ABOVE<br>ITS MIDLINE"], rows, "", 1380)

def pierce_table(sym):
    S = R["symbols"][sym]; rows = []; k = 0
    for n, e in enumerate(S["episodes"], 1):
        for p in e["pierces"]:
            k += 1
            rows.append([str(k), dstr(p["pierce"]), dstr(p["back_above"]) if p["back_above"] else "—", str(p["sessions_below"]), f'{dstr(p["low_close_date"], False)} · {usd(p["low_close"])}',
                         pct(p["max_depth_close_pct"]), pct(p["max_depth_low_pct"]), f'{sym} {n}'])
    return table(["#", "FIRST CLOSE<br>BELOW", "BACK<br>ABOVE", "SESSIONS<br>BELOW", "LOWEST<br>CLOSE", "DEEPEST<br>CLOSE", "DEEPEST<br>INTRADAY", "EPISODE"], rows, "", 700)

def leg(v, with_gain=True):
    if v is None: return '<span class=dim>not reached</span>'
    s = f'<b>{v["sessions"]}</b>'
    if with_gain: s += f' · {pct(v["gain_pct"], 1)}'
    s += f' · <b>{mult(v["multiple_of_channel_slope"])}</b>'
    if v["later_pierces_on_the_way"]: s += f' <span class=dim title="another pierce of the 200-day came before this was reached">†{v["later_pierces_on_the_way"]}</span>'
    return s

def low_table():
    rows = []
    for sym in ("SPY", "QQQ"):
        S = R["symbols"][sym]
        for n, e in enumerate(S["episodes"], 1):
            lo = e["low"]; o = e["oscillators_at_low"]; md = e["max_depth"]
            rows.append([f'<b>{sym} {n}</b><br><span class=dim>{esc(e["label"])}</span>',
                         f'<b>{e["sessions_closed_below"]}</b><br><span class=dim>in {len(e["pierces"])} pierce{"s" if len(e["pierces"]) > 1 else ""}</span>',
                         f'<b>{dstr(lo["date"])}</b><br>{usd(lo["close"])}',
                         f'<b>{pct(md["by_close_pct"])}</b><br><span class=dim>{dstr(md["by_close_date"])}</span>', f'{pct(md["by_intraday_low_pct"])}<br><span class=dim>{dstr(md["by_intraday_low_date"])}</span>',
                         f'<b>{num(o["rsi14"])}</b><br><span class=dim>{below_pct(o["rsi14_own_percentile"])}</span>',
                         f'<b>{num(o["williams14"])}</b><br><span class=dim>{below_pct(o["williams14_own_percentile"])}</span>',
                         f'{num(o["lowest_rsi14_in_episode"])}<br><span class=dim>{dstr(o["lowest_rsi14_date"])}</span>',
                         f'<b>{num(lo["position_1W_B_pct"])}%</b>', f'<b>{num(lo["position_2W_B_pct"])}%</b>'])
    return table(["EPISODE", "SESSIONS CLOSED<br>BELOW THE 200-DAY", "THE LOW<br>lowest close", "DEEPEST CLOSE<br>vs the 200-day", "DEEPEST INTRADAY<br>vs the 200-day", "RSI 14 AT THE LOW<br>and its rank",
                  "WILLIAMS %R AT THE LOW<br>and its rank", "LOWEST RSI 14<br>IN THE EPISODE", "POSITION IN 1W B<br>0% = 1W B6", "POSITION IN 2W B<br>0% = 2W B6"], rows, "", 1300)

def rebound_table():
    rows = []
    for sym in ("SPY", "QQQ"):
        S = R["symbols"][sym]
        for n, e in enumerate(S["episodes"], 1):
            lo = e["low"]; rb = e["rebound"]
            rows.append([f'<b>{sym} {n}</b> <span class=dim>{dstr(lo["date"])}</span>',
                         f'<b>{lo["sessions_to_reclaim"]}</b>' if lo["sessions_to_reclaim"] is not None else "—",
                         leg(rb["to_2W_B4_mid"]), leg(rb["to_1W_B4_mid"]), leg(rb["to_upper_touch"]),
                         f'{pct(rb["first_20_sessions"]["gain_pct"], 1)} · <b>{mult(rb["first_20_sessions"]["multiple_of_channel_slope"])}</b>',
                         f'{pct(rb["first_60_sessions"]["gain_pct"], 1)} · <b>{mult(rb["first_60_sessions"]["multiple_of_channel_slope"])}</b>'])
    return table(["FROM THE LOW OF", "BACK ABOVE<br>THE 200-DAY<br>sessions", "TO THE 2W B4 MIDLINE<br>sessions · gain · × channel slope", "TO THE 1W B4 MIDLINE<br>sessions · gain · × channel slope",
                  "TO THE UPPER RAIL 1W B2 = 2W B2<br>sessions · gain · × channel slope", "FIRST 20 SESSIONS<br>gain · × slope", "FIRST 60 SESSIONS<br>gain · × slope"], rows, "", 1300)

def speed_table():
    rows = []
    for key, name in (("first_20_sessions", "first 20 sessions off the low"), ("first_60_sessions", "first 60 sessions off the low"), ("to_2W_B4_mid", "low to the 2W B4 midline"),
                      ("to_1W_B4_mid", "low to the 1W B4 midline"), ("to_upper_touch", "low to the upper rail")):
        r = [name]
        for sym in ("SPY", "QQQ"):
            st = R["symbols"][sym]["rebound_summary"][key]; m = st["multiple_of_channel_slope"]; s = st["sessions"]
            r.append(f'<b>{mult(m["median"])}</b> <span class=dim>{" · ".join(mult(v) for v in m["values"])}</span>')
            r.append("20" if key == "first_20_sessions" else "60" if key == "first_60_sessions" else f'<b>{s["median"]:.0f}</b> <span class=dim>{" · ".join(f"{v:.0f}" for v in s["values"])}</span>')
        rows.append(r)
    return table(["THE STRETCH", "SPY · × SLOPE<br>median · each", "SPY · SESSIONS<br>median · each", "QQQ · × SLOPE<br>median · each", "QQQ · SESSIONS<br>median · each"], rows, "", 1100)

def pace_table():
    S = R["symbols"]["SPY"]; t = S["today"]; rows = []
    for p in t["sessions_to_upper_rail"]:
        if p["pace"].startswith("fastest"): continue      # a two-session stretch; not a pace anyone can plan on
        rows.append([esc(p["pace"]), mult(p["multiple_of_channel_slope"]), f'${p["usd_per_7d"]:.2f} a week', f'<b>{p["sessions"]}</b>' if p["sessions"] is not None else "never"])
    return table(["IF SPY CLIMBS AT…", "× CHANNEL SLOPE", "IN TODAY'S DOLLARS", "SESSIONS TO REACH THE RAIL"], rows, "", 760)

# --------------------------------------------------------------------------------------------------------------------------------- page
spy, qqq = R["symbols"]["SPY"], R["symbols"]["QQQ"]; ts, tq = spy["today"], qqq["today"]
s1, s2, q1, q2 = spy["channels"][0], spy["channels"][1], qqq["channels"][0], qqq["channels"][1]
sr, qr = spy["rebound_summary"], qqq["rebound_summary"]
qg = qqq["upper_rail"]["stretches_of_closes_above"]; qold = next(g for g in qg if not g["still_above_at_the_last_close"]); qnow = next(g for g in qg if g["still_above_at_the_last_close"])
snear = spy["upper_rail"]["nearest_close"]; flat = tq["if_price_stands_still_the_rail_passes_it"]
E = {sym: {e["label"]: e for e in R["symbols"][sym]["episodes"]} for sym in ("SPY", "QQQ")}
s25, s26 = E["SPY"]["Mar 2025 – May 2025"], E["SPY"]["Mar 2026"]; q25, q26 = E["QQQ"]["Mar 2025 – May 2025"], E["QQQ"]["Mar 2026"]
pace = {p["pace"]: p for p in ts["sessions_to_upper_rail"]}; p_med = pace["median rebound, low to the 2W B4 midline"]
p_all = [p["sessions"] for k, p in pace.items() if k.startswith("median")]
session = dstr(ts["session"]); built = dt.datetime.utcnow().strftime("%d %b %Y %H:%M UTC")
par_s, par_q = spy["basis"]["parity_with_lab_bars"], qqq["basis"]["parity_with_lab_bars"]
packs = R["lab_sources"]["packs"]; reg = R["lab_sources"]["installed_registry"]; hub_s, hub_q = spy["pierces"]["on_the_hub_price_basis"], qqq["pierces"]["on_the_hub_price_basis"]
strip_s = spy["lab_slope_strip_reproduced"]; mp_s, mp_q = spy["sma200_pace"], qqq["sma200_pace"]
cell = [x["reads"] for x in mp_s["lab_strip_cell_last_10_pairs_pct_per_7d"]]; wk = [x["reads"] for x in mp_s["lab_strip_cell_last_10_pairs_pct_per_7d"] if x["days_between_the_two_values"] == 3]
mid = [x["reads"] for x in mp_s["lab_strip_cell_last_10_pairs_pct_per_7d"] if x["days_between_the_two_values"] == 1]

CSS = """
  :root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }
  *{ box-sizing:border-box; }
  body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
  main{ max-width:1560px; margin:0 auto; padding:24px 16px 80px; }
  h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }
  .lead{ color:var(--ink); font-size:16px; margin:10px 0 8px; max-width:1180px; }
  .sub{ color:var(--ink3); margin:0 0 16px; max-width:1180px; font-size:12px; }
  section{ background:var(--panel); border:1px solid var(--line); margin:0 0 6px; padding:14px 16px 16px; }
  h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:2px 0 8px; color:var(--ink); font-weight:600; }
  h3{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:18px 0 8px; color:var(--ink); font-weight:600; }
  p{ margin:6px 0; max-width:1180px; }
  ul.plain{ margin:6px 0 4px 18px; padding:0; max-width:1180px; } ul.plain li{ margin:7px 0; color:var(--ink2); }
  b{ color:var(--ink); font-weight:600; } .dim{ color:var(--ink3); }
  .tw{ overflow-x:auto; -webkit-overflow-scrolling:touch; }
  table{ border-collapse:collapse; width:100%; }
  th{ text-align:left; font-size:11px; letter-spacing:.1em; color:var(--ink3); font-weight:400; padding:6px 10px 6px 0; border-bottom:1px solid var(--line); white-space:nowrap; vertical-align:bottom; line-height:1.35; }
  td{ padding:7px 10px 7px 0; border-bottom:1px solid #1c1c22; font-size:13px; text-align:left; white-space:nowrap; color:var(--ink2); vertical-align:top; line-height:1.45; }
  table.rails td{ white-space:normal; } table.rails td:nth-child(n+2){ min-width:120px; } td.eq{ white-space:nowrap !important; color:var(--ink); }
  .cw{ overflow-x:auto; -webkit-overflow-scrolling:touch; position:relative; }
  .cw svg{ display:block; width:100%; min-width:1490px; height:auto; }
  .legend{ color:var(--ink3); font-size:11px; margin:8px 0 0; display:flex; flex-wrap:wrap; gap:6px 20px; max-width:none; }
  .legend i{ display:inline-block; width:22px; height:0; border-top:2px solid; vertical-align:middle; margin-right:7px; }
  .legend i.dash{ border-top-style:dashed; } .legend i.blk{ height:9px; border:0; } .legend i.dot{ width:9px; height:9px; border:0; border-radius:50%; }
  .two{ display:grid; grid-template-columns:1fr 1fr; gap:6px 26px; } .two > div{ min-width:0; }
  .read{ display:grid; grid-template-columns:1fr 1fr; gap:6px; } .read > div{ border:1px solid var(--line); padding:12px 14px; }
  .read p{ margin:5px 0; color:var(--ink); font-size:14px; } .read h3{ margin-top:0; }
  .meter{ padding:4px 0 10px; } .mh{ display:flex; justify-content:space-between; gap:10px; font-size:12px; letter-spacing:.08em; color:var(--ink); } .mh b{ letter-spacing:0; }
  .mt{ position:relative; height:26px; margin-top:6px; } .mt i{ position:absolute; display:block; }
  .mt .trk{ left:0; width:90.91%; top:9px; height:8px; background:var(--line); } .mt .fill{ left:0; top:9px; height:8px; background:#2fa5ba; opacity:.55; } .mt .over{ top:9px; height:8px; background:#c0403c; opacity:.85; }
  .mt .tk{ top:3px; width:2px; height:20px; margin-left:-1px; background:#2fa5ba; } .mt .ma{ top:3px; width:2px; height:20px; margin-left:-1px; background:#c98500; }
  .mt .dot{ top:6px; width:14px; height:14px; margin-left:-7px; border-radius:50%; background:var(--ink); border:2px solid var(--panel); }
  .mb{ position:relative; height:18px; font-size:11px; color:var(--ink3); } .mb span{ position:absolute; white-space:nowrap; } .mb span.c{ transform:translateX(-50%); } .mb span.r{ transform:translateX(-100%); }
  .mn{ font-size:11px; color:var(--ink3); }
  .tip{ position:absolute; pointer-events:none; background:#16161b; border:1px solid var(--line); padding:8px 10px; font-size:11px; line-height:1.5; color:var(--ink2); white-space:nowrap; visibility:hidden; z-index:5; }
  .tip b{ color:var(--ink); } .tip .k{ display:inline-block; width:14px; border-top:2px solid; vertical-align:middle; margin-right:6px; }
  details{ margin-top:22px; color:var(--ink3); font-size:13px; } summary{ cursor:pointer; letter-spacing:.2em; font-size:12px; }
  details p, details li{ color:var(--ink2); } details ul{ margin:6px 0 0 18px; padding:0; max-width:1180px; } details li{ margin:6px 0; } details h3{ margin-top:16px; }
  @media (max-width:900px){ .two,.read{ grid-template-columns:1fr; } body{ font-size:13px; } main{ padding:16px 10px 70px; } .lead{ font-size:15px; } }
"""

JS = """
(function(){
  var DATA = JSON.parse(document.getElementById('chn-data').textContent);
  function fmt(v, n){ return v == null ? '—' : v.toLocaleString('en-US', {minimumFractionDigits:n, maximumFractionDigits:n}); }
  document.querySelectorAll('svg[data-chart]').forEach(function(svg){
    var d = DATA[svg.dataset.sym], rows = d.rows, wrap = svg.parentNode, tip = wrap.querySelector('.tip'), hair = svg.querySelector('.hair');
    var t0 = Date.parse(svg.dataset.from), t1 = Date.parse(svg.dataset.to), L = +svg.dataset.l, PW = +svg.dataset.pw, W = +svg.dataset.w;
    var ts = rows.map(function(r){ return Date.parse(r[0]); });
    function row(k, label, val, colr, dash){
      var div = document.createElement('div');
      if (colr){ var key = document.createElement('span'); key.className = 'k'; key.style.borderTopColor = colr; if (dash) key.style.borderTopStyle = 'dashed'; div.appendChild(key); }
      var b = document.createElement('b'); b.textContent = val; div.appendChild(b); div.appendChild(document.createTextNode('  ' + label)); k.appendChild(div);
    }
    function move(ev){
      var rect = svg.getBoundingClientRect(), sx = (ev.clientX - rect.left) * W / rect.width, ms = t0 + (sx - L) / PW * (t1 - t0);
      var lo = 0, hi = ts.length - 1; while (lo < hi){ var m = (lo + hi) >> 1; if (ts[m] < ms) lo = m + 1; else hi = m; }
      if (lo > 0 && Math.abs(ts[lo - 1] - ms) < Math.abs(ts[lo] - ms)) lo--;
      if (ts[lo] < t0 || ms > ts[ts.length - 1] + 4 * 864e5){ leave(); return; }
      var r = rows[lo], x = L + (ts[lo] - t0) / (t1 - t0) * PW;
      hair.setAttribute('x1', x); hair.setAttribute('x2', x); hair.setAttribute('visibility', 'visible');
      while (tip.firstChild) tip.removeChild(tip.firstChild);
      var h = document.createElement('div'); h.textContent = new Date(ts[lo]).toLocaleDateString('en-GB', {weekday:'short', day:'numeric', month:'short', year:'numeric', timeZone:'UTC'}); h.style.color = '#d2d2d2'; h.style.marginBottom = '4px'; tip.appendChild(h);
      row(tip, 'close', fmt(r[1], 2), null);
      row(tip, '1W B2 = 2W B2 (upper)', fmt(r[3], 2), '#2fa5ba'); row(tip, '1W B4 (mid)', fmt(r[4], 2), '#2fa5ba', 1); row(tip, '200-day', fmt(r[2], 2), '#c98500');
      row(tip, '2W B4 (mid)', fmt(r[6], 2), '#2fa5ba', 1); row(tip, '1W B6 (lower)', fmt(r[5], 2), '#2fa5ba'); row(tip, '2W B6 (lower)', fmt(r[7], 2), '#2fa5ba');
      row(tip, 'of the way up 1W B · 2W B', fmt((r[1] - r[5]) / (r[3] - r[5]) * 100, 1) + '% · ' + fmt((r[1] - r[7]) / (r[3] - r[7]) * 100, 1) + '%', null);
      if (r[2] != null) row(tip, 'close against the 200-day', (r[1] >= r[2] ? '+' : '−') + fmt(Math.abs(r[1] / r[2] - 1) * 100, 2) + '%', null);
      row(tip, 'RSI 14 · Williams %R', fmt(r[8], 1) + ' · ' + (r[9] == null ? '—' : (r[9] < 0 ? '−' : '') + fmt(Math.abs(r[9]), 1)), null);
      var wr = wrap.getBoundingClientRect(), px = ev.clientX - wr.left + wrap.scrollLeft, py = ev.clientY - wr.top;
      tip.style.visibility = 'visible'; var tw = tip.offsetWidth;
      tip.style.left = Math.max(wrap.scrollLeft + 4, (px + 18 + tw > wrap.scrollLeft + wr.width ? px - tw - 18 : px + 18)) + 'px'; tip.style.top = Math.max(4, py - 20) + 'px';
    }
    function leave(){ hair.setAttribute('visibility', 'hidden'); tip.style.visibility = 'hidden'; }
    var hit = svg.querySelector('.hit'); hit.addEventListener('pointermove', move); hit.addEventListener('pointerdown', move); hit.addEventListener('pointerleave', leave);
    // on a narrow screen, open with today's line about two thirds of the way across
    var last = ts[ts.length - 1], xToday = (L + (last - t0) / (t1 - t0) * PW) * svg.getBoundingClientRect().width / W;
    wrap.scrollLeft = Math.max(0, xToday - wrap.clientWidth * 0.68);
  });
})();
"""

# the BACK / CLOSE pair every Hub sub-page carries: the repo's own snippet, placed the way scripts/inject-scnav.py places it, so that
# running that script afterwards leaves this page byte-identical
SCNAV = open(os.path.join(ROOT, "..", "..", "..", "scripts", "scnav-snippet.html")).read().strip()

def legend():
    return (f'<p class="legend"><span><i style="border-color:{UP}"></i>close on an up day</span><span><i style="border-color:{DOWN}"></i>close on a down day</span>'
            f'<span><i style="border-color:{MA}"></i>200-day average</span><span><i style="border-color:{RAIL}"></i>rails: 1W B2 = 2W B2 (upper), 1W B6 and 2W B6 (lower)</span>'
            f'<span><i class="dash" style="border-color:{RAIL}"></i>midlines: 1W B4, 2W B4</span><span>brighter = weekly source (1W), dimmer = two-week source (2W)</span><span><i class="blk" style="background:{DOWN};opacity:.45"></i>close under the 200-day</span>'
            f'<span><i class="dot" style="background:{INK}"></i>the low of each episode, numbered</span><span><i style="border-color:{INK}"></i>its first 60 sessions; the number beside each low is their slope as a multiple of the channel\'s</span></p>')

def pictures(sym):
    S = R["symbols"][sym]; c1 = S["channels"][0]; life = c1["life"]["from"]
    a = chart(sym, SER[sym]["rows"][0][0], 62, f"{sym} — THE WHOLE CHANNEL, {D(life).year} TO TODAY", f"daily closes on the Lab's own price basis · the rails are the Lab's retained B lines, unchanged · dotted = the same lines carried forward", False)
    z = chart(sym, "2026-01-02", 62, f"{sym} — THIS YEAR, CLOSE UP", "the March pierce, the run to the rail, and where the close stands against it today", True, H=560)
    return (f'<div class="cw">{a}<div class="tip"></div></div>{legend()}<div class="cw" style="margin-top:18px">{z}<div class="tip"></div></div>')

hover = {s: {"rows": [[r[0], r[1], r[4], r[5], r[6], r[7], r[8], r[9], r[10], r[11]] for r in SER[s]["rows"]]} for s in ("SPY", "QQQ")}

lead = (f"<b>SPY has {ts['upper_rail']['room_pct']:.1f}% of room left to the top of its long-term channel. QQQ has none: it closed {abs(tq['upper_rail']['room_pct']):.1f}% above its top rail on {session}, the second close in a row above it.</b> "
        f"Your read was right in direction; the room on SPY is small.")
bul = [
 f"<b>The channels.</b> Each index has one rising top rail, <b>1W B2</b>, which is the same line as <b>2W B2</b>, and two floors under it: the weekly one (<b>1W B6</b>) and the wider two-week one (<b>2W B6</b>), each with its midline (<b>1W B4</b>, <b>2W B4</b>). Every line climbs the same dollars each week: SPY ${s1['slope']['native_usd_per_calendar_week']:.2f}, QQQ ${q1['slope']['native_usd_per_calendar_week']:.2f}. The Lab's strip prints that as {s2['slope']['lab_strip_reads'].split('%')[0]}% and {s1['slope']['lab_strip_reads'].split('%')[0]}% a week for SPY, the first two of the three numbers you read out (the third is the strip's 200-day cell), and {q1['slope']['lab_strip_reads'].split('%')[0]}% for QQQ. That is {s1['slope']['pct_of_close_per_month']:.2f}% a month for SPY and {q1['slope']['pct_of_close_per_month']:.2f}% a month for QQQ at today's prices.",
 f"<b>Where we are, {session} close.</b> SPY {usd(ts['close'])} is {s1['today']['position_pct_of_height']:.1f}% of the way up its weekly channel ({s2['today']['position_pct_of_height']:.1f}% of the wider one). The top rail is {usd(s1['today']['upper'])}, {ts['upper_rail']['room_pct']:.2f}% above. The weekly midline 1W B4 ({usd(s1['today']['mid'])}) is {abs(s1['today']['move_to_mid_pct']):.1f}% below and the 200-day ({usd(ts['sma200'])}) {abs(ts['pct_drop_to_sma200']):.1f}% below. QQQ {usd(tq['close'])} is over its top rail ({usd(q1['today']['upper'])}), at {q1['today']['position_pct_of_height']:.1f}%. Its 1W B4 midline ({usd(q1['today']['mid'])}) is {abs(q1['today']['move_to_mid_pct']):.1f}% below and its 200-day ({usd(tq['sma200'])}) {abs(tq['pct_drop_to_sma200']):.1f}% below.",
 f"<b>The pierces.</b> Since the channels began, SPY has closed under its 200-day in {spy['pierces']['count_episodes']} separate episodes ({spy['pierces']['count_pierces']} pierces) and QQQ in {qqq['pierces']['count_episodes']} ({qqq['pierces']['count_pierces']} pierces): the 2022 bear market, March 2023, October 2023 (SPY only), March to May 2025, and March 2026.",
 f"<b>The rebounds start fast and slow down.</b> Off the low, the first 20 sessions ran at a median {mult(sr['first_20_sessions']['multiple_of_channel_slope']['median'])} the channel's slope for SPY and {mult(qr['first_20_sessions']['multiple_of_channel_slope']['median'])} for QQQ; the first 60 sessions at {mult(sr['first_60_sessions']['multiple_of_channel_slope']['median'])} and {mult(qr['first_60_sessions']['multiple_of_channel_slope']['median'])}; the whole trip up to the top rail at {mult(sr['to_upper_touch']['multiple_of_channel_slope']['median'])} and {mult(qr['to_upper_touch']['multiple_of_channel_slope']['median'])}.",
 f"<b>Bottom to top, the two full trips.</b> From the April 2025 low, at the floor of the wide channel, SPY reached the wide midline (2W B4) in {s25['rebound']['to_2W_B4_mid']['sessions']} sessions, the weekly midline (1W B4) in {s25['rebound']['to_1W_B4_mid']['sessions']} and the top rail in {s25['rebound']['to_upper_touch']['sessions']}; QQQ took {q25['rebound']['to_2W_B4_mid']['sessions']}, {q25['rebound']['to_1W_B4_mid']['sessions']} and {q25['rebound']['to_upper_touch']['sessions']}. From the March 2026 low, at the floor of the weekly channel, SPY reached 1W B4 in {s26['rebound']['to_1W_B4_mid']['sessions']} sessions and the top in {s26['rebound']['to_upper_touch']['sessions']}; QQQ in {q26['rebound']['to_1W_B4_mid']['sessions']} and {q26['rebound']['to_upper_touch']['sessions']}.",
 f"<b>At each low the oscillators were at their own extremes.</b> SPY's RSI at every one of its five lows was in the lowest 5% of its own days since 2003, and in the lowest 1.5% at the last three. QQQ's last two lows were in the lowest 1% as well; its one-day pierce in March 2023 was not an extreme (RSI {num(E['QQQ']['Mar 2023']['oscillators_at_low']['rsi14'])}).",
 f"<b>What to hold loosely.</b> These rails were drawn this month, with everything since 2022 in view, and QQQ's top rail was drawn through Monday's high, so being at the top is partly how that line was built. The rebound figures rest on {sr['episodes']} episodes for SPY and {qr['episodes']} for QQQ.",
]

read_spy = (f"<p><b>{ts['upper_rail']['room_pct']:.2f}% (${ts['upper_rail']['room_usd']:.2f}) of room</b> to the top rail 1W B2 = 2W B2 at {usd(s1['today']['upper'])}, which itself rises ${ts['upper_rail']['rail_rises_usd_per_7d']:.2f} a week. At the median rebound slope ({mult(p_med['multiple_of_channel_slope'])} the channel's) that is about <b>{p_med['sessions']} sessions</b>; the other ways of taking the median give {min(p_all)} to {max(p_all)}.</p>"
            f"<p>SPY has never closed above this rail. The rail is drawn through the high of {dstr(snear['date'])}; after that high SPY dipped {abs(snear['afterwards']['fall_pct']):.1f}% over {snear['afterwards']['sessions']} sessions and held {snear['afterwards']['low_vs_sma200_pct']:.1f}% above the 200-day.</p>")
read_qqq = (f"<p><b>No room: {abs(tq['upper_rail']['room_pct']):.2f}% (${abs(tq['upper_rail']['room_usd']):.2f}) above</b> the top rail 1W B2 = 2W B2 at {usd(q1['today']['upper'])}, so the session count is zero. If QQQ stood still, the rail would climb past it on {dstr(flat['date'])}, {flat['sessions']} sessions from now.</p>"
            f"<p>The only other time QQQ closed above this rail ({qold['sessions_closed_above']} sessions, {dstr(qold['first_close_above'], False)} to {dstr(qold['last_close_above'])}), it then fell {abs(qold['afterwards']['fall_from_peak_close_pct']):.1f}% in {qold['afterwards']['sessions_peak_to_low']} sessions, to its 1W B4 midline, and held {qold['afterwards']['low_vs_sma200_pct']:.1f}% above the 200-day. One case, not a rule.</p>")

specs = f"""
<h3>What this page shows</h3>
<ul>
<li>The Indicator Lab's retained long-term parallel channels for BATS:SPY and BATS:QQQ, exactly as the Lab holds them, measured against daily closes. The Lab owns these lines; this page reads them and changes nothing.</li>
<li>For each index: the six lines by their exact labels (1W B2, 1W B4, 1W B6 from the weekly source; 2W B2, 2W B4, 2W B6 from the two-week source). 1W B2 and 2W B2 are the same line on both indexes. Both channels carry the Lab's own flags: drawn (context selected) and slope-approved, on both timeframes. Neither is recorded as an approved attention range.</li>
<li>Every close under the 200-day average since each channel began ({dstr(s1['life']['from'])} for SPY, {dstr(q1['life']['from'])} for QQQ), and what price did after each low.</li>
</ul>
<h3>Where each number comes from</h3>
<ul>
<li><b>The lines.</b> LB1's extract of the Lab's V24 pack (provider branch <span class=dim>provider/lb1-reviewed-lines-20261006</span>, commit {R['lab_sources']['lb1_extract']['commit'][:7]}), checked against the Lab's pack files themselves: the channel constants are identical in {", ".join(packs['packs_compared'])}. {reg['indexes_pack_name']} is the pack the Lab's registry records as installed and saved on {dstr(reg['at'][:10])} (UTC); its file hash matches the one read here. The registry records it as not yet visually approved by you.</li>
<li><b>The equations.</b> The Lab's own rule: a line's level this bar is its level at the snapshot bar plus its slope times the number of source bars since. A weekly line steps once a week; a two-week line once per two-week bar. Both clocks were rebuilt from the Lab's saved bars and agree with the Lab's own bar counts ({s1['life']['sessions'] and spy['clock_check']['1W']['lab_base_offset']} weekly bars and {spy['clock_check']['2W']['lab_base_offset']} two-week bars from SPY's origin to the snapshot).</li>
<li><b>Slope units.</b> Native: US dollars per source bar. The strip: the Lab's own formula (native slope × anchor span × 168 ÷ elapsed calendar hours, shown as a percentage of the close per 7 days). Per month: the strip's dollars per 7 days × 30.44 ÷ 7, as a percentage of today's close, and again as a percentage of the line's own midline. The channel is straight in dollars, so the same dollars were a larger percentage when prices were lower.</li>
<li><b>Prices.</b> Daily bars from the Scintilla chart API, final through {session} ({spy['price_source']['n']:,} sessions back to {dstr(spy['price_source']['first_session'])}). The Lab draws on dividend-adjusted prices, so every bar was moved to that basis with a factor measured from the Lab's own weekly bars. The check: after the move our bars reproduce the Lab's saved bars to within ${max(par_s['daily']['max_abs_error_usd_any_of_ohlc'], par_q['daily']['max_abs_error_usd_any_of_ohlc']):.3f} on {par_s['daily']['lab_days_compared']} days and {par_s['weekly']['lab_weeks_compared']} weeks, and the quarterly steps the factor takes land on the funds' ex-dividend days (SPY's third Fridays, QQQ's Mondays after).</li>
<li><b>The 200-day, RSI and Williams.</b> The 200-day is the simple average of the last 200 daily closes on the Lab's basis. RSI is 14-day; Williams %R is 14-day (0 at the 14-day high, −100 at the 14-day low; the Lab's pane shows it plus 100). All three equal the values saved in the Lab's own daily capture on all {par_s['sma200_vs_lab_saved_daily']['days']} days compared, to six decimals. "Own history" is where a reading ranks among that index's own daily readings since 2003 (dividends are taken out from January 2021 on, where the Lab's bars allow the factor to be measured; before that RSI and Williams are on plain closes, which changes them very little).</li>
<li><b>A pierce</b> is a close under the 200-day after a close at or above it. Pierces fewer than {R['settings']['merge_gap_sessions']} sessions apart are one <b>episode</b>; its low is its lowest close. A day whose low dipped under the 200-day but closed above it is not counted.</li>
<li><b>× channel slope</b> is the dollars gained per week over the stretch, divided by the dollars the rail gains per week. † marks a stretch during which the 200-day was pierced again before the line was reached.</li>
<li><b>Sessions to the rail</b> walks the calendar forward from today's close at the stated pace, with the rail stepping up each week, and counts trading days until they meet.</li>
</ul>
<h3>What could be wrong</h3>
<ul>
<li><b>Hindsight.</b> The rails were captured on 5 and 6 October 2026. Measuring 2022's lows against them uses lines that did not exist then. The 2W B floor was placed on the April 2025 low and the 1W B floor on the March 2026 low, so those two lows sit at the bottom by construction.</li>
<li><b>SPY's top rail is drawn through its own 13 August 2026 high</b>, so the day SPY "reached" the rail is the day that defines it; every "low to the upper rail" count for SPY ends there.</li>
<li><b>QQQ's top rail ends on its own capture week.</b> It joins the November 2021 high to the high of the week of 5 October as it stood on Monday afternoon (755.65). A fresh capture would draw it through the new high and QQQ would read as at the rail, not above it.</li>
<li><b>Small samples.</b> {sr['episodes']} episodes for SPY and {qr['episodes']} for QQQ, and the stretches overlap: three of SPY's lows reached the 2W B4 midline on the same day, and all five reached the top rail on the same day. A median of five is a description of five cases.</li>
<li><b>The pace depends on the stretch.</b> "Median rebound slope" is {mult(sr['first_60_sessions']['multiple_of_channel_slope']['median'])} over the first 60 sessions but {mult(sr['to_upper_touch']['multiple_of_channel_slope']['median'])} over the whole trip to the rail, which is why SPY's session count is given as a range.</li>
<li><b>The price basis moves a few pierce days.</b> On the Hub's own charts (dividends not taken out) SPY shows the same five episodes with the same lows, but {len(hub_s['below_only_on_the_hub_basis'])} more closes under the 200-day, and three episodes begin one to three sessions earlier. QQQ's 2022 low falls on 28 December 2022 on the Hub's prices and on 3 November 2022 on the Lab's.</li>
<li><b>The third strip number.</b> The strip's SMA200 cell uses only the last two completed daily values. In SPY's last ten sessions it read {min(wk)}% to {max(wk)}% a week when a weekend lay between the two days, and {min(mid)}% to {max(mid)}% midweek. Over the last 20 sessions SPY's 200-day has risen {pct(mp_s['last_20_sessions_pct_of_close_per_7d'], 2)} a week, {mult(mp_s['last_20_sessions_multiple_of_channel_slope'])} the channel's slope (QQQ {pct(mp_q['last_20_sessions_pct_of_close_per_7d'], 2)}, {mult(mp_q['last_20_sessions_multiple_of_channel_slope'])}). This is a note for the Lab, which owns that cell.</li>
<li>Future dividends will shift the Lab's adjusted history down a little each quarter while the saved rails stay put.</li>
</ul>
<h3>What was not done</h3>
<ul>
<li>No live TradingView read: this run had no TradingView connection. LB1 read the Clean pane live on 6 October (QQQ, 2W) and all 24 comparable drawn levels matched the extract.</li>
<li>Nothing deployed, no table written, nothing written under the Lab's folder, no Hub page changed. The branch is committed locally; it was not pushed.</li>
<li>Not studied: the Lab's other SPY and QQQ lines (C, D, the pivots, 1W T29). No forecast is made; this is a record of what price did.</li>
</ul>
<p class="dim">Built {built} by tools/01_extract_lab.py → 02_dl.py → 03_compute.py → 04_build.py. Every figure on this page is in data/results.json.</p>
"""

page = f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CHN1 · SPY and QQQ inside their long-term channels · {session}</title>
<style>{CSS}</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>CHN1 · SPY and QQQ inside their long-term channels — where we are, and how rebounds from the 200-day have travelled</h1>
<p class="lead">{lead}</p>
<p class="sub">{session} close · a study on a branch · nothing deployed, no table written, the Lab's folder read only · lines: the Indicator Lab's retained B channels, unchanged</p>

<section>
<h2>In plain words</h2>
<ul class="plain">{"".join(f"<li>{b}</li>" for b in bul)}</ul>
</section>

<section>
<h2>Today's read</h2>
<div class="read"><div><h3>SPY</h3>{read_spy}</div><div><h3>QQQ</h3>{read_qqq}</div></div>
<h3>Position inside each channel</h3>
<div class="two"><div>{meter("SPY", 0)}</div><div>{meter("QQQ", 0)}</div><div>{meter("SPY", 1)}</div><div>{meter("QQQ", 1)}</div></div>
</section>

<section>
<h2>SPY — the picture</h2>
{pictures("SPY")}
</section>

<section>
<h2>QQQ — the picture</h2>
{pictures("QQQ")}
</section>

<section>
<h2>The channels — rails, equations and slope</h2>
{rails_table()}
<h3>Where the close sits in each</h3>
{today_table()}
</section>

<section>
<h2>The lows — one row per episode</h2>
{low_table()}
<p class="legend"><span>rank = where that reading stands among the index's own daily readings since 2003 (bottom 0.2% = lower than 99.8% of its days)</span><span>position = 0% on the lower rail, 100% on the upper rail; negative = under the lower rail</span></p>
</section>

<section>
<h2>The rebounds — side by side</h2>
<div class="cw strip">{rebound_strip("SPY")}</div>
<div class="cw strip" style="margin-top:14px">{rebound_strip("QQQ")}</div>
<p class="legend"><span><i style="border-color:{UP}"></i><i style="border-color:{DOWN};margin-left:-4px"></i>gain since the low, the first {STRIP_N} sessions (green on an up day, red on a down day)</span><span><i style="border-color:{RAIL}"></i>what the rail climbed over the same sessions, as a share of the same starting price</span><span>the gap between the two is the multiple of the channel's slope</span><span><i class="dot" style="background:{PANEL};border:2px solid {INK};width:6px;height:6px"></i>the session it reached 2W B4, then 1W B4, then the top rail, where that came inside the {STRIP_N}</span><span>all nine panels share one scale</span></p>
</section>

<section>
<h2>The rebounds — from each low</h2>
{rebound_table()}
<p class="legend"><span>× channel slope = dollars gained a week over the stretch ÷ dollars the rail gains a week</span><span>†n = the 200-day was pierced again n times before the line was reached</span><span>a midline is reached on the first close at or above it; the upper rail on the first session whose high reaches it</span></p>
<h3>How fast, by stretch</h3>
{speed_table()}
<h3>SPY — sessions to the top rail at each pace</h3>
{pace_table()}
</section>

<section>
<h2>Every pierce of the 200-day</h2>
<div class="two"><div><h3>SPY · {spy['pierces']['count_pierces']} pierces in {spy['pierces']['count_episodes']} episodes</h3>{pierce_table("SPY")}</div><div><h3>QQQ · {qqq['pierces']['count_pierces']} pierces in {qqq['pierces']['count_episodes']} episodes</h3>{pierce_table("QQQ")}</div></div>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
{specs}
</details>
</main>
<script type="application/json" id="chn-data">{json.dumps(hover, separators=(",", ":"))}</script>
<script>{JS}</script>
{SCNAV}
</body>
</html>
"""
out = os.path.join(ROOT, "CHANNELS.html"); open(out, "w").write(page)
print("wrote", os.path.relpath(out, ROOT), f"{len(page) / 1024:.0f} KB")
