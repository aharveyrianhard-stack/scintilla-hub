#!/usr/bin/env python3
"""Build prototypes/report-library/index.html - ONE deduplicated company report.

Every distinct section found across the recovered company reports (the 22 Sep
library: executive briefs, levels labs, earnings logs, scans, comparisons,
templates, protocols, DCF notes, the BTC page) is listed once, grouped into the
shape of a per-ticker digest, and marked against the Hub at production:

  HAVE      the section is on the Hub company page, board or rooms
  PARTIAL   only part of it, only on the demo fundamentals page or a separate
            tool, or present in code but not verified on screen
  NONE      nowhere on the Hub

Inventory and mapping only - no new analysis. The page is generated from the
data below so the counts on it can never drift from the list.

    python3 scripts/build-report-library.py
"""
import os, json

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "prototypes", "report-library", "index.html")
HUB_PROD = "4c1466c"
READ_DATE = "23 Sep 2026"

# The recovered reports that were read, by title and file date. Two files were
# byte-level duplicates of others (the MU post-earnings PDF of its HTML; the
# 8 May Growth Leaders PDF, an earlier print of the 9 May page) and are folded in.
REPORTS = {
 "googl_exec":   ("GOOGL executive brief", "23 Jun"),
 "googl_lab5":   ("GOOGL Levels Lab v3", "12 Jul"),
 "googl_worked4":("GOOGL worked example 4", "12 Jul"),
 "googl_worked1":("GOOGL worked example 1", "11 Jul"),
 "googl_geiger": ("GOOGL interactive Geiger v2", "28 Jun"),
 "googl_tape":   ("GOOGL verdict tape", "28 Jun"),
 "mu_post":      ("MU post-earnings analysis", "24 Jun"),
 "mu_note":      ("MU pre-earnings note", "24 Jun"),
 "mu_brief":     ("MU pre-earnings brief", "24 Jun"),
 "mu_est":       ("MU analyst-estimates page", "4 Jun"),
 "mu_deepdive":  ("MU deep dive", "10 May"),
 "mu_fullstack": ("MU full-stack scan", "9 May"),
 "nvda_fullstack":("NVDA full-stack scan", "9 May"),
 "sndk_fullstack":("SNDK full-stack scan", "9 May"),
 "fav_brief":    ("Favorites Brief, six names", "23 Jun"),
 "comparison":   ("MU vs SNDK vs NVDA comparison", "14 May"),
 "growth_leaders":("Growth Leaders forward analysis", "9 May"),
 "watchlist":    ("Watchlist review, 88 symbols", "8 May"),
 "yf_watchlist": ("Analyst-revision watchlist", "16 May"),
 "earn_runbook": ("Earnings-catcher runbook v1", "22 Jul"),
 "earn_display": ("Earnings panel design v3", "15 Jul"),
 "earn_inline":  ("Inline beat/miss earnings block", "18 Jul"),
 "template":     ("Equity Desk template", "23 Jun"),
 "protocol":     ("Equity proposal and ladder protocol v0.1", "23 Jun"),
 "dossier":      ("Dossier agent protocol", "15 Jun"),
 "company_page": ("Company page layout proposal (AFRM)", "1 Jul"),
 "company_full": ("Company page full mock (CRWD)", "1 Jul"),
 "dcf_mstar":    ("Morningstar vs Scintilla DCF, NVDA", "22 Jul"),
 "dcf_v1":       ("Scintilla DCF V1.1", "5 Aug"),
 "fmp_demo":     ("FMP capability demo (the fundamentals page)", "24 Jul"),
 "btc":          ("BTC company page v0.0.7", "6 Jun"),
 "nvda_geiger":  ("NVDA Geiger plain-language worksheet", "19 Jun"),
}

HUB = "https://scintillahub.ai/"
FUND = "https://scintillahub.ai/fundamentals/"
ALLOC = "https://allocation.scintillahub.ai/"

GROUPS = [
 ("identity",  "Identity",                 "Who the company is and what the desk thinks, before any number."),
 ("price",     "Price &amp; Geiger",       "The chart, the dial, the timeframes and the levels."),
 ("fund",      "Fundamentals &amp; multiples", "Growth, margins, the multiple now, against history and against the Street."),
 ("debt",      "Debt &amp; capital",       "Balance sheet strength and what the cash goes to. No recovered report carried a maturity ladder, interest coverage or a credit rating - that section was not found anywhere."),
 ("comps",     "Comparables",              "The company next to its peers on the same yardsticks."),
 ("sent",      "Sentiment",                "News, social, the Street's changes of mind, insiders."),
 ("events",    "Events",                   "Earnings before and after, catalysts, cadence."),
 ("risk",      "Risks &amp; the plan",     "What voids the thesis, and the ladder - the plan is listed here because it is where risk gets sized."),
]

# (group, title, what it is, found_in, status, where on the Hub, link, judgement)
S = []
def sec(g, t, what, found, status, where, link, judge):
    S.append(dict(g=g, t=t, what=what, found=found, status=status, where=where, link=link, judge=judge))

# ---- Identity ---------------------------------------------------------------
sec("identity", "Header: ticker, company, exchange, cohort, live price and day change",
 "The first line of every report - name, class, where it trades, the cohort it belongs to, last price and today's move.",
 ["template","googl_exec","fav_brief","company_page","company_full","mu_note","mu_est","btc","growth_leaders"],
 "HAVE", "Hub board row (Ticker, Last, Chg) and the company header when a row is tapped; sector and industry on the STATS tab.", HUB,
 "Keep - already the front of every company view.")
sec("identity", "Snapshot bar: price, day change, distance from the 52-week high, volume state, next earnings, as-of time",
 "The 'hub at a glance' strip the template and the protocol both open with.",
 ["template","protocol","googl_exec","fav_brief","growth_leaders","mu_deepdive","btc","nvda_fullstack"],
 "HAVE", "Spread over three places: STATS (last, 52wk range, from 52w high / low, avg volume), the board (RVol), EVENTS (next earnings).", HUB,
 "Yes - it exists, but as three visits. One strip at the top of the company page would do.")
