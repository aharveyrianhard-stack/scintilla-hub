#!/usr/bin/env python3
"""X1 · the numbers behind the proposal and the mock pages, from today's real data. Reads only; writes data/mock-data.js
and data/ladder-20261002.json. Sources: tree.json (29 Sep structure), the scout Geiger (seven rungs, 1 Oct close),
the Hub Geiger (live, 2 Oct 13:43Z), the chart API's daily closes (320 bars), the live board state (Alan's lists)."""
import json, math, statistics, time
from collections import defaultdict
D='data/'
tree=json.load(open('../../20260929/tree-map/tree.json'))
sc=json.load(open(D+'scout-geiger-seven-20261001.json')); ix={k:i for i,k in enumerate(sc['row_columns'])}
scout={r[ix['ticker']]:(r[ix['composite']],r[ix['trend']],r[ix['momentum']]) for r in sc['rows']}
hub=json.load(open(D+'hub-geiger-20261002T1343Z.json')); hubg={t:v.get('composite') for t,v in hub['symbols'].items()}
cl=json.load(open(D+'closes-1d-20261002.json'))['closes']
st=json.load(open('shots/state-1680.json'))
# the board's % change is the row's `c` (the strip prints fmtC(d.c)); the first dump read `chg`, which only BTC carries. Merge the re-read.
import os
if os.path.exists('shots/state-chg.json'):
    _c=json.load(open('shots/state-chg.json'))['chg']
    for _r in st['rows']:
        if _r.get('chg') is None and _c.get(_r['t']) is not None: _r['chg']=_c[_r['t']]
nodes={n['id']:n for n in tree['nodes']}
kids=defaultdict(list)
for n in tree['nodes']:
    for p in n['parents']: kids[p].append(n['id'])
# ---- Geiger of a node: own reading for a ticker; the tree's aggregate otherwise
def own(nid):
    t=nodes[nid].get('ticker'); return scout[t][0] if t in scout else None
def agg(nid):
    n=nodes[nid]
    if n['kind']=='fund' and n.get('holdings') and n['holdings'].get('served_weights'):
        sw=swg=0; c=0
        for tk,w in n['holdings']['served_weights']:
            if tk in scout and w>0: sw+=w; swg+=w*scout[tk][0]; c+=1
        return (swg/sw if sw else None, c)
    if n['kind']=='cohort':
        v=[scout[m][0] for m in n.get('members',[]) if m in scout]; return (sum(v)/len(v) if v else None,len(v))
    if n['kind']=='index':
        v=[]
        for k in kids[nid]:
            g=own(k)
            if g is None: g=agg(k)[0]
            if g is not None: v.append(g)
        return (sum(v)/len(v) if v else None,len(v))
    return (None,0)
def gval(nid):
    g=own(nid); return g if g is not None else agg(nid)[0]
# ---- the Hub's RRG maths, ported verbatim (l0RrgSeries): 4-bar EMA of RS, 14-bar z, momentum = 4-bar change, 2-bar EMA
def ema(a,n):
    k=2/(n+1); e=a[0]; o=[e]
    for x in a[1:]: e=x*k+e*(1-k); o.append(e)
    return o
def rrg(sym,bench,N=14):
    if sym not in cl or bench not in cl: return None
    b={t:c for t,c in cl[bench]}; s={t:c for t,c in cl[sym]}
    ts=sorted(set(b)&set(s))
    if len(ts)<40: return None
    rs=ema([100*s[t]/b[t] for t in ts],4)
    def sma(a,i): lo=max(0,i-N+1); return sum(a[lo:i+1])/(i-lo+1)
    def sdv(a,i,m): lo=max(0,i-N+1); return math.sqrt(sum((x-m)**2 for x in a[lo:i+1])/(i-lo+1)) or 1e-9
    ratio=[100+(rs[i]-sma(rs,i))/sdv(rs,i,sma(rs,i)) for i in range(len(rs))]
    chg=[ratio[i]-ratio[i-4] if i>=4 else 0 for i in range(len(ratio))]
    mom=[100+(chg[i]-sma(chg,i))/sdv(chg,i,sma(chg,i)) for i in range(len(chg))]
    R=ema(ratio,2); M=ema(mom,2)
    tail=[[round(R[i],3),round(M[i],3)] for i in range(len(R)-8,len(R))]
    q=('LEADING' if R[-1]>=100 and M[-1]>=100 else 'WEAKENING' if R[-1]>=100 else 'LAGGING' if M[-1]<100 else 'IMPROVING')
    return {'ratio':round(R[-1],3),'mom':round(M[-1],3),'tail':tail,'quadrant':q}
