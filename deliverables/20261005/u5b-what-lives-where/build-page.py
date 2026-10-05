#!/usr/bin/env python3
"""U5b · writes WHAT-LIVES-WHERE.html from decision.json (+ the B1 / T12 data). Plain words, the diagram, the tables."""
import json, os, html, collections
H = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(H, 'data')
J = lambda n: json.load(open(os.path.join(D, n)))
dec = json.load(open(os.path.join(H, 'decision.json')))
B1 = J('b1-market-bowtie-20261003.json'); T12 = J('t12-cohorts-measured-20261003.json'); facts = J('u4b-facts-20261003.json')
e = html.escape
C = dec['counts']; cost = dec['cost']; ONE = dec['one_number']
byt = {d['ticker']: d for d in dec['decision']}
rows = {r['ticker']: r for r in facts['rows'] if r['today'] != 'not served'}
sectors = B1['modes']['blend']['sectors']; b1coh = B1['modes']['blend']['cohorts']
live_after = {t for t, d in byt.items() if d['tier_after'] == 'LIVE'} | {'SKHY'}

# ---- industries: live names after the moves, per FMP industry ---------------------------------------------------
ind_live = collections.Counter(); ind_live_before = collections.Counter()
for t, r in rows.items():
    ind = (r.get('profile') or {}).get('industry')
    if ind:
        ind_live_before[ind] += 1
        if t in live_after: ind_live[ind] += 1
cohorts = dec['cohorts']; tabs = [c for c in cohorts if c['where'] == 'hub_tabs']; cands = [c for c in cohorts if c['where'] == 'candidates']

def fmt(x, nd=2):
    return ('%+.' + str(nd) + 'f') % x if isinstance(x, (int, float)) else '—'

# ---- 1 · tiers --------------------------------------------------------------------------------------------------
L = cost['live']; CL = cost['close']
tiers_rows = [
 ('LIVE HUB', 'streamed quotes (the stream subscribes the name) · the Geiger every publisher cycle, 7 rungs · a board row on its cohort tab · all 24 chart widths · the company page live · lists',
  'price: tick · Geiger: every %d s (the mean of %d cycles measured 5 Oct on what the publisher serves: %s) · bars: every minute intraday' % (L['cycle_s_measured'], len(L['cycles_measured']), ' · '.join('%d s' % c for c in L['cycles_measured'])),
  '%d chart-API requests a day (7 rungs × %d cycles, always on) · %s MB of bars in R2 (median, 24 widths) · %.2f s of the publisher\'s cycle at 6 workers' % (L['requests_per_name_per_day'], L['cycles_per_day_if_always_on'], L['storage_mb_per_name_median_24_widths'], L['cycle_s_per_name_at_conc_6'])),
 ('CLOSE TIER', 'the Geiger at the close, 7 rungs (the scout) · daily bars · a node on the tree · counted in the sector compare, the market bow tie, the cohort compare and portfolio allocation\'s heat · its company page reads the close',
  'once a night after 20:15 ET (the scout; seven-rung pass at 16 and 20 ET) · daily bar at the close',
  '%s calls · %d KB · %.3f s of machine time per name per night (the 3 Oct scout: %s names, 157 s) · %.2f MB daily object in R2' % (CL['calls_per_name_per_night'], CL['kb_per_name_per_night'], CL['machine_s_per_name_per_night'], format(CL['names_tonight'], ','), CL['storage_mb_per_name_daily_object'])),
 ('STORED FOR COMPS', 'fundamentals (statements, median 56 quarters) · analyst estimates (60 periods) · the profile row · daily bars — every multiple the comps field uses, and the knockouts · no Geiger',
  'estimates nightly · statements as they are filed (the loader takes 10 names every 6 h) · daily bar at the close',
  'two FMP /stable routes per name per refresh · kilobytes in the Hub database · no publisher time'),
]

# ---- 2 · soundness table --------------------------------------------------------------------------------------------
def sec_row(s):
    fix = ', '.join('%s $%s bn' % (n['t'], n['mcap_bn']) for n in s['need'][:4])
    return (s['label'], 'sector', '%d / %d' % (s['n_read'], s['n_exist']), s['n_live'], '%d%%' % round(100 * s['mv_share']), '%.3f' % s['se'], '%d / 6' % s['closes_pass'], s['verdict'], (fix + ' → close tier') if fix else '—')
def ind_rows(s):
    out = []
    for i in sorted(s.get('industries') or [], key=lambda i: (i['verdict'] != 'sound', -i['n_read'])):
        fix = ', '.join('%s $%s bn' % (n['t'], n['mcap_bn']) for n in (i.get('need') or [])[:4])
        why = '; '.join(i.get('weak') or [])
        out.append((i['label'], 'industry · ' + s['label'], '%d / %d' % (i['n_read'], i['n_exist']), i['n_live'], '%d%%' % round(100 * i['mv_share']), '%.3f' % i['se'], '%d / 6' % i['closes_pass'], i['verdict'], (fix + ' → close tier') if fix else (why or '—')))
    return out