sec("identity", "Business description: what it does, revenue mix, the theme",
 "Two to four plain sentences on the business, as the Growth Leaders scan and the watchlist themes wrote them.",
 ["growth_leaders","watchlist","company_page","company_full","dossier"],
 "HAVE", "READ tab, BUSINESS sub-tab, filled from the ticker dossier.", HUB,
 "Keep - its freshness depends on the dossier refresh, which should be dated on screen.")
sec("identity", "The call: ACCUMULATE / HOLD / TRIM with the one-line why and a regime tag",
 "The verdict every report leads with - the exec brief's 'The Call', the scans' 'Setup verdict', the comparison's 'Headline answer', the earnings logs' 'Bottom line'.",
 ["template","protocol","googl_exec","fav_brief","mu_fullstack","nvda_fullstack","sndk_fullstack","comparison","mu_post","mu_note","growth_leaders","btc","watchlist"],
 "PARTIAL", "READ tab, VERDICT sub-tab carries written prose from the dossier; the board has a Read column. There is no logged ACCUMULATE / HOLD / TRIM label with its one-line why.", HUB,
 "Yes - the first thing to read. Make it a logged field, not prose.")
sec("identity", "Verdict log: the call recorded so it can be scored later",
 "The template marks the verdict 'logged for training'; the protocol writes it to a verdict log.",
 ["template","protocol"],
 "NONE", "Not on the Hub.", None,
 "Yes - cheap, and the only way to learn whether the calls were right.")
sec("identity", "Key stats: market cap, shares out, fully diluted, 52-week range, all-time high and low, average volume, beta",
 "The stats block on the BTC page and the 'quick numbers' table of the MU deep dive.",
 ["btc","mu_deepdive","comparison","mu_note","growth_leaders","yf_watchlist"],
 "HAVE", "STATS tab (market cap, shares out, 52wk range, avg volume, beta); Mkt Cap on the board. All-time high and low are not shown.", HUB,
 "Keep as it is.")
sec("identity", "Method and provenance: sources, as-of time per number, freshness labels, VERIFIED / THEORY tags, the not-advice line",
 "The template's section 08, the scans' methodology and data-sources blocks, the footers of the briefs and earnings logs, the DCF caveats.",
 ["template","growth_leaders","fav_brief","mu_post","mu_note","googl_exec","dcf_mstar","fmp_demo","googl_lab5"],
 "PARTIAL", "Pieces exist - estimate cells name their basis and as-of date, the Geiger tab names its provider, session state is shown - but there is no provenance block per section and no disclaimer line.", HUB,
 "Yes - non-negotiable for trust, and most of the inputs are already held.")

# ---- Price & Geiger ---------------------------------------------------------
sec("price", "Price chart with moving averages and a volume pane",
 "The picture at the top of the labs, the BTC live chart, the CHART tab of the company-page mocks.",
 ["btc","company_page","company_full","googl_lab5","googl_worked4","googl_exec"],
 "HAVE", "CHART tab on the company page, plus the TradingView modal.", HUB,
 "Keep.")
sec("price", "Geiger composite: the dial from -1 to +1 with its families (trend, momentum, structure or volume)",
 "The interactive GOOGL Geiger, the BTC Geiger dial, the 'geiger · trend · momentum · composite' row on every name in the Favorites Brief.",
 ["googl_geiger","btc","fav_brief","googl_exec","company_page","company_full","googl_worked4","nvda_geiger"],
 "HAVE", "Geiger column on the board; GEIGER tab (composite, trend, momentum from RSI + Williams, volume three-ring); cohort aggregate Geiger in the compare strip.", HUB,
 "Keep - the centre of the product.")
sec("price", "Per-timeframe score table: timeframe, weight, trend, RSI, Williams %R, momentum, structure, composite, flags",
 "The audit trail under the dial - one row per timeframe with the user's weights.",
 ["googl_geiger","googl_worked4","googl_worked1","nvda_geiger","btc"],
 "PARTIAL", "GEIGER tab shows the family values; RSI and Williams by timeframe exist in the page; the full weighted table lives only behind the Equalizer settings.", HUB,
 "Yes for the digest - it is how a reader checks the dial.")
sec("price", "Verdict tape: higher-high / lower-low structure regime per timeframe over time",
 "Rows of timeframes coloured by structure, the verdict row weighted by the equalizer, hatched where the frames disagree.",
 ["googl_tape","googl_geiger","googl_worked4"],
 "NONE", "Not on the Hub.", None,
 "Maybe - a strong visual, but the structure rules were still open when the lab stopped.")
sec("price", "Trend fan: every moving average (EMA 5 / 8 / 13 / 21 / 34, SMA 50 / 100 / 150 / 200) with its distance from price, supports below and resistances above",
 "The 'full MA set' table of the labs and the two-way ladder of MAs in the exec brief.",
 ["googl_lab5","googl_worked4","googl_worked1","googl_exec","fav_brief","template","protocol","nvda_fullstack","mu_fullstack","sndk_fullstack","btc"],
 "PARTIAL", "CHART draws the averages and the company tile reads provider EMA / SMA values; there is no 'percent from each average' ladder.", HUB,
 "Yes - cheap, explicit, and what the ladder is built on.")
sec("price", "Momentum readings per timeframe: RSI 14, Williams %R, MACD, Bollinger bands, exhaustion flags, overbought warnings, relative volume",
 "The weekly and daily tables of the full-stack scans; the BTC live momentum panel.",
 ["nvda_fullstack","mu_fullstack","sndk_fullstack","btc","googl_exec","googl_worked4","comparison"],
 "PARTIAL", "RSI (board column and tab) and Williams (tab) are shown; MACD only inside the TradingView modal; no Bollinger, no exhaustion flags.", HUB,
 "Keep RSI and Williams; add MACD or Bollinger only if they are used.")
sec("price", "Structure read: where it stands - pivots, higher highs and lows, drawdown from the high, position against the averages, pullback depth",
 "The written 'Where it stands' paragraph of the exec brief and Favorites Brief; the template's technical lens.",
 ["googl_exec","fav_brief","template","protocol","nvda_fullstack","mu_fullstack","btc"],
 "PARTIAL", "STATS gives distance from the 52-week high and low; GEIGER gives trend; the only written read is the dossier prose on the READ tab.", HUB,
 "Yes - two sentences generated from numbers the Hub already holds.")
