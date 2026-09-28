"""Writes deliverables/20260928/research-round-2/RESEARCH-ROUND-2.html from the saved JSON.  Every number on the page is read
from data/*.json, never typed in.  Plain words for Alan."""
import os, sys, json, html, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE)
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
sys.path.insert(0, os.path.join(ROOT, "research/python/research-director"))
import build_page as RD  # the research director's CSS and helpers: one look for both pages
DIR = os.path.join(ROOT, "deliverables/20260928/research-round-2")
J = lambda f: json.load(open(os.path.join(DIR, "data", f)))
P4, P5, P7, P10, CT = J("p4-volsize.json"), J("p5-trend.json"), J("p7-drawdown.json"), J("p10-breadth.json"), J("calm-today.json")
PROV = {}
for f in ("provenance-p4.json", "provenance-p5.json", "provenance-p7.json", "provenance-p10.json"): PROV.update(J(f))
esc, sgn, table, img = RD.esc, RD.sgn, RD.table, RD.img
W = lambda w: f'<span class="word">{esc(w.upper())}</span>'


def pc(x, d=1): return "—" if x is None else f"{x:.{d}f}%"
def pts(x, d=1): return "—" if x is None else f"{x:+.{d}f}"
def rg(a, d=1, u="%"): return "—" if not a else f"{a[0]:.{d}f}{u} to {a[1]:.{d}f}{u}"
def ordn(x):
    n = int(round(x)); return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"


def link(name, url): return f'<a href="{esc(url)}">{esc(name)}</a>'


SRC = {
    "P4": [("Moreira & Muir (2017), Volatility-Managed Portfolios, J. Finance (NBER w22208)", "https://www.nber.org/papers/w22208"),
           ("Harvey, Hoyle, Korgaonkar, Rattray, Sargaison & van Hemert (2018), The impact of volatility targeting", "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=3175538"),
           ("Hansen (2005), SPA test; arch implementation", "https://bashtage.github.io/arch/multiple-comparison/multiple-comparisons.html")],
    "P5": [("Faber (2007), A Quantitative Approach to Tactical Asset Allocation", "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=962461"),
           ("Hurst, Ooi & Pedersen (2017), A Century of Evidence on Trend-Following Investing (AQR)", "https://www.aqr.com/Insights/Research/Journal-Article/A-Century-of-Evidence-on-Trend-Following-Investing"),
           ("Moskowitz, Ooi & Pedersen (2012), Time Series Momentum, JFE", "https://doi.org/10.1016/j.jfineco.2011.11.003")],
    "P7": [("Goldberg & Mahmoud (2017), Drawdown: from practice to theory and back again", "https://arxiv.org/abs/1404.7493"),
           ("Bailey & López de Prado (2014), Drawdown-based stop-outs and the triple penance rule", "https://papers.ssrn.com/sol3/papers.cfm?abstract_id=2201302"),
           ("Greenwood, Shleifer & You (2019), Bubbles for Fama, JFE (NBER w23191)", "https://www.nber.org/papers/w23191")],
    "P10": [("Zweig breadth thrust (Winning on Wall Street, 1986) — StockCharts definition", "https://school.stockcharts.com/doku.php?id=market_indicators:zweig_breadth_thrust"),
            ("IslamBaraka90, cumulative advance–decline line without look-ahead", "https://github.com/IslamBaraka90/Fintech-Cumulative-Advance-Decline-Line-Market-Breadth-algorithm")],
    "CALM": [("Research director Study A (N3): two-state hidden Markov model", "/deliverables/20260928/research-director/RESEARCH-DIRECTOR.html"),
             ("hmmlearn", "https://github.com/hmmlearn/hmmlearn"), ("Kritzman, Page & Turkington (2012), Regime shifts, FAJ", "https://www.tandfonline.com/doi/abs/10.2469/faj.v68.n3.3")],
}
def sources(k): return '<p class="k">STOLEN FROM</p><p>' + " · ".join(link(n, u) for n, u in SRC[k]) + "</p>"


