# NQ1 · writes WORKSHOP-QUEUE.html and the review-queue JSON from data/nq1-data.json. No network.
import json,html,os,sys
HERE=os.path.dirname(os.path.abspath(__file__)); OUT=os.path.join(HERE,'..')
D=json.load(open(os.path.join(OUT,'data','nq1-data.json'))); R=D['rows']; BY={r['ticker']:r for r in R}; P=D['parents']; F=P['funds']; CO=P['cohorts']
e=html.escape
def n(x,d=0,sign=True,suf=''):
    if x is None: return '—'
    s=f'{x:+.{d}f}' if sign else f'{x:.{d}f}'
    return s.replace('-','−')+suf
def you(t): return t.replace("Alan's first pick","Your first pick").replace("Alan's pick","Your pick").replace("Alan raised it","You raised it")
def pct(x): return '—' if x is None else f'{round(x)}'
def ordn(x):
    x=int(round(x)); s='th' if 10<=x%100<=20 else {1:'st',2:'nd',3:'rd'}.get(x%10,'th'); return f'{x}{s}'
def money(x): return '—' if x is None else (f'{x:,.0f}' if x>=1000 else f'{x:,.2f}')
def fund_words(r):
    g=f"revenue {n(r['rev_g'],suf='%')}" if r['rev_g'] is not None else 'no revenue estimate'
    g+= f", earnings {n(r['eps_g'],suf='%')}" if r['eps_g'] is not None else (', earnings just turning positive' if r['fwd_pe'] else ', no earnings yet')
    pe=f", {r['fwd_pe']:.0f}× next-year earnings" if r['fwd_pe'] else (', P/E not shown (reports in another currency)' if r.get('fwd_pe_note') else '')
    if r['comps_upside'] is None: c='; no comps price'
    else:
        q={'full':'','thin':' — thin, few rows price','different business':' — peers are mostly a different business'}[r['comps_conf']]
        c=f"; comps centre {n(r['comps_upside'],suf='%')}{q}"
    return g+pe+c
def tech_words(r):
    if r['geiger'] is None: return 'no Geiger'
    s=f"Geiger {n(r['geiger'],2)}"
    s+= f", {ordn(r['geiger_pctl'])} percentile of its own year" if r['geiger_pctl'] is not None else ', too new for an own-year percentile'
    if r.get('from_high_pct') is not None: s+=f"; {n(r['from_high_pct'],suf='%')} from its 52-week high, {n(r['vs_sma21_pct'],suf='%')} against its 21-day"
    return s
def line_words(r):
    if not r['lines']: return 'no reviewed lines'
    a=r['above']; b=r['below']; s=f"{r['lines']} reviewed lines"
    if b: s+=f" · below: {b['id']} {money(b['level'])} ({n(b['pct'],1,suf='%')})"
    if a: s+=f" · above: {a['id']} {money(a['level'])} ({n(a['pct'],1,suf='%')})"
    if r['pending']: s+=f" · {r['pending']} Daily selections pending"
    return s