sec("price", "Levels and zones map: support and resistance zones with confluence count and members, unfilled gaps, round numbers, repeated tags",
 "The most-worked object in the library - five versions of the GOOGL lab, plus the key-levels tables of every scan.",
 ["googl_lab5","googl_worked4","googl_worked1","nvda_fullstack","mu_fullstack","sndk_fullstack","googl_exec","mu_deepdive"],
 "NONE", "Not on the Hub.", None,
 "Yes - it is the input to every ladder. It was waiting on the database's intraday bars.")
sec("price", "Volatility dials: ATR 14, zone band, pivot window, gap threshold",
 "The explicit knobs the lab used to build zones - all marked strawmen.",
 ["googl_lab5"],
 "NONE", "Not on the Hub.", None,
 "Only as settings behind the levels map, not as a section.")
sec("price", "Sessions: London / pre-market, New York, after-hours highs and lows",
 "Hours-of-day cuts of the day's range.",
 ["googl_lab5"],
 "NONE", "Not on the Hub.", None,
 "No - chart and Station territory, not the digest.")
sec("price", "Gradient ladders: trend, momentum, volatility, volume and price per timeframe as live cells",
 "The BTC page's nine-timeframe ladder of real bars.",
 ["btc","protocol"],
 "NONE", "Not on the Hub; the Geiger tab carries the same families as one dial.", None,
 "Later, maybe - a visual born on crypto; the dial already says it.")
sec("price", "Equalizer: timeframe weights and family dials, the user's saved rows",
 "The sliders under the interactive Geiger and the weights column of the worked examples.",
 ["googl_geiger","googl_tape","googl_worked4","nvda_geiger"],
 "HAVE", "Scintilla menu, Equalizer (the saved rows).", HUB,
 "Keep - not a digest section, but the digest must name which weights produced its numbers.")
sec("price", "Volume confirmation: relative volume, volume state, buy / sell split",
 "The template's volume state and RVOL cell; the scans' relative-volume rows.",
 ["template","protocol","nvda_fullstack","mu_fullstack","btc","googl_exec"],
 "HAVE", "RVol on the board; the volume three-ring on the GEIGER tab; average volume on STATS.", HUB,
 "Keep.")

# ---- Fundamentals & multiples ----------------------------------------------
sec("fund", "Fundamental lens: revenue and EPS growth, segment growth, gross / net / free-cash-flow margin, quality",
 "The template's section 03 and the protocol's 'simple lens'; the growth profile of the scans; the margin and return rows of the comparison.",
 ["template","protocol","googl_exec","fav_brief","growth_leaders","comparison","mu_deepdive","fmp_demo"],
 "HAVE", "ESTIMATES 01 tiles (EPS, revenue, EBITDA, net income, EPS growth, revenue growth, gross margin, net margin); FINANCIALS statements; revenue rows on STATS.", HUB,
 "Keep - add 'against its own five-year range' once the history is trusted.")
sec("fund", "Multiples now: trailing P/E, forward P/E, P/S, PEG, P/B, EV/EBITDA, earnings yield",
 "Every report quotes at least the two P/Es; the protocol asked for P/S and PEG in v1; the demo's comps table carries the rest.",
 ["googl_exec","fav_brief","growth_leaders","comparison","mu_est","mu_deepdive","yf_watchlist","fmp_demo","protocol","template"],
 "PARTIAL", "Trailing and forward P/E (STATS, board F P/E, ESTIMATES 03) and earnings yield are shown; P/S, PEG, P/B and EV/EBITDA appear only on the demo fundamentals page.", FUND,
 "Yes - P/S and PEG at least.")
sec("fund", "P/E against its own history: average, peak, where today sits on the company's own range",
 "The 'where 35x sits on MU's own P/E range' strip and the deep dive's historical P/E layer.",
 ["mu_est","mu_deepdive","protocol","template"],
 "HAVE", "ESTIMATES 03 Valuation - the P/E range strip (average, now, peak) from stored ratio history.", HUB,
 "Keep.")
sec("fund", "Forward compression: the EPS growth priced in (trailing over forward, minus one)",
 "The single number the deep dive and the comparison weight most.",
 ["mu_est","mu_deepdive","comparison","growth_leaders","fav_brief"],
 "HAVE", "ESTIMATES 03 Valuation - 'implied EPS growth priced in'.", HUB,
 "Keep.")
sec("fund", "Analyst consensus: rating counts, price target average / median / range, coverage count, upside to target",
 "The MU estimates page's Conviction block; the analyst column of the Favorites Brief; the pre-earnings note header.",
 ["mu_est","fav_brief","mu_note","googl_exec","yf_watchlist","fmp_demo"],
 "HAVE", "ESTIMATES 02 Conviction and 02.b PT consensus; PT average on STATS.", HUB,
 "Keep.")
sec("fund", "Consensus trajectory: revenue, EPS and forward P/E by fiscal year",
 "The three-year table under every name in the Favorites Brief; the FY26E lines of the exec brief.",
 ["fav_brief","googl_exec","fmp_demo","mu_post"],
 "HAVE", "ESTIMATES 01.b Consensus grid (forward annual).", HUB,
 "Keep.")
sec("fund", "Estimate revisions: 7 / 30 / 90-day revision momentum, up and down counts, 'revised up' markers",
 "The whole point of the analyst-revision watchlist, and the earliest warning in the Growth Leaders risk triggers.",
 ["yf_watchlist","mu_est","growth_leaders","fmp_demo"],
 "PARTIAL", "ESTIMATES 05 shows rating changes, not estimate revisions; the forecast tiles carry the current estimate only.", HUB,
 "Yes - it needs estimate history, not only the current row.")
sec("fund", "Forecast versus actual: quarterly and annual estimate bars with beat / miss and an x-ray per bar",
 "Section 01 of the MU estimates page; the earnings panel designs.",
 ["mu_est","earn_display","fmp_demo"],
 "HAVE", "ESTIMATES 01 Forecast - estimate against actual per period, with high / low and analyst counts.", HUB,
 "Keep.")
sec("fund", "Implied-price scenarios: bear floor, scenarios A to E, the upside map after a print",
 "The scenario tables of the scans, the deep dive and the estimates page; the post-earnings 'upside if multiples re-expand' map.",
 ["growth_leaders","mu_deepdive","mu_est","mu_post","comparison","watchlist","mu_note","mu_brief"],
 "HAVE", "ESTIMATES 04 Scenarios (now, bear floor, scenario A, scenario B re-rate). Scenario E and the post-print map are not shown.", HUB,
 "Keep - print the assumptions beside each number (which P/E, which EPS).")
