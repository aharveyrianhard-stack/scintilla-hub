#!/usr/bin/env python3
"""ER1 · the stock's reaction day and since. Daily candles from the house chart API (completed sessions only, newest 19 Oct 2026),
today's price from FMP quote through the fmp-proxy door (fetched 20 Oct 2026 ~16:33 UTC). BMO reporter: reaction day = report date;
AMC reporter: next session. Reaction = close(reaction day) / close(prior session) - 1. Since = latest price / close(reaction day) - 1.
For 20 Oct BMO reporters the reaction day is today and is read from the FMP quote (intraday, not a close). SPY on the same days.
usage: python3 reactions.py <deliverable dir>"""
import json, os, sys, datetime as dt
D = sys.argv[1]
def candles(t):
    d = json.load(open(os.path.join(D, "raw", "candles", t + ".json")))
    out = {}
    for c in d["series"]:
        day = dt.datetime.fromtimestamp(c["t"] / 1000, dt.timezone.utc).date().isoformat()
        out[day] = c
    return out
def quote(t):
    body = open(os.path.join(D, "raw", "fmp", "quote_%s.json" % t)).read().rsplit("\n", 1)[0]
    q = json.loads(body)[0]
    return q
def sessions(c): return sorted(c.keys())
def reaction(t, report_date, report_time):
    c = candles(t); q = quote(t); days = sessions(c)
    rd = report_date
    if report_time == "AMC":
        after = [d for d in days if d > report_date]
        rd = after[0] if after else "2026-10-20"
    res = {"reaction_day": rd, "basis": None}
    if rd in c:
        prior = [d for d in days if d < rd][-1]
        res["prior_close"] = c[prior]["c"]; res["reaction_close"] = c[rd]["c"]; res["reaction_open"] = c[rd]["o"]
        res["reaction_pct"] = (c[rd]["c"] / c[prior]["c"] - 1) * 100
        res["gap_open_pct"] = (c[rd]["o"] / c[prior]["c"] - 1) * 100
        res["basis"] = "close vs prior close (house chart API)"
        res["latest_price"] = q["price"]; res["latest_utc"] = dt.datetime.fromtimestamp(q["timestamp"], dt.timezone.utc).isoformat()
        res["since_pct"] = (q["price"] / c[rd]["c"] - 1) * 100
        res["total_pct"] = (q["price"] / c[prior]["c"] - 1) * 100
    elif rd == "2026-10-20":
        res["prior_close"] = q["previousClose"]; res["reaction_close"] = None; res["reaction_open"] = q["open"]
        res["reaction_pct"] = q["changePercentage"]; res["gap_open_pct"] = (q["open"] / q["previousClose"] - 1) * 100
        res["basis"] = "intraday FMP quote vs previous close (today, not a close)"
        res["latest_price"] = q["price"]; res["latest_utc"] = dt.datetime.fromtimestamp(q["timestamp"], dt.timezone.utc).isoformat()
        res["since_pct"] = 0.0; res["total_pct"] = q["changePercentage"]
    return res
if __name__ == "__main__":
    reporters = json.load(open(os.path.join(D, "tools", "reporters.json")))
    spy = {}
    out = {}
    for r in reporters:
        out[r["ticker"]] = reaction(r["ticker"], r["report_date"], r["report_time"])
        rd = out[r["ticker"]]["reaction_day"]
        if rd not in spy:
            s = reaction("SPY", rd, "BMO"); spy[rd] = {"reaction_pct": s.get("reaction_pct"), "since_pct": s.get("since_pct"), "total_pct": s.get("total_pct")}
        out[r["ticker"]]["spy_same_days"] = spy[rd]
        out[r["ticker"]]["relative_reaction_pct"] = out[r["ticker"]].get("reaction_pct", 0) - (spy[rd]["reaction_pct"] or 0)
    json.dump(out, open(os.path.join(D, "tools", "reactions.json"), "w"), indent=1)
    for t, v in out.items():
        print("%-5s %s  react %+6.2f%%  (SPY %+5.2f%%)  since %+6.2f%%  total %+6.2f%%  %s" % (t, v["reaction_day"], v.get("reaction_pct") or 0, v["spy_same_days"]["reaction_pct"] or 0, v.get("since_pct") or 0, v.get("total_pct") or 0, v["basis"]))
