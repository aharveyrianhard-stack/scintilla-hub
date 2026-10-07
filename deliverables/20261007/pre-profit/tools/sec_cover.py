# PP1 · the share count a company prints on the cover of its newest quarterly or annual report, every class added.
# The SEC's tagged data gives this only for companies with ONE class of stock; for the others (CoreWeave, Cerebras,
# SpaceX, Rivian …) the cover sentence itself is read, with NP1's filing reader (provider branch
# provider/np1-estimates-path-20261006 @2001beb, services/estimates-path/ep_filings.py: filing_index, pick, to_text,
# cover_shares — used as it is, not copied). No key. House contact, at most four requests a second.
# Run from the scratch folder:   NP1_FILINGS_DIR=<…/services/estimates-path> python3 <this file> T1 T2 …
import json, os, sys, time, datetime as d
sys.path.insert(0, os.environ.get("NP1_FILINGS_DIR", "/Users/alanharvey/SCINTILLA 0.5/_worktrees/provider-np1-estimates-path-20261006/services/estimates-path"))
import ep_filings as E
MONTHS = {m: i + 1 for i, m in enumerate("January February March April May June July August September October November December".split())}
def iso(words):
    """'August 5, 2026' → '2026-08-05'"""
    try:
        m, day, y = words.replace(",", "").split(); return d.date(int(y), MONTHS[m], int(day)).isoformat()
    except Exception: return None
def read_cover(cik):
    idx = E.filing_index(cik); p = E.pick(idx["filings"])
    docs = [f for f in (p.get("quarterly"), p.get("annual")) if f]
    docs.sort(key=lambda f: f["filed"], reverse=True)                      # the newest report first
    for f in docs[:2]:
        try: text = E.to_text(E.sec_get(f["url"]).decode("utf8", "replace"))
        except Exception as e: continue
        c = E.cover_shares(text)
        if c: return {"as_of": iso(c["as_of"]), "as_of_words": c["as_of"], "classes": c["classes"], "total": c["total"], "quote": c["quote"], "form": f["form"], "filed": f["filed"], "url": f["url"]}
    return {"error": "no cover sentence read" if docs else "no quarterly or annual report in the index", "forms": [f["form"] + " " + f["filed"] for f in docs[:2]]}
if __name__ == "__main__":
    out = json.load(open("sec/cover-text.json")) if os.path.exists("sec/cover-text.json") else {}
    t0 = time.time(); n = 0
    for t in [a.upper() for a in sys.argv[1:]]:
        if t in out: continue
        try: cik = json.load(open(f"sec/{t}.json"))["cik"]; out[t] = read_cover(cik)
        except Exception as e: out[t] = {"error": str(e)[:160]}
        n += 1
        if n % 10 == 0: print(n, t, round(time.time() - t0), "s", flush=True); json.dump(out, open("sec/cover-text.json", "w"), indent=1)
    json.dump(out, open("sec/cover-text.json", "w"), indent=1)
    ok = [t for t, v in out.items() if v.get("total")]
    print("read", n, "in", round(time.time() - t0), "s · with a cover count:", len(ok), "of", len(out), "· none read:", sorted(t for t, v in out.items() if not v.get("total")))
