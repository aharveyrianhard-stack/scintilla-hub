# build-room.py — Channel Room data + page from the approvals and the chart reads (harvest-20261009/*.json)
import json, glob, os, re, datetime, urllib.request
H = os.path.dirname(os.path.abspath(__file__)); HV = H + "/harvest-20261009"
appr = json.load(open(H + "/LT-APPROVALS-20261009.json"))
BROAD = ["SPY","QQQ","ES1!","NQ1!","VIX","US10Y","USOIL","XAUUSD","XAGUSD","SLV","BTCUSD","HYG","PCC","ADD","XLF","XLU","XLV","XLRE","SMH","DRAM","AGIX","CIBR","FDN","IGV"]
NOT_ON_ROSTER = ["XLK","XLE","XLY","XLI","XLB","XLC","XLP","IWM","DIA","RSP","TLT"]
cat = json.load(open("/Users/alanharvey/SCINTILLA 0.5/INDICATOR_LAB/sprints/2026-10-03-lenses/review-expansion-20261006/watch-capture-refresh-20261009/CAPTURE-LT-CATALOG-LIVE-20261009.json"))
roster = [s.split(":")[-1] for s in [t for t in cat["tiers"] if t["id"] == "all"][0]["symbols"]]
reads = {}
for f in glob.glob(HV + "/*.json"):
    if os.path.basename(f).startswith("_"): continue
    r = json.load(open(f)); reads[r.get("name") or os.path.basename(f)[:-5]] = r
rows = []
for a in appr["rows"]:
    s = a["sym"]; r = reads.get(s) or reads.get(s.replace("!", ""))
    row = {"sym": s, "set": a["set"], "components": a["components"], "note": a.get("note", ""), "group": "broad" if s in BROAD else "stock"}
    if r:
        lab = {l["label"]: l["now"] for l in r["lines"] if l.get("label")}
        want = [c for c in a["components"] if not c.endswith("?")]
        letter = want[0][0] if want else "B"
        vals = {c: lab.get(c) for c in want}
        # A set = A2 and its pair A6 (the same pairing as the B set's B2 + B6; Alan, 9 Oct: "A2 and whatever its pair is", "A6 LT")
        if a["set"] == "A" and len(want) < 2:
            vals = {"A2": lab.get("A2"), "A6": lab.get("A6")}
        got = {k: v for k, v in vals.items() if v is not None}
        fallback = None
        if len(got) < 2:
            for letter in "BA":
                rails = {k: v for k, v in lab.items() if k.startswith(letter) and not k.endswith("(M)")}
                if len(rails) >= 2: got = {letter + "2": rails.get(letter + "2"), letter + "6": rails.get(letter + "6")}; got = {k: v for k, v in got.items() if v is not None}; fallback = letter; break
        row["fallback"] = fallback
        row["read"] = {"at": r.get("readAt"), "close": r.get("lastClose"), "labelled": sorted(lab.keys(), key=lambda k: (k[0], int(re.sub(r"\D", "", k) or 0)))}
        if len(got) >= 2:
            lo, hi = min(got.values()), max(got.values()); px = r["lastClose"]
            row.update({"price": px, "low": lo, "high": hi, "pos": (px - lo) / (hi - lo) * 100 if hi > lo else None, "down": (lo / px - 1) * 100, "up": (hi / px - 1) * 100, "rails": got, "source": ("read from the capture chart" if not fallback else "the " + a["set"] + " set is not drawn on this chart; showing the " + fallback + " set instead")})
        else:
            row["source"] = "read, but the " + a["set"] + " set is not drawn on this chart (lines present: " + (", ".join(row["read"]["labelled"]) or "none") + ")"
    else: row["source"] = "approved by voice · not read yet"
    rows.append(row)
# the same rails, with two anchor points each, for the painter on the capture layout (rails-overlay-keeper.mjs reads LT-RAILS.json)
rails_out = {}
for row in rows:
    if "rails" not in row: continue
    r = reads.get(row["sym"]) or reads.get(row["sym"].replace("!", "")); li = r["lastIndex"]; lt = r["lastTime"]; out = []
    for tag in row["rails"]:
        l = next((x for x in r["lines"] if x.get("label") == tag), None)
        if not l: continue
        cands = [(l["b2"], l["t2"], l["y2"]), (l["b1"], l["t1"], l["y1"])]
        cands = sorted([c for c in cands if c[1] is not None and c[0] is not None and 0 <= c[0] <= li], key=lambda c: c[0])
        if not cands: continue
        if len(cands) == 2 and cands[0][0] != cands[1][0]:   # the line's own two anchor points
            out.append({"tag": "LT " + tag, "t1": int(cands[0][1]), "y1": round(cands[0][2], 4), "t2": int(cands[1][1]), "y2": round(cands[1][2], 4)})
        elif cands[0][0] < li:                                 # one anchor is off the chart: use the other one and the rail's value on the last bar
            out.append({"tag": "LT " + tag, "t1": int(cands[0][1]), "y1": round(cands[0][2], 4), "t2": int(lt), "y2": round(l["now"], 4)})
    if len(out) >= 2: rails_out[row["sym"]] = out
json.dump(rails_out, open(H + "/LT-RAILS.json", "w"), indent=1)
missing_broad = [s for s in roster if s in BROAD and s not in {r["sym"] for r in rows}]; missing_stock = [s for s in roster if s not in BROAD and s not in {r["sym"] for r in rows}]
asof = datetime.datetime.now().strftime("%-d %b %Y %H:%M")
data = {"asof": asof, "rows": rows, "missing_broad": missing_broad, "missing_stock": missing_stock, "not_on_roster": NOT_ON_ROSTER}
json.dump(data, open(H + "/CHANNEL-ROOM-DATA.json", "w"), indent=1)
p = "/Users/alanharvey/AlanOS/Operating System/workspaces/scintilla/deliverables/20261009/CHANNEL-ROOM-REVIEW.html"; s = open(p).read()
s = re.sub(r'const D=\{.*?\};const ROWS=D\.rows', lambda m: 'const D=' + json.dumps(data, ensure_ascii=False) + ';const ROWS=D.rows', s, flags=re.S)
open(p, "w").write(s)
have = [r for r in rows if "pos" in r]
print("approved", len(rows), "| with rails", len(have), "| read but set missing", sum(1 for r in rows if r.get("read") and "pos" not in r), "| not read", sum(1 for r in rows if not r.get("read")))
for r in sorted(have, key=lambda r: r["pos"]): print("  %-7s %-4s %6.0f%% up · down %6.1f%% · up %+6.1f%% · %s" % (r["sym"], r["set"], r["pos"], r["down"], r["up"], " ".join(k + "=" + ("%.2f" % v) for k, v in r["rails"].items())))
for r in rows:
    if r.get("read") and "pos" not in r: print("  %-7s %s" % (r["sym"], r["source"]))
