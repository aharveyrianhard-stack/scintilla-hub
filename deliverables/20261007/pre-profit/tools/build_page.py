# PP1 · builds PRE-PROFIT.html from data/pre-profit.json. Static: one small script of its own (the name finder), nothing
# fetched. Pictures first; no sentence of explanation sits in a panel — those are in PAGE SPECS at the foot.
# The look is the knockout page's own (its stylesheet is read, not copied by hand).   python3 <this file>
import json, os, html, math
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); WT = os.path.abspath(os.path.join(HERE, "../../../.."))
D = json.load(open(os.path.join(ROOT, "data", "pre-profit.json"))); K = D["knockout"]; H = D["history"]; RU = D["rules"]; W = RU["weights"]
CSS = open(os.path.join(WT, "deliverables/20261007/knockout/tools/page.css")).read() + open(os.path.join(HERE, "page-extra.css")).read()
e = lambda s: html.escape(str(s), quote=True)
INK, DIM, FAINT, LINE, TRACK, UP, DN, CY = "#c8c8cc", "#8c8c92", "#5a5a60", "#26262b", "#1a1a1e", "#3caa6e", "#c85050", "#3cb4c8"
def usd(v, dash="—"):
    if v is None: return dash
    a = abs(v); s = "−" if v < 0 else ""
    return f"{s}${a / 1e9:,.1f}B" if a >= 1e9 else f"{s}${a / 1e6:,.0f}M" if a >= 1e6 else f"{s}${a / 1e3:,.0f}K" if a >= 1e3 else f"{s}${a:,.0f}"
def pct(v, sign=True, dash="—", d=0):
    if v is None: return dash
    if abs(v) >= 1000: return ("+" if v > 0 and sign else "−" if v < 0 else "") + f"{abs(v):,.0f}%"
    s = f"{v:+.{d}f}%" if sign else f"{v:.{d}f}%"
    return s.replace("-", "−")
def times(v, d=1, dash="—"):
    if v is None: return dash
    return (f"{v:,.0f}×" if abs(v) >= 100 else f"{v:.{d}f}×").replace("-", "−")
def num(v, d=1, dash="—"): return dash if v is None else f"{v:.{d}f}".replace("-", "−")
def month(s):
    import datetime as dt
    return dt.date.fromisoformat(str(s)[:10]).strftime("%b %Y")
def day(s):
    import datetime as dt
    x = dt.date.fromisoformat(str(s)[:10]); return f"{x.day} {x.strftime('%b %Y')}"
def bar(v, w=56, h=8, title=None):
    """A 0…1 reading as one thin bar on its track (length is the reading; no colour)."""
    vb = f'viewBox="0 0 {w} {h}" preserveAspectRatio="none"'
    if v is None: return f'<svg class="bar" width="{w}" height="{h}" {vb} role="img" aria-label="not read"><rect width="{w}" height="{h}" rx="2" fill="{TRACK}"/><rect x="{w / 2 - 3}" y="{h / 2 - 0.5}" width="6" height="1" fill="{FAINT}"/></svg>'
    f = max(0.0, min(1.0, v)); t = f"<title>{e(title)}</title>" if title else ""
    return f'<svg class="bar" width="{w}" height="{h}" {vb} role="img" aria-label="{round(f * 100)} of 100">{t}<rect width="{w}" height="{h}" rx="2" fill="{TRACK}"/><rect width="{max(2, f * w):.1f}" height="{h}" rx="2" fill="{DIM}"/></svg>'
def pts(v): return "—" if v is None else f"{round(v * 100)}"
def tk(r, cls=""):
    mine = " mine" if r.get("lists") else ""
    return f'<span class="tk{mine} {cls}">{e(r["t"])}</span>'
PARTS = [("growth", "GROWTH"), ("price", "PRICE"), ("margin", "MARGIN"), ("money", "CASH & CAPEX"), ("dilution", "DILUTION"), ("debt", "DEBT"), ("quality", "ESTIMATES")]
SHELF = D["shelf"]; BY = {r["t"]: r for r in SHELF}; RANKED = [r for r in SHELF if r["ranked"]]; N_RANKED = len(RANKED)
UNRANKED = [r for r in SHELF if not r["ranked"] and not r["compare"]]; COMPARE = [r for r in SHELF if r["compare"]]
FOCUS = [BY[t] for t in RU["focus"] if t in BY]
def place(r):
    if r["ranked"]: return f'{r["rank"]} of {N_RANKED}'
    if r.get("would_rank"): return f'beside the shelf: it would stand {r["would_rank"]} of {N_RANKED}'
    return "listed, not ranked"
def tier_tag(r):
    if r["compare"]: return '<span class="tag">PROFITABLE · FOR COMPARISON</span>'
    if r["thin"]: return '<span class="tag wait">THIN ESTIMATES</span>'
    return '<span class="tag">NO SALES YET</span>' if r["tier"] == "V" else ""
# ---------------------------------------------------------------------------------------------------- 1 · the four
def fy_basis(r):
    """The same name on the fiscal-year footing the first figures were given on: the year that ends in 2027."""
    ys = [y for y in r["sales"]["years"] if str(y["end"]).startswith("2027")]
    if not ys or not ys[0].get("avg") or not r.get("ev"): return None
    y = ys[0]; return {"end": y["end"], "sales": y["avg"], "growth": y.get("growth"), "ev_sales": r["ev"] / y["avg"]}
def four_card(r):
    s = r["sales"]; c = r["capex"]; g = r["gap"]; d = r["dilution"]; b = r["debt"]; q = r["quality"]; bn = r["burn"]
    run = "cash coming in" if bn["basis"] == "not burning" else (f'{bn["quarters"]:.1f} quarters' if bn["quarters"] is not None else "—")
    ann = c.get("announced") or {}
    plan = f'{usd(c["plan"])} <span class="dim">· {e("announced for " + ann["period"] if ann.get("use") else c["plan_basis"] or "")}</span>'
    gap = "covered" if (g["gap"] or 0) <= 0 else f'{usd(g["gap"])} to find · {pct(g["pct_of_value"], False)} of its market value'
    lev = (f'{times(b["nd_ebitda"])} EBITDA · ' if b["nd_ebitda"] is not None else "") + (f'{times(b["nd_sales"], 2)} next year\'s sales' if b["nd_sales"] is not None and (b["net_debt"] or 0) > 0 else "") if (b["net_debt"] or 0) > 0 else "net cash"
    rows = [("SALES REPORTED, LAST 4 QUARTERS", f'{usd(s.get("booked"))} <span class="dim">· to {month(s["booked_to"])}</span>'), ("THE 12 MONTHS TO TODAY", f'{usd(s.get("last"))} <span class="dim">· part reported, part estimate</span>'),
            ("NEXT 12 MONTHS", f'{usd(s.get("next"))} <span class="dim">· {pct(s.get("g1"))}</span>'), ("THE 12 AFTER", f'{usd(s.get("after"))} <span class="dim">· {pct(s.get("g2"))}</span>'),
            ("EV ÷ NEXT YEAR\'S SALES", f'{times(r["ev_sales"])} <span class="dim">· the whole company {usd(r["ev"])}</span>'), ("GROSS MARGIN · 8 QUARTERS", f'{spark(r["margin"]["quarters"], 120, 22)}{pct(r["margin"]["now"], False)} <span class="dim">· {pct(r["margin"]["change"])} pts in a year</span>' if r["margin"]["now"] is not None else "—"),
            ("CASH + SHORT-TERM", usd(r["cash"]["cash_sti"])), ("AT THIS PACE IT LASTS", run), ("BUILD-OUT PLANNED", plan), ("AGAINST CASH", gap),
            ("SHARES, 1 YEAR · 2 YEARS", f'{pct(d["change_1y"])} · {pct(d["change_2y"])}'), ("STILL TO COME", f'{pct(d["overhang_pct"], False)} more shares <span class="dim">· convertibles, options, awards</span>' if d["overhang_pct"] is not None else "—"),
            ("NET DEBT", f'{usd(b["net_debt"])} <span class="dim">· {lev}</span>'), ("ANALYSTS · THEIR RANGE", f'{q["analysts"] if q["analysts"] is not None else "—"} · {pct(q["spread_sales"], False)} of the average on sales')]
    parts = "".join(f'<div class="prt"><span>{lab}</span>{bar(r["parts"][k], 80, 8, lab.title() + ": " + pts(r["parts"][k]) + " of 100")}<b>{pts(r["parts"][k])}</b></div>' for k, lab in PARTS)
    return (f'<div class="panel card"><div class="cardh">{tk(r, "big")}<span class="nm">{e(r["name"] or "")}</span>{tier_tag(r)}</div>'
            f'<div class="score"><b>{round(r["score"] * 100)}</b><span>OF 100 · {e(place(r)).upper()}</span></div>'
            f'<div class="two"><div><span>PROMISE</span>{bar(r["promise"], 110, 8)}<b>{pts(r["promise"])}</b></div><div><span>FOOTING</span>{bar(r["footing"], 110, 8)}<b>{pts(r["footing"])}</b></div></div>'
            f'<div class="prts">{parts}</div><dl class="facts">' + "".join(f"<dt>{k}</dt><dd>{v}</dd>" for k, v in rows) + "</dl></div>")
