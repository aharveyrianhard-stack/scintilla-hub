import json, html, sys
C = json.load(open("results/C.json")); D = json.load(open("results/D.json")); A = json.load(open("results/A.json"))
L = json.load(open("results/C_leaky.json")); G = json.load(open("results/gate_live.json"))
W = C["weights"]; RUNGS = list(W); WS = sum(W.values())
UP = "#3fae6a"; DN = "#d2504b"; INK = "#d2d2d2"; INK3 = "#8c8c92"; LINE = "#2a2a30"
S = C["sample"]; MK = C["market"]
M = '<span class="m">[MEASURED]</span>'

def p(x, d=2, sign=True):
    if x is None: return "–"
    v = x * 100
    if abs(v) < 0.5 * 10 ** -d: v = 0.0
    s = f"{v:+.{d}f}" if sign else f"{v:.{d}f}"
    return s + "%"
def f(x, d=3, sign=True):
    if x is None: return "–"
    if abs(x) < 0.5 * 10 ** -d: x = 0.0
    return f"{x:+.{d}f}" if sign else f"{x:.{d}f}"
def n(x): return f"{int(x):,}"
def cls(x): return "u" if (x or 0) > 0 else ("d" if (x or 0) < 0 else "")
def td(v, txt):
    import re
    zero = not re.search(r"[1-9]", txt)
    return f'<td class="{"" if zero else cls(v)}">{txt}</td>'

def bars(title, labels, vals, w=456, h=250, fmt=lambda v: f"{v*100:+.2f}%", sub=None, xl=None):
    """one bar per bucket; green above zero, red below."""
    pl, pr, pt, pb = 14, 14, 46, 46
    iw, ih = w - pl - pr, h - pt - pb
    mx = max(abs(v) for v in vals) or 1; lo = min(0, min(vals)); hi = max(0, max(vals)); span = (hi - lo) or 1
    pad = span * 0.16; lo2 = lo - (pad if lo < 0 else 0); hi2 = hi + (pad if hi > 0 else 0); sp2 = hi2 - lo2
    y = lambda v: pt + (hi2 - v) / sp2 * ih
    bw = iw / len(vals)
    o = [f'<svg width="{w}" height="{h}" viewBox="0 0 {w} {h}" role="img" aria-label="{html.escape(title)}">']
    o.append(f'<text x="{pl}" y="16" fill="{INK}" font-size="12" letter-spacing="1.5">{html.escape(title)}</text>')
    if sub: o.append(f'<text x="{pl}" y="32" fill="{INK3}" font-size="11">{html.escape(sub)}</text>')
    o.append(f'<line x1="{pl}" x2="{w-pr}" y1="{y(0):.1f}" y2="{y(0):.1f}" stroke="{LINE}" stroke-width="1"/>')
    for i, v in enumerate(vals):
        x0 = pl + i * bw + bw * 0.14; ww = bw * 0.72; col = UP if v >= 0 else DN
        top = min(y(v), y(0)); hh = max(abs(y(v) - y(0)), 1.2)
        o.append(f'<rect x="{x0:.1f}" y="{top:.1f}" width="{ww:.1f}" height="{hh:.1f}" fill="{col}"/>')
        ty = y(v) - 5 if v >= 0 else y(v) + 13
        o.append(f'<text x="{x0+ww/2:.1f}" y="{ty:.1f}" fill="{col}" font-size="11" text-anchor="middle">{fmt(v)}</text>')
        o.append(f'<text x="{x0+ww/2:.1f}" y="{h-pb+16}" fill="{INK3}" font-size="11" text-anchor="middle">{html.escape(str(labels[i]))}</text>')
    if xl: o.append(f'<text x="{pl}" y="{h-8}" fill="{INK3}" font-size="11">{html.escape(xl)}</text>')
    o.append("</svg>"); return "".join(o)

out = []
A_ = out.append

# ---------- numbers used in the lead ----------
cs = C["cs"]["COMP"]; own = C["own"]["COMP"]; ic = C["ic_next_open"]
hot = lambda h: cs[str(h)]["10"]; cold = lambda h: cs[str(h)]["1"]
ohot = lambda h: own[str(h)]["10"]; ocold = lambda h: own[str(h)]["1"]
em = D["extreme_move"]; ex_k = "extreme (own top or bottom tenth)"; mid_k = "middle (own 5th-6th tenth)"
fast = sum(W[g] for g in ["3h", "4h", "6h", "12h"]) / WS; slow = 1 - fast
pnts = D["per_name_ts"]["COMP"]; ohc = D["own_hot_cold"]
fl = C["flash"]["COMP"]
stored = D["stored"]

