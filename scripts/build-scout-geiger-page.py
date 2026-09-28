# Builds deliverables/20260928/scout-geiger/SCOUT-GEIGER.html from the data files build-scout-geiger.mjs wrote.
import json, html, os
D = 'deliverables/20260928/scout-geiger/'
run = json.load(open(D + 'data/run.json')); tr = json.load(open(D + 'data/tracking-vs-full.json'))
nodes = json.load(open(D + 'data/nodes.json')); ad = json.load(open(D + 'data/admissions.json'))
e = html.escape
def g(x, d=2):
    if x is None: return '<span class="mu">—</span>'
    return f'<span class="{"up" if x >= 0 else "dn"}">{x:+.{d}f}</span>'
def gbar(x):
    if x is None: return ''
    w = min(1, abs(x)) * 50
    return f'<span class="gb"><s></s><i class="{"u" if x >= 0 else "d"}" style="width:{w:.1f}%"></i></span>'
F = [n for n in nodes if n['kind'] == 'fund']
Fb = [n for n in F if n.get('blend_scout') is not None and n.get('own_scout') is not None]
ext = sum(1 for n in Fb if abs(n['own_scout']) > abs(n['blend_scout']))
R = ad['ranked']; hub = [r for r in R if r['recommendation'] == 'FULL HUB']; alan = [r for r in R if r['recommendation'] == 'ALAN DECIDES']
cnt = {}
for r in R: cnt[r['recommendation']] = cnt.get(r['recommendation'], 0) + 1
st = {}
for r in R: st[r['status']] = st.get(r['status'], 0) + 1
c = run['counts']; eq = run['equalizer']
fundrows = ''.join(f"<tr><td>{e(n['ticker'])}</td><td class='nm'>{e(n['label'] or '')}</td><td>{'full' if n['served'] else 'waiting'}</td><td class='r'>{g(n.get('own_full'))}</td><td class='r'>{g(n.get('own_scout'))}</td><td>{gbar(n.get('blend_scout'))}</td><td class='r'>{g(n.get('blend_scout'))}</td><td class='r'>{(n.get('coverage_scout_pct') or 0):.0f}%</td><td class='r'>{(n.get('coverage_full_pct') or 0):.0f}%</td><td class='r'>{g(n.get('divergence_own_minus_blend'))}</td></tr>"
  for n in sorted(F, key=lambda n: -(n.get('coverage_scout_pct') or 0)))
def admrow(r):
    rng = r.get('gap_closed_90') or [None, None]
    fl = ' · '.join(f"{x['fund']} {x['w']:.2f}%" for x in r['funds'])
    rec = {'FULL HUB': '<b class="hub">FULL HUB</b>', 'ALAN DECIDES': '<b>ALAN DECIDES</b>'}.get(r['recommendation'], '<span class="mu">scout only</span>')
    gap = f"{g(r['gap_closed'], 3)} <span class='mu'>({rng[0]:+.3f} to {rng[1]:+.3f})</span>" if r.get('gap_closed') is not None else '<span class="mu">—</span>'
    return f"<tr><td class='r'>{r['rank']}</td><td>{e(r['ticker'])}</td><td>{e(r['best_fund'])}</td><td class='r'>{gap}</td><td>{e(str(r['status']).replace('_', ' ').lower())}</td><td class='r'>{'' if r.get('percentile_vs_served') is None else r['percentile_vs_served']}</td><td>{rec}</td><td class='nm'>{e(r['why'])}<div class='mu'>{e(fl)}</div></td></tr>"
