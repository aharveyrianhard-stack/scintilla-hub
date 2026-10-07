#!/usr/bin/env python3
"""HM2 — writes the two pages for Alan (HM2.html, RAIL-MOCK.html) from the pictures, the SQL files and data/results.json.
   python3 deliverables/20261007/hm2-macro/tools/build-pages.py     then     python3 scripts/inject-scnav.py"""
import json, html, pathlib
HERE = pathlib.Path(__file__).resolve().parent.parent
ROOT = HERE.parents[2]
style = (HERE / "_style.inc").read_text()
R = json.loads((HERE / "data" / "results.json").read_text())
esc = html.escape
def sql(path): return esc(pathlib.Path(path).read_text().rstrip())
def fig(src, cap): return f'<figure><img src="shots/{src}" alt="{esc(cap)}" loading="lazy"><figcaption>{cap}</figcaption></figure>'
def head(title): return f'<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">\n<title>{title}</title>\n{style}</head><body><main>\n<span data-scnav-slot></span>'

AUC_DDL = sql(ROOT / "supabase/migrations/20261007_hm2_treasury_auctions.sql")
AUC_RB = sql(ROOT / "supabase/migrations/20261007_hm2_treasury_auctions_ROLLBACK.sql")
AUC_CRON = sql(ROOT / "supabase/migrations/20261007_hm2_treasury_auctions_cron.sql")
PC_DDL = sql(HERE / "data/0020_ibkr_option_volume_15m.sql")
PC_RB = sql(HERE / "data/0020_ibkr_option_volume_15m.rollback.sql")

