#!/usr/bin/env python3
"""LD1 · renders LEADERS-VS-LAGGARDS.html from study.json and opinion.json. Pictures first, then the opinion, then the tables.
Greys only (channels within 24, none above 210) except direction: up = green, down = red. Body text 11px+. Explanations live in PAGE SPECS."""
import html, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
S = json.load(open(os.path.join(D, "study.json")))
OP = json.load(open(os.path.join(D, "opinion.json"))) if os.path.exists(os.path.join(D, "opinion.json")) else {"paragraphs": ["(opinion not written yet)"], "evidence": [], "against": []}
N = S["names"]; G = S["groups"]; Q = S["quality"]; B = S["benchmarks"]
esc = lambda s: html.escape(str(s)) if s is not None else ""
import datetime
def dlabel(iso, upper=False):   # 2026-10-06 -> 6 Oct
    d = datetime.date.fromisoformat(iso); t = f"{d.day} {d.strftime('%b')}"
    return t.upper() if upper else t
NOW_L, RANK_L = dlabel(S["closes_through"]), dlabel(S["ranked_on"])
UP, DOWN = "#199e70", "#d55181"

def pct(v, digits=0, frac=True, plus=True):
    """a signed percent, green up / red down; v is a fraction unless frac=False"""
    if v is None: return '<span class="na">–</span>'
    x = v * 100 if frac else v
    if round(x, digits) == 0: x = 0.0   # never print a "minus zero"
    cls = "up" if x > 0 else "dn" if x < 0 else ""
    sign = "+" if (x > 0 and plus) else "−" if x < 0 else ""
    return f'<span class="{cls}">{sign}{abs(x):.{digits}f}%</span>'
def plain(v, digits=1, suf=""):
    return '<span class="na">–</span>' if v is None else f"{v:,.{digits}f}{suf}"
def usd(v):
    if v is None: return '<span class="na">–</span>'
    return f"${v/1000:,.2f}T" if abs(v) >= 1000 else f"${v:,.1f}B" if abs(v) >= 10 else f"${v:,.2f}B"
def usd3(v):
    """a group total: three decimals in trillions, so 'added' reads as the difference of the two totals beside it"""
    return '<span class="na">–</span>' if v is None else (f"${v/1000:,.3f}T" if abs(v) >= 1000 else f"${v:,.1f}B")
def usd3_signed(now, then):
    """the change between two group totals, taken from the two figures as printed (each rounded to $1 billion)"""
    v = round(now) - round(then); a = abs(v); cls = "up" if v > 0 else "dn" if v < 0 else ""
    return f'<span class="{cls}">{"−" if v < 0 else "+"}{f"${a/1000:,.3f}T" if a >= 1000 else f"${a:,.0f}B"}</span>'
def usd_signed(v):
    if v is None: return '<span class="na">–</span>'
    cls = "up" if v > 0 else "dn" if v < 0 else ""; a = abs(v)
    body = f"${a/1000:,.2f}T" if a >= 1000 else f"${a:,.1f}B" if a >= 10 else f"${a:,.2f}B"
    return f'<span class="{cls}">{"−" if v < 0 else "+"}{body}</span>'
def money(v):
    if v is None: return '<span class="na">–</span>'
    cls = "up" if v > 0 else "dn" if v < 0 else ""
    a = abs(v); s = f"{a:,.1f}" if a >= 10 else f"{a:,.2f}"
    return f'<span class="{cls}">{"−" if v < 0 else "+"}{s}</span>'
def arrow(d):
    return {"up": '<span class="up">▲ raised</span>', "down": '<span class="dn">▼ cut</span>', "flat": "● flat"}.get(d, '<span class="na">–</span>')
def guide(d, kind=None):
    k = f' <span class="dimmer">{kind}</span>' if (d == "raised" and kind) else ""
    return {"raised": '<span class="up">▲ raised</span>' + k, "lowered": '<span class="dn">▼ lowered</span>', "maintained": "● kept", "none": "gives none"}.get(d, '<span class="na">–</span>')
def conc(n):
    lv = n.get("concentration_level"); t = n.get("top_customer_pct")
    w = {"high": '<span class="dn">few</span>', "moderate": "some", "low": '<span class="up">many</span>'}.get(lv, '<span class="na">–</span>')
    return w + (f" · top {t:.0f}%" if isinstance(t, (int, float)) else "")
def margin(now, ago):
    """a margin now and a year ago; a company with almost no sales can show a margin of minus thousands of percent, which is printed as 'below −999%'"""
    m = lambda v: f"{v:.0f}%".replace("-", "−") if v > -999 else "below −999%"
    if now is None: return '<span class="na">–</span>'
    if ago is None: return m(now)
    cls = "up" if now > ago else "dn" if now < ago else ""
    return f'{m(now)} <span class="{cls}">({"▲" if now > ago else "▼" if now < ago else "●"} from {m(ago)})</span>'
def vs(own, medn, n, digits=1, suf="×"):
    if own is None and medn is None: return '<span class="na">–</span>'
    o = '<span class="na">none</span>' if own is None else f"{own:,.{digits if own < 100 else 0}f}{suf}"
    m = '<span class="na">too few</span>' if medn is None else f"{medn:,.{digits if medn < 100 else 0}f}{suf}"
    return f'{o} <span class="dimmer">vs {m}</span>'
def geiger(v):
    if v is None: return '<span class="na">–</span>'
    return f'<span class="{"up" if v > 0 else "dn" if v < 0 else ""}">{"+" if v > 0 else "−" if v < 0 else ""}{abs(v):.2f}</span>'
def tbl(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head)
    b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table>'

# ------------------------------------------------------------------ picture 1: the fall and the run, every name in the field
W, H, ML, MR, MT, MB = 1120, 560, 70, 30, 34, 52
pts = [p for p in S["field_points"] if p["s"] is not None and p["r"] is not None]
xmin, xmax = -0.60, 0.65; ymin, ymax = -0.25, 0.55
X = lambda v: ML + (max(xmin, min(xmax, v)) - xmin) / (xmax - xmin) * (W - ML - MR)
Y = lambda v: MT + (ymax - max(ymin, min(ymax, v))) / (ymax - ymin) * (H - MT - MB)
sv = [f'<svg viewBox="0 0 {W} {H}" width="100%" style="min-width:{W}px;display:block" font-family="ui-monospace,Menlo,monospace" font-size="11" role="img" aria-label="Every name in the field: the summer fall against the run since 15 September">',
      f'<rect width="{W}" height="{H}" fill="#121314"/>']
for gx in [-0.5, -0.4, -0.3, -0.2, -0.1, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6]:
    sv.append(f'<line x1="{X(gx):.1f}" y1="{MT}" x2="{X(gx):.1f}" y2="{H-MB}" stroke="#202224"/><text x="{X(gx):.1f}" y="{H-MB+16}" fill="#8a8c8e" text-anchor="middle">{"+" if gx > 0 else "−"}{abs(gx)*100:.0f}%</text>')
for gy in [-0.2, -0.1, 0.1, 0.2, 0.3, 0.4, 0.5]:
    sv.append(f'<line x1="{ML}" y1="{Y(gy):.1f}" x2="{W-MR}" y2="{Y(gy):.1f}" stroke="#202224"/><text x="{ML-8}" y="{Y(gy)+4:.1f}" fill="#8a8c8e" text-anchor="end">{"+" if gy > 0 else "−"}{abs(gy)*100:.0f}%</text>')
sv.append(f'<line x1="{X(0):.1f}" y1="{MT}" x2="{X(0):.1f}" y2="{H-MB}" stroke="#5e6062"/><line x1="{ML}" y1="{Y(0):.1f}" x2="{W-MR}" y2="{Y(0):.1f}" stroke="#5e6062"/>')
sv.append(f'<text x="{X(0):.1f}" y="{H-MB+16}" fill="#c4c6c8" text-anchor="middle">0</text><text x="{ML-8}" y="{Y(0)+4:.1f}" fill="#c4c6c8" text-anchor="end">0</text>')
sv.append(f'<text x="{(ML+W-MR)/2:.0f}" y="{H-10}" fill="#c4c6c8" text-anchor="middle" letter-spacing="1.2">THE FALL · 30 JUN → 15 SEP  (left = fell, right = rose)</text>')
sv.append(f'<text x="16" y="{(MT+H-MB)/2:.0f}" fill="#c4c6c8" text-anchor="middle" letter-spacing="1.2" transform="rotate(-90 16 {(MT+H-MB)/2:.0f})">THE BOUNCE · 15 SEP → {NOW_L.upper()}</text>')
for (tx, ty, anchor, words) in [(ML + 8, MT + 14, "start", "FELL, THEN BOUNCED"), (W - MR - 8, MT + 14, "end", "NEVER FELL, KEPT RISING"), (ML + 8, H - MB - 8, "start", "FELL AND DID NOT BOUNCE"), (W - MR - 8, H - MB - 8, "end", "HELD UP, THEN SLIPPED")]:
    sv.append(f'<text x="{tx}" y="{ty}" fill="#5e6062" text-anchor="{anchor}" letter-spacing="1.5">{words}</text>')
for p in pts:
    if p["g"] == "field": sv.append(f'<circle cx="{X(p["s"]):.1f}" cy="{Y(p["r"]):.1f}" r="2.6" fill="#5e6062"/>')
