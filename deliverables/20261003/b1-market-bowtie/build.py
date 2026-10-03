#!/usr/bin/env python3
"""B1 (3 Oct 2026) · the market bow tie, measured.

Joins, read-only, into data/market-bowtie-20261003.json and data.js (the page's copy):
  * the off-Hub close Geiger for every instrument we compute   chart API /v1/scout-geiger (2 Oct close, 5,642 rows)
  * the Hub's live Geiger for the 590 served names             chart API /geiger
  * the six closes 25 Sep – 2 Oct for every name               massive_stocks.scout_geiger_daily (read-only SQL)
  * who exists: every listed US common name, its FMP sector, industry and market cap   FMP /stable/company-screener
    (read on the Fly bar-service machine, 3 Oct 15:56Z; the key never left Fly)
  * the Hub's own classification for its 590 names             public.ticker_industry + public.company_profile (fallback)
  * Alan's cohorts                                             public.ticker_membership (T12's 3 Oct export)
  * the Hub's bow tie pairs (RSP − SPY …)                      index.html BOWTIE_PAIRS, copied verbatim
Soundness follows T12's rule (3 Oct) so the two lanes agree: n with a reading ≥ 8 · standard error ≤ 0.10 · held on each
of the 6 closes. B1 adds ONE neighbour: the aggregate must also cover ≥ 90 % of the market value of the names that exist
(else "thin"). Nothing is written to a table.
"""
import json, re, math, os, sys
from collections import defaultdict, Counter
HERE = os.path.dirname(os.path.abspath(__file__))
IN = os.environ.get("B1_IN", "/private/tmp/claude-501/-Users-alanharvey-SCINTILLA-0-5/862d0870-d8f8-45e4-9b07-b6e7a075ba75/scratchpad")
def J(p): return json.load(open(p))
def norm(t): return (t or "").upper().replace(".", "-")

scout = J(f"{IN}/scout-geiger-full.json")
hub = J(f"{IN}/hub-geiger-live.json")
six = J(f"{IN}/scout-daily-6closes.json")["rows"]
scr = J(f"{IN}/fmp-screener-20261003.json")
hubcls = J(f"{IN}/in/hub-classification.json")["rows"]
memb = J(f"{IN}/in/ticker_membership-20261003.json")["rows"]
holdings = J(f"{IN}/in/holdings-20260926.json")

DATES = sorted({r["d"] for r in six})
SECTOR_MAP = {"Basic Materials": "MATERIALS", "Energy": "ENERGY", "Financial Services": "FINANCIALS", "Industrials": "INDUSTRIAL",
              "Technology": "TECH", "Consumer Defensive": "STAPLES", "Real Estate": "REAL ESTATE", "Utilities": "UTILITIES",
              "Healthcare": "HEALTH", "Consumer Cyclical": "DISCRET", "Communication Services": "COMMS"}
SHORT = {"MATERIALS": "MATL", "ENERGY": "ENRG", "FINANCIALS": "FINL", "INDUSTRIAL": "INDU", "TECH": "TECH", "STAPLES": "STPL",
         "REAL ESTATE": "REAL", "UTILITIES": "UTIL", "HEALTH": "HLTH", "DISCRET": "DISC", "COMMS": "COMM"}
SPDR = {"MATERIALS": "XLB", "ENERGY": "XLE", "FINANCIALS": "XLF", "INDUSTRIAL": "XLI", "TECH": "XLK", "STAPLES": "XLP",
        "REAL ESTATE": "XLRE", "UTILITIES": "XLU", "HEALTH": "XLV", "DISCRET": "XLY", "COMMS": "XLC"}
# the Hub's pairs, verbatim (index.html, BOWTIE_PAIRS): [equal-weight, cap-weight, name, short]
BOWTIE_PAIRS = [["RSP","SPY","S&P 500","S&P"],["QQQE","QQQ","NASDAQ-100","NDX"],["EQAL","IWB","RUSSELL 1000","R1K"],
    ["RSPM","XLB","MATERIALS","MATL"],["RSPG","XLE","ENERGY","ENRG"],["RSPF","XLF","FINANCIALS","FINL"],["RSPN","XLI","INDUSTRIAL","INDU"],
    ["RSPT","XLK","TECH","TECH"],["RSPS","XLP","STAPLES","STPL"],["RSPR","XLRE","REAL ESTATE","REAL"],["RSPU","XLU","UTILITIES","UTIL"],
    ["RSPH","XLV","HEALTH","HLTH"],["RSPD","XLY","DISCRETIONARY","DISC"],["RSPC","XLC","COMMS","COMM"]]