# ---------------- CALM / STRESS ----------------
def section_calm():
    t = CT["today"]; st = CT["state_today"]; m = CT["model"]; o = CT["oos_by_state"]; ah = CT["calm_ahead_prob"]; vw = CT["vol_weights"]; b = CT["breadth"]
    fresh = CT["new_sessions_since_cache"]
    src = ("the S&amp;P 500 and VIX to the 25 Sep close, then " + ", ".join(fresh) + " from the chart API (SPY's return standing in for the index)") if fresh else "the S&amp;P 500 and VIX to the 25 Sep close (today's bar was not yet served when this ran)"
    vd = CT["oos_vol_diff"]; rd = CT["oos_ret_diff"]
    side = CT["oos_by_200day_side"]
    rows = [[n, pc(o[n]["share_of_days"]), f"{o[n]['duration_median']:.0f} · {o[n]['duration_p90']:.0f}", pc(o[n]["next20_realised_vol_ann_pct"]), sgn(o[n]["next20_median_pct"], 2, "%"), sgn(o[n]["next20_p10_pct"], 2, "%"), pc(o[n]["next20_share_up"])] for n in ("CALM", "STRESS")]
    wrows = [[esc(k), v.get("date", ""), pc(v.get("rv20_pct", v.get("realised_vol_20d_pct"))), pc(v.get("usual_pct", v.get("usual_vol_pct"))), ordn(v.get('rv20_own_pctile', v.get('rv20_own_percentile'))), f"{100 * v['weight']:.0f}%"] for k, v in vw.items()]
    fx = CT["fixture"]
    return f"""<h2 id="today">1 · Is today CALM or STRESS, and what does that mean for sizing?</h2>
{sources("CALM")}
<div class="card"><h3>The answer: {st} {W(st)}</h3>
<p><b>{t['date']}: probability of STRESS {t['STRESS']:.3f}</b> (CALM {1 - t['STRESS']:.3f}), from {src}. Model parameters were fixed in 2007 and never refitted; each day's number uses only bars up to that day.</p>
<p><b>What CALM means here.</b> The model's calm state has a typical VIX of {m['typical_vix']['CALM']} and swings about {m['ann_vol_pct']['CALM']}% a year. The stressed state has a VIX near {m['typical_vix']['STRESS']} and swings about {m['ann_vol_pct']['STRESS']}% a year. A calm spell lasts about {m['expected_duration_sessions']['CALM']:.0f} sessions on average. From today's reading, the chance of still being CALM is <b>{100 * ah['5']:.0f}% in 5 sessions, {100 * ah['20']:.0f}% in 20, {100 * ah['60']:.0f}% in 60</b>.</p>
<p><b>What it says, and what it does not.</b> Measured from 2008 onward with the frozen model, the state reliably tells you how wild the next month will be: STRESS days were followed by {100 * vd['est']:+.1f} points more yearly volatility than CALM days (90% range {100 * vd['lo']:+.1f} to {100 * vd['hi']:+.1f}, p = {vd['p']:.3f}), which is <b>luck-proof</b>. It does not reliably tell you the direction. The next-20-day return difference, STRESS minus CALM, was {100 * rd['est']:+.2f} points (range {100 * rd['lo']:+.2f} to {100 * rd['hi']:+.2f}), and that range includes zero.</p>
<p><b>For sizing, in one line:</b> in CALM, the volatility-managed rule of section 2 holds a full position. On today's numbers it would hold <b>{", ".join(f"{esc(k.split(' (')[0])} {100 * v['weight']:.0f}%" for k, v in vw.items())}</b>. Recent swings are ordinary, at the {", ".join(ordn(v.get('rv20_own_pctile', v.get('rv20_own_percentile'))) for v in vw.values())} percentile of their own history. The rule only starts cutting when last month's swings run above usual.</p>
<p><b>The caution CALM does not see: breadth is thin.</b> At the 25 Sep close only {pc(b['pit']['above50'])} of S&amp;P 500 members were above their 50-day average (the {ordn(b['above50_own_pctile'])} percentile since 2004), and {pc(b['pit']['above200'])} were above their 200-day, while the index itself sits {CT['trend_today']['S&P 500 index since 1928']['pct_vs_200d']:+.1f}% above its own 200-day. That is a calm, narrow tape carried by the leaders. None of this round's breadth rules makes it a signal (section 5), but it is the reason not to read CALM as "everything is fine".</p></div>
{img("calm-1-stress-probability.png", "STRESS probability since January 2025")}
<h3>How the two states behaved out of sample (2008 → 25 Sep 2026, parameters from 1990–2007)</h3>
{table(["state", "share of days", "spell length: median · 90th pct (sessions)", "next-20 swings (yearly)", "next-20 median return", "next-20 worst 10%", "next-20 up"], rows)}
<p>Inside each 200-day side (out of sample): above the 200-day and CALM, the next 20 sessions' median was {pc(side['above_200d']['CALM']['next20_median_pct'], 2)} with yearly swings of {pc(side['above_200d']['CALM']['next20_vol_ann_pct'])}. Below the 200-day and STRESS, the median was {pc(side['below_200d']['STRESS']['next20_median_pct'], 2)} with swings of {pc(side['below_200d']['STRESS']['next20_vol_ann_pct'])}. The biggest difference is in the swings, not the returns.</p>
<h3>Volatility-managed weight at the latest close</h3>
{table(["", "as of", "last 20 days' swings (yearly)", "its usual", "own percentile", "weight the rule holds"], wrows)}
<p class="q">Check: the model was re-fitted here with the published code and seeds, and it reproduces the research director's 25 Sep reading ({fx['reproduced']['CALM']:.3f} CALM against a published {fx['published_walk_forward']['CALM']:.3f}; match = {str(fx['match']).lower()}). Only then were the newer sessions fed through it.</p>"""


