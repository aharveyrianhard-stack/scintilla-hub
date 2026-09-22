#!/usr/bin/env python3
"""Build prototypes/index.html from prototypes/catalog.json.

The review home is GENERATED, not hand-edited, so the page and the catalog can
never drift apart - that drift is what left stale and dead entries on the page.
Edit catalog.json, run this, and commit both. tests/prototypes-catalogue.test.mjs
pins the result and enforces the rules the page promises: truthful readiness
labels, a monochrome palette with no white, and no destination without a way back.

    python3 scripts/build-prototypes-index.py
"""
import json, os

# repo root, resolved from this file - no machine-specific path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, "prototypes", "catalog.json")
OUT = os.path.join(ROOT, "prototypes", "index.html")

cat = json.load(open(CAT))

READINESS = {
    "Existing tool": "existing",
    "Existing preview": "preview",
    "Recovered local preview": "sample",
    "Concept study": "sample",
    "Review home": "review",
    "Latest artifact pending": "pending",
    "Recovery in progress": "pending",
}
BADGE = {"existing": "Existing tool", "preview": "Preview", "sample": "Sample data",
         "review": "Review home", "pending": "Pending"}

# purpose group for each title, and the icon that MEANS the tool
PURPOSE = {
    "Economic events": "markets", "Sector rotation": "markets",
    "Indicator Lab": "signals", "Cohort Geiger": "signals", "Context Lens · v4": "signals",
    "Allocation & DCF": "portfolio",
    "Scintilla Desk": "workspaces",
    "Visual Engine workbench": "visual", "Visual Engine Lab": "visual",
    "Geiger motion": "visual", "Charts in motion": "visual", "Widget registry": "visual",
    "Station dock concept": "visual", "Signal fanout · v2": "visual", "Visual menus": "visual",
}

# one stroke family: 24x24, fill:none, stroke:currentColor, round caps
ICON = {
 "Economic events":        '<rect x="3.5" y="5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M8 3.5v3M16 3.5v3M7 13h3M7 16.5h6"/>',
 "Sector rotation":        '<path d="M20 12a8 8 0 0 1-8 8M4 12a8 8 0 0 1 8-8"/><path d="M17.5 8.5V12H21M6.5 15.5V12H3"/><circle cx="12" cy="12" r="2"/>',
 "Indicator Lab":          '<path d="M10 3.5v6L5 19a1.6 1.6 0 0 0 1.4 2.4h11.2A1.6 1.6 0 0 0 19 19l-5-9.5v-6"/><path d="M8.5 3.5h7M7.6 14.5h8.8"/>',
 "Cohort Geiger":          '<path d="M3.5 19h17"/><path d="M6.5 19v-4M10.2 19v-8M13.8 19v-5.5M17.5 19v-11"/>',
 "Context Lens · v4":      '<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.4 15.4 21 21"/><path d="M8 10.5h5M10.5 8v5"/>',
 "Allocation & DCF":      '<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5v8.5l6 6"/><path d="M12 12 4.6 8.6"/>',
 "Scintilla Desk":         '<rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9.5h17M11 9.5v10"/>',
 "Visual Engine workbench":'<path d="M5 4.5v15M12 4.5v15M19 4.5v15"/><circle cx="5" cy="9.5" r="2.1"/><circle cx="12" cy="14.5" r="2.1"/><circle cx="19" cy="8" r="2.1"/>',
 "Visual Engine Lab":      '<path d="M2.5 12h3l2.2-6 3.2 12 3-9 2.1 3h5.5"/>',
 "Geiger motion":          '<path d="M4 7h9M4 12h13M4 17h6"/><path d="M17.5 4.5 21 8l-3.5 3.5M13.5 20.5 10 17l3.5-3.5"/>',
 "Charts in motion":       '<path d="M3.5 19.5V4.5M3.5 19.5h17"/><path d="M6.5 15.5l3.5-4.5 3 2.5 4.5-6.5"/><circle cx="17.5" cy="7" r="1.6"/>',
 "Widget registry":        '<rect x="3.5" y="3.5" width="7" height="7" rx="1"/><rect x="13.5" y="3.5" width="7" height="7" rx="1"/><rect x="3.5" y="13.5" width="7" height="7" rx="1"/><rect x="13.5" y="13.5" width="7" height="7" rx="1"/>',
 "Station dock concept":   '<rect x="2.5" y="8.5" width="19" height="7" rx="2"/><path d="M6.5 10.5v3M10 9.8v4.4M14 9.8v4.4M17.5 10.5v3"/>',
 "Signal fanout · v2":     '<circle cx="5" cy="12" r="2"/><path d="M7 11.4 17 6.5M7 12h10M7 12.6 17 17.5"/><circle cx="18.5" cy="6" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/><circle cx="18.5" cy="18" r="1.6"/>',
 "Visual menus":           '<path d="M4 6.5h16M4 12h16M4 17.5h10"/>',
}

