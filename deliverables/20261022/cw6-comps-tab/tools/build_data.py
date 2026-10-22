#!/usr/bin/env python3
"""CW6 · the COMPS tab's first source: the peer sets CW3, CW4 and CW5 reviewed, as data in the repository.

Reads the three branches' own files through git (nothing is copied by hand) and writes:
  sets.json   every name CW3 (RADAR, 19 Oct) or CW4 (Dow 30, 20 Oct) carried as a subject: its business line, its peers
              with the 4-8 word reason each, the dated read written by hand that night, Alan's 20 Oct notes on CW3,
              the foreign listings (currency, FX pair, name) and the balance-sheet businesses (CW4's bank/insurer rule).
  cycle.json  CW5's through-the-cycle facts for the seven memory makers: the ten-year monthly multiples (meaningful
              months only, sorted, so the tab can place today's multiple at today's price), the medians and the
              trailing figures at the latest quarter, and Micron's measured US-listing premium to SK hynix and Samsung.

Why the repository and not a table: the sets are reviewed artefacts that change only when a lane re-reviews them,
which is a commit anyway; in the repository they are versioned with the code that reads them, diffable, served with
the page, and need no migration, grant or write path. Alan's own on/off edits keep going to public.comps_decisions.

usage: python3 build_data.py <out dir>      (run from inside the scintilla-hub repository)
"""
import ast, json, subprocess, sys, datetime as dt

CW3 = ("hub/cw3-comps-done-20261019", "9325a33", "deliverables/20261019/cw3-comps")
CW4 = ("hub/cw4-dow30-comps-20261020", "17f996c", "deliverables/20261020/cw4-dow30")
CW5 = ("hub/cw5-memory-cycle-20261020", "2fcfb56", "deliverables/20261020/cw5-memory-cycle")

def show(commit, path):
    return subprocess.check_output(["git", "show", f"{commit}:{path}"]).decode("utf8")

def verdicts(commit, path):
    src = show(commit, path)
    node = ast.parse(src)
    for st in node.body:
        if isinstance(st, ast.Assign) and any(getattr(t, "id", None) == "VERDICTS" for t in st.targets):
            return ast.literal_eval(st.value)
    return {}

# Alan's critiques of CW3 in chat, 20 Oct 2026 (the brief's words; applied on the cards)
ALAN_20OCT = {
    "IREN": "cheap — agreed",
    "ORCL": "cheap — agreed",
    "NVDA": "cheap — agreed",
    "AVGO": "cheap — agreed",
    "VST":  "cheap — agreed; “semi-defensive … signing electricity deals for AI”",
    "SHOP": "“ran”",
    "BE":   "expensive “even considering growth rates — we have to consider price to sales”",
    "CAT":  "expensive — agreed",
    "NFLX": "expensive — agreed",
    "MU":   "does not like comping it only against SK hynix and Samsung at their multiples (“the only American one has value”) and wants the cyclicality in (“the multiples are ridiculously low right now”) — the through-the-cycle line below is CW5's answer",
}