admrows = ''.join(admrow(r) for r in R)
hubl = ', '.join(f"<b>{e(r['ticker'])}</b> ({e(r['best_fund'])}, {r['gap_closed']:+.3f})" for r in hub)
kre = sorted(alan, key=lambda r: -(r['funds'][0].get('alone_corr') or 0))
krel = ', '.join(f"{e(r['ticker'])} {r['funds'][0]['alone_corr']:.2f}" for r in kre)
P = tr['gap_percentiles']
page = f"""<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Scout Geiger · 28 Sep</title>
<style>
:root{{--bg:#0d0d0d;--panel:#141414;--line:#262626;--ink:#c8c8c8;--mu:#8c8c8c;--dim:#5a5a5a;--up:#35b06a;--dn:#d1483f;--track:#1f1f1f}}
body{{margin:0;background:var(--bg);color:var(--ink);font:13px/1.55 ui-monospace,Menlo,monospace}}
main{{max-width:1180px;margin:0 auto;padding:18px 16px 60px}}
h1{{font-size:18px;letter-spacing:.08em;margin:8px 0 2px}} h2{{font-size:14px;letter-spacing:.08em;margin:34px 0 8px;border-bottom:1px solid var(--line);padding-bottom:6px}}
.sub,.mu{{color:var(--mu)}} .up{{color:var(--up)}} .dn{{color:var(--dn)}} b.hub{{color:#d2d2d2}}
.box{{background:var(--panel);border:1px solid var(--line);border-radius:4px;padding:12px 14px;margin:10px 0}}
.kpis{{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:8px}} .kpi{{background:var(--panel);border:1px solid var(--line);padding:10px;border-radius:4px}}
.kpi b{{display:block;font-size:20px;color:#d2d2d2}} .kpi span{{color:var(--mu);font-size:11px}}
img{{max-width:100%;border:1px solid var(--line);border-radius:4px;display:block;margin:8px 0}}
.two{{display:grid;grid-template-columns:1fr 1fr;gap:10px}} @media(max-width:760px){{.two{{grid-template-columns:1fr}}}}
.tw{{overflow-x:auto;max-height:620px;overflow-y:auto;border:1px solid var(--line);border-radius:4px}}
table{{border-collapse:collapse;width:100%;font-size:12px}} th,td{{padding:4px 7px;border-bottom:1px solid #1c1c1c;text-align:left;vertical-align:top}}
th{{position:sticky;top:0;background:#181818;color:var(--mu);font-weight:normal}} td.r,th.r{{text-align:right;white-space:nowrap}} td.nm{{color:var(--mu);min-width:200px}}
.gb{{display:inline-block;width:70px;height:10px;background:var(--track);position:relative;border-radius:2px;overflow:hidden;vertical-align:middle}}
.gb s{{position:absolute;left:50%;top:0;bottom:0;width:1px;background:var(--dim)}} .gb i{{position:absolute;top:1px;bottom:1px;border-radius:2px}}
.gb i.u{{left:50%;background:var(--up)}} .gb i.d{{right:50%;background:var(--dn)}}
code{{color:#b4b4b4}} li{{margin:3px 0}}
</style></head><body><main>
<h1>SCOUT GEIGER</h1>
<div class="sub">N4 · 28 Sep 2026 · a lightweight Geiger for every US stock and every tree fund, computed off the Hub · Opus · Urth</div>

<div class="box"><b>Alan asked:</b> "An off-Hub Geiger computation would be really nice — simple, basic, back-end calculations at scale, that doesn't go on the Hub. What would we need for a lightweight version?"<br><br>
<b>Answer:</b> one small nightly job and one table. It is built and it was run twice today. It takes about <b>2 minutes</b> on a temporary Fly machine: it reads the Massive daily files for the last 1,121 trading days and makes about 30 Massive calls. It scored <b>{c['rows']:,}</b> tickers as of the {e(run['as_of'])} close: {c['common_rows']:,} US common stocks, {c['etf_rows']} listed ETFs and {c['rows']-c['common_rows']-c['etf_rows']} other lines from the tree. It uses the Hub Geiger's own maths on its three daily-bar rungs (daily, 3-day, weekly) and nothing else. Nothing goes on the Hub except a slim bar on the market map, where the full Geiger has no reading.</div>

<div class="kpis">
<div class="kpi"><b>{c['rows']:,}</b><span>tickers scored in one run (the {e(run['as_of'])} close)</span></div>
<div class="kpi"><b>{tr['correlation']:.3f}</b><span>correlation with the full Geiger on the 486 served names (90% range {tr['correlation_90'][0]:.3f}–{tr['correlation_90'][1]:.3f})</span></div>
<div class="kpi"><b>{tr['mean_abs_gap']:.3f}</b><span>mean gap to the full Geiger (points on the −1…+1 scale); scout higher by {tr['mean_signed_gap']:+.3f} on average</span></div>
<div class="kpi"><b>99%</b><span>median share of a fund's weight the scout blend reads (the full Geiger reads 56%)</span></div>
<div class="kpi"><b>{cnt.get('FULL HUB',0)} · {cnt.get('SCOUT ONLY',0)} · {cnt.get('ALAN DECIDES',0)}</b><span>of the 216 proposed names: full Hub · scout only · for you (KRE)</span></div>
</div>

<h2>WHAT IS LIVE RIGHT NOW</h2>
<div class="box"><b>Nothing of the scout Geiger runs by itself yet.</b> The brief said "no deploy", and the shared rules say the coordinator runs Fly jobs, schedules and database changes. What exists:
<ul>
<li><b>Code</b>, pushed: provider branch <code>provider/scout-geiger-20260928</code> (the job, the table migration 0022 with its rollback, and a read-only chart API route <code>/v1/scout-geiger</code>). Hub branch <code>candidate/scout-geiger-20260928</code> (this page, and the map's slim bars fed by a snapshot file).</li>
<li><b>Two temporary runs today</b>, 13:54 and 13:58 ET, on machines that were removed afterwards. They were read-only: nothing was written to R2 or to any table. Their output file is where every number on this page comes from.</li>
<li><b>Fly schedule: not installed. Table <code>massive_stocks.scout_geiger_daily</code>: not created, 0 rows.</b> The exact commands are in <code>runbooks/SCOUT_GEIGER.md</code> on the provider branch. Order: image, table, first write, nightly schedule (hourly; it does its work once, after 20:15 ET). Expect about 5,600 rows a night.</li>
<li><b>The map</b> gets its slim bars from a snapshot file of this run (as of {e(run['as_of'])}). Once the nightly job and the chart API route are live, the map can read them nightly instead.</li>
</ul></div>

<h2>1 · HOW CLOSELY THE SCOUT FOLLOWS THE FULL GEIGER</h2>
<p><b>The maths is the Hub's, to the fourth decimal.</b> I re-ran the live publisher's calculation on the chart API's own daily, 3-day and weekly bars for all 486 served names. It reproduces every one of the 1,458 rung readings in today's Geiger file (largest difference 0.0000005). The scout builds its 3-day and weekly bars from daily bars, using Massive's own calendar: 3-day blocks on a fixed calendar phase, and weeks that start on Sunday. Those rebuilt bars give the same readings to within 0.004 (worst case: DRAM, across an old reverse split). The weights are your saved Equalizer's (receipt <code>{e(eq['receipt_sha256'][:12])}</code>): daily {eq['rungs'][0]['share']*100:.0f}%, 3-day {eq['rungs'][1]['share']*100:.0f}%, weekly {eq['rungs'][2]['share']*100:.0f}% once the three are set to add up to 100%.</p>
<p><b>So the whole gap is the intraday rungs.</b> The full Geiger also reads 3h, 4h, 6h and 12h bars, which carry 59% of its weight. The scout leaves them out. The comparison below is Friday's close (scout) against the full Geiger at 13:53 ET today, whose intraday rungs already hold part of Monday's session. The scout reads higher by {tr['mean_signed_gap']:+.3f} on average because the intraday rungs were weaker today. On a quiet day the gap should be smaller. This is one snapshot, not a history.</p>
<div class="two"><img src="charts/01-scout-vs-full.png" alt="scout vs full Geiger, 486 names"><img src="charts/02-gap-percentiles.png" alt="gap, every percentile"></div>
<p class="mu">Every percentile of (scout − full): 1st {P['1']:+.2f}, 10th {P['10']:+.2f}, 25th {P['25']:+.2f}, middle {P['50']:+.2f}, 75th {P['75']:+.2f}, 90th {P['90']:+.2f}, 99th {P['99']:+.2f}. Same sign as the full Geiger for {tr['same_sign_share']*100:.0f}% of names. Trend part: correlation {tr['trend_correlation']:.3f}. Momentum part: {tr['momentum_correlation']:.3f}.</p>
<p><b>What this means for use.</b> The scout is the full Geiger's slow half, exactly. Use it to rank and screen thousands of names by trend and momentum. Do not read it as the Hub's number for a name that also has the full Geiger. On the map it is drawn only where the full Geiger is missing, and it is drawn slimmer.</p>

<h2>2 · EVERY TREE FUND: ITS OWN GEIGER, ITS HOLDINGS, THE DIVERGENCE</h2>
<p>For each of the {len(F)} funds in the tree, the scout reads every holding it has bars for, weighted by the fund's own weights, and says how much of the fund that covers. The typical fund is read at 99% of its weight. The full Geiger reads 56%, because it only knows served names. Country and foreign funds (EWJ, FXI, MCHI, EWG, EFA, VXUS…) stay near 0%: their holdings are not US listings, so there are no US day-file bars for them. That is stated in every row, not filled in.</p>
<p><b>A finding before anyone reads divergence as a signal.</b> {ext} of {len(Fb)} funds read <i>more extreme</i> than their holdings' blend, in both directions. A fund's own Geiger is the Geiger of one smooth average price. The blend is an average of many noisy Geigers, and averaging pulls readings toward zero. So a fund almost always "diverges" from its holdings in the same direction as its own reading. The useful signal is a fund's divergence compared with <i>its own usual</i> divergence; that needs the history the nightly table will build (decision 2).</p>
<img src="charts/03-fund-divergence.png" alt="every fund: own vs holdings">
<div class="tw"><table><tr><th>fund</th><th>name</th><th>Hub</th><th class="r">own · full</th><th class="r">own · scout</th><th>holdings · scout</th><th class="r"></th><th class="r">scout reads</th><th class="r">full reads</th><th class="r">own − holdings (scout)</th></tr>{fundrows}</table></div>
<p class="mu">Headings (US sectors, "the world" and the like) carry no holdings file. Where the names directly beneath a heading have a market value, the heading's blend is those names weighted by market value; see data/nodes.json.</p>

<h2>3 · THE 216 PROPOSED ADMISSIONS: WHICH ONES IMPROVE TRACKING</h2>
<p><b>The question, for each name:</b> today the Hub tracks a fund with the blend of the fund's served names. If this name were added, how much closer would that blend follow the fund's own Geiger? The answer is measured in Geiger points of average gap closed, over the last 500 sessions ({e(ad['track_sessions'][0])} → {e(ad['track_sessions'][1])}), using the scout reading every day for every name.</p>
<p><b>How it was judged</b>, by the statistician standard:</p>
<ul>
<li><b>How many:</b> 500 sessions ≈ 25 independent month-long blocks (neighbouring days are not independent).</li>
<li><b>How sure:</b> a 90% range from resampling month-long runs of days.</li>
<li><b>How big:</b> the gap closed.</li>
<li><b>The word:</b> <b>luck-proof</b> means the gain survives the count of all {ad['tests']} tests (false-discovery control at 10%) and is positive in both halves of the two years. <b>Leaning</b> means positive in both halves but it could still be luck. <b>No gain</b> covers the rest.</li>
</ul>
<p><b>The yardstick is the fund's own served names</b>, not a number chosen by eye. A name earns <b>FULL HUB</b> when three things hold: it is luck-proof; it closes at least as much gap as the middle served name of that fund already does; and the gain is at least 0.005, half a step of the two decimals the Hub prints (a smaller gain could never change a number on screen).</p>
<p>Result: <b>{st.get('luck-proof',0)}</b> luck-proof, <b>{st.get('leaning',0)}</b> leaning, <b>{st.get('no gain',0)}</b> no gain, {st.get('NO_SCOUT_SERIES',0)} without bars (BDXA and CRH.L are not US lines under those tickers), and 10 for KRE.</p>
<div class="box"><b>Worth full Hub treatment ({len(hub)}):</b> {hubl}.<br><br>
They cluster where the Hub is thinnest: MDY and IWM (3% of each fund is served), KBE, the biotech funds, IYZ and IHI. In well-covered funds (SPY, QQQ, the tech and sector funds) no proposal closes a visible gap. There, adding names would not change how the Hub reads the fund, so those names are <b>fine as scout-only</b>.<br><br>
<b>KRE has no served name at all</b>, so there is no blend to improve. Each proposal was scored on how well it tracks KRE alone (correlation): {krel}. Your call; recommendation below.</div>
<img src="charts/04-admission-gap-closed.png" alt="admission check, gap closed with 90% range">
<div class="two"><img src="charts/05-tracking-MDY.png" alt="MDY tracking"><img src="charts/05-tracking-IWM.png" alt="IWM tracking"><img src="charts/05-tracking-IBB.png" alt="IBB tracking"><img src="charts/05-tracking-KBE.png" alt="KBE tracking"></div>
<p class="mu">Lines follow the Hub rule: a day up is green, a day down is red. Solid = the fund itself; dashed = the blend of its served names; dotted = that blend with the best candidate added.</p>
<div class="tw"><table><tr><th class="r">#</th><th>name</th><th>best fund</th><th class="r">gap closed (90% range)</th><th>word</th><th class="r">vs served %ile</th><th>verdict</th><th>why · every fund it was tested in (weight)</th></tr>{admrows}</table></div>

<h2>4 · THE MAP: WHICH PAGE OPENS, AND THE SCOUT BARS</h2>
<p><b>Which page Alan sees.</b> The workshop card "Market map · round 3 · the tree" opens <code>/deliverables/20260928/market-map-r3/index.html</code>. That is the top-down tree: flat at the top, becoming 3D blocks lower down, where the names need room. The Hub itself has no direct map link; its menu opens Prototypes. The 27 Sep map-workshop page (<code>/deliverables/20260927/map-workshop/MAP-WORKSHOP.html</code>) still sent its "open the map" link to the old 3D wheel (<code>/deliverables/20260927/market-map/index.html</code>); that was probably how you kept landing on the wheel. On this branch that link now opens round 3. The wheel page itself is unchanged.</p>
<p><b>Scout bars.</b> A ball waiting for admission now carries a <b>slim</b> scout bar where it had none (34 of the 35 waiting balls; IBIT, a bitcoin fund, has no US stock day-file bars). A fund card now shows the scout blend of <b>all</b> its holdings with coverage, the fund's own scout reading, and the divergence between the two, both scout, same close. The key explains the slim bar. The full Geiger bars are unchanged.</p>
<div class="two"><div><div class="mu">before · live today · 1680</div><img src="shots/before-1680.png" alt="before 1680"></div><div><div class="mu">after · this branch · 1680</div><img src="shots/after-1680.png" alt="after 1680"></div>
<div><div class="mu">after · KRE card: scout blend of all 167 holdings (100% of the fund)</div><img src="shots/after-1680-KRE.png" alt="KRE card"></div><div><div class="mu">after · TRMK, waiting for admission, now with a slim scout bar</div><img src="shots/after-1680-TRMK.png" alt="TRMK card"></div>
<div><div class="mu">before · phone 390</div><img src="shots/before-390.png" alt="before 390"></div><div><div class="mu">after · phone 390</div><img src="shots/after-390.png" alt="after 390"></div></div>
<p class="mu">Screenshots from headless Chrome on this Mac, never a visible window. The chart API only answers scintillahub.ai, so that throwaway browser ran with the cross-origin check relaxed; the page itself is unchanged. The first after-shot run caught a real bug (a reserved word in the bar shader blanked every bar); it was fixed, and a test now guards it.</p>

<h2>WHERE EACH NUMBER COMES FROM</h2>
<ul>
<li><b>Prices:</b> Massive's daily files in our R2 copy ({run['bar_sources'].get('r2_day_aggs_v1',0)} days, to 17 Aug), then Massive grouped daily ({run['bar_sources'].get('grouped_fetched',0)} days). {e(run['first_session'])} → {e(run['as_of'])}, {run['sessions']} sessions. One day had no data: 9 Jan 2025, when the market was closed. Split-adjusted with Massive's split list ({run['splits_in_window']:,} splits).</li>
<li><b>Maths and weights:</b> the live publisher's code, and the live Geiger's own list of rungs and weights, read from the chart API at run time.</li>
<li><b>Full Geiger:</b> the chart API <code>/geiger</code>, computed {e(tr['full_geiger_computed_utc'][:16].replace('T',' '))} UTC.</li>
<li><b>Tree, holdings, proposals:</b> the coverage lane's files (125 funds, FMP holdings of 26 and 28 Sep) and the round-3 map's nodes.</li>
<li><b>Run:</b> <code>{e(run['run_id'])}</code>, code <code>{e(run['code_commit'])}</code>. Raw numbers: <code>data/</code> beside this page.</li>
</ul>

<h2>WHAT COULD BE WRONG</h2>
<ul>
<li><b>The scout-to-full comparison is a single moment</b>, with the intraday rungs partly on Monday's session. It says how different the two are today, not on average. The nightly table will give the history.</li>
<li><b>Renamed tickers:</b> a ticker that changed its symbol in the last 4½ years has its history split. It reads on fewer bars until the new symbol has its own history. 49 names read on daily + 3-day only and 13 on daily only, which are mostly young listings; the <code>rungs_used</code> column says which.</li>
<li><b>Holdings files</b> are FMP's. Some list only part of a fund (DRAM, VT); coverage is always stated against the whole fund.</li>
<li><b>The admission check</b> tracks the fund's own <i>scout</i> Geiger, not its full Geiger, because the full Geiger has no daily history to test against.</li>
<li><b>Very large funds</b> (SPY, QQQ): removing or adding one name barely moves the blend, so the yardstick is near zero. That is why the visible-gain rule matters there.</li>
</ul>

<h2>WHAT I DID NOT DO</h2>
<ul><li>Build or push an image, create the table, write any row, install the schedule, or deploy the chart API or the Hub. All of that is in the runbook for the coordinator.</li>
<li>Re-do the coverage lane's greedy smallest-set study; this check adds to it.</li>
<li>Change any full-Geiger bar, the Equalizer, or any price table.</li></ul>

<h2>DECISIONS FOR ALAN</h2>
<ol>
<li><b>Admit the {len(hub)} FULL HUB names</b>, mostly MDY, IWM, KBE and biotech lines. <i>Recommend yes.</i> They are the only proposals that visibly improve how the Hub reads their fund. Keep the other 187 as scout-only.</li>
<li><b>Switch on the nightly scout job and table</b> (runbook; about 2 minutes a night). <i>Recommend yes.</i> It gives every US stock a Geiger, gives the map its bars nightly, and builds the history needed to read fund divergence against each fund's usual level.</li>
<li><b>KRE:</b> it has no served name. <i>Recommend admitting HWC and FULT</i>, the two proposals that track KRE best on their own (0.95 and 0.92), as KRE's first served names. The rest stay scout-only.</li>
</ol>
</main></body></html>"""
open(D + 'SCOUT-GEIGER.html', 'w').write(page); print(len(page))
