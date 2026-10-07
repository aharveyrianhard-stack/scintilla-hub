# PP1 · what the vendor's statements do not carry, read from the companies' own tagged filings at the SEC (no key):
# the share count on the cover, convertible notes outstanding, lease liabilities, shares left out of diluted EPS because
# the company is at a loss (the overhang), purchase commitments and revenue already under contract.
# One GET per company to data.sec.gov with the house contact, at most four a second (the pace of unlock-watch and NP1).
# Read-only. Run from the scratch folder:   python3 <this file> T1 T2 …      (or no arguments: the tickers in sec/want.json)
import json, os, sys, time, gzip, io, urllib.request
UA = "ScintillaHub research research@scintillahub.ai"          # the house contact used by unlock-watch; never a personal address
_last = [0.0]
def sec_get(url, timeout=120):
    wait = 0.26 - (time.time() - _last[0])
    if wait > 0: time.sleep(wait)
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
    for att in range(4):
        try:
            r = urllib.request.urlopen(req, timeout=timeout); _last[0] = time.time(); b = r.read()
            return gzip.GzipFile(fileobj=io.BytesIO(b)).read() if r.headers.get("Content-Encoding") == "gzip" else b
        except urllib.error.HTTPError as e:
            _last[0] = time.time()
            if e.code == 404: return None
            if att == 3: raise
            time.sleep(2 + 3 * att)
        except Exception:
            if att == 3: raise
            time.sleep(2 + 3 * att)
# the tags read, by what they mean here (US GAAP first; the IFRS names a foreign filer uses where one exists)
TAGS = {
    "cover_shares": [("dei", "EntityCommonStockSharesOutstanding")],
    "convertible": [("us-gaap", t) for t in ("ConvertibleNotesPayable", "ConvertibleNotesPayableCurrent", "ConvertibleNotesPayableNoncurrent", "ConvertibleDebt", "ConvertibleDebtCurrent", "ConvertibleDebtNoncurrent",
                                              "ConvertibleLongTermNotesPayable", "ConvertibleSubordinatedDebt", "ConvertibleSubordinatedDebtNoncurrent", "ConvertibleSubordinatedDebtCurrent")],
    "convertible_raised": [("us-gaap", "ProceedsFromConvertibleDebt")],
    "conversion_price": [("us-gaap", "DebtInstrumentConvertibleConversionPrice1")],
    "left_out_of_diluted": [("us-gaap", "AntidilutiveSecuritiesExcludedFromComputationOfEarningsPerShareAmount")],
    "lease_operating": [("us-gaap", "OperatingLeaseLiability"), ("ifrs-full", "LeaseLiabilities")],
    "lease_finance": [("us-gaap", "FinanceLeaseLiability")],
    "lease_finance_added": [("us-gaap", "RightOfUseAssetObtainedInExchangeForFinanceLeaseLiability")],
    "lease_operating_added": [("us-gaap", "RightOfUseAssetObtainedInExchangeForOperatingLeaseLiability")],
    "purchase_commitments": [("us-gaap", t) for t in ("PurchaseObligation", "UnrecordedUnconditionalPurchaseObligationBalanceSheetAmount", "LongTermPurchaseCommitmentAmount", "PurchaseCommitmentRemainingMinimumAmountCommitted", "ContractualObligation")],
    "under_contract": [("us-gaap", "RevenueRemainingPerformanceObligation")],
    "interest_paid": [("us-gaap", "InterestPaidNet"), ("us-gaap", "InterestPaid")],
    "debt_due_12m": [("us-gaap", "LongTermDebtMaturitiesRepaymentsOfPrincipalInNextTwelveMonths"), ("us-gaap", "LongTermDebtCurrent")],
}
def pick(facts, taxonomy, tag, keep=24):
    """The newest reported values of one tag: [{end, start, val, form, filed, unit, fy, fp}], newest first."""
    node = ((facts.get("facts") or {}).get(taxonomy) or {}).get(tag)
    if not node: return []
    rows = []
    for unit, vals in (node.get("units") or {}).items():
        for v in vals: rows.append({"end": v.get("end"), "start": v.get("start"), "val": v.get("val"), "form": v.get("form"), "filed": v.get("filed"), "unit": unit, "fy": v.get("fy"), "fp": v.get("fp")})
    rows.sort(key=lambda r: (r["end"] or "", r["filed"] or ""), reverse=True)
    return rows[:keep]
def read_company(cik10):
    b = sec_get(f"https://data.sec.gov/api/xbrl/companyfacts/CIK{cik10}.json")
    if b is None: return None
    facts = json.loads(b); out = {"entity": facts.get("entityName")}
    for name, tags in TAGS.items():
        out[name] = {f"{tx}:{tg}": pick(facts, tx, tg) for tx, tg in tags if pick(facts, tx, tg)}
    return out
if __name__ == "__main__":
    os.makedirs("sec", exist_ok=True)
    want = [a.upper() for a in sys.argv[1:]] or json.load(open("sec/want.json"))
    if not os.path.exists("sec/company_tickers.json"): open("sec/company_tickers.json", "wb").write(sec_get("https://www.sec.gov/files/company_tickers.json"))
    cik = {r["ticker"].upper(): str(r["cik_str"]).zfill(10) for r in json.load(open("sec/company_tickers.json")).values()}
    t0 = time.time(); n = 0; missing = []; empty = []
    for t in want:
        if os.path.exists(f"sec/{t}.json"): continue
        c = cik.get(t) or cik.get(t.replace(".", "-"))
        if not c: missing.append(t); continue
        try: o = read_company(c)
        except Exception as e: o = {"error": str(e)[:160]}
        if o is None: empty.append(t); o = {"error": "no tagged facts at the SEC for this company"}
        o["cik"] = c; json.dump(o, open(f"sec/{t}.json", "w")); n += 1
        if n % 20 == 0: print(n, t, round(time.time() - t0), "s", flush=True)
    print("read", n, "in", round(time.time() - t0), "s · not in the SEC's ticker list:", missing, "· no tagged facts:", empty)
