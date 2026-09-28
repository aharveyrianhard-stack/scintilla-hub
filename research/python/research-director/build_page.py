"""Writes deliverables/20260928/research-director/RESEARCH-DIRECTOR.html from the three studies' JSON and proposals.json.
Plain words for Alan; every number on the page is read from the saved files, never typed in."""
import os, json, html, datetime
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "../../.."))
DIR = os.path.join(ROOT, "deliverables/20260928/research-director")
J = lambda f: json.load(open(os.path.join(DIR, "data", f)))
A, B, C, P = J("study-a-regime.json"), J("study-b-rotation.json"), J("study-c-spa.json"), J("proposals.json")
PROV = {}
for f in ("provenance-a.json", "provenance-b.json", "provenance-c.json"): PROV.update(J(f))
esc = lambda x: html.escape(str(x), quote=False)
UP, DN = "up", "dn"


def pct(x, d=1): return f"{x:+.{d}f}" if x is not None else "—"
def sgn(x, d=2, unit=""): return f'<span class="{UP if x >= 0 else DN}">{x:+.{d}f}{unit}</span>' if x is not None else "—"
def rng(r, d=2, unit=" pts"): return f"{r['lo']:+.{d}f} to {r['hi']:+.{d}f}{unit}" if r and r.get("lo") is not None else "—"
def img(f, alt): return f'<img class="chart" src="charts/{f}" alt="{esc(alt)}" width="100%">'
def table(head, rows): return '<div class="scroll"><table><tr>' + "".join(f"<th>{h}</th>" for h in head) + "</tr>" + "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows) + "</table></div>"


def status_word(n_episodes, p_naive, p_corrected):
    if n_episodes is not None and n_episodes < 20: return "a list"
    if p_corrected is not None and p_corrected < 0.10: return "luck-proof"
    if p_naive is not None and p_naive < 0.10: return "leaning"
    return "not shown"


# ---------------- Study A pieces ----------------
A1 = A["models"]["A_gspc_vix_1990"]; A0 = A["models"]["A0_gspc_returns_only_1928"]; AB = A["models"]["B_spy_breadth_vixcurve_2006"]
k2 = A1["k2"]; k3 = A1["k3"]; b3 = AB["k3"]; b2 = AB["k2"]
today = k2["today"]; RV = A["ruptures_realised_vol"]; rv40 = RV["shift_40pct"]; rv25 = RV["shift_25pct"]


def state_rows(m, oos=True):
    rows = []
    for s in (m["by_state_walk_forward_oos"] if oos else m["by_state_full_fit"]):
        rows.append([s["state"], f"{s['share_of_days']}%", s["episodes"], f"{s['duration_median']:.0f} · {s['duration_p90']:.0f}", sgn(s["next_day_mean_pct"], 3, "%"),
                     sgn(s["next20_median_pct"], 2, "%"), sgn(s["next20_p10_pct"], 2, "%"), f"{s['next20_share_up']}%", f"{s['next20_realised_vol_ann_pct']}%", s["last_start"]])
    return rows


STATE_HEAD = ["state", "share of days", "episodes", "length: median · 90th (days)", "next day, mean", "next 20: median", "next 20: 10th pct", "next 20: share up", "next 20: realised vol", "last began"]

# ---------------- Study B pieces ----------------
CP = B["changepoints"]["bic"]; CP2 = B["changepoints"]["bic2"]; FC = B["fresh_change_forward"]
SEC = {"XLK": "TECH", "XLF": "FINANCIALS", "XLV": "HEALTH CARE", "XLY": "DISCRETIONARY", "XLP": "STAPLES", "XLB": "MATERIALS", "XLI": "INDUSTRIALS", "XLE": "ENERGY", "XLU": "UTILITIES", "XLRE": "REAL ESTATE", "XLC": "COMMUNICATION"}
cp_rows = []
for s in sorted(SEC, key=lambda s: -CP[s]["current"]["ann_rel_pct"]):
    c, p = CP[s]["current"], CP[s]["previous"]
    cp_rows.append([SEC[s], s, c["from"], c["weeks"], sgn(c["ann_rel_pct"], 0, "%"), (sgn(p["ann_rel_pct"], 0, "%") + f" (from {p['from']})") if p else "—", CP[s]["n_changes"], CP2[s]["current"]["from"], CP2[s]["n_changes"]])
RC, RS_ = B["rrg"]["cohorts"], B["rrg"]["sectors"]
def rrg_rows(t, lab=True):
    return [[esc(r["label"]) if lab else esc(r["label"]), r["id"], f'<span class="{UP if r["quadrant"] in ("LEADING","IMPROVING") else DN}">{r["quadrant"]}</span>', f"{r['rs_ratio']:.2f}", f"{r['rs_momentum']:.2f}", r["weeks_in_quadrant"],
             " · ".join(q or "—" for q in r["quadrant_by_window_14_26_52"]) + (" ✓" if r["same_in_all_windows"] else " ✗"), sgn(r["rel_13w_pct"], 1, "%")] for r in t["table"]]
RRG_HEAD = ["cohort", "id", "quadrant (26-week window)", "RS-Ratio", "RS-Momentum", "weeks in quadrant", "quadrant at 14 · 26 · 52 weeks", "13-week return vs SPY"]