sec("fund", "Tier and acceleration: SUPPORTED / OVEREXTENDED / COOLING / REV-DRIVEN / HOPIUM / STALL and the -4 to +4 acceleration score",
 "The Growth Leaders classification, carried into every scan's header line.",
 ["growth_leaders","watchlist","nvda_fullstack","mu_fullstack","sndk_fullstack","mu_deepdive"],
 "NONE", "Not on the Hub.", None,
 "Maybe - a useful one-word summary, but its rules came from a screener export and were never checked against the Hub's own estimate rows.")
sec("fund", "Financial statements: income, balance sheet and cash flow by fiscal year",
 "The size, scale and cash-flow rows of the comparison; the release metrics the runbook captures.",
 ["comparison","fmp_demo","growth_leaders","mu_deepdive","dcf_v1","earn_runbook"],
 "HAVE", "FINANCIALS tab - income, balance sheet and cash flow for the last six fiscal years.", HUB,
 "Keep.")
sec("fund", "Returns on capital: ROIC, ROE, ROA",
 "The returns block the three-way comparison used to crown the quality benchmark.",
 ["comparison"],
 "NONE", "Not on the company page or the demo comps table.", None,
 "Yes for comparables - the quality yardstick the comparison leaned on.")
sec("fund", "Earnings-day P/E mechanics: the trailing roll step by step, the forward re-rate on the new guide, P/E by outcome",
 "The Micron earnings set - the walk that made the multiple legible before and after the print.",
 ["mu_post","mu_note","mu_brief"],
 "PARTIAL", "Trailing P/E is computed live from price over trailing EPS, so it rolls by itself; the walk-through and the by-outcome table are not shown.", HUB,
 "Yes, on earnings day only - the Micron log is the model.")
sec("fund", "Projected path: five-year revenue, EBITDA, free cash flow and present value",
 "Section 2.5 of the demo and the projected statements of DCF V1.1.",
 ["fmp_demo","dcf_v1","dcf_mstar"],
 "PARTIAL", "Demo fundamentals page only (ticker selector, not linked from the Hub); the separate Allocation and DCF tool.", FUND,
 "Parked with DCF.")
sec("fund", "DCF intrinsic value: one-stage against three-stage with a fade, WACC and CAPM inputs, moat, football field",
 "The Morningstar comparison and DCF V1.1; section 3 of the demo.",
 ["dcf_mstar","dcf_v1","fmp_demo","protocol"],
 "PARTIAL", "Demo fundamentals page section 3 (sliders) and the separate Allocation and DCF tool.", ALLOC,
 "Parked by the owner - the first DCF was too basic. Keep an empty, labelled slot in the digest.")

# ---- Debt & capital ---------------------------------------------------------
sec("debt", "Balance sheet strength: cash and equivalents, total debt, net debt, debt to equity, current ratio",
 "The balance-sheet block of the three-way comparison and the D/E column of the demo comps table.",
 ["comparison","fmp_demo"],
 "HAVE", "STATS (cash and equivalents, total debt, net debt, debt / equity); FINANCIALS balance sheet. Current ratio is not shown.", HUB,
 "Keep.")
sec("debt", "Capital return: dividends paid, buybacks, dividend yield",
 "Dividend yield in the demo; 'earnings and dividends' in the panel design; dividend headlines in the brief.",
 ["fmp_demo","earn_display","fav_brief"],
 "HAVE", "FINANCIALS cash flow (dividends paid, buybacks). Yield is not on STATS.", HUB,
 "Keep - add the yield.")
sec("debt", "Cash generation: operating cash flow, capex, free cash flow and its margin",
 "The cash-flow block of the comparison; the capex bridge the demo explains.",
 ["comparison","fmp_demo","dcf_v1"],
 "HAVE", "FINANCIALS cash flow (operating cash flow, capex, free cash flow). Free-cash-flow margin is not shown.", HUB,
 "Keep.")

# ---- Comparables ------------------------------------------------------------
sec("comps", "Pure benchmark: the company against two or three named peers on the same yardsticks (drawdown, growth, forward P/E)",
 "The template's section 04, the exec brief's comparables bars, the protocol's benchmark trio.",
 ["template","protocol","googl_exec","fav_brief","comparison"],
 "PARTIAL", "The cohort board puts peers side by side (Last, Chg, F P/E, Mkt Cap, RSI, Geiger) and the compare strip shows aggregate Geiger; there are no growth or multiple bars against named peers on the company page.", HUB,
 "Yes - the protocol's rule: never an absolute number floating alone.")
sec("comps", "Full peer table: valuation, growth, earnings, size, margins, returns, balance sheet, cash flow, technicals",
 "The three-way comparison's table and the demo's comparable-companies section.",
 ["comparison","fmp_demo"],
 "PARTIAL", "Demo fundamentals page section 1 (ranks, peer medians, ticker selector), not linked from the Hub.", FUND,
 "Yes, once that page's reads are verified per ticker.")
sec("comps", "Peer set: the curated cohort, sector and cohort tags",
 "Section 2 of the demo; the cohort selector of the company-page mocks; the cohort column of the brief.",
 ["fmp_demo","company_page","company_full","fav_brief","protocol"],
 "HAVE", "Cohorts (the owner's), the cohort selector on the company page, sectors.", HUB,
 "Keep.")
sec("comps", "Comps scorecard: peer rank, peer median, quality score, valuation football field",
 "The demo's 'comps equivalent of the technicals Geiger'.",
 ["fmp_demo"],
 "PARTIAL", "Demo fundamentals page only.", FUND,
 "Yes if it becomes the comps Geiger the demo describes; otherwise no.")
sec("comps", "Multi-name ranking: names ranked by consensus upside, tier, bear-floor cushion, scenario upside, a tagline each",
 "The 'six side by side' of the Favorites Brief; the executive summary tables of the scans and watchlists.",
 ["fav_brief","growth_leaders","watchlist","yf_watchlist","comparison"],
 "PARTIAL", "The board sorts by Geiger, F P/E, Mkt Cap and RSI; there is no upside-to-target or bear-floor column.", HUB,
 "Maybe - one sortable 'upside to target' column would cover most of it.")
