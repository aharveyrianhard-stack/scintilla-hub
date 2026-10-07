#!/usr/bin/env python3
"""NP1 — copies the job's outputs into ../data so the page can be rebuilt from this folder alone.

  python3 tools/assemble.py --path path.json --exports <dir> --filings <dir> --models <dir> --calls <dir> --fmp-leg fmp_leg.json \\
                            [--transcripts transcripts.ndjson]

  --path      what ep_build.mjs wrote                         --exports  the selects of sql/exports.sql, one .ndjson each
  --filings   what ep_filings.py wrote (with --keep-text)     --models   what ep_models.py wrote
  --calls     what ep_call_facts.py wrote (<T>.call.json)     --fmp-leg  what ep_fetch_fmp.mjs printed on the throw-away machine

The names carried in full are the new listings and the names whose estimates are too thin (the last rung of the path).
Nothing here reaches the network or a database."""
import argparse, json, os, re, shutil

HERE = os.path.dirname(os.path.abspath(__file__)); DATA = os.path.join(os.path.dirname(HERE), "data")
ap = argparse.ArgumentParser()
for k in ("--path", "--exports", "--filings", "--models", "--calls", "--fmp-leg"): ap.add_argument(k, required=True)
ap.add_argument("--transcripts")
a = ap.parse_args()
rows = lambda p: [json.loads(l) for l in open(p) if l.startswith("{")]
out = lambda *p: os.path.join(DATA, *p)
for d in ("filings", "models", "calls"):
    shutil.rmtree(out(d), ignore_errors=True); os.makedirs(out(d))          # nothing from an earlier run is left behind

path = json.load(open(a.path))
json.dump(path, open(out("path.json"), "w"), separators=(",", ":"))
new = [p["ticker"] for p in path["path"] if "NEW_LISTING" in p["reasons"]]
thin = [p["ticker"] for p in path["path"] if p["rung"] == "MODELS_AND_QUARTERLIES"]
carried = new + [t for t in thin if t not in new]
for t in carried:
    for src, dst in ((os.path.join(a.filings, f"{t}.filings.json"), ("filings", f"{t}.filings.json")), (os.path.join(a.models, f"{t}.models.json"), ("models", f"{t}.models.json")),
                     (os.path.join(a.models, f"{t}.passages.ndjson"), ("models", f"{t}.passages.ndjson")), (os.path.join(a.calls, f"{t}.call.json"), ("calls", f"{t}.call.json"))):
        if os.path.exists(src): shutil.copyfile(src, out(*dst))

json.dump([{k: r[k] for k in ("ticker", "company", "listing_kind", "ipo_date", "lockup_days", "unlock_date", "basis", "prospectus_date", "source_form", "source_url", "early_rule", "clause")}
           for r in rows(os.path.join(a.exports, "ipo_lockups.ndjson"))], open(out("ipo_lockups.json"), "w"), indent=1)

# the last six quarters of each carried name, as the Hub's own tables hold them (fundamentals_history, cashflow_history)
uni = {r["ticker"]: r for r in rows(os.path.join(a.exports, "universe_raw.ndjson"))}
quarters = {}
for t in carried:
    h = [x for x in (uni[t].get("hist") or []) if x["p"] != "FY"]
    cf = {x["d"]: x for x in (uni[t].get("cf") or []) if x["p"] != "FY"}
    by = {x["d"][:7]: x for x in h}
    q6 = []
    for x in h[-6:]:
        prev = by.get(str(int(x["d"][:4]) - 1) + x["d"][4:7])
        # a vendor row that repeats its neighbour's sales to the dollar is a half-year split in two, not a quarter: no comparison against it
        twin = prev and any(o is not prev and o["rev"] == prev["rev"] for o in h)
        c = cf.get(x["d"], {})
        q6.append({"label": f'{x["p"]} {x["d"][:4]}', "end": x["d"], "rev": x["rev"], "yoy": (x["rev"] / prev["rev"] - 1) if prev and prev.get("rev") and not twin else None,
                   "gm": x["gp"] / x["rev"] if x.get("rev") and x.get("gp") is not None else None, "oi": x.get("oi"), "ni": x.get("ni"), "eps": x.get("eps"),
                   "ocf": c.get("ocf"), "capex": c.get("capex"), "sbc": c.get("sbc")})
    quarters[t] = q6
json.dump(quarters, open(out("quarters.json"), "w"), indent=1)

ts = os.path.join(a.exports, "target_summary.ndjson")
if os.path.exists(ts):
    json.dump({r["ticker"]: r for r in rows(ts) if r["ticker"] in carried}, open(out("target_summary.json"), "w"), indent=1)

# the keyed pull, as proof the FMP routes answer: counts, dates and public filing links only (no transcript text, no headline text, no key)
raw = open(a.fmp_leg).read(); d = json.loads(raw[raw.find('{"schema"'):raw.rfind("}") + 1])
picked = {t: {v["url"] for v in (json.load(open(out("filings", f"{t}.filings.json")))["picked"] or {}).values() if v} for t in carried if os.path.exists(out("filings", f"{t}.filings.json"))}
json.dump({"schema": d["schema"], "fetched_utc": d["fetched_utc"], "names": [
    {"ticker": n["ticker"], "estimate_rows": len(n["estimates"]), "filings_seen": n["filings_seen"], "filings_kept": n["filings"][:12], "calls": n["calls"],
     "newest_call_words": (n.get("transcript") or {}).get("words"), "headlines_seen": n["headlines_seen"], "errors": n["errors"],
     # is each document the reader picked (from EDGAR's own index) also in FMP's list of the company's filings?
     "picked_in_fmp_list": {u.rsplit("/", 1)[-1]: any(f["url"] == u for f in n["filings"]) for u in sorted(picked.get(n["ticker"], []))}} for n in d["names"]]},
    open(out("fmp-leg-proof.json"), "w"), indent=1)

# the hand-checked reads of the worked example: each quote must be in the document it names, word for word
reads = out("CBRS.read.json")
if os.path.exists(reads):
    doc = json.load(open(reads)); squash = lambda s: " ".join(s.split())
    calls = {r["ticker"]: squash(r["transcript"]) for r in rows(a.transcripts)} if a.transcripts else {}
    texts = {}
    def source(kind):
        if kind not in texts:
            f = os.path.join(a.filings, f"CBRS.{kind}.full.txt")
            texts[kind] = calls.get("CBRS", "") if kind == "call" else squash(open(f).read()) if os.path.exists(f) else ""
        return texts[kind]
    n = 0
    for r in doc["reads"]:
        for q in r["quotes"]:
            q["found_in_source"] = bool(source(q["from"])) and squash(q["text"]) in source(q["from"]); n += 1
    json.dump(doc, open(reads, "w"), indent=1, ensure_ascii=False)
    print("reads:", sum(q["found_in_source"] for r in doc["reads"] for q in r["quotes"]), "of", n, "quotes found word for word in the document they name")
print("assembled", len(carried), "names:", " ".join(carried), "| new", len(new), "| thin", len(thin))
