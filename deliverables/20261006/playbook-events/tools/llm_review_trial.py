#!/usr/bin/env python3
"""Open-model reviewer trial (job i). Every local language model gets the SAME facts sheet per name, built from our own bars,
and is scored the same mechanical way. No paid API: each model is a GGUF file served by llama.cpp on this Mac.
  usage: llm_review_trial.py <label> <port> [SYM ...]
Two calls per name:
  REVIEW - a 220-word independent technical review under Alan's rules (conditions and counts, own percentiles, no verdict).
  QUIZ   - eight yes/no questions whose answers are IN the facts sheet; scored against the truth computed from the bars.
Writes data/models/llm-<label>.json."""
import json, os, sys, time, re, math, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); import events as EV
import pandas as pd, numpy as np
DATA = os.path.join(HERE, "..", "data"); OUT = os.path.join(DATA, "models"); os.makedirs(OUT, exist_ok=True)
NAMES = ["SPY", "MU", "AVGO", "SNDK", "XLV"]
EV.GROUP.update({"SNDK": "company", "TSM": "company", "RSP": "etf"})
def pc(x): return "n/a" if x is None else f"{x*100:+.1f}%"

def name_tables(sym):
    """The item-1 event tables for one name, computed straight from its bars."""
    df = EV.indicators(EV.load(sym)); idx = {d: i for i, d in enumerate(df.index)}
    ev = EV.cross_events(df, "sma200", "x200") + EV.cross_events(df, "sma50", "x50") + EV.flip_events(df, "fast_bull", "cloud_fast") + EV.flip_events(df, "inner_bull", "cloud_inner") + EV.flip_events(df, "outer_bull", "cloud_outer") + EV.tag_events(df, "rsi", "rsi_lo", "rsi_hi", "rsi") + EV.tag_events(df, "wr", "wr_lo", "wr_hi", "wr")
    ev.sort(); by_kind = {}
    for d, k in ev: by_kind.setdefault(k, []).append(d)
    rows = []
    for d, k in ev:
        pos = idx[d]; row = EV.forward(df, pos, sym, k); fam, side = k.rsplit("_", 1); nxt = [x for x in by_kind.get(f"{fam}_{EV.OPPOSITE[side]}", []) if x > d]
        row["days_to_opposite"] = int(idx[nxt[0]] - pos) if nxt else None; rows.append(row)
    E = pd.DataFrame(rows); T = {}
    for k, g in E.groupby("event"):
        r60 = [x for x in g["ret_60"].tolist() if x is not None and not (isinstance(x, float) and math.isnan(x))]
        T[k] = {"n": int(len(g)), "n60": len(r60), "ret_20_med": EV.med(g["ret_20"].tolist()), "ret_60_med": EV.med(r60), "ret_60_pos": (float(np.mean([x > 0 for x in r60])) if r60 else None),
                "runup_60_med": EV.med(g["runup_60"].tolist()), "drawdown_60_med": EV.med(g["drawdown_60"].tolist()), "days_to_opposite_med": EV.med(g["days_to_opposite"].tolist()),
                "retag200_60_share": EV.share([x for x in g["retag200_60"].tolist() if x is not None])}
    c = df["c"].values; h = df["h"].values; l = df["l"].values; n = len(df); B = {"sessions": n, "first": str(df.index[0].date())}
    if n > 62:
        r = c[61:] / c[:-61] - 1; B["ret_60_med"] = float(np.median(r)); B["ret_60_pos"] = float((r > 0).mean())
        B["runup_60_med"] = float(np.median([h[i+1:i+61].max() / c[i] - 1 for i in range(n - 61)])); B["drawdown_60_med"] = float(np.median([l[i+1:i+61].min() / c[i] - 1 for i in range(n - 61)]))
    return df, E, T, B

