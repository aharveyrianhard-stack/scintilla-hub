#!/usr/bin/env python3
"""LD1 · renders LEADERS-VS-LAGGARDS.html from study.json and opinion.json. Pictures first, then the opinion, then the tables.
Greys only (channels within 24, none above 210) except direction: up = green, down = red. Body text 11px+. Explanations live in PAGE SPECS."""
import html, json, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
S = json.load(open(os.path.join(D, "study.json")))
OP = json.load(open(os.path.join(D, "opinion.json"))) if os.path.exists(os.path.join(D, "opinion.json")) else {"paragraphs": ["(opinion not written yet)"], "evidence": [], "against": []}
N = S["names"]; G = S["groups"]; Q = S["quality"]; B = S["benchmarks"]
esc = lambda s: html.escape(str(s)) if s is not None else ""
UP, DOWN = "#199e70", "#d55181"

def pct(v, digits=0, frac=True, plus=True):
    """a signed percent, green up / red down; v is a fraction unless frac=False"""
    if v is None: return '<span class="na">–</span>'
    x = v * 100 if frac else v
    cls = "up" if x > 0 else "dn" if x < 0 else ""
    sign = "+" if (x > 0 and plus) else "−" if x < 0 else ""
    return f'<span class="{cls}">{sign}{abs(x):.{digits}f}%</span>'
def plain(v, digits=1, suf=""):
    return '<span class="na">–</span>' if v is None else f"{v:,.{digits}f}{suf}"
def usd(v):
    if v is None: return '<span class="na">–</span>'
    return f"${v/1000:,.2f}T" if abs(v) >= 1000 else f"${v:,.1f}B" if abs(v) >= 10 else f"${v:,.2f}B"
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
def guide(d):
    return {"raised": '<span class="up">▲ raised</span>', "lowered": '<span class="dn">▼ lowered</span>', "maintained": "● kept", "none": "gives none"}.get(d, '<span class="na">–</span>')
def conc(n):
    lv = n.get("concentration_level"); t = n.get("top_customer_pct")
    w = {"high": '<span class="dn">few</span>', "moderate": "some", "low": '<span class="up">many</span>'}.get(lv, '<span class="na">–</span>')
    return w + (f" · top {t:.0f}%" if isinstance(t, (int, float)) else "")
def margin(now, ago):
    if now is None: return '<span class="na">–</span>'
    if ago is None: return f"{now:.0f}%"
    cls = "up" if now > ago else "dn" if now < ago else ""
    return f'{now:.0f}% <span class="{cls}">({"▲" if now > ago else "▼" if now < ago else "●"} from {ago:.0f}%)</span>'
def vs(own, medn, n, digits=1, suf="×"):
    if own is None and medn is None: return '<span class="na">–</span>'
    o = '<span class="na">none</span>' if own is None else f"{own:,.{digits}f}{suf}"
    m = '<span class="na">too few</span>' if medn is None else f"{medn:,.{digits}f}{suf}"
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
sv.append(f'<text x="16" y="{(MT+H-MB)/2:.0f}" fill="#c4c6c8" text-anchor="middle" letter-spacing="1.2" transform="rotate(-90 16 {(MT+H-MB)/2:.0f})">THE RUN · 15 SEP → 5 OCT</text>')
for (tx, ty, anchor, words) in [(ML + 8, MT + 14, "start", "FELL, THEN BOUNCED"), (W - MR - 8, MT + 14, "end", "NEVER FELL, KEPT RISING"), (ML + 8, H - MB - 8, "start", "FELL AND DID NOT BOUNCE"), (W - MR - 8, H - MB - 8, "end", "HELD UP, THEN SLIPPED")]:
    sv.append(f'<text x="{tx}" y="{ty}" fill="#5e6062" text-anchor="{anchor}" letter-spacing="1.5">{words}</text>')
for p in pts:
    if p["g"] == "field": sv.append(f'<circle cx="{X(p["s"]):.1f}" cy="{Y(p["r"]):.1f}" r="2.6" fill="#5e6062"/>')
