#!/usr/bin/env python3
"""TR1 · the index layer, mapped. Every market-aggregate fund family: served today or not, what it tracks, which
funds are near-copies of one another, which one to keep, and what to admit. Correlations are MEASURED on the 126
sessions CO1 pulled from the chart API (7 Apr - 5 Oct 2026) and exist only where both funds are served; a fund we do
not serve has no measured number here, only the fact of which index it tracks. Writes index-layer.json."""
import csv, json, math, os
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.dirname(HERE); CO1 = os.path.join(os.path.dirname(D), "cohort-proposal")
U = json.load(open(os.path.join(CO1, "data", "universe-20261006.json"))); SERVED = set(U["symbols"])
rows = list(csv.DictReader(open(os.path.join(CO1, "data", "closes-6m-20261006.csv"))))
def rets(t):
    out = {}
    prev = None
    for r in rows:
        v = r.get(t)
        try: v = float(v)
        except (TypeError, ValueError): v = None
        if v and prev: out[r["date"]] = v / prev - 1
        if v: prev = v
    return out
def corr(a, b):
    if a not in SERVED or b not in SERVED: return None
    ra, rb = rets(a), rets(b); ks = sorted(set(ra) & set(rb))
    if len(ks) < 60: return None
    x = [ra[k] for k in ks]; y = [rb[k] for k in ks]; mx = sum(x) / len(x); my = sum(y) / len(y)
    sx = math.sqrt(sum((v - mx) ** 2 for v in x)); sy = math.sqrt(sum((v - my) ** 2 for v in y))
    return round(sum((p - mx) * (q - my) for p, q in zip(x, y)) / (sx * sy), 3) if sx and sy else None

# (ticker, family, tree cohort, what it tracks, the fund it is compared against (None = it is the one to keep), verdict, why)
# verdict: KEEP (served, the line to use) · COPY (served, a near-copy of the keep) · ADMIT (not served, recommended)
#          SKIP (not served, not recommended)
L = []
def add(t, fam, coh, tracks, vs, verdict, why): L.append(dict(ticker=t, family=fam, cohort=coh, tracks=tracks, vs=vs, verdict=verdict, why=why))
B = "IDX_US_BROAD"
add("SPY", "US broad", B, "S&P 500", None, "KEEP", "the market line the Hub already draws")
for t in ("VOO", "IVV", "SPLG"): add(t, "US broad", B, "S&P 500", "SPY", "SKIP", "the same index as SPY")
add("QQQ", "US broad", B, "Nasdaq-100", None, "KEEP", "the Hub already draws it")
add("QQQM", "US broad", B, "Nasdaq-100", "QQQ", "SKIP", "the same index as QQQ")
add("QQQE", "US broad · equal weight", B, "Nasdaq-100 equal weight", "QQQ", "KEEP", "the equal-weight twin of QQQ")
add("DIA", "US broad", B, "Dow Jones Industrial Average", None, "KEEP", "the Hub already draws it")
add("RSP", "US broad · equal weight", B, "S&P 500 equal weight", "SPY", "KEEP", "the equal-weight twin of SPY (Alan: 'the equal-weight indexes')")
add("VTI", "US broad", B, "CRSP US total market", "SPY", "KEEP", "the whole US market, small caps included")
add("ITOT", "US broad", B, "S&P total market", "VTI", "COPY", "a second total-market fund")
add("IWV", "US broad", B, "Russell 3000", "VTI", "COPY", "a third total-market fund")
add("IWB", "US broad", B, "Russell 1000", "SPY", "SKIP", "large caps again; SPY and VTI bracket it")
add("MDY", "US size", B, "S&P MidCap 400", None, "KEEP", "the mid-cap line")
add("IJH", "US size", B, "S&P MidCap 400", "MDY", "SKIP", "the same index as MDY")
add("VO", "US size", B, "CRSP mid cap", "MDY", "SKIP", "mid caps by another index maker; MDY is served")
add("IWM", "US size", B, "Russell 2000", None, "KEEP", "the small-cap line the Hub already draws")
add("IJR", "US size", B, "S&P SmallCap 600", "IWM", "KEEP", "small caps with a profit screen; behaves differently enough from IWM to keep both")
add("VB", "US size", B, "CRSP small cap", "IWM", "SKIP", "small caps a third way; IWM and IJR are served")
SEC = [("XLK", "VGT", "IYW", "RSPT", "technology"), ("XLF", "VFH", "IYF", "RSPF", "financials"), ("XLE", "VDE", "IYE", "RSPG", "energy"),
       ("XLV", "VHT", "IYH", "RSPH", "health care"), ("XLI", "VIS", "IYJ", "RSPN", "industrials"), ("XLY", "VCR", "IYC", "RSPD", "consumer discretionary"),
       ("XLP", "VDC", "IYK", "RSPS", "consumer staples"), ("XLU", "VPU", "IDU", "RSPU", "utilities"), ("XLB", "VAW", "IYM", "RSPM", "materials"),
       ("XLRE", "VNQ", "IYR", "RSPR", "real estate"), ("XLC", "VOX", "IYZ", "RSPC", "communication services")]
