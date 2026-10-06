#!/usr/bin/env python3
"""LD1 · collect what the research agents returned into data/research.json and data/peers.json.

usage: collect.py <workflow journal.jsonl> [<second journal.jsonl> ...]
Each studied name has a first record (stage "research") and, when the checker ran, a second (stage "verify").
The checked record is the one the study uses; the first is kept beside it so every change can be seen.
A third, blind read (stage "blind": the agent is told only the ticker, not the group or the price) covers the
three judgement calls (EPS estimate direction, sales estimate direction, guidance) and goes to data/blind.json.
"""
import json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__)); D = os.path.join(HERE, "..", "data"); os.makedirs(D, exist_ok=True)
research, verify, peers, blind = {}, {}, {}, {}
for path in sys.argv[1:]:
    for line in open(path):
        try: j = json.loads(line)
        except Exception: continue
        r = j.get("result") if j.get("type") == "result" else None
        if not isinstance(r, dict): continue
        if r.get("stage") == "research" and r.get("ticker"): research[r["ticker"].upper()] = r
        elif r.get("stage") == "verify" and r.get("ticker"): verify[r["ticker"].upper()] = r
        elif r.get("stage") == "blind" and r.get("ticker"): blind[r["ticker"].upper()] = r
        elif r.get("stage") == "peers":
            for p in r.get("peers") or []:
                if p.get("ticker"): peers[p["ticker"].upper()] = p
out = [{"ticker": t, "research": research.get(t), "verify": verify.get(t)} for t in sorted(set(research) | set(verify))]
json.dump(out, open(os.path.join(D, "research.json"), "w"), indent=1)
json.dump([peers[t] for t in sorted(peers)], open(os.path.join(D, "peers.json"), "w"), indent=1)
json.dump([blind[t] for t in sorted(blind)], open(os.path.join(D, "blind.json"), "w"), indent=1)
print(f"studied: {len(out)} (first record {len(research)}, checked {len(verify)}) · peers: {len(peers)} · blind second read: {len(blind)}")
print("not checked:", " ".join(t for t in sorted(research) if t not in verify) or "-")
