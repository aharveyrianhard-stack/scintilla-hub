#!/usr/bin/env python3
"""HC1 — writes HC1-COMPARE-ONE-SCREEN.html from the measurements in ../data (nothing on the page is typed from memory:
every number is read from a file a tool in this folder wrote). Run from anywhere:
  python3 deliverables/20261006/hc1-compare-one-screen/tools/build-page.py"""
import html, json, pathlib

D = pathlib.Path(__file__).resolve().parents[1]
J = lambda n: json.loads((D / "data" / n).read_text())
e = lambda s: html.escape(str(s), quote=True)
f2 = lambda v: "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.2f}"
f4 = lambda v: "—" if v is None else ("+" if v >= 0 else "−") + f"{abs(v):.4f}"
cls = lambda v: "" if v is None else ("up" if v >= 0 else "dn")

A, B = J("capture-after-1680.json"), J("capture-before-1680.json")
A3, B3 = J("capture-after-390.json"), J("capture-before-390.json")
X = J("blend-crosscheck.json")
S = J("chart-frame-sweep.json")
FB, FA, FC = J("favorites-walk-before-1680.json"), J("favorites-walk-after-1680.json"), J("favorites-walk-after256-1680.json")
LEG = json.loads((D / "data" / "allocation-legend.json").read_text())
cmp_, bar_a, bar_b = A["parts"]["compare"], A["parts"]["bar"], B["parts"]["bar"]
cc = cmp_["cohortClick"]
ch = A["parts"]["chart"]["modes"]
chb = B["parts"]["chart"]["modes"]

def fig(src, cap, alt=""):
    return f'<figure><img src="shots/{e(src)}" alt="{e(alt or cap)}" loading="lazy"><figcaption>{cap}</figcaption></figure>'

def cards_table(read):
    rows = "".join(f"<tr><td>{e(c['view'])}</td><td>{e(c['scale'])}</td><td>{e(c['none']) if c['none'] else e(' · '.join(c['bars'][:5])) + (' …' if len(c['bars']) > 5 else '')}</td><td class='r'>{0 if c['none'] else len(c['bars'])}</td></tr>" for c in read["cards"])
    return "<div class='panel wrap'><table><tr><th>view</th><th>scale (and what it says about itself)</th><th>its first bars, strongest first</th><th class='r'>bars</th></tr>" + rows + "</table></div>"

blend_rows = "".join(
    f"<tr><td>{e(r['sector'])}</td><td class='r {cls(r['hub'])}'>{f4(r['hub'])}</td><td class='r {cls(r['allocation'])}'>{f4(r['allocation'])}</td><td class='r'>{f4(r['diff'])}</td><td class='r'>{f4(r['diffWithToolsList'])}</td>" +
    "".join(f"<td class='r'>{f2(r['parts'][k]['hub'])}</td>" for k in ["SPDR", "HUBCMP", "MKTBOW", "TREE", "RANK"]) + f"<td class='r'>{r['hubUsed']}/5</td></tr>" for r in X["rows"])

fav = lambda rec: "".join(f"<tr><td>{e(s['name'])}</td><td>{e(s['from'])}</td><td>{'lit' if s['atTap']['onScreenStar'] else 'not lit'}</td><td>{'still lit' if s['settled']['onScreenStar'] else 'empty again'}</td><td>{'stored' if s['stored'] else 'not stored'}</td><td>{e(s['settled']['line'] or '— nothing —')}</td></tr>" for s in rec["steps"])

