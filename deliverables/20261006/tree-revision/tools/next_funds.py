"""TR2 · the next index-fund batch, judged fund by fund. Re-run from anywhere: python3 deliverables/20261006/tree-revision/tools/next_funds.py
Local files only (the served list, CO1's closes). Fund facts are marked VERIFIED or FROM MEMORY on every row."""
import json, csv, math, datetime, os
HUB=os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)),"..","..","..",".."))
D=HUB+"/deliverables/20261006/"
syms=set(json.load(open(D+"cohort-proposal/data/universe-20261006.json"))["symbols"])
TR1=set("URTH ACWI SPYG SPYV USMV VLUE EWT INDA EWZ EWC".split())
K="ticker name tracks family first_year liquidity pairs_with read adds strengthens near_copy_of tree_node verdict why facts_basis".split()
M="FROM MEMORY"
def row(v,*a):
    r=dict(zip(K,a[:12]+(v,)+a[12:])); assert len(r)==15,(a[0],len(a)); return r
A=[]; L=[]; S=[]
def ad(*a): A.append(row("ADMIT_NEXT",*a))
def la(t,name,tracks,fam,yr,liq,pairs,read,st,near,node,why,fb=M):
    L.append(row("LATER",t,name,tracks,fam,yr,liq,pairs,read,"later: "+why,st,near,node,why,fb))
def sk(t,name,tracks,fam,yr,liq,near,node,why,fb=M,st="none"):
    S.append(row("SKIP",t,name,tracks,fam,yr,liq,near or "none","none: "+why,"nothing a served fund does not already give",st,near or "none",node,why,fb))
# ---------------- REGIME
ad("SPHB","Invesco S&P 500 High Beta ETF","the 100 S&P 500 stocks that swing the most","Invesco factor",2011,"FINE","SPLV",
 "SPHB divided by SPLV: when the jumpy stocks beat the calm ones, traders are taking risk; when it falls they are hiding",
 "adds: the cleanest risk-on / risk-off line there is, from two funds cut out of the same 500 stocks","REGIME","none served (opposite of SPLV by design)","IDX_FACTOR",
 "the one missing half of a pair whose other half (SPLV) is already served; gives the tide a seventh part that is not the S&P against itself",
 "VERIFIED name, index, launch 5 May 2011, about 330 thousand shares a day and $1.02bn (yahoo / etfdb / robinhood, Jul 2026)")
ad("TIP","iShares TIPS Bond ETF","US Treasury bonds whose value rises with inflation","iShares bonds",2003,"LARGE","IEF",
 "TIP divided by IEF: rising means the bond market expects more inflation; falling means it expects less",
 "adds: an inflation-expectations line; today nothing on the board says whether a rate move is about inflation or about growth","REGIME","none served (AGG, IEF and TLT are all ordinary bonds)","IDX_MACRO",
 "fills the inflation hole in the macro shelf with one liquid fund",M+" (name, launch year, volume of a few million shares a day)")
ad("IBIT","iShares Bitcoin Trust ETF","the price of bitcoin","iShares crypto",2024,"LARGE","GLD, SPY",
 "IBIT divided by GLD: bitcoin beating gold is appetite for the wildest asset; gold beating bitcoin is caution. Also the yardstick for the 12 crypto shares and 12 miners we hold",
 "adds: the coin itself, so CRYPTO EQUITIES and NEOCLOUDS & MINERS can be coloured against what drives them","REGIME","none served","IDX_MACRO, and the spine line of CRYPTO_EQUITIES",
 "CO1 gaps.json lists it as missing; two cohorts (24 member rows) have no reference line without it",
 "MEASURED gap (gaps.json index_layer_missing, proposal.json CRYPTO_EQUITIES and NEOCLOUDS_MINERS have reference_funds []); liquidity "+M)
ad("ARKK","ARK Innovation ETF","about 35 to 55 hand-picked high-growth, mostly unprofitable-or-young companies","ARK active",2014,"LARGE","QQQ, SPY",
 "ARKK divided by QQQ: rising means money is reaching past the big profitable tech names into the speculative ones",
 "adds: a speculation gauge (ARKK divided by QQQ), and the yardstick for the story-stock block that used to be FRONTIER: space, quantum and eVTOL moved together 0.37 this half-year and have no line of their own","REGIME","none served (not an index fund; AGIX and FDN are the nearest)","IDX_THEME_FUNDS, yardstick for the story-stock block (SPACE, QUANTUM, AUTONOMY_EVTOL)",
 "named in CO1 gaps.json; liquid; gives froth a price-based input instead of only put/call",
 "MEASURED gap (gaps.json); name, launch year, volume "+M)
ad("CPER","United States Copper Index Fund","copper futures (the metal, not the miners)","USCF commodity",2011,"FINE","GLD, COPX",
 "CPER divided by GLD: copper is bought when factories are busy, gold when people are afraid, so rising means growth and falling means fear",
 "adds: the copper-to-gold line, a growth-versus-fear read that does not use any share price","REGIME","COPX is the miners (shares), not the metal","IDX_MACRO",
 "an independent growth read; also lets COPPER & STEEL be judged against the metal",
 "VERIFIED name, launch 15 Nov 2011, about 512 thousand shares a day and $750m in Sep 2026 (yahoo / etfcentral)")
ad("EMB","iShares J.P. Morgan USD Emerging Markets Bond ETF","US-dollar government bonds of emerging countries","iShares bonds",2007,"LARGE","IEF, HYG",
 "EMB divided by IEF: rising means lenders are comfortable with emerging countries; falling means money is leaving them",
 "adds: a second credit line that is about countries, not US companies, so a credit warning can be told apart: home or abroad","REGIME","none served (HYG and LQD are US company debt)","IDX_MACRO",
 "widens the tide's credit part beyond one fund (HYG) that is frozen at 23 Sep",M)