page = head("The macro screens · slider, yield curve, auctions, macro prints, put/call") + f'''<h1>THE MACRO SCREENS · SLIDER, YIELD CURVE, AUCTIONS, MACRO PRINTS, PUT / CALL</h1>
<p class="sub">7 Oct 2026 · everything is on branches · nothing is deployed, no table was created, nothing on your Hub or Station changed · Hub <code>{R["hub_branch"]}</code> · Station <code>{R["station_branch"]}</code> · put/call writer <code>{R["writer_branch"]}</code></p>

<div class="kpi">
<div><b>10-year stopped at 5.300%</b><span>today, 1:00 PM. $39B sold, bid 2.77 times over (the six before it averaged 2.54). Dealers were left with 2.5%; they usually take 8.8%. A strong auction.</span></div>
<div><b>tomorrow · $22B 30-year</b><span>a reopening, 1:00 PM New York. It is on the card under COMING, with its size.</span></div>
<div><b>the slider is in the economic room</b><span>the earnings slider’s own frame: one bar a day, a TODAY line, DAYS / WEEKS, click a bar to open it.</span></div>
<div><b>the ladder is now a picture</b><span>today against a week, a month and a year ago, with 2s10s (+0.48) and 3m10y (+1.06) and each spread’s own year.</span></div>
<div><b>18 indicators, since June 2024</b><span>actual and consensus were already stored for every one of them; each now has a strip of its surprises.</span></div>
<div><b>71 names, two factors each</b><span>calls and puts each against the name’s own usual day. At 1:30 PM today 14 of them stood at 1.5× their usual ratio.</span></div>
</div>

<h2>1 · THE ECONOMIC SLIDER</h2>
<p>“we don’t have in the economic section a left to right slider like we have on the event section … I think we should”</p>
<div class="pair">
{fig("before-economic-1680.jpg", "BEFORE, live today: region tabs, category chips, the month grid. No slider.")}
{fig("after-economic-1680.jpg", "AFTER, on the branch: the slider sits under the day bar, exactly where the earnings room has its own. On the right the rail is scrolled to its new cards: the curve as a picture, then the auctions.")}
</div>
<div class="pair" style="margin-top:12px">
{fig("after-economic-1680-slider.jpg", "The slider, close. One bar is one day; the number is how many releases; the star marks a day with the Fed’s decision, payrolls, CPI, core PCE or GDP.")}
{fig("earnings-slider-live-1680.jpg", "The one it is built like: the live EARNINGS room. Same frame, same bar, same TODAY line, same zoom chips.")}
</div>
<ul>
<li><b>What a bar counts.</b> The releases of that day that pass the tabs above it: the region (US, G7 …), the category chip and HIGH ONLY. Change a tab and the slider follows; it never disagrees with the table under it.</li>
<li><b>Its colour is the day’s load</b>, as on the earnings slider. Cyan: no high-importance release. Orange: one to four. Red: five or more. This was measured, not chosen by eye: of the last 190 US weekdays, 84 had none, 83 had one to four, 23 had five or more. So red is about one day in eight.</li>
<li><b>DAYS</b> shows five weeks back and four ahead. <b>WEEKS</b> shows six months back and two ahead. There is no MONTHS: a month of releases is nearly the same number every month, so the bars would all be the same height.</li>
<li>Drag it sideways, or tap TODAY to bring it back. Click a bar and that day (or week) opens in the table below.</li>
</ul>

<h2>2 · TREASURY AUCTIONS</h2>
<p>“There’s a … 10-year note auction … should we be tracking that? … how much they fill or what? What information do we get … or do we just get that the event exists?”</p>
<p><b>The calendar only told you the event exists. The Treasury itself tells you how it went, free, about three minutes after the 1:00 PM deadline.</b> Three things, and each one is shown against the last six auctions of the same term:</p>
<div class="pair">
{fig("after-economic-1680-auctions.jpg", "The card on the branch, with today’s real result. Green is more demand than its last six; red is less.")}
<div>
<table>
<tr><th>WHAT</th><th>WHAT IT MEANS</th><th class="r">TODAY’S 10-YEAR</th><th class="r">ITS LAST SIX</th></tr>
<tr><td>Stopped at</td><td>the highest yield the Treasury had to pay to sell all of it</td><td class="r">5.300%</td><td class="r">—</td></tr>
<tr><td>Bid-to-cover</td><td>dollars bid for every dollar sold. Higher is more demand.</td><td class="r up">2.77×</td><td class="r">2.54×</td></tr>
<tr><td>Indirect</td><td>mostly foreign buyers and big funds, bidding through a dealer</td><td class="r up">80.3%</td><td class="r">74.1%</td></tr>
<tr><td>Direct</td><td>domestic funds bidding for themselves</td><td class="r up">17.1%</td><td class="r">17.0%</td></tr>
<tr><td>Dealers</td><td>the banks, who must take whatever nobody else wanted. <b>Lower is the stronger auction.</b></td><td class="r up">2.5%</td><td class="r">8.8%</td></tr>
</table>
<p class="small">All seven terms are on the card: 2-, 3-, 5-, 7-, 10-, 20- and 30-year. The newest result of each is one line. Recent ones were softer than today’s: the 5-year on 23 Sep was covered 2.21 times against 2.33 and dealers took 15.8% against 12.9%.</p>
<p><b>Upcoming, with size.</b> COMING lists what the Treasury has announced: tomorrow’s $22B 30-year reopening. The Treasury names a size about a week ahead, so further out the date is known (it is on the calendar) and the size is not yet.</p>
<p><b>The tail is not shown, and here is why.</b> The tail is the stop against the yield the new issue was trading at one minute before the deadline. That pre-auction yield lives on dealer screens (Bloomberg, Tradeweb). <b>No free source carries it.</b> The Treasury’s daily curve is end-of-day only, so comparing with it would mix in the whole morning’s move and call it a tail. What the card gives instead is free and exact: the stop, and the median accepted bid on hover (5.255% today, so the stop was 4.5 hundredths above the middle bid).</p>
</div>
</div>
<p class="small">History kept: 712 auctions, 9 Jan 2018 to 8 Oct 2026, in one new table. The first fill is ready as one file; nothing has been loaded.</p>

<h2>3 · THE YIELD CURVE, AS A PICTURE</h2>
<p>“the treasury yield ladder — wouldn’t the graphic be better for this?”</p>
<div class="pair">
<div class="narrow">{fig("before-economic-1680-ladder.jpg", "BEFORE, live: twelve rows of numbers. They cannot show a shape.")}</div>
{fig("after-economic-1680-curve.jpg", "AFTER: the curve today (the thick line) against a week, a month and a year ago, the two spreads with their own year, and the numbers kept in a small table.")}
</div>
<ul>
<li><b>Today’s line is the day’s colour:</b> green when the 10-year closed above the day before, red when below (it is red here: 5.27 after 5.31). The three older curves each have their own hue and dash, so none is a grey line.</li>
<li><b>What the picture says today:</b> a year ago the curve dipped in the middle (2-year 3.60, 10-year 4.18). Now it climbs all the way: 2-year 4.79, 10-year 5.27, 30-year 5.64. From the 2-year out, yields are about a point higher than a year ago; the 3-month bill barely moved (4.21 against 4.02).</li>
<li><b>2s10s</b> is the 10-year minus the 2-year: +0.48 now, +0.37 a week ago, +0.58 a year ago. <b>3m10y</b> is the 10-year minus the 3-month bill: +1.06 now, +0.16 a year ago. If either goes below zero the tile says INVERTED.</li>
<li>Source: the Treasury’s own daily curve, already stored since August 2020. Nothing new is read.</li>
</ul>

<h2>4 · MACRO PRINTS, WITH THEIR HISTORY</h2>
<p>“macro prints — all of the historical information, do we have it? … It’s only really useful in a historical context. A visual like slider type oscillator thing could be good on that too”</p>
<p><b>Yes, more than the screen was showing.</b> Every US release since 7 June 2024 is stored with its actual, its consensus and its previous number. The list on the rail only ever printed the newest value. Each indicator now has a strip:</p>
<div class="pair">
<div class="narrow">{fig("before-economic-1680-prints.jpg", "BEFORE, live: the newest number of each series, one at a time.")}</div>
<div class="narrow">{fig("after-economic-1680-strips.jpg", "AFTER: one strip per indicator, oldest on the left. Up and green is better than expected; down and red is worse; the height is how big the surprise was for that indicator.")}</div>
</div>
<ul>
<li><b>“Better” follows the room’s one rule.</b> For inflation, unemployment and jobless claims a lower number than expected is the better one. For everything else, stronger is better. So payrolls at 29 against 90 expected is red, and jobless claims at 197 against 200 is green.</li>
<li><b>No grey.</b> A print exactly on consensus is a yellow dot on the line, the same yellow the room already uses for “in line”.</li>
<li>The newest print stands at the right: the actual, then what was expected. Click a strip and its newest print opens in the calendar.</li>
<li><b>Indicators nobody forecasts have no strip</b> (money supply, the Fed’s balance sheet, the Treasury’s cash, reverse repo, mortgage rates): there is no consensus to be surprised against.</li>
</ul>
<table class="mid">
<tr><th>WHAT IS STORED</th><th>HOW FAR BACK</th></tr>
<tr><td>Actual, consensus and previous, every US release</td><td>7 June 2024 → today (24 to 29 monthly prints each; 114 weekly for jobless claims)</td></tr>
<tr><td>The level only: payrolls, jobless claims, industrial production, durable goods, vehicle sales, M2, mortgage rates, the Fed’s balance sheet, reverse repo</td><td>deep: 1950 to 2003 onward, depending on the series</td></tr>
<tr><td>The level only: CPI, unemployment, retail sales, Fed funds, GDP, consumer sentiment, housing starts</td><td>shallow: 3 to 10 points, from mid-2025</td></tr>
</table>
<p><b>Not done:</b> consensus numbers from before June 2024. The job that fetches them from FMP is written and tested, but the FMP key lives only on Fly, so it has not been run. It only adds older rows; it cannot change a row that is there.</p>

<h2>5 · THE MACRO RAIL · A PROPOSAL</h2>
<p>“this macro rail … we need a little bit of a rearrangement … we might not need it”</p>
<p>This is a proposal only. Nothing about the rail’s order was decided here. The full mock, card by card with a reason for each, is on its own page: <a href="RAIL-MOCK.html">THE MACRO RAIL · KEEP / MERGE / DROP</a>. In one line: six cards become four, and the option of no rail at all is drawn beside it.</p>

<h2>6 · PUT / CALL · THE TWO FACTORS</h2>
<p>“how do I start tracking this? I don’t trade options, but it’s important to understand how they’re moving … it’s like a two-factor thing — it can move because one or the other moved … What’s the best visual?”</p>
<p><b>The ratio is two things, so it is shown as two things.</b> Each name carries two small bars on one scale: calls so far today against the calls it usually has by this time of day (green), and puts against its usual puts (red). The upright line is 1×, its usual day. Then the ratio and how far it stands from its own usual, which is exactly the red bar divided by the green one.</p>
{fig("after-dash-1680-putcall.jpg", "The tape on the Hub dashboard, 1:30 PM today, real numbers.")}
<table class="mid" style="margin-top:10px">
<tr><th>NAME, 1:30 PM TODAY</th><th class="r">CALLS vs USUAL</th><th class="r">PUTS vs USUAL</th><th class="r">RATIO vs USUAL</th><th>WHAT HAPPENED</th></tr>
<tr><td>SOFI</td><td class="r">0.8×</td><td class="r dn">2.2×</td><td class="r dn">2.7×</td><td>Puts came in. Calls were ordinary. Somebody is buying protection.</td></tr>
<tr><td>NET</td><td class="r">0.5×</td><td class="r dn">1.6×</td><td class="r dn">3.3×</td><td>Both moved: calls dried up and puts came in.</td></tr>
<tr><td>MU</td><td class="r up">2.5×</td><td class="r">2.1×</td><td class="r up">0.8×</td><td>A very heavy day on both sides, calls heavier. The ratio alone (0.8×) would have hidden that.</td></tr>
<tr><td>SPY</td><td class="r">0.85×</td><td class="r">0.96×</td><td class="r">1.14×</td><td>A quiet day. The ratio is a touch high only because calls were light.</td></tr>
</table>
<div class="pair" style="margin-top:12px">
{fig("after-dash-1680.jpg", "HUB: one more tape under TODAY’S SCINTILLAS, in the same box and at the same speed. It takes 40 px, which is 3.8% of a 1050-px screen: the board shows one row fewer.")}
{fig("before-dash-1680.jpg", "The Hub dashboard as it is live today, for comparison.")}
</div>
<div class="pair" style="margin-top:12px">
{fig("station-on-1680.jpg", "STATION, switched ON: PUT / CALL is a third row on the tape strip, above FAVORITES. The charts give up 23 px (2.2% of the screen).")}
{fig("station-off-1680.jpg", "STATION, as the branch would ship: the row is OFF until you say go. The strip is the same 46 px as today, to the pixel.")}
</div>
<div class="pair" style="margin-top:12px">
{fig("station-on-1680-tapes.jpg", "The Station strip, close, with the row on.")}
{fig("station-off-1680-tapes.jpg", "The Station strip, close, with the row off: FAVORITES and LIKED, as today.")}
</div>
<ul>
<li><b>Names:</b> SPY and QQQ first, then your FAVORITES and RADAR names, the one furthest above its own usual first.</li>
<li><b>The flash.</b> A name flashes while its ratio is at 1.5× its own usual or more, through the Hub’s one flash and the Station tape’s own. Measured on the stored days: at 1.5×, between 3 and 15 of about 65 names would be flashing at any moment; today at 1:30 PM it was 14. At 2× it would have been 7.</li>
<li><b>Thin names never flash.</b> A name that usually trades under 2,000 contracts by that time of day is shown dimmed and cannot flash. Without that rule a fund trading 10 puts against a usual 0 would light up every day.</li>
<li><b>“Usual”</b> is the average of the name’s own last sessions at the same time of day. Only 8 full sessions are stored so far (the counter started on 24 Sep and one day was lost to a logout), so “usual” is a short memory today. It deepens by itself, up to 20 sessions.</li>
<li><b>Where the numbers come from.</b> The IBKR counter on this MacBook already lands every name’s call and put volume. What was missing was keeping each name every 15 minutes. That is now written into the function that already makes the minute lines; it stores 26 marks a day per name.</li>
</ul>

<h2>7 · ON A PHONE (390 wide)</h2>
<div class="phones">
{fig("after-economic-390.jpg", "The economic room: the slider fits the width and scrolls sideways under the thumb.")}
{fig("after-economic-390-curve.jpg", "The curve card.")}
{fig("after-economic-390-auctions.jpg", "The auctions card: four numbers become two rows of two.")}
{fig("after-economic-390-strips.jpg", "The surprise strips.")}
{fig("after-dash-390.jpg", "The dashboard with the put/call tape.")}
</div>

<h2>8 · THE TWO NEW TABLES · HOW THEY ARE MADE, AND THE WAY BACK</h2>
<p>Both are additive: a new table each, nothing altered. Each rollback was written before its table. <b>Neither has been applied.</b></p>
<h3>A · TREASURY AUCTIONS (Hub branch, supabase/migrations/)</h3>
<details class="sql"><summary>THE TABLE</summary><pre>{AUC_DDL}</pre></details>
<details class="sql" open><summary>THE WAY BACK</summary><pre>{AUC_RB}</pre></details>
<details class="sql"><summary>THE TWO SCHEDULES (staged; only after the function is deployed)</summary><pre>{AUC_CRON}</pre></details>
<h3>B · EVERY NAME’S OPTION VOLUME, EVERY 15 MINUTES (writer branch, db/migrations/0020)</h3>
<details class="sql"><summary>THE TABLE AND THE “TODAY vs USUAL” VIEW</summary><pre>{PC_DDL}</pre></details>
<details class="sql" open><summary>THE WAY BACK</summary><pre>{PC_RB}</pre></details>

<h2>9 · WHAT COULD BE WRONG</h2>
<ul>
<li><b>“Usual” for put/call rests on 8 sessions.</b> One odd day moves it. Read the multiples as rough until about 20 sessions are stored (late October).</li>
<li><b>Early in the day the multiples are jumpy.</b> At 9:45 a name has traded little, so a small number is divided by a small number.</li>
<li><b>The auction card’s colours are relative to six auctions.</b> Six weak auctions in a row make an ordinary one look green.</li>
<li><b>A release whose units the feed changed</b> (thousands one month, millions the next) is corrected by the room’s existing rule before the strip is drawn; a release that rule cannot read is left out of the strip rather than guessed.</li>
<li><b>The pictures of the auctions card and the put/call tape use real numbers through a stand-in.</b> Those two tables do not exist yet, so in the test browser the two reads were answered from files holding exactly what the tables will hold (the Treasury’s rows; the view’s own SQL run read-only on the stored readings). Everything else on screen was read live.</li>
</ul>

<h2>10 · WHAT WAS NOT DONE</h2>
<ul>
<li>Nothing was deployed and no table was created or written. The slider, the curve and the strips need no new table and would work the moment the branch is live; the auctions card and the put/call tape wait for their tables.</li>
<li>Consensus history before June 2024 was not fetched (the key lives on Fly; the job is ready).</li>
<li>The tail is not shown: no free source for the pre-auction yield.</li>
<li>The rail was not rearranged beyond replacing the ladder with the picture and adding the two cards. The rest is the proposal.</li>
<li>The call-heavy mirror of the flash (a ratio at two-thirds of its usual or less) was not built: you asked for 1.5×. Today 7 names stood there.</li>
<li>The Station’s put/call row reads the list straight from the database mirror, like the tapes’ own lists. An earlier note preferred such data to come through the chart API; that route was not built.</li>
</ul>

<h2>11 · TESTS</h2>
<table class="mid">
<tr><th>WHERE</th><th class="r">BEFORE</th><th class="r">AFTER</th><th>NEW FAILURES</th></tr>
<tr><td>Hub</td><td class="r">{R["hub_before"]}</td><td class="r">{R["hub_after"]}</td><td>{R["hub_new"]}</td></tr>
<tr><td>Station</td><td class="r">{R["station_before"]}</td><td class="r">{R["station_after"]}</td><td>{R["station_new"]}</td></tr>
<tr><td>Put/call writer</td><td class="r">{R["writer_before"]}</td><td class="r">{R["writer_after"]}</td><td>{R["writer_new"]}</td></tr>
</table>
<p class="small">Failing tests are compared by name against the same commit without this work, not by count. Four existing tests were re-pinned on purpose, each with a dated note saying why and naming what stands beside it: the Hub’s count of calendar reads goes from two to three (the surprise strips’ one read, behind its own switch; the economic room’s own module still holds two); the writer’s close now writes five tables; the Station’s list of controls gains one switch; the Station’s list of direct reads gains one list of names with volume counts (no price).</p>

<h2>12 · FOR THE COORDINATOR · THE ORDER</h2>
<pre>{esc(R["order"])}</pre>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p>Pictures: headless Chromium, one page at a time, every non-GET request blocked and counted. BEFORE pictures are the live Hub and Station. AFTER pictures are the live address answered with the branch’s page (tools/shoot.mjs --map), so every read on screen is the real one, except the two tables that do not exist yet (--data), answered from data/treasury-auctions.json (the Treasury’s own rows, read 7 Oct 13:26 ET) and data/putcall-names-now-20261007-1330.json (the view’s SQL run read-only over the stored readings).</p>
<p>The Hub block lives in tools/hm2-block.js and tools/hm2-style.css and is placed by tools/inject-hm2.py through seven one-line hooks; --remove gives the page back to the byte. It sits above the economic room’s own module, never inside it: that module is still pinned to three tables and two calendar reads. The slider asks through the room’s one window reader; the strips add one read of their own, recorded in the room’s guard test with its neighbours. Nothing in the block reads or paints unless its own element is on the page, and the room’s mount never waits on it. One switch, HM2_ON; the put/call tape has its own, HM2_PC_ON. The Station row has PC_TAPE_DEFAULT_ON = false.</p>
<p>Sources: econ_calendar (FMP economic calendar, existing job) · treasury_rates (the Treasury’s daily par curve, existing job) · treasury_auctions (TreasuryDirect TA_WS, new) · ibkr_option_volume_15m and putcall_names_now (IBKR option volume, new, written by putcall-aggregate).</p>
</div></details>
</main></body></html>
'''
(HERE / "HM2.html").write_text(page)

