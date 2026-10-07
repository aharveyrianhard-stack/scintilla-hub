# KO1 · builds KNOCKOUT.html from data/knockout.json. A static page: bars drawn in HTML and small inline SVG, one small
# script of its own (the name finder in EVERY NAME), nothing fetched — so it cannot shift between visits. Every
# explanatory sentence is in PAGE SPECS at the bottom; the panels carry labels, units and numbers only. The BACK / CLOSE
# pair is placed exactly as scripts/inject-scnav.py places it (a slot in the header, the snippet before </body>).
#   python3 tools/build_page.py        (from deliverables/20261007/knockout/)
import json, html, os, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE)
K = json.load(open(os.path.join(ROOT, "data", "knockout.json"), encoding="utf-8"))
N, B, S, F, RU = K["names"], K["branches"], K["sectors"], K["funnel"], K["rules"]
E = html.escape
UP, DN, CY, INK, DIM, FAINT, LINE, PANEL = "#3caa6e", "#c85050", "#3cb4c8", "#c8c8cc", "#8c8c92", "#5a5a60", "#26262b", "#111114"
MINUS = "−"
def sgn(v, d=0, unit="%", plain=False):
    if v is None: return '<span class="faint">—</span>'
    v = round(v, d) + 0.0                                         # a number that rounds to nothing is shown as nothing, without a sign
    s = ("+" if v > 0 else MINUS if v < 0 else "") + f"{abs(v):,.{d}f}{unit}"
    return s if plain else f'<span class="{"up" if v > 0 else "dn" if v < 0 else "dim"}">{s}</span>'
def gg(v): return sgn(v, 2, "")
def px(v): return "—" if v is None else f"{v:,.2f}"
def ordinal(n):
    n = int(round(n)); return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
def tk(t, extra=""):
    n = N.get(t); mine = K["lists"]["RADAR"].__contains__(t) or K["lists"]["FAVORITES"].__contains__(t) or K["lists"]["LIKED"].__contains__(t)
    ls = [k for k in ("RADAR", "FAVORITES", "LIKED") if t in K["lists"][k]]
    title = (n["name"] if n and n.get("name") else t) + (" · on " + ", ".join(ls) if ls else " · on none of your lists")
    return f'<span class="tk{" mine" if mine else ""}" title="{E(title)}">{E(t)}</span>{extra}'
def lists_word(ls): return " · ".join(ls) if ls else "—"
# ---------------------------------------------------------------- small marks
def heat_bar(v, w=90, h=12):
    """A reading on −1…+1, drawn from the centre: right and green above zero, left and red below."""
    if v is None: return ""
    half = w / 2; x = half if v >= 0 else half + v * half; bw = max(1.5, abs(v) * half)
    return (f'<svg class="bar" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{v:+.2f} on a scale of minus one to plus one"><title>{v:+.2f} on −1…+1</title>'
            f'<rect x="0" y="{h/2-0.5}" width="{w}" height="1" fill="{LINE}"/><rect x="{x:.1f}" y="2" width="{bw:.1f}" height="{h-4}" rx="2" fill="{UP if v >= 0 else DN}"/><rect x="{half-0.5}" y="0" width="1" height="{h}" fill="{FAINT}"/></svg>')
def year_meter(p, w=70, h=12):
    """Where today sits in its own year: a track from the lowest evening to the highest, the 70th marked."""
    if p is None: return '<span class="faint">—</span>'
    x = 3 + (w - 6) * p / 100
    return (f'<svg class="bar" width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{ordinal(p)} percentile of its own year"><title>{ordinal(p)} percentile of its own year</title>'
            f'<rect x="3" y="{h/2-1.5}" width="{w-6}" height="3" rx="1.5" fill="{LINE}"/><rect x="{3+(w-6)*0.7-0.5:.1f}" y="1" width="1" height="{h-2}" fill="{FAINT}"/><circle cx="{x:.1f}" cy="{h/2}" r="4" fill="{INK}" stroke="{PANEL}" stroke-width="2"/></svg>')
def comps_cell(n):
    if n["comps_no_peer_set"]: return '<span class="dim">no peer set</span>'
    if n["comps"] is None: return '<span class="dim">not priced</span>'
    w = n["comps_words"]; why = "no earnings" if w.startswith("no earnings") else "thin + fragile" if w.startswith("thin (") else "thin" if n["comps_thin"] else "fragile"
    mark = "" if n["comps_strength"] == 1 else f'<span class="tag" title="{E(w)}">{why}</span>'
    num = sgn(n["comps"]) if n["comps_strength"] > 0 else f'<span class="faint" title="not used in the score">{sgn(n["comps"], plain=True)}</span>'
    return num + mark
def growth_cell(r, e, note=None):
    if r is None and e is None: return '<span class="dim">not ranked</span>'
    return f'{sgn(r)} <span class="faint">/</span> {sgn(e) if e is not None else "<span class=faint>—</span>"}'
def geiger_cell(n):
    if n["geiger"] is None: return "—"
    return f'{gg(n["geiger"])} <span class="small">{ordinal(n["pctl"]) if n["pctl"] is not None else "—"}</span>'
def wait_tag(n): return '<span class="tag wait">WAIT</span>' if n["hot"] else ""
def cell(label, inner, cls=""): return f'<td{" class=" + chr(34) + cls + chr(34) if cls else ""} data-l="{E(label)}"><div class="c">{inner}</div></td>'
def th(*labels, w=None):
    cg = ("<colgroup>" + "".join(f'<col style="width:{x}px">' if x else "<col>" for x in w) + "</colgroup>") if w else ""
    return cg + "<thead><tr>" + "".join(f'<th{" class=n" if l.startswith(">") else ""}>{E(l.lstrip(">"))}</th>' for l in labels) + "</tr></thead>"