ad("FXY","Invesco CurrencyShares Japanese Yen Trust","the yen against the dollar","Invesco currency",2007,"FINE","UUP",
 "FXY alone: a sharp rise in the yen has gone with forced selling of shares worldwide, because cheap yen loans get paid back",
 "adds: the yen on its own; UUP is mostly the euro, so a yen shock is hidden inside it","REGIME","none served (UUP is a basket)","IDX_MACRO",
 "an early-warning line for global selling; borderline volume, so watch its first week",
 "VERIFIED name, 187 to 254 thousand shares a day, about $440m (yahoo / etfdb / robinhood, 2026); the yen-loan link is "+M)
# ---------------- BREADTH
ad("EMXC","iShares MSCI Emerging Markets ex China ETF","emerging markets with China taken out (Taiwan, India, Korea, Brazil...)","iShares MSCI",2017,"LARGE","EEM, MCHI",
 "EMXC divided by EEM: rising means emerging markets are strong without China; falling means China is doing the lifting",
 "adds: splits the emerging-market line in two, so world participation is not one country's story","BREADTH","EEM (same index minus China, which is roughly a quarter to a third of it)","IDX_WORLD",
 "completes MSCI's arithmetic: EEM = EMXC + MCHI, the way ACWI = URTH + EEM",
 "VERIFIED name, index, launch 18 Jul 2017, about 2.4m shares a day, $12.8bn (yahoo / morningstar); China's share of EEM "+M)
ad("VGK","Vanguard FTSE Europe ETF","all of developed Europe: UK, Switzerland, the Nordics and the euro countries","Vanguard FTSE",2005,"LARGE","EZU, SPY",
 "VGK divided by SPY: rising means Europe is beating the US. VGK divided by EZU separates the euro countries from the UK, Switzerland and Sweden",
 "adds: the only single line that covers every home country of our 8 European names (NL, GB, SE, BE, CH); EZU leaves out GB, SE and CH","BREADTH","EZU (euro area only) and EWU (UK only) together cover most of it","IDX_WORLD",
 "TR1 skipped it as 'a later choice'; this is the later choice, because the EUROPE cohort moves no tighter than its sector and needs a proper line",
 "MEASURED: EUROPE spine text and members (proposal.json), TR1 verdict (index-layer.json); volume "+M)
ad("IWO","iShares Russell 2000 Growth ETF","the growth half of 2,000 small US companies","iShares Russell",2000,"FINE","IWN, IWM",
 "IWO divided by IWN: small growth beating small value means risk appetite has reached the smallest, least proven companies",
 "adds: the small-company end of growth against value; today that split exists for large companies only","BREADTH","IWM (it is half of it)","IDX_STYLE",
 "one half of the small growth/value pair","VERIFIED name, about 500 to 580 thousand shares a day, $13bn (yahoo, Feb 2026)")
ad("IWN","iShares Russell 2000 Value ETF","the value half of 2,000 small US companies (many banks)","iShares Russell",2000,"LARGE","IWO, IWM",
 "the other half of IWO divided by IWN; on its own, IWN divided by SPY shows whether small cheap companies are joining a rally",
 "adds: the small-value corner, where rallies broaden last","BREADTH","IWM (it is half of it)","IDX_STYLE",
 "the pair only works with both halves","VERIFIED name, about 1.1 to 1.4m shares a day, $12bn (etfdb / robinhood, 2025-26)")
ad("IWP","iShares Russell Mid-Cap Growth ETF","the growth half of about 800 mid-sized US companies","iShares Russell",2001,"FINE","IWS, MDY",
 "IWP divided by IWS: the same growth-against-value question for mid-sized companies",
 "adds: the middle row of a 3 by 2 grid (large, mid, small by growth, value) that shows how far down a move reaches","BREADTH","MDY (mid caps as a whole)","IDX_STYLE",
 "with VUG/VTV (large) and IWO/IWN (small) this makes all six boxes",M)
ad("IWS","iShares Russell Mid-Cap Value ETF","the value half of about 800 mid-sized US companies","iShares Russell",2001,"FINE","IWP, MDY",
 "the other half of IWP divided by IWS","adds: the mid-value box; completes the six-box grid","BREADTH","MDY (mid caps as a whole)","IDX_STYLE",
 "the pair only works with both halves",M)
ad("EWW","iShares MSCI Mexico ETF","large and mid-sized Mexican shares","iShares MSCI country",1996,"LARGE","EWZ, SPY",
 "EWW against EWZ and SPY: Mexico moves with US factories and trade rules, Brazil with commodities",
 "adds: a second Latin American line and one more country in the world count","BREADTH","none served (EWZ pending is Brazil only)","IDX_COUNTRIES",
 "the LATAM cohort moves no tighter than a random set; one Brazil line is not enough to read it",
 "MEASURED: LATAM verdict (proposal.json moves_together); volume "+M)
ad("EWA","iShares MSCI Australia ETF","large and mid-sized Australian shares (banks and miners)","iShares MSCI country",1996,"LARGE","EWJ, MCHI",
 "EWA divided by SPY: Australia rises with China's demand for iron ore and with metals, so it is a second opinion on both",
 "adds: a country line for the Australian names in ASIA-PACIFIC and one more country in the world count","BREADTH","none served","IDX_COUNTRIES",
 "ASIA-PACIFIC has only EWJ and EWY as reference lines, and we hold no Japanese or Korean name",
 "MEASURED: ASIA_PACIFIC spine text (proposal.json); volume "+M)
ad("EWL","iShares MSCI Switzerland ETF","large and mid-sized Swiss shares (drug makers, food, banks)","iShares MSCI country",1996,"FINE","EZU, EWG",
 "EWL divided by EZU: Switzerland is Europe's defensive corner, so it leading means Europe is cautious",
 "adds: a defensive European line and one more country in the world count","BREADTH","none served (EZU has no Swiss shares)","IDX_COUNTRIES",
 "a country outside every European fund we serve",
 "VERIFIED name and 413 thousand to 1.0m shares a day (robinhood / etfdb, 2026)")