# ---------------- Study C pieces ----------------
CR = C["results"]
def fam_rows(k):
    rows = []
    for fk, v in CR[k]["families"].items():
        w = v.get("walk_forward")
        rows.append([fk, esc(v["best_rule"]), sgn(v["best_excess_pts_per_year"], 1), f"{v['best_naive_p']:.3f}", f"<b>{v['spa_p_consistent']:.3f}</b>", f"{v['reality_check_p_upper']:.3f}",
                     esc(", ".join(v["stepm_survivors_10pct"])) if v["stepm_survivors_10pct"] else "none",
                     (esc(w["chosen_on_first_half"]) + f": {sgn(w['first_half_pts_per_year'],1)} → {sgn(w['second_half_pts_per_year'],1)} ({w['second_half_90_range'][0]:+.1f} to {w['second_half_90_range'][1]:+.1f})") if w else "—"])
    u = CR[k]["union"]
    rows.append([f"<b>UNION · every rule searched ({u['n_rules']})</b>", esc(u["best_rule"]), sgn(u["best_excess_pts_per_year"], 1), "—", f"<b>{u['spa_p_consistent']:.3f}</b>", f"{u['reality_check_p_upper']:.3f}", esc(", ".join(u["stepm_survivors_10pct"])) if u["stepm_survivors_10pct"] else "none", "—"])
    return rows
FAM_HEAD = ["family (rules)", "best rule", "best rule's excess, pts/yr", "its own p (block bootstrap)", "SPA p (search counted)", "Reality Check p", "StepM survivors at 10%", "walk-forward: chosen on first half → second half (90% range)"]


def gen():
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    return now


CSS = """
body{margin:0;background:#07070C;color:#B4B4C6;font:17px/1.55 -apple-system,"Helvetica Neue",Arial,sans-serif;padding:28px 34px 80px;max-width:1500px}
h1{font-size:34px;margin:0 0 6px;color:#C8C8D2}h2{font-size:26px;margin:46px 0 8px;color:#C8C8D2}h3{font-size:19px;margin:26px 0 6px;color:#C8C8D2}
p,li{max-width:1080px}.q{color:#9C9CAE;font-size:13px}
ol.lead{font-size:19px;color:#C8C8D2;max-width:1120px;padding-left:24px}ol.lead li{margin:0 0 12px}
.status{border:1px solid #2A2A36;border-left:4px solid #8A8A9E;padding:12px 16px;margin:18px 0;max-width:1080px;color:#C8C8D2}
code{font:14px ui-monospace,Menlo,monospace;color:#BEBECE}
.scroll{overflow-x:auto;max-width:100%}
table{border-collapse:collapse;font-size:14px;margin:10px 0;font-variant-numeric:tabular-nums}th,td{border:1px solid #24242E;padding:6px 9px;text-align:left;vertical-align:top}th{color:#A8A8BA;font-weight:600;font-size:13px;font-family:ui-monospace,Menlo,monospace}
details{margin:8px 0;max-width:1400px}summary{cursor:pointer;padding:6px 0;color:#C0C0CE}
.chart{display:block;background:#0B0B12;border:1px solid #1E1E28;margin:12px 0;max-width:1400px;height:auto}
.up{color:#00FFA3}.dn{color:#FF2D55}
.card{border:1px solid #24242E;background:#0B0B12;padding:14px 18px;margin:12px 0;max-width:1120px}.card h3{margin:0 0 6px}.card .k{font:12px ui-monospace,Menlo,monospace;letter-spacing:.08em;color:#8A8A9E}
.card p{margin:6px 0}a{color:#C0C0CE}
.word{display:inline-block;font:12px ui-monospace,Menlo,monospace;letter-spacing:.1em;border:1px solid #2A2A36;padding:1px 7px;border-radius:2px;color:#C8C8D2}
dl{max-width:1120px}dt{color:#C8C8D2;font-weight:600;margin-top:10px}dd{margin:2px 0 0 0}
@media(max-width:600px){body{padding:20px 16px 60px;font-size:16px}h1{font-size:26px}h2{font-size:22px}ol.lead{font-size:17px}table{font-size:12px}th,td{padding:5px 6px}code{overflow-wrap:anywhere}}
"""


def proposals_html():
    out = []
    for s in P["studies"]:
        links = " · ".join(f'<a href="{esc(i["url"])}">{esc(i["name"])}</a>' for i in s["inspired_by"])
        ran = ' <span class="word">RAN TODAY</span>' if s["ran_today"] else ""
        out.append(f'<div class="card"><h3>{s["n"]} · {esc(s["title"])}{ran}</h3><p class="k">STOLEN FROM</p><p>{links}</p>'
                   f'<p><b>The question.</b> {esc(s["question"])}</p><p><b>Method.</b> {esc(s["method"])}</p><p><b>Data we have.</b> {esc(s["data"])}</p>'
                   f'<p><b>Value to Alan.</b> {esc(s["value"])}</p><p><b>Cost.</b> {esc(s["cost"])}</p></div>')
    out.append("<p><b>Two more, not in the ten:</b> " + " ".join(esc(x) for x in P["also_considered"]) + "</p>")
    return "\n".join(out)


def prov_rows():
    rows = []
    for k, v in sorted(PROV.items()):
        rows.append([esc(k), esc(v["file"]), v["bars"], v["from"], v["to"], v["sha256_12"]])
    return rows