def tbl(head, rows, ident=""): return f'<table class="r fx"{" id=" + chr(34) + ident + chr(34) if ident else ""}>{head}<tbody>{rows}</tbody></table>'
# ---------------------------------------------------------------- 1 · the funnel
def frow(label, total, of, segs=None, note=""):
    """One step: a bar whose length is its share of the first step; optional segments (count, word, shade)."""
    w = 100 * total / of; inner = ""
    if segs:
        for c, word, shade in segs:
            if c: inner += f'<span title="{c} {E(word)}" style="flex:{c} 1 0;background:{shade};height:100%;border-radius:2px;min-width:2px"></span>'
    else: inner = f'<span title="{total}" style="flex:1;background:{DIM};height:100%;border-radius:2px"></span>'
    leg = ("<div class=fleg>" + "".join(f'<span><i style="background:{shade}"></i>{c} {E(word)}</span>' for c, word, shade in segs if c) + "</div>") if segs else ""
    return (f'<div class="frow"><div class="fl">{label}</div><div class="fbwrap"><div class="fb" style="width:{w:.1f}%">{inner}</div>{leg}</div>'
            f'<div class="fn"><b>{total}</b>{("<span>" + note + "</span>") if note else ""}</div></div>')
sk = F["skipped"]; total0 = F["run_through_comps"]
G1, G2, G3 = "#c8c8cc", "#8c8c92", "#5a5a60"
funnel = "".join([
    frow("COMPANIES WITH FIGURES<small>run through the comps</small>", total0, total0, None, f'{F["profiles_on_file"] - total0} more on file are not companies or cannot be priced'),
    frow("COMPS<small>how far each number can be leaned on</small>", total0, total0, [(F["sound"], "sound", G1), (F["half_strength"], "thin or fragile: half strength", G2), (F["not_used"], "not used", G3)]),
    frow("ROUND 1 · WHERE TO LOOK<small>every branch kept and ranked</small>", F["round1_in_a_branch"], total0, None, f'{F["branches"]} branches in {F["sectors"]} sectors'),
    frow("ROUND 2 · FUNDAMENTALS<small>upper half of its own branch</small>", F["round2_pass"], total0, None, f'{F["round2_fail"]} fail · {F["round2_not_judged"]} not judged'),
    frow("ROUND 3 · TIMING<small>of those, not hot for themselves</small>", F["round3_now"], total0, None, f'{F["round3_wait"]} pass fundamentals but wait'),
    frow("FINALISTS<small>top three of a branch</small>", F["finalists"], total0, [(F["finalists_now"], "timing fine", G1), (F["finalists"] - F["finalists_now"], "wait", G2)]),
    frow("CHAMPIONS<small>first in a branch</small>", F["champions"], total0, [(F["champions_now"], "timing fine", G1), (F["champions"] - F["champions_now"], "wait", G2)], f'{F["champion_slots"]} branches; some names win two'),
])
# ---------------------------------------------------------------- 2 · the three lists through the same rounds
def list_panel(k):
    r = K["list_read"][k]; n = r["n"]
    segs = [(len(r["pass_both"]), "pass both rounds", G1, r["pass_both"]), (len(r["pass_wait"]), "pass fundamentals · wait", G2, r["pass_wait"]), (len(r["fail_r2"]), "fail round 2", G3, r["fail_r2"]), (len(r["not_scored"]), "not a company", "#26262b", r["not_scored"])]
    other = [t for t in K["lists"][k] if t in N and t not in r["pass_both"] and t not in r["pass_wait"] and t not in r["fail_r2"]]
    if other: segs.insert(3, (len(other), "not judged", "#3c3c42", other))
    bar = '<div class="fb" style="width:100%;height:18px">' + "".join(f'<span title="{c} {E(w)}" style="flex:{c} 1 0;background:{sh};height:100%;border-radius:2px;min-width:2px"></span>' for c, w, sh, _ in segs if c) + "</div>"
    plain = lambda t: f'<span class="tk" title="{E((N[t]["name"] if t in N and N[t].get("name") else t))}">{E(t)}</span>'
    rows = "".join(f'<div class="seg"><span class="seglab"><i style="background:{sh}"></i>{c} {E(w.upper())}</span>' + " ".join(plain(t) for t in ts) + "</div>" for c, w, sh, ts in segs if c)
    return f'<div class="panel"><div class="ph">{k} · {n} NAMES · {len(r["champions"])} CHAMPIONS · {len(r["finalists"])} FINALISTS</div>{bar}<div style="height:10px"></div>{rows}</div>'
def count_bar(ts, most):
    n = len(ts); w = 0 if not most else round(120 * n / most)
    return (f'<svg class="bar" width="120" height="12" viewBox="0 0 120 12" role="img" aria-label="{n} names"><title>{E(" ".join(ts)) or "none"}</title><rect x="0" y="5.5" width="120" height="1" fill="{LINE}"/>'
            + (f'<rect x="0" y="2" width="{max(w, 2)}" height="8" rx="2" fill="{DIM}"/>' if n else "") + f"</svg>{n}")
LS = K["lists_by_sector"]; most = {k: max(len(r[k]) for r in LS) for k in ("RADAR", "FAVORITES", "LIKED")}
ls_rows = "".join("<tr>" + cell("ROUND 1", f'<span class="rk">#{r["rank"]}</span>') + cell("SECTOR", f'<b>{E(r["label"])}</b><br><span class="small">{E(r["read"] or "")} · {r["names"]} names</span>')
                  + cell("HEAT NOW", f'{heat_bar(r["heat"])}{gg(r["heat"])}', "n") + cell("ITS OWN YEAR", f'{year_meter(r["pctl"])}<span class="small">{ordinal(r["pctl"]) if r["pctl"] is not None else "—"}</span>', "n")
                  + "".join(cell(k, count_bar(r[k], most[k]), "n") for k in ("RADAR", "FAVORITES", "LIKED")) + "</tr>" for r in LS)
tot = {k: sum(len(r[k]) for r in LS) for k in ("RADAR", "FAVORITES", "LIKED")}; last4 = {k: sum(len(r[k]) for r in LS[-4:]) for k in tot}; first4 = {k: sum(len(r[k]) for r in LS[:4]) for k in tot}
sector_html = (f'<div class="panel"><div class="ph">WHERE YOUR LISTS SIT IN ROUND 1 · COMPANIES BY SECTOR, IN ROUND-1 ORDER</div>'
               + tbl(th("#", "SECTOR", ">HEAT NOW  −1…+1", ">ITS OWN YEAR", ">RADAR", ">FAVORITES", ">LIKED", w=[44, None, 172, 118, 190, 190, 190]), ls_rows)
               + '<div class="kpis" style="margin:14px 0 0">' + "".join(f'<div class="kpi"><b>{last4[k]} of {tot[k]}</b><span>{k} · IN THE FOUR SECTORS RANKED LAST</span></div><div class="kpi"><b>{first4[k]} of {tot[k]}</b><span>{k} · IN THE FOUR RANKED FIRST</span></div>' for k in ("RADAR", "FAVORITES", "LIKED")) + "</div></div>")