# ---------------- SECTOR STRENGTH
ad("KWEB","KraneShares CSI China Internet ETF","Chinese internet companies listed abroad","KraneShares theme",2013,"LARGE","MCHI, FXI",
 "KWEB divided by MCHI: rising means China's internet names are leading China; falling means they are the drag",
 "adds: the right yardstick for our CHINA cohort, which is mostly internet names (BABA, BIDU, JD, PDD)","SECTOR_STRENGTH","MCHI and FXI are all of China; KWEB is one slice","IDX_THEME_FUNDS, spine of CHINA",
 "named in CO1 gaps.json; MCHI holds only 1 of our names by US listing",
 "MEASURED: gaps.json (KWEB missing; MCHI we_hold 1 of 9 US-listed), CHINA members; volume and holdings "+M)
ad("XME","State Street SPDR S&P Metals & Mining ETF","US steel, copper, gold, coal and aluminium companies, near equal weight","SPDR industry",2006,"LARGE","XLB, COPX",
 "XME divided by XLB: rising means the miners and steel makers are leading the materials sector, not the chemical companies",
 "adds: a US line for the steel half of COPPER & STEEL; COPX covers copper only and is mostly foreign","SECTOR_STRENGTH","COPX (copper miners only); GDX (gold only)","IDX_THEME_FUNDS, spine of COPPER_STEEL",
 "COPX holds only 2 of our 7 names by weight 10.3%; the steel names have no line",
 "MEASURED: gaps.json COPX we_hold 2, weight 10.3%; XME holdings and volume "+M)
ad("GRID","First Trust NASDAQ Clean Edge Smart Grid Infrastructure Index Fund","makers of grid kit: cables, transformers, switchgear, meters","First Trust theme",2009,"FINE","PAVE, XLI",
 "GRID divided by PAVE: rising means the electrical grid build-out is leading general infrastructure",
 "adds: a line made for GRID & ELECTRICAL; PAVE, its spine today, is mostly roads, rail and materials","SECTOR_STRENGTH","PAVE (overlaps on ETN, PWR, HUBB)","IDX_THEME_FUNDS, spine of GRID_ELECTRICAL",
 "the cohort is tight (0.647) and central to the AI power story, but leans on a general fund",
 "VERIFIED name, about 550 to 660 thousand shares a day, $11.7bn in Aug 2026 (yahoo / robinhood); MEASURED cohort corr 0.647 (proposal.json); holdings "+M)
ad("SHLD","Global X Defense Tech ETF","about 50 defence-technology companies worldwide","Global X theme",2023,"LARGE","ITA",
 "SHLD divided by ITA: rising means the new defence names (software, drones, European makers) are leading the old US primes",
 "adds: a spine for DEFENCE TECH, which today borrows ITA, a fund dominated by the primes","SECTOR_STRENGTH","ITA (US primes; SHLD is global and tech-tilted)","IDX_THEME_FUNDS, spine of DEFENCE_TECH",
 "the cohort has 5 names and no line of its own",
 "VERIFIED name, index, launch 11 Sep 2023, about 2.25m shares a day, $7.5bn (yahoo / globalxetfs); holdings "+M)
ad("MLPX","Global X MLP & Energy Infrastructure ETF","pipeline and gas-processing companies","Global X energy",2013,"FINE","XLE, XOP",
 "MLPX divided by XLE: rising means the pipelines (paid by volume) are leading the producers (paid by price)",
 "adds: a spine for OIL MIDSTREAM; all four of our names (WMB, KMI, OKE, TRGP) are in its top six","SECTOR_STRENGTH","none served (XLE is 4 of our names among 20-odd)","IDX_THEME_FUNDS, spine of OIL_MIDSTREAM",
 "the tightest energy cohort (0.753) has only the whole sector as its line",
 "VERIFIED name, top-10 holdings on 17 Jul 2026, about 474 thousand shares a day, $3.7bn (etfdb / robinhood); MEASURED cohort corr 0.753")
ad("KBWB","Invesco KBW Bank ETF","the biggest US banks, weighted by size","Invesco KBW",2011,"LARGE","KRE, XLF",
 "KBWB divided by KRE: rising means the big banks are beating the regional ones; falling means the small lenders are catching up, a sign of an easier economy",
 "adds: a pure big-bank line; KBE, served, is equal weight and so is mostly regional banks","SECTOR_STRENGTH","KBE (equal weight, mostly regionals); IYG (includes card networks)","IDX_THEME_FUNDS, spine of BIG_BANKS_BROKERS",
 "gives the big-against-regional bank read with two liquid funds",
 "VERIFIED name, index (KBW Nasdaq Bank), launch 1 Nov 2011, about 1.8m shares a day, $6.7bn (yahoo / etfdb)")
ad("ICLN","iShares Global Clean Energy ETF","solar, wind and other clean-power companies worldwide","iShares theme",2008,"LARGE","TAN, XLU",
 "ICLN divided by TAN: rising means clean power beyond solar is leading; falling means it is a solar-only move",
 "adds: widens SOLAR & RENEWABLE beyond solar, as CO1's spine note asks","SECTOR_STRENGTH","TAN (solar is a large part of ICLN)","IDX_THEME_FUNDS, second spine of SOLAR_RENEWABLE",
 "named in the cohort's own spine text and in gaps.json",
 "MEASURED: proposal.json SOLAR_RENEWABLE spine ('ICLN would widen it; not served'); volume "+M)
ad("WGMI","CoinShares Bitcoin Mining ETF","bitcoin miners, many now renting their sites to AI","CoinShares theme",2022,"FINE","IBIT, SMH",
 "WGMI divided by IBIT: rising means the miners are beating the coin, which lately has meant they are being priced as AI landlords",
 "adds: the only fund that defines NEOCLOUDS & MINERS (12 names, no fund today)","SECTOR_STRENGTH","none served","IDX_THEME_FUNDS, spine of NEOCLOUDS_MINERS",
 "CO1: 'no open fund holds these'; this is the nearest. Formerly the Valkyrie Bitcoin Miners ETF: use the new name",
 "VERIFIED current name and 436 to 735 thousand shares a day (robinhood / investing.com / etfdb); MEASURED gap (gaps.json)")
