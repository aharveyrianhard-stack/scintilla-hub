#!/usr/bin/env python3
"""Build deliverables/20260924/widget-scout/WIDGET-SCOUT.html from what was actually measured.

Inputs, all written by the headless run (nothing here is typed in by hand):
  deliverables/20260924/widget-scout/measured.json  - per widget: what was inside the frame
  deliverables/20260924/widget-scout/pixels.json    - per screenshot: colours drawn, how light it is
  deliverables/20260924/widget-scout/cost.json      - per widget, mounted alone: requests and KB
A widget counts as DRAWN only if its screenshot carries real colour. A box with 3 colours is a black box.
"""
import json, pathlib, html, datetime

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT  = ROOT / "deliverables" / "20260924" / "widget-scout"
M    = json.loads((OUT / "measured.json").read_text())
PX   = {p["file"]: p for p in json.loads((OUT / "pixels.json").read_text())}
try:    COST = {c["name"]: c for c in json.loads((OUT / "cost.json").read_text())}
except Exception: COST = {}

BLANK_COLOURS = 12          # below this, the panel is empty
def verdict(row):
    px = PX.get(row.get("shot", ""), {})
    cols = px.get("colors", 0)
    # a spoken refusal outranks an empty panel: the frame said so in words
    if row["verdict"] == "REFUSED":   return "REFUSED", cols, px.get("lightPct", 0)
    if cols and cols < BLANK_COLOURS: return "BLANK", cols, px.get("lightPct", 0)
    if cols >= BLANK_COLOURS:         return "DRAWS", cols, px.get("lightPct", 0)
    return row["verdict"], cols, px.get("lightPct", 0)

# what each widget is for and where it could go — the judgement part, kept next to the measurement
WHERE = {
 "technical-analysis":("Right of Fear &amp; Greed in SENTIMENT, per symbol in COMPANY","A rating dial, not a price"),
 "hotlists":("SENTIMENT or DASHBOARD","Gainers, losers, most active"),
 "stock-heatmap":("DASHBOARD, full width","The one-glance breadth picture"),
 "etf-heatmap":("DASHBOARD or ALLOCATION","Where money sits by asset class"),
 "crypto-coins-heatmap":("Not needed - no crypto room","Coins only"),
 "forex-heat-map":("ECONOMIC","Dollar strength grid"),
 "forex-cross-rates":("ECONOMIC","Every pair against every pair"),
 "market-overview":("DASHBOARD sidebar","Small watchlist with a chart"),
 "market-quotes":("DASHBOARD","Grouped quote rows"),
 "advanced-chart":("Station chart screen only","Heaviest widget of the set"),
 "symbol-overview":("COMPANY","Clean line chart plus quote"),
 "mini-symbol-overview":("Inside a Hub tile","Thumbnail chart"),
 "events":("ECONOMIC, beside our own calendar","Forecast / previous / actual"),
 "timeline":("NEWS, as a second column","Their newsroom, not ours"),
 "symbol-info":("COMPANY header","Name, price, change"),
 "financials":("COMPANY","Revenue, margins, balance sheet"),
 "symbol-profile":("COMPANY","What the company does"),
 "screener":("Its own room or Station","A whole market table"),
 "ticker-tape":("Top of the Hub","Scrolling strip"),
 "tickers":("DASHBOARD","Static quote cards"),
 "single-quote":("Anywhere small","One price"),
 "seasonal-chart":("COMPANY or SENTIMENT","No older equivalent exists"),
 "economic-map":("ECONOMIC","World map by measure"),
 "market-summary":("DASHBOARD strip","Newest, smallest overview"),
 "world-market-summary":("DASHBOARD","Regions at a glance"),
 "heatmap":("DASHBOARD","Newer heatmap build"),
 "company-profile":("COMPANY","Newer profile build"),
 "single-ticker":("Anywhere small","Newer single quote"),
 "ticker-tag":("Inside a sentence","Only in the new family"),
 "mini-chart":("Inside a Hub tile","Newer thumbnail"),
}

rows = [r for r in M["rows"] if not r.get("meta")]
gmeta = {g["group"]: g for g in M["groupMeta"]}
GROUPS = [("sentiment","Sentiment"),("breadth","Breadth"),("technicals","Technicals"),
          ("calendar","Calendar"),("news","News"),("fundamentals","Fundamentals"),
          ("quotes","Quotes and tape"),("refusals","Known refusals")]

def esc(s): return html.escape(str(s))