def coh_row(c):
    after = c['after_live_n']; fix = '—'
    if not c['t12_sound']: fix = '; '.join(c['t12_weak'])
    return (c['label'], 'Hub tab' if c['where'] == 'hub_tabs' else 'candidate', '%d / %d' % (c['t12_n'], c['t12_n']), '%d → %d' % (c['t12_n'], after), '—', '%.3f' % (c['t12_se'] or 0), '%d / 6' % c['t12_closes'], ('sound' if c['t12_sound'] else 'not yet') + ('' if c['after_sound'] == c['t12_sound'] else ' → %s after' % ('sound' if c['after_sound'] else 'thin')), fix)

# ---- 3 · the critique groups -----------------------------------------------------------------------------------------
leaving = dec['leaving']; funds = [d for d in leaving if d['batch'] == 'FUNDS66']; batch_leave = [d for d in leaving if d['batch'] == 'BATCH104']
batch_all = [d for d in dec['decision'] if d['batch'] == 'BATCH104']; batch_stay = [d for d in batch_all if d['tier_after'] == 'LIVE']
chinese = [d for d in dec['decision'] if d['chinese']]
bookmarks = [d for d in dec['decision'] if d['batch'] == 'BOOKMARK56']
pulled = dec['pulled_back']
def still(d):
    if d['batch'] == 'FUNDS66':
        if d['ticker'].startswith('RSP'): return 'tree fund node · compare strip EQUAL-WEIGHT family · the BOW TIE pair (reads at the close once off live)'
        if d['ticker'] in ('IYM','IYE','IYF','IYJ','IYW','IYK','IYR','IDU','IYH','IYC','IYZ'): return 'tree fund node · compare strip ISHARES family'
        if d['ticker'] in ('VAW','VDE','VFH','VIS','VGT','VDC','VNQ','VPU','VHT','VCR','VOX'): return 'tree fund node · compare strip VANGUARD family'
        return 'tree fund node (its fund set) · its company page at the close'
    s = 'the tree (close Geiger) · sector compare · its company page at the close'
    if d['comps_peer_of']: s += ' · comps store (peer of %d)' % d['comps_peer_of']
    return s
def why_short(d):
    w = [x for x in d['why'] if not x.startswith('its reading still') and not x.startswith('its Geiger stays')]
    return ' · '.join(w)

# ---- 4 · tree → tabs -------------------------------------------------------------------------------------------------
tabs_sound = [c for c in tabs if c['t12_sound'] and c['after_sound']]
tabs_lost = [c for c in tabs if c['t12_sound'] and not c['after_sound']]
tabs_not = [c for c in tabs if not c['t12_sound']]
cand_tab = [c for c in cands if c['t12_sound'] and c['after_sound'] and c['after_live_n'] >= 8]
sound_inds = [(s['label'], i) for s in sectors for i in (s.get('industries') or []) if i['verdict'] == 'sound']
cand_labels = {c['label'].upper() for c in cands}
tree_only = [(sl, i) for sl, i in sound_inds if ind_live.get(i['label'], 0) < 8]
could_tab = [(sl, i) for sl, i in sound_inds if ind_live.get(i['label'], 0) >= 8 and i['label'].upper() not in cand_labels]

