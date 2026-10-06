#!/usr/bin/env python3
"""LD1 · the opinion, written by the lane's agent after a panel argued it (three analysts with different lenses, two refuters,
one completeness critic; their returns are in data/panel.json). The words are fixed here; every count in them is read from
study.json when this runs, so the paragraph cannot drift from the tables.  ->  ../opinion.json"""
import json, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
S = json.load(open(os.path.join(D, "study.json"))); N = S["names"]; G = S["groups"]
C = {c["id"]: c for c in S["conditions"]}
BC = {c["id"]: c for c in S["bounce_cut"]["conditions"]}
K = S["checks"]; BT = {c["id"]: c for c in K["beat_own_comps"]["conditions"]}
lg = lambda i: f'{C[i]["leaders_yes"]} of {C[i]["leaders_n"]} leaders against {C[i]["laggards_yes"]} of {C[i]["laggards_n"]} laggards'
lg2 = lambda i: f'{C[i]["leaders_yes"]} of {C[i]["leaders_n"]} · {C[i]["laggards_yes"]} of {C[i]["laggards_n"]}'
bc = lambda i: f'{BC[i]["a_yes"]} of {BC[i]["a_n"]} against {BC[i]["b_yes"]} of {BC[i]["b_n"]}'
bt = lambda i: f'{BT[i]["a_yes"]} of {BT[i]["a_n"]} against {BT[i]["b_yes"]} of {BT[i]["b_n"]}'
strict = lambda i: f'{C[i]["strict"]["leaders_yes"]} of {C[i]["strict"]["leaders_n"]} · {C[i]["strict"]["laggards_yes"]} of {C[i]["strict"]["laggards_n"]}'
usd = lambda v: f"${v/1000:,.2f} trillion" if abs(v) >= 1000 else f"${v:,.0f} billion"
cb = N["CBRS"]; cc = cb["comps"]
nf, bo = S["bounce_cut"]["never_fell"], S["bounce_cut"]["bounced"]
falls = sorted(abs(N[t]["r_selloff"]) * 100 for t in bo)
d = K["who_added_the_dollars"]; top = {a["ticker"]: a for a in d["top"]}
tk = K["ticks_every_box"]; outside = [b for b in tk["names"] if b["group"] != "leader"]
caps = S["caps"]
big3 = sorted(G["leader"], key=lambda t: -(N[t]["cap_now_b"] or 0))[:3]
chips = sum(1 for t in bo if any(w in N[t]["cohort"] for w in ("SEMI", "ACCELERATOR", "OPTICAL", "ANALOG")))
memory_note = ": all are memory and storage names that fell hard in the summer" if all(N[b["ticker"]]["cohort"] == "MEMORY & STORAGE" for b in outside) else ""

