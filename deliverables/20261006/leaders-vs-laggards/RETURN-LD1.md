# RETURN LD1 — why the leaders held up and bounced, and why others (CBRS) did not

Second pass, 7 Oct 2026. Written for Alan: plain words, the numbers beside them.

**STATUS: DONE.** Study and branch only. Nothing deployed, no table written, no Fly machine started, no browser window opened on screen, no sub-agent used. No background job of mine is running.

**Branch:** `hub/ld1-leaders-vs-laggards-20261006`, pushed, off live `8001803`. The SHA is the commit that carries this file.
**Page:** `deliverables/20261006/leaders-vs-laggards/LEADERS-VS-LAGGARDS.html` (BACK / CLOSE pair in place).

## How this run went

An earlier run of this brief, on the afternoon of 6 Oct, built the study page and then stopped at the weekly usage limit before it could return. Its work was pushed but nobody had checked it, and a list of faults three reviewers had found in its opinion was never applied. So this run did not start again. It tested that work first-hand, corrected what the test found, rewrote the opinion to the reviewers' list, and finished.

## What was re-read first-hand, and what it found

- **Prices.** I pulled every close again from the chart API, through 6 Oct. All 580 saved price figures match. The ranking, re-run from its saved inputs, came out the same file byte for byte.
- **Profit estimates, 90 days ago against now** (18 of the 52 names). The 8 pairs the first run had saved match to the cent. 4 directions that rested only on analysts' notes are confirmed by a measured pair. 6 names that had no reading now have one (Palo Alto flat, CrowdStrike flat, Reddit up, Cipher down, Eos down, Riot down). 5 pages would not load after three tries.
- **Guidance**, against the company's own release: 5 of 5 match.
- **Twelve statistics pages** (six leaders, six laggards, drawn with a fixed seed), six figures each: 66 of 72 within 5%, and all 47 yes/no readings they decide (profit, cash coming in, share count up, cash against debt) come out the same.
- **Cerebras, fact by fact**, against its filing, its 12 Aug release, the lock-up article and the insider table: 17 facts, all confirmed. Two were extended: the lock-up schedule (corrected in two details) and the insider sales (five sales the first run could not see).
- **A test on names the finding was not built from.** On the 6 Oct close six names enter the top 25 that had never been read. I could read four (Dell, Palantir, Synopsys, Zscaler): profit estimates raised at 4 of 4, full-year guidance raised at 3 of 4.

What the checking changed on the page:

- Everything is now shown at the **6 Oct close**. The groups stay as ranked on 5 Oct, because those are the names the figures were read for. One day later 19 of the 25 leaders are still in the top 25 (the other six sit between 26th and 37th) and 17 of the bottom 20 are unchanged. **Cerebras moved from 112th to 127th of 145: it is now in the bottom 20 on its own numbers.**
- Market value is on **one basis**. The first draft said the leaders added $1.06 trillion in one place and $1.12 trillion in another; it is one figure now. The field total had counted Alphabet's two share lines as two companies, about $4.2 trillion too much; fixed.
- "Guidance raised" now says **which kind**: 8 leaders raised full-year numbers they had published; 16 guide one quarter at a time and set it above what analysts expected.
- Two counts the first opinion leaned on **moved when one day was added** and are marked soft: "its comps were also up over the month" went from 3 of 22 laggards to 8 of 22, and "profit still separates inside an industry" went from no gap to a clear one.

## The leaders and laggards

Ranked on three things inside a field of 145 companies (AI, chips, software and internet, grid): 3-month return, 1-month return, Hub Geiger. "The fall" is 30 Jun to 15 Sep. "The bounce" is 15 Sep to the 6 Oct close.

**Leaders (25)**

