#!/usr/bin/env python3
"""R3 — the trial copy of the company view. preview/company-view/index.html = this branch's index.html with exactly two
additions: <base href="/"> (+ a note) right after <head>, so every relative asset and /api path resolves from the site root,
and a fixed TRIAL banner right before </body>. Nothing else differs (tests/hub-company-view-r3.test.mjs checks that).
Run from the repo root:  python3 deliverables/20260927/company-view-r3/tools/build-trial.py"""
import pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[4]
src = (root / "index.html").read_text()
sha = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip() or "?"
HEAD = ('<base href="/">\n<!-- TRIAL COPY (27 Sep): company view round 3 (R3, candidate/company-view-r3-20260927, built from ' + sha +
        ') served beside the live Hub for Alan to try. The live page at / is unchanged. -->\n')
BANNER = ('<div id="trialBanner" style="position:fixed;left:50%;transform:translateX(-50%);bottom:10px;z-index:100000;background:#1E1E23;'
          'border:1px solid #8A8A92;color:#D2D2D2;font:600 12px/1.4 ui-monospace,Menlo,monospace;letter-spacing:.08em;padding:6px 14px;'
          'border-radius:4px;pointer-events:none">TRIAL · company view round 3 · click any name · the live Hub is unchanged</div>\n')
assert src.count("<head>\n") == 1 and src.count("</body>") == 1
out = src.replace("<head>\n", "<head>\n" + HEAD, 1).replace("</body>", BANNER + "</body>", 1)
dst = root / "preview" / "company-view" / "index.html"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(out)
print(dst.relative_to(root), len(out), "bytes, from", sha)
