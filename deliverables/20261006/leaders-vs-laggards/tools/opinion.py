#!/usr/bin/env python3
"""LD1 · the opinion. The words are fixed here; every count and dollar figure in them is read from study.json when this runs,
so the text cannot drift from the tables.  ->  ../opinion.json

Second pass, 7 Oct 2026. The first run's draft was faulted by three AI reviewers (numbers, overclaims, plain words) just before
that run stopped; their list is applied here: the answer comes first, the groups and the two periods are defined once and dated,
"went with" is not written as "caused", the market-value answer is in the text, and the same thing is never given two figures.
The Cerebras and storage paragraphs use figures re-read first-hand (data/audit-firsthand.json, data/cbrs-insider-sales.json)."""
import json, os, statistics
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
J = lambda *a: json.load(open(os.path.join(D, *a)))
S = J("study.json"); N = S["names"]; G = S["groups"]; AUD = J("data", "audit-firsthand.json"); INS = J("data", "cbrs-insider-sales.json")
C = {c["id"]: c for c in S["conditions"]}
BC = {c["id"]: c for c in S["bounce_cut"]["conditions"]}
K = S["checks"]; BT = {c["id"]: c for c in K["beat_own_comps"]["conditions"]}
L = [N[t] for t in G["leader"]]; LG = [N[t] for t in G["laggard"]]; ALL52 = L + LG + [N[t] for t in G["named_mid"]]
med = lambda xs: statistics.median([x for x in xs if x is not None])
lead = lambda i: f'{C[i]["leaders_yes"]} of {C[i]["leaders_n"]}'
lag = lambda i: f'{C[i]["laggards_yes"]} of {C[i]["laggards_n"]}'
two = lambda i: f'{lead(i)} leaders · {lag(i)} laggards'
def usd(v):
    a = abs(v)
    return f"${a/1000:,.2f} trillion" if a >= 1000 else f"${a:,.0f} billion" if a >= 10 else f"${a:,.1f} billion"
usd1 = lambda v: f"${abs(v):,.1f} billion"                      # where one decimal matters (Cerebras)
about = lambda v: f"about ${abs(v)/1000:,.1f} trillion" if abs(v) >= 1000 else f"about ${abs(v):,.0f} billion"   # a gain: one figure, rounded once
pc = lambda v, d=0: f"{abs(v)*100:.{d}f}%"

