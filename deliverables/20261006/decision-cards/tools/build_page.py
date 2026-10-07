# CP1 · builds DECISION-CARDS.html and data/cards.json from the run's JSON (comps-before-after, cards-data, knockout-*).
# Static page: inline SVG, no script of its own, nothing fetched — so it cannot shift between visits. Every explanatory
# sentence is in PAGE SPECS at the bottom; the panels carry labels, units and numbers only. The BACK / CLOSE pair is
# placed exactly as scripts/inject-scnav.py places it (a slot in the header, the snippet before </body>), so running the
# injector afterwards leaves this page as it is.
#   python3 tools/build_page.py        (from deliverables/20261006/decision-cards/)
import json, html, os, math, datetime as dt
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.dirname(HERE); DATA = os.path.join(ROOT, "data")
J = lambda f: json.load(open(os.path.join(DATA, f), encoding="utf-8"))
C, CD, META, KL, KC = J("comps-before-after.json"), J("cards-data.json"), J("comps-run-meta.json"), J("knockout-before-after.json"), J("knockout-comps.json")
E = html.escape
UP, DN, CY, INK, DIM, FAINT, LINE, PANEL = "#3caa6e", "#c85050", "#3cb4c8", "#c8c8cc", "#8c8c92", "#5a5a60", "#26262b", "#111114"
FULL = ["MU", "SNDK"]
ASKED = ["WDC", "AVGO", "GOOGL", "AMZN", "VST", "NBIS", "BE", "IREN", "EQIX", "DLR", "IRM", "LRCX", "CRDO", "COHR"]      # the coordinator's card list
MORE = ["STX", "NVDA", "AMAT", "CEG", "LLY", "JPM", "BAC", "ORCL", "CRWV", "AME"]                                         # the rest of the comps and knockout names
ORDER = FULL + ASKED + MORE
PLAN_GIVEN = {"MU": {"said": "Alan, 6 Oct", "buy_zone": "below 1,000 down to ~920 (his drawn box 920–966)", "stop": "below ~900", "magnet": "the 100-day (~959); 50-day and 100-day nearly on top of each other",
                     "entries": "first part at the 21-day (~1,028) · second at the 50-day", "between": "21-day · 3D P3 (~1,000–1,011) · 3D C3 · 1D D3"}}

def money(v, d=None):
    if v is None: return "—"
    d = (2 if abs(v) < 100 else 0) if d is None else d
    return "$" + f"{v:,.{d}f}"
def px(v): return "—" if v is None else f"{v:,.2f}"
def plain(v, d=0):            # growth and margins: no plus sign, negatives in parentheses (Alan, 1 Oct)
    if v is None: return "—"
    return f"({abs(v):.{d}f}%)" if v < 0 else f"{v:.{d}f}%"
def signed(v, d=0, unit="%"):
    if v is None: return "—"
    return ("+" if v > 0 else "−" if v < 0 else "") + f"{abs(v):.{d}f}{unit}"
def col(v): return DIM if v is None or v == 0 else (UP if v > 0 else DN)
def sp(v, d=0, unit="%"): return f'<span style="color:{col(v)}">{signed(v, d, unit)}</span>'
def mult(v): return "—" if v is None else (f"{v:.2f}×" if abs(v) < 10 else f"{v:.0f}×")
def ordinal(n):
    n = int(round(n)); return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
def pct_word(p): return "—" if p is None else ordinal(p) + " pct"

# ------------------------------------------------------------------ the card record (what decision_cards would hold)
def record(t):
    c, n = C[t], CD["names"][t]; a, b, F, T, G, L, R = c["after"], c["before"], n["fund"], n["tech"], n["geiger"], n["lines"], n["risk"]
    fy0, fy1, fy2, ntm = F.get("fy0") or {}, F.get("fy1") or {}, F.get("fy2") or {}, F.get("ntm") or {}
    two = lambda k: None if not (fy0.get(k) and fy2.get(k) and fy0[k] > 0 and fy2[k] > 0) else (math.sqrt(fy2[k] / fy0[k]) - 1) * 100
    rev = (F.get("revision") or {}).get("fy1") or {}
    biz = a.get("priced_on") == "business"; peers = a.get("business_peers") if biz else [r["ticker"] for r in c["set_after"] if not r["reference"] and r["ticker"] not in [o["ticker"] for o in a["outliers"]]]
    flags = []
    if a.get("no_peer_set"): flags.append("no peer set")
    if biz and len(peers) < 4: flags.append(f"thin: {len(peers)} peers")
    if a.get("fragile"): flags.append(f"fragile: {a['fragile']['n']} of {a['fragile']['of']}")
    if not biz and (a.get("business") or {}).get("mostlyDifferent"): flags.append("mostly different business")
    pend = [r["ticker"] for r in c["set_after"] if r["reference"] and not r["has_figures"]]
    if pend: flags.append(f"{len(pend)} reference peers without figures")
    return {"ticker": t, "name": c["name"], "card_date": CD["as_of"]["card_date"], "price": a["price"], "price_is": (n["quote"] or {}).get("price_is"), "last": (n["quote"] or {}).get("last"), "previous_close": (n["quote"] or {}).get("previous_close"),
        "parents": n["parents"], "cohorts": [x["label"] for x in n["cohorts"]], "line": c["lines_after"],
        "fundamentals": {"this_fy": fy1.get("date"), "rev_g_this_fy": fy1.get("rev_g"), "eps_g_this_fy": fy1.get("eps_g"), "next_fy": fy2.get("date"), "rev_g_next_fy": fy2.get("rev_g"), "eps_g_next_fy": fy2.get("eps_g"),
            "rev_g_ntm": ntm.get("rev_g"), "eps_g_ntm": ntm.get("eps_g"), "rev_g_2y_a_year": two("revenue"), "eps_g_2y_a_year": two("eps"), "fwd_pe": ntm.get("fwd_pe"), "eps_ntm": ntm.get("eps"),
            "revision_fy1_eps_pct": rev.get("eps_pct"), "revision_fy1_rev_pct": rev.get("rev_pct"), "revision_from": rev.get("from"), "revision_to": rev.get("to"), "revision_copies": rev.get("copies"),
            "targets_30d": {k: (F.get("targets") or {}).get(k) for k in ("n", "raised", "lowered", "kept")}, "target_avg": F.get("target_avg"), "target_vs_price_pct": F.get("target_vs_price_pct"), "ratings": F.get("ratings"),
            "last_report": F.get("last_report"), "next_report": F.get("next_report"), "why": F.get("why")},
        "comps": {"priced_on": "none" if a.get("no_peer_set") else a.get("priced_on"), "peers_priced": peers, "n_priced": len(peers or []), "low": (a.get("band") or {}).get("lo"), "centre": (a.get("band") or {}).get("centre"), "high": (a.get("band") or {}).get("hi"), "upside_pct": a.get("upside_pct"),
            "peers_say": a.get("band_from_peers") if a.get("no_peer_set") else None, "self": (a.get("self") or {}).get("words") if a.get("no_peer_set") else None,
            "whole_set": a.get("whole_set"), "before": {"centre": (b.get("band") or {}).get("centre"), "upside_pct": b.get("upside_pct"), "n": b["n"]}, "flags": flags,
            "rows": {k: {x: v.get(x) for x in ("label", "own", "median", "n", "price", "q1", "q3", "weight", "credit", "off")} for k, v in a["rows"].items()}, "growth_credit": ((a.get("cp1") or {}).get("growth") or {}).get("credit"), "sales_rows_off": bool(((a.get("cp1") or {}).get("margin") or {}).get("off")), "reit_yardstick": bool((a.get("cp1") or {}).get("reit"))},
        "technicals": {"geiger": G.get("live"), "geiger_trend": G.get("trend"), "geiger_momentum": G.get("momentum"), "geiger_pctl_own_year": G.get("pctl"), "geiger_own_median": G.get("median"), "geiger_own_p10": G.get("p10"), "geiger_own_p90": G.get("p90"), "geiger_read_utc": G.get("computed_utc"), "geiger_history": G.get("source"),
            "rsi14": T.get("rsi14"), "rsi_pctl_own_year": T.get("rsi_pctl"), "rsi_own_p10": T.get("rsi_p10"), "rsi_own_p90": T.get("rsi_p90"),
            **{f"sma{k}": T.get(f"sma{k}") for k in (21, 50, 100, 200)}, **{f"vs_sma{k}_pct": T.get(f"vs_sma{k}_pct") for k in (21, 50, 100, 200)}, **{f"sma{k}_rising": T.get(f"sma{k}_rising") for k in (21, 50, 100, 200)},
            "hi_52w": T.get("hi_52w"), "from_high_pct": T.get("from_high_pct"), "ret_5": T.get("ret_5"), "ret_21": T.get("ret_21"), "ret_63": T.get("ret_63"),
            "lines_reviewed": bool(L.get("reviewed")), "lines_n": L.get("n"), "lines_below": (L.get("below2") or [])[:3], "lines_above": (L.get("above2") or [])[:3], "lines_pending": L.get("pending") or [], "lines_as_of": L.get("levels_as_of")},
        "risk": {"usual_day_60": R.get("usual_day_60"), "spy_usual_day_60": R.get("spy_usual_day_60"), "x_spy": R.get("x_spy"), "risk_equal_share": R.get("risk_equal_share"), "as_of": R.get("as_of"), "atr_pct_14": R.get("atr_pct_14")},
        "plan": {"core_or_conviction": None, "entry_levels": None, "size_by_risk": None, "exit_trim_rule": None, "given": PLAN_GIVEN.get(t)}}
