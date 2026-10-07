#!/usr/bin/env python3
"""Renders TREE-REVISION.html from the JSON beside it. Re-runnable: python3 deliverables/20261006/tree-revision/tools/render.py
Greys only (channels within 24, none above 210; checked below, loudly), body text 11px+ (the SVG too), pictures first,
explanations in PAGE SPECS at the bottom. Every number comes from a JSON file; three files may not exist yet and then
print "not run yet". The BACK / CLOSE pair is placed with scripts/inject-scnav.py's own BLOCK, ensure_slot and SNIPPET,
on this page only."""
import json, os, html, re, sys, importlib.util
from datetime import date
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.dirname(HERE); ROOT = os.path.abspath(os.path.join(D, "..", "..", ".."))
e = html.escape
def J(n, base=D):
    p = os.path.join(base, n)
    return json.load(open(p, encoding="utf-8")) if os.path.exists(p) else None
T = J("revised-tree.json"); FL = J("fund-links.json"); FR = J("frontier-rehome.json"); CG = J("consumer-gaps.json"); NF = J("next-funds.json"); RE = J("real-estate.json")
MIG = J("migration-dry-run.json"); NFD = J("next-funds-tree-dry-run.json"); SIT = J("next-sitting.json")
SE = J("steering-evidence.json"); FT = J("factor-tags.json"); LN = J("market-desk-lanes.json")      # the evening steering (6 Oct 18:10 – 19:20 ET)
TR1DRY = J("loader-dry-run.json", os.path.join(D, "..", "tree-adopted")) or {}
NOTRUN = "<p class='notrun'>not run yet</p>"

# ── the tree ────────────────────────────────────────────────────────────────────────────────────────────────────────
NODES = T["nodes"]; N = {n["cohort"]: n for n in NODES}; PLAN = T["plan"]; DIFF = T["diff"]
MEM = {}
for m in T["members"]: MEM.setdefault(m["cohort"], []).append(m)
KIDS = {}
for n in NODES: KIDS.setdefault(n["parent_1"], []).append(n["cohort"])
def under(c):
    out = [c]
    for k in KIDS.get(c, []): out += under(k)
    return out
def companies(c): return [m["ticker"] for m in MEM.get(c, []) if m["role"] == "member"]
def names_under(c): return sorted({t for x in under(c) for t in companies(x)})
def cohorts_under(c): return [x for x in under(c)[1:] if N[x]["kind"] == "cohort"]
def funds_in(c): return [m["ticker"] for x in under(c) for m in MEM.get(x, []) if m["role"] == "index_fund"]
def short(label): return label.split(" (")[0]
SECT = [n["cohort"] for n in NODES if n["layer"] == 2]
HEADS = [n["cohort"] for n in NODES if n["layer"] == 3]
TOPH = [h for h in HEADS if N[N[h]["parent_1"]]["layer"] < 3]; SUBH = [h for h in HEADS if h not in TOPH]
SPDR = {(l["fund_node"], l["cohort"]): l for l in T["links"] if l["family"] == "SPDR"}
def sect_idx(h): return SECT.index(N[h]["parent_1"]) if N[h]["parent_1"] in SECT else len(SECT)
def w_first(h): l = SPDR.get((N[h]["parent_1"], h)); return l["fund_weight_pct"] if l else 0
TOPH.sort(key=lambda h: (sect_idx(h), -w_first(h)))          # by first-parent sector, the bigger share of that fund first
ORDER = []
for h in TOPH: ORDER.append(h); ORDER += [s for s in SUBH if N[s]["parent_1"] == h]
PICK = {"on": "ON", "off": "OFF", "undecided": "UNDECIDED"}
def picktag(n): return PICK[n["hub_pick"]] + (" · IN PART" if "PARTLY" in (n.get("hub_pick_note") or "").upper() else "")
def f2(x): return "—" if x is None else f"{x:.2f}".replace("-", "−")
def p1(x): return "" if x is None else f"{x:.1f}"
def dmy(s): d = date.fromisoformat(s[:10]); return f"{d.day} {d.strftime('%b %Y')}"
def tbl(heads, rows, minw=760):
    th = "".join(f"<th class='r'>{h[1:]}</th>" if h.startswith(">") else f"<th>{h}</th>" for h in heads)
    return f"<div class='panel wrap'><table style='min-width:{minw}px'><thead><tr>{th}</tr></thead><tbody>\n" + "\n".join(rows) + "\n</tbody></table></div>"
def tr(*cells): return "<tr>" + "".join(c if c.startswith("<td") else f"<td>{c}</td>" for c in cells) + "</tr>"
def R(x): return f"<td class='r'>{x}</td>"

# ── 2 · the picture ─────────────────────────────────────────────────────────────────────────────────────────────────
C_BAND = ["#161718", "#1a1b1c"]; C_BOX = "#222426"; C_EDGE = "#4a4c4e"; C_WIRE = "#6c6e70"; C_INK = "#c4c6c8"; C_DIM = "#8a8c8e"; C_BRIGHT = "#ced0d2"
def c_line(p): return "#aeb0b2" if p >= 50 else "#868a8c" if p >= 10 else "#626466"
def wrap(s, maxc):
    out, cur = [], ""
    for w in s.split(" "):
        if cur and len(cur) + 1 + len(w) > maxc: out.append(cur); cur = w
        else: cur = (cur + " " + w).strip()
    return out + ([cur] if cur else [])
