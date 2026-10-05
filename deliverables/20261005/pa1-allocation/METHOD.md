# PA1 · Portfolio allocation — the method, written before the build (5 Oct 2026)

Alan's chain, 25 Sep: **heat → themes × rotation → knockout in a cohort → saved picks**. "Fundamentals tell what to buy, the Geiger tells when." Everything below is what the Hub already has; this page only puts it in that order. Every number that is a judgement is a dial on the page with a baseline; the page shows the model's answer first, under the baselines, and re-runs when a dial moves. No universal threshold calls anything oversold or extended: every level is a rank among its own peers, and the operator decides the entry level.

## 1 · HEAT — which sectors are hot and cold now (the SECTOR compare)
Eleven FMP sectors. For each, four readings, all live from the chart API at the moment the data file is built (the page prints the age):
- **our names** — the equal-weight mean of the Hub's live Geiger over the sector's served companies (the compare strip's SECTORS · OUR NAMES column);
- **cap-weight funds** — the mean of the three cap-weight sector funds' Geigers (State Street XLx, iShares IYx, Vanguard Vxx — "more than just the State Street");
- **equal-weight fund** — the Invesco RSPx Geiger; the **bow tie** = equal-weight − cap-weight (negative: the giants carry the sector);
- **rotation** — the cap-weight fund's 72-session log return minus SPY's (one swing cycle, the 28 Sep study), in points; 16-session beside it as the short leg.
B1's market-wide read (every computed name at the last close, 2 Oct) is shown per sector with B1's soundness verdict (SOUND / THIN on coverage) and its age; it does not enter the rank where B1 says THIN.
**Heat rank** = the mean of the sector's rank on (our names, cap-weight funds, rotation), weights 1 · 1 · 1 (dials). **Hot** = the top N (baseline 3), **cold** = the bottom N. The bow tie is printed on every column and flags "giants only" when it is below zero; it does not enter the rank (dial, baseline off).

## 2 · THEMES × ROTATION — the cohorts inside the hot sectors
Cohorts = the Hub's tabs, the registry and T12's candidates, as T12 measured them on 3 Oct (`deliverables/20261003/tree-parts/cohorts-measured.json`), with T12's soundness rule: n ≥ 8 with a reading · standard error ≤ 0.10 · held on each of the six closes · biggest industry ≥ 60% or fund-defined. **A thin cohort never runs a knockout** (it is listed, greyed, with why). A cohort belongs to the sector that holds the most of its members (the share is printed); FUNDS, INDEXES, MACRO, INTL/WORLD and CRYPTO are not company cohorts and sit out. Per cohort: live Geiger mean, 72-session rotation of its members vs SPY (equal weight), the count. The hot sectors' sound cohorts go to the knockout, the K soundest per sector (lowest standard error; baseline 3). The cold sectors' sound cohorts run too, so the discussion view can name the weakest.

## 3 · KNOCKOUTS — inside one cohort
Each member gets four readings; each becomes a **rank score inside the cohort** (0 = worst, 1 = best, the percentile among the members that have the number — no universal thresholds):
- **comps (C5)** — the business-first set (≥ 15¢ of every revenue dollar in a shared line; size a soft weight), the field with the MAD-3 outliers out per measure, PEG from forward growth, and the **way-C centre** (the weighted median of every peer's implied price on every priced measure); the reading is the upside from today's price to that centre. **Weight 50.**
- **analyst target** — A4-cleaned notes only (`quality ≠ quarantine`, the split-checked target), the firms' newest note inside 183 days: the median target's upside from today's price and the number of firms (fewer than 3 firms = no reading, a named blank). **Weight 20.**
- **revision direction** — among firms with a note in the last 30 days, raised minus lowered against the same firm's prior target, over the firms that moved (−1 … +1). **Weight 10.**
- **Geiger (timing)** — the member's live Geiger minus the cohort's mean (Alan's "oversold but less than the others"), ranked. **Weight 20.**
**Outliers out** (Alan: "a simple method to kick off some outliers"): a member whose comps upside sits more than 3 MAD from the cohort's median upside is a CANDIDATE FOR ELIMINATION — the same rule C5 uses inside the field — shown hollow with its value and left out of the ranking (dial: 3 MAD; 0 = off). A member with no comps reading (set under 2 peers, no priced measure) is a named blank, not a loser.
**Knockout score** = Σ weight × rank score ÷ Σ weights of the readings the member has (a blank is not a zero). **Survivors** = the top S (baseline 3) by score.

## 4 · PICKS — the survivors, one line each
Every survivor of a hot sector's cohort, deduped (a name in two cohorts keeps its best line), with: sector heat rank · cohort and its soundness · comps rank in the cohort and way-C centre · target median and upside, firms · Geiger vs cohort. **The level is the operator's**: the page prints today's price, the way-C band (low · centre · high) and the target band (low · median · high) and leaves the entry to Alan — no line is drawn.

## 5 · THE DISCUSSION VIEW
One screen: the five strongest and five weakest names by the **full chain** = sector heat (rank score, weight 1) + knockout score (weight 2) over every name that ran a knockout (hot and cold sectors), each with its one-line reasons.

## Dials (all on the page; the model's answer is shown first under these)
hot/cold sectors N = 3 · cohorts per sector K = 3 · heat weights 1/1/1 (our names · cap-weight funds · rotation), bow tie in the rank: off · knockout weights 50/20/10/20 (comps · target upside · revision direction · Geiger) · outlier fence 3 MAD · survivors S = 3 · rotation window 72 sessions · target window 183 days · revision window 30 days · minimum firms 3.

## What the chain does not do
It writes nothing (no table, no comps_decisions). It does not size positions or set cash — the July MODEL sheet's heat → condition → % invested stays Alan's step 1 and is not re-invented here. It does not call anything a buy: it ranks, names its reasons and leaves the level to the operator.

## Sources and ages
Live: the chart API `/geiger` (the Hub's 590), `/quotes`, `/candles tf=D`. Tables (the page's public key): company_profile, ticker_industry, fmp_peers, peer_sources, fundamentals and histories, analyst_estimates, analyst_target_news (A4 columns), fx. Fixtures with their dates: C5 revenue segments (3 Oct, pulled on Fly), T12 cohorts (3 Oct), B1 market bow tie (2 Oct close). Every one is printed on the page with its date.
