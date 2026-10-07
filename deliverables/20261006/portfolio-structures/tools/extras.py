# PF1 · the structure-specific tables and pictures. Everything is read from the JSON each structure file wrote.
import json, os
import viz as V
from viz import esc, pct, pts, cell

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(HERE, "..", "data")
def J(name):
    p = os.path.join(DATA, name); return json.load(open(p)) if os.path.exists(p) else None
def tbl(head, rows, minw=760): return f'<div class="tw"><table style="min-width:{minw}px"><tr>{"".join(f"<th>{h}</th>" for h in head)}</tr>{"".join(rows)}</table></div>'
def tr(cells, cls=""): return f'<tr class="{cls}">' + "".join(c if c.startswith("<td") else f"<td>{c}</td>" for c in cells) + "</tr>"
def dmy(d):
    y, m, dd = d.split("-"); return f"{int(dd)} {['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][int(m) - 1]} {y}"
def var(sj, key): return next(v for v in sj["variants"] if v.get("key") == key)


def kpis(TEXT): return '<div class="kpi">' + "".join(f'<div><div class="k">{esc(k["k"])}</div><div class="v">{esc(k["v"])}</div><div class="n">{k["n"]}</div></div>' for k in TEXT["kpis"]) + "</div>"


def s1(S):
    e = S["s1_core_satellite"]["extras"]; sat = e["satellites"]["sat_sectors_to_core"]; rt = sat["round_trips"]; g = e["exit_destination_gap"]; sl = sat["slots_filled_pct_of_sessions"]
    a = tbl(["what happened to the satellite slots (sector stand-in)", "2005–2026", "last 2 years"], [
        tr(["Satellite positions bought and later sold", f'{rt["full"]["completed"]}', f'{rt["last2"]["completed"]}']),
        tr(["Typical holding time (the middle one)", f'{rt["full"]["median_hold_sessions"]:.0f} sessions', f'{rt["last2"]["median_hold_sessions"]:.0f} sessions']),
        tr(["Share of those positions that beat SPY over the same days", f'{rt["full"]["beat_spy_pct"]:.0f}%', f'{rt["last2"]["beat_spy_pct"]:.0f}%']),
        tr(["Share of days with all three slots filled / none filled", f'{sl["full"]["3"]:.0f}% / {sl["full"]["0"]:.0f}%', f'{sl["last2"]["3"]:.0f}% / {sl["last2"]["0"]:.0f}%']),
        tr(["<b>What sending a sold position back to the index, not to cash, was worth</b>", f'<b>{pts(g["full_cagr_pts"])} points a year</b>', f'<b>{pts(g["last2_total_return_pts"])} points in total</b>'], "hl")], 560)
    b = tbl(["same rule, other settings (sector stand-in)", "return a year 2005–2026", "worst fall", "last 2 years"], [
        tr([f'{x["budget_pct"]}% satellite · sold under its {esc(x["exit_average_plain"]).split(" (")[0]}', cell(x["full_cagr_pct"]), cell(x["full_max_dd_pct"], signed=False), cell(x["last2_total_return_pct"])], "hl" if x.get("is_headline") else "") for x in e["sensitivity"]], 560)
    behind = sum(1 for x in e["sensitivity"] if x["full_cagr_minus_spy_pts"] < 0)
    a += '<p class="cap">The last-two-years column counts positions opened and closed inside those two years.</p>'
    b += f'<p class="cap">In the 21-day rows only the selling line changes; a new pick is still judged on its 50-day average, as the rule is written. {behind} of the {len(e["sensitivity"])} settings finished behind buy-and-hold SPY over 2005–2026.</p>'
    return f'<div class="two"><div>{a}</div><div>{b}</div></div>'