REC = {t: record(t) for t in ORDER if t in C and C[t].get("ok") and t in CD["names"]}
json.dump({"what": "one record per name: the facts and the levels of the decision card, the plan fields empty for Alan", "as_of": CD["as_of"], "price_is": META["price_is"], "comps_code": META["comps_code"], "switches": META["switches"], "cards": REC}, open(os.path.join(DATA, "cards.json"), "w", encoding="utf-8"), indent=1)

# ------------------------------------------------------------------ pictures
def football(t, W=640, big=True):   # W = the picture's own width in px (close to the width it is shown at, so 12px text stays 11px or more)
    r = REC[t]["comps"]; a = C[t]["after"]; price = REC[t]["price"]; rows = [(k, v) for k, v in r["rows"].items() if v.get("price") is not None]
    band = (r["low"], r["centre"], r["high"]) if r["centre"] else ((r["peers_say"] or {}).get("lo"), (r["peers_say"] or {}).get("centre"), (r["peers_say"] or {}).get("hi")) if r["peers_say"] else (None, None, None)
    ws = (r["whole_set"] or {}).get("band") or None
    xs = [price] + [x for x in band if x] + [v[q] for _, v in rows for q in ("q1", "q3", "price") if v.get(q)]
    lo, hi = min(xs) * 0.86, min(max(xs) * 1.06, price * 5)
    LW, RW = (226 if big else 158), (128 if big else 62); m1 = (lambda v: mult(v)) if big else (lambda v: "—" if v is None else (f"{v:.1f}×" if abs(v) < 10 else f"{v:.0f}×")); X = lambda v: LW + (max(lo, min(hi, v)) - lo) / (hi - lo) * (W - LW - RW)
    FS = 12; rh = 24 if big else 20; H = 26 + rh * len(rows) + (58 if band[1] else 30) + (26 if ws else 0); o = [f'<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="{t} comps range per share" style="display:block" font-size="{FS}">']
    short = {"P/E, trailing": "P/E", "P/E trailing": "P/E", "P/E, forward": "P/E FWD", "P/E forward": "P/E FWD", "EV / EBITDA": "EV/EBITDA", "EV / sales": "EV/S", "EV/sales": "EV/S"}
    y = 14
    for k, v in rows:
        off = bool(v.get("off")); c = FAINT if off else CY; q1, q3, m = v.get("q1") or v["price"], v.get("q3") or v["price"], v["price"]
        o.append(f'<text x="0" y="{y+4}" fill="{DIM if not off else FAINT}">{E((v["label"] if big else short.get(v["label"], v["label"])).upper())}</text><text x="{LW-10}" y="{y+4}" fill="{FAINT}" text-anchor="end">{m1(v["own"])} v {m1(v["median"])}</text>')
        o.append(f'<rect x="{X(min(q1,q3)):.1f}" y="{y-4}" width="{max(2, abs(X(q3)-X(q1))):.1f}" height="8" fill="{c}" opacity="{0.22 if off else 0.38}"/><rect x="{X(m)-1.5:.1f}" y="{y-6}" width="3" height="12" fill="{c}"/>')
        if m > hi: o.append(f'<text x="{W-RW-2}" y="{y+4}" fill="{c}" text-anchor="end">▸</text>')
        o.append(f'<text x="{W}" y="{y+4}" fill="{FAINT if off else INK}" text-anchor="end">{money(m,0)}{(" · left out" if big else " · out") if off else (" · " + str(round((v.get("weight") or 0)*100)) + "%" if big else "")}</text>')
        y += rh
    y += 8
    if band[1]:
        dead = REC[t]["comps"]["priced_on"] == "none"; c = FAINT if dead else CY; xl, xc, xh = X(band[0]), X(band[1]), X(band[2])
        o.append(f'<rect x="{xl:.1f}" y="{y}" width="{max(3, xh-xl):.1f}" height="16" fill="{c}" opacity="{0.35 if dead else 0.55}"/><rect x="{xc-2:.1f}" y="{y-4}" width="4" height="24" fill="{c}"/>')
        o.append(f'<text x="0" y="{y+12}" fill="{INK if not dead else DIM}" font-weight="700">{("PEERS SAY · NOT USED" if big else "NOT USED") if dead else "THE RANGE"}</text>')
        o.append(f'<text x="{max(96 if big else 78, xl-6):.1f}" y="{y+12}" fill="{DIM}" text-anchor="{"end" if xl-6 > (176 if big else 140) else "start"}">{"LOW " if big else ""}{money(band[0],0)}</text>')
        o.append(f'<text x="{min(W-2, xh+6):.1f}" y="{y+12}" fill="{DIM}" text-anchor="{"start" if xh+6 < W-(96 if big else 62) else "end"}">{"HIGH " if big else ""}{money(band[2],0)}</text>')
        o.append(f'<text x="{min(W-60, max(LW, xc)):.1f}" y="{y+36}" fill="{INK if not dead else DIM}" text-anchor="middle" font-weight="700">{"CENTRE " if big else ""}{money(band[1],0)}</text>')
        y += 44
    if ws:
        o.append(f'<rect x="{X(ws["lo"]):.1f}" y="{y}" width="{max(3, X(ws["hi"])-X(ws["lo"])):.1f}" height="6" fill="{FAINT}" opacity=".7"/><rect x="{X(ws["centre"])-1.5:.1f}" y="{y-3}" width="3" height="12" fill="{DIM}"/><text x="0" y="{y+7}" fill="{FAINT}">WHOLE SET</text><text x="{W}" y="{y+7}" fill="{FAINT}" text-anchor="end">{money(ws["centre"],0)}{" ▸" if ws["centre"] > hi else ""}</text>')
        y += 22
    o.append(f'<line x1="{X(price):.1f}" y1="2" x2="{X(price):.1f}" y2="{y-2}" stroke="{INK}" stroke-width="1" stroke-dasharray="3 3"/><text x="{X(price)+4:.1f}" y="{y+4}" fill="{INK}">PRICE {px(price)}</text></svg>')
    return "".join(o)