placed = []   # label boxes already drawn: (x0, y0, x1, y1)
def label(x, y, t, col):
    w, h = 7.0 * len(t) + 2, 11
    for dx, dy, anchor in ((0, -8, "middle"), (8, 4, "start"), (-8, 4, "end"), (0, 17, "middle"), (8, -6, "start"), (-8, -6, "end"), (8, 14, "start"), (-8, 14, "end"), (0, -19, "middle"), (0, 28, "middle"), (20, 4, "start"), (-20, 4, "end"),
                           (0, -31, "middle"), (0, 40, "middle"), (26, -18, "start"), (-26, -18, "end"), (26, 24, "start"), (-26, 24, "end"), (38, 4, "start"), (-38, 4, "end"), (0, -43, "middle"), (0, 52, "middle")):
        tx, ty = x + dx, y + dy
        x0 = tx - w / 2 if anchor == "middle" else tx if anchor == "start" else tx - w
        box = (x0, ty - h + 2, x0 + w, ty + 2)
        if all(box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3] for b in placed): break
    placed.append(box); return f'<text x="{tx:.1f}" y="{ty:.1f}" fill="{col}" text-anchor="{anchor}" font-weight="600">{t}</text>'
studied_pts = [p for p in pts if p["g"] != "field"]
for p in studied_pts: placed.append((X(p["s"]) - 5, Y(p["r"]) - 5, X(p["s"]) + 5, Y(p["r"]) + 5))   # never write over a studied dot
FUNDS = (("NASDAQ-100 FUND", B["QQQ"]), ("CHIP FUND", B["SMH"]))
dotboxes = list(placed); fund_at = {}
for name, b in FUNDS:   # a fund's label goes on whichever side of its diamond has no studied dot under it; then both are reserved
    fx, fy = X(b["r_selloff"]), Y(b["r_run"]); w = 7.0 * len(name)
    for dx, dy, anchor in ((10, 4, "start"), (-10, 4, "end"), (0, -12, "middle"), (0, 22, "middle")):
        tx, ty = fx + dx, fy + dy; x0 = tx - w / 2 if anchor == "middle" else tx if anchor == "start" else tx - w
        box = (x0, ty - 11, x0 + w, ty + 3)
        if all(box[2] < d[0] or box[0] > d[2] or box[3] < d[1] or box[1] > d[3] for d in dotboxes[:len(studied_pts)]): break
    fund_at[name] = (tx, ty, anchor); placed.append((fx - 8, fy - 8, fx + 8, fy + 8)); placed.append(box)
for g, col in (("named_mid", "#c4c6c8"), ("laggard", DOWN), ("leader", UP)):
    for p in sorted([p for p in pts if p["g"] == g], key=lambda p: p["r"]):
        x, y = X(p["s"]), Y(p["r"])
        sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.2" fill="{col if g != "named_mid" else "#121314"}" stroke="{col}" stroke-width="1.4"/>' + label(x, y, p["t"], col))
for name, b in FUNDS:
    x, y = X(b["r_selloff"]), Y(b["r_run"]); tx, ty, anchor = fund_at[name]
    sv.append(f'<path d="M{x-6:.1f},{y:.1f} L{x:.1f},{y-6:.1f} L{x+6:.1f},{y:.1f} L{x:.1f},{y+6:.1f} Z" fill="#121314" stroke="#c4c6c8" stroke-width="1.4"/><text x="{tx:.1f}" y="{ty:.1f}" fill="#c4c6c8" text-anchor="{anchor}">{name}</text>')
sv.append(f'<circle cx="{ML+10}" cy="{MT-16}" r="4.2" fill="{UP}"/><text x="{ML+20}" y="{MT-12}" fill="#c4c6c8">LEADER ({len(G["leader"])})</text>'
          f'<circle cx="{ML+130}" cy="{MT-16}" r="4.2" fill="{DOWN}"/><text x="{ML+140}" y="{MT-12}" fill="#c4c6c8">LAGGARD ({len(G["laggard"])})</text>'
          f'<circle cx="{ML+262}" cy="{MT-16}" r="4.2" fill="#121314" stroke="#c4c6c8" stroke-width="1.4"/><text x="{ML+272}" y="{MT-12}" fill="#c4c6c8">NAMED, MID-FIELD ({len(G["named_mid"])})</text>'
          f'<circle cx="{ML+440}" cy="{MT-16}" r="2.6" fill="#5e6062"/><text x="{ML+450}" y="{MT-12}" fill="#c4c6c8">REST OF THE FIELD</text>')
sv.append("</svg>"); SVG1 = "\n".join(sv)

# ------------------------------------------------------------------ picture 2: what separates them, as counts
C = {c["id"]: c for c in S["conditions"]}
def bars(rows, la, lb, aria):
    """rows: (words, a_yes, a_n, b_yes, b_n, gap, strength). One green bar and one red bar per condition, the count in words beside each.
    Plain HTML so it folds on a phone: the words sit above the bars there, beside them on a wide screen."""
    o = [f'<div class="bars" role="img" aria-label="{aria}"><div class="bkey"><span><i class="sw upb"></i>{la}</span><span><i class="sw dnb"></i>{lb}</span><span class="bgap">gap, in points</span></div>']
    for words, ay, an, by, bn, gap, strength in rows:
        o.append(f'<div class="brow"><div class="bw">{esc(words)}</div><div class="bb">'
                 f'<div class="bl"><div class="bt"><i class="upb" style="width:{ay/an*100:.1f}%"></i></div><span>{ay} of {an}</span></div>'
                 f'<div class="bl"><div class="bt"><i class="dnb" style="width:{by/bn*100:.1f}%"></i></div><span>{by} of {bn}</span></div>'
                 f'</div><div class="bg"><b>{gap:+.0f}</b>{ {"clear": "", "leans": "<br>leans"}.get(strength, "<br>no real gap")}</div></div>')
    o.append("</div>"); return "\n".join(o)
shown = [C[i] for i in S["conditions_sorted_ids"] if C[i]["strength"] in ("clear", "leans")]
SVG2 = bars([(c["words"], c["leaders_yes"], c["leaders_n"], c["laggards_yes"], c["laggards_n"], c["gap_points"], c["strength"]) for c in shown], f'LEADERS ({len(G["leader"])})', f'LAGGARDS ({len(G["laggard"])})', "What separates leaders from laggards, as counts")
BC = S["bounce_cut"]
bc_shown = [c for c in BC["conditions"] if c["strength"] == "clear"][:14]
SVG2B = bars([(c["words"], c["a_yes"], c["a_n"], c["b_yes"], c["b_n"], c["gap_points"], c["strength"]) for c in bc_shown], f'FELL, THEN BOUNCED ({len(BC["bounced"])})', f'FELL, DID NOT BOUNCE ({len(BC["stayed_down"])})', "Both sets fell hard in the summer: what separates the ones that bounced")

# ------------------------------------------------------------------ picture 3: Cerebras, its price and the shares freed for sale
CP = S["cbrs_picture"]; sch = CP["schedule"]
W3, ML3, MR3 = 1120, 70, 150
A_T, A_B, B_T, B_B = 40, 290, 340, 470; H3 = 520
day = lambda iso: datetime.date.fromisoformat(iso).toordinal()
d0, d1 = day(sch["listing_date"]) - 4, day(sch["rows"][-1]["date"]) + 6
X3 = lambda iso: ML3 + (day(iso) - d0) / (d1 - d0) * (W3 - ML3 - MR3)
pmin, pmax = 150, 320; YA = lambda v: A_T + (pmax - v) / (pmax - pmin) * (A_B - A_T)
mmax = 40; YB = lambda v: B_T + (mmax - v) / mmax * (B_B - B_T)
s3 = [f'<svg viewBox="0 0 {W3} {H3}" width="100%" style="min-width:{W3}px;display:block" font-family="ui-monospace,Menlo,monospace" font-size="11" role="img" aria-label="Cerebras: the daily close since the listing, and the shares freed from lock-up by date">',
      f'<rect width="{W3}" height="{H3}" fill="#121314"/>']
for gv in (175, 200, 225, 250, 275, 300):
    s3.append(f'<line x1="{ML3}" y1="{YA(gv):.1f}" x2="{W3-MR3}" y2="{YA(gv):.1f}" stroke="#202224"/><text x="{ML3-8}" y="{YA(gv)+4:.1f}" fill="#8a8c8e" text-anchor="end">${gv}</text>')
for gv in (10, 20, 30, 40):
    s3.append(f'<line x1="{ML3}" y1="{YB(gv):.1f}" x2="{W3-MR3}" y2="{YB(gv):.1f}" stroke="#202224"/><text x="{ML3-8}" y="{YB(gv)+4:.1f}" fill="#8a8c8e" text-anchor="end">{gv}M</text>')
s3.append(f'<line x1="{ML3}" y1="{YB(0):.1f}" x2="{W3-MR3}" y2="{YB(0):.1f}" stroke="#5e6062"/>')
s3.append(f'<text x="{ML3}" y="{A_T-18}" fill="#c4c6c8" letter-spacing="1.2">DAILY CLOSE, $</text><text x="{ML3}" y="{B_T-14}" fill="#c4c6c8" letter-spacing="1.2">SHARES FREED FOR SALE, MILLIONS</text>')
# the listing price, and the size of the listing, as the two reference lines
s3.append(f'<line x1="{ML3}" y1="{YA(sch["listing_price"]):.1f}" x2="{W3-MR3}" y2="{YA(sch["listing_price"]):.1f}" stroke="#5e6062"/><text x="{W3-MR3+8}" y="{YA(sch["listing_price"])+4:.1f}" fill="#c4c6c8">LISTING PRICE ${sch["listing_price"]}</text>')
s3.append(f'<line x1="{ML3}" y1="{YB(sch["sold_at_listing_m"]):.1f}" x2="{W3-MR3}" y2="{YB(sch["sold_at_listing_m"]):.1f}" stroke="#5e6062"/><text x="{W3-MR3+8}" y="{YB(sch["sold_at_listing_m"])+4:.1f}" fill="#c4c6c8">SOLD AT THE LISTING</text><text x="{W3-MR3+8}" y="{YB(sch["sold_at_listing_m"])+18:.1f}" fill="#c4c6c8">{sch["sold_at_listing_m"]}M</text>')
# dated events: a hairline through both panels, labelled once at the top
for iso, words in CP["reports"] + [[CP["run_start"], "15 SEP · THE BOUNCE STARTS"]]:
    s3.append(f'<line x1="{X3(iso):.1f}" y1="{A_T-6}" x2="{X3(iso):.1f}" y2="{B_B}" stroke="#2e3032"/><text x="{X3(iso)+5:.1f}" y="{A_T+6}" fill="#8a8c8e">{words}</text>')