def s2(S, S0):
    sj = S["s2_trend_core"]; e = sj["extras"]; spy = next(v for v in S0["variants"] if v["label"] == "Buy and hold SPY"); h = sj["variants"][0]
    sp = e["outs"][h["key"]]["spells"]; c = spy["curve_full"]
    chart = V.line_chart([{"name": "Buy and hold SPY", "color": V.BLUE, "dates": c["dates"], "values": c["equity"]},
                          {"name": "2 · Trend-filtered core", "color": V.AQUA, "dates": h["curve_full"]["dates"], "values": h["curve_full"]["equity"]}],
                         "When the trend rule stood aside (the shaded spans) — 2005 to 2026", h=360, log=True, shades=[(x["out"], x["back_in"], "") for x in sp],
                         note=f'{len(sp)} spells out of the market in {(len(c["dates"]) * 5) / 252:.0f} years. Thin slivers are the whipsaws: out and back within days.')
    rows = []
    for v in sj["variants"]:
        o = e["outs"].get(v["key"]);
        if not o: continue
        w, b = o.get("worst_whipsaw") or {}, o.get("biggest_save") or {}
        rows.append(tr([esc(v["label"].split(":")[0]), f'{o["count"]}', f'{o["saved"]} / {o["cost"]}', f'{o.get("round_trips_of_10_sessions_or_fewer", "—")}', (f'{o["sessions_out_pct"]}%' if o.get("sessions_out_pct") is not None else f'{o.get("last2_sessions_out_pct", "—")}% <span class=src>(2 years)</span>'),
                        (f'{dmy(b["out"])} → {dmy(b["back_in"])}: SPY {pct(b["spy_change_pct"])}' if b else "—"), (f'{dmy(w["out"])} → {dmy(w["back_in"])}: SPY {pct(w["spy_change_pct"])}' if w else "—")], "hl" if v is h else ""))
    t = tbl(["version", "times it left<br>the market", "saved money /<br>cost money", "back within<br>10 sessions", "share of days<br>in cash", "its best exit (SPY while it was out)", "its worst exit (SPY while it was out)"], rows, 1100)
    bt = e["breadth_today"]
    today = (f'<p class="cap">At the last close ({dmy(bt["date"])}): SPY sits {pct(bt["spy_distance_pct"])} from its 200-day average and {bt["sector_funds_above_200day"]} of {bt["sector_funds_counted"]} sector funds are above theirs '
             f'({bt["share_pct"]:.0f}% — breadth is weak). The rule needs BOTH to be bad, so it says: stay in.</p>')
    return chart + t + today


def s3(S):
    e = S["s3_dual_momentum"]["extras"]; bv = e["by_variant"]; tl = e["timing_luck"]; h = S["s3_dual_momentum"]["variants"][0]["key"]
    sw = bv[h]["last2_switches"]
    a = tbl(["the main version's switches, last two years", "decided", "from → to"], [tr([f"{k + 1}", dmy(x["decided"]), f'{esc(str(x["from"]))} → {esc(str(x["to"]))}']) for k, x in enumerate(sw)] or [tr(["none", "—", "—"])], 520)
    sh = bv[h]["share_of_sessions_full_pct"]
    hold = "<p class='cap'>Share of days in each fund, 2005–2026: " + " · ".join(f"{esc(k)} {v:.0f}%" for k, v in sh.items()) + f'. Switches: {bv[h]["switches_full"]} in the whole period, about {bv[h]["switches_per_year_full"]:.1f} a year.</p>'
    rows = [tr([f'look on the month\'s last day (the main version)', cell(tl["month_end_run"]["full_cagr_pct"]), cell(tl["month_end_run"]["full_max_dd_pct"], signed=False), cell(tl["month_end_run"]["last2_total_return_pct"])], "hl")]
    rows += [tr([f'look every 21 sessions, starting {x["offset_sessions"]} sessions later', cell(x["full_cagr_pct"]), cell(x["full_max_dd_pct"], signed=False), cell(x["last2_total_return_pct"])]) for x in tl["runs"]]
    b = tbl(["same rule, read on a different day", "return a year 2005–2026", "worst fall", "last 2 years"], rows, 620)
    return f'<div class="two"><div>{a}{hold}</div><div>{b}</div></div>'


def s4(S):
    e = S["s4_vol_sizing"]["extras"]; lw = sorted(e["baskets"]["leaders"]["latest_weights"], key=lambda x: -x["equal_risk_pct"])
    a = tbl(["today's leaders, sized by jumpiness", "how jumpy (yearly swing)", "equal risk", "equal money"], [tr([esc(x["sym"]), f'{x["vol_63d_yearly_pct"]:.0f}%', f'<b>{x["equal_risk_pct"]:.1f}%</b>', f'{x["equal_dollar_pct"]:.1f}%']) for x in lw], 520)
    v15 = e["spy_vol_target"]["15"]; hs = v15["held_share"]
    rows = [tr([f'{dmy(p["peak"])} → {dmy(p["trough"])} (SPY {pct(p["depth_pct"], signed=False)})', f'{p["held_at_peak_pct"]:.0f}% → {p["held_at_trough_pct"]:.0f}%', f'{p["average_held_share_pct"]:.0f}%',
                f'{dmy(p["first_cut_filled"])} — SPY already {pct(p["spy_already_down_at_first_cut_pct"], signed=False)} off its high' if p.get("first_cut_filled") else ("no cut before the low; first sale came after it, down to " + f'{p["lowest_share_through_rebound_pct"]:.0f}% on {dmy(p["lowest_share_date"])}' if p.get("sells_in_10_sessions_after_trough") else "never cut")]) for p in v15["pullbacks_last2"]]
    b = tbl(["SPY sized to aim at 15% yearly risk — the last two years' pullbacks", "share in SPY, top → low", "average share", "first cut"], rows, 620)
    cap = (f'<p class="cap">Over 2005–2026 the 15% version sat at 100% in SPY on {hs["full"]["at_100_pct_of_sessions"]:.0f}% of days, under 75% on {hs["full"]["under_75_pct_of_sessions"]:.0f}% and under 50% on {hs["full"]["under_50_pct_of_sessions"]:.0f}%. '
           f'It cuts AFTER the market has turned jumpy, which is usually after the first leg down.</p>')
    return f'<div class="two"><div>{a}</div><div>{b}{cap}</div></div>'