ad("XAR","State Street SPDR S&P Aerospace & Defense ETF","US aerospace and defence companies, every name counted the same","SPDR industry",2011,"FINE","ITA",
 "XAR divided by ITA: the bow tie for defence. Rising means the smaller names are beating the giants",
 "adds: an equal-weight twin for ITA, the same read the Hub already makes for the 11 sectors","SECTOR_STRENGTH","ITA (same industry, weighted by size)","IDX_THEME_FUNDS, beside ITA under DEFENCE_PRIMES",
 "lowest-volume admit in this group: watch its first week",
 "VERIFIED name, equal-weight index, 164 to 236 thousand shares a day (robinhood / etfdb, 2026)")
ad("UNG","United States Natural Gas Fund","US natural gas futures","USCF commodity",2007,"LARGE","USO, XLU",
 "UNG divided by USO: gas against oil. Gas is the fuel of the power plants in AI POWERTRAIN and the product of our pipeline names",
 "adds: the gas price, the one big energy input the board cannot see","SECTOR_STRENGTH","none served (USO is oil, DBC a basket)","IDX_MACRO",
 "read it over weeks, not years: futures funds lose value over time when later months cost more",M)
# ---------------- LATER
la("ETHA","iShares Ethereum Trust ETF","the price of ether","iShares crypto",2024,"LARGE","IBIT","ETHA divided by IBIT: appetite for the riskier coin","REGIME","none","IDX_MACRO","admit after IBIT has run clean for a week")
la("BKLN","Invesco Senior Loan ETF","loans to indebted companies, floating rate","Invesco bonds",2011,"LARGE","HYG","BKLN against HYG: credit stress without the interest-rate effect","REGIME","HYG (same borrowers)","IDX_MACRO","barely moves day to day, so it makes a weak tile; useful only as a tide input")
la("VIXM","ProShares VIX Mid-Term Futures ETF","VIX futures 4 to 7 months out","ProShares volatility",2011,"THIN","VXX","VXX divided by VIXM: fear now against fear later","REGIME","VXX","IDX_MACRO","thin; the research code already reads VIX against VIX3M directly")
la("BIL","State Street SPDR Bloomberg 1-3 Month T-Bill ETF","cash (Treasury bills)","SPDR bonds",2007,"LARGE","SHY","anything divided by BIL: is it beating cash","REGIME","SHY (already close to cash)","IDX_MACRO","a flat line; SHY does the job for now")
la("DBA","Invesco DB Agriculture Fund","farm commodity futures","Invesco commodity",2007,"FINE","DBC","DBA divided by DBC: food against all commodities","REGIME","DBC (part of it)","IDX_MACRO","no cohort of ours hangs on it yet")
la("NLR","VanEck Uranium and Nuclear ETF","uranium miners plus nuclear utilities and builders","VanEck theme",2007,"FINE","URA","NLR divided by URA: the reactor owners against the miners","SECTOR_STRENGTH","URA","IDX_THEME_FUNDS, second spine of AI_POWERTRAIN","URA is served; add when AI POWERTRAIN is reviewed")
la("XLG","Invesco S&P 500 Top 50 ETF","the 50 biggest S&P 500 companies","Invesco size",2005,"FINE","RSP","XLG divided by RSP: how top-heavy the market is","BREADTH","SPY, MAGS","IDX_US_BROAD","MAGS divided by RSP, both served, already gives a sharper version")
la("IWC","iShares Micro-Cap ETF","about 1,300 of the smallest US companies","iShares Russell",2005,"THIN","IWM","IWC divided by IWM: the very smallest against small","BREADTH","IWM","IDX_US_BROAD","thin; the widest breadth line there is, worth a trial once the cross-check tolerates thin funds")
la("QQQJ","Invesco NASDAQ Next Gen 100 ETF","Nasdaq companies ranked 101 to 200","Invesco Nasdaq",2020,"THIN","QQQ","QQQJ divided by QQQ: is the Nasdaq move reaching the next tier","BREADTH","none","IDX_US_BROAD","modest volume; QQQE against QQQ covers most of the question")
la("VXF","Vanguard Extended Market ETF","every US company outside the S&P 500","Vanguard",2001,"FINE","SPY","VXF divided by SPY: the rest of the market against the 500","BREADTH","IWM, MDY","IDX_US_BROAD","IWM and MDY together draw nearly the same line")
la("EQWL","Invesco S&P 100 Equal Weight ETF","the 100 biggest companies, counted the same","Invesco equal weight",2006,"THIN","RSP","equal weight among the giants only","BREADTH","RSP","IDX_US_BROAD","needs OEF as its twin, which is a copy of SPY")
la("RPG","Invesco S&P 500 Pure Growth ETF","only the most growth-like S&P 500 names","Invesco style",2006,"FINE","RPV","RPG divided by RPV: growth against value with the middle ground removed","BREADTH","SPYG (pending)","IDX_STYLE","TR1 has just admitted SPYG/SPYV; see whether that pair moves enough first")
la("RPV","Invesco S&P 500 Pure Value ETF","only the most value-like S&P 500 names","Invesco style",2006,"FINE","RPG","the other half of RPG divided by RPV","BREADTH","SPYV (pending)","IDX_STYLE","same as RPG")
for t,n,c,liq,why in [("EWH","Hong Kong","Hong Kong banks, insurers and property","LARGE","overlaps the three China funds already served"),
 ("EWS","Singapore","Singapore banks and Sea Ltd","FINE","we hold no Singapore name"),
 ("EWQ","France","French shares (luxury, industry)","FINE","EZU is about a third France"),
 ("EWI","Italy","Italian shares (banks)","FINE","inside EZU; second batch of the world count"),
 ("EWP","Spain","Spanish shares (banks, utilities)","FINE","inside EZU; second batch of the world count"),
 ("EWD","Sweden","Swedish shares","THIN","thin; VGK covers Sweden"),
 ("EWN","Netherlands","Dutch shares, about a quarter ASML","THIN","thin, and ASML is served directly"),
 ("EIS","Israel","Israeli shares","THIN","thin; revisit if Israeli names are added"),
 ("KSA","Saudi Arabia","Saudi shares","FINE","an oil-state line; no cohort hangs on it"),
 ("EZA","South Africa","South African shares (gold miners, banks)","FINE","no cohort hangs on it"),
 ("ECH","Chile","Chilean shares","FINE","one Chilean name (SQM) only")]:
    la(t,"iShares MSCI %s ETF"%n,c,"iShares MSCI country",{"EIS":2008,"KSA":2015,"EZA":2003,"ECH":2007}.get(t,1996),liq,"SPY, EFA or EEM",t+" divided by SPY: is this country beating the US; one more country in the world count","BREADTH","none","IDX_COUNTRIES",why)