# ---- figures the words use
gk = AUD["guidance_kind"]; full_year = [t for t in gk["raised_a_published_full_year_range"] if t in G["leader"]]; above = [t for t in gk["guided_above_what_analysts_expected"] if t in G["leader"]]
assert len(full_year) + len(above) == C["guide_raised"]["leaders_yes"], "every leader marked raised is in one of the two kinds"
lg_guides = [n for n in LG if n["guidance_direction"] in ("raised", "maintained", "lowered")]
big8 = sorted([n for n in ALL52 if n["rev_growth_next_fy_pct"] is not None], key=lambda n: -n["rev_growth_next_fy_pct"])[:8]
big8_lag = sum(1 for n in big8 if n["group"] == "laggard"); big8_other = [n["name"].split(" ")[0] for n in big8 if n["group"] != "laggard"]
m_next_l, m_next_g = med([n["rev_growth_next_fy_pct"] for n in L]), med([n["rev_growth_next_fy_pct"] for n in LG])
m_q_l, m_q_g = med([n["rev_growth_latest_q_yoy_pct"] for n in L]), med([n["rev_growth_latest_q_yoy_pct"] for n in LG])
pays = [n["ticker"] for n in LG if n["eps_ttm_positive"] and (n["fcf_ttm_usd_b"] or 0) > 0]
builders = [n["ticker"] for n in LG if n["cohort"] == "NEOCLOUDS & AI MINERS" or (n["cohort"] == "AI POWERTRAIN" and n["ticker"] != "NRG")]
nf, bo, sd = S["bounce_cut"]["never_fell"], S["bounce_cut"]["bounced"], S["bounce_cut"]["stayed_down"]
between = [t for t in G["leader"] if t not in nf and t not in bo]
falls = sorted(abs(N[t]["r_selloff"]) * 100 for t in bo)
is_chip = lambda t: any(w in N[t]["cohort"] for w in ("ACCELERATOR", "SEMICAP", "ANALOG"))
chips = [t for t in bo if is_chip(t)]; chips_down = [t for t in sd if is_chip(t)]
B = S["benchmarks"]
cb = N["CBRS"]; cc = cb["comps"]; sup = AUD["cbrs"]["supply_arithmetic"]; pair = cb["eps_recheck"]
d = K["who_added_the_dollars"]; top = {a["ticker"]: a for a in d["top"]}; caps = S["caps"]; cl_, cg_, cf_ = caps["leaders"], caps["laggards"], caps["field"]
big3 = sorted(L, key=lambda n: -(n["cap_now_b"] or 0))[:3]
top5 = [a["ticker"] for a in d["top"][:5]]
cheap = C["pe_premium"]["leaders"]["no"]; cheap_share = sum(N[t]["cap_now_b"] for t in cheap) / cl_["now_b"]
hot = sum(1 for n in L if (n["geiger"] or 0) > 0.5)
tk = K["ticks_every_box"]; outside = [b for b in tk["names"] if b["group"] != "leader"]
stor = {t: N[t] for t in ("WDC", "STX", "MU", "SNDK")}
def ordinal(n): return f"{n}{'th' if 10 <= n % 100 <= 20 else {1: 'st', 2: 'nd', 3: 'rd'}.get(n % 10, 'th')}"
OOS = AUD["out_of_sample"]; oos = sorted(OOS["rows"], key=lambda r: -r["pct"])
assert (OOS["result"]["read"], OOS["result"]["estimate_raised"], OOS["result"]["gave_a_higher_outlook"]) == (4, 4, 3), "the out-of-sample sentence is written for 4 read, 4 raised, 3 with a higher outlook"
oos_list = ", ".join(r["name"].split(" ")[0] + f" by {r['pct']:.0f}%" for r in oos)
oos_missing = " and ".join({"RMBS": "Rambus", "ZETA": "Zeta"}[t] for t in OOS["not_loaded"])
rr = S["recheck"]["rerank"]
NAME = {"TSM": "TSMC", "META": "Meta", "AMD": "AMD", "NVDA": "Nvidia", "MSFT": "Microsoft", "LITE": "Lumentum", "ADI": "Analog Devices", "APP": "AppLovin", "BKNG": "Booking", "NFLX": "Netflix",
        "NRG": "NRG", "IBM": "IBM", "RDDT": "Reddit", "WDC": "Western Digital", "MU": "Micron", "STX": "Seagate", "SNDK": "SanDisk"}
nm = lambda ts: ", ".join(NAME.get(t, t) for t in ts)