def s5(S):
    e = S["s5_level_scaling"]["extras"]; x = e["entry_experiment"]; lab = {m["key"]: m["label"] for m in x["methods"]}
    def rows(table, asset, hz):
        out = []
        for r in x["tables"][table]:
            if r["asset"] != asset or r["horizon"] != hz: continue
            lump = r["method"] == "M1"
            out.append(tr([esc(lab.get(r["method"], r["method"])), cell(r["mean_pct"]), "—" if lump else f'{r["above_lump_share_pct"]:.0f}% ahead · {r.get("tied_with_lump_share_pct") or 0:.0f}% level', "—" if lump else cell(r["mean_gap_pts"], dp=2).replace("%", " pts"),
                           f'{r["time_invested_pct"]:.0f}%', f'{r["missed_leg_pct"]:.1f}%', cell(r["worst_pct"], signed=False)], "base" if lump else ""))
        return out
    n = x["start_counts"].get("SPY H252", "")
    head = ["how the money went in", "result after 12 months<br>(average)", "against buying at once", "average gap", "share of the year<br>invested", "a third still in cash<br>6 months in", "worst case"]
    a = tbl([f"SPY · {n} monthly starts, 2005–2025"] + head[1:], rows("all", "SPY", 252), 980)
    b = tbl([f"QQQ · same test"] + head[1:], rows("all", "QQQ", 252), 980)
    l2 = x["last2_starts"]; head6 = [h.replace("12 months", "6 months") for h in head]
    c = tbl([f'SPY · the last two years only ({l2["count"]} starts, 6-month result)'] + head6[1:], rows("last2_h126", "SPY", 126), 980)
    k = e["breakout_retests"]["counts"]; hh = k.get("half_at_the_line_vs_all_complete", {})
    br = (f'<p class="cap">The ten breakouts of the last two years (first daily close above the 2-week pivot high): price came back to the line itself within 20 sessions in {k.get("came_back_to_the_line_itself_of_complete")} of the '
          f'{k.get("events_with_20_full_sessions")} that have 20 sessions of history, and closed back under it in {k.get("closed_back_under_the_line_of_complete")}. Buying half at the break and half at the line beat buying it all at the break in '
          f'{hh.get("better")} and lost in {hh.get("worse")}; on average all-at-the-break made {pct(k.get("mean_all_at_break_pct_complete"))} over the 20 sessions and half-at-the-line {pct(k.get("mean_half_at_the_line_pct_complete"))}. Nine events prove little.</p>')
    return a + b + c + br


