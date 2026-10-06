import json, html, datetime as dt
R = json.load(open("results.json"))
S = R["sectors"]; F = R["funds"]; RS = R["rrg_settings"]
INK="#d2d2d2"; INK2="#b4b4b8"; INK3="#8c8c92"; LINE="#2a2a30"; PANEL="#121216"
BOX={"LEADING":"#199e70","WEAKENING":"#c98500","LAGGING":"#d55181","IMPROVING":"#3987e5"}
BOXL={"LEADING":"L","WEAKENING":"W","LAGGING":"G","IMPROVING":"I"}
BOXWORD={"LEADING":"leading","WEAKENING":"weakening","LAGGING":"lagging","IMPROVING":"improving"}
e=html.escape
def f2(x): return "–" if x is None else f"{x:+.2f}"
def f3(x): return "–" if x is None else f"{x:+.3f}"
def pc(x):
    if x is None: return "–"
    n=round(x*100); suf="th" if 10<=n%100<=20 else {1:"st",2:"nd",3:"rd"}.get(n%10,"th"); return f"{n}{suf}"
def pct0(x): return "–" if x is None else f"{round(x*100):d}%"
ORDER=["TECH","HEALTH","FINANCIALS","DISCRET","INDUSTRIAL","MATERIALS","ENERGY","STAPLES","UTILITIES","REAL_ESTATE","COMMS","CRYPTO","METALS","OIL"]
rows=[(k,S[k]) for k in ORDER]
rows_sorted=sorted(rows,key=lambda kv:-(kv[1]["own_cw"]["pct_12m"] or 0))

