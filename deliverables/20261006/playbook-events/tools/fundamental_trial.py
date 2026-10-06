#!/usr/bin/env python3
"""Fundamental-review trial (job i, fundamental side). Same idea as the technical trial: one facts sheet per company,
every local model gets the same sheet, a 200-word review plus eight yes/no questions whose answers are in the sheet.
The figures are Yahoo Finance's (keyless) - NOT our own data; our fundamentals live behind keys this Mac does not hold.
Every figure is formatted by code (billions, percent) before the model sees it.
  usage: fundamental_trial.py <label> <port>     Writes data/models/fund-<label>.json."""
import json, os, sys, re, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "data", "models"); sys.path.insert(0, HERE)
F = json.load(open(os.path.join(OUT, "fundamentals-yahoo.json")))
def B(x): return "n/a" if x is None else f"${x/1e9:,.1f} billion"
def P(x): return "n/a" if x is None else f"{x*100:.1f}%"
def sheet(sym):
    d = F[sym]; i = d["info"]; q = [r for r in d["quarters"] if r["revenue"]]
    lines = [f"Company: {i['longName']} ({sym}). Figures from Yahoo Finance on {d['fetched']}.",
             f"Market value {B(i['marketCap'])}. Enterprise value {B(i['enterpriseValue'])}. Revenue, trailing twelve months {B(i['totalRevenue'])}.",
             f"Price to trailing earnings {i['trailingPE']:.1f}. Price to forward earnings {i['forwardPE']:.1f}. Price to sales {i['priceToSalesTrailing12Months']:.1f}.",
             f"Revenue growth, latest quarter against a year earlier {P(i['revenueGrowth'])}. Gross margin {P(i['grossMargins'])}. Operating margin {P(i['operatingMargins'])}. Net margin {P(i['profitMargins'])}.",
             f"Cash {B(i['totalCash'])}. Debt {B(i['totalDebt'])}. Free cash flow, trailing twelve months {B(i['freeCashflow'])}.",
             "Quarterly results, newest first (quarter end: revenue, operating income, net income):"]
    lines += [f"- {r['quarter_end']}: revenue {B(r['revenue'])}, operating income {B(r['operating_income'])}, net income {B(r['net_income'])}" for r in q[:5]]
    t = {"q1": i["trailingPE"] > i["forwardPE"], "q2": i["totalDebt"] > i["totalCash"], "q3": i["operatingMargins"] < i["profitMargins"], "q4": i["revenueGrowth"] < 1.0, "q5": i["freeCashflow"] > 0, "q6": i["marketCap"] < 5e11,
         "q7": (q[0]["revenue"] > q[1]["revenue"]) if len(q) > 1 else None, "q8": (q[0]["net_income"] < q[-1]["net_income"]) if len(q) > 1 and q[0]["net_income"] and q[-1]["net_income"] else None}
    return "\n".join(lines), t, q
QUIZ = """Answer these eight questions using ONLY the facts. Reply with one line of JSON and nothing else, like {"q1":"yes","q2":"no",...}. Use "yes", "no", or "unknown" if the facts do not say.
q1 Is the price to trailing earnings HIGHER than the price to forward earnings?
q2 Is debt GREATER than cash?
q3 Is the operating margin LOWER than the net margin?
q4 Is revenue growth against a year earlier BELOW 100%?
q5 Is trailing free cash flow positive?
q6 Is the market value BELOW $500 billion?
q7 Is the newest quarter's revenue HIGHER than the quarter before it?
q8 Is the newest quarter's net income LOWER than the oldest quarter listed?"""
RULES = "You are an independent fundamental reviewer for a portfolio operator. Review the company below using ONLY the facts given. Rules: describe conditions and what the figures say; no buy/sell/hold verdict or rating, no price target; say what the figures cannot tell you and what you would check next; at most 200 words; quote numbers exactly as written in the facts."
VERDICT = re.compile(r"\b(buy|sell|hold|strong buy|outperform|underperform|overweight|underweight|price target)\b", re.I)
def final(t):
    t = re.sub(r"<think>.*?</think>", "", t, flags=re.S); return (t.split("## Final Response")[-1] if "## Final Response" in t else t).strip()
def chat(port, prompt, temp):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps({"model": "local", "messages": [{"role": "user", "content": prompt}], "temperature": temp, "max_tokens": 1400}).encode(), headers={"Content-Type": "application/json"})
    t0 = time.time(); o = json.load(urllib.request.urlopen(req, timeout=900)); return final(o["choices"][0]["message"].get("content") or ""), time.time() - t0
if __name__ == "__main__":
    label, port = sys.argv[1], int(sys.argv[2]); res = {"label": label, "names": {}}
    for sym in F:
        facts, truth, _ = sheet(sym); review, dt = chat(port, RULES + "\n\nFACTS\n" + facts, 0.2); quiz, dq = chat(port, "FACTS\n" + facts + "\n\n" + QUIZ, 0.0)
        m = re.search(r"\{[^{}]*\}", quiz, flags=re.S); ans = {}
        if m:
            try: ans = {k.lower(): str(v).lower().strip() for k, v in json.loads(m.group(0)).items()}
            except Exception: ans = dict(re.findall(r'"(q\d)"\s*:\s*"?(\w+)', m.group(0).lower()))
        asked = [k for k, v in truth.items() if v is not None]; right = [k for k in asked if ans.get(k) == ("yes" if truth[k] else "no")]
        nf = set(re.findall(r"\d[\d,]*\.?\d*", facts)); na = re.findall(r"\d[\d,]*\.?\d*", review); bad = [n for n in na if n.rstrip(".") not in {x.rstrip(".") for x in nf} and not (n.isdigit() and int(n) <= 10)]
        res["names"][sym] = {"facts": facts, "truth": truth, "review": review, "seconds": round(dt, 1), "words": len(review.split()), "numbers_in_review": len(na), "numbers_not_in_facts": bad, "verdict_words": sorted(set(x.lower() for x in VERDICT.findall(review))),
                             "quiz_answers": ans, "quiz_asked": len(asked), "quiz_right": len(right), "quiz_wrong": [k for k in asked if k not in right]}
        print(label, sym, f"{dt:.0f}s", res["names"][sym]["words"], "w, numbers", len(na), "not in facts", bad, "verdict", res["names"][sym]["verdict_words"], "quiz", len(right), "/", len(asked), "wrong", res["names"][sym]["quiz_wrong"], flush=True)
    N = res["names"].values(); res["total"] = {"quiz_right": sum(x["quiz_right"] for x in N), "quiz_asked": sum(x["quiz_asked"] for x in N), "numbers_in_review": sum(x["numbers_in_review"] for x in N), "numbers_not_in_facts": sum(len(x["numbers_not_in_facts"]) for x in N), "reviews_with_verdict_words": sum(bool(x["verdict_words"]) for x in N)}
    json.dump(res, open(os.path.join(OUT, f"fund-{label}.json"), "w"), indent=1); print(label, "TOTAL", res["total"])
