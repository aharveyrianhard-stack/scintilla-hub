#!/usr/bin/env python3
"""LD1 · assemble the study from the saved pieces into study.json (every figure and every count on the page).

Reads (all local files):
  ../selection.json        the ranking and the two groups            (tools/select.py)
  ../comps-sets.json       each name's 12 comparables                (tools/comps-sets.mjs, C5's rule)
  ../data/research.json    public-web figures per studied name, first record + checked record   (tools/collect.py)
  ../data/peers.json       forward P/E and EV/sales for the comps that are not studied
  ../hub-saved-figures.json  the Hub comps tab's own figures saved on 3 and 5 Oct (cross-check only)
  CO1's closes and company profiles (deliverables/20261006/cohort-proposal/data)
Nothing is fetched and nothing is written outside this folder.
"""
import csv, json, math, os, statistics

HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.abspath(os.path.join(HERE, ".."))
ROOT = os.path.abspath(os.path.join(HERE, "../../../.."))
J = lambda *a: json.load(open(os.path.join(D, *a)))
sel, cs = J("selection.json"), J("comps-sets.json")
RES = {r["ticker"]: r for r in J("data", "research.json")}
PEERS = {p["ticker"].upper(): p for p in J("data", "peers.json")}
HUB = J("hub-saved-figures.json")
A = {n["ticker"]: n for n in sel["all"]}
PROF = {r["ticker"]: r for r in json.load(open(os.path.join(ROOT, "deliverables/20261006/cohort-proposal/data/company_profile-20261006.json")))}

rows = list(csv.reader(open(os.path.join(ROOT, "deliverables/20261006/cohort-proposal/data/closes-6m-20261006.csv"))))
hdr, body = rows[0], rows[1:]; dates = [r[0] for r in body]
i_run, i_sell = dates.index(sel["run_start"]), dates.index(sel["selloff_start"])
def series(t):
    if t not in hdr: return None
    i = hdr.index(t); out = []
    for r in body:
        try: out.append(float(r[i]))
        except Exception: out.append(None)
    return out
def px(t):
    s = series(t)
    if not s or s[-1] is None: return None
    g = lambda a, b: None if (a in (None, 0) or b is None) else b / a - 1
    return {"r3m": g(s[-64], s[-1]), "r1m": g(s[-22], s[-1]), "r_run": g(s[i_run], s[-1]), "r_selloff": g(s[i_sell], s[i_run])}
med = lambda xs: (lambda v: statistics.median(v) if v else None)([x for x in xs if x is not None])
num = lambda v: v if isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) else None

# ---- the record the study uses for each name: the checked one when the checker ran, else the first
GROUP = {t: g for g, l in cs["groups"].items() for t in l}
names = {}
for T, g in GROUP.items():
    r = RES.get(T) or {}
    f = r.get("verify") or r.get("research")
    a = A[T]
    n = {"ticker": T, "name": a["name"], "group": g, "rank": a["rank"], "cohort": a["cohort_labels"][0], "cohorts": a["cohort_labels"],
         "r3m": a["r3m"], "r1m": a["r1m"], "r_run": a["r_run"], "r_selloff": a["r_selloff"], "worst_in_selloff": a["worst_in_selloff"], "vs_selloff_start": a["vs_selloff_start"],
         "geiger": a["geiger"], "close_last": a["close_last"], "close_run_start": a["close_run_start"], "close_selloff_start": a["close_selloff_start"],
         "cap_profile_b": None if not a["market_cap_profile"] else a["market_cap_profile"] / 1e9,
         "has_record": bool(f), "checked": bool(r.get("verify")), "changes": (r.get("verify") or {}).get("changes") or [], "unconfirmed": (r.get("verify") or {}).get("unconfirmed") or []}
    for k in ("as_of", "price", "market_cap_usd_b", "enterprise_value_usd_b", "revenue_ttm_usd_b", "rev_growth_ttm_pct", "rev_growth_latest_q_yoy_pct", "rev_growth_this_fy_pct",
              "rev_growth_next_fy_pct", "rev_growth_basis", "eps_ttm_positive", "eps_growth_this_fy_pct", "eps_growth_next_fy_pct", "eps_rev_90d_direction", "eps_rev_90d_pct",
              "eps_rev_basis", "rev_est_rev_90d_direction", "guidance_direction", "last_earnings_date", "last_earnings_summary", "gross_margin_pct", "gross_margin_year_ago_pct",
              "operating_margin_pct", "operating_margin_year_ago_pct", "margin_basis", "fcf_ttm_usd_b", "fcf_margin_pct", "net_cash_usd_b", "shares_change_yoy_pct", "forward_pe",
              "ev_sales", "customer_concentration", "top_customer_pct", "concentration_level", "insider_lockup_events", "supply_overhang", "raised_capital_90d", "buyback_active",
              "one_line_story", "sources", "confidence", "gaps"):
        n[k] = (f or {}).get(k)
    # a public price far from our own close means the page was misread or is another share class: do not trust its market value or multiples
    p = num(n["price"]); n["price_ok"] = bool(p and 0.75 <= p / a["close_last"] <= 1.33)
    if p and not n["price_ok"]: n["market_cap_usd_b"] = None
    fp = num(n["forward_pe"]); n["forward_pe"] = fp if (fp is not None and 0 < fp < 2000) else None
    es = num(n["ev_sales"]); n["ev_sales"] = es if (es is not None and es > 0) else None
    names[T] = n