def sec_four():
    cards = "".join(four_card(r) for r in FOCUS)
    rows = ""
    for r in FOCUS:
        f = fy_basis(r); s = r["sales"]; sh = r["shares"]
        cnt = f'{sh["count"] / 1e6:,.1f}M · {e(sh["source"])}' + (f' {day(sh["as_of"])}' if sh.get("as_of") else "") if sh.get("count") else e(sh.get("source") or "—")
        rows += (f'<tr><td data-l="">{tk(r)}</td><td class="n" data-l="FISCAL YEAR TO">{month(f["end"]) if f else "—"}</td><td class="n" data-l="ITS SALES">{usd(f["sales"]) if f else "—"}</td><td class="n" data-l="GROWTH">{pct(f["growth"]) if f else "—"}</td><td class="n" data-l="EV ÷ THAT">{times(f["ev_sales"]) if f else "—"}</td>'
                 f'<td class="n" data-l="ONE WINDOW: NEXT 12 MONTHS">{usd(s.get("next"))}</td><td class="n" data-l="GROWTH">{pct(s.get("g1"))}</td><td class="n" data-l="EV ÷ THAT">{times(r["ev_sales"])}</td><td data-l="SHARES COUNTED">{cnt}</td>'
                 f'<td class="n" data-l="THE HUB\'S OWN VALUE">{usd(r["vendor_market_value"])} <span class="dim">({pct(r["value_gap_pct"])})</span></td></tr>')
    iren = BY.get("IREN"); yr = ""
    if iren:
        for y in iren["sales"]["years"]:
            if y["kind"] == "reported": yr += f'<tr><td data-l="YEAR TO">{month(y["end"])} <span class="dim">reported</span></td><td class="n" data-l="SALES">{usd(y["avg"])}</td><td class="n" data-l="LOW – HIGH">—</td><td class="n" data-l="ANALYSTS">—</td><td class="n" data-l="RANGE ÷ AVERAGE">—</td><td class="n" data-l="PROFIT A SHARE">—</td><td class="n" data-l="LOW – HIGH">—</td><td class="n" data-l="ANALYSTS">—</td></tr>'
            else: yr += (f'<tr><td data-l="YEAR TO">{month(y["end"])}</td><td class="n" data-l="SALES">{usd(y["avg"])}</td><td class="n" data-l="LOW – HIGH">{usd(y.get("low"))} – {usd(y.get("high"))}</td><td class="n" data-l="ANALYSTS">{y.get("n") or "—"}</td><td class="n" data-l="RANGE ÷ AVERAGE">{pct(y.get("spread_sales"), False)}</td>'
                         f'<td class="n" data-l="PROFIT A SHARE">{num(y.get("eps"), 2)}</td><td class="n" data-l="LOW – HIGH">{num(y.get("eps_low"), 2)} – {num(y.get("eps_high"), 2)}</td><td class="n" data-l="ANALYSTS">{y.get("n_eps") or "—"}</td></tr>')
    return (f'<section id="four"><h2>THE FOUR YOU NAMED</h2><div class="cards">{cards}</div>'
            f'<div class="panel"><div class="ph">THE SAME FOUR · ON FISCAL YEARS (AS FIRST GIVEN) AND ON ONE WINDOW</div><table class="r"><thead><tr><th></th><th class="n">FISCAL YEAR TO</th><th class="n">ITS SALES</th><th class="n">GROWTH</th><th class="n">EV ÷ THAT</th><th class="n">NEXT 12 MONTHS</th><th class="n">GROWTH</th><th class="n">EV ÷ THAT</th><th>SHARES COUNTED</th><th class="n">THE HUB\'S OWN VALUE</th></tr></thead><tbody>{rows}</tbody></table></div>'
            + (f'<div class="panel"><div class="ph">IREN, YEAR BY YEAR · WHERE THE ANALYSTS AGREE AND WHERE THEY SCATTER · PRICE {iren["price"]:.2f}</div><table class="r"><thead><tr><th>YEAR TO</th><th class="n">SALES</th><th class="n">LOW – HIGH</th><th class="n">ANALYSTS</th><th class="n">RANGE ÷ AVERAGE</th><th class="n">PROFIT A SHARE</th><th class="n">LOW – HIGH</th><th class="n">ANALYSTS</th></tr></thead><tbody>{yr}</tbody></table></div>' if iren else "") + "</section>")
# ---------------------------------------------------------------------------------------------------- 2 · the shelf
def shelf_row(r):
    s = r["sales"]; g = r["gap"]; d = r["dilution"]; b = r["debt"]; q = r["quality"]; bn = r["burn"]
    run = "in" if bn["basis"] == "not burning" else (num(bn["quarters"]) + "q" if bn["quarters"] is not None else "—")
    rk = str(r["rank"]) if r["ranked"] else (f'({r["would_rank"]})' if r.get("would_rank") else "·")
    cells = "".join(f'<td class="n pc" data-l="{lab}">{bar(r["parts"][k], 34, 7)}<span class="c">{pts(r["parts"][k])}</span></td>' for k, lab in PARTS)
    nd = "net cash" if (b["net_debt"] is not None and b["net_debt"] <= 0) else times(b["nd_sales"], 2)
    return (f'<tr data-find="{e((r["t"] + " " + (r["name"] or "") + " " + " ".join(r["branches"])).lower())}"><td class="rk" data-l="PLACE">{rk}</td><td data-l=""><span class="el">{tk(r)} <span class="dim">{e((r["name"] or "")[:22])}</span>{tier_tag(r)}</span></td>'
            f'<td class="n" data-l="SCORE"><b class="sc">{round(r["score"] * 100)}</b></td><td class="n pc" data-l="PROMISE">{bar(r["promise"], 34, 7)}<span class="c">{pts(r["promise"])}</span></td><td class="n pc" data-l="FOOTING">{bar(r["footing"], 34, 7)}<span class="c">{pts(r["footing"])}</span></td>{cells}'
            f'<td class="n" data-l="SALES NEXT 12M">{usd(s.get("next"))}</td><td class="n" data-l="GROWTH">{pct(s.get("g1"))}</td><td class="n" data-l="EV ÷ SALES">{times(r["ev_sales"])}</td><td class="n" data-l="CASH LASTS">{run}</td>'
            f'<td class="n" data-l="GAP ÷ VALUE">{"none" if g["gap"] is not None and g["gap"] <= 0 else pct(g["pct_of_value"], False)}</td><td class="n" data-l="SHARES 1Y">{pct(d["change_1y"])}</td><td class="n" data-l="NET DEBT ÷ SALES">{nd}</td><td class="n" data-l="ANALYSTS">{q["analysts"] if q["analysts"] is not None else "—"}</td></tr>')
def sec_shelf():
    c = D["counts"]; head = "".join(f'<th class="n">{lab}<br><span class="faint">{W[k]}</span></th>' for k, lab in PARTS)
    th = f'<thead><tr><th>#</th><th>NAME</th><th class="n">SCORE</th><th class="n">PROMISE</th><th class="n">FOOTING</th>{head}<th class="n">SALES NEXT 12M</th><th class="n">GROWTH</th><th class="n">EV ÷ SALES</th><th class="n">CASH LASTS</th><th class="n">GAP ÷ VALUE</th><th class="n">SHARES 1Y</th><th class="n">NET DEBT ÷ SALES</th><th class="n">ANALYSTS</th></tr></thead>'
    body = "".join(shelf_row(r) for r in RANKED) + (f'<tr class="sec"><td colspan="20">BESIDE THE SHELF · PROFITABLE, MEASURED THE SAME WAY</td></tr>' + "".join(shelf_row(r) for r in COMPARE) if COMPARE else "") + \
        (f'<tr class="sec"><td colspan="20">LISTED, NOT RANKED · FEWER THAN {RU["thin_analysts"]} ANALYSTS, OR NO ESTIMATES</td></tr>' + "".join(shelf_row(r) for r in UNRANKED) if UNRANKED else "")
    kp = [(c["on_shelf"], "ON THE SHELF"), (c["ranked"], "RANKED"), (c["tier"].get("V", 0), "WITH NEXT TO NO SALES YET"), (c["thin_not_ranked"] + c["no_estimates"], "LISTED, NOT RANKED"), (c["with_announced_capex"], "WITH A CAPEX FIGURE ANNOUNCED"), (c["companies_read"], "COMPANIES READ")]
    return (f'<section id="shelf"><h2>THE SHELF, RANKED · {c["on_shelf"]} COMPANIES WITH NO PROFIT NOW AND NONE EXPECTED THIS YEAR</h2><div class="kpis">' + "".join(f"<div class='kpi'><b>{a}</b><span>{b}</span></div>" for a, b in kp) + "</div>"
            f'<div class="panel"><input class="find" id="find" placeholder="find a name or a branch" aria-label="find a name or a branch"><div class="tw tall"><table class="r shelf" id="shelftable">{th}<tbody>{body}</tbody></table></div></div></section>')
