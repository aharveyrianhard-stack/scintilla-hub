"""CW3 · the verdicts, written from the computed figures of 19 Oct 2026 (COMPS-RADAR.json). Three sentences in
market talk: where it sits and against whom; what the gap is paying for; the one number that changes the read.
Then the line a peer table cannot see. Written by hand after the numbers, not templated."""

VERDICTS = {
"IREN": {
 "s": ["Cheapest name on the page: 3.1x NTM sales against 6.9x for the hosting pack (TeraWulf 11.6x, Cipher 7.6x, Applied Digital 7.1x) and half the pack's EV/gross profit.",
       "The discount is paying for execution risk on a 481% revenue ramp that is mostly one contract (consensus has FY27 sales at $4.1B from $0.7B trailing) and for $7.8B of debt against $35M of trailing EBITDA.",
       "The number that changes the read is the FY27 revenue line: if it holds, 6.9x sales is $67; if it halves, today's price is the fair one."],
 "blind": "Comps cannot see contract concentration or what a GPU is worth in year three; every peer in the table is priced on the same hope."},
"ORCL": {
 "s": ["Cheap on earnings: 14x NTM against 24x for the software-and-cloud set (Microsoft 25x, SAP 24x, ServiceNow 30x), at parity on EV/sales and a quarter under on EV/EBITDA.",
       "The gap is the balance sheet: $119B of net debt, 3.2x EBITDA against 0.7x for the peers, funding a 48% revenue ramp that the market treats as a loan to one customer rather than as software growth.",
       "The number to watch is net debt to EBITDA: if the FY27 EBITDA consensus ($50B) lands, leverage falls to 2.4x and the 24x re-rate is $215; if capex keeps outrunning it, the P/E stays a debt multiple."],
 "blind": "A peer table cannot price the remaining-performance-obligation backlog or the counterparty risk sitting inside it."},
"NVDA": {
 "s": ["Nvidia is the cheapest large AI name on its own multiples: 15.5x NTM earnings against 37x for the set, with the discount made by AMD, Marvell and Arm; against Broadcom (17x) and TSMC (20x) it is at parity.",
       "The market is paying nothing for the growth (PEG 0.20 against 0.43) because it treats $339B of NTM net income as a peak: 60% EBIT margins on a $619B revenue consensus that doubles from trailing.",
       "The one number is FY28 revenue ($695B consensus); a 20% cut puts the stock at 19x and still under the peer median, so the read only flips if the cycle breaks, not the estimate."],
 "blind": "Comps cannot see customer concentration: four hyperscalers' capex budgets decide whether the consensus is low or absurd."},
"AVGO": {
 "s": ["Broadcom screens cheap next to the custom-silicon crowd: 17x NTM against 37x (Marvell 38x, AMD 37x, Astera 46x), with EV/sales near parity at 9.5x against 10.6x.",
       "The discount prices a fiscal year that is almost entirely unreported: consensus FY27 net income of $95B is two and a half times trailing, so 17x is a bet that the custom-accelerator orders from three customers ship on time.",
       "If FY27 revenue comes in at $174B as consensus says, the peer medians put the stock between $374 and $719; the number to watch is the quarterly AI-semiconductor run-rate, which has to pass $30B by mid-2027 to carry it."],
 "blind": "Comps cannot see the VMware annuity inside the multiple or the share of profit that is custom silicon for two customers."},
"VST": {
 "s": ["Vistra sits at parity on earnings (15.7x against 15.3x for Constellation, NRG, Talen and the regulated names) and a third cheaper on EV/EBITDA and EV/sales, with growth four times the group's.",
       "The gap is a cycle discount: the market pays Constellation 22x for nuclear under contract and Vistra 16x for the same megawatts because much of its fleet is gas and coal sold into a merchant Texas market.",
       "The number is the FY27 EBITDA consensus ($8.0B); at the peer 10.6x that is $194, and every long-term hyperscaler contract signed at a fixed price moves the multiple toward Constellation's."],
 "blind": "A peer table does not see the hedge book or the ERCOT forward curve that sets next year's merchant margin."},
"CRDO": {
 "s": ["Credo is at parity on sales (10.1x both) and a third cheaper on earnings and EBITDA than the interconnect set (Marvell 38x, Astera 46x, MACOM 30x), while carrying higher margins than any of them.",
       "The discount is a concentration discount: a 62% EBIT margin on a $3.1B revenue consensus rests on active-electrical-cable orders from a handful of hyperscalers, and the market pays less for a margin it does not expect to last.",
       "The number is the gross margin: at 67% the EBITDA row says $271; a slide toward Marvell's 51% takes the whole premium off the implied range."],
 "blind": "Comps cannot see share of wallet at the two largest customers, which is what the $3.1B consensus actually assumes."},
"AAOI": {
 "s": ["On sales, AAOI is half the optical-module pack (2.5x NTM against 4.8x; Innolight 3.7x, Eoptolink 4.8x, Lumentum 10x); on gross profit it is richer (37x trailing against 27x) because its 29% gross margin is the lowest in the set.",
       "The discount is paying for a margin that has not shown up yet: consensus has FY27 revenue at $2.6B from $0.6B trailing and a turn to profit, on four analysts, while trailing free cash flow is minus $413M and cash covers five quarters of it.",
       "The number is the gross margin: at the peers' 42% the EV/sales row is $150; at 29% the EV/gross-profit row says $57, and the stock sits between them."],
 "blind": "Comps cannot see whether the 800G qualification at the largest hyperscaler holds; every line of the consensus assumes it does."},
"GOOGL": {
 "s": ["Alphabet is fair: cheaper than the platform set on earnings (20x against 24x; Meta 20x, Microsoft 25x, Apple 36x) and richer on sales and EBITDA, which nets to the midpoint.",
       "What the multiple is paying for is the capex: consensus has revenue up 34% to $597B but net income falling 16% as depreciation on the AI build arrives, so there is no PEG and the earnings row is the cheapest line on the field.",
       "The number is FY27 net income ($193B consensus); if the depreciation step-up is smaller than the Street's, the earnings row moves to $400 and the read turns cheap."],
 "blind": "A peer table cannot see the search-share question or the antitrust remedies sitting on the distribution deals."},
"APLD": {
 "s": ["Applied Digital is at parity on sales with the hosting pack (7.1x both) and richer on gross profit (54x against 46x), with the slowest growth in the set (54% against 237%).",
       "The premium is the CoreWeave lease: the market pays landlord money for long-dated contracted capacity, but on tonight's consensus the company is still loss-making through FY28 and carries $6.5B of debt against $2.9B of cash.",
       "The number is the FY28 EBITDA line ($316M consensus) against $6.5B of debt; the EV/EBITDA row cannot price the stock until that number is twice as big."],
 "blind": "Comps cannot see the lease schedule: how much of the revenue consensus is signed and how much is a building still being built."},
"SNDK": {
 "s": ["Sandisk is a quarter rich against the memory makers (5.7x NTM against 5.0x; SK hynix 2.8x, Samsung 2.8x, Kioxia 3.5x) and far cheaper than the disk makers it used to live with (Western Digital 14x, Seagate 15.5x).",
       "The premium pays for NAND pricing: consensus has FY27 revenue at $52B from $20B trailing with a 71% EBIT margin, which is a peak-cycle margin on a commodity.",
       "The number is Kioxia: its 3.5x, on the same product and the same joint venture, is the fair multiple if NAND prices stop rising; that is about $840 against $1,371."],
 "blind": "Comps cannot see where in the cycle the quarter sits; every peer in the table is priced on the same price curve."},
"NBIS": {
 "s": ["Nebius is cheap on sales (4.1x NTM against 7.1x for the pack), level on gross profit (43x against 40x) and rich on EBITDA (27x against 10.6x, CoreWeave's multiple), so the field is wide and the midpoint sits under the price.",
       "The EBITDA row is the honest one: a 664% revenue ramp to $10.4B consensus still leaves the company loss-making, with $1.5B a quarter of cash burn and five quarters of runway before the next raise.",
       "The number is FY27 EBITDA ($1.6B consensus); at CoreWeave's 10.6x it is $62, and the stock needs the FY28 number before it can be priced on EBITDA at all."],
 "blind": "Comps cannot see the equity stakes (ClickHouse, Avride, Toloka) that are part of the market cap and none of the revenue."},
"QCOM": {
 "s": ["Qualcomm looks cheap on every multiple (17x NTM against 30x; 4.2x sales against 10x) and rich on the only one that counts growth: a PEG of 1.0 against 0.25 for the set.",
       "The whole gap is growth: 3% NTM revenue growth against 59% for MediaTek, Broadcom, Marvell and AMD; the market pays handset money while the peers are paid AI money.",
       "The number is the Apple modem: the FY27 revenue consensus ($45B) already carries the loss of that business; if PCs and autos replace it faster, the P/E row ($310) is in play."],
 "blind": "Comps cannot see the licensing annuity (QTL), which carries the margin and has no peer in the table."},
"WMT": {
 "s": ["Walmart is the richest retailer on the page: 38x NTM against 17x for the set (Costco 43x is the only name above it; Target 16x, Kroger 10x, Dollar General 17x), and 18x EBITDA against 11.5x.",
       "The premium is being paid for Costco-like durability (membership, ads, marketplace) on a business growing 5.5%, slower than its peers' 7.5%; the PEG at 2.7 says the growth does not cover the multiple.",
       "The number is the advertising and membership line: if it keeps compounding at 25%-plus, the EBIT margin (4.8%) walks toward 6% and the earnings row moves; without it, 38x is Costco's multiple on Kroger's growth."],
 "blind": "A peer table cannot see the low-income consumer or the tariff pass-through that sets next year's gross margin."},
"AMZN": {
 "s": ["Amazon is level on earnings with its set (24x against 25x; Walmart 38x, Microsoft 25x, Alphabet 20x) and rich on sales (3.2x against 1.4x), because half its peers are retailers and the other half clouds.",
       "The multiple is paying for AWS inside a retailer: consensus has revenue up 19.5% but net income falling 12% in FY27 as depreciation on the capex wave arrives, so there is no PEG and the earnings row carries the read.",
       "The number is the FY27 operating margin (consensus 16%, down from 17% trailing); if AWS holds margin through the capex cycle the EBITDA row at $363 is the one, and the sales row is noise."],
 "blind": "Comps cannot separate AWS from retail; a sum-of-the-parts does, and a peer table never will."},
"CBRS": {
 "s": ["Cerebras is a shade cheaper than the AI-chip set on sales (8.2x NTM against 9.5x) and three times richer on gross profit (85x trailing against 27x), because its 35% gross margin is half of Nvidia's.",
       "The premium pays for a 261% revenue ramp ($2.5B NTM consensus on seven analysts) and the chance that wafer-scale inference takes share; the EBITDA row at 42x says the market already counts FY27 as profitable.",
       "The number is the gross margin: every ten points toward the peers' 67% adds a third to the gross-profit row; at 35% the comps cannot get above $135."],
 "blind": "Comps cannot see the customer list (one Gulf customer carried most of the early revenue) or the lock-up calendar after a 2025 listing."},
"WDC": {
 "s": ["Western Digital is a third rich against storage (14x NTM against 10.6x; Seagate 15.5x is the only name above it, the memory makers sit at 3x to 6x), and it is growing slower than the set (66% against 93%).",
       "The premium pays for the hard-disk duopoly: two makers, hyperscale demand, and a 49% EBIT margin that is Seagate's, not a memory maker's, so the right comparison is Seagate alone and there the stock is at a discount.",
       "The number is FY28 net income ($12.8B consensus, 57% above FY27); the stock already discounts most of it, and the PEG could not be priced because trailing earnings carry a one-off gain."],
 "blind": "Comps cannot see the HAMR transition: the yield on the next drive generation is the whole FY28 estimate."},
"AXTI": {
 "s": ["AXT is rich against the substrate and compound-semiconductor set (7.9x NTM sales against 4.7x; 28x EBITDA against 21x; MACOM 30x and Lumentum 42x are the only earnings multiples above it).",
       "The premium pays for an indium-phosphide shortage: four analysts have revenue at $430M NTM from $126M trailing as InP wafers for optical lasers reprice, and the market cap ($3.7B) is thirty times trailing sales.",
       "The number is the number of analysts: at four, the consensus is a few spreadsheets; the next reported quarterly revenue run-rate (it needs $100M-plus) decides whether the growth is real."],
 "blind": "Comps cannot see China's export licensing on gallium and germanium, which sets whether the Beijing fabs can ship at all."},
"TSM": {
 "s": ["TSMC is cheaper than the foundries on earnings (20x NTM against 23x; GlobalFoundries 18.5x, SMIC 27x, Intel 46x, Tower 32x; Samsung's 2.8x is a memory multiple) and twice as rich on sales and EBITDA, because its 66% gross margin is twice theirs.",
       "The premium is the monopoly: every peer in the table makes trailing-edge wafers; the EV/sales and EV/EBITDA rows compare 59% EBIT margins with 30% ones and so understate the stock, while the earnings row prices it fairly.",
       "The number is the gross margin: at 66% the earnings row is $486 and above the price; a slide to 60% from Arizona and the 2nm ramp takes the earnings row down to the price."],
 "blind": "Comps cannot see the Taiwan discount, which is the whole gap between the earnings row and the analysts' $560."},
"MU": {
 "s": ["Micron is rich against the memory makers on every row (5.0x NTM against 3.9x; SK hynix 2.8x, Samsung 2.8x, Kioxia 3.5x, Nanya 3.9x) and growing slower than the set (113% against 157%).",
       "The premium is HBM and the US listing: an 84% EBIT margin, the highest in the table, on a product that is sold out through 2027; the market pays a point or two more for the same cycle in dollars.",
       "The number is SK hynix at 2.8x: on the same HBM cycle it is the fair multiple for Micron's $205B NTM net income, which is about $510; the gap is what the listing and the DRAM share gain are worth."],
 "blind": "Comps cannot see the cycle: every multiple in the table is a peak multiple on peak earnings, and the trailing P/E at the last trough was fifty times higher."},
"NFLX": {
 "s": ["Netflix is a third rich against media (18.5x NTM against 14x; Disney 14x, Comcast 6x, Spotify 30x, Roku 35x), level on EBITDA, and twice the set on sales.",
       "The premium is margin and growth: a 34% EBIT margin against 15% for the set and 15% growth against 6%, the gap between a subscription platform and studios in decline; the PEG at 1.2 says the market pays full price for it.",
       "The number is the ad tier: if advertising lifts FY27 revenue growth above 15% the PEG falls under 1 and the read is fair; if growth slows to 10%, 18.5x is a media multiple on a maturing business."],
 "blind": "Comps cannot see content amortisation; EBITDA here is a Netflix number, not a Disney number, and the two are not the same thing."},
"CAT": {
 "s": ["Caterpillar is the richest machinery name on the page: 23x NTM against 15x for the set (Deere 28x is the only one above it; Cummins 15x, PACCAR 16x, Komatsu 13.5x), and 17x EBITDA against 9x.",
       "The premium is data-centre power: the market is paying a turbine-and-genset multiple for a machinery company, on a 22% EBIT margin against 15% and 17% growth against 11%; the PEG at 0.7 against 0.29 says the growth does not cover it.",
       "The number is the Power segment's share of revenue: if gensets and turbines reach a third of sales the GE Vernova comparison (34x) applies and the stock is cheap; if they stay a fifth, the Cummins multiple (15x) is the fair one."],
 "blind": "A peer table cannot see the dealer inventory cycle or the Cat Financial book, which carries a large part of the debt."},
"BE": {
 "s": ["Bloom is the richest profitable name on the page: 61x NTM against 23x for the on-site power set (GE Vernova 34x, Vertiv 23x, Caterpillar 23x, Cummins 15x), four times the set on sales and three times on EBITDA.",
       "The premium is paying for a doubling: consensus has FY27 revenue at $6.4B from $3.1B trailing on data-centre fuel-cell orders, with the EBIT margin moving from 11% to 23%; the fuel-cell peers (Plug, FuelCell) are loss-making and cannot anchor it.",
       "The number is backlog conversion: if FY27 revenue lands, the earnings row at the peers' 23x is $86; the stock needs FY28 near $10B before any peer multiple reaches $226."],
 "blind": "Comps cannot see the Brookfield and AEP contracts, or what a fuel cell is worth once gas turbines are available again in 2028."},
"SHOP": {
 "s": ["Shopify is off the field: 74x NTM against 14x for the merchant-software and payments set (Block 15.5x, Toast 16.5x, PayPal 9x, MercadoLibre 35x), and 12x sales against 1.75x.",
       "The premium is paying for 38% growth against 15% at a 48% gross margin, on a platform the market treats as a software monopoly on independent commerce; the EBIT margin (19%) is no better than the set's, so the gap is all growth and scarcity.",
       "The number is the PEG at 1.3: it only reaches the peers' 0.24 if growth triples or the price falls by three quarters; the stock is priced as a software name, and the set says no payments business is worth 74x."],
 "blind": "Comps cannot see that MercadoLibre is the only peer with the same model, and even it is at half the multiple; the table is a verdict on the peer choice as much as on the stock."},
}