# ---- the diagram (inline SVG, monochrome) ------------------------------------------------------------------------------
def diagram():
    W, Hh = 1180, 640; g = []
    g.append('<svg viewBox="0 0 %d %d" xmlns="http://www.w3.org/2000/svg" font-family="SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace" font-size="11" role="img" aria-label="From the tree to the cohort board: which branches become tabs">' % (W, Hh))
    g.append('<rect width="%d" height="%d" fill="#141414"/>' % (W, Hh))
    def box(x, y, w, h, title, lines, strong=False):
        g.append('<rect x="%d" y="%d" width="%d" height="%d" fill="#0e0e0e" stroke="%s" stroke-width="1"/>' % (x, y, w, h, '#8c8c8c' if strong else '#3a3a3a'))
        g.append('<text x="%d" y="%d" fill="#cfcfcf" font-weight="600" letter-spacing="1.5" font-size="10.5">%s</text>' % (x + 10, y + 18, e(title)))
        for k, ln in enumerate(lines):
            g.append('<text x="%d" y="%d" fill="%s" font-size="10.5">%s</text>' % (x + 10, y + 36 + 15 * k, '#8c8c8c' if ln.startswith('·') else '#bdbdbd', e(ln)))
    def arrow(x1, y1, x2, y2, label=None):
        g.append('<path d="M%d %d C %d %d, %d %d, %d %d" fill="none" stroke="#5a5a5a" stroke-width="1.2"/>' % (x1, y1, (x1 + x2) / 2, y1, (x1 + x2) / 2, y2, x2, y2))
        g.append('<circle cx="%d" cy="%d" r="2.5" fill="#8c8c8c"/>' % (x2, y2))
        if label: g.append('<text x="%d" y="%d" fill="#8c8c8c" font-size="10" text-anchor="middle">%s</text>' % ((x1 + x2) / 2, (y1 + y2) / 2 - 6, e(label)))
    # column 1 · the tree
    box(20, 20, 300, 600, 'THE TREE · CLOSE TIER · %s NAMES' % format(B1['counts']['computed_stocks'], ','),
        ['market → 11 sectors → 121 industries', '· every listed name, Geiger at the close',
         '· sectors sound: %d / 11 (7 ADRs make all 11)' % B1['verdicts']['sectors']['sound'], '· industries sound: %d / 121' % B1['verdicts']['industries']['sound'],
         '· → cohorts (adopted · proposed · fund sets)', '', 'A BRANCH IS A TAB WHEN', '· it is sound (≥ 8 read · se ≤ 0.10 · six closes)',
         '· and ≥ 8 of its names are LIVE', '', 'A BRANCH STAYS TREE-ONLY WHEN', '· it is sound but fewer than 8 names are live', '· read on the tree, sector compare, bow tie',
         '', 'feeds: cohort compare · sector compare', '      allocation (sector heat) · knockouts'])
    # column 2 · the board
    y = 20
    box(450, y, 300, 250, 'COHORT BOARD · TABS THAT STAY · %d' % len(tabs_sound), ['%s · %d → %d live' % (c['label'], c['t12_n'], c['after_live_n']) for c in tabs_sound] + ['', '· mean shown: sound on all six closes'])
    box(450, 290, 300, 190, 'BRANCHES THAT QUALIFY AS TABS · %d' % len(cand_tab), ['%s · %d live' % (c['label'], c['after_live_n']) for c in cand_tab] + ['', '· Alan marks which become tabs'])
    box(450, 500, 300, 120, 'TABS NOT SOUND TODAY · %d' % len(tabs_not), [', '.join(c['label'] for c in tabs_not[:4]), ', '.join(c['label'] for c in tabs_not[4:]), '', '· mean stays off (T12 · 07) until sound', '· the branch still reads on the tree'])
    # column 3 · lists + live hub
    box(880, 20, 280, 200, 'WATCH LISTS · ALWAYS LIVE', ['LIKED 144 · FAVORITES 58 · RADAR 17', '· 142 of the 590 are on a list; all stay live', '· a list name is live whatever its cohort', '· a list can pull a tree-only name live',
                                                        '· MY LISTS is a podium on the tree (T12)', '', 'BTCUSD · GCUSD: LIKED, not in the universe'])
    box(880, 250, 280, 180, 'LIVE HUB · %d NAMES' % ONE, ['%d today → %d' % (590, ONE), '· the 364 + the 56 bookmarks: stay', '· 41 of the 29 Sep batch stay (10 for cohorts)', '· 63 of the 29 Sep batch → close tier',
                                                       '· 66 Geiger-only funds → close tier', '· SKHY joins live tonight', '', 'publisher cycle ≈ %d s (today %d s)' % (L['cycle_s_at_recommended'], L['cycle_s_measured'])])
    box(880, 460, 280, 160, 'STORED FOR COMPS', ['every C5 peer of a Hub company', '· fundamentals · estimates · daily bars', '· no Geiger, no stream', '· %d leavers are peers → stored' % sum(1 for d in leaving if d['comps_peer_of']),
                                              '· analyst targets ride here (knockouts)'])
    arrow(320, 120, 450, 120, 'sound · ≥ 8 live')
    arrow(320, 380, 450, 380, 'sound · ≥ 8 live')
    arrow(320, 560, 450, 560, 'not sound')
    arrow(750, 140, 880, 300, 'tab rows live')
    arrow(750, 380, 880, 330)
    arrow(880, 80, 750, 80, 'list → live')
    arrow(1020, 430, 1020, 460)
    g.append('</svg>'); return ''.join(g)

# ---- page ----------------------------------------------------------------------------------------------------------------
def table(head, body, cls=''):
    return '<div class="wrap"><table class="%s"><thead><tr>%s</tr></thead><tbody>%s</tbody></table></div>' % (cls, ''.join('<th>%s</th>' % e(h) for h in head), ''.join('<tr>%s</tr>' % ''.join('<td%s>%s</td>' % (' class="w"' if isinstance(c, str) and len(c) > 60 else '', e(str(c))) for c in r) for r in body))
mark = '<span class="mark">keep · change · no</span>'
def mark_table(head, body):
    return '<div class="wrap"><table><thead><tr>%s<th>mark</th></tr></thead><tbody>%s</tbody></table></div>' % (''.join('<th>%s</th>' % e(h) for h in head), ''.join('<tr>%s<td>%s</td></tr>' % (''.join('<td%s>%s</td>' % (' class="w"' if isinstance(c, str) and len(c) > 60 else '', e(str(c))) for c in r), mark) for r in body))