placed = []   # label boxes already drawn: (x0, y0, x1, y1)
def label(x, y, t, col):
    w, h = 7.0 * len(t) + 2, 11
    for dx, dy, anchor in ((0, -8, "middle"), (8, 4, "start"), (-8, 4, "end"), (0, 17, "middle"), (8, -6, "start"), (-8, -6, "end"), (8, 14, "start"), (-8, 14, "end"), (0, -19, "middle"), (0, 28, "middle"), (20, 4, "start"), (-20, 4, "end")):
        tx, ty = x + dx, y + dy
        x0 = tx - w / 2 if anchor == "middle" else tx if anchor == "start" else tx - w
        box = (x0, ty - h + 2, x0 + w, ty + 2)
        if all(box[2] < b[0] or box[0] > b[2] or box[3] < b[1] or box[1] > b[3] for b in placed): break
    placed.append(box); return f'<text x="{tx:.1f}" y="{ty:.1f}" fill="{col}" text-anchor="{anchor}" font-weight="600">{t}</text>'
studied_pts = [p for p in pts if p["g"] != "field"]
for p in studied_pts: placed.append((X(p["s"]) - 5, Y(p["r"]) - 5, X(p["s"]) + 5, Y(p["r"]) + 5))   # never write over a studied dot
for g, col in (("named_mid", "#c4c6c8"), ("laggard", DOWN), ("leader", UP)):
    for p in sorted([p for p in pts if p["g"] == g], key=lambda p: p["r"]):
        x, y = X(p["s"]), Y(p["r"])
        sv.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="4.2" fill="{col if g != "named_mid" else "#121314"}" stroke="{col}" stroke-width="1.4"/>' + label(x, y, p["t"], col))
bq, bs = B["QQQ"], B["SMH"]
for name, b in (("NASDAQ-100 FUND", bq), ("CHIP FUND", bs)):
    x, y = X(b["r_selloff"]), Y(b["r_run"])
    sv.append(f'<path d="M{x-6:.1f},{y:.1f} L{x:.1f},{y-6:.1f} L{x+6:.1f},{y:.1f} L{x:.1f},{y+6:.1f} Z" fill="none" stroke="#c4c6c8" stroke-width="1.4"/><text x="{x+10:.1f}" y="{y+4:.1f}" fill="#c4c6c8">{name}</text>')
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
                 f'</div><div class="bg"><b>{gap:+.0f}</b>{"" if strength == "clear" else "<br>leans"}</div></div>')
    o.append("</div>"); return "\n".join(o)
shown = [C[i] for i in S["conditions_sorted_ids"] if C[i]["strength"] in ("clear", "leans")]
SVG2 = bars([(c["words"], c["leaders_yes"], c["leaders_n"], c["laggards_yes"], c["laggards_n"], c["gap_points"], c["strength"]) for c in shown], f'LEADERS ({len(G["leader"])})', f'LAGGARDS ({len(G["laggard"])})', "What separates leaders from laggards, as counts")
BC = S["bounce_cut"]
bc_shown = [c for c in BC["conditions"] if c["strength"] == "clear"][:14]
SVG2B = bars([(c["words"], c["a_yes"], c["a_n"], c["b_yes"], c["b_n"], c["gap_points"], c["strength"]) for c in bc_shown], f'FELL, THEN BOUNCED ({len(BC["bounced"])})', f'FELL, DID NOT BOUNCE ({len(BC["stayed_down"])})', "Both sets fell hard in the summer: what separates the ones that bounced")