HOST = {
 "Indicator Lab": "this site · kept by its owner",
 "Economic events": "scintilla-economic-tab.vercel.app",
 "Sector rotation": "sectorrotation.scintillahub.ai",
 "Allocation & DCF": "allocation.scintillahub.ai",
 "Scintilla Desk": "scintilla-desk.vercel.app",
 "Visual Engine workbench": "this site · /visual-engine/",
 "Visual Engine Lab": "this site · /lab.html",
 "Geiger motion": "scintilla-widgets.vercel.app",
 "Charts in motion": "scintilla-widgets.vercel.app",
 "Widget registry": "scintilla-widgets.vercel.app",
 "Cohort Geiger": "scintilla-widgets.vercel.app",
 "Station dock concept": "this site · /prototypes/",
 "Signal fanout · v2": "this site · /prototypes/",
 "Context Lens · v4": "Scintilla prototype · not recovered yet",
 "Visual menus": "not available yet",
}

# the Indicator Lab card keeps its owner's second sentence verbatim
EXTRA_DESC = {"Indicator Lab": " A home for the work, without keeping every chart open."}

GROUPS = [
 ("markets",    "Markets &amp; macro",      "Read the calendar and where money is rotating."),
 ("signals",    "Signals &amp; context",    "Build, check and read the signals and context behind the board."),
 ("portfolio",  "Portfolio &amp; valuation","Size positions and value companies."),
 ("workspaces", "Workspaces",               "Desks that gather several views in one place."),
 ("visual",     "Visual experiments",       "Motion, chart and widget studies for the Hub and Station."),
]

def esc(s):
    return s.replace('&', '&amp;')

def card(e):
    t = e["title"]; r = READINESS[e["status"]]; p = PURPOSE[t]
    desc = e["description"] + EXTRA_DESC.get(t, "")
    ico = '<span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24">%s</svg></span>' % ICON[t]
    meta = '<div class="meta"><span class="rd %s">%s</span><span class="host">%s</span></div>' % (r, BADGE[r], HOST[t])
    if e.get("url"):
        ext = e["url"].startswith("http")
        tgt = ' target="_blank" rel="noopener"' if ext else ""
        go = "↗" if ext else "→"
        face = ('<a class="face" href="%s"%s>%s<span class="txt"><h4>%s</h4><p>%s</p></span>'
                '<span class="go" aria-hidden="true">%s</span></a>') % (e["url"], tgt, ico, esc(t), desc, go)
        rel = e.get("related") or []
        links = ""
        if rel:
            links = '<div class="links">' + "".join(
                '<a class="secondary" href="%s" target="_blank" rel="noopener">%s</a>' % (x["url"], x["label"]) for x in rel
            ) + "</div>"
        exitline = ('<p class="exit">Opens in a new tab — this page stays where it is.</p>' if ext
                    else '<p class="exit">Opens here, and carries a link back to this page.</p>')
        body = face + links + exitline
    else:
        body = ('<div class="face is-pending">%s<span class="txt"><h4>%s</h4><p>%s</p></span></div>'
                '<div class="links"><span class="pending">%s</span></div>') % (ico, esc(t), desc, e["status"])
    return '<article data-purpose="%s" data-readiness="%s">%s%s</article>' % (p, r, meta, body)

# ---- counts, stated honestly -------------------------------------------------
counts = {}
for e in cat:
    r = READINESS[e["status"]]
    counts[r] = counts.get(r, 0) + 1
linked = sum(1 for e in cat if e.get("url"))
named = len(cat) - linked