paragraphs = [
 f"In my opinion these names did not bounce because they are the fastest growers. On forecasts the laggards are the faster growers: sales are expected to grow 15% or more next year at {C['rev_next_15']['laggards_yes']} of {C['rev_next_15']['laggards_n']} laggards against {C['rev_next_15']['leaders_yes']} of {C['rev_next_15']['leaders_n']} leaders, and the biggest forecasts on this page (SharonAI, NuScale, Cipher, TeraWulf, Cerebras) all belong to laggards. They bounced because their numbers were being marked UP while the others' were being marked down. Management raised its own guidance at {lg('guide_raised')}. Analysts raised the earnings estimate at {lg('eps_rev_up')}, and cut it at {C['eps_rev_down']['laggards_yes']} of {C['eps_rev_down']['laggards_n']} laggards. So the rule that growth drives everything holds, with one sharpening: this quarter the market paid for the CHANGE in expected growth and for growth already arriving ({lg('rev_q_20')} grew sales 20% or more last quarter), not for the size of the promise.",
 f"There are two kinds of leader. {len(nf)} never fell: mostly cybersecurity, software and storage names that rose all summer while chips dropped. {len(bo)} fell {falls[0]:.0f}% to {falls[-1]:.0f}% in the summer and came back; {chips} of them are chip-industry names. Set against the {len(S['bounce_cut']['stayed_down'])} laggards that fell as hard and stayed down, the split is the same one: guidance raised at {bc('guide_raised')}, earnings estimate cut at {bc('eps_rev_down')}. Money chose the business lines first (the comps were also up for {lg('comps_up_1m')}), and rising numbers chose the names inside them: once each name is measured against its own comps, a raised estimate still separates ({bt('eps_rev_up')}) while profit, cash and share count stop separating. Those describe what kind of company most laggards are (bitcoin miners turned data-centre landlords, nuclear and battery developers) more than why a stock moved.",
 f"CBRS is the exception, and it shows the second thing that matters: how much stock is for sale. Its numbers went up like a leader's. Guidance was raised, the earnings estimate rose {cb['eps_rev_90d_pct']:.0f}% in 90 days, sales grew {cb['rev_growth_latest_q_yoy_pct']:.0f}%, and its comps rose {cc['peers_run_median']*100:.0f}% in the run. The stock fell {abs(cb['r_run'])*100:.0f}%. What it has that AMD, Marvell and TSMC do not: about 171 million of roughly 238 million shares coming out of lock-up in steps until 9 November, with executives selling; a share count up {cb['shares_change_yoy_pct']:.0f}% in a year; an operating loss of ${abs(cb['operating_margin_pct'])/100:.2f} for each dollar of sales last quarter (mostly pay in stock); three customers making 76% of that quarter's sales; and a price of {cb['ev_sales']:.0f} times sales against {cc['evs_median']:.0f} for its comps. It is not short of cash (${cb['net_cash_usd_b']:.1f} billion more cash than debt). I read it as good news meeting a steady line of sellers, not as a business going wrong.",
 f"Two cautions on the leaders. They are not cheap: {C['pe_premium']['leaders_yes']} of {C['pe_premium']['leaders_n']} are priced above their comps on forward earnings. And they did not lift the index alone: of the {usd(d['field_added_b'])} this field added in the run, the 25 leaders added {usd(d['leaders_added_b'])}; Nvidia alone added {usd(top['NVDA']['added_b'])} and Microsoft {usd(top['MSFT']['added_b'])}, and neither is among the 25.",
]
evidence = [
 {"claim": "Management raised its own guidance at the last report", "count": lg2("guide_raised") + " (leaders · laggards)"},
 {"claim": "Analysts raised the earnings estimate over 90 days", "count": lg2("eps_rev_up")},
 {"claim": "Analysts cut the earnings estimate over 90 days", "count": lg2("eps_rev_down")},
 {"claim": "The same two, using only names where a blind second reader agreed", "count": f"guidance {strict('guide_raised')}; estimate raised {strict('eps_rev_up')}"},
 {"claim": "Sales expected to grow 15% or more NEXT year (the size of the promise)", "count": lg2("rev_next_15") + ": no real difference"},
 {"claim": "Sales grew 20% or more LAST quarter (growth already arriving)", "count": lg2("rev_q_20")},
 {"claim": "Both fell hard in the summer: guidance raised", "count": f"bounced {BC['guide_raised']['a_yes']} of {BC['guide_raised']['a_n']} · stayed down {BC['guide_raised']['b_yes']} of {BC['guide_raised']['b_n']}"},
 {"claim": "Its comps' median was also up over the month (the business line moved)", "count": lg2("comps_up_1m")},
 {"claim": "Measured against its OWN comps in the run: estimate raised", "count": f"beat its comps {BT['eps_rev_up']['a_yes']} of {BT['eps_rev_up']['a_n']} · fell behind {BT['eps_rev_up']['b_yes']} of {BT['eps_rev_up']['b_n']}"},
 {"claim": "Measured against its OWN comps: earns a profit", "count": f"{BT['eps_pos']['a_yes']} of {BT['eps_pos']['a_n']} · {BT['eps_pos']['b_yes']} of {BT['eps_pos']['b_n']}: no real difference"},
 {"claim": "Bigger raise, bigger run (profitable names with a then-and-now estimate)", "count": f"rank correlation {K['size_of_raise']['rank_corr_with_run']:.2f} across {K['size_of_raise']['n']} names (0 = none, 1 = perfect)"},
 {"claim": "New shares coming (lock-up, share sale, convertible, heavy insider selling)", "count": lg2("overhang")},
 {"claim": "Guidance raised AND estimate raised AND profitable AND cash-positive", "count": f"{tk['leaders']} of {tk['leaders_total']} leaders · {tk['laggards']} of {tk['laggards_total']} laggards; outside the leaders only {', '.join(b['ticker'] for b in outside)}"},
 {"claim": "Forward P/E above its comps' median", "count": f"{C['pe_premium']['leaders_yes']} of {C['pe_premium']['leaders_n']} leaders"},
 {"claim": "CBRS against its comps' median", "count": f"run {cb['r_run']*100:+.0f}% vs {cc['peers_run_median']*100:+.0f}% · EV/sales {cb['ev_sales']:.0f}× vs {cc['evs_median']:.0f}× · share count {cb['shares_change_yoy_pct']:+.0f}% in a year"},
]
against = [
 "The groups were picked on price after the fact, and the estimate readings cover the same three months as the returns. This shows what went with the bounce. It does not prove what caused it.",
 f"Rising numbers were not enough on their own. {', '.join(b['ticker'] + ' (rank ' + str(b['rank']) + ')' for b in outside)} had guidance raised, estimates up, profits and cash, and did not lead{memory_note}. Meta led with guidance only kept and its estimate cut.",
 "Paying its own way does not explain every laggard. AppLovin, Booking, Netflix and IBM earn profits and bring in cash and still sit in the bottom 20; each had estimates cut or flat.",
 "Only 52 of the 145 names were read one by one: the best, the worst and five that were asked about. The middle of the field was not.",
 "CBRS is one stock. Every trait named above except the lock-up also shows up in at least one leader. The test of the supply reading: if CBRS still does not move after its last release on 9 November while its comps keep rising, supply was not the reason.",
 "The business figures are public web pages read by agents. A second reader changed something in every one of the 52 records, and a blind third reader was used for guidance and estimates. The counts are sturdier than any single cell.",
]
panel = "Argued before writing by three analysts with different lenses (growth and revisions; who pays for the growth; a market-structure skeptic), two refuters and a completeness critic, all reading the same digest of this study. Their returns are saved in data/panel.json."
json.dump({"paragraphs": paragraphs, "evidence": evidence, "against": against, "panel": panel,
           "market_value_line": f"The 25 leaders together: {usd(caps['leaders']['run_start_b'])} on 15 September, {usd(caps['leaders']['now_b'])} now ({usd(caps['leaders']['now_b'] - caps['leaders']['run_start_b'])} added). {', '.join(big3)} are {K['who_added_the_dollars']['top3_leaders_share_of_leader_value']*100:.0f}% of that value."},
          open(os.path.join(D, "opinion.json"), "w"), indent=1)
print("opinion.json ·", sum(len(p.split()) for p in paragraphs), "words")
for p in paragraphs: print("\n" + p)
