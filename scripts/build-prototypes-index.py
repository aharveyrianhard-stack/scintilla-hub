#!/usr/bin/env python3
"""Build prototypes/index.html from prototypes/catalog.json and prototypes/latest.json.

The review home is GENERATED, not hand-edited, so the page and its two inputs can
never drift apart - that drift is what left stale and dead entries on the page.
Edit catalog.json (what exists) or latest.json (what just happened), run this,
and commit all three. tests/prototypes-catalogue.test.mjs pins the result and
enforces the rules the page promises: truthful readiness labels, a date on every
card, a monochrome palette with no white, cards that reflow from a phone to a
TV, and no destination without a way back.

    python3 scripts/build-prototypes-index.py
"""
import json, os, datetime

# repo root, resolved from this file - no machine-specific path
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CAT = os.path.join(ROOT, "prototypes", "catalog.json")
LATEST = os.path.join(ROOT, "prototypes", "latest.json")
OUT = os.path.join(ROOT, "prototypes", "index.html")

cat = json.load(open(CAT))
latest = json.load(open(LATEST))

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

# the date on a card says what kind of date it is - a page we changed, an address
# we only checked, or a name we only recorded. Guessing is not allowed: an entry
# without a date fails the build rather than being painted with one.
DATE_KIND = {"updated": "Updated", "checked": "Checked", "named": "Named"}