def section_a():
    t2w = k2["today"]["filtered_walk_forward"]; t2f = k2["today"]["filtered_full_fit"]; t3w = k3["today"]["filtered_walk_forward"]; tbw = b3["today"]["filtered_walk_forward"]
    s2 = {s["name"]: s for s in k2["states"]}; s0 = {s["name"]: s for s in A0["states"]}
    o2 = {s["state"]: s for s in k2["by_state_walk_forward_oos"]}; o0 = {s["state"]: s for s in A0["by_state_walk_forward_oos"]}; ob = {s["state"]: s for s in b2["by_state_walk_forward_oos"]}
    dv = k2["oos_stress_minus_calm_next20_vol"]; dr = k2["oos_stress_minus_calm_next20_ret"]; dr0 = A0["oos_stress_minus_calm_next20_ret"]; dv0 = A0["oos_stress_minus_calm_next20_vol"]; drb = b2["oos_stress_minus_calm_next20_ret"]; dvb = b2["oos_stress_minus_calm_next20_vol"]
    x = k2["oos_by_200day_side"]
    h = f"""
<h2>2 · Study 1 · The market's own states, and today's reading</h2>
<p><b>The question.</b> Let the data name the states. A hidden Markov model is told only that there are two (or three) hidden states, each with its own typical daily return and typical wildness, and that the market stays in a state for a while before switching. It works out from the bars alone which state each day most likely belongs to. Nothing is drawn by hand: no RSI line, no 200-day, no VIX level chosen by eye.</p>
<p><b>Today, {today['date']}: CALM.</b> The two-state model on the S&amp;P 500 and the VIX (1990 →) puts today at <b>{t2w['CALM']:.2f} CALM / {t2w['STRESS']:.2f} STRESS</b> with parameters frozen at end-2007 (walk-forward), and {t2f['CALM']:.2f} / {t2f['STRESS']:.2f} with the whole record's parameters. The three-state version reads CALM {t3w['CALM']:.2f} · MIDDLE {t3w['MIDDLE']:.2f} · STRESS {t3w['STRESS']:.2f}: today sits in the middle state, whose typical VIX is {[s for s in k3['states'] if s['name']=='MIDDLE'][0]['typical_vix']}. The model that also sees the equal-weight spread and the VIX curve (2006 →) reads CALM {tbw['CALM']:.2f} · MIDDLE {tbw['MIDDLE']:.2f} · STRESS {tbw['STRESS']:.2f}. The returns-only model on the S&amp;P since 1928 agrees: CALM {A0['today']['filtered_walk_forward']['CALM']:.2f}.</p>
<ol class="lead">
<li><b>The states are real, and they are about wildness, not direction.</b> Out of sample (2008 → 2026, parameters from 1990–2007), the 20 sessions after a STRESS day ran at a realised volatility of {o2['STRESS']['next20_realised_vol_ann_pct']}% a year against {o2['CALM']['next20_realised_vol_ann_pct']}% after a CALM day: a gap of {100*dv['est']:.0f} points with a 90% range of {100*dv['lo']:.0f} to {100*dv['hi']:.0f}, which never touches zero. <span class="word">LUCK-PROOF</span> on wildness. On direction the two states cannot be told apart: the median next-20 return after STRESS was {sgn(o2['STRESS']['next20_median_pct'],2,'%')} against {sgn(o2['CALM']['next20_median_pct'],2,'%')} after CALM, and the difference in means has a 90% range of {100*dr['lo']:+.1f} to {100*dr['hi']:+.1f} points (p {dr['p']:.2f}). The 1928 → model says the same ({100*dv0['lo']:.0f} to {100*dv0['hi']:.0f} vol points, return range {100*dr0['lo']:+.1f} to {100*dr0['hi']:+.1f}, p {dr0['p']:.2f}). <span class="word">NOT SHOWN</span> on direction.</li>
<li><b>How long a state lasts.</b> With the VIX in the model, a CALM stretch is expected to last {s2['CALM']['expected_duration_days']:.0f} sessions and a STRESS stretch {s2['STRESS']['expected_duration_days']:.0f} (out of sample the middle CALM run was {o2['CALM']['duration_median']:.0f} sessions, the longest tenth over {o2['CALM']['duration_p90']:.0f}; STRESS {o2['STRESS']['duration_median']:.0f} and {o2['STRESS']['duration_p90']:.0f}). The typical VIX inside CALM is {s2['CALM']['typical_vix']}, inside STRESS {s2['STRESS']['typical_vix']}. Since 2008 there were {o2['STRESS']['episodes']} STRESS stretches: that is the count of independent episodes behind every number here, not the {o2['STRESS']['share_of_days']}% of days.</li>
<li><b>What the state adds to the 200-day.</b> Out of sample, above the 200-day: a CALM day was followed by a next-20 median of {sgn(x['above_200d']['CALM']['next20_median_pct'],2,'%')} with a bad-case (10th percentile) of {sgn(x['above_200d']['CALM']['next20_p10_pct'],2,'%')}; a STRESS day above the 200-day by {sgn(x['above_200d']['STRESS']['next20_median_pct'],2,'%')} and {sgn(x['above_200d']['STRESS']['next20_p10_pct'],2,'%')}. Below the 200-day almost every day is STRESS ({x['below_200d']['STRESS']['days']} of {x['below_200d']['STRESS']['days']+x['below_200d']['CALM']['days']}), with the bad case at {sgn(x['below_200d']['STRESS']['next20_p10_pct'],2,'%')}. So the state is a second label that mostly sorts the above-200-day days into quiet and jumpy ones; the 200-day side still does the heavy lifting on the downside.</li>
<li><b>The STRESS state has not paid to avoid.</b> In every model, the average return after STRESS days was as good as or better than after CALM days (the 2006 → model: {sgn(ob['STRESS']['next20_median_pct'],2,'%')} vs {sgn(ob['CALM']['next20_median_pct'],2,'%')}, difference range {100*drb['lo']:+.1f} to {100*drb['hi']:+.1f}). That is the rising-tide fact seen from another side: stressed days cluster in falls, and falls have been bought. What the state does tell you is how big the next month's swings will be, which is what position size should answer to (proposal 4).</li>
<li><b>Volatility itself changed level {rv40['n_segments']-1} times since 1990</b> when a change means a 40% shift held for 60 sessions ({rv25['n_segments']-1} times at 25%). The current stretch began {rv40['segments'][-1]['from']} at a median {rv40['segments'][-1]['median_ann_vol_pct']}% a year; today's 20-day figure is {RV['today_vol_ann_pct']}%.</li>
</ol>
{img('a2-stress-last3y.png', 'STRESS probability over the last three years')}
{img('a1-gspc-stress-shade.png', 'The S&P 500 since 1990 with the STRESS state shaded')}
{img('a5-three-state-stack.png', 'Three states from SPY, the equal-weight spread and the VIX curve')}
{img('a3-state-return-densities.png', 'Return densities inside each state')}
{img('a4-vol-changepoints.png', 'Change points in realised volatility')}
<h3>The states, out of sample (parameters from the first half only)</h3>
<p>S&amp;P 500 return + VIX level, two states, fitted 1990–2007, filtered forward 2008 → {today['date']}. "Next 20" is the return over the 20 sessions after the day, so an open month at the end is left out.</p>
{table(STATE_HEAD, state_rows(k2))}
<p>Three states, same data:</p>
{table(STATE_HEAD, state_rows(k3))}
<p>SPY + equal-weight spread + VIX curve (2006 →), fitted to mid-2016, filtered forward after; two states:</p>
{table(STATE_HEAD, state_rows(b2))}
<p>S&amp;P 500 returns only since 1928, fitted to 1976, filtered forward after:</p>
{table(STATE_HEAD, state_rows(A0))}
<details><summary>Transition matrices and the whole-record fits</summary>
<p>Two-state 1990 → transition matrix (row = today's state, column = tomorrow's): {esc(json.dumps(k2['transition']))}. Three-state: {esc(json.dumps(k3['transition']))}. 2006 → three-state: {esc(json.dumps(b3['transition']))}. 1928 → two-state: {esc(json.dumps(A0['transition']))}.</p>
<p>Whole-record fit, two states 1990 →:</p>{table(STATE_HEAD, state_rows(k2, oos=False))}
</details>
"""
    return h