la("ARGT","Global X MSCI Argentina ETF","Argentine shares, about a fifth MercadoLibre","Global X country",2011,"FINE","EWZ","ARGT against EWZ","BREADTH","none","IDX_COUNTRIES","MELI is served directly; swings on politics")
la("VNM","VanEck Vietnam ETF","Vietnamese shares","VanEck country",2009,"FINE","EEM","VNM divided by EEM: the factory-moving-out-of-China trade","BREADTH","none","IDX_COUNTRIES","we hold no name tied to it")
la("AMLP","Alerian MLP ETF","pipeline partnerships only","ALPS energy",2010,"LARGE","MLPX","partnerships against pipeline companies","SECTOR_STRENGTH","MLPX","IDX_THEME_FUNDS","holds none of our four midstream names (they are companies, not partnerships)","our four names MEASURED (proposal.json); AMLP holdings "+M)
la("FCG","First Trust Natural Gas ETF","US gas producers","First Trust energy",2007,"FINE","XOP","FCG divided by XOP: gas drillers against oil drillers","SECTOR_STRENGTH","XOP","IDX_THEME_FUNDS","UNG gives the gas read first")
la("DTCR","Global X Data Center & Digital Infrastructure ETF","datacenter and tower landlords plus some chip makers","Global X theme",2020,"THIN","VNQ","DTCR divided by VNQ: datacenter property against all property","SECTOR_STRENGTH","none","IDX_THEME_FUNDS, spine of DC_PROPERTY","volume not verified; treat as thin until checked")
la("SRVR","Pacer Data & Infrastructure Real Estate ETF","datacenter and tower REITs","Pacer theme",2018,"THIN","VNQ","SRVR divided by VNQ","SECTOR_STRENGTH","DTCR","IDX_THEME_FUNDS, spine of TOWERS","thin")
la("DRIV","Global X Autonomous & Electric Vehicles ETF","EV makers, parts and chips","Global X theme",2018,"THIN","XLY","DRIV divided by XLY","SECTOR_STRENGTH","none","IDX_THEME_FUNDS, spine of AUTOS_EV","thin; AUTOS & EV is our loosest cohort (0.305), so a spine would help once volume is checked","MEASURED corr 0.305 (proposal.json); volume "+M)
la("ARKQ","ARK Autonomous Technology & Robotics ETF","autonomy, robotics, eVTOL and space names","ARK active",2014,"FINE","BOTZ","ARKQ divided by BOTZ","SECTOR_STRENGTH","ARKK, ARKX","IDX_THEME_FUNDS, spine of AUTONOMY_EVTOL","admit ARKK first; then see whether a second ARK fund adds anything")
la("BITQ","Bitwise Crypto Industry Innovators ETF","crypto exchanges, miners and treasury companies","Bitwise theme",2021,"THIN","IBIT","BITQ divided by IBIT: the shares against the coin","SECTOR_STRENGTH","WGMI","IDX_THEME_FUNDS, spine of CRYPTO_EQUITIES","thin; IBIT and WGMI cover it for now")
la("AIQ","Global X Artificial Intelligence & Technology ETF","about 85 AI-related companies worldwide","Global X theme",2018,"FINE","AGIX","AIQ against AGIX and IGM","SECTOR_STRENGTH","AGIX, IGM","IDX_THEME_FUNDS","a third AI basket beside AGIX and IGM")
la("UFO","Procure Space ETF","satellite and launch companies","Procure theme",2019,"THIN","ARKX","UFO divided by ARKX","SECTOR_STRENGTH","ARKX","IDX_THEME_FUNDS, second spine of SPACE","thin; SPACE is already tight (0.662) with ARKX")
la("MOO","VanEck Agribusiness ETF","farm equipment, seed and fertiliser companies","VanEck theme",2007,"THIN","XLB","MOO divided by XLB","SECTOR_STRENGTH","none","IDX_THEME_FUNDS","only if the agriculture theme in gaps.json themes_thin is built")
la("PHO","Invesco Water Resources ETF","water utilities and equipment","Invesco theme",2005,"THIN","XLU","PHO divided by XLU","SECTOR_STRENGTH","none","IDX_THEME_FUNDS","only if the water theme in gaps.json themes_thin is built")
la("IPO","Renaissance IPO ETF","companies listed in the last three years","Renaissance theme",2013,"THIN","SPY","IPO divided by SPY: appetite for new listings","REGIME","ARKK","IDX_THEME_FUNDS","thin; ARKK gives the same read with far more volume")
# ---------------- SKIP
for t,n,why in [("VOO","Vanguard S&P 500 ETF","the same index as SPY"),("IVV","iShares Core S&P 500 ETF","the same index as SPY"),("SPLG","SPDR Portfolio S&P 500 ETF","the same index as SPY (ticker may now be SPYM: FROM MEMORY)"),
 ("QQQM","Invesco NASDAQ 100 ETF","the same index as QQQ"),("IJH","iShares Core S&P Mid-Cap ETF","the same index as MDY"),("VO","Vanguard Mid-Cap ETF","mid caps again; MDY is served"),
 ("VB","Vanguard Small-Cap ETF","small caps a third way; IWM and IJR are served"),("IVW","iShares S&P 500 Growth ETF","the same index as SPYG"),("IVE","iShares S&P 500 Value ETF","the same index as SPYV"),
 ("IWF","iShares Russell 1000 Growth ETF","a third recipe for large growth after VUG and SPYG"),("IWD","iShares Russell 1000 Value ETF","a third recipe for large value after VTV and SPYV"),
 ("SIZE","iShares MSCI USA Size Factor ETF","thin; RSP and IWM already draw the size effect"),("ACWX","iShares MSCI ACWI ex U.S. ETF","VXUS, served, is the world without the US"),
 ("VEA","Vanguard FTSE Developed Markets ETF","a near-copy of EFA"),("IEFA","iShares Core MSCI EAFE ETF","EFA with small caps"),("VWO","Vanguard FTSE Emerging Markets ETF","a near-copy of EEM"),("IEMG","iShares Core MSCI Emerging Markets ETF","EEM with small caps"),
 ("IWB","iShares Russell 1000 ETF","large caps again; only wanted as EQAL's twin, and EQAL is too thin")]:
    sk(t,n,"see reason","index copy",None,"not assessed" if t!="SIZE" else "THIN (TR1 estimate)",None,"IDX_ (not placed)","TR1 skip, kept: "+why,"MEASURED: TR1 verdict (index-layer.json)")