def gbar(v, p10, med, p90, lo=-1.0, hi=1.0, W=300, label=""):
    if v is None: return ""
    X = lambda x: 4 + (max(lo, min(hi, x)) - lo) / (hi - lo) * (W - 8); o = [f'<svg viewBox="0 0 {W} 26" width="100%" role="img" aria-label="{E(label)}" style="display:block;max-width:{W}px"><rect x="4" y="10" width="{W-8}" height="6" fill="{LINE}"/>']
    if p10 is not None and p90 is not None: o.append(f'<rect x="{X(p10):.1f}" y="10" width="{max(2, X(p90)-X(p10)):.1f}" height="6" fill="{FAINT}"/>')
    if med is not None: o.append(f'<rect x="{X(med)-1:.1f}" y="7" width="2" height="12" fill="{DIM}"/>')
    o.append(f'<rect x="{X(v)-2.5:.1f}" y="3" width="5" height="20" fill="{INK}"/></svg>'); return "".join(o)

def ladder_mu(W=640, H=560, narrow=False):
    r = REC["MU"]; L = CD["names"]["MU"]["lines"]["all"]; T = r["technicals"]; price = r["price"]; lo, hi = 850.0, 1170.0; FS = 12 if narrow else 13
    Y = lambda v: 16 + (hi - v) / (hi - lo) * (H - 32); o = [f'<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="MU levels" style="display:block" font-size="{FS}">']
    x0, x1 = (112, W - 104) if narrow else (150, W - 232); gap = FS + 2
    o.append(f'<rect x="{x0}" y="{Y(1000):.1f}" width="{x1-x0}" height="{Y(920)-Y(1000):.1f}" fill="{UP}" opacity=".10"/><rect x="{x0}" y="{Y(966):.1f}" width="{x1-x0}" height="{Y(920)-Y(966):.1f}" fill="{UP}" opacity=".14"/>')
    o.append(f'<text x="{x0+5}" y="{Y(1000)+FS+2:.1f}" fill="{UP}">{"BUY ZONE" if narrow else "BUY ZONE · BELOW 1,000 TO ~920"}</text><text x="{x0+5}" y="{Y(920)-5:.1f}" fill="{UP}">{"BOX 920–966" if narrow else "HIS BOX · 920–966"}</text>')
    o.append(f'<line x1="{x0}" y1="{Y(900):.1f}" x2="{x1}" y2="{Y(900):.1f}" stroke="{DN}" stroke-width="1.5"/><text x="{x0+5}" y="{Y(900)+FS+3:.1f}" fill="{DN}">{"STOP ~900" if narrow else "STOP · BELOW ~900"}</text>')
    lev = [x for x in L if lo <= x["level"] <= hi]; last = None
    for x in sorted(lev, key=lambda z: -z["level"]):
        y = Y(x["level"]); ty = y + 4
        if last is not None and ty - last < gap: ty = last + gap
        last = ty; o.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" stroke="{INK}" stroke-width="1" opacity=".55"/><line x1="{x0-14}" y1="{ty-4:.1f}" x2="{x0}" y2="{y:.1f}" stroke="{FAINT}" stroke-width="1"/>')
        o.append(f'<text x="{x0-17}" y="{ty:.1f}" fill="{INK}" text-anchor="end">{E(x["label"])}{" " if narrow else " · "}{(format(x["level"], ",.0f") if narrow else px(x["level"]))}</text>')
    lastr = None
    for k, word in ((21, "21-DAY"), (50, "50-DAY"), (100, "100-DAY")):
        v = T[f"sma{k}"]; y = Y(v); ty = y + 4
        if lastr is not None and ty - lastr < gap: ty = lastr + gap
        mc = UP if T[f"sma{k}_rising"] else DN
        lab = f'{k}D {v:,.0f}' if narrow else f'{word} · {px(v)} {"▲" if T[f"sma{k}_rising"] else "▼"}{" · MAGNET" if k == 100 else ""}'
        lastr = ty; o.append(f'<line x1="{x0}" y1="{y:.1f}" x2="{x1}" y2="{y:.1f}" stroke="{mc}" stroke-width="1.2" stroke-dasharray="5 4"/><line x1="{x1}" y1="{y:.1f}" x2="{x1+14}" y2="{ty-4:.1f}" stroke="{FAINT}" stroke-width="1"/><text x="{x1+17}" y="{ty:.1f}" fill="{mc}">{lab}</text>')
    y = Y(price); cw = 118 if narrow else 132
    o.append(f'<line x1="{x0-6}" y1="{y:.1f}" x2="{x1+6}" y2="{y:.1f}" stroke="{INK}" stroke-width="2.5"/><rect x="{x1-cw}" y="{y-FS-10:.1f}" width="{cw}" height="{FS+6}" fill="#0a0a0c"/><text x="{x1-4}" y="{y-8:.1f}" fill="{INK}" font-weight="700" text-anchor="end">CLOSE {px(price)}</text>')
    o.append("</svg>"); return "".join(o)

def scatter(W=640, H=330, narrow=False):
    R = KC["after"]["ranked"]; L, B = 44, 38; FS = 12 if narrow else 13; X = lambda p: L + p / 100 * (W - L - 12); Y = lambda s: 10 + (1 - s) * (H - B - 10)
    o = [f'<svg viewBox="0 0 {W} {H}" width="100%" role="img" aria-label="fundamentals score against own-year Geiger percentile" style="display:block" font-size="{FS}">']
    o.append(f'<rect x="{X(0):.1f}" y="10" width="{X(33)-X(0):.1f}" height="{H-B-10}" fill="{LINE}" opacity=".5"/><rect x="{X(67):.1f}" y="10" width="{X(100)-X(67):.1f}" height="{H-B-10}" fill="{LINE}" opacity=".5"/>')
    for sc in (0, 0.25, 0.5, 0.75, 1): o.append(f'<line x1="{L}" y1="{Y(sc):.1f}" x2="{W-12}" y2="{Y(sc):.1f}" stroke="{LINE}"/><text x="{L-6}" y="{Y(sc)+4:.1f}" fill="{FAINT}" text-anchor="end">{sc:.2f}</text>')
    o.append(f'<text x="{X(16):.1f}" y="{H-20}" fill="{DIM}" text-anchor="middle">{"COLD" if narrow else "COLD FOR ITSELF"}</text><text x="{X(83):.1f}" y="{H-20}" fill="{DIM}" text-anchor="middle">{"HOT" if narrow else "HOT FOR ITSELF"}</text><text x="{X(50):.1f}" y="{H-4}" fill="{FAINT}" text-anchor="middle">{"GEIGER · PCT OF OWN YEAR →" if narrow else "GEIGER · PERCENTILE OF ITS OWN YEAR →"}</text>')
    seen = []
    for e in sorted(R, key=lambda z: -z["score"]):
        if e["g_pctl"] is None: continue
        x, y = X(e["g_pctl"]), Y(e["score"]); ty = y + 4; left = x > W - 70
        while any(abs(ty - b) < FS and abs(x - a) < 50 for a, b in seen): ty += FS
        seen.append((x, ty)); o.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="3.5" fill="{CY}"/><text x="{(x-7) if left else (x+7):.1f}" y="{ty:.1f}" fill="{INK}" text-anchor="{"end" if left else "start"}">{e["sym"]}</text>')
    o.append("</svg>"); return "".join(o)