| Name | Line | 3 mo | Bounce | Geiger | Outlook at last report | Profit estimate, 90 days | Sales, last quarter | Makes a profit | Shares, 1 year | Forward P/E / comps | Value 15 Sep → 6 Oct |
|---|---|---|---|---|---|---|---|---|---|---|---|
| P | storage | +89% | +52% | +1.00 | raised: full year | raised | +38% | yes | +2% | 44× / 30× | $32B → $49B |
| LITE | optical / network | +60% | +35% | +0.92 | raised: above forecasts | raised | +109% | no | +7% | 52× / 36× | $75B → $102B |
| CRWD | cyber | +46% | +15% | +0.88 | raised: full year | flat | +26% | yes | +3% | 193× / 50× | $249B → $286B |
| OKTA | cyber | +49% | +15% | +0.81 | raised: full year | raised | +11% | yes | -3% | 54× / 45× | $33B → $38B |
| AMD | AI chips | +26% | +29% | +0.90 | raised: above forecasts | raised | +50% | yes | +1% | 57× / 35× | $823B → $1.06T |
| S | cyber | +45% | +10% | +0.81 | raised: full year | cut | +21% | no | +3% | 65× / 45× | $8.2B → $9.0B |
| AXTI | optical / network | +40% | +46% | +0.49 | raised: above forecasts | raised | +165% | yes | +40% | 53× / 20× | $3.8B → $5.5B |
| ENTG | chip equipment | +20% | +29% | +0.76 | raised: above forecasts | raised | +11% | yes | +1% | 37× / 22× | $20B → $25B |
| MRVL | AI chips | +24% | +29% | +0.75 | raised: above forecasts | raised | +37% | yes | +3% | 53× / 35× | $194B → $252B |
| NTAP | storage | +38% | +20% | +0.89 | raised: full year | raised | +30% | yes | -3% | 23× / 36× | $37B → $45B |
| PANW | cyber | +31% | +12% | +0.87 | raised: above forecasts | flat | +34% | yes | +22% | 97× / 50× | $307B → $343B |
| TER | chip equipment | +22% | +29% | +0.54 | raised: above forecasts | raised | +104% | yes | -3% | 44× / 28× | $52B → $67B |
| NET | cyber | +30% | +8% | +0.63 | raised: full year | raised | +36% | no | +2% | 240× / 50× | $117B → $126B |
| FTNT | cyber | +22% | +11% | +0.96 | raised: above forecasts | raised | +26% | yes | -3% | 52× / 50× | $126B → $140B |
| FORM | chip equipment | +27% | +39% | +0.34 | raised: above forecasts | raised | +32% | yes | +2% | 41× / 20× | $8.0B → $11B |
| TSM | AI chips | +10% | +17% | +0.92 | raised: full year | raised | +36% | yes | +0% | 21× / 35× | $2.15T → $2.50T |
| TWLO | AI software | +30% | +16% | +0.32 | raised: full year | raised | +22% | yes | +0% | 49× / 46× | $37B → $43B |
| SMCI | servers | +54% | +22% | +0.69 | raised: above forecasts | raised | +93% | yes | +11% | 10× / 25× | $23B → $29B |
| NTNX | AI software | +36% | +8% | +0.84 | raised: above forecasts | raised | +16% | yes | -1% | 32× / 50× | $18B → $20B |
| ANET | optical / network | +19% | +12% | +0.91 | raised: above forecasts | raised | +38% | yes | -0% | 45× / 22× | $243B → $272B |
| ADI | analog chips | +9% | +16% | +0.82 | raised: above forecasts | raised | +40% | yes | -1% | 26× / 35× | $175B → $204B |
| TSEM | analog chips | +19% | +32% | +0.61 | raised: above forecasts | raised | +24% | yes | +1% | 50× / 22× | $22B → $29B |
| DDOG | AI software | +7% | +21% | +0.68 | raised: above forecasts | raised | +36% | yes | +2% | 105× / 21× | $83B → $100B |
| MPWR | analog chips | +12% | +29% | +0.58 | raised: above forecasts | raised | +48% | yes | +1% | 46× / 26× | $56B → $72B |
| META | internet | +23% | +10% | +0.56 | kept | cut | +28% | yes | -1% | 23× / 25× | $1.71T → $1.88T |

**Laggards (22: the bottom 20 on 5 Oct, plus CBRS and IREN because they were named)**