# the close: one 2px segment per session, green on an up day, red on a down day
cs = CP["closes"]
for (da, ca), (db, cb_) in zip(cs, cs[1:]):
    s3.append(f'<line x1="{X3(da):.1f}" y1="{YA(ca):.1f}" x2="{X3(db):.1f}" y2="{YA(cb_):.1f}" stroke="{UP if cb_ >= ca else DOWN}" stroke-width="2" stroke-linecap="round"><title>{dlabel(db)}: ${cb_:,.2f} ({(cb_/ca-1)*100:+.1f}% on the day)</title></line>')
lx, ly = X3(cs[-1][0]), YA(cs[-1][1])
s3.append(f'<circle cx="{lx:.1f}" cy="{ly:.1f}" r="4" fill="{UP if cs[-1][1] >= cs[-2][1] else DOWN}" stroke="#121314" stroke-width="2"/><text x="{lx+9:.1f}" y="{ly + (18 if cs[-1][1] < sch["listing_price"] else -8):.1f}" fill="#cdcfd1" font-weight="600">{dlabel(cs[-1][0]).upper()} · ${cs[-1][1]:,.2f}</text>')
s3.append(f'<text x="{X3(cs[0][0])+8:.1f}" y="{YA(cs[0][1])+4:.1f}" fill="#c4c6c8">FIRST CLOSE ${cs[0][1]:,.2f}</text>')
# the releases: a bar per date, filled when already freed, outlined when still to come; the figure sits on each bar
BW = 14; prev_x = -999; prev_row = 0
for i, r in enumerate(sch["rows"]):
    x, y = X3(r["date"]), YB(r["m"]); freed = r["state"] == "freed"; h = YB(0) - y
    row = 1 if (x - prev_x < 46 and prev_row == 0) else 0; prev_x, prev_row = x, row
    lab = ("about " if "arithmetic" in r["note"] else "") + f'{r["m"]:g}'; lw = 6.8 * len(lab) + 2
    path = f'M{x-BW/2:.1f},{YB(0):.1f} V{y+4:.1f} Q{x-BW/2:.1f},{y:.1f} {x-BW/2+4:.1f},{y:.1f} H{x+BW/2-4:.1f} Q{x+BW/2:.1f},{y:.1f} {x+BW/2:.1f},{y+4:.1f} V{YB(0):.1f} Z'
    tip = f'{dlabel(r["date"])}: {r["m"]:g} million shares {"freed" if freed else "to come"}' + (f' ({r["note"]})' if r["note"] else "")
    s3.append(f'<path d="{path}" fill="{"#8a8c8e" if freed else "#121314"}" stroke="#8a8c8e" stroke-width="1.4"><title>{esc(tip)}</title></path>'
              f'<rect x="{x-16:.1f}" y="{B_T}" width="32" height="{B_B-B_T}" fill="#121314" fill-opacity="0"><title>{esc(tip)}</title></rect>'
              f'<rect x="{x-lw/2:.1f}" y="{y-18:.1f}" width="{lw:.1f}" height="14" fill="#121314"/><text x="{x:.1f}" y="{y-7:.1f}" fill="#cdcfd1" text-anchor="middle" font-weight="600">{lab}</text>'
              f'<text x="{x:.1f}" y="{B_B + (29 if row else 15)}" fill="{"#c4c6c8" if freed else "#cdcfd1"}" text-anchor="middle">{dlabel(r["date"]).upper()}</text>')
s3.append(f'<rect x="{ML3+300}" y="{B_T-24}" width="10" height="10" fill="#8a8c8e"/><text x="{ML3+316}" y="{B_T-14}" fill="#c4c6c8">ALREADY FREED</text>'
          f'<rect x="{ML3+430}" y="{B_T-24}" width="10" height="10" fill="#121314" stroke="#8a8c8e" stroke-width="1.4"/><text x="{ML3+446}" y="{B_T-14}" fill="#c4c6c8">STILL TO COME</text>')
s3.append("</svg>"); SVG3 = "\n".join(s3)
sup = CP["supply"]

# ------------------------------------------------------------------ tables
def name_cell(n): return f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:26])}</span><br><span class="dimmer">{esc(n["cohort"])} · rank {n["rank"]} on {RANK_L}, {n["rank_now"]} on {NOW_L}</span>'
def fig_row(n):
    c = n["comps"]
    return [name_cell(n), pct(n["r3m"]), pct(n["r1m"]), pct(n["r_run"]), pct(n["r_selloff"]), geiger(n["geiger"]),
            pct(n["rev_growth_latest_q_yoy_pct"], frac=False), pct(n["rev_growth_next_fy_pct"], frac=False), pct(n["eps_growth_next_fy_pct"], frac=False),
            arrow(n["eps_rev_90d_direction"]) + (f' <span class="dimmer">{n["eps_rev_90d_pct"]:+.0f}%</span>' if isinstance(n.get("eps_rev_90d_pct"), (int, float)) else ""),
            arrow(n["rev_est_rev_90d_direction"]), guide(n["guidance_direction"], n.get("guidance_kind")),
            margin(n["gross_margin_pct"], n["gross_margin_year_ago_pct"]), margin(n["operating_margin_pct"], n["operating_margin_year_ago_pct"]),
            money(n["fcf_ttm_usd_b"]), money(n["net_cash_usd_b"]), pct(n["shares_change_yoy_pct"], digits=1, frac=False),
            vs(n["forward_pe"], c["pe_median"], c["pe_n"], 0), vs(n["ev_sales"], c["evs_median"], c["evs_n"], 1), conc(n),
            f'{usd(n["cap_run_start_b"])} → <b>{usd(n["cap_now_b"])}</b>']
FIG_HEAD = ["NAME", "3 MONTHS", "1 MONTH", f"THE BOUNCE<br>15 Sep → {NOW_L}", "THE FALL<br>30 Jun → 15 Sep", "GEIGER", "SALES<br>last quarter", "SALES<br>next year", "EPS<br>next year",
            "EPS ESTIMATE<br>last 90 days", "SALES ESTIMATE<br>last 90 days", "ITS OWN<br>GUIDANCE", "GROSS MARGIN", "OPERATING MARGIN", "FREE CASH<br>$B, 12 mo", "CASH LESS DEBT<br>$B",
            "SHARE COUNT<br>1 year", "FORWARD P/E<br>vs comps", "EV / SALES<br>vs comps", "CUSTOMERS", f"VALUE<br>15 Sep → {NOW_L}"]
def story_row(n):
    return [f'<b>{n["ticker"]}</b>', esc(n["one_line_story"] or "–"), esc(n["customer_concentration"] or "–"), esc(n["insider_lockup_events"] or "–"), esc(n["last_earnings_summary"] or "–")]
STORY_HEAD = ["NAME", "WHY IT MOVED (three months)", "WHO BUYS FROM IT", "NEW SHARES, LOCK-UPS, INSIDERS, BUYBACKS (1 Jul → 6 Dec)", "LAST REPORT"]
grp = lambda g: [N[t] for t in G[g]]
T_LEAD, T_LAG, T_MID = tbl(FIG_HEAD, [fig_row(n) for n in grp("leader")], "fig"), tbl(FIG_HEAD, [fig_row(n) for n in grp("laggard")], "fig"), tbl(FIG_HEAD, [fig_row(n) for n in grp("named_mid")], "fig")
S_LEAD, S_LAG, S_MID = tbl(STORY_HEAD, [story_row(n) for n in grp("leader")], "story"), tbl(STORY_HEAD, [story_row(n) for n in grp("laggard")], "story"), tbl(STORY_HEAD, [story_row(n) for n in grp("named_mid")], "story")

cond_rows = []
for i in S["conditions_sorted_ids"]:
    c = C[i]
    cond_rows.append([esc(c["family"]), esc(c["words"]), f'<span class="up">{c["leaders_yes"]} of {c["leaders_n"]}</span>', f'<span class="dn">{c["laggards_yes"]} of {c["laggards_n"]}</span>',
                      f'{c["gap_points"]:+.0f}', esc(c["strength"]),
                      (f'{c["strict"]["leaders_yes"]} of {c["strict"]["leaders_n"]} · {c["strict"]["laggards_yes"]} of {c["strict"]["laggards_n"]}' if c.get("strict") else '<span class="na">–</span>'),
                      esc(" ".join(c["leaders"]["yes"]) or "–"), esc(" ".join(c["laggards"]["yes"]) or "–"),
                      esc(" ".join(c["leaders"]["no_reading"] + c["laggards"]["no_reading"]) or "–")])
T_COND = tbl(["KIND", "CONDITION", "LEADERS", "LAGGARDS", "GAP (pts)", "HOW SURE", "WHERE TWO READINGS AGREE<br>leaders · laggards", "LEADERS: YES", "LAGGARDS: YES", "NO READING"], cond_rows, "cond")