def circles(v):   # C4's four sources, one circle each: filled = the source names it · hollow = it does not · dashed = not on file
    def c(state, word):
        s = f'fill="{CY}" stroke="{CY}"' if state is True else f'fill="none" stroke="{FAINT}" stroke-dasharray="2 2"' if state is None else f'fill="none" stroke="{DIM}"'
        return f'<span class="circ"><svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true"><circle cx="6" cy="6" r="4.5" {s} stroke-width="1.3"/></svg>{word}</span>'
    return c(v["fmp"], "FMP") + c(v["massive"], "MASSIVE") + c(v["industry"], "INDUSTRY") + c(v["fund"], "FUND" + (" " + "·".join(v["funds"]) if v["funds"] else ""))

# ------------------------------------------------------------------ card blocks
def flagchips(r):
    out = []
    for f in r["comps"]["flags"]:
        if f != "no peer set": out.append(f'<span class="chip warn">{E(f.upper())}</span>')
    return "".join(out)
def growth_table(r, big):
    f = r["fundamentals"]; yr = lambda d: "FY" + d[2:4] if d else "—"
    if f.get("why") and f.get("rev_g_ntm") is None: return f'<div class="dim">{E(f["why"].upper())}</div>'
    rows = [("NEXT 12 MONTHS", f["rev_g_ntm"], f["eps_g_ntm"]), (f"THIS FISCAL YEAR · {yr(f['this_fy'])}", f["rev_g_this_fy"], f["eps_g_this_fy"]), (f"NEXT FISCAL YEAR · {yr(f['next_fy'])}", f["rev_g_next_fy"], f["eps_g_next_fy"]), ("TWO YEARS, A YEAR", f["rev_g_2y_a_year"], f["eps_g_2y_a_year"])]
    if not big: rows = [rows[0], rows[3]]
    return '<table class="t"><tr><th></th><th>REVENUE</th><th>EPS</th></tr>' + "".join(f'<tr><td class="lab">{a}</td><td>{plain(b)}</td><td>{plain(c)}</td></tr>' for a, b, c in rows) + "</table>"
def est_block(r, big):
    f = r["fundamentals"]; t = f["targets_30d"]; lr, nr = f.get("last_report") or {}, f.get("next_report") or {}
    bits = [("FORWARD P/E", mult(f["fwd_pe"])), (f"FY EPS ESTIMATE · SINCE {(f['revision_from'] or '')[5:] or '—'}", sp(f["revision_fy1_eps_pct"], 1) if f["revision_fy1_eps_pct"] is not None else "—"),
            ("TARGETS · 30 DAYS", f'<span style="color:{UP}">{t.get("raised") or 0} raised</span> · <span style="color:{DN}">{t.get("lowered") or 0} lowered</span>'), ("AVERAGE TARGET", f'{money(f["target_avg"],0)} · {sp(f["target_vs_price_pct"])}' if f.get("target_avg") else "—")]
    if big: bits += [("LAST REPORT · " + (lr.get("date") or "—"), f'EPS {sp(lr.get("surprise_pct"),1)} · revenue {sp(lr.get("rev_surprise_pct"),1)} v estimate' if lr else "—"), ("NEXT REPORT", f'{nr.get("date","—")} · {nr.get("days","—")} days' if nr else "—")]
    else: bits += [("NEXT REPORT", f'{nr.get("date","—")[5:]} · {nr.get("days","—")}d' if nr else "—")]
    return '<div class="kv">' + "".join(f'<div><span class="lab">{a}</span><b>{b}</b></div>' for a, b in bits) + "</div>"
def comps_block(t, big):
    r = REC[t]["comps"]; head = ""
    if r["priced_on"] == "none": head = f'<div class="nopeer">NO PEER SET — VALUED ON GROWTH (PEG) AND ESTIMATES</div>'
    else: head = f'<div class="bandline"><span class="lab">COMPS CENTRE</span><b class="num">{money(r["centre"],0)}</b>{sp(r["upside_pct"])}<span class="dim">LOW {money(r["low"],0)} · HIGH {money(r["high"],0)}</span></div>'
    on = (f'PRICED ON {r["n_priced"]} SAME-BUSINESS PEERS · ' + " ".join(r["peers_priced"])) if r["priced_on"] == "business" else f'PRICED ON {r["n_priced"]} PEERS' if r["priced_on"] == "set" else "THE PEERS' READING IS SHOWN, NOT USED ·"
    was = f'<span class="dim">BEFORE THE FIXES {money(r["before"]["centre"],0)} · {signed(r["before"]["upside_pct"])}</span>'
    pic = ('<div class="w">' + football(t, 700 if t == "MU" else 460, t == "MU") + '</div><div class="n">' + football(t, 348, False) + '</div>') if big else football(t, 348, False)
    return f'{head}<div class="sub">{E(on)} {was}</div><div class="chips">{flagchips(REC[t])}</div>{pic}'
def tech_block(r, big):
    T = r["technicals"]
    g = f'<div class="gline"><span class="lab">GEIGER</span><b class="num">{signed(T["geiger"],2,"")}</b><span class="dim">{pct_word(T["geiger_pctl_own_year"])} OF ITS OWN YEAR</span></div>{gbar(T["geiger"], T["geiger_own_p10"], T["geiger_own_median"], T["geiger_own_p90"], label="Geiger against its own year")}'
    rs = f'<div class="gline"><span class="lab">RSI 14</span><b class="num">{("—" if T["rsi14"] is None else format(T["rsi14"], ".0f"))}</b><span class="dim">{pct_word(T["rsi_pctl_own_year"])} OF ITS OWN YEAR</span></div>{gbar(T["rsi14"], T["rsi_own_p10"], None, T["rsi_own_p90"], 0, 100, label="RSI against its own year")}'
    ks = (21, 50, 100, 200) if big else (21, 50, 200)
    ma = '<table class="t"><tr>' + "".join(f"<th>{k}-DAY</th>" for k in ks) + "<th>52-WK HIGH</th></tr><tr>" + "".join(f'<td>{px(T[f"sma{k}"])}<br>{sp(T[f"vs_sma{k}_pct"],1)}</td>' for k in ks) + f'<td>{px(T["hi_52w"])}<br>{sp(T["from_high_pct"],1)}</td></tr></table>'
    return f'<div class="two">{g}{rs}</div>{ma}'