# ---- who exists: active common names on NASDAQ/NYSE/AMEX, minus preferreds, notes, SPAC shells and warrants ----
NOTE_RX = re.compile(r"(\bnotes?\b|preferred|debenture|depositary|%|\bdue\s+\d{4}|capital securities|subordinated|trust pfd|\bpfd\b|warrant|\bunits?\b|\brights?\b)", re.I)
exists = {}   # norm ticker -> row
for sym, sector, industry, mcap, is_etf, is_fund, active, exch, country, name in scr["rows"]:
    if is_etf or is_fund or not active: continue
    if sector not in SECTOR_MAP: continue
    if industry == "Shell Companies": continue
    if re.search(r"-P[A-Z]?$|-W[A-Z]?$|-U$|-R$", sym) or NOTE_RX.search(name or ""): continue
    t = norm(sym)
    if t in exists and (exists[t]["mcap"] or 0) >= (mcap or 0): continue
    exists[t] = {"t": t, "sector": SECTOR_MAP[sector], "industry": industry or "—", "mcap": float(mcap or 0), "name": name, "country": country, "exch": exch}
# one company, one weight: FMP gives every share class (GOOG / GOOGL, PBR / PBR-A) and some parent-company notes (SOJE, SOMN)
# the WHOLE company's market cap. Keep one symbol per company name — the computed one if any, else the shortest symbol.
_computed_syms = {norm(r[0]) for r in scout["rows"] if r[1] is not None} | {norm(t) for t in hub["symbols"]}
def _namekey(n): return re.sub(r"\s+", " ", re.sub(r"\b(class [abc]|ordinary shares|common stock|inc\.?|corp\.?|corporation|plc|ltd\.?|limited|the|s\.a\.|n\.v\.|ag|sa|co\.?)\b", "", (n or "").lower().replace(",", ""))).strip()
_byname = defaultdict(list)
for t, e in exists.items(): _byname[_namekey(e["name"])].append(t)
dropped_classes = []
for k, ts in _byname.items():
    if len(ts) < 2 or not k: continue
    ts.sort(key=lambda t: (t not in _computed_syms, len(t), t))
    for t in ts[1:]: dropped_classes.append(t); exists.pop(t, None)
# fallback classification for Hub names the screener lacks (e.g. foreign listings)
for r in hubcls:
    t = norm(r["ticker"]); s = SECTOR_MAP.get(r["fmp_sector"])
    if t not in exists and s and not r.get("is_etf"):
        exists[t] = {"t": t, "sector": s, "industry": r["fmp_industry"] or "—", "mcap": float(r["market_cap"] or 0), "name": r["name"], "country": r.get("country"), "exch": "hub", "from": "ticker_industry"}

# ---- what we compute ----
close = {}   # norm -> {g, kind, session, reading, trend, mom}
for t, comp, tr, mo, rungs, kind, sess, rc, reading in scout["rows"]:
    if comp is None: continue
    close[norm(t)] = {"g": comp, "tr": tr, "mo": mo, "kind": kind, "session": sess, "reading": reading, "raw": t}
live = {}
for t, v in hub["symbols"].items():
    if v and v.get("composite") is not None: live[norm(t)] = {"g": v["composite"], "tr": v.get("trend"), "mo": v.get("momentum")}
hist = defaultdict(dict)   # norm -> {date: composite}
for r in six: hist[norm(r["ticker"])][r["d"]] = float(r["c"])

def reading(t, mode):
    """mode 'blend' = live Hub where served (Alan: 'a little wrong beats a little old'), else the 2 Oct close; 'close' = the close only."""
    if mode == "blend" and t in live: return live[t]["g"], "live"
    if t in close: return close[t]["g"], "close"
    return None, None

def mean(xs): return sum(xs) / len(xs) if xs else None
def sd(xs):
    if len(xs) < 2: return None
    m = mean(xs); return math.sqrt(sum((x - m) ** 2 for x in xs) / (len(xs) - 1))