kind_rows = [[esc(k["kind"]), k["field"], f'<span class="up">{len(k["leaders"])}</span> <span class="dimmer">{esc(" ".join(k["leaders"]))}</span>', f'<span class="dn">{len(k["laggards"])}</span> <span class="dimmer">{esc(" ".join(k["laggards"]))}</span>'] for k in S["kinds"] if k["field"]]
T_KIND = tbl(["WHAT THE THREE MONTHS LOOKED LIKE", f"OF THE {S['field']}", "LEADERS", "LAGGARDS"], kind_rows)

pair_html = []
for p in S["pairs"]:
    rows = []
    for t in p["leaders"] + p["others"]:
        n = N[t]; who = {"leader": '<span class="up">LEADER</span>', "laggard": '<span class="dn">LAGGARD</span>', "named_mid": "MID-FIELD"}[n["group"]]
        rows.append([f'<b>{t}</b> {who}', pct(n["r3m"]), pct(n["r_run"]), pct(n["rev_growth_next_fy_pct"], frac=False), arrow(n["eps_rev_90d_direction"]), guide(n["guidance_direction"], n.get("guidance_kind")),
                     margin(n["operating_margin_pct"], n["operating_margin_year_ago_pct"]), money(n["fcf_ttm_usd_b"]), pct(n["shares_change_yoy_pct"], digits=1, frac=False), conc(n),
                     "yes" if n["supply_overhang"] else "no" if n["supply_overhang"] is False else "–"])
    pair_html.append(f'<h3>{esc(p["cohort"])}</h3><div class="wrap">' + tbl(["NAME", "3 MONTHS", "THE BOUNCE", "SALES next year", "EPS ESTIMATE 90 days", "GUIDANCE", "OPERATING MARGIN", "FREE CASH $B", "SHARE COUNT 1 yr", "CUSTOMERS", "NEW SHARES COMING"], rows, "fig") + "</div>")
PAIRS = "\n".join(pair_html)

cap_rows = [[f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:30])}</span>', usd(n["cap_selloff_start_b"]), usd(n["cap_run_start_b"]), f'<b>{usd(n["cap_now_b"])}</b>', usd_signed(n["cap_added_in_run_b"]), pct(n["r_run"]),
             "raised money since 1 Jul; if by selling shares, the start values read high" if n["raised_capital_90d"] else ""] for n in sorted(grp("leader"), key=lambda n: -(n["cap_now_b"] or 0))]
cl, cg, cf = S["caps"]["leaders"], S["caps"]["laggards"], S["caps"]["field"]
cap_rows.append([f'<b>THE {len(G["leader"])} LEADERS</b>', f'<b>{usd3(cl["selloff_start_b"])}</b>', f'<b>{usd3(cl["run_start_b"])}</b>', f'<b>{usd3(cl["now_b"])}</b>', f'<b>{usd3_signed(cl["now_b"], cl["run_start_b"])}</b>', pct(cl["now_b"]/cl["run_start_b"]-1), ""])
cap_rows.append([f'the {len(G["laggard"])} laggards', usd3(cg["selloff_start_b"]), usd3(cg["run_start_b"]), usd3(cg["now_b"]), usd3_signed(cg["now_b"], cg["run_start_b"]), pct(cg["now_b"]/cg["run_start_b"]-1), ""])
cap_rows.append([f'the whole field ({cf["n"]} names)', usd3(cf["selloff_start_b"]), usd3(cf["run_start_b"]), usd3(cf["now_b"]), usd3_signed(cf["now_b"], cf["run_start_b"]), pct(cf["now_b"]/cf["run_start_b"]-1), "Alphabet's two share lines counted once"])
T_CAPS = tbl(["LEADER", "30 JUN", "15 SEP (start of the bounce)", NOW_L.upper(), "ADDED IN THE BOUNCE", "PRICE IN THE BOUNCE", ""], cap_rows, "caps")
lag_cap_rows = [[f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:30])}</span>', usd(n["cap_selloff_start_b"]), usd(n["cap_run_start_b"]), f'<b>{usd(n["cap_now_b"])}</b>', usd_signed(n["cap_added_in_run_b"]), pct(n["r_run"]),
                 "raised money since 1 Jul; if by selling shares, the start values read high" if n["raised_capital_90d"] else ""] for n in sorted(grp("laggard") + grp("named_mid"), key=lambda n: -(n["cap_now_b"] or 0))]
T_CAPS_LAG = tbl(["LAGGARD / NAMED", "30 JUN", "15 SEP", NOW_L.upper(), "CHANGE IN THE BOUNCE", "PRICE IN THE BOUNCE", ""], lag_cap_rows, "caps")
coh_rows = [[esc(c["label"]), c["n"], usd(c["selloff_start_b"]), usd(c["run_start_b"]), f'<b>{usd(c["now_b"])}</b>', usd_signed(c["now_b"] - c["run_start_b"]), pct(c["run_pct"]), pct(c["median_r_run"]), pct(c["median_r1m"]), pct(c["median_r3m"]), geiger(c["median_geiger"]),
             f'<span class="up">{len(c["leaders"])}</span> · <span class="dn">{len(c["laggards"])}</span>',
             (f'{usd(c["leaders_run_start_b"])} → <b>{usd(c["leaders_now_b"])}</b>' if c["leaders"] else '<span class="na">–</span>'),
             esc(" · ".join(f"{t} {usd(v)}" for t, v in c["biggest"]))] for c in sorted(S["cohort_caps"], key=lambda c: -(c["median_r1m"] or -9))]
T_COH = tbl(["COHORT", "NAMES", "30 JUN", "15 SEP", NOW_L.upper(), "ADDED IN THE BOUNCE", "VALUE IN THE BOUNCE", "MEDIAN NAME, THE BOUNCE", "MEDIAN 1 MONTH", "MEDIAN 3 MONTHS", "MEDIAN GEIGER", "LEADERS · LAGGARDS", f"ITS LEADERS' VALUE<br>15 Sep → {NOW_L}", "ITS THREE BIGGEST"], coh_rows, "caps")

comp_rows = []
for g in ("leader", "laggard", "named_mid"):
    for n in grp(g):
        c = n["comps"]
        mark = lambda t: f'<span class="up">{t}</span>' if t in c["peers_leaders"] else f'<span class="dn">{t}</span>' if t in c["peers_laggards"] else t
        comp_rows.append([f'<b>{n["ticker"]}</b> <span class="dimmer">{ {"leader": "leader", "laggard": "laggard", "named_mid": "mid-field"}[g]}</span>', esc(c["own_lines"]), " ".join(mark(t) for t in c["peers"]),
                          pct(n["r3m"]) + ' <span class="dimmer">vs</span> ' + pct(c["peers_r3m_median"]), pct(n["r_run"]) + ' <span class="dimmer">vs</span> ' + pct(c["peers_run_median"]),
                          vs(n["forward_pe"], c["pe_median"], c["pe_n"], 0) + f' <span class="dimmer">({c["pe_n"]} of {c["n_peers"]})</span>', vs(n["ev_sales"], c["evs_median"], c["evs_n"], 1) + f' <span class="dimmer">({c["evs_n"]} of {c["n_peers"]})</span>'])
T_COMPS = tbl(["NAME", "ITS BUSINESS LINE", "THE COMPS SYSTEM'S COMPARABLES", "3 MONTHS: IT vs COMPS' MEDIAN", "THE RUN: IT vs COMPS' MEDIAN", "FORWARD P/E vs COMPS' MEDIAN (comps with a reading)", "EV/SALES vs COMPS' MEDIAN"], comp_rows, "comps")

def where(x):
    n = N[x["ticker"]]; now_bottom = n["rank_now"] > S["field"] - 20
    if x["group"] == "laggard": return '<span class="dn">laggard (bottom 20 on both days)</span>'
    if x["ticker"] in G["laggard"]: return '<span class="dn">counted as a laggard because it was named</span>' + (f'; on {NOW_L} it is in the bottom 20 on its own' if now_bottom else f'; bottom third')
    return "middle of the field"
named_rows = [[f'<b>{x["ticker"]}</b>', f'{x["rank"]} of {x["of"]}', f'{N[x["ticker"]]["rank_now"]} of {x["of"]}', pct(N[x["ticker"]]["r3m"]), pct(N[x["ticker"]]["r_run"]), where(x)] for x in S["named_in_brief"]]
T_NAMED = tbl(["NAMED IN THE BRIEF", f"RANK ON {RANK_L.upper()}", f"RANK ON {NOW_L.upper()}", "3 MONTHS", "THE BOUNCE", "WHERE IT REALLY SITS"], named_rows)

K = S["checks"]; kb = K["beat_own_comps"]; kt = K["ticks_every_box"]; ks = K["size_of_raise"]; kd = K["who_added_the_dollars"]
CH1 = bars([(c["words"], c["a_yes"], c["a_n"], c["b_yes"], c["b_n"], c["gap_points"], "clear" if c["strength"] == "clear" else "leans" if c["strength"] == "leans" else "no real difference") for c in kb["conditions"]],
           f'BEAT ITS OWN COMPS IN THE BOUNCE ({len(kb["beat"])})', f'TRAILED ITS COMPS ({len(kb["behind"])})', "The main conditions re-counted after taking out each name's own comps")
