#!/usr/bin/env python3
"""X1 · writes COMPARE-PROPOSAL.html from the measured facts (shots/facts-*.json), the data (data/ladder-20261002.json)
and the verdicts written below. Plain words, pictures first. Nothing here touches index.html."""
import json, html, os
D=json.load(open('data/ladder-20261002.json')); F=json.load(open('shots/facts-1680.json')); F390=json.load(open('shots/facts-390.json'))
MF=json.load(open('shots/mock-facts.json')) if os.path.exists('shots/mock-facts.json') else []
e=html.escape
fg=lambda g:'—' if g is None else ('%+.2f'%g)
fp=lambda p:'—' if p is None else ('%+.2f%%'%p)
shot={s['file'].split('-',2)[2].rsplit('.',1)[0]:s for s in F['shots'] if '-' in s['file']}
def pic(name,cap,w=None):
    s=next((x for x in F['shots'] if x['file'].endswith(name+'.png')),None); f=s['file'] if s else name+'.png'
    return f'<figure><a href="shots/{f}"><img loading="lazy" src="shots/{f}" alt="{e(cap)}"></a><figcaption>{e(cap)}</figcaption></figure>'
def mpic(f,cap): return f'<figure><a href="shots/{f}"><img loading="lazy" src="shots/{f}" alt="{e(cap)}"></a><figcaption>{e(cap)}</figcaption></figure>'
cls=lambda g:'up' if (g or 0)>=0 else 'dn'
L=D['ladder']; A=D['agree']; LS=D['lists']
# ---------------- 1 · the inventory, with verdicts
INV=[
 # control, what it shows, what it reads, overlaps, verdict, reason, shot
 ('Right pane · tab COHORT COMPARE','One column per cohort or sector, bars green → red by mean Geiger, with the read and trend / momentum under each','GCOMP (the Hub Geiger) over COHSETS membership; SECTORS mode reads the fund’s own Geiger','The tree’s bow tie at every node; the board’s COHORT GEIGER mean','KEEP → becomes ORDER','It is the one view that answers "which leads" directly. It only needs a path instead of two mode rows.','cohort-compare-COHORTS'),
 ('COHORT COMPARE · COHORTS | SECTORS','Switches the columns between Alan’s 12 cohorts and the eleven sectors','window.SC_CMP_MODE (the rewind module)','The board’s scope tabs choose cohorts too; the tree’s L2 is the sectors','MERGE INTO the path picker','Cohorts and sectors are two nodes of one tree (L4 and L2). One crumb row replaces the toggle.','cohort-compare-SECTORS-SPDR'),
 ('SECTORS · SPDR · iSHARES · VANGUARD · EQUAL-WT','The same eleven sectors read through a different issuer’s fund','the funds’ own Geigers (/geiger)','Each family is an L3 sibling on the tree (XLK · IYW · VGT · RSPT under Technology)','MERGE INTO ORDER at L3 (one dropdown)','Four rows of near-identical bars; the differences between families belong one level down, where the tree already lists them side by side.','cohort-compare-SECTORS-ISHARES'),
 ('SECTORS · INDEXES','Eleven broad index funds side by side (SPY · QQQ · DIA · IWM · RSP …)','the funds’ own Geigers','The tree’s L1 "US broad market" node','MERGE INTO ORDER at L1','Same picture, found by walking up one level instead of a chip hidden under SECTORS.','cohort-compare-SECTORS-INDEXES'),
 ('SECTORS · BOW TIE','Equal-weight fund minus its cap-weight twin, per sector: breadth','the funds’ own Geigers, paired','Nothing else shows breadth','KEEP (as a lens on any node with twins)','The one reading that is not a child-of-node ordering; it stays as its own switch.','cohort-compare-SECTORS-BOWTIE'),
 ('SECTORS · OUR NAMES','The names on Alan’s board in each sector, averaged (not the fund)','GCOMP over ticker_membership sectors','MY LISTS vs their home industries (the standard’s question)','MERGE INTO "my list vs home"','The question it answers is "are my names stronger than their sector?" The placement record answers it per name and per list, which this average blurs.','cohort-compare-SECTORS-MEMBERS'),
 ('Right pane · tab MAP','The scope’s names as squares in market-cap order, coloured by a timeframe’s % change','live board rows + a batched ohlcv read per (tf, cohort)','The board’s rows carry the same % change; TREEMAP sizes them','KEEP (GRID + TREEMAP)','A picture of the scope at a glance. Two drawings are enough.','map-GRID-GRAIN'),
 ('MAP · TF 60M · 4H · 1D · 1W','Changes the % change the colour encodes (shared with ROTATION and RELATIVE)','L0_TF → ohlcv_history / chart API','ROTATION and RELATIVE share it already','KEEP (one row, shared)','Already consolidated in R49; nothing to add.','map-GRID-tfD'),
 ('MAP · Mode TREEMAP','Squares sized by market value, quiet names fade','same rows + mcap','GRID','KEEP','Size matters at L2–L3 (a sector is its biggest names); the only mode that says so.','map-TREEMAP'),
 ('MAP · Mode GRID','Uniform squares in cap order','same rows','TREEMAP','KEEP','The honest default; the one Alan sees on open.','map-GRID-GRAIN'),
 ('MAP · Mode FISHEYE','Cursor-driven distortion of the grid','same rows','GRID + cursor','DROP','A cursor effect, not a different reading. Untouchable on a phone ("touch · static grid").','map-FISHEYE'),
 ('MAP · Mode DOCK','Dock-style proximity scaling','same rows','GRID + cursor','DROP','Same as FISHEYE: an effect. Measured: identical header, identical data.','map-DOCK'),
 ('MAP · Mode BUBBLES','Force-packed circles, area = market cap','same rows + mcap','TREEMAP','DROP','TREEMAP says size with no simulation and no settling time.','map-BUBBLES'),
 ('MAP · Mode TILT','3D parallax cards; the card under the cursor lifts','same rows','GRID','DROP (or keep as the one "show" mode)','Pretty, but the same squares. Alan never asked for it by name since R47.','map-TILT'),
 ('MAP · GRID · GRAIN | FILL · OPACITY | LEVEL','Three ways to paint the move into the square','HEAT_MODE','none; three encodings of one number','MERGE INTO one switch (GRAIN / FILL)','LEVEL and FILL·OPACITY both say "how big" with ink; one is enough. GRAIN stays because Alan approved the dots.','map-GRID-LEVEL'),
 ('Right pane · tab ROTATION','RRG of the scope vs SPY: eleven sectors on ALL, the scope’s twelve largest otherwise','ohlcv_history closes per symbol → l0RrgSeries (14-bar)','RELATIVE (same series, other picture); the tree has no rotation today','KEEP (a lens on the path node vs its parent fund)','Rotation is the one question ORDER cannot answer: who is gaining. It should run against the node’s own parent (names vs SMH), not always SPY.','rotation-1D-ALL-sectors'),
 ('ROTATION · ▶ PLAY · ↻ LIVE','Walks the tails back 40 bars and forward again','the same cached series','none','KEEP','Cheap, honest ("as of Sep 11 · −14 bars"), and Alan asked for it (R45).','rotation-1D-playing'),
 ('ROTATION · scope follows the board tab','The names drawn are the board’s active cohort’s twelve largest','l0RotSet()','The path picker makes this explicit','MERGE INTO the path','Today the scope is set two panels away; on a path it is the crumb you are standing on.','rotation-4H-liked'),
 ('Right pane · tab RELATIVE','% change lines rebased to the left edge, scope vs SPY','the same closes','ROTATION (same series)','MERGE INTO ROTATION (1M / 3M numbers under each head; lines on demand)','Two tabs draw one dataset. The number Alan reads off the lines ("XLE +18.9% over 3M") fits beside the RRG head.','relative-1D-3M-ALL-sectors'),
 ('RELATIVE · Window 1M · 3M · 6M','The bar count the lines are rebased over','L0_REL_WIN per tf','none','KEEP (as ROTATION’s window)','A real choice, kept; it moves with the lines.','relative-1D-win2-ALL'),
 ('Board · scope tabs ⊙ RADAR · ★ FAVORITES · ♥ LIKED','Alan’s three lists','station_lists + hub_favorites','none','KEEP (first, default FAVORITES)','They are his. Alan on 2 Oct: default to FAVORITES.','board-scope-FAVORITES'),
 ('Board · scope tab ALL','Every served name (546 rows measured)','tickers','The tree’s L0 node','MERGE INTO the path (the market crumb)','ALL is the root of the tree with a different name.','board-scope-ALL'),
 ('Board · 12 cohort tabs (AI HW · AI SW · MEGACAP · BLUE CHIP · GROWTH · CRYPTO · INTL · MACRO · INDEXES · THEMATIC · METALS · AI POWER)','The board narrowed to one of Alan’s early watch lists','tickers.cohort / ticker_membership → COHSETS','Nine of the twelve are L4 cohorts on the tree; the tags on every row','MERGE INTO tags + a tree path','Alan, 2 Oct: "the cohorts were an early watch list … now we have something way better." Kept as tags (the standard), reachable as tree nodes where one exists.','board-scope-AI_HARDWARE'),
 ('SCENES room','The same four tabs at full width','the same renderers','the dashboard’s right pane','KEEP as the full-screen of the one COMPARE panel','It is already the same code; it inherits whatever the pane becomes.','scenes-room'),
]
inv_rows=''.join(f'<tr><td><b>{e(c)}</b></td><td>{e(w)}</td><td class="src">{e(r)}</td><td>{e(o)}</td><td class="v {("keep" if v.startswith("KEEP") else "drop" if v.startswith("DROP") else "merge")}">{e(v)}</td><td>{e(why)}</td><td><a href="shots/1680-{shot[s]["file"].split("-",1)[1] if s in shot else s+".png"}">1680</a> · <a href="shots/390-{shot[s]["file"].split("-",1)[1] if s in shot else s+".png"}">390</a></td></tr>' for c,w,r,o,v,why,s in INV)
keep=sum(1 for x in INV if x[4].startswith('KEEP')); merge=sum(1 for x in INV if x[4].startswith('MERGE')); drop=sum(1 for x in INV if x[4].startswith('DROP'))
# ---------------- 2 · the ladder
def bt_table(rows,cols):
    h='<table><tr>'+''.join(f'<th{" class=n" if k[2] else ""}>{e(k[1])}</th>' for k in cols)+'</tr>'
    for r in rows:
        h+='<tr>'+''.join(f'<td class="{"n" if k[2] else ""} {cls(r.get("g")) if k[0]=="g" else ""}">{k[3](r)}</td>' for k in cols)+'</tr>'
    return h+'</table>'