# ---------------------------------------------------------------------------------------------------- 3 · promise against footing
def scatter(width, height, label_all):
    L, R, T, B = 46, 14, 14, 34; pw, ph = width - L - R, height - T - B
    X = lambda v: L + v * pw; Y = lambda v: T + (1 - v) * ph
    o = [f'<svg viewBox="0 0 {width} {height}" width="{width}" height="{height}" role="img" aria-label="Each ranked company placed by promise (across) and footing (up)">']
    for v in (0, 0.25, 0.5, 0.75, 1):
        o.append(f'<line x1="{X(v):.1f}" y1="{T}" x2="{X(v):.1f}" y2="{T + ph}" stroke="{TRACK if v != 0.5 else LINE}" stroke-width="1"/><line x1="{L}" y1="{Y(v):.1f}" x2="{L + pw}" y2="{Y(v):.1f}" stroke="{TRACK if v != 0.5 else LINE}" stroke-width="1"/>')
        o.append(f'<text x="{X(v):.1f}" y="{T + ph + 14}" fill="{DIM}" font-size="11" text-anchor="middle">{round(v * 100)}</text><text x="{L - 6}" y="{Y(v) + 4:.1f}" fill="{DIM}" font-size="11" text-anchor="end">{round(v * 100)}</text>')
    o.append(f'<text x="{L + pw / 2:.1f}" y="{height - 4}" fill="{DIM}" font-size="11" text-anchor="middle" letter-spacing="1.5">PROMISE →</text><text x="12" y="{T + ph / 2:.1f}" fill="{DIM}" font-size="11" text-anchor="middle" letter-spacing="1.5" transform="rotate(-90 12 {T + ph / 2:.1f})">FOOTING →</text>')
    focus = set(RU["focus"]); pts_ = sorted(RANKED + COMPARE, key=lambda r: r["t"] in focus)
    placed = []
    def room(x, y, w):
        for a, b_, c in placed:
            if abs(y - b_) < 12 and not (x + w < a or a + c < x): return False
        return True
    labels = []
    for r in pts_:
        x, y = X(r["promise"]), Y(r["footing"]); f = r["t"] in focus
        ring = CY if r.get("lists") else (INK if f else DIM)
        o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{5 if f else 4}" fill="{INK if f else "#111114"}" stroke="{ring}" stroke-width="2"><title>{e(r["t"])} · {e(r["name"] or "")} · promise {pts(r["promise"])} · footing {pts(r["footing"])} · score {round(r["score"] * 100)}{" · " + e(place(r))}</title></circle>')
        labels.append((f, r, x, y))
    for f, r, x, y in sorted(labels, key=lambda z: (not z[0], z[1]["rank"] or 99)):
        if not (f or label_all or (r["rank"] or 99) <= 8): continue
        w = 7.2 * len(r["t"]) + 4; lx = x + 8 if x + 8 + w < width - 2 else x - 8 - w; ly = y + 4
        if not room(lx, ly, w):
            ly = y - 9
            if not room(lx, ly, w): continue
        placed.append((lx, ly, w))
        o.append(f'<text x="{lx:.1f}" y="{ly:.1f}" fill="{INK if f else DIM}" font-size="11" font-weight="{700 if f else 400}" letter-spacing=".6">{e(r["t"])}</text>')
    o.append("</svg>"); return "".join(o)
def sec_map():
    q = {"BOTH": [], "PROMISE WITHOUT FOOTING": [], "FOOTING WITHOUT PROMISE": [], "NEITHER": []}
    for r in RANKED: q["BOTH" if r["promise"] >= 0.5 and r["footing"] >= 0.5 else "PROMISE WITHOUT FOOTING" if r["promise"] >= 0.5 else "FOOTING WITHOUT PROMISE" if r["footing"] >= 0.5 else "NEITHER"].append(r)
    corners = "".join(f'<div class="corner"><div class="seglab">{k} · {len(v)}</div><div class="chips">' + "".join(f'<span class="chip{" mine" if r.get("lists") else ""}">{e(r["t"])} <span class="dim">{round(r["score"] * 100)}</span></span>' for r in v) + "</div></div>" for k, v in q.items())
    return (f'<section id="map"><h2>PROMISE AGAINST FOOTING</h2><div class="panel"><div class="ph">PROMISE = GROWTH, PRICE, MARGIN ({sum(W[k] for k in ("growth", "price", "margin"))} OF THE 100) · FOOTING = CASH & CAPEX, DILUTION, DEBT, ESTIMATES ({sum(W[k] for k in ("money", "dilution", "debt", "quality"))}) · RING IN CYAN = ON YOUR LISTS</div>'
            f'<div class="mapgrid"><div><div class="wide">{scatter(1120, 520, True)}</div><div class="narrow">{scatter(326, 380, False)}</div></div><div class="corners">{corners}</div></div></div></section>')
# ---------------------------------------------------------------------------------------------------- 3b · gross margin, quarter by quarter
def spark(qs, w=150, h=26):
    """Eight quarters of gross margin as one line: green when it ends above where it began, red when below (the Hub's rule
    for a line: up green, down red). The line carries direction; the figures beside it carry the level."""
    v = [(i, q["gm"]) for i, q in enumerate(qs) if q.get("gm") is not None]
    if len(v) < 3: return f'<svg class="bar" width="{w}" height="{h}" role="img" aria-label="too few quarters"><rect y="{h / 2 - 1}" width="{w}" height="2" rx="1" fill="{TRACK}"/></svg>'
    lo, hi = min(x for _, x in v), max(x for _, x in v); span = (hi - lo) or 1.0; n = max(len(qs) - 1, 1)
    X = lambda i: 3 + i / n * (w - 6); Y = lambda x: 3 + (1 - (x - lo) / span) * (h - 6)
    up = v[-1][1] >= v[0][1]; col = UP if up else DN
    pts_ = " ".join(f"{X(i):.1f},{Y(x):.1f}" for i, x in v)
    tip = " · ".join(f'{month(qs[i]["end"])} {x:.0f}%' for i, x in v)
    return (f'<svg class="bar" width="{w}" height="{h}" role="img" aria-label="gross margin, {len(v)} quarters, {"up" if up else "down"}"><title>{e(tip)}</title><polyline points="{pts_}" fill="none" stroke="{col}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>'
            f'<circle cx="{X(v[-1][0]):.1f}" cy="{Y(v[-1][1]):.1f}" r="3" fill="{col}" stroke="#111114" stroke-width="2"/></svg>')