def measure(members, label, kind, mode="blend", exists_members=None):
    """members: the names we might compute; exists_members: the names that exist (for coverage). Returns the column."""
    rows = []
    for t in members:
        g, src = reading(t, mode)
        e = exists.get(t) or {}
        rows.append({"t": t, "g": g, "src": src, "mcap": e.get("mcap", 0.0), "name": e.get("name"), "industry": e.get("industry"), "country": e.get("country")})
    read = [r for r in rows if r["g"] is not None]
    gs = [r["g"] for r in read]
    ew = mean(gs)
    capw = [r for r in read if r["mcap"] > 0]
    cw = (sum(r["g"] * r["mcap"] for r in capw) / sum(r["mcap"] for r in capw)) if capw else None
    se = (sd(gs) / math.sqrt(len(gs))) if len(gs) > 1 else None
    ex = exists_members if exists_members is not None else members
    ex_rows = [exists[t] for t in ex if t in exists]
    mv_exist = sum(r["mcap"] for r in ex_rows)
    mv_have = sum(r["mcap"] for r in read)
    mv_share = (mv_have / mv_exist) if mv_exist > 0 else None
    closes = []
    for d in DATES:
        xs = [hist[t][d] for t in members if d in hist.get(t, {})]
        closes.append({"date": d, "n": len(xs), "mean": round(mean(xs), 3) if xs else None, "se": round(sd(xs) / math.sqrt(len(xs)), 3) if len(xs) > 1 else None})
    means = [c["mean"] for c in closes if c["mean"] is not None]
    closes_pass = sum(1 for c in closes if c["n"] >= 8 and c["se"] is not None and c["se"] <= 0.10)
    rules = {"enough": len(gs) >= 8, "agree": se is not None and se <= 0.10, "steady": closes_pass == len(DATES),
             "covered": mv_share is not None and mv_share >= 0.90}
    if rules["enough"] and rules["agree"] and rules["steady"] and rules["covered"]: verdict = "sound"
    elif rules["enough"] and rules["steady"]: verdict = "thin"
    else: verdict = "not yet"
    missing = sorted([r for r in ex_rows if r["t"] not in {x["t"] for x in read}], key=lambda r: -r["mcap"])
    # the names that would make it sound: biggest first, until the covered share reaches 90 %
    need, have = [], mv_have
    for r in missing:
        if mv_exist > 0 and have / mv_exist >= 0.90: break   # already covered: nothing is needed
        need.append({"t": r["t"], "name": r["name"], "mcap_bn": round(r["mcap"] / 1e9, 1), "country": r["country"], "industry": r["industry"],
                     "tier": "close tier" , "why": ("foreign listing (ADR): not in the Massive common-stock type the close job reads" if (r["country"] or "US") != "US" else "no bars in the close job's listing yet")})
        have += r["mcap"]
        if len(need) >= 40: break
    weak = []
    if not rules["enough"]: weak.append(f"only {len(gs)} with a reading (needs 8)")
    if se is not None and se > 0.10: weak.append(f"the names disagree: standard error {se:.2f} (limit 0.10)")
    if closes_pass < len(DATES): weak.append(f"held on {closes_pass} of {len(DATES)} closes")
    if mv_share is not None and mv_share < 0.90: weak.append(f"covers {mv_share*100:.0f}% of the market value that exists (needs 90%)")
    top = sorted(read, key=lambda r: -r["mcap"])[:6]
    return {"label": label, "kind": kind, "n_exist": len(ex_rows), "n_compute": len(rows), "n_read": len(gs), "n_live": sum(1 for r in read if r["src"] == "live"),
            "n_close": sum(1 for r in read if r["src"] == "close"), "up": sum(1 for g in gs if g > 0), "down": sum(1 for g in gs if g < 0),
            "ew": round(ew, 4) if ew is not None else None, "cw": round(cw, 4) if cw is not None else None,
            "bowtie": round(ew - cw, 4) if (ew is not None and cw is not None) else None,
            "sd": round(sd(gs), 3) if len(gs) > 1 else None, "se": round(se, 3) if se is not None else None,
            "mv_exist_bn": round(mv_exist / 1e9, 1), "mv_have_bn": round(mv_have / 1e9, 1), "mv_share": round(mv_share, 4) if mv_share is not None else None,
            "closes": closes, "swing": round(max(means) - min(means), 3) if means else None, "closes_pass": closes_pass,
            "rules": rules, "verdict": verdict, "weak": weak, "need": need, "missing_n": len(missing),
            "missing_top": [{"t": r["t"], "name": r["name"], "mcap_bn": round(r["mcap"] / 1e9, 1), "country": r["country"]} for r in missing[:3]],
            "top": [{"t": r["t"], "g": round(r["g"], 3), "src": r["src"], "mcap_bn": round(r["mcap"] / 1e9, 1)} for r in top]}