# ---- the three judgement calls are read twice: once by the researcher + checker (who knew the group), once blind (ticker only).
#      Two readings that agree stand. One reading alone stands and is marked. Two that disagree are thrown out (no reading).
BLIND = {b["ticker"].upper(): b for b in (json.load(open(os.path.join(D, "data", "blind.json"))) if os.path.exists(os.path.join(D, "data", "blind.json")) else [])}
RECON = [("eps_rev_90d_direction", "eps_direction"), ("rev_est_rev_90d_direction", "rev_direction"), ("guidance_direction", "guidance_direction")]
known = lambda v: None if v in (None, "unknown") else v
for T, n in names.items():
    b = BLIND.get(T) or {}
    n["blind"] = {k: b.get(k) for k in ("eps_direction", "eps_evidence_type", "eps_evidence", "eps_now", "eps_90d_ago", "rev_direction", "rev_evidence_type", "rev_evidence", "guidance_direction", "guidance_evidence", "fiscal_year")} if b else None
    n["first_read"] = {}
    for k, bk in RECON:
        a, c = known(n.get(k)), known(b.get(bk))
        n["first_read"][k] = n.get(k)
        if a and c: n[k], st = (a, "two readings agree") if a == c else (None, f"two readings disagree ({a} / blind {c}): left out")
        elif a: st = "one reading (the blind read found nothing)" if b else "one reading (no blind read)"
        elif c: n[k], st = c, "one reading (blind only)"
        else: n[k], st = None, "no reading"
        n[k + "_status"] = st

# ---- multiples for every comparable (studied names from their own record, the rest from the peers pass)
pool = {}
for T, n in names.items(): pool[T] = {"forward_pe": n["forward_pe"], "ev_sales": n["ev_sales"], "from": "studied"}
for T, p in PEERS.items():
    if T in pool: continue
    fp, es = num(p.get("forward_pe")), num(p.get("ev_sales"))
    pool[T] = {"forward_pe": fp if (fp is not None and 0 < fp < 2000) else None, "ev_sales": es if (es is not None and es > 0) else None, "from": "peers"}
MIN_PEERS = 4
comps = {}
for T, s in cs["sets"].items():
    ps = [p["ticker"] for p in s["peers"]]
    pe = [pool.get(t, {}).get("forward_pe") for t in ps]; ev = [pool.get(t, {}).get("ev_sales") for t in ps]
    pxs = [px(t) for t in ps]
    npe, nev = sum(v is not None for v in pe), sum(v is not None for v in ev)
    c = {"peers": ps, "own_lines": s["own_lines"], "n_peers": len(ps),
         "pe_median": med(pe) if npe >= MIN_PEERS else None, "pe_n": npe, "evs_median": med(ev) if nev >= MIN_PEERS else None, "evs_n": nev,
         "peers_r3m_median": med([x and x["r3m"] for x in pxs]), "peers_r1m_median": med([x and x["r1m"] for x in pxs]), "peers_run_median": med([x and x["r_run"] for x in pxs]),
         "peers_selloff_median": med([x and x["r_selloff"] for x in pxs]),
         "peers_leaders": [t for t in ps if GROUP.get(t) == "leader"], "peers_laggards": [t for t in ps if GROUP.get(t) == "laggard"]}
    n = names[T]
    c["pe_vs_comps"] = None if (n["forward_pe"] is None or not c["pe_median"]) else n["forward_pe"] / c["pe_median"] - 1
    c["evs_vs_comps"] = None if (n["ev_sales"] is None or not c["evs_median"]) else n["ev_sales"] / c["evs_median"] - 1
    comps[T] = c; n["comps"] = c