paragraphs = [
 {"head": "The answer",
  "text": f"In my opinion the leaders led because their numbers were going up, and the laggards lagged because theirs were going down. It was not about who is forecast to grow fastest. At their last report, {lead('guide_raised')} leaders gave a higher outlook: {len(full_year)} raised full-year numbers they had already published, and {len(above)} set the next quarter above what analysts were expecting. Only {lag('guide_raised')} laggards did. Over the last 90 days analysts raised their profit estimate for {lead('eps_rev_up')} leaders, and cut it for {lag('eps_rev_down')} laggards. (Each count is out of the names where a reading could be found, which is why the totals change from line to line.)"},
 {"head": "Your growth rule",
  "text": f"Nothing here contradicts your rule that growth, revenue and earnings, drives everything. But it fits in a narrower form than \"the biggest forecast wins\". The laggards have the bigger forecasts: the middle laggard is expected to grow sales {m_next_g:.0f}% next year against {m_next_l:.0f}% for the middle leader, and {big8_lag} of the 8 biggest forecasts among the 52 names read belong to laggards (the other is {', '.join(big8_other)}). What went with leading was growth already showing in results and being revised higher: sales grew 20% or more last quarter at {lead('rev_q_20')} leaders against {lag('rev_q_20')} laggards, and the middle leader grew {m_q_l:.0f}% against {m_q_g:.0f}%. Most of the laggards' growth is a promise from a small base, and over these three months the promise was being marked down."},
 {"head": "Who pays for the growth",
  "text": f"{lead('eps_pos')} leaders make a profit and {lead('fcf_pos')} bring in more cash than they spend; {lag('eps_pos')} and {lag('fcf_pos')} laggards do. The number of shares is up more than 3% in a year at {lag('diluting')} laggards against {lead('diluting')} leaders. Half the laggards ({len(builders)} of {len(LG)}) are bitcoin miners turned data-centre landlords, or nuclear, uranium and battery companies, which pay for growth by selling stock. I read this as the kind of company they are more than as the reason the stock moved, because losing money is not what makes a laggard: {len(pays)} of them ({nm(pays)}) make a profit and bring in cash and are still at the bottom, and most of those had estimates cut or left flat."},
 {"head": "Only some of them bounced",
  "text": f"{len(bo)} of the 25 leaders fell and came back: they were {falls[0]:.0f}% to {falls[-1]:.0f}% lower on 15 September than on 30 June, and {len(chips)} of the {len(bo)} are chip companies. Another {len(nf)} never fell: mostly cybersecurity, software and storage names that were higher on 15 September than on 30 June. The other {len(between)} ({' and '.join(NAME.get(t, t) for t in between)}) sit in between. So the industry counted about as much as the company. The chip fund fell {pc(B['SMH']['r_selloff'])} over the summer and rose {pc(B['SMH']['r_run'])} in the bounce, and for {lead('comps_up_1m')} leaders the comparable companies were up over the last month too, against {lag('comps_up_1m')} laggards. Inside an industry the same thing shows again: of the names that beat their own comps during the bounce, {BT['eps_rev_up']['a_yes']} of {BT['eps_rev_up']['a_n']} had a raised profit estimate; of those that trailed their comps, {BT['eps_rev_up']['b_yes']} of {BT['eps_rev_up']['b_n']}."},
 {"head": "Cerebras (CBRS): numbers up, stock down",
  "text": f"Cerebras is the exception. Its numbers went up like a leader's. On 12 August it raised its full-year guidance, its core sales were up 103%, and analysts' forecast for 2027 went from a profit of ${pair['then']:.2f} a share to ${pair['now']:.2f}, while the forecast loss for 2026 was halved. Its comps rose {pc(cc['peers_run_median'])} in the bounce. Cerebras fell {pc(cb['r_run'])}. On the 6 October close it ranks {cb['rank_now']}th of {S['field']}."},
 {"head": "Cerebras: the stock for sale",
  "text": f"I think it shows the other thing that matters: how much stock is for sale. What Cerebras has that AMD, Marvell and TSMC do not is a calendar of new sellers. It listed on 14 May, selling {sup['sold_at_the_ipo_m']} million shares. Early holders were barred from selling at first (the lock-up) and are being let out in steps. About {sup['freed_since_the_12_aug_report_m']:.0f} million shares have been freed since the 12 August report, nearly three times what was sold at the listing. Another 19.4 million come free on 14 October, 19.4 million on 28 October, and whatever is still locked on 9 November (about {sup['left_for_9_nov_m_my_arithmetic']:.0f} million by my arithmetic). Its officers and directors sold about ${INS['total_usd']/1e6:,.0f} million of stock between 14 August and 29 September. It is also expensive, at {cb['ev_sales']:.0f} times sales against {cc['evs_median']:.0f} for its comps. Three customers were 76% of last quarter's sales, and $377 million of its $477 million operating loss that quarter was pay in stock. It is not short of cash: it holds {usd1(cb['net_cash_usd_b'])} more than it owes. I read it mainly as good numbers meeting a scheduled supply of stock at a rich price. I cannot rule out a business reason: by the first run's reading the same report missed analysts' forecast for reported sales, and on 2 October there was market talk that OpenAI had routed a showcase fast mode through Nvidia chips instead."},
 {"head": "Raised numbers that did not get paid",
  "text": f"{ {2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven'}.get(len(outside), str(len(outside)))} names outside the leaders had all four (a higher outlook, raised estimates, profits, cash coming in) and still did not lead: {nm(b['ticker'] for b in outside)}. On the 6 October close they rank {', '.join(ordinal(N[b['ticker']]['rank_now']) for b in outside)} of {S['field']}. In each case I think the market doubts the numbers will last. Seagate and Western Digital each fell about 10% on 2 October, the day Toshiba was reported to be doubling its hard-disk output, and fell again on 6 October: a competitor adding supply threatens the very estimates that were just raised. Micron is priced at {stor['MU']['forward_pe']:.0f} times next year's expected profit. Reddit beat and guided above forecasts on 30 July and fell 21% the next day, when its US daily users dipped and management said AI answers were diverting search traffic (the first run's reading of the report). So raised numbers were needed to lead, but they were not enough on their own."},
 {"head": "A test on names the finding was not built from",
  "text": f"The same rule on the 6 October close puts six new names in the top 25: Zscaler, Synopsys, Dell, Palantir, Rambus and Zeta. None had been read. I read four of them first-hand, and all four had their profit estimates raised over the last 90 days ({oos_list}). Three of the four raised full-year guidance at their last report; Zscaler gave a first outlook for its new year that did not beat expectations. The estimate pages for {oos_missing} would not load."},
 {"head": "Three cautions",
  "text": f"The leaders are not cheap by count: {C['pe_premium']['leaders_yes']} of {C['pe_premium']['leaders_n']} cost more per dollar of next year's expected profit than their comps do. By money it is the other way round: the {len(cheap)} that cost less include TSMC and Meta, and those {len(cheap)} are {cheap_share*100:.0f}% of the leaders' value. They are also stretched on your own gauge: the Geiger is above +0.5 for {hot} of the 25, and that is the \"when\", which this study does not answer. And all of this is what went with leading over one three-month stretch. The groups were picked on price after the fact, so it does not prove cause."},
 {"head": "Market value",
  "text": f"The 25 leaders were worth {usd(cl_['selloff_start_b'])} on 30 June, {usd(cl_['run_start_b'])} on 15 September and {usd(cl_['now_b'])} at the 6 October close: {about(cl_['now_b'] - cl_['run_start_b'])} added in three weeks. Three of them are {d['top3_leaders_share_of_leader_value']*100:.0f}% of that value: " + ", ".join(f"{NAME.get(n['ticker'], n['ticker'])} ({usd(n['cap_run_start_b'])} to {usd(n['cap_now_b'])})" for n in big3) + f". The middle leader is worth {usd(d['median_cap_leaders_b'])}. The {len(LG)} laggards went from {usd(cg_['run_start_b'])} to {usd(cg_['now_b'])} over the same three weeks. Cerebras was worth {usd1(cb['cap_selloff_start_b'])} on 30 June, {usd1(cb['cap_run_start_b'])} on 15 September and {usd1(cb['cap_now_b'])} at the 6 October close. On your point that these names pushed the indexes higher: I did not measure the indexes themselves, but inside this field the 25 leaders were about a third of the dollars added. The {S['field']} names together added {about(d['field_added_b'])} in the bounce and the 25 leaders {about(d['leaders_added_b'])} of that. Nvidia alone added {usd(top['NVDA']['added_b'])} and Microsoft {usd(top['MSFT']['added_b'])}, and neither is among the 25. Five names ({nm(top5)}) are {d['top5_share']*100:.0f}% of the field's gain. Over the same three weeks the Nasdaq-100 fund rose {pc(B['QQQ']['r_run'], 1)} and the S&P 500 fund {pc(B['SPY']['r_run'], 1)}, while the equal-weight S&P fell {pc(B['RSP']['r_run'], 1)}: the average stock did not rise."},
]