def rel(sym,bench,bars):
    if sym not in cl or bench not in cl: return None
    b={t:c for t,c in cl[bench]}; s={t:c for t,c in cl[sym]}; ts=sorted(set(b)&set(s))
    if len(ts)<=bars: return None
    a,z=ts[-1-bars],ts[-1]
    return round(100*((s[z]/s[a])-(b[z]/b[a])),2)   # % change over the window minus the benchmark's
def chg1(sym):
    if sym not in cl or len(cl[sym])<2: return None
    return round(100*(cl[sym][-1][1]/cl[sym][-2][1]-1),2)
def mc(nid): return nodes[nid].get('market_value_usd')
# ---- benchmarks per level
BENCH={'MARKET':'VT','US':'SPY','WORLD':'VT','US_SECTORS':'SPY','US_BROAD':'SPY','US_STYLE':'SPY','SEC_TECH':'XLK','SEC_FIN':'XLF','SMH':'SMH','XLF':'XLF','COHORT_AI_ACCELERATORS':'SMH','PROPOSED_MONEY_CENTER_BANKS':'XLF','KBE':'KBE','IGV':'IGV'}
for s in ['SEC_ENGY','SEC_HLTH','SEC_INDU','SEC_STPL','SEC_DISC','SEC_UTIL','SEC_MATL','SEC_REIT','SEC_COMM']: BENCH[s]='SPY'
# representative tradable lines for headings (so L0 / L1 rotation has a series to run on)
REP={'US':'SPY','WORLD':'VT','INTL_DEV':'EFA','EM':'EEM','BONDS':'TLT','CMDTY':'DBC','CRYPTO':'IBIT','MACRO':'UUP','US_BROAD':'SPY','US_STYLE':'RSP','US_SECTORS':'RSP',
     'SEC_TECH':'XLK','SEC_FIN':'XLF','SEC_HLTH':'XLV','SEC_ENGY':'XLE','SEC_INDU':'XLI','SEC_STPL':'XLP','SEC_DISC':'XLY','SEC_UTIL':'XLU','SEC_MATL':'XLB','SEC_REIT':'XLRE','SEC_COMM':'XLC'}
def node_row(nid,bench):
    n=nodes[nid]; t=n.get('ticker') or REP.get(nid); a,c=agg(nid)
    r={'id':nid,'label':n.get('label') or t,'ticker':n.get('ticker'),'rep':REP.get(nid),'kind':n['kind'],'ckind':n.get('ckind'),'served':n.get('served'),
       'g_close':own(nid),'agg_close':a,'agg_n':c,'g_live':hubg.get(n.get('ticker')) if n.get('ticker') else None,'mcap':mc(nid),'children':len(kids[nid]),
       'chg1d':chg1(t) if t else None,'rel21':rel(t,bench,21) if t and t!=bench else None,'rel63':rel(t,bench,63) if t and t!=bench else None,
       'rrg':rrg(t,bench) if t and t!=bench else None,'members':len(n.get('members',[])) if n['kind']=='cohort' else None}
    r['g']=r['g_close'] if r['g_close'] is not None else r['agg_close']
    return r
def bowtie(nid,only=None,limit=None):
    rows=[node_row(k,BENCH.get(nid,'SPY')) for k in kids[nid] if only is None or nodes[k]['kind'] in only]
    rows=[r for r in rows if r['g'] is not None]+[r for r in rows if r['g'] is None]
    rows.sort(key=lambda r:(r['g'] is None, -(r['g'] or 0)))
    return rows[:limit] if limit else rows
def names_of(cid,bench):
    out=[]
    for m in nodes[cid].get('members',[]):
        if m not in scout: continue
        out.append({'t':m,'label':nodes[m]['label'] if m in nodes else m,'g_close':scout[m][0],'tr':scout[m][1],'mo':scout[m][2],'g_live':hubg.get(m),'mcap':mc(m) if m in nodes else None,
                    'chg1d':chg1(m),'rel21':rel(m,bench,21),'rel63':rel(m,bench,63),'rrg':rrg(m,bench)})
    out.sort(key=lambda r:-r['g_close']); return out
