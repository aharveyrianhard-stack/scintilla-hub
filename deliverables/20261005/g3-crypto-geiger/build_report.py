#!/usr/bin/env python3
# Builds G3-CRYPTO-GEIGER.html from g3-dryrun.json (the read-only dry run of 5 Oct 23:30Z). No network.
import json, os, html
here = os.path.dirname(os.path.abspath(__file__))
R = json.load(open(os.path.join(here, 'g3-dryrun.json')))
W = R['weights']; TOT = R['weight_total']
WIDTHS = ['3h', '4h', '6h', '12h', '1d', '3d', '1w']
NAME = {'3h': '3-hour', '4h': '4-hour', '6h': '6-hour', '12h': '12-hour', '1d': 'daily', '3d': '3-day', '1w': 'weekly'}
e = html.escape
def day(s): return '—' if not s else f"{int(s[8:10])} {['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][int(s[5:7])]} {s[11:16]}"
def f2(x): return '—' if x is None else f"{x:+.2f}"
def cls(a, b): return 'up' if b > a else ('dn' if b < a else '')

# picture 1: before -> after on a -1..+1 track
pic = []
for c in R['coins']:
    b, a = c['live_composite'], c['after']['composite']
    pb, pa = (b + 1) * 50, (a + 1) * 50
    lo, hi = min(pb, pa), max(pb, pa)
    pic.append(f"""<div class="row"><div class="nm">{e(c['ticker'][:-3])}</div>
<div class="trk"><i class="mid"></i><i class="span {cls(b,a)}" style="left:{lo:.2f}%;width:{hi-lo:.2f}%"></i><i class="mk was" style="left:{pb:.2f}%"></i><i class="mk now {cls(b,a)}" style="left:{pa:.2f}%"></i></div>
<div class="val">{f2(b)} <span class="{cls(b,a)}">&rarr; {f2(a)}</span></div></div>""")

# picture 2: who votes through a day, live rule
hdr = ''.join(f"<th>{NAME[w]}<br><span class='w'>{W[w]:.2f}</span></th>" for w in WIDTHS)
day_rows = []
for r in R['through_day']:
    cells = ''.join(f"<td class='{'on' if w in r['voting'] else 'off'}'>{'votes' if w in r['voting'] else 'out'}</td>" for w in WIDTHS)
    day_rows.append(f"<tr><td>{r['utc']}</td>{cells}<td>{r['weight_in']:.2f} of {TOT:.2f} ({r['weight_in']/TOT*100:.0f}%)</td><td>{f2(r['coins']['BTCUSD'])}</td><td>{f2(r['coins']['ETHUSD'])}</td></tr>")
new_row = "<tr class='new'><td>any time</td>" + ''.join("<td class='on'>votes</td>" for _ in WIDTHS) + f"<td>{TOT:.2f} of {TOT:.2f} (100%)</td><td>{f2(R['coins'][2]['after']['composite'])}</td><td>{f2([c for c in R['coins'] if c['ticker']=='ETHUSD'][0]['after']['composite'])}</td></tr>"

# per-coin table
coin_rows = []
for c in R['coins']:
    wd = {w['tf']: w for w in c['widths']}
    aft = {v['tf']: v['votes'] for v in c['after']['votes']}
    first = True
    for w in WIDTHS:
        x = wd[w]
        fresh_after = {'1d': c['after']['daily']['newest_bar'], '3d': c['after']['three_day']['newest_bar']}.get(w)
        note = ''
        if w == '1d': note = f"reading {f2(x['read'])} &rarr; <span class='{cls(x['read'], c['after']['daily']['new_read'])}'>{f2(c['after']['daily']['new_read'])}</span> on today's bars"
        if w == '3d': note = f"reading {f2(x['read'])} &rarr; <span class='{cls(x['read'], c['after']['three_day']['new_read'])}'>{f2(c['after']['three_day']['new_read'])}</span> on refreshed bars"
        stale = x['why'] == 'no fresh bar'
        topc = ' class="top"' if first else ''
        coin_rows.append(f"<tr{topc}><td>{e(c['ticker']) if first else ''}</td><td>{NAME[w]}</td>"
            f"<td class='{'bad' if stale else ''}'>{day(x['bar'])}{' · STALE' if stale else ''}</td><td>{x['w']:.2f}</td>"
            f"<td class='{'on' if x['old'] else 'off'}'>{'yes' if x['old'] else 'no'}{' — from stale bars' if x['old'] and stale else ''}</td>"
            f"<td class='{'on' if aft[w] else 'off'}'>{'yes' if aft[w] else 'no'}{' — bar ' + day(fresh_after) if fresh_after else ''}</td><td>{note}</td></tr>")
        first = False