def tree_svg():
    W = 1590; GUT = 112; LANE = GUT + 8; ML = GUT + 22; MR = 12; CWD = 6.75; SCALE = 0.19
    Y = dict(m=14, il=66, rail1=112, sets=126, b1=52, b2=186, rail2=212, sec=224, sech=56, head=540, hh=58, subdy=30, b3=292, rail3=642, b4=656, cnt=676, mag=704, stub=12, tail=84)
    H = 750
    bg, wires, fan, boxes, labels = [], [], [], [], []
    def text(x, y, s, cls="t", anchor="middle", w=None):
        return f'<text x="{x:.1f}" y="{y:.1f}" class="{cls}" text-anchor="{anchor}"' + (f' data-w="{w:.0f}"' if w else "") + f'>{e(s)}</text>'
    def rect(x, y, w, h, fill=C_BOX, stroke=C_EDGE, extra=""): return f'<rect x="{x:.1f}" y="{y:.1f}" width="{w:.1f}" height="{h:.1f}" fill="{fill}" stroke="{stroke}" {extra}/>'
    def wire(pts, dash=False): return f'<polyline points="{" ".join(f"{x:.1f},{y:.1f}" for x, y in pts)}" fill="none" stroke="{C_WIRE}" stroke-width="1.5"' + (' stroke-dasharray="5 4"' if dash else "") + "/>"
    # bands and their gutter labels
    bands = [(0, Y["b1"], "THE MARKET"), (Y["b1"], Y["b2"], "INDEX LAYER"), (Y["b2"], Y["b3"], "SECTOR FUNDS"), (Y["b3"], Y["b4"], "THEME HEADINGS"), (Y["b4"], H, "COHORTS")]
    for i, (a, b, name) in enumerate(bands):
        bg.append(f'<rect x="0" y="{a}" width="{W}" height="{b - a}" fill="{C_BAND[i % 2]}"/>')
        ly = a + 18 if i != 3 else Y["head"] + 14
        labels += [text(12, ly, f"LAYER {i}", "t d", "start"), text(12, ly + 14, name, "t b", "start")]
    labels += [text(12, Y["b3"] + 70 + 14 * i, s, "t d", "start") for i, s in enumerate(["LINE THICKNESS", "= SHARE OF THE", "SECTOR'S FUND"])]
    # layer 3: heading boxes, sub-headings beside their parent and lower
    geo = {}
    for h in ORDER:
        lines = wrap(N[h]["label"], 13); tag = picktag(N[h])
        geo[h] = dict(lines=lines, tag=tag, w=max(max([len(x) for x in lines] + [len(tag) + 2]) * CWD + 14, 78))
    gap = 8; extra = (W - MR - ML - sum(g["w"] for g in geo.values()) - gap * (len(ORDER) - 1)) / len(ORDER)
    x = ML
    for h in ORDER:
        g = geo[h]; g["w"] += max(extra, 0); g["x"] = x; g["cx"] = x + g["w"] / 2; g["y"] = Y["head"] + (Y["subdy"] if h in SUBH else 0); x += g["w"] + gap
    # layer 2: the sector boxes, spread over the headings that hang from a sector
    last = max(i for i, h in enumerate(ORDER) if sect_idx(h if h in TOPH else N[h]["parent_1"]) < len(SECT))
    span_r = geo[ORDER[last]]["x"] + geo[ORDER[last]]["w"]; pitch = (span_r - ML) / len(SECT); sw = pitch - 10
    sg = {s: dict(x=ML + i * pitch + 5, cx=ML + i * pitch + 5 + sw / 2) for i, s in enumerate(SECT)}
    # layer 1: the index sets. The set a lone cohort hangs from goes first, the one a heading hangs from goes last.
    sets = list(KIDS.get("INDEX_LAYER", []))
    lone = [s for s in sets if any(N[k]["layer"] == 4 for k in KIDS.get(s, []))]; headed = [s for s in sets if any(N[k]["layer"] == 3 for k in KIDS.get(s, []))]
    sets = lone + [s for s in sets if s not in lone + headed] + headed
    seq = []
    for s in sets:
        sub = [k for k in KIDS.get(s, []) if N[k]["layer"] == 1]
        seq += (sub + [s]) if s in headed else ([s] + sub)
    bw = min(150, (W - MR - ML) / len(seq) - 8); step = (W - MR - bw - ML) / max(len(seq) - 1, 1)
    ig = {s: dict(x=ML + i * step, cx=ML + i * step + bw / 2) for i, s in enumerate(seq)}
    # layer 0 and the index layer's own box
    cxm = (ML + W - MR) / 2
    boxes += [rect(cxm - 75, Y["m"], 150, 28), text(cxm, Y["m"] + 18, N["MARKET"]["label"], "t b"), rect(cxm - 75, Y["il"], 150, 28), text(cxm, Y["il"] + 18, N["INDEX_LAYER"]["label"], "t b")]
    wires += [wire([(cxm, Y["m"] + 28), (cxm, Y["il"])]), wire([(cxm, Y["il"] + 28), (cxm, Y["rail1"])])]
    railed = [s for s in seq if N[s]["parent_1"] == "INDEX_LAYER"]
    wires.append(wire([(ig[railed[0]]["cx"], Y["rail1"]), (ig[railed[-1]]["cx"], Y["rail1"])]))
    for s in seq:
        g = ig[s]; nf = len([m for m in MEM.get(s, []) if m["role"] == "index_fund"]) or len(funds_in(s))
        byrule = N[s]["kind"] == "cohort"                              # a branch whose members are companies assigned by rule
        boxes += [rect(g["x"], Y["sets"], bw, 44, extra='stroke-dasharray="4 3"' if byrule else ""), text(g["cx"], Y["sets"] + 18, short(N[s]["label"]), "t b", w=bw - 8),
                  text(g["cx"], Y["sets"] + 34, f"{len(companies(s))} names by rule" if byrule else f"{nf} funds", "t d", w=bw - 6)]
        if s in railed: wires.append(wire([(g["cx"], Y["rail1"]), (g["cx"], Y["sets"])]))
        else: pg = ig[N[s]["parent_1"]]; wires.append(wire([(min(g["x"] + bw, pg["x"] + bw), Y["sets"] + 22), (max(g["x"], pg["x"]), Y["sets"] + 22)]))
    # sector funds heading → the eleven sector boxes
    sf = N[SECT[0]]["parent_1"]
    wires += [wire([(ig[sf]["cx"], Y["sets"] + 44), (ig[sf]["cx"], Y["rail2"])]), wire([(sg[SECT[0]]["cx"], Y["rail2"]), (sg[SECT[-1]]["cx"], Y["rail2"])])]
    for s in SECT:
        g = sg[s]; name = N[s]["label"].split(" · ")[0]; ls = wrap(name, 14)
        wires.append(wire([(g["cx"], Y["rail2"]), (g["cx"], Y["sec"])]))
        boxes += [rect(g["x"], Y["sec"], sw, Y["sech"]), text(g["cx"], Y["sec"] + 18, N[s]["spine_fund"], "t tk")]
        boxes += [text(g["cx"], Y["sec"] + 34 + 13 * i - (0 if len(ls) > 1 else -6), l, "t", w=sw - 6) for i, l in enumerate(ls)]
    # the weighted lines: sector fund → heading, every link of 1% or more, plus each heading's first parent
    lines = []
    for h in ORDER:
        for s in SECT:
            l = SPDR.get((s, h)); pct = l["fund_weight_pct"] if l else 0; first = N[h]["parent_1"] == s
            if pct >= 1 or first: lines.append(dict(s=s, h=h, pct=pct, first=first, w=max(1.3, pct * SCALE)))
    def alloc(ws, cx, maxw):
        slot = [max(w, 4) for w in ws]; g = 5.0
        if sum(slot) + g * (len(slot) - 1) > maxw and len(slot) > 1: g = max(1.0, (maxw - sum(slot)) / (len(slot) - 1))
        x = cx - (sum(slot) + g * (len(slot) - 1)) / 2; out = []
        for s in slot: out.append(x + s / 2); x += s + g
        return out
    for s in SECT:
        ls = sorted([l for l in lines if l["s"] == s], key=lambda l: geo[l["h"]]["cx"])
        for l, xx in zip(ls, alloc([l["w"] for l in ls], sg[s]["cx"], sw - 10)): l["x1"] = xx
    for h in ORDER:
        ls = sorted([l for l in lines if l["h"] == h], key=lambda l: sg[l["s"]]["cx"])
        for l, xx in zip(ls, alloc([l["w"] for l in ls], geo[h]["cx"], geo[h]["w"] - 10)): l["x2"] = xx
        for j, l in enumerate(sorted([l for l in ls if l["pct"] >= 10], key=lambda l: -l["pct"])): l["d"] = 15 + 22 * j
    y1 = Y["sec"] + Y["sech"]
    for l in sorted(lines, key=lambda l: -l["w"]):
        y2 = geo[l["h"]]["y"]; ya = y1 + Y["stub"]; yb = Y["head"] - Y["tail"]; k = 0.5 * (yb - ya); col = c_line(l["pct"])
        dash = "" if l["first"] else f' stroke-dasharray="{max(6, l["w"] * 0.9):.0f} {max(5, l["w"] * 0.6):.0f}"'
        fan.append(f'<path d="M{l["x1"]:.1f},{y1} V{ya} C{l["x1"]:.1f},{ya + k:.1f} {l["x2"]:.1f},{yb - k:.1f} {l["x2"]:.1f},{yb} V{y2}" fill="none" stroke="{col}" stroke-width="{l["w"]:.1f}"{dash}><title>{e(N[l["s"]]["spine_fund"])} → {e(N[l["h"]]["label"])}: {l["pct"]:.1f}% of the fund</title></path>')
        if "d" in l: labels.append(text(l["x2"], y2 - l["d"] + 4, f"{l['pct']:.0f}%", "t b halo"))
    # heading boxes, their pick tags, and the counts in the cohort band
    for h in ORDER:
        g = geo[h]; n = N[h]; ls = g["lines"]; y = g["y"]
        boxes.append(rect(g["x"], y, g["w"], Y["hh"], extra='stroke-width="1.4"' if h in TOPH else ""))
        boxes += [text(g["cx"], y + (17 if len(ls) > 1 else 23) + 14 * i, l, "t b", w=g["w"] - 6) for i, l in enumerate(ls)]
        tw = (len(g["tag"]) + 2) * CWD
        boxes += [rect(g["cx"] - tw / 2, y + 37, tw, 16, fill=C_BAND[0], stroke=C_WIRE if n["hub_pick"] != "undecided" else C_EDGE, extra='stroke-dasharray="3 3"' if n["hub_pick"] == "undecided" else ""),
                  text(g["cx"], y + 49, g["tag"], "t b" if n["hub_pick"] == "on" else "t" if n["hub_pick"] == "off" else "t d")]
        labels += [text(g["cx"], Y["cnt"], f"{len(cohorts_under(h))} cohorts", "t"), text(g["cx"], Y["cnt"] + 14, f"{len(names_under(h))} names", "t d")]
        subs = [s for s in SUBH if N[s]["parent_1"] == h]
        if subs:
            wires.append(wire([(g["cx"], y + Y["hh"]), (g["cx"], Y["rail3"]), (geo[subs[-1]]["cx"], Y["rail3"])]))
            wires += [wire([(geo[s]["cx"], Y["rail3"]), (geo[s]["cx"], geo[s]["y"] + Y["hh"])]) for s in subs]
        if N[h]["parent_1"] in ig:                                    # a heading that hangs from an index set, not a sector
            pg = ig[N[h]["parent_1"]]; xx = min(max(g["cx"], pg["x"] + 8), pg["x"] + bw - 8)
            wires.append(wire([(xx, Y["sets"] + 44), (xx, y)]))
    # the cohorts that hang straight from an index set (MAGNIFICENT 7)
    my = Y["mag"]; kx = ML
    for s in lone:
        for c in [k for k in KIDS.get(s, []) if N[k]["layer"] == 4]:
            b = next((l for l in T["links"] if l["cohort"] == c and l["family"] == "BROAD" and l["fund"] == N[s]["spine_fund"]), None)
            s_txt = f"{N[c]['label']} · {len(companies(c))} names" + (f" · {b['fund_weight_pct']:.1f}% of {b['fund']}" if b else "") + f" · {picktag(N[c])}"
            mw = len(s_txt) * CWD + 20
            boxes += [rect(ML, my, mw, 30), text(ML + mw / 2, my + 19, s_txt, "t b", w=mw - 6)]
            wires.append(wire([(ig[s]["x"], Y["sets"] + 22), (LANE, Y["sets"] + 22), (LANE, my + 15), (ML, my + 15)])); kx = ML + mw + 34
    # the key
    ky = Y["mag"] + 15
    def key_line(x, w, dash, lab):
        out = [f'<line x1="{x}" y1="{ky}" x2="{x + 34}" y2="{ky}" stroke="{c_line(w / SCALE)}" stroke-width="{max(1.3, w):.1f}"' + (' stroke-dasharray="6 5"' if dash else "") + "/>", text(x + 42, ky + 4, lab, "t", "start")]
        return out, x + 42 + len(lab) * CWD + 26
    for w, dash, lab in [(3, False, "first parent"), (3, True, "also holds 1% or more")] + [(p * SCALE, False, f"{p}%") for p in (5, 25, 50, 90)]:
        o, kx = key_line(kx, w, dash, lab); labels += o
    labels.append(text(kx - 8, ky + 4, "of the sector's fund", "t d", "start"))
    svg = f'<svg class="tree" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {W} {H}" width="{W}" height="{H}" role="img" aria-label="The revised tree in five layers">' + "".join(bg + wires + fan + boxes + labels) + "</svg>"
    return svg, len(lines)
SVG, NLINES = tree_svg()

def walk(c, depth, out):
    n = N[c]; ms = MEM.get(c, []); comp = [m for m in ms if m["role"] == "member"]; funds = [m for m in ms if m["role"] != "member"]; pend = [m["ticker"] for m in ms if m["status"] == "pending_admission"]
    bits = []
    if comp: bits.append(f"{len(comp)} companies")
    if funds: bits.append(f"{len(funds)} funds")
    if n["parent_2"]: bits.append("also under " + N[n["parent_2"]]["label"])
    if n["spine_fund"]: bits.append("measured against " + n["spine_fund"] + (f" → {n['spine_fund_next']} once served" if n["spine_fund_next"] else ""))
    elif n["spine_fund_next"]: bits.append(f"measured against {n['spine_fund_next']} once served")
    if pend: bits.append("waiting: " + " ".join(pend))
    bits.append("pick " + picktag(n) if n["layer"] >= 3 else "not in the picks")
    out.append("  " * depth + ("" if depth == 0 else "└ ") + n["label"] + "   · " + " · ".join(bits))
    for k in KIDS.get(c, []): walk(k, depth + 1, out)
FULL = []; walk("MARKET", 0, FULL)

# ── 3 · cross-relationships ─────────────────────────────────────────────────────────────────────────────────────────
def heat(p): v = round(30 + min(p, 100) / 100 * 62); return f"#{v:02x}{v + 1:02x}{v + 2:02x}"
LONE = [c for c in KIDS.get("IDX_US_BROAD", []) if N[c]["layer"] == 4]
grid = []
for h in ORDER + LONE:
    cells = []
    for s in SECT:
        l = SPDR.get((s, h)); cls = " p1" if N[h]["parent_1"] == s else " p2" if N[h]["parent_2"] == s else ""
        if l and l["fund_weight_pct"] > 0: cells.append(f"<td class='r h{cls}' style='background:{heat(l['fund_weight_pct'])}' title='{e(l['top_names'])} · {l['names_held']} of {l['node_names']} names'>{l['fund_weight_pct']:.1f}</td>")
        else: cells.append(f"<td class='r h{cls}'>{'none' if cls else ''}</td>")
    grid.append(f"<tr><td>{'└ ' if h in SUBH else ''}<b>{e(N[h]['label'])}</b></td>" + "".join(cells) + "</tr>")
GRID = "<div class='panel wrap'><table class='grid' style='min-width:1040px'><thead><tr><th>% OF EACH SECTOR FUND</th>" + "".join(f"<th class='r'><b>{e(N[s]['spine_fund'])}</b><br>{e(N[s]['label'].split(' · ')[0].lower())}</th>" for s in SECT) + "</tr></thead><tbody>\n" + "\n".join(grid) + "\n</tbody></table></div>"
FSEC = {v["SPDR"]["fund"]: v["SPDR"] for v in FL["sector_funds"].values()}
by_fund = []
for s in SECT:
    f = N[s]["spine_fund"]; ls = sorted([l for l in T["links"] if l["family"] == "SPDR" and l["fund_node"] == s and N[l["cohort"]]["kind"] == "cohort"], key=lambda l: -l["fund_weight_pct"])[:6]
    x = FSEC.get(f, {})
    by_fund.append(tr(f"<b>{e(f)}</b><br><span class='small'>{e(N[s]['label'].split(' · ')[0].lower())}</span>", R(f"{x['coverage_pct']:.1f}%" if x else "—"),
        "<br>".join(f"{e(N[l['cohort']]['label'])} <b>{l['fund_weight_pct']:.1f}%</b> <span class='small'>{l['names_held']} of {l['node_names']} names</span>" for l in ls),
        " · ".join(f"<b>{e(b['ticker'])}</b> {b['fund_weight_pct']:.2f}%" + ("" if b.get("served") else " <span class='small'>not served</span>") for b in x.get("biggest_names_in_no_topic_cohort", [])[:3]) or "none"))
def side(x): return f"{e(x['sector'])} · {e(x['vanguard_fund'])} holds {x['vanguard_names']} · {x['spdr_weight_pct']:.2f}% of {e(x['spdr_fund'])}" if x else "—"
cross = [tr(f"<b>{e(c['label'])}</b>", R(c["names"]), side(c["home"]), side(c["second"])) for c in FL["cross_sector_cohorts"]]

# ── 4 · where FRONTIER went ─────────────────────────────────────────────────────────────────────────────────────────
GONE = next(n for n in DIFF["nodes_removed"] if n["kind"] == "heading")
MOVED = [c["cohort"] for c in DIFF["nodes_changed"] if c["before"].get("parent_1") == GONE["cohort"]]
BEFORE = {c["cohort"]: c["before"] for c in DIFF["nodes_changed"]}
before_txt = [N["MARKET"]["label"], "└ " + GONE["label"]]
for c in MOVED:
    b2 = BEFORE[c].get("parent_2", N[c]["parent_2"])
    before_txt.append(f"  └ {N[c]['label']}   · {len(companies(c))} companies" + (f" · also under {N[b2]['label']}" if b2 else ""))
keep = set()
for c in MOVED:
    x = c
    while x: keep.add(x); x = N[x]["parent_1"]
    keep.update(KIDS.get(N[c]["parent_1"], []) if N[N[c]["parent_1"]]["cohort"] not in BEFORE or N[c]["parent_1"] not in [n["cohort"] for n in DIFF["nodes_changed"]] else [])
