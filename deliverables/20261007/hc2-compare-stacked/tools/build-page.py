#!/usr/bin/env python3
"""HC2 — writes HC2-COMPARE-STACKED.html from the measurements in ../data (nothing on the page is typed from memory:
every number is read from a file tools/capture.mjs wrote). Run from anywhere:
  python3 deliverables/20261007/hc2-compare-stacked/tools/build-page.py"""
import hashlib, html, json, pathlib

D = pathlib.Path(__file__).resolve().parents[1]
REPO = D.parents[2]
J = lambda n: json.loads((D / "data" / n).read_text())
e = lambda s: html.escape(str(s), quote=True)

B, A = J("capture-before-1680.json"), J("capture-after-1680.json")
B3, A3 = J("capture-before-390.json"), J("capture-after-390.json")
A14, A12, AW = J("capture-after-1440.json"), J("capture-after-1280.json"), J("capture-after-1680x940.json")
AFTER = [("1680 × 1050", A), ("1440 × 900", A14), ("1280 × 800", A12), ("390 × 844 (phone)", A3)]
S, SB, S3 = A["steps"], B["steps"], A3["steps"]
page_sha = hashlib.sha256((REPO / "index.html").read_bytes()).hexdigest()[:12]

def fig(src, cap):
    return f'<figure><img src="shots/{e(src)}" alt="{e(cap)}" loading="lazy"><figcaption>{cap}</figcaption></figure>'

names = lambda xs: ", ".join(xs)
card0 = lambda step: step["cards"][0]
laid = lambda j: [(k, v) for k, v in j["steps"].items() if isinstance(v, dict) and isinstance(v.get("sideways"), dict)]   # the states read whole (one card's own figure is a number)
STATE = {"opens": "as it opens", "oneScreenDown": "one screen down", "atTheEnd": "at the end", "unfolded": "State Street unfolded", "replayed": "replayed four weeks back",
         "replayedScrolled": "replayed, scrolled down", "fullScreen": "full screen", "fullScreenUnfolded": "full screen, unfolded", "optionFour": "the four-card option"}

# ── every number on every card, before (the Hub as deployed) and after (this branch), read in the same minute ──────────
def numbers(b, a):
    same = total = 0; rows = []; moved = []
    for cb, ca in zip(b["numbers"], a["numbers"]):
        assert cb["view"] == ca["view"]
        pairs = list(zip(cb["bars"], ca["bars"])); eq = sum(1 for x, y in pairs if x == y)
        total += len(pairs) + 1; same += eq + (1 if cb["scale"] == ca["scale"] else 0)
        moved += [f"{cb['view']}: {x} → {y}" for x, y in pairs if x != y] + ([f"{cb['view']} scale: {cb['scale']} → {ca['scale']}"] if cb["scale"] != ca["scale"] else [])
        rows.append((cb["view"], cb["scale"], ca["scale"], len(pairs), eq, " · ".join(ca["bars"][:4])))
    return same, total, rows, moved
same, total, num_rows, moved = numbers(B, A)
same3, total3, _, moved3 = numbers(B3, A3)
num_table = "".join(f"<tr><td>{e(v)}</td><td>{e(sb)}</td><td>{e(sa)}</td><td class='r'>{eq} of {n}</td><td>{e(first)} …</td></tr>" for v, sb, sa, n, eq, first in num_rows)

# ── how thin: one row per screen ────────────────────────────────────────────────────────────────────────────────────
def thin_row(label, j):
    o = j["steps"]["opens"]; one = [c for c in o["cards"] if c["rowsOfBars"] == 1]; two = [c for c in o["cards"] if c["rowsOfBars"] == 2]
    c = one[0]
    extra = f" · {names(x['view'] for x in two)}: {two[0]['h']} px (two rows of bars)" if two else ""
    return (f"<tr><td>{e(label)}</td><td class='r'>{o['list']['h']} px</td><td class='r'>{c['h']} px{e(extra)}</td><td class='r'>{c['shareOfListHeight'] * 100:.1f} %</td>"
            f"<td class='r'>{c['barTrackH'] // 2} px</td><td>{len(o['cardsFullyShown'])} whole{(' + part of ' + names(o['cardsPartlyShown'])) if o['cardsPartlyShown'] else ''}</td></tr>")
