#!/usr/bin/env python3
"""LD1 · a compact digest of study.json for the opinion panel (the analysts and the refuters read this one file)."""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
S = json.load(open(os.path.join(D, "study.json")))
r = lambda v, d=1: None if v is None else round(v, d)
p = lambda v: None if v is None else round(v * 100, 1)
def name(n):
    c = n["comps"]
    return {"t": n["ticker"], "group": n["group"], "cohort": n["cohort"], "rank": n["rank"], "kind": n["kind"],
            "ret_3m_pct": p(n["r3m"]), "ret_1m_pct": p(n["r1m"]), "run_15sep_pct": p(n["r_run"]), "fall_30jun_15sep_pct": p(n["r_selloff"]), "geiger": r(n["geiger"], 2),
            "cap_now_b": r(n["cap_now_b"]), "cap_15sep_b": r(n["cap_run_start_b"]),
            "sales_growth_last_q_pct": r(n["rev_growth_latest_q_yoy_pct"]), "sales_growth_next_fy_pct": r(n["rev_growth_next_fy_pct"]), "eps_growth_next_fy_pct": r(n["eps_growth_next_fy_pct"]),
            "eps_estimate_90d": n["eps_rev_90d_direction"], "eps_estimate_90d_pct": r(n["eps_rev_90d_pct"]), "eps_estimate_status": n["eps_rev_90d_direction_status"],
            "sales_estimate_90d": n["rev_est_rev_90d_direction"], "guidance": n["guidance_direction"], "guidance_status": n["guidance_direction_status"],
            "profitable": n["eps_ttm_positive"], "operating_margin_now_and_year_ago_pct": [r(n["operating_margin_pct"]), r(n["operating_margin_year_ago_pct"])],
            "fcf_12m_b": r(n["fcf_ttm_usd_b"], 2), "cash_less_debt_b": r(n["net_cash_usd_b"], 2), "share_count_1y_pct": r(n["shares_change_yoy_pct"]),
            "forward_pe": r(n["forward_pe"]), "comps_median_forward_pe": r(c["pe_median"]), "ev_sales": r(n["ev_sales"]), "comps_median_ev_sales": r(c["evs_median"]),
            "comps_median_ret_1m_pct": p(c["peers_r1m_median"]), "comps_median_run_pct": p(c["peers_run_median"]),
            "customers": n["concentration_level"], "top_customer_pct": n["top_customer_pct"], "customers_words": (n["customer_concentration"] or "")[:170],
            "new_shares_coming": n["supply_overhang"], "raised_money_since_1jul": n["raised_capital_90d"], "buying_back": n["buyback_active"],
            "events": (n["insider_lockup_events"] or "")[:300], "story": (n["one_line_story"] or "")[:330], "last_report": (n["last_earnings_summary"] or "")[:210]}
cond = lambda c: {"condition": c["words"], "leaders": f'{c["leaders_yes"]} of {c["leaders_n"]}', "laggards": f'{c["laggards_yes"]} of {c["laggards_n"]}', "gap_points": c["gap_points"], "how_sure": c["strength"],
                  "where_two_readings_agree": None if not c.get("strict") else f'leaders {c["strict"]["leaders_yes"]} of {c["strict"]["leaders_n"]}, laggards {c["strict"]["laggards_yes"]} of {c["strict"]["laggards_n"]}',
                  "leaders_no": c["leaders"]["no"], "laggards_yes": c["laggards"]["yes"]}