after_txt = []
def walk_keep(c, depth):
    n = N[c]
    if c not in keep: return
    note = f"   ◂ from {GONE['label']}" if c in MOVED else "   ◂ new" if c in [x["cohort"] for x in DIFF["nodes_added"]] and n["layer"] >= 3 else ""
    after_txt.append("  " * depth + ("" if depth == 0 else "└ ") + n["label"] + (f"   · {len(companies(c))} companies" if companies(c) else "") + (f" · also under {N[n['parent_2']]['label']}" if n["parent_2"] and n["layer"] == 4 else "") + note)
    for k in KIDS.get(c, []): walk_keep(k, depth + 1)
walk_keep("MARKET", 0)
G5 = FR["5_grouping_tests"]
def test_for(ids): return next((t for t in G5 if set(t["blocks"]) == set(ids)), None)
TX = test_for(MOVED); SHELF = next((N[c]["parent_1"] for c in MOVED if N[c]["parent_1"] in [n["cohort"] for n in DIFF["nodes_added"]]), None)
TA = test_for(KIDS.get(SHELF, [])) if SHELF else None
PF = FR["1_and_3_baskets_vs_candidate_parent_funds"]
def sector_fund(c):
    x = c
    while x and x not in SECT: x = N[x]["parent_1"]
    return N[x]["spine_fund"] if x else None
fr_rows = []
for c in MOVED:
    n = N[c]; fd = {f["fund"]: f for f in PF[c]["funds"]}; sf = sector_fund(c); top = PF[c]["closest_raw"][0]
    ins = TX["raw"]["inside_each_block_same_days"][c]["avg_pair_corr"] if TX else None; ins_r = TX["resid"]["inside_each_block_same_days"][c]["avg_pair_corr"] if TX else None
    def pair(f): return f"<b>{e(f)}</b> {f2(fd[f]['corr_raw'])} raw · {f2(fd[f]['corr_resid'])} after" if f in fd else "—"
    fr_rows.append(tr(f"<b>{e(n['label'])}</b>", e(N[n["parent_1"]]["label"]), e(N[n["parent_2"]]["label"]) if n["parent_2"] else "—",
        f"<b>{f2(ins)}</b> raw · {f2(ins_r)} after<br><span class='small'>its sector {f2(TX['raw']['sector_avg_pair_corr'])} raw · {f2(TX['resid']['sector_avg_pair_corr'])} after</span>" if TX else "—",
        pair(sf), pair(top), f"<span class='small'>{e(n['parent_why'] or '')}</span>"))
btw = []
if TX:
    btw += [tr(e(" × ".join(N[x]["label"] for x in k.split(" x "))), R(f2(v["avg_pair_corr"])), R(f2(TX["resid"]["between_blocks"][k]["avg_pair_corr"]))) for k, v in TX["raw"]["between_blocks"].items()]
    btw.append(tr(f"<b>all four old {e(GONE['label'])} cohorts, between cohorts</b>", R(f"<b>{f2(TX['raw']['all_cross_block_pairs_avg'])}</b>"), R(f2(TX["resid"].get("all_cross_block_pairs_avg")))))
if TA: btw.append(tr(f"<b>the {e(N[SHELF]['label'])} shelf's {len(TA['blocks'])} cohorts, between cohorts</b>", R(f"<b>{f2(TA['raw']['all_cross_block_pairs_avg'])}</b>"), R(f2(TA["resid"].get("all_cross_block_pairs_avg")))))

# ── 5 · consumer ────────────────────────────────────────────────────────────────────────────────────────────────────
CS = CG["revised_consumer_subtree"]; MT = {c["id"]: c["moves_together"] for c in CS["cohorts_unchanged"] + CS["sub_heading"]["cohorts"] + CS.get("second_parent_unchanged", []) if c.get("moves_together")}
def mt_txt(c):
    m = MT.get(c)
    if not m or m.get("avg_pair_corr") is None: return "one served name: no number"
    if m.get("kind") == "pair": return f"a pair, one number: {f2(m['avg_pair_corr'])}"
    return f"moves together {f2(m['avg_pair_corr'])} (its sector {f2(m.get('sector_avg_pair_corr'))})"
cons = []
def walk_c(c, depth):
    n = N[c]; t = companies(c)
    if n["kind"] == "cohort": cons.append("  " * depth + "└ " + f"{n['label']}   · {len(t)} names · {mt_txt(c)}"); cons.append("  " * depth + "    " + " ".join(t))
    else: cons.append("  " * depth + ("" if depth == 0 else "└ ") + n["label"] + f"   · {len(cohorts_under(c))} cohorts · {len(names_under(c))} names" + (f" · also under {N[n['parent_2']]['label']}" if n["parent_2"] else ""))
    for k in KIDS.get(c, []): walk_c(k, depth + 1)
CONS_ID = CS["heading"]["id"]; walk_c(CONS_ID, 0)
for n in NODES:
    if n["parent_2"] == CONS_ID: cons.append(f"  ┄ also here, first under {N[n['parent_1']]['label']}: {n['label']}   · {len(companies(n['cohort']))} names · {mt_txt(n['cohort'])}")
cand = []; seen = []
for k in T["candidates"]:
    if k["cohort"] not in seen:
        seen.append(k["cohort"]); nn = sum(1 for x in T["candidates"] if x["cohort"] == k["cohort"])
        cand.append(f"<tr class='grp'><td colspan='5'><b>{e(N[k['cohort']]['label'])}</b> · {nn} candidates · served there today: {len(companies(k['cohort']))}</td></tr>")
    cand += [tr(f"<b>{e(x['ticker'])}</b>", "in the S&amp;P 500" if x["in_sp500"] else "outside it", R(f"{x['sp500_weight_pct']:.3f}%" if x["sp500_weight_pct"] is not None else ""), e(x["basis"]), e(x["gap"])) for x in T["candidates"] if x["cohort"] == k["cohort"] and x is k]

# ── 6 · picks ───────────────────────────────────────────────────────────────────────────────────────────────────────
def src(n):
    note = re.sub(r"^Alan, 6 Oct( ~[\d:]+ ET)?: ", "", n.get("hub_pick_note") or "").replace("he has not said", "not yet said"); s = n["hub_pick_source"]
    if s == "named": return "named by you · " + note
    if s == "inherited": return "follows its heading · " + note.replace("follows ", "")
    if s == "parents_disagree": return note
    return "not said" + ("" if note == "not named on 6 Oct" else " · " + note)
picks = {}
for k in ("on", "off", "undecided"):
    ns = sorted([n for n in NODES if n["hub_pick"] == k and n["layer"] >= 3], key=lambda n: (n["layer"], NODES.index(n))); idx = [n for n in NODES if n["hub_pick"] == k and n["layer"] < 3]
    li = "".join(f"<li>{'<b>' + e(n['label']) + '</b>' if n['layer'] == 3 else e(n['label'])}<span class='small'> — {e(src(n))}</span></li>" for n in ns)
    if idx: li += f"<li>the index layer, {len(idx)} nodes<span class='small'> — {e(idx[0].get('hub_pick_note') or 'not said')}</span></li>"
    picks[k] = f"<div class='panel'><h3>{PICK[k]} · {PLAN['hub_pick'].get(k, 0)}</h3><ul class='plain'>{li}</ul></div>"

# ── 7 · the next fund batch ─────────────────────────────────────────────────────────────────────────────────────────
def basis(s):
    u = s.upper(); out = [w for k, w in (("VERIFIED", "verified"), ("MEASURED", "measured"), ("MEMORY", "from memory")) if k in u]
    return " + ".join(out) or e(s[:24])
groups = list(NF["counts"].get("admit_next_by_read", {})) or []
for a in NF["admit_next"]:
    if a["strengthens"] not in groups: groups.append(a["strengthens"])
nf_rows = []
for g in groups:
    rows = [a for a in NF["admit_next"] if a["strengthens"] == g]
    nf_rows.append(f"<tr class='grp'><td colspan='7'><b>{e(g.replace('_', ' '))}</b> · {len(rows)} funds</td></tr>")
    for a in rows:
        where = short(N[a["tree_node_id"]]["label"]) if a.get("tree_node_id") in N else a.get("tree_node", "")
        if a.get("spine_for") in N: where += f"<br><span class='small'>{'takes over as' if a.get('takes_over_spine') else 'a second line beside'} the fund {e(N[a['spine_for']]['label'])} is measured against</span>"
        nf_rows.append(tr(f"<b>{e(a['ticker'])}</b>", e(a["name"]) + f"<br><span class='small'>{e(a['tracks'])}</span>", e(re.sub(r"^adds:\s*", "", a["adds"])), f"<b>{e(a['pairs_with'])}</b><br><span class='small'>{e(a['read'])}</span>", e(a["liquidity"].lower()), f"<span title='{e(a['facts_basis'])}'>{basis(a['facts_basis'])}</span>", where))
pr = []
for p in NF["pair_reads"]:
    m = p.get("measured_local")
    pr.append(tr(f"<b>{e(p['ratio'])}</b><br><span class='small'>{e(p['name'])}</span>", e(p["rising_means"]), e(p["falling_means"]), e(p["needs_new_fund"]),
        R(f"{m['ratio_change_126_pct']:+.2f}%".replace("-", "−") if m else "not measured"), R(f"{m['ratio_change_20_pct']:+.2f}%".replace("-", "−") if m else "not measured")))
def few(s, n=96): return s if len(s) <= n else s[:n].rsplit(" ", 1)[0] + " …"
ls_rows = [tr("LATER" if k == "later" else "SKIP", f"<b>{e(a['ticker'])}</b>", e(a["name"]), e(few(a["why"]))) for k in ("later", "skip") for a in NF[k]]
if SIT:
    fr_, to_ = (SIT.get("from") or {}), (SIT.get("to") or {}); fn = SIT.get("funds"); nfn = len(fn) if isinstance(fn, (list, dict)) else fn
    cb = SIT.get("count_before", fr_.get("count", "—")); ca = SIT.get("count_after", to_.get("count", "—")); dg = str(SIT.get("digest_after", to_.get("digest", "")))
    hid = f" · all computed-but-not-shown funds: {fr_['geiger_only']} → {to_['geiger_only']}" if "geiger_only" in fr_ and "geiger_only" in to_ else ""
    SITTING = f"<div class='kpi'><div><b>{cb} → {ca}</b><span>names before → after this batch's sitting · rehearsed on throw-away copies, not applied</span></div><div><b>{e(dg[:8])}…</b><span>the new digest (rehearsal)</span></div><div><b>{nfn}</b><span>computed, not shown: no row on the board{hid}</span></div><div><b>{e(str(SIT.get('status', '—')).replace('_', ' ').lower())}</b><span>not for the coming sitting: that is the 7 → 8 Oct night ({e(str(fr_.get('count', '')))} is what it leaves)</span></div></div>" + (f"<p class='cap'>{e(SIT['rebased']['why'])} First rehearsal, not to be used: {SIT['rebased']['superseded_first_rehearsal']['from']} → {SIT['rebased']['superseded_first_rehearsal']['to']}. {e(SIT['rebased']['rule'])}</p>" if SIT.get('rebased') else "")
else: SITTING = NOTRUN.replace("not run yet", "the next sitting's dry run: not run yet (next-sitting.json)")

