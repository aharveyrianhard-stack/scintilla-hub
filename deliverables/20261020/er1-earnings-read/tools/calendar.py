#!/usr/bin/env python3
"""ER1 · the next five trading days' reporters in the universe (plus tonight's after-close names), from the Hub's earnings_events
read on 20 Oct 2026 through the anon REST path, filtered to the Hub's tickers table. FMP's calendar carries unconfirmed duplicate rows
for the same ticker on different dates; the rule: drop names that already reported in the window; for a ticker with several rows keep
the one whose report time is confirmed (report_time_source set), else the earliest; print 'time unconfirmed' where report_time is null.
usage: python3 calendar.py <deliverable dir>"""
import json, os, sys, collections
D = sys.argv[1]
ev = json.load(open(os.path.join(D, "raw", "supabase", "earnings_events_window.json")))
uni = {t["ticker"] for t in json.load(open(os.path.join(D, "raw", "supabase", "tickers_universe.json")))}
reported = {r["ticker"] for r in json.load(open(os.path.join(D, "tools", "reporters.json")))}
DAYS = ["2026-10-21", "2026-10-22", "2026-10-23", "2026-10-26", "2026-10-27"]
rows = [e for e in ev if e["ticker"] in uni and e["ticker"] not in reported and "2026-10-20" <= e["date"] <= "2026-10-27"]
by = collections.defaultdict(list)
for e in rows: by[e["ticker"]].append(e)
out = []
for t, rs in by.items():
    conf = sorted([r for r in rs if r.get("report_time_source")], key=lambda r: r["date"])
    pick = conf[0] if conf else sorted(rs, key=lambda r: r["date"])[0]
    if pick["date"] == "2026-10-20" and pick.get("report_time") != "AMC": continue  # a BMO row for today that did not report = stale calendar row
    out.append({"ticker": t, "date": pick["date"], "report_time": pick.get("report_time"), "time_confirmed": bool(pick.get("report_time_source")),
                "eps_estimate": pick.get("eps_estimate"), "revenue_estimate": pick.get("revenue_estimate"),
                "other_rows_dropped": [{"date": r["date"], "report_time": r.get("report_time")} for r in rs if r is not pick]})
order = {"BMO": 0, None: 1, "AMC": 2}
out.sort(key=lambda r: (r["date"], order.get(r["report_time"], 1), r["ticker"]))
json.dump({"as_of": "2026-10-20", "days": ["2026-10-20 (tonight, after the close)"] + DAYS, "rows": out,
           "already_reported_excluded": sorted(reported & {e["ticker"] for e in ev if e["date"] > "2026-10-20"}),
           "off_universe_excluded": sorted({e["ticker"] for e in ev if e["ticker"] not in uni and e["date"] > "2026-10-20"})},
          open(os.path.join(D, "tools", "calendar.json"), "w"), indent=1)
for r in out: print(r["date"], (r["report_time"] or "time unconfirmed").ljust(16), r["ticker"].ljust(6), "est", r["eps_estimate"], "" if r["time_confirmed"] else "(unconfirmed)", ("dropped " + str(r["other_rows_dropped"])) if r["other_rows_dropped"] else "")
print(len(out), "rows")
