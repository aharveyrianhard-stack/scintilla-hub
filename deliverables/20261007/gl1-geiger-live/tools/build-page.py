#!/usr/bin/env python3
# GL1 — builds GL1-GEIGER-LIVE.html from the pictures in shots/ and the measured data in data/. No network.
#   python3 deliverables/20261007/gl1-geiger-live/tools/build-page.py
#   then: python3 scripts/inject-scnav.py   (puts the BACK / CLOSE pair back; restore any other page it rewrites)
import json, os, html
D = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
J = lambda n: json.load(open(os.path.join(D, "data", n)))
agree, live, logp = J("agreement-three-moments.json"), J("live-readings.json"), J("log-table-proof.json")
f2 = lambda v: "—" if v is None else ("+" if v >= 0 else "−") + "%.2f" % abs(v)
tone = lambda v: "mu" if v is None else ("up" if v >= 0 else "dn")
num = lambda v: '<b class="%s">%s</b>' % (tone(v), f2(v))
trip = lambda c, t, m: '%s <i>T</i> %s <i>M</i> %s' % (num(c), num(t), num(m))
def shot(name, cap, cls=""):
    assert os.path.exists(os.path.join(D, "shots", name)), name
    return '<figure class="%s"><img src="shots/%s" alt="%s" loading="lazy"><figcaption>%s</figcaption></figure>' % (cls, name, html.escape(cap), cap)