def sec_margin():
    rs = sorted([r for r in RANKED + COMPARE + UNRANKED if r["margin"]["now"] is not None], key=lambda r: -(r["margin"]["change"] if r["margin"]["change"] is not None else -1e9)); rows = ""
    for r in rs:
        m = r["margin"]; q = [x for x in m["quarters"] if x.get("gm") is not None]
        first = f'{q[0]["gm"]:.0f}% <span class="dim">{month(q[0]["end"])}</span>' if q else "—"; last = f'{q[-1]["gm"]:.0f}% <span class="dim">{month(q[-1]["end"])}</span>' if q else "—"
        ch = m["change"]; arrow = "" if ch is None else (f' <span class="up">↑</span>' if ch > 0.5 else f' <span class="dn">↓</span>' if ch < -0.5 else "")
        rows += (f'<tr><td data-l="">{tk(r)}</td><td data-l="8 QUARTERS">{spark(m["quarters"])}</td><td class="n" data-l="FIRST OF THEM">{first}</td><td class="n" data-l="LATEST">{last}</td><td class="n" data-l="LAST 4 QUARTERS">{pct(m["now"], False)}</td><td class="n" data-l="THE 4 BEFORE">{pct(m["year_ago"], False)}</td>'
                 f'<td class="n" data-l="CHANGE, POINTS">{num(ch, 0) if ch is None else ("+" if ch > 0 else "−" if ch < 0 else "") + format(abs(ch), ".0f")}{arrow}</td><td class="n" data-l="SALES, LAST 4 QUARTERS">{usd(r["sales"].get("booked"))}</td></tr>')
    none = [r for r in RANKED + UNRANKED if r["margin"]["now"] is None]
    foot = f'<div class="small pf">NOT READ · SALES UNDER $25M OVER FOUR QUARTERS: {" · ".join(r["t"] for r in none)}</div>' if none else ""
    return (f'<section id="margin"><h2>GROSS MARGIN, QUARTER BY QUARTER</h2><div class="panel"><div class="ph">WHAT IS LEFT OF EACH DOLLAR OF SALES AFTER THE DIRECT COST OF DELIVERING IT · LINE GREEN = ENDS HIGHER THAN IT BEGAN, RED = LOWER · MOST IMPROVED FIRST</div>'
            f'<div class="tw tall"><table class="r"><thead><tr><th></th><th>8 QUARTERS</th><th class="n">FIRST OF THEM</th><th class="n">LATEST</th><th class="n">LAST 4 QUARTERS</th><th class="n">THE 4 BEFORE</th><th class="n">CHANGE, POINTS</th><th class="n">SALES, LAST 4 QUARTERS</th></tr></thead><tbody>{rows}</tbody></table></div>{foot}</div></section>')
# ---------------------------------------------------------------------------------------------------- 4 · the build-out
def sec_money():
    rows = ""
    big = sorted([r for r in RANKED + COMPARE + UNRANKED if (r["capex"]["plan"] or 0) > 0 or (r["gap"]["gap"] or 0) > 0], key=lambda r: -(r["gap"]["pct_of_value"] or 0))
    mx = max([min(200.0, r["gap"]["pct_of_value"] or 0) for r in big] + [1.0])
    for r in big[:26]:
        c = r["capex"]; g = r["gap"]; m = c.get("mix") or {}; ann = c.get("announced") or {}
        basis = (f'announced · {e(ann["period"])} · call of {day(ann["call"])}' if ann.get("use") else e(c["plan_basis"] or "—"))
        gp = g["pct_of_value"] or 0
        o_, d_, s_, f_ = c.get("operating_cf_year"), c.get("debt_issued"), c.get("shares_issued"), c.get("other_financing")
        left = None if c.get("year") is None else (o_ or 0) + (d_ or 0) + (s_ or 0) + (f_ or 0) - c["year"]
        mix = "—" if c.get("year") is None else f'built {usd(c["year"])} · operations {usd(o_)} · new debt {usd(d_)} · new shares {usd(s_)} · other financing {usd(f_)} · ' + (f'cash up {usd(left)}' if left >= 0 else f'from cash {usd(-left)}')
        rows += (f'<tr><td data-l="">{tk(r)}</td><td class="n" data-l="PLANNED, NEXT 12M">{usd(c["plan"])}</td><td data-l="WHERE THE FIGURE IS FROM"><span class="small">{basis}</span></td><td class="n" data-l="DEBT DUE IN 12M">{usd(g["debt_due"])}</td><td class="n" data-l="CASH + SHORT-TERM">{usd(r["cash"]["cash_sti"])}</td><td class="n" data-l="OPERATIONS, LAST 12M">{usd(c["operating_cf_year"])}</td>'
                 f'<td class="n" data-l="STILL TO FIND">{"covered" if (g["gap"] or 0) <= 0 else usd(g["gap"])}</td><td data-l="÷ MARKET VALUE">{bar(min(gp, 200.0) / mx if gp > 0 else 0.0, 90, 8, pct(gp, False) + " of market value")}<span class="c">{"—" if gp <= 0 else pct(gp, False)}</span></td>'
                 f'<td data-l="LAST 4 QUARTERS: BUILT, AND PAID BY" class="w"><span class="small">{e(mix)}</span></td><td class="n" data-l="LEASES, CHANGE IN A YEAR">{usd(c.get("leases_added"))}</td></tr>')
    quotes = ""
    for r in RANKED + UNRANKED:
        ann = r["capex"].get("announced") or {}
        if ann.get("quote"): quotes += f'<div class="listrow"><div>{tk(r)} <span class="small">{day(ann["call"])}{" · USED" if ann.get("use") else " · NOT USED"}</span></div><div class="q">“{e(ann["quote"])}”' + (f'<div class="q2">“{e(ann["financing_quote"])}”</div>' if ann.get("financing_quote") else "") + (f'<div class="small">{e(ann["note"])}</div>' if ann.get("note") else "") + "</div></div>"
    return (f'<section id="money"><h2>THE BUILD-OUT AND WHO PAYS FOR IT</h2><div class="panel"><div class="ph">PLANNED BUILD-OUT + DEBT DUE, AGAINST CASH AND WHAT OPERATIONS BRING · WORST GAP FIRST · BAR FULL AT {round(mx)}% OF MARKET VALUE</div><div class="tw tall"><table class="r"><thead><tr><th></th><th class="n">PLANNED, NEXT 12M</th><th>WHERE THE FIGURE IS FROM</th><th class="n">DEBT DUE IN 12M</th><th class="n">CASH + SHORT-TERM</th><th class="n">OPERATIONS, LAST 12M</th><th class="n">STILL TO FIND</th><th>÷ MARKET VALUE</th><th>LAST 4 QUARTERS: BUILT, AND PAID BY</th><th class="n">LEASES, CHANGE IN A YEAR</th></tr></thead><tbody>{rows}</tbody></table></div></div>'
            f'<div class="panel"><div class="ph">WHAT THE COMPANIES SAID · THEIR OWN WORDS FROM THE NEWEST CALL ON FILE</div>{quotes}</div></section>')
# ---------------------------------------------------------------------------------------------------- 5 · dilution
def sec_dilution():
    rs = sorted([r for r in RANKED + COMPARE + UNRANKED], key=lambda r: -((r["dilution"]["change_1y"] or -1e9)))
    mx = max([min(150.0, r["dilution"]["change_1y"] or 0) for r in rs] + [1.0]); mo = max([min(80.0, r["dilution"]["overhang_pct"] or 0) for r in rs] + [1.0]); rows = ""
    for r in rs:
        d = r["dilution"]; c1 = d["change_1y"]
        bits = ([usd(d["convertible"]) + f' <span class="dim">on the books at {month(d["convertible_as_of"])}</span>'] if d.get("convertible") else []) + ([f'{usd(d["convertible_raised_3y"])} <span class="dim">raised in 3 years</span>'] if d.get("convertible_raised_3y") else [])
        conv = " · ".join(bits) or "—"
        rows += (f'<tr><td data-l="">{tk(r)}</td><td data-l="SHARES, 1 YEAR">{bar(max(0.0, min(c1 or 0, 150.0)) / mx if c1 is not None else None, 90, 8)}<span class="c">{pct(c1) if c1 is not None else "—"}</span>{"<span class=small> " + e(d["why_1y"]) + "</span>" if c1 is None and d.get("why_1y") else ""}</td>'
                 f'<td class="n" data-l="2 YEARS">{pct(d["change_2y"])}</td><td data-l="STILL TO COME">{bar(min(d["overhang_pct"], 80.0) / mo if d["overhang_pct"] is not None else None, 70, 8)}<span class="c">{pct(d["overhang_pct"], False)}</span></td><td class="n" data-l="CONVERTIBLE NOTES">{conv}</td><td class="n" data-l="PAY IN STOCK, 12M">{usd(d.get("stock_pay_year"))}</td>'
                 f'<td class="n" data-l="NEW SHARES SOLD, 12M">{usd(r["capex"].get("shares_issued"))}</td></tr>')
    return (f'<section id="dilution"><h2>DILUTION · MORE SHARES FOR THE SAME COMPANY</h2><div class="panel"><div class="ph">SHARE COUNT AGAINST A YEAR AGO (BAR FULL AT {round(mx)}%) · SHARES STILL TO COME FROM CONVERTIBLES, OPTIONS AND AWARDS, AS A SHARE OF TODAY\'S COUNT</div><div class="tw scrolly"><table class="r"><thead><tr><th></th><th>SHARES, 1 YEAR</th><th class="n">2 YEARS</th><th>STILL TO COME</th><th class="n">CONVERTIBLE NOTES</th><th class="n">PAY IN STOCK, 12M</th><th class="n">NEW SHARES SOLD, 12M</th></tr></thead><tbody>{rows}</tbody></table></div></div></section>')