| Name | Line | 3 mo | Bounce | Geiger | Outlook at last report | Profit estimate, 90 days | Sales, last quarter | Makes a profit | Shares, 1 year | Forward P/E / comps | Value 15 Sep → 6 Oct |
|---|---|---|---|---|---|---|---|---|---|---|---|
| SHAZ | servers | -37% | -4% | -0.72 | gives none | cut | +412% | no | +255% | none / 15× | $1.8B → $1.7B |
| DKNG | internet | -27% | -20% | -0.50 | kept | cut | -5% | no | -0% | 37× / 21× | $12B → $9.8B |
| APP | AI software | -47% | -16% | -0.63 | – | cut | +53% | yes | -2% | 16× / 30× | $111B → $93B |
| WULF | neocloud / miner | -34% | +3% | -0.55 | kept | cut | -6% | no | +12% | none / 31× | $7.2B → $7.5B |
| BKNG | internet | -10% | -8% | -0.63 | – | flat | +8% | yes | -4% | 14× / 27× | $129B → $118B |
| CIFR | neocloud / miner | -29% | +3% | -0.47 | gives none | cut | -43% | no | +13% | none / – | $6.3B → $6.4B |
| SMR | power / nuclear | -8% | -5% | -0.40 | gives none | cut | -99% | no | +132% | none / 29× | $3.6B → $3.4B |
| NFLX | internet | -9% | -12% | -0.38 | kept | flat | +13% | yes | -1% | 20× / 25× | $324B → $286B |
| NRG | power / nuclear | -25% | -2% | -0.15 | kept | cut | +11% | yes | +8% | 9× / 16× | $22B → $22B |
| IBM | IT services | -27% | -11% | -0.63 | lowered | cut | +1% | yes | +1% | 17× / 51× | $234B → $208B |
| UUUU | power / nuclear | -14% | -5% | -0.17 | kept | cut | +496% | no | +13% | none / 19× | $3.1B → $3.0B |
| OKLO | power / nuclear | -18% | +7% | -0.12 | lowered | cut | – | no | +30% | none / 18× | $6.7B → $7.2B |
| EOSE | power / nuclear | -28% | -20% | -0.33 | lowered | cut | +351% | no | +40% | none / 29× | $1.5B → $1.2B |
| TTWO | internet | -19% | -4% | -0.57 | kept | cut | +2% | no | +5% | 25× / 13× | $40B → $38B |
| APLD | neocloud / miner | -19% | +8% | -0.27 | gives none | raised | +407% | no | +37% | none / 31× | $6.8B → $7.4B |
| CORZ | neocloud / miner | -29% | +4% | -0.25 | gives none | cut | +109% | no | +4% | 63× / 24× | $5.2B → $5.4B |
| RIOT | neocloud / miner | -10% | -4% | -0.54 | gives none | cut | +14% | no | +10% | none / – | $7.4B → $7.1B |
| LEU | power / nuclear | -8% | +8% | -0.03 | kept | – | +14% | yes | +10% | 63× / 18× | $2.9B → $3.1B |
| RDDT | internet | -24% | -7% | -0.29 | raised: above forecasts | raised | +61% | yes | +1% | 25× / 23× | $31B → $29B |
| WDC | storage | -25% | -0% | -0.53 | raised: above forecasts | raised | +44% | yes | +7% | 22× / 32× | $154B → $154B |
| CBRS | AI chips | -3% | -4% | -0.50 | raised: full year | raised | +74% | no | +61% | none / 29× | $44B → $42B |
| IREN | neocloud / miner | -4% | -1% | -0.23 | kept | cut | -27% | no | +42% | none / 94× | $16B → $16B |

**Named in the brief, mid-field (5)**

| Name | Line | 3 mo | Bounce | Geiger | Outlook at last report | Profit estimate, 90 days | Sales, last quarter | Makes a profit | Shares, 1 year | Forward P/E / comps | Value 15 Sep → 6 Oct |
|---|---|---|---|---|---|---|---|---|---|---|---|
| CRWV | neocloud / miner | +2% | +13% | +0.38 | raised: above forecasts | cut | +112% | no | +13% | none / 49× | $45B → $51B |
| NBIS | neocloud / miner | +15% | +20% | +0.62 | kept | cut | +454% | yes | +22% | none / 49× | $57B → $68B |
| MU | storage | +10% | +13% | +0.14 | raised: above forecasts | raised | +379% | yes | +2% | 6× / 35× | $1.05T → $1.18T |
| SNDK | storage | -4% | +8% | -0.14 | raised: above forecasts | raised | +372% | yes | +0% | 8× / 35× | $224B → $243B |
| STX | storage | -6% | +4% | -0.25 | raised: above forecasts | raised | +48% | yes | +6% | 25× / 32× | $176B → $183B |

