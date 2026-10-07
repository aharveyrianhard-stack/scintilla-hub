#!/usr/bin/env python3
"""HM2 — put the macro block into index.html (and take it out again).

   python3 deliverables/20261007/hm2-macro/tools/inject-hm2.py          # inject (safe to run twice)
   python3 deliverables/20261007/hm2-macro/tools/inject-hm2.py --remove # the page exactly as it was

The block and its stylesheet live beside this file (hm2-block.js, hm2-style.css). One-line hooks connect them
to the page (eight of them, each reading the switch as `typeof HM2_ON !== "undefined" && HM2_ON`, so a context
that does not carry the block draws the room exactly as before); each is anchored on a line that exists once, and the script stops rather than guess when one is missing
(a release that moved an anchor is a merge to do by hand, not something to paper over). After a merge that touches
index.html, run --remove on the merged file, then inject again, then build-trial.py."""
import re, sys, pathlib
ROOT = pathlib.Path(__file__).resolve().parents[4]
HERE = pathlib.Path(__file__).resolve().parent
page = ROOT / "index.html"
src = page.read_text(encoding="utf-8")
STYLE_OPEN, STYLE_CLOSE = '<style id="hm2-macro-20261007">\n', "</style>\n"
BLOCK_END = "/* ==== END HM2 ============================================================== */\n"
block = (HERE / "hm2-block.js").read_text(encoding="utf-8")
css = (HERE / "hm2-style.css").read_text(encoding="utf-8")
assert block.endswith(BLOCK_END), "hm2-block.js must end with its END line"
BLOCK_START = block[: block.index("\n") + 1]

# (anchor that exists exactly once, the line this lane adds, where: "before" | "after" | "replace")
OLD_CARDS = ("      '<div class=\"card\"><h4>Treasury curve</h4><div class=\"sc-senttxt\" id=\"econCurve\">—</div></div>' +\n"
             "      '<div class=\"card\" id=\"econLadder\"><h4>UST ladder</h4><div class=\"sc-senttxt\">—</div></div>' +\n")
NEW_CARDS = ("      /* HM2 — the curve as a picture, the auctions and the surprise strips stand where the one-line curve and the\n"
             "         UST ladder stood; with HM2_ON = false (or the HM2 block not loaded) the two original cards below are what is drawn. */\n"
             "      (typeof HM2_ON !== \"undefined\" && HM2_ON ? hm2RailCardsHTML() :\n"
             "      '<div class=\"card\"><h4>Treasury curve</h4><div class=\"sc-senttxt\" id=\"econCurve\">—</div></div>' +\n"
             "      '<div class=\"card\" id=\"econLadder\"><h4>UST ladder</h4><div class=\"sc-senttxt\">—</div></div>') +\n")
HOOKS = [
    ("      /* M55 — THE ROOM CARRIES THE SAME QUEUE THE TOP TAPE CARRIES. Alan: \"this thing is telling me\n",
     "      (typeof HM2_ON !== \"undefined\" && HM2_ON ? '<div id=\"hm2EcTape\"></div>' : \"\") +   /* HM2 — the left-to-right slider, under the day bar as in EARNINGS */\n", "before"),
    ("    '<div class=\"panel\"><div class=\"sc-plabel sc-plabel--row\"><span>macro rail · <b>stored prints</b></span>' + SECFS_BTN + '</div><div class=\"rail\">' +\n",
     "      (typeof HM2_ON !== \"undefined\" && HM2_ON ? '<div class=\"card hm2-card hm2-ev\" id=\"hm2Event\"></div>' : \"\") +   /* HM2 — the event card: empty (and taking no room) until a release is happening or is clicked */\n", "after"),
    (OLD_CARDS, NEW_CARDS, "replace"),
    ("    \"</div></div></div>\";\n}\n/* R52b — the REGION tabs carry their counts for the day on screen, exactly as the\n",
     "      (typeof HM2_ON !== \"undefined\" && HM2_ON ? HM2_SPECS : \"\") +   /* HM2 — the rules, at the bottom of the rail */\n", "before"),
    ("  await Promise.all([ecLoadWindow(), fillEconRail()]);\n",
     "  try { hm2Mount(); } catch (_) {}   /* HM2 — the slider, the curve, the auctions and the strips; NOT awaited: the room's own mount never waits on them */\n", "before"),
    ("function renderEconTable() {\n",
     "  try { hm2EcTapePaint(); } catch (_) {}   /* HM2 — the slider follows every filter the table follows */\n", "after"),
    ("    (SCINT_FEED_ON ? '<div class=\"sc-scintstrip\" id=\"scintStrip\"></div>' : \"\") +\n",
     "    (typeof HM2_ON !== \"undefined\" && HM2_ON && HM2_PC_ON ? '<div class=\"sc-scintstrip\" id=\"hm2PcStrip\"></div>' : \"\") +   /* HM2 — the put/call tape, under TODAY'S SCINTILLAS */\n", "after"),
    ("    try { scintStripRender(); boardScintPass(); } catch (_) {}   /* M42 — the strip and the outlier marks on a fresh mount */\n",
     "    try { hm2PcFill(); hm2PcArm(); } catch (_) {}   /* HM2 — the put/call tape on a fresh mount */\n", "after"),
]
# The block goes just ABOVE the economic room's own module (Room 9 … Room 9b), never inside it: that module is pinned to
# three tables, two calendar reads and no fetch (tests/economic-port, economic-review), and those stay true of it.
JS_ANCHOR = "/* ---- Room 9 · ECONOMIC (wired: treasury_rates curve + econ_history latest prints) */\n"

def remove(s):
    i = s.find(STYLE_OPEN)
    if i >= 0:
        j = s.index(STYLE_CLOSE, i) + len(STYLE_CLOSE); s = s[:i] + s[j:]
    i = s.find(BLOCK_START)
    if i >= 0:
        j = s.index(BLOCK_END, i) + len(BLOCK_END); s = s[:i] + s[j:]
    for anchor, add, how in HOOKS:
        if how == "replace":
            if add in s: s = s.replace(add, anchor, 1)
        elif add in s: s = s.replace(add, "", 1)
    return s

def inject(s):
    s = remove(s)
    for anchor, add, how in HOOKS:
        n = s.count(anchor)
        if n != 1: sys.exit("HM2 inject: the anchor is on the page %d times, expected once:\n  %s" % (n, anchor.strip()[:110]))
        s = s.replace(anchor, add + anchor if how == "before" else anchor + add if how == "after" else add, 1)
    for anchor in ("</head>\n", JS_ANCHOR):
        if s.count(anchor) != 1: sys.exit("HM2 inject: expected exactly one of: " + anchor.strip()[:80])
    s = s.replace("</head>\n", STYLE_OPEN + css + STYLE_CLOSE + "</head>\n", 1)
    return s.replace(JS_ANCHOR, block + JS_ANCHOR, 1)

out = remove(src) if "--remove" in sys.argv else inject(src)
if out != src: page.write_text(out, encoding="utf-8")
print("HM2 %s: index.html %d -> %d bytes%s" % ("removed" if "--remove" in sys.argv else "injected", len(src.encode()), len(out.encode()), "" if out != src else " (no change)"))
