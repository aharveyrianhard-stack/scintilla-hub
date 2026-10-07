<details class="sc-pagespecs"><summary>PAGE SPECS</summary>

<h4>WHAT THIS PAGE SHOWS</h4>
<p>Your four names first (CoreWeave, Nebius, IREN and Bloom), each with its score, its seven parts and the numbers behind them. Then the whole shelf ranked. Then one picture per question you asked: gross margin quarter by quarter, the build-out against the cash, dilution, how far apart the analysts stand. Then the test of the model on four past Octobers. Then the knockout run again with a debt reading for every company, and who moved.</p>

<h4>THE METHOD, IN PLAIN WORDS</h4>
<p><b>Who is on the shelf.</b> A company that lost money over its last four reported quarters (at the operating line or at the bottom line), with no profit expected by the analysts for the fiscal year in progress, and sales expected to grow {{GATE}}% or more over the next twelve months. Or a company with next to no sales yet (under 1% of its market value), which the knockout already sets aside. That is {{ON_SHELF}} of the {{N_READ}} companies read: {{N_A}} with real sales and {{N_V}} with next to none. Bloom is profitable, so it is not on the shelf; it is measured the same way and shown beside it because you set it against Nebius and IREN.</p>
<p><b>Who is not, and why.</b> {{N_SLOW}} lose money but grow under {{GATE}}% (Boeing, Snap, Moderna): loss-makers, not high-growth plays. {{N_EXPECTED}} lose money on their filed figures while the analysts expect a profit this year on their own footing (CrowdStrike, Snowflake): the knockout's comps can price those. {{N_LOST}} had steady profits and lost them (Intel, Ford). Each is listed at the foot of the page with its reason and the same readings, measured the same way; none takes a place in the rank.</p>
<p><b>What is measured for each name.</b></p>
<ul>
<li><b>Sales in dollars</b>: the last twelve months, the next twelve, and the twelve after. Every company is put on the same twelve-month window, whatever month its fiscal year ends. IREN's year ends in June and CoreWeave's in December, so their "next year" figures are six months apart until that is done.</li>
<li><b>Growth</b>: next year's sales against the twelve months to today, and the year after against next year's. The twelve months to today are part reported and part the analysts' figure for the quarters not yet reported; the last four quarters actually reported are shown beside them.</li>
<li><b>EV ÷ next year's sales</b>: see the next heading.</li>
<li><b>Gross margin</b>: what is left of each dollar of sales after the direct cost of delivering it, quarter by quarter, and whether it rose or fell over a year.</li>
<li><b>Cash and short-term investments</b>, and <b>how long they last</b>: the cash going out each quarter (operations plus the build-out), at the faster of the last quarter's pace and the last year's average.</li>
<li><b>The build-out planned, against the cash.</b> Planned spending is the figure the company announced on its newest call where it gave one ({{N_ANN}} names, each quoted on the page), otherwise the pace it is already spending at. Add the debt due inside twelve months. Set against that the cash it holds and the cash its operations bring in. What is left is "still to find". Shown as a share of the company's market value, it is the dilution if all of it were raised in new shares at today's price. This is your rule of 2 October: "if projected capex isn't covered by cash, we assume there's going to be new dilution."</li>
<li><b>Who paid so far</b>: over the last four quarters, how much of the build-out came from operations, new debt, new shares, other financing (customer prepayments and equipment financing land here) and cash on hand. Leases taken on are shown beside it, because a lease is a debt that never passes through the cash account.</li>
<li><b>Dilution</b>: the share count against one and two years ago; the shares still to come from convertible notes, options, warrants and stock awards as a share of today's count; convertible notes outstanding in dollars where the company's filing tags them.</li>
<li><b>Debt</b>: net debt (everything owed, leases included, less cash and short-term investments); against EBITDA where there is one; EBITDA against the interest bill; and against next year's sales, which is the reading used for a pre-profit company.</li>
<li><b>How far apart the analysts stand</b>: how many of them there are, and the gap between the highest and lowest forecast as a share of the average.</li>
</ul>
<p><b>One score.</b> Seven parts, each read from 0 to 100, weighed: growth {{W_GROWTH}}, price {{W_PRICE}}, margin {{W_MARGIN}}, cash and capex {{W_MONEY}}, dilution {{W_DILUTION}}, debt {{W_DEBT}}, estimates {{W_QUALITY}}. Growth is the largest, as you set on 6 October. A part is read against the shelf's own middle half, the way the knockout reads a branch: 0 at the shelf's bottom quarter, 100 at its top quarter. Three readings work differently because "none" is simply good: no gap to fund, no net debt and no cash going out each score 100.</p>
<p><b>Growth counts in proportion to the dollars.</b> A growth rate is counted in full when it lands on the shelf's largest next-year sales and at half on its smallest. That is how "revenue in dollar figures matters, not only growth percentages" enters the score: a company doubling to $20M is not credited like one doubling to $20B.</p>
<p><b>Promise and footing.</b> The score is the sum of two halves, shown beside it everywhere. Promise is growth, price and margin: what the company may become and what you pay for it. Footing is cash, dilution, debt and estimates: what it stands on while it gets there.</p>
<p><b>Fewer than {{THIN}} analysts: listed, not ranked.</b> Growth and price rest entirely on the analysts' numbers. Where fewer than four forecast the sales, the name is shown with everything that was filed and takes no place in the rank ({{N_THIN}} names{{NOEST_WORDS}}). Your words on 2 October: "if three analysts imply 26% down, we shouldn't have discussed it."</p>