## What separates them, as counts

Each count is out of the names where a reading could be found, so the totals change from line to line.

| Condition | Leaders | Laggards | How sure |
|---|---|---|---|
| Gave a higher outlook at the last report (raised its own full-year numbers, or guided above what analysts expected) | 24 of 25 | 3 of 20 | clear |
| Analysts raised the earnings estimate over the last 90 days | 21 of 25 | 4 of 21 | clear |
| Analysts cut the earnings estimate over the last 90 days | 2 of 25 | 15 of 21 | clear |
| Sales grew 20% or more in the latest quarter (year on year) | 22 of 25 | 9 of 21 | clear |
| Earns a profit (earnings per share above zero over twelve months) | 22 of 25 | 8 of 22 | clear |
| Brings in more cash than it spends (free cash flow above zero) | 23 of 25 | 9 of 22 | clear |
| Operating margin is higher than a year ago | 23 of 25 | 9 of 21 | clear |
| Share count is up more than 3% in a year | 6 of 25 | 16 of 22 | clear |
| More stock coming up for sale (insiders freed to sell after a listing, a new share sale, debt that turns into shares, heavy selling by executives) | 2 of 25 | 11 of 22 | clear |
| Raised money (shares, convertibles or sizeable debt) since 1 July | 3 of 24 | 9 of 21 | clear |
| Holds more cash than debt | 20 of 25 | 8 of 22 | clear |
| Rose between 30 June and 15 September while the chip fund fell 17% | 13 of 25 | 1 of 22 | clear |
| Its comparable companies are also up over the last month (their median) | 23 of 25 | 8 of 22 | clear |
| Costs more per dollar of next year's expected profit than its typical comp (forward P/E above its comps' median) | 19 of 25 | 5 of 11 | leans |
| Leans on a few customers (one at 20%+ of sales, or the top three at 50%+) | 7 of 24 | 10 of 18 | leans |
| Sales expected to grow 15% or more next fiscal year | 11 of 16 | 14 of 17 | no real difference |
| Earnings per share expected to grow 15% or more next fiscal year | 20 of 25 | 6 of 9 | no real difference |
| Company value to sales is above its comps' median (EV/sales) | 18 of 25 | 17 of 22 | no real difference |
| Gross margin is higher than a year ago | 14 of 25 | 12 of 21 | no real difference |

Among names that fell hard in the summer: a higher outlook at 10 of 10 that bounced against 2 of 13 that stayed down (but 8 of the 10 that bounced are chip companies, so this is partly chips against everything else).

## The opinion (the agent's own read, not a measurement)

OPINION. The leaders led because their numbers were going up, not because they are forecast to grow fastest. At the last report 24 of 25 leaders gave a higher outlook (8 raised full-year numbers, 16 guided above what analysts expected) against 3 of 20 laggards; analysts raised the profit estimate for 21 of 25 leaders and cut it for 15 of 21 laggards. The laggards actually have the bigger forecasts (the middle one 98% sales growth next year against 21%), but it is a promise from a small base, paid for by selling stock (shares up more than 3% at 16 of 22 against 6 of 25), and it was being marked down. So nothing here contradicts your growth rule, but it fits in a narrower form: what went with leading was growth already showing in results and being revised higher. Cerebras is the exception that shows the other thing that matters, stock for sale: its numbers went up like a leader's and its comps rose 26%, but about 100 million locked-up shares have been freed since 12 August, nearly three times the 34.5 million sold at its listing, with more on 14 and 28 October and 9 November, at 52 times sales. The storage names and Reddit are the exception the other way: raised numbers, profits and cash, and still lagging, because the market doubts the numbers will last (a competitor doubling hard-disk output; AI answers diverting Reddit's search traffic). A test on names the finding was not built from agrees: of the six that enter the top 25 on the 6 October close, the four I could read all had estimates raised. This is what went with leading over one three-month stretch, on groups picked after the fact; it does not prove cause.

The page gives it at full length with the evidence beside it and eight things that argue against it.

## Market value

Shares × close. Share counts are the public page's for the 52 names read one by one and the Hub company profile's for the other 93.