def lines_block(r, big):
    T = r["technicals"]
    if not T["lines_reviewed"]: return f'<div class="dim">REVIEWED LINES · NOT REVIEWED BY THE LAB YET{(" · PENDING " + " ".join(T["lines_pending"])) if T["lines_pending"] else ""}</div>'
    row = lambda x: f'<tr><td class="lab">{E(x["label"])}</td><td>{px(x["level"])}</td><td>{sp(x["pct"],1)}</td></tr>'
    ab = list(reversed(T["lines_above"][: (3 if big else 2)])); be = T["lines_below"][: (3 if big else 2)]
    return f'<table class="t"><tr><th>REVIEWED LINE</th><th>LEVEL</th><th>FROM PRICE</th></tr>{"".join(row(x) for x in ab)}<tr class="pricerow"><td class="lab">PRICE</td><td>{px(r["price"])}</td><td></td></tr>{"".join(row(x) for x in be)}</table>'
def risk_block(r, big):
    R = r["risk"]
    if not R.get("x_spy"): return '<div class="dim">RISK · NO USUAL-DAY FIGURE ON FILE</div>'
    return f'<div class="kv"><div><span class="lab">USUAL DAY</span><b>{R["usual_day_60"]:.2f}%</b></div><div><span class="lab">SPY\'S</span><b>{R["spy_usual_day_60"]:.2f}%</b></div><div><span class="lab">TIMES SPY</span><b>{R["x_spy"]:.1f}×</b></div><div><span class="lab">RISK-EQUAL POSITION</span><b>{R["risk_equal_share"]*100:.0f}% OF THE DOLLARS</b></div></div>'
def plan_block(r, big):
    g = r["plan"]["given"] or {}; blank = '<i class="blank">—</i>'
    rows = [("CORE OR CONVICTION", blank), ("ENTRY LEVELS", E(g["entries"]) if g else blank), ("SIZE BY RISK", blank), ("EXIT / TRIM RULE", blank)]
    if g: rows[1:1] = [("BUY ZONE", E(g["buy_zone"])), ("STOP", E(g["stop"])), ("MAGNET", E(g["magnet"])), ("BETWEEN PRICE AND THE 100-DAY", E(g["between"]))]
    return '<div class="plan"><div class="plh">THE PLAN — ALAN\'S' + (f' · AS GIVEN, {E(g["said"]).upper()}' if g else "") + "</div>" + "".join(f'<div class="plr"><span class="lab">{a}</span><span>{b}</span></div>' for a, b in rows) + "</div>"
def head_block(t, big):
    r = REC[t]; day = (r["price"] / r["previous_close"] - 1) * 100 if r.get("previous_close") else None
    par = "".join(f'<span class="chip">{p}</span>' for p in r["parents"]) or '<span class="chip">NO PARENT FUND</span>'
    return f'<div class="chead"><div><span class="tk">{t}</span><span class="nm">{E(r["name"] or "")}</span></div><div class="pxl"><b class="num">{px(r["price"])}</b>{sp(day,1)}</div></div><div class="sub">{E((r["cohorts"][0] if r["cohorts"] else r["line"]).upper())} · PARENTS {par}</div>'
def card(t, big=False):
    r = REC[t]
    return f'''<article class="card{' big' if big else ''}" id="card-{t}">{head_block(t, big)}
<h3>FUNDAMENTALS</h3>{growth_table(r, big)}{est_block(r, big)}{comps_block(t, big)}
<h3>TECHNICALS</h3>{tech_block(r, big)}{lines_block(r, big)}
<h3>RISK</h3>{risk_block(r, big)}{plan_block(r, big)}</article>'''

# ------------------------------------------------------------------ MU's own sections
def mu_levels():
    r = REC["MU"]; T = r["technicals"]; L = [x for x in CD["names"]["MU"]["lines"]["all"] if 860 <= x["level"] <= 1160]
    items = [(x["level"], x["label"], "line", x["pct"]) for x in L] + [(T[f"sma{k}"], f"{k}-day average", "ma", T[f"vs_sma{k}_pct"] * -1 / (1 + T[f"vs_sma{k}_pct"] / 100) if False else (T[f"sma{k}"] / r["price"] - 1) * 100) for k in (21, 50, 100)]
    items.sort(key=lambda z: -z[0]); out = ['<table class="t"><tr><th>LEVEL</th><th>WHAT</th><th>FROM THE CLOSE</th><th>IN ALAN\'S PLAN</th></tr>']
    def note(v, lab):
        if lab == "21-day average": return "first part"
        if lab == "50-day average": return "second part"
        if lab == "100-day average": return "the magnet"
        if 920 <= v <= 966: return "inside his box"
        if 920 <= v < 1000: return "inside the buy zone"
        if v < 900: return "below the stop"
        if 1000 <= v < r["price"]: return "between price and the zone"
        return ""
    placed = False
    for v, lab, kind, pc in items:
        if not placed and v < r["price"]: out.append(f'<tr class="pricerow"><td>{px(r["price"])}</td><td class="lab">CLOSE · 6 OCT</td><td></td><td></td></tr>'); placed = True
        out.append(f'<tr><td>{px(v)}</td><td class="lab" style="white-space:nowrap;color:{(UP if T["sma" + lab.split("-")[0] + "_rising"] else DN) if kind=="ma" else INK}">{E(lab.upper() if kind=="ma" else lab)}</td><td>{sp(pc,1)}</td><td class="dim">{note(v, lab).upper()}</td></tr>')
    out.append(f'<tr><td class="dim">—</td><td class="lab">1D D3</td><td class="dim">—</td><td class="dim">PICKED ON THE LAB\'S 6 OCT DAILY REVIEW · LEVEL NOT IN THE EXTRACT YET</td></tr></table>')
    return "".join(out)
def mu_size():
    r = REC["MU"]; T = r["technicals"]; stop = 900.0; e1, e2 = T["sma21"], T["sma50"]; avg = (e1 + e2) / 2
    d = lambda e: (stop / e - 1) * 100
    head = '<table class="t"><tr><th>ENTRY</th><th>PRICE</th><th>TO THE STOP (900)</th><th>POSITION IF 0.5% OF THE ACCOUNT IS AT RISK</th><th>IF 1%</th><th>IF 2%</th></tr>'
    rows = [("FIRST PART · 21-DAY", e1), ("SECOND PART · 50-DAY", e2), ("HALF AT EACH", avg), ("AT THE CLOSE", r["price"])]
    return head + "".join(f'<tr><td class="lab">{a}</td><td>{px(e)}</td><td>{sp(d(e),1)}</td>' + "".join(f"<td>{b / abs(d(e)) * 100:.1f}%</td>" for b in (0.5, 1, 2)) + "</tr>" for a, e in rows) + "</table>"
def alternate():
    a, b = REC["MU"], REC["SNDK"]; rows = [("5 SESSIONS", "ret_5", 1), ("21 SESSIONS", "ret_21", 1), ("63 SESSIONS", "ret_63", 1), ("FROM THE 52-WEEK HIGH", "from_high_pct", 1)]
    out = '<table class="t"><tr><th></th><th>MU</th><th>SNDK</th><th>LAGGING</th></tr>'
    for lab, k, d in rows:
        x, y = a["technicals"][k], b["technicals"][k]; out += f'<tr><td class="lab">{lab}</td><td>{sp(x,d)}</td><td>{sp(y,d)}</td><td class="lab">{"SNDK" if y < x else "MU"}</td></tr>'
    x, y = a["technicals"]["geiger_pctl_own_year"], b["technicals"]["geiger_pctl_own_year"]
    out += f'<tr><td class="lab">GEIGER · PCT OF OWN YEAR</td><td>{ordinal(x)}</td><td>{ordinal(y)}</td><td class="lab">{"SNDK" if y < x else "MU"}</td></tr>'
    x, y = a["comps"]["upside_pct"], b["comps"]["upside_pct"]
    out += f'<tr><td class="lab">COMPS CENTRE V PRICE · SAME 3 PEERS EACH</td><td>{sp(x)}</td><td>{sp(y)}</td><td></td></tr>'
    x, y = a["fundamentals"]["fwd_pe"], b["fundamentals"]["fwd_pe"]
    out += f'<tr><td class="lab">FORWARD P/E</td><td>{mult(x)}</td><td>{mult(y)}</td><td></td></tr></table>'
    return out