# ---------------------------------------------------------------------------------------------------- 6 · the analysts
def whisker(lo, av, hi, w=200):
    """Low – high around the average (the average sits in the middle of the track; the track runs 0 to twice the average)."""
    if not av or lo is None or hi is None: return f'<svg class="bar" width="{w}" height="10"><rect y="4" width="{w}" height="2" rx="1" fill="{TRACK}"/></svg>'
    X = lambda v: max(0.0, min(1.0, v / (2 * av))) * w
    return (f'<svg class="bar" width="{w}" height="10" role="img" aria-label="low {usd(lo)}, average {usd(av)}, high {usd(hi)}"><title>low {usd(lo)} · average {usd(av)} · high {usd(hi)}</title><rect y="4" width="{w}" height="2" rx="1" fill="{TRACK}"/>'
            f'<rect x="{X(lo):.1f}" y="2" width="{max(2, X(hi) - X(lo)):.1f}" height="6" rx="2" fill="{DIM}"/><rect x="{X(av) - 1:.1f}" y="0" width="2" height="10" fill="{INK}"/></svg>')
def sec_quality():
    rs = sorted(RANKED + COMPARE + UNRANKED, key=lambda r: -(r["quality"]["spread_sales"] or -1)); rows = ""
    for r in rs:
        s = r["sales"]; q = r["quality"]
        rows += (f'<tr><td data-l="">{tk(r)}{"<span class=tag>THIN</span>" if q["thin"] else ""}</td><td class="n" data-l="ANALYSTS">{q["analysts"] if q["analysts"] is not None else "—"}</td><td data-l="NEXT YEAR\'S SALES, LOW – HIGH">{whisker(s.get("next_low"), s.get("next"), s.get("next_high"), 180)}<span class="c">{usd(s.get("next_low"))} – {usd(s.get("next_high"))}</span></td>'
                 f'<td class="n" data-l="RANGE ÷ AVERAGE">{pct(q["spread_sales"], False)}</td><td class="n" data-l="THE YEAR AFTER">{pct(q.get("spread_sales_after"), False)}</td><td class="n" data-l="PROFIT-A-SHARE RANGE ÷ PRICE">{pct(q["spread_eps_vs_price"], False)}</td><td class="n" data-l="÷ ITS AVERAGE">{pct(q["spread_eps_vs_average"], False)}</td>'
                 f'<td class="n" data-l="UNDER CONTRACT">{usd((r.get("under_contract") or {}).get("amount"))}{" <span class=dim>" + times((r["under_contract"] or {}).get("times_next_year"), 1) + " next year</span>" if (r.get("under_contract") or {}).get("times_next_year") else ""}</td></tr>')
    return (f'<section id="quality"><h2>HOW FAR APART THE ANALYSTS STAND</h2><div class="panel"><div class="ph">NEXT YEAR\'S SALES: LOWEST TO HIGHEST FORECAST, THE AVERAGE MARKED · MOST SCATTERED FIRST · LAST COLUMN: SALES ALREADY SIGNED, AS THE COMPANY FILED IT</div><div class="tw scrolly"><table class="r"><thead><tr><th></th><th class="n">ANALYSTS</th><th>NEXT YEAR\'S SALES, LOW – HIGH</th><th class="n">RANGE ÷ AVERAGE</th><th class="n">THE YEAR AFTER</th><th class="n">PROFIT-A-SHARE RANGE ÷ PRICE</th><th class="n">÷ ITS AVERAGE</th><th class="n">UNDER CONTRACT</th></tr></thead><tbody>{rows}</tbody></table></div></div></section>')
# ---------------------------------------------------------------------------------------------------- 7 · the test on history
def rho_cell(v, n=None, lab=""):
    if v is None: return f'<td class="n" data-l="{lab}">—</td>'
    a = min(1.0, abs(v) / 0.5); col = UP if v > 0 else DN
    return f'<td class="n rho" data-l="{lab}"><svg class="bar" width="10" height="10" role="img" aria-label="{"with" if v > 0 else "against"} the later move"><rect width="10" height="10" rx="2" fill="{col}" fill-opacity="{0.25 + 0.75 * a:.2f}"/></svg><span class="c">{v:+.2f}</span>{f"<span class=faint> n{n}</span>" if n else ""}</td>'.replace("-0.", "−0.").replace("+-", "−")
def sec_history():
    if not H: return ""
    yrs = [d[:4] for d in H["dates"]]
    coh = "".join(f'<tr><td data-l="OCTOBER">{c["T"][:4]}</td><td class="n" data-l="COMPANIES">{c["n"]}</td><td class="n" data-l="NEXT TO NO SALES">{c["venture"]}</td><td class="n" data-l="MIDDLE MOVE, 1 YEAR">{pct(c["median_r1"])}</td><td class="n" data-l="2 YEARS">{pct(c["median_r2"])}</td><td class="n" data-l="TO TODAY">{pct(c["median_r_now"])}</td></tr>' for c in H["cohorts"])
    def table(rows, counts=True):
        return "".join(f'<tr><td data-l="READING">{e(r["words"])}</td>' + "".join(rho_cell(x["rho"], x["n"] if counts else None, "OCT " + x["T"][:4]) for x in r["per"]) + rho_cell(r["avg"], None, "ALL FOUR") + f'<td class="n" data-l="RIGHT WAY IN">{r["positive_in"]} of {r["of"]}</td></tr>' for r in rows)
    hd = "<thead><tr><th>READING, AS IT STOOD THAT OCTOBER</th>" + "".join(f'<th class="n">OCT {y}</th>' for y in yrs) + '<th class="n">ALL FOUR</th><th class="n">RIGHT WAY IN</th></tr></thead>'
    def sch(rows):
        o = '<tr><td data-l="SCORED BY"><span class="dim">every company tested · the middle one</span></td>' + "".join(f'<td class="n" data-l="OCT {c["T"][:4]}"><span class="c">{pct(c["median_r2"])}</span><br><span class="c dim">{c["n"]} companies</span></td>' for c in H["cohorts"]) + '<td class="n" data-l="TOP BEAT BOTTOM IN">—</td></tr>'
        for r in rows:
            o += f'<tr><td data-l="SCORED BY">{e(r["name"])}</td>' + "".join(f'<td class="n" data-l="OCT {x["T"][:4]}"><span class="c">{pct(x["top"])} <span class="dim">top third</span></span><br><span class="c">{pct(x["bottom"])} <span class="dim">bottom</span></span></td>' for x in r["per"]) + f'<td class="n" data-l="TOP BEAT BOTTOM IN">{r["top_beat_bottom_in"]} of {r["of"]}</td></tr>'
        return o
    ex = ""
    for T in H["dates"]:
        L = H["names"][T]; top = L[:5]; bot = L[-5:]
        f = lambda x: f'<span class="chipx">{e(x["t"])} <span class="{"up" if (x["r2"] or 0) >= 0 else "dn"}">{pct(x["r2"])}</span></span>'
        ex += f'<div class="listrow"><div>OCT {T[:4]} <span class="small">{len(L)} companies</span></div><div><span class="seglab">THE SCORE\'S TOP FIVE</span>{"".join(f(x) for x in top)}<br><span class="seglab">ITS BOTTOM FIVE</span>{"".join(f(x) for x in bot)}</div></div>'
    return (f'<section id="history"><h2>THE TEST ON HISTORY · FOUR OCTOBERS, COMPANIES THAT WERE PRE-PROFIT AND GROWING THEN</h2>'
            f'<div class="panel"><div class="ph">THE SCORE ITSELF · PRICE MOVE TWO YEARS ON · THE MIDDLE OF ITS TOP THIRD AGAINST THE MIDDLE OF ITS BOTTOM THIRD</div><table class="r"><thead><tr><th>SCORED BY</th>' + "".join(f'<th class="n">OCT {y}</th>' for y in yrs) + f'<th class="n">TOP BEAT BOTTOM IN</th></tr></thead><tbody>{sch(H["schemes"])}</tbody></table></div>'
            f'<div class="panel"><div class="ph">EACH READING AGAINST THE PRICE MOVE TWO YEARS ON · +1 = IT RANKED THE WINNERS FIRST, −1 = LAST, 0 = NO HELP · GREEN WITH THE MOVE, RED AGAINST</div><table class="r">{hd}<tbody>{table(H["readings"])}</tbody></table></div>'
            f'<div class="grid2"><div class="panel"><div class="ph">THE SAME, TO TODAY</div><table class="r">{hd}<tbody>{table(H["readings_to_date"], False)}</tbody></table></div>'
            f'<div class="panel"><div class="ph">WITH FORESIGHT · GROWTH AND PRICE READ ON THE SALES THE COMPANY WENT ON TO REPORT</div><table class="r">{hd}<tbody>{table(H["foresight"]["readings"], False)}</tbody></table></div></div>'
            f'<div class="panel"><div class="ph">BY NAME · THE SCORE\'S TOP AND BOTTOM FIVE EACH OCTOBER, AND THE PRICE MOVE TWO YEARS ON</div>{ex}</div></section>')
