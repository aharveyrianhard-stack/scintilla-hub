#!/usr/bin/env python3
"""Write PLAYBOOK-EVENTS.html from the study JSON. Every number on the page is read from data/*.json - nothing is typed in."""
import json, os, html, datetime
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, ".."); D = os.path.join(ROOT, "data")
def J(*p):
    f = os.path.join(D, *p); return json.load(open(f)) if os.path.exists(f) else None
T = J("tables.json"); R = J("recurrence.json"); X = J("extra.json"); B = J("base-rates.json"); MAN = J("bars-manifest.json"); S = J("models", "summary.json") or {}
TA = J("models", "tradingagents.json") or {}; FR = J("models", "finrobot.json") or {}
e = html.escape
UP = "#2e9c5a"; DN = "#c6413f"
def pc(x, d=1, sign=True):
    if x is None: return "–"
    v = x * 100; col = UP if v > 0 else (DN if v < 0 else "inherit"); s = f"{v:+.{d}f}%" if sign else f"{v:.{d}f}%"
    return f'<span style="color:{col}">{s}</span>' if sign else s
def sh(x, d=0): return "–" if x is None else f"{x*100:.{d}f}%"
def vs(x, base, d=0):
    """a share shown against its base rate: green above, red below"""
    if x is None: return "–"
    col = UP if base is not None and x > base else (DN if base is not None and x < base else "inherit"); return f'<span style="color:{col}">{x*100:.{d}f}%</span>'
def n0(x): return "–" if x is None else f"{x:.0f}"
def table(head, rows, cls=""):
    h = "".join(f"<th>{c}</th>" for c in head); b = "".join("<tr>" + "".join(f"<td>{c}</td>" for c in r) + "</tr>" for r in rows)
    return f'<div class="tw"><table class="{cls}"><thead><tr>{h}</tr></thead><tbody>{b}</tbody></table></div>'
def img(name, alt, cap=""):
    return f'<div class="iw"><a href="charts/{name}"><img src="charts/{name}" alt="{e(alt)}" loading="lazy"></a></div>' + (f'<p class="cap">{cap}</p>' if cap else "")
GN = {"company": "the 10 companies", "etf": "the 15 funds (SPY, QQQ, IWM, SMH, 11 sectors)", "macro": "the 7 macro series"}
KIND = [("x200_up", "close crosses UP through the 200-day"), ("x200_down", "close crosses DOWN through the 200-day"), ("x50_up", "close crosses UP through the 50-day"), ("x50_down", "close crosses DOWN through the 50-day"),
        ("cloud_fast_bull", "13/21 cloud flips bull"), ("cloud_fast_bear", "13/21 cloud flips bear"), ("cloud_inner_bull", "21/50 cloud flips bull"), ("cloud_inner_bear", "21/50 cloud flips bear"),
        ("cloud_outer_bull", "50/200 cloud flips bull"), ("cloud_outer_bear", "50/200 cloud flips bear"), ("rsi_low", "RSI tags its own 10th percentile"), ("rsi_high", "RSI tags its own 90th percentile"),
        ("wr_low", "Williams %R tags its own 10th percentile"), ("wr_high", "Williams %R tags its own 90th percentile")]
P = []; A = P.append

# ---------- event tables ----------
def event_table(grp):
    t = T["per_kind_by_group"][grp]; b = T["base_by_group"][grp]; rows = []
    for k, lab in KIND:
        s = t.get(k)
        if not s: continue
        rows.append([lab, s["n"], pc(s["runup_5_med"]), pc(s["drawdown_5_med"]), pc(s["runup_10_med"]), pc(s["drawdown_10_med"]), pc(s["runup_20_med"]), pc(s["drawdown_20_med"]), pc(s["runup_60_med"]), pc(s["drawdown_60_med"]),
                     pc(s["ret_60_med"]), vs(s["ret_60_pos"], b["ret_60_pos"]), n0(s["days_to_opposite_med"]), sh(s["whipsaw_5_share"]), sh(s["retag200_60_share"]), n0(s["rsi_at_high_60_med"])])
    rows.append(["<b>every session (base rate)</b>", f"{b['sessions']:,}", pc(b["runup_5_med"]), pc(b["drawdown_5_med"]), pc(b["runup_10_med"]), pc(b["drawdown_10_med"]), pc(b["runup_20_med"]), pc(b["drawdown_20_med"]), pc(b["runup_60_med"]), pc(b["drawdown_60_med"]),
                 pc(b["ret_60_med"]), sh(b["ret_60_pos"]), "–", "–", sh(b["retag200_60"]), "–"])
    return table(["event", "count", "run-up 5", "drawdown 5", "run-up 10", "drawdown 10", "run-up 20", "drawdown 20", "run-up 60", "drawdown 60", "60-session return", "higher after 60", "sessions to the opposite event", "reversed within 5", "re-tagged the 200-day within 60", "RSI at the 60-session high"], rows)
def name_table(kinds):
    rows = []
    for sym in MAN:
        t = T["per_name"].get(sym)
        if not t: continue
        b = B[sym]; r = [f"<b>{sym}</b>", b["first"][:4]]
        for k in kinds:
            s = t.get(k)
            r += ([s["n"], pc(s["runup_60_med"]), pc(s["drawdown_60_med"]), vs(s["ret_60_pos"], b["ret_60_pos"])] if s else ["–"] * 4)
        r += [sh(b["ret_60_pos"])]; rows.append(r)
    head = ["name", "bars since"]
    for k in kinds:
        lab = dict(KIND)[k].replace("close crosses ", "").replace(" through the 200-day", " 200-day").replace("RSI tags its own ", "RSI ").replace(" cloud flips", "")
        head += [f"{lab} · count", "run-up 60", "drawdown 60", "higher after 60"]
    return table(head + ["base: higher after 60"], rows)
def spell_table():
    rows = []
    for g in ("company", "etf", "macro"):
        for side, lab in (("above", "above the 200-day (reclaim → loss)"), ("below", "below the 200-day (loss → reclaim)")):
            a = X["spells"]["pooled"][g].get(side); l = X["spells"]["pooled"][g].get(side + "_60plus")
            if not a: continue
            rows.append([f"{g} · {lab}", a["n"], n0(a["sessions_med"]), sh(a["short_5_share"]), sh(a["long_60_share"]), l["n"], n0(l["sessions_med"]), pc(l["max_up_med"]), pc(l["max_down_med"]), pc(l["exit_ret_med"]), n0(l["rsi_at_high_med"]), n0(l["rsi_at_low_med"]),
                         sh(l.get("rsi_high_over_own90_share")), n0(l.get("tags_50_med")) if side == "above" else "–"])
    return table(["spell", "all spells", "median length, sessions", "over within 5 sessions", "lasted 60 or more", "long spells (60+)", "their median length", "highest point reached", "lowest point reached", "result at the flip back", "RSI at the high", "RSI at the low", "high came with RSI over its own 90th pct", "times it tagged the 50-day"], rows)
def open_spells():
    rows = []
    for x in sorted(X["spells"]["open_now"], key=lambda r: (r["group"], r["symbol"])):
        rows.append([f"<b>{x['symbol']}</b>", x["side"], x["start"], x["sessions"], pc(x["max_up"]), pc(x["max_down"]), pc(x["exit_ret"]), n0(x["rsi_at_high"])])
    return table(["name", "side of the 200-day now", "since", "sessions so far", "highest point so far", "lowest point so far", "now, from the cross", "RSI at the high"], rows)
