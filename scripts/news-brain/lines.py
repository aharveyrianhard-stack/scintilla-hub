# lines.py (1 Nov 2026, coordinator). Runs in the local model's own Python. Reads [{"id","title","chapters":[...]}] on stdin, prints {id: line} as the last line of stdout.
# The free local model writes one line on a light read, so a chapter list says something. Alan: "it seemed like ... just a raw extraction of the chapters" and "put in open source models into these processes".
# No network after the model is cached, no key, no token bill. Tickers stay rule-based: brain.py rejects a line that names one the title and chapters do not.
import json, sys
from mlx_lm import load, generate
SYSTEM = "You write one plain sentence, at most 22 words, saying what a finance or news video argues or covers, using only the title and chapter names given. Lead with the main point, not a list. No hype, no 'this video', no invented names, tickers or numbers."
rows = json.load(sys.stdin)
model, tok = load("mlx-community/Qwen2.5-7B-Instruct-4bit")
out = {}
for r in rows:
    msg = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": "Title: " + r["title"] + "\nChapters:\n" + "\n".join(r["chapters"])}]
    out[r["id"]] = generate(model, tok, prompt=tok.apply_chat_template(msg, add_generation_prompt=True, tokenize=False), max_tokens=70).strip()
print(json.dumps(out))