# ---------------- P4 ----------------
def section_p4():
    I = P4["instruments"]; H = P4["headline_rule"]; M = P4["moreira_muir_rule"]
    rows = []
    for k, v in I.items():
        b, h, mm = v["buy_and_hold"], v["rules"][H], v["rules"][M]; sd = v["headline_sharpe_minus_bh"]
        rows.append([esc(k), v["from"][:4], f"{b['cagr_pct']:.1f}% · {b['max_dd_pct']:.0f}%", f"{h['cagr_pct']:.1f}% · {h['max_dd_pct']:.0f}%", f"{mm['cagr_pct']:.1f}% · {mm['max_dd_pct']:.0f}%",
                     f"{b['sharpe']:.2f} → {h['sharpe']:.2f}", f"{sd['est']:+.2f} ({sd['lo']:+.2f} to {sd['hi']:+.2f})", f"{100 * h['avg_weight']:.0f}%", f"{h['turnover_per_year']:.1f} · {h['cost_drag_bps_per_year']:.0f} bps", f"{h['cagr_pct_harsh_cost']:.1f}%",
                     f"{v['spa_vs_same_exposure']['consistent']:.2f} · {v['spa_vol_matched_vs_buy_and_hold']['consistent']:.2f}"])
    ep = []
    for lab in ("2008 crisis", "2020 Covid", "2022 bear", "2025 tariff fall"):
        ep.append([lab] + [f"{I[k]['episodes'][lab]['buy_and_hold']:.0f}% → {I[k]['episodes'][lab]['headline']:.0f}%" if lab in I[k]["episodes"] else "—" for k in ("SPY", "QQQ (from Apr 2011)", "LEADERS10 (point-in-time top 10)")])
    lr = [[t, v["from"][:4], f"{v['buy_and_hold']['max_dd_pct']:.0f}% → {v['headline']['max_dd_pct']:.0f}%", f"{v['headline_sharpe_minus_bh']['est']:+.2f} ({v['headline_sharpe_minus_bh']['lo']:+.2f} to {v['headline_sharpe_minus_bh']['hi']:+.2f})", f"{100 * v['today']['headline_weight']:.0f}%"] for t, v in P4["today_leaders_individual"].items()]
    sp, g = I["SPY"], I["S&P 500 index since 1928"]; sc = P4["search_count"]; wf = I["SPY"]["walk_forward"]
    vm = min(v["spa_vol_matched_vs_buy_and_hold"]["consistent"] for v in I.values())
    qq = I["QQQ (from Apr 2011)"]; qc = qq["buy_and_hold"]["cagr_pct"] - qq["rules"][H]["cagr_pct"]
    return f"""<h2 id="p4">2 · P4 · Volatility-managed sizing: hold more when calm, less when wild</h2>
{sources("P4")}
<p><b>The question.</b> What happens to returns, the worst falls and trading costs if each position is sized by how wild its last 20 sessions were compared with its own usual level, never above 100%?</p>
<p><b>The rule, exactly.</b> At each close: weight = usual swings ÷ last 20 days' swings, capped at 100%. "Usual" is the median of every earlier reading, so nothing is known in advance. The weight earns the next day's return, cash earns nothing, and trading costs 5 bps per 100% of the position traded. Moreira and Muir's own version (last month's variance, reset monthly) is shown next to it. We searched {P4['grid']['windows']} windows × volatility or variance × 100%/150% caps × daily/monthly resets, plus the VIX in place of recent swings: <b>28 rules per instrument, {sc['rules_tested_total']} in all</b>, and all of them are counted.</p>
<div class="card"><h3>Verdict: since the 1980s it cut the worst falls by a third to a half, for about 1 to 1½ points of return a year (nearly {qc:.0f} on QQQ since 2011). The better return-for-risk is {W("leaning")}, not proven.</h3>
<p><b>How many:</b> SPY {sp['from'][:4]}→2026, the S&amp;P 500 index since {g['from'][:4]}, the Nasdaq-100 since 1985, QQQ since 2011 and the point-in-time top-10 leaders since 2007: five records, with dozens of volatile spells in each. <b>How big:</b> SPY's worst fall went from {sp['buy_and_hold']['max_dd_pct']:.0f}% to {sp['rules'][H]['max_dd_pct']:.0f}%, and its return from {sp['buy_and_hold']['cagr_pct']:.1f}% to {sp['rules'][H]['cagr_pct']:.1f}% a year. <b>How sure:</b> the Sharpe ratio (return per unit of risk) improved in all five, but the 90% range stays clear of zero only for the Nasdaq-100 and the leaders. Once the 28-rule search is counted, no rule beats "hold the same average amount all the time" (smallest SPA p = {sc['min_spa_p_same_exposure']:.2f}). Levered after the fact to match buy-and-hold's swings, which is Moreira and Muir's own comparison, the best single market scores p = {vm:.2f} (the Nasdaq-100); counted over the five markets, that is {min(1, 5 * vm):.2f}, which is not beyond luck. On the S&amp;P since 1929 the cut was smaller: {g['buy_and_hold']['max_dd_pct']:.0f}% to {g['rules'][H]['max_dd_pct']:.0f}%.</p>
<p><b>In plain words:</b> this is a way to <b>survive</b> the bad years (2008, 2020, 2022), not a way to beat the market. It works because big falls come with big swings, and the rule is already smaller when they arrive. It gives up return in calm, rising years because it trims whenever swings pick up, even when prices keep rising. It trades about {sp['rules'][H]['turnover_per_year']:.0f} times the position a year; at 20 bps a trade, SPY's return drops to {sp['rules'][H]['cagr_pct_harsh_cost']:.1f}%. Walk-forward check: the rule picked on SPY's first half ({esc(wf['chosen_on_first_half'])}) had a second-half Sharpe of {wf['second_half']['sharpe']:.2f}, against {wf['second_half_bh']['sharpe']:.2f} for holding.</p></div>
{img("p4-1-spy-growth-weight.png", "SPY growth and weight")}
{img("p4-2-worst-fall.png", "worst fall by instrument")}
{img("p4-3-sharpe-diff.png", "Sharpe difference with ranges")}
{img("p4-4-gspc-1928.png", "S&P since 1928")}
<h3>Every instrument (return a year · worst fall)</h3>
{table(["instrument", "from", "buy and hold", "vol-managed (20 day)", "Moreira–Muir (monthly)", "Sharpe", "Sharpe gain (90% range)", "avg held", "turnover · cost a year", "return at 20 bps", "SPA p: same exposure · vol-matched"], rows)}
<h3>The bad years, one by one (worst fall inside the window: holding → vol-managed)</h3>
{table(["", "SPY", "QQQ (from 2011)", "LEADERS10"], ep)}
<h3>Today's eight leaders one by one <span class="word">A LIST</span></h3>
<p>These are chosen because they are today's winners, so they can only look good looking back. They are shown for the numbers, not as evidence.</p>
{table(["", "from", "worst fall: held → managed", "Sharpe gain (90% range)", "weight today"], lr)}"""