<h4>WHAT "EV ÷ NEXT YEAR'S SALES" MEANS</h4>
<p>It is what the whole company costs — every share at today's price, plus everything it owes, less the cash it holds — for each dollar of sales the analysts expect over the next twelve months. IREN at {{IREN_EV}} means: buy all of IREN, take on its debt, keep its cash, and you have paid {{IREN_EV_PLAIN}} for every $1 of next year's expected sales. Lower is cheaper. It says nothing about whether those sales will turn a profit.</p>

<h4>WHY IREN READS AS SCATTERED</h4>
<p>On next year's sales it is not. For its year to June 2027, {{IREN_Y1_N}} analysts sit between {{IREN_Y1_LOW}} and {{IREN_Y1_HIGH}}, a range of {{IREN_Y1_SPREAD}} of the average. Two things are scattered. Profit a share for that same year runs from {{IREN_Y1_EPS_LOW}} to {{IREN_Y1_EPS_HIGH}} across {{IREN_Y1_N_EPS}} analysts, on a share that closed at {{IREN_PRICE}}; forecasts that far apart are not measuring the same thing, and the two ends are more likely a data error at the vendor or a one-off accounting item than a forecast. And one year further out, to June 2028, the sales range opens to {{IREN_Y2_LOW}}–{{IREN_Y2_HIGH}} ({{IREN_Y2_SPREAD}} of the average). So: the near sales number can be leaned on; the profit number and the out-years cannot yet. The panel "IREN, year by year" shows every figure.</p>

<h4>THE FOUR, AGAINST THE FIGURES YOU WERE FIRST GIVEN</h4>
<p>The first figures used each company's own fiscal year and the vendor's stored share counts. Two things move them here.</p>
<ul>
<li><b>Nebius costs more than "about 5×".</b> The vendor's profile still carries 240M shares. Nebius's own last quarter averaged {{NBIS_SH}} after this year's share sales, which makes its shares worth {{NBIS_MV}} at the 6 October close. On that count the whole company is {{NBIS_EV}} next year's sales.</li>
<li><b>CoreWeave's debt against EBITDA is {{CRWV_ND_EBITDA}}, not 17.7×.</b> The 17.7 used the vendor's EBITDA field ({{CRWV_EBITDA_V}} over four quarters), which carries paper gains and losses below the operating line. Here EBITDA is operating profit plus depreciation: {{CRWV_EBITDA}}. Either way it is far past the level the rating agencies call highly leveraged (5×). Net debt is {{CRWV_ND}}, of which {{CRWV_LEASES}} is lease obligations.</li>
<li><b>IREN and CoreWeave on one window.</b> The table under the four cards shows both footings side by side.</li>
</ul>