P = []
P.append('''<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>U5b · what lives where</title>
<style>
:root{--bg:#0e0e0e;--panel:#141414;--line:#2a2a2a;--ink:#cfcfcf;--dim:#8c8c8c;--mute:#5a5a5a;--hi:#c4c7cb;--up:#3fb950;--dn:#e5484d}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:14px/1.5 -apple-system,Inter,Helvetica,Arial,sans-serif;padding:0 16px 60px}
main{max-width:1240px;margin:0 auto}h1{font-size:22px;font-weight:600;margin:28px 0 6px}h2{font-size:15px;letter-spacing:2px;text-transform:uppercase;color:var(--dim);margin:38px 0 10px;font-weight:600}h3{font-size:14px;margin:22px 0 6px}
p{max-width:920px;overflow-wrap:anywhere}.panel{background:var(--panel);border:1px solid var(--line);padding:10px;overflow-x:auto}svg{width:100%;height:auto;display:block;min-width:900px}
.tiles{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:10px;margin:14px 0}.tile{background:var(--panel);border:1px solid var(--line);padding:12px}.tile .n{font-size:26px;font-weight:600;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace}.tile .l{font-size:11.5px;color:var(--dim)}.tile.big .n{font-size:40px}
table{border-collapse:collapse;width:100%;font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace;font-size:11.5px;margin:8px 0 18px}th,td{border-bottom:1px solid var(--line);padding:4px 7px;text-align:left;white-space:nowrap;vertical-align:top}th{color:var(--dim);font-weight:500;letter-spacing:1px;text-transform:uppercase;font-size:11px}
td.w{white-space:normal;min-width:260px;max-width:620px}.wrap{overflow-x:auto;max-width:100%}.dim{color:var(--dim)}.mute{color:var(--mute)}.tag{font-size:11px;color:#bdbdbd;border:1px solid #3a3a3a;padding:0 4px}
.box{border:1px solid var(--line);background:var(--panel);padding:12px 16px;margin:12px 0;max-width:920px}ol,ul{max-width:920px}li{margin:6px 0;overflow-wrap:anywhere}
.mark{font-size:10.5px;color:#9a9ea3;border:1px solid #3a3a3a;padding:1px 6px;letter-spacing:1px}
.one{font-family:SF Mono,JetBrains Mono,ui-monospace,Menlo,monospace;font-size:64px;font-weight:600;line-height:1;color:#c4c7cb}
details.sc-pagespecs{margin-top:44px;border-top:1px solid var(--line);padding-top:10px;color:var(--dim);font-size:12.5px}details.sc-pagespecs summary{cursor:pointer;letter-spacing:2px;font-size:11px}
nav.toc a{color:#bdbdbd;margin-right:14px;font-size:12px;letter-spacing:1px;text-transform:uppercase;text-decoration:none}
</style></head><body><main>
<span data-scnav-slot></span><h1>What lives where — the tree down to cohorts, which names are on the Hub and which are off, and one number</h1>
<p class="dim">U5b · 5 Oct 2026 · branch hub/u5b-what-lives-where-20261005 · a decision package: nothing is applied, no table, list, universe or job is touched. Alan marks each line.</p>
<nav class="toc"><a href="#agree">the agreement page</a><a href="#tiers">1 · tiers</a><a href="#sound">2 · soundness</a><a href="#critique">3 · critique</a><a href="#tree">4 · tree → tabs</a><a href="#one">5 · the one number</a></nav>
''')
P.append('<div class="tiles">')
P.append('<div class="tile big"><div class="n">%d</div><div class="l">the recommended live-Hub size (today 590)</div></div>' % ONE)
P.append('<div class="tile"><div class="n">%d</div><div class="l">names leaving the live Hub · 66 Geiger-only funds + 63 of the 29 Sep batch · all to the close tier</div></div>' % C['leaving'])
P.append('<div class="tile"><div class="n">%d + %d</div><div class="l">joining: SKHY live tonight · 34 foreign listings to the close tier (B1)</div></div>' % (C['joining_live'], C['joining_close']))
P.append('<div class="tile"><div class="n">%d / 11 → 11</div><div class="l">sectors sound today → with the 7 ADRs at the close</div></div>' % B1['verdicts']['sectors']['sound'])
P.append('<div class="tile"><div class="n">%d + %d</div><div class="l">cohort tabs that stay sound + branches that qualify as tabs</div></div>' % (len(tabs_sound), len(cand_tab)))
P.append('<div class="tile"><div class="n">%d</div><div class="l">Chinese securities flagged as off-Hub candidates for later, in order; not moved here</div></div>' % len(chinese))
P.append('</div>')