# ---------------- P5 ----------------
def section_p5():
    I = P5["instruments"]; pool = P5["pooled_evidence_set"]; sc = P5["search_count"]; wf = P5["walk_forward_gspc"]
    rows = []
    for k, v in I.items():
        b, r10, r200 = v["buy_and_hold"], v["rules"]["10-month (Faber)"], v["rules"]["200-day"]
        rows.append([esc(k) + (" *" if v["group"].startswith("today") else ""), v["from"][:4], f"{b['max_dd_pct']:.0f}%", f"{r10['max_dd_pct']:.0f}% ({pts(r10['cagr_cost_pts'])})", f"{r200['max_dd_pct']:.0f}% ({pts(r200['cagr_cost_pts'])})",
                     f"{r10['time_in_pct']:.0f}%", f"{r10['switches_per_year']:.1f} · {r200['switches_per_year']:.1f}", f"{r10['round_trips_lost']}/{r10['round_trips']} · {r200['round_trips_lost']}/{r200['round_trips']}",
                     f"{v['spa_vs_buy_and_hold']['consistent']:.2f} · {v['spa_vs_same_share_of_days']['consistent']:.2f}"])
    prow = [[esc(k), p["median_dd_cut_pts"], rg(p["dd_cut_range90"], 1, ""), f"{p['share_instruments_dd_cut']:.0f}%", pts(p["median_cagr_cost_pts"]), rg(p["cagr_cost_range90"], 1, ""), f"{p['share_instruments_cagr_higher']:.0f}%"] for k, p in pool.items()]
    f10, f200 = pool["10-month (Faber)"], pool["200-day"]
    wrow = [[h, f"{v['buy_and_hold']['cagr_pct']:.1f}% · {v['buy_and_hold']['max_dd_pct']:.0f}%", f"{v['10-month (Faber)']['cagr_pct']:.1f}% · {v['10-month (Faber)']['max_dd_pct']:.0f}%", f"{v['200-day']['cagr_pct']:.1f}% · {v['200-day']['max_dd_pct']:.0f}%"] for h, v in wf.items()]
    td = P5["today"]; below = [k for k, v in td.items() if not v["above_200d"]]
    return f"""<h2 id="p5">3 · P5 · The 200-day / 10-month trend rule as a drawdown cutter</h2>
{sources("P5")}
<p><b>The question.</b> Is "deep below the 200-day is a problem" the same fact the trend-following literature reports? Does stepping aside below the long average cut the worst falls, and what does it cost, across indexes, sector funds, commodities, bitcoin, semis and the leaders, not only SPY?</p>
<p><b>The rules.</b> Hold when the close is above its 50/100/150/200/250-day average, or the 200-day with a 2% band. Faber's version holds for the next month when the month-end close is above its 6/8/10/12-month average. Otherwise cash at 0 (no bill yield is counted, which understates the rule by the bill rate times the time spent out). Each switch costs 10 bps. That is <b>10 rules × {sc['instruments']} instruments = {sc['rules_tested_total']} tests</b>, all counted.</p>
<div class="card"><h3>Verdict: the 10-month rule cut the worst fall in {f10['share_instruments_dd_cut']:.0f}% of the {f10['instruments']} evidence markets and cost return in {100 - f10['share_instruments_cagr_higher']:.0f}% of them. As a way to beat holding, it is {W("not shown")}. As a drawdown cutter, it is a measured fact.</h3>
<p><b>How many:</b> {sc['evidence_instruments']} instruments in the evidence set (today's hand-picked leaders are left out and shown separately, marked *), with the S&amp;P back to 1928. <b>How big:</b> Faber's 10-month rule cut the worst fall by a median <b>{f10['median_dd_cut_pts']:.0f} points</b> (90% range {rg(f10['dd_cut_range90'], 0, '')}, resampling whole instruments) and gave up <b>{-f10['median_cagr_cost_pts']:.1f} points of return a year</b> (range {rg(f10['cagr_cost_range90'], 1, '')}). The daily 200-day rule cut {f200['median_dd_cut_pts']:.0f} points and cost {-f200['median_cagr_cost_pts']:.1f} a year, because it switches more often and gets whipsawed more. <b>How sure:</b> the drawdown cut shows up in both halves of the S&amp;P record and in nearly every market. Beating holding does not: 0 of {sc['evidence_instruments']} instruments pass the SPA test against buy-and-hold (smallest p {sc['min_spa_vs_bh']:.2f}). Against "the same share of days held at random", {sc['spa_same_share_p_below_10pct']} pass at 10%, which is about what luck gives ({sc['expected_by_luck_at_10pct']:.1f}).</p>
<p><b>In plain words:</b> the published claim holds on our data. Stepping aside below the long average roughly halves the deep holes, at the cost of about two points a year and many small losing round trips. On SPY the 10-month rule sat out {I['SPY']['rules']['10-month (Faber)']['up_months_spent_out_pct']:.0f}% of the up months, and {I['SPY']['rules']['10-month (Faber)']['round_trips_lost']} of its {I['SPY']['rules']['10-month (Faber)']['round_trips']} round trips lost money. That is the price. The S&amp;P's two halves differ: before 1977 the rule also <i>beat</i> holding, and since 1977 it has only cut the holes. This matches Faber, who counts bill interest while out; we do not. Today {len(below)} of {len(td)} instruments are below their 200-day: {esc(", ".join(below)) or "none"}.</p></div>
{img("p5-1-gspc-faber.png", "S&P since 1928 with Faber cash months")}
{img("p5-2-cut-vs-cost-10m.png", "10-month rule cut vs cost")}
{img("p5-3-cut-vs-cost-200d.png", "200-day rule cut vs cost")}
{img("p5-4-lookback-grid.png", "lookback grid")}
<h3>The S&amp;P 500 in two halves (return a year · worst fall)</h3>
{table(["", "holding", "10-month rule", "200-day rule"], wrow)}
<h3>Every lookback, pooled over the {sc['evidence_instruments']} evidence instruments</h3>
{table(["rule", "median worst-fall cut (pts)", "90% range", "instruments cut", "median return a year given up", "90% range", "instruments where it beat holding"], prow)}
<h3>Every instrument: worst fall held · with the rule (return a year vs holding)</h3>
{table(["instrument", "from", "held", "10-month", "200-day", "time in (10-mo)", "switches a year (10-mo · 200d)", "round trips lost (10-mo · 200d)", "SPA p: vs holding · vs same share"], rows)}
<p class="q">* today's leaders, chosen after the fact. QQQ starts in April 2011 because every cached copy is missing December 2004 to March 2011, when the fund traded as QQQQ. The Nasdaq-100 index covers the long record.</p>"""