mu=D['mu_21d']
# ------------------------------------------------------------------ the queue (hand-written reasons; every figure is from the data file)
def fw(t): return fund_words(BY[t])
def tw(t): return tech_words(BY[t])
fx=F['XLV']; fu=F['XLU']; rp=D['relative_price']; spe=D['sector_trailing_pe']
QUEUE=[
 dict(ticker='SNDK',parent='DRAM (memory fund) · SMH',status='new workshop work',priority='today',timeframes=['2W','1W','3D','1D'],
  fundamentals=fw('SNDK')+" (2 of its 12 peers are memory, so read the comps number as direction, not a target).",
  technicals=tw('SNDK')+"; no reviewed lines.",
  why="Alan's first pick. Second-best fundamentals of 192 names and cold against its own (short, 177-session) history: the leader-on-a-pullback case, with nothing drawn yet.",
  ask="first review: long-term context, active C/D, P1–P4 on 2W / 1W / 3D / 1D"),
 dict(ticker='XLU',parent='is the parent (Utilities)',status='new workshop work',priority='today',timeframes=['2W','1W','3D','1D'],
  fundamentals=f"fund roll-up: {fu['fwd_pe']}× next-year earnings against the market's {F['SPY']['fwd_pe']}×; revenue {n(fu['rev_g'],suf='%')}, earnings {n(fu['eps_g'],suf='%')} — slow growers. The sector's trailing P/E was at the {ordn(spe['Utilities']['pctl_10y'])} percentile of its own ten years on {spe['Utilities']['last_date']}: not cheap for itself.",
  technicals=f"Geiger {n(fu['geiger'],2)}, {ordn(fu['geiger_pctl'])} percentile of its own year; {n(fu['from_high_pct'],suf='%')} from its high; against the S&P its price is at the {ordn(rp['XLU']['pctl_all'])} percentile of seven years. No reviewed lines.",
  why="Alan's pick for the Market Desk. Deeply behind the market on price, but growth does not argue for it; its two fast members (VST, CEG) are hot while the regulated names are cold. The lines decide whether this is a base or just low.",
  ask="first review of the fund; the parent for VST and CEG"),
 dict(ticker='XLV',parent='is the parent (Health care)',status='new workshop work',priority='today',timeframes=['2W','1W','3D','1D'],
  fundamentals=f"fund roll-up: {fx['fwd_pe']}× next-year earnings against the market's {F['SPY']['fwd_pe']}×; revenue {n(fx['rev_g'],suf='%')}, earnings {n(fx['eps_g'],suf='%')} by weight (the middle member: {n(fx['eps_g_median'],suf='%')}). Trailing P/E at the {ordn(spe['Healthcare']['pctl_1y'])} percentile of its last year, {ordn(spe['Healthcare']['pctl_10y'])} of ten years ({spe['Healthcare']['last_date']}).",
  technicals=f"Geiger {n(fx['geiger'],2)}, {ordn(fx['geiger_pctl'])} percentile of its own year; {n(fx['from_high_pct'],suf='%')} from its high; against the S&P at the {ordn(rp['XLV']['pctl_all'])} percentile of seven years. No reviewed lines.",
  why="Alan's pick; the sector gauge's one 'cold for itself, leader on a pullback'. A little cheaper than the market with earnings growing about as fast, revenue much slower.",
  ask="first review of the fund; the parent for LLY"),
 dict(ticker='MU',parent='SMH · DRAM',status='re-check',priority='today',timeframes=['1D'],
  fundamentals=fw('MU')+" (2 of 12 peers are memory: direction, not a target).",
  technicals=tw('MU')+f". {line_words(BY['MU'])}. 21-day average {money(mu['avg_last_close'])} at the 5 Oct close and rising; {mu['closes_above_in_a_row']} closes above it in a row.",
  why="Best fundamentals of the 192. Price sits between its reviewed 3D P1 and 3D D1 with the rising 21-day just under P1: the readiness level and the reviewed line are about to meet.",
  ask="Daily C, D, T80 full patterns per the 6 Oct selections (LB1's ask stands)"),
 dict(ticker='AVGO',parent='SMH',status='re-check',priority='this week',timeframes=['1D'],
  fundamentals=fw('AVGO')+" — the strongest name whose comps set is its own business.",
  technicals=tw('AVGO')+f". {line_words(BY['AVGO'])}.",
  why="Fifth on fundamentals with full-confidence comps, inside its own normal while Nvidia and TSMC are at the top of theirs. Boxed between two reviewed lines 2% either side.",
  ask="confirm the pending Daily selections are captured; no new line requested"),
 dict(ticker='WDC',parent='DRAM (memory fund) · SMH',status='new workshop work',priority='this week',timeframes=['2W','1W','3D','1D'],
  fundamentals=fw('WDC')+". Revenue +45% with flat earnings is unusual and worth a look at the estimates on file; Seagate (STX) is the same story with earnings +111%.",
  technicals=tw('WDC')+"; no reviewed lines.",
  why="Alan raised it. Coldest of the memory group against its own year while revenue grows 45%. Same parent as SanDisk, so one fund workshop serves both.",
  ask="first review; consider STX alongside"),
 dict(ticker='VST',parent='XLU',status='re-check',priority='this week',timeframes=['1D','3D'],
  fundamentals=fw('VST')+".",
  technicals=tw('VST')+f". {line_words(BY['VST'])}.",
  why="'I missed it': it is hot for itself today, so the review is for the reload level, not a chase. The nearest reviewed line below is the candidate.",
  ask="confirm the pending Daily selections; mark the reload level against the retained lines"),
 dict(ticker='LLY',parent='XLV',status='new workshop work',priority='next review pass',timeframes=['2W','1W','3D','1D'],
  fundamentals=fw('LLY')+" — the fastest revenue grower among the large health-care weights, and priced above its peers for it.",
  technicals=tw('LLY')+"; no reviewed lines.",
  why="The health-care leader on a pullback, to sit under the XLV workshop. If a cheaper health name is wanted instead: REGN (12× earnings, comps centre +119%, 15th percentile) or ALNY (revenue +30%, earnings +64%).",
  ask="first review, after XLV"),
]
VERD={
 'SNDK':'IN THE QUEUE · 1','MU':'IN THE QUEUE · 4','WDC':'IN THE QUEUE · 6','VST':'IN THE QUEUE · 7','AVGO':'IN THE QUEUE · 5',
 'CEG':"Not now: modest growth, fairly priced, hot for itself. The XLU workshop covers its parent; wait for a pullback.",
 'NFLX':"Not queued: deepest red is not cheap. Growth is ordinary and the comps see no upside; its Geiger has been low for most of the year, so low is its normal.",
 'IBM':"Value, not growth: cheap against peers but the slowest grower here. Only if a value slot is wanted.",
 'NKE':"No: revenue and earnings are both shrinking.",
 'MCD':"No: slow growth, priced a little above peers.",
 'CBRS':"No review yet: about 215× next-twelve-month earnings (near 680× on this fiscal year), comps far below price on a thin set, lock-up and dilution ahead, and too few sessions since the 14 May IPO for a Geiger history.",
 'WMT':"A technical pullback only: expensive for its growth. Lines exist and price is sitting on one; watch, no new work.",
 'IREN':"Knockout stands. Revenue is tripling but there are no earnings, and it is not deeply cold against its own year. Next pass, with the neocloud group.",
 'ASTS':"No fundamentals case to rank: revenue from a tiny base, losses, comps cannot price it.",
 'HUT':"Next pass with the neocloud group: fast revenue, losses, no comps price, cold for itself.",
 'ACHR':"The coldest name on the list against its own year, and unproven: almost no revenue. Not queued.",
 'SPIR':"No: slow revenue for a loss-maker, cold because it keeps falling.",
 'KTOS':"Next pass, with ITA: real growth, but priced above peers; defence as a group is cold (ITA at the 7th percentile of its year).",
 'GOOGL':"No new work: lines exist, price is mid-way between two of them, and the estimates show earnings dipping.",
 'AMZN':"Watch the line: sitting just under 3D B4 with an approved 1W slope 1% below. No new work.",
 'CRWV':"Re-check next pass: the comps like it (+58%, its own business), revenue doubling, no earnings; today it is hot for itself with a reviewed line 2% above.",
 'LRCX':"Good new-work candidate for the next pass: solid growth, fairly priced, inside its normal, nothing drawn.",
 'META':"No: ordinary growth for the price and at the top of its own year.",
 'ASML':"No hurry: good growth, priced slightly above peers, inside its normal.",
 'NBIS':"No: hot for itself and far above its comps; lines already exist.",
 'TSM':"Wait: strong and steady growth, but at the very top of its own year.",
 'AAOI':"Extended: 25% above its 21-day; comps far below price.",
 'AXTI':"Extended: 20% above its 21-day; comps far below price.",
 'LITE':"Hot: at its high and the 90th percentile of its own year.",
 'COHR':"Best of the optical names on growth for the price; review after a pullback.",
 'CIEN':"Extended: 25% above its 21-day.",
 'FN':"The only optical name with comps upside; 19% above its 21-day, so wait.",
 'POET':"No fundamentals case: revenue from near zero, losses.",
 'CRDO':"Strongest optical grower; hot for itself and 21% above its 21-day. Review after a pullback.",
 'GLW':"No: slowest grower of the optical group and priced well above peers.",
}
ORDER="SNDK MU WDC AVGO VST CEG NFLX IBM NKE MCD CBRS WMT IREN HUT CRWV NBIS ASTS ACHR SPIR KTOS GOOGL AMZN META LRCX ASML TSM AAOI AXTI LITE COHR CIEN FN POET CRDO GLW".split()
# ------------------------------------------------------------------ review-queue JSON (LB1's schema v1, with named additions)
FEED=lambda t:'BATS:'+t
lb1_keep=[
 {"ticker":"SPY","feed":"BATS:SPY","why":"on radar · price at 1W P1 / 2W P1 777.44 retest from below; 1W B2 (approved slope) 1.0% above at 788.34","ask":"confirm 6 Oct Daily selections (C range, T77 upper) are captured; no new line requested","timeframes":["1D"],"priority":"today","source_step":"allocation 'when' · where-price-sits 2026-10-06 (LB1, carried unchanged)"},
 {"ticker":"QQQ","feed":"BATS:QQQ","why":"on radar · closed above 1W P3 / 2W P1 747.05 two sessions ago; nearest above 1W C1 776.95 (+2.1%)","ask":"dedupe the two similar retained 3D diagonals (Alan, 6 Oct) and capture C3 / D3 Daily lines","timeframes":["1D","3D"],"priority":"today","source_step":"allocation 'when' · where-price-sits 2026-10-06 (LB1, carried unchanged)"},
 {"ticker":"NVDA","feed":"BATS:NVDA","why":"picked in knockout (comps) · price 240.1 sits exactly on 1W B2 (approved slope) 240.10, 2W D3 0.8% above","ask":"Daily D1 / C3 / T84U geometry capture per 6 Oct selections","timeframes":["1D"],"priority":"today","source_step":"comps knockout 2026-10-06 (LB1, carried unchanged)"}]