# ---- THE AGREEMENT PAGE (first, as asked) ----
P.append('<h2 id="agree">The agreement page — leaving first, then joining, then what each tier keeps, then the number</h2>')
P.append('<p>Alan, you asked for one page you can mark. Every line below has a reason in words and says where the name\'s reading still lives once it is off the live Hub. Nothing on it is applied: the coordinator moves only what you mark <b>keep</b>.</p>')
P.append('<h3>A · Leaving the live Hub → the close tier · %d names</h3>' % C['leaving'])
P.append('<p class="dim">The 66 Geiger-only funds first (your call, 5 Oct: "we do not need 68 fund names on Hub" — the universe holds 66 of them today), then the 63 names of the 29 Sep batch that serve nothing live. Each keeps its Geiger at the close, its node on the tree and its place in the sector compare; a comps peer keeps its fundamentals and estimates.</p>')
P.append(mark_table(['name', '', 'kind', 'came in', 'why it leaves', 'where it still lives'],
    [(d['ticker'], d['name'][:38], d['kind'], '27 Sep funds' if d['batch'] == 'FUNDS66' else '29 Sep batch', why_short(d), still(d)) for d in funds + batch_leave]))
P.append('<h3>B · Joining · %d live · %d at the close</h3>' % (C['joining_live'], C['joining_close']))
P.append(mark_table(['name', 'tier', 'why'], [(j['ticker'], j['tier'], j['why']) for j in dec['joining']]))
P.append('<h3>C · Kept live only because a sound cohort needs them · %d names</h3>' % len(pulled))
P.append('<p>These ten are 29 Sep names on no list and in no fund\'s live set; they stay because the cohort named would stop being sound (fewer than 8 live names, or the names disagreeing) without them. If you do not want that cohort as a tab, they leave too and the number falls by as many.</p>')
P.append(mark_table(['name', '', 'kept for', 'comps'], [(t, byt[t]['name'][:40], ' / '.join(cs), 'peer of %d' % byt[t]['comps_peer_of']) for t, cs in pulled.items()]))
P.append('<h3>D · What each tier keeps</h3>')
P.append(table(['tier', 'what it keeps', 'how fresh', 'what it costs per name (measured)'], tiers_rows))
P.append('<h3>E · The one number</h3>')
P.append('<div class="box"><div class="one">%d</div><p>live names on the Hub (today 590): the 364 originals, the 56 bookmarks, 41 of the 29 Sep batch, and SKHY. Reasoning in part 5. %s</p></div>' % (ONE, mark))
P.append('<h3>F · Counts per tier, before → after</h3>')
P.append(table(['tier', 'before', 'after', 'what moved'], [
    ('LIVE HUB', 590, ONE, '− 66 funds − 63 batch names + SKHY'),
    ('CLOSE TIER (the tree, not live)', format(C['before']['CLOSE_tree_only'], ','), format(C['after']['CLOSE_tree_only'], ','), '+ 129 leavers + 34 foreign listings the close job does not read today'),
    ('STORED FOR COMPS, no Geiger', 0, 0, 'every comps peer is already on the tree, so the comps store is a subset of the close tier today; it becomes its own tier only for a peer outside the common-stock type'),
    ('ALL NAMES COMPUTED', format(B1['counts']['computed_stocks'], ','), format(B1['counts']['computed_stocks'] + 34 + 1, ','), '+ SKHY + 34'),
]))

# ---- 1 · tiers ----
P.append('<h2 id="tiers">1 · The tiers, by what each must serve</h2>')
P.append('<p>Three tiers, nested: a live name has everything the close tier has, and a close-tier name has everything the comps store has. The Hub tracks intraday better (your words), so the live tier is for what someone watches during the day: the lists, the cohort tabs, the funds whose line needs its names. The tree, the compares and allocation read the close tier, which costs a thousandth of a live name.</p>')
P.append(table(['tier', 'what it keeps', 'how fresh', 'what it costs per name (measured)'], tiers_rows))
P.append('<p class="dim">Measured where: the publisher\'s cycle from what it publishes (/geiger sampled every 20 s for 13 minutes; its log was not read — a permission refused to an earlier run stands); the scout\'s own cost block of 3 Oct (names asked, calls, bytes, seconds); the R2 bytes per width from U4b\'s read-only walk of 3 Oct; the database row counts from U4b\'s facts. Not measured: the stream\'s cost per symbol (one subscription per name on Massive\'s feed; the plan is flat) and the gatekeeper\'s per-minute refresh (Q2b: every minute, every name, intraday).</p>')

# ---- 2 · soundness ----
P.append('<h2 id="sound">2 · Soundness, sector → industry → cohort (your first question)</h2>')
P.append('<p>One rule at every level, T12\'s with B1\'s neighbour: at least 8 names read · standard error of the average at most 0.10 · held on each of the six closes 25 Sep – 2 Oct · and the names read carry at least 90 % of the market value that exists. "Live" is how many of its names are on the live Hub today. "Fix" names the biggest missing names and the tier they need — all of them the close tier; none needs the live Hub.</p>')
sound_body = []
for s in sorted(sectors, key=lambda s: s['label']):
    sound_body.append(sec_row(s)); sound_body += ind_rows(s)