# ── 8 · real estate ─────────────────────────────────────────────────────────────────────────────────────────────────
xl = [tr(e(k), R(f"<b>{v:.1f}%</b>" if k != "check_sum" else f"{v:.1f}%")) for k, v in RE["xlre_split_pct"].items()]
RCOLS = [("XLRE", "THE PROPERTY FUND XLRE"), ("TLT", "LONG BONDS TLT"), ("IEF", "MID BONDS IEF"), ("SMH", "CHIPS SMH"), ("AI_SERVERS_DC_KIT", "AI SERVER MAKERS"), ("SPY", "THE MARKET SPY")]
def rlabel(k): b = RE["baskets"].get(k); base = N[k]["label"] if k in N else k; return f"<b>{e(base)}</b>" + (f"<br><span class='small'>{e(' '.join(b['members']))}</span>" if b and k in N else "")
rc = [tr(rlabel(k), *[R(f2(v.get(c))) for c, _ in RCOLS]) for k, v in RE["correlations"].items()]
WF = list(RE["weights_pct"]["funds"])
def where_tree(t): return "; ".join(f"{N[c]['label']} (under {N[N[c]['parent_1']]['label']}" + (f", also {N[N[c]['parent_2']]['label']}" if N[c]["parent_2"] else "") + ")" for c in RE["labels"][t]["tree_cohorts"] if c in N)
rw = [tr(f"<b>{t}</b><br><span class='small'>{e(RE['labels'][t]['name'])}</span>", e(RE["labels"][t].get("gics_sub_industry") or RE["labels"][t]["fmp_industry"]), e(where_tree(t)), *[R(f"{RE['weights_pct']['table'][t][f]:.2f}%") for f in WF]) for t in ("EQIX", "DLR", "IRM") if t in RE["weights_pct"]["table"]]
DEFS = [("Why P/E misleads", "A property company's reported profit is cut every year by a large depreciation charge on buildings that usually hold or gain value, so price divided by earnings makes it look far dearer than it is."),
    ("FFO (funds from operations)", "Profit with that building depreciation added back and one-off gains from selling properties taken out: the industry's standard measure of what the properties earn."),
    ("AFFO (adjusted FFO)", "FFO minus the routine spending that keeps the buildings rentable, with accounting-only rent smoothing removed: the closest thing to the cash that can actually be paid out."),
    ("Price / FFO and price / AFFO", "The share price divided by FFO or AFFO per share: the property company's stand-in for a P/E, read against its own history and against landlords of the same kind."),
    ("NAV and premium or discount", "Net asset value is what the properties would sell for today minus the debt, per share; a price above it is a premium (growth is expected), a price below it a discount."),
    ("Cap rate and its gap over the 10-year Treasury yield", "A property's yearly rent after running costs divided by its value; the gap between that and the 10-year Treasury yield is the extra return for owning buildings instead of government bonds, and a thin gap means property is dear."),
    ("Dividend and payout", "These companies must pay out most of their taxable income, so the dividend is the main return; dividend divided by AFFO shows how much room is left, and near or above 100% is a warning."),
    ("Same-store growth and occupancy", "How much income grew from buildings owned a full year, so purchases do not flatter it, and what share of the space is let."),
    ("Net debt / EBITDA", "Debt minus cash, divided by a year's operating earnings before interest, tax and depreciation: how many years of earnings the debt equals."),
    ("Why rates matter, and which leases feel it most", "Property is bought with debt and valued against bond yields, so higher rates raise costs and lower values; long leases with fixed rents feel it most because their income cannot reprice, short leases (flats, storage, hotels) least."),
    ("How data-center landlords are judged", "On power rather than floor space: megawatts leased and waiting in the backlog, the rent per kilowatt at renewal, and the return on building new capacity, alongside price / AFFO.")]

# ── 9 · the migration and its dry run ───────────────────────────────────────────────────────────────────────────────
def words(k): return str(k).replace("_", " ")
def sc_detail(s):
    out = []
    for k, v in s.items():
        if k in ("what", "ok", "n", "name", "expect", "before", "note"): continue
        if isinstance(v, bool): out.append(f"{words(k)}: {'yes' if v else 'no'}")
        elif isinstance(v, dict) and "nodes" in v: out.append(f"{words(k)}: {v['nodes']} nodes, {v.get('members', '—')} member rows" + (f", {v['pending']} waiting" if "pending" in v else "") + (f", {v['links']} links, {v['candidates']} candidates" if "links" in v and "candidates" in v else ""))
        elif isinstance(v, dict) and "changed_anything" in v: out.append(f"{words(k)}: {'changed rows' if v['changed_anything'] else 'changed nothing'}")
        elif isinstance(v, dict) and ("failed" in v or "refused" in v): out.append(f"{words(k)}: {'failed, as it should' if v.get('failed') else 'refused' if v.get('refused') else 'ran'}")
        elif k == "steps" and isinstance(v, list): out.append(" → ".join(f"{st.get('file', 'step')}: " + ("refused" if st.get("accepted") is False else "accepted") + (", rows changed" if st.get("changed") else ", nothing changed") for st in v if isinstance(st, dict)))
        elif k == "cases" and isinstance(v, list): out.append(f"{len(v)} cases, {sum(1 for c in v if isinstance(c, dict) and c.get('refused'))} refused")
        elif isinstance(v, (int, float, str)) and len(str(v)) < 60: out.append(f"{words(k)}: {v}")
    return " · ".join(out)
def sc_table(X):
    sc = X.get("scenarios"); items = list(sc.items()) if isinstance(sc, dict) else [(s.get("n", i + 1), s) for i, s in enumerate(sc or [])]
    rows = [tr(f"<b>{e(str(k))}</b>", e(str(s.get("name") or s.get("what") or "")) + (f"<br><span class='small'>expected: {e(str(s['expect']))}</span>" if s.get("expect") else ""), f"<span class='small'>{e(sc_detail(s))}</span>", "<b>as expected</b>" if s.get("ok") is True else "<b>NOT AS EXPECTED</b>" if s.get("ok") is False else "—") for k, s in items]
    return tbl(["#", "SCENARIO", "WHAT HAPPENED", "RESULT"], rows, 900), len(items), sum(1 for _, s in items if s.get("ok") is True)
NEWCOLS = [k for k in NODES[0] if k not in DIFF["nodes_removed"][0]]
SQLW = os.path.join(ROOT, "scripts", "cohort-tree-revise-sql.mjs")
NEWTABS = list(dict.fromkeys(re.findall(r"create table if not exists public\.(\w+)", open(SQLW, encoding="utf-8").read()))) if os.path.exists(SQLW) else []
if MIG:
    t_html, n_sc, n_ok = sc_table(MIG); af = next((s.get("after_forward") for s in (MIG["scenarios"].values() if isinstance(MIG["scenarios"], dict) else MIG["scenarios"]) if isinstance(s.get("after_forward"), dict)), {})
    MIG_HTML = f"<div class='kpi'><div><b>{n_ok} of {n_sc}</b><span>scenarios as expected, in a throw-away Postgres on this Mac</span></div><div><b>{MIG.get('databases_opened', '—')}</b><span>throw-away databases opened; the live one: none</span></div><div><b>{af.get('nodes', '—')} · {af.get('members', '—')}</b><span>nodes · member rows after the migration (dry run)</span></div><div><b>{af.get('links', '—')} · {af.get('candidates', '—')}</b><span>fund links · candidates loaded (dry run)</span></div><div><b>0</b><span>applied to the real tables</span></div></div>" + t_html
else: MIG_HTML = NOTRUN.replace("not run yet", "the migration's dry run: not run yet (migration-dry-run.json)")
if NFD:
    t_html, n_sc, n_ok = sc_table(NFD)
    NFD_HTML = f"<div class='kpi'><div><b>{n_ok} of {n_sc}</b><span>scenarios as expected for the next fund batch's tree rows</span></div><div><b>{NFD.get('funds', '—')}</b><span>funds in the batch's files</span></div><div><b>0</b><span>applied to the real tables</span></div></div>" + t_html
else: NFD_HTML = NOTRUN.replace("not run yet", "the next fund batch's tree dry run: not run yet (next-funds-tree-dry-run.json)")


# ── THE EVENING STEERING (6 Oct 18:10 – 19:20 ET): platforms, AI POWERTRAIN, the factor branch, the lanes ───────────
def sg(x, unit="%", dec=1):                                   # a signed number in plain typography
    return "—" if x is None else (f"{x:+.{dec}f}".replace("-", "−") + unit)
def ra(o): return "—" if not o or o.get("raw") is None else f"<b>{f2(o['raw'])}</b> <span class='small'>{f2(o.get('after_market'))} after</span>"
def lab(c): return N[c]["label"]
def homes(t): return [m["cohort"] for m in T["members"] if m["ticker"] == t and m["role"] == "member" and not m["cohort"].startswith("IDX_FACTOR_")]
TAGS = {o["ticker"]: o for o in FT["names"]} if FT else {}
MARK = [("GROWTH", "G"), ("MOMENTUM", "M"), ("LOW VOLATILITY", "L")]
def marks(t):
    m = "".join(k for tag, k in MARK if tag in TAGS.get(t, {}).get("tags", []))
    return f"{t}[{m}]" if m else t