thin_rows = "".join(thin_row(l, j) for l, j in AFTER) + thin_row("1680 × 940 (a browser window with its toolbar)", AW)
bc, ac = card0(SB["opens"]), card0(S["opens"])
four, fourW = S["optionFour"], AW["steps"]["optionFour"]

# ── no sideways scroll: every width, every state, every level ───────────────────────────────────────────────────────
side_head = "".join(f"<th class='r'>{e(STATE.get(k, k))}</th>" for k, _ in laid(A) if k != "optionFour")
def side_row(label, j):
    cells = "".join(f"<td class='r'>{sum(v['sideways'].values())}</td>" for k, v in laid(j) if k != "optionFour")
    return f"<tr><td>{e(label)}</td>{cells}</tr>"
side_rows = "".join(side_row(l, j) for l, j in AFTER + [("1680 × 940", AW)])
levels = names(S["opens"]["sideways"].keys())
cut_any = sorted({t for _, j in AFTER + [("", AW)] for _, v in laid(j) for t in v["cutLabels"]})
cut_before3 = sorted({t for _, v in laid(B3) for t in v["cutLabels"]})        # what the live row cuts short on a phone
moved_px = sorted({abs(j["steps"][k]["replayBarMovedPx"]) for _, j in AFTER for k in ("oneScreenDown", "atTheEnd", "replayedScrolled")})
errs = sum(len(j["consoleErrors"]) for j in [B, B3, AW] + [j for _, j in AFTER]); stopped = sum(j["requests"]["stoppedNonGet"] for j in [B, B3, AW] + [j for _, j in AFTER])
u, cu, fu = S["unfolded"], S["cohortsUnfolded"], S["fullScreenUnfolded"]
on = S["ourNamesUnfolded"]
# the widths in between (tools/edge-widths.mjs)
E = J("edge-widths.json")
edge_widths = ", ".join(str(r["width"]) for r in E["runs"])
edge_states = sum(len(r["states"]) for r in E["runs"])
edge_side = sum(s["sidewaysPx"] for r in E["runs"] for s in r["states"])
edge_cut = sum(len(s["cut"]) for r in E["runs"] for s in r["states"])
edge_over = sum(len(s["cardsRunningOverTheirBox"]) for r in E["runs"] for s in r["states"])
fs = S["fullScreen"]; fsw = sorted({c["w"] for c in fs["cards"]})
rp = S["replayed"]["bar"]

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>HC2 · The compare cards, one above the other</title>
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
.trio{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}}.phones{{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,290px));gap:14px}}
figure{{margin:0}}img{{width:100%;display:block;border:1px solid var(--line)}}figcaption{{color:var(--dim);font-size:11px;margin-top:6px}}
.kpi{{display:grid;grid-template-columns:repeat(auto-fit,minmax(210px,1fr));gap:10px}}.kpi div{{background:var(--panel);border:1px solid var(--line);padding:10px 12px}}
.kpi b{{display:block;font-size:17px;color:var(--bright);font-weight:600}}.kpi span{{color:var(--dim);font-size:11px}}.wrap{{overflow-x:auto}}.small{{font-size:11px;color:var(--dim)}}
ul{{max-width:980px;padding-left:18px;margin:6px 0}}li{{margin:3px 0}}.tag{{display:inline-block;border:1px solid var(--line);padding:0 6px;color:var(--bright);letter-spacing:.06em;font-size:11px}}
details.sc-pagespecs{{margin-top:40px;border-top:1px solid var(--line);padding-top:12px;color:var(--dim)}}details.sc-pagespecs summary{{cursor:pointer;color:var(--bright);letter-spacing:.12em}}
@media(max-width:760px){{.pair,.trio{{grid-template-columns:1fr}}body{{padding:20px 16px 50px}}}}
</style></head><body><main>
<h1>HC2 · THE COMPARE CARDS, ONE ABOVE THE OTHER</h1>
<p class="sub">7 Oct 2026 · on a branch, nothing deployed, no table changed · Hub branch hub/hc2-compare-stacked-20261007 · “I don't want to swipe left to right — scrolling up to down.”</p>