A_(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>G2 · the Geiger's weights against what prices did next · 5 Oct 2026</title>
<style>
  :root{{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; --up:{UP}; --dn:{DN}; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1500px; margin:0 auto; padding:24px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .lead{{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1100px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; max-width:1100px; }}
  .k{{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin:14px 0 18px; }}
  .k div{{ border:1px solid var(--line); background:var(--panel); padding:10px 12px; font-size:12px; letter-spacing:.14em; color:var(--ink3); }}
  .k b{{ display:block; font-size:22px; letter-spacing:0; color:var(--ink); font-weight:600; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 6px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:22px 0 6px; color:var(--ink); font-weight:600; }}
  h3{{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:0 0 8px; color:var(--ink3); font-weight:400; }}
  p{{ margin:6px 0; max-width:1100px; }}
  .note{{ color:var(--ink2); margin:6px 0 14px; max-width:1100px; }}
  .tw{{ overflow-x:auto; }}
  .g{{ display:flex; flex-wrap:wrap; gap:6px 18px; }}
  svg{{ display:block; flex:0 0 auto; font-family:"SF Mono", Menlo, Consolas, monospace; }}
  table{{ border-collapse:collapse; width:100%; min-width:980px; }}
  th{{ text-align:right; font-size:11px; letter-spacing:.12em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }}
  td{{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); }}
  th:first-child, td:first-child{{ text-align:left; color:var(--ink); }}
  tr.sep td{{ border-top:1px solid var(--line); }}
  td.u{{ color:var(--up); }} td.d{{ color:var(--dn); }}
  .u{{ color:var(--up); }} .d{{ color:var(--dn); }}
  .m{{ font-size:11px; letter-spacing:.1em; color:var(--ink3); border:1px solid var(--line); padding:0 5px; white-space:nowrap; }}
  b{{ color:var(--ink); font-weight:600; }} a{{ color:var(--ink); }}
  ol,ul{{ margin:6px 0 0 20px; padding:0; max-width:1100px; }} li{{ margin:6px 0; }}
  details{{ margin-top:22px; color:var(--ink3); font-size:13px; }} summary{{ cursor:pointer; letter-spacing:.2em; font-size:12px; }}
  details p, details li{{ color:var(--ink2); }}
  @media (max-width:700px){{ body{{ font-size:13px; }} main{{ padding:16px 10px 70px; }} }}
</style>
</head>
<body>
<main>
<h1>G2 · the Geiger's weights against what prices did next</h1>
<p class="lead"><b>The Geiger, on its own, does not lead price.</b> Over the {S['sessions']} trading sessions from 21 Oct 2024 to 2 Oct 2026, across {S['names']} Hub names, the tenth of names with the hottest reading on an evening and the tenth with the coldest went on to do the same thing: {p(hot(1)['up'],1,False)} against {p(cold(1)['up'],1,False)} of them rose the next session, the typical move was {p(hot(5)['med'])} against {p(cold(5)['med'])} over 5 sessions and {p(hot(20)['med'])} against {p(cold(20)['med'])} over 20. A hot or cold reading did not come before a bigger move either: {f(em['1'][ex_k]['mv'],2,False)}× the name's usual day after an extreme reading, {f(em['1'][mid_k]['mv'],2,False)}× after a middling one. No rung carries a signal that can be told apart from luck. The three slow rungs (1d, 3d, 1w — {p(slow,0,False)} of the weight) lean the right way over 5 to 20 sessions; the four fast rungs (3h, 4h, 6h, 12h — {p(fast,0,False)} of the weight) lean slightly the wrong way over 1 to 5; today's weights score the same as equal weights. The one pattern that does show is the reverse of "hot leads": against its own history, a name at its coldest went on to do a little better than at its hottest ({p(ocold(20)['med'])} against {p(ohot(20)['med'])} over 20 sessions) — and most of that is the whole market bouncing after sell-offs. {M}</p>
<p class="sub">Monday 5 Oct 2026 · report only · every table was read, none was written · nothing in the Geiger, the Hub, the Station or the provider was changed. Every number on this page is {M}: counted from the rows named in "Rows used". Nothing is estimated or carried over from an earlier report. This tests the Geiger by itself, not the Geiger together with your other inputs and your judgement.</p>

<div class="k">
  <div><b>{n(S['rows'])}</b>READINGS TESTED</div>
  <div><b>{S['names']}</b>NAMES</div>
  <div><b>{S['sessions']}</b>SESSIONS · 21 OCT 2024 – 2 OCT 2026</div>
  <div><b>{f(ic['COMP']['1']['ic'])} · {f(ic['COMP']['5']['ic'])} · {f(ic['COMP']['20']['ic'])}</b>ORDERING SCORE · 1 · 5 · 20 SESSIONS (0 = NO LINK)</div>
  <div><b>{p(MK['spy_change'],0)}</b>SPY OVER THE PERIOD</div>
  <div><b>{n(22189+16296)}</b>JUNE ROWS FOUND</div>
</div>
""")

# ---------- pictures ----------
A_(f'<h2>1 · Hot against cold, on the same evening {M}</h2>')
A_(f'<p class="note">Each evening the {S["names_per_day_median"]:.0f} or so names are lined up by their Geiger reading and cut into ten equal groups: 1 is the coldest tenth, 10 the hottest. Each bar is the typical (median) move of that group from the next morning\'s open. If the Geiger led price, the bars would climb from left to right. They do not. About {n(cold(1)["n"])} readings sit in each bar. Mind the scale: each picture is drawn to its own tallest bar, and in the 1-session picture that bar is {p(max(cs["1"][str(k)]["med"] for k in range(1,11)))}.</p>')
A_('<section><div class="tw"><div class="g">')
for h in (1, 5, 20):
    v = [cs[str(h)][str(k)]["med"] for k in range(1, 11)]
    A_(bars(f"{h} SESSION{'S' if h>1 else ''} LATER", list(range(1, 11)), v, sub=f"all names: {p(MK[f'base_med_fo{h}'])} · {p(MK[f'base_up_fo{h}'],1,False)} rose", xl="1 = coldest tenth that evening · 10 = hottest"))
A_('</div></div></section>')

A_(f'<h2>2 · Each name against its own history {M}</h2>')
A_(f'<p class="note">The same test done your way: no level that applies to every name. Each reading is placed against that name\'s own previous 250 sessions (at least 120 needed), so 10 means "in the top tenth of what this name itself has shown". Because a name needs that history first, these groups run from April 2025. Here the bars slope the other way — a name at its own coldest did a little better afterwards than at its own hottest. Read section 10 before leaning on it: measured against the same day\'s typical name the gap almost closes ({p(ocold(20)["xmed"])} for cold, {p(ohot(20)["xmed"])} for hot, over 20 sessions), and when only windows that do not overlap are counted it reverses ({p(ohc["20"]["non_overlap"]["cold_med"])} for cold, {p(ohc["20"]["non_overlap"]["hot_med"])} for hot).</p>')
A_('<section><div class="tw"><div class="g">')
for h in (1, 5, 20):
    v = [own[str(h)][str(k)]["med"] for k in range(1, 11)]
    A_(bars(f"{h} SESSION{'S' if h>1 else ''} LATER", list(range(1, 11)), v, sub=f"all readings: {p(ohc[str(h)]['all']['all_med'])} · {p(ohc[str(h)]['all']['all_up'],1,False)} rose", xl="1 = this name's own coldest tenth · 10 = its own hottest"))
A_('</div></div></section>')

A_(f'<h2>3 · Rung by rung {M}</h2>')
A_(f'<p class="note">The ordering score asks one question each evening: did the names with the higher reading go on to do better than the names with the lower one? +1 means always, 0 means no link, −1 means always the opposite. No rung reaches +0.02 at any horizon. The "luck test" column says how many times bigger the score is than its own day-to-day wobble; a score needs about 2 before it can be told apart from chance, and no rung passes 1.</p>')
A_('<section><div class="tw"><div class="g">')
for h in (1, 5, 20):
    v = [ic["R_" + g][str(h)]["ic"] for g in RUNGS]
    A_(bars(f"ORDERING SCORE · {h} SESSION{'S' if h>1 else ''}", RUNGS, v, fmt=lambda x: f"{x:+.3f}", sub=f"composite, today's weights: {f(ic['COMP'][str(h)]['ic'])}", xl="fast rungs on the left, slow rungs on the right"))
A_('</div></div></section>')

A_('<section><h3>The per-rung table</h3><div class="tw"><table><tr><th>RUNG</th><th>WEIGHT TODAY</th><th>SHARE OF WEIGHT</th><th>SCORE 1 SESSION</th><th>LUCK TEST</th><th>SCORE 5</th><th>LUCK TEST</th><th>SCORE 20</th><th>LUCK TEST</th><th>20 SESSIONS: HOTTEST TENTH</th><th>COLDEST TENTH</th><th>COMPOSITE SCORE (20) WITHOUT THIS RUNG</th></tr>')
def rung_row(label, key, weight=None, loo=None, sep=False):
    r = ic[key]; c = C["cs"].get(key)
    cells = [f"<td>{label}</td>", f"<td>{f(weight,3,False) if weight else '–'}</td>", f"<td>{p(weight/WS,0,False) if weight else '–'}</td>"]
    for h in ("1", "5", "20"):
        cells.append(td(r[h]["ic"], f(r[h]["ic"]))); cells.append(f"<td>{f(r[h]['t'],1)}</td>")
    if c: cells += [td(c["20"]["10"]["med"], p(c["20"]["10"]["med"])), td(c["20"]["1"]["med"], p(c["20"]["1"]["med"]))]
    else: cells += ["<td>–</td>", "<td>–</td>"]
    cells.append(f"<td>{f(loo) if loo is not None else '–'}</td>")
    return f'<tr{" class=sep" if sep else ""}>' + "".join(cells) + "</tr>"
for g in RUNGS: A_(rung_row(g, "R_" + g, W[g], ic["LOO_" + g]["20"]["ic"]))
A_(rung_row("COMPOSITE · today's weights", "COMP", sep=True))
A_(rung_row("COMPOSITE · equal weights", "EQUAL"))
A_(rung_row("TREND half only", "TREND"))
A_(rung_row("MOMENTUM half only", "MOM"))
A_('</table></div></section>')
A_(f'<p class="note"><b>Are the weights pulling their weight?</b> They make no measurable difference. Today\'s weights and plain equal weights score {f(ic["COMP"]["20"]["ic"])} and {f(ic["EQUAL"]["20"]["ic"])} over 20 sessions. Taking a fast rung out nudges the composite up (to between {f(min(ic["LOO_"+g]["20"]["ic"] for g in ["3h","4h","6h","12h"]))} and {f(max(ic["LOO_"+g]["20"]["ic"] for g in ["3h","4h","6h","12h"]))}); taking a slow rung out nudges it down (to between {f(min(ic["LOO_"+g]["20"]["ic"] for g in ["1d","3d","1w"]))} and {f(max(ic["LOO_"+g]["20"]["ic"] for g in ["1d","3d","1w"]))}). All of it is inside the noise. As a further check the fourteen parts (trend and momentum on each of the seven rungs) were given the best weights the first year could offer (to 13 Oct 2025) and then judged on the second year: {f(D["tuned"]["1"]["in_sample"][0])} fell to {f(D["tuned"]["1"]["out_sample"][0])} at 1 session, {f(D["tuned"]["5"]["in_sample"][0])} to {f(D["tuned"]["5"]["out_sample"][0])} at 5 (luck test {f(D["tuned"]["5"]["out_sample"][2],1)}), {f(D["tuned"]["20"]["in_sample"][0])} to {f(D["tuned"]["20"]["out_sample"][0])} at 20 (luck test {f(D["tuned"]["20"]["out_sample"][2],1)}, on about {D["tuned"]["20"]["out_sample"][1]//20} separate 20-session stretches). That last one is the most promising number on the page and it is still not proven. {M}</p>')

# ---------- per sector ----------
A_(f'<h2>4 · Sector by sector {M}</h2>')
tech = C["sector"]["Technology"]; util = C["sector"]["Utilities"]
A_(f'<p class="note">Hot and cold here are each name\'s own top and bottom tenth (section 2). Technology and Healthcare are the two groups where a name at its own hottest went on to beat the same name at its coldest over 20 sessions (Technology: {p(tech["20"]["hot"]["med"])} against {p(tech["20"]["cold"]["med"])}). In every other group it was level or the other way round, most of all in Utilities, Real Estate, Financials, Communication Services and the funds (Utilities: {p(util["20"]["hot"]["med"])} against {p(util["20"]["cold"]["med"])}). The last two columns order the names inside the sector against each other; none passes the luck test.</p>')
A_('<section><div class="tw"><table><tr><th>SECTOR</th><th>NAMES</th><th>HOT READINGS</th><th>COLD READINGS</th><th>5 SESSIONS: HOT</th><th>COLD</th><th>ROSE: HOT</th><th>COLD</th><th>20 SESSIONS: HOT</th><th>COLD</th><th>ROSE: HOT</th><th>COLD</th><th>SCORE INSIDE SECTOR (20)</th><th>LUCK TEST</th></tr>')
for k, v in sorted(C["sector"].items(), key=lambda kv: -kv[1]["names"]):
    a = v["5"]; b = v["20"]
    A_(f'<tr><td>{html.escape(k)}</td><td>{v["names"]}</td><td>{n(b["hot"]["n"])}</td><td>{n(b["cold"]["n"])}</td>' + td(a["hot"]["med"], p(a["hot"]["med"])) + td(a["cold"]["med"], p(a["cold"]["med"])) + f'<td>{p(a["hot"]["up"],1,False)}</td><td>{p(a["cold"]["up"],1,False)}</td>' + td(b["hot"]["med"], p(b["hot"]["med"])) + td(b["cold"]["med"], p(b["cold"]["med"])) + f'<td>{p(b["hot"]["up"],1,False)}</td><td>{p(b["cold"]["up"],1,False)}</td>' + td(b["ic"], f(b["ic"])) + f'<td>{f(b["ic_t"],1)}</td></tr>')
t = ohc["20"]["all"]; t5 = ohc["5"]["all"]
A_(f'<tr class="sep"><td>ALL NAMES</td><td>{S["names"]}</td><td>{n(t["hot_n"])}</td><td>{n(t["cold_n"])}</td>' + td(t5["hot_med"], p(t5["hot_med"])) + td(t5["cold_med"], p(t5["cold_med"])) + f'<td>{p(t5["hot_up"],1,False)}</td><td>{p(t5["cold_up"],1,False)}</td>' + td(t["hot_med"], p(t["hot_med"])) + td(t["cold_med"], p(t["cold_med"])) + f'<td>{p(t["hot_up"],1,False)}</td><td>{p(t["cold_up"],1,False)}</td>' + td(ic["COMP"]["20"]["ic"], f(ic["COMP"]["20"]["ic"])) + f'<td>{f(ic["COMP"]["20"]["t"],1)}</td></tr>')
A_('</table></div></section>')

# ---------- spread across names ----------
A_(f'<h2>5 · The spread across names {M}</h2>')
h20 = pnts["20"]
A_(f'<p class="note">One score per name: over that name\'s own history, did its higher readings come before its better stretches? For {p(1-h20["raw_pos"],0,False)} of the {h20["n"]} names with enough history the answer over 20 sessions is "no, the reverse" — the typical name scores {f(h20["raw_med"])}, a tenth of names score below {f(h20["raw_p10"])} and a tenth above {f(h20["raw_p90"])}. Measured against the same day\'s typical name instead of in raw terms, the typical score is {f(h20["exc_med"])} and {p(1-h20["exc_pos"],0,False)} of names are below zero. The second table shows why one level cannot serve every name: each name\'s own cold, middle and hot readings sit in different places, and so does its usual day.</p>')
edges = [round(-0.5 + 0.05 * i, 2) for i in range(21)]
A_('<section><div class="tw"><div class="g">')
hv = h20["raw_hist"]; lab = [f"{edges[i]:+.1f}" if i % 4 == 0 else "" for i in range(20)]
def hist(title, hv, sub):
    w, hh = 690, 250; pl, pr, pt, pb = 14, 14, 46, 46; iw, ih = w - pl - pr, hh - pt - pb; mx = max(hv) or 1; bw = iw / 20
    o = [f'<svg width="{w}" height="{hh}" viewBox="0 0 {w} {hh}" role="img" aria-label="{html.escape(title)}">', f'<text x="{pl}" y="16" fill="{INK}" font-size="12" letter-spacing="1.5">{html.escape(title)}</text>', f'<text x="{pl}" y="32" fill="{INK3}" font-size="11">{html.escape(sub)}</text>']
    o.append(f'<line x1="{pl}" x2="{w-pr}" y1="{pt+ih}" y2="{pt+ih}" stroke="{LINE}"/>')
    for i, v in enumerate(hv):
        col = DN if edges[i] < 0 else UP; bh = v / mx * ih; x0 = pl + i * bw + 2
        o.append(f'<rect x="{x0:.1f}" y="{pt+ih-bh:.1f}" width="{bw-4:.1f}" height="{bh:.1f}" fill="{col}"/>')
        if v: o.append(f'<text x="{x0+(bw-4)/2:.1f}" y="{pt+ih-bh-4:.1f}" fill="{col}" font-size="11" text-anchor="middle">{v}</text>')
    for i in range(0, 21, 2):
        o.append(f'<text x="{pl+i*bw:.1f}" y="{hh-pb+16}" fill="{INK3}" font-size="11" text-anchor="middle">{edges[i]:+.1f}</text>')
    o.append(f'<text x="{pl}" y="{hh-8}" fill="{INK3}" font-size="11">left of 0 = hot came before worse · right of 0 = hot came before better</text></svg>')
    return "".join(o)
A_(hist("HOW MANY NAMES AT EACH SCORE · RAW", h20["raw_hist"], f"{h20['n']} names · typical {f(h20['raw_med'])}"))
A_(hist("THE SAME, AGAINST THE DAY'S TYPICAL NAME", h20["exc_hist"], f"{h20['n']} names · typical {f(h20['exc_med'])}"))
A_('</div></div></section>')
pn = {x["sym"]: x for x in C["per_name"]}
pick = [s for s in ["SPY", "QQQ", "NVDA", "AAPL", "MSFT", "MU", "TSLA", "PLTR", "JPM", "XOM", "LLY", "KO", "NEE", "GLD", "AAOI"] if s in pn]
A_('<section><h3>Fifteen names, each on its own scale</h3><div class="tw"><table><tr><th>NAME</th><th>SECTOR</th><th>ITS OWN COLD (10TH PERCENTILE)</th><th>ITS MIDDLE</th><th>ITS OWN HOT (90TH)</th><th>ITS USUAL DAY</th><th>20 SESSIONS AFTER ITS HOTTEST TENTH</th><th>READINGS</th><th>AFTER ITS COLDEST TENTH</th><th>READINGS</th><th>ITS OWN SCORE (20)</th></tr>')
for s in pick:
    x = pn[s]
    A_(f'<tr><td>{s}</td><td>{html.escape(x["sector"])}</td>' + td(x["p10"], f(x["p10"], 2)) + td(x["p50"], f(x["p50"], 2)) + td(x["p90"], f(x["p90"], 2)) + f'<td>{p(x["usual"],2,False)}</td>' + td(x["hot20"], p(x["hot20"])) + f'<td>{x["hotn20"]}</td>' + td(x["cold20"], p(x["cold20"])) + f'<td>{x["coldn20"]}</td>' + td(x["ts20"], f(x["ts20"], 2)) + '</tr>')
A_('</table></div></section>')
A_(f'<p class="note">With 20 to 70 readings in each of those cells, and readings on neighbouring days almost identical, no single row above is evidence about that name. They are there to show the spread, not to rank the names.</p>')

# ---------- flashing ----------
A_(f'<h2>6 · When the reading itself jumps — "N× its usual day" {M}</h2>')
fu = fl["up"]["1"]; fd = fl["down"]["1"]
A_(f'<p class="note">A flash here is the composite moving in one day by several times that name\'s own usual one-day change in the composite (its median over the previous 60 sessions). The next session after a jump of 5× or more was a bigger day than normal — {f(fu["5x+"]["mv"],2,False)}× and {f(fd["5x+"]["mv"],2,False)}× the name\'s usual day, against {f(fu["<1x"]["mv"],2,False)}× after a quiet change — but with no direction: {p(fu["5x+"]["up"],1,False)} rose after an upward flash, {p(fd["5x+"]["up"],1,False)} after a downward one. So a flash marks "something is happening in this name", which the size of the day already showed; it does not say which way next. (The "usual day" is close to close; the next-session move is open to close, which is why even a quiet day reads below 1×.)</p>')
A_('<section><div class="tw"><table><tr><th>CHANGE IN THE READING THAT DAY</th><th>DIRECTION OF THE CHANGE</th><th>READINGS</th><th>NEXT SESSION: TYPICAL MOVE</th><th>ROSE</th><th>SIZE OF NEXT SESSION (× USUAL DAY)</th><th>SHARE THAT WERE 2× DAYS OR MORE</th><th>5 SESSIONS: TYPICAL MOVE</th><th>20 SESSIONS: TYPICAL MOVE</th></tr>')
for b in ["<1x", "1-2x", "2-3x", "3-5x", "5x+"]:
    for dn_, nm in (("up", "up"), ("down", "down")):
        x1 = fl[dn_]["1"][b]; x5 = fl[dn_]["5"][b]; x20 = fl[dn_]["20"][b]
        lbl = {"<1x": "under 1× its usual change", "1-2x": "1× to 2×", "2-3x": "2× to 3×", "3-5x": "3× to 5×", "5x+": "5× or more"}[b]
        A_(f'<tr{" class=sep" if nm=="up" else ""}><td>{lbl}</td><td class="{"u" if nm=="up" else "d"}">{nm}</td><td>{n(x1["n"])}</td>' + td(x1["med"], p(x1["med"])) + f'<td>{p(x1["up"],1,False)}</td><td>{f(x1["mv"],2,False)}×</td><td>{p(x1["big"],1,False)}</td>' + td(x5["med"], p(x5["med"])) + td(x20["med"], p(x20["med"])) + '</tr>')
A_('</table></div></section>')

# ---------- bucket tables with sample sizes ----------
A_(f'<h2>7 · The full bucket tables, with sample sizes {M}</h2>')
def bucket_table(title, src, note):
    A_(f'<section><h3>{title}</h3><div class="tw"><table><tr><th>GROUP</th><th>READINGS (1 SESSION)</th><th>TYPICAL MOVE 1</th><th>ROSE</th><th>SIZE (× USUAL DAY)</th><th>READINGS (5)</th><th>TYPICAL MOVE 5</th><th>ROSE</th><th>AGAINST THE DAY\'S TYPICAL NAME</th><th>READINGS (20)</th><th>TYPICAL MOVE 20</th><th>ROSE</th><th>AGAINST THE DAY\'S TYPICAL NAME</th></tr>')
    for k in range(1, 11):
        a = src["1"][str(k)]; b = src["5"][str(k)]; c = src["20"][str(k)]
        lab = f"{k}" + (" · coldest" if k == 1 else " · hottest" if k == 10 else "")
        A_(f'<tr><td>{lab}</td><td>{n(a["n"])}</td>' + td(a["med"], p(a["med"])) + f'<td>{p(a["up"],1,False)}</td><td>{f(a["mv"],2,False)}×</td><td>{n(b["n"])}</td>' + td(b["med"], p(b["med"])) + f'<td>{p(b["up"],1,False)}</td>' + td(b["xmed"], p(b["xmed"])) + f'<td>{n(c["n"])}</td>' + td(c["med"], p(c["med"])) + f'<td>{p(c["up"],1,False)}</td>' + td(c["xmed"], p(c["xmed"])) + '</tr>')
    A_('</table></div></section>')
    A_(f'<p class="note">{note}</p>')
bucket_table("Composite · ten groups by that evening's line-up", cs, f"Readings come from {S['sessions']} evenings; the 5- and 20-session columns use overlapping stretches, so they hold far fewer separate pieces of evidence than the counts suggest — about {S['sessions']//5} and {S['sessions']//20} separate stretches.")
bucket_table("Composite · ten groups by each name's own history", own, f"The end groups are larger than a tenth because readings cluster at a name's own extremes. Hot readings fall on {ohc['20']['all']['hot_days']} evenings and cold ones on {ohc['20']['all']['cold_days']}, but they bunch: in March 2026 and September 2026 about a quarter of all readings were cold at once, so a cold reading is mostly a statement about the market that week.")

# stability
A_(f'<section><h3>Half-year by half-year · composite, that evening\'s line-up</h3><div class="tw"><table><tr><th>PERIOD</th><th>EVENINGS</th><th>SCORE 1</th><th>SCORE 5</th><th>SCORE 20</th><th>20 SESSIONS, AGAINST THE DAY\'S TYPICAL NAME: HOTTEST TENTH</th><th>COLDEST TENTH</th></tr>')
for k, v in C["halves"].items():
    A_(f'<tr><td>{k}</td><td>{v["days"]}</td>' + td(v["1"]["ic"], f(v["1"]["ic"])) + td(v["5"]["ic"], f(v["5"]["ic"])) + td(v["20"]["ic"], f(v["20"]["ic"])) + td(v["20"]["hot_x"], p(v["20"]["hot_x"])) + td(v["20"]["cold_x"], p(v["20"]["cold_x"])) + '</tr>')
A_('</table></div></section>')
A_(f'<p class="note">The sign changes from one half-year to the next. The score was above zero in late 2024, the second half of 2025 and the first half of 2026, and below zero in the first half of 2025 and since July 2026. A signal that flips like this is behaving like chance.</p>')

# ---------- rows used ----------
A_(f'<h2>8 · Rows used — what the June note meant, and what was actually usable {M}</h2>')
A_(f"""<section><div class="tw"><table><tr><th>SOURCE</th><th>ROWS</th><th>SPAN</th><th>NAMES</th><th>WHAT IT HOLDS</th><th>USED FOR</th></tr>
<tr><td>bt_daily_signal (database, public read)</td><td>22,189</td><td>13 Apr 2013 – 1 Jun 2026</td><td>12</td><td style="white-space:normal;text-align:left">An older five-part score (micro, short, mid, long, mom) with the 3-, 5-, 10- and 20-session moves already attached</td><td style="white-space:normal;text-align:left">Section 9. This is the larger half of the June note's "38,000 rows"</td></tr>
<tr><td>weight_backtest_log (database, public read)</td><td>16,296</td><td>one run, 15 Jun 2026</td><td>the same 12</td><td style="white-space:normal;text-align:left">Result lines from trying 8 named weight mixes and 490 random ones on those rows</td><td style="white-space:normal;text-align:left">Section 9. The other half of the "38,000"</td></tr>
<tr><td>composite_history (database, public read)</td><td>{n(stored['rows_total'])}</td><td>9 Aug – 2 Oct 2026, {stored['dates_total']} dates</td><td>{stored['names']}</td><td style="white-space:normal;text-align:left">A nightly copy of today's Geiger composite. {n(stored['frozen_rows'])} of the rows are repeats: {stored['frozen_names']} stock and fund names have carried the same 24 Aug value every night since; only {stored['live_names_after_24aug']} crypto, futures and rates names kept updating</td><td style="white-space:normal;text-align:left">Section 9. {n(stored['rows_joined_evening'])} usable evening readings on {len(stored['dates_joined'])} dates</td></tr>
<tr class="sep"><td>Chart API /candles (public, the Hub's own read)</td><td>{n(S['rows'])} readings rebuilt</td><td>21 Oct 2024 – 2 Oct 2026, {S['sessions']} sessions</td><td>{S['names']}</td><td style="white-space:normal;text-align:left">Daily, 3h, 4h, 6h and 12h bars for all 590 Hub names (the 3-day and weekly bars were built from the daily ones and matched the provider's own bar for bar)</td><td style="white-space:normal;text-align:left">Sections 1 to 7 — every reading recomputed with the Geiger's own rung maths, and every move afterwards</td></tr>
</table></div></section>""")
A_(f'<p class="note">No per-rung history is stored anywhere a public read can reach: the database keeps only the blended composite, and the provider\'s per-rung files sit in its private bucket, which needs the provider\'s keys. So sections 1 to 7 rebuild the readings instead — the same formulas, the same bars, the same weights the Geiger uses today. The rebuild was checked against the live Geiger at the same minute on 20 names: the typical gap was {G["median_abs_diff"]:.7f} on a scale of −1 to +1, the largest {G["max_abs_diff"]:.3f}. Of the 590 names, {S["names"]} had enough history to take part; {S["names_present_from_start"]} were present from the first evening and {S["names_joined_later"]} joined as their history filled in.</p>')

# ---------- June rows + stored ----------
A_(f'<h2>9 · What the stored rows say on their own {M}</h2>')
A_(f'<p class="note"><b>The June rows.</b> They are real and intact — the moves attached to them match the chart API\'s closes exactly on all 1,035 Apple rows checked. But they are not the Geiger of today: they score an older five-part model on 12 names, and "mom" is simply the name\'s own move over the previous 20 sessions. The June run\'s headline for the equal mix over 5 sessions was a score of 0.117 and a hit rate of 53.6%. Two things about that: {p(A["pooled_up5"],1,False)} of all 5-session stretches in those rows rose anyway, so a 53.6% hit rate is below what "always say up" would have scored; and the 0.117 could not be reproduced — the same rows give {f(A["pooled_ic_equal_5"])} when every row is ranked together, and name by name it is negative for {sum(1 for x in A["names"] if x["ic_equal_5"]<0)} of the 12.</p>')
A_('<section><h3>June rows · equal mix of the five parts · each name against its own history</h3><div class="tw"><table><tr><th>NAME</th><th>GROUP</th><th>ROWS</th><th>FROM</th><th>TO</th><th>SCORE 5</th><th>SCORE 20</th><th>20 SESSIONS AFTER ITS HOTTEST TENTH</th><th>READINGS</th><th>AFTER ITS COLDEST TENTH</th><th>READINGS</th><th>ALL ITS READINGS</th><th>ROSE (ALL)</th></tr>')
for x in A["names"]:
    A_(f'<tr><td>{x["ticker"]}</td><td>{x["cohort"]}</td><td>{n(x["n"])}</td><td>{x["first"]}</td><td>{x["last"]}</td>' + td(x["ic_equal_5"], f(x["ic_equal_5"])) + td(x["ic_equal_20"], f(x["ic_equal_20"])) + td(x["hot_med_20"], p(x["hot_med_20"])) + f'<td>{x["hot_n_20"]}</td>' + td(x["cold_med_20"], p(x["cold_med_20"])) + f'<td>{x["cold_n_20"]}</td>' + td(x["all_med_20"], p(x["all_med_20"])) + f'<td>{p(x["up20"],1,False)}</td></tr>')
A_('</table></div></section>')
sh = stored["h"]
A_(f'<p class="note"><b>The stored nightly copies of today\'s Geiger.</b> Only {len(stored["dates_joined"])} evenings are usable (10 to 21 Aug 2026; {n(stored["rows_joined_evening"])} readings, {stored["names_joined"]} names). On those the ordering score was {f(sh["1"]["ic"])} at 1 session, {f(sh["5"]["ic"])} at 5 and {f(sh["20"]["ic"])} at 20, and the hottest tenth did {p(sh["5"]["hot_med"])} over 5 sessions against {p(sh["5"]["cold_med"])} for the coldest ({sh["5"]["hot_n"]} and {sh["5"]["cold_n"]} readings). Seven evenings in one fortnight cannot settle anything; it is shown because it is what was stored. The rebuilt readings agree with these stored ones at between {min(v["corr"] for v in stored["agreement"].values()):.2f} and {max(v["corr"] for v in stored["agreement"].values()):.2f} (1.00 would be identical) — the Geiger\'s engine was still being changed that fortnight.</p>')

# ---------- caveats ----------
la = C["lookahead"]; lk = L["ic_next_open"]["M_12h"]["1"]; fx = ic["M_12h"]["1"]
A_(f'<h2>10 · What could be wrong {M}</h2>')
A_(f"""<ol>
<li><b>The period.</b> Two years, and a rising market: SPY went from {MK['spy_first']:.0f} to {MK['spy_last']:.0f} ({p(MK['spy_change'],0)}), with one fall of {p(MK['spy_maxdd'],0)} in spring 2025; {p(MK['share_names_up'],0,False)} of the names ended higher and the typical name gained {p(MK['median_name_change'],0)}. Nothing here says how the Geiger behaves in a long falling market. June to October 2026 alone is far too short to judge.</li>
<li><b>Readings taken after the close — the trap that mattered.</b> The Geiger's fast rungs include the evening session (to 20:00 New York). A test that measured "what happened next" from that day's 16:00 close would be crediting the Geiger with a move it had already seen. Every move on this page therefore starts at the <b>next morning's open</b>. Measured the careless way, the hottest tenth looks {p(la['1']['hot_cc_x'],3)} better than the day's typical name at 1 session and the coldest {p(la['1']['cold_cc_x'],3)}; measured properly it is {p(la['1']['hot_fo_x'],3)} and {p(la['1']['cold_fo_x'],3)}.</li>
<li><b>A clock trap that produced a false "the 12h rung leads".</b> The stored intraday bars sit on a clock that slides by an hour between summer and winter time. In winter, on 372 of the 590 names, a "12h" bar begins at 23:00 and runs to 11:00 the next morning — it contains the first ninety minutes of the next session. Counted as part of the day it starts on, it made 12h momentum look like the best signal on the page (score {f(lk['ic'])}, luck test {f(lk['t'],1)}). With each bar assigned to the session it actually trades in, the score is {f(fx['ic'])}. It was a leak, not a signal. Worth knowing for the live Geiger too: in winter that rung's bars straddle two sessions.</li>
<li><b>Names admitted later.</b> The test uses today's 590 names. Names that were dropped, delisted or bought out are not in it, and today's list was put together in 2026, with hindsight. That flatters every group equally in a rising market, so it should not create a false hot-versus-cold gap, but it does lift every "typical move" on the page.</li>
<li><b>Overlapping stretches.</b> A 20-session move measured on Monday and again on Tuesday share 19 days. {n(S['rows_fo20'])} readings at 20 sessions rest on about {S['sessions']//20} separate stretches. The "luck test" columns allow for this; the raw counts do not.</li>
<li><b>Neighbouring names move together.</b> On a sell-off day hundreds of names turn cold at once. The own-history result in section 2 is mostly that: {p(ocold(20)['med'])} against {p(ohot(20)['med'])} in raw terms shrinks to {p(ocold(20)['xmed'])} against {p(ohot(20)['xmed'])} once each move is set against the same day's typical name.</li>
<li><b>Prices.</b> Split-adjusted, not dividend-adjusted, so funds and high-dividend names are understated by their payouts. No trading costs. The rebuilt 3-day and weekly bars were checked against the provider's on one name (199 of 199 weekly and 299 of 299 three-day bars identical).</li>
<li><b>What "hot" means.</b> The Geiger is signed: +1 is every trend line stacked upward and momentum at the top of its range. "Hot" on this page is the high end of that scale and "cold" the low end. A different idea of hot — distance from the middle in either direction — is covered by the size-of-move line in the opening paragraph and showed nothing either.</li>
</ol>""")

A_(f'<h2>11 · What could not be measured</h2>')
A_(f"""<ul>
<li>The per-rung readings exactly as the Geiger published them each day. They are not kept in any table the public key can read; the provider's own files need its keys. The readings here are rebuilt, and checked against the live Geiger on 20 names (section 8).</li>
<li>Crypto, futures and rates under today's Geiger. The chart API's 590 names are all stocks and funds; the {stored["live_names_after_24aug"]} other names kept their nightly copies (about 40 evenings each) but their bars were not pulled for this test, and 22 names over 40 evenings would not settle anything. The June rows cover Bitcoin, Ether, the S&amp;P future and gold, but under the older model.</li>
<li>Anything shorter than one session (whether a hot 3h rung leads the next few hours), and anything longer than 20 sessions.</li>
<li>The Geiger combined with your other inputs — earnings load, news, sentiment, the AI cycle — or with your own judgement. Your point of 26 Sep stands untested: that the edge comes from adding the items together. This page shows only that the Geiger alone is not that edge.</li>
<li>A long falling market. The two years tested hold one sharp fall and recovery, not a drawn-out decline. The chart API keeps more years of bars than were pulled for this test, so a longer run is possible.</li>
</ul>""")

A_(f"""<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>Sources.</b> Supabase project wadinxqplrggagkvrdag through the Hub's own public (anon) key, read only: bt_daily_signal, weight_backtest_log, composite_history, composite_staged, operator_weights, company_profile, cohorts. Chart API https://scintilla-massive-chart-api.fly.dev: /universe, /geiger, /candles with authority=provider for tf D, 180, 240, 6h, 12h, on 5 Oct 2026 between 16:00 and 16:12 New York time, three requests at a time. No backend-role read, no Fly machine, no key printed or stored.</p>
<p><b>Reading.</b> For each name and each session, each rung is read from its newest 230 bars with the publisher's own maths (services/hot-query/geiger-rung-math.mjs on provider/p9-prevclose-hold-20261002): nine moving-average lines (EMA 5, 8, 13, 21, 34 and SMA 50, 100, 150, 200), trend = share of neighbouring lines in rising order, scaled −1 to +1; momentum = RSI(14) bounded 23–77 at weight 0.6 plus Williams %R(14) bounded −90 to −10 at weight 0.4; rung = half trend, half momentum. Composite = the seven rungs at today's weights (3h {W['3h']:.3f}, 4h {W['4h']:.3f}, 6h {W['6h']:.3f}, 12h {W['12h']:.3f}, 1d {W['1d']:.3f}, 3d {W['3d']:.3f}, 1w {W['1w']:.3f}; operator_weights, global owner). Only sessions where all seven rungs could be read are in the test. Intraday rungs use bars that start after 20:00 the evening before and before 20:00 New York on the session date. The 3-day and weekly rungs use the provider's bar grid with the unfinished bar holding only the days up to the session.</p>
<p><b>What happened next.</b> From the next session's opening price to the close 1, 5 and 20 sessions after the reading. "Typical" is the median. "Rose" is the share above zero. "Against the day's typical name" subtracts the median move of all names read that same evening. "× usual day" divides the size of the move by the name's median absolute close-to-close move over the previous 60 sessions; a "2× day" at 5 or 20 sessions is scaled by the square root of the number of sessions.</p>
<p><b>Ordering score.</b> Spearman rank correlation between reading and later move across names, computed each evening (at least 50 names) and averaged. "Luck test" = the average divided by its standard error, with the number of evenings divided by the horizon to allow for overlap. Sector scores need at least 12 names that evening. Per-name scores are the rank correlation through time for that name (at least 150 readings).</p>
<p><b>Own-history groups.</b> A reading's rank within that name's previous 250 readings (at least 120), cut into tenths. Flash = the absolute one-day change in the composite divided by the name's median absolute one-day change over the previous 60 sessions (at least 40), that day excluded.</p>
<p><b>Sectors.</b> company_profile.sector; anything flagged as a fund, in the FUNDS or INDEXES cohort, or in the chart API's geiger_only tier is counted under Funds (ETFs).</p>
<p><b>Tuned weights.</b> Least-squares fit of the later move's rank on the fourteen parts' ranks (within each evening) using evenings before 13 Oct 2025; the fitted mix is then scored on the evenings after.</p>
<p><b>Not done.</b> No change to the Geiger, its weights, any table, the Hub, the Station or the provider. No deploy.</p>
</details>
</main>
</body>
</html>
""")
open(sys.argv[1], "w").write("".join(out))
print("written", sys.argv[1], len("".join(out)))