sk("QQEW","First Trust NASDAQ-100 Equal Weighted Index Fund","Nasdaq-100, every name the same","First Trust",2006,"FINE","QQQE","IDX_US_BROAD","the same index as QQQE, which is served","MEASURED: all 50 QQEW rows in the local holdings file are also in QQQE (holdings.json, 28 Sep)","BREADTH")
sk("EQAL","Invesco Russell 1000 Equal Weight ETF","Russell 1000, equal weight","Invesco equal weight",2014,"THIN","RSP","IDX_US_BROAD","about 27 thousand shares a day lately: likely to fail the settled-close check and hold the set. The Hub's bow-tie column EQAL-IWB cannot draw either way: drop that column","VERIFIED 30-session average 27,161 shares, $0.8bn, created 23 Dec 2014 (robinhood / etfdb / yahoo); MEASURED: EQAL and IWB not in the 590","BREADTH")
sk("FM","iShares Frontier and Select EM ETF","frontier markets","iShares MSCI",2012,"closed",None,"IDX_WORLD","closed: liquidated 9 Jan 2025. No liquid frontier fund exists to replace it","VERIFIED (sec.gov Form 497, iShares)","BREADTH")
for t,n,c,near,node,why in [("HACK","Amplify Cybersecurity ETF","cybersecurity companies","CIBR","IDX_THEME_FUNDS","a second cyber basket; CIBR is served and CYBER has its spine"),
 ("ROBO","ROBO Global Robotics and Automation Index ETF","robotics companies","BOTZ","IDX_THEME_FUNDS","a second robotics basket; BOTZ is served"),
 ("JNK","State Street SPDR Bloomberg High Yield Bond ETF","junk bonds","HYG","IDX_MACRO","a near-copy of HYG"),
 ("VIXY","ProShares VIX Short-Term Futures ETF","near-month VIX futures","VXX","IDX_MACRO","a near-copy of VXX"),
 ("IAU","iShares Gold Trust","gold","GLD","IDX_MACRO","the same metal as GLD"),
 ("PDBC","Invesco Optimum Yield Diversified Commodity Strategy ETF","commodity basket","DBC","IDX_MACRO","a near-copy of DBC"),
 ("BNO","United States Brent Oil Fund","Brent oil","USO","IDX_MACRO","oil again"),
 ("FXE","Invesco CurrencyShares Euro Trust","the euro","UUP","IDX_MACRO","UUP is mostly the euro upside down"),
 ("IEI","iShares 3-7 Year Treasury Bond ETF","mid-length Treasuries","IEF","IDX_MACRO","the Hub already reads the 3-month, 5, 10 and 30-year yields directly"),
 ("BND","Vanguard Total Bond Market ETF","all US bonds","AGG","IDX_MACRO","a near-copy of AGG"),
 ("SCHP","Schwab U.S. TIPS ETF","inflation-linked Treasuries","TIP (proposed)","IDX_MACRO","the same bonds as TIP"),
 ("OEF","iShares S&P 100 ETF","the 100 biggest US companies","SPY","IDX_US_BROAD","moves almost exactly with SPY"),
 ("ILF","iShares Latin America 40 ETF","40 Latin American shares, mostly Brazil","EWZ (pending)","IDX_WORLD","mostly Brazil; EWZ plus EWW say more"),
 ("AAXJ","iShares MSCI All Country Asia ex Japan ETF","Asia without Japan","EEM","IDX_WORLD","EEM is mostly Asia already"),
 ("EPI","WisdomTree India Earnings Fund","Indian shares","INDA (pending)","IDX_COUNTRIES","a second India line"),
 ("CQQQ","Invesco China Technology ETF","Chinese tech","KWEB (proposed)","IDX_THEME_FUNDS","a near-copy of KWEB with less volume"),
 ("OIH","VanEck Oil Services ETF","oil service companies","IEZ","IDX_THEME_FUNDS","a near-copy of IEZ"),
 ("URNM","Sprott Uranium Miners ETF","uranium miners","URA","IDX_THEME_FUNDS","a near-copy of URA"),
 ("PPA","Invesco Aerospace & Defense ETF","US defence companies","ITA","IDX_THEME_FUNDS","a near-copy of ITA"),
 ("SPMO","Invesco S&P 500 Momentum ETF","S&P 500 momentum names","MTUM","IDX_FACTOR","a second momentum fund"),
 ("PBW","Invesco WilderHill Clean Energy ETF","small clean-energy companies","TAN, ICLN (proposed)","IDX_THEME_FUNDS","a third clean-energy basket"),
 ("PICK","iShares MSCI Global Metals & Mining Producers ETF","global miners","COPX, XME (proposed)","IDX_THEME_FUNDS","XME and COPX cover it"),
 ("SLX","VanEck Steel ETF","steel makers","XME (proposed)","IDX_THEME_FUNDS","thin; XME holds the same US steel names"),
 ("XTN","State Street SPDR S&P Transportation ETF","transport, equal weight","IYT","IDX_THEME_FUNDS","thin twin of IYT"),
 ("SVXY","ProShares Short VIX Short-Term Futures ETF","VXX upside down","VXX","IDX_MACRO","the mirror image of a served fund")]:
    sk(t,n,c,"copy of a served line",None,"THIN" if t in("SLX","XTN") else "not assessed (skipped as a copy)",near,node,why)