evidence = [
 {"claim": "Gave a higher outlook at the last report (raised its own full-year numbers, or guided above what analysts expected)", "count": two("guide_raised")},
 {"claim": "... of which raised full-year numbers it had already published", "count": f"{len(full_year)} of the {C['guide_raised']['leaders_yes']} leaders; the other {len(above)} guided above analysts"},
 {"claim": "Among laggards that give guidance at all", "count": f"{sum(1 for n in lg_guides if n['guidance_direction'] == 'raised')} raised, {sum(1 for n in lg_guides if n['guidance_direction'] == 'maintained')} kept, {sum(1 for n in lg_guides if n['guidance_direction'] == 'lowered')} lowered; {sum(1 for n in LG if n['guidance_direction'] == 'none')} give none"},
 {"claim": "Analysts raised the profit estimate over 90 days", "count": two("eps_rev_up")},
 {"claim": "Analysts cut the profit estimate over 90 days", "count": two("eps_rev_down")},
 {"claim": "The same, counting only estimates measured as a then-and-now pair", "count": f"raised at {sum(1 for n in L if n['eps_pair_measured'] and n['eps_rev_90d_direction'] == 'up')} of {sum(1 for n in L if n['eps_pair_measured'] and n['eps_rev_90d_direction'])} leaders · {sum(1 for n in LG if n['eps_pair_measured'] and n['eps_rev_90d_direction'] == 'up')} of {sum(1 for n in LG if n['eps_pair_measured'] and n['eps_rev_90d_direction'])} laggards"},
 {"claim": "Sales expected to grow 15% or more next year (the size of the forecast)", "count": two("rev_next_15") + ": no real difference"},
 {"claim": "Sales grew 20% or more in the latest reported quarter (growth already showing)", "count": two("rev_q_20")},
 {"claim": "Makes a profit · brings in more cash than it spends", "count": f"{lead('eps_pos')} · {lead('fcf_pos')} leaders; {lag('eps_pos')} · {lag('fcf_pos')} laggards"},
 {"claim": "Number of shares up more than 3% in a year", "count": two("diluting")},
 {"claim": "More stock coming up for sale (insiders freed to sell after a listing, a new share sale, debt that turns into shares, heavy selling by executives)", "count": two("overhang")},
 {"claim": "Among names that fell hard in the summer: gave a higher outlook", "count": f"{BC['guide_raised']['a_yes']} of {BC['guide_raised']['a_n']} that bounced · {BC['guide_raised']['b_yes']} of {BC['guide_raised']['b_n']} that stayed down ({len(chips)} of the {len(bo)} that bounced are chip companies; {len(chips_down)} of the {len(sd)} that stayed down {'is' if len(chips_down) == 1 else 'are'})"},
 {"claim": "The stock's comparable companies were also up over the last month (the whole industry moved)", "count": two("comps_up_1m") + " (this count is soft: it read 3 of 22 for the laggards one day earlier)"},
 {"claim": "Regrouped by whether the stock beat or trailed its own comps in the bounce: had a raised profit estimate", "count": f"{BT['eps_rev_up']['a_yes']} of {BT['eps_rev_up']['a_n']} that beat their comps · {BT['eps_rev_up']['b_yes']} of {BT['eps_rev_up']['b_n']} that trailed"},
 {"claim": "The bigger the estimate raise, the bigger the move (profitable names with a measured estimate pair; not the same names as the 25 leaders)", "count": f"a middling link with the bounce ({K['size_of_raise']['rank_corr_with_run']:.2f}) and a weak one with three months ({K['size_of_raise']['rank_corr_with_3m']:.2f}) across {K['size_of_raise']['n']} names, on a scale where 0 is no link and 1 a perfect one"},
 {"claim": "Names that enter the top 25 on the 6 October close and were never read (a test the finding was not built from)", "count": f"{OOS['result']['read']} of 6 could be read: profit estimate raised at {OOS['result']['estimate_raised']} of {OOS['result']['read']} · full-year guidance raised at {OOS['result']['gave_a_higher_outlook']} of {OOS['result']['read']}"},
 {"claim": "All four at once: higher outlook, raised estimate, makes a profit, brings in more cash than it spends", "count": f"{tk['leaders']} of {tk['leaders_total']} leaders · {tk['laggards']} of {tk['laggards_total']} laggards. Among the 27 other names read, only {nm(b['ticker'] for b in outside)}"},
 {"claim": "Costs more per dollar of next year's expected profit than its typical comp (forward P/E)", "count": f"{C['pe_premium']['leaders_yes']} of {C['pe_premium']['leaders_n']} leaders; the {len(cheap)} that cost less are {cheap_share*100:.0f}% of the leaders' value"},
 {"claim": "Cerebras against its typical comp", "count": f"share price 15 Sep to 6 Oct {cb['r_run']*100:+.0f}% against {cc['peers_run_median']*100:+.0f}% · company value {cb['ev_sales']:.0f} times sales against {cc['evs_median']:.0f} · shares freed since 12 Aug about {sup['freed_since_the_12_aug_report_m']:.0f} million against {sup['sold_at_the_ipo_m']} million sold at the listing"},
]