# purpose group for each title, and the icon that MEANS the tool
PURPOSE = {
    "Economic events": "markets", "Sector rotation": "markets",
    "Indicator Lab": "signals", "Cohort Geiger": "signals", "Context Lens · v4": "signals",
    "Company report library": "signals",
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
 "Company report library": '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4M8.5 11h7M8.5 14.5h7M8.5 18h4"/>',
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
# a new catalog entry without its own icon gets the plain page glyph, never a blank
ICON_DEFAULT = '<path d="M6 3.5h9l4 4v13H6z"/><path d="M15 3.5v4h4"/>'

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
 "Company report library": "this site · /prototypes/",
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

def host_of(e):
    t = e["title"]
    if t in HOST:
        return HOST[t]
    u = e.get("url") or ""
    if u.startswith("http"):
        return u.split("/")[2]
    if u.startswith("/prototypes/"):
        return "this site · /prototypes/"
    if u:
        return "this site · " + u
    return "not available yet"

def purpose_of(e):
    # an entry the map does not know yet is placed by its catalog topic, so a new
    # deposit still lands in a real group instead of failing the build
    t = e["title"]
    if t in PURPOSE:
        return PURPOSE[t]
    topic = (e.get("topic") or "").lower()
    return {"events": "markets", "analytics": "portfolio", "reports": "signals", "signals": "signals",
            "workspaces": "workspaces", "design": "visual"}.get(topic, "visual")

def when_of(e):
    d = e.get("date"); k = e.get("date_kind")
    if not d or k not in DATE_KIND:
        raise SystemExit("catalog entry %r has no date or date_kind (updated / checked / named) - add one, do not guess" % e["title"])
    day = datetime.date.fromisoformat(d)
    return '<span class="when" data-date="%s">%s %d %s</span>' % (d, DATE_KIND[k], day.day, day.strftime("%b"))

def card(e):
    t = e["title"]; r = READINESS[e["status"]]; p = purpose_of(e)
    desc = e["description"] + EXTRA_DESC.get(t, "")
    # the card's picture band: same plate on every card, carrying the tool's own mark
    ico = '<span class="pic" aria-hidden="true"><svg viewBox="0 0 24 24">%s</svg></span>' % ICON.get(t, ICON_DEFAULT)
    meta = '<div class="meta"><span class="rd %s">%s</span>%s<span class="host">%s</span></div>' % (r, BADGE[r], when_of(e), host_of(e))
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

# ---- the latest strip: newest first, from latest.json ---------------------------
KIND = {"deploy": "Deployed", "page": "Published", "feed": "Feed"}
try:
    from zoneinfo import ZoneInfo
    ET = ZoneInfo("America/New_York")
except Exception:  # pragma: no cover - the build machine always has zoneinfo
    ET = None

def stamp(iso):
    t = datetime.datetime.fromisoformat(iso.replace("Z", "+00:00"))
    if ET is not None:
        t = t.astimezone(ET)
        return "%d %s · %s ET" % (t.day, t.strftime("%b"), t.strftime("%-I:%M %p").lower())
    return "%d %s · %s UTC" % (t.day, t.strftime("%b"), t.strftime("%H:%M"))

def latest_item(x, first=False):
    if x.get("kind") not in KIND:
        raise SystemExit("latest.json item %r has an unknown kind" % x.get("title"))
    badge = '<span class="new">Newest</span>' if first else ''
    meta = '<span class="lm"><b>%s</b>%s<span>%s</span></span>' % (KIND[x["kind"]], badge, stamp(x["when"]))
    body = '<span class="lt">%s</span><span class="lw">%s</span>' % (esc(x["title"]), esc(x["what"]))
    u = x.get("url")
    if u:
        ext = u.startswith("http")
        tgt = ' target="_blank" rel="noopener"' if ext else ""
        foot = '<span class="lx">%s · %s</span>' % (esc(x.get("surface", "")), "opens in a new tab ↗" if ext else "opens here →")
        return '<a class="li" href="%s"%s data-when="%s">%s%s%s</a>' % (u, tgt, x["when"], meta, body, foot)
    foot = '<span class="lx">%s</span>' % esc(x.get("surface", ""))
    return '<div class="li" data-when="%s">%s%s%s</div>' % (x["when"], meta, body, foot)

latest_sorted = sorted(latest, key=lambda x: x["when"], reverse=True)
latest_html = "".join(latest_item(x, i == 0) for i, x in enumerate(latest_sorted))
latest_newest = stamp(latest_sorted[0]["when"]) if latest_sorted else "nothing yet"

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
    cards = "".join(card(e) for e in cat if purpose_of(e) == key)
    groups_html += ('<section class="grp" data-purpose="%s"><div class="gh"><h3 class="gt">%s</h3><p>%s</p></div>'
                    '<div class="grid">\n%s\n</div></section>\n') % (key, name, sub, cards)

CSS = """
:root{color-scheme:dark;
/* surfaces - greys only. House rule: every colour is a grey (channels within 24
   of each other), nothing brighter than 210, and no white anywhere. */
--bg:#0B0B0D;--panel:#111114;--panel2:#16161A;--line:#1F1F24;--line2:#2B2B31;
--hair:rgba(188,190,196,.12);--hair2:rgba(188,190,196,.30);
/* ink - one neutral ramp, capped well below white */
--ink:#C8C8CE;--ink2:#A2A2A9;--ink3:#83838B;--dim:#63636B;--mute:#45454C;
/* readiness is TONE x OPACITY on the same grey, never a second colour */
--crk:#C8C8CE;--c90:rgba(200,200,206,.90);--c62:rgba(200,200,206,.62);
--c40:rgba(200,200,206,.40);--c22:rgba(200,200,206,.22);
--mono:"SF Mono","JetBrains Mono",ui-monospace,Menlo,monospace;--sans:ui-sans-serif,-apple-system,"Helvetica Neue",sans-serif;
/* the type scales with the screen: 15 px on a phone, 19 px on a TV. Everything
   below is in rem, so the whole page grows together. */
font-size:clamp(15px,.5vw + 8.5px,19px);font-family:var(--sans);line-height:1.55;color:var(--ink2);background:var(--bg);-webkit-font-smoothing:antialiased}
*{box-sizing:border-box}html{scroll-behavior:smooth}body{margin:0;background:var(--bg)}
/* the page uses the screen it is given: no fixed box, side padding that grows with the width */
.wrap{max-width:2400px;margin:auto;padding:0 clamp(14px,3vw,56px) 3rem}
a{color:var(--ink2);text-decoration:none}a:hover{color:var(--ink)}
a:focus-visible,button:focus-visible{outline:1px solid var(--c62);outline-offset:3px}
/* ---- the bar that never leaves: who you are, and the way out --------------- */
header{position:sticky;top:0;z-index:40;display:flex;justify-content:space-between;align-items:center;gap:1rem;
 min-height:3rem;margin:0 calc(-1 * clamp(14px,3vw,56px));padding:.4rem clamp(14px,3vw,56px);
 border-bottom:1px solid var(--line);background:rgba(11,11,13,.92);backdrop-filter:blur(8px)}
.hleft{display:flex;align-items:center;gap:.85rem;min-width:0}
.brand{font:600 .82rem/1 var(--mono);letter-spacing:.44em;color:var(--ink);white-space:nowrap}
.crumb{font:.66rem/1 var(--mono);font-size:max(11px,.66rem);letter-spacing:.2em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
.crumb::before{content:"/";margin-right:.7em;color:var(--mute)}
.hlinks{display:flex;gap:.4rem;font:.6rem/1 var(--mono);font-size:max(11px,.6rem);letter-spacing:.2em;text-transform:uppercase}
.hlinks a{border:1px solid var(--line2);border-radius:999px;padding:.5rem .8rem;color:var(--ink3);background:var(--panel)}
.hlinks a:hover{color:var(--ink);border-color:var(--hair2)}
/* ---- section tabs: one scrolling page, the current place lit --------------- */
.pnbar{position:sticky;top:3rem;z-index:35;margin:0 calc(-1 * clamp(14px,3vw,56px));padding:.5rem clamp(14px,3vw,56px);
 border-bottom:1px solid var(--line);background:rgba(11,11,13,.92);backdrop-filter:blur(8px)}
nav.pn{display:flex;gap:.3rem;overflow-x:auto;scrollbar-width:none}
nav.pn::-webkit-scrollbar{display:none}
nav.pn a{flex:0 0 auto;border:1px solid transparent;border-radius:999px;padding:.44rem .8rem;
 font:600 .62rem/1 var(--mono);font-size:max(11px,.62rem);letter-spacing:.2em;text-transform:uppercase;color:var(--dim);white-space:nowrap}
nav.pn a:hover{color:var(--ink2);border-color:var(--line2)}
nav.pn a.on{color:var(--bg);background:var(--ink);border-color:var(--ink)}
/* ---- page head ------------------------------------------------------------- */
h1{font:600 clamp(1.5rem,2.4vw,2.1rem)/1.15 var(--sans);letter-spacing:-.01em;color:var(--ink);margin:1.9rem 0 .5rem}
.lede{max-width:54rem;color:var(--ink3);margin:0 0 .7rem;font-size:.92rem;line-height:1.6}
.k{display:block;font:.62rem/1.5 var(--mono);font-size:max(11px,.62rem);letter-spacing:.16em;text-transform:uppercase;color:var(--mute);margin:0 0 1.1rem}
section.part{padding:0 0 2.2rem;scroll-margin-top:6.2rem}
section.part+section.part{border-top:1px solid var(--line);padding-top:1.6rem}
h2.pt{display:flex;align-items:baseline;gap:.8rem;font:600 1.15rem/1.2 var(--sans);color:var(--ink);margin:0 0 1rem}
h2.pt::after{content:"";flex:1;height:1px;background:var(--line)}
/* ---- latest: one row you push sideways, not a wall ------------------------- */
.latest{margin:1.2rem 0 1.4rem}
.lh{display:flex;align-items:baseline;justify-content:space-between;gap:1rem;margin:0 0 .6rem}
.lh h2{font:600 .68rem/1 var(--mono);font-size:max(11px,.68rem);letter-spacing:.26em;text-transform:uppercase;color:var(--ink2);margin:0}
.lh p{margin:0;font:.62rem/1 var(--mono);font-size:max(11px,.62rem);letter-spacing:.1em;color:var(--mute)}
.rail{display:flex;gap:10px;overflow-x:auto;scroll-snap-type:x proximity;padding:2px 0 10px;scrollbar-width:thin}
.rail::-webkit-scrollbar{height:7px}
.rail::-webkit-scrollbar-thumb{background:var(--line2);border-radius:99px}
.li{flex:0 0 clamp(240px,23vw,310px);scroll-snap-align:start;display:flex;flex-direction:column;gap:.35rem;
 padding:.7rem .8rem .75rem;border:1px solid var(--line);border-radius:4px;background:var(--panel)}
a.li:hover{border-color:var(--line2);background:var(--panel2)}
.lm{display:flex;align-items:center;flex-wrap:wrap;gap:.35rem .5rem;font:.56rem/1 var(--mono);font-size:max(11px,.56rem);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.lm b{font-weight:600;color:var(--ink3)}
.lm span{margin-left:auto;color:var(--mute);letter-spacing:.1em}
.new{border:1px solid var(--hair2);border-radius:999px;padding:.24rem .45rem;color:var(--ink);letter-spacing:.14em}
.lt{font:600 .86rem/1.35 var(--sans);color:var(--ink)}
a.li:hover .lt{color:var(--ink)}
.lw{font-size:.78rem;line-height:1.45;color:var(--ink3)}
.lx{margin-top:auto;padding-top:.45rem;font:.56rem/1.4 var(--mono);font-size:max(11px,.56rem);letter-spacing:.12em;text-transform:uppercase;color:var(--mute)}
/* ---- counts ---------------------------------------------------------------- */
.stats{display:flex;flex-wrap:wrap;gap:8px;margin:0 0 .4rem}
.stat{flex:1 1 7rem;display:flex;align-items:baseline;gap:.5rem;padding:.6rem .8rem;border:1px solid var(--line);border-radius:4px;background:var(--panel)}
.stat b{font:600 1.15rem/1 var(--sans);color:var(--ink)}
.stat span{font:.58rem/1.2 var(--mono);font-size:max(11px,.58rem);letter-spacing:.16em;text-transform:uppercase;color:var(--dim)}
/* ---- filters --------------------------------------------------------------- */
.filters{display:flex;flex-wrap:wrap;gap:.35rem;margin:0 0 1.3rem}
.filters button{cursor:pointer;border:1px solid var(--line2);border-radius:999px;padding:.44rem .8rem;background:var(--panel);
 font:600 .6rem/1 var(--mono);font-size:max(11px,.6rem);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
.filters button:hover{color:var(--ink2);border-color:var(--hair2)}
.filters button[aria-pressed=true]{color:var(--bg);background:var(--ink);border-color:var(--ink)}
/* ---- groups and cards ------------------------------------------------------ */
section.grp{margin:0 0 1.9rem}
.gh{margin:0 0 .7rem}
h3.gt{font:600 1rem/1.2 var(--sans);color:var(--ink);margin:0 0 .2rem}
.gh p{margin:0;font-size:.82rem;color:var(--ink3)}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,340px),1fr));gap:12px;align-items:stretch}
article,.sysitem{display:flex;flex-direction:column;border:1px solid var(--line);border-radius:5px;background:var(--panel);overflow:hidden}
article:hover,.sysitem:hover{border-color:var(--line2);background:var(--panel2)}
.face{position:relative;display:flex;flex-direction:column;color:inherit;flex:1}
/* the picture band: every card carries the same shaped plate, so the grid reads
   as one family instead of a list of boxes. The mark is the tool's own icon. */
.pic{position:relative;display:grid;place-items:center;height:clamp(86px,7.5vw,116px);border-bottom:1px solid var(--line);overflow:hidden;
 background:radial-gradient(120% 95% at 50% 6%,#17171B 0%,#0E0E11 72%),
 repeating-linear-gradient(0deg,rgba(150,152,158,.045) 0 1px,transparent 1px 24px),
 repeating-linear-gradient(90deg,rgba(150,152,158,.045) 0 1px,transparent 1px 24px)}
.pic svg{width:auto;height:clamp(34px,3.4vw,46px);fill:none;stroke:var(--ink3);stroke-width:1.05;stroke-linecap:round;stroke-linejoin:round}
.face:hover .pic svg{stroke:var(--ink)}
.go{position:absolute;top:8px;right:9px;width:22px;height:22px;display:grid;place-items:center;border:1px solid var(--line2);
 border-radius:999px;background:rgba(11,11,13,.8);font:.68rem/1 var(--mono);font-size:max(11px,.68rem);color:var(--dim)}
.face:hover .go{color:var(--ink);border-color:var(--hair2)}
.txt{display:block;flex:1;padding:.7rem .85rem .2rem}
article h4,.sysitem h4{font:600 .92rem/1.3 var(--sans);color:var(--ink);margin:0 0 .28rem}
article p,.sysitem p{margin:0;font-size:.8rem;line-height:1.5;color:var(--ink3)}
.meta{display:flex;align-items:center;flex-wrap:wrap;gap:.45rem;padding:.6rem .85rem .2rem;order:2;
 font:.56rem/1 var(--mono);font-size:max(11px,.56rem);letter-spacing:.16em;text-transform:uppercase}
.rd{border:1px solid var(--line2);border-radius:999px;padding:.3rem .5rem;color:var(--ink3)}
.rd.existing{color:var(--ink);border-color:var(--hair2)}
.rd.review{color:var(--ink);border-color:var(--hair2)}
.rd.preview{color:var(--ink2)}
.rd.sample{color:var(--ink3)}
.rd.pending{color:var(--dim);border-style:dashed}
.rd.live{color:var(--ink);border-color:var(--hair2)}
.when{color:var(--dim)}
.host{flex:1 0 100%;text-transform:none;letter-spacing:.04em;color:var(--mute);font-size:.6rem}
.exit{order:3;margin:0;padding:.55rem .85rem;border-top:1px solid var(--line);font:.58rem/1.4 var(--mono);font-size:max(11px,.58rem);letter-spacing:.1em;
 text-transform:uppercase;color:var(--mute)}
.links{order:4;display:flex;flex-wrap:wrap;gap:.35rem;padding:0 .85rem .7rem}
.secondary{border:1px solid var(--line2);border-radius:999px;padding:.3rem .55rem;font:.58rem/1 var(--mono);font-size:max(11px,.58rem);letter-spacing:.14em;
 text-transform:uppercase;color:var(--ink3)}
.secondary:hover{color:var(--ink);border-color:var(--hair2)}
.pending{font:.58rem/1 var(--mono);font-size:max(11px,.58rem);letter-spacing:.14em;text-transform:uppercase;color:var(--dim)}
.face.is-pending{cursor:default}
.face.is-pending .pic{opacity:.55}
.sysitem .face{flex:1}
/* ---- review / work / spec / architecture ----------------------------------- */
.two{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,420px),1fr));gap:1.3rem}
.two ul,.spec ul{margin:.5rem 0 0;padding-left:1.1rem}
.two li{margin:0 0 .5rem;font-size:.84rem;color:var(--ink3);line-height:1.55}
.two li b{color:var(--ink2);font-weight:600}
.signin{margin-left:.4rem;font:.56rem/1 var(--mono);font-size:max(11px,.56rem);letter-spacing:.14em;text-transform:uppercase;color:var(--mute)}
dl.spec{display:grid;grid-template-columns:minmax(9rem,14rem) 1fr;gap:0;margin:0;border:1px solid var(--line);border-radius:5px;background:var(--panel);overflow:hidden}
dl.spec dt{padding:.7rem .85rem;border-top:1px solid var(--line);font:600 .6rem/1.4 var(--mono);font-size:max(11px,.6rem);letter-spacing:.18em;text-transform:uppercase;color:var(--ink2)}
dl.spec dd{margin:0;padding:.7rem .85rem;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink3);line-height:1.55}
dl.spec dt:first-of-type,dl.spec dd:first-of-type{border-top:0}
table.arch{width:100%;border-collapse:collapse;border:1px solid var(--line);border-radius:5px;overflow:hidden;background:var(--panel)}
table.arch th{text-align:left;padding:.6rem .85rem;border-bottom:1px solid var(--line);font:600 .58rem/1.3 var(--mono);font-size:max(11px,.58rem);letter-spacing:.18em;text-transform:uppercase;color:var(--dim)}
table.arch td{padding:.65rem .85rem;border-top:1px solid var(--line);font-size:.82rem;color:var(--ink3);vertical-align:top;line-height:1.5}
table.arch td:first-child{font:.76rem/1.5 var(--mono);color:var(--ink2);white-space:nowrap}
footer{margin-top:1.6rem;padding-top:1rem;border-top:1px solid var(--line);font:.6rem/1.6 var(--mono);font-size:max(11px,.6rem);letter-spacing:.1em;text-transform:uppercase;color:var(--mute)}
@media(max-width:900px){.pnbar{top:2.8rem}.crumb{display:none}}
/* On a phone the BACK / CLOSE pair is what matters in the bar, and it must not be pushed off the edge.
   Hub and Station keep their own cards in the Systems group below, and CLOSE goes to the Hub anyway. */
@media(max-width:700px){.hlinks{display:none}.brand{font-size:max(11px,.72rem);letter-spacing:.24em}
 .k{letter-spacing:.06em}.lh{flex-wrap:wrap}.lh p{flex:1 0 100%}}
@media(max-width:850px){dl.spec{grid-template-columns:1fr}dl.spec dd{border-top:0;padding-top:0}}
@media(max-width:620px){.wrap{padding:0 .9rem 2rem}.brand{letter-spacing:.3em;font-size:.76rem}.hlinks a{padding:.45rem .6rem}
 h1{margin-top:1.3rem}.stat{flex:1 1 45%}.pic{height:96px}}
@media(max-width:560px){table.arch thead{display:none}table.arch tr{display:block;border-top:1px solid var(--line);padding:.5rem 0}
 table.arch td{display:block;border:0;padding:.2rem .85rem}
 table.arch td:first-child{white-space:normal}
 table.arch td:nth-child(3)::before{content:"Kept by: ";color:var(--mute)}}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}html{scroll-behavior:auto}}
"""

SYSTEMS = """<section class="grp" data-purpose="systems"><div class="gh"><h3 class="gt">Systems</h3><p>The live products this work feeds, and where files are kept.</p></div><div class="grid">
<div class="sysitem"><div class="meta"><span class="rd live">Live product</span><span class="host">scintillahub.ai</span></div><a class="face" href="https://scintillahub.ai/" target="_blank" rel="noopener"><span class="pic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="1.5"/><path d="M3.5 9h17M7.5 12.5h4M7.5 16h9M15 12.5h1.5"/></svg></span><span class="txt"><h4>Hub</h4><p>The dashboard: board, company pages, news, events, economic room.</p></span><span class="go" aria-hidden="true">↗</span></a><p class="exit">Opens in a new tab — this page stays where it is.</p></div>
<div class="sysitem"><div class="meta"><span class="rd live">Live product</span><span class="host">station.scintillahub.ai</span></div><a class="face" href="https://station.scintillahub.ai/" target="_blank" rel="noopener"><span class="pic" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="2.5" y="4.5" width="19" height="12" rx="1.5"/><path d="M8 20h8M12 16.5V20M6 8.5h5M6 12h3M14 8.5h4M14 12h4"/></svg></span><span class="txt"><h4>Station</h4><p>The display wall: charts, video panes and the X pane.</p></span><span class="go" aria-hidden="true">↗</span></a><p class="exit">Opens in a new tab — this page stays where it is.</p></div>
<div class="sysitem"><div class="meta"><span class="rd note">In the Hub</span><span class="host">no separate address</span></div><div class="face"><span class="pic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M3.5 7.5a1.5 1.5 0 0 1 1.5-1.5h4l2 2.5h8a1.5 1.5 0 0 1 1.5 1.5v8a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z"/></svg></span><span class="txt"><h4>Files</h4><p>Files are kept inside the Hub, not on this page. Open the Hub, then the SCINTILLA logo menu, then Files.</p></span></div><div class="links"><span class="note">Hub → Scintilla menu → Files</span></div></div>
</div></section>"""

HTML = """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>SCINTILLA · Prototypes</title><style>%(css)s</style></head><body><div class="wrap">
<header><span class="hleft"><span data-scnav-slot></span><span class="brand">SCINTILLA</span><span class="crumb">Prototypes</span></span><nav class="hlinks" aria-label="Live products"><a href="https://scintillahub.ai/" target="_blank" rel="noopener">Hub ↗</a><a href="https://station.scintillahub.ai/" target="_blank" rel="noopener">Station ↗</a></nav></header>
<div class="pnbar"><nav class="pn" aria-label="Page sections"><a href="#overview">Overview</a><a href="#tools">Tools</a><a href="#review">Review</a><a href="#work">Work</a><a href="#architecture">Architecture</a><a href="#page-spec">Page spec</a></nav></div>
<main>
<section class="part" id="overview"><h1>Prototypes &amp; review</h1>
<p class="lede">One front door to everything being built and reviewed around the Hub. Each card says in plain words what it is, what it does, when it last moved and how ready it is — and every one of them either opens in a new tab or carries a link back here, so you are never stuck on a page with no way out.</p>
<p class="k">Nothing here is part of the dashboard unless it says so. Inclusion does not establish current data, working function or production readiness.</p>
<section class="latest" aria-label="Latest"><div class="lh"><h2>Latest</h2><p>%(latest_n)d most recent · newest %(latest_newest)s · from latest.json</p></div><div class="rail">%(latest)s</div></section>
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
<li><b class="rd">Updated</b> on a card is the day that page last changed on this site; <b class="rd">Checked</b> is the day an address on another site was last confirmed to answer; <b class="rd">Named</b> is the day an entry was first listed without an address.</li>
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
<li>New entries go into catalog.json with a date; something that just shipped goes into latest.json. The page is generated from both and the test fails if they disagree.</li>
<li>Every listed destination must have a way back or open in a new tab; the test fails if one does not.</li>
<li>The work items are the source of status; this page does not mirror them.</li>
</ul></div>
</div></section>

<section class="part" id="architecture"><h2 class="pt">Architecture</h2>
<table class="arch"><thead><tr><th>Address</th><th>What lives there</th><th>Kept by</th></tr></thead><tbody>
<tr><td>scintillahub.ai</td><td>The Hub, this home (/prototypes/), the Visual Engine workbench (/visual-engine/), the visual-engine lab (/lab.html), the Station dock concept (/prototypes/dock-concept/), the company report library (/prototypes/report-library/) and the Indicator Lab home (/prototypes/indicator-lab/)</td><td>Scintilla; the Indicator Lab home is kept independently by Indicator Lab</td></tr>
<tr><td>station.scintillahub.ai</td><td>Station, the display wall</td><td>Scintilla</td></tr>
<tr><td>sectorrotation.scintillahub.ai · allocation.scintillahub.ai</td><td>Existing tools with their own addresses</td><td>Scintilla</td></tr>
<tr><td>*.vercel.app</td><td>Previews, studies, the widget registry and the cohort board, each at its own address</td><td>Scintilla</td></tr>
</tbody></table>
<p class="lede" style="margin-top:.75rem">Section names follow the shared navigation baseline v0.1 (Overview · Tools · Review · Work · Architecture · Page spec), kept by central coordination.</p></section>

<section class="part" id="page-spec"><h2 class="pt">Page spec</h2>
<dl class="spec">
<dt>Purpose</dt><dd>One place to reach Scintilla's prototypes and tools, grouped by purpose, each with a plain-words description, a date and an honest readiness label — and a way back out of every one of them. A latest strip at the top shows what just shipped, newest first.</dd>
<dt>Owner</dt><dd>Scintilla. The Indicator Lab entry and its home are owned independently by Indicator Lab.</dd>
<dt>Maturity</dt><dd>Review home, version 0.3. A static page; no tool on it is certified by it.</dd>
<dt>Inputs</dt><dd>catalog.json in this folder (titles, descriptions, status, dates, addresses and how each one is left), latest.json (what just shipped, when, and where to open it) and the shared navigation baseline v0.1. The page is generated from the two files.</dd>
<dt>Outputs</dt><dd>Links only. The page reads nothing at run time, stores nothing and sends nothing.</dd>
<dt>Release</dt><dd>Published by the Hub's normal reviewed deployment. Being published is not the same as being verified.</dd>
<dt>Verification</dt><dd>Automated checks keep this page, catalog.json and latest.json in agreement, keep labels to the evidence (Existing tool, never Working, without functional proof), require a date on every card, keep every link a listed address, and require every destination to open in a new tab or carry a link back here. Reachability and the way back were checked on 22 Sep; function was not.</dd>
<dt>Private material</dt><dd>Review notes and work items stay behind sign-in. Intakes, local paths, security findings and account or usage details are never published here.</dd>
</dl></section>
</main>
<footer>Original tools remain at their existing addresses. Recovered previews are versioned; pending artifacts are named openly. No page listed here is a dead end.</footer></div>
<script>
/* The tabs used to HIDE the other five sections, so anything not in the open tab
   was unreachable without guessing. They now move you down one page that always
   holds everything, and the bar shows where you are. */
(function(){
 var nav=[].slice.call(document.querySelectorAll('nav.pn a'));
 var parts=[].slice.call(document.querySelectorAll('section.part'));
 function mark(id){nav.forEach(function(a){var on=a.getAttribute('href')==='#'+id;a.className=on?'on':'';
  if(on){a.setAttribute('aria-current','true');}else{a.removeAttribute('aria-current');}});}
 nav.forEach(function(a){a.addEventListener('click',function(e){
  var el=document.getElementById(a.getAttribute('href').slice(1)); if(!el)return;
  e.preventDefault(); el.scrollIntoView({block:'start'}); history.replaceState(null,'','#'+el.id); mark(el.id);});});
 if(window.IntersectionObserver){
  var io=new IntersectionObserver(function(es){es.forEach(function(en){if(en.isIntersecting)mark(en.target.id);});},
   {rootMargin:'-28%% 0px -62%% 0px'});
  parts.forEach(function(p){io.observe(p);});
 }
 var h=(location.hash||'#overview').slice(1); mark(h);
 if(location.hash){var t=document.getElementById(h); if(t)setTimeout(function(){t.scrollIntoView({block:'start'});},0);}
})();
document.querySelectorAll('[data-filter]').forEach(function(b){b.addEventListener('click',function(){document.querySelectorAll('[data-filter]').forEach(function(x){x.setAttribute('aria-pressed',String(x===b))});document.querySelectorAll('section.grp').forEach(function(s){s.hidden=b.dataset.filter!=='all'&&s.dataset.purpose!==b.dataset.filter})})});</script>
</body></html>
"""

same = sum(1 for e in cat if e.get("url") and e["url"].startswith("/"))
out = HTML % {"css": CSS, "groups": groups_html, "systems": SYSTEMS, "legend": legend,
              "latest": latest_html, "latest_n": len(latest_sorted), "latest_newest": latest_newest,
              "total": len(cat), "linked": linked, "named": named, "same": same}
# BACK / CLOSE: the same inline pair every Hub sub-page carries (scripts/scnav-snippet.html), mounted in the header slot
out = out.replace("</body>", open(os.path.join(ROOT, "scripts", "scnav-snippet.html")).read().strip() + "\n</body>", 1)
open(OUT, "w").write(out)
print("wrote", OUT, len(out), "bytes;", len(cat), "entries,", linked, "linked,", named, "pending;", len(latest_sorted), "latest")
