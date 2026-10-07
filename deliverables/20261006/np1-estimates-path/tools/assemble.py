#!/usr/bin/env python3
"""NP1 — copies the job's outputs into ../data so the page can be rebuilt from this folder alone.
  python3 tools/assemble.py --src <folder the provider job wrote into>
The folder holds: out/path.json (ep_build.mjs), filings/out/*.filings.json (ep_filings.py), out/models/*.models.json and
*.passages.ndjson (ep_models.py), data/universe_raw.ndjson + data/ipo_lockups.ndjson (sql/exports.sql), fly/fmp_leg.out (ep_fetch_fmp.mjs)."""
import argparse, json, os, shutil

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(os.path.dirname(HERE), "data")
ap = argparse.ArgumentParser(); ap.add_argument("--src", required=True); a = ap.parse_args()
src = lambda *p: os.path.join(a.src, *p)
rows = lambda p: [json.loads(l) for l in open(p) if l.startswith("{")]
for d in ("filings", "models"): os.makedirs(os.path.join(DATA, d), exist_ok=True)

path = json.load(open(src("out", "path.json")))
json.dump(path, open(os.path.join(DATA, "path.json"), "w"), separators=(",", ":"))
new = [p["ticker"] for p in path["path"] if "NEW_LISTING" in p["reasons"]]
for t in new:
    for a_, b_ in ((src("filings", "out", f"{t}.filings.json"), ("filings", f"{t}.filings.json")), (src("out", "models", f"{t}.models.json"), ("models", f"{t}.models.json")),
                   (src("out", "models", f"{t}.passages.ndjson"), ("models", f"{t}.passages.ndjson"))):
        if os.path.exists(a_): shutil.copyfile(a_, os.path.join(DATA, *b_))
json.dump([{k: r[k] for k in ("ticker", "company", "listing_kind", "ipo_date", "lockup_days", "unlock_date", "basis", "prospectus_date", "source_form", "source_url", "early_rule", "clause")}
           for r in rows(src("data", "ipo_lockups.ndjson"))], open(os.path.join(DATA, "ipo_lockups.json"), "w"), indent=1)

# the last six quarters of each new listing, as the Hub's own tables hold them (fundamentals_history, cashflow_history)
uni = {r["ticker"]: r for r in rows(src("data", "universe_raw.ndjson"))}
quarters = {}
for t in new:
    h = [x for x in (uni[t].get("hist") or []) if x["p"] != "FY"]
    cf = {x["d"]: x for x in (uni[t].get("cf") or []) if x["p"] != "FY"}
    by = {x["d"]: x for x in h}
    out = []
    for x in h[-6:]:
        prev = by.get(str(int(x["d"][:4]) - 1) + x["d"][4:])
        # a vendor row that repeats its neighbour's sales to the dollar is a half-year split in two, not a quarter: no comparison against it
        twin = prev and any(o is not prev and o["rev"] == prev["rev"] for o in h)
        c = cf.get(x["d"], {})
        out.append({"label": f'{x["p"]} {x["d"][:4]}', "end": x["d"], "rev": x["rev"], "yoy": (x["rev"] / prev["rev"] - 1) if prev and prev.get("rev") and not twin else None,
                    "gm": x["gp"] / x["rev"] if x.get("rev") and x.get("gp") is not None else None, "oi": x.get("oi"), "ni": x.get("ni"), "eps": x.get("eps"),
                    "ocf": c.get("ocf"), "capex": c.get("capex"), "sbc": c.get("sbc")})
    quarters[t] = out
json.dump(quarters, open(os.path.join(DATA, "quarters.json"), "w"), indent=1)

ts = src("data", "target_summary.ndjson")
if os.path.exists(ts):
    json.dump({r["ticker"]: r for r in rows(ts) if r["ticker"] in new}, open(os.path.join(DATA, "target_summary.json"), "w"), indent=1)

# the keyed pull, as proof the FMP routes answer: counts and filing links only (no transcript text, no key)
leg = src("fly", "fmp_leg.out")
if os.path.exists(leg):
    raw = open(leg).read(); d = json.loads(raw[raw.find('{"schema"'):raw.rfind("}") + 1])
    json.dump({"schema": d["schema"], "fetched_utc": d["fetched_utc"], "names": [
        {"ticker": n["ticker"], "estimate_rows": len(n["estimates"]), "filings_seen": n["filings_seen"], "filings_kept": n["filings"][:12], "calls": n["calls"],
         "headlines_seen": n["headlines_seen"], "errors": n["errors"]} for n in d["names"]]}, open(os.path.join(DATA, "fmp-leg-proof.json"), "w"), indent=1)
print("assembled", len(new), "new listings:", " ".join(new))
