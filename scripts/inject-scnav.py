#!/usr/bin/env python3
"""Place (or refresh) the scnav BACK / CLOSE pair on every Hub sub-page.

The snippet lives in scripts/scnav-snippet.html. It goes right before </body>, between <!-- scnav · and <!-- /scnav -->,
so running this again replaces it in place. The Hub itself (index.html) is not a sub-page, the Indicator Lab is the
owner's and stays byte-identical, and pip.html / motion.html are opened as bare windows, not pages you navigate into.
prototypes/index.html is written by build-prototypes-index.py, which carries the same snippet itself.
"""
import pathlib, re, sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SNIPPET = (ROOT / "scripts" / "scnav-snippet.html").read_text().strip()
PAGES = [
    "allocation/index.html",
    "lab.html",
    "visual-engine/index.html",
    "xfeed/index.html",
    "fundamentals/index.html",
    "fundamentals/spec/index.html",
    "prototypes/report-library/index.html",
    "prototypes/dock-concept/index.html",
    "prototypes/previews/signal-fanout-v2.html",
] + sorted(str(p.relative_to(ROOT)) for p in (ROOT / "deliverables").rglob("*.html"))
BLOCK = re.compile(r"\n?<!-- scnav · .*?<!-- /scnav -->\n?", re.S)


def main():
    changed = 0
    for rel in PAGES:
        f = ROOT / rel
        html = f.read_text()
        if html.count("</body>") != 1:
            sys.exit(rel + ": expected exactly one </body>")
        new = BLOCK.sub("\n", html)
        new = new.replace("</body>", SNIPPET + "\n</body>", 1)
        if new != html:
            f.write_text(new)
            changed += 1
            print("placed", rel)
    print(changed, "of", len(PAGES), "pages changed")


if __name__ == "__main__":
    main()