# ---- sectors and industries, from every name that exists (computed or not) plus computed names the screener lacks ----
by_sector_exist = defaultdict(list); by_ind_exist = defaultdict(list)
for t, e in exists.items():
    by_sector_exist[e["sector"]].append(t); by_ind_exist[(e["sector"], e["industry"])].append(t)
computed_stocks = {t for t, c in close.items() if c["kind"] in ("CS", "TREE_NAME")} | {t for t in live if t in exists}
unclassified = sorted(t for t in computed_stocks if t not in exists)
out = {"what": "B1 · the market bow tie: sector, industry and cohort heat from every instrument we compute, with each aggregate's soundness",
       "built_utc": __import__("datetime").datetime.utcnow().isoformat() + "Z",
       "as_of": {"close": scout["as_of"], "close_run": scout["run_id"], "close_computed_utc": scout["computed_utc"], "live_computed_utc": hub["computed_utc"],
                 "six_closes": DATES, "screener_fetched_utc": scr["fetched_utc"], "equalizer_receipt": scout["equalizer"]["receipt_sha256"]},
       "rule": "sound = n with a reading ≥ 8 · standard error ≤ 0.10 · held on each of the 6 closes (T12's rule) · AND the names we read carry ≥ 90 % of the market value of the names that exist (B1's one neighbour) · thin = enough and steady but under-covered or disagreeing · not yet = too few or not steady",
       "counts": {"exist_common": len(exists), "computed_close_rows": len(close), "computed_stocks": len(computed_stocks), "live_hub": len(live),
                  "exist_not_computed": sum(1 for t in exists if t not in close and t not in live),
                  "computed_not_classified": len(unclassified), "screener_rows": len(scr["rows"]), "second_classes_dropped": len(dropped_classes)},
       "unclassified_sample": unclassified[:60], "second_classes_dropped_sample": sorted(dropped_classes)[:80], "modes": {}}
for mode in ("blend", "close"):
    sectors = []
    for s in SECTOR_MAP.values():
        ex = by_sector_exist[s]
        members = sorted(set(ex))   # every name that exists in the sector; measure() reads the ones we compute
        col = measure(members, s, "sector", mode, exists_members=ex)
        col["short"] = SHORT[s]; col["spdr"] = SPDR[s]
        # one level down: FMP industries with 8+ computed names (plus a count of the smaller ones)
        inds = []
        for (s2, ind), tk in by_ind_exist.items():
            if s2 != s: continue
            m = measure(sorted(set(tk)), ind, "industry", mode, exists_members=tk)
            m["sector"] = s
            inds.append(m)
        inds.sort(key=lambda m: (m["ew"] is None, -(m["ew"] or -9)))
        col["industries"] = [m for m in inds if m["n_read"] >= 8]
        col["industries_small"] = [{"label": m["label"], "n_read": m["n_read"], "n_exist": m["n_exist"], "ew": m["ew"]} for m in inds if m["n_read"] < 8]
        sectors.append(col)
    sectors.sort(key=lambda c: -(c["ew"] if c["ew"] is not None else -9))
    # the fund pairs (the Hub's bow tie today), read the same way
    pairs = []
    for ewf, cwf, name, short in BOWTIE_PAIRS:
        a, sa = reading(norm(ewf), mode); b, sb = reading(norm(cwf), mode)
        sec = next((c for c in sectors if c["label"] == name or (name == "DISCRETIONARY" and c["label"] == "DISCRET")), None)
        pairs.append({"ew_fund": ewf, "cw_fund": cwf, "label": name, "short": short, "ew": a, "cw": b, "src": [sa, sb],
                      "diff": round(a - b, 4) if (a is not None and b is not None) else None,
                      "members_bowtie": sec["bowtie"] if sec else None, "members_ew": sec["ew"] if sec else None, "members_cw": sec["cw"] if sec else None})
    pairs.sort(key=lambda p: -(p["diff"] if p["diff"] is not None else -9))
    # Alan's cohorts (ticker_membership kind=cohort; the 1-member sector placeholders are left out)
    cohorts = []
    for r in memb:
        if r["kind"] != "cohort" or r["n"] < 2: continue
        tk = [norm(x) for x in r["tickers"].split()]
        m = measure(tk, r["group_key"].replace("_", " "), "cohort", mode, exists_members=tk)
        m["funds_or_macro"] = r["group_key"] in ("INDEXES", "MACRO")
        # a cohort's members are its definition: coverage is the share we read, by count (funds have no market cap)
        if m["mv_exist_bn"] == 0:
            m["rules"]["covered"] = m["n_read"] >= 0.9 * len(tk); m["mv_share"] = None
            m["verdict"] = "sound" if (m["rules"]["enough"] and m["rules"]["agree"] and m["rules"]["steady"] and m["rules"]["covered"]) else ("thin" if (m["rules"]["enough"] and m["rules"]["steady"]) else "not yet")
        m["members"] = [{"t": t, "g": (reading(t, mode)[0]), "src": reading(t, mode)[1]} for t in tk]
        cohorts.append(m)
    cohorts.sort(key=lambda c: -(c["ew"] if c["ew"] is not None else -9))
    # the whole market, one number
    allm = sorted(exists.keys())
    market = measure(allm, "MARKET", "market", mode, exists_members=allm)
    out["modes"][mode] = {"sectors": sectors, "pairs": pairs, "cohorts": cohorts, "market": market}