items=[]
for i,q in enumerate(QUEUE):
    r=BY.get(q['ticker'])
    items.append({"ticker":q['ticker'],"feed":FEED(q['ticker']),"order":i+1,"status":q['status'],"parent_fund":q['parent'],
      "why":("new admission · " if q['status'].startswith('new') else "on radar · ")+q['why'],"fundamentals":q['fundamentals'],"technicals":q['technicals'],"ask":q['ask'],
      "timeframes":q['timeframes'],"priority":q['priority'],"source_step":"NQ1 workshop queue, both ends · 2026-10-06","fundamentals_rank_of_192":(r['rank'] if r else None),"reviewed_lines_today":(r['lines'] if r else 0)})
RQ={"schema":"scintilla.review-queue.v1","written_by":"NQ1 (Scintilla side). PROPOSAL for Alan and the coordinator — not sent to the Lab.","written_at":D['as_of']['quotes_newest_utc'],"queue_id":"RQ-20261006-02",
 "supersedes":"RQ-20261006-01 (LB1's proposal; kept beside this file as REVIEW-QUEUE-20261006.LB1-proposal.json). Its SPY, QQQ and NVDA items are carried unchanged below; its MU item is merged into item 4; its illustrative EXAMPLE-NEW row is dropped.",
 "additions_to_v1":["order","status (new workshop work | re-check)","parent_fund","fundamentals","technicals","fundamentals_rank_of_192","reviewed_lines_today"],
 "reads":{"retained_lines":"provider repo evidence/lb1-reviewed-lines-20261006/reviewed-lines-extract.json (V24 packs, sha-pinned)","lab_folder_is_read_only":True,"never_written_into":"INDICATOR_LAB/"},
 "defaults":{"timeframes":["2W","1W","3D","1D"],"capture_pivots":["P1","P2","P3","P4"],"no_new_slope_approval_implied":True,"no_attention_pairing_implied":True,"no_buffers":True,"dedupe":"by exact pivot geometry and anchors, never by family letter alone (DAILY-SELECTIONS-20261006 global rules)"},
 "feed_note":"feeds follow LB1's BATS:<ticker> convention; the Lab confirms the exact feed for names it has not reviewed before (SNDK, XLU, XLV, WDC, LLY).",
 "items":items,"carried_from_RQ-20261006-01":lb1_keep,
 "reply_expected":{"where":"INDICATOR_LAB/sprints/<sprint>/REVIEW-QUEUE-<date>-RESULT.json (Lab writes; we read)","shape":"per item: status (captured | declined | deferred), record hashes added, pack version, evidence file and sha256"}}