<h4>THE TEST ON HISTORY, AND WHAT IT DOES AND DOES NOT SAY</h4>
<p>For each of four Octobers (2021 to 2024) the test takes the companies in today's universe that were pre-profit and growing then, measures the model's parts on the figures that had been filed by that day, and asks whether each part ranked the later winners first: {{H_N}} company-Octobers in all.</p>
<p><b>What it found.</b> No part reliably told the winners from the losers. Price was the only one pointing the right way in most years ({{H_PRICE_IN}} Octobers, a weak {{H_PRICE_AVG}}). Growth pointed the wrong way at the 2021 top ({{H_GROWTH_2021}}) and was close to no help in the three Octobers after ({{H_GROWTH_AVG}} over all four). The cash, dilution and debt readings were right going into the 2022 fall and wrong coming out of it: from October 2023 and 2024 the companies with the biggest gaps to fund and the most new shares tended to rise the most. The score's top third beat its bottom third in {{H_MODEL_IN}} Octobers. In October 2023 this model would have placed IREN {{H_IREN_PLACE}}, and IREN's price went on to move {{H_IREN_R2}} in two years.</p>
<p><b>Why that is weaker than it looks.</b> The test can only see companies still listed and still on the Hub. The pre-profit companies of 2021 to 2024 that fell away or ran out of money are not here, and the ones that are here are largely here because they worked. That flatters risk: every "the riskiest did best" reading is inflated by it. Estimates as they stood on a past day are not on file either, so growth and price were tested on trailing figures, and again on the sales each company went on to report (the "with foresight" table).</p>
<p><b>How to use the score, then.</b> As a reading of what a name stands on and what it would need, not as a forecast of which one goes up most. The weights are a judgment built on what you asked the model to consider, with growth the largest by your rule. They were not fitted to this test, and the test did not confirm them.</p>

<h4>DEBT IN THE KNOCKOUT: THE RULE</h4>
<p>Every company gets a debt load from 0 to 100. For a company with steady profits it is the heavier of two readings, on the bands the rating agencies use (S&amp;P Global Ratings, Corporate Methodology, cash flow and leverage): net debt against EBITDA, 0 up to 3× and 100 at 5× ("highly leveraged"); and EBITDA against the interest bill, 0 at 6× or better and 100 at 2× or worse. For a pre-profit company it is net debt against next year's sales, 0 up to 1× and 100 at 1.67×, which are the same two bands for a business earning a third of its sales. Banks, brokers, asset managers and insurers are not read ({{NOT_READ_BANKS}} of the {{JUDGED}} companies judged): debt is their raw material.{{NOT_READ_OTHER_WORDS}}</p>
<p><b>Where it bites.</b> Only in the debate. Among a branch's three finalists a full load takes {{MAXCUT}} points off the score before they are put in order: the weight of cash yield or of revisions in round 2. And when two names are even (within 2 points, on fundamentals or among the finalists after that cut), the lighter load goes first; the knockout's "more washed out goes first" stays as the last resort. The load never fails a name that passed round 2, except at such a tie on the pass line.</p>
<p><b>Its neighbours.</b> The rule touches four of the knockout's own: the tie band, the upper-half pass, the three finalists, and the washed-out tie-break. With every load set to nothing the run returns the knockout's order and finalists exactly, in all {{N_BRANCHES}} branches; a test holds that.</p>
<p><b>Who moved.</b> {{N_CH}} of {{CH_SLOTS}} champions: {{CH_LIST}}. In {{N_FIN}} more branches the three finalists change ({{FIN_LIST}}), and {{N_TIES}} ties on the pass line are settled by debt ({{TIE_LIST}}). CoreWeave carries the full load but had already failed round 2 on fundamentals in its branch, so the debt reading has nothing left to move.</p>

<h4>WHERE EACH NUMBER COMES FROM</h4>
<ul>
<li><b>Prices</b>: {{PRICE_IS}} — the same capture the knockout ran on.</li>
<li><b>Quarterly statements and analysts' estimates</b> (with their highs and lows): the vendor (FMP), read once on 7 October at 13:37 UTC for {{N_READ}} companies, 32 quarters each. Growth computed from them matches the knockout's own figure to within 2 points for {{GROWTH_OK}} of {{GROWTH_N}} companies.</li>
<li><b>Share counts</b>: the count each company printed on the cover of its newest report, every class of stock added, read from the SEC ({{N_COVER}} of the names shown); where none could be read, the last quarter's average ({{N_QAVG}}); for foreign listings the vendor's market value ({{N_VENDOR}}); and for {{N_CLASS}} whose quarterly count is plainly one share class of several, the vendor's market value as well, marked not verified.</li>
<li><b>Shares still to come, convertible notes, leases, sales under contract</b>: the companies' own tagged filings at the SEC.</li>
<li><b>Capex announced</b>: the newest earnings call the vendor holds, found by a rule and then read by me; the words are quoted on the page.</li>
<li><b>Other currencies</b>: converted at the {{FX_DATE}} rate.</li>
<li><b>The knockout</b>: its own committed data and rules, unchanged.</li>
</ul>