LEGEND_TEXT = {
 "existing": "separate apps at their own addresses. They exist and answered when last checked; whether they work correctly is not verified here.",
 "preview":  "existing review builds and studies at their own addresses; not wired into the dashboard.",
 "sample":   "design studies that run on sample values, not live market data.",
 "review":   "a home kept by its owner; its contents are the owner's to change.",
 "pending":  "named here, not linked, until the artifact is recovered.",
}
legend = "".join('<li><b class="rd %s">%s</b>%d · %s</li>' % (r, BADGE[r], counts[r], LEGEND_TEXT[r])
                 for r in ["existing", "preview", "sample", "review", "pending"] if r in counts)

groups_html = ""
for key, name, sub in GROUPS:
    cards = "".join(card(e) for e in cat if PURPOSE[e["title"]] == key)
    groups_html += ('<section class="grp" data-purpose="%s"><div class="gh"><h3 class="gt">%s</h3><p>%s</p></div>'
                    '<div class="grid">\n%s\n</div></section>\n') % (key, name, sub, cards)

CSS = """
:root{color-scheme:dark;
/* surfaces */
--bg:#0A0A0F;--panel:#0D0D14;--panel2:#111120;--line:#1A1A2A;--line2:#252538;
--hair:rgba(0,212,255,.16);--hair2:rgba(0,212,255,.34);
/* ink - one neutral ramp, deliberately capped well below white. House rule:
   monochrome, no white and no near-white. The palette test enforces the cap. */
--ink:#B4BACB;--ink2:#949BB0;--ink3:#767D93;--dim:#5C6379;--mute:#3A3A52;
/* one accent hue. Readiness is TONE (this hue) x OPACITY (how ready it is) -
   never a second colour. */
--crk:#00D4FF;--c90:rgba(0,212,255,.90);--c62:rgba(0,212,255,.62);
--c40:rgba(0,212,255,.40);--c22:rgba(0,212,255,.22);
--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif;
font:14px/1.6 var(--sans);color:var(--ink2);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}body{margin:0;background:var(--bg)}
.wrap{max-width:1160px;margin:auto;padding:22px 28px 40px}
a{color:var(--crk);text-decoration:none}a:hover{color:var(--ink)}
a:focus-visible,button:focus-visible{outline:1px solid var(--crk);outline-offset:3px}
header{display:flex;justify-content:space-between;align-items:center;gap:16px;min-height:58px;padding:0 18px;border:1px solid var(--hair);background:var(--panel)}
.brand{font:600 17px/1 var(--mono);letter-spacing:.62em;color:var(--ink);text-shadow:0 0 18px rgba(0,212,255,.25)}
.hlinks{display:flex;gap:10px;font:9px/1 var(--mono);letter-spacing:.24em;text-transform:uppercase}
.hlinks a{border:1px solid var(--line2);padding:8px 12px;color:var(--ink3);background:var(--bg)}
.hlinks a:hover{color:var(--crk);border-color:var(--hair2)}
h1{font:600 12px/1.4 var(--mono);letter-spacing:.34em;text-transform:uppercase;color:var(--ink);margin:30px 0 10px}
.lede{max-width:760px;color:var(--ink3);margin:0 0 8px;font-size:13px}
.k{font:8px/1.4 var(--mono);letter-spacing:.26em;text-transform:uppercase;color:var(--crk)}
/* start here - the two or three things most worth opening, like a front door */
.start{display:flex;gap:8px;flex-wrap:wrap;margin:18px 0 0}
.start a{display:flex;align-items:center;gap:10px;border:1px solid var(--line2);background:var(--panel);padding:11px 15px;color:var(--ink2);font:600 11px/1 var(--mono);letter-spacing:.14em;text-transform:uppercase}
.start a:hover{border-color:var(--hair2);color:var(--crk);background:var(--panel2)}
.start a .sgo{color:var(--c62)}
.stats{display:flex;gap:8px;flex-wrap:wrap;margin:14px 0 0}
.stat{border:1px solid var(--line);background:var(--panel);padding:9px 14px;min-width:96px}
.stat b{display:block;font:600 17px/1.2 var(--mono);color:var(--ink)}
.stat span{font:8px/1.5 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--dim)}
.filters{display:flex;gap:6px;flex-wrap:wrap;margin:22px 0 6px}
.filters button{font:9px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;border:1px solid var(--line2);border-radius:0;padding:8px 13px;background:var(--bg);color:var(--ink3);cursor:pointer}
.filters button:hover{color:var(--ink);border-color:var(--hair2)}
.filters button[aria-pressed=true]{color:var(--crk);border-color:var(--crk);box-shadow:inset 0 -2px 0 var(--crk)}
section.grp{margin-top:24px}section.grp[hidden]{display:none}
.gh{display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;margin:0 0 10px}
h2{font:600 11px/1.4 var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--ink);margin:0}
.gh p{margin:0;font-size:12px;color:var(--dim)}
.grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px}
article,.sysitem{display:flex;flex-direction:column;background:var(--panel);border:1px solid var(--line);padding:14px 16px 12px;min-height:164px}
article:hover{background:var(--panel2);border-color:var(--hair2)}
.meta{display:flex;justify-content:space-between;gap:10px;align-items:baseline}
/* readiness: one hue, four opacities, then a dashed outline for "not here yet" */
.rd{font:8px/1.4 var(--mono);letter-spacing:.2em;text-transform:uppercase;padding:2px 6px;border:1px solid var(--line2);color:var(--ink3);white-space:nowrap}
.rd.existing{color:var(--c90);border-color:var(--c40)}
.rd.review{color:var(--c62);border-color:var(--c40)}
.rd.preview{color:var(--c62);border-color:var(--c22)}
.rd.sample{color:var(--c40);border-color:var(--c22)}
.rd.pending{color:var(--dim);border-style:dashed}
.rd.live{color:var(--c90);border-color:var(--c40)}.rd.note{color:var(--dim)}
.host{font:8px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
h3.gt{font:600 11px/1.4 var(--mono);letter-spacing:.3em;text-transform:uppercase;color:var(--ink);margin:0}
/* the whole card is the target - icon, what it is, what it does, and an arrow */
.face{display:flex;align-items:flex-start;gap:12px;margin:12px 0 0;flex:1;color:inherit}
.face .ico{flex:0 0 auto;width:26px;height:26px;color:var(--c62)}
.face:hover .ico{color:var(--crk)}
.face .ico svg{width:26px;height:26px;display:block;stroke:currentColor;fill:none;stroke-width:1.5;stroke-linecap:round;stroke-linejoin:round}
.face .txt{flex:1 1 auto;min-width:0}
.face .go{flex:0 0 auto;color:var(--c40);font-size:15px;line-height:1}
.face:hover .go{color:var(--crk)}
.face.is-pending{opacity:.62}.face.is-pending .ico{color:var(--mute)}
article h4,.sysitem h4{font:600 12.5px/1.35 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink);margin:0 0 6px}
.face:hover h4{color:var(--crk)}
article p,.sysitem p{font-size:12.5px;color:var(--ink3);margin:0}.note{color:var(--dim)}
.exit{margin:10px 0 0!important;font:8px/1.5 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)!important}
.links{display:flex;flex-wrap:wrap;gap:12px;margin-top:10px;font:9px/1.4 var(--mono);letter-spacing:.18em;text-transform:uppercase}
.secondary{color:var(--ink3);border-bottom:1px solid var(--line2)}.secondary:hover{color:var(--ink)}
.pending{color:var(--ink3)}
.sysitem{min-height:0}
.sysitem .face{margin-top:10px}
footer{border-top:1px solid var(--line);margin-top:30px;padding-top:16px;color:var(--dim);font:9px/1.6 var(--mono);letter-spacing:.14em;text-transform:uppercase}
nav.pn{display:flex;gap:4px;flex-wrap:wrap;margin:14px 0 0}
nav.pn a{font:9px/1 var(--mono);letter-spacing:.22em;text-transform:uppercase;color:var(--ink3);border:1px solid var(--line2);padding:8px 12px;background:var(--bg)}
nav.pn a:hover{color:var(--crk);border-color:var(--hair2)}
section.part{margin-top:32px;scroll-margin-top:16px}
h2.pt{font:600 12px/1.4 var(--mono);letter-spacing:.34em;text-transform:uppercase;color:var(--ink);margin:0 0 12px;padding-bottom:8px;border-bottom:1px solid var(--line)}
.two{display:grid;grid-template-columns:1fr 1fr;gap:10px}.two>div{background:var(--panel);border:1px solid var(--line);padding:16px 20px}
.two ul,.spec ul{margin:8px 0 0;padding:0;list-style:none}.two li{font-size:12px;color:var(--ink3);padding:6px 0;border-top:1px solid var(--line)}.two li:first-child{border-top:0}
.two li b{font:600 9px/1.4 var(--mono);letter-spacing:.16em;text-transform:uppercase;margin-right:8px}
.signin{font:8px/1.4 var(--mono);letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-left:6px}
dl.spec{display:grid;grid-template-columns:180px 1fr;margin:0;border:1px solid var(--line);background:var(--panel)}
dl.spec dt{font:600 9px/1.5 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--crk);padding:12px 16px;border-top:1px solid var(--line)}
dl.spec dd{margin:0;padding:12px 16px;font-size:12.5px;color:var(--ink3);border-top:1px solid var(--line)}
dl.spec dt:first-of-type,dl.spec dd:first-of-type{border-top:0}
table.arch{width:100%;border-collapse:collapse;background:var(--panel);border:1px solid var(--line);font-size:12.5px}
table.arch th{font:600 9px/1.5 var(--mono);letter-spacing:.2em;text-transform:uppercase;color:var(--crk);text-align:left;padding:10px 14px;border-bottom:1px solid var(--line)}
table.arch td{padding:10px 14px;color:var(--ink3);border-top:1px solid var(--line);vertical-align:top}
table.arch td:first-child{font:11px/1.5 var(--mono);color:var(--ink2);white-space:nowrap}
@media(max-width:980px){.grid{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media(max-width:850px){.two{grid-template-columns:1fr}dl.spec{grid-template-columns:1fr}dl.spec dd{border-top:0;padding-top:0}table.arch td:first-child{white-space:normal}}
@media(max-width:620px){.wrap{padding:14px 14px 30px}.grid{grid-template-columns:1fr}article{min-height:0}.brand{letter-spacing:.44em;font-size:14px}header{padding:12px 14px;flex-wrap:wrap}h1{margin-top:24px}.start a{flex:1 1 100%}}
@media(max-width:560px){table.arch thead{display:none}table.arch tr{display:block;border-top:1px solid var(--line);padding:8px 0}table.arch tbody tr:first-child{border-top:0}table.arch td{display:block;border-top:0;padding:2px 14px}table.arch td:first-child{overflow-wrap:anywhere}table.arch td:last-child::before{content:"Kept by: ";color:var(--dim)}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
"""