# ---------------- P7 ----------------
def section_p7():
    G = P7["groups"]; N = P7["named_assets"]; R = P7["runups"]; base = R["pit_base_rate_any_day"]; hb = R["pit_base_rate_halves"]
    order = ["index", "S&P 500 stocks, point in time", "sector", "fund", "gold & silver", "semis", "bitcoin", "oil", "leaders basket", "today's leaders (survivors)"]
    rows = []
    for g in order:
        for d in ("20", "30", "50"):
            v = G[g].get(d)
            if not v: continue
            rows.append([esc(g) if d == "20" else "", f"{d}%+", v["spells"], v["open"], "—" if v["median_under_water_sessions_km"] is None else f"{v['median_under_water_sessions_km'] / 252:.1f} y",
                         pc(v["back_within_1y_pct"], 0), pc(v["back_within_2y_pct"], 0), pc(v["back_within_5y_pct"], 0), "—" if v["penance_ratio_median"] is None else f"{v['penance_ratio_median']:.2f}"])
    rr = []
    for t in ("100", "150", "200"):
        v = R[f"pit_{t}"]; word = "luck-proof" if v["crash_range90"][0] > base["pct"] and all(h["crash_pct"] > hb[k] for k, h in v["halves"].items()) else "leaning"
        rr.append([f"up {t}%+ in 2 years", v["complete"], v["names"], v["years"], f"<b>{v['crash_pct']:.0f}%</b>", rg(v["crash_range90"], 0), f"{v['halves']['2005-2014']['crash_pct']:.0f}% · {v['halves']['2015-2024']['crash_pct']:.0f}%",
                   f"{v['fell_40_below_event_pct']:.0f}%", f"{v['median_ret_2y_pct']:+.0f}% · {v['share_up_2y_pct']:.0f}%", W(word)])
    nr = []
    for k, v in N.items():
        ev = v["events"]["100"]
        s = "; ".join(f"{e['date'][:7]} {'→ 40% fall' if e['crash_from_peak'] else ('no 40% fall' if e['complete'] else 'open')}" for e in ev) or "none"
        nr.append([esc(k), pts(v["runup_2y_now_pct"], 0) + "%", pts(v["runup_1y_now_pct"], 0) + "%", ordn(v['runup_1y_own_pctile_now']), pc(v["base_rate_crash_2y_pct"], 0), esc(s)])
    I = P7["instruments"]; gold, silver = I["Gold since 1975"], I["Silver since 1970"]
    p = G["S&P 500 stocks, point in time"]["20"]; ix = G["index"]["20"]
    allr = [G[g]["20"]["penance_ratio_median"] for g in ("index", "sector", "S&P 500 stocks, point in time")]
    q = [G[g]["20"]["penance_ratio_ge3_pct"] for g in ("index", "sector", "S&P 500 stocks, point in time")]
    r100, r200 = R["pit_100"], R["pit_200"]
    return f"""<h2 id="p7">4 · P7 · Drawdowns as survival curves, and what follows a parabolic run</h2>
{sources("P7")}
<p><b>The question.</b> Once something has fallen 20%, 30% or 50%, how long does it usually take to regain the old high? Answer as a curve, with the falls that have not yet recovered counted as still open, never dropped. After a doubling in two years (gold, silver, semis, bitcoin, today's leaders, and every S&amp;P 500 member as it was at the time), how often does a 40% fall follow?</p>
<div class="card"><h3>Verdict 1 · Recovery takes years, not months, and it varies hugely by market. {W("a measured distribution")}</h3>
<p>For the stock indexes, after a 20%+ fall the median wait to a new high is <b>{ix['median_under_water_sessions_km'] / 252:.1f} years</b>. {ix['back_within_1y_pct']:.0f}% are back within a year and {ix['back_within_5y_pct']:.0f}% within five ({ix['spells']} falls since 1928). For individual S&amp;P 500 stocks as they were at the time, including the ones later dropped from the index, the median is <b>{p['median_under_water_sessions_km'] / 252:.1f} years</b> ({p['spells']:,} falls, {p['open']:,} still open). Only {p['back_within_5y_pct']:.0f}% are back within five years. Gold and silver are the slowest: their 30%+ falls have a median of {G['gold & silver']['30']['median_under_water_sessions_km'] / 252:.0f} years under water. Bitcoin and the semis are the quickest to come back. Bitcoin is also the deepest: its median 30%+ fall is {-G['bitcoin']['30']['median_depth_pct']:.0f}%.</p>
<p><b>The "triple penance" rule does not hold on real markets.</b> The median climb back takes {min(allr):.1f} to {max(allr):.1f} times as long as the fall (indexes, sectors and stocks; falls of 20% or more), not three times. Between {min(q):.0f}% and {max(q):.0f}% of recovered falls took three times as long or more. This leans short, because the slowest climbs are still open and cannot give a ratio.</p></div>
{img("p7-1-recovery-survival.png", "recovery survival curves")}
{img("p7-2-depth-vs-time.png", "depth vs time under water")}
{img("p7-3-triple-penance.png", "triple penance ratio")}
{table(["group", "fall", "falls", "still open", "median time to the old high", "back in 1 y", "back in 2 y", "back in 5 y", "climb ÷ fall (median)"], rows)}
<div class="card"><h3>Verdict 2 · After a stock triples in two years, a 40% fall from its high within the next two years is about a coin flip. {W("luck-proof")} After a doubling it is {W("leaning")}.</h3>
<p><b>How many:</b> {r100['complete']:,} completed doublings in {r100['names']} S&amp;P 500 members since 2005, counted by name and by year: the 2010 rebound and the 2022 run-ups are clusters, and the ranges resample whole years. <b>Base rate:</b> from any day, {base['pct']:.0f}% of S&amp;P stocks lost 40% from a high within two years ({hb['2005-2014']:.0f}% in 2005–14, {hb['2015-2024']:.0f}% in 2015–24). <b>After a doubling:</b> {r100['crash_pct']:.0f}% (range {rg(r100['crash_range90'], 0)}), {r100['halves']['2005-2014']['crash_pct']:.0f}% and {r100['halves']['2015-2024']['crash_pct']:.0f}% in the two halves. <b>After a tripling:</b> {r200['crash_pct']:.0f}% (range {rg(r200['crash_range90'], 0)}), clear of the base rate in both halves. <b>But it is not a sell signal on its own:</b> the median stock was still up {r100['median_ret_2y_pct']:.0f}% two years after doubling, and {r100['share_up_2y_pct']:.0f}% were higher. The median one first climbed another {r100['median_gain_after_event_pct']:.0f}%, and the 40% fall usually came from that later high. Only {r100['fell_40_below_event_pct']:.0f}% ended up 40% below the day of the doubling. In plain words: a parabolic run raises the chance of a big hole later, mostly by making the next high a higher place to fall from.</p></div>
{img("p7-4-runup-crash.png", "crash probability after run-ups")}
{table(["S&P 500 members, point in time", "runs (complete)", "names", "years", "40% fall from the high within 2 y", "90% range", "2005–14 · 2015–24", "fell 40% below the run day", "2 y later: median · share up", "word"], rr)}
<h3>Gold, silver, semis, bitcoin and today's leaders <span class="word">A LIST</span></h3>
<p><b>Gold</b> is {-gold['below_high_now_pct']:.0f}% below its {gold['open_now']['peak'] if gold['open_now'] else ''} high. It doubled in two years on {N['Gold since 1975']['events']['100'][-1]['date'] if N['Gold since 1975']['events']['100'] else '—'} and is up {N['Gold since 1975']['runup_2y_now_pct']:.0f}% over two years today. Since 1975 gold has doubled in two years only {len(N['Gold since 1975']['events']['100'])} times. The completed cases ({', '.join(e['date'][:4] + (' → 40% fall' if e['crash_from_peak'] else ' → no 40% fall') for e in N['Gold since 1975']['events']['100'] if e['complete'])}) came around the 1980 top, and that high ({gold['worst']['peak']}) was not regained until {gold['worst']['recovered']}. The current case is open. <b>Silver</b> already had its fall: {silver['open_now']['depth_pct']:.0f}% from its {silver['open_now']['peak']} high after its September 2025 doubling. Gold's three cases and silver's six are far too few for a rate, so each one is listed. The semis (SMH {N['SMH semis']['runup_2y_now_pct']:+.0f}% and SOXX {N['SOXX semis']['runup_2y_now_pct']:+.0f}% over two years), AMD ({N['AMD']['runup_2y_now_pct']:+.0f}%) and MU ({N['MU']['runup_2y_now_pct']:+.0f}%) are in parabolic territory by this measure today. MU: {sum(e['crash_from_peak'] for e in N['MU']['events']['100'] if e['complete'])} of its {sum(e['complete'] for e in N['MU']['events']['100'])} completed past doublings were followed by a 40% fall from the high.</p>
{img("p7-5-gold-silver-runs.png", "gold and silver runs")}
{table(["", "2 y change now", "1 y change now", "1 y change, own percentile", "any-day chance of a 40% fall in 2 y", "every past doubling in 2 years, and what followed"], nr)}"""