json.dump(RQ,open(os.path.join(OUT,'REVIEW-QUEUE-20261006.json'),'w'),indent=1,ensure_ascii=False)
# ------------------------------------------------------------------ page
UP='#3fae6a'; DN='#c9544d'
def gcol(v): return '' if v is None else f' style="color:{UP if v>=0 else DN}"'
def whenchip(r):
    w=r.get('when'); 
    return '—' if not w else w
css="""
:root{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }
*{ box-sizing:border-box; } body{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }
main{ max-width:1600px; margin:0 auto; padding:24px 16px 80px; }
h1{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }
.sub{ color:var(--ink3); margin:4px 0 16px; font-size:12px; }
section{ background:var(--panel); border:1px solid var(--line); margin:0 0 8px; padding:14px 16px; }
h2{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:2px 0 10px; color:var(--ink); font-weight:600; }
.tw{ overflow-x:auto; } .tall{ max-height:720px; overflow-y:auto; }
table{ border-collapse:collapse; width:100%; }
th{ text-align:right; font-size:11px; letter-spacing:.1em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); white-space:nowrap; position:sticky; top:0; background:var(--panel); }
td{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); vertical-align:top; }
th.l, td.l{ text-align:left; } td.w{ white-space:normal; text-align:left; min-width:300px; } td:first-child, th:first-child{ text-align:left; color:var(--ink); }
b{ color:var(--ink); font-weight:600; }
.q{ display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.card{ border:1px solid var(--line); padding:12px 14px; background:#0f0f13; }
.card .hd{ display:flex; gap:12px; align-items:baseline; flex-wrap:wrap; margin-bottom:6px; }
.card .tk{ font-size:20px; color:var(--ink); letter-spacing:.08em; font-weight:600; } .card .no{ color:var(--ink3); font-size:12px; }
.tag{ font-size:11px; letter-spacing:.14em; text-transform:uppercase; border:1px solid var(--line); padding:1px 7px; color:var(--ink); }
.tag.new{ background:#26262c; } .par{ color:var(--ink3); font-size:12px; }
.card p{ margin:5px 0; font-size:13px; } .k{ color:var(--ink3); font-size:11px; letter-spacing:.14em; text-transform:uppercase; display:block; }
.inq td{ background:#17171c; }
svg text{ font-family:"SF Mono", Menlo, Consolas, monospace; }
details{ margin-top:14px; color:var(--ink3); font-size:13px; } summary{ cursor:pointer; letter-spacing:.2em; font-size:12px; } details p, details li{ color:var(--ink2); max-width:1100px; } ul{ margin:6px 0 0 20px; padding:0; } li{ margin:6px 0; }
@media (max-width:900px){ .q{ grid-template-columns:1fr; } body{ font-size:13px; } main{ padding:16px 10px 70px; } .card .tk{ font-size:18px; } }
"""
H=[]; A=H.append
A(f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>NQ1 · which names go through the review next · 6 Oct 2026</title>
<style>{css}</style></head><body><main>
<span data-scnav-slot></span><h1>NQ1 · which names go through the Market Desk / Clean review next</h1>
<p class="sub">Tuesday 6 Oct 2026 · prices and Geigers read {int(D['as_of']['quotes_newest_utc'][11:13])-4}:{D['as_of']['quotes_newest_utc'][14:16]} ET · a study on a branch · nothing deployed, no table written, nothing sent to the Lab</p>
<section><h2>1 · The queue — eight names and their parent fund</h2><div class="q">""")
for i,q in enumerate(QUEUE):
    new=q['status'].startswith('new')
    A(f"""<div class="card"><div class="hd"><span class="no">{i+1}</span><span class="tk">{e(q['ticker'])}</span><span class="tag {'new' if new else ''}">{e(q['status'])}</span><span class="par">parent: {e(q['parent'])} · {e(q['priority'])}</span></div>
<p><span class="k">fundamentals say</span>{e(q['fundamentals'])}</p><p><span class="k">technicals say</span>{e(q['technicals'])}</p><p><span class="k">why review now</span><b>{e(you(q['why']))}</b></p></div>""")
A("</div></section>")
# picture: what (fundamentals rank) against when (own-year percentile)
W_,Hh=1560,560; L_,T_,Rr,B_=70,26,30,54
X=lambda p: L_+(W_-L_-Rr)*p/100; Y=lambda s: T_+(Hh-T_-B_)*(1-s/100)
S=[f'<svg viewBox="0 0 {W_} {Hh}" width="100%" role="img" aria-label="Fundamentals rank against own-year Geiger percentile" style="min-width:1100px;display:block">']
S.append(f'<rect x="{X(0)}" y="{Y(100)}" width="{X(25)-X(0)}" height="{Y(60)-Y(100)}" fill="#1b1b21"/>')
for p in (0,25,50,75,100): S.append(f'<line x1="{X(p)}" y1="{T_}" x2="{X(p)}" y2="{Hh-B_}" stroke="#2a2a30"/><text x="{X(p)}" y="{Hh-B_+18}" fill="#8c8c92" font-size="12" text-anchor="middle">{p}</text>')
for s_ in (0,20,40,60,80,100): S.append(f'<line x1="{L_}" y1="{Y(s_)}" x2="{W_-Rr}" y2="{Y(s_)}" stroke="#1f1f25"/><text x="{L_-10}" y="{Y(s_)+4}" fill="#8c8c92" font-size="12" text-anchor="end">{s_}</text>')
S.append(f'<text x="{X(50)}" y="{Hh-10}" fill="#b4b4b8" font-size="12" text-anchor="middle">WHEN → today\'s Geiger as a percentile of the name\'s own last year (0 = coldest it has been, 100 = hottest)</text>')
S.append(f'<text x="16" y="{Y(50)}" fill="#b4b4b8" font-size="12" text-anchor="middle" transform="rotate(-90 16 {Y(50)})">WHAT → fundamentals rank (growth 65%, comps 35%)</text>')
S.append(f'<text x="{X(0)+8}" y="{Y(100)+16}" fill="#b4b4b8" font-size="12">STRONG AND COLD FOR ITSELF</text>')
qset={q['ticker'] for q in QUEUE}; named=set(ORDER)|qset|{'NVDA'}
pts=[r for r in R if r['score'] is not None and r['geiger_pctl'] is not None]
for r in pts:
    if r['ticker'] in named: continue
    S.append(f'<circle cx="{X(r["geiger_pctl"]):.1f}" cy="{Y(r["score"]):.1f}" r="2.5" fill="#55555c"/>')
placed=[]
for r in sorted([r for r in pts if r['ticker'] in named],key=lambda r:(r['ticker'] not in qset,-r['score'])):
    x,y=X(r['geiger_pctl']),Y(r['score']); c=UP if (r['geiger'] or 0)>=0 else DN; inq=r['ticker'] in qset
    ly=y+4
    for _ in range(12):
        if any(abs(ly-py)<13 and abs(x-px)<58 for px,py in placed): ly+=13
        else: break
    placed.append((x,ly))
    S.append(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{6 if inq else 4}" fill="{c}"/>'+(f'<circle cx="{x:.1f}" cy="{y:.1f}" r="10" fill="none" stroke="#d2d2d2"/>' if inq else '')+f'<text x="{x+ (13 if inq else 8):.1f}" y="{ly:.1f}" fill="{"#d2d2d2" if inq else "#b4b4b8"}" font-size="{13 if inq else 12}" font-weight="{600 if inq else 400}">{r["ticker"]}</text>')
S.append('</svg>')
A('<section><h2>2 · What against when — every name, the ones you raised labelled</h2><div class="tw">'+''.join(S)+'</div></section>')
# names Alan raised
A('<section><h2>3 · The names you raised — one line each</h2><div class="tw"><table><tr><th>name</th><th class="l">fundamentals say</th><th class="l">technicals say</th><th class="l">read</th></tr>')
for t in ORDER:
    r=BY[t]; v=VERD[t]; inq=t in qset
    A(f'<tr class="{"inq" if inq else ""}"><td><b>{t}</b><br><span style="color:#8c8c92;font-size:11px">#{r["rank"]} of 192</span></td><td class="w">{e(fund_words(r))}</td><td class="w">{e(tech_words(r))}{"<br>"+e(line_words(r)) if r["lines"] else ""}</td><td class="w"><b>{e(v)}</b></td></tr>')
A('</table></div></section>')
# MU 21-day
A(f'<section><h2>4 · Micron and its 21-day average</h2><div class="tw"><table><tr><th>21-day at the 5 Oct close</th><th>five sessions earlier</th><th>price now</th><th>closes above it in a row</th><th>share of the last year closed above it</th><th>tests in the last year</th><th>held</th><th>lost</th></tr>')
A(f'<tr><td>{money(mu["avg_last_close"])}</td><td>{money(mu["avg_5_sessions_ago"])}</td><td>{money(mu["price_now"])} ({n((mu["price_now"]/mu["avg_last_close"]-1)*100,1,suf="%")})</td><td>{mu["closes_above_in_a_row"]}</td><td>{mu["share_closes_above_12m_pct"]}%</td><td>{len(mu["tests"])}</td><td>{mu["held"]}</td><td>{mu["lost"]}</td></tr></table>')
A('<table style="margin-top:10px"><tr><th>test began</th><th>21-day then</th><th>closes below before it cleared</th><th>sessions to clear</th><th>deepest close against the average</th><th class="l">result</th></tr>')
for t in mu['tests']:
    A(f'<tr><td>{t["date"]}</td><td>{money(t["level"])}</td><td>{t["closes_below"]}</td><td>{t["sessions_to_clear"]}</td><td style="color:{UP if t["deepest_close_vs_avg_pct"]>=0 else DN}">{n(t["deepest_close_vs_avg_pct"],1,suf="%")}</td><td class="l" style="color:{UP if t["held"] else DN}">{"held" if t["held"] else "lost"}</td></tr>')
A('</table></div></section>')
# top-down
SPYB=0.6*F['SPY']['rev_g']+0.4*F['SPY']['eps_g']
def blend(v): 
    if v.get('rev_g') is None: return None
    return 0.6*v['rev_g']+0.4*(v['eps_g'] if v.get('eps_g') is not None else -60)
def cverd(v):
    p=v.get('geiger_pctl'); b=blend(v)
    if p is None or b is None: return ''
    if p<=30 and v.get('eps_g') is None: return 'cold for itself · fast revenue, no earnings'
    if p<=30 and b>SPYB: return 'COLD FOR ITSELF WITH GOOD GROWTH'
    if p<=30: return 'cold for itself · slow growth'
    if p>=75 and b<SPYB: return 'HOT BEYOND WHAT GROWTH EXPLAINS'
    if p>=75: return 'hot for itself · growth is there'
    return 'inside its normal'
A('<section><h2>5 · From the top — sectors</h2><div class="tw"><table><tr><th>sector</th><th>fund</th><th>Geiger now</th><th>own-year percentile</th><th>against the market</th><th>next-year P/E</th><th>revenue growth</th><th>earnings growth</th><th>middle member\'s earnings growth</th></tr>')
for s in sorted(D['sectors'],key=lambda s:-(s['pctl_now'] if s['pctl_now'] is not None else s['sg1_pctl'])):
    g=s['geiger_now'] if s['geiger_now'] is not None else s['sg1_geiger']; p=s['pctl_now'] if s['pctl_now'] is not None else s['sg1_pctl']
    A(f'<tr><td>{e(s["name"])}</td><td>{e(s["fund"] or "—")}</td><td{gcol(g)}>{n(g,2)}</td><td>{pct(p)}</td><td>{e((s["rrg"] or "—").lower())}</td><td>{s["fwd_pe"] or "—"}</td><td>{n(s["rev_g"],suf="%")}</td><td>{n(s["eps_g"],suf="%")}</td><td>{n(s["eps_g_median"],suf="%")}</td></tr>')
A('</table></div><h2 style="margin-top:20px">Cohorts</h2><div class="tw"><table><tr><th>cohort</th><th>Geiger now</th><th>own-year percentile</th><th>its usual level</th><th>next-year P/E</th><th>revenue growth</th><th>earnings growth</th><th class="l">read</th></tr>')
for k,v in sorted([(k,v) for k,v in CO.items() if v.get('geiger_pctl') is not None],key=lambda kv:kv[1]['geiger_pctl']):
    vd=cverd(v); A(f'<tr><td>{e(v["label"])} <span style="color:#8c8c92">· {v["geiger_n"]}</span></td><td{gcol(v["geiger"])}>{n(v["geiger"],2)}</td><td>{v["geiger_pctl"]}</td><td>{n(v["geiger_median"],2)}</td><td>{v["fwd_pe"] or "—"}</td><td>{n(v["rev_g"],suf="%")}</td><td>{n(v["eps_g"],suf="%")}</td><td class="l">{"<b>"+e(vd)+"</b>" if vd.isupper() else e(vd)}</td></tr>')
A('</table></div></section>')
# parents
A('<section><h2>6 · Parent fundamentals — the funds</h2><div class="tw"><table><tr><th>fund</th><th>names · share covered</th><th>next-year P/E</th><th>trailing P/E</th><th>revenue growth</th><th>earnings growth</th><th>middle: revenue</th><th>middle: earnings</th><th>Geiger now</th><th>own-year pctile</th><th>from high</th></tr>')
for k in ['SPY','QQQ','XLV','XLU','XLK','SMH','SOXX','DRAM','IGV','AGIX','SKYY','IHI','XLC','XLY','XLP','XLI','XLF','XLE','XLB','XLRE','ITA']:
    v=F[k]
    if v.get('missing'): continue
    A(f'<tr class="{"inq" if k in ("XLV","XLU") else ""}"><td><b>{k}</b></td><td>{v["n"]} · {v["weight_pct"]}%</td><td>{v["fwd_pe"] or "—"}</td><td>{v["pe_ttm"] or "—"}</td><td>{n(v["rev_g"],suf="%")}</td><td>{n(v["eps_g"],suf="%")}</td><td>{n(v["rev_g_median"],suf="%")}</td><td>{n(v["eps_g_median"],suf="%")}</td><td{gcol(v.get("geiger"))}>{n(v.get("geiger"),2)}</td><td>{pct(v.get("geiger_pctl"))}</td><td>{n(v.get("from_high_pct"),suf="%")}</td></tr>')
A('</table></div>')
A(f'<h2 style="margin-top:20px">Is XLV cheap?</h2><div class="tw"><table><tr><th>measure</th><th>XLV · health care</th><th>XLU · utilities</th><th>market (SPY)</th></tr>')
A(f'<tr><td>next-year P/E today</td><td>{fx["fwd_pe"]}</td><td>{fu["fwd_pe"]}</td><td>{F["SPY"]["fwd_pe"]}</td></tr>')
A(f'<tr><td>revenue growth, next twelve months</td><td>{n(fx["rev_g"],suf="%")}</td><td>{n(fu["rev_g"],suf="%")}</td><td>{n(F["SPY"]["rev_g"],suf="%")}</td></tr>')
A(f'<tr><td>earnings growth, by weight · middle member</td><td>{n(fx["eps_g"],suf="%")} · {n(fx["eps_g_median"],suf="%")}</td><td>{n(fu["eps_g"],suf="%")} · {n(fu["eps_g_median"],suf="%")}</td><td>{n(F["SPY"]["eps_g"],suf="%")} · {n(F["SPY"]["eps_g_median"],suf="%")}</td></tr>')
hc=spe['Healthcare']; ut=spe['Utilities']
A(f'<tr><td>sector trailing P/E on {hc["last_date"]} · percentile of its last year · of ten years</td><td>{hc["last_pe"]} · {hc["pctl_1y"]} · {hc["pctl_10y"]}</td><td>{ut["last_pe"]} · {ut["pctl_1y"]} · {ut["pctl_10y"]}</td><td>—</td></tr>')
A(f'<tr><td>price against the S&P · percentile of seven years · change over three years</td><td>{rp["XLV"]["pctl_all"]} · {n(rp["XLV"]["chg_3y_pct"],suf="%")}</td><td>{rp["XLU"]["pctl_all"]} · {n(rp["XLU"]["chg_3y_pct"],suf="%")}</td><td>—</td></tr>')
A('</table></div><h2 style="margin-top:20px">Proposed cohorts — all</h2><div class="tw tall"><table><tr><th>cohort</th><th>members</th><th>next-year P/E</th><th>trailing P/E</th><th>revenue growth</th><th>earnings growth</th><th>middle member: earnings</th></tr>')
for k,v in sorted(CO.items(),key=lambda kv:-(kv[1]['rev_g'] if kv[1]['rev_g'] is not None else -999)):
    A(f'<tr><td>{e(v["label"])}</td><td>{v["n"]}</td><td>{v["fwd_pe"] or "—"}</td><td>{v["pe_ttm"] or "—"}</td><td>{n(v["rev_g"],suf="%")}</td><td>{n(v["eps_g"],suf="%") if (v.get("eps_cov") or 0)>=50 else "mostly no earnings"}</td><td>{n(v["eps_g_median"],suf="%") if (v.get("eps_cov") or 0)>=50 else "—"}</td></tr>')
A('</table></div></section>')
# bottom-up full table
A('<section><h2>7 · From the bottom — all 192 names, ranked on fundamentals</h2><div class="tw tall"><table><tr><th>#</th><th class="l">name</th><th class="l">cohort</th><th>revenue growth</th><th>earnings growth</th><th>next-year P/E</th><th>price</th><th>comps centre</th><th>comps upside</th><th class="l">comps confidence · left out</th><th>Geiger</th><th>own-year pctile</th><th>from high</th><th>vs 21-day</th><th class="l">reviewed lines · nearest below · above</th></tr>')
for r in R:
    lo=', '.join(r['comps_outliers']) if r['comps_outliers'] else ''
    ln='none' if not r['lines'] else f"{r['lines']} · "+(f"{r['below']['id']} {money(r['below']['level'])}" if r['below'] else '—')+' · '+(f"{r['above']['id']} {money(r['above']['level'])}" if r['above'] else '—')
    A(f'<tr class="{"inq" if r["ticker"] in qset else ""}"><td>{r["rank"]}</td><td class="l"><b>{r["ticker"]}</b></td><td class="l">{e((r["cohorts"] or ["—"])[0].lower())}</td><td>{n(r["rev_g"],suf="%")}</td><td>{n(r["eps_g"],suf="%") if r["eps_g"] is not None else "no earnings"}</td><td>{("%.0f"%r["fwd_pe"]) if r["fwd_pe"] else "—"}</td><td>{money(r["price"])}</td><td>{money(r["comps_centre"])}</td><td{gcol(r["comps_upside"])}>{n(r["comps_upside"],suf="%")}</td><td class="l">{e(r["comps_conf"])}{" · out: "+e(lo) if lo else ""}</td><td{gcol(r["geiger"])}>{n(r["geiger"],2)}</td><td>{pct(r["geiger_pctl"])}</td><td>{n(r.get("from_high_pct"),suf="%")}</td><td>{n(r.get("vs_sma21_pct"),suf="%")}</td><td class="l">{e(ln)}</td></tr>')
A('</table></div></section>')
nrev=', '.join(t for t in D['reviewed_tickers'] if t in BY)
A(f"""<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> Which names should go through the Market Desk → Workshop → Clean review next, argued from both ends: from the bottom (each company's growth and its comps price) and from the top (which sectors and cohorts are cold or hot against their own normal). Fundamentals decide the rank; technicals are shown beside them and never enter the rank.</p>
<p><b>Does the comps upside take the Geiger into account?</b> No. The comps price is fundamentals only: the company's own figures multiplied by its peers' middle multiples (six rows; the centre of the band is the figure shown). The Geiger sits in its own columns.</p>
<ul>
<li><b>Scope.</b> 192 companies: every member of the proposed AI, power/utilities and health-care cohorts (CO1's tree), plus the twelve you raised from outside them (NFLX, IBM, NKE, MCD, WMT, ASTS, ACHR, SPIR, KTOS, GOOGL, AMZN, META).</li>
<li><b>Growth.</b> Next-twelve-month revenue and earnings against the twelve months before, blended from the analyst estimates table (FMP) and the last reported fiscal year. Read directly from the table, because PA6 found the comps feed's growth field unstable. A company with no positive earnings shows "no earnings" and takes the lowest earnings mark.</li>
<li><b>Fundamentals rank.</b> 65% growth (revenue 60, earnings 40, extremes capped at −60% and +150%) and 35% comps upside, each as a position among the 192. Where the peer set is mostly a different business or fewer than three of six rows price, the comps part is pulled halfway to neutral; with no comps price it scores zero.</li>
<li><b>Comps.</b> The Hub's own comps code (C5 business-line peer set, C6b price-only outliers left out, band centre), run headless per name at about 14:50 ET and re-priced at the newest quote. "Left out" lists the peers the outlier rule removed.</li>
<li><b>Next-year P/E.</b> Price ÷ next-twelve-month estimated earnings. Not shown for the 16 companies that report in another currency (TSM, ASML and others) and left out of the fund and cohort P/E for the same reason; their growth percentages still count.</li>
<li><b>Geiger and own-year percentile.</b> The Geiger is the live seven-rung number from the chart API. The percentile places it among that name's own last 251 evening readings, rebuilt with the publisher's maths on chart-API bars (the sector study's method; the rebuilt 5 Oct reading for XLK is +0.917 against +0.917 stored). SanDisk has only 177 sessions; Cerebras too few for any.</li>
<li><b>Reviewed lines.</b> Read only from LB1's extract of the Lab's V24 packs. Lines exist for: {e(nrev)}, and for the indices and macro series. Nearest lines are re-measured against the newest price. Nothing was written into the Lab folder and TradingView was not used.</li>
<li><b>Fund roll-ups.</b> FMP holdings weights over the names the Hub serves (the share covered is shown), cap-weighted; P/E is total price over total earnings. Cohort roll-ups weight by market value.</li>
<li><b>Sector trailing P/E history.</b> FMP's daily sector P/E table; its newest row is {hc['last_date']}, so it is six weeks old. No forward-P/E history is stored for the funds, so "cheap against its own history" can only be answered on trailing P/E and on price against the S&P.</li>
<li><b>Micron's 21-day.</b> The simple 21-session average of daily closes. A test starts when the day's low reaches the average after five straight closes above it; it "held" if no more than one close fell below before price cleared it again.</li>
</ul>
<p><b>What could be wrong.</b> Analyst estimates carry the whole growth score and can be stale or thin for small names. Earnings growth from a tiny or one-off base (GILD +494%, AAOI, MRK) overstates; the cap at +150% limits but does not remove it. The comps centre for MU, SNDK, NVDA and others rests on peers that are mostly a different business, so it is a direction, not a target. DRAM's roll-up covers 13% of the fund (its Korean and Japanese holdings are not served). The fund trailing P/E here and FMP's sector P/E are different calculations and do not match. The dot colour in the picture is the sign of today's Geiger.</p>
<p><b>Not done.</b> No Geiger history for cohorts outside the scope. No test of whether "cold for itself with good growth" has paid in the past. The queue file is a proposal; nothing was sent to the Lab.</p>
</details>
</main></body></html>""")
open(os.path.join(OUT,'WORKSHOP-QUEUE.html'),'w').write(''.join(H))
print('page bytes',sum(len(x) for x in H),'queue items',len(items))
for q in QUEUE: print('-',q['ticker'],'|',q['status'],'|',q['parent']); print('   F:',q['fundamentals']); print('   T:',q['technicals'])