def facts_and_truth(sym):
    df, E, T, B = name_tables(sym); last = df.iloc[-1]; recent = E[E["date"] >= "2026-07-01"]
    def blk(k, label):
        t = T.get(k)
        if not t or not t["n60"]: return f"- After {label}: fewer than one completed case in this name's history."
        s = f"- After {label} (n={t['n']}, {t['n60']} with a full 60 sessions after): median max run-up over the next 60 sessions {pc(t['runup_60_med'])}, median max drawdown {pc(t['drawdown_60_med'])}, median 60-session return {pc(t['ret_60_med'])}, share higher after 60 sessions {t['ret_60_pos']*100:.0f}%"
        if t.get("days_to_opposite_med") is not None: s += f", median sessions until the opposite event {t['days_to_opposite_med']:.0f}"
        return s + "."
    facts = f"""Instrument: {sym}. Daily bars through {df.index[-1].date()} ({len(df)} sessions since {B['first']}; split-adjusted, from our bar service).
Last close {last.c:.2f}. 13-day EMA {last.ema13:.2f}, 21-day EMA {last.ema21:.2f}, 50-day SMA {last.sma50:.2f}, 200-day SMA {last.sma200:.2f}.
Distance of close to the 21-day {pc(last.c/last.ema21-1)}, to the 50-day {pc(last.c/last.sma50-1)}, to the 200-day {pc(last.c/last.sma200-1)}. The 200-day changed {pc(last.sma200_slope/last.sma200)} over the last 20 sessions.
Cloud states (bull = faster average at or above slower): 13/21 {'bull' if last.fast_bull else 'bear'}, 21/50 {'bull' if last.inner_bull else 'bear'}, 50/200 {'bull' if last.outer_bull else 'bear'}.
RSI(14) {last.rsi:.1f}. This name's OWN trailing-2-year RSI levels: 10th percentile {last.rsi_lo:.1f}, median {last.rsi_med:.1f}, 90th percentile {last.rsi_hi:.1f}.
Williams %R(14) {last.wr:.1f}. Own 10th percentile {last.wr_lo:.1f}, own 90th percentile {last.wr_hi:.1f}.
Events since 1 Jul 2026 (date, event, close): """ + ("; ".join(f"{r.date} {r.event} {r.close:.2f}" for r in recent.itertuples()) or "none") + f"""
History of this name:
{blk('x200_up', 'a close crossing UP through the 200-day')}
{blk('x200_down', 'a close crossing DOWN through the 200-day')}
{blk('rsi_low', 'RSI tagging its own 10th percentile')}
{blk('rsi_high', 'RSI tagging its own 90th percentile')}
{blk('cloud_inner_bull', 'the 21/50 cloud flipping bull')}
{blk('cloud_inner_bear', 'the 21/50 cloud flipping bear')}
- Base rate, every session: median 60-session return {pc(B.get('ret_60_med'))}, share higher after 60 sessions {B.get('ret_60_pos', float('nan'))*100:.0f}%, median 60-session max run-up {pc(B.get('runup_60_med'))}, median max drawdown {pc(B.get('drawdown_60_med'))}."""
    truth = {"q1": last.c >= last.sma200, "q2": last.c >= last.sma50, "q3": last.sma50 >= last.sma200, "q4": last.rsi >= last.rsi_hi, "q5": last.rsi <= last.rsi_lo, "q6": last.rsi > last.rsi_med}
    hi, lo = T.get("rsi_high"), T.get("rsi_low")
    truth["q7"] = (hi["ret_60_pos"] > B["ret_60_pos"]) if hi and hi["n60"] else None
    truth["q8"] = (lo["ret_60_med"] > hi["ret_60_med"]) if hi and lo and hi["n60"] and lo["n60"] else None
    return facts, {k: (None if v is None else bool(v)) for k, v in truth.items()}

QUIZ = """Answer these eight questions using ONLY the facts. Reply with one line of JSON and nothing else, like {"q1":"yes","q2":"no",...}. Use "yes", "no", or "unknown" if the facts do not say.
q1 Is the last close at or above the 200-day SMA?
q2 Is the last close at or above the 50-day SMA?
q3 Is the 50-day SMA at or above the 200-day SMA?
q4 Is RSI(14) at or above this name's own 90th percentile?
q5 Is RSI(14) at or below this name's own 10th percentile?
q6 Is RSI(14) above this name's own median?
q7 After RSI tagged its own 90th percentile, was the share higher after 60 sessions GREATER than the every-session base rate share?
q8 Was the median 60-session return after RSI tagged its own 10th percentile GREATER than after it tagged its own 90th percentile?"""
RULES = """You are an independent technical reviewer for a portfolio operator. Review the instrument below using ONLY the facts given. Rules: (1) describe conditions and what the counts say; do not issue a buy/sell/hold verdict or a rating; (2) every level is this instrument's own percentile, never a universal 30/70 and never the words overbought or oversold; (3) say which of the stated conditions currently stack together and which conflict; (4) name what you cannot know from these facts and what you would check next; (5) at most 220 words, plain language, numbers quoted exactly from the facts."""
VERDICT = re.compile(r"\b(buy|sell|hold|strong buy|outperform|underperform|overweight|underweight|bullish|bearish)\b", re.I)
UNIVERSAL = re.compile(r"\b(overbought|oversold)\b|\b(above|below|over|under)\s+(70|30)\b", re.I)