for x, v, i, r, name in SEC:
    add(x, "SPDR sector", "IDX_SECTOR_SPDR", f"S&P 500 {name}", None, "KEEP", "the SECTORS side of the Hub's compare toggle - unchanged")
    add(r, "Invesco equal-weight sector", "IDX_SECTOR_EQUAL_WEIGHT", f"S&P 500 {name}, equal weight", x, "KEEP", "the same names as the SPDR with every name counted the same - shows when the giants are doing the work")
    add(v, "Vanguard sector", "IDX_SECTOR_VANGUARD", f"MSCI US {name} (large, mid and small)", x, "COPY", "the sector again, with mid and small caps added")
    add(i, "iShares sector", "IDX_SECTOR_ISHARES", f"Dow Jones / Russell US {name}", x, "COPY", "the sector again by a third index maker")
# MEASURED exception: IYZ is the telecom industry (carriers and network gear), not the communication-services sector
# (which is mostly Alphabet and Meta). It moves 0.20 with XLC, so it is its own line, not a copy.
for r in L:
    if r["ticker"] == "IYZ": r.update(verdict="KEEP", tracks="Russell US telecommunications (carriers and gear)", why="NOT a copy: telecom only, while the sector fund is mostly Alphabet and Meta")
S = "IDX_STYLE"
add("VUG", "Vanguard style", S, "CRSP US large growth", None, "KEEP", "the growth line served today")
add("VTV", "Vanguard style", S, "CRSP US large value", None, "KEEP", "the value line served today")
add("MGK", "Vanguard style", S, "CRSP US mega-cap growth", "VUG", "COPY", "growth, the biggest names only")
add("SPYG", "S&P style", S, "S&P 500 Growth", "VUG", "ADMIT", "Alan: 'the S&P growth'. S&P's recipe adds momentum to the growth test; it sits beside SPY and the SPDR sectors")
add("SPYV", "S&P style", S, "S&P 500 Value", "VTV", "ADMIT", "Alan: 'the S&P value'")
add("IVW", "iShares style", S, "S&P 500 Growth", "SPYG", "SKIP", "the same index as SPYG - one of the pair is enough; SPYG is the same family as SPY and the XL sectors")
add("IVE", "iShares style", S, "S&P 500 Value", "SPYV", "SKIP", "the same index as SPYV")
add("IWF", "iShares style", S, "Russell 1000 Growth", "VUG", "SKIP", "a third recipe for the same split")
add("IWD", "iShares style", S, "Russell 1000 Value", "VTV", "SKIP", "a third recipe for the same split")
F = "IDX_FACTOR"
add("MTUM", "MSCI factor", F, "MSCI USA Momentum", None, "KEEP", "Alan: 'MSCI momentum'")
add("QUAL", "MSCI factor", F, "MSCI USA Quality", None, "KEEP", "Alan: 'quality'")
add("USMV", "MSCI factor", F, "MSCI USA Minimum Volatility", "SPLV", "ADMIT", "Alan: 'low vol'. MSCI's is a whole low-risk portfolio; SPLV is simply the 100 calmest S&P names")
add("VLUE", "MSCI factor", F, "MSCI USA Enhanced Value", "VTV", "ADMIT", "Alan: 'value'. Completes MSCI's four")
add("SIZE", "MSCI factor", F, "MSCI USA Low Size", "RSP", "SKIP", "trades thinly (ESTIMATE: 10-20 thousand shares a day): one thin fund failing the close cross-check holds the whole set. RSP and IWM already draw the size effect")
add("SPLV", "S&P factor", F, "S&P 500 Low Volatility", None, "KEEP", "the low-vol line served today")
add("SCHD", "dividend", F, "Dow Jones US Dividend 100", None, "KEEP", "the dividend line served today")
W = "IDX_WORLD"
add("VT", "world", W, "FTSE Global All Cap", None, "KEEP", "the whole world in one line (stands in for MSCI's until ACWI is served)")
add("ACWI", "MSCI world", W, "MSCI All Country World", "VT", "ADMIT", "Alan: 'URTH and ACWI'. MSCI's whole-world line: ACWI = URTH + EEM in MSCI's own arithmetic")
add("URTH", "MSCI world", W, "MSCI World (developed markets only)", "VT", "ADMIT", "Alan: 'URTH and ACWI'. The developed world; about 70% of it is the US")
add("VXUS", "world", W, "FTSE Global All Cap ex-US", None, "KEEP", "the world without the US")
add("ACWX", "MSCI world", W, "MSCI ACWI ex-US", "VXUS", "SKIP", "the world without the US again")
add("EFA", "MSCI region", W, "MSCI EAFE (developed ex-US and Canada)", None, "KEEP", "the developed-markets line, and the MSCI piece that adds up with URTH")
add("VEA", "Vanguard region", W, "FTSE Developed ex-US", "EFA", "SKIP", "EFA plus Canada and small caps; a near-copy by construction")
add("IEFA", "MSCI region", W, "MSCI EAFE investable (adds small caps)", "EFA", "SKIP", "EFA with small caps")
add("EEM", "MSCI region", W, "MSCI Emerging Markets", None, "KEEP", "the emerging-markets line")
add("VWO", "Vanguard region", W, "FTSE Emerging (no Korea)", "EEM", "SKIP", "emerging markets by FTSE: leaves Korea out, otherwise the same countries")
add("IEMG", "MSCI region", W, "MSCI Emerging investable", "EEM", "SKIP", "EEM with small caps")
add("EZU", "MSCI region", W, "MSCI Eurozone", None, "KEEP", "the euro-area line")
add("VGK", "Vanguard region", W, "FTSE Europe (adds UK, Switzerland)", "EZU", "SKIP", "EZU and EWU together already cover it; a later choice")
C = "IDX_COUNTRIES"
for t, n in (("EWJ", "Japan"), ("EWG", "Germany"), ("EWU", "United Kingdom"), ("EWY", "South Korea")):
    add(t, "MSCI country", C, f"MSCI {n}", None, "KEEP", "served today")