sec("comps", "Head to head: where one name beats the other, the caveats, core against satellite",
 "The MU against SNDK deep dive inside the comparison.",
 ["comparison","sndk_fullstack","fav_brief"],
 "NONE", "Not on the Hub.", None,
 "No - a written piece when asked, not a standing section.")
sec("comps", "Basket or pair idea",
 "The 'memory cycle' sleeve of the SNDK scan.",
 ["sndk_fullstack","comparison"],
 "NONE", "Not on the Hub.", None,
 "No.")

# ---- Sentiment --------------------------------------------------------------
sec("sent", "News headlines with source, per ticker",
 "The template's Intel section; the three headlines under every name in the brief; section 8 of the demo.",
 ["template","googl_exec","fav_brief","company_page","company_full","fmp_demo","dossier"],
 "HAVE", "NEWS tab on the company page; the News room; the favourites news bell.", HUB,
 "Keep.")
sec("sent", "News sentiment score across the tracked articles",
 "'News sentiment reads -0.08 across 155 tracked articles' in the brief.",
 ["fav_brief","fmp_demo"],
 "HAVE", "The stored news-sentiment score and article count are loaded for the board and company page.", HUB,
 "Keep - always show the article count beside the score.")
sec("sent", "Social pulse: YouTube, StockTwits, X, per ticker or cohort",
 "The SOCIAL tab of the company-page mocks; the dossier's sentiment refresh.",
 ["company_page","company_full","dossier"],
 "PARTIAL", "The Social room's pulse adapts to the selected scope (YouTube, StockTwits) and there is an X room; the company SOCIAL tab itself still says no source is wired.", HUB,
 "Yes - wire the room's pulse into the tab rather than build it again.")
sec("sent", "Analyst rating changes: upgrades and downgrades feed",
 "'Fresh analyst upgrade today' taglines in the scans; a rating-upgrade headline in the brief.",
 ["yf_watchlist","growth_leaders","fav_brief"],
 "HAVE", "ESTIMATES 05 Rating changes.", HUB,
 "Keep.")
sec("sent", "Insider trades (SEC Form 4)",
 "Section 4 of the demo.",
 ["fmp_demo"],
 "PARTIAL", "Demo fundamentals page section 4 only.", FUND,
 "Yes - cheap and per ticker.")
sec("sent", "Congressional trades (STOCK Act)",
 "Section 5 of the demo.",
 ["fmp_demo"],
 "PARTIAL", "Demo fundamentals page section 5 only.", FUND,
 "Maybe - low signal for large caps.")
sec("sent", "Positioning: Commitment of Traders (index level)",
 "Section 6 of the demo - the S&P E-mini, not the company.",
 ["fmp_demo"],
 "PARTIAL", "Demo fundamentals page section 6 only, index level.", FUND,
 "Not per ticker - it belongs to the market-regime layer.")

# ---- Events -----------------------------------------------------------------
sec("events", "Next earnings: date, before or after the close, countdown, the estimates going in",
 "The template's snapshot cell, the 'Next print' line of the brief, the upcoming rows of the earnings designs.",
 ["template","protocol","fav_brief","earn_display","earn_inline","mu_note","growth_leaders","nvda_fullstack"],
 "HAVE", "EVENTS tab (upcoming) and the Events room's next-earnings block.", HUB,
 "Keep.")
sec("events", "Pre-earnings note: the event, the bar (guide against consensus against range), beat / in-line / miss thresholds, the number that moves the stock",
 "The Micron pre-earnings note and brief.",
 ["mu_note","mu_brief"],
 "PARTIAL", "EVENTS shows the estimate and ESTIMATES the consensus; there is no company-guide row and no thresholds.", HUB,
 "Yes for favourites reporting within a week - it needs a company-guidance field.")
sec("events", "Post-earnings result: actual against consensus against guide with surprise, the new guidance, gross margin",
 "Section 01 of the Micron post-earnings log; the 'Past, reported' rows of the designs; the runbook's full fill.",
 ["mu_post","earn_display","earn_inline","earn_runbook","fmp_demo","fav_brief"],
 "HAVE", "EVENTS tab past earnings - BEAT / MISS / MIXED, surprise, press release, release metrics, transcript.", HUB,
 "Keep.")
sec("events", "Earnings history: past reports with beat or miss, the release link, the transcript, the release metrics",
 "The earnings panel designs and the runbook's definition of done.",
 ["earn_display","earn_inline","earn_runbook","fmp_demo"],
 "HAVE", "EVENTS tab - past earnings, press releases, transcript.", HUB,
 "Keep.")
sec("events", "Guidance: the next-quarter guide against the Street",
 "'The number that moves the stock' in the note; the Q4 guide lines of the post-earnings log.",
 ["mu_post","mu_note","mu_brief"],
 "NONE", "No guidance field in the earnings record the runbook fills.", None,
 "Yes - the logs show guidance is what moved the stock; it needs a field.")
sec("events", "Catalysts: what is coming, and the next catalyst line",
 "The template's Intel and Catalysts; 'Next catalyst' under every name in the brief; the CATALYSTS sub-tab of the mocks.",
 ["template","fav_brief","growth_leaders","watchlist","company_page","company_full","dossier"],
 "HAVE", "READ tab, CATALYSTS sub-tab (dossier prose); the Events room.", HUB,
 "Keep - date every line.")
sec("events", "Dividends and ex-dividend dates",
 "'Earnings and dividends' in the panel design; dividend headlines in the brief; yield in the demo.",
 ["earn_display","fav_brief","fmp_demo"],
 "PARTIAL", "The EVENTS tab code carries dividend lines; not verified on screen.", HUB,
 "Maybe - only matters for payers.")
sec("events", "Monitoring cadence: how often to re-check, last refreshed per name, tracked state",
 "The scans' monitoring cadence; the protocol's tracked-per-name row; the dossier's refresh loop.",
 ["growth_leaders","protocol","dossier","earn_runbook"],
 "PARTIAL", "Freshness labels exist (session state, estimate as-of, the health strip); there is no per-ticker 'last refreshed' line.", HUB,
 "Yes - one line per digest: when each block was last read.")