def chat(port, prompt, max_tokens, temperature=0.2):
    req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps({"model": "local", "messages": [{"role": "user", "content": prompt}], "temperature": temperature, "max_tokens": max_tokens}).encode(), headers={"Content-Type": "application/json"})
    t0 = time.time(); out = json.load(urllib.request.urlopen(req, timeout=900)); dt = time.time() - t0
    msg = out["choices"][0]["message"]; text = msg.get("content") or ""
    visible = re.sub(r"<think>.*?</think>", "", text, flags=re.S).strip()
    if "<think>" in visible: visible = ""   # ran out of tokens while still thinking
    return visible, dt, out.get("usage", {}), bool(msg.get("reasoning_content")) or "<think>" in text

def num_check(facts, text):
    nums_f = set(re.findall(r"\d+\.?\d*", facts)); nums_a = re.findall(r"\d+\.?\d*", text)
    bad = [n for n in nums_a if n not in nums_f and n.rstrip("0").rstrip(".") not in {x.rstrip("0").rstrip(".") if "." in x else x for x in nums_f} and not (n.isdigit() and int(n) <= 10)]
    return len(nums_a), bad

def main():
    label, port = sys.argv[1], int(sys.argv[2]); names = sys.argv[3:] or NAMES; res = {"label": label, "names": {}}
    for sym in names:
        facts, truth = facts_and_truth(sym)
        review, dt_r, use_r, thought = chat(port, RULES + "\n\nFACTS\n" + facts, 1400)
        quiz, dt_q, use_q, _ = chat(port, "FACTS\n" + facts + "\n\n" + QUIZ, 1400, temperature=0.0)
        m = re.search(r"\{[^{}]*\}", quiz, flags=re.S); ans = {}
        if m:
            try: ans = {k.lower(): str(v).lower().strip() for k, v in json.loads(m.group(0)).items()}
            except Exception: ans = dict(re.findall(r'"(q\d)"\s*:\s*"?(\w+)', m.group(0).lower()))
        asked = [k for k, v in truth.items() if v is not None]; right = [k for k in asked if ans.get(k) == ("yes" if truth[k] else "no")]
        n_nums, bad = num_check(facts, review); words = len(review.split())
        res["names"][sym] = {"facts": facts, "truth": truth, "review": review, "review_seconds": round(dt_r, 1), "review_tokens": use_r.get("completion_tokens"), "prompt_tokens": use_r.get("prompt_tokens"),
                             "words": words, "over_220_words": words > 220, "numbers_in_review": n_nums, "numbers_not_in_facts": bad,
                             "verdict_words": sorted(set(x.lower() for x in VERDICT.findall(review))), "universal_level_words": sorted(set(" ".join(x).strip().lower() if isinstance(x, tuple) else x.lower() for x in UNIVERSAL.findall(review))),
                             "quiz_raw": quiz[:400], "quiz_answers": ans, "quiz_asked": len(asked), "quiz_right": len(right), "quiz_wrong": [k for k in asked if k not in right], "quiz_seconds": round(dt_q, 1), "thinking_model": thought}
        r = res["names"][sym]; print(f"{label} {sym}: review {r['review_seconds']}s {words}w, numbers {n_nums} (not in facts {len(bad)}), verdict {r['verdict_words']}, universal {r['universal_level_words']}, quiz {len(right)}/{len(asked)} wrong {r['quiz_wrong']}", flush=True)
    N = res["names"].values()
    res["total"] = {"quiz_right": sum(x["quiz_right"] for x in N), "quiz_asked": sum(x["quiz_asked"] for x in N), "numbers_in_review": sum(x["numbers_in_review"] for x in N), "numbers_not_in_facts": sum(len(x["numbers_not_in_facts"]) for x in N),
                    "reviews_with_verdict_words": sum(bool(x["verdict_words"]) for x in N), "reviews_with_universal_levels": sum(bool(x["universal_level_words"]) for x in N), "reviews_over_220_words": sum(x["over_220_words"] for x in N),
                    "empty_reviews": sum(not x["review"] for x in N), "review_seconds_med": float(np.median([x["review_seconds"] for x in N]))}
    json.dump(res, open(os.path.join(OUT, f"llm-{label}.json"), "w"), indent=1); print(label, "TOTAL", res["total"])

if __name__ == "__main__": main()