add("MCHI", "MSCI country", C, "MSCI China", None, "KEEP", "China, the broad line")
add("FXI", "China", C, "FTSE China 50 (Hong Kong-listed giants)", "MCHI", "COPY", "China's 50 biggest; rides with MCHI")
add("ASHR", "China", C, "CSI 300 (mainland A-shares)", "MCHI", "KEEP", "the mainland market, a different animal from the Hong Kong lines")
add("EWT", "MSCI country", C, "MSCI Taiwan", None, "ADMIT", "Taiwan has no line today; TSM and the Taiwanese chip names have nothing to stand against")
add("INDA", "MSCI country", C, "MSCI India", None, "ADMIT", "India is not on the board at all - no fund, no single name")
add("EWZ", "MSCI country", C, "MSCI Brazil", None, "ADMIT", "the LATIN AMERICA cohort has no reference line")
add("EWC", "MSCI country", C, "MSCI Canada", None, "ADMIT", "the CANADA cohort (9 names) has no reference line")
seen = set()
for r in L:
    assert r["ticker"] not in seen, r["ticker"]; seen.add(r["ticker"])
    r["served"] = r["ticker"] in SERVED
    r["corr_6m"] = corr(r["ticker"], r["vs"]) if r["vs"] else None
    assert (r["verdict"] in ("KEEP", "COPY")) == r["served"], r
out = dict(what="TR1 index layer: every market-aggregate family, served or not, near-copies, keep, admit.",
           measured="corr_6m = correlation of daily moves over the 126 sessions 7 Apr - 5 Oct 2026 (chart API closes pulled by CO1); present only when both funds are served",
           universe=dict(count=U["count"], digest=U["universe_sha256"]),
           counts={k: sum(1 for r in L if r["verdict"] == k) for k in ("KEEP", "COPY", "ADMIT", "SKIP")},
           admit=[r["ticker"] for r in L if r["verdict"] == "ADMIT"], funds=L)
json.dump(out, open(os.path.join(D, "index-layer.json"), "w"), indent=1)
print(json.dumps(out["counts"]), out["admit"])
for r in L:
    if r["corr_6m"] is not None: print(f'{r["ticker"]:5} vs {r["vs"]:5} {r["corr_6m"]:.3f} {r["verdict"]}')