FACT = [n for n in NODES if n["parent_1"] == "IDX_FACTOR" and n["kind"] == "cohort"]
PT = SE["ai_powertrain"] if SE else None; PL = SE["platforms"] if SE else None; HL = SE["hand_made_lists"] if SE else None; FLN = SE["fund_lines"] if SE else None
EVENING = PT_HTML = PLAT_HTML = FACT_HTML = LANES_HTML = NOTRUN
if SE and FT:
    # 0 · what changed, in four panels of labels
    grp = [g for g in PT["groups"]]
    regime = [n for n in NODES if n["hub_pick"] == "off" and "regime read" in (n.get("hub_pick_note") or "")]
    li = lambda rows: "<ul class='plain'>" + "".join(f"<li>{r}</li>" for r in rows) + "</ul>"
    ev1 = li([f"<b>{e(r['ticker'])}</b> <span class='small'>— also {e(' · '.join(lab(c) for c in r['cohorts'] if c != 'INTERNET_PLATFORMS'))}</span>" for r in PL["rows"]])
    ev2 = li([f"<b>{e(g['label'])}</b> · {len(g['names'])} <span class='small'>— {e(' '.join(g['names']))}</span>" for g in grp] +
             [f"REGULATED UTILITIES · {PT['regulated_utilities']['names']} <span class='small'>— kept out · moved {f2(PT['regulated_utilities']['with_ai_powertrain_names']['avg'])} with these names</span>"])
    ev3 = li([f"<b>{e(n['label'])}</b> · {len(companies(n['cohort']))} names <span class='small'>— fund lines {e(' · '.join(m['ticker'] for m in MEM[n['cohort']] if m['role'] == 'reference'))}</span>" for n in FACT] +
             [f"every company tagged · {len(FT['names'])} <span class='small'>— as of {dmy(FT['as_of'])}</span>"])
    DC = N.get("DC_PROPERTY")
    ev4 = li([f"<b>{e(n['label'])}</b> · {len(names_under(n['cohort']))} names <span class='small'>— off the Hub, kept in the tree</span>" for n in regime] +
             ([f"REAL ESTATE parent <span class='small'>— {e(lab(N['REAL_ESTATE']['parent_1']))} → {e(lab('REAL_ESTATE'))} → {e(' · '.join(lab(c) for c in KIDS.get('REAL_ESTATE', [])))}; {e(DC['label'])} ({e(' '.join(companies('DC_PROPERTY')))}) under {e(lab(DC['parent_1']))} and {e(lab(DC['parent_2']))}</span>"] if DC else []))
    EVENING = (f"<div class='four'><div class='panel'><h3>AMAZON · SHOPIFY · THE MARKETPLACES — UNDER {e(lab(N['INTERNET_PLATFORMS']['parent_1']))} AND {e(lab(N['INTERNET_PLATFORMS']['parent_2']))}</h3>{ev1}</div>"
               f"<div class='panel'><h3>AI POWERTRAIN — {len(PT['on_the_hub_today']['names'])} ON THE HUB TODAY → {len(PT['after']['names'])} IN THE TREE · {len(grp)} GROUPS</h3>{ev2}</div>"
               f"<div class='panel'><h3>GROWTH · MOMENTUM · LOW VOLATILITY — A BRANCH, MEMBERS BY RULE</h3>{ev3}</div>"
               f"<div class='panel'><h3>OFF THE HUB, KEPT FOR THE REGIME READ</h3>{ev4}</div></div>")

    # AI POWERTRAIN
    was = PT["before"]["names"]; now = PT["after"]["names"]; util_n = PT["regulated_utilities"]["names"]
    b_txt = [lab("AI"), f"└ AI POWERTRAIN   · {len(was)} names", "    " + " ".join(was), "", lab("ENERGY_POWER")] + \
            [f"└ {'INDEPENDENT POWER' if g['cohort'] == 'POWER_GENERATORS' else g['label']}   · {len(g['names'])} names" for g in grp if g["cohort"] != "FUEL_CELLS_STORAGE"] + [f"└ REGULATED UTILITIES   · {util_n} names"]
    a_txt = [lab("AI"), f"└ AI POWERTRAIN   · {len(now)} names · pick {picktag(N['AI_POWERTRAIN'])}"]
    for g in grp: a_txt += [f"  └ {g['label']}   · {len(g['names'])} names · also under {lab(N[g['cohort']]['parent_2'])}" + ("   ◂ new" if g["cohort"] in [x["cohort"] for x in DIFF["nodes_added"]] else ""), "      " + " ".join(marks(t) for t in g["names"])]
    a_txt += ["", lab("ENERGY_POWER"), f"└ REGULATED UTILITIES   · {util_n} names · pick {picktag(N['REGULATED_UTILITIES'])} · not in AI POWERTRAIN"]
    mt = lambda o: R(f"<b>{f2(o['avg'])}</b> <span class='small'>{o['pairs']} pairs</span>")
    pt_rows = [tr("<b>AI POWERTRAIN before</b>", R(len(was)), mt(PT["before"]["moves_together"]), R("—")),
               tr("<b>the names that joined</b><br><span class='small'>" + e(" ".join(PT["joined"]["names"])) + "</span>", R(len(PT["joined"]["names"])), mt(PT["joined"]["moves_together"]), R(ra(PT["joined"]["basket_against_the_old_basket"]))),
               tr("the names that joined, each against each name already there", R("—"), mt(PT["joined"]["with_the_names_already_there"]), R("—")),
               tr("<b>AI POWERTRAIN after</b>", R(len(now)), mt(PT["after"]["moves_together"]), R("—"))] + \
              [tr("└ " + e(g["label"]), R(len(g["names"])), mt(g["moves_together"]), R(ra(g["against_the_rest_of_ai_powertrain"]))) for g in grp] + \
              [tr("<b>REGULATED UTILITIES among themselves</b>", R(util_n), mt(PT["regulated_utilities"]["moves_together"]), R("—")),
               tr("<b>REGULATED UTILITIES against AI POWERTRAIN</b>", R("—"), mt(PT["regulated_utilities"]["with_ai_powertrain_names"]), R(ra(PT["regulated_utilities"]["basket_against_ai_powertrain"])))]
    BF = PT["baskets_against_funds"]; BFK = list(next(iter(BF.values())))
    bf_rows = [tr(f"<b>{e(k)}</b>", *[R(ra(v[f])) for f in BFK]) for k, v in BF.items()]
    jn_rows = [tr(f"<b>{e(r['ticker'])}</b> <span class='small'>{e(TAGS[r['ticker']]['name'] or '')}</span>", R(ra(r["with_the_old_ai_powertrain_basket"])), R(ra(r["with_chips_SMH"])), R(ra(r["with_industrials_XLI"])), R(ra(r["with_utilities_XLU"])), e(" · ".join(r["tags"]) or "—")) for r in PT["each_joined_name"]]
    HT = PT["on_the_hub_today"]
    PT_HTML = (f"<div class='two'><div><h3>BEFORE · THIS AFTERNOON'S TREE</h3><pre>{e(chr(10).join(b_txt))}</pre></div><div><h3>AFTER · YOUR 19:20 NOTE</h3><pre>{e(chr(10).join(a_txt))}</pre></div></div>"
               f"<p class='cap'>[G] growth · [M] momentum · [L] low volatility, by the rules of section {{SEC_FACT}}</p>"
               f"<h3>DO THEY BELONG? HOW THE SETS MOVED TOGETHER · {SE['window']['sessions']} SESSIONS TO {dmy(SE['as_of']).upper()} · 1.00 = EXACTLY TOGETHER</h3>"
               + tbl(["SET", ">NAMES", ">MOVES TOGETHER · AVERAGE OF EVERY PAIR", ">ITS BASKET AGAINST THE REST"], pt_rows, 820) +
               "<h3>AS BASKETS, AGAINST FUNDS</h3>" + tbl(["BASKET"] + [">" + {"SMH": "CHIPS SMH", "XLI": "INDUSTRIALS XLI", "XLU": "UTILITIES XLU", "PAVE": "INFRASTRUCTURE PAVE", "URA": "URANIUM URA"}.get(f, f) for f in BFK], bf_rows, 860) +
               "<h3>EACH NAME THAT JOINED</h3>" + tbl(["NAME", ">WITH THE OLD AI POWERTRAIN BASKET", ">WITH CHIPS SMH", ">WITH INDUSTRIALS XLI", ">WITH UTILITIES XLU", "TAGS"], jn_rows, 900) +
               f"<h3>ON THE HUB TODAY · THE HUB'S OWN AI POWERTRAIN LIST HAS {len(HT['names'])} NAMES</h3>"
               + tbl(["ON THE HUB'S LIST TODAY", f"IN THE TREE'S AI POWERTRAIN AND NOT ON THE HUB'S LIST · {len(HT['in_the_tree_not_on_the_hub'])}"], [tr("<b>" + e(" ".join(HT["names"])) + "</b>", "<b>" + e(" ".join(HT["in_the_tree_not_on_the_hub"])) + "</b>")], 700) +
               "<p class='cap'>Nothing on the Hub was changed: its list is still the one on the left.</p>")

    # the marketplaces
    HOLD = J("deliverables/20260928/coverage-tree/data/holdings.json", ROOT) or {"data": {}}
    def wt(fund, t): return next((w for x, w in HOLD["data"].get(fund, {}).get("h", []) if x == t), None)
    YD = [y["fund"] for y in PL["yardsticks"]]; YN = {y["fund"]: y["is"] for y in PL["yardsticks"]}
    def prow(r, cmp_=False):
        inside = " · ".join(f"{f} {wt(f, r['ticker']):.1f}%" for f in YD if wt(f, r["ticker"]))
        where = "; ".join(f"{lab(c)} <span class='small'>({lab(N[c]['parent_1'])}" + (f" + {lab(N[c]['parent_2'])}" if N[c]["parent_2"] else "") + ")</span>" for c in r["cohorts"])
        return tr(f"<b>{e(r['ticker'])}</b><br><span class='small'>{e(TAGS[r['ticker']]['name'] or '')}</span>", where, e(" · ".join(c.replace('___', ' · ').replace('_', ' ').lower() for c in r["hub_cohorts_today"])) or "—",
                  *[R(ra(r[f])) for f in YD], f"<b>{e(r['closer_to'])}</b>" + (f"<br><span class='small'>it is itself {e(inside)}</span>" if inside else ""))
    pl_rows = [prow(r) for r in PL["rows"]] + ["<tr class='grp'><td colspan='8'>FOR COMPARISON · two plain shops and two plain software companies</td></tr>"] + [prow(r, True) for r in PL["for_comparison"]]
    PLAT_HTML = tbl(["NAME", "IN THE TREE NOW · ITS PARENTS", "ON THE HUB TODAY"] + [">WITH THE " + YN[f].upper() + " " + f for f in YD] + ["ON THE TAPE, CLOSER TO"], pl_rows, 1380) + \
        "<p class='cap'>bold = daily moves as they were · after = after the market's own swing is taken out · a fund that holds a lot of the name flatters the number: the weight is shown</p>"

    # the factor branch
    C = FT["counts"]; RU = FT["rules"]; AG = FT["agreement_with_the_funds"]; OL = {(o["branch"], o["fund"]): o for o in FLN["our_lists_against_the_funds"]}
    rule_txt = {"GROWTH": f"next-twelve-month revenue growth of {RU['growth_min_ntm_rev_pct']:.0f}% or more where an estimate is on file ({C['growth_estimate_on_file']} names); else the index maker's side: VUG holds it, VTV does not",
                "MOMENTUM": f"top fifth of {C['ranked_full_window']} companies by six-month return (rank {RU['momentum_top_pct']} or higher)",
                "LOW VOLATILITY": f"calmest fifth by usual day: the middle size of its daily move over six months (rank {RU['low_vol_bottom_pct']} or lower)"}
    agk = {"GROWTH": "growth_vs_VUG", "MOMENTUM": "momentum_vs_MTUM", "LOW VOLATILITY": "low_volatility_vs_SPLV"}
    fr_rule = []
    for n in FACT:
        a = AG[agk[n["label"]]]; f = n["spine_fund"]; o = OL.get((n["label"], f))
        fr_rule.append(tr(f"<b>{e(n['label'])}</b>", e(rule_txt[n["label"]]), R(len(companies(n["cohort"]))), "<b>" + e(" · ".join(m["ticker"] for m in MEM[n["cohort"]] if m["role"] == "reference")) + "</b>",
                          R(f"{a['both']} of {a['ours']}<br><span class='small'>{f} holds {a['fund_holds_of_our_companies']} of our companies</span>"), R(ra(o["move_together"]) if o else "—"),
                          R(f"{sg(o['our_list_return_6m_pct'])} <span class='small'>ours</span><br>{sg(o['fund_return_6m_pct'])} <span class='small'>{f}</span>" if o else "—")))
    def top(node, fmt, n=24):
        ts = companies(node)
        return f"<div class='panel'><h3>{e(lab(node))} · {len(ts)} NAMES · FIRST {min(n, len(ts))}</h3><ul class='plain'>" + "".join(f"<li><b>{e(t)}</b> <span class='small'>{fmt(TAGS[t])}</span></li>" for t in ts[:n]) + f"</ul><p class='cap'>then: {e(' '.join(ts[n:]))}</p></div>"
    cols3 = (top("IDX_FACTOR_GROWTH", lambda o: (f"revenue {sg(o['growth_ntm_rev_pct'])} next 12 months" if o.get("growth_ntm_rev_pct") is not None else "VUG holds it, VTV does not · no estimate on file")) +
             top("IDX_FACTOR_MOMENTUM", lambda o: f"{sg(o['ret_126_pct'])} in six months · rank {o['momentum_rank']:.0f}" + (" · MTUM holds it" if "MTUM" in o["held_by"] else "")) +
             top("IDX_FACTOR_LOW_VOL", lambda o: f"usual day {o['usual_day_pct']:.2f}% · {o['usual_day_vs_market']:.1f}× the market" + (" · SPLV" if "SPLV" in o["held_by"] else "") + (" · QUAL" if "QUAL" in o["held_by"] else "")))
    pair_rows = [tr(f"<b>{e(p['a'])} against {e(p['b'])}</b><br><span class='small'>{e(p['is'])}</span>", R(f"<b>{sg(p['a_beat_b_6m_pct'])}</b>"), R(f"<b>{sg(p['a_beat_b_20_sessions_pct'])}</b>"), R(f"{sg(p['a_return_6m_pct'])} · {sg(p['b_return_6m_pct'])}"), R(f2(p["move_together"])), e(p["reads"])) for p in FLN["pairs"]]
    def hand_row(h, title):
        grp_ = {}
        for x in h["on_the_hub_list_not_by_rule"]: grp_.setdefault(x["group"], []).append(x)
        why = "<br>".join(f"<span class='small'>{e(k)}:</span> " + e(" · ".join(x["ticker"] + (f" {x['detail']}".replace("-", "−") if x.get("detail") else "") for x in v)) for k, v in grp_.items())
        return tr(f"<b>{e(title)}</b>", R(h["hub_names"]), e(h["rule"].lower()), R(h["rule_names"]), R(f"<b>{h['both']}</b>"), why)
    hand_rows = [hand_row(HL["growth"], "GROWTH · your list on the Hub"), hand_row(HL["blue_chip_vs_low_volatility"], "BLUE CHIP · your list on the Hub"), hand_row(HL["blue_chip_vs_quality"], "BLUE CHIP · against QUAL")]
    mix_rows = []; MIX = {x["cohort"]: x for x in SE["tag_mix_by_cohort"]}
    def own_cohorts(h):                                        # the cohorts whose nearest heading above is h, in tree order, with their depth under it
        out = []
        def walk_m(c, d):
            for k in KIDS.get(c, []):
                if N[k]["kind"] == "heading": continue         # a sub-heading gets its own group below
                out.append((k, d)); walk_m(k, d + 1)
        walk_m(h, 0); return out
    for h in ORDER + LONE:
        cs = own_cohorts(h) if N[h]["kind"] == "heading" else [(h, 0)]
        cs = [(c, d) for c, d in cs if c in MIX]
        if not cs: continue
        if N[h]["kind"] == "heading": mix_rows.append(f"<tr class='grp'><td colspan='7'><b>{e(lab(h))}</b> · pick {picktag(N[h])}" + (f" · under {e(lab(N[h]['parent_1']))}" if h in SUBH else "") + "</td></tr>")
        for c, d in cs:
            x = MIX[c]; mix_rows.append(tr(("&nbsp;&nbsp;" * d + "└ " if d else "") + e(x["label"]) + f" <span class='small'>· {PICK[x['hub_pick']]}</span>", R(x["names"]), R(x["growth"] or ""), R(x["momentum"] or ""), R(x["low_volatility"] or ""), R(x["lagging"] or ""), "<span class='small'>" + e(" ".join(marks(t) for t in companies(c))) + "</span>"))
    all_rows = [tr(f"<b>{e(o['ticker'])}</b>", e(o["name"] or ""), e(" · ".join(o["tags"]) or "—"), R(sg(o.get("growth_ntm_rev_pct")) if o.get("growth_ntm_rev_pct") is not None else ""), e((o.get("growth_basis") or "not classified").replace("index maker ", "")), R(sg(o.get("ret_126_pct"))), R(f"{o['momentum_rank']:.0f}" if o.get("momentum_rank") is not None else ""), R(f"{o['usual_day_pct']:.2f}%" if o.get("usual_day_pct") is not None else ""), R(f"{o['usual_day_vs_market']:.1f}×" if o.get("usual_day_vs_market") is not None else ""), e(" · ".join(f"{k} {v:.2f}" for k, v in o["held_by"].items())), e("; ".join(o["notes"]))) for o in FT["names"]]
    BC = FT["blue_chip_answer"]
    FACT_HTML = (f"<div class='kpi'><div><b>{len(FT['names'])}</b><span>companies tagged, as of {dmy(FT['as_of'])}</span></div>" + "".join(f"<div><b>{len(companies(n['cohort']))}</b><span>{e(n['label'].lower())}</span></div>" for n in FACT) +
                 f"<div><b>{C['tags']['VALUE']} · {C['tags']['LAGGING']} · {C['tags']['HIGH VOLATILITY']}</b><span>the other ends: value · lagging · high volatility (tags only)</span></div><div><b>{C['growth_estimate_on_file']} · {C['growth_by_index_maker']} · {C['growth_not_classified']}</b><span>growth judged on an estimate · on the index maker's side · not classified yet</span></div><div><b>{FT['market']['usual_day_pct']:.2f}%</b><span>the market's usual day (SPY)</span></div></div>"
                 "<h3>THE THREE RULES AND THEIR FUND LINES</h3>" + tbl(["BRANCH", "THE RULE", ">NAMES", "FUND LINES", ">OF OUR NAMES, THE FUND HOLDS", ">OUR LIST MOVES WITH THE FUND", ">SIX MONTHS"], fr_rule, 1180) +
                 f"<div class='three'>{cols3}</div><p class='cap'>growth is listed highest first; a figure in the hundreds or thousands of percent means last year's revenue was tiny (a company that has barely started selling), not that it is the strongest business</p>"
                 "<h3>THE FUND LINES AS READINGS · HOW MUCH THE FIRST FUND BEAT THE SECOND</h3>" + tbl(["PAIR", ">SIX MONTHS", ">LAST 20 SESSIONS", ">EACH FUND, SIX MONTHS", ">MOVE TOGETHER", "HOW TO READ IT"], pair_rows, 1100) +
                 "<h3>THE LISTS YOU MADE BY HAND ON THE HUB, AGAINST THE RULE</h3>" + tbl(["LIST", ">NAMES", "AGAINST THE RULE", ">NAMES BY RULE", ">ON BOTH", "ON YOUR LIST AND NOT BY RULE · WHY"], hand_rows, 1180) +
                 f"<p class='cap'>{e(BC['plain'])} Of our {BC['low_volatility_names']} low-volatility names, QUAL holds {BC['of_them_held_by_QUAL']} and SPLV holds {BC['of_them_held_by_SPLV']}.</p>"
                 "<h3>THE TAGS IN THE TREE · EACH COHORT'S NAMES WITH THEIR MARKS</h3>" + tbl(["COHORT", ">NAMES", ">GROWTH", ">MOMENTUM", ">LOW VOLATILITY", ">LAGGING", "NAMES · [G] GROWTH · [M] MOMENTUM · [L] LOW VOLATILITY"], mix_rows, 1180) +
                 f"<details class='names'><summary>EVERY NAME AND ITS NUMBERS · {len(all_rows)}</summary>" + tbl(["TICKER", "NAME", "TAGS", ">REVENUE, NEXT 12 MONTHS", "GROWTH JUDGED ON", ">SIX-MONTH RETURN", ">RANK", ">USUAL DAY", ">× MARKET", "HELD BY", "NOTE"], all_rows, 1400) + "</details>")