# ------------------------------------------------------------------ tables
def name_cell(n): return f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:26])}</span><br><span class="dimmer">{esc(n["cohort"])} · rank {n["rank"]}</span>'
def fig_row(n):
    c = n["comps"]
    return [name_cell(n), pct(n["r3m"]), pct(n["r1m"]), pct(n["r_run"]), pct(n["r_selloff"]), geiger(n["geiger"]),
            pct(n["rev_growth_latest_q_yoy_pct"], frac=False), pct(n["rev_growth_next_fy_pct"], frac=False), pct(n["eps_growth_next_fy_pct"], frac=False),
            arrow(n["eps_rev_90d_direction"]) + (f' <span class="dimmer">{n["eps_rev_90d_pct"]:+.0f}%</span>' if isinstance(n.get("eps_rev_90d_pct"), (int, float)) else ""),
            arrow(n["rev_est_rev_90d_direction"]), guide(n["guidance_direction"]),
            margin(n["gross_margin_pct"], n["gross_margin_year_ago_pct"]), margin(n["operating_margin_pct"], n["operating_margin_year_ago_pct"]),
            money(n["fcf_ttm_usd_b"]), money(n["net_cash_usd_b"]), pct(n["shares_change_yoy_pct"], digits=1, frac=False),
            vs(n["forward_pe"], c["pe_median"], c["pe_n"], 0), vs(n["ev_sales"], c["evs_median"], c["evs_n"], 1), conc(n),
            f'{usd(n["cap_run_start_b"])} → <b>{usd(n["cap_now_b"])}</b>']
FIG_HEAD = ["NAME", "3 MONTHS", "1 MONTH", "THE RUN<br>15 Sep →", "THE FALL<br>30 Jun → 15 Sep", "GEIGER", "SALES<br>last quarter", "SALES<br>next year", "EPS<br>next year",
            "EPS ESTIMATE<br>last 90 days", "SALES ESTIMATE<br>last 90 days", "ITS OWN<br>GUIDANCE", "GROSS MARGIN", "OPERATING MARGIN", "FREE CASH<br>$B, 12 mo", "CASH LESS DEBT<br>$B",
            "SHARE COUNT<br>1 year", "FORWARD P/E<br>vs comps", "EV / SALES<br>vs comps", "CUSTOMERS", "VALUE<br>15 Sep → now"]
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
        rows.append([f'<b>{t}</b> {who}', pct(n["r3m"]), pct(n["r_run"]), pct(n["rev_growth_next_fy_pct"], frac=False), arrow(n["eps_rev_90d_direction"]), guide(n["guidance_direction"]),
                     margin(n["operating_margin_pct"], n["operating_margin_year_ago_pct"]), money(n["fcf_ttm_usd_b"]), pct(n["shares_change_yoy_pct"], digits=1, frac=False), conc(n),
                     "yes" if n["supply_overhang"] else "no" if n["supply_overhang"] is False else "–"])
    pair_html.append(f'<h3>{esc(p["cohort"])}</h3><div class="wrap">' + tbl(["NAME", "3 MONTHS", "THE RUN", "SALES next year", "EPS ESTIMATE 90 days", "GUIDANCE", "OPERATING MARGIN", "FREE CASH $B", "SHARE COUNT 1 yr", "CUSTOMERS", "NEW SHARES COMING"], rows, "fig") + "</div>")
PAIRS = "\n".join(pair_html)

cap_rows = [[f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:30])}</span>', usd(n["cap_selloff_start_b"]), usd(n["cap_run_start_b"]), f'<b>{usd(n["cap_now_b"])}</b>', usd_signed(n["cap_added_in_run_b"]), pct(n["r_run"]),
             "raised money since 1 Jul; if by selling shares, the start values read high" if n["raised_capital_90d"] else ""] for n in sorted(grp("leader"), key=lambda n: -(n["cap_now_b"] or 0))]