sec("events", "Macro and economic calendar context",
 "'Calendar key catalysts' in the watchlist; 'red futures' in the briefs.",
 ["watchlist","fav_brief"],
 "HAVE", "The Economic room (market level, not per ticker).", HUB,
 "Keep at market level - link, do not duplicate.")

# ---- Risks & the plan -------------------------------------------------------
sec("risk", "Risk triggers: what flips the thesis bearish (forward EPS cut, bear floor inverting, P/E above prior peaks, weekly trend break on volume)",
 "The Growth Leaders triggers, the scans' exit triggers, the comparison's caveats.",
 ["growth_leaders","sndk_fullstack","nvda_fullstack","mu_fullstack","comparison","watchlist"],
 "NONE", "Not on the Hub.", None,
 "Yes - four rules, all computable from data the Hub holds; the missing half of every verdict.")
sec("risk", "Risks and watch items per name: competition, macro, position notes",
 "The Thesis and Risks blocks of the scans; the post-earnings log's discussion and watch items; the WATCH sub-tab of the mocks.",
 ["growth_leaders","mu_post","comparison","company_page","company_full","dossier"],
 "HAVE", "READ tab, WATCH sub-tab (dossier prose).", HUB,
 "Keep - date it.")
sec("risk", "Invalidation rule: the one level whose loss voids the ladder",
 "The worked example's invalidation line; the scans' stops; 'prove us wrong only on a decisive break below the 200-day'.",
 ["googl_worked4","nvda_fullstack","mu_fullstack","sndk_fullstack","googl_exec","fav_brief"],
 "NONE", "Not on the Hub.", None,
 "Yes - one number per name.")
sec("risk", "The ladder: buy rungs into support, sell rungs into strength, percent from price and size per rung, the two-way rule",
 "The template's section 06, the protocol's engine, the ladders under every name in the briefs, the sample ladders of the worked examples, the action plans of the scans.",
 ["template","protocol","googl_exec","fav_brief","googl_worked4","googl_worked1","mu_deepdive","nvda_fullstack","mu_fullstack","sndk_fullstack"],
 "NONE", "Not on the Hub. The BTC 'gradient ladder' and the mock's 'daily ladder' are different objects.", None,
 "Yes - the protocol's stated heart; blocked on the levels map and on tranche rules the owner has not yet chosen.")
sec("risk", "Position sizing: tranche percentages, the pyramid, share of the cohort allocation, why quarter-size",
 "The worked example's sizing note; 'why this is a quarter-size entry' in the SNDK scan; the deep dive's conservative and aggressive framings.",
 ["googl_worked4","sndk_fullstack","mu_deepdive","nvda_fullstack","mu_fullstack","protocol"],
 "PARTIAL", "The separate Allocation tool sizes positions; nothing on the company page.", ALLOC,
 "Yes, through the allocation tool, once its inputs are current.")
sec("risk", "Data caveats: stale prices, the frozen database date, source discrepancies, the not-advice line",
 "Footers of the briefs and logs; the deep dive's P/E source discrepancy; the lab's session gap; the DCF caveats.",
 ["fav_brief","googl_exec","mu_deepdive","googl_lab5","dcf_mstar","mu_post"],
 "PARTIAL", "Freshness labels and 'not comparable' currency notes exist; there is no disclaimer line on the company page.", HUB,
 "Yes - one line, which is also the rulebook's missing disclaimer.")

# ---- counts (measured from the list above) ----------------------------------
for s in S:
    for k in s["found"]:
        assert k in REPORTS, k
    assert s["status"] in ("HAVE", "PARTIAL", "NONE"), s["t"]
instances = sum(len(s["found"]) for s in S)
distinct = len(S)
dups = instances - distinct
n = {k: sum(1 for s in S if s["status"] == k) for k in ("HAVE", "PARTIAL", "NONE")}
used = sorted({k for s in S for k in s["found"]}, key=lambda k: REPORTS[k][0].lower())

def esc(x):
    return x.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

MARK = {"HAVE": ("have", "&#9679;", "Have on Hub"), "PARTIAL": ("partial", "&#9684;", "Partial"), "NONE": ("none", "&#9675;", "Don&#8217;t have")}

def row(i, s):
    cls, glyph, word = MARK[s["status"]]
    found = ", ".join("%s (%s)" % (esc(REPORTS[k][0]), REPORTS[k][1]) for k in s["found"])
    where = esc(s["where"])
    if s["link"]:
        where += ' <a href="%s" target="_blank" rel="noopener">open &#8599;</a>' % s["link"]
    return ('<article class="sec" id="s%d" data-status="%s"><div class="sl"><span class="num">%02d</span>'
            '<span class="mark %s"><span class="g" aria-hidden="true">%s</span>%s</span></div>'
            '<div class="sb"><h3>%s</h3><p class="what">%s</p>'
            '<dl><dt>Found in</dt><dd>%s <span class="cnt">&#183; %d report%s</span></dd>'
            '<dt>On the Hub</dt><dd>%s</dd>'
            '<dt>Should we have it?</dt><dd class="judge">%s</dd></dl></div></article>'
            ) % (i, s["status"], i, cls, glyph, word, esc(s["t"]), esc(s["what"]), found, len(s["found"]), "" if len(s["found"]) == 1 else "s", where, esc(s["judge"]))

groups_html = ""
i = 0
for key, name, sub in GROUPS:
    items = [s for s in S if s["g"] == key]
    c = {k: sum(1 for s in items if s["status"] == k) for k in ("HAVE", "PARTIAL", "NONE")}
    rows = ""
    for s in items:
        i += 1
        rows += row(i, s) + "\n"
    groups_html += ('<section class="grp" id="%s"><div class="gh"><h2>%s</h2><p>%s</p>'
                    '<p class="gc"><b class="have">%d have</b> <b class="partial">%d partial</b> <b class="none">%d don&#8217;t</b> &#183; %d sections</p></div>\n%s'
                    '<p class="up"><a href="#top">&#8593; contents</a></p></section>\n') % (key, name, sub, c["HAVE"], c["PARTIAL"], c["NONE"], len(items), rows)

toc = "".join('<a href="#%s">%s <span>%d</span></a>' % (key, name, sum(1 for s in S if s["g"] == key)) for key, name, sub in GROUPS)
reports_html = "".join("<li>%s <span>%s &#183; used by %d section%s</span></li>" % (esc(REPORTS[k][0]), REPORTS[k][1], sum(1 for s in S if k in s["found"]), "" if sum(1 for s in S if k in s["found"]) == 1 else "s") for k in used)