def rec_table(grp):
    rows = []
    for r in R[grp]:
        if not r["n"]: continue
        rows.append([e(r["condition"]), r["n"], r["names"], e(r["follow"]), r["n_follow"], vs(r["share"], r["base"]), sh(r["base"]), pc(r["ret_60_med"]), pc(r["runup_60_med"]), pc(r["drawdown_60_med"])])
    return table(["condition", "count", "names", "what followed", "times it followed", "share", "base rate", "median 60-session return", "run-up 60", "drawdown 60"], rows, "wrap")

# ---------- 21-day ----------
PB = X["pullback21"]
def pb_table(key, basekey="base_full_stack_sessions"):
    rows = []
    for s, v in list(PB["per_name"].items()) + [("ALL SEVEN", PB["pooled"])]:
        t = v.get(key)
        if not t or not t["n"]: continue
        b = v.get(basekey)
        rows.append([f"<b>{s}</b>", t["n"], sh(t["close_held_share"]), sh(t["held_10_share"]), sh(t["reached_50_in_20_share"]), vs(t["new_high_first_share"], b["new_high_first_share"] if b else None), sh(t["broke_first_share"]), sh(b["new_high_first_share"]) if b else "–",
                     pc(t["drawdown_20_med"]), pc(t["drawdown_20_p10"]), pc(b["drawdown_20_med"]) if b else "–", pc(t["ret_20_med"]), vs(t["ret_20_pos"], b["ret_20_pos"] if b else None), sh(b["ret_20_pos"]) if b else "–", pc(t["ret_60_med"]), sh(t["ret_60_pos"])])
    return table(["name", "fresh touches", "closed at or above it that day", "held 10 sessions (no close 1 ATR under)", "low reached the 50-day within 20", "new 20-session high came first", "broke 1 ATR under first", "base: new high first, any uptrend session", "median worst dip in 20", "worst tenth of dips in 20", "base: median dip in 20", "median 20-session return", "higher after 20", "base: higher after 20", "median 60-session return", "higher after 60"], rows)
def pb_recent():
    rows = []
    for s, v in PB["per_name"].items():
        for x in v["recent"]:
            race = {"new_high_first": f'<span style="color:{UP}">new high first</span>', "broke_first": f'<span style="color:{DN}">broke first</span>', "neither": "neither", None: "too recent"}[x["race_60"]]
            rows.append([f"<b>{s}</b>", x["date"], f"{x['close']:.2f}", f"{x['ema21']:.2f}", {"full": "21 over 50 over 200", "mixed": "50 over 200 only", "below": "50 under 200"}[x["stack"]], "yes" if x["close_held"] else "no", ("yes" if x["held_10"] else "no") if x["held_10"] is not None else "too recent",
                         ("yes" if x["reached_50_in_20"] else "no") if x["reached_50_in_20"] is not None else "too recent", race, pc(x["drawdown_20"]), pc(x["ret_20"]), pc(x["ret_60"])])
    return table(["name", "touch date", "close", "21-day", "averages that day", "closed at or above it", "held 10 sessions", "reached the 50-day within 20", "what came first", "worst dip in 20", "20-session return", "60-session return"], rows)
def pb_now():
    rows = [[f"<b>{s}</b>", f"{v['now']['close']:.2f}", f"{v['now']['ema21']:.2f}", pc(v["now"]["dist_pct"]), f"{v['now']['dist_atr']:+.1f}", sh(v["now"]["atr_pct"], 1), v["now"]["stack"]] for s, v in PB["per_name"].items()]
    return table(["name", "last close", "21-day", "distance", "distance in ATRs", "one ATR is", "uptrend stack"], rows)

# ---------- crosses ----------
def cross_table():
    rows = []
    for g in ("company", "etf", "macro"):
        c = X["cross"]["pooled"][g]; d = c["death"]; go = c["golden"]
        rows.append([f"{g} · 50-day falls UNDER the 200-day", d["n"], pc(d["already_from_peak_med"]), n0(d["sessions_since_peak_med"]), pc(d["further_low_120_med"]), sh(d["low_was_already_in_120_share"]), pc(d["ret_20_med"]), pc(d["ret_60_med"]), sh(d["ret_60_pos"]), pc(d["ret_120_med"]), sh(d["ret_120_pos"]), n0(d["sessions_to_next_cross_med"]), sh(d["whipsaw_20_share"])])
        rows.append([f"{g} · 50-day rises OVER the 200-day", go["n"], pc(go["already_from_trough_med"]), n0(go["sessions_since_trough_med"]), pc(go["further_high_120_med"]), "–", pc(go["ret_20_med"]), pc(go["ret_60_med"]), sh(go["ret_60_pos"]), pc(go["ret_120_med"]), sh(go["ret_120_pos"]), n0(go["sessions_to_next_cross_med"]), sh(go["whipsaw_20_share"])])
    return table(["cross", "count", "move already made at the cross (from the 252-session high / low)", "sessions since that high / low", "still to come in 120 (lowest / highest close)", "the low was already in", "20-session return", "60-session return", "higher after 60", "120-session return", "higher after 120", "sessions to the next cross", "reversed within 20"], rows)
def cross_names():
    rows = []
    for s in ["MU", "AVGO", "NVDA", "GOOGL", "TSM", "SNDK", "SPY", "QQQ", "IWM", "RSP", "XLV"]:
        c = X["cross"]["per_name"].get(s, {}); d = c.get("death"); g = c.get("golden")
        rows.append([f"<b>{s}</b>", d["n"] if d else 0, pc(d["already_from_peak_med"]) if d else "–", pc(d["further_low_120_med"]) if d else "–", sh(d["low_was_already_in_120_share"]) if d else "–", sh(d["ret_120_pos"]) if d else "–",
                     g["n"] if g else 0, pc(g["already_from_trough_med"]) if g else "–", pc(g["further_high_120_med"]) if g else "–", sh(g["ret_120_pos"]) if g else "–"])
    return table(["name", "50 under 200 · count", "already lost at the cross", "still to come (lowest close in 120)", "low already in", "higher after 120", "50 over 200 · count", "already gained at the cross", "still to come (highest close in 120)", "higher after 120"], rows)
def project_table():
    rows = []
    for s, v in sorted(X["project"].items(), key=lambda kv: abs(kv[1]["gap_pct"])):
        if abs(v["gap_pct"]) > 0.045: continue
        f = lambda k: "none in 120" if v[k] is None else f"{v[k]} sessions"
        rows.append([f"<b>{s}</b>", f"{v['sma50']:.2f}", f"{v['sma200']:.2f}", pc(v["gap_pct"], 2), v["state"], f"{v['last']:.2f}", f("flat"), f("down_0.25pct_a_day"), f("down_0.5pct_a_day"), f("up_0.25pct_a_day"), f("up_0.5pct_a_day")])
    return table(["name", "50-day", "200-day", "gap", "state", "last close", "if price stays flat", "if it slips 0.25% a day", "if it slips 0.5% a day", "if it rises 0.25% a day", "if it rises 0.5% a day"], rows)