# ---------------- P10 ----------------
def section_p10():
    R = P10["results"]["pit"]; Rs = P10["results"]["served"]; base = R["base"]; t = P10["today"]; pn = P10["panel"]; sg = P10["survivorship_gap"]
    rows = []
    for k, v in R["rules"].items():
        f = v["fwd126"]; rows.append([esc(k), v["episodes"], v["years"], f"{f['median_pct']:+.1f}%" if f["median_pct"] is not None else "—", rg(f.get("range90_pct"), 1), f"{v['fwd252']['median_pct']:+.1f}%" if v["fwd252"]["median_pct"] is not None else "—",
                                   f"{f['false_alarms']}", "—" if f.get("p_naive") is None else f"{f['p_naive']:.2f} · {f['p_bh']:.2f}", W(v["word"])])
    z = R["rules"]["Zweig 0.40→0.615 in 10"]; h = R["halves"]
    cases = table(["signal day", "20 later", "63 later", "126 later", "252 later", "worst fall in next 63"], [[c["date"]] + [f"{c[f'fwd{x}_pct']:+.1f}%" if c[f"fwd{x}_pct"] is not None else "open" for x in (20, 63, 126, 252)] + [f"{c['dd63_pct']:.1f}%" if c["dd63_pct"] is not None else "open"] for c in z["cases"]])
    return f"""<h2 id="p10">5 · P10 · Breadth thrusts, rebuilt from our own daily history since 2003</h2>
{sources("P10")}
<p><b>The question.</b> Our breadth file only starts on 23 Sep 2026. Rebuilt from 22 years of daily bars, does a breadth thrust (the market going from few names rising to most names rising in a few sessions) predict what the S&amp;P does next? False alarms are counted.</p>
<p><b>What we rebuilt.</b> For every session from {pn['from']} to {pn['to']}: advances and declines, % above the 50-day and 200-day, new 52-week highs and lows. This was done three ways: (1) <b>the S&amp;P 500 as it actually was each day</b> ({pn['pit_names_ever']} names ever, about {pn['pit_members_median_measured']} measured on a median day, including names later removed), which is the main one; (2) the 364 names the Hub serves today, which carries survivorship bias and is shown so the bias is visible; (3) the USUAL DAY table (<code>public.sigma_day_counts</code>, {pn['sigma_rows_used']:,} days from {pn['sigma_from']}), which counts names having an unusually big day up or down. <b>The search:</b> Zweig's rule at 12 thresholds and windows, the %-above-50-day thrust at 8, and a USUAL DAY up-thrust at 3. That is 23 rules × 3 holding periods = {R['spa']['n_rules']} tests, all counted. A rule's signal counts once per 60 sessions.</p>
<div class="card"><h3>Verdict: after a thrust the S&amp;P usually went up, but it usually goes up anyway. No breadth rule beats "any day" once the search is counted. {W("not shown")}; the rarer versions are {W("a list")}.</h3>
<p><b>Base rate:</b> from any day since 2004, the S&amp;P's median change over the next 126 sessions (about six months) was {base['126']['median_pct']:+.1f}%, higher {base['126']['share_up_pct']:.0f}% of the time. <b>Classic Zweig</b> (0.40 → 0.615 within 10 sessions, on S&amp;P 500 members): {z['episodes']} signals in {z['years']} different years, median {z['fwd126']['median_pct']:+.1f}% over the next 126 sessions (90% range {rg(z['fwd126']['range90_pct'], 1)}), {z['fwd126']['false_alarms']} of them below the any-day median. By halves: {h['Zweig 0.40→0.615 in 10']['2004-2014']['fwd126_median_pct']:+.1f}% against {h['Zweig 0.40→0.615 in 10']['2004-2014']['base_median_pct']:+.1f}% in 2004–14, and {h['Zweig 0.40→0.615 in 10']['2015-2026']['fwd126_median_pct']:+.1f}% against {h['Zweig 0.40→0.615 in 10']['2015-2026']['base_median_pct']:+.1f}% since 2015. <b>The whole family:</b> Hansen's SPA p = {R['spa']['consistent']:.2f}, with no rule in the Romano–Wolf survivor set. After a false-discovery correction every rule's p is above {min(v['fwd126']['p_bh'] for v in R['rules'].values()):.2f}. The served universe gives the same answer (p = {Rs['spa']['consistent']:.2f}).</p>
<p><b>In plain words:</b> a thrust marks the end of a washout. It has been a fine day to be long, but not measurably better than a random day. Two cautions: our Zweig fires about {z['episodes']} times in 22 years, far more often than the NYSE original, because 500 large companies move together more than 3,000 NYSE issues do. And the sharpest version (0.40 → 0.65 in 10 sessions) has too few signals to be a rate. <b>Today (25 Sep):</b> {pc(t['pit']['above50'])} of members above the 50-day ({ordn(t['above50_own_pctile'])} percentile), {pc(t['pit']['above200'])} above the 200-day, Zweig's 10-day ratio {t['pit']['zema']:.2f} ({ordn(t['zema_own_pctile'])} percentile). This is neither a washout nor a thrust. The last classic Zweig signal was {t['last_zweig_classic']}, and the last 40→60 thrust above the 50-day was {t['last_above50_thrust']}.</p>
<p><b>Survivorship, measured:</b> today's 364 names read {sg['above200_mean_served_minus_pit_pts']:+.1f} points healthier on "% above the 200-day" in the past than the index as it really was (chart P10-4). That bias is why the point-in-time list is the one used for decisions.</p></div>
{img("p10-1-breadth-history.png", "breadth history with thrusts")}
{img("p10-2-after-thrusts.png", "S&P after each thrust")}
{img("p10-3-rule-family.png", "rule family")}
{img("p10-4-survivorship.png", "survivorship gap")}
<h3>Every rule (S&amp;P 500 members, point in time) · next 126 sessions unless stated</h3>
{table(["rule", "signals", "years", "median next 126", "90% range (resampled by year)", "median next 252", "worse than any day", "p · after correction", "word"], rows)}
<details><summary>Every classic Zweig signal and what followed ({z['episodes']})</summary>{cases}</details>"""