# ---------------------------------------------------------------------------------------------------- 8 · debt in the knockout
def lev_txt(x):
    if x.get("load") is None: return e(x.get("words") or "not read")
    return e(x.get("words") or "")
def sec_knockout():
    c = K["counts"]; BRM = {b["branch"]: b for b in K["branches"]}
    kp = [(len(K["champions_changed"]), f'OF {c["champion_slots"]} CHAMPIONS CHANGE'), (len(K["finalists_reordered"]), "MORE BRANCHES: FINALISTS CHANGE"), (len(K["pass_flips"]), "TIES AT THE PASS LINE DECIDED BY DEBT"), (c["full_load"], f'OF {c["judged"]} JUDGED CARRY THE FULL LOAD'), (c["net_cash"], "HOLD NET CASH"), (c["not_read"], "NOT READ")]
    def branch_block(b):
        rows = ""
        for r in b["rows"]:
            mv = "" if r["place_before"] == r["place_after"] else (f'<span class="up">↑</span>' if (r["place_after"] or 9) < (r["place_before"] or 9) else '<span class="dn">↓</span>')
            rows += (f'<tr><td data-l=""><span class="tk">{e(r["t"])}</span></td><td class="n" data-l="PLACE BEFORE">{r["place_before"] or "—"}</td><td class="n" data-l="AFTER">{r["place_after"] or "out"} {mv}</td><td class="n" data-l="SCORE">{r["score"] * 100:.1f}</td><td data-l="DEBT LOAD">{bar(r["load"], 60, 8)}<span class="c">{pts(r["load"])}</span></td>'
                     f'<td class="n" data-l="TAKEN OFF">{"—" if not r["cut"] else "−" + format(r["cut"] * 100, ".1f")}</td><td class="n" data-l="IN THE DEBATE">{r["debated"] * 100:.1f}</td><td data-l="THE READING" class="w">{lev_txt(r)}</td></tr>')
        ex = ""
        if b["pass_in"] or b["pass_out"]: ex = f'<div class="small pf">TIE AT THE PASS LINE · IN: {", ".join(b["pass_in"]) or "—"} · OUT: {", ".join(b["pass_out"]) or "—"}</div>'
        return (f'<div class="panel"><div class="ph">{e(b["label"])} · {" · ".join(b["finalists_before"])} <span class="faint">→</span> {" · ".join(b["finalists_after"])}</div><table class="r"><thead><tr><th></th><th class="n">PLACE BEFORE</th><th class="n">AFTER</th><th class="n">SCORE</th><th>DEBT LOAD</th><th class="n">TAKEN OFF</th><th class="n">IN THE DEBATE</th><th>THE READING</th></tr></thead><tbody>{rows}</tbody></table>{ex}</div>')
    moved = [BRM[x] for x in K["moves"]]
    champ = "".join(branch_block(b) for b in moved if b["champion_moved"]); fin = "".join(branch_block(b) for b in moved if b["finalists_moved"] and not b["champion_moved"]); ties = "".join(branch_block(b) for b in moved if not b["finalists_moved"] and (b["pass_in"] or b["pass_out"]))
    foc = ""
    for f in K["focus"]:
        wh = "".join(f'<div class="small">{e(w["branch"])}: {("place " + str(w["place_before"]) + " of its three finalists" if w["place_before"] else ("rank " + str(w["rank_before"]) + " of " + str(w["of"]) + (", passed" if w["passes_before"] else ", did not pass round 2")) if w["judged"] else "not judged")}'
                     f'{" → " + ("place " + str(w["place_after"]) if w["place_after"] else "rank " + str(w["rank_after"])) if (w["place_before"] != w["place_after"] or w["rank_before"] != w["rank_after"]) else " · unchanged"}</div>' for w in f["where"])
        foc += f'<tr><td data-l=""><span class="tk">{e(f["t"])}</span></td><td data-l="DEBT LOAD">{bar(f["load"], 60, 8)}<span class="c">{pts(f["load"])}</span></td><td class="n" data-l="NET DEBT">{usd(f["net_debt"])}</td><td class="n" data-l="÷ EBITDA">{times(f["nd_ebitda"])}</td><td class="n" data-l="EBITDA ÷ INTEREST">{times(f["cover"])}</td><td class="n" data-l="NET DEBT ÷ NEXT YEAR\'S SALES">{times(f["nd_sales"], 2)}</td><td data-l="READ ON">{e({"nd_sales": "net debt ÷ next year’s sales (pre-profit)", "nd_ebitda": "net debt ÷ EBITDA", "cover": "EBITDA ÷ interest", "net cash": "net cash"}.get(f["basis"], f["basis"] or "—"))}</td><td data-l="IN THE KNOCKOUT" class="w">{wh}</td></tr>'
    sens = "".join(f'<tr><td data-l="A FULL LOAD TAKES OFF">{round(s["max_cut"] * 100)} points{" · the setting used" if abs(s["max_cut"] - K["max_cut"]) < 1e-9 else ""}</td><td class="n" data-l="CHAMPIONS CHANGED">{len(s["champions_changed"])}</td><td data-l="WHICH">{e(" · ".join(x["branch"].title() + ": " + x["before"] + " → " + x["after"] for x in s["champions_changed"]) or "none")}</td><td class="n" data-l="BRANCHES WITH FINALISTS CHANGED">{s["finalist_orders_changed"]}</td></tr>' for s in K["sensitivity"])
    wide = "".join(f'<tr><td data-l="BRANCH">{e(x["branch"])}</td><td data-l="AS THE KNOCKOUT LEFT IT">{" · ".join(x["before"])}</td><td data-l="DEBT AMONG THE THREE">{" · ".join(x["narrow"])}</td><td data-l="DEBT AMONG ALL THAT PASSED">{" · ".join(x["wide"])}</td></tr>' for x in K["wide"]["differs_in"])
    full = " · ".join(c["finalists_full_load"])
    return (f'<section id="knockout"><h2>DEBT IN THE KNOCKOUT · THE SAME ROUNDS, RUN AGAIN WITH A LEVERAGE READING FOR EVERY COMPANY</h2><div class="kpis">' + "".join(f"<div class='kpi'><b>{a}</b><span>{b}</span></div>" for a, b in kp) + "</div>"
            f'<div class="panel"><div class="ph">THE FOUR YOU NAMED · THEIR LEVERAGE READING AND WHERE EACH STANDS</div><table class="r"><thead><tr><th></th><th>DEBT LOAD</th><th class="n">NET DEBT</th><th class="n">÷ EBITDA</th><th class="n">EBITDA ÷ INTEREST</th><th class="n">NET DEBT ÷ NEXT YEAR\'S SALES</th><th>READ ON</th><th>IN THE KNOCKOUT</th></tr></thead><tbody>{foc}</tbody></table></div>'
            f'<h3>CHAMPIONS THAT CHANGE</h3>{champ or "<div class=panel><span class=dim>none</span></div>"}<h3>FINALISTS THAT CHANGE, CHAMPION KEPT</h3>{fin or "<div class=panel><span class=dim>none</span></div>"}<h3>TIES AT THE PASS LINE</h3>{ties or "<div class=panel><span class=dim>none</span></div>"}'
            f'<div class="grid2"><div class="panel"><div class="ph">HOW MUCH THE SETTING MATTERS</div><table class="r"><thead><tr><th>A FULL LOAD TAKES OFF</th><th class="n">CHAMPIONS CHANGED</th><th>WHICH</th><th class="n">BRANCHES WITH FINALISTS CHANGED</th></tr></thead><tbody>{sens}</tbody></table></div>'
            f'<div class="panel"><div class="ph">IF DEBT WERE WEIGHED AMONG EVERY NAME THAT PASSED, NOT ONLY THE THREE FINALISTS</div><table class="r"><thead><tr><th>BRANCH</th><th>AS THE KNOCKOUT LEFT IT</th><th>DEBT AMONG THE THREE</th><th>DEBT AMONG ALL THAT PASSED</th></tr></thead><tbody>{wide}</tbody></table></div></div>'
            f'<div class="panel"><div class="ph">FINALISTS CARRYING THE FULL LOAD ({len(c["finalists_full_load"])} OF {c["finalists"]})</div><div class="chips">{"".join(f"<span class=chip>{e(t)}</span>" for t in c["finalists_full_load"])}</div></div></section>')