cl, cg, cf = S["caps"]["leaders"], S["caps"]["laggards"], S["caps"]["field"]
cap_rows.append([f'<b>THE {len(G["leader"])} LEADERS</b>', f'<b>{usd(cl["selloff_start_b"])}</b>', f'<b>{usd(cl["run_start_b"])}</b>', f'<b>{usd(cl["now_b"])}</b>', f'<b>{usd_signed(cl["now_b"]-cl["run_start_b"])}</b>', pct(cl["now_b"]/cl["run_start_b"]-1), ""])
cap_rows.append([f'the {len(G["laggard"])} laggards', usd(cg["selloff_start_b"]), usd(cg["run_start_b"]), usd(cg["now_b"]), usd_signed(cg["now_b"]-cg["run_start_b"]), pct(cg["now_b"]/cg["run_start_b"]-1), ""])
cap_rows.append([f'the whole field ({cf["n"]} names)', usd(cf["selloff_start_b"]), usd(cf["run_start_b"]), usd(cf["now_b"]), usd_signed(cf["now_b"]-cf["run_start_b"]), pct(cf["now_b"]/cf["run_start_b"]-1), "profile values, 5 Oct close"])
T_CAPS = tbl(["LEADER", "30 JUN", "15 SEP (start of the run)", "NOW", "ADDED IN THE RUN", "PRICE IN THE RUN", ""], cap_rows, "caps")
lag_cap_rows = [[f'<b>{n["ticker"]}</b> <span class="dimmer">{esc((n["name"] or "")[:30])}</span>', usd(n["cap_selloff_start_b"]), usd(n["cap_run_start_b"]), f'<b>{usd(n["cap_now_b"])}</b>', usd_signed(n["cap_added_in_run_b"]), pct(n["r_run"]),
                 "raised money since 1 Jul; if by selling shares, the start values read high" if n["raised_capital_90d"] else ""] for n in sorted(grp("laggard") + grp("named_mid"), key=lambda n: -(n["cap_now_b"] or 0))]
T_CAPS_LAG = tbl(["LAGGARD / NAMED", "30 JUN", "15 SEP", "NOW", "CHANGE IN THE RUN", "PRICE IN THE RUN", ""], lag_cap_rows, "caps")
coh_rows = [[esc(c["label"]), c["n"], usd(c["selloff_start_b"]), usd(c["run_start_b"]), f'<b>{usd(c["now_b"])}</b>', usd_signed(c["now_b"] - c["run_start_b"]), pct(c["run_pct"]), pct(c["median_r_run"]), pct(c["median_r1m"]), pct(c["median_r3m"]), geiger(c["median_geiger"]),
             f'<span class="up">{len(c["leaders"])}</span> · <span class="dn">{len(c["laggards"])}</span>'] for c in sorted(S["cohort_caps"], key=lambda c: -(c["median_r1m"] or -9))]
T_COH = tbl(["COHORT", "NAMES", "30 JUN", "15 SEP", "NOW", "ADDED IN THE RUN", "VALUE IN THE RUN", "MEDIAN NAME, THE RUN", "MEDIAN 1 MONTH", "MEDIAN 3 MONTHS", "MEDIAN GEIGER", "LEADERS · LAGGARDS"], coh_rows, "caps")

comp_rows = []
for g in ("leader", "laggard", "named_mid"):
    for n in grp(g):
        c = n["comps"]
        mark = lambda t: f'<span class="up">{t}</span>' if t in c["peers_leaders"] else f'<span class="dn">{t}</span>' if t in c["peers_laggards"] else t
        comp_rows.append([f'<b>{n["ticker"]}</b> <span class="dimmer">{ {"leader": "leader", "laggard": "laggard", "named_mid": "mid-field"}[g]}</span>', esc(c["own_lines"]), " ".join(mark(t) for t in c["peers"]),
                          pct(n["r3m"]) + ' <span class="dimmer">vs</span> ' + pct(c["peers_r3m_median"]), pct(n["r_run"]) + ' <span class="dimmer">vs</span> ' + pct(c["peers_run_median"]),
                          vs(n["forward_pe"], c["pe_median"], c["pe_n"], 0) + f' <span class="dimmer">({c["pe_n"]} of {c["n_peers"]})</span>', vs(n["ev_sales"], c["evs_median"], c["evs_n"], 1) + f' <span class="dimmer">({c["evs_n"]} of {c["n_peers"]})</span>'])
T_COMPS = tbl(["NAME", "ITS BUSINESS LINE", "THE COMPS SYSTEM'S COMPARABLES", "3 MONTHS: IT vs COMPS' MEDIAN", "THE RUN: IT vs COMPS' MEDIAN", "FORWARD P/E vs COMPS' MEDIAN (comps with a reading)", "EV/SALES vs COMPS' MEDIAN"], comp_rows, "comps")