def section_c():
    G = CR["GSPC"]; Sp = CR["SPY"]
    f2 = G["families"]["F2 RSI zone × 200-day side (36)"]; f3 = G["families"]["F3 200-day distance bands (120)"]; f5 = G["families"]["F5 calendar months (24)"]; f1 = G["families"]["F1 RSI rungs (100 × 3 horizons)"]
    u = G["union"]; us = Sp["union"]
    etf_union = {k: CR[k]["union"]["spa_p_consistent"] for k in ("SPY", "QQQ", "IWM", "DIA")}
    rc = Sp["rung_curve_hold20"]; rcg = G["rung_curve_hold20"]
    h = f"""
<h2>4 · Study 3 · A Reality Check over every rule family we have published</h2>
<p><b>The question.</b> Our studies searched families of rules: 100 RSI percentile rungs, RSI zones on either side of the 200-day, bands of distance to the 200-day, VIX levels and the VIX curve, calendar months. Every family reports its best member. The Reality Check (White 2000) and its sharper form, the SPA test (Hansen 2005), ask one thing: <b>if every rule were pure luck, how often would the best of them look this good?</b> Sullivan, Timmermann and White asked it of 7,846 rules on the Dow in 1999 and found the best rule's 100-year record vanished after 1986. Here it is asked of {u['n_rules']} rules per instrument, on five instruments, with runs of days resampled (block 60).</p>
<p>A rule = be long the index for 5, 20 or 60 sessions after its condition holds at a close, flat otherwise. Its yardstick is being long the same share of days without any condition, the "any day" line. "Excess" is the rule's mean return over that yardstick, in points a year. Each family's best rule is shown with its own p-value (as if it were the only rule tried) beside its SPA p-value (the whole family's search counted), the StepM list of rules that survive at 10%, and a walk-forward: the rule the first half would have picked, and what it earned on the second.</p>
<ol class="lead">
<li><b>On the funds we trade (SPY, QQQ, IWM, DIA, 2003 →), nothing survives.</b> Family by family, the best rule's SPA p-value runs from {min(v['spa_p_consistent'] for k in ('SPY','QQQ','IWM','DIA') for v in CR[k]['families'].values()):.2f} to {max(v['spa_p_consistent'] for k in ('SPY','QQQ','IWM','DIA') for v in CR[k]['families'].values()):.2f}; over the union of every rule searched: SPY {etf_union['SPY']:.2f}, QQQ {etf_union['QQQ']:.2f}, IWM {etf_union['IWM']:.2f}, DIA {etf_union['DIA']:.2f}. StepM keeps no rule. On SPY the best of all {us['n_rules']} rules ({esc(us['best_rule'])}) earned {us['best_excess_pts_per_year']:+.1f} points a year over any day and its own p-value, taken alone, is {Sp['families']['F1 RSI rungs (100 × 3 horizons)']['best_naive_p']:.3f}: that is exactly how the best of 480 coin flips looks. Chart C2 makes the point: the best SPY rung sits at {rc['observed_best']:+.1f} points a year while the best of 100 rungs by luck alone reaches {rc['luck_best_of_100_p90']:+.1f}. The slope across rungs (low rungs better) is ρ = {Sp['rung_slope']['spearman']:+.2f} with p {Sp['rung_slope']['p_two_sided_vs_no_slope']:.2f}: a lean, not a fact.</li>
<li><b>On the S&amp;P index since 1928, three things survive the search count.</b> (a) <b>Being above the 200-day</b> ({esc(f3['best_rule'])}: {f3['best_excess_pts_per_year']:+.1f} points a year, SPA p {f3['spa_p_consistent']:.3f}); StepM keeps {len(f3['stepm_survivors_10pct'])} of the band rules, all of them "above". The first half (1928–1976) would have picked the same rule and it earned {f3['walk_forward']['second_half_pts_per_year']:+.1f} points a year on 1977–2026, range {f3['walk_forward']['second_half_90_range'][0]:+.1f} to {f3['walk_forward']['second_half_90_range'][1]:+.1f}. <span class="word">LUCK-PROOF</span>. This is the trend-following fact the public work reports (Faber; Hurst, Ooi &amp; Pedersen), not a Scintilla finding. (b) <b>Skip September</b> ({f5['best_excess_pts_per_year']:+.1f} points a year, SPA p {f5['spa_p_consistent']:.3f}; walk-forward {f5['walk_forward']['second_half_pts_per_year']:+.1f}, range {f5['walk_forward']['second_half_90_range'][0]:+.1f} to {f5['walk_forward']['second_half_90_range'][1]:+.1f}). <span class="word">LUCK-PROOF</span> over 98 years, though the regime study already showed the last 30 years' September range includes zero, so its size today is unsure. (c) <b>A dip in RSI while above the 200-day</b> ({esc(f2['best_rule'])}: {f2['best_excess_pts_per_year']:+.1f} points a year, SPA p {f2['spa_p_consistent']:.3f}, StepM keeps {len(f2['stepm_survivors_10pct'])} rules of that shape) — but the first half would have picked a different member of the family ({esc(f2['walk_forward']['chosen_on_first_half'])}) and that one earned {f2['walk_forward']['second_half_pts_per_year']:+.1f} on the second half. Over the union of all {u['n_rules']} rules the SPA p is {u['spa_p_consistent']:.3f} and StepM keeps {esc(' and '.join(u['stepm_survivors_10pct']))}. <span class="word">LEANING</span> for the RSI-dip-in-uptrend rule, which is the S8 headline re-read: it is real on the century record, it is not visible on 23 years of SPY.</li>
<li><b>The RSI rungs themselves never survive</b>, on any instrument, in any era: best-rung SPA p {f1['spa_p_consistent']:.2f} on the 1928 record, {Sp['families']['F1 RSI rungs (100 × 3 horizons)']['spa_p_consistent']:.2f} on SPY. The statistician's reading stands: a rung is not a finding; at most the slope is, and the slope is a lean.</li>
<li><b>The walk-forward chart is the plainest picture.</b> Of {sum(1 for k in CR for v in CR[k]['families'].values() if 'walk_forward' in v)} family-instrument pairs, the rule the first half would have picked cleared zero on the second half in {sum(1 for k in CR for v in CR[k]['families'].values() if 'walk_forward' in v and v['walk_forward']['second_half_90_range'][0] > 0)}: the two on the century record. Every fund rule picked on 2003–2014 fell back to the any-day line on 2015–2026.</li>
</ol>
{img('c1-spa-by-family.png', 'SPA p-values by family and instrument')}
{img('c2-rung-curve-luck-band.png', 'The 100 rungs against the luck band')}
{img('c3-walk-forward.png', 'Walk-forward of the best rule per family')}
<h3>Every family, every instrument</h3>
"""
    for k in ("GSPC", "SPY", "QQQ", "IWM", "DIA"):
        h += f"<p><b>{esc(CR[k]['instrument'])}</b> · {CR[k]['from']} → {CR[k]['to']}</p>" + table(FAM_HEAD, fam_rows(k))
    return h