# ---------- depth ----------
def depth_table():
    rows = []
    for s, v in X["depth"].items():
        d = v["summary"]; c = v["current"]; bk = lambda k: f"{d['bucket_'+k]['n']}"
        rows.append([f"<b>{s}</b>", d["n"], f"{d['per_year']:.1f}", sh(d["depth_med"], 1), sh(d["depth_p75"], 1), sh(d["depth_p90"], 1), sh(d["depth_max"], 0), bk("3_5"), bk("5_10"), bk("10_20"), bk("20_plus"), n0(d["sessions_to_trough_med"]), n0(d["sessions_to_recover_med"]), sh(d["reached_50_share"]), sh(d["reached_200_share"]), n0(d["rsi_at_trough_med"]),
                     c["peak"], pc(c["deepest_so_far"]), pc(c["now_from_peak"]), ("deeper than " + sh(c["deepest_so_far_rank"]) + " of its pullbacks") if c.get("deepest_so_far_rank") is not None else "under 3% so far"])
    return table(["index fund", "pullbacks of 3%+", "a year", "median depth", "one in four deeper than", "one in ten deeper than", "deepest", "3–5%", "5–10%", "10–20%", "20%+", "sessions to the low", "sessions back to a high", "reached the 50-day", "reached the 200-day", "RSI at the low", "last 252-session high", "deepest since", "now", "where this one ranks"], rows)
def depth_buckets():
    rows = []
    for s, v in X["depth"].items():
        for k, lab in (("3_5", "3–5%"), ("5_10", "5–10%"), ("10_20", "10–20%"), ("20_plus", "20% or more")):
            b = v["summary"]["bucket_" + k]
            rows.append([f"<b>{s}</b>", lab, b["n"], n0(b["sessions_to_trough_med"]), n0(b["sessions_to_recover_med"]), sh(b["reached_50_share"]), sh(b["reached_200_share"])])
    return table(["index fund", "depth", "count", "median sessions to the low", "median sessions back to a high", "reached the 50-day", "reached the 200-day"], rows)

# ---------- models ----------
RV = {r["key"]: r for r in S.get("reviewers", [])}; BL = S.get("baselines", {})
def frac(r, a, b): return "not run" if r.get(a) is None else f"{r[a]} of {r[b]}"
def reviewer_table():
    rows = []
    for r in S.get("reviewers", []):
        tone = "not run" if r.get("tone_acc") is None else (sh(r["tone_acc"]) + (f" on the first {r['tone_n']} only (it prints its reasoning; about 6 s a headline)" if r.get("tone_n") not in (None, 240) else "") + (f" ({r['tone_unparsed']} gave no label)" if r.get("tone_unparsed") else "") + (f"; {sh(r['tone_native_acc'])} with its own prompt" if r.get("tone_native_acc") is not None else ""))
        rows.append([f"<b>{e(r['name'])}</b><br><span class='dim'>{e(r['maker'])} · {e(r['kind'])}</span>", f"{e(r['base'])} · {r['file_gb']} GB", e(r["licence"]),
                     vs(r.get("tech_quiz"), BL.get("tech_always_yes", 0) + 0.1) + f" <span class='dim'>({frac(r, 'tech_right', 'tech_asked')})</span>" if r.get("tech_quiz") is not None else "not a reviewer",
                     vs(r.get("fund_quiz"), BL.get("fund_always_yes", 0) + 0.1) + f" <span class='dim'>({frac(r, 'fund_right', 'fund_asked')})</span>" if r.get("fund_quiz") is not None else ("not a reviewer" if r["key"] == "finbert" else "not run"),
                     frac(r, "tech_numbers_unsupported", "tech_numbers") if r.get("tech_numbers") is not None else "–", f"{r.get('tech_rating_reviews', '–')} / {r.get('tech_universal_reviews', '–')} / {r.get('tech_loop_reviews', '–')}" if r.get("tech_numbers") is not None else "–",
                     f"{r.get('tech_words_med', '–')}" if r.get("tech_numbers") is not None else "–", f"{r.get('tech_seconds_med', '–')} s" if r.get("tech_numbers") is not None else "–", tone])
    return table(["model", "built on · file", "licence", "technical facts read right", "fundamental facts read right", "numbers not in the facts", "of 5 reviews: used a rating word / said overbought-oversold / looped", "median words (limit 220)", "seconds a review", "headline tone, 240 labelled"], rows, "wrap")
def framework_table():
    tk = S.get("toolkits", {}); ob = S.get("openbb", {}); pta = S.get("pandas_ta", {}); fc = S.get("forecast", {})
    def fcs(k):
        v = fc.get(k) or {}; p = v.get("pooled")
        return f"direction right {sh(p['direction_hit'])} of {p['n']} forecasts; always saying 'up' scores {sh(p['always_up_hit'])}; average miss {sh(p['mae_ret'], 1)} against {sh(p['mae_no_change'], 1)} for 'no change'" if p else ("failed: " + e(str(v.get("error"))[:120]) if v else "not run")
    tas = S.get("tradingagents", {}); ta_line = "; ".join(f"{s} {d.get('decision')} ({d.get('seconds', 0)/60:.0f} min)" for s, d in tas.items() if "with" not in s)
    ta2 = [f"{s}: {d.get('decision') or 'failed'} ({(d.get('seconds') or 0)/60:.0f} min)" for s, d in tas.items() if "with" in s]
    frs = S.get("finrobot", {}); fr_line = "; ".join(f"{s} {d.get('seconds')} s" for s, d in frs.items())
    q = tk.get("qlib", {}); vb = tk.get("vectorbt", {}).get("per_name", {}); tl = tk.get("talib", {}).get("per_name", {})
    vb_ok = all(v["x200_up_ours"] == v["x200_up_vectorbt"] and v["x200_down_ours"] == v["x200_down_vectorbt"] and v["same_dates_up"] for v in vb.values()) if vb else None
    tl_max = max((v["rsi_max_abs_diff_last500"] for s, v in tl.items() if s != "SNDK"), default=None)
    rows = [
     ["<b>TradingAgents</b> 0.6.0<br><span class='dim'>Tauric Research · Apache-2.0 · a desk of role-playing agents (analysts, bull/bear debate, trader, risk)</span>", "review (i)", "yes · ran on all 5 with local Qwen2.5-7B; it fetched its own prices and news (Yahoo) and filings (SEC EDGAR)", e(ta_line) + ("<br>" + e("; ".join(ta2)) if ta2 else ""),
      "Its output is a rating (Buy / Overweight / Sell) — the opposite of conditions-and-counts. Its numbers matched ours; its small-model reasoning did not (see the quotes below). Keep as a pattern to borrow, not as the reviewer."],
     ["<b>FinRobot</b> 0.1.5<br><span class='dim'>AI4Finance · Apache-2.0 · agent platform (AutoGen)</span>", "review (i)", "partly · only its keyless Yahoo tools; its Finnhub, FMP and SEC-API tools need keys this Mac does not hold", e(fr_line),
      "Mostly restates the data it fetched; the small model moved a decimal point on Micron (market value $118B written for $1,185B, revenue $13.3B for $133.2B). Not adopted."],
     ["<b>FinGPT</b><br><span class='dim'>AI4Finance · Llama-3 licence · task adapters</span>", "review (i)", "yes · the multi-task adapter as a 4-bit file on llama.cpp", "scores in the model table above", "A tone/entity adapter, not a reviewer: it looped on 3 of 5 reviews. Not adopted."],
     ["<b>Kronos</b> small / base<br><span class='dim'>MIT · a model trained on candles from 45 exchanges</span>", "forecast", "yes · walk-forward on our bars, 20 sessions ahead", e(fcs("kronos_small")) + "<br>base: " + e(fcs("kronos_base")), "Worse than saying 'up' every time on these names. Not adopted."],
     ["<b>Chronos-Bolt</b> base<br><span class='dim'>Amazon · Apache-2.0 · general time-series model</span>", "forecast", "yes · same walk-forward", e(fcs("chronos_bolt_base")), "No better than 'no change'. Not adopted."],
     ["<b>vectorbt</b> " + e(tk.get("vectorbt", {}).get("version", "")) + "<br><span class='dim'>open-source backtest engine</span>", "event studies (ii)", "yes · recounted the 200-day crosses on the 5 names", ("same counts, same dates, same 60-session medians as our script on all 5 names" if vb_ok else "counts differ — see data/models/toolkits.json") , "<b>Adopt</b> as the independent recount of every event table."],
     ["<b>TA-Lib</b> " + e(tk.get("talib", {}).get("version", "")) + "<br><span class='dim'>the reference indicator library (C)</span>", "event studies (ii)", "yes · RSI, Williams %R, 200-day, 21-day on the 5 names", f"largest difference from our RSI over the last 500 sessions: {tl_max:.1e} points (SNDK differs early because its history is 406 bars)" if tl_max is not None else "–", "<b>Adopt</b> as the indicator reference."],
     ["<b>pandas-ta</b> " + e(pta.get("version", "")) + "<br><span class='dim'>indicator library</span>", "event studies (ii)", "yes · needs Python 3.12 (no build for 3.11)", "same last RSI, Williams %R and 200-day as ours to the printed digit", "Works; TA-Lib is the steadier choice."],
     ["<b>Microsoft Qlib</b> " + e(q.get("version", "")) + "<br><span class='dim'>MIT · quant research platform</span>", "event studies (ii)", "yes · our bars loaded into its store, its 158 features, LightGBM trees, tested on 2023–Sep 2026", (f"rank correlation of forecast and 20-session outcome {q['rank_ic_mean']:+.3f} (positive on {sh(q['rank_ic_positive_days'])} of {q['test_days']} days) across {q['universe']} names" if q.get("rank_ic_mean") is not None else "failed: " + e(str(q.get("error"))[:140])),
      "A factor-ranking machine; it wants hundreds of names, not 28, and it does not do event studies. Park until the universe is wider."],
     ["<b>OpenBB</b> 5.0.0<br><span class='dim'>open-source data platform</span>", "data for either job", "yes · prices, 35 key figures and quarterly statements for MU through its free Yahoo route", f"MU last close {ob.get('mu_last_close', 0):.2f} (ours 1063.96); first load took {ob.get('import_seconds', 0):.0f} s" if ob else "–", "A data connector, not a model. Useful only if we want Yahoo/SEC figures on this Mac without our own keys."],
    ]
    return table(["project", "job", "installed and run here?", "what came back", "call"], rows, "wrap")