named_rows = [[f'<b>{x["ticker"]}</b>', f'{x["rank"]} of {x["of"]}', {"leader": "leader", "laggard": '<span class="dn">laggard (bottom 20)</span>', "middle": "middle of the field"}[x["group"]] if x["ticker"] not in G["laggard"] or x["group"] == "laggard" else '<span class="dn">counted as a laggard (named, bottom third)</span>'] for x in S["named_in_brief"]]
T_NAMED = tbl(["NAMED IN THE BRIEF", "RANK", "WHERE IT REALLY SITS"], named_rows)

ev_rows = "".join(f'<tr><td>{esc(e["claim"])}</td><td>{esc(e["count"])}</td></tr>' for e in OP.get("evidence", []))
OPINION = "".join(f"<p>{esc(p)}</p>" for p in OP["paragraphs"])
AGAINST = "".join(f"<li>{esc(a)}</li>" for a in OP.get("against", []))
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
table.story td{{min-width:220px;max-width:420px}}table.story td:first-child{{min-width:60px}}table.comps td:nth-child(3){{min-width:330px}}table.cond td:nth-child(2){{min-width:300px}}
.up{{color:var(--up)}}.dn{{color:var(--dn)}}.na{{color:var(--faint)}}.dimmer{{color:var(--dim)}}b{{color:var(--bright);font-weight:600}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}
.kpi b{{display:block;font-size:19px;font-weight:600}}.kpi div>span{{color:var(--dim);font-size:11px}}
.opinion{{background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--dim);padding:14px 18px;display:grid;grid-template-columns:minmax(0,3fr) minmax(0,2fr);gap:22px}}
.opinion p{{margin:0 0 10px;font-size:13px;line-height:1.6;color:var(--bright)}}.opinion .tag{{font-size:11px;letter-spacing:.16em;color:var(--dim);margin-bottom:8px}}
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
<p class="sub">6 Oct 2026 · a study · nothing on the Hub or in the database changed · branch hub/ld1-leaders-vs-laggards-20261006 · prices through {S["closes_through"]} · public figures read 6 Oct</p>

<div class="kpi">
<div><b>{S["field"]}</b><span>companies in the AI, chip, software and grid cohorts, ranked</span></div>
<div><b><span class="up">{len(G["leader"])}</span> · <span class="dn">{len(G["laggard"])}</span></b><span>leaders · laggards studied one by one (+{len(G["named_mid"])} named, mid-field)</span></div>
<div><b>{pct(B["QQQ"]["r_run"],1)} · {pct(B["RSP"]["r_run"],1)}</b><span>since 15 Sep: Nasdaq-100 fund · the equal-weight S&amp;P</span></div>
<div><b>{pct(B["SMH"]["r_selloff"],0)} → {pct(B["SMH"]["r_run"],0)}</b><span>the chip fund: 30 Jun → 15 Sep, then the run</span></div>
<div><b>{usd(cl["run_start_b"])} → {usd(cl["now_b"])}</b><span>the leaders' combined value, 15 Sep → now ({usd_signed(cl["now_b"]-cl["run_start_b"])})</span></div>
<div><b>{usd(cg["run_start_b"])} → {usd(cg["now_b"])}</b><span>the laggards' combined value, 15 Sep → now ({usd_signed(cg["now_b"]-cg["run_start_b"])})</span></div>
</div>

<h2>1 · THE FALL AND THE RUN, EVERY NAME</h2>
<div class="panel wrap">{SVG1}</div>
<div class="wrap">{T_KIND}</div>

<h2>2 · WHAT SEPARATES THEM, AS COUNTS</h2>
<div class="panel">{SVG2}</div>
<details class="more"><summary>EVERY CONDITION COUNTED, WITH THE NAMES</summary><div class="wrap">{T_COND}</div></details>
<h3>2b · BOTH SETS FELL HARD IN THE SUMMER. THESE BOUNCED: {esc(" ".join(BC["bounced"]))}. THESE DID NOT: {esc(" ".join(BC["stayed_down"]))}</h3>
<div class="panel">{SVG2B}</div>

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

