#!/usr/bin/env python3
"""H8 (2 Oct) — counts what the STATS tab printed in a probe run: every "—" and every "not stored", by block and row,
with the reason the store gives (the column is empty on the row · the row is missing from its table · the field was
never stored — no column for it). python3 h8-count.py probe-before.json [probe-after.json]"""
import json, sys, collections
DASH = "—"
# which stored thing each always-drawn row depends on: (table-row flag, column flag) from the probe's `have`
DEPENDS = {
    "last": ("price", None), "today": ("price", None),
    "market cap": ("profile", "market_cap"), "revenue TTM": ("fundamentals", "revenue_ttm"), "shares out": ("profile", "shares_out"),
    "float": ("profile", "float_shares"), "short interest": ("profile", "short_interest"),
    "trailing P/E": ("fundamentals", "eps_ttm"), "forward P/E": ("estimates", None), "earnings yield": ("fundamentals", "eps_ttm"), "EPS (ttm)": ("fundamentals", "eps_ttm"),
    "PT · avg": ("pt", None), "avg volume": ("profile", "avg_volume"),
    "dividend": ("profile", "dividend_per_share"), "div. yield": ("profile", "dividend_per_share"),
    "fund assets (AUM)": ("etf_row", "etf_aum"), "NAV": ("etf_row", None), "holdings": ("etf_row", "etf_holdings"), "expense ratio": ("etf_row", "etf_expense"), "inception": ("etf_row", "etf_inception"),
}
NEVER = {"float", "short interest", "dividend", "div. yield"}   # before H8 these had no column at all
def reason(label, have, after):
    dep = DEPENDS.get(label)
    if label in NEVER and not after: return "never stored (no column)"
    if label == "short interest": return "not carried by FMP (no source)"
    if not dep: return "row drawn only with a value"
    tbl, col = dep
    if tbl and not have.get(tbl): return "row missing (" + {"profile": "company_profile", "fundamentals": "fundamentals", "estimates": "analyst_estimates", "pt": "price_target_consensus", "etf_row": "etf_info", "price": "live quote"}[tbl] + ")"
    if col and not have.get(col): return "column empty"
    if tbl == "price": return "live quote carries no change figure"
    return "column empty"
def run(path, after):
    d = json.load(open(path)); res = d["results"]
    dashes = collections.Counter(); ns = collections.Counter(); why = collections.Counter(); names = collections.defaultdict(set)
    rows_seen = 0; none_tab = 0; fund_earn = 0; fund_names = []
    for r in res:
        tab = r.get("tab")
        if not tab: continue
        if tab.get("none"): none_tab += 1
        for b in tab["blocks"]:
            for row in b["rows"]:
                rows_seen += 1
                key = (b["block"], row["label"])
                if row["value"] == DASH: dashes[key] += 1; why[(row["label"], reason(row["label"], r.get("have", {}), after))] += 1; names[key].add(r["t"])
                elif row.get("ns") or row["value"].startswith("not stored") or row["value"] == "no reading": ns[key] += 1; why[(row["label"], reason(row["label"], r.get("have", {}), after))] += 1; names[key].add(r["t"])
                if r.get("fund") and row["label"] in ("next report", "last report"): fund_earn += 1; fund_names.append(r["t"] + ":" + row["label"])
    print(f"\n== {path}: {len(res)} names ({sum(1 for r in res if r.get('fund'))} funds) · {rows_seen} rows drawn · {none_tab} with no stats at all")
    print(f"   cells printing '{DASH}': {sum(dashes.values())} · cells printing 'not stored' / 'no reading': {sum(ns.values())} · fund earnings rows: {fund_earn} {fund_names[:12]}")
    for (blk, lab), n in sorted(dashes.items(), key=lambda x: -x[1]): print(f"   — {blk:22s} {lab:18s} {n:3d}  e.g. {', '.join(sorted(names[(blk, lab)])[:6])}")
    for (blk, lab), n in sorted(ns.items(), key=lambda x: -x[1]): print(f"   ns {blk:22s} {lab:18s} {n:3d}  e.g. {', '.join(sorted(names[(blk, lab)])[:6])}")
    print("   why:"); [print(f"      {lab:18s} {w:40s} {n:3d}") for (lab, w), n in sorted(why.items(), key=lambda x: (x[0][0], -x[1]))]
    return {"names": len(res), "dash": sum(dashes.values()), "ns": sum(ns.values()), "fund_earn": fund_earn, "rows": rows_seen, "by": {f"{b} · {l}": n for (b, l), n in dashes.items()}, "nsBy": {f"{b} · {l}": n for (b, l), n in ns.items()}, "why": {f"{l} · {w}": n for (l, w), n in why.items()}, "counts": d.get("counts")}
if __name__ == "__main__":
    out = {}
    for i, p in enumerate(sys.argv[1:]): out["after" if "after" in p else "before"] = run(p, "after" in p)
    json.dump(out, open(sys.argv[1].rsplit("/", 1)[0] + "/counts.json" if "/" in sys.argv[1] else "counts.json", "w"), indent=1)
