# lines.py (1 Nov 2026, coordinator). Runs in the local model's own Python. Reads [{"id","title","chapters":[...],"description"}] on stdin, prints {id: read} as the last line of stdout.
# The free local model writes the short read on a video nobody pulled a transcript for. Alan: "it seemed like ... just a raw extraction of the chapters", "put in open source models into these processes", and of the first version, "one sentence seems a little bit".
# No network after the model is cached, no key, no token bill. Tickers stay rule-based: brain.py rejects a read that names one the title, chapters and description do not.
import json, sys
from mlx_lm import load, generate
SYSTEM = ("You brief a professional trader on a finance or news video he has no time to watch, using only the title, chapter names and description given. "
          "Write two or three plain sentences, at most 60 words. First sentence: the main argument or the news. Then what else it covers, grouped in plain words, never a list of the chapters. "
          "Say what the speaker concludes if the material shows it. Ignore links, sponsors, discount codes and requests to subscribe. "
          "No hype, no 'this video', no invented names, tickers or numbers. If the material is thin, write one sentence and stop.")
rows = json.load(sys.stdin)
model, tok = load("mlx-community/Qwen2.5-7B-Instruct-4bit")
out = {}
for r in rows:
    text = "Title: " + r["title"]
    if r.get("chapters"): text += "\nChapters:\n" + "\n".join(r["chapters"])
    if r.get("description"): text += "\nDescription:\n" + r["description"]
    msg = [{"role": "system", "content": SYSTEM}, {"role": "user", "content": text}]
    out[r["id"]] = generate(model, tok, prompt=tok.apply_chat_template(msg, add_generation_prompt=True, tokenize=False), max_tokens=130).strip()
print(json.dumps(out))