G=lambda r:fg(r.get('g'))
lab=lambda r:e(r.get('label') or r.get('t'))
tick=lambda r:e(r.get('ticker') or r.get('rep') or r.get('t') or '')
quad=lambda r:(r['rrg']['quadrant'].lower() if r.get('rrg') else '—')
rel=lambda k:(lambda r:fp(r.get(k)))
n_of=lambda r:(f"{r['agg_n']} lines" if r.get('kind')=='index' else f"{r['agg_n']} holdings" if r.get('kind')=='fund' and r.get('agg_n') else f"{r['agg_n']} names" if r.get('kind')=='cohort' else '')
COLS=[('label','node',False,lab),('t','line',False,tick),('g','Geiger · close',True,G),('n','from',False,n_of),('q','rotation vs parent',False,quad),('r21','1M vs parent',True,rel('rel21')),('r63','3M vs parent',True,rel('rel63'))]
NCOLS=[('t','name',False,lambda r:e(r['t'])),('g','Geiger · close',True,lambda r:fg(r['g_close'])),('live','Hub live',True,lambda r:fg(r.get('g_live'))),('q','rotation vs SMH',False,quad),('r21','1M vs SMH',True,rel('rel21')),('r63','3M vs SMH',True,rel('rel63'))]
l2=L['L2']['children']; l2s=L['L2_spdr']; l3=L['L3']['children']; l4=L['L4']['children']; l5=L['L5']['names']; l0=L['L0']['children']; l1=L['L1']['children']
lead_sec=l2[0]; lead_spdr=l2s[0]; lead_fund=l3[0]; lead_coh=l4[0]; lead_name=l5[0]
best_rot=max([r for r in l5 if r.get('rel21') is not None],key=lambda r:r['rel21'])
fav=LS['FAVORITES']; rad=LS['RADAR']; lik=LS['LIKED']
# ---------------- 3 · mock facts
def mf(name): return next((x for x in MF if x['name']==name),None)
# ---------------- the page
H=f'''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow">
<title>X1 · COMPARE PROPOSAL · the dashboard's compare section reorganized around the tree (2 Oct 2026)</title>
<style>
:root{{--bg:#0d0d0d;--panel:#151515;--panel2:#1b1b1b;--line:#272727;--line2:#333333;--ink:#cdcdcd;--ink2:#ababab;--dim:#8c8c8c;--mute:#6a6a6a;--up:#35b06a;--dn:#d1483f;--mono:ui-monospace,SFMono-Regular,Menlo,monospace}}
*{{box-sizing:border-box}}html,body{{margin:0;background:var(--bg);color:var(--ink);font:12.5px/1.6 var(--mono)}}
.wrap{{max-width:1480px;margin:0 auto;padding:14px 16px 60px}}
h1{{font-size:15px;letter-spacing:.16em;margin:6px 0 4px;font-weight:600}}h2{{font-size:12px;letter-spacing:.16em;margin:34px 0 10px;padding-top:12px;border-top:1px solid var(--line);color:var(--ink2);font-weight:600;text-transform:uppercase}}
h3{{font-size:12px;letter-spacing:.1em;margin:18px 0 6px;color:var(--ink2);font-weight:600}}
p{{margin:6px 0;max-width:1100px}}.lede{{color:var(--ink2)}}.dim{{color:var(--dim)}}.mute{{color:var(--mute)}}small{{font-size:11px}}
.panel{{background:var(--panel);border:1px solid var(--line);padding:10px 12px;margin:8px 0}}
.gal{{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px;margin:8px 0}}
figure{{margin:0;background:var(--panel);border:1px solid var(--line);padding:6px}}figure img{{width:100%;height:auto;display:block;border:1px solid var(--line2)}}figcaption{{font-size:11px;color:var(--dim);padding:5px 2px 0;line-height:1.4}}
figure.wide{{grid-column:1/-1}}
table{{border-collapse:collapse;width:100%;font-size:11.5px;margin:6px 0}}th,td{{text-align:left;padding:5px 7px;border-bottom:1px solid var(--line);vertical-align:top}}th{{color:var(--mute);font-weight:600;letter-spacing:.1em;font-size:10.5px;text-transform:uppercase}}
td.n,th.n{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}td.src{{color:var(--dim)}}
td.v{{white-space:nowrap;font-weight:600}}td.keep{{color:var(--ink)}}td.merge{{color:var(--ink2)}}td.drop{{color:var(--dim);text-decoration:line-through dotted}}
.up{{color:var(--up)}}.dn{{color:var(--dn)}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:10px}}@media(max-width:800px){{.two{{grid-template-columns:1fr}}}}
.col h3{{margin-top:0}}ul,ol{{margin:4px 0;padding-left:20px}}li{{margin:3px 0}}
.rec{{border-left:2px solid var(--ink2);padding:6px 10px;margin:8px 0;background:var(--panel2)}}
.k{{display:inline-block;border:1px solid var(--line2);padding:0 5px;border-radius:2px;color:var(--ink2);font-size:11px}}
code{{font-size:11px;color:var(--ink2)}}.toc{{display:flex;flex-wrap:wrap;gap:4px 14px;max-width:none}}.toc a{{color:var(--ink2)}}
.tbl-scroll{{overflow-x:auto}}
@media(max-width:600px){{.wrap{{padding:10px 16px 40px}}.gal{{grid-template-columns:1fr}}table{{display:block;overflow-x:auto;max-width:100%}}p{{overflow-wrap:anywhere}}}}
</style></head><body><div class="wrap">
<h1>THE COMPARE SECTION, REORGANIZED AROUND THE TREE · a proposal</h1>
<p class="lede">X1 · Fri 2 Oct 2026 · proposal only: nothing on the Hub changed. Everything below is measured from the live Hub this morning (headless, every write blocked) and from today's real readings: the off-Hub Geiger at the {e(D['as_of_close'])} close on 5,641 lines, the Hub's live Geiger on 590 names at {e(D['hub_computed'][11:16])}Z, and the chart API's daily closes to {e(D['closes_newest'])}.</p>
<p class="toc"><a href="#s0">The answer in one picture</a><a href="#s1">1 · Inventory</a><a href="#s2">2 · The ladder</a><a href="#s3">3 · Three arrangements</a><a href="#s4">4 · Hub or tree</a><a href="#s5">5 · The board's scope</a><a href="#s6">6 · The staged path</a><a href="#dec">Decisions for Alan</a><a href="#src">Where the numbers come from</a><a href="#wrong">What could be wrong</a><a href="#notdone">Not done</a></p>

<h2 id="s0">The answer in one picture</h2>
<p>Today the right pane has four tabs and, under them, up to five rows of chips (measured below). The proposal is <b>one COMPARE panel</b>: a <b>path</b> (the market ▸ US ▸ sectors ▸ Technology ▸ SMH ▸ AI ACCELERATORS, the standard's six levels) and <b>three lenses</b> on the node you stand on: <b>ORDER</b> (the bow tie, green → red), <b>MAP</b> (the squares), <b>ROTATION</b> (who is gaining, against the node's own parent). Alan's three lists sit beside the path as scopes. The twelve cohort tabs become tags. The Hub keeps the top of the tree live; the tree page owns the long tail at the close.</p>
<div class="gal">{mpic('mock-A-1680-order-sectors.png','MOCK A · ORDER on "US sectors": the eleven sector bars, the only green one is Technology. The board on the left follows the path.')}{mpic('mock-A-1680-rotation-names.png','MOCK A · ROTATION on "AI ACCELERATORS" against SMH: 18 names, tails of 8 daily bars, and the 1M / 3M numbers under the picture (the RELATIVE tab folded in).')}</div>
<div class="gal">{pic('dashboard-open','TODAY · the live dashboard as it opened this morning (1680): LIKED on the board, MAP · GRID on the right, three chip rows above the first square.')}{pic('cohort-compare-SECTORS-SPDR','TODAY · COHORT COMPARE in SECTORS mode: two chip rows (COHORTS | SECTORS, then seven fund families) above the bars.')}</div>

<h2 id="s1">1 · The inventory, measured from the code and the live page</h2>
<p>Every control of the right pane and of the board's strip, clicked in turn on <code>https://scintillahub.ai/</code> (deployed <code>83610c9</code>) with every non-GET request aborted: {len(F['shots'])} pictures at 1680 and {len(F390['shots'])} at 390, zero page errors, zero blocked writes (the page never tried one). The header text each view printed is kept beside its picture in <code>shots/facts-1680.json</code>.</p>
<p class="dim">Verdicts: <b>{keep} keep</b> · <b>{merge} merge</b> · <b>{drop} drop</b>. "Merge into" means the control's question is still answered, by the path or a lens, and the chip goes.</p>
<div class="tbl-scroll"><table><tr><th>control</th><th>what it shows</th><th>what it reads</th><th>overlaps with</th><th>verdict</th><th>reason</th><th>picture</th></tr>{inv_rows}</table></div>
<p class="dim">Counted on the live page: the right pane's chip rows are TF (4) + Mode (6) + fill (3) on MAP = 13 chips in three rows; COHORT COMPARE carries 2 + 7 chips in two rows; ROTATION carries TF + PLAY; RELATIVE carries TF + Window (3). The board's strip carries 3 lists + ALL + 12 cohort tabs = 16 tabs. The brief's "17 cohort tabs" was the count before the five sector tabs were removed (the code says so at <code>index.html:6093</code>); today it is 12, and the tag column underneath (<code>ticker_membership</code>) has {len(D['tags'])} board cohorts plus the industry and sector keys.</p>
<div class="gal">{pic('map-GRID-GRAIN','MAP · GRID · GRAIN (1680)')}{pic('map-TILT','MAP · TILT: the same 118 squares as cards')}{pic('rotation-4H-liked','ROTATION · 4H · the twelve largest of LIKED vs SPY')}{pic('relative-1D-3M-ALL-sectors','RELATIVE · 1D · 3M · eleven sectors vs SPY')}{pic('cohort-compare-SECTORS-BOWTIE','COHORT COMPARE · SECTORS · BOW TIE (breadth): kept as a lens')}{pic('board-scope-strip','The board’s strip: 16 tabs (1680)')}</div>
<div class="gal">{pic('cohort-compare-COHORTS','390 · COHORT COMPARE on a phone: twelve columns in two rows').replace('shots/1680-','shots/390-')}{pic('map-FISHEYE','390 · MAP · FISHEYE on a phone: "touch · static grid (cursor effects need a pointer)" — the effect does not exist here').replace('shots/1680-','shots/390-')}</div>

<h2 id="s2">2 · The comparison ladder: which comparison answers a real question at each level</h2>
<p>The standard's tree has six levels. At every node there are two bow ties: the bow tie <b>of the children</b> (the node's own question: what leads inside it) and the bow tie <b>across the siblings</b> (the parent's question, which is the same picture one level up). So "Financials vs Technology vs Healthcare" is not a new tab: it is ORDER on "US sectors". Rotation is a different question, "who is gaining on whom", and it needs a benchmark: the node's own parent fund (names vs SMH, industry funds vs XLK, sectors vs SPY), not SPY for everything as today. Relative performance is the same series as rotation drawn as lines; its numbers (1M, 3M against the parent) ride under the rotation heads. One worked example per level, on the {e(D['as_of_close'])} close:</p>
<h3>L0 · the market → asset classes · question: where is the money this week? · benchmark VT</h3>
{bt_table(l0,COLS)}
<p class="dim">Read: the dollar-and-volatility line is the only one above zero; bonds are the weakest. Rotation at this level runs on one representative fund per heading (SPY · VT · TLT · DBC · IBIT · UUP) because headings have no price.</p>
<h3>L1 · US stocks → broad · style · sectors (and the world beside it) · benchmark SPY</h3>
{bt_table(l1,COLS)}
<p class="dim">Useful mostly as a crumb: the sector heading is where the real question starts. The broad funds (SPY · RSP · QQQ · IWM …) are the old INDEXES chip, found here instead.</p>
<h3>L2 · US sectors · question: which sector leads? · benchmark SPY</h3>
{bt_table(l2,COLS)}
<p class="dim">The leader is <b>{e(lead_sec['label'])}</b> at {fg(lead_sec['g'])} (the heading aggregates its {lead_sec['agg_n']} lines, as the tree does); every other sector is below zero. The same question through the SPDR funds' own readings: {', '.join(f"{r['ticker']} {fg(r['g'])}" for r in l2s[:4])} … {l2s[-1]['ticker']} {fg(l2s[-1]['g'])}. Rotation says who is <i>gaining</i>: {', '.join(r['ticker'] for r in l2s if r['rrg'] and r['rrg']['quadrant']=='IMPROVING')} are improving against SPY while {', '.join(r['ticker'] for r in l2s if r['rrg'] and r['rrg']['quadrant']=='WEAKENING')} are weakening, and over 3M XLE is {fp(next(r['rel63'] for r in l2s if r['ticker']=='XLE'))} against SPY against XLK's {fp(next(r['rel63'] for r in l2s if r['ticker']=='XLK'))}. That is the answer the four tabs give today in three places; here it is one node.</p>
<h3>L3 · Information Technology → its industry funds · question: what leads inside the leader? · benchmark XLK</h3>
{bt_table(l3,COLS)}
<p class="dim">Fourteen funds, all green; the spread is {fg(l3[0]['g'])} (RSPT, equal-weight) to {fg(l3[-1]['g'])} ({l3[-1]['ticker']}). Here rotation separates them: SMH, SOXX, XSD and DRAM are the ones that have gained on XLK over 1M ({', '.join(f"{r['ticker']} {fp(r['rel21'])}" for r in l3 if r['ticker'] in ('SMH','SOXX','XSD','DRAM'))}); software (IGV {fp(next(r['rel21'] for r in l3 if r['ticker']=='IGV'))}) has lost. The fund families (XLK · IYW · VGT · RSPT) are siblings here, which is where today's four family chips go.</p>
<h3>L4 · SMH → its cohorts · question: which cohort leads inside semiconductors? · benchmark SMH</h3>
{bt_table(l4,COLS)}
<p class="dim">The cohort means are close ({fg(l4[0]['g'])} to {fg(l4[-1]['g'])}); a bow tie of four is honest but thin. At this level the comp-set edges and the agreement view (the standard's E7) matter more than the ordering.</p>
<h3>L5 · AI ACCELERATORS → its names · question: which name leads, and who is gaining? · benchmark SMH</h3>
{bt_table(l5,NCOLS)}
<p class="dim">Leader by Geiger: <b>{e(lead_name['t'])}</b> {fg(lead_name['g_close'])}. Gaining fastest on SMH over 1M: <b>{e(best_rot['t'])}</b> {fp(best_rot['rel21'])}, which the Geiger order alone would not show. The Hub's live column shows how far the morning has moved each name from its close reading: on these 18 the largest gap is {max(abs((r.get('g_live') or r['g_close'])-r['g_close']) for r in l5):.2f}.</p>
<div class="panel"><b>The agreement between the two Geigers, measured today</b> on the {A['n']} names both read: median gap {A['median_gap']:.3f}, 90th-percentile gap {A['p90_gap']:.3f}, same sign on {A['sign_agree']} of {A['n']}. The largest gaps this morning: {', '.join(f"{t} (live {h:+.2f} vs close {s:+.2f})" for t,h,s in A['max_gap'][:4])}. <span class="dim">{e(A['note'])}. This is what makes "the tree at the close, the Hub live" workable: for the ordering of a node's children the two readings agree; for a single name intraday they can differ by a tenth or more, which is exactly what the Hub is for.</span></div>

<h2 id="s3">3 · Three arrangements, mocked on today's data</h2>
<p>Each mock is a static page beside this one, drawn from the same data file (<code>data/mock-data.js</code>), clickable, nothing fetched. For each: what Alan clicks to answer the three questions, and what is lost.</p>
<h3>A · one COMPARE panel · path + three lenses &nbsp;<a href="mock-A-compare-panel.html">open the mock</a></h3>
<div class="gal">{mpic('mock-A-1680-order-sectors.png','A · ORDER on US sectors (1680)')}{mpic('mock-A-1680-order-tech-funds.png','A · one click on the green bar: ORDER on Technology’s industry funds')}{mpic('mock-A-1680-rotation-names.png','A · three clicks down: ROTATION of AI ACCELERATORS vs SMH')}{mpic('mock-A-1680-order-favorites.png','A · MY LISTS ★: FAVORITES in Geiger order; the control row states the list against its home cohorts')}{mpic('mock-A-1680-map-favorites.png','A · MAP of FAVORITES: colour = Geiger, text = the day')}{mpic('mock-A-390-order-sectors.png','A · 390: the path and the bars still fit; eleven columns')}</div>
<div class="two"><div class="col panel"><h3>What Alan clicks</h3><ol><li><b>Which sector leads?</b> crumb <span class="k">US sectors</span> → ORDER. One click (and it is where the panel opens).</li><li><b>What leads inside it?</b> click the green bar → the industry funds; click SMH → the cohorts; click a cohort → the names. One click per level, crumbs back.</li><li><b>Is FAVORITES strong or weak vs its industries?</b> <span class="k">★ FAVORITES</span> → ORDER; the row above reads "list mean {fg(fav['mean_g_close'])} · home cohorts' mean {fg(fav['mean_home_g'])} · {fav['above_home']} of {fav['compared']} above their home". Today: strong, carried by AI ACCELERATORS and MEMORY &amp; SEMI EQUIPMENT.</li></ol></div>
<div class="col panel"><h3>What is lost</h3><ul><li>Four of the six MAP drawings (FISHEYE · DOCK · BUBBLES · TILT).</li><li>The RELATIVE tab as a tab; its lines come back as a switch under ROTATION, its numbers stay.</li><li>The fund-family chips; the families are L3 siblings.</li><li>The habit: Alan learns one new thing, the crumb row. Everything else is a lens he already knows.</li></ul><p class="dim">A long node (FAVORITES has 47, LIKED 118) makes a bow tie of 47 columns; at 390 it is unreadable. Alan's coil ("two snakes, mirrored") is the right picture there; it is drawn in words in §6 and not mocked here.</p></div></div>
<h3>B · the smallest change · the same four tabs, sub-selections consolidated &nbsp;<a href="mock-B-four-tabs.html">open the mock</a></h3>
<div class="gal">{mpic('mock-B-1680-compare.png','B · today’s pane (left) beside the consolidated one (right): COMPARE with one SCOPE row and one AS row')}{mpic('mock-B-1680-rotation.png','B · ROTATION: TF + PLAY, the scope from the SCOPE row, not the board')}{mpic('mock-B-1680-relative.png','B · RELATIVE kept, TF + Window; lines drawn from the same closes')}{mpic('mock-B-1680-map-tech.png','B · MAP on PATH ▸ TECHNOLOGY: three modes, one fill switch')}</div>
<div class="two"><div class="col panel"><h3>What Alan clicks</h3><ol><li><b>Which sector leads?</b> COMPARE (SECTORS is the default scope). One click, as today.</li><li><b>What leads inside it?</b> SCOPE ▸ PATH · TECHNOLOGY → COMPARE shows the industry funds. One level only; deeper means the tree page.</li><li><b>Is FAVORITES strong or weak?</b> SCOPE ★ → COMPARE orders the list; the AS row states the list vs home.</li></ol></div><div class="col panel"><h3>What is lost</h3><ul><li>Only chips: MAP keeps GRID · TREEMAP · TILT, FILL is one switch, the family row is one dropdown.</li><li>Nothing structural changes, so the pane still asks the scope in one place and the tab in another.</li><li>The path stops at one level: the cohorts and names stay a tree-page trip.</li></ul></div></div>
<h3>C · the split · the Hub keeps my lists and the parents, the tree owns everything below &nbsp;<a href="mock-C-split.html">open the mock</a></h3>
<div class="gal"><figure class="wide"><a href="shots/mock-C-1680.png"><img loading="lazy" src="shots/mock-C-1680.png" alt="mock C"></a><figcaption>C · left: the Hub, live: the eleven parents' bow tie ({sum(1 for r in l2s if r.get('g_live') is not None)} of 11 read live by the Hub this morning) and FAVORITES with each name's home cohort from the placement record. Right: the tree at the {e(D['as_of_close'])} close, opened at Technology: L3 funds, L4 cohorts, L5 rotation.</figcaption></figure></div>
<div class="two"><div class="col panel"><h3>What Alan clicks</h3><ol><li><b>Which sector leads?</b> nothing: the PARENTS strip is on the dashboard, live.</li><li><b>What leads inside it?</b> click the sector bar → the tree opens at that node (the TREE master tab, grey BACK returns).</li><li><b>Is FAVORITES strong or weak?</b> the list is live on the Hub; its "vs home" column is from the nightly record and says its date.</li></ol></div><div class="col panel"><h3>What is lost</h3><ul><li>MAP, ROTATION and RELATIVE below the parents leave the Hub: inside a sector they are daily, on the tree.</li><li>Intraday rotation of names survives only for the lists.</li><li>Two pages to hold in the head, with a seam at L2.</li></ul></div></div>
<div class="rec"><b>Recommendation: A, built in two steps, with C's rule for freshness.</b> Step one is B's consolidation (chips only, reversible in an hour). Step two turns the four tabs into the one panel with the path, keeping the Hub live for the top of the tree and his lists, and reading the tree's levels below L3 from the nightly record. C on its own moves too much off the Hub at once ("let's be safe"); B on its own leaves the scope-in-one-place, tab-in-another problem Alan named.</div>

<h2 id="s4">4 · Hub or tree</h2>
<p>The Hub's Geiger is live and covers 590 names; the off-Hub reading covers 5,641 lines at the close (and a second run in the morning when P8's schedule lands). The split follows from that one fact: what needs minutes stays on the Hub; what needs breadth lives on the tree. Each line names its cost.</p>
<div class="two"><div class="col panel"><h3>Stays live on the Hub</h3><ul>
<li><b>Prices, the board, the tapes.</b> Minute-fresh. The reason the Hub exists.</li>
<li><b>His lists (RADAR · FAVORITES · LIKED)</b> with the live Geiger on every name. Cost: none; they are already here.</li>
<li><b>The parents: the eleven sector funds and the broad funds (L1–L2).</b> The Hub already reads them live ({sum(1 for r in l2s if r.get('g_live') is not None)} of 11 this morning). Cost: none. Reason: Alan: "Parents we do have to have on Hub." The leading sector at 10:30 is a different fact from the leading sector at yesterday's close.</li>
<li><b>ORDER · MAP · ROTATION on his lists and on the parents.</b> The pane's three lenses, on the scopes the Hub can read live. Cost: the ROTATION series pull stays on the Hub for these scopes (one bounded read per symbol, cached per tf, as today).</li>
<li><b>The per-name "vs home" number</b> on the board, from the record. Cost: it is a close number on a live row; it must carry its date.</li>
</ul></div><div class="col panel"><h3>Lives on the tree, at the close</h3><ul>
<li><b>L3 and below: industry funds, cohorts, names outside the 590, the NONE YET lines.</b> The long tail (5,641 − 590). Cost: up to a day old. Reason: the Hub cannot read them live and should not try; a reading twice a day that agrees with the Hub's at the close (median gap {A['median_gap']:.3f} today) is enough to order children.</li>
<li><b>The 3D areas and the agreement view</b> (Alan: "Technology could have a 3D … Financials could have a little 3D"). Cost: daily. Reason: they are made of the record (placement, peers, holdings), which is nightly by design.</li>
<li><b>The comp-set edges</b> ("also in another company's kept set"). Cost: daily. Reason: E3 computes them off the Hub first (standing decision 5).</li>
<li><b>Rotation and relative inside a sector</b> (funds vs XLK, names vs SMH). Cost: daily bars only; no intraday rotation below L2. Reason: these sets are large and the question is weekly, not hourly.</li>
<li><b>The screener</b> over the record (E6). Cost: daily.</li>
</ul></div></div>
<p class="dim">The seam is at L2/L3: standing on a sector on the Hub, the next click down opens the tree. On the Hub the panel says "live"; on the tree it says "at the {e(D['as_of_close'])} close · next after 20:00 ET". Both pages already carry the grey BACK / CLOSE pair.</p>

<h2 id="s5">5 · The board's scope selector: my lists + a tree path &nbsp;<a href="mock-scope-selector.html">open the mock</a></h2>
<div class="gal">{mpic('mock-scope-1680-favorites.png','Today’s 16-tab strip (top) and the proposed row: MY LISTS · TREE PATH · TAG. FAVORITES open, every row carrying its tags.')}{mpic('mock-scope-1680-path.png','TREE PATH ▸ AI ACCELERATORS: the board shows the node’s names; the crumbs are the way up.')}{mpic('mock-scope-1680-favorites-tag-aihw.png','FAVORITES filtered by the tag AI HW: a question no tab could ask.')}{mpic('mock-scope-390-favorites.png','390: the same row wraps; the lists first.')}</div>
<p><b>What happens to the 12 cohort tabs.</b> They become tags, which they already are underneath (<code>tickers.cohort</code> and <code>ticker_membership</code>; the standard keeps them as tags). Each row shows its tags; a TAG chip filters whatever list or node is open. Nine of the twelve also exist as tree nodes ({', '.join(f"{v['tab']}" for v in D['tags'].values() if v['tree_node'])}) and are reachable from TREE PATH; {', '.join(f"{v['tab']}" for v in D['tags'].values() if not v['tree_node'])} have no adopted node and stay tags only until E5 proposes one. ALL becomes the market crumb. Default scope: FAVORITES (Alan, 2 Oct).</p>

<h2 id="s6">6 · The staged path</h2>
<table><tr><th>step</th><th>what ships</th><th>needs</th><th>reversible</th></tr>
<tr><td><b>1 · safe to ship first</b></td><td>B's chip consolidation in the existing pane: MAP modes to GRID · TREEMAP · TILT, fill to one switch, the family row to one dropdown, RELATIVE's window beside ROTATION; default board scope FAVORITES. No data change, no new read.</td><td>nothing new; the same renderers</td><td>yes: one commit, the old chips come back with it</td></tr>
<tr><td><b>2 · the one panel</b></td><td>The path row and the three lenses on the Hub, for the scopes the Hub reads live (lists, L0–L2 parents). ORDER on a node = the strip's renderer on the node's children; ROTATION vs the node's parent fund.</td><td>a tree index the Hub can read (tree.json is already served at <code>/deliverables/20260929/tree-map/</code>)</td><td>yes: the old four tabs stay behind a flag until Alan has used it a week</td></tr>
<tr><td><b>3 · needs the placement record (E1)</b></td><td>The "vs home" number per name and per list; the board's TREE PATH below L2; the tags as filters from the record rather than from <code>tickers.cohort</code>; the coil for long nodes.</td><td>E1 nightly job + the record table; E4 (P8's seven-rung close reading) is already running</td><td>additive tables only; pre-approved</td></tr>
<tr><td><b>4 · waits for Alan</b></td><td>Which tabs leave the Hub (MAP · ROTATION · RELATIVE below L2); whether TILT stays; the 3D areas; adopting cohorts from the tree's bottom; the Hub streamlining the standard lists as E8 ("discussion first").</td><td>his look at the mocks</td><td>—</td></tr></table>
<p class="dim"><b>The coil</b> (Alan's "two snakes, mirrored") for a node with more than ~16 children: the greens coil upward from the centre with the highest Geiger at the tip, the reds coil downward with the most negative at the other tip, zero flat in the middle. It is the bow tie bent so 47 or 118 names fit a pane. It needs the same data as ORDER and is step 3 work.</p>

<h2 id="dec">Decisions for Alan (five, each with a recommendation)</h2>
<ol>
<li><b>Which arrangement?</b> A (one panel), reached through B. <i>Recommend A.</i></li>
<li><b>Does ROTATION run against the node's parent (names vs SMH) or always SPY?</b> <i>Recommend the parent;</i> SPY stays the benchmark at L0–L2 where it is the parent anyway.</li>
<li><b>Does TILT stay as the one "show" mode?</b> <i>Recommend drop</i> with FISHEYE, DOCK and BUBBLES; GRID and TREEMAP carry the reading. Say the word and it stays.</li>
<li><b>Does the Hub keep MAP / ROTATION below L2 (inside a sector), or is that the tree's?</b> <i>Recommend the tree,</i> daily, after step 2 has run a week with the parents live.</li>
<li><b>The cohort tabs: tags only, now, or tabs until the record lands?</b> <i>Recommend tags now</i> (step 1 keeps the tabs; step 2 replaces them with TAG chips and the path), because the tag column already exists and nothing is deleted.</li>
</ol>

<h2 id="src">Where the numbers come from</h2>
<ul>
<li><b>The inventory</b>: <code>index.html</code> at <code>83610c9</code> (the tabs at line 10000, the control row at 10024, the MAP modes at 9144, the TF menu at 8555, the cohort list at 6068, the strip at 7929) and the live page, driven by <code>harness/inventory-shots.mjs</code>; facts in <code>shots/facts-1680.json</code> and <code>facts-390.json</code>, the board state in <code>shots/state-1680.json</code> (Alan's lists, the rows' Geigers, the membership map).</li>
<li><b>The tree</b>: <code>deliverables/20260929/tree-map/tree.json</code> (739 nodes: 23 headings, 138 funds, 102 cohorts, 476 names). Headings aggregate their children as the tree page does; funds blend their served holdings by weight (<code>aggregate.js</code>'s rule); cohorts average their members.</li>
<li><b>The close Geiger</b>: the chart API <code>/v1/scout-geiger</code>, run <code>{e(D['scout_run'])}</code>, seven rungs, 5,641 rows, as of {e(D['as_of_close'])}; saved in <code>data/scout-geiger-seven-20261001.json</code>.</li>
<li><b>The live Geiger</b>: the chart API <code>/geiger</code> at {e(D['hub_computed'])} (590 names); <code>data/hub-geiger-20261002T1343Z.json</code>.</li>
<li><b>Rotation and relative</b>: the chart API <code>/candles?tf=1d&amp;limit=320</code> for 84 symbols (<code>data/closes-1d-20261002.json</code>, newest bar {e(D['closes_newest'])}); the RRG maths is the Hub's <code>l0RrgSeries</code> ported line for line in <code>harness/build-data.py</code> (4-bar EMA of relative strength, 14-bar z-score, 4-bar momentum, 2-bar EMA); relative = the symbol's % change over 21 / 63 bars minus the benchmark's.</li>
<li><b>Lists vs home</b>: each name's <code>home_id</code> and <code>sector</code> from tree.json (the home-path rule of 29 Sep, not yet the E1 record); the list's mean vs the mean of those homes' Geigers.</li>
</ul>
<h2 id="wrong">What could be wrong</h2>
<ul>
<li>The "home" of a name is the 29 Sep tree's placement, before the standard's five decisions and before SIC tags; E1 can move names. The list-vs-home numbers will shift with it.</li>
<li>The close reading is {e(D['as_of_close'])}; the live reading is this morning pre-market. Where I put them side by side the gap is real time, not error.</li>
<li>Headings have no price, so rotation at L0–L1 runs on one representative fund per heading, named in the tables. That is a choice, not the tree's rule.</li>
<li>The mocks draw the bow tie from the close reading; the live pane would draw the Hub's where it has one (the white tick shows both in mock B). They are static: the lenses switch, nothing refreshes.</li>
<li>The live inventory was shot before the open (04:00 ET bars on the 4H map); the pictures show last night's colours.</li>
</ul>
<h2 id="notdone">What was not done</h2>
<ul>
<li>Nothing was deployed and <code>index.html</code>, the tree page and every table are untouched; the Indicator Lab was not opened.</li>
<li>The coil (the two snakes) is described, not drawn.</li>
<li>No 3D; the 3D areas are placed on the tree side without a picture.</li>
<li>Rotation on Alan's lists in the mocks covers only the names with a daily series in the data file (the 84 symbols pulled); the Hub would pull its own.</li>
<li>The tests were run against the production baseline; this lane adds a deliverable, not code under test.</li>
</ul>
<p class="mute">Branch <code>hub/x1-compare-proposal-20261002</code> from <code>origin/hub/release-20260923</code> @ <code>83610c9</code>. Headless only; no browser window was opened on this Mac; every browser process was closed before returning.</p>
</div></body></html>'''
open('COMPARE-PROPOSAL.html','w').write(H)
print('written', len(H), 'bytes; inventory rows', len(INV), 'keep/merge/drop', keep, merge, drop)
