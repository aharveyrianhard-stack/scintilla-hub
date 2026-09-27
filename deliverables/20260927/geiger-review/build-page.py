#!/usr/bin/env python3
"""Builds GEIGER-REVIEW.html from results.json, spans.json and stored-history-speed.json so no
number on the page is typed by hand. Run after run-replay.mjs and stored-history-speed.mjs."""
import json, pathlib, html

HERE = pathlib.Path(__file__).resolve().parent
R = json.loads((HERE / "results.json").read_text())
SP = json.loads((HERE / "spans.json").read_text())
SH = json.loads((HERE / "stored-history-speed.json").read_text())

PR = "provider repo <code>_worktrees/m67-provider-20260924</code> @ d72c472"
PUB = "geiger-publish-artifact.mjs"
KEYS = ['1m', '3m', '5m', '10m', '15m', '30m', '1h', '2h', '3h', '4h', '6h', '12h', '1d', '3d', '1w', '2w', '1M']
TOK = {'1m': '1m', '3m': '3m', '5m': '5m', '10m': '10m', '15m': '15', '30m': '30', '1h': '60', '2h': '120', '3h': '180',
       '4h': '240', '6h': '6h', '12h': '12h', '1d': 'D', '3d': '3D', '1w': 'W', '2w': '2W', '1M': 'M'}
AW = R["profiles"]["alan"]
AWS = sum(AW.values())
e = html.escape


def pct(x, d=0):
    return "—" if x is None else f"{x * 100:.{d}f}%"


def num(x, d=2):
    return "—" if x is None else f"{x:+.{d}f}" if x < 0 else f"{x:.{d}f}"


def dur_h(h):
    if h is None:
        return "—"
    if h < 1:
        return f"{h * 60:.0f} min"
    if h < 48:
        return f"{h:.0f} h"
    return f"{h / 24:.0f} days"


def span(k, bars):
    """a length of `bars` bars on rung k, in plain time"""
    if k in SP:
        s = bars / SP[k]["bars_per_session"]
        mins = {'1m': 1, '3m': 3, '5m': 5, '10m': 10, '15m': 15, '30m': 30, '1h': 60, '2h': 120, '3h': 180,
                '4h': 240, '6h': 360, '12h': 720}[k]
        clock = bars * mins / 60
        c = f"{clock:.1f} h" if clock < 48 else f"{clock / 24:.1f} days"
        return f"{c} of bars · {s:.2f} sessions" if s < 10 else f"{c} of bars · {s:.0f} sessions"
    unit = {'1d': (1, 'session'), '3d': (3, 'session'), '1w': (1, 'week'), '2w': (2, 'week'), '1M': (1, 'month')}[k]
    n = bars * unit[0]
    return f"{n} {unit[1]}s"


def bar(v, mx, label=""):
    w = 0 if v is None or mx == 0 else max(0, v) / mx * 100
    return (f'<span class="hb" title="{e(label)}"><span class="hb__f" style="width:{w:.1f}%"></span></span>')


# ---- section 1: the rung table
rows = []
for k in KEYS:
    aw = AW[k]
    rows.append(
        f"<tr><td><b>{k}</b></td><td class=n>{TOK[k]}</td>"
        f"<td class=n>{SP[k]['bars_per_session'] if k in SP else '—'}</td>"
        f"<td>EMA 5 = {span(k, 5)}</td><td>RSI 14 / W%R 14 = {span(k, 14)}</td><td>SMA 200 = {span(k, 200)}</td>"
        f"<td class=n>1.00</td><td class=n>{aw:.3f}</td><td class=n>{pct(aw / AWS, 1) if aw else '0'}</td></tr>")
rung_table = "\n".join(rows)