CSS = """
:root{color-scheme:dark;
--bg:#0A0A0F;--panel:#0D0D14;--panel2:#111120;--line:#1A1A2A;--line2:#252538;
--hair:rgba(0,212,255,.16);--hair2:rgba(0,212,255,.34);
/* ink: one neutral ramp, capped well below white. House rule: monochrome, no white, no near-white. */
--ink:#B4BACB;--ink2:#949BB0;--ink3:#767D93;--dim:#5C6379;--mute:#3A3A52;
/* one accent hue; the three marks are TONE x OPACITY x OUTLINE of this hue, never a second colour */
--crk:#00D4FF;--c90:rgba(0,212,255,.90);--c62:rgba(0,212,255,.62);--c40:rgba(0,212,255,.40);--c22:rgba(0,212,255,.22);
--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif;
font:14px/1.6 var(--sans);color:var(--ink2);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}body{margin:0;background:var(--bg)}
.wrap{max-width:1100px;margin:auto;padding:22px 28px 40px}
a{color:var(--crk);text-decoration:none}a:hover{color:var(--ink)}
a:focus-visible,button:focus-visible{outline:1px solid var(--crk);outline-offset:3px}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:58px;padding:0 18px;border:1px solid var(--hair);background:var(--panel)}
.brand{font:600 17px/1 var(--mono);letter-spacing:.62em;color:var(--ink);text-shadow:0 0 18px rgba(0,212,255,.25)}
.hlinks{display:flex;gap:10px;font:9px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase}
.hlinks a{border:1px solid var(--line2);padding:8px 12px;color:var(--ink3);background:var(--bg)}
.hlinks a:hover{color:var(--crk);border-color:var(--hair2)}
h1{font:600 12px/1.4 var(--mono);letter-spacing:.34em;text-transform:uppercase;color:var(--ink);margin:30px 0 10px}
.lede{max-width:760px;color:var(--ink3);margin:0 0 8px;font-size:13px}
.k{font:8px/1.4 var(--mono);letter-spacing:.26em;text-transform:uppercase;color:var(--crk)}
.stats{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}
.stat{border:1px solid var(--line);background:var(--panel);padding:9px 14px;min-width:96px}
.stat b{display:block;font:600 17px/1.2 var(--mono);color:var(--ink)}
.stat span{font:8px/1.5 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.stat.have b{color:var(--c90)}.stat.partial b{color:var(--c62)}.stat.none b{color:var(--ink3)}
nav.toc{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:6px;margin:18px 0 0}
nav.toc a{display:flex;justify-content:space-between;gap:8px;border:1px solid var(--line2);background:var(--panel);padding:10px 12px;color:var(--ink2);font:600 10px/1.3 var(--mono);letter-spacing:.14em;text-transform:uppercase}
nav.toc a span{color:var(--c62)}nav.toc a:hover{border-color:var(--hair2);color:var(--crk)}
.filters{display:flex;gap:6px;flex-wrap:wrap;margin:18px 0 6px}
.filters button{font:9px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;border:1px solid var(--line2);border-radius:0;padding:8px 13px;background:var(--bg);color:var(--ink3);cursor:pointer}
.filters button:hover{color:var(--ink);border-color:var(--hair2)}
.filters button[aria-pressed=true]{color:var(--crk);border-color:var(--crk);box-shadow:inset 0 -2px 0 var(--crk)}
.legend{display:flex;gap:14px;flex-wrap:wrap;margin:10px 0 0;font-size:12px;color:var(--ink3)}
section.grp{margin-top:34px;scroll-margin-top:16px}
.gh{border-bottom:1px solid var(--line);padding-bottom:8px;margin:0 0 10px}
h2{font:600 12px/1.4 var(--mono);letter-spacing:.34em;text-transform:uppercase;color:var(--ink);margin:0}
.gh p{margin:4px 0 0;font-size:12.5px;color:var(--ink3);max-width:820px}
.gc{font:9px/1.6 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--dim)!important}
.gc b{font-weight:600;margin-right:8px}.gc b.have{color:var(--c90)}.gc b.partial{color:var(--c62)}.gc b.none{color:var(--ink3)}
article.sec{display:grid;grid-template-columns:132px 1fr;gap:14px;background:var(--panel);border:1px solid var(--line);border-left:3px solid var(--line2);padding:12px 16px 10px;margin:0 0 8px}
article.sec[hidden]{display:none}
article.sec[data-status=HAVE]{border-left-color:var(--c90)}
article.sec[data-status=PARTIAL]{border-left-color:var(--c40)}
article.sec[data-status=NONE]{border-left-color:var(--mute);border-left-style:dashed}
.sl{display:flex;flex-direction:column;gap:8px;align-items:flex-start}
.num{font:600 10px/1 var(--mono);letter-spacing:.2em;color:var(--dim)}
/* the mark: glyph + word, so it reads without colour */
.mark{display:inline-flex;align-items:center;gap:6px;font:600 8px/1.4 var(--mono);letter-spacing:.2em;text-transform:uppercase;padding:3px 7px;border:1px solid var(--line2);white-space:nowrap}
.mark .g{font-size:11px;line-height:1}
.mark.have{color:var(--c90);border-color:var(--c40)}
.mark.partial{color:var(--c62);border-color:var(--c22);border-style:dashed}
.mark.none{color:var(--ink3);border-color:var(--line2);border-style:dashed}
h3{font:600 12.5px/1.4 var(--mono);letter-spacing:.06em;text-transform:uppercase;color:var(--ink);margin:0 0 4px}
.what{margin:0 0 8px;font-size:12.5px;color:var(--ink3)}
dl{display:grid;grid-template-columns:118px 1fr;gap:4px 12px;margin:0;border-top:1px solid var(--line);padding-top:8px}
dt{font:600 8px/1.8 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--crk)}
dd{margin:0;font-size:12.5px;color:var(--ink3)}dd.judge{color:var(--ink2)}
.cnt{color:var(--dim)}
.up{margin:6px 0 0;font:9px/1.4 var(--mono);letter-spacing:.2em;text-transform:uppercase}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:10px}.two>div{background:var(--panel);border:1px solid var(--line);padding:16px 20px}
.two ul{margin:8px 0 0;padding:0;list-style:none}.two li{font-size:12px;color:var(--ink3);padding:6px 0;border-top:1px solid var(--line)}.two li:first-child{border-top:0}
.two li span{color:var(--dim)}
footer{border-top:1px solid var(--line);margin-top:30px;padding-top:16px;color:var(--dim);font:9px/1.6 var(--mono);letter-spacing:.14em;text-transform:uppercase}
footer a{margin-right:14px}
@media(max-width:850px){nav.toc{grid-template-columns:repeat(2,minmax(0,1fr))}.two{grid-template-columns:1fr}}
@media(max-width:620px){.wrap{padding:14px 14px 30px}.brand{letter-spacing:.44em;font-size:14px}header{padding:12px 14px;flex-wrap:wrap}h1{margin-top:24px}article.sec{grid-template-columns:1fr;gap:8px}.sl{flex-direction:row;align-items:center}dl{grid-template-columns:1fr;gap:0}dt{margin-top:6px}nav.toc{grid-template-columns:1fr}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""

HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SCINTILLA &#183; Company report, one copy</title><style>%(css)s</style></head><body><div class="wrap" id="top">
<header><span class="brand">SCINTILLA</span><nav class="hlinks" aria-label="Where to go"><a href="/prototypes/">&#8592; Prototypes</a><a href="https://scintillahub.ai/" target="_blank" rel="noopener">Hub &#8599;</a></nav></header>
<main>
<h1>The company report, deduplicated into one</h1>
<p class="lede">Every distinct section found across the recovered company reports - the executive briefs, the levels labs, the earnings logs, the scans, the comparisons, the templates and protocols, the DCF notes and the Bitcoin page - listed once, in the order of a per-ticker digest. Each is marked against what the Hub shows today, with a one-line answer to &#8220;should we have it?&#8221;. Inventory and mapping only; no new analysis, and nothing here was changed on the Hub.</p>
<p class="k">Marks read against Hub production %(prod)s on %(date)s &#183; Have = on the company page, board or rooms &#183; Partial = part of it, or only on the demo fundamentals page or a separate tool, or in code but not seen on screen &#183; Don&#8217;t have = nowhere on the Hub</p>
<div class="stats">
<div class="stat"><b>%(instances)d</b><span>sections found</span></div>
<div class="stat"><b>%(dups)d</b><span>duplicates removed</span></div>
<div class="stat"><b>%(distinct)d</b><span>distinct sections</span></div>
<div class="stat have"><b>%(have)d</b><span>have on Hub</span></div>
<div class="stat partial"><b>%(partial)d</b><span>partial</span></div>
<div class="stat none"><b>%(none)d</b><span>don&#8217;t have</span></div>
<div class="stat"><b>%(reports)d</b><span>reports read</span></div>
</div>
<nav class="toc" aria-label="Contents">%(toc)s</nav>
<div class="filters" role="group" aria-label="Show"><button type="button" aria-pressed="true" data-filter="all">All</button><button type="button" aria-pressed="false" data-filter="HAVE">Have on Hub</button><button type="button" aria-pressed="false" data-filter="PARTIAL">Partial</button><button type="button" aria-pressed="false" data-filter="NONE">Don&#8217;t have</button></div>
<p class="legend"><span><b class="mark have"><span class="g" aria-hidden="true">&#9679;</span>Have on Hub</b></span><span><b class="mark partial"><span class="g" aria-hidden="true">&#9684;</span>Partial</b></span><span><b class="mark none"><span class="g" aria-hidden="true">&#9675;</span>Don&#8217;t have</b></span></p>
%(groups)s
<section class="grp" id="reports"><div class="gh"><h2>Reports read</h2><p>%(reports)d recovered reports, by title and file date. Two further files were byte-level copies of these and are folded in. Numbers inside them are each report&#8217;s own numbers from its date, not today&#8217;s.</p></div>
<div class="two"><div><span class="k">The reports</span><ul>%(reports_html)s</ul></div>
<div><span class="k">How this was made</span><ul>
<li>Each report&#8217;s headings and full text were read; a section is counted once per report it appears in, then merged with the same section under other names (the exec brief&#8217;s &#8220;Where it stands&#8221; and the template&#8217;s &#8220;Technical lens&#8221; are one section).</li>
<li>&#8220;Found in&#8221; is the evidence for each merge. &#8220;Sections found&#8221; is the sum of those appearances; &#8220;duplicates removed&#8221; is that sum minus the distinct list.</li>
<li>The Hub marks come from the production page&#8217;s own code (board columns, the nine company tabs, the estimates sections, the financial rows, events, read, social) and from the fundamentals page. A mark says a section is rendered; it does not certify the data behind it is current.</li>
<li>Grouping follows the digest shape asked for: identity, price and Geiger, fundamentals and multiples, debt, comparables, sentiment, events, risks. The ladder sits under risks because that is where it is sized.</li>
<li>The page is generated from its own list, so the counts above cannot drift from the sections below. It reads nothing at run time, stores nothing and sends nothing.</li>
</ul></div></div>
<p class="up"><a href="#top">&#8593; contents</a></p></section>
</main>
<footer><a href="/prototypes/">&#8592; Back to Prototypes</a> One report, one copy. The original files stay where they are; nothing was moved, renamed or edited.</footer></div>
<script>document.querySelectorAll('[data-filter]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});document.querySelectorAll('article.sec').forEach(function(a){a.hidden=b.dataset.filter!=='all'&&a.dataset.status!==b.dataset.filter})})});</script>
</body></html>
"""

out = HTML % {"css": CSS, "prod": HUB_PROD, "date": READ_DATE, "instances": instances, "dups": dups, "distinct": distinct,
              "have": n["HAVE"], "partial": n["PARTIAL"], "none": n["NONE"], "reports": len(used),
              "toc": toc, "groups": groups_html, "reports_html": reports_html}
os.makedirs(os.path.dirname(OUT), exist_ok=True)
open(OUT, "w").write(out)
counts = {"sections_found": instances, "duplicates_removed": dups, "distinct": distinct, "have": n["HAVE"], "partial": n["PARTIAL"], "dont_have": n["NONE"], "reports_read": len(used)}
print("wrote", OUT, len(out), "bytes")
print(json.dumps(counts))