# ---- the ladder, one worked example per level
L={}
L['L0']={'node':'MARKET','question':'Which asset class is on, this week?','bench':'VT','children':bowtie('MARKET')}
L['L1']={'node':'US','question':'Inside US stocks: broad, style or sectors — and the world beside it','bench':'SPY','children':bowtie('US')+[node_row(x,'SPY') for x in ['INTL_DEV','EM']]}
L['L1_funds']={'node':'US_BROAD','bench':'SPY','children':bowtie('US_BROAD',only=('fund',))}
L['L2']={'node':'US_SECTORS','question':'Which sector leads?','bench':'SPY','children':bowtie('US_SECTORS')}
L['L2_spdr']=[node_row(x,'SPY') for x in ['XLK','XLC','XLY','XLF','XLI','XLB','XLE','XLV','XLP','XLU','XLRE'] if x in nodes]
L['L2_spdr'].sort(key=lambda r:-(r['g'] or 0))
L['L3']={'node':'SEC_TECH','question':'Inside Technology: which industry fund leads?','bench':'XLK','children':bowtie('SEC_TECH',only=('fund',))}
L['L3_fin']={'node':'SEC_FIN','bench':'XLF','children':bowtie('SEC_FIN',only=('fund',))}
L['L4']={'node':'SMH','question':'Inside semiconductors: which cohort leads?','bench':'SMH','children':bowtie('SMH',only=('cohort',))}
L['L4_tech_all']=sorted([node_row(k,'XLK') for f in ['SEC_TECH']+[x for x in kids['SEC_TECH'] if nodes[x]['kind']=='fund'] for k in kids[f] if nodes[k]['kind']=='cohort' and not nodes[k].get('pseudo')],key=lambda r:-(r['g'] or -9))
L['L5']={'node':'COHORT_AI_ACCELERATORS','question':'Inside AI ACCELERATORS: which name leads, and who is gaining?','bench':'SMH','names':names_of('COHORT_AI_ACCELERATORS','SMH')}
L['L5_banks']={'node':'PROPOSED_MONEY_CENTER_BANKS','bench':'XLF','names':names_of('PROPOSED_MONEY_CENTER_BANKS','XLF')}
# ---- Alan's lists against their own industries
lists=st['lists']; liked=st['liked']
def place(t):
    n=nodes.get(t)
    if not n: return None
    home=n.get('home_id'); sec=n.get('sector')
    hg=agg(home)[0] if home in nodes else None
    sg=gval(sec) if sec in nodes else None
    return {'t':t,'home':home,'home_label':nodes[home]['label'] if home in nodes else None,'home_kind':n.get('home_kind'),'sector':sec,'sector_label':n.get('sector_label'),
            'g_close':scout.get(t,(None,))[0],'g_live':hubg.get(t),'home_g':hg,'sector_g':sg,'mcap':mc(t)}
def list_report(name,ts):
    rows=[p for p in (place(t) for t in ts) if p]
    withg=[r for r in rows if r['g_close'] is not None and r['home_g'] is not None]
    above=[r for r in withg if r['g_close']>r['home_g']]
    return {'list':name,'n':len(ts),'placed':len(rows),'compared':len(withg),
            'mean_g_close':statistics.mean([r['g_close'] for r in rows if r['g_close'] is not None]) if rows else None,
            'mean_home_g':statistics.mean([r['home_g'] for r in withg]) if withg else None,
            'above_home':len(above),'rows':rows,
            'by_home':sorted([{'home':h,'label':nodes[h]['label'],'n':len(g),'list_mean':statistics.mean([r['g_close'] for r in g]),'home_g':agg(h)[0]} for h,g in
                 {h:[r for r in withg if r['home']==h] for h in set(r['home'] for r in withg)}.items()],key=lambda x:-x['n'])}
LISTS={'RADAR':list_report('RADAR',lists['radar']),'FAVORITES':list_report('FAVORITES',lists['favorites']),'LIKED':list_report('LIKED',liked)}
# ---- hub vs scout on the 590
both=[(t,hubg[t],scout[t][0]) for t in hubg if t in scout and hubg[t] is not None]
gaps=sorted(abs(h-s) for _,h,s in both)
AGREE={'n':len(both),'median_gap':round(statistics.median(gaps),3),'p90_gap':round(gaps[int(len(gaps)*.9)],3),'sign_agree':sum(1 for _,h,s in both if (h>=0)==(s>=0)),
       'max_gap':[(t,round(h,2),round(s,2)) for t,h,s in sorted(both,key=lambda x:-abs(x[1]-x[2]))[:6]],
       'note':'hub = live seven-rung reading 2 Oct 13:43Z (pre-market); scout = seven-rung reading at the 1 Oct close'}