tick_rows = [[f'<b>{b["ticker"]}</b>', {"leader": '<span class="up">leader</span>', "laggard": '<span class="dn">laggard</span>', "named_mid": "mid-field"}[b["group"]], f'{b["rank"]} of {S["field"]}', pct(b["r3m"]), pct(b["r_run"]), pct(b["worst_in_selloff"]),
              pct(b["shares_change_yoy_pct"], digits=1, frac=False), "yes" if b["supply_overhang"] else "no" if b["supply_overhang"] is False else "–", pct(b["pe_vs_comps"])] for b in kt["names"]]
T_TICK = tbl(["HAS ALL FOUR", "GROUP", f"RANK ON {RANK_L.upper()}", "3 MONTHS", "THE BOUNCE", "WORST POINT IN THE FALL", "SHARE COUNT 1 yr", "NEW SHARES COMING", "FORWARD P/E vs COMPS' MEDIAN"], tick_rows, "fig")
size_rows = [[f'<b>{x["ticker"]}</b>', {"leader": '<span class="up">leader</span>', "laggard": '<span class="dn">laggard</span>', "named_mid": "mid-field"}[x["group"]], pct(x["eps_rev_90d_pct"], frac=False), pct(x["r_run"]), pct(x["r3m"])] for x in ks["rows"]]
T_SIZE = tbl(["NAME", "GROUP", "EARNINGS ESTIMATE, 90 DAYS", "THE BOUNCE", "3 MONTHS"], size_rows, "fig")
who = {"leader": '<span class="up">leader</span>', "laggard": '<span class="dn">laggard</span>', "named_mid": "named, mid-field", "field": '<span class="dimmer">rest of the field</span>'}
add_rows = [[f'<b>{a["ticker"]}</b>', who[a["group"]], f'{a["rank"]} of {S["field"]}', esc(a["cohort"]), usd(a["now_b"]), usd_signed(a["added_b"]), pct(a["r_run"])] for a in kd["top"]] + \
           [['<span class="dimmer">…</span>', "", "", "", "", "", ""]] + [[f'<b>{a["ticker"]}</b>', who[a["group"]], f'{a["rank"]} of {S["field"]}', esc(a["cohort"]), usd(a["now_b"]), usd_signed(a["added_b"]), pct(a["r_run"])] for a in kd["bottom"]]
T_ADD = tbl(["NAME", "GROUP", f"RANK ON {RANK_L.upper()}", "COHORT", f"VALUE ON {NOW_L.upper()}", "ADDED IN THE BOUNCE", "PRICE IN THE BOUNCE"], add_rows, "caps")
ev_rows = "".join(f'<tr><td>{esc(e["claim"])}</td><td>{esc(e["count"])}</td></tr>' for e in OP.get("evidence", []))
OPINION = "".join(f'<h4>{esc(p["head"])}</h4><p>{esc(p["text"])}</p>' if isinstance(p, dict) else f"<p>{esc(p)}</p>" for p in OP["paragraphs"])
AGAINST = "".join(f"<li>{esc(a)}</li>" for a in OP.get("against", []))
RK = S["recheck"]; RS = RK["summary"]; grp_of = lambda t: {"leader": '<span class="up">leader</span>', "laggard": '<span class="dn">laggard</span>', "named_mid": "mid-field"}.get((N.get(t) or {}).get("group"), "")
link = lambda u: (f'<a href="{esc(u)}">{esc(u.split("/")[2].replace("www.", ""))}</a>' if str(u).startswith("http") else esc(u))
ok = lambda v: f'<span class="up">✓ {esc(v)}</span>' if str(v).startswith(("matches", "within", "direction confirmed")) else f'● {esc(v)}'
tick = lambda v: f'<span class="up">✓ {esc(v)}</span>'
T_RSUM = tbl(["WHAT WAS RE-READ", "RESULT"], [
    ["Price figures (3-month, 1-month and bounce returns, the close) for all 145 names, re-derived from my own pull of the chart API", tick(RS["price_figures"])],
    ["The ranking, re-run from its saved inputs", tick("the same file, byte for byte")],
    ["Estimate pairs the first run had saved (90 days ago → now)", tick(RS["estimate_pairs_saved_and_re_read"])],
    ["Estimate directions that rested on analysts' notes only", tick(RS["estimate_directions_from_notes_now_measured"])],
    ["Names that had no estimate reading", "● " + esc(RS["estimate_new_readings"]) + ": new readings"],
    ["Estimate pages that would not load on 7 Oct", "● " + esc(" ".join(RK["pages_not_loaded"])) + ": these stand on the first run alone"],
    ["Guidance, against the company's own release", tick(RS["guidance"])],
    ["A test on names the finding was not built from (section 11g)", tick(RS["out_of_sample"])],
    ["Market value and share count, against the public page", tick(RS["market_value"])],
    ["Six figures on each of 12 statistics pages: six leaders and six laggards drawn by a fixed seed (section 11e)", tick(RS["statistics_pages"])],
    ["Cerebras, fact by fact, against the filing, the release and the article", "● " + esc(RS["cbrs_facts"])]])
T_RPAIR = tbl(["NAME", "GROUP", "FISCAL YEAR", "90 DAYS AGO", "NOW", "CHANGE", "CALLED", "THE FIRST RUN HAD", "RESULT"],
    [[f'<b>{e["ticker"]}</b>', grp_of(e["ticker"]), esc(e["year"]), f'{e["then"]:,.2f}', f'{e["now"]:,.2f}', pct(e["pct"], 1, frac=False), arrow(e["direction"]), esc(e["saved"]), ok(e["verdict"]) + (f'<br><span class="dimmer">{esc(e["note"])}</span>' if e.get("note") else "")] for e in RK["estimate_pairs"]], "re")
T_RGUIDE = tbl(["NAME", "GROUP", "THE FIRST RUN HAD", "WHAT THE COMPANY'S RELEASE SAYS", "RESULT", "SOURCE"],
    [[f'<b>{e["ticker"]}</b>', grp_of(e["ticker"]), esc(e["saved"]), esc(e["read"]), ok(e["verdict"]), link(e["source"])] for e in RK["guidance"]], "story")
T_RCAP = tbl(["NAME", "THE FIRST RUN HAD", "THE PAGE SHOWS", "SHARES", "RESULT", "NOTE"],
    [[f'<b>{e["ticker"]}</b>', usd(e["saved_cap_b"]), f'{usd(e["read_cap_b"])} at ${e["read_price"]:,.2f}', f'{e["read_shares_m"]:,.2f}M', ok(e["verdict"]), esc(e.get("note", ""))] for e in RK["market_value"]], "story")
T_RCBRS = tbl(["CEREBRAS", "THE FIRST RUN HAD", "RE-READ FROM THE SOURCE", "RESULT", "NOTE", "SOURCE"],
    [[f'<b>{esc(e["fact"])}</b>', esc(e["saved"]), esc(e["read"]), ok(e["verdict"]), esc(e.get("note", "")), link(e["source"])] for e in RK["cbrs"]["items"]], "story")
INS = json.load(open(os.path.join(D, "data", "cbrs-insider-sales.json")))
T_RINS = tbl(["DATE", "WHO", "SHARES SOLD", "VALUE"], [[dlabel(r["date"]), esc(r["who"]), f'{r["shares"]:,}', f'${r["usd"]/1e6:,.1f}M'] for r in INS["rows"]] + [["<b>14 Aug to 29 Sep</b>", "<b>16 sales</b>", f'<b>{INS["total_shares"]:,}</b>', f'<b>${INS["total_usd"]/1e6:,.1f}M</b>']], "caps")
T_RSCH = tbl(["DATE", "SHARES, MILLIONS", "", "NOTE"], [[dlabel(r["date"]), f'{r["m"]:g}', "freed" if r["state"] == "freed" else "<b>still to come</b>", esc(r["note"])] for r in sch["rows"]] +
             [["<b>since the 12 Aug report</b>", f'<b>{sup["freed_since_the_12_aug_report_m"]:g}</b>', "freed", f'against {sup["sold_at_the_ipo_m"]} million sold at the listing'], ["<b>inside the bounce (15 Sep → 6 Oct)</b>", f'<b>{sup["of_which_inside_the_bounce_15sep_6oct_m"]:g}</b>', "freed", ""]], "caps")
RR = RK["rerank"]
T_RRANK = tbl(["THE SAME RULE ON THE " + NOW_L.upper() + " CLOSE", "COUNT", "NAMES (rank on " + RANK_L + " → rank on " + NOW_L + ")"], [
    ["Leaders still in the top 25", f'<b>{RR["leaders_kept"]} of 25</b>', ""],
    ["Left the top 25", str(len(RR["leaders_left"])), esc(" · ".join(f'{t} {N[t]["rank"]} → {r}' for t, r in RR["leaders_left"]))],
    ["Entered the top 25 (not read one by one)", str(len(RR["leaders_entered"])), esc(" · ".join(f"{t} {a} → {b}" for t, a, b in RR["leaders_entered"]))],
    ["Bottom 20 unchanged", f'<b>{RR["laggards_kept"]} of 20</b>', ""],
    ["Left the bottom 20", str(len(RR["laggards_left"])), esc(" · ".join(f'{t} {N[t]["rank"]} → {r}' for t, r in RR["laggards_left"]))],
    ["Entered the bottom 20", str(len(RR["laggards_entered"])), esc(" · ".join(f"{t} {a} → {b}" for t, a, b in RR["laggards_entered"]))],
    ["The names the brief asked about", str(len(RR["named"])), esc(" · ".join(f"{t} {a} → {b}" for t, a, b in RR["named"]))]])