# ---- market value then -> now. now = the public page's value at its own price (6 Oct close) when that price agrees with our close;
#      else the Hub profile's value. then = now x (close then / price now): the share count is held constant, so a name that sold new shares in between reads too high at the start.
for T, n in names.items():
    if n["price_ok"] and num(n["market_cap_usd_b"]):
        now, pnow, src = n["market_cap_usd_b"], n["price"], "public page, its own price (as of %s)" % (n["as_of"] or "6 Oct")
    else:
        now, pnow, src = n["cap_profile_b"], n["close_last"], "Hub company profile read 6 Oct, 5 Oct close"
    n["cap_now_b"], n["cap_now_from"] = now, src
    n["cap_run_start_b"] = None if not now else now * n["close_run_start"] / pnow
    n["cap_selloff_start_b"] = None if (not now or not n["close_selloff_start"]) else now * n["close_selloff_start"] / pnow
    n["cap_added_in_run_b"] = None if not now else now - n["cap_run_start_b"]

# ---- the counted conditions. Each returns True / False, or None when there is no reading (then the name is left out of that count).
def has(n, k): return n.get(k) is not None
def direction(k, want):
    return lambda n: None if n.get(k) in (None, "unknown") else n[k] == want
def cmp_(k, op, v):
    return lambda n: None if num(n.get(k)) is None else (n[k] >= v if op == ">=" else n[k] > v if op == ">" else n[k] < v if op == "<" else n[k] <= v)
def flag(k):
    return lambda n: None if n.get(k) is None else bool(n[k])
def up_vs(a, b):
    return lambda n: None if (num(n.get(a)) is None or num(n.get(b)) is None) else n[a] > n[b]