def parents():
    out = '<table class="t"><tr><th>PARENT</th><th>CLOSE</th><th>GEIGER</th><th>PCT OF OWN YEAR</th><th>V 21-DAY</th><th>V 50-DAY</th><th>V 200-DAY</th><th>RSI</th><th>USUAL DAY</th></tr>'
    for f in ("DRAM", "SMH", "QQQ", "SPY"):
        x = CD["funds"].get(f)
        if not x: continue
        T, G = x["tech"], x["geiger"]; v200 = T.get("vs_sma200_pct")
        out += f'<tr><td class="lab">{f}</td><td>{px((x["quote"] or {}).get("price"))}</td><td>{signed(G.get("live"),2,"")}</td><td>{pct_word(G.get("pctl")) if G.get("pctl") is not None else "TOO NEW"}</td><td>{sp(T.get("vs_sma21_pct"),1)}</td><td>{sp(T.get("vs_sma50_pct"),1)}</td><td>{sp(v200,1) if v200 is not None else "TOO NEW"}</td><td>{("—" if T.get("rsi14") is None else format(T["rsi14"], ".0f"))}</td><td>{(x["risk"].get("usual_day_60") or 0):.2f}%</td></tr>'
    return out + "</table>"

# ------------------------------------------------------------------ comps: before → after, the sets, the fixes
FIXK = [("priceOnBusiness", "1b SAME BIZ"), ("growthCredit", "3 GROWTH"), ("reitYardstick", "4 REIT"), ("marginGate", "5 MARGIN"), ("cellRule", "2 ONE MULT."), ("consistency", "2 ONE PEER"), ("influence", "2 PIVOT"), ("selfOutlier", "6 ITSELF")]
SHORTN = {"000660.KS": "SK hynix", "005930.KS": "Samsung", "285A.T": "Kioxia"}
def up_cell(x):
    if x.get("no_peer_set"): return '<td class="dim">NO PEER SET</td>'
    return f'<td>{sp(x.get("upside_pct"))}</td>'
def before_after():
    out = '<table class="t wide ba"><tr><th>NAME</th><th>BEFORE</th><th>PEERS ADDED</th><th>PRICED ON</th><th>CENTRE</th><th>AFTER</th><th>WHOLE SET</th>' + "".join(f"<th>{w}</th>" for _, w in FIXK) + "<th>FLAGS</th></tr>"
    for t in ORDER:
        if t not in REC: continue
        c, r = C[t], REC[t]; a, b = c["after"], c["before"]; added = [x for x in c["added"]] + [SHORTN.get(x["ticker"], x["ticker"]) for x in c["set_after"] if x["reference"]]
        cells = "".join((f'<td>{("NO PEER SET" if c["alone"][k]["no_peer_set"] else sp(c["alone"][k]["upside_pct"]))}</td>' if c["alone"][k]["changed"] else '<td class="dim">·</td>') for k, _ in FIXK)
        ws = (a.get("whole_set") or {}).get("upside_pct")
        out += f'<tr><td class="lab"><a href="#card-{t}">{t}</a></td>{up_cell(b)}<td class="dim">{E(" · ".join(added)) or "—"}</td><td class="dim">{("SAME BUSINESS · " + str(r["comps"]["n_priced"])) if r["comps"]["priced_on"]=="business" else ("SET · " + str(r["comps"]["n_priced"])) if r["comps"]["priced_on"]=="set" else "—"}</td><td>{money(r["comps"]["centre"],0) if r["comps"]["centre"] else "—"}</td>{up_cell(a)}<td>{sp(ws) if ws is not None else "<span class=dim>·</span>"}</td>{cells}<td class="dim">{E(" · ".join(r["comps"]["flags"]).upper())}</td></tr>'
    return out + "</table>"
def set_panel(t):
    c = C[t]; old = [x["ticker"] for x in c["set_before"]]; chips = ""
    for x in c["set_after"]:
        cls = "ref" if x["reference"] else "add" if x["added"] else "same" if x["same_business"] else "old"; nm = SHORTN.get(x["ticker"], x["ticker"])
        chips += f'<span class="peer {cls}">{E(nm)}{" · ADDED" if x["added"] and not x["reference"] else " · REFERENCE, NO FIGURES YET" if x["reference"] and not x["has_figures"] else ""}</span>'
    votes = "".join(f'<tr><td class="lab">{E(SHORTN.get(p, p))}</td><td>{circles(v)}</td><td class="dim">{v["n"]} OF 4</td></tr>' for p, v in c["votes"].items())
    s = c["same"] or {}
    return f'''<div class="panel"><div class="ph"><span class="tk">{t}</span> <span class="dim">{E(c["lines_before"].upper())} → {E(c["lines_after"].upper())}</span></div>
<div class="sub">OLD SET · {len(old)}</div><div class="peers">{"".join(f'<span class="peer old">{p}</span>' for p in old)}</div>
<div class="sub">FINAL SET · {len(c["set_after"])} · SAME-BUSINESS {s.get("n","—")} · AT LEAST {s.get("need","—")} WANTED</div><div class="peers">{chips}</div>
{f'<div class="sub">THE FOUR SOURCES ON EACH ADDED PEER</div><table class="t">{votes}</table>' if votes else ""}{f'<div class="chips"><span class="chip warn">{E((s.get("short") or "").upper())}</span></div>' if s.get("short") else ""}</div>'''
FIXES = [("1", "Memory and storage are one business line; the memory leaders abroad are reference peers", "memoryStorage · complement · reference", "MU SNDK WDC STX"),
         ("1b", "On a line Alan named the comps of, the same-business peers set the price", "priceOnBusiness", "MU SNDK WDC STX EQIX DLR IRM"),
         ("2", "Tighter outliers: one wild multiple leaves its measure; a peer far on nearly everything leaves; a fragile centre says so", "cellRule · consistency · influence", "AVGO NVDA VST CEG AME LLY JPM"),
         ("3", "Growth credit: the PEG row weighs more, in proportion to how much faster the company grows", "growthCredit", "AVGO VST CRDO COHR STX ORCL"),
         ("4", "Property trusts on P/FFO and EV/EBITDA; data-centre landlords their own line", "reitYardstick · dcReit", "EQIX DLR IRM"),
         ("5", "Sales multiples leave when margins are more than 2× apart; two-year forward growth beside next year", "marginGate", "GOOGL ORCL VST MU"),
         ("6", "A company far from its own peers on price gets no number", "selfOutlier", "BE")]
def fixes_table():
    return '<table class="t wide"><tr><th>#</th><th>FIX</th><th>SWITCH</th><th>NAMES IT MOVED</th></tr>' + "".join(f'<tr><td class="lab">{a}</td><td>{E(b)}</td><td class="dim">{E(c)}</td><td class="lab">{d}</td></tr>' for a, b, c, d in FIXES) + "</table>"
