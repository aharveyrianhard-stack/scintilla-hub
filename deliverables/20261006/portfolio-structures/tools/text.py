# PF1 · the page's words. Every number inside a sentence is read from the data files when the page is built, so the words
# cannot drift from the tables. Plain words throughout; anything technical is translated where it first appears.
import json, os
from viz import pct, pts, esc

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
def J(name):
    p = os.path.join(DATA, name); return json.load(open(p)) if os.path.exists(p) else None
def var(sj, key): return next(v for v in sj["variants"] if v.get("key") == key)
def dmy(d):
    y, m, dd = d.split("-"); return f"{int(dd)} {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(m) - 1]} {y}"
P = lambda x, s=True, dp=1: pct(x, s, dp)
def Fl(x, dp=1): return "—" if x is None else f"{abs(x):.{dp}f}%"          # a fall, in prose: the word "fall" already carries the sign
def side(x, dp=2): return f"{abs(x):.{dp}f} points {'behind' if x < 0 else 'ahead of'}"


def make(S0, S, HEAD):
    B = {v["label"]: v for v in S0["variants"]}
    spy, qqq, mix, bills = B["Buy and hold SPY"], B["Buy and hold QQQ"], B["60/40 (SPY / 7-10y Treasuries)"], B["All cash (Treasury bills)"]
    lad, dials, flat = B["Cash by default — the July heat ladder"], B["R4's two dials (REGIME + STRETCH)"], B["A flat share in SPY equal to the ladder's average"]
    s1, s2, s3, s4, s5, s6 = (S[k] for k in ["s1_core_satellite", "s2_trend_core", "s3_dual_momentum", "s4_vol_sizing", "s5_level_scaling", "s6_paid_to_wait"])
    C = J("s7_combined.json"); M = J("s6b_cboe_measured.json")
    L2 = lambda v: v["last2"]; F = lambda v: v["full"]
    s1h, s1cash = var(s1, "sat_sectors_to_core"), var(s1, "sat_sectors_to_cash"); g1 = s1["extras"]["exit_destination_gap"]; rt = s1["extras"]["satellites"]["sat_sectors_to_core"]["round_trips"]["full"]
    s2h, s2slow, s2mo, s2only = var(s2, "trend_and_breadth"), var(s2, "trend_and_breadth_3day"), var(s2, "trend_monthly"), var(s2, "trend_only")
    o2, o2s = s2["extras"]["outs"]["trend_and_breadth"], s2["extras"]["outs"]["trend_and_breadth_3day"]
    s3h, s3c = var(s3, "dm_spy_qqq"), var(s3, "dm_classic"); tl = s3["extras"]["timing_luck"]; bv3 = s3["extras"]["by_variant"]["dm_spy_qqq"]
    last3 = o2s["spells"][-1]; fd = s2["extras"]["fill_one_session_later"]
    luck = [tl["month_end_run"]["full_cagr_pct"]] + [r["full_cagr_pct"] for r in tl["runs"]]; luck2 = [tl["month_end_run"]["last2_total_return_pct"]] + [r["last2_total_return_pct"] for r in tl["runs"]]
    s4r, s4d, s4v = var(s4, "sectors_equal_risk"), var(s4, "sectors_equal_dollar"), var(s4, "spy_vol_target_15"); lw = s4["extras"]["baskets"]["leaders"]
    s4lr, s4ld = var(s4, "leaders_equal_risk"), var(s4, "leaders_equal_dollar"); b15 = s4["extras"]["spy_vol_target"]["15"]
    x5 = s5["extras"]["entry_experiment"]; r5 = {r["method"]: r for r in x5["tables"]["all"] if r["asset"] == "SPY" and r["horizon"] == 252}
    s5t, s5o = var(s5, "reenter_in_thirds"), var(s5, "reenter_at_once")
    put, bxm, bxy = var(M, "put_measured"), var(M, "bxm_measured"), var(M, "bxy_measured"); x6 = s6["extras"]["entry_experiment"]["full"]["methods"]; cs = s6["extras"]["contract_size_today"]
    gap6 = {g["measured"]: g for g in (M.get("model_gap") or [])}
    both = var(C, "core_sat_filtered"); f50, f60, f70 = (var(C, f"ladder_floor_{n}") for n in (50, 60, 70))
    rung = lad.get("rung_days") or {}; nses = L2(lad)["sessions"]
    lad_cash = L2(lad)["avg_cash_pct"]; left = L2(spy)["total_return_pct"] - L2(lad)["total_return_pct"]
    timing = L2(lad)["total_return_pct"] - L2(flat)["total_return_pct"]; share_cost = L2(spy)["total_return_pct"] - L2(flat)["total_return_pct"]
    T = {"best_fit_keys": ["s1_core_satellite", "s2_trend_core"]}

    T["lead"] = (f"<b>The calls were not the problem. The default was.</b> Over the last two years the allocation tool's own ladder kept {L2(lad)['avg_stock_pct']:.0f}% of the money in stocks on average while SPY made {P(L2(spy)['total_return_pct'])}. "
                 f"The ladder made {P(L2(lad)['total_return_pct'])}: {left:.0f} points behind. Its timing was not the reason. The timing was good — worth {pts(timing)} points over simply holding that same {flat['flat_share_pct']:.0f}% the whole way. Being that light is what cost: {share_cost:.0f} points against holding the index. "
                 f"So the fix is not better timing. It is changing where money sits when there is no trade on: in an index core, not in cash.")
    T["sub"] = ("Educational research for your own decision process, on our own daily bars from 3 Jan 2005 to 5 Oct 2026 (dividends added back, trading costs charged, every rule acting one day after its signal). "
                "It presents structures and evidence, not orders: I am not a licensed adviser and nothing here sizes a real position. The ladder figures are the tool's template replayed, not your account.")
    T["kpis"] = [
        {"k": "in stocks, on average", "v": f"{L2(lad)['avg_stock_pct']:.0f}%", "n": f"the July ladder over the last two years ({rung.get('30', '—')} of {nses} days at 30%, never above 80%)"},
        {"k": "left on the table", "v": f"{left:.0f} points", "n": f"ladder {P(L2(lad)['total_return_pct'])} against SPY {P(L2(spy)['total_return_pct'])}, 3 Oct 2024 → 5 Oct 2026"},
        {"k": "sold → index, not cash", "v": f"{pts(g1['full_cagr_pts'])} a year", "n": f"what that one rule was worth in the core + satellite test, 2005–2026 ({pts(g1['last2_total_return_pts'])} points over the last two years)"},
        {"k": "time in cash, slow trend rule", "v": f"{L2(s2slow)['avg_cash_pct']:.0f}%", "n": f"of the last two years ({F(s2slow)['avg_cash_pct']:.0f}% of the last 21), against the ladder's {lad_cash:.0f}%"}]
    T["cap_hero"] = ("Orange is where the tool's ladder kept you. Blue is each structure's main version over the same two years. The return beside each bar is its total for the two years. "
                     "Structure 6's bar is an option-maths estimate of how much stock risk a put seller carries, not a share of money in stocks.")
    T["cap_last2"] = (f"Shaded spans are SPY's three pullbacks of 5% or more, with their depth. The trend line shown is the slow version (three closes in a row); the same rule checked daily ended at {P(L2(s2h)['total_return_pct'])}, below the ladder. Dual momentum's line is mostly QQQ. Hover the chart for the values on any day.")
    T["cap_full"] = ("The same structures since 2005, which takes in 2008, 2020 and 2022. This is where a trend rule earns its keep and where everything that never sells takes the full fall. The ladder has no line here: its replay only covers two years.")
    T["cap_exposure"] = (f"The slow trend rule was out of stocks on {L2(s2slow)['days_out_of_stock_pct']:.0f}% of these days, in one spell. The ladder sat at 30% or 50% for most of them and reached 80% only briefly, around the April 2025 low — which is exactly when the trend rule was out. The two rules disagree most at the bottom of a sharp fall.")
    T["cap_table"] = ("Return a year = the yearly growth rate with dividends, after costs. Worst fall = the deepest drop from a high to a later low. In stocks = the average share of the money in stocks or stock funds. Decision days = days a month the rule asks for at least one order. "
                      "Negatives are in brackets. The two highlighted rows are the two best fits: 1, and the slow version of 2 (row 2 is the rule exactly as the brief words it, checked every day; 2b asks for three closes in a row). Structure 5 is an entry method: its row here is the trend rule re-entered in thirds, and its real test is the entry experiment further down. "
                      f"Structure 6's row is Cboe's measured put-selling index, which starts in {put['full_from'][:4]} (SPY over those same years: {P(put['spy_same_window']['cagr_pct'])} a year, worst fall {Fl(put['spy_same_window']['max_dd_pct'])}).")

    T["read"] = (
        f"<p><b>Is a long portfolio plus a short-term conviction portfolio how I would set it up? Yes — with two changes to how you put it.</b></p>"
        f"<ol><li><b>The long portfolio is not a second portfolio. It is where all money lives when it is not in a conviction trade.</b> It needs no buy signal of its own. In the test, sending a sold conviction position back to the index instead of to cash was worth {pts(g1['full_cagr_pts'])} points a year over 21 years "
        f"and {pts(g1['last2_total_return_pts'])} points over the last two — with the very same picks.</li>"
        f"<li><b>Cash needs one written reason, and it should be a slow one.</b> The ladder asks the market to prove it is cheap before it lets money in; HEAT1 found its washed-out reading on about one day in twenty. A trend rule asks the market to prove it is broken before it takes money out. "
        f"Checked on three closes in a row it was in cash {F(s2slow)['avg_cash_pct']:.0f}% of the last 21 years and cut the worst fall from {Fl(F(spy)['max_dd_pct'])} to {Fl(F(s2slow)['max_dd_pct'])}. Checked every single day it whipsawed: {o2['count']} exits, {o2['cost']} of which cost money.</li></ol>"
        f"<p>What the six tests say, shortest first: <b>time in the market did most of the work</b>; <b>a fast exit rule is worse than a slow one</b>; <b>waiting for a nearby level is cheap</b> (a resting order at the 50-day average ended a year later {side(r5['M5']['mean_gap_pts'])} buying at once on average, and the level came within six months in all but {r5['M5']['missed_leg_pct']:.1f}% of starts) "
        f"<b>while waiting for a rare one is expensive</b>; and <b>selling options pays less than it looks</b> — Cboe's real put-selling index made {P(F(put)['cagr_pct'])} a year against SPY's {P(put['spy_same_window']['cagr_pct'])} and still fell {Fl(F(put)['max_dd_pct'])} at its worst.</p>")
    T["picks"] = [
        {"title": "Best fit 1 · Core + satellite", "html":
            f"<p><b>Fundamentals pick what:</b> the satellite slots are where the knockout's kept names go. Nothing else on the list has a seat for a fundamentals pick.</p>"
            f"<p><b>Technicals pick when:</b> a pick is bought at a level and sold on a close under a line. The line decides the sale, not a view on the market.</p>"
            f"<p><b>Stop missing legs:</b> a sold pick lands in the index the same day, so the money is never waiting for the next idea. That rule alone was worth {pts(g1['full_cagr_pts'])} points a year.</p>"
            f"<p class='src'>Honest limit: with a mechanical stand-in for your picks (the strongest sector funds), the satellite itself did not beat the index — {rt['beat_spy_pct']:.0f}% of {rt['completed']} positions did. "
            f"The structure kept {P(F(s1h)['cagr_pct'])} a year of SPY's {P(F(spy)['cagr_pct'])}. It keeps you invested; the picks have to earn the rest.</p>"},
        {"title": "Best fit 2 · Trend-filtered core, the slow version", "html":
            f"<p><b>Technicals pick when, for the whole portfolio:</b> the core is in the index unless SPY is under its 200-day average AND most sectors are under theirs, three closes running. That is the only door to cash.</p>"
            f"<p><b>Stop missing legs:</b> it was invested {100 - F(s2slow)['avg_cash_pct']:.0f}% of the last 21 years and {100 - L2(s2slow)['avg_cash_pct']:.0f}% of the last two, against the ladder's {L2(lad)['avg_stock_pct']:.0f}%.</p>"
            f"<p><b>What it buys:</b> the 2008 crash cost it {Fl(s2slow['stress'].get('2008 crash'))} against SPY's {Fl(spy['stress'].get('2008 crash'))}. Its worst fall in 21 years was {Fl(F(s2slow)['max_dd_pct'])}.</p>"
            f"<p class='src'>Honest limit: it sells after a fall has started and buys back after a rise has started. It trailed buy-and-hold by {F(spy)['cagr_pct'] - F(s2slow)['cagr_pct']:.1f} points a year, and its last exit ({dmy(last3['out'])} to {dmy(last3['back_in'])}, {last3['sessions']} sessions) ended with SPY {P(last3['spy_change_pct'])} from where it sold. "
            f"Only {o2s['saved']} of its {o2s['count']} exits saved money; those few were the big ones.</p>"}]
    T["read_after"] = (
        f"<h3>The two together, and the smallest first step</h3>" + "{S7_TABLE}" +
        f"<p>Put together — index core, three satellite slots, a sold satellite back to the core, the core in cash only under the slow rule — the test made {P(F(both)['cagr_pct'])} a year with a worst fall of {Fl(F(both)['max_dd_pct'])} over 21 years, "
        f"and {P(L2(both)['total_return_pct'])} over the last two years against the ladder's {P(L2(lad)['total_return_pct'])}, with {L2(both)['avg_stock_pct']:.0f}% in stocks on average. For scale, a 60/40 portfolio made {P(F(mix)['cagr_pct'])} a year with a worst fall of {Fl(F(mix)['max_dd_pct'])}, and buy-and-hold SPY {P(F(spy)['cagr_pct'])} with {Fl(F(spy)['max_dd_pct'])}. That is before your picks add or take away anything.</p>"
        f"<p><b>The smallest change that would have closed most of the gap</b> is not a new structure at all: keep the ladder, but put an index floor under it so the ladder only steers the part above the floor. With a 60% floor the same ladder readings made {P(L2(f60)['total_return_pct'])} "
        f"instead of {P(L2(lad)['total_return_pct'])} (worst fall {Fl(L2(f60)['max_dd_pct'])} instead of {Fl(L2(lad)['max_dd_pct'])}).</p>"
        f"<p><b>What I would not lead with.</b> <i>Dual momentum</i> has the best numbers on the page, but most of that is QQQ, chosen today knowing it won; move its monthly look by a few days and the yearly return runs from {P(min(luck))} to {P(max(luck))}. It is a fine once-a-month check for what the core holds, not a plan. "
        f"<i>Volatility sizing</i> is a way to size the satellite's positions, not a structure. <i>Level-based buying</i> is the right way to enter a satellite position, with a deadline. <i>Selling puts</i> needs size — one SPY contract ties up about ${cs['SPY_one_contract_usd']:,.0f} — and in the test it was a weaker way in than a plain resting order at the same level.</p>")
    T["cap_pullbacks"] = ("For each pullback: the share in stocks at SPY's high and at its low, how far the structure fell between the two, and what it made over the 40 sessions after the low. "
                          f"The ladder went into the big one light and came out of it heavier, which is why its fall was small; the trend rule did the opposite and sold near the low. Structure 6 is Cboe's measured index, so it has no stock share to show.")
    T["cap_breakouts"] = ("A breakout here is the first daily close above the latest confirmed two-week pivot high — HEAT1's rule, which reproduces the reviewed SPY and QQQ 2W P1 dates. The last column adds up the 20 sessions after each breakout that has them: what the structure made of what the fund made. "
                          f"The ladder held {sum(e['stock_on_break_pct'] for e in lad['scorecard']['breakouts']) / len(lad['scorecard']['breakouts']):.0f}% in stocks on the average breakout day.")

    lit_note = ""
    T["structures"] = {
        "s1_core_satellite": {"lit": "core-satellite",
            "verdict": (f"<b>Your idea, and the plumbing is right.</b> With sector funds standing in for your picks it made {P(F(s1h)['cagr_pct'])} a year against SPY's {P(F(spy)['cagr_pct'])}, always fully invested. "
                        f"The same picks with sold money parked in cash made {P(F(s1cash)['cagr_pct'])}. The gap between those two — not the picks — is the finding."),
            "tools": ("<ul><li><b>What:</b> the knockout's kept names (allocation step 5 → 6) fill the satellite slots. Today its score gives growth 25%, the same as price, margin and debt; you asked on 6 Oct for growth to weigh most, and that is not in the code yet.</li>"
                      "<li><b>When to buy:</b> a reviewed line the name has closed above, with the Geiger as the pace (trend half still up, momentum half cooled) and SG1's “cold for itself” reading.</li>"
                      "<li><b>When to sell:</b> a daily close under the line the plan names. The money goes to the index sleeve that day.</li>"
                      "<li><b>How big the satellite is:</b> R4's REGIME dial (its proposal: a quarter of invested money in an uptrend, a fifth in a range, a tenth in a breakdown).</li></ul>"),
            "wrong": ("<ul><li>The satellite picks tested are a strength rule on sector funds, not your knockout. The knockout keeps no history, so its picks cannot be tested yet.</li>"
                      "<li>The two rows on today's AI leaders use hindsight: the list was chosen knowing who won. Read them as a ceiling, not a result.</li>"
                      f"<li>Nothing here protects the core: in the 2008 crash this structure fell {Fl(s1h['stress'].get('2008 crash'))}.</li></ul>")},
        "s2_trend_core": {"lit": "trend-filtered-core",
            "verdict": (f"<b>It answers the question in the brief: how much cash does “always invested unless the regime breaks” imply? {F(s2h)['avg_cash_pct']:.0f}% of the time over 21 years, and {L2(s2h)['avg_cash_pct']:.0f}% of the last two years, against the ladder's {lad_cash:.0f}%.</b> "
                        f"The price is whipsaw. The rule exactly as the brief words it, checked daily, made {P(F(s2h)['cagr_pct'])} a year with a worst fall of {Fl(F(s2h)['max_dd_pct'])}; asking for three closes in a row made {P(F(s2slow)['cagr_pct'])} with {Fl(F(s2slow)['max_dd_pct'])}. "
                        f"Over the last two years it trailed even the ladder when checked daily ({P(L2(s2h)['total_return_pct'])}) and beat it with the three-close wait ({P(L2(s2slow)['total_return_pct'])})."),
            "tools": ("<ul><li><b>The switch:</b> R4's REGIME dial already holds this test (SPY against its 200-day, plus how many of our own served companies are above their 200-day and 50-day). This structure is its plainest form.</li>"
                      "<li><b>STRETCH stays out of it:</b> Geiger percentiles, RSI / Williams and the VIX reading pace adds and trims inside the invested part. Under this structure they do not move money to cash.</li>"
                      "<li><b>Reviewed lines:</b> SPY's and QQQ's 2W P1 are the early warning. A lost line with breadth already weak is the day to look, not yet the day to act.</li>"
                      "<li><b>Breadth:</b> the test used sector funds so it could run 21 years. Over the last two years our own served-company breadth gave a similar answer (the last row of the table).</li></ul>"),
            "wrong": (f"<ul><li>The three-close wait was one of five versions set before the test, but it is still the best of five. Expect less from it than the table shows.</li>"
                      f"<li>Trend rules have had a poor run since 2009 because falls have been short and sharp. April 2025 is the example: out near the low, back in {P(o2['worst_whipsaw']['spy_change_pct'])} higher.</li>"
                      f"<li>The daily version hangs on one day's timing: with every switch filled one session later the same rule made {P(fd['full_cagr_pct'])} a year and {P(fd['last2_total_return_pct'])} over the last two years, not {P(F(s2h)['cagr_pct'])} and {P(L2(s2h)['total_return_pct'])}. Read its figures as rough; the slow version moves far less often.</li>"
                      "<li>No taxes are counted. Every exit from a winning position would realise a gain.</li></ul>")},
        "s3_dual_momentum": {"lit": "dual-momentum",
            "verdict": (f"<b>The best numbers on the page, for the least work — and the least trustworthy.</b> Holding whichever of SPY and QQQ was stronger over the past year, or bonds when even that trailed Treasury bills, made {P(F(s3h)['cagr_pct'])} a year with a worst fall of {Fl(F(s3h)['max_dd_pct'])}, "
                        f"switching about {bv3['switches_per_year_full']:.1f} times a year. But it was in QQQ {bv3['share_of_sessions_full_pct'].get('QQQ', 0):.0f}% of the time, and QQQ was chosen today. The rule as Antonacci published it (US against overseas shares) made {P(F(s3c)['cagr_pct'])}."),
            "tools": ("<ul><li><b>Where it could help:</b> as a once-a-month check on what the core holds (SPY, QQQ, equal-weight, small caps) — not as the whole plan.</li>"
                      "<li><b>What the tool lacks for it:</b> a one-year return for each index (nothing longer than 63 sessions is computed today) and a Treasury-bill yardstick (the chart API carries the 3-month yield).</li>"
                      "<li><b>A conflict to settle first:</b> the tool's sector step pays more to oversold sectors. Momentum pays more to the strongest. Both cannot steer the same money.</li></ul>"),
            "wrong": (f"<ul><li><b>Timing luck:</b> the same rule read every 21 sessions, starting on a different day, made {P(min(luck))} to {P(max(luck))} a year, and {P(min(luck2))} to {P(max(luck2))} over the last two years.</li>"
                      f"<li>Its exit is slow: it waits for a whole year's return to fall behind cash. It fell {Fl(s3h['stress'].get('2020 crash'))} in the 2020 crash and {Fl(s3h['stress'].get('2022 bear'))} in the 2022 bear market.</li>"
                      "<li>“Bonds” was not a safe place in 2022, when shares and bonds fell together.</li><li>The published version rests on a repaired price series: the overseas fund's 2005 share split was unadjusted in our stored prices (see page specs).</li></ul>")},
        "s4_vol_sizing": {"lit": "volatility-targeted-sizing",
            "verdict": (f"<b>A sizing rule, not a structure — and it changes the ride more than the result.</b> Across the sector funds, equal risk made {P(F(s4r)['cagr_pct'])} a year against {P(F(s4d)['cagr_pct'])} for equal money, with a slightly smaller worst fall ({Fl(F(s4r)['max_dd_pct'])} against {Fl(F(s4d)['max_dd_pct'])}). "
                        f"Where it bites is single stocks: on today's leaders it would hold {lw['largest']['equal_risk_pct']:.0f}% in {esc(lw['largest']['sym'])} and {lw['smallest']['equal_risk_pct']:.0f}% in {esc(lw['smallest']['sym'])}, where equal money gives each {lw['largest']['equal_dollar_pct']:.0f}%. "
                        f"Sizing SPY to aim at a 15% yearly swing, never above 100%, made {P(F(s4v)['cagr_pct'])} a year with a worst fall of {Fl(F(s4v)['max_dd_pct'])} and {F(s4v)['avg_stock_pct']:.0f}% in stocks on average."),
            "tools": ("<ul><li><b>Where it goes:</b> the allocation tool's step 6, “the picks and their %”. Today a pick's weight is washed-out reading × regime fit × cheapness, with nothing for how jumpy the name is. Your own default in the PA5 brief — more weight to less risky names — is not in the code yet.</li>"
                      "<li><b>What it needs:</b> each name's recent daily swing. Daily bars for all served names are already on the chart API; nothing computes the swing today.</li>"
                      "<li><b>The portfolio-level cousin:</b> STRETCH's VIX reading (the VIX against its own 60-session normal).</li></ul>"),
            "wrong": (f"<ul><li>The leaders rows are hindsight, and there equal risk made LESS than equal money ({P(F(s4lr)['cagr_pct'])} against {P(F(s4ld)['cagr_pct'])} a year) because it held less of the jumpiest winners. Sizing by risk caps the pain and the windfall alike.</li>"
                      f"<li>The risk-level version cuts after the market turns jumpy, which is usually after the first leg down, and adds back late. It does not deliver a steady level either: capped at 100%, its own yearly swing came out at {b15['realised_yearly_vol_full_pct']}%, not 15%.</li></ul>")},
        "s5_level_scaling": {"lit": "level-based-scaling-in",
            "verdict": (f"<b>Buying at levels is cheap insurance — as long as the levels are near.</b> Across {r5['M1']['starts']} monthly starts since 2005, putting money into SPY in thirds at the 21-day and 50-day averages ended a year later {side(r5['M3']['mean_gap_pts'])} buying it all at once on average. "
                        f"Waiting with everything for the 50-day ended {side(r5['M5']['mean_gap_pts'])} it. Buying in thirds by the calendar was the worst of the lot, {side(r5['M2']['mean_gap_pts'])} it. Buying at once still won on average; waiting at a near level simply did not cost much, because the 21-day and 50-day come back often."),
            "tools": ("<ul><li><b>The levels:</b> the 21-day and 50-day averages need no review and can be tested. Reviewed lines are better levels but cannot be tested honestly: they were drawn this autumn with all of history in view.</li>"
                      "<li><b>A ladder from the lines (a proposal, no file defines it yet):</b> group a name's lines that sit within 1% into one shelf; tranche one, two and three are the first three shelves under price that price has already closed above; a daily close under the third cancels the plan.</li>"
                      "<li><b>Pace:</b> the Geiger says how hot the name already is; SG1's “cold for itself” says whether a low reading is low for that name. Lines say where, these say whether.</li>"
                      "<li><b>Fundamentals overrule:</b> a broken growth story cancels the plan whatever the chart says.</li></ul>"),
            "wrong": ("<ul><li>These are index funds. A single stock can run from a level and not return for a year; the deadline matters far more there, and that was not tested.</li>"
                      f"<li>On the comparison table this structure's row is the trend rule re-entered in thirds ({P(F(s5t)['cagr_pct'])} a year) against re-entered at once ({P(F(s5o)['cagr_pct'])}). After a real break the market tends to run, so thirds bought back less.</li>"
                      f"<li>Over the last two years thirds and at-once finished almost level ({P(L2(s5t)['total_return_pct'])} and {P(L2(s5o)['total_return_pct'])}). That gap is noise: it flips with small changes in how the rule is read.</li>"
                      "<li>Ten breakouts in two years is too few to judge buying the retest of a broken line.</li></ul>")},
        "s6_paid_to_wait": {"lit": ["paid-to-wait-options", "ibkr-options-mechanics"],
            "verdict": (f"<b>In plain words:</b> you sell someone the right to make you buy SPY at a price below today's (a cash-secured put — the cash to buy is set aside). You are paid a premium now. If SPY is above that price at the end of the month you keep the premium and repeat. If it is below, you buy at your price, however far it has fallen. "
                        f"A covered call is the mirror: you are paid to promise to sell shares you hold at a higher price. <b>The measured record is sobering:</b> Cboe's put-selling index made {P(F(put)['cagr_pct'])} a year since {put['full_from'][:4]} against SPY's {P(put['spy_same_window']['cagr_pct'])}, "
                        f"and still fell {Fl(F(put)['max_dd_pct'])} at its worst. Its covered-call index made {P(F(bxm)['cagr_pct'])} a year since 2005. You are paid to wait, and you give up most of every strong rally for it."),
            "tools": ("<ul><li><b>The strike</b> [the price you promise to buy at] is “the level you would buy”: a flat reviewed line is best, because it is the same price at expiry; a sloped line moves.</li>"
                      "<li><b>When premiums are rich:</b> STRETCH's VIX reading. Premiums are highest right after a VIX spike, which is also when a put is most likely to be put to you.</li>"
                      "<li><b>What the tool lacks:</b> any option data. It reads one market-wide put/call ratio and nothing on strikes, premiums or expiries.</li>"
                      "<li><b>At IBKR:</b> see the mechanics in the left column — they come from IBKR's and the OCC's own pages.</li></ul>"),
            "wrong": (f"<ul><li>Our own option figures are a model, and the model is too rich: {pts(gap6.get('PUT', {}).get('model_minus_measured_pts'), 1)} points a year above Cboe's real put index over the same dates. Only the rows marked measured should be read for level.</li>"
                      "<li>A resting buy order can be cancelled for nothing. A sold put cannot: if the price falls through your level you still buy at the strike.</li>"
                      f"<li>Size: one contract is 100 shares — about ${cs['SPY_one_contract_usd']:,.0f} for one SPY put today. There are no fractional contracts.</li></ul>")}}

    T["alternatives_intro"] = (
        "<p>You asked for more than your own idea handed back. Three alternatives came out of the tests themselves. Nine more come from the public record: three change your rules, three change what you hold, three use options. Each box gives the case for, the case against, and whether our own bars can test it; every line survived an independent fact-check. The first two are the ones this study's own tests bear out: the comparison at the top of the page is “invested until a sell signal” against “cash until a buy signal”, and the deadline on waiting is tested in structure 5.</p>"
        f"<ul><li><b>A floor under the ladder.</b> Keep everything you have built; let the ladder steer only the part above a fixed index floor. Tested above: {P(L2(f50)['total_return_pct'])} / {P(L2(f60)['total_return_pct'])} / {P(L2(f70)['total_return_pct'])} with a 50 / 60 / 70% floor, against {P(L2(lad)['total_return_pct'])} as it was.</li>"
        f"<li><b>A slow rule instead of a fast one.</b> The same trend rule asked on three closes in a row instead of every day left the market {o2s['count']} times instead of {o2['count']} and made {pts(F(s2slow)['cagr_pct'] - F(s2h)['cagr_pct'])} points a year more. Fewer decisions, better result.</li>"
        f"<li><b>A deadline on waiting.</b> Level-based buying with a 63-session deadline gave almost the same result as without one on index funds ({side(r5['M4']['mean_gap_pts'])} buying at once, against {side(r5['M3']['mean_gap_pts'])} it without the deadline), because the level nearly always came. On single stocks, where it may not, the deadline is the rule that stops a missed leg.</li></ul>"
        "<h3>Nine from the public record</h3>")
    T["alternatives_after"] = ""

    T["plug_in"] = (
        "<div class='two'><div class='pick'><h3>Core + satellite → between step 2 and step 3b</h3>"
        "<p>Today step 2 turns the heat into one number, the percent invested, and step 3b spreads that number across sectors. Core + satellite splits that one number in two before it is spread.</p>"
        "<ul><li><b>Where:</b> the line where the ladder's rung becomes the invested percent, and the function that multiplies every sector share by it. R4 has already written the split on its branch as a study (<span class='src'>coreSatellite() in scripts/r4-dials.mjs, drawn in study/r4/R4.html</span>); nothing live reads it.</li>"
        "<li><b>Reads:</b> the invested percent; REGIME for the satellite's share; STRETCH for whether new satellite buys are open; the knockout's kept names for the satellite list.</li>"
        "<li><b>Needs, none of which exist yet:</b> an index sleeve (the tool deliberately leaves index funds out today); a tag on each pick saying core or satellite; and the rule “a satellite sale goes to the index sleeve”, which needs holdings per sleeve — the IBKR state file carries two percentages only (invested, and the large-cap share), no holdings.</li>"
        "<li><b>Changes for you:</b> one new line on the page — how much is core, how much is satellite — and every sale shows where the money went.</li></ul></div>"
        "<div class='pick'><h3>Trend-filtered core → step 1 into step 2</h3>"
        "<p>Today cash is whatever the ladder leaves over. Under this structure cash has one door: the regime rule. The heat stops deciding how much is invested and starts deciding how fast the satellite moves.</p>"
        "<ul><li><b>Where:</b> R4's REGIME dial already holds the test (<span class='src'>structureOn() in scripts/r4-dials.mjs scores SPY and QQQ against the 200-day</span>). As a rule it sits on the core's index sleeve. The floor version is one line where the rung is read: invested = floor + (100 − floor) × rung ÷ 100 (<span class='src'>the rungs today are 100 / 80 / 50 / 30 / 15; the existing minInv setting is only the last of them, not a floor under the others</span>).</li>"
        "<li><b>Reads:</b> daily bars for SPY from the chart API; breadth from our served companies (R4 computes percent above the 200-day and 50-day daily).</li>"
        "<li><b>Needs:</b> four settings — which average, which fund, how many closes in a row, and how much of the core stays when the rule says out — and a live daily read of the 200-day on the page (today only the study script computes it).</li>"
        "<li><b>Changes for you:</b> the page says one of two things about the core — IN, or OUT since a date and why — instead of a percent that drifts with the heat.</li></ul></div></div>"
        "<p class='cap'>File and function names were read on the allocation tool's branches pa6-20261006 and r4-regime-stretch-20261006 on 7 Oct 2026. Nothing in this study touches the tool.</p>")
    T["decisions"] = (
        "<ol><li><b>Should money with no conviction trade on sit in an index core instead of cash?</b> Recommendation: yes. The quickest honest trial is a 60% index floor under the existing ladder, on a branch, shown beside today's answer.</li>"
        "<li><b>Should cash have one written reason — the slow trend rule — instead of the heat?</b> Recommendation: yes, the three-closes version, with the heat kept as the pace for adds and trims.</li>"
        "<li><b>Should the knockout's podium be stored every night?</b> Recommendation: yes. It is an additive table, and without it your real picks can never be tested the way the stand-in was here.</li></ol>")
    T["specs"] = (
        "<h3>How every number was made</h3><ul>"
        "<li><b>Prices:</b> the chart API's split-adjusted daily bars, 11 Sep 2003 to 5 Oct 2026. Tests run from 3 Jan 2005 so every rule has its look-back. “Last two years” is 3 Oct 2024 to 5 Oct 2026, the same 502 sessions HEAT1 and R4 replayed.</li>"
        "<li><b>Dividends:</b> added back on the ex-date [the first day a buyer no longer receives the dividend] from the Hub's dividends table, so every return is a total return.</li>"
        "<li><b>Cash:</b> earns the 3-month Treasury bill yield from the chart API, day by day.</li>"
        "<li><b>No hindsight in the rules:</b> a rule reads only what was known at a close and its orders fill at the next session's close.</li>"
        "<li><b>Costs:</b> 5 hundredths of a percent of every amount traded for funds, 10 for single stocks. No taxes, no leverage, no shorting. The one-off cost of the very first purchase is left out of every return.</li>"
        "<li><b>Cash by default</b> is the allocation tool's July heat ladder as HEAT1 replayed it (20 of 21 voters, default weights), applied to SPY with the rest in bills. It is the template's answer, not a record of your account.</li>"
        "<li><b>AI leaders</b> are the Hub's Magnificent 7 cohort plus the AI names the Lab has reviewed lines for (NVDA, MSFT, AAPL, GOOGL, AMZN, META, TSLA, AVGO, MU, VST, BE, NBIS, CRWV). The list was chosen today, so every row that uses it carries hindsight and says so.</li>"
        "<li><b>Structure 6:</b> the measured rows are Cboe's public daily index histories (PUT, BXM, BXY), measured with this study's own yardsticks. Our own option figures are Black-Scholes prices with the VIX as the volatility input; they are a model and run too rich against the measured indexes.</li>"
        "<li><b>A year</b> in every yearly rate is 252 trading sessions. By the calendar the 21 years are 21.75 against 21.71 counted this way, so each yearly rate here is about 0.02 points high at 10% a year. Total returns are exact.</li>"
        "<li><b>The first and last columns of any year-by-year figure are part years:</b> 2005 runs from 3 Jan, 2026 stops on 5 Oct.</li></ul>"
        "<h3>Faults found in the stored data, repaired on this study's own copy</h3>"
        "<p>The provider's bars and the Hub's dividend table were not touched. Each repair below is made by the download script on the study's copy and is proved by a number.</p>" + "{CORRECTIONS}" +
        "<h3>Found and left as it is</h3><ul>"
        "<li>SMH before December 2011 was a different vehicle (a HOLDRS trust) that passed its companies' dividends straight through. Besides being in old-share dollars (repaired above), the stored payout list looks incomplete for 2010–2011, so SMH's return before 2012 is probably a little understated. Nothing in the last two years is affected.</li>"
        "<li>RSP's close on 24 Aug 2015 (the flash-crash morning) is 12% down on a day SPY fell 4%, and reverses the next day. No structure here trades RSP, so it changes nothing.</li>"
        "<li>AGG has no dividend history in our table, so “bonds” here are IEF (7–10 year Treasuries).</li></ul>"
        "<h3>What was not done</h3><ul>"
        "<li>Reviewed lines were not back-tested: they were drawn this autumn with all history in view. The knockout was not back-tested: it keeps no history.</li>"
        "<li>No taxes, no intraday fills, no single-stock entry experiment, no option chains.</li>"
        "<li>No order was placed, no IBKR write was made, no alert was created, and nothing on the Hub or the allocation tool was changed.</li></ul>")
    return T