def main():
    out = sys.argv[1]
    p3 = json.loads(show(CW3[1], CW3[2] + "/peers.json"))
    p4 = json.loads(show(CW4[1], CW4[2] + "/peers.json"))
    v3 = verdicts(CW3[1], CW3[2] + "/tools/verdicts.py")
    v4 = verdicts(CW4[1], CW4[2] + "/tools/verdicts.py")
    c5 = json.loads(show(CW5[1], CW5[2] + "/MEMORY-CYCLE.json"))
    names = {}
    for t in p3["radar"]:
        names[t] = {"set": "CW3", "set_date": "2026-10-19", "set_words": "the RADAR comps (CW3, 19 Oct)", "business": p3["business"][t],
                    "peers": [{"t": p["peer"], "why": p["why"]} for p in p3["peers"][t]], "financial": False,
                    "reads": [{"by": "CW3", "date": "2026-10-19", **v3[t]}] if t in v3 else []}
    for t in p4["dow"]:
        r4 = {"by": "CW4", "date": "2026-10-20", **v4[t]} if t in v4 else None
        if t in names:   # on both lists: CW3's set (the members are the same, checked) and both dated reads
            same = sorted(p["peer"] for p in p4["peers"][t]) == sorted(p["t"] for p in names[t]["peers"])
            names[t]["also"] = {"set": "CW4", "same_members": same}
            if r4: names[t]["reads"].append(r4)
            continue
        names[t] = {"set": "CW4", "set_date": "2026-10-20", "set_words": "the Dow 30 comps (CW4, 20 Oct)", "business": p4["business"][t],
                    "peers": [{"t": p["peer"], "why": p["why"]} for p in p4["peers"][t]], "financial": t in p4["financial"],
                    "reads": [r4] if r4 else []}
    for t, words in ALAN_20OCT.items():
        names[t]["alan"] = {"date": "2026-10-20", "words": words}
    for t in ("MU", "SNDK", "WDC"):
        names[t]["cycle"] = True
    foreign = {**p3["foreign"], **p4["foreign"]}
    allt = sorted(set(names) | {p["t"] for n in names.values() for p in n["peers"]} | set(c5["names"]))
    sets = {"what": "CW6 · the peer sets CW3 (RADAR, 19 Oct), CW4 (Dow 30, 20 Oct) and CW5 (memory, 20 Oct) reviewed, the COMPS tab's first source",
            "built_utc": dt.datetime.utcnow().strftime("%Y-%m-%dT%H:%MZ"),
            "sources": {"CW3": {"branch": CW3[0], "commit": CW3[1], "dir": CW3[2]}, "CW4": {"branch": CW4[0], "commit": CW4[1], "dir": CW4[2]}, "CW5": {"branch": CW5[0], "commit": CW5[1], "dir": CW5[2]}},
            "financial": sorted(set(p4["financial"])), "foreign": foreign, "names": names, "all": allt}
    json.dump(sets, open(out + "/sets.json", "w"), indent=1, ensure_ascii=False)

    # the cycle facts (CW5), in each name's own currency: multiples need no FX
    cyc = {"what": "CW5 · memory through the cycle, compacted for the COMPS tab: ten years of monthly multiples per name (meaningful months, sorted), the medians, and the trailing figures at the latest quarter",
           "fetched_utc": c5["fetch_utc_first"], "written_utc": c5["written_utc"], "source": {"branch": CW5[0], "commit": CW5[1], "file": CW5[2] + "/MEMORY-CYCLE.json"}, "names": {}}
    for t, n in c5["names"].items():
        td = n["today"]; P = n["percentiles"]
        dist = {}
        for k in ("pe", "ev_sales", "ev_ebitda", "pb"):
            vals = sorted(m[k] for m in n["monthly"] if m.get(k) is not None and not (k == "pe" and m.get("pe_nm")) and m[k] > 0)
            dist[k] = {"sorted": [round(v, 4) for v in vals], "median": P[k]["median"], "low": P[k]["low"], "high": P[k]["high"], "n": P[k]["n"], "n_months": P[k]["n_months"], "nm_months": P[k].get("nm_months"), "at_cw5": {"today": P[k]["today"], "percentile": P[k]["percentile"]}}
        mcap, ev = td["mcap"], td["ev"]
        E = n["earnings"]
        cyc["names"][t] = {"name": n["name"], "company": n["company"], "currency": n["currency"], "months": len(n["monthly"]), "first_month": n["monthly"][0].get("date") if n["monthly"] else None,
                           "latest_quarter": n["latest_quarter"], "price_at_cw5": td["price"], "date_at_cw5": td["date"],
                           "ttm": {"eps": td["eps_ttm"], "shares": mcap / td["price"] if td["price"] else None, "net_debt": ev - mcap,
                                   "revenue": ev / td["ev_sales"] if td.get("ev_sales") else None, "ebitda": ev / td["ev_ebitda"] if td.get("ev_ebitda") else None,
                                   "equity": mcap / td["pb"] if td.get("pb") else None, "gm": td.get("gm_ttm")},
                           "dist": dist,
                           "pe_fwd_vs_realised": P.get("pe_fwd_vs_realised"),
                           "facts": {k: E.get(k) for k in ("eps_ttm_high", "eps_ttm_low", "eps_prior_cycle_high", "gm_high", "gm_prior_cycle_high", "eps_at_prior_peak_gm", "pe_at_prior_peak_gm", "eps_implied_at_median_pe", "implied_vs_ntm_eps_pct", "implied_vs_ttm_eps_pct", "ntm_eps_vs_ttm", "latest_quarter_eps")},
                           "ntm_at_cw5": {k: n["ntm"].get(k) for k in ("basis", "fy1", "fy2", "eps", "net_income")}}
    prem = {}
    for k, v in c5["micron_cycle"]["premium_to"].items():
        prem[k] = {m: {"median": s["median"], "today_at_cw5": s["today"], "percentile_at_cw5": s["percentile"], "n": s["n"]} for m, s in v["summary"].items() if isinstance(s, dict)}
        prem[k]["pe_fwd_today_at_cw5"] = v["summary"].get("pe_fwd_today")
    cyc["micron_premium"] = prem
    cyc["sector_at_cw5"] = c5["sector"]["medians"]
    json.dump(cyc, open(out + "/cycle.json", "w"), indent=1, ensure_ascii=False)
    print(len(names), "names on curated sets ·", len(allt), "tickers to fill ·", len(cyc["names"]), "cycle names")

if __name__ == "__main__":
    main()