CONDITIONS = [
 ("growth", "rev_next_15", "sales expected to grow 15% or more next fiscal year", cmp_("rev_growth_next_fy_pct", ">=", 15)),
 ("growth", "rev_q_20", "sales grew 20% or more in the latest quarter (year on year)", cmp_("rev_growth_latest_q_yoy_pct", ">=", 20)),
 ("growth", "eps_next_15", "earnings per share expected to grow 15% or more next fiscal year", cmp_("eps_growth_next_fy_pct", ">=", 15)),
 ("revisions", "eps_rev_up", "analysts RAISED the earnings estimate over the last 90 days", direction("eps_rev_90d_direction", "up")),
 ("revisions", "eps_rev_down", "analysts CUT the earnings estimate over the last 90 days", direction("eps_rev_90d_direction", "down")),
 ("revisions", "rev_rev_up", "analysts RAISED the sales estimate over the last 90 days", direction("rev_est_rev_90d_direction", "up")),
 ("revisions", "rev_rev_down", "analysts CUT the sales estimate over the last 90 days", direction("rev_est_rev_90d_direction", "down")),
 ("revisions", "guide_raised", "management RAISED its own guidance at the last report", direction("guidance_direction", "raised")),
 ("revisions", "guide_lowered", "management LOWERED its own guidance at the last report", direction("guidance_direction", "lowered")),
 ("pays its own way", "eps_pos", "earns a profit (earnings per share above zero over twelve months)", flag("eps_ttm_positive")),
 ("pays its own way", "fcf_pos", "brings in more cash than it spends (free cash flow above zero)", cmp_("fcf_ttm_usd_b", ">", 0)),
 ("pays its own way", "net_cash", "holds more cash than debt", cmp_("net_cash_usd_b", ">", 0)),
 ("pays its own way", "om_15", "keeps 15 cents or more of each sales dollar as operating profit", cmp_("operating_margin_pct", ">=", 15)),
 ("pays its own way", "om_up", "operating margin is higher than a year ago", up_vs("operating_margin_pct", "operating_margin_year_ago_pct")),
 ("pays its own way", "gm_up", "gross margin is higher than a year ago", up_vs("gross_margin_pct", "gross_margin_year_ago_pct")),
 ("new shares", "diluting", "share count is up more than 3% in a year", cmp_("shares_change_yoy_pct", ">", 3)),
 ("new shares", "shrinking", "share count is DOWN on a year ago (buybacks)", cmp_("shares_change_yoy_pct", "<", 0)),
 ("new shares", "raised_capital", "raised money (shares, convertibles or sizeable debt) since 1 July", flag("raised_capital_90d")),
 ("new shares", "overhang", "new shares hit or are about to hit the market (lock-up, share sale, convertible, heavy insider selling)", flag("supply_overhang")),
 ("new shares", "buyback", "is buying back its own stock", flag("buyback_active")),
 ("customers", "conc_high", "leans on a few customers (one at 20%+ of sales, or the top three at 50%+)", lambda n: None if n.get("concentration_level") in (None, "unknown") else n["concentration_level"] == "high"),
 ("price", "has_fwd_pe", "has forward earnings to be priced on (a forward P/E exists)", lambda n: None if not n["has_record"] else n["forward_pe"] is not None),
 ("price", "pe_premium", "forward P/E is ABOVE its comps' median", lambda n: None if n["comps"]["pe_vs_comps"] is None else n["comps"]["pe_vs_comps"] > 0),
 ("price", "evs_premium", "EV/sales is ABOVE its comps' median", lambda n: None if n["comps"]["evs_vs_comps"] is None else n["comps"]["evs_vs_comps"] > 0),
 ("size and path", "cap_25", "worth $25 billion or more", lambda n: None if not n["cap_now_b"] else n["cap_now_b"] >= 25),
 ("size and path", "rose_in_fall", "ROSE between 30 June and 15 September while the chip fund fell 17%", cmp_("r_selloff", ">", 0)),
 ("size and path", "fell_30", "was down 30% or more at its worst between 30 June and 15 September", cmp_("worst_in_selloff", "<=", -0.30)),
 ("size and path", "comps_up_1m", "its comps' median is also up over the last month", lambda n: None if n["comps"]["peers_r1m_median"] is None else n["comps"]["peers_r1m_median"] > 0),
]
def fisher(a, b, c, d):
    """two-sided Fisher exact p for the table [[a, b], [c, d]]"""
    n = a + b + c + d; r1, c1 = a + b, a + c
    def p(x): return math.comb(c1, x) * math.comb(n - c1, r1 - x) / math.comb(n, r1)
    p0 = p(a); lo, hi = max(0, r1 - (n - c1)), min(r1, c1)
    return min(1.0, sum(p(x) for x in range(lo, hi + 1) if p(x) <= p0 * (1 + 1e-9)))
L = [names[t] for t in cs["groups"]["leader"]]; G = [names[t] for t in cs["groups"]["laggard"]]; M = [names[t] for t in cs["groups"]["named_mid"]]
conditions = []
for fam, cid, words, fn in CONDITIONS:
    def count(grp):
        v = [(n["ticker"], fn(n)) for n in grp]
        return {"yes": [t for t, x in v if x is True], "no": [t for t, x in v if x is False], "no_reading": [t for t, x in v if x is None]}
    l, g = count(L), count(G)
    ly, ln, gy, gn = len(l["yes"]), len(l["yes"]) + len(l["no"]), len(g["yes"]), len(g["yes"]) + len(g["no"])
    sl, sg = (ly / ln if ln else None), (gy / gn if gn else None)
    pv = fisher(ly, ln - ly, gy, gn - gy) if (ln and gn) else None
    strict = None
    key = {"eps_rev_up": "eps_rev_90d_direction", "eps_rev_down": "eps_rev_90d_direction", "rev_rev_up": "rev_est_rev_90d_direction", "rev_rev_down": "rev_est_rev_90d_direction", "guide_raised": "guidance_direction", "guide_lowered": "guidance_direction"}.get(cid)
    if key:   # the same count using only names where the two readings agree
        both = lambda grp: [n for n in grp if n.get(key + "_status") == "two readings agree"]
        sl_, sg_ = [fn(n) for n in both(L)], [fn(n) for n in both(G)]
        strict = {"leaders_yes": sum(1 for x in sl_ if x is True), "leaders_n": sum(1 for x in sl_ if x is not None), "laggards_yes": sum(1 for x in sg_ if x is True), "laggards_n": sum(1 for x in sg_ if x is not None)}
    conditions.append({"strict": strict, "family": fam, "id": cid, "words": words, "leaders_yes": ly, "leaders_n": ln, "laggards_yes": gy, "laggards_n": gn,
                       "leaders_share": sl, "laggards_share": sg, "gap_points": None if (sl is None or sg is None) else round((sl - sg) * 100, 1),
                       "p": pv, "strength": None if pv is None else ("clear" if pv < 0.05 else "leans" if pv < 0.20 else "no real difference"),
                       "leaders": l, "laggards": g, "named_mid": {n["ticker"]: fn(n) for n in M}})
