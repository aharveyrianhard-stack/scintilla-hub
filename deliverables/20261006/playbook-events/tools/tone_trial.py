#!/usr/bin/env python3
"""Headline-tone trial. Two sets, same three labels (positive / negative / neutral):
  A. 240 labelled finance headlines from a public test file (zeroshot/twitter-financial-news-sentiment, validation split,
     80 per label, fixed seed) - gives an accuracy. FinGPT's adapter was trained on that set's training split; FinBERT was not.
  B. this week's 60 real headlines on SPY, MU, AVGO, SNDK, XLV (Google News RSS, public) - no answer key, so we show the labels
     side by side and count agreement.
  usage: tone_trial.py finbert            (inside the scratch venv with transformers)
         tone_trial.py llm <label> <port> (any llama.cpp server)
Writes data/models/tone-<label>.json."""
import json, os, sys, csv, random, re, time, urllib.request
HERE = os.path.dirname(os.path.abspath(__file__)); OUT = os.path.join(HERE, "..", "data", "models")
MAP = {0: "negative", 1: "positive", 2: "neutral"}
def sets():
    rows = list(csv.DictReader(open(os.environ["TFNS_CSV"], encoding="utf-8"))); random.Random(7).shuffle(rows); A = []
    per = int(os.environ.get("TONE_PER_LABEL", "80"))   # a slower model can be given the first N of each label's 80
    for lab in (0, 1, 2): A += [{"text": r["text"], "gold": MAP[lab]} for r in rows if int(r["label"]) == lab][:per]
    H = json.load(open(os.path.join(OUT, "headlines.json"))); B = [{"symbol": s, "text": r["title"], "source": r["source"], "date": r["date"]} for s, L in H.items() for r in L]
    return A, B
def finish(label, A, B, secs, note=""):
    acc = sum(a["pred"] == a["gold"] for a in A) / len(A); per = {g: sum(a["pred"] == g for a in A if a["gold"] == g) / sum(a["gold"] == g for a in A) for g in MAP.values()}
    res = {"label": label, "note": note, "public_n": len(A), "public_accuracy": acc, "public_recall": per, "public_unparsed": sum(a["pred"] is None for a in A), "seconds": round(secs, 1),
           "headlines": B, "headline_counts": {s: {g: sum(1 for b in B if b["symbol"] == s and b["pred"] == g) for g in list(MAP.values())} for s in sorted({b["symbol"] for b in B})}}
    json.dump(res, open(os.path.join(OUT, f"tone-{label}.json"), "w"), indent=1); print(label, "accuracy", round(acc, 3), per, "unparsed", res["public_unparsed"], res["headline_counts"], f"{secs:.0f}s")
if sys.argv[1] == "finbert":
    from transformers import pipeline
    A, B = sets(); t0 = time.time(); clf = pipeline("text-classification", model="ProsusAI/finbert", device=-1)
    for X in (A, B):
        for x, p in zip(X, clf([x["text"] for x in X], truncation=True, batch_size=16)): x["pred"] = p["label"].lower(); x["score"] = round(float(p["score"]), 3)
    finish("finbert", A, B, time.time() - t0, "ProsusAI/finbert, 110M parameters, CPU")
elif sys.argv[1] == "fingpt-native":
    # FinGPT's own instruction format (from its model card), sent as raw text rather than as a chat turn
    label, port = sys.argv[2], int(sys.argv[3]); A, B = sets(); t0 = time.time()
    T = "Instruction: What is the sentiment of this news? Please choose an answer from {{negative/neutral/positive}}.\nInput: {}\nAnswer: "
    for X in (A, B):
        for x in X:
            req = urllib.request.Request(f"http://127.0.0.1:{port}/completion", data=json.dumps({"prompt": T.format(x["text"]), "n_predict": 6, "temperature": 0.0}).encode(), headers={"Content-Type": "application/json"})
            t = json.load(urllib.request.urlopen(req, timeout=300)).get("content", ""); m = re.search(r"(positive|negative|neutral)", t.lower()); x["pred"] = m.group(1) if m else None
    finish(label, A, B, time.time() - t0, "FinGPT's own instruction prompt, raw completion")
else:
    label, port = sys.argv[2], int(sys.argv[3]); A, B = sets(); t0 = time.time()
    P = "Classify the tone of this financial headline for the security it is about. Answer with exactly one word: positive, negative or neutral.\nHeadline: {}\nAnswer:"
    def ask(text, mt):
        req = urllib.request.Request(f"http://127.0.0.1:{port}/v1/chat/completions", data=json.dumps({"model": "local", "messages": [{"role": "user", "content": P.format(text)}], "temperature": 0.0, "max_tokens": mt}).encode(), headers={"Content-Type": "application/json"})
        t = json.load(urllib.request.urlopen(req, timeout=300))["choices"][0]["message"].get("content") or ""
        t = re.sub(r"<think>.*?</think>", "", t, flags=re.S); t = t.split("## Final Response")[-1] if "## Final Response" in t else ("" if t.strip().startswith("## Thinking") else t)
        m = re.search(r"\b(positive|negative|neutral|bullish|bearish)\b", t.lower()); return {"bullish": "positive", "bearish": "negative"}.get(m.group(1), m.group(1)) if m else None
    for X in (A, B):
        for x in X:
            first = int(os.environ.get("TONE_FIRST_TOKENS", "8")); x["pred"] = ask(x["text"], first)
            if x["pred"] is None and first < 400: x["pred"] = ask(x["text"], 500)
    finish(label, A, B, time.time() - t0)