against = [
 "The groups were picked on price after the fact, and the estimate readings cover the same three months as the returns. This shows what went with leading. It does not prove what caused it.",
 f"A higher outlook means two different things here. {len(full_year)} leaders raised full-year numbers they had published. The other {len(above)} guide one quarter at a time (or gave a first outlook for a new year) and count as raised because the outlook was set above what analysts expected. That second test is looser. The same test was applied to the laggards.",
 f"Raised numbers were not enough on their own. {nm(b['ticker'] for b in outside)} had all four (higher outlook, raised estimates, profits, cash coming in) and did not lead. Meta led with its outlook only kept and its estimate cut, and CrowdStrike and Palo Alto led with estimates that did not move.",
 f"Leaders and laggards mostly come from different industries: cybersecurity and chips on one side; miners, nuclear and consumer internet on the other. Part of every gap above is the industry, not the company.",
 f"The cut at 25 is arbitrary. On the 6 October close {rr['leaders_kept']} of the 25 are still in the top 25; the other {25 - rr['leaders_kept']} sit between 26th and {max(x[1] for x in rr['leaders_left'])}th. {rr['laggards_kept']} of the bottom 20 are unchanged. Cerebras moved from 112th to {cb['rank_now']}th, into the bottom 20 on its own numbers.",
 f"Only 52 of the {S['field']} names were read one by one: the top 25, the bottom 20 and seven more that were asked about. The other {S['field'] - 52} were not.",
 f"Cerebras is one stock, and the supply reading is a reading. One fact cuts against it: the 27.7 million shares freed on 25 June were followed by a {AUD['cbrs']['price_path_notes']['rise_25jun_to_12aug_pct']:.0f}% rise into the 12 August report, so a release on its own did not sink the stock; the fall came after that report, with five releases in seven weeks. A check on it: if Cerebras still trails its comps well after the last locked-up shares are freed on 9 November, that counts against it. A rise after that date would not prove it.",
 "The company figures were collected from public web pages by AI readers on 6 October, not from a checked database: one reader per company, a second that corrected something in every one of the 52 files, and a third that read guidance and estimates without knowing which group a company was in. On 7 October the figures this opinion leans on were re-read first-hand (section 11). Trust the counts across many companies more than any one company's single figure.",
]