# the 17 board cohort tabs → tags
COH_TABS=[k for _,k in st['cohorts']]
TAGS={k:{'tab':lab,'members_on_board':len(st['cohsets'].get(k,[])),'tree_node':next((n['id'] for n in tree['nodes'] if n['kind']=='cohort' and n.get('cohort')==k),None)} for lab,k in st['cohorts']}
out={'as_of_close':sc['as_of'],'scout_run':sc['run_id'],'hub_computed':hub['computed_utc'],'closes_newest':time.strftime('%Y-%m-%d',time.gmtime(max(v[-1][0] for v in cl.values())/1000)),
     'ladder':L,'lists':LISTS,'agree':AGREE,'tags':TAGS,'tree_counts':tree['counts'],
     'path_default':['MARKET','US','US_SECTORS','SEC_TECH','SMH','COHORT_AI_ACCELERATORS'],
     'path_labels':{k:nodes[k]['label'] for k in ['MARKET','US','US_SECTORS','SEC_TECH','SMH','COHORT_AI_ACCELERATORS','SEC_FIN','XLF','PROPOSED_MONEY_CENTER_BANKS','WORLD','BONDS','CMDTY','CRYPTO','MACRO']},
     'board_rows':[{'t':r['t'],'name':r['name'],'g':r['g'],'chg':r['chg'],'price':r['price'],'rv':r['rv']} for r in st['rows']],
     'board_lists':{'radar':lists['radar'],'favorites':lists['favorites'],'liked':liked}}
json.dump(out,open(D+'ladder-20261002.json','w'),indent=1)
open(D+'mock-data.js','w').write('window.MOCK='+json.dumps(out)+';\n')
# ---- a few lines for the writer
p=lambda r:f"{(r.get('ticker') or r.get('t') or r['id'])} {r['g'] if 'g' in r else r['g_close']:+.2f}"
print('L0',[f"{r['label']} {r['g']:+.2f}" if r['g'] is not None else r['label']+' —' for r in L['L0']['children']])
print('L2',[f"{r['label'][:12]} {r['g']:+.2f}" for r in L['L2']['children']])
print('L2 spdr',[f"{r['ticker']} {r['g']:+.2f} {r['rrg']['quadrant'] if r['rrg'] else ''} rel63 {r['rel63']}" for r in L['L2_spdr']])
print('L3',[f"{r['ticker']} {r['g']:+.2f} {r['rrg']['quadrant'] if r['rrg'] else ''} rel21 {r['rel21']}" for r in L['L3']['children']])
print('L4',[f"{r['label']} {r['g']:+.2f} n{r['agg_n']}" for r in L['L4']['children']])
print('L5',[f"{r['t']} {r['g_close']:+.2f} {r['rrg']['quadrant'] if r['rrg'] else ''} rel21 {r['rel21']}" for r in L['L5']['names']][:10])
for k,v in LISTS.items(): print(k,{kk:(round(vv,3) if isinstance(vv,float) else vv) for kk,vv in v.items() if kk not in('rows','by_home')}, [(b['label'],b['n'],round(b['list_mean'],2),round(b['home_g'],2) if b['home_g'] is not None else None) for b in v['by_home'][:6]])
print('AGREE',AGREE)
print('tags',{k:(v['members_on_board'],v['tree_node']) for k,v in TAGS.items()})

# ---- extras for the mock pages: 130-bar close tails for the lines they draw, the board's cohort tags per name
TAIL_SYMS=['SPY','VT','RSP','QQQ','XLK','XLC','XLY','XLF','XLI','XLB','XLE','XLV','XLP','XLU','XLRE','SMH','SOXX','IGV','CIBR','SKYY','XSD','DRAM','QTUM','AGIX','IGM','RSPT','VGT','IYW',
 'KBE','KRE','KIE','IAI','IYG','IPAY','EFA','EEM','TLT','DBC','IBIT','UUP','GLD','MRVL','TSM','NVDA','AMD','AVGO','INTC','MU','NBIS','GOOGL','AMZN','IREN','BE','VST']
out['closes_tail']={s_:[[t,c] for t,c in cl[s_][-130:]] for s_ in TAIL_SYMS if s_ in cl}
cohsets=st['cohsets']; board_tabs=[k for _,k in st['cohorts']]
tags_of=lambda t:[lab for lab,k in st['cohorts'] if t in cohsets.get(k,[])]
for r in out['board_rows']: r['tags']=tags_of(r['t'])
for key in ('L5','L5_banks'):
    for r in out['ladder'][key]['names']: r['tags']=tags_of(r['t'])
for r in out['ladder']['L2_spdr']: r['g_live']=hubg.get(r['ticker'])
out['hub_has_funds']=sum(1 for x in ['XLK','XLF','SMH','SPY','RSP'] if hubg.get(x) is not None)
json.dump(out,open(D+'ladder-20261002.json','w'),indent=1)
open(D+'mock-data.js','w').write('window.MOCK='+json.dumps(out)+';\n')
print('tails',len(out['closes_tail']),'hub funds',out['hub_has_funds'], 'XLK live',hubg.get('XLK'),'SMH live',hubg.get('SMH'))