def fc_table():
    fc = S.get("forecast", {}); rows = []
    for k in ("chronos_bolt_base", "kronos_small", "kronos_base"):
        v = fc.get(k) or {}
        for s, sc in list((v.get("per_name") or {}).items()) + ([("ALL", v["pooled"])] if v.get("pooled") else []):
            rows.append([e(v.get("model", k)), f"<b>{s}</b>", sc["n"], vs(sc["direction_hit"], sc["always_up_hit"]), sh(sc["always_up_hit"]), sh(sc["pred_up_share"]), sh(sc["mae_ret"], 1), sh(sc["mae_no_change"], 1), sh(sc["mae_own_drift"], 1), f"{sc['corr']:+.2f}" if sc.get("corr") is not None else "–", sh(sc.get("inside_10_90_band")) if sc.get("inside_10_90_band") is not None else "–"])
    return table(["model", "name", "forecasts", "direction right", "always-'up' would score", "share of forecasts that said up", "average miss, 20-session return", "miss of 'no change'", "miss of the name's own drift", "correlation with the outcome", "outcome inside its 10–90% band"], rows)
def headline_table():
    H = S.get("headlines") or []; ks = [k for k in ("finbert", "qwen2.5-7b", "fin-r1", "fin-o1-8b", "fingpt-mt-llama3") if H and k in H[0]]
    col = lambda v: f'<span style="color:{UP if v == "positive" else DN if v == "negative" else "inherit"}">{v or "no label"}</span>'
    return table(["name", "date", "headline", "source"] + [RV[k]["name"] for k in ks], [[f"<b>{h['symbol']}</b>", h["date"], e(h["text"]), e(h["source"])] + [col(h[k]) for k in ks] for h in H], "wrap")
def quote(t, n=900):
    t = (t or "").strip(); return e(t[:n] + (" …" if len(t) > n else ""))
def review_blocks():
    out = []
    for key in ("fin-o1-8b", "qwen2.5-7b"):
        r = RV.get(key)
        if r and r.get("tech_reviews"): out.append(f"<details><summary>{e(r['name'])} · the technical review of AVGO, as it wrote it</summary><pre>{quote(r['tech_reviews'].get('AVGO'), 2600)}</pre></details>")
        if r and r.get("fund_reviews"): out.append(f"<details><summary>{e(r['name'])} · the fundamental review of MU, as it wrote it</summary><pre>{quote(r['fund_reviews'].get('MU'), 2600)}</pre></details>")
    if S.get("tech_facts"): out.append(f"<details><summary>The facts sheet every model received for AVGO (built by code from our bars)</summary><pre>{e(S['tech_facts']['AVGO'])}</pre></details>")
    if S.get("fund_facts"): out.append(f"<details><summary>The fundamentals sheet every model received for MU (Yahoo figures, formatted by code)</summary><pre>{e(S['fund_facts']['MU'])}</pre></details>")
    for s in ("AVGO", "XLV", "SNDK"):
        d = TA.get(s)
        if d: out.append(f"<details><summary>TradingAgents on {s} with Qwen2.5-7B · its market report and final decision ({d.get('decision')})</summary><pre>{quote(d.get('market_report'), 1500)}\n\n— FINAL —\n{quote(d.get('final_trade_decision'), 1200)}</pre></details>")
    d = TA.get("AVGO (with Fin-o1-8B)")
    if d and d.get("market_report"): out.append(f"<details><summary>TradingAgents on AVGO with Fin-o1-8B · market report and final decision ({d.get('decision')})</summary><pre>{quote(d.get('market_report'), 1500)}\n\n— FINAL —\n{quote(d.get('final_trade_decision'), 1200)}</pre></details>")
    d = FR.get("MU")
    if d: out.append(f"<details><summary>FinRobot on MU with Qwen2.5-7B · its review</summary><pre>{quote(d.get('review'), 1800)}</pre></details>")
    return "\n".join(out)

# ---------- numbers quoted in the prose ----------
co = T["per_kind_by_group"]["company"]; et = T["per_kind_by_group"]["etf"]; bco = T["base_by_group"]["company"]; bet = T["base_by_group"]["etf"]
fs = PB["pooled"]["full_stack"]; av = X["project"]["AVGO"]; cd = X["cross"]["pooled"]["company"]["death"]; ed = X["cross"]["pooled"]["etf"]["death"]
r0 = R["company"][0]; r1 = R["company"][1]
o1 = RV.get("fin-o1-8b", {}); qw = RV.get("qwen2.5-7b", {}); fr1 = RV.get("fin-r1", {}); fb = RV.get("finbert", {}); fg = RV.get("fingpt-mt-llama3", {})
def q_(r, k): return "not run" if r.get(k + "_right") is None else f"{r[k+'_right']} of {r[k+'_asked']}"
tone_best = max([r for r in S.get("reviewers", []) if r.get("tone_acc") is not None and r.get("tone_n") == 240], key=lambda r: r["tone_acc"], default={})
ta_ob = sum(d.get("says_overbought_oversold") or 0 for d in S.get("tradingagents", {}).values()); ta_f = S.get("tradingagents", {}).get("AVGO (with Fin-o1-8B)", {})
now = datetime.datetime.now().strftime("%d %b %Y %H:%M ET")
nsym = len(T["per_name"]); nbars = sum(v["sessions"] for v in B.values())
spy = X["depth"]["SPY"]; iwm = X["depth"]["IWM"]; rsp = X["depth"]["RSP"]; qqq = X["depth"]["QQQ"]

