#!/usr/bin/env python3
"""Pull every open-model trial into one scoreboard: data/models/summary.json.
Reviews are re-scored here from the saved text so every model is measured by one rule set:
  - the answer is what follows a model's own 'thinking' section, if it prints one;
  - a number counts as unsupported when it is not in the facts sheet (list numbering 1-10 ignored);
  - rating words: buy, sell, overweight, underweight, outperform, underperform, price target, or 'hold' beside 'rating/recommend';
  - universal-level words: overbought, oversold (Alan: levels are each name's own percentile);
  - a review 'loops' when fewer than half of its sentences are distinct."""
import json, os, re, sys
HERE = os.path.dirname(os.path.abspath(__file__)); M = os.path.join(HERE, "..", "data", "models"); SCR = os.environ.get("PB1_SCRATCH", "")
def J(n):
    p = os.path.join(M, n); return json.load(open(p)) if os.path.exists(p) else None
RATING = re.compile(r"\b(strong buy|buy|sell(?![- ]?off)|outperform|underperform|overweight|underweight|price target)\b|\b(rat(?:ed|ing)|recommend\w*)\b.{0,40}\bhold\b", re.I)   # 'they hold cash' and 'sell-off' are not ratings
UNIV = re.compile(r"\b(overbought|oversold)\b", re.I)
def final(t):
    t = re.sub(r"<think>.*?</think>", "", t or "", flags=re.S); return (t.split("## Final Response")[-1] if "## Final Response" in t else t).strip()
def unsupported(facts, text):
    clean = lambda x: x.rstrip(".,")
    nf = {clean(x) for x in re.findall(r"\d[\d,]*\.?\d*", facts)}; nf |= {x.rstrip("0").rstrip(".") for x in nf if "." in x}
    na = [clean(x) for x in re.findall(r"\d[\d,]*\.?\d*", text)]
    return len(na), [n for n in na if n not in nf and (n.rstrip("0").rstrip(".") if "." in n else n) not in nf and not (n.isdigit() and int(n) <= 10)]
def loops(text):
    s = [x.strip() for x in re.split(r"(?<=[.!?])\s+", text) if len(x.strip()) > 15]; return bool(s) and len(set(s)) / len(s) < 0.5
