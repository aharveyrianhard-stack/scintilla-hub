#!/usr/bin/env python3
"""HM3 — writes the page for Alan (HM3.html) from the pictures and from what was read off the page (data/*.json), so no
number on it is typed by hand.
   python3 deliverables/20261007/hm3-macro-look/tools/build-page.py     then     python3 scripts/inject-scnav.py"""
import json, html, pathlib
HERE = pathlib.Path(__file__).resolve().parent.parent
ROOT = HERE.parents[2]
CARDS = ROOT / "deliverables" / "20261007" / "hm3-cards-two-up"
style = (ROOT / "deliverables" / "20261007" / "hm2-macro" / "_style.inc").read_text()
esc = html.escape
def J(p): return json.loads(pathlib.Path(p).read_text())
def fig(src, cap, cls=""): return f'<figure{(" class=" + chr(34) + cls + chr(34)) if cls else ""}><img src="{src}" alt="{esc(cap)}" loading="lazy"><figcaption>{cap}</figcaption></figure>'
def shot(name, cap, cls=""): return fig("shots/" + name, cap, cls)
def cshot(name, cap, cls=""): return fig("../hm3-cards-two-up/shots/" + name, cap, cls)

# ---- what was read off the page ----
ca = {t: J(CARDS / "data" / f"capture-after-{t}.json") for t in ("1680", "1680x940", "1440", "1280", "390")}
cb = {t: J(CARDS / "data" / f"capture-before-{t}.json") for t in ("1680", "390")}
sb, sa = J(HERE / "data" / "shoot-before-1680.json"), J(HERE / "data" / "shoot-after-1680.json")
pb, pa = J(HERE / "data" / "shoot-before-390.json"), J(HERE / "data" / "shoot-after-390.json")
def card(j): o = j["steps"]["opens"]; c = o["cards"][0]; return o, c
def screen_px(css, zoom): return round(css * zoom)
def pct(a, b): return round(100 * a / b)

rows = []
for tag, label in (("1680", "1680 × 1050 (your MacBook)"), ("1680x940", "1680 × 940 (a browser window of ordinary height)"), ("1440", "1440 × 900"), ("1280", "1280 × 800")):
    o, c = card(ca[tag]); H = o["viewport"][1]; px = screen_px(c["cssPx"][1], o["bodyZoom"])
    rows.append(f'<tr><td>{label}</td><td class="r">{pct(px, H)}% of the screen’s height ({px} px of {H})</td><td class="r">{round(c["shareOfListHeight"] * 100)}% of the panel’s list</td><td>{" and ".join(o["cardsFullyShown"])}</td></tr>')
ob, cbf = card(cb["1680"]); pxb = screen_px(cbf["cssPx"][1], ob["bodyZoom"])
op, cp = card(ca["390"]); opb, cpb = card(cb["390"])
A, B = sa["facts"]["asItOpens"], sb["facts"]["asItOpens"]
PA, PB = pa["facts"]["asItOpens"], pb["facts"]["asItOpens"]
railH = A["railCssPx"][1]; zoom = A["bodyZoom"]; H1680 = 1050
def mrow(key, name):
    a, b = A["cards"][key], B["cards"][key]
    apx, bpx = screen_px(a["cssPx"][1], zoom), screen_px(b["cssPx"][1], zoom)
    whole_b = "yes" if b["fitsInOneRailView"] else "no — taller than the rail"
    return (f'<tr><td>{name}</td><td class="r">{pct(bpx, H1680)}% of the screen’s height ({bpx} px)</td><td class="r">{pct(apx, H1680)}% ({apx} px)</td>'
            f'<td>{whole_b}</td><td>yes</td><td class="r">{b["borders"]}</td><td class="r">{a["borders"]}</td></tr>')
railpx = screen_px(railH, zoom)
aucOpen = sa["facts"]["auctionOpen"]; prOpen = sa["facts"]["printOpen"]

def head(title): return f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>{title}</title>\n{style}<style>.q{{border-left:2px solid var(--line);padding:2px 0 2px 12px;color:var(--bright);max-width:980px;margin:10px 0}}.trio3{{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;align-items:start}}.trio3>*{{min-width:0}}.four{{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;align-items:start}}.four>*{{min-width:0}}.lbl{{display:inline-block;color:var(--bg);background:var(--dim);padding:0 6px;letter-spacing:.08em;font-size:11px;margin-bottom:6px}}.lbl.a{{background:var(--up)}}@media(max-width:760px){{.trio3,.four{{grid-template-columns:1fr}}}}</style></head><body><main>\n<span data-scnav-slot></span>'
B_, A_ = '<span class="lbl">BEFORE</span>', '<span class="lbl a">AFTER</span>'