if LN:
    def lines_cell(l):
        if not l or not l.get("lines"): return "<span class='small'>" + ("reviewed, lines not in this file" if l and l.get("reviewed") else "never reviewed") + "</span>"
        f = lambda x, w: f"{w} <b>{e(x['line'])}</b> {x['level']:,.2f} <span class='small'>({sg(x['pct_from_price'])})</span>" if x else ""
        return f"{l['lines']} lines<br>" + "<br>".join(x for x in (f(l.get("nearest_above"), "above"), f(l.get("nearest_below"), "below")) if x)
    LH = []
    for L in LN["lanes"]:
        if L["lane"] == "CORE":
            rows = [tr(f"<b>{e(i['ticker'])}</b> <span class='small'>{e(i['name'])}</span>", e(i["kind"]), R(sg(i["ret_6m_pct"])), R(sg(i["off_high_pct"])), R(sg(i["vs_avg21_pct"])), R(sg(i["vs_avg100_pct"])), lines_cell(i["lines"])) for i in L["items"]]
            t = tbl(["LINE", "WHAT", ">SIX-MONTH RETURN", ">AGAINST ITS SIX-MONTH HIGH", ">AGAINST ITS 21-DAY AVERAGE", ">AGAINST ITS 100-DAY AVERAGE", "REVIEWED LINES"], rows, 980)
        elif L["lane"] == "NEW NAMES":
            rows = [tr(f"<b>{e(i['ticker'])}</b> <span class='small'>{e(i['name'] or '')}</span>", e(dmy(i["listed_on"])), e(" · ".join(i["in_tree_cohorts"])), R(sg(i["ret_6m_pct"]) if i["ret_6m_pct"] is not None else "<span class='small'>short history</span>"), R(sg(i["off_high_pct"])), R(sg(i["growth_ntm_rev_pct"]) if i.get("growth_ntm_rev_pct") is not None else ""), lines_cell(i["lines"])) for i in L["items"]]
            t = tbl(["NAME", "LISTED", "IN THE TREE", ">SIX-MONTH RETURN", ">AGAINST ITS HIGH SINCE", ">REVENUE, NEXT 12 MONTHS", "REVIEWED LINES"], rows, 1080)
        else:
            lag = L["lane"].startswith("ROTATION")
            rows = [tr(f"<b>{e(i['ticker'])}</b> <span class='small'>{e(i['name'] or '')}</span>", e(" · ".join(i["on_hub_cohorts"][:2])), R(f"{i['momentum_rank']:.0f}"), R(sg(i["ret_6m_pct"])), R(sg(i["above_low_pct"]) if lag else sg(i["off_high_pct"])), R(sg(i["vs_avg21_pct"])), R(sg(i["vs_avg100_pct"])), R(sg(i["growth_ntm_rev_pct"]) if i.get("growth_ntm_rev_pct") is not None else ""), lines_cell(i["lines"])) for i in L["items"]]
            t = tbl(["NAME", "ON-HUB COHORT", ">RANK OF 100", ">SIX-MONTH RETURN", ">OVER ITS SIX-MONTH LOW" if lag else ">UNDER ITS SIX-MONTH HIGH", ">AGAINST ITS 21-DAY AVERAGE", ">AGAINST ITS 100-DAY AVERAGE", ">REVENUE, NEXT 12 MONTHS", "REVIEWED LINES"], rows, 1180)
        also = f"<p class='cap'>also in this lane today, not shown ({len(L['also'])}): {e(' '.join(L['also']))}</p>" if L.get("also") else ""
        LH.append(f"<h3>LANE · {e(L['lane'])} · {L['count']} TODAY" + (f" · FIRST {L['shown']} SHOWN" if L.get("shown") and L["shown"] < L["count"] else "") + f"</h3>{t}<p class='cap'>{e(L['what'])} · rule: {e(L['rule'])}</p>{also}")
    LANES_HTML = "<div class='kpi'>" + "".join(f"<div><b>{v}</b><span>{e(k.lower())}</span></div>" for k, v in LN["counts"].items()) + f"<div><b>{LN['rules']['per_lane_cap']}</b><span>names shown per lane a day (the cap)</span></div><div><b>{len(LN['reviewed_so_far'])}</b><span>instruments the Lab has reviewed lines for so far: {e(' '.join(LN['reviewed_so_far'][:10]))} …</span></div></div>" + "".join(LH)

# ── facts for PAGE SPECS ────────────────────────────────────────────────────────────────────────────────────────────
WIN = FR["method"]["window"]; VAN = {v["funds"]["VANGUARD"] for v in FL["sector_funds"].values()}
CAPPED = ", ".join(f"{f} ({a} of {b} rows)" for f, (a, b) in FL["sanity"]["funds_truncated_by_the_pull"].items() if f in VAN)
MEMN = sum(1 for a in NF["admit_next"] if "MEMORY" in a["facts_basis"].upper())
MAG_NOTE = "".join(f" {N[c]['label']} lists {len(companies(c))} tickers because Alphabet has two share classes." for c in LONE if {"GOOG", "GOOGL"} <= set(companies(c)))
ZERO = [h for h in TOPH if N[h]["parent_1"] in SECT and w_first(h) == 0]
ZERO_NOTE = "".join(f" {N[h]['label']}'s first parent is {N[N[h]['parent_1']]['label']} on Vanguard's wider fund; the S&amp;P's own fund holds none of its names, so its solid line is hair-thin." for h in ZERO)
KP = PLAN["hub_pick"]