C = {c["id"]: c for c in S["conditions"]}
out = {
 "question": "Alan, 6 Oct 2026: 'all of these things that are overbought right now have performed in a weird environment and pushed the indexes higher ... do a study with these leaders and whatever the comps system says are comparables for them, versus the ones that are doing wrong, like this CBRS one. What's the big difference between these names? Why is it that these names are the ones that bounced? In your opinion. And also what market cap did that put them at.'",
 "alan_framework": "Alan: 'Growth, revenue growth, earnings growth, is the fundamental driver of everything.' Comps / fundamentals decide WHAT to buy; technicals decide WHEN.",
 "setup": {"field": S["field"], "rule": S["rule"], "the_fall": "30 Jun 2026 -> 15 Sep 2026", "the_run": "15 Sep 2026 -> 5 Oct 2026 (last close on file)",
           "benchmarks_pct": {k: {a: p(b) for a, b in v.items()} for k, v in S["benchmarks"].items()},
           "benchmark_names": {"QQQ": "Nasdaq-100 fund", "SPY": "S&P 500 fund", "RSP": "equal-weight S&P 500", "SMH": "chip fund", "IGV": "software fund", "CIBR": "cybersecurity fund", "XLU": "utilities fund"},
           "groups": S["groups"], "named_in_brief": S["named_in_brief"]},
 "what_separates_leaders_from_laggards": [cond(C[i]) for i in S["conditions_sorted_ids"]],
 "both_fell_hard__bounced_vs_did_not": {"bounced": S["bounce_cut"]["bounced"], "did_not": S["bounce_cut"]["stayed_down"],
     "conditions": [{"condition": c["words"], "bounced": f'{c["a_yes"]} of {c["a_n"]}', "did_not": f'{c["b_yes"]} of {c["b_n"]}', "gap_points": c["gap_points"], "how_sure": c["strength"]} for c in S["bounce_cut"]["conditions"]]},
 "never_fell_leaders_vs_laggards": {"never_fell": S["bounce_cut"]["never_fell"],
     "conditions": [{"condition": c["words"], "never_fell": f'{c["a_yes"]} of {c["a_n"]}', "laggards": f'{c["b_yes"]} of {c["b_n"]}', "gap_points": c["gap_points"], "how_sure": c["strength"]} for c in S["bounce_cut"]["never_fell_vs_laggards"][:14]]},
 "three_month_shapes": S["kinds"],
 "cohorts": [{"cohort": c["label"], "names": c["n"], "value_15sep_b": r(c["run_start_b"]), "value_now_b": r(c["now_b"]), "median_run_pct": p(c["median_r_run"]), "median_1m_pct": p(c["median_r1m"]), "median_3m_pct": p(c["median_r3m"]),
              "median_geiger": r(c["median_geiger"], 2), "leaders": c["leaders"], "laggards": c["laggards"]} for c in S["cohort_caps"]],
 "market_value_b": S["caps"], "same_cohort_pairs": S["pairs"],
 "names": [name(n) for g in ("leader", "laggard", "named_mid") for n in (S["names"][t] for t in S["groups"][g])],
 "data_quality": {k: v for k, v in S["quality"].items() if k not in ("hub_crosscheck", "comps_rule_vs_live_5oct")} | {"hub_crosscheck": {k: v for k, v in S["quality"]["hub_crosscheck"].items() if k != "rows"},
     "note": "Fundamentals are public web pages read on 6 Oct by one agent per name, re-checked by a second; estimate direction and guidance were also read blind by a third. The live database was not read."},
}
# one object per line, so the file reads in pieces: a header line per section, then compact JSON lines
c = lambda o: json.dumps(o, separators=(",", ":"), ensure_ascii=False)
lines = ["# LD1 DIGEST. Sections start with '## '. Every other line is one compact JSON object.", "## QUESTION", c({"question": out["question"], "alan_framework": out["alan_framework"]}), "## SETUP", c(out["setup"]),
         "## WHAT SEPARATES LEADERS FROM LAGGARDS (sorted by gap; 'x of n' = names meeting the condition of those with a reading)"] + [c(x) for x in out["what_separates_leaders_from_laggards"]]