SYSTEMS = """<section class="grp" data-purpose="systems"><div class="gh"><h3 class="gt">Systems</h3><p>The live products this work feeds, and where files are kept.</p></div><div class="grid">
<div class="sysitem"><div class="meta"><span class="rd live">Live product</span><span class="host">scintillahub.ai</span></div><a class="face" href="https://scintillahub.ai/" target="_blank" rel="noopener"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9h17M7.5 12.5h4M7.5 16h9M15 12.5h1.5"/></svg></span><span class="txt"><h4>Hub</h4><p>The dashboard: board, company pages, news, events, economic room.</p></span><span class="go" aria-hidden="true">↗</span></a><p class="exit">Opens in a new tab — this page stays where it is.</p></div>
<div class="sysitem"><div class="meta"><span class="rd live">Live product</span><span class="host">station.scintillahub.ai</span></div><a class="face" href="https://station.scintillahub.ai/" target="_blank" rel="noopener"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20M6 8.5h5M6 12h3M14 8.5h4M14 12h4"/></svg></span><span class="txt"><h4>Station</h4><p>The display wall: charts, video panes and the X pane.</p></span><span class="go" aria-hidden="true">↗</span></a><p class="exit">Opens in a new tab — this page stays where it is.</p></div>
<div class="sysitem"><div class="meta"><span class="rd note">In the Hub</span><span class="host">no separate address</span></div><div class="face"><span class="ico" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg></span><span class="txt"><h4>Files</h4><p>Files are kept inside the Hub, not on this page. Open the Hub, then the SCINTILLA logo menu, then Files.</p></span></div><div class="links"><span class="note">Hub → Scintilla menu → Files</span></div></div>
</div></section>"""

HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SCINTILLA · Prototypes</title><style>%(css)s</style></head><body><div class="wrap">
<header><span class="brand">SCINTILLA</span><nav class="hlinks" aria-label="Live products"><a href="https://scintillahub.ai/" target="_blank" rel="noopener">Hub ↗</a><a href="https://station.scintillahub.ai/" target="_blank" rel="noopener">Station ↗</a></nav></header>
<nav class="pn" aria-label="Page sections"><a href="#overview">Overview</a><a href="#tools">Tools</a><a href="#review">Review</a><a href="#work">Work</a><a href="#architecture">Architecture</a><a href="#page-spec">Page spec</a></nav>
<main>
<section class="part" id="overview"><h1>Prototypes &amp; review</h1>
<p class="lede">One front door to everything being built and reviewed around the Hub. Each entry says in plain words what it is, what it does, and how ready it is — and every one of them either opens in a new tab or carries a link back here, so you are never stuck on a page with no way out.</p>
<p class="k">Nothing here is part of the dashboard unless it says so. Inclusion does not establish current data, working function or production readiness.</p>
<div class="start">
<a href="/visual-engine/"><span class="sgo">→</span>Visual Engine workbench</a>
<a href="https://scintilla-widgets.vercel.app/visuals/geiger-motion" target="_blank" rel="noopener"><span class="sgo">↗</span>Geiger motion</a>
<a href="/prototypes/dock-concept/"><span class="sgo">→</span>Station dock concept</a>
<a href="/prototypes/indicator-lab/"><span class="sgo">→</span>Indicator Lab</a>
</div>
<div class="stats">
<div class="stat"><b>%(total)d</b><span>listed</span></div>
<div class="stat"><b>%(linked)d</b><span>open now</span></div>
<div class="stat"><b>%(named)d</b><span>named, not built</span></div>
<div class="stat"><b>%(same)d</b><span>on this site</span></div>
</div>
</section>