ba_rows = ''.join(f"<tr><td>{e(c['ticker'])}</td><td>{f2(c['live_composite'])}</td><td>{c['live_n']}</td>"
    f"<td>{f2(c['rule_only']['composite'])}</td><td class='{cls(c['live_composite'], c['after']['composite'])}'>{f2(c['after']['composite'])}</td>"
    f"<td class='{cls(c['live_composite'], c['after']['composite'])}'>{c['after']['composite']-c['live_composite']:+.2f}</td>"
    f"<td>{f2(c['trend'])}</td><td>{f2(c['before']['momentum'])} &rarr; {f2(c['after']['momentum'])}</td></tr>" for c in R['coins'])
oth_rows = ''.join(f"<tr><td>{e(c['ticker'])}</td><td>{e(c['type'])}</td><td>{f2(c['live_composite'])}</td><td>{', '.join(NAME.get(w['tf'], w['tf']) for w in c['widths'] if w['w']>0 and w['old']) or '—'}</td>"
    f"<td>{'; '.join(NAME.get(w['tf'], w['tf'])+' '+day(w['bar']) for w in c['widths'] if w['w']>0 and w['old'])}</td></tr>" for c in R['others'])
btc = [c for c in R['coins'] if c['ticker'] == 'BTCUSD'][0]
lo_d = min(c['after']['daily']['new_read'] for c in R['coins']); hi_d = max(c['after']['daily']['new_read'] for c in R['coins'])
t16 = [r for r in R['through_day'] if r['utc'] == '16:00'][0]

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>G3 · crypto Geiger inputs</title>
<style>
  :root{{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; --bull:#00FFA3; --bear:#FF2D55; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1560px; margin:0 auto; padding:56px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .lead{{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1100px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; max-width:1100px; font-size:12px; }}
  .k{{ display:grid; grid-template-columns:repeat(auto-fit,minmax(170px,1fr)); gap:8px; margin:12px 0 18px; }}
  .k div{{ border:1px solid var(--line); background:var(--panel); padding:10px 12px; font-size:12px; letter-spacing:.06em; color:var(--ink3); }}
  .k b{{ display:block; font-size:24px; letter-spacing:0; color:var(--ink); font-weight:600; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 14px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:0 0 10px; color:var(--ink); font-weight:600; }}
  p{{ margin:6px 0; max-width:1100px; }} code{{ color:var(--ink); font-size:12px; overflow-wrap:anywhere; }} b{{ color:var(--ink); }}
  .tw{{ overflow-x:auto; }}
  table{{ border-collapse:collapse; width:100%; min-width:900px; font-size:12px; }}
  th{{ text-align:left; color:var(--ink3); font-weight:400; letter-spacing:.08em; font-size:11px; text-transform:uppercase; padding:6px 10px 6px 0; border-bottom:1px solid var(--line); vertical-align:bottom; }}
  th .w{{ color:var(--ink); letter-spacing:0; }}
  td{{ vertical-align:top; padding:6px 10px 6px 0; border-bottom:1px solid var(--line); }}
  tr.top td{{ border-top:1px solid #6e6e74; }} tr.top td:first-child{{ color:var(--ink); font-weight:600; }}
  td.on{{ color:var(--ink); }} td.off{{ color:var(--ink3); }} td.bad{{ color:var(--ink); font-weight:600; }}
  tr.new td{{ border-top:1px solid #6e6e74; color:var(--ink); }}
  .up{{ color:var(--bull); }} .dn{{ color:var(--bear); }}
  .row{{ display:grid; grid-template-columns:64px 1fr 150px; gap:12px; align-items:center; padding:5px 0; }}
  .nm{{ color:var(--ink); letter-spacing:.1em; }} .val{{ color:var(--ink3); text-align:right; font-size:13px; }}
  .trk{{ position:relative; height:18px; border-left:1px solid var(--line); border-right:1px solid var(--line); background:linear-gradient(var(--line),var(--line)) center/100% 1px no-repeat; }}
  .trk i{{ position:absolute; top:0; bottom:0; }} .trk .mid{{ left:50%; width:1px; background:var(--line); }}
  .trk .span{{ top:7px; bottom:7px; opacity:.55; }} .trk .span.up{{ background:var(--bull); }} .trk .span.dn{{ background:var(--bear); }}
  .trk .mk{{ width:3px; margin-left:-1px; }} .trk .was{{ background:var(--ink3); }} .trk .now.up{{ background:var(--bull); }} .trk .now.dn{{ background:var(--bear); }}
  .axis{{ display:grid; grid-template-columns:64px 1fr 150px; gap:12px; color:var(--ink3); font-size:11px; }} .axis div:nth-child(2){{ display:flex; justify-content:space-between; }}
  ol,ul{{ margin:6px 0; padding-left:20px; max-width:1100px; }} li{{ margin:7px 0; overflow-wrap:anywhere; }}
  .rule{{ border-left:3px solid #6e6e74; padding:4px 0 4px 12px; margin:10px 0; color:var(--ink); max-width:1100px; }}
  details{{ border:1px solid var(--line); background:var(--panel); padding:10px 16px; }} summary{{ cursor:pointer; color:var(--ink3); letter-spacing:.2em; font-size:12px; }}
  @media (max-width:600px){{ main{{ padding:56px 10px 60px; }} .k b{{ font-size:20px; }} .row,.axis{{ grid-template-columns:44px 1fr 104px; gap:8px; }} .val{{ font-size:11px; }} }}
</style></head>
<body>
<main>
<span data-scnav-slot></span><h1>G3 · the crypto Geiger's inputs</h1>
<p class="lead"><b>Answer.</b> Two of the seven bar sizes that make each coin's Geiger were being read from August bars and stamped as today's, and the other sizes were switched in and out of the vote by a 3-hour timer. The bigger of the two is one X2 did not see: the <b>daily</b> size, the heaviest in the Geiger, has been computed on bars that stop on 14 Aug, and reads the maximum (+1.00) for all nine coins tonight. With today's bars and every size voting, every coin's Geiger comes down: BTC {f2(btc['live_composite'])} &rarr; <span class="dn">{f2(btc['after']['composite'])}</span>.</p>
<p class="sub">Read on 5 Oct 2026 at 23:30 UTC (19:30 ET), read-only, one snapshot. Nothing on the live database, the Hub or any job was changed. The fix is staged in three files and waits.</p>
<div class="k">
  <div><b>14 Aug</b>newest daily bar the coins' daily reading is made from</div>
  <div><b>8 Aug</b>newest 3-day bar, all nine coins</div>
  <div><b>+1.00</b>daily reading shown for all nine · real: {f2(lo_d)} to {f2(hi_d)}</div>
  <div><b>{t16['weight_in']/TOT*100:.0f}%</b>of the weight voting at 16:00 UTC (3-hour + daily only)</div>
  <div><b>0</b>jobs ever scheduled to make 3-day bars</div>
  <div><b>25 / 25</b>test steps on a throw-away database</div>
</div>

<section>
<h2>1 · Each coin's Geiger: tonight &rarr; with today's bars and every size voting</h2>
<div class="axis"><div></div><div><span>&minus;1</span><span>0</span><span>+1</span></div><div></div></div>
{''.join(pic)}
<div class="tw" style="margin-top:12px"><table>
<tr><th>Coin</th><th>On the Hub tonight</th><th>Sizes counted</th><th>Rules only, bars not yet fixed</th><th>After (rules + bars)</th><th>Change</th><th>Trend half</th><th>Momentum half before &rarr; after</th></tr>
{ba_rows}
</table></div>
</section>

<section>
<h2>2 · Who votes through a day under the 3-hour timer (weighted sizes, UTC)</h2>
<div class="tw"><table>
<tr><th>Time</th>{hdr}<th>Weight in the vote</th><th>BTC</th><th>ETH</th></tr>
{''.join(day_rows)}
{new_row}
</table></div>
</section>

<section>
<h2>3 · Per coin, per bar size</h2>
<div class="tw"><table>
<tr><th>Coin</th><th>Bar size</th><th>Newest bar the reading is made from</th><th>Weight</th><th>Votes now? (23:30 UTC)</th><th>Votes after</th><th>Reading</th></tr>
{''.join(coin_rows)}
</table></div>
</section>

<section>
<h2>4 · The two rules</h2>
<p class="rule"><b>Rule 1.</b> A bar size whose newest bar is older than two bar-lengths does not vote: it is dropped, the other weights are renormalised, and the size is named with its bar date beside the reading.</p>
<p class="rule"><b>Rule 2.</b> A bar size votes from the moment its reading is made until its next bar is due, plus one bar-length of grace for a late job &mdash; not for a fixed 3 hours.</p>
<p class="rule"><b>The name itself</b> follows the stock Geiger's rule: if no size of a coin can vote, the coin keeps its last number with its real age, and is no longer deleted after 4 hours.</p>
</section>

<section>
<h2>5 · What stopped, and the fix (staged, not applied)</h2>
<ol>
<li><b>3-day bars &mdash; nothing died; nothing was ever scheduled.</b> All 3-day bars of the nine coins were written in one batch on 11 Aug (19:51&ndash;20:04 UTC) by hand, during the August backfill; the newest complete one then was 8 Aug. File <code>01_crypto_3d_bars_refresh.sql</code> fills 11 Aug &rarr; today and adds a nightly job at 02:30 UTC, four minutes before the 3-day reading is made. It uses the same database function that made the existing bars.</li>
<li><b>Daily bars &mdash; the reading looks at an old copy.</b> On 14 Aug the coins were loaded into the table kept for dividend-adjusted stock prices. From that day the reading uses that copy and ignores the coins' live daily bars. File <code>02_crypto_daily_bars_view.sql</code> sends the coins back to their own daily bars. Stocks, funds, futures and rates get exactly the rows they get today.</li>
<li><b>The voting rules.</b> File <code>03_geiger_width_votes.sql</code> replaces the 3-hour line for the nine coins with the two rules above and adds one empty-by-default field that names any size left out.</li>
</ol>
<p>Each file has its rollback beside it, and the live bodies were saved first under <code>staged/g3/saved/</code>.</p>
</section>

<section>
<h2>6 · What the coordinator applies · what waits for Alan</h2>
<ul>
<li><b>Coordinator, nothing yet.</b> All three files change what the Hub shows for the nine coins, so under the 3 Oct rule they need Alan's word first. Order once approved: 01 and 02 together; 03 after the next 02:34 UTC run (03 refuses on its own before that).</li>
<li><b>Alan 1 &mdash; apply the three files?</b> Recommendation: yes. The coins' Geigers drop by 0.12 to 0.30 because the daily reading stops reading +1.00 from August bars.</li>
<li><b>Alan 2 &mdash; the other 13 (ES NQ CL DX GC SI, six rates, VIX).</b> They share the illness and are worse: tonight each is built from the 3-hour and daily readings only, and most of their stored bars stop 11&ndash;14 Aug (table below). They are left on today's rule here. Recommendation: a separate lane restores their bars first, then the same two rules are switched on for them (one word in file 03).</li>
<li><b>Alan 3 &mdash; the per-user Geiger</b> (the function that applies a signed-in user's own weights) has its own copy of the 3-hour line, for every name. Not changed. Recommendation: give it the same rule in the lane that does item 2.</li>
</ul>
<div class="tw"><table>
<tr><th>Name</th><th>Kind</th><th>On the Hub tonight</th><th>Weighted sizes voting at 23:30 UTC</th><th>Newest stored bar of those sizes</th></tr>
{oth_rows}
</table></div>
</section>

<section>
<h2>7 · What could be wrong · what was not done</h2>
<ul>
<li>The "after" numbers are recomputed here from the stored bars and the live price with a copy of the reading's arithmetic. Check: the same copy reproduces tonight's nine stored daily readings (strength index within 0.1) and all 22 published Geigers to four decimals.</li>
<li>"Through a day" holds tonight's readings still and changes only who votes, from the jobs' own timetables. It shows the timer's effect, not the market's.</li>
<li>The 3-day and weekly readings are made once a night. Under rule 2 they now vote all day, so by evening their price is up to 21 hours old. Making them hourly for coins is a small follow-up, not done.</li>
<li>The cron history only goes back to 21 Sep, so "no 3-day job ever existed" rests on the job list today, the one-batch insert times and the unscheduled writer &mdash; not on a log of August.</li>
<li>Not run on the live database: the three files. Not read: the ribbon function as deployed (read from the copy on disk, version 21). Not touched: the 2-week and monthly sizes (weight 0, bars stop 29 Jun and 1 Jun) &mdash; under rule 1 they simply do not vote.</li>
<li>No Hub page was changed; nothing reads the new "left out" field yet, so the Hub does not show the mark until a later lane draws it.</li>
</ul>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p>Source: one read-only snapshot of <code>ribbon_signals</code>, <code>operator_weights</code>, <code>ohlcv_history</code>, <code>ohlcv_daily_adj</code>, <code>fan_daily</code>, <code>live_quotes</code>, <code>composite_staged</code>, <code>cron.job</code> and the function bodies, taken {e(R['snapshot_utc'])}. Numbers: <code>g3-dryrun.json</code>, made by <code>tools/dryrun.mjs</code>; this page by <code>build_report.py</code>.</p>
<p>The Geiger of a non-equity = half trend (the daily fan reading) + half momentum; momentum = the weighted mean of the bar sizes that vote. Weights tonight: 3-hour {W['3h']:.2f}, 4-hour {W['4h']:.2f}, 6-hour {W['6h']:.2f}, 12-hour {W['12h']:.2f}, daily {W['1d']:.2f}, 3-day {W['3d']:.2f}, weekly {W['1w']:.2f}; total {TOT:.2f}. Ten other sizes carry weight 0.</p>
<p>The 3-hour line lives in the database function <code>refresh_geiger</code> (job 57, every minute): <code>r.updated_ts &gt; cut - 10800</code>. <code>updated_ts</code> is the time the ribbon job ran, not the bar's date. The ribbon job pastes the live price onto the last stored bar, whatever its date.</p>
<p>"Two bar-lengths" = the bar forming now or the one just closed; floor 15 minutes so the 1-minute size does not flicker. Section 1 picture: grey mark = tonight, coloured mark = after; red = lower, green = higher. "Rules only" = file 03 without 01 and 02: the daily and 3-day sizes drop out and are named.</p>
<p>Pattern followed: Prometheus returns no value for a series with no fresh sample in its lookback window, and marks it stale, instead of repeating the last value. Tests: <code>tests/g3-crypto-geiger-rules.test.mjs</code> (7) and <code>sqltest/run.mjs</code> (25 steps, PGlite, apply &rarr; refuse twice &rarr; rollback to the byte).</p>
</details>
</main>
</body></html>
"""
open(os.path.join(here, 'G3-CRYPTO-GEIGER.html'), 'w').write(page)
print('written', len(page))