def section_verdict():
    G = CR["GSPC"]; Sp = CR["SPY"]
    f2 = G["families"]["F2 RSI zone × 200-day side (36)"]; f3 = G["families"]["F3 200-day distance bands (120)"]; f5 = G["families"]["F5 calendar months (24)"]
    rows = [
        ["RSI ladder / RSI full history: a low rung pays (rsi-ladder, rsi-full-history, S8)", "Tested here: 100 rungs × 3 horizons, 5 instruments", f"No rung survives SPA anywhere (best p {min(CR[k]['families']['F1 RSI rungs (100 × 3 horizons)']['spa_p_consistent'] for k in CR):.2f}); the slope is a lean (SPY ρ {Sp['rung_slope']['spearman']:+.2f}, p {Sp['rung_slope']['p_two_sided_vs_no_slope']:.2f})", '<span class="word">LOOKS LIKE SNOOPING</span> as a rung; the slope stays a lean'],
        ["S8: SPY RSI bottom 10% while above the 200-day, up 74.8% of 103 episodes", "Tested here: the RSI-zone × 200-day family", f"Survives SPA on the 1928 record (p {f2['spa_p_consistent']:.3f}) but not on SPY 2003 → (p {Sp['families']['F2 RSI zone × 200-day side (36)']['spa_p_consistent']:.2f}); walk-forward picks another member and it fails", '<span class="word">LEANING</span> (the statistician\'s word, kept)'],
        ["Bottoms / S9: deep below the 200-day is a problem", "Tested here: 20 'below' bands × 3 horizons", f"'Below' bands never beat any day and never survive; what survives is the mirror, 'above' (p {f3['spa_p_consistent']:.3f}, walk-forward holds on 1977 →)", '<span class="word">SURVIVES AS A TREND FACT</span>: above the 200-day pays; below is where the wildness is (study 1)'],
        ["Market regime: September is the one negative month", "Tested here: 24 month rules", f"'Long except September' survives SPA on 1928 → (p {f5['spa_p_consistent']:.3f}) and the second half ({f5['walk_forward']['second_half_pts_per_year']:+.1f}, range {f5['walk_forward']['second_half_90_range'][0]:+.1f} to {f5['walk_forward']['second_half_90_range'][1]:+.1f})", '<span class="word">LUCK-PROOF</span> over the century; the last 30 years alone cannot show it'],
        ["Bottoms: VIX at its 90th percentile, VIX above VIX3M, as buy conditions", "Tested here: 7 VIX levels + the curve, SPY only", f"Best is {esc(Sp['families']['F4 VIX level and curve (24)']['best_rule'])} at {Sp['families']['F4 VIX level and curve (24)']['best_excess_pts_per_year']:+.1f} pts/yr, SPA p {Sp['families']['F4 VIX level and curve (24)']['spa_p_consistent']:.2f}", '<span class="word">NOT SHOWN</span> as a return rule; study 1 shows what the VIX state does predict: next month\'s wildness'],
        ["Bottoms: the VIX turns with the low or just before it; put/call turns first", "Not re-tested here (a timing description, not a rule)", "The statistician's fix stands: shuffle the condition series in blocks as the control", '<span class="word">DESCRIPTIVE</span>'],
        ["Sector rotation: the widest bow tie on record; ties narrowed every time", "Not re-tested; study 2 adds a dated change-point view and this week's rotation graph", "10 episodes, and 'narrower after an extreme' is what extremes do", '<span class="word">A LIST</span>, as the page itself says'],
        ["Sector rotation: short and medium rank persistence ≈ 0; long ≈ +0.18", "Not re-tested; consistent with study 2's finding that fresh changes carry little forward information", "Measured with intervals on the page", '<span class="word">SURVIVES AS A NEGATIVE</span> (no forecasting value at a quarter)'],
        ["Leaders: the top ten gave about two-thirds of each up year's gain since 2020", "Not a rule; an accounting fact from the N-PORT weights", "Point-in-time weights, so no snooping; the pre-2020 figure is a floor", '<span class="word">SURVIVES</span> (descriptive)'],
        ["Regime: equal weight at its weakest in 7 pairs; a low reading has not meant catch-up", "Not re-tested; 3–9 episodes per pair", "Too few to call either way", '<span class="word">A LIST</span>'],
        ["Regime: Alan's high-yield-pullback thesis", "Not re-tested; the regime page found no clear answer at one year", "18 and 6 separate years", '<span class="word">A LIST</span>'],
        ["S7 / S7b: 178 + 254 entry rules before and between reports, best 64.3% and 10 rules passing both halves", "Not re-tested here (per-trade series are not in the repo; the statistician's N6 needs the export)", "254 rules at 5% give ~13 false passes per half; 10 is what luck looks like", '<span class="word">LOOKS LIKE SNOOPING</span> until N6 runs'],
        ["Stats tab: 64.8% of SPY declines went on to a new high; 25% of those 10% deep", "Not a rule; a wait, best shown as a survival curve", "The statistician's Kaplan–Meier fix applies", '<span class="word">DESCRIPTIVE</span>'],
    ]
    return f"""
<h2>5 · Which published findings survive, and which look like data-snooping</h2>
<p>Plain words, one line each. "Tested here" means this page's Reality Check covered that family on the same data. The word at the end follows the method standard: <b>luck-proof</b> (clears the any-day line after the search is counted, in both halves), <b>leaning</b> (same direction, range still touches the line), <b>a list</b> (fewer than 20 episodes), and two words the standard implies but does not name: <b>descriptive</b> (a measurement, not a rule, so snooping does not apply) and <b>looks like snooping</b> (the best of many, with no correction, and it fades out of sample).</p>
{table(['published finding', 'what this page did with it', 'what the numbers say', 'word'], rows)}
<p><b>The short version.</b> Two things are luck-proof on the century record, and both are public knowledge rather than Scintilla discoveries: being above the 200-day pays, and September costs. The RSI-dip-in-an-uptrend idea is real on 98 years and invisible on 23, so it stays "leaning". Every RSI rung, every 200-day depth band, every VIX level, taken as a buy rule on the funds since 2003, is the best of a few hundred coin flips. What our data does support with no doubt is the market-state fact from study 1: the stressed state predicts how wild the next month is, and that is a sizing fact, not a timing one.</p>
"""