def radar_rows():
    out = ""
    for t in K["lists"]["RADAR"]:
        n = N.get(t)
        if not n: out += "<tr>" + cell("NAME", f'<span class="tk">{E(t)}</span>') + cell("VERDICT", '<span class="dim">not scored: not a company</span>') + "".join(cell(l, "—", c) for l, c in (("BRANCH", ""), ("WHY", "w"), ("COMPS", "n"), ("GROWTH NEXT YR", "n"), ("GEIGER", "n"), ("WHERE IT WOULD BE BOUGHT", "w"))) + "</tr>"; continue
        h = n.get("home") or (n.get("verdict_branches") or [None])[0]; br = n["branches"].get(h) if h else None
        out += ("<tr>" + cell("NAME", f'<span class="tk">{E(t)}</span>{wait_tag(n)}<br><span class="small el">{E(n["name"] or "")}</span>') + cell("VERDICT", E(n["verdict"]))
                + cell("BRANCH", (f'{E(br["label"])}<br><span class="small">{ordinal(br["rank"]) if br["rank"] else "not ranked"} of {br["of"]} · branch #{B[h]["rank"]} of {len(B)}</span>' if br else "—")) + cell("WHY", E(n["why"] or "—"), "w")
                + cell("COMPS", comps_cell(n), "n") + cell("GROWTH NEXT YR", growth_cell(n["g1_rev"], n["g1_eps"]), "n") + cell("GEIGER", geiger_cell(n), "n") + cell("WHERE IT WOULD BE BOUGHT", E(n["buy"]["words"]), "w") + "</tr>")
    return out
radar_html = f'<div class="panel"><div class="ph">RADAR, NAME BY NAME · {len(K["lists"]["RADAR"])}</div>{tbl(th("NAME", "VERDICT", "BRANCH", "WHY IT STANDS THERE", ">COMPS", ">GROWTH NEXT YR REV / EPS", ">GEIGER · OWN YR", "WHERE IT WOULD BE BOUGHT", w=[150, 170, 250, None, 124, 132, 112, 330]), radar_rows())}</div>'
lists_html = '<div class="grid3">' + "".join(list_panel(k) for k in ("RADAR", "FAVORITES", "LIKED")) + "</div>" + sector_html + radar_html
# ---------------------------------------------------------------- 3 · round 1
def r1_rows(rows, what="BRANCH"):
    out = ""
    for b in rows:
        sub = (E(b["sector_label"]) + " · " if b.get("sector_label") and b["sector_label"] != b["label"] else "") + E(b.get("read") or "—")
        out += ("<tr>" + cell("RANK", f'<span class="rk">#{b["rank"]}</span>') + cell(what, f'<b>{E(b["label"])}</b><br><span class="small">{sub} · {len(b["run"])} names</span>')
                + cell("HEAT NOW", f'{heat_bar(b.get("heat"))}{gg(b.get("heat"))}<br><span class="small">trend {gg(b.get("trend"))} · mom. {gg(b.get("momentum"))}</span>', "n")
                + cell("ITS OWN YEAR", f'{year_meter(b.get("pctl"))}<span class="small">{ordinal(b["pctl"]) if b.get("pctl") is not None else "—"}</span>', "n") + "</tr>")
    return out