# ---------------- checks
allrows=A+L+S; seen=set()
for r in allrows:
    assert r["ticker"] not in syms,("served",r["ticker"]); assert r["ticker"] not in TR1,("tr1",r["ticker"]); assert r["ticker"] not in seen,("dup",r["ticker"]); seen.add(r["ticker"])
    assert list(r.keys())==K
    for p in r["pairs_with"].replace(" (pending)","").replace(" (proposed)","").split(","):
        pass
# pairs_with of every ADMIT_NEXT must name a served fund
for r in A:
    assert any(p.strip() in syms for p in r["pairs_with"].split(",")),("pair not served",r["ticker"],r["pairs_with"])
# ---------------- pair numbers from local closes
path=D+"cohort-proposal/data/closes-6m-20261006.csv"
rd=list(csv.reader(open(path))); hdr=rd[0]; closes={}
if len(hdr)>10:   # wide: date, SYM...
    for i,s in enumerate(hdr[1:],1):
        closes[s]=[(x[0],float(x[i])) for x in rd[1:] if len(x)>i and x[i] not in("","null","NaN")]
else:
    hl=[h.lower() for h in hdr]; si=[i for i,h in enumerate(hl) if h in("symbol","ticker")][0]; di=[i for i,h in enumerate(hl) if "date" in h or h=="d"][0]; ci=[i for i,h in enumerate(hl) if h in("close","c","adj_close")][0]
    for x in rd[1:]:
        try: closes.setdefault(x[si],[]).append((x[di],float(x[ci])))
        except: pass
    for s in closes: closes[s].sort()
def ratio_stats(a,b):
    da=dict(closes[a]); db=dict(closes[b]); dates=sorted(set(da)&set(db))[-127:]
    r=[da[d]/db[d] for d in dates]
    def ch(n): return round((r[-1]/r[-1-n]-1)*100,2)
    return {"sessions":len(dates)-1,"from":dates[0],"to":dates[-1],"ratio_change_126_pct":ch(len(dates)-1),"ratio_change_20_pct":ch(20)}
def P(num,den,name,up,down,needs,why,st):
    d={"ratio":num+" / "+den,"name":name,"rising_means":up,"falling_means":down,"needs_new_fund":needs,"why_it_changes_the_read":why,"strengthens":st}
    if num in closes and den in closes: d["measured_local"]=ratio_stats(num,den); d["facts_basis"]="MEASURED from closes-6m-20261006.csv (last 126 sessions)"
    else: d["measured_local"]=None; d["facts_basis"]="no local closes for "+(num if num not in closes else den)+": not measured"
    return d
pairs=[P("SPHB","SPLV","risk appetite","the jumpy stocks are beating the calm ones: traders are taking risk","money is hiding in the calm stocks: risk is being cut","SPHB","a seventh tide part cut from the same 500 stocks, so it is about appetite and nothing else","REGIME"),
 P("HYG","IEF","credit against safety","lenders are relaxed about weak companies","lenders want safety: the classic early warning for shares","none: both served","replaces the tide's HYG-minus-SPY part, which mixes credit with the stock market itself and is frozen at 23 Sep","REGIME"),
 P("RSPD","RSPS","cyclicals against defensives (equal weight)","shoppers' wants are beating shoppers' needs: confidence","staples are leading: caution","none: both served","the Hub has no cyclical-against-defensive read; equal weight keeps AMZN and TSLA from carrying it","SECTOR_STRENGTH"),
 P("IWM","SPY","small against large","the rally is reaching small companies: wide participation","only the big names are holding the market up","none: both served","the INDEXES tab shows both but never subtracts one from the other","BREADTH"),
 P("VXUS","SPY","the rest of the world against the US","the rest of the world is beating the US","the US is carrying the world","none: both served (ACWI / SPY once TR1 lands)","breadth and regime are S&P-only today; this is the first world participation line","BREADTH")]
runners=[P("CPER","GLD","growth against fear","factories busy","fear","CPER","share-free growth read","REGIME"),P("TIP","IEF","inflation expectations","more inflation expected","less inflation expected","TIP","tells an inflation scare from a growth scare","REGIME"),
 P("IWO","IWN","small growth against small value","speculation at the small end","caution at the small end","IWO, IWN","size-by-style grid","BREADTH"),P("KBWB","KRE","big banks against regional banks","big banks leading","small lenders catching up","KBWB","inside-sector read for FINANCE","SECTOR_STRENGTH"),
 P("XLY","XLP","cyclicals against defensives (by size)","confidence","caution","none: both served","the cap-weight twin of RSPD / RSPS","SECTOR_STRENGTH")]