<div class="kpi">
<div><b>0 px sideways</b><span>nothing to swipe at 1680, 1440, 1280 or 390, in any state measured. Live today the row is {SB['opens']['listScroll']['wholeW']:,} px wide in a panel that shows {SB['opens']['listScroll']['shownW']}.</span></div>
<div><b>a card = a third of the panel</b><span>{ac['h']} px tall on the 1680 screen. It was {bc['h']} px. The tallest bar is {ac['barTrackH'] // 2} px; it was {bc['barTrackH'] // 2}.</span></div>
<div><b>three at a time</b><span>{names(S['opens']['cardsFullyShown'])} · then {names(S['oneScreenDown']['cardsFullyShown'])} · then {names(S['atTheEnd']['cardsFullyShown'])}.</span></div>
<div><b>REPLAY and LIVE stay put</b><span>the handle moved {moved_px[-1]} px while the list scrolled, live and replayed, on all four screens.</span></div>
<div><b>same numbers</b><span>{same} of {total} numbers on the nine cards are the live Hub's, read in the same minute.</span></div>
<div><b>full screen: all nine</b><span>three across, three down, nothing to scroll.</span></div>
</div>

<h2>1 · BEFORE → AFTER (1680 × 1050)</h2>
<div class="pair">
{fig(SB['opens']['shot'], f"BEFORE, live: one card in full ({names(SB['opens']['cardsFullyShown'])}) and a slice of the next. The other seven are to the right.")}
{fig(S['opens']['shot'], f"AFTER: {names(S['opens']['cardsFullyShown'])}, each as wide as the panel. REPLAY and LIVE above them.")}
</div>
<div class="trio" style="margin-top:12px">
{fig(SB['swipedToEnd']['shot'], f"BEFORE: to reach INDEX FUNDS, {SB['swipedToEnd']['listScroll']['left']:,} px of swiping sideways.")}
{fig(S['oneScreenDown']['shot'], f"AFTER, one scroll down: {names(S['oneScreenDown']['cardsFullyShown'])}.")}
{fig(S['atTheEnd']['shot'], f"AFTER, a second scroll: {names(S['atTheEnd']['cardsFullyShown'])}. That is all nine.")}
</div>

<h2>2 · ON THE PHONE (390)</h2>
<div class="phones">
{fig(S3['opens']['shot'].replace('-after-', '-before-'), "BEFORE, live: one card, swiped sideways for the rest.")}
{fig(S3['opens']['shot'], f"AFTER: the cards down the panel. BREADTH has fourteen bars, so it takes two rows. Names or numbers cut short: {len(sorted({t for _, v in laid(A3) for t in v['cutLabels']}))} (live: {len(cut_before3)}, such as {e(', '.join(cut_before3[3:6]))}).")}
{fig(S3['oneScreenDown']['shot'], f"AFTER, scrolled: {names(S3['oneScreenDown']['cardsFullyShown'])}.")}
{fig(S3['atTheEnd']['shot'], "AFTER, at the end: OUR NAMES and INDEX FUNDS.")}
</div>

<h2>3 · HOW THIN</h2>
<p>One size: <b>a card takes a third of the panel's list</b> (the part under REPLAY that scrolls). On the 1680 screen that is {ac['h']} px; the card was {bc['h']} px. Only the bars get shorter or taller with the window; names and numbers keep their size.</p>
<div class="panel wrap"><table><tr><th>screen</th><th class="r">the list</th><th class="r">a card</th><th class="r">share of the list</th><th class="r">tallest bar</th><th>cards showing</th></tr>{thin_rows}</table></div>
<h3>THINNER STILL — FOUR TO A PANEL (not built; a picture of the option)</h3>
<div class="pair">
{fig(four['shot'], f"Four to a panel at 1680 × 1050: cards {card0(four)['h']} px, the tallest bar {card0(four)['barTrackH'] // 2} px against {ac['barTrackH'] // 2}.")}
<div class="panel"><p>Four fit only when the window is the full {A['height']} px tall. In a browser window with its toolbar (1680 × 940) the fourth card is cut: {len(fourW['cardsFullyShown'])} whole and part of {names(fourW['cardsPartlyShown'])}. Three fit whole in both.</p>
<p><span class="tag">RECOMMEND</span> three. The bars are what you read; at four they are half the height.</p>
<p class="small">Rows of sideways bars (one row per sector) were weighed and left out: eleven rows to a card is taller, not thinner.</p></div>
</div>

<h2>4 · WHAT STAYED AS IT WAS</h2>
<h3>THE NUMBERS — live Hub and this branch, read in the same minute</h3>
<div class="panel wrap"><table><tr><th>card</th><th>scale, live</th><th>scale, branch</th><th class="r">bars the same</th><th>its first bars</th></tr>{num_table}</table>
<p class="small">{same} of {total} at 1680; {same3} of {total3} on the phone.{(' Moved between the two page loads: ' + e('; '.join((moved + moved3)[:8])) + '.') if (moved or moved3) else ''} The hover on the first bar, both pages: “{e(A['hovers']['first'])}”{'' if A['hovers']['first'] == B['hovers']['first'] else ' (live: “' + e(B['hovers']['first']) + '”)'}.</p></div>
<h3>THE ⤢ UNFOLD</h3>
<div class="pair">
{fig(u['shot'], f"State Street unfolded, in place: the word and the trend / momentum pair under each bar ({e(', '.join(dict.fromkeys(w.replace(chr(173), '') for w in u['stateStreet']['words'])))}). The card kept its height.")}
{fig(cu['shot'], f"COHORTS unfolded: twelve columns, so the bars take two rows and the card grows to {cu['h']} px. Nothing is cut.")}
</div>
<p class="small">OUR NAMES unfolded wears its full names; the longest, {e(on['longestName'])}, is {on['longestNameCssPx']} px in a column of {on['columnCssPx']} (before the page's zoom). Cut: {len(on['cut'])}.</p>
<h3>REPLAY</h3>
<div class="pair">
{fig(S['replayed']['shot'], f"Scrubbed back from the handle: the board and the cards both read {e(rp['boardStamp'])}; both thumbs at {rp['boardThumb']}.")}
{fig(S['replayedScrolled']['shot'], f"Still replayed, list scrolled down: ↻ LIVE and the date are still at the top. Play then ran to {e(S['playing']['day'])}; LIVE came back to “{e(S['backToLive']['stamp'])}”.")}
</div>
<h3>THE LIST KEEPS ITS PLACE</h3>
<div class="pair">
{fig(S['cohortClick']['shot'], f"A click on METALS in the COHORTS card: the board switched ({S['cohortClick']['boardRows']} rows) and the list stayed where it was ({S['cohortClick']['listBefore']} → {S['cohortClick']['listAfter']}).")}
<div class="panel"><ul>
<li>A feed tick redraws the cards: the list stayed at {S['keepsPlaceOnRepaint']['before']} → {S['keepsPlaceOnRepaint']['after']}.</li>
<li>BREADTH is still BREADTH; the subtraction is the same.</li>
<li>The FAVORITES-is-full line and the fixed Geiger bar scale were not touched; their tests still pass.</li>
<li>Each card still prints its own scale (±) and stretches its tallest bar to the top.</li>
</ul></div>
</div>

<h2>5 · FULL SCREEN</h2>
<div class="pair">
{fig(fs['shot'], f"All nine at once, three across: nothing to scroll in either direction. A card with more bars gets more of its line ({fsw[0]}–{fsw[-1]} px).")}
{fig(fu['shot'], f"State Street unfolded in full screen: two rows of bars, and its line grows, so the bottom line needs a short scroll down.")}
</div>

<h2>6 · WHAT COULD NOT STAY AS IT WAS</h2>
<div class="panel"><ul>
<li><b>Bars are shorter.</b> The tallest is {ac['barTrackH'] // 2} px on the 1680 screen; it was {bc['barTrackH'] // 2}. That is what thinner costs.</li>
<li><b>An unfolded card no longer gets wider.</b> It used to widen and the row scrolled. Now it keeps the panel's width: State Street and the other eleven-bar cards unfold in place; COHORTS (twelve) unfolds into two rows; on a phone, in a window narrower than 1280 px and in full screen every unfolded card takes two rows.</li>
<li><b>On a phone BREADTH and COHORTS take two rows of bars.</b> Fourteen and twelve bars do not fit one row of a phone without cutting the numbers.</li>
<li><b>Zero lines line up inside a card, not across cards.</b> Side by side they made one line; stacked, each card has its own.</li>
<li><b>Full screen is three across.</b> It was the same sideways row, only wider.</li>
</ul></div>

<h2>7 · NO SIDEWAYS SCROLL — EVERY SCREEN, EVERY STATE</h2>
<div class="panel wrap"><table><tr><th>screen</th>{side_head}</tr>{side_rows}</table>
<p class="small">px that can only be reached by scrolling sideways, added over: {e(levels)}. Names or numbers cut short in any of these: {len(cut_any)}.</p>
<p class="small">The widths in between were opened too — {e(edge_widths)} px wide, each folded, unfolded, full screen and full screen unfolded ({edge_states} states): {edge_side} px sideways, {edge_cut} names, numbers or words cut, {edge_over} cards running over their box.</p></div>

<h2>8 · NOT DONE, NOT VERIFIED</h2>
<div class="panel"><ul>
<li>One browser engine only: headless Chromium. Safari on the Mac and the iPhone were not opened. If a browser cannot work out the list's height, a card falls back to the height of its content: thinner, still one column, still no sideways scroll.</li>
<li>Nothing is deployed and no table was written.</li>
</ul></div>

<h2>DECISIONS FOR ALAN</h2>
<div class="panel"><ul>
<li><b>Three cards to a panel, or four?</b> <span class="tag">RECOMMEND</span> three, as built. Four is one number to change (section 3).</li>
<li><b>Full screen three across, or one column there too?</b> <span class="tag">RECOMMEND</span> three across: it is the one view with all nine at once.</li>
</ul></div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Every number on this page is read from <code>data/capture-*.json</code>, written by <code>tools/capture.mjs</code>; <code>tools/build-page.py</code> writes the page. BEFORE is the Hub as deployed (page {e(B['pageSha'])}); AFTER is this branch's files served at the same address (page {e(A['pageSha'])}; the branch's index.html is {page_sha}).</p>
<p>Headless Chromium only, never a window on screen. Every request that was not a GET would have been stopped and counted: {stopped} were. Console errors across the {len(AFTER) + 3} runs: {errs}.</p>
<p>A card's height is its share of the list: (the list less its 6 px padding top and bottom, less the 6 px between cards) ÷ 3 — {ac['shareOfListHeight'] * 100:.1f} % of the list. A bar's track is never under 44 px before the page's own zoom; where a third of the list would squeeze it, the card keeps its content's height and the list shows a little less than three.</p>
<p>Bars to a row: a window 1280 px wide or more, one row (an unfolded card of more than eleven columns takes two). Narrower, down to a phone: more than eleven columns, or unfolded, takes two rows. Full screen from 1280 px: three cards to a line, each card's share of the line its share of the line's columns; a cohort column counts 1.4.</p>
<p>The cards draw what HC1's cards drew: <code>tests/fixtures/hc1-cards-b80c01e.json</code> holds the release's cards in five states (<code>tools/make-fixture.mjs</code>), and <code>tests/hc2-compare-stacked.test.mjs</code> draws the same states with this page and compares them card for card.</p>
</details>
</main></body></html>
"""
# the grey BACK / CLOSE pair every Hub sub-page carries: the injector's own snippet and its own placing, applied to THIS page
# only. (Run whole, scripts/inject-scnav.py goes over every page it lists, lab.html among them; this lane writes none of those.)
import importlib.util
_spec = importlib.util.spec_from_file_location("inject_scnav", REPO / "scripts" / "inject-scnav.py"); scnav = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(scnav)
assert page.count("</body>") == 1
page, where = scnav.ensure_slot(scnav.BLOCK.sub("\n", page), "deliverables/20261007/hc2-compare-stacked/HC2-COMPARE-STACKED.html")
page = page.replace("</body>", scnav.SNIPPET + "\n</body>", 1)
out = D / "HC2-COMPARE-STACKED.html"
out.write_text(page)
print("BACK / CLOSE pair placed", where)
print(out.relative_to(REPO), len(page), "chars ·", f"{same}/{total} numbers the same at 1680, {same3}/{total3} at 390 ·", "moved:", (moved + moved3)[:4])