def s6(S, S0):
    M = J("s6b_cboe_measured.json"); sj = S["s6_paid_to_wait"]; e = sj["extras"]; out = []
    if M:
        spy = next(v for v in S0["variants"] if v["label"] == "Buy and hold SPY"); put = var(M, "put_measured"); bxm = var(M, "bxm_measured")
        ch = M["chart_same_dates"]; a0 = ch["from"]             # all three on one date grid, each 1.00 on the first session all three have
        out.append(V.line_chart([{"name": "Buy and hold SPY", "color": V.BLUE, "dates": ch["dates"], "values": ch["SPY"]},
                                 {"name": "Selling puts (Cboe PUT)", "color": V.ORANGE, "dates": ch["dates"], "values": ch["PUT"]},
                                 {"name": "Covered calls (Cboe BXM)", "color": V.AQUA, "dates": ch["dates"], "values": ch["BXM"]}],
                                f"Measured, not modelled: Cboe's own put-selling and covered-call indexes against SPY, 1.00 put in on {dmy(a0)}", h=360, log=True,
                                note="These are the real strategies, run by rule on the S&P 500 every month and published daily by Cboe. Each step up the scale is a doubling."))
        rows = []
        for v in M["variants"]:
            f, l, s = v["full"], v["last2"], v["spy_same_window"]
            rows.append(tr([esc(v["label"].split(" — ")[0]) + f'<br><span class="src">{esc(v["label"].split(" — ")[1])}</span>', f'{dmy(v["full_from"])[-4:]}–2026', cell(f["cagr_pct"]), cell(s["cagr_pct"]), cell(f["max_dd_pct"], signed=False), cell(s["max_dd_pct"], signed=False),
                            cell(l["total_return_pct"]), cell(v["stress"].get("2008 crash")), cell(v["stress"].get("2020 crash")), cell(v["stress"].get("2022 bear"))], "hl" if v["key"] == "put_measured" else ""))
        out.append(tbl(["the measured record", "years", "return a year", "SPY, same years", "worst fall", "SPY, same years", "last 2 years", "2008 crash", "2020 crash", "2022 bear"], rows, 1100))
        g = M.get("model_gap") or []
        if g: out.append("<p class='cap'>How far our own model flatters: " + " ".join(f'modelled {esc(x["model"].replace("_", " "))} {pct(x["model_cagr_pct"])} a year against the measured {esc(x["measured"])} {pct(x["measured_cagr_pct"])} over the same dates ({pts(x["model_minus_measured_pts"], 2)} points too rich).' for x in g) + " The rows marked modelled in the table below carry that flattery; read them for shape, not for level.</p>")
    x = e["entry_experiment"]; f = x["full"]["methods"]; names = {"lump": "Buy it all at once", "wait_limit_50d": "Wait with one resting order at the 50-day average", "put_at_level": "Sell a monthly put at that level until it is put to you (modelled)"}
    def g(m, *ks):
        for k in ks:
            if k in m and m[k] is not None: return m[k]
        return None
    rows = []
    for k, m in f.items():
        lump = k == "lump"; ahead = g(m, "above_lump_share_pct", "ended_above_lump_pct"); gap = g(m, "mean_gap_pts", "mean_gap_to_lump_points"); wg = g(m, "worst_gap_pts", "worst_gap_to_lump_points")
        rows.append(tr([names.get(k, k), cell(g(m, "mean_pct", "mean_end_pct")), "—" if lump else f"{ahead:.0f}%", "—" if lump else cell(gap, dp=2).replace("%", " pts"), f'{g(m, "time_invested_pct", "mean_share_of_horizon_invested_pct"):.0f}%',
                        f'{g(m, "uninvested_end_pct", "never_invested_pct") or 0:.1f}%', "—" if wg is None else cell(wg, dp=1).replace("%", " pts")], "base" if lump else ""))
    out.append(tbl([f'paid to wait against just waiting · SPY, {x["full"]["starts"]} monthly starts, 12-month result', "average result", "ended ahead of<br>buying at once", "average gap", "share of the year<br>invested", "still not bought<br>after a year", "worst gap"], rows, 980))
    pl = f["put_at_level"]; cs = e["contract_size_today"]
    out.append(f'<p class="cap">The put seller collected {pct(g(pl, "mean_premium_collected_pct", "mean_premium_collected_pct_of_the_money"), signed=False)} of the money in premiums on average (modelled, so likely too rich), was put the shares within three months in {g(pl, "assigned_within_63_pct", "assigned_within_63_sessions_pct"):.0f}% of starts '
               f'and within a year in {g(pl, "assigned_within_252_pct", "assigned_within_252_sessions_pct"):.0f}%. One contract is 100 shares: at the last close that is about ${cs["SPY_one_contract_usd"]:,.0f} of cash set aside for one SPY put and ${cs["QQQ_one_contract_usd"]:,.0f} for one QQQ put.</p>')
    return "".join(out)


def s7_table(S0):
    C = J("s7_combined.json");
    if not C: return ""
    B = {v["label"]: v for v in S0["variants"]}; rows = []
    def row(name, v, cls=""):
        f, l = v.get("full"), v["last2"]
        return tr([name] + ([cell(f["cagr_pct"]), cell(f["max_dd_pct"], signed=False), f'{f["avg_stock_pct"]:.0f}%'] if f else ["—", "—", "—"]) + [cell(l["total_return_pct"]), cell(l["max_dd_pct"], signed=False), f'{l["avg_stock_pct"]:.0f}%'] +
                  [cell((v.get("stress") or {}).get(k)) for k in ["2008 crash", "2020 crash", "2022 bear"]], cls)
    for v in C["variants"]: rows.append(row(esc(v["label"]), v, "hl" if v["key"] == "core_sat_filtered" else ""))
    rows += [row("Cash by default — the July heat ladder, as it was", B["Cash by default — the July heat ladder"], "base"), row("Buy and hold SPY", B["Buy and hold SPY"], "base"), row("60 / 40", B["60/40 (SPY / 7-10y Treasuries)"], "base")]
    return tbl(["the two together, and a floor under the ladder", "return a year<br>2005–2026", "worst fall", "in stocks", "last 2 years", "last 2 years<br>worst fall", "last 2 years<br>in stocks", "2008 crash", "2020 crash", "2022 bear"], rows, 1100)