b = out["both_fell_hard__bounced_vs_did_not"]
lines += ["## BOTH SETS FELL HARD IN THE SUMMER: THE LEADERS THAT BOUNCED vs THE LAGGARDS THAT DID NOT", c({"bounced": b["bounced"], "did_not": b["did_not"]})] + [c(x) for x in b["conditions"]]
nf = out["never_fell_leaders_vs_laggards"]
lines += ["## THE LEADERS THAT NEVER FELL vs ALL LAGGARDS", c({"never_fell": nf["never_fell"]})] + [c(x) for x in nf["conditions"]]
lines += ["## THE SHAPE OF EACH NAME'S THREE MONTHS (whole field)"] + [c(x) for x in out["three_month_shapes"]]
lines += ["## COHORTS (whole field)"] + [c(x) for x in out["cohorts"]]
lines += ["## MARKET VALUE, $B", c(out["market_value_b"]), "## SAME COHORT, DIFFERENT OUTCOME", c(out["same_cohort_pairs"])]
def fit(x, limit=1900):   # the reader takes lines up to 2,000 characters: shorten the three free-text fields until the line fits
    x = dict(x)
    for cut in (260, 200, 150, 100):
        if len(c(x)) <= limit: break
        for k in ("events", "story", "last_report", "customers_words"): x[k] = x[k][:cut]
    return c(x)
lines += ["## THE NAMES, ONE PER LINE (leaders, then laggards, then the five named mid-field)"] + [fit(x) for x in out["names"]]
K = S["checks"]
lines += ["## FOUR CHECKS ON THE FINDING",
          c({"check": "each leader and laggard against its OWN comps' median in the run", "beat": K["beat_own_comps"]["beat"], "fell_behind": K["beat_own_comps"]["behind"], "leaders_that_beat": K["beat_own_comps"]["leaders_that_beat"], "laggards_that_beat": K["beat_own_comps"]["laggards_that_beat"]})] + \
         [c({"condition": x["words"], "beat_its_comps": f'{x["a_yes"]} of {x["a_n"]}', "fell_behind": f'{x["b_yes"]} of {x["b_n"]}', "gap_points": x["gap_points"], "how_sure": x["strength"]}) for x in K["beat_own_comps"]["conditions"]] + \
         [c({"check": "ticks all four: guidance raised, earnings estimate raised, profitable, free cash flow above zero", "leaders": f'{K["ticks_every_box"]["leaders"]} of {K["ticks_every_box"]["leaders_total"]}', "laggards": f'{K["ticks_every_box"]["laggards"]} of {K["ticks_every_box"]["laggards_total"]}', "named_mid": f'{K["ticks_every_box"]["named_mid"]} of {K["ticks_every_box"]["named_mid_total"]}', "names_and_ranks": [[b["ticker"], b["group"], b["rank"]] for b in K["ticks_every_box"]["names"]]}),
          c({"check": "bigger estimate raise, bigger move (profitable names with a then-and-now pair)", "names": K["size_of_raise"]["n"], "rank_correlation_with_the_run": r(K["size_of_raise"]["rank_corr_with_run"], 2), "rank_correlation_with_3_months": r(K["size_of_raise"]["rank_corr_with_3m"], 2)}),
          c({"check": "who added the dollars in the run (whole field, Hub profile value x price change 15 Sep -> 5 Oct), $B", "field_added": r(K["who_added_the_dollars"]["field_added_b"]), "leaders_added": r(K["who_added_the_dollars"]["leaders_added_b"]), "laggards_added": r(K["who_added_the_dollars"]["laggards_added_b"]), "top5_share_of_field_gain": r(K["who_added_the_dollars"]["top5_share"], 2), "top3_leaders_share_of_leader_value": r(K["who_added_the_dollars"]["top3_leaders_share_of_leader_value"], 2), "top": [[a["ticker"], a["group"], a["rank"], r(a["added_b"])] for a in K["who_added_the_dollars"]["top"]]})]
lines += ["## DATA QUALITY", c(out["data_quality"])]
open(os.path.join(D, "digest.txt"), "w").write("\n".join(lines) + "\n")
print("digest.txt", os.path.getsize(os.path.join(D, "digest.txt")), "bytes,", len(lines), "lines, longest", max(len(l) for l in lines))