CSS = """
:root{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#ced0d2}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:12px/1.5 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}
main{max-width:1650px;margin:0 auto}h1{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}h2{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:34px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}
h3{font-size:11px;letter-spacing:.1em;color:var(--dim);font-weight:500;margin:18px 0 6px}.panel h3{margin-top:0;color:var(--bright)}
.sub{color:var(--dim);margin:0 0 18px}.panel{background:var(--panel);border:1px solid var(--line);padding:14px;margin:10px 0}
table{border-collapse:collapse;width:100%;font-size:11px}th,td{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}th{color:var(--dim);font-weight:500;letter-spacing:.06em}td.r,th.r{text-align:right;font-variant-numeric:tabular-nums}b{color:var(--bright);font-weight:600}
tr.grp td{background:var(--bg);color:var(--dim);letter-spacing:.06em;padding-top:8px}
table.grid td.h{min-width:62px;color:var(--bright)}table.grid td.p1{outline:1px solid #aeb0b2;outline-offset:-2px}table.grid td.p2{outline:1px dashed #8a8c8e;outline-offset:-2px}
pre{font-size:11px;line-height:1.5;color:var(--ink);overflow-x:auto;background:var(--panel);border:1px solid var(--line);padding:12px;margin:10px 0}
.kpi{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:10px 0}.kpi div{background:var(--panel);border:1px solid var(--line);padding:10px 12px;min-width:0}.kpi b{display:block;font-size:20px;overflow-wrap:anywhere}.kpi span{color:var(--dim);font-size:11px}
.two{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:10px}.three{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}.two pre,.three .panel,.four .panel{margin:0}.four{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px}
details.names{margin:14px 0}details.names summary{cursor:pointer;color:var(--bright);letter-spacing:.1em;font-size:11px;padding:8px 0}
ul.plain{list-style:none;margin:0;padding:0;font-size:11px}ul.plain li{padding:3px 0;border-bottom:1px solid var(--line)}
dl{margin:10px 0;font-size:12px;max-width:980px}dt{color:var(--bright);font-weight:600;margin-top:10px}dd{margin:2px 0 0 0;color:var(--ink)}
details.sc-pagespecs{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}details.sc-pagespecs summary{cursor:pointer;color:var(--bright);letter-spacing:.12em}details.sc-pagespecs p{max-width:900px}
.wrap{overflow-x:auto}.small{font-size:11px;color:var(--dim)}.cap{font-size:11px;color:var(--dim);margin:6px 0 0;max-width:1100px}.notrun{color:var(--dim);border:1px dashed var(--line);padding:10px 12px;margin:10px 0}code{color:var(--bright)}
.treewrap{padding:8px}svg.tree{display:block;width:1590px;min-width:1590px;height:auto}svg.tree text.t{font:11px Menlo,ui-monospace,Consolas,monospace;fill:#c4c6c8}svg.tree text.b{fill:#ced0d2;font-weight:600}svg.tree text.d{fill:#8a8c8e}svg.tree text.tk{font-size:13px;font-weight:600;fill:#ced0d2}svg.tree text.halo{paint-order:stroke;stroke:#161718;stroke-width:4px;stroke-linejoin:round}
@media(max-width:1300px){.four{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:900px){.two,.three,.four{grid-template-columns:minmax(0,1fr)}}
@media(max-width:700px){body{padding:20px 16px 50px}}
"""
page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>TR2 · The tree revised on your notes</title>
<style>{CSS}</style></head><body><main>
<h1>TR2 · THE TREE REVISED ON YOUR NOTES</h1>
<p class="sub">6 Oct 2026, your afternoon notes and your evening steering · prepared, nothing applied · no table written, no Hub change, no fund admitted · branch hub/tr2-tree-revision-20261006</p>
<div class="kpi">
<div><b>{PLAN['nodes']['tr1']} → {PLAN['nodes']['tr2']}</b><span>nodes in the tree</span></div>
<div><b>{len(MOVED)}</b><span>{e(GONE['label'])} dissolved: cohorts re-homed</span></div>
<div><b>{len(SECT)}</b><span>sector nodes, each a fund with its three twins</span></div>
<div><b>{PLAN['links']}</b><span>fund-to-cohort links, by weight</span></div>
<div><b>{PLAN['candidates']}</b><span>candidates (not served)</span></div>
<div><b>{len(NF['admit_next'])}</b><span>funds in the next batch (not the coming sitting's)</span></div>
<div><b>{KP.get('on', 0)} · {KP.get('off', 0)} · {KP.get('undecided', 0)}</b><span>your picks: on · off · undecided</span></div>
<div><b>{len(FT['names']) if FT else '—'}</b><span>companies tagged growth / momentum / low volatility by rule</span></div>
</div>

<h2 id="evening">YOUR EVENING NOTES · 18:10 – 19:20 ET · WHAT CHANGED IN THE TREE</h2>
{EVENING}

<h2 id="tree">1 · THE REVISED TREE PICTURE</h2>
<div class="panel wrap treewrap">{SVG}</div>
<h3>THE COMPLETE TREE · {len(FULL)} NODES</h3>
<pre>{e(chr(10).join(FULL))}</pre>

<h2 id="cross">2 · CROSS-RELATIONSHIPS · HOW MUCH OF EACH SECTOR FUND EACH HEADING'S NAMES MAKE UP</h2>
{GRID}
<p class="cap">solid box = the heading's first parent · dashed box = its second parent · blank = the fund holds none of its names · deeper grey = more of the fund</p>
<h3>EACH SECTOR FUND: THE COHORTS IT HOLDS, BY WEIGHT</h3>
{tbl(["FUND", ">OUR NAMES ARE THIS MUCH OF IT", "TOP SIX COHORTS BY WEIGHT", "ITS THREE BIGGEST NAMES IN NO COHORT"], by_fund, 900)}
<h3>COHORTS THAT GENUINELY SIT UNDER TWO SECTORS · {len(cross)}</h3>
{tbl(["COHORT", ">NAMES", "FIRST SECTOR", "SECOND SECTOR"], cross, 900)}

<h2 id="frontier">3 · WHERE {e(GONE['label'])} WENT</h2>
<div class="two"><div><h3>BEFORE · TR1</h3><pre>{e(chr(10).join(before_txt))}</pre></div><div><h3>AFTER · THE NEW HOMES</h3><pre>{e(chr(10).join(after_txt))}</pre></div></div>
{tbl(["COHORT", "NEW FIRST PARENT", "SECOND PARENT", "MOVES TOGETHER INSIDE THE COHORT", "WITH ITS NEW SECTOR'S FUND", "WITH THE FUND IT FOLLOWS MOST", "WHY IT GOES THERE"], fr_rows, 1380)}
<p class="cap">raw = daily moves as they were · after = after taking out the small-company swing · 1.00 = moves exactly together, 0 = no link</p>
<h3>BETWEEN COHORTS, THIS HALF-YEAR</h3>
{tbl(["PAIR OF COHORTS", ">MOVE TOGETHER, RAW", ">AFTER TAKING OUT THE SMALL-COMPANY SWING"], btw, 700)}
<p class="cap">The new homes come from what the companies make. On the tape SPACE, QUANTUM and eVTOL moved as one block this half-year; the {e(N[SHELF]['label']) if SHELF else ''} shelf's cohorts do not move as one.</p>

<h2 id="consumer">4 · PACKAGED FOODS AND THE CONSUMER GAPS</h2>
<pre>{e(chr(10).join(cons))}</pre>
<p class="cap">{e(CG['answer_packaged_foods']['plain'])}</p>
<h3>CANDIDATES · NOT SERVED · PROPOSALS ONLY · {len(T['candidates'])}</h3>
{tbl(["TICKER", "S&amp;P 500", ">SHARE OF THE S&amp;P 500", "BASIS", "WHICH GAP IT FILLS"], cand, 900)}

<h2 id="powertrain">5 · AI POWERTRAIN, WITH THE GRID AND ELECTRICAL NAMES</h2>
{PT_HTML.replace("{SEC_FACT}", "7")}

<h2 id="platforms">6 · AMAZON, SHOPIFY AND THE MARKETPLACES · SOFTWARE AND CONSUMER AT ONCE</h2>
{PLAT_HTML}

<h2 id="factors">7 · GROWTH · MOMENTUM · LOW VOLATILITY · A BRANCH OF THE INDEX LAYER, AND A TAG ON EVERY NAME</h2>
{FACT_HTML}

<h2 id="picks">8 · YOUR ON-HUB PICKS, RECORDED</h2>
<div class="three">{picks['on']}{picks['off']}{picks['undecided']}</div>
<p class="cap">A record only. Nothing on the Hub reads it.</p>

<h2 id="lanes">9 · THE MARKET DESK QUEUE AS FOUR LANES · A PROPOSAL, DRAWN FROM THE TREE · CLOSE OF {dmy(LN['as_of']).upper() if LN else ''}</h2>
{LANES_HTML}

<h2 id="funds">10 · THE NEXT FUND BATCH (THE SITTING AFTER THE NEXT ONE)</h2>
<div class="kpi">
<div><b>{NF['counts']['admit_next']}</b><span>funds proposed for the next sitting</span></div>
{''.join(f"<div><b>{v}</b><span>strengthen {e(k.replace('_', ' ').lower())}</span></div>" for k, v in NF['counts'].get('admit_next_by_read', {}).items())}
<div><b>{NF['counts']['later']} · {NF['counts']['skip']}</b><span>later · skip</span></div>
<div><b>{MEMN}</b><span>of the {NF['counts']['admit_next']} rest partly or wholly on memory</span></div>
</div>
{SITTING}
{tbl(["FUND", "NAME · WHAT IT TRACKS", "WHAT IT ADDS", "PAIRS WITH · WHAT THE PAIR SAYS", "TRADING", "FACTS", "WHERE IN THE TREE"], nf_rows, 1280)}
<h3>THE FIVE PAIR READS</h3>
{tbl(["ONE FUND DIVIDED BY ANOTHER", "RISING MEANS", "FALLING MEANS", "NEEDS A NEW FUND", ">LAST 126 SESSIONS", ">LAST 20 SESSIONS"], pr, 1000)}
<h3>LATER · {len(NF['later'])} &nbsp;AND&nbsp; SKIP · {len(NF['skip'])}</h3>
{tbl(["VERDICT", "FUND", "NAME", "REASON"], ls_rows, 860)}

<h2 id="realestate">11 · REAL ESTATE IN PLAIN WORDS</h2>
<div class="two"><div><h3>WHAT XLRE IS MADE OF · % OF THE FUND</h3>{tbl(["PART", ">SHARE"], xl, 300)}</div>
<div><h3>WHERE EQIX, DLR AND IRM SIT · TREE AND FUNDS</h3>{tbl(["NAME", "FILED AS", "IN THE TREE"] + [">" + f for f in WF], rw, 760)}</div></div>
<h3>HOW THEY MOVED WITH · {RE['method']['window']['sessions']} SESSIONS · 1.00 = EXACTLY TOGETHER</h3>
{tbl(["GROUP OR NAME"] + [">" + h for _, h in RCOLS], rc, 900)}
<p class="cap">{e(RE['status'])}</p>
<h3>HOW A PROPERTY COMPANY (A REIT) IS VALUED · definitions: standard practice, not measured here</h3>
<dl>{''.join(f"<dt>{e(t)}</dt><dd>{e(d)}</dd>" for t, d in DEFS)}</dl>
<p class="cap">Not measured, because the field is not held: {e(' · '.join(RE['not_measured']))}.</p>

<h2 id="migration">12 · THE MIGRATION AND ITS DRY RUN · NOTHING APPLIED</h2>
<div class="kpi"><div><b>{len(NEWTABS)}</b><span>new tables: {e(' · '.join(NEWTABS))}</span></div><div><b>{len(NEWCOLS)}</b><span>new columns on cohort_tree: {e(' · '.join(NEWCOLS))}</span></div><div><b>0</b><span>pages that read any of them</span></div></div>
<h3>THE TREE MIGRATION</h3>
{MIG_HTML}
<h3>THE NEXT FUND BATCH'S TREE ROWS</h3>
{NFD_HTML}

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> Your 6 Oct notes applied to the tree TR1 loaded, and nothing else: {e(GONE['label'])} is gone and its {len(MOVED)} cohorts hang from what the companies make; the index layer sits between THE MARKET and everything else, with eleven sector nodes that each hold the S&amp;P's own sector fund (State Street's SPDR fund), the same sector with every name counted the same (equal weight), and the Vanguard and iShares copies; CONSUMER STAPLES is a sub-heading with seven cohorts by what the companies sell; and your on-Hub picks are written beside each node as a record. A "cohort" is a group of companies that do the same thing. "Measured against" names the fund a branch is compared with; the tables call that its spine fund, and one index set's own label says "spine line" for the same thing.</p>
<p><b>Section 1, the picture.</b> Drawn from <code>revised-tree.json</code>. Five layers, top to bottom. A line from a sector fund to a heading is as thick as the share of that fund the heading's names make up ({NLINES} lines: every share of 1% or more, plus each heading's first parent). Solid is the heading's first parent in the tree, dashed is every other fund that holds it. Numbers are printed on lines of 10% or more; section 2 has every number. A sub-heading sits beside its heading, a little lower, joined by the bracket underneath; its own lines repeat part of its heading's, because its names are among its heading's names.{ZERO_NOTE}{MAG_NOTE} The first parent is chosen by a rule: the sector whose Vanguard fund (which also holds mid and small companies) holds the most of the heading's names, ties broken by weight in the S&amp;P's fund. That is why a heading can have a first parent that is not its thickest line.</p>
<p><b>Section 2.</b> The same links as a grid. Weights are the funds' own holdings files (pulled {e(FR['measured_from']['fund_holdings_pulled'])}), summed over the names we serve under each heading or cohort; a name is counted once per heading. "Our names are this much of it" is from <code>fund-links.json</code>: the share of the fund's weight that sits on names we serve. That file was built on TR1's cohorts, so its "names in no cohort" are names in no cohort of either tree (the set of companies did not change). The two-sector list needs the second sector's Vanguard fund to hold at least a quarter of the cohort's names.</p>
<p><b>Section 3.</b> "Moves together" is the average of how closely each pair of names moved day by day over {WIN['sessions']} sessions, closes {dmy(WIN['first_return_date'])} to {dmy(WIN['last_return_date'])} (<code>frontier-rehome.json</code>); statisticians call it correlation. "After taking out the small-company swing" removes from each series the part explained by the small-company index fund IWM, because these are small, jumpy stocks that all rise and fall with it. The fund a cohort "follows most" is the closest of the 19 funds tested. The "why" column is the tree's own <code>parent_why</code>.</p>
<p><b>Section 4.</b> From <code>consumer-gaps.json</code> and the candidates in <code>revised-tree.json</code>. A pair is one number, not a group test; one name has no number. Candidates are names we do not serve: they are not members of anything and nothing is admitted. S&amp;P 500 shares are State Street's file, {e(CG['spy_as_of'].replace('As of ', ''))}. Candidates outside the S&amp;P 500 are from memory.</p>
<p><b>Section 8.</b> From <code>hub_pick</code>, <code>hub_pick_source</code> and <code>hub_pick_note</code> on each node. A cohort follows its nearest heading you named; where its two parents disagree, or it moved after you spoke, it is left undecided on purpose. The evening's four (regulated utilities, housing, restaurants, aerospace) are recorded off with the words "in the tree for the regime read": they stay measured, and stay off the Hub. The three cohorts that came from the old FRONTIER (space, eVTOL, defence tech) are left undecided: "aerospace off" was said about the industrial shelf, and whether it covers those story stocks is yours to say.</p>
<p><b>The evening block and sections 5 to 7.</b> Your steering of 6 Oct, 18:10 to 19:20 ET, applied to the afternoon's tree. <b>Section 5:</b> AI POWERTRAIN now holds the grid and electrical build-out names itself and has four groups under it; the regulated utilities are a separate cohort under ENERGY &amp; POWER, recorded off the Hub, and the migration refuses to finish if one of them sits inside AI POWERTRAIN. "Moves together" is the average of how closely each pair of names moved day by day over {SE['window']['sessions'] if SE else ''} sessions; "after" takes the market's own swing (SPY) out of both sides first. The Hub's own list is CO1's copy of the Hub's cohort lists of 6 Oct, not a fresh read. <b>Section 6:</b> a company's parents are the parents of the cohorts it sits in; the marketplaces sit in INTERNET &amp; CONSUMER PLATFORMS, whose first parent is SOFTWARE &amp; INTERNET and whose second is CONSUMER, and each keeps the cohort it was in. The tape columns say how each moved with four funds; where the fund holds a lot of the name itself the number is flattered, and the weight is printed. <b>Section 7:</b> three nodes under FACTORS in the index layer. Members are assigned by <code>tools/factor_tags.py</code>, never by hand: six-month return rank, the "usual day" (the middle size of a name's daily move, said as a multiple of SPY's), and next-twelve-month revenue growth where an analyst estimate is on file. The fund lines (VUG and VTV, MTUM, SPLV, QUAL) are what each list is compared with; "the fund holds" is from the funds' own holdings files. A name can carry more than one tag; the middle three fifths of a rank carry none.</p>
<p><b>Section 9.</b> A proposal, from <code>market-desk-lanes.json</code>: the same review queue, sorted into four lanes by rules that read the tree. It is not a queue file and nothing was sent to the Indicator Lab. "Pullback" and "support" are stand-ins measured from closes (distance under the six-month high, over the six-month low, against the 21- and 100-day averages); where a name has reviewed lines the nearest one above and below is shown with its own label and level, read from the workshop-queue lane's file of 6 Oct. "On the Hub" means the name sits in a cohort recorded as on in section 8.</p>
<p><b>Section 10.</b> From <code>next-funds.json</code>. "Facts" says whether a fund's name, start date and trading volume were checked against a source in this run, come from a measured local file, or are from memory. The pair numbers are how far one fund divided by the other moved over the last 126 and 20 sessions, from the local closes file; where a fund is not served there is no number.</p>
<p><b>Section 11.</b> The tables are measured from local files (<code>real-estate.json</code>): fund weights, and how daily moves lined up over {RE['method']['window']['sessions']} sessions. {e(RE['method']['noise_floor'])}. The definition list is standard practice written out in plain words; none of it is measured here, because we hold none of those fields.</p>
<p><b>Section 12.</b> The dry runs loaded the files into a throw-away Postgres in memory on this Mac, never the live database. "Forward" is the migration file, "rollback" the way back, and a "fingerprint" is a checksum of every row, used to prove the way back returns exactly what was there. New table names are read from <code>scripts/cohort-tree-revise-sql.mjs</code>; the new columns are the ones the revised nodes carry that TR1's did not.</p>
<p><b>What could be wrong.</b> One half-year is one market regime: the numbers say what moved together from {dmy(WIN['first_return_date'])} to {dmy(WIN['last_return_date'])}, not what always will. Small cohorts rest on few pairs (QUANTUM is four names, six pairs). {MEMN} of the {NF['counts']['admit_next']} next-batch funds carry facts from memory. The holdings files stop at 400 rows for two Vanguard funds: {e(CAPPED)}; a small name below the cut shows as not held. The live tables were NOT read in this run: the migration checks them itself when it is applied, and refuses if they are not what TR1 loaded. The tags are one half-year: momentum is the six-month leg only (the closes file here is {FT['window']['closes_file_sessions'] if FT else ''} sessions long, so the 12-month leg is not in), and growth is judged on an analyst estimate for {FT['counts']['growth_estimate_on_file'] if FT else ''} names and on the index maker's side for {FT['counts']['growth_by_index_maker'] if FT else ''}; {FT['counts']['growth_not_classified'] if FT else ''} names (foreign listings and small companies with no estimate on file) are not classified for growth yet. A tag list goes stale: it needs a refresh date. Warner Bros. Discovery stopped trading on 6 Oct and still has its row in the tree; it carries a note and no tag.</p>
<p><b>What was not done.</b> Nothing applied. No Hub change: no page reads the picks, the links or the candidates. No fund admitted, no candidate served. The keyed steps that sit behind a gate (the provider's 60-session check and close cross-check for each fund) were not run.</p>
</details>
</main>
</body></html>
"""

# ── plain words: no helper codes on a page for Alan (7 Oct: "what the fuck is R4? … Please be clear"). ─────────────
# The data files and scenario names carry the lanes' own codes (TR1, TR2, CO1). They are said in words here, in the
# text between tags only; file and branch names keep their spelling, because they are names of things on disk.
CODE_WORDS = [
    (r"TR2 · The tree revised on your notes", "The tree, revised on your notes"), (r"TR2 · THE TREE REVISED ON YOUR NOTES", "THE TREE, REVISED ON YOUR NOTES"),
    (r"BEFORE · TR1\b", "BEFORE · THE TREE AS ADOPTED EARLIER ON 6 OCT"), (r"TR1 skip, kept: ", "left out on 6 Oct, still out: "),
    (r"once TR1 lands", "once the ten index funds are admitted"), (r"TR1 has just admitted SPYG/SPYV", "SPYG and SPYV are among the ten funds about to be admitted"),
    (r"TR1 AFTER_ADMISSION", "its after-admission step"), (r"\(TR1 load \+ AFTER_ADMISSION\)", "(the first tree load + its after-admission step)"),
    (r"TR1's BLANKET after-admission step", "the first tree load's BLANKET after-admission step"), (r"TR1's after-admission step", "the first tree load's after-admission step"),
    (r"\bTR1 loaded\b", "the first tree load"), (r"\bTR1 load\b", "the first tree load"), (r"tr1 load after tr2", "the first tree's load file, run after this revision"),
    (r"tr1 rollback after tr2", "the first tree's way-back file, run after this revision"), (r"with TR2 applied", "with this revision applied"),
    (r"the tree TR1 loaded", "the tree adopted earlier on 6 Oct"), (r"what TR1 loaded", "what the first tree load left"), (r"CO1's", "the cohort study's"),
    (r"(?<![\w/.-])TR1's(?![\w-])", "the first tree's"), (r"(?<![\w/.-])TR1(?![\w-])", "the first tree load"), (r"(?<![\w/.-])TR2(?![\w-])", "this revision"), (r"(?<![\w/.-])CO1(?![\w-])", "the cohort study"),
    (r"(?<![\w/.-])tr1(?![\w-])", "the first tree"), (r"(?<![\w/.-])tr2(?![\w-])", "this revision")]
def plain(doc):
    out = []; skip = 0
    for part in re.split(r"(<[^>]+>)", doc):
        if part.startswith("<"):
            if re.match(r"<(style|script|code)\b", part): skip += 1
            elif re.match(r"</(style|script|code)>", part): skip -= 1
            out.append(part); continue
        if not skip:
            for a, b in CODE_WORDS: part = re.sub(a, b, part)
        out.append(part)
    doc = "".join(out)
    left = sorted(set(re.findall(r"(?<![\w/.-])(?:TR\d|CO\d|NQ\d|NP\d|HB\d|LB\d|CP\d|ER\d|PF\d|CF\d|SG\d|BT\d)(?![\w-])", re.sub(r"<(style|script|code)\b.*?</\1>|<[^>]+>", " ", doc, flags=re.S))))
    if left: sys.exit("A helper code is still on the page: " + ", ".join(left))
    return doc
page = plain(page)

# ── the colour rule: every colour a grey (channels within 24, none above 210). Fail loudly. ────────────────────────
def colour_check(doc):
    bad = []
    def chk(src, r, g, b):
        if max(r, g, b) - min(r, g, b) > 24 or max(r, g, b) > 210: bad.append(src)
    for m in re.finditer(r"(?<![&\w])#([0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", doc):
        h = m.group(1); h = "".join(c * 2 for c in h) if len(h) == 3 else h
        chk(m.group(0), int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16))
    for m in re.finditer(r"rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)", doc): chk(m.group(0), int(m.group(1)), int(m.group(2)), int(m.group(3)))
    bad += re.findall(r"(?:color|background|fill|stroke|border|outline)[a-z-]*\s*[:=]\s*[\"']?\s*(?:white|black|red|green|blue|yellow|orange|purple|pink|cyan|magenta|silver|gray|grey)\b", doc)
    if bad: sys.exit("COLOUR RULE BROKEN (not a grey within 24, or above 210): " + ", ".join(sorted(set(bad))))
    return len(set(re.findall(r"(?<![&\w])#(?:[0-9a-fA-F]{6}|[0-9a-fA-F]{3})\b", doc)))
NCOL = colour_check(page)

# ── the BACK / CLOSE pair: inject-scnav.py's own BLOCK, ensure_slot and SNIPPET, on this page only ─────────────────
spec = importlib.util.spec_from_file_location("inject_scnav", os.path.join(ROOT, "scripts", "inject-scnav.py")); nav = importlib.util.module_from_spec(spec); spec.loader.exec_module(nav)
REL = "deliverables/20261006/tree-revision/TREE-REVISION.html"
def place(doc):
    if doc.count("</body>") != 1: sys.exit(REL + ": expected exactly one </body>")
    new = nav.BLOCK.sub("\n", doc); new, where = nav.ensure_slot(new, REL)
    return new.replace("</body>", nav.SNIPPET + "\n</body>", 1), where
out, where = place(page)
if place(out)[0] != out: sys.exit("the BACK / CLOSE placement does not repeat cleanly")
open(os.path.join(D, "TREE-REVISION.html"), "w", encoding="utf-8").write(out)
print(json.dumps({"bytes": len(out.encode()), "nodes_listed": len(FULL), "picture_lines": NLINES, "distinct_colours_checked": NCOL, "scnav": where, "waiting": [n for n, x in (("migration-dry-run.json", MIG), ("next-funds-tree-dry-run.json", NFD), ("next-sitting.json", SIT)) if not x]}))