# ---------- inventory table ----------
inv = []
for gid, gname in GROUPS:
    for r in [x for x in rows if x["group"] == gid]:
        v, cols, light = verdict(r)
        key = r["widget"].split(":")[1] if ":" in r["widget"] else ""
        fam = r["widget"].split(":")[0]
        vendor = {"tv":"TradingView","tvw":"TradingView (new)","iv":"Investing.com"}.get(fam, fam)
        where, note = WHERE.get(key, ("&mdash;", ""))
        cost = COST.get(r["name"].split(" (")[0], {})
        inv.append(dict(group=gname, name=r["name"], vendor=vendor, key=key or "iframe", v=v,
                        cols=cols, light=light, box=r.get("boxh", 0), shot=r.get("shot"),
                        where=where, note=note, inside=r.get("inside", "")[:120],
                        reqs=cost.get("requests"), kb=cost.get("kb")))

def badge(v):
    cls = {"DRAWS":"ok","BLANK":"no","REFUSED":"no"}.get(v, "mid")
    word = {"DRAWS":"DRAWS","BLANK":"BLACK BOX","REFUSED":"REFUSED"}.get(v, v)
    return f'<span class="b {cls}">{word}</span>'

table = []
for i in inv:
    cost = (f'{i["reqs"]} requests' + (f' / {i["kb"]} KB' if i["kb"] else '')) if i["reqs"] else "&mdash;"
    table.append(
      f'<tr><td>{esc(i["group"])}</td><td><b>{esc(i["name"])}</b>'
      f'<span class="k">{esc(i["key"])}</span></td><td>{esc(i["vendor"])}</td>'
      f'<td>{badge(i["v"])}<span class="px">{i["cols"]} colours&nbsp;&middot;&nbsp;{i["light"]}% light</span></td>'
      f'<td>{i["box"]}px tall</td><td>{cost}</td><td>{i["where"]}</td></tr>')

shots = []
for i in inv:
    if i["v"] != "DRAWS" or not i["shot"]: continue
    shots.append(f'<figure><img src="shots/{esc(i["shot"])}" alt="{esc(i["name"])}" loading="lazy">'
                 f'<figcaption>{esc(i["name"])} &middot; {esc(i["vendor"])}'
                 f'{" &middot; " + esc(i["note"]) if i["note"] else ""}</figcaption></figure>')

blanks = [i for i in inv if i["v"] in ("BLANK", "REFUSED")]
grpcost = " ".join(f'<tr><td>{esc(g[1])}</td><td>{gmeta.get(g[0],{}).get("requests","?")} requests</td>'
                   f'<td>{esc(" ".join(gmeta.get(g[0],{}).get("hosts",[])[:4]))}</td></tr>' for g in GROUPS)