P.append('<details open><summary class="dim">sectors and their industries · %d rows · click to fold</summary>' % len(sound_body))
P.append(table(['group', 'level', 'read / exist', 'live', 'value covered', 'std error', 'closes held', 'verdict', 'fix (names → tier) or why not'], sound_body))
P.append('</details>')
P.append('<h3>Alan\'s cohorts: the Hub\'s 17 tabs and T12\'s 39 candidates, before → after the moves</h3>')
P.append('<p>"n → live" is the cohort\'s members today → its live members after the moves. A sound cohort is re-tested on the six closes with only its live members; "→ thin after" marks the one that loses its sound mean (FUNDS, because the 66 funds leave — its reading moves to the tree\'s fund branches and the compare strip).</p>')
P.append(table(['cohort', 'where', 'members', 'n → live', '', 'std error', 'closes held', 'verdict', 'why not / what would fix it'],
    [coh_row(c) for c in sorted(cohorts, key=lambda c: (c['where'] != 'hub_tabs', not c['t12_sound'], -c['t12_n']))]))

# ---- 3 · critique ----
P.append('<h2 id="critique">3 · The critique — which of today\'s 590 live names serve nothing live</h2>')
P.append('<p>A name serves something live when it is on one of your lists, or a fund\'s live line needs it (U3\'s Hub point), or a sound cohort needs it to stay sound. Comps never need a name live: the comps field reads fundamentals, estimates and the daily bar, and the subject company is live anyway. Grouped by why each came in:</p>')
P.append('<div class="box"><b>27 Sep · your 56 bookmark names (admitted 24 Sep)</b> — stay FULL, all 56. %d are on a list; the rest you asked for by name.</div>' % sum(1 for d in bookmarks if d['lists']))
P.append('<div class="box"><b>The original 364</b> — stay, by your word of 3 Oct ("none of those"). %d of them were in U3\'s leaving list; they are not in this one.</div>' % sum(1 for d in dec['decision'] if d['batch'] == 'ORIGINAL364' and rows[d['ticker']]['u3'] in ('out', 'offhub · out')))
P.append('<div class="box"><b>27 Sep · the 66 Geiger-only funds</b> — off the live Hub, to the close tier: your call already. They sit on no tab today (the page hides a Geiger-only name except on a list, in search and on its page). Where their readings still live: every one is a fund node on the tree with its close Geiger; the 11 RSP funds feed the compare strip\'s EQUAL-WEIGHT family and the BOW TIE pair (RSPT − XLK …), which would then read at the close — see decision 1; the 11 iShares and 11 Vanguard sector funds feed the ISHARES and VANGUARD families of the same strip; the rest head a fund set on the tree.</div>')
P.append('<div class="box"><b>29 Sep · the 104-name batch (the State Street / admission v3 names)</b> — studied name by name: %d stay live (%d on a list, %d a fund\'s live-tracking name, %d kept only for a sound cohort), %d leave to the close tier. The leaving list is on the agreement page; the reasons per name are there.</div>' % (
    len(batch_stay), sum(1 for d in batch_stay if d['lists']), sum(1 for d in batch_stay if d['hub_point_funds'] and not d['lists']), len(pulled), len(batch_leave)))
P.append('<div class="box"><b>Chinese securities · %d</b> — off-Hub candidates "when we can do it with order" (your words, 3 Oct). Not moved by this package. The order that keeps things sound: XPEV and GDS are in the leaving list already (29 Sep batch, serve nothing live); BABA, JD and PDD are the WORLD cohort on the tree and C5 peers of AMZN and COST (stored for comps whatever happens); LI, NIO and EH are three of EVTOL AUTONOMY\'s ten; BIDU is on no list and in no sound cohort.</div>')
P.append(table(['name', '', 'on a list', 'cohorts', 'comps peer of', 'this package says'], [(d['ticker'], d['name'][:36], ', '.join(d['lists']) or '—', ', '.join(d['cohorts']) or '—', d['comps_peer_of'], d['tier_after']) for d in chinese]))
P.append('<h3>The 29 Sep names that stay live, and why</h3>')
P.append(table(['name', '', 'why it stays live', 'comps peer of'], [(d['ticker'], d['name'][:38], why_short(d), d['comps_peer_of']) for d in sorted(batch_stay, key=lambda d: -d['market_cap'])]))