| Leader | 30 Jun | 15 Sep | 6 Oct | Added in the bounce |
|---|---|---|---|---|
| TSM Taiwan Semiconductor Manufac | $2.48T | $2.15T | $2.50T | +$355B |
| META Meta Platforms | $1.43T | $1.71T | $1.88T | +$175B |
| AMD Advanced Micro Devices | $948B | $823B | $1.06T | +$237B |
| PANW Palo Alto Networks | $279B | $307B | $343B | +$37B |
| CRWD CrowdStrike Holdings | $196B | $249B | $286B | +$37B |
| ANET Arista Networks | $214B | $243B | $272B | +$28B |
| MRVL Marvell Technology | $261B | $194B | $252B | +$57B |
| ADI Analog Devices | $192B | $175B | $204B | +$29B |
| FTNT Fortinet | $113B | $126B | $140B | +$14B |
| NET Cloudflare | $87B | $117B | $126B | +$9.9B |
| LITE Lumentum Holdings Inc. | $77B | $75B | $102B | +$26B |
| DDOG Datadog | $93B | $83B | $100B | +$17B |
| MPWR Monolithic Power Systems | $68B | $56B | $72B | +$16B |
| TER Teradyne | $76B | $52B | $67B | +$15B |
| P Everpure | $26B | $32B | $49B | +$17B |
| NTAP NetApp | $30B | $37B | $45B | +$7.6B |
| TWLO Twilio Inc. | $32B | $37B | $43B | +$5.9B |
| OKTA Okta | $24B | $33B | $38B | +$4.9B |
| TSEM Tower Semiconductor Ltd. | $29B | $22B | $29B | +$7.2B |
| SMCI Super Micro Computer | $19B | $23B | $29B | +$5.1B |
| ENTG Entegris | $27B | $20B | $25B | +$5.7B |
| NTNX Nutanix | $14B | $18B | $20B | +$1.5B |
| FORM FormFactor | $13B | $8.0B | $11B | +$3.1B |
| S SentinelOne | $5.9B | $8.2B | $9.0B | +$0.8B |
| AXTI AXT | $4.7B | $3.8B | $5.5B | +$1.7B |
| **The 25 leaders** | **$6.740T** | **$6.595T** | **$7.709T** | **+$1.114T** |
| The 22 laggards | $1.380T | $1.170T | $1.070T | −$100B |
| The whole field (145; Alphabet counted once) | $35.891T | $34.784T | $38.049T | +$3.265T |

Three leaders are 71% of the leaders' value (TSMC, Meta, AMD). The middle leader is worth $72 billion. Cerebras: $52.5 billion on 30 Jun, $43.7 billion on 15 Sep, $42.1 billion on 6 Oct.

On "pushed the indexes higher": I did not measure the indexes themselves. Inside this field the 25 leaders were about a third of the dollars added. Nvidia alone added $656 billion and Microsoft $239 billion and neither is among the 25; five names (Nvidia, TSMC, Microsoft, AMD, Meta) are 51% of the field's gain. Over the same three weeks the Nasdaq-100 fund rose 7.8%, the S&P 500 fund 2.9%, and the equal-weight S&P fell 0.8%.

**Every cohort in the field** (a company in two cohorts is counted in both; the field total counts each once):

| Cohort | Names | 30 Jun | 15 Sep | 6 Oct | In the bounce | Leaders · laggards |
|---|---|---|---|---|---|---|
| Semicap, materials & chip design | 13 | $2.64T | $1.76T | $2.14T | +21% | 3 · 0 |
| Analog, RF & power semis | 11 | $809B | $682B | $790B | +16% | 3 · 0 |
| AI accelerators & logic | 13 | $11.81T | $10.99T | $12.63T | +15% | 3 · 1 |
| AI networking & optical | 14 | $1.52T | $1.31T | $1.51T | +15% | 3 · 0 |
| AI powertrain | 12 | $661B | $545B | $620B | +14% | 0 · 6 |
| Grid & electrical equipment | 9 | $976B | $808B | $919B | +14% | 0 · 0 |
| Cybersecurity | 7 | $727B | $872B | $978B | +12% | 6 · 0 |
| Neoclouds & AI miners | 12 | $223B | $168B | $187B | +11% | 0 · 6 |
| Memory & storage | 6 | $2.15T | $1.67T | $1.85T | +11% | 2 · 1 |
| AI servers & datacenter kit | 4 | $438B | $476B | $509B | +7% | 1 · 1 |
| Robotics & automation | 5 | $188B | $176B | $186B | +6% | 0 · 0 |
| AI software & data platforms | 16 | $4.29T | $5.46T | $5.72T | +5% | 3 · 1 |
| Datacenter property | 4 | $213B | $205B | $212B | +4% | 0 · 0 |
| Internet & consumer platforms | 18 | $9.33T | $9.61T | $9.82T | +2% | 1 · 5 |
| IT services & consulting | 3 | $362B | $373B | $349B | -6% | 0 · 1 |