conditions_sorted = sorted([c for c in conditions if c["gap_points"] is not None], key=lambda c: -abs(c["gap_points"]))

# ---- what kind of three months each name had (prices only, every name in the field)
def kind(n):
    s, r, m = n["r_selloff"], n["r_run"], n["r1m"]
    if s is None or r is None: return "too new"
    if s >= 0 and r >= 0: return "never fell: rose through the summer fall and kept rising"
    if s <= -0.10 and r >= 0.15: return "fell hard, then bounced hard"
    if s <= -0.10 and r < 0.05: return "fell hard and did not bounce"
    if s > -0.10 and m is not None and m <= -0.05: return "held up in the fall, then rolled over in the last month"
    return "in between"
KINDS = ["never fell: rose through the summer fall and kept rising", "fell hard, then bounced hard", "fell hard and did not bounce", "held up in the fall, then rolled over in the last month", "in between", "too new"]
for n in sel["all"]: n["kind"] = kind(n)
for T in names: names[T]["kind"] = kind(names[T])
kinds = [{"kind": k, "field": sum(1 for n in sel["all"] if n["kind"] == k),
          "leaders": [n["ticker"] for n in sel["all"] if n["kind"] == k and GROUP.get(n["ticker"]) == "leader"],
          "laggards": [n["ticker"] for n in sel["all"] if n["kind"] == k and GROUP.get(n["ticker"]) == "laggard"]} for k in KINDS]

# ---- the sharpest cut for "why did THESE bounce": both sets fell hard in the summer; one set bounced, the other did not
def count_two(g1, g2):
    out = []
    for fam, cid, words, fn in CONDITIONS:
        if cid in ("rose_in_fall", "fell_30"): continue   # both sets are defined by having fallen
        a, b = [(n["ticker"], fn(n)) for n in g1], [(n["ticker"], fn(n)) for n in g2]
        ay, an, by, bn = sum(x is True for _, x in a), sum(x is not None for _, x in a), sum(x is True for _, x in b), sum(x is not None for _, x in b)
        if not an or not bn: continue
        pv = fisher(ay, an - ay, by, bn - by)
        out.append({"family": fam, "id": cid, "words": words, "a_yes": ay, "a_n": an, "b_yes": by, "b_n": bn, "gap_points": round((ay / an - by / bn) * 100, 1), "p": pv,
                    "strength": "clear" if pv < 0.05 else "leans" if pv < 0.20 else "no real difference", "a_names": [t for t, x in a if x is True], "b_names": [t for t, x in b if x is True]})
    return sorted(out, key=lambda c: -abs(c["gap_points"]))
BOUNCED = [n for n in L if n["kind"] == "fell hard, then bounced hard"]
STAYED = [n for n in G if n["kind"] == "fell hard and did not bounce"]
NEVER = [n for n in L if n["kind"].startswith("never fell")]
bounce_cut = {"bounced": [n["ticker"] for n in BOUNCED], "stayed_down": [n["ticker"] for n in STAYED], "never_fell": [n["ticker"] for n in NEVER],
              "conditions": count_two(BOUNCED, STAYED), "never_fell_vs_laggards": count_two(NEVER, G)}