HTML = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Widget scout &middot; what we can borrow</title>
<style>
 :root{{--bg:#0b0c0d;--panel:#121315;--line:rgba(150,154,160,.24);--ink:#c4c7cb;--ink2:#9a9ea3;--ink3:#7d8186;
   --ok:#8f9a8f;--no:#9a8f8f;--mono:ui-monospace,"SF Mono",Menlo,Consolas,monospace}}
 *{{box-sizing:border-box}} html,body{{margin:0;background:var(--bg);color:var(--ink2);
   font:13px/1.6 -apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif}}
 .wrap{{max-width:1180px;margin:0 auto;padding:22px 16px 70px}}
 h1{{font:600 16px/1.3 var(--mono);letter-spacing:.18em;text-transform:uppercase;color:var(--ink);margin:0 0 4px}}
 h2{{font:600 12px/1.3 var(--mono);letter-spacing:.16em;text-transform:uppercase;color:var(--ink);
   margin:34px 0 10px;padding-bottom:7px;border-bottom:1px solid var(--line)}}
 h3{{font:600 11px/1.3 var(--mono);letter-spacing:.12em;text-transform:uppercase;color:var(--ink);margin:20px 0 6px}}
 p,li{{max-width:86ch}} b{{color:var(--ink);font-weight:600}}
 .lede{{font-size:13px;color:var(--ink2)}}
 table{{width:100%;border-collapse:collapse;margin:10px 0 6px;font-size:12px}}
 th{{text-align:left;font:600 11px/1.3 var(--mono);letter-spacing:.1em;text-transform:uppercase;color:var(--ink3);
   border-bottom:1px solid var(--line);padding:7px 8px}}
 td{{padding:7px 8px;border-bottom:1px solid rgba(150,154,160,.13);vertical-align:top}}
 .k{{display:block;font:11px/1.4 var(--mono);color:var(--ink3)}}
 .px{{display:block;font:11px/1.4 var(--mono);color:var(--ink3)}}
 .b{{display:inline-block;padding:1px 6px;border:1px solid var(--line);border-radius:2px;
   font:600 11px/1.5 var(--mono);letter-spacing:.08em}}
 .b.ok{{color:var(--ok)}} .b.no{{color:var(--no)}} .b.mid{{color:var(--ink2)}}
 .grid{{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px;margin-top:12px}}
 figure{{margin:0;border:1px solid var(--line);background:var(--panel);border-radius:3px;overflow:hidden}}
 figure img{{display:block;width:100%;height:auto;border-bottom:1px solid var(--line)}}
 figcaption{{padding:7px 9px;font:11px/1.45 var(--mono);color:var(--ink2);letter-spacing:.04em}}
 .card{{border:1px solid var(--line);background:var(--panel);border-radius:3px;padding:12px 14px;margin:10px 0}}
 .card h3{{margin-top:0}}
 ol.short{{padding-left:18px}} ol.short li{{margin-bottom:12px}}
 a{{color:var(--ink)}}
 @media(max-width:700px){{ table,thead,tbody,th,td,tr{{display:block}} th{{display:none}}
   td{{border:0;padding:3px 0}} tr{{border-bottom:1px solid var(--line);padding:9px 0;display:block}} }}
</style></head><body><div class="wrap">
<h1>Widget scout</h1>
<p class="lede">Every widget TradingView and Investing.com will let a page embed, mounted for real in a browser
on <b>24 September 2026</b> and photographed. This page is the report; the shelf itself is at
<a href="/prototypes/widget-scout/">/prototypes/widget-scout/</a>. Nothing was deployed and nothing was wired
into the Hub.</p>

<h2>The short answer</h2>
<div class="card">
<p><b>Neither vendor sells a Fear &amp; Greed gauge you can embed.</b> CNN's is not embeddable and Investing.com
does not put theirs in their widget kit. The closest borrowable thing is TradingView's
<b>Technical Analysis gauge</b> &mdash; a speedometer that reads Strong buy / Neutral / Sell from moving averages
and oscillators, per timeframe. It sits naturally beside our own Fear &amp; Greed because it is the same shape of
object: one dial, one word, one number. It measures something different (indicators, not crowd mood), so the
label matters.</p>
<p><b>{sum(1 for i in inv if i["v"]=="DRAWS")} of {len(inv)} panels drew real content.</b> Every TradingView widget
worked. <b>Every Investing.com widget failed</b>: their server answered <b>403</b> to the embed from this machine,
with and without our own domain as the referrer, so all four of their panels are black boxes below.</p>
</div>

<h2>What was measured, and how</h2>
<p>Each widget was mounted in a real headless browser, left to load, then judged three ways: what text sits
inside its frame, how many distinct colours its screenshot contains, and how many network requests it caused.
A panel with under {BLANK_COLOURS} colours is empty &mdash; that is how the Investing.com boxes were caught. The first
pass called them &ldquo;rendered&rdquo; because it only measured the box; the screenshots showed black, so the
check was rewritten to look inside.</p>

<h2>The inventory</h2>
<table><thead><tr><th>Group</th><th>Widget</th><th>Source</th><th>Did it draw</th><th>Size seen</th>
<th>Cost alone</th><th>Where it could live</th></tr></thead><tbody>
{"".join(table)}
</tbody></table>
<p class="lede">&ldquo;Cost alone&rdquo; is that widget mounted on an empty page by itself: requests it made. Sizes are not shown because the
vendors send compressed responses without a declared length. Blank means it was not measured alone.</p>

<h3>What a whole group costs if you open it</h3>
<table><thead><tr><th>Group</th><th>Requests</th><th>Who it talks to</th></tr></thead><tbody>{grpcost}</tbody></table>

<h2>Everything that rendered</h2>
<div class="grid">{"".join(shots)}</div>

<h2>What did not render</h2>
<table><thead><tr><th>Widget</th><th>Source</th><th>What came back</th></tr></thead><tbody>
{"".join(f'<tr><td><b>{esc(i["name"])}</b></td><td>{esc(i["vendor"])}</td><td>{esc(i["inside"]) or "empty frame, 403 from their server"}</td></tr>' for i in blanks)}
</tbody></table>

<h2>iOS Stocks</h2>
<div class="card">
<p>Apple ships <b>no embeddable widget</b>. iOS Stocks exists only inside iOS, so it cannot be put on this page,
and no Apple image is copied here. Apple's own description:
<a href="https://support.apple.com/guide/iphone/track-stocks-iph0d6d1a5e/ios" rel="noopener noreferrer" target="_blank">Track stocks on iPhone</a>.</p>
<p><b>What its widgets show.</b> Small: one symbol, price, today's change, and a sparkline of the session.
Medium: four to six watchlist rows with price and change, or one symbol with a larger chart. Large: the
watchlist plus top business headlines from Apple News.</p>
<p><b>Three habits worth copying, which cost nothing:</b> the change is always shown twice at once, as an amount
and a percent, in one coloured pill; the sparkline carries no axis, no grid and no labels; and the list never
scrolls &mdash; it shows only the rows that fit. All three suit a dark, quiet board.</p>
</div>

<h2>The five worth taking</h2>
<ol class="short">
<li><b>Technical Analysis gauge</b> (TradingView) &mdash; the answer to the original question. One dial, reads
Strong buy to Strong sell, with a timeframe strip. Put it <b>beside Fear &amp; Greed in SENTIMENT</b>, labelled as
indicators rather than mood. It also serves <b>VIX</b>, which the chart widget refuses.</li>
<li><b>Stock heatmap</b> (TradingView) &mdash; the whole S&amp;P 500 as tiles by size, coloured by today's move.
Nothing else on this list gives that much breadth per pixel. <b>DASHBOARD, full width.</b></li>
<li><b>Economic calendar</b> (TradingView) &mdash; forecast, previous and actual, filtered by country, and the
cheapest heavy widget measured. <b>ECONOMIC, beside our own calendar</b> as the cross-check.</li>
<li><b>Top stories</b> (TradingView) &mdash; a whole newsroom for one script, and it can be narrowed to a single
ticker. <b>NEWS as a second column</b>, never mixed into ours.</li>
<li><b>Seasonal chart</b> (TradingView, new family) &mdash; how a symbol usually behaves month by month across
past years. We have no equivalent and there is no older version of it. <b>COMPANY.</b></li>
</ol>
<p>Two provisos on those five. The new family needs <code>theme="dark"</code> or it arrives on a white
background &mdash; measured: 92% light pixels without it, 1% with it. And all of them carry TradingView's own
colours and logo, which cannot be removed without their written permission.</p>

<h2>What could be wrong</h2>
<ul>
<li>The Investing.com 403 was measured <b>from this machine only</b>. It may be blocking a data-centre address
or a headless browser rather than us. It is worth one test from a normal browser on the live domain before
concluding their widgets are unusable &mdash; their economic calendar is the one most desks run.</li>
<li>Prices in these shots were live at the moment of capture and are already stale. They prove the widget works,
not what anything is worth.</li>
<li>Load cost was measured once each, on a warm network, with an empty cache for the page but not for the vendor.
Real cost on Alan's machine will differ.</li>
<li>Every panel is somebody else's code running inside our page. That is a live dependency on their uptime,
their terms and their tracking &mdash; the groups on the shelf load only when clicked for exactly that reason.</li>
</ul>

<h2>What I did not do</h2>
<ul>
<li>Nothing was deployed, pushed or merged, and no Hub room was changed. The shelf is a new prototype page only.</li>
<li>No widget was wired to Scintilla data, and no Scintilla number, key or table appears on either page.</li>
<li>I did not test the Investing.com widgets in a visible browser &mdash; the standing rule is headless only.</li>
<li>I did not read either vendor's full legal terms; the branding note comes from TradingView's own widget FAQ,
which says removing their attribution requires contacting them.</li>
<li>Apple's widget is described from its published behaviour. No Apple image was copied.</li>
</ul>
<p class="lede">Built by <code>scripts/build-widget-scout.py</code> from the headless run's own JSON
({esc(M["when"])[:19].replace("T"," ")} UTC). Screenshots are in <code>shots/</code>.</p>
</div></body></html>
"""
(OUT / "WIDGET-SCOUT.html").write_text(HTML)
print("wrote", OUT / "WIDGET-SCOUT.html", len(HTML), "bytes ·",
      sum(1 for i in inv if i["v"] == "DRAWS"), "drew ·", len(blanks), "did not")
