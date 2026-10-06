#!/usr/bin/env python3
"""One-name trial: Qwen2.5-7B-Instruct (llama.cpp, local, no paid API) reviews NVDA from a facts sheet built from our own bars.
The model gets numbers only (no verdict words from us). Saves data/qwen-trial-nvda.json."""
import json, os, sys, time, urllib.request, math
HERE = os.path.dirname(os.path.abspath(__file__)); sys.path.insert(0, HERE); import events as EV
DATA = os.path.join(HERE, "..", "data"); SYM = sys.argv[1] if len(sys.argv) > 1 else "NVDA"
df = EV.indicators(EV.load(SYM)); last = df.iloc[-1]; E = [e for e in json.load(open(os.path.join(DATA, "events.json"))) if e["symbol"] == SYM]
T = json.load(open(os.path.join(DATA, "tables.json")))["per_name"][SYM]; B = json.load(open(os.path.join(DATA, "base-rates.json")))[SYM]
def pc(x): return f"{x*100:+.1f}%"
recent = [e for e in E if e["date"] >= "2026-07-01"]
facts = f"""Instrument: {SYM}. Daily bars through {df.index[-1].date()} (split-adjusted closes from our bar service).
Last close {last.c:.2f}. 13-day EMA {last.ema13:.2f}, 21-day EMA {last.ema21:.2f}, 50-day SMA {last.sma50:.2f}, 200-day SMA {last.sma200:.2f}.
Distance of close to 50-day {pc(last.c/last.sma50-1)}, to 200-day {pc(last.c/last.sma200-1)}. 200-day change over 20 sessions {pc(last.sma200_slope/last.sma200)}.
Cloud states (faster average at or above slower): 13/21 {'bull' if last.fast_bull else 'bear'}, 21/50 {'bull' if last.inner_bull else 'bear'}, 50/200 {'bull' if last.outer_bull else 'bear'}.
RSI(14) {last.rsi:.1f}; this name's own trailing-2-year RSI 10th percentile {last.rsi_lo:.1f}, median {last.rsi_med:.1f}, 90th percentile {last.rsi_hi:.1f}. Williams %R(14) {last.wr:.1f} (own 10th pct {last.wr_lo:.1f}, 90th pct {last.wr_hi:.1f}).
Events since 1 Jul 2026 (date, event, close): """ + "; ".join(f"{e['date']} {e['event']} {e['close']:.2f}" for e in recent) + f"""
History of this name ({B['sessions']} sessions since {B['first']}):
- After a close crossing UP through the 200-day (n={T['x200_up']['n']}): median max run-up over the next 60 sessions {pc(T['x200_up']['runup_60_med'])}, median max drawdown {pc(T['x200_up']['drawdown_60_med'])}, median 60-session return {pc(T['x200_up']['ret_60_med'])}, share higher after 60 sessions {T['x200_up']['ret_60_pos']*100:.0f}%, price re-tagged the 200-day within 60 sessions in {T['x200_up']['retag200_60_share']*100:.0f}% of cases, median sessions until the next cross down {T['x200_up']['days_to_opposite_med']:.0f}.
- After a close crossing DOWN through the 200-day (n={T['x200_down']['n']}): median 60-session return {pc(T['x200_down']['ret_60_med'])}, share higher {T['x200_down']['ret_60_pos']*100:.0f}%, median max drawdown {pc(T['x200_down']['drawdown_60_med'])}.
- After RSI tagged its own 10th percentile (n={T['rsi_low']['n']}): median 20-session return {pc(T['rsi_low']['ret_20_med'])}, 60-session {pc(T['rsi_low']['ret_60_med'])}, share higher after 60 {T['rsi_low']['ret_60_pos']*100:.0f}%.
- After RSI tagged its own 90th percentile (n={T['rsi_high']['n']}): median 20-session return {pc(T['rsi_high']['ret_20_med'])}, 60-session {pc(T['rsi_high']['ret_60_med'])}, share higher after 60 {T['rsi_high']['ret_60_pos']*100:.0f}%.
- Inner cloud (21/50) bull flips (n={T['cloud_inner_bull']['n']}) lasted a median {T['cloud_inner_bull']['days_to_opposite_med']:.0f} sessions; bear flips (n={T['cloud_inner_bear']['n']}) a median {T['cloud_inner_bear']['days_to_opposite_med']:.0f}.
- Base rate, every session: median 60-session return {pc(B['ret_60_med'])}, share higher after 60 sessions {B['ret_60_pos']*100:.0f}%, median 60-session max run-up {pc(B['runup_60_med'])}, max drawdown {pc(B['drawdown_60_med'])}."""
prompt = f"""You are an independent technical reviewer for a portfolio operator. Review the instrument below using ONLY the facts given. Rules: (1) describe conditions and what the counts say, do not issue a buy/sell verdict; (2) every level is this instrument's own percentile, never a universal 30/70; (3) say which of the stated conditions currently stack together and which conflict; (4) name what you cannot know from these facts and what you would check next; (5) at most 220 words, plain language, numbers quoted exactly from the facts.

FACTS
{facts}"""
t0 = time.time()
req = urllib.request.Request("http://127.0.0.1:18089/v1/chat/completions", data=json.dumps({"model": "qwen2.5-7b-instruct", "messages": [{"role": "user", "content": prompt}], "temperature": 0.2, "max_tokens": 450}).encode(), headers={"Content-Type": "application/json"})
out = json.load(urllib.request.urlopen(req, timeout=600)); dt = time.time() - t0
text = out["choices"][0]["message"]["content"]
# simple fidelity check: every number in the answer should appear in the facts
import re
nums_f = set(re.findall(r"-?\d+\.?\d*", facts)); nums_a = re.findall(r"-?\d+\.?\d*", text)
unsupported = [n for n in nums_a if n not in nums_f and n.lstrip("+-") not in nums_f and not (n.isdigit() and int(n) <= 300)]
res = {"symbol": SYM, "model": "Qwen2.5-7B-Instruct Q4_K_M via llama.cpp 0.6.0 (Homebrew), Metal, local", "seconds": round(dt, 1), "prompt_tokens": out.get("usage", {}).get("prompt_tokens"), "completion_tokens": out.get("usage", {}).get("completion_tokens"), "facts": facts, "answer": text, "numbers_in_answer": len(nums_a), "numbers_not_in_facts": unsupported}
json.dump(res, open(os.path.join(DATA, f"qwen-trial-{SYM.lower()}.json"), "w"), indent=1)
print(f"{dt:.1f}s", out.get("usage")); print(text); print("unsupported numbers:", unsupported)