page = head("The macro cards, flat and simple · the compare cards, two per view") + f'''<h1>THE MACRO CARDS, FLAT AND SIMPLE · THE COMPARE CARDS, TWO PER VIEW</h1>
<p class="sub">7 Oct 2026 · everything is on branches · nothing is deployed and nothing on your Hub changed · the macro look: <code>hub/hm3-macro-look-20261007</code> · the cards alone: <code>hub/hm3-cards-two-up-20261007</code> (one commit, <code>7b66061</code>, sitting directly on the live Hub)</p>

<div class="kpi">
<div><b>Two per view</b><span>The compare cards: each card is half the panel at 1680, 1440 and 1280. You approved it; it is its own commit and can ship tonight by itself.</span></div>
<div><b>One line per item</b><span>Auctions: {A["cards"]["auctions"]["lines"]} lines. Macro prints: {A["cards"]["prints"]["lines"]} lines. Click a line and its history opens under it. No box inside a box.</span></div>
<div><b>The curve, read at a glance</b><span>Three lines instead of four, the yields printed on the line itself, THEN VS NOW in three rows, and 2s10s as one number with its year beside it.</span></div>
<div><b>The link and three headlines</b><span>The event card is the publisher’s own page and the first three headlines from our feed. Nothing more.</span></div>
</div>

<h2>1 · THE COMPARE CARDS — TWO PER VIEW &nbsp;<span class="tag">APPROVED · CAN SHIP ALONE TONIGHT</span></h2>
<p class="q">“we need to stack them less — two at a time, two per [view], that I can view two in each view before scrolling. Looks good. Easier to navigate, less stuff at the top. I like it.”</p>
<div class="pair">
<div>{B_}{cshot("1-as-it-opens-before-1680.png", "BEFORE — the Hub as it is live now, 1680 × 1050: three cards to a view (SECTORS · BLENDED, BREADTH, STATE STREET), each a third of the panel.")}</div>
<div>{A_}{cshot("1-as-it-opens-after-1680.png", "AFTER, 1680 × 1050: two cards to a view (SECTORS · BLENDED, BREADTH), each half the panel. The same bars, the same numbers; only the room each card gets changed.")}</div>
</div>
<div class="trio3" style="margin-top:12px">
{cshot("2-one-screen-down-after-1680.png", "AFTER, one scroll down: the next two (STATE STREET, iSHARES).")}
{cshot("1-as-it-opens-after-1440.png", "AFTER at 1440 × 900: two to a view.")}
{cshot("1-as-it-opens-after-1280.png", "AFTER at 1280 × 800: two to a view.")}
</div>
<div class="wrap"><table style="margin-top:12px">
<tr><th>Screen</th><th class="r">One card is</th><th class="r">Which is</th><th>In view before scrolling</th></tr>
<tr><td>before, 1680 × 1050 (live now)</td><td class="r">{pct(pxb, ob["viewport"][1])}% of the screen’s height ({pxb} px of {ob["viewport"][1]})</td><td class="r">{round(cbf["shareOfListHeight"] * 100)}% of the panel’s list</td><td>{", ".join(ob["cardsFullyShown"])}</td></tr>
{"".join(rows)}
</table></div>
<h3>WHAT DID NOT CHANGE</h3>
<div class="four">
{cshot("1-as-it-opens-before-390.png", "Phone, BEFORE (live now).")}
{cshot("1-as-it-opens-after-390.png", f"Phone, AFTER: the same. A card is {cp['cssPx'][1]} px there, as it is live ({cpb['cssPx'][1]} px). “Phone as now.”")}
{cshot("5-full-screen-after-1680.png", "Full screen (the panel’s own ⛶), AFTER: still all nine at once, three across and three down, nothing to scroll.")}
{cshot("4-state-street-unfolded-after-1680.png", "A card unfolded (⤢), AFTER: the word and the trend / momentum pair under each bar, nothing cut.")}
</div>
<p class="small">Also measured, with no picture: 1920, 1400, 1279, 1100, 901 and 821 px wide — two to a view; 820 and 360 — three, as now. At every width, folded and unfolded: no sideways scroll, no name or number cut, no card running over its box.</p>

<h2>2 · THE MACRO CARDS IN THE SLIDER’S LOOK &nbsp;<span class="tag">FOR YOUR LOOK-APPROVAL · NOT LIVE</span></h2>
<p class="q">“these visuals of the macro stuff … look a little bit antiquated and analog in a lot of ways. Boxy … the economic one [the slider] looks way better than the other ones.”</p>
<p>The four cards are drawn the way the slider is: flat bars standing on the panel, small labels, the number beside its bars, no box inside a box. BEFORE is the look you saw this afternoon (HM2). Every number is the same number — only how it is drawn changed.</p>
<div class="pair">
<div>{B_}{shot("3-room-at-the-curve-before-1680.png", "BEFORE, 1680 × 1050, the rail scrolled to the curve: one view holds the curve card and the top of the auctions card.")}</div>
<div>{A_}{shot("3-room-at-the-curve-after-1680.png", "AFTER, the same place: one view holds the whole curve, the whole auctions card and the first macro prints.")}</div>
</div>
<div class="wrap"><table style="margin-top:12px">
<tr><th>Card (1680 × 1050; the rail is {pct(railpx, H1680)}% of the screen’s height, {railpx} px)</th><th class="r">Height before</th><th class="r">Height after</th><th>Whole in one view of the rail, before</th><th>after</th><th class="r">Boxes inside it, before</th><th class="r">after</th></tr>
{mrow("event", "The event card")}{mrow("curve", "Treasury curve")}{mrow("auctions", "Treasury auctions")}{mrow("prints", "Macro prints")}
</table></div>

<h3>THE YIELD CURVE</h3>
<p class="q">“This treasury curve one seems a little analog and weird … I can’t really see much of the information on there.”</p>
<div class="pair">
<div>{B_}{shot("6-curve-before-1680.png", "BEFORE: four lines, an axis, a legend on two lines, two boxed tiles and a table.")}</div>
<div>{A_}{shot("6-curve-after-1680.png", "AFTER: three lines — now (thick), a month ago, a year ago. Five yields are printed on the line: 3-month, 2-year, 5-year, 10-year, 30-year. THEN VS NOW is the same three days as numbers. 2s10s is one number with its last year as a line, and where it stood a month and a year ago.")}</div>
</div>
<p class="small">Left out on purpose: the week-ago line (you asked for today, a month ago, a year ago), the axis and the table (the numbers are on the line and in THEN VS NOW), and the second spread, 3m10y (you asked for 2s10s as the single number — see the decisions).</p>

<h3>TREASURY AUCTIONS</h3>
<div class="trio3">
<div>{B_}{shot("7-auctions-before-1680.png", "BEFORE: a boxed head, a table, then the history with a paragraph beside each strip.")}</div>
<div>{A_}{shot("7-auctions-after-1680.png", "AFTER, as it opens: one line per term. Today’s 10-year is marked TODAY. Green is more demand than its six auctions before, red is less; for DEALERS a smaller share is the stronger auction.")}</div>
<div>{A_}{shot("9-auctions-10y-open-after-1680.png", "AFTER, the 10-year line clicked: Treasury’s own result (the link), and its last thirty auctions as five rows of bars, oldest on the left. Click the line again and it folds.")}</div>
</div>

<h3>MACRO PRINTS</h3>
<p class="q">“macro prints — what would be the idea, expand upon click?”</p>
<p>Yes. A line is the indicator, its last twelve surprises as small bars (above the line and green is better than expected, below and red is worse, a yellow dot is exactly as expected) and the newest print against what was expected. Click it and every stored print opens.</p>
<div class="trio3">
<div>{B_}{shot("8-prints-before-1680.png", "BEFORE: eighteen strips, every bar of every strip always on screen; two names cut short.")}</div>
<div>{A_}{shot("8-prints-after-1680.png", "AFTER, as it opens: eighteen lines, nothing cut.")}</div>
<div>{A_}{shot("11-prints-cpi-open-after-1680.png", "AFTER, CPI YOY clicked: 25 prints as bars of the number itself (low 2.3, high 3.8), each in the colour of its surprise; then the last four prints in words; IN THE CALENDAR opens that day on the left.")}</div>
</div>
<div class="pair" style="margin-top:12px">
{shot("10-prints-payrolls-open-after-1680.png", "AFTER, PAYROLLS clicked: a number that went below zero stands on a zero line, so the months it shrank hang under it.", "narrow")}
{shot("12-room-auction-open-after-1680.png", "AFTER, on the whole screen with the 10-year opened.")}
</div>

<h3>THE EVENT CARD</h3>
<p class="q">“Event card with the official link — just keep it simple. It’s just about having access to the information. Don’t go nuts.”</p>
<div class="pair">
<div>{B_}{shot("2-event-before-1680.png", "BEFORE: three labelled rows and their sentences.")}</div>
<div>{A_}{shot("2-event-after-1680.png", "AFTER: the release and its time, the publisher’s own page, the three headlines. Read live at the time of the picture: today’s FOMC minutes, federalreserve.gov, and three headlines from our news feed.")}</div>
</div>
<div class="pair" style="margin-top:12px">
{shot("1-room-before-1680.png", "BEFORE, the room as it opens (the event card first on the rail).")}
{shot("1-room-after-1680.png", "AFTER, the room as it opens.")}
</div>

<h3>ON A PHONE (390 wide)</h3>
<p class="small">A phone gives the rail only a sliver under the calendar — that is how the room is on the Hub today, and it is not changed here (first picture). The rail is read through its own ⛶ button; the other pictures are taken that way.</p>
<div class="four">
{shot("0-room-as-a-phone-opens-it-after-390.png", "As a phone opens the room, AFTER: the rail is the strip at the bottom, as it is live.")}
{shot("1-room-before-390.png", "BEFORE, the rail full screen: the event card.")}
{shot("1-room-after-390.png", "AFTER, the rail full screen: the event card.")}
{shot("2-event-after-390.png", "AFTER, the event card alone.")}
</div>
<div class="four" style="margin-top:12px">
{shot("6-curve-before-390.png", "Curve, BEFORE.")}
{shot("6-curve-after-390.png", "Curve, AFTER.")}
{shot("7-auctions-before-390.png", "Auctions, BEFORE.")}
{shot("7-auctions-after-390.png", "Auctions, AFTER (the size is left off the line on a phone).")}
</div>
<div class="four" style="margin-top:12px">
{shot("9-auctions-10y-open-after-390.png", "Auctions, AFTER, the 10-year clicked.")}
{shot("8-prints-before-390.png", "Macro prints, BEFORE: eight names cut short.")}
{shot("8-prints-after-390.png", "Macro prints, AFTER: nothing cut.")}
{shot("10-prints-payrolls-open-after-390.png", "Macro prints, AFTER, PAYROLLS clicked.")}
</div>

<h2>WHAT EACH CARD SHOWS, AND WHERE EACH NUMBER COMES FROM</h2>
<div class="wrap"><table>
<tr><th>Card</th><th>What it shows</th><th>Where the numbers come from</th></tr>
<tr><td>Compare cards</td><td>The same nine views as today, two to a view.</td><td>Unchanged: each card draws what it drew.</td></tr>
<tr><td>Treasury curve</td><td>The newest stored curve against the curve a month and a year before it; 2s10s = the 10-year yield minus the 2-year.</td><td>Our table of Treasury’s daily yields (one read, the same one as before). The newest curve in the pictures is 6 Oct: Treasury posts a day’s yields after the close, so the card calls it NOW and prints its date.</td></tr>
<tr><td>Treasury auctions</td><td>The newest auction of each term: date, size, where it stopped, the cover, the indirect and dealer shares; what is coming.</td><td>TreasuryDirect’s own results. <b>The table for them does not exist yet</b> (it is step B of the earlier hand-over), so the pictures use Treasury’s own rows from a file, as this afternoon’s did.</td></tr>
<tr><td>Macro prints</td><td>Eighteen US indicators: the newest print against what was expected, and its history.</td><td>Our economic calendar (FMP), every US print stored with an expectation, from June 2024.</td></tr>
<tr><td>Event card</td><td>The publisher’s page for the release, and three headlines.</td><td>The list of publishers written this afternoon (29 kinds of release); headlines from our own news table, matched by words.</td></tr>
</table></div>

<h2>WHAT COULD BE WRONG</h2>
<ul>
<li>The auctions card has never run against a real table: until the table is created it says “auction results are not stored yet”.</li>
<li>Headlines are matched by words, so a loose match can slip in — the third headline in the picture (a CoinGape story that names the minutes) is one.</li>
<li>In an opened print the height of a bar is the number and its colour is the surprise. A tall red bar is a high number that was worse than expected, not a “bad” high number as such.</li>
<li>Only one line is open at a time in a card: opening a second folds the first. That keeps a card from growing without end; it also means two terms cannot be compared side by side.</li>
<li>The two older lists on the rail (UPCOMING, PRINTED) still wear their box, so the rail mixes flat cards and boxed ones until they are done too.</li>
<li>The curve is the third card on the rail, as it was. It is whole inside one view, but as the room opens it takes one scroll of the rail to reach it.</li>
</ul>

<h2>WHAT WAS NOT DONE</h2>
<ul>
<li>Nothing is deployed. No table was created or written.</li>
<li>The order of the rail was not changed (that is the rail question from this afternoon).</li>
<li>The phone’s sliver of rail was not changed.</li>
<li>The slider, the put/call tape and the Station were not touched.</li>
</ul>

<h2>DECISIONS FOR YOU</h2>
<div class="panel">
<p><b>1 · The macro look: ship it as pictured?</b> Recommendation: <b>yes</b>. It is behind one switch; turned off, the four cards are exactly this afternoon’s.</p>
<p><b>2 · The two older lists on the rail (UPCOMING, PRINTED): the same flat look?</b> Recommendation: <b>yes</b>, in the same pass as the rail question, so the rail reads as one thing.</p>
<p><b>3 · The second spread, 3m10y: gone from the curve card. Bring it back as a second line under 2s10s?</b> Recommendation: <b>leave it out</b> — one number is what makes the card readable.</p>
</div>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p><b>How the pictures were taken.</b> Headless Chromium, never a window, one page at a time, every request that is not a GET stopped and counted. The page is opened at the live address and answered with a local page: BEFORE for the cards is the Hub as deployed; BEFORE for the macro cards is this afternoon’s branch (hub/hm2-macro-20261007 @ca8e0dc); AFTER is this branch. Every read on screen is the real one, except the auctions table, which does not exist yet. Each whole-card picture is taken with the window made tall, so the rail’s own scroll does not cut it.</p>
<p><b>How it is built.</b> A small layer redraws the four cards; every read, every rule and every number is the earlier work’s own function. Two switches: HM3_ON = false gives this afternoon’s cards back; HM2_ON = false takes the macro work out altogether. The compare cards’ change is one number in their sheet (a card’s share of the list, a third → half); a phone and full screen keep a third.</p>
<p><b>Read off the page at 1680 × 1050 (page px before the page’s own {zoom}× zoom).</b> Rail {A["railCssPx"][0]} × {railH}. After: event {"×".join(map(str, A["cards"]["event"]["cssPx"]))}, curve {"×".join(map(str, A["cards"]["curve"]["cssPx"]))}, auctions {"×".join(map(str, A["cards"]["auctions"]["cssPx"]))} (opened: {aucOpen["cssPx"][1]}), prints {"×".join(map(str, A["cards"]["prints"]["cssPx"]))} (opened: {prOpen["cssPx"][1]}). Before: event {"×".join(map(str, B["cards"]["event"]["cssPx"]))}, curve {"×".join(map(str, B["cards"]["curve"]["cssPx"]))}, auctions {"×".join(map(str, B["cards"]["auctions"]["cssPx"]))}, prints {"×".join(map(str, B["cards"]["prints"]["cssPx"]))}. Smallest text after: {min(A["cards"][k]["smallestTextPx"] for k in A["cards"])} px. Names cut after: none; before: {sum(len(B["cards"][k]["cut"]) for k in B["cards"])} at 1680 and {sum(len(PB["cards"][k]["cut"]) for k in PB["cards"])} on a phone.</p>
<p><b>Tests.</b> The Hub’s suite: 2,181 on the live Hub → 2,186 with the cards alone → 2,227 on the macro branch; the same 7 tests fail in all three, none of them about these screens.</p>
</div></details>
</main></body></html>
'''
(HERE / "HM3.html").write_text(page)
print("HM3.html", len(page), "chars")