# ---- 4 · tree → tabs ----
P.append('<h2 id="tree">4 · From the tree to the cohort board</h2>')
P.append('<p>Your design, 3 Oct: "the tree shows us the off-Hub Geiger-level stuff; by studying the tree, we decide what branches need to be tabs on the cohort board" — plus the watch lists. The diagram is the rule; the tables under it are today\'s result.</p>')
P.append('<div class="panel">' + diagram() + '</div>')
P.append('<h3>Tabs that stay · %d</h3>' % len(tabs_sound))
P.append(mark_table(['tab', 'members → live', 'std error', 'closes'], [(c['label'], '%d → %d' % (c['t12_n'], c['after_live_n']), '%.3f' % c['t12_se'], '%d / 6' % c['t12_closes']) for c in tabs_sound]))
P.append('<h3>Tabs that lose their sound mean because of the moves · %d</h3>' % len(tabs_lost))
P.append(mark_table(['tab', 'members → live', 'std error after (worst close)', 'closes held after', 'what happens'], [(c['label'], '%d → %d' % (c['t12_n'], c['after_live_n']), '%.3f' % c['after_worst']['se'], '%d / 6' % c['after_worst']['closes_pass'], 'the tab keeps its %d live funds, mean off until sound; the fund branches read on the tree and the compare strip' % c['after_live_n']) for c in tabs_lost]))
P.append('<h3>Branches of the tree that qualify as tabs today · %d</h3>' % len(cand_tab))
P.append('<p>Sound on the six closes with at least 8 live names after the moves. Five of them double an adopted cohort that already leads with that industry (T12 says so); the three without a tab today are PHARMA BIOTECH, BANKS - REGIONAL and DRUG MANUFACTURERS - GENERAL.</p>')
P.append(mark_table(['branch', 'where on the tree', 'members → live', 'std error', 'closes'], [(c['label'], c['t12_purity'] and ('%d%% one industry' % round(100 * c['t12_purity'])) or '—', '%d → %d' % (c['t12_n'], c['after_live_n']), '%.3f' % c['t12_se'], '%d / 6' % c['t12_closes']) for c in cand_tab]))
P.append('<h3>Tabs that are not sound today · %d</h3>' % len(tabs_not))
P.append(mark_table(['tab', 'members', 'why not', 'recommendation'], [(c['label'], c['t12_n'], '; '.join(c['t12_weak']), 'keep the tab, mean off until sound (T12 · 07); the branch reads on the tree') for c in tabs_not]))
P.append('<h3>Sound branches that stay tree-only · %d industries</h3>' % len(tree_only))
P.append('<p>Sound at market scale on the close tier, but fewer than 8 of their names are live: they are read on the tree and in the sector compare, not as a tab. Of the %d sound industries, %d have 8 or more live names and are listed above or already a tab.</p>' % (len(sound_inds), len(sound_inds) - len(tree_only)))
P.append(table(['industry', 'sector', 'read / exist', 'live after', 'std error'], [(i['label'], sl, '%d / %d' % (i['n_read'], i['n_exist']), ind_live.get(i['label'], 0), '%.3f' % i['se']) for sl, i in sorted(tree_only, key=lambda x: (x[0], -x[1]['n_read']))]))
P.append('<h3>How a watch list interacts</h3><ul><li>A list is a rule to be on the Hub: a name on LIKED, FAVORITES or RADAR is live whatever its cohort or batch. 142 of today\'s 590 are on a list; all stay. BTCUSD and GCUSD are on LIKED but are not in the equity universe (crypto and gold are their own lines).</li><li>A list can pull a tree-only name live: put it on a list and it joins the live tier at the next admission sitting — the one way a close-tier name comes up without a cohort decision.</li><li>On the tree, MY LISTS is a podium of its own (T12 · the lists via the Hub mirror), so a list reads at the close there and live on the board.</li></ul>')

# ---- 5 · the one number ----
P.append('<h2 id="one">5 · One recommended live-Hub size</h2>')
P.append('<div class="box"><div class="one">%d</div><ol>' % ONE)
P.append('<li><b>Lists are the rule.</b> 142 of the 590 are on your lists; every one stays live, and no list name is in the leaving list.</li>')
P.append('<li><b>Your words settle 486.</b> The 364 originals and the 56 bookmarks stay (3 Oct); the 66 Geiger-only funds leave (5 Oct). That is 420 live before the batch is judged.</li>')
P.append('<li><b>The 29 Sep batch, name by name:</b> 41 stay (31 on a list or a fund\'s live-tracking name, 10 held by MATERIALS, BANKS - REGIONAL and FINANCIAL - CREDIT SERVICES), 63 serve nothing live and go to the close tier, where %d of them are comps peers and keep everything comps needs.</li>' % sum(1 for d in batch_leave if d['comps_peer_of']))
P.append('<li><b>SKHY joins tonight</b> (60 sessions at today\'s close) → %d. The publisher\'s cycle falls from %d s to about %d s at 6 workers; the board\'s largest tab, BLUE CHIP, goes from 174 rows to 141; every tab that is sound today stays sound except FUNDS.</li>' % (ONE, L['cycle_s_measured'], L['cycle_s_at_recommended']))
P.append('<li><b>Comps and allocation do not need more live names.</b> Allocation reads the sector compare (your call, 5 Oct), which B1 computes from every listed name at the close; the 7 ADRs and 27 more foreign listings join the close tier and make all 11 sectors sound. Comps read the store. So the live Hub is sized by what you watch, not by what the models need.</li>')
P.append('</ol><p class="dim">One number, not a range. It is the result of the rule, not a target: if BANKS - REGIONAL and FINANCIAL - CREDIT SERVICES are not wanted as tabs, 7 more leave and the number is %d; if the 11 RSP funds stay live for the bow tie, it is %d.</p></div>' % (ONE - 7, ONE + 11))
P.append('<h3>Decisions for Alan (three, each with one recommendation)</h3><ol>')
P.append('<li><b>The bow tie pair.</b> RSPT − XLK and its ten siblings read the RSP funds live today. Off live, the pair reads the RSP side at the close. Recommendation: keep the 11 RSP funds live (the number becomes %d; their cost is 11 names); the other 55 funds leave.</li>' % (ONE + 11))
P.append('<li><b>The three branches without a tab</b> (PHARMA BIOTECH, BANKS - REGIONAL, DRUG MANUFACTURERS - GENERAL) qualify. Recommendation: make BANKS - REGIONAL and PHARMA BIOTECH tabs (both pure, both held six closes); DRUG MANUFACTURERS - GENERAL is 8 of PHARMA BIOTECH\'s 10 names and would double it.</li>')
P.append('<li><b>The Chinese nine.</b> Recommendation: leave them where this package puts them (XPEV and GDS to the close tier with the batch; the other seven stay) and take the rest off in one sitting after the tree\'s WORLD branch has 8 names of its own.</li></ol>')