# agreement between the two bow ties (members EW−CW vs the fund pair) across the 11 sectors
P = out["modes"]["blend"]["pairs"]
both = [(p["diff"], p["members_bowtie"]) for p in P if p["diff"] is not None and p["members_bowtie"] is not None]
def corr(xy):
    xs = [a for a, b in xy]; ys = [b for a, b in xy]
    if len(xs) < 3: return None
    mx, my = mean(xs), mean(ys); num = sum((x - mx) * (y - my) for x, y in zip(xs, ys))
    den = math.sqrt(sum((x - mx) ** 2 for x in xs) * sum((y - my) ** 2 for y in ys))
    return num / den if den else None
out["bowtie_agreement"] = {"pairs_compared": len(both), "same_sign": sum(1 for a, b in both if (a >= 0) == (b >= 0)), "correlation": round(corr(both), 3) if corr(both) is not None else None}

# verdict counts
def counts(items): return dict(Counter(i["verdict"] for i in items))
B = out["modes"]["blend"]
out["verdicts"] = {"sectors": counts(B["sectors"]), "industries": counts([i for s in B["sectors"] for i in s["industries"]]),
                   "industries_small": sum(len(s["industries_small"]) for s in B["sectors"]), "cohorts": counts(B["cohorts"]),
                   "names_needed": {"sectors": sorted({n["t"] for s in B["sectors"] for n in s["need"]}),
                                    "industries": sorted({n["t"] for s in B["sectors"] for i in s["industries"] for n in i["need"]})}}
os.makedirs(f"{HERE}/data", exist_ok=True)
json.dump(out, open(f"{HERE}/data/market-bowtie-20261003.json", "w"), indent=0)
open(f"{HERE}/data.js", "w").write("window.B1=" + json.dumps(out) + ";")
print(json.dumps({"counts": out["counts"], "verdicts": out["verdicts"]["sectors"], "industries": out["verdicts"]["industries"], "cohorts": out["verdicts"]["cohorts"], "agreement": out["bowtie_agreement"], "sector_names_needed": len(out["verdicts"]["names_needed"]["sectors"]), "industry_names_needed": len(out["verdicts"]["names_needed"]["industries"])}, indent=1))
for s in B["sectors"]: print(f'{s["short"]:5} ew {s["ew"]:+.3f} cw {s["cw"]:+.3f} bt {s["bowtie"]:+.3f} read {s["n_read"]}/{s["n_exist"]} mv {s["mv_share"]*100:.1f}% se {s["se"]} pass {s["closes_pass"]} {s["verdict"]} {s["weak"]}')