def checks(S0, S, LIT):
    out = ["<h3>Checks run on this study</h3><ul>"]
    yc = S0["spy_year_check"]; out.append("<li>SPY's calendar-year total return built from our bars plus our dividend table, against the published figure: " + " · ".join(f'{r["year"]} {pct(r["ours"])} vs {pct(r["published"])}' for r in yc) + f'. Largest gap {max(abs(r["gap"]) for r in yc):.1f} points.</li>')
    Vf = J("verification.json")
    if Vf:
        out.append(f'<li><b>Independent re-builds, {esc(Vf["earlier"]["when"])}:</b> {esc(Vf["earlier"]["how"])}<ul>' + "".join(f'<li>{esc(v["name"])}: {esc(v["verdict"])}</li>' for v in Vf["earlier"]["structures"]) + f'<li>The shared library: {esc(Vf["earlier"]["lib"])}</li></ul></li>')
        out.append(f'<li><b>After the data repairs, {esc(Vf["rerun"]["when"])}:</b> {esc(Vf["rerun"]["what"])}</li>')
    Vi = J("verify_independent.json")
    if Vi:
        n = len(Vi["comparisons"]); bad = Vi["outside_tolerance"]
        out.append(f'<li><b>A second from-scratch re-computation on the repaired data</b> (tools/verify_independent.py — its own accounting, none of the study\'s simulator): buy-and-hold SPY and QQQ, the three trend rules, dual momentum, the ladder and the ladder with a 60% floor. '
                   f'{n} figures compared with the files, {"every one agrees to the printed digit" if bad == 0 else str(bad) + " OUTSIDE TOLERANCE"}.</li>')
    M = J("s6b_cboe_measured.json")
    if M:
        p = var(M, "put_measured")["years"]; out.append("<li>Cboe PUT index calendar years as read from Cboe's file: " + " · ".join(f"{y} {pct(p[y])}" for y in ["2008", "2009", "2018", "2020", "2021", "2022", "2023"] if y in p) + ".</li>")
    C = J("s7_combined.json")
    if C: out.append(f'<li>A second, from-scratch core + satellite (in s7_combined.py) against structure 1\'s headline: {"agrees on every number" if C["extras"]["check_against_structure_1"]["agree"] else "DISAGREES"}.</li>')
    lit = LIT.get("literature", []); fs = [f for x in lit for f in ((x.get("check") or {}).get("findings") or [])]
    nv = sum(1 for f in fs if f["status"] == "verified"); nc = sum(1 for f in fs if f["status"] == "corrected"); nm = sum(len((x.get("check") or {}).get("missing") or []) for x in lit)
    if fs: out.append(f"<li>Public literature: a separate fact-checking agent re-opened the researchers' sources and returned {len(fs)} findings — {nv} confirmed as written and {nc} corrected to what the source actually says. Only those {nv + nc} are printed, in their corrected wording. "
                      f"The {nm} points it could not confirm are not stated as findings; they are listed, as open points, at the end of each “more from the record” fold (for the nine alternatives, under “what the fact-check could not confirm”).</li>")
    if Vf and Vf.get("literature_spot_check"):
        sc = Vf["literature_spot_check"]
        out.append(f'<li><b>Literature spot check, {esc(sc["when"])}:</b> {esc(sc["what"])}.<ul>' + "".join(f'<li>{esc(c["claim"])} — {esc(c["source"])}: {esc(c["result"])}.</li>' for c in sc["checks"]) + "</ul></li>")
    out.append("</ul>"); return "".join(out)


def corrections():
    """The repairs made to the study's own copy of the data, straight from data/corrections.json."""
    C = J("corrections.json") or []
    return "<ul>" + "".join(f'<li><b>{esc(c["symbol"])}:</b> {esc(c["what"])}. Evidence: {esc(c["evidence"])}. Repair: {esc(c["repair"])}.</li>' for c in C) + "</ul>"