# the favourites at 14:07: the names that moved most between the two readings
names = live["names"]
rows = sorted(names.items(), key=lambda kv: -abs(kv[1]["live"]["c"] - kv[1]["settled"]["c"]))
gaps = sorted(abs(v["live"]["c"] - v["settled"]["c"]) for v in names.values())
median = gaps[len(gaps) // 2]
fav = "".join('<tr><td class="t">%s</td><td>%s</td><td>%s</td><td class="r">%s</td></tr>' % (k, trip(v["settled"]["c"], v["settled"]["t"], v["settled"]["m"]),
    trip(v["live"]["c"], v["live"]["t"], v["live"]["m"]), f2(v["live"]["c"] - v["settled"]["c"])) for k, v in rows[:12])

# the agreement table: 20 names x 3 moments
labels = {"2026-10-07T11:22:00-04:00": "11:22 ET", "2026-10-07T12:30:00-04:00": "12:30 ET", "now": "13:50 ET"}
ms = agree["moments"]
head = "".join('<th colspan="2">%s</th>' % labels.get(m["moment"], m["moment"]) for m in ms)
sub = "".join("<th>our publisher</th><th>the oscillator's formula</th>" for _ in ms)
body = ""
for i, r0 in enumerate(ms[0]["rows"]):
    cells = ""
    for m in ms:
        r = m["rows"][i]; p, o = r["publisher"], r["oscillator_every_rung"]
        cells += "<td>%s</td><td>%s</td>" % (trip(p["c"], p["t"], p["m"]), trip(o["c"], o["t"], o["m"]))
    body += '<tr><td class="t">%s</td>%s</tr>' % (r0["symbol"], cells)
equal = " · ".join("%s: %d of %d equal" % (labels.get(m["moment"], m["moment"]), m["equal_to_two_decimals__publisher_vs_oscillator_every_rung"], m["names"]) for m in ms)
inst = max(m["max_gap__publisher_vs_installed"] for m in ms)
inst_c = max(r["gap_publisher_vs_installed"]["c"] for m in ms for r in m["rows"])
size = logp["size"]

page = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>GL1 — the Geiger goes live</title>
<style>
:root{ --bg:#0a0a0f; --panel:#12121a; --line:#26262f; --ink:#c8c8cc; --ink2:#a0a0a6; --ink3:#78787e; --bull:#00FFA3; --bear:#FF2D55; --mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace; }
*{ box-sizing:border-box; } html,body{ margin:0; background:var(--bg); color:var(--ink); font:14px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif; }
main{ max-width:1180px; margin:0 auto; padding:26px 18px 80px; }
h1{ font:600 20px/1.3 var(--mono); letter-spacing:.14em; text-transform:uppercase; margin:0 0 6px; color:var(--ink); }
h2{ font:600 12px/1.3 var(--mono); letter-spacing:.16em; text-transform:uppercase; color:var(--ink2); margin:38px 0 10px; padding-top:14px; border-top:1px solid var(--line); }
p{ margin:0 0 10px; max-width:86ch; } .lead{ font-size:16px; color:var(--ink); } .dim{ color:var(--ink2); } small{ color:var(--ink3); font-size:12px; }
.q{ border-left:2px solid var(--line); padding:2px 0 2px 12px; color:var(--ink2); font-style:italic; margin:0 0 12px; }
figure{ margin:0 0 18px; background:var(--panel); border:1px solid var(--line); padding:8px; } figure img{ display:block; width:100%%; height:auto; }
figcaption{ font:12px/1.5 var(--mono); color:var(--ink2); padding:8px 2px 2px; }
.two{ display:grid; grid-template-columns:1fr 1fr; gap:14px; } .narrow{ max-width:430px; } .mid{ max-width:760px; }
@media (max-width:760px){ .two{ grid-template-columns:1fr; } }
table{ border-collapse:collapse; width:100%%; font:12px/1.5 var(--mono); margin:0 0 12px; } th,td{ text-align:left; padding:5px 8px; border-bottom:1px solid var(--line); white-space:nowrap; }
th{ color:var(--ink3); font-weight:500; letter-spacing:.08em; text-transform:uppercase; font-size:11px; } td.t{ color:var(--ink); font-weight:600; } td.r{ text-align:right; }
.scroll{ overflow-x:auto; border:1px solid var(--line); background:var(--panel); padding:4px 6px; margin:0 0 12px; }
b.up{ color:var(--bull); font-weight:600; } b.dn{ color:var(--bear); font-weight:600; } b.mu{ color:var(--ink3); } td i, .big i{ font-style:normal; color:var(--ink3); font-size:11px; margin:0 1px 0 5px; }
.big{ display:grid; grid-template-columns:repeat(3,1fr); gap:12px; margin:0 0 14px; } .big > div{ background:var(--panel); border:1px solid var(--line); padding:12px 14px; }
.big span{ display:block; font:11px/1.4 var(--mono); letter-spacing:.1em; text-transform:uppercase; color:var(--ink3); margin-bottom:6px; } .big strong{ font:600 17px/1.3 var(--mono); }
@media (max-width:760px){ .big{ grid-template-columns:1fr; } }
ol,ul{ margin:0 0 12px; padding-left:20px; max-width:86ch; } li{ margin:0 0 6px; }
code{ font:12px var(--mono); color:var(--ink2); background:var(--panel); padding:1px 4px; }
details{ margin:18px 0 0; border-top:1px solid var(--line); padding-top:10px; } summary{ cursor:pointer; font:11px var(--mono); letter-spacing:.14em; color:var(--ink3); }
</style></head><body><main>
<h1>The Geiger goes live</h1>
<p class="dim">GL1 · 7 October 2026 · nothing on this page is live yet: the back end waits for the coordinator's deploy, the new look waits for your word.</p>
<p class="q">"We don't wait for candle closes." · "We keep minute prices, but the Geiger only changes when the bar finishes — is bullshit." · "We can't have inconsistencies." · "I would like to see [trend and momentum] separately."</p>

<p class="lead">You were right, and it is now fixed on a branch. The Hub's Geiger only counted bars that had finished, so its 3-hour part could not move for three hours and its 12-hour part for twelve. It now counts the bar each part is still building, at the newest price we have stored, and refreshes every minute.</p>

<div class="big">
<div><span>Micron this morning, 11:22 — the Hub showed</span><strong>%(hub)s</strong></div>
<div><span>the same minute, counting the bars being built</span><strong>%(live1122)s</strong></div>
<div><span>TradingView's oscillator at 11:22</span><strong>%(tv)s</strong></div>
</div>
<p>The first number is what was on your board. The second is the new rule, rebuilt for that minute from our own bars and stored minute prices. The third is what your oscillator read on the daily chart. The new rule and the oscillator agree; the board was three hours behind.</p>

<h2>1 · The board — before, and with trend and momentum shown apart</h2>
<p>Two forms to choose from. Both keep every row exactly as tall as it is today, and both put <b class="up">LIVE · 1m</b> beside the cohort name: which reading the board is showing and how old its oldest price is. The MEAN line gains the mean trend and the mean momentum.</p>
%(s_before)s
%(s_a)s
%(s_b)s
<div class="two">%(s_phone_before)s%(s_phone_after)s</div>
<p><small>These pictures are the real Hub page from this branch with the switch on. The numbers in the "after" pictures are today's live readings, computed at 14:07 by the new publisher code from real bars and stored minutes for all 71 names on FAVORITES and RADAR plus SPY and QQQ, and laid over the board's own feed, because the deployed back end still serves the old reading. With the switch off the branch draws the board exactly as it is today (picture kept in the folder).</small></p>

<h2>2 · The compare cards</h2>
<p>Each fund's or group's bar gets two thin bars beside it: trend on the left, momentum on the right, on the card's own scale. BREADTH has none (its bar is the gap between two funds, which has no trend or momentum of its own), and neither has SECTORS · BLENDED (an average of five readings).</p>
%(s_cmp)s

<h2>3 · The Station chip</h2>
<p>Alone on the wall the chip reads the three numbers; in an eight-chart layout it keeps the Geiger's number and shows trend and momentum as the two thin bars. Caterpillar this afternoon is the case for seeing them apart: trend still up, momentum sharply down.</p>
%(s_st_before)s
%(s_st_after)s
<div class="two">%(s_st_cat)s%(s_st_vst)s</div>

<h2>4 · What the board was missing at 14:07 today</h2>
<p>Your %(n_fav)d names, both readings at the same minute. The middle name differed by %(median)s Geiger points; %(n10)d names by 0.10 or more. The twelve that moved most:</p>
<div class="scroll"><table><tr><th>name</th><th>finished bars only (the Hub today)</th><th>live (the new rule)</th><th class="r">difference</th></tr>%(fav)s</table></div>

<h2>5 · Does it match the oscillator? Twenty names, three moments today</h2>
<p>%(equal)s — to two decimals on Geiger, trend and momentum; in fact to four. "Our publisher" is the new production code fed the provider's finished bars and our stored minutes. "The oscillator's formula" is the TradingView script's own arithmetic, written out and run on 30-minute and daily bars the way TradingView builds them.</p>
<div class="scroll"><table><tr><th rowspan="2">name</th>%(head)s</tr><tr>%(sub)s</tr>%(body)s</table></div>
<p><b>One difference found, and it is in the oscillator, not the Hub.</b> The script on your charts holds its 3-day and weekly parts until the last trading day inside each bar. The new rule counts them as they build, as you asked. Until the script's small change (version 4, in this folder, not installed) is saved, the Hub and the oscillator can differ on those two parts: about 0.01 on most names, up to %(inst_c)s on the Geiger itself and %(inst)s on momentum today (Vistra). After it, they are the same number. The coordinator can also hold the Hub to the oscillator's rule for a day with one setting.</p>
<p><small>What this check is not: a comparison of TradingView's price feed with ours, name by name. Both sides here read our provider. The one true TradingView reading on file is Micron at 11:22, above: Geiger and trend equal, momentum 0.33 against 0.32.</small></p>

<h2>6 · The log — "to watch how it would have looked before"</h2>
<ul>
<li>A new table keeps, for every name, what the board showed: Geiger, trend, momentum, the same three from finished bars only, and each part's own trend and momentum.</li>
<li><b>Every minute</b> for FAVORITES, RADAR, SPY and QQQ; <b>every five minutes</b> for every other name. Put a name on FAVORITES and its minute rows start the next minute.</li>
<li>Measured: %(rows)s rows a trading day, %(mb)s MB. Kept: minute rows 60 days, five-minute rows 400 days, the evening reading for good. That levels off near %(gb)s GB.</li>
<li>It starts the evening it is switched on. It cannot be filled backwards minute by minute; the daily history from GH1 covers the past.</li>
</ul>

<h2>7 · What could be wrong</h2>
<ul>
<li>"Live" means the newest stored minute: one to two minutes behind the tape, longer for a name that has not traded. The age is on the screen.</li>
<li>Before 09:30 the daily, 3-day and weekly parts do not count pre-market prices (a daily bar never does, here or on TradingView); the four intraday parts do.</li>
<li>On your four-hour chart the oscillator itself shows finished bars only, except in the last half hour of each bar; only its daily chart counts the bars being built. That is how the script was written; it is noted for whoever changes it next.</li>
<li>The pictures show today's real readings on the real page, but through a stand-in for the back end's new fields. The first true end-to-end picture is the one after the deploy.</li>
<li>Said plainly: the new rule reads the database every cycle, and my first version had a way for a stalled database to stop the cycles after it — a frozen board, the very thing you banned. I found it re-reading my own work, closed it, and proved it closed on the real publisher with a database that never answers. It is written up in the runbook.</li>
</ul>

<h2>8 · What was not done</h2>
<ul>
<li>Nothing deployed, no table created, no machine changed. The proof ran on a throw-away machine that wrote nothing and was destroyed.</li>
<li>The oscillator's version 4 was not installed and not compiled on TradingView.</li>
<li>The minute-by-minute refresh was proved in parts (its arithmetic, its guards, one refused dry run on the real machine), not yet as a whole against the live object: that needs the deploy.</li>
</ul>

<h2>Decisions for you</h2>
<ol>
<li><b>The board's form.</b> A: the Geiger keeps its full bar, with its number, and trend and momentum are two thin bars under it. B: all three numbers in view beside shorter bars. <b>Recommend A</b>: the Geiger stays the thing that draws the eye, and the numbers are one hover away.</li>
<li><b>The 3-day and weekly parts.</b> Count them as they build on both the Hub and the oscillator (its version 4), or keep the oscillator as it is and hold the Hub to it. <b>Recommend: count them, both places, same evening.</b></li>
<li><b>Switch the new look on</b> for the Hub board, the compare cards and the Station chip once the back end is live. <b>Recommend yes</b>, after you have looked at these pictures.</li>
</ol>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary><div>
<p><small>Branches: provider <code>provider/gl1-geiger-live-20261007</code> (the rule, the minute refresh, the log, the runbook with the deploy order) · Hub <code>hub/gl1-geiger-live-20261007</code> · Station <code>station/gl1-geiger-live-20261007</code>. Where the bar being built comes from: the minute bars the price stream already stores, one query a cycle for every name; the live price service is not asked anything. The reading from finished bars only is still computed and stored for history. Pictures: headless, one page at a time, every request that is not a read stopped (none was made). Data behind every table on this page is in <code>data/</code>; the builder is <code>tools/build-page.py</code>.</small></p>
</div></details>
</main></body></html>
"""
mu = fixture = None
r1122 = next(r for r in ms[0]["rows"] if r["symbol"] == "MU")
out = page % dict(
    hub=trip(r1122["settled"]["c"], r1122["settled"]["t"], r1122["settled"]["m"]),
    live1122=trip(r1122["publisher"]["c"], r1122["publisher"]["t"], r1122["publisher"]["m"]),
    tv=trip(0.40, 0.48, 0.32),
    s_before=shot("2-board-before-1680.png", "BEFORE — the board as deployed, 14:07 ET: one bar per name, no word on which reading it is."),
    s_a=shot("2-board-after-1680.png", "AFTER, FORM A (proposed) — the Geiger's bar at full width with its number; under it two thin bars: trend, then momentum. LIVE · 1m beside the cohort name; T and M beside the mean."),
    s_b=shot("2-board-after-formB-1680.png", "AFTER, FORM B — all three numbers always in view (+0.93 / T+1.00 M+0.85) beside shorter bars."),
    s_phone_before=shot("2-board-before-390.png", "Phone, before.", "narrow"), s_phone_after=shot("2-board-after-390.png", "Phone, after: the three bars alone in the narrow column; the numbers are in the breakdown.", "narrow"),
    s_cmp=shot("4-compare-cards-after-1680.png", "Compare cards, after: STATE STREET shows each fund's trend (left) and momentum (right) beside its bar. BREADTH and SECTORS · BLENDED are unchanged.", "mid"),
    s_st_before=shot("station-chip-MU-before-1680-close.png", "Station chip, before: Micron, the finished-bars reading."),
    s_st_after=shot("station-chip-MU-after-1680-close.png", "Station chip, after: Micron live — Geiger, trend, momentum, and the two thin bars under the Geiger's own."),
    s_st_cat=shot("station-chip-CAT-after-420.png", "Eight-chart size, Caterpillar: Geiger −0.15; trend still up (short green bar), momentum down (long red bar).", "narrow"),
    s_st_vst=shot("station-chip-VST-after-420.png", "Eight-chart size, Vistra.", "narrow"),
    n_fav=len(names), median="%.2f" % median, n10=sum(1 for g in gaps if g >= 0.10), fav=fav,
    equal=equal, head=head, sub=sub, body=body, inst="%.2f" % inst, inst_c="%.2f" % inst_c,
    rows="{:,}".format(size["rows_per_session_day"]), mb="%.1f" % size["total_mb_per_session_day"], gb="%.1f" % size["steady_state"]["gb"])
open(os.path.join(D, "GL1-GEIGER-LIVE.html"), "w", encoding="utf-8").write(out)
print("GL1-GEIGER-LIVE.html", len(out), "bytes ·", len(names), "names · median gap", "%.3f" % median, "· moved ≥0.10:", sum(1 for g in gaps if g >= 0.10))