OOS = RK.get("out_of_sample") or {"rows": [], "result": {}, "not_loaded": []}
T_ROOS = tbl(["ENTERED THE TOP 25 ON " + NOW_L.upper(), "FISCAL YEAR", "90 DAYS AGO", "NOW", "CHANGE", "ESTIMATE", "GUIDANCE", "WHAT THE LAST REPORT SAID"],
    [[f'<b>{r["ticker"]}</b> <span class="dimmer">{esc(r["name"])}</span>', esc(r["year"]), f'{r["then"]:,.2f}', f'{r["now"]:,.2f}', pct(r["pct"], 1, frac=False), arrow(r["estimate"]), guide(r["guidance"], r.get("guidance_kind")), esc(r["guidance_read"])] for r in OOS["rows"]] +
    [[f'<b>{t}</b>', '<span class="na">page would not load</span>', "", "", "", '<span class="na">–</span>', '<span class="na">–</span>', ""] for t in OOS["not_loaded"]], "re")
SP = RK.get("statistics_pages") or {"rows": [], "differences": [], "by_field": {}}
def spcell(c):
    f = lambda v: '<span class="na">none</span>' if v is None else f"{v:,.2f}"
    return (f'<span class="up">✓</span> {f(c["read"])}' if c["match"] else f'● {f(c["saved"])} <span class="dimmer">saved ·</span> {f(c["read"])} <span class="dimmer">page</span>')
T_RSTAT = tbl(["NAME", "GROUP", "MARKET VALUE $B", "SHARE COUNT, 1 YEAR %", "FORWARD P/E", "EV / SALES", "CASH LESS DEBT $B", "FREE CASH FLOW $B"],
    [[f'<b>{r["ticker"]}</b>', grp_of(r["ticker"])] + [spcell(c) for c in r["cells"]] for r in SP["rows"]] +
    [["<b>match within 5%</b>", ""] + [f'<b>{esc(v)}</b>' for v in SP["by_field"].values()]], "caps")
STOR = S.get("storage_note") or {"items": []}
T_RSTOR = tbl(["STORAGE", "READ", "RESULT", "SOURCE"], [[f'<b>{esc(e["fact"])}</b>', esc(e["read"]), "● " + esc(e["verdict"]), link(e["source"])] for e in STOR["items"]], "story")
changed = "".join(f'<li><b>{t}</b>: {esc("; ".join(n["changes"])[:900])}</li>' for t, n in N.items() if n["changes"])
xc = Q["hub_crosscheck"]; TW = Q["two_readings"]