def avgo_dist():
    a = C["AVGO"]["after"]; keys = ["pe_ttm", "pe_fwd", "ev_ebitda", "ev_sales", "ps", "peg"]; lab = {"pe_ttm": "P/E", "pe_fwd": "P/E FWD", "ev_ebitda": "EV/EBITDA", "ev_sales": "EV/S", "ps": "P/S", "peg": "PEG"}
    cut = {(x["ticker"], x["key"]) for x in a["cells_out"]}
    out = '<table class="t wide"><tr><th>AVGO\'S PEER</th>' + "".join(f"<th>{lab[k]}</th>" for k in keys) + "<th>FAR ON · OF 5</th><th>VERDICT</th></tr>"
    for t, v in sorted(a["distances"].items(), key=lambda kv: -max([abs(x) for x in kv[1]["d"].values() if x is not None] or [0]))[:7]:
        cells = ""
        for k in keys:
            d = v["d"].get(k); m = a["multiples"].get(t, {}).get(k); far = d is not None and abs(d) > 3.5
            cells += f'<td{" class=cut" if (t, k) in cut else ""}>{mult(m)}<br><span class="{"hot" if far else "dim"}">{signed(d,1,"") if d is not None else "—"}</span></td>'
        out += f'<tr><td class="lab">{t}</td>{cells}<td>{v["flags"]}</td><td class="dim">{"OUT" if t in [o["ticker"] for o in a["outliers"]] else "STAYS · " + str(sum(1 for x in a["cells_out"] if x["ticker"]==t)) + " MULTIPLE(S) LEFT OUT" if any(x["ticker"]==t for x in a["cells_out"]) else "STAYS"}</td></tr>'
    return out + "</table>"

# ------------------------------------------------------------------ the knockout
def ko_table(K, live=False):
    out = '<table class="t wide"><tr><th>BUSINESS LINE</th><th>FIELD</th><th>ENTRANTS · SEED, SCORE</th><th>DUELS</th><th>CHAMPION</th></tr>'
    for l in K["lines"]:
        ent = " · ".join(f'#{e["seed"]} {e["sym"]} {e["score"]:.2f}' for e in l["entrants"]); du = " · ".join(f'{m["a"]} v {m["b"]} → {m["winner"]} ({"fundamentals" if m["on"]=="fundamentals" else "Geiger timing" if m["on"]=="timing" else "bye"})' for ms in l["rounds"] for m in ms if m["b"]) or "—"
        out += f'<tr><td class="lab">{E(l["line"].upper())}</td><td class="dim">{E((l["scale"]["level"] + ": " + l["scale"]["name"]).upper())} · {l["scale"]["members"]}</td><td>{ent}</td><td class="dim">{E(du)}</td><td class="lab">{l["champion"] or "—"}{" · UNOPPOSED" if l["unopposed"] else ""}</td></tr>'
    return out + "</table>"
def podium(K): return " · ".join(f'<b>{p["sym"]}</b> {p["score"]:.2f}' for p in K["podium"])
def ko_parts():
    out = '<table class="t wide"><tr><th>NAME</th><th>LINE</th><th>SCORE</th><th>PRICE</th><th>GROWTH</th><th>MARGIN</th><th>LEVERAGE</th><th>GEIGER</th><th>PCT OF OWN YEAR</th><th>HOT / COLD</th></tr>'
    by = {e["sym"]: e for l in KC["after"]["lines"] for e in l["entrants"] + l["sitOut"]}
    for e in sorted(by.values(), key=lambda z: -(z["score"] or 0)):
        P = {p[0]: p for p in e["parts"]}; cell = lambda k: (f'<td title="{E(P[k][2])}">{P[k][1]:.2f}</td>' if k in P else '<td class="dim">—</td>'); pc = e["g_pctl"]
        out += f'<tr><td class="lab">{e["sym"]}</td><td class="dim">{E(e["line"].upper())}</td><td><b>{e["score"]:.2f}</b></td>{cell("price")}{cell("growth")}{cell("margin")}{cell("leverage")}<td>{signed(e["g"],2,"")}</td><td>{ordinal(pc) if pc is not None else "—"}</td><td class="lab">{"HOT" if pc is not None and pc >= 67 else "COLD" if pc is not None and pc <= 33 else "MIDDLE"}</td></tr>'
    return out + "</table>"
def feed_table():
    out = '<table class="t wide"><tr><th>THE LIVE TOOL\'S FEED</th><th>REVENUE GROWTH</th><th>NET MARGIN</th><th>FORWARD P/E</th><th>P/S</th><th>THE COMPS TAB\'S FIGURES</th><th>REVENUE, TRAILING</th><th>OPERATING MARGIN</th><th>FORWARD P/E</th><th>P/S</th></tr>'
    for t in ("MU", "SNDK", "WDC", "STX", "NVDA", "GOOGL", "ORCL"):
        f = (KL["after"]["names"].get(t) or {}).get("comps") or {}; a = C[t]["after"]; tb = a["table"][t]; m = a["multiples"][t]
        out += f'<tr><td class="lab">{t}</td><td>{plain((f.get("rev_growth") or 0)*100)}</td><td>{plain((f.get("net_m") or 0)*100)}</td><td>{mult(f.get("fwd_pe"))}</td><td>{mult(f.get("ps"))}</td><td class="lab">{t}</td><td>{plain(tb["rev_g_ttm"])}</td><td>{plain(tb["om"])}</td><td>{mult(m["pe_fwd"])}</td><td>{mult(m["ps"])}</td></tr>'
    return out + "</table>"
def xcheck():
    out = '<table class="t wide"><tr><th>NAMED BY THE ALLOCATION TOOL\'S LIVE BRIEF</th><th>COMPS BEFORE</th><th>COMPS AFTER</th><th>PRICED ON</th><th>GEIGER · PCT OF OWN YEAR</th><th>KNOCKOUT SCORE</th></tr>'
    by = {e["sym"]: e for e in KC["after"]["ranked"]}
    for t, note in (("WDC", "the brief: +48% v peers"), ("GOOGL", "the brief: GOOG / GOOGL"), ("NVDA", ""), ("AME", "")):
        r = REC[t]; out += f'<tr><td class="lab">{t} <span class="dim">{E(note.upper())}</span></td><td>{sp(r["comps"]["before"]["upside_pct"])}</td><td>{sp(r["comps"]["upside_pct"]) if r["comps"]["centre"] else "NO PEER SET"}</td><td class="dim">{"SAME-BUSINESS · " + " ".join(r["comps"]["peers_priced"]) if r["comps"]["priced_on"]=="business" else "SET · " + str(r["comps"]["n_priced"])}</td><td>{ordinal(r["technicals"]["geiger_pctl_own_year"]) if r["technicals"]["geiger_pctl_own_year"] is not None else "—"}</td><td>{format(by[t]["score"], ".2f") if t in by else "NOT IN THE 18"}</td></tr>'
    return out + "</table>"