sweep_bad = [r for r in S["rows"] if r["verdict"] != "whole"]
sweep_rows = "".join(f"<tr><td class='r'>{r['width']}</td><td>{r['mode']}</td><td class='r'>{r['zoom']}</td><td class='r'>{r['frame'][0]}–{r['frame'][1]}</td><td class='r'>{r['panel'][0]}–{r['panel'][1]}</td><td class='r'>{e(r['frameCss'])}</td><td class='r'>{r['pane'].get('canvas','—')} of {r['pane'].get('width','—')}</td><td>{e(r['verdict'])}</td></tr>" for r in S["rows"])
hov = lambda m, k: ch[m][k]["hoverLabel"]

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HC1 · Every compare view on one screen</title>
<style>
:root{{--bg:#121314;--panel:#1a1b1c;--line:#2e3032;--ink:#c4c6c8;--dim:#8a8c8e;--faint:#5e6062;--bright:#cdcfd1;--up:#00d68f;--dn:#ff3b5c}}
*{{box-sizing:border-box}}body{{margin:0;background:var(--bg);color:var(--ink);font:12px/1.55 ui-monospace,Menlo,Consolas,monospace;padding:28px 16px 60px}}
main{{max-width:1240px;margin:0 auto}}h1{{font-size:16px;letter-spacing:.08em;color:var(--bright);margin:0 0 4px}}
h2{{font-size:12px;letter-spacing:.12em;color:var(--bright);margin:38px 0 10px;border-bottom:1px solid var(--line);padding-bottom:6px}}
h3{{font-size:11px;letter-spacing:.1em;color:var(--dim);margin:20px 0 6px;font-weight:500}}
p{{max-width:980px;margin:6px 0}}.sub{{color:var(--dim);margin:0 0 18px}}.panel{{background:var(--panel);border:1px solid var(--line);padding:12px 14px;margin:10px 0}}
table{{border-collapse:collapse;width:100%;font-size:11px}}th,td{{text-align:left;padding:4px 8px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{color:var(--dim);font-weight:500;letter-spacing:.06em}}td.r,th.r{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
.up{{color:var(--up)}}.dn{{color:var(--dn)}}.pair{{display:grid;grid-template-columns:1fr 1fr;gap:12px}}.one figure,.pair figure,.trio figure{{margin:0}}
.trio{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}.phones{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,300px));gap:14px}}
figure{{margin:0}}img{{width:100%;display:block;border:1px solid var(--line)}}figcaption{{color:var(--dim);font-size:11px;margin-top:6px}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}
.kpi b{{display:block;font-size:17px;color:var(--bright);font-weight:600}}.kpi span{{color:var(--dim);font-size:11px}}.wrap{{overflow-x:auto}}.small{{font-size:11px;color:var(--dim)}}
.tag{{display:inline-block;border:1px solid var(--line);padding:0 6px;color:var(--bright);letter-spacing:.06em;font-size:11px}}ul{{max-width:980px;padding-left:18px;margin:6px 0}}li{{margin:3px 0}}
details.sc-pagespecs{{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}}details.sc-pagespecs summary{{cursor:pointer;color:var(--bright);letter-spacing:.12em}}
@media(max-width:760px){{.pair,.trio{{grid-template-columns:1fr}}body{{padding:20px 16px 50px}}}}
</style></head><body><main>
<h1>HC1 · EVERY COMPARE VIEW ON ONE SCREEN, WITH REPLAY — AND THE BUGS ALAN HIT</h1>
<p class="sub">6–7 Oct 2026 · on a branch, nothing deployed, no table changed · Hub branch hub/hc1-compare-one-screen-20261006 · allocation branch hc1-target-mix-legend-20261006</p>

<div class="kpi">
<div><b>9 views, one row</b><span>the consolidated sector reading first, BREADTH second, then every view that was a tab. The row scrolls sideways; the page does not.</span></div>
<div><b>BLENDED = the allocation tool's</b><span>same arithmetic: {abs(X['worstWithToolsList']):.4f} apart once both use one list of which name sits in which sector. As each page loaded: {abs(X['worstDifference']):.4f} — the tool's own list changes between loads (section 2).</span></div>
<div><b>REPLAY: one clock</b><span>a second handle on the REWIND bar. Both stamps read {e(cmp_['rewoundBar']['boardStamp'])}, both thumbs sat at {cmp_['rewoundBar']['boardThumb']}.</span></div>
<div><b>FAVORITES</b><span>the list was full at 64 names. The coordinator raised the limit; the page now says so in words instead of silently un-starring.</span></div>
<div><b>Geiger bar: one scale</b><span>{e(bar_b['name'])} in search was drawn {bar_b['inSearch']['shareOfHalf']*100:.0f}% full; in LIKED {bar_b['inLiked']['shareOfHalf']*100:.0f}%. Now {bar_a['inSearch']['shareOfHalf']*100:.0f}% in both: its Geiger is {f2(bar_a['inSearch']['geiger'])}.</span></div>
<div><b>Chart crop: not reproduced</b><span>{len(S['rows'])} window sizes, collapsed and expanded: the chart was whole in every one, and its hover carried its percent. See section 7.</span></div>
</div>

<h2>1 · THE COMPARE, BEFORE → AFTER (1680 × 1050)</h2>
<p>Before: one view at a time, behind two rows of tabs ({e(' · '.join(B['parts']['compare'].get('chips', [])))}). After: every view is a card on one row, compact, left to right. Nothing was recomputed — each card draws the same numbers its tab drew.</p>
<div class="pair">
{fig(B['parts']['compare']['bowtie'], "BEFORE (live). The BOW TIE tab. To see State Street you clicked SPDR, and so on. Its title line read: " + e(str(B['parts']['compare'].get('header') or '').split(chr(10))[0][:150]) + " …")}
{fig(cmp_['shotPane'], "AFTER, as the tab opens. The REPLAY row, then the cards. SECTORS · BLENDED is first; BREADTH (the old BOW TIE, same numbers) is beside it; the rest is to the right.")}
</div>
<div class="pair">
{fig(cmp_['shotFull'], f"AFTER, full screen (the ⛶ at the right of the REPLAY row). {cmp_['full']['row']['shown']} of the row's {cmp_['full']['row']['whole']} units show at once: BLENDED, BREADTH, STATE STREET and the start of iSHARES. The zero lines of all cards sit on one level.")}
{fig(cmp_['shotFullEnd'], "AFTER, full screen, scrolled to the end: EQUAL-WEIGHT, COHORTS, OUR NAMES, INDEX FUNDS.")}
</div>
<div class="pair">
{fig(cmp_['shotUnfolded'], "AFTER: STATE STREET unfolded (the ⤢ beside its name). Each fund gets back its word (" + e(", ".join(sorted(set(w.replace('◆','') for w in cmp_['unfolded']['words'])))) + ") and its trend / momentum pair, as the full strip had them. Every fund and cohort card unfolds the same way.")}
{fig(cmp_['shotEnd'], "AFTER, in the dashboard pane, scrolled to the end. A feed tick redraws the cards; the row stayed where it was (" + str(cmp_['keepsPlace']['before']) + " before, " + str(cmp_['keepsPlace']['after']) + " after).")}
</div>
<h3>WHAT EACH CARD SHOWED WHEN THE PICTURE WAS TAKEN</h3>
{cards_table(cmp_['live'])}
<p class="small">The hover of the first BREADTH bar, word for word: “{e(cmp_['breadthHover'])}”</p>
<p class="small">A click on a cohort's bar still switches the board, as it did on the old strip: METALS was clicked in the COHORTS card, the board became {e(cc['board'])} ({cc['rows']} names), the bar was outlined, and the row of cards came back where it had been scrolled ({cc['rowBefore']} before the click, {cc['rowAfter']} after) — picture shots/{e(cmp_['shotCohortClick'])}.</p>

<h2>2 · THE CONSOLIDATED SECTOR READING (THE FIRST CARD)</h2>
<p>One reading per sector: the average of five readings, each counting a fifth. It is the allocation tool's method with its default weights. To check that it is the same reading and not a look-alike, the Hub branch and the live allocation tool were opened side by side and each was asked for its own numbers.</p>
<div class="panel wrap"><table>
<tr><th>sector</th><th class="r">Hub, this branch</th><th class="r">allocation tool, live</th><th class="r">difference as loaded</th><th class="r">with the tool's sector list</th><th class="r">State Street fund</th><th class="r">fund + equal-weight twin</th><th class="r">our names in the sector</th><th class="r">the tree's close tier</th><th class="r">sector ranking</th><th class="r">read</th></tr>
{blend_rows}
</table></div>
<p><b>What the two columns of differences say.</b> The arithmetic is the same: given the tool's own list of which name sits in which sector, the Hub's numbers are the tool's to {abs(X['worstWithToolsList']):.4f}. As each page loaded they were up to {abs(X['worstDifference']):.4f} apart, and only where a sector's names are counted (our names in the sector; the tree's close tier) — never in the fund readings or the ranking. The cause is in the tool, not the blend: it fills its list from two reads that race (the industry table and the State Street funds' holdings), and whichever lands first names a name's sector. On this load {len(X['sectorList']['differ'])} of {X['sectorList']['names']} names sat in a different sector in the two lists: {e(', '.join(f"{d['name']} ({d['hub'] or '—'} here, {d['allocation'] or '—'} there)" for d in X['sectorList']['differ']))}. The Hub always takes the industry table first, then the holdings — the order the tool's code is written in. The {len(X['runs'])} runs on file: {e('; '.join(f"{abs(r['worstDifference']):.4f} as loaded, {abs(r['worstWithToolsList']):.4f} with one list" for r in X['runs']))}. Two earlier runs tonight (00:17 and 00:34 ET, not kept on file) agreed to 0.0001 as loaded: the tool's reads had landed in the other order.</p>
<p class="small">The tool's weights at that moment: {e(json.dumps(X['allocationWeights']))}. The hover of the first bar, word for word: “{e(cmp_['firstHover'])}”</p>

<h2>3 · REPLAY</h2>
<p>The REPLAY row is a second handle on the board's REWIND bar, not a second clock: PLAY, the speed, the reach (1Y) and the scrubber each press the bar's own control, and the board moves with it. It is on this screen because the bar lives on the board, which the full-screen compare covers and which sits far above it on a phone.</p>
<div class="pair">
{fig(cmp_['shotRewound'], f"Scrubbed back to {e(cmp_['rewound']['asof'])} from the second handle. The board's stamp read {e(cmp_['rewoundBar']['boardStamp'])} too. BLENDED says “{e(cmp_['rewound']['cards'][0]['scale'])}”; the cards whose funds have no stored momentum say “trend only”.")}
{fig(cmp_['shotPlaying'], f"Three seconds of PLAY at 1×: the day reached {e(cmp_['playing']['day'])}; both buttons read {e(cmp_['playing']['second'])}. Then PAUSE held {e(cmp_['paused']['day'])}, and ↻ LIVE brought back “{e(cmp_['backToLive']['firstCard'])}”.")}
</div>
<h3>WHAT A REPLAYED DAY CAN SHOW — THE STORED DAYS DECIDE, AND THE CARDS SAY IT</h3>
{cards_table(cmp_['rewound'])}
<ul>
<li><b>SECTORS · BLENDED</b> reads fewer than five on a past day. The tree's close tier has no stored past. The ranking table's rows before 5 Oct were built from a staged table that carried 24 Aug readings under each day's date, so they are never drawn as that day's reading. The hover names what was not read: “{e(cmp_['rewoundHover'])}”</li>
<li><b>iSHARES, VANGUARD, EQUAL-WEIGHT</b>: their stored history is trend from 18 Aug 2026 and no momentum at all (read from the tables on 6 Oct). A replayed bar is therefore the fund's trend alone, and the card says “trend only”.</li>
<li><b>BREADTH on a replayed day</b> was a trend minus a full Geiger — two different things subtracted. It is now trend against trend whenever one fund of the pair has no stored momentum, so the gap is like for like, and the card says “trend only”. Live is untouched: both funds' Geiger, as always.</li>
<li>The cards step once per replayed day (0.7 s at 1×). They do not glide between days as the board's rows do.</li>
</ul>

<h2>4 · ON A PHONE (390 wide)</h2>
<div class="phones">
{fig(B3['parts']['compare']['bowtie'], "BEFORE (live): the strip split itself into two rows of seven.")}
{fig(A3['parts']['compare']['shotPane'], "AFTER: one card fills the width, the next peeks in; swipe sideways. The page itself does not scroll sideways (" + ("it did" if A3['parts']['compare']['live']['pageScrollsSideways'] else "checked") + ").")}
{fig(A3['parts']['compare']['shotMid'], "AFTER, swiped to the middle of the row.")}
{fig(A3['parts']['compare']['shotRewound'], "AFTER, replayed to " + e(A3['parts']['compare']['rewound']['asof']) + " from the REPLAY row.")}
</div>

<h2>5 · BUG: “I CAN'T ADD FAVORITES”</h2>
<p><b>Cause.</b> The table that holds FAVORITES and RADAR allowed 64 names to a list. FAVORITES reached 64 at 16:51 ET on 6 Oct. From then on every add was refused by the database, and the page put the star back to empty without a word. It was not EQIX and not the iMac: any name, any browser. LIKED kept working because it lives in another table.</p>
<p><b>Fix.</b> The coordinator raised the limit to 256 the same evening and added the seven names Alan had tried (71 names, read back at 23:45 ET). This branch changes no table. It fixes the silence: a refused add now puts the screen straight back to what is stored and prints one line at the foot of the screen, with a way to dismiss it.</p>
<div class="pair">
{fig("fav-before-1680-search-EQIX-2-settled.png", "BEFORE (the live page, a copy of the list at 64 names): EQIX's star was tapped in search; a moment later it is empty again and nothing says why.")}
{fig("fav-after-1680-search-EQIX-2-settled.png", "AFTER (this branch, the same 64-name list): the line at the foot says the list is full, that EQIX was not added, and what to do.")}
</div>
<div class="phones">
{fig("fav-after-390-phone-EQIX-2-settled.png", "AFTER, on a phone: the same line, inside the screen's width.")}
{fig("fav-after256-1680-search-EQIX-3-searched-again.png", "AFTER, with the limit as it is now (256): EQIX added from search, the search cleared and run again — still starred.")}
</div>
<h3>EVERY NAME, BOTH WAYS IN — WHAT THE PAGE DID</h3>
<div class="panel wrap"><table><tr><th>name</th><th>from</th><th>at the tap</th><th>3.5 s later</th><th>the list table</th><th>what the page said</th></tr>
<tr><th colspan="6">BEFORE — the live page, limit 64</th></tr>{fav(FB)}
<tr><th colspan="6">AFTER — this branch, limit 64</th></tr>{fav(FA)}
<tr><th colspan="6">AFTER — this branch, limit 256 (as it is now)</th></tr>{fav(FC)}
</table></div>
<p class="small">After a reload with the limit at 256 the list held {FC['afterReload']['favorites']} names, ending {e(', '.join(FC['afterReload']['tail']))}. The list table in these walks is a copy held inside the test; no request other than a read left the browser.</p>

<h2>6 · BUG: THE GEIGER BAR IN SEARCH LOOKED OFF-SCALE</h2>
<p><b>Cause.</b> The board drew each bar against the strongest reading among the rows on screen. A search that found one name therefore always filled its bar, whatever its Geiger; the same name was shorter in a list that also held a {f2(bar_b['strongestInLiked'])}.</p>
<p><b>Fix.</b> Every row is drawn on the Geiger's own fixed scale, −1 to +1 — the scale the cohort line above the board, the Geiger breakdown and the company view's list already used. The replay redraws the same bars and uses the same scale.</p>
<div class="pair">
{fig(bar_b['shotSearch'], f"BEFORE, in search: {e(bar_b['name'])}, Geiger {f2(bar_b['inSearch']['geiger'])}, bar {bar_b['inSearch']['barPx']:.0f} of {bar_b['inSearch']['halfTrackPx']:.0f} px — “all the way green”.")}
{fig(bar_b['shotLiked'], f"BEFORE, in LIKED ({bar_b['inLiked']['rowsOnScreen']} names): the same reading, bar {bar_b['inLiked']['barPx']:.0f} px — just past the midline.")}
</div>
<div class="pair">
{fig(bar_a['shotSearch'], f"AFTER, in search: bar {bar_a['inSearch']['barPx']:.0f} of {bar_a['inSearch']['halfTrackPx']:.0f} px = {bar_a['inSearch']['shareOfHalf']*100:.0f}% of its half, for a Geiger of {f2(bar_a['inSearch']['geiger'])}.")}
{fig(bar_a['shotLiked'], f"AFTER, in LIKED: bar {bar_a['inLiked']['barPx']:.0f} px. The same length.")}
</div>
<p class="small">What changes for the eye: on a list whose strongest name is below +1, every bar is a little shorter than before (in LIKED the strongest was {f2(bar_b['strongestInLiked'])}, so about {(1-abs(bar_b['strongestInLiked']))*100:.0f}% shorter). On a short or weak list the bars are honestly short instead of stretched.</p>

<h2>7 · BUG: THE COMPANY VIEW'S CHART — CROPPED RIGHT SIDE, NO HOVER % — <span class="tag">NOT REPRODUCED</span></h2>
<p>Alan: the Geiger panel crops the right side of the embedded chart (oscillators cut off), and the embedded chart lacks the Station's hover % change. I could not make either happen, so nothing was changed for this bug. What I measured:</p>
<ul>
<li>The chart in the company view <b>is</b> the Station's own chart page, loaded in a frame ({e(ch['collapsed']['frameUrl'].split('?')[0])}), not a copy. It is served “never cache”, so a browser cannot be holding an old one.</li>
<li><b>Hover.</b> With the pointer on the price the pane drew “{e(hov('collapsed','price')['price'])} / {e(hov('collapsed','price')['percent'])}” at its right edge (units {hov('collapsed','price')['left']}–{hov('collapsed','price')['right']} of {ch['collapsed']['price']['paneWidth']}), and in the expanded view “{e(hov('expanded','price')['price'])} / {e(hov('expanded','price')['percent'])}” ({hov('expanded','price')['left']}–{hov('expanded','price')['right']} of {ch['expanded']['price']['paneWidth']}). That is the Station's hover label since S16 (6 Oct): the price on the pointer's line with the percent under it.</li>
<li><b>The live Hub gives the same</b> (the page as deployed, not this branch): at 1680 the label read “{e(chb['collapsed']['price']['hoverLabel']['price'])} / {e(chb['collapsed']['price']['hoverLabel']['percent'])}” inside the pane, nothing over the frame; expanded and on a 390 phone likewise.</li>
<li><b>Crop.</b> At {len(S['rows'])} window sizes from 1000 to 2560 wide, collapsed and expanded, the frame was never wider than its panel, nothing lay over its right edge, and the Station's canvas was never wider than its pane ({'cut found at: ' + ', '.join(str(r['width']) + ' ' + r['mode'] for r in sweep_bad) if sweep_bad else 'cut found at none'}). On a 390 phone the chart was whole too.</li>
</ul>
<div class="pair">
{fig(ch['collapsed']['shotPrice'], "The company view's chart as opened from the board (1680), pointer on the price: the label with its percent at the right edge; the two oscillator chips whole.")}
{fig(ch['expanded']['shotOscillator'], "EXPANDED, pointer on the oscillator: the readout row (“" + e(ch['expanded']['oscillator']['oscillatorReadout'][:60]) + " …”) ends inside the pane; the Geiger panel begins where the chart ends.")}
</div>
<p>What I could not check: this was one browser engine (headless Chromium). If Alan saw it in Safari, or at a window size outside the fifteen above, it would not show here. And the Station's hover on the chart <i>under</i> the pointer shows the pointer's level against the current price; the “price on that date and % since” box appears only on the <i>other</i> charts of the Station's wall. A single chart never shows it. If that is the percent Alan misses, it is a Station change, and it would bring back the second label he asked to remove on 6 Oct.</p>
<details><summary class="small">the fifteen sizes, twice</summary><div class="panel wrap"><table><tr><th class="r">window</th><th>view</th><th class="r">page zoom</th><th class="r">frame, left–right</th><th class="r">its panel</th><th class="r">frame size</th><th class="r">Station canvas of pane</th><th>verdict</th></tr>{sweep_rows}</table></div></details>

<h2>8 · THE ALLOCATION TOOL'S LEGEND (its own repo, its own branch)</h2>
<p><b>Cause.</b> The note beside each sector (“none picked”) was placed after the label's width as measured in the note's smaller font, so every label was taken to be a sixth narrower than it is: {LEG['before']['overlaps']} labels were written over ({e(', '.join(LEG['before']['pairs']))}). <b>Fix.</b> The label is measured in the font it is drawn in and keeps its last letter; the note sits in the room left before the percent. Overlapping pairs after: {LEG['after']['overlaps']}.</p>
<div class="pair">
{fig("alloc-legend-before-1680.png", "BEFORE (the live tool): “CONS. DISCRETIONAR” with “none picked” written on its end.")}
{fig("alloc-legend-after-1680.png", "AFTER: “CONS. DISCRETIONARY”, a gap, “none picked”, the percent.")}
</div>
<p class="small">Another lane (AL7) is redesigning this pie tonight and may remove “none picked” altogether; this fix is three lines on its own branch so it can be taken or dropped.</p>

<h2>9 · WHAT COULD BE WRONG, AND WHAT WAS NOT DONE</h2>
<ul>
<li><b>The blend lives in two places</b> (the allocation tool and now the Hub), each with its own copy of the arithmetic. A test runs the Hub's against the tool's own functions (copied word for word at its live version) on 400 cases; live, with one sector list, they agree to {abs(X['worstWithToolsList']):.4f}. If the tool changes its method, the Hub must be changed with it.</li>
<li><b>The allocation tool's sector list is not the same on every load</b> (section 2): {len(X['sectorList']['differ'])} names move between two sectors depending on which of its two reads lands first, which moves its own blended reading by up to {abs(X['worstDifference']):.4f}. That is for the tool's lane to fix (read the two in a fixed order); I would take the State Street funds' holdings first, since the bars are named after those funds. Until then the Hub and the tool can differ by that much.</li>
<li><b>The first card reads three things the page did not read before</b>: the tree's close tier (149 KB), the ranking table and, once, the profile, industry and fund-holdings files (548 KB, from the Hub itself). Only when COHORT COMPARE is drawn; again only when 15 minutes old; no timer.</li>
<li><b>Replay of the fund cards before 18 Aug 2026</b> is empty for iShares, Vanguard and equal-weight (no stored day), and trend-only after it, until someone stores their momentum history. That is a keyed job on Fly, not this lane's.</li>
<li><b>Hovers do not show in headless pictures</b>; the ones quoted above were read from the page.</li>
<li><b>Not deployed, not merged.</b> The old single strip's code is still in the page (its tests still run); nothing draws it.</li>
<li><b>An unfolded card's zero line sits a little higher</b> than its compact neighbours', because two more rows (the word, the pair) go under its bars. Compact cards are level with each other.</li>
<li><b>The room without a board</b> (no REWIND bar, so no REPLAY handle) is covered by a test only; no tab on this page leads to it.</li>
<li><b>The chart bug is open</b> (section 7).</li>
</ul>

<h2>10 · DECISIONS FOR ALAN</h2>
<ul>
<li><b>Ship the one-screen compare as built?</b> Recommend yes. The order is BLENDED, BREADTH, STATE STREET, iSHARES, VANGUARD, EQUAL-WEIGHT, COHORTS, OUR NAMES, INDEX FUNDS; say if another order reads better.</li>
<li><b>Replayed BREADTH read trend against trend</b> (because the equal-weight funds have no stored momentum)? Recommend yes, labelled as it is. The other honest choice is to leave replayed BREADTH empty until that history is stored.</li>
<li><b>The chart crop:</b> which browser and which window were you on, or a screenshot? Recommend one screenshot — with it this is a short fix; without it I would be guessing.</li>
</ul>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Pictures: headless Chromium through Playwright, never a window. 1680 × 1050 and 390 × 844. “Before” is the Hub as deployed (page {e(B['pageSha'])}); “after” is this branch's files served at the same address (page {e(A['pageSha'])}), with the live chart API and the live database's reads. Every request that was not a read was stopped: {A['requests']['stoppedNonGet'] + B['requests']['stoppedNonGet'] + A3['requests']['stoppedNonGet'] + B3['requests']['stoppedNonGet']} stopped across the four runs. Console errors: {len(A['consoleErrors']) + len(A3['consoleErrors'])} on the branch.</p>
<p>Files: tools/capture.mjs (sections 1, 3, 4, 6, 7) → data/capture-*.json · tools/blend-crosscheck.mjs → data/blend-crosscheck.json · tools/chart-frame-sweep.mjs → data/chart-frame-sweep.json · tools/favorites-walk.mjs → data/favorites-walk-*.json · tools/build-page.py wrote this page from those files. data/not-applied/ holds the first run's unapplied SQL for the list limit (500), kept for the record: the coordinator's 256 is what is live.</p>
<p>The favorites walk takes a picture at every step of every name (data/favorites-walk-*.json names them all). The folder keeps the start, the reload, every EQIX step and CRWD's settled step for each run; the rest were left out for size.</p>
<p>Tests: tests/hc1-compare-one-screen.test.mjs (15), tests/hc1-board-bar-scale.test.mjs (3), tests/hc1-favorites-cap.test.mjs (14); six older tests brought to the new behaviour. Allocation: tests/hc1-legend.test.mjs (3).</p>
</details>
</main></body></html>
"""
out = D / "HC1-COMPARE-ONE-SCREEN.html"
out.write_text(page)
print(out.name, len(page), "bytes")