served_macro=[{"ticker":t,"is":w} for t,w in [("TLT","long Treasuries (20+ years)"),("IEF","7-10 year Treasuries"),("SHY","1-3 year Treasuries"),("AGG","all US bonds"),("LQD","good-quality company bonds"),("HYG","junk bonds"),("UUP","the dollar against a basket"),("USO","oil"),("DBC","commodity basket"),("GLD","gold"),("SLV","silver"),("VXX","near-month VIX futures")]]
for m in served_macro: assert m["ticker"] in syms
not_served_checked=[t for t in "TIP UNG IBIT BND JNK EMB BIL SHV IEI TLH GOVT IAU PDBC GSG DBA CPER UVXY VIXY SVXY FXE FXY UDN BITO ETHA BKLN".split() if t not in syms]
from collections import Counter
out={"what":"TR2: the next index-fund admission batch after TR1's ten. Proposals only: nothing is admitted, served or changed by this file.",
 "built":datetime.datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"),
 "counts":{"admit_next":len(A),"admit_next_by_read":dict(Counter(r["strengthens"] for r in A)),"later":len(L),"skip":len(S),"judged":len(allrows),
           "admit_next_liquidity":dict(Counter(r["liquidity"] for r in A)),"thin_in_admit_next":[r["ticker"] for r in A if r["liquidity"]=="THIN"],
           "borderline_volume_in_admit_next":["FXY","XAR"]},
 "admit_next":A,"later":L,"skip":S,"pair_reads":pairs,"pair_reads_runners_up":runners,
 "served_macro_lines":served_macro,"macro_lines_checked_and_not_served":not_served_checked,
 "honest_notes":["Four of the five pair reads need no new fund: both halves are served today and only need wiring.",
  "No fund fixes breadth counting. The on-screen count has one stored session (23 Sep) and counts bond funds as names; the provider's whole-market engine is not connected. Funds add participation spreads, not a count.",
  "Five of the six tide parts come from a file frozen at 23 Sep with no builder, so a new fund cannot move the tide until that file has a script.",
  "The bow-tie column EQAL-IWB cannot draw: neither fund is served, EQAL trades about 27 thousand shares a day, and TR1 skipped IWB. Recommend dropping the column.",
  "A world breadth count becomes possible: 5 countries are served today (Japan, Germany, UK, Korea, China), TR1 adds 4 (Taiwan, India, Brazil, Canada) and this batch 3 (Mexico, Australia, Switzerland): 12 countries to count above or below their 50-day average; the 13 LATER country funds would take it to 25."],
 "method":{"sources":"(a) proposal.json spine and reference_funds, gaps.json index_layer_missing and themes_thin, index-layer.json SKIP rows; (b) countries and regions; (c) size, style and equal weight; (d) macro and risk-appetite lines.",
  "served_test":"every row was checked by script against universe-20261006.json (590 symbols, digest 116c79f2...) and TR1's ten; none is served or pending. Every ADMIT_NEXT row pairs with at least one served fund (asserted).",
  "liquidity":"LARGE = about 1 million shares a day or more; FINE = about 150 thousand to 1 million; THIN = under about 150 thousand. A THIN fund can fail the provider's settled-close cross-check and hold the whole set, so no THIN fund is in ADMIT_NEXT.",
  "facts":"each row's facts_basis says VERIFIED (public fund pages via web search, site named), MEASURED (local file named) or FROM MEMORY. first_year is FROM MEMORY unless facts_basis gives a launch date. No paid data API, no live database, no chart API was used.",
  "pair_numbers":"measured_local is the ratio's % change over the last 126 sessions and the last 20, from closes-6m-20261006.csv; it is null where one half is not served.",
  "tree_nodes":"IDX_ ids are those in scripts/cohort-tree-loader.mjs (IDX_US_BROAD, IDX_WORLD, IDX_COUNTRIES, IDX_STYLE, IDX_FACTOR, IDX_MACRO, IDX_THEME_FUNDS)."}}
# where each admitted fund goes in the tree: the index set it joins, and the topic cohort it becomes a reference line of
NODE={"SPHB":"IDX_FACTOR","TIP":"IDX_MACRO","IBIT":"IDX_MACRO","ARKK":"IDX_THEME_FUNDS","CPER":"IDX_MACRO","EMB":"IDX_MACRO","FXY":"IDX_MACRO","EMXC":"IDX_WORLD","VGK":"IDX_WORLD",
 "IWO":"IDX_STYLE","IWN":"IDX_STYLE","IWP":"IDX_STYLE","IWS":"IDX_STYLE","EWW":"IDX_COUNTRIES","EWA":"IDX_COUNTRIES","EWL":"IDX_COUNTRIES","KWEB":"IDX_THEME_FUNDS","XME":"IDX_THEME_FUNDS",
 "GRID":"IDX_THEME_FUNDS","SHLD":"IDX_THEME_FUNDS","MLPX":"IDX_THEME_FUNDS","KBWB":"IDX_THEME_FUNDS","ICLN":"IDX_THEME_FUNDS","WGMI":"IDX_THEME_FUNDS","XAR":"IDX_THEME_FUNDS","UNG":"IDX_MACRO"}
SPINE_FOR={"IBIT":"CRYPTO_EQUITIES","KWEB":"CHINA","XME":"COPPER_STEEL","GRID":"GRID_ELECTRICAL","SHLD":"DEFENCE_TECH","MLPX":"OIL_MIDSTREAM","KBWB":"BIG_BANKS_BROKERS","ICLN":"SOLAR_RENEWABLE","WGMI":"NEOCLOUDS_MINERS","XAR":"DEFENCE_PRIMES"}
TAKES_OVER={"IBIT","KWEB","GRID","SHLD","MLPX","KBWB","WGMI"}
for r in out["admit_next"]:
    r["tree_node_id"]=NODE[r["ticker"]]; r["spine_for"]=SPINE_FOR.get(r["ticker"])
    r["takes_over_spine"]=r["ticker"] in TAKES_OVER   # True = becomes the cohort's spine once served; False = a second line beside the spine it has
assert set(NODE)=={r["ticker"] for r in out["admit_next"]}, "every admitted fund needs a tree node"
os.makedirs(D+"tree-revision",exist_ok=True)
json.dump(out,open(D+"tree-revision/next-funds.json","w"),indent=1,ensure_ascii=False)
print(json.dumps(out["counts"])); 
for p in pairs+runners: print(p["ratio"],p["measured_local"])
print("csv header",hdr[:6],len(rd))