WIRE = [("1 · AFTER THE CLOSE", "16:20 ET, every session", "one job, on the pattern the daily heartbeat already runs on (a Supabase function on a schedule): the settled closes, the comps (the kept set → the outlier rule → the price), growth and revisions, the Geiger and RSI against the name's own year, the reviewed lines, the usual day", "decision_cards — new, additive: one row per name per session, never overwritten"),
        ("2 · THE HUB", "on open", "a CARDS tab in the company view shows the newest row for the ticker; a CARDS board lists the day's rows, best knockout score first", "decision_cards (read)"),
        ("3 · ALLOCATION · STEP 5 · KNOCKOUT", "on open", "the knockout takes its four readings (price, growth, margin, leverage) from the card instead of the feed that is wrong tonight; the business line still comes from lines.mjs, as today", "decision_cards (read) — replaces the comps-feed call"),
        ("4 · ALLOCATION · STEP 6 · PICKS", "on KEEP / DROP", "a kept name shows its card: entry levels from the reviewed lines, the risk-equal size, the plan fields; what Alan types there is saved", "decision_card_plans — new, additive, append-only like comps_decisions"),
        ("5 · THE LAB", "when it approves lines", "the card reads the reviewed lines from the table LB1 prepared instead of the extract file", "reviewed_lines (read; LB1's migration 0026)")]
def wiring(): return '<table class="t wide"><tr><th>STEP</th><th>WHEN</th><th>WHAT RUNS</th><th>TABLE</th></tr>' + "".join(f'<tr><td class="lab">{a}</td><td class="dim">{b}</td><td>{E(c)}</td><td class="dim">{E(d)}</td></tr>' for a, b, c, d in WIRE) + "</table>"

CSS = open(os.path.join(HERE, "page.css"), encoding="utf-8").read()
SPECS = open(os.path.join(HERE, "page-specs.fragment"), encoding="utf-8").read()   # a fragment, not a page: named so that scripts/inject-scnav.py (every *.html under deliverables/) leaves it alone
ref_job = META["reference"]["job"]
hc = KC["hotcold"]
page = f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Decision cards · 6 Oct 2026 · Scintilla</title><style>{CSS}</style></head><body>
<header class="top"><div class="ttl">DECISION CARDS</div><div class="dim">THE 6 OCT 2026 CLOSE · {len(REC)} NAMES · A STUDY ON A BRANCH — NOTHING ON THE HUB OR THE ALLOCATION TOOL HAS CHANGED</div></header>
<section><h2>MICRON, WITH SANDISK BESIDE IT</h2><div class="pair">{card("MU", True)}{card("SNDK", True)}</div></section>
<section class="grid2"><div class="panel"><div class="ph">MU · THE LEVELS</div><div class="w">{ladder_mu()}</div><div class="n">{ladder_mu(350, 560, True)}</div></div><div><div class="panel"><div class="ph">MU · EVERY LEVEL BETWEEN 860 AND 1,160</div>{mu_levels()}</div><div class="panel"><div class="ph">MU · SIZE BY RISK</div>{mu_size()}</div></div></section>
<section class="grid2"><div class="panel"><div class="ph">MU AND SNDK · WHICH ONE IS LAGGING</div>{alternate()}</div><div class="panel"><div class="ph">THE PARENTS</div>{parents()}</div></section>
<section><h2>THE OTHER CARDS</h2><div class="cards">{"".join(card(t) for t in ASKED if t in REC)}</div><h2>THE REST OF THE COMPS AND KNOCKOUT NAMES</h2><div class="cards">{"".join(card(t) for t in MORE if t in REC)}</div></section>
<section><h2>COMPS · BEFORE → AFTER, EVERY NAME</h2><div class="panel scroll">{before_after()}</div></section>
<section><h2>THE PEER SETS · OLD, ADDED, FINAL</h2><div class="grid2">{"".join(set_panel(t) for t in ("MU", "SNDK", "WDC", "STX", "EQIX", "DLR", "IRM", "AVGO"))}</div></section>
<section><h2>THE FIXES, INSIDE THE COMPS SYSTEM</h2><div class="panel scroll">{fixes_table()}</div><div class="panel scroll"><div class="ph">ONE PEER OR ONE MULTIPLE · AVGO'S SET · EACH MULTIPLE, AND HOW MANY SPREADS IT SITS FROM THE GROUP</div>{avgo_dist()}</div></section>
<section><h2>THE KNOCKOUT, RE-RUN OVER ALAN'S EIGHTEEN</h2>
<div class="panel scroll"><div class="ph">AFTER THE FIXES · ON THE COMPS TAB'S FIGURES</div>{ko_table(KC["after"])}<div class="podium"><span class="lab">PODIUM</span> {podium(KC["after"])}</div><div class="podium dimrow"><span class="lab">BEFORE THE FIXES</span> {podium(KC["before"])}</div></div>
<div class="grid2"><div class="panel"><div class="ph">HOT AGAINST COLD · FUNDAMENTALS SCORE BY THE GEIGER'S PLACE IN ITS OWN YEAR</div><div class="w">{scatter()}</div><div class="n">{scatter(350, 320, True)}</div><div class="kv"><div><span class="lab">COLD · {len(hc["cold"])}</span><b>{hc["cold_avg"]:.2f}</b></div><div><span class="lab">MIDDLE · {len(hc["middle"])}</span><b>{hc["middle_avg"]:.2f}</b></div><div><span class="lab">HOT · {len(hc["hot"])}</span><b>{hc["hot_avg"]:.2f}</b></div><div><span class="lab">CORRELATION · 18</span><b>{signed(hc["correlation"],2,"")}</b></div></div></div>
<div class="panel scroll"><div class="ph">EVERY NAME · THE FOUR READINGS</div>{ko_parts()}</div></div>
<div class="panel scroll"><div class="ph">THE LIVE ALLOCATION TOOL, AS IT IS · SAME EIGHTEEN · ITS OWN FEED</div>{ko_table(KL["after"], True)}<div class="podium"><span class="lab">PODIUM · LINES FIXED</span> {podium(KL["after"])}</div><div class="podium dimrow"><span class="lab">PODIUM · AS LIVE</span> {podium(KL["before"])}</div></div>
<div class="panel scroll"><div class="ph">WHY THE LIVE TOOL'S SCORES ARE NOT USED · ITS FEED AGAINST THE COMPS TAB'S FIGURES</div>{feed_table()}</div></section>
<section><h2>CROSS-CHECK · THE ALLOCATION TOOL'S LIVE BRIEF</h2><div class="panel scroll">{xcheck()}</div></section>
<section><h2>THE WIRING · SO IT RUNS EVERY DAY</h2><div class="panel scroll">{wiring()}</div></section>
<details class="sc-pagespecs"><summary>PAGE SPECS</summary>{SPECS.replace("__REFJOB__", E("node " + ref_job["script"] + " " + " ".join(ref_job["symbols"]) + " SKHY")).replace("__BUILT__", CD["as_of"]["built_utc"][:16].replace("T", " ") + " UTC").replace("__GEIGER__", (CD["as_of"]["geiger_published_utc"] or "")[:16].replace("T", " ") + " UTC").replace("__LINES__", (CD["as_of"]["lines_extract"] or "")[:16].replace("T", " ") + " UTC")}</details>
</body></html>'''
SNIP = open(os.path.join(ROOT, "..", "..", "..", "scripts", "scnav-snippet.html"), encoding="utf-8").read().strip()
page = page.replace('<header class="top">', '<header class="top"><span data-scnav-slot></span>', 1).replace("</body>", SNIP + "\n</body>", 1)
open(os.path.join(ROOT, "DECISION-CARDS.html"), "w", encoding="utf-8").write(page)
print("wrote DECISION-CARDS.html", len(page), "bytes ·", len(REC), "cards · cards.json")