def card(tag, title, body): return f'<div class="rc rc--{tag.lower()}"><span class="rt">{tag}</span><h4>{title}</h4>{body}</div>'
mock = head("The macro rail · keep / merge / drop") + f'''<style>
.cols{{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:22px;align-items:start}}
.rc{{position:relative;background:var(--panel);border:1px solid var(--line);padding:10px 12px;margin:0 0 10px}}
.rc h4{{margin:0 0 8px;font-size:11px;letter-spacing:.14em;color:var(--bright);font-weight:500;padding-right:74px}}
.rt{{position:absolute;top:8px;right:10px;font-size:11px;letter-spacing:.12em;padding:0 6px;border:1px solid var(--dim);color:var(--bright)}}
.rc--merge{{border-style:dashed}}.rc--merge .rt{{border-style:dashed}}
.rc--drop{{border-style:dotted;opacity:.72}}.rc--drop .rt{{border-style:dotted}}.rc--drop h4{{text-decoration:line-through}}
.rc--new .rt{{background:var(--line)}}
.rc img{{border:0}}.rc table{{font-size:11px}}.rc td,.rc th{{padding:3px 6px}}
.now td{{border-bottom:1px solid var(--dim);color:var(--bright);letter-spacing:.1em;padding-top:5px}}
.why{{color:var(--dim);font-size:11px;margin:6px 0 0}}
.wire{{display:grid;grid-template-columns:3fr 2fr;gap:8px}}.wire div{{border:1px solid var(--line);padding:10px;min-height:70px;color:var(--dim)}}
.wire2{{display:grid;grid-template-columns:1fr;gap:8px}}.wire2 div{{border:1px solid var(--line);padding:10px;color:var(--dim)}}
@media(max-width:760px){{.cols{{grid-template-columns:1fr}}}}
</style>
<h1>THE MACRO RAIL · KEEP / MERGE / DROP</h1>
<p class="sub">7 Oct 2026 · a proposal only · nothing here is decided or built into the rail’s order · “this macro rail … we need a little bit of a rearrangement … we might not need it”</p>

<div class="kpi">
<div><b>six cards become four</b><span>two lists become one, the ladder goes into the curve, the plain list goes into the strips, the footnotes go to PAGE SPECS.</span></div>
<div><b>nothing leaves the room</b><span>every number on the rail today is still on screen in the proposal, or one click away.</span></div>
<div><b>or no rail at all</b><span>the second option at the bottom: the room goes full width and the rail’s cards become a tab.</span></div>
</div>

<h2>1 · CARD BY CARD</h2>
<div class="wrap"><table>
<tr><th>ON THE RAIL TODAY</th><th>PROPOSAL</th><th>WHY</th></tr>
<tr><td>UPCOMING · RELEASES (US watch list, 7 days)</td><td><span class="tag">MERGE</span> into THIS WEEK</td><td>It and PRINTED are one list cut in two. Joined, the NOW line sits between what has printed and what is coming, as it does everywhere else in the room.</td></tr>
<tr><td>PRINTED · THIS WEEK</td><td><span class="tag">MERGE</span> into THIS WEEK</td><td>Same list. Its actual-against-expected reading is kept exactly.</td></tr>
<tr><td>TREASURY CURVE (one line of text)</td><td><span class="tag">MERGE</span> into the curve picture</td><td>The picture carries the same three numbers and the shape.</td></tr>
<tr><td>UST LADDER (twelve rows)</td><td><span class="tag">MERGE</span> into the curve picture</td><td>Twelve numbers in a column cannot show a shape. The numbers stay, in the small table under the picture. Built on the branch.</td></tr>
<tr><td>—</td><td><span class="tag">NEW</span> TREASURY AUCTIONS</td><td>You asked what an auction tells us. This is the answer, on the day it happens. Built on the branch.</td></tr>
<tr><td>MACRO PRINTS · LATEST STORED (24 rows)</td><td><span class="tag">MERGE</span> into the surprise strips</td><td>Every strip ends with the newest number, so the list repeats it. The five series nobody forecasts move to a small LIQUIDITY card: they are a set (the Fed’s balance sheet, the Treasury’s cash, reverse repo, M2, the mortgage rate).</td></tr>
<tr><td>four slow series in that list: potential GDP, real GDP per head, the credit-card rate, the recession probability</td><td><span class="tag">DROP</span> from the rail</td><td>They change monthly or quarterly with a long lag and say nothing about today. Still stored; off the screen you read every day.</td></tr>
<tr><td>SOURCES &amp; FRESHNESS</td><td><span class="tag">DROP</span> from the rail → PAGE SPECS</td><td>It is an explanation, and explanations go at the bottom. A series that is actually late still says so on its own row.</td></tr>
</table></div>

<h2>2 · TODAY → PROPOSED</h2>
<div class="cols">
<div>
<h3>TODAY (live pictures)</h3>
{card("MERGE", "UPCOMING · RELEASES", '<img src="shots/before-economic-1680-up.jpg" alt="live: upcoming releases" loading="lazy">')}
{card("MERGE", "PRINTED · THIS WEEK", '<img src="shots/before-economic-1680-printed.jpg" alt="live: printed this week" loading="lazy">')}
{card("MERGE", "TREASURY CURVE", '<img src="shots/before-economic-1680-curve.jpg" alt="live: treasury curve, one line" loading="lazy">')}
{card("MERGE", "UST LADDER", '<img src="shots/before-economic-1680-ladder.jpg" alt="live: UST ladder" loading="lazy">')}
{card("MERGE", "MACRO PRINTS · LATEST STORED", '<img src="shots/before-economic-1680-prints.jpg" alt="live: macro prints, latest stored" loading="lazy">')}
{card("DROP", "SOURCES &amp; FRESHNESS", '<img src="shots/before-economic-1680-sources.jpg" alt="live: sources and freshness" loading="lazy">')}
</div>
<div>
<h3>PROPOSED (the three pictures are the branch; the two lists are drawn here with today’s real numbers)</h3>
{card("NEW", "THIS WEEK · US", """<table>
<tr><th>WHEN (ET)</th><th>RELEASE</th><th class="r">ACTUAL</th><th class="r">EXPECTED</th><th>READ</th></tr>
<tr><td>MON 10:00</td><td>ISM Services PMI</td><td class="r dn">54.9</td><td class="r">55</td><td>0.1 below</td></tr>
<tr><td>TUE 08:30</td><td>Balance of Trade</td><td class="r dn">−105.6</td><td class="r">−102</td><td>3.6 below</td></tr>
<tr><td>TUE 11:00</td><td>Atlanta Fed GDPNow</td><td class="r">3.7</td><td class="r">3.7</td><td>in line</td></tr>
<tr><td>WED 13:00</td><td>10-Year Note Auction · $39B</td><td class="r up">5.300%</td><td class="r">—</td><td>cover 2.77 · strong</td></tr>
<tr class="now"><td colspan="5">— NOW —</td></tr>
<tr><td>WED 14:00</td><td>FOMC Minutes</td><td class="r">—</td><td class="r">—</td><td></td></tr>
<tr><td>THU 08:30</td><td>Jobless Claims</td><td class="r">—</td><td class="r">200</td><td>before 197</td></tr>
<tr><td>THU 13:00</td><td>30-Year Bond Auction · $22B</td><td class="r">—</td><td class="r">—</td><td></td></tr>
<tr><td>FRI 10:00</td><td>Michigan Sentiment</td><td class="r">—</td><td class="r">47.6</td><td>before 48.1</td></tr>
<tr><td>WED 08:30</td><td>Inflation YoY</td><td class="r">—</td><td class="r">3.7</td><td>before 3.4</td></tr>
</table><p class="why">One list, the NOW line between what has printed and what is coming. Auctions join it with their size and, once printed, their stop.</p>""")}
{card("NEW", "TREASURY CURVE", '<img src="shots/after-economic-1680-curve.jpg" alt="branch: the curve as a picture" loading="lazy">')}
{card("NEW", "TREASURY AUCTIONS", '<img src="shots/after-economic-1680-auctions.jpg" alt="branch: the auctions card" loading="lazy">')}
{card("NEW", "MACRO PRINTS · SURPRISES", '<img src="shots/after-economic-1680-strips.jpg" alt="branch: the surprise strips" loading="lazy">')}
{card("NEW", "LIQUIDITY", """<table>
<tr><th></th><th class="r">LATEST</th><th class="r">CHANGE</th><th>AS OF</th></tr>
<tr><td>Fed balance sheet</td><td class="r">$6.743T</td><td class="r dn">−$4.7B on the week</td><td>30 Sep</td></tr>
<tr><td>Treasury’s cash (TGA)</td><td class="r">$948.7B</td><td class="r dn">−$28.4B on the week</td><td>30 Sep</td></tr>
<tr><td>Reverse repo</td><td class="r">$0.4B</td><td class="r dn">−$0.6B on the day</td><td>6 Oct</td></tr>
<tr><td>M2</td><td class="r">$23.34T</td><td class="r up">+$124.9B on the month</td><td>Aug</td></tr>
<tr><td>30-year mortgage</td><td class="r">7.28%</td><td class="r up">+0.25 on the week</td><td>1 Oct</td></tr>
</table><p class="why">The five series nobody forecasts, as a set. Real numbers from what is stored; this card is drawn here only, it is not built.</p>""")}
</div>
</div>

<h2>3 · THE OTHER OPTION · NO RAIL</h2>
<p>If the rail is not needed: the calendar takes the whole width, THIS WEEK moves under the slider, and the rest becomes a third tab beside RELEASES and REGIME.</p>
<div class="cols">
<div><h3>RELEASES TAB</h3><div class="wire2"><div>the tape</div><div>region · category · the day bar</div><div>the slider, full width</div><div>THIS WEEK (printed · NOW · coming) beside the calendar grid</div></div></div>
<div><h3>A NEW TAB · RATES &amp; PRINTS</h3><div class="wire"><div>TREASURY CURVE, large</div><div>TREASURY AUCTIONS</div></div><div class="wire" style="margin-top:8px"><div>MACRO PRINTS · SURPRISES, wide strips</div><div>LIQUIDITY</div></div></div>
</div>
<ul>
<li><b>For it:</b> the calendar gets about two-thirds more width (954 px becomes 1,586 on the MacBook screen), and the strips get room to show every print without scrolling.</li>
<li><b>Against it:</b> the curve and today’s auction are one click away instead of always in view.</li>
<li><b>Recommendation: keep a rail, with the four cards above plus LIQUIDITY.</b> On an auction day or a CPI morning you want the result and the curve beside the calendar, not behind a tab.</li>
</ul>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p>The TODAY column is the live Hub, pictured 7 Oct 2026 about 2:00 PM New York, one card at a time from one page load. The three pictures in the PROPOSED column are the branch’s own cards with real data. THIS WEEK and LIQUIDITY are drawn on this page from numbers stored today (econ_calendar, treasury_auctions as read from TreasuryDirect, econ_history); neither exists in the product.</p>
<p>KEEP / MERGE / DROP is marked by the border: solid for new or kept, dashed for merged, dotted and struck through for dropped.</p>
</div></details>
</main></body></html>
'''
(HERE / "RAIL-MOCK.html").write_text(mock)
print("pages written:", len(page), len(mock))
