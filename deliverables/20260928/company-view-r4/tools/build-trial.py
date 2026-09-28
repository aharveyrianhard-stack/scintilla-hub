#!/usr/bin/env python3
"""R4 — the trial copy of the company view (round 4). preview/company-view/index.html = this branch's index.html with exactly two
additions: <base href="/"> (+ a note) right after <head>, so every relative asset and /api path resolves from the site root,
and a fixed TRIAL banner right before </body>. Nothing else differs (tests/hub-company-view-r3.test.mjs checks that).
Run from the repo root:  python3 deliverables/20260928/company-view-r4/tools/build-trial.py"""
import pathlib, subprocess
root = pathlib.Path(__file__).resolve().parents[4]
src = (root / "index.html").read_text()
sha = subprocess.run(["git", "-C", str(root), "rev-parse", "--short", "HEAD"], capture_output=True, text=True).stdout.strip() or "?"
HEAD = ('<base href="/">\n<!-- TRIAL COPY (28 Sep): company view round 4 (R4, candidate/company-view-r4-20260928, built from ' + sha +
        ') served beside the live Hub for Alan to try. The live page at / is unchanged. -->\n')
# Review fix (28 Sep): the fixed box sat over the page — on a phone it wrapped to four lines over the board's LAST/CHG/RSI cells,
# and at 1680 it covered the bottom board rows and the SOCIAL counts. It is now one line IN THE PAGE FLOW at the top of the
# body's column (order:-1), so it covers nothing at any width; at 900px and below the long wording is dropped.
BANNER = ('<div id="trialBanner" style="order:-1;flex:0 0 auto;align-self:flex-start;max-width:100%;overflow:hidden;white-space:nowrap;'
          'margin:0 0 6px;background:#1E1E23;border:1px solid #8A8A92;color:#D2D2D2;font:600 11px/1.4 ui-monospace,Menlo,monospace;'
          'letter-spacing:.08em;padding:2px 10px;border-radius:4px;pointer-events:none">'
          '<style>@media(max-width:900px){#trialBanner{font-size:10px!important;padding:2px 8px!important}#trialBanner .tb-x{display:none}}</style>'
          'TRIAL · company view round 4<span class="tb-x"> · click any name · the live Hub is unchanged</span></div>\n')
assert src.count("<head>\n") == 1 and src.count("</body>") == 1
out = src.replace("<head>\n", "<head>\n" + HEAD, 1).replace("</body>", BANNER + "</body>", 1)
dst = root / "preview" / "company-view" / "index.html"
dst.parent.mkdir(parents=True, exist_ok=True)
dst.write_text(out)
print(dst.relative_to(root), len(out), "bytes, from", sha)