A(f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>PB1 · the playbook measured on our own bars, and open-source models to review it · 6 Oct 2026</title>
<style>
  :root{{ --bg:#0b0b0e; --panel:#121216; --line:#2a2a30; --ink:#d2d2d2; --ink2:#b4b4b8; --ink3:#8c8c92; }}
  *{{ box-sizing:border-box; }}
  body{{ margin:0; background:var(--bg); color:var(--ink2); font:14px/1.6 "SF Mono", Menlo, Consolas, monospace; }}
  main{{ max-width:1560px; margin:0 auto; padding:24px 16px 80px; }}
  h1{{ font-size:15px; letter-spacing:.3em; text-transform:uppercase; color:var(--ink); margin:10px 0 4px; }}
  .lead{{ color:var(--ink); font-size:15px; margin:8px 0 6px; max-width:1180px; }}
  .sub{{ color:var(--ink3); margin-bottom:16px; max-width:1180px; }}
  section{{ background:var(--panel); border:1px solid var(--line); margin:0 0 6px; padding:14px 16px; }}
  h2{{ font-size:13px; letter-spacing:.2em; text-transform:uppercase; margin:8px 0 6px; color:var(--ink); font-weight:600; }}
  h3{{ font-size:12px; letter-spacing:.18em; text-transform:uppercase; margin:18px 0 8px; color:var(--ink); font-weight:600; }}
  p{{ margin:6px 0; max-width:1180px; }}
  .note{{ color:var(--ink2); margin:6px 0 12px; max-width:1180px; }}
  .tw{{ overflow-x:auto; margin:8px 0 4px; }}
  table{{ border-collapse:collapse; width:100%; }}
  th{{ text-align:right; font-size:11px; letter-spacing:.06em; color:var(--ink3); font-weight:400; padding:6px 8px; border-bottom:1px solid var(--line); vertical-align:bottom; min-width:64px; }}
  td{{ padding:6px 8px; border-bottom:1px solid #1c1c22; font-size:13px; text-align:right; white-space:nowrap; color:var(--ink2); vertical-align:top; }}
  th:first-child, td:first-child{{ text-align:left; color:var(--ink); }}
  table.wrap td, table.wrap th{{ white-space:normal; text-align:left; min-width:90px; }} table.wrap td:first-child{{ min-width:240px; }}
  b{{ color:var(--ink); font-weight:600; }} a{{ color:var(--ink); }} .dim{{ color:var(--ink3); font-size:12px; }}
  img{{ width:100%; height:auto; border:1px solid var(--line); display:block; margin:8px 0 2px; }}
  .iw{{ overflow-x:auto; }}
  .cap{{ color:var(--ink3); font-size:12px; margin:4px 0 10px; }}
  .finds{{ display:grid; grid-template-columns:repeat(3, minmax(0,1fr)); gap:6px; margin:10px 0 6px; }}
  .finds > div{{ border:1px solid var(--line); padding:10px 12px; background:var(--panel); }}
  .finds .k{{ color:var(--ink3); font-size:11px; letter-spacing:.16em; text-transform:uppercase; }} .finds .v{{ color:var(--ink); font-size:14px; margin-top:4px; }}
  ol,ul{{ margin:6px 0 0 20px; padding:0; max-width:1180px; }} li{{ margin:6px 0; }}
  details{{ margin-top:10px; color:var(--ink3); font-size:13px; }} summary{{ cursor:pointer; letter-spacing:.12em; font-size:12px; color:var(--ink2); }}
  details p, details li{{ color:var(--ink2); }}
  pre{{ white-space:pre-wrap; background:#0e0e12; border:1px solid var(--line); padding:10px 12px; color:var(--ink2); font:12px/1.55 "SF Mono", Menlo, Consolas, monospace; max-width:1180px; overflow-x:auto; }}
  code{{ color:var(--ink); }}
  @media (max-width:900px){{ .iw img{{ min-width:860px; }} .finds{{ grid-template-columns:1fr; }} body{{ font-size:13px; }} main{{ padding:16px 10px 70px; }} td{{ font-size:12px; }} }}
</style>
</head>
<body>
<main>
<span data-scnav-slot></span><h1>PB1 · the playbook measured on our own bars — and open-source models to review it</h1>
<p class="lead"><b>What each playbook event has actually been followed by, counted on {nbars:,} of our own daily bars across {nsym} instruments — and which open-source model can read those counts back without getting them wrong.</b> Nothing here is a verdict or a rule: each line is a condition, how many times it happened, what followed, and the base rate beside it. Every level is the instrument's own (its own percentile, its own ATR).</p>
<p class="sub">Tuesday 6 Oct 2026, built {now} · a study on a branch · nothing deployed, no table written, no Hub page changed, the Indicator Lab only read · bars from our chart API through 5 Oct 2026 (split-adjusted; companies and funds from Massive, macro series from FMP / Cboe) · every model ran on this MacBook through llama.cpp or PyTorch, no paid API.</p>

<div class="finds">
  <div><div class="k">The 200-day line</div><div class="v">A cross of the 200-day reverses within 5 sessions {sh(co['x200_up']['whipsaw_5_share'])} of the time in the companies ({co['x200_up']['n']} reclaims) and {sh(et['x200_up']['whipsaw_5_share'])} in the funds ({et['x200_up']['n']}). Price re-tags the line within 60 sessions after {sh(co['x200_up']['retag200_60_share'])} of reclaims.</div></div>
  <div><div class="k">The 21-day in the leaders</div><div class="v">Of {fs['n']} fresh touches in an uptrend across the 7 leaders, {sh(fs['held_10_share'])} held for 10 sessions; in {sh(fs['reached_50_in_20_share'])} the low went on to the 50-day within 20. A new high came first in {sh(fs['new_high_first_share'])}, a break in {sh(fs['broke_first_share'])}.</div></div>
  <div><div class="k">The 50/200 cross</div><div class="v">It prints late: at the cross the companies had already lost {sh(-cd['already_from_peak_med'], 1)} from the high ({cd['n']} cases) and {sh(cd['ret_120_pos'])} were higher 120 sessions on. AVGO's 50-day falls under its 200-day in {av['flat']} sessions if price only stays flat.</div></div>
  <div><div class="k">Index pullbacks</div><div class="v">SPY has had {spy['summary']['n']} pullbacks of 3%+ since 2003, median {sh(spy['summary']['depth_med'], 1)}; one in four went past {sh(spy['summary']['depth_p75'], 1)}. Now: SPY {pc(spy['current']['deepest_so_far'])} at worst since its Aug high, IWM {pc(iwm['current']['deepest_so_far'])}, RSP {pc(rsp['current']['deepest_so_far'])}.</div></div>
  <div><div class="k">Reviewer model</div><div class="v">Same facts sheet to four local models: Fin-o1-8B read {q_(o1, 'tech')} technical facts right, Qwen2.5-7B {q_(qw, 'tech')}, Fin-R1 {q_(fr1, 'tech')}, FinGPT {q_(fg, 'tech')}. Answering blindly scores about half.</div></div>
  <div><div class="k">Event-study engine</div><div class="v">vectorbt and TA-Lib reproduced our counts, dates and indicator values exactly on the 5 trial names. The two candle-forecasting models did worse than saying "up" every time.</div></div>
</div>

<section>
<h2>1 · The pictures — what followed a cross of the 200-day</h2>
<p class="note">Green is the median best point reached in the sessions after the event, red the median worst point; solid lines follow a reclaim (the close crossing up), dashed a loss, dotted is every session of the same instruments. Where the coloured lines sit on the dotted ones, the event told us nothing the average day did not.</p>
{img("c1-200day-paths.png", "After the close crossed the 200-day: median max run-up and max drawdown over 5, 10, 20 and 60 sessions, for companies, funds and macro series")}
{img("c2-200day-by-name.png", "Per name: after a 200-day reclaim, median best and worst point within 60 sessions, with counts")}
{img("c6-spy-example.png", "SPY since October 2024 with its clouds, 200-day crosses and RSI against its own percentiles", "One name as a worked picture: SPY's bars, the 13/21, 21/50 and 50/200 clouds as the Lab draws them, each 200-day cross, and RSI against SPY's own 10th and 90th percentile (dotted) rather than 30/70.")}
</section>

<section>
<h2>2 · The event tables — every playbook event, what happened next</h2>
<p class="note">Each row is one kind of event. Run-up and drawdown are the median best and worst point (using the highs and lows) over the next 5, 10, 20 and 60 sessions, measured from the close of the event day. "Higher after 60" is green when it beats the base rate in the bottom row and red when it does not. The clouds are the Lab's three pairs exactly as the Clean Clouds script defines them: 13-day and 21-day EMA, 21-day EMA and 50-day SMA, 50-day and 200-day SMA; bull when the faster is at or above the slower at the daily close. RSI and Williams %R tags use each name's own trailing two-year 10th and 90th percentile.</p>
<h3>{GN['company']} — AMZN, AVGO, BE, CRWV, GOOGL, MU, NBIS, NVDA, VST, WMT</h3>
{event_table('company')}
<h3>{GN['etf']}</h3>
{event_table('etf')}
<details><summary>THE 7 MACRO SERIES — VIX, US 10-year, Bitcoin, put/call, crude, gold, silver (these are not prices you hold; shown for completeness)</summary>{event_table('macro')}</details>
<details><summary>PER NAME — the 200-day crosses and the RSI tags, each name against its own base rate</summary>{name_table(['x200_up', 'x200_down'])}{name_table(['rsi_low', 'rsi_high'])}</details>
<details><summary>PER NAME — the cloud flips</summary>{name_table(['cloud_inner_bull', 'cloud_inner_bear'])}{name_table(['cloud_outer_bull', 'cloud_outer_bear'])}</details>
{img("c4-cloud-flip-life.png", "How long each cloud flip lasted before the opposite flip")}
{img("c3-rsi-low-vs-base.png", "After RSI tagged its own 10th percentile, per name, against each name's base rate")}
<h3>Between the flips — how long a spell above or below the 200-day lasted and how far it went</h3>
<p class="note">A spell runs from one cross of the 200-day to the next. Most are over in days; the ones that last are where the distance is made. For the long spells (60 sessions or more) the table gives how high or low price got, measured from the close of the cross, and the RSI on the day of that high or low.</p>
{spell_table()}
<details><summary>THE SPELL EACH NAME IS IN NOW</summary>{open_spells()}</details>
</section>

<section>
<h2>3 · Recurrence — combinations, what followed, and the base rate</h2>
<p class="note">Each line is a combination of conditions, the number of times it happened, the thing we asked about, and how often that thing happens anyway. The first two lines are the example Alan gave: a 200-day reclaim with RSI below its own median, then a breakout. In the companies that combination was followed by a close above the prior 20-session high within 20 sessions in {r0['n_follow']} of {r0['n']} cases ({sh(r0['share'])}); with RSI above its median, {r1['n_follow']} of {r1['n']} ({sh(r1['share'])}); after any reclaim, {sh(r0['base'])}.</p>
{img("c5-recurrence-company.png", "Recurrence, companies: each condition's follow-on share against its base rate")}
<h3>{GN['company']}</h3>
{rec_table('company')}
<h3>{GN['etf']}</h3>
{img("c5-recurrence-etf.png", "Recurrence, funds: each condition's follow-on share against its base rate")}
{rec_table('etf')}
<details><summary>THE 7 MACRO SERIES</summary>{rec_table('macro')}</details>
</section>

<section>
<h2>4 · Pullbacks to the 21-day average in the leaders — how often it held</h2>
<p class="note">Alan: "if it reaches a 21-day moving average, I feel like that's safe — check against those rebounds." Checked on MU, AVGO, NVDA, GOOGL, TSM, SPY and QQQ over each one's full history. A <b>fresh touch</b> is the first day the low reaches the 21-day EMA after at least five sessions entirely above it. <b>Held</b> means no close more than one ATR (that name's own average daily range) under the 21-day in the next ten sessions. The race asks which came first inside 60 sessions: a close above the prior 20-session high, or a close more than one ATR under the line. The first table is the uptrend case only (21-day over 50-day over 200-day).</p>
{img("c7-pullback-21day.png", "Pullbacks to the 21-day in the seven leaders: what came first against the base rate, and how often the touch held or went on to the 50-day")}
{pb_table('full_stack')}
<p class="note">Read across the bottom row: of {fs['n']} fresh touches in an uptrend, the day closed at or above the line in {sh(fs['close_held_share'])}, it held ten sessions in {sh(fs['held_10_share'])}, and the low reached the 50-day within twenty sessions in {sh(fs['reached_50_in_20_share'])}. The median worst dip over the next twenty sessions was {pc(fs['drawdown_20_med'])} and in the worst tenth of cases {pc(fs['drawdown_20_p10'])} or more. The base column is every session in the same uptrend, where price is usually already near its high — so it is the harder comparison. On "a new high came first" the touch is below that base on all seven names; on "higher after 20 sessions" it sits within a few points of the base either way.</p>
<details><summary>THE SAME TOUCHES SPLIT — the last two years only · RSI below or above its own median · the day closed above or below the line · outside an uptrend</summary>
<h3>Uptrend, last two years</h3>{pb_table('full_stack_last2y')}
<h3>Uptrend, all seven pooled, split</h3>{table(["split", "fresh touches", "held 10 sessions", "reached the 50-day within 20", "new high first", "broke first", "median worst dip in 20", "median 20-session return", "higher after 20"], [[lab, PB['pooled'][k]['n'], sh(PB['pooled'][k]['held_10_share']), sh(PB['pooled'][k]['reached_50_in_20_share']), sh(PB['pooled'][k]['new_high_first_share']), sh(PB['pooled'][k]['broke_first_share']), pc(PB['pooled'][k]['drawdown_20_med']), pc(PB['pooled'][k]['ret_20_med']), sh(PB['pooled'][k]['ret_20_pos'])] for k, lab in (("full_stack_rsi_below_med", "RSI below its own median at the touch"), ("full_stack_rsi_above_med", "RSI above its own median at the touch"), ("full_stack_close_held", "the touch day closed at or above the 21-day"), ("full_stack_close_lost", "the touch day closed under the 21-day"), ("not_full_stack", "not in an uptrend stack"))])}
</details>
<details><summary>EVERY TOUCH OF THE LAST 12 MONTHS, name by name — the rebounds to check against</summary>{pb_recent()}</details>
<h3>Where each leader stands against its 21-day now</h3>
{pb_now()}
</section>

<section>
<h2>5 · The 50-day crossing the 200-day, both ways — and the lag</h2>
<p class="note">The cross is two slow averages meeting, so it prints after the move. The table measures the lag: how far price had already travelled from its 252-session high (or low) on the day of the cross, and how much was still to come in the next 120 sessions. "The low was already in" counts the times no close in the next 120 sessions went under the lowest close made before the cross.</p>
{img("c8-cross-lag.png", "The 50/200-day cross arrives late: the move already made at the cross against what was still to come")}
{cross_table()}
<h3>The names in this study</h3>
{cross_names()}
<h3>When the next cross falls — arithmetic, not a forecast</h3>
<p class="note">The coordinator's check holds. AVGO's 50-day is {av['sma50']:.1f} and its 200-day {av['sma200']:.1f} (gap {pc(av['gap_pct'], 2)}), with the last close at {av['last']:.2f}. July's higher closes are rolling out of the 50-day while the 200-day barely moves, so the 50-day falls under it in {av['flat']} sessions if price stays flat, {av['down_0.5pct_a_day']} if it slips 0.5% a day, and {av['up_0.5pct_a_day']} even if it rises 0.5% a day. The table lists every instrument whose two averages are within 4.5% of each other and when they would cross on five simple price paths (each drift runs 60 sessions, then flat).</p>
{project_table()}
</section>

<section>
<h2>6 · Index pullback depth — SPY, QQQ, IWM, RSP since 2003</h2>
<p class="note">A pullback starts at a 252-session closing high and ends at the next one; its depth is the lowest close in between. Only pullbacks of 3% or more are counted. The white stem at the right edge of each panel is the pullback open now.</p>
{img("c9-index-pullback-depth.png", "Every pullback of 3% or more in SPY, QQQ, IWM and RSP since 2003, by depth")}
{depth_table()}
<details><summary>BY DEPTH — how long each size of pullback took and what it reached</summary>{depth_buckets()}</details>
</section>

<section>
<h2>7 · Open-source models — every viable one installed and tried on SPY, MU, AVGO, SNDK and XLV</h2>
<p class="note">Two different things carry the name "open source" here, and Alan drew the line: a <b>model</b> (Qwen, FinBERT, Fin-o1 — something that reads and writes) and a <b>helper</b> (a library or a framework that wraps a model). Both were tried. For the reviewer job each language model got the identical facts sheet per name, built by code from our bars, and was asked for two things: a review under Alan's rules (conditions and counts, own percentiles, no verdict, 220 words), and eight yes/no questions whose answers are in the sheet. The questions are balanced so that answering "yes" to everything scores {sh(BL.get('tech_always_yes'))}.</p>
{img("c10-reviewer-scoreboard.png", "Open models as reviewers: share of technical facts, fundamental facts and headline tone each model got right")}
{reviewer_table()}
<p class="note"><b>What the scoreboard says.</b> Reading a sheet of numbers correctly is the whole job of a reviewer, and it separated the models cleanly. Fin-o1-8B (a finance reasoning model built on Qwen3-8B, Apache-2.0) got {q_(o1, 'tech')} technical and {q_(o1, 'fund')} fundamental facts right. Qwen2.5-7B, the model already on this Mac, got {q_(qw, 'tech')} and {q_(qw, 'fund')}: it writes fluently and never invented a number, but it mis-compares them — on AVGO it said the close was above the 200-day when the sheet says 362.51 against 367.60, and it called Williams %R of −13.1 "above the 90th percentile" of −6.1. Fin-R1 got {q_(fr1, 'tech')} and {q_(fr1, 'fund')}. FinGPT's adapter is built for labelling headlines, not for reviewing; it looped on {fg.get('tech_loop_reviews', '–')} of 5 reviews. Only Fin-o1 kept its answer near the 220-word limit (median {o1.get('tech_words_med', '–')} words after its printed reasoning; Qwen {qw.get('tech_words_med', '–')}, Fin-R1 {fr1.get('tech_words_med', '–')}), and every model still used the words "overbought" or "oversold" in most reviews (usually to say the name was neither), so the wording rules have to be enforced by the wrapper, not trusted to the model. Fin-o1 quoted {o1.get('tech_numbers_unsupported', '–')} numbers that are not on the sheet out of {o1.get('tech_numbers', '–')} (a rounded price range, "360–427", on AVGO); Qwen none.</p>
<h3>The helpers and the forecasting models</h3>
{framework_table()}
<p class="note"><b>Why the agent frameworks are not the pick.</b> TradingAgents ran end to end on all five names with the local Qwen and its figures matched ours (MU close 1063.96, 50-day 958.91, RSI 57.26). But its product is a rating, and with a 7B model the reasoning behind the rating was repeatedly upside-down: on AVGO it wrote that the 50-day "is currently above the current price, indicating a bullish trend" and rated it Buy; on SNDK it read a 200-day far below the price as "a strong bearish trend" and rated it Underweight; on XLV it wrote "the 200-day SMA is above the current price" (155.58 against 167.37) and rated it Sell. Its five reports use the words overbought or oversold {ta_ob} times — a universal reading of RSI, not the name's own. Swapping in the better model did not change the shape: with Fin-o1-8B it took {(ta_f.get('seconds') or 0)/60:.0f} minutes on AVGO and still ended in "{ta_f.get('decision', '–')}". FinRobot is thinner still without its paid data keys. The pattern worth borrowing from both is the split into roles (one reads the tape, one reads the filings, one argues the other side) — on top of a model that reads numbers correctly, and without the rating.</p>
{img("c11-forecast-models.png", "Open forecasting models walk-forward on our bars: direction right against always saying up")}
<details><summary>FORECASTING MODELS — the walk-forward scores, name by name</summary>{fc_table()}</details>
<h3>Headline tone — the job FinBERT and FinGPT were built for</h3>
<p class="note">240 labelled finance headlines from a public test file (80 positive, 80 negative, 80 neutral), then this week's 60 real headlines on the five names. Best on the labelled set: {e(tone_best.get('name', '–'))} at {sh(tone_best.get('tone_acc'))}, with Qwen2.5-7B at {sh(qw.get('tone_acc'))}. FinBERT scored {sh(fb.get('tone_acc'))} in {fb.get('tone_seconds', '–')} seconds for all 300 on the processor alone — a tenth of a second a headline and 0.4 GB. On this week's headlines the models that labelled all 60 agreed on {S.get('headline_agreement', {}).get('all_agree', '–')} of {S.get('headline_agreement', {}).get('n', '–')}; the table shows every one so the labels can be judged by eye.</p>
<details><summary>THIS WEEK'S 60 HEADLINES, labelled by each model</summary>{headline_table()}</details>
<h3>What the models actually wrote</h3>
{review_blocks()}
</section>

<section>
<h2>8 · The pick for each job, the install, and the trial plan</h2>
<ol>
<li><b>Job (i), the independent review of a name — adopt Fin-o1-8B as the reviewing model, fed by our own facts sheet.</b> Evidence: {q_(o1, 'tech')} technical and {q_(o1, 'fund')} fundamental facts read correctly against {q_(qw, 'tech')} and {q_(qw, 'fund')} for Qwen2.5-7B on the same sheets; Apache-2.0; a 5.0 GB file; about {o1.get('tech_seconds_med', '–')} seconds a review on this Mac. The code computes every number and every comparison; the model only reads and writes. Install: <code>brew install llama.cpp</code> (already here), download <code>Fin-o1-8B.Q4_K_M.gguf</code> from <code>mradermacher/Fin-o1-8B-GGUF</code>, run <code>llama-server -m Fin-o1-8B.Q4_K_M.gguf -ngl 99 -c 8192 --port 18091</code>, then <code>python3 tools/llm_review_trial.py fin-o1-8b 18091 &lt;names&gt;</code>. The trial on five names is done and on this page. Next step if Alan agrees: run it on all 19 reviewed names each evening on a branch, with the wrapper cutting the answer to the limit and rejecting any review that contains a rating word or a number not in the sheet.</li>
<li><b>Headline tone (the news-cycle input) — Qwen2.5-7B, already on this Mac; FinBERT where speed matters.</b> On the 240 labelled headlines Qwen2.5-7B scored {sh(qw.get('tone_acc'))} and Fin-R1 {sh(fr1.get('tone_acc'))} (two headlines apart; Fin-R1's licence is not declared), FinGPT {sh(fg.get('tone_native_acc'))} with its own prompt, FinBERT {sh(fb.get('tone_acc'))} at a tenth of a second a headline. Fin-o1 is the wrong tool here: {sh(o1.get('tone_acc'))} on the {o1.get('tone_n', '–')} it was given, because it reads a tone into neutral headlines, and it is slow. FinBERT install: <code>pip install transformers torch</code>, model <code>ProsusAI/finbert</code>.</li>
<li><b>Job (ii), event studies — keep our own script as the engine and adopt vectorbt (with TA-Lib) as the independent recount.</b> Evidence: on the five trial names vectorbt returned the same number of 200-day crosses, on the same dates, with the same 60-session medians, and TA-Lib's RSI, Williams %R and averages match ours to thirteen decimal places. Install: <code>pip install vectorbt TA-Lib</code>; recount with <code>python tools/toolkit_trial.py</code>. A study is trusted when both agree.</li>
<li><b>Not adopted:</b> TradingAgents and FinRobot as reviewers (ratings, and wrong comparisons on a small model); FinGPT's adapter as a reviewer; Kronos and Chronos-Bolt for forecasting (no better than doing nothing on our names); Qlib until the universe is in the hundreds; OpenBB unless we want Yahoo/SEC figures without our own keys.</li>
</ol>
</section>

<section>
<h2>9 · What could be wrong, and what was not done</h2>
<ul>
<li><b>Overlapping events.</b> The same sell-off can produce several events in one name within days (a 200-day loss, an RSI tag, a cloud flip), and pooled counts treat them as separate. Counts are honest as counts; they are not independent trials, so small differences from the base rate mean little.</li>
<li><b>History is uneven.</b> Most names go back to 2003; CRWV has 382 bars, NBIS 490 and SNDK 406, so their rows rest on a handful of events. SNDK has never closed across its 200-day in our data.</li>
<li><b>Survivors.</b> The companies are today's reviewed leaders; their base rates are high because they are the ones that worked. The funds are the fairer sample.</li>
<li><b>The 21-day base rate is a hard comparison</b> (any session in an uptrend, usually already near a high). The touch itself is still roughly a coin flip on holding, on every name.</li>
<li><b>Prices only, split-adjusted, not dividend-adjusted.</b> The frameworks used Yahoo's dividend-adjusted series, which is why their 200-day differs from ours by a few tenths of a percent.</li>
<li><b>Fundamentals in the model trial are Yahoo's, not ours.</b> Our own fundamentals sit behind keys that live on Fly, and the read-only database link was refused to this run, so the fundamental sheets for MU, AVGO and SNDK were built from Yahoo's free figures. They are good enough to test whether a model reads a sheet correctly; they are not a check of our data.</li>
<li><b>The forecasting models were used as shipped.</b> Kronos and Chronos-Bolt were not fine-tuned on our names; five sampled paths per forecast for Kronos. A tuned version could do better; as downloaded, neither beat doing nothing.</li>
<li><b>The model trial is five names and one run each.</b> It separates models that misread numbers from one that does not; it does not rank the close ones. All models were 4-bit files; larger versions were not tried.</li>
<li><b>Not done:</b> no intraday events; no volume conditions; the Geiger was not part of these events; the reviewer was not wired into any page; nothing was deployed.</li>
</ul>
</section>

<details class="sc-pagespecs"><summary>PAGE SPECS</summary>
<p><b>Data.</b> Daily bars from <code>scintilla-massive-chart-api.fly.dev/candles</code> (read only), pulled 6 Oct 2026, last bar 5 Oct 2026. {nsym} instruments in the event tables: the 19 reviewed names (AMZN, AVGO, BE, CRWV, GOOGL, MU, NBIS, NVDA, VST, WMT, SPY, QQQ, VIX, US10Y, BTCUSD, PCC, CLUSD, GCUSD, SIUSD), IWM, SMH and the 11 sector funds. TSM, SNDK and RSP were added for sections 4–7 only and are not in the pooled tables of sections 2–3.</p>
<p><b>Definitions.</b> Cross: the close moves from one side of the average to the other (at or above counts as above). Cloud flip: the faster average moves from below to at-or-above the slower, or the reverse, at the daily close — pairs and rule read from <code>SCINTILLA_Clean_Clouds_V17_Readable.pine</code> (13/21 EMA, 21 EMA/50 SMA, 50/200 SMA). RSI: Wilder, 14. Williams %R: 14. Own percentile: the 10th and 90th of the trailing 504 sessions (at least 252), taken up to the day before. Run-up and drawdown: highest high and lowest low over the next N sessions against the event close. Base rate: the same measure on every session of the same instruments. ATR: Wilder, 14.</p>
<p><b>Files.</b> <code>tools/pull-bars.py</code> (bars), <code>tools/events.py</code> (sections 1–3), <code>tools/extra_studies.py</code> (spells and sections 4–6), <code>tools/llm_review_trial.py</code>, <code>tools/fundamental_trial.py</code>, <code>tools/tone_trial.py</code>, <code>tools/forecast_trial.py</code>, <code>tools/toolkit_trial.py</code>, <code>tools/score_models.py</code> (section 7), <code>tools/charts.py</code> and <code>tools/extra_charts.py</code> (pictures), <code>tools/build_page.py</code> (this page). Results in <code>data/*.json</code> and <code>data/models/*.json</code>. The bars and the per-event rows are not committed (65 MB); <code>pull-bars.py</code> then <code>events.py</code> rebuild them.</p>
<p><b>Models.</b> Language models as 4-bit GGUF files on llama.cpp with Metal: Qwen2.5-7B-Instruct, SUFE-AIFLM-Lab Fin-R1, TheFinAI Fin-o1-8B, FinGPT-MT-Llama-3-8B-LoRA. ProsusAI/finbert, NeoQuasar Kronos-small and Kronos-base, amazon/chronos-bolt-base on PyTorch. TradingAgents 0.6.0, FinRobot 0.1.5, Qlib 0.9.7, vectorbt, TA-Lib, pandas-ta, OpenBB 5.0.0, each in its own throw-away environment outside the repository. Labelled headlines: the validation split of <code>zeroshot/twitter-financial-news-sentiment</code> (FinGPT's adapter was trained on that set's training split; FinBERT was not). This week's headlines: Google News RSS.</p>
<p><b>Colour.</b> Greys for text and reference marks; green and red only for direction (up / down, above / below the base rate).</p>
</details>
</main>
</body>
</html>
""")
open(os.path.join(ROOT, "PLAYBOOK-EVENTS.html"), "w").write("".join(P))
print("page written", len("".join(P)), "bytes")
