# PP1 · what a company SAID it will spend on its build-out, read from its newest earnings call (the vendor's transcript).
# A rule, not a model: a sentence that names capital spending, carries a dollar figure and looks forward. Every hit is kept
# with its own words so it can be checked by eye; nothing here is used by the score until a person has marked it `use`
# in data/capex-announced.json. No network.   Run from the scratch folder:   python3 <this file> [T1 T2 …]
import json, re, sys
SUBJECT = re.compile(r"\b(cap\s?ex|capital expenditures?|capital spend(?:ing)?|capital investments?|capital plan|capital program|capital deployment)\b", re.I)
FORWARD = re.compile(r"\b(expect|guid|outlook|plan|anticipat|forecast|target|will be|we'll|going to|intend|budget|project(?:ed|ing)?|full[- ]year|for the year|fiscal (?:year )?20\d\d|for 20\d\d|in 20\d\d|next year|this year|rais(?:e|ing)|increas(?:e|ing) our)\b", re.I)
MONEY = re.compile(r"\$\s?(\d{1,3}(?:,\d{3})*(?:\.\d+)?|\d+(?:\.\d+)?)\s?(billion|million|bn|mm|b|m)\b", re.I)
RANGE = re.compile(r"\$\s?(\d+(?:\.\d+)?)\s?(billion|million|bn|mm|b|m)?\s?(?:to|-|–|and)\s?\$?\s?(\d+(?:\.\d+)?)\s?(billion|million|bn|mm|b|m)\b", re.I)
UNIT = {"billion": 1e9, "bn": 1e9, "b": 1e9, "million": 1e6, "mm": 1e6, "m": 1e6}
def sentences(text):
    text = re.sub(r"\s+", " ", text or "")
    return [s.strip() for s in re.split(r"(?<=[.!?])\s+(?=[A-Z$])", text) if s.strip()]
def amounts(s):
    """Dollar amounts in a sentence: ranges first (low, high), then single figures."""
    out = []
    for m in RANGE.finditer(s):
        u2 = UNIT[m.group(4).lower()]; u1 = UNIT[m.group(2).lower()] if m.group(2) else u2
        out.append((float(m.group(1)) * u1, float(m.group(3)) * u2))
    if not out:
        for m in MONEY.finditer(s): v = float(m.group(1).replace(",", "")) * UNIT[m.group(2).lower()]; out.append((v, v))
    return out
def read_call(text, limit=4):
    """The sentences of a call that announce capital spending, best first: [{quote, low, high, score}]."""
    hits = []
    S = sentences(text)
    for i, s in enumerate(S):
        if not SUBJECT.search(s): continue
        a = amounts(s)
        if not a: continue
        fw = len(FORWARD.findall(s)); score = 2 * min(fw, 3) + (2 if RANGE.search(s) else 0) + (2 if re.search(r"\bguid|\boutlook|\bexpect", s, re.I) else 0) - (2 if re.search(r"\b(was|were|totaled|came in|spent)\b", s, re.I) and not fw else 0)
        lo, hi = max(a, key=lambda x: x[1])
        hits.append({"quote": s[:520], "low": lo, "high": hi, "score": score, "at": i})
    return sorted(hits, key=lambda h: (-h["score"], h["at"]))[:limit]
if __name__ == "__main__":
    C = json.load(open("fmp-calls.json"))["names"]; want = [a.upper() for a in sys.argv[1:]] or sorted(C)
    out = {}
    for t in want:
        calls = (C.get(t) or {}).get("calls") or []
        if not calls: out[t] = {"call": None, "hits": []}; continue
        c = calls[0]; out[t] = {"call": {"date": c["date"], "year": c["year"], "quarter": c["quarter"], "words": len(c["content"].split())}, "hits": read_call(c["content"])}
    json.dump(out, open("capex-calls.json", "w"), indent=1)
    print("names", len(out), "· with a call", sum(1 for v in out.values() if v["call"]), "· with at least one capex sentence", sum(1 for v in out.values() if v["hits"]))