# ---------- the gauge column ----------
def gauge_svg(w=760):
    rh=34; top=58; h=top+rh*len(rows_sorted)+40
    x0=230; x1=w-150; tw=x1-x0
    X=lambda p:x0+p*tw
    o=[f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="The sector gauge: each sector\'s reading as a percentile of its own last 12 months, coloured by its RRG box" style="max-width:100%;height:auto">']
    o.append(f'<text x="0" y="16" fill="{INK}" font-size="12" letter-spacing="1.5">THE GAUGE — today inside each sector\'s OWN last 12 months, coloured by its box</text>')
    o.append(f'<text x="0" y="33" fill="{INK3}" font-size="11">left = cold for itself · right = hot for itself · dot = today · letter = its RRG box (legend below)</text>')
    for p,lab in [(0,"0"),(0.2,"20th"),(0.5,"50th"),(0.8,"80th"),(1,"100th")]:
        o.append(f'<line x1="{X(p):.1f}" x2="{X(p):.1f}" y1="{top-6}" y2="{top+rh*len(rows_sorted)}" stroke="{LINE}" stroke-width="1" stroke-dasharray="{"" if p in(0,1) else "2 3"}"/>')
        o.append(f'<text x="{X(p):.1f}" y="{top-10}" fill="{INK3}" font-size="10" text-anchor="middle">{lab}</text>')
    o.append(f'<rect x="{X(0):.1f}" y="{top-2}" width="{X(0.2)-X(0):.1f}" height="{rh*len(rows_sorted)+4}" fill="#ffffff" opacity="0.025"/>')
    o.append(f'<rect x="{X(0.8):.1f}" y="{top-2}" width="{X(1)-X(0.8):.1f}" height="{rh*len(rows_sorted)+4}" fill="#ffffff" opacity="0.025"/>')
    for i,(k,v) in enumerate(rows_sorted):
        y=top+i*rh+rh/2; f=v["own_cw"]; g=v["rrg_cw"]; p=f["pct_12m"]; col=BOX[g["box"]]
        o.append(f'<line x1="{x0}" x2="{x1}" y1="{y:.1f}" y2="{y:.1f}" stroke="{LINE}" stroke-width="1"/>')
        o.append(f'<text x="{x0-10}" y="{y+4:.1f}" fill="{INK}" font-size="12" text-anchor="end">{e(v["name"])}</text>')
        # the 12-month median sits at the 50th by definition; show the all-history percentile as a hollow tick for context
        pa=f["pct_all"]
        if pa is not None and abs(pa-p)>0.005:
            o.append(f'<line x1="{X(pa):.1f}" x2="{X(pa):.1f}" y1="{y-7:.1f}" y2="{y+7:.1f}" stroke="{INK3}" stroke-width="1.5"><title>{e(v["name"])}: {pc(pa)} percentile of all {f["sessions_total"]} sessions on record</title></line>')
        o.append(f'<g><title>{e(v["name"])} — today {f3(f["today"])} · {pc(p)} percentile of its own last 12 months ({f["sessions_12m"]} evenings) · 12-month median {f3(f["median_12m"])} · RRG {BOXWORD[g["box"]]} (RS-Ratio {g["rs_ratio"]:.2f}, RS-Momentum {g["rs_momentum"]:.2f})</title>'
                 f'<circle cx="{X(p):.1f}" cy="{y:.1f}" r="10" fill="{col}" stroke="{PANEL}" stroke-width="2"/>'
                 f'<text x="{X(p):.1f}" y="{y+3.5:.1f}" fill="#0b0b0e" font-size="10" font-weight="700" text-anchor="middle">{BOXL[g["box"]]}</text></g>')
        o.append(f'<text x="{x1+10}" y="{y+4:.1f}" fill="{INK2}" font-size="11">{pc(p)} · {f3(f["today"])}</text>')
    y=top+rh*len(rows_sorted)+22
    o.append(f'<text x="0" y="{y}" fill="{INK3}" font-size="10.5">thin grey tick = the same reading against all ≈2 years on record (42 evenings for crypto, metals, oil) · hover a dot</text>')
    o.append("</svg>"); return "".join(o)

# ---------- the RRG ----------
def rrg_svg(w=760,h=620):
    pl,pr,pt,pb=56,20,50,46; iw,ih=w-pl-pr,h-pt-pb
    pts=[(k,v) for k,v in S.items() if v["rrg_cw"]]
    xs=[p[1] for k,v in pts for p in v["rrg_cw"]["tail"]]; ys=[p[2] for k,v in pts for p in v["rrg_cw"]["tail"]]
    lo=min(min(xs),min(ys),97.0); hi=max(max(xs),max(ys),103.0); pad=0.4; lo-=pad; hi+=pad
    X=lambda v:pl+(v-lo)/(hi-lo)*iw; Y=lambda v:pt+(hi-v)/(hi-lo)*ih
    o=[f'<svg viewBox="0 0 {w} {h}" width="{w}" height="{h}" role="img" aria-label="Relative Rotation Graph of the sectors against SPY, weekly" style="max-width:100%;height:auto">']
    o.append(f'<text x="{pl}" y="16" fill="{INK}" font-size="12" letter-spacing="1.5">RELATIVE ROTATION — each sector against SPY · weekly · week ending {e(pts[0][1]["rrg_cw"]["week_end"])}</text>')
    o.append(f'<text x="{pl}" y="33" fill="{INK3}" font-size="11">across = RS-Ratio (right of 100 = stronger than SPY) · up = RS-Momentum (above 100 = gaining) · {RS["tail_weeks"]}-week tails</text>')
    # quadrants
    for (x0,x1,y0,y1,b) in [(100,hi,100,hi,"LEADING"),(100,hi,lo,100,"WEAKENING"),(lo,100,lo,100,"LAGGING"),(lo,100,100,hi,"IMPROVING")]:
        o.append(f'<rect x="{X(x0):.1f}" y="{Y(y1):.1f}" width="{X(x1)-X(x0):.1f}" height="{Y(y0)-Y(y1):.1f}" fill="{BOX[b]}" opacity="0.07"/>')
    o.append(f'<text x="{X(hi)-6:.1f}" y="{Y(hi)+14:.1f}" fill="{BOX["LEADING"]}" font-size="11" text-anchor="end" letter-spacing="1.5">LEADING</text>')
    o.append(f'<text x="{X(hi)-6:.1f}" y="{Y(lo)-8:.1f}" fill="{BOX["WEAKENING"]}" font-size="11" text-anchor="end" letter-spacing="1.5">WEAKENING</text>')
    o.append(f'<text x="{X(lo)+6:.1f}" y="{Y(lo)-8:.1f}" fill="{BOX["LAGGING"]}" font-size="11" letter-spacing="1.5">LAGGING</text>')
    o.append(f'<text x="{X(lo)+6:.1f}" y="{Y(hi)+14:.1f}" fill="{BOX["IMPROVING"]}" font-size="11" letter-spacing="1.5">IMPROVING</text>')
    # axes
    o.append(f'<line x1="{X(100):.1f}" x2="{X(100):.1f}" y1="{pt}" y2="{pt+ih}" stroke="{INK3}" stroke-width="1"/>')
    o.append(f'<line x1="{pl}" x2="{pl+iw}" y1="{Y(100):.1f}" y2="{Y(100):.1f}" stroke="{INK3}" stroke-width="1"/>')
    import math
    t0=math.ceil(lo); 
    for t in range(t0,int(hi)+1):
        o.append(f'<text x="{X(t):.1f}" y="{pt+ih+16}" fill="{INK3}" font-size="10" text-anchor="middle">{t}</text>')
        o.append(f'<text x="{pl-8}" y="{Y(t)+3.5:.1f}" fill="{INK3}" font-size="10" text-anchor="end">{t}</text>')
    o.append(f'<text x="{pl+iw/2:.1f}" y="{h-8}" fill="{INK3}" font-size="11" text-anchor="middle">JdK RS-Ratio</text>')
    o.append(f'<text x="14" y="{pt+ih/2:.1f}" fill="{INK3}" font-size="11" text-anchor="middle" transform="rotate(-90 14 {pt+ih/2:.1f})">JdK RS-Momentum</text>')
    # tails + dots
    for k,v in pts:
        g=v["rrg_cw"]; col=BOX[g["box"]]; tail=g["tail"]
        for i in range(1,len(tail)):
            op=0.3+0.6*i/(len(tail)-1)
            o.append(f'<line x1="{X(tail[i-1][1]):.1f}" y1="{Y(tail[i-1][2]):.1f}" x2="{X(tail[i][1]):.1f}" y2="{Y(tail[i][2]):.1f}" stroke="{col}" stroke-width="1.6" opacity="{op:.2f}" stroke-linecap="round"/>')
        for i in range(0,len(tail)-1):
            o.append(f'<circle cx="{X(tail[i][1]):.1f}" cy="{Y(tail[i][2]):.1f}" r="2.2" fill="{col}" opacity="0.6"/>')
        x,y=X(g["rs_ratio"]),Y(g["rs_momentum"])
        lab=v["cw"]
        o.append(f'<g><title>{e(v["name"])} ({lab}) — RS-Ratio {g["rs_ratio"]:.2f} · RS-Momentum {g["rs_momentum"]:.2f} · {BOXWORD[g["box"]]} · week ending {g["week_end"]}</title>'
                 f'<circle cx="{x:.1f}" cy="{y:.1f}" r="6" fill="{col}" stroke="{PANEL}" stroke-width="2"/>'
                 f'<text x="{x+9:.1f}" y="{y+4:.1f}" fill="{INK}" font-size="11">{e(lab)}</text></g>')
    o.append("</svg>"); return "".join(o)

# ---------- the table ----------
def table():
    o=['<div class="tw"><table><tr><th>SECTOR</th><th>FUND</th><th>3a BLEND</th><th>FUND GEIGER</th><th>OWN 12-MO PCTL</th><th>12-MO MEDIAN</th><th>OWN ALL PCTL</th><th>COVERAGE</th><th>RS-RATIO</th><th>RS-MOM</th><th>RRG BOX</th><th>THE GAUGE</th></tr>']
    for k,v in rows_sorted:
        f=v["own_cw"]; g=v["rrg_cw"]; ga=v["gauge"]
        cov=f'{f["sessions_12m"]} · {f["sessions_total"]} since {f["first"][:7]}'
        o.append(f'<tr><td>{e(v["name"])}</td><td>{e(v["cw"])}</td><td>{f2(v["alloc_blend_today"])}</td><td>{f3(f["today"])}</td><td><b>{pc(f["pct_12m"])}</b></td><td>{f3(f["median_12m"])}</td><td>{pc(f["pct_all"])}</td><td style="text-align:left;font-size:11px;color:{INK3}">{e(cov)}</td>'
                 f'<td>{g["rs_ratio"]:.2f}</td><td>{g["rs_momentum"]:.2f}</td><td><span class="bx" style="background:{BOX[g["box"]]}">{BOXL[g["box"]]}</span> {BOXWORD[g["box"]]}</td>'
                 f'<td style="white-space:normal;text-align:left;min-width:250px">{e(ga["word"].lower())}<br><span style="color:{INK3};font-size:11px">{e(ga["case"])}</span></td></tr>')
    o.append('</table></div>'); return "".join(o)

# ---------- the equal-weight twins ----------
def ew_table():
    o=['<div class="tw"><table><tr><th>SECTOR</th><th>EQUAL-WEIGHT TWIN</th><th>TWIN GEIGER TODAY</th><th>OWN 12-MONTH PERCENTILE</th><th>12-MONTH MEDIAN</th><th>COVERAGE</th><th>RS-RATIO</th><th>RS-MOMENTUM</th><th>RRG BOX</th><th>CAP-WEIGHT BOX (ABOVE)</th></tr>']
    for k,v in rows_sorted:
        if not v["ew"]: continue
        f=v["own_ew"]; g=v["rrg_ew"]
        o.append(f'<tr><td>{e(v["name"])}</td><td>{e(v["ew"])}</td><td>{f3(f["today"])}</td><td><b>{pc(f["pct_12m"])}</b></td><td>{f3(f["median_12m"])}</td><td style="font-size:11px;color:{INK3}">{f["sessions_12m"]} · {f["sessions_total"]} on record</td><td>{g["rs_ratio"]:.2f}</td><td>{g["rs_momentum"]:.2f}</td><td><span class="bx" style="background:{BOX[g["box"]]}">{BOXL[g["box"]]}</span> {BOXWORD[g["box"]]}</td><td>{BOXWORD[v["rrg_cw"]["box"]]}{"" if v["rrg_cw"]["box"]==g["box"] else " — <b>differs</b>"}</td></tr>')
    o.append('</table></div>'); return "".join(o)

# ---------- worked pairs ----------
def pair(a,b,title,verdict):
    A=S[a]; B=S[b]
    def col(v):
        f=v["own_cw"]; g=v["rrg_cw"]
        return [f'<b>{e(v["name"])}</b> ({e(v["cw"])}{"" if v["alloc_blend_today"] is not None else " — not on the bow tie"})',
            f'reading today <b>{f3(f["today"])}</b>' + (f' · 3a blend {f2(v["alloc_blend_today"])}' if v["alloc_blend_today"] is not None else ' · not on the bow tie'),
            f'its own last 12 months: lowest {f3(f["min_12m"])} · 10th {f3(f["p10_12m"])} · <b>median {f3(f["median_12m"])}</b> · 90th {f3(f["p90_12m"])} · highest {f3(f["max_12m"])} ({f["sessions_12m"]} evenings)',
            f'time spent above +0.20 ("overbought" in the allocation\'s words): <b>{pct0(f["share_12m_above_0p2"])}</b> of the year · below −0.20: {pct0(f["share_12m_below_m0p2"])}',
            f'so today is at its <b>{pc(f["pct_12m"])} percentile</b> — {e(v["gauge"]["word"].lower())}',
            f'against the market: RS = 100 × {g["last_close"]} ÷ {g["spy_close"]} = {g["rs_raw"]:.2f} (4-week mean {g["rs"]:.2f}) → RS-Ratio <b>{g["rs_ratio"]:.2f}</b>, RS-Momentum <b>{g["rs_momentum"]:.2f}</b> → <span class="bx" style="background:{BOX[g["box"]]}">{BOXL[g["box"]]}</span> <b>{BOXWORD[g["box"]]}</b>']
    ca,cb=col(A),col(B)
    o=[f'<h3>{e(title)}</h3><div class="pair">']
    for c in (ca,cb): o.append('<div>'+''.join(f'<p>{x}</p>' for x in c)+'</div>')
    o.append(f'</div><p class="verdict">{verdict}</p>'); return "".join(o)

def sv(k): return S[k]["own_cw"]
semi,ind=sv("SEMIS"),sv("INDUSTRIAL")
pairs=[
 pair("SEMIS","INDUSTRIAL","Semiconductors against Industrials — the pair you named",
   f'Semiconductors read {f3(semi["today"])} and Industrials {f3(ind["today"])}: on one universal scale semis look far hotter. But semis spent <b>{pct0(semi["share_12m_above_0p2"])}</b> of the year above +0.20 with a median of {f3(semi["median_12m"])}, Industrials {pct0(ind["share_12m_above_0p2"])} with a median of {f3(ind["median_12m"])}. Against its own year, semis sit at the {pc(semi["pct_12m"])} percentile and Industrials at the {pc(ind["pct_12m"])}. Semis run hot by nature <i>and</i> are hot for themselves today; Industrials are not oversold — they are simply in the lower-middle of their own normal, while lagging the market. That is "hot because it always runs hot" (part of it) and "hot for itself" (the rest), shown apart.'),
 pair("TECH","ENERGY","Technology against Energy — two positive readings, two different stories",
   f'Both read positive. Technology at {f3(sv("TECH")["today"])} is at its <b>{pc(sv("TECH")["pct_12m"])} percentile</b> and leading the market: hot for itself and a leader. Energy at {f3(sv("ENERGY")["today"])} is only at its {pc(sv("ENERGY")["pct_12m"])} percentile (its median is {f3(sv("ENERGY")["median_12m"])}) and its RS-Momentum has dropped below 100: inside its own normal, and weakening against the market. The allocation\'s 3a ranks both "leading" and "overbought"; the gauge says only one of them is stretched.'),
 pair("HEALTH","STAPLES","Health care against Consumer staples — both cold for themselves, only one is a laggard",
   f'Health care is at its {pc(sv("HEALTH")["pct_12m"])} percentile, Staples at its {pc(sv("STAPLES")["pct_12m"])}: almost the same coldness against their own year. But Health care\'s RS-Ratio is still above 100 ({S["HEALTH"]["rrg_cw"]["rs_ratio"]:.2f}, weakening box) — a sector that has been beating the market and has pulled back against its own normal. Staples\' RS-Ratio is {S["STAPLES"]["rrg_cw"]["rs_ratio"]:.2f}, in the lagging box: low for itself <i>and</i> behind the market. This is your 26 Sep case — a pullback on a leader against a laggard that is simply low — and the 3a reading alone cannot tell them apart (+0.02 against −0.33 says Health care is "hotter", nothing more).'),
 pair("REAL_ESTATE","METALS","Real estate against Metals — the two coldest for themselves",
   f'Real estate reads {f3(sv("REAL_ESTATE")["today"])}, its {pc(sv("REAL_ESTATE")["pct_12m"])} percentile: deep oversold for itself. Its RS-Momentum has turned above 100 (improving box) while RS-Ratio is still below: a laggard beginning to turn. Metals read {f3(sv("METALS")["today"])}, which on the universal scale is "neutral" — yet that is its <b>{pc(sv("METALS")["pct_12m"])} percentile</b>: gold spent {pct0(sv("METALS")["share_12m_above_0p2"])} of its (short, 42-evening) record above +0.20 and never below −0.20, so a near-zero reading is cold for gold. Metals is also in the lagging box this week. A neutral number that is cold for itself: the clearest case for the gauge over the raw reading.')
]

now=dt.datetime.now(dt.timezone(dt.timedelta(hours=-4))).strftime("%d %b %Y %H:%M ET")
CSS=f"""
  :root{{ --bg:#0b0b0e; --panel:{PANEL}; --line:{LINE}; --ink:{INK}; --ink2:{INK2}; --ink3:{INK3}; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1560px; margin:0 auto; padding:24px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .lead{{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1100px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; max-width:1100px; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 6px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:22px 0 6px; color:var(--ink); font-weight:600; }}
  h3{{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:18px 0 8px; color:var(--ink); font-weight:600; }}
  p{{ margin:6px 0; max-width:1100px; }}
  .note{{ color:var(--ink2); margin:6px 0 14px; max-width:1100px; }}
  .tw{{ overflow-x:auto; }}
  table{{ border-collapse:collapse; width:100%; min-width:1200px; }}
  th{{ text-align:right; font-size:11px; letter-spacing:.12em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }}
  td{{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); vertical-align:top; }}
  th:first-child, td:first-child{{ text-align:left; color:var(--ink); }}
  b{{ color:var(--ink); font-weight:600; }} a{{ color:var(--ink); }}
  .bx{{ display:inline-block; width:16px; height:16px; line-height:16px; border-radius:50%; text-align:center; font-size:10px; font-weight:700; color:#0b0b0e; vertical-align:-3px; }}
  .side{{ display:grid; grid-template-columns:minmax(0,760px) minmax(0,1fr); gap:18px; align-items:start; }}
  .side img{{ width:100%; height:auto; border:1px solid var(--line); display:block; }}
  .cap{{ color:var(--ink3); font-size:11px; margin-top:6px; }}
  .pair{{ display:grid; grid-template-columns:1fr 1fr; gap:18px; }}
  .pair > div{{ border:1px solid var(--line); padding:10px 12px; }}
  .pair p{{ margin:4px 0; font-size:13px; }}
  .verdict{{ color:var(--ink); margin-top:10px; max-width:1500px; }}
  .legend span{{ margin-right:16px; }}
  ol,ul{{ margin:6px 0 0 20px; padding:0; max-width:1100px; }} li{{ margin:6px 0; }}
  details{{ margin-top:22px; color:var(--ink3); font-size:13px; }} summary{{ cursor:pointer; letter-spacing:.2em; font-size:12px; }}
  details p, details li{{ color:var(--ink2); }}
  @media (max-width:900px){{ .side,.pair{{ grid-template-columns:1fr; }} body{{ font-size:13px; }} main{{ padding:16px 10px 70px; }} }}
"""
T=S["TECH"]["own_cw"]; H=S["HEALTH"]["own_cw"]; ST=S["STAPLES"]["own_cw"]
hot=[v["name"] for k,v in rows_sorted if v["own_cw"]["pct_12m"]>=0.8]; cold=[v["name"] for k,v in rows_sorted if v["own_cw"]["pct_12m"]<=0.2]
lead_leaders=[v["name"] for k,v in rows if v["rrg_cw"]["box"]=="LEADING"]; weak=[v["name"] for k,v in rows if v["rrg_cw"]["box"]=="WEAKENING"]; lag=[v["name"] for k,v in rows if v["rrg_cw"]["box"]=="LAGGING"]; imp=[v["name"] for k,v in rows if v["rrg_cw"]["box"]=="IMPROVING"]
html_out=f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>SG1 · the sector gauge: each sector against its own normal, coloured by where it stands against the market · 6 Oct 2026</title>
<style>{CSS}</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>SG1 · the sector gauge — each sector against its own normal, coloured by where it stands against the market</h1>
<p class="lead"><b>One number per sector cannot tell a leader from a laggard, because each sector has its own normal.</b> This study adds two things to the allocation's 3a reading: where today sits in that sector's <i>own</i> last 12 months (a percentile, never a universal threshold), and which of four boxes the sector is in against the market (leading, weakening, lagging, improving — the standard Relative Rotation Graph). Today, only {e(" and ".join(hot))} {"is hot for itself" if len(hot)==1 else "are hot for themselves"}; {e(", ".join(cold))} are cold for themselves. Health care and Consumer staples are equally cold against their own year, but Health care is still ahead of the market and Staples is behind it — the case you described on 26 Sep.</p>
<p class="sub">Tuesday 6 Oct 2026, built {e(now)} · a study, not a product change · nothing deployed, no table written, no page of the Hub changed · the allocation tool's 3a readings were read from the live page at the time above; the fund Geigers from the chart API at {e(R["as_of"]["geiger_computed_utc"][11:16])} UTC; the weekly closes are settled through the week ending {e(S["TECH"]["rrg_cw"]["week_end"])} (this week is still forming and is left out).</p>

<section>
<h2>1 · The pictures — the gauge beside today's allocation 3a</h2>
<p class="note">Left: the gauge. Each sector's dot is where today's fund Geiger sits in that sector's own last 12 months of evening readings; the colour and letter are its RRG box against SPY. Right: the allocation tool's 3a as it stands this morning, read live and headless — one blended number per sector on one shared scale, hottest at the top. The two orders differ, and that difference is the point.</p>
<div class="side">
  <div>{gauge_svg()}
  <p class="legend cap"><span><span class="bx" style="background:{BOX["LEADING"]}">L</span> leading</span><span><span class="bx" style="background:{BOX["WEAKENING"]}">W</span> weakening</span><span><span class="bx" style="background:{BOX["LAGGING"]}">G</span> lagging</span><span><span class="bx" style="background:{BOX["IMPROVING"]}">I</span> improving</span></p></div>
  <div><img src="shots/alloc-3a-today-1680.png" alt="The allocation tool's 3a sector bow tie this morning, 14 sectors, hottest at the top" loading="lazy"><p class="cap">allocation.scintillahub.ai · 3a THE BLENDED SECTOR BOW TIE · read headless at 1680 wide, {e(now)}. Crypto, Technology and Oil at the top; Real estate at the bottom.</p></div>
</div>
</section>

<section>
<h2>2 · The Relative Rotation Graph — leader or laggard against the market</h2>
<p class="note">The standard open-source picture of sector rotation. Across is strength relative to SPY (JdK RS-Ratio), up is whether that strength is growing (JdK RS-Momentum); both centred on 100. A sector turns clockwise through the four boxes over months. This week: leading — {e(", ".join(lead_leaders))}; weakening — {e(", ".join(weak))}; lagging — {e(", ".join(lag))}; improving — {e(", ".join(imp))}. SMH (Semiconductors) is drawn for the worked check; it is not one of the bow tie's 14.</p>
{rrg_svg()}
<p class="cap">Weekly closes from the chart API (Massive for the funds and SPY; the chart API's own crypto / futures feed for BTCUSD, GCUSD, CLUSD) · RS = 100 × close ÷ SPY close, smoothed by a 4-week mean · RS-Ratio = 100 + z-score of RS over 14 weeks · RS-Momentum = 100 + z-score of the 4-week change in RS-Ratio over 14 weeks · tails are the last {RS["tail_weeks"]} weeks · the implementation followed is <a href="https://github.com/milesfai/rrg-kit">milesfai/rrg-kit</a> (rrg.py, weekly settings: window 14, momentum_period 4, smooth 4), which calls this "the standard public approximation" — JdK's own formula is proprietary. No FMP fill was needed: every symbol's weekly series was complete on the chart API.</p>
</section>

<section>
<h2>3 · The table — sector · own-history percentile · RRG box · the gauge</h2>
<p class="note">Sorted hot-for-itself to cold-for-itself. "Fund Geiger today" is the cap-weighted sector fund's live Geiger composite (the one 3a input that has a history). "Own 12-month percentile" is the share of that fund's last 12 months of evening readings that sit below today's. "Coverage" says how many evenings the percentile rests on. The gauge's words: hot for itself (80th percentile or above), cold for itself (20th or below), inside its normal (between).</p>
{table()}
<h3>The equal-weight twins — the average stock in each sector</h3>
<p class="note">The same two readings for the equal-weighted fund of each sector (the right wing of the bow tie). The boxes agree with the cap-weighted funds in every sector this week.</p>
{ew_table()}
</section>

<section>
<h2>4 · Worked check on today — every number shown</h2>
<p class="note">Four pairs. For each sector: today's reading, the shape of its own last 12 months (lowest, 10th, median, 90th, highest), how much of the year it spent above +0.20 and below −0.20, the percentile that follows, and the RRG arithmetic from the weekly closes.</p>
{"".join(pairs)}
</section>

<section>
<h2>5 · Naming the two cases</h2>
<ul>
<li><b>A leader pulled back against its own normal</b> — RS-Ratio above 100 (leading or weakening box) <i>and</i> own-history percentile at or below the 30th. Today: <b>Health care</b> ({pc(H["pct_12m"])} percentile, weakening). On 26 Sep you said "a 5% pullback on a leader is better than a 30% pullback in a laggard"; this is the mark that finds the first half of that sentence.</li>
<li><b>A laggard that is simply low</b> — RS-Ratio below 100 (lagging or improving box) <i>and</i> own-history percentile at or below the 30th. Today: <b>Consumer staples</b> ({pc(ST["pct_12m"])}, lagging), <b>Real estate</b> ({pc(sv("REAL_ESTATE")["pct_12m"])}, improving — the momentum has turned, the ratio has not), <b>Metals</b> ({pc(sv("METALS")["pct_12m"])}, lagging).</li>
<li><b>A leader running hot for itself</b> — at or above the 80th percentile and ahead of the market. Today: <b>Technology</b> ({pc(T["pct_12m"])}), and Semiconductors ({pc(semi["pct_12m"])}) outside the bow tie.</li>
<li>Everything else is <b>inside its own normal</b>, whatever its raw number says. Energy at +0.45 and Oil at +0.51 are not stretched for themselves.</li>
</ul>
</section>

<section>
<h2>6 · Where each number comes from</h2>
<ul>
<li><b>The 3a blend</b>: read from the live allocation page's own table (its <code>blendTable()</code>) in a headless browser at {e(now)}. Five readings per sector averaged; Crypto, Metals and Oil carry 3 or 4 of 5 missing (named on the page).</li>
<li><b>The fund Geiger today</b>: the chart API's <code>/geiger</code>, computed {e(R["as_of"]["geiger_computed_utc"][11:19])} UTC, the same number the Hub's board and the allocation's "State Street fund" dial read.</li>
<li><b>The fund Geiger's own history</b>: the brief named the H11 composite history. That table (<code>composite_history</code>) holds, for the sector funds, only 11 distinct evenings in 40 rows — the rest are the 24 Aug reading carried forward, as H11 found — and one evening for the equal-weight twins. So the history was rebuilt the way G2 did on 5 Oct: the publisher's own rung maths (nine moving averages for trend, RSI and Williams %R for momentum, seven rungs 3h · 4h · 6h · 12h · 1d · 3d · 1w with the saved Equalizer's weights) replayed on the chart API's bars, one reading per name per session. The rebuilt reading for 5 Oct agrees with the stamped live row H11's dry run wrote that night: XLK {R["recon"]["XLK"]["rebuilt_5oct"]:+.4f} rebuilt against {R["recon"]["XLK"]["stored_5oct_chart_api_geiger"]:+.4f} stored; XLRE {R["recon"]["XLRE"]["rebuilt_5oct"]:+.4f} against {R["recon"]["XLRE"]["stored_5oct_chart_api_geiger"]:+.4f}.</li>
<li><b>Coverage</b>: the intraday rungs limit how far back a full seven-rung reading can be rebuilt — about two years (from Aug–Oct 2024) for every fund. The 12-month percentile rests on 251 evenings per fund. <b>A 3-year percentile could not be built</b>; the "all history" column is the ≈2 years that exist. For Crypto (BTCUSD), Metals (GCUSD) and Oil (CLUSD) the chart API's bars are not Massive's and the rung replay was not run; their percentile rests only on the 42 real nightly rows in <code>composite_history</code> (9 Aug – 5 Oct), and their "today" is last night's row, because these three are not in the chart API's Geiger.</li>
<li><b>The weekly closes</b>: the chart API's <code>/candles</code>, <code>tf=W</code>, provider-built, split-adjusted, with the forming week dropped by the API itself. {S["TECH"]["rrg_cw"]["weeks_used"]} weeks were available for every fund (174 for the newer equal-weight twins), far more than the 14 + 4 + 8 needed.</li>
</ul>
</section>

<section>
<h2>7 · What could be wrong</h2>
<ul>
<li>The percentile is of the <b>fund's Geiger</b>, not of the five-reading blend: the tree, the sector ranking and the served-set bow tie have no history to take a percentile of. When a sector's blend differs from its fund (Health care: +0.02 blend, −0.16 fund), the percentile describes the fund.</li>
<li>Two years of history is one market: a rise with one sharp fall (spring 2025). A sector's "normal" measured over a longer stretch could sit differently.</li>
<li>Crypto, Metals and Oil rest on 42 evenings. Gold's "never below −0.20" is a fact about those 42 evenings only.</li>
<li>The RRG is the public approximation, not JdK's formula; the boxes near the 100 lines (Health care at 100.18, Industrials at 98.16 / 99.94, Metals at 99.83) can change box in a week.</li>
<li>The thresholds for the gauge's words (20th / 80th) and for the named cases (30th / 80th) are this study's choice, set so the worked pairs read clearly; they are percentiles of each sector's own history, never levels of the reading itself.</li>
</ul>
</section>

<section>
<h2>8 · What was not done</h2>
<ul>
<li>No change to the allocation tool, the Hub or any page; this is a study on a branch.</li>
<li>No 3-year percentile (history does not exist in a form that can be read; see 6).</li>
<li>The rung replay was not run for BTCUSD, GCUSD, CLUSD.</li>
<li>No test of whether the gauge predicts anything; G2 on 5 Oct found the Geiger alone does not lead price.</li>
</ul>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>Sources.</b> Chart API <code>https://scintilla-massive-chart-api.fly.dev</code>: <code>/geiger</code> (today's composites), <code>/candles?tf=D|180|240|6h|12h</code> (the rung replay), <code>/candles?tf=W</code> (the RRG). Supabase project wadinxqplrggagkvrdag, read-only SQL: <code>composite_history</code> (coverage count; the 42 real rows for BTCUSD, GCUSD, CLUSD; the 5 Oct stamped rows for the check). The live allocation page for the 3a blend. No key was used from this machine; nothing was written.</p>
<p><b>Own-history percentile.</b> share of evenings strictly below today plus half of those equal. 12 months = evenings on or after the same date one year before the last reading (251 per fund). The rung replay is <code>tools/recon_g2.py</code> (G2's, unchanged) driven by <code>tools/rebuild.py</code>; the publisher maths it mirrors is <code>services/hot-query/geiger-rung-math.mjs</code> on the provider line.</p>
<p><b>RRG.</b> <code>tools/compute.py</code>: RS = 100 × close ÷ SPY close (weekly, settled bars only); RS smoothed by a 4-week mean; RS-Ratio = 100 + (RS − mean₁₄) ÷ sd₁₄ (population sd); RS-Momentum = 100 + z₁₄ of (RS-Ratio − RS-Ratio four weeks earlier); box by the sign of each against 100. Followed from <a href="https://github.com/milesfai/rrg-kit">milesfai/rrg-kit</a> rrg.py and config.py ("weekly": window 14, momentum_period 4, smooth 4, tail 12); this page draws 8 weeks of tail so the dots stay readable.</p>
<p><b>Gauge.</b> mark = own 12-month percentile of the cap-weighted fund's Geiger; colour = that fund's RRG box. Words: ≥ 80th hot for itself, ≤ 20th cold for itself. Cases: leader pulled back = box leading/weakening and ≤ 30th; laggard simply low = box lagging/improving and ≤ 30th; leader running hot = leading/weakening and ≥ 80th.</p>
<p><b>Colours.</b> Four box colours (#199e70 leading, #c98500 weakening, #d55181 lagging, #3987e5 improving) checked with the data-viz palette validator on this page's panel (#121216): lightness band, chroma, colour-blind separation and contrast all pass; every mark also carries its letter, so colour is never alone. The rest of the page is the Hub's greys.</p>
<p><b>Files.</b> <code>data/results.json</code> (every number on the page), <code>data/alloc3a.json</code> (the live 3a read), <code>data/recon/*.json</code> (rebuilt daily readings per fund), <code>tools/</code> (download, replay, compute, build, shots), <code>shots/</code> (headless pictures at 1680 and 390).</p>
</details>
</main>
</body>
</html>"""
open("SECTOR-GAUGE-STUDY.html","w").write(html_out); print("written",len(html_out))