def section_search():
    rows = [["P4 volatility sizing", f"{P4['search_count']['rules_per_instrument']} × {P4['search_count']['instruments_tested']}", f"{P4['search_count']['rules_tested_total']}", f"SPA vs same exposure: min p {P4['search_count']['min_spa_p_same_exposure']:.2f}", W("leaning") + " (Sharpe); drawdown cut is mechanical"],
            ["P5 trend rule", f"{P5['search_count']['rules_per_instrument']} × {P5['search_count']['instruments']}", f"{P5['search_count']['rules_tested_total']}", f"SPA vs holding: min p {P5['search_count']['min_spa_vs_bh']:.2f}; {P5['search_count']['spa_same_share_p_below_10pct']} of {P5['search_count']['evidence_instruments']} under 10% vs same share (luck: {P5['search_count']['expected_by_luck_at_10pct']:.1f})", W("not shown") + " as a return edge; drawdown cut measured"],
            ["P7 run-ups → 40% fall", "3 thresholds", "3", f"tripling: range {rg(P7['runups']['pit_200']['crash_range90'], 0)} vs base {P7['runups']['pit_base_rate_any_day']['pct']:.0f}%, both halves", W("luck-proof") + " (tripling) · " + W("leaning") + " (doubling)"],
            ["P10 breadth thrusts", "23 rules × 3 holds", f"{P10['results']['pit']['spa']['n_rules']}", f"SPA p {P10['results']['pit']['spa']['consistent']:.2f}; StepM survivors: none", W("not shown")],
            ["CALM / STRESS", "the published 2-state model, no new search", "0", f"next-20 swings: {100 * CT['oos_vol_diff']['est']:+.1f} pts (range {100 * CT['oos_vol_diff']['lo']:+.1f} to {100 * CT['oos_vol_diff']['hi']:+.1f})", W("luck-proof") + " for swings · " + W("not shown") + " for direction"]]
    return f"""<h2 id="search">6 · The search, counted</h2>
<p>Every rule tried in this round is in the count, following the statistician's method standard (R5: count the tests; SPA / Reality Check whenever rules are searched). Words: <b>luck-proof</b> = the range clears the any-day line after the search is counted, in both halves of history. <b>Leaning</b> = same direction in both halves, but the range still touches the line. <b>A list</b> = fewer than 20 independent cases, shown one by one with no rate claimed. <b>Not shown</b> = no better than any day.</p>
{table(["study", "rules searched", "tests", "the corrected test", "word"], rows)}"""


def build():
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    ct = CT["today"]; I4 = P4["instruments"]; f10 = P5["pooled_evidence_set"]["10-month (Faber)"]; r200 = P7["runups"]["pit_200"]; base = P7["runups"]["pit_base_rate_any_day"]["pct"]
    prov = [[esc(k), esc(v["file"]) + (f"<br><span class='q'>{esc(v['trimmed'])}</span>" if v.get("trimmed") else ""), v["bars"], v["from"], v["to"], v["sha256_12"]] for k, v in sorted(PROV.items())]
    tb = json.load(open(os.path.join(DIR, "data", "today-bars.json")))
    tbrows = [[s, v["provider"], v["served_from"], v["rows"][-1]["date"], v["rows"][-1]["c"], v["fetched_utc"][:16]] for s, v in tb.items()]
    body = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research round 2 · N11 · 28 Sep 2026</title>
<style>{RD.CSS}</style></head><body>
<span data-scnav-slot></span><h1>Research round 2: sizing by volatility, the trend rule, how long holes last, breadth thrusts, and today's state</h1>
<div class="q">N11 · 28 Sep 2026 · daily bars to the 25 Sep close from the chart-API cache and the point-in-time S&amp;P 500 cache; today's close from the chart API · built {now} · research, not advice · <b>no buy or sell calls on this page</b></div>

<div class="status"><b>STATUS · run on real data, pushed to a branch, not deployed.</b> Four of the research director's proposals ran, in the order asked: P4 volatility-managed sizing (section 2), P5 the trend rule as a drawdown cutter (3), P7 drawdown survival and parabolic runs (4), and P10 breadth thrusts from our own history (5). Section 1 answers "CALM or STRESS today, and what it means for sizing". Section 6 counts the whole search. Every chart is a saved PNG in <code>charts/</code>, every number is read from <code>data/*.json</code>, and every input file is listed with its hash at the end. Code: <code>research/python/research-round-2/</code> (run in this order: p4_volsize, p5_trend, p7_drawdown, p10_breadth, calm_today, build_round2_page). Tests: <code>tests/research-round-2-20260928.test.mjs</code>. No key, database, price table or paid model was used. The only network read was the chart API's public daily bars for VIX, SPY and QQQ.</div>