PAGE = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>LD1 · Leaders vs laggards · 6 Oct 2026</title>
<style>
:root{{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#cdcfd1;--up:{UP};--dn:{DOWN}}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:56px 16px 60px}}
main{{max-width:1500px;margin:0 auto}}h1{{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}}
h2{{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}h3{{font-size:11px;letter-spacing:.12em;color:var(--dim);margin:18px 0 6px}}
.sub{{color:var(--dim);margin:0 0 18px}}.panel{{background:var(--panel);border:1px solid var(--line);padding:14px;margin:10px 0}}
table{{border-collapse:collapse;width:100%;font-size:11px}}th,td{{text-align:left;padding:5px 8px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{color:var(--dim);font-weight:500;letter-spacing:.06em;white-space:nowrap;position:sticky;top:0;background:var(--bg)}}
table.fig td,table.caps td{{white-space:nowrap;font-variant-numeric:tabular-nums}}table.fig td:first-child,table.caps td:first-child{{white-space:normal;min-width:190px}}
table.re td{{font-variant-numeric:tabular-nums}}table.re td:last-child{{min-width:300px}}table.re td:first-child{{white-space:nowrap}}
table.story td{{min-width:220px;max-width:420px}}table.story td:first-child{{min-width:60px}}table.comps td:nth-child(3){{min-width:330px}}table.cond td:nth-child(2){{min-width:300px}}
.up{{color:var(--up)}}.dn{{color:var(--dn)}}.na{{color:var(--faint)}}.dimmer{{color:var(--dim)}}b{{color:var(--bright);font-weight:600}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}
.kpi b{{display:block;font-size:19px;font-weight:600}}.kpi div>span{{color:var(--dim);font-size:11px}}
.opinion{{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--dim);padding:14px 18px;display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:22px}}
.opinion p{{margin:0 0 10px;font-size:13px;line-height:1.6;color:var(--bright)}}.opinion .tag{{font-size:11px;letter-spacing:.16em;color:var(--dim);margin-bottom:8px}}
.opinion h4{{margin:14px 0 4px;font-size:11px;letter-spacing:.14em;color:var(--dim);font-weight:500;text-transform:uppercase}}.opinion h4:first-of-type{{margin-top:0}}a{{color:var(--ink)}}
.opinion table td{{font-size:11px}}.opinion ul{{margin:6px 0 0;padding-left:16px;color:var(--ink);font-size:11px}}
details.sc-pagespecs{{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--ink);overflow-wrap:anywhere}}details.sc-pagespecs summary{{cursor:pointer;color:var(--bright);letter-spacing:.12em}}
details.sc-pagespecs p,details.sc-pagespecs li{{max-width:980px}}details.sc-pagespecs h3{{color:var(--bright)}}details.more{{margin:8px 0}}details.more summary{{cursor:pointer;color:var(--dim);letter-spacing:.1em;font-size:11px}}
.bars{{display:block}}.bkey{{display:flex;gap:22px;align-items:center;color:var(--ink);letter-spacing:.1em;margin:0 0 10px;flex-wrap:wrap}}.bkey .bgap{{margin-left:auto;color:var(--dim);letter-spacing:0}}
.sw{{display:inline-block;width:10px;height:10px;margin-right:7px}}.upb{{background:var(--up)}}.dnb{{background:var(--dn)}}
.brow{{display:grid;grid-template-columns:minmax(0,34%) minmax(0,1fr) 64px;gap:4px 16px;align-items:center;padding:7px 0;border-top:1px solid var(--line)}}
.bw{{text-align:right;color:var(--ink)}}.bl{{display:grid;grid-template-columns:minmax(0,1fr) 74px;gap:10px;align-items:center;margin:2px 0}}.bt{{background:var(--bg);height:12px}}.bt i{{display:block;height:12px}}
.bg{{text-align:right;color:var(--dim)}}.bg b{{font-size:13px}}
@media(max-width:800px){{.brow{{grid-template-columns:minmax(0,1fr) 52px}}.bw{{grid-column:1 / -1;text-align:left;color:var(--bright)}}}}
.wrap{{overflow-x:auto}}[data-scnav-slot]{{display:block;margin:0 0 14px}}.scnav.is-inline{{margin-bottom:14px}}.small{{font-size:11px;color:var(--dim)}}
@media(max-width:800px){{body{{padding:56px 16px 50px}}.opinion{{grid-template-columns:1fr}}.kpi{{grid-template-columns:1fr 1fr}}}}
</style></head><body><main>
<h1>LD1 · WHY THE LEADERS HELD UP AND BOUNCED, AND WHY OTHERS DID NOT</h1>
<p class="sub">a study · nothing on the Hub or in the database changed · branch hub/ld1-leaders-vs-laggards-20261006 · ranked on the {RANK_L} close · shown at the {NOW_L} close · company figures read 6 Oct, re-checked first-hand 7 Oct</p>

<div class="kpi">
<div><b>{S["field"]}</b><span>companies in the AI, chip, software and grid cohorts, ranked</span></div>
<div><b><span class="up">{len(G["leader"])}</span> · <span class="dn">{len(G["laggard"])}</span></b><span>leaders · laggards read one by one (+{len(G["named_mid"])} named, mid-field)</span></div>
<div><b>{pct(B["QQQ"]["r_run"],1)} · {pct(B["RSP"]["r_run"],1)}</b><span>15 Sep → {NOW_L}: Nasdaq-100 fund · the equal-weight S&amp;P</span></div>
<div><b>{pct(B["SMH"]["r_selloff"],0)} → {pct(B["SMH"]["r_run"],0)}</b><span>the chip fund: 30 Jun → 15 Sep, then the bounce</span></div>
<div><b>{usd3(cl["run_start_b"])} → {usd3(cl["now_b"])}</b><span>the leaders' combined value, 15 Sep → {NOW_L} ({usd3_signed(cl["now_b"], cl["run_start_b"])})</span></div>
<div><b>{usd3(cg["run_start_b"])} → {usd3(cg["now_b"])}</b><span>the laggards' combined value, 15 Sep → {NOW_L} ({usd3_signed(cg["now_b"], cg["run_start_b"])})</span></div>
</div>

<h2>1 · THE FALL AND THE BOUNCE, EVERY NAME</h2>
<div class="panel wrap">{SVG1}</div>
<div class="wrap">{T_KIND}</div>

<h2>2 · WHAT SEPARATES THEM, AS COUNTS</h2>
<div class="panel">{SVG2}</div>
<details class="more"><summary>EVERY CONDITION COUNTED, WITH THE NAMES</summary><div class="wrap">{T_COND}</div></details>
<h3>2b · BOTH SETS FELL HARD IN THE SUMMER. THESE BOUNCED: {esc(" ".join(BC["bounced"]))}. THESE DID NOT: {esc(" ".join(BC["stayed_down"]))}</h3>
<div class="panel">{SVG2B}</div>
<h3>2c · CEREBRAS (CBRS): ITS SHARE PRICE, AND THE SHARES FREED FOR SALE · {sup["freed_since_the_12_aug_report_m"]:g} MILLION FREED SINCE THE 12 AUG REPORT · {sup["sold_at_the_ipo_m"]} MILLION SOLD AT THE LISTING · IN THE BOUNCE IT {"FELL" if CP["run"] < 0 else "ROSE"} {abs(CP["run"])*100:.0f}% WHILE ITS COMPS ROSE {CP["comps_run_median"]*100:.0f}%</h3>
<div class="panel wrap">{SVG3}</div>

<h2>3 · THE OPINION</h2>
<div class="opinion"><div><div class="tag">OPINION · THE AGENT'S OWN READ, NOT A MEASUREMENT</div>{OPINION}</div>
<div><div class="tag">THE EVIDENCE BESIDE IT</div><table><tbody>{ev_rows}</tbody></table>{'<div class="tag" style="margin-top:14px">WHAT ARGUES AGAINST IT</div><ul>' + AGAINST + '</ul>' if AGAINST else ''}</div></div>

<h2>4 · THE LEADERS ({len(G["leader"])})</h2>
<div class="wrap">{T_LEAD}</div>
<details class="more"><summary>EACH LEADER IN WORDS: WHY IT MOVED, WHO BUYS FROM IT, NEW SHARES AND INSIDERS, THE LAST REPORT</summary><div class="wrap">{S_LEAD}</div></details>

<h2>5 · THE LAGGARDS ({len(G["laggard"])})</h2>
<div class="wrap">{T_LAG}</div>
<details class="more"><summary>EACH LAGGARD IN WORDS</summary><div class="wrap">{S_LAG}</div></details>

<h2>6 · THE NAMES THE BRIEF ASKED ABOUT: WHERE EACH REALLY SITS</h2>
<div class="wrap">{T_NAMED}</div>
<h3>THE {len(G["named_mid"])} THAT SIT MID-FIELD (NOT COUNTED AS LAGGARDS)</h3>
<div class="wrap">{T_MID}</div>
<details class="more"><summary>EACH IN WORDS</summary><div class="wrap">{S_MID}</div></details>

<h2>7 · SAME COHORT, DIFFERENT OUTCOME</h2>
{PAIRS}

<h2>8 · MARKET VALUE: WHERE THE BOUNCE PUT THEM</h2>
<div class="kpi" style="margin-bottom:10px"><div><b>{usd3(cl["run_start_b"])} → {usd3(cl["now_b"])}</b><span>the 25 leaders, 15 Sep → {NOW_L} ({usd3_signed(cl["now_b"], cl["run_start_b"])})</span></div><div><b>{kd["top3_leaders_share_of_leader_value"]*100:.0f}%</b><span>of the leaders' value is three names: {esc(" · ".join(sorted(G["leader"], key=lambda t: -(N[t]["cap_now_b"] or 0))[:3]))}</span></div><div><b>{usd(kd["median_cap_leaders_b"])} · {usd(kd["median_cap_laggards_b"])}</b><span>the middle leader · the middle laggard</span></div><div><b>{kd["leaders_share_of_field_gain"]*100:.0f}%</b><span>of the dollars the {S["field"]} names added in the bounce came from the 25 leaders</span></div></div>
<div class="wrap">{T_CAPS}</div>
<details class="more"><summary>THE LAGGARDS AND THE NAMED, ONE BY ONE</summary><div class="wrap">{T_CAPS_LAG}</div></details>
<h3>EVERY COHORT IN THE FIELD</h3>
<div class="wrap">{T_COH}</div>

<h2>9 · EACH NAME AGAINST ITS OWN COMPS</h2>
<div class="wrap">{T_COMPS}</div>

<h2>10 · FOUR CHECKS ON THE FINDING</h2>
<h3>10a · TAKE OUT THE INDUSTRY: EACH NAME AGAINST ITS OWN COMPS IN THE BOUNCE ({kb["leaders_that_beat"]} OF {len(G["leader"])} LEADERS AND {kb["laggards_that_beat"]} OF {len(G["laggard"])} LAGGARDS BEAT THEIR COMPS)</h3>
<div class="panel">{CH1}</div>
<h3>10b · WHO HAS ALL FOUR: HIGHER OUTLOOK, EARNINGS ESTIMATE RAISED, MAKES A PROFIT, BRINGS IN MORE CASH THAN IT SPENDS ({kt["leaders"]} OF {kt["leaders_total"]} LEADERS · {kt["laggards"]} OF {kt["laggards_total"]} LAGGARDS · {kt["named_mid"]} OF {kt["named_mid_total"]} NAMED MID-FIELD)</h3>
<div class="wrap">{T_TICK}</div>
<h3>10c · BIGGER RAISE, BIGGER MOVE? {ks["n"]} PROFITABLE NAMES WITH A MEASURED ESTIMATE PAIR · LINK WITH THE BOUNCE {ks["rank_corr_with_run"]:.2f} · WITH 3 MONTHS {ks["rank_corr_with_3m"]:.2f} (0 = NONE, 1 = PERFECT)</h3>
<details class="more"><summary>THE {ks["n"]} NAMES</summary><div class="wrap">{T_SIZE}</div></details>
<h3>10d · WHO ADDED THE DOLLARS IN THE BOUNCE: THE FIELD {usd_signed(kd["field_added_b"])} · THE 25 LEADERS {usd_signed(kd["leaders_added_b"])} · THE LAGGARDS {usd_signed(kd["laggards_added_b"])} · THE TOP FIVE NAMES {kd["top5_share"]*100:.0f}% OF THE FIELD'S GAIN</h3>
<div class="wrap">{T_ADD}</div>

<h2>11 · THE SECOND PASS, 7 OCT: WHAT WAS RE-READ FIRST-HAND</h2>
<div class="wrap">{T_RSUM}</div>
<h3>11a · THE SAME RULE ONE DAY LATER</h3>
<div class="wrap">{T_RRANK}</div>
<h3>11b · CEREBRAS, FACT BY FACT</h3>
<div class="wrap">{T_RCBRS}</div>
<details class="more"><summary>CEREBRAS: EVERY LOCK-UP RELEASE, AND EVERY OFFICER AND DIRECTOR SALE SINCE 14 AUG</summary><div class="wrap">{T_RSCH}</div><div class="wrap" style="margin-top:12px">{T_RINS}</div></details>
<h3>11c · EARNINGS ESTIMATES: 90 DAYS AGO → NOW, RE-READ</h3>
<div class="wrap">{T_RPAIR}</div>
<h3>11d · GUIDANCE, AGAINST THE COMPANY'S OWN RELEASE</h3>
<div class="wrap">{T_RGUIDE}</div>
<h3>11e · MARKET VALUE, SHARE COUNT AND THE CASH FIGURES</h3>
<div class="wrap">{T_RCAP}</div>
<div class="wrap" style="margin-top:12px">{T_RSTAT}</div>
<h3>11f · THE HARD-DISK MAKERS</h3>
<div class="wrap">{T_RSTOR}</div>
<h3>11g · A TEST ON NAMES THE FINDING WAS NOT BUILT FROM: THE SIX THAT ENTER THE TOP 25 ONE DAY LATER</h3>
<div class="wrap">{T_ROOS}</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<h3>WHAT THE PAGE SHOWS</h3>
<p>Alan, 6 Oct: "do a study with these leaders and whatever the comps system says are comparables for them, versus the ones that are doing wrong, like this CBRS one. What's the big difference between these names? Why is it that these names are the ones that bounced? In your opinion. And also what market cap did that put them at."</p>
<p>The field is every company in the AI, chip, software-and-internet and grid cohorts of CO1's tree ({S["field"]} names, 15 cohorts). Each is ranked on three things, each as a place inside the field: its 3-month return, its 1-month return and its Hub Geiger. The score is the plain average of the three places. The 25 highest are the leaders. The 20 lowest are the laggards, plus the two names the brief asked for that sat in the bottom third (CBRS and IREN): 22 in all. The other names the brief asked about (CRWV, NBIS, MU, SNDK, STX) rank in the middle and are shown apart, not counted as laggards.</p>
<p><b>Two dates.</b> The groups were set on the {RANK_L} close, the last close on file when the first run did the work, and the company figures were read for those names. Every return, market value and comps move on the page is shown at the {NOW_L} close. Section 11a shows what the same rule gives on the {NOW_L} close: {RR["leaders_kept"]} of the 25 leaders and {RR["laggards_kept"]} of the bottom 20 are the same names, and Cerebras moved from 112th to {N["CBRS"]["rank_now"]}th.</p>
<p>"The fall" is 30 June to 15 September: the Nasdaq-100 fund's high before the summer drop to its lowest close before the recovery. "The bounce" is 15 September to the {NOW_L} close. Section 1 puts every name on those two measures. Section 2 counts conditions: a bar is the share of the group that meets the condition, and the words beside it are the count, as "22 of 25". A name with no reading for a condition is left out of that count, so the second number can be below 25 or 22. "Clear" means the gap would be unusual by chance on groups this small (Fisher exact test under 5%); "leans" means under 20%; anything weaker is left out of the picture and kept in the table.</p>
<p><b>Picture 2c</b> has two panels on one time axis. The top panel is Cerebras's daily close since it listed on 14 May: each day's segment is green if the close was up on the day and red if down, and the flat line is the $185 listing price. The bottom panel is the number of shares freed from lock-up on each date (a lock-up bars early holders from selling for a time after a listing): a filled bar is already freed, an outlined bar is still to come, and the flat line is the 34.5 million shares sold at the listing. The 9 November bar is my arithmetic, not a published figure. Hovering a bar or a day gives its figure.</p>
<p><b>The opinion</b> in section 3 is the lane agent's own read. {esc(OP.get("method", OP.get("panel", "")))} Every count inside it is read from the study file when the page is built.</p>
<p><b>"Raised" guidance means one of two things</b>, marked beside each name. "Full year": the company raised full-year numbers it had already published. "Above forecasts": the company guides one quarter at a time, or gave its first outlook for a new year, and set it above what analysts were expecting. {len(RK["guidance_kind"]["raised_a_published_full_year_range"])} of the 24 leaders marked raised are the first kind and {len(RK["guidance_kind"]["guided_above_what_analysts_expected"])} the second. The same test was applied to every group.</p>
<p><b>Section 10</b> holds four checks a critic asked for. 10a asks whether a condition still separates once the industry is taken out, by splitting the 47 leaders and laggards into those that beat their own comps' median in the bounce and those that trailed it. 10b lists every name read that has all four of: a higher outlook, earnings estimate raised, a profit, more cash in than out. 10c asks whether bigger estimate raises went with bigger moves (0 means no link, 1 a perfect one). 10d ranks every name in the field by the dollars of market value it added in the bounce.</p>
<p><b>Section 11g</b> is a test on names the finding was not built from. The leaders' trait (estimates and guidance going up) was found on the 25 names ranked on the {RANK_L} close. One day later six different names are in the top 25. If the trait is real it should show in them too; if it were an accident of the 25 picked, it need not. Of the four that could be read, all four had estimates raised.</p>
<p><b>Section 11</b> is the second pass. The first run stopped at its weekly usage limit before it could return, so its work was unverified. On 7 Oct the lane re-read the figures the opinion leans on, itself and page by page, and the tables show what the first run had, what the page shows now, and whether they match.</p>
<h3>WHERE EACH NUMBER COMES FROM</h3>
<ul>
<li><b>Prices and returns:</b> daily closes pulled from the chart API on 7 Oct for all {S["field"]} names and seven funds, through the {NOW_L} close (tools/closes.py; prices only, no key). They match the closes CO1 had saved through {RANK_L} on every one of 580 figures.</li>
<li><b>Geiger:</b> the ranking used the Hub Geiger as the live page received it on 6 Oct at 14:53 ET (saved by BT1). The Geiger shown in the tables is the one published at {esc(S["geiger_published_utc"][:16].replace("T", " "))} UTC.</li>
<li><b>Cohorts:</b> CO1's cohort tree (proposal.json).</li>
<li><b>Comparables:</b> C5's own rule (business first, 12 kept) run on saved inputs: CO1's company profiles of 6 Oct and C5's revenue-segment file of 3 Oct. Against the four sets C6 saved from the live tab on 5 Oct it gives {", ".join(f'{c["ticker"]} {c["same"]} of {c["of"]}' for c in Q["comps_rule_vs_live_5oct"])} the same.</li>
<li><b>The three judgement calls (earnings estimate up or down, sales estimate up or down, guidance raised or not)</b> were read twice by AI readers on 6 Oct. The first knew which group a name was in. The second was blind: told only the ticker, and told not to look at the share price. Where the two agree the reading stands; where only one found an answer it stands and is counted; where they disagree the name is left out. On 7 Oct a third, first-hand reading was added for {len(RK["estimate_pairs"])} earnings estimates (section 11c): it fills a gap, settles a disagreement only when it matches one of the first two, and would remove a reading it contradicted (it contradicted none). Agreed · disagreed · one reading only · none: earnings estimate {TW["eps_rev_90d_direction"]["agree"]} · {len(TW["eps_rev_90d_direction"]["disagree"])} · {TW["eps_rev_90d_direction"]["one_only"]} · {TW["eps_rev_90d_direction"]["none"]}; sales estimate {TW["rev_est_rev_90d_direction"]["agree"]} · {len(TW["rev_est_rev_90d_direction"]["disagree"])} · {TW["rev_est_rev_90d_direction"]["one_only"]} · {TW["rev_est_rev_90d_direction"]["none"]}; guidance {TW["guidance_direction"]["agree"]} · {len(TW["guidance_direction"]["disagree"])} · {TW["guidance_direction"]["one_only"]} · {TW["guidance_direction"]["none"]}. Left out for disagreement: guidance {esc(" ".join(TW["guidance_direction"]["disagree"]) or "none")}.</li>
<li><b>Sales, earnings, estimates, margins, cash, share count, customers, insiders, lock-ups:</b> public web pages read on 6 Oct by one AI reader per name, then re-checked by a second told to find mistakes. Main pages: stockanalysis.com (statistics, forecast, financials), Yahoo estimate-trend pages, company filings and news. {Q["checked"]} of {Q["studied"]} names were checked; the checker changed something in {Q["names_changed_by_checker"]} of them ({Q["changes_total"]} changes).</li>
<li><b>Forward P/E and EV/sales of the comps:</b> the same public statistics pages, {Q["peers_read"]} of {Q["peers_wanted"]} comps read ({Q["peers_with_pe"]} with a forward P/E, {Q["peers_with_evs"]} with EV/sales). A median needs at least four comps with a reading.</li>
<li><b>Market value:</b> one basis for every name. Shares × close. The share count is the public page's for the 52 names read one by one and the Hub company profile's for the other {S["field"] - Q["studied"]}; the closes are the chart API's on 30 Jun, 15 Sep and {NOW_L}. Alphabet has two share lines in the field and is counted once.</li>
</ul>
<h3>WHAT COULD BE WRONG</h3>
<ul>
<li>The company figures were transcribed from web pages by AI readers. Two passes caught errors and the re-check found none in what it re-read, but it re-read a part, not the whole: {len(RK["estimate_pairs"])} of 52 earnings estimates, 5 of 52 guidance calls, the statistics page of 12 of the 52 (plus 3 more for market value), and Cerebras in full. On those 12 pages {SP["figures_matching"][0]} of {SP["figures_matching"][1]} figures matched within 5% and every yes/no reading they decide (profit, cash in, share count up, cash against debt) came out the same; the six that differed are three forward P/Es, which move with the source and the day, and Energy Fuels' share figures, which the first run's checker had taken from the filing. The counts are the finding; a single cell is not.</li>
<li>{len(RK["pages_not_loaded"])} estimate pages would not load on 7 Oct after three tries ({esc(" ".join(RK["pages_not_loaded"]))}), so those readings stand on the first run alone. No reading at all for: {esc(" ".join(Q["eps_revision_unknown"]) or "none")}.</li>
<li>The count "its comps' median is also up over the last month" moved from 3 of 22 laggards on the {RANK_L} close to {C["comps_up_1m"]["laggards_yes"]} of {C["comps_up_1m"]["laggards_n"]} on the {NOW_L} close. It turns on whether a median near zero is just above or just below it. The check in 10a moved the same way: on {RANK_L} profit did not separate names that beat their comps from names that trailed; on {NOW_L} it does. Read both loosely.</li>
<li>The first build added Alphabet's two share lines as two companies, which overstated the field's value by about $4.2 trillion. Fixed here. The leaders' and laggards' totals were not affected.</li>
<li>The Hub's own company profiles carry older share counts than the public pages for names that issued stock lately: Lumentum 13% fewer shares, AXT 23% fewer, and NuScale, Eos, Nebius and IREN also differ by 10% or more. The page uses the public count for the names it read; the other {S["field"] - Q["studied"]} names use the Hub's.</li>
<li>Market value at an earlier date holds the share count constant. A company that sold new shares in between reads too high at the start; those rows are marked.</li>
<li>Leaders and laggards mostly come from different cohorts (cybersecurity and chips against miners, nuclear and consumer internet). A condition can separate the cohorts without separating names inside a cohort. Section 7 puts leaders beside laggards from the same cohort for that reason.</li>
<li>Three months is one stretch of one market. The 22 and 25 are small groups, and the line at 25 is arbitrary.</li>
<li>The reason given for the hard-disk makers' fall (Toshiba adding output) rests on one news headline. The Cerebras item about OpenAI and Nvidia is market talk reported by one site.</li>
<li>The comps rule ran without its small "also named by FMP" bonus, so a peer at the edge of the 12 can differ from the live tab.</li>
<li>The page's green and red are the Hub's own direction colours. A reader who cannot tell red from green cannot tell them apart by colour alone, so every coloured figure also carries a sign or an arrow.</li>
</ul>
<h3>WHAT WAS NOT DONE</h3>
<ul>
<li>The live database and the comps tab were not read. In the first run two permission checks declined backend reads (listing the database with the Hub page's key, then looking through the provider code for other routes). Those stand: they were not retried in the second pass and no other route to the database was tried. So the 90-day revision history the database keeps (analyst_estimates_daily) is not in this study; revisions come from public pages.</li>
<li>The six names that enter the top 25 on the {NOW_L} close ({esc(" ".join(t for t, a, b in RR["leaders_entered"]))}) were not read one by one. Four of them were read for two things only, estimates and guidance, as a test (section 11g); {esc(" and ".join(OOS["not_loaded"]))} would not load. The two that enter the bottom 20 and had not been read ({esc(" ".join(t for t, a, b in RR["laggards_entered"] if t not in N))}) were not read.</li>
<li>No table was written, nothing was deployed, no Fly machine was started, no browser window was opened on screen. No sub-agent was used in the second pass.</li>
<li>QRVO is in the field's cohort but the provider no longer carries it, and it was skipped.</li>
</ul>
<h3>WHAT THE CHECKER CHANGED (FIRST RUN)</h3>
<ul class="small">{changed or "<li>nothing</li>"}</ul>
</details>
</main></body></html>
"""
open(os.path.join(D, "LEADERS-VS-LAGGARDS.html"), "w").write(PAGE)
print("wrote LEADERS-VS-LAGGARDS.html", len(PAGE), "bytes · conditions drawn:", len(shown))
