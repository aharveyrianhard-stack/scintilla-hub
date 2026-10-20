"""CW4 · the verdicts, written from the computed figures of 20 Oct 2026 (COMPS-DOW30.json). Three sentences in
market talk: where it sits and against whom; what the gap is paying for; the one number that changes the read.
Then the line a peer table cannot see. Written by hand after the numbers, not templated."""

VERDICTS = {
"NVDA": {
 "s": ["Cheapest name on the page and the only large cheap one: 15.5x NTM earnings against 36.9x for the AI-silicon set (AMD 37x, Marvell 39x, Arm 84x), at parity with Broadcom (17x) and TSMC (20x), and a PEG of 0.20 against 0.43.",
       "The market is paying nothing for the growth because it treats $339B of NTM net income as a peak: a 60% EBIT margin on a $619B revenue consensus that doubles from trailing, with four customers' capex budgets behind it.",
       "The number is FY28 revenue ($695B consensus): a 20% cut leaves the stock at 19x, still under the peer median, so the read only flips if the cycle breaks rather than the estimate."],
 "blind": "Comps cannot see customer concentration; every peer in the table is priced on the same four capex budgets."},
"MMM": {
 "s": ["3M is a quarter cheap against the diversified industrials on every row: 16.9x NTM against 22.5x (ITW 22.5x, Emerson 22x, Parker 25x, Eaton 24x, Rockwell 28x; only Dover at 17x is near it), 11.2x EBITDA against 17x.",
       "Half the discount is real and half is arithmetic: trailing net income ($3.5B) carries the PFAS and earplug settlements, so the 48% net-income recovery to $5.2B NTM makes the PEG row (0.35 against 0.60) the highest line on the field, while revenue grows 4.5% against 7.4% for the set.",
       "The number is organic growth: at the peers' 7% the 22.5x re-rate is $228; at 4.5% the market will keep paying a litigation-and-no-growth multiple, and the analysts' $191 says that is what they expect."],
 "blind": "A peer table cannot see the remaining PFAS liability, which is a balance-sheet item no multiple here carries."},
"DIS": {
 "s": ["Disney reads cheap only on the PEG row: on the plain multiples it is a shade rich against a cheap set (14.3x NTM against 12.5x; Netflix 18x, Fox 11x, Paramount Skydance 12.5x, Comcast 6x, Sony 17.5x) and 23% over on EV/sales.",
       "The cheap read is a recovery: trailing net income ($8.6B) carries content impairments and the NTM consensus is $13.5B, a 56% jump, so the PEG (0.25 against 0.52) prices the stock at $231 while the earnings row prices it at $98.",
       "The number is FY27 net income: if the $13.5B lands, 12.5x on it is only $98 and the stock is fair, so the read lives on whether the market pays a Netflix multiple (18x, $141) for parks-plus-streaming or a Fox multiple (11x) for it."],
 "blind": "Comps cannot see the parks cycle or the sports-rights cost step-up; EBITDA here is a studio number and a parks number added together."},
"CRM": {
 "s": ["Salesforce sits fair, a fifth cheaper than the applications set on earnings (12.6x NTM against 15.5x; Microsoft 25x, SAP 24x, ServiceNow 31x, Adobe 8.5x, Workday 15.5x) and a quarter cheaper on EBITDA, at parity on sales.",
       "The discount is growth: 12.8% NTM against 18.8% for the set, with a 43% EBIT margin that is already the best of the peers, so the market pays for what Agentforce adds to the top line and not for margin it already has.",
       "The number is revenue growth: at the peers' 19% the earnings row is $297 and the stock is cheap; at 13% the PEG row ($187) is the honest one and the stock is fair, which is where the analysts' $275 lands."],
 "blind": "Comps cannot see the move from seats to consumption pricing, which decides whether the 13% is a floor or a ceiling."},
"GS": {
 "s": ["Goldman is fair against the banks and brokers: 12.0x NTM against 10.7x (Morgan Stanley 13.7x, JPMorgan 12.5x, Citi 8.6x, Bank of America 9.4x, UBS 10.7x) and 2.1x book against 2.4x, on an 18% return on equity that matches the set.",
       "The two rows pull against each other, earnings at $790 and book at $1,029, because 2026 is a record trading and banking year and the consensus has net income flat to down (−3%) from here, so the price sits on a peak-earnings multiple with a mid-cycle book multiple.",
       "The number is FY27 net income ($21.6B consensus): if the capital-markets cycle extends it, the book row holds at $1,029 and the analysts' $1,148 is reachable; if it rolls over, 12x on a smaller number is under the price."],
 "blind": "A peer table cannot see the compensation ratio or the private-credit book, which carry the next downturn's earnings."},
"HON": {
 "s": ["Honeywell, now the automation company after the aerospace spin, is fair at parity with the automation set on earnings (22.2x NTM against 21.9x; Emerson 22x, Eaton 24x, Rockwell 28x, Johnson Controls 22x, Trane 27x, Siemens 20x) and 10% under on EBITDA.",
       "The trailing figures are the old company (revenue $36B against a $20B NTM consensus), so the growth and margin comparisons on the card are not like-for-like; the NTM rows are the remaining business and they price the stock between $185 and $247 with the price at $214.",
       "The number is the first clean quarter: a remaining-company EBIT margin at the peers' 21% holds the 22x; the analysts' $255 assumes the automation business earns a Trane multiple rather than a Siemens one."],
 "blind": "Comps cannot see stranded costs from two separations in nine months or the pension and liabilities left behind."},
"MRK": {
 "s": ["Merck is fair, a fifth rich on earnings against big pharma (18.6x NTM against 15.5x; Pfizer 10x, Bristol 9x, AbbVie 18x, J&J 22x, AstraZeneca 15x, Novartis 15.5x) and at parity on sales and EBITDA.",
       "The trailing year is not usable: net income of $3.2B carries the Verona Pharma write-off, so the 518% recovery to $19.6B NTM is accounting and the PEG is not priced; what the 18.6x is paying for is Keytruda's last two clean years before the 2028 loss of exclusivity.",
       "The number is FY28 revenue: the consensus for the cliff year decides whether 18.6x is a fair multiple on a franchise or a full one on a run-off, and the analysts' $165 says they are pricing the pipeline (Winrevair, the subcutaneous Keytruda) to fill it."],
 "blind": "Comps cannot see 2028; an NTM table on a company with a known patent cliff two years out is a picture of the wrong year."},
"GOOGL": {
 "s": ["Alphabet, in the Dow since June, is fair: cheaper than the platform set on earnings (20.3x NTM against 23.8x; Meta 20x, Microsoft 25x, Amazon 24x, Apple 36x) and richer on sales and EBITDA (+38% and +15%), which nets to the midpoint.",
       "The multiple is paying for the capex: consensus has revenue up 34% to $598B but net income down 16% as depreciation on the AI build arrives, so there is no PEG and the earnings row ($400) is the highest line on the field.",
       "The number is FY27 net income ($205B consensus); if the depreciation step-up is smaller than the Street's, the earnings row holds and the read turns cheap; the analysts' $425 already assumes it."],
 "blind": "A peer table cannot see the search-share question or the antitrust remedies on the distribution deals."},
"CVX": {
 "s": ["Chevron is fair on the field and rich on the rows that count for an oil major: 14.7x NTM against 10.2x for the integrateds and producers (Exxon 15.6x, Shell 9.6x, BP 8.4x, Total 8.4x, Conoco 14x), 7.4x EBITDA against 5.0x.",
       "The premium is the US listing and the Hess barrels: the two American majors trade at 15x while the Europeans trade at 9x on the same oil price, and the PEG row (0.32 against 0.41, on a 46% net-income recovery that is partly Hess) is what pulls the midpoint up to $207.",
       "The number is the oil price deck under the FY27 consensus ($30B net income): at the European multiple the stock is $156; the analysts' $224 is the price, which says the market agrees on parity with Exxon and nothing more."],
 "blind": "Comps cannot see the Guyana reserve life or the Kazakhstan concentration, which are what the US premium is supposed to be for."},
"TRV": {
 "s": ["Travelers is a shade rich against the P&C insurers: 11.2x NTM is under the set's 12.6x (Chubb 12.6x, Progressive 13x, Berkley 14x, Allstate 8.4x, Hartford 9.4x), but 2.8x book against 1.9x is a 51% premium, on a 29% return on equity against 20%.",
       "The gap between the rows (earnings $441, book $259) is the pricing cycle: 2026 is a hard-market year and the consensus has net income down 12% from here, so the price is on peak earnings and the book multiple is paying for the cycle to stay hard.",
       "The number is the combined ratio: every point of softening takes the ROE toward the peers' 20%, at which 1.9x book is the right multiple and the stock is $259; the analysts' $350 is between the rows."],
 "blind": "A peer table cannot see catastrophe exposure or reserve development, which is where an insurer's next year is actually decided."},
"AMGN": {
 "s": ["Amgen is at parity with large biotech on earnings and sales (17.9x NTM against 18.3x; Gilead 20x, Regeneron 12x, Vertex 25x, AbbVie 18x, Bristol 9x, Lilly 30.5x) and 8% under on EBITDA; the rich read comes from the PEG row alone.",
       "Trailing net income ($8.7B) carries the Horizon amortisation and charges, so the 50% recovery to $13.1B NTM gives a PEG of 0.36 against the set's 0.22 and a $264 row that drags the midpoint to $355 against a $434 price; on the plain rows the stock is $414 to $477.",
       "The number is MariTide: the obesity data decides whether Amgen gets Lilly's growth multiple or stays a 5%-grower (against 12% for the set) on mature biologics, and the analysts' $410 is priced for the second."],
 "blind": "Comps cannot see biosimilar erosion on Prolia and Xgeva, which is inside the 5% growth but not inside any multiple."},
"WMT": {
 "s": ["Walmart is the richest retailer on the page: 37.4x NTM against 16.7x for the set (Costco 43x is the only name above it; Target 16x, Kroger 10x, Dollar General 17x, BJ's 20x), 18x EBITDA against 11.5x.",
       "The premium is for Costco-like durability (membership, advertising, marketplace) on a business growing 5.5% against the peers' 7.5%, and the PEG at 2.7 says growth does not cover it even before Costco's 3.8 is used as the comparison.",
       "The number is the advertising and membership line: if it compounds at 25%-plus the EBIT margin (5%) walks toward 6% and the earnings row moves; without it, 37x is Costco's multiple on Kroger's growth."],
 "blind": "A peer table cannot see the low-income consumer or tariff pass-through, which set next year's gross margin."},
"AMZN": {
 "s": ["Amazon is level with its set on earnings (23.8x NTM against 25.3x; Walmart 37x, Costco 43x, Microsoft 25x, Alphabet 20x, Alibaba 13x) and a quarter cheaper on EBITDA; the rich read is the sales row, 3.2x against 1.4x, because half the peers are grocers.",
       "The earnings and EBITDA rows price the stock at $280 and $362, above the $263 price; the sales row at $108 is a retailer's multiple on a company that is half AWS, so the midpoint ($198) is a verdict on the peer mix, not on the stock.",
       "The number is FY27 net income ($119B consensus, down 12% as capex depreciation arrives): if AWS holds margin through the build the EBITDA row is the one and the stock is cheap; the analysts' $325 is priced for that."],
 "blind": "Comps cannot separate AWS from retail; a sum-of-the-parts does, and a peer table never will."},
"HD": {
 "s": ["Home Depot is at parity with the big-box set on earnings (20.2x NTM against 21.4x; Lowe's 15.6x, Floor & Decor 21x, Tractor Supply 16x, Walmart 37x, Costco 43x) and rich on sales and EBITDA (+64%, +21%), because its 13% EBIT margin is twice the set's.",
       "Against the one true peer the picture is simpler: Lowe's at 15.6x makes Home Depot 30% rich on earnings for a business growing 3.9% against the set's 5.5% and a PEG of 2.1; the sales row at $168 is what pulls the midpoint to $237.",
       "The number is housing turnover: the pro business and the SRS acquisition carry the 4% while existing-home sales sit at a 30-year low, and the analysts' $378 assumes turnover comes back before the multiple does."],
 "blind": "Comps cannot see the SRS roll-up or the dealer-credit book, which are now a tenth of sales and most of the net debt."},
"JNJ": {
 "s": ["J&J is a third rich against pharma and medtech: 22.2x NTM against 17.1x (Merck 18.6x, Pfizer 10x, AbbVie 18x, Abbott 17x, Medtronic 15x, Novartis 15.5x; only Lilly at 30.5x is above it) and 17x EBITDA against 13x.",
       "The trailing year ($16.1B net income) carries the talc charges, so the 75% recovery to $28.1B NTM is accounting and the PEG row (0.30 against 0.19) is the one that comes closest to the price; the premium is being paid for a AAA balance sheet and Stelara's erosion already being in the numbers.",
       "The number is FY27 EPS ($11.50 consensus): the analysts' $280 needs 24x on it, a Lilly-adjacent multiple on a 7%-grower; at the peers' 17x the stock is $199."],
 "blind": "Comps cannot see the talc litigation's remaining tail or the medtech separation that would put the two halves on different multiples."},
"PG": {
 "s": ["Procter is rich against household and personal care on every row: 21.6x NTM against 17.2x (Colgate 23x, Kimberly 14.6x, Church & Dwight 26x, Clorox 15x, Unilever 17x, Kenvue 15x), 4.4x sales against 2.8x, 15.4x EBITDA against 12.6x.",
       "The premium is certainty: the steadiest earnings on the page (a 2.3% spread in the NTM EPS consensus, 1.6 points of revenue volatility over five years) on 2.9% growth against the peers' 4.3%, so the market pays a quarter more for a number it knows; the PEG at 3.5 is not meaningful.",
       "The number is organic volume: a return to 3%-plus volume growth holds 22x; a year of price-only growth puts the stock on Kimberly's 15x, which is $126."],
 "blind": "Comps cannot see private-label share or the tariff cost pass-through, which decide whether the volume comes back."},
"JPM": {
 "s": ["JPMorgan is rich against the universal banks: 12.5x NTM against 10.0x (Bank of America 9.4x, Citi 8.6x, Wells 9.7x, HSBC 10x, US Bancorp 10.4x) and 2.4x book against 1.4x, a 70% premium on an 18% return on equity against the set's 13%.",
       "The premium is the ROE: at 18% a 2.4x book is the same earnings yield as a 13% ROE at 1.4x, so the stock is at parity on what the equity earns and rich on what it is marked at; the earnings row ($268) and the book row ($197) are both under the $336 price.",
       "The number is FY27 net income ($71.6B consensus, up 9%): a credit cycle that takes the ROE toward 15% puts the stock on 2.0x book, $280; the analysts' $375 needs the 18% to be the new normal."],
 "blind": "A peer table cannot see the excess capital or the deposit beta, which carry a bank's next year's earnings."},
"BA": {
 "s": ["Boeing is priced on the sales row and nothing else: 1.6x NTM sales against 1.9x for the aerospace set (Airbus 1.8x, RTX 2.8x, Lockheed 1.7x, GD 1.7x, Northrop 1.9x, GE 5.8x, Howmet 7.7x) puts the stock at $232, while 68x NTM earnings on a 2% net margin puts it at $65.",
       "The gap is the margin: Airbus earns 10% EBIT on the same duopoly and Boeing's consensus is 5%, so the market is paying today for the margin Boeing had in 2018 and not the one in the consensus; the EBITDA row (24.6x against 13.2x) says the same thing.",
       "The number is the FY27 EBIT margin: at Airbus's 10% the earnings row is $200 and the stock is fair; at the consensus 5% it is $65 and only the sales row holds it up, which is where the analysts' $270 sits."],
 "blind": "Comps cannot see the 737 production rate or the FAA cap, which are the whole margin story; the backlog is not in any multiple here."},
"NKE": {
 "s": ["Nike is the richest consumer name on the page on earnings: 27x NTM against 13.7x for footwear and apparel (adidas 14.5x, Lululemon 11.6x, Deckers 10x, On 17.6x, Skechers 13x), 17x EBITDA against 8.9x, with revenue falling 6.5% against the set's 9.5% growth.",
       "The premium is a turnaround multiple: a 6% EBIT margin against the peers' 9% and net income down 32% NTM, so 27x is the market paying for the margin to come back to 12%-plus before it has; on the consensus numbers the three rows price the stock at $19 to $31.",
       "The number is the FY27 EBIT margin: at 10% the earnings row is $37 and the stock is fair; the spread in the EPS consensus (71%, the second widest on the page) says nobody knows, and the 35 analysts' range ($19 to $60) says the same."],
 "blind": "Comps cannot see brand heat or the wholesale inventory clearing, which decide whether the 6% is the bottom."},
"SHW": {
 "s": ["Sherwin-Williams is twice the coatings set on every row: 25.2x NTM against 14.0x (PPG 12.6x, RPM 16x, Axalta 12x, AkzoNobel 14x, Nippon Paint 14x), 3.7x sales against 1.8x, 18x EBITDA against 8.8x.",
       "The premium is the own-store model: a 70% return on equity, an 18% EBIT margin against 14%, and growth (6.6%) above the set (4.9%) make it the second-steadiest earner on the page, and the PEG row (1.23 against 1.08) is the only line that reaches the price.",
       "The number is housing turnover: the stores sell to painters, and a return of existing-home sales adds the volume that makes 25x a growth multiple; without it, the analysts' $391 is paying for steadiness alone."],
 "blind": "Comps cannot see raw-material (TiO2, resin) pass-through timing, which is where a paint company's margin moves."},
"CSCO": {
 "s": ["Cisco is at parity with the networking and enterprise-hardware set on earnings (20.2x NTM against 19.7x; Arista 35.5x, HPE 11x, Dell 15.5x, F5 24x, Nokia 20x, Ericsson 16x) and three times it on sales (5.8x against 1.9x), because its 35% EBIT margin is twice the set's.",
       "The rich read is the sales row ($32) against the earnings row ($104, the price): growth of 17% (Splunk plus AI networking orders) is under the set's 27% (Arista 50%, Dell 48%, HPE 30%), so the PEG (0.36 against 0.23) is also rich; the midpoint is an average of a software margin and a hardware multiple.",
       "The number is AI data-centre orders: if the hyperscale switching line keeps the growth near 17%, 20x holds and the analysts' $135 follows; if growth returns to 5%, Cisco is a 15x hardware name at $80."],
 "blind": "Comps cannot see the mix shift to subscription software, which is what makes the sales multiple look wrong."},
"IBM": {
 "s": ["IBM is rich against consulting, enterprise software and hardware: 18.1x NTM against 15.5x (Accenture 16x, Oracle 14.6x, Microsoft 25x, HPE 11x, Dell 15.5x, Cognizant 10x, SAP 24x), twice the set on sales (3.9x against 1.9x) and a PEG of 1.1 against 0.32.",
       "The premium is for steadiness and the Red Hat and AI software mix: the fourth-steadiest earner on the page (2.2 points of revenue volatility over five years) growing 5% against the set's 25% (Oracle 48%, Dell 48%, HPE 30% on AI infrastructure), with 3.3x net debt to EBITDA, the most on the page outside McDonald's.",
       "The number is software growth: if the software segment runs above 10% and consulting stops shrinking, the earnings row ($205) is the floor; the PEG and sales rows ($68, $84) are what the stock is worth as a 5%-grower."],
 "blind": "Comps cannot see the mainframe cycle, which lifts and drops a year's revenue on its own schedule."},
"CAT": {
 "s": ["Caterpillar is the richest machinery name on the page: 23.1x NTM against 15.8x for the set (Deere 28x is the only one above it; Cummins 16x, PACCAR 16x, Komatsu 13x, AGCO 15x, Oshkosh 10x), 17x EBITDA against 9.5x, 4.3x sales against 1.6x.",
       "The premium is data-centre power: the market pays a turbine-and-genset multiple for a machinery company on a 22% EBIT margin against 15% and 17% growth against 11%; the PEG at 0.69 against 0.30 says the growth does not cover it.",
       "The number is the Power segment's share of revenue: if gensets and turbines reach a third of sales the GE Vernova comparison applies and the stock is cheap; if they stay a fifth, Cummins's 16x (a $497 earnings row) is the fair one, and the analysts' $948 is paying for the first."],
 "blind": "A peer table cannot see the dealer inventory cycle or the Cat Financial book, which carries most of the net debt."},
"AXP": {
 "s": ["American Express is rich against the card lenders and at a discount to the networks: 15.8x NTM against 11.2x for the set (Capital One 10x, Synchrony 6.5x, JPMorgan 12.5x, Citi 8.6x; Visa 25.6x and Mastercard 27x), and 6.3x book against 1.4x.",
       "The field is the peer problem in one picture: half the set are lenders at 1.1x to 1.4x book and the other half are networks at 22x to 97x, so the book row ($73) and the PEG row ($292) are four times apart; on earnings alone, a 33% return on equity against the lenders' 19% earns a premium, not 41%.",
       "The number is the net write-off rate: a card lender growing 9% (consensus FY2 over FY1) at a 33% ROE holds 16x while credit is benign; the analysts' $380 and a Hold consensus say they see the ROE, not the growth."],
 "blind": "Comps cannot see the closed-loop spend data or the premium-card annuity, which is what makes this neither a lender nor a network."},
"UNH": {
 "s": ["UnitedHealth is a third rich against managed care on earnings (18.6x NTM against 14.1x; Elevance 14.6x, Cigna 9x, Humana 27x, CVS 11x, Centene 13.6x, Molina 25.5x) and three times it on sales (0.9x against 0.3x), because Optum carries a 7% EBIT margin against the set's 3%.",
       "The premium is Optum and the recovery: trailing net income ($15.9B) is the 2025 medical-cost collapse and the consensus has 28% growth to $20.3B, so the PEG (0.67 against 0.36) is rich and the sales row ($105) is a pure insurer's multiple on a company that is half services.",
       "The number is the medical cost ratio: a return to 2024's margin puts FY27 EPS near $30 and the stock on 14x; a second year at 2025's ratio makes the consensus too high and the analysts' $499 a memory."],
 "blind": "Comps cannot see Medicare Advantage rate notices or the DOJ inquiry, which set next year's margin before any peer does."},
"MCD": {
 "s": ["McDonald's is at parity with the restaurants on earnings (18.2x NTM against 18.2x; Yum 21x, Chipotle 21x, Starbucks 32x, Restaurant Brands 13x, Domino's 15x, Darden 18x) and on EBITDA (+8%), and the rich read is the sales row alone: 7.9x against 3.0x.",
       "The sales row is the franchise model, not a premium: 95% of the units are franchised, so revenue is rent and royalty at a 47% EBIT margin against 16% for a set that still operates restaurants; the $45 implied price on that row is what drags the midpoint to $106 against a $246 price.",
       "The number is US comparable sales: at parity on earnings with 4% growth (the set's 3.9%), the stock moves with traffic, and the analysts' $286 needs comps back above 3% with the value menu holding margin."],
 "blind": "Comps cannot see the owned real estate under the franchisees, which is half the enterprise value and in no multiple here."},
"KO": {
 "s": ["Coca-Cola is rich against beverages and packaged food on every row: 26.6x NTM against 17.5x (Pepsi 15.6x, Keurig Dr Pepper 13.7x, Mondelez 19x, Nestlé 17.5x, Diageo 18x; only Monster at 37x is above it), 8.6x sales against 2.7x, 20x EBITDA against 12.6x.",
       "The sales row is the concentrate model (a 40% EBIT margin against 17% because the bottlers carry the revenue), so the honest gap is the earnings row: 52% over the set on revenue that is flat (−0.6% NTM against +3.4%) and net income up 5%; the market pays for the steadiest consumer franchise on the page after Procter.",
       "The number is volume: Coca-Cola at Pepsi's 15.6x is $55, and the premium holds only while volume grows in the emerging markets that carry it; the analysts' $96 is the price, which says they see no re-rating either way."],
 "blind": "Comps cannot see the bottler refranchising or the currency mix, which move reported revenue without touching the franchise."},
"V": {
 "s": ["Visa is at parity with Mastercard (25.6x NTM against 26.9x) and three times the rest of the payments set, because the merchant acquirers have been de-rated to single digits (Fiserv 6.2x, FIS 5.6x, Global Payments 5.9x, PayPal 8.8x); the set's median of 8.8x prices the stock at $140.",
       "The field is a verdict on the peer set: a PEG of 0.82 against 0.77 says Visa is fairly priced for its growth (15% against 16%), while the sales and EBITDA rows (15x and 20x against 3x and 6.6x) compare a network with no credit risk to processors with 4x net debt and software-disruption fears in the multiple.",
       "The number is Mastercard's 26.9x: against the only true peer the stock is fair and the analysts' $427 is the price; the comps read turns cheap only if the acquirers re-rate, which is not Visa's problem."],
 "blind": "Comps cannot see interchange regulation or stablecoin rails, which are the two things that could put a network on a processor's multiple."},
"MSFT": {
 "s": ["Microsoft is a quarter rich against the cloud and software set on earnings (25.3x NTM against 20.3x; Alphabet 20x, Amazon 24x, Oracle 14.6x, Salesforce 12.6x, SAP 24x, ServiceNow 31x, Meta 20x) and twice it on sales (9.7x against 5.0x).",
       "The PEG row ($114) drags the midpoint to $220, because net income grows 17% on 25% revenue growth as capex depreciation lands, while the peers' trailing years are depressed and their PEGs tiny; the earnings and EBITDA rows ($427, $395) are 20% to 25% under the price, which is the honest premium.",
       "The number is Azure growth: at 25% total revenue growth the 25x holds as a growth multiple; the analysts' $600 is 29x on FY27 EPS of $20.92, which needs the AI capacity to convert to revenue faster than it depreciates."],
 "blind": "Comps cannot see the OpenAI exposure or the capex commitments, which sit in the cash-flow statement and not in any NTM multiple."},
"AAPL": {
 "s": ["Apple is the richest name on the page on every row: 35.8x NTM against 18.9x for the set (Microsoft 25x, Alphabet 20x, Xiaomi 21x, Dell 15.5x, Sony 17.5x, HP 10x; Samsung's 2.7x is a data break and struck), 9.5x sales against 1.4x, 28x EBITDA against 11x.",
       "The sales row ($50) is the hardware peers' multiple on a company priced as a services annuity, so the midpoint ($95) is an artefact of the set; the honest line is the earnings row: $180 at the peers' 19x, which says the market pays 36x for 13% revenue growth and 8% net-income growth, a PEG of 4.5 against the set's 0.43.",
       "The number is services growth and the gross margin: if services keep compounding at 13%-plus and gross margin holds near 49%, the 36x is a consumer-staples multiple on a platform; at the peers' 19x the stock is $180, and the analysts' $355 is the price."],
 "blind": "Comps cannot see the installed base (2.3 billion devices) or the Google search payment, which together are the margin and none of the peers has either."},
}