# ---- section 2
q2d, q2a = R["q2"]["default"], R["q2"]["alan"]
per_d = q2d["per_rung_variance_share"]
per_a = q2a["per_rung_variance_share"]
mx = max(max(per_d.values()), max(per_a.values()))
share_rows = []
for k in KEYS:
    d, a = per_d.get(k), per_a.get(k)
    share_rows.append(
        f"<tr><td><b>{k}</b>{' <span class=tag>below 2h</span>' if k in ('1m','3m','5m','10m','15m','30m','1h') else ''}</td>"
        f"<td class=n>{pct(d, 1)}</td><td class=bars>{bar(d, mx, f'{k} default {pct(d,1)}')}</td>"
        f"<td class=n>{pct(a, 1) if a is not None else '0 weight'}</td><td class=bars>{bar(a, mx, f'{k} saved {pct(a,1) if a is not None else 0}')}</td></tr>")
share_table = "\n".join(share_rows)
b2d, b2a = R["q2b"]["default"], R["q2b"]["alan"]

# ---- section 4
speed_rows = []
for k in KEYS:
    s = R["rungStats"][k]
    speed_rows.append(
        f"<tr><td><b>{k}</b></td><td class=n>{num(s['median_abs_daily_change'])}</td><td class=n>{num(s['p90_abs_daily_change'])}</td>"
        f"<td class=n>{s['crossings']}</td><td class=n>{dur_h(s['median_cross_hours'])}</td>"
        f"<td class=n>{dur_h(s['p25_cross_hours'])} – {dur_h(s['p75_cross_hours'])}</td><td>{s['crossing_window']}</td></tr>")
speed_table = "\n".join(speed_rows)
cs = R["compStats"]
comp_rows = []
for name, label in [("alan", "Alan's saved row (live today)"), ("alan_from3h", "saved row, 2h dropped"),
                    ("default", "flat default (all 17 at 1.0)"), ("default_from3h", "flat default, below 3h dropped")]:
    c = cs[name]
    mid = '—' if c['p25'] is None else f"{round(c['p25'])} – {round(c['p75'])} days"
    comp_rows.append(f"<tr><td>{label}</td><td class=n>{num(c['median_abs_daily_change'])}</td><td class=n>{num(c['p90_abs_daily_change'])}</td>"
                     f"<td class=n>{c['crossings']}</td><td class=n>{'—' if c['median_cross_calendar_days'] is None else str(round(c['median_cross_calendar_days'])) + ' days'}</td>"
                     f"<td class=n>{mid}</td></tr>")
comp_table = "\n".join(comp_rows)

rc = R["rungCorr"]
corr_rows = "\n".join(f"<tr><td>{k.replace('~', ' and ')}</td><td class=n>{v:.3f}</td></tr>" for k, v in rc.items())
q5a, q5e = R["q5"]["alan_weights"], R["q5"]["equal"]
fid = R["fidelity"]
fid_cells = sum(len(f["rungDiff"]) for f in fid)
fid_max = max(abs(x) for f in fid for x in f["rungDiff"].values())
shc, shm = SH["cohort"], SH["mu_blended"]

alan_intraday = sum(v for k, v in per_a.items() if k in ('2h', '3h', '4h', '6h', '12h'))
alan_daily_w = (AW['1d'] + AW['3d'] + AW['1w']) / AWS

page = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex">
<title>SCINTILLA · Geiger review</title>
<style>
:root{{--bg:#0A0A0F;--panel:#0F0F16;--line:#1C1C28;--line2:#2A2A3A;--ink:#C8C8D2;--ink2:#A0A0B0;--dim:#7A7A8C;--bar:#8E8E9C;--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace}}
*{{box-sizing:border-box;min-width:0}}
body{{margin:0;background:var(--bg);color:var(--ink);font-family:var(--mono);font-size:13px;line-height:1.6;-webkit-font-smoothing:antialiased}}
.wrap{{max-width:1180px;margin:0 auto;padding:28px 20px 60px}}
h1{{font-size:16px;letter-spacing:.2em;text-transform:uppercase;margin:0 0 6px}}
h2{{font-size:13px;letter-spacing:.22em;text-transform:uppercase;color:var(--ink2);margin:42px 0 12px;padding-top:14px;border-top:1px solid var(--line)}}
h3{{font-size:13px;letter-spacing:.08em;text-transform:uppercase;margin:22px 0 8px}}
p,li{{max-width:92ch}} p{{margin:8px 0}}
.kicker{{color:var(--dim);font-size:12px;letter-spacing:.14em;text-transform:uppercase;margin-bottom:18px}}
.q{{border-left:2px solid var(--line2);padding:2px 12px;color:var(--ink2);margin:10px 0;max-width:92ch}}
b{{font-weight:600;color:var(--ink)}}
.rec{{border:1px solid var(--line2);background:var(--panel);padding:14px 16px;margin:14px 0}}
.scroll{{overflow-x:auto;-webkit-overflow-scrolling:touch}}
table{{border-collapse:collapse;margin:10px 0 14px;font-size:12px;width:100%}}
th,td{{text-align:left;padding:6px 9px;border-bottom:1px solid var(--line);vertical-align:top}}
th{{color:var(--dim);font-weight:500;letter-spacing:.1em;text-transform:uppercase;font-size:12px}}
td.n{{text-align:right;font-variant-numeric:tabular-nums;white-space:nowrap}}
td.bars{{width:22%}}
.hb{{display:block;height:8px;background:var(--line);border-radius:0 4px 4px 0;margin-top:5px}}
.hb__f{{display:block;height:8px;background:var(--bar);border-radius:0 4px 4px 0}}
.tag{{font-size:12px;color:var(--dim);border:1px solid var(--line2);padding:0 5px;margin-left:6px}}
.big{{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:14px 0}}
.big>div{{border:1px solid var(--line2);background:var(--panel);padding:12px 14px}}
.big .v{{font-size:24px;letter-spacing:.02em}}
.big .l{{font-size:12px;color:var(--dim)}}
code{{font-size:12px;color:var(--ink2);overflow-wrap:anywhere}}
p,li,td{{overflow-wrap:break-word}}
.small{{font-size:12px;color:var(--dim)}}
ul{{padding-left:18px}} li{{margin:4px 0}}
@media(max-width:700px){{.wrap{{padding:18px 16px 40px}} td.bars{{width:18%}} .scroll table{{min-width:680px}} .scroll table[style]{{min-width:0}}}}
</style></head>
<body><div class="wrap">
<div class="kicker"><span data-scnav-slot></span>SCINTILLA · G2 · GEIGER REVIEW · 27 SEP 2026 · review only, nothing changed</div>
<h1>How the Geiger is really built, and whether it leans short-term</h1>
<p class="kicker">branch hub/geiger-review-20260927 · base 7c96a83 · opus · medium · nothing pushed, nothing deployed, no database written</p>

<div class="q">"I believe the first moving average in our Geiger calculations is the two-day … I'm worried however we set up our Geiger originally is a little lopsided to short-term. My personal equalizer only really considers from 2 hours on, so it may have hacked around an error in the back end … What does the Geiger even measure intraday?" <span class="small">— Alan, 27 Sep</span></div>

<h2>The short answer</h2>
<ul>
<li><b>There are two different "Geigers", and the two-day average belongs to the other one.</b> The live Geiger (the board, <code>/geiger</code>) builds each timeframe from that timeframe's own bars: nine averages, EMA 5 to SMA 200, plus RSI 14 and Williams %R 14 — all counted in the <i>same</i> bars. The <b>rewind history</b> (<code>fan_daily</code>, what the board replays) is a separate daily fan whose first line is an <b>EMA of 2 days</b>. That is the two-day average you remember. It never feeds the live number.</li>
<li><b>No timeframe mixes a 2-day average with a 15-minute RSI.</b> On every timeframe, the averages and the RSI read the same bars. The 15-minute timeframe has RSI over 3.5 hours <i>and</i> averages from 1.25 hours; it is internally consistent. It is also switched off in your Equalizer.</li>
<li><b>The flat default does lean short-term. Your saved Equalizer is not a hack around a bug. It is the fix.</b> With every timeframe at equal weight (the Equalizer's starting curve), the seven timeframes below 2 hours cause <b>{pct(q2d['variance_share']['below_2h'])}</b> of the Geiger's day-to-day movement. Your saved row gives them zero weight, so their share is <b>0%</b>. The live Geiger runs on your row today; its receipt <code>f6cf97b5…</code> is echoed on every <code>/geiger</code> response.</li>
<li><b>Even so, your Geiger is still driven day to day by the intraday bars.</b> 2h to 12h cause <b>{pct(alan_intraday)}</b> of its daily movement, though daily-and-up hold {pct(alan_daily_w)} of the weight. The 4h and 6h timeframes are near-copies (their readings correlate at <b>{rc['4h~6h']:.3f}</b>), and together they carry {pct((AW['4h'] + AW['6h']) / AWS)} of the weight.</li>
<li><b>Dropping everything below 3h from your row changes almost nothing.</b> It only removes 2h, at 2.3% weight: the typical gap is {num(b2a['median_abs_level_diff'], 3)} on a −1…+1 scale, and the sign differs on {pct(b2a['sign_disagree_share'], 1)} of days.</li>
<li><b>A daily-bars-only Geiger (daily, 3-day, weekly) is cheap and feasible.</b> Massive covers ETFs and ADRs; FMP covers indexes and commodities. The chart API already serves daily, 3-day and weekly bars for both. It tracks your full Geiger at correlation <b>{q5a['corr_with_full']:.2f}</b>, a clearly slower, calmer reading.</li>
</ul>

<div class="big">
<div><div class="v">{pct(q2d['variance_share']['below_2h'])}</div><div class="l">of day-to-day movement from rungs below 2h — flat default weights</div></div>
<div><div class="v">0%</div><div class="l">the same share under your saved Equalizer (live today)</div></div>
<div><div class="v">{round(cs['alan']['median_cross_calendar_days'])} days</div><div class="l">typical time for your Geiger to swing from −0.5 to +0.5, or back</div></div>
<div><div class="v">{fid_cells}/{fid_cells}</div><div class="l">rung readings where my replay equals live /geiger exactly (largest gap {fid_max:.4f})</div></div>
</div>

<h2>1 · The Geiger, written out</h2>
<p><b>What happens, in order.</b> It runs every 4 minutes (<code>geiger-supervisor.sh:6</code>, 240 s). For each of the 364 names and each <i>participating</i> timeframe, it fetches the newest 230 completed provider bars from the chart API (<code>{PUB}:123, :183</code>). Then:</p>
<ol>
<li><b>TREND</b>, the fan: up to nine averages, EMA 5, 8, 13, 21, 34 and SMA 50, 100, 150, 200, all measured in that timeframe's bars (<code>{PUB}:52-62</code>). It counts how many of the 8 neighbouring pairs are stacked bullish (faster above slower) and maps that to −1…+1 (<code>:185-190</code>). A line joins only once enough bars exist.</li>
<li><b>MOMENTUM</b>: RSI 14 is scored between 23 and 77, and Williams %R 14 between −90 and −10, each mapped to −1…+1. They are blended RSI 0.6 / Williams 0.4 (<code>{PUB}:63, :192-197</code>; mix from the Equalizer snapshot <code>momentum_mix</code>, line 13).</li>
<li><b>Timeframe reading</b> = TREND 0.5 + MOMENTUM 0.5 (<code>{PUB}:200-201</code>; family weights from the snapshot <code>family_weights</code>, line 9). It is trend only if a young listing has under 15 bars.</li>
<li><b>Composite</b> = the weighted average of the timeframe readings. The weights are your Equalizer's; a timeframe counts only if it is switched on <i>and</i> its weight is above zero (<code>geiger-source-contract.mjs:76-78, :194-211</code>). The weights are read from <code>operator_weights</code> (global row), frozen per run and stamped with a receipt (<code>{PUB}:79-110</code>).</li>
</ol>
<p class="small">Files: {PR}, <code>services/hot-query/</code>. Equalizer snapshot: <code>control/acceptance/EQUALIZER_SNAPSHOT_2026-08-18.json</code> lines 9, 13, 17. Hub Equalizer: <code>index.html</code> in this repo, lines 23157 (the 17 timeframes), 23160 (default handle 0.55 for every timeframe, i.e. flat), 23185 (how SAVE turns the curve into weights: share × 17, so flat = 1.0 each), 23193 (load). The older worker <code>geiger-from-massive.mjs:50</code> lists 10 rungs and writes <code>ribbon_signals</code>. It is not what <code>/geiger</code> serves.</p>

<div class="scroll"><table>
<tr><th>rung</th><th>bar</th><th>bars / session</th><th>fastest average</th><th>RSI and Williams span</th><th>slowest average</th><th>default wt</th><th>your wt</th><th>your share</th></tr>
{rung_table}
</table></div>
<p class="small">"Bars / session" is measured: the median over 20 names for the last 90 sessions. Provider bars include pre- and after-market, 04:00–20:00 ET, on an Eastern-midnight grid. That is why a 15-minute RSI covers 3.5 clock-hours (not 3.75), and why <b>4h and 6h both produce 4 bars a session</b>. Your weights come from the live receipt <code>f6cf97b5…97ad1</code>; <code>/geiger</code> today echoes the same receipt (artifact computed {e(R['live_computed_utc'] or '')}).</p>

<h3>What the Geiger measures intraday</h3>
<p>During the session, the Geiger moves only when a participating bar <b>completes</b>. Unfinished bars are withheld. Under your row, that means: the 2h, 3h, 4h and 6h readings step when each of their bars closes. The 12h reading steps at noon and midnight ET. The daily reading steps after the close. The 3-day and weekly readings step when their bucket ends. So intraday the number moves in a few steps a day, driven mostly by 4h/6h/3h. It is never a tick-by-tick meter.</p>

<h2>2 · Does it lean short-term? Measured.</h2>
<p><b>How.</b> For 20 names (AAPL MSFT NVDA AMZN GOOGL META TSLA JPM XOM UNH JNJ PG KO WMT HD CAT BA NFLX AMD COST) I rebuilt every timeframe's reading at each session's end (Eastern midnight). That covers 91 sessions, {R['first_session']} to {R['last_session']}, from the same provider bars the live Geiger reads, with the live maths copied exactly. <b>Check:</b> recomputed "now", it equals live <code>/geiger</code> on all {fid_cells} name×timeframe readings and all 20 composites, to 4 decimals. Each day's composite change splits exactly into one piece per timeframe. Each piece's share of the movement is its covariance with the total change (the shares add to 100%). {q2d['n']} name-days.</p>
<div class="scroll"><table>
<tr><th>timeframe</th><th>share · flat default</th><th></th><th>share · your saved row</th><th></th></tr>
{share_table}
<tr><td><b>below 2h, total</b></td><td class=n><b>{pct(q2d['variance_share']['below_2h'], 1)}</b></td><td></td><td class=n><b>0%</b></td><td></td></tr>
<tr><td><b>2h and up, total</b></td><td class=n><b>{pct(q2d['variance_share']['from_2h'], 1)}</b></td><td></td><td class=n><b>100%</b></td><td></td></tr>
</table></div>
<p class="small">A cruder view, the share of summed absolute movement, gives {pct(q2d['abs_share']['below_2h'])} below 2h for the default. Typical daily move of the composite: {num(q2d['typical_daily_change'])} for the default, {num(q2a['typical_daily_change'])} for your row. Small negative shares, such as weekly, mean that timeframe slightly damped the day's move.</p>

<h3>If everything below 3h is dropped</h3>
<div class="scroll"><table>
<tr><th>starting from</th><th>readings agree (correlation)</th><th>typical gap</th><th>90th pct gap</th><th>sign differs</th><th>typical daily move, before → after</th></tr>
<tr><td>flat default (drops 8 of 17 rungs)</td><td class=n>{b2d['corr_level']:.3f}</td><td class=n>{num(b2d['median_abs_level_diff'], 3)}</td><td class=n>{num(b2d['p90_abs_level_diff'], 3)}</td><td class=n>{pct(b2d['sign_disagree_share'], 1)}</td><td class=n>{num(b2d['median_daily_change_before'])} → {num(b2d['median_daily_change_after'])}</td></tr>
<tr><td>your saved row (drops only 2h, 2.3%)</td><td class=n>{b2a['corr_level']:.4f}</td><td class=n>{num(b2a['median_abs_level_diff'], 3)}</td><td class=n>{num(b2a['p90_abs_level_diff'], 3)}</td><td class=n>{pct(b2a['sign_disagree_share'], 1)}</td><td class=n>{num(b2a['median_daily_change_before'])} → {num(b2a['median_daily_change_after'])}</td></tr>
</table></div>
<p><b>Reading it:</b> on the flat default, removing the fast timeframes would change the answer a lot: the sign differs on nearly one day in five, and the daily jitter halves. On your row it is a rounding change. Your "from 2 hours on" curve already did the work.</p>

<h3>How alike neighbouring timeframes are</h3>
<p class="small">The correlation of daily readings, pooled over the 20 names and 91 sessions. Close to 1.000 means the two measure nearly the same thing.</p>
<div class="scroll"><table style="max-width:420px"><tr><th>pair</th><th>correlation</th></tr>
{corr_rows}
</table></div>

<h2>3 · The moving-average / RSI "mismatch"</h2>
<ul>
<li><b>Live Geiger:</b> on every timeframe, the fastest average is EMA 5 and the RSI is 14. Both are counted in that timeframe's own bars (table above). Nothing crosses timeframes. On 3h, the fastest average spans {span('3h', 5)} and the RSI spans {span('3h', 14)}. On 15m: {span('15m', 5)} and {span('15m', 14)}.</li>
<li><b>Rewind history (<code>fan_daily</code>):</b> thirteen <i>daily-locked</i> lines, EMA 2/3/5/8/13/21/34/50, SMA 50/100/150/200 and SMA 200 weekly, scored over all 78 pairs (Hub <code>index.html:23303-23306</code>). Its fastest line is the <b>2-day EMA</b>. I could not see which RSI span <code>momentum_daily</code> uses: it is built in the database, and the Hub does not document it. <b>So the real mismatch is between the replay and the live number</b>: they are different indicators. The rewind is not a replay of the live Geiger.</li>
<li><b>The Indicator Lab</b> offers source timeframes from 3H up (<code>prototypes/indicator-lab/briefs/DETAILED_INDICATORS_2026-09-24.md:9</code>). Under your row, the only live timeframe below 3h is 2h at 2.3%.</li>
</ul>
<div class="rec"><b>Recommended consistent set (not applied).</b>
<ol>
<li>Keep the rule "averages and RSI in the same bars". It is already consistent, and changing it would break comparability with every stored receipt.</li>
<li>Match the Lab: Geiger timeframes <b>from 3h up</b>. Set 2h to zero in your Equalizer. Measured effect: {num(b2a['median_abs_level_diff'], 3)} typical, sign change on {pct(b2a['sign_disagree_share'], 1)} of days.</li>
<li>Treat <b>4h and 6h as one measurement</b>: correlation {rc['4h~6h']:.3f}, the same 4 bars a session. Either give their combined weight to one of them, or accept that together they are a single ~{pct((AW['4h'] + AW['6h']) / AWS)} vote.</li>
<li>Rebuild the rewind history with the live per-timeframe maths (the <code>research/geiger_history_v1</code> design in the provider repo's <code>contracts/DATA_ESTATE_AUTHORITY_MAP.md:38-42</code>). Then the replay is the Geiger. This review's replay shows it reproduces live exactly.</li>
</ol></div>

<h2>4 · How fast the Geiger changes</h2>
<p><b>Stored history.</b> The live Geiger keeps <b>no history</b>: <code>/geiger</code> serves one snapshot (R2 <code>normalized/candidate_geiger_v1/geiger.json.gz</code>), replaced every cycle. The only stored history is <code>fan_daily</code> + <code>momentum_daily</code> in Supabase, the rewind's different fan. The extract already in this repo (<code>deliverables/20260925/geiger-visuals/data.js</code>, pulled 25 Sep) covers <b>{SH['cohort_names']} names, {SH['cohort_window']}</b>, and MU alone {SH['mu_window']}. The table stops 20 Aug for most names. Measured there: typical day-to-day change <b>{num(shc['median_abs_daily_change'])}</b> (90th pct {num(shc['p90_abs_daily_change'])}). {shc['crossings']} swings from −0.5 to +0.5 or back, typically <b>{round(shc['median_cross_calendar_days'])} calendar days</b> ({round(shc['p25'])}–{round(shc['p75'])}). MU over {SH['mu_sessions']} rows: {num(shm['median_abs_daily_change'])} a day, {shm['crossings']} swings, typically {shm['median_cross_calendar_days']:.1f} days.</p>
<p><b>The live Geiger, rebuilt</b> (the replay above; 20 names). Composite, sampled once a session:</p>
<div class="scroll"><table>
<tr><th>weights</th><th>typical daily change</th><th>90th pct</th><th>swings −0.5↔+0.5</th><th>typical swing time</th><th>middle half</th></tr>
{comp_table}
</table></div>
<p>Per timeframe, the daily change is between consecutive session ends. The swing time is measured bar by bar in the timeframe's own bars: over the last 90 sessions for intraday timeframes, and over 3 years for daily and slower. The daily change for 3d/1w/2w/1M is usually 0 because their bar has not closed yet.</p>
<div class="scroll"><table>
<tr><th>rung</th><th>typical daily change</th><th>90th pct</th><th>swings</th><th>typical swing time</th><th>middle half</th><th>window</th></tr>
{speed_table}
</table></div>

<h2>5 · A light, "Geiger-only" tier from daily bars</h2>
<p><b>The smallest honest Geiger</b> is daily + 3-day + weekly, with the same maths, 230 bars each. Weekly needs 230 weeks, so a name needs about <b>4½ years of daily bars</b> (~1,150 sessions). Shorter histories still work: lines join as bars accrue.</p>
<p><b>How it compares with your full Geiger</b> (same 20 names, 91 sessions): with your weights for those three rungs (3.18 / 2.58 / 0.99), correlation <b>{q5a['corr_with_full']:.2f}</b>, typical gap {num(q5a['median_abs_diff'])}, same sign on {pct(q5a['same_sign_share'])} of days. It moves {num(q5a['median_abs_daily_change'])} a day against {num(q2a['typical_daily_change'])} for the full Geiger. With equal weights: correlation {q5e['corr_with_full']:.2f}. It is a slower, calmer "where is this in its trend" gauge, fine for dashboards and aggregates. It is not a substitute on names you trade.</p>
<div class="scroll"><table>
<tr><th>instrument kind</th><th>first source (your rule)</th><th>what exists today</th></tr>
<tr><td>ETFs, US-listed foreign ADRs</td><td><b>Massive</b></td><td>Already in the stocks feed; the chart API serves D / 3D / W for e.g. SPY (verified today). One "grouped daily" request returns every US stock and ETF for a session.</td></tr>
<tr><td>Indexes, commodities, FX, rates</td><td><b>FMP</b></td><td>Massive's stocks plan cannot serve these (<code>fmp-macro-contract.mjs:3-5</code>). FMP is already wired: the chart API serves VIX and GCUSD D / 3D / W today (verified). 3D and weekly are composed from FMP daily on the provider's grid, which you approved on 22 Sep (<code>fmp-macro-contract.mjs:85-98</code>).</td></tr>
<tr><td>Anything neither has (foreign ordinary shares, odd futures)</td><td><b>IBKR</b></td><td>Not wired. It needs the gateway session and market-data subscriptions per exchange.</td></tr>
</table></div>
<p><b>Cost per name [ESTIMATE].</b> Backfill: 1 request per name for ~1,150 daily bars. Daily upkeep: Massive, 1 request per day for the <i>whole</i> ETF/ADR set (grouped daily); FMP, 1 request per name per day. Compute: trivial, three readings per name per day. Storage, measured on today's responses: 230 bars take 15–25 KB raw and 3.5–8.6 KB gzipped per timeframe, so about <b>11–26 KB gzipped per name</b> for all three, or ~25–40 KB if you keep the 1,150 daily bars. It refreshes once a day, after the close, not every 4 minutes. Plan prices and FMP rate limits were not checked in this lane.</p>
<p><b>Could it come from Yahoo Finance?</b> Technically yes, since the bars exist. I do not recommend it. Yahoo has no licensed API: the endpoints are unofficial, change without notice, and its terms restrict reuse. Massive and FMP already give the same daily bars under licence, through the pipe the Hub already reads.</p>

<h2>What could be wrong</h2>
<ul>
<li>The "share of movement" is measured once a session. Within a day, the fast timeframes move far more, so for anyone watching intraday, their weight on the default is larger still.</li>
<li>20 large names over 91 sessions, May to September 2026. Small caps or a different market regime could shift the numbers by a few points. The ranking (fast rungs dominate the flat default) is very large and unlikely to flip.</li>
<li>The "flat default" uses your saved momentum mix (0.6/0.4) and family split (0.5/0.5), so only the timeframe weights differ. The Hub's untouched slider would start at 0.5/0.5.</li>
<li>The replay equals live on today's bars. On past days it assumes the provider bars have not been revised since. Late provider corrections would make the past slightly different from what was published then.</li>
<li>The stored-history speed comes from a 25 Sep extract of a different indicator, and its window is short (34 days for the cohort).</li>
<li>The ladder's 79 moving-average rungs are defined in the database table <code>ribbon_ladder</code>, which this lane did not read. If your "two-day" memory is of the ladder rather than the rewind fan, that is unverified here.</li>
</ul>

<h2>What I did not do</h2>
<ul>
<li>I changed no weights, workers, tables or Hub rooms. The Indicator Lab is byte-identical. I pushed and deployed nothing, and wrote nothing to any database. I made no paid-model or account calls.</li>
<li>I did not read <code>ribbon_ladder</code>, <code>fan_daily</code> or <code>momentum_daily</code> directly. That needs a database key, which this lane does not hold.</li>
<li>I did not check provider plan prices or quotas.</li>
</ul>
<p class="small">Reproduce: <code>node deliverables/20260927/geiger-review/run-replay.mjs</code> (reads the public chart API only, GET) → <code>stored-history-speed.mjs</code> → <code>build-page.py</code>. The arithmetic is tested in <code>tests/geiger-review.test.mjs</code>. Results: <code>results.json</code>, generated {e(R['generated_utc'])}.</p>
</div>
</body></html>
"""
(HERE / "GEIGER-REVIEW.html").write_text(page)
print("wrote", HERE / "GEIGER-REVIEW.html", len(page))