<section class="part" id="tools"><h2 class="pt">Tools</h2>
<div class="filters" role="group" aria-label="Filter by purpose"><button type="button" aria-pressed="true" data-filter="all">All</button><button type="button" aria-pressed="false" data-filter="markets">Markets &amp; macro</button><button type="button" aria-pressed="false" data-filter="signals">Signals &amp; context</button><button type="button" aria-pressed="false" data-filter="portfolio">Portfolio &amp; valuation</button><button type="button" aria-pressed="false" data-filter="workspaces">Workspaces</button><button type="button" aria-pressed="false" data-filter="visual">Visual experiments</button><button type="button" aria-pressed="false" data-filter="systems">Systems</button></div>
%(groups)s%(systems)s
</section>

<section class="part" id="review"><h2 class="pt">Review</h2><div class="two">
<div><span class="k">What the labels mean</span><ul>
%(legend)s</ul></div>
<div><span class="k">Checks and review</span><ul>
<li>22 Sep, 21:0x UTC: every linked destination on this page was requested and answered HTTP 200. That is a reachability check, not a function check.</li>
<li>Same check: two Hub pages that are not listed here — geigers.html and curve-ab.html — answered 404 and are deliberately absent rather than listed dead.</li>
<li>Every destination was also opened and read for a way back. Pages on this site carry one; pages on other addresses open in a new tab instead.</li>
<li>Review notes and decisions: <a href="https://app.notion.com/p/3e096edf91af816aa966eb2fe07ec9c5?pvs=204" target="_blank" rel="noopener">Scintilla review ↗</a><span class="signin">sign-in required</span></li>
</ul></div>
</div></section>