<h4>WHAT COULD BE WRONG</h4>
<ul>
<li><b>The estimates are the vendor's.</b> You have called them weak. For a young company a handful of analysts is the consensus.</li>
<li><b>Share counts are as of the cover date</b>, weeks to months back. A company selling shares every week has more today. Where only a quarter's average was available it runs further behind.</li>
<li><b>"Still to find" counts only cash on the balance sheet.</b> On its August call IREN said it had secured about $19bn of funding over twelve months, most of it in cash or not yet drawn, and an analyst put what is in hand at about $14bn. Financing arranged but not yet drawn is not on a balance sheet, so the rule shows IREN's gap in full. The company's words are quoted beside the figure.</li>
<li><b>Gross margin is the vendor's line.</b> For data-centre companies depreciation sits outside it, which flatters them against a hardware maker.</li>
<li><b>EBITDA here is filed operating profit plus depreciation.</b> Pay in stock is a cost in it. A company that pays heavily in stock (Axon) shows more leverage here than on its own "adjusted" figure.</li>
<li><b>Net debt counts leases.</b> That is right for a data-centre lease; it also lifts every retailer, restaurant and airline. The load is only ever compared inside a branch.</li>
<li><b>Convertible notes are under-counted.</b> Many companies tag them under a name of their own; "shares still to come" is the wider and better-covered reading ({{N_OVERHANG}} shelf names have it, {{N_CONV}} have a convertible figure).</li>
<li><b>Capex announcements were read in context for three names</b> (IREN, Nebius, CoreWeave) and from the sentence alone for eight. Three more were seen and not used; each is quoted with its reason.</li>
<li><b>The pre-profit net-debt band rests on one assumption</b>: that such a business, once mature, earns about a third of its sales as EBITDA.</li>
</ul>

<h4>WHAT WAS NOT DONE</h4>
<ul>
<li>No table was written, nothing was deployed, nothing on the Hub or in the allocation tool changed.</li>
<li>The debt reading is not wired into the knockout's own page or data; this page holds the re-run.</li>
<li>The history test has no failed companies and no estimates as they stood. Both can be had: the vendor lists delisted companies, and nightly copies of the estimates began on 2 October.</li>
<li>No filing was read for how the build-out will be financed beyond the cash-flow lines and the quoted call sentences.</li>
<li>Sales under contract are shown, not scored.</li>
</ul>

<h4>HOW THE VENDOR FIGURES WERE FETCHED — FOR THE COORDINATOR TO JUDGE</h4>
<p>The vendor key lives only on Fly. I started one throw-away machine, uploaded the fetch script in this folder to it, pulled the statements and the call text, stopped it, and confirmed it destroyed; nothing was written and no key was printed. Afterwards, reading another lane's return, I found that on 6 October a different lane's session had "uploading a script to the throw-away machine" refused by its permission layer, and that three later lanes left that refusal standing. My session allowed the same step and the briefs describe it as the standard route, but I had not found that refusal before I acted. I took no further Fly action of any kind after finding it, made no database read, and sent no Hermes report. Whether the refusal bound this lane, and whether the figures pulled this way stand, is yours and Alan's to decide. The script's SHA-256 as it ran: <code>{{SCRIPT_SHA}}</code>.</p>

<h4>FOUND ON THE WAY — FOR THE COORDINATOR</h4>
<ul>
<li><b>The Hub's share count is off for many of these names.</b> The comps system takes shares as the vendor's market value divided by the vendor's price. For {{N_GAP10}} of the {{N_SHOWN}} names shown here that count is more than 10% away from the count used on this page: Rocket Lab {{RKLB_IMPLIED}} against {{RKLB_COVER}} on its own report cover, Applied Digital {{APLD_IMPLIED}} against {{APLD_COVER}}. The vendor's profile row agrees with the covers; the market-value field the comps system reads does not. I did not find why. Every EV multiple on the comps tab for those names rests on the vendor's count.</li>
<li><b>Four miners are filed as banks.</b> The vendor puts Hut 8, MARA, Riot and TeraWulf under capital markets, so the comps system and the knockout's cash-yield reading treat them as banks. They are read here as ordinary companies.</li>
</ul>
</details>