def r1_split(group, k, what):
    """The ranked rows in k side-by-side tables, so the whole ranking is on one screen."""
    rows = sorted(group.values(), key=lambda b: b["rank"]); per = -(-len(rows) // k)
    head = lambda: th("#", what, ">HEAT NOW  −1…+1", ">ITS OWN YEAR", w=[40, None, 172, 118])
    return f'<div class="grid{k}">' + "".join(f"<div>{tbl(head(), r1_rows(rows[i * per:(i + 1) * per], what))}</div>" for i in range(k)) + "</div>"
r1_html = (f'<div class="panel"><div class="ph">SECTORS · {len(S)} · RANKED, NONE DROPPED</div>{r1_split(S, 2, "SECTOR")}</div>'
           f'<div class="panel"><div class="ph">BRANCHES · {len(B)} · RANKED, NONE DROPPED</div>{r1_split(B, 3, "BRANCH")}</div>')
# ---------------------------------------------------------------- 4 · champions
def fin_cell(b, i):
    if i >= len(b["finalists"]): return '<span class="faint">—</span>'
    t = b["finalists"][i]; return tk(t, wait_tag(N[t]))
ch_rows = ""
for c in sorted(B, key=lambda c: B[c]["rank"]):
    b = B[c]; t = b["champion"]
    if not t:
        ch_rows += ("<tr>" + cell("RANK", f'<span class="rk">#{b["rank"]}</span>') + cell("BRANCH", f'<b>{E(b["label"])}</b><br><span class="small">heat {gg(b.get("heat"))} · {ordinal(b["pctl"]) if b.get("pctl") is not None else "—"} of its year</span>')
                    + cell("CHAMPION", '<span class="dim">none</span>') + cell("2ND · 3RD", '<span class="faint">—</span>') + cell("WHY IT WON", '<span class="dim">no name in this branch can be judged on fundamentals: ' + E(", ".join(f"{x} ({N[x]['verdict'].split(': ', 1)[-1]})" for x in b["run"])) + "</span>", "w")
                    + cell("COMPS", "—", "n") + cell("GROWTH NEXT YR", "—", "n") + cell("GEIGER", "—", "n") + cell("WHERE IT WOULD BE BOUGHT", "—", "w") + "</tr>")
        continue
    n = N[t]; fr = b["finalist_rows"][0]
    ch_rows += ("<tr>" + cell("RANK", f'<span class="rk">#{b["rank"]}</span>') + cell("BRANCH", f'<b>{E(b["label"])}</b><br><span class="small">heat {gg(b.get("heat"))} · {ordinal(b["pctl"]) if b.get("pctl") is not None else "—"} of its year</span>')
                + cell("CHAMPION", tk(t, wait_tag(n)) + f'<br><span class="small el">{E(n["name"] or "")}</span>') + cell("2ND · 3RD", f'<div>{fin_cell(b, 1)}</div><div>{fin_cell(b, 2)}</div>')
                + cell("WHY IT WON", f'<span class="why">{E(fr["why"])}</span>', "w") + cell("COMPS", comps_cell(n), "n") + cell("GROWTH NEXT YR", growth_cell(n["g1_rev"], n["g1_eps"]), "n")
                + cell("GEIGER", geiger_cell(n), "n") + cell("WHERE IT WOULD BE BOUGHT", E(n["buy"]["words"]), "w") + "</tr>")
champ_html = f'<div class="panel"><div class="ph">ONE ROW A BRANCH · IN ROUND-1 ORDER · {F["champions"]} DIFFERENT NAMES · <span class="tk mine">CYAN</span> = ON ONE OF YOUR LISTS</div>{tbl(th("#", "BRANCH", "CHAMPION", "2ND · 3RD", "WHY IT WON", ">COMPS", ">GROWTH NEXT YR REV / EPS", ">GEIGER · OWN YR", "WHERE IT WOULD BE BOUGHT", w=[44, 232, 168, 112, None, 124, 132, 112, 330]), ch_rows)}</div>'
# ---------------------------------------------------------------- 5a · blind spots
def name_branch(n, c):
    br = n["branches"][c]; return f'{E(br["label"])}<br><span class="small">{ordinal(br["rank"])} of {br["of"]} · branch #{B[c]["rank"]} of {len(B)}</span>'
def blind_rows(ts):
    out = ""
    for t in ts:
        n = N[t]; c = (n["champion_where_it_counts"] or n["finalist_where_it_counts"])[0]; place = "champion" if n["champion_where_it_counts"] else ordinal(B[c]["finalists"].index(t) + 1) + " of its top three"
        why = [r["why"] for r in B[c]["finalist_rows"] if r["t"] == t][0]
        out += ("<tr>" + cell("NAME", tk(t, wait_tag(n)) + f'<br><span class="small el">{E(n["name"] or "")}</span>') + cell("BRANCH", name_branch(n, c)) + cell("WHY", E(why), "w")
                + cell("COMPS", comps_cell(n), "n") + cell("GROWTH NEXT YR", growth_cell(n["g1_rev"], n["g1_eps"]), "n") + cell("GEIGER", geiger_cell(n), "n") + cell("WHERE IT WOULD BE BOUGHT", E(n["buy"]["words"]), "w") + "</tr>")
    return out
bs_ch = [t for t in K["blind_spots"] if N[t]["champion_where_it_counts"]]; bs_rest = [t for t in K["blind_spots"] if not N[t]["champion_where_it_counts"]]
BH = th("NAME", "BRANCH", "THE ONE-LINE REASON", ">COMPS", ">GROWTH NEXT YR REV / EPS", ">GEIGER · OWN YR", "WHERE IT WOULD BE BOUGHT", w=[168, 250, None, 124, 132, 112, 330])
blind_html = (f'<div class="panel"><div class="ph">BLIND SPOTS · CHAMPIONS ON NONE OF YOUR LISTS · {len(bs_ch)}</div>{tbl(BH, blind_rows(bs_ch))}'
              f'<details class="fold"><summary>THE OTHER FINALISTS ON NONE OF YOUR LISTS · {len(bs_rest)}</summary>{tbl(BH, blind_rows(bs_rest))}</details></div>')
# ---------------------------------------------------------------- 5b · tunnel vision
order_l = lambda x: (0 if "RADAR" in x["lists"] else 1 if "FAVORITES" in x["lists"] else 2, x["t"])
t2 = sorted([x for x in K["tunnel"] if x["round"] == 2], key=order_l); t3 = sorted([x for x in K["tunnel"] if x["round"] == 3], key=order_l); t0 = sorted([x for x in K["tunnel"] if x["round"] is None], key=order_l)
t2_rows = "".join("<tr>" + cell("NAME", tk(x["t"])) + cell("ON", E(lists_word(x["lists"]))) + cell("BRANCH", f'{E(x.get("branch") or "—")} <span class="small">#{x.get("rank")} of {x.get("of")}</span>') + cell("WHY IT FAILS", E(x["why"]), "w")
                  + cell("COMPS", comps_cell(N[x["t"]]), "n") + cell("GROWTH NEXT YR", growth_cell(N[x["t"]]["g1_rev"], N[x["t"]]["g1_eps"]), "n") + cell("GEIGER", geiger_cell(N[x["t"]]), "n") + "</tr>" for x in t2)
def cool_cells(n):
    c = n.get("cool") or {}
    a = "—" if c.get("price") is None else f'{px(c["price"])} {sgn(c["pct"], 1)}'
    b = "—" if not c.get("near") else f'{E(c["near"]["label"])} {px(c["near"]["level"])} {sgn(c["near"]["pct"], 1)}'
    m = "—" if c.get("median_price") is None else f'{px(c["median_price"])} {sgn(c["median_pct"], 1)}'
    nb = "—" if not n.get("near_below") else f'{E(n["near_below"]["label"])} {px(n["near_below"]["level"])} {sgn(n["near_below"]["pct"], 1)}'
    return a, b, m, nb
def green_rows(ts):
    out = ""
    for t in ts:
        n = N[t]; a, b, m, nb = cool_cells(n)
        out += ("<tr>" + cell("NAME", tk(t)) + cell("ON", E(lists_word(n["lists"]))) + cell("CLOSE", px(n["price"]), "n") + cell("GEIGER", gg(n["geiger"]), "n") + cell("ITS OWN YEAR", f'{year_meter(n["pctl"])} <span class="small">{ordinal(n["pctl"])}</span>', "n")
                + cell("COOLS AT", a, "n") + cell("NAMED LEVEL NEAREST THAT", b) + cell("BACK TO ITS USUAL", m, "n") + cell("FIRST LEVEL UNDER PRICE", nb) + "</tr>")
    return out
GH = th("NAME", "ON", ">CLOSE", ">GEIGER", ">ITS OWN YEAR", ">COOLS AT (BACK TO ITS 70TH)", "NAMED LEVEL NEAREST THAT CLOSE", ">BACK TO ITS USUAL (ITS MEDIAN)", "FIRST NAMED LEVEL UNDER TODAY'S CLOSE", w=[76, 214, 100, 80, 130, 190, None, 210, 270])
named = K["named_green"]; g_lists = [t for t in K["green"] if N[t]["lists"] and t not in named]; g_rest = [t for t in K["green"] if not N[t]["lists"] and t not in named]
wl = K["wait_on_lists"]
tunnel_html = (f'<div class="panel"><div class="ph">TUNNEL VISION · ON YOUR LISTS, FAILS ROUND 2 (FUNDAMENTALS) · {len(t2)}</div>{tbl(th("NAME", "ON", "BRANCH", "WHY IT FAILS", ">COMPS", ">GROWTH NEXT YR REV / EPS", ">GEIGER · OWN YR", w=[76, 214, 270, None, 124, 132, 112]), t2_rows)}'
               f'<h3>ON YOUR LISTS · PASSES FUNDAMENTALS, ROUND 3 SAYS WAIT · {len(wl)} · THEIR LEVELS ARE IN THE GREEN TABLE BELOW</h3><div>' + " ".join(f'<span class="chip" title="{E(N[t]["buy"]["words"])}">{E(t)} <span class="small">{ordinal(N[t]["pctl"])}</span></span>' for t in wl) + "</div>"
               f'<h3>ON YOUR LISTS · NOT JUDGED: SALES UNDER 1% OF MARKET VALUE, OR FEWER THAN THREE READINGS · {len([x for x in t0 if x["t"] in N])}</h3><div>' + " ".join(f'<span class="chip" title="{E(x["why"])}">{E(x["t"])}</span>' for x in t0 if x["t"] in N) + "</div>"
               f'<h3>ON YOUR LISTS · NOT COMPANIES (FUNDS, COINS, METALS) · {len([x for x in t0 if x["t"] not in N])}</h3><div>' + " ".join(f'<span class="chip" title="{E(x["why"])}">{E(x["t"])}</span>' for x in t0 if x["t"] not in N) + "</div></div>")
green_html = (f'<div class="panel"><div class="ph">WENT GREEN · GEIGER ABOVE THE 70TH PERCENTILE OF ITS OWN YEAR · {len(K["green"])} COMPANIES</div>'
              + tbl(GH, f'<tr class="sec"><td colspan="9">THE SEVEN YOU NAMED</td></tr>{green_rows(named)}<tr class="sec"><td colspan="9">THE OTHERS ON YOUR LISTS · {len(g_lists)}</td></tr>{green_rows(g_lists)}')
              + f'<details class="fold"><summary>THE REST, ON NONE OF YOUR LISTS · {len(g_rest)}</summary>{tbl(GH, green_rows(g_rest))}</details></div>')
# ---------------------------------------------------------------- 6 · every name
def all_rows():
    out = ""
    for t in sorted(N):
        n = N[t]; h = n.get("home") or (n.get("verdict_branches") or [None])[0]; br = n["branches"].get(h) if h else None
        marks = ("" if not n["one_off"] else '<span class="tag" title="' + E("; ".join(n["one_off"])) + '">one-off cleaned</span>') + ('<span class="tag" title="its sales are under 1% of its market value: the price rests on what it may become">venture</span>' if n.get("venture") else "")
        out += (f'<tr data-k="{E((t + " " + (n["name"] or "") + " " + (br["label"] if br else "") + " " + n["verdict"]).lower())}">' + cell("NAME", tk(t) + marks + f'<br><span class="small el">{E(n["name"] or "")}</span>') + cell("BRANCH", (f'{E(br["label"])} <span class="small">{("#" + str(br["rank"]) + " of " + str(br["of"])) if br["rank"] else "not ranked"}</span>' if br else "—"))
                + cell("VERDICT", E(n["verdict"])) + cell("COMPS", comps_cell(n), "n") + cell("GROWTH NEXT YR", growth_cell(n["g1_rev"], n["g1_eps"]), "n") + cell("YEAR AFTER", growth_cell(n["g2_rev"], n["g2_eps"]), "n")
                + cell("REVISIONS", sgn(n["revisions"]), "n") + cell("CASH YIELD", sgn(n["cash"], 1), "n") + cell("GEIGER", geiger_cell(n), "n") + cell("WHERE IT WOULD BE BOUGHT", E(n["buy"]["words"]), "w") + "</tr>")
    return out
all_html = (f'<div class="panel"><div class="ph">EVERY COMPANY RUN · {len(N)}</div><input class="find" id="find" type="search" placeholder="FIND A NAME, A BRANCH OR A VERDICT" aria-label="Find a name">'
            f'<div class="scrolly">{tbl(th("NAME", "BEST BRANCH", "VERDICT", ">COMPS", ">GROWTH NEXT YR REV / EPS", ">YEAR AFTER REV / EPS", ">REVISIONS", ">CASH YIELD", ">GEIGER · OWN YR", "WHERE IT WOULD BE BOUGHT", w=[196, 240, 196, 124, 132, 132, 84, 84, 112, None]), all_rows(), "allnames")}</div></div>')
# ---------------------------------------------------------------- 7 · what was not run
fh = F["funds_holdings"]
skip_rows = "".join(f"<tr>{cell('WHAT', E(w))}{cell('HOW MANY', str(c), 'n')}{cell('WHY', E(why))}</tr>" for w, c, why in [
    ("funds", sk.get("a fund, not a company", 0), "a fund has no earnings to price; the branches' own funds are read as lines in round 1"),
    ("coins, futures and indexes", sk.get("not a company", 0), "no company figures"),
    ("stopped trading", sk.get("stopped trading", 0), "; ".join(f"{t}: {v.split(': ', 1)[-1]}" for t, v in F["skipped_names"].items() if v.startswith("stopped"))),
    ("second share classes", sk.get("the same company as GOOGL", 0) + sk.get("the same company as BRK-B", 0), "GOOG is priced as GOOGL and BRK.A as BRK-B"),
    ("figures on file, not served", sk.get("figures on file, but the Hub does not serve it", 0), "; ".join(t for t, v in F["skipped_names"].items() if v.startswith("figures"))+ ": no settled close to price it on"),
    ("holdings of the funds, with no figures", fh["not_run_no_figures"], f'{fh["funds_with_holdings_on_file"]} funds list {fh["distinct_holdings"]:,} different holdings; {fh["of_them_run"]} of them are companies we hold figures for and were run'),
    ("comps number withheld: no peer set", F["no_peer_set"], "the company is priced far from its own group on most multiples; kept, ranked on growth, revisions and cash"),
    ("comps number: cannot be priced", F["cannot_be_priced"], "no multiple carries figures; kept, ranked on the other readings"),
    ("comps number not used: no earnings", F["no_earnings_comps_not_used"], "no earnings, trailing or expected; kept, ranked on growth, revisions and cash"),
    ("comps number not used: thin and fragile", F["thin_and_fragile"], "fewer than four peers and the centre swings on one of them"),
    ("comps number at half strength", F["half_strength"], f'{F["thin"]} thin (fewer than four peers with figures) and {F["fragile"]} fragile (one peer moves the centre more than 10%)'),
    ("round 2: not judged", F["round2_not_judged"], "fewer than two readings on file"),
])
skip_html = f'<div class="panel"><div class="ph">COUNTED, NEVER DROPPED</div>{tbl(th("WHAT", ">HOW MANY", "WHY", w=[380, 110, None]), skip_rows)}</div>'
# ---------------------------------------------------------------- page specs
W = RU["weights"]; ck = K["checks"]
one_off = sorted((t, n["one_off"]) for t, n in N.items() if n["one_off"]); dips = sorted(t for t, n in N.items() if n.get("dip_years")); vent = sorted(t for t, n in N.items() if n.get("venture"))
import re as _re
def one_off_ps(t):                       # the per-share one-off this run read for a name's year in progress, from its own words
    m = [_re.search(r"carries about ([0-9.]+) a share", w) for w in N[t]["one_off"] if "this year" in w]; return m[0].group(1) if m and m[0] else "—"
FX = json.load(open(os.path.join(ROOT, "data", "fixture-one-off.json"), encoding="utf-8"))["study"]
foreign = sorted(t for t, n in N.items() if (n.get("currency") or "USD") != "USD"); reviewed = sorted(t for t, n in N.items() if n["reviewed"])
num_word = lambda k: {15: "fifteen", 16: "sixteen", 17: "seventeen"}.get(k, str(k))
ups = [n["comps"] for n in N.values() if n["comps"] is not None]
specs = f"""
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<h4>WHAT THIS PAGE SHOWS</h4>
<p>Every company we hold figures for, {len(N)} of them, put through the same three rounds, whether or not it is on one of your lists. The rounds run in the order you asked for: where the money should look, then what to buy inside each branch on fundamentals, then when. Nothing here is a trade. It is a study on a branch: no table was written and nothing on the Hub changed.</p>
<p>Everything is dated on the close of Tuesday 6 October 2026. The Geiger is the reading published after that close, read once at about 01:55 ET on 7 October.</p>
<h4>THE FUNNEL, STEP BY STEP</h4>
<ul>
<li><b>Companies with figures.</b> {F["profiles_on_file"]} names have a profile on file. {total0} are companies with a settled close and a fundamentals row and were run. The rest are counted in the last panel, each with its reason.</li>
<li><b>Comps.</b> The comps system exactly as the comps fix left it, with every one of its switches on: memory and storage priced on each other, the data-centre landlords on each other, the growth credit, the tighter outlier rule, no sales multiples when margins are more than twice apart, and the test of the company itself. None of that code was changed. {F["priced"]} of the {total0} got a number; the fix moved {F["moved_by_the_fix_5pts"]} of them by more than five points.</li>
<li><b>How far a comps number is leaned on.</b> Sound ({F["sound"]}): four or more peers with figures behind the centre, and no single peer moves it more than 10%. Half strength ({F["half_strength"]}): thin (fewer than four peers) or fragile (one peer moves the centre more than 10%), one or the other. Not used ({F["not_used"]}): both at once, or the comps system itself withholds a number, or the company has no earnings, trailing or expected. A name whose comps number is not used is still ranked, on growth, revisions and cash.</li>
<li><b>Round 1.</b> No branch is dropped. Each one is ranked.</li>
<li><b>Round 2.</b> A name passes when it stands in the upper half of its own branch. A name in two branches is scored in each; it passes if it passes in one of its business branches. A name is <b>not judged</b> ({F["round2_not_judged"]}) when fewer than three of the five readings are on file, or when its sales are under 1% of its market value: it is listed and never ranked.</li>
<li><b>Round 3.</b> Timing never removes a company. It says now or wait: a name above the 70th percentile of its own year waits.</li>
<li><b>Finalists and champions.</b> The top three of a branch among those that passed round 2, and the first of them.</li>
</ul>
<h4>ROUND 1 — HOW A BRANCH IS RANKED</h4>
<p>A branch's heat is the average Geiger of its companies, each counted the same, on the scale of −1 to +1. "Its own year" is where today's heat sits among that branch's own last {RU["year"]} evenings: the 20th means it was colder on only one evening in five. The trend word is the allocation tool's own four-way read of the trend half and the momentum half of the Geiger.</p>
<p>The rank is the allocation tool's own rule, coldness times the turn: a bounce in a downtrend counts ×{RU["turn"]["improve"]}, an uptrend confirmed ×{RU["turn"]["go"]}, a pullback in an uptrend ×{RU["turn"]["buy"]}, a breakdown ×{RU["turn"]["avoid"]}. One thing differs from the tool as it runs today: coldness here is measured against the branch's own year (one minus its percentile), because you have said a level means something only against the instrument's own history. The tool measures coldness on one scale for every branch. The two orders are both in the data file.</p>
<h4>ROUND 2 — THE FIVE READINGS AND THEIR SHARE OF THE VOTE</h4>
<ul>
<li><b>Growth next year, {W["growth_next"]}% of the vote.</b> The next twelve months against the last twelve, revenue and earnings per share, each read separately and averaged.</li>
<li><b>Growth the year after, {W["growth_after"]}%.</b> The twelve months after that against the next twelve.</li>
<li><b>Comps, {W["comps"]}%.</b> The upside from the close to the centre of the comps range.</li>
<li><b>Estimate revisions, {W["revisions"]}%.</b> The analysts' number for the same next twelve months, the oldest stored copy against the newest. The Hub holds one copy from 11 August and daily copies since 2 October, so this is a 56-day change, not a trend.</li>
<li><b>Cash, {W["cash"]}%.</b> Free cash flow over market value. Left out for banks and insurers, where it is not a yardstick.</li>
</ul>
<p>Growth carries {W["growth_next"] + W["growth_after"]}% in all, the largest share. Each reading is read against the branch's own middle half, the way the knockout already does: 0 at the branch's 25th percentile, 1 at its 75th, and a missing reading counts as the middle. Scores are never compared across branches. When two names are within {RU["even"]} of each other, the one more washed out for itself goes first.</p>
<h4>GROWTH ON A CLEAN BASE</h4>
<p><b>The same calendar for everyone.</b> Companies end their years in different months. So a fiscal year in progress is blended with the next one by the share of it still to run, and every company is compared over the same twelve months. Micron's year has just begun, so its next twelve months are nearly all of fiscal 2027.</p>
<p><b>Last year's earnings</b> are taken on the analysts' footing: the four quarters as the street scored them, or, where a quarter is missing, the analysts' own row for that year ({sum(1 for n in N.values() if n.get("base_basis") == "row")} names).</p>
<p><b>One-off gains.</b> The rule is the estimates-versus-guidance study's: the consensus follows GAAP when the street's reported number is within 10% of the filed one; a quarter carries a one-off when other income is more than a quarter of its profit; and when the one-offs reach 15% of the year's earnings, the year is cleaned. That study read the pre-tax lines from the filings of six names. The Hub's tables hold operating income and net income only, so for the whole universe a quarter is marked when it shows more net income than operations could have left after an ordinary tax, and that is unusual for the company itself (measured against its own other quarters). On Alphabet this reads {one_off_ps("GOOGL")} a share for 2026 against the study's {FX["GOOGL"]["one_off_per_share"]}, and on Amazon {one_off_ps("AMZN")} against {FX["AMZN"]["one_off_per_share"]}: a little under, so the clean growth shown here is a little lower than that study's.</p>
<p>The base was cleaned for {len(one_off)} names: {E(", ".join(t for t, _ in one_off))}.</p>
<p><b>A base that cannot be grown from.</b> Earnings growth is not ranked when the base holds a loss, or a one-off year (one more than 40% under the years either side of it: {E(", ".join(dips))}). Those names are ranked on revenue growth for that year. A company whose sales are under 1% of its market value is priced on what it may become: growth from so small a base is not a rate, there is no comps number to lean on, and this process does not judge it. There are {len(vent)}: {E(", ".join(vent))}.</p>
<h4>ROUND 3 — TIMING AND LEVELS</h4>
<ul>
<li><b>Geiger and its own year.</b> The live reading, and where it sits among the name's own last {RU["year"]} evenings. The history is the Geiger-history study's replay of the Hub's seven rungs, run here for every company. On the 6 October evening the replay equals the live Geiger to four decimals on {ck["replay"]["equal_4dp"]} of {ck["replay"]["names"]} names; the largest gap is {ck["replay"]["max"]:.3f}.</li>
<li><b>Levels.</b> The 21, 50, 100 and 200-day averages of daily closes, and, for the {num_word(len(reviewed))} companies the Lab has reviewed, its lines under the Lab's own labels ({E(", ".join(reviewed))}).</li>
<li><b>Zones.</b> The confluence study's rule: two or more levels all within 1% of each other. For a reviewed name the zones are that study's. For every other name the same rule is run on its four averages.</li>
<li><b>Where it would be bought.</b> For a name that is not hot: the nearest level under the close, then the nearest zone. A name under all four of its averages has no level under it, so its 52-week low is given and the first average to win back.</li>
<li><b>Cools at.</b> For a name above its 70th percentile: the close at which its Geiger would read its own 70th again, found by running the Hub's own Geiger arithmetic on one more session ending at that close. "Back to its usual" is the same for its own median. One session is the fastest way down. If the name drifts sideways instead, it cools at a higher price, because its averages catch up.</li>
</ul>
<h4>OPEN THE LOOP</h4>
<ul>
<li><b>Blind spots</b> are finalists that are on none of RADAR, FAVORITES or LIKED. The champions are shown; the other finalists are folded under them.</li>
<li><b>Tunnel vision</b> is every name on your lists that fails round 2, with its branch, its place and the readings that put it there. The names on your lists that pass round 2 but are hot are in the green table.</li>
<li><b>Went green</b> is every company whose Geiger is above the 70th percentile of its own year: the seven you named, then the others on your lists, then the rest.</li>
</ul>
<h4>WHAT COULD BE WRONG</h4>
<ul>
<li><b>Half the comps numbers are fragile.</b> {F["fragile"]} of the {F["priced"]} priced centres move more than 10% when one peer is removed. That is why they count at half strength.</li>
<li><b>The comps extremes are not targets.</b> {sum(1 for u in ups if u > 100)} names read above +100% and {sum(1 for u in ups if u < -50)} below −50%. A reading is capped by the way it is scored (anything past the branch's 75th percentile scores the same), so an extreme cannot win a branch by its size, but the number itself should not be read as a price.</li>
<li><b>Memory and the data-centre landlords are thin.</b> Micron, SanDisk, Western Digital and Seagate are priced on three peers, and Equinix, Digital Realty and Iron Mountain on two. SK hynix, Samsung and Kioxia still have no figures.</li>
<li><b>A branch of unlike companies.</b> China, Europe, Canada, Asia-Pacific, Latin America and the Magnificent 7 are branches by place or size. A champion there is the best of an unlike group.</li>
<li><b>A champion can be the best of a weak branch.</b> The score says who leads a branch, not that the branch is worth owning. Round 1's rank says that.</li>
<li><b>Small branches.</b> In a branch of three or four names the upper half is two names, and one reading can decide it.</li>
<li><b>The trend word flips on small numbers.</b> A branch whose trend half reads −0.01 is a "bounce in a downtrend" and one at +0.01 an "uptrend": the trend and momentum numbers are printed beside the word.</li>
<li><b>Revisions are one 56-day step,</b> and for names that reported in between they carry the report. {sum(1 for n in N.values() if n["revisions"] is None)} names carry no revisions reading, nearly all because the Hub holds no August copy for them, only this week's.</li>
<li><b>The comps number is not cleaned.</b> For the {len(one_off)} names whose earnings base carries a one-off, the comps number still rests on the earnings as reported. Alphabet's and Amazon's trailing multiples look cheaper than they are.</li>
<li><b>Venture names are not judged, which is not a verdict.</b> The {len(vent)} companies with sales under 1% of their market value are left out of round 2. That says the process has nothing to measure, not that they are wrong to hold. Quantum has no champion for that reason.</li>
<li><b>A company with no earnings can still win a branch.</b> Its comps number is not used, so it stands on growth, revisions and cash against companies that are also judged on their price. Lucid leads autos that way. The comps column says "no earnings" where this applies.</li>
<li><b>The one-session cool-down.</b> Replayed on the last 20 sessions of each green name, the one-session read missed the real next-day Geiger by {ck["cool"]["median_gap"]} at the median and {ck["cool"]["p90_gap"]} nine times in ten ({ck["cool"]["sessions"]:,} sessions).</li>
{"<li><b>The Lab's installed line packs</b> are marked not yet approved by you in the Lab's own registry.</li>" if ck["confluence"].get("approved_by_alan") is False else ""}
<li><b>Foreign reporters.</b> For the {num_word(len(foreign))} that report in another currency ({E(", ".join(foreign))}) the one-off rule is not applied, and their filed earnings are not always on the analysts' footing.</li>
<li><b>"No earnings" covers two kinds of company.</b> A comps number is not used when earnings are not positive, trailing or expected. That is a loss-maker such as Nebius, and also a profitable company in a year of a large one-off charge, such as Gilead.</li>
</ul>
<h4>WHAT WAS NOT DONE</h4>
<ul>
<li>The holdings of the funds were not priced beyond the companies we already hold figures for: of {fh["distinct_holdings"]:,} different holdings, {fh["of_them_run"]} are ours; the other {fh["not_run_no_figures"]:,} have no figures on file.</li>
<li>Analyst price targets are not a reading in round 2.</li>
<li>Nothing was wired into the allocation tool or the Hub. The comps switches stay off on the Hub.</li>
<li>The comps reader takes whichever of two same-dated balance rows (annual or fourth quarter) the table returns first. Read from one snapshot, 25 of the 26 names the comps fix ran come out equal to the cent and one, AMETEK, 10 cents apart.</li>
</ul>
<h4>FILES</h4>
<p><code>data/knockout.json</code> holds every number on this page. The tools beside it rebuild it: <code>comps-universe.mjs</code> (the comps run), <code>fundamentals.py</code> (growth, the one-off rule, revisions, cash), <code>timing.py</code> (Geiger, levels, zones, cool-down), <code>rounds.py</code> (the rules), <code>knockout.py</code> (the join), <code>build_page.py</code> (this page).</p>
</details>"""
# ---------------------------------------------------------------- assemble
CSS = open(os.path.join(HERE, "page.css"), encoding="utf-8").read() + """
.frow{display:grid;grid-template-columns:290px minmax(0,1fr) 300px;gap:14px;align-items:center;padding:7px 0;border-bottom:1px solid #1a1a1e}
.frow:last-child{border-bottom:0}
.fl{font-size:11px;letter-spacing:.14em;font-weight:700;color:#c8c8cc}.fl small{display:block;font-weight:400;letter-spacing:.06em;color:#8c8c92;font-size:11px}
.fb{display:flex;gap:2px;height:20px}
.fleg{margin-top:4px;font-size:11px;color:#8c8c92;letter-spacing:.04em}.fleg span{margin-right:12px;white-space:nowrap}.fleg i,.seglab i{display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px}
.fn b{font-size:20px;font-weight:700;color:#c8c8cc;margin-right:10px}.fn span{font-size:11px;color:#8c8c92;letter-spacing:.04em}
@media (max-width:760px){.frow{grid-template-columns:minmax(0,1fr);gap:4px}.fn b{font-size:16px}}
"""
SCNAV = open(os.path.join(ROOT, "..", "..", "..", "scripts", "scnav-snippet.html"), encoding="utf-8").read().strip()
JS = """<script>(function(){var i=document.getElementById('find'),rows=[].slice.call(document.querySelectorAll('#allnames tbody tr'));if(!i)return;i.addEventListener('input',function(){var q=i.value.trim().toLowerCase().split(/\\s+/).filter(Boolean);rows.forEach(function(r){var k=r.getAttribute('data-k');r.style.display=q.every(function(w){return k.indexOf(w)>=0})?'':'none';});});})();</script>"""
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>The knockout — every company through the same rounds · 6 Oct 2026</title>
<style>{CSS}</style></head>
<body>
<header class="top"><span data-scnav-slot></span>
<div class="ttl">THE KNOCKOUT</div>
<div class="sub">EVERY COMPANY WITH FIGURES · THE SAME THREE ROUNDS · CLOSE OF TUE 6 OCT 2026</div></header>
<section id="funnel"><h2>THE FUNNEL</h2>
<div class="panel"><div class="ph">HOW MANY NAMES SURVIVE EACH ROUND</div>{funnel}</div></section>
<section id="lists"><h2>YOUR LISTS, THROUGH THE SAME ROUNDS</h2>
{lists_html}</section>
<section id="round1"><h2>ROUND 1 · WHERE THE MONEY SHOULD LOOK</h2>
{r1_html}</section>
<section id="champions"><h2>CHAMPIONS · ROUND 2 (WHAT) AND ROUND 3 (WHEN)</h2>
{champ_html}</section>
<section id="blind"><h2>OPEN THE LOOP · BLIND SPOTS</h2>
{blind_html}</section>
<section id="tunnel"><h2>OPEN THE LOOP · TUNNEL VISION</h2>
{tunnel_html}</section>
<section id="green"><h2>OPEN THE LOOP · WHAT WENT GREEN, AND WHERE IT COOLS</h2>
{green_html}</section>
<section id="all"><h2>EVERY NAME</h2>
{all_html}</section>
<section id="notrun"><h2>WHAT WAS NOT RUN, AND WHY</h2>
{skip_html}</section>
{specs}
{JS}
{SCNAV}
</body></html>
"""
open(os.path.join(ROOT, "KNOCKOUT.html"), "w", encoding="utf-8").write(page)
print("wrote KNOCKOUT.html", len(page), "bytes ·", len(N), "names ·", len(B), "branches")