<h2>8 · MARKET VALUE: WHERE THE RUN PUT THEM</h2>
<div class="wrap">{T_CAPS}</div>
<details class="more"><summary>THE LAGGARDS AND THE NAMED, ONE BY ONE</summary><div class="wrap">{T_CAPS_LAG}</div></details>
<h3>EVERY COHORT IN THE FIELD</h3>
<div class="wrap">{T_COH}</div>

<h2>9 · EACH NAME AGAINST ITS OWN COMPS</h2>
<div class="wrap">{T_COMPS}</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<h3>WHAT THE PAGE SHOWS</h3>
<p>Alan, 6 Oct: "do a study with these leaders and whatever the comps system says are comparables for them, versus the ones that are doing wrong, like this CBRS one. What's the big difference between these names? Why is it that these names are the ones that bounced? In your opinion. And also what market cap did that put them at."</p>
<p>The field is every company in the AI, chip, software-and-internet and grid cohorts of CO1's tree ({S["field"]} names, 15 cohorts). Each is ranked on three things, each as a place inside the field: its 3-month return, its 1-month return and its Hub Geiger. The score is the plain average of the three places. The 25 highest are the leaders. The 20 lowest are the laggards, plus the two names the brief asked for that sit in the bottom third (CBRS, rank 112, and IREN, rank 104): 22 in all. The other names the brief asked about (CRWV, NBIS, MU, SNDK, STX) rank in the middle and are shown apart, not counted as laggards.</p>
<p>"The fall" is 30 June to 15 September: the Nasdaq-100 fund's high before the summer drop to its lowest close before the run. "The run" is 15 September to the last close on file (5 October). Section 1 puts every name on those two measures. Section 2 counts conditions: a bar is the share of the group that meets the condition, and the words beside it are the count, as "22 of 25". A name with no reading for a condition is left out of that count, so the second number can be below 25 or 22. "Clear" means the gap would be unusual by chance on groups this small (Fisher exact test under 5%); "leans" means under 20%; anything weaker is left out of the picture and kept in the table.</p>
<h3>WHERE EACH NUMBER COMES FROM</h3>
<ul>
<li><b>Prices and returns:</b> the daily closes CO1 saved from the chart API (17 Mar to 5 Oct 2026), already in this repo. No price was fetched for this page.</li>
<li><b>Geiger:</b> the Hub Geiger as the live page received it on 6 Oct at 14:53 ET, saved by BT1 in this repo.</li>
<li><b>Cohorts:</b> CO1's cohort tree (proposal.json).</li>
<li><b>Comparables:</b> C5's own rule (business first, 12 kept) run on saved inputs: CO1's company profiles of 6 Oct and C5's revenue-segment file of 3 Oct. Against the four sets C6 saved from the live tab on 5 Oct it gives {", ".join(f'{c["ticker"]} {c["same"]} of {c["of"]}' for c in Q["comps_rule_vs_live_5oct"])} the same.</li>
<li><b>The three judgement calls (earnings estimate up or down, sales estimate up or down, guidance raised or not)</b> were read twice. The first reader knew which group a name was in. The second was blind: told only the ticker, and told not to look at the share price. Where the two agree the reading stands; where only one found an answer it stands and is counted; where they disagree the name is left out of that count. Agreed · disagreed · one reading only · none: earnings estimate {TW["eps_rev_90d_direction"]["agree"]} · {len(TW["eps_rev_90d_direction"]["disagree"])} · {TW["eps_rev_90d_direction"]["one_only"]} · {TW["eps_rev_90d_direction"]["none"]}; sales estimate {TW["rev_est_rev_90d_direction"]["agree"]} · {len(TW["rev_est_rev_90d_direction"]["disagree"])} · {TW["rev_est_rev_90d_direction"]["one_only"]} · {TW["rev_est_rev_90d_direction"]["none"]}; guidance {TW["guidance_direction"]["agree"]} · {len(TW["guidance_direction"]["disagree"])} · {TW["guidance_direction"]["one_only"]} · {TW["guidance_direction"]["none"]}. Left out for disagreement: earnings {esc(" ".join(TW["eps_rev_90d_direction"]["disagree"]) or "none")}; sales {esc(" ".join(TW["rev_est_rev_90d_direction"]["disagree"]) or "none")}; guidance {esc(" ".join(TW["guidance_direction"]["disagree"]) or "none")}. The table under picture 2 also gives each of these counts using only the names where both readings agree.</li>
<li><b>Sales, earnings, estimates, margins, cash, share count, customers, insiders, lock-ups:</b> public web pages read on 6 Oct by one research agent per name, then re-checked by a second, independent agent told to find mistakes. Main pages: stockanalysis.com (statistics, forecast, financials), Yahoo and Zacks estimate-trend pages, company filings and news. {Q["checked"]} of {Q["studied"]} names were checked; the checker changed something in {Q["names_changed_by_checker"]} of them ({Q["changes_total"]} changes).</li>
<li><b>Forward P/E and EV/sales of the comps:</b> the same public statistics pages, {Q["peers_read"]} of {Q["peers_wanted"]} comps read ({Q["peers_with_pe"]} with a forward P/E, {Q["peers_with_evs"]} with EV/sales). A median needs at least four comps with a reading.</li>
<li><b>Market value:</b> "now" is the public page's market value at its own price (6 Oct) when that price agrees with our last close; otherwise the Hub profile's value. "15 Sep" and "30 Jun" are that value times the price then over the price now.</li>
</ul>
<h3>WHAT COULD BE WRONG</h3>
<ul>
<li>The public figures were transcribed from web pages by a model. The second pass caught errors, but some will remain. The counts are the finding; a single cell is not.</li>
<li>Estimate revisions over 90 days are the weakest column: where no then-and-now pair was found the direction rests on dated analyst notes, or reads "–". No reading for: {esc(" ".join(Q["eps_revision_unknown"]) or "none")}.</li>
<li>Cross-check against the Hub comps tab's own saved figures (3 and 5 Oct, {xc["names"]} names): forward P/E within 25% for {xc["forward_pe_within_25pct"][0]} of {xc["forward_pe_within_25pct"][1]}, EV/sales within 25% for {xc["ev_sales_within_25pct"][0]} of {xc["ev_sales_within_25pct"][1]}, next-year sales growth within 8 points for {xc["next_year_sales_growth_within_8pts"][0]} of {xc["next_year_sales_growth_within_8pts"][1]}. Public pages and the Hub differ in how they define the forward year.</li>
<li>Market value at an earlier date holds the share count constant. A company that sold new shares in between reads too high at the start; those rows are marked.</li>
<li>Leaders and laggards come from different cohorts (cybersecurity and chips against miners, nuclear and consumer internet). A condition can separate the cohorts without separating names inside a cohort. Section 7 puts leaders beside laggards from the same cohort for that reason.</li>
<li>Three months is one stretch of one market. The 22 and 25 are small groups.</li>
<li>The comps rule ran without its small "also named by FMP" bonus, so a peer at the edge of the 12 can differ from the live tab.</li>
<li>Public price far from our close (figures from that page not used for value or multiples): {esc(" ".join(Q["price_mismatch"]) or "none")}.</li>
</ul>
<h3>WHAT WAS NOT DONE</h3>
<ul>
<li>The live database and the comps tab were not read. Two permission checks in this session declined backend reads (listing the database with the Hub page's key, then looking through the provider code for other routes). Those were not retried and no other route was tried. So the 90-day revision history the database keeps (analyst_estimates_daily) is not in this study; revisions come from public pages instead.</li>
<li>No table was written, nothing was deployed, no Fly machine was started, no browser window was opened on screen.</li>
<li>6 Oct closing prices are not in the return columns (the saved closes end 5 Oct); only the market values use 6 Oct.</li>
<li>QRVO is in the field's cohort but has no closes on file and was skipped.</li>
</ul>
<h3>WHAT THE CHECKER CHANGED</h3>
<ul class="small">{changed or "<li>nothing</li>"}</ul>
</details>
</main></body></html>
"""
open(os.path.join(D, "LEADERS-VS-LAGGARDS.html"), "w").write(PAGE)
print("wrote LEADERS-VS-LAGGARDS.html", len(PAGE), "bytes · conditions drawn:", len(shown))