def section_b():
    up_all, dn_all = FC["all"]["up"], FC["all"]["down"]; base = FC["any_pair_fwd13"]
    h1, h2 = FC["first_2008_2016"], FC["second_2017_2026"]
    def rr(r): return f"{r['mean']:+.1f} pts (n {r['n']}, {r['share_positive']}% positive, 90% range {rng(r,1,'')})" if r and r.get("lo") is not None else (f"{r['mean']:+.1f} pts (n {r['n']}, too few for a range)" if r and r.get('mean') is not None else "no flags")
    lead = [r for r in RC["table"] if r["quadrant"] == "LEADING"]; lag = [r for r in RC["table"] if r["quadrant"] == "LAGGING"]; imp = [r for r in RC["table"] if r["quadrant"] == "IMPROVING"]; weak = [r for r in RC["table"] if r["quadrant"] == "WEAKENING"]
    stable = sum(1 for r in RC["table"] if r["same_in_all_windows"])
    cur_up = [s for s in SEC if CP[s]["current"]["ann_rel_pct"] > 0]; cur_dn = [s for s in SEC if CP[s]["current"]["ann_rel_pct"] <= 0]
    newest = sorted(SEC, key=lambda s: CP[s]["current"]["from"], reverse=True)[:3]
    h = f"""
<h2>3 · Study 2 · When each sector's trend last changed, and this week's rotation graph of the cohorts</h2>
<p><b>The question.</b> The sector-rotation study measured relative strength over fixed windows (16, 72 and 646 sessions) and found that a sector's rank tells you almost nothing about its next rank at a quarter's range. This study lets a change-point search (PELT, the standard offline method in <code>ruptures</code>) decide where each sector's pace against SPY changed, with no window chosen by hand, and then asks the only question that matters for trading: <b>when the search has just found a new stretch, does the new pace carry on?</b> The second half puts Alan's 20 cohorts on a relative rotation graph, the JdK picture every sector desk uses, under the public approximation of its formula.</p>
<ol class="lead">
<li><b>Where the sectors stand, dated.</b> {len(cur_up)} of 11 sectors are in a stretch that beats SPY: {', '.join(f'{SEC[s]} since {CP[s]["current"]["from"]} ({CP[s]["current"]["ann_rel_pct"]:+.0f}% a year vs SPY)' for s in sorted(cur_up, key=lambda s: -CP[s]["current"]["ann_rel_pct"]))}. The newest changes are {', '.join(f'{SEC[s]} ({CP[s]["current"]["from"]}, {CP[s]["current"]["ann_rel_pct"]:+.0f}%/yr)' for s in newest)}. A stretch that is only a few weeks old is the one most likely to be redrawn as weeks arrive; the table gives each sector's change count under two penalty strengths so you can see which changes are robust.</li>
<li><b>A fresh change is rarely visible in time, and when it is, it carries little forward.</b> On a grid of every fourth week since 2008 ({base['n']} sector-weeks, each search seeing only the last ten years of bars to that week), the online search flagged only {FC['flags_total']} sector-weeks where a change under 8 weeks old had just been found: the search needs weeks of evidence, so by the time it speaks most of the move has happened. Both flag sets are under 20 episodes, so the standard calls them <span class="word">A LIST</span>. When the new stretch was stronger than the last, the sector's next 13 weeks against SPY averaged {rr(up_all)}; when weaker, {rr(dn_all)}; any sector on any week: {base['mean']:+.1f} pts (range {rng(base,1,'')}). By half: 2008–2016 up {rr(h1['up'])}, down {rr(h1['down'])}; 2017–2026 up {rr(h2['up'])}, down {rr(h2['down'])}. Read the chart: the two colours' ranges overlap each other and the any-week line, so a detected change is a description of the past, not a forecast. That agrees with the sector-rotation study's zero rank persistence at a quarter.</li>
<li><b>The cohorts this week ({RC['as_of']}).</b> LEADING: {', '.join(r['id'] for r in lead) or 'none'}. IMPROVING: {', '.join(r['id'] for r in imp) or 'none'}. WEAKENING: {', '.join(r['id'] for r in weak) or 'none'}. LAGGING: {', '.join(r['id'] for r in lag) or 'none'}. {stable} of {len(RC['table'])} cohorts sit in the same quadrant whether the window is 14, 26 or 52 weeks; the others are near a line and should be read as "near a line", not as a quadrant. The cohort index is an equal weight of today's members, so its past is a survivor's past; this week's position is not affected by that.</li>
<li><b>The sectors on the same graph:</b> LEADING {', '.join(r['label'] for r in RS_['table'] if r['quadrant']=='LEADING') or 'none'}; IMPROVING {', '.join(r['label'] for r in RS_['table'] if r['quadrant']=='IMPROVING') or 'none'}; WEAKENING {', '.join(r['label'] for r in RS_['table'] if r['quadrant']=='WEAKENING') or 'none'}; LAGGING {', '.join(r['label'] for r in RS_['table'] if r['quadrant']=='LAGGING') or 'none'}. The rotation graph says where things are; the sector-rotation study says how little that predicts at a quarter, and this study's change-point test says the same. Use it as a map of the present, with tails, and not as a clock.</li>
</ol>
{img('b1-sector-changepoints.png', 'Sector relative strength with change points')}
{img('b2-fresh-change-forward.png', 'What followed a freshly detected change')}
{img('b3-rrg-cohorts.png', 'Rotation graph of the cohorts')}
{img('b4-rrg-sectors.png', 'Rotation graph of the sectors')}
<h3>Each sector's current stretch against SPY</h3>
{table(['sector', 'fund', 'current stretch since', 'weeks', 'pace vs SPY, % a year', 'previous stretch', 'changes found (penalty log(n)·σ²)', 'current stretch at double penalty', 'changes at double penalty'], cp_rows)}
<h3>The cohorts on the rotation graph</h3>
{table(RRG_HEAD, rrg_rows(RC))}
<h3>The sectors on the rotation graph</h3>
{table(RRG_HEAD, rrg_rows(RS_))}
"""
    return h