def sec_loads():
    L = sorted(K["leverage"].values(), key=lambda x: (-(x["load"] if x["load"] is not None else -1), x["t"])); rows = ""
    for x in L:
        rows += (f'<tr data-find="{e((x["t"] + " " + (x.get("name") or "") + " " + (x.get("branch") or "")).lower())}"><td data-l=""><span class="tk">{e(x["t"])}</span> <span class="dim">{e((x.get("name") or "")[:28])}</span></td><td data-l="BRANCH"><span class="small">{e(x.get("branch") or "—")}</span></td><td data-l="DEBT LOAD">{bar(x["load"], 50, 8)}<span class="c">{pts(x["load"])}</span></td>'
                 f'<td class="n" data-l="NET DEBT">{usd(x["net_debt"])}</td><td class="n" data-l="÷ EBITDA">{times(x["nd_ebitda"])}</td><td class="n" data-l="EBITDA ÷ INTEREST">{times(x["cover"])}</td><td class="n" data-l="÷ NEXT YEAR\'S SALES">{times(x["nd_sales"], 2) if x.get("pre_profit") or x["nd_ebitda"] is None else "—"}</td><td data-l="NOTE"><span class="small">{e(x["words"] if x["load"] is None or x["basis"] == "net cash" else "")}</span></td></tr>')
    return (f'<section id="loads"><h2>EVERY COMPANY\'S LEVERAGE READING</h2><div class="panel"><input class="find" id="find2" placeholder="find a name or a branch" aria-label="find a name or a branch"><div class="tw scrolly"><table class="r" id="loadtable"><thead><tr><th>NAME</th><th>BRANCH</th><th>DEBT LOAD</th><th class="n">NET DEBT</th><th class="n">÷ EBITDA</th><th class="n">EBITDA ÷ INTEREST</th><th class="n">÷ NEXT YEAR\'S SALES</th><th>NOTE</th></tr></thead><tbody>{rows}</tbody></table></div></div></section>')
def sec_off():
    title = {"slow": f'PRE-PROFIT, BUT SALES GROWING UNDER {RU["growth_gate"]:.0f}%', "expected": "A LOSS AS FILED, A PROFIT EXPECTED THIS YEAR", "lost": "HAD STEADY PROFITS AND LOST THEM"}; body = ""
    for kind in ("slow", "expected", "lost"):
        xs = sorted([x for x in D["off_shelf"] if x["kind"] == kind], key=lambda x: -(x.get("sales_next") or 0))
        body += f'<tr class="sec"><td colspan="12">{title[kind]} · {len(xs)}</td></tr>'
        for x in xs:
            why = (f'the analysts expect {num(x.get("eps_this_year"), 2)} a share this fiscal year' if kind == "expected" else e(x["why"].split(": ", 1)[-1]) if kind == "lost" else f'a loss of {usd(-min(x["oi4"] or 0, x["ni4"] or 0))} over four quarters')
            run = "in" if x.get("burn_basis") == "not burning" else (num(x.get("runway_q")) + "q" if x.get("runway_q") is not None else "—")
            nd = "net cash" if (x.get("net_debt") is not None and x["net_debt"] <= 0) else (times(x.get("nd_ebitda")) + " EBITDA" if x.get("nd_ebitda") is not None else times(x.get("nd_sales"), 2) + " sales" if x.get("nd_sales") is not None else "—")
            body += (f'<tr data-find="{e((x["t"] + " " + (x.get("name") or "")).lower())}"><td data-l=""><span class="el"><span class="tk{" mine" if x.get("lists") else ""}">{e(x["t"])}</span> <span class="dim">{e((x.get("name") or "")[:24])}</span></span></td><td data-l="WHY NOT ON THE SHELF"><span class="small">{why}</span></td>'
                     f'<td class="n" data-l="SALES NEXT 12M">{usd(x.get("sales_next"))}</td><td class="n" data-l="GROWTH">{pct(x.get("growth"))}</td><td class="n" data-l="EV ÷ SALES">{times(x.get("ev_sales"))}</td><td class="n" data-l="GROSS MARGIN">{pct(x.get("gm"), False)}</td>'
                     f'<td class="n" data-l="CASH + SHORT-TERM">{usd(x.get("cash_sti"))}</td><td class="n" data-l="CASH LASTS">{run}</td><td class="n" data-l="GAP ÷ VALUE">{"none" if (x.get("gap_pct") is not None and x["gap_pct"] <= 0) else pct(x.get("gap_pct"), False)}</td>'
                     f'<td class="n" data-l="SHARES 1Y">{pct(x.get("shares_1y"))}</td><td class="n" data-l="NET DEBT">{nd}</td><td class="n" data-l="ANALYSTS">{x["analysts"] if x.get("analysts") is not None else "—"}</td></tr>')
    return (f'<section id="off"><h2>NOT ON THE SHELF, AND WHY · MEASURED THE SAME WAY, NOT RANKED</h2><div class="panel"><div class="tw tall"><table class="r"><thead><tr><th>NAME</th><th>WHY NOT ON THE SHELF</th><th class="n">SALES NEXT 12M</th><th class="n">GROWTH</th><th class="n">EV ÷ SALES</th><th class="n">GROSS MARGIN</th><th class="n">CASH + SHORT-TERM</th><th class="n">CASH LASTS</th><th class="n">GAP ÷ VALUE</th><th class="n">SHARES 1Y</th><th class="n">NET DEBT</th><th class="n">ANALYSTS</th></tr></thead><tbody>{body}</tbody></table></div></div></section>')