<section class="part" id="work"><h2 class="pt">Work</h2><div class="two">
<div><span class="k">Assigned work</span><ul>
<li><a href="https://linear.app/aharvey-scintilla/issue/SCI-11/restore-scintilla-hub-and-station-to-working-screens" target="_blank" rel="noopener">SCI-11 · Restore Hub and Station ↗</a><span class="signin">sign-in required</span> — restoring trustworthy Hub and Station screens.</li>
<li><a href="https://linear.app/aharvey-scintilla/issue/SCI-10/context-lens-reconcile-latest-version-and-hosted-prototype" target="_blank" rel="noopener">SCI-10 · Context Lens ↗</a><span class="signin">sign-in required</span> — recover and verify the latest version before it is hosted here.</li>
<li><a href="https://linear.app/aharvey-scintilla/issue/SCI-28/station-indicator-lab-clouds-on-every-chart-apple-dock-top-controls" target="_blank" rel="noopener">SCI-28 · Station dock ↗</a><span class="signin">sign-in required</span> — the work the dock concept on this page belongs to.</li>
</ul></div>
<div><span class="k">How work reaches this page</span><ul>
<li>A tool is listed once it has an address that answers; its label changes only with evidence.</li>
<li>New entries go into catalog.json and this page together; the page is generated from the catalog and the test fails if they disagree.</li>
<li>Every listed destination must have a way back or open in a new tab; the test fails if one does not.</li>
<li>The work items are the source of status; this page does not mirror them.</li>
</ul></div>
</div></section>

<section class="part" id="architecture"><h2 class="pt">Architecture</h2>
<table class="arch"><thead><tr><th>Address</th><th>What lives there</th><th>Kept by</th></tr></thead><tbody>
<tr><td>scintillahub.ai</td><td>The Hub, this home (/prototypes/), the Visual Engine workbench (/visual-engine/), the visual-engine lab (/lab.html), the Station dock concept (/prototypes/dock-concept/) and the Indicator Lab home (/prototypes/indicator-lab/)</td><td>Scintilla; the Indicator Lab home is kept independently by Indicator Lab</td></tr>
<tr><td>station.scintillahub.ai</td><td>Station, the display wall</td><td>Scintilla</td></tr>
<tr><td>sectorrotation.scintillahub.ai · allocation.scintillahub.ai</td><td>Existing tools with their own addresses</td><td>Scintilla</td></tr>
<tr><td>*.vercel.app</td><td>Previews, studies, the widget registry and the cohort board, each at its own address</td><td>Scintilla</td></tr>
</tbody></table>
<p class="lede" style="margin-top:12px">Section names follow the shared navigation baseline v0.1 (Overview · Tools · Review · Work · Architecture · Page spec), kept by central coordination.</p></section>

<section class="part" id="page-spec"><h2 class="pt">Page spec</h2>
<dl class="spec">
<dt>Purpose</dt><dd>One place to reach Scintilla's prototypes and tools, grouped by purpose, each with a plain-words description and an honest readiness label — and a way back out of every one of them.</dd>
<dt>Owner</dt><dd>Scintilla. The Indicator Lab entry and its home are owned independently by Indicator Lab.</dd>
<dt>Maturity</dt><dd>Review home, version 0.2. A static page; no tool on it is certified by it.</dd>
<dt>Inputs</dt><dd>catalog.json in this folder (titles, descriptions, status, addresses and how each one is left) and the shared navigation baseline v0.1. The page is generated from the catalog.</dd>
<dt>Outputs</dt><dd>Links only. The page reads nothing at run time, stores nothing and sends nothing.</dd>
<dt>Release</dt><dd>Published by the Hub's normal reviewed deployment. Being published is not the same as being verified.</dd>
<dt>Verification</dt><dd>Automated checks keep this page and catalog.json in agreement, keep labels to the evidence (Existing tool, never Working, without functional proof), keep every link a listed address, and require every destination to open in a new tab or carry a link back here. Reachability and the way back were checked on 22 Sep; function was not.</dd>
<dt>Private material</dt><dd>Review notes and work items stay behind sign-in. Intakes, local paths, security findings and account or usage details are never published here.</dd>
</dl></section>
</main>
<footer>Original tools remain at their existing addresses. Recovered previews are versioned; pending artifacts are named openly. No page listed here is a dead end.</footer></div>
<script>document.querySelectorAll('[data-filter]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});document.querySelectorAll('section.grp').forEach(function(s){s.hidden=b.dataset.filter!=='all'&&s.dataset.purpose!==b.dataset.filter})})});</script>
</body></html>
"""

same = sum(1 for e in cat if e.get("url") and e["url"].startswith("/"))
out = HTML % {"css": CSS, "groups": groups_html, "systems": SYSTEMS, "legend": legend,
              "total": len(cat), "linked": linked, "named": named, "same": same}
open(OUT, "w").write(out)
print("wrote", OUT, len(out), "bytes;", len(cat), "entries,", linked, "linked,", named, "pending")