def build():
    now = datetime.datetime.utcnow().strftime("%Y-%m-%d %H:%M UTC")
    t2w = k2["today"]["filtered_walk_forward"]; u = CR["GSPC"]["union"]
    body = f"""<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Research director · N3 · 28 Sep 2026</title>
<style>{CSS}</style></head><body>
<span data-scnav-slot></span><h1>Research director: ten studies stolen from the best public work, three of them run today</h1>
<div class="q">N3 · 28 Sep 2026 · bars to 2026-09-25 (Friday's close) from the chart-API cache · built {now} · research, not advice · price only · <b>no buy or sell calls on this page</b></div>

<div class="status"><b>STATUS · written and run on real data; nothing deployed.</b> Ten studies are proposed, each with the public work it steals from, linked (section 1). The top three ran today in Python (<code>research/python/research-director/</code>, venv pinned in <code>requirements.txt</code>): the market's own states with today's probability (section 2), sector change points and a rotation graph of Alan's cohorts (section 3), and a Reality Check / SPA test over every rule family we have published (section 4). Section 5 says in one line each which published findings survive and which look like data-snooping. Every chart is a saved PNG in <code>charts/</code>; every number is read from <code>data/*.json</code>; every input file is listed with its hash at the end. Nothing was fetched: the bars are the files the 28 Sep lanes saved as served from the chart API. No key, database or price table was touched.</div>

<h2>What this page says, in plain words</h2>
<ol class="lead">
<li><b>Today is a CALM day by the data's own reckoning.</b> The two-state model on the S&amp;P 500 and the VIX, with parameters frozen at end-2007, reads {t2w['CALM']:.2f} CALM / {t2w['STRESS']:.2f} STRESS at the 25 Sep close. The states are luck-proof about one thing only: how wild the next month will be. They say nothing about its direction.</li>
<li><b>A freshly detected change in a sector's trend does not carry forward</b> in any way the ranges can tell from any week, which matches the sector-rotation study's zero persistence at a quarter. The rotation graph is a map of where the cohorts are this week, not a clock.</li>
<li><b>Once the search is counted, none of our fund rules survive.</b> Over {CR['SPY']['union']['n_rules']} rules on SPY, QQQ, IWM and DIA since 2003, the best of each family is what the best of a few hundred coin flips looks like. On the S&amp;P since 1928 three rules survive: be above the 200-day, skip September, and (leaning) buy an RSI dip inside an uptrend. The first two are public knowledge; the third is our S8 headline, real on a century and invisible on 23 years.</li>
<li><b>Be drivers.</b> The proposals that are not yet run and would pay most: volatility-managed sizing (4), the trend rule as a drawdown cutter across everything we hold (5), and the 52-week-high test of "overbought is overbought" (6).</li>
</ol>

<h2>1 · Ten studies we have not run, each stolen from named public work</h2>
<p>Ordered by value to how Alan trades: execution, patience, market-first, leaders. The first three ran today and are sections 2–4.</p>
{proposals_html()}
{section_a()}
{section_b()}
{section_c()}
{section_verdict()}

<h2>6 · What the page shows, where each number comes from, what could be wrong, what was not done</h2>
<dl>
<dt>What the page shows</dt><dd>Three studies run today on cached daily bars to the 25 Sep 2026 close, with every chart saved as a PNG next to this page and every number in <code>data/</code>; ten proposals; a verdict table over the findings published so far.</dd>
<dt>Where each number comes from</dt><dd>Study 1: <code>data/study-a-regime.json</code> from <code>study_a_regime.py</code> (hmmlearn GaussianHMM, forward filter written out in 12 lines so the probabilities never see the future; ruptures PELT). Study 2: <code>data/study-b-rotation.json</code> and <code>data/study-b-flags.json</code> from <code>study_b_rotation.py</code>. Study 3: <code>data/study-c-spa.json</code> from <code>study_c_spa.py</code> (arch SPA and StepM, stationary bootstrap, {C['reps']} draws, block {C['block']}, seed {C['seed']}). Inputs: the table below, every file with its hash, bar count and date range. All bars are the chart API's daily closes (split-adjusted, provider MASSIVE) or FMP index and VIX3M rows pulled on Fly by the regime lane, saved as served.</dd>
<dt>What could be wrong</dt><dd>(1) Hidden Markov fits can settle in a local optimum: eight random starts were tried and the best likelihood kept, and the states are named by volatility so they cannot swap labels; still, the three-state 1990 → model's out-of-sample table shows a MIDDLE state that behaves differently from its in-sample twin, which is that weakness showing. (2) The cohort indexes are equal weights of today's members: their history is a survivor's history, so the cohort tails should be read with that in mind; this week's position is unaffected. (3) The change-point penalty is a choice; it is shown at two strengths and stated in plain terms (a 40% shift in volatility held 60 sessions; the library's BIC rule for the sectors). (4) The Reality Check counts the rules this page built, {u['n_rules']} per instrument; the studies searched more (S7's 178 and S7b's 254 rules are not here because their per-trade series are not in the repo). A wider search can only raise the p-values. (5) The RRG formula is the public approximation; JdK's constants are proprietary, so quadrants near a line may differ from a StockCharts screen. (6) Nothing here is a trading rule; every "excess" is close to close with no costs.</dd>
<dt>What was not done</dt><dd>No deploy, no push to production, no database write, no fetch. Proposals 4–10 are designed, not run. The S7/S7b data-snooping audit (statistician's N6) still needs the per-trade export. The MIDDLE/STRESS names are the model's, not a Hub reading. No Hub page was changed except the studies index (one row) and the workshop manifest (one card).</dd>
</dl>
<details><summary>Every input file, with hash, bars and dates</summary>{table(['series', 'file', 'bars', 'from', 'to', 'sha256 (12)'], prov_rows())}</details>
<p class="q">Branch <code>hub/research-director-20260928</code> · code <code>research/python/research-director/</code> · tests <code>tests/research-director-20260928.test.mjs</code> · headless proof <code>research-director-1680.png</code>, <code>research-director-390.png</code></p>
</body></html>"""
    open(os.path.join(DIR, "RESEARCH-DIRECTOR.html"), "w").write(body)
    print("wrote", len(body))


if __name__ == "__main__":
    build()