# ---- page specs ----
P.append('''<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>What this page shows.</b> A decision package for the served set: three tiers, the soundness of every level of the tree, the names that serve nothing live, the branches that become tabs, one recommended number, and an agreement page to mark. Nothing on it is applied.</p>
<p><b>Where each number comes from.</b> The 590 and their tier roles: the chart API /universe of 3 Oct (sha 116c79f2…, unchanged on 5 Oct 15:40Z) through U4b's facts.json. Lists: LIKED = public.hub_favorites, FAVORITES and RADAR = public.station_lists, read 3 Oct 14:47Z. Batches: the provider's expansion batches (24 Sep 56 · 27 Sep 66 Geiger-only · 28/29 Sep 104). Fund live-tracking names (Hub point): U3's served-set-v2. Comps peers: C5 sets run over the 453 served companies (peer_of = how many sets keep the name). Cohorts and their six closes: T12's cohorts-measured.json and the close Geiger table 25 Sep – 2 Oct (613 tree names). Sectors and industries: B1's market-bowtie.json (5,564 computed names against 4,931 common stocks, 2 Oct close). Storage: U4b's read-only R2 walk (FULL object bytes per width). Close-tier cost: the seven-rung scout's own cost block of 3 Oct 00:17Z. Publisher cycle: /geiger read every 20 s on 5 Oct from 15:41Z (data/publisher-samples-20261005.txt); the gaps between consecutive new computed_utc values are the cycles, and the figure is their mean; a second chart-API machine served the older artifact between reads, which is why the samples alternate. Requests per live name per day = 7 rungs × (86,400 / cycle) cycles, since the publisher is always on (Q2b).</p>
<p><b>The rules.</b> Tier before = LIVE for all 590 (every served name is streamed and published, Geiger-only or not). Tier after: a Geiger-only fund → CLOSE (Alan, 5 Oct). An original or bookmark name → LIVE (Alan, 3 Oct). A 29 Sep name → LIVE if on a list or in a fund's live-tracking set, else CLOSE, then the cohort pass: for each cohort T12 found sound (tab or candidate), its live members are re-tested on each of the six closes (n ≥ 8, standard error ≤ 0.10); while it fails, the biggest leaving member of that cohort is pulled back live. A leaver that is a C5 peer is stored for comps. Chinese = reports in CNY (C5b's list) or profile country CN / HK (SIMO excluded by name: Taiwan). Joining: SKHY live (Alan, 5 Oct); B1's names_needed to the close tier. Soundness at every level = T12's rule plus B1's 90 % value-coverage neighbour; the cohort re-test uses only the first three parts because a cohort is its own definition (B1 says the same).</p>
<p><b>What could be wrong.</b> The cohort re-test uses the close Geiger, as T12 did, not the live one; a cohort that is sound at the close can still be noisy intraday. The six closes are one week; T12 and B1 said so too. The publisher's cycle is a few cycles of one morning, not an average over a day. "Serves nothing live" cannot see what Alan watches by eye without a list — a name he opens often but never liked would leave; the agreement page exists for that. Fund live-tracking sets are U3's of 2 Oct and would move with holdings. The 66 Geiger-only funds are the universe's count; Alan said 68.</p>
<p><b>What was not done.</b> Nothing applied, deployed or written to any table; no Fly machine started (every measurement came from artifacts already on branches or from the chart API's public reads); the publisher's log was not read (a permission refused to an earlier run is respected); no visible browser. Built by build-decision.py (the decision) and build-page.py (this page) in this folder; the data they read is in ./data.</p>
</details></main></body></html>''')
open(os.path.join(H, 'WHAT-LIVES-WHERE.html'), 'w').write('\n'.join(P))
print('wrote', len('\n'.join(P)), 'bytes; tabs stay', len(tabs_sound), 'cand', len(cand_tab), 'not sound', len(tabs_not), 'tree-only', len(tree_only), 'sound inds', len(sound_inds))