## Evidence

- **Tests.** Hub suite on the finished branch: 1,982 tests, 1,972 pass, 7 fail, 3 skipped. The 7 are the known failures on live (Indicator Lab checkpoint, MONTH grid, REGIME card, age function, readiness, saved review charts, xfeed-publish). The first run's final was 1,974 / 1,964 / 7. I added 8 tests for the second pass; the LD1 file is 15 of 15. On one full run a Clock timing test also failed; it passes alone and passed on the next full run (other lanes were running on this Mac).
- **Pictures.** Headless only, at 1680 and 390, in `shots/`. I opened and examined: the top (the fall-and-bounce picture, every studied name labelled and legible), the counts picture, the new Cerebras picture (price in green and red by day, the $185 listing line, a bar per lock-up release, filled when freed and outlined when still to come), the opinion at both widths, the market-value table, and the re-check tables. The page is exactly 1680 and 390 wide with no sideways overflow, no text under 11px, no page errors, and no request left the test browser. On a phone the two wide pictures scroll sideways inside their panel.

## Not done or not verified

- **The house database was not read.** In the first run two permission checks declined backend reads. Those stand; I did not retry them or look for another way in. So the 90-day estimate history the database keeps is not in this study, and the company figures come from public web pages.
- I re-read a part, not the whole: 18 of 52 profit estimates, 5 of 52 guidance calls, 12 of 52 statistics pages, and Cerebras in full. The other figures stand on the first run's two AI readers.
- Five estimate pages would not load (FormFactor, Super Micro, NuScale, Entegris, Centrus). Of the six names that enter the top 25 on 6 Oct, Rambus and Zeta would not load, and none of the six was read in full.
- The reason given for the hard-disk makers' fall (Toshiba doubling output) rests on one news headline. The Cerebras item about OpenAI and Nvidia is market talk reported by one site.
- This shows what went with leading over one three-month stretch, on groups picked on price after the fact. It does not prove cause.

## Decisions for Alan (two)

1. **Put "are the numbers going up?" on the comps card**: whether the last outlook was raised, and the 90-day change in the profit estimate. **Recommend yes.** It separated leaders from laggards more than the size of the growth forecast did (21 of 25 against 4 of 21), and it held on four names the finding was not built from.
2. **Show stock coming up for sale on recently listed names** (lock-up dates and sizes, one line on the company view). **Recommend yes**, for names listed in the last year. Cerebras had a leader's numbers and about 100 million shares freed for sale in seven weeks.

## For the coordinator (not for Alan)

- The Hub's company profiles carry older share counts than the public pages for names that issued stock lately: Lumentum 13% fewer shares, AXT 23%, and NuScale, Eos, Nebius and IREN 10% or more. Any surface that shows market value from the profile reads low for them.
- Any cohort total that adds GOOGL and GOOG counts Alphabet twice: the profile gives each line the whole company's value.
- `tools/select.py` in this folder has the same name as Python's own `select` module. A networked script placed beside it runs it on import. It happened once here (it re-wrote `selection.json`, byte-identical); `closes.py` now guards against it. Rename it if the folder is reused.
- The Hub's green and red cannot be told apart by a red-green colour-blind reader (a palette check gives a separation of 1.6 where 8 is the target). Every coloured figure on this page also carries a sign or an arrow.
- If house figures are wanted in place of web-read ones, the 90-day revision history in `analyst_estimates_daily` is the table to read. This lane did not read it.