# ---- market values: the leaders, the laggards, and every cohort in the field (profile value x price ratio)
def tot(grp, k): return sum(n[k] for n in grp if n[k]) if grp else None
caps = {"leaders": {"selloff_start_b": tot(L, "cap_selloff_start_b"), "run_start_b": tot(L, "cap_run_start_b"), "now_b": tot(L, "cap_now_b")},
        "laggards": {"selloff_start_b": tot(G, "cap_selloff_start_b"), "run_start_b": tot(G, "cap_run_start_b"), "now_b": tot(G, "cap_now_b")}}
field_caps = []
for n in sel["all"]:
    c = (n["market_cap_profile"] or 0) / 1e9
    field_caps.append({"ticker": n["ticker"], "cohorts": n["cohorts"], "now": c, "run_start": c * n["close_run_start"] / n["close_last"] if n["close_run_start"] else None,
                       "selloff_start": c * n["close_selloff_start"] / n["close_last"] if n["close_selloff_start"] else None})
cohort_caps = []
for c in sel["by_cohort"]:
    ms = [f for f in field_caps if c["cohort"] in f["cohorts"]]
    s = lambda k: sum(f[k] for f in ms if f[k])
    cohort_caps.append({"cohort": c["cohort"], "label": c["label"], "n": len(ms), "selloff_start_b": s("selloff_start"), "run_start_b": s("run_start"), "now_b": s("now"),
                        "run_pct": s("now") / s("run_start") - 1 if s("run_start") else None, "median_r1m": c["median_r1m"], "median_r3m": c["median_r3m"], "median_r_run": c["median_r_run"],
                        "median_geiger": c["median_geiger"], "leaders": c["leaders"], "laggards": [t for t in cs["groups"]["laggard"] if c["cohort"] in A[t]["cohorts"]]})
seen = set(); field_now = field_run = field_sell = 0.0
for f in field_caps:
    if f["ticker"] in seen: continue
    seen.add(f["ticker"]); field_now += f["now"] or 0; field_run += f["run_start"] or 0; field_sell += f["selloff_start"] or 0
caps["field"] = {"n": len(seen), "selloff_start_b": field_sell, "run_start_b": field_run, "now_b": field_now}

# ---- same cohort, different outcome
pairs = []
for c in sel["by_cohort"]:
    ls = [t for t in cs["groups"]["leader"] if c["cohort"] in A[t]["cohorts"]]
    gs = [t for t in cs["groups"]["laggard"] + cs["groups"]["named_mid"] if c["cohort"] in A[t]["cohorts"]]
    if ls and gs: pairs.append({"cohort": c["label"], "leaders": ls, "others": gs})

# ---- how good is the data
def close(a, b, tol=0.25): return None if (num(a) is None or num(b) is None or b == 0) else abs(a / b - 1) <= tol
xc = []
for T, n in names.items():
    h = HUB.get(T)
    if not h: continue
    xc.append({"ticker": T, "hub_asof": h["asof"], "pe": [h.get("pe_fwd"), n["forward_pe"], close(n["forward_pe"], h.get("pe_fwd"))], "ev_sales": [h.get("ev_sales"), n["ev_sales"], close(n["ev_sales"], h.get("ev_sales"))],
               "rev_next": [h.get("rev_g_fy"), n["rev_growth_next_fy_pct"], None if (num(h.get("rev_g_fy")) is None or num(n["rev_growth_next_fy_pct"]) is None) else abs(h["rev_g_fy"] - n["rev_growth_next_fy_pct"]) <= 8]})
