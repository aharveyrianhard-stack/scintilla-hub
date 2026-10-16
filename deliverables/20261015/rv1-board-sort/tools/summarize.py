#!/usr/bin/env python3
"""RV1 — the evidence JSON as one table per run: every read, with what the header says and whether the rows follow it."""
import json, pathlib, sys
D = pathlib.Path(__file__).resolve().parents[1] / "evidence"
def rows(name):
    d = json.loads((D / name).read_text())
    out = {"run": d["job"], "target": d["target"], "started": d["started"], "writes": d["writes"], "errors": d["errors"], "reads": []}
    for r in d["results"]:
        v = r.get("value")
        if r["step"] in ("read", "watch") and isinstance(v, dict) and "sortKey" in v:
            out["reads"].append({"label": r.get("label"), "at": v["at"], "coh": v["coh"], "header": v["header"], "sort": f'{v["sortKey"]}/{v["sortDir"]}',
                "rows": v["rows"], "numbered": v.get("numberedRows"), "wrongSteps": v.get("wrongSteps"), "numbersBelowDash": v.get("numbersBelowDash"),
                "breaks": v["breaks"], "rewound": v["rewindOn"], "pulls": v["pulls"], "rankReady": v["rankReady"],
                "top": " · ".join(f'{x["t"]} {x["shown"]}' for x in v["top"][:10])})
        elif r["step"] == "eval": out["reads"].append({"label": r.get("label"), "eval": v})
        elif r["step"] == "drag": out["reads"].append({"label": r.get("label"), "drag": {"from": r.get("from"), "to": r.get("to"), "stamp": r.get("asof")}})
        if r.get("err"): out["reads"].append({"label": r.get("label"), "err": r["err"][:160]})
    return out
if __name__ == "__main__":
    for name in sys.argv[1:]:
        s = rows(name)
        print(f'\n## {s["run"]} — {s["target"]} — started {s["started"]} — writes {len(s["writes"])} — page errors {len(s["errors"])}')
        for r in s["reads"]:
            if "header" in r:
                print(f'- {r["label"]}: header {r["header"]} ({r["sort"]}), {r["rows"]} rows / {r["numbered"]} numbered, wrong-way steps {r["wrongSteps"]}, numbers below a dash {r["numbersBelowDash"]}, rewound {r["rewound"]}, pulls {r["pulls"]}\n    {r["top"]}')
            else: print(f'- {r["label"]}: {r.get("eval") or r.get("drag") or r.get("err")}')