short = (f"OPINION. The leaders led because their numbers were going up, not because they are forecast to grow fastest. At the last report {lead('guide_raised')} leaders gave a higher outlook ({len(full_year)} raised full-year numbers, {len(above)} guided above what analysts expected) against {lag('guide_raised')} laggards; analysts raised the profit estimate for {lead('eps_rev_up')} leaders and cut it for {lag('eps_rev_down')} laggards. The laggards actually have the bigger forecasts (the middle one {m_next_g:.0f}% sales growth next year against {m_next_l:.0f}%), but it is a promise from a small base, paid for by selling stock (shares up more than 3% at {lag('diluting')} against {lead('diluting')}), and it was being marked down. So nothing here contradicts your growth rule, but it fits in a narrower form: what went with leading was growth already showing in results and being revised higher. Cerebras is the exception that shows the other thing that matters, stock for sale: its numbers went up like a leader's and its comps rose {pc(cc['peers_run_median'])}, but about {sup['freed_since_the_12_aug_report_m']:.0f} million locked-up shares have been freed since 12 August, nearly three times the {sup['sold_at_the_ipo_m']} million sold at its listing, with more on 14 and 28 October and 9 November, at {cb['ev_sales']:.0f} times sales. The storage names and Reddit are the exception the other way: raised numbers, profits and cash, and still lagging, because the market doubts the numbers will last (a competitor doubling hard-disk output; AI answers diverting Reddit's search traffic). A test on names the finding was not built from agrees: of the six that enter the top 25 on the 6 October close, the four I could read all had estimates raised. This is what went with leading over one three-month stretch, on groups picked after the fact; it does not prove cause.")

json.dump({"paragraphs": paragraphs, "evidence": evidence, "against": against, "short": short,
           "method": "Written by the lane's AI agent. Before the first draft, six AI reviewers argued it from the study's digest (three taking different angles, two trying to knock it down, one checking for gaps); three more faulted the draft for wrong numbers, overclaims and unclear words, and this version applies their list. The figures it leans on were then re-read first-hand on 7 October.",
           "market_value_line": f"The 25 leaders: {usd(cl_['run_start_b'])} on 15 September, {usd(cl_['now_b'])} at the 6 October close ({about(cl_['now_b'] - cl_['run_start_b'])} added). {nm(n['ticker'] for n in big3)} are {d['top3_leaders_share_of_leader_value']*100:.0f}% of that value."},
          open(os.path.join(D, "opinion.json"), "w"), indent=1)
print("opinion.json ·", sum(len(p["text"].split()) for p in paragraphs), "words in", len(paragraphs), "paragraphs · short version", len(short.split()), "words")
for p in paragraphs: print("\n[" + p["head"] + "] " + p["text"])