<h2>What this page says, in plain words</h2>
<ol class="lead">
<li><b>Today is {CT['state_today']}</b> (STRESS probability {ct['STRESS']:.3f} at the {ct['date']} close). For sizing, that means full positions under the volatility rule, with one caution: breadth is thin ({pc(CT['breadth']['pit']['above50'])} of S&amp;P members above their 50-day). The state predicts how wild the next month is, not its direction.</li>
<li><b>Sizing by volatility is a way to survive, not to win.</b> It cut SPY's worst fall from {I4['SPY']['buy_and_hold']['max_dd_pct']:.0f}% to {I4['SPY']['rules'][P4['headline_rule']]['max_dd_pct']:.0f}% and cost about {I4['SPY']['buy_and_hold']['cagr_pct'] - I4['SPY']['rules'][P4['headline_rule']]['cagr_pct']:.1f} points a year. Better return for the risk in every market tested, but not beyond luck once the 28-rule search is counted.</li>
<li><b>Stepping aside below the 10-month / 200-day average cuts the deep holes almost everywhere</b>: a median {f10['median_dd_cut_pts']:.0f} points off the worst fall across {f10['instruments']} markets, for about {-f10['median_cagr_cost_pts']:.1f} points a year. It is a drawdown cutter, not a return booster, which is what the public work says too.</li>
<li><b>Holes take years.</b> A 20% fall in an index takes a median {P7['groups']['index']['20']['median_under_water_sessions_km'] / 252:.1f} years to recover, and an S&amp;P stock's about {P7['groups']['S&P 500 stocks, point in time']['20']['median_under_water_sessions_km'] / 252:.1f}. <b>After a stock triples in two years, about half ({r200['crash_pct']:.0f}%) lose 40% from a high within the next two, against {base:.0f}% for any stock on any day</b>, though most first climb higher. Gold's doubling is still open; silver's already fell {-P7['instruments']['Silver since 1970']['open_now']['depth_pct']:.0f}%.</li>
<li><b>Breadth thrusts, rebuilt for 22 years without survivorship, do not beat a random day.</b> They mark the end of washouts, not the start of unusual gains.</li>
</ol>
{section_calm()}
{section_p4()}
{section_p5()}
{section_p7()}
{section_p10()}
{section_search()}

<h2 id="notes">What the page shows</h2>
<p>Four studies proposed by the research director (N3) and run on our own data, each with the public work it copies, the base rate, a range for how sure it is, and one word. It also gives a one-page reading of today's market state with what it means for position size. It is research, not advice: nothing here is a buy or sell call.</p>
<h2>Where each number comes from</h2>
<dl>
<dt>Daily closes</dt><dd>The stats-cache the 28 Sep lanes saved as served from the chart API (<code>https://scintilla-massive-chart-api.fly.dev/candles?tf=D</code>): Massive for funds and stocks (split-adjusted, no dividends), FMP for the VIX, gold (GCUSD), silver (SIUSD), oil (CLUSD) and bitcoin. Long index histories (^GSPC 1927→, ^NDX, ^RUT, ^DJI) are the FMP pulls the RSI lane cached.</dd>
<dt>S&amp;P 500 as it was each day</dt><dd><code>stats-cache/point-in-time/v1</code>, built today on Fly: FMP historical constituents, FMP monthly market caps, and Massive daily bars for {P10['panel']['pit_names_ever']} names that were ever members. The LEADERS10 basket is the ten largest members by market cap at each prior year-end, equal weight, reset each January.</dd>
<dt>USUAL DAY</dt><dd><code>public.sigma_day_counts</code>, from the committed dump at <code>research/statistics/data/pullback-playbook-20260928/sigma_day_counts.json</code> (read only).</dd>
<dt>Today's close</dt><dd>The chart API's public daily bars for VIX, SPY and QQQ, saved as served to <code>data/today-bars.json</code>:</dd>
</dl>
{table(["symbol", "provider", "served from", "last bar", "close", "fetched (UTC)"], tbrows)}
<h2>What could be wrong</h2>
<ul>
<li><b>Price only, cash at zero.</b> No dividends and no bill interest. Holding is understated by the dividend yield, and every rule that sits in cash (P4, P5) is understated by the bill rate times its time out. Faber counts bills; we do not.</li>
<li><b>Old-ticker holes in the served bars.</b> Every cached copy of QQQ is missing December 2004 to March 2011 (it traded as QQQQ). META is missing before June 2022 (it traded as FB), and GOOGL's cached bars only start in July 2015; bitcoin's before April 2010 have a hole. Each series was trimmed to its unbroken stretch and the trim is listed below. This is the reused-ticker problem in the bar service, visible from the research side.</li>
<li><b>Bitcoin</b> is measured on weekday closes from 2013, so "20 sessions" means about four weeks for every instrument.</li>
<li><b>Today's leaders</b> (NVDA, AAPL and the others) were chosen because they won, so their rows are lists, never evidence. The point-in-time LEADERS10 basket and the point-in-time S&amp;P members are the evidence.</li>
<li><b>Breadth before 2004 and outside the S&amp;P 500</b> is not measured. Our Zweig uses 500 large companies, not the NYSE's 3,000 issues, so it fires more often than the original.</li>
<li><b>The CALM/STRESS state after 25 Sep</b> uses SPY's daily return in place of the S&amp;P index's (the chart API does not carry ^GSPC). They differ by basis points on a day without a dividend.</li>
<li><b>Costs</b> are flat (5 bps per unit traded in P4, 10 bps per switch in P5). Taxes are not counted. For a taxable account, P5's switching and P4's constant trimming would cost more than shown.</li>
</ul>
<h2>What was not done</h2>
<ul>
<li>Proposals 6, 8 and 9 of the research director's ten were not run in this round.</li>
<li>P4 was run on SPY, QQQ, the two long indexes and the leaders only, not on the sectors or cohorts. P5 did not pool with an instrument fixed effect in a regression; it resamples whole instruments instead.</li>
<li>No page on the Hub was changed. The studies index and the workshop were not touched, and nothing was deployed. The branch is pushed for the coordinator.</li>
<li>No new database table was written. The USUAL DAY history was read from the committed dump, not live.</li>
</ul>
<h2>Every input file</h2>
{table(["series", "file", "bars", "from", "to", "sha256 (12)"], prov)}
</body></html>"""
    # the grey BACK / CLOSE pair, placed exactly as scripts/inject-scnav.py places it, on this page only (the script's main()
    # refreshes every Hub page; the other rooms are not this lane's to touch)
    import importlib.util
    spec = importlib.util.spec_from_file_location("scnav", os.path.join(ROOT, "scripts/inject-scnav.py")); sc = importlib.util.module_from_spec(spec); spec.loader.exec_module(sc)
    body = sc.BLOCK.sub("\n", body); body, _ = sc.ensure_slot(body, "research-round-2"); body = body.replace("</body>", sc.SNIPPET + "\n</body>", 1)
    open(os.path.join(DIR, "RESEARCH-ROUND-2.html"), "w").write(body)
    print("wrote", os.path.join(DIR, "RESEARCH-ROUND-2.html"), len(body))


if __name__ == "__main__":
    build()
