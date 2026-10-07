# GH1 · forward P/E and next-twelve-month EPS growth at each of the seven dates, from the Hub's own FMP tables (public read).
# NTM EPS  = the consensus EPS of the four fiscal quarters that END after the date (public.analyst_estimates, period = quarter)
# prior    = the consensus EPS of the four quarters that ended on or before the date (same table, same basis)
# fwd P/E  = that day's close / NTM EPS ;  growth = NTM / prior - 1
# HINDSIGHT: FMP keeps one consensus per fiscal quarter. For a quarter since reported it is the last consensus before the
# report, which lands close to what was actually earned - not what analysts expected on the date in the table. The Hub only
# began keeping dated copies of estimates on 11 Aug 2026 (analyst_estimates_daily), so no at-the-time number exists for these dates.
# Guards: four consecutive quarters each side; a quarter whose stored estimate is more than 6x the reported (split-adjusted)
# EPS is on an old share basis (FMP did not restate it for later splits) and voids the cell; companies that report in
# another currency (TSM) get growth only.
import json, datetime as dtm, numpy as np, pickle
F = json.load(open("fmp-public.json")); C = json.load(open("gh1-core.json")); RES = pickle.load(open("replay.pkl", "rb"))
P = lambda s: dtm.date.fromisoformat(s[:10])
NONUSD = {"TSM"}
def quarters(t):
    e = sorted([x for x in F["estimates"] if x["ticker"] == t and x["period"] == "quarter" and x.get("est_eps_avg") is not None], key=lambda x: x["fiscal_date"])
    h = {x["fiscal_date"]: x for x in F["history"] if x["ticker"] == t and x["period"] != "FY"}
    return e, h
def reported_near(h, fd):
    best = None
    for k, v in h.items():
        dd = abs((P(k) - P(fd)).days)
        if dd <= 20 and (best is None or dd < best[0]): best = (dd, v)
    return best[1] if best else None
# FMP restates its stored QUARTERLY estimates for splits only from fiscal quarters ending in 2019. Before that the rows are in
# the share count of the time: visible as a 40x (NVDA: 4-for-1 in 2021, 10-for-1 in 2024) and 10x (AVGO: 10-for-1 in 2024) step
# between the Oct/Nov 2018 and Jan/Feb 2019 quarters while reported EPS (already restated) runs straight through.
# Those older rows are divided by the later split factor here. AAPL, AMZN and GOOGL rows are already restated by FMP.
OLD_BASIS = {"NVDA": ("2019-01-01", 40.0), "AVGO": ("2019-01-01", 10.0)}
def qeps(t, x):
    ob = OLD_BASIS.get(t)
    return x["est_eps_avg"] / ob[1] if ob and x["fiscal_date"] < ob[0] else x["est_eps_avg"]
def finish(t, price, ntm, prior, extra):
    out = {"ntm_eps": round(ntm, 4), "prior_eps": round(prior, 4), "growth": None, "growth_note": None, "fwd_pe": None, "pe_note": None, **extra}
    if ntm <= 0: out["pe_note"] = "loss ahead"; out["growth_note"] = "loss ahead"
    elif prior <= 0: out["growth_note"] = "from a loss"
    else: out["growth"] = round((ntm / prior - 1) * 100, 1)
    if t in NONUSD: out["pe_note"] = "reports in another currency"
    elif ntm > 0: out["fwd_pe"] = round(price / ntm, 1)
    return out
def annual_blend(t, D, price):
    """NQ1's blend (growth_all.py): the fiscal year in progress and the one after, weighted by how much of the first is left."""
    if t in OLD_BASIS and D < "2019-06-01": return None
    e = sorted([x for x in F["estimates"] if x["ticker"] == t and x["period"] == "annual" and x.get("est_eps_avg") is not None], key=lambda x: x["fiscal_date"])
    d = P(D); fut = [x for x in e if P(x["fiscal_date"]) > d][:2]; past = [x for x in e if P(x["fiscal_date"]) <= d][-1:]
    if len(fut) < 2 or not past: return None
    seq = past + fut; gaps = [(P(seq[i + 1]["fiscal_date"]) - P(seq[i]["fiscal_date"])).days for i in range(2)]
    if min(gaps) < 340 or max(gaps) > 390: return None
    w = max(0.0, min(1.0, (P(fut[0]["fiscal_date"]) - d).days / 365.0))
    ntm = w * fut[0]["est_eps_avg"] + (1 - w) * fut[1]["est_eps_avg"]; prior = w * past[0]["est_eps_avg"] + (1 - w) * fut[0]["est_eps_avg"]
    return finish(t, price, ntm, prior, {"method": "annual", "years": [x["fiscal_date"] for x in seq]})
def cell(t, D, price):
    e, h = quarters(t); d = P(D)
    nxt = [x for x in e if P(x["fiscal_date"]) > d][:4]; prv = [x for x in e if P(x["fiscal_date"]) <= d][-4:]
    ok = len(nxt) == 4 and len(prv) == 4
    if ok:
        seq = prv + nxt; gaps = [(P(seq[i + 1]["fiscal_date"]) - P(seq[i]["fiscal_date"])).days for i in range(7)]
        ok = min(gaps) >= 70 and max(gaps) <= 115 and (P(nxt[0]["fiscal_date"]) - d).days <= 115
    if not ok:
        return annual_blend(t, D, price) or {"why": "FMP's estimates have a hole here"}
    reported_ahead = sum(1 for x in nxt if reported_near(h, x["fiscal_date"]) is not None)
    restated = bool(t in OLD_BASIS and any(x["fiscal_date"] < OLD_BASIS[t][0] for x in seq))
    rough = all(abs(round(x["est_eps_avg"], 2) - x["est_eps_avg"]) < 1e-9 for x in seq) and max(abs(qeps(t, x)) for x in seq) < 0.3   # stored to the cent on a much smaller per-share number
    return finish(t, price, sum(qeps(t, x) for x in nxt), sum(qeps(t, x) for x in prv),
                  {"method": "quarters", "quarters_ahead": [x["fiscal_date"] for x in nxt], "reported_since": reported_ahead, "restated": restated, "rough": bool(rough)})
B = C["bottoms"]; OUT = {}
for t in B["names"]:
    OUT[t] = {}
    for D in B["dates"]:
        r = B["rows"][t][D]
        if r is None: OUT[t][D] = None; continue
        if t in ("SPY", "QQQ"): OUT[t][D] = {"why": "a fund: no estimate history"}; continue
        OUT[t][D] = cell(t, D, r["close"])
json.dump(OUT, open("gh1-fund.json", "w"), indent=1)
for t in B["names"]:
    if t in ("SPY", "QQQ"): continue
    print(t, " | ".join(f"{D[2:]}: " + ("—" if not c else (c.get("why") or f"{(c['pe_note'] if c['fwd_pe'] is None else str(c['fwd_pe'])+'x')} {(c['growth_note'] if c['growth'] is None else format(c['growth'],'+.0f')+'%')} [{c['method'][0]}{'R' if c.get('restated') else ''}{'~' if c.get('rough') else ''} ntm {c['ntm_eps']} prior {c['prior_eps']}]")) for D, c in OUT[t].items()))