SPECS = open(os.path.join(HERE, "page-specs.frag")).read()                                 # a fragment, not a page: kept out of the BACK / CLOSE injector's way by its name
SCNAV = open(os.path.join(WT, "scripts", "scnav-snippet.html"), encoding="utf-8").read().strip()  # the pair, placed exactly as scripts/inject-scnav.py places it (a slot in the header, the snippet before </body>)
def fill(s):
    c = D["counts"]; kc = K["counts"]; ck = D["checks"]
    iren, nbis, crwv, be = BY.get("IREN"), BY.get("NBIS"), BY.get("CRWV"), BY.get("BE")
    h2 = {r["key"]: r for r in H["readings"]} if H else {}; sm = {r["name"]: r for r in H["schemes"]} if H else {}; mw = sm.get("the model's weights") or {}
    rep = {"ON_SHELF": c["on_shelf"], "RANKED": c["ranked"], "N_READ": c["companies_read"], "N_V": c["tier"].get("V", 0), "N_A": c["tier"].get("A", 0), "N_THIN": c["thin_not_ranked"], "N_SLOW": c["off_shelf_slow"], "N_EXPECTED": c["off_shelf_profit_expected"], "N_LOST": c["off_shelf_lost_profits"],
           "N_COVER": c["cover_counts"], "N_QAVG": c["quarter_average_counts"], "N_VENDOR": c["vendor_value"], "N_GAP10": c["value_gap_over_10pct"], "N_OVERHANG": c["with_overhang"], "N_CONV": c["with_convertible"], "N_ANN": c["with_announced_capex"],
           "PRICE_IS": e(D["price_is"]), "FX_DATE": day(D["fx_date"]), "GATE": f'{RU["growth_gate"]:.0f}', "THIN": RU["thin_analysts"], "MAXCUT": round(K["max_cut"] * 100),
           "W_GROWTH": W["growth"], "W_PRICE": W["price"], "W_MARGIN": W["margin"], "W_MONEY": W["money"], "W_DILUTION": W["dilution"], "W_DEBT": W["debt"], "W_QUALITY": W["quality"],
           "JUDGED": kc["judged"], "READ": kc["with_a_reading"], "NOT_READ": kc["not_read"], "NET_CASH": kc["net_cash"], "SOME_LOAD": kc["some_load"], "FULL_LOAD": kc["full_load"], "CH_SLOTS": kc["champion_slots"], "N_CH": len(K["champions_changed"]),
           "CH_LIST": e("; ".join(f'{x["branch"].title()}: {x["before"]} → {x["after"]}' for x in K["champions_changed"])), "GROWTH_OK": ck["growth_vs_knockout"]["within_2pts"], "GROWTH_N": ck["growth_vs_knockout"]["n"],
           "IREN_EV": times(iren["ev_sales"]) if iren else "—", "NBIS_EV": times(nbis["ev_sales"]) if nbis else "—", "CRWV_EV": times(crwv["ev_sales"]) if crwv else "—", "BE_EV": times(be["ev_sales"]) if be else "—",
           "NBIS_SH": f'{nbis["shares"]["count"] / 1e6:,.0f}M' if nbis and nbis["shares"]["count"] else "—", "NBIS_MV": usd(nbis["market_value"]) if nbis else "—",
           "CRWV_ND_EBITDA": times(crwv["debt"]["nd_ebitda"]) if crwv else "—", "CRWV_EBITDA": usd(crwv["debt"]["ebitda"]) if crwv else "—", "CRWV_EBITDA_V": usd(crwv["debt"]["ebitda_vendor"]) if crwv else "—", "CRWV_ND": usd(crwv["debt"]["net_debt"]) if crwv else "—", "CRWV_LEASES": usd(crwv["debt"]["leases"]) if crwv else "—",
           "H_N": sum(x["n"] for x in H["cohorts"]) if H else "—", "H_PRICE_AVG": f'{h2["price"]["avg"]:+.2f}'.replace("-", "−") if H else "—", "H_PRICE_IN": f'{h2["price"]["positive_in"]} of {h2["price"]["of"]}' if H else "—", "H_GROWTH_AVG": f'{h2["growth"]["avg"]:+.2f}'.replace("-", "−") if H else "—",
           "H_MODEL_IN": (str(mw["top_beat_bottom_in"]) + " of " + str(mw["of"])) if H else "—", "H_SKIP": e(", ".join(f"{v} {k}" for k, v in (H or {}).get("skipped", {}).items()))}
    mil = lambda v: "—" if not v else f"{v / 1e6:,.0f}M"
    for t in ("RKLB", "APLD"): assert BY[t]["shares"]["source"] == "cover" and BY[t]["shares"]["vendor_implied"] > 1.3 * BY[t]["shares"]["count"], t   # the two examples the words give must be what the data says
    iy = [y for y in (iren["sales"]["years"] if iren else []) if y["kind"] == "estimate"]; gapof = lambda t: pct(BY[t]["value_gap_pct"]) if t in BY and BY[t].get("value_gap_pct") is not None else "—"
    import hashlib
    hn = {x["t"]: (i, x) for i, x in enumerate(H["names"]["2023-10-06"])} if H else {}
    rep.update({"IREN_EV_PLAIN": f'${iren["ev_sales"]:.2f}' if iren else "—", "IREN_PRICE": f'${iren["price"]:.2f}' if iren else "—",
                "IREN_Y1_N": iy[0].get("n") if iy else "—", "IREN_Y1_LOW": usd(iy[0].get("low")) if iy else "—", "IREN_Y1_HIGH": usd(iy[0].get("high")) if iy else "—", "IREN_Y1_SPREAD": pct(iy[0].get("spread_sales"), False) if iy else "—",
                "IREN_Y1_EPS_LOW": ("−$" if (iy[0].get("eps_low") or 0) < 0 else "$") + f'{abs(iy[0]["eps_low"]):.2f}' if iy else "—", "IREN_Y1_EPS_HIGH": ("−$" if (iy[0].get("eps_high") or 0) < 0 else "+$") + f'{abs(iy[0]["eps_high"]):.2f}' if iy else "—", "IREN_Y1_N_EPS": iy[0].get("n_eps") if iy else "—",
                "IREN_Y2_LOW": usd(iy[1].get("low")) if len(iy) > 1 else "—", "IREN_Y2_HIGH": usd(iy[1].get("high")) if len(iy) > 1 else "—", "IREN_Y2_SPREAD": pct(iy[1].get("spread_sales"), False) if len(iy) > 1 else "—",
                "RKLB_IMPLIED": mil(BY["RKLB"]["shares"]["vendor_implied"]), "RKLB_COVER": mil(BY["RKLB"]["shares"]["count"]), "APLD_IMPLIED": mil(BY["APLD"]["shares"]["vendor_implied"]), "APLD_COVER": mil(BY["APLD"]["shares"]["count"]), "N_BRANCHES": len(K["branches"]), "NOT_READ_BANKS": kc["not_read_banks_insurers"], "NOT_READ_OTHER": len(kc["not_read_other"]),
                "H_IREN_PLACE": f'{hn["IREN"][0] + 1} of {len(hn)}' if "IREN" in hn else "—", "H_IREN_R2": pct(hn["IREN"][1]["r2"]) if "IREN" in hn else "—",
                "NOEST_WORDS": "" if not c["no_estimates"] else f'; {c["no_estimates"]} more {"has" if c["no_estimates"] == 1 else "have"} no estimates at all',
                "NOT_READ_OTHER_WORDS": "" if not kc["not_read_other"] else f' {len(kc["not_read_other"])} more have no reading because a figure is missing.',
                "H_GROWTH_2021": (f'{h2["growth"]["per"][0]["rho"]:+.2f}'.replace("-", "−") if H else "—"), "N_FIN": len(K["finalists_reordered"]), "FIN_LIST": e(", ".join(x["branch"].title() for x in K["finalists_reordered"])),
                "N_TIES": len(K["pass_flips"]), "TIE_LIST": e("; ".join(f'{x["branch"].title()}: {", ".join(x["in"])} in, {", ".join(x["out"])} out' for x in K["pass_flips"])),
                "N_CLASS": sum(1 for r in SHELF if (r["shares"]["source"] or "").startswith("not verified")), "N_SHOWN": len(SHELF),
                "SCRIPT_SHA": hashlib.sha256(open(os.path.join(HERE, "pp1_fetch_fmp.mjs"), "rb").read()).hexdigest()})
    # the names the words rest on must be where the words say they are
    kinds = {x["t"]: x["kind"] for x in D["off_shelf"]}
    for t, k in (("BA", "slow"), ("SNAP", "slow"), ("MRNA", "slow"), ("CRWD", "expected"), ("SNOW", "expected"), ("INTC", "lost"), ("F", "lost")): assert kinds.get(t) == k, (t, kinds.get(t))
    for k, v in rep.items(): s = s.replace("{{" + k + "}}", str(v))
    import re as _re
    left = _re.findall(r"\{\{[A-Z0-9_]+\}\}", s); assert not left, left
    return s.replace("+-", "−")
JS = """<script>
function wire(i,t){var f=document.getElementById(i),rows=document.querySelectorAll('#'+t+' tbody tr[data-find]');if(!f)return;f.addEventListener('input',function(){var q=f.value.trim().toLowerCase();rows.forEach(function(r){r.style.display=(!q||r.getAttribute('data-find').indexOf(q)>=0)?'':'none';});});}
wire('find','shelftable');wire('find2','loadtable');
</script>"""
import re
def one_value(html_):
    """On a phone a table row becomes a card and each cell a label beside its value. A cell that holds a bar AND a figure
    must keep them together as ONE value, so every labelled cell's content is wrapped once."""
    return re.sub(r'(<td\b[^>]*\bdata-l="[^"]+"[^>]*>)(.*?)(</td>)', lambda m: m.group(1) + '<span class="v">' + m.group(2) + "</span>" + m.group(3), html_, flags=re.S)
page = (f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>Pre-profit · the shelf measured, and debt in the knockout · 6 Oct 2026</title>\n<style>{CSS}</style></head><body>\n'
        f'<header class="top"><span data-scnav-slot></span><div class="ttl">PRE-PROFIT</div><div class="sub">THE SHELF MEASURED AND RANKED · DEBT IN THE KNOCKOUT · PRICES: THE 6 OCT 2026 CLOSE · FIGURES AS FILED TO 7 OCT</div></header>\n'
        + one_value(sec_four() + sec_shelf() + sec_map() + sec_margin() + sec_money() + sec_dilution() + sec_quality() + sec_history() + sec_knockout() + sec_loads() + sec_off()) + fill(SPECS) + JS + "\n" + SCNAV + "\n</body></html>\n")
open(os.path.join(ROOT, "PRE-PROFIT.html"), "w").write(page)
print("wrote PRE-PROFIT.html", len(page), "bytes · ranked", N_RANKED, "· beside", len(COMPARE), "· listed", len(UNRANKED))