MODELS = [
 {"key": "fin-o1-8b", "name": "Fin-o1-8B", "maker": "TheFinAI", "kind": "finance reasoning model", "base": "Qwen3-8B", "licence": "Apache-2.0", "file_gb": 5.03, "repo": "TheFinAI/Fin-o1-8B (GGUF: mradermacher/Fin-o1-8B-GGUF, Q4_K_M)"},
 {"key": "qwen2.5-7b", "name": "Qwen2.5-7B", "maker": "Alibaba", "kind": "general model (already on this Mac)", "base": "Qwen2.5-7B", "licence": "Apache-2.0", "file_gb": 4.68, "repo": "Qwen/Qwen2.5-7B-Instruct-GGUF, Q4_K_M"},
 {"key": "fin-r1", "name": "Fin-R1", "maker": "SUFE-AIFLM-Lab", "kind": "finance reasoning model", "base": "Qwen2.5-7B", "licence": "not declared on the model card", "file_gb": 4.68, "repo": "SUFE-AIFLM-Lab/Fin-R1 (GGUF: bartowski/SUFE-AIFLM-Lab_Fin-R1-GGUF, Q4_K_M)"},
 {"key": "fingpt-mt-llama3", "name": "FinGPT-MT (Llama-3 8B)", "maker": "AI4Finance", "kind": "finance task adapter (tone, headlines, entities)", "base": "Llama-3-8B", "licence": "Meta Llama 3 community licence", "file_gb": 4.92, "repo": "second-state/FinGPT-MT-Llama-3-8B-LoRA-GGUF, Q4_K_M"},
 {"key": "finbert", "name": "FinBERT", "maker": "Prosus", "kind": "headline-tone classifier (110M)", "base": "BERT", "licence": "not declared on the model card", "file_gb": 0.44, "repo": "ProsusAI/finbert"},
]
out = {"reviewers": [], "baselines": {}}
tech_truth = []; fund_truth = []
for m in MODELS:
    r = dict(m); T = J(f"llm-{m['key']}.json"); Fd = J(f"fund-{m['key']}.json"); To = J(f"tone-{m['key']}.json")
    if T:
        N = T["names"]; r["tech_right"] = sum(x["quiz_right"] for x in N.values()); r["tech_asked"] = sum(x["quiz_asked"] for x in N.values()); r["tech_quiz"] = r["tech_right"] / r["tech_asked"]
        r["tech_wrong"] = {s: x["quiz_wrong"] for s, x in N.items() if x["quiz_wrong"]}; fin = {s: final(x["review"]) for s, x in N.items()}
        nums = {s: unsupported(x["facts"], fin[s]) for s, x in N.items()}
        r["tech_numbers"] = sum(v[0] for v in nums.values()); r["tech_numbers_unsupported"] = sum(len(v[1]) for v in nums.values()); r["tech_unsupported_list"] = {s: v[1] for s, v in nums.items() if v[1]}
        r["tech_rating_reviews"] = sum(bool(RATING.search(t)) for t in fin.values()); r["tech_universal_reviews"] = sum(bool(UNIV.search(t)) for t in fin.values()); r["tech_loop_reviews"] = sum(loops(t) for t in fin.values())
        w = sorted(len(t.split()) for t in fin.values()); r["tech_words_med"] = w[len(w) // 2]; r["tech_over_220"] = sum(x > 220 for x in w); s_ = sorted(x["review_seconds"] for x in N.values()); r["tech_seconds_med"] = s_[len(s_) // 2]
        r["tech_reviews"] = {s: fin[s] for s in N}
        if not tech_truth: tech_truth = [v for x in N.values() for v in x["truth"].values() if v is not None]
    if Fd:
        N = Fd["names"]; r["fund_right"] = sum(x["quiz_right"] for x in N.values()); r["fund_asked"] = sum(x["quiz_asked"] for x in N.values()); r["fund_quiz"] = r["fund_right"] / r["fund_asked"]
        r["fund_wrong"] = {s: x["quiz_wrong"] for s, x in N.items() if x["quiz_wrong"]}; fin = {s: final(x["review"]) for s, x in N.items()}; nums = {s: unsupported(x["facts"], fin[s]) for s, x in N.items()}
        r["fund_numbers"] = sum(v[0] for v in nums.values()); r["fund_numbers_unsupported"] = sum(len(v[1]) for v in nums.values()); r["fund_unsupported_list"] = {s: v[1] for s, v in nums.items() if v[1]}
        r["fund_rating_reviews"] = sum(bool(RATING.search(t)) for t in fin.values()); r["fund_loop_reviews"] = sum(loops(t) for t in fin.values()); r["fund_reviews"] = fin
        w = sorted(len(t.split()) for t in fin.values()); r["fund_words_med"] = w[len(w) // 2]
        if not fund_truth: fund_truth = [v for x in N.values() for v in x["truth"].values() if v is not None]; out["fund_facts"] = {s: x["facts"] for s, x in N.items()}
    if To:
        r["tone_acc"] = To["public_accuracy"]; r["tone_recall"] = To["public_recall"]; r["tone_unparsed"] = To["public_unparsed"]; r["tone_seconds"] = To["seconds"]; r["tone_n"] = To["public_n"]; r["tone_counts"] = To["headline_counts"]
    if m["key"] == "fingpt-mt-llama3":
        n = J("tone-fingpt-native-prompt.json")
        if n: r["tone_native_acc"] = n["public_accuracy"]; r["tone_native_unparsed"] = n["public_unparsed"]; r["tone_native_recall"] = n["public_recall"]
    out["reviewers"].append(r)
if tech_truth: out["baselines"]["tech_always_yes"] = sum(tech_truth) / len(tech_truth)
if fund_truth: out["baselines"]["fund_always_yes"] = sum(fund_truth) / len(fund_truth)
q = J("llm-qwen2.5-7b.json")
if q: out["tech_facts"] = {s: x["facts"] for s, x in q["names"].items()}; out["tech_truth"] = {s: x["truth"] for s, x in q["names"].items()}
# headline labels side by side
tones = {m["key"]: J(f"tone-{m['key']}.json") for m in MODELS}; tones = {k: v for k, v in tones.items() if v}
if tones:
    first = next(iter(tones.values())); rows = []
    for i, h in enumerate(first["headlines"]):
        rows.append({"symbol": h["symbol"], "text": h["text"], "source": h["source"], "date": h["date"], **{k: v["headlines"][i]["pred"] for k, v in tones.items()}})
    out["headlines"] = rows; ks = [k for k in tones if k != "fingpt-mt-llama3"]
    out["headline_agreement"] = {"models": ks, "all_agree": sum(len({r[k] for k in ks}) == 1 for r in rows), "n": len(rows)}
# frameworks
if SCR:
    ta = {}
    for s in ("SPY", "MU", "AVGO", "SNDK", "XLV"):
        p = f"{SCR}/ta-out/result-{s}.json"
        if os.path.exists(p):
            d = json.load(open(p))[s]; txt = " ".join(str(d.get(k) or "") for k in ("market_report", "news_report", "fundamentals_report", "investment_plan", "trader_investment_plan", "final_trade_decision"))
            ta[s] = {"seconds": d.get("seconds"), "decision": d.get("decision"), "error": d.get("error"), "chars": len(txt), "says_overbought_oversold": len(UNIV.findall(txt)), "says_70_30": len(re.findall(r"70/30|\b70\b.{0,20}\b30\b|\b30\b.{0,20}\b70\b", txt)),
                     "market_report": d.get("market_report"), "fundamentals_report": d.get("fundamentals_report"), "final_trade_decision": d.get("final_trade_decision"), "trader_investment_plan": d.get("trader_investment_plan")}
    p = f"{SCR}/ta-out/fino1-result-AVGO.json"
    if os.path.exists(p):
        d = json.load(open(p))["AVGO"]; ta["AVGO (with Fin-o1-8B)"] = {"seconds": d.get("seconds"), "decision": d.get("decision"), "error": d.get("error"), "market_report": d.get("market_report"), "final_trade_decision": d.get("final_trade_decision")}
    if ta: json.dump(ta, open(os.path.join(M, "tradingagents.json"), "w"), indent=1)
    p = f"{SCR}/fr-out/result.json"
    if os.path.exists(p): json.dump(json.load(open(p)), open(os.path.join(M, "finrobot.json"), "w"), indent=1)
ta = J("tradingagents.json"); fr = J("finrobot.json")
if ta: out["tradingagents"] = {s: {k: v for k, v in d.items() if k in ("seconds", "decision", "error", "chars", "says_overbought_oversold", "says_70_30")} for s, d in ta.items()}
if fr: out["finrobot"] = {s: {k: v for k, v in d.items() if k in ("seconds", "tool_calls", "turns", "error")} for s, d in fr.items()}
for k, f in (("forecast", "forecast.json"), ("toolkits", "toolkits.json"), ("pandas_ta", "pandas-ta.json"), ("openbb", "openbb.json")):
    d = J(f)
    if d and k == "forecast": d = {kk: ({"model": v.get("model"), "seconds": v.get("seconds"), "pooled": v.get("pooled"), "per_name": {s: x["score"] for s, x in v.get("per_name", {}).items()}, "error": v.get("error")} if isinstance(v, dict) and kk != "design" else v) for kk, v in d.items()}
    if d: out[k] = d
json.dump(out, open(os.path.join(M, "summary.json"), "w"), indent=1)
for r in out["reviewers"]:
    print(r["name"], {k: (round(v, 3) if isinstance(v, float) else v) for k, v in r.items() if k in ("tech_right", "tech_asked", "tech_numbers", "tech_numbers_unsupported", "tech_rating_reviews", "tech_universal_reviews", "tech_loop_reviews", "tech_words_med", "tech_seconds_med", "fund_right", "fund_asked", "fund_numbers_unsupported", "fund_rating_reviews", "tone_acc", "tone_native_acc", "tone_unparsed")})
print("baselines", out["baselines"], "| headline agreement", out.get("headline_agreement"))
