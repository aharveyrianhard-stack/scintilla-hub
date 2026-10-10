# relabel.py — label the drawn lines of each read: a pattern = the lines sharing two anchor bars; per letter (A–D) the pattern whose lines
# pass nearest the letter's labels (drawn at the chart's right edge) is the live one; within it, top to bottom = 1..n. Older patterns stay unlabelled.
import json, glob, os, re
HV = os.path.dirname(os.path.abspath(__file__)) + "/harvest-20261009"
def relabel(r):
    labs = {}
    for L in r.get("labels", []):
        m = re.match(r"^([A-D])(\d)", L["t"])
        if m: labs.setdefault(m.group(1), {})[(L["t"], L["b"], round(L["y"], 4))] = L
    labs = {k: list(v.values()) for k, v in labs.items()}
    groups = {}
    for l in r["lines"]: l["label"] = None; groups.setdefault((l["b1"], l["b2"]), []).append(l)
    for letter, LL in labs.items():
        LL = sorted(LL, key=lambda L: -L["y"]); best = None
        for key, g in groups.items():
            if len(g) != len(LL): continue
            g = sorted(g, key=lambda l: -l["y2"]); sc = 0
            for l, L in zip(g, LL):
                yAt = l["y2"] + l["slopePerBar"] * (L["b"] - l["b2"]); sc += abs(yAt - L["y"]) / max(1e-9, abs(L["y"]))
            sc /= len(g)
            if best is None or sc < best[0] - 1e-9 or (abs(sc - best[0]) < 1e-9 and key[1] > best[1][1]): best = (sc, key, g)
        if best:
            sc, key, g = best
            for l, L in zip(g, LL): l["label"] = L["t"]; l["labelScore"] = round(sc, 3); l["labelBy"] = "nearest-to-labels"; l["weak"] = sc > 0.5
    return r
for f in sorted(glob.glob(HV + "/*.json")):
    if os.path.basename(f).startswith("_"): continue
    r = json.load(open(f)); relabel(r); json.dump(r, open(f, "w"), indent=1)
    lab = {l["label"]: (round(l["now"], 2), l["labelScore"]) for l in r["lines"] if l.get("label")}
    print("%-7s close %-10s %s" % (r.get("name"), r["lastClose"], "  ".join("%s=%s(%.2f)" % (k, v[0], v[1]) for k, v in sorted(lab.items()) if re.match(r"^[AB][126]", k))))