agree = lambda k: [sum(1 for x in xc if x[k][2] is True), sum(1 for x in xc if x[k][2] is not None)]
quality = {"studied": len(names), "with_record": sum(n["has_record"] for n in names.values()), "checked": sum(n["checked"] for n in names.values()),
           "names_changed_by_checker": sum(1 for n in names.values() if n["changes"]), "changes_total": sum(len(n["changes"]) for n in names.values()),
           "price_mismatch": [T for T, n in names.items() if n["has_record"] and not n["price_ok"]],
           "eps_revision_unknown": [T for T, n in names.items() if n["eps_rev_90d_direction"] in (None, "unknown")],
           "blind_read": len(BLIND),
           "two_readings": {k: {"agree": sum(1 for n in names.values() if n[k + "_status"] == "two readings agree"), "disagree": [T for T, n in names.items() if n[k + "_status"].startswith("two readings disagree")],
                                "one_only": sum(1 for n in names.values() if n[k + "_status"].startswith("one reading")), "none": sum(1 for n in names.values() if n[k + "_status"] == "no reading")} for k, _ in RECON},
           "peers_wanted": len(cs["peer_only"]), "peers_read": sum(1 for t in cs["peer_only"] if t in PEERS), "peers_with_pe": sum(1 for t in cs["peer_only"] if pool.get(t, {}).get("forward_pe")),
           "peers_with_evs": sum(1 for t in cs["peer_only"] if pool.get(t, {}).get("ev_sales")),
           "hub_crosscheck": {"names": len(xc), "forward_pe_within_25pct": agree("pe"), "ev_sales_within_25pct": agree("ev_sales"), "next_year_sales_growth_within_8pts": agree("rev_next"), "rows": xc},
           "comps_rule_vs_live_5oct": cs["check_against_live_5oct"]}

out = {"what": "LD1 · why the leaders held up and bounced, and why others did not", "closes_through": sel["closes_through"], "geiger_published_utc": sel["geiger_published_utc"],
       "run_start": sel["run_start"], "selloff_start": sel["selloff_start"], "field": sel["field"], "rule": sel["rule"], "benchmarks": sel["benchmarks"], "named_in_brief": sel["named_in_brief"],
       "groups": cs["groups"], "names": names, "conditions": conditions, "conditions_sorted_ids": [c["id"] for c in conditions_sorted], "kinds": kinds, "bounce_cut": bounce_cut, "caps": caps,
       "cohort_caps": cohort_caps, "pairs": pairs, "quality": quality,
       "field_points": [{"t": n["ticker"], "g": GROUP.get(n["ticker"], "field"), "s": n["r_selloff"], "r": n["r_run"], "c": n["cohort_labels"][0]} for n in sel["all"]]}
json.dump(out, open(os.path.join(D, "study.json"), "w"), indent=1)

pc = lambda v: "  n/a" if v is None else f"{v*100:5.0f}%"
print(f"records {quality['with_record']}/{quality['studied']} · checked {quality['checked']} · checker changed {quality['names_changed_by_checker']} names ({quality['changes_total']} changes) · price mismatch {quality['price_mismatch']}")
print(f"peers read {quality['peers_read']}/{quality['peers_wanted']} · with P/E {quality['peers_with_pe']} · with EV/S {quality['peers_with_evs']} · EPS revision unknown: {' '.join(quality['eps_revision_unknown']) or '-'}")
for k, v in quality["two_readings"].items(): print(f" two readings · {k}: agree {v['agree']} · disagree {len(v['disagree'])} {v['disagree']} · one only {v['one_only']} · none {v['none']}")
print("hub cross-check", {k: v for k, v in quality["hub_crosscheck"].items() if k != "rows"})
print("WHAT SEPARATES THEM (leaders vs laggards)")
for c in conditions_sorted:
    st = c["strict"]; extra = f"  [both readings agree: L {st['leaders_yes']}/{st['leaders_n']} G {st['laggards_yes']}/{st['laggards_n']}]" if st else ""
    print(f" {c['gap_points']:+6.1f} pts  L {c['leaders_yes']:2d}/{c['leaders_n']:2d}  G {c['laggards_yes']:2d}/{c['laggards_n']:2d}  p={c['p']:.3f} {c['strength']:<18s} {c['words']}{extra}")
for k in kinds: print(f" kind: {k['kind'][:58]:58s} field {k['field']:3d} · leaders {len(k['leaders']):2d} · laggards {len(k['laggards']):2d}")
print(f"THE BOUNCE CUT: fell-then-bounced leaders {bounce_cut['bounced']} vs fell-and-stayed-down laggards {bounce_cut['stayed_down']}")
for c in bounce_cut["conditions"][:14]: print(f" {c['gap_points']:+6.1f} pts  bounced {c['a_yes']:2d}/{c['a_n']:2d}  stayed down {c['b_yes']:2d}/{c['b_n']:2d}  p={c['p']:.3f} {c['strength']:<18s} {c['words']}")
print("caps $B:", {g: {k: round(v) for k, v in d.items() if v} for g, d in caps.items()})
